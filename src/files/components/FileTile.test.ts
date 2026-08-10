// src/files/components/FileTile.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FileTile from './FileTile.vue'
import { useClipboardStore } from '../stores/clipboard'

const mountOpts = { global: { stubs: { FileThumb: true, FavoriteStar: true } } }
const fileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 1536, date: '2026-01-02T10:00:00Z' }

describe('FileTile', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders name + a FileThumb; plain click emits open', async () => {
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.text()).toContain('a.txt')
    expect(w.find('.tile-icon').exists()).toBe(true)
    await w.trigger('click')
    expect(w.emitted('open')).toBeTruthy()
  })

  it('剪切态给卡加 cut class', () => {
    useClipboardStore().operate('move', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-tile').classes()).toContain('cut')
  })

  it('复制态不加 cut class', () => {
    useClipboardStore().operate('copy', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-tile').classes()).not.toContain('cut')
  })
})
