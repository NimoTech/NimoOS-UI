// usePlacesView view transformation and gesture tests. Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:561-735(complete section).
//
// In jsdom, getBoundingClientRect always returns all zeros. Must explicitly mock
// a controllable rectangle for each test (see mockSvg helper, from brief).
// requestAnimationFrame is not a timer and cannot be driven by vi.useFakeTimers() —
// use fake rAF instead (collect callbacks, flush manually, control now).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { usePlacesView, type PlacesView } from '../usePlacesView'
import { MAX_SCALE, type Pin, type Place } from '../../util/placesMap'
import { MAP_W, MAP_H, project } from '../../util/worldMap'
import * as placesMapModule from '../../util/placesMap'

// ---- mockSvg: from brief, 1200×400 vs 1000×500 → fit=min(1.2,0.8)=0.8,
// ox=(1200-800)/2=200, oy=(400-400)/2=0. ----
function mockSvg(width: number, height: number, left = 0, top = 0): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.getBoundingClientRect = () =>
    ({ width, height, left, top, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  return el
}

function mockWrap(width: number): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ width, height: 500, left: 0, top: 0, right: width, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return el
}

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'JP', city: 'Tokyo',
    lon: 0, lat: 0, count: 10, recent: false, last: 'Jan 1, 2026',
    lastDate: null, trips: 1, home: false, thumbs: [], coverAssetId: '',
    ...overrides,
  }
}

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'cluster:1', x: 500, y: 250, r: 10, hitR: 10, count: 2,
    city: 'Tokyo', country: 'JP', thumbs: [], coverAssetId: '',
    recent: false, cluster: true, active: false,
    ...overrides,
  }
}

// ---- Fake rAF: collect callbacks, flush manually, support cancel. Do not use vi.useFakeTimers(). ----
let pending: Map<number, FrameRequestCallback>
let cancelled: Set<number>
let idCounter: number
let rafSpy: ReturnType<typeof vi.fn>
let cancelSpy: ReturnType<typeof vi.fn>
let realRaf: typeof requestAnimationFrame
let realCancel: typeof cancelAnimationFrame

function flushRaf(now: number): void {
  const entries = Array.from(pending.entries())
  pending.clear()
  for (const [id, cb] of entries) {
    if (!cancelled.has(id)) cb(now)
  }
}

beforeEach(() => {
  pending = new Map()
  cancelled = new Set()
  idCounter = 0
  realRaf = globalThis.requestAnimationFrame
  realCancel = globalThis.cancelAnimationFrame
  rafSpy = vi.fn((cb: FrameRequestCallback) => {
    const id = ++idCounter
    pending.set(id, cb)
    return id
  })
  cancelSpy = vi.fn((id: number) => {
    cancelled.add(id)
    pending.delete(id)
  })
  globalThis.requestAnimationFrame = rafSpy as unknown as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = cancelSpy as unknown as typeof cancelAnimationFrame
})

afterEach(() => {
  globalThis.requestAnimationFrame = realRaf
  globalThis.cancelAnimationFrame = realCancel
  vi.restoreAllMocks()
})

function makeOpts(svg: SVGSVGElement | null = mockSvg(1200, 400), wrap: HTMLElement | null = null, hasDetailPanel = () => false) {
  return {
    svgEl: ref(svg),
    wrapEl: ref(wrap),
    hasDetailPanel,
  }
}

