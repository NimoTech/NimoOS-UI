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
//     failure — the same two outcomes the user saw before. See PhotosLibraryPicker.vue's header.
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
//
// Plan C Task 2(公共换壳):壳从 AreaShell + `.photos-layout` flex-row 换成 Photos.vue 的
// Vue2 结构 `.photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main`
// ——`collapsed` 改用共享 composable useSidebarCollapse()。内层滚动链已经完整
// (`.sv-detail-main`/`.sv-detail-side` 两个网格格子各自 overflow-y:auto,复用
// PhotosSmartViewDetail.vue 的骨架,SP15-P1-T7),换壳不影响滚动行为。已知遗留(同
// PhotosAlbums.vue 的换壳注释,不逐页重复):移动端窄屏下没有 AreaShell 的 hamburger
// 入口去开侧栏抽屉,brief 明确本任务不越权补,详见 task-2-report.md。
import '../photos/styles/vue2-parity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { usePhotosMoments, type MomentMember, type MomentPlace } from '../photos/stores/moments'
import { useTimelineStore } from '../photos/stores/timeline'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { useToast } from '../stores/toast'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// Fix-1 item 1 (owner acceptance, 2026-08-13): `toggle` wires the topbar's collapse button
// (same as Photos.vue/PhotosAlbums.vue). Vue2 nests moment detail inside PhotosSmartViewsView
// under activeNav==='smart' ("Moments dedicated page", PhotosTimeline.vue:1024-1033) -- same
// nav as the Moments · For You list page, so title='For You' and sub is left to PhotosTopbar's
// own default (topbarSubContext's navMap has no 'smart' entry, PhotosTimeline.vue:229-234).
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const store = usePhotosMoments()
const timeline = useTimelineStore()
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

// ── Fix-12 (owner acceptance, 2026-08-14): this page always called `lightbox.openAt` (above),
// but never mounted a `<PhotoLightbox>` of its own -- `useLightbox` is a module-level singleton,
// so the state flipped open (its network calls fired) with nothing on THIS page's own tree to
// render it; the previous page's own mounted lightbox (if any) would pick up the stale `open`
// state the next time it re-rendered, which is why the owner saw the photo appear only after
// navigating back. Vue2's own PhotosMomentDetail component doesn't own a lightbox instance
// either (it `$emit('open-photo', p, list)`s up to its single-page parent, which owns the one
// shared lightbox and all its wiring) -- New-UI's per-route architecture has no such parent to
// hoist to, so this page (like PhotosAlbumDetail.vue, the pattern reference) now owns its own
// `<PhotoLightbox>` instance and wires it directly.
//
// Delete: mirrors PhotosAlbumDetail.vue's `onLightboxDelete` exactly -- the lightbox deletes the
// underlying ASSET from the library entirely (`timeline.deleteAssets`), not merely "remove from
// this moment", so this refreshes this page's own data afterward via the same `load()` helper
// `removeSelected()` already uses, plus the shared 4000ms toast copy every other page's delete
// path already uses.
async function onLightboxDelete(assetId: string | number): Promise<void> {
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  await load()
}

