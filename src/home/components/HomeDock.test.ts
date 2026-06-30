import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { __resetDockForTest } from '../composables/useDock'
import HomeDock from './HomeDock.vue'

beforeEach(() => {
  setActivePinia(createPinia()); localStorage.clear(); __resetDockForTest()
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(_v: string) {}, get href() { return '' } } })
})

describe('HomeDock', () => {
  it('renders favorite dock apps with labels', () => {
    useAppsStore()
    const w = mount(HomeDock)
    const labels = w.findAll('.dock-app').map((b) => b.text())
    expect(labels.join(' ')).toContain('文件')
    expect(w.findAll('.dock-app').length).toBeGreaterThanOrEqual(5)
  })
  it('clicking allApps toggles expanded (more zone shows settings)', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.text()).toContain('设置') // settings 在 more 区
  })
})
