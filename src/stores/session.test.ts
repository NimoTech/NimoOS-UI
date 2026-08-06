import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from './session'

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('reads token from localStorage', () => {
    localStorage.setItem('access_token', 'tok-1')
    const s = useSessionStore()
    expect(s.token).toBe('tok-1')
    expect(s.isAuthed).toBe(true)
  })

  it('setTokens writes all three keys and updates token', () => {
    const s = useSessionStore()
    s.setTokens('a', 'r', '12345')
    expect(localStorage.getItem('access_token')).toBe('a')
    expect(localStorage.getItem('refresh_token')).toBe('r')
    expect(localStorage.getItem('expires_at')).toBe('12345')
    expect(s.token).toBe('a')
  })

  it('clear removes tokens and flips isAuthed', () => {
    const s = useSessionStore()
    s.setTokens('a', 'r')
    s.clear()
    expect(s.isAuthed).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('setUser stores JSON user', () => {
    const s = useSessionStore()
    s.setUser({ username: 'nimo', role: 'admin' })
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual({ username: 'nimo', role: 'admin' })
  })

  it('setVersion stores version', () => {
    const s = useSessionStore()
    s.setVersion('local')
    expect(localStorage.getItem('version')).toBe('local')
  })

  it('clear removes user, version and wallpaper too', () => {
    const s = useSessionStore()
    s.setTokens('a', 'r', '9'); s.setUser({ username: 'x' }); s.setVersion('local')
    localStorage.setItem('wallpaper', 'w1')
    s.clear()
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('version')).toBeNull()
    expect(localStorage.getItem('wallpaper')).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})

describe('SP8-P2b Task 2 —— user / isAdmin 读口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('localStorage 里有 admin 用户时 user 能读回、isAdmin 为 true', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const s = useSessionStore()
    expect(s.user?.username).toBe('nimo')
    expect(s.isAdmin).toBe(true)
  })

  it('非 admin 角色 isAdmin 为 false', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' }))
    const s = useSessionStore()
    expect(s.isAdmin).toBe(false)
  })

  it('localStorage 无 user 时 user 为 null、isAdmin 为 false(不抛)', () => {
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('localStorage 里是坏 JSON 时也不抛,退化成 null', () => {
    localStorage.setItem('user', '{不是 JSON')
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('user 不是对象(比如存了字符串)时也退化成 null', () => {
    localStorage.setItem('user', '"nimo"')
    const s = useSessionStore()
    expect(s.user).toBeNull()
  })

  // final review Fix 7 —— 证明同一个 store 实例内 setUser 之后 user/isAdmin 立刻重算
  // (不依赖整页重载)。Login.vue:44 用的是 router.push,不是整页刷新,所以这条必须成立。
  it('同一实例内 setUser 之后 user / isAdmin 立刻更新,不需要重新拿实例或刷新页面', () => {
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)

    s.setUser({ username: 'nimo', role: 'admin' })
    expect(s.user).toEqual({ username: 'nimo', role: 'admin' })
    expect(s.isAdmin).toBe(true)

    // 模拟同一会话里登出又登录成另一个非管理员账号(无整页重载)
    s.clear()
    s.setUser({ username: 'guest', role: 'user' })
    expect(s.user).toEqual({ username: 'guest', role: 'user' })
    expect(s.isAdmin).toBe(false)
  })
})
