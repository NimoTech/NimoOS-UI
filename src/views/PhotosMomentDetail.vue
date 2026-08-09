<script setup lang="ts">
// SP15-P1-T7/T8: PhotosMomentDetail.vue — the moment detail page (route /photos/moments/:id).
// Ported section by section from Vue 2 NimoOS-UI 899af59b:src/views/Photos/PhotosMomentDetail.vue
// (template :1-121, computed :203-291, distStyle :418-421) and photos-smartview.scss.
// It reuses the sv-detail-* two-column skeleton already established by
// PhotosSmartViewDetail.vue — Vue 2 did the same, its top bar is literally commented
// "same as sv-detail-bar". Scoped styles do not cross component boundaries in this repo, so the
// handful of sv-* rules needed here are restated (same technique as MomentCard.vue, which
// restates SmartViewCard.vue's rules).
//
// ★★★ The structural difference from Vue 2 — read this before changing anything ★★★
// In Vue 2 this is an inline child component of PhotosSmartViewsView and the moment object
// arrives as a prop, so it has no "what if that id does not exist" path and never needs one.
// Here it is a real route: the user can edit the address bar, follow a stale bookmark, or deep
// link while the Moments band is hidden. And the backend has **no GET /moments/:id**
// (NimoOS-Photos/route/router.go only has GET /moments for the whole list and
// GET /moments/:id/assets), so a cold deep link can only fetch the full list and look the id up
// in it — that is where ensureLoaded() + byId() come from.
//
// Deviations from the Vue 2 original:
//  1) The "not found" empty state is new in New-UI (reason above); Vue 2 has no counterpart.
//     The loading gate ahead of it is new for the same reason — with no moment in the store yet
//     there is nothing to render, and a blank flash is not acceptable on a route.
//  2) The backend's momentResponse carries **no updated_at** (verified against
//     NimoOS-Photos/route/v1/moments.go:39-73), so Vue 2's `lastUpdated` has always rendered
//     '—' and its relTime branch has never once executed. The rendered result is reproduced
//     exactly — a dash — but the dead formatting branch is not ported. The field stays in the
//     Moment type so no type change is needed if the backend ever adds it.
//  3) typeLabel resolves to a translated string here rather than returning a bare English key
//     for the template to feed to `$t` (Vue 2 :215-221 + `{{ $t(typeLabel) }}`). It reuses the
//     photosMoType{Trip,Pets,Family,Theme} keys MomentCard.vue already added in T4 — same
//     branch order, same wording, no new keys, no cross-file import (Vue 2 also kept two
//     independent copies of this ladder on purpose).
//  4) Every toLocale*String call is handed an explicit BCP-47 tag derived from the i18n locale.
//     Vue 2 did this for the dates but left the counts on a bare `toLocaleString()` (browser
//     locale, unpredictable); here both follow the app's language setting. This repo's locales
//     are `zh_cn`/`en_us`, which are not valid BCP-47 — passing one raw throws a RangeError, so
//     the underscore must be replaced (precedent: SmartViewCard.vue).
//  5) The action bar (Add photos / Select / Save as Album / more menu), the two photo grids, the
//     selection bar, the delete confirmation and the library picker are NOT here: they are
//     Tasks 8/9/10. The `featuredAssets` / `allAssets` / `allLoading` / `manualIds` / `places`
//     state they need is already loaded and exposed by this task, since Stats and the By-month
//     histogram read it too. Consequently Vue 2's `document.mousedown` listener that closes the
//     more menu is also deferred to Task 10 — there is no menu here yet to close.
//     [T8 update: the two photo grids and the Select toggle in the action bar are now here —
//     see deviations 6-9 below. Add photos / Save as Album / the more menu / delete confirmation
//     / library picker are still Tasks 9/10, so the document.mousedown listener stays deferred.]
//
// Fix round 1 added three more:
// 10) The two asset requests fail independently (see load()). An earlier revision put them in
//     one Promise.all under one catch, which discarded an already-resolved detail response
//     whenever the all-assets one rejected. Vue 2 runs them as two separate statements with two
//     try/catch blocks (:307-338) and never loses one to the other; this restores that.
// 11) Switching :id clears the previous moment's assets before refetching. Vue 2's detail
//     component was v-if'd by its parent, so a switch remounted it and reset everything for
//     free. A route does not remount on a params-only change, so the reset is explicit.
// 12) A failed list fetch renders its own state, separate from "not found". Vue 2 could not
//     reach this page without a moment object, so it had neither state. Having only one of them
//     meant a network blip told the user their moment had been deleted — wrong, and stated with
//     confidence. Needs `listError` on the store, added in the same round.
//
// Task 8 (the two photo grids + selection state) added four more:
//  6) Only the Select toggle joins `.sv-actions` here. Vue 2 :30-45 has four buttons in that bar
//     (Add photos / Select / Save as Album / more menu); Add photos needs the library picker
//     (Task 10) and Save as Album/more-menu need the export/delete wiring (Task 9/10) — adding
//     inert buttons for those now would just mean re-touching this exact markup twice.
//  7) The Select/Cancel button text reuses `photosPersonSelect`/`photosCancel` verbatim rather
//     than adding a fresh pair of keys for the same two words Vue 2 uses (`$t('Select')`/
//     `$t('Cancel')`) — same cross-file wording reuse as deviation 3's typeLabel ladder.
//  8) The pin badge's icon is the same outline pin path already used for the header's place
//     condition (`M12 21s7-6.3…`/`circle r=2.5`, scaled to r=2.2), not Vue 2's separate filled-
//     teardrop `<photos-icon name="pin">` glyph (PhotosIcon.vue:172-174) — one pin shape per
//     file rather than two, both render as the same recognisable map pin.
//  9) The selection bar (Vue 2 :127-130) renders only the "{n} selected" count here. The
//     "Remove from this moment" button beside it calls `excludeMomentAssets` — that request and
//     its toast are Task 9's bulk-removal wiring, not added yet.
//     [T9 update: the removal button is now there, and so is Add photos + the library picker.
//     Save as Album / the more menu / the delete confirmation are still Task 10, so the
//     document.mousedown listener stays deferred.]
//
// Task 9 (add / remove photos) added three more:
// 13) Vue 2 keeps its own `momentAssetCount` copy and emits `asset-count-changed` up to the list
//     view after every write (:346-349,:370-372). Here both views read the same store entry and
//     store.pin/exclude write the response's asset_count straight into it (moments.ts:239-257),
//     so there is nothing to mirror and no event to port.
// 14) The library picker's *title* reuses `photosAlbumPickerTitle` instead of getting a moment-
//     specific key. Vue 2 feeds one and the same 'Add photos to {name}' string to both pickers
//     (:144), so reuse is what reproduces it — the key's album-flavoured name is history from
//     when this repo only had the album caller (the component itself carries the same note).
// 15) Vue 2's picker closes itself by awaiting the parent's confirm handler; Vue 3's emit cannot
//     return that promise, so this page closes the picker on success and leaves it open on
//     failure — the same two outcomes the user saw before. See AlbumLibraryPicker.vue's header.
//
// Task 10 (save as album / delete moment) added the last four:
// 16) The document mousedown listener that closes the more menu was deliberately deferred all
//     the way from Task 7 (no menu existed yet to close, and installing a listener whose body
//     could never run would just be dead code — see this file's own history above). This task
//     is the one that finally owns both halves: registered in onMounted, removed in
//     onBeforeUnmount. Vue 2 :295-305 does the same (mounted/beforeDestroy pair).
// 17) A failed delete shows its message inline inside the confirmation dialog (deleteError),
//     not as a toast. Vue 2 :396-401 closes the dialog and fires a toast — for the second or so
//     before that toast text registers, the screen shows no dialog and nothing else says the
//     delete failed, which reads as "it worked". The answer to a button press belongs next to
//     that button and should not time out, so this repo answers in place and keeps the dialog
//     open instead.
// 18) The 409 (album name already in use) case on save-as-album gets its own wording
//     (photosMoAlbumExists) rather than the generic photosMoAlbumFailed — the same branch
//     Vue 2 :421-423 already has, kept.
// 19) Six of the brief's thirteen proposed i18n keys turned out, once checked against this
//     task's own reuse rule (deviation 7: check for an existing key before adding one), to
//     already exist under other names — every one an exact match of Vue 2's own zh_CN.json
//     copy for this feature:
//       photosMoOpen         → photosPlacesToastOpen    ('打开' / 'Open' — same toast-action use,
//                               PhotosPlaces.vue:306)
//       photosMoPhotosStay   → photosSvPhotosStayLibrary ('照片仍保留在你的图库中' — the more
//                               menu's own delete-item description, word for word)
//       photosMoDeleteTitle  → photosSvDeleteName        ('Delete "{name}"?', same {name} param)
//       photosMoDeleteFailed → photosSvDeleteFailed      ('删除失败')
//       photosMoCancel       → photosCancel              ('取消') — the same reuse
//                               PhotosSmartViewDetail.vue's own confirm dialog already makes
//       photosMoDelete       → photosDelete               ('删除') — likewise, for its Delete button
//     The remaining seven (photosMoSaveAsAlbum/photosMoAlbumCreated/photosMoAlbumExists/
//     photosMoAlbumFailed/photosMoDeleteMoment/photosMoDeleteBody/photosMoDeleted) are
//     genuinely new — none of the existing keys carry this wording. Separately, Vue 2's own
//     zh_CN.json (899af59b:src/assets/lang/zh_CN.json:1960) translates "An album with this name
//     already exists" as '已有同名相册' — it does not contain the substring '已存在'; a test
//     asserting that substring would be asserting a mistranslation, not this feature's real
//     Chinese copy, so the test here asserts '已有同名' instead.
//
// ── How this page reports failures ───────────────────────────────────────────────────────
// Four write paths and the list load answer failures in three different idioms, and which one
// applies is a property of *where the user's attention already is*, not of the request:
//   · toast, danger tier — pin (Add photos), exclude (Remove from this moment), export
//     (Save as Album). The control that started it is in the page chrome and stays put, so a
//     transient banner is enough and nothing on screen has to make room for the message.
//   · inline, inside the dialog — delete (deleteError, deviation 17). The user is inside a
//     modal they must answer; the reply belongs next to the button they just pressed, must
//     not time out, and must not be delivered by a toast the dismissed modal would have
//     covered.
//   · page state with a retry — the moment list itself (loadFailed + `retry`, deviation 12).
//     There is no content to put a message beside: the whole page is the failure, so the page
//     becomes the message and carries its own way out.
// A new write path should pick by that rule rather than by copying whichever neighbour is
// nearest in the file.
//
// The final whole-branch review added three more:
// 20) allLoading is raised *before* `await store.ensureLoaded()`, matching Vue 2's loadAll()
//     (:292-293, where it is the first statement). It is still only ever *cleared* under the
//     epoch check. See load().
// 21) The :id watcher resets the interaction flags, not only the four asset fields — with the
//     write consequence being that a selection carried across the change would target the new
//     moment's exclude endpoint with the old moment's asset ids. See the watcher.
// 22) doDelete has a re-entrance guard (`deleting`), which Vue 2 did not need because it
//     closes the dialog before the request; deviation 17 keeps the dialog open and thereby
//     creates the double-click window. The same ref is the confirm button's :disabled.
//     Folded in with it: the success path now closes the dialog explicitly instead of relying
//     on router.push unmounting the page — same as Vue 2 :388 and PhotosSmartViewDetail.vue:332.
// 23) Save as Album carries Vue 2's `data-primary="true"` and an accent fill again (it had
//     been ported as a plain .sv-action-btn, reading as a third neutral chip next to
//     "Add photos" and "Select"). Substitute rule and specificity note at the CSS.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import AlbumLibraryPicker from '../photos/components/AlbumLibraryPicker.vue'
import { usePhotosMoments, type MomentMember, type MomentPlace } from '../photos/stores/moments'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { useToast } from '../stores/toast'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const store = usePhotosMoments()
const lightbox = useLightbox()
const toast = useToast()

