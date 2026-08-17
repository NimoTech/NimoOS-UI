import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import AskNimoConfirm from './AskNimoConfirm.vue'

describe('AskNimoConfirm', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders a confirm block with action + command', () => {
    const wrapper = mount(AskNimoConfirm, {
      props: { block: { type: 'confirm', confirmId: 'c1', action: 'delete 3 photos', command: 'rm a b c' } },
    })
    expect(wrapper.find('.pac-desc').text()).toContain('delete 3 photos')
    expect(wrapper.find('.pac-code').text()).toBe('rm a b c')
    expect(wrapper.find('.pac-btn-allow').exists()).toBe(true)
    expect(wrapper.find('.pac-btn-deny').exists()).toBe(true)
  })

  it('renders an access_request block with reason + path', () => {
    const wrapper = mount(AskNimoConfirm, {
      props: { block: { type: 'access_request', confirmId: 'c2', reason: 'read album', path: '/data/x' } },
    })
    expect(wrapper.find('.pac-desc').text()).toContain('read album')
    expect(wrapper.find('.pac-code').text()).toBe('/data/x')
  })

  it('a block already decided renders pre-resolved (no Allow/Deny buttons)', () => {
    const wrapper = mount(AskNimoConfirm, {
      props: { block: { type: 'confirm', confirmId: 'c3', action: 'x', decided: true, granted: true } },
    })
    expect(wrapper.find('.pac-btns').exists()).toBe(false)
    expect(wrapper.find('.pac-result-allow').exists()).toBe(true)
  })

  it('clicking Allow calls confirmAgentAction(confirmId, true) and flips to resolved', async () => {
    const agent = useAgentStore('photos')
    agent.confirmAgentAction = vi.fn(async () => {})
    const wrapper = mount(AskNimoConfirm, {
      props: { block: { type: 'confirm', confirmId: 'c4', action: 'x' } },
    })
    await wrapper.find('.pac-btn-allow').trigger('click')
    await Promise.resolve()
    expect(agent.confirmAgentAction).toHaveBeenCalledWith('c4', true, false)
    expect(wrapper.find('.pac-result-allow').exists()).toBe(true)
  })

  it('clicking Deny calls confirmAgentAction(confirmId, false) and flips to denied', async () => {
    const agent = useAgentStore('photos')
    agent.confirmAgentAction = vi.fn(async () => {})
    const wrapper = mount(AskNimoConfirm, {
      props: { block: { type: 'access_request', confirmId: 'c5', reason: 'x' } },
    })
    await wrapper.find('.pac-btn-deny').trigger('click')
    await Promise.resolve()
    expect(agent.confirmAgentAction).toHaveBeenCalledWith('c5', false, false)
    expect(wrapper.find('.pac-result-deny').exists()).toBe(true)
  })

  it('missing confirmId shows an inline error instead of calling the store', async () => {
    const agent = useAgentStore('photos')
    agent.confirmAgentAction = vi.fn(async () => {})
    const wrapper = mount(AskNimoConfirm, { props: { block: { type: 'confirm', action: 'x' } } })
    await wrapper.find('.pac-btn-allow').trigger('click')
    expect(agent.confirmAgentAction).not.toHaveBeenCalled()
    expect(wrapper.find('.pac-err').text()).toBe('确认请求无效（缺少 confirmId）')
  })

  it('a rejected confirmAgentAction call surfaces detail via the Submission failed message', async () => {
    const agent = useAgentStore('photos')
    agent.confirmAgentAction = vi.fn(async () => {
      throw { response: { data: { detail: 'session gone' } } }
    })
    const wrapper = mount(AskNimoConfirm, { props: { block: { type: 'confirm', confirmId: 'c6', action: 'x' } } })
    await wrapper.find('.pac-btn-allow').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    expect(wrapper.find('.pac-err').text()).toBe('提交失败：session gone')
  })
})
