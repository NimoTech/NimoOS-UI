import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'
import { useStartApp, __resetStartAppForTest } from './useStartApp'
import type { LayoutItem } from '../grid/types'

// P8 cutover:文件入口改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../router'

let hrefs: string[]
let opens: string[]
beforeEach(() => {
  setActivePinia(createPinia())
  __resetStartAppForTest()
  hrefs = []; opens = []
  localStorage.removeItem('strangler:disabled:/apps')
  localStorage.removeItem('strangler:disabled:/storage')
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
  vi.stubGlobal('open', (u: string) => { opens.push(u); return null })
  vi.mocked(router.push).mockClear()
})

describe('useOpenAction.openApp', () => {
  it('system app files 应用内 router.push,不整页跳', () => {
    const { openApp } = useOpenAction()
    openApp('files')
    expect(router.push).toHaveBeenCalledWith('/files')
    expect(hrefs.length).toBe(0)
  })
  it('settings 维持 /#/legacy(P8 cutover 不动它)', () => {
    const { openApp } = useOpenAction()
    openApp('settings'); expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
  })
  it('appstore 磁贴应用内 router.push /apps/store(SP5-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/apps==1 时 appstore 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/apps')
  })
  it('storage 磁贴应用内 router.push /storage(SP6-P6 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/storage==1 时 storage 退回 /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
  it('running container app opens scheme://host:port/index', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'running', scheme: 'http', port: 8096, index: '/web' }] as never)
    const { openApp } = useOpenAction()
    openApp('jf'); expect(opens[0]).toBe('http://host:8096/web')
  })
  it('stopped container app opens the start prompt instead of a URL', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'exited', port: 8096 }] as never)
    const { openApp } = useOpenAction()
    openApp('jf')
    expect(opens.length).toBe(0)
    expect(useStartApp().state.value).toEqual({ key: 'jf', phase: 'confirm' })
  })
  it('running app without port/index does nothing (no prompt, no open)', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'running' }] as never)
    const { openApp } = useOpenAction()
    openApp('jf')
    expect(opens.length).toBe(0)
    expect(useStartApp().state.value).toBe(null)
  })
})

describe('useOpenAction.openItem', () => {
  it('folder 应用内 push /files?path=(靠 Files.vue 深链归一化落目录)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })
    expect(hrefs.length).toBe(0)
  })
  it('photo navigates to /#/photos', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
  })
})
