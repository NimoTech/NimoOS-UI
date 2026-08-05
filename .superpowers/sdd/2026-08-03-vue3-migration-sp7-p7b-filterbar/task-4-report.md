# Task 4 报告:时间线页 `views/Photos.vue` 接线(SP7-P7b)

## 实现了什么

`src/views/Photos.vue`:

1. 新增 `exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })`。
2. 新增 `gridMonths` computed:对 `store.months` 每月 `applyExifFilters`,丢掉空月份(照 Vue2 `gridMonths` library 分支)。
3. `PhotosGrid` 的 `:months` 从 `store.months` 改为 `gridMonths`。
4. `filteredCount`(D20)改为先 `gridMonths` 再按 `matchesTab` 过滤。
5. `onOpenTile` 的翻页集改用 `gridMonths.value.flatMap(...)`,不再直接读 `store.months`。
6. `PhotosFilterBar` 挂进 `PhotosToolbar` 的 `#after-tabs` 具名插槽,`v-model:filter="exifFilter"`,`:photos="store.allPhotos"`(facet 源恒取全库,不受 `gridMonths` 收窄)。

三处同源逻辑(网格数据源 / 顶栏计数 / 灯箱翻页集)现在全部经过同一个 `gridMonths` computed,行为一致。

## 测试

新建 `src/views/__tests__/Photos.test.ts`,四条用例(见下方"落在哪个文件"说明)全部覆盖简报要求的行为。

命令:
```bash
pnpm exec vitest run src/views/__tests__/Photos.test.ts --reporter=verbose
```

GREEN 输出:
```
✓ P7b-T4: EXIF 筛选接线 > 工具栏 after-tabs 槽位里挂着 PhotosFilterBar 70ms
✓ P7b-T4: EXIF 筛选接线 > FilterBar 的 facet 源是全库 allPhotos,不随已生效的筛选收窄 39ms
✓ P7b-T4: EXIF 筛选接线 > 筛选生效后网格只拿到命中的照片,且空月份被丢掉 21ms
✓ P7b-T4: EXIF 筛选接线 > D20:顶栏计数跟着 EXIF 筛选减 23ms

Test Files  1 passed (1)
     Tests  4 passed (4)
```
无一条 `[Vue warn]`(与 RED 阶段一致,已确认零告警——见下方 TDD 证据)。

联跑(Step 4 指定的组合命令 + tsc):
```bash
pnpm exec vitest run src/views/__tests__/Photos.test.ts src/photos/components/__tests__/PhotosFilterBar.test.ts --reporter=verbose
# Test Files  2 passed (2) / Tests  22 passed (22),无 [Vue warn]

pnpm exec vue-tsc --noEmit
# EXIT: 0
```

另外为确认没有破坏既有相册页测试(该文件此前已被三个测试文件覆盖:integration/lightbox/route),额外跑了一遍作回归确认(非本任务局部测试范围内的强制项,但既然改了这个共享文件就顺手核实):
```bash
pnpm exec vitest run src/views/__tests__/Photos.integration.test.ts src/views/__tests__/Photos.lightbox.test.ts src/views/__tests__/Photos.route.test.ts --reporter=verbose
# Test Files  3 passed (3) / Tests  23 passed (23)
```
这三个文件里仍有大量 `[Vue warn]`("already been registered"),但这是**既有的、我之前就验证过的预存在问题**(这几个文件本来就各自 `createI18n()` 又叠加全局单例,不是本次改动引入——改动前单独跑 `Photos.integration.test.ts` 就已产生 112 条同款警告),不在本任务范围内,未动它们。

## TDD 证据

**RED**(实现前):
```bash
pnpm exec vitest run src/views/__tests__/Photos.test.ts --reporter=verbose
```
四条全 FAIL:
- `工具栏 after-tabs 槽位里挂着 PhotosFilterBar` → `expected false to be true`(组件还没挂上,预期失败)
- `FilterBar 的 facet 源是全库…` → `Cannot call props on an empty VueWrapper`(找不到该组件,预期失败)
- `筛选生效后网格只拿到命中的照片…` / `D20:顶栏计数跟着 EXIF 筛选减` → `Cannot call vm on an empty VueWrapper`(同上)

