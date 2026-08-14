import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleHeader from './ConsoleHeader.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

// kvmComingSoon draft copy "即将支持" → actual "即将上线" (verified against zh_cn.sp9.ts, see task-5-report.md).

const VM = (state = 'running') => ({ id: 'vm-1', name: 'sp9-alpine-test', state, os: 'linux', autostart: false } as KvmVM)
const mk = (vm = VM()) => mount(ConsoleHeader, { props: { vm, processing: false }, global: { plugins: [i18n] } })

describe('ConsoleHeader', () => {
  it('显示 VM 名与 OS 图标', () => {
    expect(mk().text()).toContain('sp9-alpine-test')
    expect(mk().find('img.console-os-icon').exists()).toBe(true)
  })
  it('状态点带 state 类', () => {
    expect(mk().get('.console-status .status-dot').classes()).toContain('running')
  })
  // P6 Task 9: gear button un-gated, following Vue2 canEditSettings (:674-676) / tooltip (:91).
  it('running 时齿轮禁用,tooltip 是「停止虚拟机以修改设置」', () => {
    const b = mk(VM('running')).findAll('.action-btn')[0]
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.attributes('title')).toContain('停止虚拟机以修改设置')
    expect(b.attributes('aria-label')).toBeTruthy()
  })
  it('stopped 时齿轮可点,tooltip 是「系统设置」', () => {
    const b = mk(VM('stopped')).findAll('.action-btn')[0]
    expect(b.attributes('disabled')).toBeUndefined()
    expect(b.attributes('title')).toContain('系统设置')
  })
  it('点击齿轮 emit action: settings', async () => {
    const w = mk(VM('stopped'))
    await w.findAll('.action-btn')[0].trigger('click')
    expect(w.emitted('action')![0]).toEqual(['settings'])
  })
  it('⋮ 按钮点击展开菜单,再点收起', async () => {
    const w = mk()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(true)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('菜单里的 action 透传给父组件,并顺手关菜单', async () => {
    const w = mk(VM('stopped'))
    await w.findAll('.action-btn')[1].trigger('click')
    const item = w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!
    await item.trigger('click')
    expect(w.emitted('action')![0]).toEqual(['start'])
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('点菜单外面关闭菜单(document click 监听)', async () => {
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    await w.findAll('.action-btn')[1].trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    w.unmount()
  })
  it('切换 VM 时菜单与确认态一起清空', async () => {
    const w = mk(VM('running'))
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!.trigger('click')
    await w.setProps({ vm: { ...VM('running'), id: 'vm-2' } as KvmVM })
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('卸载时摘掉 document 监听(不泄漏)', () => {
    // The brief's original version was a placeholder assertion (comparing a counter against itself before/after — always equal, tests nothing).
    // Changed to vi.spyOn to assert unmount actually calls document.removeEventListener('click', ...).
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    const spy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function))
    spy.mockRestore()
  })
})
