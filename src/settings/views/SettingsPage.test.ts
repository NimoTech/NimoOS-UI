import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import SettingsPage from './SettingsPage.vue'
import { LAST_TAB_KEY } from '../util/lastTab'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: { ...zh, ...zhSp9 } },
})

async function mountPage(tab: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/settings/:tab', component: SettingsPage },
    ],
  })
  await router.push('/settings/' + tab)
  await router.isReady()
  const w = mount(SettingsPage, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { w, router }
}

describe('SettingsPage', () => {
  beforeEach(() => localStorage.clear())

  it('按 :tab 渲染对应骨架', async () => {
    const { w } = await mountPage('network')
    expect(w.find('.set-section-title').text()).toBe('网络')
  })

  it('切 tab 时内容跟着换', async () => {
    const { w, router } = await mountPage('network')
    await router.push('/settings/apps')
    await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('应用')
  })

  it('进入时把当前 tab 写进记忆', async () => {
    await mountPage('apps')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('apps')
  })

  it('切 tab 后记忆跟着更新', async () => {
    const { router } = await mountPage('apps')
    await router.push('/settings/terminal')
    await flushPromises()
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('terminal')
  })

  it('点 rail 项跳到对应路由', async () => {
    const { w, router } = await mountPage('general')
    const item = w.findAll('.set-rail-item').find((i) => i.attributes('data-tab') === 'apps')!
    await item.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/apps')
  })

  it('general 页内的 developer 入口跳到 /settings/developer', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-dev-entry').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/developer')
  })

  it('developer 的返回按钮跳回 /settings/general', async () => {
    const { w, router } = await mountPage('developer')
    await w.find('.set-back').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/general')
  })

  it('用户块跳到 /settings/account', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-user').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/account')
  })

  it('非法 :tab 直接挂载时兜底渲染 general(不空白)', async () => {
    const { w } = await mountPage('nope')
    expect(w.find('.set-section-title').text()).toBe('通用')
  })
})
