import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHomeUiStore = defineStore('home-ui', () => {
  const editing = ref(false)
  const toastMsg = ref('')
  // Drop-ghost driven by the AddPanel spawn drag (edit-move ghost lives in useDragResize).
  // GridCanvas renders a GridGhost bound to this so dragging from the panel shows the target cell.
  const spawnGhost = ref<{ c: number; r: number; w: number; h: number; ok: boolean } | null>(null)
  let token = 0

  function toggleEdit(force?: boolean) { editing.value = force === undefined ? !editing.value : force }
  function showToast(msg: string) {
    toastMsg.value = msg
    const my = ++token
    setTimeout(() => { if (token === my) toastMsg.value = '' }, 1500)
  }
  return { editing, toastMsg, spawnGhost, toggleEdit, showToast }
})
