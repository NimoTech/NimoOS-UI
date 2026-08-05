# Task 2 报告 —— 智能视图 Pinia store

## 改了哪些文件

- 新建 `src/photos/stores/smartViews.ts`(store 实现)
- 新建 `src/photos/stores/__tests__/smartViews.test.ts`(46 例)

## 回源核对结论

- `NimoOS-Photos/service/smartview.go:20-35` `SmartView` 结构体:字段名/omitempty 与
  brief 描述**完全一致**。注意结构体名实际是 `SmartViewInput`(不是 brief 写的
  `SmartViewCreate`),但字段(含 `CondsRaw` json tag `condsRaw`,`:41` 行)与描述一致,
  仅命名笔误,不影响实现。
- `:727-734` `SmartViewActivity` 与 brief 描述一致。
- `.sp7/NimoOS-Service/src/photos.ts:295-336` 11 个智能视图方法签名核对无误,
  `previewSmartView` 接收 `{ condsRaw, description, threshold, includeVideos }` 对象参数
  (不是位置参数),store 里 `refreshPreview` 已按此签名传参。
- `assetToPhoto.ts` **已经有 `isNew` 字段**(`:279` 类型声明、`:348` 赋值
  `isNew: !!asset.isNew`)。**不是缺失项,不需要转给 Task 10。** 顺带确认 `matchScore`/
  `matchedBy`/`belowCut` 三个搜索字段也都已透传(T10 用得上,顺手记一笔)。

## 必含用例 → it 对应关系

- fetchSmartViews:`null→[]+listLoaded true`、两条+id String化、抛错保留原值+listLoaded
  false+console.error、抛错保留已有数据(补充例)。
- toSmartView 兜底:median/storageBytes/distribution/evaluatedAt 缺省、conds:null→[]、
  seeds 缺→[]、distribution 长度不足 10 回落、完整字段原样归一(补充例)。
- byId:数字 id 命中、不存在→null。
- createSmartView:请求体 condsRaw 且不含 conds/id、成功进首位、createBusy 重入返回
  null+底层调一次、失败 rethrow+数组不变、busy 失败后复位(补充例)。
- updateSmartView:conds→condsRaw 改名、带 body 整体替换且位置不变、无 body 就地合并、
  失败 rethrow+未改动、patchBusy 重入+失败复位(补充例)。
- deleteSmartView/restoreSmartView:删不存在→null 底层未调、删成功返{sv,index}+移除、
  restore 插回原 index+请求体带 id、index 超界(99)钳到末尾、index 为负数钳到 0(见下方
  "偏离/申报"关于 ⑥ 的说明)、deleteBusy 共享重入+失败复位。
- duplicateSmartView:duplicateBusy 重入、成功插入列表、失败 rethrow+复位。
- loadDetail:三请求参数逐字断言、后发先回(A慢B快)、先发先回(A快B慢,钉住 finally
  门控,含中间态断言)、清旧数据(await 前已清空)、失败 console.error+detailLoading 复位。
- refreshPreview:3 次连调只发 1 个请求(debounce)、慢响应被 seq 丢弃、缺
  thresholdActive→true、显式 false、失败保留上次值。
- exportAlbum:exportBusy 重入、失败 rethrow+复位。
- 5 把重入锁(createBusy/patchBusy/deleteBusy/duplicateBusy/exportBusy)均有独立重入用例
  + 失败后复位用例。

## 8 条删码验证逐条结果

1. `loadDetail` 的 `if (mine !== detailSeq) return`(成功路径守卫)—— 删除后**变红**
   (「后发先回」用例)。已用 Edit 手工还原。
2. `finally` 里的 `mine === detailSeq` 门控 —— 删除后**变红**。**但过程中发现我最初写的
   「先发先回」测试是假的**(A 用 `await pA` 完全等待完才发 B,根本没有重叠,不是真竞态)。
   已重写成背靠背发出、断言 A 落定但 B 未落定时 `detailLoading` 必须仍为 `true` 的中间态
   ——重写后此项才真正可证伪。已用 Edit 手工还原。
