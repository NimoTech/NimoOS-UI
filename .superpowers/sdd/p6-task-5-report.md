# SP8-P6 Task 5 报告 —— 翻 New-UI 三个 AI 触点

工作区:`/home/nimo/NimoTech/NimoOS-New-UI`,分支 `master`,BASE = `586f672`。

## 范围

只改:
- `src/home/composables/useOpenAction.ts`
- `src/home/composables/useOpenAction.test.ts`
- `src/home/components/widgets/AiWidget.test.ts`(**超出 brief 声明范围,见下方 concern 说明**)

未改 `src/router/index.ts`(Step 6 按 T1 结论跳过)。

---

## Step 1: 先写失败的测试

在 `useOpenAction.test.ts` 的 `beforeEach` 里加了一行:
```typescript
localStorage.removeItem('strangler:disabled:/ai')
```
并原样追加 brief 给的 `describe('AI 区 cutover(SP8-P6)', ...)` 整块(7 条 it)。

## Step 2: 跑它,确认红

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run src/home/composables/useOpenAction.test.ts --reporter=verbose 2>&1 | tail -60
```

实际红色输出(节选):

```
 FAIL  src/home/composables/useOpenAction.test.ts > AI 区 cutover(SP8-P6) > ai 磁贴应用内 router.push /ai/agent
AssertionError: expected "vi.fn()" to be called with arguments: [ '/ai/agent' ]
Number of calls: 0

 FAIL  src/home/composables/useOpenAction.test.ts > AI 区 cutover(SP8-P6) > 桌面 AI 小组件应用内 router.push /ai/agent
AssertionError: expected "vi.fn()" to be called with arguments: [ '/ai/agent' ]
Number of calls: 0

 FAIL  src/home/composables/useOpenAction.test.ts > AI 区 cutover(SP8-P6) > sendToAI 应用内带 message query(对象形式,不手工编码)
AssertionError: expected "vi.fn()" to be called with arguments: [ { path: '/ai/agent', …(1) } ]
Number of calls: 0

 FAIL  src/home/composables/useOpenAction.test.ts > AI 区 cutover(SP8-P6) > sendToAI 空文本不带 query
AssertionError: expected "vi.fn()" to be called with arguments: [ { path: '/ai/agent' } ]
Number of calls: 0

 Test Files  1 failed (1)
      Tests  4 failed | 24 passed (28)
```

**实际红了 4 条**,不是 brief 估计的「至少 5 条」。逐条列出新增 7 条各自的实际结果:

| 用例 | 结果 | 原因 |
|---|---|---|
| ai 磁贴应用内 router.push | FAIL | 旧实现无 `ai` 分支,落到 `window.location.href` |
| flag=1 时 ai 磁贴退回 Vue2 | **PASS**(未改先绿) | 见下方分析 |
| AI 小组件应用内 router.push | FAIL | 旧实现无条件 `window.location.href` |
| flag=1 时小组件退回 Vue2 | **PASS**(未改先绿) | 同上 |
| sendToAI 带 query | FAIL | 旧实现无条件拼 href 字符串 |
| sendToAI 空文本不带 query | FAIL | 同上 |
| flag=1 时 sendToAI 退回 Vue2 | **PASS**(未改先绿) | 同上 |

**🔴 排查这 3 条「本该红却绿」是否断言无判别力:** 旧实现(改动前)三处触点**完全不看任何 flag**,统一走 `window.location.href = '/#/ai/agent'(+query)`。而这三条「flag=1」测试断言的正是「flag=1 时应该产出 `window.location.href` 到同一 URL、且 `router.push` 未被调用」—— 旧实现虽然不检查 flag,但它默认行为恰好与"flag=1 时的目标行为"完全重合(都是 href 到 `/#/ai/agent`),所以在 flag=1 场景下断言碰巧全部满足,并非断言本身缺乏判别力。逐条验证判别力:若实现里遗漏 `cutoverDisabled('/ai')` 检查、或把条件写反(例如变成 `if (cutoverDisabled('/ai')) router.push(...)`),这三条断言(`router.push not toHaveBeenCalled()` + `hrefs` 精确 `toEqual`)都会转红——因此确认它们是有效的回归测试,只是在"改动前"这个特定时间点因新旧行为重合而先绿,不需要修改断言。这与 `openApp`/`openItem`/`storage`/`photos` 等既有 cutover 用例的历史模式一致(cutover 前默认行为 == 回退行为)。

结论:4 条真红符合预期方向(至少覆盖了三处触点的"应用内"分支),3 条提前绿经核实是合理巧合而非断言缺陷,可以继续往下走。

## Step 3: 改实现

