# SP8-P4 —— 公共约束(实现者与评审者都必须先读)

**任务 brief 与本文件冲突时,以本文件为准。**
**本文件与设计文档冲突时,以设计文档为准**(P3b 教训 5:协调者生成的任务书会漏抄设计文档)。

- 设计:`NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md`(@`b5be61f9`)
- 计划:`NimoOS-UI/docs/superpowers/plans/2026-07-31-vue3-migration-sp8-p4-mcp.md`

## 1. 工作区

- 可写:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期只动这一个仓。**
- 只读:`/home/nimo/NimoTech/NimoOS-UI`(Vue2 老仓,读蓝本与语言包)、
  `/home/nimo/NimoTech/NimoOS-AI`(后端契约)、`/home/nimo/NimoTech/.sp8/NimoOS-Service`(共享包签名)。
- **禁碰**:`/home/nimo/NimoTech/NimoOS-New-UI`(SP6)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7)。
- **不碰真机**:不跑 `./scripts/deploy.sh`,不写 `/var/lib`。**本期不动 NimoOS-AI 后端,也不动 NimoOS-Service**(设计已核实共享包 6 个 MCP 方法齐备且已单层化)。
- 禁用 `git add -A` / `git add .` —— 只许显式列路径;提交后 `git show --stat HEAD` + `git status` 自查。
- 一个任务 = 一个语义提交。**不要** rebase / reset / stash / merge / push。

## 2. 移植纪律(用户 2026-07-27 拍板,长期有效)

- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**)。
- **逻辑 / bug 不照抄**:Vue2 的缺陷、竞态、吞错改成正确逻辑,但必须三件套齐全:
  ① 代码注释注明「Vue2 原文 `file:line` 是什么问题、此处改成什么」
  ② 实现者报告里显式申报 ③ 台账登记(协调者据报告写)。
  **未申报的偏离本身就是缺陷。**
- 判据:「这条改动是在修一个**可复现的错误行为**吗?是 → 改并登记;否 → 照 Vue2。」
- 禁止与需求无关的重构 / 改名 / 换库 / 顺手优化。
- **brief 给的测试代码若与「1:1 照 Vue2」冲突,是测试错,不是实现让步**。发现冲突 → **立即申报**,不要默默让步。
- **brief/计划里标了「已核」的数据,评审仍须回权威源复核** —— 计划作者(协调者)也会错。

## 3. 本期已授权的偏离(照做,并按 §2 三件套申报)

用户拍板 2 条(D8 拆批口径 + 测试错误呈现)+ 承前期先例 6 条 + 协调者按硬约束自定 3 条:

1. **D1 单层取数 4 处** —— 共享包 `service.ai.*` 已 `return res.data`,后端全部裸返回。
   Vue2 的 `resp.data` 在本仓恒 `undefined`。命中:
   `McpSection.vue:74`(列表恒空)· `:117`(新建后不选中)· `McpServerDetail.vue:164`(**测试连接永远显示失败**)· `McpServerModal.vue:166`(**快速粘贴永远填不进东西**)。
2. **D2 `.sk-toast` 不移植**,改全局 `useToast().show`。Vue2 `McpSection.vue:33` 的 toast 模板**无条件渲染绿色 check 图标**,失败提示也顶个成功勾 —— 不照抄(承 P3a)。
3. **D3 `SkillIcon.vue` 不移植**,统一 `../../icons/AgentIcon.vue`(承 P3a)。
4. **D4 `console.error` 不照抄**(Vue2 4 处)—— 兄弟分区无此惯例,toast/行内错误已足够(承 P3a/P3b)。
5. **D5 HTTP 层失败不回显后端 body** —— 改「后端串 → i18n 键」映射(承 P2b/P3b;先例 `util/channelsFormat.ts:65-76`)。
6. **D6 弹窗外壳**:表单弹窗套 `SkModal`;删除确认**直接拼 reka 原语**(无标题栏、`.sk-modal` 要叠 `.sk-confirm`)。两种并存**必须在注释里写明理由**(承 P3b `SkillDetail.vue:14-22`)。
7. **D7 `+` 按钮不传具名色 `color="white"`**,由 `.sk-add-btn` 的 `--text-on-accent` 供色(承 P3b)。
8. **D8 测试错误改本地化 + 可折叠技术详情** —— 用户 2026-07-31 拍板。用 Python agent 的 `error_key`(4 值)映射本地化文案,`detail` 进默认折叠的 `<details>`;后端拼好的英文 `error` 串**一律不上界面**。新增一个 Vue2 没有的控件,是**已授权的界面偏离**。
9. **D9 状态圆点的内联 `:style` 颜色全部删除** —— Vue2 `McpServerDetail.vue:36-37`。本仓 `skills-styles.scss:365-376` 已有 `.sk-meta-cell .val .dot` 与 `.val[data-disabled="true"] .dot` 两态静态规则,DOM 逐字相同。**零新 token。**
10. **D10 `mcp-styles.scss` 的 6 处 rgba 换已有 token** —— 对照表见计划 T1 Step 2。**预期新增 token 数 = 0**;认为需要新 token 就停下写 `NEEDS_CONTEXT`。
11. **D11 测试在途切服务器的错配竞态** —— Vue2 `runTest` 无请求令牌,stdio 探测最长 100 s,期间切走会把旧服务器的结果写进新服务器面板。加单调递增 `reqSeq` 守卫。

