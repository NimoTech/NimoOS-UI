import { describe, it, expect, vi, afterEach } from 'vitest'
import { validatePort, buildProbeUrl, buildRedirectUrl, probeUiPort, PROBE_MAX_TRIES } from './checkUiPort'

afterEach(() => { vi.unstubAllGlobals() })

describe('validatePort (matches Vue2 L1387-1394)', () => {
  it('80 and 65535 are valid boundaries', () => {
    expect(validatePort('80')).toEqual({ ok: true, port: 80 })
    expect(validatePort('65535')).toEqual({ ok: true, port: 65535 })
  })
  it('79 and 65536 are out of range', () => {
    expect(validatePort('79').ok).toBe(false)
    expect(validatePort('65536').ok).toBe(false)
  })
  it('empty, non-numeric, and negative values are all invalid', () => {
    for (const v of ['', ' ', 'abc', '-1', '8o80']) expect(validatePort(v).ok).toBe(false)
  })
  it('decimals are rejected (Vue2 uses parseInt, which truncates 80.5 to 80 -- that is a Vue2 bug, do not copy it)', () => {
    expect(validatePort('80.5').ok).toBe(false)
  })
  it('tolerates surrounding whitespace around a plain number', () => {
    expect(validatePort(' 8080 ')).toEqual({ ok: true, port: 8080 })
  })
})

describe('buildProbeUrl', () => {
  it('builds /v1/gateway/port on the new port', () => {
    expect(buildProbeUrl('8080', { protocol: 'http:', hostname: '192.168.1.143' }))
      .toBe('http://192.168.1.143:8080/v1/gateway/port')
  })
})

describe('buildRedirectUrl (porting discipline #5)', () => {
  it('preserves the current path and hash -- otherwise it dumps the user onto / (the old Vue2 UI)', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: '192.168.1.143', pathname: '/app/', hash: '#/settings/general',
    })).toBe('http://192.168.1.143:8080/app/#/settings/general')
  })
  it('does not append a stray # when there is no hash', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: 'h', pathname: '/app/', hash: '',
    })).toBe('http://h:8080/app/')
  })
})

describe('probeUiPort', () => {
  it('returns the port reported by the backend when the envelope success=200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBe('8080')
  })
  it('returns null instead of throwing on a network error (the switch-over window is bound to be unreachable, so it must not bubble up)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBeNull()
  })
  it('returns null for a non-200 envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 500, message: 'x' }) })))
    expect(await probeUiPort('u')).toBeNull()
  })
  it('returns null when the response is not JSON either', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad') } })))
    expect(await probeUiPort('u')).toBeNull()
  })
})

describe('cap on probe attempts (porting discipline #4)', () => {
  it('has an explicit cap constant, not unbounded probing until the component is destroyed', () => {
    expect(PROBE_MAX_TRIES).toBe(40)   // 40 × 1500ms ≈ 60s
  })
})
