// Map view transformations and gestures. Ported verbatim from the Vue 2 panel
// src/views/Photos/PhotosPlacesView.vue:561-735 (svgPoint / visibleCenterVb /
// applyZoom / stopViewAnim / animateView / centerOn / zoomBy / setScale /
// onWheel / zoomToCluster / screenToVbScale / onPointerDown|Move|Up /
// autoPan(→autoPanTo) / handleReset(→reset)).
//
// `splitScaleFor` itself (split-point bisection) is T2's product (util/placesMap.ts),
// here only the consumer (zoomToCluster). `hasDetailPanel()` always returns false in P6a
// (detail panel is P6b's concern), but visibleCenterVb's panelFrac branch built per Vue2,
// not omitted just because "this period doesn't use it".
import { computed, type ComputedRef, type Ref, ref } from 'vue'
import { MAX_SCALE, splitScaleFor, type Pin, type Place } from '../util/placesMap'
import { MAP_H, MAP_W, project } from '../util/worldMap'

export interface PlacesView {
  tx: number
  ty: number
  scale: number
}

export interface UsePlacesViewOptions {
  svgEl: Ref<SVGSVGElement | null>
  /** Map wrapper layer (for computing visible center). Explicitly passed ref, not
   * inferred from svgEl.parentElement. */
  wrapEl: Ref<HTMLElement | null>
  /** P6a always returns false; P6b after detail panel connects returns real state. */
  hasDetailPanel: () => boolean
}

interface DragState {
  x: number
  y: number
  tx: number
  ty: number
  s: number
}

