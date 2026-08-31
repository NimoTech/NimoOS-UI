<script setup lang="ts">
// Person detail view container. Ported line-by-line against the Vue 2 panel's
// src/views/Photos/PhotosPersonDetail.vue (1561 lines): four-state gating (skeleton /
// load failed + retry / person not found / normal) + PersonHero +
// three tabs (self-drawn co-occurrence strip on the timeline + PersonAssetGrid /
// PersonPlacesTab / PersonRelationsTab) + selection-mode floating bar +
// **seven self-drawn dialogs** (rename / create album / "no photos available" notice /
// remove confirm / delete confirm / hero picker / merge into another person — six core
// dialogs; the third is Vue2's promptDialog info mode :845-851, added back per
// disclosure B) + PhotoLightbox wiring.
//
// This file only orchestrates: data lives in usePersonDetail, writes go through
// usePhotosPeople / usePhotosAlbums, display is handled by the three tabs. The call/success/failure
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
// ── Deliberate deviations from Vue2 (all documented here) ────────────────
//  A) In Vue2, hero/tab content is one giant component; here it's split into four
//     subcomponents T10-T13, and the container just wires up emits.
//  B) Vue2 uses a single promptDialog object to carry four modes: rename/album/detach/info;
//     here it's split into four independent switches + their own state (following the P3/P4
//     convention of each dialog drawing itself rather than sharing a common shell; CSS
//     classes are shared). Vue2's fourth mode, info (:845-851, "no photos available to add to
//     an album"), isn't among the six core dialogs, but it's a real UI element that exists
//     in Vue2 — deliberately added back as the seventh dialog rather than dropped.
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
//     Vue2 (a known flaw, deliberately left unfixed here).
//  I) The hero dialog's four toasts (:681, 683, 694, 696): an earlier draft proposed merging
//     them into two, but checking back against the source found the two entry points' copy genuinely
//     differs in meaning ("reset back to the key photo" vs "change to this selected one") —
//     the coordinator's ruling 3 decided **not to merge them**, adding two keys instead,
//     photosPersonHeroResetToast / photosPersonHeroResetFailed, branching on
//     assetId === null (see saveHero).
//  J) Merge candidate pool: Vue2 uses allPeople (including unnamed) (:517); this
//     deliberately uses people.named excluding self instead. Side effect: candidate
//     names are always non-empty (namedOf guarantees name.trim() !== ''), so Vue2's
//     :406/410 fallback `p.name || $t('Unnamed')` is unreachable here and doesn't render
//     (not a missing render).
//  K) Added a `params.id === undefined` short-circuit to the route watch: after a successful
//     delete/merge, router.push goes to /photos/people (no :id); in Vue2 the parent
//     component unmounts the child so the watch never fires at all; here the component stays
//     mounted, so without the short-circuit it would fire a wasted load('undefined')
//     (PhotosAlbumDetail.vue:323 has the same gap, logged there; plugged directly here).
//  L) Co-occurrence strip avatar size 72px: matches the Vue2 source (verified against
//     photos-people.scss:701-703 `.coappear-card .ring { width:72px; height:72px }`), not
//     the 56px an earlier draft suggested — went with the source (same lesson as T13's 36px).
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
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import PersonHero from '../photos/components/PersonHero.vue'
import PersonAssetGrid from '../photos/components/PersonAssetGrid.vue'
import PersonPlacesTab from '../photos/components/PersonPlacesTab.vue'
import PersonRelationsTab from '../photos/components/PersonRelationsTab.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePersonDetail } from '../photos/composables/usePersonDetail'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { findNamedDuplicate, groupPlaces, type Person } from '../photos/util/peopleView'
import { isConflict, isNotFound } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type Tab = 'timeline' | 'places' | 'relations'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// The same shared composable as PhotosPeople.vue / PhotosAlbums.vue — the collapsed state is a
// singleton across every page in the Photos area, not started fresh here.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
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
// Dialog 1b (Task 7, Plan D): the duplicate-name dupconfirm — Vue2's dupConfirmDialog
// (PhotosPersonDetail.vue:293-314); a rename that collides with an existing person's name
// switches over from dialog 1 (not a substate of dialog 1, a separate dialog — Vue2 itself has
// two distinct data fields here, promptDialog/dupConfirmDialog, unlike the index page's
// ClusterActionDialog which shares one mode state machine).
const dupConfirmOpen = ref(false)
const dupConfirmName = ref('')
const dupConfirmExisting = ref<Person | null>(null)
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

