// SP15-P2c Task 1. Vue 3 port of Vue2's fixedMoreMenu.js mixin (33b05636:src/views/Photos/
// fixedMoreMenu.js), shared by both detail pages' sidebar "..." menus.
//
// Why fixed at all: the menu is a position:absolute child of .sv-detail-side, which is
// overflow-y:auto. Once the menu grew to five entries it no longer fit the sidebar's visible
// box and got clipped -- the owner reported it as "the menu is pinned under something".
// Switching to position:fixed and computing the coordinates from the trigger button's rect
// takes it out of the scroll container's clipping entirely.
//
// Owner ruling 2026-08-10 (spec 3.4): share the LOGIC, not the view. The menu markup and its
// CSS stay duplicated in each page -- P2b's keep-the-duplication ruling rests on scoped styles
// not crossing SFC boundaries, which says nothing about plain TypeScript.
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

// Height of a five-entry menu, used only to decide the flip. Vue2 used the same constant and
// deliberately did not measure per-frame -- an estimate is enough for a flip decision.
const ESTIMATED_MENU_HEIGHT = 340

export function useFixedMenuPosition(
  open: Ref<boolean>,
  btnRef: Ref<HTMLElement | null>,
): { menuStyle: Ref<Record<string, string | number>> } {
  const menuStyle = ref<Record<string, string | number>>({})
  let onScrollOrResize: (() => void) | null = null

  function unbind(): void {
    if (!onScrollOrResize) return
    // Must pass the same capture flag that addEventListener used, or the removal is a no-op.
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
    onScrollOrResize = null
  }

  function bind(): void {
    unbind()
    onScrollOrResize = () => { open.value = false }
    // Capture phase: a scroll inside .sv-detail-side does not bubble to window, so a
    // bubble-phase listener would never fire for the one container that matters most here.
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
  }

  function place(): void {
    const btn = btnRef.value
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const style: Record<string, string | number> = {
      position: 'fixed',
      right: `${window.innerWidth - rect.right}px`,
      zIndex: 260,
    }
    if (spaceBelow < ESTIMATED_MENU_HEIGHT && rect.top > spaceBelow) {
      style.bottom = `${window.innerHeight - rect.top + 6}px`
    } else {
      style.top = `${rect.bottom + 6}px`
    }
    menuStyle.value = style
    bind()
  }

  // A watcher rather than wiring every close site: open.value goes false from click-outside,
  // from the menu entries themselves, and from Escape. Centralising here means none of those
  // call sites has to remember to unbind.
  watch(open, (isOpen) => { if (isOpen) place(); else unbind() })

  onBeforeUnmount(unbind)

  return { menuStyle }
}
