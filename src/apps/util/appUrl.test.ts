import { describe, it, expect } from 'vitest'
import { composeWebUrl } from './appUrl'

describe('composeWebUrl', () => {
  it('port_map + index combine full address, hostname defaults to current host', () => {
    expect(composeWebUrl({ scheme: 'http', hostname: null, port_map: '15006', index: '/' }, 'nas.local'))
      .toBe('http://nas.local:15006/')
    expect(composeWebUrl({ port_map: '8080', index: '/admin', hostname: 'box' }, 'nas.local'))
      .toBe('http://box:8080/admin')
  })
  it('no port_map and no index → null (no page to open)', () => {
    expect(composeWebUrl({}, 'nas.local')).toBeNull()
    expect(composeWebUrl({ scheme: 'https' }, 'nas.local')).toBeNull()
  })
})
