// PlaceDetailPanel.vue -- the place-detail panel shell: hero + three stats + two actions.
// Covers the required test list item by item, spanning structure specs 1-7 and the 7 items
// in the removed-code list. Pure presentation + emit, no store access -- only mocks
// @nimotech/nimoos-service's thumbnailUrl (same mocking approach as PlacesRail.test.ts /
// PersonHero.test.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import { parsePlaceLast, type Place } from '../../util/placesMap'
import type { PlaceDetail, PlaceSpot, PlaceVisit } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceDetailPanel from '../PlaceDetailPanel.vue'
// Raw source text (Vite `?raw`): the z-index invariant / hero foreground-color compliance /
// hover-cascade assertion groups can only be judged by reading the raw <style> block (jsdom
// doesn't compute cascaded styles and can't enter a real hover state, same precedent as
// ClusterActionDialog.test.ts / PlacesRail.test.ts).
import placeDetailPanelRaw from '../PlaceDetailPanel.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026'),
    trips: 1, home: false, thumbs: ['p-thumb'], coverAssetId: '',
    ...overrides,
  }
}

function detail(overrides: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    id: '1', city: 'Hangzhou', country: 'China', count: 10, trips: 1, home: false,
    coverAssetId: '', thumbs: ['d-thumb'], spots: [], insights: [], visits: [], recent: [],
    ...overrides,
  }
}

function spot(overrides: Partial<PlaceSpot> = {}): PlaceSpot {
  return {
    key: 's1', name: 'West Lake', lon: 120.1551, lat: 30.2741, count: 12, thumb: 't-1',
    ...overrides,
  }
}

function visit(overrides: Partial<PlaceVisit> = {}): PlaceVisit {
  return {
    when: 'Mar 2026', from: '2026-03-01', to: '2026-03-07', current: false,
    days: 7, photos: 42, faces: [], spots: 3, thumbs: ['t1', 't2'],
    ...overrides,
  }
}

