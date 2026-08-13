import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export type FolderSizeStatus = 'idle' | 'loading' | 'done' | 'error'
export interface FolderSizeState {
  status: Exclude<FolderSizeStatus, 'idle'>
  bytes?: number
}

// At most this many folder-size walks run at once. A walk can take up to
// 5 minutes (see folder.ts); browsers cap HTTP/1.1 connections per origin
// at 6, and NimoOS devices are plain HTTP by default, so a handful of
// large-tree clicks without a cap would saturate the whole pool and stall
// every other request on the page (thumbnails, listings, uploads) for the
// duration of the walk. Capping to 3 leaves headroom for the rest of the UI.
const MAX_CONCURRENT = 3

// Per-path on-demand folder size, computed via GET /v1/folder/size.
// Lifetime is one directory listing: filesStore.load() calls reset() on every
// listing load (navigation, refresh, post-op reload), so results can never
// outlive the view they were computed for. Within a view, 'done' acts as the
// cache — re-renders and scroll recycling never re-issue the request.
export const useFolderSizesStore = defineStore('files-folder-sizes', () => {
  const states = ref<Record<string, FolderSizeState>>({})
  // Bumped on every reset(). In-flight computations capture the value at
  // launch and drop their response if it changed meanwhile — the stale-write
  // guard this repo requires on any async write to shared state.
  const epoch = ref(0)

  // One AbortController per epoch, created lazily on the first compute() of
  // that epoch. reset() aborts it so every in-flight walk started by the
  // view being replaced actually dies, instead of finishing pointlessly in
  // the background and being merely ignored by the epoch check below.
  let controller: AbortController | null = null
  // Requests currently in flight (bounded by MAX_CONCURRENT) and the FIFO
  // of thunks that release a queued compute() once a slot frees up.
  let activeCount = 0
  let queue: Array<() => void> = []

  function statusOf(path: string): FolderSizeStatus {
    return states.value[path]?.status ?? 'idle'
  }

  function bytesOf(path: string): number | undefined {
    return states.value[path]?.bytes
  }

  async function runCompute(path: string, myEpoch: number): Promise<void> {
    activeCount++
    if (!controller) controller = new AbortController()
    const signal = controller.signal
    try {
      const bytes = await service.folder.getFolderSize(path, { signal })
      if (epoch.value !== myEpoch) return
      states.value = { ...states.value, [path]: { status: 'done', bytes } }
    } catch (e) {
      if (epoch.value !== myEpoch) return
      console.warn('[files] folder size failed', path, e)
      states.value = { ...states.value, [path]: { status: 'error' } }
    } finally {
      activeCount--
      // Drain one queued compute(), if any. reset() empties this array, so a
      // path queued before a reset simply never gets dequeued here.
      const next = queue.shift()
      next?.()
    }
  }

  async function compute(path: string): Promise<void> {
    const current = statusOf(path)
    if (current === 'loading' || current === 'done') return
    const myEpoch = epoch.value
    states.value = { ...states.value, [path]: { status: 'loading' } }
    if (activeCount >= MAX_CONCURRENT) {
      // No free slot: park behind the ones already running/queued. The path
      // already shows 'loading' above, so the UI doesn't distinguish
      // "queued" from "in flight" — both are just "computing".
      await new Promise<void>((resolve) => { queue.push(resolve) })
    }
    await runCompute(path, myEpoch)
  }

  function reset(): void {
    epoch.value++
    states.value = {}
    controller?.abort()
    controller = null
    queue = []
  }

  return { states, statusOf, bytesOf, compute, reset }
})
