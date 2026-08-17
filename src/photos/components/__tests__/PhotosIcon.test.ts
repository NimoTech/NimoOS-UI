import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosIcon from '../PhotosIcon.vue'

describe('PhotosIcon — Plan G additions', () => {
  it('renders panelRight as a rect+path pair (byte-identical to Vue2 PhotosIcon.vue:130-132)', () => {
    const wrapper = mount(PhotosIcon, { props: { name: 'panelRight' } })
    expect(wrapper.find('rect').attributes()).toMatchObject({ x: '3', y: '4', width: '18', height: '16', rx: '2' })
    expect(wrapper.find('path').attributes('d')).toBe('M15 4v16')
  })

  it('renders chevL as a single path (byte-identical to Vue2 PhotosIcon.vue:57-59)', () => {
    const wrapper = mount(PhotosIcon, { props: { name: 'chevL' } })
    expect(wrapper.find('path').attributes('d')).toBe('m15 6-6 6 6 6')
  })
})

describe('PhotosIcon — Plan H additions', () => {
  it('renders two filled rects for name="pause"', () => {
    const w = mount(PhotosIcon, { props: { name: 'pause' } })
    expect(w.findAll('rect')).toHaveLength(2)
  })

  it('renders the circular-arrow paths for name="refresh"', () => {
    const w = mount(PhotosIcon, { props: { name: 'refresh' } })
    expect(w.findAll('path')).toHaveLength(4)
  })

  it('falls back to an empty <g> for an unknown name (existing behavior, unaffected)', () => {
    const w = mount(PhotosIcon, { props: { name: 'not-a-real-icon' } })
    expect(w.find('g').exists()).toBe(true)
  })

  // Task 3 review fix: Favorites hero's Export button needs this leading icon
  // (Vue2 PhotosFavoritesView.vue:27's `<photos-icon name="download" :size="13"/>`).
  it('renders a single path for name="download" (byte-identical to Vue2 PhotosIcon.vue)', () => {
    const w = mount(PhotosIcon, { props: { name: 'download' } })
    expect(w.find('path').attributes('d')).toBe('M12 4v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2')
  })
})
