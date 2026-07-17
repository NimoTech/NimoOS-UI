import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore, clampWidgetDecl } from './apps'

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
      { name: 'files' }, // 不能覆盖系统 files
    ] as any)
    expect(s.app('jellyfin')?.name).toBe('影音')
    expect(s.app('jellyfin')?.icon).toBe('http://x/i.png')
    expect(s.app('jellyfin')?.system).toBe(false)
    expect(s.app('files')?.system).toBe(true) // 系统 files 未被覆盖
  })
  it('falls back to en_US (uppercase) title from store-installed apps', () => {
    const s = useAppsStore()
    // 应用市场装的 v2 应用 title 键是大写 en_US(来自 store compose 文件),不能退化成裸 id
    s.setApps([{ name: 'actualbudget', title: { en_US: 'Actual Budget' }, app_type: 'v2app' }] as any)
    expect(s.app('actualbudget')?.name).toBe('Actual Budget')
  })
})

describe('clampWidgetDecl', () => {
  it('缺省/非法 → 2×2', () => {
    expect(clampWidgetDecl(undefined, undefined)).toEqual([2, 2])
    expect(clampWidgetDecl(0, -1)).toEqual([2, 2])
  })
  it('夹紧 w∈[2,4] h∈[1,4]', () => {
    expect(clampWidgetDecl(1, 1)).toEqual([2, 1])
    expect(clampWidgetDecl(9, 9)).toEqual([4, 4])
    expect(clampWidgetDecl(3, 2)).toEqual([3, 2])
  })
})

describe('desktop 应用透传', () => {
  it('setApps 透传 desktop/widget,desktopDecls 只出 desktop 应用', () => {
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

  it('desktopDecls 排除未运行容器(停止就消失);status 缺省视为运行', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'up', title: { en_us: 'U' }, status: 'running', desktop: true },
      { name: 'down', title: { en_us: 'D' }, status: 'exited', desktop: true },
      { name: 'no-status', title: { en_us: 'N' }, desktop: true },
    ] as never)
    expect(store.desktopDecls().map((d) => d.key)).toEqual(['up', 'no-status'])
  })

  it('stoppedDesktopKeys 只报 exited/dead,restarting/running/缺省不算', () => {
    const store = useAppsStore()
    store.setApps([
      { name: 'up', status: 'running', desktop: true },
      { name: 'down', status: 'exited', desktop: true },
      { name: 'dead1', status: 'dead', desktop: true },
      { name: 'mid', status: 'restarting', desktop: true },
      { name: 'plain-down', status: 'exited' }, // 非 desktop 不算
    ] as never)
    expect(store.stoppedDesktopKeys()).toEqual(['down', 'dead1'])
  })

  it('desktop 应用相对 icon 绝对化到应用自身端口', () => {
    const store = useAppsStore()
    store.setApps([{ name: 'a', desktop: true, icon: '/icon.png', port: '8080', scheme: 'http' }] as never)
    expect(store.app('a')?.icon).toBe(`http://${window.location.hostname}:8080/icon.png`)
  })

  describe('isStopped', () => {
    it('exited/dead/unknown 容器应用算已停止', () => {
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
    it('running / 缺省 status / 系统应用 / LinkApp / 不存在的 key 都不算', () => {
      const s = useAppsStore()
      s.setApps([
        { name: 'run', status: 'running' },
        { name: 'nostatus' },
        { name: 'link', status: 'exited', app_type: 'LinkApp' },
      ] as never)
      expect(s.isStopped('run')).toBe(false)
      expect(s.isStopped('nostatus')).toBe(false)
      expect(s.isStopped('link')).toBe(false)
      expect(s.isStopped('files')).toBe(false) // 系统应用
      expect(s.isStopped('ghost')).toBe(false) // 不存在
    })
  })
})
