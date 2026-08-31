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
      kvm: { getSettings: vi.fn(async () => { throw new Error('ECONNREFUSED') }) },
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

// The SearchDialog mounted by Home consumes the deep link ?q= via useRoute()/useRouter(),
// so mounting must include the router plugin (a minimal memory route table, not the real src/router).
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
    expect(w.findAll('[data-id]').length).toBeGreaterThan(0) // DEFAULT items rendered
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

  it('triggers autoPin after the appgrid loads, and again on both the 30s poll and focus', async () => {
    vi.useFakeTimers()
    const w = mountHome()
    const layout = useLayoutStore()
    const spy = vi.spyOn(layout, 'autoPin')
    await flushPromises()
    expect(spy).toHaveBeenCalled() // after the initial loadGrid
    const n = spy.mock.calls.length

    vi.advanceTimersByTime(30_000)
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(n) // polling

    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(n + 1) // focus

    w.unmount()
    vi.useRealTimers()
  })

  // The KVM tile must not linger for up to 45s (or forever,
  // across reloads) once the probe has confirmed the service is unreachable. This
  // fails against the pre-fix code, which only let sweepGone's grace-period clock
  // start on the first missing poll -- the DEFAULT-layout `vm` tile would still be
  // present here since no timer is advanced at all.
  it('evicts the KVM tile immediately once the probe confirms KVM is unreachable, without waiting on any timer', async () => {
    const w = mountHome()
    const layout = useLayoutStore()
    expect(layout.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true) // DEFAULT layout ships a vm tile
    // loadServerSeen() -> refreshApps() -> loadGrid() -> setApps() is several promise
    // hops deep; one flushPromises() alone does not drain all of them.
    await flushPromises(); await flushPromises(); await flushPromises()
    expect(layout.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
    w.unmount()
  })
})
