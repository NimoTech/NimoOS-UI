import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import FileContextMenu from '../files/components/FileContextMenu.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useClipboardStore } from '../files/stores/clipboard'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
          { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
          { name: 'c.txt', path: '/DATA/c.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
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
  folders.loadDisks = vi.fn(async () => {
    folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  })
  const router = makeRouter()
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

describe('Files.vue context-menu target (F11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Copy on unselected a when b,c are selected → clipboard contains only a', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('copy', a)

    const clip = useClipboardStore()
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }] })
  })

  it('Copy on selected b when b,c are selected → clipboard contains b,c', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const b = files.entries.find((e) => e.path === '/DATA/b.txt')!

    ;(w.vm as any).ctxEntry = b
    ;(w.vm as any).onCtxAction('copy', b)

    const clip = useClipboardStore()
    expect(clip.operateObject!.item.map((i) => i.from)).toEqual(['/DATA/b.txt', '/DATA/c.txt'])
  })

  it('Delete branch also acts on clicked entry only (delete was once a second inline implementation)', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('delete', a)

    expect((w.vm as any).deleteDlg.entries.map((e: any) => e.path)).toEqual(['/DATA/a.txt'])
  })

  it('Menu prop reflects the effective target set, not the original selection count', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    await w.vm.$nextTick()

    // Read the prop off the mounted child, not a computed on the parent instance: a
    // computed can be correct while the template still binds the wrong value to
    // FileContextMenu, and that template-only regression is exactly what this
    // test must fail on.
    expect(w.findComponent(FileContextMenu).props('selectedCount')).toBe(1)
  })

  // The tests above set `ctxEntry` directly, which constructs a state the UI can never
  // reach on its own: `onItemContextmenu` (Files.vue) always narrows the selection to the
  // clicked entry *before* it records it, so `ctxEntry` is never observed while the
  // selection still holds other entries. This test goes through the real path instead —
  // a native `contextmenu` DOM event on a rendered row — to document what a user actually
  // gets: right-clicking an unselected entry collapses the selection to it first, so the
  // old "batch acts on the previous selection" bug (pending-ledger F11) was never reachable
  // through the UI. `contextTargets`/`ctxTargets` are still correct defence-in-depth (single
  // source of truth, no duplicated `delete` logic), just not a fix for an observable defect.
  it('Real contextmenu on an unselected row collapses selection to it, and a subsequent copy acts on it alone', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setView('list') // deterministic DOM shape regardless of the localStorage-persisted default
    await w.vm.$nextTick()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])

    const rowA = w.find('[data-path="/DATA/a.txt"]')
    expect(rowA.exists()).toBe(true)
    rowA.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    await w.vm.$nextTick()

    // Selection contract: right-clicking unselected A drops B, C and selects only A.
    expect(files.isSelected('/DATA/a.txt')).toBe(true)
    expect(files.selected.size).toBe(1)

    const ctxEntry = (w.vm as any).ctxEntry
    expect(ctxEntry?.path).toBe('/DATA/a.txt')
    ;(w.vm as any).onCtxAction('copy', ctxEntry)

    const clip = useClipboardStore()
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }] })
  })
})
