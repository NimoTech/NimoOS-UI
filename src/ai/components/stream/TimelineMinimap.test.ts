import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import TimelineMinimap from './TimelineMinimap.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('TimelineMinimap', () => {
  const messages = [
    { id: 'm1', role: 'user', content: '第一个问题' },
    { id: 'm2', role: 'assistant', blocks: [{ type: 'md', text: '第一个回答' }] },
    { id: 'm3', role: 'user', content: '第二个问题' },
    { id: 'm4', role: 'assistant', blocks: [{ type: 'md', text: '第二个回答' }] },
  ]

  it('每条消息渲染一个 tick,data-role 与消息角色对应', () => {
    const w = mount(TimelineMinimap, {
      props: { messages, active: 0 },
      global: { plugins: [i18n] },
    })
    const ticks = w.findAll('.tl-tick')
    expect(ticks.length).toBe(4)
    expect(ticks[0].attributes('data-role')).toBe('user')
    expect(ticks[1].attributes('data-role')).toBe('ai')
    expect(ticks[2].attributes('data-role')).toBe('user')
    expect(ticks[3].attributes('data-role')).toBe('ai')
  })

  it('点击某个 tick 触发 jump 事件并带上对应下标', async () => {
    const w = mount(TimelineMinimap, {
      props: { messages, active: 0 },
      global: { plugins: [i18n] },
    })
    const ticks = w.findAll('.tl-tick')
    await ticks[2].trigger('click')
    expect(w.emitted('jump')).toBeTruthy()
    expect(w.emitted('jump')?.[0]).toEqual([2])
  })

  it('active 下标对应的 tick 打上 data-active=true', () => {
    const w = mount(TimelineMinimap, {
      props: { messages, active: 1 },
      global: { plugins: [i18n] },
    })
    const ticks = w.findAll('.tl-tick')
    expect(ticks[1].attributes('data-active')).toBe('true')
    expect(ticks[0].attributes('data-active')).toBe('false')
  })
})
