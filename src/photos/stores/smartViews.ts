// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:
//   mutations :487-501 (ADD_SMART_VIEW/UPDATE_SMART_VIEW/DELETE_SMART_VIEW/
//              RESTORE_SMART_VIEW/SET_SMART_VIEWS)
//   actions   :998-1075 (fetchSmartViews/createSmartView/updateSmartView/
//              deleteSmartView/restoreSmartView/duplicateSmartView)
//   PhotosSmartViewsView.vue:366-382 (refreshPreview)
//   PhotosSmartViewDetail.vue:409-423 (loadDetail)
// Backend contract (NimoOS-Photos/service/smartview.go:21-34 SmartView,
// :727-734 SmartViewActivity) — verified against source; json tag matches this file's
// normalization functions field-by-field. Photos v1 lacks a standard response envelope;
// lists always fall back to `?? []` (Go nil slice → null).
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
// Cross-area import; deliberately not moving the file or duplicating these 6 lines
// (controller decision, fix round 1 · C1): they contain a real guard — on typical
// devices with HTTP LAN addresses, `crypto.randomUUID` is undefined in non-secure
// contexts. SP4-P3a broke the entire upload feature by dropping this guard. Moving the
// file would affect file-area consumers (SP4), copying would duplicate the guard
// unnecessarily. Precedent for cross-area refs: PhotosSidebar.vue imports
// files/util/format; PhotoInfoPanel.vue imports files/util/clipboard.
import { safeRandomUUID } from '../../files/upload/uuid'
// SP15-P2b final fix wave: mutual import with albums.ts -- the two conversion actions are
// mirror images, and each has to evict the source object from the other store. See the twin
// comment in albums.ts for why the cycle is safe (the call sits inside an async action body,
// never at module-evaluation time).
import { usePhotosAlbums } from './albums'

export interface SmartView {
  id: string
  name: string
  description: string
  conds: string[]
  threshold: number
  live: boolean
  includeVideos: boolean
  count: number
  addedThisWeek: number
  seeds: string[]
  median: number
  storageBytes: number
  distribution: number[]
  evaluatedAt: string
  // Present on the wire since the backend's first version (service/smartview.go:23).
  // Carried here from SP15-P2b onward because the Albums page's global sort ranks
  // manual albums and smart albums against each other by creation time.
  createdAt: string
}

export interface SmartViewActivity {
  id: string
  eventType: string
  detail: string
  assetIds: string[]
  occurredAt: string
}

export interface SmartViewPreview {
  count: number
  seeds: string[]
  thresholdActive: boolean
}

export interface CreateSmartViewInput {
  name: string
  // T5 (create dialog) decision: optional, not string — following Vue2 confirmCreate :431
  // `description: this.draft.desc.trim() || undefined` (backend omitempty semantics:
  // omit the field for empty descriptions rather than send empty string). Callers must
  // be able to pass undefined, so this is tightened to optional here.
  description?: string
  conds: string[]
  threshold: number
  live: boolean
  includeVideos: boolean
}

export interface DeletedSmartView {
  sv: SmartView
  index: number
}

const EMPTY_PREVIEW: SmartViewPreview = { count: 0, seeds: [], thresholdActive: true }
// Copied as-is from Vue2 PhotosSmartViewDetail.vue:413-415; do not change these three numbers.
const MATCHED_LIMIT = 60
const RECENT_LIMIT = 12
const ACTIVITY_LIMIT = 10
// Debounce rhythm for refreshPreview, copied as-is from Vue2 PhotosSmartViewsView.vue:368.
const PREVIEW_DEBOUNCE_MS = 300

