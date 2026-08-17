import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import FileContextMenu from './FileContextMenu.vue'
import type { FileEntry } from '../stores/files'
import { useClipboardStore } from '../stores/clipboard'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// reka-ui ContextMenuContent only renders to Portal when open; in tests, use stub to render
// #menu slot directly to assert the pure conditional logic of "which items appear in the menu"
// (positioning/keyboard/opening are left for real device verification).
const ContextMenuStub = {
  template: '<div><slot /><div class="menu"><slot name="menu" /></div></div>',
}
// The real reka-ui ContextMenuItem injects MenuRootContext in setup() (provided by real
// ContextMenuRoot); the ContextMenu stub above no longer renders MenuRoot, so mounting
// the real ContextMenuItem would immediately throw "must be used within MenuRoot". Stub
// ContextMenuItem itself (pass through by class + emit select on click), only verify the
// pure conditional logic of "which items are rendered + click triggers fire()"; leave
// real positioning/keyboard/highlight interactions to real device verification (T10).
const ContextMenuItemStub = {
  emits: ['select'],
  template: '<div @click="$emit(\'select\')"><slot /></div>',
}
function mountMenu(props: { entry: FileEntry | null; selectedCount: number }) {
  return mount(FileContextMenu, {
    props,
    global: {
      plugins: [createPinia(), i18n],
      stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub },
    },
  })
}

// mountMenu internally creates a fresh pinia, which is not the same instance as the store
// we mutate manually here (useStore() inside component setup will override activePinia with
// the pinia it injects) — must create pinia ourselves, setActive it, set up state, then
// pass the same pinia instance to mount's global.plugins.
// Hoisted to file scope (SP11 T10) so both the snapshot-menu suite and the
// "set as wallpaper" suite can enter snapshot view the same way.
function mountSnapshotMenu(props: { entry: FileEntry | null; selectedCount: number }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const browse = useSnapshotBrowseStore()
  browse.status = 'ready'
  browse.volumes = [{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]
  useFilesStore().currentPath = '/DATA/.snapshots/snap1'
  return mount(FileContextMenu, {
    props,
    global: {
      plugins: [pinia, i18n],
      stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub },
    },
  })
}

