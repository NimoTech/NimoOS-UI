# SP8-P2b Task 0 对账报告

时间戳:2026-07-28 18:33(基线实测)~ 18:40(收尾),均在 `.sp8/NimoOS-New-UI` (branch `sp8-ai`)。

## Step 1: 基线

**第一次实测(基线数字来源)**:HEAD = `7a2e64c`(P2a Task 7 fix),`src/ai/views/SettingsPage.vue` /
`SettingsPage.test.ts` / `SectionPlaceholder.vue` 三个文件当时是**未跟踪**状态,`src/i18n/en_us.ts` /
`src/i18n/zh_cn.ts` / `src/router/index.ts` 有 P2a 未提交的修改。在这个工作区状态下跑的三件套结果:

```
pnpm test        → Test Files 268 passed (268) / Tests 1996 passed (1996)   Duration 62.18s
pnpm exec vue-tsc --noEmit  → 无输出,exit 0(干净)
pnpm build       → vue-tsc --noEmit && vite build 全部成功,✓ built in 11.55s
```

`pnpm build` 的输出里只有 vueuse/lottie-web/file-type 的第三方包警告(`#__PURE__` 注释位置、`eval` 用法)
和「chunk > 500kB」体积警告 —— 这些是既有第三方依赖/既有代码分割现状,与本次改动无关,不算红。
**零测试失败,零 tsc 错误,build 成功。** 没有任何红项需要甄别"是不是 P2a 在途文件的"。

**协调者中途通报的基线变更**:实测期间 P2a 会话提交了 Task 8 —— HEAD 现为
`5a9dc04 SP8-P2a Task 8: SettingsPage 壳 + 路由 + scroll-spy + ?section= 深链`,`git status` 干净。
`git show 5a9dc04 --name-status` 确认这一次提交正是把上面那三个未跟踪文件 + i18n 两档 + 路由改动一次性收编:

```
A  src/ai/components/settings/SectionPlaceholder.vue
A  src/ai/views/SettingsPage.test.ts
A  src/ai/views/SettingsPage.vue
M  src/i18n/en_us.ts
M  src/i18n/zh_cn.ts
M  src/router/index.ts
```

内容与我在 `7a2e64c` + 未跟踪状态下读到的**逐字一致**(commit 只是把已经在磁盘上的内容入库,没有再改一次)。
`git log --oneline -8` 之后一段 P2a 提交链条(3-7 步略,详见 progress.md 开头)延续到 `502b317`→`dadfb0e`→
`99e424f`→`70f4d38`→`5adb1fa`→`7a2e64c`→`5a9dc04`。

**本报告采纳的正式基线:`5a9dc04`。** 三件套数字沿用上面第一次实测的结果(268 files / 1996 tests 绿 · tsc 清 ·
build 清),因为 commit 前后内容逐字相同,无需重跑。

**结论:P2a T9–T13 仍未开始** —— `src/ai/components/settings/sections/` 目录仍不存在(`ls` 报
`No such file or directory`),`ModelsSection.vue`/`ProvidersSection.vue`/`PrivacySection.vue`/
`ThinkingDefaultsSection.vue` 均不存在。本 Task 0 之后 P2a 会话仍在活跃修改
`SettingsPage.vue`/i18n 两档/`router/index.ts`,后续 P2b 任务对这些文件保持只读。

## Step 2: `SettingsPage.vue` 现状(5a9dc04,即时快照,标注"P2a 在途文件快照,可能在 P2b 落地前继续变化")

文件:`src/ai/views/SettingsPage.vue`(416 行)。

**① `SECTION_COMPONENTS` 的确切类型与写法**(:66-80):

