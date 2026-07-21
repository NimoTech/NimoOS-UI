import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  appstore: {
    categories: vi.fn().mockResolvedValue([]),
    listApps: vi.fn().mockResolvedValue({ installed: ['jellyfin'], list: {} }),
    getApp: vi.fn(),
    getAppCompose: vi.fn(),
  },
  compose: {
    install: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue({}),
  },
  sys: {
    hardwareInfo: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const busOn = vi.hoisted(() => vi.fn((..._args: unknown[]) => () => {}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ name: 'apps-store-detail', fullPath: '/apps/store/jellyfin', params: { id: 'jellyfin' }, query: {} }),
}))

import StoreAppDetailPage from './StoreAppDetailPage.vue'
import { useInstallProgressStore } from '../stores/installProgress'
import { __resetDeviceArchForTest } from '../composables/useDeviceArch'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const ID = 'jellyfin'
const DETAIL = {
  title: { en_us: 'Jellyfin' },
  tagline: { zh_cn: '个人媒体系统' },
  description: { zh_cn: '**强大**的媒体服务器' },
  icon: 'https://cdn/icon.png',
  screenshot_link: ['https://cdn/s1.png', 'https://cdn/s2.png'],
  category: 'Media',
  developer: 'Jellyfin',
}

// 显式把 pinia 实例挂到 mount 的 global.plugins——T6 StorePage.test.ts 同款教训:仅靠
// setActivePinia() 在连续 mount 同一带多个 composable(useInstallFlow/useDeviceArch/
// useInstallProgressStore)的页面时,曾观测到组件绑定到早前某次 beforeEach 的 pinia 实例。
let pinia: ReturnType<typeof createPinia>

/** 沿本文件既有挂载写法:detailOverrides 合入 fixture detail(如 architectures) */
function mountDetail(detailOverrides: Record<string, unknown> = {}) {
  svc.appstore.getApp.mockResolvedValue({ ...DETAIL, ...detailOverrides })
  return mount(StoreAppDetailPage, { global: { plugins: [i18n, pinia] } })
}

describe('StoreAppDetailPage', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    __resetDeviceArchForTest()
    svc.appstore.getApp.mockReset().mockResolvedValue(DETAIL)
    svc.appstore.listApps.mockReset().mockResolvedValue({ installed: ['jellyfin'], list: {} })
    svc.appstore.categories.mockClear()
    svc.appstore.getAppCompose.mockReset().mockResolvedValue('services: {}')
    svc.compose.install.mockReset().mockResolvedValue(undefined)
    svc.compose.get.mockReset()
    svc.compose.list.mockReset().mockResolvedValue({})
    svc.sys.hardwareInfo.mockReset().mockResolvedValue({ arch: 'amd64' })
    busOn.mockClear()
    push.mockClear()
  })

  it('进页拉详情+补拉目录(判已装);渲染头部/meta/markdown 描述/截图', async () => {
    const w = await mountDetail()
    await flushPromises()
    expect(svc.appstore.getApp).toHaveBeenCalledWith('jellyfin')
    expect(svc.appstore.listApps).toHaveBeenCalledWith({}) // catalogLoaded=false 时补拉
    expect(w.text()).toContain('Jellyfin')
    expect(w.text()).toContain('个人媒体系统')
    expect(w.text()).toContain('Media')      // meta:分类
    expect(w.text()).toContain('Jellyfin')   // meta:开发者
    expect(w.get('.detail-desc').html()).toContain('<strong>强大</strong>') // markdown 渲染
    expect(w.findAll('.detail-shot')).toHaveLength(2)
    expect(w.text()).toContain('已安装')     // installed 含 jellyfin
  })

  it('未安装 → 点击安装走真实链路:dry_run→install→出现安装中%', async () => {
    svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = await mountDetail()
    await flushPromises()
    const btn = w.get('.detail-install')
    expect(btn.text()).toContain('安装')
    await btn.trigger('click')
    await flushPromises()
    expect(svc.compose.install).toHaveBeenNthCalledWith(1, 'services: {}', { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, 'services: {}', { checkPortConflict: true })
    expect(w.text()).toContain('0') // track 后 percent=0 → 安装中 0%
  })

  it('详情加载失败 → 错误态 + 返回商店', async () => {
    svc.appstore.getApp.mockResolvedValue(undefined)
    const w = mount(StoreAppDetailPage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(w.text()).toContain('应用详情加载失败')
    await w.get('.detail-back').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'apps-store' })
  })

  it('点截图开放大层,ESC 关闭', async () => {
    svc.appstore.getApp.mockResolvedValue(DETAIL)
    const w = mount(StoreAppDetailPage, { attachTo: document.body, global: { plugins: [i18n, pinia] } })
    await flushPromises()
    await w.findAll('.detail-shot')[0].trigger('click')
    expect(w.find('.shot-zoom').exists()).toBe(true)
    expect(w.get('.shot-zoom img').attributes('src')).toBe('https://cdn/s1.png')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.shot-zoom').exists()).toBe(false)
    w.unmount()
  })

  it('详情页安装:installing 态显示进度条与百分比', async () => {
    svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = await mountDetail()
    await flushPromises()
    await w.find('.detail-install').trigger('click')
    await flushPromises()
    // track 后 percent=0;推一个 progress 事件到 64
    useInstallProgressStore().onEvent('app:install-progress', { 'app:name': ID, 'app:progress': '64' })
    await nextTick()
    expect(w.find('.op-progress-fill').attributes('style')).toContain('64%')
    expect(w.text()).toContain('64')
  })

  it('install-error → 内联错误文案 + 可重试', async () => {
    svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = await mountDetail()
    await flushPromises()
    await w.find('.detail-install').trigger('click')
    await flushPromises()
    useInstallProgressStore().onEvent('app:install-error', { 'app:name': ID, message: 'pull failed' })
    await nextTick()
    expect(w.text()).toContain('pull failed')
    expect(w.find('.detail-install').exists()).toBe(true) // 重试按钮
  })

  it('架构不兼容:按钮禁用 + 提示文案', async () => {
    localStorage.setItem('arch', 'amd64')
    svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = await mountDetail({ architectures: ['arm64'] })
    await flushPromises()
    expect((w.find('.detail-install').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.text()).toContain('amd64')
  })

  it('shows REQUIRE MEMORY meta item when store compose declares reservations.memory', async () => {
    svc.appstore.getAppCompose.mockResolvedValue(
      'services:\n  demo:\n    deploy:\n      resources:\n        reservations:\n          memory: 256M\n',
    )
    const w = await mountDetail()
    await flushPromises()
    const memItem = w.find('[data-test="detail-min-memory"]')
    expect(memItem.exists()).toBe(true)
    expect(memItem.text()).toContain('256 MB')
  })

  it('hides the item when compose fetch fails or no reservation', async () => {
    svc.appstore.getAppCompose.mockRejectedValue(new Error('nope'))
    const w = await mountDetail()
    await flushPromises()
    expect(w.find('[data-test="detail-min-memory"]').exists()).toBe(false)
  })
})
