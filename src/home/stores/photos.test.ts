import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from './layout'
import { isAssetId } from '../util/isAssetId'

describe('isAssetId', () => {
  it('true for asset id, false for gradient placeholder', () => {
    expect(isAssetId('abc123')).toBe(true)
    expect(isAssetId('linear-gradient(145deg,#fff)')).toBe(false)
    expect(isAssetId('')).toBe(false)
  })
})
describe('layout.bindPhotos', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('binds placeholder photos to real asset ids in order', () => {
    const s = useLayoutStore(); s.loadInitial()
    const before = s.items.filter((i) => i.kind === 'photo')
    expect(before.length).toBeGreaterThan(0)
    s.bindPhotos(['id1', 'id2', 'id3', 'id4'])
    const photos = s.items.filter((i) => i.kind === 'photo')
    expect(photos[0].key).toBe('id1')
  })
})