// Add-to-album: same shape as PhotosAlbumDetail.vue's own `openAlbumPicker`/
// `onAlbumPickerAdded` -- adds to a DIFFERENT album than the one being viewed, so there is
// nothing of this page's own state to refresh once it lands.
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}

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
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Fix-1 item 1 (owner acceptance, 2026-08-13): same narrow-mode coordination as
           Photos.vue/PhotosAlbums.vue. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosMoForYou')"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
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
            <button type="button" class="back" data-test="mo-back" @click="backToAll">
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
          <PhotosLibraryPicker
            v-model:open="pickerOpen"
            :title="t('photosAlbumPickerTitle', { name: moment.title })"
            :existing-ids="memberIds"
            :existing-label="t('photosMoAlreadyIn')"
            :submit-label="t('photosMoAddSelected')"
            :submitting="pinning"
            @confirm="onPickPhotos"
          />

          <!-- Fix-12 (owner acceptance, 2026-08-14): add-to-album picker for the lightbox's
               `@add-to-album`, same shape as PhotosAlbumDetail.vue's own `AlbumPickerDialog`
               mount -- stays nested inside `.photos-root` (its own panel background is
               `var(--surface-2)`, a `.photos-root`-local token with no fallback, per the F1/F4
               lesson class), unlike the lightbox itself further down. -->
          <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />

          <!-- Delete confirmation (Vue 2 :127-141, class names verified against its real
               source). Task 8 cross-page sweep: this used to restate PhotosSmartViewDetail.vue's
               own then-invented `.sv-confirm-*` dialog verbatim ("do not build a second dialog
               idiom" -- true in spirit, but that page's own idiom was itself never what Vue2
               actually uses). Renamed to Vue2's real `.lb-confirm-*`/`.trash-btn-*` classes, the
               same already-parity-ized reference idiom T3/T4 established and T5 already applied
               to PhotosSmartViewDetail.vue's sibling copy of this exact dialog -- all three pages
               genuinely do share one idiom now, just the correct one. The mo-delete-error
               paragraph is still New-UI-only (deviation 17) — Vue 2 has no inline equivalent, it
               closes the dialog and toasts instead. -->
          <Transition name="lb-confirm">
          <div
            v-if="confirmDeleteOpen" class="lb-confirm-scrim" data-test="mo-delete-confirm"
            @click.self="closeDeleteConfirm"
          >
            <div class="lb-confirm">
              <div class="lb-confirm-icon" style="color: var(--danger)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
              <!-- Reused verbatim (photosSvDeleteName), not a fresh key — file-header deviation 19. -->
              <div class="lb-confirm-title">{{ t('photosSvDeleteName', { name: moment.title }) }}</div>
              <div class="lb-confirm-body">{{ t('photosMoDeleteBody', { n: fmtNum(momentAssetCount) }) }}</div>
              <div v-if="deleteError" class="mo-delete-error" data-test="mo-delete-error">{{ deleteError }}</div>
              <div class="lb-confirm-foot">
                <button
                  type="button" class="trash-btn-ghost" data-test="mo-delete-cancel"
                  @click="closeDeleteConfirm"
                >{{ t('photosCancel') }}</button>
                <!-- :disabled is the visible half of deviation 22's re-entrance guard — the
                     dialog stays up across the request, so without it the button invites a
                     second press that would 404 and report "delete failed" for a delete
                     that in fact worked. -->
                <button
                  type="button" class="trash-btn-cta trash-btn-cta-danger" data-test="mo-delete-go"
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
       </div>
      </main>
    </div>
  </div>
  <!-- Fix-12 (owner acceptance, 2026-08-14): this page never mounted a `<PhotoLightbox>` at all
       (see `onLightboxDelete`'s own comment above for the full mechanism) -- added here,
       deliberately a sibling of `.photos-root`, NOT nested inside it. Per Fix-8 round 4
       (acceptance-fix-report.md §F8-r4): nesting `<PhotoLightbox>` inside `.photos-root`
       activates parity's own `.photos-root .lightbox`/`.lb-*` rule family, which targets a
       *future* Plan-F re-skin describing a different DOM/CSS shape (a CSS Grid with named
       grid-area children) than this component's own current, self-contained flex layout --
       every colliding selector ties in specificity, and if parity's `display: grid` wins that
       tie for the outer container, this component's real children (which carry none of the
       grid-area names parity's layout expects) fall into unpredictable implicit placement,
       breaking the whole overlay. **Do not nest this component inside `.photos-root` before
       Plan F's own lightbox re-skin actually ports its DOM/CSS to match those parity rules.** -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
</template>

<style scoped>
/* Plan C Task 2: the flex-row shell + the transitional `.sidebar { flex... }` width pin are
   gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the sidebar's
   width and the height cap, same as Photos.vue since its own Task 3 re-skin. This file's
   source no longer contains a `.photos-layout` rule — photosLayoutHeightCap.test.ts's
   CAPPED list has been updated to drop this page accordingly. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Loading gate (New-UI only, deviation 1) — same shape as PhotosSmartViewDetail's .sv-skeleton,
   minus the photo grid, since this task renders no grid yet. */
.mo-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.mo-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.mo-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }

