// The mixed manual/smart album list and the global sort that ranks both
// kinds against each other. Ported from Vue2 939a7d3a:PhotosAlbumsView.vue:381-393
// (smartAlbums / mixedAlbums) and :670-700 (applySort).
import { describe, it, expect } from 'vitest'
import { buildMixedAlbums, sortMixed, type MixedAlbumItem } from '../mixedAlbums'
import type { AlbumView } from '../albumView'
import type { SmartView } from '../../stores/smartViews'

const view = (o: Partial<AlbumView>): AlbumView => ({
  id: 'u', title: '', cover: null, count: 0, dateRange: '',
  createdAt: null, videoCount: 0, dateStart: null, ...o,
})
const sv = (o: Partial<SmartView>): SmartView => ({
  id: 's', name: '', description: '', conds: [], threshold: 0, live: false,
  includeVideos: false, count: 0, addedThisWeek: 0, seeds: [], median: 0,
  storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '', ...o,
})
const ids = (items: MixedAlbumItem[]) => items.map((i) => String(i.id))

describe('buildMixedAlbums', () => {
  it('tags each entry with its kind and keeps the payload reachable', () => {
    const out = buildMixedAlbums([view({ id: 'u1', title: 'A' })], [sv({ id: 's1', name: 'B' })])
    const user = out.find((i) => i.kind === 'user')
    const smart = out.find((i) => i.kind === 'smart')
    expect(user?.kind === 'user' && user.view.title).toBe('A')
    expect(smart?.kind === 'smart' && smart.sv.name).toBe('B')
  })

  it('surfaces the id at the top level so callers do not reach into the payload for keys', () => {
    const out = buildMixedAlbums([view({ id: 7 })], [sv({ id: 's1' })])
    expect(ids(out).sort()).toEqual(['7', 's1'])
  })
})

describe('sortMixed', () => {
  // Titles, counts and dates are deliberately staggered across the two kinds so that a
  // comparator that only ever looks at one kind's field cannot pass.
  const items = buildMixedAlbums(
    [
      view({ id: 'u1', title: 'Beta', count: 3, createdAt: '2026-01-01T00:00:00Z', dateStart: '2024-01-01' }),
      view({ id: 'u2', title: 'Delta', count: 9, createdAt: '2025-01-01T00:00:00Z', dateStart: '2026-01-01' }),
    ],
    [
      sv({ id: 's1', name: 'Alpha', count: 5, createdAt: '2026-06-01T00:00:00Z' }),
      sv({ id: 's2', name: 'Gamma', count: 1, createdAt: '' }),
    ],
  )

  it('sorts by name across both kinds, not smart-first', () => {
    // Titles are Alpha(s1)/Gamma(s2)/Beta(u1)/Delta(u2). Alphabetically that is
    // Alpha, Beta, Delta, Gamma -- 'D' sorts before 'G', so u2 (Delta) outranks
    // s2 (Gamma). (Corrected from the task brief, which had s2/u2 swapped.)
    expect(ids(sortMixed(items, 'name'))).toEqual(['s1', 'u1', 'u2', 's2'])
    expect(ids(sortMixed(items, 'name-r'))).toEqual(['s2', 'u2', 'u1', 's1'])
  })

  it('sorts by photo count descending across both kinds', () => {
    expect(ids(sortMixed(items, 'count'))).toEqual(['u2', 's1', 'u1', 's2'])
  })

  // THE POINT OF THIS TASK. Vue2 939a7d3a:PhotosAlbumsView.vue:686-693 puts a missing
  // timestamp FIRST, with its own comment explaining why: treating it as epoch 0 would
  // bury it at the end instead. This is the opposite of what albumView.sortAlbums used
  // to assert ("missing recorded as 0, sorted last"), and reverting it is a regression, not a cleanup.
  it('ranks a missing createdAt FIRST, not last', () => {
    expect(ids(sortMixed(items, 'created'))).toEqual(['s2', 's1', 'u1', 'u2'])
  })

  // Distinct from the '' (empty-string) createdAt exercised above -- '' short-circuits on
  // `msOf`'s `!raw` check before Date.parse ever runs, so it cannot catch a broken
  // `isNaN` branch. This fixture is non-empty but unparseable, so it only lands in the
  // missing-first group if msOf's `isNaN(t) ? null : t` fires.
  it('treats an unparseable createdAt as missing, same as an absent one', () => {
    // 'valid' is smart, 'garbage' is user, so buildMixedAlbums' pre-sort order is
    // already ['valid', 'garbage'] (smart-first concatenation) -- the opposite of the
    // expected post-sort order below. That is deliberate: a broken isNaN check that
    // lets NaN leak into the subtraction makes the comparator a no-op (NaN - x is NaN,
    // which V8's sort treats as "no swap"), silently preserving the pre-sort order and
    // passing for the wrong reason if the two orders happened to coincide.
    const garbage = buildMixedAlbums(
      [view({ id: 'garbage', createdAt: 'not-a-date' })],
      [sv({ id: 'valid', createdAt: '2026-01-01T00:00:00Z' })],
    )
    expect(ids(sortMixed(garbage, 'created'))).toEqual(['garbage', 'valid'])
  })

  it('ranks a missing date FIRST too, and reads dateStart for manual albums', () => {
    // u2's dateStart (2026-01-01) beats u1's (2024-01-01) even though u1 was created
    // later, which is what proves 'date' does not just fall through to createdAt for
    // manual albums. Smart albums have no earliest-member aggregate, so they fall back
    // to createdAt (Vue2 :684) -- a real degradation, not a defect. s1's createdAt
    // (2026-06-01) is later than u2's dateStart (2026-01-01), so s1 still outranks u2.
    // (Corrected from the task brief, which had s1/u2 swapped.)
    expect(ids(sortMixed(items, 'date'))).toEqual(['s2', 's1', 'u2', 'u1'])
  })

  it('leaves the order untouched for an unknown sort id', () => {
    expect(ids(sortMixed(items, 'zzz'))).toEqual(ids(items))
  })

  it('does not mutate its input', () => {
    const before = ids(items)
    sortMixed(items, 'name')
    expect(ids(items)).toEqual(before)
  })
})
