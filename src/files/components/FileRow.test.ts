import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileRow from './FileRow.vue'

const mountOpts = { global: { stubs: { FileThumb: true, FavoriteStar: true } } }

describe('FileRow', () => {
  it('renders name, a FileThumb, size for files; emits open on click', async () => {
    const entry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 1536, date: '2026-01-02T10:00:00Z' }
    const w = mount(FileRow, { props: { entry }, ...mountOpts })
    expect(w.text()).toContain('a.txt')
    expect(w.find('.file-icon').exists()).toBe(true)   // FileThumb stub 根带 file-icon 类
    expect(w.text()).toContain('1.5 KB')
    await w.trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('open')![0][0]).toEqual(entry)
  })

  it('keeps the size column but shows no size text for directories (column alignment)', () => {
    const entry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mount(FileRow, { props: { entry }, ...mountOpts })
    expect(w.text()).toContain('Docs')
    expect(w.find('.file-size').exists()).toBe(true)
    expect(w.find('.file-size').text()).toBe('')
  })
})