```ts
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: SectionPlaceholder, // Task 9 替换
  providers: SectionPlaceholder, // Task 10 替换
  privacy: SectionPlaceholder, // Task 11 替换
  thinking: SectionPlaceholder, // Task 11 替换
  blacklist: SectionPlaceholder,
  execution: SectionPlaceholder,
  search: SectionPlaceholder,
  memory: SectionPlaceholder,
  observability: SectionPlaceholder,
  skills: SectionPlaceholder,
  mcp: SectionPlaceholder,
  mcptokens: SectionPlaceholder,
  channels: SectionPlaceholder,
}
```

- 类型确实是 `Record<SectionId, Component>`(`Component` 从 `vue` 用 `import type { Component } from 'vue'` 引入)。
- **导入是静态的**:`import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'`(:43),
  没有任何 `defineAsyncComponent`/动态 `import()`。目前全部 13 个 id(包含本期 P2b 要接的 7 个:
  `blacklist / execution / search / memory / observability / mcptokens / channels`)**逐一**指向同一个
  `SectionPlaceholder` 静态导入,没有按组懒加载。
- **7 个 P2b 分区当前全部指向 `SectionPlaceholder`**,与模型组 4 个分区(`models/providers/privacy/thinking`,
  留给 P2a Task 9/10/11)、`skills/mcp`(留给 P3/P4)同一套占位,渲染路径完全一致,无特殊分支。

**② 分区组件是否收 props**:收,但只收两个"占位专用"prop,渲染处统一走 `placeholderProps()`(:88-92):

```ts
function placeholderProps(id: SectionId): Record<string, string> {
  if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}
  const item = ALL_ITEMS.find((i) => i.id === id)
  return { titleKey: item ? item.labelKey : '', bodyKey: 'aiCfgPlaceholderBody' }
}
```

模板两处渲染点(stack 组 :403 / swap 组 :408-412)都是 `<component :is="SECTION_COMPONENTS[...]" v-bind="placeholderProps(...)" />`。
**关键:`placeholderProps` 内部有个 `=== SectionPlaceholder` 判等**——一旦 P2b 把某个 id 换成真组件,
这两个 prop 会自动变成 `{}`(不再传递),不需要改渲染处代码,只需要改 `SECTION_COMPONENTS` 那一行 +
加一个 import(文件头注释 :56-65 已经这样交代)。真分区组件本身不需要接 `titleKey`/`bodyKey`,
落进 fallthrough attrs 无害但也用不上。

**③ 根元素最终类名**(:347,逐字抄录,不是转述):

```html
<div class="agent-app set-app" :data-theme="aiTheme.theme">
```

**与 plan 假定完全一致**:`class="agent-app set-app"`,外加一个 `:data-theme` 绑定(不是静态 class)。
文件头注释(:6-8)明确解释了为什么两个 class 都不能少:`.agent-app` 是 `tokens.scss` 的 token 作用域,
`.set-app` 是 `settings-styles.scss` 的布局作用域,少一个就没颜色或没布局。

补充(brief 未问但对 P2b 布局有用):`<main class="set-main">` 内部结构固定为
`<header class="set-topbar">` + `<div ref="bodyEl" class="set-body" :class="{'set-body-split': isSplitSection}">`,
后者内部按 `activeGroup.stack` 二选一渲染(`v-if="activeGroup.stack"` 竖排 vs `v-else` 单换),
P2b 的 7 个分区都属于 `stack: true` 的两个组(`agent`/被 sections.ts 归类,见下),走的是
`<section class="set-stack-item" :data-section-id="item.id" :ref="...">` 包一层再渲染 `<component>`
的路径(:396-404),不是 swap 单换路径。

## Step 3: 既定范式(P2a 分区组件不存在,改从已落地的兄弟组件 + sections.ts 提炼)

`src/ai/components/settings/sections/` 目录不存在,`ModelsSection.vue`/`PrivacySection.vue` 等**均不存在**,
brief Step 3 假设的样板文件不可读。以下范式改从已提交的 `SettingsRail.vue`、`SetSwitch.vue`、
`SectionPlaceholder.vue`、`sections.ts` 四个文件 + 现有 AI 区其它组件的 import 写法反推,**除标注"推算"外均为直接读到的事实**。

