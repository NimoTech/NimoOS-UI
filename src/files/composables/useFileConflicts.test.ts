import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'
import { useFileConflicts } from './useFileConflicts'
import type { UploadEntry } from '../upload/uploadConflict'

const e = (relativePath: string): UploadEntry => ({
  file: new File(['x'], relativePath.split('/').pop()!),
  relativePath,
})
const listing = (content: { name: string; is_dir: boolean }[]) => vi.fn().mockResolvedValue({ content })

// Drives the dialog: waits for it to open, then answers with `choice`.
async function answer(c: ReturnType<typeof useFileConflicts>, choice: { action: string; applyToAll?: boolean } | null) {
  for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
  expect(c.dialog.value.open).toBe(true)
  if (choice) c.onChoose(choice as never)
  else c.onCancel()
}

describe('useFileConflicts', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('no collision → everything accepted with an empty policy, dialog never opens', async () => {
    const c = useFileConflicts({ listFolder: listing([]) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'a.txt', conflictPolicy: '' }])
    expect(c.dialog.value.open).toBe(false)
  })

  it('a file collision opens the dialog and applies the choice', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt')], '/DATA')
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('overwrite')
    expect(c.dialog.value.open).toBe(false)
  })

  it('passes the conflicting name, target path and isDir to the dialog', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]) })
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
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: false }]) })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.allowMerge).toBe(false)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('cancel marks this and every remaining conflict cancelled', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
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
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
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
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA')
    await answer(c, { action: 'merge' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('')
    expect(c.dialog.value.open).toBe(false)
  })

  it('a failing listing degrades to accepting everything as-is', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useFileConflicts({ listFolder: vi.fn().mockRejectedValue(new Error('offline')) })
    const out = await c.resolveEntries([e('a.txt')], '/DATA')
    expect(out.accepted.map((a) => a.relativePath)).toEqual(['a.txt'])
    expect(c.dialog.value.open).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('a failing inner precheck accepts the merged entries as-is without a second dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useFileConflicts({
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
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
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
    const c = useFileConflicts({
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
    const c = useFileConflicts({
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
    const c = useFileConflicts({
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

  // Finding C. A refill re-uploads the missing files of an interrupted batch into
  // that batch's OWN target_path, so the folder it is refilling is on disk by
  // construction and always "collides" with itself.
  it('assumeMergeForFolders resolves a folder collision as merge without opening the dialog', async () => {
    const precheck = vi.fn().mockResolvedValue({ results: [{ relativePath: 'Trip/1.jpg', exists: false }] })
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const out = await c.resolveEntries([e('Trip/1.jpg')], '/DATA/x', { assumeMergeForFolders: true })
    expect(c.dialog.value.open).toBe(false)
    expect(precheck).toHaveBeenCalledTimes(1)
    // Merged into the folder it is refilling — NOT keep-both into 'Trip(1)/1.jpg'.
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: '' }])
  })

  it('assumeMergeForFolders still runs the inner round for genuinely colliding files', async () => {
    const precheck = vi.fn().mockResolvedValue({ results: [{ relativePath: 'Trip/1.jpg', exists: true, is_dir: false }] })
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]), precheck })
    const p = c.resolveEntries([e('Trip/1.jpg')], '/DATA/x', { assumeMergeForFolders: true })
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.accepted).toEqual([{ file: expect.any(File), relativePath: 'Trip/1.jpg', conflictPolicy: 'overwrite' }])
  })

  it('assumeMergeForFolders leaves plain file-vs-file conflicts prompting', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveEntries([e('a.txt')], '/DATA/x', { assumeMergeForFolders: true })
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.accepted[0].conflictPolicy).toBe('overwrite')
  })

  // Finding E. The dialog is owned by whichever component instantiated this
  // composable, but the batch it gates outlives the view: navigating away mid
  // prompt used to strand `ask()`'s promise forever, so the caller never got to
  // enqueue anything and never reported anything either.
  it('tearing down the owning scope settles an open prompt as cancelled instead of hanging', async () => {
    const scope = effectScope()
    let c!: ReturnType<typeof useFileConflicts>
    scope.run(() => { c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) }) })
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
    const c = useFileConflicts({ listFolder: listing([]) })
    expect(c.dialog.value.open).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('exposes the queue position to the dialog for a multi-conflict queue', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
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

describe('resolvePaste', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('splits by the answers the user gives to each collision', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const items = [
      { from: '/DATA/src/a.txt', is_dir: false },
      { from: '/DATA/src/b.txt', is_dir: false },
    ]
    const p = c.resolvePaste(items, '/DATA/dst')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')
    c.onChoose({ action: 'overwrite' } as never)
    const out = await p
    expect(out.overwriteItems.map((i) => i.from)).toEqual(['/DATA/src/a.txt'])
    expect(out.renameItems.map((i) => i.from)).toEqual(['/DATA/src/b.txt'])
  })

  it('never opens the dialog when nothing collides', async () => {
    const c = useFileConflicts({ listFolder: listing([]) })
    const items = [{ from: '/DATA/src/a.txt', is_dir: false }]
    const out = await c.resolvePaste(items, '/DATA/dst')
    expect(c.dialog.value.open).toBe(false)
    expect(out.renameItems).toEqual(items)
  })

  it('never offers Merge for a paste collision', async () => {
    // The backend's move/copy style switch has no merge case; offering it
    // would render a button that does nothing.
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]) })
    const p = c.resolvePaste([{ from: '/DATA/src/Trip', is_dir: true }], '/DATA/dst')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.allowMerge).toBe(false)
    expect(c.dialog.value.isDir).toBe(true)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('runs on the same serial chain as upload batches', async () => {
    // Two flows must never have a dialog open at once.
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const first = c.resolvePaste([{ from: '/DATA/x/a.txt', is_dir: false }], '/DATA/dst')
    const second = c.resolvePaste([{ from: '/DATA/y/a.txt', is_dir: false }], '/DATA/dst')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.targetPath).toBe('/DATA/dst')
    expect(c.dialog.value.name).toBe('a.txt')
    c.onChoose({ action: 'skip' } as never)
    // The second batch only gets the dialog after the first one is answered.
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    c.onChoose({ action: 'skip' } as never)
    await Promise.all([first, second])
  })

  // The test above only proves two PASTES never overlap. The
  // actual invariant this composable exists to guarantee is that an upload
  // batch (resolveEntries) and a paste (resolvePaste) never have a dialog
  // open at the same time either -- they are two different call sites sharing
  // one `chain`. A reviewer swapping resolvePaste onto its own private chain
  // left every existing test (including the one above) green, because none of
  // them ever start an upload and a paste concurrently.
  it('an upload batch already asking blocks a paste from opening its own dialog', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const uploadP = c.resolveEntries([e('a.txt')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')

    const pasteP = c.resolvePaste([{ from: '/DATA/src/b.txt', is_dir: false }], '/DATA')
    // Give the paste every chance it would need to (wrongly) open its own
    // dialog before the upload's conflict has been answered.
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt') // still the upload's conflict

    c.onChoose({ action: 'overwrite' } as never)
    await uploadP
    for (let i = 0; i < 50 && c.dialog.value.name !== 'b.txt'; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('b.txt') // paste only gets its turn now
    c.onChoose({ action: 'skip' } as never)
    await pasteP
  })

  it('a paste already asking blocks an upload batch from opening its own dialog', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const pasteP = c.resolvePaste([{ from: '/DATA/src/a.txt', is_dir: false }], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt')

    const uploadP = c.resolveEntries([e('b.txt')], '/DATA')
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('a.txt') // still the paste's conflict

    c.onChoose({ action: 'skip' } as never)
    await pasteP
    for (let i = 0; i < 50 && c.dialog.value.name !== 'b.txt'; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('b.txt') // upload only gets its turn now
    c.onChoose({ action: 'overwrite' } as never)
    await uploadP
  })

  // resolvePaste had no degradation symmetric to
  // run()'s "a failing listing degrades to accepting everything as-is" --  a
  // network blip on the target-directory listing must not throw the whole
  // paste away.
  it('a failing listing degrades to submitting everything as rename, without opening the dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useFileConflicts({ listFolder: vi.fn().mockRejectedValue(new Error('offline')) })
    const items = [{ from: '/DATA/src/a.txt', is_dir: false }]
    const out = await c.resolvePaste(items, '/DATA/dst')
    expect(c.dialog.value.open).toBe(false)
    expect(out.overwriteItems).toEqual([])
    expect(out.renameItems).toEqual(items)
    expect(out.skippedCount).toBe(0)
    expect(out.cancelledCount).toBe(0)
    expect(warn).toHaveBeenCalled()
  })
})

