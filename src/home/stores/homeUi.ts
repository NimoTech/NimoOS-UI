import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useToast } from '../../stores/toast'

export const useHomeUiStore = defineStore('home-ui', () => {
  const editing = ref(false)
  // Global search palette (SearchDialog). Opened by the topbar search button and ⌘K/Ctrl+K.
  const searchOpen = ref(false)
  // Drop-ghost driven by the AddPanel spawn drag (edit-move ghost lives in useDragResize).
  // GridCanvas renders a GridGhost bound to this so dragging from the panel shows the target cell.
  const spawnGhost = ref<{ c: number; r: number; w: number; h: number; ok: boolean } | null>(null)

  function toggleEdit(force?: boolean) { editing.value = force === undefined ? !editing.value : force }
  function setSearch(v: boolean) { searchOpen.value = v }
  function openSearch() { searchOpen.value = true }
  function closeSearch() { searchOpen.value = false }
  // Toast is now app-level; keep this convenience so home's ~10 call sites stay unchanged.
  function showToast(msg: string) { useToast().show(msg) }
  return { editing, searchOpen, spawnGhost, toggleEdit, setSearch, openSearch, closeSearch, showToast }
})
