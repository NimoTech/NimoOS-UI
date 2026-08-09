import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import Files from '../Files.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { useFilesStore } from '../../files/stores/files'
import { useFoldersStore } from '../../home/stores/folders'
import { useToast } from '../../stores/toast'

// The listing deliberately mixes one protected system folder in with two
// ordinary files — that is the exact selection pending-ledger F10 describes.
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
          { name: 'Documents', path: '/DATA/Documents', is_dir: true },
          { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
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

// The confirmation is the LAST place a user can still back out, so it is the
// place the warning has to appear. Asserting on the rendered dialog's message
// prop rather than on a computed keeps this honest: a helper that returns the
// right numbers but is never bound to the dialog would not pass.
function deleteMessage(w: ReturnType<typeof mount>): string {
  const dlg = w.findAllComponents(AlertDialog).find((d) => d.props('title') === zh.filesCtxDelete)
  if (!dlg) throw new Error('delete confirmation dialog not found')
  return dlg.props('message') as string
}

describe('Files.vue delete gating (F10)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('warns about the protected members before the user confirms, and counts only what will go', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/a.txt', '/DATA/Documents', '/DATA/b.txt'])

    ;(w.vm as any).onToolbarDelete()
    await flushPromises()

    // The old message said "delete the selected 3 items" and mentioned nothing
    // about the protected one; the user confirmed a 3-item delete and got a
    // toast about protection afterwards, with 0 items actually deleted.
    expect(deleteMessage(w)).toBe(
      zh.filesDeleteConfirmWithProtected.replace('{count}', '2').replace('{skipped}', '1'),
    )
  })

  it('keeps the plain message when nothing in the selection is protected', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/a.txt', '/DATA/b.txt'])

    ;(w.vm as any).onToolbarDelete()
    await flushPromises()

    expect(deleteMessage(w)).toBe(zh.filesDeleteConfirm.replace('{count}', '2'))
  })

  it('does not open the confirmation at all when nothing can be deleted', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/Documents'])
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    ;(w.vm as any).onToolbarDelete()
    await flushPromises()

    expect((w.vm as any).deleteDlg.open).toBe(false)
    expect(showSpy).toHaveBeenCalledWith(zh.filesProtectedDelete)
  })

  it('hands the store only the deletable entries', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/a.txt', '/DATA/Documents', '/DATA/b.txt'])

    ;(w.vm as any).onToolbarDelete()
    await flushPromises()

    expect((w.vm as any).deleteDlg.entries.map((e: any) => e.path)).toEqual(['/DATA/a.txt', '/DATA/b.txt'])
  })
})
