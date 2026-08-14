# Folder Size On-Demand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click-to-compute folder size in the files list view, backed by the existing `GET /v1/folder/size` endpoint.

**Architecture:** A new `folderSizes` Pinia store holds per-path compute state (`loading/done/error`) with an epoch counter guarding against stale async writes; `filesStore.load()` resets it on every listing load; `FileRow.vue`'s size cell renders four states for directories. The service package's existing (unused) `getFolderSize` wrapper is tightened to `Promise<number>` with a 5-minute per-request timeout.

**Tech Stack:** Vue 3 `<script setup>` + Pinia (setup stores) + vitest/jsdom + @vue/test-utils. Repo: `/home/nimo/NimoTech/NimoOS-New-UI`.

**Spec:** `docs/superpowers/specs/2026-08-12-folder-size-on-demand-design.md` (read it first).

## Global Constraints

- **All code comments, test names, and log strings in English.** (Workspace-wide hard rule.)
- **Every commit uses `git commit -s`** (DCO sign-off) with an **English** message. (User directive 2026-08-13.)
- **No color literals in CSS** — theme tokens (`var(--fg-muted)`, `var(--accent)`) only.
- **New i18n keys must be added to BOTH `src/i18n/zh_cn.ts` and `src/i18n/en_us.ts`** — `src/i18n/parity.test.ts` fails otherwise. (Vue2 `zh_CN.json` was checked: it has no standalone "计算/重试" button copy, so this is new copy, not a port.)
- Package manager is **pnpm**. Run tests from repo root: `pnpm exec vitest run <path>`.
- Task 1 touches `packages/service/` — for **manual browser testing only**, that requires a dev-server restart + hard refresh (see CLAUDE.md); vitest/vue-tsc pick up source changes directly, no extra step in this plan.
- Grid view (`FileTile.vue`) is explicitly out of scope. No properties dialog. No persistent cache.

---

### Task 1: Tighten `getFolderSize` in the service package (typed + long timeout)

**Files:**
- Modify: `packages/service/src/folder.ts:19-22`
- Test: `packages/service/src/folder.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `service.folder.getFolderSize(path: string): Promise<number>` — returns total size in bytes; request carries `timeout: 300000`. Task 2 calls exactly this.

**Background:** The backend (`NimoOS/route/v1/file.go` `GetSize`) walks the whole subtree on every call and returns the standard envelope `{success: 200, message: "ok", data: <int64 bytes>}`. The axios default timeout is 60s (`packages/service/src/http.ts:50`), which would cut off large-tree walks — hence the per-request 5-minute budget.

- [ ] **Step 1: Update the test.** In `packages/service/src/folder.test.ts`, the existing combined test at lines 35-42 mocks the size response as `data: { size: 1 }`, which is NOT the real envelope shape. Replace that test with these two (keep the rest of the file untouched):

```ts
  it('getFolderSize hits /folder/size with path, a 5-minute timeout, and returns the byte count', async () => {
    let url = ''
    let cfg: { params?: unknown; timeout?: number } | undefined
    // Real device envelope: data is the raw int64 byte count, not an object.
    const http = {
      get: async (u: string, c?: { params?: unknown; timeout?: number }) => {
        url = u; cfg = c
        return { data: { success: 200, message: 'ok', data: 123456789 } }
      },
    } as unknown as import('axios').AxiosInstance
    const bytes = await createFolder(http).getFolderSize('/DATA/x')
    expect(url).toBe('/folder/size')
    expect(cfg?.params).toEqual({ path: '/DATA/x' })
    expect(cfg?.timeout).toBe(300000)
    expect(bytes).toBe(123456789)
  })

  it('getFolderCount hits /folder/count with path', async () => {
    let url = ''
    let params: unknown
    const http = {
      get: async (u: string, c?: { params?: unknown }) => {
        url = u; params = c?.params
        return { data: { success: 200, message: 'ok', data: 42 } }
      },
    } as unknown as import('axios').AxiosInstance
    await createFolder(http).getFolderCount('/DATA/x')
    expect(url).toBe('/folder/count')
    expect(params).toEqual({ path: '/DATA/x' })
  })
```

- [ ] **Step 2: Run the test to verify the new expectations fail.**

Run: `pnpm exec vitest run packages/service/src/folder.test.ts`
Expected: FAIL — `cfg?.timeout` is `undefined` (no timeout passed yet); the return-type assertion may pass by accident, the timeout one must fail.

- [ ] **Step 3: Implement.** In `packages/service/src/folder.ts`, replace the `getFolderSize` method (leave `getFolderCount` as-is apart from nothing — do not change it):

```ts
    async getFolderSize(path: string): Promise<number> {
      // The backend walks the entire subtree on every call (no caching);
      // large trees on spinning disks can take minutes. The axios default
      // timeout (60s, http.ts) would cut that off, so this request gets
      // its own 5-minute budget.
      const res = await http.get('/folder/size', { params: { path }, timeout: 300000 })
      return unwrap<number>(res.data)
    },
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `pnpm exec vitest run packages/service/src/folder.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit.**

```bash
git add packages/service/src/folder.ts packages/service/src/folder.test.ts
git commit -s -m "feat(service): type getFolderSize and give it a 5-minute timeout

