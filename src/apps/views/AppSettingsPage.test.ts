import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { EditorView } from '@codemirror/view'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  compose: { getYaml: vi.fn(), applySettings: vi.fn(), list: vi.fn().mockResolvedValue({}) },
  container: { getNetworks: vi.fn().mockResolvedValue([]) },
  appstore: { stableTag: vi.fn().mockResolvedValue(null) },
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
  it('port conflict -> dialog first; confirm closes it, banner stays, no navigation', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    svc.compose.applySettings.mockRejectedValueOnce({ response: { status: 400, data: { message: 'there are ports in use', data: { ports_in_use: { TCP: ['80'] } } } } })
    // attachTo:reka Dialog 经 Portal 渲染到 body,原生 click 需要真 DOM(PreInstallTips.test 先例)
    const w = mount(AppSettingsPage, {
      global: { plugins: [i18n, pinia], stubs: { AreaShell: { template: '<div><slot /></div>' }, AppsSidebar: true } },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-test="settings-save"]').trigger('click')
    await flushPromises()
    // 弹窗先出(保存钮在长表单底部,顶部红条在视野外——验收补丁根因)
    expect(document.body.querySelector('[data-test="settings-conflict-dlg"]')).not.toBeNull()
    expect(document.body.textContent).toContain('80/tcp')
    ;(document.body.querySelector('[data-test="settings-conflict-ok"]') as HTMLButtonElement).click()
    await flushPromises()
    // 确认后弹窗关、顶部红条保留、端口行冲突标红保留、不跳页
    expect(document.body.querySelector('[data-test="settings-conflict-dlg"]')).toBeNull()
    expect(w.find('[data-test="settings-conflict"]').exists()).toBe(true)
    expect(w.find('[data-test="port-row"].conflict').exists()).toBe(true)
    expect(routerMock.push).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('AppSettingsPage — YAML tab (P6 验收补丁②)', () => {
  it('form → yaml: editor appears and carries form edits made before switching', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    const w = mk()
    await flushPromises()
    await w.find('[data-test="svc-image"]').setValue('img:2')
    await w.find('[data-test="settings-tab-yaml"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="settings-yaml-panel"]').exists()).toBe(true)
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    expect(view.state.doc.toString()).toContain('img:2')
  })

  it('yaml → form: invalid yaml blocks the switch and shows a parse-error banner', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-tab-yaml"]').trigger('click')
    await flushPromises()
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'services:\n  demo:\n  bad indent\n- broken: [' } })
    await w.find('[data-test="settings-tab-form"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="settings-yaml-panel"]').exists()).toBe(true) // 未切走,仍在 yaml tab
    expect(w.find('[data-test="yaml-parse-error"]').exists()).toBe(true)
    expect(w.find('[data-test="yaml-parse-error"]').text()).toContain(zh.appsSettingsYamlParseError)
  })

  it('yaml → form: valid yaml switches tabs and rebuilds the form model', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-tab-yaml"]').trigger('click')
    await flushPromises()
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'services:\n  demo:\n    image: img:9\n    ports: ["80:80"]\n' } })
    await w.find('[data-test="settings-tab-form"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="settings-yaml-panel"]').exists()).toBe(false)
    expect((w.find('[data-test="svc-image"]').element as HTMLInputElement).value).toBe('img:9')
  })

  it('yaml tab save success -> navigates back to /apps', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    svc.compose.applySettings.mockResolvedValue(undefined)
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-tab-yaml"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="settings-yaml-save"]').trigger('click')
    await flushPromises()
    expect(svc.compose.applySettings).toHaveBeenCalledTimes(2)
    expect(routerMock.push).toHaveBeenCalledWith({ name: 'apps' })
  })

  it('yaml tab save port conflict -> in-tab banner lists ports, no dialog, no navigation', async () => {
    svc.compose.getYaml.mockResolvedValue(Y)
    svc.compose.applySettings.mockRejectedValueOnce({ response: { status: 400, data: { message: 'there are ports in use', data: { ports_in_use: { TCP: ['80'] } } } } })
    const w = mk()
    await flushPromises()
    await w.find('[data-test="settings-tab-yaml"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="settings-yaml-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="settings-conflict-dlg"]').exists()).toBe(false)
    expect(w.find('[data-test="settings-conflict"]').exists()).toBe(true)
    expect(w.find('[data-test="settings-conflict"]').text()).toContain('80/tcp')
    expect(routerMock.push).not.toHaveBeenCalled()
  })
})
