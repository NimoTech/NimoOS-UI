## Task 6: `MemorySection`（AI 记忆）+ 共享包 `context_window` 类型修正

**Files:**
- Modify: `/home/nimo/NimoTech/.sp8/NimoOS-Service`（`putMemorySettings` 的 `context_window` 类型，见 D5）
- Create: `src/ai/components/settings/sections/MemorySection.vue`
- Create: `src/ai/components/settings/sections/MemorySection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `memory` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: `service.ai.getMemorySettings()` / `putMemorySettings(payload)` / `listUserMemory()` / `deleteUserMemory(id)`；`SetSwitch`；`apiErrorMessage`
- Produces: 组件 `MemorySection`；共享包类型 `context_window?: number | null`

**Vue2 蓝本：** `sections/MemorySection.vue`（159 行）+ **既有测试 `sections/__tests__/MemorySection.spec.js`（13 例，一条不许丢）**

### i18n（本任务新增 16 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgMemory` **复用 P2a 既有键** | `AI memory` | 记忆 | AI memory |
| `aiCfgMemoryDesc` | `memoryDesc` | 助手跨会话记住的、关于你的事实与偏好。记忆开启时，会在每次对话开始前注入到上下文中。 | Facts and preferences the assistant remembers about you across sessions. While memory is on, they're injected into the context at the start of every conversation. |
| `aiCfgCrossSessionMemory` | `Cross-session memory` | 跨会话记忆 | Cross-session memory |
| `aiCfgMemoryOffBanner` | `Memory is off — …` | 记忆已关闭 —— 不再记录或注入新内容。已有条目保留,仍可删除。 | Memory is off — nothing new is remembered or injected. Existing items are kept and can still be deleted. |
| `aiCfgEnableMemory` | `Enable memory` | 启用记忆 | Enable memory |
| `aiCfgEnableMemorySub` | `Facts the assistant remembers about you across sessions, injected…` | 助手跨会话记住的关于你的事实;记忆开启时会注入到每次对话中。 | Facts the assistant remembers about you across sessions, injected into every conversation while memory is on. |
| `aiCfgContextCompaction` | `Context compaction` | 上下文压缩 | Context compaction |
| `aiCfgContextWindow` | `Context window (blank = auto)` | 上下文窗口(留空=自动) | Context window (blank = auto) |
| `aiCfgAutoPlaceholder` | `auto` | 自动 | auto |
| `aiCfgSavedMemories` | `Saved memories` | 已保存的记忆 | Saved memories |
| `aiCfgLoadingEllipsis` | `Loading…` | 加载中… | Loading… |
| `aiCfgMemoryLoadFailed` | `Failed to load memories.` | 加载记忆失败。 | Failed to load memories. |
| `aiCfgNoMemories` | `No memories yet.` | 暂无记忆。 | No memories yet. |
| `aiCfgRecalledTimes` | `recalled {n}×` | 被召回 {n} 次 | recalled {n}× |
| `aiCfgDeleteMemory` | `Delete memory` | 删除记忆 | Delete memory |
| `aiCfgMemKindPreference` | `Preference` | 偏好 | Preference |
| `aiCfgMemKindFact` | `Fact` | 事实 | Fact |
| `aiCfgMemKindGoal` | `Goal` | 目标 | Goal |
| `aiCfgMemSourceAuto` | `Auto` | 自动 | Auto |
| `aiCfgMemSourceTool` | `Saved` | 已保存 | Saved |
| `aiCfgMemSourceUser` | `Manual` | 手动 | Manual |

⚠️ **`aiCfgMemSourceTool` 的英文是 `Saved`、中文是「已保存」，与 `aiCfgSaved`（保存状态提示，同样是「已保存/Saved」）字面撞车但语义不同** —— Vue2 里是同一个串两处用，本期刻意分成两个键：一个是记忆来源标签、一个是保存态提示，将来任一处改文案不会牵连另一处。**不要合并。**

- [ ] **Step 1: 改共享包类型（D5）**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-Service
grep -rn "context_window" src/
```

把 `putMemorySettings` 的 payload 类型改成：

```ts
putMemorySettings(payload: {
  enabled?: boolean
  compaction_enabled?: boolean
  /** null = 自动(后端按模型上限推断)。Vue2 MemorySection.vue:141 在输入框留空时
   *  就发 null,原类型漏了 null,导致 TS strict 下调用方只能强转。 */
  context_window?: number | null
}): Promise<unknown>
```

提交（该仓分支 `sp8-ai`）：

```bash
git add <改动文件>
git commit -m "fix(ai): putMemorySettings 的 context_window 接受 null(自动)"
```

回到 New-UI 侧重新同步本地包（**这一步不做的话构建会报 `Module not found`**，见记忆「nimoos-service pnpm 漂移」）：

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm install
grep -n "context_window" node_modules/@nimotech/nimoos-service/dist/ai.d.ts   # 确认已是 number | null
```

