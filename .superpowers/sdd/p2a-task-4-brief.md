# SP8-P2a Task 4 — 任务简报

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

## Task 4: 应用级 AI 主题 store(aiTheme)+ agentStore 改委托

**Files:**
- Create: `src/ai/stores/aiTheme.ts`
- Create: `src/ai/stores/aiTheme.test.ts`
- Modify: `src/ai/stores/agentStore.ts`(`theme` / `toggleTheme` / `THEME_KEY` 三处)
- Modify: `src/ai/stores/agentStore.test.ts`(既有主题用例需适配,见下)

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  export type AiTheme = 'light' | 'dark'
  export const useAiTheme = defineStore('ai-theme', () => ({
    theme: Ref<AiTheme>,
    toggleTheme(): void,
    hydrateTheme(): void,   // 从 localStorage / prefers-color-scheme 装载一次
  }))
  ```
  T5(settingsStore)与 T8(SettingsPage)都消费它;`agentStore.theme` / `agentStore.toggleTheme` **对外签名保持不变**。

**背景(D1,实现者必读):**

见本计划「必须偏离 Vue2 的地方 → D1」。这是**架构差异修复**,不是重构:Vue2 靠组件销毁重建掩盖了两页各持一份 theme 的问题,Pinia 单例暴露了它。

`agentStore.ts` 现状:
- `:10` `const THEME_KEY = 'nimoos.ai.agent.theme'`
- `:136` `const theme = ref<AgentTheme>('light')`
- `:307-316` 装载逻辑(读 localStorage,否则读 `prefers-color-scheme`,否则 `'light'`)
- `:321-322` `toggleTheme()` 翻转 + 落盘
- `:1172` return 表里的 `theme`

**改动必须最小**:`agentStore` 内部改成持有 `useAiTheme()` 实例,`theme` 与 `toggleTheme` 从它转出;**return 表里的键名、类型、对外行为一律不变**,这样 `AgentPage.vue` / `AgentTopbar.vue` / 既有测试都不用改调用点。

⚠️ `AgentTheme` 类型目前 export 自 `agentStore.ts`。**保留该 export**(改成 `export type AgentTheme = AiTheme` 的别名),避免动到别处的 import。

**Steps:**

- [ ] **Step 1: 写失败测试**

Create `src/ai/stores/aiTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiTheme } from './aiTheme'
import { useAgentStore } from './agentStore'

const KEY = 'nimoos.ai.agent.theme'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('useAiTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('初值是 light', () => {
    expect(useAiTheme().theme).toBe('light')
  })

  it('hydrateTheme 优先读 localStorage', () => {
    localStorage.setItem(KEY, 'dark')
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('hydrateTheme 忽略 localStorage 里的非法值,回落系统偏好', () => {
    localStorage.setItem(KEY, 'chartreuse')
    stubMatchMedia(true)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('无 localStorage 且系统偏好浅色时是 light', () => {
    stubMatchMedia(false)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('light')
  })

  it('toggleTheme 翻转并落盘', () => {
    const s = useAiTheme()
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')
  })
})

describe('agentStore 主题委托给 aiTheme(D1:跨页共享)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('agentStore.theme 读到的是 aiTheme 的值', () => {
    const shared = useAiTheme()
    const agent = useAgentStore()
    shared.toggleTheme()
    expect(agent.theme).toBe('dark')
  })

  it('agentStore.toggleTheme() 会翻动共享 store —— 设置页因此能同步看到', () => {
    const agent = useAgentStore()
    const shared = useAiTheme()
    agent.toggleTheme()
    expect(shared.theme).toBe('dark')
    expect(agent.theme).toBe('dark')
  })

  it('agentStore 的 loadPersisted 装载后,共享 store 也是同一个值', () => {
    localStorage.setItem(KEY, 'dark')
    const agent = useAgentStore()
    agent.loadPersisted()
    expect(agent.theme).toBe('dark')
    expect(useAiTheme().theme).toBe('dark')
  })
})
```

> **实现者注意**:最后一条用例里的 `agent.loadPersisted()` 是占位名。**动手前先 grep `agentStore.ts` 找到真正承载 `:307-316` 那段装载逻辑的函数名**,把用例里的调用改成真名;若那段逻辑不在具名函数里(而是 store 工厂体内直接执行),就把这条用例改成「新建 pinia 后直接读 `agent.theme`」。**不要为了让测试过而在 agentStore 上新增导出。**

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/ai/stores/aiTheme.test.ts
```

预期:FAIL,`Failed to resolve import "./aiTheme"`。

- [ ] **Step 3: 写 aiTheme.ts**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