describe('usePlacesView', () => {
  describe('svgPoint — letterbox conversion', () => {
    it('1200×400 svg (fit=0.8, ox=200, oy=0): point (200,0) → viewBox(0,0)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400)))
      const p = pv.svgPoint(200, 0)
      expect(p.x).toBeCloseTo(0)
      expect(p.y).toBeCloseTo(0)
    })

    it('1200×400 svg: point (1000,400) → viewBox(1000,500)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400)))
      const p = pv.svgPoint(1000, 400)
      expect(p.x).toBeCloseTo(1000)
      expect(p.y).toBeCloseTo(500)
    })

    it('svgEl is null → map center (500, 250)', () => {
      const pv = usePlacesView(makeOpts(null))
      const p = pv.svgPoint(999, 999)
      expect(p).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })
  })

  describe('applyZoom — fixed-point zoom', () => {
    it('Fixed-point zoom invariant: anchor point world coordinates unchanged before/after scale (4 random scale/anchor pairs)', () => {
      const cases: Array<[number, number, number, PlacesView]> = [
        [3, 400, 250, { tx: 0, ty: 0, scale: 1 }],
        [5, 120, 80, { tx: 30, ty: -40, scale: 2 }],
        [1.5, 700, 300, { tx: -100, ty: 50, scale: 4 }],
        [10, 0, 0, { tx: 200, ty: 200, scale: 1.5 }],
      ]
      for (const [next, vbX, vbY, start] of cases) {
        const pv = usePlacesView(makeOpts())
        pv.view.value = { ...start }
        const wxBefore = (vbX - start.tx) / start.scale
        const wyBefore = (vbY - start.ty) / start.scale
        pv.applyZoom(next, vbX, vbY)
        const wxAfter = (vbX - pv.view.value.tx) / pv.view.value.scale
        const wyAfter = (vbY - pv.view.value.ty) / pv.view.value.scale
        expect(wxAfter).toBeCloseTo(wxBefore)
        expect(wyAfter).toBeCloseTo(wyBefore)
      }
    })

    it('Clamping: 0.1 → scale becomes 1; 999 → becomes MAX_SCALE', () => {
      const pv = usePlacesView(makeOpts())
      pv.applyZoom(0.1, 500, 250)
      expect(pv.view.value.scale).toBe(1)
      pv.applyZoom(999, 500, 250)
      expect(pv.view.value.scale).toBe(MAX_SCALE)
    })

    it('Already at MAX_SCALE with larger value: view object reference unchanged (early return takes effect)', () => {
      const pv = usePlacesView(makeOpts())
      pv.applyZoom(999, 500, 250)
      expect(pv.view.value.scale).toBe(MAX_SCALE)
      const ref1 = pv.view.value
      pv.applyZoom(9999, 500, 250)
      expect(pv.view.value).toBe(ref1)
    })
  })

  describe('zoomFrac', () => {
    it('scale=1 → 0; scale=MAX_SCALE → 1; scale=8.5 → 0.5', () => {
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      expect(pv.zoomFrac.value).toBeCloseTo(0)
      pv.view.value = { tx: 0, ty: 0, scale: MAX_SCALE }
      expect(pv.zoomFrac.value).toBeCloseTo(1)
      pv.view.value = { tx: 0, ty: 0, scale: 8.5 }
      expect(pv.zoomFrac.value).toBeCloseTo(0.5)
    })
  })

  describe('visibleCenterVb', () => {
    it('hasDetailPanel() returns false → x === MAP_W/2', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      expect(pv.visibleCenterVb()).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })

    it('hasDetailPanel() returns true, wrap width 1000 → panelFrac=0.42, x=290', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      const c = pv.visibleCenterVb()
      expect(c.x).toBeCloseTo(290)
      expect(c.y).toBeCloseTo(MAP_H / 2)
    })

    it('hasDetailPanel() returns true, wrap width 500 → panelFrac clamped to 0.55, x=225', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(500), () => true))
      const c = pv.visibleCenterVb()
      expect(c.x).toBeCloseTo(225)
    })

    it('wrapEl is null → panelFrac always 0 (even if hasDetailPanel returns true)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), null, () => true))
      expect(pv.visibleCenterVb()).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })
  })

  describe('animateView — easeOutCubic easing', () => {
    it('start/midpoint (exact easeOutCubic value)/endpoint', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(1000)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      pv.animateView({ tx: 100, ty: 200, scale: 5 }, 420)
      expect(pending.size).toBe(1) // one frame queued, not yet executed

      // t=0 → k = ease(0) = 0 → stay at start
      flushRaf(1000)
      expect(pv.view.value).toEqual({ tx: 0, ty: 0, scale: 1 })

      // t=210 (halfway) → ease(0.5) = 1-(1-0.5)^3 = 1-0.125 = 0.875 (exact value,
      // prevent ease from being replaced with linear — linear would give 0.5, differs from 0.875)
      nowSpy.mockReturnValue(1210)
      flushRaf(1210)
      expect(pv.view.value.scale).toBeCloseTo(1 + (5 - 1) * 0.875)
      expect(pv.view.value.tx).toBeCloseTo(0 + 100 * 0.875)
      expect(pv.view.value.ty).toBeCloseTo(0 + 200 * 0.875)

      // t=420 (reached) → k clamped to 1 → exactly equals target, no more new frames (_raf set to null)
      nowSpy.mockReturnValue(1420)
      flushRaf(1420)
      expect(pv.view.value).toEqual({ tx: 100, ty: 200, scale: 5 })
      expect(pending.size).toBe(0)

      // pushing another frame should produce no changes (proves no extra frame was queued)
      nowSpy.mockReturnValue(9999)
      flushRaf(9999)
      expect(pv.view.value).toEqual({ tx: 100, ty: 200, scale: 5 })
    })

    it('After exceeding duration, k clamped to 1, no extrapolation beyond target', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.animateView({ tx: 100, ty: 0, scale: 5 }, 420)
      nowSpy.mockReturnValue(100000) // far exceeds duration
      flushRaf(100000)
      expect(pv.view.value).toEqual({ tx: 100, ty: 0, scale: 5 })
    })

    it('Call applyZoom during animateView → in-flight easing cancelled (cancel called, subsequent frames no longer change view)', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.animateView({ tx: 100, ty: 200, scale: 5 }, 420)
      expect(pending.size).toBe(1)

      pv.applyZoom(3, 400, 250)
      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(pending.size).toBe(0)

      const afterApplyZoom = { ...pv.view.value }
      nowSpy.mockReturnValue(50000)
      flushRaf(50000) // no pending callbacks, should be no-op
      expect(pv.view.value).toEqual(afterApplyZoom)
    })

    it('Call animateView twice consecutively (without applyZoom): first in-flight rAF must be cancelled by second stopViewAnim()', () => {
      // This test specifically targets the stopViewAnim() at the start of animateView
      // (constraint 3 / delete checklist ④) — the "call applyZoom during" test above
      // tests applyZoom's own stopViewAnim, these are different code lines and must be
      // tested separately, otherwise deleting the stopViewAnim() at the start of
      // animateView would not cause any test to fail.
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(1000)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      pv.animateView({ tx: 100, ty: 100, scale: 5 }, 420) // rAF id 1
      expect(pending.size).toBe(1)
      expect(cancelSpy).not.toHaveBeenCalled()

      pv.animateView({ tx: -50, ty: -50, scale: 2 }, 420) // must cancel id 1, queue id 2
      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(pending.size).toBe(1) // only the second queued frame remains, not both

      nowSpy.mockReturnValue(1420)
      flushRaf(1420)
      // must exactly equal second target, must not be polluted by first trajectory
      expect(pv.view.value).toEqual({ tx: -50, ty: -50, scale: 2 })
    })
  })

  describe('centerOn / zoomBy / setScale / reset', () => {
    it('centerOn places world point at visible center, scale clamped to [1, MAX_SCALE]', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.centerOn(100, 50, 3)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      // visibleCenterVb (hasDetailPanel=false) = {x: 500, y: 250}
      // tx = 500 - 100*3 = 200; ty = 250 - 50*3 = 100
      expect(pv.view.value).toEqual({ tx: 200, ty: 100, scale: 3 })
    })

    it('reset() returns to {tx:0, ty:0, scale:1} (Vue2 handleReset)', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 300, ty: -100, scale: 8 }
      pv.reset()
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value).toEqual({ tx: 0, ty: 0, scale: 1 })
    })

    // ── P6b-T8 (P6a seam two): after hasDetailPanel switches to real state, panelFrac takes effect for the first time —
    // these four tests pin down that centerOn/zoomBy/setScale/autoPanTo four consumption paths
    // really use it (existing visibleCenterVb arithmetic tests already cover panelFrac
    // calculation; this just adds "consumer actually uses the new result" layer).
    // wrapEl width 1000 → panelFrac = min(0.55, 420/1000) = 0.42 →
    // c = { x: 1000*(1-0.42)/2 = 290, y: 250 } (consistent with existing visibleCenterVb test hand-calc).
    it('centerOn(wx,wy,2) with hasDetailPanel()=true: after animation frame, tx === 290 - wx*2', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.centerOn(100, 50, 2)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      // c = {x:290, y:250}; tx = 290 - 100*2 = 90; ty = 250 - 50*2 = 150.
      // toBeCloseTo (not toEqual/toBe): panelFrac = min(0.55, 420/1000) floating-point
      // division brings small trailing error, same precision standard as existing usePlacesView.test.ts visibleCenterVb test.
      expect(pv.view.value.tx).toBeCloseTo(90)
      expect(pv.view.value.ty).toBeCloseTo(150)
      expect(pv.view.value.scale).toBe(2)
      expect(pv.view.value.tx).toBeCloseTo(290 - 100 * 2)
    })

    it('zoomBy(2) from scale 1: anchor is (290,250), tx differs from "panel closed anchor 500" result and equals hand-calc value', () => {
      const pvOpen = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      pvOpen.view.value = { tx: 0, ty: 0, scale: 1 }
      pvOpen.zoomBy(2)
      // applyZoom(2, 290, 250) from {tx:0,ty:0,scale:1}:wx=290,wy=250 → tx=290-290*2=-290。
      expect(pvOpen.view.value.tx).toBeCloseTo(-290)
      expect(pvOpen.view.value.ty).toBeCloseTo(-250)
      expect(pvOpen.view.value.scale).toBe(2)

      const pvClosed = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pvClosed.view.value = { tx: 0, ty: 0, scale: 1 }
      pvClosed.zoomBy(2)
      // applyZoom(2, 500, 250):tx=500-500*2=-500。
      expect(pvClosed.view.value).toEqual({ tx: -500, ty: -250, scale: 2 })
      expect(pvOpen.view.value.tx).not.toBeCloseTo(pvClosed.view.value.tx, 5)
    })

    it('setScale(4): anchor is (290,250), tx differs from "panel closed anchor 500" result and equals hand-calc value', () => {
      const pvOpen = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      pvOpen.view.value = { tx: 0, ty: 0, scale: 1 }
      pvOpen.setScale(4)
      // applyZoom(4, 290, 250) from {tx:0,ty:0,scale:1}:wx=290,wy=250 → tx=290-290*4=-870。
      expect(pvOpen.view.value.tx).toBeCloseTo(-870)
      expect(pvOpen.view.value.ty).toBeCloseTo(-750)
      expect(pvOpen.view.value.scale).toBe(4)

      const pvClosed = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pvClosed.view.value = { tx: 0, ty: 0, scale: 1 }
      pvClosed.setScale(4)
      // applyZoom(4, 500, 250):tx=500-500*4=-1500。
      expect(pvClosed.view.value).toEqual({ tx: -1500, ty: -750, scale: 4 })
      expect(pvOpen.view.value.tx).not.toBeCloseTo(pvClosed.view.value.tx, 5)
    })
  })

  describe('autoPanTo', () => {
    it('Pass place with lon/lat → that point ends up at visible center (after animation frame)', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      const place = makePlace({ lon: -90, lat: 45 })
      // project(-90, 45) = { x: ((-90+180)/360)*1000=250, y: ((90-45)/180)*500=125 }
      const proj = project(-90, 45)
      expect(proj.x).toBeCloseTo(250)
      expect(proj.y).toBeCloseTo(125)

      pv.autoPanTo(place)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      // visibleCenterVb = {x:500, y:250}; scale = max(1, 1.8) = 1.8
      // tx = 500 - 250*1.8 = 50; ty = 250 - 125*1.8 = 25
      expect(pv.view.value.scale).toBeCloseTo(1.8)
      expect(pv.view.value.tx).toBeCloseTo(50)
      expect(pv.view.value.ty).toBeCloseTo(25)
    })

    // P6b-T8: with hasDetailPanel()=true, that point ends up at visible center x=290 (not 500) —
    // verify using the invariant "that world point mapped back to screen coords exactly equals visible center",
    // not repeating assertions on tx itself.
    it('With hasDetailPanel()=true: that point ends up at x=290 (not 500)', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      const place = makePlace({ lon: -90, lat: 45 })
      const proj = project(-90, 45) // { x: 250, y: 125 }

      pv.autoPanTo(place)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      // c = {x:290, y:250}; scale = max(1, 1.8) = 1.8; tx = 290 - 250*1.8 = -160;
      // ty = 250 - 125*1.8 = 25 (y unaffected by panelFrac, same as existing visibleCenterVb test).
      expect(pv.view.value.scale).toBeCloseTo(1.8)
      expect(pv.view.value.tx).toBeCloseTo(-160)
      expect(pv.view.value.ty).toBeCloseTo(25)
      // That world point mapped back to screen coords: tx + wx*scale, must land exactly
      // at visible center x=290, not 500 when hasDetailPanel is always false — this is the real
      // meaning of "that point ends up at visible center".
      const screenX = pv.view.value.tx + proj.x * pv.view.value.scale
      expect(screenX).toBeCloseTo(290)
      expect(screenX).not.toBeCloseTo(500)
    })

    it('Pass null/undefined → view completely unchanged, no rAF queued', () => {
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 7, ty: 8, scale: 2 }
      const before = pv.view.value
      pv.autoPanTo(null)
      expect(pv.view.value).toBe(before)
      pv.autoPanTo(undefined)
      expect(pv.view.value).toBe(before)
      expect(rafSpy).not.toHaveBeenCalled()
    })

    it('scale at least 1.8: if current 1, upgrade to 1.8; if current 3, keep 3', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const place = makePlace({ lon: 0, lat: 0 })

      const pv1 = usePlacesView(makeOpts())
      pv1.view.value = { tx: 0, ty: 0, scale: 1 }
      pv1.autoPanTo(place)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv1.view.value.scale).toBeCloseTo(1.8)

      pending.clear()
      cancelled.clear()
      idCounter = 0
      nowSpy.mockReturnValue(1000)
      const pv2 = usePlacesView(makeOpts())
      pv2.view.value = { tx: 0, ty: 0, scale: 3 }
      pv2.autoPanTo(place)
      nowSpy.mockReturnValue(1420)
      flushRaf(1420)
      expect(pv2.view.value.scale).toBeCloseTo(3)
    })
  })

  describe('zoomToCluster', () => {
    it('Colocated members (splitScaleFor returns MAX_SCALE) → target scale is MAX_SCALE', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: 2 }
      const members = [makePlace({ id: '1', lon: 10, lat: 10 }), makePlace({ id: '2', lon: 10, lat: 10 })]
      const pin = makePin({ members, x: 500, y: 250 })
      pv.zoomToCluster(pin, 2)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value.scale).toBeCloseTo(MAX_SCALE)
    })

    it('Splittable cluster → target scale > current', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      const members = [makePlace({ id: '1', lon: 0, lat: 0 }), makePlace({ id: '2', lon: 60, lat: 60 })]
      const pin = makePin({ members, x: 500, y: 250 })
      pv.zoomToCluster(pin, 1)
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value.scale).toBeGreaterThan(1)
    })

    it('Mock split threshold = currentScale when +0.01 takes effect and is not clamped', () => {
      // Review I2: algebraically proven that +0.01 is never observable for any valid
      // currentScale ∈ [1, MAX_SCALE] — the "splittable" branch of splitScaleFor always
      // returns >= currentScale * 1.04 (strictly greater than currentScale + 0.01),
      // the "unsplittable" branch always returns MAX_SCALE and is clamped back to MAX_SCALE
      // by centerOn's own clamp. This test uses vi.spyOn to pin splitScaleFor to currentScale
      // itself — a value it would never return in the real path (minimum is currentScale + 0.04),
      // just to create a target where the "delete +0.01" deletion action produces observable
      // differences, not representing any real scenario/observable behavior a user can reach.
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const splitSpy = vi.spyOn(placesMapModule, 'splitScaleFor').mockReturnValue(10)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: 10 }
      const pin = makePin({ members: [makePlace(), makePlace({ id: '2' })], x: 500, y: 250 })
      expect(() => pv.zoomToCluster(pin, 10)).not.toThrow()
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value.scale).toBeCloseTo(10.01)
      splitSpy.mockRestore()
    })

    it('Already at MAX_SCALE, colocated cluster (natural scenario): no throw, finally clamped back to MAX_SCALE', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      pv.view.value = { tx: 0, ty: 0, scale: MAX_SCALE }
      const members = [makePlace({ id: '1', lon: 10, lat: 10 }), makePlace({ id: '2', lon: 10, lat: 10 })]
      const pin = makePin({ members, x: 500, y: 250 })
      expect(() => pv.zoomToCluster(pin, MAX_SCALE)).not.toThrow()
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value.scale).toBeCloseTo(MAX_SCALE)
    })
  })

  describe('onWheel', () => {
    it('deltaY<0 zoom in (factor=1.18), deltaY>0 zoom out (factor=1/1.18), preventDefault called, anchor is pointer position', () => {
      const svg = mockSvg(1200, 400)
      const pv = usePlacesView(makeOpts(svg))
      pv.view.value = { tx: 0, ty: 0, scale: 2 }

      const vbBefore = pv.svgPoint(600, 200)
      const wxBefore = (vbBefore.x - pv.view.value.tx) / pv.view.value.scale
      const wyBefore = (vbBefore.y - pv.view.value.ty) / pv.view.value.scale

      const prevented = vi.fn()
      const wheelIn = { clientX: 600, clientY: 200, deltaY: -100, preventDefault: prevented } as unknown as WheelEvent
      pv.onWheel(wheelIn)
      expect(prevented).toHaveBeenCalledTimes(1)
      expect(pv.view.value.scale).toBeCloseTo(2 * 1.18)
      // Fixed-point invariant: anchor point's world coords unchanged
      const wxAfter = (vbBefore.x - pv.view.value.tx) / pv.view.value.scale
      const wyAfter = (vbBefore.y - pv.view.value.ty) / pv.view.value.scale
      expect(wxAfter).toBeCloseTo(wxBefore)
      expect(wyAfter).toBeCloseTo(wyBefore)

      const scaleAfterZoomIn = pv.view.value.scale
      const wheelOut = { clientX: 600, clientY: 200, deltaY: 100, preventDefault: vi.fn() } as unknown as WheelEvent
      pv.onWheel(wheelOut)
      expect(pv.view.value.scale).toBeCloseTo(scaleAfterZoomIn / 1.18)
    })
  })

  describe('Drag (pointer capture)', () => {
    it('down → move(100px) → tx delta = 100 × screenToVbScale(=1.25)', () => {
      const svg = mockSvg(1200, 400) // fit=0.8 → screenToVbScale=1/0.8=1.25
      const pv = usePlacesView(makeOpts(svg))
      pv.view.value = { tx: 10, ty: 20, scale: 2 }
      expect(pv.screenToVbScale()).toBeCloseTo(1.25)

      const down = { clientX: 300, clientY: 150, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerDown(down)
      expect(svg.setPointerCapture).toHaveBeenCalledWith(1)

      const move = { clientX: 400, clientY: 150, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerMove(move)
      expect(pv.view.value.tx).toBeCloseTo(10 + 100 * 1.25)
      expect(pv.view.value.ty).toBeCloseTo(20) // did not move along y
      expect(pv.view.value.scale).toBe(2) // drag does not change scale
    })

    it('onPointerMove without down is no-op', () => {
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 1, ty: 2, scale: 3 }
      const before = pv.view.value
      const move = { clientX: 999, clientY: 999, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerMove(move)
      expect(pv.view.value).toBe(before)
    })

    it('When e.target is inside .geo-pin: onPointerDown returns immediately (no setPointerCapture, subsequent move does not change view)', () => {
      const svg = mockSvg(1200, 400)
      const pv = usePlacesView(makeOpts(svg))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', 'geo-pin')
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      g.appendChild(circle)
      document.body.appendChild(g)

      const down = { clientX: 300, clientY: 150, pointerId: 1, target: circle } as unknown as PointerEvent
      pv.onPointerDown(down)
      expect(svg.setPointerCapture).not.toHaveBeenCalled()

      const before = pv.view.value
      const move = { clientX: 400, clientY: 150, pointerId: 1, target: circle } as unknown as PointerEvent
      pv.onPointerMove(move)
      expect(pv.view.value).toBe(before)

      g.remove()
    })

    it('onPointerUp: releasePointerCapture throws but does not bubble (try/catch), _drag cleared', () => {
      const svg = mockSvg(1200, 400)
      svg.releasePointerCapture = vi.fn(() => {
        throw new Error('boom')
      })
      const pv = usePlacesView(makeOpts(svg))
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      const down = { clientX: 300, clientY: 150, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerDown(down)

      const up = { clientX: 300, clientY: 150, pointerId: 1, target: document.body } as unknown as PointerEvent
      expect(() => pv.onPointerUp(up)).not.toThrow()

      const before = pv.view.value
      const move = { clientX: 500, clientY: 500, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerMove(move)
      expect(pv.view.value).toBe(before) // _drag cleared, move is no-op
    })
  })

  describe('dispose', () => {
    it('Cancel in-flight rAF', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.animateView({ tx: 100, ty: 0, scale: 5 }, 420)
      expect(pending.size).toBe(1)
      pv.dispose()
      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(pending.size).toBe(0)
    })
  })
})
