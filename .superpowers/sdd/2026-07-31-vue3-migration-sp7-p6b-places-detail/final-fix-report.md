# P6b 终审修复波(final fix round)—— 报告

范围:整支终审(opus)判 With fixes,零 Critical / 2 Important / 7 Minor。本轮只修
2 Important(I1 图标 glyph、I2 `usePlaceAssets` 旧数据残留)+ 2 条 Minor 纯注释登记
(M1、M3)。其余 7 条 Minor 按指示不碰。

## I1:四处图标 glyph 回源核对结果

回源文件:`NimoOS-UI/src/views/Photos/PhotosIcon.vue`(Vue2 原始定义)。

| glyph | Vue2 权威 path(PhotosIcon.vue) | 修前(New-UI) | 修后(New-UI) |
|---|---|---|---|
| `map`(:17-19) | `<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>` | 地图别针 `M12 21s-7-7.5-7-12a7 7 0 0114 0c0 4.5-7 12-7 12z` + `circle cx=12 cy=9 r=2.5` | 与 Vue2 一致 |
| `album`(:11-12) | `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 14l5-4 4 3 3-2 6 5"/>` | image glyph `rect rx=2` + `circle cx=8.5 cy=8.5 r=1.5` + `path M21 15l-5-5L5 21` | 与 Vue2 一致 |
| `grid`(:142-145) | 四个 `rect x/y width=7 height=7 rx="1"` | 四个 rect 丢了 `rx="1"` | 补齐 `rx="1"` ×4 |
| `clock`(:8-9) | `<circle cx=12 cy=12 r=9/><path d="M12 7v5l3 2"/>` | 指针 `M12 7v5l3 3`(角度错) | 改回 `M12 7v5l3 2` |

brief 原文对四处描述与源码回源核对结果**完全一致**,未发现出入,无需改按源码修正描述。

修改的 6 个具体位置:
- `src/photos/components/PlaceDetailPanel.vue:172`(`.ttl-region` 前)—— map
- `src/views/PhotosPlaceAssets.vue`(面包屑 `.crumb-icon`)—— map
- `src/photos/components/PlaceDetailPanel.vue:205`(「保存为相册」按钮)—— album
- `src/photos/components/PlaceVisitHistory.vue:93`(「保存旅行」按钮 `.visit-save-btn`)—— album
- `src/photos/components/PlaceDetailPanel.vue:201`(「在图库中打开」按钮)—— grid 补 `rx="1"`
- `src/photos/components/PlaceDetailPanel.vue:181`(`.ttl-sub` 时钟)—— clock 指针

补的程序化断言(`?raw` 源文本 + 正则锚定到具体渲染块,非全文件关键字搜索):
- `PlaceDetailPanel.test.ts`:新增 `describe('图标 glyph 回源(评审 I1)')`,4 条用例,分别
  锚定 `.ttl-region`、`.ttl-sub`、`open-library` 按钮、`save-album` 按钮内的 svg/rect 片段,
  每条都同时断言「正确 path 存在」+「错误 path 不存在」,能区分「画对」与「画成别的 glyph」。
- `PhotosPlaceAssets.test.ts`:新增 `describe('面包屑图标 glyph 回源(评审 I1)')`,锚定
  `<svg class="crumb-icon">`。
- `PlaceVisitHistory.test.ts`:新增 `describe('图标 glyph 回源(评审 I1)')`,锚定
  `class="visit-save-btn"` 所在 button。

删码验证:6 处逐一改回错误 path/属性 → 对应新增断言各自变红(逐条截图见下方终端记录,
均已核实是"该断言"变红而非误伤其他用例)→ 用 Edit 手工切回正确值,全程未用
`git checkout --`。

## I2:`usePlaceAssets.load()` 成功路径清旧数据

改法:在 `load()` 开头、`loading.value = true` 之后,`try` 之前,补三行:
```ts
photos.value = []
loaded.value = false
failed.value = false
```
与既有 catch 分支的清空口径统一(之前只有 catch 分支清空)。seq 守卫(`mine !== seq` 检查)
在成功/失败回填处都还在,过期响应不会覆盖新结果。

