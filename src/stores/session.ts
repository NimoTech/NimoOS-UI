import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const ACCESS = 'access_token'
const REFRESH = 'refresh_token'
const EXPIRES = 'expires_at'
const USER = 'user'
const VERSION = 'version'
const WALLPAPER = 'wallpaper'

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(localStorage.getItem(ACCESS))
  const isAuthed = computed(() => !!token.value)

  function setTokens(access: string, refresh: string, expiresAt?: string) {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
    if (expiresAt) localStorage.setItem(EXPIRES, expiresAt)
    token.value = access
  }

  function setUser(user: unknown) {
    localStorage.setItem(USER, JSON.stringify(user))
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

  return { token, isAuthed, setTokens, setUser, setVersion, clear }
})
