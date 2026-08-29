// Plan C, Task 2: extracted verbatim from Photos.vue's own `collapsed` ref +
// localStorage persistence + narrow-mode drawer branch (Task 3/4's
// onToggleCollapse, PhotosTimeline.vue:965 parity) — behavior-preserving.
// Photos.vue becomes the first consumer (its own tests stay green untouched);
// the five re-shelled album/for-you views (Task 2) share it too.
//
// Module-level singleton (usePhotosTheme.ts's own precedent), not per-view
// state: Photos.vue used to hold `collapsed` locally and only shared it with
// its sibling pages through the localStorage key — every remount re-read the
// same key, so two views never visibly disagreed, but there WAS a first-paint
// flash on every navigation while each fresh `ref()` re-read storage. A
// module singleton removes that flash (all photos-area views now observe the
// exact same live ref) and is otherwise invisible: the persisted value and
// the toggle semantics are unchanged.
import { ref, watch, type Ref } from 'vue'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'

const COLLAPSE_KEY = 'nimo_photos_sidebar_collapsed'

let collapsed: Ref<boolean> | null = null
let stopWatch: (() => void) | null = null

function init() {
  if (collapsed) return
  collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
  stopWatch = watch(collapsed, (v) => { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0') })
}

export function useSidebarCollapse(): { collapsed: Ref<boolean>; toggle: () => void } {
  init()
  const state = collapsed as Ref<boolean>
  // Task 3/4's final-review fix (Photos.vue history): on a ≤768px viewport
  // PhotosSidebar renders as its own fixed drawer instead of the desktop
  // two-column grid track, so flipping `collapsed` there is a no-op (it only
  // ever drives the `.app[data-collapsed]` desktop column-width rule, which
  // the drawer isn't part of). Route the same toggle to the drawer's own
  // toggle() when isNarrow is true instead.
  const { isNarrow, toggle: toggleDrawer } = useSidebarDrawer()
  function toggle() {
    if (isNarrow.value) { toggleDrawer(); return }
    state.value = !state.value
  }
  return { collapsed: state, toggle }
}

export function __resetSidebarCollapseForTests() {
  stopWatch?.()
  stopWatch = null
  collapsed = null
}
