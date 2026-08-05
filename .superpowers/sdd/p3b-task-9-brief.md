# SP8-P3b Task 9 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 9 —— 集成 + 全支线终审 + `:5288`

**Files:** 无生产改动(除终审修复轮)

1. 三门完整复跑,输出完整落盘;与基线 2418 + 各任务新增数做算术核对(含 color-guard **+2**),对不上就查。
2. 主题审计:`git diff 4bfabfc..HEAD` 里所有新增行零色字面量(`.scss` 也要人工扫,守卫不管);新增 token 双主题都有值;例外都登记了。
3. i18n:`parity` + `messageSyntax` 绿;新键**零死键**(每个键 grep 到消费方);`grep` 确认无重复定义。
4. 回归:P3a 的只读用例全绿且**一条未被削弱**;确认卡/reducer 等 P1 遗产回归绿。
5. **派一个 opus 终审 subagent** 读 `4bfabfc..HEAD` 全 diff,重点:① 8 段 scss 逐行对 Vue2 ② 五条拍板偏离(D2/D3/D4/D5 + 前端校验)是否三件套齐全 ③ 单层取数三处 ④ 监听/AbortController 的挂摘对称性 ⑤ 测试是否有空转/被削弱。
6. 修复轮:终审的 Critical/Important 一次性修完,再评审确认无新破坏。
7. 起 `:5288` dev server(**先 `ss -ltnp | grep 5288` 杀掉遗留 vite 进程** —— P3a 踩过"用户验到陈旧代码"),`curl -sI http://127.0.0.1:5288/app/` 确认 200。
8. 台账 + roadmap:登记全部偏离与挂账,**特别是沙箱那条**(本期不验收,后端票待补)。

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