function mountPanel(
  props: {
    place?: Place | null
    detail?: PlaceDetail | null
    detailLoading?: boolean
    activeSpotKey?: string | null
    spotBusy?: boolean
  } = {},
  i18n = makeI18n(),
) {
  return mount(PlaceDetailPanel, {
    props: {
      place: place(),
      detail: null,
      detailLoading: false,
      activeSpotKey: null,
      spotBusy: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// -- Structure inventory (structure specs 1-4) --------------------------------------------
describe('structure inventory', () => {
  it('renders .detail-hero / .detail-hero img / .close / cover-set button', () => {
    const w = mountPanel()
    expect(w.find('.detail-hero').exists()).toBe(true)
    expect(w.find('.detail-hero img').exists()).toBe(true)
    expect(w.find('.close').exists()).toBe(true)
    expect(w.find('[data-test="cover-set-btn"]').exists()).toBe(true)
  })

  it('renders .ttl-region / .ttl-name / .ttl-sub', () => {
    const w = mountPanel()
    expect(w.find('.ttl-region').exists()).toBe(true)
    expect(w.find('.ttl-name').exists()).toBe(true)
    expect(w.find('.ttl-sub').exists()).toBe(true)
  })

  it('.detail-stats has exactly 3 .detail-stat', () => {
    const w = mountPanel()
    expect(w.find('.detail-stats').exists()).toBe(true)
    expect(w.findAll('.detail-stats .detail-stat')).toHaveLength(3)
  })

  it('.detail-actions has exactly 2 .btn', () => {
    const w = mountPanel()
    expect(w.find('.detail-actions').exists()).toBe(true)
    expect(w.findAll('.detail-actions .btn')).toHaveLength(2)
  })
})

// -- currentHero priority (required test case) ---------------------------------------------
describe('currentHero priority', () => {
  it('detail.coverAssetId takes top priority', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: 'd-cover', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-cover', 'large')
  })

  it('when detail.coverAssetId is empty, falls back to detail.thumbs[0]', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-thumb', 'large')
  })

  it('when detail has no thumbnails at all, falls back to place.coverAssetId (list-item fallback, deviation logged)', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: [] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('when detail is null, falls back to place.coverAssetId', () => {
    mountPanel({ place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('when place.coverAssetId is empty, falls back to place.thumbs[0]', () => {
    mountPanel({ place: place({ coverAssetId: '', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-thumb', 'large')
  })

  it('when everything is empty, the img does not render (no request with an empty src)', () => {
    const w = mountPanel({ place: place({ coverAssetId: '', thumbs: [] }), detail: null })
    expect(w.find('.detail-hero img').exists()).toBe(false)
    expect(thumbnailUrl).not.toHaveBeenCalled()
  })
})

// -- hero interaction -------------------------------------------------------------------
describe('hero and button interactions', () => {
  it('clicking hero -> open-photo with (currentHero, [currentHero])', async () => {
    const w = mountPanel({ place: place({ coverAssetId: 'p-cover' }), detail: null })
    await w.find('.detail-hero img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['p-cover', ['p-cover']]])
  })

  it('clicking .close -> close', async () => {
    const w = mountPanel()
    await w.find('.close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('clicking the cover-set button -> open-cover-picker', async () => {
    const w = mountPanel()
    await w.find('[data-test="cover-set-btn"]').trigger('click')
    expect(w.emitted('open-cover-picker')).toHaveLength(1)
  })

  it('clicking the two action buttons -> open-library / save-album', async () => {
    const w = mountPanel()
    const btns = w.findAll('.detail-actions .btn')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(w.emitted('open-library')).toHaveLength(1)
    expect(w.emitted('save-album')).toHaveLength(1)
  })
})

// -- Main guard against the "current trip" same-name-field trap ---------------------------
describe('the "current trip" marker is triggered only by place.recent === true', () => {
  it('place.recent=true + detail.recent=[] -> shows', () => {
    const w = mountPanel({ place: place({ recent: true }), detail: detail({ recent: [] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(true)
  })

  it('place.recent=false + detail.recent=["a","b"] (array is truthy) -> does not show', () => {
    const w = mountPanel({ place: place({ recent: false }), detail: detail({ recent: ['a', 'b'] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(false)
  })
})

// -- "Home base" marker -------------------------------------------------------------------
describe('the "home base" marker is triggered by place.home (or detail.home)', () => {
  it('place.home=true -> shows', () => {
    const w = mountPanel({ place: place({ home: true }), detail: null })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('place.home=false but detail.home=true -> shows', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: true }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('both false -> does not show', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: false }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(false)
  })
})

// -- Three stats ----------------------------------------------------------------------------
describe('three stats', () => {
  it('spots is an empty array -> place count shows —', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('detail is null -> place count shows —', () => {
    const w = mountPanel({ detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('spots is non-empty -> place count shows the count', () => {
    const w = mountPanel({
      detail: detail({ spots: [{ key: 's1', name: 'A', lon: 1, lat: 1, count: 1, thumb: '' }, { key: 's2', name: 'B', lon: 2, lat: 2, count: 1, thumb: '' }] }),
    })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('2')
  })

  it('photo count and trip count: detail takes priority, place is the fallback', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: detail({ count: 42, trips: 9 }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('42')
    expect(stats[2].text()).toBe('9')
  })

  it('when detail is null, photo count and trip count fall back to place', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('5')
    expect(stats[2].text()).toBe('2')
  })
})

// -- Singular/plural (trip/trips share the same Chinese wording, must switch to en_us to
// tell them apart) --------------------------------------------------------------------------
describe('singular/plural', () => {
  it('trips === 1 uses photosPlacesTrip (singular)', () => {
    const w = mountPanel({ place: place({ trips: 1 }), detail: null }, makeI18n('en_us'))
    expect(w.find('.ttl-sub').text()).toContain('1 trip')
    expect(w.find('.ttl-sub').text()).not.toContain('1 trips')
  })

  it('trips === 2 uses photosPlacesTrips (plural)', () => {
    const w = mountPanel({ place: place({ trips: 2 }), detail: null }, makeI18n('en_us'))
    expect(w.find('.ttl-sub').text()).toContain('2 trips')
  })
})

// -- Date localization ------------------------------------------------------------------
describe('date localization', () => {
  it('lastDate is non-null -> the raw backend string does not appear', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') }) })
    expect(w.find('.ttl-sub').text()).not.toContain('Mar 7, 2026')
  })

  it('lastDate is null -> falls back to displaying the raw string', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: null }) })
    expect(w.find('.ttl-sub').text()).toContain('Mar 7, 2026')
  })
})

// -- detailLoading skeleton (new in New-UI; Vue2 has no loading state) ----------------------
describe('detailLoading skeleton', () => {
  it('detailLoading is true and detail is null -> skeleton is present', () => {
    const w = mountPanel({ detail: null, detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(true)
  })

  it('skeleton disappears once detail arrives', () => {
    const w = mountPanel({ detail: detail(), detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })

  it('!detailLoading and detail is null -> skeleton is also absent (empty state, not loading)', () => {
    const w = mountPanel({ detail: null, detailLoading: false })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })
})

// -- z-index invariant (layering: map furniture 4 < .map-tip 5 < detail panel 6 <
// .map-toolbar 7) ----------------------------------------------------------------------
describe('z-index invariant', () => {
  it('.map-detail\'s z-index is strictly greater than 5 (.map-tip) and strictly less than 7 (.map-toolbar)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{[^}]*z-index:\s*(-?\d+)/.exec(style)
    expect(m, 'no z-index declaration found in the .map-detail rule').not.toBeNull()
    const z = Number(m![1])
    expect(z).toBeGreaterThan(5)
    expect(z).toBeLessThan(7)
  })
})

// -- Frosted-glass effect on the cover-set button (Vue2's inline backdropFilter:
// 'blur(8px)', PhotosPlacesView.vue:1068) was previously missed during migration. Once
// restored it needs a programmatic assertion pinning it down so a future restyle doesn't
// silently drop it again (the same way it got lost this time). --------------------------
describe('Cover-set button frosted glass', () => {
  it('.hero-cover-btn rule contains backdrop-filter: blur(8px)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.hero-cover-btn\s*\{([^}]*)\}/.exec(style)
    expect(m, '.hero-cover-btn rule not found').not.toBeNull()
    expect(m![1]).toMatch(/backdrop-filter:\s*blur\(8px\)/)
  })
})

// -- .map-detail's enter animation is carried entirely by its own transition; the
// `.map-detail.is-entering` rule is dead CSS and isn't migrated, but this base transition
// is part of what needs migrating. It was previously missed and, once restored, also needs
// a programmatic assertion pinning it down. --------------------------------------------
describe('.map-detail enter transition', () => {
  it('.map-detail rule has a transition (transform + opacity, exactly matching Vue2 :487-489)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{([^}]*)\}/.exec(style)
    expect(m, '.map-detail rule not found').not.toBeNull()
    expect(m![1]).toMatch(/transition:[^;]*transform[^;]*,[^;]*opacity/)
  })
})

// -- The panel background is fully opaque (found during hands-on testing on real hardware) --
// This panel is absolutely positioned over the map canvas; a semi-transparent background
// would let the map's grid dots show through. This only guards the component's own side:
// whether the token itself is actually alpha-free in both theme blocks isn't verified here
// -- that's recorded in docs/THEMING.md.
//
// [Correction -- the **reasoning** behind "only guard the component's own side" above no
// longer holds, though the decision itself is unchanged]
// Of the two original reasons given:
//   - Still holds: both the `?raw` and `?inline` glob queries against `.css` empirically
//     return an empty string (vitest's built-in CSSEnablerPlugin replaces the entire style
//     source with an empty string, and it doesn't look at the query string).
//   - No longer holds: "this repo also doesn't have `@types/node` installed, so `node:fs`
//     would make `vue-tsc` report TS2307" -- after merging, `@types/node` is installed
//     (devDependencies `^26.1.2`), so `node:fs` can be imported directly and
//     `vue-tsc --noEmit` exits 0. Reading theme.css's text is a viable path today.
//   - No longer holds: "this is exactly why color-guard.test.ts skips styles/theme.css
//     entirely" -- `color-guard.test.ts` now reads all `.css` files directly via `node:fs`
//     (`listCss()`); its real reason for skipping `theme.css`/`theme.sp9.css` is documented
//     in its own source: those are **token definition files** where "bare literals are the
//     whole point," unrelated to whether the text can be read.
// => Whether this file should switch to reading theme.css via `node:fs` and programmatically
//    assert that `--panel-bg-solid` is alpha-free in both theme blocks is now a **pure design
//    tradeoff**, no longer a technical blocker. This change only touches comments, not the
//    implementation -- the tradeoff is logged as known debt.
//
// Correction: the premise behind "semi-transparency would let the grid dots show through"
// above has itself been falsified -- `--surface-1` (the token this file now uses) is a fully
// opaque solid color in both Photos themes and never had an alpha channel; `--panel-bg-solid`
// is instead a *global* token that follows the site-wide `[data-theme]` but not Photos'
// private `.photos-root.is-light` toggle -- which is exactly why the real-device acceptance
// report said "the right-side detail panel doesn't follow the light theme." Reverted to
// `--surface-1` (parity's own `photos-places.scss` `.map-detail` rule already used this
// value; this file's local override had been shadowing it the whole time, the same class of
// shadowing bug already fixed in files like PlacesZoomBar.vue). The test assertions have been
// flipped accordingly.
describe('Panel background is fully opaque and follows Photos-private is-light', () => {
  it('.map-detail background uses the local --surface-1 (fully opaque, follows is-light), not the global --panel-bg/--panel-bg-solid', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{([^}]*)\}/.exec(style)
    expect(m, '.map-detail rule not found').not.toBeNull()
    const decls = m![1].replace(/\/\*[\s\S]*?\*\//g, '')
    expect(decls).toMatch(/background:\s*var\(--surface-1\)/)
    expect(decls).not.toMatch(/background:\s*var\(--panel-bg-solid\)/)
    expect(decls).not.toMatch(/background:\s*var\(--panel-bg\)/)
  })
})

// -- Hero foreground-color compliance (no --on-accent, must have theme-exception) --------
describe('hero foreground-color compliance', () => {
  it('.close / .ttl-name / .ttl-region rules do not contain --on-accent', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    for (const selector of ['.close', '.ttl-name', '.ttl-region']) {
      const re = new RegExp(`(?:^|[\\s,{}])${selector.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`)
      const m = re.exec(style)
      expect(m, `rule not found: ${selector}`).not.toBeNull()
      expect(m![1]).not.toContain('--on-accent')
    }
  })

  it('every hardcoded color declaration has a theme-exception comment on the same or previous line, and the comment does not contain ; } <style>', () => {
    const raw = placeDetailPanelRaw
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(raw)
    expect(styleMatch).not.toBeNull()
    const lines = styleMatch![1].split('\n')
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(?:rgba?|hsla?)\s*\(/
    // Strip the contents inside var(...) to avoid misjudging a token fallback literal
    // (e.g. var(--x, #fff)) -- same approach as color-guard.test.ts's stripVar, just a
    // minimal version here since this file is small.
    function stripVar(s: string): string {
      let out = ''; let i = 0
      while (i < s.length) {
        if (s.startsWith('var(', i)) {
          let depth = 0; let j = i + 3
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') { depth--; if (depth === 0) { j++; break } }
          }
          i = j
        } else { out += s[i]; i++ }
      }
      return out
    }
    let exempt = false
    let sawAnyBareColor = false
    lines.forEach((line, idx) => {
      if (line.includes('theme-exception')) {
        exempt = true
        // The comment text itself must not contain these three (color-guard doesn't strip
        // comments, so a literal there would be flagged the same as a real declaration).
        const commentMatch = /\/\*(.*?)\*\//.exec(line)
        if (commentMatch) {
          expect(commentMatch[1]).not.toContain(';')
          expect(commentMatch[1]).not.toContain('}')
          expect(commentMatch[1]).not.toContain('<style>')
        }
      }
      const bare = stripVar(line)
      if (HEX.test(bare) || FUNC.test(bare)) {
        sawAnyBareColor = true
        expect(exempt, `L${idx + 1} bare color literal missing a theme-exception exemption: ${line.trim()}`).toBe(true)
      }
      if (line.includes(';') || line.includes('}')) exempt = false
    })
    // This component's hero foreground color must have a hardcoded literal (a hard
    // requirement of the spec) -- this guards against the assertion above passing green
    // for the wrong reason, i.e. because it never scanned any bare color at all.
    expect(sawAnyBareColor).toBe(true)
  })
})

// -- Hover cascade (the base class .btn:hover must not override .btn-primary's solid fill) --
describe('hover-state background is not stolen by the base-class rule', () => {
  it('.detail-actions .btn.btn-primary hover background belongs to the variant rule (contains :hover and -primary)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  // Cross-checked against Vue2 :582 and confirmed the base class `.btn:hover` itself only
  // touches border-color, not background -- unlike PlacesRail.vue's `.rail-place:hover`
  // (which does set background, a real same-property clash), there's no scenario here of
  // "two rules fighting over the same background property," and `hoverBackgroundRules`
  // indeed can't find a `.btn:hover` rule (it has no background declaration). Changed to
  // directly assert that the selector itself is written as a compound-class form that
  // doesn't depend on declaration order (`.btn.btn-primary:hover`, specificity 3, which
  // isn't tied with the base class `.btn:hover` the way the single-class
  // `.btn-primary:hover` at specificity 2 would be).
  it('.btn-primary\'s dedicated :hover rule is written as a compound-class selector (does not rely on declaration order to beat the base class)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    expect(style).toMatch(/\.btn\.btn-primary:hover\s*\{[^}]*background/)
  })
})

// -- Narrow screen (deviation log #13) --------------------------------------------------
describe('narrow-screen rules', () => {
  it('the style block contains max-width: 768px and .map-detail\'s width is 100% within it', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n {2}\}/.exec(style) ?? /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*)\}/.exec(style)
    expect(m, '@media (max-width: 768px) rule block not found').not.toBeNull()
    expect(m![1]).toMatch(/\.map-detail\s*\{[^}]*width:\s*100%/)
  })
})

// -- spots list section -------------------------------------------------------------------
describe('spots list section', () => {
  it('spots is an empty array -> the whole section does not render', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    // Required tightening: when this test was first written, `.detail-section` had exactly
    // one consumer in the whole repo -- the spots section -- so asserting "zero
    // `.detail-section`" was equivalent to "the spots section doesn't render." A later
    // change added the "recent photos" section (the spec explicitly requires that section
    // to always render, showing a title plus a possible +N tile even when recent is empty),
    // which also wraps itself in `.detail-section`, invalidating the original assertion's
    // premise. Tightened to assert the absence of `.spot-list` instead (the one marker
    // unique to the spots section) -- that's what this case is actually meant to pin down,
    // and the behavior being tested hasn't weakened.
    expect(w.find('.spot-list').exists()).toBe(false)
  })

  it('spots is non-empty -> section header text contains the city name, .spot-row count equals spots length', () => {
    const w = mountPanel({
      place: place({ city: 'Hangzhou' }),
      detail: detail({ city: 'Hangzhou', spots: [spot({ key: 's1' }), spot({ key: 's2' })] }),
    })
    expect(w.find('.detail-section h4').text()).toContain('Hangzhou')
    expect(w.findAll('.spot-row')).toHaveLength(2)
  })

  it('"see all" renders as static text: a span, not a button; the style block\'s .detail-section h4 .more has no cursor: pointer (spec §7c-9)', () => {
    const w = mountPanel({ detail: detail({ spots: [spot()] }) })
    const more = w.find('.detail-section h4 .more')
    expect(more.exists()).toBe(true)
    expect(more.element.tagName).toBe('SPAN')
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.detail-section h4 \.more\s*\{([^}]*)\}/.exec(style)
    expect(m, '.detail-section h4 .more rule not found').not.toBeNull()
    expect(m![1]).not.toMatch(/cursor:\s*pointer/)
  })

  it('clicking .spot-row -> emits pick-spot with that spot object', async () => {
    const s1 = spot({ key: 's1' })
    const w = mountPanel({ detail: detail({ spots: [s1] }) })
    await w.find('.spot-row').trigger('click')
    expect(w.emitted('pick-spot')).toEqual([[s1]])
  })

  it('when thumb is empty, .thumb does not render an img', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ thumb: '' })] }) })
    expect(w.find('.spot-row .thumb img').exists()).toBe(false)
  })
})

// -- `.spot-row:hover` also needs a cssCascade safety net (both spots needed it, but only
// .spot-dialog-btn:hover had been covered before). --------------------------------------
describe('hover-state background (.spot-row)', () => {
  it('.spot-row hover background belongs to a rule containing :hover', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['spot-row'])
    expect(win.selector).toContain(':hover')
  })
})

// -- activeSpotKey -> spot dialog (String() normalization) --------------------------------
describe('activeSpotKey matches a spot -> renders PlaceSpotDialog', () => {
  it('renders the dialog on a match', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 's1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('does not render when there is no match (spot disappeared after a deep link / detail refresh)', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 'does-not-exist' })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })

  // Hard-rule guard: PlaceSpot.key is typed as a string, but its runtime source
  // (route / deep link) isn't guaranteed to follow that -- using a key that is a number at
  // runtime (a type assertion bypassing TS) pins down that the String() normalization is
  // actually doing work, not just decoration.
  it('still matches via String() normalization when spot.key is a number at runtime and activeSpotKey is a string', () => {
    const numericKeySpot = { ...spot(), key: 1 as unknown as string }
    const w = mountPanel({ detail: detail({ spots: [numericKeySpot] }), activeSpotKey: '1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('does not render when activeSpotKey is null', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: null })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })
})

// -- PlaceSpotDialog's five emits are forwarded unchanged ----------------------------------
describe('spot dialog emit forwarding', () => {
  function mountWithActiveSpot() {
    return mountPanel({
      detail: detail({ spots: [spot({ key: 's1', thumb: 'thumb-x' })] }),
      activeSpotKey: 's1',
      spotBusy: false,
    })
  }

  it('close -> close-spot', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog .icon-btn').trigger('click')
    expect(w.emitted('close-spot')).toHaveLength(1)
  })

  it('rename -> rename (name passed through unchanged)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-save').trigger('click')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('reset-name -> reset-name', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-dialog-reset').trigger('click')
    expect(w.emitted('reset-name')).toEqual([[]])
  })

  it('open-library (inside the dialog) -> the panel\'s open-spot-library (distinct from the panel\'s own open-library)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-btn').trigger('click')
    expect(w.emitted('open-spot-library')).toHaveLength(1)
    expect(w.emitted('open-library')).toBeUndefined()
  })

  it('open-photo (single assetId arg) -> the panel\'s existing open-photo(assetId, [assetId]) signature (emit shape unchanged)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['thumb-x', ['thumb-x']]])
  })
})

// -- insights section mounting (rendering delegated to PlaceInsights.vue; the panel is only
// responsible for passing the prop) --------------------------------------------------------
describe('insights section mounting', () => {
  it('detail.insights is non-empty -> PlaceInsights renders .insight-card', () => {
    const w = mountPanel({
      detail: detail({
        insights: [{ ico: 'sparkles', key: 'photos.places.insight.mostPhotographed', params: { count: 9 } }],
      }),
    })
    expect(w.find('.insight-card').exists()).toBe(true)
  })

  it('detail is null (insights defaults to an empty array) -> the insights section does not render', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.insight-card').exists()).toBe(false)
  })
})

// -- Recent-photos section (mirrors Vue2 :1186-1202, section always renders) --------------
describe('recent-photos section', () => {
  it('recent has 3 photos -> 3 .ph tiles; clicking the second -> open-photo with (recent[1], recent)', async () => {
    const recentList = ['a1', 'a2', 'a3']
    const w = mountPanel({ detail: detail({ count: 3, recent: recentList }) })
    const phs = w.findAll('.detail-grid .ph')
    // Three real photos and no +N tile (count === recent.length).
    expect(phs).toHaveLength(3)
    await phs[1].trigger('click')
    expect(w.emitted('open-photo')).toEqual([['a2', recentList]])
  })

  it('count=30, recent.length=6 -> .ph.more exists with text +24', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const more = w.find('.detail-grid .ph.more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('+24')
  })

  it('count=6, recent.length=6 -> .ph.more does not exist', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 6, recent: recentList }) })
    expect(w.find('.detail-grid .ph.more').exists()).toBe(false)
  })

  it('clicking .ph.more and clicking "see all"\'s .more both emit open-library; "see all" text contains the total count', async () => {
    const recentList = ['a', 'b', 'c']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const seeAll = w.findAll('h4 .more.is-clickable')
    expect(seeAll).toHaveLength(1)
    expect(seeAll[0].text()).toContain('30')
    await seeAll[0].trigger('click')
    await w.find('.detail-grid .ph.more').trigger('click')
    expect(w.emitted('open-library')).toHaveLength(2)
  })

  it('the section still renders when recent is empty (title present, Vue2\'s .detail-section has no v-if here)', () => {
    const w = mountPanel({ detail: detail({ count: 0, recent: [] }) })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
    expect(w.findAll('.detail-grid .ph').filter(n => !n.classes().includes('more'))).toHaveLength(0)
  })

  it('detail is null -> recent defaults to an empty array, count falls back to place.count, section still renders', () => {
    const w = mountPanel({ place: place({ count: 0 }), detail: null })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
  })
})

