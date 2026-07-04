import { tusUpload, isRetryableTusError, tusErrorStatus } from './tusClient'
import type { UploadItem } from './types'

// Outer backoff between whole-upload retry attempts. Distinct from tus-js-client's
// internal `retryDelays`, which handle transient mid-transfer reconnects; this
// backoff governs restarting an entire failed attempt (e.g. after a 5xx/408/429).
export const BACKOFF_MS = [1000, 3000, 9000]

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

export interface SchedulerDeps {
  claimNext: () => UploadItem | null
  patch: (id: string, patch: Partial<UploadItem>) => void
  refresh: () => Promise<string | null>
  concurrency?: number
  sleepFn?: (ms: number) => Promise<void>
  upload?: typeof tusUpload
}

// Stable code strings — NOT prose. The UI layer (UploadPanel, Task 8) maps these
// to zh_cn via uploadErrorKey. 409 is handled separately as error:'duplicate'.
function humanize(status: number | null): string {
  if (status === 413) return 'no_space'
  if (status === 403) return 'protected'
  if (status === 400) return 'bad_name'
  if (status === 401) return 'expired'
  if (status != null && status >= 500) return 'server'
  return 'network'
}

export function createScheduler(deps: SchedulerDeps) {
  const concurrency = deps.concurrency || 3
  const sleepFn = deps.sleepFn || defaultSleep
  const upload = deps.upload || tusUpload
  let running = false

  // In-flight uploads: id -> handle. abort(id) uses this to cancel a running upload.
  const active = new Map<string, { abort: () => Promise<void>; pause: () => Promise<void> }>()

  async function uploadOne(item: UploadItem): Promise<void> {
    deps.patch(item.id, { status: 'uploading', error: '', speed: 0 })
    let authRefreshUsed = false
    for (let attempt = 0; attempt <= 3; attempt++) {
      // A pause requested during a gap with no active handle (retry backoff sleep,
      // or the 401-refresh await) is caught here via the fallback patch in pause()
      // below, which mutates this same item object. Stop re-uploading.
      if (item.status === 'paused') {
        active.delete(item.id)
        return
      }
      // Speed-sampling state resets on every attempt (incl. retries) so a resume/retry
      // gap in time doesn't produce a bogus instantaneous speed spike.
      let lastTs = 0
      let lastBytes = 0
      let speedEMA = 0
      try {
        await upload({
          file: item.file as File | Blob,
          fileName: item.fileName,
          fileType: item.fileType,
          targetPath: item.targetPath,
          relativePath: item.relativePath || item.fileName,
          batchId: item.batchId || '',
          batchTotal: item.batchTotal != null ? item.batchTotal : 1,
          // Restored-from-IDB items are re-uploads of a file the user already started.
          // Tell the server so a name collision with the original overwrites instead
          // of creating a "(1)" duplicate.
          resumed: !!item.restored,
          conflictPolicy: item.conflictPolicy || '',
          resumeUrl: item.tusUploadUrl || undefined,
          onUrlAvailable: (url) => {
            if (url && url !== item.tusUploadUrl) deps.patch(item.id, { tusUploadUrl: url })
          },
          onStart: (handle) => { active.set(item.id, handle) },
          onProgress: (sent, total) => {
            const pct = total ? Math.floor((sent / total) * 100) : 0
            const patch: Partial<UploadItem> = { progress: pct, bytesSent: sent }
            const now = Date.now()
            if (!lastTs) {
              lastTs = now
              lastBytes = sent
            } else {
              const dt = (now - lastTs) / 1000
              // At least 0.25s between samples — denser sampling makes the number jitter.
              if (dt >= 0.25) {
                const inst = Math.max(0, (sent - lastBytes) / dt) // bytes/s
                speedEMA = speedEMA ? speedEMA * 0.6 + inst * 0.4 : inst
                patch.speed = Math.round(speedEMA)
                lastTs = now
                lastBytes = sent
              }
            }
            deps.patch(item.id, patch)
          },
        })
        active.delete(item.id)
        deps.patch(item.id, { status: 'done', progress: 100, error: '', speed: 0, doneAt: Date.now() })
        return
      } catch (err: any) {
        active.delete(item.id)
        // User-initiated cancel: don't set error, don't retry (row is usually already
        // removed by the store).
        if (err && err.isAbort) return
        if (err && err.isPause) {
          deps.patch(item.id, { status: 'paused', speed: 0 })
          return
        }
        const status = tusErrorStatus(err)
        if (status === 409) {
          deps.patch(item.id, { status: 'done', progress: 100, error: 'duplicate', speed: 0 })
          return
        }
        if (status === 401 && !authRefreshUsed) {
          authRefreshUsed = true
          const fresh = await deps.refresh()
          if (fresh) {
            attempt--
            continue
          }
          deps.patch(item.id, { status: 'error', error: 'expired', retryCount: attempt, speed: 0 })
          return
        }
        const retryable = isRetryableTusError(err)
        if (!retryable || attempt === 3) {
          deps.patch(item.id, { status: 'error', error: humanize(status), retryCount: attempt, speed: 0 })
          return
        }
        await sleepFn(BACKOFF_MS[attempt])
        deps.patch(item.id, { retryCount: attempt + 1 })
      }
    }
  }

  async function run(): Promise<void> {
    if (running) return
    running = true
    try {
      const worker = async () => {
        for (;;) {
          const next = deps.claimNext()
          if (!next) return
          await uploadOne(next)
        }
      }
      const workers = []
      for (let i = 0; i < concurrency; i++) workers.push(worker())
      await Promise.all(workers)
    } finally {
      running = false
    }
  }

  // Abort an in-flight upload. No-op if there's no active handle (pending/needs_file/
  // error). Doesn't await the underlying DELETE so the caller can drop the row now.
  function abort(id: string): void {
    const h = active.get(id)
    if (h) {
      active.delete(id)
      Promise.resolve().then(() => h.abort()).catch(() => {})
    }
  }

  // Pause an in-flight upload. If there's no active handle — the item is mid-retry
  // (inside the outer backoff sleep) or mid-401-refresh — fall back to patching the
  // status directly so the pause intent isn't lost; uploadOne's per-attempt guard
  // observes this on the item object and stops re-uploading.
  function pause(id: string): void {
    const h = active.get(id)
    if (h) {
      active.delete(id)
      Promise.resolve().then(() => h.pause()).catch(() => {})
    } else {
      deps.patch(id, { status: 'paused', speed: 0 })
    }
  }

  return { run, isRunning: () => running, abort, pause }
}
