import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import SettingsPage from './SettingsPage.vue'
import { LAST_TAB_KEY } from '../util/lastTab'

// Since P1, the general skeleton has been replaced with real content (LanguageRow etc. use the
// Pinia store, UpdateRow/SwitchRow use the toast store), so mounting the whole page needs an
// active Pinia — previously general was a bare skeleton and didn't need one.
// service must also be mocked: without calling initService(), the `service.sys` getter itself
// throws synchronously (not a promise rejection), and UsbAutoMountRow's Promise.allSettled only
// wraps the .then() chain — it can't catch a synchronous throw at property-access time, which
// becomes an unhandled exception that blows up the whole test file. This file only cares about
// routing/shell-level assertions, and doesn't duplicate the detailed behaviour assertions in
// GeneralPanel.integration.test.ts.
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({}),
      setCustomStorage: async () => {},
      // AccountPanel's avatarSrc computed is evaluated at mount time; missing this line throws
      // an unhandled TypeError after the test finishes, which manifests as "all 3078 tests
      // green but process exit code 1".
      avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
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

  it('renders the matching skeleton based on :tab', async () => {
    const { w } = await mountPage('network')
    expect(w.find('.set-section-title').text()).toBe('网络')
  })

  it('content switches along with the tab', async () => {
    const { w, router } = await mountPage('network')
    await router.push('/settings/apps')
    await flushPromises()
    expect(w.find('.set-section-title').text()).toBe('应用')
  })

  it('writes the current tab to memory on entry', async () => {
    await mountPage('apps')
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('apps')
  })

  it('memory updates along with the tab switch', async () => {
    const { router } = await mountPage('apps')
    await router.push('/settings/terminal')
    await flushPromises()
    expect(localStorage.getItem(LAST_TAB_KEY)).toBe('terminal')
  })

  it('clicking a rail item navigates to the matching route', async () => {
    const { w, router } = await mountPage('general')
    const item = w.findAll('.set-rail-item').find((i) => i.attributes('data-tab') === 'apps')!
    await item.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/apps')
  })

  it('the developer entry on the general page navigates to /settings/developer', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-dev-entry').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/developer')
  })

  it('developer\'s back button navigates back to /settings/general', async () => {
    const { w, router } = await mountPage('developer')
    await w.find('.set-back').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/general')
  })

  it('the user block navigates to /settings/account', async () => {
    const { w, router } = await mountPage('general')
    await w.find('.set-user').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings/account')
  })

  it('falls back to rendering general when mounted directly with an invalid :tab (not blank)', async () => {
    const { w } = await mountPage('nope')
    expect(w.find('.set-section-title').text()).toBe('通用')
  })
})
