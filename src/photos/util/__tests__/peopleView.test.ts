import { describe, it, expect } from 'vitest'
import {
  toPerson, personInitial, namedOf, unnamedOf, visibleUnnamedOf,
  hiddenSingletonCountOf, unnamedCountAt, sortNamed, monthKeyLabel, mergeConfidencePct,
  mergeReasonKey, nimoReadParts,
  PLACE_PALETTE, groupPlaces, colorPoints,
  topPersons, topPlaces, byYear, resolvePersonByName,
  type Person, type PersonPlace, type PlaceGroup,
} from '../peopleView'
import type { Photo } from '../assetToPhoto'

const P = (over: Partial<Person>): Person => ({
  id: 'x', name: '', confidence: 1, count: 5, favorite: false, relation: '',
  coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0, ...over,
})

describe('toPerson', () => {
  it('missing fields all fall back to safe defaults', () => {
    expect(toPerson({ id: 7 })).toMatchObject({
      id: 7, name: '', confidence: 0, count: 0, favorite: false, relation: '',
      coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    })
  })
  it('keeps a numeric id without stringifying it', () => { expect(toPerson({ id: 12 }).id).toBe(12) })
  it('confidence/count are normalized via Number', () => {
    expect(toPerson({ id: 1, confidence: 0.82, count: 3 })).toMatchObject({ confidence: 0.82, count: 3 })
  })
})

describe('personInitial', () => {
  it('takes the uppercase first letter after trimming', () => { expect(personInitial(' sara')).toBe('S') })
  it('empty/whitespace-only/non-string → empty string', () => {
    expect(personInitial('')).toBe(''); expect(personInitial('   ')).toBe(''); expect(personInitial(null)).toBe('')
  })
})

describe('namedOf / unnamedOf', () => {
  const list = [P({ id: 1, name: '小明' }), P({ id: 2, name: '' }), P({ id: 3, name: '   ' })]
  it('named = name is non-blank', () => { expect(namedOf(list).map((p) => p.id)).toEqual([1]) })
  it('unnamed = the complement of named; the union of both equals the full set', () => {
    expect(unnamedOf(list).map((p) => p.id)).toEqual([2, 3])
    expect(namedOf(list).length + unnamedOf(list).length).toBe(list.length)
  })
  it('does not change the original order or mutate the input in place', () => {
    const src = [...list]; namedOf(src); expect(src.map((p) => p.id)).toEqual([1, 2, 3])
  })
})

