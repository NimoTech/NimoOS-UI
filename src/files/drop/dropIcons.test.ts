import { describe, it, expect } from 'vitest'
import { dropIconUrl } from './dropIcons'

describe('dropIconUrl', () => {
  it('self 恒 self 图标', () => expect(dropIconUrl('desktop', false, true)).toContain('self'))
  it('model+状态拼名', () => {
    expect(dropIconUrl('tablet', true, false)).toContain('tablet_offline')
    expect(dropIconUrl('desktop', false, false)).toContain('desktop_online')
  })
  it('缺失图标回退 desktop 同状态(mobile_offline 资产缺失)', () => {
    expect(dropIconUrl('mobile', true, false)).toContain('desktop_offline')
    expect(dropIconUrl('unknown-model', false, false)).toContain('desktop_online')
  })
})
