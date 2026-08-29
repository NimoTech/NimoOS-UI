import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import FavoriteStar from './FavoriteStar.vue'
import { useFavoritesStore } from '../stores/favorites'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: {
    getCustomStorage: vi.fn().mockResolvedValue([]),
    setCustomStorage: vi.fn().mockResolvedValue(undefined),
  } },
}))

describe('FavoriteStar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows ☆ when not favorited, adds and flips to ★ on click', async () => {
    const w = mount(FavoriteStar, { props: { path: '/DATA/Docs', name: 'Docs' } })
    expect(w.text()).toBe('☆')
    await w.trigger('click')
    // The store reads the stored list before its first write, so it never
    // overwrites favourites it has not seen. That read is one round trip, and
    // the click handler is fire-and-forget, so the flip lands a tick later.
    await flushPromises()
    const fav = useFavoritesStore()
    expect(fav.isFavorite('/DATA/Docs')).toBe(true)
    expect(w.text()).toBe('★')
  })

  it('shows ★ when already favorited and removes on click', async () => {
    const fav = useFavoritesStore()
    await fav.add({ name: 'Docs', path: '/DATA/Docs' })
    const w = mount(FavoriteStar, { props: { path: '/DATA/Docs', name: 'Docs' } })
    expect(w.text()).toBe('★')
    await w.trigger('click')
    expect(fav.isFavorite('/DATA/Docs')).toBe(false)
  })
})
