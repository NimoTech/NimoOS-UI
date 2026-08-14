// P6a-T6: PlacesMap.vue — SVG map stage for Places page.
// Each test corresponds to items in task-6-brief.md "required tests checklist"; adds coverage for
// structure specs 1-8 and cleanup checklist 5 items.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { visitedDots, type Place } from '../../util/placesMap'
import { WORLD_DOTS } from '../../util/worldMap'
import PlacesMap from '../PlacesMap.vue'
// Raw source text (Vite `?raw`) — some tests need to read source text itself (color attribute
// guards, theme-exception comment compliance), not coverable by DOM assertions; same pattern
// as PlacesRail.test.ts:19.
import placesMapRaw from '../PlacesMap.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'

// Note: extractStyleBlock() from cssCascade.ts strips CSS comments before returning
// (for cascade tests where comments would pollute selector parsing). But theme-exception
// compliance check needs to see the original comment text itself, so we extract an
// unstripped <style> block here and don't reuse that helper.
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('style block not found')
  return m[1]
}

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7),
    trips: 1, home: false, thumbs: ['t1'], coverAssetId: '', ...over,
  }
}

// Single inactive, non-recent small location (used for hitR cleanup check ④).
const PLAIN = place({ id: 'plain', city: 'Plain City', lon: 100, lat: 20, count: 3, recent: false })
// Active + recent single point (full 5-layer structure: pulse/core/label all present).
const ACTIVE_RECENT = place({ id: 'active-recent', city: 'Activeville', lon: -70, lat: 40, count: 10, recent: true })
// Two mutually very close, both inactive/non-recent points — must merge into one cluster at scale=1.
const CLUSTER_A = place({ id: 'clus-a', city: 'Cluster A', lon: 10, lat: 10, count: 5, recent: false })
const CLUSTER_B = place({ id: 'clus-b', city: 'Cluster B', lon: 10.01, lat: 10.01, count: 5, recent: false })
// One truly landed point (near London, land mask covers it); asserts land-dot is-visited count —
// not just "present/absent", but "count exactly equals visitedDots() result" (cleanup check ⑤ target).
const LONDON = place({ id: 'london', city: 'London', lon: 0, lat: 51, count: 1, recent: false })

function mountMap(over: Partial<InstanceType<typeof PlacesMap>['$props']> = {}) {
  return mount(PlacesMap, {
    props: {
      places: [PLAIN, ACTIVE_RECENT],
      activeId: 'active-recent',
      view: { tx: 0, ty: 0, scale: 1 },
      themeVars: {},
      ...over,
    },
  })
}

describe('Structure spec 1: <svg> viewBox / preserveAspectRatio', () => {
  it('viewBox is "0 0 1000 500", preserveAspectRatio is xMidYMid meet', () => {
    const w = mountMap()
    const svg = w.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 1000 500')
    expect(svg.attributes('preserveAspectRatio')).toBe('xMidYMid meet')
  })

  it('themeVars applied to <svg> style (background and --map-dot both present)', () => {
    const w = mountMap({ themeVars: { background: 'rgb(1, 2, 3)', '--map-dot': 'rgba(4, 5, 6, 1)' } })
    const el = w.find('svg').element as SVGSVGElement
    expect(el.style.background).toContain('rgb(1, 2, 3)')
    expect(el.style.getPropertyValue('--map-dot')).toBe('rgba(4, 5, 6, 1)')
  })
})

describe('Structure spec 2: outer <g> transform', () => {
  it('exactly translate(12 34) scale(2)', () => {
    const w = mountMap({ view: { tx: 12, ty: 34, scale: 2 }, places: [] })
    const g = w.find('svg > g')
    expect(g.attributes('transform')).toBe('translate(12 34) scale(2)')
  })
})

