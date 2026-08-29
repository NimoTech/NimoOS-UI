// P6a-T8: PlacesZoomBar.vue — vertical zoom slider on map left side.
// Maps each item to the required test checklist, adds coverage for
// structure specs 1-5 and dead code removal list (4 items).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlacesZoomBar from '../PlacesZoomBar.vue'
import { MAX_SCALE } from '../../util/placesMap'

function mountBar(props: Partial<InstanceType<typeof PlacesZoomBar>['$props']> = {}) {
  return mount(PlacesZoomBar, {
    props: {
      zoomFrac: 0,
      dotColor: '#8ab4ff',
      ...props,
    },
  })
}

// Track rect mock: {top:100, height:200} (given in brief, three points below hand-calculated in each test comment).
function mockTrackRect(el: HTMLElement, top = 100, height = 200): void {
  el.getBoundingClientRect = () =>
    ({ top, height, left: 0, bottom: top + height, right: 0, width: 6, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
}

describe('structure specs 1-5: all four visible nodes present', () => {
  it('two .zb-btn (zoom-in/zoom-out) + .zb-reset + .zb-fill and .zb-thumb inside .zb-track', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn')
    // .zb-reset itself also has zb-btn class, so all three buttons (zoom-in/zoom-out/reset) are selected by .zb-btn
    expect(btns.length).toBe(3)
    expect(w.find('.zb-reset').exists()).toBe(true)
    expect(w.find('.zb-track').exists()).toBe(true)
    expect(w.find('.zb-track .zb-fill').exists()).toBe(true)
    expect(w.find('.zb-track .zb-thumb').exists()).toBe(true)
  })

  it('zoom-in button text is +, zoom-out is U+2212 (not ASCII hyphen), reset is ⤢', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    expect(btns).toHaveLength(2)
    expect(btns[0].text()).toBe('+')
    const minusBtn = btns[1]
    expect(minusBtn.text()).toBe('−')
    expect(minusBtn.text().codePointAt(0)).toBe(0x2212)
    expect(w.find('.zb-reset').text()).toBe('⤢')
  })

  it('zoom-in/zoom-out button titles are i18n zoom-in/zoom-out, reset title is reset view', () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    expect(btns[0].attributes('title')).toBe('放大')
    expect(btns[1].attributes('title')).toBe('缩小')
    expect(w.find('.zb-reset').attributes('title')).toBe('重置视图')
  })
})

describe('structure spec 3: zoomFrac → fill height / thumb bottom (separate assertions, different properties)', () => {
  it('zoomFrac = 0.5 → fill.height = 50%, thumb.bottom = 50%', () => {
    const w = mountBar({ zoomFrac: 0.5 })
    const fill = w.find('.zb-fill').element as HTMLElement
    const thumb = w.find('.zb-thumb').element as HTMLElement
    expect(fill.style.height).toBe('50%')
    expect(thumb.style.bottom).toBe('50%')
    // Reverse check: no swapped properties — fill should not have bottom style, thumb
    // should not have height style (:style binding only sets the respective property).
    expect(fill.style.bottom).toBe('')
    expect(thumb.style.height).toBe('')
  })

  it('zoomFrac = 0 → 0%; zoomFrac = 1 → 100%', () => {
    const w0 = mountBar({ zoomFrac: 0 })
    expect((w0.find('.zb-fill').element as HTMLElement).style.height).toBe('0%')
    expect((w0.find('.zb-thumb').element as HTMLElement).style.bottom).toBe('0%')
    const w1 = mountBar({ zoomFrac: 1 })
    expect((w1.find('.zb-fill').element as HTMLElement).style.height).toBe('100%')
    expect((w1.find('.zb-thumb').element as HTMLElement).style.bottom).toBe('100%')
  })
})

describe('structure specs 2/4/5: button emits', () => {
  it('+ emits zoom-by with 1.5', async () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    await btns[0].trigger('click')
    expect(w.emitted('zoom-by')).toHaveLength(1)
    expect(w.emitted('zoom-by')![0]).toEqual([1.5])
  })

  it('− emits zoom-by with 1/1.5 (toBeCloseTo)', async () => {
    const w = mountBar()
    const btns = w.findAll('.zb-btn').filter(b => !b.classes().includes('zb-reset'))
    await btns[1].trigger('click')
    expect(w.emitted('zoom-by')).toHaveLength(1)
    const [factor] = w.emitted('zoom-by')![0] as [number]
    expect(factor).toBeCloseTo(1 / 1.5)
  })

  it('⤢ emits reset (no parameters)', async () => {
    const w = mountBar()
    await w.find('.zb-reset').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
    expect(w.emitted('reset')![0]).toEqual([])
  })
})

