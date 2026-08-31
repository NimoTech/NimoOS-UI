// Topbar redo: PhotosTopbar.vue — the collapse button + title/subtitle block (always a
// whole-library count) + search box, all in one topbar. Structure mirrors Vue2
// PhotosTopbar.vue:1-34 (`.topbar` -> collapse icon-btn -> title block
// `.topbar-title`+`.topbar-sub` -> flex:1 centered `.search`). This pass narrows scope: it does
// not render the searchMode back button / upload button / Ask Nimo button (out of scope for
// this pass, deliberately not rendered yet).
//
// Subtitle = always the whole-library figure (same convention as the library branch in
// PhotosTimeline.vue:225-234):
// `t('photosCountSummary', { photos: store.photoCount.toLocaleString(), videos: store.videoCount.toLocaleString() })`,
// The component consumes the timeline store itself and does not accept `sub` as a prop —
// consistent with the intended interface
// (`<PhotosTopbar :collapsed @toggle-collapse @search-submit>`, no sub/title props).
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosTopbar from '../PhotosTopbar.vue'
import photosTopbarRaw from '../PhotosTopbar.vue?raw'
import { useTimelineStore } from '../../stores/timeline'
import { extractStyleBlock, parseCssRules } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountTopbar(props: Record<string, unknown> = {}) {
  return mount(PhotosTopbar, { props, global: { plugins: [i18n] } })
}

describe('structure', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders .topbar > collapse icon-btn + title block + centered search', () => {
    const w = mountTopbar()
    expect(w.find('.topbar').exists()).toBe(true)
    expect(w.find('.topbar .icon-btn').exists()).toBe(true)
    expect(w.find('.topbar-title').exists()).toBe(true)
    expect(w.find('.topbar-sub').exists()).toBe(true)
    expect(w.find('.topbar .search').exists()).toBe(true)
  })

  it('the collapse button icon is panelLeft (svg rect+path, matched character-for-character against Vue2 PhotosIcon.vue\'s panelLeft branch)', () => {
    const w = mountTopbar()
    const svg = w.get('.icon-btn svg')
    expect(svg.get('rect').attributes()).toMatchObject({ x: '3', y: '4', width: '18', height: '16', rx: '2' })
    expect(svg.get('path').attributes('d')).toBe('M9 4v16')
  })

  it('the title text is photosLibrary ("Photo Library")', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('the search box: search icon (matched character-for-character against Vue2 PhotosIcon.vue\'s search branch) + input + kbd hint', () => {
    const w = mountTopbar()
    const search = w.get('.search')
    expect(search.get('svg circle').attributes()).toMatchObject({ cx: '11', cy: '11', r: '7' })
    expect(search.get('svg path').attributes('d')).toBe('m20 20-3.5-3.5')
    expect(search.find('input').exists()).toBe(true)
    expect(search.get('.kbd').text()).toBe('↵')
  })

  it('the search box placeholder is the localized value of photosSearchSearchBarPlaceholder', () => {
    const w = mountTopbar()
    expect(w.get('.search input').attributes('placeholder')).toBe(zh.photosSearchSearchBarPlaceholder)
  })

  it('the collapse button title is photosToggleSidebar ("Toggle sidebar")', () => {
    const w = mountTopbar()
    expect(w.get('.icon-btn').attributes('title')).toBe(zh.photosToggleSidebar)
  })

  // The upload button / Ask Nimo button are deliberately not rendered yet (Vue2 :26-32).
  it('does not render the upload button / Ask Nimo button (out of scope for this pass)', () => {
    const w = mountTopbar()
    expect(w.find('.btn').exists()).toBe(false)
    expect(w.find('.btn-ai').exists()).toBe(false)
    expect(w.text()).not.toContain('Ask Nimo')
  })
})

