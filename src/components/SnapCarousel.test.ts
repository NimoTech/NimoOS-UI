import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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

  it('slot 内容在挂载后异步撑大(如 img 懒加载解码完成)——viewport 自身盒子不变,ResizeObserver 不会重算,需靠 load 事件兜底重算端点态', async () => {
    const w = mount(SnapCarousel, {
      global: { plugins: [i18n] },
      slots: { default: '<img class="probe" />' },
    })
    const viewport = w.get('.snap-viewport').element as HTMLElement
    const img = w.get('.probe').element as HTMLElement
    Object.defineProperty(viewport, 'clientWidth', { value: 1000, configurable: true })
    // 挂载时刻:图片还没解码,scrollWidth≈0 → atEnd=true → next 钮 disabled
    Object.defineProperty(viewport, 'scrollWidth', { value: 0, configurable: true })
    await nextTick()
    expect(w.get('.snap-next').attributes('disabled')).toBeDefined()

    // 图片异步解码完成撑开内容;img 的 load 事件不冒泡,但捕获阶段应能被 viewport 上的监听捕获到并触发重算
    Object.defineProperty(viewport, 'scrollWidth', { value: 3000, configurable: true })
    img.dispatchEvent(new Event('load'))
    await nextTick()

    expect(w.get('.snap-next').attributes('disabled')).toBeUndefined()
  })

  it('slot 内容通过 childList 变更长大(如详情页动态插入截图)—— MutationObserver 兜底重算端点态', async () => {
    const w = mount(SnapCarousel, {
      global: { plugins: [i18n] },
      slots: { default: '<div class="probe">a</div>' },
    })
    const viewport = w.get('.snap-viewport').element as HTMLElement
    Object.defineProperty(viewport, 'clientWidth', { value: 1000, configurable: true })
    Object.defineProperty(viewport, 'scrollWidth', { value: 0, configurable: true })
    await nextTick()
    expect(w.get('.snap-next').attributes('disabled')).toBeDefined()

    Object.defineProperty(viewport, 'scrollWidth', { value: 3000, configurable: true })
    const extra = document.createElement('div')
    extra.className = 'probe'
    viewport.appendChild(extra)
    // MutationObserver 回调是微任务,需多等一拍
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()

    expect(w.get('.snap-next').attributes('disabled')).toBeUndefined()
  })
})
