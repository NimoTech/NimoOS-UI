# SP8-P4 Task 6 任务书

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

## Task 6: `McpServerDetail.vue`(不含测试连接)

**Files:**
- Create: `src/ai/components/settings/mcp/McpServerDetail.vue`
- Test: `src/ai/components/settings/mcp/McpServerDetail.test.ts`

**Interfaces:**
- Consumes: `McpServer`(T2)· `serverColor` / `transportLabel` / `SERVER_GLYPH`(T2)· `SkillTile` · `AgentIcon` · reka-ui `DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle`
- Produces:
  ```
  props: { server: McpServer | null }
  emits: { toggle: (id: number, enabled: boolean) => void
           edit:   (server: McpServer) => void
           delete: (id: number) => void }
  ```
  T7 会在**同一文件**里追加 `runTest` 与结果面板。

**蓝本:** Vue2 `McpServerDetail.vue:1-157`(**跳过 `:50-53` 的测试按钮、`:87-100` 的结果面板、`:158-171` 的 `runTest`——那是 T7**)。
**结构参考(先读):** `src/ai/components/settings/skills/SkillDetail.vue`,尤其 `:486-517` 的确认弹窗写法。

- [ ] **Step 1: 写失败的测试**

覆盖点(每条都要有独立用例):
1. `server === null` → 渲染 `.sk-detail-empty`,含 `.orb` / `.empty-title`(`aiMcpSrvPickHint`)/ `.empty-sub`(`aiMcpSrvPickSub`)
2. 有 server → 顶栏 `.sk-detail-bar` 含 `SkillTile`、`.sk-name` 里名称 + `<code>` 里 `HTTP`
3. `.sw[data-on]` 反映 `enabled`;点它 emit `toggle(id, !enabled)` —— **两项对照**:`enabled:true` 点出 `[id,false]`,`enabled:false` 点出 `[id,true]`
4. 元信息 4 格:`transport==='stdio'` 时**不渲染**「请求头」格(`v-if="server.transport !== 'stdio'"`);非 stdio 时渲染。用两次挂载对照
5. 状态格:`enabled` → `.val` 无 `data-disabled="true"` 且文案 `aiCfgEnabled`;`!enabled` → `.val[data-disabled="true"]` 且文案 `aiMcpSrvDisabled`。**并断言 `.dot` 上没有 `style` 属性**(偏离 D9 的钉子——Vue2 是内联 `:style` 上色,本仓靠 CSS)
6. stdio 配置区渲染「命令 / 参数 / 环境变量」三行,`args` 用空格 join;`args` 为空数组 → 显示 `aiMcpSrvNone`
7. 非 stdio 配置区渲染「端点 URL / 请求头 / 环境变量」三行;`has_headers` 真 → `aiMcpSrvConfiguredHidden`,假 → `aiMcpSrvNone`
8. 更多菜单:初始不渲染 `.sk-menu`;点 `.sk-pill-more` 后渲染;点「编辑配置」emit `edit(server)` 且菜单关闭;文档 `mousedown` 在菜单外 → 菜单关闭(用 `document.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}))`);**在菜单内 mousedown 不关闭**(对照)
9. 删除确认:点「移除服务」→ 菜单关、确认弹窗开(`await nextTick()` 后查 `document.body` 或 portal 容器);点「移除」→ emit `delete(id)` 且弹窗关;点「取消」→ 不 emit
10. 切换 `server.id` → 菜单与确认弹窗都关闭(`setProps` 后断言)

**reka Teleport 注意**:挂载时给 `attachTo` 一个带 `.set-app` 的容器,或在测试里创建 `<div class="set-app">` 挂到 `document.body`,否则 `DialogPortal to=".set-app"` 找不到目标。参考 `SkillDetail.test.ts` 既有做法,**先读它照抄**。挂载后必须先 `await nextTick()` 再查 `document`。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts
```

- [ ] **Step 3: 写组件**

DOM 逐字照 Vue2。要点:

- **偏离 D9**:`:36-37` 的 `:style="{ background: …, boxShadow: … }"` **整个删掉**,只保留 `.val` 上的 `:data-disabled`。颜色由 `skills-styles.scss:365-376` 的 `.sk-meta-cell .val .dot` 与 `.val[data-disabled="true"] .dot` 供。注释里写明:Vue2 `:36-37` 用内联 style 拼背景色与发光圈(含两个色字面量),本仓已有等价静态规则,DOM 结构逐字相同 —— **注释里不许写出那两个色字面量**
- **偏离 D6**:确认弹窗**不套 `SkModal`**,用 reka 原语拼(理由与 P3b `SkillDetail.vue:14-22` 完全同构:无标题栏、`.sk-modal` 要叠 `.sk-confirm`、`.sk-modal-body` 的 padding 会与 `.sk-confirm-body` 叠加)。**`DialogPortal to=".set-app"` 不可省** —— portal 到 body 会让 `var(--…)` 全部解析失败。无障碍标题照 P3b 的处理方式(读那份代码,照抄同款)
- **偏离 D3**:全部 `SkillIcon` → `AgentIcon`;`:121` 的 `color="white"` **不传**,由 `.sk-btn.danger` 的 CSS 供色(先 grep 确认 `.sk-btn.danger` 规则里有 `color`,没有就在报告里申报处理方式)
- 外部点击关菜单:Vue2 `:143-153` 是 `watch(menuOpen)` 里加/删 `document.mousedown` 监听 + `beforeDestroy` 兜底。本仓用 `watch` + `onBeforeUnmount` 等价实现,**行为 1:1**(包括「只监听 mousedown 不监听 click」)
- `watch(() => props.server?.id)` 重置 `menuOpen` / `confirm`(T7 会在这里再加 `testing` / `testView` / `reqSeq`)
- **不写 `console.error`**(偏离 D4)
- 零 `<style>` 块

- [ ] **Step 4: 跑测试确认通过 + RED 探针**

RED 探针(贴两段输出):把元信息里「请求头」格的 `v-if="server.transport !== 'stdio'"` 改成无条件渲染 → 确认第 4 条用例精确报红 → 精确还原 → 全绿、`git status` 干净。

- [ ] **Step 5: 跑全量三门**

日志名 `p4-t6-*`。**新增 1 个 `.vue` → color-guard +1。**

- [ ] **Step 6: Commit**

```bash
git add src/ai/components/settings/mcp/McpServerDetail.vue src/ai/components/settings/mcp/McpServerDetail.test.ts
git commit -m "feat(ai): SP8-P4 T6 McpServerDetail 详情面板(状态点内联 style 改 CSS)"
```
