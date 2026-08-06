import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'

vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, service: { ai: { attachmentRawUrl: vi.fn(() => '') } } }
})
import MessageList from './MessageList.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('MessageList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('按 role 分发到 UserMessage/AssistantMessage,并打上 data-block/data-role', () => {
    const messages = [
      { id: 'm1', role: 'user', content: '第一条较长一点的用户消息内容' },
      { id: 'm2', role: 'assistant', blocks: [{ type: 'md', text: '**回复**' }] },
    ]
    const w = mount(MessageList, {
      props: { messages, busy: false },
      global: { plugins: [i18n] },
    })
    const blocks = w.findAll('[data-block]')
    expect(blocks.length).toBe(2)
    expect(blocks[0].attributes('data-role')).toBe('user')
    expect(blocks[1].attributes('data-role')).toBe('ai')
    expect(w.find('.msg-bubble').text()).toBe('第一条较长一点的用户消息内容')
    expect(w.html()).toContain('<strong>回复</strong>')
  })

  it('busy 且最后一条不是 assistant 时显示 Thinking 占位', () => {
    const messages = [{ id: 'm1', role: 'user', content: '用户较长一点的问题描述文本' }]
    const w = mount(MessageList, {
      props: { messages, busy: true },
      global: { plugins: [i18n] },
    })
    expect(w.find('.thinking').exists()).toBe(true)
  })

  it('busy 但最后一条已是 assistant 时不显示 Thinking 占位', () => {
    const messages = [
      { id: 'm1', role: 'user', content: '用户较长一点的问题描述文本' },
      { id: 'm2', role: 'assistant', blocks: [] },
    ]
    const w = mount(MessageList, {
      props: { messages, busy: true },
      global: { plugins: [i18n] },
    })
    expect(w.find('.thinking').exists()).toBe(false)
  })
})
