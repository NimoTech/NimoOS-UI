import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'

vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return {
    ...mod,
    service: { ai: { attachmentRawUrl: vi.fn((sid: string, id: string) => `/v1/ai/attachments/${sid}/${id}/raw?token=t`) } },
  }
})
import { service } from '@nimotech/nimoos-service'
import { useAgentStore } from '../../stores/agentStore'
import UserMessage from './UserMessage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('UserMessage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('纯文本消息(content 字符串,超过 continue-chip 长度阈值)渲染气泡文本', () => {
    const w = mount(UserMessage, {
      props: { msg: { content: '帮我看看这个文件夹里都有什么内容，顺便整理一下' } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.msg-bubble').text()).toBe('帮我看看这个文件夹里都有什么内容，顺便整理一下')
    expect(w.find('.cont-chip').exists()).toBe(false)
  })

  it('短文本且无附件时渲染为 continue chip', () => {
    const w = mount(UserMessage, {
      props: { msg: { content: '继续' } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.cont-chip').exists()).toBe(true)
    expect(w.find('.msg-bubble').exists()).toBe(false)
  })

  it('blocks 形态(hydrated history)text 拼接渲染', () => {
    const w = mount(UserMessage, {
      props: { msg: { blocks: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.msg-bubble').text()).toBe('a\nb')
  })

  it('optimistic attachments 通过 service.ai.attachmentRawUrl 重建 URL(依赖 store.activeSessionId)', () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    const w = mount(UserMessage, {
      props: {
        msg: {
          content: '',
          attachments: [{ id: 'att-1', filename: 'cat.png', kind: 'image' }],
        },
      },
      global: { plugins: [i18n] },
    })
    expect(service.ai.attachmentRawUrl).toHaveBeenCalledWith('sess-1', 'att-1')
    const img = w.find('.msg-image-link img')
    expect(img.attributes('src')).toBe('/v1/ai/attachments/sess-1/att-1/raw?token=t')
  })

  it('hydrated blocks 里的 image/attachment 类型分别落到图片区/文件 chip 区', () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-2'
    const w = mount(UserMessage, {
      props: {
        msg: {
          blocks: [
            { type: 'image', attachment_id: 'img-1', filename: 'a.png' },
            { type: 'attachment', attachment_id: 'doc-1', filename: 'report.pdf', kind: 'binary' },
          ],
        },
      },
      global: { plugins: [i18n] },
    })
    expect(w.findAll('.msg-image-link').length).toBe(1)
    expect(w.findAll('.msg-file-chip').length).toBe(1)
    expect(w.find('.msg-file-chip').attributes('href')).toBe('/v1/ai/attachments/sess-2/doc-1/raw?token=t')
  })
})
