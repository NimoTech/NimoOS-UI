import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'

const loginFn = vi.fn(async () => {})
vi.mock('../composables/useAuth', () => ({ useAuth: () => ({ login: loginFn }) }))

import Login from './Login.vue'

function makeRouter() {
  return createRouter({ history: createWebHashHistory('/'), routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/login', component: Login },
  ] })
}

async function mountLogin() {
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
  const router = makeRouter()
  router.push('/login'); await router.isReady()
  return mount(Login, { global: { plugins: [i18n, router] } })
}

describe('Login.vue', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('prefills username from localStorage.user', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo' }))
    const w = await mountLogin()
    expect((w.find('.login-username').element as HTMLInputElement).value).toBe('nimo')
  })

  it('blocks submit and shows error when fields invalid', async () => {
    const w = await mountLogin()
    await w.find('.login-submit').trigger('click')
    expect(loginFn).not.toHaveBeenCalled()
    expect(w.find('.login-error').exists()).toBe(true)
  })

  it('calls useAuth.login with entered credentials', async () => {
    const w = await mountLogin()
    await w.find('.login-username').setValue('nimo')
    await w.find('.login-password').setValue('secret1')
    await w.find('.login-submit').trigger('click')
    expect(loginFn).toHaveBeenCalledWith('nimo', 'secret1')
  })

  it('surfaces server error message on failure', async () => {
    loginFn.mockRejectedValueOnce(Object.assign(new Error('账号被禁用'), {}))
    const w = await mountLogin()
    await w.find('.login-username').setValue('nimo')
    await w.find('.login-password').setValue('secret1')
    await w.find('.login-submit').trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(w.find('.login-error').text()).toContain('账号被禁用')
  })

  it('toggles password visibility via .login-reveal', async () => {
    const w = await mountLogin()
    const input = w.find('.login-password')
    expect((input.element as HTMLInputElement).type).toBe('password')
    await w.find('.login-reveal').trigger('click')
    expect((input.element as HTMLInputElement).type).toBe('text')
    await w.find('.login-reveal').trigger('click')
    expect((input.element as HTMLInputElement).type).toBe('password')
  })
})