/** The placeholder every empty key/value cell falls back to (Vue 2 used this same em dash
 *  literal inline in five places). */
const DASH = '—'

const momentId = computed(() => String(route.params.id ?? ''))
const moment = computed(() => store.byId(momentId.value))
// The three no-content outcomes are mutually exclusive and all require `!moment`, so a moment
// we do hold is always rendered — even if a later list refresh failed underneath it.
const loadFailed = computed(() => store.listLoaded && !moment.value && store.listError)
const notFound = computed(() => store.listLoaded && !moment.value && !store.listError)

const featuredAssets = ref<Photo[]>([])
const allAssets = ref<Photo[]>([])
const allLoading = ref(false)
const manualIds = ref<Set<string>>(new Set())
const places = ref<MomentPlace[]>([])

// BCP-47 tag for the Intl APIs — `zh_cn` / `en_us` are not valid tags (see deviation 4).
const localeTag = computed(() => locale.value.replace('_', '-'))
function fmtNum(n: number): string {
  return n.toLocaleString(localeTag.value)
}

// Staleness guard (plan Global Constraints §6): switching :id can leave an older request in
// flight that resolves after the newer one and clobbers it.
let loadEpoch = 0

async function load(): Promise<void> {
  const epoch = ++loadEpoch
  // Raised before the await, as Vue 2's loadAll() does (:292-293, `this.allLoading = true` is
  // its first statement). Raising it only after ensureLoaded() resolved left a window on the
  // one path where ensureLoaded() actually awaits something *and* the moment is already
  // known — returning to the smart-views page (whose onMounted refetches the list) and
  // opening a moment straight away: listLoaded is true, so the header renders with the real
  // count while the in-flight list request is awaited, and the grid says "this moment has no
  // photos yet" for the whole round trip before "Loading…" ever appears. See deviation 20.
  allLoading.value = true
  await store.ensureLoaded()
  // Cleared only under the epoch check, in both exits as well as at the bottom: a newer load
  // owns the flag from the moment it bumps loadEpoch, and clearing it from an older one would
  // blank the newer load's "Loading…" state.
  if (epoch !== loadEpoch) return
  if (!moment.value) {
    allLoading.value = false
    return
  }
  const id = momentId.value
  // Two independently failable requests, each with its own catch and its own epoch check.
  // The T3 store rethrows where Vue 2's equivalents swallowed and toasted internally, so the
  // catch lives here now — but it has to stay per-request: a single Promise.all + single catch
  // throws away an already-resolved detail response just because the all-assets one rejected,
  // blanking the Featured count, About→Place and manualIds for no reason. Vue 2 never did that;
  // its loadFeatured() and loadAll() are two separate statements with two try/catch blocks
  // (899af59b:PhotosMomentDetail.vue:307-338). See deviation 10.
  const detailDone = store.loadDetail(id).then(
    (detail) => {
      if (epoch !== loadEpoch) return
      featuredAssets.value = detail.assets
      manualIds.value = new Set(detail.members.filter((m: MomentMember) => m.manual).map((m) => m.assetId))
      places.value = detail.places
    },
    (e: unknown) => { console.error('[photos-moments] loadDetail', e) },
  )
  const allDone = store.loadAll(id).then(
    (all) => {
      if (epoch !== loadEpoch) return
      allAssets.value = all
    },
    (e: unknown) => { console.error('[photos-moments] loadAll', e) },
  )
  // Neither handler can reject, so this settles once both are done either way.
  await Promise.all([detailDone, allDone])
  if (epoch === loadEpoch) allLoading.value = false
}

