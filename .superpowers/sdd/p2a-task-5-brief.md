# SP8-P2a Task 5 — 任务简报

> 本文件是你的**唯一需求来源**。里面的每一个具体值(路径、代码、测试用例、i18n 文案、
> 提交信息)都要**逐字照用**,不要凭印象改写。
> 完整 plan 在 `/home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-07-28-vue3-migration-sp8-p2a-settings-shell-models.md`,但**不要去读整份** —— 你需要的都在这里。

# SP8-P2a — AI 设置区(壳 + 模型组 4 分区)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 `src/views/AI/Settings/` 的页面壳、左侧导航、设置 store 与「模型」组 4 个分区(本地模型 / 云服务商 / 隐私与云 / 思考强度)1:1 迁到 New-UI 的 `/ai/settings`,让用户第一次能在新 UI 里配出可用模型——从而解锁 SP8-P1 那张「真流式下工具块 / ProcessStrip / 搜索卡 / 确认卡从未验证过」的最大挂账。

**Architecture:** 新增独立路由 `/ai/settings`(与 `/ai/agent` 平级,各自全屏),页面由 `SettingsPage.vue` 组装:左 `SettingsRail`(四个可折叠分组 + 账号卡)、右 `set-main`(状态灯顶栏 + 内容区)。内容区两种渲染模式由 `sections.ts` 的 `stack` 标志决定:`stack: true` 的组把组内所有分区竖排一页并启用 IntersectionObserver scroll-spy;`stack: false` 一次只渲染一个分区。状态集中在单例 Pinia `useSettingsStore`(整体移植 Vue2 `settingsStore.js` 376 行);AI 明暗主题从 `agentStore` 抽到应用级 `useAiTheme`,两页共享。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia(setup store)· vue-router 4(hash)· vue-i18n 9 · reka-ui(AlertDialog / 新增 PromptDialog)· vitest + @vue/test-utils · SCSS(手写,无框架)· `@nimotech/nimoos-service` 的 `service.ai.*`

---


## Global Constraints

以下为全期硬约束,**每个任务的验收条件隐含包含本节全部条目**。

### 工作区与分支

- 唯一可写工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,基线 **`650b2ad`**。
- **禁碰**:`/home/nimo/NimoTech/NimoOS-New-UI`(master,SP6 存储会话)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7 相册会话)。
- `/home/nimo/NimoTech/NimoOS-UI`(Vue2 老仓)**只读**,任何任务不得修改其 `src/`。
- 共享包 `/home/nimo/NimoTech/.sp8/NimoOS-Service`(`sp8-ai`@`2af8262`)本期**预期零改动**。`ai` 域 48 个方法已逐个核对齐备(见任务 5 的接口清单)。若确需新增,只允许在对应 factory 内部**追加**,不重排文件、不动 `index.ts`。

### 提交纪律(血泪教训,P1c-2 栽过)

- **`git add` 一律显式列路径,绝对禁止 `git add -A` / `git add .`** —— 多 agent 共用一个 worktree 时会把他人在途文件卷进提交。
- 每次提交后自查:`git show --stat HEAD` + `git status`,确认只含本任务文件清单内的文件。
- 同一时刻只允许一个 agent 提交。

