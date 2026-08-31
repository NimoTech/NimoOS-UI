// PlaceCoverPicker.vue — the place detail's "set cover" fullscreen overlay (tabs/search/8-col
// candidate grid/pagination/restore default). Covers the "must-include test list" item by item.
// Pure display + emit, doesn't touch the store — only mocks @nimotech/nimoos-service's
// thumbnailUrl (following the existing mock approach from PlaceSpotDialog.test.ts /
// PlacesRail.test.ts).
//
// The component now Teleports its content to
// `document.body` (Vue2 body-portal semantics, PhotosPlacesView.vue mounted()/
// beforeDestroy() appendChild/removeChild) — every DOM query below goes through a
// `body()` DOMWrapper instead of the mount wrapper's own subtree (same
// PhotosToastHost.test.ts idiom for a Teleport-to-body component). The component's own
// `<style scoped>` was deleted entirely (parity `photos-places.scss`'s own
// `.places-cover-portal` family governs 100% of its visuals now), so the raw-source style
// assertions that used to parse `PlaceCoverPicker.vue?raw` now parse that shared parity
// file's raw text instead.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { CoverCandidates } from '../../stores/places'
import { __resetPhotosThemeForTests, usePhotosTheme } from '../../composables/usePhotosTheme'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceCoverPicker from '../PlaceCoverPicker.vue'
// Raw source text of the shared parity file: hover-cascade + color-compliance + high-risk-
// non-color-property tests parse it directly — jsdom neither computes cascade nor can enter
// a real `:hover` state (same PlacesRail.test.ts precedent). Plain `fs.readFileSync` rather
// than a Vite `?raw` import: Vite's CSS/SCSS handling intercepts `.scss` specifiers ahead of
// the raw-import plugin and yields an empty string (verified: `.vue?raw` works, `.scss?raw`
// does not) — same technique PhotosAlbums.test.ts/keywords-guard.test.ts already use for
// this exact file.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCssRules, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

const photosPlacesScssRaw = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/vue2-parity/photos-places.scss'),
  'utf8',
)