/** The error state's only way out. ensureLoaded() would short-circuit here (listLoaded is
 *  already true), so the list has to be refetched explicitly before reloading the page's data. */
async function retry(): Promise<void> {
  await store.fetchMoments()
  await load()
}

onMounted(load)
// Changing only the params does not remount — the watcher is mandatory, writing this in
// onMounted alone is a known recurring defect in this repo.
watch(momentId, () => {
  // Drop the previous moment's assets first: they are keyed to the old id, and leaving them up
  // shows one moment's photos, Featured count and Place under another moment's title until the
  // new responses land. Vue 2 could not hit this — its detail component was v-if'd, so switching
  // moments remounted it and reset everything. Ours does not remount (that is the whole point of
  // the watcher), so the reset has to be explicit. See deviation 11.
  featuredAssets.value = []
  allAssets.value = []
  manualIds.value = new Set()
  places.value = []
  // Deviation 21: the interaction flags are keyed to the old moment just as the assets are.
  // `selecting`/`selectedIds` are the ones with a write consequence — removeSelected() reads
  // momentId.value at call time, so a selection carried across an :id change would send
  // moment A's asset ids to moment B's exclude endpoint, under a bar reading "N selected"
  // over photos that are no longer on screen. `pickerOpen` is the same story from the other
  // direction (the picker's already-in set comes from the previous moment's members); the
  // rest are cosmetic but belong to the same "nothing on screen came from the old id" rule.
  // `deleting` is reset too: it is a guard against consecutive presses of one button for one
  // moment, which an :id change ends — leaving it up would only disable the new moment's
  // Delete button for the duration of an unrelated in-flight request, and its own `finally`
  // still runs either way.
  selecting.value = false
  selectedIds.value = []
  pickerOpen.value = false
  moreOpen.value = false
  confirmDeleteOpen.value = false
  deleteError.value = ''
  exporting.value = false
  deleting.value = false
  void load()
})

// ── computed, ported one by one from Vue 2 :203-291 ────────────────────────────────────────
const momentAssetCount = computed(() => moment.value?.assetCount ?? 0)

// Same ladder and same order as MomentCard.vue:54-60 (Vue 2 kept two independent copies of it
// too — :215-221 here and MomentCard.typeLabel in the list view).
const typeLabel = computed(() => {
  const key = moment.value?.recipeKey || ''
  if (key.startsWith('trip')) return t('photosMoTypeTrip')
  if (key.includes('pets')) return t('photosMoTypePets')
  if (key.includes('family')) return t('photosMoTypeFamily')
  return t('photosMoTypeTheme')
})

// Deviation 2: constant by construction. momentResponse has no updated_at, so this is the exact
// result Vue 2 renders too — without carrying a relTime branch that can never be reached.
const lastUpdated = DASH

