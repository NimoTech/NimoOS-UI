<script setup lang="ts">
// Task 6 (SP7-P5 People): people list view — banner + filter/sort row +
// two warning banners + merge-suggestion banner + Pinned/Named/Unnamed three-section grid +
// floating action menu + empty state.
// Ported section-by-section against Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:2-235
// and src/views/Photos/photos-people.scss:1-275; the Ask Nimo branch is not built, per the brief.
// The shell was originally copied from PhotosAlbums.vue:185-188's AreaShell/.photos-layout/
// PhotosSidebar/.photos-main (not extracted into anything shared, per P3/P4). Document-level
// listeners follow PhotosAlbums.vue:159-181.
//
// Plan D Task 2 (re-shell): the transitional AreaShell/.photos-layout shell has been swapped for
// PhotosAlbums.vue's own Plan C Task 2 `.photos-root > .app[data-collapsed] > PhotosSidebar +
// main.main > PhotosTopbar + .photos-main` structure (useSidebarCollapse shared singleton). The
// overlays (cluster-menu/ClusterActionDialog) moved back inside `.photos-root` (a sibling of
// `.app`) along with it — see their own comments above for why. Full detail in task-2-report.md.
//
// T7 (added this round): wires up ClusterActionDialog (the name/merge/delete three-mode dialog);
// `dialog` state moves from T6's hidden placeholder node to a real dialog. The store calls,
// reentrancy guards, and toasts for all three submit paths (renamePerson/mergePersonInto/
// purgePersonWithUndo) all live here — the dialog itself only emits (division of labor matches
// the header comment in ClusterActionDialog.vue). Route registration and the sidebar entry
// belong to T16.
//
// 2026-08-20 (people-confirm-polish item 1, post-acceptance product decision): T8's
// merge-suggestion review flow (the "Nimo found N possible merges" banner + MergeReviewDialog,
// `reviewOpen`/`reviewIdx`/`openReview`/`clampReviewIndex`/`onReviewAccept`/`onReviewReject`, plus
// the `firstSuggestion`/`mergeReasonText`/`suggestionId`/`verOf`/`reviewSuggestions` computeds
// that fed the banner) has been removed entirely — at the backend's current thresholds it
// surfaced 6266 noisy pairs, and it's superseded in spirit by the newer per-face "To confirm"
// suggestion cards section below (suggestionGroups/decideSuggestion/decideGroup — a separate
// backend feature, unaffected by this removal). MergeReviewDialog.vue had no other importer
// repo-wide and was deleted along with its test file. The store's mergeSuggestions state and
// fetchMergeSuggestions/acceptMergeSuggestion/rejectMergeSuggestion/dismissAllMerges were also
// removed from people.ts — nothing else in the app consumed them (see people.ts's own header
// note); mergePersonInto (T7's merge path, kept) no longer refetches that now-gone list. The
// duplicate-name merge prompt on PhotosPersonDetail.vue is a wholly separate flow (renamePerson's
// own dup-name detection, not this suggestion machinery) and is untouched.
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
// One copy string T3 missed was backfilled by the coordinator (zh_CN.json:2079), added to both
// locales, and rendered per Vue2: photosPeopleClusterHint (unnamed-card hover tooltip, :204,
// along with the scss:242-243 .ct / .name-action hover swap, backfilled together).
//
// Task 4 (2026-08-19 timeline/people-visibility fix): the confidence dropdown (banner button +
// menu, photosPeopleMinScore subheading, the per-tier preview count) is removed entirely — a
// product decision, not a partial fix. It defaulted to an 80% confidence gate that silently
// hid a real 221-photo cluster at confidence 0.796, with no way for the user to discover it.
// Visibility now comes from the store's splitUnnamedByDistribution size-distribution cut
// instead (see peopleView.ts's file header). The per-cluster confidence percentage badge
// (mergeConfidencePct) is unrelated and stays.
//
// Fix round 2 (2026-08-19, product decision — supersedes the fold-expander part of Task 4):
// the unnamed-clusters grid shows ONLY splitUnnamedByDistribution's `visible` head. Nothing
// else on this page can reach the folded long tail or the singleton clusters — the "Show N
// more clusters" expander and the "Show N single-photo" toggle (plus all the store state that
// fed them: showFoldedClusters/foldedCount/toggleFoldedClusters, and
// PeopleFilter.showSingletons/setShowSingletons once it lost every other consumer) are removed
// entirely, not hidden behind a flag. splitUnnamedByDistribution itself is untouched — it
// still computes folded/singletons, this page just no longer reads those two fields.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import ClusterActionDialog from '../photos/components/ClusterActionDialog.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import { service } from '@nimotech/nimoos-service'
import { usePhotosPeople } from '../photos/stores/people'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
import {
  mergeConfidencePct, sortNamed, type Person,
} from '../photos/util/peopleView'

