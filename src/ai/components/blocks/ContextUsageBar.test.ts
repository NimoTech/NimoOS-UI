// SP8-P1c1 Task 6 — 1:1 ported from Vue2 ContextUsageBar.spec.js:54-81 (rendering section).
// Pure geometry/formatting logic already has its own tests in contextUsage.ts, here only test component rendering.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import ContextUsageBar from './ContextUsageBar.vue'
import { RING_C } from '../../util/contextUsage'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('ContextUsageBar(ported from Vue2 ContextUsageBar.spec.js:54-81)', () => {
  it('render ok level, tooltip contains formatted token and percentage', () => {
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
  it('pct 75 → warn level', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 75 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('warn')
  })
  it('pct 95 → danger level', () => {
    const w = mount(ContextUsageBar, { props: { tokens: 1, window: 2, pct: 95 }, global: g })
    expect(w.find('.ctx-ring-arc').classes()).toContain('danger')
  })
})
