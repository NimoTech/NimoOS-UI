import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getTimeline: vi.fn().mockResolvedValue([]),
      getStatus: vi.fn().mockResolvedValue({}),
      listTasks: vi.fn().mockResolvedValue({ tasks: [] }),
      deleteAsset: vi.fn(),
    },
  },
}))

// useMessageBus opens a real socket.io connection — not needed for this
// route/lifecycle-only test (see Home.integration.test.ts's precedent).
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

import Photos from '../Photos.vue'
import PhotosFilterBar from '../../photos/components/PhotosFilterBar.vue'
import { useTimelineStore } from '../../photos/stores/timeline'
import { usePhotosFavorites } from '../../photos/stores/favorites'
import { router as appRouter } from '../../router'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

describe('/photos route', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('the app route table resolves /photos to the Photos component (name=photos)', () => {
    const match = appRouter.resolve('/photos')
    expect(match.name).toBe('photos')
    expect(match.matched[0]?.components?.default).toBeTruthy()
  })

  it('mount triggers fetchTimeline/startIndexPoll/fetchTasks — unmount triggers stopIndexPoll', async () => {
    const store = useTimelineStore()
    store.fetchTimeline = vi.fn()
    store.startIndexPoll = vi.fn()
    store.fetchTasks = vi.fn()
    store.stopIndexPoll = vi.fn()
    const router = makeRouter()
    router.push('/photos'); await router.isReady()
    const w = mount(Photos, { global: { plugins: [i18n, router] } })
    expect(store.fetchTimeline).toHaveBeenCalledTimes(1)
    expect(store.startIndexPoll).toHaveBeenCalledTimes(1)
    expect(store.fetchTasks).toHaveBeenCalledTimes(1)
    expect(store.stopIndexPoll).not.toHaveBeenCalled()
    w.unmount()
    expect(store.stopIndexPoll).toHaveBeenCalledTimes(1)
  })

  it('mount triggers usePhotosFavorites().reconcileFavIds() (favorite-state reconcile on the timeline first screen)', async () => {
    const fav = usePhotosFavorites()
    fav.reconcileFavIds = vi.fn()
    const router = makeRouter()
    router.push('/photos'); await router.isReady()
    const w = mount(Photos, { global: { plugins: [i18n, router] } })
    expect(fav.reconcileFavIds).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  // PlaceDetailPanel.vue's "Open in Library"/
  // spot "View in Library" jumps now land here with `?libraryPlace=<city>` — this file must
  // seed the existing `places` EXIF facet from it once on mount, then strip the query key so
  // a later bare reload doesn't silently resurrect a filter the user may have since cleared.
  it('?libraryPlace=<city> writes the PhotosFilterBar places filter once and clears the query key', async () => {
    const router = makeRouter()
    router.push('/photos?libraryPlace=Las%20Vegas')
    await router.isReady()
    const w = mount(Photos, { global: { plugins: [i18n, router] } })
    // store.loading gates the toolbar/FilterBar's own v-else branch — flush the real
    // fetchTimeline() call (onMounted) to completion so it actually renders.
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findComponent(PhotosFilterBar).props('filter')).toEqual({ years: [], places: ['Las Vegas'], cameras: [] })
    expect(router.currentRoute.value.query.libraryPlace).toBeUndefined()
    w.unmount()
  })

  it('without ?libraryPlace=, the places filter stays empty', async () => {
    const router = makeRouter()
    router.push('/photos')
    await router.isReady()
    const w = mount(Photos, { global: { plugins: [i18n, router] } })
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.findComponent(PhotosFilterBar).props('filter')).toEqual({ years: [], places: [], cameras: [] })
    w.unmount()
  })
})
