# SP8-P4(MCP 分区)终审修复轮 —— 定向复审

- 复审者:sonnet,2026-07-31
- 范围:`69af8ed..HEAD`(HEAD=`99ee99a`),7 文件 / +220 行 -21 行
- 任务:只核终审 `p4-FINAL-review.md` 点名的 6 条(I1/I2/M2/M3/M5/M7)是否真的解决,
  以及修复 diff 有没有引入新问题。**未漫游到范围外。**
- 方法:不采信修复者报告的措辞本身,自己读生产代码 + 自己读测试断言 + 自己做 RED 探针
  (独立设计破坏点,不复述报告里的 diff 片段,跑完必须自己看到红,再精确还原、自己确认
  `git status --short` 干净)+ 自己跑三门。
- 仓库状态:复审全程零提交,`git status --short` 干净,`HEAD` 仍是 `99ee99a`。

---

## 逐条 verdict

### I1 —— ADDRESSED

`McpSection.test.ts` 用例 9 的 fixture 已改成「新建前已有 `[svc-a(1), svc-b(2)]` 且用户已点选
svc-b → 新建 → 第二次 `listMCPServers` 返回 `[svc-a, svc-b, srv(7)]`(7 落在末尾,对齐后端
`ORDER BY id` 升序)→ 断言 `.sk-name span` 精确等于 `'new-one'`」。

**我自己的 RED 探针**(独立设计,未使用报告里贴的 diff 文本,自己手改):
把 `McpSection.vue:209` 的单层取数改回 Vue2 式双剥壳
(`const id = (created as {data?:{id?:number}}|undefined)?.data?.id`),跑
`vitest run McpSection.test.ts SettingsPage.test.ts`:

```
FAIL … > 9. createMCPServer 返回裸 {id:7} → activeId 变 7(不是此前选中的项)…
AssertionError: expected 'svc-b' to be 'new-one'
Test Files  1 failed | 1 passed (2)
     Tests  1 failed | 52 passed (53)
```

精确报红,失败原因正是「双剥壳缺陷下 `id` 恒 undefined,`reload()` 的
`!activeId.value || !found` 兜底也不触发(svc-b 仍在新列表里)」——与终审 I1 描述的现实
后果完全吻合。**已用备份 `cp` 精确还原**,`git status --short McpSection.vue` 干净,还原后
重跑 `Test Files 2 passed / Tests 53 passed`。

`createMCPServer` 的 mock 形状本身没动,仍是裸 `{ id: 7 }`(非完整对象),符合公共约束 §4。
用例修改不影响其余任何既有断言(fixture 变化只加了两行 click/断言,尾部断言原样保留)。

**结论:该用例现在对 D1 第二处单层取数有真判别力。ADDRESSED。**

### I2 —— ADDRESSED(但需要记录一处方法论上的取舍,不构成缺陷)

新增 `SettingsPage.placeholder.test.ts`,用两个 `vi.mock` 同时模拟「把 mcp 加回
`DEFERRED_SECTIONS`」与「把 `SECTION_COMPONENTS.mcp` 映射改回 `SectionPlaceholder`」两处
**未来才会发生**的手动改动,不碰生产代码一行。

**四个子问题逐一验证:**

**a) 摘掉 `placeholderProps()` 有效分支,新用例会红吗?**
——**会**。我自己把 `placeholderProps()` 整个函数体替换成无条件 `return {}`(独立探针,未
抄报告文本),跑 `vitest run SettingsPage.placeholder.test.ts`:
```
FAIL … Errors 2 errors
SyntaxError: Invalid arguments (createCompileError …)
 ❯ Proxy._sfc_render src/ai/components/settings/SectionPlaceholder.vue:25:29
     25|  <h1 class="set-h1">{{ t(props.titleKey) }}</h1>
Test Files  1 failed (1) / Tests 1 failed (1)
```
（`titleKey`/`bodyKey` 变成 `undefined`,`t(undefined)` 直接抛错。）已还原,重跑
`Test Files 1 passed / Tests 1 passed`,`git status --short` 干净。

**b) 摘掉 `onSelect()` 的 deferred toast 分支,新用例会红吗?**
——**会**。我自己把 `if (DEFERRED_SECTIONS.includes(id)) { toast.show(...) }` 那段删掉,跑
同一测试文件:
```
FAIL … AssertionError: expected "wrappedAction" to be called with arguments: […]
Number of calls: 0
Test Files 1 failed (1) / Tests 1 failed (1)
```
已还原,重跑 `Test Files 1 passed / Tests 1 passed`,`git status --short` 干净。

