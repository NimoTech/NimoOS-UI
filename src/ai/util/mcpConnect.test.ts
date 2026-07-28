import { describe, it, expect } from 'vitest'
import {
  mcpEndpointUrl, buildMcpInstruction, buildMcpJson, formatEpochMs, MCP_PLACEHOLDER_TOKEN,
} from './mcpConnect'

// SP8-P2b Task 9 —— 承接 Vue2 __tests__/McpTokensSection.spec.js 的 5 条断言:
// 'endpointUrl uses window origin' / 'buildInstruction() inlines the endpoint URL
// and the token' / 'buildJson() is valid MCP config JSON with url + bearer' /
// 'fmtCreated() formats created_at as ms date-time (no x1000)' /
// 'fmtLastUsed() shows "Never used" when falsy, else ms date-time'(数值格式化部分,
// 文案前缀留给 Task 10 组件层拼)。

describe('mcpConnect', () => {
  it('mcpEndpointUrl 拼在 origin 后面并以 / 结尾（承接 Vue2「endpointUrl uses window origin」）', () => {
    expect(mcpEndpointUrl('http://nas.local')).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(mcpEndpointUrl('http://nas.local').endsWith('/v1/ai/mcp-rpc/')).toBe(true)
  })

  it('mcpEndpointUrl 不传参时用 window.location.origin', () => {
    expect(mcpEndpointUrl()).toBe(`${window.location.origin}/v1/ai/mcp-rpc/`)
  })

  it('mcpEndpointUrl 在 origin 为空时退化成相对路径（不产出 "undefined/v1/..."）', () => {
    expect(mcpEndpointUrl('')).toBe('/v1/ai/mcp-rpc/')
  })

  it('buildMcpInstruction 把 {url} 与 {token} 全部替换（承接 Vue2 同名用例）', () => {
    const tpl = 'connect url={url} token={token} again={url}'
    const out = buildMcpInstruction(tpl, 'http://nas.local/v1/ai/mcp-rpc/', 'secret')
    expect(out).toBe('connect url=http://nas.local/v1/ai/mcp-rpc/ token=secret again=http://nas.local/v1/ai/mcp-rpc/')
    expect(out).not.toContain('{url}')
    expect(out).not.toContain('{token}')
  })

  it('buildMcpInstruction 用占位令牌时占位串原样出现', () => {
    const out = buildMcpInstruction('token={token}', 'u', MCP_PLACEHOLDER_TOKEN)
    expect(out).toContain('<YOUR_TOKEN>')
  })

  it('buildMcpJson 是合法 MCP 配置 JSON，带 url 与 Bearer（承接 Vue2 同名用例）', () => {
    const parsed = JSON.parse(buildMcpJson('http://nas.local/v1/ai/mcp-rpc/', 'secret'))
    expect(parsed.mcpServers.nimoos.url).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(parsed.mcpServers.nimoos.headers.Authorization).toBe('Bearer secret')
  })

  it('buildMcpJson 是两空格缩进的多行文本（照 Vue2 JSON.stringify(…, null, 2)，textarea 要可读）', () => {
    expect(buildMcpJson('u', 't')).toContain('\n  "mcpServers"')
  })

  it('formatEpochMs 按毫秒解释时间戳，不再乘 1000（承接 Vue2「no x1000」）', () => {
    const ms = 1710000000000
    expect(formatEpochMs(ms)).toBe(new Date(ms).toLocaleString())
  })

  it('formatEpochMs 对 0 / undefined / null 一律返回 "-"', () => {
    expect(formatEpochMs(0)).toBe('-')
    expect(formatEpochMs(undefined)).toBe('-')
    expect(formatEpochMs(null)).toBe('-')
  })
})
