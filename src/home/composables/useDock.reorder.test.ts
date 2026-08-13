import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useDock, __resetDockForTest } from './useDock'
describe('useDock.reorder', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetDockForTest() })
  it('moves a more-key into favorites before a given key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    d.reorder('settings', 'fav', 'photos') // settings (from more) inserted before photos
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
  })
  it('moves a fav-key out to more (drop at end of more)', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos', 'ai'])
    d.reorder('ai', 'more', null)
    expect(d.favKeys.value).not.toContain('ai')
  })
  it('reorder fav→more: key ends up in moreKeys', () => {
    useAppsStore()
    const d = useDock()
    // appstore is in fav by default; move it to more
    d.reorder('appstore', 'more', null)
    expect(d.favKeys.value).not.toContain('appstore')
    expect(d.moreKeys.value).toContain('appstore')
  })
  it('reorder more→fav: inserts before a given fav key', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    // settings is in more; reorder into fav before 'photos'
    d.reorder('settings', 'fav', 'photos')
    expect(d.favKeys.value).toEqual(['files', 'settings', 'photos'])
    expect(d.moreKeys.value).not.toContain('settings')
  })
  it('reorder within more honors beforeKey', () => {
    useAppsStore()
    const d = useDock()
    // Set fav so that more has at least 2 items (e.g. settings + kvm if present, else just settings)
    d.setFav(['files'])
    // moreKeys should now contain all other apps including 'photos', 'ai', etc.
    const initialMore = [...d.moreKeys.value]
    if (initialMore.length < 2) return // skip if not enough items for this test
    const [first, second] = initialMore
    // Move second item before first
    d.reorder(second, 'more', first)
    expect(d.moreKeys.value[0]).toBe(second)
    expect(d.moreKeys.value[1]).toBe(first)
  })
  it('reorder within more to end (beforeKey null) puts item last', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files'])
    const initialMore = [...d.moreKeys.value]
    if (initialMore.length < 2) return
    const first = initialMore[0]
    // Move first item to end of more
    d.reorder(first, 'more', null)
    expect(d.moreKeys.value[d.moreKeys.value.length - 1]).toBe(first)
  })
})