describe('subtitle: always the whole-library count', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders photosCountSummary from store.photoCount/videoCount; without toLocaleString the numbers pass through as-is', async () => {
    const w = mountTopbar()
    const store = useTimelineStore()
    store.timelineGroups = [
      { year: 2026, month: 7, assets: [{ id: 'a', mimeType: 'image/jpeg', originalName: 'a.jpg' }] },
    ]
    await Promise.resolve()
    await w.vm.$nextTick()
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', String(store.photoCount)).replace('{videos}', String(store.videoCount)),
    )
  })

  // Thousands-separator anchor: toLocaleString inserts a separator once the number is >= 1000,
  // which proves the component actually calls it instead of concatenating the raw number
  // (formatting is required to go through toLocaleString).
  it('formats numbers >= 1000 with toLocaleString thousands separators (not the raw number concatenated)', async () => {
    const w = mountTopbar()
    const store = useTimelineStore()
    // In bucketMode, photoCount/videoCount are aggregated from buckets (BucketMeta: year/month/
    // count/videoCount, timelineBuckets.ts:7-12) — feeding buckets directly is closer to the
    // real whole-library count source (timeline.ts:131-145) than piling up a bunch of assets,
    // and it doesn't depend on legacy-branch details.
    store.buckets = [{ year: 2026, month: 7, count: 1234, videoCount: 234, ocrCount: 0 }]
    store.bucketMode = true
    await Promise.resolve()
    expect(store.photoCount).toBe(1000)
    expect(store.videoCount).toBe(234)
    expect(w.get('.topbar-sub').text()).toBe(
      zh.photosCountSummary.replace('{photos}', '1,000').replace('{videos}', '234'),
    )
  })
})

describe('collapse button emit', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('clicking the collapse button emits toggle-collapse', async () => {
    const w = mountTopbar()
    await w.get('.icon-btn').trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
  })
})

describe('search submit', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('Enter emits search-submit with the trimmed value', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('  sunset  ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toEqual([['sunset']])
  })

  // Overriding an earlier choice where an empty string also emitted: an empty Enter here is a
  // no-op, matching Vue2's own submitSearch (:65-69) empty-return guard.
  //
  // Update: PhotosSearchBar.vue — the component that used to carry the "empty string also
  // emits" convention — has been retired outright (no consumer left). PhotosSearch.vue's own
  // search page now shares THIS exact topbar box instead of rendering a separate input, so this
  // no-op-on-empty guard is no longer scoped to "just the timeline topbar" — it is this repo's
  // only search-box behavior everywhere, matching Vue2 1:1 (Vue2 likewise has only one search
  // box, shared by both the library and search "views"). The old PhotosSearchBar path where an
  // empty Enter emitted and returned the search page to its pre-search state is intentionally
  // gone with the retirement — an intended outcome of the topbar alignment work, not an
  // accidental loss.
  it('an empty-string Enter does not emit search-submit (matches Vue2\'s submitSearch empty-string guard)', async () => {
    const w = mountTopbar()
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })

  it('an all-whitespace Enter also does not emit (empty after trim)', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('   ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })
})

// Additive title/sub/showSearch prop overrides,
// used by the five re-shelled album/for-you pages (Vue2 truth: PhotosTimeline.vue mounts the
// SAME <PhotosTopbar> for every non-people/places/upload nav, PhotosTimeline.vue:957-971, just
// feeding it per-nav title/sub and show-search — it is not a library-exclusive component).
describe('title/sub/showSearch props (additional coverage)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('without title/sub, default behavior is unchanged (backward compatible with Photos.vue\'s existing usage)', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('passing title overrides the default photosLibrary text', () => {
    const w = mountTopbar({ title: zh.photosAlbumsTitle })
    expect(w.get('.topbar-title').text()).toBe(zh.photosAlbumsTitle)
  })

  it('passing sub overrides the default whole-library count subtitle', () => {
    const w = mountTopbar({ sub: '9 albums' })
    expect(w.get('.topbar-sub').text()).toBe('9 albums')
  })

  it('showSearch defaults to true, rendering the search box (backward compatible)', () => {
    const w = mountTopbar()
    expect(w.find('.search').exists()).toBe(true)
  })

  it('showSearch=false does not render the search box, but the centered wrapper is still there', () => {
    const w = mountTopbar({ showSearch: false })
    expect(w.find('.search').exists()).toBe(false)
    expect(w.find('.topbar-title').exists()).toBe(true)
  })
})

// PhotosPlaceAssets.vue needs a clean way to render "no subtitle at all" (Vue2 has no
// topbar/sub concept for that detail context — see that file's own header comment). Omitting
// `sub` doesn't do it: the computed `sub` falls back to the library-wide count summary (line
// 87-90 above), so an omitted prop on a non-library page would render a wrong, stray subtitle —
// a real regression vs. the old AreaShell shell (which had no subtitle at all there). The
// resolution: an explicit empty string is the opt-out — `sub=""` means "render no `.topbar-sub`
// node", distinct from omitting the prop (which still means "use the library default"). This is
// an additive contract on a shared photos-area component: every existing caller that never
// passes `sub=''` is unaffected.
describe('sub="" explicitly suppresses the subtitle (distinct in meaning from omitting sub)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('sub="" does not render the .topbar-sub node (an explicit opt-out, not "render the empty string as the text")', () => {
    const w = mountTopbar({ sub: '' })
    expect(w.find('.topbar-sub').exists()).toBe(false)
    // The title block itself is still there — only the subtitle line is suppressed, not the whole title block.
    expect(w.find('.topbar-title').exists()).toBe(true)
  })

  it('omitting sub entirely differs from an explicit empty string — it still falls back to the default whole-library count, and .topbar-sub renders as usual (library-page behavior is unaffected)', () => {
    const w = mountTopbar()
    expect(w.find('.topbar-sub').exists()).toBe(true)
    expect(w.get('.topbar-sub').text()).toBe(zh.photosCountSummary.replace('{photos}', '0').replace('{videos}', '0'))
  })
})

