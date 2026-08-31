// Tests for places-map geometry / filter predicates / date parsing.
// The high-risk cases are lifted from the brief character-for-character
// (parsePlaceLast/filterPlaces/buildPins/splitScaleFor/declutterPins/regionLabelKey/toPlace
// describe blocks); the remaining 13 implementation constraints are filled in via regular
// TDD (the MAX_SCALE literal, parsePlaceLast overflow round-trip validation,
// a single-member Pin carries no members/places key).
import { describe, expect, it } from 'vitest'
import { clusterByOverlap } from '../placesCluster'
import {
  MAX_SCALE, buildPins, declutterPins, extraFilterCount, filterPlaces, formatSpotCoords,
  groupByRegion, parsePlaceLast, regionLabelKey, searchPlaces, splitScaleFor,
  tierRadius, toPlace, visitedDots, type Place, type Pin,
} from '../placesMap'
import { project } from '../worldMap'

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7),
    trips: 1, home: false, thumbs: [], coverAssetId: '', ...over,
  }
}

describe('MAX_SCALE', () => {
  it('matches Vue2 PhotosPlacesView.vue:11, set to 16', () => {
    expect(MAX_SCALE).toBe(16)
  })
})

describe('parsePlaceLast', () => {
  it('parses the Go "Jan 2, 2006" layout (independent of host locale)', () => {
    const d = parsePlaceLast('Mar 7, 2026')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // 0-based
    expect(d.getDate()).toBe(7)
  })
  it('single-digit day and December both parse', () => {
    expect(parsePlaceLast('Jan 1, 2025')!.getMonth()).toBe(0)
    expect(parsePlaceLast('Dec 31, 2025')!.getMonth()).toBe(11)
  })
  it('empty string / malformed format / unknown month -> null (does not throw)', () => {
    expect(parsePlaceLast('')).toBeNull()
    expect(parsePlaceLast(null)).toBeNull()
    expect(parsePlaceLast(undefined)).toBeNull()
    expect(parsePlaceLast('2026-03-07')).toBeNull()
    expect(parsePlaceLast('Foo 7, 2026')).toBeNull()
  })
  it('overflow date (Feb 31) fails round-trip validation -> null, not allowed to be auto-rolled by Date into March 3', () => {
    expect(parsePlaceLast('Feb 31, 2026')).toBeNull()
  })
})

describe('filterPlaces -- This year no longer hardcodes the year (deviation log 1)', () => {
  const now = new Date(2030, 5, 1) // explicitly inject "now", independent of the system clock
  const base = { timeFilter: 'all' as const, customStart: '', customEnd: '', minCount: 0, regionFilter: null, recentOnly: false }

  it('the year branch judges by the injected current year; in 2030 it can filter to 2030 places', () => {
    const in2030 = place({ id: 'a', last: 'Feb 2, 2030', lastDate: parsePlaceLast('Feb 2, 2030') })
    const in2026 = place({ id: 'b', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })
    const out = filterPlaces([in2030, in2026], { ...base, timeFilter: 'year' }, now)
    expect(out.map(p => p.id)).toEqual(['a'])
  })

  it('a place with lastDate null is excluded in the year branch, kept in the all branch', () => {
    const broken = place({ id: 'x', last: '', lastDate: null })
    expect(filterPlaces([broken], { ...base, timeFilter: 'year' }, now)).toHaveLength(0)
    expect(filterPlaces([broken], base, now)).toHaveLength(1)
  })

  it('custom range uses a whole-day closed interval; a place on customEnd itself is not excluded', () => {
    const onEnd = place({ id: 'e', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })
    const out = filterPlaces([onEnd], { ...base, timeFilter: 'custom', customStart: '2026-03-01', customEnd: '2026-03-07' }, now)
    expect(out.map(p => p.id)).toEqual(['e'])
  })

  it('when only one end of custom is filled in, the whole time filter does not take effect (matches Vue2 :160)', () => {
    const p1 = place({ id: 'a', lastDate: parsePlaceLast('Mar 7, 2026') })
    expect(filterPlaces([p1], { ...base, timeFilter: 'custom', customStart: '2030-01-01', customEnd: '' }, now)).toHaveLength(1)
  })

  it('all four filters combined take effect in Vue2 order', () => {
    const hit = place({ id: 'hit', region: 'asia', count: 50, recent: true })
    const missCount = place({ id: 'mc', region: 'asia', count: 5, recent: true })
    const missRegion = place({ id: 'mr', region: 'europe', count: 50, recent: true })
    const missRecent = place({ id: 'mrc', region: 'asia', count: 50, recent: false })
    const out = filterPlaces([hit, missCount, missRegion, missRecent],
      { ...base, minCount: 10, regionFilter: 'asia', recentOnly: true }, now)
    expect(out.map(p => p.id)).toEqual(['hit'])
  })
})

