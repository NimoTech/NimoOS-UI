// SP8-P4 Task 3 —— MCP 分区的「后端串 → i18n 键」映射。
//
// 为什么不用 `apiError.apiErrorMessage`:它的文件头自己写了警告
// (`apiError.ts:18-20`)——返回值仍可能是后端英文原文(FastAPI 的 `detail`
// 直接透传),只适合“暂时兜个底”的场合,不满足“界面永不回显后端原文”这条
// 硬约束。本文件与 `channelsFormat.addBotErrorKey`(`:65-76`)同一分工:纯函数
// 只把后端错误归一成 i18n **键**,不碰 vue-i18n,调用方 `t()` 出当前语言的文案。
//
// 取值链与 channelsFormat/skillsErrorKey 同一惯例:同时读 Go 服务的
// `response.data.message` 与 FastAPI 的 `response.data.detail`(该接口今天全部
// 走 Go,但沿用双读不增加成本,防将来改道);匹配前 trim + toLowerCase。
//
// 后端串权威源(已回源逐条核实,见任务报告——brief/设计文档抄的行号与此处实测有
// 一两行出入,已在报告里申报,不影响串本身):
//   - `NimoOS-AI/route/v2/mcp.go:277,282,286`(validateAndClean 的三条 400)
//   - `mcp.go:152,168,186,332,441`(五处 404 "mcp server not found";brief 只列了
//     152/187/332 三处,实测还有 168、441 两处未被抄到——同一条串,不影响映射)
//   - `mcp.go:351`(502 agent unreachable,`c.JSON` 直出,不经 echo.HTTPError)
//   - `pkg/mcpparse/mcpparse.go:36,47,62,76,138`(parse 的五条 400)
//   - `agent/mcp_client/client.py:437,448,453,456`(test_server 的 4 个 error_key)

import type { McpTestView } from '../types/mcpServer'

/** 对齐 channelsFormat.ts:66-70 / skillsErrorKey.ts:33-40 的取错误串形状:
 *  同时读 Go 的 `message` 与 FastAPI 的 `detail`,取到就 trim + toLowerCase。 */
function rawMessage(e: unknown): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const raw = data && typeof data === 'object'
    ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
    : undefined
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: unknown } } | null | undefined)?.response?.status as number | undefined
}

/** 后端 `validateAndClean`(`mcp.go:273-289`)三条 400 + 404 "mcp server not found"
 *  → i18n 键;其余(未知 400/500/网络错/无 response)一律落既有通用兜底键
 *  `aiCfgSaveFailed`,绝不回显后端原文。 */
export function saveServerErrorKey(e: unknown): string {
  const s = rawMessage(e)
  if (s === 'url required for http/sse') return 'aiMcpSrvErrUrlRequired'
  if (s === 'command required for stdio') return 'aiMcpSrvErrCommandRequired'
  if (s === "transport must be 'http', 'sse' or 'stdio'") return 'aiMcpSrvErrBadTransport'
  if (s === 'mcp server not found') return 'aiMcpSrvErrNotFound'
  return 'aiCfgSaveFailed'
}

/** `mcpparse.Parse`(`mcpparse.go:36,47,62,76,138`)五条 400 → 四个键(两条措辞
 *  合并成 `aiMcpSrvParseErrNoCommand`,见测试注释);其余落 `aiMcpSrvParseFailed`。
 *  ⚠️ 必须用相等匹配,不能用 `startsWith`/`includes` 判 "no command" 前缀——
 *  否则 "no command (only environment variables)" 会被误判成
 *  "no command after parsing" 类,测试已钉死这条优先级。 */
export function parseCommandErrorKey(e: unknown): string {
  const s = rawMessage(e)
  if (s === 'empty command') return 'aiMcpSrvParseErrEmpty'
  if (s === 'no command after parsing') return 'aiMcpSrvParseErrNoCommand'
  if (s === "no command after '--'") return 'aiMcpSrvParseErrNoCommand'
  if (s === 'no command (only environment variables)') return 'aiMcpSrvParseErrOnlyEnv'
  if (s === 'unbalanced quotes in command') return 'aiMcpSrvParseErrQuotes'
  return 'aiMcpSrvParseFailed'
}

/** `detail` 只在是字符串时保留,否则归一成 `''`——后端英文原文一律不上界面
 *  (那些走 `error`/`error_key` 之外的自由文本字段,见 D8)。 */
function detailOf(body: unknown): string {
  const d = (body as { detail?: unknown } | null | undefined)?.detail
  return typeof d === 'string' ? d : ''
}

/** `POST .../test` 200 裸响应体(`agent/mcp_client/client.py:432-461`)→ 视图。
 *  成功态 `tool_count ?? 0` / `tools` 非数组归一成 `[]`;失败态按 `error_key`
 *  四值查表,`error`(后端拼好的英文串)永不进入视图,只有 `msgKey` + `detail`。 */
export function toTestView(body: unknown): McpTestView {
  if (!body || typeof body !== 'object') {
    return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
  }
  const b = body as { ok?: unknown; tool_count?: unknown; tools?: unknown; error_key?: unknown }
  if (b.ok === true) {
    const raw = body as { protocol_era?: unknown; protocol_version?: unknown; supported_versions?: unknown }
    return {
      ok: true,
      toolCount: typeof b.tool_count === 'number' ? b.tool_count : 0,
      tools: Array.isArray(b.tools) ? b.tools : [],
      // Older backends don't send these three fields — normalize to empty so the
      // view renders no line at all for them, never `undefined`.
      protocolEra: typeof raw.protocol_era === 'string' ? raw.protocol_era : '',
      protocolVersion: typeof raw.protocol_version === 'string' ? raw.protocol_version : '',
      supportedVersions: Array.isArray(raw.supported_versions)
        ? raw.supported_versions.filter((v): v is string => typeof v === 'string')
        : [],
    }
  }
  const detail = detailOf(body)
  switch (b.error_key) {
    case 'probe_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail }
    case 'connect_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail }
    case 'list_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail }
    case 'list_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail }
    case 'connect_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrConnectTimeout', detail }
    default: return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail }
  }
}

/** 抛出的错误(HTTP 层失败,不是 200 里的 `{ok:false,...}`)→ 视图。
 *  `mcp.go:351` 的 502 `{ok:false,error:"agent unreachable"}` 与 404
 *  `mcp server not found` 各给专用键,其余一律通用兜底,body 的字符串
 *  永不放进 `detail`(那是后端英文原文)。 */
export function toTestViewFromError(e: unknown): McpTestView {
  const status = statusOf(e)
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
  const bodyError = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined
  if (status === 502 || bodyError === 'agent unreachable') {
    return { ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' }
  }
  if (rawMessage(e) === 'mcp server not found') {
    return { ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' }
  }
  return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
}