/* Not-found gate (New-UI only, deviation 1) — mirrors .sv-not-found on the sibling page. */
.mo-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--text-2); text-align: center; }
.mo-not-found-title { font-size: 15px; font-weight: 600; color: var(--text-1); }
.mo-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); color: var(--text-1); font: inherit; font-size: 13px; cursor: pointer; }
.mo-not-found-back:hover { background: var(--surface-3); }

/* ── Top bar (scss:298-313, globally imported) ──
   Task 6: `.sv-detail-bar` deleted -- parity's own `.photos-root .sv-detail-bar` already
   matches (token names differ only). The back button's class is renamed from the invented
   `.sv-back-btn` to Vue2's actual `.back` (verified against NimoOS-UI's real source,
   PhotosMomentDetail.vue:4 `<button class="back" ...>`) -- same naming-drift correction
   T5 already made for the sibling SmartViewDetail page's own back button: the old name never
   matched parity's nested `.sv-detail-bar .back`(+:hover) selector at all, so this is the
   first time that rule actually reaches this button. Local rule deleted accordingly. */
.sv-last-updated { font-size: 12px; color: var(--text-2); }

/* ── Two-column skeleton (scss:313-345) ── The scrollbar repaint at scss:346-365 is deliberately
   not ported, for the reason already recorded at the same rules in PhotosSmartViewDetail.vue.
   Task 8 static self-audit note: the template's `mo-detail-layout` companion class on this same
   element (:619) carries no rule here, in parity, or anywhere else in `src/` -- a harmless,
   vestigial page-identifier hook (predates this cleanup) with no visual effect; documented here
   rather than removed since it's out of this task's assigned scope. */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
