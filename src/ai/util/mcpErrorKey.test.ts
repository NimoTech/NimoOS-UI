import { describe, it, expect } from 'vitest'
import {
  saveServerErrorKey, parseCommandErrorKey, toTestView, toTestViewFromError,
} from './mcpErrorKey'

/** 造一个 axios 风格的错误(共享包不吞 error,原样抛)。 */
function httpErr(status: number, data: unknown) {
  return Object.assign(new Error('Request failed'), { response: { status, data } })
}

describe('saveServerErrorKey —— 后端 validateAndClean 的三条 400', () => {
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
  it('大小写与首尾空白不敏感', () => {
    expect(saveServerErrorKey(httpErr(400, { message: '  URL Required For HTTP/SSE  ' })))
      .toBe('aiMcpSrvErrUrlRequired')
  })
  it('认不出的一律落通用兜底键,绝不回显后端原文', () => {
    const k = saveServerErrorKey(httpErr(500, { message: 'sql: database is locked' }))
    expect(k).toBe('aiCfgSaveFailed')
    expect(k).not.toContain('sql')
  })
  it('无 response / 网络错 → 通用兜底', () => {
    expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
    expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
  })
  it('也读 FastAPI 的 detail 形状(同 channelsFormat 的双读惯例)', () => {
    expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
      .toBe('aiMcpSrvErrCommandRequired')
  })
})

describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
  it('empty command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
      .toBe('aiMcpSrvParseErrEmpty')
  })
  // 「没解析出可执行的命令」是同一个用户可见原因的两种后端措辞,合并到一个键。
  // (合并前已按 P3b 教训 2 检查过:两条对用户而言就是同一件事——粘贴的内容里
  //  找不到可执行命令,措辞差异只反映后端在哪一步发现的。)
  it('no command after parsing → 同一个「没有可执行命令」键', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command after parsing' })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it("no command after '--' → 同一个「没有可执行命令」键", () => {
    expect(parseCommandErrorKey(httpErr(400, { message: "no command after '--'" })))
      .toBe('aiMcpSrvParseErrNoCommand')
  })
  it('no command (only environment variables) → 独立的键(原因不同:只有环境变量)', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .toBe('aiMcpSrvParseErrOnlyEnv')
  })
  it('unbalanced quotes in command', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'unbalanced quotes in command' })))
      .toBe('aiMcpSrvParseErrQuotes')
  })
  // 判别力:「只有环境变量」的串以 "no command" 开头,若实现用 startsWith 匹配
  // 会被 NoCommand 抢走。这条钉住优先级。
  it('「只有环境变量」不能被「没有可执行命令」抢走', () => {
    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
      .not.toBe('aiMcpSrvParseErrNoCommand')
  })
  it('认不出的落通用兜底,不回显原文', () => {
    const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
    expect(k).toBe('aiMcpSrvParseFailed')
    expect(k).not.toContain('brand new')
  })
})

describe('toTestView —— 200 响应体 → 视图', () => {
  it('成功', () => {
    expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
      .toEqual({ ok: true, toolCount: 3, tools: ['a', 'b', 'c'] })
  })
  it('成功但 tools 缺失 → 空数组,tool_count 缺失 → 0', () => {
    expect(toTestView({ ok: true })).toEqual({ ok: true, toolCount: 0, tools: [] })
  })
  it('probe_timeout', () => {
    expect(toTestView({ ok: false, error_key: 'probe_timeout', error: 'Probe timed out' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail: '' })
  })
  it('connect_failed 带 detail', () => {
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
  // 判别力:后端拼好的英文 error 串绝不能漏进视图。四个 error_key 各钉一次。
  it('后端的 error 英文串永不进入视图', () => {
    for (const key of ['probe_timeout', 'connect_failed', 'list_timeout', 'list_failed']) {
      const v = toTestView({ ok: false, error_key: key, error: 'LEAKED-ENGLISH-STRING' })
      expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
    }
  })
  it('未知 error_key → 通用兜底键,detail 仍保留', () => {
    expect(toTestView({ ok: false, error_key: 'brand_new_key', detail: 'd' }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'd' })
  })
  it('完全不是对象 / null / undefined → 失败 + 通用兜底', () => {
    expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
    expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('detail 非字符串时归一成空串', () => {
    expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
  })
})

describe('toTestViewFromError —— 抛出的错误 → 视图', () => {
  it('502 agent unreachable(mcp.go:351)', () => {
    expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
  })
  it('404 mcp server not found', () => {
    expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
  })
  it('网络错 / 无 response → 通用兜底', () => {
    expect(toTestViewFromError(new Error('Network Error')))
      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
  })
  it('任意后端原文都不进入视图', () => {
    const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
    expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
  })
})
