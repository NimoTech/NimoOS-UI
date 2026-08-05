# SP8-P2a Task 8 — 任务简报

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

## Task 8: SettingsPage 页面壳 + 路由 + scroll-spy + 深链

**Files:**
- Create: `src/ai/views/SettingsPage.vue`
- Create: `src/ai/views/SettingsPage.test.ts`
- Create: `src/ai/components/settings/SectionPlaceholder.vue`
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: T1 图标 · T2 样式 · T3 `sections.ts` · T4 `useAiTheme` · T5 `useSettingsStore` · T7 `SettingsRail`
- Produces: 路由 `/ai/settings`(name `ai-settings`)。T9/T10/T11 的分区组件会挂进本页的 `SECTION_COMPONENTS` 映射表 —— **本任务先把 4 个模型组分区登记成 `SectionPlaceholder`**,由各自任务替换。

**背景:**

Vue2 源 `src/views/AI/Settings/Settings.vue`(243 行)。这是本期结构最复杂的一件,拆成六块:

**① 根元素与主题**
```html
<div class="agent-app set-app" :data-theme="aiTheme.theme">
```
`agent-app` 提供 token(T2 的注释解释过),`set-app` 提供布局。

**② 顶栏**(Vue2 `:9-31`):组标题 + 5 个状态灯 + 「详情」+ 刷新 + 日夜切换。
- 5 个灯:Ollama / OpenVINO / Agent / Search / Parser。`pillState(v)`:`true` → `'ok'`,`false` → `'off'`,其它 → `''`(空串,即中性灰)。**照搬这个三态,不要简化成布尔。**
- Parser 灯特殊:自己的 `parserPillState`(不跑 → `'off'`;暂停 → `'warn'`;否则 `'ok'`)+ 待办计数徽标 + 暂停图标 + `title` 提示三态。
- 「详情」:Vue2 是 `<router-link to="/ai/knowledge">`。**本期改成 `<button>` + info toast 占位**(SP8-P5 才有该路由,`router.push` 到不存在的路由会落空白死页)。样式类名 `.set-detail-link` 保持不变。**代码注释注明这是 P5 前的占位。**
- 刷新按钮 → `store.loadServicesStatus()`;日夜按钮 → `aiTheme.toggleTheme()`。

**③ 内容区两种渲染模式**(Vue2 `:33-46`):
- `activeGroup.stack === true`:`v-for` 渲染组内**全部**分区,每个包一层 `<section class="set-stack-item" :data-section-id="item.id">`
- `stack === false`:只渲染 `SECTION_COMPONENTS[activeSection]` 一个
- `isSplitSection`(非 stack 组 且 `activeSection ∈ SPLIT_SECTIONS`)→ 给 `.set-body` 加 `set-body-split` 类。**本期没有组件会真的用到它**(skills/mcp 是占位),但类名逻辑照搬,注释说明。

**④ scroll-spy**(Vue2 `:214-240`):IntersectionObserver,`root` = `.set-body` 元素,`rootMargin: '0px 0px -55% 0px'`,`threshold: 0`。回调里维护 `visible[sid] = isIntersecting ? boundingClientRect.top : null`,取 `top` 最小的那个作为高亮。
- `_suppressSpy` 抑制:点导航时置 true,`releaseSpy()` 在 650ms 后置回 false(避免平滑滚动途中高亮乱跳)
- `activeGroup.id` 变化时重新 arm observer(锚点集合变了)
- 高亮时**只改 `activeSection`,不动 URL**(Vue2 `:234` 明确注释了)
- **卸载时必须 `disconnect()`** + 清 `_spyTimer` + 清 15s 轮询定时器(Vue2 `beforeDestroy` 做了这三件,照搬到 `onUnmounted`)

**⑤ `?section=` 深链契约**(Vue2 `:108-110`、`:142-147`、`:194-196`):
- 挂载时:读 `route.query.section`,在 `VALID_SECTIONS` 里才采纳
- watch `route.query.section`:变化且合法 → `setActiveSection` + `nextTick` 滚过去
- 点导航时:`setActiveSection` → 置 `_suppressSpy` → 若 URL 里的 section 不同则 `router.replace({ path: '/ai/settings', query: { section: id } })` → `nextTick` 滚过去

