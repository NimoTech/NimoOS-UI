import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import type { Skill } from '../../../types/skill'

// Mirrors Vue2 src/views/AI/Skills/TestPanel.vue (182 lines).
// The mock skeleton uses vi.hoisted() (precedent: src/ai/stores/agentStore.test.ts:4-19) —
// a bare const placed before vi.mock would throw a TDZ ReferenceError due to ESM hoisting.
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

// Each test captures the onEvent/onError/signal passed into this round's runSkillTest call, and
// holds a manually-resolvable deferred promise, simulating T3 runSkillTest staying pending until
// the stream closes (the real implementation is `await sseRequest(...)`, whose promise only
// resolves once the stream closes).
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
  it('canRun has three states: disabled with empty prompt, enabled with a prompt, disabled while running', async () => {
    const w = mountPanel(makeSkill())
    const btn = w.find('.sk-test-input button')
    expect(btn.attributes('disabled')).toBeDefined() // empty prompt

    await w.find('.sk-test-input textarea').setValue('do the thing')
    expect(btn.attributes('disabled')).toBeUndefined() // non-empty prompt

    const cap = captureNextRun()
    await btn.trigger('click')
    expect(btn.attributes('disabled')).toBeDefined() // running
    cap.resolve()
    await flushPromises()
  })

  it('Cmd+Enter triggers a run, plain Enter does not', async () => {
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

  it('ctrlKey+Enter also triggers a run (mirrors Vue2 :147 e.metaKey || e.ctrlKey)', async () => {
    const w = mountPanel(makeSkill())
    const textarea = w.find('.sk-test-input textarea')
    await textarea.setValue('hello')
    const cap = captureNextRun()
    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
    cap.resolve()
    await flushPromises()
  })

  it('button copy changes to 「运行中…」 while running, and is disabled', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')
    expect(w.find('.sk-test-input button').text()).toContain('运行中…')
    cap.resolve()
    await flushPromises()
  })

  it('multiple message_delta events render as one line (pins deviation D2), tool_call gets its own line', async () => {
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
    // If not merged (copying Vue2 :162's push-per-chunk), this would be 3 lines ('Hel'/'lo'/'→ grep').
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toBe('Hello')
    expect(rows[1].text()).toContain('→ grep')
  })

  it('SSE error event displays the backend human-readable text verbatim', async () => {
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

  it('HTTP failure displays a localized string with the status code, and does not echo the backend body content', async () => {
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

  it('a non-HTTP-shaped error (no status available) falls back to the generic fallback string', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onError(new Error('boom'))
    cap.resolve()
    await flushPromises()

    expect(w.find('.sk-test-result').text()).toContain('运行失败')
  })

  it('emits(test) exactly once after a successful completion', async () => {
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

  it('does not emit(test) on failure (pins deviation D5)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'error', content: 'nope' })
    cap.resolve()
    await flushPromises()

    expect(w.emitted('test')).toBeUndefined()
  })

  // [P3b final review I2] the backend agent/agent.py:999 sends `{"type":"error","content": str(e)}`,
  // and for some exceptions `str(e)` is an empty string — the reducer/panel used to decide failure
  // via `error !== ''`, so an empty string was misjudged as success (rendering the success copy
  // 「用时  毫秒」+「沙箱已关闭」), and it also double-counted one extra emit('test'), breaking
  // through D5 (only +1 on successful completion). RED verification: revert the `sandboxRun.ts`
  // error branch to not write `failed`, or revert TestPanel's check back to `!sandbox.error` →
  // this test fails precisely (the failed-state label disappears, emit gets a value).
  it('error event with empty content is still judged a failure (not a success), and does not emit(test) (pins P3b final review I2)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onEvent({ type: 'error', content: '' })
    cap.onEvent({ type: 'done' })
    cap.resolve()
    await flushPromises()

    const failed = w.find('.sk-test-result .label[data-state="failed"]')
    expect(failed.exists()).toBe(true)
    // The success-state 「用时…毫秒」 copy must not appear.
    expect(w.find('.sk-test-result').text()).not.toContain('沙箱已关闭')
    expect(w.emitted('test')).toBeUndefined()
  })

  it('also does not emit(test) on an HTTP failure (as opposed to an SSE error event)', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    cap.onError({ status: 422 })
    cap.resolve()
    await flushPromises()

    expect(w.emitted('test')).toBeUndefined()
  })

  it('a disabled skill shows the 「技能已关闭」 badge, but the run button stays enabled', async () => {
    const w = mountPanel(makeSkill({ enabled: false }))
    expect(w.find('.sk-item-off').exists()).toBe(true)
    expect(w.find('.sk-item-off').text()).toBe('技能已关闭')

    await w.find('.sk-test-input textarea').setValue('go')
    expect(w.find('.sk-test-input button').attributes('disabled')).toBeUndefined()
  })

  it('an enabled skill does not show the 「技能已关闭」 badge', () => {
    const w = mountPanel(makeSkill({ enabled: true }))
    expect(w.find('.sk-item-off').exists()).toBe(false)
  })

  it('clicking an example prompt writes it into the textarea', async () => {
    const w = mountPanel(makeSkill({ examples: ['清理下载文件夹', '整理照片'] }))
    const exButtons = w.findAll('.sk-test-result .ex button')
    expect(exButtons).toHaveLength(2)

    await exButtons[1].trigger('click')
    const textarea = w.find('.sk-test-input textarea').element as HTMLTextAreaElement
    expect(textarea.value).toBe('整理照片')
  })

  it('does not render the examples section when the skill has no examples (examples is an empty array)', () => {
    const w = mountPanel(makeSkill({ examples: [] }))
    expect(w.find('.sk-test-result .ex').exists()).toBe(false)
  })

  it('calls abort on unmount', async () => {
    const w = mountPanel(makeSkill())
    await w.find('.sk-test-input textarea').setValue('go')
    const cap = captureNextRun()
    await w.find('.sk-test-input button').trigger('click')

    expect(cap.signal.aborted).toBe(false)
    w.unmount()
    expect(cap.signal.aborted).toBe(true)
  })

  it('does not implement the output.tokens dead branch: success copy has no tokens-related text (pins Vue2 :70-73 dead branch as not ported)', async () => {
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
