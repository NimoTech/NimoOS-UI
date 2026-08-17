import { describe, it, expect } from 'vitest'
import {
  saveServerErrorKey, parseCommandErrorKey, toTestView, toTestViewFromError,
} from './mcpErrorKey'

/** Create an axios-style error (shared package doesn't swallow error, throws as-is). */
function httpErr(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), { response: { status, data } })
}

describe('saveServerErrorKey — backend validateAndClean three 400s', () => {
  it('url required for http/sse', () => {
    expect(saveServerErrorKey(httpErr(400, { message: 'url required for http/sse' })))
      .toBe('aiMcpSrvErrUrlRequired')
  })
  it('command required for stdio', () => {
    expect(saveServerErrorKey(httpErr(400, { message: 'command required for stdio' })))
      .toBe('aiMcpSrvErrCommandRequired')
  })
  it("transport must be 'http', 'sse' or 'stdio'", () => {
    expect(saveServerErrorKey(httpErr(400, { message: "transport must be 'http', 'sse' or 'stdio'" })))
      .toBe('aiMcpSrvErrBadTransport')
  })
  it('404 mcp server not found', () => {
    expect(saveServerErrorKey(httpErr(404, { message: 'mcp server not found' })))
      .toBe('aiMcpSrvErrNotFound')
  })
  it('case and leading/trailing whitespace insensitive', () => {
    expect(saveServerErrorKey(httpErr(400, { message: '  URL Required For HTTP/SSE  ' })))
      .toBe('aiMcpSrvErrUrlRequired')
  })
  it('unrecognized errors all fall back to generic key, never echo backend original text', () => {
    const k = saveServerErrorKey(httpErr(500, { message: 'sql: database is locked' }))
    expect(k).toBe('aiCfgSaveFailed')
    expect(k).not.toContain('sql')
  })
  it('no response / network error → generic catchall', () => {
    expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
  })
  it('also read FastAPI detail shape (same dual-read convention as channelsFormat)', () => {
    expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
      .toBe('aiMcpSrvErrCommandRequired')
  })
  // Review Important: raw string body — rawMessage only recognizes `{message}`/`{detail}`
  // object shapes, raw string doesn't satisfy `typeof data === 'object'`, must fall back to
  // generic catchall, and the string must not leak verbatim.
  it('body is raw string → generic catchall, do not echo the string', () => {
    const k = saveServerErrorKey(httpErr(400, 'plain text error'))
    expect(k).toBe('aiCfgSaveFailed')
    expect(JSON.stringify(k)).not.toContain('plain text error')
  })
  // Body array: `typeof [] === 'object'` is true, but array has no `.message`/`.detail` properties,
  // extraction chain must safely get undefined rather than throw or accidentally assemble array contents.
  it('body is array → generic catchall, do not leak array contents', () => {
    const k = saveServerErrorKey(httpErr(400, ['a', 'b']))
    expect(k).toBe('aiCfgSaveFailed')
    expect(JSON.stringify(k)).not.toContain('"a"')
    expect(JSON.stringify(k)).not.toContain('"b"')
  })
})

describe('parseCommandErrorKey — mcpparse five 400s', () => {
  it('empty command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
      .toBe('aiMcpSrvParseErrEmpty')
  })
  // "No executable command after parsing" is two backend wordings for the same user-visible
  // reason, merged into one key. (Before merging, checked per P3b lesson 2: both are the same
  // to the user — pasted content contains no executable command, wording difference only
  // reflects where backend detected it.)
  it('no command after parsing → same "no executable command" key', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command after parsing' })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it("no command after '--' → same \"no executable command\" key", () => {
    expect(parseCommandErrorKey(httpErr(400, { message: "no command after '--'" })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it('no command (only environment variables) → separate key (different reason: only env vars)', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .toBe('aiMcpSrvParseErrOnlyEnv')
  })
  it('unbalanced quotes in command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'unbalanced quotes in command' })))
      .toBe('aiMcpSrvParseErrQuotes')
  })
  // Specificity: "only environment variables" string starts with "no command", if using
  // startsWith matching would be stolen by NoCommand. This test pins priority order.
  it('"only env vars" must not be stolen by "no executable command"', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .not.toBe('aiMcpSrvParseErrNoCommand')
  })
  it('unrecognized error falls back to generic key, never echo original text', () => {
    const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
    expect(k).toBe('aiMcpSrvParseFailed')
    expect(k).not.toContain('brand new')
  })
  // Review Important: same rawMessage extraction chain is reused by parseCommandErrorKey,
  // raw string / array boundary cases must also be pinned on this function (not just saveServerErrorKey).
  it('body is raw string → generic catchall, do not echo the string', () => {
    const k = parseCommandErrorKey(httpErr(400, 'plain text error'))
    expect(k).toBe('aiMcpSrvParseFailed')
    expect(JSON.stringify(k)).not.toContain('plain text error')
  })
  it('body is array → generic catchall, do not leak array contents', () => {
    const k = parseCommandErrorKey(httpErr(400, ['a', 'b']))
    expect(k).toBe('aiMcpSrvParseFailed')
    expect(JSON.stringify(k)).not.toContain('"a"')
    expect(JSON.stringify(k)).not.toContain('"b"')
  })
})

