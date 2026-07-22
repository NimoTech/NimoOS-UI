import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { EditorView } from '@codemirror/view'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  compose: { install: vi.fn(), list: vi.fn().mockResolvedValue({}), get: vi.fn() },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: vi.fn(() => () => {}) }) }))

import CustomAppsPage from './CustomAppsPage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
let pinia: Pinia

// 真路由(memory history):tab 状态是路由 query 驱动的深链,需要真实响应式 route 才能观察到
// "点击切 tab / 转换后自动切 tab" 这类导航后果——静态 mock route(StorePage.test.ts 那种)只能断言
// replace() 的调用参数,验证不了"切换后确实渲染另一个面板",而这正是本页面 brief 明确要求的用例。
async function mountPage(initial = '/apps/custom') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/apps/custom', name: 'apps-custom', component: CustomAppsPage },
      { path: '/apps', name: 'apps', component: { template: '<div data-test="apps-page">apps</div>' } },
    ],
  })
  await router.push(initial)
  const w = mount(CustomAppsPage, {
    global: {
      plugins: [i18n, pinia, router],
      stubs: { AreaShell: { template: '<div><slot /></div>' }, AppsSidebar: true },
    },
  })
  return { w, router }
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()
  svc.compose.install.mockReset().mockResolvedValue(undefined)
  svc.compose.list.mockReset().mockResolvedValue({})
})

describe('CustomAppsPage — tab 路由 query', () => {
  it('默认(无 ?tab)显示 tab1 YAML 安装面板', async () => {
    const { w } = await mountPage('/apps/custom')
    expect(w.find('[data-test="panel-yaml"]').exists()).toBe(true)
  })

  it('?tab=import → 显示 tab2 面板', async () => {
    const { w } = await mountPage('/apps/custom?tab=import')
    expect(w.find('[data-test="panel-import"]').exists()).toBe(true)
    expect(w.find('[data-test="panel-yaml"]').exists()).toBe(false)
  })

  it('?tab=link → 显示 tab3 占位', async () => {
    const { w } = await mountPage('/apps/custom?tab=link')
    expect(w.find('[data-test="tab-link"]').exists()).toBe(true)
  })

  it('?tab=garbage → 兜底回 tab1(非法值不识别)', async () => {
    const { w } = await mountPage('/apps/custom?tab=garbage')
    expect(w.find('[data-test="panel-yaml"]').exists()).toBe(true)
  })

  it('点击 tab 按钮 → 路由 query 切换,面板跟着换(深链可逆向验证)', async () => {
    const { w, router } = await mountPage('/apps/custom')
    await w.find('[data-test="tab-import"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('import')
    expect(w.find('[data-test="panel-import"]').exists()).toBe(true)
  })
})

describe('CustomAppsPage — tab2 docker run 转换', () => {
  it('粘贴 docker run 命令点转换 → 编辑器内容含镜像名且自动切到 tab1', async () => {
    const { w, router } = await mountPage('/apps/custom?tab=import')
    await w.find('[data-test="custom-import-textarea"]').setValue('docker run -p 8080:80 nginx')
    await w.find('[data-test="custom-convert"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBeUndefined() // tab=yaml 时 query 里 tab 键被清空
    expect(w.find('[data-test="panel-yaml"]').exists()).toBe(true)
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)
    expect(view!.state.doc.toString()).toContain('nginx')
  })

  it('转换失败(垃圾输入)→ 就地报错,不切 tab', async () => {
    const { w, router } = await mountPage('/apps/custom?tab=import')
    await w.find('[data-test="custom-import-textarea"]').setValue('this is not a docker command at all')
    await w.find('[data-test="custom-convert"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="convert-error"]').exists()).toBe(true)
    expect(router.currentRoute.value.query.tab).toBe('import') // 未切走
  })
})

describe('CustomAppsPage — tab1 安装', () => {
  it('安装成功 → 调用 useCustomInstall 真实链路(dry_run→install)并跳转 /apps', async () => {
    const { w, router } = await mountPage('/apps/custom')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'services:\n  demo:\n    image: demo:1\n' } })
    await nextTick()

    await w.find('[data-test="custom-install"]').trigger('click')
    await flushPromises()

    expect(svc.compose.install).toHaveBeenNthCalledWith(1, expect.stringContaining('demo'), { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, expect.stringContaining('demo'), { checkPortConflict: true })
    expect(router.currentRoute.value.path).toBe('/apps')
  })

  it('安装失败(dry_run 400 端口冲突)→ 就地红条含端口,不跳转', async () => {
    svc.compose.install.mockRejectedValueOnce({
      response: { data: { message: 'conflict', data: { ports_in_use: { tcp: [8080] } } } },
    })
    const { w, router } = await mountPage('/apps/custom')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'services:\n  demo:\n    image: demo:1\n' } })
    await nextTick()

    await w.find('[data-test="custom-install"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="yaml-error"]').exists()).toBe(true)
    expect(w.find('[data-test="yaml-error"]').text()).toContain('8080/tcp')
    expect(router.currentRoute.value.path).toBe('/apps/custom')
  })

  it('校验成功 → toast appsCustomValidateOk,不发真装', async () => {
    const { w } = await mountPage('/apps/custom')
    await w.find('[data-test="custom-validate"]').trigger('click')
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(1) // 只 dry_run
    expect(svc.compose.install).toHaveBeenCalledWith(expect.any(String), { dryRun: true, checkPortConflict: true })
  })
})
