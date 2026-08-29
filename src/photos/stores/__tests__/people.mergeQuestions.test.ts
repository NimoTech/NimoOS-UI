// Merge-cards feature (2026-08-21): service wrappers + store state for the cluster-merge
// question cards in the People review wizard. Backend contract (verified against the
// DEV-NimoOS-Photos branch feat/cluster-merge-questions, unmerged at the time of writing):
// GET /photos/persons/merge-suggestions/v2 ->
// {pairs:[{id,dist,from,into,fromFaceIds,intoFaceIds}]}, open only, hidden excluded, dist ASC.
// POST .../v2/:id/accept|reject -> {id,status,decidedAt}, idempotent. Old backend (no v2 route)
// 404s -> feature-detected and hidden silently, mirroring suggestionsSupported's own convention.
//
// Mirrors people.suggestions.test.ts's own mocking/isolation conventions rather than duplicating
// them wholesale — only the service methods this file's cases touch are mocked here.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPersons: vi.fn(() => Promise.resolve({ persons: [], facesIndexedUpTo: null })),
      listMergeQuestions: vi.fn(() => Promise.resolve({ pairs: [] })),
      acceptMergeQuestion: vi.fn(() => Promise.resolve({ id: 'mq1', status: 'accepted', decidedAt: '2026-08-21T00:00:00Z' })),
      rejectMergeQuestion: vi.fn(() => Promise.resolve({ id: 'mq1', status: 'rejected', decidedAt: '2026-08-21T00:00:00Z' })),
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

function rawPair(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mq1',
    dist: 0.42,
    from: rawPerson({ id: 'pA', name: '', count: 5 }),
    into: rawPerson({ id: 'pB', name: 'Alice', count: 20 }),
    fromFaceIds: ['f1', 'f2'],
    intoFaceIds: ['f3', 'f4'],
    ...over,
  }
}

