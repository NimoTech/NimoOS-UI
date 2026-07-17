import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import AppTile from './AppTile.vue'
import type { LayoutItem } from '../grid/types'

const item = (key: string): LayoutItem => ({ id: 'i', kind: 'app', key, c: 1, r: 1, w: 1, h: 1 })

describe('AppTile', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('renders the bundled Vue2 icon img + label for a system app', () => {
    const w = mount(AppTile, { props: { item: item('files') } })
    expect(w.find('img').attributes('src')).toContain('files.svg')
    expect(w.text()).toContain('文件')
  })
  it('renders a remote img for a container app with icon', () => {
    const s = useAppsStore()
    s.setApps([{ name: 'jellyfin', title: { zh_cn: '影音' }, icon: 'http://x/i.png' }] as any)
    const w = mount(AppTile, { props: { item: item('jellyfin') } })
    expect(w.find('img').attributes('src')).toBe('http://x/i.png')
    expect(w.text()).toContain('影音')
  })
  it('dims a non-system stopped app but not a running one, undefined-status one, or a system app', () => {
    const s = useAppsStore()
    s.setApps([
      { name: 'jellyfin', title: { zh_cn: '影音' }, status: 'stopped' },
      { name: 'plex', title: { zh_cn: '播放' }, status: 'running' },
      { name: 'emby', title: { zh_cn: '影库' }, status: undefined }, // status unknown (not yet loaded)
    ] as any)
    expect(mount(AppTile, { props: { item: item('jellyfin') } }).classes()).toContain('stopped')
    expect(mount(AppTile, { props: { item: item('plex') } }).classes()).not.toContain('stopped')
    expect(mount(AppTile, { props: { item: item('emby') } }).classes()).not.toContain('stopped') // undefined status doesn't dim
    expect(mount(AppTile, { props: { item: item('files') } }).classes()).not.toContain('stopped') // system app never dims
  })
})
