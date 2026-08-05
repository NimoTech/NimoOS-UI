# Task 5 报告:跳库页 `views/PhotosPlaceAssets.vue` 接线(D19)

提交:`e9d5d5e` `feat(photos): P7b-T5 跳库页叠加年份/相机筛选(回改三,D19)`
fix round 1 提交:`5f578c9` `test(photos): P7b-T5 fix round 1 补两条回归锁 + 两条 Minor`

## 实现了什么

- `src/views/PhotosPlaceAssets.vue`:
  1. 新增 `exifFilter` 状态(`ref<ExifFilterValue>({ years: [], places: [], cameras: [] })`),形状同 T4(`views/Photos.vue`)。
  2. `PhotosFilterBar` 挂在面包屑行 `.crumb-spacer` 之后、`.crumb-count` 之前,`:photos="assets.photos.value"`,`:chip-keys="[...PLACE_CHIP_KEYS]"`(`PLACE_CHIP_KEYS = ['years','cameras'] as const`)——D19 只留年份/相机两个胶囊。
  3. 新增 `gridMonths` computed:对 `assets.photos.value` 先 `applyExifFilters`,再 `groupPhotosByMonth`,再 `.filter(m => m.photos.length > 0)` 丢空月份。`PhotosGrid` 的 `:months` 从 `assets.months.value` 改为 `gridMonths`。**没有改 `usePlaceAssets.ts`**——它的 `months` computed 原样未动。
  4. 面包屑计数 `.crumb-count` 与三态门控的空态判定(`v-else-if="assets.loaded.value && assets.photos.value.length === 0"`)**都保持读未筛选的 `assets.photos.value`**,两处各加了一行注释登记这个决定(见下方“筛到零张”一节)。
  5. `onOpen` 的翻页集从 `assets.photos.value` 改为 `gridMonths.value.flatMap(m => m.photos)`(D9 同型:灯箱只能翻到这一屏看得见的)。

- `src/views/__tests__/PhotosPlaceAssets.test.ts`:
  - 追加 `describe('P7b-T5: EXIF 筛选接线(D19)', ...)`,3 条用例(见下)。
  - 顺手拆掉了这个文件自带的第二份 `createI18n` 实例(全局约束 4 授权的动作,详见“偏离/顺手清理”一节)。

## 测试落在哪个文件、为什么

按“覆盖对象判,不按文件名判”(约束 5):先 `ls src/views/__tests__/`,`PhotosPlaceAssets.test.ts` 已存在且正是覆盖 `views/PhotosPlaceAssets.vue` 的测试文件,直接追加进去,复用了它现成的 `mountView(path)` 挂载助手 + `svc` mock 脚手架,没有新建并行文件。

## 夹具怎么造的、两个数字怎么算的

`describe('P7b-T5...')` 内部定义了局部 `placeFixtureAssets()`,在这个 describe 自己的 `beforeEach` 里覆盖 `svc.photos.listAssetsByPlace` 的默认返回值(不影响其它 describe 用的全局默认 `[asset('a1'), asset('a2')]`):

```ts
function placeFixtureAssets() {
  return [
    { ...asset('p1', '2023-06-15T10:00:00Z'), placeName: 'Tokyo', make: 'Canon', model: 'EOS R5' },
    { ...asset('p2', '2020-01-01T10:00:00Z'), placeName: 'Tokyo', make: 'Sony', model: 'A7' },
  ]
}
```

- 两张资产跨两个年份(2023 / 2020),都不是 1999。
- **地点总张数** = 2(`placeFixtureAssets()` 数组长度,即 `assets.photos.value.length`)——第 3 条用例断言 `.toContain('2')` 对应这个数。
- **筛 `years:['2023']`** → 只有 p1 的 `photoYear` 是 `'2023'`,p2 是 `'2020'` 被排除 → 命中 **1** 张——第 2 条用例的 `toHaveLength(1)` 对应这个数。
- **筛 `years:['1999']`** → 两张都不是 1999,命中 0 张。

