import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AiWidget from './AiWidget.vue'
import type { LayoutItem } from '../../grid/types'

// sendToAI defaults to in-app router.push, needs to mock router
// singleton (same vi.mock as useOpenAction.test.ts, hoisted before import).
vi.mock('../../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../../router'

const item = (w: number, h: number): LayoutItem => ({ id: 'i', kind: 'widget', key: 'ai', c: 1, r: 1, w, h })
describe('AiWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(router.push).mockClear()
  })
  it('submitting the input navigates to the agent with the message (in-app)', async () => {
    const w = mount(AiWidget, { props: { item: item(4, 4) } })
    await w.get('.ai-input').setValue('整理照片')
    await w.get('.ai-send').trigger('submit')
    expect(router.push).toHaveBeenCalledWith({ path: '/ai/agent', query: { message: '整理照片' } })
  })
})
