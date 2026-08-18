import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AiWidget from './AiWidget.vue'
import type { LayoutItem } from '../../grid/types'

// P6-T5(SP8 cutover): sendToAI defaults to in-app router.push, needs to mock router
// singleton (same vi.mock as useOpenAction.test.ts, hoisted before import).
vi.mock('../../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../../router'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'ai', c: 1, r: 1, w, h })
describe('AiWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('strangler:disabled:/ai')
    vi.mocked(router.push).mockClear()
  })
  it('submitting the input navigates to the agent with the message (in-app, SP8-P6 cutover)', async () => {
    const w = mount(AiWidget, { props: { item: item(4, 4) } })
    await w.get('.ai-input').setValue('整理照片')
    await w.get('.ai-send').trigger('submit')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '整理照片' } })
  })
  it('flag set to 1 falls back to Vue2 old Agent (/#/ai/agent string concatenation)', async () => {
    localStorage.setItem('strangler:disabled:/ai', '1')
    const hrefs: string[] = []
    const orig = window.location
    // Use writable stub to capture location.href assignment
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
