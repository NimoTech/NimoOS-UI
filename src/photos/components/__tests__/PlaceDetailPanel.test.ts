// P6b-T3: PlaceDetailPanel.vue — place detail panel shell + hero + three stats + two actions.
// Maps 1:1 to task-3-brief.md "required test checklist", covers structure specs 1-7 and
// 7 items in cut-code list. Pure display + emit, no store — only mocks @nimotech/nimoos-service's
// thumbnailUrl (following existing mock technique in PlacesRail.test.ts / PersonHero.test.ts).
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
// Raw source text (Vite `?raw`): z-index invariant / hero foreground compliance / hover cascade
// — all three assertion groups can only read raw <style> text (jsdom doesn't compute cascade,
// can't enter real hover state, same precedent as ClusterActionDialog.test.ts / PlacesRail.test.ts).
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

// ── Structure checklist (structure specs 1-4)────────────────────────────────────────────────
describe('Structure checklist', () => {
  it('Renders .detail-hero / .detail-hero img / .close / cover-set button', () => {
    const w = mountPanel()
    expect(w.find('.detail-hero').exists()).toBe(true)
    expect(w.find('.detail-hero img').exists()).toBe(true)
    expect(w.find('.close').exists()).toBe(true)
    expect(w.find('[data-test="cover-set-btn"]').exists()).toBe(true)
  })

  it('Renders .ttl-region / .ttl-name / .ttl-sub', () => {
    const w = mountPanel()
    expect(w.find('.ttl-region').exists()).toBe(true)
    expect(w.find('.ttl-name').exists()).toBe(true)
    expect(w.find('.ttl-sub').exists()).toBe(true)
  })

  it('Exactly 3 .detail-stat under .detail-stats', () => {
    const w = mountPanel()
    expect(w.find('.detail-stats').exists()).toBe(true)
    expect(w.findAll('.detail-stats .detail-stat')).toHaveLength(3)
  })

  it('Exactly 2 .btn under .detail-actions', () => {
    const w = mountPanel()
    expect(w.find('.detail-actions').exists()).toBe(true)
    expect(w.findAll('.detail-actions .btn')).toHaveLength(2)
  })
})

