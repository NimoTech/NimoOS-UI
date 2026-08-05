# SP8-P3b Task 6 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**。不要去读整份计划文件。

---

## Task 6 —— `SkillDetail.vue` 顶部条写操作 + 删除确认弹窗

**Files:** 改 `src/ai/components/settings/skills/SkillDetail.vue` · 改 `.test.ts`

**Consumes:** `SetSwitch`(`../SetSwitch.vue`)· `useCopyFeedback`(`../../../composables/useCopyFeedback`)· `service.ai.exportSkillURL` · T1 的 `pause` 图标与 `.sk-pill-more`/`.sk-menu` 样式。
**Produces:** props 新增 `busy: Record<string, boolean>`(默认 `{}`)· emits 新增 `toggle(id: string, enabled: boolean)` 与 `delete(id: string)`。

填 P3a 留的两处占位注释(**当前在 `:116-118` 与 `:123-126`,位置与顺序照注释,不得插错**):

1. **`.sw` 开关**(`.sk-name` 与 `.sk-pill-try` 之间):用 `SetSwitch`(它已渲染 `role="switch"` + `aria-checked` + `data-on`,与 Vue2 `:21-28` 等价),`:model-value="skill.enabled"`、`:disabled="!!busy[skill.id]"`、`:title="skill.enabled ? t('aiSkDisable') : t('aiSkEnable')"`、`@change="emit('toggle', skill.id, !skill.enabled)"`。
   ⚠️ `SetSwitch` 同时发 `update:modelValue` 和 `change` —— 只接 `@change`(与 P2a 各调用点一致),**不要**接 `v-model`(状态的真源是父组件的列表项)。
2. **`.sk-pill-more` + `.sk-menu`**(`.sk-pill-try` 之后):`menuWrap` 容器包按钮 + `v-if="menuOpen"` 的菜单,四项 + 一条 `<hr>`,逐字对 Vue2 `:37-55`:
   - 停用/启用(`pause` 图标,文案 `skill.enabled ? aiSkDisableTemporarily : aiSkEnable`)→ `closeAnd(() => emit('toggle', …))`
   - 复制 SKILL.md(`edit` 图标)→ `closeAnd(copyMarkdown)`
   - 导出技能(`download` 图标)→ `closeAnd(exportSkill)`
   - **危险项**(`trash` 图标,`data-danger="true"`)文案 `skill.system ? aiSkUninstall : aiSkDeleteSkill` → `closeAnd(() => confirmOpen = true)`,弹窗见 6.1 —— **同一任务内落地,不留点了没反应的控件**
- **外部点击关闭**:`watch(menuOpen)` 里挂/摘 `document` 的 `mousedown` 监听 + `menuWrap.contains(e.target)` 判定(对 Vue2 `:214-225`)。**挂载与摘除同步进行,`onBeforeUnmount` 必摘**(P1c1 Task 7 那个"await 后再挂监听 → 永不摘除的 capture 监听"是真泄漏,别复现)。
- **`skill.id` 变化**时复位 `menuOpen`(对 Vue2 `:226-229`)。
- **复制**:`useCopyFeedback().copy(skill.md ?? '', 'skillmd')` —— 它内部已走 `copyText`(非安全上下文 `execCommand` 兜底)+ toast + 打勾态。Vue2 `:243-253` 手写了一份兜底,本仓复用现成 composable(**偏离,申报**;若菜单项没有可挂打勾态的样式位,`copiedKey` 至少驱动文案 `aiCopied`)。
- **导出**:建 `<a>`,`href = service.ai.exportSkillURL(skill.id)`(token 走 `?token=` 兜底,后端 `route/v2.go:70-85` 的 `TokenLookupFuncs` 认 query token)、`download = (skill.name || 'skill') + '.tar.gz'`,`appendChild` → `click()` → `remove()`(对 Vue2 `:255-262`)。

### 6.1 删除/卸载确认弹窗(`.sk-confirm`)

**【协调者修订(开工时发现,取代设计 §9.3 的「用 SkModal」)】不套 `SkModal`,直接用 reka Dialog 原语**在本组件内拼出 Vue2 的确切 DOM。原因:`SkModal` 有三处对不上 —— ① 它强制渲染 `.sk-modal-head` 标题栏 + 关闭按钮,而 Vue2 的确认弹窗**没有标题栏**(标题是 `.sk-confirm-body` 里的 `<h3>`)② 它把默认插槽包在 `.sk-modal-body` 里,与 `.sk-confirm-body` 自带的 `padding: 22px 22px 8px` 叠加 ③ 它把 `.sk-modal` 类写死,加不上 `.sk-confirm`(`width: min(420px,100%)`)。硬塞需要给共享组件加三个开关,不值得。

