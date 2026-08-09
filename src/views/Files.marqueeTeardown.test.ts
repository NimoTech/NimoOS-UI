// Unmounting mid-marquee used to leave three listeners behind. The nastiest is
// `selectstart` on document: preventSelectStart cancels it unconditionally, so
// text selection stayed dead page-wide until a reload.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFoldersStore } from '../home/stores/folders'

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

function dispatchSelectStart(): boolean {
  const ev = new Event('selectstart', { cancelable: true, bubbles: true })
  document.dispatchEvent(ev)
  return ev.defaultPrevented
}

async function mountFiles() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
  const router = makeRouter()
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const wrapper = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('Files marquee teardown', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('stops suppressing text selection after the view unmounts mid-drag', async () => {
    const wrapper = await mountFiles()

    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    // Crossing DRAG_THRESHOLD is what attaches the selectstart listener.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))
    expect(dispatchSelectStart()).toBe(true) // mid-drag: suppression is expected behavior

    wrapper.unmount()

    expect(dispatchSelectStart()).toBe(false) // after unmount: selection must be allowed again
  })

  it('stops tracking pointer movement after the view unmounts mid-drag', async () => {
    const wrapper = await mountFiles()
    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }))

    wrapper.unmount()
    // Moving the pointer after unmount must not throw (onMarqueeMove would otherwise
    // touch a store that has been torn down).
    expect(() => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))).not.toThrow()
  })
})
