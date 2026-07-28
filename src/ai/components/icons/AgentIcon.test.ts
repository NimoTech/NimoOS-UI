import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentIcon from './AgentIcon.vue'

// SP8-P2a Task 1 —— 设置区导航与顶栏需要的 9 个图标。
const P2A_ICONS = ['cpu', 'cloud', 'lock', 'gauge', 'steps', 'book', 'waves', 'grid', 'key']

describe('AgentIcon — SP8-P2a 新增图标', () => {
  it.each(P2A_ICONS)('%s 渲染出非空的 svg 内容', (name) => {
    const w = mount(AgentIcon, { props: { name } })
    expect(w.find('svg').html()).toMatch(/<(path|rect|circle|g)\b/)
  })

  it('未知图标名渲染成空 svg(既有兜底行为不变)', () => {
    const w = mount(AgentIcon, { props: { name: 'definitely-not-an-icon' } })
    expect(w.find('svg').html()).not.toMatch(/<(path|rect|circle|g)\b/)
  })

  it('book 走 scale(0.8333) 包裹(源图标是 24 单位坐标系)', () => {
    const w = mount(AgentIcon, { props: { name: 'book' } })
    expect(w.find('svg').html()).toContain('scale(0.8333)')
  })

  it('cpu 不带 scale 包裹(源路径本就是 20 单位坐标系)', () => {
    const w = mount(AgentIcon, { props: { name: 'cpu' } })
    expect(w.find('svg').html()).not.toContain('scale(')
  })
})
