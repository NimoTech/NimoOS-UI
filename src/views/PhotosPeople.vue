<script setup lang="ts">
// Task 6 (SP7-P5 People): people list view — banner + confidence dropdown + filter/sort row +
// two warning banners + merge-suggestion banner + Pinned/Named/Unnamed three-section grid +
// floating action menu + empty state.
// Ported section-by-section against Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:2-235
// and src/views/Photos/photos-people.scss:1-275; the Ask Nimo branch is not built, per the brief.
// Shell copied from PhotosAlbums.vue:185-188's AreaShell/.photos-layout/PhotosSidebar/.photos-main
// (not factored out into a shared component, per the P3/P4 decision). Document-level listeners
// follow PhotosAlbums.vue:159-181.
//
// T7 (added this round): wires up ClusterActionDialog (the name/merge/delete three-mode dialog);
// `dialog` state moves from T6's hidden placeholder node to a real dialog. The store calls,
// reentrancy guards, and toasts for all three submit paths (renamePerson/mergePersonInto/
// purgePersonWithUndo) all live here — the dialog itself only emits (division of labor matches
// the header comment in ClusterActionDialog.vue). Route registration and the sidebar entry
// belong to T16.
//
// T8 (added this round): wires up MergeReviewDialog (the merge-suggestion review dialog);
// `reviewOpen`/`reviewIdx` move from T7's leftover hidden placeholder node to a real dialog. The
// store calls, independent in-flight guards, toasts, and index clamping for both the accept/
// reject submit paths all live here (same division of labor as above — the dialog itself only
// emits). Why the clamping logic lives in the host rather than the dialog: the host is the one
// holding both the suggestions array and the index state (the brief explicitly requires this).
//
// Two Vue2 bug fixes for T7 (explicitly required by the brief, not copied as-is):
//  8) Vue2 confirmMergeTo :654-660 doesn't await the potentially-rejecting mergeClusterInto, and
//     **fires the "merged" success toast before closing the dialog** — if the merge fails, the
//     user still sees a fake "merged into xxx" success message, and the promise rejection is
//     never handled at all (unhandled rejection). Fixed here to await + only toast the success
//     copy on the success path; the failure path toasts `photosPersonMergeFailed`.
//  9) Vue2's toast reference on this page is broken (already logged in T6 Disclosure 1: it
//     default-imports photosToast.js, which has no matching export, so all four call sites
//     actually throw TypeError). All three submit-path toasts go through this repo's useToast().
//
// Deviations from Vue2 logged (Vue2 bugs not copied as-is):
//  1) Vue2's toast on this page is broken: PhotosPeopleView.vue:441 default-imports
//     photosToast.js, which has no matching export, so all four PhotosToast.show(...) call
//     sites actually throw TypeError. Within this task's scope there are no toast call sites
//     (the menu only sets state), so useToast isn't pulled in here; T7/T8 use this repo's
//     useToast() consistently once the dialogs land.
//  2) Vue2 has no Esc-to-close at all (all three overlays rely purely on outside-click). Added
//     a document keydown handler here per this repo's overlay convention.
//  3) Vue2 :8-10's second separator dot renders unconditionally, leaving a dangling dot when
//     facesIndexedUpTo is empty. Here it's v-if'd together with the indexed-date segment
//     instead, so that visual leftover isn't reproduced.
//  4) Vue2 :96-97 renders "Settings · AI behavior" as an <a href="#"> that emits
//     $emit('open-settings') on click. The New-UI settings page belongs to P8, so this renders
//     as emphasized text (not a link) rather than leaving a dead fake link.
//  5) Vue2 :575-579 hardcodes the indexed date to the 'en' locale; here it follows the i18n
//     locale instead (Deviation 9).
//  6) Hard rule: every "current item === loop item" / "find object by id" comparison uses
//     String-value equality, never reference equality.
//  7) Vue2 :97 hardcodes an English period after the settings link (mixed Chinese/English
//     punctuation under the Chinese UI, and it can't be localized) — not reproduced here; see
//     the inline comment at that spot for details.
//
// Two copy strings T3 missed were backfilled by the coordinator (zh_CN.json:2072 / :2079), added
// to both locales, and rendered per Vue2: photosPeopleMinScore (confidence dropdown subheading,
// :24-26), photosPeopleClusterHint (unnamed-card hover tooltip, :204, along with the
// scss:242-243 .ct / .name-action hover swap, backfilled together).
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import ClusterActionDialog from '../photos/components/ClusterActionDialog.vue'
import MergeReviewDialog, { type MergeSuggestion } from '../photos/components/MergeReviewDialog.vue'
import { usePhotosPeople } from '../photos/stores/people'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import {
  mergeConfidencePct, mergeReasonKey, sortNamed, unnamedCountAt, type Person,
} from '../photos/util/peopleView'

type FilterId = 'all' | 'family' | 'friend' | 'work' | 'recent'
type SortId = 'freq' | 'name' | 'recent' | 'oldest'
type DialogMode = 'name' | 'merge' | 'delete'

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
const router = useRouter()
const people = usePhotosPeople()
const timeline = useTimelineStore()
const settings = usePhotosSettingsStore()
const toast = useToast()

// Vue2 :448
const CONFIDENCE_OPTIONS = [50, 60, 70, 80, 90, 95]

