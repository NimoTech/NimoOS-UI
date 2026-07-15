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

  it('停止应用不留残余计时器触发假失败态(应显示"应用未运行"占位)', async () => {
    const s = useAppsStore()
    seedRunning(s)
    const w = mount(AppIframeWidget, { props: { item: item() } })
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(true) // running + inView(jsdom 降级立即 true) → iframe 已挂载,8s 计时器已 arm

    // 应用停止:running 翻 false,遗留的 8s 计时器不应再触发 failed
    s.setApps([
      { name: 'my-dl', title: { en_us: 'DL' }, status: 'exited', scheme: 'http', hostname: 'localhost', port: 8080, desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
    ] as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.text()).toContain('应用未运行')

    await vi.advanceTimersByTimeAsync(8000)
    await w.vm.$nextTick()
    // 遗留计时器不应触发失败态覆盖掉"未运行"占位,也不应残留 retry 按钮
    expect(w.text()).toContain('应用未运行')
    expect(w.find('.aw-retry').exists()).toBe(false)
  })

  it('恢复运行后重新 arm 计时器,8s 内未 load 才出现失败态 + 重试按钮', async () => {
    const s = useAppsStore()
    seedRunning(s)
    const w = mount(AppIframeWidget, { props: { item: item() } })
    await vi.advanceTimersByTimeAsync(0)

    // 停止 → 停止期间推满 8s:修复前遗留计时器会在此触发把 failed 卡死 true,
    // 恢复运行后 iframe 永不重挂;修复后计时器已清理,failed 保持 false
    s.setApps([
      { name: 'my-dl', title: { en_us: 'DL' }, status: 'exited', scheme: 'http', hostname: 'localhost', port: 8080, desktop: true, widget: { path: '/widget', w: 3, h: 2 } },
    ] as never)
    await vi.advanceTimersByTimeAsync(8000)

    seedRunning(s)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('iframe').exists()).toBe(true) // 恢复运行后 iframe 重新挂载(旧代码此处永不重挂)

    // 8s 内没有 load 事件(jsdom 不会真加载 iframe)→ 应该真正超时进入失败态
    await vi.advanceTimersByTimeAsync(8000)
    await w.vm.$nextTick()
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.text()).toContain('无法连接')
    expect(w.find('.aw-retry').exists()).toBe(true)
  })
})