// The `back` prop had zero test coverage until now —
// every other prop added in that same round (title/sub/showSearch) got one, this one didn't.
// Mirrors Vue2 PhotosTopbar.vue:6-12's searchMode swap: `v-if="back"` renders a second icon-btn
// (chevL) in place of the title/sub block (`v-if="!back"`), emits `back` on click.
describe('back prop (additional coverage)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('when back is omitted, default behavior is unchanged: title/sub render, no back button appears', () => {
    const w = mountTopbar()
    expect(w.find('.topbar-title').exists()).toBe(true)
    expect(w.find('.topbar-sub').exists()).toBe(true)
    // Only one .icon-btn besides the collapse button (no second back button).
    expect(w.findAll('.icon-btn')).toHaveLength(1)
  })

  it('back=true renders the chevL back button (a second .icon-btn), suppressing title/sub', () => {
    const w = mountTopbar({ back: true })
    expect(w.find('.topbar-title').exists()).toBe(false)
    expect(w.find('.topbar-sub').exists()).toBe(false)
    const icons = w.findAll('.icon-btn')
    expect(icons).toHaveLength(2)
    // Matched character-for-character against Vue2 PhotosIcon.vue's chevL branch (SearchDatePopover.vue's
    // cal-nav "previous month" button already uses this same path, so there's precedent).
    expect(icons[1]!.get('path').attributes('d')).toBe('m15 6-6 6 6 6')
  })

  it('back=true: clicking the second .icon-btn emits back', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[1]!.trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('back=true: the back button\'s title is the localized value of photosSearchBackToLibrary', () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    expect(icons[1]!.attributes('title')).toBe(zh.photosSearchBackToLibrary)
  })

  it('back=true: the collapse button (first .icon-btn) still emits toggle-collapse as usual, unaffected by back', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[0]!.trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
    expect(w.emitted('back')).toBeUndefined()
  })
})

// Topbar alignment: PhotosSearch.vue retires its own in-page PhotosSearchBar.vue (no other
// consumer left, grep-confirmed) and instead makes THIS component's `.search` box the one
// editable input, echoing the route's `q` — mirrors Vue2 PhotosTopbar.vue's own `query` prop
// (:47-57: `data() { return { searchText: this.query } }` + a `query(v) { if (v !== this.searchText)
// this.searchText = v || '' }` watcher, the exact "don't clobber in-progress typing" guard
// PhotosSearchBar.vue's own `value` prop used to implement). `query` is additive and optional
// (default ''), so Photos.vue's existing no-props usage is unaffected.
describe('query prop (echo)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('without query, the input defaults to empty (backward compatible with Photos.vue\'s existing usage)', () => {
    const w = mountTopbar()
    expect((w.get('.search input').element as HTMLInputElement).value).toBe('')
  })

  it('passing query echoes it into the input value', () => {
    const w = mountTopbar({ query: 'sunset' })
    expect((w.get('.search input').element as HTMLInputElement).value).toBe('sunset')
  })

  it('changing the query prop updates the input accordingly', async () => {
    const w = mountTopbar({ query: 'a' })
    await w.setProps({ query: 'b' })
    expect((w.get('.search input').element as HTMLInputElement).value).toBe('b')
  })

  it('when the input already has user-typed text that differs from query, an unchanged query does not overwrite it (does not interrupt typing)', async () => {
    const w = mountTopbar({ query: 'a' })
    await w.get('.search input').setValue('user is typing')
    await w.setProps({ query: 'a' })
    expect((w.get('.search input').element as HTMLInputElement).value).toBe('user is typing')
  })
})

