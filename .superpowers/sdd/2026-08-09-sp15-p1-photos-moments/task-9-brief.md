## Task 9: 加入照片 / 移出照片

**Files:**
- Modify: `src/photos/components/AlbumLibraryPicker.vue`（**泛化**，见 Step 0）
- Modify: `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`
- Modify: `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue`（两个既有消费方适配新 props）
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.pin` / `store.exclude`（Task 3）· `useToast`
- Produces: `AlbumLibraryPicker` 的新签名
  - props: `{ open: boolean; title: string; existingIds: Set<string>; existingLabel: string; submitLabel: string }`
  - emits: `{ 'update:open': (v: boolean) => void; confirm: (ids: string[]) => void }`

> **⚠️ 这一步是计划写完后自审逮到的，原稿写的「复用 `AlbumLibraryPicker`」不成立。**
> New-UI 的 `AlbumLibraryPicker.vue`（393 行）是**相册专用**的：props 是 `{ open, albumId, albumName }`，
> `existingIds` 直接读 `albums.assetsOf(props.albumId)`（`:54`），提交时自己调
> `albums.addAssetsToAlbum`（`:136`）。时刻不是相册，这三处都对不上。
>
> Vue2 早就解决过：`#79` 把 `PhotosAlbumLibraryPicker.vue` 泛化成通用的
> `PhotosLibraryPicker.vue`（`R072` 重命名 + 43 行改动）—— 而 **`#79` 没有被 SP7 吸收**
> （New-UI 的 `pinSmartViewAssets`/`removeSmartViewAssets`/`restoreSmartViewAssets`/
> `getSmartViewExcluded` 四个方法全无），所以泛化这一步也没跟过来。
>
> **本期只做泛化，不做重命名。** 重命名是 `#79` 的一部分，跟 `#79` 的其余内容一起归 P2；
> P1 只取它必需的那一半，把文件名与「其实已经不只服务相册」的落差登记在文件头。

- [ ] **Step 0: 泛化 AlbumLibraryPicker（先跑既有测试确认基线绿）**

Run 基线：`pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts --reporter=verbose` → 记下用例数。

改三处（其余 380 余行不动）：

```ts
// props:相册专用三件套 → 通用四件套
const props = defineProps<{
  open: boolean
  title: string
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string
}>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', ids: string[]): void
}>()

// :54 原本自己从 albums store 取;改为直接用 prop(调用方负责算)
const existingIds = computed(() => props.existingIds)

// :136 原本自己写库;改为把 id 交出去,由调用方决定写到哪
emit('confirm', ids)
```

同时删掉不再需要的 `usePhotosAlbums` import（若泛化后无其它用途）。

两个既有消费方各自补上原本由组件内部承担的两件事：
- `PhotosAlbums.vue:366` 与 `PhotosAlbumDetail.vue:597`：传
  `:existing-ids="new Set(albums.assetsOf(id).map(p => String(p.id)))"`、`:title`、
  `:existing-label`、`:submit-label`，并把 `@confirm` 接到 `albums.addAssetsToAlbum(...)` 上，
  成功后仍 emit 原来的 `added` 语义（toast 与计数逻辑保持不变）。

在 `AlbumLibraryPicker.test.ts` 里把 props 改成新签名，并新增一条用例：

```ts
it('SP15-P1-T9 泛化:提交时只 emit confirm,不自己写库', async () => {
  const albums = usePhotosAlbums()
  const spy = vi.spyOn(albums, 'addAssetsToAlbum')
  const w = mountPicker({ open: true, existingIds: new Set<string>() })
  // …选中一张…
  await w.find('[data-test="alp-submit"]').trigger('click')
  expect(spy).not.toHaveBeenCalled()
  expect(w.emitted('confirm')?.[0]?.[0]).toEqual(['a1'])
})
```

跑：`pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/views/PhotosAlbums src/views/PhotosAlbumDetail --reporter=verbose`
Expected: 既有用例数不减，全绿（证明相册两条路径行为未变）

提交：

```bash
git add src/photos/components/AlbumLibraryPicker.vue src/photos/components/__tests__/AlbumLibraryPicker.test.ts src/views/PhotosAlbums.vue src/views/PhotosAlbumDetail.vue
git commit -m "refactor(photos): make the library picker album-agnostic

It hardcoded the album store for both halves of its job: reading which assets
are already in, and writing the chosen ones back. Moments need the same picker
against a different collection, so both halves move out to the caller and the
component is left with the picking.

Vue 2 made this exact change in #79, along with a rename. Only the
generalisation is needed here; the rename travels with the rest of #79 in P2."
```

