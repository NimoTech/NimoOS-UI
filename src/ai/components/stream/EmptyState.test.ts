import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import { useAgentStore } from '../../stores/agentStore'
import { useToast } from '../../../stores/toast'
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

  it('点击一张卡:store.pendingPrompt 被写入卡片 prompt 且弹出 aiComingSoon toast', async () => {
    const w = mount(EmptyState, { global: { plugins: [i18n] } })
    const store = useAgentStore()
    const toast = useToast()
    expect(toast.toasts.length).toBe(0)
    await w.findAll('.suggest-card')[0].trigger('click')
    expect(store.pendingPrompt).toBeTruthy()
    expect(typeof store.pendingPrompt).toBe('string')
    expect(toast.toasts.length).toBe(1)
  })
})
