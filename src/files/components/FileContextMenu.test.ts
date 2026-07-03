import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import FileContextMenu from './FileContextMenu.vue'
import type { FileEntry } from '../stores/files'

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

  it('点删除项 emit action=delete', async () => {
    const entry: FileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false }
    const w = mountMenu({ entry, selectedCount: 1 })
    await w.find('.ctx-delete').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['delete', entry])
  })
})
