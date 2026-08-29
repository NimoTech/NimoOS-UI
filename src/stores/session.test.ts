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

describe('SP8-P2b Task 2 -- user / isAdmin read side', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('when localStorage has an admin user, user reads back and isAdmin is true', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'nimo', role: 'admin' }))
    const s = useSessionStore()
    expect(s.user?.username).toBe('nimo')
    expect(s.isAdmin).toBe(true)
  })

  it('isAdmin is false for a non-admin role', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'guest', role: 'user' }))
    const s = useSessionStore()
    expect(s.isAdmin).toBe(false)
  })

  it('when localStorage has no user, user is null and isAdmin is false (no throw)', () => {
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('bad JSON in localStorage does not throw either, degrades to null', () => {
    localStorage.setItem('user', '{不是 JSON')
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)
  })

  it('degrades to null when user is not an object (e.g. a stored string)', () => {
    localStorage.setItem('user', '"nimo"')
    const s = useSessionStore()
    expect(s.user).toBeNull()
  })

  // final review Fix 7 -- proves that within the same store instance, user/isAdmin recompute
  // immediately after setUser (without relying on a full page reload). Login.vue:44 uses
  // router.push, not a full page refresh, so this must hold.
  it('after setUser within the same instance, user / isAdmin update immediately without re-fetching the instance or reloading the page', () => {
    const s = useSessionStore()
    expect(s.user).toBeNull()
    expect(s.isAdmin).toBe(false)

    s.setUser({ username: 'nimo', role: 'admin' })
    expect(s.user).toEqual({ username: 'nimo', role: 'admin' })
    expect(s.isAdmin).toBe(true)

    // simulate logging out and back in as a different, non-admin account within the same session (no full page reload)
    s.clear()
    s.setUser({ username: 'guest', role: 'user' })
    expect(s.user).toEqual({ username: 'guest', role: 'user' })
    expect(s.isAdmin).toBe(false)
  })
})
