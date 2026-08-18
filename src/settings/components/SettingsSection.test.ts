import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'

describe('SettingsSection', () => {
  it('renders an h1 title when title is given', () => {
    const w = mount(SettingsSection, { props: { title: '通用' } })
    expect(w.find('.set-section-title').text()).toBe('通用')
    expect(w.find('.set-back').exists()).toBe(false)
  })

  it('renders no header when neither title nor backTo is given (mirrors Vue2 terminal with no title, L51)', () => {
    const w = mount(SettingsSection)
    expect(w.find('.set-section-head').exists()).toBe(false)
  })

  it('renders a back button instead of h1 when backTo is given (mirrors Vue2 developer, L52-56)', () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    expect(w.find('.set-section-title').exists()).toBe(false)
    expect(w.find('.set-back').text()).toContain('开发者模式')
  })

  it('clicking the back button emits back with the target tab', async () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    await w.find('.set-back').trigger('click')
    expect(w.emitted('back')).toEqual([['general']])
  })

  it('default slot renders into the content area', () => {
    const w = mount(SettingsSection, {
      props: { title: 'x' },
      slots: { default: '<p class="probe">hi</p>' },
    })
    expect(w.find('.set-section-body .probe').text()).toBe('hi')
  })
})
