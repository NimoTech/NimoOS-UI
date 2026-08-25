import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineRail from './TimeMachineRail.vue'
import { formatSnapshotClockTime } from '../../storage/util/snapshotView'
import zh from '../../i18n/zh_cn'
import type { SnapshotVM } from '../stores/snapshotBrowse'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Two real days ("today" and "yesterday" relative to whenever this suite runs) plus a controlled
// intra-day ordering, so the day-grouping/selection assertions below don't depend on any fixed
// calendar date.
const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const yesterday = new Date(now)
yesterday.setDate(yesterday.getDate() - 1)

const SNAPSHOTS: SnapshotVM[] = [
  { name: 's-today-newest', created_at: now.toISOString() },
  { name: 's-today-older', created_at: oneHourAgo.toISOString() },
  { name: 's-yesterday', created_at: yesterday.toISOString() },
]

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(TimeMachineRail, {
    props: { snapshots: SNAPSHOTS, current: null, loading: false, ...props },
    global: { plugins: [i18n] },
  })

// Enough same-day snapshots to give the "scroll the selected tick into view" behavior somewhere
// real to scroll to (jsdom itself never lays anything out, but this keeps the fixture honest).
const manySnapshots = (): SnapshotVM[] => Array.from({ length: 50 }, (_, i) => (
  { name: `s${i}`, created_at: new Date(now.getTime() - i * 3600_000).toISOString() }
))

