# SP8-P3b Task 1 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 1 —— 样式底座(写操作半)+ `pause` 图标

**Files:** 改 `src/ai/styles/skills-styles.scss` · 改 `src/ai/components/icons/AgentIcon.vue`

**Produces:** 下列 CSS 类可用 —— `.sk-add-btn` · `.sk-pill-more` · `.sk-menu` · `.sk-test` / `-head` / `-pill` / `-title` / `-sub` / `-body` / `-input` / `-result` · `@keyframes skill-pulse` · `.sk-trig-options` / `.sk-trig-option` · `.sk-color-row` / `.sk-color-dot` · `.sk-confirm` / `-body` / `-skill`;`AgentIcon` 支持 `name="pause"`。

### 1.1 移植范围(Vue2 `skills-styles.scss` 行号 → 落点)

| Vue2 行 | 选择器 | 落点 |
|---|---|---|
| 153-163 | `.set-app .sk-add-btn` | 就地替换 `skills-styles.scss:180` 那条「留给 P3b」注释 |
| 225-234 | `.sk-pill-more` | 就地替换 `:249` 注释(该注释同时管 3 段) |
| 260-288 | `.sk-menu` | 同上 |
| 392-507 | `.sk-test*` 全家 | 就地替换 `:361` 注释 |
| 508-513 | `@keyframes skill-pulse` | 同上 |
| 648-669 | `.sk-trig-options` / `.sk-trig-option` | 就地替换 `:455` 注释 |
| 670-685 | `.sk-color-row` / `.sk-color-dot` | 同上 |
| 754-773 | `.sk-confirm` / `-body` / `-skill` | 就地替换 `:460` 注释 |
| **235-259** | `.sw` | ❌ **不移植** —— 已在 `sk-shared.scss:66`(P2a Task 6) |
| **727-753** | `.sk-toast` + `@keyframes sk-toast-rise` | ❌ **永不移植**(P3a 已定:走全局 toast) |

**开工第一步**:对两条 ❌「已存在」自己 `grep` 确认(`sk-shared.scss`);若实际不存在,**停下报告**,不要自行补进本文件(会与 P2b 的归属冲突)。

### 1.2 颜色处理

逐行扫这 8 段里的色字面量,按优先级:① 接既有 token(先 `grep` `tokens.scss` 找语义匹配的)② 确属「皮肤无关装饰」才新增 token 并**在浅色与 dark 两块都给值** ③ 新增的例外登记进 `tokens.scss` 头部例外清单 + `docs/THEMING.md`。

已知需要留意的两处(**自己复核,别信这行**):
- `.sk-test-result .label[data-state="running"] .bullet` 的脉冲光圈用了 `rgba(...)`(Vue2 `:445-507` 区间)。
- `.sk-color-dot` 的选中环。`.sk-color-dot` 的**底色由组件内联 `:style` 传入** —— Vue2 `AddSkillModal.vue:61` 是 `:style="{ background: c.bg }"`,**本仓禁止**(内联颜色违规)。改为 `:data-color="c.id"` + SCSS 里 7 条 `[data-color=…] { background: var(--grad-sk-…) }`(7 个 `--grad-sk-*` token P3a Task 1 已建)。**这条偏离要三件套申报**,并在 T5 的组件里对应。

### 1.3 `pause` 图标

`AgentIcon.vue` 的图标表里新增一条 `pause`,风格与相邻条目一致(20 单位 viewBox、`stroke="currentColor"` 走 `currentColor`,不传具名色)。两条竖杠即可,例:
```
pause: '<path d="M7 4v12M13 4v12"/>',
```
放在图标表里字母序/语义相邻处;**不改任何既有图标的路径数据**。

### 1.4 验收

- `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|\b(white|black|red)\b' src/ai/styles/skills-styles.scss` 的新增行零命中(既有豁免行不算)。
- 三门全绿(本任务不新增 `.vue`,用例数应与基线 **2418 持平**;若有变动必须解释)。
- 报告列出:8 段各自的 Vue2 行号 → 本文件行号对照 · 每个色字面量的处理方式 · 新增/复用的 token。

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