// ── currentHero priority (required test cases)───────────────────────────────────────────
describe('currentHero priority', () => {
  it('detail.coverAssetId has highest priority', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: 'd-cover', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-cover', 'large')
  })

  it('When detail.coverAssetId is empty, use detail.thumbs[0]', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: ['d-thumb'] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('d-thumb', 'large')
  })

  it('When detail has no thumbnails, use place.coverAssetId (list item fallback, deviation registry)', () => {
    mountPanel({
      place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }),
      detail: detail({ coverAssetId: '', thumbs: [] }),
    })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('When detail is null, use place.coverAssetId', () => {
    mountPanel({ place: place({ coverAssetId: 'p-cover', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-cover', 'large')
  })

  it('When place.coverAssetId is empty, use place.thumbs[0]', () => {
    mountPanel({ place: place({ coverAssetId: '', thumbs: ['p-thumb'] }), detail: null })
    expect(thumbnailUrl).toHaveBeenCalledWith('p-thumb', 'large')
  })

  it('When all empty, img is not rendered (no empty src request sent)', () => {
    const w = mountPanel({ place: place({ coverAssetId: '', thumbs: [] }), detail: null })
    expect(w.find('.detail-hero img').exists()).toBe(false)
    expect(thumbnailUrl).not.toHaveBeenCalled()
  })
})

// ── hero interaction ───────────────────────────────────────────────────────────
describe('hero and button interaction', () => {
  it('Click hero → open-photo with (currentHero, [currentHero])(D9)', async () => {
    const w = mountPanel({ place: place({ coverAssetId: 'p-cover' }), detail: null })
    await w.find('.detail-hero img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['p-cover', ['p-cover']]])
  })

  it('Click .close → close', async () => {
    const w = mountPanel()
    await w.find('.close').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Click cover-set button → open-cover-picker', async () => {
    const w = mountPanel()
    await w.find('[data-test="cover-set-btn"]').trigger('click')
    expect(w.emitted('open-cover-picker')).toHaveLength(1)
  })

  it('Click two action buttons → open-library / save-album', async () => {
    const w = mountPanel()
    const btns = w.findAll('.detail-actions .btn')
    await btns[0].trigger('click')
    await btns[1].trigger('click')
    expect(w.emitted('open-library')).toHaveLength(1)
    expect(w.emitted('save-album')).toHaveLength(1)
  })
})

// ── "current trip" marker same-name-field trap guard ───────────────────────────────────────
describe('"current trip" marker triggered only by place.recent === true', () => {
  it('place.recent=true + detail.recent=[] → appears', () => {
    const w = mountPanel({ place: place({ recent: true }), detail: detail({ recent: [] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(true)
  })

  it('place.recent=false + detail.recent=["a","b"](array truthy) → does not appear', () => {
    const w = mountPanel({ place: place({ recent: false }), detail: detail({ recent: ['a', 'b'] }) })
    expect(w.find('[data-test="ttl-current-trip"]').exists()).toBe(false)
  })
})

// ── "home base" marker ───────────────────────────────────────────────────────
describe('"home base" marker triggered by place.home (or detail.home)', () => {
  it('place.home=true → appears', () => {
    const w = mountPanel({ place: place({ home: true }), detail: null })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('place.home=false but detail.home=true → appears', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: true }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(true)
  })

  it('Both false → does not appear', () => {
    const w = mountPanel({ place: place({ home: false }), detail: detail({ home: false }) })
    expect(w.find('[data-test="ttl-home-base"]').exists()).toBe(false)
  })
})

// ── Three stats ──────────────────────────────────────────────────────────────
describe('Three stats', () => {
  it('spots is empty array → location count shows —', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('detail is null → location count shows —', () => {
    const w = mountPanel({ detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('—')
  })

  it('spots is non-empty → location count shows count', () => {
    const w = mountPanel({
      detail: detail({ spots: [{ key: 's1', name: 'A', lon: 1, lat: 1, count: 1, thumb: '' }, { key: 's2', name: 'B', lon: 2, lat: 2, count: 1, thumb: '' }] }),
    })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[1].text()).toBe('2')
  })

  it('Photo count and trip count: detail takes priority, place fallback', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: detail({ count: 42, trips: 9 }) })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('42')
    expect(stats[2].text()).toBe('9')
  })

  it('When detail is null, photo and trip counts fall back to place', () => {
    const w = mountPanel({ place: place({ count: 5, trips: 2 }), detail: null })
    const stats = w.findAll('.detail-stats .detail-stat .v')
    expect(stats[0].text()).toBe('5')
    expect(stats[2].text()).toBe('2')
  })
})

// ── Singular/Plural (trip/trips both "次旅行" in Chinese, need en_us to distinguish)──────────────
describe('Singular/Plural', () => {
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

// ── Date localization ──────────────────────────────────────────────────────────
describe('Date localization', () => {
  it('lastDate is non-empty → backend original string does not appear', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') }) })
    expect(w.find('.ttl-sub').text()).not.toContain('Mar 7, 2026')
  })

  it('lastDate is null → falls back to showing original string', () => {
    const w = mountPanel({ place: place({ last: 'Mar 7, 2026', lastDate: null }) })
    expect(w.find('.ttl-sub').text()).toContain('Mar 7, 2026')
  })
})

// ── detailLoading skeleton (New-UI new, Vue2 has no loading state)──────────────────────
describe('detailLoading skeleton', () => {
  it('detailLoading and detail is null → skeleton is present', () => {
    const w = mountPanel({ detail: null, detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(true)
  })

  it('Skeleton disappears after detail arrives', () => {
    const w = mountPanel({ detail: detail(), detailLoading: true })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })

  it('!detailLoading and detail is null → skeleton is not present (empty state, not loading)', () => {
    const w = mountPanel({ detail: null, detailLoading: false })
    expect(w.find('[data-test="detail-body-skeleton"]').exists()).toBe(false)
  })
})

// ── z-index invariant (P6a gradient: map fixtures 4 < .map-tip 5 < detail panel 6 < .map-toolbar 7)──
describe('z-index invariant', () => {
  it('.map-detail z-index is strictly greater than 5(.map-tip) and strictly less than 7(.map-toolbar)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{[^}]*z-index:\s*(-?\d+)/.exec(style)
    expect(m, 'z-index declaration not found in .map-detail rule').not.toBeNull()
    const z = Number(m![1])
    expect(z).toBeGreaterThan(5)
    expect(z).toBeLessThan(7)
  })
})

// ── Review fix round 1 I1: cover-set button's frosted glass (Vue2 inline backdropFilter:'blur(8px)',
// PhotosPlacesView.vue:1068) was missed in port, needs programmatic assertion after restore to prevent
// silent loss if style is re-shaped later (same root cause as this loss).──────────────────────────────────────────
describe('Cover-set button frosted glass (review I1)', () => {
  it('.hero-cover-btn rule contains backdrop-filter: blur(8px)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.hero-cover-btn\s*\{([^}]*)\}/.exec(style)
    expect(m, '.hero-cover-btn rule not found').not.toBeNull()
    expect(m![1]).toMatch(/backdrop-filter:\s*blur\(8px\)/)
  })
})

// ── Review fix round 1 I2: .map-detail entrance handled only by its own transition (plan original text),
// `.map-detail.is-entering` is dead CSS not ported, but this base transition belongs to the parts to port,
// was missed before, needs programmatic assertion after restore to prevent silent loss.────────────────────────────────────
describe('.map-detail entrance transition (review I2)', () => {
  it('.map-detail rule contains transition (transform + opacity two parts, exact copy of Vue2 :487-489)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{([^}]*)\}/.exec(style)
    expect(m, '.map-detail rule not found').not.toBeNull()
    expect(m![1]).toMatch(/transition:[^;]*transform[^;]*,[^;]*opacity/)
  })
})

// ── Panel background fully opaque (device acceptance feedback)────────────────────────────────
// This panel is absolutely positioned on top of the map canvas; semi-transparent background
// would let map grid points show through. Guard only this component side: whether the token
// itself carries no alpha across both theme blocks is not verified here, that data lives in docs/THEMING.md.
//
// [SP8-P6 T10 correction — the "guard only component side" **rationale** above no longer holds,
// but the decision itself stands unchanged]
// Of the two reasons the original comment gave:
//   ✅ Still holds: `?raw` / `?inline` glob forms tested on `.css` both return empty string
//      (vitest's built-in CSSEnablerPlugin replaces the entire style source with empty string, and
//      **doesn't look at query strings**).
//   ❌ No longer holds: "we haven't installed `@types/node`, `node:fs` would make `vue-tsc` report
//      TS2307" — after the merge, `@types/node` is installed (devDependencies `^26.1.2`), `node:fs`
//      can be imported directly, `vue-tsc --noEmit` exits 0. **The path to reading theme.css text is
//      open today.**
//   ❌ No longer holds: "this is exactly why color-guard.test.ts skips styles/theme.css entirely" —
//      `color-guard.test.ts` now **reads all `.css` files directly using `node:fs`** (`listCss()`),
//      the real reason it skips `theme.css`/`theme.sp9.css` is written in the source: those are
//      **token definition files**, "bare literals are their job", has nothing to do with whether we
//      can read the text.
// ⇒ "Should this file be changed to use `node:fs` to read theme.css and programmatically assert
//    that `--panel-bg-solid` carries no alpha across both theme blocks" is now a **pure design
//    trade-off**, no longer technically blocked. **T10 only changes comments, not implementation**,
//    this trade-off is registered as technical debt (see VUE2 `docs/vue3-migration-roadmap.md` §SP8
//    debt ledger I4).
describe('Panel background fully opaque', () => {
  it('.map-detail background uses --panel-bg-solid, not semi-transparent --panel-bg', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.map-detail\s*\{([^}]*)\}/.exec(style)
    expect(m, '.map-detail rule not found').not.toBeNull()
    const decls = m![1].replace(/\/\*[\s\S]*?\*\//g, '')
    expect(decls).toMatch(/background:\s*var\(--panel-bg-solid\)/)
    expect(decls).not.toMatch(/background:\s*var\(--panel-bg\)/)
  })
})

// ── hero foreground color compliance (ban --on-accent + require theme-exception)────────────
describe('hero foreground color compliance', () => {
  it('Rules containing .close / .ttl-name / .ttl-region do not contain --on-accent', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    for (const selector of ['.close', '.ttl-name', '.ttl-region']) {
      const re = new RegExp(`(?:^|[\\s,{}])${selector.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`)
      const m = re.exec(style)
      expect(m, `rule not found: ${selector}`).not.toBeNull()
      expect(m![1]).not.toContain('--on-accent')
    }
  })

  it('Every bare color declaration has theme-exception comment on same/previous line, comment lacks ; } <style>', () => {
    const raw = placeDetailPanelRaw
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(raw)
    expect(styleMatch).not.toBeNull()
    const lines = styleMatch![1].split('\n')
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(?:rgba?|hsla?)\s*\(/
    // Strip var(...) internals to avoid misidentifying token fallback literals (like var(--x, #fff)) —
    // same technique as color-guard.test.ts's stripVar, this file needs only a minimal version (small scope).
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
        // Comment text itself must not contain these three (color-guard doesn't strip comments, literals flag same as declarations).
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
        expect(exempt, `L${idx + 1} bare color literal missing theme-exception exemption: ${line.trim()}`).toBe(true)
      }
      if (line.includes(';') || line.includes('}')) exempt = false
    })
    // This component's hero foreground color must use bare literals (brief hard requirement), this guards
    // against the assertion above falsely passing due to "found no bare colors at all".
    expect(sawAnyBareColor).toBe(true)
  })
})

// ── hover cascade (base class .btn:hover must not override .btn-primary solid background)─────────────
describe('hover state background not taken by base class rule', () => {
  it('.detail-actions .btn.btn-primary hover background belongs to variant rule (contains :hover and -primary)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  // Back-checked against Vue2 :582 to confirm base class `.btn:hover` only touches border-color, doesn't set background —
  // unlike PlacesRail.vue `.rail-place:hover` (which does set background, real same-property clash exists),
  // here there is no real scenario of "two rules fighting over same background property", `hoverBackgroundRules` also
  // can't find the `.btn:hover` rule (no background declaration). Changed to directly assert that the selector itself
  // has "write-order-independent" compound-class form (`.btn.btn-primary:hover`, specificity 3, not equal to single-class
  // `.btn-primary:hover` specificity 2 or base `.btn:hover` tie-like form).
  it('.btn-primary dedicated :hover rule written as compound-class selector (independent of write order beats base)', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    expect(style).toMatch(/\.btn\.btn-primary:hover\s*\{[^}]*background/)
  })
})

// ── Narrow screen (deviation registry 13)─────────────────────────────────────────────────
describe('Narrow screen rules', () => {
  it('Style block contains max-width: 768px and .map-detail width is 100%', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n {2}\}/.exec(style) ?? /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*)\}/.exec(style)
    expect(m, '@media (max-width: 768px) rule block not found').not.toBeNull()
    expect(m![1]).toMatch(/\.map-detail\s*\{[^}]*width:\s*100%/)
  })
})

