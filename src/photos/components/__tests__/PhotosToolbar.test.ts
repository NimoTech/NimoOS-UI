// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosToolbar.vue (49 lines).
// P1 scope: no EXIF filter slot, no icon library (plain text tabs) — see task-7-brief.md.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosToolbar from '../PhotosToolbar.vue'

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
