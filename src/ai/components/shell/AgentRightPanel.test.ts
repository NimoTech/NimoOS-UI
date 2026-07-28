// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue(80 行)。SP8-P1c2
// Task 10 建壳、Task 13 把 SystemTab/ResourcesTab 两个占位 div 换成真组件。
// 哑组件:props 进、emit 出,父组件(AgentPage)持有全部状态。
//
// Task 13 起 tab='system' 会真的挂 SystemTab —— 它内部 useUtilization() 要 Pinia +
// service.sys.getUtilization + MessageBus 订阅,故这里补上与 SystemTab.test.ts 同款
// 的三件套 mock;i18n 也从手写子集换成整份 zh_cn(ResourcesTab 用到几十个键)。
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

  it('collapsed=true → 不渲染(v-if="!collapsed")', () => {
    const w = mountPanel({ collapsed: true })
    expect(w.find('aside.rightpanel').exists()).toBe(false)
  })

  it('collapsed=false(默认)→ 渲染 <aside class="rightpanel">', () => {
    const w = mountPanel({ collapsed: false })
    expect(w.find('aside.rightpanel').exists()).toBe(true)
  })

  it('4 个 tab 按钮点击各自 emit set-tab', async () => {
    const w = mountPanel()
    const buttons = w.findAll('.right-tab')
    expect(buttons.length).toBe(4)
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    await buttons[3].trigger('click')
    expect(w.emitted('set-tab')).toEqual([['activity'], ['context'], ['system'], ['resources']])
  })

  it('data-active 反映当前 tab', () => {
    const w = mountPanel({ tab: 'context' })
    const buttons = w.findAll('.right-tab')
    expect(buttons[0].attributes('data-active')).toBe('false')
    expect(buttons[1].attributes('data-active')).toBe('true')
  })

  it('未知 tab 值落 Resources(v-else 兜底,与 Vue2 逐字一致)', () => {
    const w = mountPanel({ tab: 'nonexistent-tab' })
    expect(w.findComponent(ResourcesTab).exists()).toBe(true)
    expect(w.findComponent(SystemTab).exists()).toBe(false)
    expect(w.findComponent({ name: 'ActivityTab' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(false)
  })

  it('四选一分支:activity/context/system/resources 各自只渲染对应内容', () => {
    const activity = mountPanel({ tab: 'activity' })
    expect(activity.findComponent({ name: 'ActivityTab' }).exists()).toBe(true)
    expect(activity.findComponent(SystemTab).exists()).toBe(false)
    expect(activity.findComponent(ResourcesTab).exists()).toBe(false)

    const context = mountPanel({ tab: 'context' })
    expect(context.findComponent({ name: 'ContextTab' }).exists()).toBe(true)
    expect(context.findComponent(SystemTab).exists()).toBe(false)

    // Task 13:曾经的 data-testid="system-tab-placeholder" 占位 div 已换成真 SystemTab。
    const system = mountPanel({ tab: 'system' })
    expect(system.findComponent(SystemTab).exists()).toBe(true)
    expect(system.findComponent(ResourcesTab).exists()).toBe(false)
    expect(system.find('[data-testid="system-tab-placeholder"]').exists()).toBe(false)

    const resources = mountPanel({ tab: 'resources' })
    expect(resources.findComponent(ResourcesTab).exists()).toBe(true)
    expect(resources.findComponent(SystemTab).exists()).toBe(false)
    expect(resources.find('[data-testid="resources-tab-placeholder"]').exists()).toBe(false)
  })

  it('Task 13:storage prop 直传 SystemTab(systemMetrics 有意不存在——SystemTab 自取实时数据)', () => {
    const storage = { used: 5, total: 12, breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }], label: 'NAS' }
    const w = mountPanel({ tab: 'system', storage })
    const sys = w.findComponent(SystemTab)
    expect(sys.props('storage')).toEqual(storage)
    // Vue2 AgentRightPanel.vue:48 有 systemMetrics prop,本仓有意删掉(见组件注释)。
    expect(Object.keys(sys.props())).not.toContain('systemMetrics')
    expect(Object.keys(w.props())).not.toContain('systemMetrics')
  })

  it('Task 13:7 个 prop 逐条直传 ResourcesTab(Vue2 AgentRightPanel.vue:16-24)', () => {
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

  it('Task 13:ResourcesTab 的 6 个 emit 原样上抛(Vue2 AgentRightPanel.vue:25-30)', () => {
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

  // F1(终审 opus 复查)—— 第 7 个 emit,原样透传给父组件(AgentPage)。
  it('F1:ResourcesTab 的 remove-resource-by-path 原样上抛', () => {
    const w = mountPanel({ tab: 'resources' })
    const rt = w.findComponent(ResourcesTab)
    rt.vm.$emit('remove-resource-by-path', '/DATA/streamed-dir')
    expect(w.emitted('remove-resource-by-path')).toEqual([['/DATA/streamed-dir']])
  })

  it('pendingCount > 0 时 Resources 按钮显示 .badge-pending 且数值正确', () => {
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

  it('pendingCount === 0(默认空数组)时不显示角标', () => {
    const w = mountPanel()
    expect(w.find('.badge-pending').exists()).toBe(false)
  })

  it('stagedChanges 里某组缺 items 数组时不炸,按 0 计入', () => {
    const w = mountPanel({
      stagedChanges: [
        { run_id: 1, created_at: 0, items: [{ seq: 1 }] },
        // 缺 items —— 流式建组时可能先 push 组再补 items,brief 明确要求容错。
        { run_id: 2, created_at: 0 },
      ],
    })
    expect(w.find('.badge-pending').text()).toBe('1')
  })

  // Task 13:systemMetrics 删除后 props 从 12 个降到 11 个。
  it('11 个 props 均有合理默认值,空 props 挂载不炸', () => {
    // F4 修复(终审 opus 复查)—— 原有 `expect(() => mountPanel()).not.toThrow()`
    // 是同义反复:同步挂载本来就不会抛,异步 rejection 也不经这条断言,删掉。
    // 下面这条真断言(props 计数)保留。
    expect(Object.keys(mountPanel().props()).length).toBe(11)
  })
})
