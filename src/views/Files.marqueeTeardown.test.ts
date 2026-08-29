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
import { useFilesStore } from '../files/stores/files'

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
    history: createWebHashHistory('/'),
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

  // This test guards one observable property: after unmount, a stray mousemove must
  // not rewrite the store's selection. It goes red if the whole `onUnmounted` hook is
  // removed (armed/dragging never reset, so a leaked listener runs collectSelection()
  // against torn-down grid/list refs and wipes the selection to empty).
  // It does NOT go red if only the `teardownMarquee()` line inside that hook is
  // disabled while the `armed`/`dragging` resets stay in place: with `armed` already
  // false, onMarqueeMove's leading guard makes the still-attached mousemove/mouseup
  // listeners no-ops, so there is no observable effect left to catch -- that scenario
  // is a resource leak (dangling window listeners), not a behavior bug, and the
  // `teardownMarquee()` line already has its own dedicated coverage: the `selectstart`
  // test above goes red on that exact same mutation.
  it('does not let a mousemove after unmount overwrite the selection', async () => {
    const wrapper = await mountFiles()
    const files = useFilesStore()

    const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
    surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
    // Under jsdom every element reports a zero-width getBoundingClientRect, so the
    // grid view's virtualized geometry falls back to a single 120x130 column
    // (see gridVirtual.ts columnsFor(0, ...) === 1). A drag to (100, 100) deterministically
    // overlaps the first tile's rect {0,0,120,130} and produces a real, non-empty selection.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }))
    const selectionWhileDragging = new Set(files.selected)
    expect(selectionWhileDragging.size).toBeGreaterThan(0) // sanity: the drag actually selected something

    wrapper.unmount()

    // On the leaking path this listener is still attached and still "dragging": it
    // re-runs collectSelection() against a view whose grid/list template refs are now
    // null, which measures zero item rects and overwrites the selection to empty.
    // A `.not.toThrow()` assertion cannot see this -- nothing throws, the store is
    // just silently wiped. Asserting on the store's observable selection can.
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))
    expect(new Set(files.selected)).toEqual(selectionWhileDragging)
  })
})
