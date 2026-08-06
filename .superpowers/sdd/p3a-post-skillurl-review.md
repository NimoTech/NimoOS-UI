# SP8-P3a 验收后追加② —— `?skill=` 抹 URL 修复:独立评审

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,评审目标提交 `4bfabfc`
(单提交,`e5bfb20..HEAD`)。评审前后 `git status` 均干净;评审过程中的两次 RED 探针
均已精确还原。

## 0. 范围核对

`git show --stat 4bfabfc`:仅 2 个文件
`src/ai/views/AgentPage.vue`(+32/-5)、`src/ai/views/AgentPage.test.ts`(+31/-2)。
未触碰 `agentStore.ts`、`AgentComposer.vue`,未做 brief 明确排除的「停用技能提示」。
与 brief §2/§2.2/申报要求一致。

## 1. 顺序陷阱(brief §2.1)—— 逐行核对源码

读 `src/ai/views/AgentPage.vue:286-317`(当前实现):

```js
const query = { ...route.query }        // 本地副本,唯一数据源
const skill = query.skill
if (skill) {
  store.pendingSkillId = String(skill)
  delete query.skill                    // 只删 skill
  await router.replace({ path: '/ai/agent', query: { ...query } })
}
const seedSearch = (query.search ?? '').toString().trim()   // 读本地副本,不读 route.query
const seedMessage = (query.message ?? '').toString().trim()
if (seedSearch || seedMessage) {
  const clean = { ...query }            // 此时 query 里已无 skill,search/message 还在
  delete clean.search
  delete clean.message
  await router.replace({ path: '/ai/agent', query: clean })
  ...
}
```

实现全程只操作一个本地 `query` 对象,从未在第一次 `replace` 之后回读 `route.query`。
第一次只 `delete query.skill`,`search`/`message` 原样留在 `query` 里供下面读取;
第二次基于「已经没有 skill」的 `query` 再删 `search`/`message`。**两次 replace 互不
吃掉对方的结果,最终态里三个参数都被抹掉** —— 顺序陷阱处理正确。

### mock 的 `replace` 是否真改写 `routeQuery`?——明确结论:**没有**

`AgentPage.test.ts:36`:`const replace = vi.fn().mockResolvedValue(undefined)`。
这是裸 spy,不含任何写回 `routeQuery`/`route.query` 的逻辑;`useRoute()` mock
(`:40`)每次返回 `{ query: routeQuery }`,`routeQuery` 对象本身只在 `beforeEach`
里被清空,从未被 `replace` mock 改写。

**结论**:「两次 replace 参数正确」这条断言,单独看确实**不能**证明"若实现依赖
`route.query` 在 replace 后被框架真正更新"这件事在测试环境里成立——因为 mock
根本不模拟这个更新。但这不是本实现的缺陷:本实现**完全绕开了这个依赖**,通篇只读/写
一个本地 `query` 副本,从不在第一次 `replace` 后回读 `route.query`。因此测试的
「mock 不改写」这一弱点,对**当前这份实现**不构成风险敞口——它是良性绕开,不是
侥幸通过。风险仅在于:若未来有人重构去掉本地副本、改成直接读 `route.query`,
这份测试**不会**告警(因为 mock 里 `route.query.search` 从头到尾都还在)。已用
RED 探针实测验证测试的实际判别边界,见下节。

## 2. RED 探针(两次,均已精确还原,`git status` 干净)

**探针 A(brief 建议的基础探针)**:去掉 skill 抹除的三行(`delete query.skill` +
对应 `router.replace`),只留 `store.pendingSkillId = String(skill)`。

```
Test Files  1 failed (1)
     Tests  2 failed | 36 passed (38)
 × ?skill=abc → 暂存 store.pendingSkillId,且立刻从 URL 抹掉 skill …
   expected "vi.fn()" to be called 1 times, but got 0 times
 × ?skill=abc&search=cats → … 两次 router.replace 串起来 …
   expected "vi.fn()" to be called 2 times, but got 1 times
```
与报告里贴的输出**逐字一致**。还原后重跑 38/38 绿,`git status` 干净。

