import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
    },
  },
}))

import DeviceInfoCard from './DeviceInfoCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

describe('DeviceInfoCard', () => {
  it('renders the NimoOS title, version, and logo', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-title').text()).toBe('NimoOS')
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.9.3-alpha1+25.gc8d7d14-dirty')
    expect(w.find('img.set-logo').exists()).toBe(true)
  })

  it('falls back to v1.0.0 when the version fetch fails (matches Vue2:90)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.dic-version').text()).toBe('NimoOS v1.0.0')
  })

  it('clicking the "Device Info" button opens the dialog', async () => {
    const w = mount(DeviceInfoCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(false)
    await w.find('.dic-btn').trigger('click')
    expect(w.findComponent({ name: 'DeviceInfoDialog' }).props('open')).toBe(true)
  })
})
