import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// `is_dir` rides along locally so paste's conflict dialog can disable Overwrite
// for a directory collision -- the backend cannot overwrite a directory (see
// NimoOS service/file.go's move/copy style switch, which has no such case).
// It never reaches the wire: Vue2's FilePanel.vue carries the same field on
// operateObject.item for the same dialog reason but strips it before
// submitting (`item.map(entry => ({ from: entry.from }))`), and New-UI's
// buildPastePayload (fileOps.ts) does the same so the request body matches.
export interface OperateItem { from: string; is_dir: boolean }
export interface OperateObject { type: 'copy' | 'move'; item: OperateItem[] }

export const useClipboardStore = defineStore('files-clipboard', () => {
  const operateObject = ref<OperateObject | null>(null)
  const hasPasteData = computed(() => operateObject.value !== null)

  // cut is just 'move' (Vue2 has no separate cut string); item stores
  // from=real path + is_dir, with to/style added only at paste time.
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