**探针 B(本评审新增,专测顺序安全的判别力)**:在 skill 抹除块里让它**连带**删掉
`query.search`(`delete query.skill; delete query.search`),模拟"抹 skill 时误删了
不该删的 search"这个具体错误。

```
Test Files  1 failed (1)
     Tests  1 failed | 37 passed (38)
 × ?skill=abc&search=cats → …
   expected "wrappedAction" to be called 1 times, but got 0 times
   at expect(createSpy).toHaveBeenCalledTimes(1)
```

`?skill=abc&search=cats` 用例精确报红(因为 search 被误删导致 `seedSearch` 读到
空字符串,下面整个 seed 分支都不触发,`createSession`/`send` 全部落空)。**结论:
该用例对"顺序陷阱"型错误有真实判别力**,不是空转断言。还原后重跑 38/38 绿,
`git status` 干净。

## 3. `?skill=&message=` 组合

brief §2.1 只点名 `search`,实测未点名 `message`,测试文件里也**没有** `?skill=x&message=y`
的组合用例。逻辑上看代码(`query.message` 同样读本地副本,行为应与 search 分支
对称、结论应一致),不构成功能缺陷,但确属**测试覆盖缺口**——`search`/`message`
是"同一段"逻辑(brief 原话),只测了其中一个组合。判 Minor,不阻断。

## 4. 无关参数场景(`?tab=x` 无 skill/search/message)

`AgentPage.test.ts:175-184`(既有,未改动)的「one-shot:剥离 search/message 但保留
其它 query 参数不变」用例是 `routeQuery.search='cats'; routeQuery.tab='x'`
—— **这条测的是"search 场景下保留无关参数"，不是"仅有无关参数、无 skill/search/
message 时是否调用 replace"**。本次新增的「无任何一次性 query 参数时不调用
replace」(:218-224)用的是**完全空** `routeQuery`,同样没覆盖"仅 `tab=x`,三个
相关键都不存在"这个中间态。读实现代码:`skill`/`seedSearch`/`seedMessage` 三个
判断只认这三个键,`tab` 不触发任何分支,逻辑上安全,不会误触发 replace。判 Minor
覆盖缺口,非功能缺陷。新逻辑没有弄坏 :183 那条既有用例(读取:该用例三个断言与
diff 前完全一致,未被本提交触碰)。

## 5. 既有用例零删除零削弱

对照 diff:`?search=`/`?message=` 全部既有用例(:109-184)逐行未改动。唯一被改写的
是 `?skill=abc → 暂存…不触发发送`,原断言 `expect(replace).not.toHaveBeenCalled()`
断言的正是修复前的缺陷行为,与修复后行为矛盾。协调者预核结论（该断言被"原地扩写"
为新行为、核心断言 `sendSpy).not.toHaveBeenCalled()` 保留、原 `replace 未调用`
移入新的"无 query 参数"用例）**经本评审逐行核对确认无误**：新用例
`:218-224` 里 `expect(replace).not.toHaveBeenCalled()` 与
`expect(store.pendingSkillId).toBeNull()` 完整保留了原不变式的语义。**未削弱**。

## 6. 申报三件套

`AgentPage.vue:267-285` 注释完整:引用 Vue2 `Agent.vue:145-148`、指出与紧邻
`?search=`/`?message=` 成例的对比（含行号）、说明按"逻辑照正确"纪律修正、说明
本地 `query` 副本的必要性（mock 不回写 + 真实 vue-router 异步更新两条理由都写了）。
报告 `p3a-post-skillurl-report.md` §7 单列此偏离，三件套齐全。

## 7. 三门实测(独立跑,非采信报告)

```
pnpm test                  → Test Files 291 passed (291) / Tests 2418 passed (2418)
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → exit=0, built in 11.99s，仅既有 >500KB chunk 警告
```
子集 `AgentPage.test.ts` 单跑：38/38 绿。与报告数字完全一致，无红项，无 flaky
（`persist.test.ts` 本次未触发）。

## 8. 判定

- 规格符合：✅
- 代码质量：通过
- Critical: 0 · Important: 0 · Minor: 2（`?skill=&message=` 组合未测覆盖；
  "仅无关参数 `tab=x`、无 skill/search/message" 场景未单独测覆盖，两条均为覆盖
  缺口，非功能缺陷）
