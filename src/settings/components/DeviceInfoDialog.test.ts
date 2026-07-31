import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const hw = {
  arch: 'amd64', cpu_cores: 6, cpu_freq: 4600, cpu_model: 'Intel(R) Core(TM) 5 320',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1', hardware_name: '',
  ram_speed: '8533 MT/s', ram_total: 16335863808, ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}
const calls = { hardware: 0, base: 0 }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      hardwareInfo: async () => { calls.hardware++; return hw },
      getBaseInfo: async () => { calls.base++; return { device_id: '2389ab5a67ce8f1d541d5c5048afd5cd', model: '', version: hw.version } },
    },
  },
}))

import DeviceInfoDialog from './DeviceInfoDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// reka-ui's Dialog (src/components/ui/Dialog.vue) teleports DialogContent to
// <body>, outside the mounted wrapper's own DOM subtree (see
// src/components/ui/Dialog.test.ts / ShareLinkDialog.test.ts for the same
// pattern) — mount with attachTo: document.body and assert against a
// DOMWrapper over document.body, not the mount() wrapper itself.
const mountIt = (open = true) => mount(DeviceInfoDialog, { props: { open }, global: { plugins: [i18n] }, attachTo: document.body })
const body = () => new DOMWrapper(document.body)

beforeEach(() => { calls.hardware = 0; calls.base = 0 })
afterEach(() => { document.body.innerHTML = '' })

describe('DeviceInfoDialog', () => {
  it('打开时拉硬件与基础信息,渲染 5 行', async () => {
    mountIt()
    await flushPromises()
    expect(calls.hardware).toBe(1)
    expect(calls.base).toBe(1)
    const labels = body().findAll('.dev-label').map((e) => e.text())
    expect(labels).toEqual(['Platform', 'DC', 'CPU', 'RAM', 'GPU'])
  })

  it('platform 用 hardware_id 回退(本机 hardware_name 是空串)', async () => {
    mountIt()
    await flushPromises()
    expect(body().text()).toContain('nimoos-standard-v1')
  })

  it('CPU 行渲染型号 + 核数/频率/线程', async () => {
    mountIt()
    await flushPromises()
    const cpu = body().findAll('.dev-row')[2].text()
    expect(cpu).toContain('Intel(R) Core(TM) 5 320')
    expect(cpu).toContain('6')
    expect(cpu).toContain('~4.6 GHz')
    expect(cpu).toContain('12')
  })

  it('GPU 列表逐条渲染', async () => {
    mountIt()
    await flushPromises()
    expect(body().findAll('.dev-gpu')).toHaveLength(1)
  })

  it('open=false 时不发请求(别在设置页一进来就打硬件接口)', async () => {
    mountIt(false)
    await flushPromises()
    expect(calls.hardware).toBe(0)
  })

  it('cpu_model 为空时渲染「检测中」占位(纯函数返回空串,占位是模板的活)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockResolvedValueOnce({ ...hw, cpu_model: '' })
    mountIt()
    await flushPromises()
    expect(body().findAll('.dev-row')[2].text()).toContain('检测中')
  })

  it('接口失败不抛,渲染占位 ---', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'hardwareInfo').mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(svc.service.sys, 'getBaseInfo').mockRejectedValueOnce(new Error('boom'))
    mountIt()
    await flushPromises()
    expect(body().text()).toContain('---')
  })
})
