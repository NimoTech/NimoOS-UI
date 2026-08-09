import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'
import { useUploadConflicts } from './useUploadConflicts'
import type { UploadEntry } from '../upload/uploadConflict'

const e = (relativePath: string): UploadEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
})
const listing = (content: { name: string; is_dir: boolean }[]) => vi.fn().mockResolvedValue({ content })

// Drives the dialog: waits for it to open, then answers with `choice`.
async function answer(c: ReturnType<typeof useUploadConflicts>, choice: { action: string; applyToAll?: boolean } | null) {
  for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
  expect(c.dialog.value.open).toBe(true)
  if (choice) c.onChoose(choice as never)
  else c.onCancel()
}

describe('useUploadConflicts', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('no collision → everything accepted with an empty policy, dialog never opens', async () => {
    const c = useUploadConflicts({ listFolder: listing([]) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: '' }])
    expect(c.dialog.value.open).toBe(false)
  })

  it('a file collision opens the dialog and applies the choice', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt')], '/DATA')
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('overwrite')
    expect(c.dialog.value.open).toBe(false)
  })

  it('passes the conflicting name, target path and isDir to the dialog', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]) })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA/Documents')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.name).toBe('Trip')
    expect(c.dialog.value.targetPath).toBe('/DATA/Documents')
    expect(c.dialog.value.isDir).toBe(true)
    expect(c.dialog.value.allowMerge).toBe(true)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('allowMerge is false for a folder group landing on an existing FILE', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: false }]) })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.allowMerge).toBe(false)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('cancel marks this and every remaining conflict cancelled', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt'), e('b.txt')], '/DATA')
    await answer(c, null)
    const out = await p
    expect(out.accepted).toEqual([])
    expect(out.cancelledCount).toBe(2)
  })

  it('merge runs a second precheck round and resolves only the colliding inner files', async () => {
    const precheck = vi.fn().mockResolvedValue({
      results: [
        { relativePath: 'Trip/1.jpg', exists: true, is_dir: false },
        { relativePath: 'Trip/2.jpg', exists: false },
      ],
    })
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg'), e('Trip/2.jpg')], '/DATA')
    await answer(c, { action: 'merge' })          // round 1: merge the folder
    await answer(c, { action: 'overwrite' })      // round 2: only 1.jpg collides
    const out = await p
    expect(precheck).toHaveBeenCalledTimes(1)
    expect(out.accepted).toEqual([
      { file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: 'overwrite' },
      { file: expect.any(File), relativePath: 'Trip/2.jpg', conflictPolicy: '' },
    ])
  })

  it('a merge whose inner files never collide skips the second dialog entirely', async () => {
    const precheck = vi.fn().mockResolvedValue({ results: [{ relativePath: 'Trip/1.jpg', exists: false }] })
    const c = useUploadConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    await answer(c, { action: 'merge' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('')
    expect(c.dialog.value.open).toBe(false)
  })

  it('a failing listing degrades to accepting everything as-is', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useUploadConflicts({ listFolder: vi.fn().mockRejectedValue(new Error('offline')) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['a.txt'])
    expect(c.dialog.value.open).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('a failing inner precheck accepts the merged entries as-is without a second dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useUploadConflicts({
      listFolder: listing([{ name: 'Trip', is_dir: true }]),
      precheck: vi.fn().mockRejectedValue(new Error('offline')),
    })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    await answer(c, { action: 'merge' })
    const out = await p
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: '' }])
    expect(warn).toHaveBeenCalled()
  })

  it('two batches queued back to back are resolved serially, not concurrently', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p1 = c.resolveEntries([e('a.txt')], '/DATA')
    const p2 = c.resolveEntries([e('b.txt')], '/DATA')
    await answer(c, { action: 'skip' })
    expect(c.dialog.value.name).toBe('a.txt')   // still the first batch's conflict, not overwritten
    const r1 = await p1
    await answer(c, { action: 'skip' })
    expect(c.dialog.value.name).toBe('b.txt')
    const r2 = await p2
    expect(r1.skippedCount).toBe(1)
    expect(r2.skippedCount).toBe(1)
  })

  it('cancel in the folder queue also cancels every pending file conflict — the dialog does not reopen', async () => {
    const c = useUploadConflicts({
      listFolder: listing([{ name: 'Trip', is_dir: true }, { name: 'a.txt', is_dir: false }]),
    })
    const p = c.resolveEntries([e('Trip/1.jpg'), e('a.txt')], '/DATA')
    await answer(c, null) // cancel on the folder prompt — the folder queue runs first
    // Give the file queue every chance it would need to (wrongly) reopen the
    // dialog for a.txt before asserting it stayed closed.
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(false)
    const out = await p
    expect(out.accepted).toEqual([])
    expect(out.cancelledCount).toBe(2)
  })

  it('answering the folder prompt normally still lets the file prompt open afterwards', async () => {
    const c = useUploadConflicts({
      listFolder: listing([{ name: 'Trip', is_dir: true }, { name: 'a.txt', is_dir: false }]),
    })
    const p = c.resolveEntries([e('Trip/1.jpg'), e('a.txt')], '/DATA')
    await answer(c, { action: 'skip' }) // answers the folder prompt — not a cancel
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')
    c.onChoose({ action: 'skip' } as never)
    const out = await p
    expect(out.skippedCount).toBe(2)
  })

  // Finding D. A Cancel means "stop asking about the rest of this batch", and the
  // folder queue already honoured that for the file queue. Round 2 (the per-file
  // check inside a folder that was merged in round 1) was not covered: the dialog
  // closed on the a.txt prompt and immediately reopened for Trip/1.jpg.
  it('cancel in the file queue also suppresses the merged folder second round', async () => {
    const precheck = vi.fn().mockResolvedValue({ results: [{ relativePath: 'Trip/1.jpg', exists: true, is_dir: false }] })
    const c = useUploadConflicts({
      listFolder: listing([{ name: 'Trip', is_dir: true }, { name: 'a.txt', is_dir: false }]),
      precheck,
    })
    const p = c.resolveEntries([e('Trip/1.jpg'), e('a.txt')], '/DATA')
    await answer(c, { action: 'merge' })  // folder queue runs first — merge Trip
    await answer(c, null)                 // file queue — cancel on a.txt
    // Give round 2 every chance it would need to (wrongly) reopen the dialog.
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(false)
    const out = await p
    expect(precheck).not.toHaveBeenCalled()
    expect(out.accepted).toEqual([])
    // Both the cancelled a.txt and the no-longer-asked-about Trip/1.jpg count as
    // cancelled, never as skipped — the two counts mean different things.
    expect(out.cancelledCount).toBe(2)
    expect(out.skippedCount).toBe(0)
  })

  // Finding E. The dialog is owned by whichever component instantiated this
  // composable, but the batch it gates outlives the view: navigating away mid
  // prompt used to strand `ask()`'s promise forever, so the caller never got to
  // enqueue anything and never reported anything either.
  it('tearing down the owning scope settles an open prompt as cancelled instead of hanging', async () => {
    const scope = effectScope()
    let c!: ReturnType<typeof useUploadConflicts>
    scope.run(() => { c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) }) })
    const p = c.resolveEntries([e('a.txt')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)

    scope.stop()
    const out = await p
    expect(out.accepted).toEqual([])
    expect(out.cancelledCount).toBe(1)
    expect(c.dialog.value.open).toBe(false)
  })

  it('can be created outside any effect scope without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useUploadConflicts({ listFolder: listing([]) })
    expect(c.dialog.value.open).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('exposes the queue position to the dialog for a multi-conflict queue', async () => {
    const c = useUploadConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt'), e('b.txt')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.queueIndex).toBe(0)
    expect(c.dialog.value.queueTotal).toBe(2)
    c.onChoose({ action: 'skip' } as never)
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.queueIndex).toBe(1)
    expect(c.dialog.value.queueTotal).toBe(2)
    c.onChoose({ action: 'skip' } as never)
    const out = await p
    expect(out.skippedCount).toBe(2)
  })
})
