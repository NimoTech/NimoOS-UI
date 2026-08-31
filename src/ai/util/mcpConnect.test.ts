import { describe, it, expect } from 'vitest'
import {
  mcpEndpointUrl, buildMcpInstruction, buildMcpJson, formatEpochMs, MCP_PLACEHOLDER_TOKEN,
} from './mcpConnect'

// Continuing from Vue2 __tests__/McpTokensSection.spec.js's 5 assertions:
// 'endpointUrl uses window origin' / 'buildInstruction() inlines the endpoint URL
// and the token' / 'buildJson() is valid MCP config JSON with url + bearer' /
// 'fmtCreated() formats created_at as ms date-time (no x1000)' /
// 'fmtLastUsed() shows "Never used" when falsy, else ms date-time' (numeric formatting
// part; text prefix left for Task 10 component layer to assemble).

describe('mcpConnect', () => {
  it('mcpEndpointUrl concatenates after origin and ends with / (continuing from Vue2 "endpointUrl uses window origin")', () => {
    expect(mcpEndpointUrl('http://nas.local')).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(mcpEndpointUrl('http://nas.local').endsWith('/v1/ai/mcp-rpc/')).toBe(true)
  })

  it('mcpEndpointUrl uses window.location.origin when called without arguments', () => {
    expect(mcpEndpointUrl()).toBe(`${window.location.origin}/v1/ai/mcp-rpc/`)
  })

  it('mcpEndpointUrl degrades to relative path when origin is empty (does not produce "undefined/v1/...")', () => {
    expect(mcpEndpointUrl('')).toBe('/v1/ai/mcp-rpc/')
  })

  it('buildMcpInstruction replaces all {url} and {token} (continuing from Vue2 test of same name)', () => {
    const tpl = 'connect url={url} token={token} again={url}'
    const out = buildMcpInstruction(tpl, 'http://nas.local/v1/ai/mcp-rpc/', 'secret')
    expect(out).toBe('connect url=http://nas.local/v1/ai/mcp-rpc/ token=secret again=http://nas.local/v1/ai/mcp-rpc/')
    expect(out).not.toContain('{url}')
    expect(out).not.toContain('{token}')
  })

  it('buildMcpInstruction shows placeholder string as-is when using placeholder token', () => {
    const out = buildMcpInstruction('token={token}', 'u', MCP_PLACEHOLDER_TOKEN)
    expect(out).toContain('<YOUR_TOKEN>')
  })

  it('buildMcpJson produces valid MCP config JSON with url and Bearer (continuing from Vue2 test of same name)', () => {
    const parsed = JSON.parse(buildMcpJson('http://nas.local/v1/ai/mcp-rpc/', 'secret'))
    expect(parsed.mcpServers.nimoos.url).toBe('http://nas.local/v1/ai/mcp-rpc/')
    expect(parsed.mcpServers.nimoos.headers.Authorization).toBe('Bearer secret')
  })

  it('buildMcpJson is multi-line text with two-space indentation (following Vue2 JSON.stringify(…, null, 2); textarea must be readable)', () => {
    expect(buildMcpJson('u', 't')).toContain('\n  "mcpServers"')
  })

  it('formatEpochMs interprets timestamp as milliseconds without multiplying by 1000 (continuing from Vue2 "no x1000")', () => {
    const ms = 1710000000000
    expect(formatEpochMs(ms)).toBe(new Date(ms).toLocaleString())
  })

  it('formatEpochMs returns "-" for 0 / undefined / null', () => {
    expect(formatEpochMs(0)).toBe('-')
    expect(formatEpochMs(undefined)).toBe('-')
    expect(formatEpochMs(null)).toBe('-')
  })
})
