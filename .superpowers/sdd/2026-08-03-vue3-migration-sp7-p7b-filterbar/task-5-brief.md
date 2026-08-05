### Task 5: 跳库页 `views/PhotosPlaceAssets.vue` 接线(D19)

**Files:**
- Modify: `src/views/PhotosPlaceAssets.vue`
- Test: `src/views/__tests__/PhotosPlaceAssets.test.ts`(已存在,追加 3 条)

**Interfaces:**
- Consumes: T1 的 `applyExifFilters`;T2 的 `PhotosFilterBar` + `ExifFilterValue`(以及 `chipKeys` prop)。
- Produces: 无下游。本任务是本期最后一个,完成即整期收尾。

**改动要点(照 Vue2 `PhotosTimeline.vue:167`)**:

1. 新增 `exifFilter` 状态(同 T4 形状)。
2. FilterBar 挂在面包屑那一行的右侧(计数 `.crumb-count` 之前),`:chip-keys="['years', 'cameras']"`、`:photos="assets.photos.value"`。**位置说明**:本页没有 `PhotosToolbar`,面包屑行是这个页面唯一的工具行,Vue2 对应屏(时间线 + placeKey)里筛选条也在照片网格正上方一行,信息层级一致。
3. 网格数据源从 `assets.months.value` 改成筛选后的月份分组:先对 `assets.photos.value` 做 `applyExifFilters`,再走 `groupPhotosByMonth`,再丢空月份。**不要**改 `usePlaceAssets`——它是 P6b 的组件,`months` 那个 computed 保持原样(禁无关重构),本页自己再算一份筛选后的分组。
4. 面包屑计数 `.crumb-count` 与三态门控的「空」判定:**保持读未筛选的 `assets.photos.value.length`**——那是「这个地点一共多少张」,不是「筛完剩多少张」;筛到零时页面应该显示的是筛选后的空网格,而不是跳到「这个地点没有照片」的空态(那句文案会误导)。这一点要在代码里注释登记。

- [ ] **Step 1: 写失败的测试**

在 `src/views/__tests__/PhotosPlaceAssets.test.ts` 追加:

```ts
describe('P7b-T5: EXIF 筛选接线(D19)', () => {
  it('D19:只渲染年份与相机两个胶囊,没有位置胶囊', async () => {
    const w = await mountPlaceAssets() // 用已有助手,需已 resolve 出照片
    const bar = w.findComponent(PhotosFilterBar)
    expect(bar.exists()).toBe(true)
    expect(bar.props('chipKeys')).toEqual(['years', 'cameras'])
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
  })

  it('筛选生效后网格只拿到命中的照片,空月份被丢掉', async () => {
    const w = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['2023'], places: [], cameras: [] })
    await w.vm.$nextTick()
    const months = w.findComponent(PhotosGrid).props('months') as Array<{ photos: unknown[] }>
    expect(months.every(m => m.photos.length > 0)).toBe(true)
    expect(months.flatMap(m => m.photos)).toHaveLength(/* 按夹具算准 */ 1)
  })

  it('筛到零时仍渲染网格(空),不落到「这个地点没有照片」的空态;面包屑计数仍是地点总数', async () => {
    const w = await mountPlaceAssets()
    await w.findComponent(PhotosFilterBar).vm.$emit(
      'update:filter', { years: ['1999'], places: [], cameras: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="place-assets-empty"]').exists()).toBe(false)
    expect(w.get('[data-test="place-crumb-count"]').text()).toContain(/* 地点总张数 */ '2')
  })
})
```

**夹具要求**:`listAssetsByPlace` 的 mock 至少返回两张跨两个年份的资产,这样筛 `years:['2023']` 剩一张、筛 `years:['1999']` 剩零张。

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts`
Expected: 三条全 FAIL(找不到 `PhotosFilterBar`)。

- [ ] **Step 3: 写实现**

`<script setup>` 增加:

```ts
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import { groupPhotosByMonth } from '../photos/util/groupPhotosByMonth'
import { ref } from 'vue' // 若顶部 import 里还没有 ref,并入既有那一行

