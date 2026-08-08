# SP14 — 7-15 之后的 Vue2 增量补迁（AI 区）设计

> 日期：2026-08-08 · 阶段：SP14 · 尺寸：M · 状态：设计已确认，待写实施计划
> 工作树：`NimoOS-New-UI/.claude/worktrees/ai-catchup`，分支 `sp14-ai-catchup`（基于本地 master `65c7928`）

## 1. 背景与本期定位

本期与 **SP12（Files 区）并行**：SP12 在 New-UI 主工作树的 master 上做，本期在隔离 worktree 上做 AI 区。
两期的差集同源 —— 都来自 `2026-08-08-vue3-migration-sp12-files-catchup-design.md` §2 那次全量重算
（蓝本 = Vue2 分叉点 `34d1e9ad`（2026-07-15），Vue2 `origin/main` 已推进到 `03245590`）。

SP12 §2 把 20 项真缺口分成 Photos 4 · Files 9 · 其它 7。**本期取「其它 7」里属于 AI 区的三条**：

| # | Vue2 提交 | 内容 |
|---|---|---|
| #136 | `66c012ab` | MCP elicitation 两张卡 + 三卡 409 一次性过期折叠 + URL scheme 白名单 + 同形异义警告 |
| #141 | `335679bc` | MCP 协议版本探测（协商版本行 + 探测超时链 + `connect_timeout` 错误键） |
| #98 | `fe8dbdd2` | Knowledge 桌面磁贴 |

Photos 两大块（Moments / Albums 统一）与其余四条（#93 LAN Devices · #103 Photos Cache 入口 ·
#125 KVM 磁贴门控 · #128 默认图标）**不在本期**。

### 1.1 开工前的代码级复核（2026-08-08）

SP12 的清单是另一条会话汇总的。照 `vue3-pending-audit` 那条教训（**汇总结论落盘前必须过代码级取证**），
本期开工前对三条逐一复核，并抽查了「已被 SP8/SP9 吃掉」那批：

| 结论 | 取证 |
|---|---|
| #136 整块缺失 | `grep -ril elicit src/` → **0 命中** |
| #141 缺失 | `protocol_era` / `negotiated` → 0 命中；`packages/service/src/ai.ts:389` 仍是 `timeout: 110000` |
| #98 缺失 | `src/home/apps/systemApps.ts` 七个系统应用里没有 knowledge |
| 三卡 409 折叠缺失 | `McpPermissionCard.vue:29` 只 `error.value = t('aiConfirmExpired')`，按钮仍可反复点 |
| #99 / #102 / #104 / #92 确已吃掉 | `ResourcesTab.vue` 有 agent.md 状态；`knowledgeStore` / `queueView.ts` 有 distill 队列与取消；Wiki 视图在 |

**两个复核期发现、SP12 清单里没有的事实**：

1. **`/ai/knowledge` 在 New-UI 全仓没有任何入口。** 11 条路由、9 项 rail、笔记/Wiki/队列/白名单全都实现了，
   但只有知识库内部互跳（`NoteEditPane.vue:557` 等），桌面、AI 页、设置里都进不去 —— 今天只能手敲地址栏。
   这使 #98 从「补个磁贴」升级为「补上唯一入口」。
2. **Vue2 #98 顺带删的两处在本仓本来就不存在**（AI 设置里的 Knowledge Details 链接、`KnowledgeLayout` 的
   返回 AI 设置按钮）。New-UI 是照 SP8 期（#98 之后）的 Vue2 移植的，删过的东西没被抄进来。
   ⇒ **#98 在本仓是纯加法**，没有对应的删除动作。

## 2. 已拍板的四个决策

1. **允许改 `packages/service/`**（用户 2026-08-08 裁定：worktree 上的冲突手动解决即可，不设限制）。
   两处改动各自**单独成一个 commit**，方便与主分支 SP12-T2（也要往 `packages/service/` 加批次 API）合并时取舍。
