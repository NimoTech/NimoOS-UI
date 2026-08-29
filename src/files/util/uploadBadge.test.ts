import { describe, it, expect } from 'vitest'
import { isUploadBroken, uploadBatchIdOf } from './uploadBadge'
import type { FileEntry } from '../stores/files'

function entry(ext: unknown): FileEntry {
  return { name: 'a.txt', path: '/DATA/x/a.txt', is_dir: false, extensions: ext as FileEntry['extensions'] }
}

describe('upload badge state', () => {
  it('reads a boolean broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe(true)
  })

  // The backend's JSON may serialize the flag as a string: Vue2 IconContainerMixin.js:71
  // accepted both forms, so this ports the same leniency.
  it('reads a string broken flag', () => {
    expect(isUploadBroken(entry({ upload: { broken: 'true', batchId: 'b1' } }))).toBe(true)
  })

  it('is false for broken:false, missing upload, null extensions', () => {
    expect(isUploadBroken(entry({ upload: { broken: false } }))).toBe(false)
    expect(isUploadBroken(entry({ share: { shared: 'true' } }))).toBe(false)
    expect(isUploadBroken(entry(null))).toBe(false)
  })

  it('extracts the batch id, empty string when absent', () => {
    expect(uploadBatchIdOf(entry({ upload: { broken: true, batchId: 'b1' } }))).toBe('b1')
    expect(uploadBatchIdOf(entry({ upload: { broken: true } }))).toBe('')
    expect(uploadBatchIdOf(entry(null))).toBe('')
  })
})
