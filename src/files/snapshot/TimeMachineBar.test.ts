import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineBar from './TimeMachineBar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(TimeMachineBar, { props: { momentText: '今天 14:30', canEnter: true, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineBar', () => {
  it('Center display selected moment', () => { expect(mountIt().find('.tm-bar-moment').text()).toBe('今天 14:30') })
  it('If path provided, place it above the moment', () => {
    const w = mountIt({ folderText: '正在查看 /磁盘/Photos 的历史版本' })
    expect(w.find('.tm-bar-folder').text()).toContain('/磁盘/Photos')
  })
  it('If no path provided, do not occupy space (leave room for callers who do not need this line)', () => {
    expect(mountIt().find('.tm-bar-folder').exists()).toBe(false)
  })
  it('Cancel emits cancel', async () => {
    const w = mountIt(); await w.find('.tm-bar-cancel').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
  it('Enter emits enter', async () => {
    const w = mountIt(); await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
  })
  it('When there is no snapshot to enter, button is disabled and does not emit', async () => {
    const w = mountIt({ canEnter: false })
    expect(w.find('.tm-bar-enter').attributes('disabled')).toBeDefined()
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
  })
})
