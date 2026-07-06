import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import ViewerShell from './ViewerShell.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const mountShell = (props: { title: string; downloadable?: boolean }) =>
  mount(ViewerShell, { props, global: { plugins: [i18n] }, slots: { default: '<div class="body-slot">x</div>' } })

describe('ViewerShell', () => {
  it('渲染标题与内容 slot', () => {
    const w = mountShell({ title: '标题X' })
    expect(w.text()).toContain('标题X')
    expect(w.find('.body-slot').exists()).toBe(true)
  })
  it('点关闭键 emit close', async () => {
    const w = mountShell({ title: 't' })
    await w.find('.viewer-close').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
  it('downloadable 时显示下载键并 emit download', async () => {
    const w = mountShell({ title: 't', downloadable: true })
    const btn = w.find('.viewer-download')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('download')).toBeTruthy()
  })
  it('非 downloadable 不显示下载键', () => {
    const w = mountShell({ title: 't' })
    expect(w.find('.viewer-download').exists()).toBe(false)
  })
})