// ── P6b-T4: spots list section ─────────────────────────────────────────────────
describe('spots list section', () => {
  it('spots is empty array → entire section not rendered', () => {
    const w = mountPanel({ detail: detail({ spots: [] }) })
    // Review required (T5 necessary tightening introduced): when T4 was written, `.detail-section` was the only
    // consumer in the whole repo and `.detail-section` count 0 was equivalent to "spots section not rendered".
    // T5 added "recent photos" section (spec §7c-B-4 explicitly requires section always renders, title + possible +N
    // card shown even if recent is empty) — it also wraps with `.detail-section`, original assertion premise
    // was overturned by this new spec-required behavior. Tighten to ".spot-list" absent (spots section's unique-only
    // marker), that's what this test case really needs to pin, behavior not weakened.
    expect(w.find('.spot-list').exists()).toBe(false)
  })

  it('spots is non-empty → section header text contains city name, .spot-row count equals spots length', () => {
    const w = mountPanel({
      place: place({ city: 'Hangzhou' }),
      detail: detail({ city: 'Hangzhou', spots: [spot({ key: 's1' }), spot({ key: 's2' })] }),
    })
    expect(w.find('.detail-section h4').text()).toContain('Hangzhou')
    expect(w.findAll('.spot-row')).toHaveLength(2)
  })

  it('"See all" renders as static text: is span not button, style block .detail-section h4 .more lacks cursor: pointer (spec §7c-9)', () => {
    const w = mountPanel({ detail: detail({ spots: [spot()] }) })
    const more = w.find('.detail-section h4 .more')
    expect(more.exists()).toBe(true)
    expect(more.element.tagName).toBe('SPAN')
    const style = extractStyleBlock(placeDetailPanelRaw)
    const m = /\.detail-section h4 \.more\s*\{([^}]*)\}/.exec(style)
    expect(m, '.detail-section h4 .more rule not found').not.toBeNull()
    expect(m![1]).not.toMatch(/cursor:\s*pointer/)
  })

  it('Click .spot-row → emit pick-spot with that spot object', async () => {
    const s1 = spot({ key: 's1' })
    const w = mountPanel({ detail: detail({ spots: [s1] }) })
    await w.find('.spot-row').trigger('click')
    expect(w.emitted('pick-spot')).toEqual([[s1]])
  })

  it('When thumbnail is empty, img is not rendered inside .thumb', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ thumb: '' })] }) })
    expect(w.find('.spot-row .thumb img').exists()).toBe(false)
  })
})

