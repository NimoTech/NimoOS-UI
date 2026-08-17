import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const smartSearchApi = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { smartSearch: (...a: unknown[]) => smartSearchApi(...a) } },
}))

import { usePhotosSearch } from '../search'

// Following usePersonDetail.test.ts technique: controllable deferred promise to precisely
// orchestrate race condition timing.
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}
// Bare asset fixture — assetToPhoto has fallback for all missing fields, here we only
// need to distinguish by id.
function assets(n: number, prefix = 'p'): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('smartSearch', () => {
  it('I2 case: search returns non-empty result first, then pass empty/whitespace query → truly invoke clear() semantics, reset all fields (not "was already empty")', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(3))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    // First confirm we really got results; below "reset after clear" only makes sense then
    // (else these assertions are always true on fresh store, cannot prove clear() was called).
    expect(s.results).toHaveLength(3)
    expect(s.isSearchMode).toBe(true)
    expect(s.ms).toBeGreaterThanOrEqual(0)
    smartSearchApi.mockClear()

    await s.smartSearch('   ') // empty/whitespace query
    expect(smartSearchApi).not.toHaveBeenCalled() // backend not called
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.isSearchMode).toBe(false)
    expect(s.exhausted).toBe(false)
  })

  it('first page success: results length = returned length, isSearchMode true, query is trimmed, offset 0, 50 items returned exhausted false, ms is precise delta', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50))
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1234)
    const s = usePhotosSearch()
    await s.smartSearch('  cat  ')
    expect(s.results).toHaveLength(50)
    expect(s.isSearchMode).toBe(true)
    expect(s.query).toBe('cat')
    expect(s.offset).toBe(0)
    expect(s.exhausted).toBe(false)
    expect(s.ms).toBe(234)
    nowSpy.mockRestore()
  })

  it('M6 case: backend Go nil slice serializes to null → ?? [] fallback, take success path not throw-into-catch', async () => {
    smartSearchApi.mockResolvedValueOnce(null)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    await expect(s.smartSearch('cat')).resolves.toBeUndefined()
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(true)
    expect(s.exhausted).toBe(true) // 0 items < LIMIT
    // discriminatory assertion: without `?? []` fallback, `null.map(...)` throws,
    // caught in catch; the failure fallback happens to land on same final state
    // (isSearchMode=true/results=[]/exhausted=true); just looking at above three
    // assertions cannot prove `?? []` wasn't deleted — real difference is "is this a real error?"
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('first page returns 49 items (<50) → exhausted true', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(49))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    expect(s.exhausted).toBe(true)
  })

  it('failure (fix guard): reject → isSearchMode true, results empty, query is new term, exhausted true ⇒ matchesQuery(new term) true (view shows empty state not permanent loading)', async () => {
    smartSearchApi.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    await s.smartSearch('dog')
    expect(s.isSearchMode).toBe(true)
    expect(s.results).toEqual([])
    expect(s.query).toBe('dog')
    expect(s.exhausted).toBe(true)
    expect(s.matchesQuery('dog')).toBe(true)
    errSpy.mockRestore()
  })

  it('race condition · late-arriving resolves first: search A (slow) → search B (fast) → B resolves first → A arrives late and discarded → final query===B', async () => {
    const dA = makeDeferred<unknown[]>()
    const dB = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockImplementationOnce(() => dB.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    const pB = s.smartSearch('B')
    dB.resolve(assets(1, 'b'))
    await flush()
    await pB
    expect(s.query).toBe('B')
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.query).toBe('B') // A's late response did not overwrite B
  })

  it('race condition · first-arriving resolves first: A fast B slow → final is still B (A\'s seq already behind, guard discards entire write)', async () => {
    const dA = makeDeferred<unknown[]>()
    const dB = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockImplementationOnce(() => dB.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    const pB = s.smartSearch('B')
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    // A resolves first but seq already behind B, guard blocks entire write — B still in flight now, query still initial empty string
    expect(s.query).toBe('')
    dB.resolve(assets(1, 'b'))
    await flush()
    await pB
    expect(s.query).toBe('B')
  })

  it('after clear(), in-flight response not filled back (new main guard for seq bump, Vue2 lacks this protection)', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    s.clear()
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(false)
  })

  it('error response can also be stale (M5: logs still need printing, state cannot be overwritten): search A (slow, ultimately rejects) → search B (fast, succeeds) → A\'s failure arrives late → console.error printed but does not overwrite B\'s success state', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockResolvedValueOnce(assets(1, 'b'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    await s.smartSearch('B') // succeeds immediately, writes query='B'
    expect(s.query).toBe('B')
    dA.reject(new Error('boom')) // A fails now — already stale, should not advance query to 'A'/exhausted etc
    await flush()
    await pA.catch(() => {}) // pA itself will not throw (catch swallowed it), here just wait for completion
    expect(s.query).toBe('B')
    expect(s.results).toHaveLength(1)
    // M5: stale failure is still a real backend error, logging discipline (every catch needs console.error)
    // cannot be skipped because "response already stale" — lost log = lost diagnostic signal
    expect(errSpy).toHaveBeenCalledWith('[photos-search] smartSearch', expect.any(Error))
    errSpy.mockRestore()
  })

  it('E3 case: search A in flight → smartSearch("") (empty query) → let A response resolve → results still empty, isSearchMode still false', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    await s.smartSearch('   ') // empty query early exit to clear(), bumped seq
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(false)
  })
})

