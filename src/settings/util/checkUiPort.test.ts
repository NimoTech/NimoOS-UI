import { describe, it, expect, vi, afterEach } from 'vitest'
import { validatePort, buildProbeUrl, buildRedirectUrl, probeUiPort, PROBE_MAX_TRIES } from './checkUiPort'

afterEach(() => { vi.unstubAllGlobals() })

describe('validatePort(对位 Vue2 L1387-1394)', () => {
  it('80 与 65535 是合法边界', () => {
    expect(validatePort('80')).toEqual({ ok: true, port: 80 })
    expect(validatePort('65535')).toEqual({ ok: true, port: 65535 })
  })
  it('79 与 65536 越界', () => {
    expect(validatePort('79').ok).toBe(false)
    expect(validatePort('65536').ok).toBe(false)
  })
  it('空、非数字、负数都不合法', () => {
    for (const v of ['', ' ', 'abc', '-1', '8o80']) expect(validatePort(v).ok).toBe(false)
  })
  it('小数被拒(Vue2 用 parseInt 会把 80.5 吃成 80 —— 这是它的 bug,不照抄)', () => {
    expect(validatePort('80.5').ok).toBe(false)
  })
  it('带空格的纯数字容错', () => {
    expect(validatePort(' 8080 ')).toEqual({ ok: true, port: 8080 })
  })
})

describe('buildProbeUrl', () => {
  it('拼出新端口上的 /v1/gateway/port', () => {
    expect(buildProbeUrl('8080', { protocol: 'http:', hostname: '192.168.1.143' }))
      .toBe('http://192.168.1.143:8080/v1/gateway/port')
  })
})

describe('buildRedirectUrl(移植纪律 #5)', () => {
  it('保留当前路径与 hash —— 否则会把用户甩进 /(旧 Vue2 界面)', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: '192.168.1.143', pathname: '/app/', hash: '#/settings/general',
    })).toBe('http://192.168.1.143:8080/app/#/settings/general')
  })
  it('没有 hash 时不拼多余的 #', () => {
    expect(buildRedirectUrl('8080', {
      protocol: 'http:', hostname: 'h', pathname: '/app/', hash: '',
    })).toBe('http://h:8080/app/')
  })
})

describe('probeUiPort', () => {
  it('信封 success=200 时返回后端报的端口', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBe('8080')
  })
  it('网络错误返回 null 而不抛(切换期间必然连不上,不能让它冒泡)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await probeUiPort('http://h:8080/v1/gateway/port')).toBeNull()
  })
  it('非 200 信封返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 500, message: 'x' }) })))
    expect(await probeUiPort('u')).toBeNull()
  })
  it('响应不是 JSON 也返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad') } })))
    expect(await probeUiPort('u')).toBeNull()
  })
})

describe('探活次数上限(移植纪律 #4)', () => {
  it('有明确上限常量,不是无限探到组件销毁', () => {
    expect(PROBE_MAX_TRIES).toBe(40)   // 40 × 1500ms ≈ 60s
  })
})
