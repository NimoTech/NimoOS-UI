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

  // show()'s optional third argument `action` (used by the recycle-bin view) renders as a
  // clickable inline button (e.g. "Undo"); clicking fires the callback and removes that toast
  // from the stack immediately (without waiting for the auto-dismiss timer).
  it('When show() has an action, renders a clickable button, clicking triggers the callback and immediately removes that toast', async () => {
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

  // Three tiers (info/warning/danger), each rendering its
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

// Feedback from an earlier review: while the AI area is in the foreground,
// the toast must follow the AI light/dark theme (otherwise white-on-white is invisible, see the
// notes in aiTheme.test.ts). Leaving the AI area must restore everything exactly — the user
// explicitly required "zero impact on the desktop", so "no extra class / data-theme outside the
// AI area" must be pinned as well.
describe('AppToast — AI area toast scoping', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('Not in AI area: no ai-toast-scope, no data-theme (zero impact on desktop)', () => {
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).not.toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBeUndefined()
  })

  it('AI area in foreground: has ai-toast-scope, data-theme follows AI theme', async () => {
    const ai = useAiTheme()
    ai.enterAiSurface()
    const w = mount(AppToast)
    const root = w.find('.toast-stack')
    expect(root.classes()).toContain('ai-toast-scope')
    expect(root.attributes('data-theme')).toBe(ai.theme)
  })

  it('Toggling light/dark inside AI area: data-theme changes (dialogs/toasts do not need to be closed and reopened)', async () => {
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

  it('After leaving AI area, restore: both class and data-theme are removed', async () => {
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

// A user observed on a real device: clicking copy inside a dialog,
// "the toast is hidden". Evidence: `.toast-stack` was `z-index: 60`, while the `.sk-modal-bg`
// scrim at `sk-shared.scss:102` is `1100`, and the AI area's SearchImageLightbox/SearchFileDrawer
// are `10000`, SearchFullResults `9999` (the highest layers found by a repo-wide grep). The toast
// is the **topmost feedback** and must cover all of these, otherwise the user gets no feedback
// while any dialog is open — this is unrelated to colors, a pure stacking issue; jsdom cannot
// measure computed stacking, so we pin it with a source-text guard.
// The toast has `pointer-events: none`, so being on top never blocks clicks.
describe('AppToast — stacking must be above the highest floating layer in the repo', () => {
  it('.toast-stack z-index is above 10000 (dialog scrim 1100 / lightbox 10000)', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), './AppToast.vue'), 'utf8')
    const m = /\.toast-stack\s*\{[^}]*z-index:\s*(\d+)/.exec(src)
    expect(m, 'Cannot find .toast-stack z-index declaration').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThan(10000)
  })
})