### 3.1 `<script setup>` 头部注释格式(既定范式)

四个样板文件头部注释统一遵循:
1. 第一行注明 `SP8-P2a Task N —— 1:1 移植自 Vue2 \`<path>\`(N 行)` 或 `新建组件,Vue2 无对应蓝本`。
2. 接一段说明与 Vue2/其它组件的**差异**(D1/D2 式编号或直接列点),每条差异都点名理由和影响面。
3. 涉及具体行号引用时精确到 Vue2 源文件的行区间(如 `skills-styles.scss:235-249`)。

`SectionPlaceholder.vue` 头(:1-13)是"新建组件"式样板,`SettingsRail.vue`/`SetSwitch.vue` 是"1:1 移植"式样板。

### 3.2 `sk-section` 结构(`SectionPlaceholder.vue` :22-29,实际渲染的最小骨架)

```html
<div class="set-inner">
  <div class="sk-section">
    <h1 class="set-h1">{{ t(props.titleKey) }}</h1>
    <p class="set-desc">{{ t(props.bodyKey) }}</p>
  </div>
</div>
```

真分区会在 `.sk-section` 内部换成更丰富的内容(见 3.4 的可用类清单),但外层 `.set-inner` + `.sk-section`
两层包裹是既定骨架,brief 注释里点名"与 Vue2 各 xxxSection.vue 的根结构一致,如
ThinkingDefaultsSection.vue:1-2 的 `.set-inner`"——这条来自 Vue2 蓝本(`NimoOS-UI`,只读)的对照,
本仓侧没有对应文件可核对,采信 SectionPlaceholder.vue 作者的申报。

### 3.3 import 路径写法:相对路径为主,少数走包别名

**store**(`settingsStore`)—— 全部相对路径,深度随文件位置变化:
- `SettingsPage.vue`(`src/ai/views/`)→ `import { useSettingsStore } from '../stores/settingsStore'`(:39)
- **推算**(sections/ 目录尚不存在,按目录深度换算):`src/ai/components/settings/sections/*.vue` 比
  `views/` 深一层但比 `views/` 到 `stores/` 的路径结构不同——`sections/` 相对 `src/ai/stores/settingsStore.ts`
  的正确相对路径是 `'../../../stores/settingsStore'`(sections→settings→components→ai,再进 stores/)。
  **这是推算值,P2b 写代码时以实际创建目录后跑一次 tsc 校验为准,不要照抄不试。**

**toast**(`useToast`,注意:这是**应用级全局 store**,不在 `src/ai/` 下,在 `src/stores/toast.ts`)——
`AgentComposer.vue`(`src/ai/components/shell/`)用 `'../../../stores/toast'`(3 级),
`SettingsPage.vue`(`src/ai/views/`)用 `'../../stores/toast'`(2 级)。**推算**:
`sections/*.vue` 比 `shell/AgentComposer.vue` 深一级 → `'../../../../stores/toast'`(4 级)。

**i18n**:组件内部一律用 `useI18n()` from `'vue-i18n'`(包名,非相对路径),不直接 import 本仓 `i18n` 实例——
`settingsStore.ts` 例外(它在 setup 函数体外也要用 `i18n.global.t`,见 `'../../i18n'` :38),
分区组件按 SectionPlaceholder 范式走 `useI18n()` 即可,不需要仿 store 那种直引。

**图标**(`AgentIcon`)—— 相对路径,`SettingsRail.vue`(`src/ai/components/settings/`)用
`'../icons/AgentIcon.vue'`(:21,1 级)。**推算**:`sections/*.vue` 比 `settings/` 深一级 →
`'../../icons/AgentIcon.vue'`(2 级)。

