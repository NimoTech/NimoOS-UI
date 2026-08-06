# SP8-P2a Task 2 — 任务简报

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

## Task 2: 页面样式移植(settings-styles.scss + sk-shared.scss)

**Files:**
- Create: `src/ai/styles/settings-styles.scss`
- Create: `src/ai/styles/sk-shared.scss`
- Modify: `src/ai/styles/tokens.scss`(仅头部例外清单注释)

**Interfaces:**
- Consumes: `src/ai/styles/tokens.scss` 已有的 `--bg-app` / `--bg-sunken` / `--bg-elevated` / `--bg-canvas` / `--bg-chip` / `--line` / `--line-faint` / `--line-strong` / `--text-primary` / `--text-secondary` / `--text-tertiary` / `--text-quaternary` / `--accent` / `--accent-hover` / `--accent-soft` / `--accent-softer` / `--success` / `--warning` / `--danger` / `--purple` / `--grad-iri` / `--glass-strong` / `--font-sans` / `--font-mono` / `--r-sm` / `--r-md` / `--r-lg` / `--shadow-xs`
- Produces: 类名 `.set-app` `.set-rail` `.set-nav-*` `.set-foot` `.set-main` `.set-topbar` `.set-pill` `.set-body` `.set-inner` `.set-stack-item` `.set-h1` `.set-desc` `.set-rows` `.set-row` `.set-input` `.set-select` `.set-table` `.set-tbtn` `.set-minibtn` `.set-cardhead` `.set-addrow` `.set-addbtn` `.set-note` `.set-actions` `.set-banner` `.set-form` `.pm-*` `.dl-*` `.hf-*` `.set-proto` `.set-ibtn` `.set-detail-link`,以及 `.sk-section` `.sk-section-head` `.sk-section-title` `.sk-section-hint` `.sk-section-body` `.sk-btn`(+ `.ghost` / `.primary` / `.danger` 变体)

**背景(实现者必读):**

这是**机械移植任务**。Vue2 源文件:

- `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Settings/settings-styles.scss`(316 行,**整档**)
- `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/skills-styles.scss` 的第 **338–353** 行(`.sk-section` 系列 5 条)与第 **698–726** 行(`.sk-btn` 及三个变体)

**逐行复制**。允许且仅允许以下改动:

1. **`.set-app` 的作用域基座**:Vue2 里 `.set-app` 上挂 `:data-theme`,并靠 `tokens.scss` 在 `.set-app` 上也定义了一套 token。本仓的 `tokens.scss` 只在 `.agent-app` 定义 token,所以**在 `settings-styles.scss` 顶部加一行 `@import` 是错的**。正确做法:让 `SettingsPage.vue` 的根元素**同时带 `.agent-app` 和 `.set-app` 两个 class**(T8 负责),token 从 `.agent-app` 继承。本文件不重复定义任何 token。
   > 在文件头注释里写清这一点。
2. **`code { ... }` 那条「Defeat Bulma's global code styling」**(Vue2 `:289-291`):New-UI 没有 Bulma,该规则的动机不存在。**但仍然保留** —— 它给 `<code>` 一个和设计一致的外观,删掉会让将来任何 `<code>` 裸奔。把注释改写成中文并说明「Vue2 原注释提到的 Bulma 在本仓不存在,保留是为了 `<code>` 的统一外观」。
3. **`@media (max-width: 720px)` 响应式块**逐字保留。
4. **不改任何颜色字面量**(见下)。

**关于裸色 —— 本任务的核心裁定:**

Vue2 这两处样式里有约 20 个裸色(`#fff`、`rgba(52,199,89,0.16)`、`rgba(255,59,48,0.08)`、`rgba(0,122,255,0.22)`、`rgba(175,82,222,0.12)`、`rgba(200,134,10,0.09)`、`rgba(215,73,59,0.07)`、`rgba(255,255,255,0.2)`、`white`、`#e6342a` 等),绝大多数是既有 token(`--success` / `--danger` / `--accent` / `--warning` / `--purple`)的半透明版。

