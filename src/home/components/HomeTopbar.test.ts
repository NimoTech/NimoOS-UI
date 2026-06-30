import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from '../stores/homeUi'
import HomeTopbar from './HomeTopbar.vue'

describe('HomeTopbar', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('edit button toggles editing and label', async () => {
    const ui = useHomeUiStore()
    const w = mount(HomeTopbar)
    const btn = w.get('.edit-btn')
    expect(btn.text()).toContain('编辑')
    await btn.trigger('click')
    expect(ui.editing).toBe(true)
    expect(btn.text()).toContain('完成')
  })
  it('emits add when add button clicked', async () => {
    const w = mount(HomeTopbar)
    await w.get('.add-btn').trigger('click')
    expect(w.emitted('add')).toBeTruthy()
  })
})
