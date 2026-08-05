# Task 7 报告:深链 `?asset` / `?photoset`

## 实现

新增 `src/photos/composables/usePhotosDeepLinks.ts`,导出 `usePhotosDeepLinks(): void`。
挂载点是 `src/views/Photos.vue`(setup 里紧跟 `const lb = useLightbox()` 之后调一次)。
composable 内部自行 `onMounted`,不装路由 watcher(D 项裁定,见 brief 注 7)。

结构(一个键一个小函数,给 Task 8 留接口):
- `fetchPhoto(id)` —— 取明细,失败统一 catch + `console.error` + 返回 `null`(照 Vue2
  `fetchAssetDetail` NimoOS-UI `src/store/modules/photos.js:611-619` 的口径)。
- `notFoundToast()` —— `toast.show(t('photosDeepLinkPhotoNotFound'), 3000)`。
- `openAssetFromQuery(id)` —— Vue2 `:431-440`,单张成集。
- `consumePhotosetHandoff(token)` —— 读 `localStorage['nimo:photoset:'+token]`,parse 成功
  立刻 `removeItem`(Vue2 `:447` 的位置,取明细之前),`.filter(Boolean)`,外层 try/catch
  吞异常。
- `openPhotoSetFromQuery(token, activeId)` —— Vue2 `:441-465`,ids 为空降级 `openAssetFromQuery`,
  `active` 不在 ids 里则取 `ids[0]`,翻页集 `ids.map(id => assetToPhoto({id}))`。
- `onMounted` 分发:`if (photosetToken) {...} else if (assetId) {...}`(Vue2 `:370-374` 的
  if/else if,两者都在时只走 photoset)。

## Photo 类型宽度问题的处理

`Photo`(`src/photos/util/assetToPhoto.ts:267-292`)有 25+ 必填字段,Vue2 的
`ids.map(id => ({id}))` 在此仓不能直接编译。按坐标笔记要求,改用
`assetToPhoto({id})`(`assetToPhoto` 接收 `Record<string, unknown>`,所有字段用 `||`/`!!`/
三元表达式给了默认值,传入仅 `{id}` 时不会抛,产出满足 `Photo` 接口的合法对象),没有用
`as unknown as Photo` 强转。`?asset` 与 photoset 的 "取到明细" 分支同理用
`assetToPhoto(asset as unknown as Record<string, unknown>)` —— 这处 `as unknown as` 是把
后端裸 JSON(`unknown` 形状)转成 `assetToPhoto` 的入参类型,不是绕过 `Photo` 本身的字段
检查,和坐标笔记禁止的"强转成 Photo"是两件事(`useLightbox.ts:109` 的既有代码也是同样
写法,不是本任务引入的新模式)。

## 测试

新文件 `src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`,10 个用例,覆盖
brief 步骤 1 列出的全部场景(取到/取不到明细、立刻 removeItem、翻页集+active 打头、
active 不在 ids 里、handoff 缺失降级、handoff 缺失且无 active 的静默、localStorage 异常
吞掉、photoset 优先于 asset、假值过滤)。

挂载套路:真实 `useLightbox()` 单例(`__resetForTest()` 每条用例前后各调一次)、真实
Pinia `toast` store(`setActivePinia` + `vi.spyOn`)、真实 `vue-router`(`router.push` 带
query,不 mock `useRoute`)、`vi.mock('@nimotech/nimoos-service')` 提供 `getAsset` 及
`openAt` 内部连带用到的 `recordView`/`listFavoriteIds`/`getAssetOcr`。

### TDD 证据