The wrapper existed but was never called and returned unknown. The
backend recursively walks the subtree per call, which can exceed the
60s axios default on large trees, so the request carries its own
timeout. Fixture updated to the real envelope (data is the raw byte
count, not an object)."
```

---

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

### Task 3: Reset folder sizes on every listing load

**Files:**
- Modify: `src/files/stores/files.ts` (the `load()` function, around line 66)
- Test: `src/files/stores/files.test.ts` (append one test)

**Interfaces:**
- Consumes: `useFolderSizesStore().reset()` and `compute()`/`statusOf()` (Task 2).
- Produces: the invalidation guarantee Tasks 2/4 rely on — every listing load clears all computed sizes. Navigation, context-menu refresh, and post-file-op reloads all funnel through `load()`, so this one hook covers every invalidation trigger in the spec.

- [ ] **Step 1: Write the failing test.** In `src/files/stores/files.test.ts`, the module-level `vi.mock('@nimotech/nimoos-service', ...)` factory (top of file) must gain a `getFolderSize: vi.fn(async () => 4096)` entry next to `getList` inside `folder: { ... }`. Then append inside the existing `describe('filesStore', ...)` block:

```ts
  it('load resets folderSizes so computed sizes never survive a listing reload', async () => {
    const { useFolderSizesStore } = await import('./folderSizes')
    const sizes = useFolderSizesStore()
    await sizes.compute('/DATA/Documents')
    expect(sizes.statusOf('/DATA/Documents')).toBe('done')
    const files = useFilesStore()
    await files.load('/DATA')
    expect(sizes.statusOf('/DATA/Documents')).toBe('idle')
  })
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `pnpm exec vitest run src/files/stores/files.test.ts`
Expected: the new test FAILS (`'done'` instead of `'idle'`); all pre-existing tests still pass.

- [ ] **Step 3: Implement.** In `src/files/stores/files.ts`:

Add the import next to the other store imports at the top:

```ts
import { useFolderSizesStore } from './folderSizes'
```

In `load()`, right after `clearSelection()`:

```ts
  async function load(realPath: string) {
    clearSelection()
    // New listing, new world: computed folder sizes from the previous view
    // must not leak into this one (see folderSizes.ts for the epoch guard).
    useFolderSizesStore().reset()
    loading.value = true
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `pnpm exec vitest run src/files/stores/files.test.ts`
Expected: PASS (entire file).

- [ ] **Step 5: Commit.**

```bash
git add src/files/stores/files.ts src/files/stores/files.test.ts
git commit -s -m "feat(files): clear computed folder sizes on every listing load

Navigation, refresh and post-operation reloads all go through
filesStore.load(), so one reset hook covers every moment the
directory contents may have changed."
```

---

### Task 4: Four-state size cell in FileRow + i18n keys

**Files:**
- Modify: `src/files/components/FileRow.vue` (script imports, the `.file-size` span at line 56, scoped styles)
- Modify: `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (3 new keys each)
- Test: `src/files/components/FileRow.test.ts` (replace one test, add four)

**Interfaces:**
- Consumes: `useFolderSizesStore()` — `statusOf`, `bytesOf`, `compute`, `states` (Task 2).
- Produces: user-facing feature. CSS class `size-compute` on the clickable button (idle/error states).

- [ ] **Step 1: Add i18n keys.** In `src/i18n/zh_cn.ts`, near the other `files*` keys:

```ts
  filesFolderSizeCompute: '计算',
  filesFolderSizeComputing: '计算中…',
  filesFolderSizeRetry: '重试',
```

In `src/i18n/en_us.ts`, same location:

```ts
  filesFolderSizeCompute: 'Calculate',
  filesFolderSizeComputing: 'Calculating…',
  filesFolderSizeRetry: 'Retry',
```

- [ ] **Step 2: Update the tests.** In `src/files/components/FileRow.test.ts`, REPLACE the test `'keeps an empty size cell for directories (column alignment)'` (lines 23-27) with the following, and add the imports `import { useFolderSizesStore } from '../stores/folderSizes'` and `vi` to the existing vitest import:

