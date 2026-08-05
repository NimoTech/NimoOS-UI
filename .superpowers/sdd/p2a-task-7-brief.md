# SP8-P2a Task 7 — 任务简报

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

## Task 7: SettingsRail 左侧导航栏

**Files:**
- Create: `src/ai/components/settings/SettingsRail.vue`
- Create: `src/ai/components/settings/SettingsRail.test.ts`

**Interfaces:**
- Consumes: `./sections`(T3)· `../icons/AgentIcon.vue`(T1 的 9 个图标)· `../../../stores/userProfile`(`useUserProfile`)· `src/ai/styles/settings-styles.scss` 的 `.set-rail*` / `.set-nav*` / `.set-foot` 类(T2)
- Produces:
  ```ts
  defineProps<{ activeId: string; modelCount?: number | null }>()
  defineEmits<{ (e: 'back'): void; (e: 'select', id: SectionId): void }>()
  ```

**背景:**

Vue2 源 `src/views/AI/Settings/SettingsRail.vue`(113 行)。逐字对照移植。四块:

1. **头部**:返回箭头(`chev` 图标 + `transform: scaleX(-1)` 水平翻转)+ 标题「个性化」+ 副标题字面量 `Nimo · NAS`(**不 i18n**,Vue2 就是硬编码的品牌串)
2. **导航**:四个 `set-nav-group`,组头可点击折叠(`data-open` 驱动 chev 旋转),组内是 `set-nav-item`(图标 + 标签 + `models` 项独有的模型数徽标)
3. **底部账号卡**:头像 + 昵称 + 角色
4. **展开逻辑**:初始只展开 `activeId` 所在的组;`watch(activeId)` 时若其所在组是收起的就展开它(**只展开,不收起别的** —— Vue2 `:99-102` 就是这个行为)

**头像与用户信息**:照 `src/ai/components/shell/AgentSidebar.vue` 的既有实现,**不要另起一套**:
- `useUserProfile()` 的 `avatarVersion` 拼 `&v=`(P1c-2 Task 7 建立的共享机制)
- token 从 `localStorage.getItem('access_token')`
- 用户信息从 `localStorage['user']` 解析(AgentSidebar 有现成写法,照抄口径)
- `avatarFailed` 保持组件本地 ref
- **URL 前缀 `/v1/users/avatar?token=`**(注意 AgentSidebar 用的是带前导斜杠的版本,Vue2 是不带的 —— 本仓在 `/app/` 基座下必须带,这是 P1a 终审修过的坑,别改回去)

**Vue2 缺陷需修的:** Vue2 `:89` 用 `$EventBus.$on('avatar-changed')`。New-UI 无事件总线,该订阅**整段不移植**,理由与 `userProfile.ts` 头注释里写的一致(在组件里留一句注释指向那个文件)。这与 AgentSidebar 的处理完全一致,不算新偏离,但报告里提一句。

**Steps:**

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SettingsRail from './SettingsRail.vue'
import zh from '../../../i18n/zh_cn'

// SP8-P2a Task 7 —— 部分移植自 Vue2
// `src/views/AI/Settings/__tests__/SettingsRail.spec.js`。
// 该文件里针对 GROUPS 的三条断言已由 sections.test.ts(Task 3)承接;
// 这里承接它的 methods 断言(onSelect / toggleGroup / 初始展开),并把 Vue2 的
// `.call(ctx)` 写法升级成真挂载 —— 判别力只增不减。
//
// 用真 zh_cn locale(不手写 i18n 子集):P1c-2 记账过,手写子集会让组件里
// 拼错的键名抓不到。

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountRail(props: Record<string, unknown> = {}) {
  return mount(SettingsRail, {
    props: { activeId: 'models', ...props },
    global: { plugins: [i18n] },
  })
}

