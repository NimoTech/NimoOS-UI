import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// App-level toast (single source of truth). Toasts STACK: each show() pushes a
// new toast that removes itself after its own duration (default 1500ms; callers
// may pass a longer one, e.g. uploads use 5000ms). `msg` is kept as a
// backward-compatible computed = the latest toast's text for legacy readers.
//
// SP8-P1c2 Task 6: added a `tier` so severity can be styled distinctly
// (info/warning/danger) — see AppToast.vue's `data-tier`. Backward
// compatibility is a hard requirement: `tier` is an optional 3rd argument
// defaulting to 'info', so every existing `show(text)` / `show(text, ms)`
// call site across the repo (files/apps/home areas) keeps working unchanged,
// same appearance (the 'info' tier renders identically to the pre-tier pill).
export type ToastTier = 'info' | 'warning' | 'danger'
export interface ToastItem { id: number; text: string; tier: ToastTier }

export const useToast = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  let seq = 0
  function show(text: string, duration = 1500, tier: ToastTier = 'info') {
    const id = ++seq
    toasts.value.push({ id, text, tier })
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, duration)
  }
  const msg = computed(() => (toasts.value.length ? toasts.value[toasts.value.length - 1].text : ''))
  return { toasts, msg, show }
})
