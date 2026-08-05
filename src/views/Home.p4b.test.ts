import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Home from './Home.vue'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
describe('Home P4b', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('renders the dock and opens add panel from topbar', async () => {
    // SP9-P8:Home 挂的 SearchDialog 用 useRoute()/useRouter(),挂载必须带 router 插件。
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
    const w = mount(Home, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('.dock').exists()).toBe(true)
    await w.get('.add-btn').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.lib-panel').exists()).toBe(true)
  })
})