// Restore's own counterpart to resolvePaste above -- same shared dialog/resolver/chain,
// same "conflict candidates carry only {name, isDir, groupKey}, match back to the original item by
// .name" contract computeRestoreConflicts already established (restoreDestination.test.ts
// covers that function itself; this only exercises the wiring resolveRestore adds on top of it).
describe('resolveRestore', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  const ri = (name: string, is_dir = false) => ({ path: `/DATA/.snapshots/snap1/${name}`, name, is_dir })

  it('withMarker on skips the precheck entirely -- no listing call, no dialog, everything unconflicted', async () => {
    const listFolder = vi.fn()
    const c = useFileConflicts({ listFolder })
    const out = await c.resolveRestore([ri('a.txt')], '/DATA', true)
    expect(listFolder).not.toHaveBeenCalled()
    expect(c.dialog.value.open).toBe(false)
    expect(out).toEqual({ entries: [{ item: ri('a.txt'), onConflict: undefined }], skippedCount: 0 })
  })

  it('withMarker off, no collision → everything unconflicted, dialog never opens', async () => {
    const c = useFileConflicts({ listFolder: listing([]) })
    const out = await c.resolveRestore([ri('a.txt')], '/DATA', false)
    expect(c.dialog.value.open).toBe(false)
    expect(out).toEqual({ entries: [{ item: ri('a.txt'), onConflict: undefined }], skippedCount: 0 })
  })

  it('a collision opens the shared dialog; Overwrite maps to onConflict overwrite', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt')], '/DATA', false)
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out).toEqual({ entries: [{ item: ri('a.txt'), onConflict: 'overwrite' }], skippedCount: 0 })
  })

  it('Keep both maps to onConflict keep_both', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt')], '/DATA', false)
    await answer(c, { action: 'keep_both' })
    const out = await p
    expect(out).toEqual({ entries: [{ item: ri('a.txt'), onConflict: 'keep_both' }], skippedCount: 0 })
  })

  it('Skip drops the item entirely (no entry, counted as skipped) — never sends a request for it', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt')], '/DATA', false)
    await answer(c, { action: 'skip' })
    const out = await p
    expect(out).toEqual({ entries: [], skippedCount: 1 })
  })

  it('Cancel (Esc/close) counts every remaining conflict as skipped too', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt'), ri('b.txt')], '/DATA', false)
    await answer(c, null)
    const out = await p
    expect(out).toEqual({ entries: [], skippedCount: 2 })
  })

  it('applyToAll on the first conflict answers every remaining one without reopening the dialog', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt'), ri('b.txt')], '/DATA', false)
    await answer(c, { action: 'overwrite', applyToAll: true })
    const out = await p
    expect(out.skippedCount).toBe(0)
    expect(out.entries).toEqual([
      { item: ri('a.txt'), onConflict: 'overwrite' },
      { item: ri('b.txt'), onConflict: 'overwrite' },
    ])
  })

  it('conflicting and non-conflicting items in the same batch: only the conflicting one is asked about', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }]) })
    const p = c.resolveRestore([ri('a.txt'), ri('clean.txt')], '/DATA', false)
    await answer(c, { action: 'overwrite' })
    const out = await p
    expect(out.entries).toEqual(expect.arrayContaining([
      { item: ri('a.txt'), onConflict: 'overwrite' },
      { item: ri('clean.txt'), onConflict: undefined },
    ]))
    expect(out.entries).toHaveLength(2)
  })

  it('never offers Merge for a restore collision (restore has no folder-merge backend switch)', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'Trip', is_dir: true }]) })
    const p = c.resolveRestore([ri('Trip', true)], '/DATA', false)
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.allowMerge).toBe(false)
    c.onChoose({ action: 'skip' } as never)
    await p
  })

  it('a failing destDir listing degrades to submitting everything unconflicted, without opening the dialog', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = useFileConflicts({ listFolder: vi.fn().mockRejectedValue(new Error('offline')) })
    const out = await c.resolveRestore([ri('a.txt')], '/DATA', false)
    expect(c.dialog.value.open).toBe(false)
    expect(out).toEqual({ entries: [{ item: ri('a.txt'), onConflict: undefined }], skippedCount: 0 })
    expect(warn).toHaveBeenCalled()
  })

  it('runs on the same serial chain as upload/paste — never opens its dialog while one of those is already asking', async () => {
    const c = useFileConflicts({ listFolder: listing([{ name: 'a.txt', is_dir: false }, { name: 'b.txt', is_dir: false }]) })
    const uploadP = c.resolveEntries([e('a.txt')], '/DATA')
    for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()
    expect(c.dialog.value.name).toBe('a.txt')

    const restoreP = c.resolveRestore([ri('b.txt')], '/DATA', false)
    for (let i = 0; i < 50; i++) await Promise.resolve()
    expect(c.dialog.value.name).toBe('a.txt') // still the upload's conflict

    c.onChoose({ action: 'overwrite' } as never)
    await uploadP
    for (let i = 0; i < 50 && c.dialog.value.name !== 'b.txt'; i++) await Promise.resolve()
    expect(c.dialog.value.open).toBe(true)
    expect(c.dialog.value.name).toBe('b.txt') // restore only gets its turn now
    c.onChoose({ action: 'skip' } as never)
    await restoreP
  })
})
