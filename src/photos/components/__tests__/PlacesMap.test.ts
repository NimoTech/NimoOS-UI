// PlacesMap.vue — the SVG map stage on the Places page.
// Systematically covers structural specs 1-8 plus 5 mutation-testing checkpoints.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { visitedDots, type Place } from '../../util/placesMap'
import { WORLD_DOTS } from '../../util/worldMap'
import PlacesMap from '../PlacesMap.vue'
// Raw source text (Vite `?raw`) — some tests need to read the source text itself (the color
// attribute guard, theme-exception comment compliance), which DOM assertions can't cover,
// following the existing precedent at PlacesRail.test.ts:19.
import placesMapRaw from '../PlacesMap.vue?raw'
// The `.world-dot` CSS rule moved out of PlacesMap.vue's own <style> block into
// PlacesWorldDots.vue's (the dots now render inside that child component's own template, not
// this one's — see that file's own header comment on why the rule had to move with the
// elements). The raw-source rule-lookup test below is repointed at the new home.
import placesWorldDotsRaw from '../PlacesWorldDots.vue?raw'
import { extractStyleBlock, parseCssRules } from './cssCascade'
// `.css?raw` comes back empty in this test environment (the same pitfall
// views/__tests__/photosGlassSurfaces.test.ts's header comment documents for CSS files
// specifically — Vite's own CSS plugin intercepts the import before the raw-suffix loader runs,
// unlike `.vue?raw` used elsewhere in this file, which isn't intercepted the same way); read
// theme.css via node:fs instead, same as that file's own `read()` helper.
import fs from 'node:fs'
import path from 'node:path'

const themeCssRaw = fs.readFileSync(path.resolve(__dirname, '../../../styles/theme.css'), 'utf8')
// Note: parity's own photos-places.scss, needed to verify the
// `.geo-pin:hover` glow rule now governs from THERE (purple `rgba(var(--accent-rgb), …)`) rather
// than from this component's own (now-deleted) local `--pin-glow`-consuming duplicate.
const placesParityScssRaw = fs.readFileSync(
  path.resolve(__dirname, '../../styles/vue2-parity/photos-places.scss'), 'utf8',
)