### 测试门(每个任务结束前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      # 全量,不许只跑 src/ai/ 子集
pnpm exec vue-tsc --noEmit     # 类型
pnpm build                     # 只允许既有 500KB chunk 警告
```

**必须跑全量 `pnpm test`。** P1c-2 里 `src/styles/color-guard.test.ts` 连红三个提交无人发现,根因就是任务门只跑 `src/ai/` + `src/i18n/` 子集,而守卫散落在 `src/styles/`(color-guard)与 `src/i18n/`(parity / messageSyntax)。基线 `650b2ad` 的全量数是 **259 文件 / 1866 例全绿**,任何任务不得让这个数字出现红项。

### 移植纪律(用户 2026-07-27 拍板,全期生效)

- **界面 / 视觉 / 交互严格 1:1 照 Vue2。**
- **逻辑 / bug 不照抄**:Vue2 的缺陷、竞态、吞错改成正确逻辑,但必须三件套齐全:
  1. 代码注释注明「Vue2 原文 `file:line` 是什么问题、此处改成什么」
  2. 实现者报告里显式申报
  3. 台账登记
- **未申报的偏离本身就是缺陷**(P1c-2 里 T11、T12 各栽一次)。
- 判据:「这条改动是在修一个**可复现的错误行为**吗?是 → 改并登记;否 → 照 Vue2。」
- 禁止与需求无关的重构 / 改名 / 换库。

### 配色(color-guard 硬约束)

- 组件 `<style>` 块与新建 `.css` 里,一切可见颜色必须是 `var(--…)` token。**禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black`/`red`)**。
- AI 区 token 在 `src/ai/styles/tokens.scss`,`.agent-app` 作用域;本期设置页作用域是 `.set-app`(见任务 2)。
- **新增 token 必须在 light 块与 `[data-theme="dark"]` 块都有值。**
- ⚠️ `src/styles/color-guard.test.ts` **逐行扫 `<style>` 块且不跳注释行** —— 注释里不要写 Vue2 原始色字面量,改用「引 Vue2 `file:line` + 中文描述颜色」。
- ⚠️ **不要用 `theme-exception` 逃逸**:它的豁免会延续到下一个 `;` 或 `}`,标在独立注释行会连带豁免后面真正的声明。
- 例外:`.scss` 整档移植件(见任务 2)按 `agent-styles.scss` 先例登记豁免。

### i18n

- 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`src/i18n/parity.test.ts` 断言键集完全一致)。
- 文案里的字面 `@` 必须写成 `{'@'}`(vue-i18n 9 当链接语法,`src/i18n/messageSyntax.test.ts` 拦)。
- **本期键名前缀统一 `aiCfg`**(如 `aiCfgLocalModels`)。既有的 `aiSettings` / `aiSettingsComingSoon` 是 P1 的键,与本前缀无关,不要复用或改名。
- **中文值优先逐字复用 Vue2 生产译文**。权威查法:

  ```bash
  python3 -c "
  import json,sys
  d=json.load(open('/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json'))
  for k in sys.argv[1:]: print(repr(k),'->',repr(d.get(k,'<缺>')))
  " 'Local models' 'Refresh'
  ```

  英文值同理查 `en_US.json`;查不到则以 Vue2 源码里的英文字面量为准。
- Vue2 从未 i18n 的英文字面量,本期补中文键(P1a 之后的既定政策)。

### store 纪律

- **本期 store 与 `agentStore` 是两个不同的 store,禁止把设置状态塞进 agentStore。**
- `useAgentStore(agentType?)` 的工厂形态不得破坏;组件一律 `useProvidedAgentStore()`,只有 `AgentPage.vue` 调 `useAgentStore()` + `provideAgentStore()`。本期只有任务 4 会碰 `agentStore.ts`(主题委托),且是最小改动。
- `service.ai.*` 返回 **body-level 原样**,不多剥一层 `.data`。

### 禁忌

- **任何代码(含测试)不得 `await store.selectSession(...)`** —— 它 await attach 流,活跃 run 时不 resolve。测试里用 `void store.selectSession(...)`。

### 验收

- 验收 = dev server `pnpm dev --host --port 5288`,访问 `http://192.168.1.143:5288/app/#/ai/settings`。
- **真机一概不碰:不跑 `./scripts/deploy.sh`、不写 `/var/lib`**(会 `rsync --delete` 抹掉 SP6 已部署成果)。
- `vite.config.ts` 的 5288 端口配置是 SP8 专属,不要改成 5273/5277。

### SDD 工件

- brief 走文件:`.superpowers/sdd/p2a-task-N-brief.md`
- diff 包:`.superpowers/sdd/review-<BASE>..<HEAD>.diff`
- 台账:`.superpowers/sdd/progress.md`,追加在 `== SP8-P1c-2 收官 ==` 之后
- **评审最低 sonnet,禁 haiku**(P1c-2 出过两次误报)。评审必须自己读 Vue2 源文件、grep、跑测试,**不许采信实现者报告**。

---


---

## 本期做 / 不做(范围硬边界)

### ✅ 本期做(P2a)

