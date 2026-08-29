import { describe, it, expect, vi } from 'vitest'
import { authGuard } from './guard'

function deps(over: Partial<Parameters<typeof authGuard>[0]> = {}) {
  return {
    getToken: () => 'tok',
    getVersion: () => 'local',
    clearToken: vi.fn(),
    getStatus: vi.fn(async () => ({ initialized: true })),
    onNeedInit: vi.fn(),
    ...over,
  }
}

describe('authGuard', () => {
  it('allows protected route when token+version present (no network probe)', async () => {
    const d = deps()
    expect(await authGuard(d)({ path: '/' })).toBe(true)
    expect(d.getStatus).not.toHaveBeenCalled()
  })

  it('protected + no token + initialized → /login', async () => {
    const d = deps({ getToken: () => null, getStatus: vi.fn(async () => ({ initialized: true })) })
    expect(await authGuard(d)({ path: '/' })).toBe('/login')
  })

  it('protected + no token + uninitialized → /welcome and stores initKey', async () => {
    const d = deps({ getToken: () => null, getStatus: vi.fn(async () => ({ initialized: false, key: 'K9' })) })
    expect(await authGuard(d)({ path: '/' })).toBe('/welcome')
    expect(d.onNeedInit).toHaveBeenCalledWith('K9')
  })

  it('protected + no token + malformed status (initialized undefined) → /login', async () => {
    const d = deps({ getToken: () => null, getStatus: vi.fn(async () => ({ initialized: undefined as unknown as boolean })) })
    expect(await authGuard(d)({ path: '/' })).toBe('/login')
    expect(d.onNeedInit).not.toHaveBeenCalled()
  })

  it('protected + token but missing version → clears token → /login', async () => {
    const d = deps({ getVersion: () => null })
    expect(await authGuard(d)({ path: '/' })).toBe('/login')
    expect(d.clearToken).toHaveBeenCalled()
  })

  it('/login with token redirects to /', async () => {
    expect(await authGuard(deps())({ path: '/login', meta: { public: true } })).toBe('/')
  })

  it('/login without token is allowed', async () => {
    expect(await authGuard(deps({ getToken: () => null }))({ path: '/login', meta: { public: true } })).toBe(true)
  })

  it('/welcome is always allowed', async () => {
    expect(await authGuard(deps())({ path: '/welcome', meta: { public: true } })).toBe(true)
  })

  it('getStatus failure fails safe to /login', async () => {
    const d = deps({ getToken: () => null, getStatus: vi.fn(async () => { throw new Error('net') }) })
    expect(await authGuard(d)({ path: '/' })).toBe('/login')
  })
})
