// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosToolbar.vue (49 lines).
// P1 scope: no EXIF filter slot, no icon library (plain text tabs) — see task-7-brief.md.
// Plan B Task 5 re-skin (2026-08-12): root class ".photos-toolbar" -> ".toolbar" so the
// already-ported vue2-parity/photos.scss `.photos-root .toolbar/.tabs/.tab/.density/
// .muted-text` rules (photos.scss:266-289) apply verbatim; the P1 icon-library cut is
// lifted here — tab/density buttons now carry the same inline <svg> glyphs Vue2 uses
// (PhotosIcon.vue name=album/ocr/video/compact/comfort/loose), fixing the English-locale
// "Compact"/"Comfortable" first-letter collision the old text-slice() density buttons had.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosToolbar from '../PhotosToolbar.vue'

// fix round 1(评审必修 1):不在这里另建 createI18n(...) 实例。vitest.setup.ts 已经把
// src/i18n 的单例装进 config.global.plugins,对全套测试的每次 mount 生效——再显式传入
// 一个不同的 i18n 实例会被 @vue/test-utils 拼接(而非替换)进同一个 app,vue-i18n 的
// install() 对两个实例都无条件调 app.component/app.directive,导致重复注册告警(默认
// reporter 不显示通过用例的 stderr,--reporter=verbose 才能看到,曾误判为"消失"。
// 直接吃全局装好的那份即可,该单例默认 locale 就是 zh_cn。
function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(PhotosToolbar, { props })
}

describe('PhotosToolbar', () => {
  it('renders four tabs and highlights the active one via data-active', () => {
    const w = mount(PhotosToolbar, { props: { tab: 'video', density: 'comfortable', count: 3 } })
    const tabs = w.findAll('.tab')
    expect(tabs).toHaveLength(4)
    const active = tabs.filter(t => t.attributes('data-active') === 'true')
    expect(active).toHaveLength(1)
    expect(tabs.indexOf(active[0])).toBe(3) // order: all/photo/ocr/video -> video is index 3
  })

  it('clicking a tab emits update:tab with the tab value', async () => {
    const w = mount(PhotosToolbar, { props: { tab: 'all', density: 'comfortable', count: 0 } })
    const tabs = w.findAll('.tab')
    // order: all / photo / ocr / video
    await tabs[3].trigger('click')
    expect(w.emitted('update:tab')?.[0]).toEqual(['video'])
    await tabs[1].trigger('click')
    expect(w.emitted('update:tab')?.[1]).toEqual(['photo'])
  })

  it('clicking a density button emits update:density with the density value', async () => {
    const w = mount(PhotosToolbar, { props: { tab: 'all', density: 'comfortable', count: 0 } })
    const densityBtns = w.findAll('.density button')
    expect(densityBtns).toHaveLength(3)
    await densityBtns[0].trigger('click')
    expect(w.emitted('update:density')?.[0]).toEqual(['compact'])
    await densityBtns[2].trigger('click')
    expect(w.emitted('update:density')?.[1]).toEqual(['loose'])
  })

  it('shows the item count text (raw number, same i18n arg shape as PhotosGrid month header — Fix 8)', () => {
    const w = mount(PhotosToolbar, { props: { tab: 'all', density: 'comfortable', count: 1234 } })
    expect(w.text()).toContain('1234')
  })

  it('root class is .toolbar (Vue2 parity — photos.scss:266-289 targets this class, not .photos-toolbar)', () => {
    const w = mount(PhotosToolbar, { props: {} })
    expect(w.find('.toolbar').exists()).toBe(true)
    expect(w.find('.photos-toolbar').exists()).toBe(false)
  })

  it('Photos/OCR/Videos tabs carry an inline svg glyph; All does not (Vue2 PhotosToolbar.vue:4-13)', () => {
    const w = mount(PhotosToolbar, { props: {} })
    const tabs = w.findAll('.tab')
    expect(tabs[0]!.find('svg').exists()).toBe(false) // All
    expect(tabs[1]!.find('svg').exists()).toBe(true) // Photos (album glyph)
    expect(tabs[2]!.find('svg').exists()).toBe(true) // OCR
    expect(tabs[3]!.find('svg').exists()).toBe(true) // Videos
  })

  it('each density button carries an inline svg glyph (fixes the EN "C"/"C" compact/comfortable collision from text-slice)', () => {
    const w = mount(PhotosToolbar, { props: {} })
    const densityBtns = w.findAll('.density button')
    densityBtns.forEach(btn => expect(btn.find('svg').exists()).toBe(true))
  })
})

describe('P7b-T3: after-tabs 槽位', () => {
  it('不传槽位时不多渲染任何节点(默认形态与 P1 一致)', () => {
    const w = mountToolbar()
    expect(w.find('[data-test="after-tabs-probe"]').exists()).toBe(false)
  })

  it('传入的槽位内容渲染在 .tabs 之后、计数与密度按钮之前', () => {
    const w = mount(PhotosToolbar, {
      props: { tab: 'photo', density: 'comfortable', count: 3 },
      slots: { 'after-tabs': '<i data-test="after-tabs-probe">x</i>' },
    })
    const probe = w.get('[data-test="after-tabs-probe"]')
    const children = Array.from(w.get('.toolbar').element.children)
    const tabsIdx = children.findIndex(el => el.classList.contains('tabs'))
    const probeIdx = children.indexOf(probe.element)
    const densityIdx = children.findIndex(el => el.classList.contains('density'))
    expect(tabsIdx).toBeGreaterThanOrEqual(0)
    expect(probeIdx).toBe(tabsIdx + 1)
    expect(probeIdx).toBeLessThan(densityIdx)
  })
})
