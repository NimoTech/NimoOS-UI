// Vue2 shell/ModelPicker.vue:52-63 —— a locally-registered `click-outside`
// directive:
//   bind(el, binding)   { document.addEventListener('mousedown', ...) }
//   unbind(el)          { document.removeEventListener('mousedown', ...) }
// Vue 3 custom directives don't have `bind`/`unbind` hooks (renamed to
// `mounted`/`unmounted`, and directive objects need a different shape per
// component instance to close over per-instance state cleanly) — ported here
// as a composable instead, using the component lifecycle hooks that carry the
// equivalent semantics: attach the listener once the host element exists in
// the DOM (`onMounted`), detach it when the host unmounts (`onUnmounted`).
import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Calls `handler` on any `mousedown` that lands outside `elRef.value`.
 * `elRef` should be a template ref bound to the root element that defines
 * "inside" (e.g. the whole dropdown + its trigger pill).
 */
export function useClickOutside(elRef: Ref<HTMLElement | null | undefined>, handler: () => void): void {
  function onMouseDown(event: MouseEvent) {
    const el = elRef.value
    if (el && !el.contains(event.target as Node)) handler()
  }

  onMounted(() => {
    document.addEventListener('mousedown', onMouseDown)
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', onMouseDown)
  })
}
