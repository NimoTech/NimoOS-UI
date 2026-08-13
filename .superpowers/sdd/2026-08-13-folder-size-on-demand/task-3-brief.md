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

