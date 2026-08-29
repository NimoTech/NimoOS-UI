import { describe, it, expect } from 'vitest'
import { shouldNavigateHome } from './mounts'

describe('shouldNavigateHome', () => {
  it('currently in the ejected mount point → true', () => {
    expect(shouldNavigateHome('/mnt/host', '/mnt/host')).toBe(true)
  })
  it('currently in its subdirectory → true', () => {
    expect(shouldNavigateHome('/mnt/host/share/a', '/mnt/host')).toBe(true)
  })
  it('same prefix but not the same mount point (host vs host2) → false', () => {
    expect(shouldNavigateHome('/mnt/host2', '/mnt/host')).toBe(false)
  })
  it('unrelated path → false', () => {
    expect(shouldNavigateHome('/DATA/Documents', '/mnt/host')).toBe(false)
  })
})
