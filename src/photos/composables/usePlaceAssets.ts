// Place detail panel "photos" tab one-time asset loading.
// Ported from the Vue 2 panel's src/views/Photos/PhotosTimeline.vue:819-841 (_loadPlaceAssets).
import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { groupPhotosByMonth } from '../util/groupPhotosByMonth'

// Vue2 :823 hardcoded limit:500, no pagination. Copied as-is (pagination changes are new features, logged for later).
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
  // Race-condition guard, technique same as usePersonDetail.ts seq: no return value included, view doesn't need to read it.
  let seq = 0

  async function load(placeKey: string, spotKey: string, lat: number | null, lon: number | null): Promise<void> {
    const mine = ++seq
    loading.value = true
    // Review I2: success path previously did not clear old data — on second and subsequent
    // load() calls, loaded is already true, so PhotosPlaceAssets.vue's skeleton guard
    // (loading && !loaded) no longer matches, and the v-else branch keeps rendering the
    // previous spot's (or whole city's) photos until the new response arrives. Real trigger
    // path: breadcrumb "view whole city only" → showWholeCity() → route watcher → loadAll();
    // before city-wide results arrive, the page displays the photos from that spot. Here we
    // clear photos/loaded before the request is sent (consistent with the clear approach in
    // the catch branch below), combined with the existing seq guard — stale responses won't
    // refill, introducing no new race conditions.
    photos.value = []
    loaded.value = false
    failed.value = false
    try {
      const raw = await service.photos.listAssetsByPlace(placeKey, spotKey, ASSET_LIMIT, lat, lon) as
        { assets?: unknown } | unknown[] | null | undefined
      if (mine !== seq) return // Stale response, discard (success path)
      const list = Array.isArray((raw as { assets?: unknown })?.assets)
        ? (raw as { assets: unknown[] }).assets
        : Array.isArray(raw)
          ? raw
          : []
      photos.value = (list as Record<string, unknown>[]).map(a => assetToPhoto(a))
      loaded.value = true
      failed.value = false
    } catch (e) {
      if (mine !== seq) return // Stale response, discard (catch path)
      console.error('[photos-places] loadPlaceAssets', e)
      // Following Vue2 _loadPlaceAssets :836-838 "clear on failure", intentionally different
      // from store main data (fetchPlaces) "keep old data on failure": here the "photos" tab
      // results are one-time queries fetched fresh each time the tab opens/spot changes; keeping
      // the previous spot's photos after failure would mislead users into thinking they're seeing
      // the current spot's content — more deceptive than showing empty state, so we clear.
      photos.value = []
      failed.value = true
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  // Logged (recording only, no changes): this `months` is now a dead export — the
  // only consumer views/PhotosPlaceAssets.vue switched when adding EXIF filtering to
  // compute its own gridMonths from assets.photos.value (that file :130-139 has full
  // reasoning), and no longer reads months from here. Kept this field per "no unrelated
  // refactoring" (interface changes/field deletion are out of scope), but next time you modify
  // this composable don't assume it still has a consumer — grep first to verify.
  const months = computed(() => groupPhotosByMonth(photos.value))

  return { photos, months, loading, loaded, failed, load }
}
