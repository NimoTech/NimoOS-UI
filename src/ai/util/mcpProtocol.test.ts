import { describe, it, expect } from 'vitest'
import { protocolLine } from './mcpProtocol'
import type { McpTestView } from '../types/mcpServer'

function ok(over: Partial<Extract<McpTestView, { ok: true }>> = {}): McpTestView {
  return {
    ok: true, toolCount: 1, tools: ['a'],
    protocolEra: 'modern', protocolVersion: '2025-06-18', supportedVersions: ['2025-06-18'],
    ...over,
  }
}

describe('protocolLine', () => {
  it('modern and only the negotiated version → single-version line', () => {
    expect(protocolLine(ok())).toEqual({ key: 'aiMcpSrvProtoOnly', params: { version: '2025-06-18' } })
  })

  it('modern and other versions declared too → "also supports" line (negotiated version excluded)', () => {
    expect(protocolLine(ok({ supportedVersions: ['2025-06-18', '2024-11-05', '2025-03-26'] })))
      .toEqual({ key: 'aiMcpSrvProtoAlso', params: { version: '2025-06-18', list: '2024-11-05, 2025-03-26' } })
  })

  it('legacy → "latest protocol not supported" line', () => {
    expect(protocolLine(ok({ protocolEra: 'legacy', protocolVersion: '2024-11-05' })))
      .toEqual({ key: 'aiMcpSrvProtoLegacy', params: { version: '2024-11-05' } })
  })

  it('era is unknown → renders nothing', () => {
    expect(protocolLine(ok({ protocolEra: 'unknown' }))).toBeNull()
  })

  it('older backend omits these fields entirely → renders nothing, never prints undefined', () => {
    expect(protocolLine(ok({ protocolEra: '', protocolVersion: '', supportedVersions: [] }))).toBeNull()
  })

  it('era is modern but the version string is empty → renders nothing (no line beats half a sentence)', () => {
    expect(protocolLine(ok({ protocolVersion: '' }))).toBeNull()
  })

  it('failure state never renders', () => {
    expect(protocolLine({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })).toBeNull()
  })
})
