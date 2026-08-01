import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpiceInfoBar from './SpiceInfoBar.vue'
import { i18n } from '../../i18n'

const mk = (p: Record<string, unknown> = {}) =>
  mount(SpiceInfoBar, {
    props: { hostname: '192.168.1.10', spicePort: 5901, isWindowsGuest: false, ...p },
    global: { plugins: [i18n] },
  })

describe('SpiceInfoBar', () => {
  it('拼出 spice:// 连接串', () => {
    expect(mk().get('code').text()).toBe('spice://192.168.1.10:5901')
  })

  it('Linux 客户机提示装 spice-vdagent', () => {
    expect(mk().text()).toContain('spice-vdagent')
  })

  it('Windows 客户机提示装 virtio-win', () => {
    expect(mk({ isWindowsGuest: true }).text()).toContain('virtio-win')
  })

  it('关闭按钮 emit close 且有 aria-label', async () => {
    const w = mk()
    expect(w.get('.spice-info-close').attributes('aria-label')).toBeTruthy()
    await w.get('.spice-info-close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
