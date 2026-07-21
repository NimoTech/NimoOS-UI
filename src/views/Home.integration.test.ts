import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
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

function mountHome() {
  return mount(Home, { global: { plugins: [i18n] } })
}

describe('Home integration', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

  it('mounts with topbar, grid items, and toast container', async () => {
    const w = mountHome()
    await w.vm.$nextTick()
    expect(w.find('.topbar').exists()).toBe(true)
    expect(w.findAll('[data-id]').length).toBeGreaterThan(0) // DEFAULT 项渲染
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
