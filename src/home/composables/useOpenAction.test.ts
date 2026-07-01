import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from './useOpenAction'
import type { LayoutItem } from '../grid/types'

let hrefs: string[]
let opens: string[]
beforeEach(() => {
  setActivePinia(createPinia())
  hrefs = []; opens = []
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
  vi.stubGlobal('open', (u: string) => { opens.push(u); return null })
})

describe('useOpenAction.openApp', () => {
  it('system app navigates to its hash route', () => {
    const { openApp } = useOpenAction()
    openApp('files'); expect(hrefs[0]).toBe('/#/files')
  })
  it('settings/appstore navigate to /#/legacy', () => {
    const { openApp } = useOpenAction()
    openApp('settings'); expect(hrefs[0]).toBe('/#/legacy')
    openApp('appstore'); expect(hrefs[1]).toBe('/#/legacy')
  })
  it('running container app opens scheme://host:port/index', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'running', scheme: 'http', port: 8096, index: '/web' }] as any)
    const { openApp } = useOpenAction()
    openApp('jf'); expect(opens[0]).toBe('http://host:8096/web')
  })
  it('stopped container app notifies instead of opening', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jf', status: 'stopped' }] as any)
    const notify = vi.fn()
    const { openApp } = useOpenAction(notify)
    openApp('jf')
    expect(opens.length).toBe(0)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('未运行'))
  })
})

describe('useOpenAction.openItem', () => {
  it('folder navigates to files with encoded path', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/files?path=' + encodeURIComponent('/DATA/Gallery'))
  })
  it('photo navigates to /#/photos', () => {
    const { openItem } = useOpenAction()
    openItem({ id: 'i', kind: 'photo', key: 'abc', c: 1, r: 1, w: 2, h: 2 } as LayoutItem)
    expect(hrefs[0]).toBe('/#/photos')
  })
})
