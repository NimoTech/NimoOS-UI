import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useUploadsStore } from '../files/stores/uploads'
import { useToast } from '../stores/toast'
import { service } from '@nimotech/nimoos-service'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      // SP12 Plan B: every commitSelectedFiles call now lists the target
      // directory first to detect same-name conflicts (useFileConflicts),
      // so the fixture name must NOT collide with any file this suite
      // uploads — 'existing.txt' rather than 'a.txt', which several tests
      // below upload themselves and would otherwise spuriously collide with.
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: (path === '/DATA' ? '/DATA' : path) + '/Documents', is_dir: true },
          { name: 'existing.txt', path: '/DATA/existing.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
    // Needed to drive browse.isSnapshotView true for the stale-refill-flag regression test.
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
    // Consumed by UploadBatchModal, opened via the torn badge's open-batch forwarding
    // chain (FileTile/FileRow -> FileGridView/FileListView -> Files.vue).
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

// UploadBatchModal's Dialog (reka-ui) teleports its content to <body>, outside the
// mounted wrapper's own DOM subtree — see UploadBatchModal.test.ts. Query document.body
// directly for anything inside it.
const body = () => new DOMWrapper(document.body)

describe('Files.vue upload wiring', () => {
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

  it('enqueues a selected file against the real current path', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const files = useFilesStore()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    await (w.vm as any).handleSelectedFiles([fakeFile])
    await flushPromises()

    expect(spy).toHaveBeenCalledWith([
      { file: fakeFile, targetPath: files.currentPath, relativePath: 'a.txt', conflictPolicy: '' },
    ])
  })

  it('toasts a protected rejection instead of enqueuing it', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const uploads = useUploadsStore()
    vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: ['AppData/x'] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const fakeFile = { name: 'x', webkitRelativePath: 'AppData/x' } as unknown as File
    await (w.vm as any).handleSelectedFiles([fakeFile])
    await flushPromises()

    expect(showSpy).toHaveBeenCalledWith('「AppData/x」位于受保护目录,已跳过。')
  })

  // bug.txt #2: at maximum folder depth the backend's tus ingest fails silently on
  // ENAMETOOLONG after the client already reported success. commitSelectedFiles now
  // filters over-long entries out before they ever reach the upload queue.
  it('drops an entry whose relativePath segment exceeds NAME_MAX and toasts filesUploadPathTooLong, but still enqueues the normal one', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const files = useFilesStore()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const tooLong = { name: 'x'.repeat(256), webkitRelativePath: '' } as unknown as File
    const ok = { name: 'ok.txt', webkitRelativePath: '' } as unknown as File
    await (w.vm as any).handleSelectedFiles([tooLong, ok])
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([
      { file: ok, targetPath: files.currentPath, relativePath: 'ok.txt', conflictPolicy: '' },
    ])
    expect(showSpy).toHaveBeenCalledWith(zh.filesUploadPathTooLong.replace('{count}', '1'))
  })

  it('does not toast filesUploadPathTooLong when every entry is within limits', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const a = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const b = { name: 'b.txt', webkitRelativePath: '' } as unknown as File
    await (w.vm as any).handleSelectedFiles([a, b])
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toHaveLength(2)
    expect(showSpy).not.toHaveBeenCalledWith(expect.stringContaining(zh.filesUploadPathTooLong.split('{count}')[1]))
  })

  it('refill: only re-enqueues entries named in the missing list, against the batch target_path', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/Elsewhere'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const files = useFilesStore()
    // The batch's target_path must differ from wherever the user currently is,
    // so a regression that falls back to files.currentPath fails loudly.
    expect(files.currentPath).not.toBe('/DATA/x')

    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    ;(w.vm as any).onRefill({ targetPath: '/DATA/x', missing: ['Trip/a.jpg', 'Trip/b.jpg'] })

    const wanted = { name: 'a.jpg', webkitRelativePath: 'Trip/a.jpg' } as unknown as File
    const extra = { name: 'c.jpg', webkitRelativePath: 'Trip/c.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([wanted, extra])
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([
      { file: wanted, targetPath: '/DATA/x', relativePath: 'Trip/a.jpg', conflictPolicy: '' },
    ])
  })

  it('refill: toasts filesBatchRefillNoMatch and does not enqueue when nothing matches', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    ;(w.vm as any).onRefill({ targetPath: '/DATA/x', missing: ['Trip/a.jpg'] })

    const unrelated = { name: 'z.jpg', webkitRelativePath: 'Other/z.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([unrelated])
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.filesBatchRefillNoMatch)
  })

  // Code review finding: cancelling the native folder-picker dialog never fires `change`,
  // so nothing would clear refillPending on its own. The next ordinary upload — through the
  // normal folder chip, drag-drop, or paste — must not be silently filtered against a stale
  // missing list. This drives the real DOM entry point (the toolbar chip's real @click
  // handler), not a re-exposed test hook, so it actually exercises the clearing fix.
  it('refill: clicking the ordinary upload-folder chip clears a stale pending refill filter', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const files = useFilesStore()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    // Simulate: user clicked "re-upload missing files", then cancelled the native
    // folder picker instead of picking anything.
    ;(w.vm as any).onRefill({ targetPath: '/DATA/x', missing: ['Trip/a.jpg'] })

    // The user now starts a completely unrelated, ordinary folder upload via the
    // real toolbar chip — this is the actual triggerFolderSelect() code path, not a
    // stand-in.
    await w.find('.tb-upload-folder').trigger('click')

    const unrelated = { name: 'z.jpg', webkitRelativePath: 'Somewhere/z.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([unrelated])
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([
      { file: unrelated, targetPath: files.currentPath, relativePath: 'Somewhere/z.jpg', conflictPolicy: '' },
    ])
  })

  // Code review finding: the browse.isSnapshotView early return sits before the pending
  // read, so an early return while a refill is pending used to leave the flag set for
  // whatever unrelated upload happens next, once the user leaves the read-only view.
  it('refill: a stale flag does not survive an early return in the snapshot-guard branch', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    // Land inside the read-only snapshot view: browse.isSnapshotView is derived from the
    // route, so this forces commitSelectedFiles's snapshot-guard branch to return early
    // while a refill is pending.
    router.push('/files/NimoOS-HD/.snapshots/20260713T061900Z_manual/Trip'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()

    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    ;(w.vm as any).onRefill({ targetPath: '/DATA/x', missing: ['Trip/a.jpg'] })

    // The folder dialog "completes" while still inside the read-only view: the
    // snapshot guard fires and returns early, before ever reaching the pending branch.
    const wanted = { name: 'a.jpg', webkitRelativePath: 'Trip/a.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([wanted])
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()

    // Now leave the read-only view and do a completely unrelated ordinary upload.
    router.push('/files/NimoOS-HD/Elsewhere')
    await router.isReady()
    await flushPromises()

    const files = useFilesStore()
    const unrelated = { name: 'z.jpg', webkitRelativePath: 'z.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([unrelated])
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith([
      { file: unrelated, targetPath: files.currentPath, relativePath: 'z.jpg', conflictPolicy: '' },
    ])
  })

  // Merge-gate finding: FileGridView.vue and FileListView.vue each hand-declare and
  // forward `open-batch` from their leaf component (FileTile/FileRow) up to Files.vue.
  // vue-tsc catches a wrong payload type but NOT a missing `@open-batch` forward line —
  // deleting it is a silent, total feature failure with an otherwise-green suite,
  // because the leaf components and UploadBatchModal are each tested in isolation and
  // never together. These two tests exercise the whole chain for real, one per view
  // mode (grid and list are two independent forwarding chains).
  it('grid view: clicking the torn badge opens the batch dialog (open-batch forwarding)', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    vi.mocked(service.folder.getList).mockResolvedValueOnce({
      content: [
        { name: 'Trip', path: '/DATA/Trip', is_dir: true, extensions: { upload: { broken: true, batchId: 'b1' } } },
      ],
    } as any)
    vi.mocked(service.uploadBatches.getBatch).mockResolvedValue({
      batch: { id: 'b1', target_path: '/DATA/Trip', status: 'interrupted', total: 3, done: 1 },
      missing: [{ batch_id: 'b1', relative_path: 'Trip/a.jpg', size: 1024, done: false }],
    } as any)

    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()

    const files = useFilesStore()
    files.setView('grid')
    await nextTick()

    expect(w.find('.upload-broken-badge').exists()).toBe(true)
    await w.find('.upload-broken-badge').trigger('click')
    await flushPromises()

    expect(service.uploadBatches.getBatch).toHaveBeenCalledWith('b1')
    expect(body().find('.ubm-missing-title').exists()).toBe(true)
    expect(body().text()).toContain('Trip/a.jpg')
  })

  it('list view: clicking the torn badge opens the batch dialog (open-batch forwarding)', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    vi.mocked(service.folder.getList).mockResolvedValueOnce({
      content: [
        { name: 'Trip', path: '/DATA/Trip', is_dir: true, extensions: { upload: { broken: true, batchId: 'b1' } } },
      ],
    } as any)
    vi.mocked(service.uploadBatches.getBatch).mockResolvedValue({
      batch: { id: 'b1', target_path: '/DATA/Trip', status: 'interrupted', total: 3, done: 1 },
      missing: [{ batch_id: 'b1', relative_path: 'Trip/a.jpg', size: 1024, done: false }],
    } as any)

    const router = makeRouter()
    router.push('/files'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
    await flushPromises()

    const files = useFilesStore()
    files.setView('list')
    await nextTick()

    expect(w.find('.upload-broken-badge').exists()).toBe(true)
    await w.find('.upload-broken-badge').trigger('click')
    await flushPromises()

    expect(service.uploadBatches.getBatch).toHaveBeenCalledWith('b1')
    expect(body().find('.ubm-missing-title').exists()).toBe(true)
    expect(body().text()).toContain('Trip/a.jpg')
  })
})