`mountPlaceAssets()` 是本文件自建的一个薄封装(`return mountView('/photos/places/7')`)——brief 伪代码里的 `mountPlaceAssets()` 只是示意名,本文件历来的挂载助手叫 `mountView(path)`,复用它而不是另起并行脚手架。

## 筛到零张时走哪个分支、怎么验的

三态门控的 `v-else-if` 判定条件是 `assets.loaded.value && assets.photos.value.length === 0`,读的是**未筛选**的 `assets.photos.value`(恒为 2,不为 0),所以筛到 0 张时这个分支**不命中**,继续走最后的 `v-else`(渲染 `PhotosGrid`),此时 `gridMonths` 因为过滤后没有月份而是空数组,`PhotosGrid` 渲染一个空网格。

验证:第 3 条用例断言 `w.find('[data-test="place-assets-empty"]').exists()` 为 `false`(没有落入“这个地点没有照片”那个空态),同时 `place-crumb-count` 文本仍含 `'2'`(计数没有跟着筛选变小)。

## TDD 证据

**RED**(实现前,只做了测试文件改动 + 追加的 3 条新用例,尚未碰 `.vue`):

```
pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts --reporter=verbose
```
```
✓ ...23 条既有用例全部 PASS...
 × P7b-T5: EXIF 筛选接线(D19) > D19:只渲染年份与相机两个胶囊,没有位置胶囊
   → expected false to be true
 × P7b-T5: EXIF 筛选接线(D19) > 筛选生效后网格只拿到命中的照片,空月份被丢掉
   → Cannot call vm on an empty VueWrapper.
 × P7b-T5: EXIF 筛选接线(D19) > 筛到零时仍渲染网格(空)...
   → Cannot call vm on an empty VueWrapper.

 Test Files  1 failed (1)
      Tests  3 failed | 23 passed (26)
```
预期红:页面还没引入 `PhotosFilterBar`,`w.findComponent(PhotosFilterBar)` 找不到组件,`.exists()` 为 `false`;后两条依赖找到该组件再 `.vm.$emit`,因此报 “Cannot call vm on an empty VueWrapper”。同时这一步也验证了“拆掉局部 `createI18n`”这个顺手清理没有破坏既有 23 条用例。

**GREEN**(实现 `.vue` 之后):

```
pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts --reporter=verbose
```
```
 ✓ ...全部 26 条用例 PASS...
 ✓ P7b-T5: EXIF 筛选接线(D19) > D19:只渲染年份与相机两个胶囊,没有位置胶囊
 ✓ P7b-T5: EXIF 筛选接线(D19) > 筛选生效后网格只拿到命中的照片,空月份被丢掉
 ✓ P7b-T5: EXIF 筛选接线(D19) > 筛到零时仍渲染网格(空)...

 Test Files  1 passed (1)
      Tests  26 passed (26)
```
唯一的 stderr 输出是既有“failed → 失败文案 + 重试钮”用例里**故意**触发的 `console.error('[photos-places] loadPlaceAssets', ...)`(该用例本就在断言失败态文案,这是预期的业务日志,不是 `[Vue warn]`)。**全程零 `[Vue warn]`**,包括 3 条新用例。

```
pnpm exec vue-tsc --noEmit
```
无输出,exit code 0。

## 改了哪些文件

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/PhotosPlaceAssets.vue`
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/__tests__/PhotosPlaceAssets.test.ts`

## 自查

