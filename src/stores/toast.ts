import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// App-level toast (single source of truth). Toasts STACK: each show() pushes a
// new toast that removes itself after its own duration (default 1500ms; callers
// may pass a longer one, e.g. uploads use 5000ms). `msg` is kept as a
// backward-compatible computed = the latest toast's text for legacy readers.
export interface ToastItem { id: number; text: string }

export const useToast = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  let seq = 0
  function show(text: string, duration = 1500) {
    const id = ++seq
    toasts.value.push({ id, text })
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, duration)
  }
  const msg = computed(() => (toasts.value.length ? toasts.value[toasts.value.length - 1].text : ''))
  return { toasts, msg, show }
})