2. **三卡共享的 409 状态机抽成 composable `useConfirmResolve`，模板与 CSS 各卡自写**。
   理由：本次改动本身就是「让三卡行为一致」，复制三份状态机必漂；而模板/CSS 各写与本仓既有形状一致
   （`McpInstallCard.vue` 与 `McpPermissionCard.vue` 今天各自带一份 `.mcc-perm` 样式）。
   不抽卡壳组件 —— 三卡文案/图标/按钮数各不相同，抽壳会冒出一堆 slot 与 prop，视觉 1:1 风险最大。
3. **#98 磁贴走应用内 `router.push('/ai/knowledge')`，不照 Vue2 开新标签页**。
   照 `vue2-port-visual-only-fix-logic`：界面 1:1，逻辑照正确。Vue2 开新标签页是因为那时 Knowledge 是独立入口；
   本仓 AI 区 SP8-P6 已 cutover 进本应用，开新标签页反而丢应用内状态，且与既有六个系统磁贴形状不一致。
4. **不做无关重构**。`McpPermissionCard` 除接 composable 与删「更改」按钮外不动其余部分。

## 3. 架构

### 3.1 elicitation 链路（#136）

```
后端 SSE {kind:'mcp_elicit_form' | 'mcp_elicit_url'}
  → src/ai/services/dispatchEvent.ts   两个新分支（字段逐个归一，不透传裸事件对象）
  → actions.appendBlock({type:'mcp_elicit_form' | 'mcp_elicit_url', …})
  → BlockRenderer BLOCK_MAP → McpElicitFormCard / McpElicitUrlCard
  → useConfirmResolve（三卡共用状态机）
  → agentStore.resolveElicitation(confirmId, action, content)
  → service.ai.confirmAgentAction(sid, cid, action === 'accept', false, {action, content})
  → POST /v1/ai/agent/sessions/{id}/confirm
```

**事件契约**（逐字取自 Vue2 `agentStream.js` 的两个分支，字段名为后端 snake_case → 视图 camelCase）：

| 块类型 | 字段 |
|---|---|
| `mcp_elicit_form` | `confirmId` ← `confirm_id` · `server` · `message` · `fields`（非数组归一成 `[]`） · `error`（后端退回上一次作答的原因，首问为空） |
| `mcp_elicit_url` | `confirmId` · `server` · `message` · `url` · `host` · `hostAscii` ← `host_ascii` · `punycode`(bool) · `insecure`(bool) |

`hostAscii` **只在编码形态与展示形态不同时后端才给** —— 正是用户光看看不出来的同形异义情况
（后端 `elicitation.py::_host_flags`）。所以「有 `hostAscii` 就并排显示 punycode 拼法」是有依据的，
不是无条件显示。

**`resolveElicitation` 的语义**（照 Vue2，理由是它复盘出来的）：
elicitation 是三态（`accept` / `decline` / `cancel`）且可带答案，两态的 `confirmAgentAction` 表达不了；
`confirmed` 仍照发（`action === 'accept'`）让后端既有簿记不变，`action` / `content` 走新的 `extra` 透传。
无 `activeSessionId` 或无 `confirmId` 时 **throw 而不是静默 return** —— 静默 return 会 resolve 掉 promise，
卡片翻到「已把回答发给 X」，实际一个字节没发出去，后端回调挂在 `wait_elicit` 里最长 24 小时，整次工具调用无声卡死。

### 3.2 校验的分工（不可改动）

前端**只**保留一条手写规则：`multi_enum` 的 `required` / `min_items` / `max_items`（HTML 表达不了数组约束）。
其余全部由控件结构与浏览器原生约束执行（`required` / `minlength` / `maxlength` / `min` / `max` / `step` /
`type=email|date|datetime-local`），权威规则只有后端 `agent/mcp_client/elicitation_schema.py::validate_content` 一份。

**为什么不在前端把后端规则再写一遍**：那就是两份实现，而 NimoOS-AI 与本仓是两个独立发版的 git 仓库，
靠人工同步必然漂移，漂移的后果曾经是「用户填的答案被后端静默丢弃、卡片已 resolve、没有回头路」。

