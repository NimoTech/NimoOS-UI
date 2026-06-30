import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHomeUiStore = defineStore('home-ui', () => {
  const editing = ref(false)
  const toastMsg = ref('')
  let token = 0

  function toggleEdit(force?: boolean) { editing.value = force === undefined ? !editing.value : force }
  function showToast(msg: string) {
    toastMsg.value = msg
    const my = ++token
    setTimeout(() => { if (token === my) toastMsg.value = '' }, 1500)
  }
  return { editing, toastMsg, toggleEdit, showToast }
})
