import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../../ai/stores/agentStore'
import NimoModelPicker from './NimoModelPicker.vue'

describe('NimoModelPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Preflight F-13: onMounted() calls loadAvailableModels() unconditionally -- stub it by
    // default so mounting doesn't fire a real network request in every test below.
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
  })

  it('shows the "Select model" fallback label when nothing is selected', () => {
    const wrapper = mount(NimoModelPicker)
    expect(wrapper.find('.nimo-mp-trigger').text()).toContain('选择模型')
  })

  it('shows "{name} · {providerName}" when a model is selected', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    agent.selectedModel = 'local:llama3'
    const wrapper = mount(NimoModelPicker)
    expect(wrapper.find('.nimo-mp-trigger').text()).toContain('llama3')
  })

  // Preflight F-04: no more Teleport -- the list renders as a plain sibling of the trigger,
  // inside the SAME component subtree, positioned via useFixedMenuPosition's inline `menuStyle`.
  it('opening the list renders .nimo-mp-list in-place (no Teleport), positioned via fixed + inline style', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    const list = wrapper.find('.nimo-mp-list')
    expect(list.exists()).toBe(true)
    expect(list.attributes('style')).toContain('position: fixed')
    wrapper.unmount()
  })

  it('groups cloud models by provider_type with the correct display label', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'cloud:p1:deepseek-v3', source: 'cloud', displayName: 'deepseek-v3', providerName: 'DeepSeek', providerId: 'p1', provider_type: 'deepseek' },
    ] as any
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    expect(wrapper.find('.nimo-mp-group-label').text()).toBe('云 · DeepSeek')
    wrapper.unmount()
  })

  it('an empty model list shows the "Go to Settings" link instead of groups', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = []
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    expect(wrapper.find('.nimo-mp-config').text()).toContain('去 Settings 配置')
    wrapper.unmount()
  })

  it('clicking a model calls selectModel(key) and closes the list', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    agent.selectModel = vi.fn()
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    await wrapper.find('.nimo-mp-item').trigger('click')
    expect(agent.selectModel).toHaveBeenCalledWith('local:llama3')
    wrapper.unmount()
  })

  it('calls loadAvailableModels() on mount', () => {
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    mount(NimoModelPicker)
    expect(agent.loadAvailableModels).toHaveBeenCalledTimes(1)
  })

  // Re-check N-1: verbatim port of Vue2 NimoModelPicker.vue:114-123's document-level mousedown
  // outside-click listener.
  it('a mousedown outside the component closes the open list', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    expect(wrapper.find('.nimo-mp-list').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.nimo-mp-list').exists()).toBe(false)
    wrapper.unmount()
  })

  it('a mousedown inside the list itself does not close it', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    await wrapper.find('.nimo-mp-list').trigger('mousedown')
    expect(wrapper.find('.nimo-mp-list').exists()).toBe(true)
    wrapper.unmount()
  })

  // Re-check N-1: Escape is a New-UI-only addition (Vue2's own file has no Escape handling at
  // all, verified) -- follows this repo's own PlacesFilterMenu.vue precedent for fixed menus.
  it('pressing Escape closes the open list', async () => {
    const agent = useAgentStore('photos')
    agent.availableModels = [
      { key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' },
    ] as any
    const wrapper = mount(NimoModelPicker, { attachTo: document.body })
    await wrapper.find('.nimo-mp-trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.nimo-mp-list').exists()).toBe(false)
    wrapper.unmount()
  })
})