两条具体的映射规则：
- `format: uri` **故意不用** `type="url"` —— 它比后端规则严，会拒掉后端本会接受的值（如 `mailto:a@b`），
  用户就卡在一个填得没错的表单上、无法提交。
- 缺失的约束**整个不发**，而不是发 `undefined`（免得渲染出 `minlength="undefined"` 让浏览器拦错东西）。

`min_items` 独立于 `required`：一个 `required:false` 但 `min_items:1` 的字段选了 0 项仍然违规，
所以数组校验**不**对空数组 `continue`。

### 3.3 一次性 expired 状态机（三卡共用）

`confirm_id` 是一次性的（后端 `ConfirmManager.resolve` 会把它从 `_pending` 移除），此后每次 POST 都是
`409 confirm_expired`。现状是收到 409 只显示一行红字、按钮全部恢复可点，用户可以无限点、无限收到同一句话。

`useConfirmResolve` 暴露 `decision` / `submitting` / `expired` / `submitError` 与一个 `run(fn, onOk)` 包装：

| 结果 | 处置 |
|---|---|
| 成功 | `decision = action`，卡片翻到已解决屏 |
| **409** | `expired = true`（单向，不可回退），整卡折叠成一行灰字「确认已过期，请重新发送指令」，**不留任何可点元素** |
| 500 / 断连 | 只写 `submitError`，卡片保持可用、表单内容不清空 —— `confirm_id` 可能还活着，允许重试 |

`McpPermissionCard` 另有一处：已解决屏的「更改」按钮只是把 `decision` 置回 `null`，把按钮重新接到一个
**已被消费**的 `confirm_id` 上，没有任何成功路径，只能把用户送进下一个 409。**删掉该按钮与其 `.undo` 样式。**

### 3.4 #141 协议版本

链路（本仓比 Vue2 多一层归一，必须走它）：

```
POST .../test 200 裸响应体
  → mcpErrorKey.ts::toTestView   把后端形状归一成 McpTestView（界面永不回显后端原文）
  → protocolLine(view): {key, params} | null   新纯函数
  → McpServerDetail.vue 只负责显示
```

- `McpTestView` 成功态加三个字段：`protocolEra`（`'modern' | 'legacy' | 其它`）、`protocolVersion`、`supportedVersions`。
- `protocolLine` 的规则：`legacy` → 「最新协议不支持 · 协商到 {version}」；`modern` 且除协商版本外还有别的 →
  「协议 {version} · 另支持 {list}」；`modern` 且只有一个 → 「协议 {version}」；**其余一律返回 `null`**
  （`protocol_era: 'unknown'`、以及整个不给这些字段的旧后端 → 不渲染任何行，绝不打印 `undefined`）。
- 错误键表补 `connect_timeout`。
- `packages/service/src/ai.ts` 探测超时 `110000 → 135000`。**超时链必须外层最大**：axios > Go 代理的 stdio 上限
  > Python 的 stdio 上限，这样最先放弃的永远是持有子进程与套接字、能报出准确原因的那一层。
  Vue2 在这里栽过：Python 把预算拆成分阶段后 stdio 上限超过了浏览器的 110s，任何跑过 110s 的 stdio 探测都在
  浏览器侧被掐断，用户只看到笼统的「连接失败」。
  实测值（NimoOS-AI main@c15e47c，2026-08-06；两仓独立发版会漂，这只是当时的快照，不是契约）：
  Go 代理 25s（http）/ 100s（stdio）（`route/v2/mcp.go:344,346`）；Python `TEST_TIMEOUT`=20s /
  `STDIO_TEST_TIMEOUT`=90s（`agent/mcp_client/client.py:738-739`）。`135000 > 100s > 90s` 成立。
- stdio 等待提示改成**不带数字**的说法。那个数字（90s → 115s）在 Vue2 一个改动集里跨仓漂了两次。

### 3.5 #98 桌面磁贴

