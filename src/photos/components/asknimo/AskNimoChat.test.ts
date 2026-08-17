import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useLightbox } from '../../lightbox/useLightbox'
import AskNimoChat from './AskNimoChat.vue'

// Deviation from brief's verbatim test listing: clicking a photo_grid tile drives
// useLightbox().openAt(), which fires usePhotosFavorites().recordView()/reconcileFavIds()
// and hydrateDetail()'s service.photos.getAsset()/getAssetOcr() -- all real calls into
// @nimotech/nimoos-service. Without a mock, the singleton is never initService()'d in this
// test file and getHttp() throws synchronously, surfacing as a Vitest "uncaught exception"
// (exit code 1) despite every assertion passing. Same shape as the mock other lightbox-
// consuming test files already use (PhotoLightbox.test.ts, PhotosSearch.lightbox.test.ts).
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      recordView: () => Promise.resolve(),
      getAsset: () => Promise.reject(new Error('no hydrate in test')),
      getAssetOcr: () => Promise.resolve({ lines: [] }),
      listFavoriteIds: () => Promise.resolve([]),
    },
  },
}))

describe('AskNimoChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useLightbox().__resetForTest()
  })

  it('renders a user message as plain text', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'u1', role: 'user', content: 'hello' }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.msg-u .msg-content').text()).toBe('hello')
  })

  it('renders an md block via renderMarkdown', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1', role: 'assistant', blocks: [{ type: 'md', text: '**hi**' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-md').html()).toContain('<strong>hi</strong>')
  })

  it('ignores unknown block types (e.g. thinking) silently', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a2', role: 'assistant', blocks: [{ type: 'thinking', text: 'x' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-md').exists()).toBe(false)
  })

  // Re-check N-4: >12 photos -- slot 12 (pi===11) becomes the +N badge, N = length - 11.
  it('renders a photo_grid block with 13 photos: 11 real tiles + a +2 badge', () => {
    const agent = useAgentStore('photos')
    const photos = Array.from({ length: 13 }, (_, i) => ({ id: i, name: `p${i}`, takenAt: null, thumbUrl: `/x/${i}` }))
    agent.messages = [{ id: 'a3', role: 'assistant', blocks: [{ type: 'photo_grid', query: 'sunset', photos }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-photo-grid-label').text()).toBe('sunset')
    expect(wrapper.findAll('.nimo-photo-tile')).toHaveLength(12) // 11 real + 1 more-badge (itself carries .nimo-photo-tile)
    expect(wrapper.find('.nimo-photo-tile-more').text()).toBe('+2')
  })

  // Re-check N-4: exactly 12 photos -- Vue2's `pi < 11 || length <= 12` renders ALL 12 as real
  // tiles, no badge at all. This is the boundary the original F-03 fix got wrong.
  it('exactly 12 photos renders all 12 as real tiles, no +N badge', () => {
    const agent = useAgentStore('photos')
    const photos = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `p${i}`, takenAt: null, thumbUrl: `/x/${i}` }))
    agent.messages = [{ id: 'a3b', role: 'assistant', blocks: [{ type: 'photo_grid', photos }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.findAll('.nimo-photo-tile')).toHaveLength(12)
    expect(wrapper.find('.nimo-photo-tile-more').exists()).toBe(false)
  })

  it('clicking a photo_grid tile opens the lightbox via useLightbox().openAt with the WHOLE grid as the paging list', async () => {
    const agent = useAgentStore('photos')
    const photos = [
      { id: 7, name: 'p7', takenAt: null, thumbUrl: '/x/7' },
      { id: 8, name: 'p8', takenAt: null, thumbUrl: '/x/8' },
    ]
    agent.messages = [{ id: 'a4', role: 'assistant', blocks: [{ type: 'photo_grid', photos } ] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    await wrapper.findAll('.nimo-photo-tile')[0].trigger('click')
    expect(useLightbox().open.value).toBe(true)
    expect(useLightbox().current.value?.id).toBe(7)
    // Re-check N-4: the paging list passed to the lightbox must be the FULL block.photos array
    // (mapped to stub Photo objects), not just the single clicked tile -- otherwise there is no
    // left/right paging inside the lightbox for this result set.
    expect(useLightbox().list.value.map((p) => p.id)).toEqual([7, 8])
  })

  it('clicking the +N badge opens photos[11] (not the badge itself) with the full list, matching Vue2', async () => {
    const agent = useAgentStore('photos')
    const photos = Array.from({ length: 13 }, (_, i) => ({ id: i, name: `p${i}`, takenAt: null, thumbUrl: `/x/${i}` }))
    agent.messages = [{ id: 'a3c', role: 'assistant', blocks: [{ type: 'photo_grid', photos }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    await wrapper.find('.nimo-photo-tile-more').trigger('click')
    expect(useLightbox().open.value).toBe(true)
    expect(useLightbox().current.value?.id).toBe(11) // photos[11] -- the 12th photo, per Vue2
    expect(useLightbox().list.value).toHaveLength(13)
  })

  it('renders a confirm block via AskNimoConfirm', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a5', role: 'assistant', blocks: [{ type: 'confirm', confirmId: 'c1', action: 'x' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.pac-wrap').exists()).toBe(true)
  })

  it('prefill prop sets the textarea then emits prefill-consumed', async () => {
    const wrapper = mount(AskNimoChat, { props: { prefill: 'hello there' } })
    await wrapper.vm.$nextTick()
    expect((wrapper.find('.nimo-chat-textarea').element as HTMLTextAreaElement).value).toBe('hello there')
    expect(wrapper.emitted('prefill-consumed')).toBeTruthy()
  })

  it('contextPhoto prop renders a dismissable chip and emits context-consumed on x', async () => {
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: 1, name: 'a.jpg', takenAt: null, place: null } } })
    expect(wrapper.find('.nimo-ctx-chip-label').text()).toContain('a.jpg')
    await wrapper.find('.nimo-ctx-chip-x').trigger('click')
    expect(wrapper.emitted('context-consumed')).toBeTruthy()
  })

  it('Enter sends, Shift+Enter inserts a newline (no send)', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: {} })
    const textarea = wrapper.find('.nimo-chat-textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(agent.send).not.toHaveBeenCalled()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(agent.send).toHaveBeenCalledTimes(1)
  })

  it('send button disabled when text empty or no model selected', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = null
    const wrapper = mount(AskNimoChat, { props: {} })
    await wrapper.find('.nimo-chat-textarea').setValue('hi')
    expect(wrapper.find('.nimo-chat-btn-send').attributes('disabled')).toBeDefined()
  })

  it('onSend guards contextPhoto.id != null before building ctx, and consumes the chip', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: 1, name: 'a.jpg', takenAt: 't', place: 'p' } } })
    await wrapper.find('.nimo-chat-textarea').setValue('about this')
    await wrapper.find('.nimo-chat-btn-send').trigger('click')
    expect(agent.send).toHaveBeenCalledWith({ text: 'about this', contextPhoto: { id: '1', name: 'a.jpg', takenAt: 't', place: 'p' }, contextAlbum: null })
    expect(wrapper.emitted('context-consumed')).toBeTruthy()
  })

  it('busy=true shows the stop button instead of send, onStop calls agent.stop()', async () => {
    const agent = useAgentStore('photos')
    agent.busy = true
    agent.stop = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-chat-btn-stop').exists()).toBe(true)
    await wrapper.find('.nimo-chat-btn-stop').trigger('click')
    expect(agent.stop).toHaveBeenCalledTimes(1)
  })

  it('clicking a suggestion button fills the textarea with the translated suggestion text', async () => {
    const wrapper = mount(AskNimoChat, { props: {} })
    await wrapper.findAll('.nimo-chat-suggest')[0].trigger('click')
    expect((wrapper.find('.nimo-chat-textarea').element as HTMLTextAreaElement).value).toBe('上周末')
  })
})
