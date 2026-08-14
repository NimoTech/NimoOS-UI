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

  it('initial value is light', () => {
    expect(useAiTheme().theme).toBe('light')
  })

  it('hydrateTheme prioritizes reading from localStorage', () => {
    localStorage.setItem(KEY, 'dark')
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('hydrateTheme ignores illegal values in localStorage, falls back to system preference', () => {
    localStorage.setItem(KEY, 'chartreuse')
    stubMatchMedia(true)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('dark')
  })

  it('when no localStorage and system prefers light, is light', () => {
    stubMatchMedia(false)
    const s = useAiTheme()
    s.hydrateTheme()
    expect(s.theme).toBe('light')
  })

  it('toggleTheme toggles and persists', () => {
    const s = useAiTheme()
    s.toggleTheme()
    expect(s.theme).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
    s.toggleTheme()
    expect(s.theme).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')
  })
})

describe('agentStore theme delegates to aiTheme (D1: cross-page sharing)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('agentStore.theme reads aiTheme\'s value', () => {
    const shared = useAiTheme()
    const agent = useAgentStore()
    shared.toggleTheme()
    expect(agent.theme).toBe('dark')
  })

  it('agentStore.toggleTheme() toggles the shared store — settings page can thus see it synchronously', () => {
    const agent = useAgentStore()
    const shared = useAiTheme()
    agent.toggleTheme()
    expect(shared.theme).toBe('dark')
    expect(agent.theme).toBe('dark')
  })

  it('after agentStore\'s initTheme loads, the shared store is also the same value', () => {
    // Implementer note (brief ruling): brief's original placeholder name `loadPersisted()`
    // was confirmed by grep of agentStore.ts to actually be `initTheme()` (the loading function
    // exported from store's return table, carrying the localStorage/matchMedia loading logic
    // indicated by brief's `:307-316`). No new exports added to agentStore — directly use the
    // existing real function name.
    localStorage.setItem(KEY, 'dark')
    const agent = useAgentStore()
    agent.initTheme()
    expect(agent.theme).toBe('dark')
    expect(useAiTheme().theme).toBe('dark')
  })
})

// [SP8-P2b acceptance round 3, user decided 2026-07-30 'only change AI area, desktop unaffected']
// Bug: all toasts in AI area are invisible. `AppToast` is mounted at the outermost layer of
// `App.vue`, **not within the `.agent-app` theme scope**, so it draws with the global blue-black
// theme's `--toast-bg` (semi-transparent white) + `--toast-fg` (undefined → falls back to `--fg` =
// #ffffff) on AI's light page = white text on white background, completely invisible.
// Fix: AI page registers during mount the fact that 'AI area is in foreground' to this store,
// `AppToast` accordingly applies AI's toast scope and appearance to itself; leaving AI route
// completely restores to original (desktop unaffected).
// **Use reference counting instead of boolean**: during route switching, new page's onMounted may
// come before old page's onBeforeUnmount, boolean would be overwritten to 'false' (not in AI area)
// by departing page — counting is naturally immune to this ordering issue.
describe('AI area foreground registration (toast scope use)', () => {
  it('initially false; register once becomes true, after deregister returns false', () => {
    const s = useAiTheme()
    expect(s.aiSurfaceActive).toBe(false)
    s.enterAiSurface()
    expect(s.aiSurfaceActive).toBe(true)
    s.leaveAiSurface()
    expect(s.aiSurfaceActive).toBe(false)
  })

  it('reference counting: new page mounts first, old page unmounts later, still remains true', () => {
    const s = useAiTheme()
    s.enterAiSurface() // settings page mounts
    s.enterAiSurface() // Agent page mounts (route switch, new page comes first)
    s.leaveAiSurface() // settings page unmounts (old page leaves later)
    expect(s.aiSurfaceActive).toBe(true) // still in AI area
    s.leaveAiSurface() // Agent page also gone
    expect(s.aiSurfaceActive).toBe(false)
  })

  it('count won\'t be pressed negative by extra deregister (negative would make next register fail)', () => {
    const s = useAiTheme()
    s.leaveAiSurface()
    s.leaveAiSurface()
    s.enterAiSurface()
    expect(s.aiSurfaceActive).toBe(true)
  })
})
