import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import FeaturedStrip from './FeaturedStrip.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const ITEMS = [
  { id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统', icon: 'https://cdn/i.png', thumbnail: 'https://cdn/t.png', category: 'Media' },
  { id: 'nextcloud', title: 'Nextcloud', tagline: 'File sync', icon: '', thumbnail: '', category: 'Cloud' },
]

describe('FeaturedStrip', () => {
  it('渲染标题、缩略图与卡片;点卡片 emit open(id);已装徽章走注入函数', async () => {
    const w = mount(FeaturedStrip, {
      props: { items: ITEMS, installed: (id: string) => id === 'jellyfin' },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('精选应用')
    const cards = w.findAll('.featured-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].get('.featured-shot img').attributes('src')).toBe('https://cdn/t.png')
    expect(cards[1].find('.featured-shot img').exists()).toBe(false) // 无缩略图落占位块
    expect(cards[1].find('.featured-shot-fallback').exists()).toBe(true)
    expect(cards[0].text()).toContain('已安装')
    await cards[1].trigger('click')
    expect(w.emitted('open')![0]).toEqual(['nextcloud'])
  })
  it('未装卡片有安装按钮:emit install(id) 且不冒泡成 open;已装卡片无按钮', async () => {
    const w = mount(FeaturedStrip, {
      props: { items: ITEMS, installed: (id: string) => id === 'jellyfin' },
      global: { plugins: [i18n] },
    })
    const cards = w.findAll('.featured-card')
    expect(cards[0].find('.featured-install').exists()).toBe(false) // 已装
    const btn = cards[1].get('.featured-install')
    await btn.trigger('click')
    expect(w.emitted('install')![0]).toEqual(['nextcloud'])
    expect(w.emitted('open')).toBeUndefined()
  })
  it('items 空整块不渲染', () => {
    const w = mount(FeaturedStrip, {
      props: { items: [], installed: () => false },
      global: { plugins: [i18n] },
    })
    expect(w.find('.featured-strip').exists()).toBe(false)
  })
})
