import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from '../stores/homeUi'
import { useLayoutStore } from '../stores/layout'
import GridItem from './GridItem.vue'
import type { LayoutItem } from '../grid/types'

describe('GridItem edit affordances', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('shows remove button only in edit mode and removes on click', async () => {
    const ui = useHomeUiStore(); const layout = useLayoutStore()
    layout.replaceAll([{ kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 }])
    const item = layout.items[0]
    const w = mount(GridItem, { props: { item } })
    expect(w.find('.remove').exists()).toBe(false)
    ui.toggleEdit(true)
    await w.vm.$nextTick()
    expect(w.find('.remove').exists()).toBe(true)
    await w.get('.remove').trigger('click')
    expect(layout.items.find((i) => i.id === item.id)).toBeUndefined()
  })
  it('previewSize overrides grid-area span', () => {
    const layout = useLayoutStore(); layout.replaceAll([{ kind: 'widget', key: 'cpu', c: 1, r: 1, w: 2, h: 2 }])
    const w = mount(GridItem, { props: { item: layout.items[0], previewSize: { w: 4, h: 2 } } })
    expect(w.get('[data-id]').attributes('style')).toContain('span 4')
  })
})
