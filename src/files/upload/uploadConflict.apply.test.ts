import { describe, it, expect } from 'vitest'
import { applyUploadResolutions, nextAvailableName } from './uploadConflict'
import type { UploadEntry } from './uploadConflict'
import type { ConflictResolution, ConflictAction } from './fileConflict'

const e = (relativePath: string): UploadEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
})
const res = (groupKey: string, action: ConflictAction, over: Partial<{ isDir: boolean; mergeable: boolean }> = {}): ConflictResolution => ({
  conflict: { name: groupKey, groupKey, isDir: over.isDir ?? false, ...(over.mergeable !== undefined ? { mergeable: over.mergeable } : {}) },
  action,
})

describe('nextAvailableName', () => {
  it('returns the name unchanged when it is free', () => {
    expect(nextAvailableName('A', new Set())).toBe('A')
  })
  it('appends the smallest free (n) suffix', () => {
    expect(nextAvailableName('A', new Set(['A']))).toBe('A(1)')
    expect(nextAvailableName('A', new Set(['A', 'A(1)']))).toBe('A(2)')
    expect(nextAvailableName('A', new Set(['A', 'A(1)', 'A(2)']))).toBe('A(3)')
  })
})

describe('applyUploadResolutions', () => {
  it('entries with no resolution land unchanged with an empty policy', () => {
    const out = applyUploadResolutions([e('new.txt')], [], new Set())
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'new.txt', conflictPolicy: '' }])
    expect(out.skippedCount).toBe(0)
    expect(out.cancelledCount).toBe(0)
  })

  it('skip drops the whole group and counts every entry in it', () => {
    const out = applyUploadResolutions([e('Trip/1.jpg'), e('Trip/2.jpg')], [res('Trip', 'skip')], new Set())
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(2)
  })

  it('cancelled drops the group and counts separately from skip', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'cancelled')], new Set())
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(0)
    expect(out.cancelledCount).toBe(1)
  })

  it('overwrite stamps the overwrite policy and keeps the path', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'overwrite')], new Set(['a.txt']))
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: 'overwrite' }])
  })

  it('keep_both on a single FILE defers naming to the backend via rename', () => {
    const out = applyUploadResolutions([e('a.txt')], [res('a.txt', 'keep_both')], new Set(['a.txt']))
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: 'rename' }])
  })

  it('keep_both on a FOLDER rewrites every entry to the new top name', () => {
    const names = new Set(['Trip'])
    const out = applyUploadResolutions(
      [e('Trip/Day1/1.jpg'), e('Trip/2.jpg')],
      [res('Trip', 'keep_both', { isDir: true })],
      names,
    )
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip(1)/Day1/1.jpg', 'Trip(1)/2.jpg'])
    expect(out.accepted.every((a) => a.conflictPolicy === '')).toBe(true)
  })

  it('two keep_both folder groups with the same top name do not collide with each other', () => {
    const names = new Set(['Trip'])
    applyUploadResolutions([e('Trip/1.jpg')], [res('Trip', 'keep_both', { isDir: true })], names)
    const second = applyUploadResolutions([e('Trip/2.jpg')], [res('Trip', 'keep_both', { isDir: true })], names)
    expect(second.accepted[0].relativePath).toBe('Trip(2)/2.jpg')
  })

  it('merge on a mergeable folder keeps paths and tags them for the second round', () => {
    const out = applyUploadResolutions(
      [e('Trip/1.jpg')],
      [res('Trip', 'merge', { isDir: true, mergeable: true })],
      new Set(['Trip']),
    )
    expect(out.accepted).toEqual([
      { file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: '', pendingInnerCheck: true },
    ])
  })

  it('merge forced onto a NON-mergeable group degrades to keep_both instead of merging', () => {
    // Reachable only via "apply to all" propagating a previous group's merge
    // choice onto a type-mismatch collision.
    const names = new Set(['Trip'])
    const out = applyUploadResolutions(
      [e('Trip/1.jpg')],
      [res('Trip', 'merge', { isDir: true, mergeable: false })],
      names,
    )
    expect(out.accepted[0].pendingInnerCheck).toBeUndefined()
    expect(out.accepted[0].relativePath).toBe('Trip(1)/1.jpg')
  })
})
