import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  compose: { getYaml: vi.fn(), applySettings: vi.fn(), list: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
const routerMock = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', async (orig) => ({
  ...(await orig()),
  useRoute: () => ({ params: { name: 'demo' } }),
  useRouter: () => routerMock,
}))
import AppSettingsPage from './AppSettingsPage.vue'

const Y = 'services:\n  demo:\n    image: img:1\n    ports: ["80:80"]\n'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
let pinia: Pinia
beforeEach(() => { pinia = createPinia(); setActivePinia(pinia); vi.clearAllMocks() })
const mk = () => mount(AppSettingsPage, { global: { plugins: [i18n, pinia], stubs: { AreaShell: { template: '<div><slot /></div>' }, AppsSidebar: true } } })

describe('AppSettingsPage', () => {
  it('loads yaml on mount and renders form', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    const w = mk()
    await flushPromises()
    expect(w.find('[data-test="svc-image"]').exists()).toBe(true)
  })
  it('save success -> navigates back to /apps', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    svc.compose.applySettings.mockResolvedValue(undefined)
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-save"]').trigger('click')
    await flushPromises()
    expect(routerMock.push).toHaveBeenCalledWith({ name: 'apps' })
  })
  it('port conflict -> banner shown, stays on page', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    svc.compose.applySettings.mockRejectedValueOnce({ response: { status: 400, data: { message: 'there are ports in use', data: { ports_in_use: { TCP: ['80'] } } } } })
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="settings-conflict"]').exists()).toBe(true)
    expect(routerMock.push).not.toHaveBeenCalled()
  })
})
