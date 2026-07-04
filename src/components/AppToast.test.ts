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
})
