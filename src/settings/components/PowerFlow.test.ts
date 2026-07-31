import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

const powerCalls: string[] = []
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { power: async (a: string) => { powerCalls.push(a) } } },
}))

import PowerFlow from './PowerFlow.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(PowerFlow, { global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  powerCalls.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('PowerFlow 按钮与确认', () => {
  it('渲染关机与重启两个按钮', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').exists()).toBe(true)
    expect(w.find('.pf-restart').exists()).toBe(true)
  })

  it('两个按钮都有无障碍名(纯图标按钮)', () => {
    const w = mountIt()
    expect(w.find('.pf-shutdown').attributes('aria-label')).toBe('关机')
    expect(w.find('.pf-restart').attributes('aria-label')).toBe('重启')
  })

  it('点关机先弹确认,**未确认前不下发**(对位 Vue2 power() 只是开确认框)', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    expect(w.findAllComponents(AlertDialog)[0].props('open')).toBe(true)
    expect(powerCalls).toEqual([])
  })

  it('确认关机才 PUT off,并显示 shutting 浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['off'])
    expect(w.text()).toContain('正在关机')
  })

  it('取消关机:不下发、无浮层', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('update:open', false)
    await flushPromises()
    expect(powerCalls).toEqual([])
    expect(w.text()).not.toContain('正在关机')
  })

  it('确认重启才 PUT restart', async () => {
    const w = mountIt()
    await w.find('.pf-restart').trigger('click')
    w.findAllComponents(AlertDialog)[1].vm.$emit('confirm')
    await flushPromises()
    expect(powerCalls).toEqual(['restart'])
    expect(w.text()).toContain('正在重启')
  })

  it('power 接口报错也照样进浮层(Vue2 .catch(()=>{}) —— 关机请求常常来不及回响应)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.sys, 'power').mockRejectedValueOnce(new Error('boom'))
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    expect(w.text()).toContain('正在关机')
  })
})

// 六个浮层态的断言在 PowerOverlay.test.ts(纯展示组件,只吃一个 phase prop) ——
// 不需要在 PowerFlow 上开 __setPhase 这类只为测试存在的生产接口。

describe('PowerFlow 清理', () => {
  it('卸载时停掉相位机的定时器', async () => {
    const w = mountIt()
    await w.find('.pf-shutdown').trigger('click')
    w.findAllComponents(AlertDialog)[0].vm.$emit('confirm')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(3000 * 10)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
