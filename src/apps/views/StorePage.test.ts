import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  categories: vi.fn().mockResolvedValue([{ id: 1, name: 'Media', count: 2 }]),
  listApps: vi.fn(),
  getApp: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { appstore: svc } }))

const push = vi.fn()
const replace = vi.fn()
const routeQuery: Record<string, string> = {}
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, replace }),
  useRoute: () => ({ name: 'apps-store', fullPath: '/apps/store', query: routeQuery }),
}))

import StorePage from './StorePage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const CATALOG = {
  installed: ['jellyfin'],
  list: {
    jellyfin: { title: { en_us: 'Jellyfin' }, tagline: { zh_cn: '个人媒体系统' }, icon: '', category: 'Media' },
    nextcloud: { title: { en_us: 'Nextcloud' }, tagline: { en_us: 'File sync' }, icon: '', category: 'Cloud' },
  },
}

describe('StorePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    for (const k of Object.keys(routeQuery)) delete routeQuery[k]
    svc.listApps.mockReset().mockResolvedValue(CATALOG)
    svc.categories.mockClear()
    push.mockClear(); replace.mockClear()
  })

  it('进区拉目录+Featured;渲染卡片网格与已装徽章', async () => {
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(svc.listApps).toHaveBeenCalledWith({})               // 目录
    expect(svc.listApps).toHaveBeenCalledWith({ recommend: true }) // Featured
    // 用同一份 CATALOG 兜底两路调用(目录+Featured),T4 起页面同时挂 FeaturedStrip——
    // 主网格卡片数收窄到 .apps-grid 范围内断言,避免把 Featured 带的卡片也计入
    expect(w.find('.apps-grid').findAll('.store-card')).toHaveLength(2)
    expect(w.text()).toContain('已安装') // jellyfin ∈ installed
  })

  it('目录为空 → 空态提示(非报错,spec §7.5)', async () => {
    svc.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.text()).toContain('没有找到应用')
  })

  it('加载失败 → 错误态 + 重试按钮,点击重拉', async () => {
    svc.listApps.mockRejectedValue(new Error('boom'))
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.text()).toContain('应用商店加载失败')
    svc.listApps.mockResolvedValue(CATALOG)
    await w.get('.store-retry').trigger('click')
    await flushPromises()
    expect(w.findAll('.store-card')).toHaveLength(2)
  })

  it('搜索输入 250ms 防抖后 replace 路由 query(前端过滤,深链)', async () => {
    vi.useFakeTimers()
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    await w.get('.store-search input').setValue('jelly')
    expect(replace).not.toHaveBeenCalled()
    vi.advanceTimersByTime(260)
    expect(replace).toHaveBeenCalledWith({ query: { search: 'jelly' } })
    vi.useRealTimers()
  })

  it('组件卸载后清理防抖定时器——不应在卸载后(如已跳转详情页)仍触发 replace', async () => {
    vi.useFakeTimers()
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    await w.get('.store-search input').setValue('jelly')
    w.unmount()
    vi.advanceTimersByTime(260)
    expect(replace).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('?search= 生效时前端过滤;点卡片进详情', async () => {
    routeQuery.search = 'jelly'
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    const cards = w.findAll('.store-card')
    expect(cards).toHaveLength(1)
    await cards[0].trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'apps-store-detail', params: { id: 'jellyfin' } })
  })

  it('点分类 chip → replace query;?category= 变化由 watch 重拉(后端参数)', async () => {
    routeQuery.category = 'Media'
    mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(svc.listApps).toHaveBeenCalledWith({ category: 'Media' })
  })

  it('Featured 带只在 无搜索+全部分类+全部来源 时显示', async () => {
    const w = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.featured-strip').exists()).toBe(true)
    w.unmount()

    routeQuery.search = 'jelly'
    const w2 = mount(StorePage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w2.find('.featured-strip').exists()).toBe(false)
  })
})
