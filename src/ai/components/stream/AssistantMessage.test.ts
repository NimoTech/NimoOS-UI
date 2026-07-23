import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import { useToast } from '../../../stores/toast'

const copyText = vi.hoisted(() => vi.fn())
vi.mock('../../../files/util/clipboard', () => ({ copyText }))

import AssistantMessage from './AssistantMessage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('AssistantMessage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    copyText.mockReset()
  })

  it('复制失败(copyText reject)时不抛错、不弹 aiCopied toast(降级=静默,与 Vue2 行为一致)', async () => {
    copyText.mockRejectedValue(new Error('insecure context'))
    const msg = { id: 'm1', blocks: [{ type: 'md', text: 'hello' }], streaming: false }
    const w = mount(AssistantMessage, { props: { msg }, global: { plugins: [i18n] } })
    const toast = useToast()

    await expect(w.find('.icon-btn').trigger('click')).resolves.not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    expect(copyText).toHaveBeenCalledWith('hello')
    expect(toast.toasts.some((t) => t.text === '已复制')).toBe(false)
  })
})
