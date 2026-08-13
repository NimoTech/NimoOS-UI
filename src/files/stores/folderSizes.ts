import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export type FolderSizeStatus = 'idle' | 'loading' | 'done' | 'error'
export interface FolderSizeState {
  status: Exclude<FolderSizeStatus, 'idle'>
  bytes?: number
}

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

  function statusOf(path: string): FolderSizeStatus {
    return states.value[path]?.status ?? 'idle'
  }

  function bytesOf(path: string): number | undefined {
    return states.value[path]?.bytes
  }

  async function compute(path: string): Promise<void> {
    const current = statusOf(path)
    if (current === 'loading' || current === 'done') return
    const myEpoch = epoch.value
    states.value = { ...states.value, [path]: { status: 'loading' } }
    try {
      const bytes = await service.folder.getFolderSize(path)
      if (epoch.value !== myEpoch) return
      states.value = { ...states.value, [path]: { status: 'done', bytes } }
    } catch (e) {
      if (epoch.value !== myEpoch) return
      console.warn('[files] folder size failed', path, e)
      states.value = { ...states.value, [path]: { status: 'error' } }
    }
  }

  function reset(): void {
    epoch.value++
    states.value = {}
  }

  return { states, statusOf, bytesOf, compute, reset }
})