- [ ] **Step 2: 承接 Vue2 的 13 条测试 + 新增 6 条**

Vue2 的 `MemorySection.spec.js` 用 `MemorySection.methods.load.call(ctx)` 这种「借 this 直调 methods」的写法，`<script setup>` 没有 `methods` 对象可借，**必须改成挂载组件 + spy service**。逐条对照（**Vue2 那 13 条的断言内容一条不许丢**，只换驱动方式）：

| # | Vue2 用例 | 本仓移植后怎么驱动 | 断言（不变） |
|---|---|---|---|
| 1 | `load() fills settings + memories` | 挂载 | `enabled=false` 生效（开关关）、列表渲染 1 行、无 loading、无 error 文案 |
| 2 | `load() fills compaction_enabled and context_window` | 挂载，settings 返回 `{enabled:true,compaction_enabled:true,context_window:8192}` | 压缩开关开、数字框值 `8192` |
| 3 | `load() … false + empty when absent` | settings 只返回 `{enabled:true}` | 压缩开关关、数字框空串 |
| 4 | `load() sets error on failure` | `getMemorySettings` reject | 渲染「加载记忆失败。」、无 loading |
| 5 | `remove() deletes and drops the item` | 点某行删除键 | `deleteUserMemory('a')` 被调、该行消失、另一行还在 |
| 6 | `remove() keeps the item on failure` | delete reject | 行**仍在**（否定断言，Vue2 原意是「失败不乐观删除」） |
| 7 | `saveEnabled() reverts the toggle on failure` | put reject | 开关值翻回去 |
| 8 | `saveEnabled() calls put… with 三个字段` | 拨开关 | `putMemorySettings` 收到 `{enabled, compaction_enabled, context_window}` 三个键齐全 |
| 9 | `saveCompaction() … compaction_enabled in payload` | 拨压缩开关 | payload 含 `compaction_enabled:true`、`context_window:null` |
| 10 | `saveCompaction() reverts on failure` | put reject | 压缩开关翻回去 |
| 11 | `saveContextWindow() … as number` | 数字框输 `'8192'` 触发 change | payload `context_window: 8192`（数字，不是字符串） |
| 12 | `saveContextWindow() sends null when blank` | 数字框清空触发 change | payload `context_window: null`（**这条就是 D5 的由来**） |
| 13 | `saveContextWindow() reverts to previous on failure` | put reject，且 mock 实现里在 await 期间把值改成 `'99999'` | 最终值回到发请求前捕获的 `'4096'`（锁的是「保存失败前先存快照」这个写法，不是「读当前值」） |
| 14 | `kindLabel/sourceLabel map known + pass through unknown` | 直接调组件导出的纯函数 | `kindLabel('preference')==='aiCfgMemKindPreference'`、`sourceLabel('tool')==='aiCfgMemSourceTool'`、`kindLabel('weird')==='weird'` |

新增 6 条（本期新行为）：

15. 关闭记忆开关后渲染「记忆已关闭 ——…」警告条；开启时不渲染（对照组）。
16. `saveEnabled` 失败**同时弹 danger toast**（逻辑修正，Vue2 只静默回滚）。
17. `saveCompaction` 失败弹 danger toast。
18. `saveContextWindow` 失败弹 danger toast。
19. `remove` 失败弹 danger toast（Vue2 注释写着 `/* keep the item on failure */`，只保留不提示）。
20. 记忆条目的三个标签正确本地化：`kind='preference'` → 「偏好」、`source='auto'` → 「自动」、`recall_count=3` → 「被召回 3 次」；且 `recall_count` 缺失时按 0 渲染（Vue2 `m.recall_count || 0`）。

第 14 条要求把两个映射函数**从组件里导出**：

```ts
// 与 Vue2 MemorySection.vue:96-97 的 KIND_LABELS / SOURCE_LABELS 对应,值换成 i18n 键名。
// 未知取值原样返回(Vue2 同款兜底)——此时 t(未知串) 在 vue-i18n 9 下渲染该串本身,
// 与 Vue2 `$t('weird')` → 'weird' 的视觉结果一致(控制台会有 missing key 告警,可接受)。
export const KIND_LABEL_KEYS: Record<string, string> = {
  preference: 'aiCfgMemKindPreference', fact: 'aiCfgMemKindFact', goal: 'aiCfgMemKindGoal',
}
export const SOURCE_LABEL_KEYS: Record<string, string> = {
  auto: 'aiCfgMemSourceAuto', tool: 'aiCfgMemSourceTool', user: 'aiCfgMemSourceUser',
}
export function kindLabel(k: string): string { return KIND_LABEL_KEYS[k] || k }
export function sourceLabel(s: string): string { return SOURCE_LABEL_KEYS[s] || s }
```

