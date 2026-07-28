// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentRightPanel.vue(80 行)。SP8-P1c2
// Task 10。哑组件:props 进、emit 出,父组件(AgentPage,Task 13 接线)持有全部
// 状态。System/Resources 两个 tab 是后续任务(Task 11/12)的范围,本任务只保证
// 4 选 1 的分支结构和 Resources 是 v-else 兜底(未知 tab 值也落这里)与 Vue2 一致
// ——用 data-testid 占位标注,内容留给对应任务替换。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AgentRightPanel from './AgentRightPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: {
    zh_cn: {
      aiTabActivity: '活动',
      aiTabContext: '上下文',
      aiTabSystem: '系统',
      aiTabResources: '资源',
      aiActivityHeader: 'Agent 运行',
      aiActivityRunning: '运行中…',
      aiActivityWaiting: '等待',
      aiActivityEmpty: 'Agent 步骤将在运行时显示在这里',
      aiActivityDone: '完成',
      aiContextNotYet: '暂不可用',
      aiContextDesc: '未来会支持把文件加入对话上下文，让 Agent 直接参考它们。',
    },
  },
})

function mountPanel(props = {}) {
  return mount(AgentRightPanel, { props, global: { plugins: [i18n] } })
}

describe('AgentRightPanel', () => {
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
    expect(w.find('[data-testid="resources-tab-placeholder"]').exists()).toBe(true)
    expect(w.find('[data-testid="system-tab-placeholder"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'ActivityTab' }).exists()).toBe(false)
    expect(w.findComponent({ name: 'ContextTab' }).exists()).toBe(false)
  })

  it('四选一分支:activity/context/system 各自只渲染对应内容', () => {
    expect(mountPanel({ tab: 'activity' }).findComponent({ name: 'ActivityTab' }).exists()).toBe(true)
    expect(mountPanel({ tab: 'context' }).findComponent({ name: 'ContextTab' }).exists()).toBe(true)
    expect(mountPanel({ tab: 'system' }).find('[data-testid="system-tab-placeholder"]').exists()).toBe(true)
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

  it('12 个 props 均有合理默认值,空 props 挂载不炸', () => {
    expect(() => mountPanel()).not.toThrow()
  })
})
