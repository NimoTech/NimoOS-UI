import { describe, it, expect } from 'vitest'
import { composeWebUrl } from './appUrl'

describe('composeWebUrl', () => {
  it('port_map + index 拼完整地址,hostname 缺省用当前主机', () => {
    expect(composeWebUrl({ scheme: 'http', hostname: null, port_map: '15006', index: '/' }, 'nas.local'))
      .toBe('http://nas.local:15006/')
    expect(composeWebUrl({ port_map: '8080', index: '/admin', hostname: 'box' }, 'nas.local'))
      .toBe('http://box:8080/admin')
  })
  it('无 port_map 且无 index → null(没有可打开的页面)', () => {
    expect(composeWebUrl({}, 'nas.local')).toBeNull()
    expect(composeWebUrl({ scheme: 'https' }, 'nas.local')).toBeNull()
  })
})
