<script setup lang="ts">
// Task 14 (SP7-P5 People): person detail view container — the largest single item this
// sprint. Ported line-by-line against Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue (1561 lines): four-state gating (skeleton /
// load failed + retry / person not found / normal) + PersonHero (T10) +
// three tabs (self-drawn co-occurrence strip on the timeline + PersonAssetGrid T11 /
// PersonPlacesTab T12 / PersonRelationsTab T13) + selection-mode floating bar +
// **seven self-drawn dialogs** (rename / create album / "no photos available" notice /
// remove confirm / delete confirm / hero picker / merge into another person — the brief's
// list names six; the third is Vue2's promptDialog info mode :845-851, added back per
// disclosure B) + PhotoLightbox (P2) wiring.
//
// This file only orchestrates: data lives in usePersonDetail (T9), writes go through
// usePhotosPeople (T2) / usePhotosAlbums (P4), display is T10-T13. The call/success/failure
// three-part flow for all nine actions lives here.
//
// ── Hard rules, item by item ──────────────────────────────────────────────
//  1) route.params.id is always a string: personId = computed(() => String(route.params.id)),
//     **all** downstream calls (load / renamePerson / setPersonRelation / setPersonFavorite /
//     setPersonCover / setPersonHero / mergePersonInto / purgePersonWithUndo /
//     detachAssetsFromPerson) always pass this normalized value — never guess the backend
//     id's real type.
//  2) Hash routing doesn't remount the same component: watch(() => route.params.id) reloads
//     + clears selectedIds + resets the tab + closes every dialog (following the precedent in
//     PhotosAlbumDetail.vue:323-334).
//  3) The first load is kicked off synchronously at the top level of <script setup>, not in
//     onMounted (following PhotosAlbumDetail.vue:302-309: the loading flag is set
//     synchronously before the await; putting it in onMounted would be a frame late and flash
//     an empty state on the first frame).
//  4) All id comparisons use String() value comparison, never reference equality.
//
// ── Deliberate deviations from Vue2 (all logged; either the brief requires them or this
//    sprint's "porting discipline" does) ─────────────────────────────────
//  A) In Vue2, hero/tab content is one giant component; here it's split into four
//     subcomponents T10-T13, and the container just wires up emits.
//  B) Vue2 uses a single promptDialog object to carry four modes: rename/album/detach/info;
//     here it's split into four independent switches + their own state (following the P3/P4
//     convention of each dialog drawing itself rather than sharing a common shell; CSS
//     classes are shared). Vue2's fourth mode, info (:845-851, "no photos available to add to
//     an album"), isn't on the brief's six-dialog list, but it's a real UI element that exists
//     in Vue2 — added back as the seventh dialog rather than dropped (logged in the report).
//  C) Favorite / relation grouping: Vue2 is fire-and-forget with no rollback (:764-768,
//     :951-955). Here it's an optimistic patch + precise rollback on failure + toast
//     (disclosures 3/4; the store layer already rethrows).
//  D) Rename failure: Vue2 only console.errors and closes the dialog anyway (:915-918), so
//     the user sees no failure and loses their input. Here: toast + **dialog stays open**
//     (so it's easy to fix).
//  E) Detach failure: Vue2 only console.errors (:943). Here a toast is added (disclosure 1).
//  F) Create album: Vue2 emits $emit('album-created') on success but **nobody listens to
//     it**, so the user gets zero feedback (:923). Here: toast; 409 reuses the existing
//     duplicate-name copy from the albums area (disclosure 1).
//  G) Create-album default name: Vue2 :855 uses `this.person.id.slice(0, 8)` — when the
//     backend id is a number, Number.prototype has no slice, so it throws a TypeError
//     outright. Here: String(id).slice(0, 8).
//  H) Merge failure: stays on the current page + closes the dialog in finally, following
//     Vue2 (a known flaw the brief explicitly says not to fix).
//  I) The hero dialog's four toasts (:681, 683, 694, 696): the brief said to merge them into
//     two, but checking back against the source found the two entry points' copy genuinely
//     differs in meaning ("reset back to the key photo" vs "change to this selected one") —
//     the coordinator's ruling 3 decided **not to merge them**, adding two keys instead,
//     photosPersonHeroResetToast / photosPersonHeroResetFailed, branching on
//     assetId === null (see saveHero).
//  J) Merge candidate pool: Vue2 uses allPeople (including unnamed) (:517); the brief
//     specifies people.named excluding self. Followed the brief. Side effect: candidate
//     names are always non-empty (namedOf guarantees name.trim() !== ''), so Vue2's
//     :406/410 fallback `p.name || $t('Unnamed')` is unreachable here and doesn't render
//     (not a missing render).
//  K) Added a `params.id === undefined` short-circuit to the route watch: after a successful
//     delete/merge, router.push goes to /photos/people (no :id); in Vue2 the parent
//     component unmounts the child so the watch never fires at all; here the component stays
//     mounted, so without the short-circuit it would fire a wasted load('undefined')
//     (PhotosAlbumDetail.vue:323 has the same gap, logged there; plugged directly here).
//  L) Co-occurrence strip avatar size 72px: the brief says 56; checked back against the Vue2
//     source, photos-people.scss:701-703 `.coappear-card .ring { width:72px; height:72px }`
//     — went with the source (same lesson as T13's 36px).
//  M) Gating expanded from three states to four (coordinator's ruling 4): Vue2 only
//     console.errors on load failure (:746); the view can't tell "load failed" apart from
//     "this person doesn't exist" — both are a blank screen. T9's failed flag was added
//     specifically for this — here failed gets its own branch:
//     photosPersonLoadFailed + a retry button (P4 left a similar item on record: the detail
//     page's load-failure path had a permanent skeleton with no error state and no retry;
//     not repeating that this sprint).
//
// ── Identity guard (final review Important 3; a different thing from the in-flight
//    reentry guard) ──────────────────────────────────────────────────────
//  The in-flight guard (favBusy/renaming/…) protects against "double-clicking the same
//  person's action twice." The identity guard protects against "the user switched to a
//  different person while a request was in flight, and the late response writes A's data
//  onto B." T9's seq only protects load()'s own write-back (stale responses get discarded);
//  the container side previously had no equivalent mechanism at all.
//
//  Confirmed repro path: person A's page → rename to "Zhang San" → PATCH in flight →
//  **press the browser back button** (hash routing, no need to click through the overlay)
//  → the route watch (see end of file) loads B → B is ready → *then* A's PATCH resolves →
//  without a guard, patchPerson({name:'Zhang San'}) lands on **B**: B's hero name / header /
//  create-album default name all become "Zhang San," and only a refresh fixes it. The
//  **rollback-on-failure** path for favorite/relation grouping has the same problem: it
//  writes A's old value onto B, and pops A's failure toast on B's page.
//
//  Mechanism: every action synchronously grabs `const myId = personId.value`
//  **before** sending its request; every write-back afterward goes through
//  `detail.patchPerson(patch, myId)` (second argument required, enforced by the type) /
//  `detail.isCurrent(myId)`. If patchPerson returns false ⇒ "already switched to someone
//  else" ⇒ the toast is dropped too. Id comparisons are normalized via String() uniformly
//  inside the composable (hard rule 4).
//
// ── Esc layering (same as P4's final review, covering all seven dialogs) ───────────
//  This page hosts a PhotoLightbox, which attaches its keydown listener on **window**
//  (PhotoLightbox.vue:144). Dialogs' Esc handling is always attached/detached at the
//  **document** level via watch(anyDialogOpen), and the branch **must** call
//  e.stopPropagation() — native keydown bubbling order runs document before window, so
//  without blocking it, one Esc press closes both layers.
//  Copied verbatim from AlbumPickerDialog.vue:70-100. When no dialog is open the listener is
//  removed entirely, so Esc still closes the lightbox as normal.
//
// ── Colors ─────────────────────────────────────────────────────────────────
//  Panel background is always var(--popup-bg) (not --card-bg: it's nearly transparent in
//  the dark theme and you can see through it — a P2 lesson learned the hard way). Every
//  token used here has been confirmed to exist in both theme blocks in theme.css;
//  --line / --accent-hi / --surface-* / --text-* / --ink don't exist in this repo, so they're
//  replaced respectively with --divider/--card-border / --accent-text /
//  --card, --panel-bg, --chip-bg / --fg, --fg-muted, --fg-subtle.
//  --on-accent is not used anywhere except the "primary button" — its background is
//  var(--accent) as a saturated solid fill, exactly the one legitimate precondition for
//  --on-accent.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import PersonHero from '../photos/components/PersonHero.vue'
import PersonAssetGrid from '../photos/components/PersonAssetGrid.vue'
import PersonPlacesTab from '../photos/components/PersonPlacesTab.vue'
import PersonRelationsTab from '../photos/components/PersonRelationsTab.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePersonDetail } from '../photos/composables/usePersonDetail'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { groupPlaces, type Person } from '../photos/util/peopleView'
import { isConflict, isNotFound } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type Tab = 'timeline' | 'places' | 'relations'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const route = useRoute()
const router = useRouter()
const people = usePhotosPeople()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const toast = useToast()
const lb = useLightbox()
const detail = usePersonDetail()

