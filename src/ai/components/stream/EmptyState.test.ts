import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import { useAgentStore } from '../../stores/agentStore'
import EmptyState from './EmptyState.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('EmptyState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders four suggestion cards', () => {
    const w = mount(EmptyState, { global: { plugins: [i18n] } })
    expect(w.findAll('.suggest-card').length).toBe(4)
  })

  it('clicking a card: calls store.send(prompt) (useProvidedAgentStore falls back to default store when no ancestor provides)', async () => {
    const store = useAgentStore()
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    const w = mount(EmptyState, { global: { plugins: [i18n] } })
    await w.findAll('.suggest-card')[0].trigger('click')
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const arg = sendSpy.mock.calls[0][0]
    expect(typeof arg).toBe('string')
    expect((arg as string).length).toBeGreaterThan(0)
  })
})