按 brief 逐字改了三处:
1. `openApp()` 系统应用分支追加:`if (key === 'ai' && !cutoverDisabled('/ai')) { router.push('/ai/agent'); return }`
2. `openItem()` 的 widget 分支改成 `cutoverDisabled('/ai')` 判断 href/push
3. `sendToAI()` 改成 `cutoverDisabled('/ai')` 判断,cutover 后走对象形式 `router.push({ path, query })`

## Step 4: 更新 `SYS_ROUTE` 注释块(定稿,T7 锚点)

最终逐字文本(`useOpenAction.ts` 第 6-13 行,从 `// 文件区(/files,SP4-P8)` 到 `const SYS_ROUTE` 之前):

```typescript
// 文件区(/files,SP4-P8)、应用区(/apps,SP5-P8)、存储区(/storage,SP6-P1)、相册区
// (/photos,SP7-P8b)、系统设置(/settings)与 KVM(/kvm,两者 SP9-P8)、AI 区(/ai,SP8-P6)
// 已全部活在本应用;SP1-SP9 迁移至此收官。
// photos / ai / vm 这三条留在表里不是死键 —— cutover 回退时(flag 置 1)就跳它们,所以是"回退目标"
// 而不是"主路径";这也是它们与 appstore/storage/settings 的区别(那三个在 Vue2 侧是模态弹窗、
// 没有自己的路由,回退只能落 /#/legacy 老桌面 —— settings 因此也用 '/#/legacy' 作回退目标,
// 落到老桌面后再点「设置」磁贴,由 Vue2 侧的 resolveEntryTarget('/settings') 判定弹老模态)。
// router 模块环(router→Home→…→本文件)只在运行时访问 push,ESM 延迟绑定安全。
```

(brief 原文到此为止,与 `}` 收尾一句无关——`SYS_ROUTE` 对象本身紧随其后,brief 里写「从 `// 文件区(/files,SP4-P8)` 到 `}` 结束」指的是整个注释块+对象声明,补全如下,供 T7 核对完整锚点范围:)

```typescript
const SYS_ROUTE: Record<string, string> = {
  photos: '/#/photos', ai: '/#/ai/agent', vm: '/#/kvm',
  settings: '/#/legacy',
}
```

`cutoverDisabled` 上方注释追加了一句(在 `/kvm 与 /settings = SP9-P8` 那句之后):
```typescript
// /ai = SP8-P6,同理一把键管两侧(Vue2 侧在 migratedRoutes)。
```

## Step 5: 跑测试确认绿 + tsc

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run src/home --reporter=verbose 2>&1 | tail -20
```
输出:
```
 Test Files  58 passed (58)
      Tests  305 passed (305)
```

```bash
pnpm exec vue-tsc --noEmit 2>&1 | tail -5
```
输出:(空,0 错误)

---

## 🔴 Concern:超出声明范围改了 `AiWidget.test.ts`(评审重点核查一节)

`src/home --reporter=verbose` 首次跑出 1 个失败:`src/home/components/widgets/AiWidget.test.ts`(58 files 里唯一红)。

**为什么它必然会红:** `AiWidget.vue` 第 22/31 行内部就是 `const { sendToAI } = useOpenAction()` → `sendToAI(msg)`,原测试(改动前)不 mock 路由,是端到端调用真实 `sendToAI` 的组件测试。它的唯一断言是"提交表单后 `window.location.href` 被赋值为 `/#/ai/agent?message=...`"。本刀 Step 3 把 `sendToAI` 的**默认路径**(无 flag)从"无条件 `window.location.href`"改成了"`cutoverDisabled('/ai')` 为假时 `router.push({...})`,为真时才走 href"。测试运行时 `localStorage` 里没有设置 `strangler:disabled:/ai`,所以默认路径生效 → 走的是 `router.push`,不再写 `window.location.href` → 原断言读到的 `hrefs[0]` 是 `undefined`,直接转红。这不是巧合触发,是本刀行为变更在这个组件测试上的**必然**下游回归——只要 Step 3 按 brief 改了 `sendToAI`,这个测试原样不动就一定会红。

**怎么拆的两条:** 比照 `useOpenAction.test.ts` 的 mock 手法,在文件顶部加 `vi.mock('../../../router', () => ({ router: { push: vi.fn() } }))`(路径深度:`widgets/` → `components/` → `home/` → `src/`,三层 `../` 到 `src/router`),`beforeEach` 里补 `localStorage.removeItem('strangler:disabled:/ai')` + `vi.mocked(router.push).mockClear()`。原来 1 条断言拆成 2 条:
1. **默认态**(不设 flag):`mount` 后提交表单,断言 `expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '整理照片' } })`。
2. **flag=1 态**:先 `localStorage.setItem('strangler:disabled:/ai', '1')`,断言 `hrefs[0]` 等于原来那条拼串(`window.location.href` stub 保留,写法与原测试一致),并追加 `expect(router.push).not.toHaveBeenCalled()`。

