// usePlacesView 的视图变换与手势测试。Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:561-735(整段)。
//
// jsdom 里 getBoundingClientRect 恒返回全 0,必须为每个测试显式 mock 出可控矩形
// (见 mockSvg helper,来自 brief)。requestAnimationFrame 不是 timer,不能用
// vi.useFakeTimers() 驱动 —— 改用假 raf(收集回调,手动 flush 并控制 now)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { usePlacesView, type PlacesView } from '../usePlacesView'
import { MAX_SCALE, type Pin, type Place } from '../../util/placesMap'
import { MAP_W, MAP_H, project } from '../../util/worldMap'
import * as placesMapModule from '../../util/placesMap'

// ---- mockSvg：来自 brief，1200×400 对 1000×500 → fit=min(1.2,0.8)=0.8,
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

// ---- 假 rAF：收集回调、手动 flush、支持 cancel。不用 vi.useFakeTimers()。----
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
  describe('svgPoint —— letterbox 换算', () => {
    it('1200×400 的 svg(fit=0.8, ox=200, oy=0):点(200,0)→viewBox(0,0)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400)))
      const p = pv.svgPoint(200, 0)
      expect(p.x).toBeCloseTo(0)
      expect(p.y).toBeCloseTo(0)
    })

    it('1200×400 的 svg:点(1000,400)→viewBox(1000,500)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400)))
      const p = pv.svgPoint(1000, 400)
      expect(p.x).toBeCloseTo(1000)
      expect(p.y).toBeCloseTo(500)
    })

    it('svgEl 为 null → 地图正中 (500, 250)', () => {
      const pv = usePlacesView(makeOpts(null))
      const p = pv.svgPoint(999, 999)
      expect(p).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })
  })

  describe('applyZoom —— 定点缩放', () => {
    it('定点缩放不变量:锚点对应的世界坐标缩放前后不变(4 组随机 scale/anchor)', () => {
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

    it('钳制:传 0.1 → scale 变 1;传 999 → 变 MAX_SCALE', () => {
      const pv = usePlacesView(makeOpts())
      pv.applyZoom(0.1, 500, 250)
      expect(pv.view.value.scale).toBe(1)
      pv.applyZoom(999, 500, 250)
      expect(pv.view.value.scale).toBe(MAX_SCALE)
    })

    it('已在 MAX_SCALE 再传更大值:view 对象引用不变(early return 生效)', () => {
      const pv = usePlacesView(makeOpts())
      pv.applyZoom(999, 500, 250)
      expect(pv.view.value.scale).toBe(MAX_SCALE)
      const ref1 = pv.view.value
      pv.applyZoom(9999, 500, 250)
      expect(pv.view.value).toBe(ref1)
    })
  })

  describe('zoomFrac', () => {
    it('scale=1 → 0;scale=MAX_SCALE → 1;scale=8.5 → 0.5', () => {
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
    it('hasDetailPanel() 返 false → x === MAP_W/2', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => false))
      expect(pv.visibleCenterVb()).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })

    it('hasDetailPanel() 返 true、wrap 宽 1000 → panelFrac=0.42, x=290', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(1000), () => true))
      const c = pv.visibleCenterVb()
      expect(c.x).toBeCloseTo(290)
      expect(c.y).toBeCloseTo(MAP_H / 2)
    })

    it('hasDetailPanel() 返 true、wrap 宽 500 → panelFrac 钳到 0.55, x=225', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), mockWrap(500), () => true))
      const c = pv.visibleCenterVb()
      expect(c.x).toBeCloseTo(225)
    })

    it('wrapEl 为 null → panelFrac 恒 0(即便 hasDetailPanel 返 true)', () => {
      const pv = usePlacesView(makeOpts(mockSvg(1200, 400), null, () => true))
      expect(pv.visibleCenterVb()).toEqual({ x: MAP_W / 2, y: MAP_H / 2 })
    })
  })

  describe('animateView —— easeOutCubic 缓动', () => {
    it('起点/中途(精确 easeOutCubic 值)/终点', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(1000)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      pv.animateView({ tx: 100, ty: 200, scale: 5 }, 420)
      expect(pending.size).toBe(1) // 已排一帧,尚未执行

      // t=0 → k = ease(0) = 0 → 停在起点
      flushRaf(1000)
      expect(pv.view.value).toEqual({ tx: 0, ty: 0, scale: 1 })

      // t=210(半程) → ease(0.5) = 1-(1-0.5)^3 = 1-0.125 = 0.875(精确值,
      // 防止 ease 被换成线性——线性会给 0.5,和 0.875 可辨)
      nowSpy.mockReturnValue(1210)
      flushRaf(1210)
      expect(pv.view.value.scale).toBeCloseTo(1 + (5 - 1) * 0.875)
      expect(pv.view.value.tx).toBeCloseTo(0 + 100 * 0.875)
      expect(pv.view.value.ty).toBeCloseTo(0 + 200 * 0.875)

      // t=420(到点) → k 钳到 1 → 精确等于 target,且不再排新帧(_raf 置 null)
      nowSpy.mockReturnValue(1420)
      flushRaf(1420)
      expect(pv.view.value).toEqual({ tx: 100, ty: 200, scale: 5 })
      expect(pending.size).toBe(0)

      // 再推一帧也不应该有任何变化(证明没有多排一帧)
      nowSpy.mockReturnValue(9999)
      flushRaf(9999)
      expect(pv.view.value).toEqual({ tx: 100, ty: 200, scale: 5 })
    })

    it('超过 duration 后 k 钳到 1,不会外插超过 target', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }
      pv.animateView({ tx: 100, ty: 0, scale: 5 }, 420)
      nowSpy.mockReturnValue(100000) // 远超 duration
      flushRaf(100000)
      expect(pv.view.value).toEqual({ tx: 100, ty: 0, scale: 5 })
    })

    it('animateView 期间调 applyZoom → 在途缓动被取消(cancel 被调用,后续推帧不再改 view)', () => {
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
      flushRaf(50000) // 无待执行回调,应为 no-op
      expect(pv.view.value).toEqual(afterApplyZoom)
    })

    it('连续调用两次 animateView(不经 applyZoom):第一次的在途 rAF 必须被第二次的 stopViewAnim() 取消', () => {
      // 这条测试专门盯 animateView 自己开头那句 stopViewAnim()(constraint 3 /
      // 删码清单④)—— 上面 "期间调 applyZoom" 那条测的是 applyZoom 自己的
      // stopViewAnim,两处是不同的代码行,必须分开测,否则删掉 animateView
      // 开头的 stopViewAnim() 不会让任何测试变红。
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(1000)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 0, ty: 0, scale: 1 }

      pv.animateView({ tx: 100, ty: 100, scale: 5 }, 420) // raf id 1
      expect(pending.size).toBe(1)
      expect(cancelSpy).not.toHaveBeenCalled()

      pv.animateView({ tx: -50, ty: -50, scale: 2 }, 420) // 必须取消 id 1,排 id 2
      expect(cancelSpy).toHaveBeenCalledTimes(1)
      expect(pending.size).toBe(1) // 只剩第二次排的那一帧,不是两帧并存

      nowSpy.mockReturnValue(1420)
      flushRaf(1420)
      // 必须精确等于第二次的 target,不能被第一次的轨迹污染
      expect(pv.view.value).toEqual({ tx: -50, ty: -50, scale: 2 })
    })
  })

  describe('centerOn / zoomBy / setScale / reset', () => {
    it('centerOn 把世界点放到可见中心,scale 被钳到 [1, MAX_SCALE]', () => {
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

    it('reset() 回到 {tx:0, ty:0, scale:1}(Vue2 handleReset)', () => {
      const nowSpy = vi.spyOn(performance, 'now')
      nowSpy.mockReturnValue(0)
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 300, ty: -100, scale: 8 }
      pv.reset()
      nowSpy.mockReturnValue(420)
      flushRaf(420)
      expect(pv.view.value).toEqual({ tx: 0, ty: 0, scale: 1 })
    })
  })

  describe('autoPanTo', () => {
    it('传含 lon/lat 的 place → 该点最终落在可见中心(推完动画帧)', () => {
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

    it('传 null/undefined → view 完全不变、不排 rAF', () => {
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 7, ty: 8, scale: 2 }
      const before = pv.view.value
      pv.autoPanTo(null)
      expect(pv.view.value).toBe(before)
      pv.autoPanTo(undefined)
      expect(pv.view.value).toBe(before)
      expect(rafSpy).not.toHaveBeenCalled()
    })

    it('scale 至少 1.8:当前 1 时升到 1.8;当前 3 时保持 3', () => {
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
    it('共点成员(splitScaleFor 返 MAX_SCALE)→ 目标 scale 为 MAX_SCALE', () => {
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

    it('可裂开的簇 → 目标 scale > 当前', () => {
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

    it('mock 裂解阈值 = currentScale 时 +0.01 生效且未被钳制', () => {
      // 评审 I2:已代数证明 +0.01 对任意合法 currentScale ∈ [1, MAX_SCALE] 恒不可观测
      // ——splitScaleFor 的「可裂」分支恒返回 >= currentScale * 1.04(严格大于
      // currentScale + 0.01),「裂不开」分支恒返回 MAX_SCALE 并被 centerOn 自己的
      // clamp 夹回 MAX_SCALE。这条用例用 vi.spyOn 把 splitScaleFor 钉死在
      // currentScale 本身——这是真实链路里 splitScaleFor 永远不会返回的值(最小也是
      // currentScale + 0.04),只是为了给"删掉 +0.01"这个删码动作制造一个能观测到差异
      // 的靶子,不代表任何用户可达到的真实场景/可观测行为。
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

    it('已在 MAX_SCALE、共点簇(自然场景):不抛且最终钳回 MAX_SCALE', () => {
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
    it('deltaY<0 放大(factor=1.18),deltaY>0 缩小(factor=1/1.18),preventDefault 被调用,锚点是指针位置', () => {
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
      // 定点不变量:锚点对应的世界坐标不变
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

  describe('拖拽(pointer capture)', () => {
    it('down → move(100px)→ tx 增量 = 100 × screenToVbScale(=1.25)', () => {
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
      expect(pv.view.value.ty).toBeCloseTo(20) // 未沿 y 移动
      expect(pv.view.value.scale).toBe(2) // 拖拽不改 scale
    })

    it('onPointerMove 未经 down 时是 no-op', () => {
      const pv = usePlacesView(makeOpts())
      pv.view.value = { tx: 1, ty: 2, scale: 3 }
      const before = pv.view.value
      const move = { clientX: 999, clientY: 999, pointerId: 1, target: document.body } as unknown as PointerEvent
      pv.onPointerMove(move)
      expect(pv.view.value).toBe(before)
    })

    it('e.target 在 .geo-pin 内时 onPointerDown 直接返回(不 setPointerCapture,后续 move 不改 view)', () => {
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

    it('onPointerUp:releasePointerCapture 抛异常不冒泡(try/catch),_drag 已清', () => {
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
      expect(pv.view.value).toBe(before) // _drag 已清,move 是 no-op
    })
  })

  describe('dispose', () => {
    it('取消在途 rAF', () => {
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
