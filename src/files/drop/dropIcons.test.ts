import { describe, it, expect } from 'vitest'
import { dropIconUrl } from './dropIcons'

describe('dropIconUrl', () => {
  it('self 恒 self 图标', () => expect(dropIconUrl('desktop', false, true)).toContain('self'))
  it('model+状态拼名(含自有素材补齐的 mobile_offline)', () => {
    expect(dropIconUrl('tablet', true, false)).toContain('tablet_offline')
    expect(dropIconUrl('desktop', false, false)).toContain('desktop_online')
    expect(dropIconUrl('mobile', true, false)).toContain('mobile_offline')
  })
  it('未知 model 回退 desktop 同状态', () => {
    expect(dropIconUrl('unknown-model', false, false)).toContain('desktop_online')
    expect(dropIconUrl('unknown-model', true, false)).toContain('desktop_offline')
  })
})