// Hard rule 1: the single normalization point.
const personId = computed(() => String(route.params.id))

// ── Local state ─────────────────────────────────────────────────────────────
const tab = ref<Tab>('timeline')
// Implicit selection mode (following Vue2 :488-489): selecting any single item counts as
// selection mode — there's no separate "enter selection mode" button.
const selectedIds = ref<Array<string | number>>([])
const selectionMode = computed(() => selectedIds.value.length > 0)

// Dialog 1: rename
const renameOpen = ref(false)
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
// Dialog 2: create album (+ dialog 7: no-photos-available notice, following Vue2's
// promptDialog info mode)
const albumOpen = ref(false)
const albumInput = ref('')
const albumIds = ref<Array<string | number>>([])
const albumInputRef = ref<HTMLInputElement | null>(null)
const noPhotosOpen = ref(false)
// Dialog 3: detach confirm
const detachOpen = ref(false)
const detachIds = ref<Array<string | number>>([])
// Dialog 4: delete person confirm
const deleteOpen = ref(false)
// Dialog 5: hero picker (wide dialog)
const heroOpen = ref(false)
const heroSelectedId = ref<string | number | null>(null)
// Dialog 6: merge into another person
const mergeOpen = ref(false)
const mergeQuery = ref('')
const mergeTarget = ref<Person | null>(null)

// In-flight reentry guards. **Only added on paths that actually earn their protective
// value** (the rationale for each is written in that function's own comment): delete
// person / detach assets are both purely synchronous submit paths (the dialog closes
// before the await), so a guard there would be purely decorative — deliberately omitted
// (the T7/T8 lesson: a decorative ref only fools people into thinking there's protection
// there).
const favBusy = ref(false)
const relationBusy = ref(false)
const renaming = ref(false)
const keyPhotoBusy = ref(false)
const heroSaving = ref(false)
const merging = ref(false)
const albumSaving = ref(false)

// Lightbox "add to album" → reuses T5's picker panel (which already carries its own
// document-level Esc + stopPropagation).
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])

// ── Derived data ──────────────────────────────────────────────────────────
// Vue2 :530-532 — the co-occurrence strip sorts by count descending (without mutating
// detail.relations itself).
const sortedRelations = computed(() => [...detail.relations.value].sort((a, b) => b.count - a.count))
// The places tab computes its own grouping; the relations tab's PlaceGroup[] is computed by
// the container and passed down (T13 contract).
const placeGroups = computed(() => groupPlaces(detail.places.value, t('photosPersonUnknownPlace')))
// Uncropped full photo set: shared by the lightbox's paging set (following Vue2 :878) and
// the hero picker grid (following :510-512).
const allPhotos = computed<Photo[]>(() => detail.flatPhotos())
// Shared fallback from Vue2 :165-166, :241, :887: falls back to "this person" when the name
// is empty.
const displayName = computed(() => detail.person.value?.name || t('photosPersonThisPerson'))

// Merge candidates (disclosure J): named, excluding self → sort by count descending, then
// by name ascending on tied count (same sort as T7 ClusterActionDialog.vue:85-92) → search
// filter → **not truncated** (following the Vue2 detail page :515-520; only the T7 dialog
// has the 6/8 truncation).
const mergeCandidates = computed(() => {
  const pool = people.named.filter((p) => String(p.id) !== personId.value)
  const sorted = [...pool].sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)))
  const q = mergeQuery.value.trim().toLowerCase()
  return q ? sorted.filter((p) => p.name.toLowerCase().includes(q)) : sorted
})

// ── Dialog switches ─────────────────────────────────────────────────────────
function closeAllDialogs(): void {
  renameOpen.value = false
  albumOpen.value = false
  noPhotosOpen.value = false
  detachOpen.value = false
  detachIds.value = []
  deleteOpen.value = false
  heroOpen.value = false
  heroSelectedId.value = null
  mergeOpen.value = false
  mergeQuery.value = ''
  mergeTarget.value = null
}

function openRename(): void {
  renameInput.value = detail.person.value?.name ?? ''
  renameOpen.value = true
  // Following Vue2 :780's $nextTick(focusDialogInput): focus + select, so you can rename
  // directly.
  void nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}
function closeRename(): void { renameOpen.value = false }

// Following Vue2 onMakeAlbum :841-867 — pops the info notice instead of entering the create
// flow when there are no photos.
function openMakeAlbum(): void {
  const p = detail.person.value
  if (!p) return
  const ids = allPhotos.value.map((x) => x.id)
  if (!ids.length) {
    noPhotosOpen.value = true
    return
  }
  albumIds.value = ids
  // Disclosure G: String(p.id) then slice — doesn't blow up on a numeric id either.
  albumInput.value = p.name.trim() ? p.name : t('photosPersonAlbumNameFallback', { id: String(p.id).slice(0, 8) })
  albumOpen.value = true
  void nextTick(() => {
    albumInputRef.value?.focus()
    albumInputRef.value?.select()
  })
}
function closeAlbum(): void { albumOpen.value = false }

