// PhotosFilterBar.vue — funnel + three-pill EXIF filter bar.
// Reference source: the Vue 2 panel's src/views/Photos/PhotosFilterBar.vue (312 lines).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosFilterBar from '../PhotosFilterBar.vue'
import barRaw from '../PhotosFilterBar.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const PHOTOS = [
  { date: 'May 1, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 35mm' },
  { date: 'March 2, 2022', place: 'Osaka, Japan', camera: 'Canon R6 · 50mm' },
  { date: 'July 9, 2023', place: 'Tokyo, Japan', camera: 'Sony A7 · 85mm' },
  { date: 'not-a-date', place: '', camera: null },
]

const empty = () => ({ years: [] as string[], places: [] as string[], cameras: [] as string[] })

// fix round 1 (review-mandatory 1): don't set up another createI18n(...) instance here — same reasoning as the
// matching comment at the top of PhotosToolbar.test.ts: vitest.setup.ts already installs the src/i18n singleton into
// config.global.plugins for every mount, and explicitly passing another instance would get spliced into the same app,
// triggering vue-i18n install()'s duplicate-component/directive registration warning (the default reporter hides
// stderr from passing tests, only --reporter=verbose shows it). Just consume the globally installed one directly —
// its locale defaults to zh_cn.
// fix round (whole-phase final review suggested folding in M4): before `attachTo: document.body`, cleanup relied only
// on afterEach's `document.body.innerHTML = ''` — but the component's close-popover-on-outside-click listener is
// attached to `document` (PhotosFilterBar.vue's watch(openPop), addEventListener('mousedown', ...)); clearing body
// doesn't detach a listener attached to document. So a mousedown listener left over from a previous test case stays
// alive across later test cases in this same file — harmless today (the leftover instance's rootRef has already been
// removed along with the cleared body, so el.contains() is always false), but the "close popover on click outside the
// component" test case's document.dispatchEvent is effectively landing on a whole string of zombie listeners too.
// Here, every wrapper produced by mountBar() is collected and afterEach unmounts them all — this actually invokes the
// component's onBeforeUnmount to detach the document listener, instead of only clearing the DOM.
const wrappers: ReturnType<typeof mount>[] = []
function mountBar(props: Record<string, unknown> = {}) {
  const w = mount(PhotosFilterBar, {
    props: { filter: empty(), photos: PHOTOS, ...props },
    attachTo: document.body,
  })
  wrappers.push(w)
  return w
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  // One test case (see "close popover on document mousedown outside the component" describe block's "no lingering
  // document listener after unmount" case) unmounts early on its own to assert removeEventListener was called —
  // unmounting again here is a safe no-op (Vue 3's app.unmount() returns early for an already-unmounted instance,
  // doesn't throw, and doesn't re-trigger side effects).
  for (const w of wrappers) w.unmount()
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('structure and expand/collapse', () => {
  it('collapsed by default: .exif-filter has no expanded class, funnel has no .on, no badge', () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-funnel').classes()).not.toContain('on')
    expect(w.find('[data-test="exif-badge"]').exists()).toBe(false)
  })

  it('clicking the funnel expands: adds the expanded class, the ov class (overflow released) is added only after 450ms', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('clicking the funnel again collapses: expanded/ov are both removed at once, any open popover is closed', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('a filter value already set at mount time -> auto-expands, funnel carries .on, badge shows the total count', async () => {
    // Whole-phase final review M6 (comment only, no logic change): what this test case name calls "auto-expand" is
    // actually two overlapping paths — `expanded`'s initial value is itself synchronously derived from
    // `anyActive.value` (props are already in place the instant mounting happens, top-of-component comment
    // "deviation log 5" already records this design), so by the time mount() finishes the `.expanded` class already
    // exists — it isn't triggered by onMounted's `if (anyActive.value) expand()` branch — props can't change the
    // value of anyActive between ref initialization and onMounted, so in this "a filter value is already set at
    // mount time" scenario that branch is always just "re-assigning a value that's already true", it can never reach
    // a new state. What onMounted's call actually contributes is its side effect (re-arming the 450ms overflow
    // timer) — the `vi.advanceTimersByTime(450)` assertion below is exactly verifying that side effect, not the
    // "expanded" state itself.
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-funnel').classes()).toContain('on')
    expect(w.get('[data-test="exif-badge"]').text()).toBe('2')
    // fix round 1 (review-mandatory 2): the regression easiest to miss on the "already expanded at mount" path is
    // "synchronously initializing expanded but forgetting to also re-arm the 450ms overflow timer in onMounted" —
    // in that case the popover would be permanently clipped by .exif-chiprow's overflow:hidden (the .ov class would
    // never appear). This adds an assertion that the .ov class does appear after 450ms, pinning down that timer
    // side effect.
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('filter value goes from empty to populated (written externally) -> auto-expands', async () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
  })
})

describe('popover max-height 260 (another Vue2 value outside of D19, noted at the top of PhotosFilterPopover.vue)', () => {
  it('opening any pill\'s popover -> .fpop-list inline style is 260px, not the primitive default of 280px', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.get('.fpop-list').attributes('style')).toContain('max-height: 260px')
  })
})

describe('facet values', () => {
  it('years reverse-sorted and deduped; F1: an unparseable date does not produce a NaN option', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    const items = w.findAll('.fpop .fpop-item').map(n => n.text())
    expect(items).toEqual(['2023', '2022'])
    expect(items).not.toContain('NaN')
  })

  it('location takes the segment before the comma, camera takes the segment before "·", each deduped and localeCompare-ascending', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.findAll('.fpop .fpop-item').map(n => n.text())).toEqual(['Osaka', 'Tokyo'])
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click') // close it
    await w.get('[data-test="exif-chip-cameras"] .fchip').trigger('click')
    expect(w.findAll('.fpop .fpop-item').map(n => n.text())).toEqual(['Canon R6', 'Sony A7'])
  })
})