describe('loadMore', () => {
  it('never searched (query empty) → backend not called', async () => {
    const s = usePhotosSearch()
    await s.loadMore()
    expect(smartSearchApi).not.toHaveBeenCalled()
  })

  it('exhausted true → backend not called', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(10)) // <50 → exhausted true
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockClear()
    await s.loadMore()
    expect(smartSearchApi).not.toHaveBeenCalled()
  })

  it('loadingMore true → re-entrant short-circuits, backend not called', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const p1 = s.loadMore()
    smartSearchApi.mockClear()
    const p2 = s.loadMore() // re-entrant
    expect(smartSearchApi).not.toHaveBeenCalled()
    dMore.resolve(assets(50, 'q'))
    await flush()
    await p1
    await p2
  })

  it('normal: parameters are (query, 50, 50, filtersPayload); brand new 50 items → offset becomes 50, exhausted false', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.loadMore()
    expect(smartSearchApi).toHaveBeenLastCalledWith('cat', 50, 50, { year: 2024 })
    expect(s.offset).toBe(50)
    expect(s.exhausted).toBe(false)
    expect(s.results).toHaveLength(100)
    // M10: length assertion alone cannot distinguish concat direction — writing
    // fresh.concat(results.value) backwards as results.value.concat(fresh)
    // (front-insert instead of append) also passes length check. Here lock down
    // first page at head, second page at tail, and order unchanged between them.
    expect(s.results[0].id).toBe('p0')
    expect(s.results[49].id).toBe('p49')
    expect(s.results[50].id).toBe('q0')
    expect(s.results[99].id).toBe('q49')
  })

  it('deduplication: new page contains one id duplicate with first page → result length only += (new page length - 1)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p')) // p0..p49
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dup = [...assets(49, 'q'), { id: 'p0' }] // 50 items, contains 1 duplicate with first page
    smartSearchApi.mockResolvedValueOnce(dup)
    await s.loadMore()
    expect(s.results).toHaveLength(50 + 49)
  })

  it('I1 case (Vue2→Vue3 law): first page has number-type id, new page has same-value string-type id → still judged as duplicate, not two different records', async () => {
    smartSearchApi.mockResolvedValueOnce([{ id: 7 }, ...assets(49, 'p')]) // first page contains 1 number-type id
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    expect(s.results[0].id).toBe(7) // first page retains number type as-is (assetToPhoto doesn't normalize)
    const dup = [{ id: '7' }, ...assets(49, 'q')] // new page has same value but string-type id
    smartSearchApi.mockResolvedValueOnce(dup)
    await s.loadMore()
    // without Set doing String() normalization, '7' and 7 would be two different keys, all 50 of dup
    // judged "new", result length becomes 50+50=100; after normalization should recognize as duplicate,
    // only add 49 items.
    expect(s.results).toHaveLength(50 + 49)
  })

  it('fresh.length===0 (entire page all duplicates) → exhausted true', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p')) // all duplicate with first page
    await s.loadMore()
    expect(s.exhausted).toBe(true)
    expect(s.results).toHaveLength(50)
  })

  it('M6 case: loadMore deep page backend returns null (Go nil slice) → ?? [] fallback, exhausted correctly set true, no throw', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(null)
    await expect(s.loadMore()).resolves.toBeUndefined()
    expect(s.results).toHaveLength(50) // no new items
    expect(s.exhausted).toBe(true) // 0 items < LIMIT, should stop pagination, not repeatedly send same page
    expect(s.loadingMore).toBe(false)
  })

  it('new page returns 30 items (<50) → exhausted true', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(assets(30, 'q'))
    await s.loadMore()
    expect(s.exhausted).toBe(true)
  })

  it('user changes search term during loadMore (new smartSearch completes) → old page response not concat, no offset pollution', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore()
    smartSearchApi.mockResolvedValueOnce(assets(10, 'dog'))
    await s.smartSearch('dog') // overwrite-style re-search, offset/results already swapped to new ones by SET_SEARCH
    dMore.resolve(assets(50, 'q')) // old loadMore response arrives late
    await flush()
    await pMore
    expect(s.query).toBe('dog')
    expect(s.results).toHaveLength(10)
    expect(s.offset).toBe(0)
  })

  it('E4 case (controller decided to add seq guard): search abc → loadMore in flight → search same abc again → old page response resolves → no concat, offset unchanged (query string matching alone would falsely pass here)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('abc')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore()
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p2'))
    await s.smartSearch('abc') // same query string — query string matching passes, only seq guard blocks
    dMore.resolve(assets(50, 'stale'))
    await flush()
    await pMore
    expect(s.results).toHaveLength(50) // only second smartSearch's first page result
    expect(s.offset).toBe(0) // not dialed to 50 by old loadMore
  })

  it('M8 case: loadMore#1 in flight → re-search succeeds (reset offset/loadingMore) → loadMore#2 in flight → loadMore#1\'s stale response arrives → should not falsely reset loadingMore to false, should not allow re-entrant request', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')

    const dMore1 = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore1.promise)
    const pMore1 = s.loadMore() // loadMore#1 in flight, nextOffset=50

    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.smartSearch('cat') // overwrite-style re-search: offset back to 0, loadingMore back to false, seq advances

    const dMore2 = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore2.promise)
    const pMore2 = s.loadMore() // loadMore#2 in flight, based on re-searched offset=0, nextOffset=50
    expect(s.loadingMore).toBe(true)

    // loadMore#1's response now arrives late — query string match passes (both 'cat'),
    // but seq already behind, should be blocked by seq guard; key is its finally should not
    // carelessly reset loadingMore to false (that erases "loadMore#2 still in flight" fact)
    dMore1.resolve(assets(50, 'stale'))
    await flush()
    expect(s.loadingMore).toBe(true) // core assertion: not falsely reset by stale response's finally

    smartSearchApi.mockClear()
    await s.loadMore() // now should still be short-circuited by loadingMore=true, should not allow re-entrant
    expect(smartSearchApi).not.toHaveBeenCalled()

    dMore2.resolve(assets(50, 'q2'))
    await flush()
    await pMore1
    await pMore2
    expect(s.loadingMore).toBe(false)
    expect(s.offset).toBe(50) // loadMore#2's legitimate offset, not polluted by re-entrant request
  })

  it('loadMore failure → loadingMore resets to false (finally guard)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.loadMore()
    expect(s.loadingMore).toBe(false)
    errSpy.mockRestore()
  })
})