3. `await` 前的三行清空(`matchedAssets/recentAssets/activity = []`)—— 删除后**变红**
   (「清旧数据」用例)。已还原。
4. `byId` 的 `String()` —— **删除后不变红**(该条不成立)。**推演**:store 内每一处写入
   `smartViews.value` 的路径(fetchSmartViews/createSmartView/updateSmartView 的替换分支/
   duplicateSmartView)都经过 `toSmartView`,`id` 落地前恒被 `String()` 归一;
   `updateSmartView` 的本地合并分支不会覆盖 `id` 字段;`restoreSmartView` 插回的
   `payload.sv` 也来自此前已归一的对象。因此 `s.id` 到达 `byId` 时永远已经是字符串,
   `String(s.id)` 这一半没有可证伪场景。保留原因写进了代码注释(结构性防御,防止未来
   某处写入绕过 `toSmartView`),测试维持现状(用「数字 id 命中」间接验证归一确实发生,
   没有伪造对 `byId` 内部实现细节的断言)。
5. `refreshPreview` 的 seq 守卫(`.then` 里的 `if (mine !== previewSeq) return`)—— 删除后
   **变红**(慢响应覆盖用例)。已还原。
6. `restoreSmartView` 的 `Math.min` 钳制 —— **删除后不变红(该条不成立)**。**推演**:
   JS 原生 `Array.prototype.splice` 对 `start` 参数本就有"大于数组长度时钳到数组长度"的
   内建语义(`[1].splice(99,0,'x')` 等价于 `splice(1,0,'x')`),brief 举的"超界 99"例子
   恰好落在这个原生行为覆盖的区间,删掉 `Math.min` 测试仍绿。真正有必要、且经验证**确实
   可证伪**的是 `Math.max(0, …)`——`splice` 对**负数** `start` 的语义是"从末尾倒数"而非
   钳到 0(`[1,2,3].splice(-1,0,'y')` 插在倒数第二位,不是最前面)。已把测试改写成诚实
   的替代断言:新增「index 为负数 → 钳到 0」用例,单独删除 `Math.max(0, …)` 验证**变红**
   (原「超界 99」用例保留,作为文档性用例,不再是这条守卫的证明)。已还原。
7. 任一 busy 入口短路(以 `createBusy` 为代表)—— 删除后**变红**(createBusy 重入用例)。
   已还原。
8. `distribution` 的长度兜底(`distribution.length === 10 ? … : new Array(10).fill(0)`)
   —— 删除后**变红**(2 条用例:省略字段例 + 长度不足例)。已还原。

**结论**:8 条里 6 条如实变红,2 条(④⑥)经推演确认"数学上不成立",按规程如实申报 +
改写成诚实的替代断言(④补充注释说明防御性质并保持现有测试;⑥新增负数 index 用例并验证
它确实钉住了真正起作用的 `Math.max`)。

## 申报的偏离

1. **`duplicateSmartView` 的插入位置**:brief 原文写"成功后把返回对象 unshift 进列表"。
   回源核对 Vue2 `photos.js:1059-1069` 实际是 `commit('RESTORE_SMART_VIEW', { sv: copy,
   index: i + 1 })`——插在原件紧后面,不是 unshift 到最前。brief 括号里那句"Vue2 :1060
   的 mutation 只重新 fetch 或 unshift,回源确认后照做"本身对真实源码的描述有误(源码是
   第三种写法:插在原位置+1)。**以真源为准**:实现为 `findIndex` 命中原件位置 `i` 后
   `splice(i + 1, 0, copy)`;`findIndex` 未命中时 `i=-1`,`i+1=0` 自然退化为 unshift,
   覆盖了"本地列表还没这一项"的边界情况,不需要额外分支。此偏离已在代码注释登记。
   **必含用例列表里没有专门测这条插入位置的用例**(该列表只要求 duplicateBusy 的重入
   测试),因此补了一条非必含的"成功后把返回对象插入列表"轻量断言(只验证插入,没有细抠
   位置),不影响必含用例的完整性。