**新增 i18n 键**：`photosMoAddPhotos` · `photosMoAddPhotosTitle`（`加入「{name}」`）· `photosMoAlreadyIn` · `photosMoAddSelected` · `photosMoAddedN` · `photosMoAddFailed` · `photosMoRemoveFromMoment` · `photosMoRemovedN` · `photosMoRemoveFailed` · `photosMoSelectedN`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('加入 / 移出照片', () => {
  it('加入成功:调 pin、刷新两段网格、张数跟着变、弹成功 toast', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [])
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    const pin = vi.spyOn(s, 'pin').mockResolvedValue(44)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()

    await w.find('[data-test="mo-add-photos"]').trigger('click')
    w.findComponent(AlbumLibraryPicker).vm.$emit('confirm', ['x', 'y'])
    await new Promise((r) => setTimeout(r, 0))

    expect(pin).toHaveBeenCalledWith('m1', ['x', 'y'])
    expect(s.byId('m1')?.assetCount).toBe(44)
    expect(show).toHaveBeenCalled()
  })

  it('加入失败:弹失败 toast,张数不动', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [])
    const s = usePhotosMoments(); s.moments = [makeMoment({ assetCount: 42 })]; s.listLoaded = true
    vi.spyOn(s, 'pin').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-add-photos"]').trigger('click')
    w.findComponent(AlbumLibraryPicker).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(s.byId('m1')?.assetCount).toBe(42)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('失败'), expect.anything(), 'danger')
  })

  it('移出成功:调 exclude、退出选择态、清空已选、刷新网格', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const exclude = vi.spyOn(s, 'exclude').mockResolvedValue(41)
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(exclude).toHaveBeenCalledWith('m1', ['a1'])
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })

  it('移出失败:保持选择态与已选不变(用户可重试)', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exclude').mockRejectedValue(new Error('nope'))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(true)
  })

  it('已选为空时移出按钮不发请求', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: [], members: [], places: [] } : [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const exclude = vi.spyOn(s, 'exclude')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)  // 空选时整条不渲染
    expect(exclude).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-add-photos"]` 找不到

- [ ] **Step 3: 实现**

```ts
const pickerOpen = ref(false)
const memberIds = computed(() => new Set(allAssets.value.map((p) => String(p.id))))

async function onPickPhotos(assetIds: string[]): Promise<void> {
  try {
    await store.pin(momentId.value, assetIds)
    toast.show(t('photosMoAddedN', { n: assetIds.length }))
    await load()
  } catch (e) {
    console.error('[photos-moments] pin', e)
    toast.show(t('photosMoAddFailed'), 2500, 'danger')
  }
}

async function removeSelected(): Promise<void> {
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    await store.exclude(momentId.value, ids)
    toast.show(t('photosMoRemovedN', { n: ids.length }))
    // 成功才退出选择态;失败保持原状让用户重试(Vue2 :386-387 同样只在成功分支清空)
    selecting.value = false
    selectedIds.value = []
    await load()
  } catch (e) {
    console.error('[photos-moments] exclude', e)
    toast.show(t('photosMoRemoveFailed'), 2500, 'danger')
  }
}
```

模板：Add photos 按钮 `data-test="mo-add-photos"`；选择栏里的移出按钮 `data-test="mo-remove-selected"`；`<AlbumLibraryPicker>` 按 Step 0 泛化后的新签名挂载：

```vue
    <AlbumLibraryPicker
      v-model:open="pickerOpen"
      :title="t('photosMoAddPhotosTitle', { name: moment?.title ?? '' })"
      :existing-ids="memberIds"
      :existing-label="t('photosMoAlreadyIn')"
      :submit-label="t('photosMoAddSelected')"
      @confirm="onPickPhotos"
    />
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 28 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add and remove photos from a moment

The count no longer has to be mirrored back to the list by hand — both views
read the same store entry — so Vue 2's asset-count-changed event has no
equivalent here.

Selection is cleared only on success. Vue 2 does the same, and it matters: on
failure the user still has their selection and can retry."
```

---

