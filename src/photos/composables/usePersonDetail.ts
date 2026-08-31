// Detail page data orchestration. Ported from the Vue 2 panel's
// src/views/Photos/PhotosPersonDetail.vue:596 (watch), :728-759 (loadPerson/groupByMonth).
// Deviation spec 6: Vue2 has no race guards; rapid clicks on timeline/relations jumping to
// others, slow old responses overwrite new page data. Here use useLightbox.hydrateDetail
// (useLightbox.ts:100-124)'s same seq pattern: each load increments, compare before
// write-back, stale responses discarded outright.
import { ref, shallowRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo, type Month } from '../util/assetToPhoto'
import { toPerson, monthKeyLabel, type Person } from '../util/peopleView'

// Vue2 :741 hard-coded limit:300 / offset:0, no pagination. Copy as-is (pagination
// changes are new feature, record for follow-up).
// Accounting entry (record only, don't change): this 300 limit is still the only
// implementation, no "load more" / scroll pagination — when person has 300+ assets,
// detail page shows only first 300 (matches Vue2 behavior, not a regression this round).
const ASSET_LIMIT = 300

export interface PersonRelation { personId: string | number; name?: string; coverFaceId?: string | number | null; count: number }
export interface PersonPlace { placeName?: string | null; latitude?: number | null; longitude?: number | null }

// Per Vue2 groupByMonth :749-759: bucket by **first 7 characters of takenAt string**
// (don't parse Date), keys desc, 'unknown' bucket moved to end by stable sort.
// Note: **don't reuse util/groupPhotosByMonth.ts** — that parses with new Date() taking
// local timezone year-month, differs from string slicing in cross-timezone/dirty data;
// person page stays true to Vue2's string slicing.
export function groupPersonAssets(photos: Photo[]): Month[] {
  const map: Record<string, Photo[]> = {}
  for (const p of photos) {
    const raw = typeof p.takenAt === 'string' ? p.takenAt : ''
    const key = raw ? raw.slice(0, 7) : 'unknown'
    ;(map[key] = map[key] ?? []).push(p)
  }
  return Object.keys(map)
    .sort()
    .reverse()
    .sort((a, b) => Number(a === 'unknown') - Number(b === 'unknown'))
    .map((key) => ({ key, title: monthKeyLabel(key), loc: '', photos: map[key] }))
}

export function usePersonDetail() {
  const person = ref<Person | null>(null)
  const relations = shallowRef<PersonRelation[]>([])
  const places = shallowRef<PersonPlace[]>([])
  const months = shallowRef<Month[]>([])
  const loading = ref(false)
  const failed = ref(false)
  let seq = 0
  // Review Important 3: seq only protects load()'s **own** write-back (stale responses
  // discarded); container-direction nine-action write-back (patchPerson) previously had
  // no corresponding mechanism. currentId is the unique source-of-truth for "who this
  // composable is currently holding", load() syncs it immediately on entry (doesn't wait
  // for response), so when route changes and watch calls load(), previous person's in-
  // flight PATCH immediately becomes stale.
  let currentId: string | null = null

  // Law: id comparison always uses String() normalization.
  function isCurrent(id: string | number): boolean {
    return currentId !== null && String(id) === currentId
  }

  async function load(id: string | number): Promise<void> {
    const mine = ++seq
    currentId = String(id)
    loading.value = true
    failed.value = false
    // Per Vue2 :731-734 — clear first then fetch, avoid stale person's data lingering
    // on new page.
    person.value = null
    relations.value = []
    places.value = []
    months.value = []
    try {
      const d = (await service.photos.getPerson(id)) as
        { person?: Record<string, unknown>; relations?: unknown } | undefined
      if (mine !== seq) return                                   // Stale response, discard
      person.value = d?.person ? toPerson(d.person) : null
      relations.value = Array.isArray(d?.relations) ? (d?.relations as PersonRelation[]) : []

      const [pl, assets] = await Promise.all([
        service.photos.personPlaces(id),
        service.photos.getPersonAssets(id, ASSET_LIMIT, 0),
      ])
      if (mine !== seq) return                                   // Same as above
      places.value = Array.isArray(pl) ? (pl as PersonPlace[]) : []
      const list = Array.isArray(assets) ? (assets as Record<string, unknown>[]) : []
      months.value = groupPersonAssets(list.map((a) => assetToPhoto(a)))
    } catch (e) {
      if (mine !== seq) return
      console.error('[photos-people] loadPerson', e)
      failed.value = true                                        // New-UI addition: let view distinguish "load failed" from "person not found"
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  // Consolidated: Vue2 :510-512 and :591-593 are verbatim-duplicate computeds
  // (deviation spec 11).
  function flatPhotos(): Photo[] { return months.value.flatMap((m) => m.photos) }

  // Review Important 3: **expectId is required**, not optional convenience parameter
  // — type system forces each write-back site to declare "I think I'm writing to whom",
  // fail to compile if not declared, future new actions can't bypass this check.
  //
  // Confirmed reproduction path (review-provided, nailed down with regression tests):
  // person A page → rename → PATCH in flight → browser back → route watch loads B → B
  // ready → A's PATCH resolves → without check patchPerson({name}) hits **B**, B's hero
  // name/top-bar/album default-name all become A's input, refresh restores. Favorites/
  // relations grouping's **failure rollback** likewise writes A's old value to B.
  //
  // Return semantics: true = "still same person" (might not actually write if person.value
  // still null, but caller should continue its toast); false = "switched to someone else",
  // caller should abandon even the toast — A's "rename failed" toast appearing on B's
  // page is likewise a defect.
  function patchPerson(patch: Partial<Person>, expectId: string | number): boolean {
    if (!isCurrent(expectId)) return false
    if (person.value) person.value = { ...person.value, ...patch }
    return true
  }
  function removePhotosLocally(ids: Array<string | number>): void {
    const kill = new Set(ids.map((x) => String(x)))
    months.value = months.value
      .map((m) => ({ ...m, photos: m.photos.filter((p) => !kill.has(String(p.id))) }))
      .filter((m) => m.photos.length > 0)
  }

  return { person, relations, places, months, loading, failed, load, flatPhotos, isCurrent, patchPerson, removePhotosLocally }
}