describe('Structure spec 3: land dot grid (cleanup check ⑤ target)', () => {
  it('rendered count === WORLD_DOTS.length', () => {
    const w = mountMap({ places: [] })
    expect(w.findAll('.world-dot').length).toBe(WORLD_DOTS.length)
  })

  it('visited items have .is-visited, non-visited don\'t — exact count, not just existence', () => {
    const w = mountMap({ places: [LONDON] })
    const expected = visitedDots([LONDON])
    const expectedVisited = expected.filter(d => d.visited).length
    const expectedNotVisited = expected.length - expectedVisited
    // London fixture must actually hit at least one land cell, else this test is blunt for cleanup ⑤.
    expect(expectedVisited).toBeGreaterThan(0)
    expect(w.findAll('.world-dot.is-visited').length).toBe(expectedVisited)
    expect(w.findAll('.world-dot:not(.is-visited)').length).toBe(expectedNotVisited)
  })

  // Review I1: .world-dot fill fallback must be dedicated token --map-dot-bg-fallback,
  // not --fg-faint — dark --fg-faint (0.52) is bright enough to cover is-visited dots;
  // light --fg-faint is opaque warm-gray that becomes solid color block on dark map canvas
  // (both are Vue2 most common paths, not rare branches).
  it('.world-dot fill fallback references --map-dot-bg-fallback, not --fg-faint (cleanup: switch back to --fg-faint will fail)', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.world-dot')
    expect(rule, '.world-dot standalone rule not found').toBeTruthy()
    expect(rule!.body).toMatch(/fill:\s*var\(--map-dot-bg,\s*var\(--map-dot-bg-fallback\)\)/)
    expect(rule!.body).not.toContain('--fg-faint')
  })
})

describe('Structure spec 4: pin 5-layer structure (render-omission main guard)', () => {
  it('non-cluster active pin: pin-hit/pin-pulse/pin-bg/pin-core/geo-pin-label each 1', () => {
    const w = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(pin.findAll('.pin-hit').length).toBe(1)
    expect(pin.findAll('.pin-pulse').length).toBe(1)
    expect(pin.findAll('.pin-bg').length).toBe(1)
    expect(pin.findAll('.pin-core').length).toBe(1)
    expect(pin.findAll('.geo-pin-label').length).toBe(1)
  })

  it('cluster pin: pin-core/pin-pulse/geo-pin-label all 0 (following Vue2 v-if, cleanup check ①)', () => {
    const w = mountMap({ places: [CLUSTER_A, CLUSTER_B], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))
    expect(clusterPin, 'two close locations at scale=1 should merge into one cluster pin').toBeTruthy()
    expect(clusterPin!.findAll('.pin-core').length).toBe(0)
    expect(clusterPin!.findAll('.pin-pulse').length).toBe(0)
    expect(clusterPin!.findAll('.geo-pin-label').length).toBe(0)
    // cluster pin itself still needs pin-hit + pin-bg (v-if only affects core/pulse/label, not these two).
    expect(clusterPin!.findAll('.pin-hit').length).toBe(1)
    expect(clusterPin!.findAll('.pin-bg').length).toBe(1)
  })

  it('.pin-scale exists and pin-pulse/pin-bg/pin-core all inside it (cleanup check ②)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    expect(pin.find('.pin-scale').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-pulse').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-bg').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-core').exists()).toBe(true)
  })

  it('pin-hit r equals p.hitR, and on small pin (count=3) strictly greater than p.r (cleanup check ④)', () => {
    const w = mountMap({ places: [PLAIN], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const pin = w.find('.geo-pin')
    const hit = pin.find('.pin-hit')
    const bg = pin.find('.pin-bg')
    const hitR = Number(hit.attributes('r'))
    const bgR = Number(bg.attributes('r'))
    // count=3 < 40 → tierRadius=7, scale=1 → r=7, hitR=max(7, 9/1)=9.
    expect(hitR).toBe(9)
    expect(bgR).toBe(7)
    expect(hitR).toBeGreaterThan(bgR)
  })

  it('.pin-core radius is .pin-bg radius times 0.55', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    const bgR = Number(pin.find('.pin-bg').attributes('r'))
    const coreR = Number(pin.find('.pin-core').attributes('r'))
    expect(coreR).toBeCloseTo(bgR * 0.55, 10)
  })
})

describe('Structure spec 4: condition classes stackable', () => {
  it('active → .is-active; recent → .is-recent; cluster → .is-cluster; all three stackable', () => {
    // ACTIVE_RECENT single point: active + recent, not a cluster.
    const w1 = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const activePin = w1.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(activePin.classes()).toContain('is-recent')
    expect(activePin.classes()).not.toContain('is-cluster')

    // if cluster member is both activeId and recent: three condition classes on same cluster pin.
    const clusA = place({ id: 'ca2', city: 'CA2', lon: 50, lat: -30, count: 5, recent: true })
    const clusB = place({ id: 'cb2', city: 'CB2', lon: 50.01, lat: -30.01, count: 5, recent: false })
    const w2 = mountMap({ places: [clusA, clusB], activeId: 'ca2', view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w2.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))!
    expect(clusterPin.classes()).toContain('is-active')
    expect(clusterPin.classes()).toContain('is-recent')
    expect(clusterPin.classes()).toContain('is-cluster')
  })
})