// ── Review fix I3 (fix round 1): `.spot-row:hover` also needs cssCascade safety net (hard constraint
// both places named, previously only fixed .spot-dialog-btn:hover). ─────────────────
describe('hover state background (.spot-row, review fix I3)', () => {
  it('.spot-row hover background belongs to rule containing :hover', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['spot-row'])
    expect(win.selector).toContain(':hover')
  })
})

// ── P6b-T4: activeSpotKey → spot dialog (String() normalization)─────────────────────
describe('activeSpotKey matches spots → render PlaceSpotDialog', () => {
  it('When matched, dialog is rendered', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 's1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('When no match (deep link/spot disappeared after detail refresh), not rendered', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: 'does-not-exist' })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })

  // Law guard: PlaceSpot.key is string in type, but runtime sources (router/deep link) may not obey —
  // use a runtime-numeric key (force type assertion bypass TS) to pin down that String() normalization is
  // actually doing its job, not just decoration.
  it('When spot.key is runtime number and activeSpotKey is string, still matches via String() normalization', () => {
    const numericKeySpot = { ...spot(), key: 1 as unknown as string }
    const w = mountPanel({ detail: detail({ spots: [numericKeySpot] }), activeSpotKey: '1' })
    expect(w.find('.spot-dialog').exists()).toBe(true)
  })

  it('When activeSpotKey is null, not rendered', () => {
    const w = mountPanel({ detail: detail({ spots: [spot({ key: 's1' })] }), activeSpotKey: null })
    expect(w.find('.spot-dialog').exists()).toBe(false)
  })
})

// ── P6b-T4: PlaceSpotDialog's five emits pass through unchanged ───────────────────────────
describe('spot dialog emit pass-through', () => {
  function mountWithActiveSpot() {
    return mountPanel({
      detail: detail({ spots: [spot({ key: 's1', thumb: 'thumb-x' })] }),
      activeSpotKey: 's1',
      spotBusy: false,
    })
  }

  it('close → close-spot', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog .icon-btn').trigger('click')
    expect(w.emitted('close-spot')).toHaveLength(1)
  })

  it('rename → rename (pass through with name)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-rename-input').setValue('New Name')
    await w.find('.spot-rename-save').trigger('click')
    expect(w.emitted('rename')).toEqual([['New Name']])
  })

  it('reset-name → reset-name', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-rename-btn').trigger('click')
    await w.find('.spot-dialog-reset').trigger('click')
    expect(w.emitted('reset-name')).toEqual([[]])
  })

  it('open-library (inside dialog) → panel open-spot-library (distinguish from panel own open-library)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-btn').trigger('click')
    expect(w.emitted('open-spot-library')).toHaveLength(1)
    expect(w.emitted('open-library')).toBeUndefined()
  })

  it('open-photo (single param assetId) → panel existing open-photo (assetId, [assetId]) signature (not changing T3 emit shape)', async () => {
    const w = mountWithActiveSpot()
    await w.find('.spot-dialog-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['thumb-x', ['thumb-x']]])
  })
})

