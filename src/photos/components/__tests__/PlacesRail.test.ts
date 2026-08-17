// P6a-T5: PlacesRail.vue — Places page left sidebar city rail (continent group collapse + search + active state).
// Corresponds item-by-item to task-5-brief.md "required test checklist", supplemented with coverage for structure specs 1–5 and delete-code checklist 6 items.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosPlaces } from '../../stores/places'
import type { Place, RegionCount } from '../../util/placesMap'
import { parsePlaceLast } from '../../util/placesMap'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlacesRail from '../PlacesRail.vue'
// Raw source text (Vite `?raw`), used only for the "hover background not stolen by base class rules" test group at the end —
// jsdom neither computes cascading styles nor enters real hover states, so we parse the <style> text manually and apply
// CSS specificity rules ourselves (same precedent as ClusterActionDialog.test.ts:21–22).
import placesRailRaw from '../PlacesRail.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026'),
    trips: 1, home: false, thumbs: ['t1'], coverAssetId: '', ...over,
  }
}

const REGIONS: RegionCount[] = [
  { id: 'asia', label: 'Asia', count: 1 },
  { id: 'europe', label: 'Europe', count: 1 },
]

function mountRail(props: Partial<InstanceType<typeof PlacesRail>['$props']> = {}) {
  return mount(PlacesRail, {
    props: {
      places: [],
      regions: REGIONS,
      activeId: null,
      totalPhotos: 0,
      countryCount: 0,
      loaded: true,
      totalPlaces: 0,
      ...props,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('Statistics header (structure spec 1)', () => {
  it('All three <b> render, photo count uses toLocaleString()', () => {
    const w = mountRail({
      places: [place({ id: 'a' }), place({ id: 'b' })],
      totalPhotos: 123456,
      countryCount: 3,
    })
    const bs = w.findAll('.sub b')
    expect(bs).toHaveLength(3)
    expect(bs[0].text()).toBe('2') // places.length (filtered but not searched)
    expect(bs[1].text()).toBe('3') // countryCount
    expect(bs[2].text()).toBe((123456).toLocaleString())
  })
})

describe('Group order (structure spec 3, delete-code ①)', () => {
  it('Follows regions array order, not alphabetical order', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' }), place({ id: 'b', region: 'europe', city: 'Paris' })],
      regions: [
        { id: 'europe', label: 'Europe', count: 1 },
        { id: 'asia', label: 'Asia', count: 1 },
      ],
    })
    const heads = w.findAll('.rail-region-head-left span')
    expect(heads.map(h => h.text())).toEqual(['欧洲', '亚洲'])
  })

  it('Continents with empty grouped[rId] do not render group header', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia' })],
      regions: REGIONS, // contains europe, but no europe places
    })
    expect(w.findAll('.rail-region-head')).toHaveLength(1)
  })
})

describe('Continent name (structure spec 3)', () => {
  it('Known id uses regionLabelKey i18n (asia → Asia)', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-region-head-left span').text()).toBe('亚洲')
  })

  it('Unknown id falls back to backend label', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'atlantis' })],
      regions: [{ id: 'atlantis', label: 'Atlantis', count: 1 }],
    })
    expect(w.get('.rail-region-head-left span').text()).toBe('Atlantis')
  })
})

describe('Collapse (structure spec 3, delete-code ③)', () => {
  it('Collapsed state: group container .is-folded, chevron .is-collapsed, but city rows still in DOM', () => {
    const store = usePhotosPlaces()
    store.toggleRegionFold('asia')
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-group-fold').classes()).toContain('is-folded')
    expect(w.get('.rail-region-chevron').classes()).toContain('is-collapsed')
    // Not v-if: city rows must remain mounted in the DOM (to keep lazy thumbnails alive).
    expect(w.find('.rail-place').exists()).toBe(true)
  })

  it('When not collapsed, no .is-folded / .is-collapsed', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    expect(w.get('.rail-group-fold').classes()).not.toContain('is-folded')
    expect(w.get('.rail-region-chevron').classes()).not.toContain('is-collapsed')
  })
})

describe('Emit (structure spec 3, delete-code ④)', () => {
  it('Click group header emits toggle-fold with region id', async () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia' })] })
    await w.get('.rail-region-head').trigger('click')
    expect(w.emitted('toggle-fold')).toEqual([['asia']])
  })

  it('Click city row emits pick with String()-normalized id (fixture with numeric key)', async () => {
    // Place.id is always string by type; here we use a runtime type violation (id is actually number)
    // to truly pin down the String(p.id) line in the component — otherwise removing String() wouldn't make the test fail
    // (same precedent as placesMap.test.ts:119–126 buildPins test).
    const runtimeNumericId = 7 as unknown as string
    const w = mountRail({ places: [place({ id: runtimeNumericId, key: 7, region: 'asia' })] })
    await w.get('.rail-place').trigger('click')
    expect(w.emitted('pick')).toEqual([['7']])
  })
})

describe('activeId (law of the land)', () => {
  it('When activeId is numeric string and place id comes from int32 normalization, .is-active hits', () => {
    // activeId prop is always string by type; here we similarly use runtime type violation (actually number)
    // to pin down String(activeId) normalization on the component side, not relying on both sides happening to already be strings.
    const runtimeNumericActiveId = 7 as unknown as string
    const w = mountRail({
      places: [place({ id: '7', key: 7, region: 'asia' })],
      activeId: runtimeNumericActiveId,
    })
    expect(w.get('.rail-place').classes()).toContain('is-active')
  })

  it('When activeId does not match, no .is-active', () => {
    const w = mountRail({ places: [place({ id: '7', region: 'asia' })], activeId: '9' })
    expect(w.get('.rail-place').classes()).not.toContain('is-active')
  })
})