describe('Structure spec 4: label counter-scale (cleanup check ③)', () => {
  it('when view.scale = 4, font-size=2.75px, stroke-width=0.85, y = 4.5 (all hand-calculated hardcoded)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent', view: { tx: 0, ty: 0, scale: 4 } })
    const pin = w.find('.geo-pin')
    const label = pin.find('.geo-pin-label')
    expect(label.exists()).toBe(true)
    const style = (label.element as unknown as HTMLElement).style
    // Hand-calculated, not reverse-inferred from DOM p.r (review Minor 3: if p.r itself
    // is wrong, old reverse-inference won't catch it). ACTIVE_RECENT.count = 10 →
    // tierRadius(10) = 7 (< 40 tier) → p.r = 7 / scale = 7 / 4 = 1.75. font-size = 11 / 4 = 2.75,
    // stroke-width = 3.4 / 4 = 0.85, y = p.r + 11/4 = 1.75 + 2.75 = 4.5.
    expect(style.fontSize).toBe('2.75px')
    expect(style.strokeWidth).toBe('0.85')
    expect(Number(label.attributes('y'))).toBeCloseTo(4.5, 10)
  })
})

// jsdom does neither real Vue transition enter/exit state, nor render name="pin-merge" as DOM attribute
// (that's pure JS-side transition config, never hits DOM) — after mount, can't assert "animation actually played".
// ambiguity-resolved item 5 gives the alternative: ① assert <transition-group> exists with name="pin-merge"
// (can only read template source, not render result); ② programmatically assert all four animation rules
// exist with expected properties in style block.
describe('Structure spec 4: pin-merge enter/leave animation (source-level assertion, reason above)', () => {
  it('rendered transition-group is name="pin-merge", tag="g", class="pins-layer"', () => {
    // @vue/test-utils by default stubs <transition-group> as <transition-group-stub> (not real <g>),
    // but stub element passes tag/name props as-is into DOM attributes — asserting from them is more
    // reliable than regex on template source (doesn't depend on attribute order/quote style).
    const w = mountMap({ places: [] })
    const layer = w.find('.pins-layer')
    expect(layer.exists()).toBe(true)
    expect(layer.attributes('name')).toBe('pin-merge')
    expect(layer.attributes('tag')).toBe('g')
  })

  it('four animation rules all present with expected properties (active uses transition, enter-from/leave-to use scale(0.25)+opacity:0)', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const activeRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-active .pin-scale')
      && r.selectors.includes('.pin-merge-leave-active .pin-scale'))
    expect(activeRule, '.pin-merge-enter-active/.pin-merge-leave-active .pin-scale rule not found').toBeTruthy()
    expect(activeRule!.body).toMatch(/transition:\s*transform[^;]*,\s*opacity/)

    // This rule's selectors must be Vue3 enter-from/leave-to (not Vue2 .pin-merge-enter) —
    // if someone copy-pastes Vue2 class name, selector string won't match and rule won't be found, test fails.
    const hiddenRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-from .pin-scale')
      && r.selectors.includes('.pin-merge-leave-to .pin-scale'))
    expect(hiddenRule, '.pin-merge-enter-from/.pin-merge-leave-to .pin-scale rule not found (Vue2→Vue3 class rename missed?)').toBeTruthy()
    expect(hiddenRule!.body).toMatch(/transform:\s*scale\(0\.25\)/)
    expect(hiddenRule!.body).toMatch(/opacity:\s*0\b/)
  })
})

// Review Minor 1: without either transform-box: fill-box or transform-origin: center,
// merge/split animations scale around SVG user-space origin and pins fly off-screen — but jsdom
// does no layout or transform calculation; DOM assertions can't catch visual consequences; can
// only pin these two declarations exist at style-source level. Similarly, .geo-pin:hover
// var(--pin-glow) reference previously had zero coverage (deleting whole rule: 19/19 still pass);
// adding coverage for both here.
describe('Structure spec 4/8: .pin-scale geometry + hover glow reference (supplementary, previously zero coverage)', () => {
  it('.pin-scale rule contains both transform-box: fill-box and transform-origin: center', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.pin-scale')
    expect(rule, '.pin-scale standalone rule not found').toBeTruthy()
    expect(rule!.body).toMatch(/transform-box:\s*fill-box/)
    expect(rule!.body).toMatch(/transform-origin:\s*center/)
  })

  it('.geo-pin:hover references var(--pin-glow) for outer glow', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.includes('.geo-pin:hover'))
    expect(rule, '.geo-pin:hover rule not found').toBeTruthy()
    expect(rule!.body).toMatch(/filter:\s*drop-shadow\([^)]*var\(--pin-glow\)/)
  })
})

