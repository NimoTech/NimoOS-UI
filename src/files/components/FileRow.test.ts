import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FileRow from './FileRow.vue'
import { useClipboardStore } from '../stores/clipboard'

const mountOpts = { global: { stubs: { FileThumb: true, FavoriteStar: true } } }
const fileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 1536, date: '2026-01-02T10:00:00Z' }

describe('FileRow', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders name, a FileThumb, size; plain click emits open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.text()).toContain('a.txt')
    expect(w.find('.file-icon').exists()).toBe(true)
    expect(w.text()).toContain('1.5 KB')
    await w.trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('select')).toBeFalsy()
  })

  it('keeps an empty size cell for directories (column alignment)', () => {
    const w = mount(FileRow, { props: { entry: { name: 'Docs', path: '/DATA/Docs', is_dir: true } }, ...mountOpts })
    expect(w.find('.file-size').exists()).toBe(true)
    expect(w.find('.file-size').text()).toBe('')
  })

  it('ctrl/meta click emits select toggle; shift click emits select range; no open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    await w.trigger('click', { ctrlKey: true })
    expect(w.emitted('select')![0][0]).toEqual({ entry: fileEntry, mode: 'toggle' })
    await w.trigger('click', { shiftKey: true })
    expect(w.emitted('select')![1][0]).toEqual({ entry: fileEntry, mode: 'range' })
    expect(w.emitted('open')).toBeFalsy()
  })

  it('checkbox click emits select toggle and does NOT emit open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    await w.get('input.row-check').trigger('change')
    expect(w.emitted('select')![0][0]).toEqual({ entry: fileEntry, mode: 'toggle' })
    expect(w.emitted('open')).toBeFalsy()
  })

  it('adds .selected class and checks the box when selected', () => {
    const w = mount(FileRow, { props: { entry: fileEntry, selected: true }, ...mountOpts })
    expect(w.classes()).toContain('selected')
    expect((w.get('input.row-check').element as HTMLInputElement).checked).toBe(true)
  })

  it('右键 emit contextmenu 带 entry,且不 preventDefault(否则 reka-ui trigger 会 bail、菜单不弹)', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    w.element.dispatchEvent(ev)
    expect(w.emitted('contextmenu')?.[0]?.[0]).toMatchObject({ entry: fileEntry })
    // reka-ui ContextMenuTrigger.handleContextMenu 里 `if (!event.defaultPrevented)` —
    // 行/卡若吞掉默认,冒泡到 trigger 时会被判定为已处理而不弹菜单。
    expect(ev.defaultPrevented).toBe(false)
  })

  it('剪切态给行加 cut class', () => {
    useClipboardStore().operate('move', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-row').classes()).toContain('cut')
  })

  it('复制态不加 cut class', () => {
    useClipboardStore().operate('copy', [{ path: '/DATA/a.txt', is_dir: false }])
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.find('.file-row').classes()).not.toContain('cut')
  })
})
