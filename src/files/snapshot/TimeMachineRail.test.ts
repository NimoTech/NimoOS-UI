import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Build a fake DOMRect filling only the top/height fields the component uses; the rest are 0
// placeholders to satisfy the type.
const fakeRect = (top: number, height = 10): DOMRect =>
  ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

// fisheyeDisplacement (timeMachineMath.ts)
// requires its own `centers` input sorted ascending (top to bottom) -- see that function's own
// header comment for why (the running trapezoidal walk is stateful across array order, not sorted
// by value). In a real browser this holds automatically (DOM/query order == render order == top-
// to-bottom Y), but a jsdom test that only mocks SOME elements' rects (leaving the rest at jsdom's
// own always-(0,0,0,0) default) can easily violate it by accident -- this helper mocks EVERY main
// tick's rect at once, in the SAME order they render (`w.findAll('.tm-tick-main')`), so every
// fisheye-driven test below has a fully self-consistent, sorted fixture instead of a partial one.
function mockMainRects(w: ReturnType<typeof mountIt>, tops: number[]): void {
  const mains = w.findAll('.tm-tick-main')
  expect(mains).toHaveLength(tops.length)
  tops.forEach((top, i) => { (mains[i].element as HTMLElement).getBoundingClientRect = () => fakeRect(top) })
}

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

  // This REPLACES an earlier
  // "resting labels always visible" test -- that rule is explicitly superseded once the rail
  // stopped scrolling (see TimeMachineRail.vue's own header comment, point 4, and
  // shouldShowTickLabel's own comment in timeMachineMath.ts for the full override). In jsdom,
  // `bandHeight` never gets measured (no ResizeObserver callback ever fires -- jsdom has no
  // ResizeObserver at all), so `shouldShowTickLabel`'s own "unmeasured -- fail open" branch is what
  // is actually being exercised here: every label still shows, but for a DIFFERENT reason than
  // the earlier unconditional rule (which no longer exists). The "genuinely crowded, hide it" branch
  // is covered exhaustively at the pure-function level (timeMachineMath.test.ts) -- there is no
  // practical way to force jsdom to report a real, small `clientHeight` for this component's own
  // ResizeObserver-driven measurement.
  it('shows every major tick\'s time label in the (jsdom) unmeasured-band default (shouldShowTickLabel fails open)', () => {
    const w = mountIt()
    const labels = w.findAll('.tm-tick-label')
    expect(labels).toHaveLength(3)
    expect(labels.map((l) => l.text())).toContain(formatClock(SNAPSHOTS[0]))
  })

  it('the current selection\'s label is present even for a tick that is neither the first main tick nor obviously "roomy"', () => {
    const w = mountIt({ current: 's-yesterday' })
    const selected = w.findAll('.tm-tick-main').find((n) => n.attributes('data-flat-index') === 's-yesterday')!
    expect(selected.find('.tm-tick-label').exists()).toBe(true)
  })

  // Sub-ticks have no Vue2 counterpart, so they carry no label of their own -- only main ticks do.
  it('does not render a label on decorative sub-ticks', () => {
    const w = mountIt()
    for (const sub of w.findAll('.tm-tick-sub')) {
      expect(sub.find('.tm-tick-label').exists()).toBe(false)
    }
  })

  it('on mouse move, writes a translateY+scale transform onto ticks', async () => {
    const w = mountIt()
    // jsdom's getBoundingClientRect is always 0 here unless mocked; this only asserts a transform
    // was written after mousemove. The curve itself is covered by timeMachineMath.test.ts's own
    // fisheyeDisplacement suite; "closer means larger/more displaced" is covered by the non-hollow
    // case below.
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    expect(style).toContain('translateY(')
    expect(style).toContain('scale(')
    expect(style).not.toContain('scaleX(')
  })

  it('scale/displacement resets once the mouse leaves the rail', async () => {
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    await w.find('.tm-rail').trigger('mouseleave')
    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    expect(style).not.toContain('scale(2')
    expect(style).toBe('')
  })

  // ── Per-type tick class hook + manual badge, restored ──
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
    const styleBlock = railStyleBlock()
    expect(styleBlock).toMatch(/:hover[\s\S]*?--tm-rail-tick-hover/)
    expect(styleBlock).toContain('--tm-rail-tick-manual')
    expect(styleBlock).toContain('.tm-tick-badge')
  })

  // The selected tick's own resting width/glow-blur literals must match Vue2's
  // `.tm-tick--selected .tm-tick__line` exactly (width: 40px, box-shadow blur: 10px) -- same
  // source-text hook-presence technique as the hover-token test above, for the same reason (jsdom
  // applies no CSS at all, so a `.is-selected` class assertion alone cannot tell "styled 40px wide"
  // apart from "styled 26px wide", and there is no inline/computed style to read here since this is
  // a real CSS rule, not a bound `:style`).
  it('the selected tick\'s own ::after rule pins Vue2\'s literal 40px width and 10px glow blur', () => {
    const styleBlock = railStyleBlock()
    const selectedAfterRule = /\.tm-tick-main\.is-selected::after\s*\{([^}]*)\}/.exec(styleBlock)
    expect(selectedAfterRule, 'no .tm-tick-main.is-selected::after rule found').toBeTruthy()
    expect(selectedAfterRule![1]).toContain('width: 40px')
    expect(selectedAfterRule![1]).toContain('box-shadow: 0 0 10px var(--tm-accent-glow)')
  })

  it('renders no ticks and no error with an empty snapshot list', () => {
    const w = mountIt({ snapshots: [] })
    expect(w.findAll('.tm-tick-main')).toHaveLength(0)
    expect(w.findAll('.tm-rail-day')).toHaveLength(0)
  })

  // ↓ Non-hollow strengthening: the plain "contains scale/translateY" case above would pass even
  // for a hollow implementation that always returns the same values. Here every main tick's own
  // getBoundingClientRect is mocked (sorted ascending, see mockMainRects's own comment) to create
  // real, differing cursor distances, and the tick closer to the cursor must scale LARGER and be
  // displaced FARTHER than one outside the fisheye's own radius.
  it('(non-hollow) real distance differences produce real scale AND displacement differences, closer is larger/more displaced', async () => {
    const w = mountIt()
    mockMainRects(w, [100, 1000, 2000]) // near / far / far, cursor lands near the first

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const mains = w.findAll('.tm-tick-main')
    const near = mains[0].attributes('style') ?? ''
    const far = mains[1].attributes('style') ?? ''
    const scaleOf = (style: string) => Number(/scale\(([\d.]+)\)/.exec(style)?.[1] ?? 1)
    const offsetOf = (style: string) => Number(/translateY\(([-\d.]+)px\)/.exec(style)?.[1] ?? 0)
    expect(scaleOf(near)).toBeGreaterThan(scaleOf(far))
    // The far tick sits 1000-105=895px from the cursor, well beyond the 70px radius -- fisheye
    // must not displace it at all.
    expect(offsetOf(far)).toBe(0)
    expect(scaleOf(far)).toBe(1)
  })

  // ↓ Regression case for the exact bug this component's own data-attribute split guards against
  // (see TimeMachineRail.vue's own header comment): a main tick's scale must be computed from its
  // own center, never overwritten by a sub-tick sharing its anchor. Places the main tick's own
  // rect near the cursor (should land close to the maxScale=2.2 peak) while every OTHER main tick
  // (and every sub-tick) sits far away, well beyond radius=70.
  it('a major tick\'s scale comes from its own center, not from a sub-tick sharing its anchor', async () => {
    const w = mountIt()
    mockMainRects(w, [100, 1000, 2000]) // main0 near the cursor; main1/main2 far, sorted ascending
    for (const sub of w.findAll('.tm-tick-sub')) {
      (sub.element as HTMLElement).getBoundingClientRect = () => fakeRect(5000) // far beyond radius, irrelevant either way (excluded from the fisheye query)
    }

    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const style = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    const scale = Number(/scale\(([\d.]+)\)/.exec(style)?.[1] ?? 1)
    expect(scale).toBeGreaterThan(2) // peak maxScale=2.2; if overwritten by a sub-tick it drops to minScale=1
  })

  // Sub-ticks must reuse their anchor main tick's OFFSET too, not just its scale --
  // otherwise a displaced main tick would visually separate from the decorative filler ticks
  // sitting right next to it, an obvious "these two pieces of the same line are no longer aligned"
  // glitch.
  it('a sub-tick\'s displacement matches its anchor main tick\'s own displacement exactly', async () => {
    const w = mountIt()
    mockMainRects(w, [100, 1000, 2000])
    await w.find('.tm-rail').trigger('mousemove', { clientY: 105 })

    const mainStyle = w.findAll('.tm-tick-main')[0].attributes('style') ?? ''
    const anchorName = w.findAll('.tm-tick-main')[0].attributes('data-flat-index')
    const sub = w.findAll('.tm-tick-sub').find((n) => n.attributes('data-anchor-index') === anchorName)!
    expect(sub.attributes('style')).toBe(mainStyle)
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
  // comment). Also confirms only main ticks are queried for fisheye computation.
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

  // ── Fixed extent, no scroll ──
  // The old "auto-scroll selected tick into view" behavior (and its own two tests) is GONE
  // entirely -- see TimeMachineRail.vue's own header comment, point 1: the rail is now a fixed
  // [top, bottom] band that never scrolls, so there is no scroll position left to correct. This
  // block instead pins the STRUCTURAL absence of scrolling and the presence of the new
  // fixed-extent/space-between layout, source-text hook-presence checks (same technique this
  // file's own hover-token test above already uses) since jsdom applies no real CSS/layout.
  it('declares no scrolling anywhere (no overflow-y:auto, no scrollbar-width) and no scrollIntoView call site', () => {
    // Comments (this file's own history/rationale prose) are allowed to still mention the retired
    // declarations BY NAME -- stripped here (same technique tmTokens.test.ts's own stripComments
    // uses) so only a LIVE declaration would fail this check, not the prose explaining why it is
    // gone.
    const codeOnly = railStyleBlock().replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(codeOnly).not.toMatch(/overflow-y\s*:\s*auto/)
    expect(codeOnly).not.toMatch(/scrollbar-width\s*:/)
    // A real CALL (`.scrollIntoView(`) would be the regression -- the bare word still appears in
    // this file's own header-comment prose explaining that it was removed, which must stay legal.
    expect(railSource()).not.toContain('.scrollIntoView(')
  })

  it('distributes all rail nodes evenly across the fixed band via justify-content: space-between (no JS positioning needed)', () => {
    const styleBlock = railStyleBlock()
    const trackRule = /\.tm-rail-track\s*\{([^}]*)\}/.exec(styleBlock)
    expect(trackRule, 'no .tm-rail-track rule found').toBeTruthy()
    expect(trackRule![1]).toMatch(/justify-content\s*:\s*space-between/)
  })

  it('`.tm-rail`\'s own fixed top/bottom band declarations are present (no longer natural document flow)', () => {
    const styleBlock = railStyleBlock()
    const railRule = /(?:^|\n)\.tm-rail\s*\{([^}]*)\}/.exec(styleBlock)
    expect(railRule, 'no .tm-rail rule found').toBeTruthy()
    expect(railRule![1]).toMatch(/top\s*:\s*68px/)
    expect(railRule![1]).toMatch(/bottom\s*:\s*80px/)
  })
})

function formatClock(snap: SnapshotVM): string {
  return formatSnapshotClockTime(snap.created_at)
}

function railSource(): string {
  return readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), './TimeMachineRail.vue'), 'utf8')
}

function railStyleBlock(): string {
  return /<style[^>]*>([\s\S]*?)<\/style>/.exec(railSource())![1]
}