.sv-detail-side {
  border-left: 1px solid var(--line); background: var(--surface-1);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── Header (scss:260-267,364-372,414-416,452-459, globally imported) ──
   Task 6: `.sv-header` deleted outright -- identical to parity's own `.photos-root .sv-header`.
   `.sv-header h1` trimmed to just `color: var(--text-1)` -- parity's own rule already sets
   font-family/font-size/font-weight/letter-spacing/margin (and, unlike the previous comment
   here claimed, `--font-display` genuinely resolves: it's defined on photos.scss's own
   `.photos-root` token block, just not in this app's theme.css, which is as far as the old
   comment checked); parity sets no colour at all, so the explicit `--fg` survives as a
   defensive addition, same call as PhotosSmartViews.vue's `.mo-hero h1`. */
.sv-header h1 { color: var(--text-1); }
/* `.sv-header-conds` trimmed to just `min-height: 4px` -- the rest duplicated parity's own
   rule exactly; the min-height is a New-UI addition with no parity equivalent, preventing the
   row from collapsing when there are no condition pills to show (same fix T5 already made on
   the sibling SmartViewDetail page's identical copy of this rule). */
.sv-header-conds { min-height: 4px; }
/* `.sv-cond` kept unchanged (not deleted): it consolidates parity's own base `.sv-cond` rule
   plus its `.sv-header-conds .sv-cond` contextual size-bump override into one rule -- same
   "consolidation, not a raw duplicate" precedent T4/T5 already established for this exact
   selector on the sibling pages.
   Fix-2 item 4/6 (owner acceptance, 2026-08-13): background corrected from `--chip-bg` (global,
   non-shadowed, glass-gradient in dark mode) to parity's own `--surface-3` -- Vue2's real base
   `.sv-cond` background (photos-smartview.scss:91-97), one rung lighter than what was here
   (`--chip-bg`/--surface-2, not `--chip-bg-hi`/--surface-3). Same fix applied to this chip's
   other restatements in PhotosAlbumDetail.vue/MomentCard.vue/AlbumConvertToSmartDialog.vue;
   PhotosSmartViewDetail.vue's own copy already had the right token and needed no correction. */
.sv-cond { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; background: var(--surface-3); color: var(--text-2); font-size: 11.5px; }
/* Amber type pill (scss:264-268). Vue 2 wrote an amber literal for both the tint and the text;
   this repo forbids bare colour literals.
   Fix-2 item 6 (owner acceptance, 2026-08-13): this used to reuse the global --warn-bg/--warn-fg
   pair (T4's original substitution) -- neither is shadowed on `.photos-root`, so in photos light
   mode (data-theme still dark) it stayed the dark pairing, a faint 8%-alpha wash under the same
   bright orange text sitting directly on the parity light surface -- low-contrast
   orange-on-near-white, the same root cause as the rest of this sweep. `--warning` is declared
   directly on `.photos-root` itself at the exact same orange Vue2 itself uses literally,
   deliberately left un-overridden by `.photos-root.is-light` (functional colours are invariant
   by spec) -- already the correct, parity-scoped, theme-invariant token. `color-mix` reproduces
   Vue2's own literal fill (a 15%-alpha version of that same orange, scss:264-268) precisely --
   also fixes a real value drift (--warn-bg's 8% vs Vue2's 15%), not just a theming one. Same fix
   applied to MomentCard.vue's sibling `.mo-span-mini` in the same commit. The compound selector
   keeps it
   ahead of the plain .sv-cond above without !important. */
.sv-cond.mo-type-pill { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); font-weight: 600; }
/* `.sv-header-stats`(+b) deleted -- both duplicated parity's own rule bodies exactly (token
   names differ only). */
/* Vue 2 :22 wrote an inline green literal here; --success is this repo's token for it, same
   substitution as MomentCard.vue:209. No parity CSS class exists for this element at all
   (Vue2 styles it via the same inline style), so this survives unchanged. */
.mo-week-badge { color: var(--success); }

/* ── Action bar (scss:478-496, globally imported). Task 8 added the Select toggle; Task 10
   added Save as Album, the more-menu icon button and its dropdown — see the deviation notes
   at the template.
   Task 6: `.sv-actions` and `.sv-action-btn`(base+:hover+[data-open]) deleted -- all duplicated
   parity's own rule bodies exactly (token names differ only; parity's global button reset,
   `.photos-root button { ...font: inherit; cursor: pointer; }` in photos.scss, already covers
   the two properties the local base rule was restating on top of that). `:disabled` survives
   unchanged (New-UI addition, no parity equivalent). ── */
.sv-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
/* `.sv-action-btn-icon`'s 32px verified against NimoOS-UI's real source for *this* page
   (PhotosMomentDetail.vue:36, inline `min-width:32px`) -- unlike the sibling SmartViewDetail
   page, whose own real Vue2 inline value is 36px (T5's fix), this page's own value really is
   32px, so no correction is needed here. No parity CSS class exists for it either way (Vue2
   styles this button via inline style, not a class) -- kept, survivor. */
