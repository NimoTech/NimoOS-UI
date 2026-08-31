// 1:1 port from Vue2 src/views/AI/Agent/tabs/ContextTab.vue (16 lines) — pure placeholder panel.
// This is a placeholder "not yet supported" in Vue2,
// do not implement the real "add files to context" feature while you're at it, port as-is.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ContextTab from './ContextTab.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: {
    zh_cn: {
      aiContextNotYet: '暂不可用',
      aiContextDesc: '未来会支持把文件加入对话上下文，让 Agent 直接参考它们。',
    },
  },
})

describe('ContextTab', () => {
  it('renders placeholder text (title + description) + empty state icon', () => {
    const w = mount(ContextTab, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('暂不可用')
    expect(w.text()).toContain('未来会支持把文件加入对话上下文，让 Agent 直接参考它们。')
    expect(w.find('svg').exists()).toBe(true)
  })
})
