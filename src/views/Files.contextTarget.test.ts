import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
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

    // The menu shown for a must render as single-item shape — otherwise the UI lies:
    // showing multi-select shape while only acting on a
    expect((w.vm as any).ctxTargetCount).toBe(1)
  })
})
