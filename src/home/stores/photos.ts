import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type PhotoAsset } from '@nimotech/nimoos-service'

export const usePhotosStore = defineStore('home-photos', () => {
  const assets = ref<PhotoAsset[]>([])
  async function loadAssets() {
    try {
      const list = await service.photos.listAssets(60, 0)
      assets.value = Array.isArray(list) ? list : []
    } catch (e) { console.warn('[home] photos load failed', e) }
  }
  function thumbnailUrl(id: string | number): string { return service.photos.thumbnailUrl(id) }
  return { assets, loadAssets, thumbnailUrl }
})
