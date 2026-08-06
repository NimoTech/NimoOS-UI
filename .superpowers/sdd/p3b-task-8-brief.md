# SP8-P3b Task 8 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 8 —— `SkillsSection.vue` 接线

**Files:** 改 `src/ai/components/settings/sections/SkillsSection.vue` · 改 `.test.ts`

新增状态:`adding = ref(false)` · `saving = ref(false)` · `busy = ref<Record<string, boolean>>({})` · `createError = ref('')`。

1. **`+` 按钮**:填 `:119-121` 的占位注释,插在刷新按钮**之后**(Vue2 `:6-11` 顺序 refresh → `.sk-add-btn`),`class="sk-add-btn"`、`:title="t('aiSkAddSkill')"`、`AgentIcon name="plus" :size="15"`、`@click="adding = true"`。
   Vue2 `:10` 传了 `color="white"` —— **不照抄**(具名色违规),照 P3a Task 3 对 `SkillTile` 的处理:图标走 `currentColor`,由 T1 移植的 `.sk-add-btn { color: … }` 供色。**T1 必须确认这条规则里有 `color`;没有就在 T1 加并登记。**
2. **四个动作**(全部**单层取数**;Vue2 `:134,151,188` 三处都错):

```ts
async function onToggle(id: string, enabled: boolean) {
  busy.value = { ...busy.value, [id]: true }
  try {
    // 单层取数:后端 route/v2/skills.go:131 走 h.Get(c) 返回裸 skill JSON;
    // 共享包已剥掉 axios 层。Vue2 :151 的 `resp.data` 恒 undefined,
    // 于是 `if (idx !== -1 && updated)` 永假 —— 开关点了列表项不更新。
    const updated = (await service.ai.updateSkill(id, { enabled })) as Skill | undefined
    const idx = skills.value.findIndex((s) => s.id === id)
    if (idx !== -1 && updated) skills.value.splice(idx, 1, updated)
    toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
  } catch {
    toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
  } finally {
    const next = { ...busy.value }; delete next[id]; busy.value = next
  }
}
```
   - `onDelete(id)`:`await service.ai.deleteSkill(id)` → **204 无内容,不读返回值** → `skills.value = skills.value.filter(...)`;**仅当 `activeId === id`** 才落到剩余第一项(对 Vue2 `:168-170`);toast 用 `skill.system ? aiSkUninstalledName : aiSkDeletedName`(`{name}` 取删前抓的 `s?.name ?? id`,对 Vue2 `:171`);失败 `aiSkDeleteFailed` danger。
   - `onCreate(payload)`:`saving = true`、`createError = ''` → `const sk = (await service.ai.createSkill(payload)) as Skill | undefined`(**201 裸 skill**)→ `sk?.id` 有值才 push + `activeId = sk.id` + `adding = false` + toast `aiSkAddedName`;`catch (e)` → `createError = t(createSkillErrorKey(e))`,**弹窗不关**(用户可改后重试);`finally saving = false`。
   - `onTest()`:就地把 `activeId` 对应项 `last_used = 'Just now'`、`calls = (calls||0)+1`(对 Vue2 `:204-214`,但只在 TestPanel 报成功时才来 —— 见 T4)。**台账须写明这是乐观本地值,后端 `RecordRun` 零调用点,刷新即消失。**
3. **接线**:`<SkillDetail :skill="activeSkill" :busy="busy" @toggle="onToggle" @delete="onDelete" @test="onTest" />` · `<AddSkillModal v-model:open="adding" :saving="saving" :server-error="createError" @save="onCreate" />`(弹窗关闭时清 `createError`)。
   Vue2 `:65-70` 用 `v-if="adding"` 挂载;`SkModal` 是 `:open` 驱动的常挂组件 —— **两种写法都行,选一种并说明**(倾向 `v-if` + `:open="true"`? 不 —— 照 P2b 各 section 的既有写法,先 grep `ChannelsSection.vue` 怎么用 `SkModal` 的)。
4. Vue2 的 `console.error`(`:139,156,178,196`)**不照抄**(P3a 已定)。

`.test.ts`(mock 一律裸对象):`+` 按钮打开弹窗 · toggle 成功就地替换该项(**喂裸 skill**)· **喂 `{ data: skill }` → 断言列表项未被替换成信封对象**(钉住单层口径,同 P3a Task 6 的做法)· toggle 期间 `busy` 传给 SkillDetail 且结束后清 · toggle 失败弹 danger 且列表不变 · 删除后从列表消失 · **删的不是当前选中项时 `activeId` 不变**(钉住条件)· 删除失败列表存活 · 创建成功 push + 选中 + 关弹窗 + toast · 创建失败(喂 409 `skill already exists`)→ `createError` 是 `aiSkErrDuplicate` 的文案且**弹窗仍开**、列表不变 · `onTest` 只改当前项的 `calls`/`last_used`。

**验收**:三门绿 · 报告贴单层取数的 RED 探针(改回 `.data` → 精确报红)· 申报"console.error 不照抄"。

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
