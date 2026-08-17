import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../../ai/stores/agentStore'
import { isPhotosSessionExpired, PHOTOS_IDLE_TTL_MS } from './useAskNimoSession'
import { useAskNimo } from './useAskNimo'

describe('useAskNimo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
    // Preflight F-13: openWith()/openDrawer() call ensureNimoAgentInit() internally, which would
    // otherwise fire real network calls (loadAvailableModels/createSession/etc.) on every test
    // below that doesn't care about that path. Stub the whole quartet by default; individual
    // tests below that DO care re-assign their own vi.fn() afterwards, which simply overrides these.
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's0' })
    agent.deleteSession = vi.fn(async () => {})
    agent.setSessionTitle = vi.fn(async () => {})
    const nimo = useAskNimo()
    nimo.__resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('openWith(string) sets prefill, clears context, opens popup', () => {
    const nimo = useAskNimo()
    nimo.openWith('Show me my favorite photos of Alice')
    expect(nimo.prefill.value).toBe('Show me my favorite photos of Alice')
    expect(nimo.contextPhoto.value).toBeNull()
    expect(nimo.contextAlbum.value).toBeNull()
    expect(nimo.popupOpen.value).toBe(true)
  })

  it('openWith(object) carries contextPhoto/contextAlbum through', () => {
    const nimo = useAskNimo()
    nimo.openWith({ text: 'hi', contextPhoto: { id: 1, name: 'a.jpg', takenAt: null, place: null } })
    expect(nimo.contextPhoto.value).toEqual({ id: 1, name: 'a.jpg', takenAt: null, place: null })
  })

  it('openDrawer opens the drawer directly, no prefill', () => {
    const nimo = useAskNimo()
    nimo.openDrawer()
    expect(nimo.drawerOpen.value).toBe(true)
    expect(nimo.popupOpen.value).toBe(false)
  })

  it('expand() closes the popup and opens the drawer', () => {
    const nimo = useAskNimo()
    nimo.openWith('x')
    nimo.expand()
    expect(nimo.popupOpen.value).toBe(false)
    expect(nimo.drawerOpen.value).toBe(true)
  })

  it('consume*() functions clear their respective field exactly once', () => {
    const nimo = useAskNimo()
    nimo.openWith('hello')
    nimo.consumePrefill()
    expect(nimo.prefill.value).toBe('')
  })

  it('FAB position/dismissed persist to the Vue2-compatible localStorage keys', () => {
    const nimo = useAskNimo()
    nimo.setFabPosition(30, 40)
    nimo.dismissFab()
    nimo.setMiniY(200)
    expect(localStorage.getItem('nimo_fab_right')).toBe('30')
    expect(localStorage.getItem('nimo_fab_bottom')).toBe('40')
    expect(localStorage.getItem('nimo_fab_dismissed')).toBe('1')
    expect(localStorage.getItem('nimo_mini_y')).toBe('200')
  })

  // Re-check N-5 ③: setFabPositionLocal/setMiniYLocal update the visible refs but must NOT
  // touch localStorage -- these are the ones AskNimoFab.vue's drag handler calls on every
  // mousemove; only the persisting setFabPosition/setMiniY (above) get called, once, at mouseup.
  it('setFabPositionLocal/setMiniYLocal update the refs without writing localStorage', () => {
    const nimo = useAskNimo()
    nimo.setFabPositionLocal(77, 88)
    nimo.setMiniYLocal(99)
    expect(nimo.fabRight.value).toBe(77)
    expect(nimo.fabBottom.value).toBe(88)
    expect(nimo.miniY.value).toBe(99)
    expect(localStorage.getItem('nimo_fab_right')).toBeNull()
    expect(localStorage.getItem('nimo_fab_bottom')).toBeNull()
    expect(localStorage.getItem('nimo_mini_y')).toBeNull()
  })

  it('__resetForTests() re-reads the persisted FAB position from localStorage', () => {
    localStorage.setItem('nimo_fab_right', '55')
    localStorage.setItem('nimo_fab_bottom', '66')
    const nimo = useAskNimo()
    nimo.__resetForTests()
    expect(nimo.fabRight.value).toBe(55)
    expect(nimo.fabBottom.value).toBe(66)
  })

  it('ensureNimoAgentInit is one-shot for loadAvailableModels but re-runs session ensure every call', async () => {
    const agent = useAgentStore('photos')
    let loadCalls = 0
    agent.loadAvailableModels = vi.fn(async () => { loadCalls += 1 })
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's1' })
    agent.setSessionTitle = vi.fn(async () => {})
    agent.deleteSession = vi.fn(async () => {})
    const nimo = useAskNimo()
    await nimo.ensureNimoAgentInit()
    await nimo.ensureNimoAgentInit()
    expect(loadCalls).toBe(1)
  })

  // Re-check F-08: the original two assertions here were `expect(isPhotosSessionExpired()).toBe(false)`
  // right BEFORE the TTL elapsed -- that's true whether or not the watcher ever touched the clock at
  // all (lastActiveAt starts at 0 and isPhotosSessionExpired() is false forever if nothing ever calls
  // touchPhotosSession()), so the assertion passed identically with the watcher wired or removed --
  // it proved nothing. Rewritten below: advance the clock PAST the TTL measured FROM the touch event,
  // not from t=0. If the watcher genuinely fired, isPhotosSessionExpired() flips to true at that point
  // (lastActiveAt was set to a non-zero, recent timestamp); if the watcher were missing, lastActiveAt
  // would still be 0 and this would stay false forever -- the two implementations now diverge on this
  // exact assertion (green with the fix, red without it).
  it('the messages-length watcher touches the session clock so it correctly expires TTL later', async () => {
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's1' })
    agent.setSessionTitle = vi.fn(async () => {})
    agent.deleteSession = vi.fn(async () => {})
    const nimo = useAskNimo()
    await nimo.ensureNimoAgentInit()
    expect(isPhotosSessionExpired()).toBe(false) // sanity baseline: zero activity, never expires
    agent.messages = [{ id: 'u1', role: 'user', content: 'hi' }] as any
    await nextTick() // the watch(() => agent.messages.length, ...) callback fires here
    vi.setSystemTime(Date.now() + PHOTOS_IDLE_TTL_MS + 1000) // advance PAST the TTL measured from the touch above
    expect(isPhotosSessionExpired()).toBe(true) // only true if the watcher actually set lastActiveAt to a real timestamp
  })

  it('the busy-goes-false watcher touches the session clock so it correctly expires TTL later', async () => {
    const agent = useAgentStore('photos')
    agent.loadAvailableModels = vi.fn(async () => {})
    agent.createSession = vi.fn(async () => { agent.activeSessionId = 's1' })
    agent.setSessionTitle = vi.fn(async () => {})
    agent.deleteSession = vi.fn(async () => {})
    const nimo = useAskNimo()
    await nimo.ensureNimoAgentInit()
    agent.busy = true
    await nextTick()
    agent.busy = false
    await nextTick() // the watch(() => agent.busy, ...) callback fires here
    vi.setSystemTime(Date.now() + PHOTOS_IDLE_TTL_MS + 1000)
    expect(isPhotosSessionExpired()).toBe(true)
  })
})
