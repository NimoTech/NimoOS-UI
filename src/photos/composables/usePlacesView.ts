// 地图视图变换与手势。Ported verbatim from Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:561-735(svgPoint / visibleCenterVb /
// applyZoom / stopViewAnim / animateView / centerOn / zoomBy / setScale /
// onWheel / zoomToCluster / screenToVbScale / onPointerDown|Move|Up /
// autoPan(→autoPanTo) / handleReset(→reset)).
//
// `splitScaleFor` 本身(裂点二分)是 T2 的产物(util/placesMap.ts),这里只是
// 消费方(zoomToCluster)。`hasDetailPanel()` P6a 恒返 false(详情面板是
// P6b 的事),但 visibleCenterVb 的 panelFrac 分支照 Vue2 建齐,不因"本期用
// 不到"而省略。
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
  /** 地图包裹层(算可见中心用)。显式传入 ref,不靠 svgEl.parentElement 推导。 */
  wrapEl: Ref<HTMLElement | null>
  /** P6a 恒返 false;P6b 接上详情面板后返回真实状态。 */
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

  // zoomFrac: (scale - 1) / (MAX_SCALE - 1) — 未在 Vue2 的这段方法里,是 T7
  // 接口新加的派生量(供 T11 的缩放条读取),照公式实现。
  const zoomFrac = computed(() => (view.value.scale - 1) / (MAX_SCALE - 1))

  let raf: number | null = null
  let drag: DragState | null = null

  // Vue2 :564-576. preserveAspectRatio="xMidYMid meet" 会在 svg 元素内留黑边
  // (letterbox),必须补偏移才能把屏幕点换算成 viewBox 点。
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

  // Vue2 :578-583. panelFrac 分支照建:hasDetailPanel() 为 false 或 wrapEl
  // 缺失时恒 0,为 true 时按包裹层宽度算 420px 详情面板占比(钳到 0.55)。
  function visibleCenterVb(): { x: number, y: number } {
    const wrap = opts.wrapEl.value
    const rect = wrap ? wrap.getBoundingClientRect() : null
    const panelFrac = (rect && opts.hasDetailPanel()) ? Math.min(0.55, 420 / rect.width) : 0
    return { x: MAP_W * (1 - panelFrac) / 2, y: MAP_H / 2 }
  }

  // Vue2 :597-602. 即时交互(拖拽/滚轮)抢占在途缓动时调用。
  function stopViewAnim(): void {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  // Vue2 :585-594. 定点缩放:保持 (vbX, vbY) 对应的世界点不变。
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

  // Vue2 :605-620. easeOutCubic,~420ms,rAF 驱动。
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

  // Vue2 :622-626. 把世界点(project() 输出)放到可见中心,走缓动。
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

  // Vue2 :724-735 autoPan(). 必须从传入的 place 取 lon/lat,绝不读"当前详情"
  // ——autoPan 在 activeId watcher 里、loadDetail 之前触发,此时详情还是上一个
  // 地点的(且详情 payload 没有 lon/lat),会平移到错位置或 NaN。
  function autoPanTo(place: Place | null | undefined): void {
    if (!place)
      return
    const { x, y } = project(place.lon, place.lat)
    centerOn(x, y, Math.max(view.value.scale, 1.8))
  }

  // Vue2 :661-664。照搬保留 +0.01,但评审 I2 已代数证明:对任意合法
  // currentScale ∈ [1, MAX_SCALE],这一项恒不可观测,是 Vue2 的死代码——
  // splitScaleFor 的「可裂」分支恒返回 >= currentScale * 1.04(因 currentScale >= 1,
  // 即 >= currentScale + 0.04,严格大于 currentScale + 0.01,左支永不胜出);
  // 「裂不开」分支恒返回 MAX_SCALE,而下面 centerOn 自己的
  // Math.min(MAX_SCALE, …) 会把两种情形都夹回 MAX_SCALE。保留这一行仅为逐行
  // 对齐 Vue2,不代表它有任何用户可观测作用。
  function zoomToCluster(pin: Pin, currentScale: number): void {
    const next = Math.max(currentScale + 0.01, splitScaleFor(pin.members ?? [], currentScale))
    centerOn(pin.x, pin.y, next)
  }

  // Vue2 :635-639. 注册({ passive: false })是 T11 容器的职责,这里只做逻辑。
  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    const vb = svgPoint(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18
    applyZoom(view.value.scale * factor, vb.x, vb.y)
  }

  // Vue2 :701-708. 图钉点击(.geo-pin)不触发平移。
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

  // Vue2 :715-723. releasePointerCapture 包 try/catch——丢失的 pointerup 会让
  // capture 泄漏。
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

  // Vue2 beforeDestroy :359-361. 只取消在途 rAF,不摘 pointer capture(那是
  // onPointerUp 的事)。
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
