import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      login: vi.fn(async () => ({ token: { access_token: 'a', refresh_token: 'r', expires_at: '9' }, user: { username: 'nimo' } })),
      register: vi.fn(async () => null),
      getStatus: vi.fn(async () => ({ initialized: true })),
      setCustomStorage: vi.fn(async () => null),
    },
    sys: { getVersion: vi.fn(async () => ({ current_version: '1.2.3' })) },
  },
}))

import { service } from '@nimotech/nimoos-service'
import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks() })

  it('login writes tokens, user and version=local', async () => {
    await useAuth().login('nimo', 'pw')
    expect(localStorage.getItem('access_token')).toBe('a')
    expect(JSON.parse(localStorage.getItem('user')!).username).toBe('nimo')
    expect(localStorage.getItem('version')).toBe('local')
  })

  it('registerAndLogin registers, logs in, writes real version + fromWelcome + app_order', async () => {
    await useAuth().registerAndLogin('nimo', 'pw', 'K1')
    expect(service.users.register).toHaveBeenCalledWith('nimo', 'pw', 'K1')
    expect(localStorage.getItem('version')).toBe('1.2.3')
    expect(sessionStorage.getItem('fromWelcome')).toBe('true')
    expect(service.users.setCustomStorage).toHaveBeenCalledWith('app_order', { data: ['App Store', 'Files'] })
  })

  it('registerAndLogin falls back to version=local when getVersion fails', async () => {
    ;(service.sys.getVersion as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(new Error('x'))
    await useAuth().registerAndLogin('nimo', 'pw', 'K1')
    expect(localStorage.getItem('version')).toBe('local')
  })

  it('logout clears session', async () => {
    await useAuth().login('nimo', 'pw')
    useAuth().logout()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
