import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore, clampWidgetDecl } from './apps'

const getGrid = vi.fn()
const getKvmSettings = vi.fn()
const getTerminalSettings = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    apps: { getGrid: () => getGrid() },
    kvm: { getSettings: () => getKvmSettings() },
    terminal: { getSettings: () => getTerminalSettings() },
  },
}))
vi.mock('../../apps/util/linkApps', () => ({ listLinkApps: () => Promise.resolve([]) }))

describe('useAppsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('exposes the 6 system apps immediately', () => {
    const s = useAppsStore()
    expect(s.app('files')?.system).toBe(true)
    expect(s.app('files')?.name).toBe('appFiles') // system apps store an i18n key, translated at render
    expect(s.order).toContain('appstore')
  })
  it('merges container apps without overwriting system keys, picks zh_cn title', () => {
    const s = useAppsStore()
    s.setApps([
      { name: 'jellyfin', title: { zh_cn: '影音', en_us: 'Jellyfin' }, icon: 'http://x/i.png', status: 'running', scheme: 'http', port: 8096, app_type: 'WebApp' },
      { name: 'files' }, // must not overwrite the system 'files' app
    ] as any)
    expect(s.app('jellyfin')?.name).toBe('影音')
    expect(s.app('jellyfin')?.icon).toBe('http://x/i.png')
    expect(s.app('jellyfin')?.system).toBe(false)
    expect(s.app('files')?.system).toBe(true) // system 'files' was not overwritten
  })
  it('falls back to en_US (uppercase) title from store-installed apps', () => {
    const s = useAppsStore()
    // v2 apps installed from the app store use uppercase en_US title keys (from store compose files); must not degrade to the bare id
    s.setApps([{ name: 'actualbudget', title: { en_US: 'Actual Budget' }, app_type: 'v2app' }] as any)
    expect(s.app('actualbudget')?.name).toBe('Actual Budget')
  })
})

describe('clampWidgetDecl', () => {
  it('default/invalid → 2x2', () => {
    expect(clampWidgetDecl(undefined, undefined)).toEqual([2, 2])
    expect(clampWidgetDecl(0, -1)).toEqual([2, 2])
  })
  it('clamp w in [2,4] h in [1,4]', () => {
    expect(clampWidgetDecl(1, 1)).toEqual([2, 1])
    expect(clampWidgetDecl(9, 9)).toEqual([4, 4])
    expect(clampWidgetDecl(3, 2)).toEqual([3, 2])
  })
  it('third param custom range: initial size clamped to range', () => {
    expect(clampWidgetDecl(2, 2, { min: [3, 2], max: [4, 4] })).toEqual([3, 2])
    expect(clampWidgetDecl(4, 4, { min: [2, 1], max: [3, 2] })).toEqual([3, 2])
    expect(clampWidgetDecl(undefined, undefined, { min: [3, 3], max: [3, 3] })).toEqual([3, 3])
  })
})

describe('desktop app pass-through', () => {
  it('setApps passes through desktop/widget, desktopDecls returns only desktop apps', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'my-dl', title: { en_us: '下载器' }, status: 'running', port: '8080', desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
      { name: 'plain', title: { en_us: 'P' }, status: 'running' },
      { name: 'no-widget', title: { en_us: 'N' }, desktop: true },
    ] as never)
    expect(store.app('my-dl')?.desktop).toBe(true)
    expect(store.app('my-dl')?.widget?.path).toBe('/widget')
    expect(store.app('plain')?.desktop).toBeUndefined()
    const decls = store.desktopDecls()
    expect(decls).toEqual([
      { key: 'my-dl', widget: { w: 3, h: 2 } },
      { key: 'no-widget', widget: undefined },
    ])
  })

  it('desktopDecls clamps initial size to label custom range', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'locked', title: { en_us: 'L' }, status: 'running', port: '1', desktop: true,
        widget: { path: '/w', w: 2, h: 2, minw: 3, maxw: 3, minh: 3, maxh: 3 } },
    ] as any)
    expect(store.desktopDecls()).toEqual([{ key: 'locked', widget: { w: 3, h: 3 } }])
  })

  it('desktopDecls excludes non-running containers (disappear when stopped); default status is running', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'up', title: { en_us: 'U' }, status: 'running', desktop: true },
      { name: 'down', title: { en_us: 'D' }, status: 'exited', desktop: true },
      { name: 'no-status', title: { en_us: 'N' }, desktop: true },
    ] as never)
    expect(store.desktopDecls().map((d) => d.key)).toEqual(['up', 'no-status'])
  })

  it('stoppedDesktopKeys reports only exited/dead, not restarting/running/default', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'up', status: 'running', desktop: true },
      { name: 'down', status: 'exited', desktop: true },
      { name: 'dead1', status: 'dead', desktop: true },
      { name: 'mid', status: 'restarting', desktop: true },
      { name: 'plain-down', status: 'exited' }, // non-desktop doesn't count
    ] as never)
    expect(store.stoppedDesktopKeys()).toEqual(['down', 'dead1'])
  })

  it('desktop app relative icon absolutized to app own port', () => {
    const store = useAppsStore()
    store.setApps([{ name: 'a', desktop: true, icon: '/icon.png', port: '8080', scheme: 'http' }] as never)
    expect(store.app('a')?.icon).toBe(`http://${window.location.hostname}:8080/icon.png`)
  })

  describe('isStopped', () => {
    it('exited/dead/unknown container apps are considered stopped', () => {
      const s = useAppsStore()
      s.setApps([
        { name: 'a', status: 'exited' },
        { name: 'b', status: 'dead' },
        { name: 'c', status: 'unknown' },
      ] as never)
      expect(s.isStopped('a')).toBe(true)
      expect(s.isStopped('b')).toBe(true)
      expect(s.isStopped('c')).toBe(true)
    })
    it('running / default status / system apps / LinkApp / nonexistent keys are not considered stopped', () => {
      const s = useAppsStore()
      s.setApps([
        { name: 'run', status: 'running' },
        { name: 'nostatus' },
        { name: 'link', status: 'exited', app_type: 'LinkApp' },
      ] as never)
      expect(s.isStopped('run')).toBe(false)
      expect(s.isStopped('nostatus')).toBe(false)
      expect(s.isStopped('link')).toBe(false)
      expect(s.isStopped('files')).toBe(false) // system app
      expect(s.isStopped('ghost')).toBe(false) // nonexistent
    })
  })
})

