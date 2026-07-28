import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ThinkingBar from './ThinkingBar.vue'

// Vue2 src/views/AI/Agent/shell/ThinkingBar.vue(105 行)逐字港。
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
  it('不支持时:根 class 带 disabled,开关与强度选择器均 disabled，且显示不支持提示', () => {
    const w = mountBar({ supportsThinking: false })
    expect(w.classes()).toContain('disabled')
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(w.find('select').attributes('disabled')).toBeDefined()
    expect(w.find('.unsupported-note').text()).toBe('该模型不支持思考')
    expect(w.find('.provider-note').exists()).toBe(false)
  })

  it('支持但关闭时:开关可用，强度选择器仍 disabled', () => {
    const w = mountBar({ supportsThinking: true, enabled: false })
    expect(w.classes()).not.toContain('disabled')
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeUndefined()
    expect(w.find('select').attributes('disabled')).toBeDefined()
    expect(w.find('.unsupported-note').exists()).toBe(false)
  })

  it('支持且开启时:两个控件都可用', () => {
    const w = mountBar({ supportsThinking: true, enabled: true })
    expect(w.find('input[type="checkbox"]').attributes('disabled')).toBeUndefined()
    expect(w.find('select').attributes('disabled')).toBeUndefined()
  })

  it('勾选开关 emit update:enabled(勾选后的值)', async () => {
    const w = mountBar({ supportsThinking: true, enabled: false })
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.emitted('update:enabled')?.[0]).toEqual([true])
  })

  it('切换强度 emit update:level(选中的值)', async () => {
    const w = mountBar({ supportsThinking: true, enabled: true, level: 'medium' })
    await w.find('select').setValue('high')
    expect(w.emitted('update:level')?.[0]).toEqual(['high'])
  })

  it('providerType 为 deepseek 时显示 DeepSeek 说明；其它 providerType 不显示', () => {
    const withNote = mountBar({ supportsThinking: true, providerType: 'deepseek' })
    expect(withNote.find('.provider-note').text()).toBe(
      'DeepSeek 上「低/中」以及「高/极高」行为分别相同',
    )

    const withoutNote = mountBar({ supportsThinking: true, providerType: 'openai' })
    expect(withoutNote.find('.provider-note').exists()).toBe(false)
    expect(withoutNote.find('.unsupported-note').exists()).toBe(false)
  })

  it('F4 补测:supportsThinking=false 且 providerType=deepseek 同时成立时,只显示不支持提示,DeepSeek 说明不显示(v-if/v-else-if 互斥)', () => {
    const w = mountBar({ supportsThinking: false, providerType: 'deepseek' })
    expect(w.find('.unsupported-note').exists()).toBe(true)
    expect(w.find('.unsupported-note').text()).toBe('该模型不支持思考')
    expect(w.find('.provider-note').exists()).toBe(false)
  })

  it('props 默认值:enabled=true, level=medium, supportsThinking=false, providerType=""', () => {
    const w = mountBar()
    expect(w.classes()).toContain('disabled')
    expect((w.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    expect((w.find('select').element as HTMLSelectElement).value).toBe('medium')
  })

  it('强度选项 4 档:low/medium/high/max，文案对应低/中/高/极高', () => {
    const w = mountBar({ supportsThinking: true })
    const options = w.findAll('option')
    expect(options.map((o) => o.element.value)).toEqual(['low', 'medium', 'high', 'max'])
    expect(options.map((o) => o.text())).toEqual(['低', '中', '高', '极高'])
  })
})
