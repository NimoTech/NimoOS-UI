## Task 5: `ExecutionSection`（执行步数）

**Files:**
- Create: `src/ai/components/settings/sections/ExecutionSection.vue`
- Create: `src/ai/components/settings/sections/ExecutionSection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `execution` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: `service.ai.getMaxTurns()` / `service.ai.putMaxTurns(maxTurns: number)`；P2a 的 `SetSwitch`（双 emit 契约 `update:modelValue` + `change`）；`apiErrorMessage`（Task 4）
- Produces: i18n 键 `aiCfgSaving` / `aiCfgSaved` / `aiCfgSaveFailed`（**跨分区共用，本任务首次引入**，Task 7/12 直接用）

**Vue2 蓝本：** `sections/ExecutionSection.vue`（80 行）。Vue2 无既有测试。

### i18n（本任务新增 8 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgExecutionSteps` **复用 P2a 既有键** | `Execution steps` | 执行步数 | Execution steps |
| `aiCfgExecutionDesc` | `executionDesc` | 限制 Agent 处理单个任务时的最大步数,避免失控的长时间运行。 | Limit the maximum number of steps the Agent takes on a single task to avoid runaway long runs. |
| `aiCfgMaxStepsPerTask` | `Max steps per task` | 单次任务最大步数 | Max steps per task |
| `aiCfgExecutionBanner` | `The maximum number of steps…`（Vue2 那条长串） | Agent 处理一个任务时最多执行的步数(每次调用工具或模型算一步)。达到上限会暂停并给出「继续」按钮。设为无限可能更慢、更耗资源。 | The maximum number of steps the Agent runs for one task (each tool or model call counts as one step). When the limit is reached it pauses and shows a Continue button. Unlimited may be slower and use more resources. |
| `aiCfgUnlimitedSteps` | `Unlimited (no step limit)` | 无限(不限制步数) | Unlimited (no step limit) |
| `aiCfgMaxSteps` | `Max steps` | 最大步数 | Max steps |
| `aiCfgSaving` | `Saving…` | 保存中… | Saving… |
| `aiCfgSaved` | `Saved` | 已保存 | Saved |
| `aiCfgSaveFailed` | `Save failed` | 保存失败 | Save failed |

- [ ] **Step 1: 写失败的测试**

`ExecutionSection.test.ts`。**mock 骨架必须用 `vi.hoisted()`** —— 本仓是 ESM，`const ai = {…}` 后再 `vi.mock` 会因 import 提升抛 TDZ `ReferenceError`（P2a Task 5 踩过，先例见 `src/ai/stores/agentStore.test.ts:4-19`）：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getMaxTurns: vi.fn(),
  putMaxTurns: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { getMaxTurns: h.getMaxTurns, putMaxTurns: h.putMaxTurns } },
}))

import ExecutionSection from './ExecutionSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(ExecutionSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
```

用例清单（每条都写明断言对象与对照组，共 13 条）：

1. `max_turns: 25` → 挂载后数字输入框值 `25`、无限开关关、输入框可编辑。
2. `max_turns: 0` → **无限开关开**、数字输入框 `disabled`（对照组：第 1 条里不 disabled）。
3. `max_turns` 缺失 / 非数字（`{}`）→ 回落 `10`（Vue2 `v || 10`）。
4. `getMaxTurns` reject → 不抛、不弹 toast、显示默认 `10`（Vue2 mounted 是 `catch {}`，与 Blacklist 同理由静默）。
5. 打开无限开关 → 立刻 `putMaxTurns(0)`（Vue2 `@change` 里 `unlimited = v; save()`）。
6. 关掉无限开关（此时 steps=10）→ `putMaxTurns(10)`。
7. 数字框改成 `3` 触发 `change` → `putMaxTurns(3)`。
8. **归一化**：输入 `0` → `putMaxTurns(1)` 且输入框回显 `1`（Vue2 `Math.max(1, …)`）；输入 `2.7` → `putMaxTurns(2)`（`Math.floor`）；输入空 → `putMaxTurns(10)`（`Number('')||10`→ 注意 `Number('')` 是 0、`0||10` 是 10）。**这三条各一个用例**，因为它们锁的是三条不同分支。
9. 保存中显示「保存中…」、保存完显示「已保存」。
10. **「已保存」2 秒后自动消失**（逻辑修正，见 Step 3）：用 `vi.useFakeTimers()` 推进 2000ms 后断言文案变空串；同时断言 1999ms 时**还在**（防止把定时器写成 0ms）。
11. **保存失败弹 danger toast**（逻辑修正）：`putMaxTurns` reject `{response:{data:{message:'后端拒绝'}}}` → `toast.show('后端拒绝', 3000, 'danger')`，且「保存中…」复位。
12. 保存失败且无消息 → `toast.show('保存失败', 3000, 'danger')`。
13. 卸载后定时器不再触发（`vi.useFakeTimers()`，保存成功 → `w.unmount()` → 推进 3000ms → 断言无报错、`toast.show` 未被再调用）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/sections/ExecutionSection.test.ts`
Expected: FAIL —— 找不到组件文件。

