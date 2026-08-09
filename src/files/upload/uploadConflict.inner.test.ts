import { describe, it, expect } from 'vitest'
import { applyInnerResolutions } from './uploadConflict'
import type { AcceptedEntry, InnerPrecheckResult } from './uploadConflict'
import type { ConflictResolution, ConflictAction } from './fileConflict'

const e = (relativePath: string): AcceptedEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
  conflictPolicy: '',
  pendingInnerCheck: true,
})
const hit = (relativePath: string, isDir = false): InnerPrecheckResult => ({ relativePath, exists: true, is_dir: isDir })
const miss = (relativePath: string): InnerPrecheckResult => ({ relativePath, exists: false })
const res = (groupKey: string, action: ConflictAction): ConflictResolution => ({
  conflict: { name: groupKey, groupKey, isDir: false },
  action,
})

describe('applyInnerResolutions', () => {
  it('a path with no counterpart inside the folder lands untouched', () => {
    const out = applyInnerResolutions([e('Trip/new.jpg')], [miss('Trip/new.jpg')], [])
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/new.jpg', conflictPolicy: '' }])
    expect(out.skippedCount).toBe(0)
  })

  it('a path the backend never reported on is also treated as non-colliding', () => {
    const out = applyInnerResolutions([e('Trip/new.jpg')], [], [])
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip/new.jpg'])
  })

  it('overwrite on a colliding inner file stamps the overwrite policy', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'overwrite')])
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: 'overwrite' }])
  })

  it('keep_both on a colliding inner file defers naming to the backend', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'keep_both')])
    expect(out.accepted[0].conflictPolicy).toBe('rename')
  })

  it('skip drops the inner file and counts it', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'skip')])
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(1)
  })

  it('cancelled drops the inner file and counts separately', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [res('Trip/1.jpg', 'cancelled')])
    expect(out.cancelledCount).toBe(1)
  })

  it('a colliding path with NO resolution is skipped, never silently accepted', () => {
    const out = applyInnerResolutions([e('Trip/1.jpg')], [hit('Trip/1.jpg')], [])
    expect(out.accepted).toEqual([])
    expect(out.skippedCount).toBe(1)
  })

  it('resolves each path independently — no grouping in the second round', () => {
    const out = applyInnerResolutions(
      [e('Trip/1.jpg'), e('Trip/2.jpg')],
      [hit('Trip/1.jpg'), hit('Trip/2.jpg')],
      [res('Trip/1.jpg', 'overwrite'), res('Trip/2.jpg', 'skip')],
    )
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['Trip/1.jpg'])
    expect(out.skippedCount).toBe(1)
  })
})
