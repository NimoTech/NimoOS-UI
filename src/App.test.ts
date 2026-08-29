import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import zh from './i18n/zh_cn'

// I1 (final review): src/App.vue + src/stores/session.ts had no login/logout
// lifecycle for the wallpaper. These tests exercise App.vue as a whole (rather
// than just the store) because the bug lived specifically in *when* load()/
// reset() run relative to session.isAuthed flipping -- that wiring is what's
// under test here, not the store internals already covered by
// stores/wallpaper.test.ts.
// Vitest 4 dropped the two-argument `vi.fn<[Args], Return>()` generic form;
// the single function-type form below is what actually type-checks (same
// precedent as stores/wallpaper.test.ts).
const getCustomStorage = vi.fn<(key: string) => Promise<unknown>>()
const setCustomStorage = vi.fn<(key: string, data: unknown) => Promise<unknown>>()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: (...a: unknown[]) => getCustomStorage(...(a as [string])),
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [string, unknown])),
    },
  },
}))

import App from './App.vue'
import { useSessionStore } from './stores/session'
import { useWallpaperStore } from './stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  return router
}

let activeWrapper: ReturnType<typeof mount> | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.wallpaper
  document.documentElement.style.removeProperty('--wallpaper-img')
  getCustomStorage.mockReset().mockResolvedValue('')
  setCustomStorage.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
})

describe('App wallpaper session lifecycle', () => {
  it('does not load a wallpaper before login, then loads it the moment isAuthed flips true (no remount)', async () => {
    getCustomStorage.mockResolvedValue({ kind: 'builtin', id: 'w01' })
    const session = useSessionStore()
    const router = await makeRouter()
    activeWrapper = mount(App, { global: { plugins: [i18n, router] } })
    await flushPromises()

    // Not authed at mount: the old onMounted gate already covered this half,
    // but pin it so a regression that fires load() unconditionally is caught.
    expect(getCustomStorage).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()

    // Simulates what useAuth().login() actually does: write tokens on the same
    // store instance, no router.push-triggered remount of App.vue.
    session.setTokens('a', 'r')
    await flushPromises()

    expect(getCustomStorage).toHaveBeenCalledWith('wallpaper_v3')
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(useWallpaperStore().record).toEqual({ kind: 'builtin', id: 'w01' })
  })

  it('clears the painted wallpaper the moment logout flips isAuthed to false', async () => {
    localStorage.setItem('access_token', 'tok')
    getCustomStorage.mockResolvedValue({ kind: 'builtin', id: 'w02' })
    const session = useSessionStore()
    const router = await makeRouter()
    activeWrapper = mount(App, { global: { plugins: [i18n, router] } })
    await flushPromises()

    // Sanity: the previous user's photo is actually painted before we log out --
    // otherwise the assertion after clear() would pass trivially either way.
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(useWallpaperStore().record).toEqual({ kind: 'builtin', id: 'w02' })

    session.clear() // what useAuth().logout() does; AccountPanel then router.push('/login'), no reload
    await flushPromises()

    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--wallpaper-img')).toBe('')
    expect(useWallpaperStore().record).toEqual({ kind: 'none' })
    expect(localStorage.getItem('wallpaper')).toBeNull()
  })
})
