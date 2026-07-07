import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import FileContextMenu from './FileContextMenu.vue'
import type { FileEntry } from '../stores/files'
import { useClipboardStore } from '../stores/clipboard'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

// reka-ui ContextMenuContent 只在打开时渲染到 Portal;测试里改用 stub 直接渲染 #menu slot,
// 以断言"菜单里出现哪些项"的纯条件逻辑(定位/键盘/打开留真机验)。
const ContextMenuStub = {
  template: '<div><slot /><div class="menu"><slot name="menu" /></div></div>',
}
// 真实 reka-ui ContextMenuItem 在 setup() 里 inject 了 MenuRootContext(由真实
// ContextMenuRoot 提供);上面的 ContextMenu stub 不再渲染 MenuRoot,所以真实
// ContextMenuItem 挂载会直接抛 "must be used within MenuRoot"。stub 掉
// ContextMenuItem 本身(按 class 透传 + 点击发 select),只验证"渲染哪些项 +
// 点击触发 fire()"这层纯条件逻辑;真实的定位/键盘/高亮交互留 T10 真机验证。
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

describe('FileContextMenu', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('空白区:新建文件/新建文件夹/刷新', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('新建文件夹')
    expect(txt).toContain('新建文件')
    expect(txt).toContain('刷新')
    expect(txt).not.toContain('删除')
  })

  it('普通文件(单选):复制路径 + 删除,无重命名收藏(文件非 dir)', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('复制路径')
    expect(txt).toContain('重命名')
    expect(txt).toContain('删除')
    expect(txt).not.toContain('取消收藏') // 非 dir 不显示收藏
    expect(txt).not.toContain('收藏')
  })

  it('普通文件夹:含收藏', () => {
    const entry: FileEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.menu').text()).toContain('收藏')
  })

  it('受保护文件夹:无重命名/删除', () => {
    const entry: FileEntry = { name: 'Documents', path: '/DATA/Documents', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    const txt = w.find('.menu').text()
    expect(txt).not.toContain('重命名')
    expect(txt).not.toContain('删除')
    expect(txt).toContain('收藏') // 收藏不受保护限制
  })

  it('多选:隐藏单选项(复制路径/重命名),保留删除', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 3 })
    const txt = w.find('.menu').text()
    expect(txt).not.toContain('复制路径')
    expect(txt).not.toContain('重命名')
    expect(txt).toContain('删除')
  })

  it('多选文件夹:也不显示收藏(收藏是单项操作)', () => {
    const entry: FileEntry = { name: 'Docs', path: '/DATA/Docs', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 3 })
    expect(w.find('.menu').text()).not.toContain('收藏')
  })

  it('菜单只剩删除时,删除上方不出现分割线', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 3 }) // 多选 → 只有删除
    expect(w.find('.ctx-delete').exists()).toBe(true)
    expect(w.find('.ui-ctx-sep').exists()).toBe(false)
  })

  it('单选可操作项:删除上方有分割线(其上还有复制路径等)', () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ui-ctx-sep').exists()).toBe(true)
  })

  it('点删除项 emit action=delete', async () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    await w.find('.ctx-delete').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['delete', entry])
  })

  it('文件项菜单含 复制(总是) + 剪切(operable)', () => {
    const w = mountMenu({ entry: { name: 'a', path: '/DATA/a', is_dir: false } as FileEntry, selectedCount: 1 })
    expect(w.find('.ctx-copy').exists()).toBe(true)
    expect(w.find('.ctx-cut').exists()).toBe(true)
  })

  it('受保护项:剪切隐藏,复制仍在', () => {
    const w = mountMenu({ entry: { name: 'AppData', path: '/DATA/AppData', is_dir: true } as FileEntry, selectedCount: 1 })
    expect(w.find('.ctx-cut').exists()).toBe(false)
    expect(w.find('.ctx-copy').exists()).toBe(true)
  })

  it('空白区:有剪贴板内容时出现 粘贴(覆盖)/(跳过)', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useClipboardStore().operate('copy', ['/DATA/a'])
    const w = mount(FileContextMenu, {
      props: { entry: null, selectedCount: 0 },
      global: { plugins: [pinia, i18n], stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub } },
    })
    expect(w.find('.ctx-paste-overwrite').exists()).toBe(true)
    expect(w.find('.ctx-paste-skip').exists()).toBe(true)
  })

  it('空白区:无剪贴板内容时无粘贴项', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    expect(w.find('.ctx-paste-overwrite').exists()).toBe(false)
  })

  it('文件项菜单含「下载」项且恒显(单选)', () => {
    const wrapper = mountMenu({ entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, selectedCount: 1 })
    expect(wrapper.find('.ctx-download').exists()).toBe(true)
  })

  it('多选时「下载」仍显示', () => {
    const wrapper = mountMenu({ entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, selectedCount: 3 })
    expect(wrapper.find('.ctx-download').exists()).toBe(true)
  })

  it('空白区:含上传文件/上传文件夹', () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    const txt = w.find('.menu').text()
    expect(txt).toContain('上传文件')
    expect(txt).toContain('上传文件夹')
  })

  it('点上传文件项 emit action=upload-file', async () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    await w.find('.ctx-upload-file').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['upload-file', null])
  })

  it('点上传文件夹项 emit action=upload-folder', async () => {
    const w = mountMenu({ entry: null, selectedCount: 0 })
    await w.find('.ctx-upload-folder').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['upload-folder', null])
  })

  it('文件夹单选显示「共享到局域网」', () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ctx-share').exists()).toBe(true)
  })

  it('文件项不显示「共享到局域网」', () => {
    const entry: FileEntry = { name: 'f.txt', path: '/DATA/f.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    expect(w.find('.ctx-share').exists()).toBe(false)
  })

  it('文件夹多选不显示「共享到局域网」(共享入口仅单选)', () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 3 })
    expect(w.find('.ctx-share').exists()).toBe(false)
  })

  it('点共享项 emit action=share', async () => {
    const entry: FileEntry = { name: 'D', path: '/DATA/D', is_dir: true }
    const w = mountMenu({ entry, selectedCount: 1 })
    await w.find('.ctx-share').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['share', entry])
  })
})
