import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSwitch from './SettingsSwitch.vue'

describe('SettingsSwitch', () => {
  it('role=switch + aria-checked 反映 modelValue', () => {
    const off = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(off.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(off.find('.set-switch').classes()).not.toContain('on')
    const on = mount(SettingsSwitch, { props: { modelValue: true, label: '新闻源' } })
    expect(on.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(on.find('.set-switch').classes()).toContain('on')
  })

  it('用 label 作 aria-label(纯图形开关,没有可见文字)', () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(w.find('[role="switch"]').attributes('aria-label')).toBe('新闻源')
  })

  it('点击 emit 取反后的值(受控:自己不改状态)', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x' } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    // Controlled component: props unchanged, so the class must not change either
    expect(w.find('.set-switch').classes()).not.toContain('on')
  })

  it('disabled 时不 emit', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x', disabled: true } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