零 `[Vue warn]`(测试脚手架从一开始就没有另建 `createI18n`,详见下方处置①的补充说明)。四个失败均直接对应"组件未接线"这一预期缺口,不是脚手架配置错误导致的假红——已核实。

**GREEN**(实现后):见上方"测试"一节的输出,4/4 PASS,零 `[Vue warn]`。

## 改了哪些文件

- `src/views/Photos.vue`(修改,+36/-4)
- `src/views/__tests__/Photos.test.ts`(新建)

## 测试落在哪个文件、为什么(处置①)

> **⚠ 订正(fix round 1)**:下面这版判据是**误读**,已被评审指出并订正。原判据"目录下没有
> `Photos.test.ts` 这个文件名,所以新建"是**按文件名匹配**,而处置①问的是**按覆盖对象匹配**——
> 也就是"有没有已经 mount `views/Photos.vue` 并驱动其行为的测试文件",不是"有没有同名文件"。
> 事实上 `Photos.integration.test.ts:51`(`import Photos from '../Photos.vue'`)+
> `:67-74`(等价的 `mountPhotos()` 脚手架)、`Photos.lightbox.test.ts:45`、
> `Photos.route.test.ts:25` **三个文件都覆盖同一个组件**,应当追加进其中之一(评审指定
> `Photos.integration.test.ts`,因为它是三者里唯一带 store 播种 + 完整 svc mock 的)。
> 已在 fix round 1 里改正:删除 `src/views/__tests__/Photos.test.ts`,把
> `describe('P7b-T4: ...')` 整块并入 `Photos.integration.test.ts`。正确结论见下方
> 「fix round 1」一节,本节以下内容保留作为"当时判断过程"的记录,不代表最终状态。
>
> ~~`ls src/views/__tests__/` 确认目录下已有 ... 十四个文件,**没有 `Photos.test.ts`**。
> 简报点名的目标文件本身不存在,按简报"若不存在则新建"新建了 `src/views/__tests__/Photos.test.ts`。~~
>
> ~~Mount 脚手架照同目录 `Photos.integration.test.ts` 的写法(...),但没有照抄它的
> `createI18n()` 那一段——见下一节。~~

## 夹具(处置②)

`seedTimeline()` 往 `store.timelineGroups` 塞两个月份、跨两个年份:

- `2023-06`:3 张(`a1/a2/a3`,`takenAt` 分别为 2023-06-01/15/20,`placeName='Paris, France'`,`make='Canon'`,`model='EOS R5'`)
- `2024-01`:2 张(`b1/b2`,`takenAt` 分别为 2024-01-05/20,`placeName='Tokyo, Japan'`,`make='Sony'`,`model='A7'`)

全部走默认 `mimeType='image/jpeg'`(非视频)、无 `hasOcr`,均命中默认 tab `'photo'`。

**算数**:
- `store.allPhotos.length = 5`(3+2)—— facet 源测试断言 `before === 5`,筛选后仍是 `5`(facet 不随筛选收窄)。
- 筛 `years:['2023']` 后:`photoYear` 由 `assetToPhoto` 生成的 `date`(`toLocaleDateString('en', {...})` 本地化串,如 "June 1, 2023")经 `new Date(...).getFullYear()` 算出——`2023-06` 三张全部年份为 2023,全部命中;`2024-01` 两张年份为 2024,全部不命中 → 整月清空、被 `gridMonths` 的 `.filter(m => m.photos.length > 0)` 丢弃。
  - `gridMonths` 剩 **1 个月份**(`2023-06`),`months.flatMap(m => m.photos)` 长度 = **3**(简报注释里的占位数字 `2` 未采用,按本夹具实际算出 `3`)。
- `filteredCount`:筛选前 = 5(3+2 都命中 tab='photo'),筛选后 = 3(< 5,满足 D20 断言 `toBeLessThan`)。

## `ExifFilterValue` 类型导入(处置③)

**未退化**。`import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'` 按简报原样写入,`pnpm exec vue-tsc --noEmit` 退出码 0,无任何类型错误。未使用内联类型别名兜底方案。

## 自查发现

