import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextMenu from './ContextMenu.vue'

describe('ui/ContextMenu', () => {
  it('renders trigger area default slot', () => {
    const w = mount(ContextMenu, { slots: { default: '<div class="trigger">row</div>' } })
    expect(w.find('.trigger').exists()).toBe(true)
  })
})