// SP8-P2a Task 4 —— AI 区(Agent 页 + 设置页)共享的明暗主题。
//
// 【为什么要抽出来】Vue2 里 `Agent.vue` 与 `Settings.vue` 各持一份 theme,
// 靠同一个 localStorage key 对齐;因为 Vue2 路由切换会销毁并重建组件,
// data()/mounted 每次都重读 localStorage,用户感知是一致的。
//
// New-UI 的 Pinia store 是全局单例、切路由不销毁 —— 若两页各持一份 ref,
// 在设置页切成暗色、返回 /ai/agent 就不会变。这不是 Vue2 的 bug,是组件级
// store 换成单例 store 之后必然出现的行为差,必须在架构层解决。
//
// 做法与 SP8-P1c2 Task 7 的 `src/stores/userProfile.ts`(头像版本号上移)同款:
// 把状态提到它真正该在的层级,消费方各自读同一份。
//
// localStorage key 与 Vue2 逐字一致(`Agent.vue:80`、`Settings.vue:73`),
// 所以老应用与新应用的主题偏好互通。
const THEME_KEY = 'nimoos.ai.agent.theme'

export type AiTheme = 'light' | 'dark'

export const useAiTheme = defineStore('ai-theme', () => {
  const theme = ref<AiTheme>('light')

  /**
   * 装载一次持久化偏好。优先级与 Vue2 `Settings.vue:102-107` /
   * `Agent.vue:90-96` 一致:localStorage 合法值 → 系统 prefers-color-scheme →
   * 'light' 兜底。可重复调用(幂等)。
   */
  function hydrateTheme(): void {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') {
      theme.value = stored
      return
    }
    if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
      theme.value = 'dark'
      return
    }
    theme.value = 'light'
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, theme.value)
  }

  return { theme, toggleTheme, hydrateTheme }
})
```

- [ ] **Step 4: 改 agentStore.ts 委托**

四处最小改动:

1. 顶部加 `import { useAiTheme, type AiTheme } from './aiTheme'`
2. `THEME_KEY` 常量删除(唯一定义点搬到 `aiTheme.ts`),并在原位置留注释:
   ```ts
   // SP8-P2a Task 4 —— THEME_KEY 与主题状态搬到 `./aiTheme`(应用级共享,
   // Agent 页与设置页同源)。原因见该文件头注释。这里不再本地定义。
   ```
3. `AgentTheme` 类型改成别名(**保留 export,别处有 import**):
   ```ts
   /** @deprecated 名字保留以免动到既有 import;实体是 `AiTheme`。 */
   export type AgentTheme = AiTheme
   ```
4. store 工厂体内 `const theme = ref<AgentTheme>('light')` 改成:
   ```ts
   // SP8-P2a Task 4 —— 主题不再是本 store 的私有 ref,而是应用级共享 store 的
   // 转出。对外签名(store.theme / store.toggleTheme)完全不变,故 AgentPage /
   // AgentTopbar / 既有测试的调用点一行都不用改。
   const aiTheme = useAiTheme()
   ```
   `:307-316` 的装载逻辑体替换为 `aiTheme.hydrateTheme()`;`:321-322` 的 `toggleTheme` 函数体替换为 `aiTheme.toggleTheme()`;return 表里 `theme,` 改成 `theme: computed(() => aiTheme.theme),`。

   > ⚠️ **`theme` 在 return 表里必须是 `computed`,不能写成 `aiTheme.theme`** —— 后者是取值那一刻的快照,会丢掉响应性。写完后跑 Step 5 的第一条用例验证。
   > ⚠️ 记得 `computed` 要从 `vue` import(检查该文件顶部是否已 import)。

- [ ] **Step 5: 跑测试**

```bash
pnpm exec vitest run src/ai/stores/aiTheme.test.ts src/ai/stores/agentStore.test.ts
```

预期:aiTheme 8 条全 PASS;`agentStore.test.ts` **既有的主题用例应当零改动直接通过** —— 这是「对外签名不变」的证明。若有用例挂了,先判断是不是委托没做对(而不是急着改测试);确实需要改的,在报告里逐条说明为什么。

- [ ] **Step 6: RED 验证响应性**

把 return 表的 `theme: computed(() => aiTheme.theme)` 临时改回 `theme: aiTheme.theme`,重跑 —— 「agentStore.theme 读到的是 aiTheme 的值」那条必须变红。改回来再跑绿。两段真实输出贴报告。

- [ ] **Step 7: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/stores/aiTheme.ts src/ai/stores/aiTheme.test.ts src/ai/stores/agentStore.ts src/ai/stores/agentStore.test.ts
git commit -m "SP8-P2a Task 4: 抽出应用级 aiTheme,agentStore 改委托(D1 跨页主题同步)"
git show --stat HEAD && git status
```

---


