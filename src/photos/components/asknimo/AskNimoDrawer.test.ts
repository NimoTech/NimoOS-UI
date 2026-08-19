import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useAskNimo } from '../../composables/useAskNimo'
import AskNimoDrawer from './AskNimoDrawer.vue'
import askNimoDrawerRaw from './AskNimoDrawer.vue?raw'

describe('AskNimoDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    // Re-check F-13: this file's own beforeEach -- openDrawer() below calls
    // ensureNimoAgentInit() every test (the "clear button" test below re-assigns its own
    // vi.fn()s afterwards for its specific assertions, which simply overrides these defaults).
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()
  })

  it('renders nothing when drawerOpen is false', () => {
    const wrapper = mount(AskNimoDrawer)
    expect(wrapper.find('.chat-drawer').exists()).toBe(false)
  })

  it('shows the "Nimo Agent" title when open', () => {
    useAskNimo().openDrawer()
    const wrapper = mount(AskNimoDrawer)
    expect(wrapper.find('.cd-title').text()).toBe('Nimo 助手')
  })

  it('close button calls closeDrawer()', async () => {
    useAskNimo().openDrawer()
    const wrapper = mount(AskNimoDrawer)
    await wrapper.find('[data-test="drawer-close"]').trigger('click')
    expect(useAskNimo().drawerOpen.value).toBe(false)
  })

  it('clear button resets the session (stop + delete + recreate)', async () => {
    useAskNimo().openDrawer()
    const agent = useAgentStore('photos')
    agent.activeSessionId = 's1'
    agent.stop = vi.fn(async () => {})
    agent.deleteSession = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's2' })
    agent.setSessionTitle = vi.fn(async () => {})
    const wrapper = mount(AskNimoDrawer)
    await wrapper.find('[data-test="drawer-clear"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    expect(agent.deleteSession).toHaveBeenCalledWith('s1')
    expect(agent.createSession).toHaveBeenCalled()
  })

  it('AskNimoChat inside is mounted fullscreen', () => {
    useAskNimo().openDrawer()
    const wrapper = mount(AskNimoDrawer)
    expect(wrapper.find('.nimo-chat.is-fullscreen').exists()).toBe(true)
  })

  // Review fix (Important): Vue2 PhotosNimoChatDrawer.vue:2-3,27 wraps the aside in
  // `<transition name="chat-drawer">` so it slides in/out instead of popping. jsdom has no real
  // animation clock and @vue/test-utils doesn't cleanly type-match Vue's built-in <transition>,
  // so a raw-source check for the wrapper + its name is the same lightweight pattern
  // AskNimoFab.test.ts already uses for its own `<transition name="nimo-fab-swap">`.
  it('wraps the aside in a <transition name="chat-drawer">', () => {
    expect(askNimoDrawerRaw).toMatch(/<transition\s+name="chat-drawer">/)
  })
})