2. **补充的非必含用例**(超出 brief 逐条列举但不违反任何约束,用于把边界钉死):
   - fetchSmartViews 的"抛错保留上一次已加载数据"(brief 只要求"保持原值",我额外验证
     了"原值是真实的上一次成功数据"而不仅是初始空值)。
   - toSmartView 的"完整字段原样归一"(正向用例,确认非兜底路径也对)。
   - createSmartView/updateSmartView/deleteSmartView/exportAlbum 的"busy 失败后复位,
     紧接着的调用能正常发起"(brief 第 110 行要求"各写一条抛错用例",我把"复位"这一半
     也验证了,而不只是断言抛错本身)。
   - restoreSmartView 的"index 为负数"用例(见上方删码验证第 6 条,为了让 ⑥ 可证伪而
     新增,不在 brief 原始列表里)。
   这些都是加固,没有删减或替换任何 brief 要求的必含用例。
3. **没有做**:brief 没要求的东西(改 `assetToPhoto.ts`、改 i18n、改 `.vue` 文件、改
   Service 仓)一概没碰,确认过 `git status` 干净。

## assetToPhoto 是否有 isNew

**有**(`src/photos/util/assetToPhoto.ts:279` 类型字段 + `:348`
`isNew: !!asset.isNew`)。不是本任务遗留项,不需要转给 Task 10。

## 验证记录

- `pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts`:46 passed。
- `pnpm exec vue-tsc --noEmit`:exit 0,无输出。
- 全量 `pnpm exec vitest run`:291 files / 3029 passed(其中一个预先存在、与本任务无关的
  `favorites.test.ts` jsdom `Not implemented: navigation` 控制台噪音,不是失败,该测试
  本身通过)。
- 全程 `strict: true`,无裸 `any`。

---

# Fix round 1 —— 评审(opus)Spec ❌ / Needs fixes,1 Critical + 2 Important

## C1(Critical)—— `createSmartView` 必须传 id

**回源复核(与控制器结论一致)**:`NimoOS-Photos/service/smartview.go:65-68` 的
`Create` 对空 id 直接 `return nil, ErrInvalidInput`;`route/v1/smartviews.go` 的
`Create` handler 只 bind + 校验 `Name`,从不生成 id;全仓唯一生成 id 的 `newSVID`
(`smartview.go:503`,格式 `prefix + "-" + uuid.NewString()`)只被 `Duplicate`
(`:750`,`newSVID("sv")`)内部调用;后端 HTTP 测试
`route/v1/smartviews_test.go:161-162` 显式传 `"id": "sv-h"`。原实现不传 id,在真机上
点"创建智能视图"会 100% 返 400。

**怎么改**:`createSmartView` 请求体加回 `id: \`sv-${safeRandomUUID()}\``。
`safeRandomUUID` 用**跨区 import**(`import { safeRandomUUID } from
'../../files/upload/uuid'`),没有搬文件、没有抄那 6 行——按控制器决策,理由与既有
先例(`PhotosSidebar.vue` 引 `files/util/format`、`PhotoInfoPanel.vue` 引
`files/util/clipboard`)已写进代码注释。同时改写了 `createSmartView` 与
`restoreSmartView` 上方的旧注释(旧注释说"id 由后端生成、createSmartView 故意不传
id"——这个说法现在是错的,两者其实都会传非空 id,真正的区别是 id 的**来源**:
createSmartView 每次生成全新随机 id,restoreSmartView 沿用被删除项的原 id)。

**覆盖测试**:
- `createSmartView` describe 块:「请求体含 condsRaw 且不含 conds、且带 sv- 前缀的
  id(C1 回源修复)」—— 断言 `String(arg.id)` 匹配 `/^sv-/`(替换了旧的
  `not.toHaveProperty('id')` 反向断言)。
