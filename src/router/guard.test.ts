import { describe, it, expect, vi } from 'vitest'
import { authGuard } from './guard'

describe('authGuard', () => {
  it('allows navigation when a token exists', () => {
    const redirect = vi.fn()
    const guard = authGuard(() => 'tok', redirect)
    expect(guard({})).toBe(true)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects and blocks when no token', () => {
    const redirect = vi.fn()
    const guard = authGuard(() => null, redirect)
    expect(guard({})).toBe(false)
    expect(redirect).toHaveBeenCalledOnce()
  })
})
