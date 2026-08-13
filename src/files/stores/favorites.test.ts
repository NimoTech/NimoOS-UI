import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFavoritesStore, moveItem } from './favorites'

const getCustomStorage = vi.fn()
const setCustomStorage = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: {
    getCustomStorage: (k: string) => getCustomStorage(k),
    setCustomStorage: (k: string, d: unknown) => setCustomStorage(k, d),
  } },
}))

describe('moveItem', () => {
  it('moves an element and returns a new array', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
  it('is a no-op for out-of-range indices', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
  })
})

describe('favorites store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getCustomStorage.mockReset()
    setCustomStorage.mockReset().mockResolvedValue(undefined)
  })

  it('load: null / non-array yields empty list', async () => {
    getCustomStorage.mockResolvedValue(null)
    const s = useFavoritesStore()
    await s.load()
    expect(s.list).toEqual([])
    expect(getCustomStorage).toHaveBeenCalledWith('favorites')
  })

  it('load: reads the favorites array', async () => {
    getCustomStorage.mockResolvedValue([{ name: 'Docs', path: '/DATA/Documents' }])
    const s = useFavoritesStore()
    await s.load()
    expect(s.list).toEqual([{ name: 'Docs', path: '/DATA/Documents' }])
  })

  it('add: appends real-path entry, persists, dedupes by path', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'Docs', path: '/DATA/Documents' })
    await s.add({ name: 'dup', path: '/DATA/Documents' })
    expect(s.list).toEqual([{ name: 'Docs', path: '/DATA/Documents' }])
    expect(setCustomStorage).toHaveBeenCalledWith('favorites', [{ name: 'Docs', path: '/DATA/Documents' }])
  })

  it('isFavorite + remove persist', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'M', path: '/DATA/Media' })
    expect(s.isFavorite('/DATA/Media')).toBe(true)
    await s.remove('/DATA/Media')
    expect(s.isFavorite('/DATA/Media')).toBe(false)
    expect(setCustomStorage).toHaveBeenLastCalledWith('favorites', [])
  })

  it('renamePath: updates exact match (name+path) and descendant paths, persists once', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'Trip', path: '/DATA/Trip' })
    await s.add({ name: 'Sub', path: '/DATA/Trip/Sub' })
    await s.add({ name: 'Trip2', path: '/DATA/Trip2' }) // prefix lookalike, must not be touched
    setCustomStorage.mockClear()
    await s.renamePath('/DATA/Trip', '/DATA/Journey', 'Journey')
    expect(s.list).toEqual([
      { name: 'Journey', path: '/DATA/Journey' },
      { name: 'Sub', path: '/DATA/Journey/Sub' },
      { name: 'Trip2', path: '/DATA/Trip2' },
    ])
    expect(setCustomStorage).toHaveBeenCalledTimes(1)
  })

  it('renamePath: no matching favorite is a no-op and does not persist', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'Docs2', path: '/DATA/Docs2' })
    setCustomStorage.mockClear()
    await s.renamePath('/DATA/Trip', '/DATA/Journey', 'Journey')
    expect(s.list).toEqual([{ name: 'Docs2', path: '/DATA/Docs2' }])
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('reorder moves items and persists', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'A', path: '/DATA/A' })
    await s.add({ name: 'B', path: '/DATA/B' })
    await s.reorder(0, 1)
    expect(s.list.map((f) => f.name)).toEqual(['B', 'A'])
  })

  // Bug 5: deleting a folder has to take its favourite with it, and a favourite
  // only records the folder it points at -- nothing about its ancestors.
  describe('removeMany', () => {
    it('drops exact matches and descendants in one pass, persisting once', async () => {
      const s = useFavoritesStore()
      await s.add({ name: 'a', path: '/DATA/a' })
      await s.add({ name: 'b', path: '/DATA/a/b' })
      await s.add({ name: 'c', path: '/DATA/c' })
      setCustomStorage.mockClear()
      await s.removeMany(['/DATA/a'])
      expect(s.list).toEqual([{ name: 'c', path: '/DATA/c' }])
      expect(setCustomStorage).toHaveBeenCalledTimes(1)
    })

    it('does not touch a sibling that merely shares the prefix', async () => {
      const s = useFavoritesStore()
      await s.add({ name: 'ab', path: '/DATA/ab' })
      await s.removeMany(['/DATA/a'])
      expect(s.list).toEqual([{ name: 'ab', path: '/DATA/ab' }])
    })

    it('persists once for a batch of several deleted paths', async () => {
      const s = useFavoritesStore()
      await s.add({ name: 'a', path: '/DATA/a' })
      await s.add({ name: 'b', path: '/DATA/b' })
      await s.add({ name: 'c', path: '/DATA/c' })
      setCustomStorage.mockClear()
      await s.removeMany(['/DATA/a', '/DATA/b'])
      expect(s.list).toEqual([{ name: 'c', path: '/DATA/c' }])
      expect(setCustomStorage).toHaveBeenCalledTimes(1)
    })

    it('is a no-op that writes nothing when nothing matched', async () => {
      const s = useFavoritesStore()
      await s.add({ name: 'a', path: '/DATA/a' })
      setCustomStorage.mockClear()
      await s.removeMany(['/DATA/zzz'])
      expect(s.list).toEqual([{ name: 'a', path: '/DATA/a' }])
      expect(setCustomStorage).not.toHaveBeenCalled()
    })
  })

  // Bug 1. The whole list is one blob under one key, so every mutation rewrites
  // the entire file. Two overlapping writes interleave on the server (proved on
  // the device: 24 concurrent POSTs left the file as invalid JSON), and a
  // half-written blob comes back as a plain string, which used to read as "the
  // user has no favourites".
  describe('read robustness', () => {
    it('keeps the current list when the read fails instead of blanking the sidebar', async () => {
      const s = useFavoritesStore()
      getCustomStorage.mockResolvedValueOnce([{ name: 'Docs', path: '/DATA/Documents' }])
      await s.load()
      getCustomStorage.mockRejectedValueOnce(new Error('network down'))
      await s.load()
      expect(s.list).toEqual([{ name: 'Docs', path: '/DATA/Documents' }])
    })

    it('never writes over a list it could not read', async () => {
      const s = useFavoritesStore()
      getCustomStorage.mockRejectedValue(new Error('network down'))
      await s.load()
      await s.add({ name: 'New', path: '/DATA/New' })
      expect(setCustomStorage).not.toHaveBeenCalled()
      expect(s.list).toEqual([])
    })

    it('treats a never-written key (empty string) as an empty list and accepts writes', async () => {
      const s = useFavoritesStore()
      getCustomStorage.mockResolvedValue('')
      await s.load()
      expect(s.list).toEqual([])
      await s.add({ name: 'New', path: '/DATA/New' })
      expect(setCustomStorage).toHaveBeenCalledWith('favorites', [{ name: 'New', path: '/DATA/New' }])
    })

    it('refuses to overwrite a stored blob the backend could not parse', async () => {
      const s = useFavoritesStore()
      // A corrupted file is handed back verbatim as a string; overwriting it
      // would destroy the only copy of the user's real favourites.
      getCustomStorage.mockResolvedValue('[{"name":"a","path":"/DATA/a"}]}]')
      await s.load()
      await s.add({ name: 'New', path: '/DATA/New' })
      expect(setCustomStorage).not.toHaveBeenCalled()
    })
  })

  // The device-side race in numbers: firing an add() persist and a remove()
  // persist at the same time made the removal lose 10 times out of 25.
  describe('write serialisation', () => {
    it('never has two writes in flight at once', async () => {
      let inFlight = 0
      let maxInFlight = 0
      setCustomStorage.mockImplementation(async () => {
        maxInFlight = Math.max(maxInFlight, ++inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
      })
      const s = useFavoritesStore()
      await s.load()
      await Promise.all([
        s.add({ name: 'a', path: '/DATA/a' }),
        s.add({ name: 'b', path: '/DATA/b' }),
        s.add({ name: 'c', path: '/DATA/c' }),
      ])
      expect(maxInFlight).toBe(1)
    })

    it('the last write to land carries the final list', async () => {
      const bodies: unknown[] = []
      setCustomStorage.mockImplementation(async (_k: string, d: unknown) => {
        await new Promise((r) => setTimeout(r, 5))
        bodies.push(JSON.parse(JSON.stringify(d)))
      })
      const s = useFavoritesStore()
      await s.load()
      await Promise.all([s.add({ name: 'a', path: '/DATA/a' }), s.remove('/DATA/a')])
      expect(bodies[bodies.length - 1]).toEqual(s.list)
    })
  })
})
