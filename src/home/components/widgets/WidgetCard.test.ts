import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import WidgetCard from './WidgetCard.vue'
import type { LayoutItem } from '../../grid/types'

const item = (key: string): LayoutItem => ({ id: 'i1', kind: 'widget', key, c: 1, r: 1, w: 2, h: 2 })

describe('WidgetCard', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('renders the widget title from the registry', () => {
    const w = mount(WidgetCard, { props: { item: item('clock') } })
    expect(w.text()).toContain('时间')
  })
})
