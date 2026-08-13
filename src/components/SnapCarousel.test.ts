import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../i18n/zh_cn'
import SnapCarousel from './SnapCarousel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

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
    // In jsdom scrollWidth=0 → both end buttons disabled; establish scrollable geometry before clicking
    Object.defineProperty(viewport, 'scrollWidth', { value: 3000, configurable: true })
    await w.get('.snap-viewport').trigger('scroll') // trigger one geometry recalculation
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
    // At mount time: the image is not decoded yet, scrollWidth≈0 → atEnd=true → next button disabled
    Object.defineProperty(viewport, 'scrollWidth', { value: 0, configurable: true })
    await nextTick()
    expect(w.get('.snap-next').attributes('disabled')).toBeDefined()

    // The image finishes decoding asynchronously and widens the content; img load events don't bubble, but the capture-phase listener on the viewport should catch it and trigger a recalculation
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
    // MutationObserver callbacks are microtasks; wait one extra beat
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()

    expect(w.get('.snap-next').attributes('disabled')).toBeUndefined()
  })
})
