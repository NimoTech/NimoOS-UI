import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FileGridView from './FileGridView.vue'
import type { FileEntry } from '../stores/files'

function entries(n: number): FileEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `f${i}`,
    path: `/DATA/f${i}`,
    is_dir: false,
    size: 1,
    date: '',
    extensions: null,
  }))
}

// jsdom lays nothing out: clientWidth/offsetHeight are 0 for everything. Stub
// the two measurements the component takes so the virtualization has real
// numbers to work with -- otherwise it correctly falls back to rendering the
// whole list and the tests below would prove nothing.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

const TILE_STUB = { FileTile: { template: '<div class="tile" @click="$emit(\'open-batch\', \'b1\')"/>' } }

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 614 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 116 })
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
})

describe('FileGridView virtualization', () => {
  it('renders every tile when the list is short', async () => {
    const w = mount(FileGridView, { props: { entries: entries(8) }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    expect(w.findAll('.tile').length).toBe(8)
  })

  it('renders far fewer tiles than entries for a large list', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    const rendered = w.findAll('.tile').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(500)
  })

  it('exposes a rect for EVERY entry, including ones with no DOM', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    const rects = (w.vm as unknown as { itemRects: () => { path: string }[] }).itemRects()
    expect(rects.length).toBe(5000)
    expect(rects[4999].path).toBe('/DATA/f4999')
    expect(w.findAll('.tile').length).toBeLessThan(500)
  })

  it('holds the total scroll height with spacers', async () => {
    const w = mount(FileGridView, { props: { entries: entries(5000) }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    const bottom = w.find('.grid-spacer-bottom').attributes('style') || ''
    expect(bottom).toContain('height')
    // 5000 items / 4 cols = 1250 rows; nearly all of them are below the window.
    expect(parseInt(bottom.replace(/\D/g, ''), 10)).toBeGreaterThan(10000)
  })

  it('still forwards open-batch from a tile', async () => {
    const w = mount(FileGridView, { props: { entries: entries(3) }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    await w.find('.tile').trigger('click')
    expect(w.emitted('open-batch')?.[0]).toEqual(['b1'])
  })

  it('renders nothing but does not throw for an empty folder', async () => {
    const w = mount(FileGridView, { props: { entries: [] }, global: { stubs: TILE_STUB } })
    await w.vm.$nextTick()
    expect(w.findAll('.tile').length).toBe(0)
    expect((w.vm as unknown as { itemRects: () => unknown[] }).itemRects()).toEqual([])
  })
})