// Note: cssCascade.ts's extractStyleBlock() strips CSS comments before returning (for the
// "selector priority" test group, where comments would pollute selector parsing). The
// theme-exception compliance check needs to see the raw comment text itself, so this file grabs
// its own un-stripped <style> block instead of reusing that helper.
function rawStyleBlock(src: string): string {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
  if (!m) throw new Error('未找到样式块')
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

// A single small, inactive, non-recent place (used for hitR mutation-test checkpoint 4).
const PLAIN = place({ id: 'plain', city: 'Plain City', lon: 100, lat: 20, count: 3, recent: false })
// An active + recent single point (all five layers present: pulse/core/label must all appear).
const ACTIVE_RECENT = place({ id: 'active-recent', city: 'Activeville', lon: -70, lat: 40, count: 10, recent: true })
// Two points very close to each other, both inactive/non-recent — they must merge into one cluster at scale=1.
const CLUSTER_A = place({ id: 'clus-a', city: 'Cluster A', lon: 10, lat: 10, count: 5, recent: false })
const CLUSTER_B = place({ id: 'clus-b', city: 'Cluster B', lon: 10.01, lat: 10.01, count: 5, recent: false })
// A point that genuinely lands on ground (near London, covered by the land mask), used to
// assert the land-dot-grid's is-visited count — not just whether it's nonzero, but that the
// count exactly matches what visitedDots() computes (the target of mutation-test checkpoint 5).
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

describe('structure spec 1: <svg> viewBox / preserveAspectRatio', () => {
  it('viewBox is "0 0 1000 500", preserveAspectRatio is xMidYMid meet', () => {
    const w = mountMap()
    const svg = w.find('svg')
    expect(svg.attributes('viewBox')).toBe('0 0 1000 500')
    expect(svg.attributes('preserveAspectRatio')).toBe('xMidYMid meet')
  })

  it('themeVars lands on the <svg> style (both background and --map-dot present)', () => {
    const w = mountMap({ themeVars: { background: 'rgb(1, 2, 3)', '--map-dot': 'rgba(4, 5, 6, 1)' } })
    const el = w.find('svg').element as SVGSVGElement
    expect(el.style.background).toContain('rgb(1, 2, 3)')
    expect(el.style.getPropertyValue('--map-dot')).toBe('rgba(4, 5, 6, 1)')
  })
})

describe('structure spec 2: the outer <g>\'s transform', () => {
  it('is exactly translate(12 34) scale(2)', () => {
    const w = mountMap({ view: { tx: 12, ty: 34, scale: 2 }, places: [] })
    const g = w.find('svg > g')
    expect(g.attributes('transform')).toBe('translate(12 34) scale(2)')
  })
})

describe('structure spec 3: land dot grid (mutation-kill checkpoint 5)', () => {
  it('rendered count === WORLD_DOTS.length', () => {
    const w = mountMap({ places: [] })
    expect(w.findAll('.world-dot').length).toBe(WORLD_DOTS.length)
  })

  it('visited entries carry .is-visited and non-visited ones don\'t — exact counts, not just existence', () => {
    const w = mountMap({ places: [LONDON] })
    const expected = visitedDots([LONDON])
    const expectedVisited = expected.filter(d => d.visited).length
    const expectedNotVisited = expected.length - expectedVisited
    // The London fixture must actually hit at least one land cell, otherwise this test is blind to mutation-test checkpoint 5.
    expect(expectedVisited).toBeGreaterThan(0)
    expect(w.findAll('.world-dot.is-visited').length).toBe(expectedVisited)
    expect(w.findAll('.world-dot:not(.is-visited)').length).toBe(expectedNotVisited)
  })

  // The .world-dot fill fallback must be the dedicated --map-dot-bg-fallback token, not
  // --fg-faint — the dark-theme --fg-faint (0.52 alpha) is bright enough to wash out is-visited
  // dots, and the light-theme --fg-faint is an opaque warm gray, which on the map's dark canvas
  // becomes a solid opaque block (both are common Vue2 code paths, not rare edge cases).
  // This rule now lives in PlacesWorldDots.vue's own <style> block (the dot-grid <circle>
  // elements were extracted into that child component, and the scoped attribute only applies to
  // elements produced by its own template — leaving the rule in PlacesMap.vue would make it a
  // dead rule that never matches anything), so the raw-source lookup target moved along with it;
  // the assertion content itself is unchanged.
  it('.world-dot\'s fill fallback references --map-dot-bg-fallback, not --fg-faint (mutation-kill: switching back to --fg-faint must go red)', () => {
    const rules = parseCssRules(extractStyleBlock(placesWorldDotsRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.world-dot')
    expect(rule, '.world-dot 独立规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/fill:\s*var\(--map-dot-bg,\s*var\(--map-dot-bg-fallback\)\)/)
    expect(rule!.body).not.toContain('--fg-faint')
  })

  // --map-dot-bg-fallback's own literal was still the pre-#106
  // value (rgba(255,255,255,0.10)) — Vue2 PR #106 (git show 78cf3335) bumped it twice
  // (0.10→0.20→0.30) and this repo's token never caught up. Both theme blocks (`:root` dark and
  // `:root[data-theme="light"]`) must carry the same 0.30 literal — this fallback is only ever
  // reached on the dark-canvas path (dotBg is null; a light preset always supplies its own
  // dotBg), so it's intentionally theme-invariant, matching Vue2's own single non-varying
  // literal at photos-places.scss:349.
  it('--map-dot-bg-fallback is 0.30 in both theme blocks (not the pre-#106 0.10)', () => {
    const matches = [...themeCssRaw.matchAll(/--map-dot-bg-fallback:\s*([^;]+);/g)].map(m => m[1].trim())
    expect(matches.length, '两套主题块(:root / :root[data-theme="light"])都应定义这个 token').toBe(2)
    for (const v of matches) expect(v).toBe('rgba(255, 255, 255, 0.30)')
  })
})

describe('structure spec 4: the pin\'s five-layer structure (guards against missing renders)', () => {
  it('a non-cluster, active pin: exactly 1 each of pin-hit/pin-pulse/pin-bg/pin-core/geo-pin-label', () => {
    const w = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(pin.findAll('.pin-hit').length).toBe(1)
    expect(pin.findAll('.pin-pulse').length).toBe(1)
    expect(pin.findAll('.pin-bg').length).toBe(1)
    expect(pin.findAll('.pin-core').length).toBe(1)
    expect(pin.findAll('.geo-pin-label').length).toBe(1)
  })

  it('a cluster pin: pin-core/pin-pulse/geo-pin-label all 0 (following Vue2\'s v-if, mutation-kill checkpoint 1)', () => {
    const w = mountMap({ places: [CLUSTER_A, CLUSTER_B], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))
    expect(clusterPin, '两个近距地点在 scale=1 下应合并成一个簇图钉').toBeTruthy()
    expect(clusterPin!.findAll('.pin-core').length).toBe(0)
    expect(clusterPin!.findAll('.pin-pulse').length).toBe(0)
    expect(clusterPin!.findAll('.geo-pin-label').length).toBe(0)
    // The cluster pin itself should still have pin-hit + pin-bg (the v-if only gates core/pulse/label, not these two layers).
    expect(clusterPin!.findAll('.pin-hit').length).toBe(1)
    expect(clusterPin!.findAll('.pin-bg').length).toBe(1)
  })

  it('.pin-scale exists and pin-pulse/pin-bg/pin-core are all nested inside it (mutation-kill checkpoint 2)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    expect(pin.find('.pin-scale').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-pulse').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-bg').exists()).toBe(true)
    expect(pin.find('.pin-scale .pin-core').exists()).toBe(true)
  })

  it('pin-hit\'s r equals p.hitR, and on a small pin (count=3) is strictly greater than p.r (mutation-kill checkpoint 4)', () => {
    const w = mountMap({ places: [PLAIN], activeId: null, view: { tx: 0, ty: 0, scale: 1 } })
    const pin = w.find('.geo-pin')
    const hit = pin.find('.pin-hit')
    const bg = pin.find('.pin-bg')
    const hitR = Number(hit.attributes('r'))
    const bgR = Number(bg.attributes('r'))
    // count=3 < 40 → tierRadius=7,scale=1 → r=7,hitR=max(7, 9/1)=9。
    expect(hitR).toBe(9)
    expect(bgR).toBe(7)
    expect(hitR).toBeGreaterThan(bgR)
  })

  it('.pin-core\'s radius is 0.55x .pin-bg\'s radius', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent' })
    const pin = w.find('.geo-pin')
    const bgR = Number(pin.find('.pin-bg').attributes('r'))
    const coreR = Number(pin.find('.pin-core').attributes('r'))
    expect(coreR).toBeCloseTo(bgR * 0.55, 10)
  })
})

describe('structure spec 4: conditional classes can stack', () => {
  it('active → .is-active; recent → .is-recent; cluster → .is-cluster; all three can stack', () => {
    // ACTIVE_RECENT as a lone point: active + recent, not a cluster.
    const w1 = mountMap({ places: [PLAIN, ACTIVE_RECENT], activeId: 'active-recent' })
    const activePin = w1.findAll('.geo-pin').find(g => g.classes().includes('is-active'))!
    expect(activePin.classes()).toContain('is-recent')
    expect(activePin.classes()).not.toContain('is-cluster')

    // When a cluster member is both the activeId and recent: all three conditional classes appear together on the same cluster pin.
    const clusA = place({ id: 'ca2', city: 'CA2', lon: 50, lat: -30, count: 5, recent: true })
    const clusB = place({ id: 'cb2', city: 'CB2', lon: 50.01, lat: -30.01, count: 5, recent: false })
    const w2 = mountMap({ places: [clusA, clusB], activeId: 'ca2', view: { tx: 0, ty: 0, scale: 1 } })
    const clusterPin = w2.findAll('.geo-pin').find(g => g.classes().includes('is-cluster'))!
    expect(clusterPin.classes()).toContain('is-active')
    expect(clusterPin.classes()).toContain('is-recent')
    expect(clusterPin.classes()).toContain('is-cluster')
  })
})

describe('structure spec 4: label counter-scaling (mutation-kill checkpoint 3)', () => {
  it('at view.scale = 4: font-size=2.75px, stroke-width=0.85, y=4.5 (all hand-computed, hardcoded)', () => {
    const w = mountMap({ places: [ACTIVE_RECENT], activeId: 'active-recent', view: { tx: 0, ty: 0, scale: 4 } })
    const pin = w.find('.geo-pin')
    const label = pin.find('.geo-pin-label')
    expect(label.exists()).toBe(true)
    const style = (label.element as unknown as HTMLElement).style
    // Computed by hand, not derived by reading p.r back from the DOM (if p.r itself were
    // computed wrong, the old approach of reverse-deriving from the DOM wouldn't catch it).
    // ACTIVE_RECENT.count = 10 → tierRadius(10) = 7 (the < 40 tier) → p.r = 7 / scale = 7 / 4 = 1.75.
    // font-size = 11 / 4 = 2.75, stroke-width = 3.4 / 4 = 0.85, y = p.r + 11/4 = 1.75 + 2.75 = 4.5。
    expect(style.fontSize).toBe('2.75px')
    expect(style.strokeWidth).toBe('0.85')
    expect(Number(label.attributes('y'))).toBeCloseTo(4.5, 10)
  })
})

// jsdom neither runs Vue transitions' real enter/leave states, nor puts name="pin-merge" onto
// a DOM attribute (that's a JS-side transition config that never reaches the DOM) — there's no
// way to assert after mount that "the animation actually played." The approach taken instead:
// (1) assert the <transition-group> exists with name="pin-merge" (only readable from the
// template source text, not from render output); (2) programmatically assert in the style block
// that the four animation rules exist with the expected properties.
describe('structure spec 4: pin-merge enter/leave animation (source-level assertions, see comment above)', () => {
  it('the rendered transition-group is name="pin-merge", tag="g", class="pins-layer"', () => {
    // @vue/test-utils stubs <transition-group> as <transition-group-stub> by default (it doesn't
    // render as a real <g>), but the stub element carries props like tag/name straight through as
    // DOM attributes — asserting on those is more reliable than regex-scraping the template
    // source text (it doesn't depend on attribute ordering or quote style).
    const w = mountMap({ places: [] })
    const layer = w.find('.pins-layer')
    expect(layer.exists()).toBe(true)
    expect(layer.attributes('name')).toBe('pin-merge')
    expect(layer.attributes('tag')).toBe('g')
  })

  it('all four animation rules exist with the expected properties (active uses transition, enter-from/leave-to use scale(0.25)+opacity:0)', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const activeRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-active .pin-scale')
      && r.selectors.includes('.pin-merge-leave-active .pin-scale'))
    expect(activeRule, '.pin-merge-enter-active/.pin-merge-leave-active 的 .pin-scale 规则未找到').toBeTruthy()
    expect(activeRule!.body).toMatch(/transition:\s*transform[^;]*,\s*opacity/)

    // This rule's selector must use Vue3's enter-from/leave-to (not Vue2's .pin-merge-enter) —
    // if someone copies over the Vue2 class names verbatim, the selector string won't match and
    // this rule won't be found, turning the test red.
    const hiddenRule = rules.find(r =>
      r.selectors.includes('.pin-merge-enter-from .pin-scale')
      && r.selectors.includes('.pin-merge-leave-to .pin-scale'))
    expect(hiddenRule, '.pin-merge-enter-from/.pin-merge-leave-to 的 .pin-scale 规则未找到(Vue2→Vue3 类名改名是否漏做?)').toBeTruthy()
    expect(hiddenRule!.body).toMatch(/transform:\s*scale\(0\.25\)/)
    expect(hiddenRule!.body).toMatch(/opacity:\s*0\b/)
  })
})