- **完整性**:brief 四点改动要点(exifFilter 状态、FilterBar 挂载位置+chipKeys、gridMonths 派生、计数/空态口径不变)与 brief 给的代码逐字一致,onOpen 翻页集同步改为 gridMonths(brief 有此要求,已落实)。
- **只动了该动的**:diff 只涉及 `PhotosPlaceAssets.vue`(script 里加 3 个 import + 3 个新声明 + onOpen 一行改动;template 里加一个组件 + 两行注释 + 一处 `:months` 绑定改动)和它的测试文件(去掉局部 i18n + 追加一个 describe 块)。没有碰 `usePlaceAssets.ts`、`PhotosFilterBar.vue`、`photosFilterUtils.ts`、`PhotosPlaces.vue`。
- **模板插入点自查修正**:brief 字面写“在 `<div class="crumb-spacer"></div>` 之后、`.crumb-count` 之前插入”——我第一遍误放到了 `crumb-spacer` **之前**(会让 FilterBar 跟着面包屑文字一起被推到左边,而不是紧贴计数出现在右侧)。写完后重新对照 brief 原文发现这个位置错误,已改成 `crumb-spacer` 之后、`crumb-count` 之前,并重跑测试(仍 26/26 绿,因为测试断言的是组件是否存在/props,不断言 DOM 顺序)。这是自查阶段自己发现并订正的,记在这里留痕。
- **测试是否验真行为**:3 条新用例分别验证了(a)`chipKeys` prop 值与位置胶囊确实不渲染、(b)`update:filter` 事件驱动网格数据变化且验证的是 `PhotosGrid` 收到的 `months` prop(不是内部状态)、(c)筛到零时空态判定分支不命中 + 计数不受筛选影响,三条都是通过公开的 props/emit/DOM 断言,不是白盒读内部变量。
- **测试输出干净**:`--reporter=verbose` 全量确认零 `[Vue warn]`;唯一 stderr 是既有用例的预期业务日志。
- **未做**:brief 里“整期收尾”一节(全量 `pnpm test` + `pnpm build` + 路线图回填)按局部测试约束(本任务的控制器指令第 6 条)明确排除在本任务范围外——“只跑本任务触及的测试文件 + vue-tsc,不要跑 pnpm test 全量,全量只在整期收尾统一跑一次”。本次没有触碰 `NimoOS-UI/docs/vue3-migration-roadmap.md`,留给整期收尾步骤处理。

## 相对简报的偏离(逐条列明)

1. **模板插入点**(见上“自查”一节):brief 字面顺序是 `crumb-spacer` → `PhotosFilterBar` → `crumb-count`,不是 `PhotosFilterBar` → `crumb-spacer` → `crumb-count`。已按 brief 字面顺序落地(自查阶段订正,非最终态偏离)。
2. **顺手清理局部 `createI18n`**:全局约束 4 明确“若 `PhotosPlaceAssets.test.ts` 现在就自带一个 `createI18n`,你正在动这个文件,授权你顺手拆掉它”——本文件确实自带了一份(`const i18n = createI18n({...})`,通过 `global: { plugins: [i18n, router] }` 传给 3 处 mount 调用),已拆除,3 处 mount 调用改为只传 `[router]`,依赖 `vitest.setup.ts` 装的全局单例。既有 23 条用例(含多处中文文案断言,如 `zh.photosPlacesLoadFailed`)全部保持通过,未改动任何断言内容。
3. **“整期收尾”一节未执行**:按控制器指令的局部测试约束,不在本任务范围内,已在“自查”一节说明。

## 问题与顾虑(round 0)

无。三条新用例 + 全部既有用例绿、`vue-tsc` 干净、`color-guard` 与 `i18n/parity` 抽查也过。本任务是本期(SP7-P7b)第 5/5 个,后续需要用户/上级会话按 brief“整期收尾”一节跑一次全量测试 + build,并回填路线图第 423 行与登记 D19/D20/F1/F2。

---

## fix round 1(评审回来后补的两条回归锁 + 两条 Minor)

评审结论:**实现层零缺陷**——`views/PhotosPlaceAssets.vue` 本轮不改逻辑。要补的是测试侧的回归锁,恰好对应我自己在 round 0 自查里发现并订正过的那处位置错误(“靠肉眼对照 brief 才发现”),以及约束 5 / D9 同型的翻页集没有测试保护。