| 项 | Vue2 蓝本 | 行数 |
|---|---|---|
| 页面壳 + 状态灯顶栏 + scroll-spy + `?section=` 深链 | `Settings.vue` | 243 |
| 左侧导航栏(四组可折叠 + 账号卡) | `SettingsRail.vue` | 113 |
| 开关原语 | `SetSwitch.vue` | 25 |
| 导航配置(**13 项全量**,含 skills/mcp 占位) | `sections.js` | 64 |
| 设置 store(整体移植) | `store/settingsStore.js` | 376 |
| 页面样式 | `settings-styles.scss` | 316 |
| 通用卡片/按钮样式(6 条 `sk-*`) | `Skills/skills-styles.scss:338-353,698-726` | ~30 |
| **本地模型**分区 | `sections/ModelsSection.vue` | 222 |
| **云服务商**分区 | `sections/ProvidersSection.vue` | 249 |
| **隐私与云**分区 | `sections/PrivacySection.vue` | 74 |
| **思考强度**分区 | `sections/ThinkingDefaultsSection.vue` | 73 |
| 移植 Vue2 测试 2 个 | `__tests__/SetSwitch.spec.js`、`__tests__/SettingsRail.spec.js` | 81 |
| 新原语 `PromptDialog`(带输入的确认框) | 替代 `$buefy.dialog.prompt` | 新建 |
| `AgentIcon` 补 9 个图标 | 对齐 `Skills/SkillIcon.vue` | 追加 |
| 应用级 `useAiTheme`(Agent / Settings 共享明暗) | 架构差异,见下 | 新建 |
| 接线 3 个 `open-settings` 入口 → 真跳转,退役占位 toast | `AgentPage.vue:112-116` | 改 |

### ❌ 本期不做(明确排除)

- **`skills` 分区 → SP8-P3**;**`mcp` 分区 → SP8-P4**。导航里 1:1 显示这两项(用户 2026-07-28 决定),点击时内容区渲染一个占位面板并弹 info toast「该分区将在后续阶段开启」。**不实现左列表+右详情的双栏满高布局**(`SPLIT_SECTIONS` / `set-body-split` 的样式规则照搬进 scss,但本期没有组件会触发它)。
- **7 个分区 → SP8-P2b**:`blacklist`(文件系统)· `execution`(执行步数)· `search`(搜索)· `memory`(AI 记忆)· `observability`(监控)· `mcptokens`(对外暴露 MCP)· `channels`(消息渠道)。它们对应的 4 个 Vue2 测试文件(`ChannelsSection` / `McpTokensSection` / `MemorySection` / `ObservabilitySection`)也一并留给 P2b。
- **顶栏「详情」链接**指向 `/ai/knowledge`(SP8-P5 才有)→ 本期渲染成同款样式的按钮,点击弹 info toast 占位,**不 `router.push`**(路由不存在会落空白死页)。
- **共享包不改**。
- **不碰真机**、不跑 `deploy.sh`、不改 `scripts/`。
- **不清 P1 的记账级 Minor 清单**(会话竞态窗口、右栏 rejection 无人接、`selectSession(sameId)` 清 activitySteps、toast 各档边框、`formatDuration` 的 10000ms 翻转点、`ContextTab.test.ts`/`AgentTopbar.test.ts` 手写 i18n 子集等)。若本期正好改到那段代码,顺手按纪律修掉并登记;否则不主动碰。
- **P1 挂账回验不算实现任务** —— 它是任务 13 交给用户的验收动作,不是本计划要写的代码。

---

## 必须偏离 Vue2 的地方(架构差异,共 3 条)

这三条**不是**「Vue2 有 bug」,而是 **Vue2 的组件级 store(每次挂载新建、卸载丢弃)换成 Pinia 单例(全局常驻)后必然出现的行为差**。每条都必须按移植纪律三件套处理。

### D1 — 明暗主题跨页不同步(任务 4 解决)

Vue2 里 `Agent.vue` 和 `Settings.vue` 各持一份 `theme`,靠同一个 localStorage key `nimoos.ai.agent.theme` 对齐;因为路由切换会销毁并重建组件,`data()`/`mounted` 会重读 localStorage,所以用户感知是一致的。

New-UI 里两个 Pinia store 都常驻不销毁 → 在设置页切成暗色、返回 `/ai/agent` 不会变。