**裁定:整档移植,裸色原样保留,按 `agent-styles.scss` 的先例登记为例外。** 三条理由:

1. 与 P1a 建立的先例一致(`agent-styles.scss` 就是整档豁免)。
2. `color-guard` 只 glob `.vue` 与 `.css`,不扫 `.scss`,不会误报。
3. 1:1 视觉保真优先;逐个造 `--success-soft` 之类的 token 属于「与需求无关的重构」,被移植纪律禁止。

**但**:登记必须做,且**不许再往这两个文件塞新裸色**。

**Steps:**

- [ ] **Step 1: 建 `sk-shared.scss`**

```scss
// SP8-P2a Task 2 —— 从 Vue2 `src/views/AI/Skills/skills-styles.scss` 抽出的通用
// 卡片/按钮类。设置区(P2a/P2b)与将来的 Skills 区(P3)共用同一套,故独立成档,
// 不并进 settings-styles.scss。
//
// 来源逐行对照:
//   .sk-section / -head / -title / -hint / -body → skills-styles.scss:338-353
//   .sk-btn(+ ghost / primary / danger)          → skills-styles.scss:698-726
//
// 裸色例外:本档沿用 Vue2 原值(见 settings-styles.scss 头部的例外登记说明)。
// 不许再往本档塞新裸色。

.sk-section { display: flex; flex-direction: column; gap: 10px; }
.sk-section-head { display: flex; align-items: baseline; gap: 8px; }
.sk-section-title {
  font-size: 12px; font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}
.sk-section-hint { font-size: 11px; color: var(--text-quaternary); }
.sk-section-body {
  background: var(--bg-elevated);
  border: 1px solid var(--line-faint);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}

.sk-btn {
  padding: 8px 16px;
  border-radius: var(--r-sm);
  font-size: 13px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 120ms ease;
  cursor: pointer;
  border: 0;
  &.ghost { background: var(--bg-chip); color: var(--text-primary); &:hover { background: var(--line); } }
  &.primary {
    background: var(--accent);
    color: white;
    box-shadow: 0 2px 6px rgba(0,122,255,0.22);
    &:hover { background: var(--accent-hover); }
    &[disabled] {
      background: var(--bg-chip);
      color: var(--text-quaternary);
      cursor: not-allowed;
      box-shadow: none;
    }
  }
  &.danger {
    background: var(--danger);
    color: white;
    &:hover { background: #e6342a; }
  }
}
```

- [ ] **Step 2: 建 `settings-styles.scss`**

把 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Settings/settings-styles.scss` 第 1–316 行整档复制过来,在文件顶部替换原有的第 1 行注释为:

```scss
// ===== Nimo AI 设置区样式 =====
// SP8-P2a Task 2 —— 1:1 整档移植自 Vue2
// `src/views/AI/Settings/settings-styles.scss`(316 行)。
//
// 【token 基座】Vue2 在 `.set-app` 上挂 :data-theme 并由它自己那份 tokens.scss
// 提供 token。本仓的 `src/ai/styles/tokens.scss` 只在 `.agent-app` 作用域定义
// token,因此 SettingsPage.vue 的根元素同时带 `.agent-app` 与 `.set-app` 两个
// class,token 由 `.agent-app` 提供、明暗由根元素的 data-theme 切换。本档不
// 重复定义任何 token。
//
// 【裸色例外登记】本档沿用 Vue2 原始色值(约 20 处半透明字面量,多为
// --success / --danger / --accent / --warning / --purple 的透明变体),与
// `agent-styles.scss` 同属「整档 1:1 移植件」这一类例外,理由见
// tokens.scss 头部的例外清单。**不许再往本档塞新裸色**;新写的 .vue 组件
// <style> 块仍受 color-guard 全额约束。
```

> 复制时**必须逐行核对**,不要凭记忆重写。建议做法:先 `cp` 过来,再只编辑文件头注释和第 2 条允许的改动。

- [ ] **Step 3: 按上文「允许的改动」第 2 条改写 `code` 规则的注释**

把 Vue2 `:289-290` 那两行英文注释换成:

```scss
  // Vue2 原注释说这是为了压制 Bulma 全局 `code` 样式(白底红字,暗色下露白框)。
  // 本仓没有 Bulma,那个动机不存在;规则仍保留,因为它给 <code> 一个与设计
  // 体系一致的外观,删掉会让将来任何 <code> 用浏览器默认样式裸奔。