**⑥ 生命周期**(Vue2 `:154-178`):
- `onMounted` 顺序:**先 `store.resetTransientUi()`**(D2)→ 再读 `?section=` → 再依次 `loadServicesStatus` / `loadModels` / `loadProviders` / `loadPolicy`(**每个各自 try/catch 吞错**,Vue2 就是这样,照搬)→ 再跑下载恢复循环 → 再起 15s 轮询 → `nextTick` 里 `setupSpy()` + 若当前组是 stack 则滚到当前分区
- **下载恢复循环必须保留 `&& !job._timer` 守卫**(D3),并在上方写 D3 的申报注释
- `onUnmounted`:清 15s 轮询、`disconnect()` observer、清 spy timer

**`SectionPlaceholder.vue`**:一个用 `.set-inner` + `.sk-section` 包起来的简单面板,props `{ titleKey: string; bodyKey: string }`,渲染 `<h1 class="set-h1">` + `<p class="set-desc">`。用于 skills / mcp(P3/P4)以及本任务阶段的 4 个模型组分区占位。

**skills / mcp 的占位 toast**:当 `setActiveSection` 的目标 ∈ `DEFERRED_SECTIONS` 时,除了切过去,还要 `toast.show(t('aiCfgSectionDeferred'), 3000)`。

**Steps:**

- [ ] **Step 1: 写失败测试**

必须覆盖的用例清单(实现者按此逐条写,mock 掉 `useSettingsStore` 的网络动作):

1. 根元素同时带 `agent-app` 与 `set-app` 两个 class
2. `data-theme` 跟随 `useAiTheme().theme`;`toggleTheme` 后变化
3. 顶栏渲染 5 个 `.set-pill`
4. `pillState` 三态:`true` → `data-s="ok"`,`false` → `data-s="off"`,`null`/`undefined` → `data-s=""`(**三条分别断言**,不要只测一条)
5. Parser 灯:不跑 → `off`;跑且暂停 → `warn`;跑且未暂停 → `ok`(三条)
6. Parser 待办 > 0 时渲染 `.badge-count` 且文本是数字;为 0 时**不渲染**(对照组)
7. Parser 暂停时渲染 `.badge-pause`;未暂停时不渲染(对照组)
8. 「详情」按钮点击**不调 `router.push`**、只弹 toast(断言 `push` 未被调用 —— 这是本期的明确占位契约)
9. 刷新按钮调 `store.loadServicesStatus`
10. stack 组(`model`)渲染组内 4 个 `.set-stack-item`,`data-section-id` 依次是 `models` / `providers` / `privacy` / `thinking`
11. swap 组(`channel`)只渲染 1 个分区,**没有** `.set-stack-item`
12. `activeSection = 'skills'` 时 `.set-body` 带 `set-body-split` 类;`activeSection = 'mcptokens'`(同组但非 split)时不带
13. `onMounted` 先调 `resetTransientUi` **再**读 `?section=`(用 mock 的调用顺序断言:`resetTransientUi` 的调用序号 < `setActiveSection` 的)
14. 挂载时 `?section=providers` 被采纳
15. 挂载时 `?section=bogus`(非法值)**被忽略**,停在 `models`(对照组)
16. `route.query.section` 变化 → 调 `setActiveSection`
17. 点导航 emit `select` → `setActiveSection` + `router.replace` 带上新 query
18. 点导航时若 URL 里已是同一个 section → **不调 `router.replace`**(Vue2 `:194` 的守卫)
19. 选中 `skills` → 弹一条 toast(`DEFERRED_SECTIONS` 契约)
20. 选中 `providers`(非 deferred)→ **不弹 toast**(对照组)
21. `onMounted` 依次调 `loadServicesStatus` / `loadModels` / `loadProviders` / `loadPolicy`
22. 其中任一 reject **不阻断后面几个**(让 `loadModels` reject,断言 `loadProviders` 仍被调用)
23. 15s 轮询:`vi.useFakeTimers()`,推进 15000ms → `loadServicesStatus` 多调一次
24. `onUnmounted` 后再推进 15000ms → **不再新增调用**(证明定时器被清了)
25. 返回按钮 → `router.push('/ai/agent')`
26. 下载恢复循环:`hfImportJobs` 里有一个 `status: 'downloading'` 且 `_timer: null` 的条目 → 挂载后 `startImportJob` 被调用
27. 同上但 `_timer` 非 null → **不调用**(D3 的守卫,对照组)
28. 同上但 `status: 'error'` → **不调用**(对照组)

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/ai/views/SettingsPage.test.ts
```

- [ ] **Step 3: 写 `SectionPlaceholder.vue`**

- [ ] **Step 4: 写 `SettingsPage.vue`** —— 按「背景」六块逐一落地。

`SECTION_COMPONENTS` 映射表本任务的形态(后续任务替换前四个):

```ts
// SP8-P2a —— section id → 组件。必须与 sections.ts 的 id、以及 `?section=`
// 深链契约三方同步(Vue2 Settings.vue:75-90 同款约定)。
//
// 本期(P2a)只实现「模型」组的 4 个;其余 9 个渲染 SectionPlaceholder:
//   blacklist / execution / search / memory / observability / mcptokens / channels → P2b
//   skills → P3 · mcp → P4
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: ModelsSection,          // Task 9 替换
  providers: ProvidersSection,    // Task 10 替换
  privacy: PrivacySection,        // Task 11 替换
  thinking: ThinkingDefaultsSection, // Task 11 替换
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

