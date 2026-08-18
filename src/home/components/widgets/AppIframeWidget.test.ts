import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppIframeWidget from './AppIframeWidget.vue'
import { useAppsStore } from '../../stores/apps'
import type { LayoutItem } from '../../grid/types'

const item = (): LayoutItem => ({ id: 'i', kind: 'widget', key: 'my-dl', c: 1, r: 1, w: 3, h: 2 })

function seedRunning(s: ReturnType<typeof useAppsStore>) {
  s.setApps([
    { name: 'my-dl', title: { en_us: 'DL' }, status: 'running', scheme: 'http', hostname: 'localhost', port: 8080, desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
  ] as never)
}

describe('AppIframeWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stopping app leaves no stale timer to trigger false failed state (should show "app not running" placeholder)', async () => {
    const s = useAppsStore()
    seedRunning(s)
    const w = mount(AppIframeWidget, { props: { item: item() } })
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(true) // running + inView (jsdom fallback is immediately true) → iframe mounted, 8s timer armed

    // App stops: running flips false; the leftover 8s timer must no longer trigger failed
    s.setApps([
      { name: 'my-dl', title: { en_us: 'DL' }, status: 'exited', scheme: 'http', hostname: 'localhost', port: 8080, desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
    ] as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.text()).toContain('应用未运行')

    await vi.advanceTimersByTimeAsync(8000)
    await w.vm.$nextTick()
    // The leftover timer must not trigger the failed state and overwrite the "not running" placeholder, nor leave a retry button behind
    expect(w.text()).toContain('应用未运行')
    expect(w.find('.aw-retry').exists()).toBe(false)
  })

  it('after recovery re-arms timer, failed state + retry button appear only if not loaded within 8s', async () => {
    const s = useAppsStore()
    seedRunning(s)
    const w = mount(AppIframeWidget, { props: { item: item() } })
    await vi.advanceTimersByTimeAsync(0)

    // Stop → advance a full 8s while stopped: before the fix the leftover timer fired here and locked failed=true,
    // so the iframe never remounted after recovery; after the fix the timer is cleaned up and failed stays false
    s.setApps([
      { name: 'my-dl', title: { en_us: 'DL' }, status: 'exited', scheme: 'http', hostname: 'localhost', port: 8080, desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
    ] as never)
    await vi.advanceTimersByTimeAsync(8000)

    seedRunning(s)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(true) // iframe remounts after recovery (old code never remounted here)

    // No load event within 8s (jsdom never really loads iframes) → should genuinely time out into the failed state
    await vi.advanceTimersByTimeAsync(8000)
    await w.vm.$nextTick()
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.text()).toContain('无法连接')
    expect(w.find('.aw-retry').exists()).toBe(true)
  })
})