**除这 11 条外的任何偏离都要先申报再做**;拿不准就在报告里写 `NEEDS_CONTEXT` 并停下。

## 3.5 明确「照抄、不改」的 5 条(P3b 教训 1 的反面 —— 别用力过猛)

**这些不是缺陷,改了就是回归。**

- **N1 表单要求名称非空,后端不要求**(`mcp.go` 对 name 零校验)。**照抄。** 与 P3b 的 slugify 事故不同类:那里的错误是「前端拿未转换的对象去测后端转换后才用的正则」,这里不涉及任何转换,只是一条 UI 级要求(无名服务器在列表里就是一条空白条目)。**不许因此新增任何前置校验,也不许把它删掉。**
- **N2 `parsePaste` 的 non-stdio 分支不清 `headers`**(stdio 分支清了)。**照抄。** headers 只属于 http/sse,解析成 http 时保留用户已填的 headers 是正确的。
- **N3 编辑态无法清空已有 headers/env**。**照抄。** Vue2 用 `.mcp-kv-hint`(「留空保持不变;填写则覆盖全部。」)明示了这个语义,对应后端 `applyReq` 只覆盖请求里出现的字段,是有意设计。
- **N4 搜索时右侧详情面板不跟着清空**(`activeServer` 在未过滤的 `servers` 上查)。**照抄**,与 `SkillsSection` 同款。
- **N5 `mcpparse` 永不返回 `"sse"`,但表单有 SSE 选项**。**照抄。** SSE 由用户手选,后端 `validateAndClean` 对 http/sse 同等对待。

## 4. 数据契约(最容易翻车)

后端 `NimoOS-AI/route/v2/mcp.go`,路由前缀 **`/v1/ai`**(不是 `/v2/ai` —— P3b 终审 M4 踩过)。

- `GET /mcp/servers` → **200 裸数组**(`:96`)
- `POST /mcp/servers` → **201 `{"id": <int64>}`**(`:121`)—— **不是完整对象**
- `PUT /mcp/servers/:id` → **204 无内容**(`:172`)—— 不许读返回值
- `DELETE /mcp/servers/:id` → **204 无内容**(`:190`)—— 不许读返回值
- `POST /mcp/servers/:id/test` → **200 裸对象**(`:355` `c.JSONBlob` 透传 Python agent);agent 不可达 → **502** `{ok:false,error:"agent unreachable"}`(`:351`,axios 会抛)
- `POST /mcp/servers/parse` → **200 裸 `Parsed`**(`:137`)

其它:
- `mcpDTO` 的 `has_headers` / `has_env` 只是布尔位,**密文永不下发**(`:62`)。
- `McpParsed.transport` **只会是 `"http"` 或 `"stdio"`**(`mcpparse.go:38,80`)。
- `test_server` 的 `error_key` 只有 4 值(`client.py:437,448,453,456`),`detail` 仅 `connect_failed`/`list_failed` 带。
- Go 的 nil slice 序列化成 `null` → `(s.args || [])` 这类兜底是**必要防御,不许删**。
- **测试 mock 一律裸数组 / 裸对象**;写 `{ data: … }` 就是把 §3 D1 的缺陷编码进断言。
  `createMCPServer` 的 mock 必须是 `{ id: 7 }` 而**不是**完整 server 对象。
- 「同一方法在两个测试文件里被 mock 成不同形状」= red flag,必有一处错。

## 5. 代码范式

