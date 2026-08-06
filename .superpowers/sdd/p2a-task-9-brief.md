# SP8-P2a Task 9 — 任务简报

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

## Task 9: ModelsSection(本地模型)

**Files:**
- Create: `src/ai/components/settings/sections/ModelsSection.vue`
- Create: `src/ai/components/settings/sections/ModelsSection.test.ts`
- Create: `src/ai/util/formatModelSize.ts`
- Create: `src/ai/util/formatModelSize.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`(映射表 `models` 项 + import)

**Interfaces:**
- Consumes: T5 `useSettingsStore` · T1 图标(`refresh` / `trash` / `download` / `search`)· T6 无 · 共享 `useToast` · 共享 `AlertDialog`
- Produces:
  ```ts
  // formatModelSize.ts
  export function formatModelSize(bytes: number | null | undefined): string
  export function formatEtaSeconds(secs: number): { unit: 'sec' | 'min' | 'hr'; n: number }
  ```

**背景:**

Vue2 源 `src/views/AI/Settings/sections/ModelsSection.vue`(222 行)。三张卡:

1. **已装模型**:卡头(标题 + 计数 + 刷新)· **下载进度横幅**(每个 `hfImportJobs` 条目一条)· 加载中 / 空态 / 表格(名称 / 体积 / 删除)
2. **从 Ollama 拉取**:输入框 + 拉取按钮 + 在途提示
3. **从 HuggingFace 导入 GGUF**:搜索框 + 仓库结果列表 + 选中仓库的文件列表 + 逐个导入

**下载进度横幅**四态(Vue2 `:21-60`):`downloading` / `creating model` / `success` / `error`,分别决定标题文案、`.dl-banner` 的 class、取消按钮文案(error 时是「关闭」走 `dismissImportJob`,否则「取消」走 `cancelImportJob`)、进度条宽度、统计行(百分比 / 已下载 / 速度 / ETA)或错误信息、以及下载中才出现的「勿关机」警告。

**两个纯函数抽出来单独测**(Vue2 里是组件 methods,抽出是为了能精确测边界 —— 这属于**结构调整而非行为改动**,注释说明):

```ts
// formatModelSize —— 逐字对齐 Vue2 ModelsSection.vue:170-175
//   !bytes → '—'(注意:0 也走这条,Vue2 如此,照搬)
//   >= 1 GB → `${gb.toFixed(1)} GB`
//   否则   → `${mb.toFixed(0)} MB`
// formatEtaSeconds —— 逐字对齐 Vue2 :176-180
//   < 60    → { unit: 'sec', n: Math.round(secs) }
//   < 3600  → { unit: 'min', n: Math.round(secs / 60) }
//   否则    → { unit: 'hr',  n: Number((secs / 3600).toFixed(1)) }
// 返回结构体而非字符串:i18n 的复数/单位要在组件里过 $t,纯函数不持本地化文本
// (与 P1c2 Task 10 formatDuration 的处理同款)。
```

**Buefy 替换**:
- `$buefy.dialog.confirm`(删模型)→ 共享 `AlertDialog`,`destructive` 置 true
- `$buefy.toast.open({type:'is-success'})` → `toast.show(msg)`(info 档)
- `type:'is-danger'` → `toast.show(msg, 1500, 'danger')`

**Steps:**

- [ ] **Step 1: 写 formatModelSize 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { formatModelSize, formatEtaSeconds } from './formatModelSize'

describe('formatModelSize', () => {
  it('1 GB 及以上用 GB,一位小数', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(4.7 * 1024 ** 3)).toBe('4.7 GB')
  })
  it('1 GB 以下用 MB,整数', () => {
    expect(formatModelSize(500 * 1024 ** 2)).toBe('500 MB')
  })
  it('恰好 1 GB 的边界走 GB 分支', () => {
    expect(formatModelSize(1024 ** 3)).toBe('1.0 GB')
    expect(formatModelSize(1024 ** 3 - 1)).toMatch(/MB$/)
  })
  it('0 / null / undefined 都是破折号(Vue2 :171 是真值判断,0 也落这里)', () => {
    expect(formatModelSize(0)).toBe('—')
    expect(formatModelSize(null)).toBe('—')
    expect(formatModelSize(undefined)).toBe('—')
  })
})

