import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getClientId } from './clientId'
beforeEach(() => localStorage.clear())
describe('getClientId', () => {
  it('persists and returns a stable id', () => {
    const a = getClientId()
    expect(a).toBeTruthy()
    expect(getClientId()).toBe(a)
    expect(localStorage.getItem('nimoos:upload-client-id')).toBe(a)
  })
})