describe('toTestView — 200 response body → view', () => {
  it('success', () => {
    expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
      .toEqual({
        ok: true, toolCount: 3, tools: ['a', 'b', 'c'],
        protocolEra: '', protocolVersion: '', supportedVersions: [],
      })
  })
  it('success but tools missing → empty array, tool_count missing → 0', () => {
    expect(toTestView({ ok: true })).toEqual({
      ok: true, toolCount: 0, tools: [],
      protocolEra: '', protocolVersion: '', supportedVersions: [],
    })
  })
  it('probe_timeout', () => {
    expect(toTestView({ ok: false, error_key: 'probe_timeout', error: 'Probe timed out' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail: '' })
  })
  it('connect_failed with detail', () => {
    expect(toTestView({
      ok: false, error_key: 'connect_failed',
      error: 'Connection failed: All connection attempts failed',
      detail: 'All connection attempts failed',
    })).toEqual({
      ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail: 'All connection attempts failed',
    })
  })
  it('list_timeout', () => {
    expect(toTestView({ ok: false, error_key: 'list_timeout' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail: '' })
  })
  it('list_failed', () => {
    expect(toTestView({ ok: false, error_key: 'list_failed', detail: 'boom' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: 'boom' })
  })
  // Specificity: backend-crafted English error string must never leak into view. Pin once for each of four error_keys.
  it('backend error English string never enters view', () => {
    for (const key of ['probe_timeout', 'connect_failed', 'list_timeout', 'list_failed']) {
      const v = toTestView({ ok: false, error_key: key, error: 'LEAKED-ENGLISH-STRING' })
      expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
    }
  })
  it('unknown error_key → generic fallback key, detail still preserved', () => {
    expect(toTestView({ ok: false, error_key: 'brand_new_key', detail: 'd' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'd' })
  })
  it('not an object / null / undefined → failure + generic fallback', () => {
    expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('detail not string → normalize to empty string', () => {
    expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
  })
  // Review Important: `error_key: null` not in four-value lookup table, switch falls through
  // default; strongly assert entire view shape to ensure null itself and detail don't leak into result.
  it('error_key is null → fall back to generic, detail still preserved, null doesn\'t leak', () => {
    const v = toTestView({ ok: false, error_key: null, detail: 'x' })
    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'x' })
    expect(JSON.stringify(v)).not.toContain('null')
  })

  it('toTestView carries the three protocol fields through', () => {
    expect(toTestView({
      ok: true, tool_count: 2, tools: ['a', 'b'],
      protocol_era: 'modern', protocol_version: '2025-06-18',
      supported_versions: ['2025-06-18', '2024-11-05'],
    })).toEqual({
      ok: true, toolCount: 2, tools: ['a', 'b'],
      protocolEra: 'modern', protocolVersion: '2025-06-18',
      supportedVersions: ['2025-06-18', '2024-11-05'],
    })
  })

  it('toTestView: older backend omitting the protocol fields normalizes to empty, not undefined', () => {
    expect(toTestView({ ok: true, tool_count: 0, tools: [] })).toEqual({
      ok: true, toolCount: 0, tools: [],
      protocolEra: '', protocolVersion: '', supportedVersions: [],
    })
  })

  it('toTestView: connect_timeout has its own key', () => {
    expect(toTestView({ ok: false, error_key: 'connect_timeout', detail: 'x' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrConnectTimeout', detail: 'x' })
  })
})

describe('toTestViewFromError — thrown error → view', () => {
  it('502 agent unreachable (mcp.go:351)', () => {
    expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
  })
  it('404 mcp server not found', () => {
    expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
  })
  it('network error / no response → generic fallback', () => {
    expect(toTestViewFromError(new Error('Network Error')))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('no backend original text enters view', () => {
    const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
    expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
  })
  // Review Important: 502 check only looks at status===502 (see mcpErrorKey.ts
  // `status === 502 || bodyError === 'agent unreachable'`), doesn't depend on body shape —
  // body not the expected `{ok:false,error:'agent unreachable'}` still must fall agentDown,
  // and nothing in body can leak into view.
  it('502 but body shape not expected (non-standard object) → still agentDown, don\'t leak body', () => {
    const v = toTestViewFromError(httpErr(502, { unexpected: 'LEAKED-UNEXPECTED-SHAPE' }))
    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
    expect(JSON.stringify(v)).not.toContain('LEAKED-UNEXPECTED-SHAPE')
  })
  it('502 and body is raw string → still agentDown, don\'t leak the string', () => {
    const v = toTestViewFromError(httpErr(502, 'LEAKED-STRING-BODY'))
    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
    expect(JSON.stringify(v)).not.toContain('LEAKED-STRING-BODY')
  })
})
