import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getMaxTurns: vi.fn(),
  putMaxTurns: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { getMaxTurns: h.getMaxTurns, putMaxTurns: h.putMaxTurns } },
}))

import ExecutionSection from './ExecutionSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(ExecutionSection, { global: { plugins: [i18n] } })
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }

describe('ExecutionSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getMaxTurns.mockReset()
    h.putMaxTurns.mockReset()
    h.putMaxTurns.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('max_turns: 25 → 数字输入框值 25、无限开关关、输入框可编辑', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('25')
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    expect(input.disabled).toBe(false)
  })

  it('max_turns: 0 → 无限开关开，数字输入框 disabled', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 0 })
    const w = mountSection()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('max_turns 缺失/非数字 → 回落 10', async () => {
    h.getMaxTurns.mockResolvedValue({})
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('10')
  })

  it('getMaxTurns reject → 不抛、不弹 toast，显示默认 10', async () => {
    h.getMaxTurns.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num').element as HTMLInputElement
    expect(input.value).toBe('10')
    expect(show).not.toHaveBeenCalled()
  })

  it('打开无限开关 → 立刻 putMaxTurns(0)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(0)
  })

  it('关掉无限开关（此时 steps=10）→ putMaxTurns(10)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 0 })
    const w = mountSection()
    await flush()
    // now unlimited, steps default stays 10
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(10)
  })

  it('数字框改成 3 触发 change → putMaxTurns(3)', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(3)
  })

  // 归一化分支说明:公式是 Math.max(1, Math.floor(Number(steps.value) || 10))。
  // 该 `||10` 与「输入空」用的是同一条 fallback(brief 自己就用它解释空输入的
  // Number('')||10=10),所以字面输入 "0" 会先撞在 `||10` 上变成 10、再
  // Math.floor/Math.max 原地不动 —— 与「输入空」是同一分支,不是
  // Math.max(1,…) clamp 分支。要真正命中 clamp 分支需要一个 Number() 非零但
  // floor 后 <1 的值,这里用 0.3。见报告里的偏差声明。
  it('归一化：输入 0.3 → putMaxTurns(1) 且输入框回显 1（Math.max(1,…) clamp 分支）', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(0.3)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(1)
    expect((input.element as HTMLInputElement).value).toBe('1')
  })

  it('归一化：输入 2.7 → putMaxTurns(2)（Math.floor）', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(2.7)
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(2)
  })

  it('归一化：输入空 → putMaxTurns(10)（Number("")||10）', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue('')
    await flush()
    expect(h.putMaxTurns).toHaveBeenCalledWith(10)
  })

  it('保存中显示「保存中…」、保存完显示「已保存」', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    let release: () => void = () => {}
    h.putMaxTurns.mockImplementation(() => new Promise<void>((r) => { release = r }))
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await nextTick()
    expect(w.find('.set-actions .hint').text()).toBe('保存中…')
    release()
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
  })

  it('「已保存」2 秒后自动消失', async () => {
    vi.useFakeTimers()
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
    await vi.advanceTimersByTimeAsync(1999)
    expect(w.find('.set-actions .hint').text()).toBe('已保存')
    await vi.advanceTimersByTimeAsync(1)
    expect(w.find('.set-actions .hint').text()).toBe('')
  })

  it('保存失败弹 danger toast，且「保存中…」复位', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    h.putMaxTurns.mockRejectedValue({ response: { data: { message: '后端拒绝' } } })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(show).toHaveBeenCalledWith('后端拒绝', 3000, 'danger')
    expect(w.find('.set-actions .hint').text()).toBe('')
  })

  it('保存失败且无消息 → toast 兜底文案「保存失败」', async () => {
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    h.putMaxTurns.mockRejectedValue({})
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    expect(show).toHaveBeenCalledWith('保存失败', 3000, 'danger')
  })

  it('卸载后定时器不再触发', async () => {
    vi.useFakeTimers()
    h.getMaxTurns.mockResolvedValue({ max_turns: 25 })
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    const input = w.find('.set-input.num')
    await input.setValue(3)
    await flush()
    w.unmount()
    await vi.advanceTimersByTimeAsync(3000)
    expect(show).not.toHaveBeenCalled()
  })
})
