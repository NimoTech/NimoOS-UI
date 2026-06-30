import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import GridCells from './GridCells.vue'

describe('GridCells', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('renders a cell for every unoccupied slot', () => {
    const s = useLayoutStore()
    s.replaceAll([{ kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 }]) // 占 1 格
    const w = mount(GridCells, { props: { cols: 12, rows: 8 } })
    expect(w.findAll('.cell').length).toBe(12 * 8 - 1) // 96 - 1
  })
})
