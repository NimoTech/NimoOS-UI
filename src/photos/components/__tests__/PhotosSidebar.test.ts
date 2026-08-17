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

// Task 3 (shell + sidebar re-skin): re-skinned to the Vue2 pixel baseline — selectors below moved from
// New-UI's old `.photos-sidebar`/`.side-item`/`.side-name`/`.storage-bar-fill` to Vue2's own
// `.sidebar`/`.nav-item[data-active]`/`.storage-mini`/`.icon-btn` (PhotosSidebar.vue.vue2.
// script-level behavior — NAV table, isActive-by-route, storage percent, router.push, the
// aiFeatures smartview filter, the mobile drawer — is unchanged; only classes/DOM structure
// and the two new things (theme toggle, collapsed prop) moved.
//
// P8a-T6 (§7e-15): the sidebar now also reads the aiFeatures config itself once (see the
// comment at the top of PhotosSidebar.vue). It defaults to parsing as `{}` (readAiFeatures
// treats any missing field as enabled, so smartview is still true) — this default keeps the
// rest of this file's existing tests (which synchronously assert 7 items right after mount)
// unchanged: those assertions all happen before fetchAiFeatures()'s promise resolves, so they
// read the store's initial value (all true), unaffected by this mock.
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
    // SP7-P8a-T5: the destination for the settings entry (see the "settings entry" describe block below).
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

  // SP7-P7a-T4: NAV gained a smart-views entry inserted after places and before favorites — the
  // original 6 items became 7, and favorites/trash indices each shift by +1 (was 4/5, now 5/6).
  // Order follows Vue2 PhotosSidebar.vue:114-118 (library / albums / people / places / smart).
  it('renders seven nav items (Library/Albums/People/Places/For You/Favorites/Recently Deleted), highlighting the current route', async () => {
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
    // Currently on /photos, so only the library item is active (Vue2 uses the data-active attribute, not a class)
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('at /photos/favorites only the favorites item is active; library is not active', async () => {
    await testRouter.push('/photos/favorites')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library not active
    expect(items[1].attributes('data-active')).toBe('false') // albums not active
    expect(items[2].attributes('data-active')).toBe('false') // people not active
    expect(items[3].attributes('data-active')).toBe('false') // places not active
    expect(items[4].attributes('data-active')).toBe('false') // smart-views not active
    expect(items[5].attributes('data-active')).toBe('true') // favorites active
    expect(items[6].attributes('data-active')).toBe('false') // trash not active
  })

  it('at /photos/albums only the albums item is active', async () => {
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

  it('at /photos/albums/7 (third-level path, album detail) still only the albums item is active — library is not falsely matched', async () => {
    await testRouter.push('/photos/albums/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library not active (regression point)
    expect(items[1].attributes('data-active')).toBe('true')
    expect(items[2].attributes('data-active')).toBe('false')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('at /photos/people only the people item is active', async () => {
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

  it('at /photos/people/7 (third-level path, person detail) still only the people item is active — library is not falsely matched (core regression point)', async () => {
    await testRouter.push('/photos/people/7')
    await testRouter.isReady()
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    expect(items[0].attributes('data-active')).toBe('false') // library not active (regression point: the /photos prefix must not cause double highlighting)
    expect(items[1].attributes('data-active')).toBe('false')
    expect(items[2].attributes('data-active')).toBe('true')
    expect(items[3].attributes('data-active')).toBe('false')
    expect(items[4].attributes('data-active')).toBe('false')
    expect(items[5].attributes('data-active')).toBe('false')
    expect(items[6].attributes('data-active')).toBe('false')
  })

  it('at /photos/places only the places item is active', async () => {
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

  // SP7-P7a-T4: index 4 is smart-views (the brief explicitly requires asserting both "7 items"
  // and "smart-views at index 4").
  it('smart-views is at index 4, and at /photos/smart-views only that item is active', async () => {
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

  it('clicking the smart-views item (index 4) pushes to /photos/smart-views', async () => {
    // beforeEach already leaves testRouter parked on /photos — the navigation assertion is
    // only meaningful when clicking in from a different route.
    const w = mountSidebar()
    const items = w.findAll('.nav-item')
    await items[4].trigger('click')
    await flushPromises()
    expect(testRouter.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('storage bar: renders human-readable usage and percentage from indexStatus', () => {
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

  it('storage bar: does not divide by zero when diskTotal is 0 (percentage falls to 0%, usage text not rendered)', () => {
    const store = useTimelineStore()
    store.indexStatus.totalBytes = 0
    store.indexStatus.diskTotal = 0
    store.indexStatus.diskAvail = 0
    const w = mountSidebar()
    expect(w.find('.storage-mini-usage').exists()).toBe(false)
    const bar = w.get('.storage-mini-bar > div')
    expect(bar.attributes('style')).toContain('0%')
  })

  it('desktop state (isNarrow=false): no scrim, no is-drawer class', () => {
    const w = mountSidebar()
    expect(w.find('.side-scrim').exists()).toBe(false)
    expect(w.find('aside.sidebar').classes()).not.toContain('is-drawer')
  })

  it('narrow screen + open: shows the scrim, aside gets is-drawer/is-open; clicking the scrim closes it', async () => {
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

  it('ESC closes the drawer', async () => {
    const d = useSidebarDrawer()
    d.isNarrow.value = true
    d.open.value = true
    mountSidebar()
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.open.value).toBe(false)
  })

  it('the drawer automatically collapses after a route change', async () => {
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

  // SP7-P8a-T5: the settings entry in the sidebar head (moved from the sidebar footer to
  // sidebar-head starting with Task 3, following Vue2 PhotosSidebar.vue:34-35), pointing to
  // /photos/settings.
  describe('settings entry', () => {
    it('the settings entry exists in the sidebar head', () => {
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-settings-link"]').exists()).toBe(true)
      // the existing 7 nav items are unaffected (this is not a new 8th item inserted into the NAV array).
      expect(w.findAll('.nav-item')).toHaveLength(7)
    })

    it('clicking the settings entry pushes to /photos/settings', async () => {
      const w = mountSidebar()
      await w.get('[data-test="sidebar-settings-link"]').trigger('click')
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/settings')
    })
  })

  // Task 3: the sidebar-head theme toggle button — the actual theme switch destination from
  // Vue2 PhotosSidebar.vue:27-33.
  describe('theme toggle button (Task 3)', () => {
    it('shows "切换到浅色主题" by default (dark); clicking calls usePhotosTheme().set to switch to light, then clicking again switches back to dark', async () => {
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

    it('after switching to light, persists to localStorage (shares the same singleton with the PhotosSettings page toggle)', async () => {
      const w = mountSidebar()
      await w.get('.sidebar-head').findAll('.icon-btn')[0].trigger('click')
      expect(localStorage.getItem('nimo_photos_theme')).toBe('light')
    })
  })

  // Task 3: collapsed prop — the collapsed state renders a centered icon column, not the
  // expanded state's sidebar-head/nav-item.
  describe('collapsed state (collapsed prop, Task 3)', () => {
    it('collapsed=true renders 7 .icon-btn elements (nav1+nav2 merged), not .nav-item/.brand-name', () => {
      const w = mountSidebar({ collapsed: true })
      expect(w.find('.nav-item').exists()).toBe(false)
      expect(w.find('.brand-name').exists()).toBe(false)
      expect(w.find('.brand-icon').exists()).toBe(true)
      expect(w.findAll('.icon-btn')).toHaveLength(7)
    })

    it('collapsed=true still navigates by route when an icon-btn is clicked', async () => {
      const w = mountSidebar({ collapsed: true })
      await w.findAll('.icon-btn')[1].trigger('click') // albums
      await flushPromises()
      expect(testRouter.currentRoute.value.path).toBe('/photos/albums')
    })

    it('collapsed=false (default) renders the expanded structure', () => {
      const w = mountSidebar()
      expect(w.find('.sidebar-head').exists()).toBe(true)
      expect(w.find('.brand-name').text()).toBe('相册')
    })
  })

  // Task 3: the "Photo library" drawer expand/collapse — the nav2 (favorites/trash) collapsible
  // section from Vue2 PhotosSidebar.vue:51-76, expanded by default (data() { libraryOpen: true }).
  describe('"Photo library" drawer expand/collapse (Task 3)', () => {
    it('expanded by default: all 7 .nav-item are visible; clicking .nav-label collapses it to leave only 5 (favorites/trash hidden); clicking again restores all 7', async () => {
      const w = mountSidebar()
      expect(w.findAll('.nav-item')).toHaveLength(7)
      await w.get('.nav-label').trigger('click')
      expect(w.findAll('.nav-item')).toHaveLength(5)
      expect(w.findAll('.nav-item').some((n) => n.text().includes('收藏'))).toBe(false)
      await w.get('.nav-label').trigger('click')
      expect(w.findAll('.nav-item')).toHaveLength(7)
    })
  })

  // Task 3: brand-user — the displayName from Vue2 PhotosSidebar.vue:25; New-UI uses the
  // session store.
  describe('brand-user (Task 3)', () => {
    it('sidebar-head shows the username when logged in', () => {
      useSessionStore().setUser({ username: 'yu' })
      const w = mountSidebar()
      expect(w.get('.brand-user').text()).toBe('yu')
    })

    it('does not render .brand-user when there is no username', () => {
      const w = mountSidebar()
      expect(w.find('.brand-user').exists()).toBe(false)
    })
  })

  // Task 3: favorites badge — sourced from usePhotosFavorites(), only shown when favIdsLoaded.
  describe('favorites badge (Task 3)', () => {
    it('shows the .nav-count number on the favorites item when favIdsLoaded', () => {
      const fav = usePhotosFavorites()
      fav.favIds = new Set(['1', '2', '3'])
      fav.favIdsLoaded = true
      const w = mountSidebar()
      const favItem = w.findAll('.nav-item').find((n) => n.text().includes('收藏'))
      expect(favItem?.find('.nav-count').text()).toBe('3')
    })

    it('does not show .nav-count on the favorites item when favIds has not been fetched yet (default)', () => {
      const w = mountSidebar()
      const favItem = w.findAll('.nav-item').find((n) => n.text().includes('收藏'))
      expect(favItem?.find('.nav-count').exists()).toBe(false)
    })

    it('the trash item does not get a badge in this task (a logged out-of-scope gap, see the comment at the top of the component)', () => {
      const w = mountSidebar()
      const trashItem = w.findAll('.nav-item').find((n) => n.text().includes('最近删除'))
      expect(trashItem?.find('.nav-count').exists()).toBe(false)
    })
  })

  // P8a-T6 (§7e-15): smartview config awareness — mirrors Vue2 PhotosSidebar.vue:120-122's
  // `items.filter(i => i.id !== 'smart')` when `ai.smartview === false`.
  describe('smartview config awareness (§7e-15)', () => {
    it('hides the smart-views entry entirely when aiFeatures.smartview is false', async () => {
      vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: { smartview: false } })
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(6)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(false)
      // the remaining 6 items keep the original order minus smart-views (favorites/trash immediately follow places).
      expect(items[3].text()).toContain('地点')
      expect(items[4].text()).toContain('收藏')
      expect(items[5].text()).toContain('最近删除')
    })

    // review fix (take-along): the original title's outer "undetermined" phrasing in
    // "undetermined (fetch failed)" could be misread as testing the "not yet fetched" branch
    // (fetch still in flight, not yet resolved) — but the `await flushPromises()` below settles
    // the rejection first, so this actually only reaches the "fetch failed" catch branch (it
    // happens to look identical to the initial value, all true, so it's visually
    // indistinguishable, but it takes a different code path). The title drops "undetermined" and
    // states "failed" explicitly. The true "not yet fetched" branch is covered by the new
    // synchronous test case added below.
    it('shows as enabled when the smartview request fails (store falls into the catch branch), so as not to alarm the user', async () => {
      vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
      const w = mountSidebar()
      await flushPromises()
      await nextTick()
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
    })

    // review fix (take-along): adds the true "not yet fetched" branch — without flushPromises
    // after mount, fetchAiFeatures()'s promise is still in flight, so the store's aiFeatures
    // stays at its initial value (all true). This is numerically identical to the previous case
    // (the failure branch also falls back to all true), but it takes a different code path (it
    // never enters the catch here — it's the initial ref value); adding this case is what
    // genuinely proves "shows as enabled while loading".
    it('shows as enabled while the smartview request is still in flight (not yet resolved), synchronously rendering 7 items', () => {
      let resolveFn: ((v: Record<string, unknown>) => void) | undefined
      vi.mocked(service.photos.getConfig).mockImplementation(
        () => new Promise<Record<string, unknown>>((res) => { resolveFn = res }),
      )
      const w = mountSidebar()
      const items = w.findAll('.nav-item')
      expect(items).toHaveLength(7)
      expect(items.some((i) => i.text().includes('为你推荐'))).toBe(true)
      // cleanup: settle the pending promise so it doesn't leak into the next test case.
      resolveFn?.({})
    })

    it('calls fetchAiFeatures once on mount (reads config via the store, not getConfig directly)', async () => {
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
  describe('the mobile drawer floating trigger button (review fix round 1)', () => {
    it('narrow viewport with the drawer closed: the trigger button renders, and clicking it calls drawer.toggle() to open the drawer', async () => {
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

    it('narrow viewport with the drawer already open: no trigger button renders (the drawer already covers the screen, a duplicate entry point is unnecessary)', async () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = true
      d.open.value = true
      const w = mountSidebar()
      await nextTick()
      expect(w.find('[data-test="sidebar-drawer-trigger"]').exists()).toBe(false)
    })

    it('desktop state (isNarrow=false): no trigger button renders', () => {
      const d = useSidebarDrawer()
      d.isNarrow.value = false
      const w = mountSidebar()
      expect(w.find('[data-test="sidebar-drawer-trigger"]').exists()).toBe(false)
    })

    it('hideDrawerTrigger=true (Photos.vue uses it to avoid a second entry point alongside PhotosTopbar own collapse button): nothing renders even on a narrow viewport with the drawer closed', async () => {
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
