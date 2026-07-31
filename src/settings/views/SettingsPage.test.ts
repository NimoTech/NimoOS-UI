import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import SettingsPage from './SettingsPage.vue'
import { LAST_TAB_KEY } from '../util/lastTab'

// P1 起 general 骨架被真实内容替换(LanguageRow 等用 Pinia store,UpdateRow/SwitchRow
// 用 toast store),挂载整页需要一个 active Pinia —— 之前 general 只是纯骨架不需要。
// service 也必须 mock:未调用 initService() 时 `service.sys` 这个 getter 本身就同步抛错
// (不是 promise reject),UsbAutoMountRow 的 Promise.allSettled 只包住了 .then() 链,
// 包不住取属性阶段的同步抛出,会变成未处理异常炸穿整个测试文件。这里只关心路由/外壳层面
// 的断言,与 GeneralPanel.integration.test.ts 的详细行为断言不重复。
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({}),
      setCustomStorage: async () => {},
    },
    sys: {
      hardwareInfo: async () => ({ arch: 'amd64', drive_model: '', version: '1.0.0' }),
      getBaseInfo: async () => ({ device_id: 'dc', model: '', version: '1.0.0' }),
      getServerPort: async () => '80',
      getUsbStatus: async () => false,
      getOsVersion: async () => ({ current_version: '1.0.0', need_update: false }),
      getAppVersion: async () => ({ current_version: '1.0.0', need_update: false }),
      setDiskStandby: async () => {},
      editServerPort: async () => {},
      toggleUsbAutoMount: async () => {},
      power: async () => {},
      updateOs: async () => {}, updateApp: async () => {}, cancelDownload: async () => {},
    },
    file: { getContent: async () => ({ content: '' }) },
  },
}))
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

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
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

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
