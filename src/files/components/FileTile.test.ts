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

  it('adds cut class to tile in cut state', () => {
    useClipboardStore().operate('move', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-tile').classes()).toContain('cut')
  })

  it('does not add cut class in copy state', () => {
    useClipboardStore().operate('copy', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-tile').classes()).not.toContain('cut')
  })
})

// See FileRow.test.ts's matching block for why only the title attribute is
// asserted here and the ellipsis itself is left to the real-browser evidence.
describe('FileTile long-name truncation', () => {
  const longName = 'a-very-long-file-name-'.repeat(12) + '.txt'

  it('gives the name element a title so hovering reveals the full name', () => {
    const w = mount(FileTile, {
      props: { entry: { ...fileEntry, name: longName, path: '/DATA/' + longName } },
      ...mountOpts,
    })
    expect(w.get('.tile-name').attributes('title')).toBe(longName)
  })

  it('sets a title on short names too', () => {
    const w = mount(FileTile, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.get('.tile-name').attributes('title')).toBe('a.txt')
  })
})