### 必修 1 —— DOM 序回归锁(FilterBar 位置)

**问题**:round 0 的 3 条新用例只断言 `PhotosFilterBar` 存在 + `props` 正确。把 `<PhotosFilterBar>` 挪到 `.crumb-spacer` 之前(round 0 自查时我自己第一遍写错、后来对照 brief 订正的那个形态),3 条断言依旧全绿,但界面上筛选条会从右侧跳到面包屑文字旁边(`.crumb-spacer{flex:1}` 顶开的是它之后的内容)。

**补法**:在第 1 条用例(`D19:只渲染年份与相机两个胶囊,没有位置胶囊`)末尾追加:

```ts
expect(w.find('.crumb-spacer + .exif-filter').exists()).toBe(true)
expect(w.find('.exif-filter + .crumb-count').exists()).toBe(true)
```

`.exif-filter` 是 `PhotosFilterBar.vue` 根节点的 class(该组件模板 `<div ref="rootRef" class="exif-filter" ...>`),不需要在宿主页面额外加 wrapper class。中间的两行 HTML 注释节点不影响 CSS 相邻兄弟选择器判定。

**变异验证(证据)**:

1. 用 `python3` 脚本把模板里的 `<PhotosFilterBar>` 块与 `<div class="crumb-spacer">` 互换顺序(挪到 spacer 之前)。
2. 跑 `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts -t "D19:只渲染年份与相机两个胶囊" --reporter=verbose`,结果:

   ```
   × P7b-T5: EXIF 筛选接线(D19) > D19:只渲染年份与相机两个胶囊,没有位置胶囊 55ms
     → expected false to be true // Object.is equality
     ❯ src/views/__tests__/PhotosPlaceAssets.test.ts:429:61
       expect(w.find('.crumb-spacer + .exif-filter').exists()).toBe(true)
   ```
   确认转红(`.crumb-spacer + .exif-filter` 选不到节点)。
3. 用同一脚本把顺序换回来(`crumb-spacer` 在前、`PhotosFilterBar` 在后),复原为 round 0 的正确形态。之后完整跑一次 `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts --reporter=verbose` 确认 26/26 恢复绿(见下方“fix round 1 收尾证据”)。

### 必修 2 —— 灯箱翻页集回归锁(约束 5 / D9 同型)

**问题**:`onOpen` 里 `lb.openAt(photo, gridMonths.value.flatMap(...), startMs)` 这一行没有测试锁住“翻页集必须是筛选后的”这条要求。既有那条“`PhotosGrid` emit open → list 是整页 photos”的用例用的是零筛选夹具(`a1`/`a2` 同月同桶),`assets.photos.value` 与 `gridMonths.value.flatMap(...)` 在那个场景下同值同序,对这处改动**不敏感**,把 `onOpen` 改回读 `assets.photos.value` 那条用例依然会绿。

**补法**:在第 2 条用例(原“筛选生效后网格只拿到命中的照片,空月份被丢掉”,已顺带改名,见 Minor 1)末尾追加:

```ts
await w.find('.tile').trigger('click')
await flushPromises()
expect(lb.list.value.map((p) => p.id)).toEqual(['p1'])
```

筛 `years:['2023']` 后网格只剩 p1,点开它,翻页集若正确应恰好是 `['p1']`;若 `onOpen` 读的是未筛选的 `assets.photos.value`,翻页集会混入被筛掉的 p2,变成 `['p1', 'p2']`。

**变异验证(证据)**:

