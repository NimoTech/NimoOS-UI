import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BlockRenderer from './BlockRenderer.vue'

// BLOCK_MAP recovers from "md only" to full 20-type dispatch,
// 'tool'/'thinking' is no longer "unimplemented" — assertions for fallback state of these two types use truly unmapped type names.
// BlockRenderer.batchA.test.ts covers full dispatch + 17 new renderers.
describe('BlockRenderer (md + fallback chip)', () => {
  it('md type uses MarkdownBlock, renders HTML generated from markdown', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'md', text: '**b**' } } })
    expect(w.find('.md').exists()).toBe(true)
    expect(w.html()).toContain('<strong>b</strong>')
  })

  it('unknown/unimplemented block type degrades to gray chip, shows type name', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'nonexistent_type' } } })
    expect(w.find('.md').exists()).toBe(false)
    expect(w.find('.block-chip').exists()).toBe(true)
    expect(w.text()).toContain('[nonexistent_type]')
  })

  it('any other unmapped type also degrades to chip', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'totally_unknown' } } })
    expect(w.find('.block-chip').text()).toBe('[totally_unknown]')
  })
})