- `<script setup lang="ts">`;`useI18n()` from `'vue-i18n'`;后端走 `import { service } from '@nimotech/nimoos-service'`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。从 `src/ai/components/settings/mcp/` 出发:
  图标 `../../icons/AgentIcon.vue` · 同级 `./McpServerGroup.vue` · 复用技能件 `../skills/SkillTile.vue` ·
  上级 `../SkModal.vue` · util `../../../util/…` · types `../../../types/…` · 应用级 store(toast)`../../../../stores/…`。
  从 `src/ai/components/settings/sections/` 出发:同级 mcp 组件 `../mcp/…`。
- 状态一律**组件本地 `ref`**,不塞 store、不新建 store。
- toast 真签名:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)—— 默认 1500,要 3000 得显式传。
- **用到的每一个 CSS 类都要先 `grep` 确认真实存在**。凭空造的类渲染成无样式,而单测永远抓不到。目标:组件里**零 `<style>` 块**。
- 样板参考(已评审通过):`sections/SkillsSection.vue`(McpSection 的孪生兄弟)· `skills/SkillGroup.vue` · `skills/SkillDetail.vue`(尤其 `:486-517` 的确认弹窗)· `skills/AddSkillModal.vue`(表单弹窗 + `v-model:open`)· 错误映射先例 `util/channelsFormat.ts:65-76`。
- **`SkModal` 已自带 `.sk-modal-body` 与底栏的 `.right`**,消费方不要再包一层(P3b 踩过 padding 叠加)。
- reka `DialogPortal` **必须 `to=".set-app"`** —— AI 区 token 在 `.agent-app`/`.set-app` 作用域(`tokens.scss:31`),portal 到 body 会让 `var(--…)` 全部解析失败,弹窗变透明底/错色。**这条已爆三次。**

## 6. 配色(硬约束)

- 一切可见颜色必须是 `var(--…)` token,**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算,虽然 color-guard 认不出)。
- `src/styles/color-guard.test.ts` **逐行扫 `.vue` 的 `<style>` 块且不跳注释行** —— 注释里也不许出现 Vue2 的原始色字面量,改写成「引 Vue2 `file:line` + 中文描述颜色」。
- **⚠️ color-guard 不扫 `.scss`**(P3a 用 RED 探针实证过)。**T1 那份 `mcp-styles.scss` 的配色纪律没有回归网,靠评审逐行人肉扫。** 同样的注释纪律在 `.scss` 里照样执行。
- **禁止用 `theme-exception` 逃逸**(豁免会延续到下一个 `;` 或 `}`,连带豁免后面真正的声明)。
- **内联 `:style` 里的颜色同样违规**(本期命中:`McpServerDetail.vue:36-37` 的状态圆点 → 偏离 D9)。尺寸/字体/布局的内联 style 不受限,**照抄**(本期有多处:`grid-template-columns: repeat(3, 1fr)`、`font-family: var(--font-mono); font-size: 12.5px`、`width: 18px; height: 18px`、`display: grid; place-items: center; padding: 28px 0`)。
- 新增 token 必须在浅色与 `[data-theme="dark"]` 两块都有值。**本期预期零新增 token。**

## 7. i18n

- 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 断言键集一致)。
- 值**逐字照计划 Task 4 的表**,**不许自行翻译、不许改标点**(含 `·` `…` 全角括号 `()` 与中文逗号句号)。
- 前缀统一 **`aiMcpSrv*`**。`aiMcp*` 已被 P1b 对话块占用、`aiCfgMcp*` 已被 P2b 令牌分区占用,**都不能复用**。
- 写之前 `grep` 确认键不存在(重复属性 = TS 错误);计划 §4.1 列的 8 个可复用键先 grep 确认值逐字相同再用。
- 值里的字面 `@` 写成 `{'@'}`(`messageSyntax.test.ts` 全键守卫会拦)。
- **T4 必须跑计划里那段程序化逐码点比对脚本** —— P3b 教训 4:标点错误肉眼看不出。
- 报告里列清「复用了哪些 / 新增了哪些 / 哪些是 Vue2 没有的新文案」。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p4-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p4-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p4-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集** —— 守卫散落在 `src/styles/color-guard.test.ts` 与 `src/i18n/{parity,messageSyntax}.test.ts`,只有全量能抓。
- **输出完整落盘,不许 `| tail`**(P2b 教训:一条红被 `tail -6` 截掉,失败用例名永久丢失)。
  报告里贴 `Test Files` / `Tests` 两行汇总 + 任何红项的**完整用例名**。