`<script setup>` 里用 `defineExpose` 不行（那是实例级），**把这四个放在组件文件顶部的 `<script lang="ts">`（非 setup）块里导出**，或者单独放 `src/ai/util/memoryLabels.ts`。**选后者**（与 Task 9/11 抽纯函数的做法一致，测试也更直接）：`src/ai/util/memoryLabels.ts` + `memoryLabels.test.ts`，加进本任务文件清单。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/sections/MemorySection.test.ts`
Expected: FAIL —— 组件文件不存在。

- [ ] **Step 4: 加 i18n 键 + 实现组件**

关键逻辑（逐字照用，其余模板按 Vue2 `:1-93` 逐行搬）：

```ts
const memories = ref<MemoryItem[]>([])
const enabled = ref(true)
const loading = ref(false)
const error = ref(false)
const compactionEnabled = ref(false)
const contextWindow = ref<string>('')      // 与 Vue2 一致:字符串,空串表示自动

interface MemoryItem { id: string | number; kind: string; text: string; source: string; recall_count?: number }

function payload() {
  // Vue2 :112-116 / :126-130 / :140-144 三处发的是同一个三字段 payload,这里收一处。
  return {
    enabled: enabled.value,
    compaction_enabled: compactionEnabled.value,
    context_window: contextWindow.value !== '' ? Number(contextWindow.value) : null,
  }
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const s = (await service.ai.getMemorySettings()) as {
      enabled?: boolean; compaction_enabled?: boolean; context_window?: number | null
    }
    enabled.value = !!s.enabled
    compactionEnabled.value = !!s.compaction_enabled
    contextWindow.value = s.context_window != null ? String(s.context_window) : ''
    memories.value = ((await service.ai.listUserMemory()) as MemoryItem[]) || []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function saveEnabled() {
  try { await service.ai.putMemorySettings(payload()) }
  catch (e) {
    enabled.value = !enabled.value                                  // Vue2 :119 同款回滚
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')   // 逻辑修正:Vue2 静默
  }
}

async function saveCompaction() {
  try { await service.ai.putMemorySettings(payload()) }
  catch (e) {
    compactionEnabled.value = !compactionEnabled.value
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

async function saveContextWindow() {
  const prev = contextWindow.value            // Vue2 :138 —— 发请求前先存快照,不是失败时读当前值
  try { await service.ai.putMemorySettings(payload()) }
  catch (e) {
    contextWindow.value = prev
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

async function remove(m: MemoryItem) {
  try {
    await service.ai.deleteUserMemory(m.id)
    memories.value = memories.value.filter((x) => x.id !== m.id)
  } catch (e) {
    // Vue2 :152 注释是「keep the item on failure」——保留条目这条照搬,但补提示。
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}
```

⚠️ **`enabled.value = !!s.enabled` 是刻意的偏离**：Vue2 写的是 `this.enabled = s.enabled`（不加 `!!`），后端漏字段时 `enabled` 会变成 `undefined`，`SetSwitch` 收到 `undefined` 渲染成关、但 payload 又发 `undefined` 让后端按「未修改」处理 —— 一个可复现的错误行为。加 `!!` 归一。**报告里申报。**（Vue2 测试第 1 条 mock 的是 `{enabled:false}`，加 `!!` 后断言不变。）

⚠️ `contextWindow` 存字符串而不是 `number | ''` 联合类型：Vue2 用 `v-model`（不带 `.number`），空串与数字串混用。保持字符串 + 在 `payload()` 里转换，这样第 11/12/13 条断言都能原样成立。

- [ ] **Step 5: 跑测试确认通过（20 例）**

Run: `pnpm test src/ai/components/settings/sections/MemorySection.test.ts src/ai/util/memoryLabels.test.ts`
Expected: PASS

- [ ] **Step 6: 接映射表 + 全量测试门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/MemorySection.vue \
        src/ai/components/settings/sections/MemorySection.test.ts \
        src/ai/util/memoryLabels.ts src/ai/util/memoryLabels.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 6: MemorySection(AI 记忆,承接 Vue2 13 例 + 补失败提示)"
git show --stat HEAD && git status
```

**报告里必须写清**：共享包改了哪一行、`pnpm install` 跑过、`ai.d.ts` 已确认变成 `number | null`。

---

