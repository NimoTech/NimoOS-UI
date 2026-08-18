import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// App-level toast (single source of truth). Toasts STACK: each show() pushes a
// new toast that removes itself after its own duration (default 1500ms; callers
// may pass a longer one, e.g. uploads use 5000ms). `msg` is kept as a
// backward-compatible computed = the latest toast's text for legacy readers.
//
// `action` (Task 9, SP7-P3 photos trash view): optional inline affordance (e.g.
// "Undo") rendered as a clickable pill inside the toast by AppToast.vue.
// Third, optional `show()` param — fully backward compatible with the dozens
// of existing `toast.show(text[, duration])` call sites across the app.
//
// SP8-P1c2 Task 6: added a `tier` so severity can be styled distinctly
// (info/warning/danger) — see AppToast.vue's `data-tier`. Backward
// compatibility is a hard requirement: `tier` defaults to 'info', so every
// existing `show(text)` / `show(text, ms)` call site across the repo
// (files/apps/home areas) keeps working unchanged, same appearance
// (the 'info' tier renders identically to the pre-tier pill).
//
// [SP8-P6-T3 merge] sp7 and sp8 each claimed the **third positional argument** for their own
// purpose: master's side used it as an `action` object, sp8's side used it as a `tier` string.
// Both already have real call sites (tier ~48, action 4), and changing either signature would
// touch dozens of call sites, so this makes the third param a **discriminated union** instead:
//   typeof === 'string' -> treated as tier; otherwise treated as an action object.
// Every existing call site on both sides therefore needs zero changes, while the types stay precise.
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastAction { label: string; onClick: () => void }
export interface ToastItem { id: number; text: string; tier: ToastTier; action?: ToastAction }

export const useToast = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  let seq = 0
  function show(text: string, duration = 1500, tierOrAction: ToastTier | ToastAction = 'info') {
    const id = ++seq
    const tier = typeof tierOrAction === 'string' ? tierOrAction : 'info'
    const action = typeof tierOrAction === 'string' ? undefined : tierOrAction
    toasts.value.push({ id, text, tier, action })
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, duration)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  const msg = computed(() => (toasts.value.length ? toasts.value[toasts.value.length - 1].text : ''))
  return { toasts, msg, show, dismiss }
})