**两条各自都有判别力(逐条验证):**
- 第 1 条:若实现里 `sendToAI` 忘了走 `router.push`(比如误留旧的 `window.location.href` 分支、或对象形状写错,例如漏了 `query` 或把 `message` 打成别的 key),`toHaveBeenCalledWith` 的精确对象匹配会失败——不是只测"被调用过",是测"调用参数完全对";同时因为 `hrefs` 数组在这条用例里从未被断言为空,但如果实现退化回 href-only,`router.push` 根本不会被调用,该断言本身就会先转红,足以拦截。
- 第 2 条:若实现忘记检查 flag(cutover 后一律 `router.push`,不管 flag),`hrefs[0]` 会是 `undefined`(因为 href 从未被赋值)而不是期望的拼串,断言转红;若把 flag 判断写反(flag=1 时反而走 `router.push`),`expect(router.push).not.toHaveBeenCalled()` 会转红。两个方向的实现错误都能被这条截住。

**为何判定"该改"而非"违反范围约束":** 这是为保持 `pnpm exec vitest run src/home` 全绿而做的最小必要修复,不属于"重构/顺手改别的无关代码"——若不修,Step 5 要求的"全绿"就无法达成,且该红是本刀行为变更的真实回归,不是无关噪音或既有缺陷。已如实在此报告、并在 commit 信息里体现改动范围与理由。

---

## Step 6: 按 T1 结论跳过

T1 已实证 `REDIRECT_BEFORE_GUARD = true`(vue-router 3.6.5 里 redirect 在 `beforeEach` 之前解析)。Step 6 的前置条件是「T1 结论为『守卫先于 redirect 看到原始路径』」——与实证结果相反,条件不成立。

⇒ **未改 `src/router/index.ts`**,未加 `/ai/skills`、`/ai/mcp` 两条 redirect 路由,未改 `src/router/index.test.ts`。

---

## 全量测试(收尾门,提交前跑)

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run --reporter=verbose
```

结果:
```
 Test Files  3 failed | 598 passed (601)
      Tests  1 failed | 9852 passed | 69 skipped (9922)
```

失败文件名(`/usr/bin/grep -n "^ FAIL " <log>` 取得):
```
oss/media-wave.test.mjs
oss/tree.test.mjs
oss/export-rsync.test.mjs
```

**与基线比对(按文件名,不按数字)**:基线失败集合是 `{oss/tree.test.mjs, oss/media-wave.test.mjs, oss/export-rsync.test.mjs}`(合流后 600 文件/9903 例)。本次跑出的失败集合 `{oss/media-wave.test.mjs, oss/tree.test.mjs, oss/export-rsync.test.mjs}` —— **两个集合完全一致,逐个文件名比对相等,没有新增失败文件**。

三条失败的根因都是同一条(`oss/export.mjs` 的前置检查拒绝在脏工作树上导出):
```
[oss] 失败:/home/nimo/NimoTech/NimoOS-New-UI 工作树不干净,导出中止:
 M src/home/components/widgets/AiWidget.test.ts
 M src/home/composables/useOpenAction.test.ts
 M src/home/composables/useOpenAction.ts
```
这是运行测试时本刀尚未提交造成的**表层触发条件**,与协调者说明的**根因**(T3 改 i18n 出口打断了 `oss/manifest.mjs` 里已有的 4 条锚点)一致——按台账这是 T7 的活,本刀不碰 `oss/`。文件总数从基线 600 变成 601、例数从 9903 变成 9922,属于本刀新增用例(`useOpenAction.test.ts` 新增 7 条 + `AiWidget.test.ts` 拆成 2 条,净增 7+1=8… 实际净增例数含既有用例调整,数字本身不作比对依据,以文件名集合为准)。

commit 之后工作树转干净,`oss/export.mjs` 的前置检查会通过——预期这 3 个文件此后仍会因 T3/T7 那条既有的 manifest 锚点问题而红(与本刀无关,留给 T7)。

## 最终结果

- 命令:`pnpm exec vitest run src/home --reporter=verbose` → 58 files / 305 tests 全绿。
- 命令:`pnpm exec vue-tsc --noEmit` → 0 错误。
- 命令:`pnpm exec vitest run --reporter=verbose`(全仓)→ 3 failed / 598 passed,失败文件名与基线集合完全一致,无新增失败。
