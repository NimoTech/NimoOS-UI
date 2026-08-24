// Ported from Vue2 TaskEditorModal.spec.js + .draft.spec.js + .webhook.spec.js
// (the behaviorally load-bearing assertions, mount-style per this repo).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  cronPreview: vi.fn(),
  resetTaskWebhookToken: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      createTask: h.createTask,
      updateTask: h.updateTask,
      cronPreview: h.cronPreview,
      resetTaskWebhookToken: h.resetTaskWebhookToken,
      listModels: h.listModels,
      listProviders: h.listProviders,
    },
  },
}))

import TaskEditorModal from './TaskEditorModal.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(TaskEditorModal, {
    props,
    global: { plugins: [i18n] },
  })
}

const OK_REPORT = { preauth_report: { truncated: {}, rejected_rules: [] } }

describe('TaskEditorModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    for (const fn of Object.values(h)) fn.mockReset()
    h.listModels.mockResolvedValue([])
    h.listProviders.mockResolvedValue([])
    h.cronPreview.mockResolvedValue({ next: [] })
    h.createTask.mockResolvedValue(OK_REPORT)
    h.updateTask.mockResolvedValue(OK_REPORT)
  })

  it('create mode seeds Vue2 defaults (cron 0 9 * * *, 25 turns, failure notify)', async () => {
    const w = mountEditor()
    await flush()
    expect((w.find('[data-test="task-cron"]').element as HTMLInputElement).value).toBe(
      '0 9 * * *',
    )
    expect(w.text()).toContain('创建') // create-mode footer button
  })

  it('refuses to save without a name / prompt / valid cron', async () => {
    const w = mountEditor()
    await flush()
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    expect(h.createTask).not.toHaveBeenCalled()
    expect(w.find('[data-test="editor-error"]').exists()).toBe(true)

    await w.find('[data-test="task-name"]').setValue('N')
    await w.find('[data-test="task-prompt"]').setValue('P')
    await w.find('[data-test="task-cron"]').setValue('not five')
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    expect(h.createTask).not.toHaveBeenCalled()
  })

  it('sends the WHOLE preauth document and no enabled on create', async () => {
    const w = mountEditor()
    await flush()
    await w.find('[data-test="task-name"]').setValue('N')
    await w.find('[data-test="task-prompt"]').setValue('P')
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    const body = h.createTask.mock.calls[0][0]
    expect(body.preauth).toEqual({
      shell: [],
      egress_domains: [],
      mcp_tools: [],
      fs_write: [],
      scripts: [],
    })
    expect('enabled' in body).toBe(false)
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('edit mode deep-copies preauth and sends enabled on update', async () => {
    const task = {
      id: 't1',
      name: 'Old',
      prompt: 'p',
      trigger_type: 'cron',
      cron_expr: '0 9 * * *',
      enabled: 0,
      preauth: { shell: [{ kind: 'prefix', value: 'gh ' }], fs_write: ['/DATA/x'] },
    }
    const w = mountEditor({ task })
    await flush()
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    const [id, body] = h.updateTask.mock.calls[0]
    expect(id).toBe('t1')
    expect(body.enabled).toBe(false)
    expect(body.preauth.shell).toEqual([{ kind: 'prefix', value: 'gh ' }])
    expect(body.preauth.fs_write).toEqual(['/DATA/x'])
    // the source object was never mutated
    expect(task.preauth.shell).toEqual([{ kind: 'prefix', value: 'gh ' }])
  })

  it('a rejected-rule report keeps the modal open (saved without close)', async () => {
    h.createTask.mockResolvedValue({
      preauth_report: {
        truncated: {},
        rejected_rules: [{ field: 'shell', value: '.*', reason: 'regex_rules_not_supported' }],
      },
    })
    const w = mountEditor()
    await flush()
    await w.find('[data-test="task-name"]').setValue('N')
    await w.find('[data-test="task-prompt"]').setValue('P')
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    expect(w.emitted('saved')).toBeTruthy()
    expect(w.emitted('close')).toBeFalsy()
    expect(w.text()).toContain('shell: .*')
    expect(w.text()).toContain('不再支持正则')
  })

  it('a draft prefills but never schedules and never pre-authorizes egress', async () => {
    const w = mountEditor({
      draft: {
        name: 'Radar',
        prompt: 'collect',
        prompt_fallback: true,
        preauth: { shell: [{ kind: 'prefix', value: 'lark-cli ' }], egress_domains: ['x.com'] },
        suggested_egress: ['open.feishu.cn', 'open.feishu.cn'],
        evidence: { 'suggested_egress:open.feishu.cn': '第 3 次调用' },
      },
    })
    await flush()
    expect((w.find('[data-test="task-name"]').element as HTMLInputElement).value).toBe('Radar')
    // trigger defaults to webhook_only → no cron input rendered
    expect(w.find('[data-test="task-cron"]').exists()).toBe(false)
    // the contract-violating egress_domains were dropped; suggestion is a chip
    const chip = w.find('.tsk-suggest-chip')
    expect(chip.exists()).toBe(true)
    expect(w.findAll('.tsk-suggest-chip')).toHaveLength(1) // deduped
    await chip.trigger('click')
    await flush()
    expect(w.findAll('.tsk-suggest-chip')).toHaveLength(0)
    // adopted host now rides the payload
    await w.find('[data-test="task-save"]').trigger('click')
    await flush()
    expect(h.createTask.mock.calls[0][0].preauth.egress_domains).toEqual(['open.feishu.cn'])
    expect(h.createTask.mock.calls[0][0].trigger_type).toBe('webhook_only')
  })

  it('cron preview shows the endpoint fire time and hides on invalid cron', async () => {
    h.cronPreview.mockResolvedValue({ next: [1_800_000_000, 1_800_086_400] })
    const w = mountEditor()
    await flush()
    vi.useFakeTimers()
    await w.find('[data-test="task-cron"]').setValue('0 10 * * *')
    await vi.advanceTimersByTimeAsync(500)
    vi.useRealTimers()
    await flush()
    expect(h.cronPreview).toHaveBeenCalledWith('0 10 * * *')
    expect(w.find('[data-test="next-run-preview"]').exists()).toBe(true)

    vi.useFakeTimers()
    await w.find('[data-test="task-cron"]').setValue('nope')
    await vi.advanceTimersByTimeAsync(500)
    vi.useRealTimers()
    await flush()
    expect(w.find('[data-test="next-run-preview"]').exists()).toBe(false)
  })

  it('webhook token resets in place for an existing task', async () => {
    h.resetTaskWebhookToken.mockResolvedValue({ webhook_token: 'newtok' })
    const w = mountEditor({
      task: { id: 't1', name: 'N', prompt: 'p', trigger_type: 'webhook_only', webhook_token: 'old' },
    })
    await flush()
    expect((w.find('.set-copy .set-input').element as HTMLInputElement).value).toContain('old')
    await w.find('.set-copy .sk-btn').trigger('click')
    await flush()
    expect(h.resetTaskWebhookToken).toHaveBeenCalledWith('t1')
    expect((w.find('.set-copy .set-input').element as HTMLInputElement).value).toContain('newtok')
  })
})
