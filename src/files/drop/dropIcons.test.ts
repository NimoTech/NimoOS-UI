import { describe, it, expect } from 'vitest'
import { dropIconUrl } from './dropIcons'

describe('dropIconUrl', () => {
  it('self always has self icon', () => expect(dropIconUrl('desktop', false, true)).toContain('self'))
  it('model+state concatenation (including proprietary asset completion for mobile_offline)', () => {
    expect(dropIconUrl('tablet', true, false)).toContain('tablet_offline')
    expect(dropIconUrl('desktop', false, false)).toContain('desktop_online')
    expect(dropIconUrl('mobile', true, false)).toContain('mobile_offline')
  })
  it('unknown model falls back to desktop with same state', () => {
    expect(dropIconUrl('unknown-model', false, false)).toContain('desktop_online')
    expect(dropIconUrl('unknown-model', true, false)).toContain('desktop_offline')
  })
})