// Vue2 data() :461-472. sort is deliberately not persisted (matching Vue2); confidence/
// showSingletons are persisted in the store.
const filter = ref<FilterId>('all')
const sort = ref<SortId>('freq')
const showUnnamed = ref(true)
const confidenceOpen = ref(false)
const sortOpen = ref(false)
const clusterMenu = ref<{ person: Person; x: number; y: number } | null>(null)
// T7 three-mode dialog state (wired to a real dialog this round) / T8 review dialog state
// (still a placeholder node).
const dialog = ref<{ mode: DialogMode; person: Person } | null>(null)
const reviewOpen = ref(false)
const reviewIdx = ref(0)
// Independent in-flight guards for naming/merging (hard constraint from the brief: this class
// of bug was caught three times during the P4 phase). The two refs are kept separate and not
// shared — same rationale as the AlbumPickerDialog.vue:35-42 precedent: both paths can be
// triggered back-to-back in real usage (e.g. immediately clicking merge right after a naming
// success), and sharing one flag would let two unrelated operations block each other.
//
// Review-mandated fix 2 (second round, deletingSubmitting ref removed): the delete path
// originally added its own independent `deletingSubmitting` ref following this same shape, but
// review did a delete-and-verify pass — `onSubmitDelete` never `await`s anything (
// purgePersonWithUndo synchronously returns an undo closure), the function body runs to
// completion within a single dispatchEvent, and `dialog.value = null` happens **synchronously**
// inside the function body, before there's ever a need for "guard reset". After removing this
// ref entirely (declaration/set/finally-reset), the regression tests stayed green, because what
// actually blocks a second call was always the `!dialog.value` short-circuit at the top of
// `onSubmitDelete`, not this ref — the ref was just decorative "standard shape" with no real
// protective value. The specifics of that delete-and-verify pass and its results are recorded
// in the fix report; this ref is not being added back. Review confirmed the async guards on the
// naming/merging paths are genuinely effective and unaffected.
const namingSubmitting = ref(false)
const mergingSubmitting = ref(false)
// P8a-T6 (§7e-10): facesEnabled used to be a one-off implementation reading /photos/config
// directly in this page's own onMounted (before P8 owned a shared store). Now reads from T1's
// photosSettings store instead — semantics unchanged: missing field/request failure is always
// treated as enabled (don't show the warning banner, better not to scare the user), and that
// defensive semantic is already implemented in store.fetchAiFeatures() (readAiFeatures' `on()`
// predicate) — this is just consuming it, not reimplementing it.
const facesEnabled = computed(() => settings.aiFeatures.faces)

const confMenuRef = ref<HTMLElement | null>(null)
const sortMenuRef = ref<HTMLElement | null>(null)
const clusterMenuRef = ref<HTMLElement | null>(null)

// Re-evaluates on locale hot-switch (per the existing lesson from PhotosAlbums.vue:52-60: use a
// computed, not a constant frozen once).
const sortOptions = computed(() => [
  { id: 'freq' as SortId, label: t('photosPeopleSortFreq'), hint: t('photosPeopleSortFreqHint') },
  { id: 'name' as SortId, label: t('photosPeopleSortName'), hint: t('photosPeopleSortNameHint') },
  { id: 'recent' as SortId, label: t('photosPeopleSortRecent'), hint: t('photosPeopleSortRecentHint') },
  { id: 'oldest' as SortId, label: t('photosPeopleSortOldest'), hint: t('photosPeopleSortOldestHint') },
])
const filterChips = computed(() => [
  { id: 'all' as FilterId, label: t('photosPeopleFilterAll'), count: people.named.length },
  { id: 'family' as FilterId, label: t('photosPeopleFilterFamily'), count: relationCount('family') },
  { id: 'friend' as FilterId, label: t('photosPeopleFilterFriends'), count: relationCount('friend') },
  { id: 'work' as FilterId, label: t('photosPeopleFilterWork'), count: relationCount('work') },
  // recent deliberately has no count badge (per Vue2 :57-59)
  { id: 'recent' as FilterId, label: t('photosPeopleFilterRecent'), count: null },
])

function relationCount(rel: string): number {
  return people.named.filter((p) => p.relation === rel).length
}

// Vue2 :493-508. Sort/relation filtering goes through T1's sortNamed (not reimplemented in the
// view).
const filteredNamed = computed(() => sortNamed(people.named, filter.value, sort.value, Date.now()))
const pinned = computed(() => filteredNamed.value.filter((p) => p.favorite))
const others = computed(() => filteredNamed.value.filter((p) => !p.favorite))
const filteredUnnamed = computed(() => people.visibleUnnamed)
const currentSort = computed(() => sortOptions.value.find((s) => s.id === sort.value) ?? sortOptions.value[0])
// Empty state added by New-UI (Vue2 has none): only shown once the fetch has confirmed success
// and there really are zero people — a failure state must never masquerade as empty.
const isEmpty = computed(() => people.peopleLoaded && people.people.length === 0)

const firstSuggestion = computed(() => people.mergeSuggestions[0] ?? null)
const mergeReasonText = computed(() => {
  const r = mergeReasonKey(firstSuggestion.value as { confidence?: unknown; intoName?: unknown } | null)
  return t(r.key, r.params)
})
function suggestionId(k: 'fromId' | 'intoId'): string | number | null {
  const s = firstSuggestion.value
  const v = s ? (s[k] as string | number | undefined) : undefined
  return v ?? null
}
// Avatar cache-busting version = that person's coverFaceId (same semantics as Vue2 :560-563's
// avatarUrl, but here we only take the ver — the URL is generated internally by PersonAvatar via
// the service). Pass null if the person can't be found.
function verOf(id: string | number | null): string | number | null {
  return id == null ? null : (people.personById(id)?.coverFaceId ?? null)
}

// Deviation logged (plan item 9): Vue2 :575-580 hardcodes the locale to 'en', which shows
// English month names under a Chinese UI. Here it follows the current i18n locale instead
// ('zh_cn' → BCP47 'zh-cn'); an invalid date still returns '' (matching Vue2).
function formatIndexedDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

// The preview count next to each tier in the dropdown (Vue2 :581-584) — computed off the
// current toggle value alone; it does not simulate toggling it.
function previewCount(v: number): number {
  return unnamedCountAt(people.unnamed, v, people.filter.showSingletons)
}