// Following the pattern in places.ts toPlaceDetail: normalize field-by-field + fallback.
// The distribution validation is **intentionally stricter**, not a copy of Vue2: the true
// source (PhotosSmartViewDetail.vue:316, not PhotosSmartViewsView.vue) is
// `distribution && distribution.length ? … : new Array(10).fill(0)` — keeping any
// non-empty array as-is. Arrays shorter than 10 like `[1,2]` pass straight to the chart.
// Here we change to strict `=== 10` validation: this repo's distribution chart has 10
// fixed bars; wrong-length arrays misalign bars and buckets (bar 3 actually renders
// "bucket 1" data). Intentionally stricter than Vue2 — fall back to all zeroes rather
// than keep copying Vue2's approach of feeding the chart misaligned data.
function toSmartView(raw: unknown): SmartView {
  const r = (raw ?? {}) as Record<string, unknown>
  const distribution = Array.isArray(r.distribution) ? (r.distribution as number[]) : []
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    conds: Array.isArray(r.conds) ? (r.conds as string[]) : [],
    threshold: Number(r.threshold ?? 0),
    live: Boolean(r.live),
    includeVideos: Boolean(r.includeVideos),
    count: Number(r.count ?? 0),
    addedThisWeek: Number(r.addedThisWeek ?? 0),
    seeds: Array.isArray(r.seeds) ? (r.seeds as string[]) : [],
    median: Number(r.median ?? 0),
    storageBytes: Number(r.storageBytes ?? 0),
    distribution: distribution.length === 10 ? distribution : new Array(10).fill(0),
    evaluatedAt: String(r.evaluatedAt ?? ''),
    createdAt: String(r.createdAt ?? ''),
  }
}

function toActivity(raw: unknown): SmartViewActivity {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.id),
    eventType: String(r.eventType ?? ''),
    detail: String(r.detail ?? ''),
    assetIds: Array.isArray(r.assetIds) ? (r.assetIds as unknown[]).map(String) : [],
    occurredAt: String(r.occurredAt ?? ''),
  }
}

