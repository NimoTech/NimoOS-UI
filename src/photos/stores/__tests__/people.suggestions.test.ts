// Service wrappers + store state for the suggestion-confirmation UI. Mirrors
// people.test.ts's mocking/isolation conventions rather than duplicating them
// wholesale — only the service methods this file's cases touch are mocked here.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPersons: vi.fn(() => Promise.resolve({ persons: [], facesIndexedUpTo: null })),
      listPersonSuggestions: vi.fn(() => Promise.resolve({ groups: [] })),
      acceptPersonSuggestion: vi.fn(() => Promise.resolve({ id: 's1', status: 'accepted', decidedAt: '2026-08-20T00:00:00Z' })),
      rejectPersonSuggestion: vi.fn(() => Promise.resolve({ id: 's1', status: 'rejected', decidedAt: '2026-08-20T00:00:00Z' })),
      batchPersonSuggestions: vi.fn(() => Promise.resolve({ results: {} })),
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

function rawSuggestion(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's1',
    faceId: 'f1',
    assetId: 'a1',
    kind: 'join',
    score: 0.5,
    createdAt: '2026-08-19T00:00:00Z',
    ...over,
  }
}


function rawGroup(personOver: Record<string, unknown> = {}, suggestions: Array<Record<string, unknown>> = [rawSuggestion()]): Record<string, unknown> {
  return { person: rawPerson(personOver), suggestions }
}

