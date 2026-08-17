import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'

vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))
const registerFn = vi.fn(async () => {})
vi.mock('../composables/useAuth', () => ({ useAuth: () => ({ registerAndLogin: registerFn }) }))
const setLocale = vi.fn()
const persist = vi.fn(async () => {})
vi.mock('../stores/locale', () => ({
  LOCALES: ['zh_cn', 'en_us'],
  useLocaleStore: () => ({ setLocale, persist }),
}))

import Welcome from './Welcome.vue'

async function mountWelcome() {
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
  const pinia = createPinia()
  const router = createRouter({ history: createWebHashHistory('/app/'), routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/welcome', component: Welcome },
  ] })
  router.push('/welcome'); await router.isReady()
  return mount(Welcome, { global: { plugins: [i18n, pinia, router] } })
}

describe('Welcome.vue', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); sessionStorage.setItem('init_key', 'K1') })

  it('step 1 shows Go button, advances to step 2 on click', async () => {
    const w = await mountWelcome()
    expect(w.find('.welcome-go').exists()).toBe(true)
    await w.find('.welcome-go').trigger('click')
    expect(w.find('.welcome-create').exists()).toBe(true)
  })

  it('blocks create when passwords mismatch', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-username').setValue('nimo')
    await w.find('.welcome-password').setValue('secret1')
    await w.find('.welcome-confirm').setValue('secret2')
    await w.find('.welcome-create').trigger('click')
    expect(registerFn).not.toHaveBeenCalled()
  })

  it('calls registerAndLogin with initKey on valid create', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-username').setValue('nimo')
    await w.find('.welcome-password').setValue('secret1')
    await w.find('.welcome-confirm').setValue('secret1')
    await w.find('.welcome-create').trigger('click')
    expect(registerFn).toHaveBeenCalledWith('nimo', 'secret1', 'K1')
  })

  it('toggles password and confirm visibility via .welcome-reveal', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    const password = w.find('.welcome-password')
    const confirm = w.find('.welcome-confirm')
    const reveals = w.findAll('.welcome-reveal')
    expect(reveals.length).toBe(2)
    expect((password.element as HTMLInputElement).type).toBe('password')
    expect((confirm.element as HTMLInputElement).type).toBe('password')
    await reveals[0].trigger('click')
    expect((password.element as HTMLInputElement).type).toBe('text')
    await reveals[1].trigger('click')
    expect((confirm.element as HTMLInputElement).type).toBe('text')
    await reveals[0].trigger('click')
    expect((password.element as HTMLInputElement).type).toBe('password')
  })

  it('clicking the English button switches the language immediately', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-lang-en').trigger('click')
    expect(setLocale).toHaveBeenCalledWith('en_us')
  })

  it('persists the chosen language after successful account creation', async () => {
    const w = await mountWelcome()
    await w.find('.welcome-go').trigger('click')
    await w.find('.welcome-lang-en').trigger('click')
    await w.find('.welcome-username').setValue('nimo')
    await w.find('.welcome-password').setValue('secret1')
    await w.find('.welcome-confirm').setValue('secret1')
    await w.find('.welcome-create').trigger('click')
    expect(persist).toHaveBeenCalledWith('en_us')
  })
})
