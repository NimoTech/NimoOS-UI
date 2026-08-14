// SP7-P7b-T2: PhotosFilterBar.vue — funnel + three-capsule EXIF filter bar.
// Reference source: Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue (312 lines).
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

// Fix round 1 (review required): don't create a separate createI18n(...) instance here —
// reason same as comment at top of PhotosToolbar.test.ts: vitest.setup.ts already injects
// src/i18n singleton into config.global.plugins; passing another instance explicitly gets
// concatenated into the same app, triggering vue-i18n install() duplicate component/directive
// registration warning (default reporter hides stderr of passing tests, only visible with
// --reporter=verbose). Use the globally-set instance directly; locale defaults to zh_cn.
// Fix round (final review suggestion with M4): before, `attachTo: document.body` relied only on
// `document.body.innerHTML = ''` in afterEach to clean up — but component's "click outside to
// close popover" listener is attached to `document` (addEventListener('mousedown', ...) in
// PhotosFilterBar.vue watch(openPop)), clearing body doesn't detach listeners on document.
// So a mousedown listener from a previous test persists through later tests in this file —
// harmless today (the stale instance's rootRef is gone after body cleared, el.contains() always
// false), but the "click outside to close" test's document.dispatchEvent actually hits a series
// of zombie listeners. Collect wrappers from each mountBar() call and unmount them all in
// afterEach — properly invoke component's onBeforeUnmount to detach document listeners, not
// just clear the DOM.
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
  // One test (see "after unmount, no lingering document listener" in "click outside to close"
  // describe) unmounts early itself to assert removeEventListener was called — unmounting again
  // here is safe (Vue 3's app.unmount() early-exits on already-unmounted instance, no error,
  // no repeated side effects).
  for (const w of wrappers) w.unmount()
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('structure and expand', () => {
  it('default collapsed: .exif-filter has no expanded class, funnel has no .on, no badge', () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    expect(w.get('.exif-funnel').classes()).not.toContain('on')
    expect(w.find('[data-test="exif-badge"]').exists()).toBe(false)
  })

  it('click funnel to expand: add expanded class, add ov class (overflow release) after 450ms', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-filter').classes()).not.toContain('ov')
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('click funnel again to collapse: remove expanded/ov simultaneously, close any open popover', async () => {
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

  it('if filter value present at mount → auto-expand, funnel gets .on, badge shows total', async () => {
    // Final review M6 (comment only, no logic change): the "auto-expand" in the test name is
    // actually two paths combined — the initial value of `expanded` is already synced from
    // `anyActive.value` (props already in place at mount moment, component header comment
    // "deviation record 5" already documents this design), so the `.expanded` class exists by
    // mount completion, not triggered by the `if (anyActive.value) expand()` branch in
    // onMounted — props cannot change anyActive between ref init and onMounted, that branch
    // in "mounted with filter" scenario always takes the path "assign the already-true value
    // again", never reaches a new state. The real meaning of that onMounted call is its
    // side effect (reschedule the 450ms overflow timer), and the `vi.advanceTimersByTime(450)`
    // assertion below verifies exactly that side effect, not the "expand" state itself.
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
    expect(w.get('.exif-funnel').classes()).toContain('on')
    expect(w.get('[data-test="exif-badge"]').text()).toBe('2')
    // Fix round 1 (review required 2): the easiest regression to miss on this mount-and-expand
    // path is "sync-init expanded but forget to reschedule 450ms overflow timer in onMounted",
    // then popover gets permanently clipped by .exif-chiprow's overflow:hidden (.ov class
    // never appears). Add assertion here: .ov class really appears after 450ms, pin down this
    // timer side effect.
    vi.advanceTimersByTime(450)
    await w.vm.$nextTick()
    expect(w.get('.exif-filter').classes()).toContain('ov')
  })

  it('filter value changes from none to some (external prop write) → auto-expand', async () => {
    const w = mountBar()
    expect(w.get('.exif-filter').classes()).not.toContain('expanded')
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.get('.exif-filter').classes()).toContain('expanded')
  })
})

describe('facet extraction', () => {
  it('years descending deduped; F1: unparseable dates do not produce NaN option', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    const items = w.findAll('.fpop .nav-item').map(n => n.text())
    expect(items).toEqual(['2023', '2022'])
    expect(items).not.toContain('NaN')
  })

  it('place: take before comma; camera: take before "·"; each dedupe and sort by localeCompare ascending', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Osaka', 'Tokyo'])
    await w.get('[data-test="exif-chip-places"] .fchip').trigger('click') // close
    await w.get('[data-test="exif-chip-cameras"] .fchip').trigger('click')
    expect(w.findAll('.fpop .nav-item').map(n => n.text())).toEqual(['Canon R6', 'Sony A7'])
  })
})

