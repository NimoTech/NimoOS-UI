import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpPermissionCard from './McpPermissionCard.vue'

const confirmAgentAction = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ confirmAgentAction }),
}))

const mountCard = () => mount(McpPermissionCard, {
  props: { confirmId: 'c1', server: 'brave', tool: 'search', rememberScope: 'tool' },
})

describe('McpPermissionCard', () => {
  beforeEach(() => { confirmAgentAction.mockClear(); confirmAgentAction.mockResolvedValue(undefined) })

  it('allow once -> confirmed=true, remember=false', async () => {
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(confirmAgentAction).toHaveBeenCalledWith('c1', true, false)
  })

  it('the resolved state no longer offers a "Change" action (it would only send the user into another 409)', async () => {
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.find('.undo').exists()).toBe(false)
  })

  it('a 409 collapses the whole card to a single line, with no buttons left', async () => {
    confirmAgentAction.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('confirmation expired')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('a 500 leaves the buttons in place, so the user can retry', async () => {
    confirmAgentAction.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
    const w = mountCard()
    await w.find('.mcc-allow-once').trigger('click')
    await flushPromises()
    expect(w.find('.mcc-allow-once').exists()).toBe(true)
  })
})
