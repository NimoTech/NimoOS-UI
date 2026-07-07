import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FolderTile from './FolderTile.vue'
import FileThumb from '../../files/components/FileThumb.vue'
import type { LayoutItem } from '../grid/types'

function mk(key: string, path = ''): { item: LayoutItem } {
  return { item: { id: 'i', kind: 'folder', key, path, c: 1, r: 1, w: 1, h: 1 } as LayoutItem }
}

describe('FolderTile', () => {
  it('renders the folder name', () => {
    const w = mount(FolderTile, { props: mk('Gallery', '/DATA/Gallery') })
    expect(w.text()).toContain('Gallery')
  })

  it('renders a files-area FileThumb tagged .folder-ic', () => {
    const w = mount(FolderTile, { props: mk('Gallery', '/DATA/Gallery') })
    const thumb = w.findComponent(FileThumb)
    expect(thumb.exists()).toBe(true)
    expect(thumb.classes()).toContain('folder-ic')
  })

  // FolderTile 的职责 = 把 grid 项转成一个「目录」FileEntry 交给 FileThumb。
  // name=item.key + is_dir=true 保证 FileThumb→iconNameFor 走文件夹分支;
  // 具体名字→图标(Media→folder-video、任意名→folder-default)已由
  // src/files/util/icons.test.ts(第 19-24 行)端到端覆盖,这里不重复断言 URL。
  it('hands FileThumb a directory FileEntry with name=item.key', () => {
    const w = mount(FolderTile, { props: mk('Media', '/DATA/Media') })
    expect(w.findComponent(FileThumb).props('entry')).toEqual({ name: 'Media', path: '/DATA/Media', is_dir: true })
  })

  it('defaults path to empty string when the item has none', () => {
    const w = mount(FolderTile, { props: mk('Foo') })
    expect(w.findComponent(FileThumb).props('entry')).toEqual({ name: 'Foo', path: '', is_dir: true })
  })
})
