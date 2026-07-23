import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BlockRenderer from './BlockRenderer.vue'

describe('BlockRenderer (1a: md + fallback chip)', () => {
  it('md 类型走 MarkdownBlock,渲染出 markdown 生成的 HTML', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'md', text: '**b**' } } })
    expect(w.find('.md').exists()).toBe(true)
    expect(w.html()).toContain('<strong>b</strong>')
  })

  it('未知/未实现的 block 类型(如 tool)降级为灰 chip,显示类型名', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'tool' } } })
    expect(w.find('.md').exists()).toBe(false)
    expect(w.find('.block-chip').exists()).toBe(true)
    expect(w.text()).toContain('[tool]')
  })

  it('任意其他未映射类型同样降级为 chip', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'thinking' } } })
    expect(w.find('.block-chip').text()).toBe('[thinking]')
  })
})
