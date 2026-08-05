# Task 9 报告: `/photos/places/:key` 地点照片页 + 面包屑 + 路由(D6/D10)——本期最后一任务

## 结论

状态:完成。

- 新建 `src/views/PhotosPlaceAssets.vue`、`src/views/__tests__/PhotosPlaceAssets.test.ts`(20 例)。
- 修改 `src/router/index.ts`(追加 import + 一条路由,既有 20 行原样不动)、
  `src/photos/components/PhotosGrid.vue`(加 `selectable?: boolean` 默认 `true`)、
  `src/photos/components/__tests__/PhotosGrid.test.ts`(既有 24 例不动 + 新增 2 例 = 26,
  fix round 1 订正:原文误写"既有 26 例",已改对)。
- 全量:`pnpm exec vitest run` **288 files / 2943 passed**(基线 287/2918,净增 25 例:
  20 + 2 + color-guard 因扫描新文件自增的 3 条,与文件增量吻合)。
  `pnpm exec vue-tsc --noEmit` 0 错误。`color-guard.test.ts` 409 passed(基线 406)。
  `src/i18n/` 全绿(parity 未破)。已知既有抖动 `src/files/upload/persist.test.ts` 本次全量
  未见发作。

## 7 条结构规格逐条落地

1. **壳**:`AreaShell :title="cityName"` + `.photos-layout` + `PhotosSidebar` + `.photos-main`,
   逐段照 `PhotosAlbumDetail.vue:1-80` 的既有结构,未抽公共(P3/P4/P5 既定)。
2. **参数归一**:`placeKey = computed(() => String(route.params.key))`;
   `spotKey = computed(() => String(route.query.spot ?? ''))`;`lat`/`lon` 各自
   `Number(route.query.x)` + `Number.isFinite` 守卫,不成立传 `null`。
3. **数据编排**:`onMounted` → `store.loadDetail(placeKey.value)` + `assets.load(placeKey.value,
   spotKey.value, lat.value, lon.value)`(`usePlaceAssets`,T2 原样复用,未写第二套拉取)。
   `watch(() => [route.params.key, route.query.spot, route.query.lat, route.query.lon], loadAll)`
   覆盖 SP6-P5.5 第 6 条教训(路由参数变化必须重跑,否则渲染陈旧数据)。
4. **面包屑**:12px 地图图标 + 城市段(有 spot → `<button>`,`title=photosPlacesShowWholeCity`,
   点击 `router.replace({path: route.path, query: {}})`;无 spot → 静态 `<span>`)+ 有 spot 时
   追加 11px 右尖角 + spot 名 + 右侧 `photosPlacesPhotoCount({n: photos.length})`。spot 名从
   `store.detail.spots` 按 `String(key)` 归一查找;找不到时**不渲染 spot 段**并静默降级(见下)。
5. **三态门控**:`assets.loading && !assets.loaded` → 骨架;`assets.failed` → 失败文案 +
   重试钮(重调 `assets.load`);`assets.loaded && photos.length===0` → 复用 `photosNoPhotos` +
   `photosNoPhotosHint`。
6. **网格 + 灯箱**:`<PhotosGrid :months="assets.months.value" :selectable="false" @open="onOpen">`;
   `onOpen(photo, _list, startMs)` → `lb.openAt(photo, assets.photos.value, startMs)`(整页翻页集,
   D9);`<PhotoLightbox />` 挂在 `AreaShell` 之外(先例 `PhotosPersonDetail.vue:708-710`)。
7. **`PhotosGrid.selectable`**:`withDefaults` 加 `selectable?: boolean`(默认 `true`),
   `.tile-check` 外层加 `v-if="selectable"`。默认值回归断言已加(见下)。

## T8 评审转来的两条硬要求如何满足