// Following Vue2 openDetachDialog :884-897 (an empty array simply doesn't open it).
function openDetach(ids: Array<string | number>): void {
  if (!detail.person.value || !ids.length) return
  detachIds.value = [...ids]
  detachOpen.value = true
}
function closeDetach(): void {
  detachOpen.value = false
  detachIds.value = []
}

function openDelete(): void { deleteOpen.value = true }
function closeDelete(): void { deleteOpen.value = false }

// Following Vue2 onOpenHeroDialog :665-672 — preselects the current heroAssetId when
// opened.
// Review Minor 7: the original used `?? null`, which only blocks null/undefined, but the
// value sent to the backend for "no hero" is an **empty string**
// (people.ts:194 `heroAssetId: assetId ?? ''`). If the backend echoes back `''` verbatim,
// `?? null` would set heroSelectedId to `''` — no tile in the grid highlights (there's no
// photo whose id is an empty string), yet the save button's disabled condition
// `heroSelectedId === null` is still false, so "you can't tell what's selected but the save
// button is clickable" — clicking it re-sends the empty string and still toasts "hero
// updated." Changed here to a truthiness check (following Vue2 :667's
// `person.heroAssetId ? … : null`), but **explicitly excluding only null/undefined/''**,
// not using `||` — the latter would also treat the numeric id `0` as "no hero" (same
// reasoning already logged at people.ts:186-192: a falsy id can be a legitimate id and
// shouldn't be silently cleared).
function openHeroPicker(): void {
  const h = detail.person.value?.heroAssetId
  heroSelectedId.value = (h === null || h === undefined || h === '') ? null : h
  heroOpen.value = true
}
function closeHeroPicker(): void {
  heroOpen.value = false
  heroSelectedId.value = null
}

// Following Vue2 openMergeDialog :701-711.
function openMerge(): void {
  if (!people.peopleLoaded) void people.fetchPeople()
  mergeQuery.value = ''
  mergeTarget.value = null
  mergeOpen.value = true
}
function closeMerge(): void {
  mergeOpen.value = false
  mergeQuery.value = ''
  mergeTarget.value = null
}

// ── The nine actions ──────────────────────────────────────────────────────

// 1) Toggle favorite (Vue2 :764-768 + disclosure 3).
// Guard rationale: the star button on the hero stays clickable **the whole time a request
// is in flight**, so double-clicking fires two opposite PATCHes and the later response
// wins — a real race, so the guard earns its value.
async function onToggleFav(): Promise<void> {
  const p = detail.person.value
  if (!p || favBusy.value) return
  favBusy.value = true
  const next = !p.favorite
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  detail.patchPerson({ favorite: next }, myId)
  try {
    await people.setPersonFavorite(myId, next)
  } catch {
    // patchPerson returning false = we already switched to another person's page while the
    // request was in flight: the rollback and the toast both belong to the previous person,
    // so drop both together (otherwise A's old value gets written into B, and A's failure
    // notice pops on B's page).
    if (!detail.patchPerson({ favorite: !next }, myId)) return
    toast.show(t('photosPersonFavFailed'))
  } finally {
    favBusy.value = false
  }
}

// 2) Relation grouping (Vue2 :951-955 + disclosure 4).
// Guard rationale: the menu closes after picking an item, but the user can immediately
// reopen it and pick another — the same race as favorites, so the guard is effective.
async function onPickRelation(relation: string): Promise<void> {
  const p = detail.person.value
  if (!p || relationBusy.value) return
  relationBusy.value = true
  const prev = p.relation
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  detail.patchPerson({ relation }, myId)
  try {
    await people.setPersonRelation(myId, relation)
  } catch {
    if (!detail.patchPerson({ relation: prev }, myId)) return
    toast.show(t('photosPersonRelationFailed'))
  } finally {
    relationBusy.value = false
  }
}

// 3) Rename (Vue2 :910-918 + disclosure D).
// Guard rationale: the failure path **doesn't close the dialog** (deliberate), so the
// confirm button is still in the DOM and clickable while the request is in flight —
// double-clicking would fire two PATCHes, so the guard earns its value.
async function confirmRename(): Promise<void> {
  const p = detail.person.value
  const v = renameInput.value.trim()
  if (!p || renaming.value) return
  // Following Vue2 :911: an empty name or no change → close immediately without sending a
  // request.
  if (!v || v === p.name) {
    closeRename()
    return
  }
  renaming.value = true
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  try {
    await people.renamePerson(myId, v)
    // Already switched to another person's page: the name belongs to the previous person,
    // so don't write it and don't touch the dialog (closeAllDialogs already closed it long
    // ago).
    if (!detail.patchPerson({ name: v }, myId)) return
    closeRename()
  } catch {
    if (!detail.isCurrent(myId)) return
    toast.show(t('photosPersonRenamedFailed'))    // Dialog stays open
  } finally {
    renaming.value = false
  }
}

// 4) Set key photo (Vue2 onSetKeyPhoto :642-662).
// Guard rationale: selection mode only exits on success (after the await), so the floating
// bar and its buttons are still there while the request is in flight — the guard earns its
// value.
async function onSetKeyPhoto(): Promise<void> {
  if (selectedIds.value.length !== 1 || !detail.person.value || keyPhotoBusy.value) return
  const assetId = selectedIds.value[0]
  keyPhotoBusy.value = true
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  try {
    const coverFaceId = await people.setPersonCover(myId, assetId)
    // Both the avatar URL and the hero background URL use coverFaceId as ?v=, so the patch
    // auto cache-busts them (Vue2 :648-652).
    // Review Must-fix 1: it's **essential** to distinguish undefined (the backend response
    // didn't include this field → keep the local value as-is) from an explicit null (the
    // backend wants the cover cleared → write null). An unconditional patch would mean that
    // when the backend returns `200 {}`, the local coverFaceId gets wiped to null,
    // PersonHero.vue:76's isFallback immediately becomes true — the big hero image falls
    // back to a gradient and the 200px avatar falls back to an initial, and only a refresh
    // recovers. Vue2 :648-652 reads the value from the store list instead, where a missing
    // field just reads back the original value, so it doesn't degrade either.
    // Identity guard: the patch itself is already conditional (see above), so isCurrent is
    // used separately here to gate the toast/clearing selection together — a success notice
    // belonging to the previous person shouldn't pop on the new page.
    if (!detail.isCurrent(myId)) return
    if (coverFaceId !== undefined) detail.patchPerson({ coverFaceId }, myId)
    toast.show(t('photosPersonKeyPhotoToast'))
    selectedIds.value = []
  } catch (e) {
    if (!detail.isCurrent(myId)) return
    // 404 specifically means "this person's face isn't in this photo," and it must be split
    // into its own copy separate from other failures (Vue2 :656-657).
    toast.show(isNotFound(e) ? t('photosPersonKeyPhotoNoFace') : t('photosPersonKeyPhotoFailed'))
  } finally {
    keyPhotoBusy.value = false
  }
}

