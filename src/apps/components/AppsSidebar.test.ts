import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import AppsSidebar from './AppsSidebar.vue'
import { __resetSidebarDrawerForTest } from '../../composables/useSidebarDrawer'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ name: 'apps', fullPath: '/apps' }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('AppsSidebar', () => {
  beforeEach(() => { setActivePinia(createPinia()); __resetSidebarDrawerForTest(); push.mockClear() })

  it('渲染区标题、回主页键与「已装应用」导航项(当前路由高亮)', async () => {
    const w = mount(AppsSidebar, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('应用')
    const item = w.get('.side-item')
    expect(item.text()).toContain('已装应用')
    expect(item.classes()).toContain('active')
    await w.get('.side-home-btn').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })
})
