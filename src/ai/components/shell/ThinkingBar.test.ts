import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ThinkingBar from './ThinkingBar.vue'

// 1:1 verbatim port of Vue2 src/views/AI/Agent/shell/ThinkingBar.vue (105 lines).
const messages = {
  zh_cn: {
    aiThinkingLabel: '思考',
    aiThinkingIntensity: '强度',
    aiThinkingLow: '低',
    aiThinkingMedium: '中',
    aiThinkingHigh: '高',
    aiThinkingMax: '极高',
    aiThinkingUnsupported: '该模型不支持思考',
    aiThinkingDeepseekNote: 'DeepSeek 上「低/中」以及「高/极高」行为分别相同',
  },
}
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

function mountBar(props = {}) {
  return mount(ThinkingBar, {
    props,
    global: { plugins: [i18n] },
  })
}

describe('ThinkingBar', () => {
  it('when unsupported: the root class carries disabled, both the toggle and the intensity selector are disabled, and the unsupported hint is shown', () => {
    const w = mountBar({ supportsThinking: false })
    expect(w.classes()).toContain('disabled')
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(w.find('select').attributes('disabled')).toBeDefined()
    expect(w.find('.unsupported-note').text()).toBe('该模型不支持思考')
    expect(w.find('.provider-note').exists()).toBe(false)
  })

  it('when supported but off: the toggle is enabled, the intensity selector is still disabled', () => {
    const w = mountBar({ supportsThinking: true, enabled: false })
    expect(w.classes()).not.toContain('disabled')
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeUndefined()
    expect(w.find('select').attributes('disabled')).toBeDefined()
    expect(w.find('.unsupported-note').exists()).toBe(false)
  })

  it('when supported and on: both controls are enabled', () => {
    const w = mountBar({ supportsThinking: true, enabled: true })
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeUndefined()
    expect(w.find('select').attributes('disabled')).toBeUndefined()
  })

  it('checking the toggle emits update:enabled (the value after checking)', async () => {
    const w = mountBar({ supportsThinking: true, enabled: false })
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.emitted('update:enabled')?.[0]).toEqual([true])
  })

  it('changing the intensity emits update:level (the selected value)', async () => {
    const w = mountBar({ supportsThinking: true, enabled: true, level: 'medium' })
    await w.find('select').setValue('high')
    expect(w.emitted('update:level')?.[0]).toEqual(['high'])
  })

  it('when providerType is deepseek the DeepSeek note is shown; other providerType values do not show it', () => {
    const withNote = mountBar({ supportsThinking: true, providerType: 'deepseek' })
    expect(withNote.find('.provider-note').text()).toBe(
      'DeepSeek 上「低/中」以及「高/极高」行为分别相同',
    )

    const withoutNote = mountBar({ supportsThinking: true, providerType: 'openai' })
    expect(withoutNote.find('.provider-note').exists()).toBe(false)
    expect(withoutNote.find('.unsupported-note').exists()).toBe(false)
  })

  it('F4 supplemental test: when supportsThinking=false and providerType=deepseek both hold, only the unsupported hint is shown, the DeepSeek note is not shown (v-if/v-else-if are mutually exclusive)', () => {
    const w = mountBar({ supportsThinking: false, providerType: 'deepseek' })
    expect(w.find('.unsupported-note').exists()).toBe(true)
    expect(w.find('.unsupported-note').text()).toBe('该模型不支持思考')
    expect(w.find('.provider-note').exists()).toBe(false)
  })

  it('props defaults: enabled=true, level=medium, supportsThinking=false, providerType=""', () => {
    const w = mountBar()
    expect(w.classes()).toContain('disabled')
    expect((w.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    expect((w.find('select').element as HTMLSelectElement).value).toBe('medium')
  })

  it('4 intensity levels: low/medium/high/max, copy corresponds to 低/中/高/极高', () => {
    const w = mountBar({ supportsThinking: true })
    const options = w.findAll('option')
    expect(options.map((o) => o.element.value)).toEqual(['low', 'medium', 'high', 'max'])
    expect(options.map((o) => o.text())).toEqual(['低', '中', '高', '极高'])
  })
})
