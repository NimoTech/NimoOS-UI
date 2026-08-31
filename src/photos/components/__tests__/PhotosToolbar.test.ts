// Ported from the Vue 2 panel's src/views/Photos/PhotosToolbar.vue (49 lines).
// Original scope: no EXIF filter slot, no icon library (plain text tabs).
// Re-skin: root class ".photos-toolbar" -> ".toolbar" so the
// already-ported vue2-parity/photos.scss `.photos-root .toolbar/.tabs/.tab/.density/
// .muted-text` rules (photos.scss:266-289) apply verbatim; the earlier icon-library cut is
// lifted here — tab/density buttons now carry the same inline <svg> glyphs Vue2 uses
// (PhotosIcon.vue name=album/ocr/video/compact/comfort/loose), fixing the English-locale
// "Compact"/"Comfortable" first-letter collision the old text-slice() density buttons had.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosToolbar from '../PhotosToolbar.vue'

// Don't create a new createI18n(...) instance here.
// vitest.setup.ts already installed src/i18n singleton into config.global.plugins, effective for every
// mount in the suite—— passing a different i18n instance explicitly gets concatenated (not replaced) by
// @vue/test-utils into the same app; vue-i18n's install() unconditionally calls app.component/app.directive
// on both instances, causing duplicate registration warnings (default reporter hides stderr from passing
// cases; only --reporter=verbose shows it). Just use the global singleton; its default locale is zh_cn.
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

  it('shows the item count text (raw number, same i18n arg shape as PhotosGrid month header)', () => {
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

describe('after-tabs slot', () => {
  it('when slot is not passed, no extra nodes are rendered (default form same as original)', () => {
    const w = mountToolbar()
    expect(w.find('[data-test="after-tabs-probe"]').exists()).toBe(false)
  })

  it('slot content is rendered after .tabs, before count and density buttons', () => {
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
