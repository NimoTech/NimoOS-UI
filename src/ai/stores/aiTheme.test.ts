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

// 【SP8-P2b 验收第 3 轮,用户 2026-07-30 拍板「只改 AI 区、桌面零影响」】
// 缺陷:AI 区所有 toast 隐形。`AppToast` 挂在 `App.vue` 最外层,**不在 `.agent-app` 那层
// 主题作用域里**,于是用全局蓝黑主题的 `--toast-bg`(半透明白)+ `--toast-fg`(未定义 →
// 退回 `--fg` = #ffffff)画在 AI 的浅色页面上 = 白底白字,完全看不见。
// 修法:AI 页面在挂载期间把「AI 区在前台」这个事实登记到本 store,`AppToast` 据此给自己
// 贴上 AI 的 toast 作用域与明暗;离开 AI 路由则完全恢复原样(桌面零影响)。
// **用引用计数而不是布尔**:路由切换时新页面的 onMounted 可能早于旧页面的 onBeforeUnmount,
// 布尔会被离场页面的 false 覆盖成「不在 AI 区」——计数天然免疫这个顺序问题。
describe('AI 区前台登记(toast 作用域用)', () => {
  it('初始为 false;登记一次变 true,注销后回 false', () => {
    const s = useAiTheme()
    expect(s.aiSurfaceActive).toBe(false)
    s.enterAiSurface()
    expect(s.aiSurfaceActive).toBe(true)
    s.leaveAiSurface()
    expect(s.aiSurfaceActive).toBe(false)
  })

  it('引用计数:新页面先挂载、旧页面后卸载,仍然保持 true', () => {
    const s = useAiTheme()
    s.enterAiSurface() // 设置页挂载
    s.enterAiSurface() // Agent 页挂载(路由切换,新页先来)
    s.leaveAiSurface() // 设置页卸载(旧页后走)
    expect(s.aiSurfaceActive).toBe(true) // 仍在 AI 区
    s.leaveAiSurface() // Agent 页也走了
    expect(s.aiSurfaceActive).toBe(false)
  })

  it('计数不会被多余的注销压到负数(压到负数会让下一次登记失效)', () => {
    const s = useAiTheme()
    s.leaveAiSurface()
    s.leaveAiSurface()
    s.enterAiSurface()
    expect(s.aiSurfaceActive).toBe(true)
  })
})
