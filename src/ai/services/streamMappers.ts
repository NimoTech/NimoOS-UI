// 1:1 ported from Vue2 src/views/AI/Agent/services/agentStream.js
// (stripLeakedToolArgs L72-89, migrateLegacyMessages L91-98, mcpCallFromToolBlock
// L105-120, expandHistoryBlock L122-136, photoGridFromToolBlock L138-151,
// buildPhotoGridBlock L156-169, semanticSearchFromToolBlock L171-184,
// migrateLegacyBlock L188-211, parseMcpToolName L215-221, MCP_ERR_RE L225,
// parseShellResult L230-248, toLines L250-255, formatMs L654-658).
//
// dispatchEvent/runAgentRun/attachAgentStream/consumeSSE (the SSE transport +
// reducer half of agentStream.js) are ported separately in Task 5/6 — this
// module is the pure mapper family only.
import { buildSemanticSearchBlock } from './searchMapper'
import type { AgentBlock, AgentMessage, StreamActions } from '../types'

export { buildSemanticSearchBlock }

// Convert legacy tool/run_command blocks (persisted before the terminal card
// existed) into terminal blocks at history-load time. Blocks of any other
// shape pass through unchanged.
// Some providers (e.g. DeepSeek) leak the tool-call arguments JSON into the
// content token stream right before the structured tool_call event, so the
// streaming md block ends with '{"query": ...}'. Strip a trailing JSON object
// that equals this call's args. The persisted final message item is clean —
// this only affects live streaming and event replay, which both pass here.
export function stripLeakedToolArgs(actions: StreamActions, args: unknown): void {
  if (!args || typeof args !== 'object') return
  const want = JSON.stringify(args)
  actions.patchBlock(
    b => b.type === 'md' && !!b.streaming,
    old => {
      const text = (old.text as string) || ''
      for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
        try {
          if (JSON.stringify(JSON.parse(text.slice(i))) === want) {
            return { text: text.slice(0, i).trimEnd() }
          }
        } catch (e) { /* slice isn't a complete JSON object — keep scanning */ }
      }
      return {}
    },
  )
}

export function migrateLegacyMessages(messages: AgentMessage[]): AgentMessage[] {
  if (!Array.isArray(messages)) return messages
  return messages.map(m => {
    if (!m || !Array.isArray(m.blocks)) return m
    const blocks = m.blocks.flatMap(expandHistoryBlock)
    return { ...m, blocks }
  })
}

// At history-load, most blocks map 1:1 (run_command tool → terminal). The
// nimoos_search tool block expands 1 → [tool, semantic_search]: the rich search
// card is injected live by dispatchEvent but is NOT persisted by the backend
// (which stores only the raw tool call/result), so we rebuild it here from the
// persisted RESULT — mirroring the live behavior (ToolCard + SemanticSearchCard).
function mcpCallFromToolBlock(b: AgentBlock): AgentBlock | null {
  const mcp = parseMcpToolName(b.name as string)
  if (!mcp) return null
  const sections = (b.sections as any[]) || []
  const args = (sections.find(s => s.label === 'ARGUMENTS') || {}).code || '{}'
  const result = (sections.find(s => s.label === 'RESULT') || {}).code || ''
  return {
    type: 'mcp_call',
    state: result ? (MCP_ERR_RE.test(result) ? 'error' : 'success') : 'running',
    server: mcp.server,
    tool: mcp.tool,
    args,
    result,
    callId: b.callId || '',
  }
}

export function expandHistoryBlock(b: AgentBlock): AgentBlock[] {
  if (b && b.type === 'tool' && typeof b.name === 'string' && b.name.startsWith('mcp__')) {
    const mc = mcpCallFromToolBlock(b)
    if (mc) return [mc]
  }
  if (b && b.type === 'tool' && b.name === 'nimoos_search') {
    const sem = semanticSearchFromToolBlock(b)
    return sem ? [b, sem] : [b]
  }
  if (b && b.type === 'tool' && b.name === 'search_photos') {
    const grid = photoGridFromToolBlock(b)
    return grid ? [b, grid] : [b]
  }
  return [migrateLegacyBlock(b)]
}

function photoGridFromToolBlock(b: AgentBlock): AgentBlock | null {
  const sections = (b.sections as any[]) || []
  const resultCode = (sections.find(s => s.label === 'RESULT') || {}).code || ''
  const argsCode = (sections.find(s => s.label === 'ARGUMENTS') || {}).code || ''
  if (!resultCode) return null // run still in flight when persisted — no result yet
  let parsed
  try { parsed = JSON.parse(resultCode) } catch (e) { return null }
  let query = ''
  try {
    const args = JSON.parse(argsCode)
    if (args && typeof args.query === 'string') query = args.query
  } catch (e) { /* malformed args — fall through with empty query */ }
  return buildPhotoGridBlock(parsed, query)
}