直接用原语的写法:`DialogRoot` > `DialogPortal to=".set-app" defer`(**这条不可省** —— AI 区 token 定义在 `.agent-app` 作用域,portal 到 body 会让 `var(--bg-elevated)` 一类全部解析失败,见 `SkModal.vue` 头注释的 D1)> `DialogOverlay class="sk-modal-bg"` > `DialogContent class="sk-modal sk-confirm"`,并用 `<VisuallyHidden as-child><DialogTitle>` 提供无障碍标题(reka 要求 DialogContent 内有 DialogTitle;**仓库现成先例 `src/home/components/SearchDialog.vue:317`**)。这些类 `sk-shared.scss`(`.sk-modal-bg` :96 / `.sk-modal` :110 / `.sk-modal-foot` :139)与 `skills-styles.scss`(`.sk-confirm*` :730)都已就位。

内容对 Vue2 `:155-184` —— 标题(`skill.system ? aiSkUninstallTitle : aiSkDeleteTitle`)· 说明段(`skill.system ? aiSkUninstallBody : aiSkDeleteBody`,**内置那条是 D3 改过的实话文案**)· `.sk-confirm-skill`(`SkillTile` 28/8 + 名称 + `aiSkNPrevRuns`)· footer 取消 + `.sk-btn.danger`(文案 `skill.system ? aiSkUninstall : aiSkDelete`,`trash` 图标)。确认 → `confirmOpen = false` + `emit('delete', skill.id)`(对 Vue2 `:236-239`)。

`skill.id` 变化时同时复位 `confirmOpen`(对 Vue2 `:226-229` 复位了 `menuOpen` 与 `confirm` 两个)。

⚠️ **reka `DialogClose` 的事件顺序陷阱**:P1c1 Task 11 查过库源码 —— `AlertDialogAction`/`DialogClose` 模板硬编码 `@click="onOpenChange(false)"`,消费者的 `@click` 经 `$attrs` 落到同一 DOM,Vue `mergeProps` 合成 `[已有, 新来]` 顺序执行 → `update:open` 必先于自定义 handler。先读 `SkModal.vue` 确认它用的是哪个原语;若确认按钮不是 `DialogClose` 则无此问题。**照 `SourcesPage.vue` / `ChannelsSection.vue` 的既有写法,别自创。**

### 6.2 测试

`.test.ts`:**先改既有那两条「不渲染写操作控件(P3b 范围)」的用例**(`:57`、`:146`)—— 反转为正向断言,**不许直接删**。新增:开关反映 `enabled` 且点击 emit `toggle(id, !enabled)` · `busy[id]` 为真时开关禁用 · 菜单开合 · 菜单外部点击关闭 · 内置/用户技能的危险项文案不同 · 复制调 `copyText`(mock)· 导出的 `href`/`download` 正确(mock `exportSkillURL`,断言 `<a>` 被点击)· `skill.id` 变化同时复位菜单与确认弹窗 · 危险项 → 弹窗打开 · 确认 → emit `delete(id)` 且弹窗关 · 取消 → 不 emit · 内置 vs 用户两套标题/正文/按钮文案 · **内置正文不含「重新安装」字样**(钉住 D3)。

**验收**:三门绿 · 报告贴既有两条用例的**改前/改后**原文(证明是反转不是削弱)· 申报 useCopyFeedback 复用这条偏离。

---

---

# 附:计划的 Global Constraints(本任务隐含包含)

## Global Constraints

从 spec 抄来的硬约束,**每个任务隐含包含本节**:

