## Fix round 1 —— 派给你的开放缺陷(3 条 + 1 条便宜的注释更正)

评审(opus)判 Spec ❌ / Needs fixes。以下是**必须修**的项;7 条 Minor 已由控制器记进台账、不进本轮,你不要顺手改它们(除了下面点名的那条注释)。

### C1(Critical)—— `createSmartView` 必须传 id,plan 那句「由后端生成」是错的

控制器已回源逐条复核确认:
- `NimoOS-Photos/service/smartview.go:65-68` 的 `Create`:`if in.ID == "" || in.Name == "" { return nil, ErrInvalidInput }`
- `NimoOS-Photos/route/v1/smartviews.go:107-120` 的 handler 只 bind + 校验 `Name`,**从不生成 id**;`ErrInvalidInput` → 400
- 全仓唯一生成 id 的 `newSVID`(`smartview.go:503`)只被 `Duplicate`(`:750`)内部调用
- 后端自己的 HTTP 测试 `route/v1/smartviews_test.go:161-162` 显式传 `"id": "sv-h"`

⇒ 现在这个实现在真机上点「创建智能视图」**100% 返 400**。而 `smartViews.test.ts` 里那条 `expect(arg).not.toHaveProperty('id')` 把这个错契约焊死了。

**改法**:前端生成 id 并传给后端。plan 真正担心的只是 Vue2 用 `Date.now().toString(36)`(两个客户端同毫秒会撞),所以改用 uuid、形状对齐后端的 `sv-<uuid>`:

- **`safeRandomUUID` 跨区 import 复用,不要搬文件、不要抄那 6 行**:`import { safeRandomUUID } from '../../files/upload/uuid'`。这是控制器的决策,理由:它带一条实打实的守卫(本设备是 HTTP LAN 地址 = 非安全上下文,`crypto.randomUUID` 为 undefined,SP4-P3a 曾因丢这个守卫让上传整功能挂掉);搬文件会动 SP4 文件区的 3 个消费方,抄 6 行会让这条守卫有两份。**跨区 import 有既有先例**:`src/photos/components/PhotosSidebar.vue:7` 引 `files/util/format`、`src/photos/lightbox/PhotoInfoPanel.vue:22` 引 `files/util/clipboard`。
- **禁止直接用 `crypto.randomUUID()`** —— 非安全上下文下它是 undefined。
- 代码里写一行注释登记:后端 `Create` 硬性要求非空 id(带上 `smartview.go:65-68` 这个坐标),以及为什么不用 `Date.now()`。
- **测试要反过来**:把 `not.toHaveProperty('id')` 换成断言 `String(arg.id)` 匹配 `/^sv-/`,并**新增一条「连续两次 create 的 id 不相同」**。

### I1(Important)—— `deleteSmartView` 用 await 前的下标 splice,并发时删错项

`index` 在 `await service.photos.deleteSmartView(id)` **之前**算,await 之后直接 `splice(index, 1)`;而 `deleteBusy` 只互斥「删除↔删除/撤销」,**不挡 `fetchSmartViews`**。评审建临时用例实测过:列表 `[sv-1,sv-2,sv-3]`,删 `sv-2` 在途时 `fetchSmartViews()` 返 `[sv-0,sv-1,sv-2,sv-3]`(别的客户端新建了 sv-0)→ **用户删的是 sv-2,界面上消失的是 sv-1**,而撤销 payload 也指向 sv-1(点撤销会用一个 DB 里还在的 id 打 POST → 主键冲突 500)。

Vue2 `store/modules/photos.js:493-495` 的 `DELETE_SMART_VIEW` 是**按 id filter**,天然免疫重排 —— plan 第 6 条规定的那个顺序把 id 语义降级成了下标语义,是 plan 的错。

**改法**:入口那条 `index < 0 → return null` 早退**保留**(它承担「本地没有这项就不打请求」),但 await 之后**重算下标、按 id 移除**:

```ts
await service.photos.deleteSmartView(id)
// 必须在 await 之后重算:in-flight 期间 fetchSmartViews 可能已重排/插入,用 await
// 之前的下标 splice 会删掉别人(Vue2 :493 是按 id filter,不吃这个坑)。
const idx = smartViews.value.findIndex(s => String(s.id) === String(id))
if (idx < 0) return null
const [sv] = smartViews.value.splice(idx, 1)
return { sv, index: idx }
```

**回归测试必须走交错路径**(本仓纪律):照评审那个场景写 —— 删除在途时插入一项,断言消失的是**用户点的那一项**、且返回的 `sv.id` 与 `index` 都对得上。

### I2(Important)—— `toActivity` 零区分力覆盖

变异实验:把 `assetIds` 的兜底删掉 + `occurredAt` 写死 `'MUTATED'` → **46 例全绿**。后端 `SmartViewActivity.AssetIDs`(`smartview.go:731`)带 `omitempty`,Go nil slice ⇒ 字段整体缺失;T8 的活动流会 `v-for` 这个数组,`undefined` 会直接崩组件。

**改法**:加一条 `loadDetail` 用例,让 `getSmartViewActivity` 返 `[{ id: 9, eventType: 'matched' }]`(**故意缺** `detail`/`assetIds`/`occurredAt`,且 `id` 用**数字** 9),断言 `activity[0]` 全等 `{ id: '9', eventType: 'matched', detail: '', assetIds: [], occurredAt: '' }`。

### M2(便宜的注释更正,顺手做)—— `distribution` 的注释说了假话

你把判据从 plan/Vue2 的 `.length` 收紧成 `=== 10`,**实现本身留着**(对固定 10 柱的图表更安全,控制器认可),但:
- 代码注释与测试名都写「照搬 Vue2 :316 的兜底口径」,而 Vue2 `PhotosSmartViewDetail.vue:316` 是 `distribution && distribution.length ? … : new Array(10).fill(0)` —— `[1,2]` 会**原样保留**、不回落。这个「照搬」声明是错的。
- 注释把源文件写成 `PhotosSmartViewsView.vue:316`,真源在 `PhotosSmartViewDetail.vue:316`。

**改法**:注释改成「刻意收紧、不是照搬」并写明理由,同时改正文件名;测试名同步改。**本仓硬约束:改一个结论要 grep 它在注释里的所有出现处一并改。**

### 本轮要求

- 每条改完都要有**能变红**的测试(C1 两条、I1 交错路径一条、I2 一条)。
- 只跑覆盖改动的测试文件即可(`pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts`)+ 一次 `pnpm exec vue-tsc --noEmit`;**不用重跑全量**。
- 逐个删码验证新加的守卫(一次一处,验完 **Edit 手工还原,禁 `git checkout --`**)。
- **把 fix 报告追加到同一份 `task-2-report.md` 末尾**(不要新建文件),内容含:每条怎么改的、覆盖测试是哪个 `it`、跑的命令与输出、删码验证结果。
- 返回值仍只要四样:状态 / commit 起止 / 一行测试小结 / concerns。
