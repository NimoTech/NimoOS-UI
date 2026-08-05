# SP8-P4 Task 2 报告 —— 类型 + 视觉工具

提交:`c154a1a`(父提交 `4dc7e7e` = T1)。分支 `sp8-ai`,仅本任务 3 个文件,working tree 提交后干净。

## 逐文件改了什么

- **新建** `src/ai/types/mcpServer.ts`(96 行):`McpTransport` / `McpServer` / `McpParsed` / `McpTestResult` / `McpServerFormPayload` / `McpTestView` 六个类型,字段名、可选性、类型完全照任务书 Interfaces 段落抄,一字未改。文件头 + 每个 interface 的行内注释按 `types/skill.ts` 体例写:对齐后端哪个文件哪几行、`/v1/ai` 前缀说明、单层取数提醒。
- **新建** `src/ai/util/mcpServerVisual.ts`(25 行):`SERVER_GLYPH` / `serverColor` / `transportLabel`,逐字照抄任务书 Step 4 给的实现与注释(含那句 `tokens.scss:235-241` 的注释原文,即便回源发现实际是 236-242,按协调者裁定③「逐字照抄,不要改进」保留原文,已在下方申报)。
- **新建** `src/ai/util/mcpServerVisual.test.ts`(63 行):逐字照抄任务书 Step 2 给的测试代码,一字未改。

## Vue2 → New-UI 对照

蓝本 `NimoOS-UI/src/views/AI/MCP/mcpServerVisual.js`(15 行)已通读并逐行核对,`serverColor`/`transportLabel`/`SERVER_GLYPH` 与 Vue2 `:6-11`/`:13-15`/`:4` 逐字一致,哈希算法(`h = h*31 + charCode, >>> 0`)、色板顺序 `['blue','purple','pink','orange','green','teal','slate']`、取模全部保留,无任何"改进"。

本任务不涉及组件/交互移植,是纯类型 + 工具函数,无 Vue2 组件对照可谈。

## 自己回源核实后端契约的结论

逐字段对照任务书给的三份权威源,**发现两处行号偏差**(字段本身全部核实无误):

1. **`mcp.go` 的 `mcpDTO`(`:41-51`)——行号与字段均准确**。实测 `type mcpDTO struct` 在 `:41-51`,字段顺序 `ID(int64,:42) Name Transport URL Command Args([]string) Enabled HasHeaders HasEnv` 与任务书给的 interface 顺序、可选性完全一致。`toMcpDTO` 的 nil-args 兜底确认在 `:54-58`(`var args []string; unmarshal; if nil { args=[]string{} }`),`has_headers`/`has_env` 确认在 `:62`(`HasHeaders: m.Headers != "", HasEnv: ...`)。均与任务书/设计文档一致,**无偏差**。

2. **`mcpparse.go` 的 `Parsed`(`:13-20`)——字段准确,但设计文档 §2.1「`mcpparse.go:38,80`」的两个行号有偏差**:实测 http 分支 `return Parsed{Transport: "http", ...}` 在 `:39`(不是 `:38`),stdio 分支 `return Parsed{Transport: "stdio", ...}` 在 `:86`(不是 `:80`)。字段集合(`transport/command/args/env/url/suggested_name`)、非 nil 保证(`args` 在 `:79-82`,`env` 在 `:69` 初始化为 `map[string]string{}`)、"只产出 http/stdio 永不 sse" 的结论**都核实无误**,只是引用的具体行号偏了 1 行和 6 行。已在 `mcpServer.ts` 文件头注释里改用实测行号(`:39`/`:86`),不沿用设计文档抄错的 `:38,80`。

3. **`agent/mcp_client/client.py` 的 `test_server` 返回(`:432-461`)——行号与字段完全准确**。`grep -n` 实测:`test_server` 定义于 `:432`,`error_key` 四个值分别在 `:437`(`probe_timeout`)/`:448`(`connect_failed`)/`:453`(`list_timeout`)/`:456`(`list_failed`),`detail` 仅 `:448`/`:456` 两处带(即 `connect_failed`/`list_failed`)。与任务书、设计文档逐字一致,**无偏差**。

**顺带发现一处任务书 Step 4 模板自身的行号偏差**(非后端契约,是本仓 `tokens.scss` 的引用):模板注释写「`tokens.scss:235-241` 的 `--grad-sk-*` 七个渐变 token」,实测 `grep -n grad-sk- tokens.scss` 得到 `:236-242`。因协调者明确裁定「Step 4 逐字照抄,包括注释,不要改进」,**本文件保留了原文 235-241**,在此单独申报,不视为需要修正的缺陷。

## §3.5「照抄不改」5 条命中情况

本任务是纯类型/工具函数,不涉及 N1-N5(组件行为层面的偏离),无命中项。

## 偏离申报

- 无新增偏离。本任务只搬运任务书给定的类型与工具函数逐字实现,未做任何"改进"。
- 上述"行号偏差"不是行为偏离,是文档考据发现,已如实申报,未改动任务书要求的代码/注释内容(除 `mcpServer.ts` 自己的原创注释——那里我按实测行号写,不是抄 Step 4 模板)。

## RED → GREEN 证据

**RED**(实现前):
```
$ pnpm exec vitest run src/ai/util/mcpServerVisual.test.ts
 FAIL  src/ai/util/mcpServerVisual.test.ts [ src/ai/util/mcpServerVisual.test.ts ]
Error: Failed to resolve import "./mcpServerVisual" from "src/ai/util/mcpServerVisual.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN**(写完实现后):
```
$ pnpm exec vitest run src/ai/util/mcpServerVisual.test.ts
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

## 三门完整终值

```
$ pnpm test                      → exit=0
 Test Files  297 passed (297)
      Tests  2583 passed (2583)

$ pnpm exec vue-tsc --noEmit     → exit=0(空输出)

$ pnpm build                     → exit=0
✓ built in 25.14s
(仅既有 >500KB chunk 警告,无新警告/错误)
```

- 无红项。
- 基线 296 文件/2574 例(P3b 终审值)→ T1(4dc7e7e,不新增 `.vue`/测试文件)不变 → T2 本任务 **新增 1 个测试文件、9 个用例** → 297 文件/2583 例,与 `2574+9=2583` 算术吻合。
- **color-guard 用例数不变**(本任务未新增 `.vue`,与计划预期一致)。

## i18n

本任务不涉及 i18n(留给 T4)。

## 顾虑

无阻塞项。两处行号偏差(mcpparse.go 行号、tokens.scss 行号)均为文档考据性偏差,不影响功能正确性,已如实记录供台账参考。
