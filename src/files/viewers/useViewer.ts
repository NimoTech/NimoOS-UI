import { ref, type Ref } from 'vue'
import { getPanelType, type PanelType } from './panelMap'
import type { FileEntry } from '../stores/files'

// 模块级单例状态
const open = ref(false)
const panelType = ref<PanelType | null>(null)
const currentItem = ref<FileEntry | null>(null)
const list = ref<FileEntry[]>([])

function openItem(entry: FileEntry, entryList: FileEntry[]): boolean {
  const t = getPanelType(entry.name)
  if (!t) return false
  panelType.value = t
  currentItem.value = entry
  list.value = entryList
  open.value = true
  return true
}

function close(): void {
  open.value = false
  panelType.value = null
  currentItem.value = null
  list.value = []
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
