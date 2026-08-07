import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import zh from '../i18n/zh_cn'

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return {
    ...actual,
    service: {
      apps: { getGrid: vi.fn(async () => []) },
      photos: { listAssets: vi.fn(async () => []), thumbnailUrl: vi.fn(() => '') },
      sys: { getUtilization: vi.fn(async () => null) },
      users: {
        getEvents: vi.fn(async () => []),
        getCustomStorage: vi.fn(async () => null),
        setCustomStorage: vi.fn(async () => ({})),
      },
      image: { thumbUrl: vi.fn(() => '') },
    },
  }
})

// useMessageBus opens a real socket.io connection; under fake timers that
// causes unrelated reconnect/heartbeat timers to fire on advanceTimersByTime.
// Home only needs `on()` to return an unsubscribe fn — it never needs to
// actually dispatch a message bus event for this test.
vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: () => () => {} }),
}))

import { useLayoutStore } from '../home/stores/layout'
import Home from './Home.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// SP9-P8:Home 挂的 SearchDialog 用 useRoute()/useRouter() 消费深链 ?q=,
// 所以挂载必须带 router 插件(最小 memory 路由表,不引真实 src/router)。
function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
}

function mountHome() {
  return mount(Home, { global: { plugins: [i18n, makeRouter()] } })
}

describe('Home integration', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('mounts with topbar, grid items, and toast container', async () => {
    const w = mountHome()
    await w.vm.$nextTick()
    expect(w.find('.topbar').exists()).toBe(true)
    expect(w.findAll('[data-id]').length).toBeGreaterThan(0) // DEFAULT 项渲染
  })

  // SP11 review round 1, Critical finding: DesktopContextMenu must not put any
  // element between GridCanvas's root (.grid) and .home-screen. useGridMeasure
  // reads `grid.parentElement.clientWidth` (src/home/composables/useGridMeasure.ts);
  // an intermediary box -- even a `display: contents` div -- has clientWidth 0
  // in every real browser, which permanently clamps the whole desktop grid to
  // its minimum cell size. jsdom has no layout engine, so it cannot catch this
  // by measuring size; it can only catch it structurally, by checking that no
  // node sits between .grid and its expected host.
  it('does not introduce a wrapper element between .grid and .home-screen', async () => {
    const w = mountHome()
    await w.vm.$nextTick()
    const grid = w.find('.grid').element
    const screen = w.find('.home-screen').element
    expect(grid.parentElement).toBe(screen)
  })

  it('appgrid 加载后触发 autoPin,30s 轮询与 focus 各再触发', async () => {
    vi.useFakeTimers()
    const w = mountHome()
    const layout = useLayoutStore()
    const spy = vi.spyOn(layout, 'autoPin')
    await flushPromises()
    expect(spy).toHaveBeenCalled() // 首次 loadGrid 后
    const n = spy.mock.calls.length

    vi.advanceTimersByTime(30_000)
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(n) // 轮询

    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(n + 1) // 聚焦

    w.unmount()
    vi.useRealTimers()
  })
})
