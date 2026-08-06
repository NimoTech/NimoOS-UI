# SP8-P4 Task 8 任务书

**先读**(顺序不可换,本文件与它们冲突时以它们为准):
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md` —— 公共约束,**你的行为准则**
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md` —— 设计文档,**权威**
   (公共约束 > 本任务书;设计文档 > 本任务书。发现冲突立即在报告里申报,不要默默选一边。)

## Global Constraints(计划原文,逐字)

- **工作区**:只写 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期 Service 仓与两个后端仓零改动。**
- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**);**逻辑 / bug 不照抄**,偏离必须三件套齐全(代码注释注明 Vue2 `file:line` + 报告申报 + 台账登记)。**未申报的偏离本身就是缺陷。**
- **一切可见颜色必须 `var(--…)` token**,禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算)。**内联 `:style` 里的颜色同样违规。** ⚠️ `color-guard.test.ts` **不扫 `.scss`**,Task 1 的配色无回归网。
- **单层取数**:共享包 `service.ai.*` 已 `return res.data`,消费端**不许再剥一层**。Vue2 的 `resp.data` 照抄即缺陷(设计 §3,本期命中 4 处)。
- **界面永不回显后端原文 / JSON**,一律走 i18n 键映射(先例 `util/channelsFormat.ts:65-76`)。
- **新 i18n 键双档同增**(`src/i18n/{zh_cn,en_us}.ts`),值逐字照本计划 Task 4 的表,**不许自行翻译、不许改标点**(含 `·` `…` `(` `)` 与中文逗号句号)。字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **状态一律组件本地 `ref`**,不新建 store。
- **组件里零 `<style>` 块**;用到的每个 CSS 类先 `grep` 确认存在。
- **toast 真签名**:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
- **每个任务跑全量三门**,输出完整落盘,**禁 `| tail`**。基线 **296 文件 / 2574 例绿 · tsc 0 · build 0**。
- 禁 `git add -A` / `git add .`,只显式列路径;禁 rebase / reset / stash / merge / **push**。一个任务 = 一个语义提交。

## File Structure(全期文件落点,供你定位自己的位置)

| 文件 | 责任 | 任务 |
|

---

## Task 8: `McpServerModal.vue`

**Files:**
- Create: `src/ai/components/settings/mcp/McpServerModal.vue`
- Test: `src/ai/components/settings/mcp/McpServerModal.test.ts`

**Interfaces:**
- Consumes: `McpServer` / `McpParsed` / `McpServerFormPayload`(T2)· `parseCommandErrorKey`(T3)· `SkModal`(`../SkModal.vue`)· `AgentIcon` · `service.ai.parseMCPCommand`
- Produces:
  ```
  props: { open: boolean; server: McpServer | null; saving: boolean; serverError: string }
  emits: { 'update:open': (v: boolean) => void
           save: (payload: McpServerFormPayload) => void }
  ```
  **注意与 Vue2 的接口差异(要申报)**:Vue2 是 `v-if="modalOpen"` + `@close`;本仓照 P3b `AddSkillModal` 先例改成 `v-model:open` 常挂(理由见下),并新增 `serverError` prop 承载保存失败的行内报错(Vue2 是把保存失败塞进 toast,偏离 D5 要求改行内)。

**蓝本:** Vue2 `McpServerModal.vue`(216 行)。**先读 `src/ai/components/settings/skills/AddSkillModal.vue`** —— 它是同款表单弹窗的既有实现,`v-model:open` + `watch(open)` 复位表单的写法照抄。

- [ ] **Step 1: 写失败的测试**

覆盖点(每条独立用例):

