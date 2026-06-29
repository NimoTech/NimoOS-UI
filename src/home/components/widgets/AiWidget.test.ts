import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AiWidget from './AiWidget.vue'
import type { LayoutItem } from '../../grid/types'
const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'ai', c: 1, r: 1, w, h })
describe('AiWidget', () => {
  it('submitting the input navigates to the agent with the message', async () => {
    const hrefs: string[] = []
    const orig = window.location
    // 用可写 stub 捕获 location.href 赋值
    Object.defineProperty(window, 'location', { configurable: true, value: { set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(AiWidget, { props: { item: item(4, 4) } })
    await w.get('.ai-input').setValue('整理照片')
    await w.get('.ai-send').trigger('submit')
    expect(hrefs[0]).toBe('/#/ai/agent?message=' + encodeURIComponent('整理照片'))
    Object.defineProperty(window, 'location', { configurable: true, value: orig })
  })
})