describe('buildPins', () => {
  it('when scale >= MAX_SCALE, every city becomes its own pin (never leaves an un-splittable cluster)', () => {
    // two cities with identical coordinates: clusterByOverlap merges them at any scale
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120, lat: 30, count: 10 })
    expect(buildPins([a, b], 1, null).filter(p => p.cluster)).toHaveLength(1)
    const atMax = buildPins([a, b], MAX_SCALE, null)
    expect(atMax).toHaveLength(2)
    expect(atMax.every(p => !p.cluster)).toBe(true)
  })

  it('at max zoom, two coincident pins are pushed apart by declutter (each keeps a clickable position)', () => {
    const a = place({ id: 'a', lon: 120, lat: 30 })
    const b = place({ id: 'b', lon: 120, lat: 30 })
    const [pa, pb] = buildPins([a, b], MAX_SCALE, null)
    expect(Math.hypot(pb.x - pa.x, pb.y - pa.y)).toBeGreaterThan(0)
  })

  it('hitR is never smaller than 9/scale (so small pins stay easy to click)', () => {
    const pins = buildPins([place({ count: 1 })], 8, null)
    expect(pins[0].hitR).toBeGreaterThanOrEqual(9 / 8)
  })

  it('active normalizes via String(): a place with a numeric key is matched by a string activeId (hard rule)', () => {
    const p1 = place({ id: '7', key: 7 })
    expect(buildPins([p1], MAX_SCALE, '7')[0].active).toBe(true)
  })
  it('active still matches via String() normalization even when the runtime type is violated (activeId is actually a number)', () => {
    // Place.id is always string at the type level, and both sides of the brief's given case
    // are already strings, so deleting the String() normalization would not turn this red
    // (an actual observation from mutation-deletion check #4, recorded in the report). This
    // case, by passing a runtime type that illegally bypasses TS (activeId given as a number),
    // genuinely pins down the String() normalization line itself.
    const p1 = place({ id: '7', key: 7 })
    const runtimeNumericActiveId = 7 as unknown as string
    expect(buildPins([p1], MAX_SCALE, runtimeNumericActiveId)[0].active).toBe(true)
  })

  it('a cluster active is true when any member matches, with id cluster:<lead.id>', () => {
    const big = place({ id: 'big', lon: 120, lat: 30, count: 500 })
    const small = place({ id: 'small', lon: 120.05, lat: 30, count: 5 })
    const [pin] = buildPins([big, small], 1, 'small')
    expect(pin.cluster).toBe(true)
    expect(pin.id).toBe('cluster:big')
    expect(pin.active).toBe(true)
  })

  it('a single-member pin has no members/places key (not explicit undefined)', () => {
    const p1 = place({ id: 'solo' })
    const [pin] = buildPins([p1], 1, null) as unknown as Array<Record<string, unknown>>
    expect(pin.cluster).toBe(false)
    expect('members' in pin).toBe(false)
    expect('places' in pin).toBe(false)
  })
})

