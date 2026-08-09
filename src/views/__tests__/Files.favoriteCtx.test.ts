import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import Files from '../Files.vue'
import FilesSidebar from '../../files/components/FilesSidebar.vue'
import { useFilesStore } from '../../files/stores/files'
import { useFoldersStore } from '../../home/stores/folders'
import { useClipboardStore } from '../../files/stores/clipboard'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
          { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
          { name: 'Work', path: '/DATA/Work', is_dir: true },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: { listVolumes: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]) },
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
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

const WORK = { name: 'Work', path: '/DATA/Work', is_dir: true }

describe('Files.vue favourite context actions (F3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  // The listing's selection and the sidebar are two different things. Routing
  // the sidebar through the shared dispatcher without forcing the target would
  // make a right-click on a favourite delete whatever happened to be selected
  // in the listing -- the F11 failure mode, one level over.
  it('deletes the right-clicked favourite, not the listing selection', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    // The favourite is IN the selection on purpose: that is the only arrangement
    // where the shared dispatcher's default target set (the whole selection)
    // differs from the sidebar's (just this favourite). With the favourite
    // outside the selection both paths return the same single entry and the
    // assertion would pass no matter which one ran.
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt', '/DATA/Work'])

    w.findComponent(FilesSidebar).vm.$emit('ctx-action', 'delete', WORK)
    await flushPromises()

    expect((w.vm as any).deleteDlg.entries.map((e: any) => e.path)).toEqual(['/DATA/Work'])
  })

  it('copies the right-clicked favourite, not the listing selection', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    // The favourite is IN the selection on purpose: that is the only arrangement
    // where the shared dispatcher's default target set (the whole selection)
    // differs from the sidebar's (just this favourite). With the favourite
    // outside the selection both paths return the same single entry and the
    // assertion would pass no matter which one ran.
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt', '/DATA/Work'])

    w.findComponent(FilesSidebar).vm.$emit('ctx-action', 'copy', WORK)
    await flushPromises()

    expect(useClipboardStore().operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/Work' }] })
  })

  it('opens the rename dialog on the favourite', async () => {
    const w = await mountFiles()
    w.findComponent(FilesSidebar).vm.$emit('ctx-action', 'rename', WORK)
    await flushPromises()

    expect((w.vm as any).renameDlg.open).toBe(true)
    expect((w.vm as any).renameDlg.entry.path).toBe('/DATA/Work')
  })

  it('leaves the listing selection alone when acting on a favourite', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    // The favourite is IN the selection on purpose: that is the only arrangement
    // where the shared dispatcher's default target set (the whole selection)
    // differs from the sidebar's (just this favourite). With the favourite
    // outside the selection both paths return the same single entry and the
    // assertion would pass no matter which one ran.
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt', '/DATA/Work'])

    w.findComponent(FilesSidebar).vm.$emit('ctx-action', 'copy', WORK)
    await flushPromises()

    expect(files.selected).toEqual(new Set(['/DATA/a.txt', '/DATA/b.txt', '/DATA/Work']))
  })
})