describe('LinkApp desktop composition (setApps second param)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('setApps([], links) appends LinkApp items: app_type passed through, included in order', () => {
    const s = useAppsStore()
    s.setApps([], [{ name: 'MyNAS', hostname: 'http://nas.local', icon: '', app_type: 'LinkApp', status: 'running' }])
    expect(s.app('MyNAS')?.app_type).toBe('LinkApp')
    expect(s.app('MyNAS')?.status).toBe('running')
    expect(s.app('MyNAS')?.hostname).toBe('http://nas.local')
    expect(s.order).toContain('MyNAS')
  })

  it('when name matches container app, container app wins, not overwritten by LinkApp', () => {
    const s = useAppsStore()
    s.setApps(
      [{ name: 'jellyfin', title: { en_us: 'Jellyfin' }, status: 'running', app_type: 'WebApp' }] as never,
      [{ name: 'jellyfin', hostname: 'http://x', icon: '', app_type: 'LinkApp', status: 'running' }],
    )
    expect(s.app('jellyfin')?.app_type).toBe('WebApp')
    expect(s.app('jellyfin')?.name).toBe('Jellyfin')
  })

  it('glyph = name first char uppercase (fallback when no icon), icon becomes null when empty string', () => {
    const s = useAppsStore()
    s.setApps([], [{ name: 'myapp', hostname: 'http://x', icon: '', app_type: 'LinkApp', status: 'running' }])
    expect(s.app('myapp')?.glyph).toBe('M')
    expect(s.app('myapp')?.icon).toBeNull()
    expect(s.app('myapp')?.cls).toBe('ic-app')
    expect(s.app('myapp')?.system).toBe(false)
  })

  it('when icon has value, pass through user-provided URL', () => {
    const s = useAppsStore()
    s.setApps([], [{ name: 'myapp', hostname: 'http://x', icon: 'http://icon', app_type: 'LinkApp', status: 'running' }])
    expect(s.app('myapp')?.icon).toBe('http://icon')
  })

  it('links default (not passed) does not affect existing behavior', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jellyfin', title: { en_us: 'J' }, status: 'running' }] as never)
    expect(s.app('jellyfin')?.name).toBe('J')
    expect(s.order).not.toContain('MyNAS')
  })
})

describe('KVM tile gating (SP17 #125)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getGrid.mockReset(); getKvmSettings.mockReset()
    getGrid.mockResolvedValue([])
  })

  it('keeps the tile before the probe has answered -- the first frame must not flicker', () => {
    const s = useAppsStore()
    expect(s.app('vm')).toBeDefined() // store init calls setApps([]) with no probe result yet
  })

  it('keeps the tile when the KVM service answers', async () => {
    getKvmSettings.mockResolvedValue({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
    expect(s.order).toContain('vm')
  })

  it('drops the tile when the KVM service is unreachable, without failing the load', async () => {
    getKvmSettings.mockRejectedValue(new Error('ECONNREFUSED'))
    const s = useAppsStore()
    await expect(s.loadGrid()).resolves.toBeUndefined()
    expect(s.app('vm')).toBeUndefined()
    expect(s.order).not.toContain('vm')
    expect(s.app('files')).toBeDefined() // the other system tiles are untouched
  })

  it('brings the tile back once KVM answers again', async () => {
    getKvmSettings.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ cpuCores: 6 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.app('vm')).toBeUndefined()
    await s.loadGrid()
    expect(s.app('vm')).toBeDefined()
  })
})

function httpErr(status?: number) {
  const e = new Error('http') as Error & { response?: { status: number } }
  if (status !== undefined) e.response = { status }
  return e
}

describe('terminal tile gating (SP18)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    getGrid.mockReset(); getKvmSettings.mockReset(); getTerminalSettings.mockReset()
    getGrid.mockResolvedValue([])
    getKvmSettings.mockResolvedValue({})
  })
  afterEach(() => localStorage.removeItem('user'))

  it('renders the tile before the probe answers (null must read as available)', () => {
    const s = useAppsStore()
    expect(s.order).toContain('terminal')
  })

  it('keeps the tile when the probe answers 403 — a 403 proves the service is alive', async () => {
    getTerminalSettings.mockRejectedValue(httpErr(403))
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).toContain('terminal')
  })

  it('drops the tile when the route is not registered (404) or the network fails', async () => {
    getTerminalSettings.mockRejectedValue(httpErr(404))
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')

    getTerminalSettings.mockRejectedValue(httpErr())
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')
  })

  it('hides the tile from non-admins regardless of the probe', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' }))
    getTerminalSettings.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const s = useAppsStore()
    await s.loadGrid()
    expect(s.order).not.toContain('terminal')
  })
})
