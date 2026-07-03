import { describe, it, expect } from 'vitest'
import { canStoreBlob, PER_FILE_BLOB_CAP, TOTAL_BLOB_BUDGET } from './budget'
describe('canStoreBlob', () => {
  it('rejects empty, over-cap, and over-budget', () => {
    expect(canStoreBlob(0)).toBe(false)
    expect(canStoreBlob(PER_FILE_BLOB_CAP + 1)).toBe(false)
    expect(canStoreBlob(10, TOTAL_BLOB_BUDGET)).toBe(false)
    expect(canStoreBlob(10, 0)).toBe(true)
  })
})
