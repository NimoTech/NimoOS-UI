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
  localStorage.removeItem('strangler:disabled:/photos')
  localStorage.removeItem('strangler:disabled:/settings')
  localStorage.removeItem('strangler:disabled:/kvm')
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
  it('settings 磁贴应用内 router.push /settings(SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/settings==1 时 settings 退回 /#/legacy 老桌面', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/settings')
  })
  it('vm 磁贴应用内 router.push /kvm(SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/kvm==1 时 vm 退回 Vue2 全页 /#/kvm(不是 /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(hrefs[0]).toBe('/#/kvm')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/kvm')
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
  it('photos 磁贴应用内 router.push /photos(SP7-P8b cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('回退 flag strangler:disabled:/photos==1 时 photos 退回 Vue2 /#/photos(不是 /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('photos 那把 flag 不影响 storage / appstore', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('storage 与 apps 两把 flag 互不干扰', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
  it('五把 flag 逐条独立:只关 /kvm,settings/storage/appstore/photos 都照走应用内路由', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('settings'); expect(router.push).toHaveBeenCalledWith('/settings')
    openApp('storage'); expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore'); expect(router.push).toHaveBeenCalledWith('/apps/store')
    openApp('photos'); expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/kvm')
  })
  it('只关 /settings 时 vm 仍走应用内 /kvm(反向隔离)', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/settings')
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
  it('photo 磁贴应用内 push /photos(SP7-P8b cutover)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('photo 磁贴:回退 flag 置 1 时退回 Vue2 /#/photos', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
})