describe('formatEtaSeconds', () => {
  it('60 秒以下按秒', () => {
    expect(formatEtaSeconds(45)).toEqual({ unit: 'sec', n: 45 })
    expect(formatEtaSeconds(59.6)).toEqual({ unit: 'sec', n: 60 })
  })
  it('60 是分钟分支的下边界', () => {
    expect(formatEtaSeconds(60)).toEqual({ unit: 'min', n: 1 })
  })
  it('3600 是小时分支的下边界', () => {
    expect(formatEtaSeconds(3599)).toEqual({ unit: 'min', n: 60 })
    expect(formatEtaSeconds(3600)).toEqual({ unit: 'hr', n: 1 })
  })
  it('小时保留一位小数', () => {
    expect(formatEtaSeconds(5400)).toEqual({ unit: 'hr', n: 1.5 })
  })
})
```

- [ ] **Step 2: 跑测试确认它红,写实现,跑绿**

```bash
pnpm exec vitest run src/ai/util/formatModelSize.test.ts
```

- [ ] **Step 3: 写 ModelsSection 失败测试**

必须覆盖:

1. 空态:`installedModels` 为空 → 渲染空态文案,**不渲染** `.set-table`
2. 加载中:`modelsLoading` → 渲染「加载中…」
3. 有模型 → 表格行数正确,体积列走 `formatModelSize`
4. 卡头计数等于 `installedModels.length`
5. 刷新按钮调 `store.loadModels`
6. 删除按钮先弹确认框(断言 `AlertDialog` 的 `open` 变 true),**此时还没调 `deleteModel`**
7. 确认后才调 `store.deleteModel(name)` 并弹成功 toast
8. `deleteModel` reject → 弹 danger 档 toast(断言 tier 参数)
9. 拉取:输入为空时按钮 `disabled`
10. 拉取:有输入 → 点击调 `store.pullModel`,成功弹 toast
11. 拉取:回车等同点击
12. `pullingModels` 非空 → 渲染在途提示;为空 → 不渲染(对照组)
13. HF 搜索:空 query 时按钮 disabled;有 query 时点击调 `store.searchHF`
14. HF 搜索中 → 渲染「搜索中…」
15. HF 结果列表渲染,点某项调 `store.selectHFRepo(id)`,选中项 `data-active="true"`
16. 选中 repo 后渲染文件区;点「加载文件」调 `store.loadHFFiles`
17. 文件列表每项的导入按钮调 `store.importHF(file)`
18. **下载横幅四态**(四条独立用例):
   - `downloading` → 标题「导入中」、有「勿关机」警告、取消按钮文案是「取消」
   - `creating model` → 标题「正在注册模型…」、仍有警告
   - `success` → 标题「导入完成」、**无取消按钮**、**无警告**
   - `error` → 标题「导入失败」、按钮文案「关闭」、渲染错误文本、**无统计行**
19. 横幅进度条宽度:`total > 0` → 百分比;`total === 0` → `0%`(对照组,防除零)
20. 横幅 `speed > 0` 才渲染速度;`etaSecs` 非 null 才渲染 ETA(两条对照)
21. error 态点「关闭」调 `dismissImportJob`;downloading 态点「取消」调 `cancelImportJob`(两条,证明分流正确)

- [ ] **Step 4: 跑红 → 写实现 → 跑绿**

- [ ] **Step 5: 加 i18n 键**

`aiCfg` 前缀,覆盖 Vue2 该文件里全部 `$t(...)` 调用。中文值先查 Vue2 生产 `zh_CN.json`(用 Global Constraints 里给的命令),查得到的逐字复用,查不到的自拟并在报告里列出自拟清单。

> ⚠️ 「⚠️ Do not shut down the NimoOS machine during download, or the download will need to restart.」这条 Vue2 把 emoji 写进了 key 里,本仓 key 名用 `aiCfgDownloadWarning`,**文案值保留开头的 ⚠️ emoji**(视觉 1:1)。

- [ ] **Step 6: 挂进 SettingsPage**

改 `src/ai/views/SettingsPage.vue` 两处:加 import、映射表 `models` 项从 `SectionPlaceholder` 换成 `ModelsSection`。

- [ ] **Step 7: RED 验证**

对用例 19(`total === 0` 时进度条 `0%`),把三元去掉直接算 `completed/total*100`,重跑必须红(`NaN%`);复原跑绿。两段输出贴报告。

- [ ] **Step 8: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/ModelsSection.vue src/ai/components/settings/sections/ModelsSection.test.ts src/ai/util/formatModelSize.ts src/ai/util/formatModelSize.test.ts src/ai/views/SettingsPage.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2a Task 9: ModelsSection(本地模型)"
git show --stat HEAD && git status
```

---