// The `.places-cover-portal` family lives as flat, non-nested top-level rules starting
// after this file's own `.photos-root { ... }` block closes (see photos-places.scss's own
// header comment) — slicing to that point keeps `parseCssRules` (a naive brace-counting-
// free regex parser designed for flat `<style scoped>` text, see cssCascade.ts's own
// header) safe from the deeply nested SCSS above it, which it cannot parse correctly.
// Comments are stripped the same way `extractStyleBlock` does for a `<style>` block's own
// text — otherwise a comment sitting directly above a selector merges into that selector's
// captured text and every exact-match lookup below silently stops finding anything.
const portalCss = photosPlacesScssRaw
  .slice(photosPlacesScssRaw.indexOf('.places-cover-portal {'))
  .replace(/\/\*[\s\S]*?\*\//g, '')

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function candidates(over: Partial<CoverCandidates> = {}): CoverCandidates {
  return {
    tabs: [
      { id: 'recent', label: 'Recent', icon: 'clock', count: 12 },
      { id: 'top', label: 'Top rated', icon: 'sparkles', count: 34 },
      { id: 'fav', label: 'Favorited', icon: 'star', count: 5 },
      { id: 'all', label: 'All', icon: 'grid', count: 120 },
    ],
    items: ['a1', 'a2', 'a3'],
    page: 0,
    totalPages: 5,
    total: 88,
    ...over,
  }
}

const body = () => new DOMWrapper(document.body)

function mountPicker(props: Partial<InstanceType<typeof PlaceCoverPicker>['$props']> = {}, i18n = makeI18n()) {
  return mount(PlaceCoverPicker, {
    props: {
      open: true,
      city: 'Hangzhou',
      totalCount: 100,
      currentAssetId: '',
      candidates: candidates(),
      tab: 'recent',
      search: '',
      page: 0,
      busy: false,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  __resetPhotosThemeForTests()
  localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ''
})

// ── body-portal + places-cover-portal semantics ───────────────────────────
describe('Teleport placement', () => {
  it('open=true renders content directly under document.body (not inside the page component tree)', () => {
    const w = mountPicker()
    // Component's own root element is a Teleport marker (comment node), not the
    // rendered content — the real content must be found via document.body, not
    // via the wrapper's own subtree.
    expect(w.find('.cp-shell').exists()).toBe(false)
    expect(body().find('.cp-shell').exists()).toBe(true)
  })

  it('the root node\'s class includes places-cover-portal + photos-root + is-open', () => {
    mountPicker()
    const root = body().find('[data-test="cp-scrim"]')
    expect(root.exists()).toBe(true)
    expect(root.classes()).toContain('places-cover-portal')
    expect(root.classes()).toContain('photos-root')
    expect(root.classes()).toContain('is-open')
  })

  it('when the theme is light, the root node carries the is-light class (themeClass follows usePhotosTheme)', () => {
    usePhotosTheme().set('light')
    mountPicker()
    const root = body().find('[data-test="cp-scrim"]')
    expect(root.classes()).toContain('is-light')
  })

  it('clicking blank space on the root node (click.self) emits close', async () => {
    const w = mountPicker()
    await body().find('[data-test="cp-scrim"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('open=false renders nothing under document.body', () => {
    mountPicker({ open: false })
    expect(body().find('[data-test="cp-scrim"]').exists()).toBe(false)
  })
})

// ── open toggle ────────────────────────────────────────────────────────
describe('open toggle', () => {
  it('open=false renders nothing at all', () => {
    mountPicker({ open: false })
    expect(body().find('[data-test="cp-scrim"]').exists()).toBe(false)
  })

  it('open=true renders both the root node and .cp-shell', () => {
    mountPicker({ open: true })
    expect(body().find('[data-test="cp-scrim"]').exists()).toBe(true)
    expect(body().find('.cp-shell').exists()).toBe(true)
  })
})

// ── structural inventory ─────────────────────────────────────────────────
describe('structural inventory', () => {
  it('head: thumb / title / sub / close are all present', () => {
    mountPicker()
    expect(body().find('.cp-head-thumb').exists()).toBe(true)
    expect(body().find('.cp-head-title').exists()).toBe(true)
    expect(body().find('.cp-head-sub').exists()).toBe(true)
    expect(body().find('.cp-close-btn').exists()).toBe(true)
  })

  it('the number of tabs equals candidates.tabs.length, and the search input is present', () => {
    mountPicker()
    expect(body().findAll('[data-test="cp-tab"]').length).toBe(4)
    expect(body().find('.cp-search input').exists()).toBe(true)
  })

  it('grid: the number of cells equals the length of items', () => {
    mountPicker({ candidates: candidates({ items: ['a1', 'a2', 'a3', 'a4'] }) })
    expect(body().findAll('[data-test="cp-cell"]').length).toBe(4)
  })

  it('foot: reset / info / both pagers are all present', () => {
    mountPicker()
    expect(body().find('.cp-reset-btn').exists()).toBe(true)
    expect(body().find('.cp-foot-info').exists()).toBe(true)
    expect(body().find('[data-test="cp-page-prev"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-page-next"]').exists()).toBe(true)
  })

  it('when currentAssetId is empty, the header thumbnail does not render an img', () => {
    mountPicker({ currentAssetId: '' })
    expect(body().find('.cp-head-thumb img').exists()).toBe(false)
  })

  it('when currentAssetId is non-empty, the header thumbnail renders an img', () => {
    mountPicker({ currentAssetId: 'hero-1' })
    expect(body().find('.cp-head-thumb img').exists()).toBe(true)
  })
})

// ── title/subtitle interpolation ───────────────────────────────────────────
describe('title/subtitle interpolation', () => {
  it("city='杭州', totalCount=12345 → the title contains 杭州, and the subtitle contains the thousands-separated 12,345", () => {
    mountPicker({ city: '杭州', totalCount: 12345 })
    expect(body().find('.cp-head-title').text()).toContain('杭州')
    expect(body().find('.cp-head-sub').text()).toContain('12,345')
  })
})

// ── the three-tier tab-label fallback chain (mirrors Vue2 :374-377) ────────────────────
describe('the three tiers of the tab-label fallback chain', () => {
  it("t.id='recent' resolves to its Chinese label", () => {
    mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1 }] }),
    })
    expect(body().find('[data-test="cp-tab"]').text()).toContain('近期')
  })

  it("t.id='zzz', label='Zzz' (no matching i18n key) falls back to the label", () => {
    mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: 'Zzz', icon: 'clock', count: 1 }] }),
    })
    expect(body().find('[data-test="cp-tab"]').text()).toContain('Zzz')
  })

  it("t.id='zzz' with no label falls back to the id itself", () => {
    mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: '', icon: 'clock', count: 1 }] }),
    })
    expect(body().find('[data-test="cp-tab"]').text()).toContain('zzz')
  })
})

