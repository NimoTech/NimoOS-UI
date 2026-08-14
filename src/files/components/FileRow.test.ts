import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FileRow from './FileRow.vue'
import { useClipboardStore } from '../stores/clipboard'
import { useFolderSizesStore } from '../stores/folderSizes'

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

  const dirEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }

  it('directory idle: size cell shows a Calculate button; click computes, does not open', async () => {
    const sizes = useFolderSizesStore()
    const spy = vi.spyOn(sizes, 'compute').mockResolvedValue()
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    const btn = w.get('.file-size button.size-compute')
    expect(btn.text()).toBe('计算')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith('/DATA/Docs')
    expect(w.emitted('open')).toBeFalsy()
    expect(w.emitted('select')).toBeFalsy()
  })

  it('directory loading: size cell shows a disabled button with the computing label; clicking it does not compute', async () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'loading' }
    const spy = vi.spyOn(sizes, 'compute').mockResolvedValue()
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    const btn = w.get('.file-size button.size-compute')
    expect(btn.text()).toBe('计算中…')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    expect(spy).not.toHaveBeenCalled()
  })

  it('directory done: size cell shows the formatted byte count as plain text', () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'done', bytes: 1536 }
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    expect(w.get('.file-size').text()).toBe('1.5 KB')
    expect(w.find('.file-size button').exists()).toBe(false)
  })

  it('directory error: size cell shows a Retry button that recomputes', async () => {
    const sizes = useFolderSizesStore()
    sizes.states['/DATA/Docs'] = { status: 'error' }
    const spy = vi.spyOn(sizes, 'compute').mockResolvedValue()
    const w = mount(FileRow, { props: { entry: dirEntry }, ...mountOpts })
    const btn = w.get('.file-size button.size-compute')
    expect(btn.text()).toBe('重试')
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledWith('/DATA/Docs')
  })

  it('uploading placeholder keeps the uploading label in the size cell (no compute button)', () => {
    const w = mount(FileRow, {
      props: { entry: { name: 'up', path: '/DATA/up', is_dir: true, uploading: true } },
      ...mountOpts,
    })
    expect(w.find('.file-size button').exists()).toBe(false)
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

// Bug 2 (second half): long names are truncated with the desktop area's
// ellipsis rule (AppTile.vue:49 / FolderTile.vue:26). The CSS itself cannot be
// asserted here — jsdom does no layout, so scrollWidth/clientWidth are both 0
// and `text-overflow` never resolves; that half is verified by the real-browser
// screenshots under .superpowers/sdd/2026-08-13-files-bugfix-batch/. What IS
// testable is the escape hatch: once a name can be visually cut off, the full
// name has to stay reachable, and in a file manager that is the only way to
// tell two 200-character names apart.
describe('FileRow long-name truncation', () => {
  const longName = 'a-very-long-file-name-'.repeat(12) + '.txt'

  it('gives the name element a title so hovering reveals the full name', () => {
    const w = mount(FileRow, {
      props: { entry: { ...fileEntry, name: longName, path: '/DATA/' + longName } },
      ...mountOpts,
    })
    expect(w.get('.file-name').attributes('title')).toBe(longName)
  })

  it('sets a title on short names too, rather than branching on a width jsdom cannot measure', () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.get('.file-name').attributes('title')).toBe('a.txt')
  })
})
