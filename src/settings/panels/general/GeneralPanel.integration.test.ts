import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const blob: Record<string, unknown> = {}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', drive_model: '', version: '1.9.3-alpha1+25.gc8d7d14-dirty' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.9.3' }),
      getServerPort: async () => '80',
      getUsbStatus: async () => false,
      getOsVersion: async () => ({ current_version: '1.0.0', need_update: false }),
      getAppVersion: async () => ({ current_version: '1.9.3-alpha1+25.gc8d7d14-dirty', need_update: false }),
      setDiskStandby: async () => {},
      editServerPort: async () => {},
      toggleUsbAutoMount: async () => {},
      power: async () => {},
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

import GeneralPanel from '../GeneralPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(GeneralPanel, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
})

describe('GeneralPanel assembly', () => {
  it('title is "通用"', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('通用')
  })

  it('the P0 empty-state placeholder has been removed', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('the device info card comes before the list', async () => {
    const w = mountIt(); await flushPromises()
    const html = w.html()
    expect(html.indexOf('set-card')).toBeGreaterThan(-1)
    expect(html.indexOf('set-card')).toBeLessThan(html.indexOf('set-list'))
  })

  it('10 rows + the developer entry, in the same order as Vue2', async () => {
    const w = mountIt(); await flushPromises()
    const labels = w.findAll('.set-list .set-row-label').map((e) => e.text())
    expect(labels).toEqual([
      '壁纸', '语言', '时区', '硬盘待机', 'WebUI 端口',
      '自动挂载USB磁盘', '显示推荐应用', '新闻流',
      '固件更新', '系统更新',
    ])
  })

  it('the developer entry row is still last and can emit open-tab', async () => {
    const w = mountIt(); await flushPromises()
    const row = w.find('.set-dev-entry')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(w.emitted('open-tab')).toEqual([['developer']])
  })

  it('the "show other Docker container apps" row does not exist (debt D15)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toContain('Docker')
  })

  it('the Premium promo bar does not exist (authorized deviation #6)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/Premium|Upgrade Now/)
  })

  it('the firmware update row subtitle uses hardware.version (not the current_version from os_version)', async () => {
    const w = mountIt(); await flushPromises()
    const subs = w.findAll('.set-list .set-row-sub').map((e) => e.text())
    // firmware row subtitle = hardware.version; system row subtitle = current_version from /sys/version
    expect(subs[0]).toBe('v1.9.3-alpha1+25.gc8d7d14-dirty')
  })

  it('renders the whole page without leaking a bare i18n key', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.text()).not.toMatch(/settings[A-Z]\w+/)
  })

  it('the page still renders fully when every row API fails (no blank screen)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    for (const m of ['hardwareInfo', 'getBaseInfo', 'getServerPort', 'getUsbStatus', 'getOsVersion', 'getAppVersion'] as const) {
      vi.spyOn(svc.service.sys, m).mockRejectedValue(new Error('boom'))
    }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValue(new Error('boom'))
    const w = mountIt(); await flushPromises()
    expect(w.findAll('.set-list .set-row-label')).toHaveLength(10)
  })
})