function pickConfidence(v: number): void {
  confidenceOpen.value = false
  people.setConfidence(v)
}
function pickSort(id: SortId): void {
  sort.value = id
  sortOpen.value = false
}
function toggleSingletons(): void {
  people.setShowSingletons(!people.filter.showSingletons)
}
function openPerson(p: Person): void {
  // Vue2 does an in-page switch via $emit('open', p.id); New-UI uses a real route (registered
  // by T16).
  // encodeURIComponent: the backend id is currently numeric/short-string, but it lands in a URL
  // path segment — an id containing `/` `#` `?` would truncate the path into a different route
  // (a review drive-by item). A numeric id is unchanged after encoding, so this doesn't affect
  // existing behavior.
  router.push('/photos/people/' + encodeURIComponent(String(p.id)))
}
function openClusterMenu(p: Person, e: MouseEvent): void {
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  clusterMenu.value = { person: p, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
}
// Added during user acceptance: "View these photos" in the menu. Uses the same "close the menu
// first, then act" ordering as openDialog (the person in the menu is the single source of
// truth, and closing the menu clears it, so it must be pulled out first).
function viewClusterPhotos(): void {
  const p = clusterMenu.value?.person ?? null
  clusterMenu.value = null
  if (!p) return
  openPerson(p)
}
// Vue2 :624-643's three openXxxDialog functions differ only in mode; consolidated into one here.
function openDialog(mode: DialogMode): void {
  const p = clusterMenu.value?.person ?? null
  clusterMenu.value = null
  if (!p) return
  dialog.value = { mode, person: p }
}
function openReview(): void {
  reviewIdx.value = 0
  reviewOpen.value = true
}

// T8: the store's mergeSuggestions is a loose type passed straight through from backend JSON
// (Array<Record<string, unknown>>), while MergeReviewDialog's contract requires the narrower
// MergeSuggestion[] shape — the runtime fields on both actually match (id/fromId/intoId/
// intoName/confidence), so this is just narrowing the type for the dialog's benefit, not a data
// transform.
const reviewSuggestions = computed<MergeSuggestion[]>(
  () => people.mergeSuggestions as unknown as MergeSuggestion[],
)

// Per the brief: the index-clamping logic lives in the host (which holds both suggestions and
// index); the dialog only emits.
// The store's acceptMergeSuggestion/rejectMergeSuggestion already **synchronously** strip this
// suggestion out of mergeSuggestions right at the top of the function (see the header comment
// in people.ts), so the suggestions.length seen here after the await completes already reflects
// the post-removal result — there's no need to decrement it again ourselves.
function clampReviewIndex(): void {
  const len = people.mergeSuggestions.length
  if (len === 0) { reviewOpen.value = false; return }
  if (reviewIdx.value >= len) reviewIdx.value = Math.max(0, len - 1)
}

// Per Vue2 onAcceptReview :595-604, changed to await (the Vue2 original doesn't await —
// fire-and-forget). Reuses the existing photosPersonMergedToast for the toast (the brief didn't
// give a separate key for "Merged as…"; it shares the same "merged into X" semantics as T7's
// onSubmitMerge success toast, and has already been logged in the report as an intentional
// unification, not an oversight). intoName must be captured **before** calling the store — the
// store synchronously strips this suggestion out of the array first, so it can no longer be
// found by that name after the call.
//
// Review-mandated fix (second round, same precedent as T7 §11): the brief requires "both paths
// need independent in-flight guard refs", and the draft did in fact add one each
// (reviewAccepting/reviewRejecting). Delete-and-verify pass: temporarily changed both
// `if (guard) return` sites to `if (false) return` (neutralizing the guard check entirely,
// leaving everything else unchanged), then reran the entire "T8 merge-suggestion review dialog
// wiring" describe block — both "double-click fires only once" regression tests stayed fully
// green, and the full T7/T8 test suite (50/50) stayed green too. What actually blocks a second
// call is two pre-existing mechanisms, not these two refs:
//   1) This component's MergeReviewDialog.onAccept/onReject each start with
//      `if (!current.value) return` (in MergeReviewDialog.vue) — the store's
//      acceptMergeSuggestion/rejectMergeSuggestion **synchronously** strips this suggestion out
//      of the mergeSuggestions array right at the top of the function body (see the header
//      comment in people.ts), and that removal happens before any await, without waiting on the
//      network. Once the first click's entire synchronous chain (dispatch → emit → this
//      function's body up to the first await) finishes running, `current.value` is already
//      `undefined` — no matter how far apart the second click is (even with zero delay between
//      the two clicks, the browser still dispatches two separate click events sequentially; it
//      never interleaves two event handlers within the same synchronous call stack), so the
//      dialog's own button will never emit a second time in the first place.
//   2) Even if some hypothetical path bypassed the dialog and called this twice directly (a
//      hypothetical scenario that doesn't currently exist), the store-side `if (s) { ... }`
//      check is itself idempotent — when the suggestion can't be found (already removed by the
//      first call), the entire try/catch/finally block simply doesn't run, so a second call is
//      a safe no-op.
// Both layers of protection already exist, so the independent ref is just decorative "standard
// shape" with no real protective value — same as the `deletingSubmitting` ref on T7's delete
// path — removed. Reverting `if (false) return` to nothing (i.e. removing that whole check along
// with the ref) and rerunning still leaves the tests green.
//
// ⚠ Dependency caveat (the coordinator specifically asked for this to be called out on its own,
// not buried in the paragraph above): the conclusion above that "an independent guard ref isn't
// needed" **depends on the current implementation order in people.ts's
// acceptMergeSuggestion/rejectMergeSuggestion — synchronously filtering out the suggestion
// first, then awaiting the backend** (a T2 implementation detail). If someone later reverses
// that order (e.g. changing it to await confirmation first and only remove on success, aiming
// for "don't touch local state on failure" semantics), `current.value` would no longer become
// undefined immediately after the first click, this section's "naturally reentrancy-safe"
// argument would no longer hold, and it would need to be reassessed whether an independent
// guard ref should be added back.
async function onReviewAccept(id: string | number): Promise<void> {
  const s = people.mergeSuggestions.find((m) => String(m.id) === String(id))
  const intoName = (s?.intoName as string | undefined) ?? ''
  try {
    await people.acceptMergeSuggestion(id)
    toast.show(t('photosPersonMergedToast', { name: intoName || t('photosPersonMergeAsSame') }))
  } catch {
    // Failure: the store fires a void fetchMergeSuggestions() corrective refetch (per the
    // header comment in people.ts: "optimistically remove the suggestion first, then refetch
    // the suggestion list on failure to correct it"). Which lands first — the clampReviewIndex()
    // in the finally block below, or that corrective refetch — is a natural timing race. Under
    // real network latency, clamp almost always runs first (the suggestion is still gone at that
    // point, so if it was the last one the dialog closes); under the fully-synchronous mocks
    // used in unit tests, the order flips (the refetch lands first, the suggestion is restored,
    // and the dialog doesn't close). This is a race inherent to the design, not a bug being
    // fixed here — task-8-report.md §8 has a fuller explanation. The test
    // (PhotosPeople.test.ts "failure: ...") deliberately doesn't assert the dialog's open/closed
    // state, only the call arguments and the failure toast.
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    clampReviewIndex()
  }
}

// Per Vue2 onRejectReview :605-614, changed to await. Reuses photosPersonMergeFailed for the
// failure toast rather than opening a separate key for "dismiss failed" (already logged in the
// report). Same delete-and-verify conclusion as the paragraph above — no independent guard ref
// added; the same current.value dependency caveat (see the ⚠ caveat at the top of
// onReviewAccept) and the failure-path race note apply here too and aren't repeated.
async function onReviewReject(id: string | number): Promise<void> {
  try {
    await people.rejectMergeSuggestion(id)
    toast.show(t('photosPersonMergeDismissedToast'))
  } catch {
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    clampReviewIndex()
  }
}

// ClusterActionDialog only emits and never touches the store/toast (see the division of labor
// in that component's header comment) — the actual calls, reentrancy guards, and toasts for all
// three submit paths all live here. `update:open(false)` always routes through closeDialog
// (cancel/Esc/backdrop-click/close-button all go through this one path).
function closeDialog(): void {
  dialog.value = null
}

// Per Vue2 confirmName :645-652, the optimistic dialog-close is changed to wait for store
// success before closing (the path the brief explicitly calls for): short-circuit → await
// renamePerson → success toast + close dialog; on failure, toast the failure copy and leave the
// dialog open (per the precedent of AlbumPickerDialog submitCreate not closing the panel on
// failure, so the user can see why it failed and retry).
async function onSubmitName(name: string): Promise<void> {
  if (!dialog.value || namingSubmitting.value) return
  const person = dialog.value.person
  namingSubmitting.value = true
  try {
    await people.renamePerson(person.id, name)
    toast.show(t('photosPersonNamedToast', { name, count: person.count }))
    dialog.value = null
  } catch {
    // The store has already console.error'd it; this only handles the user-visible failure feedback.
    toast.show(t('photosPersonRenamedFailed'))
  } finally {
    namingSubmitting.value = false
  }
}

// T7 deviation logged (a Vue2 bug the brief explicitly requires fixing — see item 8 in the file
// header comment): Vue2 confirmMergeTo :654-660 doesn't await mergeClusterInto, fires the
// "merged" success toast right after issuing the request, and closes the dialog unconditionally
// — if the request genuinely fails, the user sees a fake success message, and the returned
// rejected promise is never handled at all (unhandled rejection). Fixed here to await + only
// toast success on the success path; failure toasts photosPersonMergeFailed; the dialog closes
// in a finally regardless of outcome (per the brief: "close dialog + reset in finally" — unlike
// naming, this merge path doesn't leave the user in the dialog to retry, since the target
// person is picked from a candidate list rather than typed, so reopening the menu and picking
// again on failure is clearer).
async function onSubmitMerge(targetId: string | number): Promise<void> {
  if (!dialog.value || mergingSubmitting.value) return
  const fromId = dialog.value.person.id
  const targetName = people.personById(targetId)?.name ?? ''
  mergingSubmitting.value = true
  try {
    await people.mergePersonInto(fromId, targetId)
    // P8a-T10: same fallback as confirmMergeTo above (:266) — avoids rendering "Merged into """
    // when the target is unnamed (or personById can't find it).
    toast.show(t('photosPersonMergedToast', { name: targetName || t('photosPersonMergeAsSame') }))
  } catch {
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    dialog.value = null
    mergingSubmitting.value = false
  }
}

// Per Vue2 confirmDelete :661-674, purgePersonWithUndo synchronously returns an undo closure
// (not a Promise — not awaited). Review-mandated fix 2: this path **doesn't need** an
// independent in-flight guard ref — the function body has no await anywhere, running to
// completion within a single dispatchEvent; `dialog.value = null` is itself the natural
// reentrancy lock for this path. When two rapid clicks both hit the same button within the
// synchronous window before Vue removes the dialog from the DOM, the second call gets blocked
// by the `!dialog.value` check at the top of the function body (the first call already cleared
// it). Delete-and-verify pass, see the fix report: this spot also once had a
// `deletingSubmitting` ref added following the naming/merging shape; removing it entirely
// (declaration/set/finally-reset) left the regression tests green — proof it had no real
// protective value, so it isn't being added back.
function onSubmitDelete(): void {
  if (!dialog.value) return
  const person = dialog.value.person
  const undo = people.purgePersonWithUndo(person.id)
  dialog.value = null
  // Final-review Important 4: when the name is empty, the placeholder label must be
  // photosPersonUnnamedLabel ("Unnamed person"), not photosPersonThisPerson ("this person").
  // Both of Vue2's delete paths (PhotosPeopleView.vue:665 and PhotosPersonDetail.vue:962) are
  // **both** $t('Unnamed person') — verified word-for-word against the source. And this page's
  // delete entry point only hangs off the three-mode dialog for unnamed people — "name is
  // empty" is the **normal path** on this page, and getting it wrong would hit exactly the main
  // path. The quote style also follows Vue2's ASCII double quotes (consistent with the detail
  // page).
  const label = person.name && person.name.trim() ? `"${person.name.trim()}"` : t('photosPersonUnnamedLabel')
  toast.show(t('photosPersonDeletedToast', { label }), 5000, { label: t('photosPersonUndo'), onClick: undo })
}

// ── Document-level overlay listeners (Vue2 mounted :525-540's _onDoc + Esc added by this repo) ──
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (confidenceOpen.value && confMenuRef.value && !confMenuRef.value.contains(target)) confidenceOpen.value = false
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(target)) sortOpen.value = false
  if (clusterMenu.value && clusterMenuRef.value && !clusterMenuRef.value.contains(target)) clusterMenu.value = null
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (clusterMenu.value) { clusterMenu.value = null; return }
  if (confidenceOpen.value) { confidenceOpen.value = false; return }
  if (sortOpen.value) sortOpen.value = false
}