// 5) Save hero (Vue2 onUseKeyPhoto :675-685 / onSaveHero :688-698, disclosure I).
// Guard rationale: the dialog only closes on success (after the await), so both buttons
// stay clickable while the request is in flight — the guard earns its value.
// Both entry points share a single heroSaving: they never call each other (so this doesn't
// get bitten by its own guard the way T5's submitCreate→pick did).
// Copy branching (coordinator's ruling 3): in Vue2 the two entry points each have a pair of
// **semantically different** strings — "reset back to the key photo" vs "change to this
// selected one" — not merged. assetId === null happens to be exactly the "use key photo"
// entry point (onSaveHero only ever calls this when heroSelectedId is non-null), so using
// it to branch needs no extra parameter.
async function saveHero(assetId: string | number | null): Promise<void> {
  if (!detail.person.value || heroSaving.value) return
  heroSaving.value = true
  const isReset = assetId === null
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  try {
    await people.setPersonHero(myId, assetId)
    if (!detail.patchPerson({ heroAssetId: assetId }, myId)) return
    toast.show(t(isReset ? 'photosPersonHeroResetToast' : 'photosPersonHeroSavedToast'))
    closeHeroPicker()
  } catch {
    if (!detail.isCurrent(myId)) return
    toast.show(t(isReset ? 'photosPersonHeroResetFailed' : 'photosPersonHeroFailed'))
  } finally {
    heroSaving.value = false
  }
}
function onUseKeyPhoto(): void { void saveHero(null) }
function onSaveHero(): void {
  if (heroSelectedId.value == null) return
  void saveHero(heroSelectedId.value)
}

// 6) Merge into another person (Vue2 confirmMerge :715-727).
// Guard rationale: the dialog only closes in finally (after the await), and the confirm
// button is clickable while the request is in flight — the guard earns its value.
async function confirmMerge(): Promise<void> {
  const target = mergeTarget.value
  if (!target || !detail.person.value || merging.value) return
  merging.value = true
  try {
    await people.mergePersonInto(personId.value, target.id)
    // P8a-T10: the same fallback as PhotosPeople.vue's merge toast, so an unnamed target
    // doesn't render as 'merged into ""'.
    // Note: mergeCandidates (:184-188) only draws from people.named, so name.trim() is
    // always non-empty (disclosure J); and target is the object reference captured when the
    // candidate was clicked — any store write before confirm (patchPerson/fetchPeople)
    // replaces the whole object rather than mutating it in place, so it never writes back
    // onto this reference. Given the current wiring, this fallback branch is unreachable —
    // pure defensive completeness (kept consistent with the other two spots, in case the
    // candidate pool is ever opened up to include unnamed people and the empty quotes
    // silently come back).
    toast.show(t('photosPersonMergedToast', { name: target.name || t('photosPersonMergeAsSame') }))
    void router.push('/photos/people')            // Vue2 uses $emit('back')
  } catch {
    toast.show(t('photosPersonMergeFailed'))      // Disclosure H: stays on the current page (following Vue2)
  } finally {
    merging.value = false
    closeMerge()                                  // Closes on both success and failure (following Vue2 :726)
  }
}

// 7) Delete person (Vue2 confirmDeletePerson :959-972).
// Guard rationale: **no** independent guard needed. purgePersonWithUndo is a synchronous
// function (T2 store:217, returns an undo closure rather than a promise) — the whole path
// has no await, so the dialog closes within the same synchronous block, and the confirm
// button is already gone from the DOM before a second click could arrive; adding a ref
// would be purely decorative. The real protection mechanism = synchronously closing the
// dialog (pinned down by a test).
function confirmDeletePerson(): void {
  const p = detail.person.value
  if (!p) return
  // Final review Important 4: quote style unified with the list page to ASCII double
  // quotes — both Vue2 spots (PhotosPersonDetail.vue:962 / PhotosPeopleView.vue:665) use
  // `"${name}"`, checked back against the source.
  const label = p.name.trim() ? `"${p.name.trim()}"` : t('photosPersonUnnamedLabel')
  const undo = people.purgePersonWithUndo(personId.value)
  closeDelete()
  void router.push('/photos/people')
  toast.show(t('photosPersonDeletedToast', { label }), 5000, {
    label: t('photosPersonUndo'),
    onClick: undo,
  })
}

// 8) Detach assets (Vue2 confirmDialog's detach branch :928-946 + disclosure E).
// Guard rationale: **no** independent guard needed. The optimistic update + closing the
// dialog + exiting selection mode all complete synchronously **before** the request is
// sent, so the confirm button is already off the DOM before a second click could arrive.
// The real protection mechanism = synchronously closing the dialog (pinned down by a
// test).
async function confirmDetach(): Promise<void> {
  const p = detail.person.value
  const ids = [...detachIds.value]
  if (!p || !ids.length) return
  const myId = personId.value                     // Identity guard, see the "Identity guard" section
  detail.removePhotosLocally(ids)                 // Optimistic first (synchronous, before the await, so it can't cross pages)
  selectedIds.value = []
  closeDetach()
  try {
    await service.photos.detachAssetsFromPerson(myId, ids)
  } catch (e) {
    console.error('[person-detail] detach', e)
    if (detail.isCurrent(myId)) toast.show(t('photosPersonDetachFailed'))
  } finally {
    // Reconciles regardless of success or failure (following Vue2 :941 and :945, both
    // branches call loadPerson). Identity guard: skip reconciling once we've already
    // switched to another person's page — that would clear and re-fetch B, which just
    // finished loading (visible flicker + one wasted request).
    if (detail.isCurrent(myId)) void detail.load(myId)
  }
}

// 9) Create album (Vue2 confirmDialog's album branch :919-927 + disclosure F).
// Guard rationale: the dialog only closes on success (after the await), the confirm button
// is clickable while the request is in flight, and createAlbum has a persistent side
// effect (double-clicking really would create two albums with the same name, and the
// second one would also get a 409) — the guard earns its value.
async function confirmCreateAlbum(): Promise<void> {
  const name = albumInput.value.trim()
  if (!name || albumSaving.value) return
  albumSaving.value = true
  try {
    await albums.saveAsAlbum(name, albumIds.value)
    toast.show(t('photosPersonAlbumCreatedToast', { name }))
    closeAlbum()
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosPersonAlbumFailed'))
  } finally {
    albumSaving.value = false
  }
}

// ── Grid / lightbox / navigation wiring ─────────────────────────────────────
// T11 already branches on selectionMode internally (selection mode → toggle-select,
// otherwise → open); this just wires up the two emits.
function toggleSelect(id: string | number): void {
  const i = selectedIds.value.findIndex((x) => String(x) === String(id))
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}
function exitSelectionMode(): void { selectedIds.value = [] }

// Following Vue2 :878 — the paging set is the **uncropped full set** (the grid only renders
// 16 per month, but the lightbox can page through all of them).
function onTileClick(p: Photo): void {
  lb.openAt(p, allPhotos.value, 0)
}

