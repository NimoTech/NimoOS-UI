import { describe, it, expect, vi } from 'vitest'
vi.mock('@nimotech/nimoos-service', () => ({
  service: { file: { uploadPrecheck: vi.fn() } },
}))
import { conflictKey, precheckExisting, decideConflictPolicy } from './conflict'
import { service } from '@nimotech/nimoos-service'

describe('decideConflictPolicy', () => {
  it('normalizes and defaults unknown to rename', () => {
    expect(decideConflictPolicy('overwrite')).toBe('overwrite')
    expect(decideConflictPolicy('skip')).toBe('skip')
    expect(decideConflictPolicy(null)).toBe('rename')
    expect(decideConflictPolicy('bogus')).toBe('rename')
  })
})

describe('precheckExisting', () => {
  it('groups by targetPath and returns conflict keys for existing files', async () => {
    ;(service.file.uploadPrecheck as any).mockImplementation((dir: string, files: any[]) =>
      Promise.resolve({ results: files.map((f, i) => ({ relativePath: f.relativePath, exists: i === 0 })) }))
    const set = await precheckExisting([
      { file: new File(['a'], 'a'), targetPath: '/DATA/x', relativePath: 'a' },
      { file: new File(['b'], 'b'), targetPath: '/DATA/x', relativePath: 'b' },
    ])
    expect(set.has(conflictKey('/DATA/x', 'a'))).toBe(true)
    expect(set.has(conflictKey('/DATA/x', 'b'))).toBe(false)
  })

  it('rethrows on precheck error', async () => {
    ;(service.file.uploadPrecheck as any).mockRejectedValue(new Error('net'))
    await expect(precheckExisting([{ file: new File(['a'], 'a'), targetPath: '/DATA', relativePath: 'a' }]))
      .rejects.toThrow('net')
  })
})
