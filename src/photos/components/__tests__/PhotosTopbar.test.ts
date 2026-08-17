// Task 4 (topbar rework, D13): PhotosTopbar.vue — a topbar combining the collapse
// button + title/subline (always whole-library count) + search box. Structure maps to
// Vue2 PhotosTopbar.vue:1-34 (`.topbar` → collapse icon-btn → title block
// `.topbar-title`+`.topbar-sub` → flex:1 centered `.search`), scope narrowed for Phase B:
// does not render the searchMode back button / upload button / Ask Nimo button (the brief
// explicitly states "not rendered in Phase B").
//
// The subline always uses the whole-library count (same as PhotosTimeline.vue:225-234's
// library branch):
// `t('photosCountSummary', { photos: store.photoCount.toLocaleString(), videos: store.videoCount.toLocaleString() })`,
// the component consumes the timeline store itself and does not accept sub as a prop —
// consistent with the brief's Produces interface skeleton
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

  it('the collapse button icon is panelLeft (svg rect+path, matches Vue2 PhotosIcon.vue panelLeft branch character-for-character)', () => {
    const w = mountTopbar()
    const svg = w.get('.icon-btn svg')
    expect(svg.get('rect').attributes()).toMatchObject({ x: '3', y: '4', width: '18', height: '16', rx: '2' })
    expect(svg.get('path').attributes('d')).toBe('M9 4v16')
  })

  it('title text is photosLibrary ("照片库")', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('search box: search icon (character-for-character match to Vue2 PhotosIcon.vue search branch) + input + kbd hint', () => {
    const w = mountTopbar()
    const search = w.get('.search')
    expect(search.get('svg circle').attributes()).toMatchObject({ cx: '11', cy: '11', r: '7' })
    expect(search.get('svg path').attributes('d')).toBe('m20 20-3.5-3.5')
    expect(search.find('input').exists()).toBe(true)
    expect(search.get('.kbd').text()).toBe('↵')
  })

  it('search box placeholder is the localized value of photosSearchSearchBarPlaceholder', () => {
    const w = mountTopbar()
    expect(w.get('.search input').attributes('placeholder')).toBe(zh.photosSearchSearchBarPlaceholder)
  })

  it('collapse button title is photosToggleSidebar ("切换侧边栏")', () => {
    const w = mountTopbar()
    expect(w.get('.icon-btn').attributes('title')).toBe(zh.photosToggleSidebar)
  })

  // The brief explicitly states upload button / Ask Nimo button are not rendered in Phase B (Vue2 :26-32).
  it('does not render upload button / Ask Nimo button (Phase B scope narrowed)', () => {
    const w = mountTopbar()
    expect(w.find('.btn').exists()).toBe(false)
    expect(w.find('.btn-ai').exists()).toBe(false)
    expect(w.text()).not.toContain('Ask Nimo')
  })
})

describe('subline: always whole-library count', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders photosCountSummary from store.photoCount/videoCount, numbers as-is below the toLocaleString threshold', async () => {
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

  // Thousands-separator pin: toLocaleString inserts a separator once the number is >= 1000,
  // verifying the component actually calls it rather than concatenating the raw number
  // directly (the brief explicitly requires "with toLocaleString").
  it('formats with toLocaleString thousands separators when the number is >= 1000 (not the raw number concatenated directly)', async () => {
    const w = mountTopbar()
    const store = useTimelineStore()
    // Under the bucketMode branch, photoCount/videoCount are aggregated from buckets
    // (BucketMeta: year/month/count/videoCount, timelineBuckets.ts:7-12) — seeding buckets
    // directly is closer to the real whole-library count source (timeline.ts:131-145) than
    // piling up a bunch of assets, and doesn't depend on legacy branch details either.
    store.buckets = [{ year: 2026, month: 7, count: 1234, videoCount: 234 }]
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

  it('clicking the collapse button → emits toggle-collapse', async () => {
    const w = mountTopbar()
    await w.get('.icon-btn').trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
  })
})

describe('search submit', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('Enter → emits search-submit with the trimmed value', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('  sunset  ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toEqual([['sunset']])
  })

  // fix round 1 · Important (owner ruling, ledger-六-2, overrides the first version's
  // "empty string also emits" choice): on the timeline topbar, Enter on an empty string is
  // a no-op, following Vue2's own submitSearch (:65-69) empty-string return guard. This only
  // overrides this topbar — PhotosSearchBar.vue's own convention (the box used by
  // PhotosSearch.vue's standalone search page) of "empty string also emits" is unaffected;
  // the scope is different, this is not the same thing changed twice.
  it('empty string Enter → does not emit search-submit (ledger-六-2, follows Vue2 submitSearch\'s empty-string guard)', async () => {
    const w = mountTopbar()
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })

  it('all-whitespace Enter → also does not emit (empty after trim)', async () => {
    const w = mountTopbar()
    await w.get('.search input').setValue('   ')
    await w.get('.search input').trigger('keydown.enter')
    expect(w.emitted('search-submit')).toBeUndefined()
  })
})

