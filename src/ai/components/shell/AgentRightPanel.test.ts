// 1:1 ported from Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue (80 lines). SP8-P1c2
// Task 10 built the shell, Task 13 replaced the SystemTab/ResourcesTab placeholder divs
// with the real components.
// Dumb component: props in, emit out, the parent (AgentPage) holds all state.
//
// Starting with Task 13, tab='system' actually mounts SystemTab — its internal
// useUtilization() needs Pinia + service.sys.getUtilization + a MessageBus subscription,
// so the same three-piece mock as SystemTab.test.ts is added here; i18n was also switched
// from a hand-written subset to the full zh_cn (ResourcesTab uses dozens of keys).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const getUtilization = vi.hoisted(() => vi.fn())
const attachmentRawUrl = vi.hoisted(() => vi.fn(() => '/raw/1'))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { sys: { getUtilization }, ai: { attachmentRawUrl } } }
})
vi.mock('../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: vi.fn(() => () => {}) }),
}))

import AgentRightPanel from './AgentRightPanel.vue'
import SystemTab from '../tabs/SystemTab.vue'
import ResourcesTab from '../tabs/ResourcesTab.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountPanel(props = {}) {
  return mount(AgentRightPanel, { props, global: { plugins: [i18n] } })
}

describe('AgentRightPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getUtilization.mockReset()
    getUtilization.mockResolvedValue({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })
    attachmentRawUrl.mockClear()
  })

  it('collapsed=true → does not render (v-if="!collapsed")', () => {
    const w = mountPanel({ collapsed: true })
    expect(w.find('aside.rightpanel').exists()).toBe(false)
  })

  it('collapsed=false (default) → renders <aside class="rightpanel">', () => {
    const w = mountPanel({ collapsed: false })
    expect(w.find('aside.rightpanel').exists()).toBe(true)
  })

  it('each of the 4 tab buttons emits set-tab on click', async () => {
    const w = mountPanel()
    const buttons = w.findAll('.right-tab')
    expect(buttons.length).toBe(4)
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    await buttons[3].trigger('click')
    expect(w.emitted('set-tab')).toEqual([['activity'], ['context'], ['system'], ['resources']])
  })

  it('data-active reflects the current tab', () => {
    const w = mountPanel({ tab: 'context' })
    const buttons = w.findAll('.right-tab')
    expect(buttons[0].attributes('data-active')).toBe('false')
    expect(buttons[1].attributes('data-active')).toBe('true')
  })

  it('an unknown tab value lands on Resources (v-else fallback, matches Vue2 verbatim)', () => {
    const w = mountPanel({ tab: 'nonexistent-tab' })
    expect(w.findComponent(ResourcesTab).exists()).toBe(true)
    expect(w.findComponent(SystemTab).exists()).toBe(false)
    expect(w.findComponent({ name: 'ActivityTab' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(false)
  })

  it('one-of-four branch: activity/context/system/resources each render only their own content', () => {
    const activity = mountPanel({ tab: 'activity' })
    expect(activity.findComponent({ name: 'ActivityTab' }).exists()).toBe(true)
    expect(activity.findComponent(SystemTab).exists()).toBe(false)
    expect(activity.findComponent(ResourcesTab).exists()).toBe(false)

    const context = mountPanel({ tab: 'context' })
    expect(context.findComponent({ name: 'ContextTab' }).exists()).toBe(true)
    expect(context.findComponent(SystemTab).exists()).toBe(false)

    // Task 13: the former data-testid="system-tab-placeholder" placeholder div has been replaced by the real SystemTab.
    const system = mountPanel({ tab: 'system' })
    expect(system.findComponent(SystemTab).exists()).toBe(true)
    expect(system.findComponent(ResourcesTab).exists()).toBe(false)
    expect(system.find('[data-testid="system-tab-placeholder"]').exists()).toBe(false)

    const resources = mountPanel({ tab: 'resources' })
    expect(resources.findComponent(ResourcesTab).exists()).toBe(true)
    expect(resources.findComponent(SystemTab).exists()).toBe(false)
    expect(resources.find('[data-testid="resources-tab-placeholder"]').exists()).toBe(false)
  })

  it('Task 13: the storage prop is passed straight through to SystemTab (systemMetrics is intentionally absent — SystemTab fetches its own real-time data)', () => {
    const storage = { used: 5, total: 12, breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }], label: 'NAS' }
    const w = mountPanel({ tab: 'system', storage })
    const sys = w.findComponent(SystemTab)
    expect(sys.props('storage')).toEqual(storage)
    // Vue2 AgentRightPanel.vue:48 has a systemMetrics prop; intentionally dropped here (see the component comment).
    expect(Object.keys(sys.props())).not.toContain('systemMetrics')
    expect(Object.keys(w.props())).not.toContain('systemMetrics')
  })

  it('Task 13: all 7 props are passed straight through to ResourcesTab one by one (Vue2 AgentRightPanel.vue:16-24)', () => {
    const props = {
      tab: 'resources',
      sessionId: 'sess-1',
      visibleResources: [{ id: 'r1', path: '/DATA/a', kind: 'file' }],
      attachments: [{ id: 'a1', filename: 'x.txt' }],
      stagedChanges: [{ run_id: 'run1', created_at: 0, items: [{ seq: 1, op: 'write', path: '/DATA/a' }] }],
      busy: true,
      committing: true,
      reverting: { run1: true },
    }
    const rt = mountPanel(props).findComponent(ResourcesTab)
    expect(rt.props('sessionId')).toBe('sess-1')
    expect(rt.props('visibleResources')).toEqual(props.visibleResources)
    expect(rt.props('attachments')).toEqual(props.attachments)
    expect(rt.props('stagedChanges')).toEqual(props.stagedChanges)
    expect(rt.props('busy')).toBe(true)
    expect(rt.props('committing')).toBe(true)
    expect(rt.props('reverting')).toEqual({ run1: true })
  })

  it('Task 13: the 6 emits from ResourcesTab are forwarded as-is (Vue2 AgentRightPanel.vue:25-30)', () => {
    const w = mountPanel({ tab: 'resources' })
    const rt = w.findComponent(ResourcesTab)
    rt.vm.$emit('remove-resource', 'r1')
    rt.vm.$emit('remove-attachment', 'a1')
    rt.vm.$emit('revert-run', 'run1')
    rt.vm.$emit('revert-batch', 'batch1')
    rt.vm.$emit('revert-item', 'staged1')
    rt.vm.$emit('commit-all')
    expect(w.emitted('remove-resource')).toEqual([['r1']])
    expect(w.emitted('remove-attachment')).toEqual([['a1']])
    expect(w.emitted('revert-run')).toEqual([['run1']])
    expect(w.emitted('revert-batch')).toEqual([['batch1']])
    expect(w.emitted('revert-item')).toEqual([['staged1']])
    expect(w.emitted('commit-all')).toEqual([[]])
  })

  // F1 (final-review opus pass) — the 7th emit, forwarded as-is to the parent (AgentPage).
  it('F1: the remove-resource-by-path emit from ResourcesTab is forwarded as-is', () => {
    const w = mountPanel({ tab: 'resources' })
    const rt = w.findComponent(ResourcesTab)
    rt.vm.$emit('remove-resource-by-path', '/DATA/streamed-dir')
    expect(w.emitted('remove-resource-by-path')).toEqual([['/DATA/streamed-dir']])
  })

  it('the Resources button shows .badge-pending with the correct value when pendingCount > 0', () => {
    const w = mountPanel({
      stagedChanges: [
        { run_id: 1, created_at: 0, items: [{ seq: 1 }, { seq: 2 }] },
        { run_id: 2, created_at: 0, items: [{ seq: 3 }] },
      ],
    })
    const badge = w.find('.badge-pending')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
  })

  it('the badge is not shown when pendingCount === 0 (default empty array)', () => {
    const w = mountPanel()
    expect(w.find('.badge-pending').exists()).toBe(false)
  })

  it('does not blow up when a group in stagedChanges is missing its items array, counts it as 0', () => {
    const w = mountPanel({
      stagedChanges: [
        { run_id: 1, created_at: 0, items: [{ seq: 1 }] },
        // Missing items — a streamed group may be pushed before its items are filled in; the brief explicitly requires tolerating this.
        { run_id: 2, created_at: 0 },
      ],
    })
    expect(w.find('.badge-pending').text()).toBe('1')
  })

  // Task 13: with systemMetrics removed, props went from 12 down to 11.
  it('all 11 props have sensible defaults, mounting with empty props does not blow up', () => {
    // F4 fix (final-review opus pass) — the original `expect(() => mountPanel()).not.toThrow()`
    // was a tautology: a synchronous mount never throws anyway, and an async rejection wouldn't
    // hit this assertion either, so it was removed. The real assertion below (the props count)
    // is kept.
    expect(Object.keys(mountPanel().props()).length).toBe(11)
  })
})