describe('visibleUnnamedOf', () => {
  const un = [
    P({ id: 'a', confidence: 0.8, count: 5 }),   // exactly equal to the 80 threshold
    P({ id: 'b', confidence: 0.79, count: 5 }),  // below threshold
    P({ id: 'c', confidence: 0.95, count: 1 }),  // single photo
  ]
  it('threshold is a closed interval >= (0.8*100 === 80 must be kept)', () => {
    expect(visibleUnnamedOf(un, { confidence: 80, showSingletons: false }).map((p) => p.id)).toEqual(['a'])
  })
  it('showSingletons on lets single photos through', () => {
    expect(visibleUnnamedOf(un, { confidence: 80, showSingletons: true }).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('is strictly complementary with hiddenSingletonCountOf', () => {
    const f = { confidence: 80, showSingletons: false }
    const atThreshold = un.filter((p) => p.confidence * 100 >= f.confidence).length
    expect(visibleUnnamedOf(un, f).length + hiddenSingletonCountOf(un, f)).toBe(atThreshold)
  })
  it('hidden is always 0 when showSingletons is on', () => {
    expect(hiddenSingletonCountOf(un, { confidence: 50, showSingletons: true })).toBe(0)
  })
})

describe('unnamedCountAt', () => {
  const un = [P({ id: 'a', confidence: 0.9, count: 4 }), P({ id: 'b', confidence: 0.6, count: 4 }), P({ id: 'c', confidence: 0.9, count: 1 })]
  it('previews using the passed-in threshold, unaffected by the current threshold', () => {
    expect(unnamedCountAt(un, 50, false)).toBe(2)
    expect(unnamedCountAt(un, 90, false)).toBe(1)
  })
  it('showSingletons participates in the determination', () => { expect(unnamedCountAt(un, 90, true)).toBe(2) })
})

describe('sortNamed', () => {
  const NOW = Date.parse('2026-07-28T00:00:00Z')
  const day = (n: number) => new Date(NOW - n * 864e5).toISOString()
  const list = [
    P({ id: 'a', name: 'Beta', relation: 'family', lastSeen: day(10), firstSeen: day(400) }),
    P({ id: 'b', name: 'Alpha', relation: 'work', lastSeen: day(200), firstSeen: day(30) }),
    P({ id: 'c', name: 'Gamma', relation: 'family', lastSeen: null, firstSeen: null }),
  ]
  it('all + freq → original order (trusts backend ordering)', () => {
    expect(sortNamed(list, 'all', 'freq', NOW).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
  it('filters by relation group', () => {
    expect(sortNamed(list, 'family', 'freq', NOW).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('recent filter = within 90 days and lastSeen exists', () => {
    expect(sortNamed(list, 'recent', 'freq', NOW).map((p) => p.id)).toEqual(['a'])
  })
  it('the 90-day window for recent is a closed interval (exactly 90 days ago is still kept)', () => {
    const edge = [P({ id: 'e', name: 'E', lastSeen: new Date(NOW - 90 * 864e5).toISOString() })]
    expect(sortNamed(edge, 'recent', 'freq', NOW).map((p) => p.id)).toEqual(['e'])
  })
  it('name alphabetical / recent most-recent-first / oldest earliest-first', () => {
    expect(sortNamed(list, 'all', 'name', NOW).map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sortNamed(list, 'all', 'recent', NOW).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(sortNamed(list, 'all', 'oldest', NOW).map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
  it('does not mutate the input array in place', () => {
    const src = [...list]; sortNamed(src, 'all', 'name', NOW); expect(src.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('monthKeyLabel', () => {
  it('YYYY-MM → full English month name + year', () => { expect(monthKeyLabel('2026-03')).toBe('March 2026') })
  it('returns the key unchanged for an invalid month', () => {
    expect(monthKeyLabel('2026-13')).toBe('2026-13')
    expect(monthKeyLabel('unknown')).toBe('unknown')
  })
  it('empty/non-string → empty string', () => { expect(monthKeyLabel('')).toBe(''); expect(monthKeyLabel(null)).toBe('') })
})

describe('mergeConfidencePct', () => {
  it('0~1 → integer percentage, missing counts as 0', () => {
    expect(mergeConfidencePct(0.876)).toBe(88); expect(mergeConfidencePct(undefined)).toBe(0)
  })
})

const UNKNOWN = '未知'
const PL = (over: Partial<PersonPlace>): PersonPlace => ({ placeName: null, latitude: null, longitude: null, ...over })

describe('groupPlaces (PhotosPersonDetail.vue:537-551)', () => {
  it('placeName takes priority, does not look up coordinates', () => {
    const g = groupPlaces([PL({ placeName: 'Paris', latitude: 999, longitude: 999 })], UNKNOWN)
    expect(g).toEqual([{ name: 'Paris', count: 1, color: PLACE_PALETTE[0] }])
  })

  it('missing placeName but has coordinates → falls back to countryFromCoords reverse lookup', () => {
    // 46.6N, 2.4E is the center of mainland France; the France bounding box in the COUNTRIES
    // table in assetToPhoto.ts has already been verified to match.
    const g = groupPlaces([PL({ latitude: 46.6, longitude: 2.4 })], UNKNOWN)
    expect(g).toEqual([{ name: 'France', count: 1, color: PLACE_PALETTE[0] }])
  })

  it('neither placeName nor a coordinate match → unknownLabel (a pure function; the label is passed in by the caller, no i18n dependency)', () => {
    // -20, -140 falls in the South Pacific high seas; the country bounding box table in
    // assetToPhoto.ts has already been verified to match no country.
    const g1 = groupPlaces([PL({})], UNKNOWN)
    const g2 = groupPlaces([PL({ latitude: -20, longitude: -140 })], UNKNOWN)
    expect(g1).toEqual([{ name: UNKNOWN, count: 1, color: PLACE_PALETTE[0] }])
    expect(g2).toEqual([{ name: UNKNOWN, count: 1, color: PLACE_PALETTE[0] }])
  })

  it('sorted by count descending', () => {
    const places = [
      PL({ placeName: 'A' }), PL({ placeName: 'B' }),
      PL({ placeName: 'A' }), PL({ placeName: 'A' }),
    ]
    const g = groupPlaces(places, UNKNOWN)
    expect(g.map((x) => [x.name, x.count])).toEqual([['A', 3], ['B', 1]])
  })

  it('7-color cycle boundary: the color of the 8th distinct place wraps back to PLACE_PALETTE[0]', () => {
    const places = Array.from({ length: 8 }, (_, i) => PL({ placeName: `P${i}` }))
    const g = groupPlaces(places, UNKNOWN)
    expect(g).toHaveLength(8)
    expect(g[0].color).toBe(PLACE_PALETTE[0])
    expect(g[6].color).toBe(PLACE_PALETTE[6])
    expect(g[7].color).toBe(PLACE_PALETTE[0]) // idx 7 % 7 === 0, collides in color with idx 0
  })
})

describe('colorPoints (PhotosPersonDetail.vue:552-570)', () => {
  it('keeps only points where typeof lat/lon are both number', () => {
    const places: PersonPlace[] = [
      PL({ placeName: 'A', latitude: 1, longitude: 2 }),
      PL({ placeName: 'B', latitude: null, longitude: 2 }),
      PL({ placeName: 'C', latitude: '3' as unknown as number, longitude: 4 }),
    ]
    const groups = groupPlaces(places, UNKNOWN)
    const pts = colorPoints(places, groups, UNKNOWN)
    expect(pts).toEqual([{ latitude: 1, longitude: 2, color: groups.find((g) => g.name === 'A')!.color }])
  })

  it('color matches its owning group', () => {
    const places = [
      PL({ placeName: 'A', latitude: 1, longitude: 1 }),
      PL({ placeName: 'A', latitude: 2, longitude: 2 }),
      PL({ placeName: 'B', latitude: 3, longitude: 3 }),
    ]
    const groups = groupPlaces(places, UNKNOWN) // A count=2 → idx0,B count=1 → idx1
    const pts = colorPoints(places, groups, UNKNOWN)
    expect(pts[0].color).toBe(PLACE_PALETTE[0])
    expect(pts[1].color).toBe(PLACE_PALETTE[0])
    expect(pts[2].color).toBe(PLACE_PALETTE[1])
  })

  it('falls back to PALETTE[0] when the name is not found in groups (e.g. mismatched groups passed in)', () => {
    const places = [PL({ placeName: 'Ghost', latitude: 5, longitude: 5 })]
    const pts = colorPoints(places, [], UNKNOWN)
    expect(pts).toEqual([{ latitude: 5, longitude: 5, color: PLACE_PALETTE[0] }])
  })
})

describe('mergeReasonKey', () => {
  it('s is empty → unnamed key, pct is 0', () => {
    expect(mergeReasonKey(null)).toEqual({ key: 'photosPeopleMergeReasonUnnamed', params: { pct: 0 } })
    expect(mergeReasonKey(undefined)).toEqual({ key: 'photosPeopleMergeReasonUnnamed', params: { pct: 0 } })
  })
  it('intoName is non-empty → named key, with name and pct', () => {
    expect(mergeReasonKey({ confidence: 0.876, intoName: '小明' })).toEqual({
      key: 'photosPeopleMergeReasonNamed', params: { pct: 88, name: '小明' },
    })
  })
  it('no intoName → unnamed key, with pct', () => {
    expect(mergeReasonKey({ confidence: 0.5 })).toEqual({
      key: 'photosPeopleMergeReasonUnnamed', params: { pct: 50 },
    })
  })
})

// Task 13 (SP7-P5 people): nimoReadParts — mirrors Vue2 PhotosPersonDetail.vue:571-585's
// (nimoRead computed) sentence-composition rule, ported into an i18n-independent pure
// function that returns {key, params}[] for the view layer to call t() on and concatenate.
describe('nimoReadParts (PhotosPersonDetail.vue:571-585)', () => {
  const PG = (name: string, count = 1): PlaceGroup => ({ name, count, color: PLACE_PALETTE[0] })

  it('has a named relation + two places → With + Places2, two segments', () => {
    const parts = nimoReadParts('小明', [{ name: '小红' }], [PG('北京'), PG('上海')])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } },
      { key: 'photosPersonInsightPlaces2', params: { place1: '北京', place2: '上海' } },
    ])
  })

  it('has a named relation + one place → With + Place1, two segments', () => {
    const parts = nimoReadParts('小明', [{ name: '小红' }], [PG('北京')])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } },
      { key: 'photosPersonInsightPlace1', params: { place: '北京' } },
    ])
  })

  it('no relation, no place → a single InsightNone', () => {
    expect(nimoReadParts('小明', [], [])).toEqual([
      { key: 'photosPersonInsightNone', params: { name: '小明' } },
    ])
  })

  it('relation exists but name is empty/missing → WithUnnamed (without other)', () => {
    const parts = nimoReadParts('小明', [{ name: '' }], [])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWithUnnamed', params: { name: '小明' } },
    ])
    // the name field being entirely missing (undefined) also falls into this branch.
    const parts2 = nimoReadParts('小明', [{}], [])
    expect(parts2).toEqual([
      { key: 'photosPersonInsightWithUnnamed', params: { name: '小明' } },
    ])
  })

  // Key regression (an easy-to-get-wrong point the brief hard-requires): Vue2 :573 uses
  // `this.relations[0]` — the first item in original order, not the first after sorting by
  // count. Here we deliberately place the relation with the "larger count" second in the
  // array, and assert that the person taken is still the first one in the array.
  //
  // Falsification check (already done, see the task report for the process): temporarily
  // changed the implementation to
  // `[...relations].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]` and reran — this test
  // went from green to red (it picked up "小刚" with the larger count instead of "小红" who is
  // first in the array) — proving this assertion really is guarding the "original order"
  // behavior, not just decoration. Reverted back to relations[0].
  it('takes relations[0], not the first after sorting by count', () => {
    const parts = nimoReadParts(
      '小明',
      [{ name: '小红', count: 1 } as { name: string; count: number }, { name: '小刚', count: 100 } as { name: string; count: number }],
      [],
    )
    expect(parts[0]).toEqual({ key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } })
  })
})

// Task 15A (SP7-P5): topPersons/topPlaces/byYear — mirrors Vue2
// PhotosFavoritesView.vue:369-385 (byPersonAll/byPlaceAll/byYearAll).
function ph(over: Partial<Photo> = {}): Photo {
  return {
    id: 'x', title: 'x', file: '', date: '', time: '', takenAt: null, indexedAt: null,
    mimeType: 'image/jpeg', fileSize: 0, isVideo: false, hasOcr: false, isNew: false,
    isLivePhoto: false, livePhotoVideoId: null, duration: null, durationMs: 0, fav: false,
    status: undefined, filePath: '', width: null, height: null, dim: null, size: '',
    latitude: null, longitude: null, coords: null, place: null, camera: null, iso: null,
    shutter: null, aperture: null, focal: null, orientation: null, videoCodec: null,
    audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

describe('topPersons (PhotosFavoritesView.vue:369-372)', () => {
  it('sorted by occurrence count descending', () => {
    const photos = [
      ph({ faces: ['Alice', 'Bob'] }),
      ph({ faces: ['Alice'] }),
      ph({ faces: ['Bob', 'Alice'] }),
    ]
    expect(topPersons(photos)).toEqual([['Alice', 3], ['Bob', 2]])
  })
  it('does not blow up when faces is missing/empty, just skips it', () => {
    expect(topPersons([ph({ faces: undefined as unknown as string[] }), ph({ faces: [] })])).toEqual([])
  })
})

describe('topPlaces (PhotosFavoritesView.vue:373-377)', () => {
  it('skips falsy place, sorted by occurrence count descending', () => {
    const photos = [
      ph({ place: 'Paris, France' }), ph({ place: null }), ph({ place: 'Paris, France' }), ph({ place: 'Tokyo' }),
    ]
    expect(topPlaces(photos)).toEqual([['Paris, France', 2], ['Tokyo', 1]])
  })
})

describe('byYear (PhotosFavoritesView.vue:378-385)', () => {
  it('skips empty takenAt, sorted by year string descending — not by count', () => {
    // 2024 appears only once and 2025 appears twice: if mistakenly sorted by count, 2025 would
    // come first; the correct implementation sorts by year string descending, where 2025 still
    // comes first but for a different reason — a third year is used to fully diverge the results
    // of the two rules: 2023 appears 3 times (the highest count) but has the smallest year, and
    // must sort last.
    const photos = [
      ph({ takenAt: '2023-01-01' }), ph({ takenAt: '2023-06-01' }), ph({ takenAt: '2023-12-01' }),
      ph({ takenAt: '2024-01-01' }),
      ph({ takenAt: '2025-01-01' }), ph({ takenAt: '2025-06-01' }),
      ph({ takenAt: null }), ph({ takenAt: '' }),
    ]
    expect(byYear(photos)).toEqual([['2025', 2], ['2024', 1], ['2023', 3]])
  })

  // Mutation check ① (see the task report): temporarily changed the sort key to count
  // descending (`b[1] - a[1]`) and reran this test — the assertion went from green to red (2023
  // with count=3 would jump to the front instead of sorting after 2025/2024) — proving the
  // assertion above really is guarding the "by year, not by count" rule, not just decoration.
  // Reverted back to sorting by year string descending.
})

describe('resolvePersonByName (Task 15B, PhotosLightbox.vue:125-129 prerequisite fact correction)', () => {
  const P = (over: Partial<Person>): Person => ({
    id: 'x', name: '', confidence: 1, count: 5, favorite: false, relation: '',
    coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0, ...over,
  })
  it('returns the person on a unique match', () => {
    const people = [P({ id: 1, name: 'Alice' }), P({ id: 2, name: 'Bob' })]
    expect(resolvePersonByName(people, 'Alice')).toEqual(people[0])
  })
  it('two people with the same name → null (better to fall back to the initial than show the wrong face)', () => {
    const people = [P({ id: 1, name: 'Alice' }), P({ id: 2, name: 'Alice' })]
    expect(resolvePersonByName(people, 'Alice')).toBeNull()
  })
  it('no match → null', () => {
    expect(resolvePersonByName([P({ id: 1, name: 'Alice' })], 'Zoe')).toBeNull()
  })
  it('trims both sides, case-sensitive exact comparison', () => {
    const people = [P({ id: 1, name: ' Alice ' })]
    expect(resolvePersonByName(people, 'Alice')).toEqual(people[0])
    expect(resolvePersonByName(people, '  Alice')).toEqual(people[0])
    expect(resolvePersonByName(people, 'alice')).toBeNull() // case-sensitive, no fuzzy matching
  })
})