// PhotosTopbar's detail-state copy, matched verbatim against Vue2's
// PhotosPeopleTopbar.vue:7-8/36 (`view === 'detail'` branch) — title = the person's name, with
// empty-name falling back to $t('Unnamed person') (the same fallback key as PersonHero.vue:90's
// heroTitle, not a second one); sub-line = the fixed copy "Person detail · faces & relations",
// not varying with the named/unnamed count (that's the index state's own copy, owned by
// T2/PhotosPeople.vue's topbarSub).
const topbarTitle = computed(() => detail.person.value?.name || t('photosPersonUnnamedTitle'))

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
  dupConfirmOpen.value = false
  dupConfirmName.value = ''
  dupConfirmExisting.value = null
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

// 3) Rename (Vue2 :910-918). applyRename is the actual submit — shared by both the
// naming path and dupNameAnyway (mirroring how Vue2's confirmDialog rename branch :1031 and
// nameAnywayDupConfirm :1009 share one applyRename helper function).
// Guard rationale: the failure path **doesn't close the dialog** (deliberate), so the
// confirm button is still in the DOM and clickable while the request is in flight —
// double-clicking would fire two PATCHes, so the guard earns its value.
async function applyRename(name: string): Promise<void> {
  if (renaming.value) return
  renaming.value = true
  const myId = personId.value                    // Identity guard, see the "Identity guard" section
  try {
    await people.renamePerson(myId, name)
    // Already switched to another person's page: the name belongs to the previous person,
    // so don't write it and don't touch the dialog (closeAllDialogs already closed it long
    // ago).
    if (!detail.patchPerson({ name }, myId)) return
    closeRename()
  } catch {
    if (!detail.isCurrent(myId)) return
    toast.show(t('photosPersonRenamedFailed'))    // Dialog stays open
  } finally {
    renaming.value = false
  }
}

// Task 7 (Plan D): wires up duplicate-name detection (mirroring Vue2's confirmDialog rename
// branch :1022-1032 — findNamedDuplicate(allPeople, v, person.id) switches to dupConfirmDialog on
// a hit, only calling the real applyRename otherwise). `people.people` is the counterpart of
// Vue2's `allPeople` (state.people): the full person list (including unnamed), with excludeId set
// to personId.value to exclude the current person — this lets a rename to a
// case/whitespace-variant of the person's own current name go through without being misjudged as
// a duplicate.
async function confirmRename(): Promise<void> {
  const p = detail.person.value
  const v = renameInput.value.trim()
  if (!p || renaming.value) return
  // Per Vue2 :911: an empty name, or no change at all, just closes without a request.
  if (!v || v === p.name) {
    closeRename()
    return
  }
  const dup = findNamedDuplicate(people.people, v, personId.value)
  if (dup) {
    closeRename()
    dupConfirmName.value = v
    dupConfirmExisting.value = dup
    dupConfirmOpen.value = true
    return
  }
  await applyRename(v)
}

