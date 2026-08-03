import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LogConsole from './LogConsole.vue'

describe('LogConsole', () => {
  it('text 为空时显示 emptyText', () => {
    const w = mount(LogConsole, { props: { text: '', emptyText: '暂无日志' } })
    expect(w.find('pre').text()).toBe('暂无日志')
  })

  it('text 非空时不落回 emptyText', () => {
    const w = mount(LogConsole, { props: { text: 'line1\nline2', emptyText: '暂无日志' } })
    expect(w.find('pre').text()).toBe('line1\nline2')
  })

  it('tools 具名插槽内容被渲染', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      slots: { tools: '<button data-test="my-tool">工具</button>' },
    })
    expect(w.find('[data-test="my-tool"]').exists()).toBe(true)
  })

  it('$attrs 透到 <pre> 上(inheritAttrs:false + v-bind="$attrs")', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      attrs: { 'data-test': 'logs-pre', class: 'caller-class' },
    })
    const pre = w.find('pre')
    expect(pre.attributes('data-test')).toBe('logs-pre')
    // class 应合并(调用方的类 + 组件自身的 log-console-pre),不是互相覆盖
    expect(pre.classes()).toContain('caller-class')
    expect(pre.classes()).toContain('log-console-pre')
    // 而且不应该被透到根 div 上(inheritAttrs:false 生效的直接证据)
    expect(w.find('.log-console').attributes('data-test')).toBeUndefined()
  })

  it('贴底时(scrollTop+clientHeight 接近 scrollHeight)text 变化后自动滚到底', async () => {
    const w = mount(LogConsole, { props: { text: 'line1' } })
    const el = w.find('pre').element as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    el.scrollTop = 805 // 1000 - 805 - 200 = -5 < 40 阈值 → 判定贴底

    await w.setProps({ text: 'line1\nline2' })
    await flushPromises()
    expect(el.scrollTop).toBe(1000)
  })

  it('不在底部时,text 变化不强制滚动(不打断用户正上翻查看历史日志)', async () => {
    const w = mount(LogConsole, { props: { text: 'line1' } })
    const el = w.find('pre').element as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    el.scrollTop = 100 // 1000 - 100 - 200 = 700,远超 40 阈值 → 不贴底

    await w.setProps({ text: 'line1\nline2' })
    await flushPromises()
    expect(el.scrollTop).toBe(100) // 未被脚本强制改动
  })

  it('默认插槽内容也会渲染(供调用方放置浮层内的额外元素,如错误提示)', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      slots: { default: '<span data-test="extra">err</span>' },
    })
    expect(w.find('[data-test="extra"]').exists()).toBe(true)
  })
})
