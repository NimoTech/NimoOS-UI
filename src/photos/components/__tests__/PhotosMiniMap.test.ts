import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import photosMiniMapRaw from '../PhotosMiniMap.vue?raw'
import { MAP_H, MAP_W, project } from '../../util/worldMap'
import { extractStyleBlock, parseCssRules } from './cssCascade'

function viewBoxOf(w: ReturnType<typeof mount>): number[] {
  const vb = w.get('svg').attributes('viewBox') ?? ''
  return vb.split(' ').map(Number)
}

describe('PhotosMiniMap', () => {
  it('when no valid points, viewBox is global range and emptyText is displayed', () => {
    const w = mount(PhotosMiniMap, { props: { points: [], emptyText: '暂无位置数据' } })
    expect(w.get('svg').attributes('viewBox')).toBe(`0 0 ${MAP_W} ${MAP_H}`)
    expect(w.text()).toContain('暂无位置数据')
  })

  it('with single point, viewBox longitude span is not less than MIN_LON_SPAN (projection conversion)', () => {
    const w = mount(PhotosMiniMap, {
      props: { points: [{ latitude: 10, longitude: 20, color: '#fff' }] },
    })
    const [, , vw] = viewBoxOf(w)
    // MIN_LON_SPAN = 40 degrees → 40/360 * MAP_W
    expect(vw).toBeGreaterThanOrEqual((40 / 360) * MAP_W - 1e-9)
    // empty state overlay not displayed
    expect(w.find('.mini-map-empty').exists()).toBe(false)
  })

  it('with two distant points, bounding box (after adding padding) covers projection coordinates of both points', () => {
    const points = [
      { latitude: 60, longitude: -100, color: '#f00' },
      { latitude: -30, longitude: 140, color: '#0f0' },
    ]
    const w = mount(PhotosMiniMap, { props: { points } })
    const [vx, vy, vw, vh] = viewBoxOf(w)
    for (const p of points) {
      const { x, y } = project(p.longitude, p.latitude)
      expect(x).toBeGreaterThanOrEqual(vx - 1e-9)
      expect(x).toBeLessThanOrEqual(vx + vw + 1e-9)
      expect(y).toBeGreaterThanOrEqual(vy - 1e-9)
      expect(y).toBeLessThanOrEqual(vy + vh + 1e-9)
    }
  })

  it('points with latitude as NaN or string are filtered, do not participate in bounding box (and not rendered as person dot)', () => {
    const points = [
      { latitude: Number.NaN, longitude: 20, color: '#f00' },
      { latitude: '30' as unknown as number, longitude: 40, color: '#0f0' },
      { latitude: 10, longitude: 10, color: '#00f' },
    ]
    const w = mount(PhotosMiniMap, { props: { points } })
    // only one valid point participates in rendering
    expect(w.findAll('.dot-person')).toHaveLength(1)
  })
})

// ── Regression: light-theme mini-map had a white background bug ──────────────────
// Root cause: this component's own scoped `<style>` used to have a
// `.mini-map-root { background: var(--card); … }` rule, which had the same selector
// specificity as the parity rule `.map-card .mini-map-root`
// (src/photos/styles/vue2-parity/photos-people.scss:652-660, which includes the
// correct light-theme override for `.photos-root.is-light`) — so it shadowed it. The
// same shadowing pattern is documented in the style-block header comment of
// views/PhotosSearch.vue ("Scoped [data-v-xxx] specificity always won over the
// correct plain parity selector of the same name"). In the light-theme block,
// `--card` resolves to pure white #ffffff, not the warm white
// oklch(0.975 0.004 80) that the Vue2 light mini-map actually used — which is the
// real bug behind "light mini-map has a white background". jsdom doesn't compute
// cascade (see the same conclusion in the header comment of
// views/__tests__/photosGlassSurfaces.test.ts), so this rule can't be caught by a
// unit test directly; the only way is to read the raw style block text and assert
// that the shadowing rule has been removed, handing governance back to parity.
describe('light mini-map white-background bug (shadowing cleanup): no longer ships its own background/width/height', () => {
  it('the local .mini-map-root rule no longer declares background/width/height (removed, parity governs directly)', () => {
    // extractStyleBlock() strips CSS comments before returning its result — this
    // file's own header comment contains example text like
    // ".map-card .mini-map-root { background: var(--surface-1) }"; without stripping
    // comments, a naive indexOf would wrongly match the example in the comment
    // instead of the real rule. The first version of this test hit exactly this pitfall.
    const rules = parseCssRules(extractStyleBlock(photosMiniMapRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.mini-map-root')
    expect(rule, '.mini-map-root standalone rule not found').toBeTruthy()
    expect(rule!.body).not.toMatch(/\bbackground\s*:/)
    expect(rule!.body).not.toMatch(/\bwidth\s*:/)
    expect(rule!.body).not.toMatch(/\bheight\s*:/)
    // Non-duplicated structural declarations are allowed to remain.
    expect(rule!.body).toMatch(/position\s*:\s*relative/)
    expect(rule!.body).toMatch(/overflow\s*:\s*hidden/)
  })
})
