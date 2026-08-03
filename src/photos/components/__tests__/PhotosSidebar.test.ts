import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import zh from '../../../i18n/zh_cn'
import PhotosSidebar from '../PhotosSidebar.vue'
import { useTimelineStore } from '../../stores/timeline'
import { usePhotosSettingsStore } from '../../stores/settings'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../../composables/useSidebarDrawer'

// P8a-T6(§7e-15):侧栏现在自己也读一次 aiFeatures 配置(见 PhotosSidebar.vue 头部注释)。
// 默认解析成 `{}`(readAiFeatures 对缺字段一律按开启处理,smartview 仍是 true)——这个默认值
// 让本文件其余既有测试(挂载后同步断言 7 项)保持不变:那些断言都发生在 fetchAiFeatures()
// 的 promise resolve 之前,读到的是 store 的初始值(全 true),不受这个 mock 影响。
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { getConfig: vi.fn() } },
}))
import { service } from '@nimotech/nimoos-service'

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
    { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
    // SP7-P8a-T5:设置入口的落点(见下方"设置入口"describe)。
    { path: '/photos/settings', name: 'photos-settings', component: { template: '<div/>' } },
  ],
})

function mountSidebar() {
  return mount(PhotosSidebar, { global: { plugins: [i18n, testRouter] } })
}

describe('PhotosSidebar', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    __resetSidebarDrawerForTest()
    vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
    testRouter.push('/photos')
    await testRouter.isReady()
  })

  // SP7-P7a-T4:NAV 新增 smart-views,插在 places 之后、favorites 之前——原本 6 项变 7 项,
  // favorites/trash 的下标各 +1(原 4/5 → 现 5/6)。顺序照 Vue2 PhotosSidebar.vue:114-118
  // (library / albums / people / places / smart)。
  it('渲染七条导航项(照片库/相册/人物/地点/智能视图/收藏/最近删除),当前路由高亮', async () => {
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(7)
    expect(items[0].text()).toContain('照片库')
    expect(items[1].text()).toContain('相册')
    expect(items[2].text()).toContain('人物')
    expect(items[3].text()).toContain('地点')
    expect(items[4].text()).toContain('智能视图')
    expect(items[5].text()).toContain('收藏')
    expect(items[6].text()).toContain('最近删除')
    // 当前在 /photos,仅照片库项 active
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
    expect(items[6].classes()).not.toContain('active')
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
    expect(items[4].classes()).not.toContain('active') // smart-views 不 active
    expect(items[5].classes()).toContain('active') // favorites active
    expect(items[6].classes()).not.toContain('active') // trash 不 active
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
    expect(items[4].classes()).not.toContain('active') // smart-views 不 active
    expect(items[5].classes()).not.toContain('active') // favorites 不 active
    expect(items[6].classes()).not.toContain('active') // trash 不 active
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
    expect(items[6].classes()).not.toContain('active')
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
    expect(items[4].classes()).not.toContain('active') // smart-views 不 active
    expect(items[5].classes()).not.toContain('active') // favorites 不 active
    expect(items[6].classes()).not.toContain('active') // trash 不 active
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
    expect(items[6].classes()).not.toContain('active')
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
    expect(items[4].classes()).not.toContain('active') // smart-views 不 active
    expect(items[5].classes()).not.toContain('active') // favorites 不 active
    expect(items[6].classes()).not.toContain('active') // trash 不 active
  })

  // SP7-P7a-T4:下标 4 是 smart-views(brief 硬要求同时断言"7 个条目"与"smart-views 在下标 4")。
  it('smart-views 在下标 4,且 /photos/smart-views 时仅该项 active', async () => {
    await testRouter.push('/photos/smart-views')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(7)
    expect(items[4].text()).toContain('智能视图')
    expect(items[0].classes()).not.toContain('active') // library 不 active
    expect(items[1].classes()).not.toContain('active') // albums 不 active
    expect(items[2].classes()).not.toContain('active') // people 不 active
    expect(items[3].classes()).not.toContain('active') // places 不 active
    expect(items[4].classes()).toContain('active') // smart-views active
    expect(items[5].classes()).not.toContain('active') // favorites 不 active
    expect(items[6].classes()).not.toContain('active') // trash 不 active
  })

  it('点击 smart-views 项(下标 4)push 到 /photos/smart-views', async () => {
    // beforeEach 已把 testRouter 停在 /photos——从别的路由点进来才是有意义的导航断言。
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    await items[4].trigger('click')
    await flushPromises()
    expect(testRouter.currentRoute.value.path).toBe('/photos/smart-views')
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

  // SP7-P8a-T5:侧栏底部设置入口,指向 /photos/settings。不用 .side-item 选择器
  // (那是 NAV 数组渲染出的既有 7 项,本条目是独立的新元素,故意用不同 class,不与
  // 上面"7 条导航项"的既有断言互相干扰)。
  describe('设置入口', () => {
    it('侧栏底部存在设置入口', () => {
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
      // 既有 7 项导航不受影响(不是新插进 NAV 数组的第 8 项)。
      expect(w.findAll('.side-item')).toHaveLength(7)
    })

    it('点击设置入口 push 到 /photos/settings', async () => {
      const w = mountSidebar()
      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
    })
  })

  // P8a-T6(§7e-15):smartview 配置感知——Vue2 PhotosSidebar.vue:120-122 的
  // `ai.smartview === false` 时 `items.filter(i => i.id !== 'smart')`。
  describe('smartview 配置感知(§7e-15)', () => {
    it('aiFeatures.smartview 为 false 时整条隐藏智能视图入口', async () => {
      vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: { smartview: false } })
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.side-item')
      expect(items).toHaveLength(6)
      expect(items.some((i) => i.text().includes('智能视图'))).toBe(false)
      // 剩下 6 项仍是原顺序去掉 smart-views 这一条(favorites/trash 紧跟 places)。
      expect(items[3].text()).toContain('地点')
      expect(items[4].text()).toContain('收藏')
      expect(items[5].text()).toContain('最近删除')
    })

    it('smartview 未确定(取数失败)时按开启显示,不吓用户', async () => {
      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.side-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('智能视图'))).toBe(true)
    })

    it('挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)', async () => {
      const settings = usePhotosSettingsStore()
      const spy = vi.spyOn(settings, 'fetchAiFeatures')
      mountSidebar()
      await flushPromises()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
