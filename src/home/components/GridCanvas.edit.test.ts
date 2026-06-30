import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useHomeUiStore } from '../stores/homeUi'
import { useLayoutStore } from '../stores/layout'
import GridCanvas from './GridCanvas.vue'

describe('GridCanvas edit overlays', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('renders GridCells only in edit mode', async () => {
    const ui = useHomeUiStore(); const layout = useLayoutStore()
    layout.replaceAll([{ kind: 'app', key: 'files', c: 1, r: 1, w: 1, h: 1 }])
    const w = mount(GridCanvas, { props: { cell: 84, gap: 16, cols: 12, rows: 8 } })
    expect(w.findAll('.cell').length).toBe(0)
    ui.toggleEdit(true); await w.vm.$nextTick()
    expect(w.findAll('.cell').length).toBeGreaterThan(0)
  })
})
