import * as tus from 'tus-js-client'
import type { HttpRequest, DetailedError } from 'tus-js-client'
import { UPLOAD_TUS_ENDPOINT } from '@nimotech/nimoos-service'
import { getClientId } from './clientId'
import type { TusArgs } from './types'

// NOTE: refreshAccessToken is intentionally NOT re-exported here. 401 handling
// belongs to the scheduler (a later task); isRetryableTusError below returns
// false for 401 so tus-js-client does not retry it and lets the error bubble
// up to the scheduler instead.

interface TusAbortError extends Error {
  isAbort: true
}

interface TusPauseError extends Error {
  isPause: true
}

export function tusUpload(args: TusArgs): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // We own resume ourselves: the upload URL is reported back via onUrlAvailable,
    // held in-memory on the queue item (uploads.ts) for the tab's lifetime — not
    // persisted anywhere, so it does not survive a refresh — and passed back in as
    // resumeUrl on a same-session retry (a paused item, or a mid-transfer 5xx/network
    // retry). So tus-js-client must NOT keep its own fingerprint store — a second
    // writer to the same record would race the caller's in-memory copy and clobber
    // the resume URL.
    let reportedUrl: string | null = null
    const upload = new tus.Upload(args.file, {
      endpoint: UPLOAD_TUS_ENDPOINT,
      uploadUrl: args.resumeUrl || null,
      chunkSize: 5 * 1024 * 1024,
      // Auto-resume across a transient disconnect WITHOUT any user action: while the
      // tab stays open the File is still in memory, so tus re-HEADs the upload URL and
      // continues from the server offset. Delays ramp up to ride out a multi-minute
      // outage (~4min total) before giving up to the scheduler's outer retry.
      retryDelays: [0, 1000, 3000, 5000, 10000, 30000, 60000, 60000, 60000],
      // Only auto-retry transient failures (network drop / 5xx / 408 / 429). 401 must
      // fall through to the scheduler so it can refresh the token; other 4xx are
      // permanent (bad path/name) and should fail fast, not loop.
      onShouldRetry: (err: unknown) => isRetryableTusError(err),
      storeFingerprintForResuming: false,
      metadata: {
        filename: args.fileName,
        filetype: args.fileType,
        targetPath: args.targetPath || '',
        relativePath: args.relativePath || args.fileName,
        batch_id: args.batchId || '',
        batch_total: String(args.batchTotal != null ? args.batchTotal : 1),
        resumed: args.resumed ? '1' : '',
        client_id: getClientId(),
        conflictPolicy: args.conflictPolicy || '',
      },
      onBeforeRequest: (req: HttpRequest) => {
        const t = window.localStorage.getItem('access_token')
        if (t) req.setHeader('Authorization', t)
      },
      onAfterResponse: () => {
        // upload.url is populated after the creation POST (and stable on resume).
        // Report it once so the caller can persist it for future resumes.
        if (upload.url && upload.url !== reportedUrl) {
          reportedUrl = upload.url
          if (args.onUrlAvailable) args.onUrlAvailable(upload.url)
        }
      },
      onError: (err: Error) => reject(err),
      onProgress: (sent: number, total: number) => args.onProgress && args.onProgress(sent, total),
      onSuccess: () => resolve(),
    })
    if (args.onStart) {
      args.onStart({
        // Terminate an in-flight upload: send tus DELETE (server marks it canceled and
        // clears staging), then reject this promise with an `isAbort` error so the
        // caller/scheduler stops retrying.
        abort: async () => {
          try {
            await upload.abort(true)
          } catch (_) {
            /* ignore */
          }
          const e = new Error('upload aborted') as TusAbortError
          e.isAbort = true
          reject(e)
        },
        // Pause: stop the transfer but DO NOT terminate (abort(false) keeps the
        // server-side staging + offset), then reject with isPause so the scheduler
        // marks the item paused (not error, not done, not retried).
        pause: async () => {
          try {
            await upload.abort(false)
          } catch (_) {
            /* ignore */
          }
          const e = new Error('upload paused') as TusPauseError
          e.isPause = true
          reject(e)
        },
      })
    }
    upload.start()
  })
}

export function isRetryableTusError(err: unknown): boolean {
  if (!err) return false
  const status = (err as DetailedError).originalResponse && (err as DetailedError).originalResponse!.getStatus()
  if (!status) return true
  if (status >= 500) return true
  if (status === 408 || status === 429) return true
  return false
}

export function tusErrorStatus(err: unknown): number | null {
  return ((err as DetailedError)?.originalResponse?.getStatus?.()) ?? null
}