**结论**:本仓 AI 区**没有 `@/` 或包别名用于跨内部文件引用**的先例,store/toast/图标一律相对路径;
只有 i18n(`vue-i18n` 包)和 service 层(`@nimotech/nimoos-service`,见 `settingsStore.ts:37`
`import { service } from '@nimotech/nimoos-service'`)是走包名导入。7 个分区若要调用后端,应参照
`settingsStore.ts` 的 `service.ai.xxx()` 调用形式(通过 store 封装,不在分区组件里直接 import service)——
这与已读到的 `blacklist` 三件套完全对应(见 Step 5)。

### 3.4 toast 调用的确切签名(`src/stores/toast.ts:18-27`,逐字读到,非转述)

```ts
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastItem { id: number; text: string; tier: ToastTier }

export const useToast = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  function show(text: string, duration = 1500, tier: ToastTier = 'info') { ... }
  ...
})
```

即 `toast.show(text: string, duration = 1500, tier: 'info' | 'warning' | 'danger' = 'info')`。
实际调用点抓到的三档用法(`grep -rn "toast\.\|useToast" src/ai`,全量列在下方,精选):
- danger:`toast.show(t('aiAuthFailed', { msg }), 5000, 'danger')`(AgentComposer.vue:530)
- warning:`toast.show(\`${file.name}:${docErrorLabel(entry.docError)}\`, 7000, 'warning')`(AgentComposer.vue:924)
- info(省略第三参,走默认):`toast.show(t('aiCfgKnowledgeSoon'))`(SettingsPage.vue:150)、
  `toast.show(t('aiCfgSectionDeferred'), 3000)`(SettingsPage.vue:234,只补了 duration,tier 仍默认 info)

brief 假定的写法 `toast.show(msg, 3000, 'danger')` **参数顺序/类型完全对得上**(text, duration, tier),
唯一要注意的是 **duration 默认值是 1500 不是 3000**,3000 是调用方主动传的,不是 store 默认。

### 3.5 `sk-*` / `set-*` 类名清点(grep `src/ai/styles/sk-shared.scss` + `settings-styles.scss`)

**`sk-shared.scss`(P2a Task 2 抽出的 6 条通用类,实际存在)**:
`.sk-section` / `.sk-section-head` / `.sk-section-title` / `.sk-section-hint` / `.sk-section-body` / `.sk-btn`(+`.ghost`/`.primary`/`.danger` 三态)/ `.sw`(P2a Task 6 补,SetSwitch 专用开关)。

**brief 点名要核的几个类名,逐一核实结果**:
- `sk-sec-head`:**不存在**。实际类名是 `.sk-section-head`(全称,非缩写)。brief 里的简写是笔误/记忆误差,写分区代码时必须用 `.sk-section-head`。
- `sk-row`:**不存在**。`settings-styles.scss` 里对应的是 `.set-row`(:95-101,非 `sk-` 前缀,是 `set-` 前缀),
  结构:`.set-row` 含 `.lbl`(标签,可带 `.sub` 说明)+ `.val`(内容,`.val.end` 右对齐变体)。
- `sk-chip`:**不存在**。对应的是 `.set-chip`(:119-122,`set-` 前缀),带 `[data-on="true"]` 选中态和内部 `.box`(勾选框)。

**结论**:`sk-` 前缀只用于「跨设置区/Skills 区共用」的通用卡片/按钮/开关基础类(来自 sk-shared.scss),
「设置页专属」的行/芯片/输入框/按钮组等具体控件类全部是 `set-` 前缀(来自 settings-styles.scss)。
7 个分区写具体表单行、开关行、芯片列表时应该用 `set-row`/`set-chip`/`set-input`/`set-copy`/`set-actions`
等 `settings-styles.scss` 里已有的类(:94-129 附近,已实测存在:`set-rows`/`set-row`/`set-input`(+`.mono`/`.num`/`.full`)/
`set-copy`/`set-copybtn`(+`.done`)/`set-chips`/`set-chip`/`set-actions`/`tok-row`),外层大标题/说明仍套
`sk-section`/`sk-section-head`/`sk-section-title`/`sk-section-hint`/`sk-section-body`(sk-shared.scss)。
plan 若假设 P2b 需要新增这些具体控件类,**应先核实是否已在 settings-styles.scss 里(结果:大概率已经有),
不要重新发明或重复搬一遍**。

