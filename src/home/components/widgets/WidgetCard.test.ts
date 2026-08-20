import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import WidgetCard from './WidgetCard.vue'
import type { LayoutItem } from '../../grid/types'

const item = (key: string): LayoutItem => ({ id: 'i1', kind: 'widget', key, c: 1, r: 1, w: 2, h: 2 })

describe('WidgetCard', () => {
  // This mounts the clock without initService() having run, so useHostTimezone's
  // `service.sys` getter throws and it warns that the offset badge is hidden --
  // expected here, and asserted where it belongs (useHostTimezone.test.ts).
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    setActivePinia(createPinia())
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())
  it('renders the widget title from the registry', () => {
    const w = mount(WidgetCard, { props: { item: item('clock') } })
    expect(w.text()).toContain('时间')
  })
})