describe('Thumbnail (structure spec 3, delete-code ⑤)', () => {
  it('If coverAssetId exists, use it; src comes from service.photos.thumbnailUrl', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: 'cover1', thumbs: ['t1'] })] })
    expect(w.get('.thumb img').attributes('src')).toBe('mock://thumb/cover1/large')
    expect(thumbnailUrl).toHaveBeenCalledWith('cover1', 'large')
  })

  it('Without coverAssetId, use thumbs[0]', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: '', thumbs: ['t9'] })] })
    expect(w.get('.thumb img').attributes('src')).toBe('mock://thumb/t9/large')
  })

  it('When both coverAssetId and thumbs[0] are empty, img does not render (avoid empty src request)', () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', coverAssetId: '', thumbs: [] })] })
    expect(w.find('.thumb img').exists()).toBe(false)
  })
})

describe('Search (structure spec 3 + search state overrides collapse)', () => {
  it('Input HANG hits Hangzhou (case-insensitive)', async () => {
    const w = mountRail({
      places: [
        place({ id: 'a', region: 'asia', city: 'Hangzhou' }),
        place({ id: 'b', region: 'asia', city: 'Kyoto' }),
      ],
    })
    await w.get('.map-search input').setValue('HANG')
    expect(w.findAll('.rail-place')).toHaveLength(1)
    expect(w.get('.name').text()).toBe('Hangzhou')
  })

  it('When search is non-empty, collapse is overridden (collapsed contains asia but still expands — component does not rewrite the logic)', async () => {
    const store = usePhotosPlaces()
    store.toggleRegionFold('asia')
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' })] })
    expect(w.get('.rail-group-fold').classes()).toContain('is-folded')
    await w.get('.map-search input').setValue('hang')
    expect(w.get('.rail-group-fold').classes()).not.toContain('is-folded')
  })
})

describe('Empty state three-way (structure spec 4)', () => {
  it('!loaded → skeleton', () => {
    const w = mountRail({ loaded: false, places: [] })
    expect(w.find('[data-test="rail-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(false)
  })

  it('loaded and zero places → photosPlacesEmpty + Hint', () => {
    const w = mountRail({ loaded: true, places: [] })
    expect(w.text()).toContain('还没有带位置信息的照片')
    expect(w.text()).toContain('相册会在索引照片时读取 GPS 信息')
  })

  it('Search yields no results → photosPlacesSearchEmpty, copy contains query term', async () => {
    const w = mountRail({ places: [place({ id: 'a', region: 'asia', city: 'Hangzhou' })] })
    await w.get('.map-search input').setValue('zzz')
    expect(w.text()).toContain('没有匹配「zzz」的城市')
  })
})

// Review I3 (New-UI addition, no Vue2 equivalent): places.length === 0 used to unconditionally display "no photos with location info",
// but the incoming places list is already filtered — the library clearly has places, only the filter narrows the result to zero,
// causing users to think indexing is broken. totalPlaces (total unfiltered length) is used to distinguish between the two empty states.
describe('Filtered to empty vs truly no location data (Review I3)', () => {
  it('totalPlaces === 0 → show "no photos with location info" (truly no data)', () => {
    const w = mountRail({ places: [], totalPlaces: 0 })
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-filter-empty"]').exists()).toBe(false)
    expect(w.text()).toContain('还没有带位置信息的照片')
  })

  it('totalPlaces > 0 but filtered to empty → show "no cities matching current filter", not old copy', () => {
    const w = mountRail({ places: [], totalPlaces: 30 })
    expect(w.find('[data-test="rail-filter-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="rail-empty"]').exists()).toBe(false)
    expect(w.text()).toContain('没有符合当前筛选条件的城市')
    expect(w.text()).not.toContain('还没有带位置信息的照片')
  })
})

describe('Date localization (structure spec 5, deviation note 2)', () => {
  it('When lastDate is non-empty, backend original string does not appear, use localization', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })],
    })
    expect(w.text()).not.toContain('Mar 7, 2026')
  })

  it('When lastDate is null, fall back to showing backend original string', () => {
    const w = mountRail({
      places: [place({ id: 'a', region: 'asia', last: 'Mar 7, 2026', lastDate: null })],
    })
    expect(w.text()).toContain('Mar 7, 2026')
  })
})

describe('Hover background not stolen by base class rules (style point, delete-code ⑥)', () => {
  it('.rail-place.is-active hover background belongs to variant rule, not base .rail-place:hover', () => {
    const styleText = extractStyleBlock(placesRailRaw)
    const win = winningHoverBackground(styleText, ['rail-place', 'is-active'])
    expect(win.selector).toContain('is-active')
  })

  // The previous test uses winningHoverBackground() to assert "who wins under current write order", but in this file
  // `.rail-place.is-active` (specificity (0,2,0)) happens to be written after `.rail-place:hover` (also (0,2,0)),
  // so the previous test passes just by write order — when deleting the dedicated `.rail-place.is-active:hover` rule
  // for delete-code verification, the previous test would not fail in real-device validation (documented in report).
  // This one changes the assertion to "there exists one rule matching is-active with specificity strictly higher than base
  // .rail-place:hover" — specificity (0,3,0) > (0,2,0) is a hard fact independent of write order; deleting the dedicated :hover
  // rule will necessarily make this one fail, with no dependence on any "happens to be in right order" illusion.
  it('.is-active has one dedicated :hover rule with specificity strictly higher than base .rail-place:hover (not dependent on write order)', () => {
    const styleText = extractStyleBlock(placesRailRaw)
    const rules = hoverBackgroundRules(styleText, ['rail-place', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.rail-place:hover')
    const activeHover = rules.find(r => r.selector !== '.rail-place:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })
})
