import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineBar from './TimeMachineBar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(TimeMachineBar, { props: { momentText: '今天 14:30', canEnter: true, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineBar', () => {
  it('居中显示选中时刻', () => { expect(mountIt().find('.tm-bar-moment').text()).toBe('今天 14:30') })
  it('取消 emit cancel', async () => {
    const w = mountIt(); await w.find('.tm-bar-cancel').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
  it('进入 emit enter', async () => {
    const w = mountIt(); await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
  })
  it('没有可进入的快照时按钮禁用且不 emit', async () => {
    const w = mountIt({ canEnter: false })
    expect(w.find('.tm-bar-enter').attributes('disabled')).toBeDefined()
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
  })
})
