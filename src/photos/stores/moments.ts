// SP15-P1-T3: Moments store.
// Ported from Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:553-624
// (fetchMoments/persistMomentsOrder/onMomentDeleted/onMomentAssetCountChanged) and
// PhotosMomentDetail.vue:307-338 (loadFeatured/loadAll).
// Backend contract cross-checked against NimoOS-Photos/route/v1/moments.go:39-73
// (momentResponse).
//
// Four deliberate differences from Vue 2 (logged individually):
//  1) Vue 2 kept list state in the view component and detail assets in the detail
//     component, each maintaining its own copy of asset_count and syncing them by
//     hand via a `$emit('asset-count-changed')`. Here it is folded into one store:
//     the detail page finishes a write by calling applyAssetCount, and the list
//     item is the very same object — there is nothing left to synchronise.
//  2) fetchMoments carries an epoch staleness guard (see plan Global Constraints
//     §6). Vue 2 did not need one — its fetchMoments only ran once on mount, so
//     two calls never overlapped. Here the detail page's return-to-list path
//     refetches too, so two fetchMoments calls can interleave, and a late
//     response would otherwise clobber a newer one.
//  3) setOrder requires `ids` to be a genuine permutation of the current list
//     (right length, no duplicates, every id known) rather than just checking
//     length equality. Vue 2's persistMomentsOrder used the weaker length-only
//     check (899af59b:PhotosSmartViewsView.vue:586 — `if (reordered.length !==
//     snapshot.length) return`), which silently drops an entry: a duplicate id
//     maps to the same moment twice, the resulting array's length still matches
//     the original, and the guard lets it through while a different moment
//     quietly vanishes from state. Deliberately not preserved — fixed instead.
//  4) pin / exclude / remove / loadDetail / loadAll throw through on failure,
//     whereas Vue 2's counterparts caught, swallowed, and toasted internally
//     (899af59b:PhotosMomentDetail.vue:376-400,427-428). Throwing through is
//     correct here — user-facing error feedback belongs to the view layer,
//     which wraps these calls in its own try/catch (later tasks) — but is
//     logged so a later task doesn't assume Vue 2's swallow-and-toast
//     semantics still hold.
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { assignMomentSizes } from '../util/momentLayout'

export interface Moment {
  id: string
  title: string
  subtitle: string
  place: string
  recipeKey: string
  coverAssetId: string
  featuredAssetIds: string[]
  assetCount: number
  addedThisWeek: number
  /** Cover aspect ratio w/h; backend convention: 0 = unknown. */
  coverRatio: number
  timeFrom: string
  timeTo: string
  /** ⚠️ momentResponse does **not** include updated_at — this is always the empty
   *  string, and the detail page renders '—' for it. The field is kept so that if
   *  the backend ever adds it, no type change is needed; it is not real data today. */
  updatedAt: string
}

export interface MomentMember { assetId: string; manual: boolean; featured: boolean }
export interface MomentPlace { name: string; count: number }
export interface MomentDetailAssets { assets: Photo[]; members: MomentMember[]; places: MomentPlace[] }

