import { describe, it, expect, vi } from 'vitest'
import { makeAuthFailHandler } from './onAuthFail'

describe('makeAuthFailHandler', () => {
  it('clears then navigates, in that order', () => {
    const calls: string[] = []
    const clear = vi.fn(() => calls.push('clear'))
    const navigate = vi.fn(() => calls.push('navigate'))
    makeAuthFailHandler(clear, navigate)()
    expect(clear).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
    expect(calls).toEqual(['clear', 'navigate'])
  })
})
