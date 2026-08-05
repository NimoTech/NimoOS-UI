# SP8-P3b Task 3 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 3 —— 沙箱 SSE 传输层

**Files:** 新建 `src/ai/services/skillTestTransport.ts` + `.test.ts`

**Consumes:** 共享包 `sseRequest`(`@nimotech/nimoos-service`)。
**Produces:**
```ts
export async function runSkillTest(
  skillId: string,
  prompt: string,
  signal: AbortSignal,
  onEvent: (ev: Record<string, unknown>) => void,
  onError: (e: unknown) => void,
): Promise<void>
```

**照 `src/ai/services/agentTransport.ts:21-39` 的形状写** —— 薄到不重实现任何鉴权 / 401 刷新 / `[DONE]` / 分帧逻辑(那些 `sseRequest` 已经全包了,先读一遍 `.sp8/NimoOS-Service/src/sse.ts` 确认)。

- 端点 `POST /v1/ai/skills/${encodeURIComponent(skillId)}/test`,body `{ prompt, network: false }`(逐字对 Vue2 `ai.js:205,216`)。
- **不加 `Language` 头** —— `runAgentRun` 加它是因为 Vue2 `agentStream.js` 加了;Vue2 `streamSkillTest` **没加**,不无端偏离。
- `.catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })`,拿到 `null` 直接返回(= 调用方主动 abort,或非 abort 异常已经报给 `onError`)。
- `!outcome.ok` → `onError({ status: outcome.status, body: outcome.errorBody })`。
- 本文件**不做事件语义**,每个事件原样交 `onEvent`。
- 文件头注释写明:**本期真机必 422** 的三段根因(Python `agent/main.py:2481-2484` 必填 provider 头 / Go `route/v2/skills_files.go:154-160` 不注入 / Vue2 也没送),并注明这是**已知待修的后端票,不是本文件的缺陷**。

`.test.ts` 用 `sseRequest` 的 `fetchImpl` 注入点 mock(先例 `.sp8/NimoOS-Service/src/sse.test.ts`;若本仓 `agentTransport.test.ts` 有更贴近的 mock 骨架,照它)。覆盖:正常多事件流逐条进 `onEvent` · 非 2xx → `onError({status, body})` 且 `onEvent` 零调用 · `AbortError` 静默(`onError` 零调用、不抛)· 非 abort 异常 → `onError` 收到该异常 · 端点 URL 与 body 正确(含 `network:false` 与 id 的 `encodeURIComponent`)· **不发 `Language` 头**(断言 headers 里没有它 —— 这条钉住"不无端偏离")。

**验收**:三门绿 · 报告说明 mock 骨架来源 · 报告确认 `sseRequest` 已覆盖哪些语义故本文件不重做。

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
