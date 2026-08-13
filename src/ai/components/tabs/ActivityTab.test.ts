// 1:1 port from Vue2 src/views/AI/Agent/tabs/ActivityTab.vue (55 lines). SP8-P1c2 Task 10.
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
  it('success step displays formatDuration result', () => {
    const w = mountTab({ steps: [{ id: 1, name: '搜索文件', state: 'success', durationMs: 4500 }] })
    expect(w.find('.activity-title').text()).toBe('搜索文件')
    expect(w.find('.activity-meta').text()).toBe('4.5s')
    expect(w.find('.activity-bullet').attributes('data-state')).toBe('success')
  })

  it('success but durationMs missing (falsy not 0) → show "Done"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '整理', state: 'success' }] })
    expect(w.find('.activity-meta').text()).toBe('完成')
  })

  it('running step shows "Running…"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '扫描磁盘', state: 'running' }] })
    expect(w.find('.activity-meta').text()).toBe('运行中…')
  })

  it('other states (e.g. pending) show "Waiting"', () => {
    const w = mountTab({ steps: [{ id: 1, name: '排队中', state: 'pending' }] })
    expect(w.find('.activity-meta').text()).toBe('等待')
  })

  it('busy with no steps → show dots loading state + "Running…"', () => {
    const w = mountTab({ steps: [], busy: true })
    expect(w.find('.dots').exists()).toBe(true)
    expect(w.find('.dots').findAll('span').length).toBe(3)
    expect(w.text()).toContain('运行中…')
  })

  it('no steps and not busy → empty state icon + hint text', () => {
    const w = mountTab({ steps: [], busy: false })
    expect(w.find('.dots').exists()).toBe(false)
    expect(w.text()).toContain('Agent 步骤将在运行时显示在这里')
    // AgentIcon name="layers" 渲染为 svg
    expect(w.find('svg').exists()).toBe(true)
  })

  it('header title always shows "Agent Execution" (aiActivityHeader)', () => {
    const w = mountTab()
    expect(w.text()).toContain('Agent 运行')
  })
})
