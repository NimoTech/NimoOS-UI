import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import zh from '../../../i18n/zh_cn'
import PhotosSidebar from '../PhotosSidebar.vue'
import { useTimelineStore } from '../../stores/timeline'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../../composables/useSidebarDrawer'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/photos', name: 'photos', component: { template: '<div/>' } },
    { path: '/photos/favorites', name: 'photos-favorites', component: { template: '<div/>' } },
    { path: '/photos/trash', name: 'photos-trash', component: { template: '<div/>' } },
  ],
})

function mountSidebar() {
  return mount(PhotosSidebar, { global: { plugins: [i18n, testRouter] } })
}

describe('PhotosSidebar', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    __resetSidebarDrawerForTest()
    testRouter.push('/photos')
    await testRouter.isReady()
  })

  it('渲染三条导航项(照片库/收藏/最近删除),当前路由高亮', async () => {
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('照片库')
    expect(items[1].text()).toContain('收藏')
    expect(items[2].text()).toContain('最近删除')
    // 当前在 /photos,仅照片库项 active
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
  })

  it('/photos/favorites 时仅 favorites 项 active,library 不 active', async () => {
    await testRouter.push('/photos/favorites')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).toContain('active') // favorites active
    expect(items[2].classes()).not.toContain('active') // trash 不 active
  })

  it('存储条:按 indexStatus 渲染人类可读用量与百分比', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 5 * 1024 * 1024 * 1024 // 5GB
    store.indexStatus.diskTotal = 100 * 1024 * 1024 * 1024
    store.indexStatus.diskAvail = 40 * 1024 * 1024 * 1024 // used 60%
    const w = mountSidebar()
    expect(w.text()).toContain('GB')
    const bar = w.get('.storage-bar-fill')
    expect(bar.attributes('style')).toContain('60%')
  })

  it('存储条:diskTotal 为 0 时不除零(百分比落 0%)', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 0
    store.indexStatus.diskTotal = 0
    store.indexStatus.diskAvail = 0
    const w = mountSidebar()
    const bar = w.get('.storage-bar-fill')
    expect(bar.attributes('style')).toContain('0%')
  })

  it('桌面态(isNarrow=false):无遮罩、无 is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.photos-sidebar').classes()).not.toContain('is-drawer')
  })

  it('窄屏 + 打开:出遮罩,aside 带 is-drawer/is-open;点遮罩关闭', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    const w = mountSidebar()
    await nextTick()
    expect(w.find('.side-scrim').exists()).toBe(true)
    const aside = w.find('aside.photos-sidebar')
    expect(aside.classes()).toContain('is-drawer')
    expect(aside.classes()).toContain('is-open')
    await w.find('.side-scrim').trigger('click')
    expect(d.open.value).toBe(false)
    expect(w.find('.side-scrim').exists()).toBe(false)
  })

  it('ESC 关闭抽屉', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.open.value).toBe(false)
  })

  it('路由变化后抽屉自动收起', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    await testRouter.push('/')
    await flushPromises()
    await nextTick()
    expect(d.open.value).toBe(false)
  })
})
