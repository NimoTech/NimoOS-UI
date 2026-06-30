import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export const useFoldersStore = defineStore('home-folders', () => {
  const cache = ref<Record<string, { name: string; path: string }[]>>({})
  async function loadFolder(path: string) {
    try {
      const data = await service.folder.getList(path)
      const content = (data && data.content) || []
      cache.value[path] = content.filter((x) => x.is_dir).map((x) => ({ name: x.name, path: x.path }))
    } catch (e) { console.warn('[home] folder load failed', path, e); cache.value[path] = [] }
  }
  return { cache, loadFolder }
})
