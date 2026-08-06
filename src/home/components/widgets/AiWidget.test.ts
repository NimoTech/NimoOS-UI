import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AiWidget from './AiWidget.vue'
import type { LayoutItem } from '../../grid/types'

// P6-T5(SP8 cutover):sendToAI 默认走应用内 router.push,需 mock 路由单例
// (与 useOpenAction.test.ts 同款 vi.mock,会被提升到 import 前)。
vi.mock('../../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../../router'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'ai', c: 1, r: 1, w, h })
describe('AiWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('strangler:disabled:/ai')
    vi.mocked(router.push).mockClear()
  })
  it('submitting the input navigates to the agent with the message (应用内,SP8-P6 cutover)', async () => {
    const w = mount(AiWidget, { props: { item: item(4, 4) } })
    await w.get('.ai-input').setValue('整理照片')
    await w.get('.ai-send').trigger('submit')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '整理照片' } })
  })
  it('flag 置 1 时退回 Vue2 老 Agent(/#/ai/agent 拼串)', async () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const hrefs: string[] = []
    const orig = window.location
    // 用可写 stub 捕获 location.href 赋值
    Object.defineProperty(window, 'location', { configurable: true, value: { set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(AiWidget, { props: { item: item(4, 4) } })
    await w.get('.ai-input').setValue('整理照片')
    await w.get('.ai-send').trigger('submit')
    expect(hrefs[0]).toBe('/#/ai/agent?message=' + encodeURIComponent('整理照片'))
    expect(router.push).not.toHaveBeenCalled()
    Object.defineProperty(window, 'location', { configurable: true, value: orig })
    localStorage.removeItem('strangler:disabled:/ai')
  })
})
