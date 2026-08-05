### Task 4: 时间线页 `views/Photos.vue` 接线

**Files:**
- Modify: `src/views/Photos.vue`
- Test: `src/views/__tests__/Photos.test.ts`(若不存在则新建;先 `ls src/views/__tests__/` 确认现有相册页测试文件名)

**Interfaces:**
- Consumes: T1 的 `applyExifFilters`;T2 的 `PhotosFilterBar` + `ExifFilterValue`;T3 的 `after-tabs` 槽位。
- Produces: 无下游。

**改动要点(照 Vue2 `PhotosTimeline.vue:142-175` 的 `gridMonths`)**:

1. 新增 `const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })`。
2. 新增 `gridMonths` computed:对 `store.months` 每个月做 `applyExifFilters`,再丢掉空月份——逐行对应 Vue2 `:170-172`。空月份必须在这里丢:`PhotosGrid` 的月份刻度尺(`scrubberRef`,`PhotosGrid.vue:88`)读的是**未按标签页过滤**的 `props.months`,留着空月份会在刻度尺上留下点不到的死刻度。
3. `PhotosGrid` 的 `:months` 从 `store.months` 改成 `gridMonths`。
4. `filteredCount`(D20)改成先过 EXIF 再过标签页。
5. `onOpenTile` 重建翻页集时同样改用 `gridMonths`——否则灯箱能翻到被筛掉的照片(与用户所见不一致,是 D9 在本页的同型要求)。
6. FilterBar 挂进 `PhotosToolbar` 的 `#after-tabs`,`:photos="store.allPhotos"`(facet 源恒取**全库**,不受当前筛选收窄——照 Vue2:它的 facet 源是 `displayMonths`,与 `gridMonths` 是两回事,否则筛掉一个年份后该年份就从下拉里消失、再也选不回来)。

- [ ] **Step 1: 写失败的测试**

在 `src/views/__tests__/Photos.test.ts` 追加(若文件不存在则新建,mount 脚手架照同目录既有相册页测试的写法——需要 `createTestingPinia` / i18n / router stub / 共享包 mock):

```ts
describe('P7b-T4: EXIF 筛选接线', () => {
  it('工具栏 after-tabs 槽位里挂着 PhotosFilterBar', () => {
    const w = mountPhotos()
    expect(w.findComponent(PhotosFilterBar).exists()).toBe(true)
  })

  it('FilterBar 的 facet 源是全库 allPhotos,不随已生效的筛选收窄', async () => {
    const w = mountPhotos()
    const bar = w.findComponent(PhotosFilterBar)
    const before = (bar.props('photos') as unknown[]).length
    await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
  })

  it('筛选生效后网格只拿到命中的照片,且空月份被丢掉', async () => {
    const w = mountPhotos()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.every(m => m.photos.length > 0)).toBe(true)
    expect(months.flatMap(m => m.photos)).toHaveLength(/* 见下方夹具说明 */ 2)
  })

  it('D20:顶栏计数跟着 EXIF 筛选减', async () => {
    const w = mountPhotos()
    const countBefore = w.findComponent(PhotosToolbar).props('count') as number
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect(w.findComponent(PhotosToolbar).props('count') as number).toBeLessThan(countBefore)
  })
})
```

**夹具要求**:时间线 store 的 `timelineGroups` 至少要有两个月份、跨两个年份,且其中一个月份在筛 `years:['2023']` 后会整月清空(用来验证「空月份被丢掉」)。断言里的具体数字按你造的夹具算准,不要照抄注释里的 `2`。资产字段至少要有 `takenAt`(决定 `date`)、`placeName`、`make`/`model`(决定 `camera`)——见 `assetToPhoto.ts:314-400`。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/__tests__/Photos.test.ts`
Expected: 四条中至少「挂着 PhotosFilterBar」FAIL。

- [ ] **Step 3: 写实现**

在 `src/views/Photos.vue` 的 `<script setup>` 中:

```ts
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
```

> **注意**:`ExifFilterValue` 是 SFC 里 `export interface` 出来的类型,`import ... , { type ... } from '*.vue'` 在 `vue-tsc` 下可用;若类型解析报错,退化成在本文件内联同形状的类型别名并注释说明,**不要**把类型挪出 SFC(那会牵动 T5)。

```ts
// P7b-T4:EXIF 筛选态。照 Vue2 PhotosTimeline.vue:116 的 activeFilters,但只保留三个
// facet 键——Vue2 那个对象上还挂着 placeKey/spotKey 两个 spot 跳转用的键,New-UI 的
// 城市/spot 跳转走独立路由页(D6),那两个键在本仓无对应物。
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })

// 照 Vue2 gridMonths 的 library 分支(:170-172):逐月过滤后丢掉空月份。
// 空月份必须在这里丢——PhotosGrid 的月份刻度尺读的是未按标签页过滤的 props.months
// (PhotosGrid.vue:88),留着空月份会在刻度尺上留下点不到的死刻度。
const gridMonths = computed(() =>
  store.months
    .map(m => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter(m => m.photos.length > 0))
```

`filteredCount` 改成(D20):

```ts
// D20(用户 2026-08-03 拍板):计数跟着 EXIF 筛选一起减,与用户所见一致。
// (Vue2 传的是 allPhotos.length,既不跟标签页也不跟筛选;New-UI 在 P1 已把它改成跟标签页
// 走的 sanctioned 偏离,这里把 EXIF 叠进同一个 computed,方向一致。)
const filteredCount = computed(() =>
  gridMonths.value.reduce((sum, m) => sum + m.photos.filter((p) => matchesTab(p, tab.value)).length, 0),
)
```

`onOpenTile` 的翻页集改用 `gridMonths`:

```ts
function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // 翻页集必须与用户在网格里看到的范围一致:先 EXIF 筛(gridMonths)再按标签页筛,
  // 用与 filteredCount 完全相同的两道谓词。
  const filtered = gridMonths.value.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}
```

模板里 `PhotosToolbar` 改成带槽位、`PhotosGrid` 改数据源:

```html
          <PhotosToolbar
            :tab="tab" :density="density" :count="filteredCount"
            @update:tab="tab = $event" @update:density="density = $event"
          >
            <template #after-tabs>
              <!-- facet 源恒取全库 allPhotos,不用 gridMonths —— 否则筛掉某个年份后,
                   该年份就从下拉里消失、再也选不回来(Vue2 的 facet 源同样是 displayMonths
                   而非 gridMonths)。 -->
              <PhotosFilterBar v-model:filter="exifFilter" :photos="store.allPhotos" />
            </template>
          </PhotosToolbar>
          <div class="photos-grid-slot">
            <PhotosGrid
              :months="gridMonths" :tab="tab" :density="density" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
            />
          </div>
```

- [ ] **Step 4: 跑测试确认它绿**

Run:
```bash
pnpm exec vitest run src/views/__tests__/Photos.test.ts src/photos/components/__tests__/PhotosFilterBar.test.ts \
  && pnpm exec vue-tsc --noEmit
```
Expected: 全 PASS;tsc exit 0。

- [ ] **Step 5: 提交**

```bash
git add src/views/Photos.vue src/views/__tests__/Photos.test.ts
git commit -m "feat(photos): P7b-T4 时间线页接 EXIF 筛选 —— gridMonths/计数/翻页集三处同源(回改二,D20)"
```

---