// ── P7b-T5:EXIF 筛选(D19)────────────────────────────────────────────────────
// 对应 Vue2 PhotosTimeline.vue:167 —— spot 分支把 placeAssets 作为基础集,在其上叠加
// FilterBar 的 years/cameras 两个维度。位置维度按 D19 不出现:Vue2 那条筛选栏是时间线与
// spot 跳转共用的同一条,但 spot 分支明确只传 years/cameras、把 places 丢掉(注释自陈
// 「城市已框定,再套位置文本会误杀」)——在 New-UI 这个独立页面上照搬,就是摆一个点了
// 没反应的死胶囊。
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })
const PLACE_CHIP_KEYS = ['years', 'cameras'] as const

// 不改 usePlaceAssets 的 months(那是 P6b 的组件,禁无关重构)——本页自己再算一份筛选后
// 的月份分组,并丢掉空月份(同 T4 的理由:月份刻度尺读的是未按标签页过滤的 months)。
const gridMonths = computed(() =>
  groupPhotosByMonth(applyExifFilters(assets.photos.value, exifFilter.value))
    .filter(m => m.photos.length > 0))
```

模板:面包屑行里,在 `<div class="crumb-spacer"></div>` 之后、`.crumb-count` 之前插入

```html
          <PhotosFilterBar
            v-model:filter="exifFilter" :photos="assets.photos.value"
            :chip-keys="[...PLACE_CHIP_KEYS]"
          />
```

并把网格数据源改掉:

```html
          <PhotosGrid
            :months="gridMonths"
            :selectable="false"
            @open="onOpen"
          />
```

**保持不动的两处(注释登记)**:在 `.crumb-count` 与三态门控的空态判定处各加一行注释——

```html
          <!-- 计数与下方空态判定都读**未筛选**的 assets.photos:这是「这个地点一共多少张」,
               不是「筛完剩多少张」。筛到零时应该显示筛选后的空网格,而不是跳到「这个地点
               没有照片」——那句文案在有照片、只是被筛掉的情况下是误导。 -->
