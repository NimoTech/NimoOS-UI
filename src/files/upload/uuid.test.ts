import { describe, it, expect, afterEach } from 'vitest'
import { safeRandomUUID } from './uuid'

const realRandomUUID = globalThis.crypto?.randomUUID

afterEach(() => {
  // restore
  if (globalThis.crypto) {
    ;(globalThis.crypto as { randomUUID?: unknown }).randomUUID = realRandomUUID
  }
})

describe('safeRandomUUID', () => {
  it('uses crypto.randomUUID when available', () => {
    const id = safeRandomUUID()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('falls back to a non-empty id when crypto.randomUUID is unavailable (non-secure context)', () => {
    // Simulate a non-secure context (plain HTTP to a LAN IP): crypto exists
    // but crypto.randomUUID is undefined.
    ;(globalThis.crypto as { randomUUID?: unknown }).randomUUID = undefined
    const id = safeRandomUUID()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    // two calls should differ (used as batch/client ids)
    expect(safeRandomUUID()).not.toBe(id)
  })
})