// Build a fake DOMRect filling only the top/height fields the component uses; the rest are 0
// placeholders to satisfy the type.
const fakeRect = (top: number, height = 10): DOMRect =>
  ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('TimeMachineRail', () => {
  it('renders one major tick per snapshot, with a readable jump-to aria-label', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains).toHaveLength(3)
    expect(mains[0].attributes('aria-label')).toContain(formatClock(SNAPSHOTS[0]))
  })

  it('inserts decorative sub-ticks between major ticks; sub-ticks are not buttons', () => {
    const w = mountIt()
    expect(w.findAll('.tm-tick-sub').length).toBeGreaterThan(0)
    expect(w.find('.tm-tick-sub').element.tagName).not.toBe('BUTTON')
  })

  it('groups by day: two-day snapshot data renders two distinct day headers', () => {
    const days = mountIt().findAll('.tm-rail-day')
    expect(days).toHaveLength(2)
    expect(days[0].text()).not.toBe(days[1].text())
  })

  it('the tick matching `current` carries the is-selected class', () => {
    const w = mountIt({ current: 's-today-older' })
    const selected = w.findAll('.tm-tick-main').filter((n) => n.classes().includes('is-selected'))
    expect(selected).toHaveLength(1)
    expect(selected[0].attributes('data-flat-index')).toBe('s-today-older')
  })

  it('clicking a major tick emits select with that snapshot\'s name', async () => {
    const w = mountIt()
    const target = w.findAll('.tm-tick-main').find((n) => n.attributes('data-flat-index') === 's-yesterday')!
    await target.trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('s-yesterday')
  })

  it('clicking a minor tick emits select with its anchor major tick\'s name', async () => {
    const w = mountIt()
    const sub = w.find('.tm-tick-sub')
    const anchorName = sub.attributes('data-anchor-index')
    expect(anchorName).toBeTruthy()
    await sub.trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(anchorName)
  })

  it('hovering a major tick shows its time label; leaving the rail hides it', async () => {
    const w = mountIt()
    const target = w.findAll('.tm-tick-main').find((n) => n.attributes('data-flat-index') === 's-today-newest')!
    await target.trigger('mouseenter')
    expect(w.find('.tm-tick-label').text()).toBe(formatClock(SNAPSHOTS[0]))
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.find('.tm-tick-label').exists()).toBe(false)
  })

  it('on mouse move, writes a scaleX transform onto ticks', async () => {
    const w = mountIt()
    // jsdom's getBoundingClientRect is always 0 here; this only asserts a transform was written
    // after mousemove. The curve itself is covered by timeMachineMath.test.ts (real numeric
    // assertions on fisheyeScale); "closer means larger" is covered by the strengthened case below.
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    expect(w.findAll('.tm-tick-main')[0].attributes('style')).toContain('scaleX')
  })

  it('scale resets once the mouse leaves the rail', async () => {
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.findAll('.tm-tick-main')[0].attributes('style') ?? '').not.toContain('scaleX(2')
  })

  // ── Fix round (controller ruling): per-type tick class hook + manual badge, restored ──
  const TYPED_SNAPSHOTS: SnapshotVM[] = [
    { name: 's-manual', created_at: now.toISOString(), type: 'manual', label: 'before upgrade' },
    { name: 's-manual-no-label', created_at: oneHourAgo.toISOString(), type: 'manual' },
    { name: 's-auto', created_at: new Date(now.getTime() - 2 * 3600_000).toISOString(), type: 'auto-hourly' },
    { name: 's-preop', created_at: new Date(now.getTime() - 3 * 3600_000).toISOString(), type: 'preop' },
  ]

  it('every major tick carries a type-<kind> class hook (Vue2\'s own tm-tick--<kind> on every tick)', () => {
    const w = mountIt({ snapshots: TYPED_SNAPSHOTS })
    const byName = (name: string) => w.find(`[data-flat-index="${name}"]`)
    expect(byName('s-manual').classes()).toContain('type-manual')
    expect(byName('s-auto').classes()).toContain('type-auto') // auto-hourly collapses to 'auto'
    expect(byName('s-preop').classes()).toContain('type-preop')
  })

  it('only manual-type ticks render the badge (Vue2 parity: auto/preop get no badge)', () => {
    const w = mountIt({ snapshots: TYPED_SNAPSHOTS })
    const byName = (name: string) => w.find(`[data-flat-index="${name}"]`)
    expect(byName('s-manual').find('.tm-tick-badge').exists()).toBe(true)
    expect(byName('s-manual').find('.tm-tick-badge').text()).toContain('before upgrade')
    expect(byName('s-manual-no-label').find('.tm-tick-badge').exists()).toBe(true)
    expect(byName('s-manual-no-label').find('.tm-tick-badge').text()).not.toContain('·')
    expect(byName('s-auto').find('.tm-tick-badge').exists()).toBe(false)
    expect(byName('s-preop').find('.tm-tick-badge').exists()).toBe(false)
  })

  // jsdom applies no CSS at all -- :hover cannot be exercised by dispatching a real hover state
  // the way mousemove/scaleX assertions above are. This is a hook-presence check on the component's
  // own source instead (same "assert the token/selector is actually wired up" shape color-guard.
  // test.ts and tmTokens.test.ts already use elsewhere in this repo) -- it would fail if the hover
  // rule or either restored token were ever silently removed from the <style> block again.
  it('the hover-brightening and manual-badge tokens are actually wired into <style> (not just declared in theme.css)', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './TimeMachineRail.vue'),
      'utf8',
    )
    const styleBlock = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)![1]
    expect(styleBlock).toMatch(/:hover[\s\S]*?--tm-rail-tick-hover/)
    expect(styleBlock).toContain('--tm-rail-tick-manual')
    expect(styleBlock).toContain('.tm-tick-badge')
  })

  it('renders no ticks and no error with an empty snapshot list', () => {
    const w = mountIt({ snapshots: [] })
    expect(w.findAll('.tm-tick-main')).toHaveLength(0)
    expect(w.findAll('.tm-rail-day')).toHaveLength(0)
  })

  // ↓ Non-hollow strengthening: the plain "contains scaleX" case above would pass even for a
  // hollow implementation that always returns scaleX(1) (scaleX(1) itself "contains scaleX"). Here
  // each main tick's own getBoundingClientRect is mocked to create real, differing cursor
  // distances, and the tick closer to the cursor must scale larger than the farther one --
  // actually exercising fisheyeScale's numeric path.
  it('(non-hollow) real distance differences produce real scale differences, closer is larger', async () => {
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

  // ↓ Regression case for the exact bug this component's own data-attribute split guards against
  // (see TimeMachineRail.vue's own header comment): a main tick's scale must be computed from its
  // own center, never overwritten by a sub-tick sharing its anchor. Places the main tick's own
  // rect near the cursor (should land close to the maxScale=2.2 peak) while pushing every sub-tick
  // far away (well beyond radius=70, should read minScale=1). If updateScales() ever again wrote
  // sub-tick rects into the same map key in DOM order ("later overwrites earlier"), this would read
  // close to 1 instead of close to 2.2 and the assertion fails.
  it('a major tick\'s scale comes from its own center, not from a sub-tick sharing its anchor', async () => {
    const w = mountIt()
    const main0 = w.findAll('.tm-tick-main')[0].element as HTMLElement
    main0.getBoundingClientRect = () => fakeRect(100) // cursor at 105, distance ~5px: should be near peak
    for (const sub of w.findAll('.tm-tick-sub')) {
      (sub.element as HTMLElement).getBoundingClientRect = () => fakeRect(2000) // far beyond radius
    }

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    const m = style.match(/scaleX\(([\d.]+)\)/)
    const scale = m ? Number(m[1]) : 1
    expect(scale).toBeGreaterThan(2) // peak maxScale=2.2; if overwritten by a sub-tick it drops to minScale=1
  })

  it('multiple mousemoves within one frame request rAF only once (throttling)', async () => {
    const raf = vi.fn(() => 1)
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 20 })
    await w.find('.tm-rail').trigger('mousemove', { clientY: 30 })
    expect(raf).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending rAF on unmount', async () => {
    const caf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 77))
    vi.stubGlobal('cancelAnimationFrame', caf)
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 10 })
    w.unmount()
    expect(caf).toHaveBeenCalledWith(77)
  })

  it('loading: renders exactly 5 pulsing skeleton ticks, no real ticks', () => {
    const w = mountIt({ loading: true })
    expect(w.findAll('.tm-tick-skeleton')).toHaveLength(5)
    expect(w.findAll('.tm-tick-main')).toHaveLength(0)
    expect(w.findAll('.tm-tick-sub')).toHaveLength(0)
  })

  // Main ticks own data-flat-index; sub-ticks own the DIFFERENT data-anchor-index — the two must
  // never collide on the same attribute (the exact bug narrated in this file's own header
  // comment). Also confirms only main ticks are queried for fisheye scale computation.
  it('data-flat-index lives only on major ticks; sub-ticks carry a distinct data-anchor-index', () => {
    const w = mountIt()
    for (const sub of w.findAll('.tm-tick-sub')) {
      expect(sub.attributes('data-flat-index')).toBeUndefined()
      expect(sub.attributes('data-anchor-index')).toBeTruthy()
    }
    for (const main of w.findAll('.tm-tick-main')) {
      expect(main.attributes('data-flat-index')).toBeTruthy()
      expect(main.attributes('data-anchor-index')).toBeUndefined()
    }
  })

  // ── Auto-scroll selected tick into view (Vue2 parity, ported from the colleague's own fix) ──
  // B4 lesson (carried over from the colleague's own suite): these tests replace the global no-op
  // stub (vitest.setup.ts) with a per-test spy and must restore it afterward, or any later test in
  // this file would inherit a spy from an already-finished test.
  afterEach(() => { Element.prototype.scrollIntoView = () => {} })

  it('scrolls the newly selected tick into view when `current` changes', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy // jsdom does not implement scrollIntoView
    const w = mountIt({ snapshots: manySnapshots(), current: 's0' })
    spy.mockClear()
    await w.setProps({ current: 's40' })
    await nextTick()
    expect(spy).toHaveBeenCalled()
  })

  it('does not scroll when `current` did not change', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const w = mountIt({ snapshots: manySnapshots(), current: 's3' })
    spy.mockClear()
    await w.setProps({ snapshots: manySnapshots() })
    await nextTick()
    expect(spy).not.toHaveBeenCalled()
  })
})

function formatClock(snap: SnapshotVM): string {
  return formatSnapshotClockTime(snap.created_at)
}
