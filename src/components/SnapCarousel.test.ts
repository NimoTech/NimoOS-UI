import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../i18n/zh_cn'
import SnapCarousel from './SnapCarousel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('SnapCarousel', () => {
  it('渲染 slot 项;翻页钮按视口宽度 scrollBy', async () => {
    const w = mount(SnapCarousel, {
      global: { plugins: [i18n] },
      slots: { default: '<div class="probe">a</div><div class="probe">b</div>' },
    })
    expect(w.findAll('.probe')).toHaveLength(2)
    const viewport = w.get('.snap-viewport').element as HTMLElement
    viewport.scrollBy = vi.fn()
    Object.defineProperty(viewport, 'clientWidth', { value: 1000, configurable: true })
    // jsdom 里 scrollWidth=0 → 两端钮均 disabled,先撑出可滚动几何再点
    Object.defineProperty(viewport, 'scrollWidth', { value: 3000, configurable: true })
    await w.get('.snap-viewport').trigger('scroll') // 触发一次几何重算
    await w.get('.snap-next').trigger('click')
    expect(viewport.scrollBy).toHaveBeenCalledWith({ left: 900, behavior: 'smooth' })
    await w.get('.snap-prev').trigger('click')
    expect(viewport.scrollBy).toHaveBeenCalledWith({ left: -900, behavior: 'smooth' })
  })
})