## Step 4: `sk-modal` / `sk-field` 确认

```
grep -rn "sk-modal\|sk-field" src/ai/styles/ src/styles/
→ 零命中(exit code 1,输出为空)
```

**与 brief 预期一致:零命中。** P2a Task 2 只移植了 sk-shared.scss 里那 6 条通用类,没有 modal/field 相关类。
若 P2b 某个分区需要弹窗(比如 mcptokens 的"新建 token"表单)或独立的字段布局,需要新增样式,
不能假设 `sk-modal`/`sk-field` 已存在。

## Step 5: `settingsStore` blacklist 三件套(`src/ai/stores/settingsStore.ts`,逐字抄录)

```ts
// :132-136
export interface BlacklistEntry {
  id: string | number
  pattern: string
  created_at: string
}

// :590-617
const blacklist = ref<BlacklistEntry[]>([])
const blacklistLoading = ref(false)

async function loadBlacklist() {
  blacklistLoading.value = true
  try {
    const body = await service.ai.listBlacklist()
    blacklist.value = (body as BlacklistEntry[]) || []
  } finally {
    blacklistLoading.value = false
  }
}

async function addBlacklist(pattern: string) {
  const body = await service.ai.addBlacklistPattern(pattern)
  const raw = body as { id?: string | number } | string | number | null | undefined
  const idInner = raw && typeof raw === 'object' ? (raw.id ?? raw) : raw
  const id = (idInner as string | number | undefined) || Date.now()
  blacklist.value.push({ id, pattern, created_at: new Date().toISOString() })
}

async function removeBlacklist(id: string | number) {
  await service.ai.removeBlacklistPattern(id)
  blacklist.value = blacklist.value.filter((x) => x.id !== id)
}
```

全部 5 个名字(`blacklist` / `blacklistLoading` / `loadBlacklist` / `addBlacklist` / `removeBlacklist`)在
store 的 return 对象里确认导出(:731-736),`BlacklistEntry` 接口在文件顶部 `export`。

**与 brief 预期完全一致**,类型/签名/字段名逐一对上:`Ref<BlacklistEntry[]>`、`Ref<boolean>`、
`loadBlacklist(): Promise<void>`、`addBlacklist(pattern: string): Promise<void>`、
`removeBlacklist(id: string | number): Promise<void>`。

## Extra Step: 共享包 `@nimotech/nimoos-service` 方法审计

包位置:`/home/nimo/NimoTech/.sp8/NimoOS-Service`(dist 已构建,`dist/ai.d.ts` 是权威签名源)。
按 brief 给的 grep 关键词跑在 `dist/*.d.ts` + `src`:

```
grep -n "getMaxTurns\|setMaxTurns\|getSearchSettings\|putSearchSettings\|getFileindexStatus\|getMemorySettings\|putMemorySettings\|listUserMemory\|deleteUserMemory\|getTracingSetting\|putTracingSetting\|listMcpTokens\|createMcpToken\|deleteMcpToken\|channel" dist/*.d.ts src/*.ts
```

命中 57 处(含 src 里的实现),但**命中的方法名并非 brief 关键词逐字符匹配的全部**——grep 是大小写敏感的,
以下几个 brief 假设的名字在包里**不存在**,存在的是大小写/命名不同的版本:

