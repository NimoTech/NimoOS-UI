import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '', setCustomStorage: async () => undefined,
      uploadImage: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
      setImageFromPath: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
    },
  },
}))

import DesktopContextMenu from './DesktopContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

describe('DesktopContextMenu', () => {
  it('renders its slot content unchanged', () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'canvas-stub' }, 'grid') },
    })
    expect(w.find('.canvas-stub').text()).toBe('grid')
  })

  it('lets a right-click on a tile through to the browser instead of opening the menu', async () => {
    // Vue2 gated this the same way (wallpaper/ContextMenu.vue:50 checked for the
    // contextmenu-canvas class): a right-click on a tile is not a desktop click.
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, [h('div', { class: 'grid-item' }, 'tile')]) },
    })
    const tile = w.find('.grid-item')
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    tile.element.dispatchEvent(ev)
    // reka-ui's ContextMenuTrigger awaits nextTick before it checks
    // defaultPrevented (see ContextMenuTrigger.js:handleContextMenu), so this
    // must flush microtasks before asserting -- otherwise the assertion would
    // pass trivially before reka ever got a chance to act, regardless of
    // whether propagation was actually stopped. Verified empirically: without
    // the flush, a no-op gate (no stopPropagation at all) also makes this pass.
    await flushPromises()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('handles a right-click on blank canvas', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, 'blank') },
    })
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    w.find('.grid').element.dispatchEvent(ev)
    // Same reason as the tile test above: reka-ui's own preventDefault() call
    // happens after an internal `await nextTick()`, not synchronously within
    // dispatchEvent(). Confirmed empirically with a standalone reka-ui probe
    // (ContextMenuRoot/Trigger/Portal/Content) that the menu genuinely opens
    // (data-state goes to "open") once this settles -- so this is asserting
    // real end-state, not a synchronous illusion.
    await flushPromises()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('exposes a wallpaper action that opens the picker', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }) },
    })
    // The menu content is portalled; call the handler the item is bound to.
    ;(w.vm as unknown as { onChangeWallpaper: () => void }).onChangeWallpaper()
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })

  describe('rendered menu item (M3)', () => {
    // M3 (final review): the test above calls onChangeWallpaper() directly --
    // nothing asserted that the menu actually renders an item carrying the
    // wpChangeWallpaper label with onSelect wired to it. Deleting the
    // `onSelect: onChangeWallpaper` binding in DesktopContextMenu.vue (leaving
    // the item inert) would leave every test in this file green. This suite
    // goes through the real right-click -> reka-ui portal -> click path
    // instead, the same technique WallpaperDialog.test.ts documents for
    // reaching Teleported content.
    let w: ReturnType<typeof mount> | null = null

    afterEach(() => {
      w?.unmount()
      w = null
      document.body.innerHTML = ''
    })

    async function openMenu() {
      w = mount(DesktopContextMenu, {
        global: { plugins: [i18n] },
        slots: { default: () => h('div', { class: 'grid' }) },
        attachTo: document.body,
      })
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      w.find('.grid').element.dispatchEvent(ev)
      // Same reka-ui timing note as the "handles a right-click on blank canvas"
      // test above: the portal content appears only after an internal
      // await nextTick(), not synchronously within dispatchEvent().
      await flushPromises()
      return new DOMWrapper(document.body)
    }

    it('renders a menu item carrying the wpChangeWallpaper label', async () => {
      const body = await openMenu()
      const item = body.find('.ctx-change-wallpaper')
      expect(item.exists()).toBe(true)
      expect(item.text()).toBe(zh.wpChangeWallpaper)
    })

    it('clicking the rendered item opens the wallpaper picker', async () => {
      const body = await openMenu()
      expect(useWallpaperStore().dialogOpen).toBe(false)
      await body.find('.ctx-change-wallpaper').trigger('click')
      expect(useWallpaperStore().dialogOpen).toBe(true)
    })
  })
})