// If either transform-box: fill-box or transform-origin: center is missing, the merge/split
// animation scales around the SVG's user-space origin instead, sending pins flying off-screen —
// but jsdom does no layout or transform computation, so DOM assertions can't catch that visual
// consequence; the only option is to pin down at the style-source level that both declarations
// exist. The same gap existed for .geo-pin:hover's var(--pin-glow) reference (deleting the whole
// rule left 19/19 tests still green), so that's covered here too.
describe('structure spec 4/8: .pin-scale geometry declarations + hover glow reference (added test, previously zero coverage)', () => {
  it('the .pin-scale rule includes both transform-box: fill-box and transform-origin: center', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.pin-scale')
    expect(rule, '.pin-scale 独立规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/transform-box:\s*fill-box/)
    expect(rule!.body).toMatch(/transform-origin:\s*center/)
  })

  // Note: this local `.geo-pin:hover` rule (blue
  // `var(--pin-glow)`) is DELETED from PlacesMap.vue's own `<style scoped>` — it was shadowing
  // parity's already-correct, byte-transcribed-from-Vue2 purple rule at a cascade tie (see
  // PlacesMap.vue's own header comment on this fix). Retargeted: assert the local rule is gone, and
  // that parity's own `.photos-root .geo-pin:hover` (photos-places.scss) is what actually governs
  // the glow now, using the purple `rgba(var(--accent-rgb), 0.7)` family Vue2 itself uses.
  it('the local .geo-pin:hover rule no longer exists (deleted, parity now governs it)', () => {
    const rules = parseCssRules(extractStyleBlock(placesMapRaw))
    const rule = rules.find(r => r.selectors.includes('.geo-pin:hover'))
    expect(rule, '.geo-pin:hover 规则应已从本地删除').toBeUndefined()
  })

  it('parity\'s .photos-root .geo-pin:hover uses the purple rgba(var(--accent-rgb), 0.7) for the outer glow (Vue2\'s original value)', () => {
    // photos-places.scss is a bare .scss, not a Vue SFC -- no `<style>` wrapper for
    // extractStyleBlock() to find, so strip comments directly and hand parseCssRules the raw text.
    const rules = parseCssRules(placesParityScssRaw.replace(/\/\*[\s\S]*?\*\//g, ''))
    const rule = rules.find(r => r.selectors.includes('.geo-pin:hover'))
    expect(rule, 'parity 的 .geo-pin:hover 规则未找到').toBeTruthy()
    expect(rule!.body).toMatch(/filter:\s*drop-shadow\(0 0 14px rgba\(var\(--accent-rgb\), 0\.7\)\)/)
  })
})

describe('emit: click / hover / leave', () => {
  it('clicking a pin emits pick-pin with the pin and the event', async () => {
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

describe('expose: svgEl is handed to T7/T11 for coordinate conversion and pointer capture', () => {
  it('the svgEl from defineExpose is the rendered <svg> element itself', () => {
    const w = mountMap()
    expect((w.vm as unknown as { svgEl: SVGSVGElement }).svgEl).toBe(w.find('svg').element)
  })
})

describe('zero color attributes in the style block (guards against someone lazily writing color back as an attribute)', () => {
  it('the component source text contains no color-attribute forms at all (the original list was too narrow — adds stroke="#/fill="rgb/the string-bound var( form)', () => {
    expect(placesMapRaw).not.toContain('fill="#')
    expect(placesMapRaw).not.toContain('fill="var(')
    expect(placesMapRaw).not.toContain('stroke="var(')
    // Four additions: the original list only blocked the hex/var forms of bare fill attributes,
    // missing stroke's hex form, the rgb() function form, and the :fill="'var(--x)'" form that
    // wraps var() in a string binding (which likewise bypasses CSS rules and isn't caught by
    // color-guard's style-block scan).
    expect(placesMapRaw).not.toContain('stroke="#')
    expect(placesMapRaw).not.toContain('fill="rgb')
    expect(placesMapRaw).not.toContain('stroke="rgb')
    expect(placesMapRaw).not.toContain(':fill="\'var(')
    expect(placesMapRaw).not.toContain(':stroke="\'var(')
  })
})

describe('theme-exception comment compliance (following color-guard\'s exemption-window rule)', () => {
  it('every bare color literal inside the .geo-pin-label rule is covered by an adjacent theme-exception exemption window', () => {
    const styleText = rawStyleBlock(placesMapRaw)
    const start = styleText.indexOf('.geo-pin-label {')
    expect(start).toBeGreaterThan(-1)
    const bodyStart = styleText.indexOf('{', start)
    const bodyEnd = styleText.indexOf('}', bodyStart)
    const ruleLines = styleText.slice(start, bodyEnd + 1).split('\n')

    // Reproduces verbatim the exemption-window state machine from
    // src/styles/color-guard.test.ts (exempt turns on after a theme-exception comment and turns
    // off at the next ; or }). A pitfall hit before: putting the whole comment block above the
    // selector, ahead of the rule — the rule body's first line (font-family) carries a `;` that
    // closes the window early, leaving the fill/stroke bare rgba() further down genuinely
    // unguarded, which would make color-guard actually fail. So this doesn't just assert "a
    // comment exists" — it actually runs the same state machine to confirm every bare color is
    // really covered.
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
    // The exemption mechanism must actually be exercised (not just a rule with no bare colors at all, which would make the empty array above meaningless).
    expect(comments.length).toBeGreaterThan(0)
    for (const c of comments) {
      expect(c).not.toContain(';')
      expect(c).not.toContain('}')
      expect(c.toLowerCase()).not.toContain('<style')
    }
  })
})