**做法**:抽应用级 `src/ai/stores/aiTheme.ts` 持有 `theme` + `toggleTheme()` + 同一个 `THEME_KEY`;`agentStore` 与 `settingsStore` 都委托它。照 P1c-2 `useUserProfile` 头像共享的先例。

### D2 — 单例导致的瞬态 UI 状态残留(任务 5 + 任务 8 解决)

Vue2 每次进设置页都是全新 store,所以 `activeSection` 恒从 `'models'` 起、`providerForm` 恒是收起的、HF 搜索结果恒是空的。Pinia 单例会把上次离开时的状态原样带回来。

**做法**:store 提供 `resetTransientUi()`,`SettingsPage` 在 `onMounted` 里调用(在读 `?section=` **之前**),重置 `activeSection`(→ `'models'`)、`providerForm`、`hfQuery` / `hfResults` / `hfSelectedRepo` / `hfFiles`。

**明确不重置** `hfImportJobs`、`pullingModels`、`installedModels`、`providers`、`policy`、`blacklist`、三个服务状态字段 —— 前两个是真在跑的后台任务,后几个是服务端数据缓存,重置只会让页面白一下再重填。

### D3 — Vue2 的下载恢复循环是死代码,在本仓才第一次真正生效(任务 8 申报)

Vue2 `Settings.vue:159-163` 遍历 `store.state.hfImportJobs` 恢复未完成的下载轮询。但 `createSettingsStore()` 每次挂载新建,`hfImportJobs` 恒为 `{}` → **该循环从未执行过一次**。实际效果是:Vue2 里离开设置页,进度条消失、后台定时器泄漏(闭包持有已废弃的 store)。

New-UI 单例下 `hfImportJobs` 与定时器都还在,该循环第一次有了意义:回到页面进度条继续显示。

**这是「照搬后行为变好」,不是 bug 修复**,但必须申报。**Vue2 原文的 `&& !job._timer` 守卫要逐字保留** —— 它正是防止重复启动定时器的那道闸,不得省略。

### 观察项(照搬,不改,只登记)

- `settingsStore.js:58-68` `pullModel`:`pullingModels[name]` 在 `finally` 里立即删除,所以「Pulling: xxx(后台运行中 —— 请手动刷新查看进度)」这条提示**只在 HTTP 请求在途的那一瞬间显示**,与文案宣称的「后台运行中」语义不符。后端 `POST /pull` 是否同步阻塞未知,**照搬,不擅自改**,在代码注释与台账里登记为待观察。
- `ThinkingDefaultsSection.vue` 直接调 `service.ai.getThinkingDefaults()`,不经 store;而 `agentStore` 也有一份 thinking defaults。在设置页改了默认值,已挂载的 Agent 页 store 不会刷新。**Vue2 同样如此**(它靠切页重建掩盖),照搬 + 登记。

---


---

## 必须偏离 Vue2 的地方(架构差异,共 3 条)

这三条**不是**「Vue2 有 bug」,而是 **Vue2 的组件级 store(每次挂载新建、卸载丢弃)换成 Pinia 单例(全局常驻)后必然出现的行为差**。每条都必须按移植纪律三件套处理。

### D1 — 明暗主题跨页不同步(任务 4 解决)

Vue2 里 `Agent.vue` 和 `Settings.vue` 各持一份 `theme`,靠同一个 localStorage key `nimoos.ai.agent.theme` 对齐;因为路由切换会销毁并重建组件,`data()`/`mounted` 会重读 localStorage,所以用户感知是一致的。

New-UI 里两个 Pinia store 都常驻不销毁 → 在设置页切成暗色、返回 `/ai/agent` 不会变。

**做法**:抽应用级 `src/ai/stores/aiTheme.ts` 持有 `theme` + `toggleTheme()` + 同一个 `THEME_KEY`;`agentStore` 与 `settingsStore` 都委托它。照 P1c-2 `useUserProfile` 头像共享的先例。

### D2 — 单例导致的瞬态 UI 状态残留(任务 5 + 任务 8 解决)