- 模板改动与简报给的代码片段逐字一致(`PhotosToolbar` 加 `#after-tabs` 插槽、`PhotosGrid` 数据源改 `gridMonths`),未做任何简报之外的重构。
- `git diff --stat` 确认只改了 `src/views/Photos.vue` 一个已有文件 + 新建一个测试文件,没有牵动 `PhotosFilterBar.vue` / `PhotosToolbar.vue` / `photosFilterUtils.ts`(T1-T3 的既有交付)。
- 未新增任何颜色字面量(本任务未触碰任何 `<style>` 块,`git diff` 里也没有样式改动)。
- 未新增 i18n 文案键。
- 测试文件严格遵守"不另建 `createI18n` 实例"的约束——`mountPhotos()` 里 `global.plugins` 只传 `[router]`,依赖 `vitest.setup.ts` 已装好的全局 i18n 单例,RED/GREEN 两阶段全程零 `[Vue warn]`。

## 相对简报的偏离

无实质偏离。唯一的主动决定是"控制器处置①②③之外"的一点:测试脚手架没有照抄 `Photos.integration.test.ts` 里的 `createI18n()` 那段代码(那是该文件的既有写法,产生大量 `[Vue warn]`),而是按 Global Constraints 第 4 条要求改为依赖 `vitest.setup.ts` 的全局单例——这是遵守而非偏离全局约束,在报告里显著记录以便控制器知晓"为什么新文件的 mount 脚手架和隔壁文件长得不太一样"。

## 问题与顾虑(原报告,round 0)

无。四条测试全部验证真实行为(挂载位置、facet 源独立性、空月份丢弃、计数联动),非空验证或假通过。全量测试未跑(遵照任务指示"本轮只跑触及的测试文件 + tsc,不跑 pnpm test 全量"),留给整期收尾统一跑。

---

# Fix round 1(评审回来后)

`views/Photos.vue` **零改动**——评审确认实现层无缺陷(facet 源、三处同源、空月份丢弃因果注释均属实,夹具数字手算复核自洽)。本轮全部是测试侧改动。`git diff src/views/Photos.vue` 为空,已核实。

## 必修 1:测试文件并入 `Photos.integration.test.ts`,删除并行文件

**判据订正**:处置①要求的是"追加进已覆盖同一组件的既有测试文件",判断口径是**覆盖对象**(是否 `mount` 了 `views/Photos.vue`),不是**文件名**是否叫 `Photos.test.ts`。原报告用文件名匹配得出"没有 `Photos.test.ts` 所以新建"的结论,是误读——目录里 `Photos.integration.test.ts` / `Photos.lightbox.test.ts` / `Photos.route.test.ts` 三个文件全部 mount 同一个 `Photos.vue`,理应追加进其中之一。已按评审指定并入 `Photos.integration.test.ts`(三者里唯一带 store 播种 + 完整 svc mock 的)。

**具体搬迁**:
1. 删除 `src/views/__tests__/Photos.test.ts`。
2. `describe('P7b-T4: EXIF 筛选接线', ...)` 整块(含新增的必修 2/3 两条,见下)追加到 `Photos.integration.test.ts` 文件末尾,`import PhotosFilterBar / PhotosGrid / PhotosToolbar` 三个组件、复用该文件已有的 `useTimelineStore` import 与 `mountPhotos()`,**没有另起一套 mock/脚手架**。
3. `Photos.integration.test.ts` 的 `svc` hoisted mock 本来就已经包含我新用例需要的全部 service 方法(`getTimeline/getStatus/listTasks/deleteAsset/recordView/listFavoriteIds/listAlbums/batchAddToAlbum` 等)——**零缺口**,不用补。唯一补的是 `beforeEach` 里追加了 `svc.photos.recordView.mockClear()` 与 `svc.photos.listFavoriteIds.mockClear()` 两行(该文件原先声明了这两个 mock 但没在 `beforeEach` 里复位;新增的灯箱回归用例会触发 `openAt` 走到这两个调用,补上复位避免跨用例调用计数污染——这是"最小补齐",不是另起脚手架)。
4. `asset()` 助手函数从只支持 `mimeType` 扩展为同时支持 `takenAt/placeName/make/model`(全部可选,不影响原有 `asset('a')` / `asset('b', { mimeType: 'video/mp4' })` 调用点),并新增 `seedTimeline(store)` 辅助函数(内容与原 round 0 报告里的夹具相同,原样保留)。

