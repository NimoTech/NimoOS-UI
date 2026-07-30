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

describe('SP8-P2b Task 1 —— user 图标', () => {
  it('user 渲染出 circle + path,且按 24→20 单位缩放', () => {
    const w = mount(AgentIcon, { props: { name: 'user' } })
    const html = w.html()
    expect(html).toContain('transform="scale(0.8333)"')
    expect(html).toContain('cx="12"')
    expect(html).toContain('r="4"')
    expect(html).toContain('M4 21a8 8 0 0116 0')
  })

  it('对照组:20 单位的 folder 不带 scale 包裹', () => {
    expect(mount(AgentIcon, { props: { name: 'folder' } }).html()).not.toContain('scale(')
  })
})

// SP8-P2b 验收反馈(2026-07-30)—— 「Open Phoenix」原本用 download(向下箭头+底线)图标,
// 语义是「下载」而不是「在新标签页打开」。用户拍板换成外链图标,故新增 external。
// 20 单位坐标系手绘(与 folder/cpu 一族同制),不需要 scale 包裹。
describe('SP8-P2b 验收补丁 —— external(外链)图标', () => {
  it('external 渲染出非空 svg 内容', () => {
    expect(mount(AgentIcon, { props: { name: 'external' } }).find('svg').html())
      .toMatch(/<(path|rect|circle|g)\b/)
  })

  it('external 是 20 单位坐标系,不带 scale 包裹', () => {
    expect(mount(AgentIcon, { props: { name: 'external' } }).html()).not.toContain('scale(')
  })
})