1. 新增态标题 `aiMcpSrvAdd`、编辑态标题 `aiMcpSrvEditTitle`(两次挂载对照)
2. **快速添加区只在新增态渲染**(编辑态 `.mcp-quickadd-row` 不存在)—— Vue2 `:9` 的 `v-if="!isEdit"`
3. 传输三选一:三个 `.sk-trig-option`,文案分别 `aiMcpSrvTransportHttp` / `Sse` / `Stdio`;点 STDIO 后 `data-active` 移到它身上
4. **字段按 transport 切换**:stdio → 有 `[data-f="command"]` / `[data-f="args"]` / `[data-kv="env"]`,**无** `[data-f="url"]` / `[data-kv="headers"]`;http → 反之。两次对照
5. `valid`:名称空 → 提交按钮 disabled;名称有值但 http 的 URL 空 → disabled;都有值 → enabled;stdio 下 URL 空但 command 有值 → enabled(**四条独立断言,不能只测一条**)
6. KV 编辑器:点「添加请求头」加一行;填 key/value;点删除按钮删该行;**空 key 的行在提交时被丢弃**(`collect` 的行为)
7. 提交 payload 形状 —— **stdio**:`{name, transport:'stdio', enabled, command, args:[…], env:{…}}`,`args` 由 textarea 按行 split + trim + 去空行;**http**:`{name, transport:'http', enabled, url, headers:{…}}`
8. **编辑态且无 KV 行时不带该字段**(Vue2 `:206,210` 的 `if (!isEdit || Object.keys(x).length)`)—— 对应后端 `applyReq` 的「只覆盖出现的字段」。两条对照:新增态即使空也带 `env:{}`;编辑态空则**不带** `env` 键
9. 编辑态且 `has_headers` 为真 → 显示 `.mcp-kv-hint`(`aiMcpSrvKvHint`);新增态不显示
10. **快速粘贴(单层取数钉子)**:mock `parseMCPCommand` 返回**裸 `Parsed`**;点「填充表单」后传输切到 stdio、command/args/env/名称都填上。若实现多剥一层 `.data`,这条红
11. 快速粘贴解析成 http:`url` 填上、`command`/`args`/`env` 清空
12. `suggested_name` **只在名称为空时**填入(两条对照:名称已填时不覆盖)
13. 解析失败 → `.mcp-quickadd-err` 显示 **本地化文案**,不含后端英文串
14. 解析中 → 按钮文案 `aiMcpSrvParsing` 且 disabled;`pasteCmd` 为空时按钮 disabled
15. `serverError` prop 非空 → 弹窗里渲染行内错误(位置与类名照实现,先 grep 既有行内错误类,先例 `.chan-field-err` / `AddSkillModal` 的写法 —— **自己 grep 确认真实存在,不许凭空造类名**)
16. `open` 由真变假再变真 → 表单复位(照 `AddSkillModal` 的 `watch(open)` 行为)

**mock 骨架**:
```ts
const h = vi.hoisted(() => ({ parseMCPCommand: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
```
**mock 必须是裸对象**:`h.parseMCPCommand.mockResolvedValue({ transport:'stdio', command:'npx', args:['-y','@upstash/context7-mcp'], env:{}, url:'', suggested_name:'context7' })`。
测 `SkModal`(reka Teleport)挂载后先 `await nextTick()` 再查 `document`;portal 目标 `.set-app` 要在测试里备好(照 T6 的做法)。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerModal.test.ts
```

- [ ] **Step 3: 写组件**

DOM 逐字照 Vue2 `:1-110`,套进 `SkModal`:
- Vue2 `:4-7` 的 `.sk-modal-head` → `SkModal` 的 `title` prop(它自带标题栏与关闭按钮)
- Vue2 `:8-97` 的 `.sk-modal-body` 内容 → `SkModal` 的默认插槽(**不要自己再包一层 `.sk-modal-body`** —— `SkModal` 已经包了,重复会 padding 叠加,P3b 踩过)
- Vue2 `:99` 的 `.save-note` → `SkModal` 的 `#footerLeft` 插槽
- Vue2 `:100-106` 的 `.right` 内两个按钮 → `#footer` 插槽(`SkModal` 已把它包进 `.right`,**不要自己再包 `.right`**)

其余要点:
- 内联 `style="font-family: var(--font-mono); font-size: 12.5px"` 与 `style="grid-template-columns: repeat(3, 1fr)"` 是字体/尺寸不是颜色,**照抄**
- `argsText` 的 placeholder 用 `&#10;` 换行,照抄
- **偏离 D1**:`parsePaste` 单层取数(注释注明 Vue2 `:166` 的 `(resp && resp.data) || {}` 在本仓恒 `{}`,**快速粘贴会永远静默填不进任何东西**)
- **偏离 D5**:`pasteErr` 走 `t(parseCommandErrorKey(e))`,不再读 `e.response.data.message`
- **N2 照抄不改**:非 stdio 分支**不清 `headers`**(headers 只属于 http/sse,保留用户已填的是正确的);stdio 分支清 `headers` 也正确。注释里写明这是有意照抄、不是遗漏
- **N1 照抄不改**:`valid` 要求名称非空,后端不要求。注释里写明判断依据(UI 级要求,不涉及任何转换,与 P3b 的 slugify 教训不同类)
- `nextTick` 后 focus 名称输入框(Vue2 `:156`)
- 零 `<style>` 块;用到的类先 grep

- [ ] **Step 4: 跑测试确认通过 + RED 探针**

RED 探针:把 `submit()` 里编辑态的 `if (!isEdit || Object.keys(h).length)` 改成无条件 `payload.headers = h` → 确认第 8 条对照用例精确报红 → 还原、`git status` 干净。

- [ ] **Step 5: 跑全量三门**

日志名 `p4-t8-*`。**新增 1 个 `.vue` → color-guard +1。**

- [ ] **Step 6: Commit**

```bash
git add src/ai/components/settings/mcp/McpServerModal.vue src/ai/components/settings/mcp/McpServerModal.test.ts
git commit -m "feat(ai): SP8-P4 T8 McpServerModal 表单弹窗(快速粘贴单层取数)"
```