// -- hover cascade (.detail-grid .ph.more) -------------------------------------------------
describe('hover-state background (.detail-grid .ph.more)', () => {
  it('.detail-grid .ph.more hover background belongs to a rule containing :hover', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['detail-grid', 'ph', 'more'])
    expect(win.selector).toContain(':hover')
  })
})

// -- Four icon glyphs must match Vue2 PhotosIcon.vue exactly (this file previously copied
// the wrong glyphs in the same section -- a map-pin standing in for "collapse map," an
// image icon standing in for "album," the grid icon missing rx="1", and the clock hand at
// the wrong angle). Anchored to the specific rendered block before asserting, rather than
// a whole-file keyword search (to avoid a loose match letting "drawn correctly but in the
// wrong place" slip through as a false pass) -- same anchoring approach as
// PlaceCoverPicker.test.ts's "high-risk non-color visual properties" section. -------------
describe('icon glyph cross-check against source', () => {
  it('.ttl-region\'s icon is the collapsed-map glyph (Vue2 PhotosIcon.vue name="map"), not a map pin', () => {
    const m = /class="ttl-region">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, 'svg inside .ttl-region not found').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
  })

  it('.ttl-sub\'s clock hand is M12 7v5l3 2 (Vue2 PhotosIcon.vue name="clock"), not l3 3', () => {
    const m = /class="ttl-sub">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, 'svg inside .ttl-sub not found').not.toBeNull()
    expect(m![1]).toContain('M12 7v5l3 2')
    expect(m![1]).not.toContain('M12 7v5l3 3')
  })

  it('the "open in library" button\'s grid icon has all four rects with rx="1" (Vue2 PhotosIcon.vue name="grid")', () => {
    const m = /@click="emit\('open-library'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, 'open-library button not found').not.toBeNull()
    const rectCount = (m![1].match(/<rect[^>]*>/g) ?? []).length
    const rxCount = (m![1].match(/rx="1"/g) ?? []).length
    expect(rectCount).toBe(4)
    expect(rxCount).toBe(4)
  })

  it('the "save as album" button is the album glyph (rect rx="3" + polyline), not the image glyph', () => {
    const m = /@click="emit\('save-album'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, 'save-album button not found').not.toBeNull()
    expect(m![1]).toContain('rx="3"')
    expect(m![1]).toContain('M3 14l5-4 4 3 3-2 6 5')
    expect(m![1]).not.toContain('M21 15l-5-5L5 21')
    expect(m![1]).not.toContain('cx="8.5"')
  })
})