// ── P6b-T5: insights section mounting (rendering delegated to PlaceInsights.vue, panel only passes prop)──
describe('insights section mounting', () => {
  it('detail.insights is non-empty → PlaceInsights renders .insight-card', () => {
    const w = mountPanel({
      detail: detail({
        insights: [{ ico: 'sparkles', key: 'photos.places.insight.mostPhotographed', params: { count: 9 } }],
      }),
    })
    expect(w.find('.insight-card').exists()).toBe(true)
  })

  it('detail is null (insights defaults to empty array) → insights section not rendered', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.insight-card').exists()).toBe(false)
  })
})

// ── P6b-T5: recent photos section (follows Vue2 :1186-1202, section always renders)─────────────────────
describe('Recent photos section', () => {
  it('recent three photos → 3 .ph, click second → open-photo with (recent[1], recent)(D9 main guard)', async () => {
    const recentList = ['a1', 'a2', 'a3']
    const w = mountPanel({ detail: detail({ count: 3, recent: recentList }) })
    const phs = w.findAll('.detail-grid .ph')
    // Three real photos + no +N card (count === recent.length).
    expect(phs).toHaveLength(3)
    await phs[1].trigger('click')
    expect(w.emitted('open-photo')).toEqual([['a2', recentList]])
  })

  it('count=30, recent.length=6 → .ph.more exists and text is +24', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const more = w.find('.detail-grid .ph.more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('+24')
  })

  it('count=6, recent.length=6 → .ph.more does not exist', () => {
    const recentList = ['a', 'b', 'c', 'd', 'e', 'f']
    const w = mountPanel({ detail: detail({ count: 6, recent: recentList }) })
    expect(w.find('.detail-grid .ph.more').exists()).toBe(false)
  })

  it('Click .ph.more and click "see all" .more both emit open-library; "see all" text contains total count', async () => {
    const recentList = ['a', 'b', 'c']
    const w = mountPanel({ detail: detail({ count: 30, recent: recentList }) })
    const seeAll = w.findAll('h4 .more.is-clickable')
    expect(seeAll).toHaveLength(1)
    expect(seeAll[0].text()).toContain('30')
    await seeAll[0].trigger('click')
    await w.find('.detail-grid .ph.more').trigger('click')
    expect(w.emitted('open-library')).toHaveLength(2)
  })

  it('When recent is empty, section still renders (title present, Vue2 this .detail-section has no v-if)', () => {
    const w = mountPanel({ detail: detail({ count: 0, recent: [] }) })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
    expect(w.findAll('.detail-grid .ph').filter(n => !n.classes().includes('more'))).toHaveLength(0)
  })

  it('detail is null → recent defaults to empty array, count defaults to place.count, section still renders', () => {
    const w = mountPanel({ place: place({ count: 0 }), detail: null })
    expect(w.find('h4 .more.is-clickable').exists()).toBe(true)
  })
})

