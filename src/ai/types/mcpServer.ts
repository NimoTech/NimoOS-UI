// SP8-P4 Task 2 —— 逐字照后端 DTO/契约的 json tag。字段顺序与命名与后端一一对应,
// 不新增/不省略字段。端点前缀是 `/v1/ai`("v2" 只是 handler 代码世代/包名,不是
// URL 版本号——P3b 终审 M4 踩过这个坑,详见 types/skill.ts 文件头)。
// 全部端点**无信封裸返回**,共享包 `@nimotech/nimoos-service` 已 `return res.data`
// 剥过 axios 层,消费端**不许再剥一层**(公共约束 §4 单层取数;设计 §3 命中 4 处)。
//
// ⚠️ 评审注记:`mcpparse.go` 的 http/stdio 分支实际行号是 `:39` / `:86`(本文件
// 逐处引用时按实际行号写,不沿用设计文档 §2.1 抄的 `:38,80`——回源核实后二者相差
// 1/6 行,已在 T2 报告里申报)。

/** 对齐后端 `mcp.go` `validateAndClean`(`:274-287`)接受的三个传输方式。
 *  注意 `McpServer.transport` / `McpParsed.transport` 本身在后端是裸 `string`
 *  (未做枚举收紧),这里只用 `McpTransport` 给前端下拉框一个受限的字面量集合。 */
export type McpTransport = 'http' | 'sse' | 'stdio'

/** 对齐后端 `mcpDTO`(`mcp.go:41-51`)。`GET /mcp/servers` 200 裸数组返回这个
 *  形状(`mcp.go:96`);`POST .../parse` 不返回这个形状(见 `McpParsed`)。 */
export interface McpServer {
  /** Go `int64`(`mcp.go:42`),JSON 序列化成 number,不是 string。 */
  id: number
  name: string
  /** 裸 string,不是 `McpTransport`——后端不做枚举校验,`validateAndClean`
   *  (`mcp.go:273-289`)才在保存时把非法值挡在 400。 */
  transport: string
  url: string
  command: string
  /** 后端 `toMcpDTO`(`mcp.go:53-64`,nil 兜底在 `:54-58`)保证非 nil,但消费端
   *  仍应写 `(s.args || [])` 兜底——Go 的 nil slice 会序列化成 JSON `null`,这类
   *  防御在调用处必须保留,不许因为「后端保证过」就删掉。 */
  args: string[]
  enabled: boolean
  /** 只是布尔位,不是密文本身——密文(headers/env 明文)永不下发(`mcp.go:62`)。 */
  has_headers: boolean
  has_env: boolean
}

/** 对齐后端 `mcpparse.Parsed`(`mcpparse.go:13-20`),`POST /mcp/servers/parse`
 *  200 裸对象返回(`mcp.go:137`)。**不落库**,只用于「快速粘贴」预填表单。 */
export interface McpParsed {
  /** 后端**只会产出 `"http"` 或 `"stdio"`,永不产出 `"sse"`**
   *  (`mcpparse.go:39` 的 http 分支、`:86` 的 stdio 分支)——不是缺陷,SSE 由用户
   *  在表单里手选(N5,承设计 §6)。 */
  transport: string
  command: string
  /** 非 nil(`mcpparse.go:79-82` 显式兜底成 `[]string{}`)。 */
  args: string[]
  /** 非 nil map(`mcpparse.go:69` 初始化为 `map[string]string{}`)。 */
  env: Record<string, string>
  url: string
  suggested_name: string
}

/** 对齐 Python agent `test_server` 返回(`agent/mcp_client/client.py:432-461`),
 *  Go 侧 `mc.go:355` 用 `c.JSONBlob` 原样透传,`POST .../:id/test` 200 裸对象。
 *  成功态只用 `ok/tool_count/tools`;失败态字段视 `error_key` 而定。 */
export interface McpTestResult {
  ok: boolean
  tool_count?: number
  tools?: string[]
  /** 后端拼好的英文串(如 `"Connection failed: ..."`)——**本仓不上界面**,
   *  一律走 `error_key` 映射成 i18n 键(设计 §5.3 / D8)。 */
  error?: string
  /** 只有 4 个值:`probe_timeout`(`client.py:437`)· `connect_failed`
   *  (`:448`)· `list_timeout`(`:453`)· `list_failed`(`:456`)。 */
  error_key?: string
  /** 原始异常 `str(e)`,仅 `connect_failed` / `list_failed` 带
   *  (`client.py:448,456`)。 */
  detail?: string
}

/** 本仓表单提交的 payload 形状,对齐后端 `mcpRequest`(`mcp.go:29-39`)里
 *  会被 `applyReq`(`:230-269`)消费的字段——不含 `command_line`(那是快速粘贴
 *  专用字段,解析走 `McpParsed`,不进保存 payload)。
 *  `POST /mcp/servers` 成功返回 **201 `{"id": <int64>}`**(`mcp.go:121`)——
 *  不是完整 `McpServer` 对象,消费端不能指望拿回全量字段。
 *  `PUT /mcp/servers/:id` 成功返回 **204 无内容**(`mcp.go:172`)——不许读返回值。 */
export interface McpServerFormPayload {
  name: string
  transport: string
  enabled: boolean
  url?: string
  command?: string
  args?: string[]
  /** 编辑态省略该字段表示「保持不变」,后端 `applyReq` 只覆盖请求里出现的字段
   *  (`mcp.go:247-253`)——对应 N3(编辑态无法清空已有 headers/env,照抄)。 */
  headers?: Record<string, string>
  env?: Record<string, string>
}

/** 本期新造的视图类型(Vue2 无对应物)。`util/mcpErrorKey.ts`(T3)把
 *  `McpTestResult` / HTTP 错误映射成这个形状,详情组件(T6/T7)只消费这个类型,
 *  不直接碰 `McpTestResult`——保证界面永远拿到的是 i18n 键而不是后端原文
 *  (公共约束「界面永不回显后端原文」)。 */
export type McpTestView =
  | { ok: true; toolCount: number; tools: string[] }
  | { ok: false; msgKey: string; detail: string }
