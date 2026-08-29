import { describe, it, expect } from 'vitest'
import { unwrap } from './unwrap'

describe('unwrap', () => {
  it('returns data on success===200', () => {
    expect(unwrap({ success: 200, data: { a: 1 } })).toEqual({ a: 1 })
  })
  it('throws with server message and code on non-200', () => {
    try { unwrap({ success: 404, message: 'nope' }); throw new Error('should not reach') }
    catch (e) {
      expect((e as Error).message).toBe('nope')
      expect((e as Error & { code?: number }).code).toBe(404)
    }
  })
  it('carries the envelope data string as `detail` when it fails', () => {
    try { unwrap({ success: 500, message: 'Fail', data: 'open /DATA/x: permission denied' } as never); throw new Error('should not reach') }
    catch (e) {
      expect((e as Error).message).toBe('Fail')
      expect((e as Error & { detail?: string }).detail).toBe('open /DATA/x: permission denied')
    }
  })
  it('leaves `detail` undefined when data is not a string', () => {
    try { unwrap({ success: 500, message: 'Fail', data: { a: 1 } }); throw new Error('should not reach') }
    catch (e) {
      expect((e as Error & { detail?: string }).detail).toBeUndefined()
    }
  })
})
