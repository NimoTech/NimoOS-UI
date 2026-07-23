import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
import { useTimelineStore } from '../../photos/stores/timeline'
import { router as appRouter } from '../../router'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos', name: 'photos', component: Photos }],
  })
}

describe('/photos route', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('应用路由表解析 /photos 到 Photos 组件(name=photos)', () => {
    const match = appRouter.resolve('/photos')
    expect(match.name).toBe('photos')
    expect(match.matched[0]?.components?.default).toBeTruthy()
  })

  it('mount 触发 fetchTimeline/startIndexPoll/fetchTasks;unmount 触发 stopIndexPoll', async () => {
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
})
