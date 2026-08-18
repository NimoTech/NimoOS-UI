import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LogConsole from './LogConsole.vue'

describe('LogConsole', () => {
  it('displays emptyText when text is empty', () => {
    const w = mount(LogConsole, { props: { text: '', emptyText: '暂无日志' } })
    expect(w.find('pre').text()).toBe('暂无日志')
  })

  it('does not fall back to emptyText when text is not empty', () => {
    const w = mount(LogConsole, { props: { text: 'line1\nline2', emptyText: '暂无日志' } })
    expect(w.find('pre').text()).toBe('line1\nline2')
  })

  it('renders tools named slot content', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      slots: { tools: '<button data-test="my-tool">工具</button>' },
    })
    expect(w.find('[data-test="my-tool"]').exists()).toBe(true)
  })

  it('passes $attrs through to <pre> (inheritAttrs:false + v-bind="$attrs")', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      attrs: { 'data-test': 'logs-pre', class: 'caller-class' },
    })
    const pre = w.find('pre')
    expect(pre.attributes('data-test')).toBe('logs-pre')
    // classes should merge (the caller's class + the component's own log-console-pre), not overwrite each other
    expect(pre.classes()).toContain('caller-class')
    expect(pre.classes()).toContain('log-console-pre')
    // and it must not fall through to the root div (direct evidence inheritAttrs:false is in effect)
    expect(w.find('.log-console').attributes('data-test')).toBeUndefined()
  })

  it('automatically scrolls to bottom after text changes when at bottom (scrollTop+clientHeight close to scrollHeight)', async () => {
    const w = mount(LogConsole, { props: { text: 'line1' } })
    const el = w.find('pre').element as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    el.scrollTop = 805 // 1000 - 805 - 200 = -5 < 40 threshold → counts as at-bottom

    await w.setProps({ text: 'line1\nline2' })
    await flushPromises()
    expect(el.scrollTop).toBe(1000)
  })

  it('does not force scroll when not at bottom (does not interrupt user scrolling up to view historical logs)', async () => {
    const w = mount(LogConsole, { props: { text: 'line1' } })
    const el = w.find('pre').element as HTMLElement
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    el.scrollTop = 100 // 1000 - 100 - 200 = 700, far above the 40 threshold → not at bottom

    await w.setProps({ text: 'line1\nline2' })
    await flushPromises()
    expect(el.scrollTop).toBe(100) // not forcibly changed by script
  })

  it('also renders default slot content (for the caller to place additional elements inside the overlay, such as error prompts)', () => {
    const w = mount(LogConsole, {
      props: { text: 'x' },
      slots: { default: '<span data-test="extra">err</span>' },
    })
    expect(w.find('[data-test="extra"]').exists()).toBe(true)
  })
})