**拆 `createI18n`(约束 8,授权顺手做)**:
- 删掉 `Photos.integration.test.ts:13`(`import { createI18n } from 'vue-i18n'`)、`:15`(`import zh from '../../i18n/zh_cn'`)、原 `:58` 的 `const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })`。
- `mountPhotos()` 里 `global: { plugins: [i18n, router] }` 改为 `global: { plugins: [router] }`,依赖 `vitest.setup.ts` 已装好的全局单例(其 `initialLocale()` 在 jsdom 下因 `localStorage.getItem('lang')` 为空回落 `zh_cn`)。
- **中文断言验证结论**:该文件里断言中文文案的用例——`顶部标题区显示 photosCountSummary` 断言 `'1 张照片'`/`'1 个视频'`、`tab 切换` 断言按钮文本 `'视频'`/`'全部'`——拆掉 `createI18n` 后**原样通过,未改一处断言**。证据见下方"验证"一节的 verbose 输出(22/22 全绿,含这两条)。硬要求①②均满足,未触发 BLOCKED 分支。

## 必修 2:补灯箱翻页集回归锁 + 变异验证

新增用例`筛选生效后点开一张图 → 灯箱翻页集同样只含命中的照片(与网格同源)`:播种两个月份 → emit `update:filter {years:['2023']}` → 点击网格里第一张 tile(触发 `onOpenTile`)→ 断言 `useLightbox()` 的 `lb.list.value` 长度为 3,且不含 `b1`/`b2`(2024-01 那两张)。复用文件顶部已有的 `const lb = useLightbox()` 单例,以及既有的 `lb.__resetForTest()` beforeEach/afterEach 复位(评审 Minor 4 指出的"并入即自然消掉"这条,已生效——不需要我再手写复位)。

**变异验证**(临时改错 → 确认变红 → 恢复):
```bash
# 1. 临时把 Photos.vue:onOpenTile 的 gridMonths.value 改回 store.months
# 2. 跑单条用例
pnpm exec vitest run src/views/__tests__/Photos.integration.test.ts --reporter=verbose \
  -t "筛选生效后点开一张图"
```
输出:
```
× P7b-T4: EXIF 筛选接线 > 筛选生效后点开一张图 → 灯箱翻页集同样只含命中的照片(与网格同源) 125ms
  → expected [ …(5) ] to have a length of 3 but got 5
```
即改回 `store.months` 后翻页集混入了被筛掉的 2024-01 两张(5 = 3+2,全库未筛),用例正确变红。随即 `Edit` 把该行改回 `gridMonths.value`,`git diff src/views/Photos.vue` 确认为空(已恢复到评审通过的版本),重新跑该用例转绿(见下方"验证"一节的整体输出)。

## 必修 3:补 cameras 维度贯通

新增用例 `cameras 维度贯通:按 make·model 拆分匹配,命中月份保留、不命中月份被丢掉`:emit `update:filter { years: [], places: [], cameras: ['Sony'] }`(夹具里 2024-01 是 `Sony · A7`,2023-06 是 `Canon · EOS R5`),断言 `PhotosGrid` 拿到的 `months` 长度为 1、且该月的照片 id 集合恰为 `['b1', 'b2']`——验证 `camera` 字段 `split('·')[0].trim()` 这条拆分匹配规则在本页确实生效,不只是在 `PhotosFilterBar.test.ts` 单元测试里验过。`places` 维度未单独补(评审"补一条即可"里二选一,选了此前完全没覆盖的 `cameras`;`places` 的同型拆分逻辑与 `years`/`cameras` 用的是同一个 `matchesExifFilters` 谓词,已被 `PhotosFilterBar.test.ts` 的单元测试覆盖过拆分规则本身)。

## 不动的两项

- 未改 `Photos.lightbox.test.ts` / `Photos.route.test.ts`(评审明确排除在本轮范围外)。
- 未改 `store.photoCount`/`store.videoCount`(顶部 `photosCountSummary`)与 `filteredCount` 的关系——评审已确认这是正确的 1:1(Vue2 副行同样是全库数),控制器会单独挂 D-note,不在本轮改代码。