1. **只动 `.sp8/NimoOS-New-UI` 一个仓**。Service 仓本期零改动。禁碰 `NimoOS-New-UI`(SP6)、`.sp7/`(SP7)、真机 `/var/lib`,不跑 `deploy.sh`。
2. **移植纪律(用户 2026-07-27 拍板)**:界面/视觉/交互严格 1:1 照 Vue2;逻辑/bug 不照抄,但偏离必须**三件套**齐全 —— ① 代码注释注明 Vue2 `file:line` 的问题 ② 实现者报告显式申报 ③ 台账登记。**未申报的偏离本身就是缺陷。** 禁与需求无关的重构/改名/换库。
3. **配色**:一切可见颜色必须 `var(--…)` token。禁 `#hex`/`rgb()`/`rgba()`/具名色(含 `white`/`black`)。**内联 `:style` 里的颜色同样违规。** 禁用 `theme-exception` 逃逸。新 token 必须在浅色与 `[data-theme="dark"]` 两块都有值。⚠️ `color-guard.test.ts` 只 glob `.vue`/`.css` —— **`.scss` 无自动化守卫,本期这批 scss 靠评审逐行人肉扫**。
4. **数据契约**:后端 `NimoOS-AI/route/v2/skills.go` 全是 `c.JSON(code, out)` 裸对象/裸数组,无信封;共享包 `service.ai.*` 已 `return res.data` 剥掉 axios 层 → **消费端单层取数**。测试 mock 一律裸对象/裸数组,写 `{ data: … }` 就是把缺陷编码进断言。
5. **代码范式**:`<script setup lang="ts">` · `useI18n()` from `'vue-i18n'` · 后端走 `import { service } from '@nimotech/nimoos-service'` · **import 一律相对路径**(本仓无 `@/` 别名)· 状态一律组件本地 `ref`,不新建 store · 组件里**零 `<style>` 块**(样式全在 `.scss`)· 用到的每个 CSS 类先 `grep` 确认存在。
6. **toast 真签名**:`show(text, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
7. **i18n**:新键**同时**加 `src/i18n/zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 断言键集一致)。值逐字照 Task 2 的表,**不许自行翻译、不许改标点**。文案里字面 `@` 写成 `{'@'}`(`messageSyntax.test.ts` 全键守卫会拦)。
8. **测试门(每任务提交前)**:全量三门,**输出完整落盘禁 `| tail`**(P3a 那条偶发红就是靠这条留下名字的):
   ```bash
   cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
   pnpm test                  > /tmp/p3b-test.log  2>&1; echo "exit=$?"
   pnpm exec vue-tsc --noEmit > /tmp/p3b-tsc.log   2>&1; echo "exit=$?"
   pnpm build                 > /tmp/p3b-build.log 2>&1; echo "exit=$?"
   ```
   已知噪声:`src/files/upload/persist.test.ts` 是既有 IndexedDB flaky,只它红就复跑一次并说明。
9. **算术备忘**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量用例数 +1**(本期新增 2 个 `.vue`)。
10. **禁空转用例**;无判别力的断言要做 **RED 验证**(故意弄坏 → 看到红 → 复原 → 看到绿,报告贴两段输出)。mock 骨架用 `vi.hoisted()`。异步断言用 `flushPromises()`,不用单个 `await nextTick()`。**不许削弱或删除既有断言**来让测试变绿。
11. 一个任务 = 一个语义提交。禁 `git add -A`/`git add .`,只许显式列路径;提交后 `git show --stat HEAD` 自查。不 rebase/reset/stash/merge/push。

---

---

# 附:权威源速查

## 权威源速查(所有任务共用)

| 用途 | 路径 |
|---|---|
| Vue2 组件蓝本 | `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/{SkillsSection,SkillDetail,AddSkillModal,TestPanel}.vue` |
| Vue2 样式蓝本 | `…/src/views/AI/Skills/skills-styles.scss`(782 行) |
| Vue2 语言包 | `…/src/assets/lang/{zh_CN,en_US}.json`(en_US **大量缺键** → Vue2 回落显示 key 本身,故英文档取 key 字面量) |
| Vue2 SSE 蓝本 | `…/src/service/ai.js:204-258`(`streamSkillTest`) |
| 后端契约 | `/home/nimo/NimoTech/NimoOS-AI/route/v2/skills.go`、`route/v2/skills_files.go`、`service/skills_store.go` |
| 本仓 SSE 先例 | `src/ai/services/agentTransport.ts`(**照它的形状写 Task 3**) |
| 错误映射先例 | `src/ai/util/channelsFormat.ts:65-76`(`addBotErrorKey`) |
| 已评审通过的样板 | `src/ai/components/settings/sections/{BlacklistSection,ExecutionSection,MemorySection,ChannelsSection}.vue` |

---
