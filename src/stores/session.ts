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

  // SP8-P2b Task 2 —— Vue2 ChannelsSection.vue:184 读 $store.state.user.role 判管理员。
  // 本仓 setUser 只往 localStorage 写、没有读出口,这里补上。每次取值重新解析
  // localStorage(而不是缓存进 ref):登录/切换用户都走整页重载,不存在"写了不刷新"的
  // 中间态,重新解析最简单且不会读到陈旧值。坏 JSON 一律退化成 null,绝不抛。
  // 注意: computed 读 localStorage 不构成响应式依赖 —— 同一实例内 setUser 之后
  // user 不会自动重算(computed 会缓存)。这是有意的(登录流程整页重载),不要依赖
  // "setUser 后立刻读到新值"。
  const user = computed<SessionUser | null>(() => {
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
