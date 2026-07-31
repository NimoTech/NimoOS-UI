import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'

describe('SettingsSection', () => {
  it('给 title 时渲染 h1 标题', () => {
    const w = mount(SettingsSection, { props: { title: '通用' } })
    expect(w.find('.set-section-title').text()).toBe('通用')
    expect(w.find('.set-back').exists()).toBe(false)
  })

  it('不给 title 也不给 backTo 时不渲染头部(对位 Vue2 terminal 无标题, L51)', () => {
    const w = mount(SettingsSection)
    expect(w.find('.set-section-head').exists()).toBe(false)
  })

  it('给 backTo 时渲染返回按钮而不是 h1(对位 Vue2 developer, L52-56)', () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    expect(w.find('.set-section-title').exists()).toBe(false)
    expect(w.find('.set-back').text()).toContain('开发者模式')
  })

  it('点返回按钮 emit back 并带上目标 tab', async () => {
    const w = mount(SettingsSection, { props: { title: '开发者模式', backTo: 'general' } })
    await w.find('.set-back').trigger('click')
    expect(w.emitted('back')).toEqual([['general']])
  })

  it('默认 slot 渲染进内容区', () => {
    const w = mount(SettingsSection, {
      props: { title: 'x' },
      slots: { default: '<p class="probe">hi</p>' },
    })
    expect(w.find('.set-section-body .probe').text()).toBe('hi')
  })
})
