import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../stores/layout'
import { useAppsStore } from '../stores/apps'
import { __resetAddPanelForTest } from '../composables/useAddPanel'
import AddPanel from './AddPanel.vue'

describe('AddPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); __resetAddPanelForTest() })
  it('widget tab lists widgets and marks used ones', async () => {
    const layout = useLayoutStore(); layout.replaceAll([{ kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 }])
    const w = mount(AddPanel, { props: { open: true } })
    expect(w.text()).toContain('时间') // clock widget card
    expect(w.text()).toContain('✓ 已添加') // clock used badge
  })
  it('widget tab also lists app-declared widgets, marks used ones, and pins on click', async () => {
    const apps = useAppsStore()
    apps.setApps([{ name: 'my-dl', title: { zh_cn: '下载器' }, status: 'running', port: '8080', desktop: true, widget: { path: '/widget', w: 3, h: 2 } }] as any)
    const layout = useLayoutStore(); layout.replaceAll([])
    const w = mount(AddPanel, { props: { open: true }, attachTo: document.body })
    expect(w.text()).toContain('下载器') // app widget card
    const card = w.get('.lib-card[data-key="aw-my-dl"]')
    expect(card.find('.lib-used-badge').exists()).toBe(false)
    await card.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await card.trigger('pointerup', { clientX: 0, clientY: 0 })
    expect(layout.items.some((i) => i.kind === 'appwidget' && i.key === 'my-dl')).toBe(true)
    w.unmount()
  })
  it('clicking an app card pins it to the grid', async () => {
    const layout = useLayoutStore(); layout.replaceAll([])
    const w = mount(AddPanel, { props: { open: true }, attachTo: document.body })
    await w.get('[data-tab="app"]').trigger('click')
    // pointerdown starts the gesture; pointerup (no move) triggers the click-to-pin path
    const icon = w.get('.lib-icon[data-key="vm"]')
    await icon.trigger('pointerdown', { clientX: 0, clientY: 0 })
    await icon.trigger('pointerup', { clientX: 0, clientY: 0 })
    expect(layout.items.some((i) => i.key === 'vm')).toBe(true)
    w.unmount()
  })
})
