# SP8-P2a Task 10 — 任务简报

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

## Task 10: ProvidersSection(云服务商)

**Files:**
- Create: `src/ai/components/settings/sections/ProvidersSection.vue`
- Create: `src/ai/components/settings/sections/ProvidersSection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`(映射表 `providers` 项 + import)

**Interfaces:**
- Consumes: T5 `useSettingsStore` · T6 `SetSwitch` + `PromptDialog` · T1 图标(`plus` / `chevDown` / `edit` / `trash` / `refresh` / `x`)· 共享 `useToast` / `AlertDialog`
- Produces: 无(叶子组件)

**背景:**

Vue2 源 `src/views/AI/Settings/sections/ProvidersSection.vue`(249 行)—— **本期最大件**。三块:

1. **服务商表格**:名称 / Base URL / 协议徽章 / 启用开关 / 操作(展开模型、编辑、删除)
2. **可展开的「模型」子面板**(表格里插一整行 `colspan=5`):刷新模型、手动添加、每个模型一个收藏开关 + 🧠 思考标记 + 来源徽章 + manual 项的删除
3. **内联表单**(不是弹窗,是表格下面又一张 `sk-section` 卡):4 个预设 chip(仅新建时出现)+ 名称 / Base URL / API Key / 默认模型 / 协议单选 + 保存 / 取消

**四个预设**(Vue2 `:151-156`)逐字照搬,**不改 URL 和默认模型名**:

```ts
const PRESETS = [
  { name: 'OpenAI',    base_url: 'https://api.openai.com/v1',    default_model: 'gpt-4o',            protocol: 'openai' },
  { name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', default_model: 'claude-sonnet-4-6', protocol: 'anthropic' },
  { name: 'DeepSeek',  base_url: 'https://api.deepseek.com/v1',  default_model: 'deepseek-chat',     protocol: 'openai' },
  { name: 'Moonshot',  base_url: 'https://api.moonshot.cn/v1',   default_model: 'moonshot-v1-8k',    protocol: 'openai' },
]
```

**展开状态 `expanded`** 是组件本地 ref(Vue2 也是组件本地 `data`),不进 store。首次展开某个服务商时才拉它的模型列表(`if (open && !store.providerModels[p.id])`),照搬这个懒加载守卫。

**Buefy 替换**:
- `$buefy.dialog.confirm`(删服务商,文案含「API Key 也会一并删除」)→ `AlertDialog`,`destructive`
- `$buefy.dialog.prompt`(手动加模型)→ **T6 的 `PromptDialog`**;确认回调里 `(value || '').trim()`,空则直接返回
- toast 三档:成功/中性 → info;`Auto-fetch failed. You can add models manually.` → **warning 档**(Vue2 是 `is-warning`);其余失败 → danger

**⚠️ Vue3 迁移必改的一处**:Vue2 `:28` 是 `<template v-for="p in ...">` 且把 `:key` 打在**子元素**上。Vue3 要求 `:key` 打在 `<template>` 上。改法与 P1c2 Task 9 的 ModelPicker 同款(那次已有先例),注释说明这是 Vue3 的语法要求,非行为改动。**但注意**:Vue2 这里一个 `p` 会产出**两行 `<tr>`**(主行 + 展开行),`:key` 从子元素挪到 template 后只剩一个 key —— 这是正确的(Vue3 会把 template 下的多个节点当一组)。

**Steps:**

- [ ] **Step 1: 写失败测试**

必须覆盖:

1. 空态 / 加载中 / 有数据三态(三条)
2. 卡头计数
3. 表格列渲染:名称、base_url 走 `.mono`、协议徽章 `.set-proto`(`protocol` 缺失时显示 `'openai'` 兜底 —— Vue2 `:33` 的 `||`)
4. 启用开关反映 `p.enabled`;拨动调 `store.toggleProvider(id, v)`
5. `toggleProvider` reject → danger toast
6. 「添加」按钮调 `store.showProviderForm()`(无参)
7. 「编辑」按钮调 `store.showProviderForm(p)`(带参)
8. 「删除」先弹确认框、确认后才调 `store.deleteProvider(id)`
9. `providerForm.visible` 为 false → **不渲染**表单卡(对照组)
10. 新建态渲染 4 个预设 chip;编辑态**不渲染**(对照组)
11. 点预设 chip 调 `store.applyProviderPreset(preset)`,传的对象是那四条之一(断言 base_url 精确值)
12. API Key 输入框 `type="password"`;编辑态 placeholder 是「留空则保持不变」,新建态是 `API Key`(两条)
13. 协议单选两项,绑 `providerForm.data.protocol`
14. 保存按钮在 `saving` 时 disabled;点击调 `store.saveProvider`
15. `saveProvider` reject 且带 message → toast 用**该 message**;不带 message → 用兜底「保存失败」(两条)
16. 取消按钮调 `store.hideProviderForm`
17. 「展开模型」首次点击 → 渲染子面板 **且**调 `store.loadProviderModels(id)`
18. 再次点击 → 收起子面板
19. 已有 `providerModels[id]` 缓存时展开 → **不再调** `loadProviderModels`(懒加载守卫,对照组)
20. `loadProviderModels` reject → danger toast
21. 子面板:`loading` → 「加载中…」;模型为空 → 空态提示;有模型 → 列表(三条)
22. 模型收藏开关调 `store.toggleModelFavorite(providerId, name, v)`
23. `supports_thinking` 为 true 才渲染 🧠(两条对照)
24. `source === 'manual'` 才渲染删除按钮(两条对照);点击调 `store.removeManualModel`
25. 「刷新模型」调 `store.refreshProviderModels`;成功 → info toast;失败 → **warning 档** toast(断言 tier 是 `'warning'` 而不是 `'danger'`)
26. 「+ 手动添加」打开 `PromptDialog`(断言其 `open` 为 true)
27. PromptDialog 确认非空值 → 调 `store.addManualModel(id, trimmed)`,**传的是 trim 过的值**
28. PromptDialog 确认**空白值**(如 `'   '`)→ **不调** `addManualModel`(对照组)
29. `addManualModel` reject → danger toast

- [ ] **Step 2: 跑红 → 写实现 → 跑绿**

- [ ] **Step 3: 加 i18n 键** —— 同 Task 9 的规则(`aiCfg` 前缀,优先复用 Vue2 生产译文)。

- [ ] **Step 4: 挂进 SettingsPage**(映射表 `providers` 项)

- [ ] **Step 5: RED 验证两条**

1. 用例 19(懒加载守卫):去掉 `&& !store.providerModels[p.id]`,重跑必须红
2. 用例 27/28(trim 与空值守卫):去掉 `if (!name) return`,重跑用例 28 必须红

四段输出贴报告。

- [ ] **Step 6: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/ProvidersSection.vue src/ai/components/settings/sections/ProvidersSection.test.ts src/ai/views/SettingsPage.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2a Task 10: ProvidersSection(云服务商)"
git show --stat HEAD && git status
```

---