.sv-action-btn-icon { padding: 0 10px; min-width: 32px; justify-content: center; }
/* Save as Album is Vue 2's one primary action in this bar (:20 `data-primary="true"`,
   scss:553-557 `linear-gradient(135deg, var(--accent), var(--accent-hi))` + on-accent text).
   This repo has no --accent-hi, so it reuses the substitute PhotosSmartViewDetail.vue:709-715
   already settled on for the very same Vue 2 rule: a flat var(--accent) fill plus a hover
   brightness lift. --on-accent is legal here because the fill is solid accent.
   The hover rule is written as a compound selector on purpose: `.sv-action-btn-primary:hover`
   alone scores (0,2,0), a tie with the base `.sv-action-btn:hover`, and would then survive
   only by source order — the accent fill would be replaced by the neutral hover background
   while the text stayed --on-accent. The compound form scores (0,3,0) and wins structurally.
   Task 6 audit note: parity itself now also reaches this button directly, via the plain
   attribute selector `.photos-root .sv-action-btn[data-primary="true"]`
   (photos-smartview.scss:489-493, a gradient fill) -- but this companion class is test-locked
   (PhotosMomentDetail.test.ts:861-877 asserts both the class's presence and this exact rule's
   raw source text), and deleting it in favour of the bare attribute selector would be exactly
   the kind of scope creep T5 already declined for the sibling page's own dialog classes.
   Left unchanged. */
.sv-action-btn-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.sv-action-btn.sv-action-btn-primary:hover { background: var(--accent); filter: brightness(1.08); color: var(--on-accent); }

/* ── More menu (scss:499-547, globally imported).
   Task 6: `.sv-export-menu`, `.sv-export-item`(+:hover), `.sv-export-icon`, `.sv-export-title`,
   `.sv-export-desc` all deleted -- each duplicated parity's own rule body exactly (token names
   differ only; `.sv-export-item`'s local `width: 100%` was also redundant, same finding T5
   already made for the sibling page's identical copy: `.sv-export-menu`'s flex-column parent
   stretches its children by default, so the explicit width did nothing). ──
   `.sv-more-menu`'s min-width corrected from 220px to **210px**: verified against NimoOS-UI's
   real source for *this specific page* (PhotosMomentDetail.vue:40, inline
   `style="min-width:210px"`) -- 220px was this page's own value for the sibling
   SmartViewDetail page's dropdown, copied here by mistake (the two pages restate the same
   menu markup/class names but each carries its own distinct Vue2 inline-style value; T5's
   report already flagged the sibling page's `.sv-action-btn-icon` 32-vs-36 drift as the same
   category of copy-paste mismatch between these restated pages). No parity CSS class exists
   for this size either way (Vue2 sets it via inline style) -- kept as a survivor, value fixed. */
.sv-more-menu { min-width: 210px; }
/* Vue 2 :41/:42 wrote a coral literal for the delete item's icon/title/description — this repo
   forbids bare colour literals, so it reuses --remove-fg, same substitution
   PhotosSmartViewDetail.vue already made for its own delete item. */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--danger); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); }
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Task 8 cross-page sweep: delete confirmation ──
   This used to restate PhotosSmartViewDetail.vue's own then-invented `.sv-confirm-*` rules
   verbatim (task instruction at the time: reuse the existing dialog idiom, don't invent a
   second one) -- but verified against NimoOS-UI's real source, *this specific page's* Vue2
   delete dialog actually spells its classes `.lb-confirm-scrim`/`.lb-confirm`/`.lb-confirm-icon`/
   `.lb-confirm-title`/`.lb-confirm-body`/`.lb-confirm-foot`/`.trash-btn-ghost`/`.trash-btn-cta`
   (+`.trash-btn-cta-danger`) -- PhotosMomentDetail.vue:127-141, not `.sv-confirm-*` at all. Same
   cross-page dialog-idiom fork Task 3 originally flagged; T5 already migrated the sibling
   SmartViewDetail page's own copy of this pattern, and this task (the plan's dedicated
   "四毛玻璃弹层类名激活确认" sweep) finishes the third and last page. Renamed the template's
   classes to match (see its own comment); the entire local `.sv-confirm-*` cluster this replaces
   (scrim/panel/icon/title/body/foot/cancel/ok, this repo's own --overlay-bg/--popup-bg/
   --card-border/--fg tokens) is deleted outright -- parity's own self-contained rule
   (photos.scss:620-692, imported globally) now governs every part of the dialog directly,
   same as PhotosAlbumDetail.vue's and PhotosSmartViewDetail.vue's own copies of this idiom.
   Two things do NOT come from parity and are kept below: `.mo-delete-error` (deviation 17, a
   New-UI-only inline failure message -- Vue2 has no such box, it closes the dialog and toasts
   instead) and the disabled-button opacity for deviation 22's re-entrance guard (the dialog
   stays up across the request; Vue2's own trash-btn-cta/-ghost carry no :disabled styling at
   all since its dialog doesn't need one) plus the Vue3 `-enter-from` transition-name translation
   of parity's Vue2-spelled `.lb-confirm-enter`/`.lb-confirm-leave-to` rule (same fix already
   applied to `.sv-menu-*` above and to the sibling pages' own copies of this exact dialog). ── */