export function usePlacesView(opts: UsePlacesViewOptions): {
  view: Ref<PlacesView>
  zoomFrac: ComputedRef<number>
  svgPoint: (clientX: number, clientY: number) => { x: number, y: number }
  screenToVbScale: () => number
  visibleCenterVb: () => { x: number, y: number }
  applyZoom: (next: number, vbX: number, vbY: number) => void
  animateView: (target: PlacesView, duration?: number) => void
  stopViewAnim: () => void
  centerOn: (wx: number, wy: number, scale: number) => void
  zoomBy: (factor: number) => void
  setScale: (s: number) => void
  reset: () => void
  autoPanTo: (place: Place | null | undefined) => void
  zoomToCluster: (pin: Pin, currentScale: number) => void
  onWheel: (e: WheelEvent) => void
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  dispose: () => void
} {
  const view = ref<PlacesView>({ tx: 0, ty: 0, scale: 1 })

  // zoomFrac: (scale - 1) / (MAX_SCALE - 1) — not in Vue2's method section, new derived
  // quantity added to T7 interface (for T11's zoom slider to read), implemented per
  // formula.
  const zoomFrac = computed(() => (view.value.scale - 1) / (MAX_SCALE - 1))

  let raf: number | null = null
  let drag: DragState | null = null

  // Vue2 :564-576. preserveAspectRatio="xMidYMid meet" leaves black bars (letterbox)
  // inside svg element, must offset to convert screen points to viewBox points.
  function svgPoint(clientX: number, clientY: number): { x: number, y: number } {
    const svg = opts.svgEl.value
    if (!svg)
      return { x: MAP_W / 2, y: MAP_H / 2 }
    const rect = svg.getBoundingClientRect()
    const fit = Math.min(rect.width / MAP_W, rect.height / MAP_H) || 1
    const ox = (rect.width - MAP_W * fit) / 2
    const oy = (rect.height - MAP_H * fit) / 2
    return {
      x: (clientX - rect.left - ox) / fit,
      y: (clientY - rect.top - oy) / fit,
    }
  }

  // Vue2 :693-699.
  function screenToVbScale(): number {
    const svg = opts.svgEl.value
    if (!svg)
      return 1
    const rect = svg.getBoundingClientRect()
    const fit = Math.min(rect.width / MAP_W, rect.height / MAP_H)
    return fit > 0 ? 1 / fit : 1
  }

  // Vue2 :578-583. panelFrac branch built as-is: when hasDetailPanel() false or wrapEl
  // absent, always 0; when true, calculate 420px detail panel fraction of wrapper width
  // (clamped to 0.55).
  function visibleCenterVb(): { x: number, y: number } {
    const wrap = opts.wrapEl.value
    const rect = wrap ? wrap.getBoundingClientRect() : null
    const panelFrac = (rect && opts.hasDetailPanel()) ? Math.min(0.55, 420 / rect.width) : 0
    return { x: MAP_W * (1 - panelFrac) / 2, y: MAP_H / 2 }
  }

  // Vue2 :597-602. Called when immediate interaction (drag/wheel) preempts in-flight
  // animation.
  function stopViewAnim(): void {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  // Vue2 :585-594. Zoom about a point: keep world point corresponding to (vbX, vbY)
  // unchanged.
  function applyZoom(next: number, vbX: number, vbY: number): void {
    stopViewAnim()
    const old = view.value.scale
    const clamped = Math.max(1, Math.min(MAX_SCALE, next))
    if (clamped === old)
      return
    const wx = (vbX - view.value.tx) / old
    const wy = (vbY - view.value.ty) / old
    view.value = { scale: clamped, tx: vbX - wx * clamped, ty: vbY - wy * clamped }
  }

  // Vue2 :605-620. easeOutCubic, ~420ms, rAF-driven.
  function animateView(target: PlacesView, duration = 420): void {
    stopViewAnim()
    const start = { ...view.value }
    const t0 = performance.now()
    const ease = (t: number) => 1 - (1 - t) ** 3
    const step = (now: number): void => {
      const k = ease(Math.min(1, (now - t0) / duration))
      view.value = {
        scale: start.scale + (target.scale - start.scale) * k,
        tx: start.tx + (target.tx - start.tx) * k,
        ty: start.ty + (target.ty - start.ty) * k,
      }
      raf = k < 1 ? requestAnimationFrame(step) : null
    }
    raf = requestAnimationFrame(step)
  }

  // Vue2 :622-626. Place world point (project() output) at visible center, animate.
  function centerOn(wx: number, wy: number, scale: number): void {
    const c = visibleCenterVb()
    const clamped = Math.max(1, Math.min(MAX_SCALE, scale))
    animateView({ scale: clamped, tx: c.x - wx * clamped, ty: c.y - wy * clamped })
  }

  // Vue2 :627-630.
  function zoomBy(factor: number): void {
    const c = visibleCenterVb()
    applyZoom(view.value.scale * factor, c.x, c.y)
  }

  // Vue2 :631-634.
  function setScale(s: number): void {
    const c = visibleCenterVb()
    applyZoom(s, c.x, c.y)
  }

  // Vue2 :561 handleReset().
  function reset(): void {
    animateView({ tx: 0, ty: 0, scale: 1 })
  }

  // Vue2 :724-735 autoPan(). Must fetch lon/lat from passed place, never from "current
  // detail" — autoPan fires in activeId watcher before loadDetail, detail at that point
  // is still the previous place's (and detail payload has no lon/lat), would pan to wrong
  // position or NaN.
  function autoPanTo(place: Place | null | undefined): void {
    if (!place)
      return
    const { x, y } = project(place.lon, place.lat)
    centerOn(x, y, Math.max(view.value.scale, 1.8))
  }

  // Vue2 :661-664. Keep +0.01 as-is, but review I2 algebraically proved: for any valid
  // currentScale ∈ [1, MAX_SCALE], this term is always unobservable, Vue2 dead code —
  // splitScaleFor's "splittable" branch always returns >= currentScale * 1.04 (because
  // currentScale >= 1, i.e., >= currentScale + 0.04, strictly > currentScale + 0.01,
  // left branch never wins); "can't split" branch always returns MAX_SCALE, and below
  // centerOn's own Math.min(MAX_SCALE, …) clamps both cases back to MAX_SCALE. Keep this
  // line only for line-by-line Vue2 alignment, no user-observable effect.
  function zoomToCluster(pin: Pin, currentScale: number): void {
    const next = Math.max(currentScale + 0.01, splitScaleFor(pin.members ?? [], currentScale))
    centerOn(pin.x, pin.y, next)
  }

  // Vue2 :635-639. Registering ({ passive: false }) is T11 container's responsibility,
  // only doing logic here.
  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    const vb = svgPoint(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
    applyZoom(view.value.scale * factor, vb.x, vb.y)
  }

  // Vue2 :701-708. Pin click (.geo-pin) should not trigger pan.
  function onPointerDown(e: PointerEvent): void {
    const target = e.target as (EventTarget & { closest?: (selector: string) => Element | null }) | null
    if (target && typeof target.closest === 'function' && target.closest('.geo-pin'))
      return
    stopViewAnim()
    drag = { x: e.clientX, y: e.clientY, tx: view.value.tx, ty: view.value.ty, s: screenToVbScale() }
    const svg = opts.svgEl.value
    if (svg && svg.setPointerCapture)
      svg.setPointerCapture(e.pointerId)
  }

  // Vue2 :709-714.
  function onPointerMove(e: PointerEvent): void {
    if (!drag)
      return
    const { x, y, tx, ty, s } = drag
    view.value = { scale: view.value.scale, tx: tx + (e.clientX - x) * s, ty: ty + (e.clientY - y) * s }
  }

  // Vue2 :715-723. releasePointerCapture wrapped in try/catch — lost pointerup would
  // leak capture.
  function onPointerUp(e: PointerEvent): void {
    drag = null
    const svg = opts.svgEl.value
    if (svg && svg.releasePointerCapture) {
      try {
        svg.releasePointerCapture(e.pointerId)
      }
      catch {
        /* noop */
      }
    }
  }

  // Vue2 beforeDestroy :359-361. Only cancel in-flight rAF, don't strip pointer
  // capture (that's onPointerUp's job).
  function dispose(): void {
    stopViewAnim()
  }

  return {
    view,
    zoomFrac,
    svgPoint,
    screenToVbScale,
    visibleCenterVb,
    applyZoom,
    animateView,
    stopViewAnim,
    centerOn,
    zoomBy,
    setScale,
    reset,
    autoPanTo,
    zoomToCluster,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    dispose,
  }
}
