import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const setCustomStorage: MockedFunction<(key: string, data: unknown) => Promise<unknown>> = vi.fn(async () => ({}))
const getCustomStorage: MockedFunction<(key: string) => Promise<unknown>> = vi.fn(async () => null)
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      users: {
        setCustomStorage: (key: string, data: unknown) => setCustomStorage(key, data),
        getCustomStorage: (key: string) => getCustomStorage(key)
      }
    }
  }
})
import { useLayoutStore } from './layout'

describe('layout persistence', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.useFakeTimers(); setCustomStorage.mockClear() })
  it('save writes localStorage immediately and debounces server save 800ms', async () => {
    const s = useLayoutStore(); s.loadInitial()
    s.save(); s.save()
    expect(localStorage.getItem('nimoos-home-layout-v2')).toBeTruthy()
    expect(setCustomStorage).not.toHaveBeenCalled()
    vi.advanceTimersByTime(800)
    expect(setCustomStorage).toHaveBeenCalledTimes(1) // debounced into one call
    expect(setCustomStorage.mock.calls[0]?.[0]).toBe('home_layout')
  })
  it('loadServer replaces items when server has a layout', async () => {
    const mockData = [{ kind: 'app' as const, key: 'files', c: 1, r: 1, w: 1, h: 1 }]
    getCustomStorage.mockResolvedValueOnce(mockData)
    const s = useLayoutStore(); s.loadInitial()
    await s.loadServer()
    expect(s.items).toHaveLength(1)
    expect(s.items[0].key).toBe('files')
  })
})
