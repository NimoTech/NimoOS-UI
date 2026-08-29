import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import AppsSidebar from './AppsSidebar.vue'
import { __resetSidebarDrawerForTest } from '../../composables/useSidebarDrawer'

const push = vi.fn()
const routeState = { name: 'apps', fullPath: '/apps' }
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => routeState,
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('AppsSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); __resetSidebarDrawerForTest(); push.mockClear()
    routeState.name = 'apps'; routeState.fullPath = '/apps'
  })

  it('renders section title, home button and "installed apps" nav item (current route highlighted)', async () => {
    const w = mount(AppsSidebar, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('应用')
    const item = w.get('.side-item')
    expect(item.text()).toContain('已装应用')
    expect(item.classes()).toContain('active')
    await w.get('.side-home-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('store nav item exists; detail route also highlights store item (startsWith)', async () => {
    routeState.name = 'apps-store-detail'
    routeState.fullPath = '/apps/store/jellyfin'
    const w = mount(AppsSidebar, { global: { plugins: [i18n] } })
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(4)
    expect(items[1].text()).toContain('应用商店')
    expect(items[1].classes()).toContain('active')
    expect(items[0].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
    await items[1].trigger('click')
    expect(push).toHaveBeenCalledWith('/apps/store')
  })

  it('custom install nav item exists, highlights and navigates when current route is its prefix', async () => {
    routeState.name = 'apps-custom'
    routeState.fullPath = '/apps/custom'
    const w = mount(AppsSidebar, { global: { plugins: [i18n] } })
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(4)
    expect(items[2].text()).toContain('自定义安装')
    expect(items[2].classes()).toContain('active')
    expect(items[0].classes()).not.toContain('active')
    expect(items[1].classes()).not.toContain('active')
    await items[2].trigger('click')
    expect(push).toHaveBeenCalledWith('/apps/custom')
  })

  it('app store sources nav item exists, highlights and navigates when current route matches', async () => {
    routeState.name = 'apps-sources'
    routeState.fullPath = '/apps/sources'
    const w = mount(AppsSidebar, { global: { plugins: [i18n] } })
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(4)
    expect(items[3].text()).toContain('商店源')
    expect(items[3].classes()).toContain('active')
    expect(items[0].classes()).not.toContain('active')
    expect(items[1].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
    await items[3].trigger('click')
    expect(push).toHaveBeenCalledWith('/apps/sources')
  })
})
