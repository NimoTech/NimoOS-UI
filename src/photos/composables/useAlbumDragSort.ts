// Manual drag-to-reorder for album detail grids. Ported (behavior verbatim)
// from Vue2 NimoOS-UI src/views/Photos/PhotosAlbumDetail.vue:
//   :253-256 created()       -> this._sortable/_dragging init (here: module-
//                                closure locals `inst`/`dragging`, no ref —
//                                same "non-reactive plain flag" intent).
//   :264-276 mounted()       -> initSortable() after $nextTick (here: caller
//                                calls refresh() from a watch, see brief).
//   :277-280 beforeDestroy() -> destroySortable() (here: destroy()).
//   :385-405 initSortable()  -> Sortable.create() with the five verbatim
//                                options + onStart/onEnd guard timing.
//   :409     persistOrder()  -> DOM read order (composable stops at reading
//                                the order; store dispatch + failure toast
//                                are T8's job — kept out of this composable
//                                by design so it stays unit-testable and has
//                                no store/toast coupling).
import Sortable from 'sortablejs'
import { nextTick, type Ref } from 'vue'

export interface AlbumDragSort {
  /** Non-reactive read — for onTileClick's post-drop click guard. */
  isDragging(): boolean
  /** Rebuild (or tear down) the Sortable instance per current enabled(). */
  refresh(): void
  /** Idempotent teardown — call from onBeforeUnmount. */
  destroy(): void
}

export function useAlbumDragSort(opts: {
  container: Ref<HTMLElement | null>
  enabled: () => boolean
  onOrder: (assetIds: string[]) => void
  /** SP15-P1-T6: the Moments grid reuses this composable. These three optional
   *  fields default to the album page's current values, so existing call sites need
   *  no edit and behave byte-identically to before this change. */
  itemSelector?: string
  ghostClass?: string
  chosenClass?: string
}): AlbumDragSort {
  let inst: Sortable | null = null
  // Plain closure variable, not a ref — mirrors Vue2's this._dragging:
  // reactivity here would just cause needless re-renders on every drag
  // start/end, and callers only ever need isDragging() as a synchronous
  // guard inside a click handler, never a reactive dependency.
  let dragging = false

  function destroy(): void {
    if (inst) {
      inst.destroy()
      inst = null
    }
  }

  function refresh(): void {
    destroy()
    if (!opts.enabled() || opts.container.value == null) return
    const el = opts.container.value
    const itemSelector = opts.itemSelector ?? '.tile[data-id]'
    inst = Sortable.create(el, {
      animation: 150,
      ghostClass: opts.ghostClass ?? 'tile-drag-ghost',
      // Only present when a caller passes one — the album page never did, and
      // Sortable treats an omitted chosenClass differently from an explicit
      // undefined, so this must not add the key at all in the default case.
      ...(opts.chosenClass ? { chosenClass: opts.chosenClass } : {}),
      forceFallback: true,
      fallbackOnBody: true,
      // Guard the post-drop click so a drag doesn't also toggle selection.
      onStart: () => {
        dragging = true
      },
      onEnd: () => {
        const ids = Array.from(el.querySelectorAll(itemSelector))
          .map((n) => n.getAttribute('data-id'))
          .filter((id): id is string => id !== null)
        opts.onOrder(ids)
        void nextTick(() => {
          dragging = false
        })
      },
    })
  }

  function isDragging(): boolean {
    return dragging
  }

  return { isDragging, refresh, destroy }
}