1. **路由必须真注册且测试要真解析**:`router/index.ts` 追加了真实的
   `{ path: '/photos/places/:key', name: 'photos-place-assets', component: PhotosPlaceAssets }`
   (在 `/photos/places` 那一行之后)。测试文件里专设一个 `describe('路由注册与解析')`:
   - 用**真实应用路由**(`import { router as appRouter } from '../../router'`)调
     `appRouter.resolve('/photos/places/7')`,断言 `matched.length > 0` 且
     `match.name === 'photos-place-assets'`、`matched[0].components.default` 真实存在。
   - 用一个独立的本地路由实例 `await router.push('/photos/places/9')` 后断言
     `router.currentRoute.value.name === 'photos-place-assets'`(真 push+真解析,不是 spy)。
   - 其余全部 20 例的 `mountView` 助手也都走真实 `createRouter`+`router.push`+
     `router.isReady()`,没有一处只 spy `router.push` 就断言完事(T8 那种缺口在本文件不存在)。

   **实测纠正(登记):** brief 建议用 `appRouter.getRoutes()` 的下标比较"排在之后"——实测
   vue-router 4 的 `getRoutes()` 按自身打分算法重排匹配表(带 `:key` 动态段的路由被整体挪到
   列表靠前的一段),运行时下标是 `photos-place-assets` 排在 `photos-places` **之前**,与
   "追加不重排"这条源码层面的约束(为了 rebase 冲突最小化)完全是两回事,用它断言必然是假红灯。
   改为**源文件文本级**断言(Vite `?raw` 导入 `router/index.ts`,不需要 `@types/node`——本仓
   本就没装它,引入会是范围外的依赖变更):`indexOf("path: '/photos/places',")` 必须早于
   `indexOf("path: '/photos/places/:key',")`。这条更准确地对应"追加不重排"的真实诉求。

2. **面包屑城市名/spot 名从 key + spot query 回源导出**:`cityName` 只读 `currentDetail.value?.city`
   (`currentDetail` 是 `store.detail` 按 `String(id) === placeKey.value` 身份守卫后的结果),
   `matchedSpot` 只读 `currentDetail.value.spots` 按 `String(key)` 查找 `spotKey.value`。整个
   组件的 `route.query` 里**只放** `spot`/`lat`/`lon` 三个键,从未读写 `city`/`spotName` 字符串
   ——测试 fixture(`rawPlace()`)也刻意从未在 URL 上带这两个值,城市名/spot 名全部来自
   mock 的 `getPlace` 响应,直接验证了"回源导出"而非"信任 URL"。

## 6 项删码验证结果(逐个改动 → 跑目标测试确认真红 → `Edit` 手工切回,未用 `git checkout --`)

| # | 删的是什么 | 目标测试 | 结果 |
|---|---|---|---|
| 1 | 路由参数 `watch` 整个注释掉 | "key 从 7 改到 9 → …" | 红:`getPlace`/`listAssetsByPlace` 调用次数停在 1,未再调 |
| 2 | `lat` 的 `Number.isFinite` 守卫删掉(直接 `return n`) | "lat 非数字→null" + 连带另外 2 例 | 红:`NaN` 被传给 `listAssetsByPlace`(3 例失败,含默认无 query 场景,因为 `Number(undefined)` 也是 `NaN`) |
| 3 | 降级分支里的 `showWholeCity()` 调用挖空 | "spot 找不到时静默降级" | 红:`router.currentRoute.value.query.spot` 仍是 `'zzz'`,断言 `toBeUndefined()` 失败 |
| 4 | 城市段的 `v-if="matchedSpot"`/`v-else` 分流去掉,恒渲染 `<button>` | "无 spot → 城市段是 span" | 红(级联到 2 例):`place-crumb-city-span` 不存在 |
| 5 | `PhotosGrid` 的 `selectable` 默认值从 `true` 改成 `false` | PhotosGrid.test.ts 默认值回归例 | 红(级联到 4 例):`.tile-check`/`.tile-check-box` 全不存在,既有选择态用例跟着塌 |
| 6 | `onOpen` 第二参从 `assets.photos.value` 改成 `[photo]` | "PhotosGrid emit open → lb.openAt 收到整页 photos" | 红:`lb.list.value` 只有 `['a1']`,断言 `['a1','a2']` 失败 |

6 项全部先红后手工恢复原状(`Edit` 逐处切回,未用 `git checkout --`),`git diff --stat` 复核
最终落盘内容与删码前一致。