```

灯箱翻页集 `onOpen` 的处理:改成传筛选后的集合,与用户所见一致(D9 同型):

```ts
function onOpen(photo: Photo, _list: undefined, startMs: number): void {
  // 翻页集跟着筛选走(D9 同型要求:灯箱能翻到的必须是这一屏看得见的)。
  lb.openAt(photo, gridMonths.value.flatMap(m => m.photos), startMs)
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run:
```bash
pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts \
  && pnpm exec vue-tsc --noEmit
```
Expected: 全 PASS;tsc exit 0。

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosPlaceAssets.vue src/views/__tests__/PhotosPlaceAssets.test.ts
git commit -m "feat(photos): P7b-T5 跳库页叠加年份/相机筛选(回改三,D19)"
```

---

## 整期收尾(五个任务全绿之后)

- [ ] **全量测试 + 三道门**(用户明确要求:部署/验收前跑一次全量)

```bash
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI
pnpm test                      # vitest run,全量
pnpm exec vue-tsc --noEmit     # 类型
pnpm build                     # vue-tsc + vite build
```
基线:P7a 收尾时是 **315 文件 / 3686 passed**;本期新增两个测试文件 + 三个文件追加用例,通过数只增不减,**零新增失败**。

- [ ] **验收**:dev server 已在 `:5277` 运行(pid 271565,`.sp7` 工作区,Vite 会热更,通常不需要重启;若模块图没跟上就 `kill` 后 `pnpm dev --host --port 5277` 重起)。**不跑 `./scripts/deploy.sh`**。验收地址 `http://<设备IP>:5277/app/#/photos`。

- [ ] **验收清单**(交给用户逐条点)
  1. 时间线页标签页右边出现一个漏斗按钮,默认收起、看不到胶囊。
  2. 点漏斗 → 三个胶囊(年份 / 位置 / 相机)从左往右依次滑出,有轻微错峰。
  3. 点「年份」→ 弹层列出库里真实存在的年份,从新到旧;顶部搜索框能过滤选项。
  4. 勾一个年份 → **网格不动**;点「提交」→ 网格才收窄,胶囊标签变成年份数字,漏斗右上角出现数字角标。
  5. 顶栏「N 项」计数跟着变小(D20)。
  6. 胶囊上的 × 清掉这一个维度;「清除全部」一次清掉全部并让角标消失。
  7. 重开弹层:上次「取消」时勾的那些**不该**还留着勾。
  8. 点页面别处(弹层外)→ 弹层关闭,已提交的筛选不受影响。
  9. 有筛选生效时收起再展开漏斗,筛选值仍在;刷新页面则回到无筛选(不做持久化,与 Vue2 一致)。
  10. 筛选生效时点开一张照片,灯箱左右翻页**只在筛出来的这些照片里**转,翻不到被筛掉的。
  11. 地图 → 某个城市 →「在库中查看」进跳库页:面包屑那一行右侧有漏斗,点开**只有年份和相机两个胶囊,没有位置**(D19)。
  12. 在跳库页筛一个年份 → 网格收窄;面包屑右侧的「N 张照片」**保持这个地点的总数不变**(它是地点总量,不是筛后数量)。
  13. 跳库页筛到一张不剩时,显示的是空网格,**不是**「这个地点还没有照片」那个空态。
  14. 深浅色主题各看一遍:漏斗按钮激活态、角标、胶囊选中态、弹层底色都不刺眼、没有白底白字。

- [ ] **回填台账与路线图**
  - 台账目录:`/home/nimo/NimoTech/.sp7/NimoOS-New-UI/.superpowers/sdd/2026-08-03-vue3-migration-sp7-p7b-filterbar/`(**一律落 `.sp7`**,P5 台账事故的教训;`.superpowers` 在 gitignore 里,git 救不回)。
  - 路线图 `NimoOS-UI/docs/vue3-migration-roadmap.md` 第 423 行那条 `- [ ] P7 …` 更新为 P7b 完成,并登记 D19/D20/F1/F2 四条。

---

## 自查(写完计划后按 writing-plans 的清单跑了一遍)

**1. spec 覆盖**:spec §7d 的 P7b 行列了四项交付——`photosFilterUtils.ts` + 58 行测试移植(T1)、`PhotosFilterBar.vue`(T2)、三处回改(T3 `PhotosToolbar` / T4 `views/Photos.vue` / T5 `views/PhotosPlaceAssets.vue`)。逐项有任务。D14 基元复用在 T2;D17 去 `archiveIds` 在 T1;D18「不抽 `usePlaceCoverPicker`、`PhotosPlaces.vue` 一行不动」——本计划全程未列该文件,符合。

**2. 占位符扫描**:无 TBD / 「类似 Task N」/ 无代码的代码步骤。两处 `/* 按夹具算准 */` 是**刻意**留给实现者的——那两个数字取决于他造的夹具,写死反而会诱导他照抄错数,已在同段落用「夹具要求」明确说清约束。

**3. 类型一致性**:`ExifFilters`(util 侧,三个键都可选)与 `ExifFilterValue`(组件侧,三个键都必填)是**两个不同类型**,不是笔误——util 要能吃部分筛选对象(`{ years: [...] }`),组件的 v-model 值必须三键齐全才能安全展开。`applyExifFilters` 形参标的是 `ExifFilters`,`ExifFilterValue` 结构上可赋值给它,T4/T5 直接传不需要转换。`FilterablePhoto` 与 `Photo`(`assetToPhoto.ts:267`)结构兼容(`date: string` / `place: string | null` / `camera: string | null`),`applyExifFilters<T>` 泛型保证进 `Photo[]` 出 `Photo[]`。`chipKeys` 在 T2 是 `ChipKey[]`,T5 传的 `PLACE_CHIP_KEYS` 是 `as const` 元组,故用 `[...PLACE_CHIP_KEYS]` 展开成可变数组再传。
