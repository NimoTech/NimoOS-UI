import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import type { Skill } from '../../../types/skill'

// SP8-P3b Task 4 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue(182 行)。
// mock 骨架用 vi.hoisted()(先例 src/ai/stores/agentStore.test.ts:4-19)——裸 const
// 放 vi.mock 之前会因 ESM 提升抛 TDZ ReferenceError。
const h = vi.hoisted(() => ({ runSkillTest: vi.fn() }))
vi.mock('../../../services/skillTestTransport', () => ({ runSkillTest: h.runSkillTest }))

import TestPanel from './TestPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 's1',
    name: 'File Organizer',
    title: 'File Organizer',
    description: 'organizes files',
    trigger: 'manual',
    trigger_human: 'Manual',
    color: 'blue',
    icon: 'sparkle',
    enabled: true,
    system: false,
    author: 'Alice',
    last_used: '',
    calls: 3,
    files: [],
    examples: [],
    md: '',
    ...overrides,
  }
}

const mountPanel = (skill: Skill) =>
  mount(TestPanel, { props: { skill }, global: { plugins: [i18n] } })

// 每个测试自己捕获这一轮 runSkillTest 调用传入的 onEvent/onError/signal,并持有一个
// 可手动 resolve 的 deferred promise,模拟 T3 runSkillTest 在流关闭前一直 pending
// 的行为(真实实现是 `await sseRequest(...)`,流没关闭 promise 就不会 resolve)。
type Captured = {
  onEvent: (ev: Record<string, unknown>) => void
  onError: (e: unknown) => void
  signal: AbortSignal
  resolve: () => void
}
function captureNextRun(): Captured {
  const captured = {} as Captured
  h.runSkillTest.mockImplementationOnce(
    (_id: string, _prompt: string, signal: AbortSignal, onEvent: Captured['onEvent'], onError: Captured['onError']) => {
      captured.onEvent = onEvent
      captured.onError = onError
      captured.signal = signal
      return new Promise<void>(resolve => { captured.resolve = resolve })
    },
  )
  return captured
}

beforeEach(() => {
  h.runSkillTest.mockReset()
})

