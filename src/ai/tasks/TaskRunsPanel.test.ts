// Ported from Vue2 TaskRunsPanel.spec.js (the behaviorally load-bearing cases).
// TaskRunTranscript is stubbed: its own logic is covered by runTranscript.test.ts,
// and mounting it here would open SSE attachments this panel test doesn't own.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  listTaskRuns: vi.fn(),
  adoptDeniedAction: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listTaskRuns: h.listTaskRuns,
      adoptDeniedAction: h.adoptDeniedAction,
    },
  },
}))

import TaskRunsPanel from './TaskRunsPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

function run(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    status: 'succeeded',
    trigger: 'manual',
    created_at: 1_800_000_000,
    started_at: 1_800_000_000,
    finished_at: 1_800_000_042,
    session_id: 's1',
    summary: 'all done',
    error: '',
    denied_actions: [],
    ...over,
  }
}

function mountPanel() {
  return mount(TaskRunsPanel, {
    props: { taskId: 't1', pollIntervalMs: 999999 },
    global: {
      plugins: [i18n],
      stubs: { TaskRunTranscript: { template: '<div class="rt-stub" />' } },
    },
  })
}

describe('TaskRunsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.listTaskRuns.mockReset()
    h.adoptDeniedAction.mockReset()
    h.adoptDeniedAction.mockResolvedValue({})
  })

  it('renders runs with status pill, trigger and duration', async () => {
    h.listTaskRuns.mockResolvedValue({ runs: [run()] })
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain('成功') // aiTasksStatusSucceeded
    expect(w.text()).toContain('42') // duration seconds
    w.unmount()
  })

  it('expanding a run shows summary, error and denied actions', async () => {
    h.listTaskRuns.mockResolvedValue({
      runs: [
        run({
          status: 'failed',
          error: 'boom',
          denied_actions: [
            { kind: 'egress', detail: 'x.com' },
            { kind: 'toolbox_install', detail: 'gh' },
          ],
        }),
      ],
    })
    const w = mountPanel()
    await flush()
    await w.find('[data-test="run-head"]').trigger('click')
    await flush()
    expect(w.text()).toContain('boom')
    expect(w.text()).toContain('x.com')
    // adoptable kind gets the button; unsupported kind gets the note instead
    expect(w.findAll('[data-test="adopt"]')).toHaveLength(1)
    expect(w.text()).toContain('该类动作无法预授权') // aiTasksAdoptUnsupported
    w.unmount()
  })

  it('adopt calls the endpoint with (taskId, runId, index) and emits adopted', async () => {
    h.listTaskRuns.mockResolvedValue({
      runs: [run({ denied_actions: [{ kind: 'fs', detail: '/media/x' }] })],
    })
    const w = mountPanel()
    await flush()
    await w.find('[data-test="run-head"]').trigger('click')
    await flush()
    await w.find('[data-test="adopt"]').trigger('click')
    await flush()
    expect(h.adoptDeniedAction).toHaveBeenCalledWith('t1', 'r1', 0)
    expect(w.emitted('adopted')).toBeTruthy()
    w.unmount()
  })

  it('shows the empty note when a task has no runs yet', async () => {
    h.listTaskRuns.mockResolvedValue({ runs: [] })
    const w = mountPanel()
    await flush()
    expect(w.text()).toContain('该任务尚未运行过') // aiTasksNoRuns
    w.unmount()
  })
})