- `src/home/apps/systemApps.ts` 增一项 `knowledge`（图标从 Vue2 `src/assets/img/app/knowledge.svg` 搬进
  `src/home/apps/icons/`；`cls`/`glyph` 按既有形状给无图兜底）。
- `src/home/composables/useOpenAction.ts` 增 `knowledge` 分支 → `router.push('/ai/knowledge')`。
  **不加回退 flag** —— 知识库在 Vue2 侧没有对应入口可退（本仓这条路由是 SP8 新建的，不是绞杀过来的）。
- `src/home/grid/defaultLayout.ts` 的 `DEFAULT` 增一格 —— 这只影响**新用户**。
- **老用户不靠默认布局**：`apps.order` 直接由 `SYSTEM_APPS` 生成，Dock 的「更多」列表（`useDock.ts:36`）
  与桌面的 AddPanel（`AddPanel.vue:56`）会自动出现 Knowledge，用户自己拖到桌面即可。

## 4. 任务分解（8 个）

### 地基

**T1 `useConfirmResolve` composable**
- 纯逻辑：`decision` / `submitting` / `expired` / `submitError` + `run()` 包装
- 409 单向、500/断连可重试的判据落在这里，三卡不再各写一遍
- 先写测试（含 409 之后再点一次不发请求的用例）

**T2 包改动：`confirmAgentAction` 补 `extra`（独立 commit）**
- `packages/service/src/ai.ts` 第 5 个可选参数 `extra?: Record<string, unknown>`，展开进 body
- 不传时 body 与今天逐字相同（既有调用方零影响），测试钉死这一点

**T3 `agentStore.resolveElicitation`**
- 无 session / 无 confirmId → throw（附注释说明为何不能静默 return）
- `content === null ? {action} : {action, content}`

### 两张卡

**T4 `mcpElicitValidate.ts` + `McpElicitFormCard.vue`**
- 纯函数先行：`validateArrayFields(fields, values, t)`，翻译函数由调用方传入（默认 `s => s` 保持独立可测），
  文案字面量留在 `t('…')` 调用里
- 卡片：`inputAttrs` 映射、`buildPayload`（空可选字段整个不发）、双重门（`reportValidity()` → 数组规则）
- ⚠️ `enum` 字段是原生 `<select>`：**只能给实心 token 底**，不能用渐变/半透明
  （`newui-css-invisible-failure-guards`：Chrome 会把它带到弹出列表且优先于 `color-scheme`，白底白字）
- 已解决屏的 `data-decision` 取值是 `accept` / `decline` / `cancel`，**不是**从 `McpPermissionCard`
  抄来的 `allow|always|deny`（Vue2 抄错过，图标一直没颜色）

**T5 `McpElicitUrlCard.vue`**
- `urlParts` 用 `indexOf` 切（路径里可能再次出现同样的 host 串），host 高亮但整条 URL 都要看得见
- `OPENABLE_URL_RE = /^https?:\/\//i` 白名单：拦下只写 `submitError`，**不** `window.open`
- `window.open(url, '_blank', 'noopener,noreferrer')` 后立刻 `accept`
- 底部常驻说明：同意只表示打开页面，NimoOS 看不到授权是否完成

**T6 接线 + 三卡过期态**
- `dispatchEvent.ts` 两个分支；`BlockRenderer.vue` 两个映射
- `McpPermissionCard.vue` 接 `useConfirmResolve`，删「更改」按钮与 `.undo` 样式
- i18n 键 zh/en 双写

### 独立两条

**T7 #141 协议版本**
- `McpTestView` 扩字段 → `toTestView` 归一 → `protocolLine()` 纯函数 → 视图一个元素（不是 modern/legacy 两个近似 div）
- `connect_timeout` 错误键；stdio 提示去数字；包里 timeout 135000（**独立 commit**）

**T8 #98 桌面磁贴**
- 图标搬运 + `systemApps.ts` + `useOpenAction.ts` + `defaultLayout.ts` + i18n 双写

## 5. 测试策略

