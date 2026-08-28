// SP7-P7a-T15: useInfiniteScroll — IntersectionObserver wrapper for infinite-scroll sentinel.
// Ported from the Vue 2 panel's src/views/Photos/PhotosSearchView.vue:
//   :706-721 (observeLoadMoreSentinel/teardownLoadMoreObserver)
//   :607-610 (showLoadMoreSentinel watcher, decides when to attach/detach observer)
//
// Semantics ported 1:1 — teardown() disconnects the old observer first; if enabled is false
// or either target/root is null, only teardown is done; otherwise create a new
// IntersectionObserver (root/rootMargin configurable) and observe(target).
//
// Vue2 :607-610 is `watch(showLoadMoreSentinel) { if (show) this.$nextTick(() =>
// this.observeLoadMoreSentinel()) else this.teardownLoadMoreObserver() }` — after the value
// changes, wait one frame (until the next DOM update) before attaching, so the sentinel DOM
// node just rendered by v-if already exists. In Vue3, `watch(sources, cb, { flush: 'post' })`
// is the equivalent technique for this "wait one frame then run" pattern (the callback runs
// after the DOM updates triggered by this reactive update complete); we use it here in place
// of $nextTick, and comment documents this mapping.
//
// Added `immediate: true` additionally (Vue2's original watcher doesn't have it): Vue2's
// showLoadMoreSentinel always starts from false (depends on moreExpanded, which must be
// false initially), "attach observer" always happens in a real false→true state change, so
// immediate is naturally not needed. But this composable is a generic component, can't assume
// the caller's initial state for enabled/target — if both are ready when called (as in tests),
// without immediate sync() never runs and observe is never called. Adding immediate doesn't
// change Vue2's actual observable behavior (in the real host PhotosSearchGrid.vue,
// showSentinel equally starts from false, first run only hits the "teardown only" branch,
// a side-effect-free no-op).
import { onUnmounted, watch, type Ref } from 'vue'

export interface UseInfiniteScrollOptions {
  target: Ref<HTMLElement | null>
  root: Ref<HTMLElement | null>
  enabled: Ref<boolean>
  onHit: () => void
  rootMargin?: string
}

export function useInfiniteScroll(opts: UseInfiniteScrollOptions): void {
  let io: IntersectionObserver | null = null

  function teardown(): void {
    if (io) {
      io.disconnect()
      io = null
    }
  }

  function sync(): void {
    teardown()
    if (!opts.enabled.value) return
    const target = opts.target.value
    const root = opts.root.value
    if (!target || !root) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) opts.onHit()
      },
      { root, rootMargin: opts.rootMargin ?? '200px 0px' },
    )
    io.observe(target)
  }

  watch([opts.enabled, opts.target], sync, { flush: 'post', immediate: true })

  onUnmounted(teardown)
}
