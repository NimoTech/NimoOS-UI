import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'

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

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

// 显式把 pinia 实例挂到 mount 的 global.plugins——本页在 setup 里同时挂了
// useInstalledAppsStore/useInstallProgressStore 两个 composable store,仅靠
// setActivePinia() 在多用例连续 mount 时曾观测到组件绑定到早前某次 beforeEach
// 创建的 pinia 实例(参照 StorePage.test.ts 的 T6 踩坑经验)。显式传入杜绝漂移。
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

  // 回归用例(SP5-P1 终审 CRITICAL):reka-ui 的 AlertDialogAction 本身是 DialogClose,
  // 点击真实的红色确认按钮时先派发 update:open(false) 再派发 @click 里的 confirm —— 旧实现
  // 用单个 uninstallTarget ref 同时装 open 状态与目标,update:open 处理器抢先把它置空,
  // confirm 读到 null 直接短路,store.uninstall(=service.compose.uninstall) 永远不会被调用。
  // 本用例挂载真实页面 + 真实 UninstallConfirm(不 mock reka),点击 Portal 到 document.body
  // 的真实按钮,复现该事件顺序;仅 mock 最外层的 service.compose 网络层。
  it('点击真实卸载确认弹窗的确认按钮,真正调用 service.compose.uninstall(id, {deleteConfigFolder:true})(默认勾选删数据,2026-07-21 用户拍板)', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { store_info: { title: { en_US: 'Jellyfin' }, icon: '', port_map: '8096', index: '/', scheme: 'http' }, status: 'running' },
    })
    const w = mount(InstalledAppsPage, { global: { plugins: [i18n, pinia] }, attachTo: document.body })
    await flushPromises()

    // 打开卸载确认弹窗:等价于用户点了卡片操作菜单里的「卸载」项(该项只是 emit('uninstall'),
    // 菜单本身的展开/收起走的是另一套 reka DropdownMenu,与本次要验证的 AlertDialog 事件顺序无关)。
    const card = w.findComponent(InstalledAppCard)
    await card.vm.$emit('uninstall')
    await nextTick() // reka 把 AlertDialogContent Portal 到 document.body 是异步的

    expect(document.body.textContent).toContain('确定要卸载 Jellyfin 吗')
    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '卸载')
    expect(confirmBtn).toBeTruthy()

    confirmBtn!.click() // 真实 DOM click:触发 reka 内部 onOpenChange(false) 之后再触发外层 @click 的 confirm
    await flushPromises()

    expect(svc.uninstall).toHaveBeenCalledTimes(1)
    expect(svc.uninstall).toHaveBeenCalledWith('jellyfin', { deleteConfigFolder: true })

    w.unmount()
  })
})