async function onLightboxDelete(assetId: string | number): Promise<void> {
  // Following PhotosAlbumDetail.vue:275-283: reads deleteAssets' real success count,
  // 4000ms duration (set by P3).
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  void detail.load(personId.value)
}
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}

// Named function (following PhotosAlbumDetail.vue:215-217): an inline router.push in the
// template leaves its promise dangling on the event handler unhandled, so a rejection from
// a cancelled/duplicate navigation has nothing to catch it.
function goToPeopleList(): void { void router.push('/photos/people') }

// Retry for the load-failed state (coordinator's ruling 4).
// Review Minor 3 (self-correction): the original implementation added an
// `if (detail.loading.value) return` short-circuit here, plus `:disabled="detail.loading.value"`
// in the template — **both layers are unreachable**: gating branch ② already has `!loading`
// as its precondition, so the button only exists while loading is false, meaning
// `:disabled` is always false; and `detail.load()` synchronously sets loading=true before
// the await, so gating unmounts this button entirely on that same frame — there's nowhere
// for a second click to land. Tests stayed all green after removing both layers — exactly
// the "decorative guard" pattern T7/T8 already ruled on; removed per this sprint's
// discipline, so as not to leave code that fools people into thinking there's protection
// here.
// **The real protection mechanism = gating unmounts the button** (pinned down by a test:
// after one click the button is no longer in the DOM, the skeleton appears, and getPerson's
// call count only goes up by 1).
function retryLoad(): void {
  void detail.load(personId.value)
}
function goToPerson(id: string | number): void {
  void router.push('/photos/people/' + encodeURIComponent(String(id)))
}

// ── Esc (see the file header's "Esc layering" section) ──────────────────────
const anyDialogOpen = computed(() =>
  renameOpen.value || albumOpen.value || noPhotosOpen.value || detachOpen.value
  || deleteOpen.value || heroOpen.value || mergeOpen.value)

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // Must be blocked here, otherwise the same Esc press bubbles up to window and closes the
  // lightbox too (caught by P4's final review).
  e.stopPropagation()
  if (renameOpen.value) { closeRename(); return }
  if (albumOpen.value) { closeAlbum(); return }
  if (noPhotosOpen.value) { noPhotosOpen.value = false; return }
  if (detachOpen.value) { closeDetach(); return }
  if (deleteOpen.value) { closeDelete(); return }
  if (heroOpen.value) { closeHeroPicker(); return }
  if (mergeOpen.value) closeMerge()
}

watch(anyDialogOpen, (open) => {
  if (open) document.addEventListener('keydown', onDocumentKeydown)
  else document.removeEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown))

// ── Lifecycle / watch ────────────────────────────────────────────────────────
// Hard rule 3: the first load is kicked off synchronously during setup (not in onMounted).
void detail.load(personId.value)
// The merge dialog's candidate list needs the full people list; only fetch it here if it
// hasn't been loaded yet.
if (!people.peopleLoaded) void people.fetchPeople()

// Hard rule 2: hash routing doesn't remount the same component.
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return                   // Disclosure K: already left this route, don't fire a wasted load
  selectedIds.value = []
  tab.value = 'timeline'
  closeAllDialogs()
  void detail.load(personId.value)
})
</script>

