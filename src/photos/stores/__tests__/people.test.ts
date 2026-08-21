import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPersons: vi.fn(() => Promise.resolve({ persons: [], facesIndexedUpTo: null })),
      updatePerson: vi.fn(() => Promise.resolve({})),
      setPersonCover: vi.fn(() => Promise.resolve({})),
      purgePerson: vi.fn(() => Promise.resolve({})),
      mergePersons: vi.fn(() => Promise.resolve({})),
      hidePerson: vi.fn(() => Promise.resolve({})),
      listHiddenPersons: vi.fn(() => Promise.resolve([])),
      restorePerson: vi.fn(() => Promise.resolve({})),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosPeople } from '../people'

function rawPerson(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1',
    name: '',
    confidence: 0.9,
    count: 3,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...over,
  }
}

describe('photosPeople store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  // Key isolation: _purgeTimers is a module-scope singleton, not reset by setActivePinia(createPinia()).
  // Any test case in undo/delete flows that doesn't run the window to completion (neither
  // advanceTimers to trigger nor calls undo()) will leave a dangling entry in _purgeTimers,
  // polluting the next test's fetchPeople filter logic and purgePersonWithUndo's
  // "reuse first idx" branch — the test fixtures (id/name) in this file happen to share
  // the same values across tests, so current pollution won't trigger a failed assertion,
  // but it's extremely fragile — changing any fixture will cause "mysteriously red" failures
  // (the scenario the task brief warns about explicitly). We use afterEach to clean up
  // rather than beforeEach — the store's filter reads localStorage once in setup(), and
  // instantiating it early in beforeEach would break the initialization tests that
  // "pre-set localStorage then first access the store".
  afterEach(() => {
    usePhotosPeople().__resetForTest()
  })

  describe('fetchPeople', () => {
    it('unwraps {persons, facesIndexedUpTo}; peopleLoaded===true on success', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'Alice' })],
        facesIndexedUpTo: '2026-07-01',
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toHaveLength(1)
      expect(s.people[0]).toMatchObject({ id: 1, name: 'Alice' })
      expect(s.facesIndexedUpTo).toBe('2026-07-01')
      expect(s.peopleLoaded).toBe(true)
    })
    it('persons is null — empty array without error', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: null, facesIndexedUpTo: null })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(true)
    })
    it('persons field absent — empty array without error', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({})
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(true)
    })
    it('reject — peopleLoaded stays false, existing people not cleared, console.error called (regression: deviation from #2)', async () => {
      const s = usePhotosPeople()
      // Seed existing data directly (bypassing fetchPeople), keep peopleLoaded at initial false —
      // precisely reproduces the "first load not yet confirmed successful, but local data exists" state,
      // verifying that the failure branch neither clears people nor touches peopleLoaded.
      s.people.push(...[rawPerson({ id: 1 })].map((r) => ({ ...r } as any)))
      expect(s.peopleLoaded).toBe(false)

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listPersons as any).mockRejectedValueOnce(new Error('net'))
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(false) // failure branch does not set the flag
      expect(s.people).toHaveLength(1) // not cleared (deviation #2: does not follow Vue2's clearing to [])
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    it('reject (after loading once via success path) — peopleLoaded stays true (not reset by failure branch), existing people not cleared', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1 })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(true)

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listPersons as any).mockRejectedValueOnce(new Error('net'))
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(true)
      expect(s.people).toHaveLength(1)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    it('facesIndexedUpTo field absent — do not overwrite old value', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [], facesIndexedUpTo: '2026-07-01' })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.facesIndexedUpTo).toBe('2026-07-01')

      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [] }) // no facesIndexedUpTo field
      await s.fetchPeople()
      expect(s.facesIndexedUpTo).toBe('2026-07-01') // not overwritten
    })
  })

  // Fix round 2 (2026-08-19, product decision): visibleUnnamed is now exactly
  // splitUnnamedByDistribution's `visible` head -- no singleton toggle, no fold expander, no
  // way to reach either from this page at all. This supersedes both the original Task 4
  // "confidence gone, showSingletons toggle unchanged" test and the fold-mechanism tests that
  // briefly existed between fix rounds 1 and 2 (deleted along with showFoldedClusters/
  // foldedCount/toggleFoldedClusters/setShowSingletons/PeopleFilter themselves).
  describe('computed: named/unnamed/visibleUnnamed/unnamedCount', () => {
    it('visibleUnnamed is exactly the distribution split\'s visible head — a singleton and a folded long tail are both permanently absent, with no toggle to reveal either', async () => {
      // 15 multi-photo clusters, strictly descending -- splitUnnamedByDistribution's
      // 80%-coverage cut (verified independently, see peopleView.test.ts's identical fixture)
      // leaves the first 12 visible and folds the last 3 (counts 8/6/4).
      const tail = [50, 45, 40, 35, 30, 25, 20, 18, 16, 14, 12, 10, 8, 6, 4]
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [
          rawPerson({ id: 1, name: 'Alice', confidence: 0.95, count: 5 }), // named
          rawPerson({ id: 2, name: '', confidence: 0.9, count: 1 }), // unnamed singleton
          ...tail.map((count, i) => rawPerson({ id: `t${i}`, count, name: '' })),
        ],
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.named).toHaveLength(1)
      expect(s.unnamed).toHaveLength(1 + tail.length)
      const visibleIds = s.visibleUnnamed.map((p) => p.id)
      expect(visibleIds).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'])
      expect(visibleIds).not.toContain(2) // the singleton never appears -- no toggle exists to reveal it
      expect(visibleIds).not.toContain('t12') // folded (count=8) -- no expander exists to reveal it
      expect(s.unnamedCount).toBe(12)
      // No leftover API surface for either removed mechanism.
      expect((s as unknown as Record<string, unknown>).setShowSingletons).toBeUndefined()
      expect((s as unknown as Record<string, unknown>).toggleFoldedClusters).toBeUndefined()
      expect((s as unknown as Record<string, unknown>).foldedCount).toBeUndefined()
      expect((s as unknown as Record<string, unknown>).hiddenSingletonCount).toBeUndefined()
      expect((s as unknown as Record<string, unknown>).filter).toBeUndefined()
    })
  })

  describe('renamePerson', () => {
    it('optimistic rename', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      let resolveFn: (v: unknown) => void
      ;(service.photos.updatePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.renamePerson(1, 'New')
      expect(s.personById(1)?.name).toBe('New')
      resolveFn!({})
      await p
    })
    it('backend reject — fetchPeople called + throws', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      await expect(s.renamePerson(1, 'New')).rejects.toThrow('x')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(2) // setup fetch + rename-triggered refetch
      errSpy.mockRestore()
    })
  })

  describe('setPersonRelation', () => {
    it('failure — relation rolls back + throws', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, relation: 'friend' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setPersonRelation(1, 'family')).rejects.toThrow('x')
      expect(s.personById(1)?.relation).toBe('friend')
      errSpy.mockRestore()
    })
    it('success — relation lands as new value', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, relation: 'friend' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonRelation(1, 'family')
      expect(s.personById(1)?.relation).toBe('family')
    })
  })

  describe('setPersonFavorite', () => {
    it('empty local list (deeplink scenario) — still call updatePerson', async () => {
      const s = usePhotosPeople()
      await s.setPersonFavorite(1, true)
      expect(service.photos.updatePerson).toHaveBeenCalledWith(1, { favorite: true })
    })
    it('failure — local rollback + throws', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, favorite: false })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setPersonFavorite(1, true)).rejects.toThrow('x')
      expect(s.personById(1)?.favorite).toBe(false)
      errSpy.mockRestore()
    })
    it('success and hit local — favorite lands as new value', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, favorite: false })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonFavorite(1, true)
      expect(s.personById(1)?.favorite).toBe(true)
    })
  })

  describe('setPersonCover', () => {
    it('backend has coverFaceId — return and patch local', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: null })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({ coverFaceId: 'f9' })
      const result = await s.setPersonCover(1, 'asset9')
      expect(result).toBe('f9')
      expect(s.personById(1)?.coverFaceId).toBe('f9')
    })
    it('backend missing field — do not patch', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: 'orig' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({})
      await s.setPersonCover(1, 'asset9')
      expect(s.personById(1)?.coverFaceId).toBe('orig')
    })
    // T14 review requirement 1: "field absent" must return as undefined, not be compressed to null by `?? null` —
    // otherwise callers cannot distinguish "backend says clear the cover" (explicit null, see next test) from
    // "backend didn't mention cover at all"; unconditional patch would erase local cover on `200 {}` response,
    // degrading the detail page hero to a gradient fallback.
    it('backend missing field — return undefined (must distinguish from explicit null)', async () => {
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({})
      const s = usePhotosPeople()
      expect(await s.setPersonCover(1, 'asset9')).toBeUndefined()
    })
    it('reject — throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.setPersonCover as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.setPersonCover(1, 'a9')).rejects.toThrow('x')
      errSpy.mockRestore()
    })
    // Vue2 fidelity regression (line-by-line check against :1123-1125 found discrepancy): Vue2 uses `!== undefined` to decide
    // whether to write — even if backend explicitly returns coverFaceId: null, it patches to null (clearing local cover).
    // If we incorrectly use `res?.coverFaceId ?? null` conflating "explicit null" and "field absent" into one value,
    // this test fails (expects null, wrong implementation keeps 'orig' without write).
    it('Vue2 fidelity: backend explicitly returns coverFaceId: null — still write (clear local cover)', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: 'orig' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({ coverFaceId: null })
      const result = await s.setPersonCover(1, 'asset9')
      expect(result).toBeNull()
      expect(s.personById(1)?.coverFaceId).toBeNull()
    })
  })

  describe('setPersonHero', () => {
    it('assetId=null — updatePerson(id, { heroAssetId: "" })', async () => {
      const s = usePhotosPeople()
      await s.setPersonHero(1, null)
      expect(service.photos.updatePerson).toHaveBeenCalledWith(1, { heroAssetId: '' })
    })
    it('success — local heroAssetId lands', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, heroAssetId: null })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonHero(1, 'a5')
      expect(s.personById(1)?.heroAssetId).toBe('a5')
    })
    it('reject — throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.setPersonHero(1, 'a5')).rejects.toThrow('x')
      errSpy.mockRestore()
    })
  })

  describe('mergePersonInto', () => {
    it('success — listPersons refreshed', async () => {
      const s = usePhotosPeople()
      await s.mergePersonInto(1, 2)
      expect(service.photos.mergePersons).toHaveBeenCalledWith(1, 2)
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })
    it('failure — still refreshes listPersons + throws', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.mergePersons as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.mergePersonInto(1, 2)).rejects.toThrow('x')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
      errSpy.mockRestore()
    })
  })

  describe('purgePersonWithUndo: undo-able permanent delete within 5 seconds', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    async function seeded3() {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      return s
    }

    it('① immediately disappears from people after call; purgePerson not called', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('② after 5 seconds, purgePerson called once', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)
      expect(service.photos.purgePerson).toHaveBeenCalledWith(2)
    })

    it('③ undo() within 5 seconds — reinserted at original index (middle position), purgePerson never called', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(2000)
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // original index 1 (middle)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('④ undo() after timer fires — no-op (no re-insertion)', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // not re-inserted
    })

    // Review requirement 1: test ④ above only validates "no-op after finally completes", not the window where
    // "committed is set but purgePerson request hasn't settled yet" — advanceTimersByTimeAsync(5000) flushes
    // the microtask queue, so the mocked purgePerson resolves in the same await, meaning old ④ never hit that
    // window, and removing "fix 1" (committed flag + delayed .finally delete) still passes all tests. Here we
    // use a manually controlled pending Promise to block purgePerson, halting precisely at "timer fired, committed
    // set, request pending", the only way to prove "fix 1" actually works.
    it('committed but purgePerson in flight: filter window must not expire before request settles (regression: fix 1)', async () => {
      const s = await seeded3()
      let resolvePurge: (v: unknown) => void = () => {}
      ;(service.photos.purgePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolvePurge = resolve }),
      )
      s.purgePersonWithUndo(2)
      // Advance synchronously (not …Async): let the setTimeout callback itself complete, but don't wait/flush
      // the Promise returned by purgePerson() inside it — this stops us at "committed=true but request unsettled".
      vi.advanceTimersByTime(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)

      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // still must be filtered, cannot resurrect

      resolvePurge({}) // wrap-up: let .finally complete, avoid hanging pending entry to next test
      await vi.advanceTimersByTimeAsync(0)
    })

    it('committed but purgePerson in flight: undo() is no-op, cannot reinsert server-being-deleted person (regression: fix 1)', async () => {
      const s = await seeded3()
      let resolvePurge: (v: unknown) => void = () => {}
      ;(service.photos.purgePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolvePurge = resolve }),
      )
      const undo = s.purgePersonWithUndo(2)
      vi.advanceTimersByTime(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)

      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // not re-inserted

      resolvePurge({})
      await vi.advanceTimersByTimeAsync(0)
    })

    it('filter window: fetchPeople during suspension still has person — not appear in people', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
    })

    it('filter window: fetchPeople after undo() — person appears normally', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      undo()
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id).sort((a, b) => Number(a) - Number(b))).toEqual([1, 2, 3])
    })

    it('repeat trigger reuses first idx: delete middle person — trigger again without undo — undo() still reinserts at original index', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2) // first trigger, idx=1 recorded in map
      const undo2 = s.purgePersonWithUndo(2) // same id triggered again (id=2 no longer in people now)
      undo2()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // still original index 1, not appended to end
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('numeric/string id cross-type: backend numeric id, call purgePersonWithUndo with string id hit and can undo', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo('2') // string id, backend stores numeric 2
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3])
    })

    it('purgePerson fails — reinsert at original position, do not fetchPeople', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = await seeded3()
      ;(service.photos.purgePerson as any).mockRejectedValueOnce(new Error('x'))
      s.purgePersonWithUndo(2)
      const callsBefore = (service.photos.listPersons as any).mock.calls.length
      await vi.advanceTimersByTimeAsync(5000)
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // re-inserted at original position
      expect((service.photos.listPersons as any).mock.calls.length).toBe(callsBefore) // did not fetchPeople
      errSpy.mockRestore()
    })
  })

  describe('numeric id / string id cross-type (iron law regression, non-purge path)', () => {
    it('personById / patchPerson all hit normalized by String', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 42, name: 'Num' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.personById('42')?.name).toBe('Num')
      s.patchPerson('42', { name: 'Renamed' })
      expect(s.personById(42)?.name).toBe('Renamed')
    })
    // Review Issue 6 added the second of two cheap coverage shortcuts: personById miss return value had no prior assertion.
    it('personById miss — return null', () => {
      const s = usePhotosPeople()
      expect(s.personById('does-not-exist')).toBeNull()
    })
  })

  // Task 7 (Plan D, SP7-P5 People): the Hidden people section + hide/unhide actions, mirroring
  // Vue2 hidePersonAction/fetchHiddenPeople/unhidePerson (photos.js:1585-1633).
  describe('hiddenPeople / hidePerson / unhidePerson', () => {
    it('fetchHiddenPeople success → hiddenPeople is filled with Person[], and hiddenPeopleLoaded/hiddenPeopleSupported are both true', async () => {
      ;(service.photos.listHiddenPersons as any).mockResolvedValueOnce([rawPerson({ id: 'h1', name: 'Zed' })])
      const s = usePhotosPeople()
      await s.fetchHiddenPeople()
      expect(s.hiddenPeople).toHaveLength(1)
      expect(s.hiddenPeople[0]).toMatchObject({ id: 'h1', name: 'Zed' })
      expect(s.hiddenPeopleLoaded).toBe(true)
      expect(s.hiddenPeopleSupported).toBe(true)
    })

    it('hiddenPeopleSupported defaults to true (assume supported until a real 404 disproves it)', () => {
      const s = usePhotosPeople()
      expect(s.hiddenPeopleSupported).toBe(true)
    })

    it('fetchHiddenPeople 404 → hiddenPeopleSupported flips to false (feature detection, not an error, no console.error)', async () => {
      const err = Object.assign(new Error('not found'), { response: { status: 404 } })
      ;(service.photos.listHiddenPersons as any).mockRejectedValueOnce(err)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await s.fetchHiddenPeople()
      expect(s.hiddenPeopleSupported).toBe(false)
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('fetchHiddenPeople failing with a non-404 → hiddenPeopleSupported is unchanged and console.error is called', async () => {
      ;(service.photos.listHiddenPersons as any).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await s.fetchHiddenPeople()
      expect(s.hiddenPeopleSupported).toBe(true)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('hidePerson success → calls service.photos.hidePerson(id), optimistically removes it from people, and returns true', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 'p1', name: 'Ann' })], facesIndexedUpTo: null })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const ok = await s.hidePerson('p1')
      expect(ok).toBe(true)
      expect(s.people).toHaveLength(0)
      expect(service.photos.hidePerson).toHaveBeenCalledWith('p1')
    })

    it('hidePerson failure → the snapshot is rolled back into its original position and it returns false', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 'p0' }), rawPerson({ id: 'p1', name: 'Ann' }), rawPerson({ id: 'p2' })],
        facesIndexedUpTo: null,
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.hidePerson as any).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const ok = await s.hidePerson('p1')
      expect(ok).toBe(false)
      expect(s.people).toHaveLength(3)
      expect(s.people[1]).toMatchObject({ id: 'p1', name: 'Ann' }) // reinserted at its original index
      consoleSpy.mockRestore()
    })

    it('while hidePerson is in flight: a racing fetchPeople must not pull the just-removed person back in', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 'p1', name: 'Ann' })], facesIndexedUpTo: null })
      const s = usePhotosPeople()
      await s.fetchPeople()
      let resolveHide: (() => void) | undefined
      ;(service.photos.hidePerson as any).mockImplementation(() => new Promise((resolve) => { resolveHide = () => resolve({}) }))
      const hidePromise = s.hidePerson('p1')
      // While the hide request is still in flight, a racing fetchPeople hits the same backend
      // data (which doesn't reflect the hide result yet).
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 'p1', name: 'Ann' })], facesIndexedUpTo: null })
      await s.fetchPeople()
      expect(s.people).toHaveLength(0) // blocked by _pendingHides, doesn't come back from the dead
      resolveHide?.()
      await hidePromise
    })

    it('unhidePerson success → calls restorePerson(id) and re-fetches both people and hiddenPeople in finally', async () => {
      const s = usePhotosPeople()
      await s.unhidePerson('h1')
      expect(service.photos.restorePerson).toHaveBeenCalledWith('h1')
      expect(service.photos.listPersons).toHaveBeenCalled()
      expect(service.photos.listHiddenPersons).toHaveBeenCalled()
    })

    it('unhidePerson failure → still re-fetches both lists (per Vue2 unconditional finally) and console.error is called', async () => {
      ;(service.photos.restorePerson as any).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await s.unhidePerson('h1')
      expect(consoleSpy).toHaveBeenCalled()
      expect(service.photos.listPersons).toHaveBeenCalled()
      expect(service.photos.listHiddenPersons).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('__resetForTest', () => {
    // Style cleanup: use describe-level beforeEach/afterEach to toggle fake timers, not inline in it() —
    // vi.useFakeTimers()/vi.useRealTimers() — consistent with other fake-timer describe blocks in this file.
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('clear timers and state, no leakage across tests', async () => {
      const s = usePhotosPeople()
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1 })] })
      await s.fetchPeople()
      s.purgePersonWithUndo(1)
      s.__resetForTest()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(false)
      expect(s.facesIndexedUpTo).toBeNull()
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled() // timer was cleared
    })

    // Task 7 (Plan D): __resetForTest must also clear the Hidden-people-related state and
    // _pendingHides, otherwise when the same id gets hidePerson'd in the next test case,
    // fetchPeople's filtering logic would be polluted by a dangling entry left over from the
    // previous case (the same precedent as _purgeTimers in the previous test case's comment).
    it('clears the Hidden people state', async () => {
      const s = usePhotosPeople()
      ;(service.photos.listHiddenPersons as any).mockResolvedValueOnce([rawPerson({ id: 'h1' })])
      await s.fetchHiddenPeople()
      expect(s.hiddenPeople).toHaveLength(1)
      s.__resetForTest()
      expect(s.hiddenPeople).toEqual([])
      expect(s.hiddenPeopleLoaded).toBe(false)
      expect(s.hiddenPeopleSupported).toBe(true)
    })
  })
})
