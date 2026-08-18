import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSwitch from './SettingsSwitch.vue'

describe('SettingsSwitch', () => {
  it('role=switch + aria-checked reflects modelValue', () => {
    const off = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(off.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    expect(off.find('.set-switch').classes()).not.toContain('on')
    const on = mount(SettingsSwitch, { props: { modelValue: true, label: '新闻源' } })
    expect(on.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(on.find('.set-switch').classes()).toContain('on')
  })

  it('uses label as aria-label (a purely graphical switch, no visible text)', () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: '新闻源' } })
    expect(w.find('[role="switch"]').attributes('aria-label')).toBe('新闻源')
  })

  it('click emits the negated value (controlled: does not change its own state)', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x' } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    // Controlled component: props unchanged, so the class must not change either
    expect(w.find('.set-switch').classes()).not.toContain('on')
  })

  it('does not emit when disabled', async () => {
    const w = mount(SettingsSwitch, { props: { modelValue: false, label: 'x', disabled: true } })
    await w.find('[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