/* New-UI only (deviation 17): the inline failure message, in the same danger family as the
   confirm button below rather than the neutral --fg-muted body text above it. */
.mo-delete-error { margin-top: 10px; font-size: 12.5px; color: var(--danger); }
/* Deviation 22: the dialog stays up across the request, so the confirm button needs the same
   in-flight treatment .sv-action-btn:disabled already gives the action bar -- parity's own
   .trash-btn-cta carries no :disabled styling at all (Vue2's own dialog never disables it). */
.trash-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }
.lb-confirm-enter-active, .lb-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.lb-confirm-enter-from, .lb-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* ── Two photo grids (scss:572-596,609-650, globally imported).
   Task 6: `.sv-section-head`(+.pill) and the base `.sv-grid-photos` deleted -- each duplicated
   parity's own rule body exactly. `.mo-grid-featured` survives unchanged (Vue2 :56 inline
   `style="padding-bottom:18px"` on the Featured grid only, no parity class). ── */
.mo-grid-featured { padding-bottom: 18px; }
/* `.sv-grid-photos .tile`(+img) deleted -- two real bugs, same category T4/T5 already found on
   the sibling pages' identical copies: (1) this local `border-radius: 4px` silently overrode
   the global base `.tile` rule's real `border-radius: 3px` (photos.scss:334-337; parity's own
   narrow `.sv-grid-photos .tile` override is just `aspect-ratio: 1`, smartview.scss:609) --
   these tiles have been 1px off. (2) this local `.tile img` was a more-specific duplicate of
   the global `.tile img`/`.tile:hover img` (photos.scss:340-341, `scale(1.04)` on hover) that
   always won regardless of source order, so these tiles have never zoomed on hover, unlike
   every other tile grid in the app. Deleting both restores the correct radius and the
   hover-zoom for the first time. */

/* SP15-P2a task 4: carried-in defect fix, and still genuinely needed -- unlike the sibling
   SmartViewDetail page's identical-looking copy of this rule (which T5 found the global
   `.photos-root .tile[data-selected]` rule already reaches and deleted), *this* file's own
   selection-highlight regression test
   (`PhotosMomentDetail.selectionHighlight.test.ts`'s "carries its own [data-selected] rule
   reachable..." case) reads this file's own compiled `<style>` block with `fs.readFileSync`
   and requires a matching selector to exist **here** -- so this rule is kept unchanged
   (test-locked survivor), even though the same specificity argument would otherwise apply.
   The template already sets `:data-selected` on both grids' tiles; the wash is a mix of the
   accent token at 20 percent, standing in for Vue2's flat literal. */
