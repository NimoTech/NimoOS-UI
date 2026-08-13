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
import { usePhotosFavorites } from '../../stores/favorites'
import { useSessionStore } from '../../../stores/session'
import { usePhotosTheme, __resetPhotosThemeForTests } from '../../composables/usePhotosTheme'
import { useSidebarDrawer, __resetSidebarDrawerForTest } from '../../../composables/useSidebarDrawer'

// Task 3(壳 + 侧栏重刻):re-skinned to the Vue2 pixel baseline — selectors below moved from
// New-UI's old `.photos-sidebar`/`.side-item`/`.side-name`/`.storage-bar-fill` to Vue2's own
// `.sidebar`/`.nav-item[data-active]`/`.storage-mini`/`.icon-btn` (PhotosSidebar.vue.vue2.
// script-level behavior — NAV table, isActive-by-route, storage percent, router.push, the
// aiFeatures smartview filter, the mobile drawer — is unchanged; only classes/DOM structure
// and the two new things (theme toggle, collapsed prop) moved.
//
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

function mountSidebar(props: Record<string, unknown> = {}) {
  return mount(PhotosSidebar, { props, global: { plugins: [i18n, testRouter] } })
}

describe('PhotosSidebar', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    __resetSidebarDrawerForTest()
    localStorage.clear()
    __resetPhotosThemeForTests()
    vi.mocked(service.photos.getConfig).mockReset().mockResolvedValue({})
    testRouter.push('/photos')
    await testRouter.isReady()
  })

  // SP7-P7a-T4:NAV 新增 smart-views,插在 places 之后、favorites 之前——原本 6 项变 7 项,
  // favorites/trash 的下标各 +1(原 4/5 → 现 5/6)。顺序照 Vue2 PhotosSidebar.vue:114-118
  // (library / albums / people / places / smart)。
  it('渲染七条导航项(照片库/相册/人物/地点/为你推荐/收藏/最近删除),当前路由高亮', async () => {
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items).toHaveLength(7)
    expect(items[0].text()).toContain('照片库')
    expect(items[1].text()).toContain('相册')
    expect(items[2].text()).toContain('人物')
    expect(items[3].text()).toContain('地点')
    expect(items[4].text()).toContain('为你推荐')
    expect(items[5].text()).toContain('收藏')
    expect(items[6].text()).toContain('最近删除')
    // 当前在 /photos,仅照片库项 active(Vue2 用 data-active 属性,不是 class)
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('/photos/favorites 时仅 favorites 项 active,library 不 active', async () => {
    await testRouter.push('/photos/favorites')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library 不 active
    expect(items[1].attributes('data-active')).toBe('false') // albums 不 active
    expect(items[2].attributes('data-active')).toBe('false') // people 不 active
    expect(items[3].attributes('data-active')).toBe('false') // places 不 active
    expect(items[4].attributes('data-active')).toBe('false') // smart-views 不 active
    expect(items[5].attributes('data-active')).toBe('true') // favorites active
    expect(items[6].attributes('data-active')).toBe('false') // trash 不 active
  })

  it('/photos/albums 时仅 albums 项 active', async () => {
    await testRouter.push('/photos/albums')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('true')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('/photos/albums/7(三级路径,相册详情)时仍只有 albums 项 active,library 不误伤', async () => {
    await testRouter.push('/photos/albums/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library 不 active(回归点)
    expect(items[1].attributes('data-active')).toBe('true')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('/photos/people 时仅 people 项 active', async () => {
    await testRouter.push('/photos/people')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('true')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('/photos/people/7(三级路径,人物详情)时仍只有 people 项 active,library 不误伤——核心回归点', async () => {
    await testRouter.push('/photos/people/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library 不 active(回归点:/photos 前缀不能双高亮)
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('true')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('/photos/places 时仅 places 项 active', async () => {
    await testRouter.push('/photos/places')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('true')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  // SP7-P7a-T4:下标 4 是 smart-views(brief 硬要求同时断言"7 个条目"与"smart-views 在下标 4")。
  it('smart-views 在下标 4,且 /photos/smart-views 时仅该项 active', async () => {
    await testRouter.push('/photos/smart-views')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items).toHaveLength(7)
    expect(items[4].text()).toContain('为你推荐')
    expect(items[0].attributes('data-active')).toBe('false')
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('true')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('点击 smart-views 项(下标 4)push 到 /photos/smart-views', async () => {
    // beforeEach 已把 testRouter 停在 /photos——从别的路由点进来才是有意义的导航断言。
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
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
    expect(w.get('.storage-mini-usage').text()).toContain('GB')
    expect(w.get('.storage-mini-usage').text()).toContain('60%')
    const bar = w.get('.storage-mini-bar > div')
    expect(bar.attributes('style')).toContain('60%')
  })

  it('存储条:diskTotal 为 0 时不除零(百分比落 0%,不渲染用量文字)', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 0
    store.indexStatus.diskTotal = 0
    store.indexStatus.diskAvail = 0
    const w = mountSidebar()
    expect(w.find('.storage-mini-usage').exists()).toBe(false)
    const bar = w.get('.storage-mini-bar > div')
    expect(bar.attributes('style')).toContain('0%')
  })

  it('桌面态(isNarrow=false):无遮罩、无 is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.sidebar').classes()).not.toContain('is-drawer')
  })

  it('窄屏 + 打开:出遮罩,aside 带 is-drawer/is-open;点遮罩关闭', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    const w = mountSidebar()
    await nextTick()
    expect(w.find('.side-scrim').exists()).toBe(true)
    const aside = w.find('aside.sidebar')
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

  // SP7-P8a-T5:侧栏头部设置入口(Task 3 起从侧栏底部移到 sidebar-head,照 Vue2
  // PhotosSidebar.vue:34-35),指向 /photos/settings。
  describe('设置入口', () => {
    it('侧栏头部存在设置入口', () => {
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
      // 既有 7 项导航不受影响(不是新插进 NAV 数组的第 8 项)。
      expect(w.findAll('.nav-item')).toHaveLength(7)
    })

    it('点击设置入口 push 到 /photos/settings', async () => {
      const w = mountSidebar()
      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
    })
  })

  // Task 3:sidebar-head 主题切换按钮 —— Vue2 PhotosSidebar.vue:27-33 的实际主题开关落点。
  describe('主题切换按钮(Task 3)', () => {
    it('默认(dark)显示"切换到浅色主题";点击调用 usePhotosTheme().set 切到 light,再点切回 dark', async () => {
      const w = mountSidebar()
      const themeBtn = w.get('.sidebar-head').findAll('.icon-btn')[0]
      expect(themeBtn.attributes('title')).toBe('切换到浅色主题')

      await themeBtn.trigger('click')
      expect(usePhotosTheme().theme.value).toBe('light')
      await nextTick()
      const themeBtnAfter = w.get('.sidebar-head').findAll('.icon-btn')[0]
      expect(themeBtnAfter.attributes('title')).toBe('切换到深色主题')

      await themeBtnAfter.trigger('click')
      expect(usePhotosTheme().theme.value).toBe('dark')
    })

    it('切到 light 后落盘到 localStorage(与 PhotosSettings 页的开关共享同一个单例)', async () => {
      const w = mountSidebar()
      await w.get('.sidebar-head').findAll('.icon-btn')[0].trigger('click')
      expect(localStorage.getItem('nimo_photos_theme')).toBe('light')
    })
  })

  // Task 3:collapsed prop —— 折叠态渲染居中 icon 列,不渲染展开态的 sidebar-head/nav-item。
  describe('折叠态(collapsed prop,Task 3)', () => {
    it('collapsed=true 时渲染 7 个 .icon-btn(nav1+nav2 合并),不渲染 .nav-item/.brand-name', () => {
      const w = mountSidebar({ collapsed: true })
      expect(w.find('.nav-item').exists()).toBe(false)
      expect(w.find('.brand-name').exists()).toBe(false)
      expect(w.find('.brand-icon').exists()).toBe(true)
      expect(w.findAll('.icon-btn')).toHaveLength(7)
    })

    it('collapsed=true 时点击某个 icon-btn 仍按其 route 导航', async () => {
      const w = mountSidebar({ collapsed: true })
      await w.findAll('.icon-btn')[1].trigger('click') // albums
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/albums')
    })

    it('collapsed=false(默认)渲染展开态结构', () => {
      const w = mountSidebar()
      expect(w.find('.sidebar-head').exists()).toBe(true)
      expect(w.find('.brand-name').text()).toBe('相册')
    })
  })

  // Task 3:「Photo library」抽屉开合 —— Vue2 PhotosSidebar.vue:51-76 的 nav2(favorites/
  // trash)collapsible section,默认展开(data() { libraryOpen: true })。
  describe('「照片库」抽屉开合(Task 3)', () => {
    it('默认展开:7 个 .nav-item 全部可见;点击 .nav-label 收起后只剩 5 个(favorites/trash 隐藏);再点恢复 7 个', async () => {
      const w = mountSidebar()
      expect(w.findAll('.nav-item')).toHaveLength(7)
      await w.get('.nav-label').trigger('click')
      expect(w.findAll('.nav-item')).toHaveLength(5)
      expect(w.findAll('.nav-item').some((n) => n.text().includes('收藏'))).toBe(false)
      await w.get('.nav-label').trigger('click')
      expect(w.findAll('.nav-item')).toHaveLength(7)
    })
  })

  // Task 3:brand-user —— Vue2 PhotosSidebar.vue:25 的 displayName,New-UI 用 session store。
  describe('brand-user(Task 3)', () => {
    it('已登录时 sidebar-head 显示用户名', () => {
      useSessionStore().setUser({ username: 'yu' })
      const w = mountSidebar()
      expect(w.get('.brand-user').text()).toBe('yu')
    })

    it('无用户名时不渲染 .brand-user', () => {
      const w = mountSidebar()
      expect(w.find('.brand-user').exists()).toBe(false)
    })
  })

  // Task 3:favorites 徽标 —— 源自 usePhotosFavorites(),仅在 favIdsLoaded 时显示。
  describe('favorites 徽标(Task 3)', () => {
    it('favIdsLoaded 时,收藏项显示 .nav-count 数字', () => {
      const fav = usePhotosFavorites()
      fav.favIds = new Set(['1', '2', '3'])
      fav.favIdsLoaded = true
      const w = mountSidebar()
      const favItem = w.findAll('.nav-item').find((n) => n.text().includes('收藏'))
      expect(favItem?.find('.nav-count').text()).toBe('3')
    })

    it('favIds 尚未取到(默认)时,收藏项不显示 .nav-count', () => {
      const w = mountSidebar()
      const favItem = w.findAll('.nav-item').find((n) => n.text().includes('收藏'))
      expect(favItem?.find('.nav-count').exists()).toBe(false)
    })

    it('trash 项本任务不接徽标(已登记的范围外缺口,见组件头部注释)', () => {
      const w = mountSidebar()
      const trashItem = w.findAll('.nav-item').find((n) => n.text().includes('最近删除'))
      expect(trashItem?.find('.nav-count').exists()).toBe(false)
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
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(6)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(false)
      // 剩下 6 项仍是原顺序去掉 smart-views 这一条(favorites/trash 紧跟 places)。
      expect(items[3].text()).toContain('地点')
      expect(items[4].text()).toContain('收藏')
      expect(items[5].text()).toContain('最近删除')
    })

    // review fix(take-along):原标题「未确定(取数失败)」的外层「未确定」措辞会让人以为
    // 这条测的是"尚未取到数"(fetch 还在途、还没 resolve)的那个分支——但下面 await
    // flushPromises() 会先把 reject 结算掉,这里实际只走到了"取数失败"这个 catch 分支
    // (恰好与初始值同为全 true,视觉上分不出来,但走的是不同代码路径)。标题去掉「未确定」,
    // 明确写成"失败"。真正的"尚未取到数"分支由下面新增的同步用例补上。
    it('smartview 请求失败(store 落入 catch 分支)时按开启显示,不吓用户', async () => {
      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
    })

    // review fix(take-along):补上真正的"尚未取到数"分支——mount 之后不 flushPromises,
    // fetchAiFeatures() 的 promise 还在途,store 的 aiFeatures 停在初始值(全 true)。
    // 与上一条(失败分支落回全 true)在数值上恰好相同,但走的是不同代码路径(这里从没进过
    // catch,是初始 ref 值),补这条才是名副其实的"加载中按开启显示"证明。
    it('smartview 请求仍在途(尚未 resolve)时按开启显示,同步渲染 7 项', () => {
      let resolveFn: ((v: Record<string, unknown>) => void) | undefined
      vi.mocked(service.photos.getConfig).mockImplementation(
        () => new Promise<Record<string, unknown>>((res) => { resolveFn = res }),
      )
      const w = mountSidebar()
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
      // 收尾:把挂起的 promise 结算掉,不让它泄漏到下一条用例。
      resolveFn?.({})
    })

    it('挂载即调用一次 fetchAiFeatures(经 store 读配置,不直读 getConfig)', async () => {
      const settings = usePhotosSettingsStore()
      const spy = vi.spyOn(settings, 'fetchAiFeatures')
      mountSidebar()
      await flushPromises()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  // Plan C Task 2, review fix round 1 (Important 1): AreaShell's ☰ was the ONLY way to open
  // the sidebar drawer on a ≤768px viewport for every photos-area page except Photos.vue
  // (which gets its own toggle from PhotosTopbar). Once the five re-shelled album/for-you
  // views drop AreaShell, that entry point vanishes with nothing to replace it — a confirmed
  // live regression, not a hypothetical one. Fix: PhotosSidebar owns a small floating trigger
  // of its own, rendered only when there is a real gap to fill (narrow + drawer closed), so
  // every current and future sister page gets it for free without a topbar of its own.
  // `hideDrawerTrigger` lets Photos.vue opt out — its own PhotosTopbar button already does
  // this job, and rendering both would be a redundant double affordance.
  describe('移动端抽屉浮动触发按钮(review fix round 1)', () => {
    it('窄屏 + 抽屉关闭:渲染触发按钮;点击调用 drawer.toggle() 打开抽屉', async () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = true
      d.open.value = false
      const w = mountSidebar()
      await nextTick()
      const btn = w.find('[data-test="sidebar-drawer-trigger"]')
      expect(btn.exists()).toBe(true)
      await btn.trigger('click')
      expect(d.open.value).toBe(true)
    })

    it('窄屏 + 抽屉已打开:不渲染触发按钮(抽屉本身已经盖满,不需要重复入口)', async () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = true
      d.open.value = true
      const w = mountSidebar()
      await nextTick()
      expect(w.find('[data-test="sidebar-drawer-trigger"]').exists()).toBe(false)
    })

    it('桌面态(isNarrow=false):不渲染触发按钮', () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = false
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-drawer-trigger"]').exists()).toBe(false)
    })

    it('hideDrawerTrigger=true(Photos.vue 用它避免和 PhotosTopbar 自己的折叠钮双入口):即使窄屏+抽屉关闭也不渲染', async () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = true
      d.open.value = false
      const w = mountSidebar({ hideDrawerTrigger: true })
      await nextTick()
      expect(w.find('[data-test="sidebar-drawer-trigger"]').exists()).toBe(false)
    })
  })

  // SP15-P2b Task 5: the smart-views entry's label changes to "For You" now that its page
  // is Moments-only, but its id/route stay so the ?view=smart deep link and the
  // aiFeatures.smartview hide-when-off filter above keep working unmodified.
  it('labels the smart-views entry "For You" after the IA merge, and drops the old "Smart Views" label entirely', () => {
    const w = mountSidebar()
    const texts = w.findAll('.nav-item').map((n) => n.text())
    expect(texts.some((t) => t.includes('为你推荐'))).toBe(true)
    expect(texts.some((t) => t.includes('智能视图'))).toBe(false)
  })
})
