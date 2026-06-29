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
})
