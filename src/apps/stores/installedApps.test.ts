import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  setStatus: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue('up to date'),
  uninstall: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: svc } }))

import { useInstalledAppsStore, mapInstalled, PENDING_TIMEOUT_MS } from './installedApps'

// Shape verified on a real device (curl GET /v2/app_management/compose)
const RAW = {
  store_info: {
    title: { en_US: 'Actual Budget' }, icon: 'https://cdn/icon.svg',
    port_map: '15006', index: '/', scheme: 'http', hostname: null,
  },
  status: 'running', update_available: true, is_uncontrolled: false,
}

describe('mapInstalled', () => {
  it('map device envelope: title tolerates uppercase en_US, webUrl constructs from current host, flags pass through', () => {
    const a = mapInstalled('actualbudget', RAW as never, 'nas.local')
    expect(a).toEqual({
      id: 'actualbudget', title: 'Actual Budget', icon: 'https://cdn/icon.svg',
      status: 'running', updateAvailable: true, isUncontrolled: false,
      webUrl: 'http://nas.local:15006/',
    })
  })
  it('store_info missing (uncontrolled remnant) does not crash: title falls back to id, webUrl null, status falls back to unknown', () => {
    const a = mapInstalled('ghost', { status: '' } as never, 'h')
    expect(a.title).toBe('ghost')
    expect(a.webUrl).toBeNull()
    expect(a.status).toBe('unknown')
  })
})

describe('installedApps store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    svc.list.mockReset().mockResolvedValue({ b: { ...RAW }, a: { ...RAW, status: 'exited' } })
    svc.setStatus.mockClear(); svc.update.mockClear(); svc.uninstall.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('refresh pulls list and sorts by title', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    expect(s.apps.map((x) => x.id)).toEqual(['a', 'b']) // stable by id when titles are equal
    expect(s.loading).toBe(false)
  })

  it('refresh filters system background containers (nimoos.system=true, e.g. AI agent / Photos ML)', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { ...RAW },
      'nimoos-agent': { ...RAW, compose: { services: { main: { labels: { 'nimoos.system': 'true' } } } } },
    })
    const s = useInstalledAppsStore()
    await s.refresh()
    expect(s.apps.map((x) => x.id)).toEqual(['jellyfin']) // system containers are hidden
  })

  it('setStatus: set pending → still pending after acceptance (backend go func async), converges only on end event', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    const p = s.setStatus('a', 'start')
    expect(s.pending['a']).toBe('start')
    await p
    // POST is acceptance only: do not converge early, or the list stays stale forever if the end event is lost (buffer=1)
    expect(s.pending['a']).toBe('start')
    expect(svc.setStatus).toHaveBeenCalledWith('a', 'start')
    expect(svc.list).toHaveBeenCalledTimes(1)
    s.onAppEvent('app:start-end', { 'app:name': 'a' })
    expect(s.pending['a']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('setStatus after acceptance, event lost → 30s fallback refetch to converge', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    await s.setStatus('a', 'stop')
    expect(s.pending['a']).toBe('stop')
    await vi.advanceTimersByTimeAsync(PENDING_TIMEOUT_MS + 10)
    expect(s.pending['a']).toBeUndefined()
    expect(svc.list).toHaveBeenCalledTimes(2)
  })

  it('setStatus POST fails → clear pending and throw error (no false pending state left behind)', async () => {
    svc.setStatus.mockRejectedValueOnce(new Error('boom'))
    const s = useInstalledAppsStore()
    await s.refresh()
    await expect(s.setStatus('a', 'start')).rejects.toThrow('boom')
    expect(s.pending['a']).toBeUndefined()
  })

  it('uninstall explicitly passes deleteConfigFolder, still pending after acceptance; uninstall-end immediately evicts + refetches', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    await s.uninstall('a', false)
    expect(svc.uninstall).toHaveBeenCalledWith('a', { deleteConfigFolder: false })
    // Returns on acceptance: uninstall still runs in the background, "processing" state kept
    expect(s.pending['a']).toBe('uninstall')
    expect(s.apps.find((x) => x.id === 'a')).toBeDefined()
    s.onAppEvent('app:uninstall-end', { 'app:name': 'a' })
    // end event: icon disappears immediately (evict), no waiting for the refetch round-trip
    expect(s.apps.find((x) => x.id === 'a')).toBeUndefined()
    expect(s.pending['a']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('onAppEvent: begin sets pending, end clears pending and refetches', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:update-begin', { 'app:name': 'b' })
    expect(s.pending['b']).toBe('update')
    s.onAppEvent('app:update-end', { 'app:name': 'b' })
    expect(s.pending['b']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('onAppEvent tolerates garbage input (non-app:* event name / missing app:name in props)', async () => {
    const s = useInstalledAppsStore()
    s.onAppEvent('docker:image:pull-progress', {})
    s.onAppEvent('app:start-begin', null)
    expect(s.pending).toEqual({})
  })

  it('pending 30s with no event → fallback refetch and clear pending (MessageBus message loss does not cause permanent hang)', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:start-begin', { 'app:name': 'a' })
    expect(s.pending['a']).toBe('start')
    await vi.advanceTimersByTimeAsync(PENDING_TIMEOUT_MS + 10)
    expect(s.pending['a']).toBeUndefined()
    expect(svc.list).toHaveBeenCalledTimes(2)
  })

  it('evict immediately removes entry and clears pending (container destroy / uninstall complete)', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:uninstall-begin', { 'app:name': 'a' })
    s.evict('a')
    expect(s.apps.find((x) => x.id === 'a')).toBeUndefined()
    expect(s.pending['a']).toBeUndefined()
  })

  it('markApplying sets pending and app:apply-changes-end resolves it', async () => {
    const s = useInstalledAppsStore()
    s.markApplying('syncthing')
    expect(s.pending['syncthing']).toBe('apply-changes')
    s.onAppEvent('app:apply-changes-end', { 'app:name': 'syncthing' })
    expect(s.pending['syncthing']).toBeUndefined()
  })

  it('app:apply-changes-begin from another client also marks pending', () => {
    const s = useInstalledAppsStore()
    s.onAppEvent('app:apply-changes-begin', { 'app:name': 'jellyfin' })
    expect(s.pending['jellyfin']).toBe('apply-changes')
  })
})
