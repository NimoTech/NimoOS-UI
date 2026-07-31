import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsRow from './SettingsRow.vue'

describe('SettingsRow', () => {
  it('渲染标签与右侧控件插槽', () => {
    const w = mount(SettingsRow, { props: { label: '壁纸' }, slots: { control: '<b class="x">ctl</b>' } })
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.x').exists()).toBe(true)
  })

  it('给了 sub 才渲染副标题', () => {
    expect(mount(SettingsRow, { props: { label: 'a' } }).find('.set-row-sub').exists()).toBe(false)
    expect(mount(SettingsRow, { props: { label: 'a', sub: 'v1.0' } }).find('.set-row-sub').text()).toBe('v1.0')
  })

  it('非 clickable 时根元素是 div,不可聚焦', () => {
    const w = mount(SettingsRow, { props: { label: 'a' } })
    expect(w.find('button.set-list-item').exists()).toBe(false)
    expect(w.find('.set-chevron').exists()).toBe(false)
  })

  it('clickable 时根元素是 button 并带 chevron,点击 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.exists()).toBe(true)
    expect(w.find('.set-chevron').exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('disabled 的 clickable 行既带 disabled 属性,也确实不 emit click', async () => {
    const w = mount(SettingsRow, { props: { label: 'a', clickable: true, disabled: true } })
    const btn = w.find('button.set-list-item')
    expect(btn.attributes('disabled')).toBeDefined()
    // 只断言属性不够:@vue/test-utils 的 trigger 对 disabled 元素照样会派发,
    // 所以要真点一次,验证组件内那道 disabled 守卫也在。
    await btn.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('hint 插槽渲染在行下方(壁纸 D5 / 语言 D6 的说明位)', () => {
    const w = mount(SettingsRow, { props: { label: 'a' }, slots: { hint: '暂不可用' } })
    expect(w.find('.set-row-hint').text()).toBe('暂不可用')
  })
})
