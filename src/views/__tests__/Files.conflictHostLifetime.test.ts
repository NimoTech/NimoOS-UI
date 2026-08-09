import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import Files from '../Files.vue'
import FileConflictHost from '../../files/components/FileConflictHost.vue'
import FileConflictDialog from '../../files/components/FileConflictDialog.vue'
import { useFoldersStore } from '../../home/stores/folders'
import { useUploadsStore } from '../../files/stores/uploads'
import { service } from '@nimotech/nimoos-service'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { getList: vi.fn(async () => ({ content: [{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }] })) },
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

// Mirrors App.vue: the files view and the conflict host are siblings, and only
// the view is torn down when the user navigates away. `showFiles` is the
// navigation: flipping it to false unmounts the view exactly the way the router
// does, while the host stays mounted for the lifetime of the app.
const AppLike = defineComponent({
  data: () => ({ showFiles: true }),
  render() {
    return h('div', [this.showFiles ? h(Files) : null, h(FileConflictHost)])
  },
})

async function mountAppLike() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
  const router = makeRouter()
  router.push('/files')
  await router.isReady()
  const w = mount(AppLike, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

async function waitForDialogOpen(w: ReturnType<typeof mount>) {
  for (let i = 0; i < 50; i++) {
    await nextTick()
    if (w.findComponent(FileConflictDialog).props('open')) return
  }
  throw new Error('conflict dialog never opened')
}

describe('conflict dialog lifetime (SP12 Plan B ticket E)', () => {
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

  // The dialog used to live inside Files.vue, so navigating away tore it down
  // mid-question: the awaiting batch was settled as cancelled (at best) and the
  // ones queued behind it hung forever with nothing on screen to answer them --
  // the user's dropped files simply vanished with no message.
  it('keeps an open prompt alive when the files view is torn down, and still enqueues the answer', async () => {
    const w = await mountAppLike()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })

    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.findComponent(Files).vm as any).handleSelectedFiles([fakeFile])
    await waitForDialogOpen(w)

    // Navigate away while the question is still on screen.
    await w.setData({ showFiles: false })
    await flushPromises()
    expect(w.findComponent(Files).exists()).toBe(false)
    expect(w.findComponent(FileConflictDialog).props('open')).toBe(true)

    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'overwrite', applyToAll: false })
    await p
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0][0].conflictPolicy).toBe('overwrite')
  })

  // The half that onScopeDispose could never reach: a second batch that is still
  // waiting its turn in the serial chain when the view goes away. It had not
  // registered a resolver yet, so the dispose hook had nothing to settle and the
  // batch hung forever the moment its turn came up with no dialog on screen.
  it('still prompts for a batch that was queued behind another when the view went away', async () => {
    const w = await mountAppLike()
    const uploads = useUploadsStore()
    const spy = vi.spyOn(uploads, 'addFilesToQueue').mockResolvedValue({ rejected: [] })
    const filesVm = w.findComponent(Files).vm as any

    const first = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const second = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p1 = filesVm.handleSelectedFiles([first])
    const p2 = filesVm.handleSelectedFiles([second])
    await waitForDialogOpen(w)

    await w.setData({ showFiles: false })
    await flushPromises()

    // Answer the first; the second batch's prompt has to appear afterwards.
    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'overwrite', applyToAll: false })
    await p1
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('choose', { action: 'skip', applyToAll: false })
    await p2
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1) // the skipped one enqueues nothing
    expect(spy.mock.calls[0][0][0].file).toBe(first)
  })

  it('uses the same shared instance in the view and the host, not two copies', async () => {
    const w = await mountAppLike()
    const fakeFile = { name: 'a.txt', webkitRelativePath: '' } as unknown as File
    const p = (w.findComponent(Files).vm as any).handleSelectedFiles([fakeFile])
    // A second instance would leave the host's dialog closed forever while the
    // view waited on its own private one — nothing on screen, batch hung.
    await waitForDialogOpen(w)
    await w.findComponent(FileConflictDialog).vm.$emit('cancel')
    await p
    await flushPromises()
    expect(vi.mocked(service.folder.getList)).toHaveBeenCalled()
  })
})
