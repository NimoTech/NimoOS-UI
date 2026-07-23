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

  it('渲染四张建议卡', () => {
    const w = mount(EmptyState, { global: { plugins: [i18n] } })
    expect(w.findAll('.suggest-card').length).toBe(4)
  })

  it('点击一张卡:调用 store.send(prompt)(useProvidedAgentStore 无祖先 provide 时回退到默认 store)', async () => {
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
