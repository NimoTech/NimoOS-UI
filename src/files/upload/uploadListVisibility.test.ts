import { describe, it, expect } from 'vitest'
import { shouldAutoOpenUploadList } from './uploadListVisibility'
describe('shouldAutoOpenUploadList', () => {
  it('opens only when the queue grows', () => {
    expect(shouldAutoOpenUploadList(0, 1)).toBe(true)
    expect(shouldAutoOpenUploadList(2, 2)).toBe(false)
    expect(shouldAutoOpenUploadList(3, 2)).toBe(false)
  })
})
