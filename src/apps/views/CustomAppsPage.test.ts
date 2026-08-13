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
  users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: vi.fn(() => () => {}) }) }))

import CustomAppsPage from './CustomAppsPage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
let pinia: Pinia

// Real router (memory history): tab state is a route-query-driven deep link; navigation consequences
// like "click switches tab / auto-switch after conversion" need a truly reactive route — a static mock
// route (StorePage.test.ts style) can only assert replace() call arguments and cannot verify
// "the other panel actually renders after switching", which this page's brief explicitly requires.
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
  document.body.innerHTML = ''
  svc.compose.install.mockReset().mockResolvedValue(undefined)
  svc.compose.list.mockReset().mockResolvedValue({})
  svc.users.getCustomStorage.mockReset().mockResolvedValue([])
  svc.users.setCustomStorage.mockReset().mockResolvedValue(undefined)
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

  it('?tab=link → 显示 tab3 面板(断言面板而非恒渲染的 tab 按钮)', async () => {
    const { w } = await mountPage('/apps/custom?tab=link')
    expect(w.find('[data-test="tab-link-panel"]').exists()).toBe(true)
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
    expect(router.currentRoute.value.query.tab).toBeUndefined() // the tab key is cleared from the query when tab=yaml
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
    expect(router.currentRoute.value.query.tab).toBe('import') // did not switch away
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
    expect(svc.compose.install).toHaveBeenCalledTimes(1) // dry_run only
    expect(svc.compose.install).toHaveBeenCalledWith(expect.any(String), { dryRun: true, checkPortConflict: true })
  })
})

describe('CustomAppsPage — tab3 外部链接(LinkApp)', () => {
  it('挂载即读 link 列表并展示 name/hostname', async () => {
    svc.users.getCustomStorage.mockResolvedValue([{ name: 'MyNAS', hostname: 'http://nas.local', icon: '' }])
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    expect(svc.users.getCustomStorage).toHaveBeenCalledWith('link')
    const row = w.find('[data-test="link-row"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('MyNAS')
    expect(row.text()).toContain('http://nas.local')
  })

  it('列表为空时显示空态提示', async () => {
    svc.users.getCustomStorage.mockResolvedValue([])
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    expect(w.find('[data-test="link-empty"]').exists()).toBe(true)
  })

  it('地址留空提交 → 就地报错,不调 saveLinkApp(setCustomStorage 不发)', async () => {
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    await w.find('[data-test="link-name"]').setValue('Router')
    await w.find('[data-test="link-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="link-error"]').exists()).toBe(true)
    expect(svc.users.setCustomStorage).not.toHaveBeenCalled()
  })

  it('地址不以 http(s):// 开头 → 报 appsCustomLinkHostInvalid,不提交', async () => {
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    await w.find('[data-test="link-name"]').setValue('Router')
    await w.find('[data-test="link-hostname"]').setValue('ftp://nope')
    await w.find('[data-test="link-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="link-error"]').text()).toBe(zh.appsCustomLinkHostInvalid)
    expect(svc.users.setCustomStorage).not.toHaveBeenCalled()
  })

  it('新增:填名称+地址提交 → saveLinkApp 落盘,刷新列表并清空表单', async () => {
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    await w.find('[data-test="link-name"]').setValue('Router')
    await w.find('[data-test="link-hostname"]').setValue('http://192.168.1.1')
    await w.find('[data-test="link-submit"]').trigger('click')
    await flushPromises()
    expect(svc.users.setCustomStorage).toHaveBeenCalledWith('link', [
      { name: 'Router', hostname: 'http://192.168.1.1', icon: '', app_type: 'LinkApp', status: 'running' },
    ])
    expect((w.find('[data-test="link-name"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="link-row"]').text()).toContain('Router')
  })

  it('编辑:点「编辑」回填表单且名称字段锁定(Vue2 disableEditName 同款),提交只改 hostname/icon', async () => {
    svc.users.getCustomStorage.mockResolvedValue([{ name: 'MyNAS', hostname: 'http://old', icon: '' }])
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()
    await w.find('[data-test="link-edit"]').trigger('click')
    await nextTick()
    const nameInput = w.find('[data-test="link-name"]').element as HTMLInputElement
    expect(nameInput.value).toBe('MyNAS')
    expect(nameInput.disabled).toBe(true)

    await w.find('[data-test="link-hostname"]').setValue('http://new')
    await w.find('[data-test="link-submit"]').trigger('click')
    await flushPromises()
    expect(svc.users.setCustomStorage).toHaveBeenCalledWith('link', [
      { name: 'MyNAS', hostname: 'http://new', icon: '', app_type: 'LinkApp', status: 'running' },
    ])
  })

  it('删除:AlertDialog 确认后调 deleteLinkApp,取消不删', async () => {
    svc.users.getCustomStorage.mockResolvedValue([{ name: 'MyNAS', hostname: 'http://nas.local', icon: '' }])
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()

    await w.find('[data-test="link-delete"]').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain(zh.appsCustomLinkDeleteConfirm)

    // cancel: nothing persisted
    const cancelBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === zh.appsCancel)!
    cancelBtn.click()
    await flushPromises()
    expect(svc.users.setCustomStorage).not.toHaveBeenCalled()

    // delete again and confirm
    await w.find('[data-test="link-delete"]').trigger('click')
    await nextTick()
    const confirmBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === zh.appsCustomLinkDelete)!
    confirmBtn.click()
    await flushPromises()
    expect(svc.users.setCustomStorage).toHaveBeenCalledWith('link', [])
  })

  it('删除失败(deleteLinkApp reject)→ linkError 就地提示,不静默丢失(回归测试:防未捕获 rejection)', async () => {
    svc.users.getCustomStorage.mockResolvedValue([{ name: 'MyNAS', hostname: 'http://nas.local', icon: '' }])
    const { w } = await mountPage('/apps/custom?tab=link')
    await flushPromises()

    await w.find('[data-test="link-delete"]').trigger('click')
    await nextTick()
    svc.users.setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const confirmBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === zh.appsCustomLinkDelete)!
    confirmBtn.click()
    await flushPromises()

    expect(w.find('[data-test="link-error"]').text()).toBe('boom')
    // the list must not be cleared on delete failure (links is not reassigned after deleteLinkApp throws)
    expect(w.find('[data-test="link-row"]').exists()).toBe(true)
  })
})
