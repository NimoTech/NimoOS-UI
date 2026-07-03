import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import { messages } from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useUploadsStore } from '../files/stores/uploads'
import { useToast } from '../stores/toast'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: (path === '/DATA' ? '/DATA' : path) + '/Documents', is_dir: true },
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

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
      { file: fakeFile, targetPath: files.currentPath, relativePath: 'a.txt' },
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
})
