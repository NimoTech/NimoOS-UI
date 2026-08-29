import { describe, expect, it } from 'vitest'
import { baseName, computePasteConflicts, splitPasteItems } from './pasteConflict'
import type { ConflictResolution } from './fileConflict'
import type { OperateItem } from '../stores/clipboard'

const listing = (names: [string, boolean][]) => async () => ({
  content: names.map(([name, is_dir]) => ({ name, is_dir })),
})

describe('baseName', () => {
  it('returns the last segment', () => {
    expect(baseName('/DATA/a/b.txt')).toBe('b.txt')
    expect(baseName('/DATA/a/b/')).toBe('b')
  })
  it('never throws on empty input', () => {
    expect(baseName('')).toBe('')
  })
})

describe('computePasteConflicts', () => {
  it('flags only the items whose name is already taken in the destination', async () => {
    const items: OperateItem[] = [
      { from: '/DATA/src/a.txt', is_dir: false },
      { from: '/DATA/src/Trip', is_dir: true },
    ]
    const conflicts = await computePasteConflicts({
      items, destDir: '/DATA/dst', listFolder: listing([['a.txt', false]]),
    })
    expect(conflicts.map((c) => c.name)).toEqual(['a.txt'])
  })

  it('marks a directory source as isDir so the dialog can disable Overwrite', async () => {
    const items: OperateItem[] = [{ from: '/DATA/src/Trip', is_dir: true }]
    const conflicts = await computePasteConflicts({
      items, destDir: '/DATA/dst', listFolder: listing([['Trip', true]]),
    })
    expect(conflicts[0]).toMatchObject({ name: 'Trip', isDir: true, groupKey: '/DATA/src/Trip' })
  })
})

describe('splitPasteItems', () => {
  const a: OperateItem = { from: '/DATA/src/a.txt', is_dir: false }
  const b: OperateItem = { from: '/DATA/src/b.txt', is_dir: false }
  const c: OperateItem = { from: '/DATA/src/c.txt', is_dir: false }
  const res = (from: string, action: ConflictResolution['action']): ConflictResolution =>
    ({ conflict: { name: baseName(from), isDir: false, groupKey: from }, action })

  it('routes overwrite answers to the overwrite batch', () => {
    const out = splitPasteItems([a, b], [res(a.from, 'overwrite')])
    expect(out.overwriteItems).toEqual([a])
    expect(out.renameItems).toEqual([b])
  })

  it('drops skipped and cancelled items and counts them together in skippedCount', () => {
    const out = splitPasteItems([a, b, c], [res(a.from, 'skip'), res(b.from, 'cancelled')])
    expect(out.overwriteItems).toEqual([])
    expect(out.renameItems).toEqual([c])
    expect(out.skippedCount).toBe(2)
    // cancelledCount isolates the cancelled subset -- callers use it to tell
    // "the user cancelled the dialog" apart from "the user explicitly skipped
    // everything", which matters for whether it's safe to clear the clipboard.
    expect(out.cancelledCount).toBe(1)
  })

  it('sends never-conflicting items with the keep-both style, same as an explicit keep_both', () => {
    // The backend's style only fires ON a real collision, so a conflict-free
    // item submitted as 'rename' behaves exactly like the old silent default.
    const out = splitPasteItems([a, b], [res(a.from, 'keep_both')])
    expect(out.renameItems).toEqual([a, b])
    expect(out.skippedCount).toBe(0)
  })
})