// Fix-1 item 1 (owner acceptance, 2026-08-13): additive title/sub/showSearch prop overrides,
// used by the five re-shelled album/for-you pages (Vue2 truth: PhotosTimeline.vue mounts the
// SAME <PhotosTopbar> for every non-people/places/upload nav, PhotosTimeline.vue:957-971, just
// feeding it per-nav title/sub and show-search — it is not a library-exclusive component).
describe('title/sub/showSearch props (extra coverage, Fix-1 item 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('title/sub omitted → default behaviour unchanged (backwards compatible with Photos.vue existing usage)', () => {
    const w = mountTopbar()
    expect(w.get('.topbar-title').text()).toBe(zh.photosLibrary)
  })

  it('title passed → overrides the default photosLibrary copy', () => {
    const w = mountTopbar({ title: zh.photosAlbumsTitle })
    expect(w.get('.topbar-title').text()).toBe(zh.photosAlbumsTitle)
  })

  it('sub passed → overrides the default whole-library count sub-line', () => {
    const w = mountTopbar({ sub: '9 个相册' })
    expect(w.get('.topbar-sub').text()).toBe('9 个相册')
  })

  it('showSearch defaults to true → the search box renders (backwards compatible)', () => {
    const w = mountTopbar()
    expect(w.find('.search').exists()).toBe(true)
  })

  it('showSearch=false → the search box is not rendered, but the centring wrapper stays', () => {
    const w = mountTopbar({ showSearch: false })
    expect(w.find('.search').exists()).toBe(false)
    expect(w.find('.topbar-title').exists()).toBe(true)
  })
})

// Fix-4 item 2 (owner acceptance, 2026-08-13): `back` prop had zero test coverage in Fix-3 —
// every other prop added that wave (title/sub/showSearch, Fix-1 item 1) got one, this one didn't.
// Mirrors Vue2 PhotosTopbar.vue:6-12's searchMode swap: `v-if="back"` renders a second icon-btn
// (chevL) in place of the title/sub block (`v-if="!back"`), emits `back` on click.
describe('back prop (extra coverage, Fix-4 item 2)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('back omitted → default behaviour unchanged: title/sub render and no back button appears', () => {
    const w = mountTopbar()
    expect(w.find('.topbar-title').exists()).toBe(true)
    expect(w.find('.topbar-sub').exists()).toBe(true)
    // Only one .icon-btn besides the collapse button (there is no second, back button).
    expect(w.findAll('.icon-btn')).toHaveLength(1)
  })

  it('back=true → renders the chevL back button (a second .icon-btn) and suppresses title/sub', () => {
    const w = mountTopbar({ back: true })
    expect(w.find('.topbar-title').exists()).toBe(false)
    expect(w.find('.topbar-sub').exists()).toBe(false)
    const icons = w.findAll('.icon-btn')
    expect(icons).toHaveLength(2)
    // Character-for-character against Vue2 PhotosIcon.vue's chevL branch (SearchDatePopover.vue's
    // cal-nav previous-month button already uses the same path, so the precedent is consistent).
    expect(icons[1]!.get('path').attributes('d')).toBe('m15 6-6 6 6 6')
  })

  it('with back=true, clicking the second .icon-btn emits back', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[1]!.trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('with back=true, the back button title is the localized photosSearchBackToLibrary value', () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    expect(icons[1]!.attributes('title')).toBe(zh.photosSearchBackToLibrary)
  })

  it('with back=true, the collapse button (the first .icon-btn) still emits toggle-collapse as usual, unaffected by back', async () => {
    const w = mountTopbar({ back: true })
    const icons = w.findAll('.icon-btn')
    await icons[0]!.trigger('click')
    expect(w.emitted('toggle-collapse')).toHaveLength(1)
    expect(w.emitted('back')).toBeUndefined()
  })
})

// Non-color visual property pin (same convention as PhotosSearchBar.test.ts, I5): the only
// rule allowed in the component's own scoped style is the already-approved glass-texture
// FILL deviation for the search box (chip-bg/chip-border) — none of the other visual
// properties Vue2 already provides in parity scss (height/border-radius/size, etc.) should
// appear here; those are all left to parity.
describe('styles: scoped block minimized (FILL deviation only)', () => {
  it('.search rule only declares background/border-color (FILL deviation), doesn\'t duplicate the height/border-radius parity already provides', () => {
    const style = extractStyleBlock(photosTopbarRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.search')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--chip-bg)')
    expect(rule?.body).toContain('border-color: var(--chip-border)')
    expect(rule?.body).not.toContain('height')
    expect(rule?.body).not.toContain('border-radius')
  })
})
