import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useAskNimo } from '../../composables/useAskNimo'
import AskNimoHost from './AskNimoHost.vue'

describe('AskNimoHost', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    // Preflight F-13: openWith()/openDrawer() below call ensureNimoAgentInit() internally.
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()
    document.body.innerHTML = ''
  })

  it('teleports a .photos-root wrapper carrying the FAB into document.body', () => {
    const wrapper = mount(AskNimoHost, { attachTo: document.body })
    const host = document.body.querySelector('.ask-nimo-host.photos-root')
    expect(host).not.toBeNull()
    expect(host?.querySelector('.nimo-fab')).not.toBeNull()
    wrapper.unmount()
  })

  it('renders the popup inside the same teleported subtree when open', () => {
    useAskNimo().openWith('hi')
    const wrapper = mount(AskNimoHost, { attachTo: document.body })
    const host = document.body.querySelector('.ask-nimo-host.photos-root')
    expect(host?.querySelector('.nimo-pop')).not.toBeNull()
    wrapper.unmount()
  })

  // Preflight F-26: the test above's original name promised "popup AND drawer" but only ever
  // opened the popup -- split into its own case that genuinely opens the drawer.
  it('renders the drawer inside the same teleported subtree when open', () => {
    useAskNimo().openDrawer()
    const wrapper = mount(AskNimoHost, { attachTo: document.body })
    const host = document.body.querySelector('.ask-nimo-host.photos-root')
    expect(host?.querySelector('.chat-drawer')).not.toBeNull()
    wrapper.unmount()
  })
})
