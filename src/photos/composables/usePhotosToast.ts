// Photos-private toast queue — Vue3 pixel counterpart of Vue2's body-mounted
// `window.PhotosToast` (src/views/Photos/photosToast.js in the Vue 2 panel). That
// file is a visual reference only (fixed pill stack, accent border, undo
// button, theme-aware surface) — nothing here is transcribed from it.
//
// Module-level singleton (same pattern as usePhotosTheme.ts): every caller
// across the photos area shares one queue, and a single <PhotosToastHost/>
// (mounted once per photos view) renders it via Teleport. Not Pinia, to stay
// consistent with the sibling theme composable and avoid pulling toast state
// into the app-wide store graph.
import { ref, type Ref } from 'vue'

export interface PhotosToastAction {
  label: string
  onClick: () => void
}

export interface PhotosToastItem {
  id: number
  text: string
  icon?: string
  action?: PhotosToastAction
}

export interface PhotosToastShowOptions {
  text: string
  icon?: string
  action?: PhotosToastAction
  duration?: number
}

let toasts: Ref<PhotosToastItem[]> | null = null
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function state(): Ref<PhotosToastItem[]> {
  if (!toasts) toasts = ref([])
  return toasts
}

function clearTimer(id: number) {
  const timer = timers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function dismiss(id: number) {
  clearTimer(id)
  const list = state()
  list.value = list.value.filter((t) => t.id !== id)
}

export function usePhotosToast(): {
  show: (opts: PhotosToastShowOptions) => void
  toasts: Readonly<Ref<PhotosToastItem[]>>
  __resetForTests: () => void
} {
  const list = state()

  function show(opts: PhotosToastShowOptions) {
    const id = nextId++
    // Vue2 photosToast.js:71 parity: action present -> 5000ms, else 2800ms,
    // both overridable by an explicit duration.
    const duration = opts.duration ?? (opts.action ? 5000 : 2800)
    const action = opts.action
      ? {
          label: opts.action.label,
          // Wrapping onClick here (rather than exposing a separate
          // `dismiss` from this composable) keeps the produced surface
          // exactly {show, toasts, __resetForTests} per the Task 2 contract
          // — the host only ever needs to call action.onClick().
          onClick: () => {
            // Vue2 parity (photosToast.js:123-124): the caller's handler
            // runs inside a try/catch so a throwing onClick still lets the
            // toast dismiss — the click is a "commit and get out of the
            // way" gesture, not a place to surface caller bugs.
            try {
              opts.action?.onClick()
            } catch {
              // intentionally swallowed, see above
            }
            dismiss(id)
          },
        }
      : undefined
    list.value = [...list.value, { id, text: opts.text, icon: opts.icon, action }]
    timers.set(id, setTimeout(() => dismiss(id), duration))
  }

  function __resetForTests() {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
    nextId = 1
    list.value = []
  }

  return { show, toasts: list, __resetForTests }
}