- **纯函数先行（TDD）**：`validateArrayFields`、`protocolLine`、`toTestView` 扩展、`useConfirmResolve`
- **组件必须真挂载并点按钮**。Vue2 #136 的教训：原测试用 `.call({...})` 直调方法、从不挂载组件，
  导致整条 submit/resolve 流程（校验门、请求构造、409 分支、决议后视图切换）零覆盖 ——
  而这张卡承载的是用户发给第三方 MCP 服务端的答案。本期凡「卡片承载用户决定」的组件，测试一律真挂载。
- **变异验证**：白名单、409 分支、`extra` 透传、磁贴跳转各改坏一处，确认对应测试真的会红
- **fixture 不手编**（`newui-fixture-from-imagination-trap`）：elicitation 事件形状逐字取自
  `NimoOS-AI/agent/mcp_client/elicitation.py` 与 `confirm.py`；`/test` 响应体形状取自
  `agent/mcp_client/client.py::test_server`
- `window.open` 在测试里 stub，断言实参含 `noopener,noreferrer`
- **收尾门**：vitest 全量 + `vue-tsc --noEmit` + color-guard + i18n parity + build + oss 安全形式
  （`--out <scratch> --no-commit --allow-dirty-oss` 三件套，不得裸调 `export.mjs`）

## 6. 验收

- **验收 = 起 dev server**：`pnpm dev --host --port 5279`（5273 归主工作树那条线，5277/5288 是 .sp7/.sp8 旧占位）。
  本期不是 cutover 期，照 SP9/SP11 既有约定，**不** `deploy.sh`。
- #98 真机直接可验。**#141 不可验**——现在跑的 NimoOS-AI 后端(`agent/mcp_client/client.py::test_server`)
  只回 `{ok, tool_count, tools}`,通仓 grep 零命中 `protocol_era`/`protocol_version`/`supported_versions`,
  `connect_timeout` 也不是任何地方的错误键。对着今天这个后端,`protocolLine()` 恒为 `null`,协议版本行
  永远不会渲染——不是待触发的功能,是后端还没给字段。别去真机上找这一行。
- **elicitation 两张卡真机不好触发** —— 需要一个真会 elicit 的 MCP 服务端。实施计划里写成明确步骤：
  先探设备端 agent 是否支持（见 §7 风险 1），能触发就真触发；不能就用 CDP 往流里注入一条事件看渲染，
  并在验收报告里如实标注「渲染已验、端到端未验」。

## 7. 风险

1. **设备端 AI agent 是否已支持 elicitation 未验证**。agent 跑在容器里（`nimoos-agent-container-compose-drift`），
   本会话看不到 docker，`/usr/share/nimoos/` 下也没有 agent 目录。若设备是旧后端：卡片永远不出现
   （不会弄坏别的，`dispatchEvent` 只是多两个永不命中的分支），但端到端验不了。**开工第一步先探这个。**
2. **`<select>` 白底白字**：jsdom 照不出，必须真浏览器看 computed style。
3. **包改动与主分支 SP12-T2 撞同一目录**。压制手段：两处改动各自独立 commit，且只加**可选**参数、
   只改一个常量，冲突面压到最小。
4. **删「更改」按钮会让既有测试红**。这是预期，但删/改测试时必须逐条确认改的是「为已废除形态写的」，
   不是顺手删掉挡路的。
5. **jsdom 照不出布局**：卡片按钮的点击命中、`<select>` 弹出列表都要真浏览器复核。

## 8. 流程约定

- **工作树 = `.claude/worktrees/ai-catchup`，分支 `sp14-ai-catchup`**（基于本地 master `65c7928`，
  比 `origin/master` 领先 31 个提交 —— 别从 origin 开分支）
- **提交信息英文**（`commit-messages-english-only`）
- **两处包改动各自独立 commit**
- 台账落 `.superpowers/sdd/`（自 2026-08-05 起已入库进 git）
- 本期结束**不合 master** —— 由用户决定与 SP12 的合并时机