describe('drag conversion (per Vue2 :666-673, top=max zoom, bottom=min)', () => {
  // rect = {top:100, height:200}. Hand-calculated:
  //  clientY=100 (top) → t=(100-100)/200=0        → scale = 16 - 0*15 = 16 = MAX_SCALE
  //  clientY=300 (bottom) → t=(300-100)/200=1        → scale = 16 - 1*15 = 1
  //  clientY=200 (middle) → t=(200-100)/200=0.5      → scale = 16 - 0.5*15 = 8.5 = (MAX_SCALE+1)/2
  it('clientY=100 (top) → set-scale is MAX_SCALE', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    expect(w.emitted('set-scale')![0]).toEqual([MAX_SCALE])
  })

  it('clientY=300 (bottom) → set-scale is 1', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 300, pointerId: 1 })
    expect(w.emitted('set-scale')![0]).toEqual([1])
  })

  it('clientY=200 (middle) → set-scale is 8.5', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 200, pointerId: 1 })
    const [scale] = w.emitted('set-scale')![0] as [number]
    expect(scale).toBeCloseTo(8.5)
    expect(scale).toBeCloseTo((MAX_SCALE + 1) / 2)
  })

  it('out-of-bounds clamping: clientY=0 → MAX_SCALE; clientY=999 → 1', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 0, pointerId: 1 })
    expect(w.emitted('set-scale')![0]).toEqual([MAX_SCALE])
    await track.trigger('pointermove', { clientY: 999, pointerId: 1 })
    const [scale] = w.emitted('set-scale')![1] as [number]
    expect(scale).toBeCloseTo(1)
  })

  it('after down, move continuously converts (dragging)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 200, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(2)
    const [scale] = w.emitted('set-scale')![1] as [number]
    expect(scale).toBeCloseTo(8.5)
  })

  it('pointermove without pointerdown → no emit (dead code target 1: _dragging guard)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointermove', { clientY: 150, pointerId: 1 })
    expect(w.emitted('set-scale')).toBeUndefined()
  })

  it('pointermove after pointerup → no emit', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    await track.trigger('pointerup', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 250, pointerId: 1 })
    // Still only one from down, move after up does not emit again.
    expect(w.emitted('set-scale')).toHaveLength(1)
  })

  it('pointercancel clears flag like pointerup, after that move does not emit', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await track.trigger('pointercancel', { clientY: 100, pointerId: 1 })
    await track.trigger('pointermove', { clientY: 250, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
  })

  // Review M4: rect.height === 0 (track not laid out / hidden) makes
  // t = (clientY-top)/height compute NaN, propagates to usePlacesView view.scale/tx/ty
  // — and in applyZoom `clamped === old` never short-circuits due to NaN !== NaN,
  // once NaN is written it can never recover (reset() interpolation from NaN origin,
  // every step is still NaN). This pins component-side already blocks this irrecoverable
  // state, no longer emits outward.
  it('when rect.height === 0, do not emit set-scale (prevent NaN propagation to view.scale/tx/ty)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track')
    mockTrackRect(track.element as HTMLElement, 100, 0)
    await track.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    expect(w.emitted('set-scale')).toBeUndefined()
  })

  it('pointerdown: convert once immediately + setPointerCapture called (if exists)', async () => {
    const w = mountBar()
    const track = w.find('.zb-track').element as HTMLElement & { setPointerCapture?: (id: number) => void }
    mockTrackRect(track)
    track.setPointerCapture = vi.fn()
    await w.find('.zb-track').trigger('pointerdown', { clientY: 100, pointerId: 7 })
    expect(w.emitted('set-scale')).toHaveLength(1)
    expect(track.setPointerCapture).toHaveBeenCalledWith(7)
  })

  it('when releasePointerCapture throws, does not bubble (try/catch) and _dragging is cleared', async () => {
    const w = mountBar()
    const track = w.find('.zb-track').element as HTMLElement & { releasePointerCapture?: (id: number) => void }
    mockTrackRect(track)
    track.releasePointerCapture = vi.fn(() => {
      throw new Error('boom')
    })
    await w.find('.zb-track').trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await expect(w.find('.zb-track').trigger('pointerup', { clientY: 100, pointerId: 1 })).resolves.not.toThrow()
    // _dragging cleared: move after up should not emit again.
    await w.find('.zb-track').trigger('pointermove', { clientY: 300, pointerId: 1 })
    expect(w.emitted('set-scale')).toHaveLength(1)
  })
})

describe('dotColor → root element style --accent', () => {
  it('dotColor lands on .map-zoombar --accent', () => {
    const w = mountBar({ dotColor: 'rgb(10, 20, 30)' })
    const root = w.find('.map-zoombar').element as HTMLElement
    expect(root.style.getPropertyValue('--accent')).toBe('rgb(10, 20, 30)')
  })
})
