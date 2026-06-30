import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import AddPanel from './AddPanel.vue'

describe('AddPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('widget tab lists widgets and marks used ones', async () => {
    const layout = useLayoutStore(); layout.replaceAll([{ kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }])
    const w = mount(AddPanel, { props: { open: true } })
    expect(w.text()).toContain('时间') // clock widget card
    expect(w.text()).toContain('✓ 已添加') // clock used badge
  })
  it('clicking an app card pins it to the grid', async () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    const w = mount(AddPanel, { props: { open: true } })
    await w.get('[data-tab="app"]').trigger('click')
    await w.get('.lib-icon[data-key="vm"]').trigger('click')
    expect(layout.items.some((i) => i.key === 'vm')).toBe(true)
  })
})
