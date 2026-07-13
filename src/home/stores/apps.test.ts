import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from './apps'

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