- 「连续两次 create 生成的 id 不相同(C1:不用 Date.now(),用 uuid,避免同毫秒撞
  id)」—— 新增。

**删码验证**:临时删掉请求体里的 `id: ...` 一行 → 上述两条**变红**(2 failed)。
已用 Edit 手工还原,重跑 49 例全绿。

## I1(Important)—— `deleteSmartView` 必须在 await 之后按 id 重算下标

**根因确认**:`deleteBusy` 只互斥删除↔删除/撤销,不挡 `fetchSmartViews`;原实现在
`await service.photos.deleteSmartView(id)` **之前**算下标,await 之后直接
`splice(index, 1)`。若删除在途时 `fetchSmartViews` 把列表重排/插入,await 之前的
下标就指向了别的项——会删错、返回的撤销 payload 也会指向错误的项。Vue2
`store/modules/photos.js:493-495` 的 `DELETE_SMART_VIEW` 是按 id filter,天然免疫,
plan 第 6 条规定的"await 前算下标"顺序把 id 语义降级成了下标语义,是 plan 的错。

**怎么改**:入口的 `index < 0 → return null` 早退检查保留(承担"本地没有这项就不发
请求"),但**只用于早退判断,不带进 splice**;await 之后重新 `findIndex` 一次,拿
新下标做 `splice`,连同 `index` 的返回值也用这个新下标。

**覆盖测试**:「并发交错:delete 在途时 fetchSmartViews 重排列表,删除的必须仍是按
id 命中的那一项」—— 走的正是评审复现的场景:`[sv-1,sv-2,sv-3]` 中 `deleteSmartView
('sv-2')` 发出后(网络请求挂起),在其 resolve 之前先 `fetchSmartViews()` 把列表换成
`[sv-0,sv-1,sv-2,sv-3]`,再 resolve 删除请求;断言最终列表是
`[sv-0,sv-1,sv-3]`(删掉的确实是 sv-2,不是旧下标 1 上错位的 sv-1)、返回值
`{ sv.id: 'sv-2', index: 2 }`(重排后的真实下标,不是最初的 1)。

**删码验证**:把实现临时改回"early-return 检查算出的下标直接带进 await 后的
splice"(即还原 await 前定下标的旧写法)→ 上述交错用例**变红**(1 failed,
其余 48 例不受影响)。已用 Edit 手工还原,重跑 49 例全绿。

## I2(Important)—— `toActivity` 补一条能钉住兜底字段的用例

**根因确认**:变异实验(评审做的,我复现确认)——把 `assetIds` 的
`Array.isArray(...) ? ... : []` 兜底删掉(直接 `.map(String)`,遇到 `undefined` 会
抛)、`occurredAt` 写死成字面量 `'MUTATED'`,46 例原样全绿。`toActivity` 函数本身
一直带着这些兜底(`id: String(r.id)`/`detail: String(r.detail ?? '')` 等),问题不是
实现缺兜底,是**测试没有任何一条 fixture 缺过这些字段**,兜底代码路径从未被执行过。

**怎么改**:没有改实现(`toActivity` 本来就对,原实现是对的),只加测试。新增
`loadDetail` 用例:`getSmartViewActivity` 返 `[{ id: 9, eventType: 'matched' }]`(照
评审要求,`id` 用数字、故意缺 `detail`/`assetIds`/`occurredAt`),断言
`activity[0]` 全等 `{ id: '9', eventType: 'matched', detail: '', assetIds: [],
occurredAt: '' }`。

**删码验证**:按评审原话复现变异——`assetIds: (r.assetIds as
unknown[]).map(String)`(去掉 `Array.isArray` 兜底)+ `occurredAt: 'MUTATED'`
(写死字面量)→ 新用例**变红**(1 failed)。已用 Edit 手工还原,重跑 49 例全绿。