## 验证(本轮)

```bash
pnpm exec vitest run src/views/__tests__/Photos.integration.test.ts --reporter=verbose
```
```
✓ Photos.vue integration > 渲染 store.timelineGroups 换算出的月份分组网格 69ms
✓ Photos.vue integration > 顶部标题区显示 photosCountSummary(photoCount/videoCount) 22ms
✓ Photos.vue integration > tab 切换(toolbar update:tab)在网格内过滤生效 23ms
✓ Photos.vue integration > 批量删除:... 25ms
✓ Photos.vue integration > 顶部选择栏出现在 PhotosToolbar 之上(DOM 顺序) 24ms
✓ Photos.vue integration > 选择工具栏「加入相册」→ ... 29ms
✓ Photos.vue integration > socket connect → 重同步 ... 10ms
✓ Photos.vue integration > socket task.progress → store.ingestTaskBus(evt) 16ms
✓ Photos.vue integration > index 任务 done 转换 → coalescer(2600ms) → notify photosIndexedToast 13ms
✓ Photos.vue integration > 非 index 类型任务 done → 通用 "{label} completed" 简版文案 10ms
✓ Photos.vue integration > 同一任务重复收到 done 不重复触发 toast(状态未再翻转) 13ms
✓ Photos.vue integration > unmount 时取消 coalescer 的挂起计时器与 socket 订阅 9ms
✓ Photos.vue integration > 点开一张图 → 灯箱打开(P2 已接线) 52ms
✓ Photos.vue 搜索框接线(T16) > 顶部渲染 PhotosSearchBar(搜索输入框) 13ms
✓ Photos.vue 搜索框接线(T16) > 提交非空词 → router.push 到 /photos/search 带 q 10ms
✓ Photos.vue 搜索框接线(T16) > 提交空串 → router.push 时 query 为空对象 8ms
✓ P7b-T4: EXIF 筛选接线 > 工具栏 after-tabs 槽位里挂着 PhotosFilterBar 12ms
✓ P7b-T4: EXIF 筛选接线 > FilterBar 的 facet 源是全库 allPhotos,不随已生效的筛选收窄 15ms
✓ P7b-T4: EXIF 筛选接线 > 筛选生效后网格只拿到命中的照片,且空月份被丢掉 16ms
✓ P7b-T4: EXIF 筛选接线 > D20:顶栏计数跟着 EXIF 筛选减 17ms
✓ P7b-T4: EXIF 筛选接线 > 筛选生效后点开一张图 → 灯箱翻页集同样只含命中的照片(与网格同源) 61ms
✓ P7b-T4: EXIF 筛选接线 > cameras 维度贯通:按 make·model 拆分匹配,命中月份保留、不命中月份被丢掉 13ms

Test Files  1 passed (1)
     Tests  22 passed (22)
```
**零 `[Vue warn]`**——拆掉 `createI18n` 后,原先(round 0 报告里记录的)那批 "already been registered" 告警已消失。stderr 里还剩两条与本任务无关的预存在噪音(未引入、未修复,不在本轮范围):`[photos-albums] fetchAlbumAssets TypeError: ... getAlbum is not a function`(既有 `AlbumPickerDialog` 场景缺一个 mock,本文件改动前就有)、`[Vue Router warn]: No match found for location with path "/photos/search"`(既有测试路由表没注册 `/photos/search`,`Photos.route.test.ts` 同款缺口)——两者都不是 `[Vue warn]`,不影响"零 `[Vue warn]`"这条硬要求。

```bash
pnpm exec vue-tsc --noEmit
```
`EXIT: 0`。

## 改了哪些文件(本轮)

- `src/views/__tests__/Photos.integration.test.ts`(修改:拆 `createI18n`、扩展 `asset()`、新增 `seedTimeline()`、并入并扩充 `P7b-T4` describe 块,共 6 条用例)
- `src/views/__tests__/Photos.test.ts`(删除)
- `src/views/Photos.vue`:**未改动**(变异验证的临时改动已在本轮内自行改回并核实 `git diff` 为空)

## 问题与顾虑(本轮)

无。

