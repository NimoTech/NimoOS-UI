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

  // FolderTile's responsibility = convert a grid item into a "directory" FileEntry to pass to FileThumb.
  // name=item.key + is_dir=true ensures FileThumb→iconNameFor takes the folder branch;
  // specific name→icon mapping (Media→folder-video, any name→folder-default) is already covered
  // end-to-end by src/files/util/icons.test.ts (lines 19-24), so we don't repeat the URL assertion here.
  it('hands FileThumb a directory FileEntry with name=item.key', () => {
    const w = mount(FolderTile, { props: mk('Media', '/DATA/Media') })
    expect(w.findComponent(FileThumb).props('entry')).toEqual({ name: 'Media', path: '/DATA/Media', is_dir: true })
  })

  it('defaults path to empty string when the item has none', () => {
    const w = mount(FolderTile, { props: mk('Foo') })
    expect(w.findComponent(FileThumb).props('entry')).toEqual({ name: 'Foo', path: '', is_dir: true })
  })
})
