import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import ViewerShell from './ViewerShell.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountShell = (props: { title: string; downloadable?: boolean }) =>
  mount(ViewerShell, { props, global: { plugins: [i18n] }, slots: { default: '<div class="body-slot">x</div>' } })

describe('ViewerShell', () => {
  it('Renders title and content slot', () => {
    const w = mountShell({ title: '标题X' })
    expect(w.text()).toContain('标题X')
    expect(w.find('.body-slot').exists()).toBe(true)
  })
  it('Clicking close button emits close', async () => {
    const w = mountShell({ title: 't' })
    await w.find('.viewer-close').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
  it('When downloadable, shows download button and emits download', async () => {
    const w = mountShell({ title: 't', downloadable: true })
    const btn = w.find('.viewer-download')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('download')).toBeTruthy()
  })
  it('Non-downloadable does not show download button', () => {
    const w = mountShell({ title: 't' })
    expect(w.find('.viewer-download').exists()).toBe(false)
  })
})
