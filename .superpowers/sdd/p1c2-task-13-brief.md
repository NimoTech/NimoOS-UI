### Task 13(派工范围 = Step 1–5)：右栏接线 + Vue2 遗留缺陷修复 + 全量门 + 审计

> Step 6(opus 全支线终审)与 Step 7(台账/验收清单)由协调者本人执行，**不在本次派工范围内**。
> 你做完 Step 1–5、提交、写报告即可。

**仓库:** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`，分支 `sp8-ai`，base = `9e1e5c7`。
**Vue2 真值源(只读，禁改):** `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Agent/`
**包管理器 pnpm**(禁 yarn/npm)。**绝不碰真机**:不跑 `deploy.sh`、不写 `/var/lib`。

#### 文件白名单(只许动这些)

```
src/ai/views/AgentPage.vue
src/ai/views/AgentPage.test.ts
src/ai/components/shell/AgentRightPanel.vue
src/ai/components/shell/AgentRightPanel.test.ts
src/ai/stores/agentStore.ts
src/ai/stores/agentStore.test.ts        （或该 store 现有的测试文件所在处）
src/i18n/zh_cn.ts  /  src/i18n/en_us.ts （仅当确实需要新键；成对加，缺一 parity.test.ts 必红）
```

**共享 worktree 铁律:** 绝不 `git add -A` / `git add .`，一律按显式路径 stage。
不许动 `agent-styles.scss`、`tokens.scss`、任何 tab 组件本体、Service 仓。

#### 移植纪律(用户 2026-07-27 拍板，全期生效)

- **界面/视觉/交互 = 严格 1:1 照 Vue2**(DOM 结构、class 名、文案、尺寸、动效、组件拆分)。
- **逻辑 = 按正确的来。** Vue2 的 bug/竞态/吞错不照抄，改成正确逻辑，但**必须**①代码里写注释注明
  「Vue2 原文第 X 行是什么问题、此处改成什么」②在报告里申报。**未申报的偏离本身就是缺陷**
  ——本期 T11、T12 各栽过一次，评审会专门查这个。
- 禁止与需求无关的重构/改名/"顺手优化"。判据 = "这条改动是在修一个可复现的错误行为吗?是→改并登记;否→照 Vue2。"

#### 其他硬约束

- 颜色一律 `var(--…)` Agent token(`src/ai/styles/tokens.scss`，`.agent-app` 作用域)，
  **light 块与 `[data-theme="dark"]` 块都要有值**。禁 `#hex`/`rgb()`/`rgba()`/具名色。
- i18n 新键同时进 `zh_cn.ts` 与 `en_us.ts`；**文案里的 `@` 必须写成 `{'@'}`**
  (vue-i18n 9 当链接语法，`messageSyntax.test.ts` 会拦)。
- store 保 `useAgentStore(agentType?)` 工厂形态；组件一律 `useProvidedAgentStore()`，
  只有 `AgentPage.vue` 调 `useAgentStore()` + `provideAgentStore()`。
- **禁忌:任何代码不得 `await store.selectSession(...)`** ——它 await attach 流，活跃 run 时不 resolve。
- `ai` 域返回 body-level 原样，不多剥一层 `.data`。

---

### Step 1：把右栏挂进 AgentPage

`src/ai/views/AgentPage.vue` 里 `<!-- 1c: right panel -->`(约 133 行)注释处挂 `<AgentRightPanel>`，
props/事件**逐条对齐 Vue2 `Agent.vue:44-64`**：

| Vue2 prop | 本仓来源 |
|---|---|
| `:collapsed` | `store.rightCollapsed` |
| `:tab` | `store.rightTab` |
| `:activity-steps` | `store.activitySteps` |
| `:system-metrics` | **不传(见下方有意偏离)** |
| `:storage` | 本页已有的 `storage` ref(T11 装载) |
| `:busy` / `:session-id` / `:visible-resources` / `:attachments` / `:staged-changes` / `:committing` / `:reverting` | 对应 store 字段 |

事件 → store 动作:`set-tab`→`setRightTab`、`remove-resource`→`removeVisibleResource`、
`remove-attachment`→`removeAttachment`、`revert-run`→`revertStagedRun`、
`revert-batch`→`revertStagedBatch`、`revert-item`→`revertStagedItem`、`commit-all`→`commitStagedAll`。
**逐个去 store 里核对真实函数名与签名**，别照抄本表当真值。

**同时把 4 个 tab 真接上**:`AgentRightPanel.vue` 里 `data-testid="system-tab-placeholder"`(:94)与
`data-testid="resources-tab-placeholder"`(:101)两个占位 div，换成真的 `<SystemTab>` / `<ResourcesTab>`，
props/emit 按各自组件的实际声明接(去读组件本体，别猜)。ResourcesTab 的 7 个 emit 要一路透传到
AgentRightPanel 的 emits 再到 AgentPage。

