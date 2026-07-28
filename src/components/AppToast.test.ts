import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from '../stores/toast'
import AppToast from './AppToast.vue'

describe('AppToast', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders no pill when message is empty', () => {
    const w = mount(AppToast)
    expect(w.find('.toast').exists()).toBe(false)
  })

  it('renders the message from useToast', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('saved')
    await w.vm.$nextTick()
    expect(w.get('.toast').text()).toBe('saved')
  })

  it('stacks multiple toasts', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('first')
    t.show('second')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills).toHaveLength(2)
    expect(pills.map((p) => p.text())).toEqual(['first', 'second'])
  })

  // SP8-P1c2 Task 6: three tiers (info/warning/danger), each rendering its
  // own [data-tier] so AppToast.vue's CSS can style them from global theme
  // tokens (this component is outside .agent-app scope, see theme.css).
  it('a default show(text) call renders data-tier="info"', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('saved')
    await w.vm.$nextTick()
    expect(w.get('.toast').attributes('data-tier')).toBe('info')
  })

  it('renders data-tier="warning" and data-tier="danger" for tiered toasts', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('careful', 1500, 'warning')
    t.show('failed', 1500, 'danger')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills.map((p) => p.attributes('data-tier'))).toEqual(['warning', 'danger'])
  })

  it('stacks toasts of different tiers together', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('info one')
    t.show('warn one', 1500, 'warning')
    t.show('danger one', 1500, 'danger')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills).toHaveLength(3)
    expect(pills.map((p) => p.attributes('data-tier'))).toEqual(['info', 'warning', 'danger'])
  })
})
