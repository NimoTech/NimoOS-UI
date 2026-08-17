import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import { useAskNimo } from '../../composables/useAskNimo'
import AskNimoPopup from './AskNimoPopup.vue'

describe('AskNimoPopup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    // Re-check F-13: this file's own beforeEach, not "covered indirectly" by another file's --
    // useAskNimo().openWith('hi') below calls ensureNimoAgentInit() every single test.
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    useAskNimo().__resetForTests()
  })

  it('renders nothing when popupOpen is false', () => {
    const wrapper = mount(AskNimoPopup)
    expect(wrapper.find('.nimo-pop').exists()).toBe(false)
  })

  it('renders the shell with title "Nimo" (literal, not translated) when open', async () => {
    useAskNimo().openWith('hi')
    const wrapper = mount(AskNimoPopup)
    expect(wrapper.find('.nimo-pop-title').text()).toBe('Nimo')
  })

  it('close button calls closePopup()', async () => {
    useAskNimo().openWith('hi')
    const wrapper = mount(AskNimoPopup)
    await wrapper.find('[data-test="pop-close"]').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(false)
  })

  it('expand button calls expand() (popup closes, drawer opens)', async () => {
    useAskNimo().openWith('hi')
    const wrapper = mount(AskNimoPopup)
    await wrapper.find('[data-test="pop-expand"]').trigger('click')
    expect(useAskNimo().popupOpen.value).toBe(false)
    expect(useAskNimo().drawerOpen.value).toBe(true)
  })

  it('composes NimoModelPicker + NimoTaskBar + AskNimoChat', () => {
    useAskNimo().openWith('hi')
    const wrapper = mount(AskNimoPopup)
    expect(wrapper.find('.nimo-mp').exists()).toBe(true)
    expect(wrapper.find('.nimo-chat').exists()).toBe(true)
  })
})
