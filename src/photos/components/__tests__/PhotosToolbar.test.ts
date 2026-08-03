// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosToolbar.vue (49 lines).
// P1 scope: no EXIF filter slot, no icon library (plain text tabs) — see task-7-brief.md.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotosToolbar from '../PhotosToolbar.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountToolbar(props: Record<string, unknown> = {}) {
  return mount(PhotosToolbar, { props, global: { plugins: [i18n] } })
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
      global: { plugins: [i18n] },
    })
    const probe = w.get('[data-test="after-tabs-probe"]')
    const children = Array.from(w.get('.photos-toolbar').element.children)
    const tabsIdx = children.findIndex(el => el.classList.contains('tabs'))
    const probeIdx = children.indexOf(probe.element)
    const densityIdx = children.findIndex(el => el.classList.contains('density'))
    expect(tabsIdx).toBeGreaterThanOrEqual(0)
    expect(probeIdx).toBe(tabsIdx + 1)
    expect(probeIdx).toBeLessThan(densityIdx)
  })
})