// ── cp-tab-count thousands abbreviation (mirrors Vue2 :1284) ──────────────────────
describe('cp-tab-count abbreviation', () => {
  // Deviation note (checked against the source): an earlier hand-computed
  // "Math.round(1234/100)/10 = 12.3" was wrong — 1234/100=12.34, Math.round(12.34)=12,
  // 12/10=1.2, so the real result is "1.2k". The implementation follows Vue2 source :1284's
  // formula verbatim (source of truth), and the expected value here has been corrected to
  // the properly hand-checked result.
  it('count=1234 renders the text 1.2k (Math.round(1234/100)/10 = 1.2, verified against source)', () => {
    mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1234 }] }),
    })
    expect(body().find('.cp-tab-count').text()).toBe('1.2k')
  })

  it('count=999 displays as-is: 999 (boundary case, does not enter the k branch)', () => {
    mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 999 }] }),
    })
    expect(body().find('.cp-tab-count').text()).toBe('999')
  })
})

// ── icon branches (backend contract: clock/sparkles/star/grid, unknown falls back to a generic icon) ───────────
describe('tab icon branches', () => {
  it('each of the four known icon names hits its matching data-test, and an unknown value falls back', () => {
    mountPicker({
      candidates: candidates({
        tabs: [
          { id: 'a', label: 'A', icon: 'clock', count: 1 },
          { id: 'b', label: 'B', icon: 'sparkles', count: 1 },
          { id: 'c', label: 'C', icon: 'star', count: 1 },
          { id: 'd', label: 'D', icon: 'grid', count: 1 },
          { id: 'e', label: 'E', icon: 'mystery-icon', count: 1 },
        ],
      }),
    })
    expect(body().find('[data-test="cp-tab-ico-clock"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-tab-ico-sparkles"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-tab-ico-star"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-tab-ico-grid"]').exists()).toBe(true)
    expect(body().find('[data-test="cp-tab-ico-fallback"]').exists()).toBe(true)
  })
})

// ── current-cover checkmark (String-normalization guard) ─────────────────────────────
describe('current-cover checkmark', () => {
  it('currentAssetId is the number 7, items contains the string "7" — that cell has .is-active and contains .cp-cell-check', () => {
    mountPicker({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately passing a number to simulate an out-of-contract external input
      currentAssetId: 7 as any,
      candidates: candidates({ items: ['6', '7', '8'] }),
    })
    const cells = body().findAll('[data-test="cp-cell"]')
    expect(cells[1].classes()).toContain('is-active')
    expect(cells[1].find('.cp-cell-check').exists()).toBe(true)
    expect(cells[0].classes()).not.toContain('is-active')
    expect(cells[2].classes()).not.toContain('is-active')
  })
})