**有意偏离(用户 2026-07-27 拍板，必须留注释):** `systemMetrics`。Vue2 `Agent.vue:47` 把
`store.state.systemMetrics`(mounted 时一次性 HTTP 拉)传给右栏；本仓 SystemTab 改吃 New-UI 现成的
实时通道(`useUtilization`)，**自己取数、不收这个 prop**。所以：
- `AgentRightPanel.vue:32` 的 `systemMetrics?: Record<string, unknown>` 与 `:46` 的默认值 **删掉**
  (无人消费的死 prop)，原处留一行注释说明 Vue2 有、本仓为何没有。
- `AgentRightPanel.vue:92-93` 那句 Task 10 留下的注释("Replaces this div with
  `<SystemTab :system-metrics=...>`")**已过时**，一并清掉/改写。`:95-101` 的 ResourcesTab 占位注释同理。
- 若 `AgentRightPanel.test.ts` 有断言引用了 `systemMetrics`，一并调整并在报告说明。

**集成测试(加在 `AgentPage.test.ts`):** 切 4 个 tab 各渲染对应内容、右栏开关联动
`data-rightcollapsed`、Resources 里点整轮/批次/单项回滚与提交确实打到 store 对应动作
(spy on store action，断言收到的参数)。

### Step 2：修 Vue2 遗留缺陷 —— `activitySteps` 从不清空

**已核实的事实**(不必再论证)：Vue2 `store/agentStore.js` 里 `activitySteps` 声明于 `:39`、
push 于 `:128`、原地 patch 于 `:137-140`，**全文件没有任何一处清空它**；切会话/新建会话/删除会话
(`:166-192`、`:246-293` 一带)都不重置。本仓 `src/ai/stores/agentStore.ts` 原样继承了这个缺口
(`:149` 声明、`:401` push、`:411-414` patch、`:1152` 导出，无清空点)。

**后果(可复现的错误行为):** 上一个会话的运行步骤会残留在右栏 Activity tab —— 切到另一个会话后，
Activity 里显示的还是上一段对话跑过的步骤，用户会以为新会话正在跑/跑过这些东西。

**按「逻辑照正确」修:** 在切换会话 / 新建会话 / 删除当前会话这些**会话边界**处清空
`activitySteps`。具体落点你自己去读 store：找到既有的"每会话状态"在哪里被重置的
(如 messages / stagedChanges / visibleResources 等同类字段的清理点)，**跟它们走同一条路径**，
不要另起一套时机。代码里留注释注明「Vue2 agentStore.js:39/166-192/246-293 从不清空 activitySteps，
导致上一会话步骤残留；此处按项目移植纪律修为正确逻辑」。

**测试必须有判别力:** 至少一条"会话 A 跑出步骤 → 切到会话 B → activitySteps 为空"的用例。
本期已三次抓到空转断言(T11 两条、T12 一条)，请自己确认：把清空那行删掉，你的用例会不会红？
在报告里写出你的 RED 验证过程与输出。
⚠️ 注意禁忌：测试里也不许 `await store.selectSession(...)`。

### Step 3：全量门

```
pnpm test                      # 全量；报告真实尾巴(files/tests 数)
pnpm exec vue-tsc --noEmit     # 必须零错误
pnpm build                     # 只允许既有的 500KB chunk 体积警告，不允许新错误
```

### Step 4：主题审计

```
git diff 3614196..HEAD --name-only | grep -E '\.(vue|scss|css)$' \
  | xargs grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black)\b'
```
排除 `tokens.scss` / `theme.css` / `popover.scss` / `agent-styles.scss` 后**必须为空**
(注释行里引用 Vue2 原色值的除外，但要在报告里列出来让人核)。本期新增的每个 token 都要
在 `tokens.scss` 的浅色块与 `[data-theme="dark"]` 块**两处都有值** —— 逐个 grep 确认，别推断。

### Step 5：i18n 审计 + 回归确认

```
pnpm test -- src/i18n/         # parity + messageSyntax 守卫
pnpm test -- src/ai/           # 1a/1b/1c-1 全部既有用例零回归
```
另抽查 5 个本期新键在两个 locale 的值都不是占位符/英文复制品。
重点看 composer 39 例、dispatchEvent、BlockRenderer 两批有没有被这次接线带红。

### 提交

`git status --short` 确认没有白名单外的东西被 stage，按显式路径 stage，提交信息：

`SP8-P1c2: wire right panel into AgentPage + clear activitySteps on session change`

然后跑 `git show --stat HEAD` 贴进报告。

### 报告

写 `.superpowers/sdd/p1c2-task-13-report.md`，中文，含：
- Step 1 的 prop/事件对照表(**实际接的** vs Vue2 `Agent.vue:44-64`)，以及 `systemMetrics`
  这处有意偏离的申报
- Step 2 的落点(file:line)、注释原文、RED 验证的真实输出
- 三道门 + 两项审计的**真实命令输出尾巴**(不要转述、不要写"全绿"了事)
- 你做的所有 judgment call，以及任何与 Vue2 不一致之处的申报清单
- `git show --stat HEAD`