- 基线:**296 文件 / 2574 例绿 · tsc exit 0 · build 成功**(P3b 收官值 `7ecd1d3`)。
- **算术**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1**(与该组件自带用例数无关)。
  本期新增 4 个 `.vue`:T5(Group)· T6(Detail)· T8(Modal)· T9(Section)各 +1。**T1/T2/T3/T4/T7 不新增 `.vue`。**
- 已知噪声:`src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`(既有 IndexedDB flaky,P3a 已定性)· `AgentComposer.test.ts` 曾出现一次 vue-i18n teardown 竞态(P3b 记录)。只它们红就**复跑一次并说明**,不要顺手去改。
- `pnpm build` 只允许既有第三方包警告 + >500KB chunk 警告。

## 9. 测试质量

- **禁空转用例**:把生产代码里对应那行删掉还能过,就是空转。
- **无判别力的断言要做 RED 验证**:故意弄坏 → 看到红 → 复原 → 看到绿,报告里贴两段输出。
  典型高危:单元素数组上测 `.some`/`.every`、`not.toThrow()` 套异步、选择器在组件里根本不存在、
  **弱断言 `not.toBeNull()` / 只断言「存在」**(P3b 验收补丁 A1:两个错误键都非 null,弱断言抓不出报错键)。
- **凡是「A 与 B 二选一」的分支,必须两边都有对照用例**,不能只测一边。
- vitest mock 骨架用 **`vi.hoisted()`**(裸 `const` 放 `vi.mock` 之前会因 ESM 提升抛 TDZ ReferenceError;先例 `src/ai/stores/agentStore.test.ts:4-19`)。
- 异步断言用 **`flushPromises()`**,不要单个 `await nextTick()`(单个 nextTick 会读到 scheduler 未刷新的旧 props 而**假通过**)。
- 测 reka-ui Teleport 组件(`SkModal` / 确认弹窗),挂载后必须先 `await nextTick()` 再查 `document`,且 portal 目标 `.set-app` 要在测试里备好。
- **不许削弱或删除既有断言**来让测试变绿。T9 要**反转**(不是删除)`sections.test.ts:57-59` 与 `SettingsPage.test.ts` 的 19b 与收口守卫三处,报告里必须贴改前/改后原文。

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p4-task-N-report.md`,至少包含:
逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认)· 三门完整终值(含红项完整用例名与归属)·
i18n 复用/新增键清单 · **每一条偏离显式申报**(含 §3 那 11 条里本任务命中的)·
**§3.5 那 5 条「照抄不改」里本任务命中的,要说明确实照抄了**。

返回给协调者的只有 **≤15 行**:状态(DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)·
提交 sha · 一行测试结果 · 顾虑。

## 11. 评审者附加要求

- **评审最低 sonnet,禁 haiku**(haiku 在本期项目上误报过两次)。
- **不许采信实现者报告**:自己打开 Vue2 蓝本逐项对标记/类名/顺序/禁用条件、自己 grep、自己跑测试。
- **自己回权威源复核后端契约**(`NimoOS-AI/route/v2/mcp.go`、`pkg/mcpparse/mcpparse.go`、`agent/mcp_client/client.py`)—— 不许只信计划里抄的行号。
- i18n 值回 Vue2 生产语言包 `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` **逐字符复核**,含标点与省略号;并确认每个键在两档里都在、且没被定义两次。计划 §4.3 那 14 条「Vue2 没有的新文案」不在语言包里,按设计文档核。
- 用到的每个 CSS 类自己 grep 确认存在。**T1 的 `mcp-styles.scss` 要逐行扫色字面量**(无守卫)。
- **至少做一次独立 RED 验证**(不是复述实现者的):最小化破坏生产代码 → 确认对应用例精确报红 → 精确还原(`git status` 必须干净),评审里写明破坏了什么、已还原。
- 检查用例是否空转、既有用例是否被削弱/删除、提交是否只含本任务文件。
- **检查 §3.5 的 5 条有没有被「顺手修正」** —— 改了就是回归,按 Critical 报。
- **不许改仓库**(RED 探针除外且必须还原),**不许提交任何东西**。
- 评审全文写进 `.superpowers/sdd/p4-task-N-review.md`;返回给协调者 **≤25 行**:
  两个判定(Critical / Important 各几条)· 每条发现一行(带严重度)· RED 探针 + 已还原 ·
  自己实测的测试数字(红项要归属)。
