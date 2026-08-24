// Ported from Vue2 TasksView.spec.js (the behaviorally load-bearing cases) +
// the M6 hand-off (?draft=1 + pendingDraft opens the editor prefilled).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  listTasks: vi.fn(),
  listTaskNotifyTargets: vi.fn(),
  updateTask: vi.fn(),
  runTaskNow: vi.fn(),
  deleteTask: vi.fn(),
  createTask: vi.fn(),
  cronPreview: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  listTaskRuns: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      listTasks: h.listTasks,
      listTaskNotifyTargets: h.listTaskNotifyTargets,
      updateTask: h.updateTask,
      runTaskNow: h.runTaskNow,
      deleteTask: h.deleteTask,
      createTask: h.createTask,
      cronPreview: h.cronPreview,
      listModels: h.listModels,
      listProviders: h.listProviders,
      listTaskRuns: h.listTaskRuns,
    },
  },
}))
const pushMock = vi.hoisted(() => vi.fn())
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useRoute: () => ({ query: routeQuery.value }),
}))

import TasksView from './TasksView.vue'
import { setPendingTaskDraft } from './pendingDraft'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

function task(over: Record<string, unknown> = {}) {
  return {
    id: 't1',
    name: 'Daily digest',
    trigger_type: 'cron',
    cron_expr: '0 9 * * *',
    enabled: 1,
    next_run_at: 1_800_000_000,
    last_run_at: 0,
    ...over,
  }
}

function mountView() {
  return mount(TasksView, {
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

describe('TasksView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    for (const fn of Object.values(h)) fn.mockReset()
    pushMock.mockReset()
    routeQuery.value = {}
    h.listTasks.mockResolvedValue({ tasks: [task()] })
    h.listTaskNotifyTargets.mockResolvedValue({ targets: [] })
    h.listTaskRuns.mockResolvedValue({ runs: [] })
    h.updateTask.mockResolvedValue({})
    h.runTaskNow.mockResolvedValue({})
    h.deleteTask.mockResolvedValue({})
    h.listModels.mockResolvedValue([])
    h.listProviders.mockResolvedValue([])
    h.cronPreview.mockResolvedValue({ next: [] })
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists tasks with name, trigger text and next run', async () => {
    const w = mountView()
    await flush()
    expect(w.text()).toContain('Daily digest')
    expect(w.text()).toContain('0 9 * * *')
    w.unmount()
  })

  it('enable toggle PUTs ONLY {enabled} — never the preauth document', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="task-enabled"] input, [data-test="task-enabled"]').trigger('click')
    await flush()
    expect(h.updateTask).toHaveBeenCalledTimes(1)
    const [id, body] = h.updateTask.mock.calls[0]
    expect(id).toBe('t1')
    expect(body).toEqual({ enabled: false })
    w.unmount()
  })

  it('run-now queues a run and says it ignores enabled', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="task-run-now"]').trigger('click')
    await flush()
    expect(h.runTaskNow).toHaveBeenCalledWith('t1')
    w.unmount()
  })

  it('delete flows through the AlertDialog confirm', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="task-delete"]').trigger('click')
    await flush()
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('删除') && b.closest('[role="alertdialog"]'),
    )
    expect(confirmBtn, 'AlertDialog confirm button should render').toBeTruthy()
    confirmBtn!.click()
    await flush()
    expect(h.deleteTask).toHaveBeenCalledWith('t1')
    w.unmount()
  })

  it('clicking the row toggles the runs panel', async () => {
    const w = mountView()
    await flush()
    expect(w.findComponent({ name: 'TaskRunsPanel' }).exists()).toBe(false)
    await w.find('[data-test="task-row"]').trigger('click')
    await flush()
    expect(h.listTaskRuns).toHaveBeenCalledWith('t1', 50)
    await w.find('[data-test="task-row"]').trigger('click')
    await flush()
    w.unmount()
  })

  it('?draft=1 consumes the pending draft and opens the editor prefilled', async () => {
    routeQuery.value = { draft: '1' }
    setPendingTaskDraft({ name: 'From chat', prompt: 'do it' })
    const w = mountView()
    await flush()
    const nameInput = w.find('[data-test="task-name"]')
    expect(nameInput.exists()).toBe(true)
    expect((nameInput.element as HTMLInputElement).value).toBe('From chat')
    w.unmount()
  })

  it('back button navigates to the agent page', async () => {
    const w = mountView()
    await flush()
    await w.find('.set-topbar .set-ibtn').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/ai/agent')
    w.unmount()
  })
})
