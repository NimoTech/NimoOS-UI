import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import Files from '../Files.vue'
import FileConflictDialog from '../../files/components/FileConflictDialog.vue'
import { useFoldersStore } from '../../home/stores/folders'
import { useUploadsStore } from '../../files/stores/uploads'
import { useToast } from '../../stores/toast'
import { service } from '@nimotech/nimoos-service'

// Same mock shape as ../Files.upload.test.ts, minus the "always contains
// a.txt/Documents" default listing that file relies on — this suite drives
// service.folder.getList per-test instead, because whether a name collides
// with the target directory is exactly what is under test here.
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { getList: vi.fn(async () => ({ content: [] })) },
    file: { uploadPrecheck: vi.fn(async () => ({ results: [] })) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
    snapshot: { listVolumes: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]) },
    uploadBatches: { getBatch: vi.fn(), interruptBatch: vi.fn(), abandonBatch: vi.fn() },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

async function mountFiles() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
  const router = makeRouter()
  router.push('/files')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

// The conflict dialog is a real, un-stubbed child — resolveEntries crosses
// several microtask hops (the mocked getList's own await, then the pure
// conflict-detection functions, then ask() flipping dialog.value.open)
// before Vue schedules the re-render that updates this child's props.
async function waitForDialogOpen(w: ReturnType<typeof mount>) {
  for (let i = 0; i < 50; i++) {
    await nextTick()
    if (w.findComponent(FileConflictDialog).props('open')) return
  }
  throw new Error('conflict dialog never opened')
}

// Mirrors waitForDialogOpen for the other direction: after emitting choose/cancel
// on the real child, poll for `open` to flip back to false. A broken @choose/@cancel
// forward means conflicts.onChoose/onCancel is never called, so the resolver inside
// useUploadConflicts.ts never settles and `open` stays true forever — polling with a
// bounded loop turns that into a fast, NAMED failure here rather than the caller's
// `await p` silently hanging until vitest's default 5000ms test timeout (which reads
// as CI flake, not as "this exact binding is missing").
async function waitForDialogClose(w: ReturnType<typeof mount>) {
  for (let i = 0; i < 50; i++) {
    await nextTick()
    if (!w.findComponent(FileConflictDialog).props('open')) return
  }
  throw new Error('conflict dialog never closed after choose/cancel — the @choose/@cancel forwarding is broken')
}

