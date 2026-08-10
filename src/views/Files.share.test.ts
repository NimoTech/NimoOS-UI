import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useToast } from '../stores/toast'

const { createShare } = vi.hoisted(() => ({ createShare: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'plain', path: '/DATA/plain', is_dir: true, extensions: null },
          { name: 'shared', path: '/DATA/shared', is_dir: true, extensions: { share: { shared: 'true' } } },
          { name: 'plain2', path: '/DATA/plain2', is_dir: true, extensions: null },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: {
      listConnections: vi.fn().mockResolvedValue([]),
      listShares: vi.fn().mockResolvedValue([]),
      createShare,
    },
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

describe('Files.vue batch share gating (F12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createShare.mockClear()
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Selection with already-shared mixed in → only share the unshareable, do not send already-shared to backend', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).toHaveBeenCalledTimes(1)
    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
  })

  it('Selection with already-shared mixed in → toast says how many were skipped', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    // Toasts stack (the `toasts` array in stores/toast.ts:31), so the success and skipped notices
    // are on screen at the same time — assert the whole stack contains this one, not just "the last one".
    expect(useToast().toasts.map((x) => x.text)).toContain('已跳过 1 个已共享项')
  })

  it('Selection with all already-shared → send no request, explain why directly', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).not.toHaveBeenCalled()
    expect(useToast().toasts.map((x) => x.text)).toEqual(['所选文件夹都已共享'])
  })

  it('Selection with no already-shared → behavior same as before, no skipped notice', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
    expect(useToast().toasts.map((x) => x.text).join('|')).not.toContain('已跳过')
  })
})