describe('draft / apply / clear', () => {
  it('checking an item in the popover does not take effect immediately, only clicking "Apply" emits update:filter', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .fpop-item')[0].trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    await w.get('.fpop .btn-primary').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: ['2023'], places: [], cameras: [] })
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('clicking "Cancel" discards the draft, closes the popover, does not emit', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .fpop-item')[0].trigger('click')
    await w.get('.fpop .fpop-quick').trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('reopening the popover re-snapshots the draft from the last committed value (a previously-cancelled check does not linger)', async () => {
    const w = mountBar({ filter: { years: ['2022'], places: [], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .fpop-item')[0].trigger('click') // check 2023
    await w.get('.fpop .fpop-quick').trigger('click') // cancel
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click') // reopen
    const actives = w.findAll('.fpop .fpop-item').filter(n => n.attributes('data-active') === 'true')
    expect(actives.map(n => n.text())).toEqual(['2022'])
  })

  it('the × on a pill clears that dimension; "Clear all" clears all three dimensions and closes the popover', async () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip-x').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: [], places: ['Tokyo'], cameras: [] })
    await w.get('[data-test="exif-clear-all"]').trigger('click')
    expect(w.emitted('update:filter')![1][0]).toEqual({ years: [], places: [], cameras: [] })
  })

  it('pill label: shows the dimension name when empty, shows the comma-joined values when set', () => {
    const w = mountBar({ filter: { years: ['2023', '2022'], places: [], cameras: [] } })
    expect(w.get('[data-test="exif-chip-years"] .fchip').text()).toContain('2023, 2022')
    expect(w.get('[data-test="exif-chip-places"] .fchip').text()).toContain('位置')
  })

  it('"Clear all" only appears when a filter is set', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(false)
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(true)
  })
})

describe('popover closing and chipKeys', () => {
  it('mousedown outside the component closes the popover; mousedown inside it does not', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('no lingering document listener after unmount (does not throw)', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('D19: when chipKeys only supplies years+cameras, the location pill is not rendered, the badge only counts visible dimensions', () => {
    const w = mountBar({
      chipKeys: ['years', 'cameras'],
      filter: { years: ['2023'], places: ['Tokyo'], cameras: [] },
    })
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    expect(w.find('[data-test="exif-chip-years"]').exists()).toBe(true)
    expect(w.find('[data-test="exif-chip-cameras"]').exists()).toBe(true)
    expect(w.get('[data-test="exif-badge"]').text()).toBe('1')
  })

  it('the location popover\'s empty state uses "暂无位置数据", the others use "暂无内容"', async () => {
    const w = mountBar({ photos: [] })
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无位置数据')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.get('.fpop-empty').text()).toBe('暂无内容')
  })
})

describe('hover specificity hard constraint', () => {
  // Deviation log (the conclusion from step 1 of the resolution order): the brief text literally said
  // `winningHoverBackground(rules, ['exif-funnel', 'on'])`, where `rules` came from `parseCssRules(...)`. But
  // cssCascade.ts's real signature is `winningHoverBackground(styleText: string, classes: string[]): HoverBgRule` —
  // the first argument is the raw style text, not an already-parsed rule array; the return value is an object
  // { selector, specificity, value, order }, which can't be toBe'd directly against a string. Corrected to match the
  // real usage in PhotosFilterChip.test.ts:108-114 — pass the result of extractStyleBlock, assert on winner.value.
  // classes passes ['exif-funnel', 'on'] rather than just ['exif-funnel']: the `.on` class in the variant selector
  // `.exif-funnel.on:hover` must also be in the allowlist, otherwise hoverBackgroundRules would judge that variant
  // rule as "matching a class outside the allowlist" and exclude it, leaving only the base class's :hover rule
  // visible, and the test would then fail to exercise "does the base class beat the variant".
  it('.exif-funnel.on\'s hover background is not beaten by the base class .exif-funnel:hover', () => {
    // Whole-phase final review M3 (comment only, no logic change): this assertion is weaker than the title reads —
    // it only verifies that the winning rule's selector contains :hover and on, and that its value is the expected
    // token, without directly computing the base class `.exif-funnel:hover` rule's specificity alongside it and
    // asserting the more precise causal chain "the variant wins on source order" (the "a tie, surviving only by
    // source order" line from the component's CSS comment). The current assertion is enough to turn red if the base
    // class beats the variant (the winner would then become the base class rule, and value would no longer be
    // --accent-soft), it just doesn't pin down explicitly *why* it wins.
    const style = extractStyleBlock(barRaw)
    const winner = winningHoverBackground(style, ['exif-funnel', 'on'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('on')
    expect(winner.value).toBe('var(--accent-soft)')
  })
})
