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
  it('Displays name, vCPU count, memory (following Vue2 :47-50 "2 vCPU" / "1.0 GB")', () => {
    const t = mk().text()
    expect(t).toContain('sp9-alpine-test')
    expect(t).toContain('2 vCPU')
    expect(t).toContain('1.0 GB')
  })

  it('Status dot has state class, text comes from i18n', () => {
    const w = mk()
    expect(w.get('.status-dot').classes()).toContain('running')
    expect(w.text()).toContain('运行中')
  })

  it('Unknown state (crashed) displays backend string as-is, not blank', () => {
    expect(mk(VM({ state: 'crashed' })).text()).toContain('crashed')
  })

  it('When active, adds active class', () => {
    expect(mk(VM(), true).classes()).toContain('active')
    expect(mk(VM(), false).classes()).not.toContain('active')
  })

  it('Clicking emits select', async () => {
    const w = mk()
    await w.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })

  it('OS icon alt uses os field (accessibility)', () => {
    expect(mk(VM({ os: 'ubuntu' })).get('img.os-icon').attributes('alt')).toBe('ubuntu')
  })

  it('Long names do not break layout: class has ellipsis style hook', () => {
    expect(mk(VM({ name: 'a'.repeat(80) })).find('.vm-item-name').exists()).toBe(true)
  })
})