**c) 「重定向 `McpSection.vue` 的 import 到 `SectionPlaceholder`」是否绕过了被测逻辑本身?**
——**没有绕过**。生产代码里真正被求值的判据是 `SECTION_COMPONENTS[id] !== SectionPlaceholder`
这条恒等比较,以及 `DEFERRED_SECTIONS.includes(id)`。测试没有 mock 这条比较式或
`placeholderProps`/`onSelect` 本身,只是替换了两个**输入**:①`sections.ts` 导出的
`DEFERRED_SECTIONS` 常量值,②绑定在 `SECTION_COMPONENTS.mcp` 键上的组件引用(通过重定向
`McpSection.vue` 的 import 指向 `SectionPlaceholder.vue` 的同一个模块实例,让恒等比较为真)。
`placeholderProps()`/`onSelect()` 两个函数体在测试里原样执行、原样求值 —— 这是替换依赖输入
(标准测试替身写法),不是 mock 被测函数本身。探针 a/b 已经用实测证明:摘掉真实分支,用例
必红;说明用例走的是真实分支代码,不是在验证 mock 桩子的行为。

**d) 有没有为了可测性改动生产代码的公开面?**
——**没有**。`git diff 69af8ed..HEAD` 里 `SettingsPage.vue` 的改动只有 M2 的两处注释重写
(逐行核对:`:30-34` 与 `:108-117`,均为纯注释文字,函数体 `placeholderProps()`/
`onSelect()` 的代码逻辑一字未动),没有新增 export、没有拆分 `<script>` 块、没有放宽任何
类型或参数。符合终审「不许为了可测而改生产代码公开面」的明令。

**结论:I2 的用例是在测真实生产路径,不是在测被 mock 架空的假路径。ADDRESSED。**

（唯一值得记录但不构成缺陷的一点:这个测试的可读性依赖较深的头注释解释「为什么两个
mock 要一起用」——理解成本比一般测试高,但作者已经写了详尽的头注释说明,可接受。）

### M2 —— ADDRESSED

自己读 `SettingsPage.vue:30-34` 与 `:108-117`:两处均已重写为「`DEFERRED_SECTIONS` 已清空
/ `SECTION_COMPONENTS` 里不再有任何映射到 `SectionPlaceholder`,该分支现在不会触发,但机制
保留供未来复用」,不再声称 mcp 是占位分区,与代码事实(`SECTION_COMPONENTS.mcp: McpSection`
真组件)一致。

### M3 —— ADDRESSED

自己 `grep -n "grad-sk-blue\|grad-sk-slate" src/ai/styles/tokens.scss`:
```
236:  --grad-sk-blue: linear-gradient(135deg, #5AC8FA, #007AFF);
242:  --grad-sk-slate: linear-gradient(135deg, #98A2B3, #475467);
```
`mcpServerVisual.ts:3` 已改成 `tokens.scss:236-242`,与实测行号吻合。附带修复的
`mcpServer.ts:54` `mc.go:355`→`mcp.go:355` 笔误也已核实修正(文件内其余处均为 `mcp.go`,
这一处此前确实少打一个 `p`)。

### M5 —— ADDRESSED

`McpSection.vue` 的 `watch(modalOpen)` 现在在 `!v` 分支里同时清 `saveError` 与
`editing.value = null`,覆盖点是 v-model 的单一汇合点 —— 我另外核实了 `McpServerModal.vue`
的 X 按钮 / `SkModal.vue` 的 `DialogRoot @update:open`(reka 的 Esc / 遮罩关闭内建走同一个
事件)都统一 emit `update:open`,最终都落到父组件 `modalOpen` 这一个 ref 上,因此
`watch(modalOpen)` 这一个钩子结构性地覆盖取消/X/遮罩/Esc 全部关闭路径,不只是被测的 X 按钮
路径。

