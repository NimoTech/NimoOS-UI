import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { folder: { getList: vi.fn(async () => ({ content: [
    { name: 'a', path: '/DATA/a', is_dir: true }, { name: 'f.txt', path: '/DATA/f.txt', is_dir: false },
  ] })) } } }
})
import { useFoldersStore } from './folders'

describe('useFoldersStore', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('loadFolder caches only directories', async () => {
    const s = useFoldersStore()
    await s.loadFolder('/DATA')
    expect(s.cache['/DATA']).toEqual([{ name: 'a', path: '/DATA/a' }])
  })
})
