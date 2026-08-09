## Task 8: 详情页两段照片网格

**Files:**
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `featuredAssets` / `allAssets` / `manualIds`（Task 7）· `useLightbox`（既有 `src/photos/lightbox/useLightbox.ts`）
- Produces: `selecting` / `selectedIds` 两个 ref，供 Task 9 的批量移除消费

**新增 i18n 键**：`photosMoAllPhotos` · `photosMoLoading` · `photosMoNoPhotosYet`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('两段照片网格', () => {
  function mockAssets(featured: unknown[], all: unknown[], members: unknown[] = []) {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, f: boolean) =>
      f ? { assets: featured, members, places: [] } : all)
  }

  it('Featured 有内容时渲染该分节,并在标题上显示张数', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [{ id: 'f1' }, { id: 'f2' }, { id: 'a3' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').text()).toContain('2')
    expect(w.findAll('[data-test="mo-featured-tile"]')).toHaveLength(2)
  })

  it('Featured 为空时整个分节不渲染', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-featured-head"]').exists()).toBe(false)
  })

  it('manual 成员在 Featured 里显示 pin 角标,非 manual 不显示', async () => {
    mockAssets([{ id: 'f1' }, { id: 'f2' }], [], [
      { asset_id: 'f1', manual: true, featured: true },
      { asset_id: 'f2', manual: false, featured: true },
    ])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.findAll('[data-test="mo-pin-tag"]')).toHaveLength(1)
  })

  it('All photos 为空且加载完毕时显示"还没有照片"', async () => {
    mockAssets([], [])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-all-empty"]').exists()).toBe(true)
  })

  it('非选择态点瓦片打开灯箱;选择态点瓦片只切选中,不开灯箱', async () => {
    mockAssets([], [{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    // ⚠️ useLightbox().open 是 Ref<boolean>,不是函数;打开的方法叫 openAt。
    const lb = useLightbox()
    const openAt = vi.spyOn(lb, 'openAt')

    await w.findAll('[data-test="mo-all-tile"]')[0].trigger('click')
    expect(openAt).toHaveBeenCalledTimes(1)

    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.findAll('[data-test="mo-all-tile"]')[1].trigger('click')
    expect(openAt).toHaveBeenCalledTimes(1)                     // 没有再开
    expect(w.find('[data-test="mo-select-bar"]').text()).toContain('1')
  })

  it('退出选择态会清空已选', async () => {
    mockAssets([], [{ id: 'a1' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    await w.find('[data-test="mo-all-tile"]').trigger('click')
    await w.find('[data-test="mo-select-toggle"]').trigger('click')
    expect(w.find('[data-test="mo-select-bar"]').exists()).toBe(false)
  })
})
```

> 顶部需 `import { useLightbox } from '../photos/lightbox/useLightbox'`。
> **⚠️ 该 composable 的 `open` 是 `Ref<boolean>`，不是函数** —— 打开灯箱的方法叫
> `openAt(photo, entryList, startMs?, query?)`（`useLightbox.ts:144,155`）。上面用例里的
> `vi.spyOn(lb, 'openAt')`，别写成 `open`（写成 `open` 会 spy 到一个 ref 上，报
> `Cannot spy on a non-function value` 或静默失效）。

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-featured-tile"]` 找不到

- [ ] **Step 3: 实现**

在 `PhotosMomentDetail.vue` 补：

```ts
const selecting = ref(false)
const selectedIds = ref<string[]>([])

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selectedIds.value = []
}
function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}
function onTileClick(p: Photo, list: Photo[]): void {
  if (selecting.value) toggleSelect(String(p.id))
  else lightbox.openAt(p, list)   // openAt(photo, entryList) —— open 是 Ref,不是函数
}
```

模板两段网格照 Vue2 `:52-79`，瓦片加 `data-test="mo-featured-tile"` / `mo-all-tile"`，pin 角标 `data-test="mo-pin-tag"`，选择栏 `data-test="mo-select-bar"`，Select 按钮 `data-test="mo-select-toggle"`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 23 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): render the moment's featured and full photo grids

Pin badges come from the with_members receipts and only overlay the featured
strip, matching Vue 2. Selection mode suppresses the lightbox so a tap during
selection cannot both select and open."
```

---

