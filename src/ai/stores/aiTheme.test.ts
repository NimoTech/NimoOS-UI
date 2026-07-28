import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAiTheme } from './aiTheme'
import { useAgentStore } from './agentStore'

const KEY = 'nimoos.ai.agent.theme'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('useAiTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('初值是 light', () => {
    expect(useAiTheme().theme).toBe('light')
  })

  it('hydrateTheme 优先读 localStorage', () => {
    localStorage.setItem(KEY, 'dark')
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('hydrateTheme 忽略 localStorage 里的非法值,回落系统偏好', () => {
    localStorage.setItem(KEY, 'chartreuse')
    stubMatchMedia(true)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('无 localStorage 且系统偏好浅色时是 light', () => {
    stubMatchMedia(false)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('light')
  })

  it('toggleTheme 翻转并落盘', () => {
    const s = useAiTheme()
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')
  })
})

describe('agentStore 主题委托给 aiTheme(D1:跨页共享)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('agentStore.theme 读到的是 aiTheme 的值', () => {
    const shared = useAiTheme()
    const agent = useAgentStore()
    shared.toggleTheme()
    expect(agent.theme).toBe('dark')
  })

  it('agentStore.toggleTheme() 会翻动共享 store —— 设置页因此能同步看到', () => {
    const agent = useAgentStore()
    const shared = useAiTheme()
    agent.toggleTheme()
    expect(shared.theme).toBe('dark')
    expect(agent.theme).toBe('dark')
  })

  it('agentStore 的 initTheme 装载后,共享 store 也是同一个值', () => {
    // 实现者注意(brief 裁定):brief 原文的占位名 `loadPersisted()` 经 grep
    // agentStore.ts 确认真名是 `initTheme()`(store 返回表里对外导出的装载
    // 函数,承载 brief 所指 `:307-316` 那段 localStorage/matchMedia 装载逻辑)。
    // 未在 agentStore 上新增任何导出 —— 直接用既有的真实函数名。
    localStorage.setItem(KEY, 'dark')
    const agent = useAgentStore()
    agent.initTheme()
    expect(agent.theme).toBe('dark')
    expect(useAiTheme().theme).toBe('dark')
  })
})