## M2(顺手做)—— `distribution` 注释更正

`=== 10` 的收紧判据**保留**(实现本身没问题,已获控制器认可)。改的是两处不实描述:
1. 注释说"照搬 Vue2 :316 的兜底口径"——假的。回源 `PhotosSmartViewDetail.vue:316`
   实际是 `distribution && distribution.length ? … : new Array(10).fill(0)`,只要非空
   就原样保留,`[1,2]` 这种长度不足 10 的数组会被直接透传。已把注释改成"刻意收紧、
   不是照搬",并写明理由(固定 10 柱图表,长度不对会导致柱子与桶位错位)。
2. 注释把源文件写成 `PhotosSmartViewsView.vue:316`,真源在
   `PhotosSmartViewDetail.vue:316`(文件名写错)。已改正。
3. 全仓 grep 过 `PhotosSmartViewsView.vue:316`/`Vue2 :316` 的所有出现处——命中两处
   (实现里的注释 + 测试的 `it` 标题),两处都已改。测试标题同步改成
   「distribution 长度不足 10 时也整体回落成全 0(刻意收紧,不是照搬 Vue2
   PhotosSmartViewDetail.vue:316 —— 那里 [1,2] 会原样保留)」。

## 补登记的 3 条(M1/M3/M7,按控制器指示只登记、不改码)

- **M1**:Vue2 `duplicateSmartView` 有前置守卫 `const i = state.smartViews.findIndex
  (s => s.id === sv.id); if (i < 0) return null`——本地列表里找不到原件时**不发起
  API 调用**直接返回。本 store 的 `duplicateSmartView` 丢了这个前置守卫:不管本地
  是否存在该 id,一律先调 `service.photos.duplicateSmartView(id)`,只有插入位置的
  计算用了 `findIndex`(找不到时 `i=-1`,`i+1=0` 退化为 unshift,行为上不炸,但会
  对一个本地不认识的 id 发起一次多余的后端请求)。未按控制器指示改码,仅在此登记。
- **M3**:`restoreSmartView` 的失败路径与 Vue2 不同,此前**未在报告里申报**这条偏离。
  Vue2 `restoreSmartView`(`photos.js:1047-1058`)是"createSmartView 调用失败只
  console.error,吞掉异常;不管成功失败,`commit('RESTORE_SMART_VIEW', payload)` 都会
  执行"——也就是说 Vue2 即使后端恢复失败,也会把这一项**乐观地插回本地列表**。本
  store 的实现是:创建请求失败时 `throw e`(不吞),且**不会执行**到下面的
  `splice` 插回——也就是说本地列表在失败时**不会**插回这一项。这是一处刻意的正确性
  改进(避免"界面显示已恢复、后端其实没恢复成功"的假象,与本任务其余几处"不照抄
  乐观撒谎"的偏离同一个理由),但此前没有像其他偏离一样在报告里正式登记,现在补登记。
- **M7**:`__resetForTest` 不复位 `detailSeq`/`previewSeq` 这个决策此前只在代码注释里
  说明了理由(防止重置后的下一次调用与重置前仍在途的旧请求发生别名冲突,同
  `places.ts __resetForTest` 的既有先例),但**未在报告里作为一条正式的"偏离登记"
  列出**。现在补登记:这不是遗漏,是有意为之的设计,与 `places.ts` 的既有约定一致。

## 本轮验证记录

- `pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts`:**49 passed**
  (在原 46 例基础上新增 3 例:C1 的"id 不相同"、I1 的"并发交错"、I2 的
  "toActivity 兜底")。
- `pnpm exec vue-tsc --noEmit`:exit 0,无输出。
- 未重跑全量(遵循本轮指示,只跑覆盖改动的测试文件)。
- 3 条新守卫逐一删码验证:C1(2 例变红)、I1(1 例变红)、I2(1 例变红),
  均已用 Edit 手工还原、复跑确认 49 例回绿,全程未用 `git checkout --`。