describe('emit: click / hover / leave', () => {
  it('click pin emits pick-pin with pin and event', async () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    await pin.trigger('click')
    expect(w.emitted('pick-pin')).toHaveLength(1)
    const [emittedPin, ev] = w.emitted('pick-pin')![0] as [{ id: string }, MouseEvent]
    expect(emittedPin.id).toBe('active-recent')
    expect(ev).toBeInstanceOf(MouseEvent)
  })

  it('mouseenter emits hover-pin, mouseleave emits hover-clear', async () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    await pin.trigger('mouseenter')
    expect(w.emitted('hover-pin')).toHaveLength(1)
    const [emittedPin] = w.emitted('hover-pin')![0] as [{ id: string }]
    expect(emittedPin.id).toBe('active-recent')

    await pin.trigger('mouseleave')
    expect(w.emitted('hover-clear')).toHaveLength(1)
  })
})

describe('expose: svgEl 交给 T7/T11 做坐标换算与 pointer capture', () => {
  it('defineExpose 出的 svgEl 就是渲染出的 <svg> 元素', () => {
    const w = mountMap()
    expect((w.vm as unknown as { svgEl: SVGSVGElement }).svgEl).toBe(w.find('svg').element)
  })
})

describe('样式块零颜色 attribute(防日后有人图省事写回 attribute)', () => {
  it('组件源文本不出现任何颜色 attribute 写法(评审 Minor 2:原列表偏窄,补齐 stroke="#/fill="rgb/绑定字符串 var(', () => {
    expect(placesMapRaw).not.toContain('fill="#')
    expect(placesMapRaw).not.toContain('fill="var(')
    expect(placesMapRaw).not.toContain('stroke="var(')
    // 补的四种:原列表只挡了裸 attribute 的 hex/var 两种写法,漏了 stroke 的 hex、rgb() 函数、
    // 以及 :fill="'var(--x)'" 这种把 var() 包成字符串再绑定的写法(同样绕开 CSS 规则,不受
    // color-guard 的样式块扫描)。
    expect(placesMapRaw).not.toContain('stroke="#')
    expect(placesMapRaw).not.toContain('fill="rgb')
    expect(placesMapRaw).not.toContain('stroke="rgb')
    expect(placesMapRaw).not.toContain(':fill="\'var(')
    expect(placesMapRaw).not.toContain(':stroke="\'var(')
  })
})

describe('theme-exception 注释合规(照 color-guard 的豁免窗口规则)', () => {
  it('.geo-pin-label 规则内的裸颜色字面量都被紧邻的 theme-exception 注释豁免窗口覆盖', () => {
    const styleText = rawStyleBlock(placesMapRaw)
    const start = styleText.indexOf('.geo-pin-label {')
    expect(start).toBeGreaterThan(-1)
    const bodyStart = styleText.indexOf('{', start)
    const bodyEnd = styleText.indexOf('}', bodyStart)
    const ruleLines = styleText.slice(start, bodyEnd + 1).split('\n')

    // 逐字复刻 src/styles/color-guard.test.ts 的豁免窗口状态机(该文件:exempt 在遇到
    // theme-exception 注释后打开,遇到下一个 ; 或 } 就关闭)。踩过的坑:把注释整块挂在
    // 规则最前面、选择器上方——规则体第一行(font-family)就带 `;` 提前关窗,后面
    // fill/stroke 的裸 rgba() 其实裸奔,color-guard 会真的红。这里不只断言"有注释",
    // 而是真的按该状态机跑一遍,确认每处裸色都真被盖住。
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(rgba?|hsla?)\s*\(/
    let exempt = false
    const offenders: string[] = []
    const comments: string[] = []
    ruleLines.forEach((line) => {
      if (line.includes('theme-exception')) {
        exempt = true
        comments.push(line)
      }
      if (!exempt && (HEX.test(line) || FUNC.test(line)))
        offenders.push(line)
      if (line.includes(';') || line.includes('}'))
        exempt = false
    })
    expect(offenders, `裸颜色未被豁免窗口覆盖:\n${offenders.join('\n')}`).toEqual([])
    // 必须真的用上了豁免机制(不是规则里干脆没有裸色,那样上面的空数组毫无意义)。
    expect(comments.length).toBeGreaterThan(0)
    for (const c of comments) {
      expect(c).not.toContain(';')
      expect(c).not.toContain('}')
      expect(c.toLowerCase()).not.toContain('<style')
    }
  })
})
