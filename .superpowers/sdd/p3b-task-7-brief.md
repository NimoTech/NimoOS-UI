# SP8-P3b Task 7 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 7 —— `SkillDetail.vue` D4 弹窗 + 挂 TestPanel

**Files:** 改 `src/ai/components/settings/skills/SkillDetail.vue` · 改 `.test.ts`

**Consumes:** T4 的 `TestPanel.vue` · T6 已加好的 `toggle` emit 与 `SkModal` 用法。
**Produces:** emits 新增 `test()`(把 TestPanel 的 `test` 往上转发)。

1. **D4:停用技能的「在对话中试用」**(收 P3a 挂账③):改 `tryInChat()` —— `skill.enabled === false` 时不跳转,开第二个 `SkModal`:标题 `aiSkTryDisabledTitle` · 正文 `aiSkTryDisabledBody` · footer `aiCancel` + `.sk-btn.primary`(`aiSkTryEnableAndTry`)。
   - 「启用并试用」→ `emit('toggle', skill.id, true)`,**等父组件把 `skill.enabled` 变成 `true` 后才跳转**。实现方式:发 toggle 后关弹窗,并 `watch(() => props.skill?.enabled)`,一次性地在 `true` 时 `router.push`(带一个 `pendingTry` 标志防止误触发);父组件 toggle 失败时 `enabled` 不变 → 不跳转(spec §9.4 要求)。**别用定时器等**。
   - `enabled === true` 时行为不变(直接 push,P3a 已实现)。
2. **挂 TestPanel**:填 `:166-167` 的占位注释 —— `<TestPanel :key="skill.id" :skill="skill" @test="emit('test')" />`,**夹在「描述」段与「SKILL.md」段之间**(Vue2 `:108-112`)。

`.test.ts`:反转 `:146` 那条 TestPanel 占位用例(断言 TestPanel 现在渲染在描述段与 SKILL.md 段**之间** —— 按 DOM 顺序断言,不只是「存在」)· 停用技能点试用 → 不 push、开 D4 弹窗 · 「启用并试用」→ emit `toggle(id,true)` 且此刻**未** push;把 prop 改成 `enabled: true` 后才 push(钉住 D4 的「成功才跳」)· toggle 失败(prop 不变)→ 永不 push · 取消 → 关弹窗且不 push、不 emit toggle · `enabled === true` 时点试用直接 push(P3a 既有行为未回归)· TestPanel 的 `test` 事件被向上转发。

**验收**:三门绿 · `pendingTry` 一次性语义的推演写进报告(不能出现「以后每次 enabled 变 true 都跳转」)· 申报 D4。

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
