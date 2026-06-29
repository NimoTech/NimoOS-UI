import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import GridCanvas from './GridCanvas.vue'

describe('GridCanvas', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('renders one positioned GridItem per layout item', async () => {
    const s = useLayoutStore()
    s.replaceAll([
      { kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 },
      { kind: 'app', key: 'files', c: 11, r: 1, w: 1, h: 1 },
    ])
    const w = mount(GridCanvas)
    const cells = w.findAll('[data-id]')
    expect(cells).toHaveLength(2)
    const clock = w.get('[data-kind="widget"]')
    // grid-column 起始列 = c
    expect(clock.attributes('style')).toContain('grid-column: 1 / span 2')
    expect(clock.attributes('style')).toContain('grid-row: 1 / span 2')
    expect(clock.text()).toContain('时间')
  })
})