// Builds a photo_grid card block from a parsed search_photos tool result and the
// originating query. Returns null when there are no results. Shared by the live
// tool_result handler and history-load reconstruction so the two never drift.
export function buildPhotoGridBlock(parsed: unknown, query: string): AgentBlock | null {
  const p = parsed as Record<string, any> | null | undefined
  const results = Array.isArray(p && p.results) ? p!.results : []
  if (results.length === 0) return null
  return {
    type: 'photo_grid',
    query: (p && p.query) || query || '',
    photos: results.map((r: any) => ({
      id: r.id,
      name: r.name,
      takenAt: r.takenAt,
      thumbUrl: `/v1/photos/assets/${r.id}/thumbnail?size=small`,
    })),
  }
}

function semanticSearchFromToolBlock(b: AgentBlock): AgentBlock | null {
  const sections = (b.sections as any[]) || []
  const resultCode = (sections.find(s => s.label === 'RESULT') || {}).code || ''
  const argsCode = (sections.find(s => s.label === 'ARGUMENTS') || {}).code || ''
  if (!resultCode) return null // run still in flight when persisted — no result yet
  let parsed
  try { parsed = JSON.parse(resultCode) } catch (e) { return null }
  let query = ''
  try {
    const args = JSON.parse(argsCode)
    if (args && typeof args.query === 'string') query = args.query
  } catch (e) { /* malformed args — fall through with empty query */ }
  return buildSemanticSearchBlock(parsed, query)
}

function migrateLegacyBlock(b: AgentBlock): AgentBlock {
  if (!b || b.type !== 'tool' || b.name !== 'run_command') return b
  const sections = (b.sections as any[]) || []
  const argsCode = (sections.find(s => s.label === 'ARGUMENTS') || {}).code || ''
  const resultCode = (sections.find(s => s.label === 'RESULT') || {}).code || ''
  let command = ''
  try {
    const args = JSON.parse(argsCode)
    if (args && typeof args.command === 'string') command = args.command
  } catch (e) { /* malformed — fall through with empty command */ }

  const base = {
    type: 'terminal',
    command,
    cwd: '/work',
    shell: 'bash',
    sandbox: 'nimo-sandbox',
  }
  // No RESULT section means the run was still in flight when persisted.
  if (!resultCode) {
    return { ...base, state: b.state === 'running' ? 'running' : 'success', lines: [] }
  }
  return { ...base, ...parseShellResult(resultCode) }
}

// MCP function tools are exposed as "mcp__<slug>__<tool>" (slug never contains
// "__"). Returns { server, tool } or null when the name isn't an MCP tool.
export function parseMcpToolName(name: string): { server: string; tool: string } | null {
  if (typeof name !== 'string' || !name.startsWith('mcp__')) return null
  const rest = name.slice(5) // strip "mcp__"
  const i = rest.indexOf('__')
  if (i <= 0 || i + 2 >= rest.length) return null
  return { server: rest.slice(0, i), tool: rest.slice(i + 2) }
}

// MCP wrapper returns plain strings even on failure; detect the known
// failure/refusal/blacklist prefixes so the call card can show an error state.
export const MCP_ERR_RE = /^(MCP 工具 .*调用失败|用户拒绝了该 MCP|已被黑名单拦截)/

// run_command (sandboxed shell) returns one string formatted as
// "[exit N]\n<body>" for completed runs or "[killed: timeout Ns]\n<body>"
// for timeouts. Anything else is rendered as raw stdout.
export function parseShellResult(content: string): Partial<AgentBlock> {
  const m = content.match(/^\[(?:exit (-?\d+)|killed: timeout (\d+)s)\]\n?([\s\S]*)$/)
  if (!m) {
    return {
      state: 'success',
      exitCode: 0,
      lines: toLines(content),
    }
  }
  const exitStr = m[1]
  const timeoutStr = m[2]
  const body = m[3]
  const lines = toLines(body)
  if (timeoutStr != null) {
    return { state: 'error', exitCode: 124, lines }
  }
  const exit = parseInt(exitStr, 10)
  return { state: exit === 0 ? 'success' : 'error', exitCode: exit, lines }
}

export function toLines(body: string): { text: string; stream: 'stdout' }[] {
  if (!body) return []
  const arr = body.split('\n').map(text => ({ text, stream: 'stdout' as const }))
  if (arr.length && arr[arr.length - 1].text === '') arr.pop()
  return arr
}

// Format a millisecond duration for display. <1000ms → "423ms"; otherwise
// seconds with one decimal: "4.5s". Null/undefined → empty string.
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
