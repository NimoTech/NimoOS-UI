import { defineStore } from 'pinia'
import { ref } from 'vue'

// App-level toast (single source of truth). Logic verbatim from the former
// home-ui toast: set message, auto-clear after 1500ms; monotonic token so a
// newer toast cancels an older pending clear.
export const useToast = defineStore('toast', () => {
  const msg = ref('')
  let token = 0
  function show(text: string) {
    msg.value = text
    const my = ++token
    setTimeout(() => { if (token === my) msg.value = '' }, 1500)
  }
  return { msg, show }
})
