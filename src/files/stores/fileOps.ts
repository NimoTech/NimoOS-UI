import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { parseFileOperate, filterActive, shouldReload, type FileTask } from '../util/fileOps'
import { useFilesStore } from './files'

export const useFileOpsStore = defineStore('files-ops', () => {
  const active = ref<FileTask[]>([])

  // Raw socket props → active tasks; if completed and falls in current directory, reload (ported from Vue2, combines two socket handlers into one)
  function ingest(props: unknown) {
    const tasks = parseFileOperate(props)
    active.value = filterActive(tasks)
    const files = useFilesStore()
    if (shouldReload(tasks, files.currentPath)) files.load(files.currentPath)
  }

  async function cancelAll() {
    await service.batch.deleteTask(0) // 0 = all
  }

  return { active, ingest, cancelAll }
})