describe('Files.vue upload-conflict wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  afterEach(() => { document.body.innerHTML = '' })

  it('a colliding upload opens the conflict dialog and enqueues with the chosen policy', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    expect(w.findComponent(FileConflictDialog).props('name')).toBe('a.txt')

    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'overwrite', applyToAll: false })
    await waitForDialogClose(w)
    await p
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const enqueued = spy.mock.calls[0][0]
    expect(enqueued).toHaveLength(1)
    expect(enqueued[0].file).toBe(fakeFile)
    expect(enqueued[0].conflictPolicy).toBe('overwrite')
  })

  it('skipping every conflicting entry enqueues nothing and toasts the skipped count', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'skip', applyToAll: false })
    await waitForDialogClose(w)
    await p
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.filesUploadSkipped.replace('{count}', '1'))
  })

  it('cancelling the dialog cancels the batch', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('cancel')
    await waitForDialogClose(w)
    await p
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.filesUploadSkipped.replace('{count}', '1'))
  })

  // The batch's own target_path ('/DATA/Elsewhere') is distinct from the current
  // directory ('/DATA'), so this also proves resolution ran against the RIGHT path.
  //
  // The listing deliberately CONTAINS the 'Trip' folder being refilled: that is the
  // real-world shape, because the interrupted batch itself created that folder before
  // it stopped. Prompting there would ask the user about a collision they cannot
  // meaningfully answer, and a reasonable "Keep both" would scatter the remaining
  // files into 'Trip(1)/' while the already-uploaded ones stay in 'Trip/'. The refill
  // branch therefore resolves folder groups as an implicit merge — no dialog, and the
  // entries land back in the original folder.
  it('a refill merges into the folder it is refilling instead of prompting', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async (path: string) => {
      if (path === '/DATA/Elsewhere') return { content: [{ name: 'Trip', path: '/DATA/Elsewhere/Trip', is_dir: true }] }
      return { content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }
    })
    // The merge branch always runs a per-path precheck; none of the missing files
    // exist yet (that is why they are missing), so nothing collides in round 2 either.
    vi.mocked(service.file.uploadPrecheck).mockResolvedValue({ results: [{ relativePath: 'Trip/a.jpg', exists: false }] } as never)
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    ;(w.vm as any).onRefill({ targetPath: '/DATA/Elsewhere', missing: ['Trip/a.jpg'] })
    const wanted = { name: 'a.jpg', webkitRelativePath: 'Trip/a.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([wanted])
    await flushPromises()

    expect(service.folder.getList).toHaveBeenCalledWith('/DATA/Elsewhere')
    expect(w.findComponent(FileConflictDialog).props('open')).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([
      { file: wanted, targetPath: '/DATA/Elsewhere', relativePath: 'Trip/a.jpg', conflictPolicy: '' },
    ])
  })

  // End-to-end forwarding proof: the dialog wiring (:open/:name/.../@choose/@cancel)
  // is a hand-written chain that neither vue-tsc nor the build can check — a missing
  // @choose line would silently strand every conflict decision forever. This test
  // drives the real, un-stubbed FileConflictDialog child and asserts the choice it
  // emits genuinely reaches addFilesToQueue as the item's conflictPolicy.
  //
  // Forced-RED self-proof (see task-9-report.md for the exact commands/output):
  // deleting `@choose="conflicts.onChoose"` from Files.vue's template makes
  // waitForDialogClose below throw its own named error (the dialog never closes,
  // because conflicts.onChoose is never called to settle it) — fast and clearly
  // attributable to this exact binding, not a vague default-timeout failure.
  // Restoring the line makes it pass again.
  it('forwards the dialog choose event — deleting the @choose handler must fail this test', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'keep_both', applyToAll: false })
    await waitForDialogClose(w)
    await p
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0][0].conflictPolicy).toBe('rename')
  })

  // Defect fix: handleSelectedFiles feeds raw webkitRelativePath values straight into
  // commitSelectedFiles, and a leading slash must be stripped BEFORE conflict grouping
  // (groupByTopSegment keys off the first '/'-delimited segment) — not only afterwards,
  // in toSelectedFiles' own targetPath-attaching pass. Normalizing too late would group
  // '/Docs/a.txt' under an empty top segment that matches nothing in the target listing,
  // silently missing a real collision with the existing 'Docs' folder.
  it('detects a conflict even when relativePath carries a leading slash', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'Docs', path: '/DATA/Docs', is_dir: true }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '/Docs/a.txt' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    expect(w.findComponent(FileConflictDialog).props('name')).toBe('Docs')
    expect(w.findComponent(FileConflictDialog).props('isDir')).toBe(true)

    await w.findComponent(FileConflictDialog).vm.$emit('cancel')
    await waitForDialogClose(w)
    await p
    await flushPromises()
  })

  // Coverage gap found in review: :open, :name and @choose/@cancel were each proven
  // to fail loudly if deleted, but :allow-merge and :queue-total have defaults in
  // FileConflictDialog's withDefaults (allowMerge: false, queueTotal: 1) — deleting
  // either binding produces neither a type error nor (previously) a test failure,
  // because every other test here only ever has ONE conflict in its queue. This test
  // forces a queue of TWO folder-kind conflicts so both defaults would visibly differ
  // from the real values: 'Trip' (a nested upload landing on an existing folder — a
  // genuine mergeable folder-into-folder collision) queues ahead of 'Vacation' (a flat
  // FILE upload landing on an existing folder — a type mismatch, not mergeable).
  // splitConflictsByKind puts both in the SAME folder queue (existingIsDir is true for
  // either), so 'Trip' opens first with allowMerge:true and queueTotal:2 — exactly the
  // snapshot where a missing :allow-merge or :queue-total binding would go unnoticed
  // by every other test in this file.
  //
  // Forced-RED self-proof (see task-9-report.md): deleting `:allow-merge` makes the
  // allowMerge assertion below fail (prop falls back to its `false` default instead of
  // the real `true`); deleting `:queue-total` makes the queueTotal assertion fail the
  // same way (falls back to `1` instead of `2`). Both restored afterwards.
  it('opens the folder prompt with the real allowMerge and queue position, not the dialog defaults', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({
      content: [
        { name: 'Trip', path: '/DATA/Trip', is_dir: true },
        { name: 'Vacation', path: '/DATA/Vacation', is_dir: true },
      ],
    }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const nested = { name: 'snap.jpg', webkitRelativePath: 'Trip/snap.jpg' } as unknown as File
    const flat = { name: 'Vacation', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([nested, flat])
    await waitForDialogOpen(w)

    const dlg = w.findComponent(FileConflictDialog)
    expect(dlg.props('name')).toBe('Trip')
    expect(dlg.props('allowMerge')).toBe(true)
    expect(dlg.props('queueTotal')).toBe(2)
    expect(dlg.props('queueIndex')).toBe(0)

    await dlg.vm.$emit('cancel')
    await waitForDialogClose(w)
    await p
    await flushPromises()
  })
})
