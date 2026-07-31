// P6b-T2:地点详情面板「照片」标签页的一次性资产加载。
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue:819-841 (_loadPlaceAssets).
import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { groupPhotosByMonth } from '../util/groupPhotosByMonth'

// Vue2 :823 硬编码 limit:500,无分页。照搬(改分页是新功能,记账留后续)。
const ASSET_LIMIT = 500

export interface UsePlaceAssetsReturn {
  photos: Ref<Photo[]>
  months: ComputedRef<Month[]>
  loading: Ref<boolean>
  loaded: Ref<boolean>
  failed: Ref<boolean>
  load: (placeKey: string, spotKey: string, lat: number | null, lon: number | null) => Promise<void>
}

export function usePlaceAssets(): UsePlaceAssetsReturn {
  const photos = ref<Photo[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const failed = ref(false)
  // 竞态守卫,手法照 usePersonDetail.ts 的同款 seq:不进返回值,视图不需要读它。
  let seq = 0

  async function load(placeKey: string, spotKey: string, lat: number | null, lon: number | null): Promise<void> {
    const mine = ++seq
    loading.value = true
    try {
      const raw = await service.photos.listAssetsByPlace(placeKey, spotKey, ASSET_LIMIT, lat, lon) as
        { assets?: unknown } | unknown[] | null | undefined
      if (mine !== seq) return // 过期响应,丢弃(成功路径)
      const list = Array.isArray((raw as { assets?: unknown })?.assets)
        ? (raw as { assets: unknown[] }).assets
        : Array.isArray(raw)
          ? raw
          : []
      photos.value = (list as Record<string, unknown>[]).map(a => assetToPhoto(a))
      loaded.value = true
      failed.value = false
    } catch (e) {
      if (mine !== seq) return // 过期响应,丢弃(catch 路径)
      console.error('[photos-places] loadPlaceAssets', e)
      // 照 Vue2 _loadPlaceAssets :836-838 的"失败清空",与 store 主数据(fetchPlaces)的
      // "失败保留旧数据"口径刻意不同:这里是「照片」标签页每次打开/切换 spot 都会重新
      // 查询的一次性结果,失败后留着上一个 spot 的照片会让用户误以为看到的是当前 spot 的
      // 内容——比展示空态更具误导性,所以清空。
      photos.value = []
      failed.value = true
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  const months = computed(() => groupPhotosByMonth(photos.value))

  return { photos, months, loading, loaded, failed, load }
}
