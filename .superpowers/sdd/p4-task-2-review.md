# SP8-P4 Task 2 评审 —— 类型 + 视觉工具

评审者:独立评审(sonnet),不采信实现者报告,自行回权威源核实、自行跑测试。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过

## 范围核实

提交 `c154a1a`(父 `4dc7e7e` = T1),`git show --stat` 确认只含 3 个新文件(`types/mcpServer.ts` 96 行、`util/mcpServerVisual.ts` 25 行、`util/mcpServerVisual.test.ts` 63 行),无关文件零改动。`git status` 干净。

## 后端契约逐字段回源核实(不采信报告数字,自己 `awk`/`grep` 权威源)

- `mcp.go` `mcpDTO`(:41-51)、`toMcpDTO` nil-args 兜底(:54-58)、`has_headers/has_env`(:62)—— 逐行核对,**行号与字段完全准确,与任务书一致**。
- `mcp.go` 端点行号:`List` 200 裸数组(:96)· `Create` 201 `{"id":...}`(:121)· `Parse` 200(:137)· `Update` 204(:172)· `Delete` 204(:190)· `mcpRequest`(:29-39)· `applyReq`(:230-269,headers 分支 :247-253)—— **逐行核对全部准确**,包括类型文件里引用到的这些行号。
- `mcpparse.go` `Parsed`(:13-20)—— 字段准确。**实测 http 分支 `return Parsed{...}` 在 :39,stdio 分支在 :86**——与实现者报告自查结论一致,也与设计文档 §2.1 原写的 `:38,80` 确有 1/6 行偏差。**mcpServer.ts 文件头已按实测行号(:39/:86)写,未沿用设计文档的错误行号,核实无误。**
- `agent/mcp_client/client.py` `test_server`(:432)/`_test_server_inner` 四个 `error_key` 分支(:437 probe_timeout · :448 connect_failed · :453 list_timeout · :456 list_failed,detail 仅后两者带)、成功态 `{ok:true,tool_count,tools}`——**逐行核对全部准确**。
- 额外自查(超出报告自查范围):`mcpServerVisual.ts` 注释里的 `tokens.scss:235-241` 实测应为 **:236-242**(1 行偏差)。此偏差**来自任务书 Step 4 模板本身**,报告已申报「协调者裁定逐字照抄不改进,保留原文」——不是实现者引入的新问题,判 Minor / plan-mandated,建议协调者下次修任务书模板。
- 未发现报告承认的两处之外的其它行号错误。

## Vue2 蓝本逐行对照

`NimoOS-UI/src/views/AI/MCP/mcpServerVisual.js`(15 行)与 `mcpServerVisual.ts` 逐行比对:`PALETTE` 顺序、`SERVER_GLYPH`、`serverColor` 哈希算法(`h*31+charCode, >>> 0`)、`transportLabel` 大写化,**逐字一致,零改动**。类型放宽到 `unknown` 的注释准确描述了 Vue2 `String(name||'')` 的兜底行为。

## interface 逐字段核对(与任务书 Interfaces 段落对照)

`McpTransport`/`McpServer`/`McpParsed`/`McpTestResult`/`McpServerFormPayload`/`McpTestView` 六个类型的字段名、类型、可选性与任务书给定文本逐字相同。`id: number`(Go int64→JSON number)、`args: string[]` 配合注释「消费端仍需 `(s.args||[])` 兜底」——正确保留 Go nil slice → JSON `null` 的防御性说明,未被「后端已保证非 nil」误导性删除。单层取数措辞准确(共享包已 `res.data`,后端裸返回)。

## 测试质量(空转 / 判别力检查,附两次独立 RED 探针)

**RED 探针 1**(哈希算法是否被真实钉住,而非同义反复):把生产代码 `h * 31` 改成 `h * 33`。
```
Tests  1 failed | 8 passed (9)
FAIL  ... > serverColor > 逐字复刻 Vue2 的哈希取值
AssertionError: expected 'slate' to be 'orange'
```
只有该用例精确报红,其余 8 条绿。证明该用例**在测试内部独立重算哈希**,不是拿实现输出当期望值的同义反复。已还原 `* 31`,`git status` 干净,`pnpm exec vitest run` 复跑 9/9 绿。

**RED 探针 2**(判别力钉子:防「实现写死返回 blue」):把 `serverColor` 整体改成 `return 'blue'`。
```
Tests  2 failed | 7 passed (9)
FAIL  ... > serverColor > 不同名字能落到至少 3 种不同颜色  (expected 1 >= 3, got 1)
FAIL  ... > serverColor > 逐字复刻 Vue2 的哈希取值          (expected 'orange', got 'blue')
```
两条判别力用例精确报红,证明确有捕获能力,不是空转。已还原为哈希实现,`git status` 干净,复跑 9/9 绿。

未发现单元素数组断言等公共约束 §9 点名的高危模式(本任务测试用例均为多元素集合断言)。测试代码与任务书 Step 2 模板逐字比对,**一字未改**,无削弱/无空转。

## §3.5 / 偏离检查

本任务纯类型 + 工具函数,不涉及组件行为,§3.5 五条「照抄不改」与 §3 十一条偏离均不适用(报告如实声明「无命中」),核实无误。

## 三门(自己实测,非采信报告)

```
pnpm test                    → exit=0, Test Files 297 passed (297), Tests 2583 passed (2583)
pnpm exec vue-tsc --noEmit   → exit=0(空输出)
pnpm build                   → exit=0, 仅既有 >500KB chunk 警告,无新警告
```
基线 296 文件/2574 例 → 本任务新增 1 个测试文件、9 个用例 → 297/2583,算术吻合。**color-guard 用例数未变**(本任务未新增 `.vue`),符合任务书预期。

## 发现清单

- Minor / plan-mandated:`mcpServerVisual.ts` 注释引用 `tokens.scss:235-241`,实测应为 `:236-242`。此偏差源自任务书 Step 4 模板原文,非实现者引入;报告已申报并说明协调者裁定保留原文。不影响功能,建议协调者更新任务书模板措辞。

无 Critical / Important 发现。
