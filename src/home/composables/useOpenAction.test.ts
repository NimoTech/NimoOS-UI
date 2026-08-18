import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'
import { useStartApp, __resetStartAppForTest } from './useStartApp'
import type { LayoutItem } from '../grid/types'

// P8 cutover: the files entry now uses in-app router.push, so the router singleton must be mocked (vi.mock is hoisted above imports).
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
  localStorage.removeItem('strangler:disabled:/ai')
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
  vi.stubGlobal('open', (u: string) => { opens.push(u); return null })
  vi.mocked(router.push).mockClear()
})

describe('useOpenAction.openApp', () => {
  it('system app files should use in-app router.push, not full page navigation', () => {
    const { openApp } = useOpenAction()
    openApp('files')
    expect(router.push).toHaveBeenCalledWith('/files')
    expect(hrefs.length).toBe(0)
  })
  it('settings tile should use in-app router.push /settings (SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/settings==1, settings should fall back to legacy desktop /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/settings', '1')
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/settings')
  })
  it('vm tile should use in-app router.push /kvm (SP9-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/kvm==1, vm should fall back to Vue2 full page /#/kvm (not /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(hrefs[0]).toBe('/#/kvm')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/kvm')
  })
  it('appstore tile should use in-app router.push /apps/store (SP5-P8 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/apps==1, appstore should fall back to /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/apps')
  })
  it('storage tile should use in-app router.push /storage (SP6-P6 cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/storage==1, storage should fall back to /#/legacy', () => {
    localStorage.setItem('strangler:disabled:/storage', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(hrefs[0]).toBe('/#/legacy')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/storage')
  })
  it('photos tile should use in-app router.push /photos (SP7-P8b cutover)', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('when fallback flag strangler:disabled:/photos==1, photos should fall back to Vue2 /#/photos (not /#/legacy)', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('the photos flag should not affect storage / appstore', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore')
    expect(router.push).toHaveBeenCalledWith('/apps/store')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/photos')
  })
  it('storage and apps flags should not interfere with each other', () => {
    localStorage.setItem('strangler:disabled:/apps', '1')
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/apps')
  })
  it('five flags are independent: only disabling /kvm, while settings/storage/appstore/photos still use in-app router', () => {
    localStorage.setItem('strangler:disabled:/kvm', '1')
    const { openApp } = useOpenAction()
    openApp('settings'); expect(router.push).toHaveBeenCalledWith('/settings')
    openApp('storage'); expect(router.push).toHaveBeenCalledWith('/storage')
    openApp('appstore'); expect(router.push).toHaveBeenCalledWith('/apps/store')
    openApp('photos'); expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
    localStorage.removeItem('strangler:disabled:/kvm')
  })
  it('when only /settings is disabled, vm should still use in-app /kvm (reverse isolation)', () => {
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
  it('folder should use in-app push /files?path= (relying on Files.vue deep link normalization)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })
    expect(hrefs.length).toBe(0)
  })
  it('photo tile should use in-app push /photos (SP7-P8b cutover)', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
  it('photo tile: when fallback flag is set to 1, should fall back to Vue2 /#/photos', () => {
    localStorage.setItem('strangler:disabled:/photos', '1')
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
    expect(router.push).not.toHaveBeenCalled()
    localStorage.removeItem('strangler:disabled:/photos')
  })
})

describe('AI section cutover (SP8-P6)', () => {
  it('ai tile should use in-app router.push /ai/agent', () => {
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, ai tile should fall back to Vue2 /#/ai/agent', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('desktop AI widget should use in-app router.push /ai/agent', () => {
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, AI widget should fall back to Vue2', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent'])
  })

  it('sendToAI should use in-app with message query (object form, not manually encoded)', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('帮我找 发票 & 收据')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '帮我找 发票 & 收据' } })
    expect(hrefs.length).toBe(0)
  })

  it('sendToAI with empty text should not include query', () => {
    const { sendToAI } = useOpenAction()
    sendToAI('   ')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent' })
  })

  it('knowledge tile should use in-app router /ai/knowledge (SP14 #98, no fallback target)', () => {
    const { openApp } = useOpenAction()
    openApp('knowledge')
    expect(router.push).toHaveBeenCalledWith('/ai/knowledge')
    expect(hrefs.length).toBe(0)
  })

  it('when flag is set to 1, sendToAI should fall back to Vue2 and maintain encodeURIComponent string concatenation', () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const { sendToAI } = useOpenAction()
    sendToAI('发票 & 收据')
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs).toEqual(['/#/ai/agent?message=' + encodeURIComponent('发票 & 收据')])
  })
})
