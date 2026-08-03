import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmListItem from './VmListItem.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (over: Partial<KvmVM> = {}) => ({
  id: 'vm-1', name: 'sp9-alpine-test', state: 'running', vcpu: 2, memory: 1024,
  os: 'linux', ...over,
} as KvmVM)

const mk = (vm = VM(), active = false) =>
  mount(VmListItem, { props: { vm, active }, global: { plugins: [i18n] } })

describe('VmListItem', () => {
  it('显示名字、vCPU 数、内存(照 Vue2 :47-50 的 "2 vCPU" / "1.0 GB")', () => {
    const t = mk().text()
    expect(t).toContain('sp9-alpine-test')
    expect(t).toContain('2 vCPU')
    expect(t).toContain('1.0 GB')
  })

  it('状态点带 state 类,文字走 i18n', () => {
    const w = mk()
    expect(w.get('.status-dot').classes()).toContain('running')
    expect(w.text()).toContain('运行中')
  })

  it('未知状态(crashed)原样显示后端字符串,不显示空白', () => {
    expect(mk(VM({ state: 'crashed' })).text()).toContain('crashed')
  })

  it('active 时加 active 类', () => {
    expect(mk(VM(), true).classes()).toContain('active')
    expect(mk(VM(), false).classes()).not.toContain('active')
  })

  it('点击 emit select', async () => {
    const w = mk()
    await w.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })

  it('OS 图标 alt 用 os 字段(可访问性)', () => {
    expect(mk(VM({ os: 'ubuntu' })).get('img.os-icon').attributes('alt')).toBe('ubuntu')
  })

  it('长名字不撑破:类上有省略号样式钩子', () => {
    expect(mk(VM({ name: 'a'.repeat(80) })).find('.vm-item-name').exists()).toBe(true)
  })
})