1. 用 `sed` 把 `PhotosPlaceAssets.vue` 里 `onOpen` 的 `lb.openAt(photo, gridMonths.value.flatMap((m) => m.photos), startMs)` 临时改回 `lb.openAt(photo, assets.photos.value, startMs)`。
2. 跑 `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts -t "灯箱翻页集也跟着收窄" --reporter=verbose`,结果:

   ```
   × P7b-T5: EXIF 筛选接线(D19) > 筛选生效后网格只拿到命中的照片(空月份门控本身在这里是恒真——理由见下),灯箱翻页集也跟着收窄 77ms
     → expected [ 'p1', 'p2' ] to deeply equal [ 'p1' ]
     ❯ src/views/__tests__/PhotosPlaceAssets.test.ts:459:44
       expect(lb.list.value.map((p) => p.id)).toEqual(['p1'])
   ```
   确认转红,且失败形态与预判一致(翻页集里多出被筛掉的 `p2`)。
3. 用 `Edit` 工具把 `onOpen` 改回 `gridMonths.value.flatMap((m) => m.photos)`,复原。`git diff -- src/views/PhotosPlaceAssets.vue` 核对过——最终落盘的这个文件相对 round 0 提交,**唯一**的逻辑差异是 `gridMonths` computed 旁新增的 Minor 1 注释块,`onOpen` 函数体与两次变异前完全一致(两次变异都已正确复原,没有残留)。

### Minor 1 —— 用例名不再承诺没验的东西

**问题**:原用例名“筛选生效后网格只拿到命中的照片,空月份被丢掉”里“空月份被丢掉”是恒真断言——`groupPhotosByMonth`(`src/photos/util/groupPhotosByMonth.ts:15-23`)的桶遇到照片才创建,永不产出空桶;本页又是先筛后分组(`applyExifFilters` 在 `groupPhotosByMonth` **之前**跑),所以 `PhotosPlaceAssets.vue` 里 `gridMonths` 那个 `.filter(m => m.photos.length > 0)` 在这条调用链上结构性地不可能剔掉任何东西。

**处理**:
- 用例名改为“筛选生效后网格只拿到命中的照片(空月份门控本身在这里是恒真——理由见下),灯箱翻页集也跟着收窄”,并在用例体开头加注释说明为什么改名、`months.every(...)` 这行仍保留验证的是什么(“命中的月份里确实有照片”,不是“空月份被丢掉”)。
- 在 `PhotosPlaceAssets.vue` 的 `gridMonths` computed 旁(`.filter` 那一行上方)补了一段注释,说明这里保留 `.filter` 纯粹是为了跟 T4(`views/Photos.vue`,那边 months 来自后端预分桶、筛选发生在桶内、空月份是真实可能出现的)保持同一套调用惯例口径,不是本页此刻需要的逻辑保护——`.filter` 本身**没有删**(brief 明文要求保留)。

### Minor 2 —— 计数断言收紧

**问题**:原断言 `expect(w.get('[data-test="place-crumb-count"]').text()).toContain('2')` 过松——`rawPlace()` 的默认 `count: 42`,如果计数被误改成读 `store.detail.count` 会渲染“42 张照片”,`.toContain('2')` 依然通过(因为 `"42"` 里含 `"2"`)。

**处理**:改成精确匹配 `expect(w.get('[data-test="place-crumb-count"]').text()).toBe('2 张照片')`——`'{n} 张照片'` 是 `zh_cn.ts:1026` 的 `photosPlacesPhotoCount` 文案模板,`n=2` 时渲染为整串 `'2 张照片'`,与本文件另一条既有用例(“照片计数 = photosPlacesPhotoCount({n: photos.length})”)的精确匹配写法一致。

### fix round 1 收尾证据(两次变异均已复原后的最终跑测)

```
pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts --reporter=verbose
```
```
✓ ...全部 26 条用例 PASS...
 ✓ P7b-T5: EXIF 筛选接线(D19) > D19:只渲染年份与相机两个胶囊,没有位置胶囊 24ms
 ✓ P7b-T5: EXIF 筛选接线(D19) > 筛选生效后网格只拿到命中的照片(空月份门控本身在这里是恒真——理由见下),灯箱翻页集也跟着收窄 79ms
 ✓ P7b-T5: EXIF 筛选接线(D19) > 筛到零时仍渲染网格(空)... 9ms

 Test Files  1 passed (1)
      Tests  26 passed (26)
```
唯一的 stderr 输出仍是既有“failed → 失败文案 + 重试钮”用例里预期的 `console.error` 业务日志,**零 `[Vue warn]`**。