export const usePhotosSmartViews = defineStore('photosSmartViews', () => {
  const smartViews = ref<SmartView[]>([])
  // Empty-state gate, following the pattern in places.ts with placesLoaded: set to true
  // only on success path, leave false on failure so it can be retried.
  const listLoaded = ref(false)
  const listLoading = ref(false)

  const matchedAssets = ref<Photo[]>([])
  const recentAssets = ref<Photo[]>([])
  const activity = ref<SmartViewActivity[]>([])
  const detailLoading = ref(false)
  // Sequence race guard for loadDetail, pattern copied from places.ts loadDetail. Three
  // concurrent requests (matchedAssets/recentAssets/activity) share one lock — they are
  // a group of requests triggered by a single "open detail" and should be invalidated as
  // a unit by the next open. Splitting into three locks would be pointless.
  let detailSeq = 0

  const preview = ref<SmartViewPreview>({ ...EMPTY_PREVIEW })
  // Debounce timer and independent seq guard for refreshPreview, both module-level and
  // not in state (pure internal mechanism; views don't need to read them). Independent
  // from detailSeq: real-time preview in create/edit dialogs and three requests on
  // detail page are two completely separate data flows. Sharing one counter would let
  // one side's staleness check bias the other's judgment.
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  let previewSeq = 0

  // SP15-P2a: the excluded list belongs here rather than in the view, alongside the
  // three asset collections this page already reads from the store — splitting one
  // page's data across two owners is what makes staleness bugs possible.
  const excluded = ref<Photo[]>([])
  const excludedLoading = ref(false)
  // Staleness guard for loadExcluded, same shape as detailSeq: switching smart views
  // can leave an older request in flight, and it must not overwrite the newer list.
  let excludedSeq = 0
  // Which view the list currently on screen belongs to. Only used to decide whether a load
  // has to blank the band before awaiting — see loadExcluded.
  let excludedFor = ''
  // Mutual exclusion across the three manual write actions: they all mutate the same
  // membership of the same view, so letting two run at once would race the refetch.
  const assetBusy = ref(false)

  const createBusy = ref(false)
  const patchBusy = ref(false)
  // deleteSmartView and restoreSmartView share one lock — mutually exclusive write
  // operations on the same resource (the smart view's existence in the list). We must
  // not allow a concurrent real delete to scramble state while undoing a delete.
  const deleteBusy = ref(false)
  const duplicateBusy = ref(false)
  const exportBusy = ref(false)

  // byId is this period's core fix (§7e-2 / deviation log 4): Vue2's detail page holds
  // the entire sv object as a prop. Mutations on the list side (UPDATE_SMART_VIEW,
  // DELETE_SMART_VIEW, etc.) only change the array item in state — they don't sync the
  // object reference already held by detail page. After edit/delete, detail page still
  // shows stale data until user navigates. Change: "detail page only stores id, fetches
  // from byId(id) on each render". Single source of data (smartViews array itself)
  // structurally eliminates staleness. Deletion-verification note: the `String(s.id)`
  // layer is defensive — every write path to smartViews.value in the store
  // (fetch/create/update/duplicate) normalizes through toSmartView; id is always a
  // string before landing, so tests dropping this String() won't fail (not a
  // falsifiable deletion test case). Kept to prevent a future write path (e.g. bypassing
  // toSmartView and pushing directly) from silently violating the invariant.
  function byId(id: string): SmartView | null {
    return smartViews.value.find(s => String(s.id) === String(id)) ?? null
  }

  // Following Vue2 fetchSmartViews :998-1005. Set listLoaded = true only on success
  // (using places.ts placesLoaded pattern; leave false on failure for retry).
  // Deviation note: Vue2 has no finally reset of loading (Vue2 store has no loading
  // field at all); we add it here.
  async function fetchSmartViews(): Promise<void> {
    listLoading.value = true
    try {
      const raw = (await service.photos.listSmartViews()) ?? []
      smartViews.value = (raw as unknown[]).map(toSmartView)
      listLoaded.value = true
    } catch (e) {
      console.error('[photos-smartviews] fetchSmartViews', e)
    } finally {
      listLoading.value = false
    }
  }

  // Following Vue2 createSmartView :1013-1025, but **not** copying one deviation
  // (deviation log 4): Vue2 :1018-1021 still `commit('ADD_SMART_VIEW', sv)` in catch —
  // inserting a local object that doesn't exist on the backend (optimistic lie). Page
  // refresh makes it disappear; user thinks they lost a smart view. Change: rethrow
  // and let the view layer catch → toast.
  //
  // fix round 1 · C1 (Critical, real bug, verified against source): id **must be
  // generated by frontend and sent to backend** — contrary to this file's initial
  // implementation ("backend generates id, we don't send it"). Backend `Create`
  // (NimoOS-Photos/service/smartview.go:65-68) on empty id returns nil, ErrInvalidInput
  // → route handler turns into 400. Handler (route/v1/smartviews.go Create) only
  // bind + validates Name, never generates id. Only `newSVID` in the entire repo
  // generates id, called only inside `Duplicate`. Not sending id: on device, clicking
  // "create smart view" returns 400 100% of the time. Change to generate
  // `sv-<uuid>` via `safeRandomUUID()`. (Not `Date.now().toString(36)` — that's
  // Vue2's approach with millisecond precision; two clients creating views in the same
  // millisecond get collisions. UUID actually won't collide.)
  async function createSmartView(input: CreateSmartViewInput): Promise<SmartView | null> {
    if (createBusy.value) return null
    createBusy.value = true
    try {
      const raw = await service.photos.createSmartView({
        id: `sv-${safeRandomUUID()}`,
        name: input.name,
        description: input.description,
        condsRaw: input.conds,
        threshold: input.threshold,
        live: input.live,
        includeVideos: input.includeVideos,
      })
      const created = toSmartView(raw)
      smartViews.value.unshift(created)
      return created
    } catch (e) {
      console.error('[photos-smartviews] createSmartView', e)
      throw e
    } finally {
      createBusy.value = false
    }
  }

  // Following Vue2 updateSmartView :1026-1035. Request body field renamed
  // conds → condsRaw (Vue2 :1027-1028). If response has body, replace entirely with
  // toSmartView (splice preserves order). If no body, merge patch in place — patch uses
  // CreateSmartViewInput field names (conds, not condsRaw), matching SmartView field
  // names, so merge needs no name conversion. Deviation note (same as createSmartView):
  // Vue2 :1032-1033 still `commit` local patch in catch (optimistic lie). We rethrow
  // instead.
  async function updateSmartView(id: string, patch: Partial<CreateSmartViewInput>): Promise<void> {
    if (patchBusy.value) return
    patchBusy.value = true
    try {
      const body: Record<string, unknown> = { ...patch }
      if ('conds' in body) {
        body.condsRaw = body.conds
        delete body.conds
      }
      const res = await service.photos.updateSmartView(id, body)
      const i = smartViews.value.findIndex(s => String(s.id) === String(id))
      if (i === -1) return
      if (res) {
        smartViews.value.splice(i, 1, toSmartView(res))
      } else {
        smartViews.value.splice(i, 1, { ...smartViews.value[i], ...patch })
      }
    } catch (e) {
      console.error('[photos-smartviews] updateSmartView', e)
      throw e
    } finally {
      patchBusy.value = false
    }
  }

  // Following Vue2 deleteSmartView :1036-1046, but **not** copying Vue2 :1042-1043's
  // `return null` after catch — that masks failure (network error / backend reject)
  // as "item was not found in the first place", so view layer can't tell whether to
  // toast. We rethrow instead.
  //
  // fix round 1 · I1 (Important, real bug, reproduced with interleaved test scenario):
  // index **must be recalculated after await**, cannot splice using the index
  // calculated before await. `deleteBusy` only mutexes delete ↔ delete/undo, doesn't
  // block `fetchSmartViews`. If fetchSmartViews reorders/inserts the list while delete
  // is in flight (e.g. another client created a new view that sorts to the front), the
  // pre-await index now points to a different item. We'd delete the wrong one, and the
  // undo payload would point to the wrong item too. Vue2 `photos.js:493-495`
  // DELETE_SMART_VIEW filters by id, naturally immune — the plan's original
  // "calculate index before await" order downgraded id semantics to index semantics.
  // Plan error, not intentional implementation.
  async function deleteSmartView(id: string): Promise<DeletedSmartView | null> {
    if (deleteBusy.value) return null
    // Early exit check: if the item doesn't exist in the local list, don't send a
    // request (handles the "avoid pointless requests" part). Note this index is for
    // early exit only, **cannot** pass it to the splice below — when actually deleting,
    // must recalculate.
    if (smartViews.value.findIndex(s => String(s.id) === String(id)) < 0) return null
    deleteBusy.value = true
    try {
      await service.photos.deleteSmartView(id)
      // Must recalculate after await: fetchSmartViews might have reordered/inserted
      // during in-flight. Splicing with pre-await index would delete someone else.
      // (Vue2 :493 filters by id, doesn't have this trap.)
      const idx = smartViews.value.findIndex(s => String(s.id) === String(id))
      if (idx < 0) return null
      const [sv] = smartViews.value.splice(idx, 1)
      return { sv, index: idx }
    } catch (e) {
      console.error('[photos-smartviews] deleteSmartView', e)
      throw e
    } finally {
      deleteBusy.value = false
    }
  }

  // Following Vue2 restoreSmartView :1047-1058 + RESTORE_SMART_VIEW mutation (:497-498)
  // pattern. **Must pass the original id and cannot wrap with createSmartView()** —
  // intentionally different semantics from createSmartView: both now send non-empty id
  // to backend (backend Create requirement; see C1 note above createSmartView), but
  // **id source differs**. createSmartView is "create new" — generate a fresh random
  // id each time. restoreSmartView is "undo the delete I just did" — semantically
  // restore the same smart view, so backend must keep the **original id**. Otherwise
  // undo produces a new smart view with different id (old stats/activity history all
  // mismatch, even though name/conditions look the same in the UI). So don't wrap with
  // createSmartView() (generates new id each time, can't preserve original id effect);
  // instead call the underlying service.photos.createSmartView directly, explicitly
  // passing payload.sv.id.
  async function restoreSmartView(payload: DeletedSmartView): Promise<void> {
    if (deleteBusy.value) return
    deleteBusy.value = true
    try {
      await service.photos.createSmartView({
        id: payload.sv.id,
        name: payload.sv.name,
        description: payload.sv.description,
        condsRaw: payload.sv.conds,
        threshold: payload.sv.threshold,
        live: payload.sv.live,
        includeVideos: payload.sv.includeVideos,
      })
      const i = Math.max(0, Math.min(payload.index, smartViews.value.length))
      smartViews.value.splice(i, 0, payload.sv)
    } catch (e) {
      console.error('[photos-smartviews] restoreSmartView', e)
      throw e
    } finally {
      deleteBusy.value = false
    }
  }

  // Following Vue2 duplicateSmartView :1059-1069. **Deviation note**: brief original
  // said "unshift into list", but verified against Vue2 :1064-1066 actually does
  // `commit('RESTORE_SMART_VIEW', { sv: copy, index: i + 1 })` — insert right after
  // original, not at front. Not "refetch or unshift" choice, third pattern (brief
  // record incorrect; true source authoritative here). Inserting after original is
  // meaningful UX (copy appears next to original, doesn't jump to front breaking visual
  // continuity). Implement per true source: `findIndex` misses → -1, +1 = 0 → equals
  // unshift, naturally covers "local list doesn't have this item yet" edge case, no
  // extra branch needed.
  async function duplicateSmartView(id: string): Promise<void> {
    if (duplicateBusy.value) return
    duplicateBusy.value = true
    try {
      const raw = await service.photos.duplicateSmartView(id)
      const copy = toSmartView(raw)
      const i = smartViews.value.findIndex(s => String(s.id) === String(id))
      smartViews.value.splice(i + 1, 0, copy)
    } catch (e) {
      console.error('[photos-smartviews] duplicateSmartView', e)
      throw e
    } finally {
      duplicateBusy.value = false
    }
  }

  // SP15-P2b: a manual album turns into a smart view in place. The backend pins every
  // existing member, **deletes the source album**, and hands back the full new smart view,
  // so both stores have to move: the new smart view goes to the head of this list, and the
  // now-deleted album has to leave the albums store.
  //
  // Deviation from Vue2 (939a7d3a:PhotosAlbumsView.vue:728-743): its handler refetched both
  // lists. Two local mutations are strictly cheaper and reach the same end state.
  //
  // The source album MUST be dropped (final fix wave -- the earlier version of this comment
  // argued a remount covers it, which is only true of the *list*): albums.albumsLoaded stays
  // true, and PhotosAlbumDetail.vue:442 skips its own fetch when it is, so one browser Back
  // press after a successful conversion would otherwise land on a fully interactive detail
  // page for an album the server has already deleted -- every action on it 404s.
  //
  // Rethrows on failure (this store's established contract, same as createSmartView):
  // the dialog decides what to show and stays open so the user can retry.
  async function convertFromAlbum(
    albumId: string | number,
    input: { description: string; threshold: number },
  ): Promise<SmartView> {
    const raw = await service.photos.convertAlbumToSmart(albumId, {
      description: input.description,
      threshold: input.threshold,
    })
    const created = toSmartView(raw)
    smartViews.value.unshift(created)
    usePhotosAlbums().dropAlbumLocal(albumId)
    return created
  }

  // SP15-P2b final fix wave: drop a smart view the server no longer has, without a refetch.
  // Exported because the *albums* store needs it -- convertFromSmartView deletes the source
  // smart view server-side. Mutates in place, matching this file's convention throughout
  // (:224/:288/:321/:344 all mutate `smartViews.value` rather than replacing the ref).
  function dropSmartViewLocal(id: string | number): void {
    const idx = smartViews.value.findIndex(s => String(s.id) === String(id))
    if (idx < 0) return
    smartViews.value.splice(idx, 1)
  }

  // Following Vue2 PhotosSmartViewDetail.vue loadDetail :409-423, adding seq race guard
  // (deviation log 9, §7e-7): three Promise.all concurrent requests, both success path
  // and clearing must pass seq gate.
  async function loadDetail(id: string): Promise<void> {
    const mine = ++detailSeq
    detailLoading.value = true
    // Success path also needs to clear old data first — otherwise on second load, the
    // skeleton gate already passed, continues rendering the previous smart view's
    // photos and activity (same defect type as P6b final-review I2; clearing must come
    // before await).
    matchedAssets.value = []
    recentAssets.value = []
    activity.value = []
    try {
      const [all, recent, act] = await Promise.all([
        service.photos.getSmartViewAssets(id, { limit: MATCHED_LIMIT, offset: 0 }),
        service.photos.getSmartViewAssets(id, { limit: RECENT_LIMIT, offset: 0, recent: true }),
        service.photos.getSmartViewActivity(id, ACTIVITY_LIMIT),
      ])
      if (mine !== detailSeq) return
      matchedAssets.value = ((all as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      recentAssets.value = ((recent as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      activity.value = ((act as unknown[]) ?? []).map(toActivity)
    } catch (e) {
      console.error('[photos-smartviews] loadDetail', e)
    } finally {
      if (mine === detailSeq) detailLoading.value = false
    }
  }

  // Refetch one smart view and replace it in the list. Vue 2 needed an in-place
  // field merge here to preserve the object identity its detail page held as a prop
  // (#82's MERGE_SMART_VIEW_STATS). That problem does not exist here: the detail
  // page reads `byId(id)` as a computed, so replacing the array item is enough and
  // both the header and the list card follow automatically.
  //
  // Deliberately swallows its own failure: the caller's write already succeeded, and
  // reporting a stats refresh error as a write error would be a lie.
  async function refreshStats(id: string): Promise<void> {
    try {
      const raw = await service.photos.getSmartView(id)
      if (!raw) return
      const i = smartViews.value.findIndex((s) => String(s.id) === String(id))
      if (i === -1) return
      smartViews.value.splice(i, 1, toSmartView(raw))
    } catch (e) {
      console.error('[photos-smartviews] refreshStats', e)
    }
  }

  // The stats refetch lives inside each of the three write actions rather than at
  // the call sites. Vue 2 put it at the call sites and shipped #82 to fix the one it
  // forgot; keeping it here means a caller cannot forget.
  //
  // The empty-list early return is not defensive padding — the backend rejects an
  // empty assetIds with 400 ("assetIds is required").
  //
  // ★ Final-review finding 5: "nothing was asked for" and "this call was dropped" must not
  // return the same value. All three actions used to answer 0 (or zeroes) for both, so a
  // call swallowed by `assetBusy` still looked like a completed write to the view — it
  // announced "pinned 0 photos to this view" and closed the picker, discarding a selection
  // that had never been sent anywhere. `null` is the dropped-because-busy sentinel and is
  // deliberately distinct from the zero an empty list still returns; every caller must treat
  // it as "no result" rather than as a count. The busy check therefore comes *first* — with
  // the two guards merged it is impossible to tell which one fired.
  async function pinAssets(id: string, assetIds: string[]): Promise<number | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.pinSmartViewAssets(id, assetIds)
      const added = typeof res.added === 'number' ? res.added : 0
      await refreshStats(id)
      return added
    } catch (e) {
      console.error('[photos-smartviews] pinAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Removal is tiered on the backend — a pinned row is deleted, an automatically
  // matched row is flagged excluded — so both counters come back and the caller
  // needs both to phrase its confirmation.
  // `null` when dropped because another write is in flight — see pinAssets above.
  async function removeAssets(id: string, assetIds: string[]): Promise<{ unpinned: number; excluded: number } | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return { unpinned: 0, excluded: 0 }
    assetBusy.value = true
    try {
      const res = await service.photos.removeSmartViewAssets(id, assetIds)
      const out = {
        unpinned: typeof res.unpinned === 'number' ? res.unpinned : 0,
        excluded: typeof res.excluded === 'number' ? res.excluded : 0,
      }
      await refreshStats(id)
      return out
    } catch (e) {
      console.error('[photos-smartviews] removeAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // `null` when dropped because another write is in flight — see pinAssets above.
  async function restoreAssets(id: string, assetIds: string[]): Promise<number | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.restoreSmartViewAssets(id, assetIds)
      const restored = typeof res.restored === 'number' ? res.restored : 0
      await refreshStats(id)
      return restored
    } catch (e) {
      console.error('[photos-smartviews] restoreAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Failure is swallowed rather than rethrown: the excluded band is a secondary
  // section, and an error there must not take down the matched grid above it.
  //
  // ★ Final-review finding 6: this used to blank the list unconditionally before awaiting,
  // so a transient 500 made the whole "excluded (N)" band disappear — the user was told
  // the exclusions were gone when they were still on the server, and nothing said
  // otherwise. The blank is now conditional on the id actually changing, which is the
  // only case it was ever needed for (showing view A's exclusions under view B's heading,
  // the same rule loadDetail states above). Refetching the *same* view keeps the list on
  // screen until the new one lands, so a failure leaves the band exactly as it was.
  //
  // This does not weaken the staleness guard: `excludedSeq` is what stops a late-landing
  // older response from overwriting a newer one, and it is untouched — the two mechanisms
  // answer different questions ("is this response still wanted" vs "may the previous
  // view's data stay on screen") and do not conflict.
  async function loadExcluded(id: string): Promise<void> {
    const mine = ++excludedSeq
    excludedLoading.value = true
    if (excludedFor !== String(id)) {
      excluded.value = []
      excludedFor = String(id)
    }
    try {
      const raw = await service.photos.getSmartViewExcluded(id)
      if (mine !== excludedSeq) return
      excluded.value = (raw ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
    } catch (e) {
      console.error('[photos-smartviews] loadExcluded', e)
    } finally {
      if (mine === excludedSeq) excludedLoading.value = false
    }
  }

  // Following Vue2 refreshPreview :366-382, rhythm (300ms debounce) copied as-is; seq
  // guard is new (deviation log 9). thresholdActive validation copied from Vue2 :378:
  // `!res || res.thresholdActive !== false` (missing field treated as active). Failure
  // only console.error, doesn't clear preview — copying Vue2's catch behavior; keeping
  // the previous count on failure is better than flashing to zero.
  function refreshPreview(input: Omit<CreateSmartViewInput, 'name' | 'live'>): void {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      const mine = ++previewSeq
      service.photos.previewSmartView({
        condsRaw: input.conds,
        description: input.description,
        threshold: input.threshold,
        includeVideos: input.includeVideos,
      }).then((res: unknown) => {
        if (mine !== previewSeq) return
        const r = res as { count?: number, seeds?: string[], thresholdActive?: boolean } | undefined
        preview.value = {
          count: r?.count ?? 0,
          seeds: r?.seeds ?? [],
          thresholdActive: !r || r.thresholdActive !== false,
        }
      }).catch((e: unknown) => {
        if (mine !== previewSeq) return
        console.error('[photos-smartviews] refreshPreview', e)
      })
    }, PREVIEW_DEBOUNCE_MS)
  }

  // T5 (create dialog) new addition, controller authorized (brief § "hard facts brought
  // by preceding task" 2): Vue2 has no equivalent (relies on page beforeDestroy
  // clearTimeout; dialog is just v-if in page, component doesn't truly unmount).
  // New-UI's create dialog is permanently mounted + prop-controlled visibility. On
  // close, if the 300ms debounce timer hasn't fired or request is in flight, not
  // cleaning up causes: ① unfired timer silently sends an unneeded request after dialog
  // closes; ② in-flight request returns and overwrites preview with "this closed edit's"
  // result, polluting next open's display (may be different draft). Pattern copied from
  // places.ts clearDetail: increment previewSeq so any in-flight response fails the
  // `mine !== previewSeq` check in callback and is discarded (no separate "cancelled"
  // flag needed), also clear the unfired timer.
  function cancelPreview(): void {
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
    previewSeq += 1
  }

  // ZIP export doesn't live in store (it's pure browser download: fetch with
  // Authorization header + blob + <a download>, implemented by view layer T8; see
  // plan Global Constraints §7e-1). Here we only trigger backend export generation
  // and rethrow on failure, letting view layer split toast messaging.
  async function exportAlbum(id: string): Promise<void> {
    if (exportBusy.value) return
    exportBusy.value = true
    try {
      await service.photos.exportSmartViewAlbum(id)
    } catch (e) {
      console.error('[photos-smartviews] exportAlbum', e)
      throw e
    } finally {
      exportBusy.value = false
    }
  }

  function __resetForTest(): void {
    smartViews.value = []
    listLoaded.value = false
    listLoading.value = false
    matchedAssets.value = []
    recentAssets.value = []
    activity.value = []
    detailLoading.value = false
    excluded.value = []
    excludedLoading.value = false
    excludedFor = ''
    assetBusy.value = false
    // Intentionally not resetting detailSeq/previewSeq: if an older request sent
    // before __resetForTest is still in flight, resetting seq back to 0 would make
    // the next call after reset land on the same mine value, creating an alias
    // collision with the old request that should be discarded (same reason as
    // places.ts __resetForTest).
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
    preview.value = { ...EMPTY_PREVIEW }
    createBusy.value = false
    patchBusy.value = false
    deleteBusy.value = false
    duplicateBusy.value = false
    exportBusy.value = false
  }

  return {
    smartViews, listLoaded, listLoading,
    matchedAssets, recentAssets, activity, detailLoading,
    excluded, excludedLoading, assetBusy,
    preview,
    createBusy, patchBusy, deleteBusy, duplicateBusy, exportBusy,
    byId,
    fetchSmartViews, createSmartView, updateSmartView, deleteSmartView, restoreSmartView,
    duplicateSmartView, convertFromAlbum, dropSmartViewLocal,
    loadDetail, refreshPreview, cancelPreview, exportAlbum,
    pinAssets, removeAssets, restoreAssets, loadExcluded,
    __resetForTest,
  }
})
