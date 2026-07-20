import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import FeaturedStrip from './FeaturedStrip.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const ITEMS = [
  { id: 'jellyfin', title: 'Jellyfin', tagline: '个人媒体系统', icon: '', category: 'Media' },
  { id: 'nextcloud', title: 'Nextcloud', tagline: 'File sync', icon: '', category: 'Cloud' },
]

describe('FeaturedStrip', () => {
  it('渲染标题与卡片;点卡片 emit open(id);已装徽章走注入函数', async () => {
    const w = mount(FeaturedStrip, {
      props: { items: ITEMS, installed: (id: string) => id === 'jellyfin' },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('精选应用')
    const cards = w.findAll('.store-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('已安装')
    await cards[1].trigger('click')
    expect(w.emitted('open')![0]).toEqual(['nextcloud'])
  })
  it('items 空整块不渲染', () => {
    const w = mount(FeaturedStrip, {
      props: { items: [], installed: () => false },
      global: { plugins: [i18n] },
    })
    expect(w.find('.featured-strip').exists()).toBe(false)
  })
})