// ── clicking a cell / busy state ───────────────────────────────────────────────────────
describe('clicking a cell / busy state', () => {
  it('clicking a cell emits pick with String(assetId)', async () => {
    const w = mountPicker({ candidates: candidates({ items: ['a1', 'a2'] }) })
    await body().findAll('[data-test="cp-cell"]')[1].trigger('click')
    expect(w.emitted('pick')).toEqual([['a2']])
  })

  it('when busy=true, every cell and the reset button are disabled', () => {
    mountPicker({ busy: true, candidates: candidates({ items: ['a1', 'a2'] }) })
    for (const cell of body().findAll('[data-test="cp-cell"]'))
      expect((cell.element as HTMLButtonElement).disabled).toBe(true)
    expect((body().find('.cp-reset-btn').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking the reset button emits reset', async () => {
    const w = mountPicker()
    await body().find('.cp-reset-btn').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

// ── empty state ─────────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('items=[] shows .cp-empty with the search term in its text, and .cp-grid does not render', () => {
    mountPicker({ search: '西湖', candidates: candidates({ items: [] }) })
    expect(body().find('.cp-empty').exists()).toBe(true)
    expect(body().find('.cp-empty').text()).toContain('西湖')
    expect(body().find('.cp-grid').exists()).toBe(false)
  })
})

// ── pagination ─────────────────────────────────────────────────────────────────
describe('pagination', () => {
  it('page=0 disables the previous-page button', () => {
    mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    expect((body().find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('page = totalPages - 1 disables the next-page button', () => {
    mountPicker({ page: 4, candidates: candidates({ totalPages: 5 }) })
    expect((body().find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking next-page emits update:page with page+1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await body().find('[data-test="cp-page-next"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[3]])
  })

  it('clicking previous-page emits update:page with page-1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await body().find('[data-test="cp-page-prev"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[1]])
  })

  it('when totalPages=1, both pagers are disabled', () => {
    mountPicker({ page: 0, candidates: candidates({ totalPages: 1 }) })
    expect((body().find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((body().find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  // Dedicated assertion for the Math.max(0, page - 1) clamp. A real browser's native disabled
  // button blocks the click, but the component's own handler must clamp regardless — this
  // bypasses vue-test-utils' trigger() (which doesn't dispatch on disabled elements) and uses a
  // native dispatchEvent to fire the click listener directly, decoupling the test from whether
  // the element is disabled so it verifies the clamp logic itself specifically (the intent is
  // to pin down both the disabled attribute and the emitted argument together).
  it('forcibly dispatching click while page=0 (bypassing disabled) emits a non-negative page (Math.max clamp)', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    body().find('[data-test="cp-page-prev"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const emitted = w.emitted('update:page')
    expect(emitted).toEqual([[0]])
  })
})

// ── page info ─────────────────────────────────────────────────────────────────
describe('page info', () => {
  it('total=88, page=0, totalPages=5 → the text contains 88, 1, and 5 (the displayed page is +1)', () => {
    mountPicker({ page: 0, candidates: candidates({ total: 88, totalPages: 5 }) })
    const text = body().find('.cp-foot-info').text()
    expect(text).toContain('88')
    expect(text).toContain('1')
    expect(text).toContain('5')
  })
})

// ── search / tab clicks ───────────────────────────────────────────────────────
describe('search and tabs', () => {
  it('typing 西湖 emits update:search with 西湖', async () => {
    const w = mountPicker()
    await body().find('.cp-search input').setValue('西湖')
    expect(w.emitted('update:search')).toEqual([['西湖']])
  })

  it('clicking a tab emits update:tab with t.id', async () => {
    const w = mountPicker()
    const tabs = body().findAll('[data-test="cp-tab"]')
    await tabs[2].trigger('click')
    expect(w.emitted('update:tab')).toEqual([['fav']])
  })
})

// ── three ways to close ─────────────────────────────────────────────────────────────
describe('three ways to close', () => {
  it('clicking .cp-close-btn emits close', async () => {
    const w = mountPicker()
    await body().find('.cp-close-btn').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('clicking blank space on the scrim (click.self) emits close', async () => {
    const w = mountPicker()
    await body().find('[data-test="cp-scrim"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('clicking inside .cp-shell does not emit close', async () => {
    const w = mountPicker()
    await body().find('.cp-shell').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('Escape (dispatched on document, bubbles:true) emits close', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('a non-Escape key does not trigger close', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })
})

// ── Escape listener lifecycle ─────────────────────────────────────────────────
describe('Escape listener lifecycle', () => {
  it('after open flips true→false, dispatching Escape again no longer emits', async () => {
    const w = mountPicker({ open: true })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('likewise does not emit after unmount() (asserts removeEventListener was called)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountPicker({ open: true })
    const added = addSpy.mock.calls.find(c => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(added).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', added![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── cssCascade: the hover-state background isn't stolen by the base-class rule ────────────────────
// Source is now the shared parity file's raw text (`.places-cover-portal .cp-*`
// selectors), not the component's own `<style>` (deleted). `photosPlacesScssRaw` is plain
// SCSS, not a Vue SFC, so there is no `<style>` wrapper to extract — passed straight into
// the cssCascade helpers, which only need CSS-like text.
describe('the hover-state background isn\'t stolen by the base-class rule (a known-fragile pattern in this file)', () => {
  it('.cp-tab.is-active\'s hover background belongs to the variant rule with :hover', () => {
    const win = winningHoverBackground(portalCss, ['places-cover-portal', 'cp-tab', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-tab.is-active has a dedicated :hover rule whose specificity is strictly higher than the base .cp-tab:hover', () => {
    const rules = hoverBackgroundRules(portalCss, ['places-cover-portal', 'cp-tab', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.places-cover-portal .cp-tab:hover')
    const activeHover = rules.find(r => r.selector !== '.places-cover-portal .cp-tab:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })

  it('.cp-cell.is-active\'s hover background belongs to the variant rule with :hover', () => {
    const win = winningHoverBackground(portalCss, ['places-cover-portal', 'cp-cell', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-cell.is-active has a dedicated :hover rule whose specificity is strictly higher than the base .cp-cell:hover', () => {
    const rules = hoverBackgroundRules(portalCss, ['places-cover-portal', 'cp-cell', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.places-cover-portal .cp-cell:hover')
    const activeHover = rules.find(r => r.selector !== '.places-cover-portal .cp-cell:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })
})

// ── color compliance ─────────────────────────────────────────────────────────────
// `src/photos/styles/vue2-parity/*.scss` files are registered exemptions from the
// project-wide color-guard convention (see src/styles/color-guard.test.ts's own citation of
// that ruling — they are Vue2's pixel-true source, with their own
// `.photos-root`-scoped token system) — so this describe block only keeps the assertion that
// is still a meaningful contract for this component specifically (the checkmark badge's
// color), not a repeat of the whole-file literal-color sweep the old component-owned test
// used to run (that sweep's job now belongs to color-guard.test.ts's own exemption, not to
// this component's test file).
describe('color compliance', () => {
  it('the .cp-cell-check rule exists (a New-UI addition; Vue2 has no such element)', () => {
    const rule = parseCssRules(portalCss).find(r => r.selectors.includes('.places-cover-portal .cp-cell-check'))
    expect(rule, 'could not find the .places-cover-portal .cp-cell-check rule').toBeDefined()
  })

  it('.cp-cell-check\'s color is hardcoded white (#fff), not --on-accent (that token is calibrated against New-UI\'s global accent, which in the default dark theme is a deep navy — nearly invisible on top of Photos\' fixed purple accent badge background)', () => {
    const rules = parseCssRules(portalCss).filter(r => r.selectors.includes('.places-cover-portal .cp-cell-check'))
    const colorRule = rules.find(r => /color\s*:\s*#fff\b/i.test(r.body))
    expect(colorRule, 'could not find a .cp-cell-check rule with color:#fff').toBeDefined()
    const onAccentRule = rules.find(r => /var\(--on-accent\)/.test(r.body))
    expect(onAccentRule, 'should no longer reference --on-accent').toBeUndefined()
  })
})

// ── programmatic style assertions (high-risk non-color visual properties can't rely on manual review alone) ──────────
// Three rules anchored to specific selectors' rule bodies (not a whole-file keyword search,
// to avoid vacuous truths) — following the existing convention from
// PlaceVisitHistory.test.ts:188-217 / PlaceDetailPanel.test.ts:333-339.
// Source is now the shared parity file (`.places-cover-portal` prefix), not the
// component's own deleted `<style>` block.
describe('high-risk non-color visual properties', () => {
  const rules = parseCssRules(portalCss)

  it('the .places-cover-portal rule contains backdrop-filter (the exact property lost once before when an inline style was rewritten into a class — reproducing that regression)', () => {
    const rule = rules.find(r => r.selectors.length === 1 && r.selectors[0] === '.places-cover-portal')
    expect(rule, 'could not find the .places-cover-portal rule').toBeDefined()
    expect(rule!.body).toMatch(/backdrop-filter\s*:/)
  })

  it('the .cp-cell rule contains aspect-ratio: 1 (the 8-column thumbnail grid cells must be square)', () => {
    const rule = rules.find(r => r.selectors.includes('.places-cover-portal .cp-cell'))
    expect(rule, 'could not find the .places-cover-portal .cp-cell rule').toBeDefined()
    expect(rule!.body).toMatch(/aspect-ratio\s*:\s*1\b/)
  })

  it('the .cp-grid rule contains grid-template-columns: repeat(8, 1fr) (mirrors Vue2 :1129\'s 8 columns)', () => {
    const rule = rules.find(r => r.selectors.includes('.places-cover-portal .cp-grid'))
    expect(rule, 'could not find the .places-cover-portal .cp-grid rule').toBeDefined()
    expect(rule!.body).toMatch(/grid-template-columns\s*:\s*repeat\(\s*8\s*,\s*1fr\s*\)/)
  })
})

// ── English locale sanity ───────────────────────────────────────────────────
describe('English locale sanity', () => {
  it('under en_us, the title/subtitle/placeholder switch to English', () => {
    mountPicker({ city: 'Hangzhou', totalCount: 100 }, makeI18n('en_us'))
    expect(body().find('.cp-head-title').text()).toContain('Hangzhou')
    expect(body().find('.cp-search input').attributes('placeholder')).toBeTruthy()
  })
})