## `PhotosGrid` 默认值回归断言

- `not passing selectable at all still renders .tile-check`:不传该 prop,`.tile-check` 存在
  (保护 `Photos.vue`/`PhotosFavorites.vue` 这两个既有消费方——**实测纠正**:grep 全仓
  `<PhotosGrid` 实际只有这两处模板消费方,brief 写的"另外 5 个消费方"数字与源码不符,已按
  实测数字执行,不影响本条断言本身的正确性)。
- `selectable=false hides .tile-check`:`.tile-check`/`.tile-check-box` 均不存在;并补一条
  "裸瓦片点击仍能正常 `open`,不会因复选框消失而卡进某种半选中态"的行为断言。

## 一处超出 brief 字面必含用例、但确有必要的补强(已登记)

`currentDetail` 身份守卫(`store.detail` 只在 `String(id) === placeKey.value` 时才采信)——
`usePhotosPlaces.loadDetail` 内部虽有 seq 竞态守卫防止旧响应覆盖新数据,但从地点 A 跳到地点 B
时,在 B 的响应回来之前 `store.detail` 仍持有着 A 的数据,不加这层身份核对会让面包屑在跳转的
短暂窗口内显示上一个城市的名字。姐妹页 `PhotosPlaces.vue:99-100` 的 `activeDetail` 对同一个
store 已有这个先例(`store.detail && String(store.detail.id) === String(activeId.value)`),
这里照抄同一手法,不是新发明的复杂度。

**连带发现的一个真实坑(已在实现里避开,登记留痕)**:降级 watch 一开始若直接
`watch(matchedSpot, cb)`,"详情还没到位"(`currentDetail` 为 `null`)与"详情到位但确实没有
这个 spot"两种情形下 `matchedSpot` 的值**都是 `null`**——Vue 的 `watch` 对新旧值做
`hasChanged`(`Object.is`)比较,`null → null` 判定为未变化,回调根本不会跑,降级会静默失效
且不会被"detail 还没到位"这类测试抓到(因为那类测试断言的是最终稳定态,而不是"回调有没有跑
过")。改为 watch `currentDetail` 本身(它在每次 `loadDetail` 成功后都指向全新对象引用,
`null → 对象` 或 `对象A → 对象B` 都是真变化),在回调里再读 `matchedSpot.value`,才能保证
"详情从无到有"这一刻必然触发一次判断。删码 3 的红灯验证的正是这条链路。

## 测试数字前后

| | 文件数 | 测试数 | tsc | color-guard |
|---|---|---|---|---|
| 基线 | 287 | 2918 | 0 | 406 |
| 本任务后 | 288 | 2943 | 0 | 409 |

## 遗留疑问 / 挂账

- brief 提到的"另外 5 个消费方"与实测（`Photos.vue`/`PhotosFavorites.vue` 两处）不符,已在
  上面登记,不影响默认值回归断言的有效性,仅供后续任务对账时留意这个数字口径。
- `route.query.lat`/`lon` 是数组(`string[]`)的边界情况未特殊处理(`Number(arr)` 会走
  逗号拼接字符串再转数字,大概率得到 `NaN` 从而落回 `null`)——本仓其余视图对 query 参数
  也未处理这种边界,维持现状一致,未额外加码。
- 真机验收清单在 brief 文末,本任务未做真机验证(仅本地 vitest/tsc/color-guard 四门),
  验收需用户按 `.sp7` workspace 起 `pnpm dev --host --port 5277` 走一遍文末清单。

---

## Fix round 1(评审回:1 Important + 3 Minor,本轮全部处理)

评审独立核实了申报的三条(`getRoutes()` 复现、消费方数字 3 vs 5、身份守卫非 YAGNI)与自查发现
的 `matchedSpot` null→null 漏触发均成立,只提了以下 4 条待改:

### I1(Important):lat/lon 与 spotKey 脱钩,已修

