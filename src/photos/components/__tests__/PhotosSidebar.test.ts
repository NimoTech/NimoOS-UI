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
    { path: '/photos/albums', name: 'photos-albums', component: { template: '<div/>' } },
    { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
    { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
    { path: '/photos/people/:id', name: 'photos-person-detail', component: { template: '<div/>' } },
    { path: '/photos/places', name: 'photos-places', component: { template: '<div/>' } },
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

  // P6a-T11:NAV 新增 places,插在 people 之后、favorites 之前——原本 5 项变 6 项,
  // favorites/trash 的下标各 +1(原 3/4 → 现 4/5)。
  it('渲染六条导航项(照片库/相册/人物/地点/收藏/最近删除),当前路由高亮', async () => {
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(6)
    expect(items[0].text()).toContain('照片库')
    expect(items[1].text()).toContain('相册')
    expect(items[2].text()).toContain('人物')
    expect(items[3].text()).toContain('地点')
    expect(items[4].text()).toContain('收藏')
    expect(items[5].text()).toContain('最近删除')
    // 当前在 /photos,仅照片库项 active
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
  })

  it('/photos/favorites 时仅 favorites 项 active,library 不 active', async () => {
    await testRouter.push('/photos/favorites')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).not.toContain('active') // albums 不 active
    expect(items[2].classes()).not.toContain('active') // people 不 active
    expect(items[3].classes()).not.toContain('active') // places 不 active
    expect(items[4].classes()).toContain('active') // favorites active
    expect(items[5].classes()).not.toContain('active') // trash 不 active
  })

  it('/photos/albums 时仅 albums 项 active', async () => {
    await testRouter.push('/photos/albums')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).toContain('active') // albums active
    expect(items[2].classes()).not.toContain('active') // people 不 active
    expect(items[3].classes()).not.toContain('active') // places 不 active
    expect(items[4].classes()).not.toContain('active') // favorites 不 active
    expect(items[5].classes()).not.toContain('active') // trash 不 active
  })

  it('/photos/albums/7(三级路径,相册详情)时仍只有 albums 项 active,library 不误伤', async () => {
    await testRouter.push('/photos/albums/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active(回归点)
    expect(items[1].classes()).toContain('active') // albums active
    expect(items[2].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
  })

  it('/photos/people 时仅 people 项 active', async () => {
    await testRouter.push('/photos/people')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).not.toContain('active') // albums 不 active
    expect(items[2].classes()).toContain('active') // people active
    expect(items[3].classes()).not.toContain('active') // places 不 active
    expect(items[4].classes()).not.toContain('active') // favorites 不 active
    expect(items[5].classes()).not.toContain('active') // trash 不 active
  })

  it('/photos/people/7(三级路径,人物详情)时仍只有 people 项 active,library 不误伤——核心回归点', async () => {
    await testRouter.push('/photos/people/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active(回归点:/photos 前缀不能双高亮)
    expect(items[1].classes()).not.toContain('active') // albums 不 active
    expect(items[2].classes()).toContain('active') // people active
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
  })

  it('/photos/places 时仅 places 项 active', async () => {
    await testRouter.push('/photos/places')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).not.toContain('active') // albums 不 active
    expect(items[2].classes()).not.toContain('active') // people 不 active
    expect(items[3].classes()).toContain('active') // places active
    expect(items[4].classes()).not.toContain('active') // favorites 不 active
    expect(items[5].classes()).not.toContain('active') // trash 不 active
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