type FilterId = 'all' | 'family' | 'friend' | 'work' | 'recent'
type SortId = 'freq' | 'name' | 'recent' | 'oldest'
type DialogMode = 'name' | 'merge' | 'delete'

const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// Task 2 (Plan D re-shell): same collapse composable as PhotosAlbums.vue's own re-skin
// (Plan C Task 2) — shared module singleton, `toggle` wired straight to the topbar button.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const router = useRouter()
const people = usePhotosPeople()
const timeline = useTimelineStore()
const settings = usePhotosSettingsStore()
const toast = useToast()

// Vue2 data() :461-472. sort is deliberately not persisted (matching Vue2). Fix round 2: the
// showSingletons/showFoldedClusters store state this comment used to describe is gone —
// the grid always shows exactly splitUnnamedByDistribution's `visible` head.
const filter = ref<FilterId>('all')
const sort = ref<SortId>('freq')
const showUnnamed = ref(true)
const sortOpen = ref(false)
const clusterMenu = ref<{ person: Person; x: number; y: number } | null>(null)
// T7 (Plan D): the "Hidden people" section, collapsed by default (mirroring Vue2 hiddenExpanded :559).
const hiddenExpanded = ref(false)
// T7 three-mode dialog state.
const dialog = ref<{ mode: DialogMode; person: Person } | null>(null)
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

// Task 2 (Plan D re-shell): PhotosTopbar's `sub` line — same named/visible-unnamed counts the
// in-body `.people-sub` banner already shows (photosPeopleTopbarSub, see i18n comment for why
// the "Face clusters ·" lead-in is dropped). Reuses filteredUnnamed rather than recomputing a
// second "visible unnamed" figure so the two counts on screen can never disagree.
const topbarSub = computed(() => t('photosPeopleTopbarSub', {
  named: people.named.length,
  unnamed: filteredUnnamed.value.length,
}))

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

