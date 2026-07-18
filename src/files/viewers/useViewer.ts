import { ref, type Ref } from 'vue'
import { getPanelType, type PanelType } from './panelMap'
import type { FileEntry } from '../stores/files'

// 模块级单例状态
const open = ref(false)
const panelType = ref<PanelType | null>(null)
const currentItem = ref<FileEntry | null>(null)
const list = ref<FileEntry[]>([])

// ── 历史集成:预览开着时按"返回"应只关预览,而不是让路由退到上级目录还盖着预览层。
// 打开时 pushState 压一条同 URL 的记录(hash 路由不变,vue-router 视为无导航);
// 返回键 pop 掉它 → onPop 只关预览;X/ESC 关闭 → history.back() 吃掉这条记录。
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
    window.history.back() // 消耗 openItem 压入的记录,历史栈保持干净
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
