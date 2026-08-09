import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// `is_dir` rides along because paste's conflict dialog has to disable Overwrite
// for a directory collision -- the backend cannot overwrite a directory (see
// NimoOS service/file.go's move/copy style switch, which has no such case).
// Vue2 added the same field to operateObject.item for exactly this reason.
export interface OperateItem { from: string; is_dir: boolean }
export interface OperateObject { type: 'copy' | 'move'; item: OperateItem[] }

export const useClipboardStore = defineStore('files-clipboard', () => {
  const operateObject = ref<OperateObject | null>(null)
  const hasPasteData = computed(() => operateObject.value !== null)

  // cut == 'move'(Vue2 无独立 cut 字符串);item 存 from=真实路径 + is_dir,to/style 粘贴时才加
  function operate(type: 'copy' | 'move', entries: { path: string; is_dir: boolean }[]) {
    operateObject.value = { type, item: entries.map((e) => ({ from: e.path, is_dir: !!e.is_dir })) }
  }

  // 仅剪切(move)且命中才灰显;复制不灰显(移植 Vue2 getCardState)
  function isCut(realPath: string): boolean {
    const o = operateObject.value
    return !!o && o.type === 'move' && o.item.some((i) => i.from === realPath)
  }

  function clear() { operateObject.value = null }

  return { operateObject, hasPasteData, operate, isCut, clear }
})