Vue2 每次进设置页都是全新 store,所以 `activeSection` 恒从 `'models'` 起、`providerForm` 恒是收起的、HF 搜索结果恒是空的。Pinia 单例会把上次离开时的状态原样带回来。

**做法**:store 提供 `resetTransientUi()`,`SettingsPage` 在 `onMounted` 里调用(在读 `?section=` **之前**),重置 `activeSection`(→ `'models'`)、`providerForm`、`hfQuery` / `hfResults` / `hfSelectedRepo` / `hfFiles`。

**明确不重置** `hfImportJobs`、`pullingModels`、`installedModels`、`providers`、`policy`、`blacklist`、三个服务状态字段 —— 前两个是真在跑的后台任务,后几个是服务端数据缓存,重置只会让页面白一下再重填。

### D3 — Vue2 的下载恢复循环是死代码,在本仓才第一次真正生效(任务 8 申报)

Vue2 `Settings.vue:159-163` 遍历 `store.state.hfImportJobs` 恢复未完成的下载轮询。但 `createSettingsStore()` 每次挂载新建,`hfImportJobs` 恒为 `{}` → **该循环从未执行过一次**。实际效果是:Vue2 里离开设置页,进度条消失、后台定时器泄漏(闭包持有已废弃的 store)。

New-UI 单例下 `hfImportJobs` 与定时器都还在,该循环第一次有了意义:回到页面进度条继续显示。

**这是「照搬后行为变好」,不是 bug 修复**,但必须申报。**Vue2 原文的 `&& !job._timer` 守卫要逐字保留** —— 它正是防止重复启动定时器的那道闸,不得省略。

### 观察项(照搬,不改,只登记)

- `settingsStore.js:58-68` `pullModel`:`pullingModels[name]` 在 `finally` 里立即删除,所以「Pulling: xxx(后台运行中 —— 请手动刷新查看进度)」这条提示**只在 HTTP 请求在途的那一瞬间显示**,与文案宣称的「后台运行中」语义不符。后端 `POST /pull` 是否同步阻塞未知,**照搬,不擅自改**,在代码注释与台账里登记为待观察。
- `ThinkingDefaultsSection.vue` 直接调 `service.ai.getThinkingDefaults()`,不经 store;而 `agentStore` 也有一份 thinking defaults。在设置页改了默认值,已挂载的 Agent 页 store 不会刷新。**Vue2 同样如此**(它靠切页重建掩盖),照搬 + 登记。

---


---

## Task 5: settingsStore(Pinia 整体移植)

**Files:**
- Create: `src/ai/stores/settingsStore.ts`
- Create: `src/ai/stores/settingsStore.test.ts`

**Interfaces:**
- Consumes: `service.ai.*`(下列 21 个方法,**全部已在共享包就位,不需新增**)
  `listModels` `pullModel` `deleteModel` `searchHFModels` `listHFFiles` `importHFModel` `getImportStatus` `cancelImport` `listProviders` `createProvider` `updateProvider` `deleteProvider` `listProviderModels` `refreshProviderModels` `updateProviderModels` `getPolicy` `updatePolicy` `getServicesStatus` `listBlacklist` `addBlacklistPattern` `removeBlacklistPattern`
- Produces:
  ```ts
  export const useSettingsStore = defineStore('ai-settings', () => ({
    // UI
    activeSection: Ref<SectionId>, setActiveSection(id: SectionId): void,
    resetTransientUi(): void,
    // Models
    installedModels: Ref<ModelEntry[]>, modelsLoading: Ref<boolean>,
    pullModelInput: Ref<string>, pullingModels: Ref<Record<string, true>>,
    hfQuery: Ref<string>, hfResults: Ref<HfRepo[]>, hfSearchLoading: Ref<boolean>,
    hfSelectedRepo: Ref<string | null>, hfFiles: Ref<string[]>, hfFilesLoading: Ref<boolean>,
    hfImportJobs: Ref<Record<string, ImportJob>>,
    loadModels, pullModel, deleteModel, searchHF, selectHFRepo, loadHFFiles,
    importHF, startImportJob, dismissImportJob, cancelImportJob,
    // Providers
    providers: Ref<Provider[]>, providersLoading: Ref<boolean>,
    providerForm: Ref<ProviderForm>, providerModels: Ref<Record<string, ProviderModelsEntry>>,
    loadProviders, showProviderForm, hideProviderForm, applyProviderPreset, saveProvider,
    toggleProvider, deleteProvider, loadProviderModels, refreshProviderModels,
    saveProviderModels, toggleModelFavorite, addManualModel, removeManualModel,
    // Policy
    policy: Ref<Policy | null>, policyLoading: Ref<boolean>, policySaving: Ref<boolean>,
    loadPolicy, updatePolicyField,
    // Blacklist(P2b 消费,本期只搬 store 侧)
    blacklist: Ref<BlacklistEntry[]>, blacklistLoading: Ref<boolean>,
    loadBlacklist, addBlacklist, removeBlacklist,
    // Services status
    servicesStatus: Ref<ServicesStatus>, searchStatus: Ref<{ running: boolean }>,
    parserStatus: Ref<ParserStatus>, loadServicesStatus,
  }))
  ```

