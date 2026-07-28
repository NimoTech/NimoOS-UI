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
      // SP8-P1c2 Task 9 —— AI-rename 按钮 tooltip + ModelPicker(真实挂载,非
      // stub)所需的全部文案。
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

  it('标题输入防抖 500ms 后 flush,emit update-title(trim 过的值)', async () => {
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

  it('blur 时立即 flush(不等防抖),空值 blur 则还原为 props.storedTitle', async () => {
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

  it('切换 sessionId 时重置本地标题为新 session 的 storedTitle', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', storedTitle: '会话一标题' },
      global: { plugins: [i18n] },
    })
    await w.setProps({ sessionId: 's2', storedTitle: '会话二标题' })
    expect((w.find('.topbar-title-input').element as HTMLInputElement).value).toBe('会话二标题')
  })

  it('主题切换按钮 emit toggle-theme;左侧面板按钮 emit toggle-left', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', theme: 'light' },
      global: { plugins: [i18n] },
    })
    const buttons = w.findAll('.icon-btn')
    await buttons[1].trigger('click') // panelLeft toggle
    expect(w.emitted('toggle-left')).toBeTruthy()
    // Index shifts by one since SP8-P1c2 Task 9 inserted the AI-rename button
    // (also `.icon-btn`) ahead of the theme toggle: goHome, toggle-left,
    // ai-rename, theme, right-panel-toggle.
    await buttons[3].trigger('click') // theme toggle
    expect(w.emitted('toggle-theme')).toBeTruthy()
  })

  it('goHome:有历史且不在首页时走 router.push', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    await w.findAll('.icon-btn')[0].trigger('click') // goHome (arrowLeft)
    expect(push).toHaveBeenCalledWith('/')
    historySpy.mockRestore()
  })

  it('SP8-P1c2 Task 9:ModelPicker 与 AI 改名按钮已回填(占位注释消失)', () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    expect(w.html()).not.toContain('1c: ModelPicker')
    expect(w.html()).not.toContain('1c: AI-rename button')
    expect(w.findComponent({ name: 'ModelPicker' }).exists()).toBe(true)
    expect(w.find('.ai-rename-btn').exists()).toBe(true)
    // 5 icon buttons now: goHome, toggle-left, ai-rename, theme, right-panel-toggle.
    expect(w.findAll('.icon-btn')).toHaveLength(5)
  })

  it('SP8-P1c2:右侧面板开关按钮 emit toggle-right,data-active 反映 !rightCollapsed(Vue2 shell/AgentTopbar.vue:43-45)', async () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1', rightCollapsed: false },
      global: { plugins: [i18n] },
    })
    // Index shifts by one since SP8-P1c2 Task 9 inserted the AI-rename button
    // ahead of the theme toggle: goHome, toggle-left, ai-rename, theme, right-panel-toggle.
    const buttons = w.findAll('.icon-btn')
    const rightToggle = buttons[4]
    expect(rightToggle.attributes('data-active')).toBe('true')
    await rightToggle.trigger('click')
    expect(w.emitted('toggle-right')).toHaveLength(1)

    await w.setProps({ rightCollapsed: true })
    expect(w.findAll('.icon-btn')[4].attributes('data-active')).toBe('false')
  })

  it('SP8-P1c2 Task 8:ThinkingBar 挂在第二行,props 从 thinking 拆开传入(Vue2 shell/AgentTopbar.vue:47-54)', () => {
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

  it('SP8-P1c2 Task 8:ThinkingBar 的 update:enabled/update:level 被重映射成 thinking-enabled/thinking-level 往上抛', async () => {
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

  it('SP8-P1c2 Task 8:未传 thinking prop 时使用默认值(enabled=true, level=medium, supportsThinking=false)', () => {
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

  it('SP8-P1c2 Task 9:ModelPicker 拿到 availableModels/selectedModel,select/open-settings 转发成 select-model/open-settings', async () => {
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

  it('SP8-P1c2 Task 9:点 sparkle emit regenerate-title;本会话正在重生成(前台或后台)时禁用,标题输入框仅前台重生成时禁用', async () => {
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

  it('SP8-P1c2 Task 9:标题输入框获得焦点时 sparkle 亦禁用(Vue2 shell/AgentTopbar.vue:24 isFocused)', async () => {
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
