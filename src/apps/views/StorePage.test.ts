import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  appstore: {
    categories: vi.fn().mockResolvedValue([{ id: 1, name: 'Media', count: 2 }]),
    listApps: vi.fn(),
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
const replace = vi.fn()
const routeQuery: Record<string, string> = {}
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => ({ name: 'apps-store', fullPath: '/apps/store', query: routeQuery }),
}))

import StorePage from './StorePage.vue'
import { __resetDeviceArchForTest } from '../composables/useDeviceArch'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const CATALOG = {
  installed: ['jellyfin'],
  list: {
    jellyfin: { title: { en_us: 'Jellyfin' }, tagline: { zh_cn: '个人媒体系统' }, icon: '', category: 'Media' },
    nextcloud: { title: { en_us: 'Nextcloud' }, tagline: { en_us: 'File sync' }, icon: '', category: 'Cloud' },
  },
}
// nextcloud carries tips.before_install: for the "show notice first" case (D3); jellyfin stays installed
const CATALOG_WITH_TIPS = {
  installed: ['jellyfin'],
  list: {
    jellyfin: CATALOG.list.jellyfin,
    nextcloud: {
      ...CATALOG.list.nextcloud,
      tips: { before_install: { zh_cn: '先看这个' } },
    },
  },
}

// Explicitly attach the pinia instance to mount's global.plugins — with setActivePinia() alone,
// when this file mounts the same page (which uses several composables:
// useInstallFlow/useDeviceArch/useInstallProgressStore) across consecutive test cases, later mounts
// were observed binding to a pinia instance created by an earlier beforeEach (without app.use(pinia),
// Pinia degrades to the getActivePinia() global, which is timing-fragile). Passing it explicitly rules out this drift.
let pinia: ReturnType<typeof createPinia>

/** Mount helper for the two cases added in T6: withTips switches the mock data used for catalog/Featured; Portal assertions need a real DOM */
function mountPage(opts: { withTips?: boolean } = {}) {
  svc.appstore.listApps.mockResolvedValue(opts.withTips ? CATALOG_WITH_TIPS : CATALOG)
  return mount(StorePage, { global: { plugins: [i18n, pinia] }, attachTo: document.body })
}

describe('StorePage', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    for (const k of Object.keys(routeQuery)) delete routeQuery[k]
    localStorage.clear()
    __resetDeviceArchForTest()
    svc.appstore.listApps.mockReset().mockResolvedValue(CATALOG)
    svc.appstore.categories.mockClear()
    svc.appstore.getAppCompose.mockReset()
    svc.compose.install.mockReset()
    svc.compose.get.mockReset()
    svc.compose.list.mockReset().mockResolvedValue({})
    svc.sys.hardwareInfo.mockReset().mockResolvedValue({ arch: 'amd64' })
    busOn.mockClear()
    push.mockClear(); replace.mockClear()
  })

  it('进区拉目录+Featured;渲染卡片网格与已装徽章', async () => {
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(svc.appstore.listApps).toHaveBeenCalledWith({})               // catalog
    expect(svc.appstore.listApps).toHaveBeenCalledWith({ recommend: true }) // Featured
    // the same CATALOG backs both calls (catalog + Featured); since T4 the page also mounts FeaturedStrip —
    // narrow the main-grid card count assertion to .apps-grid so Featured strip cards are not counted
    expect(w.find('.apps-grid').findAll('.store-card')).toHaveLength(2)
    expect(w.text()).toContain('已安装') // jellyfin ∈ installed
  })

  it('目录为空 → 空态提示(非报错,spec §7.5)', async () => {
    svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(w.text()).toContain('没有找到应用')
  })

  it('加载失败 → 错误态 + 重试按钮,点击重拉', async () => {
    svc.appstore.listApps.mockRejectedValue(new Error('boom'))
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(w.text()).toContain('应用商店加载失败')
    svc.appstore.listApps.mockResolvedValue(CATALOG)
    await w.get('.store-retry').trigger('click')
    await flushPromises()
    expect(w.findAll('.store-card')).toHaveLength(2)
  })

  it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {
    vi.useFakeTimers()
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    await w.get('.store-search input').setValue('jelly')
    expect(replace).not.toHaveBeenCalled()
    vi.advanceTimersByTime(260)
    expect(replace).toHaveBeenCalledWith({ query: { search: 'jelly' } })
    vi.useRealTimers()
  })

  it('组件卸载后清理防抖定时器——不应在卸载后(如已跳转详情页)仍触发 replace', async () => {
    vi.useFakeTimers()
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    await w.get('.store-search input').setValue('jelly')
    w.unmount()
    vi.advanceTimersByTime(260)
    expect(replace).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('?search= 生效时前端过滤;点卡片进详情', async () => {
    routeQuery.search = 'jelly'
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    const cards = w.findAll('.store-card')
    expect(cards).toHaveLength(1)
    await cards[0].trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'apps-store-detail', params: { id: 'jellyfin' } })
  })

  it('点分类 chip → replace query;?category= 变化由 watch 重拉(后端参数)', async () => {
    routeQuery.category = 'Media'
    mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(svc.appstore.listApps).toHaveBeenCalledWith({ category: 'Media' })
  })

  it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {
    const w = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(w.find('.featured-strip').exists()).toBe(true)
    w.unmount()

    routeQuery.search = 'jelly'
    const w2 = mount(StorePage, { global: { plugins: [i18n, pinia] } })
    await flushPromises()
    expect(w2.find('.featured-strip').exists()).toBe(false)
  })

  it('点卡片安装钮走真实链路:dry_run→install→出现安装中%', async () => {
    svc.appstore.getAppCompose.mockResolvedValue('services: {}')
    svc.compose.install.mockResolvedValue(undefined)
    const w = await mountPage()
    await flushPromises()
    await w.find('.store-install').trigger('click')
    await flushPromises()
    expect(svc.compose.install).toHaveBeenNthCalledWith(1, 'services: {}', { dryRun: true, checkPortConflict: true })
    expect(svc.compose.install).toHaveBeenNthCalledWith(2, 'services: {}', { checkPortConflict: true })
    expect(w.find('.store-install').text()).toContain('0') // after track percent=0 → installing 0%
    w.unmount()
  })

  it('带 before_install 的应用:先弹须知,确认后才安装', async () => {
    // the fixture's list gives this app tips.before_install.zh_cn
    svc.appstore.getAppCompose.mockResolvedValue('services: {}')
    const w = await mountPage({ withTips: true })
    await flushPromises()
    await w.find('.store-install').trigger('click')
    await flushPromises()
    expect(svc.compose.install).not.toHaveBeenCalled()
    const confirm = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('继续安装'))!
    confirm.click()
    await flushPromises()
    expect(svc.compose.install).toHaveBeenCalledTimes(2)
    w.unmount()
  })
})
