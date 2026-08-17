import { ref, type Ref } from 'vue'
import { getPanelType, type PanelType } from './panelMap'
import type { FileEntry } from '../stores/files'

// Module-level singleton state
const open = ref(false)
const panelType = ref<PanelType | null>(null)
const currentItem = ref<FileEntry | null>(null)
const list = ref<FileEntry[]>([])

// ── History integration: when preview is open, pressing "back" should only close the preview,
// not navigate the route back to parent directory while the preview overlay stays.
// On open, pushState adds a same-URL history entry (hash route unchanged, vue-router sees no nav);
// back button pops it → onPop only closes preview; X/ESC closing → history.back() consumes this entry.
let pushedHistory = false

function onPop(): void {
  pushedHistory = false
  window.removeEventListener('popstate', onPop)
  if (open.value) resetState()
}

function resetState(): void {
  open.value = false
  panelType.value = null
  currentItem.value = null
  list.value = []
}

function openItem(entry: FileEntry, entryList: FileEntry[]): boolean {
  const t = getPanelType(entry.name)
  if (!t) return false
  panelType.value = t
  currentItem.value = entry
  list.value = entryList
  open.value = true
  if (!pushedHistory && typeof window !== 'undefined') {
    window.history.pushState({ nimoosViewer: true }, '')
    pushedHistory = true
    window.addEventListener('popstate', onPop)
  }
  return true
}

function close(): void {
  resetState()
  if (pushedHistory) {
    pushedHistory = false
    window.removeEventListener('popstate', onPop)
    window.history.back() // consume the entry pushed by openItem, keep history stack clean
  }
}

export function useViewer(): {
  open: Ref<boolean>
  panelType: Ref<PanelType | null>
  currentItem: Ref<FileEntry | null>
  list: Ref<FileEntry[]>
  openItem: (entry: FileEntry, entryList: FileEntry[]) => boolean
  close: () => void
} {
  return { open, panelType, currentItem, list, openItem, close }
}
