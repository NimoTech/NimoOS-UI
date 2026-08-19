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
  // Owner's order: the moment sits directly under the card, with the two verbs beneath it. Read off
  // the DOM order because jsdom computes no layout -- what matters is which comes first.
  it('the moment comes above the two buttons', () => {
    const kids = [...mountIt().get('.tm-bar').element.children].map((el) => el.className)
    expect(kids).toEqual(['tm-bar-moment', 'tm-bar-actions'])
  })
  // The folder path is no longer here: it moved to the overlay's own top bar (owner's call),
  // so the bottom bar is back to just the moment plus the two verbs.
  it('does not render a folder line any more', () => {
    expect(mountIt().find('.tm-bar-folder').exists()).toBe(false)
    expect(mountIt().find('.tm-crumb').exists()).toBe(false)
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