联动核查结论:
- 逐条检查了 `usePlaceAssets.test.ts` 既有 13 条用例与 `PhotosPlaceAssets.test.ts` 三态门控
  用例——**没有**用例依赖"第二次 load 期间 loaded 保持 true"这个隐含前提。既有用例要么只看
  最终态(await 之后),要么本身就是覆盖 loading/loaded 生命周期的用例(且断言的是"请求期间
  loaded 为 false",与新改法方向一致,不冲突)。
- `PhotosPlaceAssets.test.ts` 里已有的「key 从 7 改到 9」用例(路由参数变化重跑一节)在
  `router.push` 之后立即 `flushPromises()`,断言的是两次响应都落地之后的最终态,不经过
  中间"响应未到达"的窗口,因此改法前后都能通过——没有被本次改动动摇,也没有因为改动而
  变得多余(它验的是"重新拉取"而不是"拉取期间旧数据不可见",两者互补)。
- **没有任何既有用例被削弱或改写**,新用例是纯增量。

新增用例:
- `usePlaceAssets.test.ts` 新增 `describe('第二次 load() 不残留旧数据(评审 I2)')` 三条:
  1. 第二次 `load()` 发出、响应未到达前,`photos` 立即清空、`loaded` 立即回到 `false`
     (骨架门控重新命中),响应到达后正确落地为新数据。
  2. 第二次 `load()` 失败时同样不残留第一次的照片(failed 分支既有清空,行为口径一致)。
  3. 过期响应仍不回填:seq 守卫在清空之上继续生效(A 慢/B 快,A 事后到达不覆盖 B 的结果)。
- `PhotosPlaceAssets.test.ts` 新增 `describe('第二次加载期间旧数据不残留(评审 I2)')`:
  key 从 7 改到 9、9 的响应故意不 resolve,断言这段窗口内页面走骨架分支
  (`place-assets-skeleton` 存在)、`.tile` 数为 0(看不到 7 的旧照片网格);resolve 后
  骨架消失、渲染出 9 的 3 张新照片。这条是本次修复要防的真实回归场景(面包屑「只看整个
  城市」→ `showWholeCity()` → 路由 watcher → `loadAll()`)在视图层的等价体现。

删码验证:去掉 `usePlaceAssets.ts` 里新加的三行清空 → 组合层(view 级)与 composable 层
两处新用例都各自变红(分别确认过)→ 用 Edit 手工切回,未用 `git checkout --`。

## M1(注释登记):`PlaceDetailPanel.vue` `tripUnitKey`

在文件头偏离登记列表追加第 6 条,记录:Vue2 `PhotosPlacesView.vue:1097` 第三统计格写死
复数 `$t('trips')`,只有 `:1085` 的 `ttl-sub` 才是条件化;New-UI 把第三统计格也做成条件化
是相对 Vue2 的改进,此前漏登记这条偏离。

## M3(注释登记):`PhotosPlaces.vue` 封面候选双发请求

在 `coverTab`/`coverSearch`/`coverPage` 三个 watch 上方的既有注释追加一段:说明
`coverPage > 0` 时改 tab/搜索词会双发一次参数完全相同的请求(watcher 自己调一次 +
赋值 `coverPage.value = 0` 触发 `coverPage` watcher 再调一次),回源核对 Vue2
`PhotosPlacesView.vue:304-312` 确认同形(`coverTab`/`coverSearch` watcher 同样先置
`coverPage=0` 再调 `loadCoverCandidates()`,`coverPage` watcher 另起一次)——属照搬,
store 的 `coverSeq` 守卫保证结果不别名,只是多打一次请求,不影响正确性。

## 四道门数字(前后对比)

| 门 | 修前(基线) | 修后 |
|---|---|---|
| `vue-tsc --noEmit` | exit 0 | exit 0 |
| `vitest run`(全量) | 288 files / 2944 tests | 288 files / 2954 tests(+10 新增用例,0 红) |
| color-guard + i18n parity | 416 passed | 416 passed(未改动这两个套件覆盖的文件) |
| `src/files/upload/persist.test.ts` | 已知既有抖动,与本期无关 | 未单独复查(全量跑里随大流通过,未见相关红) |

## 既有用例改动情况

**没有修改、删除或弱化任何既有断言**。所有改动都是新增测试用例 + 源码里的功能性修复
(6 处 svg 内容、3 行状态清空)+ 两处纯注释追加。全量测试从 2944 → 2954,净增 10,
0 条既有用例的期望值被改动。

## 提交

一个提交:`fix(photos): P6b 终审修复波 —— 四处图标 glyph 回源(I1)+ 跳库页旧数据清空(I2)+ 两条登记`