**背景(实现者必读):**

Vue2 源:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Settings/store/settingsStore.js`(376 行)。**整体移植成一个 Pinia setup store**(用户 2026-07-28 决定),逐个 action 对得上 Vue2 行号。

**取数口径**:Vue2 里 `ai.xxx()` 返回 axios 原始响应,所以到处写 `resp.data`。共享包 `service.ai.*` **已经在包内解过 axios 那一层**,直接吐 body。所以 Vue2 的 `resp.data || []` 在本仓写成 `body || []`,**不要再多剥一层 `.data`**。这与 `agentStore.ts:110-130` 头注释里已经确立的口径一致,照办。

**Vue3 化的机械替换**(全部是 Vue2 响应式 API 的等价物,不算行为改动,不必逐条申报,但在文件头注释里统一说明一次):
- `Vue.observable({...})` → 一组 `ref`
- `Vue.set(obj, k, v)` → `obj[k] = v`
- `Vue.delete(obj, k)` → `delete obj[k]`
- `state.xxx` → `xxx.value`
- `actions.foo()` 内部互调 → 直接调本地函数

**要处理的三件事(必须申报):**

1. **D2 — `resetTransientUi()`**(新增,Vue2 没有)。见本计划 D2 节。重置 `activeSection` → `'models'`、`providerForm` → 初值、`hfQuery` / `hfResults` / `hfSelectedRepo` / `hfFiles` → 初值。**明确不重置** `hfImportJobs` / `pullingModels` / `installedModels` / `providers` / `policy` / `blacklist` / 三个状态字段。代码注释要写明为什么这样切。

2. **`_timer` 的存放**。Vue2 把 `setInterval` 的 id 塞进 `hfImportJobs[filename]._timer`(响应式 state 里)。**照搬**,不要「优化」成模块级 Map —— Vue2 `Settings.vue:160` 的恢复循环靠 `!job._timer` 判断,把它挪走会破坏那道守卫。`ImportJob` 类型里 `_timer` 声明成 `ReturnType<typeof setInterval> | null`。

3. **观察项登记**:`pullModel` 的 `pullingModels[name]` 在 `finally` 里立刻删除,导致「Pulling: xxx」提示只在请求在途显示。**照搬,不改**,在该函数上方注释登记(引 Vue2 `settingsStore.js:58-68`),说明后端 `POST /pull` 是否同步阻塞未知,待真机观察。

**类型定义**:所有服务端返回体在共享包里都是 `unknown`。本 store 内部定义窄接口并做一次断言,**断言处必须注释说明依据的后端契约**。不要用 `any`。

**Steps:**

- [ ] **Step 1: 写失败测试**

Create `src/ai/stores/settingsStore.test.ts`。以下是**必须覆盖的用例清单**,每条都要能真失败:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const ai = {
  listModels: vi.fn(), pullModel: vi.fn(), deleteModel: vi.fn(),
  searchHFModels: vi.fn(), listHFFiles: vi.fn(), importHFModel: vi.fn(),
  getImportStatus: vi.fn(), cancelImport: vi.fn(),
  listProviders: vi.fn(), createProvider: vi.fn(), updateProvider: vi.fn(),
  deleteProvider: vi.fn(), listProviderModels: vi.fn(), refreshProviderModels: vi.fn(),
  updateProviderModels: vi.fn(),
  getPolicy: vi.fn(), updatePolicy: vi.fn(), getServicesStatus: vi.fn(),
  listBlacklist: vi.fn(), addBlacklistPattern: vi.fn(), removeBlacklistPattern: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import { useSettingsStore } from './settingsStore'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
})
```