```
pnpm exec vue-tsc --noEmit
```
无输出,exit code 0。

未跑全量 `pnpm test`(按控制器指令,全量留给整期收尾统一跑)。

### fix round 1 改了哪些文件

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/PhotosPlaceAssets.vue`(仅新增一段注释,`gridMonths` 旁,无逻辑变化)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/__tests__/PhotosPlaceAssets.test.ts`(3 条用例内部追加断言/改名/加注释,未新增用例数,仍是 3 条覆盖 P7b-T5 的用例、26 条总数不变)

## 问题与顾虑(round 1)

无新增顾虑。两条必修 + 两条 Minor 均已按评审原文逐条处理并做了变异验证,变异均已确认复原(`git diff` 核对过 `.vue` 文件此轮唯一的非注释性质变化为零)。

---

## 整期终审修复波(opus,整支 9 个提交终审:零 Critical,Ready to merge = With fixes)

提交:`cd21178` `fix(photos): P7b 整期终审修复波(I1/I2 必修 + M1/M4 建议带上)`

终审结论:生产代码层面没找到功能缺陷,4 项修复全部落在测试/注释侧(2 项必修 + 2 项建议带上),另外 M3/M6 各加一句说明注释(不改逻辑),M7 按终审指示原样不动。

### 必修 I1 —— 「不落到那个空态」的因果链是错的,已改口措辞

**问题**:round 0/1 的注释与用例都声称「筛到零时显示筛选后的空网格,而不是跳到『这个地点没有照片』——那句文案是误导」。但 `PhotosGrid.vue:273-276` 的空态用的正是**同两个键**(`photosNoPhotos` + `photosNoPhotosHint`),与 `place-assets-empty` 分支逐字相同——门控走的分支不同,用户看到的文案完全一样,不存在「避免了误导」这回事。

**处理**(只改措辞,门控逻辑一行未动,没有新增「无匹配结果」文案):

- `views/PhotosPlaceAssets.vue` 的 `.crumb-count` 旁那段注释,改为陈述事实:读未筛选数据是为了让计数表达地点总量;筛到零时门控走 `v-else`(`PhotosGrid` 自己渲染空网格),不会命中 `place-assets-empty` 分支——但那个分支的空态文案与 `PhotosGrid` 自己的空态逐字相同,用户看到的东西不会因为走哪条分支而不同。若要真正的「没有匹配的筛选结果」文案,是 Vue2 也没有的新功能,应挂债务,本期不做。
- `place-assets-empty` 那个 `v-else-if` 旁的注释同款改口。
- 测试用例名从「筛到零时仍渲染网格(空),不落到『这个地点没有照片』的空态」改为「筛到零时三态门控走 v-else(不经过 `place-assets-empty` 分支)」,并在用例体开头加注释说明:这条断言锁的是门控走向这个逻辑不变量,不是用户可见差异;`place-assets-empty` 不出现这条断言本身**保留**(它仍有意义——钉住「空态判定必须读未筛选数据、不能因筛选结果为空就误判整个地点没有资产」这件事)。

### 必修 I2 —— 跳库页 FilterBar facet 源不变量补齐回归锁

**问题**:时间线页(`Photos.integration.test.ts`)已有专用回归锁「FilterBar 的 facet 源是全库 `allPhotos`,不随已生效的筛选收窄」,跳库页的同一条不变量(`:photos="assets.photos.value"` 必须恒未筛选,否则会出现「筛掉一个年份后该年份从下拉里消失、再也选不回来」这个 bug)此前一条断言都没有。

**补法**(与时间线页那条锁同型):在 `PhotosPlaceAssets.test.ts` 的 `P7b-T5` describe 里新增一条用例`FilterBar 的 facet 源恒是未筛选的 assets.photos,不随已生效的筛选收窄`:

