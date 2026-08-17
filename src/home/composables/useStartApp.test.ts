import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useStartApp, appUrl, __resetStartAppForTest } from './useStartApp'

vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, service: { apps: { start: vi.fn(async () => {}), getGrid: vi.fn(async () => []) } } }
})
import { service } from '@nimotech/nimoos-service'

beforeEach(() => {
  setActivePinia(createPinia())
  __resetStartAppForTest()
  vi.clearAllMocks()
})

const stopped = { name: 'jf', status: 'exited', app_type: 'v2app', port: 8096, index: '/web' }

describe('useStartApp', () => {
  it('appUrl: with port/index construct address, without both return null', () => {
    expect(appUrl({ port: 8096, index: '/web', hostname: 'h' } as never)).toBe('http://h:8096/web')
    expect(appUrl({ name: 'x' } as never)).toBe(null)
  })

  it('prompt enters confirm state; dismiss clears', () => {
    const sa = useStartApp()
    sa.prompt('jf')
    expect(sa.state.value).toEqual({ key: 'jf', phase: 'confirm' })
    sa.dismiss()
    expect(sa.state.value).toBe(null)
  })

  it('confirm: call start → poll until running → close dialog and navigate', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as never)
    ;(service.apps.getGrid as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...stopped, status: 'running' }])
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    const ok = await sa.confirm({ pollMs: 1, timeoutMs: 100, navigate: nav })
    expect(ok).toBe(true)
    expect(service.apps.start).toHaveBeenCalledWith({ name: 'jf', app_type: 'v2app' })
    expect(sa.state.value).toBe(null)
    expect(nav).toHaveBeenCalledWith(`http://${window.location.hostname}:8096/web`)
  })

  it('dismiss during startup: don\'t navigate on completion', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as never)
    ;(service.apps.getGrid as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...stopped, status: 'running' }])
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    const p = sa.confirm({ pollMs: 5, timeoutMs: 100, navigate: nav })
    sa.dismiss() // user collapses the "starting..." dialog
    expect(await p).toBe(true)
    expect(nav).not.toHaveBeenCalled()
  })

  it('timeout: close dialog, return false, don\'t navigate', async () => {
    const apps = useAppsStore()
    apps.setApps([stopped] as never)
    ;(service.apps.getGrid as ReturnType<typeof vi.fn>).mockResolvedValue([stopped]) // always exited
    const nav = vi.fn()
    const sa = useStartApp()
    sa.prompt('jf')
    expect(await sa.confirm({ pollMs: 1, timeoutMs: 20, navigate: nav })).toBe(false)
    expect(sa.state.value).toBe(null)
    expect(nav).not.toHaveBeenCalled()
  })
})
