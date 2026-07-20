import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  categories: vi.fn().mockResolvedValue([]),
  listApps: vi.fn().mockResolvedValue({ installed: ['jellyfin'], list: {} }),
  getApp: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { appstore: svc } }))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ name: 'apps-store-detail', fullPath: '/apps/store/jellyfin', params: { id: 'jellyfin' }, query: {} }),
}))

import StoreAppDetailPage from './StoreAppDetailPage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const DETAIL = {
  title: { en_us: 'Jellyfin' },
  tagline: { zh_cn: '个人媒体系统' },
  description: { zh_cn: '**强大**的媒体服务器' },
  icon: 'https://cdn/icon.png',
  screenshot_link: ['https://cdn/s1.png', 'https://cdn/s2.png'],
  category: 'Media',
  developer: 'Jellyfin',
}

describe('StoreAppDetailPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    svc.getApp.mockReset().mockResolvedValue(DETAIL)
    svc.listApps.mockClear()
    push.mockClear()
  })

  it('进页拉详情+补拉目录(判已装);渲染头部/meta/markdown 描述/截图', async () => {
    const w = mount(StoreAppDetailPage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(svc.getApp).toHaveBeenCalledWith('jellyfin')
    expect(svc.listApps).toHaveBeenCalledWith({}) // catalogLoaded=false 时补拉
    expect(w.text()).toContain('Jellyfin')
    expect(w.text()).toContain('个人媒体系统')
    expect(w.text()).toContain('Media')      // meta:分类
    expect(w.text()).toContain('Jellyfin')   // meta:开发者
    expect(w.get('.detail-desc').html()).toContain('<strong>强大</strong>') // markdown 渲染
    expect(w.findAll('.detail-shot')).toHaveLength(2)
    expect(w.text()).toContain('已安装')     // installed 含 jellyfin
  })

  it('未安装 → 安装按钮,点击 toast 占位文案(P3 接管真安装)', async () => {
    svc.listApps.mockResolvedValue({ installed: [], list: {} })
    const w = mount(StoreAppDetailPage, { global: { plugins: [i18n] } })
    await flushPromises()
    const btn = w.get('.detail-install')
    expect(btn.text()).toContain('安装')
    await btn.trigger('click')
    // toast store 是真 pinia:msg = 最新一条 toast 文案
    const { useToast } = await import('../../stores/toast')
    expect(useToast().msg).toContain('下一期')
  })

  it('详情加载失败 → 错误态 + 返回商店', async () => {
    svc.getApp.mockResolvedValue(undefined)
    const w = mount(StoreAppDetailPage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.text()).toContain('应用详情加载失败')
    await w.get('.detail-back').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'apps-store' })
  })

  it('点截图开放大层,ESC 关闭', async () => {
    const w = mount(StoreAppDetailPage, { attachTo: document.body, global: { plugins: [i18n] } })
    await flushPromises()
    await w.findAll('.detail-shot')[0].trigger('click')
    expect(w.find('.shot-zoom').exists()).toBe(true)
    expect(w.get('.shot-zoom img').attributes('src')).toBe('https://cdn/s1.png')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.shot-zoom').exists()).toBe(false)
    w.unmount()
  })
})