describe('TestPanel', () => {
  it('canRun 三态:空 prompt 禁用、有 prompt 启用、running 中禁用', async () => {
    const w = mountPanel(makeSkill())
    const btn = w.find('.sk-test-input button')
    expect(btn.attributes('disabled')).toBeDefined() // 空 prompt

    await w.find('.sk-test-input textarea').setValue('do the thing')
    expect(btn.attributes('disabled')).toBeUndefined() // 非空 prompt

    const cap = captureNextRun()
    await btn.trigger('click')
    expect(btn.attributes('disabled')).toBeDefined() // running 中
    cap.resolve()
    await flushPromises()
  })

  it('Cmd+Enter 触发运行,普通 Enter 不触发', async () => {
    const w = mountPanel(makeSkill())
    const textarea = w.find('.sk-test-input textarea')
    await textarea.setValue('hello')

    await textarea.trigger('keydown', { key: 'Enter' })
    expect(h.runSkillTest).not.toHaveBeenCalled()

    const cap = captureNextRun()
    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
    cap.resolve()
    await flushPromises()
  })

  it('ctrlKey+Enter 也触发运行(对齐 Vue2 :147 的 e.metaKey || e.ctrlKey)', async () => {
    const w = mountPanel(makeSkill())
    const textarea = w.find('.sk-test-input textarea')
    await textarea.setValue('hello')
    const cap = captureNextRun()
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
    cap.resolve()
    await flushPromises()
  })

  it('运行中按钮文案变「运行中…」且禁用', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')
    expect(w.find('.sk-test-input button').text()).toContain('运行中…')
    cap.resolve()
    await flushPromises()
  })

  it('多个 message_delta 渲染成一行(钉住偏离 D2),tool_call 单独一行', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'message_delta', content: 'Hel' })
    cap.onEvent({ type: 'message_delta', content: 'lo' })
    cap.onEvent({ type: 'tool_call', tool: 'grep' })
    cap.onEvent({ type: 'done' })
    cap.resolve()
    await flushPromises()

    const rows = w.findAll('.sk-test-result .step-row')
    // 若未合并(照抄 Vue2 :162 的逐片 push),这里会是 3 行('Hel'/'lo'/'→ grep')。
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toBe('Hello')
    expect(rows[1].text()).toContain('→ grep')
  })

  it('SSE error 事件原样显示后端人类可读文本', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'error', content: 'sandbox timed out' })
    cap.resolve()
    await flushPromises()

    const failed = w.find('.sk-test-result .label[data-state="failed"]')
    expect(failed.exists()).toBe(true)
    expect(w.find('.sk-test-result').text()).toContain('sandbox timed out')
  })

  it('HTTP 失败显示带状态码的本地化串,且不回显后端 body 内容', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onError({ status: 500, body: { detail: 'super secret internal path' } })
    cap.resolve()
    await flushPromises()

    const text = w.find('.sk-test-result').text()
    expect(text).toContain('500')
    expect(text).not.toContain('super secret internal path')
    expect(text).not.toContain('detail')
  })

  it('非 HTTP 形状的错误(拿不到 status)落回通用兜底串', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onError(new Error('boom'))
    cap.resolve()
    await flushPromises()

    expect(w.find('.sk-test-result').text()).toContain('运行失败')
  })

  it('成功完成后 emit(test) 恰好一次', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'message_delta', content: 'done thing' })
    cap.onEvent({ type: 'done' })
    cap.resolve()
    await flushPromises()

    expect(w.emitted('test')).toHaveLength(1)
  })

  it('失败时不 emit(test)(钉住偏离 D5)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'error', content: 'nope' })
    cap.resolve()
    await flushPromises()

    expect(w.emitted('test')).toBeUndefined()
  })

  it('HTTP 失败(而非 SSE error 事件)时也不 emit(test)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onError({ status: 422 })
    cap.resolve()
    await flushPromises()

    expect(w.emitted('test')).toBeUndefined()
  })

  it('停用技能显示「技能已关闭」角标,但运行按钮仍可用', async () => {
    const w = mountPanel(makeSkill({ enabled: false }))
    expect(w.find('.sk-item-off').exists()).toBe(true)
    expect(w.find('.sk-item-off').text()).toBe('技能已关闭')

    await w.find('.sk-test-input textarea').setValue('go')
    expect(w.find('.sk-test-input button').attributes('disabled')).toBeUndefined()
  })

  it('启用技能不显示「技能已关闭」角标', () => {
    const w = mountPanel(makeSkill({ enabled: true }))
    expect(w.find('.sk-item-off').exists()).toBe(false)
  })

  it('示例提示词点击写进 textarea', async () => {
    const w = mountPanel(makeSkill({ examples: ['清理下载文件夹', '整理照片'] }))
    const exButtons = w.findAll('.sk-test-result .ex button')
    expect(exButtons).toHaveLength(2)

    await exButtons[1].trigger('click')
    const textarea = w.find('.sk-test-input textarea').element as HTMLTextAreaElement
    expect(textarea.value).toBe('整理照片')
  })

  it('有示例但技能无描述示例时不渲染示例区(examples 为空数组)', () => {
    const w = mountPanel(makeSkill({ examples: [] }))
    expect(w.find('.sk-test-result .ex').exists()).toBe(false)
  })

  it('卸载时调用 abort', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    expect(cap.signal.aborted).toBe(false)
    w.unmount()
    expect(cap.signal.aborted).toBe(true)
  })

  it('不实现 output.tokens 死分支:成功文案不含 tokens 相关文本(钉住 Vue2 :70-73 死分支不移植)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'done', tokens: 999 })
    cap.resolve()
    await flushPromises()

    expect(w.find('.sk-test-result').text()).not.toContain('999')
    expect(w.find('.sk-test-result').text()).not.toContain('tokens')
  })
})