describe('SettingsRail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('渲染四个分组头', () => {
    const w = mountRail()
    expect(w.findAll('.set-nav-grouphead')).toHaveLength(4)
  })

  it('初始只展开 activeId 所在的组', () => {
    const w = mountRail({ activeId: 'search' })   // groupOf('search') === 'agent'
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads.map((h) => h.attributes('data-open')))
      .toEqual(['false', 'true', 'false', 'false'])
  })

  it('点分区 emit select', async () => {
    const w = mountRail({ activeId: 'search' })
    const items = w.findAll('.set-nav-item')
    await items[0].trigger('click')
    expect(w.emitted('select')![0]).toEqual(['blacklist'])
  })

  it('skills / mcp 也只是 emit select(不自己跳路由)', async () => {
    const w = mountRail({ activeId: 'skills' })
    const skills = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
    await skills.trigger('click')
    expect(w.emitted('select')![0]).toEqual(['skills'])
  })

  it('点组头折叠/展开该组', async () => {
    const w = mountRail({ activeId: 'models' })
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')
    await heads[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('false')
    await w.findAll('.set-nav-grouphead')[0].trigger('click')
    expect(w.findAll('.set-nav-grouphead')[0].attributes('data-open')).toBe('true')
  })

  it('activeId 变到别的组时,自动展开新组(且不收起旧组)', async () => {
    const w = mountRail({ activeId: 'models' })
    await w.setProps({ activeId: 'memory' })    // → agent 组
    const heads = w.findAll('.set-nav-grouphead')
    expect(heads[0].attributes('data-open')).toBe('true')   // model 组仍开着
    expect(heads[1].attributes('data-open')).toBe('true')   // agent 组被展开
  })

  it('高亮当前分区', () => {
    const w = mountRail({ activeId: 'providers' })
    const active = w.findAll('.set-nav-item').filter((n) => n.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('云端提供商')
  })

  it('modelCount 非零时在 models 项上渲染徽标', () => {
    const w = mountRail({ activeId: 'models', modelCount: 3 })
    expect(w.find('.set-nav-badge').text()).toBe('3')
  })

  it('modelCount 为 0 / null 时不渲染徽标(Vue2 :29 用的是真值判断)', () => {
    expect(mountRail({ modelCount: 0 }).find('.set-nav-badge').exists()).toBe(false)
    expect(mountRail({ modelCount: null }).find('.set-nav-badge').exists()).toBe(false)
  })

  it('返回按钮 emit back', async () => {
    const w = mountRail()
    await w.find('.set-rail-back').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('头像 URL 带共享 store 的版本号,bump 后变化', async () => {
    localStorage.setItem('access_token', 'tok')
    const { useUserProfile } = await import('../../../stores/userProfile')
    const w = mountRail()
    const before = w.find('.set-foot img').attributes('src')
    expect(before).toContain('v=1')
    useUserProfile().bumpAvatarVersion()
    await w.vm.$nextTick()
    expect(w.find('.set-foot img').attributes('src')).toContain('v=2')
  })

  it('无 token 时回落到自带默认头像', () => {
    const w = mountRail()
    expect(w.find('.set-foot img').attributes('src')).not.toContain('token=')
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/ai/components/settings/SettingsRail.test.ts
```

- [ ] **Step 3: 写实现** —— 逐字对照 Vue2 `SettingsRail.vue`,按上文「背景」四块 + 头像口径落地。

- [ ] **Step 4: 加 i18n 键**

```ts
// zh_cn.ts / en_us.ts
aiCfgPersonalize:  '个性化'            / 'Personalize'
aiCfgBackToNimo:   '返回 Nimo'          / 'Back to Nimo'
aiCfgYou:          '你'                / 'You'
aiCfgLocalAccount: '本地账户 · NAS'     / 'Local account · NAS'
```

(前三条中文取自 Vue2 生产 `zh_CN.json`,已核。`Local account · NAS` 在 `zh_CN.json` 里若查不到,用上面这个值并在报告里说明是自拟。)

- [ ] **Step 5: 跑测试确认绿** —— 13 条全 PASS。

- [ ] **Step 6: RED 验证**

对「activeId 变到别的组时自动展开新组(且不收起旧组)」那条,把 watch 里的展开逻辑改成「先全部收起再展开新的」,重跑必须红(旧组那句断言失败);复原再跑绿。两段输出贴报告。

- [ ] **Step 7: 跑全量门 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/SettingsRail.vue src/ai/components/settings/SettingsRail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2a Task 7: SettingsRail 左侧导航栏"
git show --stat HEAD && git status
```

---