// Mirrors Vue2 PhotosTopbar.vue's own `searchMode(on) { if (on) ... focus() }` watcher (:60-62) —
// entering search focuses the box. New-UI's `back` prop is the routed equivalent of Vue2's
// `searchMode` (per that watcher's own header comment), and PhotosSearch.vue mounts with `back`
// already true (it's a dedicated route, not a toggled local flag), so the equivalent moment is
// `onMounted`, not a prop-change watcher.
describe('back=true auto-focuses the search box (matches Vue2\'s searchMode focus behavior)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('back=true: after mount, document.activeElement is the search box', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mount(PhotosTopbar, { props: { back: true }, global: { plugins: [i18n] }, attachTo: el })
    expect(document.activeElement).toBe(w.get('.search input').element)
    w.unmount()
    el.remove()
  })

  it('when back is omitted (defaults to false), it does not auto-focus', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const w = mount(PhotosTopbar, { global: { plugins: [i18n] }, attachTo: el })
    expect(document.activeElement).not.toBe(w.get('.search input').element)
    w.unmount()
    el.remove()
  })
})

// Additive `showAskNimo` prop (default false, non-breaking for the 5 existing
// library/albums/smart-views/people/places callers) + `ask-nimo` emit. Vue2 truth: the topbar
// Ask button is a labeled pill (`class="btn btn-ai"` + 18px `.nimo-orb` + visible "Ask Nimo"
// text, the Vue 2 panel's PhotosTopbar.vue:29-32) that opens the drawer directly, no prefill
// (per the baseline research report) — this component only emits, the caller
// (`useAskNimo().openDrawer()`) owns that behavior.
//
// Fix (critical): the first version used a novel `icon-btn btn-ai` combo with no text and
// a 16px orb — no precedent in either repo, and `.icon-btn` has no border so `.btn-ai`'s
// border-color was inert. Corrected to match Vue2 byte-for-byte: `btn btn-ai` + 18px orb +
// visible label, no title tooltip (Vue2 has none there since the label is visible).
describe('showAskNimo prop (additional coverage)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('does not render the Ask Nimo button by default (non-breaking for existing callers)', () => {
    const w = mountTopbar({ title: 'x' })
    expect(w.find('[data-test="topbar-ask-nimo"]').exists()).toBe(false)
  })

  it('renders it when showAskNimo is true, with Vue2\'s btn/btn-ai classes and visible label', () => {
    const w = mountTopbar({ title: 'x', showAskNimo: true })
    const btn = w.get('[data-test="topbar-ask-nimo"]')
    expect(btn.classes()).toContain('btn')
    expect(btn.classes()).toContain('btn-ai')
    expect(btn.text()).toBe(zh.photosAskNimo)
    expect(btn.get('.nimo-orb')).toBeTruthy()
  })

  it('emits ask-nimo on click', async () => {
    const w = mountTopbar({ title: 'x', showAskNimo: true })
    await w.find('[data-test="topbar-ask-nimo"]').trigger('click')
    expect(w.emitted('ask-nimo')).toBeTruthy()
  })
})

// Non-color visual-property anchor (a convention this file once shared with the now-retired
// PhotosSearchBar.test.ts): the only rule allowed to exist in the component's own scoped style
// is the search box's deliberate glass-look FILL deviation (chip-bg/chip-border) — no other
// visual property that Vue2 already provides in the parity scss (height/border-radius/size etc.
// should all be left to parity) may appear here.
describe('style: the scoped block is minimal (FILL deviation only)', () => {
  it('the .search rule only declares background/border-color (the FILL deviation), not duplicating the height/border-radius that parity already provides', () => {
    const style = extractStyleBlock(photosTopbarRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.search')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--chip-bg)')
    expect(rule?.body).toContain('border-color: var(--chip-border)')
    expect(rule?.body).not.toContain('height')
    expect(rule?.body).not.toContain('border-radius')
  })
})
