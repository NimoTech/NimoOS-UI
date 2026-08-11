import { describe, it, expect } from 'vitest'
import { uploadPlaceholders, mergeUploadPlaceholders } from './uploadPlaceholders'
import type { UploadItem } from './types'
import type { FileEntry } from '../stores/files'

const item = (over: Partial<UploadItem>): UploadItem => ({
  id: 'i', file: null, fileName: 'f', fileType: '', size: 1,
  targetPath: '/DATA/x', relativePath: 'f', status: 'uploading',
  progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0,
  error: '', createdAt: 0, batchId: 'b', batchTotal: 1, conflictPolicy: '',
  ...over,
})

describe('uploadPlaceholders', () => {
  it('makes one folder entry for a folder upload in the current dir', () => {
    const q = [
      item({ id: '1', relativePath: 'Trip/a.jpg' }),
      item({ id: '2', relativePath: 'Trip/sub/b.jpg' }),
    ]
    const out = uploadPlaceholders(q, '/DATA/x')
    expect(out).toEqual([{ name: 'Trip', path: '/DATA/x/Trip', is_dir: true, uploading: true }])
  })

  it('makes a file entry for a bare single-file upload', () => {
    const out = uploadPlaceholders([item({ relativePath: 'photo.png' })], '/DATA/x')
    expect(out).toEqual([{ name: 'photo.png', path: '/DATA/x/photo.png', is_dir: false, uploading: true }])
  })

  it('ignores uploads targeting a different directory', () => {
    const out = uploadPlaceholders([item({ targetPath: '/DATA/other', relativePath: 'Trip/a.jpg' })], '/DATA/x')
    expect(out).toEqual([])
  })

  it('normalizes a trailing slash on either side before matching', () => {
    const out = uploadPlaceholders([item({ targetPath: '/DATA/x/', relativePath: 'Trip/a.jpg' })], '/DATA/x')
    expect(out.map((e) => e.name)).toEqual(['Trip'])
  })

  it('drops done and error items (only pending/uploading/paused are in flight)', () => {
    const q = [
      item({ id: '1', relativePath: 'DoneDir/a', status: 'done' }),
      item({ id: '2', relativePath: 'ErrDir/a', status: 'error' }),
      item({ id: '3', relativePath: 'LiveDir/a', status: 'pending' }),
      item({ id: '4', relativePath: 'PausedDir/a', status: 'paused' }),
    ]
    expect(uploadPlaceholders(q, '/DATA/x').map((e) => e.name).sort()).toEqual(['LiveDir', 'PausedDir'])
  })

  it('folder wins when the same top name appears both nested and bare', () => {
    const q = [item({ id: '1', relativePath: 'Mix' }), item({ id: '2', relativePath: 'Mix/inner/a' })]
    const out = uploadPlaceholders(q, '/DATA/x')
    expect(out).toEqual([{ name: 'Mix', path: '/DATA/x/Mix', is_dir: true, uploading: true }])
  })

  it('returns nothing for an empty current path (root not addressed yet)', () => {
    expect(uploadPlaceholders([item({})], '')).toEqual([])
  })
})

describe('mergeUploadPlaceholders', () => {
  const real = (name: string): FileEntry => ({ name, path: `/DATA/x/${name}`, is_dir: true })

  it('prepends placeholders that are not already on disk', () => {
    const sorted = [real('A'), real('B')]
    const ph = [{ name: 'New', path: '/DATA/x/New', is_dir: true, uploading: true }]
    const out = mergeUploadPlaceholders(sorted, ph)
    expect(out.map((e) => e.name)).toEqual(['New', 'A', 'B'])
  })

  it('drops a placeholder once a real entry with that name exists', () => {
    const sorted = [real('Trip')]
    const ph = [{ name: 'Trip', path: '/DATA/x/Trip', is_dir: true, uploading: true }]
    const out = mergeUploadPlaceholders(sorted, ph)
    expect(out).toBe(sorted) // same reference: nothing to add
    expect(out.map((e) => e.name)).toEqual(['Trip'])
  })

  it('returns the original list untouched when there are no placeholders', () => {
    const sorted = [real('A')]
    expect(mergeUploadPlaceholders(sorted, [])).toBe(sorted)
  })
})