必须写的用例(分组列出,实现者按此逐条落):

**Models**
1. `loadModels` 把 body 直接放进 `installedModels`(mock 返回**裸数组**,断言没被多剥一层 `.data`)
2. `loadModels` 在 `finally` 里放下 `modelsLoading`,即使请求 reject(用 `await expect(...).rejects` 后断言 `modelsLoading === false`)
3. `pullModel` 空白输入直接返回、**不发请求**(`pullModelInput = '   '`)
4. `pullModel` 成功后清空 `pullModelInput`,且 `pullingModels` 在 `finally` 后**为空**(这条同时钉住上面的「观察项」现状,注释指明)
5. `deleteModel` 成功后**重新拉一次** `listModels`(断言调用次数)
6. `searchHF` 空白 query 不发请求;非空时**先清空** `hfResults` / `hfSelectedRepo` / `hfFiles` 再请求
7. `selectHFRepo` 设置 repo 并清空 `hfFiles`
8. `loadHFFiles` 无选中 repo 时不发请求
9. `importHF` 无选中 repo 时不发请求;有则调 `importHFModel(repo, file)` 后 `startImportJob`

**下载进度轮询(用 `vi.useFakeTimers()`)**
10. `startImportJob` 建条目,状态 `'downloading'`,`_timer` 非 null
11. 推进 2000ms 后拉一次 `getImportStatus`,把 `completed` / `total` / `status` 写回条目
12. 速度与 ETA:两次轮询之间 `completed` 增长 → `speed > 0`;`speed` 极小时 `etaSecs` 为 `null`
13. `status === 'success'` → 清定时器 + 重拉 `listModels`;再推进 3000ms → 条目被移除
14. `status === 'error'` → 清定时器,**条目保留**(用户要能看到错误)
15. `getImportStatus` 抛 404 → 清定时器 + 移除条目;抛非 404 → **条目保留、定时器继续**(对照组,证明 404 分支有判别力)
16. `dismissImportJob` / `cancelImportJob` 都清定时器并移除条目;`cancelImportJob` 额外调 `cancelImport` 且**其失败被吞掉**(不 reject)

**Providers**
17. `showProviderForm(p)` 编辑态**不回填 api_key**(断言 `providerForm.data.api_key === ''`,而 `name` / `base_url` 有值)
18. `showProviderForm()` 无参 → 全空表单 + `editing === null`
19. `applyProviderPreset` 覆盖 name/base_url/default_model/protocol,**不动 api_key**
20. `saveProvider` name 或 base_url 空白 → **抛错且不发请求**(两条,分别测)
21. `saveProvider` 编辑态且 `api_key` 为空 → payload 里**不含** `api_key` 键(用 `expect(payload).not.toHaveProperty('api_key')`,不是断言它等于 `''`)
22. `saveProvider` 编辑态且 `api_key` 非空 → payload **含** `api_key`
23. `saveProvider` 成功后收起表单 + 重拉 `listProviders`
24. `toggleProvider` 成功 → 就地替换那一项的 `enabled`,其它项不动
25. `toggleProvider` 失败 → `providers` 回滚到调用前的快照**且重新抛出**
26. `loadProviderModels` 失败 → `loading` 置回 false、**保留上次的 models**(不清空)且重新抛出
27. `toggleModelFavorite` 提交的 desired 列表里,目标项 favorite 翻转、**其余项原样**,且**只带 name/favorite 两个字段**(不带 source —— Vue2 注释说 source 是服务端权威)
28. `addManualModel` 对**已存在的同名**模型直接返回、不发请求
29. `removeManualModel` 只删 `source === 'manual'` 的同名项;同名但 `source !== 'manual'` 的**保留**(对照组)

**Policy**
30. `updatePolicyField` 乐观更新:先改本地再发请求
31. `updatePolicyField` 失败 → 回滚到旧对象**且重新抛出**
32. `updatePolicyField` 在 `policy` 为 null 时先填默认值 `{ allow_remote: false, default_backend: 'local', escalation_prompt: false }` 再改

