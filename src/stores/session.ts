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
  // localStorage(而不是缓存进 ref):坏 JSON 一律退化成 null,绝不抛。
  //
  // final review Fix 7:上一版注释以「登录走整页重载,不存在‘写了不刷新’的中间态」为由,
  // 认定 computed 不需要对 setUser 建立响应式依赖。核实后该前提不成立 ——
  // src/views/Login.vue:44 走的是 `router.push(target)`,不是整页重载。同一个 SPA
  // 会话里若先登出(clear)再登录(setUser)又不整页刷新,旧代码会让 `user`/`isAdmin`
  // 停留在上一次 computed 求值时读到的值,直到某个无关的响应式依赖变化才会重算 ——
  // 具体表现为 Channels 分区的管理员分组可能因为读到陈旧角色而错误显示/隐藏。
  // 修法:引入一个哨兵 ref `userVersion`,`setUser` 每次写入后自增它,`user` computed
  // 读取它(哪怕只是 `void`)建立依赖,从而在同一个 store 实例内 setUser 之后
  // user/isAdmin 能立刻重新求值。不改 setUser 的公开签名(仍是 `(user: unknown) => void`)。
  const userVersion = ref(0)
  const user = computed<SessionUser | null>(() => {
    void userVersion.value // 建立响应式依赖,见上方 final review Fix 7 注释
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
    userVersion.value++ // final review Fix 7:让 user/isAdmin 在本实例内立刻重算
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