> 本任务先让四个模型组分区也指向 `SectionPlaceholder`(Task 9/10/11 各自改一行 + 加 import)。这样本任务可独立通过测试,不用等分区实现。

D3 申报注释模板(放在恢复循环上方):

```ts
  // SP8-P2a D3 —— 逐字移植自 Vue2 `Settings.vue:159-163`,含 `!job._timer` 守卫。
  //
  // 【申报:同样的代码在本仓才第一次真正执行】Vue2 的 `createSettingsStore()`
  // 每次挂载新建 state,`hfImportJobs` 恒为 {},所以这个循环在 Vue2 里从未跑过
  // 一次 —— 实际效果是离开设置页进度条就没了,而后台 setInterval 仍持有已废弃
  // 的 store 闭包(泄漏)。本仓 store 是 Pinia 单例,任务与定时器都还在,该循环
  // 第一次有了意义:回到页面进度条继续显示。
  //
  // 这是「照搬后行为变好」,不是 bug 修复。`&& !job._timer` 那道守卫必须保留:
  // 它正是防止对同一个文件重复起第二个定时器的闸。
```

- [ ] **Step 5: 注册路由**

在 `src/router/index.ts` 的 `/ai/agent` 之后追加(**只加这一行 + 一行 import**,不要动别的路由,压低与 SP6/SP7 会话的冲突面):

```ts
import SettingsPage from '../ai/views/SettingsPage.vue'
// ...
  { path: '/ai/settings', name: 'ai-settings', component: SettingsPage },
```

- [ ] **Step 6: 加 i18n 键**

```ts
// zh_cn.ts / en_us.ts
aiCfgDetails:          '详情'                        / 'Details'
aiCfgRefresh:          '刷新'                        / 'Refresh'
aiCfgToggleTheme:      '切换主题'                     / 'Toggle theme'
aiCfgParserNotRunning: 'Parser 未运行'                / 'Parser not running'
aiCfgParserPaused:     '已暂停 · 待处理:{pending} · 并发:{concurrency}'  / 'Paused · pending: {pending} · concurrency: {concurrency}'
aiCfgParserRunning:    '运行中 · 待处理:{pending} · 并发:{concurrency}'  / 'Running · pending: {pending} · concurrency: {concurrency}'
aiCfgSectionDeferred:  '该分区将在后续阶段开启'          / 'This section will be enabled in a later phase'
aiCfgKnowledgeSoon:    '知识库详情页将在后续阶段开启'     / 'The knowledge details page will be enabled in a later phase'
aiCfgPlaceholderBody:  '该分区尚未迁移到新界面,将在后续阶段开启。' / 'This section has not been migrated yet — coming in a later phase.'
```

- [ ] **Step 7: 跑测试确认绿** —— 28 条全 PASS。

- [ ] **Step 8: RED 验证两条**

1. 用例 13(reset 在读 query 之前):把两行调换顺序,重跑必须红
2. 用例 27(D3 的 `!job._timer` 守卫):去掉守卫,重跑必须红

四段输出贴报告。

- [ ] **Step 9: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts src/ai/components/settings/SectionPlaceholder.vue src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2a Task 8: SettingsPage 壳 + 路由 + scroll-spy + ?section= 深链"
git show --stat HEAD && git status
```

---