onMounted(() => {
  // Vue2 :526-527 refetches every time the page is entered, with no loaded-flag dedup; carried
  // over as-is.
  void people.fetchPeople()
  void people.fetchMergeSuggestions()
  // P8a-T6: now reads from the shared photosSettings store (§7e-10). The sidebar
  // (PhotosSidebar, also mounted on this page) calls fetchAiFeatures() in the same frame too —
  // concurrent dedup is handled in settings.ts, so there's nothing to worry about here.
  void settings.fetchAiFeatures()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <AreaShell :title="t('photosPeople')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- ── Banner (Vue2 :3-42) ── -->
        <div class="people-banner">
          <div class="people-banner-text">
            <h1>{{ t('photosPeople') }}</h1>
            <div class="people-sub" data-test="people-sub">
              <span>{{ t('photosPeopleNamed', { n: people.named.length }) }}</span>
              <span class="sep"></span>
              <span>{{ t('photosPeopleUnnamedClusters', { n: filteredUnnamed.length }) }}</span>
              <!-- Deviation 3: the separator dot appears/disappears together with the indexed date, no dangling dot -->
              <template v-if="people.facesIndexedUpTo">
                <span class="sep"></span>
                <span data-test="people-indexed">
                  {{ t('photosPeopleIndexedUpTo', { date: formatIndexedDate(people.facesIndexedUpTo) }) }}
                </span>
              </template>
            </div>
          </div>
          <div class="people-banner-actions">
            <div ref="confMenuRef" class="people-pop-wrap">
              <button type="button" class="bar-btn" data-test="conf-btn" @click.stop="confidenceOpen = !confidenceOpen">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>
                {{ t('photosPeopleConfidence', { n: people.filter.confidence }) }}
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="confidenceOpen" class="people-menu people-menu-conf" data-test="conf-menu">
                <div class="people-menu-head" data-test="conf-head">{{ t('photosPeopleMinScore') }}</div>
                <button
                  v-for="v in CONFIDENCE_OPTIONS" :key="v"
                  type="button"
                  class="people-menu-item"
                  data-test="conf-option"
                  :data-value="v"
                  :data-active="v === people.filter.confidence"
                  @click="pickConfidence(v)"
                >
                  <span class="check">{{ v === people.filter.confidence ? '✓' : '' }}</span>
                  <span class="lbl">{{ t('photosPeopleConfidenceOption', { n: v }) }}</span>
                  <span class="tail" data-test="conf-count">{{ t('photosPeopleClusters', { n: previewCount(v) }) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Filter row (Vue2 :44-84) ── -->
        <div class="people-filters">
          <button
            v-for="c in filterChips" :key="c.id"
            type="button"
            class="people-chip"
            data-test="filter-chip"
            :data-filter="c.id"
            :data-active="filter === c.id"
            @click="filter = c.id"
          >
            {{ c.label }}
            <span v-if="c.count !== null" class="ct" data-test="chip-count">{{ c.count }}</span>
          </button>
          <div class="people-filters-spacer"></div>
          <div ref="sortMenuRef" class="people-pop-wrap">
            <button type="button" class="people-chip" data-test="sort-btn" @click.stop="sortOpen = !sortOpen">
              {{ t('photosPeopleSort', { label: currentSort.label }) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="sortOpen" class="people-menu people-menu-sort" data-test="sort-menu">
              <button
                v-for="s in sortOptions" :key="s.id"
                type="button"
                class="people-menu-item is-stacked"
                data-test="sort-item"
                :data-sort-id="s.id"
                :data-active="s.id === sort"
                @click="pickSort(s.id)"
              >
                <span class="check">{{ s.id === sort ? '✓' : '' }}</span>
                <span class="stack-text">
                  <span class="lbl">{{ s.label }}</span>
                  <span class="hint">{{ s.hint }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- ── Body (Vue2 :86-235) ── -->
        <div class="people-body">
          <!-- The two warning banners are mutually exclusive (Vue2 :87-113); mlReady has three states: null = unknown, don't warn -->
          <div v-if="!facesEnabled" class="merge-banner is-warn" data-test="warn-faces-off">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleFacesOffTitle') }}</div>
              <div class="desc">
                {{ t('photosPeopleFacesOffBody') }}
                <!-- Deviation 4: the settings page belongs to P8, so this is emphasized text rather than a clickable link.
                     Deviation 7: Vue2 :97 hardcodes an English period after the </a>, which under the Chinese locale
                     produces the mixed Chinese/English punctuation error "…re-enable Settings · AI behavior.", and
                     it isn't in any translatable string (no corresponding key) — that period isn't reproduced here. -->
                <span class="em">{{ t('photosPeopleFacesOffLink') }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="timeline.indexStatus.mlReady === false" class="merge-banner is-warn" data-test="warn-ml-offline">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleMlOfflineTitle') }}</div>
              <div class="desc">{{ t('photosPeopleMlOfflineBody') }}</div>
            </div>
          </div>

          <!-- Merge-suggestion banner: an independent v-if, can appear alongside the warning banner (per Vue2 :115) -->
          <div v-if="people.mergeSuggestions.length > 0" class="merge-banner" data-test="merge-banner">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleMergeFound', { n: people.mergeSuggestions.length }) }}</div>
              <div class="desc">{{ mergeReasonText }}</div>
            </div>
            <div class="stack">
              <!-- Vue2 scss:266-268's .stack .dot is 28px **including** the 2px border (border-box),
                   so the inner avatar is 24px and the total outer diameter is 28px. Review Minor fix:
                   passing 28 plus a 2px border would have produced a 32px outer diameter. -->
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('fromId')" :ver="verOf(suggestionId('fromId'))" :size="24" /></div>
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('intoId')" :ver="verOf(suggestionId('intoId'))" :size="24" /></div>
            </div>
            <button type="button" class="bar-btn people-btn-primary" data-test="merge-review" @click="openReview">
              {{ t('photosPeopleMergeReview') }}
            </button>
            <button
              type="button"
              class="people-icon-btn"
              data-test="merge-dismiss"
              :aria-label="t('photosPeopleMergeDismissAll')"
              @click="people.dismissAllMerges()"
            >&#215;</button>
          </div>

          <div v-if="isEmpty" class="empty-state" data-test="people-empty">
            <div class="empty-state-title">{{ t('photosPeopleEmptyTitle') }}</div>
            <div class="empty-state-desc">{{ t('photosPeopleEmptyHint') }}</div>
          </div>

          <template v-else>
            <!-- Pinned (Vue2 :129-150) -->
            <div class="section-head" data-test="section-pinned">
              <h2>{{ t('photosPeoplePinned') }}</h2>
              <span class="sub">{{ t('photosPeoplePinnedHint') }}</span>
            </div>
            <div class="face-grid-lg">
              <div
                v-for="p in pinned" :key="p.id"
                class="face-card"
                data-test="pinned-card"
                :data-id="p.id"
                @click="openPerson(p)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="124" :fav="true" />
                <div class="name">{{ p.name }}</div>
                <div class="meta">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</div>
              </div>
            </div>

            <!-- Named (Vue2 :152-174) -->
            <div class="section-head" data-test="section-named">
              <h2>{{ t('photosPeopleNamedSection') }}</h2>
              <span class="sub">{{ t('photosPeopleNamedHint', { n: others.length }) }}</span>
            </div>
            <div class="face-grid-md">
              <div
                v-for="p in others" :key="p.id"
                class="face-card"
                data-test="named-card"
                :data-id="p.id"
                @click="openPerson(p)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="84" />
                <div class="name-row" data-test="named-name-row">
                  <span class="name">{{ p.name }}</span>
                  <span class="meta">{{ p.count.toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <!-- Unnamed (Vue2 :176-206) -->
            <div class="section-head" data-test="section-unnamed">
              <h2>{{ t('photosPeopleUnnamedSection') }}</h2>
              <span class="sub">{{ t('photosPeopleUnnamedHint', { n: filteredUnnamed.length }) }}</span>
              <div class="section-actions">
                <button
                  v-if="showUnnamed && (people.hiddenSingletonCount > 0 || people.filter.showSingletons)"
                  type="button"
                  class="more"
                  data-test="singleton-toggle"
                  @click="toggleSingletons"
                >
                  {{ people.filter.showSingletons
                    ? t('photosPeopleHideSingle')
                    : t('photosPeopleShowSingle', { n: people.hiddenSingletonCount }) }}
                </button>
                <button type="button" class="more" data-test="unnamed-toggle" @click="showUnnamed = !showUnnamed">
                  {{ showUnnamed ? t('photosPeopleHide') : t('photosPeopleShow') }}
                </button>
              </div>
            </div>
            <div v-if="showUnnamed" class="cluster-grid" data-test="cluster-grid">
              <div
                v-for="p in filteredUnnamed" :key="p.id"
                class="cluster-card"
                data-test="cluster-card"
                :data-id="p.id"
                @click="openClusterMenu(p, $event)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="72" dashed />
                <!-- The badge must be a sibling of the avatar ring: the ring's overflow:hidden would clip it (Vue2 :201) -->
                <div class="badge" data-test="cluster-badge">{{ mergeConfidencePct(p.confidence) }}%</div>
                <div class="ct">{{ t('photosPeoplePhotosCount', { n: p.count }) }}</div>
                <!-- Swaps with .ct on hover (scss:242-243): the photo count hides, the action hint shows -->
                <div class="name-action" data-test="cluster-hint">{{ t('photosPeopleClusterHint') }}</div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
  </AreaShell>

  <!-- Floating action menu (Vue2 :208-234). position:fixed, placed outside AreaShell to avoid
       an ancestor's backdrop-filter turning it into a containing block (same precedent as
       PhotosAlbums.vue placing modals outside the shell). -->
  <div
    v-if="clusterMenu"
    ref="clusterMenuRef"
    class="cluster-menu"
    data-test="cluster-menu"
    :style="{ left: clusterMenu.x + 'px', top: clusterMenu.y + 'px' }"
  >
    <!-- Added during user acceptance (Vue2's menu :213-231 has only the three items name/merge/
         delete — the whole Vue2 list page has no entry point at all to an unnamed person's
         detail page). Placed first: it's a "view only, no mutation" action, ahead of the three
         data-mutating actions. Routes through the same openPerson as named cards, sharing the
         encodeURIComponent guard. -->
    <button type="button" class="cluster-menu-item" data-test="menu-view" @click="viewClusterPhotos">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
      <span>{{ t('photosPersonViewPhotos') }}</span>
    </button>
    <button type="button" class="cluster-menu-item" data-test="menu-name" @click="openDialog('name')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
      <span>{{ t('photosPersonNameThis') }}</span>
    </button>
    <button type="button" class="cluster-menu-item" data-test="menu-merge" @click="openDialog('merge')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
      <span>{{ t('photosPersonMergeExisting') }}</span>
    </button>
    <button type="button" class="cluster-menu-item is-danger" data-test="menu-delete" @click="openDialog('delete')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
      <span>{{ t('photosPersonDeleteCluster') }}</span>
    </button>
  </div>

  <!-- T7: the three-mode action dialog is really wired up now. Candidates pass the full named list — sorting/filtering/truncation happen inside the dialog (per the brief's decision). -->
  <ClusterActionDialog
    :open="dialog !== null"
    :mode="dialog?.mode ?? 'name'"
    :person="dialog?.person ?? null"
    :candidates="people.named"
    @update:open="(v) => { if (!v) closeDialog() }"
    @submit-name="onSubmitName"
    @submit-merge="onSubmitMerge"
    @submit-delete="onSubmitDelete"
  />

  <!-- T8: the merge-suggestion review dialog is wired up. update:index is declared but never
       actually emitted (see the header comment in MergeReviewDialog — there's no separate
       "jump to item N" navigation control); the wiring still covers it fully to keep the
       contract consistent. The only path that currently changes reviewIdx on the host side is
       clampReviewIndex after accept/reject. -->
  <MergeReviewDialog
    :open="reviewOpen"
    :suggestions="reviewSuggestions"
    :index="reviewIdx"
    :people="people.people"
    @update:open="(v) => { if (!v) reviewOpen = false }"
    @update:index="(v) => { reviewIdx = v }"
    @accept="onReviewAccept"
    @reject="onReviewReject"
  />
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

/* height (not min-height): this caps the screen so only the inner scroll container scrolls —
   a same-source fix; see the comment at the equivalent rule in src/views/Photos.vue for the
   Vue2 rationale. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── Banner (scss:5-35) ── */
.people-banner {
  display: flex; align-items: flex-end; gap: 18px;
  padding: 4px 4px 14px;
  border-bottom: 1px solid var(--divider);
  /* Vue2's dark theme has a faint 5% purple top gradient, entirely dropped in the light theme
     (scss:9,14). Here it's changed to a very faint accent-based gradient instead: each theme's
     own accent is already faint enough, so no per-theme branching is needed. */
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 80%);
}
.people-banner-text { min-width: 0; }
.people-banner h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.people-sub { color: var(--fg-muted); font-size: 12.5px; margin-top: 4px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.people-sub .sep { width: 4px; height: 4px; border-radius: 50%; background: var(--fg-faint); flex: 0 0 auto; }
.people-banner-actions { margin-left: auto; display: inline-flex; gap: 8px; }
.people-pop-wrap { position: relative; }

/* ── Filter row (scss:38-60) ── */
.people-filters { display: flex; align-items: center; gap: 10px; padding: 12px 4px; border-bottom: 1px solid var(--divider); flex-wrap: wrap; }
.people-filters-spacer { flex: 1 1 auto; }
.people-chip {
  height: 28px; padding: 0 12px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.people-chip:hover { background: var(--chip-bg-hi); color: var(--fg); }
.people-chip[data-active="true"] {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent-text);
}
.people-chip .ct { font-variant-numeric: tabular-nums; opacity: 0.7; font-size: 11px; }

/* ── Dropdown menu (Vue2 inline styles :20-39 / :66-82) ── */
.people-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 10px;
  box-shadow: var(--card-shadow-hi);
}
.people-menu-conf { min-width: 200px; padding: 8px; }
/* Confidence dropdown subheading (Vue2 :24-26's inline style) */
.people-menu-head {
  font-size: 10.5px; color: var(--fg-muted); text-transform: uppercase;
  letter-spacing: 0.06em; padding: 4px 6px 8px;
}
.people-menu-sort { min-width: 220px; padding: 4px; }
.people-menu-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 6px 8px;
  background: transparent; border: 0; border-radius: 6px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.people-menu-item.is-stacked { align-items: flex-start; padding: 8px 10px; }
.people-menu-item:hover { background: var(--hover); }
.people-menu-item[data-active="true"] { background: var(--accent-soft); }
.people-menu-item .check { width: 12px; flex: 0 0 auto; color: var(--accent-text); }
.people-menu-item .lbl { flex: 1 1 auto; }
.people-menu-item .tail { color: var(--fg-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.people-menu-item .stack-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.people-menu-item .stack-text .lbl { font-weight: 500; }
.people-menu-item .stack-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

/* ── Body scroll container (scss:63-67) ── */
.people-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 24px 4px 80px; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

/* ── Section head (scss:69-100) ── */
.section-head { display: flex; align-items: baseline; gap: 10px; padding: 22px 0 14px; flex-wrap: wrap; }
.section-head h2 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.section-head .sub { color: var(--fg-muted); font-size: 12px; }
.section-actions { margin-left: auto; display: inline-flex; align-items: baseline; gap: 14px; }
.section-actions .more + .more { padding-left: 14px; border-left: 1px solid var(--divider); }
.section-head .more { color: var(--fg-muted); font-size: 12px; background: transparent; border: 0; font-family: inherit; cursor: pointer; padding: 0; }
.section-head .more:hover { color: var(--accent-text); }

/* ── Pinned / Named grid (scss:103-194) ── */
.face-grid-lg { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 18px 14px; }
.face-grid-md { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 16px 10px; }
.face-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  cursor: pointer; padding: 6px; border-radius: 14px; position: relative;
}
.face-card:hover { background: var(--hover); }
/* Avatar zooms in slightly on hover (scss:129-131). PersonAvatar has no such interaction built in itself, so the parent :deep targets its img. */
.face-card :deep(.person-avatar-img) { transition: transform 0.4s ease; }
.face-card:hover :deep(.person-avatar-img) { transform: scale(1.05); }
/* Vue2 scss:132-136 adds an accent inner ring (data-fav) to favorited avatars.
   Review Important 2 (both spots changed together):
   ① **Must be an ::after overlay, not .person-avatar-ring's own box-shadow.** Per the CSS spec,
      an inset shadow paints "before content and descendants", and the ring's inner
      .person-avatar-img / .person-avatar-fallback fill the entire padding box — that 2px accent
      ring would be 100% covered by the face photo, so the Pinned section would show no visual
      marker of "pinned favorite" at all. Vue2 uses exactly ::after (scss:132-136) — a
      pseudo-element layered on top of the img so it's actually visible.
   ② The selector needs the data-fav condition added (a new attribute on PersonAvatar's root
      element, matching Vue2's `.ring[data-fav]`). It previously hit every avatar under
      .face-grid-lg unconditionally; currently semantically equivalent (Pinned only renders
      favorited items), but reuse would still be leaky coupling.
   Hung off .person-avatar (the component root, position:relative and sharing the same box as
   the ring) rather than .person-avatar-ring: the ring itself has overflow:hidden, so a
   pseudo-element positioned relative to it would get clipped.
   **Only the inner ring is drawn, not the outer glow**: the second segment of that Vue2 rule
   (an outer glow, 0 0 0 3px, 20% accent opacity) is likewise clipped by `.ring { overflow:
   hidden }` (scss:120) and never actually renders in Vue2 — that dead code is deliberately not
   reproduced here (copying it would render a glow ring Vue2 never had — new visual output, not
   a 1:1 port). */
.face-grid-lg .face-card :deep(.person-avatar[data-fav="true"])::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--accent);
  pointer-events: none;
}
.face-card .name {
  font-size: 13px; font-weight: 500; color: var(--fg); text-align: center; max-width: 130px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.face-card .meta { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.face-grid-md .face-card .name-row { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; }
.face-grid-md .face-card .name-row .name { font-size: 12.5px; max-width: 90px; }
.face-grid-md .face-card .name-row .meta { font-size: 11px; }

/* ── Unnamed grid (scss:197-243) ── */
.cluster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 14px 10px; position: relative; }
.cluster-card { position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* Unnamed faces are pushed down one opacity notch to visually separate this section from the named one (scss:215) */
.cluster-card :deep(.person-avatar-img) { opacity: 0.92; }
.cluster-card .badge {
  position: absolute;
  /* Anchored to the top-right of the avatar's center: it only grazes the edge of the circle regardless of column width (per Vue2 scss:218-220) */
  top: -6px; left: calc(50% + 20px);
  white-space: nowrap; font-size: 10.5px; padding: 2px 6px; border-radius: 99px;
  background: var(--overlay-bg); backdrop-filter: var(--blur);
  font-variant-numeric: tabular-nums; font-weight: 500;
}
/* theme-exception: the badge sits over an uncontrolled face photo, so both themes need a constant dark backing, light text, and light stroke */
.cluster-card .badge { color: rgba(255, 255, 255, 0.78); }
/* theme-exception: same as above, constant light stroke */
.cluster-card .badge { border: 1px solid rgba(255, 255, 255, 0.1); }
.cluster-card .ct { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
/* Hover swap (scss:237-243): shows only the photo count normally, swaps to "+ Name / Merge / Delete" on hover */
.cluster-card .name-action { font-size: 11.5px; color: var(--accent-text); display: none; }
.cluster-card:hover .name-action { display: block; }
.cluster-card:hover .ct { display: none; }

/* ── Banner bar (scss:246-274) ── */
.merge-banner {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 14px; margin-bottom: 18px; flex-wrap: wrap;
}
.merge-banner .icon-wrap {
  width: 34px; height: 34px; border-radius: 50%; background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center; color: var(--accent-text); flex: none;
}
.merge-banner .body { flex: 1 1 auto; min-width: 0; }
.merge-banner .title { font-size: 13px; font-weight: 600; color: var(--fg); }
.merge-banner .desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.merge-banner .desc .em { color: var(--accent-text); font-weight: 500; }
.merge-banner .stack { display: inline-flex; }
.merge-banner .stack .stack-dot { border-radius: 50%; border: 2px solid var(--panel-bg); margin-left: -10px; line-height: 0; }
.merge-banner .stack .stack-dot:first-child { margin-left: 0; }
/* Warning variant (Vue2 :87-113's inline orange → the three --warn-* tokens) */
.merge-banner.is-warn { background: var(--warn-bg); border-color: var(--warn-border); }
.merge-banner.is-warn .icon-wrap { background: color-mix(in srgb, var(--warn-fg) 18%, transparent); color: var(--warn-fg); }
.merge-banner.is-warn .title { color: var(--warn-fg); }

.people-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.people-btn-primary:hover { background: var(--accent); filter: brightness(1.08); }
.people-icon-btn {
  width: 28px; height: 28px; flex: 0 0 auto; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 16px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.people-icon-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }

/* ── Floating action menu (Vue2 inline styles :208-233) ── */
.cluster-menu {
  position: fixed; transform: translateX(-50%); min-width: 200px; z-index: 50;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 10px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.cluster-menu-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 6px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.cluster-menu-item:hover { background: var(--hover); }
.cluster-menu-item svg { flex: 0 0 auto; color: var(--accent-text); }
.cluster-menu-item span { flex: 1 1 auto; }
.cluster-menu-item.is-danger { color: var(--remove-fg); }
.cluster-menu-item.is-danger svg { color: var(--remove-fg); }

/* ≤768px: the sidebar has already collapsed into a drawer, so the layout goes single-column */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