**RED**(把 `usePhotosDeepLinks.ts` 临时替换成空函数体,运行新测试文件):
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose
```
结果:`Tests 9 failed | 1 passed (10)`。9 条断言真实行为的用例全部失败(如
`AssertionError: expected "openAt" to be called with arguments... Number of calls: 0`、
`expected [] to deeply equal ['a','b']`);唯一通过的是"handoff 缺失且无 active:什么都不做"——
空函数体天然满足"什么都不做",这条本身不能证明 RED,但其余 9 条已充分证明测试在锁真实行为。

**GREEN**(恢复实现后再次运行同一命令):
```
pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts --reporter=verbose
```
结果:`Test Files  1 passed (1)` / `Tests  10 passed (10)`,输出中 **0 条 `[Vue warn]`**。

### 局部回归 + 类型检查

```
pnpm exec vitest run "src/views/__tests__/Photos" --reporter=verbose
```
`Test Files 15 passed (15)` / `Tests 490 passed (490)`。stderr 里出现 **2758 条 `[Vue warn]`**,
但这是既有台账债(`PhotosSearch.test.ts` 等文件自建 `createI18n` 与全局单例重复注册,
memory 里"vitest 默认 reporter 藏告警"条目已记过同款问题),**不是本任务引入的**——用
临时禁用 `Photos.vue` 里 `usePhotosDeepLinks()` 那一行、重跑同一命令做了基线对照:
禁用前后 `[Vue warn]` 计数完全相同(都是 2758),通过数都是 490/490。证据见下方"变异
验证"之外单独做的这次基线核对(恢复后 `git diff src/views/Photos.vue` 确认只多了 3 行,
无遗留改动)。

```
pnpm exec vue-tsc --noEmit
```
无输出(通过,`strict: true` 下无类型错误,无 `as unknown as Photo` 逃逸)。

### 变异验证(4 项,brief Step 5 全部完成)

每项手工改坏 → 跑 `pnpm exec vitest run src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`
→ 确认对应用例变红 → 用备份文件 `cp` 还原 → `diff` 确认还原干净(未使用 `git checkout`/
`git stash`)。

| # | 变异 | 结果 |
|---|---|---|
| ① | `removeItem` 挪到取明细成功之后 | "读到 ids 后立刻 removeItem" 变红:`expected '{"ids":...}' to be null` |
| ② | `if/else if` 改成两个独立 `if` | "只走 photoset" 变红:`expected ['a1'] to deeply equal ['x']`(两个键都触发,a1 覆盖了 x) |
| ③ | 删掉 `.filter(Boolean)` | "假值过滤" 变红:`expected ['a','','',null,'b'] to deeply equal ['a','b']` |
| ④ | 删掉 `try/catch` | "localStorage 异常吞掉" 变红:断言失败 + 一条 Unhandled Rejection(两种方式都证明异常不再被吞) |

每次改坏后**只有目标用例**变红,其余 9 条保持绿,证明断言的锚点是精确的,没有交叉污染。

## 与 brief 的偏离(登记)

1. **brief 步骤 1 骨架里 `lb.openAt = vi.fn()` 式的 spy 断言用不了。** 第一版照抄骨架,
   `mountWithQuery` 返回的 `lb` 是从外层 `useLightbox()` 拿到的对象字面量,
   `vi.spyOn(lb, 'openAt')` 只替换这一个字面量自己的属性;而 `usePhotosDeepLinks()` 内部
   另调一次 `useLightbox()` 拿到**另一个**新对象字面量,其 `openAt` 属性仍指向未被替换的
   原函数(`useLightbox.ts` 每次调用返回新对象,但内部函数都是同一批 module 级闭包)。
   实测 9/10 条因此断言失败(`Number of calls: 0`),排查后确认是测试写法问题而非产品
   代码问题。改为直接断言 `useLightbox()` 共享的 module 级 ref(`lb.open.value`/
   `lb.list.value`/`lb.index.value`/`lb.current.value` 等)——这也更贴合评审对"测真实
   行为、不只测 mock 被调用"的要求。
2. **brief 骨架里翻页集断言用字面 `[{ id: 'a' }, { id: 'b' }, { id: 'c' }]`**,与坐标笔记
   要求的 `assetToPhoto({id})` 产物(带 25+ 字段的完整 `Photo` 对象)不兼容,改用
   `list.value.map(p => p.id)` 断言 id 序列,规避字面量不匹配。
3. `t('photosDeepLinkPhotoNotFound')` 的 toast 断言直接写中文字面值 `'未找到该图片'`(已在
   Task 2 落地,`src/i18n/zh_cn.ts:1682`),依赖全局 i18n 单例默认 `zh_cn`(与
   `PhotosPlaceAssets.test.ts` 等既有测试同款假设)。

## 文件

- 新增 `src/photos/composables/usePhotosDeepLinks.ts`
- 新增 `src/photos/composables/__tests__/usePhotosDeepLinks.test.ts`
- 修改 `src/views/Photos.vue`(+3 行:import + 一次调用 + 注释)

## 自查

- **完整性**:brief 逐条契约 1-4 全部有对应实现和至少一条断言;Step 1 骨架的 10 个测试
  场景全部覆盖(含 handoff 缺失的两种子情形、假值过滤、localStorage 异常、优先级)。
- **质量**:无 `as unknown as Photo`;函数按"一个键一个小函数"拆分,`fetchPhoto`/
  `notFoundToast` 在 `?asset` 与 `?photoset` 两条路径复用,没有重复逻辑。
- **纪律**:未装路由 watcher;未实现 Task 8 的 `?q`/`?album`/`?person`;未碰
  `NimoOS-UI` 仓、未碰 `strangler.js`、未碰主工作树 `/home/nimo/NimoTech/NimoOS-New-UI`;
  只跑局部测试(未跑全量 ~5800 例)。
- **测试真实性**:全部断言落在真实共享状态或真实 store 上,没有"断言 mock 被调用"
  这一类空心测试(第一版犯过这个错误,已在偏离①里改正并登记)。

## 关注点

- 无未解决的关注点。四项变异验证与局部回归 + `vue-tsc` 全绿,`[Vue warn]` 计数在我
  的新文件里是 0,在既有 `Photos*.test.ts` 文件里的 2758 条经基线核对确认是既有债务、
  与本次改动无关。