// ── hover cascade (.detail-grid .ph.more, review law — fourth instance of same-type trap assertion)──────────
describe('hover state background (.detail-grid .ph.more)', () => {
  it('.detail-grid .ph.more hover background belongs to rule containing :hover', () => {
    const style = extractStyleBlock(placeDetailPanelRaw)
    const win = winningHoverBackground(style, ['detail-grid', 'ph', 'more'])
    expect(win.selector).toContain(':hover')
  })
})

// ── Final review I1: four icon glyphs must match Vue2 PhotosIcon.vue (previously this file on same branch
// had wrong glyphs copied — map pin masquerading as "folded map", image icon as "album", grid icon missing
// rx="1", clock pointer angle wrong). Assert anchored to specific render block, don't keyword-search entire file
// (avoid loose match passing fake-green like "drew right but in wrong place"), same technique as PlaceCoverPicker.test.ts
// "high-risk non-color visual properties" section.────────────────────────────────────────
describe('Icon glyph source check (review I1)', () => {
  it('.ttl-region icon is folded map (Vue2 PhotosIcon.vue name="map"), not map pin', () => {
    const m = /class="ttl-region">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, 'svg not found inside .ttl-region').not.toBeNull()
    expect(m![1]).toContain('M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z')
    expect(m![1]).toContain('M9 4v14M15 6v14')
    expect(m![1]).not.toContain('M12 21s-7-7.5-7-12')
  })

  it('.ttl-sub clock pointer is M12 7v5l3 2 (Vue2 PhotosIcon.vue name="clock"), not l3 3', () => {
    const m = /class="ttl-sub">\s*<svg[^>]*>([\s\S]*?)<\/svg>/.exec(placeDetailPanelRaw)
    expect(m, 'svg not found inside .ttl-sub').not.toBeNull()
    expect(m![1]).toContain('M12 7v5l3 2')
    expect(m![1]).not.toContain('M12 7v5l3 3')
  })

  it('"Open in library" button grid icon all four rect have rx="1" (Vue2 PhotosIcon.vue name="grid")', () => {
    const m = /@click="emit\('open-library'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, 'open-library button not found').not.toBeNull()
    const rectCount = (m![1].match(/<rect[^>]*>/g) ?? []).length
    const rxCount = (m![1].match(/rx="1"/g) ?? []).length
    expect(rectCount).toBe(4)
    expect(rxCount).toBe(4)
  })

  it('"Save as album" button is album glyph (rect rx="3" + fold line), not image glyph', () => {
    const m = /@click="emit\('save-album'\)">([\s\S]*?)<\/button>/.exec(placeDetailPanelRaw)
    expect(m, 'save-album button not found').not.toBeNull()
    expect(m![1]).toContain('rx="3"')
    expect(m![1]).toContain('M3 14l5-4 4 3 3-2 6 5')
    expect(m![1]).not.toContain('M21 15l-5-5L5 21')
    expect(m![1]).not.toContain('cx="8.5"')
  })
})