```ts
const bar = w.findComponent(PhotosFilterBar)
const before = (bar.props('photos') as unknown[]).length
expect(before).toBe(2) // 夹具算准:placeFixtureAssets() 两张。
await bar.vm.$emit('update:filter', { years: ['2023'], places: [], cameras: [] })
await w.vm.$nextTick()
expect((w.findComponent(PhotosFilterBar).props('photos') as unknown[]).length).toBe(before)
```

**变异验证(证据)**:

1. 用 `sed` 把模板里 `PhotosFilterBar` 的 `:photos="assets.photos.value"` 临时改成 `:photos="gridMonths.flatMap(m => m.photos)"`。
2. 跑 `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts -t "facet 源恒是未筛选" --reporter=verbose`,结果:
   ```
   FAIL ... FilterBar 的 facet 源恒是未筛选的 assets.photos,不随已生效的筛选收窄
   AssertionError: expected 1 to be 2
   ```
   确认转红(facet 源跟着筛选收窄成 1)。
3. 用 `sed` 改回 `:photos="assets.photos.value"`,复原。之后完整跑一次两文件合并的 verbose 测试确认恢复绿(见下方“收尾证据”)。

### 建议带上 M1 —— gridMonths 改为显式投影,D19 在数据层自证

**问题**:`applyExifFilters(assets.photos.value, exifFilter.value)` 把**整个** `exifFilter`(含 `places`)喂给谓词,Vue2 `PhotosTimeline.vue:167` 是显式投影 `{ years, cameras }`。今天 `exifFilter.places` 恒空(D19 只渲染年份/相机两个胶囊,UI 上没有能写入 `places` 的入口),两种写法结果等价——但这正是 T2 挂账的「幽灵筛选」唯一可能落地的地方:一旦将来有代码(深链/store)往 `exifFilter.places` 塞值,喂整个对象会静默按位置筛出结果,UI 上既看不到这个胶囊也清不掉。

**处理**:`PhotosPlaceAssets.vue` 的 `gridMonths` computed 里,`applyExifFilters` 的第二个参数从 `exifFilter.value` 改为显式对象字面量:

```ts
const gridMonths = computed(() =>
  groupPhotosByMonth(applyExifFilters(assets.photos.value, {
    years: exifFilter.value.years,
    cameras: exifFilter.value.cameras,
  })).filter((m) => m.photos.length > 0))
```

旁边加了终审要求的那句注释(「显式投影,对齐 Vue2 `PhotosTimeline.vue:167`;D19 由此在数据层自证,不只靠 UI 不渲染位置胶囊」的等价表述,含 T2 幽灵筛选的具体后果)。

**补的断言**:新增用例 `M1:exifFilter.places 即便被塞值也不生效(D19 数据层自证,不只靠 UI 不渲染位置胶囊)`——emit 一个 `places: ['某个不存在的地名']`(与两张夹具资产的 `place: 'Tokyo'` 必然不匹配)的 `update:filter`,断言网格结果仍是未受影响的 2 张(若 `places` 被读取生效,理应被筛成 0 张)。

**变异验证(证据)**:

1. 用 Python 脚本把 `gridMonths` 的第二参临时改回 `exifFilter.value`(整个对象,含 `places`)。
2. 跑 `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts -t "M1:exifFilter.places" --reporter=verbose`,结果:
   ```
   FAIL ... M1:exifFilter.places 即便被塞值也不生效...
   AssertionError: expected [] to have a length of 2 but got +0
   ```
   确认转红(`places` 生效后网格被筛成 0 张),失败形态与预判一致。
3. 用 `Edit` 工具改回显式投影写法,复原。

### 建议带上 M4 —— PhotosFilterBar.test.ts 补 unmount,摘掉 document 监听

