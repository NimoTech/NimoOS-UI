// SP8-P4 Task 3 — MCP partition “backend string → i18n key” mapping.
//
// Why not use `apiError.apiErrorMessage`: its file header has its own warning
// (`apiError.ts:18-20`) — return value may still be backend English original (FastAPI's
// `detail` passed through directly), only suited for “temporary fallback”, doesn't meet the
// hard constraint “UI never echoes backend original”. This file shares the same role as
// `channelsFormat.addBotErrorKey` (`:65-76`): pure function only unifies backend errors to
// i18n **keys**, doesn't touch vue-i18n, caller uses `t()` to get current language copy.
//
// Extraction chain follows same convention as channelsFormat/skillsErrorKey: reads both Go
// service `response.data.message` and FastAPI `response.data.detail` (this interface is all
// Go today, but dual-read doesn't add cost, guards against future rerouting); trim +
// toLowerCase before matching.
//
// Backend string authority sources (already cross-referenced line-by-line, see task report —
// brief/design doc line numbers have one or two line offset from actual test, reported in
// report, doesn't affect the strings themselves):
//   - `NimoOS-AI/route/v2/mcp.go:277,282,286` (validateAndClean three 400s)
//   - `mcp.go:152,168,186,332,441` (five 404 “mcp server not found”; brief only lists
//     152/187/332 three, test shows 168, 441 two more not copied — same string, doesn't
//     affect mapping)
//   - `mcp.go:351` (502 agent unreachable, `c.JSON` direct output, not via echo.HTTPError)
//   - `pkg/mcpparse/mcpparse.go:36,47,62,76,138` (parse five 400s)
//   - `agent/mcp_client/client.py:437,448,453,456` (test_server four error_keys)

import type { McpTestView } from '../types/mcpServer'

/** Align with channelsFormat.ts:66-70 / skillsErrorKey.ts:33-40 error string extraction:
 *  read both Go `message` and FastAPI `detail`, if found trim + toLowerCase. */
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

/** Backend `validateAndClean` (`mcp.go:273-289`) three 400s + 404 "mcp server not found"
 *  → i18n key; rest (unknown 400/500/network error/no response) all fall back to existing
 *  generic key `aiCfgSaveFailed`, never echo backend original. */
export function saveServerErrorKey(e: unknown): string {
  const s = rawMessage(e)
  if (s === 'url required for http/sse') return 'aiMcpSrvErrUrlRequired'
  if (s === 'command required for stdio') return 'aiMcpSrvErrCommandRequired'
  if (s === "transport must be 'http', 'sse' or 'stdio'") return 'aiMcpSrvErrBadTransport'
  if (s === 'mcp server not found') return 'aiMcpSrvErrNotFound'
  return 'aiCfgSaveFailed'
}

/** `mcpparse.Parse` (`mcpparse.go:36,47,62,76,138`) five 400s → four keys (two wordings
 *  merged into `aiMcpSrvParseErrNoCommand`, see test comment); rest fall back to
 *  `aiMcpSrvParseFailed`. ⚠️ must use equality match, not `startsWith`/`includes` for
 *  "no command" prefix — else "no command (only environment variables)" would be
 *  misclassified as "no command after parsing" type, test pins this priority. */
export function parseCommandErrorKey(e: unknown): string {
  const s = rawMessage(e)
  if (s === 'empty command') return 'aiMcpSrvParseErrEmpty'
  if (s === 'no command after parsing') return 'aiMcpSrvParseErrNoCommand'
  if (s === "no command after '--'") return 'aiMcpSrvParseErrNoCommand'
  if (s === 'no command (only environment variables)') return 'aiMcpSrvParseErrOnlyEnv'
  if (s === 'unbalanced quotes in command') return 'aiMcpSrvParseErrQuotes'
  return 'aiMcpSrvParseFailed'
}

/** `detail` only kept if string, else normalized to `''` — backend English original never
 *  reaches UI (free-text fields outside `error`/`error_key`, see D8). */
function detailOf(body: unknown): string {
  const d = (body as { detail?: unknown } | null | undefined)?.detail
  return typeof d === 'string' ? d : ''
}

/** `POST .../test` 200 raw response body (`agent/mcp_client/client.py:432-461`) → view.
 *  Success: `tool_count ?? 0` / `tools` non-array normalized to `[]`; failure: lookup
 *  `error_key` against four values, `error` (backend English string) never enters view,
 *  only `msgKey` + `detail`. */
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

/** Thrown error (HTTP layer failure, not `{ok:false,...}` at 200) → view.
 *  `mcp.go:351` 502 `{ok:false,error:"agent unreachable"}` and 404
 *  `mcp server not found` each get dedicated key, rest all fall back to generic,
 *  body strings never go into `detail` (that's backend English original). */
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