describe('photosPeople store — suggestions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  // Same isolation concern as people.test.ts's _purgeTimers/_pendingHides note: the new
  // suggestions pending-guard is also module-scope state, must be cleared between cases.
  afterEach(() => {
    usePhotosPeople().__resetForTest()
  })

  // people-confirm-polish (review wizard): SuggestionGroup.exemplarFaceIds -- reference faces
  // for the wizard header, sourced from the raw group's person object (a NEW optional backend
  // field). Parsed defensively so an older backend without it never crashes the mapper.
  describe('fetchSuggestions — exemplarFaceIds (people-confirm-polish)', () => {
    it('present on the raw person — carried onto the group as a string array', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice', exemplarFaceIds: ['e1', 'e2', 'e3'] })],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].exemplarFaceIds).toEqual(['e1', 'e2', 'e3'])
    })

    it('absent on the raw person (older backend) — undefined, not a crash', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' })],
      })
      const s = usePhotosPeople()
      await expect(s.fetchSuggestions()).resolves.toBeUndefined()
      expect(s.suggestionGroups[0].exemplarFaceIds).toBeUndefined()
    })

    it('malformed (not an array) — defensively dropped to undefined', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice', exemplarFaceIds: 'not-an-array' })],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].exemplarFaceIds).toBeUndefined()
    })

    it('an empty array on the raw person — stays an empty array (not coerced to undefined)', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice', exemplarFaceIds: [] })],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].exemplarFaceIds).toEqual([])
    })
  })

  // T12c (suggestion-card face-locate box, 2026-08-28 addendum): each suggestion item may carry a
  // normalized bbox [x1,y1,x2,y2] (backend T12a) for the review wizard's inline context-photo +
  // lightbox overlay. Same validation contract/mirrored test cases as
  // people.mergeQuestions.test.ts's own "bbox (T12b, additive)" block (isValidFaceBBox is the
  // shared implementation both call sites use).
  describe('fetchSuggestions — bbox (T12c, additive)', () => {
    it('a valid bbox passes through unchanged', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup(rawPerson(), [rawSuggestion({ bbox: [0.12, 0.3, 0.25, 0.52] })])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].suggestions[0].bbox).toEqual([0.12, 0.3, 0.25, 0.52])
    })

    it('absent bbox (older backend) — item has no bbox key, not an undefined-valued one', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup(rawPerson(), [rawSuggestion()])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect('bbox' in s.suggestionGroups[0].suggestions[0]).toBe(false)
    })

    it('wrong length (3 numbers) — bbox dropped, the rest of the item still survives', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup(rawPerson(), [rawSuggestion({ bbox: [0.1, 0.2, 0.3] })])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].suggestions[0]).toEqual({ id: 's1', faceId: 'f1', assetId: 'a1', kind: 'join', score: 0.5 })
    })

    it('a NaN coordinate — bbox dropped', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup(rawPerson(), [rawSuggestion({ bbox: [0.1, Number.NaN, 0.3, 0.4] })])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].suggestions[0].bbox).toBeUndefined()
    })

    it('reversed coordinates (x1 >= x2) — bbox dropped', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup(rawPerson(), [rawSuggestion({ bbox: [0.5, 0.2, 0.1, 0.4] })])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].suggestions[0].bbox).toBeUndefined()
    })
  })

  describe('fetchSuggestions', () => {
    it('① success — loads groups and computes suggestionCount as the total open item count', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [
          rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2', kind: 'review', score: 0.8 })]),
          rawGroup({ id: 'p2', name: 'Bob' }, [rawSuggestion({ id: 's3' })]),
        ],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups).toHaveLength(2)
      expect(s.suggestionGroups[0].person).toMatchObject({ id: 'p1', name: 'Alice' })
      expect(s.suggestionGroups[0].suggestions).toEqual([
        { id: 's1', faceId: 'f1', assetId: 'a1', kind: 'join', score: 0.5 },
        { id: 's2', faceId: 'f1', assetId: 'a1', kind: 'review', score: 0.8 },
      ])
      expect(s.suggestionCount).toBe(3)
      expect(s.suggestionsSupported).toBe(true)
    })

    it('② 404 (old backend, endpoint missing) — suggestionsSupported flips to false, groups end up empty, and it does not throw', async () => {
      const err = Object.assign(new Error('not found'), { response: { status: 404 } })
      ;(service.photos.listPersonSuggestions as any).mockRejectedValueOnce(err)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await expect(s.fetchSuggestions()).resolves.toBeUndefined()
      expect(s.suggestionsSupported).toBe(false)
      expect(s.suggestionGroups).toEqual([])
      expect(s.suggestionCount).toBe(0)
      expect(consoleSpy).not.toHaveBeenCalled() // feature detection, not an error
      consoleSpy.mockRestore()
    })

    it('suggestionsSupported defaults to true (assumed supported until a real 404 disproves it)', () => {
      const s = usePhotosPeople()
      expect(s.suggestionsSupported).toBe(true)
    })

    it('a non-404 failure logs an error and leaves suggestionsSupported unchanged', async () => {
      ;(service.photos.listPersonSuggestions as any).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionsSupported).toBe(true)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('decideSuggestion', () => {
    async function seededOneGroupTwoItems() {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      return s
    }

    it('③ optimistic remove — item disappears from its group immediately, before the request settles', async () => {
      const s = await seededOneGroupTwoItems()
      let resolveFn: (v: unknown) => void = () => {}
      ;(service.photos.acceptPersonSuggestion as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.decideSuggestion('s1', true)
      expect(s.suggestionGroups[0].suggestions.map((it) => it.id)).toEqual(['s2'])
      expect(s.suggestionCount).toBe(1)
      resolveFn({ id: 's1', status: 'accepted' })
      await p
    })

    it('③ accept → calls acceptPersonSuggestion and also triggers a people-list refresh', async () => {
      const s = await seededOneGroupTwoItems()
      await s.decideSuggestion('s1', true)
      expect(service.photos.acceptPersonSuggestion).toHaveBeenCalledWith('s1')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })

    it('removing the last item in a group also drops the now-empty group', async () => {
      const s = await seededOneGroupTwoItems()
      await s.decideSuggestion('s1', true)
      await s.decideSuggestion('s2', true)
      expect(s.suggestionGroups).toEqual([])
    })

    it('⑤ reject → calls rejectPersonSuggestion and does NOT trigger a people-list refresh', async () => {
      const s = await seededOneGroupTwoItems()
      await s.decideSuggestion('s1', false)
      expect(service.photos.rejectPersonSuggestion).toHaveBeenCalledWith('s1')
      expect(service.photos.listPersons).not.toHaveBeenCalled()
    })

    it('id not found locally — no-op, no request sent', async () => {
      const s = await seededOneGroupTwoItems()
      await s.decideSuggestion('does-not-exist', true)
      expect(service.photos.acceptPersonSuggestion).not.toHaveBeenCalled()
      expect(service.photos.rejectPersonSuggestion).not.toHaveBeenCalled()
      expect(s.suggestionGroups[0].suggestions).toHaveLength(2)
    })

    it('failure — refetches suggestions to correct local state, and rethrows', async () => {
      const s = await seededOneGroupTwoItems()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.acceptPersonSuggestion as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      await expect(s.decideSuggestion('s1', true)).rejects.toThrow('x')
      expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2) // setup fetch + failure-triggered refetch
      consoleSpy.mockRestore()
    })

    it('pending-guard: while a decide request is in flight, a racing fetchSuggestions must not resurrect the removed item', async () => {
      const s = await seededOneGroupTwoItems()
      let resolveFn: (v: unknown) => void = () => {}
      ;(service.photos.acceptPersonSuggestion as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const decidePromise = s.decideSuggestion('s1', true)
      // The racing fetch still returns the backend's (stale) view, where s1 hasn't been decided yet.
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      await s.fetchSuggestions()
      expect(s.suggestionGroups[0].suggestions.map((it) => it.id)).toEqual(['s2']) // s1 stays filtered out
      resolveFn({ id: 's1', status: 'accepted' })
      await decidePromise
    })
  })

  // Fix round 1 (review Medium finding, 2026-08-20): the batch endpoint ALWAYS answers 200 with
  // a per-id {results:{id:{status,error?}}} map, so decideGroup must parse it rather than treat
  // "the request didn't throw" as "everything succeeded". Signature is now
  // Promise<{ failed: number }> instead of Promise<void>, and it no longer throws.
  describe('decideGroup', () => {
    async function seededTwoGroups() {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [
          rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })]),
          rawGroup({ id: 'p2', name: 'Bob' }, [rawSuggestion({ id: 's3' })]),
        ],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      return s
    }

    it('④ (a) accept, full success — calls the batch endpoint with every id in the group\'s accept list, the whole group disappears, and it resolves with failed=0', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s1: { status: 'accepted' }, s2: { status: 'accepted' } },
      })
      const result = await s.decideGroup('p1', true)
      expect(service.photos.batchPersonSuggestions).toHaveBeenCalledWith({ accept: ['s1', 's2'], reject: [] })
      expect(s.suggestionGroups.map((g) => g.person.id)).toEqual(['p2']) // only p1's group is gone
      expect(s.suggestionCount).toBe(1)
      expect(result).toEqual({ failed: 0 })
    })

    it('(a) full success — no extra fetchSuggestions refetch beyond the initial setup fetch', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s1: { status: 'accepted' }, s2: { status: 'accepted' } },
      })
      await s.decideGroup('p1', true)
      expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(1) // only the setup fetch, no resync needed
    })

    it('④ accept, full success — also triggers a people-list refresh', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s1: { status: 'accepted' }, s2: { status: 'accepted' } },
      })
      await s.decideGroup('p1', true)
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })

    it('reject, full success — calls the batch endpoint with the reject list, group disappears, and does NOT refresh people', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s3: { status: 'rejected' } },
      })
      const result = await s.decideGroup('p2', false)
      expect(service.photos.batchPersonSuggestions).toHaveBeenCalledWith({ accept: [], reject: ['s3'] })
      expect(s.suggestionGroups.map((g) => g.person.id)).toEqual(['p1'])
      expect(service.photos.listPersons).not.toHaveBeenCalled()
      expect(result).toEqual({ failed: 0 })
    })

    it('personId not found locally — no-op, no request sent, resolves with failed=0', async () => {
      const s = await seededTwoGroups()
      const result = await s.decideGroup('does-not-exist', true)
      expect(service.photos.batchPersonSuggestions).not.toHaveBeenCalled()
      expect(result).toEqual({ failed: 0 })
    })

    it('(b) partial failure — failed only counts the ids the backend marked as error, people still refresh (one id succeeded), and a resync restores just the failed one', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s1: { status: 'accepted' }, s2: { status: 'error', error: 'no matching face' } },
      })
      // Resync sees the backend's post-batch truth: s1 is gone (accepted), s2 is still open.
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's2' })])],
      })
      const result = await s.decideGroup('p1', true)
      expect(result).toEqual({ failed: 1 })
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1) // s1 succeeded -> people refresh still fires
      await vi.waitFor(() => {
        expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2) // setup fetch + resync
      })
      expect(s.suggestionGroups).toHaveLength(1)
      expect(s.suggestionGroups[0].person).toMatchObject({ id: 'p1' })
      expect(s.suggestionGroups[0].suggestions.map((it) => it.id)).toEqual(['s2']) // failed item is back, succeeded item is gone
    })

    it('(c) malformed/missing results map — treated as all ids failed (not all succeeded), no crash, no people refresh', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({}) // no `results` key at all
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      const result = await s.decideGroup('p1', true)
      expect(result).toEqual({ failed: 2 })
      expect(service.photos.listPersons).not.toHaveBeenCalled()
      await vi.waitFor(() => {
        expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2)
      })
      expect(s.suggestionGroups[0].suggestions.map((it) => it.id)).toEqual(['s1', 's2']) // both restored by the resync
    })

    it('(d) all accept ids explicitly marked error — no people refresh, but a resync still fires', async () => {
      const s = await seededTwoGroups()
      ;(service.photos.batchPersonSuggestions as any).mockResolvedValueOnce({
        results: { s1: { status: 'error' }, s2: { status: 'error' } },
      })
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      const result = await s.decideGroup('p1', true)
      expect(result).toEqual({ failed: 2 })
      expect(service.photos.listPersons).not.toHaveBeenCalled()
      await vi.waitFor(() => {
        expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2)
      })
    })

    it('network-level failure (the request itself throws) — treated as all-failed, logs, resyncs, and resolves rather than throwing', async () => {
      const s = await seededTwoGroups()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.batchPersonSuggestions as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      const result = await s.decideGroup('p1', true)
      expect(result).toEqual({ failed: 2 })
      expect(consoleSpy).toHaveBeenCalled()
      expect(service.photos.listPersons).not.toHaveBeenCalled()
      await vi.waitFor(() => {
        expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2)
      })
      consoleSpy.mockRestore()
    })
  })

  describe('__resetForTest', () => {
    it('clears suggestion state and the pending-decision guard, no leakage across tests', async () => {
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' })],
      })
      const s = usePhotosPeople()
      await s.fetchSuggestions()
      expect(s.suggestionGroups).toHaveLength(1)
      s.__resetForTest()
      expect(s.suggestionGroups).toEqual([])
      expect(s.suggestionsSupported).toBe(true)
      expect(s.suggestionCount).toBe(0)
    })
  })
})
