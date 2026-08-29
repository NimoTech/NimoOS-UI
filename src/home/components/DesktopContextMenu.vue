<script lang="ts">
// Right-click on empty desktop -> Change wallpaper. Ports Vue2
// components/wallpaper/ContextMenu.vue, including its gate: a right-click that
// landed on a tile is not a desktop click and must fall through to the browser
// (Vue2 checked for the `contextmenu-canvas` class at :50; New-UI's equivalent
// signal is "the target is inside a .grid-item").
//
// No <template>/wrapper element here on purpose (SP11 review round 1, Critical
// finding): a plain `<div class="host"><slot /></div>` -- even with
// `display: contents` -- generates no box, so `useGridMeasure`'s
// `grid.parentElement.clientWidth` read (src/home/composables/useGridMeasure.ts)
// returns 0 in every spec-compliant browser once GridCanvas is no longer a
// direct child of `.home-screen`. jsdom has no layout engine and cannot catch
// this (clientWidth is 0 there regardless of display), which is exactly how it
// shipped green the first time. Fix: merge our capture-phase listener directly
// onto the slot's own root vnode via cloneVNode, the same technique reka-ui's
// own internal `Slot` primitive (Primitive/Slot.js) uses for `as-child`. This
// keeps `.grid` (GridCanvas's root) a direct DOM child of `.home-screen`, with
// nothing in between -- pinned by the "no wrapper" test in
// Home.integration.test.ts.
import { cloneVNode, defineComponent, h } from 'vue'
import { ContextMenuItem } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

export default defineComponent({
  name: 'DesktopContextMenu',
  setup(_props, { slots, expose }) {
    const { t } = useI18n()
    const wp = useWallpaperStore()

    function onContextMenu(e: MouseEvent) {
      const el = e.target as HTMLElement | null
      if (el?.closest('.grid-item')) {
        // Stop reka-ui's trigger from seeing it; the browser menu stays available.
        e.stopPropagation()
      }
    }

    function onChangeWallpaper() {
      wp.openDialog()
    }

    expose({ onChangeWallpaper })

    return () => {
      const children = slots.default?.() ?? []
      // Consumers (Home.vue, and this component's own tests) always pass a
      // single root node (GridCanvas, or a stub div in tests) -- merge the
      // gate onto it directly rather than adding a wrapper around it.
      const patched = children.map((vnode) => cloneVNode(vnode, { onContextmenuCapture: onContextMenu }))
      return h(ContextMenu, null, {
        default: () => patched,
        menu: () => h(
          ContextMenuItem,
          { class: 'ui-ctx-item ctx-change-wallpaper', onSelect: onChangeWallpaper },
          () => t('wpChangeWallpaper'),
        ),
      })
    }
  },
})
</script>