describe('splitScaleFor', () => {
  it('fewer than 2 members -> MAX_SCALE', () => {
    expect(splitScaleFor([place()], 1)).toBe(MAX_SCALE)
    expect(splitScaleFor([], 1)).toBe(MAX_SCALE)
  })
  it('identical coordinates (cannot split) -> MAX_SCALE', () => {
    const a = place({ id: 'a', lon: 120, lat: 30 })
    const b = place({ id: 'b', lon: 120, lat: 30 })
    expect(splitScaleFor([a, b], 1)).toBe(MAX_SCALE)
  })
  it('when splittable, the return value is > current scale and <= MAX_SCALE, and at that scale it really does split into >= 2', () => {
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120.4, lat: 30, count: 10 })
    const s = splitScaleFor([a, b], 1)
    expect(s).toBeGreaterThan(1)
    expect(s).toBeLessThanOrEqual(MAX_SCALE)
    expect(buildPins([a, b], s, null).length).toBeGreaterThanOrEqual(2)
  })
  it('the return value really is the binary-search boundary hi times 1.04, not bare hi (pins down `hi * 1.04`, mutation-deletion check #7)', () => {
    // The previous case's assertion (>=2 clusters at s) is not enough to pin down
    // `hi * 1.04` -- deleting it down to `hi`, the hi that binary search itself converges to
    // still satisfies the invariant clusters(hi) >= 2 (the binary-search loop only narrows hi
    // to mid when it verifies >=2), so even with *1.04 removed, `s` still yields >= 2 clusters
    // and the test would still be green (confirmed by actually running it; this real
    // observation is recorded in the report).
    // Asserting directly that `s / 1.04` yields < 2 clusters does not work either: s / 1.04 is
    // just hi itself (multiplication and division are inverses), and clusters(hi) >= 2 always
    // holds, so this assertion would also fail against the "correct implementation" (verified
    // by actually running it, not guessed).
    // The way to really pin down this line: reproduce the same binary search independently in
    // the test using the equally-trusted clusterByOverlap + tierRadius + project (not by
    // importing splitScaleFor internals), derive hi, and then assert directly that the return
    // value equals hi * 1.04 -- an exact numeric equality, not dependent on the cluster count
    // flipping by chance across a floating-point boundary.
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120.4, lat: 30, count: 10 })
    const currentScale = 1
    const projected = [a, b].map(m => ({ ...m, ...project(m.lon, m.lat) }))
    let lo = currentScale
    let hi = MAX_SCALE
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2
      if (clusterByOverlap(projected, mid, tierRadius).length >= 2)
        hi = mid
      else
        lo = mid
    }
    const expected = Math.min(MAX_SCALE, hi * 1.04)
    const s = splitScaleFor([a, b], currentScale)
    expect(s).toBeCloseTo(expected, 9)
    // and it really is a solid 4% larger than bare hi, not just coincidentally close
    expect(s).toBeGreaterThan(hi * 1.03)
  })
})

describe('declutterPins', () => {
  it('mutates in place: coincident pins are pushed apart to >= minSep (golden-angle direction, deterministic)', () => {
    const pins = [
      { x: 100, y: 100 }, { x: 100, y: 100 },
    ] as unknown as Pin[]
    declutterPins(pins, 10)
    expect(Math.hypot(pins[1].x - pins[0].x, pins[1].y - pins[0].y)).toBeGreaterThanOrEqual(9.9)
  })
  it('returns immediately when there are fewer than 2 pins (does not throw)', () => {
    const one = [{ x: 1, y: 1 }] as unknown as Pin[]
    expect(() => declutterPins(one, 10)).not.toThrow()
    expect(one[0]).toEqual({ x: 1, y: 1 })
  })
  it('two calls with the same input produce the same result (deterministic, no randomness)', () => {
    const mk = () => ([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }] as unknown as Pin[])
    const a = mk(); declutterPins(a, 8)
    const b = mk(); declutterPins(b, 8)
    expect(a).toEqual(b)
  })
})

describe('regionLabelKey (deviation log 3)', () => {
  it('each of the six known continents has a key', () => {
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica'])
      expect(regionLabelKey(id)).toMatch(/^photosPlacesRegion/)
  })
  it('unknown id -> null (caller falls back to the backend label)', () => {
    expect(regionLabelKey('atlantis')).toBeNull()
    expect(regionLabelKey('')).toBeNull()
  })
})

