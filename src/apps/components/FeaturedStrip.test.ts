import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import FeaturedStrip from './FeaturedStrip.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const ITEMS = [
  { id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统', icon: 'https://cdn/i.png', thumbnail: 'https://cdn/t.png', category: 'Media', architectures: [], tips: undefined },
  { id: 'nextcloud', title: 'Nextcloud', tagline: 'File sync', icon: '', thumbnail: '', category: 'Cloud', architectures: [], tips: undefined },
]

describe('FeaturedStrip', () => {
  it('renders title, thumbnail and cards; click card emits open(id); installed badge uses injected function', async () => {
    const w = mount(FeaturedStrip, {
      props: { items: ITEMS, installed: (id: string) => id === 'jellyfin', progress: () => null, compatible: () => true },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('精选应用')
    const cards = w.findAll('.featured-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].get('.featured-shot img').attributes('src')).toBe('https://cdn/t.png')
    expect(cards[1].find('.featured-shot img').exists()).toBe(false) // no thumbnail falls back to the placeholder block
    expect(cards[1].find('.featured-shot-fallback').exists()).toBe(true)
    expect(cards[0].text()).toContain('已安装')
    await cards[1].trigger('click')
    expect(w.emitted('open')![0]).toEqual(['nextcloud'])
  })
  it('uninstalled card has install button: emits install(id) and does not bubble to open; installed card has no button', async () => {
    const w = mount(FeaturedStrip, {
      props: { items: ITEMS, installed: (id: string) => id === 'jellyfin', progress: () => null, compatible: () => true },
      global: { plugins: [i18n] },
    })
    const cards = w.findAll('.featured-card')
    expect(cards[0].find('.featured-install').exists()).toBe(false) // installed
    const btn = cards[1].get('.featured-install')
    await btn.trigger('click')
    expect(w.emitted('install')![0]).toEqual(['nextcloud'])
    expect(w.emitted('open')).toBeUndefined()
  })
  it('empty items does not render block', () => {
    const w = mount(FeaturedStrip, {
      props: { items: [], installed: () => false, progress: () => null, compatible: () => true },
      global: { plugins: [i18n] },
    })
    expect(w.find('.featured-strip').exists()).toBe(false)
  })
  it('progress/compatible function props drive button state', () => {
    const items = [{ id: 'a', title: 'A', tagline: '', icon: '', thumbnail: '', category: '', architectures: [], tips: undefined }]
    const w = mount(FeaturedStrip, {
      props: {
        items, installed: () => false,
        progress: () => 60, compatible: () => true,
      },
      global: { plugins: [i18n] },
    })
    const btn = w.find('.featured-install')
    expect(btn.text()).toContain('60')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