interface RawMoment {
  id?: unknown; title?: unknown; subtitle?: unknown; place?: unknown
  recipe_key?: unknown; cover_asset_id?: unknown; featured_asset_ids?: unknown
  asset_count?: unknown; added_this_week?: unknown; cover_ratio?: unknown
  time_from?: unknown; time_to?: unknown; updated_at?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function toMoment(raw: RawMoment): Moment {
  return {
    id: str(raw.id),
    title: str(raw.title),
    subtitle: str(raw.subtitle),
    place: str(raw.place),
    recipeKey: str(raw.recipe_key),
    coverAssetId: str(raw.cover_asset_id),
    featuredAssetIds: Array.isArray(raw.featured_asset_ids) ? raw.featured_asset_ids.map(str) : [],
    assetCount: num(raw.asset_count),
    addedThisWeek: num(raw.added_this_week),
    coverRatio: num(raw.cover_ratio),
    timeFrom: str(raw.time_from),
    timeTo: str(raw.time_to),
    updatedAt: str(raw.updated_at),
  }
}

export const usePhotosMoments = defineStore('photosMoments', () => {
  const moments = ref<Moment[]>([])
  const listLoading = ref(false)
  const listLoaded = ref(false)
  // Staleness guard: bumped on every fetchMoments call; only the response
  // matching the current epoch is allowed to write into moments.
  let fetchEpoch = 0

  const sizeMap = computed(() =>
    assignMomentSizes(
      moments.value.map((m) => ({
        id: m.id, recipeKey: m.recipeKey, assetCount: m.assetCount,
        coverRatio: m.coverRatio, featuredAssetIds: m.featuredAssetIds,
      })),
    ),
  )

  function byId(id: string): Moment | undefined {
    return moments.value.find((m) => m.id === String(id))
  }

  async function fetchMoments(): Promise<void> {
    const epoch = ++fetchEpoch
    listLoading.value = true
    try {
      const raw = await service.photos.listMoments()
      if (epoch !== fetchEpoch) return          // a late response — discard it
      moments.value = (raw as RawMoment[]).map(toMoment)
    } catch (e) {
      // Keep the old list on failure (Vue 2 did the same, just console.error and
      // nothing else) — clearing the view would make a single network blip look
      // like "every moment vanished".
      console.error('[photos-moments] listMoments', e)
    } finally {
      if (epoch === fetchEpoch) {
        listLoading.value = false
        listLoaded.value = true
      }
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (listLoaded.value || listLoading.value) return
    await fetchMoments()
  }

  /** Reorders local state only, no request — used internally by reorder() and by tests.
   *  Requires `ids` to be a genuine permutation of the current list: same length, every
   *  id known, and no duplicates. A duplicate would otherwise map to the same moment
   *  twice while the resulting array's length still happens to match — silently
   *  dropping whichever other moment never got picked (see file-header item 3). */
  function setOrder(ids: string[]): boolean {
    if (ids.length !== moments.value.length) return false  // wrong length — bail out conservatively
    const byIdMap = new Map(moments.value.map((m) => [m.id, m]))
    const seen = new Set<string>()
    const next: Moment[] = []
    for (const id of ids) {
      if (seen.has(id)) return false          // duplicate — not a true permutation
      const m = byIdMap.get(id)
      if (!m) return false                    // unknown id
      seen.add(id)
      next.push(m)
    }
    moments.value = next
    return true
  }

  async function reorder(ids: string[]): Promise<boolean> {
    if (!setOrder(ids)) return false
    try {
      await service.photos.reorderMoments(ids)
      return true
    } catch (e) {
      console.error('[photos-moments] reorderMoments', e)
      await fetchMoments()   // fully revert to server order
      return false
    }
  }

  async function loadDetail(id: string): Promise<MomentDetailAssets> {
    const data = await service.photos.getMomentAssets(String(id), true, true)
    // Older backends (or during a deploy window) return a bare array; both
    // shapes must be accepted.
    if (Array.isArray(data)) {
      return { assets: data.map(assetToPhoto), members: [], places: [] }
    }
    const d = (data ?? {}) as { assets?: Record<string, unknown>[]; members?: unknown[]; places?: unknown[] }
    return {
      assets: (d.assets ?? []).map(assetToPhoto),
      members: (d.members ?? []).map((m) => {
        const r = m as { asset_id?: unknown; manual?: unknown; featured?: unknown }
        return { assetId: str(r.asset_id), manual: !!r.manual, featured: !!r.featured }
      }),
      places: (d.places ?? []).map((p) => {
        const r = p as { name?: unknown; count?: unknown }
        return { name: str(r.name), count: num(r.count) }
      }),
    }
  }

  async function loadAll(id: string): Promise<Photo[]> {
    const data = await service.photos.getMomentAssets(String(id), false, false)
    return (Array.isArray(data) ? data : []).map(assetToPhoto)
  }

  /** Writes the latest count back onto the list item; keeps the previous value
   *  when the backend omits asset_count. */
  function applyAssetCount(id: string, count: number | null | undefined): void {
    if (count == null) return
    const m = byId(id)
    if (m) m.assetCount = count
  }

  async function pin(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.pinMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function exclude(id: string, assetIds: string[]): Promise<number | null> {
    const res = await service.photos.excludeMomentAssets(String(id), assetIds)
    const count = typeof res.asset_count === 'number' ? res.asset_count : null
    applyAssetCount(id, count)
    return count
  }

  async function remove(id: string): Promise<void> {
    await service.photos.deleteMoment(String(id))
    moments.value = moments.value.filter((m) => m.id !== String(id))
  }

  async function exportAlbum(id: string): Promise<{ albumId?: string; name?: string; count?: number }> {
    return await service.photos.exportMomentAlbum(String(id))
  }

  return {
    moments, listLoading, listLoaded, sizeMap,
    fetchMoments, ensureLoaded, byId, setOrder, reorder,
    loadDetail, loadAll, pin, exclude, remove, exportAlbum, applyAssetCount,
  }
})