- [ ] **Step 3: 加 i18n 键 + 实现组件**

`<script setup>` 部分（这是逻辑所在，逐字照用）：

```vue
<!--
  SP8-P2b Task 5 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/ExecutionSection.vue(80 行)。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai —— 与 Vue2 归属一致,不做
  store 集中。用户 2026-07-28 拍板。

  【逻辑修正 1】Vue2 `save()` 通篇没有 catch(ExecutionSection.vue:66-79):
  putMaxTurns 失败时 finally 把 saving 复位,用户看到「保存中…」一闪而过就没了,
  以为存上了,实际没存。这里补 catch + danger toast。
  【逻辑修正 2】Vue2 `savedAt` 一旦置上永不清零,「已保存」字样永久挂在页面上
  (即使之后又改了值没保存)。这里改成 2 秒后自动消失,并在卸载时清掉定时器
  (Vue2 连定时器都没有,不存在这个问题;新引入的定时器必须自己收尾)。
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'   // 路径按 Task 0 对账结论核实

const { t } = useI18n()
const toast = useToast()

const steps = ref(10)
const unlimited = ref(false)
const saving = ref(false)
const savedAt = ref(0)
let savedTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  try {
    const d = await service.ai.getMaxTurns()
    const v = Number((d as { max_turns?: unknown } | null)?.max_turns)
    if (v === 0) unlimited.value = true
    else steps.value = v || 10
  } catch {
    /* Vue2 ExecutionSection.vue:57 同样静默;失败时留默认 10 */
  }
})

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
})

function markSaved() {
  savedAt.value = 1
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedAt.value = 0 }, 2000)
}

async function save() {
  // 无限 → 0;否则取正整数(<1 归一为 1)。与 Vue2 :68-72 逐字一致。
  let value = 0
  if (!unlimited.value) {
    value = Math.max(1, Math.floor(Number(steps.value) || 10))
    steps.value = value
  }
  saving.value = true
  try {
    await service.ai.putMaxTurns(value)
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  } finally {
    saving.value = false
  }
}

function onToggleUnlimited(v: boolean) {
  unlimited.value = v
  void save()
}
</script>
```

模板：**逐行照搬 Vue2 `:2-38`**，只做两类机械替换 —— `$t('英文串')` → `t('新键名')`（映射见上表）、`<SkillIcon …>` → `<AgentIcon …>`（图标名不变：banner 里是 `refresh`）。结构清单（照此核对，一个不少）：

- `.set-inner` > `.set-page-head`（`h1.set-h1` + `p.set-desc`）
- `.sk-section` > `.sk-section-head`（`.sk-section-title` = 单次任务最大步数）
- `.sk-section-body` > `.set-banner`（`span.ico` 里 `AgentIcon name="refresh" :size="12"` + 说明长串）
- `.set-rows` > 两个 `.set-row`：① `.lbl` 无限开关 + `.val.end` 里 `<SetSwitch :model-value="unlimited" @change="onToggleUnlimited" />` ② `.lbl` 最大步数 + `.val.end` 里 `<input class="set-input num" type="number" min="1" step="1" v-model.number="steps" :disabled="unlimited" @change="save">`
- `<span class="set-actions"><span class="hint">{{ saving ? t('aiCfgSaving') : (savedAt ? t('aiCfgSaved') : '') }}</span></span>`

⚠️ `SetSwitch` 的 prop 是 `modelValue`（P2a Task 6 定的双 emit 契约），Vue2 写的是 `:value` —— 这是 Vue 2/3 的机械差异，不算偏离，但别写成 `:value` 否则静默失效。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/ai/components/settings/sections/ExecutionSection.test.ts`
Expected: PASS（13 例）

- [ ] **Step 5: 接映射表 + 全量测试门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/ExecutionSection.vue \
        src/ai/components/settings/sections/ExecutionSection.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 5: ExecutionSection(执行步数,补保存失败提示与已保存自动消失)"
git show --stat HEAD && git status
```

---

