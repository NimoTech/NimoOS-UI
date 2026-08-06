// SP8-P1c1 Task 6 —— 1:1 移植自 Vue2 ContextUsageBar.spec.js:54-81(rendering 部分)。
// 纯几何/格式化逻辑已在 contextUsage.ts 里有自己的测试，此处只测组件渲染。
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import ContextUsageBar from './ContextUsageBar.vue'
import { RING_C } from '../../util/contextUsage'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('ContextUsageBar(移植 Vue2 ContextUsageBar.spec.js:54-81)', () => {
  it('渲染 ok 档，提示里带格式化 token 与百分比', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 48000, window: 200000, pct: 24 }, global: g })
    const arc = w.find('.ctx-ring-arc')
    expect(arc.exists()).toBe(true)
    expect(arc.classes()).toContain('ok')
    expect(arc.attributes('stroke-dasharray')).toBe(`${((24 / 100) * RING_C).toFixed(2)} ${RING_C.toFixed(2)}`)
    const tip = w.find('.ctx-usage-tip').text()
    expect(tip).toContain('48K')
    expect(tip).toContain('200K')
    expect(tip).toContain('24%')
  })
  it('pct 75 → warn 档', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 75 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('warn')
  })
  it('pct 95 → danger 档', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 95 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('danger')
  })
})
