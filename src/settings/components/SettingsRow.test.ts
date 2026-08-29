import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsRow from './SettingsRow.vue'

describe('SettingsRow', () => {
  it('renders the label and the right-side control slot', () => {
    const w = mount(SettingsRow, { props: { label: '壁纸' }, slots: { control: '<b class="x">ctl</b>' } })
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.x').exists()).toBe(true)
  })

  it('renders the subtitle only when sub is given', () => {
    expect(mount(SettingsRow, { props: { label: 'a' } }).find('.set-row-sub').exists()).toBe(false)
    expect(mount(SettingsRow, { props: { label: 'a', sub: 'v1.0' } }).find('.set-row-sub').text()).toBe('v1.0')
  })

  it('root element is a div and not focusable when not clickable', () => {
    const w = mount(SettingsRow, { props: { label: 'a' } })
    expect(w.find('button.set-list-item').exists()).toBe(false)
    expect(w.find('.set-chevron').exists()).toBe(false)
  })

  it('root element is a button with a chevron when clickable, clicking emits click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.exists()).toBe(true)
    expect(w.find('.set-chevron').exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('a disabled clickable row both carries the disabled attribute and truly does not emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true, disabled: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.attributes('disabled')).toBeDefined()
    // Asserting the attribute alone is not enough: @vue/test-utils trigger still
    // dispatches on disabled elements, so actually click once to verify the
    // component's internal disabled guard is also in place.
    await btn.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('hint slot renders below the row (the wallpaper D5 / language D6 caption slot)', () => {
    const w = mount(SettingsRow, { props: { label: 'a' }, slots: { hint: '暂不可用' } })
    expect(w.find('.set-row-hint').text()).toBe('暂不可用')
  })
})