// ── P6b-T6: visit history section mounting (rendering delegated to PlaceVisitHistory.vue, panel only passes prop + emit)──
describe('Visit history section mounting', () => {
  it('detail.visits is non-empty → PlaceVisitHistory renders .visit-card', () => {
    const w = mountPanel({ detail: detail({ visits: [visit()] }) })
    expect(w.find('.visit-card').exists()).toBe(true)
  })

  it('detail is null → visits defaults to empty array, section still renders (no .visit-card)', () => {
    const w = mountPanel({ detail: null })
    expect(w.find('.visit-history').exists()).toBe(true)
    expect(w.find('.visit-card').exists()).toBe(false)
  })

  it('trips passed to PlaceVisitHistory is panel existing trips derived value (detail.trips takes priority over place.trips)', () => {
    const w = mountPanel({
      place: place({ trips: 1 }),
      detail: detail({ trips: 4, visits: [] }),
    })
    const section = w.findAll('.detail-section').find(s => s.find('.visit-history').exists())
    expect(section, '.detail-section containing .visit-history not found').toBeTruthy()
    expect(section!.find('h4 .more').text()).toContain('4')
  })

  it('save-trip passes through to container unchanged, with visit object', () => {
    const v = visit({ when: 'Jul 2026' })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    w.find('.visit-save-btn').trigger('click')
    expect(w.emitted('save-trip')).toEqual([[v]])
  })

  it('Thumbnail click open-photo passes through to container unchanged (D9: list is that visit own thumbs)', async () => {
    const v = visit({ thumbs: ['x1', 'x2'] })
    const w = mountPanel({ detail: detail({ visits: [v] }) })
    await w.find('.visit-thumbs img').trigger('click')
    expect(w.emitted('open-photo')).toEqual([['x1', ['x1', 'x2']]])
  })
})
