import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { SETTINGS_TABS } from '../util/tabs'
import { PANEL_BY_TAB } from './index'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: { ...zh, ...zhSp9 } },
})

describe('9 个 tab 骨架', () => {
  it('每个 tab 都能取到一个组件', () => {
    for (const t of SETTINGS_TABS) {
      expect(PANEL_BY_TAB[t], t).toBeTruthy()
    }
    expect(Object.keys(PANEL_BY_TAB)).toHaveLength(9)
  })

  // P1 起 general 已填真实内容(见 GeneralPanel.integration.test.ts),不再有 .set-skeleton;
  // developer 从 Task 11 起也填了真实内容(见 DeveloperPanel.test.ts),同样不再是纯骨架。
  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal' && t !== 'general' && t !== 'developer'))('%s 骨架渲染标题与空态位', (tab) => {
    const w = mount(PANEL_BY_TAB[tab], { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title,.set-back').exists()).toBe(true)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('terminal 骨架无标题(对位 Vue2 L51)', () => {
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  // developer 的「返回按钮代替标题 / 点击冒泡 open-tab general」用例已迁到
  // DeveloperPanel.test.ts —— 该组件从 Task 11 起会打真实接口(getSSLConfig 等),
  // panels.test.ts 保持零 mock 的纯骨架测试(同 general 的既有先例,见上)。

  // general 的「developer 入口行仍在最后并能 emit open-tab」用例已迁到
  // GeneralPanel.integration.test.ts —— 该组件从 P1 起会打真实接口,
  // panels.test.ts 保持零 mock 的纯骨架测试(见任务简报 Step 4)。

  it('骨架的文案 key 都有译文(没有渲染出裸 key)', () => {
    const w = mount(PANEL_BY_TAB.network, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title').text()).toBe('网络')
    expect(w.find('.set-skeleton').text()).not.toMatch(/^settings/)
  })
})
