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

