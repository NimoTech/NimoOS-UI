import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { loadFromServer, loginApi } = vi.hoisted(() => ({
  loadFromServer: vi.fn(async () => {}),
  loginApi: vi.fn(async () => ({ token: { access_token: 'a', refresh_token: 'r', expires_at: '1' }, user: { id: 1 } }))
}))

vi.mock('../stores/locale', () => ({ useLocaleStore: () => ({ loadFromServer }) }))

vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { users: { login: loginApi }, sys: { getVersion: vi.fn(async () => ({ current_version: 'x' })) } } }
})

import { useAuth } from './useAuth'

describe('useAuth applies server locale', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.clearAllMocks() })

  it('call loadFromServer after successful login', async () => {
    await useAuth().login('nimo', 'secret1')
    expect(loadFromServer).toHaveBeenCalledTimes(1)
  })
})
