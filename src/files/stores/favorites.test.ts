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

  it('reorder moves items and persists', async () => {
    const s = useFavoritesStore()
    await s.add({ name: 'A', path: '/DATA/A' })
    await s.add({ name: 'B', path: '/DATA/B' })
    await s.reorder(0, 1)
    expect(s.list.map((f) => f.name)).toEqual(['B', 'A'])
  })
})
