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

  it.each(SETTINGS_TABS.filter((t) => t !== 'terminal'))('%s 骨架渲染标题与空态位', (tab) => {
    const w = mount(PANEL_BY_TAB[tab], { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title,.set-back').exists()).toBe(true)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('terminal 骨架无标题(对位 Vue2 L51)', () => {
    const w = mount(PANEL_BY_TAB.terminal, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-head').exists()).toBe(false)
    expect(w.find('.set-skeleton').exists()).toBe(true)
  })

  it('developer 骨架用返回按钮而不是标题(对位 Vue2 L52-56)', () => {
    const w = mount(PANEL_BY_TAB.developer, { global: { plugins: [i18n] } })
    expect(w.find('.set-back').exists()).toBe(true)
    expect(w.find('.set-section-title').exists()).toBe(false)
  })

  it('developer 的返回按钮向上冒泡 open-tab general', async () => {
    const w = mount(PANEL_BY_TAB.developer, { global: { plugins: [i18n] } })
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('general 骨架带 developer 入口行,点击 emit open-tab developer(对位 Vue2 L315)', async () => {
    const w = mount(PANEL_BY_TAB.general, { global: { plugins: [i18n] } })
    const row = w.find('.set-dev-entry')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(w.emitted('open-tab')).toEqual([['developer']])
  })

  it('骨架的文案 key 都有译文(没有渲染出裸 key)', () => {
    const w = mount(PANEL_BY_TAB.network, { global: { plugins: [i18n] } })
    expect(w.find('.set-section-title').text()).toBe('网络')
    expect(w.find('.set-skeleton').text()).not.toMatch(/^settings/)
  })
})