| brief 假设的名字 | 实际是否存在 | 包里的真实名字 |
|---|---|---|
| `setMaxTurns` | **不存在** | `putMaxTurns(maxTurns: number)`(:486/dist:107) |
| `listMcpTokens` | **不存在(大小写不符)** | `listMCPTokens()`(MCP 全大写,:400/dist:91) |
| `createMcpToken` | **不存在(大小写不符)** | `createMCPToken(data)`(:405/dist:92) |
| `deleteMcpToken` | **不存在(大小写不符)** | `deleteMCPToken(id)`(:410/dist:93) |
| `channel`(小写关键词) | grep 用小写 `channel` **匹配不到**真实的 `Channel*` 方法(全部首字母大写) | `listChannelInstances` / `createChannelInstance` / `setChannelInstanceEnabled` / `deleteChannelInstance` / `listPairableChannelInstances` / `createChannelPairingCode` / `listChannelBindings` / `deleteChannelBinding` / `setChannelBindingModel` / `setChannelBindingDownloadDir`(全部在 `dist/ai.d.ts:94-103`) |

**其余 brief 假设的名字全部逐字符匹配存在**(`dist/ai.d.ts:106-123`):
`getMaxTurns` / `getTracingSetting` / `putTracingSetting` / `listUserMemory` / `deleteUserMemory` /
`getMemorySettings` / `putMemorySettings` / `getSearchSettings` / `putSearchSettings` / `getFileindexStatus`。
另外还有一个 brief 没提但 P2b `search` 分区大概率要用的 `rescanFileindex()`(:555,dist 同名),以及
`observability` 分区要用的 `getObservabilityCompose()`(:533,dist:120,注意名字是
`getObservabilityCompose` 不是裸 `getObservability`)。

**`service.compose.*`**:`dist/compose.d.ts` 里没有任何 AI/agent 相关方法 —— brief 提到的
"`service.compose.*`" 命名空间与 AI 设置区无关,7 个 P2b 分区的后端调用应全部走 `service.ai.*`,
不存在需要用 `service.compose.*` 的地方。

**D5 依赖的 `putMemorySettings` 精确签名**(`src/ai.ts:518-529`,逐字抄录):

```ts
async putMemorySettings(payload: {
  enabled?: boolean
  compaction_enabled?: boolean
  context_window?: number
}): Promise<unknown> {
  const res = await http.put(`${PREFIX}/agent/user-memory/settings`, {
    enabled: payload.enabled,
    compaction_enabled: payload.compaction_enabled,
    context_window: payload.context_window,
  })
  return res.data
}
```

三个字段均为可选(`?`),PUT 请求体三个字段总是全带(即使调用方只想改一个,其它两个会被显式传 `undefined`——
下游 HTTP 层/后端如何处理 `undefined` 字段未在此包内验证,写 `memory` 分区时如果只想改单个字段,
要注意这个"总是带三个 key"的行为,可能需要调用方自己先读一次现有设置再合并,不能假设后端会忽略 `undefined`)。

**结论(给后续任务的行动项)**:
1. `execution` 分区(对应 `getMaxTurns`/`putMaxTurns`)——plan 里如果写了 `setMaxTurns`,写代码时改成 `putMaxTurns`。
2. `mcptokens` 分区——plan 里如果写了 `listMcpTokens`/`createMcpToken`/`deleteMcpToken`(小写 Mcp),
   写代码时改成 `listMCPTokens`/`createMCPToken`/`deleteMCPToken`(大写 MCP)。
3. `channels` 分区——方法名全部是 `Channel`(首字母大写)前缀,10 个方法都已存在,签名见上表,足够覆盖
   实例增删启停 / 可配对实例 / 配对码 / 绑定增删 / 绑定改模型 / 绑定改下载目录。
4. `observability` 分区——只有一个只读方法 `getObservabilityCompose()`,没有对应的 `put`/`set`,
   若 plan 假设这个分区可编辑设置,需要先确认后端是否真的没有写接口(本审计只覆盖前端共享包这一侧)。
5. `search`/`memory`/`blacklist` 三个分区——plan 假设的方法名逐字符全部存在,可直接用。
