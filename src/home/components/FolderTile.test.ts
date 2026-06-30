import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FolderTile from './FolderTile.vue'
import type { LayoutItem } from '../grid/types'
describe('FolderTile', () => {
  it('renders the folder name', () => {
    const w = mount(FolderTile, { props: { item: { id: 'i', kind: 'folder', key: 'Gallery', c: 1, r: 1, w: 1, h: 1 } as LayoutItem } })
    expect(w.text()).toContain('Gallery')
  })
})
