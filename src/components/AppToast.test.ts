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

  // Task 9 (SP7-P3 回收站视图): show() 的第三个可选参数 action 渲染成可点的行内按钮
  // (如「撤销」),点击后立即触发回调并从堆栈里移除该 toast(不等自动消失计时器)。
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

// 【SP8-P2b 验收第 3 轮,用户 2026-07-30 拍板】AI 区在前台时,提示条要跟随 AI 的明暗主题
// (否则白底白字看不见,详见 aiTheme.test.ts 的说明)。离开 AI 区必须完全恢复原样 ——
// 用户明确要求「桌面零影响」,所以「不在 AI 区时不带任何额外 class / data-theme」这条
// 同样要钉住。
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

// 【SP8-P2b 验收第 4 轮,2026-07-30】用户实测:弹窗里点复制「toast 被挡住了」。
// 取证:`.toast-stack` 原为 `z-index: 60`,而 `sk-shared.scss:102` 的 `.sk-modal-bg` 遮罩是
// `1100`,AI 区的 SearchImageLightbox/SearchFileDrawer 是 `10000`、SearchFullResults 是 `9999`
// (全仓 grep 实测的最高层)。提示条是**最顶层反馈**,必须盖在这些之上,否则任何弹窗打开时
// 用户都收不到反馈 —— 这与配色无关,是纯层级问题,jsdom 量不出计算层级,故用源码守卫钉住。
// 提示条 `pointer-events: none`,置顶不会挡住任何点击。
describe('AppToast —— 层级必须高于全仓最高的浮层', () => {
  it('.toast-stack 的 z-index 高于 10000(弹窗遮罩 1100 / 灯箱 10000)', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), './AppToast.vue'), 'utf8')
    const m = /\.toast-stack\s*\{[^}]*z-index:\s*(\d+)/.exec(src)
    expect(m, '找不到 .toast-stack 的 z-index 声明').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThan(10000)
  })
})
