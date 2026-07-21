import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import StoreCard from './StoreCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const APP = { id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统', icon: 'https://cdn/i.png', thumbnail: '', category: 'Media', architectures: [], tips: undefined }

describe('StoreCard', () => {
  it('渲染 icon/title/tagline/category;点击 emit open', async () => {
    const w = mount(StoreCard, { props: { app: APP, installed: false }, global: { plugins: [i18n] } })
    expect(w.get('img').attributes('src')).toBe('https://cdn/i.png')
    expect(w.text()).toContain('Jellyfin')
    expect(w.text()).toContain('个人媒体系统')
    expect(w.text()).toContain('Media')
    expect(w.text()).not.toContain('已安装')
    await w.get('.store-card').trigger('click')
    expect(w.emitted('open')).toHaveLength(1)
  })
  it('未装显示安装按钮;点按钮 emit install 且不冒泡成 open', async () => {
    const w = mount(StoreCard, { props: { app: APP, installed: false }, global: { plugins: [i18n] } })
    const btn = w.get('.store-install')
    expect(btn.text()).toContain('安装')
    await btn.trigger('click')
    expect(w.emitted('install')).toHaveLength(1)
    expect(w.emitted('open')).toBeUndefined()
  })
  it('installed 显示徽章、无安装按钮;icon 空时渲染占位块不渲染 img', () => {
    const w = mount(StoreCard, {
      props: { app: { ...APP, icon: '' }, installed: true },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('已安装')
    expect(w.find('.store-install').exists()).toBe(false)
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.store-icon-fallback').exists()).toBe(true)
  })
  it('percent!=null → 安装中禁用钮;!compatible → 禁用;installed 优先', () => {
    const app = { id: 'a', title: 'A', tagline: '', icon: '', thumbnail: '', category: '', architectures: [], tips: undefined }
    let w = mount(StoreCard, { props: { app, installed: false, percent: 42 }, global: { plugins: [i18n] } })
    let btn = w.find('.store-install')
    expect(btn.text()).toContain('42')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)

    w = mount(StoreCard, { props: { app, installed: false, compatible: false }, global: { plugins: [i18n] } })
    expect((w.find('.store-install').element as HTMLButtonElement).disabled).toBe(true)

    w = mount(StoreCard, { props: { app, installed: true, percent: 42 }, global: { plugins: [i18n] } })
    expect(w.find('.store-install').exists()).toBe(false)
    expect(w.find('.store-badge').exists()).toBe(true)
  })
})
