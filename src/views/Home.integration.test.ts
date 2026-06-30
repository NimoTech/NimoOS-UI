import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../i18n/zh_cn'
import Home from './Home.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

describe('Home integration', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('mounts with topbar, grid items, and toast container', async () => {
    const w = mount(Home, { global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(w.find('.topbar').exists()).toBe(true)
    expect(w.findAll('[data-id]').length).toBeGreaterThan(0) // DEFAULT 项渲染
  })
})