describe('draft / submit / clear', () => {
  it('checking in popover doesn\'t take effect immediately, only emit update:filter on submit button click', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    await w.get('.fpop .btn-primary').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: ['2023'], places: [], cameras: [] })
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('click cancel: discard draft, close popover, don\'t emit', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click')
    await w.get('.fpop .fpop-quick').trigger('click')
    expect(w.emitted('update:filter')).toBeUndefined()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('reopening popover: draft re-snapshots from last submitted value (cancelled checks don\'t persist)', async () => {
    const w = mountBar({ filter: { years: ['2022'], places: [], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    await w.findAll('.fpop .nav-item')[0].trigger('click') // check 2023
    await w.get('.fpop .fpop-quick').trigger('click') // cancel
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click') // reopen
    const actives = w.findAll('.fpop .nav-item').filter(n => n.attributes('data-active') === 'true')
    expect(actives.map(n => n.text())).toEqual(['2022'])
  })

  it('× on capsule clears that dimension; "clear all" clears all three dimensions and closes popover', async () => {
    const w = mountBar({ filter: { years: ['2023'], places: ['Tokyo'], cameras: [] } })
    await w.get('[data-test="exif-chip-years"] .fchip-x').trigger('click')
    expect(w.emitted('update:filter')![0][0]).toEqual({ years: [], places: ['Tokyo'], cameras: [] })
    await w.get('[data-test="exif-clear-all"]').trigger('click')
    expect(w.emitted('update:filter')![1][0]).toEqual({ years: [], places: [], cameras: [] })
  })

  it('capsule label: no value shows dimension name, has value shows comma-joined values', () => {
    const w = mountBar({ filter: { years: ['2023', '2022'], places: [], cameras: [] } })
    expect(w.get('[data-test="exif-chip-years"] .fchip').text()).toContain('2023, 2022')
    expect(w.get('[data-test="exif-chip-places"] .fchip').text()).toContain('位置')
  })

  it('"clear all" only appears when there are filters', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(false)
    await w.setProps({ filter: { years: ['2023'], places: [], cameras: [] } })
    expect(w.find('[data-test="exif-clear-all"]').exists()).toBe(true)
  })
})

describe('popover close and chipKeys', () => {
  it('mousedown outside component closes popover; inside component does not', async () => {
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    expect(w.find('.fpop').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.fpop').exists()).toBe(false)
  })

  it('after unmount, no lingering document listener (no error)', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const w = mountBar()
    await w.get('[data-test="exif-funnel"]').trigger('click')
    await w.get('[data-test="exif-chip-years"] .fchip').trigger('click')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function))
  })

  it('D19: when chipKeys has only years+cameras, don\'t render place capsule, badge counts only visible dimensions', () => {
    const w = mountBar({
      chipKeys: ['years', 'cameras'],
      filter: { years: ['2023'], places: ['Tokyo'], cameras: [] },
    })
    expect(w.find('[data-test="exif-chip-places"]').exists()).toBe(false)
    expect(w.find('[data-test="exif-chip-years"]').exists()).toBe(true)
    expect(w.find('[data-test="exif-chip-cameras"]').exists()).toBe(true)
    expect(w.get('[data-test="exif-badge"]').text()).toBe('1')
  })

  it('place popover empty state says "no location data", others say "no content"', async () => {
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
  // Deviation record (disposition step 1 conclusion): brief original text says
  // `winningHoverBackground(rules, ['exif-funnel', 'on'])` where `rules` comes from
  // `parseCssRules(...)`. But cssCascade.ts's real signature is
  // `winningHoverBackground(styleText: string, classes: string[]): HoverBgRule` —
  // first param is raw style text, not parsed rule array; return is { selector, specificity,
  // value, order } object, can't directly toBe a string. Follow actual usage in
  // PhotosFilterChip.test.ts:108-114: pass extractStyleBlock result, assert winner.value.
  // Pass classes as ['exif-funnel', 'on'] not just ['exif-funnel']: the `.on` class in the
  // variant selector `.exif-funnel.on:hover` must also be in the whitelist, else
  // hoverBackgroundRules judges the variant rule as "hits a class outside whitelist" and
  // excludes it, leaving only base :hover rule visible, then test can't prove "whether base
  // overrides variant".
  it('.exif-funnel.on hover background not overridden by base class .exif-funnel:hover', () => {
    // Final review M3 (comment only, no logic change): this assertion is weaker than the title
    // sounds — it only verifies "winner rule's selector contains :hover and on, value is the
    // expected token", doesn't directly compare base `.exif-funnel:hover` rule's specificity
    // and assert the precise causality "variant wins because of source order" (the "tied,
    // surviving on source order" line in component CSS comment). Current assertion is enough
    // to turn red if base overrides variant (then winner becomes base rule, value no longer
    // --accent-soft), just doesn't explicitly pin down the "why wins" mechanism.
    const style = extractStyleBlock(barRaw)
    const winner = winningHoverBackground(style, ['exif-funnel', 'on'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('on')
    expect(winner.value).toBe('var(--accent-soft)')
  })
})