// -- Visit-history section mounting (rendering delegated to PlaceVisitHistory.vue; the panel
// only passes props + forwards emits) ------------------------------------------------------
describe('visit-history section mounting', () => {
  it('detail.visits is non-empty -> PlaceVisitHistory renders .visit-card', () => {
    const w = mountPanel({ detail: detail({ visits: [visit()] }) })
    expect(w.find('.visit-card').exists()).toBe(true)
  })

  it('detail is null -> visits defaults to an empty array, section still renders (no .visit-card)', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.visit-history').exists()).toBe(true)
    expect(w.find('.visit-card').exists()).toBe(false)
  })

  it('the trips passed to PlaceVisitHistory is the panel\'s own derived trips value (detail.trips takes priority over place.trips)', () => {
    const w = mountPanel({
      place: place({ trips: 1 }),
      detail: detail({ trips: 4, visits: [] }),
    })
    const section = w.findAll('.detail-section').find(s => s.find('.visit-history').exists())
    expect(section, '.detail-section containing .visit-history not found').toBeTruthy()
    expect(section!.find('h4 .more').text()).toContain('4')
  })

  it('save-trip is forwarded to the container unchanged, with the visit object', () => {
    const v = visit({ when: 'Jul 2026' })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    w.find('.visit-save-btn').trigger('click')
    expect(w.emitted('save-trip')).toEqual([[v]])
  })

  it('the open-photo from clicking a thumbnail is forwarded to the container unchanged (list is that visit\'s own thumbs)', async () => {
    const v = visit({ thumbs: ['x1', 'x2'] })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    await w.find('.visit-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['x1', ['x1', 'x2']]])
  })
})
