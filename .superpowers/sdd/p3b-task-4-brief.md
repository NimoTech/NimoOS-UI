# SP8-P3b Task 4 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 4 —— `TestPanel.vue`

**Files:** 新建 `src/ai/components/settings/skills/TestPanel.vue` + `.test.ts`

**Consumes:** T2 的 `initSandboxState`/`reduceSandboxEvent` · T3 的 `runSkillTest` · T1 的 `.sk-test*` 样式 · T2 的 `aiSkTest*` 键。
**Produces:** props `{ skill: Skill }` · emit `test`(仅成功完成时发,`SkillsSection` 用它 +1 计数)。

界面严格 1:1 对 Vue2 `TestPanel.vue`(182 行):`.sk-section` 段头(标题 + hint)· `.sk-test` 卡片 · `.sk-test-head`(`Sandbox` 药丸 + 标题/副标题 + 停用时的 `.sk-item-off` 角标)· `.sk-test-body`(`.sk-test-input` = textarea `rows="2"` + 运行按钮)· 示例提示词区(仅 `idle` 且无步骤无错误且 `skill.examples` 非空时显示)· 三种结果态(running / done 成功 / done 失败)。

**状态**:`prompt = ref('')` · `state = ref<'idle'|'running'|'done'>('idle')` · `sandbox = ref(initSandboxState())` · `startedAt`(普通变量)· `ctrl: AbortController | null`。

**行为**:
- `canRun` = `prompt.trim()` 非空 且 `state !== 'running'`(对 Vue2 `:124-126`)。
- `onKeydown`:`Enter` + (`metaKey` 或 `ctrlKey`)→ `preventDefault()` + `run()`(对 Vue2 `:146-151`)。
- `run()`:置 `running`、重置 `sandbox`、记 `startedAt = Date.now()`、新建 `AbortController`,调 `runSkillTest(skill.id, prompt.trim(), ctrl.signal, onEvent, onError)`;
  - `onEvent`:`sandbox.value = reduceSandboxEvent(sandbox.value, ev, Date.now() - startedAt)`
  - `onError({status})`:`sandbox.value = { ...sandbox.value, error: t('aiSkTestHttpFailed', { status }) }`。**非 HTTP 形状**(拿不到 `status`)→ 用 `aiSkTestFailed` 兜底。**不显示后端 body**(承 P2b「错误不回显后端 JSON」,三件套申报)。
  - `await` 返回后若仍 `running` → 置 `done`(对 Vue2 的 `onClose` `:174-177`)。
- **失败文案**:`sandbox.error` 优先显示 reducer 从 SSE `error` 事件拿到的后端文本(那是人类可读串如 `sandbox timed out`,原样显示);HTTP 层失败才用本地化串。
- **计数(拍板 D5,三件套申报)**:仅当 `done && !error` 时 `emit('test')`。Vue2 `SkillsSection.vue:204-214` 是一点运行就 +1,而后端 `service/skills.go:352 RecordRun` 全仓零调用点、沙箱又必失败 → 双重谎报,不照抄。
- **清理**:`onBeforeUnmount` → `ctrl?.abort()`。**同时**保留对 `skill.id` 的 watcher 复位(对 Vue2 `:133-141`)—— 但注意 `SkillDetail` 挂它时带 `:key="skill.id"`(T7),组件会整体重建,**watcher 实际不会触发**,所以清理**必须**落在 `onBeforeUnmount`,不能只靠 watcher。
- 结果区的步骤行:`kind==='text'` 与 `kind==='tool'` 都照 Vue2 `.step-row` 渲染(Vue2 用同一种行 + `check` 图标,`:78-85`),`tool` 步的文本已含 `'→ '` 前缀。

`.test.ts` 覆盖:`canRun` 三态 · `Cmd+Enter` 触发运行而普通 `Enter` 不触发 · 运行中按钮文案变「运行中…」且禁用 · 多个 `message_delta` 渲染成**一行**(钉住 D2)· `tool_call` 单独一行 · SSE `error` 事件显示后端文本 · HTTP 失败显示带状态码的本地化串且**不含后端 body 内容** · 成功完成 emit `test` 一次 · **失败时不 emit**(钉住 D5) · 停用技能显示 `.sk-item-off` 角标但运行按钮仍可用 · 示例提示词点击写进 textarea · 卸载时 `abort` 被调用。

**验收**:三门绿(用例数 = 新增用例 + **color-guard +1**)· 零 `<style>` 块 · 用到的每个类先 grep 确认 · 报告申报 2 条偏离(D2 渲染 / D5 计数)+ HTTP 错误不回显 body。

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
