import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AgentTopbar from './AgentTopbar.vue'

const push = vi.fn().mockResolvedValue(undefined)
const routeState = { path: '/agent' }
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, currentRoute: { value: routeState } }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: {
    zh_cn: {
      aiBack: '返回',
      aiNewConversation: '新对话',
      // All copy needed for the AI-rename button tooltip and the
      // ModelPicker (mounted for real, not stubbed).
      aiRename: 'AI 重命名',
      aiLocalOllama: '本地 Ollama',
      aiCloudModels: '云端',
      aiSearchModelsPlaceholder: '搜索模型…',
      aiModelSelect: '选择模型',
      aiModelNotSelected: '未选择',
      aiModelEmptyText: '还没有可用模型',
      aiGoToSettings: '前往设置',
    },
  },
})

describe('AgentTopbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    push.mockClear()
    routeState.path = '/agent'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('title input debounces for 500ms then flushes, emitting update-title with the trimmed value', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', storedTitle: '旧标题' },
      global: { plugins: [i18n] },
    })
    const input = w.find('.topbar-title-input')
    await input.setValue('  新标题  ') // setValue already dispatches the native `input` event
    expect(w.emitted('update-title')).toBeUndefined()

    vi.advanceTimersByTime(499)
    expect(w.emitted('update-title')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(w.emitted('update-title')?.[0]).toEqual(['新标题'])
  })

  it('blur flushes immediately without waiting for the debounce, and blurring with an empty value restores props.storedTitle', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', storedTitle: '旧标题' },
      global: { plugins: [i18n] },
    })
    const input = w.find('.topbar-title-input')
    await input.setValue('新值')
    await input.trigger('focus')
    await input.trigger('blur')
    // Non-empty blur flushes immediately, without waiting for the debounce timer.
    expect(w.emitted('update-title')?.[0]).toEqual(['新值'])

    // The parent hasn't (yet) echoed the new title back down as `storedTitle`
    // — a whitespace-only blur restores the visible value to the prop as-is,
    // it does not remember the last successfully-flushed value locally.
    await input.setValue('   ')
    await input.trigger('focus')
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('旧标题')
    // Blank input is never emitted.
    expect(w.emitted('update-title')?.length).toBe(1)
  })

  it('switching sessionId resets the local title to the new session storedTitle', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', storedTitle: '会话一标题' },
      global: { plugins: [i18n] },
    })
    await w.setProps({ sessionId: 's2', storedTitle: '会话二标题' })
    expect((w.find('.topbar-title-input').element as HTMLInputElement).value).toBe('会话二标题')
  })

  it('theme toggle button emits toggle-theme; left panel button emits toggle-left', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', theme: 'light' },
      global: { plugins: [i18n] },
    })
    const buttons = w.findAll('.icon-btn')
    await buttons[0].trigger('click') // panelLeft toggle
    expect(w.emitted('toggle-left')).toBeTruthy()
    // Icon-button order (the topbar's own back button was merged into the
    // sidebar): toggle-left, ai-rename, theme, right-panel-toggle.
    await buttons[2].trigger('click') // theme toggle
    expect(w.emitted('toggle-theme')).toBeTruthy()
  })

  it('has no back button of its own — the single back entry lives in AgentSidebar', () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    expect(w.find('[title="返回"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('ModelPicker and the AI-rename button are filled in (placeholder comment gone)', () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    expect(w.html()).not.toContain('1c: ModelPicker')
    expect(w.html()).not.toContain('1c: AI-rename button')
    expect(w.findComponent({ name: 'ModelPicker' }).exists()).toBe(true)
    expect(w.find('.ai-rename-btn').exists()).toBe(true)
    // 4 icon buttons: toggle-left, ai-rename, theme, right-panel-toggle.
    expect(w.findAll('.icon-btn')).toHaveLength(4)
  })

  it('Right panel toggle button emits toggle-right, data-active reflects !rightCollapsed (Vue2 shell/AgentTopbar.vue:43-45)', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', rightCollapsed: false },
      global: { plugins: [i18n] },
    })
    // Icon-button order: toggle-left, ai-rename, theme, right-panel-toggle.
    const buttons = w.findAll('.icon-btn')
    const rightToggle = buttons[3]
    expect(rightToggle.attributes('data-active')).toBe('true')
    await rightToggle.trigger('click')
    expect(w.emitted('toggle-right')).toHaveLength(1)

    await w.setProps({ rightCollapsed: true })
    expect(w.findAll('.icon-btn')[3].attributes('data-active')).toBe('false')
  })

  it('ThinkingBar is mounted on the second row, its props are destructured from thinking (Vue2 shell/AgentTopbar.vue:47-54)', () => {
    const w = mount(AgentTopbar, {
      props: {
        sessionId: 's1',
        thinking: { enabled: false, level: 'high', supportsThinking: true, providerType: 'deepseek' },
      },
      global: { plugins: [i18n] },
    })
    const bar = w.findComponent({ name: 'ThinkingBar' })
    expect(bar.exists()).toBe(true)
    expect(bar.props()).toMatchObject({
      enabled: false,
      level: 'high',
      supportsThinking: true,
      providerType: 'deepseek',
    })
  })

  it('ThinkingBar update:enabled/update:level are remapped to thinking-enabled/thinking-level and re-emitted upward', async () => {
    const w = mount(AgentTopbar, {
      props: {
        sessionId: 's1',
        thinking: { enabled: true, level: 'medium', supportsThinking: true, providerType: '' },
      },
      global: { plugins: [i18n] },
    })
    const bar = w.findComponent({ name: 'ThinkingBar' })
    bar.vm.$emit('update:enabled', false)
    bar.vm.$emit('update:level', 'max')
    expect(w.emitted('thinking-enabled')?.[0]).toEqual([false])
    expect(w.emitted('thinking-level')?.[0]).toEqual(['max'])
    // The bar itself must not re-expose Vue2's raw event names upward.
    expect(w.emitted('update:enabled')).toBeUndefined()
    expect(w.emitted('update:level')).toBeUndefined()
  })

  it('Uses default values when the thinking prop is not passed (enabled=true, level=medium, supportsThinking=false)', () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    const bar = w.findComponent({ name: 'ThinkingBar' })
    expect(bar.props()).toMatchObject({
      enabled: true,
      level: 'medium',
      supportsThinking: false,
      providerType: '',
    })
  })

  it('ModelPicker receives availableModels/selectedModel, select/open-settings are forwarded as select-model/open-settings', async () => {
    const models = [{ key: 'local:a', source: 'local' as const, displayName: 'A' }]
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', availableModels: models, selectedModel: 'local:a' },
      global: { plugins: [i18n] },
    })
    const picker = w.findComponent({ name: 'ModelPicker' })
    expect(picker.props('availableModels')).toEqual(models)
    expect(picker.props('selectedKey')).toBe('local:a')
    picker.vm.$emit('select', 'local:b')
    expect(w.emitted('select-model')?.[0]).toEqual(['local:b'])
    picker.vm.$emit('open-settings')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })

  it('Clicking sparkle emits regenerate-title; disabled while this session is regenerating (foreground or background), the title input is disabled only for foreground regeneration', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', storedTitle: '旧标题' },
      global: { plugins: [i18n] },
    })
    const renameBtn = w.find('.ai-rename-btn')
    expect(renameBtn.attributes('disabled')).toBeUndefined()
    expect(w.find('.topbar-title-input').attributes('disabled')).toBeUndefined()
    await renameBtn.trigger('click')
    expect(w.emitted('regenerate-title')).toHaveLength(1)

    // Background regenerate (auto title-on-first-turn): sparkle disabled, title input stays editable.
    await w.setProps({ regeneratingTitleFor: { id: 's1', background: true } })
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.topbar-title-input').attributes('disabled')).toBeUndefined()

    // Foreground (explicit sparkle click) regenerate: both disabled.
    await w.setProps({ regeneratingTitleFor: { id: 's1', background: false } })
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.topbar-title-input').attributes('disabled')).toBeDefined()

    // A regenerate for a *different* session must not affect this topbar's disable state.
    await w.setProps({ regeneratingTitleFor: { id: 'other-session', background: false } })
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeUndefined()
    expect(w.find('.topbar-title-input').attributes('disabled')).toBeUndefined()
  })

  it('F1 fix: when sessionId is a numeric session id (passed through String()), isAnyRegenerating/isExplicitRegenerating must still normalize values before comparing activation (must not fail just because 42 !== "42")', async () => {
    const w = mount(AgentTopbar, {
      props: {
        sessionId: String(42),
        storedTitle: '旧标题',
        // regeneratingTitleFor.id keeps its native type (number), matching the store — AgentPage
        // only applies String() to the sessionId passed to AgentTopbar; regeneratingTitleFor
        // itself is passed through as-is, and this type asymmetry is exactly the pitfall F1 fixes.
        regeneratingTitleFor: { id: 42, background: false },
      },
      global: { plugins: [i18n] },
    })
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.topbar-title-input').attributes('disabled')).toBeDefined()
  })

  it('Sparkle is also disabled while the title input has focus (Vue2 shell/AgentTopbar.vue:24 isFocused)', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    await w.find('.topbar-title-input').trigger('focus')
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeDefined()
    await w.find('.topbar-title-input').trigger('blur')
    expect(w.find('.ai-rename-btn').attributes('disabled')).toBeUndefined()
  })
})
