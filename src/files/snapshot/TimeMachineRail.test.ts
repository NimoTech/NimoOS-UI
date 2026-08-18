import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineRail from './TimeMachineRail.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const GROUPS = [
  { dayKey: '2026-07-30', labelText: '今天', items: [
    { flatIndex: 0, time: '14:30', typeKind: 'manual' as const },
    { flatIndex: 1, time: '09:00', typeKind: 'auto' as const },
  ] },
  { dayKey: '2026-07-29', labelText: '昨天', items: [
    { flatIndex: 2, time: '09:00', typeKind: 'preop' as const },
  ] },
]
const mountIt = (props = {}) =>
  mount(TimeMachineRail, { props: { groups: GROUPS, selectedIndex: 0, ...props }, global: { plugins: [i18n] } })

// Enough snapshots to overflow the rail's own scroll container, so the
// "scroll the selected tick into view" behavior actually has somewhere to scroll to.
const manyGroups = () => [
  { dayKey: '2026-07-30', labelText: '今天', items: Array.from({ length: 50 }, (_, i) => (
    { flatIndex: i, time: `${String(i).padStart(2, '0')}:00`, typeKind: 'auto' as const }
  )) },
]

// Build a fake DOMRect filling only the top/height fields the component uses; the rest are 0 placeholders to satisfy the type.
const fakeRect = (top: number, height = 10): DOMRect =>
  ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('TimeMachineRail', () => {
  it('one major tick per snapshot, with readable aria-label', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains).toHaveLength(3)
    expect(mains[0].attributes('aria-label')).toContain('14:30')
  })
  it('insert decorative minor ticks between major ticks, minor ticks are not buttons', () => {
    const w = mountIt()
    expect(w.findAll('.tm-tick-sub').length).toBeGreaterThan(0)
    expect(w.find('.tm-tick-sub').element.tagName).not.toBe('BUTTON')
  })
  it('one date header per day', () => {
    expect(mountIt().findAll('.tm-rail-day').map((d) => d.text())).toEqual(['今天', '昨天'])
  })
  it('selected tick has is-selected class', () => {
    const w = mountIt({ selectedIndex: 1 })
    const sel = w.findAll('.tm-tick-main').filter((t) => t.classes().includes('is-selected'))
    expect(sel).toHaveLength(1)
    expect(sel[0].attributes('aria-label')).toContain('09:00')
  })
  it('type coloring class', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains[0].classes()).toContain('type-manual')
    expect(mains[2].classes()).toContain('type-preop')
  })
  it('clicking major tick emits select (only changes selection, does not enter)', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[2].trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(2)
  })
  it('clicking minor tick snaps to its parent major tick', async () => {
    const w = mountIt()
    await w.find('.tm-tick-sub').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(0)
  })
  it('hovering major tick shows time label, moving away hides it', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[1].trigger('mouseenter')
    expect(w.find('.tm-tick-label').text()).toBe('09:00')
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.find('.tm-tick-label').exists()).toBe(false)
  })
  it('on mouse move, compute scale for ticks (closer to cursor, larger)', async () => {
    const w = mountIt()
    // In jsdom getBoundingClientRect is always 0; this only asserts a transform was written
    // after mousemove. The curve itself is covered by timeMachineMath.test.ts (real numeric
    // assertions there); the stronger "closer means larger" assertion is the test below
    // (which mocks each tick's getBoundingClientRect to create real distance differences).
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    expect(w.findAll('.tm-tick-main')[0].attributes('style')).toContain('scaleX')
  })
  it('scale resets after mouse leaves', async () => {
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.findAll('.tm-tick-main')[0].attributes('style') ?? '').not.toContain('scaleX(2')
  })
  it('empty groups render empty ruler, no error', () => {
    expect(mountIt({ groups: [] }).findAll('.tm-tick-main')).toHaveLength(0)
  })

  // ↓ Addition: the brief's own "computes scale" case only asserts the style string contains
  // scaleX, so a hollow implementation that always returns scaleX(1) would pass (scaleX(1)
  // itself "contains scaleX"). Here we manually mock each main tick's own
  // getBoundingClientRect to create real, differing cursor distances, and assert the tick
  // closer to the cursor scales larger than the farther one — actually exercising the
  // computeFisheyeScales numeric path.
  // Note: back when main ticks and their sub-ticks shared data-flat-index, this test had to
  // mock the sub-ticks' rects too to pass (otherwise the map got overwritten by the sub-ticks'
  // default rect) — that shared key was itself the real bug review caught; the component now
  // uses data-anchor-index for sub-ticks (no more key collision), so mocking the main ticks
  // alone is enough, no need to accommodate that bug anymore.
  it('(non-hollow strengthening) when real distances from ticks to cursor differ, scales should differ and closer should be larger', async () => {
    const w = mountIt()
    const mains = w.findAll('.tm-tick-main')
    ;(mains[0].element as HTMLElement).getBoundingClientRect = () => fakeRect(100)
    ;(mains[2].element as HTMLElement).getBoundingClientRect = () => fakeRect(400)

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const scaleOf = (style: string | undefined) => {
      const m = (style ?? '').match(/scaleX\(([\d.]+)\)/)
      return m ? Number(m[1]) : 1
    }
    const nearScale = scaleOf(w.findAll('.tm-tick-main')[0].attributes('style'))
    const farScale = scaleOf(w.findAll('.tm-tick-main')[2].attributes('style'))
    expect(nearScale).toBeGreaterThan(farScale)
  })

  // ↓ Regression case pinned by review (T10 re-check): a main tick's scale must be computed
  // from its own center, and must not be overwritten by the sub-ticks that follow it sharing
  // the same logical flatIndex. Approach: place the main tick's own rect near the cursor
  // (should get close to the maxScale=2.2 peak) while pushing all its sub-ticks' rects far
  // away (well beyond radius=70, should get minScale=1). If updateScales() again writes
  // sub-tick values into the same map key in DOM order ("later overwrites earlier"), this
  // reads close to 1 instead of close to 2.2 and the assertion fails.
  it('major tick scale is computed from major tick center, not overwritten by sub-ticks at same anchor', async () => {
    const w = mountIt()
    const main0 = w.findAll('.tm-tick-main')[0].element as HTMLElement
    main0.getBoundingClientRect = () => fakeRect(100) // cursor at 105, distance ~5px, should be near peak
    for (const sub of w.findAll('.tm-tick-sub')) {
      (sub.element as HTMLElement).getBoundingClientRect = () => fakeRect(2000) // far beyond radius
    }

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    const m = style.match(/scaleX\(([\d.]+)\)/)
    const scale = m ? Number(m[1]) : 1
    expect(scale).toBeGreaterThan(2) // peak maxScale=2.2; if overwritten by a sub-tick it drops to minScale=1
  })

  // ↓ Addition: the brief never tested constraint #4 (rAF throttling + canceling the pending
  // frame on unmount). The default beforeEach rAF stub runs the callback synchronously, which
  // cannot detect "multiple mousemoves within one frame schedule only one recompute" — swap in
  // a manually-controlled stub (no auto invoke) so the throttling itself is observable.
  it('(added coverage for constraint #4) multiple mousemoves in one frame request rAF only once', async () => {
    const raf = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 20 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 30 })
    expect(raf).toHaveBeenCalledTimes(1)
  })
  it('(added coverage for constraint #4) cancel pending rAF on component unmount', async () => {
    const caf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 77))
    vi.stubGlobal('cancelAnimationFrame', caf)
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    w.unmount()
    expect(caf).toHaveBeenCalledWith(77)
  })

  // ↓ Task 10: with enough snapshots to overflow the rail's own scroll container,
  // stepping the selection past the visible range must scroll the rail too -- the deck
  // and the bottom bar already followed the selection, but the rail looked frozen.
  // B4: these two tests replace the global no-op stub (vitest.setup.ts) with a
  // per-test spy and never restored it, so any test that ran afterward in this
  // file inherited a spy from a previous, already-finished test.
  afterEach(() => { Element.prototype.scrollIntoView = () => {} })

  it('scrolls the newly selected tick into view', async () => {
    const spy = vi.fn()
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = spy
    const w = mountIt({ groups: manyGroups(), selectedIndex: 0 })
    spy.mockClear()
    await w.setProps({ selectedIndex: 40 })
    await nextTick()
    expect(spy).toHaveBeenCalled()
  })

  it('does not scroll when the selection did not change', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const w = mountIt({ groups: manyGroups(), selectedIndex: 3 })
    spy.mockClear()
    await w.setProps({ groups: manyGroups() })
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
  })
})
