// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/ContextTab.vue(16 行)——纯占位面板。
// SP8-P1c2 Task 10 brief 明确:这是 Vue2 里本来就"尚未支持"的占位,不要顺手实现
// 真正的"加文件到上下文"功能,原样港过来即可。
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
  it('渲染占位文案(标题 + 说明句)+ 空态图标', () => {
    const w = mount(ContextTab, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('暂不可用')
    expect(w.text()).toContain('未来会支持把文件加入对话上下文，让 Agent 直接参考它们。')
    expect(w.find('svg').exists()).toBe(true)
  })
})