describe('toPlace', () => {
  it('a numeric backend key is normalized into a string id, the original key is kept', () => {
    const p1 = toPlace({ key: 42, city: 'X', country: 'Y', region: 'asia', lon: 1, lat: 2, count: 3, last: 'Mar 7, 2026' })
    expect(p1.id).toBe('42')
    expect(p1.key).toBe(42)
    expect(p1.lastDate?.getFullYear()).toBe(2026)
  })
  it('a null slice and missing fields fall back to defaults (Go nil slice -> null)', () => {
    const p1 = toPlace({ key: 1, thumbs: null, coverAssetId: undefined, recent: undefined })
    expect(p1.thumbs).toEqual([])
    expect(p1.coverAssetId).toBe('')
    expect(p1.recent).toBe(false)
  })
})

describe('formatSpotCoords (deviation log 16: Vue2 :1129 hardcodes ° N/° E, giving the wrong direction for the southern/western hemispheres)', () => {
  it('northern/eastern hemisphere', () => {
    expect(formatSpotCoords(30.2741, 120.1551)).toBe('30.274° N · 120.155° E')
  })
  it('south/east (note .8688 rounds to .869)', () => {
    expect(formatSpotCoords(-33.8688, 151.2093)).toBe('33.869° S · 151.209° E')
  })
  it('north/west', () => {
    expect(formatSpotCoords(40.7128, -74.006)).toBe('40.713° N · 74.006° W')
  })
  it('south/west', () => {
    expect(formatSpotCoords(-22.9068, -43.1729)).toBe('22.907° S · 43.173° W')
  })
  it('zero normalizes to N/E (equator / prime meridian)', () => {
    expect(formatSpotCoords(0, 0)).toBe('0.000° N · 0.000° E')
  })
  it('non-finite values (NaN/Infinity) return an empty string', () => {
    expect(formatSpotCoords(Number.NaN, 10)).toBe('')
    expect(formatSpotCoords(10, Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('visitedDots / groupByRegion / searchPlaces / tierRadius / extraFilterCount', () => {
  it('tierRadius three-tier thresholds', () => {
    expect(tierRadius(39)).toBe(7)
    expect(tierRadius(40)).toBe(11)
    expect(tierRadius(99)).toBe(11)
    expect(tierRadius(100)).toBe(16)
  })
  it('visitedDots judges using a 3.5-degree square window', () => {
    const near = place({ lon: 120, lat: 30 })
    const dots = visitedDots([near])
    expect(dots.some(d => d.visited)).toBe(true)
    expect(dots.filter(d => d.visited).every(d => Math.abs(d.lon - 120) < 3.5 && Math.abs(d.lat - 30) < 3.5)).toBe(true)
  })
  it('groupByRegion sorts within each bucket by count descending', () => {
    const g = groupByRegion([place({ id: 'a', count: 5 }), place({ id: 'b', count: 50 })])
    expect(g.asia.map(p => p.id)).toEqual(['b', 'a'])
  })
  it('searchPlaces returns as-is for an empty query, matches city or country, case-insensitive', () => {
    const all = [place({ id: 'a', city: 'Hangzhou', country: 'China' }), place({ id: 'b', city: 'Paris', country: 'France' })]
    expect(searchPlaces(all, '   ')).toBe(all)
    expect(searchPlaces(all, 'HANG').map(p => p.id)).toEqual(['a'])
    expect(searchPlaces(all, 'france').map(p => p.id)).toEqual(['b'])
  })
  it('extraFilterCount scores one point per active item, three items total', () => {
    expect(extraFilterCount({ timeFilter: 'all', customStart: '', customEnd: '', minCount: 10, regionFilter: 'asia', recentOnly: true })).toBe(3)
    expect(extraFilterCount({ timeFilter: 'year', customStart: '', customEnd: '', minCount: 0, regionFilter: null, recentOnly: false })).toBe(0)
  })
})
