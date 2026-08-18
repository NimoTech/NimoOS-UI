import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listAlbums: vi.fn(() => Promise.resolve([])),
      createAlbum: vi.fn(() => Promise.resolve({ id: 'new1', name: 'New' })),
      getAlbum: vi.fn(() => Promise.resolve({ assets: [] })),
      deleteAlbum: vi.fn(() => Promise.resolve()),
      updateAlbum: vi.fn(() => Promise.resolve({})),
      batchAddToAlbum: vi.fn(() => Promise.resolve()),
      removeFromAlbum: vi.fn(() => Promise.resolve()),
      reorderAlbumAssets: vi.fn(() => Promise.resolve()),
      convertSmartToAlbum: vi.fn(() => Promise.resolve({})),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosAlbums } from '../albums'
import { usePhotosSmartViews, type SmartView } from '../smartViews'

function makeSv(id: string): SmartView {
  return {
    id, name: id, description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0,
    distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '',
  }
}

describe('photosAlbums store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchAlbums', () => {
    it('success → albums populated + albumsLoaded===true', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albums).toEqual([{ id: 7, name: 'A' }])
      expect(s.albumsLoaded).toBe(true)
    })
    it('returns null → albums===[] (?? [])', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce(null)
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albums).toEqual([])
    })
    it('reject → albumsLoaded still false + console.error called', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albumsLoaded).toBe(false)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    // Task 9(P4 legacy closeout): new loadError, semantics completely independent from
    // albumsLoaded — on failure loadError=true but albumsLoaded remains false
    // (cannot merge/cannot substitute for each other).
    it('fetchAlbums fails: loadError set true, albumsLoaded remains false', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)
      expect(s.albumsLoaded).toBe(false)
      errSpy.mockRestore()
    })
    it('after retry succeeds, loadError set false', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('net'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 1, name: 'A' }])
      await s.fetchAlbums()
      expect(s.loadError).toBe(false)
      expect(s.albumsLoaded).toBe(true)
      errSpy.mockRestore()
    })
    it('success path: loadError remains false', async () => {
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(false)
    })
    // Review Important 1 gating test: retry itself also fails — loadError must still be
    // true (cannot be cleared by "entering retry" itself), albums/albumsLoaded state must
    // also be consistent with "never succeeded once".
    it('reject → retry → reject: after completion loadError still true, albums/albumsLoaded consistent with never-succeeded', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e1'))
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.loadError).toBe(true)

      ;(service.photos.listAlbums as any).mockRejectedValueOnce(new Error('e2'))
      await s.fetchAlbums() // retry, still fails
      expect(s.loadError).toBe(true)
      expect(s.albums).toEqual([])
      expect(s.albumsLoaded).toBe(false)
      errSpy.mockRestore()
    })
  })

  describe('cross-type String normalization (iron law)', () => {
    it("albumById('7') hits backend-returned numeric id 7", async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      expect(s.albumById('7')).toEqual({ id: 7, name: 'A' })
      expect(s.albumById(7)).toEqual({ id: 7, name: 'A' })
    })
    it('assetsOf normalizes by key (numeric id stored, string query hits)', async () => {
      const s = usePhotosAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: '2026-01-01T00:00:00Z' }] })
      await s.fetchAlbumAssets(7)
      expect(s.assetsOf('7').length).toBe(1)
    })
    it('isLoadingAssets normalizes by key — in-flight numeric/string query both hit true (non-zero discriminative power "already ended" assertion)', async () => {
      let resolveFn: (v: unknown) => void
      ;(service.photos.getAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const s = usePhotosAlbums()
      const p = s.fetchAlbumAssets(7) // initiated with a numeric id
      expect(s.isLoadingAssets('7')).toBe(true) // queried with a string; must hit while in-flight
      resolveFn!({ assets: [] })
      await p
      expect(s.isLoadingAssets('7')).toBe(false)
    })
    // Write path normalization (updateAlbumLocal, driven by renameAlbum): backend album
    // id is numeric 7, caller passes string '7' (simulating route params.id always string)
    // must hit the same record and mutate in place.
    it('updateAlbumLocal (via renameAlbum) normalizes by key: numeric id stored, string id mutated', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 7, name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({ name: '新名' })
      await s.renameAlbum('7', '新名') // string id, backend stores numeric 7
      expect(service.photos.updateAlbum).toHaveBeenCalledWith('7', { name: '新名' })
      expect(s.albumById(7)?.name).toBe('新名')
      expect(s.albums).toHaveLength(1) // confirm mutation in place, not accidental insert
    })
    // Write path normalization (removeAssetsFromAlbum's remove Set): Photo.id type is
    // string | number, backend asset ids may be numeric, caller passes string assetIds
    // (combination that can actually occur).
    it('removeAssetsFromAlbum remove Set normalizes by key: numeric asset ids, string ids passed still remove', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 101, takenAt: null }, { id: 102, takenAt: null }],
      })
      await s.fetchAlbumAssets('a1')
      await s.removeAssetsFromAlbum('a1', ['101']) // string, asset actual id is numeric 101
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual([102])
      expect(service.photos.removeFromAlbum).toHaveBeenCalledWith('a1', '101')
    })
  })

  describe('createAlbum', () => {
    it('returns new album and listAlbums called again', async () => {
      const s = usePhotosAlbums()
      const created = await s.createAlbum('Trip')
      expect(created).toEqual({ id: 'new1', name: 'New' })
      expect(service.photos.createAlbum).toHaveBeenCalledWith('Trip')
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    it('reject → throws', async () => {
      ;(service.photos.createAlbum as any).mockRejectedValueOnce(new Error('dup'))
      const s = usePhotosAlbums()
      await expect(s.createAlbum('Trip')).rejects.toThrow('dup')
    })
  })

  describe('deleteAlbum', () => {
    it('clears the asset cache for that id + calls listAlbums again', async () => {
      const s = usePhotosAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: null }] })
      await s.fetchAlbumAssets('9')
      expect(s.assetsOf('9').length).toBe(1)
      await s.deleteAlbum('9')
      expect(service.photos.deleteAlbum).toHaveBeenCalledWith('9')
      expect(s.assetsOf('9')).toEqual([])
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    // Negative case: deleteAlbum has no optimistic delete (Vue2 :905-909 awaits the backend
    // first, only committing after success) -- while the backend call has not yet resolved,
    // the albums list must remain completely unchanged.
    it('no optimistic delete: the albums list is unchanged while the backend call is in flight', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'A' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveFn: (v: unknown) => void
      ;(service.photos.deleteAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.deleteAlbum('a1')
      expect(s.albums).toEqual([{ id: 'a1', name: 'A' }]) // not optimistically removed
      resolveFn!({})
      await p
    })
  })

  describe('fetchAlbumAssets', () => {
    it('success -> assetsOf is the assetToPhoto mapping result', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 'p1', takenAt: '2026-01-01T00:00:00Z', originalName: 'x.jpg' }],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toEqual([
        expect.objectContaining({ id: 'p1', file: 'x.jpg' }),
      ])
    })
    it('a concurrent second call is swallowed by the re-entrancy guard (getAlbum is called only once)', async () => {
      let resolveFn: (v: unknown) => void
      ;(service.photos.getAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const s = usePhotosAlbums()
      const p1 = s.fetchAlbumAssets('a1')
      const p2 = s.fetchAlbumAssets('a1')
      resolveFn!({ assets: [] })
      await Promise.all([p1, p2])
      expect(service.photos.getAlbum).toHaveBeenCalledTimes(1)
    })
    // Review gating item: the old value must be populated first before letting the second
    // fetch fail, otherwise "cleared to []" and "an unknown key just naturally returns []"
    // (the `?? []` in albums.ts) cannot be told apart -- deleting the whole clearing line
    // from the implementation would still pass this test. See Vue2 photos.js:928 (a failed
    // fetch must wipe the stale content, the user must not be left operating against a stale
    // list).
    it('reject -> assetsOf goes from "has an old value" to [] (not kept), loading ends as false, console.error is called', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({ assets: [{ id: 'p1', takenAt: null }] })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toHaveLength(1) // first prove there is an old value

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.getAlbum as any).mockRejectedValueOnce(new Error('x'))
      await s.fetchAlbumAssets('a1')
      expect(s.assetsOf('a1')).toEqual([]) // only this assertion has discriminating power: it proves the old value was really wiped
      expect(s.isLoadingAssets('a1')).toBe(false)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
  })

  describe('renameAlbum', () => {
    it('calls updateAlbum(id, {name}) and writes the backend-returned name back locally', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({ name: '服务端名' })
      await s.renameAlbum('a1', 'New Name')
      expect(service.photos.updateAlbum).toHaveBeenCalledWith('a1', { name: 'New Name' })
      expect(s.albumById('a1')?.name).toBe('服务端名')
      // Negative case: renameAlbum does not refetch the list (Vue2 :933-936 only commits
      // locally, it does not dispatch fetchAlbums) -- listAlbums should only have been
      // called once, during setup.
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(1)
    })
    it('reject -> throws and the local state is unchanged', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.renameAlbum('a1', 'New Name')).rejects.toThrow('x')
      expect(s.albumById('a1')?.name).toBe('Old')
    })
    // Regression guard (found by a line-by-line check against Vue2 :934-935): Vue2 uses
    // res.data.name **with no fallback**; the brief's snapshot mistakenly added `?? name`.
    // If this is ever changed back to add a fallback, this test goes red when the backend
    // omits name (expected undefined, a fallback implementation would get the input arg
    // 'New Name').
    it('Vue2 fidelity: when the backend response omits the name field, undefined is written back, not falling back to the input arg', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Old' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockResolvedValueOnce({})
      await s.renameAlbum('a1', 'New Name')
      expect(s.albumById('a1')?.name).toBeUndefined()
    })
  })

  describe('setAlbumCover', () => {
    it('the local cover changes to the new one immediately, before the call resolves (optimistic)', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', coverAssetId: 'p0' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveFn: (v: unknown) => void
      ;(service.photos.updateAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.setAlbumCover('a1', 'p1')
      expect(s.albumById('a1')?.coverAssetId).toBe('p1')
      resolveFn!({})
      await p
    })
    it('reject -> rolls back to prev and throws', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', coverAssetId: 'p0' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setAlbumCover('a1', 'p1')).rejects.toThrow('x')
      expect(s.albumById('a1')?.coverAssetId).toBe('p0')
    })
    // Regression guard (found by a line-by-line check against Vue2 :938-939): Vue2's prev is
    // undefined (a direct property read) when the album exists but the coverAssetId field is
    // missing, not null; the brief's snapshot used `?? null` and normalized this case to
    // null too. If this is ever changed back to `?? null`, this test goes red (expected
    // undefined).
    it('Vue2 fidelity: when the album exists but the coverAssetId field is missing, the rollback value is undefined, not null', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1' }]) // no coverAssetId field
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.updateAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setAlbumCover('a1', 'p1')).rejects.toThrow('x')
      expect(s.albumById('a1')?.coverAssetId).toBeUndefined()
    })
  })

  describe('reorderAlbumAssets', () => {
    it('reorders immediately to the passed-in order; an unknown id in the input is dropped', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      let resolveFn: (v: unknown) => void
      ;(service.photos.reorderAlbumAssets as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.reorderAlbumAssets('a1', ['p3', 'unknown', 'p1', 'p2'])
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p3', 'p1', 'p2'])
      resolveFn!({})
      await p
    })
    it('reject -> fully restores and throws', async () => {
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
        ],
      })
      const s = usePhotosAlbums()
      await s.fetchAlbumAssets('a1')
      ;(service.photos.reorderAlbumAssets as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.reorderAlbumAssets('a1', ['p2', 'p1'])).rejects.toThrow('x')
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p1', 'p2'])
    })
  })

  describe('addAssetsToAlbum', () => {
    it('assetCount=prev+n immediately; after success getAlbum is called and assetCount is overwritten with the real length', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveBatch: (v: unknown) => void
      ;(service.photos.batchAddToAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveBatch = resolve }),
      )
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 'p1', takenAt: null }, { id: 'p2', takenAt: null }, { id: 'p3', takenAt: null }],
      })
      const p = s.addAssetsToAlbum('a1', ['p2', 'p3'])
      expect(s.albumById('a1')?.assetCount).toBe(4) // 2 + 2 optimistic
      resolveBatch!({})
      await p
      expect(service.photos.getAlbum).toHaveBeenCalledWith('a1')
      expect(s.albumById('a1')?.assetCount).toBe(3) // real length after refetch
    })
    it('reject -> count rolls back to prev and throws', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 2 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.batchAddToAlbum as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.addAssetsToAlbum('a1', ['p2', 'p3'])).rejects.toThrow('x')
      expect(s.albumById('a1')?.assetCount).toBe(2)
    })
  })

  describe('removeAssetsFromAlbum', () => {
    it('removes immediately and decrements the count; removeFromAlbum is called one at a time; after success listAlbums is called again', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 3 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      const p = s.removeAssetsFromAlbum('a1', ['p1', 'p2'])
      // The optimistic write happens in the synchronous section before await Promise.all(...), so it can be asserted before awaiting p.
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p3'])
      expect(s.albumById('a1')?.assetCount).toBe(1)
      await p
      expect(service.photos.removeFromAlbum).toHaveBeenCalledTimes(2)
      expect(service.photos.listAlbums).toHaveBeenCalledTimes(2) // initial fetchAlbums + post-remove refetch
    })
    it('reject -> assets and the count both fully roll back and throw', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', assetCount: 3 }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      // .mockRejectedValueOnce twice (matching the 2 calls for assetIds length), avoiding
      // mockRejectedValue (without Once), which would make the mock implementation reject
      // forever for the rest of this file -- vi.clearAllMocks() only clears call records,
      // not implementations, which is the "implementation leak" across cases that the brief
      // warns about.
      ;(service.photos.removeFromAlbum as any)
        .mockRejectedValueOnce(new Error('x'))
        .mockRejectedValueOnce(new Error('x'))
      await expect(s.removeAssetsFromAlbum('a1', ['p1', 'p2'])).rejects.toThrow('x')
      expect(s.assetsOf('a1').map((x) => x.id)).toEqual(['p1', 'p2', 'p3'])
      expect(s.albumById('a1')?.assetCount).toBe(3)
    })
    // Regression guard (found by a line-by-line check against Vue2 :979-980): Vue2's
    // prevCount falls back to 0 (`album.assetCount || 0`) when the album exists but the
    // assetCount field is missing, and only falls back to snapshot.length when the album
    // cannot be found at all; the brief's snapshot used `?? snapshot.length` and fell back
    // to snapshot.length in both cases. If this is ever changed back to `??`, this test goes
    // red (expected 0, a wrong implementation would get 3).
    it('Vue2 fidelity: when the album exists but the assetCount field is missing, the rollback count is 0, not snapshot.length', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1' }]) // no assetCount field
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [
          { id: 'p1', takenAt: null },
          { id: 'p2', takenAt: null },
          { id: 'p3', takenAt: null },
        ],
      })
      await s.fetchAlbumAssets('a1')
      ;(service.photos.removeFromAlbum as any)
        .mockRejectedValueOnce(new Error('x'))
        .mockRejectedValueOnce(new Error('x'))
      await expect(s.removeAssetsFromAlbum('a1', ['p1', 'p2'])).rejects.toThrow('x')
      expect(s.albumById('a1')?.assetCount).toBe(0)
    })
  })

  describe('saveAsAlbum', () => {
    it('createAlbum -> batchAddToAlbum(new id, ids) -> listAlbums called in order, returns the new album', async () => {
      const s = usePhotosAlbums()
      const order: string[] = []
      ;(service.photos.createAlbum as any).mockImplementationOnce(async () => {
        order.push('createAlbum')
        return { id: 'new2', name: 'Trip' }
      })
      ;(service.photos.batchAddToAlbum as any).mockImplementationOnce(async () => {
        order.push('batchAddToAlbum')
      })
      ;(service.photos.listAlbums as any).mockImplementationOnce(async () => {
        order.push('listAlbums')
        return []
      })
      const created = await s.saveAsAlbum('Trip', ['p1', 'p2'])
      expect(created).toEqual({ id: 'new2', name: 'Trip' })
      expect(service.photos.batchAddToAlbum).toHaveBeenCalledWith('new2', ['p1', 'p2'])
      expect(order).toEqual(['createAlbum', 'batchAddToAlbum', 'listAlbums'])
    })
    it('createAlbum reject(409) -> throws and batchAddToAlbum is not called', async () => {
      ;(service.photos.createAlbum as any).mockRejectedValueOnce(new Error('409 conflict'))
      const s = usePhotosAlbums()
      await expect(s.saveAsAlbum('Trip', ['p1'])).rejects.toThrow('409')
      expect(service.photos.batchAddToAlbum).not.toHaveBeenCalled()
    })
  })

  describe('duplicateAlbum', () => {
    it('creates a new album with "<title> copy" and batch-adds the source members, create before add', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Trip' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.getAlbum as any).mockResolvedValueOnce({
        assets: [{ id: 'p1', takenAt: null }, { id: 'p2', takenAt: null }],
      })
      await s.fetchAlbumAssets('a1')

      const order: string[] = []
      ;(service.photos.createAlbum as any).mockImplementationOnce(async () => {
        order.push('createAlbum')
        return { id: 'new2', name: 'Trip copy' }
      })
      ;(service.photos.batchAddToAlbum as any).mockImplementationOnce(async () => {
        order.push('batchAddToAlbum')
      })
      ;(service.photos.listAlbums as any).mockImplementationOnce(async () => {
        order.push('listAlbums')
        return [{ id: 'new2', name: 'Trip copy' }, { id: 'a1', name: 'Trip' }]
      })

      const created = await s.duplicateAlbum('a1')
      expect(service.photos.createAlbum).toHaveBeenCalledWith('Trip copy')
      expect(service.photos.batchAddToAlbum).toHaveBeenCalledWith('new2', ['p1', 'p2'])
      expect(order).toEqual(['createAlbum', 'batchAddToAlbum', 'listAlbums'])
      expect(created).toEqual({ id: 'new2', name: 'Trip copy' })
    })

    it('prepends the duplicate to the album list so it is visible without a refetch', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Trip' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.createAlbum as any).mockResolvedValueOnce({ id: 'new2', name: 'Trip copy' })
      // Mirrors the real backend contract: ListAlbums orders by created_at DESC
      // (NimoOS-Photos service/album.go:83), so the just-created row comes back first.
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([
        { id: 'new2', name: 'Trip copy' },
        { id: 'a1', name: 'Trip' },
      ])
      const created = await s.duplicateAlbum('a1')
      expect(s.albums[0].id).toBe(created.id)
    })

    it('ignores a second duplicate call while the first is still in flight', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Trip' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      let resolveCreate: (v: unknown) => void
      ;(service.photos.createAlbum as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveCreate = resolve }),
      )
      const p1 = s.duplicateAlbum('a1')
      const p2 = s.duplicateAlbum('a1').catch(() => {}) // second call is rejected by the guard
      resolveCreate!({ id: 'new2', name: 'Trip copy' })
      await Promise.all([p1, p2])
      expect(service.photos.createAlbum).toHaveBeenCalledTimes(1)
    })

    it('clears the in-flight guard after a failure so a retry can proceed', async () => {
      ;(service.photos.listAlbums as any).mockResolvedValueOnce([{ id: 'a1', name: 'Trip' }])
      const s = usePhotosAlbums()
      await s.fetchAlbums()
      ;(service.photos.createAlbum as any).mockRejectedValueOnce(new Error('boom'))
      await expect(s.duplicateAlbum('a1')).rejects.toThrow('boom')
      ;(service.photos.createAlbum as any).mockResolvedValueOnce({ id: 'new2', name: 'Trip copy' })
      const created = await s.duplicateAlbum('a1')
      expect(created).toEqual({ id: 'new2', name: 'Trip copy' })
    })
  })

  describe('convertFromSmartView', () => {
    it('unshifts the new album and returns the raw object', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockResolvedValueOnce({ id: 'al-new', name: 'N', videoCount: 2 })
      const s = usePhotosAlbums()
      const album = await s.convertFromSmartView('sv-1')
      expect(album.id).toBe('al-new')
      expect(s.albums[0].id).toBe('al-new')
    })

    it('rethrows instead of swallowing the failure', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockRejectedValueOnce(new Error('boom'))
      const s = usePhotosAlbums()
      await expect(s.convertFromSmartView('sv-1')).rejects.toBeTruthy()
      expect(s.albums).toHaveLength(0)
    })

    // Final fix wave: the backend deletes the source smart view, so it must leave the other
    // store too. Without this, smartViews.listLoaded stays true, PhotosSmartViewDetail.vue:96
    // skips its own fetch, and one browser Back press lands on a fully interactive detail page
    // for an object the server has already deleted.
    it('evicts the source smart view from the smart views store', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockResolvedValueOnce({ id: 'al-new', name: 'N' })
      const sv = usePhotosSmartViews()
      sv.smartViews = [makeSv('sv-1'), makeSv('sv-2')]
      const s = usePhotosAlbums()
      await s.convertFromSmartView('sv-1')
      expect(sv.smartViews.map((v) => v.id)).toEqual(['sv-2'])
      expect(s.albums[0].id).toBe('al-new')
    })

    it('leaves the source smart view alone when the conversion fails', async () => {
      ;(service.photos.convertSmartToAlbum as any).mockRejectedValueOnce(new Error('boom'))
      const sv = usePhotosSmartViews()
      sv.smartViews = [makeSv('sv-1')]
      const s = usePhotosAlbums()
      await expect(s.convertFromSmartView('sv-1')).rejects.toBeTruthy()
      expect(sv.smartViews.map((v) => v.id)).toEqual(['sv-1'])
    })
  })
})