**问题**:`afterEach` 只做 `document.body.innerHTML = ''`,而 `PhotosFilterBar.vue` 的点外部关弹层监听是挂在 `document` 上的(`watch(openPop, ...)` 里的 `addEventListener('mousedown', ...)`),清 `body` 摘不掉它——前面用例遗留的 `mousedown` 监听在同文件后续用例里仍然存活。

**处理**:`mountBar()` 改为把每次产出的 wrapper 推进一个模块级数组 `wrappers`,`afterEach` 里对数组中的每个 wrapper 调用 `.unmount()`(真正触发 `onBeforeUnmount` 摘监听),再清空数组和 `document.body.innerHTML`。已有一条用例(「卸载后不再残留 document 监听」)会自己提前 `w.unmount()` 来断言 `removeEventListener` 被调用——`afterEach` 对同一个 wrapper 再 `unmount()` 一次经验证是安全空操作(Vue 3 对已卸载的 app 直接早退,不抛错、`removeEventListener` 不会被重复触发到断言失败),已在全量跑该文件时确认 18/18 全绿,无异常。

### M3 / M6(仅加注释,不改逻辑)

- **M3**(hover 那条测试比读起来弱):在 `.exif-funnel.on 的 hover 背景不被基类 .exif-funnel:hover 顶掉` 用例体开头加了一句说明——断言只验证「赢家规则的 selector 带 `:hover`/`on`、value 是期望 token」,没有直接对照基类规则算一遍 specificity 来钉出「赢在书写顺序」这个更精确的因果链,但足以在基类顶掉变体时转红。
- **M6**(挂载即展开当前不可达):在 `挂载时已有筛选值 → 自动展开...` 用例体开头加了一句说明——`expanded` 的初始值本身就同步取自 `anyActive.value`(组件「偏离登记 5」注释已记录),`onMounted` 里 `if (anyActive.value) expand()` 这条分支在「挂载时已带筛选值」场景下不可能产出新状态(props 在 ref 初始化和 onMounted 之间不会变),真正有意义的是它重排 450ms 溢出定时器这个副作用,测试里 `vi.advanceTimersByTime(450)` 断言的正是这个副作用。
- **M7**:按终审指示原样不动(该项被明确标注「i18n 键位置与 mountToolbar 只用了一次,不用动」),未触碰 `PhotosToolbar.test.ts` 或 `PhotosToolbar.vue`。

### 收尾证据(两次变异均已复原后)

```
pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts src/photos/components/__tests__/PhotosFilterBar.test.ts --reporter=verbose
```
```
 ✓ ...PhotosFilterBar.test.ts 全部 18 条用例 PASS...
 ✓ ...PhotosPlaceAssets.test.ts 全部 28 条用例 PASS...

 Test Files  2 passed (2)
      Tests  46 passed (46)
```
唯一 stderr 输出仍是既有「failed → 失败文案 + 重试钮」用例里预期的 `console.error` 业务日志,**零 `[Vue warn]`**。

```
pnpm exec vue-tsc --noEmit
```
无输出,exit code 0。

未跑全量 `pnpm test`(按控制器指令,全量由控制器统一再跑一次)。

### 改了哪些文件(本轮)

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/PhotosPlaceAssets.vue`(I1 两处注释改口 + M1 显式投影 + 对应注释)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/__tests__/PhotosPlaceAssets.test.ts`(I1 用例改名/加注释 + I2 新增一条用例 + M1 新增一条用例,26→28 条)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/components/__tests__/PhotosFilterBar.test.ts`(M4 afterEach 补 unmount + M3/M6 各加一句注释,用例数不变,仍 18 条)

## 问题与顾虑(整期终审修复波)

无。四项(2 必修 + 2 建议带上)均已落地并做了要求的变异验证,证据齐全;M3/M6 按「仅注释」的要求处理,未碰逻辑;M7、`usePlaceAssets.ts`、`views/Photos.vue`、`PhotosToolbar.vue`、P7a 两个基元、`cssCascade.ts` 均未触碰,与「明确不要做的」逐条核对一致。