```

- [ ] **Step 4: 在 `tokens.scss` 头部例外清单追加一条**

在 `src/ai/styles/tokens.scss` 的 `// ===== 例外清单 ... =====` 段落内追加:

```scss
// 另登记一项(SP8-P2a Task 2):`src/ai/styles/settings-styles.scss` 与
// `src/ai/styles/sk-shared.scss` —— 从 Vue2 设置区/技能区整档 1:1 移植的样式档,
// 内含约 20 处半透明色字面量(多为 --success/--danger/--accent/--warning/--purple
// 的透明变体)。与 `agent-styles.scss` 同属「整档移植件」例外,原值保留以保证
// 视觉 1:1;**两档均不许再塞新裸色**,新写的 .vue 组件 <style> 块不在豁免范围内。
```

- [ ] **Step 5: 建一条守卫测试**

Create `src/ai/styles/settingsStyles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SP8-P2a Task 2 —— 样式档是机械移植件,没有运行时行为可测。这条守卫只做两件
// 事:①钉住「本档不得重复定义 token」这条架构约定 ②钉住选择器基座没被改名。
// 视觉 1:1 由 reviewer 逐行 diff Vue2 原文 + 用户 :5288 验收负责,不是本测试的职责。

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

describe('settings-styles.scss', () => {
  const css = read('./settings-styles.scss')

  it('不重复定义 token(token 只能来自 tokens.scss 的 .agent-app 作用域)', () => {
    const declarations = css.split('\n').filter((l) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })

  it('保留 .set-app 网格基座与两栏宽度', () => {
    expect(css).toContain('grid-template-columns: 258px 1fr')
  })

  it('保留 stack 模式的分区锚点样式', () => {
    expect(css).toContain('.set-stack-item')
    expect(css).toContain('scroll-margin-top')
  })

  it('保留 720px 窄屏的图标化导航栏', () => {
    expect(css).toContain('@media (max-width: 720px)')
    expect(css).toContain('grid-template-columns: 60px 1fr')
  })
})

describe('sk-shared.scss', () => {
  const css = read('./sk-shared.scss')

  it('导出设置区依赖的 6 条通用类', () => {
    for (const sel of [
      '.sk-section', '.sk-section-head', '.sk-section-title',
      '.sk-section-hint', '.sk-section-body', '.sk-btn',
    ]) {
      expect(css).toContain(sel)
    }
  })

  it('不重复定义 token', () => {
    const declarations = css.split('\n').filter((l) => /^\s*--[a-z-]+\s*:/.test(l))
    expect(declarations).toEqual([])
  })
})
```

- [ ] **Step 6: 跑测试**

```bash
pnpm exec vitest run src/ai/styles/settingsStyles.test.ts
```

预期:全 PASS。

> **RED 验证要求**:临时往 `settings-styles.scss` 里加一行 `--fake-token: red;`,重跑,第一条必须变红并报出该行;确认后**删掉**再跑一次绿。两段真实输出贴进报告。

- [ ] **Step 7: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/styles/settings-styles.scss src/ai/styles/sk-shared.scss src/ai/styles/settingsStyles.test.ts src/ai/styles/tokens.scss
git commit -m "SP8-P2a Task 2: 移植设置区样式 + 抽出 sk-* 通用类"
git show --stat HEAD && git status
```

---


