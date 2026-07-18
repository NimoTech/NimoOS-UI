import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import GridItem from './GridItem.vue'
import type { LayoutItem } from '../grid/types'

// P8 cutover:文件夹瓦片改应用内 router.push,需 mock 路由单例(vi.mock 会被提升到 import 前)。
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../router'

let hrefs: string[]
beforeEach(() => {
  setActivePinia(createPinia())
  hrefs = []
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
  vi.mocked(router.push).mockClear()
})

describe('GridItem click', () => {
  it('clicking a folder navigates to files', async () => {
    const item: LayoutItem = { id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="i"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/Gallery' } })
    expect(hrefs.length).toBe(0)
  })
  it('clicking a photo navigates to /#/photos', async () => {
    const item: LayoutItem = { id: 'p', kind: 'photo', key: 'linear-gradient(0,#000)', c: 1, r: 1, w: 2, h: 2 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="p"]').trigger('click')
    expect(hrefs[0]).toBe('/#/photos')
  })
})
