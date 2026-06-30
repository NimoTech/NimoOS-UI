import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import GridItem from './GridItem.vue'
import type { LayoutItem } from '../grid/types'

let hrefs: string[]
beforeEach(() => {
  setActivePinia(createPinia())
  hrefs = []
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'host', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
})

describe('GridItem click', () => {
  it('clicking a folder navigates to files', async () => {
    const item: LayoutItem = { id: 'i', kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 1, r: 1, w: 1, h: 1 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="i"]').trigger('click')
    expect(hrefs[0]).toBe('/#/files?path=' + encodeURIComponent('/DATA/Gallery'))
  })
  it('clicking a photo navigates to /#/photos', async () => {
    const item: LayoutItem = { id: 'p', kind: 'photo', key: 'linear-gradient(0,#000)', c: 1, r: 1, w: 2, h: 2 }
    const w = mount(GridItem, { props: { item } })
    await w.get('[data-id="p"]').trigger('click')
    expect(hrefs[0]).toBe('/#/photos')
  })
})