**我自己的 RED 探针**(独立设计):把 `watch(modalOpen)` 里新加的 `editing.value = null` 删掉,
只留 `saveError.value = ''`,跑 `vitest run McpSection.test.ts`:
```
FAIL … > 13. 编辑弹窗取消关闭(X 按钮,非保存路径)…
AssertionError: expected {…, id: 1, name: 'svc-a', …} to be null
Test Files 1 failed (1) / Tests 1 failed | 22 passed (23)
```
精确报红。已还原,重跑 `Test Files 1 passed / Tests 23 passed`,`git status --short` 干净。

### M7 —— ADDRESSED

自己 `grep -n -i "white\|black\|#[0-9a-fA-F]\{3,6\}\|rgba\?("
src/ai/components/settings/mcp/McpServerDetail.vue`:**零命中**(exit=1)。头注释与模板内联
注释里的 `color: white` / `color="white"` 引证已全部改写成「自带前景色声明」这类中文描述,
不再照抄颜色字面量,包括注释行(color-guard 本来就不扫这个文件,但按公共约束 §6 注释纪律
仍要求,已满足)。

---

## 修复 diff 范围内的新破坏

**None.** 逐文件核对 `69af8ed..HEAD` 的完整 diff(7 文件全看过,含 `-` 行):

- `McpServerDetail.vue`:只有头注释与模板内联注释文字重写(M7),无代码行改动。
- `McpSection.test.ts`:用例 9 的 fixture 被替换(旧的两行 `mockResolvedValueOnce` 换成新的
  两行),但**最终断言 `.toBe('new-one')` 原样保留**,只是前面加了「先点选 svc-b」的步骤 —
  这是加强不是削弱。新增用例 13,不影响既有用例。
- `McpSection.vue`:`watch(modalOpen)` 新增一行 `editing.value = null`(M5),纯增量,原有
  `saveError.value = ''` 未动。
- `mcpServer.ts` / `mcpServerVisual.ts`:纯注释文字修正(M3),零代码改动。
- `SettingsPage.vue`:纯注释文字重写(M2),`placeholderProps()`/`onSelect()` 函数体逐字
  未变(已逐行比对,见上文 I2-d)。
- `SettingsPage.placeholder.test.ts`:全新文件,只新增用例,不触及其它测试文件。

没有发现既有断言被削弱、放宽或删除的情况。

---

## 我做的 RED 探针清单(全部独立设计、已跑通、已还原)

| # | 破坏点 | 独立设计(未照抄报告 diff) | 结果 | 还原确认 |
|---|---|---|---|---|
| 1 | I1:`McpSection.vue` create 单层取数改回双剥壳 | 是 | 用例 9 精确报红(1 failed/52 passed) | `git status --short` 干净,重跑 53/53 绿 |
| 2 | I2a:`placeholderProps()` 摘掉有效分支 | 是 | `SettingsPage.placeholder.test.ts` 报红(2 errors,`t(undefined)` 抛错) | 干净,重跑 1/1 绿 |
| 3 | I2b:`onSelect()` 摘掉 deferred toast 分支 | 是 | 同一用例报红(`showSpy` 0 次调用) | 干净,重跑 1/1 绿 |
| 4 | M5:`watch(modalOpen)` 删掉新加的 `editing.value = null` | 是 | 用例 13 精确报红(1 failed/22 passed) | 干净,重跑 23/23 绿 |

四次探针全部独立设计破坏方式(未直接套用报告里贴的 diff 文本,自己手改代码),结果与
修复者报告描述的现象**完全吻合**,且每次都用 `git status --short` 确认了精确还原。

---

## 我自己实测的三门(独立跑,非转述)

```
pnpm test                  → Test Files 303 passed (303) · Tests 2719 passed (2719) · exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm build                 → ✓ built in 11.96s · exit=0(仅既有 >500KB chunk / manualChunks 提示,无新增警告)
```

与修复者报告的 303/2719 完全一致。`git status --short` 全程干净,`HEAD` 仍是 `99ee99a`。

---

## 总判定

**可合并(Ready to merge)。**

6 条(I1/I2/M2/M3/M5/M7)全部 ADDRESSED,均已用独立 RED 探针实证(不是复述实现者的证据),
四条有生产代码行为可探测的(I1/I2a/I2b/M5)全部精确报红/报绿;两条纯注释修正
(M2/M3)自己 grep/核对属实;M7 自己 grep 确认零色字面量残留。修复 diff 范围内未发现新引入
的 Critical/Important 问题,也未发现既有断言被削弱或删除。三门 303/2719 全绿,与报告一致。
