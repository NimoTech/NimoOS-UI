// Plan C Task 1 (2026-08-20 people-suggestions-ui): service wrappers + store state for the
// suggestion-confirmation UI. Mirrors people.test.ts's mocking/isolation conventions rather than
// duplicating them wholesale — only the service methods this file's cases touch are mocked here.
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

describe('photosPeople store — suggestions (Plan C Task 1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  // Same isolation concern as people.test.ts's _purgeTimers/_pendingHides note: the new
  // suggestions pending-guard is also module-scope state, must be cleared between cases.
  afterEach(() => {
    usePhotosPeople().__resetForTest()
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

    it('④ accept — calls the batch endpoint with every id in the group\'s accept list, and the whole group disappears', async () => {
      const s = await seededTwoGroups()
      await s.decideGroup('p1', true)
      expect(service.photos.batchPersonSuggestions).toHaveBeenCalledWith({ accept: ['s1', 's2'], reject: [] })
      expect(s.suggestionGroups.map((g) => g.person.id)).toEqual(['p2']) // only p1's group is gone
      expect(s.suggestionCount).toBe(1)
    })

    it('④ accept — also triggers a people-list refresh', async () => {
      const s = await seededTwoGroups()
      await s.decideGroup('p1', true)
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })

    it('reject — calls the batch endpoint with the reject list, group disappears, and does NOT refresh people', async () => {
      const s = await seededTwoGroups()
      await s.decideGroup('p2', false)
      expect(service.photos.batchPersonSuggestions).toHaveBeenCalledWith({ accept: [], reject: ['s3'] })
      expect(s.suggestionGroups.map((g) => g.person.id)).toEqual(['p1'])
      expect(service.photos.listPersons).not.toHaveBeenCalled()
    })

    it('personId not found locally — no-op, no request sent', async () => {
      const s = await seededTwoGroups()
      await s.decideGroup('does-not-exist', true)
      expect(service.photos.batchPersonSuggestions).not.toHaveBeenCalled()
    })

    it('failure — refetches suggestions to correct local state, and rethrows', async () => {
      const s = await seededTwoGroups()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.batchPersonSuggestions as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listPersonSuggestions as any).mockResolvedValueOnce({
        groups: [rawGroup({ id: 'p1', name: 'Alice' }, [rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' })])],
      })
      await expect(s.decideGroup('p1', true)).rejects.toThrow('x')
      expect(service.photos.listPersonSuggestions).toHaveBeenCalledTimes(2)
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
