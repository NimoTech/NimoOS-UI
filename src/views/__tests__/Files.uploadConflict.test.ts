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
    await p
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith(zh.filesUploadSkipped.replace('{count}', '1'))
  })

  it('a refill also goes through conflict resolution', async () => {
    // The batch's own target_path ('/DATA/Elsewhere') is distinct from the
    // current directory ('/DATA') and deliberately listed empty (no collision),
    // so this test can assert resolution ran against the RIGHT path without
    // also having to drive the dialog to a decision.
    vi.mocked(service.folder.getList).mockImplementation(async (path: string) => {
      if (path === '/DATA/Elsewhere') return { content: [] }
      return { content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }
    })
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    ;(w.vm as any).onRefill({ targetPath: '/DATA/Elsewhere', missing: ['Trip/a.jpg'] })
    const wanted = { name: 'a.jpg', webkitRelativePath: 'Trip/a.jpg' } as unknown as File
    await (w.vm as any).handleSelectedFiles([wanted])
    await flushPromises()

    expect(service.folder.getList).toHaveBeenCalledWith('/DATA/Elsewhere')
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
  // deleting `@choose="conflicts.onChoose"` from Files.vue's template makes `await p`
  // below hang until the test's timeout, failing this test — restoring the line makes
  // it pass again.
  it('forwards the dialog choose event — deleting the @choose handler must fail this test', async () => {
    vi.mocked(service.folder.getList).mockImplementation(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] }))
    const w = await mountFiles()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'keep_both', applyToAll: false })
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
    await p
    await flushPromises()
  })
})
