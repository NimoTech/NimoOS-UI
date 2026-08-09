import { describe, it, expect } from 'vitest'
import { groupByTopSegment, computeUploadConflicts, splitConflictsByKind } from './uploadConflict'
import type { UploadEntry } from './uploadConflict'

const f = (name: string) => new File(['x'], name)
const e = (relativePath: string): UploadEntry => ({ file: f(relativePath.split('/').pop()!), relativePath })

describe('groupByTopSegment', () => {
  it('groups nested paths under their first segment', () => {
    const groups = groupByTopSegment([e('Trip/Day1/1.jpg'), e('Trip/Day2/2.jpg')])
    expect([...groups.keys()]).toEqual(['Trip'])
    expect(groups.get('Trip')!.entries).toHaveLength(2)
    expect(groups.get('Trip')!.isFolderGroup).toBe(true)
  })

  it('a bare file is its own group and is not a folder group', () => {
    const groups = groupByTopSegment([e('a.txt')])
    expect(groups.get('a.txt')!.isFolderGroup).toBe(false)
  })

  it('one nested entry is enough to make the whole group a folder group', () => {
    const groups = groupByTopSegment([e('Trip'), e('Trip/1.jpg')])
    expect(groups.get('Trip')!.isFolderGroup).toBe(true)
    expect(groups.get('Trip')!.entries).toHaveLength(2)
  })

  it('tolerates a null entry list', () => {
    expect(groupByTopSegment(null as unknown as UploadEntry[]).size).toBe(0)
  })
})

describe('computeUploadConflicts', () => {
  it('flags only groups whose top name is already taken', () => {
    const existing = new Map([['Trip', true]])
    const out = computeUploadConflicts([e('Trip/1.jpg'), e('new.txt')], existing)
    expect(out.map((c) => c.name)).toEqual(['Trip'])
    expect(out[0].groupKey).toBe('Trip')
  })

  it('isDir is true when the EXISTING entry is a directory', () => {
    const out = computeUploadConflicts([e('Trip')], new Map([['Trip', true]]))
    expect(out[0].isDir).toBe(true)
  })

  it('isDir is true when the INCOMING group is a folder, even against an existing file', () => {
    const out = computeUploadConflicts([e('Trip/1.jpg')], new Map([['Trip', false]]))
    expect(out[0].isDir).toBe(true)
  })

  it('isDir is false for a plain file landing on an existing file', () => {
    const out = computeUploadConflicts([e('a.txt')], new Map([['a.txt', false]]))
    expect(out[0].isDir).toBe(false)
  })
})

describe('splitConflictsByKind', () => {
  it('file-vs-file goes to fileConflicts and carries no mergeable flag', () => {
    const entries = [e('a.txt')]
    const existing = new Map([['a.txt', false]])
    const { fileConflicts, folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts).toEqual([])
    expect(fileConflicts.map((c) => c.name)).toEqual(['a.txt'])
    expect(fileConflicts[0].mergeable).toBeUndefined()
  })

  it('folder-vs-folder is mergeable', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', true]])
    const { folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts).toHaveLength(1)
    expect(folderConflicts[0].mergeable).toBe(true)
  })

  it('folder group vs existing FILE is a folder conflict but not mergeable', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', false]])
    const { folderConflicts, fileConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(fileConflicts).toEqual([])
    expect(folderConflicts[0].mergeable).toBe(false)
  })

  it('bare file vs existing FOLDER is a folder conflict but not mergeable', () => {
    const entries = [e('Trip')]
    const existing = new Map([['Trip', true]])
    const { folderConflicts } = splitConflictsByKind(
      computeUploadConflicts(entries, existing), entries, existing,
    )
    expect(folderConflicts[0].mergeable).toBe(false)
  })

  it('does not mutate computeUploadConflicts output', () => {
    const entries = [e('Trip/1.jpg')]
    const existing = new Map([['Trip', true]])
    const conflicts = computeUploadConflicts(entries, existing)
    splitConflictsByKind(conflicts, entries, existing)
    expect(conflicts[0].mergeable).toBeUndefined()
  })
})