function pickSort(id: SortId): void {
  sort.value = id
  sortOpen.value = false
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

// T7 (Plan D): hiding executes immediately, no confirmation dialog — non-destructive, can always
// be undone via unhide from the "Hidden people" section below; a confirmation step would only add
// friction (mirroring Vue2 hideClusterPerson :750-759's own comment). The menu item itself is
// already gated as a whole by v-if="people.hiddenPeopleSupported" (see the template), so there's
// no need to check it again here.
async function onHideCluster(): Promise<void> {
  const p = clusterMenu.value?.person ?? null
  clusterMenu.value = null
  if (!p) return
  const label = p.name && p.name.trim() ? `"${p.name.trim()}"` : t('photosPersonUnnamedLabel')
  const ok = await people.hidePerson(p.id)
  if (ok) {
    toast.show(t('photosPersonHiddenToast', { label }))
    // New-UI addition: Vue2's hideClusterPerson never calls fetchHiddenPeople (:750-759), so the
    // "Hidden people" section wouldn't show the newly-hidden person until the whole page
    // remounts — within the same session it's stuck showing a stale "hidden but the section
    // doesn't reflect it" state. This adds one refresh so the section reflects the latest result
    // right away (a purely additive improvement, doesn't affect any existing assertion — Vue2
    // never had a test pinning down "doesn't refresh" as behavior).
    void people.fetchHiddenPeople()
  }
}
// Vue2 unhideClusterPerson :770-772, forwards directly to the store.
function onUnhide(p: Person): void {
  void people.unhidePerson(p.id)
}
// Vue2 toggleHiddenSection :765-767 — doesn't re-fetch on expand (mounted already fetched once, see below).
function toggleHidden(): void {
  hiddenExpanded.value = !hiddenExpanded.value
}

// ── Suggestion confirmation cards (Plan C Task 2, 2026-08-20 people-suggestions-ui) ──
// The store's own pending-decision guard (`_pendingSuggestionIds` in people.ts) is module-
// private, and only exists to stop a racing fetchSuggestions() from clobbering an in-flight
// decision — it isn't exposed for the view to read. This component keeps its OWN local
// in-flight set purely for UI disablement (greying out a face/group while its request is
// outstanding). Wholesale-reassignment convention (not `reactive(new Set())` with in-place
// add/delete), matching this repo's established pattern for ref<Set<…>> state elsewhere
// (e.g. SearchView.vue's toggleSet, QueueView.vue's `selected`).
const suggestionBusy = ref<Set<string>>(new Set())
function markSuggestionBusy(ids: string[]): void {
  const next = new Set(suggestionBusy.value)
  for (const id of ids) next.add(id)
  suggestionBusy.value = next
}
function unmarkSuggestionBusy(ids: string[]): void {
  const next = new Set(suggestionBusy.value)
  for (const id of ids) next.delete(id)
  suggestionBusy.value = next
}
function isSuggestionBusy(id: string): boolean {
  return suggestionBusy.value.has(id)
}
// A group counts as busy while ANY of its member suggestions is locally in-flight — covers
// both the group-level Confirm/Reject-all path (which marks every id in the group busy up
// front, mirroring the store's own decideGroup) and a single per-face decision fired from
// inside a group that still has its own Confirm/Reject-all buttons visible.
function isSuggestionGroupBusy(personId: string | number): boolean {
  const g = people.suggestionGroups.find((x) => String(x.person.id) === String(personId))
  return !!g && g.suggestions.some((s) => isSuggestionBusy(s.id))
}
// service.photos.faceThumbnailUrl internally includes the token (same convention as every
// other media URL helper in the service package) — this component does not hand-build it.
function suggestionFaceThumb(faceId: string): string {
  return service.photos.faceThumbnailUrl(faceId)
}

async function onDecideSuggestionFace(id: string, accept: boolean): Promise<void> {
  if (isSuggestionBusy(id)) return
  markSuggestionBusy([id])
  try {
    await people.decideSuggestion(id, accept)
  } catch {
    // The store already console.error's the failure and issues its own corrective
    // fetchSuggestions() (see decideSuggestion's header comment in people.ts) — nothing
    // further to surface here. The brief only calls for a toast on the group batch path's
    // partial-failure case (decideGroup below), not on this single-item path.
  } finally {
    unmarkSuggestionBusy([id])
  }
}

async function onDecideSuggestionGroup(personId: string | number, accept: boolean): Promise<void> {
  const g = people.suggestionGroups.find((x) => String(x.person.id) === String(personId))
  if (!g || g.suggestions.length === 0 || isSuggestionGroupBusy(personId)) return
  const ids = g.suggestions.map((s) => s.id)
  markSuggestionBusy(ids)
  try {
    // decideGroup always resolves (never throws) with a per-id failure count — see decideGroup's
    // header comment in people.ts. The store has already fired its own corrective
    // fetchSuggestions() resync when failed > 0; this toast is purely user-facing feedback that
    // not everything in the group actually went through.
    const { failed } = await people.decideGroup(personId, accept)
    if (failed > 0) toast.show(t('photosPeopleSuggestPartialFail', { n: failed }))
  } finally {
    unmarkSuggestionBusy(ids)
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
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(target)) sortOpen.value = false
  if (clusterMenu.value && clusterMenuRef.value && !clusterMenuRef.value.contains(target)) clusterMenu.value = null
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (clusterMenu.value) { clusterMenu.value = null; return }
  if (sortOpen.value) sortOpen.value = false
}

onMounted(() => {
  // Vue2 :526-527 refetches every time the page is entered, with no loaded-flag dedup; carried
  // over as-is.
  void people.fetchPeople()
  // T7: eager fetch (not lazy) — per Vue2 mounted :622's own comment: this is a cheap GET that
  // also doubles as the 404 feature-detection probe, so a legacy backend won't flash the section
  // and then make it disappear. The section itself is still collapsed by default; only the count
  // is no longer lazy.
  void people.fetchHiddenPeople()
  // Plan C Task 2: eager fetch (not lazy), same rationale as fetchHiddenPeople right above —
  // this GET also doubles as the 404 feature-detection probe for suggestionsSupported, so a
  // legacy backend without the endpoint never flashes the section before hiding it.
  void people.fetchSuggestions()
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
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="t('photosPeople')"
          :sub="topbarSub"
          :show-search="false"
          show-ask-nimo
          @toggle-collapse="onToggleCollapse"
          @ask-nimo="useAskNimo().openDrawer()"
        />
       <div class="photos-main">
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
          <!-- Task 4: the confidence dropdown that used to live here is gone (see the
               header comment) — the banner's action row has nothing left to show. -->
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

          <!-- 2026-08-20 (people-confirm-polish item 1): the old whole-cluster merge-suggestion
               banner ("Nimo found N possible merges…") that used to sit here has been removed —
               see the file header note for why. -->

          <!-- ── Suggestion confirmation cards (Plan C Task 2, 2026-08-20
               people-suggestions-ui): per-face join/review suggestions grouped by person,
               sitting above the named-people area. Gated as a whole (title included) on
               suggestionsSupported && suggestionCount>0 — a legacy backend without the
               endpoint, or one with zero open suggestions, both render nothing here, not even
               the header. Empty groups vanish on their own once the store drops them (their
               last suggestion decided), and the whole section disappears the moment the last
               group does — purely a consequence of this same v-if re-evaluating, no separate
               "was that the last one" bookkeeping needed. -->
          <section
            v-if="people.suggestionsSupported && people.suggestionCount > 0"
            class="people-suggestions"
            data-test="people-suggestions"
          >
            <div class="section-head" data-test="section-suggestions">
              <h2>{{ t('photosPeopleSuggestions') }}</h2>
              <span class="sub">({{ people.suggestionCount }})</span>
            </div>
            <div class="suggestion-list">
              <div
                v-for="g in people.suggestionGroups" :key="g.person.id"
                class="suggestion-card"
                data-test="suggestion-card"
                :data-person-id="g.person.id"
              >
                <div class="suggestion-card-head">
                  <PersonAvatar :person-id="g.person.id" :name="g.person.name" :ver="g.person.coverFaceId" :size="40" />
                  <div class="suggestion-card-title">
                    {{ t('photosPeopleSuggestTitle', { name: g.person.name || t('photosPersonUnnamedTitle') }) }}
                  </div>
                  <div class="suggestion-card-actions">
                    <button
                      type="button"
                      class="suggestion-action-btn"
                      data-test="suggestion-confirm-all"
                      :disabled="isSuggestionGroupBusy(g.person.id)"
                      @click="onDecideSuggestionGroup(g.person.id, true)"
                    >{{ t('photosPeopleAcceptAll') }}</button>
                    <button
                      type="button"
                      class="suggestion-action-btn is-reject"
                      data-test="suggestion-reject-all"
                      :disabled="isSuggestionGroupBusy(g.person.id)"
                      @click="onDecideSuggestionGroup(g.person.id, false)"
                    >{{ t('photosPeopleRejectAll') }}</button>
                  </div>
                </div>
                <div class="suggestion-face-grid">
                  <div
                    v-for="s in g.suggestions" :key="s.id"
                    class="suggestion-face"
                    data-test="suggestion-face"
                    :data-id="s.id"
                    :class="{ 'is-busy': isSuggestionBusy(s.id) }"
                  >
                    <img class="suggestion-face-img" :src="suggestionFaceThumb(s.faceId)" alt="">
                    <span v-if="s.kind === 'review'" class="suggestion-review-badge" data-test="suggestion-review-badge">
                      {{ t('photosPeopleReviewBadge') }}
                    </span>
                    <div class="suggestion-face-hover">
                      <button
                        type="button"
                        class="suggestion-face-btn is-accept"
                        data-test="suggestion-face-accept"
                        :disabled="isSuggestionBusy(s.id)"
                        @click="onDecideSuggestionFace(s.id, true)"
                      >✓</button>
                      <button
                        type="button"
                        class="suggestion-face-btn is-reject"
                        data-test="suggestion-face-reject"
                        :disabled="isSuggestionBusy(s.id)"
                        @click="onDecideSuggestionFace(s.id, false)"
                      >✕</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Task 6 (Plan D, PR 137 gap-close): the hint branches on whether face recognition
               is on (Vue2 PR 137 patch, PhotosPeopleView.vue — verbatim copy in both branches). -->
          <div v-if="isEmpty" class="empty-state" data-test="people-empty">
            <div class="empty-state-title">{{ t('photosPeopleEmptyTitle') }}</div>
            <div v-if="facesEnabled" class="empty-state-desc">{{ t('photosPeopleEmptyHintFaces') }}</div>
            <div v-else class="empty-state-desc">{{ t('photosPeopleEmptyHintNoFaces') }}</div>
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

            <!-- Unnamed (Vue2 :176-206). Fix round 2 (product decision, 2026-08-19): the grid
                 shows ONLY splitUnnamedByDistribution's `visible` head -- nothing else is
                 reachable from this page. Both the "Show N more clusters" fold expander and the
                 "Show N single-photo" singleton toggle (and the store state feeding them) are
                 removed entirely; see the header comment above. -->
            <div class="section-head" data-test="section-unnamed">
              <h2>{{ t('photosPeopleUnnamedSection') }}</h2>
              <span class="sub">{{ t('photosPeopleUnnamedHint', { n: filteredUnnamed.length }) }}</span>
              <div class="section-actions">
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

          <!-- Hidden people (Vue2 :220-253): gated independently of the Pinned/Named/Unnamed
               empty-state logic above — shows whenever there are any hidden people, regardless of
               whether Named/Unnamed happen to be empty right now. Feature detection: on a legacy
               backend without the hide feature, hiddenPeopleSupported is false and the whole
               section never appears, rather than showing a user who does have hidden people a
               bare "(0)" or a half-finished loading count (mirroring Vue2's own :220-223 comment). -->
          <template v-if="people.hiddenPeopleSupported && people.hiddenPeople.length > 0">
            <div class="section-head people-hidden-head" data-test="section-hidden" @click="toggleHidden">
              <h2 class="people-hidden-title">
                <svg v-if="hiddenExpanded" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                {{ t('photosPeopleHiddenSection') }}
                <span class="people-hidden-count">({{ people.hiddenPeople.length }})</span>
              </h2>
            </div>
            <div v-if="hiddenExpanded" class="face-grid-md" data-test="hidden-grid">
              <div
                v-for="p in people.hiddenPeople" :key="p.id"
                class="face-card people-hidden-static"
                data-test="hidden-card"
                :data-id="p.id"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="84" />
                <div class="name-row">
                  <span class="name">{{ p.name || t('photosPersonUnnamedTitle') }}</span>
                </div>
                <!-- Vue2 quirk transcribed faithfully: this button's `class="more"` has no
                     matching CSS rule in Vue2's own scss either (`.more` is only styled when
                     scoped under `.section-head`, PhotosPeopleView.vue's `.section-head .more`
                     — this button is a `.face-card` descendant, not a `.section-head`
                     descendant, so it renders with plain browser-default button chrome in Vue2
                     too). Not a bug introduced here; see photos-people.scss's own `.more`
                     rules for the same scoping. -->
                <button type="button" class="more people-unhide-btn" data-test="unhide-btn" @click="onUnhide(p)">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  {{ t('photosPeopleUnhide') }}
                </button>
              </div>
            </div>
          </template>
        </div>
       </div>
      </main>
    </div>

    <!-- Task 2 (Plan D re-shell): the cluster menu + both dialogs used to sit as template-root
         siblings of `.photos-root` — outside its DOM subtree entirely. Every `.photos-root .xxx`
         parity selector is a descendant selector and needs a real `.photos-root` ANCESTOR in the
         DOM, which a sibling position does not provide (acceptance-fix-report.md §F1/§F2/§F4;
         same rule PhotosAlbums.vue's own dialogs follow, its Fix-1 item 3). Moved back inside
         `.photos-root` (sibling of `.app` is fine — `position: fixed` means nesting here does
         not reintroduce `.app`'s `overflow: hidden` clipping). -->
    <div
      v-if="clusterMenu"
      ref="clusterMenuRef"
      class="cluster-menu"
      data-test="cluster-menu"
      :style="{ left: clusterMenu.x + 'px', top: clusterMenu.y + 'px' }"
    >
      <!-- Added during user acceptance (Vue2's menu :213-231 has only the three items name/
           merge/delete — the whole Vue2 list page has no entry point at all to an unnamed
           person's detail page). Placed first: it's a "view only, no mutation" action, ahead of
           the three data-mutating actions. Routes through the same openPerson as named cards,
           sharing the encodeURIComponent guard. -->
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
      <!-- T7 (Plan D): "Hide person" — Vue2 :274-280, only shows when hiddenPeopleSupported, with
           an explanatory title; the click executes immediately, no confirmation (see the
           onHideCluster comment). Position matches Vue2's own literal order: name/merge/hide/delete. -->
      <button
        v-if="people.hiddenPeopleSupported"
        type="button"
        class="cluster-menu-item"
        data-test="menu-hide"
        :title="t('photosPersonHideGateTitle')"
        @click="onHideCluster"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9"/><path d="M10 13h4"/></svg>
        <span>{{ t('photosPersonMenuHide') }}</span>
      </button>
      <button type="button" class="cluster-menu-item is-danger" data-test="menu-delete" @click="openDialog('delete')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        <span>{{ t('photosPersonDeleteCluster') }}</span>
      </button>
    </div>

    <!-- T7: the three-mode action dialog is really wired up now. Candidates pass the full named
         list — sorting/filtering/truncation happen inside the dialog (per the brief's decision). -->
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

    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body"
         shape as PhotosToastHost (not present on this view) -- Photos has no shared shell to
         mount this once at. -->
    <AskNimoHost />
  </div>
</template>

<style scoped>
/* Task 2 (Plan D re-shell) shadowing cleanup: every rule that duplicated a parity rule under
   the same selector/anchor with the same (or now-corrected) value has been deleted — parity's
   `src/photos/styles/vue2-parity/photos-people.scss` governs directly. What's left below are
   only the rules parity genuinely has no source for: layout scaffolding this page's own `.app`
   grid re-skin still needs (`.photos-main`, no parity selector by that name — same as
   PhotosAlbums.vue's own copy), two structural div wrappers Vue2 has no class for at all
   (`.people-banner-text`, `.people-filters-spacer`), the `:deep(.person-avatar-*)` rules that
   target this component's own avatar markup (parity's equivalents target Vue2's plain `.ring
   img`, a DOM shape this page never has), a New-UI-only empty state, a New-UI-only "em"
   emphasis span, the merge-banner's warning variant (no Vue2 counterpart, see below), and the
   suggestion-stack avatar's border (its sizing model differs from parity's `.dot`, see below).
   See task-2-report.md's deviations table for what changed value/token when a duplicate was
   deleted (fonts, paddings, colors, radii, z-index, several dark-glass tokens that were
   theme-variant here but must be theme-invariant per Vue2's own design). */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* Vue2 wraps the title+sub pair in an unclassed div (PhotosPeopleView.vue:3); New-UI's own
   `.people-banner-text` class is a structural-only addition (flex-shrink guard for the h1/sub
   pair), no Vue2 pixel value to transcribe. */
.people-banner-text { min-width: 0; }

/* Vue2's filter-row spacer is an unclassed `<div style="flex:1">` (PhotosPeopleView.vue:84);
   same situation as `.people-banner-text` above — structural only. */
.people-filters-spacer { flex: 1 1 auto; }

/* New-UI addition: this page's own empty-state naming (`.empty-state`/-title/-desc), distinct
   from parity's `.people-empty` (which transcribes Vue2's own `.t`/`.d` nested-class shape —
   New-UI doesn't use that markup here). No Vue2 pixel source either way; tokens aligned to
   PhotosAlbums.vue's own identical local copy for cross-page consistency. */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--text-2); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--text-1); }
.empty-state-desc { font-size: 13px; }

/* Hover nudges the avatar in slightly (scss:129-131's intent), but Vue2's own rule selects
   `.ring img` — this component uses PersonAvatar, whose DOM has no `.ring` at all, so parity's
   rule can never reach it here; a local equivalent targeting PersonAvatar's own real image
   class name has to stay. */
.face-card :deep(.person-avatar-img) { transition: transform 0.4s ease; }
.face-card:hover :deep(.person-avatar-img) { transform: scale(1.05); }
/* Vue2 scss:132-136 adds an accent inner ring around favorited avatars (data-fav). Same
   situation as the rule above: parity's `.ring[data-fav]::after` targets Vue2's DOM shape, so
   this has to hang off PersonAvatar's own class name here — structural, not a duplicate.
   Review Important 2 (both points fixed together):
   ① **Must be an ::after overlay, not a box-shadow on .person-avatar-ring itself.** Per the CSS
      spec, an inset shadow paints "before the content and descendants," and the ring's inner
      .person-avatar-img / .person-avatar-fallback fill the entire padding box — that 2px accent
      would be 100% covered by the face photo, so the Pinned section would show no visible sign
      of "pinned/favorited" at all. Vue2 itself uses ::after here (scss:132-136) — the
      pseudo-element sits on top of the img, which is the only way it's visible.
   ② Selector gained the data-fav condition (PersonAvatar's root element now carries this
      attribute, matching Vue2's own `.ring[data-fav]`). It used to match every avatar under
      .face-grid-lg unconditionally — currently equivalent in practice (only favorited people
      render in Pinned) but relying on that coincidence is fragile.
   Hung off .person-avatar (the component root, position:relative and the same box as the ring)
   rather than .person-avatar-ring itself: the ring has its own overflow:hidden, and a
   pseudo-element positioned against it would get clipped away.
   **Inner ring only, no outer glow**: Vue2's own rule has a second outer-glow layer
   (0 0 0 3px, accent at 20% opacity) that is likewise clipped by `.ring { overflow: hidden }`
   (scss:120) and has never actually rendered in Vue2 — not copying that dead code here (copying
   it would render a glow Vue2 never shows, which is new visual behavior, not 1:1 parity). */
.face-grid-lg .face-card :deep(.person-avatar[data-fav="true"])::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--accent);
  pointer-events: none;
}

/* Unnamed faces are dialed down one notch in opacity to separate them visually from the named
   sections (scss:215's intent) — same situation as the two rules above: parity's `.ring img
   { opacity }` selector can't reach this component's DOM, so a local equivalent stays. */
.cluster-card :deep(.person-avatar-img) { opacity: 0.92; }

/* New-UI addition: the settings-link emphasis span inside the faces-off warning banner's
   description (Vue2 uses a real `<a href="#">` there instead — see the template's own
   deviation-3/7 comments on why this page renders emphasis text instead of a dead link). No
   Vue2 class to anchor to. */
.merge-banner .desc .em { color: var(--accent-hi); font-weight: 500; }

/* Vue2 :87-113's two warning-banner states (faces-off / ML-offline) have no CSS class at all in
   Vue2 — they're plain inline orange styles with no reusable selector, and parity intentionally
   does not transcribe them (this whole variant is a New-UI addition riding the shared global
   `.merge-banner` shape). Kept local, using the shared app-wide `--warn-*` tokens (consistent
   with every other warning banner in this app, not a parity/Vue2 value). */
.merge-banner.is-warn { background: var(--warn-bg); border-color: var(--warn-border); }
.merge-banner.is-warn .icon-wrap { background: color-mix(in srgb, var(--warn-fg) 18%, transparent); color: var(--warn-fg); }
.merge-banner.is-warn .title { color: var(--warn-fg); }

/* Hidden-people section: these five were previously inline `style="..."` attributes on the
   template (repo convention is class over inline style; no visual change, values transcribed
   verbatim from what was there before). */
.people-hidden-head { cursor: pointer; }
.people-hidden-title { display: flex; align-items: center; gap: 8px; }
.people-hidden-count { color: var(--text-3); font-weight: 400; font-size: 13px; }
/* Fix wave (post-final-review): hardened to a compound selector -- `.people-hidden-static`
   alone is a single-class rule, the same specificity as parity's own `.face-card { cursor:
   pointer; }` (photos-people.scss:109), so the two only avoided flip-flopping by import/injection
   order rather than by an actual specificity win. `.face-card.people-hidden-static` (both
   classes always co-occur on this element per the template above) ties the specificity in this
   file's favor unconditionally, following the same defensive convention as PlacesRail.vue's own
   hover-cascade-lock rules. */
.face-card.people-hidden-static { cursor: default; }
.people-unhide-btn { margin-top: 2px; }

/* ── Suggestion confirmation cards (Plan C Task 2, 2026-08-20 people-suggestions-ui) ──
   New-UI-only section, no Vue2 counterpart to transcribe (parity's photos-people.scss has
   nothing for this — it's a brand-new feature), so it lives entirely in this component's own
   local style block, following the same policy this file already applies to its other
   New-UI-only additions above (.empty-state, .merge-banner.is-warn, etc.) rather than the
   shared parity file. Reuses this page's existing token vocabulary and pill-button geometry
   (.section-head, .people-btn-primary's accent-fill pattern) rather than inventing a new one.
   Every color here goes through a theme token (var(--overlay-bg)/var(--blur) reuse the exact
   "chrome sitting on top of an uncontrollable face photo" convention PersonAvatar.vue's own
   .person-avatar-fav already established; var(--on-accent) is the stripVar-safe
   fallback form the color guard explicitly allows) — no bare literal needed anywhere below. */
.people-suggestions { margin-bottom: 4px; }
.suggestion-list { display: flex; flex-direction: column; gap: 14px; }
.suggestion-card {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface-1);
  padding: 14px 16px;
}
.suggestion-card-head { display: flex; align-items: center; gap: 10px; }
.suggestion-card-title { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 500; color: var(--text-1); }
.suggestion-card-actions { display: inline-flex; gap: 8px; flex: none; }
.suggestion-action-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.suggestion-action-btn:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
.suggestion-action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.suggestion-action-btn.is-reject { background: var(--surface-2); border-color: var(--line); color: var(--text-2); }
.suggestion-action-btn.is-reject:hover { background: var(--surface-3); color: var(--text-1); }
.suggestion-face-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.suggestion-face {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--line);
}
.suggestion-face-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.suggestion-face.is-busy { opacity: 0.55; }
.suggestion-review-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 9.5px;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  color: var(--on-accent);
  border: 1px solid var(--line);
}
.suggestion-face-hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.suggestion-face:hover .suggestion-face-hover,
.suggestion-face:focus-within .suggestion-face-hover { opacity: 1; }
.suggestion-face-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  color: var(--on-accent);
}
.suggestion-face-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.suggestion-face-btn.is-accept { background: var(--accent); }
.suggestion-face-btn.is-accept:hover { background: var(--accent-hi); }
.suggestion-face-btn.is-reject { background: var(--surface-3); }
.suggestion-face-btn.is-reject:hover { background: var(--line-strong); }
</style>