describe('FileContextMenu', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('blank area: new file / new folder / refresh', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('新建文件夹')
    expect(txt).toContain('新建文件')
    expect(txt).toContain('刷新')
    expect(txt).not.toContain('删除')
  })

  it('regular file (single select): copy path + delete, no rename or favorites (file is not dir)', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('复制路径')
    expect(txt).toContain('重命名')
    expect(txt).toContain('删除')
    expect(txt).not.toContain('取消收藏') // non-dir items do not show favorites
    expect(txt).not.toContain('收藏')
  })

  it('regular folder: includes favorites', () => {
    const entry: FileEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.menu').text()).toContain('收藏')
  })

  it('protected folder: no rename / delete', () => {
    const entry: FileEntry = { name: 'Documents', path: '/DATA/Documents', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    const txt = w.find('.menu').text()
    expect(txt).not.toContain('重命名')
    expect(txt).not.toContain('删除')
    expect(txt).toContain('收藏') // favorites are not subject to protection restrictions
  })

  it('multi-select: hide single-select items (copy path / rename), keep delete', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 3 })
    const txt = w.find('.menu').text()
    expect(txt).not.toContain('复制路径')
    expect(txt).not.toContain('重命名')
    expect(txt).toContain('删除')
  })

  it('multi-select folder: also do not show favorites (favorites are single-item operation)', () => {
    const entry: FileEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 3 })
    expect(w.find('.menu').text()).not.toContain('收藏')
  })

  it('when menu has only delete, no separator appears above delete', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 3 }) // multi-select → only delete remains
    expect(w.find('.ctx-delete').exists()).toBe(true)
    expect(w.find('.ui-ctx-sep').exists()).toBe(false)
  })

  it('single-select operable item: separator appears above delete (copy path etc. above)', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ui-ctx-sep').exists()).toBe(true)
  })

  it('click delete item emits action=delete', async () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    await w.find('.ctx-delete').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['delete', entry])
  })

  it('file menu contains copy (always) + cut (operable)', () => {
    const w = mountMenu({ entry: { name: 'a', path: '/DATA/a', is_dir: false } as FileEntry, selectedCount: 1 })
    expect(w.find('.ctx-copy').exists()).toBe(true)
    expect(w.find('.ctx-cut').exists()).toBe(true)
  })

  it('protected item: cut hidden, copy remains', () => {
    const w = mountMenu({ entry: { name: 'AppData', path: '/DATA/AppData', is_dir: true } as FileEntry, selectedCount: 1 })
    expect(w.find('.ctx-cut').exists()).toBe(false)
    expect(w.find('.ctx-copy').exists()).toBe(true)
  })

  it('offers a single Paste entry, not a pre-chosen overwrite/skip pair', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useClipboardStore().operate('copy', [{ path: '/DATA/a', is_dir: false }])
    const w = mount(FileContextMenu, {
      props: { entry: null, selectedCount: 0 },
      global: { plugins: [pinia, i18n], stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub } },
    })
    expect(w.findAll('.ctx-paste')).toHaveLength(1)
    expect(w.find('.ctx-paste-overwrite').exists()).toBe(false)
    expect(w.find('.ctx-paste-skip').exists()).toBe(false)
  })

  it('blank area: no Paste entry when the clipboard is empty', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    expect(w.find('.ctx-paste').exists()).toBe(false)
  })

  it('file menu contains "download" item and always shows (single-select)', () => {
    const wrapper = mountMenu({ entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, selectedCount: 1 })
    expect(wrapper.find('.ctx-download').exists()).toBe(true)
  })

  it('multi-select: "download" still shows', () => {
    const wrapper = mountMenu({ entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, selectedCount: 3 })
    expect(wrapper.find('.ctx-download').exists()).toBe(true)
  })

  it('blank area: contains upload file / upload folder', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('上传文件')
    expect(txt).toContain('上传文件夹')
  })

  it('click upload file item emits action=upload-file', async () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    await w.find('.ctx-upload-file').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['upload-file', null])
  })

  it('click upload folder item emits action=upload-folder', async () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    await w.find('.ctx-upload-folder').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['upload-folder', null])
  })

  it('folder single-select shows "share to LAN"', () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ctx-share').exists()).toBe(true)
  })

  it('file item does not show "share to LAN"', () => {
    const entry: FileEntry = { name: 'f.txt', path: '/DATA/f.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ctx-share').exists()).toBe(false)
  })

  it('folder multi-select does not show "share to LAN" (sharing entry for single-select only)', () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 3 })
    expect(w.find('.ctx-share').exists()).toBe(false)
  })

  it('already shared folder does not show "share to LAN" (avoid backend SHARE_ALREADY_EXISTS)', () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true, extensions: { share: { shared: 'true' } } }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ctx-share').exists()).toBe(false)
  })

  it('click share item emits action=share', async () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    await w.find('.ctx-share').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['share', entry])
  })

  describe('snapshot read-only menu', () => {
    it('blank area menu only has refresh left', () => {
      const w = mountSnapshotMenu({ entry: null, selectedCount: 0 })
      const txt = w.find('.menu').text()
      expect(txt).toContain('刷新')
      expect(txt).not.toContain('新建文件夹')
      expect(txt).not.toContain('粘贴')
    })

    it('item menu only has restore to original location + download left', () => {
      const entry: FileEntry = { name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false }
      const w = mountSnapshotMenu({ entry, selectedCount: 1 })
      const txt = w.find('.menu').text()
      expect(txt).toContain('恢复到原位置')
      expect(txt).toContain('下载')
      expect(txt).not.toContain('删除')
      expect(txt).not.toContain('重命名')
      expect(txt).not.toContain('复制路径')
    })

    it('multi-select: restore to original location does not appear (restore copy is for single path)', () => {
      const entry: FileEntry = { name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false }
      const w = mountSnapshotMenu({ entry, selectedCount: 3 })
      expect(w.find('.menu').text()).not.toContain('恢复到原位置')
    })

    it('click restore to original location emits action=restore-original', async () => {
      const entry: FileEntry = { name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false }
      const w = mountSnapshotMenu({ entry, selectedCount: 1 })
      await w.find('.ctx-restore-original').trigger('click')
      expect(w.emitted('action')?.[0]?.[0]).toBe('restore-original')
    })
  })

  describe('set as wallpaper (SP11)', () => {
    const img = { name: 'a.jpg', path: '/DATA/Gallery/a.jpg', is_dir: false } as FileEntry

    it('appears for a single image outside snapshot view', () => {
      const w = mountMenu({ entry: img, selectedCount: 1 })
      expect(w.find('.ctx-set-wallpaper').exists()).toBe(true)
    })
    it('hides for a non-image', () => {
      const w = mountMenu({ entry: { name: 'a.mp4', path: '/DATA/a.mp4', is_dir: false }, selectedCount: 1 })
      expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
    })
    it('hides for a folder', () => {
      const w = mountMenu({ entry: { name: 'Gallery', path: '/DATA/Gallery', is_dir: true }, selectedCount: 1 })
      expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
    })
    it('hides on multi-select, like Copy Path and Rename', () => {
      const w = mountMenu({ entry: img, selectedCount: 3 })
      expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
    })
    it('hides in snapshot view, which is read-only', () => {
      const w = mountSnapshotMenu({ entry: img, selectedCount: 1 })
      expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
    })
    it('emits the set-wallpaper action with the entry', async () => {
      const w = mountMenu({ entry: img, selectedCount: 1 })
      await w.find('.ctx-set-wallpaper').trigger('click')
      expect(w.emitted('action')?.[0]).toEqual(['set-wallpaper', img])
    })
  })
})
