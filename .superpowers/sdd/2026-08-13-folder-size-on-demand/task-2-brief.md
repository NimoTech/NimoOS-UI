### Task 2: `folderSizes` Pinia store with epoch-guarded async writes

**Files:**
- Create: `src/files/stores/folderSizes.ts`
- Create: `src/files/stores/folderSizes.test.ts`

**Interfaces:**
- Consumes: `service.folder.getFolderSize(path): Promise<number>` (Task 1).
- Produces (used by Tasks 3 & 4):
  - `useFolderSizesStore()` (Pinia setup store, id `'files-folder-sizes'`)
  - `states: Record<string, { status: 'loading' | 'done' | 'error'; bytes?: number }>` (exposed for tests/rendering)
  - `statusOf(path: string): 'idle' | 'loading' | 'done' | 'error'` (missing entry ⇒ `'idle'`)
  - `bytesOf(path: string): number | undefined`
  - `compute(path: string): Promise<void>` (no-op if already `loading`/`done`; `error` recomputes)
  - `reset(): void` (clears all state, bumps epoch)

- [ ] **Step 1: Write the failing tests.** Create `src/files/stores/folderSizes.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getFolderSize: vi.fn() } },
}))

import { useFolderSizesStore } from './folderSizes'
import { service } from '@nimotech/nimoos-service'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('folderSizesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(service.folder.getFolderSize).mockReset()
  })

  it('compute resolves to done with the byte count', async () => {
    vi.mocked(service.folder.getFolderSize).mockResolvedValue(2048)
    const s = useFolderSizesStore()
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('done')
    expect(s.bytesOf('/DATA/Docs')).toBe(2048)
  })

  it('deduplicates: no second request while loading or once done', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const first = s.compute('/DATA/Docs')
    await s.compute('/DATA/Docs') // still loading -> no-op
    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(1)
    d.resolve(10)
    await first
    await s.compute('/DATA/Docs') // done -> cached, no-op
    expect(service.folder.getFolderSize).toHaveBeenCalledTimes(1)
  })

  it('failure lands in error, and compute after error retries the request', async () => {
    vi.mocked(service.folder.getFolderSize).mockRejectedValueOnce(new Error('boom'))
    const s = useFolderSizesStore()
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('error')
    vi.mocked(service.folder.getFolderSize).mockResolvedValueOnce(7)
    await s.compute('/DATA/Docs')
    expect(s.statusOf('/DATA/Docs')).toBe('done')
    expect(s.bytesOf('/DATA/Docs')).toBe(7)
  })

  it('epoch guard: a response arriving after reset() is silently dropped', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const inflight = s.compute('/DATA/Docs')
    s.reset() // listing reloaded while the walk was still running
    d.resolve(999)
    await inflight
    // The stale result must not be written back: the path stays idle.
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
    expect(s.bytesOf('/DATA/Docs')).toBeUndefined()
  })

  it('epoch guard also drops stale failures', async () => {
    const d = deferred<number>()
    vi.mocked(service.folder.getFolderSize).mockReturnValue(d.promise)
    const s = useFolderSizesStore()
    const inflight = s.compute('/DATA/Docs')
    s.reset()
    d.reject(new Error('boom'))
    await inflight
    expect(s.statusOf('/DATA/Docs')).toBe('idle')
  })

  it('reset clears every path', async () => {
    vi.mocked(service.folder.getFolderSize).mockResolvedValue(1)
    const s = useFolderSizesStore()
    await s.compute('/DATA/A')
    await s.compute('/DATA/B')
    s.reset()
    expect(s.statusOf('/DATA/A')).toBe('idle')
    expect(s.statusOf('/DATA/B')).toBe('idle')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `pnpm exec vitest run src/files/stores/folderSizes.test.ts`
Expected: FAIL — module `./folderSizes` does not exist.

- [ ] **Step 3: Implement.** Create `src/files/stores/folderSizes.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `pnpm exec vitest run src/files/stores/folderSizes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/files/stores/folderSizes.ts src/files/stores/folderSizes.test.ts
git commit -s -m "feat(files): add folderSizes store for on-demand folder size

Per-path loading/done/error state keyed to the current directory
listing. An epoch counter drops responses that resolve after a
listing reload, so a slow walk can never write into a newer view."
```

---

