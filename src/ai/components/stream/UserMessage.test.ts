import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
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
import { provideAgentStore } from '../../composables/useProvidedAgentStore'
import UserMessage from './UserMessage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('UserMessage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('plain text message (content string, exceeds continue-chip length threshold) renders bubble text', () => {
    const w = mount(UserMessage, {
      props: { msg: { content: '帮我看看这个文件夹里都有什么内容，顺便整理一下' } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.msg-bubble').text()).toBe('帮我看看这个文件夹里都有什么内容，顺便整理一下')
    expect(w.find('.cont-chip').exists()).toBe(false)
  })

  it('short text with no attachments renders as continue chip', () => {
    const w = mount(UserMessage, {
      props: { msg: { content: '继续' } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.cont-chip').exists()).toBe(true)
    expect(w.find('.msg-bubble').exists()).toBe(false)
  })

  it('blocks shape (hydrated history) text concatenated rendering', () => {
    const w = mount(UserMessage, {
      props: { msg: { blocks: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } },
      global: { plugins: [i18n] },
    })
    expect(w.find('.msg-bubble').text()).toBe('a\nb')
  })

  it('optimistic attachments reconstruct URL via service.ai.attachmentRawUrl (depends on store.activeSessionId)', () => {
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

  it('image/attachment types in hydrated blocks fall into image region/file chip region respectively', () => {
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

  it('debt③ — when ancestor provided restricted profile store (e.g. photos), resolves ancestor session id, not hardcoded default general store', () => {
    const generalStore = useAgentStore()
    generalStore.activeSessionId = 'general-sess'
    const photosStore = useAgentStore('photos')
    photosStore.activeSessionId = 'photos-sess'

    const Wrapper = defineComponent({
      setup() {
        provideAgentStore(photosStore)
        return () => h(UserMessage, {
          msg: { content: '', attachments: [{ id: 'att-1', filename: 'cat.png', kind: 'image' }] },
        })
      },
    })

    const w = mount(Wrapper, { global: { plugins: [i18n] } })
    expect(service.ai.attachmentRawUrl).toHaveBeenCalledWith('photos-sess', 'att-1')
    expect(w.find('.msg-image-link img').attributes('src')).toBe('/v1/ai/attachments/photos-sess/att-1/raw?token=t')
  })
})
