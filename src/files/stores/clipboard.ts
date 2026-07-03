import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface OperateItem { from: string }
export interface OperateObject { type: 'copy' | 'move'; item: OperateItem[] }

export const useClipboardStore = defineStore('files-clipboard', () => {
  const operateObject = ref<OperateObject | null>(null)
  const hasPasteData = computed(() => operateObject.value !== null)

  // cut == 'move'(Vue2 无独立 cut 字符串);item 只存 from=真实路径,to/style 粘贴时才加
  function operate(type: 'copy' | 'move', realPaths: string[]) {
    operateObject.value = { type, item: realPaths.map((p) => ({ from: p })) }
  }

  // 仅剪切(move)且命中才灰显;复制不灰显(移植 Vue2 getCardState)
  function isCut(realPath: string): boolean {
    const o = operateObject.value
    return !!o && o.type === 'move' && o.item.some((i) => i.from === realPath)
  }

  function clear() { operateObject.value = null }

  return { operateObject, hasPasteData, operate, isCut, clear }
})
