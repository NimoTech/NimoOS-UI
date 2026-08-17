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

  // Review fix (IMPORTANT #2): the streaming cursor must key off the md BLOCK's own `streaming`
  // flag (dispatchEvent.ts's message_delta/endMessageStreaming), not the message's -- a message
  // can hold a finished md block while the message object itself is still marked streaming.
  it('renders the streaming cursor only when the md block itself is streaming, not the message', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1b', role: 'assistant', streaming: true, blocks: [{ type: 'md', text: 'done', streaming: false }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.msg-cursor').exists()).toBe(false)
  })

  it('renders the streaming cursor when the md block itself carries streaming:true', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1c', role: 'assistant', blocks: [{ type: 'md', text: 'typing', streaming: true }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.msg-cursor').exists()).toBe(true)
  })

  // Review fix (IMPORTANT #1, Vue2 wins PhotosAgentChat.vue:27,32): terminal blocks always show
  // the literal label 'terminal', never `block.name` -- New-UI terminal blocks don't carry `name`
  // at all (they use `command`, which is not a label).
  it('terminal blocks always show the literal label "terminal", never block.name', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1d', role: 'assistant', blocks: [{ type: 'terminal', state: 'running', command: 'ls -la', name: 'should-not-show' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-tool-line').text()).toContain('terminal')
    expect(wrapper.find('.nimo-tool-line').text()).not.toContain('should-not-show')
  })

  it('tool blocks (non-terminal) still show block.name', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1e', role: 'assistant', blocks: [{ type: 'tool', state: 'running', name: 'search_photos' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-tool-line').text()).toContain('search_photos')
  })

  // Review fix (IMPORTANT #1, Vue2 wins PhotosAgentChat.vue:26-29): the error text's code half
  // comes solely from `sections[0].code` -- no `command` fallback -- and truncate() renders
  // absent input as ''.
  it('a terminal error block with no sections renders an empty code half after the separator', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1f', role: 'assistant', blocks: [{ type: 'terminal', state: 'error', command: 'ls -la' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-tool-err').text()).toBe('terminal ·')
  })

  // Review fix (MINOR #4): a photo_grid block persisted without a `photos` field must render an
  // empty grid, not throw on `.slice`/`.length`.
  it('a photo_grid block missing the photos field renders an empty grid without throwing', () => {
    const agent = useAgentStore('photos')
    agent.messages = [{ id: 'a1g', role: 'assistant', blocks: [{ type: 'photo_grid', query: 'x' }] }] as any
    const wrapper = mount(AskNimoChat, { props: {} })
    expect(wrapper.find('.nimo-photo-grid-label').text()).toBe('x')
    expect(wrapper.findAll('.nimo-photo-tile')).toHaveLength(0)
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
    // Review fix (MINOR #6, Vue2 wins): the img alt is the tile's own name, not empty.
    expect(wrapper.findAll('.nimo-photo-tile')[0].find('img').attributes('alt')).toBe('p0')
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

  // Review fix (IMPORTANT #3, Vue2 wins PhotosAgentChat.vue:207): Enter while busy (streaming)
  // must not wipe the textarea or consume the context chip -- send() itself would no-op on busy,
  // but without this guard the UI-side wipe already happened by the time send() checks.
  it('Enter while busy (streaming) does not send, and does not wipe the text or the context chip', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.busy = true
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: 1, name: 'a.jpg', takenAt: null, place: null } } })
    const textarea = wrapper.find('.nimo-chat-textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(agent.send).not.toHaveBeenCalled()
    expect((textarea.element as HTMLTextAreaElement).value).toBe('hi')
    expect(wrapper.emitted('context-consumed')).toBeFalsy()
  })

  // Review fix (MINOR #6): the original test only exercised the "no model selected" branch even
  // though its name claimed both. This now exercises empty-text-with-a-model and
  // model-cleared-with-text as two independent disabling reasons.
  it('send button disabled when text is empty, or when no model is selected', async () => {
    const agent = useAgentStore('photos')
    const wrapper = mount(AskNimoChat, { props: {} })
    // No model selected (store default) and text empty -- disabled.
    expect(wrapper.find('.nimo-chat-btn-send').attributes('disabled')).toBeDefined()

    agent.selectedModel = 'local:llama3'
    await wrapper.vm.$nextTick()
    // Model selected but text still empty -- still disabled.
    expect(wrapper.find('.nimo-chat-btn-send').attributes('disabled')).toBeDefined()

    await wrapper.find('.nimo-chat-textarea').setValue('hi')
    // Both conditions satisfied -- enabled.
    expect(wrapper.find('.nimo-chat-btn-send').attributes('disabled')).toBeUndefined()

    agent.selectedModel = null
    await wrapper.vm.$nextTick()
    // Text present but model cleared -- disabled again.
    expect(wrapper.find('.nimo-chat-btn-send').attributes('disabled')).toBeDefined()
  })

  it('onSend builds contextPhoto from a valid-id prop and consumes the chip', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: 1, name: 'a.jpg', takenAt: 't', place: 'p' } } })
    await wrapper.find('.nimo-chat-textarea').setValue('about this')
    await wrapper.find('.nimo-chat-btn-send').trigger('click')
    expect(agent.send).toHaveBeenCalledWith({ text: 'about this', contextPhoto: { id: '1', name: 'a.jpg', takenAt: 't', place: 'p' }, contextAlbum: null })
    expect(wrapper.emitted('context-consumed')).toBeTruthy()
  })

  // Review fix (MINOR #6, Vue2 wins :217-218): missing takenAt/place normalize to '', not null.
  it('onSend normalizes missing takenAt/place to empty strings', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: 2, name: 'b.jpg', takenAt: null, place: null } } })
    await wrapper.find('.nimo-chat-textarea').setValue('about this')
    await wrapper.find('.nimo-chat-btn-send').trigger('click')
    expect(agent.send).toHaveBeenCalledWith({ text: 'about this', contextPhoto: { id: '2', name: 'b.jpg', takenAt: '', place: '' }, contextAlbum: null })
  })

  // Review fix (MINOR #6, Vue2 wins :214/:220): guards contextPhoto.id != null -- an id-less
  // photo builds to a null contextPhoto and must NOT emit context-consumed (the chip stays).
  it('onSend guards contextPhoto.id != null: an id-less photo sends null contextPhoto and keeps the chip', async () => {
    const agent = useAgentStore('photos')
    agent.selectedModel = 'local:llama3'
    agent.send = vi.fn(async () => {})
    const wrapper = mount(AskNimoChat, { props: { contextPhoto: { id: null as any, name: 'a.jpg', takenAt: null, place: null } } })
    await wrapper.find('.nimo-chat-textarea').setValue('about this')
    await wrapper.find('.nimo-chat-btn-send').trigger('click')
    expect(agent.send).toHaveBeenCalledWith({ text: 'about this', contextPhoto: null, contextAlbum: null })
    expect(wrapper.emitted('context-consumed')).toBeFalsy()
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
