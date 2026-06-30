import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { __resetAddPanelForTest } from '../composables/useAddPanel'
import AddPanel from './AddPanel.vue'

// Grid geometry used by the test: cell 92 + gap 16 => stride 108, 12x8 grid at origin.
const CELL = 92
const GAP = 16
const STRIDE = CELL + GAP // 108

function makeGridEl(): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({
      left: 0, top: 0,
      right: 12 * STRIDE, bottom: 8 * STRIDE,
      width: 12 * STRIDE, height: 8 * STRIDE,
      x: 0, y: 0, toJSON() {},
    } as DOMRect)
  document.body.appendChild(el)
  return el
}

describe('AddPanel spawn (drag = place at dropped cell)', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetAddPanelForTest() })

  it('dragging a widget onto the grid places it at the dropped cell, not firstFree', async () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})

    const gridEl = makeGridEl()
    const w = mount(AddPanel, {
      props: { open: true, cell: CELL, gap: GAP, cols: 12, rows: 8, gridEl },
      attachTo: document.body,
    })

    // Drop point (260,150) => tc = round((260-46)/108)+1 = 3, tr = round((150-46)/108)+1 = 2
    const card = w.get('.lib-card[data-key="clock"]')
    await card.trigger('pointerdown', { clientX: 260, clientY: 150 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 260, clientY: 160 })) // >6px => moved
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 260, clientY: 150 }))
    await nextTick()

    const clock = layout.items.find((i) => i.key === 'clock')
    expect(clock).toBeTruthy()
    expect([clock!.c, clock!.r]).toEqual([3, 2])

    w.unmount()
    gridEl.remove()
  })

  it('dragging then releasing OFF the grid (e.g. back onto the panel) cancels — adds nothing', async () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    vi.spyOn(layout, 'save').mockImplementation(() => {})

    const gridEl = makeGridEl()
    const w = mount(AddPanel, {
      props: { open: true, cell: CELL, gap: GAP, cols: 12, rows: 8, gridEl },
      attachTo: document.body,
    })

    const card = w.get('.lib-card[data-key="clock"]')
    await card.trigger('pointerdown', { clientX: 260, clientY: 150 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 260, clientY: 160 })) // >6px => moved
    // release far to the right of the grid (x > 12*108=1296) — i.e. over the panel
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 1500, clientY: 150 }))
    await nextTick()

    expect(layout.items.some((i) => i.key === 'clock')).toBe(false)

    w.unmount()
    gridEl.remove()
  })
})
