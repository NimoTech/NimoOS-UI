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

// P8a-T6(§7e-15): sidebar now reads aiFeatures config once itself (see PhotosSidebar.vue header comment).
// Default parses to `{}` (readAiFeatures treats missing fields as enabled, smartview is still true) — this default value
// keeps the rest of the existing tests in this file unchanged (assertions after mount are synchronous for 7 items): those assertions
// happen before fetchAiFeatures() promise resolves, reading the store's initial value (all true), unaffected by this mock.
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
    // SP7-P8a-T5: settings entry landing point (see "Settings Entry" describe below).
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

  // SP7-P7a-T4: NAV adds smart-views, inserted after places and before favorites — originally 6 items now 7 items,
  // favorites/trash indices each +1 (originally 4/5 → now 5/6). Order follows Vue2 PhotosSidebar.vue:114-118
  // (library / albums / people / places / smart).
  it('renders seven navigation items (photo library/albums/people/places/for you/favorites/recently deleted), current route highlighted', async () => {
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(7)
    expect(items[0].text()).toContain('照片库')
    expect(items[1].text()).toContain('相册')
    expect(items[2].text()).toContain('人物')
    expect(items[3].text()).toContain('地点')
    expect(items[4].text()).toContain('为你推荐')
    expect(items[5].text()).toContain('收藏')
    expect(items[6].text()).toContain('最近删除')
    // currently at /photos, only photo library item active
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
    expect(items[6].classes()).not.toContain('active')
  })

  it('at /photos/favorites only favorites item active, library not active', async () => {
    await testRouter.push('/photos/favorites')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active
    expect(items[1].classes()).not.toContain('active') // albums not active
    expect(items[2].classes()).not.toContain('active') // people not active
    expect(items[3].classes()).not.toContain('active') // places not active
    expect(items[4].classes()).not.toContain('active') // smart-views not active
    expect(items[5].classes()).toContain('active') // favorites active
    expect(items[6].classes()).not.toContain('active') // trash not active
  })

  it('at /photos/albums only albums item active', async () => {
    await testRouter.push('/photos/albums')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active
    expect(items[1].classes()).toContain('active') // albums active
    expect(items[2].classes()).not.toContain('active') // people not active
    expect(items[3].classes()).not.toContain('active') // places not active
    expect(items[4].classes()).not.toContain('active') // smart-views not active
    expect(items[5].classes()).not.toContain('active') // favorites not active
    expect(items[6].classes()).not.toContain('active') // trash not active
  })

  it('at /photos/albums/7 (three-level path, album detail) only albums item still active, library not affected', async () => {
    await testRouter.push('/photos/albums/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active (regression check)
    expect(items[1].classes()).toContain('active') // albums active
    expect(items[2].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
    expect(items[6].classes()).not.toContain('active')
  })

  it('at /photos/people only people item active', async () => {
    await testRouter.push('/photos/people')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active
    expect(items[1].classes()).not.toContain('active') // albums not active
    expect(items[2].classes()).toContain('active') // people active
    expect(items[3].classes()).not.toContain('active') // places not active
    expect(items[4].classes()).not.toContain('active') // smart-views not active
    expect(items[5].classes()).not.toContain('active') // favorites not active
    expect(items[6].classes()).not.toContain('active') // trash not active
  })

  it('at /photos/people/7 (three-level path, person detail) only people item still active, library not affected — core regression check', async () => {
    await testRouter.push('/photos/people/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active (regression check: /photos prefix cannot have double highlight)
    expect(items[1].classes()).not.toContain('active') // albums not active
    expect(items[2].classes()).toContain('active') // people active
    expect(items[3].classes()).not.toContain('active')
    expect(items[4].classes()).not.toContain('active')
    expect(items[5].classes()).not.toContain('active')
    expect(items[6].classes()).not.toContain('active')
  })

  it('at /photos/places only places item active', async () => {
    await testRouter.push('/photos/places')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items[0].classes()).not.toContain('active') // library not active
    expect(items[1].classes()).not.toContain('active') // albums not active
    expect(items[2].classes()).not.toContain('active') // people not active
    expect(items[3].classes()).toContain('active') // places active
    expect(items[4].classes()).not.toContain('active') // smart-views not active
    expect(items[5].classes()).not.toContain('active') // favorites not active
    expect(items[6].classes()).not.toContain('active') // trash not active
  })

  // SP7-P7a-T4: index 4 is smart-views (brief requires both asserting "7 items" and "smart-views at index 4").
  it('smart-views at index 4, and at /photos/smart-views only that item active', async () => {
    await testRouter.push('/photos/smart-views')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    expect(items).toHaveLength(7)
    expect(items[4].text()).toContain('为你推荐')
    expect(items[0].classes()).not.toContain('active') // library not active
    expect(items[1].classes()).not.toContain('active') // albums not active
    expect(items[2].classes()).not.toContain('active') // people not active
    expect(items[3].classes()).not.toContain('active') // places not active
    expect(items[4].classes()).toContain('active') // smart-views active
    expect(items[5].classes()).not.toContain('active') // favorites not active
    expect(items[6].classes()).not.toContain('active') // trash not active
  })

  it('click smart-views item (index 4) push to /photos/smart-views', async () => {
    // beforeEach has already put testRouter at /photos — navigation assertion is meaningful only when coming from another route.
    const w = mountSidebar()
    const items = w.findAll('.side-item')
    await items[4].trigger('click')
    await flushPromises()
    expect(testRouter.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('storage bar: render human-readable usage and percentage based on indexStatus', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 5 * 1024 * 1024 * 1024 // 5GB
    store.indexStatus.diskTotal = 100 * 1024 * 1024 * 1024
    store.indexStatus.diskAvail = 40 * 1024 * 1024 * 1024 // used 60%
    const w = mountSidebar()
    expect(w.text()).toContain('GB')
    const bar = w.get('.storage-bar-fill')
    expect(bar.attributes('style')).toContain('60%')
  })

  it('storage bar: no division by zero when diskTotal is 0 (percentage falls to 0%)', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 0
    store.indexStatus.diskTotal = 0
    store.indexStatus.diskAvail = 0
    const w = mountSidebar()
    const bar = w.get('.storage-bar-fill')
    expect(bar.attributes('style')).toContain('0%')
  })

  it('desktop state (isNarrow=false): no overlay, no is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.photos-sidebar').classes()).not.toContain('is-drawer')
  })

  it('narrow screen + open: overlay appears, aside has is-drawer/is-open; click overlay closes', async () => {
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

  it('ESC closes drawer', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.open.value).toBe(false)
  })

  it('drawer auto-collapses after route change', async () => {
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

  // SP7-P8a-T5: sidebar settings entry at the bottom, pointing to /photos/settings. Does not use .side-item selector
  // (that renders the 7 existing nav array items, this entry is an independent new element, deliberately using a different class,
  // not interfering with the existing assertions of "7 nav items" above).
  describe('Settings Entry', () => {
    it('settings entry exists at sidebar bottom', () => {
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
      // existing 7 nav items unaffected (not the 8th new item inserted into NAV array).
      expect(w.findAll('.side-item')).toHaveLength(7)
    })

    it('click settings entry push to /photos/settings', async () => {
      const w = mountSidebar()
      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
    })
  })

  // P8a-T6(§7e-15): smartview config awareness — when Vue2 PhotosSidebar.vue:120-122
  // `ai.smartview === false` then `items.filter(i => i.id !== 'smart')`.
  describe('smartview config awareness (§7e-15)', () => {
    it('when aiFeatures.smartview is false hide smart view entry completely', async () => {
      vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: { smartview: false } })
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.side-item')
      expect(items).toHaveLength(6)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(false)
      // remaining 6 items still in original order minus smart-views (favorites/trash follow places).
      expect(items[3].text()).toContain('地点')
      expect(items[4].text()).toContain('收藏')
      expect(items[5].text()).toContain('最近删除')
    })

    // review fix(take-along): original title "undetermined (fetch failure)" used "undetermined" in the outer phrasing,
    // making people think this test was for the "not yet fetched" branch (fetch still in progress, not resolved) — but
    // the following await flushPromises() first settles the reject, this actually only reaches the "fetch failure" catch branch
    // (happens to be the same as initial value all true, visually indistinguishable, but follows different code path).
    // Title removes "undetermined", explicitly stating "failure". Real "not yet fetched" branch is covered by new sync test below.
    it('when smartview request fails (store enters catch branch) show enabled to not scare users', async () => {
      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.side-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
    })

    // review fix(take-along): cover the real "not yet fetched" branch — after mount without flushPromises,
    // fetchAiFeatures() promise is still in progress, store's aiFeatures stays at initial value (all true).
    // Numerically identical to previous case (failure branch falls back to all true), but follows different code path
    // (never entered catch here, initial ref value), adding this test is the true proof of "show enabled while loading".
    it('when smartview request still in progress (not yet resolved) show enabled, synchronously render 7 items', () => {
      let resolveFn: ((v: Record<string, unknown>) => void) | undefined
      vi.mocked(service.photos.getConfig).mockImplementation(
        () => new Promise<Record<string, unknown>>((res) => { resolveFn = res }),
      )
      const w = mountSidebar()
      const items = w.findAll('.side-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
      // clean up: settle the pending promise, prevent it from leaking to next test case.
      resolveFn?.({})
    })

    it('call fetchAiFeatures once on mount (read config via store, not directly read getConfig)', async () => {
      const settings = usePhotosSettingsStore()
      const spy = vi.spyOn(settings, 'fetchAiFeatures')
      mountSidebar()
      await flushPromises()
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  // SP15-P2b Task 5: the smart-views entry's label changes to "For You" now that its page
  // is Moments-only, but its id/route stay so the ?view=smart deep link and the
  // aiFeatures.smartview hide-when-off filter above keep working unmodified.
  //
  // Deviation from the plan brief: the brief's snippet asserted
  // `[data-nav-id="smart-views"]`, which does not exist anywhere in this component (grep
  // confirmed) — nav items carry no per-item test marker, only `.side-item`/`.side-name`.
  // This does not add one just for the test; it asserts on the collected `.side-name` text
  // set instead, same technique the "hide when off" cases above already use.
  it('label the smart-views entry "For You" after the IA merge, drop the old "Smart Views" label entirely', () => {
    const w = mountSidebar()
    const names = w.findAll('.side-name').map((n) => n.text())
    expect(names).toContain('为你推荐')
    expect(names).not.toContain('智能视图')
  })
})
