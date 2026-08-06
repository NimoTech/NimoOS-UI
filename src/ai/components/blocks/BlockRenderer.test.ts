import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BlockRenderer from './BlockRenderer.vue'

// SP8-P1b Task 8:BLOCK_MAP 从"只有 md"恢复成全量 20 类型分发,
// 'tool'/'thinking' 不再是"未实现"—— 这两个类型的降级态断言改用真正
// 未映射的类型名。BlockRenderer.batchA.test.ts 覆盖了全量分发 + 17 个新渲染器。
describe('BlockRenderer (md + fallback chip)', () => {
  it('md 类型走 MarkdownBlock,渲染出 markdown 生成的 HTML', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'md', text: '**b**' } } })
    expect(w.find('.md').exists()).toBe(true)
    expect(w.html()).toContain('<strong>b</strong>')
  })

  it('未知/未实现的 block 类型降级为灰 chip,显示类型名', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'nonexistent_type' } } })
    expect(w.find('.md').exists()).toBe(false)
    expect(w.find('.block-chip').exists()).toBe(true)
    expect(w.text()).toContain('[nonexistent_type]')
  })

  it('任意其他未映射类型同样降级为 chip', () => {
    const w = mount(BlockRenderer, { props: { block: { type: 'totally_unknown' } } })
    expect(w.find('.block-chip').text()).toBe('[totally_unknown]')
  })
})
