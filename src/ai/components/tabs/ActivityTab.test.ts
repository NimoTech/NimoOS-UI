// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ActivityTab.vue(55 行)。SP8-P1c2 Task 10。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ActivityTab from './ActivityTab.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: {
    zh_cn: {
      aiActivityHeader: 'Agent 运行',
      aiActivityRunning: '运行中…',
      aiActivityWaiting: '等待',
      aiActivityEmpty: 'Agent 步骤将在运行时显示在这里',
      aiActivityDone: '完成',
    },
  },
})

function mountTab(props = {}) {
  return mount(ActivityTab, { props, global: { plugins: [i18n] } })
}

describe('ActivityTab', () => {
  it('success 步骤显示 formatDuration 的结果', () => {
    const w = mountTab({ steps: [{ id: 1, name: '搜索文件', state: 'success', durationMs: 4500 }] })
    expect(w.find('.activity-title').text()).toBe('搜索文件')
    expect(w.find('.activity-meta').text()).toBe('4.5s')
    expect(w.find('.activity-bullet').attributes('data-state')).toBe('success')
  })

  it('success 但 durationMs 缺失(falsy 非 0)→ 显示"完成"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '整理', state: 'success' }] })
    expect(w.find('.activity-meta').text()).toBe('完成')
  })

  it('running 步骤显示"运行中…"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '扫描磁盘', state: 'running' }] })
    expect(w.find('.activity-meta').text()).toBe('运行中…')
  })

  it('其余状态(如 pending)显示"等待"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '排队中', state: 'pending' }] })
    expect(w.find('.activity-meta').text()).toBe('等待')
  })

  it('busy 且无步骤 → 显示 dots 载入态 + "运行中…"', () => {
    const w = mountTab({ steps: [], busy: true })
    expect(w.find('.dots').exists()).toBe(true)
    expect(w.find('.dots').findAll('span').length).toBe(3)
    expect(w.text()).toContain('运行中…')
  })

  it('无步骤且不 busy → 空态图标 + 提示文案', () => {
    const w = mountTab({ steps: [], busy: false })
    expect(w.find('.dots').exists()).toBe(false)
    expect(w.text()).toContain('Agent 步骤将在运行时显示在这里')
    // AgentIcon name="layers" 渲染为 svg
    expect(w.find('svg').exists()).toBe(true)
  })

  it('头部标题固定显示 "Agent 运行"(aiActivityHeader)', () => {
    const w = mountTab()
    expect(w.text()).toContain('Agent 运行')
  })
})