// Time window: with both ends present (trip-style moments) show a date range; without them
// (theme-style moments) fall back to the existing subtitle, then to the placeholder.
const timeWindowLabel = computed(() => {
  const m = moment.value
  if (!m) return DASH
  if (!m.timeFrom) return m.subtitle || DASH
  const from = new Date(m.timeFrom)
  const to = m.timeTo ? new Date(m.timeTo) : from
  const fmt = (d: Date): string =>
    d.toLocaleDateString(localeTag.value, { month: 'short', day: 'numeric', year: 'numeric' })
  const fromStr = fmt(from)
  const toStr = fmt(to)
  return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`
})

const spanDays = computed<number | null>(() => {
  const m = moment.value
  if (!m || !m.timeFrom || !m.timeTo) return null
  const from = new Date(m.timeFrom).getTime()
  const to = new Date(m.timeTo).getTime()
  return Math.max(1, Math.round((to - from) / 86400000) + 1)
})
const spanLabel = computed(() => (spanDays.value != null ? t('photosMoSpanDays', { n: spanDays.value }) : DASH))

// Month buckets: the full asset list dropped into "YYYY-MM" keys, ascending. Drives the sidebar
// histogram; the first and last months label its x-axis.
interface MonthBucket { key: string; count: number; label: string }
const monthBuckets = computed<MonthBucket[]>(() => {
  if (!allAssets.value.length) return []
  const map = new Map<string, number>()
  for (const p of allAssets.value) {
    if (!p.takenAt) continue
    const d = new Date(p.takenAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1)
        .toLocaleDateString(localeTag.value, { month: 'short', year: 'numeric' })
      return { key, count, label }
    })
})
const distMax = computed(() => Math.max(1, ...monthBuckets.value.map((b) => b.count)))
function distStyle(b: MonthBucket, i: number): { height: string; opacity: number } {
  const n = Math.max(1, monthBuckets.value.length - 1)
  return { height: `${(b.count / distMax.value) * 100}%`, opacity: 0.4 + (i / n) * 0.5 }
}

// About → Place: `places` (already sorted by frequency DESC by the backend) takes its top three
// names joined with " · ", plus "+{n}" for whatever is left over; when it is empty fall back to
// the single moment.place; with neither, the row still renders and shows the placeholder — it is
// never hidden outright, matching the Type/Time rows and the rest of this area's key/value rows.
const placesLabel = computed(() => {
  const list = places.value
  if (list.length) {
    const top = list.slice(0, 3).map((p) => p.name)
    const rest = list.length - top.length
    return rest > 0 ? `${top.join(' · ')} +${rest}` : top.join(' · ')
  }
  return moment.value?.place || DASH
})
// Hover hint: the complete place list with counts, e.g. "Bozeman (323) · Rexburg (76) · …".
// With no places there are no counts to hint at, so no title is attached.
const placesTitle = computed(() =>
  places.value.length ? places.value.map((p) => `${p.name} (${p.count})`).join(' · ') : '',
)

function backToAll(): void {
  void router.push('/photos/smart-views')
}

// ── SP15-P1-T8: selection state, consumed by Task 9's bulk removal ─────────────────────────
// Ported from Vue2 :98/:112-121 (selecting/selectedIds + toggleSelecting/toggleSelect/
// onTileClick). Photo.id is `string | number` (assetToPhoto.ts:268); selectedIds is kept as
// string[] and every comparison goes through String() so a numeric id from an older backend
// still compares equal to itself.
const selecting = ref(false)
const selectedIds = ref<string[]>([])

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selectedIds.value = []
}
function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}
// Vue2 :114-117: selection mode suppresses the lightbox — a tap either selects or opens,
// never both. `list` is whichever grid the tile came from (Featured or All), matching
// Vue2's own per-section list argument (:57/:71 pass `featuredAssets`/`allAssets`
// respectively) so paging through the lightbox from a Featured tile stays inside the
// Featured subset rather than jumping into the full list.
function onTileClick(p: Photo, list: Photo[]): void {
  if (selecting.value) toggleSelect(String(p.id))
  else lightbox.openAt(p, list)
}

// ── SP15-P1-T9: add photos (pin) / remove photos (exclude) ────────────────────────────────
// Ported from Vue2 :340-381. The two store calls throw where Vue 2's swallowed and toasted
// internally (moments.ts file-header item 4), so the user-facing half lives here.
const pickerOpen = ref(false)
const pinning = ref(false)

// Vue2 :202 memberIds — "already in" for the picker is the moment's full member list, which is
// exactly what the All photos grid holds. String()-normalised because Photo.id is
// `string | number` and the picker compares against String(timelinePhoto.id).
const memberIds = computed(() => new Set(allAssets.value.map((p) => String(p.id))))

async function onPickPhotos(ids: Array<string | number>): Promise<void> {
  if (pinning.value) return
  pinning.value = true
  const assetIds = ids.map((id) => String(id))
  try {
    await store.pin(momentId.value, assetIds)
    toast.show(t('photosMoAddedN', { n: assetIds.length }))
    // Success closes the panel; a failure leaves it up with the selection intact so the same
    // picked photos can be resubmitted (deviation 15).
    pickerOpen.value = false
    await load()
  } catch (e) {
    console.error('[photos-moments] pin', e)
    toast.show(t('photosMoAddFailed'), 2500, 'danger')
  } finally {
    pinning.value = false
  }
}

// Re-entrance guard: Vue 2 has none (:361), and double-clicking the button there fires two
// concurrent excludes for the same ids. Not copied — this repo already made the same correction
// on PhotosAlbumDetail.vue's `removing` flag (its review finding "Minor 6"), and the port
// discipline is "the interface 1:1, the logic correct".
const removing = ref(false)

async function removeSelected(): Promise<void> {
  const ids = selectedIds.value.slice()
  if (!ids.length || removing.value) return
  removing.value = true
  try {
    await store.exclude(momentId.value, ids)
    toast.show(t('photosMoRemovedN', { n: ids.length }))
    // Cleared on success only — Vue2 :386-387 does the same, and it matters: after a failure the
    // user still has their selection and can press the button again.
    selecting.value = false
    selectedIds.value = []
    await load()
  } catch (e) {
    console.error('[photos-moments] exclude', e)
    toast.show(t('photosMoRemoveFailed'), 2500, 'danger')
  } finally {
    removing.value = false
  }
}

// ── SP15-P1-T10: save as album (export) / delete moment ──────────────────────────────────
// Ported from Vue2 :20-22 (Save as Album button), :29-45 (more menu + its one item), :295-305
// (document mousedown closes the more menu — the listener Task 7 deliberately deferred, see
// file-header deviation 16), :138-152 (delete confirm dialog) and :406-436 (saveAsAlbum /
// askConfirmDelete / doDelete).
const exporting = ref(false)
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
const deleteError = ref('')
// Deviation 22: the one re-entrance guard Vue 2 genuinely did not need. Its doDelete closes
// the dialog *before* the request (:388), so the button is gone before a second press can
// land; this port deliberately keeps the dialog open on failure (deviation 17), and that is
// exactly what opens the double-click window. Doubles as the confirm button's :disabled, so
// the pending feedback the dialog would otherwise have lost comes back with it.
const deleting = ref(false)
const moreWrapRef = ref<HTMLElement | null>(null)

async function saveAsAlbum(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const data = await store.exportAlbum(momentId.value)
    const name = data.name || moment.value?.title || ''
    const count = data.count ?? 0
    toast.show(t('photosMoAlbumCreated', { name, count }), 5000, {
      // Reuses the existing toast-open action label rather than adding a new key for the same
      // one word — see file-header deviation 19.
      label: t('photosPlacesToastOpen'),
      onClick: () => { void router.push('/photos/albums/' + String(data.albumId ?? '')) },
    })
  } catch (e) {
    console.error('[photos-moments] exportAlbum', e)
    const status = (e as { response?: { status?: number } })?.response?.status
    // Deviation 18: the 409 (name clash) case gets its own wording, not the generic failure.
    toast.show(status === 409 ? t('photosMoAlbumExists') : t('photosMoAlbumFailed'), 2500, 'danger')
  } finally {
    exporting.value = false
  }
}

// Debt from Task 7 (file-header deviation 16): only now does the more menu exist to close, so
// the listener is finally installed here — with its teardown, not left dangling past unmount.
function onDocumentMouseDown(e: MouseEvent): void {
  if (!moreOpen.value) return
  const wrap = moreWrapRef.value
  if (wrap && !wrap.contains(e.target as Node)) moreOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))

function openDeleteConfirm(): void {
  moreOpen.value = false
  deleteError.value = ''
  confirmDeleteOpen.value = true
}
function closeDeleteConfirm(): void {
  confirmDeleteOpen.value = false
  deleteError.value = ''
}

async function doDelete(): Promise<void> {
  if (deleting.value) return
  deleting.value = true
  deleteError.value = ''
  const name = moment.value?.title || ''
  try {
    await store.remove(momentId.value)
    // Closed here rather than left to the page unmounting under router.push: the dialog's own
    // state should not depend on a navigation it does not control, which is also what Vue 2
    // (:388) and PhotosSmartViewDetail.vue:332 both do unconditionally.
    confirmDeleteOpen.value = false
    toast.show(t('photosMoDeleted', { name }))
    void router.push('/photos/smart-views')
  } catch (e) {
    // Deviation 17: the failure lives inline in the dialog, not a toast — see file-header note.
    // Vue2 :433-435 closes the dialog and toasts instead; that reads as "it worked" for the
    // second or so before the toast text registers. This repo keeps the dialog open and answers
    // right next to the button that was just pressed.
    console.error('[photos-moments] deleteMoment', e)
    deleteError.value = t('photosSvDeleteFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AreaShell :title="moment ? moment.title : t('photosMoBackToAll')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Gate 1: the list has not arrived yet (New-UI only — Vue 2 always had the object). -->
        <div v-if="!store.listLoaded" class="mo-skeleton" data-test="mo-skeleton">
          <div class="mo-skel-bar" />
          <div class="mo-skel-header" />
        </div>

        <!-- Gate 2: the list request failed, so we cannot say anything about this id. Distinct
             from gate 3 on purpose — saying "this moment no longer exists" after a network blip
             is confidently wrong (deviation 12). -->
        <div v-else-if="loadFailed" class="mo-not-found" data-test="mo-load-failed">
          <div class="mo-not-found-title">{{ t('photosMoLoadFailed') }}</div>
          <button
            type="button" class="mo-not-found-back" data-test="mo-load-failed-retry"
            @click="retry"
          >{{ t('photosRetry') }}</button>
        </div>

        <!-- Gate 3: the list arrived clean but byId found nothing (deviation 1). -->
        <div v-else-if="notFound" class="mo-not-found" data-test="mo-not-found">
          <div class="mo-not-found-title">{{ t('photosMoNotFound') }}</div>
          <button
            type="button" class="mo-not-found-back" data-test="mo-not-found-back"
            @click="backToAll"
          >{{ t('photosMoBackToAll') }}</button>
        </div>

        <!-- Gate 4: the real content. `v-else-if="moment"` rather than a bare `v-else`: gates 1
             to 3 have already excluded every other case, so the two are equivalent at runtime,
             but only the explicit test narrows `moment` from `Moment | undefined` to `Moment` for
             vue-tsc. (PhotosSmartViewDetail.vue gets the same narrowing from a bare `v-else`
             because its gate 2 is `v-else-if="!sv"` — a direct negation of the same ref. Ours
             goes through the separate `notFound` computed, which vue-tsc cannot see through.) -->
        <template v-else-if="moment">
          <!-- Vue 2 :3-9, commented there as "same as sv-detail-bar". -->
          <div class="sv-detail-bar">
            <button type="button" class="sv-back-btn" data-test="mo-back" @click="backToAll">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosMoBackToAll') }}
            </button>
            <div style="flex:1" />
            <span class="sv-last-updated" data-test="mo-last-updated">{{ t('photosMoLastUpdated', { time: lastUpdated }) }}</span>
          </div>

          <div class="sv-detail-layout mo-detail-layout">
            <div class="sv-detail-main">
              <!-- Header (Vue 2 :12-30). Vue2's action bar has four buttons (Add photos /
                   Select / Save as Album / more menu, :30-45); only Select belongs to this
                   task's own scope (it drives selecting/selectedIds, tested here) — the
                   other three stay Task 9/10 placeholders (deviation 6). -->
              <div class="sv-header">
                <div style="flex:1;min-width:0">
                  <h1>{{ moment.title }}</h1>
                  <div class="sv-header-conds">
                    <span class="sv-cond mo-type-pill">{{ typeLabel }}</span>
                    <span v-if="moment.place" class="sv-cond">
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                      {{ moment.place }}
                    </span>
                  </div>
                  <div class="sv-header-stats">
                    <span v-if="moment.subtitle">{{ moment.subtitle }}</span>
                    <span><b>{{ fmtNum(momentAssetCount) }}</b> {{ t('photosSvPhotosCount') }}</span>
                    <span v-if="moment.addedThisWeek > 0" class="mo-week-badge">{{ t('photosMoAddedThisWeek', { n: moment.addedThisWeek }) }}</span>
                  </div>
                </div>
                <div class="sv-actions">
                  <!-- Add photos (Vue 2 :26-28), disabled while the all-photos request is still
                       in flight exactly as there — the picker's "already in" set is derived from
                       that response, and opening early would offer photos the moment already
                       has. -->
                  <button
                    type="button" class="sv-action-btn" data-test="mo-add-photos"
                    :disabled="allLoading" @click="pickerOpen = true"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    {{ t('photosMoAddPhotos') }}
                  </button>
                  <!-- Text reuses photosPersonSelect/photosCancel verbatim (same wording as
                       Vue2's `selecting ? $t('Cancel') : $t('Select')`) rather than adding a
                       fresh pair of keys for the same two words (deviation 7). -->
                  <button
                    type="button" class="sv-action-btn" data-test="mo-select-toggle"
                    :data-open="selecting" @click="toggleSelecting"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    {{ selecting ? t('photosCancel') : t('photosPersonSelect') }}
                  </button>
                  <!-- Save as Album (Vue 2 :20-22), disabled while an export is in flight to
                       block a double submit — same guard shape as pinning/removing above.
                       It is also this page's single primary action: Vue 2 marks it
                       `data-primary="true"` and fills it with the accent (scss:553-557).
                       The attribute is kept for parity and the styling hangs off the
                       companion class — see the rules at .sv-action-btn-primary below. -->
                  <button
                    type="button" class="sv-action-btn sv-action-btn-primary"
                    data-test="mo-save-album" data-primary="true"
                    :disabled="exporting" @click="saveAsAlbum"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
                    {{ t('photosMoSaveAsAlbum') }}
                  </button>
                  <!-- more menu (Vue 2 :29-45): a single Delete item — Vue 2 has just the one,
                       so there is no "more" of anything else to add here. -->
                  <div ref="moreWrapRef" style="position:relative">
                    <button
                      type="button" class="sv-action-btn sv-action-btn-icon" data-test="mo-more"
                      :data-open="moreOpen" @click="moreOpen = !moreOpen"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                    </button>
                    <Transition name="sv-menu">
                    <div v-if="moreOpen" class="sv-export-menu sv-more-menu" data-test="mo-more-menu">
                      <button
                        type="button" class="sv-export-item sv-export-item-danger" data-test="mo-delete"
                        @click="openDeleteConfirm"
                      >
                        <div class="sv-export-icon sv-export-icon-danger"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                        <div>
                          <div class="sv-export-title">{{ t('photosMoDeleteMoment') }}</div>
                          <!-- Reused verbatim, not a fresh key — file-header deviation 19. -->
                          <div class="sv-export-desc">{{ t('photosSvPhotosStayLibrary') }}</div>
                        </div>
                      </button>
                    </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <!-- Featured (Vue 2 :52-61): rendered only when non-empty — no empty shell. -->
              <template v-if="featuredAssets.length">
                <div class="sv-section-head" data-test="mo-featured-head">
                  {{ t('photosMoFeatured') }} <span class="pill">{{ featuredAssets.length }}</span>
                </div>
                <div class="sv-grid-photos mo-grid-featured">
                  <div
                    v-for="p in featuredAssets" :key="p.id" class="tile"
                    :data-selected="selecting && selectedIds.includes(String(p.id))"
                    data-test="mo-featured-tile"
                    @click="onTileClick(p, featuredAssets)"
                  >
                    <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                    <!-- Pin badge: manual members only, and only inside Featured (Vue 2 :57) —
                         the All photos grid below never carries it (deviation 8: it reuses the
                         same outline pin path as the header's place icon above, rather than
                         Vue2's separate filled-teardrop `pin` icon — one pin glyph per file). -->
                    <div v-if="manualIds.has(String(p.id))" class="sv-pin-tag" data-test="mo-pin-tag">
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                    </div>
                    <div v-if="selecting && selectedIds.includes(String(p.id))" class="sv-tile-check">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                </div>
              </template>

              <!-- All photos (Vue 2 :63-79): loading / populated / empty are mutually exclusive. -->
              <div class="sv-section-head" data-test="mo-all-head">
                {{ t('photosMoAllPhotos') }} <span class="pill">{{ fmtNum(momentAssetCount) }}</span>
              </div>
              <div v-if="allLoading && !allAssets.length" class="mo-all-loading" data-test="mo-all-loading">
                {{ t('photosMoLoading') }}
              </div>
              <template v-else>
                <div v-if="allAssets.length" class="sv-grid-photos">
                  <div
                    v-for="p in allAssets" :key="p.id" class="tile"
                    :data-selected="selecting && selectedIds.includes(String(p.id))"
                    data-test="mo-all-tile"
                    @click="onTileClick(p, allAssets)"
                  >
                    <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                    <div v-if="selecting && selectedIds.includes(String(p.id))" class="sv-tile-check">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                </div>
                <div v-else class="mo-all-empty" data-test="mo-all-empty">{{ t('photosMoNoPhotosYet') }}</div>
              </template>
            </div>

            <aside class="sv-detail-side">
              <!-- About (Vue 2 :86-92) -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoAbout') }}</h3>
                <div class="mo-about-row"><span>{{ t('photosMoType') }}</span><b>{{ typeLabel }}</b></div>
                <div class="mo-about-row"><span>{{ t('photosMoTime') }}</span><b data-test="mo-about-time">{{ timeWindowLabel }}</b></div>
                <div class="mo-about-row">
                  <span>{{ t('photosMoPlace') }}</span>
                  <b data-test="mo-about-place" :title="placesTitle">{{ placesLabel }}</b>
                </div>
              </div>

              <!-- Stats (Vue 2 :94-115) -->
              <div class="sv-side-section">
                <h3>{{ t('photosMoStats') }}</h3>
                <div class="sv-stat-grid">
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-photos">{{ fmtNum(momentAssetCount) }}</div>
                    <div class="l">{{ t('photosMoPhotos') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-featured">{{ featuredAssets.length }}</div>
                    <div class="l">{{ t('photosMoFeatured') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-span">{{ spanLabel }}</div>
                    <div class="l">{{ t('photosMoSpan') }}</div>
                  </div>
                  <div class="sv-stat-cell">
                    <div class="v" data-test="mo-stat-lastupdate">{{ lastUpdated }}</div>
                    <div class="l">{{ t('photosMoLastUpdate') }}</div>
                  </div>
                </div>
              </div>

              <!-- By month (Vue 2 :117-124) — absent entirely when nothing carries a takenAt. -->
              <div v-if="monthBuckets.length" class="sv-side-section" data-test="mo-dist">
                <h3>{{ t('photosMoByMonth') }}</h3>
                <div class="sv-distribution">
                  <div
                    v-for="(b, i) in monthBuckets" :key="b.key" class="sv-dist-bar"
                    data-test="mo-dist-bar" :style="distStyle(b, i)" :title="b.label + ' · ' + b.count"
                  />
                </div>
                <div class="sv-dist-x">
                  <span>{{ monthBuckets[0].label }}</span>
                  <span>{{ monthBuckets[monthBuckets.length - 1].label }}</span>
                </div>
              </div>
            </aside>
          </div>

          <!-- Selection bar (Vue 2 :122-125): the count plus the removal button. The bar as a
               whole is absent with nothing selected, which is also why the button can never fire
               an empty request. -->
          <div v-if="selecting && selectedIds.length" class="sv-select-bar" data-test="mo-select-bar">
            <span>{{ t('photosSelectedCount', { count: selectedIds.length }) }}</span>
            <button
              type="button" class="sv-action-btn" data-test="mo-remove-selected"
              :disabled="removing" @click="removeSelected"
            >{{ t('photosMoRemoveFromMoment') }}</button>
          </div>

          <!-- Library picker (Vue 2 :143-151). Title reuses photosAlbumPickerTitle — Vue 2 feeds
               the same string to both pickers (deviation 14). The component is shared with the
               album pages and was generalised for this in T9's Step 0. -->
          <AlbumLibraryPicker
            v-model:open="pickerOpen"
            :title="t('photosAlbumPickerTitle', { name: moment.title })"
            :existing-ids="memberIds"
            :existing-label="t('photosMoAlreadyIn')"
            :submit-label="t('photosMoAddSelected')"
            :submitting="pinning"
            @confirm="onPickPhotos"
          />

          <!-- Delete confirmation (Vue 2 :138-152). Structure and classes reused verbatim from
               PhotosSmartViewDetail.vue's own sv-confirm-* dialog (task instruction: do not
               build a second dialog idiom). The mo-delete-error paragraph is new — deviation 17
               — Vue 2 has no inline equivalent, it closes the dialog and toasts instead. -->
          <Transition name="sv-confirm">
          <div
            v-if="confirmDeleteOpen" class="sv-confirm-scrim" data-test="mo-delete-confirm"
            @click.self="closeDeleteConfirm"
          >
            <div class="sv-confirm-panel">
              <div class="sv-confirm-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
              <!-- Reused verbatim (photosSvDeleteName), not a fresh key — file-header deviation 19. -->
              <div class="sv-confirm-title">{{ t('photosSvDeleteName', { name: moment.title }) }}</div>
              <div class="sv-confirm-body">{{ t('photosMoDeleteBody', { n: fmtNum(momentAssetCount) }) }}</div>
              <div v-if="deleteError" class="mo-delete-error" data-test="mo-delete-error">{{ deleteError }}</div>
              <div class="sv-confirm-foot">
                <button
                  type="button" class="sv-confirm-cancel" data-test="mo-delete-cancel"
                  @click="closeDeleteConfirm"
                >{{ t('photosCancel') }}</button>
                <!-- :disabled is the visible half of deviation 22's re-entrance guard — the
                     dialog stays up across the request, so without it the button invites a
                     second press that would 404 and report "delete failed" for a delete
                     that in fact worked. -->
                <button
                  type="button" class="sv-confirm-ok danger" data-test="mo-delete-go"
                  :disabled="deleting" @click="doDelete"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                  {{ t('photosDelete') }}
                </button>
              </div>
            </div>
          </div>
          </Transition>
        </template>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
/* height (not min-height): this screen is capped and only the inner containers scroll — same
   fix, and the same Vue 2 source, as the note at the matching rule in src/views/Photos.vue.
   Registered in views/__tests__/photosLayoutHeightCap.test.ts under CAPPED. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Loading gate (New-UI only, deviation 1) — same shape as PhotosSmartViewDetail's .sv-skeleton,
   minus the photo grid, since this task renders no grid yet. */
.mo-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.mo-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.mo-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }

/* Not-found gate (New-UI only, deviation 1) — mirrors .sv-not-found on the sibling page. */
.mo-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.mo-not-found-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.mo-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.mo-not-found-back:hover { background: var(--chip-bg-hi); }

/* ── Top bar (scss:298-311) ── */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider); }
.sv-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); font: inherit; font-size: 12px; cursor: pointer; }
.sv-back-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-last-updated { font-size: 12px; color: var(--fg-muted); }

/* ── Two-column skeleton (scss:313-345) ── The scrollbar repaint at scss:346-365 is deliberately
   not ported, for the reason already recorded at the same rules in PhotosSmartViewDetail.vue. */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── Header (scss:210-253 via PhotosSmartViewDetail) ── */
.sv-header { padding: 24px 32px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.sv-header h1 { font-family: var(--font-display, var(--font)); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--fg); }
.sv-header-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; min-height: 4px; }
.sv-cond { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; background: var(--chip-bg); color: var(--fg-muted); font-size: 11.5px; }
/* Amber type pill (scss:271-278). Vue 2 wrote an amber literal for both the tint and the text;
   this repo forbids bare colour literals, so it reuses the existing --warn-bg / --warn-fg pair
   (theme.css has values for both in both themes) — same substitution MomentCard.vue made in T4.
   The compound selector keeps it ahead of the plain .sv-cond above without !important. */
.sv-cond.mo-type-pill { background: var(--warn-bg); color: var(--warn-fg); font-weight: 600; }
.sv-header-stats { display: flex; gap: 20px; font-size: 12px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.sv-header-stats b { color: var(--fg); font-weight: 600; }
/* Vue 2 :24 wrote an inline green literal here; --success is this repo's token for it, same
   substitution as MomentCard.vue:209. */
.mo-week-badge { color: var(--success); }

/* ── Action bar (scss:386-404 via PhotosSmartViewDetail.vue's own restatement, same
   token substitutions it already made). Task 8 added the Select toggle; Task 10 adds
   Save as Album, the more-menu icon button and its dropdown — see the deviation notes
   at the template. ── */
.sv-actions { display: flex; gap: 8px; align-items: center; }
.sv-action-btn {
  height: 32px; padding: 0 12px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
}
.sv-action-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sv-action-btn[data-open="true"] { box-shadow: 0 0 0 2px var(--accent-soft); }
.sv-action-btn-icon { padding: 0 10px; min-width: 32px; justify-content: center; }
/* Save as Album is Vue 2's one primary action in this bar (:20 `data-primary="true"`,
   scss:553-557 `linear-gradient(135deg, var(--accent), var(--accent-hi))` + on-accent text).
   This repo has no --accent-hi, so it reuses the substitute PhotosSmartViewDetail.vue:709-715
   already settled on for the very same Vue 2 rule: a flat var(--accent) fill plus a hover
   brightness lift. --on-accent is legal here because the fill is solid accent.
   The hover rule is written as a compound selector on purpose: `.sv-action-btn-primary:hover`
   alone scores (0,2,0), a tie with the base `.sv-action-btn:hover`, and would then survive
   only by source order — the accent fill would be replaced by the neutral hover background
   while the text stayed --on-accent. The compound form scores (0,3,0) and wins structurally. */
.sv-action-btn-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.sv-action-btn.sv-action-btn-primary:hover { background: var(--accent); filter: brightness(1.08); color: var(--on-accent); }

/* ── More menu (scss:407-452 via PhotosSmartViewDetail.vue's own restatement — identical rule
   bodies, same class names, same reason as the two photo grids below: scoped styles do not
   cross component boundaries in this repo). ── */
.sv-export-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 280px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 6px;
  box-shadow: var(--card-shadow-hi); z-index: 50; display: flex; flex-direction: column; gap: 1px;
}
.sv-more-menu { min-width: 220px; }
.sv-export-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; background: transparent; border: 0;
  border-radius: 8px; color: var(--fg); text-align: left; cursor: pointer; font: inherit; width: 100%;
}
.sv-export-item:hover { background: var(--chip-bg-hi); }
.sv-export-icon {
  width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.sv-export-title { font-size: 12.5px; font-weight: 500; line-height: 1.2; }
.sv-export-desc { font-size: 11px; color: var(--fg-muted); margin-top: 3px; line-height: 1.35; }
/* Vue 2 :34/:35 wrote a coral literal for the delete item's icon/title/description — this repo
   forbids bare colour literals, so it reuses --remove-fg, same substitution
   PhotosSmartViewDetail.vue already made for its own delete item. */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Delete confirmation (scss has no independent block for it; PhotosSmartViewDetail.vue's own
   sv-confirm-* rules, restated verbatim — task instruction: reuse the existing dialog idiom,
   do not invent a second one). ── */
.sv-confirm-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 40px 20px;
}
.sv-confirm-panel {
  width: 380px; max-width: 100%; padding: 22px; border-radius: 16px;
  background: var(--popup-bg); border: 1px solid var(--card-border); box-shadow: var(--card-shadow-hi);
  color: var(--fg);
}
.sv-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%; margin-bottom: 10px;
  background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg);
  display: flex; align-items: center; justify-content: center;
}
.sv-confirm-title { font-size: 16px; font-weight: 600; }
.sv-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
/* New-UI only (deviation 17): the inline failure message, in the same danger family as the
   confirm button below rather than the neutral --fg-muted body text above it. */
.mo-delete-error { margin-top: 10px; font-size: 12.5px; color: var(--remove-fg); }
.sv-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.sv-confirm-cancel, .sv-confirm-ok {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--card-border); background: transparent;
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.sv-confirm-cancel:hover { background: var(--chip-bg-hi); }
/* Deviation 22: the dialog stays up across the request, so the confirm button needs the same
   in-flight treatment .sv-action-btn:disabled already gives the action bar. */
.sv-confirm-ok:disabled { opacity: 0.5; cursor: not-allowed; }
.sv-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent);
  color: var(--remove-fg); background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.sv-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
.sv-confirm-enter-active, .sv-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.sv-confirm-enter-from, .sv-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* ── Two photo grids (scss:480-513 via PhotosSmartViewDetail.vue's own restatement of the
   same source — identical rule bodies, same class names, same reason: scoped styles do
   not cross component boundaries in this repo). ── */
.sv-section-head { padding: 18px 32px 8px; display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
.sv-section-head .pill { padding: 1px 8px; border-radius: 99px; background: var(--chip-bg); color: var(--fg-muted); text-transform: none; letter-spacing: 0; font-weight: 500; }
.sv-grid-photos { padding: 0 32px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
/* Vue2 :52 inline `style="padding-bottom:18px"` — only on the Featured grid, giving it
   breathing room above the "All photos" heading below it. */
.mo-grid-featured { padding-bottom: 18px; }
.sv-grid-photos .tile { position: relative; aspect-ratio: 1; cursor: pointer; border-radius: 4px; overflow: hidden; }
.sv-grid-photos .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Pin badge (scss:682-692): manual members, Featured only. Background is --overlay-bg —
   the same constant-dark-badge token PhotosTrash.vue's .trash-tile-countdown/
   .trash-tile-select already use for "fixed dark badge over an unpredictable photo" —
   instead of Vue2's literal half-opaque black. */
.sv-pin-tag {
  position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--overlay-bg); backdrop-filter: blur(6px);
  display: inline-flex; align-items: center; justify-content: center; z-index: 3;
  color: #fff; /* theme-exception: badge glyph sits on unpredictable photo content inside a
    fixed dark badge — same reasoning as PhotosTrash.vue's .trash-tile-countdown/.trash-tile-select. */
}
/* Selection check (scss:693-701): left side, so it never collides with the pin badge above
   on the right — Vue2's own placement rule (see the code comment above the template). */
.sv-tile-check {
  position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); display: inline-flex; align-items: center; justify-content: center; z-index: 4;
  color: var(--on-accent); /* --on-accent's one legal use: icon sits on a solid --accent fill. */
}
.mo-all-loading, .mo-all-empty { padding: 8px 32px; color: var(--fg-muted); font-size: 12.5px; }

/* ── Selection bar (scss:723-745): fixed pill, same idiom as PhotosSmartViewDetail.vue's
   own .sv-toast (--popup-bg/--card-border/--card-shadow-hi/--blur). ── */
.sv-select-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
}
.sv-select-bar span { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

/* ── Sidebar sections (scss:748-756, :846-877) — rule bodies identical to
   SmartViewSidePanel.vue's, which ported the same source. ── */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}

/* About key/value rows (scss:281-289). The hairline is --divider. */
.mo-about-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  font-size: 12.5px; color: var(--fg-muted); padding: 7px 0;
  border-bottom: 1px solid var(--divider);
}
.mo-about-row:last-child { border-bottom: 0; }
.mo-about-row b { color: var(--fg); font-weight: 600; text-align: right; }

.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--chip-bg); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fg); }
.sv-stat-cell .l { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }

.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  /* Vue 2 scss:866-871 gradients from accent to a hard-coded pale violet; two steps of the
     accent family stand in for it, as SmartViewSidePanel.vue:274 already does. */
  background: linear-gradient(to top, var(--accent), var(--accent-text));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-subtle); margin-top: 4px; }

/* ≤768px: the sidebar is already a drawer, so the two columns collapse and the right rail drops
   below the content — same treatment as PhotosSmartViewDetail.vue. */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
