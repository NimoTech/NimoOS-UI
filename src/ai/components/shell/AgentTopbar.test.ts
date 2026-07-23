import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AgentTopbar from './AgentTopbar.vue'

const push = vi.fn().mockResolvedValue(undefined)
const routeState = { path: '/agent' }
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, currentRoute: { value: routeState } }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { aiBack: '返回', aiNewConversation: '新对话' } } })

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
    await buttons[2].trigger('click') // theme toggle
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

  it('1a 裁剪:不渲染 ModelPicker/ThinkingBar/右侧面板 toggle/AI 改名按钮', () => {
    const w = mount(AgentTopbar, {
      props: { sessionId: 's1' },
      global: { plugins: [i18n] },
    })
    expect(w.html()).toContain('1c: ModelPicker')
    expect(w.html()).toContain('1c: ThinkingBar')
    expect(w.html()).toContain('1c: right-panel toggle')
    expect(w.html()).toContain('1c: AI-rename button')
    // Only 3 icon buttons survive the trim: goHome, toggle-left, theme toggle.
    expect(w.findAll('.icon-btn')).toHaveLength(3)
  })
})