**问题**:`lat`/`lon` 两个 computed 原来只看 `route.query.lat/lon` 本身是否有限数,不看
`spotKey` 是否非空。回源 Vue2 `NimoOS-UI/src/views/Photos/PhotosTimeline.vue:538-545`
(`_applyPlaceFromQuery`)确认:它只在 spot 命中时才赋 `spotLat`/`spotLon`,否则强制 `null`;
brief 结构规格 2 也明写「spotKey 为空串时 lat/lon 也不该带」。后果:手工地址栏/旧书签带
`?lat=1&lon=2` 但没有 `spot=` 时,会把非 null 坐标连同空 `spotKey` 一起传给 `assets.load`,
违反共享包「lat/lon 与 spotKey 成对」的不变量。应用内导航(showWholeCity/spot 卡片)都是三键
一起清、一起带,碰不到这条,但外部输入会。

**修法**:`src/views/PhotosPlaceAssets.vue` 的 `lat`/`lon` 两个 computed 各自在开头加
`if (!spotKey.value) return null`,再走原来的 `Number()` + `Number.isFinite` 判断。

**新增测试**:`src/views/__tests__/PhotosPlaceAssets.test.ts` 新增
「有 lat/lon 但无 spot query → lat/lon 都被压成 null,spotKey 传空串」——
`?lat=1&lon=2`(无 `spot=`)→ 断言 `listAssetsByPlace` 收到 `('7', '', 500, null, null)`。

**删码验证**:把 `lat` computed 里新加的 `if (!spotKey.value) return null` 注释掉 →
上述新测试红(`listAssetsByPlace` 实收 `1` 而非 `null`)→ 用 `Edit` 手工切回(未用
`git checkout --`)。

### Minor 1:报告数字订正

`task-9-report.md` 开头"结论"节原写「`PhotosGrid.test.ts` 既有 26 例不动」,评审实测基线是
24 例(`git show b1f2f19:src/photos/components/__tests__/PhotosGrid.test.ts` 数 `it(` 得
24)+ 新增 2 例 = 26,已在原文该处订正为「既有 24 例不动 + 新增 2 例 = 26」。

### Minor 2:测试标题措辞订正

原标题「不传 selectable 时本页也确实不渲染复选框」不准确——`PhotosPlaceAssets.vue` 模板其实
**显式**传了 `:selectable="false"`(D10 语义),不是"没传"。已改为
「D10 落地:本页显式传 selectable=false,复选框确实不渲染」,断言内容不变。

### Minor 3:`?raw` 路由顺序断言与既有 `router/index.test.ts` 的分工

评审指出新增的「路由注册与解析」里那条 `?raw` 文本序断言与 `router/index.test.ts` 已有的
同款断言(P6a-T11 立的,核 `/photos/people/:id → /photos/places → /login` 这对边界)手法
重复。核对后发现:两条断言检验的是**两次不同任务各自新增的路由边界**(既有那条从未覆盖本任务
新增的 `/photos/places/:key` 落在哪),不是对同一件事的重复断言,只是用了相同的检验*手法*
(`?raw` 源文本序)。选择**保留**本文件里新增的这条,不改动 `router/index.test.ts`(不碰既有
断言),并在新增断言上方加了一段注释明确分工("刻意不去改 `router/index.test.ts`,就近把这条
放在本文件里")。

### 本轮验证

- `pnpm exec vitest run src/views/__tests__/PhotosPlaceAssets.test.ts
  src/photos/components/__tests__/PhotosGrid.test.ts src/router` → **5 files / 67 passed**。
- `pnpm exec vue-tsc --noEmit` → 0 错误。
- 全量 `pnpm exec vitest run` → **287 files 通过 + `src/files/upload/persist.test.ts` 1 例红**
  (与本期无关的已知抖动,单跑该文件 `14/14 passed` 确认;总计 288 files / 2944 tests,
  仅比 fix 前多 1 例,即本轮新增的那条 lat/lon 测试)。`color-guard.test.ts` 仍 409 passed
  (本轮未碰任何样式,数字不变)。

### 测试数字前后(fix round 1)

| | 文件数 | 测试数 | tsc | color-guard |
|---|---|---|---|---|
| Task 9 初版后 | 288 | 2943 | 0 | 409 |
| Fix round 1 后 | 288 | 2944 | 0 | 409 |