**Services status**
33. `loadServicesStatus` 成功 → 三个布尔用 `?? false` 归一(mock 返回 `{ ollama: {} }`,断言 `ollama === false` 而不是 undefined)
34. `loadServicesStatus` **整体失败被吞掉**(不 reject),且三组状态全部落到「关闭」默认值

**D2 重置**
35. `resetTransientUi()` 把 `activeSection` / `providerForm` / hf 搜索四态复位
36. `resetTransientUi()` **不动** `hfImportJobs` / `installedModels` / `providers` / `policy`(对照组,证明重置范围是精确的)

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/ai/stores/settingsStore.test.ts
```

预期:FAIL,`Failed to resolve import "./settingsStore"`。

- [ ] **Step 3: 写实现**

按上文「背景」逐条落地。文件头注释模板:

```ts
// SP8-P2a Task 5 —— 1:1 移植自 Vue2
// `src/views/AI/Settings/store/settingsStore.js`(376 行),整体搬成一个
// Pinia setup store(用户 2026-07-28 决定;拆分会让顶栏状态灯、导航徽标这些
// 跨分区读数变成 store 互相引用,得不偿失)。
//
// 【取数口径】Vue2 里 `ai.xxx()` 返回 axios 原始响应,所以处处写 `resp.data`。
// 共享包 `service.ai.*` 已在包内解过那一层,直接吐 body。故 Vue2 的
// `resp.data || []` 这里写作 `body || []`,**不再多剥一层 .data**。
// 与 agentStore.ts:110-130 头注释确立的口径一致。
//
// 【Vue2 响应式 API 的机械替换】(等价物,非行为改动)
//   Vue.observable({...}) → 一组 ref
//   Vue.set(o, k, v)      → o[k] = v
//   Vue.delete(o, k)      → delete o[k]
//   state.x               → x.value
//
// 【与 Vue2 的行为差:resetTransientUi()】详见函数上方注释。根因是 Vue2 的
// `createSettingsStore()` 每次挂载新建、卸载丢弃,而 Pinia 是全局单例。
//
// 【主题】不在本 store —— 见 `./aiTheme`(Agent 页与设置页共享)。
```

`resetTransientUi` 上方的注释模板:

```ts
  /**
   * SP8-P2a D2 —— Vue2 没有这个动作,本仓必须有。
   *
   * Vue2 `Settings.vue:101` 每次挂载都 `createSettingsStore()` 新建一份 state,
   * 组件卸载即丢弃,所以每次进设置页 activeSection 恒为 'models'、表单恒收起、
   * HF 搜索结果恒为空。Pinia 是全局单例,会把上次离开时的瞬态 UI 状态原样带
   * 回来 —— 那是架构差异,不是 Vue2 的行为,必须显式复位以保持 1:1。
   *
   * 精确切分:**只重置瞬态 UI**。刻意不动
   *   - hfImportJobs / pullingModels:真在后台跑的任务,清了进度条就没了
   *   - installedModels / providers / policy / blacklist / *Status:服务端数据
   *     缓存,清了页面会先白一下再重填,视觉上反而比 Vue2 差
   */
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/ai/stores/settingsStore.test.ts
```

预期:36 条全 PASS。

- [ ] **Step 5: RED 验证三条关键断言**

对下列三条,各做一次「故意弄坏 → 看到红 → 复原 → 看到绿」,**六段真实输出全部贴进报告**:

1. 用例 21(编辑态空 api_key 不进 payload):把 `if (data.api_key) payload.api_key = data.api_key` 改成无条件赋值
2. 用例 25(toggleProvider 失败回滚):把 catch 里的回滚行注释掉
3. 用例 36(resetTransientUi 不动 hfImportJobs):在重置函数里加一行清空 `hfImportJobs`

- [ ] **Step 6: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/stores/settingsStore.ts src/ai/stores/settingsStore.test.ts
git commit -m "SP8-P2a Task 5: settingsStore 整体移植成 Pinia(含 D2 瞬态状态复位)"
git show --stat HEAD && git status
```

---