<template>
  <!-- An unnamed person's name is an empty string — use `||` rather than a ternary,
       otherwise the header title would be blank (same fallback idea as T12's displayName,
       but the fallback here is the area's name rather than "this person"). -->
  <AreaShell :title="detail.person.value?.name || t('photosPeople')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Gating ①: still loading and no data yet → skeleton -->
        <div v-if="detail.loading.value && !detail.person.value" class="person-skeleton" data-test="person-skeleton">
          <div class="person-skeleton-hero" />
          <div class="person-skeleton-tabs" />
          <div class="person-skeleton-grid">
            <div v-for="i in 16" :key="i" class="person-skeleton-tile" />
          </div>
        </div>

        <!-- Gating ②: load failed (≠ "this person doesn't exist") → error copy + retry.
             Coordinator's ruling 4: T9's failed flag exists specifically so the view can
             tell these two "person is null" cases apart; Vue2 only console.errors, and the
             two look identical on screen. -->
        <div v-else-if="!detail.person.value && detail.failed.value" class="empty-state" data-test="person-load-failed">
          <div class="empty-state-title">{{ t('photosPersonLoadFailed') }}</div>
          <!-- Review Minor 3: this used to have :disabled="detail.loading.value" — the
               gating precondition is already !loading, so that binding was always false;
               removed (rationale in the retryLoad comment). -->
          <button
            type="button" class="pd-btn" data-test="person-retry"
            @click="retryLoad"
          >{{ t('photosPersonRetry') }}</button>
        </div>

        <!-- Gating ③: finished loading and this person really doesn't exist -->
        <div v-else-if="!detail.person.value" class="empty-state" data-test="person-not-found">
          <div class="empty-state-title">{{ t('photosPersonNotFound') }}</div>
          <button type="button" class="pd-btn" data-test="person-not-found-back" @click="goToPeopleList">
            {{ t('photosPersonBack') }}
          </button>
        </div>

        <!-- Gating ④: normal content -->
        <template v-else>
          <PersonHero
            :person="detail.person.value"
            :relation-count="detail.relations.value.length"
            :places-count="detail.person.value.placesCount"
            @back="goToPeopleList"
            @toggle-fav="onToggleFav"
            @rename="openRename"
            @merge="openMerge"
            @delete="openDelete"
            @pick-relation="onPickRelation"
            @make-album="openMakeAlbum"
            @open-hero-picker="openHeroPicker"
          />

          <!-- Tabs (Vue2 :95-105) -->
          <div class="detail-tabs">
            <button
              type="button" class="detail-tab" data-test="person-tab-timeline"
              :data-active="tab === 'timeline'" @click="tab = 'timeline'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {{ t('photosPersonTabTimeline') }}
            </button>
            <button
              type="button" class="detail-tab" data-test="person-tab-places"
              :data-active="tab === 'places'" @click="tab = 'places'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {{ t('photosPersonTabPlaces') }}
            </button>
            <button
              type="button" class="detail-tab" data-test="person-tab-relations"
              :data-active="tab === 'relations'" @click="tab = 'relations'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
              {{ t('photosPersonTabRelations') }}
            </button>
          </div>

          <div class="detail-body scroll">
            <!-- Timeline tab: co-occurrence strip (Vue2 :108-130) + monthly asset grid (T11) -->
            <template v-if="tab === 'timeline'">
              <div class="detail-section">
                <div class="detail-section-title">
                  {{ t('photosPersonSameFrame') }}
                  <span class="sub">{{ t('photosPersonSameFrameSub', { name: displayName }) }}</span>
                </div>
                <div class="coappear-strip">
                  <div
                    v-for="r in sortedRelations" :key="r.personId"
                    class="coappear-card" data-test="coappear-card"
                    :data-person-id="String(r.personId)"
                    @click="goToPerson(r.personId)"
                  >
                    <!-- Size 72px: confirmed by checking back against Vue2
                         photos-people.scss:701-703 (disclosure L) -->
                    <PersonAvatar :person-id="r.personId" :name="r.name" :ver="r.coverFaceId" :size="72" />
                    <div class="name-row">
                      <span class="nm">{{ r.name }}</span>
                      <span class="ct">{{ r.count.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <PersonAssetGrid
                :months="detail.months.value"
                :selected="selectedIds"
                :selection-mode="selectionMode"
                @open="onTileClick"
                @toggle-select="toggleSelect"
                @detach="openDetach"
              />
            </template>

            <PersonPlacesTab
              v-else-if="tab === 'places'"
              :places="detail.places.value"
              :person-name="detail.person.value.name"
            />

            <PersonRelationsTab
              v-else
              :relations="detail.relations.value"
              :person="detail.person.value"
              :places="placeGroups"
              @open-person="goToPerson"
            />
          </div>
        </template>
      </main>
    </div>
  </AreaShell>

  <!-- Selection-mode floating bar (Vue2 :232-244). Placed outside AreaShell:
       position:fixed, so it isn't clipped by an ancestor's transform/overflow (same
       precedent as PhotosPeople.vue:624). -->
  <div v-if="selectionMode && detail.person.value" class="selection-bar" data-test="person-selection-bar">
    <div class="selection-count">{{ t('photosSelectedCount', { count: selectedIds.length }) }}</div>
    <div class="selection-spacer" />
    <button
      v-if="selectedIds.length === 1"
      type="button" class="selection-btn selection-btn-star" data-test="person-set-key-photo"
      @click="onSetKeyPhoto"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
      {{ t('photosPersonSetKeyPhoto') }}
    </button>
    <button
      type="button" class="selection-btn selection-btn-danger" data-test="person-remove-from"
      @click="openDetach(selectedIds)"
    >
      <!-- Review Must-fix 2: in Vue2 :240 this button has an x icon (size 13), the
           original implementation left it out -->
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      {{ t('photosPersonRemoveFrom', { name: displayName }) }}
    </button>
    <button type="button" class="selection-btn" data-test="person-selection-cancel" @click="exitSelectionMode">
      {{ t('photosCancel') }}
    </button>
  </div>

  <!-- ── Dialog 1: rename (Vue2 :268-285's rename mode) ── -->
  <div v-if="renameOpen" class="pd-scrim" data-test="person-rename-dialog" @click.self="closeRename">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">{{ t('photosPersonRename') }}</div>
          <div class="pd-sub">{{ t('photosPersonRenameHint') }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeRename">×</button>
      </div>
      <label class="pd-label">{{ t('photosPersonNameLabel') }}</label>
      <input
        ref="renameInputRef" v-model="renameInput" class="pd-input" data-test="person-rename-input"
        :placeholder="t('photosPersonNamePlaceholder')" @keydown.enter="confirmRename"
      >
      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="closeRename">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-primary" data-test="person-rename-confirm"
          :disabled="!renameInput.trim()" @click="confirmRename"
        >{{ t('photosPersonSaveName') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 2: create album (Vue2 :268-285's album mode) ── -->
  <div v-if="albumOpen" class="pd-scrim" data-test="person-album-dialog" @click.self="closeAlbum">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="pd-sub">{{ t('photosPersonAlbumHint', { n: albumIds.length }) }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeAlbum">×</button>
      </div>
      <label class="pd-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="albumInputRef" v-model="albumInput" class="pd-input" data-test="person-album-input"
        :placeholder="t('photosAlbumNamePlaceholder')" @keydown.enter="confirmCreateAlbum"
      >
      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="closeAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-primary" data-test="person-album-confirm"
          :disabled="!albumInput.trim()" @click="confirmCreateAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 7 (Vue2 promptDialog's info mode :845-851; added back beyond the brief's
       six-dialog list) ── -->
  <div v-if="noPhotosOpen" class="pd-scrim" data-test="person-no-photos-dialog" @click.self="noPhotosOpen = false">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">{{ t('photosPersonNoPhotosTitle') }}</div>
          <div class="pd-sub">{{ t('photosPersonNoPhotosAlbumHint') }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="noPhotosOpen = false">×</button>
      </div>
      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="noPhotosOpen = false">{{ t('photosCancel') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 3: detach confirm (Vue2 :268-285's detach mode) ── -->
  <div v-if="detachOpen" class="pd-scrim" data-test="person-detach-dialog" @click.self="closeDetach">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">
            {{ detachIds.length === 1
              ? t('photosPersonDetachTitleOne', { name: displayName })
              : t('photosPersonDetachTitleMany', { name: displayName, n: detachIds.length }) }}
          </div>
          <div class="pd-sub">
            {{ detachIds.length === 1
              ? t('photosPersonDetachHintOne', { name: displayName })
              : t('photosPersonDetachHintMany', { name: displayName, n: detachIds.length }) }}
          </div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeDetach">×</button>
      </div>
      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="closeDetach">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-danger" data-test="person-detach-confirm"
          @click="confirmDetach"
        >{{ t('photosPersonDetachConfirm') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 4: delete person confirm (Vue2 :290-323) ── -->
  <div v-if="deleteOpen" class="pd-scrim" data-test="person-delete-dialog" @click.self="closeDelete">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <!-- Review Minor 4: this was mistakenly using photosPersonDeleteTitle
               (= "Delete this person group?", a different string dedicated to T7's warning
               strip — ClusterActionDialog.vue:66's comment already declares it off-limits
               for reuse). Vue2 :304 is "Delete person?", so a dedicated key was added. -->
          <div class="pd-title">{{ t('photosPersonDeletePersonTitle') }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeDelete">×</button>
      </div>
      <!-- Review Minor 6: Vue2 :310-312 uses two shades of gray — body text (--text-2) +
           the dimmer "You can undo within 5 seconds." (--text-3). The original
           implementation merged these into a single color. -->
      <div class="pd-body">
        {{ t('photosPersonDeleteKeptBody') }}
        <span class="pd-body-dim">{{ t('photosPersonDeleteUndoHint') }}</span>
      </div>
      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="closeDelete">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-danger" data-test="person-delete-confirm"
          @click="confirmDeletePerson"
        >
          <!-- Review Must-fix 2: in Vue2 :319 this button has a trash icon (size 11), the
               original implementation left it out -->
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
          {{ t('photosPersonDelete') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 5: hero picker (wide dialog, Vue2 :325-371) ── -->
  <div v-if="heroOpen" class="pd-scrim" data-test="person-hero-dialog" @click.self="closeHeroPicker">
    <div class="pd-panel pd-panel-wide">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">{{ t('photosPersonHeroTitle') }}</div>
          <div class="pd-sub">{{ t('photosPersonHeroSub') }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeHeroPicker">×</button>
      </div>

      <div class="hero-picker-grid">
        <button
          v-for="p in allPhotos" :key="p.id"
          type="button" class="hero-picker-tile" data-test="hero-picker-tile"
          :data-selected="String(heroSelectedId) === String(p.id)"
          @click="heroSelectedId = p.id"
        >
          <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="">
          <!-- Review Must-fix 2: in Vue2 :352 the badge is a play icon + duration; T11's
               PersonAssetGrid.vue:118 already renders this same visual element with ▶ this
               sprint, so it's added back here the same way. -->
          <span v-if="p.isVideo" class="hero-picker-vid">
            <span class="vid-play">▶</span> {{ p.duration }}
          </span>
          <span v-if="String(heroSelectedId) === String(p.id)" class="hero-picker-check">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
        </button>
        <div v-if="!allPhotos.length" class="hero-picker-empty">{{ t('photosPersonNoPhotos') }}</div>
      </div>

      <div class="pd-actions">
        <button type="button" class="pd-btn pd-btn-ghost" data-test="person-hero-use-key" @click="onUseKeyPhoto">
          {{ t('photosPersonUseKeyPhoto') }}
        </button>
        <button type="button" class="pd-btn" @click="closeHeroPicker">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-primary" data-test="person-hero-save"
          :disabled="heroSelectedId === null" @click="onSaveHero"
        >{{ t('photosPersonSaveHero') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 6: merge into another person (Vue2 :374-432) ── -->
  <div v-if="mergeOpen" class="pd-scrim" data-test="person-merge-dialog" @click.self="closeMerge">
    <div class="pd-panel">
      <div class="pd-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="pd-titles">
          <div class="pd-title">{{ t('photosPersonMergeInto') }}</div>
          <div class="pd-sub">{{ t('photosPersonMergeIntoSub') }}</div>
        </div>
        <button type="button" class="pd-close" :aria-label="t('photosClose')" @click="closeMerge">×</button>
      </div>

      <input
        v-model="mergeQuery" class="pd-input" data-test="person-merge-search"
        :placeholder="t('photosPersonMergeSearch')"
      >

      <div class="merge-list">
        <button
          v-for="p in mergeCandidates" :key="p.id"
          type="button" class="merge-row" data-test="person-merge-candidate"
          :data-person-id="String(p.id)"
          :data-selected="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
          @click="mergeTarget = p"
        >
          <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="36" />
          <span class="merge-info">
            <span class="merge-name">{{ p.name }}</span>
            <span class="merge-meta">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</span>
          </span>
          <svg
            v-if="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
            class="merge-check" viewBox="0 0 24 24" width="13" height="13" fill="none"
            stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M5 13l4 4L19 7" /></svg>
        </button>
        <div v-if="!mergeCandidates.length" class="merge-empty">{{ t('photosPersonNoMatch') }}</div>
      </div>

      <div class="pd-actions">
        <button type="button" class="pd-btn" @click="closeMerge">{{ t('photosCancel') }}</button>
        <button
          type="button" class="pd-btn pd-btn-primary" data-test="person-merge-confirm"
          :disabled="mergeTarget === null" @click="confirmMerge"
        >
          <!-- Review Must-fix 2: in Vue2 :427 this button has a sparkles icon (size 13)
               once a target is selected, and doesn't render it while unselected
               (`v-if="mergeConfirmTarget"`); the original implementation left the whole
               icon out. -->
          <svg v-if="mergeTarget !== null" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
          {{ mergeTarget
            ? t('photosPersonMergeConfirm', { name: mergeTarget.name })
            : t('photosPersonMergeSelectPrompt') }}
        </button>
      </div>
    </div>
  </div>

  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="() => {}" />
</template>

<style scoped>
/* Fix round 1 (controller-adjudicated, task-3-report.md Disclosure 1): this page still
   uses the old flex-row `.photos-layout` shell (its own re-skin task hasn't landed yet), but
   its root now carries `.photos-root` so the shared PhotosSidebar's Vue2 `.sidebar` root gets
   the parity look. Parity scss deliberately sets no width on `.sidebar` itself (real
   pixel-parity width comes from the `.app` CSS Grid column Task 3 gave Photos.vue) — pin it
   here so the sidebar doesn't collapse to its shrink-to-fit content width in this page's
   flex row. Transitional: drop this rule once this page gets its own `.app` grid re-skin. */
.sidebar { flex: 0 0 var(--sidebar-w); align-self: stretch; overflow-y: auto; }

/* height (not min-height): this screen has a hard cap, and only the inner scroll container
   scrolls — a same-origin fix; see the comment on the same rule in src/views/Photos.vue for
   the Vue2 rationale. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px; color: var(--fg-muted); text-align: center;
}
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }

/* ── Skeleton (added by New-UI: in Vue2, the whole template gets v-if'd away when person
      is null, so the first frame is entirely blank) ── */
.person-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.person-skeleton-hero { height: 280px; border-radius: 20px; background: var(--skeleton-bg); }
.person-skeleton-tabs { height: 42px; border-radius: 10px; background: var(--skeleton-bg); }
.person-skeleton-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
.person-skeleton-tile { aspect-ratio: 1; border-radius: 3px; background: var(--skeleton-bg); }

/* ── Tabs (following photos-people.scss:445-465; Vue2's --line/--text-3/--text-1 are
      replaced with --divider/--fg-muted/--fg) ── */
.detail-tabs {
  flex: none; display: flex; gap: 4px; padding: 0 8px;
  border-bottom: 1px solid var(--divider);
}
.detail-tab {
  padding: 12px 14px 11px; font: inherit; font-size: 13px; font-weight: 500;
  color: var(--fg-muted); background: transparent; border: 0;
  border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.detail-tab:hover { color: var(--fg); }
.detail-tab[data-active="true"] { color: var(--fg); border-bottom-color: var(--accent); }

/* ── Body (following photos-people.scss:467-472) ── */
.detail-body { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 8px 80px; }

/* ── Co-occurrence strip (following photos-people.scss:685-722) ── */
.detail-section { margin-top: 8px; margin-bottom: 22px; }
.detail-section-title {
  font-family: var(--font); font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
  margin: 0 0 14px; display: flex; align-items: baseline; gap: 10px; color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font); font-size: 12px; font-weight: 400;
  color: var(--fg-muted); letter-spacing: 0;
}
.coappear-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.coappear-strip::-webkit-scrollbar { height: 0; }
.coappear-card {
  flex: none; width: 96px; display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 8px 4px; border-radius: var(--radius-sm); cursor: pointer;
}
.coappear-card:hover { background: var(--hover); }
.coappear-card .name-row { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; }
.coappear-card .nm {
  font-size: 12px; font-weight: 500; max-width: 88px; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.coappear-card .ct { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }

/* ── Selection-mode floating bar (following Vue2 :1224-1276; --pop-bg → --popup-bg,
      --ink mix → --chip-bg) ── */
.selection-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 14px; box-shadow: var(--card-shadow-hi);
  backdrop-filter: var(--blur); min-width: 360px;
}
.selection-count { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }
.selection-spacer { flex: 1; }
.selection-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px;
  font: inherit; font-size: 12.5px; font-weight: 500; color: var(--fg);
  background: var(--chip-bg); border: 1px solid var(--chip-border);
  border-radius: 999px; cursor: pointer;
}
.selection-btn:hover { background: var(--chip-bg-hi); }
/* --star-fg isn't defined separately in either theme — an established precedent in this
   repo (PhotosGrid.vue / PersonAvatar.vue / PersonHero.vue all use var(--star-fg, #ffd60a))
   — the gold star stays fixed across skins, expressed via the var(fallback) form, and the
   color-guard allows this as legitimate token usage. */
.selection-btn-star {
  color: var(--star-fg, #ffd60a);
  background: color-mix(in srgb, var(--star-fg, #ffd60a) 12%, transparent);
  border-color: color-mix(in srgb, var(--star-fg, #ffd60a) 30%, transparent);
  font-weight: 600;
}
.selection-btn-star:hover { background: color-mix(in srgb, var(--star-fg, #ffd60a) 20%, transparent); }
.selection-btn-danger {
  color: var(--remove-fg);
  background: color-mix(in srgb, var(--remove-fg) 12%, transparent);
  border-color: color-mix(in srgb, var(--remove-fg) 40%, transparent);
  font-weight: 600;
}
.selection-btn-danger:hover { background: color-mix(in srgb, var(--remove-fg) 20%, transparent); }

/* ── Dialog shell (following Vue2 :1278-1395; all seven dialogs share this set of CSS
      classes but each draws its own template — P4 has already logged "no shared modal
      shell component" as an established convention) ── */
.pd-scrim {
  position: fixed; inset: 0; z-index: 220;
  background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 40px 20px;
}
/* A P2 lesson learned the hard way: the panel background must use --popup-bg, not
   --card-bg (nearly transparent in the dark theme, and you can see through it). */
.pd-panel {
  width: 460px; max-width: 100%; max-height: 100%; overflow-y: auto;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; padding: 22px; box-shadow: var(--card-shadow-hi);
  display: flex; flex-direction: column; gap: 14px;
}
.pd-panel-wide { width: 560px; }
.pd-head { display: flex; align-items: center; gap: 12px; }
.pd-titles { flex: 1; min-width: 0; }
.pd-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.pd-sub { font-size: 11.5px; color: var(--fg-subtle); margin-top: 2px; line-height: 1.5; }
.pd-close {
  width: 26px; height: 26px; flex: none; border: 0; border-radius: 50%;
  background: transparent; color: var(--fg-muted); font-size: 16px; line-height: 1;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.pd-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
.pd-label { font-size: 11.5px; color: var(--fg-muted); margin-bottom: -6px; }
.pd-body { font-size: 12.5px; color: var(--fg-muted); line-height: 1.6; }
/* Review Minor 6: Vue2 :312's second-shade gray (--text-3). This repo's --fg-subtle is
   defined in both themes (confirmed by grepping theme.css) and is the same shade
   .pd-sub uses — semantically consistent: a lighter-weight supplementary note than the
   body text. */
.pd-body-dim { color: var(--fg-subtle); }
.pd-input {
  width: 100%; height: 38px; padding: 0 12px; box-sizing: border-box;
  background: var(--chip-bg); border: 1px solid var(--chip-border);
  border-radius: 10px; color: var(--fg); font: inherit; font-size: 13px; outline: none;
}
.pd-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.pd-actions {
  display: flex; gap: 10px; padding-top: 12px; margin-top: 2px;
  border-top: 1px solid var(--divider);
}
.pd-btn {
  flex: 1; height: 38px; border-radius: 10px;
  background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.pd-btn:hover { background: var(--chip-bg-hi); }
.pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pd-btn-primary {
  flex: 1.4; background: var(--accent); border-color: transparent;
  /* The one legitimate scenario for --on-accent: the background is var(--accent) as a
     saturated solid fill. */
  color: var(--on-accent); font-weight: 600;
}
.pd-btn-primary:hover { background: var(--accent); filter: brightness(1.08); }
.pd-btn-primary:disabled { filter: none; }
.pd-btn-ghost { background: transparent; color: var(--fg-muted); }
.pd-btn-ghost:hover { background: var(--chip-bg-hi); color: var(--fg); }
.pd-btn-danger {
  color: var(--remove-fg);
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent);
  background: color-mix(in srgb, var(--remove-fg) 8%, transparent);
}
.pd-btn-danger:hover { background: color-mix(in srgb, var(--remove-fg) 16%, transparent); }

/* ── Hero picker grid (following Vue2 :1453-1497) ── */
.hero-picker-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px;
  max-height: 340px; overflow-y: auto; border-radius: 10px; padding: 2px;
}
.hero-picker-tile {
  position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden;
  cursor: pointer; padding: 0; background: var(--chip-bg);
  border: 2px solid transparent;
  /* Following Vue2 :1474 — selection-state switching has a transition, not a hard cut
     (this also covers the outer glow added below) */
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hero-picker-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Final review Minor 4: added back the outer glow from Vue2 :1482-1485. This repo has no
   --accent-glow token (confirmed by grepping both theme blocks in theme.css); in Vue2 its
   value is a 35%-opacity version of accent (photos.scss:18), so here it's computed on the
   fly from --accent with color-mix, matching the existing approach PhotosPeople.vue takes
   for the same token. Without this glow, the 2px border is nearly impossible to spot among
   densely packed 100px tiles. */
.hero-picker-tile[data-selected="true"] {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
}
.hero-picker-vid {
  position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 999px;
  font-size: 9px; background: var(--overlay-bg);
  display: inline-flex; align-items: center; gap: 3px;
  /* theme-exception: the duration badge overlaid on the photo thumbnail needs a fixed
     light foreground across themes (same precedent as PersonAssetGrid.vue's .tile-vid;
     rationale in PersonHero.vue's file-header "color red line"). */
  color: #fff;
}
/* Identical, verbatim, to T11 PersonAssetGrid.vue's .vid-play (same visual element, same
   font size). */
.vid-play { font-size: 7px; }
.hero-picker-check {
  position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--on-accent);
}
.hero-picker-empty {
  grid-column: 1 / -1; padding: 40px; text-align: center;
  color: var(--fg-muted); font-size: 13px;
}

/* ── Merge candidate list (following Vue2 :1511-1560) ── */
.merge-list {
  max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
}
.merge-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); border-radius: 8px;
  color: var(--fg); font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.merge-row:hover { background: var(--chip-bg-hi); }
.merge-row[data-selected="true"] { background: var(--accent-soft); border-color: var(--accent-soft); }
.merge-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.merge-name { font-weight: 500; color: var(--fg); }
.merge-meta { font-size: 11px; color: var(--fg-subtle); font-variant-numeric: tabular-nums; }
/* Vue2 :414 hardcodes this checkmark to the old theme's brand-purple literal; here it
   follows the current theme's accent color instead. */
.merge-check { flex: none; color: var(--accent-text); }
.merge-empty { padding: 24px; text-align: center; color: var(--fg-muted); font-size: 12.5px; }

@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .person-skeleton-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
