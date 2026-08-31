import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const ACCESS = 'access_token'
const REFRESH = 'refresh_token'
const EXPIRES = 'expires_at'
const USER = 'user'
const VERSION = 'version'
const WALLPAPER = 'wallpaper'

export interface SessionUser { username?: string; role?: string }

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(localStorage.getItem(ACCESS))
  const isAuthed = computed(() => !!token.value)

  // Vue2 ChannelsSection.vue:184 reads $store.state.user.role to decide
  // admin status. This repo's setUser only ever writes to localStorage and has no read-side
  // counterpart, so this fills that gap. Every read re-parses localStorage (rather than
  // caching into a ref): bad JSON always degrades to null, never throws.
  //
  // final review Fix 7: the previous version of this comment argued that "login goes through
  // a full page reload, so there is no in-between state where a write hasn't been reflected
  // yet", and concluded on that basis that computed didn't need a reactive dependency on
  // setUser. That premise doesn't hold -- src/views/Login.vue:44 uses `router.push(target)`,
  // not a full page reload. Within the same SPA session, if you log out (clear) and log back
  // in (setUser) again without a full reload, the old code would leave `user`/`isAdmin` stuck
  // at whatever value was read the last time computed evaluated, until some unrelated reactive
  // dependency changed and forced a recompute -- in practice this showed up as the Channels
  // section's admin-only group showing or hiding based on a stale role.
  // Fix: introduce a sentinel ref `userVersion`. `setUser` increments it on every write, and
  // `user`'s computed reads it (even just as `void`) to establish the dependency, so that
  // within the same store instance, user/isAdmin recompute immediately after setUser. The
  // public signature of setUser is unchanged (still `(user: unknown) => void`).
  const userVersion = ref(0)
  const user = computed<SessionUser | null>(() => {
    void userVersion.value // establishes the reactive dependency, see the final review Fix 7 comment above
    try {
      const raw = localStorage.getItem(USER)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as SessionUser) : null
    } catch {
      return null
    }
  })

  const isAdmin = computed(() => user.value?.role === 'admin')

  function setTokens(access: string, refresh: string, expiresAt?: string) {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
    if (expiresAt) localStorage.setItem(EXPIRES, expiresAt)
    token.value = access
  }

  function setUser(user: unknown) {
    localStorage.setItem(USER, JSON.stringify(user))
    userVersion.value++ // final review Fix 7: makes user/isAdmin recompute immediately within this instance
  }

  function setVersion(v: string) {
    localStorage.setItem(VERSION, v)
  }

  function clear() {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
    localStorage.removeItem(EXPIRES)
    localStorage.removeItem(USER)
    localStorage.removeItem(VERSION)
    localStorage.removeItem(WALLPAPER)
    token.value = null
  }

  return { token, isAuthed, user, isAdmin, setTokens, setUser, setVersion, clear }
})
