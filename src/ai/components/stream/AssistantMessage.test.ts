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

  it('连续的 thinking+tool block 经 groupBlocks 合并渲染成一个 ProcessStrip,后续 md block 走 BlockRenderer', () => {
    const msg = {
      id: 'm2',
      blocks: [
        { type: 'thinking', text: '推理中…' },
        { type: 'tool', name: 'search_files', argsPreview: 'q=foo' },
        { type: 'md', text: '**结果**' },
      ],
      streaming: false,
    }
    const w = mount(AssistantMessage, { props: { msg }, global: { plugins: [i18n] } })

    expect(w.findAll('.proc').length).toBe(1)
    expect(w.find('.md').exists()).toBe(true)
    expect(w.html()).toContain('<strong>结果</strong>')
  })
})