function closeDupConfirm(): void {
  dupConfirmOpen.value = false
  dupConfirmName.value = ''
  dupConfirmExisting.value = null
}
// "Name anyway" (Vue2 nameAnywayDupConfirm :1004-1010): rename using this name regardless.
async function dupNameAnyway(): Promise<void> {
  const name = dupConfirmName.value
  closeDupConfirm()
  await applyRename(name)
}
// "Merge into existing" (Vue2 mergeDupConfirm :1011-1017, via the shared
// mergeCurrentPersonInto): redirects into merging with that already-existing person — reuses the
// existing confirmMerge() submit path (the same success/failure toast, navigation, and in-flight
// guard) instead of duplicating the merge logic.
async function dupMergeIntoExisting(): Promise<void> {
  const target = dupConfirmExisting.value
  closeDupConfirm()
  if (!target) return
  mergeTarget.value = target
  await confirmMerge()
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
    // The same fallback as PhotosPeople.vue's merge toast, so an unnamed target
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

// 10) Hide person (Task 7, Plan D; Vue2 hideCurrentPerson :914-925). Executes immediately, no
// confirmation dialog — non-destructive, can always be undone via unhide from the index page's
// "Hidden people" section (same reasoning as the index page's onHideCluster comment). Doesn't
// need its own in-flight guard: success navigates away from this detail page right away, and on
// failure the button is still right where it was and can be clicked again — the double-click
// window is extremely short and has no lasting side-effect downside (same class of judgment as
// the established "no decorative guards" discipline from T7/T8).
async function onHidePerson(): Promise<void> {
  const p = detail.person.value
  if (!p) return
  const label = p.name.trim() ? `"${p.name.trim()}"` : t('photosPersonUnnamedLabel')
  const ok = await people.hidePerson(personId.value)
  if (ok) {
    void router.push('/photos/people')
    toast.show(t('photosPersonHiddenToast', { label }))
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
  renameOpen.value || dupConfirmOpen.value || albumOpen.value || noPhotosOpen.value || detachOpen.value
  || deleteOpen.value || heroOpen.value || mergeOpen.value)

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // Must be blocked here, otherwise the same Esc press bubbles up to window and closes the
  // lightbox too (caught by P4's final review).
  e.stopPropagation()
  if (renameOpen.value) { closeRename(); return }
  if (dupConfirmOpen.value) { closeDupConfirm(); return }
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
// Task 7 (Plan D): fills the deep-link gap Vue2's own mounted() :650-657 comment calls out — a
// deep link like /photos?person=xyz can open the detail page directly without ever going through
// PhotosPeopleView, so that page's eager fetchHiddenPeople never runs, hiddenPeopleSupported is
// stuck at its stale default, and the Edit menu gets the "Hide person" item's visibility wrong.
// Same store flag, idempotent, only fetched once if it hasn't been fetched yet (same guard style
// as the fetchPeople line above, not Vue2's unconditional re-fetch on every mount).
if (!people.hiddenPeopleLoaded) void people.fetchHiddenPeople()

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
  <!-- The same established structure as PhotosPeople.vue /
       PhotosAlbums.vue:353-367 —
       .photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main >
       PhotosTopbar + .photos-main. The four-state gate as a whole moved into .photos-main, so it
       picks up parity's `.person-detail-fallback` / `.person-skeleton*` rules (anchored on
       .photos-main). -->
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <!-- No back button here —
             Vue2 truth (PhotosPeopleTopbar.vue:6-9/36) is that the People detail topbar always
             shows title+sub, never a back chevron; the back affordance lives in the hero
             (Vue2 `.detail-hero .back`; here that's PersonHero's own `hero-back` button, wired
             to `goToPeopleList` below via `@back`). PhotosTopbar's `back` prop is mutually
             exclusive with title/sub in its own template (built for PhotosSearch.vue's
             exit-search case) — passing it here would have hidden this page's title/sub
             entirely. -->
        <PhotosTopbar
          :collapsed="collapsed"
          :title="topbarTitle"
          :sub="t('photosPersonSubtitle')"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
        <!-- Gating ①: still loading and no data yet → skeleton -->
        <div v-if="detail.loading.value && !detail.person.value" class="person-skeleton" data-test="person-skeleton">
          <div class="person-skeleton-hero" />
          <div class="person-skeleton-tabs" />
          <div class="person-skeleton-grid">
            <div v-for="i in 16" :key="i" class="person-skeleton-tile" />
          </div>
        </div>

        <!-- Gating ②: load failed (≠ "this person doesn't exist") → error copy + retry.
             Coordinator's ruling 4: T9's failed flag exists specifically so the view can tell
             these two "person is null" cases apart; Vue2 only console.errors, and the two look
             identical on screen.
             Final review I1: re-anchored onto parity's own `.person-detail-fallback` /
             `.fallback-body` / `.t` / `.d` / `.btn` selectors (photos-people.scss:1297-1308,
             transcribed from Vue2's own fallback branch, PhotosPersonDetail.vue:461-476) instead
             of this page's old local `.empty-state` family, so parity governs this state's visual
             chrome directly. data-test anchors are unchanged. -->
        <div v-else-if="!detail.person.value && detail.failed.value" class="person-detail-fallback" data-test="person-load-failed">
          <div class="fallback-body">
            <div class="t">{{ t('photosPersonLoadFailed') }}</div>
            <!-- Task 6 (Plan D, PR 137 gap-close): description line was missing — Vue2's PR 137
                 patch added it alongside this title. -->
            <div class="d">{{ t('photosPersonLoadFailedHint') }}</div>
            <!-- Review Minor 3: this used to have :disabled="detail.loading.value" — the
                 gating precondition is already !loading, so that binding was always false;
                 removed (rationale in the retryLoad comment). -->
            <button
              type="button" class="btn" data-test="person-retry"
              @click="retryLoad"
            >{{ t('photosPersonRetry') }}</button>
          </div>
        </div>

        <!-- Gating ③: finished loading and this person really doesn't exist. Final review I1:
             same re-anchor as the failed gate above — see that gate's comment for the
             parity/Vue2 citations. -->
        <div v-else-if="!detail.person.value" class="person-detail-fallback" data-test="person-not-found">
          <div class="fallback-body">
            <div class="t">{{ t('photosPersonNotFound') }}</div>
            <!-- Task 6 (Plan D, PR 137 gap-close): description line was missing — Vue2's PR 137
                 patch added it alongside this title. -->
            <div class="d">{{ t('photosPersonNotFoundHint') }}</div>
            <button type="button" class="btn" data-test="person-not-found-back" @click="goToPeopleList">
              {{ t('photosPersonBack') }}
            </button>
          </div>
        </div>

        <!-- Gating ④: normal content -->
        <template v-else>
          <PersonHero
            :person="detail.person.value"
            :relation-count="detail.relations.value.length"
            :places-count="detail.person.value.placesCount"
            :hidden-people-supported="people.hiddenPeopleSupported"
            @back="goToPeopleList"
            @toggle-fav="onToggleFav"
            @rename="openRename"
            @merge="openMerge"
            @hide="onHidePerson"
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
                      <!-- Task 6 (Plan D, PR 137 gap-close): Vue2 PR 137 patch (PhotosPersonDetail.vue,
                           info-tab co-appear card) added `r.name || $t('Unnamed person')` — this
                           card was missing that fallback. -->
                      <span class="nm">{{ r.name || t('photosPersonUnnamedTitle') }}</span>
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
       </div>
      </main>
    </div>

    <!-- The selection-state floating bar (Vue2 :232-244),
         the seven dialogs below it, and AlbumPickerDialog all move inside .photos-root together
         (a sibling position to .app) — parity's `.photos-root .selection-bar` /
         `.photos-root .person-dialog-scrim` selectors are descendant selectors that can't reach a
         sibling node hung off the template root (the same reasoning as PhotosPeople.vue's own
         Task 2 comment). position:fixed means moving them in here won't get clipped by .app's
         overflow:hidden. -->
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
  <div v-if="renameOpen" class="person-dialog-scrim" data-test="person-rename-dialog" @click.self="closeRename">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonRename') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonRenameHint') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeRename">×</button>
      </div>
      <label class="person-dialog-label">{{ t('photosPersonNameLabel') }}</label>
      <input
        ref="renameInputRef" v-model="renameInput" class="person-dialog-input" data-test="person-rename-input"
        :placeholder="t('photosPersonNamePlaceholder')" @keydown.enter="confirmRename"
      >
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeRename">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-rename-confirm"
          :disabled="!renameInput.trim()" @click="confirmRename"
        >{{ t('photosPersonSaveName') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 1b (Task 7, Plan D): duplicate-name dupconfirm (Vue2 dupConfirmDialog
       :293-314) — button order follows Vue2 literally: Name anyway (ghost) / Cancel (plain) /
       Merge into existing (primary), which differs from the index page's ClusterActionDialog
       order (merge/name-anyway/cancel); each follows its own Vue2 source rather than being forced
       to match. No avatar (Vue2's own version of this dialog has no PersonAvatar at all, just a
       title + close button). -->
  <div v-if="dupConfirmOpen" class="person-dialog-scrim" data-test="person-rename-dupconfirm" @click.self="closeDupConfirm">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonDupExistsTitle', { name: dupConfirmName }) }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeDupConfirm">×</button>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn person-dialog-btn-ghost" data-test="person-rename-dup-name-anyway" @click="dupNameAnyway">
          {{ t('photosPersonDupNameAnyway') }}
        </button>
        <button type="button" class="person-dialog-btn" data-test="person-rename-dup-cancel" @click="closeDupConfirm">
          {{ t('photosCancel') }}
        </button>
        <button type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-rename-dup-merge" @click="dupMergeIntoExisting">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
          {{ t('photosPersonDupMergeInto') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 2: create album (Vue2 :268-285's album mode) ── -->
  <div v-if="albumOpen" class="person-dialog-scrim" data-test="person-album-dialog" @click.self="closeAlbum">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonAlbumHint', { n: albumIds.length }) }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeAlbum">×</button>
      </div>
      <label class="person-dialog-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="albumInputRef" v-model="albumInput" class="person-dialog-input" data-test="person-album-input"
        :placeholder="t('photosAlbumNamePlaceholder')" @keydown.enter="confirmCreateAlbum"
      >
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-album-confirm"
          :disabled="!albumInput.trim()" @click="confirmCreateAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 7 (Vue2 promptDialog's info mode :845-851; added beyond the original
       six-dialog scope because it's a real Vue2 UI element) ── -->
  <div v-if="noPhotosOpen" class="person-dialog-scrim" data-test="person-no-photos-dialog" @click.self="noPhotosOpen = false">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonNoPhotosTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonNoPhotosAlbumHint') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="noPhotosOpen = false">×</button>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="noPhotosOpen = false">{{ t('photosCancel') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 3: detach confirm (Vue2 :268-285's detach mode) ── -->
  <div v-if="detachOpen" class="person-dialog-scrim" data-test="person-detach-dialog" @click.self="closeDetach">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">
            {{ detachIds.length === 1
              ? t('photosPersonDetachTitleOne', { name: displayName })
              : t('photosPersonDetachTitleMany', { name: displayName, n: detachIds.length }) }}
          </div>
          <div class="person-dialog-sub">
            {{ detachIds.length === 1
              ? t('photosPersonDetachHintOne', { name: displayName })
              : t('photosPersonDetachHintMany', { name: displayName, n: detachIds.length }) }}
          </div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeDetach">×</button>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeDetach">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-danger" data-test="person-detach-confirm"
          @click="confirmDetach"
        >{{ t('photosPersonDetachConfirm') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 4: delete person confirm (Vue2 :290-323) ── -->
  <div v-if="deleteOpen" class="person-dialog-scrim" data-test="person-delete-dialog" @click.self="closeDelete">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <!-- Review Minor 4: this was mistakenly using photosPersonDeleteTitle
               (= "Delete this person group?", a different string dedicated to T7's warning
               strip — ClusterActionDialog.vue:66's comment already declares it off-limits
               for reuse). Vue2 :304 is "Delete person?", so a dedicated key was added. -->
          <div class="person-dialog-title">{{ t('photosPersonDeletePersonTitle') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeDelete">×</button>
      </div>
      <!-- Review Minor 6: Vue2 :310-312 uses two dimming tiers — body text (--text-2) +
           the dimmer "You can undo within 5 seconds." (--text-3). The original
           implementation merged these into a single color. -->
      <div class="person-dialog-body">
        {{ t('photosPersonDeleteKeptBody') }}
        <span class="person-dialog-body-dim">{{ t('photosPersonDeleteUndoHint') }}</span>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeDelete">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-danger" data-test="person-delete-confirm"
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
  <div v-if="heroOpen" class="person-dialog-scrim" data-test="person-hero-dialog" @click.self="closeHeroPicker">
    <div class="person-dialog person-dialog-wide">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonHeroTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonHeroSub') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeHeroPicker">×</button>
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
          <span v-if="p.isVideo" class="tile-vid">
            <span class="vid-play">▶</span> {{ p.duration }}
          </span>
          <span v-if="String(heroSelectedId) === String(p.id)" class="hero-picker-check">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
        </button>
        <div v-if="!allPhotos.length" class="hero-picker-empty">{{ t('photosPersonNoPhotos') }}</div>
      </div>

      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn person-dialog-btn-ghost" data-test="person-hero-use-key" @click="onUseKeyPhoto">
          {{ t('photosPersonUseKeyPhoto') }}
        </button>
        <button type="button" class="person-dialog-btn" @click="closeHeroPicker">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-hero-save"
          :disabled="heroSelectedId === null" @click="onSaveHero"
        >{{ t('photosPersonSaveHero') }}</button>
      </div>
    </div>
  </div>

  <!-- ── Dialog 6: merge into another person (Vue2 :374-432) ── -->
  <div v-if="mergeOpen" class="person-dialog-scrim" data-test="person-merge-dialog" @click.self="closeMerge">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonMergeInto') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonMergeIntoSub') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeMerge">×</button>
      </div>

      <input
        v-model="mergeQuery" class="person-dialog-input" data-test="person-merge-search"
        :placeholder="t('photosPersonMergeSearch')"
      >

      <div class="merge-candidates-list">
        <button
          v-for="p in mergeCandidates" :key="p.id"
          type="button" class="merge-candidate-row" data-test="person-merge-candidate"
          :data-person-id="String(p.id)"
          :data-selected="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
          @click="mergeTarget = p"
        >
          <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="36" />
          <span class="merge-candidate-info">
            <span class="merge-candidate-name">{{ p.name }}</span>
            <span class="merge-candidate-meta">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</span>
          </span>
          <svg
            v-if="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
            class="merge-candidate-check" viewBox="0 0 24 24" width="13" height="13" fill="none"
            stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M5 13l4 4L19 7" /></svg>
        </button>
        <div v-if="!mergeCandidates.length" class="merge-candidates-empty">{{ t('photosPersonNoMatch') }}</div>
      </div>

      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeMerge">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-merge-confirm"
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

  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="() => {}" />

  <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body"
       shape as PhotosToastHost (not present on this view) -- Photos has no shared shell to
       mount this once at. -->
  <AskNimoHost />
  </div>
</template>

<style scoped>
/* Shadowing cleanup: the transitional `.sidebar` width pin and the
   flex-row `.photos-layout` rule (a stopgap from back when this page's root only wore
   `.photos-root` without its own `.app` grid) are both dead now — the real `.app` CSS Grid
   this page now has supplies the sidebar's column width directly, same as
   PhotosPeople.vue/PhotosAlbums.vue's own re-skin. `.photos-main` stays: no parity selector
   exists by that name (it's this page's own scroll-region scaffolding), same as those two
   pages' own local copy. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Final review C1/I1: every remnant family below that shared an anchor with parity but disagreed
   on values (`.person-skeleton*`, `.detail-tabs`/`.detail-tab`, `.detail-body`,
   `.detail-section*`, `.coappear-*`, the `.selection-bar` family, and the old `.empty-state`
   fallback rules) has been deleted so parity — the Vue2 pixel truth —
   (src/photos/styles/vue2-parity/photos-people.scss) governs those elements directly instead of
   an equal-specificity coin flip decided by stylesheet load order. The fallback gates (loading
   failed / not found) were also re-anchored onto parity's own `.person-detail-fallback` /
   `.fallback-body` / `.t` / `.d` / `.btn` selectors (see the template's own comment), so the old
   local `.empty-state`/`.empty-state-title` rules had no remaining consumer here and were
   removed along with them. Only two kinds of rule survive below: genuine New-UI-only additions
   with no parity counterpart at all, and the two dialog-shell survivors documented in their own
   comments. */

/* Survivor 1: parity's `.person-dialog-btn` matches Vue2 itself byte-for-byte — Vue2's source
   (the Vue 2 panel's .../PhotosPersonDetail.vue:1476-1488) has no flex layout at all, because Vue2's icon
   is a `<photos-icon>` component that aligns itself. New-UI's delete-confirm / merge-confirm
   buttons embed a bare `<svg>` + text instead, and without this layout the icon and text would be
   misaligned (inconsistent baseline). This is New-UI's own typography enhancement, not something
   parity omitted, so it stays local rather than going into parity (parity must stay byte-for-byte
   faithful to Vue2). */
.person-dialog-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}

/* Survivor 2: matches T11 PersonAssetGrid.vue's `.vid-play` byte-for-byte (same visual element,
   same font size) — Vue2 has no equivalent class here (it uses `<photos-icon name="play"/>`);
   `.vid-play` is New-UI's own way of sizing the ▶ character, and PersonAssetGrid.vue keeps its
   own local scoped copy of it, so this file keeps a matching copy too rather than moving it into
   parity (parity only takes rules genuinely shared across components). */
.vid-play { font-size: 7px; }
</style>
