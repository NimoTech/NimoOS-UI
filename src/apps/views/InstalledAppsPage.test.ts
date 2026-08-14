import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue({}),
  uninstall: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: svc } }))

const busOn = vi.hoisted(() => vi.fn((..._args: unknown[]) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'apps', fullPath: '/apps' }),
}))

import InstalledAppsPage from './InstalledAppsPage.vue'
import InstalledAppCard from '../components/InstalledAppCard.vue'
import { useInstallProgressStore } from '../stores/installProgress'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Explicitly attach the pinia instance to mount's global.plugins — this page mounts both
// useInstalledAppsStore/useInstallProgressStore composable stores in setup; with
// setActivePinia() alone, components were observed binding to a pinia instance created by an
// earlier beforeEach across consecutive mounts (see StorePage.test.ts T6 lesson). Passing it explicitly rules out the drift.
let pinia: ReturnType<typeof createPinia>

function mountPage() {
  return mount(InstalledAppsPage, { global: { plugins: [i18n, pinia] } })
}

describe('InstalledAppsPage', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    svc.list.mockClear().mockResolvedValue({})
    svc.uninstall.mockClear()
    svc.get.mockClear().mockResolvedValue(undefined)
    busOn.mockClear()
  })

  it('进区拉列表;空列表渲染空态;订阅容器事件与 app 生命周期事件', async () => {
    const w = mountPage()
    await flushPromises()
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('还没有安装任何应用')
    const events = busOn.mock.calls.map((c) => c[0])
    expect(events).toContain('docker:container:state-changed')
    expect(events).toContain('app:start-begin')
    expect(events).toContain('app:uninstall-end')
  })

  it('有应用时渲染卡片网格', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { store_info: { title: { en_US: 'Jellyfin' }, icon: '', port_map: '8096', index: '/', scheme: 'http' }, status: 'running' },
    })
    const w = mountPage()
    await flushPromises()
    expect(w.find('.apps-grid').exists()).toBe(true)
    expect(w.text()).toContain('Jellyfin')
  })

  it('installProgress 有任务时页面顶部渲染安装中卡片;end 后消失', async () => {
    const w = mountPage()
    await flushPromises()
    const progress = useInstallProgressStore()
    progress.track('navidrome', 'Navidrome')
    await nextTick()
    expect(w.text()).toContain('Navidrome')
    expect(w.find('.op-progress').exists()).toBe(true)
    progress.onEvent('app:install-end', { 'app:name': 'navidrome' })
    await flushPromises()
    expect(w.find('.op-progress').exists()).toBe(false)
  })

  it('页面不再自订阅 app:install-end(D6:职责在 store)', async () => {
    const w = mountPage()
    await flushPromises()
    void w
    const evs = busOn.mock.calls.map((c) => c[0])
    expect(evs.filter((e) => e === 'app:install-end').length).toBeLessThanOrEqual(1)
  })

  // Regression case (SP5-P1 final review CRITICAL): reka-ui's AlertDialogAction is itself a DialogClose,
  // so clicking the real red confirm button dispatches update:open(false) before the confirm in @click — the old
  // implementation used a single uninstallTarget ref for both the open state and the target; the update:open
  // handler nulled it first, confirm read null and short-circuited, so store.uninstall (=service.compose.uninstall) was never called.
  // This case mounts the real page + real UninstallConfirm (reka not mocked) and clicks the real button
  // Portaled to document.body, reproducing that event order; only the outermost service.compose network layer is mocked.
  it('点击真实卸载确认弹窗的确认按钮,真正调用 service.compose.uninstall(id, {deleteConfigFolder:true})(默认勾选删数据,2026-07-21 用户拍板)', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { store_info: { title: { en_US: 'Jellyfin' }, icon: '', port_map: '8096', index: '/', scheme: 'http' }, status: 'running' },
    })
    const w = mount(InstalledAppsPage, { global: { plugins: [i18n, pinia] }, attachTo: document.body })
    await flushPromises()

    // Open the uninstall confirm dialog: equivalent to the user clicking the "Uninstall" item in the card's
    // action menu (that item only does emit('uninstall'); the menu's own open/close goes through a separate
    // reka DropdownMenu, unrelated to the AlertDialog event order under test here).
    const card = w.findComponent(InstalledAppCard)
    await card.vm.$emit('uninstall')
    await nextTick() // reka Portals AlertDialogContent to document.body asynchronously

    expect(document.body.textContent).toContain('确定要卸载 Jellyfin 吗')
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '卸载')
    expect(confirmBtn).toBeTruthy()

    confirmBtn!.click() // real DOM click: triggers reka's internal onOpenChange(false) before the outer @click confirm
    await flushPromises()

    expect(svc.uninstall).toHaveBeenCalledTimes(1)
    expect(svc.uninstall).toHaveBeenCalledWith('jellyfin', { deleteConfigFolder: true })

    w.unmount()
  })
})

describe('安装中卡片「停止并删除」(用户验收诉求:幽灵卡可手动清除)', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    svc.list.mockClear().mockResolvedValue({})
    svc.uninstall.mockClear().mockResolvedValue(undefined)
    svc.get.mockClear().mockResolvedValue(undefined)
    busOn.mockClear()
  })

  it('点 ✕ → 确认框 → 确认后任务被 dismiss 且尽力调 uninstall', async () => {
    const w = mountPage()
    const progress = useInstallProgressStore()
    progress.track('ghost-app', 'ghost-app')
    await flushPromises()
    await w.find('[data-test="install-cancel"]').trigger('click')
    await flushPromises()
    const confirmBtn = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('停止并删除'))
    expect(confirmBtn).toBeTruthy()
    confirmBtn!.click()
    await flushPromises()
    expect(progress.tasks['ghost-app']).toBeUndefined()
    expect(svc.uninstall).toHaveBeenCalledWith('ghost-app', { deleteConfigFolder: true })
  })

  it('uninstall 404 拒绝也不影响卡片移除(尽力而为语义)', async () => {
    svc.uninstall.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }))
    const w = mountPage()
    const progress = useInstallProgressStore()
    progress.track('ghost-app', 'ghost-app')
    await flushPromises()
    await w.find('[data-test="install-cancel"]').trigger('click')
    await flushPromises()
    const confirmBtn = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('停止并删除'))
    confirmBtn!.click()
    await flushPromises()
    expect(progress.tasks['ghost-app']).toBeUndefined()
  })
})
