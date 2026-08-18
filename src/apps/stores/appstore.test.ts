import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  categories: vi.fn(),
  listApps: vi.fn(),
  getApp: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { appstore: svc } }))

import { useAppstoreStore, ALL } from './appstore'

const CATALOG = {
  installed: ['jellyfin'],
  list: {
    jellyfin: { title: { en_us: 'Jellyfin' }, category: 'Media' },
    nextcloud: { title: { en_us: 'Nextcloud' }, category: 'Cloud' },
  },
}

describe('appstore store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    svc.categories.mockReset().mockResolvedValue([
      { id: 1, name: 'Media', count: 3 },
      { id: 2, name: 'Empty', count: 0 },
    ])
    svc.listApps.mockReset().mockResolvedValue(CATALOG)
    svc.getApp.mockReset()
  })

  it('loadCatalog: parallel fetch category and catalog; filter categories with count>0; ALL passes no params', async () => {
    const s = useAppstoreStore()
    await s.loadCatalog()
    expect(svc.listApps).toHaveBeenCalledWith({})
    expect(s.categories.map((c) => c.name)).toEqual(['Media'])
    expect(Object.keys(s.list)).toEqual(['jellyfin', 'nextcloud'])
    expect(s.installed).toEqual(['jellyfin'])
    expect(s.catalogLoaded).toBe(true)
    expect(s.isInstalled('jellyfin')).toBe(true)
    expect(s.isInstalled('nextcloud')).toBe(false)
  })

  it('loadCatalog with category/author → pass params; categories cached, no refetch', async () => {
    const s = useAppstoreStore()
    await s.loadCatalog()
    await s.loadCatalog('Media', 'official')
    expect(svc.listApps).toHaveBeenLastCalledWith({ category: 'Media', authorType: 'official' })
    expect(svc.categories).toHaveBeenCalledTimes(1)
  })

  it('loadCatalog fails sets error; retry replays last params', async () => {
    const s = useAppstoreStore()
    svc.listApps.mockRejectedValueOnce(new Error('boom'))
    await s.loadCatalog('Media', ALL)
    expect(s.error).toBe(true)
    expect(s.loading).toBe(false)
    svc.listApps.mockResolvedValueOnce(CATALOG)
    await s.retry()
    expect(svc.listApps).toHaveBeenLastCalledWith({ category: 'Media' })
    expect(s.error).toBe(false)
  })

  it('loadCatalog out-of-order response guard: earlier request returns later, must not overwrite newer request\'s state (including loading)', async () => {
    const s = useAppstoreStore()
    let resolve1: (v: unknown) => void = () => {}
    let resolve2: (v: unknown) => void = () => {}
    svc.listApps
      .mockImplementationOnce(() => new Promise((res) => { resolve1 = res }))
      .mockImplementationOnce(() => new Promise((res) => { resolve2 = res }))

    const p1 = s.loadCatalog('Media', ALL)
    const p2 = s.loadCatalog('Cloud', ALL)

    // The second request returns first
    resolve2({ installed: [], list: { nextcloud: { title: { en_us: 'Nextcloud' }, category: 'Cloud' } } })
    await p2
    expect(Object.keys(s.list)).toEqual(['nextcloud'])
    expect(s.loading).toBe(false)

    // The first (older) request returns later; it must not overwrite the newer result already applied above
    resolve1({ installed: [], list: { jellyfin: { title: { en_us: 'Jellyfin' }, category: 'Media' } } })
    await p1
    expect(Object.keys(s.list)).toEqual(['nextcloud'])
    expect(s.loading).toBe(false)
  })

  it('categories() failure must not affect listApps\' successful catalog — only chip bar degrades, error still false', async () => {
    const s = useAppstoreStore()
    svc.categories.mockRejectedValueOnce(new Error('boom'))
    await s.loadCatalog()
    expect(s.error).toBe(false)
    expect(Object.keys(s.list)).toEqual(['jellyfin', 'nextcloud'])
    expect(s.categories).toEqual([])
  })

  it('loadFeatured: recommend=true; failure silently clears, no throw', async () => {
    const s = useAppstoreStore()
    await s.loadFeatured()
    expect(svc.listApps).toHaveBeenCalledWith({ recommend: true })
    expect(Object.keys(s.featured)).toHaveLength(2)
    svc.listApps.mockRejectedValueOnce(new Error('boom'))
    await expect(s.loadFeatured()).resolves.toBeUndefined()
    expect(s.featured).toEqual({})
  })

  it('loadDetail: success fills detail; undefined (app missing) and error both set detailError', async () => {
    const s = useAppstoreStore()
    svc.getApp.mockResolvedValueOnce({ title: { en_us: 'Jellyfin' } })
    await s.loadDetail('jellyfin')
    expect(s.detail?.title).toEqual({ en_us: 'Jellyfin' })
    expect(s.detailError).toBe(false)

    svc.getApp.mockResolvedValueOnce(undefined)
    await s.loadDetail('ghost')
    expect(s.detail).toBeNull()
    expect(s.detailError).toBe(true)

    svc.getApp.mockRejectedValueOnce(new Error('boom'))
    await s.loadDetail('jellyfin')
    expect(s.detailError).toBe(true)
    expect(s.detailLoading).toBe(false)
  })

  it('invalidate clears categories cache: next loadCatalog refetches categories', async () => {
    const s = useAppstoreStore()
    svc.categories.mockResolvedValue([{ name: 'Media', count: 2 }])
    svc.listApps.mockResolvedValue({ installed: [], list: {} })

    await s.loadCatalog()
    await s.loadCatalog()
    expect(svc.categories).toHaveBeenCalledTimes(1) // length guard hit

    s.invalidate()
    expect(s.catalogLoaded).toBe(false)
    await s.loadCatalog()
    expect(svc.categories).toHaveBeenCalledTimes(2) // cache invalidated, refetched
  })

  it('invalidate orphans in-flight loadCatalog: stale response landing must not revive catalogLoaded/categories', async () => {
    const s = useAppstoreStore()
    await s.loadCatalog() // run once first so list/installed get a baseline value
    const prevList = s.list
    const prevInstalled = s.installed

    let resolveInFlight: (v: unknown) => void = () => {}
    svc.listApps.mockImplementationOnce(() => new Promise((res) => { resolveInFlight = res }))

    const p = s.loadCatalog('Media', ALL) // in-flight request
    s.invalidate() // store source changed; orphan the in-flight request above

    resolveInFlight({ installed: ['ghost'], list: { ghost: { title: { en_us: 'Ghost' }, category: 'Media' } } })
    await p

    expect(s.catalogLoaded).toBe(false)
    expect(s.categories).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.list).toBe(prevList) // invalidate itself never touches list/installed; the stale response must not write either
    expect(s.installed).toBe(prevInstalled)
  })
})