describe('clear', () => {
  it('resets all 8 fields (M9: offset/loadingMore advanced to non-default values, making reset assertions truly discriminatory)', async () => {
    // Before M9, only smartSearch was done; offset was already 0, loadingMore already false —
    // those two assertions would pass even if clear() was deleted. Here first complete one
    // loadMore() to dial offset to non-zero, then during second loadMore() in flight (loadingMore
    // is now really true) call clear(); only then do the two assertions prove clear() really executed.
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.loadMore() // offset: 0 → 50 (complete run, no longer default value)

    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore() // in flight: loadingMore is now really true
    expect(s.loadingMore).toBe(true)

    s.clear()
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.filtersPayload).toEqual({})
    expect(s.offset).toBe(0) // was 50, proves it really reset not "was already 0"
    expect(s.exhausted).toBe(false)
    expect(s.loadingMore).toBe(false) // was true, proves it really reset not "was already false"
    expect(s.ms).toBe(0)
    expect(s.isSearchMode).toBe(false)

    // Wrap up: let in-flight loadMore land, avoid leaving dangling promise polluting next case
    dMore.resolve(assets(50, 'stale'))
    await flush()
    await pMore
  })
})

describe('__resetForTest', () => {
  it('M7 case: resets all 8 fields', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(10))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    s.__resetForTest()
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.filtersPayload).toEqual({})
    expect(s.offset).toBe(0)
    expect(s.exhausted).toBe(false)
    expect(s.loadingMore).toBe(false)
    expect(s.ms).toBe(0)
    expect(s.isSearchMode).toBe(false)
  })

  it('M7 case: do not introduce seq alias conflict — stale requests before reset won\'t pollute new search after reset (technique same as places.test.ts:643)', async () => {
    const dStale = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dStale.promise)
    const s = usePhotosSearch()
    const stale = s.smartSearch('stale') // in flight, not awaited

    s.__resetForTest() // if searchSeq dialed back to 0 here, next new search aliases conflict with this in-flight request

    smartSearchApi.mockResolvedValueOnce(assets(1, 'fresh'))
    await s.smartSearch('fresh') // new search after reset
    expect(s.query).toBe('fresh')

    dStale.resolve(assets(1, 'stale')) // old request before reset now arrives late
    await flush()
    await stale
    expect(s.query).toBe('fresh') // should not be overwritten by stale request
  })
})

describe('matchesQuery', () => {
  it('searched abc → matchesQuery(abc)/matchesQuery(" abc ") true, matchesQuery(abd) false; never searched always false', async () => {
    const s = usePhotosSearch()
    expect(s.matchesQuery('abc')).toBe(false)
    smartSearchApi.mockResolvedValueOnce(assets(1))
    await s.smartSearch('abc')
    expect(s.matchesQuery('abc')).toBe(true)
    expect(s.matchesQuery(' abc ')).toBe(true)
    expect(s.matchesQuery('abd')).toBe(false)
  })
})