```ts
  const dirEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }

  it('directory idle: size cell shows a Calculate button; click computes, does not open', async () => {
    const sizes = useFolderSizesStore()
    const spy = vi.spyOn(sizes, 'compute').mockResolvedValue()
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    const btn = w.get('.file-size button.size-compute')
    expect(btn.text()).toBe('计算')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith('/DATA/Docs')
    expect(w.emitted('open')).toBeFalsy()
    expect(w.emitted('select')).toBeFalsy()
  })

  it('directory loading: size cell shows computing label, no button', () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'loading' }
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    expect(w.get('.file-size').text()).toBe('计算中…')
    expect(w.find('.file-size button').exists()).toBe(false)
  })

  it('directory done: size cell shows the formatted byte count as plain text', () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'done', bytes: 1536 }
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    expect(w.get('.file-size').text()).toBe('1.5 KB')
    expect(w.find('.file-size button').exists()).toBe(false)
  })

  it('directory error: size cell shows a Retry button that recomputes', async () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'error' }
    const spy = vi.spyOn(sizes, 'compute').mockResolvedValue()
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    const btn = w.get('.file-size button.size-compute')
    expect(btn.text()).toBe('重试')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith('/DATA/Docs')
  })

  it('uploading placeholder keeps the uploading label in the size cell (no compute button)', () => {
    const w = mount(FileRow, {
      props: { entry: { name: 'up', path: '/DATA/up', is_dir: true, uploading: true } },
      ...mountOpts,
    })
    expect(w.find('.file-size button').exists()).toBe(false)
  })
```

- [ ] **Step 3: Run tests to verify the new ones fail.**

Run: `pnpm exec vitest run src/files/components/FileRow.test.ts`
Expected: the five new/replaced tests FAIL (no `.size-compute` button rendered yet); pre-existing tests pass.

- [ ] **Step 4: Implement FileRow.** In `src/files/components/FileRow.vue`:

Script additions (top, next to existing imports):

```ts
import { computed } from 'vue'
import { useFolderSizesStore } from '../stores/folderSizes'
```

After `const clipboard = useClipboardStore()`:

```ts
const folderSizes = useFolderSizesStore()
const sizeStatus = computed(() => folderSizes.statusOf(props.entry.path))
```

Replace the single-line size span (line 56) with:

```html
    <span class="file-size">
      <template v-if="props.entry.uploading">{{ $t('filesUploadingLabel') }}</template>
      <template v-else-if="!props.entry.is_dir">{{ renderSize(props.entry.size ?? 0) }}</template>
      <template v-else-if="sizeStatus === 'done'">{{ renderSize(folderSizes.bytesOf(props.entry.path) ?? 0) }}</template>
      <template v-else-if="sizeStatus === 'loading'">{{ $t('filesFolderSizeComputing') }}</template>
      <button
        v-else
        type="button"
        class="size-compute"
        @click.stop="folderSizes.compute(props.entry.path)"
      >{{ sizeStatus === 'error' ? $t('filesFolderSizeRetry') : $t('filesFolderSizeCompute') }}</button>
    </span>
```

Note the `@click.stop` — the row's own `@click` opens the folder; the button must not bubble into it (the tests assert no `open` emit).

Scoped style additions (inside the existing `<style scoped>`):

```css
/* On-demand folder size trigger. Rendered as text-like button: muted at rest,
   accent on hover. font: inherit picks up the 12px cell size. */
.size-compute { background: none; border: none; padding: 0; font: inherit; color: var(--fg-muted); cursor: pointer; }
.size-compute:hover { color: var(--accent); }
```

- [ ] **Step 5: Run the component and i18n tests.**

Run: `pnpm exec vitest run src/files/components/FileRow.test.ts src/i18n/parity.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Commit.**

```bash
git add src/files/components/FileRow.vue src/files/components/FileRow.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -s -m "feat(files): click-to-compute folder size in the list view

Folder rows historically rendered an empty size cell (the listing
returns the inode size, which would mislead). The cell now offers
Calculate -> Computing -> formatted size, with inline Retry on
failure. Grid view intentionally untouched."
```

---

### Task 5: Full-suite verification gate

**Files:** none (verification only).

**Interfaces:** consumes everything above; produces the green light for review/deploy.

- [ ] **Step 1: Type check.**

Run: `pnpm exec vue-tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Full test suite.**

Run: `pnpm test`
Expected: all green. If any unrelated test regressed, investigate before touching it — do not silence.

- [ ] **Step 3: Theme-token audit.**

Run: `git diff master --stat && git diff master -- src packages | grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' || echo CLEAN`
Expected: `CLEAN` (no new color literals).

- [ ] **Step 4: Report.** Summarize commits and test counts. Do NOT deploy — real-device acceptance (deploy via `./scripts/deploy.sh` + browser checks against large folders in `/DATA`) is the user's call after review.

---

## Verification (end-to-end, post-merge / on device)

1. Deploy: `./scripts/deploy.sh`, open `/app/#/files` in a real browser.
2. Small folder: click "计算" → result appears within ~1s, formatted like file sizes.
3. Large folder (media library under `/DATA`): click → "计算中…" persists visibly, eventually resolves to a plausible total.
4. While computing, navigate into another folder and back → cell is back to "计算" (reset), no cross-view number leakage.
5. Delete a file inside a folder, return to parent → cell shows "计算" again; recomputed value reflects the deletion.
6. Snapshot browse view: the button works there too (read-only op).
7. Failure path: click on a folder the user has no permission for (or stop the backend) → "重试" appears, clicking retries.