describe('photosPeople store — merge questions (merge-cards feature)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  // Same isolation concern as people.suggestions.test.ts's own note: the pending-guard Set is
  // module-scope state, must be cleared between cases.
  afterEach(() => {
    usePhotosPeople().__resetForTest()
  })

  describe('fetchMergeQuestions', () => {
    it('success — loads pairs, normalizing from/into as Person and face id arrays as strings', async () => {
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({ pairs: [rawPair()] })
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      expect(s.mergeQuestions).toHaveLength(1)
      expect(s.mergeQuestions[0]).toMatchObject({
        id: 'mq1',
        dist: 0.42,
        fromFaceIds: ['f1', 'f2'],
        intoFaceIds: ['f3', 'f4'],
      })
      expect(s.mergeQuestions[0].from).toMatchObject({ id: 'pA', count: 5 })
      expect(s.mergeQuestions[0].into).toMatchObject({ id: 'pB', name: 'Alice', count: 20 })
      expect(s.mergeQuestionCount).toBe(1)
      expect(s.mergeQuestionsSupported).toBe(true)
    })

    it('a raw pair with missing/malformed face id arrays normalizes to empty arrays, not a crash', async () => {
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
        pairs: [rawPair({ fromFaceIds: undefined, intoFaceIds: 'not-an-array' })],
      })
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      expect(s.mergeQuestions[0].fromFaceIds).toEqual([])
      expect(s.mergeQuestions[0].intoFaceIds).toEqual([])
    })

    // Merge-card legibility fix (2026-08-21): fromFaces/intoFaces additive contract.
    describe('fromFaces / intoFaces (merge-card legibility fix, additive)', () => {
      it('present — normalizes each {faceId, assetId} entry to strings', async () => {
        ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
          pairs: [rawPair({
            fromFaces: [{ faceId: 'f1', assetId: 'a1' }, { faceId: 'f2', assetId: 'a2' }],
            intoFaces: [{ faceId: 'f3', assetId: 3 }],
          })],
        })
        const s = usePhotosPeople()
        await s.fetchMergeQuestions()
        expect(s.mergeQuestions[0].fromFaces).toEqual([
          { faceId: 'f1', assetId: 'a1' },
          { faceId: 'f2', assetId: 'a2' },
        ])
        expect(s.mergeQuestions[0].intoFaces).toEqual([{ faceId: 'f3', assetId: '3' }])
      })

      it('absent (older backend not yet shipping this field) — undefined, not an empty array', async () => {
        ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({ pairs: [rawPair()] })
        const s = usePhotosPeople()
        await s.fetchMergeQuestions()
        expect(s.mergeQuestions[0].fromFaces).toBeUndefined()
        expect(s.mergeQuestions[0].intoFaces).toBeUndefined()
      })

      it('a non-array value (malformed payload) — undefined, same as absent', async () => {
        ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
          pairs: [rawPair({ fromFaces: 'not-an-array' })],
        })
        const s = usePhotosPeople()
        await s.fetchMergeQuestions()
        expect(s.mergeQuestions[0].fromFaces).toBeUndefined()
      })

      it('malformed entries (missing faceId/assetId, or not an object) are skipped, valid entries survive', async () => {
        ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
          pairs: [rawPair({
            fromFaces: [
              { faceId: 'f1', assetId: 'a1' },
              { faceId: 'f2' }, // missing assetId
              { assetId: 'a3' }, // missing faceId
              null,
              'not-an-object',
              { faceId: 'f5', assetId: 'a5' },
            ],
          })],
        })
        const s = usePhotosPeople()
        await s.fetchMergeQuestions()
        expect(s.mergeQuestions[0].fromFaces).toEqual([
          { faceId: 'f1', assetId: 'a1' },
          { faceId: 'f5', assetId: 'a5' },
        ])
      })

      // T12b (2026-08-27 addendum): each fromFaces/intoFaces entry may additionally carry a
      // normalized bbox [x1,y1,x2,y2] (backend T12a) for the review wizard's lightbox overlay.
      // Additive + independently validated per-entry: a bad bbox drops only its own bbox field
      // (to undefined), never the whole face-preview entry.
      describe('bbox (T12b, additive)', () => {
        it('a valid bbox passes through unchanged', async () => {
          ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
            pairs: [rawPair({
              fromFaces: [{ faceId: 'f1', assetId: 'a1', bbox: [0.12, 0.3, 0.25, 0.52] }],
            })],
          })
          const s = usePhotosPeople()
          await s.fetchMergeQuestions()
          expect(s.mergeQuestions[0].fromFaces).toEqual([
            { faceId: 'f1', assetId: 'a1', bbox: [0.12, 0.3, 0.25, 0.52] },
          ])
        })

        it('absent bbox (older backend) -- entry has no bbox key, not undefined-valued one', async () => {
          ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
            pairs: [rawPair({ fromFaces: [{ faceId: 'f1', assetId: 'a1' }] })],
          })
          const s = usePhotosPeople()
          await s.fetchMergeQuestions()
          expect(s.mergeQuestions[0].fromFaces![0]).toEqual({ faceId: 'f1', assetId: 'a1' })
          expect('bbox' in s.mergeQuestions[0].fromFaces![0]).toBe(false)
        })

        it('wrong length (3 numbers) -- bbox dropped, faceId/assetId still survive', async () => {
          ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
            pairs: [rawPair({ fromFaces: [{ faceId: 'f1', assetId: 'a1', bbox: [0.1, 0.2, 0.3] }] })],
          })
          const s = usePhotosPeople()
          await s.fetchMergeQuestions()
          expect(s.mergeQuestions[0].fromFaces![0]).toEqual({ faceId: 'f1', assetId: 'a1' })
        })

        it('a NaN coordinate -- bbox dropped', async () => {
          ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
            pairs: [rawPair({ fromFaces: [{ faceId: 'f1', assetId: 'a1', bbox: [0.1, Number.NaN, 0.3, 0.4] }] })],
          })
          const s = usePhotosPeople()
          await s.fetchMergeQuestions()
          expect(s.mergeQuestions[0].fromFaces![0].bbox).toBeUndefined()
        })

        it('reversed coordinates (x1 >= x2) -- bbox dropped', async () => {
          ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
            pairs: [rawPair({ fromFaces: [{ faceId: 'f1', assetId: 'a1', bbox: [0.5, 0.2, 0.1, 0.4] }] })],
          })
          const s = usePhotosPeople()
          await s.fetchMergeQuestions()
          expect(s.mergeQuestions[0].fromFaces![0].bbox).toBeUndefined()
        })
      })
    })

    it('404 (old backend, endpoint missing) — mergeQuestionsSupported flips to false, list ends up empty, does not throw', async () => {
      const err = Object.assign(new Error('not found'), { response: { status: 404 } })
      ;(service.photos.listMergeQuestions as any).mockRejectedValueOnce(err)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await expect(s.fetchMergeQuestions()).resolves.toBeUndefined()
      expect(s.mergeQuestionsSupported).toBe(false)
      expect(s.mergeQuestions).toEqual([])
      expect(s.mergeQuestionCount).toBe(0)
      expect(consoleSpy).not.toHaveBeenCalled() // feature detection, not an error
      consoleSpy.mockRestore()
    })

    it('mergeQuestionsSupported defaults to true (assumed supported until a real 404 disproves it)', () => {
      const s = usePhotosPeople()
      expect(s.mergeQuestionsSupported).toBe(true)
    })

    it('a non-404 failure logs an error and leaves mergeQuestionsSupported unchanged', async () => {
      ;(service.photos.listMergeQuestions as any).mockRejectedValueOnce(new Error('boom'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      expect(s.mergeQuestionsSupported).toBe(true)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('decideMergeQuestion', () => {
    async function seededTwoPairs() {
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
        pairs: [rawPair({ id: 'mq1' }), rawPair({ id: 'mq2' })],
      })
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      return s
    }

    it('optimistic remove — the pair disappears immediately, before the request settles', async () => {
      const s = await seededTwoPairs()
      let resolveFn: (v: unknown) => void = () => {}
      ;(service.photos.acceptMergeQuestion as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.decideMergeQuestion('mq1', true)
      expect(s.mergeQuestions.map((it) => it.id)).toEqual(['mq2'])
      resolveFn({ id: 'mq1', status: 'accepted' })
      await p
    })

    it('accept → calls acceptMergeQuestion and also triggers a people-list refresh (cluster counts change)', async () => {
      const s = await seededTwoPairs()
      await s.decideMergeQuestion('mq1', true)
      expect(service.photos.acceptMergeQuestion).toHaveBeenCalledWith('mq1')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })

    it('reject → calls rejectMergeQuestion and does NOT trigger a people-list refresh', async () => {
      const s = await seededTwoPairs()
      await s.decideMergeQuestion('mq1', false)
      expect(service.photos.rejectMergeQuestion).toHaveBeenCalledWith('mq1')
      expect(service.photos.listPersons).not.toHaveBeenCalled()
    })

    it('id not found locally — no-op, no request sent', async () => {
      const s = await seededTwoPairs()
      await s.decideMergeQuestion('does-not-exist', true)
      expect(service.photos.acceptMergeQuestion).not.toHaveBeenCalled()
      expect(service.photos.rejectMergeQuestion).not.toHaveBeenCalled()
      expect(s.mergeQuestions).toHaveLength(2)
    })

    it('failure — refetches merge questions to correct local state, and rethrows', async () => {
      const s = await seededTwoPairs()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.acceptMergeQuestion as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
        pairs: [rawPair({ id: 'mq1' }), rawPair({ id: 'mq2' })],
      })
      await expect(s.decideMergeQuestion('mq1', true)).rejects.toThrow('x')
      expect(service.photos.listMergeQuestions).toHaveBeenCalledTimes(2) // setup fetch + failure-triggered refetch
      consoleSpy.mockRestore()
    })

    it('pending-guard: while a decide request is in flight, a racing fetchMergeQuestions must not resurrect the removed pair', async () => {
      const s = await seededTwoPairs()
      let resolveFn: (v: unknown) => void = () => {}
      ;(service.photos.acceptMergeQuestion as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const decidePromise = s.decideMergeQuestion('mq1', true)
      // The racing fetch still returns the backend's (stale) view, where mq1 hasn't been decided yet.
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
        pairs: [rawPair({ id: 'mq1' }), rawPair({ id: 'mq2' })],
      })
      await s.fetchMergeQuestions()
      expect(s.mergeQuestions.map((it) => it.id)).toEqual(['mq2']) // mq1 stays filtered out
      resolveFn({ id: 'mq1', status: 'accepted' })
      await decidePromise
    })
  })

  describe('reviewQueueCount (entry-card total)', () => {
    it('sums suggestionCount and mergeQuestionCount', async () => {
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({
        pairs: [rawPair({ id: 'mq1' }), rawPair({ id: 'mq2' })],
      })
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      expect(s.suggestionCount).toBe(0) // no face suggestions seeded in this file
      expect(s.mergeQuestionCount).toBe(2)
      expect(s.reviewQueueCount).toBe(2)
    })
  })

  describe('__resetForTest', () => {
    it('clears merge-question state and the pending-decision guard, no leakage across tests', async () => {
      ;(service.photos.listMergeQuestions as any).mockResolvedValueOnce({ pairs: [rawPair()] })
      const s = usePhotosPeople()
      await s.fetchMergeQuestions()
      expect(s.mergeQuestions).toHaveLength(1)
      s.__resetForTest()
      expect(s.mergeQuestions).toEqual([])
      expect(s.mergeQuestionsSupported).toBe(true)
      expect(s.mergeQuestionCount).toBe(0)
    })
  })
})
