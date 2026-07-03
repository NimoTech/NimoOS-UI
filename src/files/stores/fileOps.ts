import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { parseFileOperate, filterActive, shouldReload, type FileTask } from '../util/fileOps'
import { useFilesStore } from './files'

export const useFileOpsStore = defineStore('files-ops', () => {
  const active = ref<FileTask[]>([])
  const visible = computed(() => active.value.length > 0)

  // socket 原始 props → 活动任务;完成且落当前目录则 reload(移植 Vue2 两个 socket handler 合一)
  function ingest(props: unknown) {
    const tasks = parseFileOperate(props)
    active.value = filterActive(tasks)
    const files = useFilesStore()
    if (shouldReload(tasks, files.currentPath)) files.load(files.currentPath)
  }

  async function cancelAll() {
    await service.batch.deleteTask(0) // 0 = 全部
  }

  return { active, visible, ingest, cancelAll }
})