.sv-grid-photos .tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
.sv-grid-photos .tile[data-selected="true"]::before {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

/* Pin badge (scss:632-641): manual members, Featured only.
   Task 6: trimmed to just the badge glyph's text colour below -- parity's own nested selector,
   `.photos-root .sv-grid-photos .tile .sv-pin-tag` (4 classes), already out-specifies this
   file's 1-class `.sv-pin-tag` regardless of source order, so the rest of the shape (position/
   size/background/backdrop-filter/z-index) was pure dead-weight duplication; parity's own
   half-opaque-black literal background now governs directly (same "parity's nested selector
   already wins, duplicate deleted" verdict T5 already reached for this exact selector on the
   sibling page). Text colour survives as the one property parity's rule doesn't set. */
.sv-pin-tag {
  color: #fff; /* theme-exception: badge glyph sits on unpredictable photo content inside a
    fixed dark badge — same reasoning as PhotosTrash.vue's .trash-tile-countdown/.trash-tile-select. */
}
/* Selection check (scss:642-650): same "parity's nested selector already wins" story as the
   pin badge above -- trimmed to just the text colour. */
.sv-tile-check {
  color: var(--on-accent); /* --on-accent's one legal use: icon sits on a solid --accent fill. */
}
.mo-all-loading, .mo-all-empty { padding: 8px 32px; color: var(--text-2); font-size: 12.5px; }

/* ── Selection bar (scss:675-696, globally imported).
   Task 6: deleted -- real bug, same category T4/T5 already found and fixed on the sibling
   pages' identical copies of this exact bar: this local rule used `var(--blur)`, this repo's
   oversized big-panel glass token (`blur(44px) saturate(1.7) brightness(1.08)`), where
   parity's own `.photos-root .sv-select-bar` wants a much lighter `blur(12px) saturate(180%)`
   (plus its own `--pop-bg`/`--line-strong` tokens, both defined in photos.scss's own
   `.photos-root`/`.photos-root.is-light` blocks for both themes). Deleted; parity now governs
   the bar directly. `.sv-select-bar span` deleted too -- duplicated parity's own rule body
   exactly (token names differ only). ── */

/* ── Sidebar sections (scss:713-720, globally imported) — rule bodies used to be identical to
   SmartViewSidePanel.vue's own restatement of the same source.
   Task 6: `.sv-side-section`(+h3) deleted -- both duplicated parity's own rule bodies exactly
   (token names differ only). ── */

/* About key/value rows (scss:279-287, globally imported).
   Task 6: `.mo-about-row`(+:last-child+b) deleted -- all three duplicated parity's own rule
   bodies exactly (token names differ only: `--divider`/`--fg-muted`/`--fg` here vs parity's
   own `--line`/`--text-3`/`--text-1`). */

/* Task 6: `.sv-stat-grid`, `.sv-stat-cell` and `.sv-stat-cell .l` deleted -- all three
   duplicated parity's own rule bodies exactly (token names differ only). `.sv-stat-cell .v`
   trimmed to just its explicit `color: var(--text-1)` -- parity's own rule sets no colour at all
   here either (font-size/weight/tabular-nums duplicated and deleted), so the same "explicit
   colour survives, don't gamble on inheritance" call as `.sv-header h1`/`.mo-hero h1` applies;
   this also resolves the "is this survivor even necessary" question T4 flagged as an open
   concern for its own file's identical copy of this exact selector. */
.sv-stat-cell .v { color: var(--text-1); }

/* Task 6: `.sv-distribution`/`.sv-dist-x` deleted -- both duplicated parity's own rule bodies
   exactly (token names differ only). `.sv-dist-bar` kept unchanged: Vue2's own gradient ends
   on a hard-coded pale-violet literal (scss:833), so two steps of the accent family
   stand in for it here, same substitution SmartViewSidePanel.vue:274 already made -- a genuine
   token substitution, not a raw duplicate (also: Vue2 puts no class on this bar at all, it's a
   bare `<div>` child of `.sv-distribution`; parity's own `.sv-distribution > div` selector
   still reaches this element regardless of the extra `.sv-dist-bar` class New-UI adds as a
   styling hook). */
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  background: linear-gradient(to top, var(--accent), var(--accent-hi));
}

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode at
   ≤768px, collapse `.app`'s sidebar column too — same treatment as PhotosSmartViewDetail.vue.
   The two columns (content/right rail) collapse and the right rail drops below the content. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--line); }
}
</style>
