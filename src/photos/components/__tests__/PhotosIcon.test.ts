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
