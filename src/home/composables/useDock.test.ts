import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useDock } from './useDock'

describe('useDock', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('defaults favKeys to the 5 dock keys and computes moreKeys as the rest', () => {
    useAppsStore() // 系统 6 应用就位
    const d = useDock()
    expect(d.favKeys.value).toEqual(['files', 'photos', 'ai', 'vm', 'appstore'])
    expect(d.moreKeys.value).toContain('settings') // 第 6 个系统应用进 more
    expect(d.moreKeys.value).not.toContain('files')
  })
  it('setFav persists to localStorage', () => {
    useAppsStore()
    const d = useDock()
    d.setFav(['files', 'photos'])
    expect(JSON.parse(localStorage.getItem('nimoos.home.dockfav')!)).toEqual(['files', 'photos'])
    expect(d.moreKeys.value).toContain('ai')
  })
})
