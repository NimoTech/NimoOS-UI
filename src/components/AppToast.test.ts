import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from '../stores/toast'
import AppToast from './AppToast.vue'
import { useAiTheme } from '../ai/stores/aiTheme'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('AppToast', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders no pill when message is empty', () => {
    const w = mount(AppToast)
    expect(w.find('.toast').exists()).toBe(false)
  })

  it('renders the message from useToast', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('saved')
    await w.vm.$nextTick()
    expect(w.get('.toast').text()).toBe('saved')
  })

  it('stacks multiple toasts', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('first')
    t.show('second')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills).toHaveLength(2)
    expect(pills.map((p) => p.text())).toEqual(['first', 'second'])
  })

  // Task 9 (SP7-P3 recycle-bin view): show()'s optional third argument `action` renders as a
  // clickable inline button (e.g. "Undo"); clicking fires the callback and removes that toast
  // from the stack immediately (without waiting for the auto-dismiss timer).
  it('show 带 action 时渲染可点按钮,点击触发回调并立即移除该 toast', async () => {
    const t = useToast()
    const w = mount(AppToast)
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    await w.vm.$nextTick()

    const pill = w.get('.toast')
    expect(pill.text()).toBe('已恢复 撤销')
    const btn = pill.get('.toast-action')
    expect(btn.text()).toBe('撤销')

    await btn.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    await w.vm.$nextTick()
    expect(w.find('.toast').exists()).toBe(false)
  })

  // SP8-P1c2 Task 6: three tiers (info/warning/danger), each rendering its
  // own [data-tier] so AppToast.vue's CSS can style them from global theme
  // tokens (this component is outside .agent-app scope, see theme.css).
  it('a default show(text) call renders data-tier="info"', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('saved')
    await w.vm.$nextTick()
    expect(w.get('.toast').attributes('data-tier')).toBe('info')
  })

  it('renders data-tier="warning" and data-tier="danger" for tiered toasts', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('careful', 1500, 'warning')
    t.show('failed', 1500, 'danger')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills.map((p) => p.attributes('data-tier'))).toEqual(['warning', 'danger'])
  })

  it('stacks toasts of different tiers together', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('info one')
    t.show('warn one', 1500, 'warning')
    t.show('danger one', 1500, 'danger')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills).toHaveLength(3)
    expect(pills.map((p) => p.attributes('data-tier'))).toEqual(['info', 'warning', 'danger'])
  })
})

// [SP8-P2b acceptance round 3, user decision 2026-07-30] While the AI area is in the foreground,
// the toast must follow the AI light/dark theme (otherwise white-on-white is invisible, see the
// notes in aiTheme.test.ts). Leaving the AI area must restore everything exactly — the user
// explicitly required "zero impact on the desktop", so "no extra class / data-theme outside the
// AI area" must be pinned as well.
describe('AppToast —— AI 区 toast 作用域', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('不在 AI 区:不带 ai-toast-scope、不带 data-theme(桌面零影响)', () => {
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).not.toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBeUndefined()
  })

  it('AI 区在前台:带 ai-toast-scope,且 data-theme 跟随 AI 主题', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBe(ai.theme)
  })

  it('AI 区内切换明暗:data-theme 跟着变(弹窗/提示不用关掉重开)', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const before = w.find('.toast-stack').attributes('data-theme')
    ai.toggleTheme()
    await w.vm.$nextTick()
    const after = w.find('.toast-stack').attributes('data-theme')
    expect(after).not.toBe(before)
    expect(after).toBe(ai.theme)
  })

  it('离开 AI 区后恢复:class 与 data-theme 都撤掉', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    expect(w.find('.toast-stack').classes()).toContain('ai-toast-scope')
    ai.leaveAiSurface()
    await w.vm.$nextTick()
    expect(w.find('.toast-stack').classes()).not.toContain('ai-toast-scope')
    expect(w.find('.toast-stack').attributes('data-theme')).toBeUndefined()
  })
})

// [SP8-P2b acceptance round 4, 2026-07-30] User observed on device: clicking copy inside a dialog,
// "the toast is hidden". Evidence: `.toast-stack` was `z-index: 60`, while the `.sk-modal-bg`
// scrim at `sk-shared.scss:102` is `1100`, and the AI area's SearchImageLightbox/SearchFileDrawer
// are `10000`, SearchFullResults `9999` (the highest layers found by a repo-wide grep). The toast
// is the **topmost feedback** and must cover all of these, otherwise the user gets no feedback
// while any dialog is open — this is unrelated to colors, a pure stacking issue; jsdom cannot
// measure computed stacking, so we pin it with a source-text guard.
// The toast has `pointer-events: none`, so being on top never blocks clicks.
describe('AppToast —— 层级必须高于全仓最高的浮层', () => {
  it('.toast-stack 的 z-index 高于 10000(弹窗遮罩 1100 / 灯箱 10000)', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), './AppToast.vue'), 'utf8')
    const m = /\.toast-stack\s*\{[^}]*z-index:\s*(\d+)/.exec(src)
    expect(m, '找不到 .toast-stack 的 z-index 声明').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThan(10000)
  })
})
