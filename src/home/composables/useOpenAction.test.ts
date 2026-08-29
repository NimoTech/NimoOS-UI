import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useSessionStore } from '../../stores/session'
import { useOpenAction } from './useOpenAction'
import { useStartApp, __resetStartAppForTest } from './useStartApp'
import type { LayoutItem } from '../grid/types'

// Workspace apps open in a new tab as `<origin>/#/<path>` (BASE_URL is '/' under vitest too).
const tab = (path: string) => `http://host${import.meta.env.BASE_URL}#${path}`

// The files entry uses in-app router.push, so the router singleton must be mocked (vi.mock is hoisted above imports).
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../router'

let hrefs: string[]
let opens: string[]
beforeEach(() => {
  setActivePinia(createPinia())
  __resetStartAppForTest()
  hrefs = []; opens = []
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', origin: 'http://host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
  vi.stubGlobal('open', (u: string) => { opens.push(u); return null })
  vi.mocked(router.push).mockClear()
})

describe('useOpenAction.openApp', () => {
  it('files tile opens /#/files in a new tab (2026-08-27: workspace apps leave the desktop tab alone)', () => {
    const { openApp } = useOpenAction()
    openApp('files')
    expect(opens).toEqual([tab('/files')])
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs.length).toBe(0)
  })
  it('workspace apps (files/photos/ai/appstore/knowledge/terminal) all open in a new tab; system panels (storage/settings/vm) stay in-app', () => {
    // The terminal tile is adminOnly — it only exists in the apps store for an admin session.
    useSessionStore().setUser({ role: 'admin' } as never)
    useAppsStore().setApps([])
    const { openApp } = useOpenAction()
    openApp('files'); openApp('photos'); openApp('ai'); openApp('appstore'); openApp('knowledge'); openApp('terminal')
    expect(opens).toEqual([
      tab('/files'), tab('/photos'), tab('/ai/agent'), tab('/apps/store'), tab('/ai/knowledge'), tab('/terminal'),
    ])
    expect(router.push).not.toHaveBeenCalled()
    openApp('storage'); openApp('settings'); openApp('vm')
    expect(vi.mocked(router.push).mock.calls.map((c) => c[0])).toEqual(['/storage', '/settings', '/kvm'])
    expect(opens).toHaveLength(6)
    expect(hrefs.length).toBe(0)
  })
  it('settings tile should use in-app router.push /settings', () => {
    const { openApp } = useOpenAction()
    openApp('settings')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
  })
  it('vm tile should use in-app router.push /kvm', () => {
    const { openApp } = useOpenAction()
    openApp('vm')
    expect(router.push).toHaveBeenCalledWith('/kvm')
    expect(hrefs.length).toBe(0)
  })
  it('appstore tile opens /#/apps/store in a new tab', () => {
    const { openApp } = useOpenAction()
    openApp('appstore')
    expect(opens).toEqual([tab('/apps/store')])
    expect(hrefs.length).toBe(0)
  })
  it('storage tile should use in-app router.push /storage', () => {
    const { openApp } = useOpenAction()
    openApp('storage')
    expect(router.push).toHaveBeenCalledWith('/storage')
    expect(hrefs.length).toBe(0)
  })
  it('photos tile opens /#/photos in a new tab', () => {
    const { openApp } = useOpenAction()
    openApp('photos')
    expect(opens).toEqual([tab('/photos')])
    expect(hrefs.length).toBe(0)
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
  it('photo tile should use in-app push /photos', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/photos')
    expect(hrefs.length).toBe(0)
  })
})

describe('AI section', () => {
  it('ai tile opens /#/ai/agent in a new tab', () => {
    const { openApp } = useOpenAction()
    openApp('ai')
    expect(opens).toEqual([tab('/ai/agent')])
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs.length).toBe(0)
  })

  it('desktop AI widget should use in-app router.push /ai/agent', () => {
    const { openItem } = useOpenAction()
    openItem({ kind: 'widget', key: 'ai' } as LayoutItem)
    expect(router.push).toHaveBeenCalledWith('/ai/agent')
    expect(hrefs.length).toBe(0)
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

  it('knowledge tile opens /#/ai/knowledge in a new tab (SP14 #98 route)', () => {
    const { openApp } = useOpenAction()
    openApp('knowledge')
    expect(opens).toEqual([tab('/ai/knowledge')])
    expect(hrefs.length).toBe(0)
  })
})
