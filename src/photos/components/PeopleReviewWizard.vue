<script setup lang="ts">
// PeopleReviewWizard.vue (people-confirm-polish, 2026-08-21) — full-screen Apple-style review
// wizard for the People page's "待确认/To confirm" section (pattern ① primary + pattern ②
// integrated, the design the user picked after an interactive three-pattern demo). Replaces the
// old per-group card grid (inline ✓/✕ buttons, group-level Confirm-all/Reject-all) and its
// click-to-enlarge peek overlay entirely — PhotosPeople.vue now only renders a compact entry
// card (count + preview thumbs + this wizard's own open trigger).
//
// One suggestion at a time, across ALL groups sequentially. Division of labor: unlike
// ClusterActionDialog.vue (which only collects input and emits — the host owns every store
// call), this component owns its OWN store interaction end-to-end. Brief basis for that choice:
// "No other store changes expected — the wizard iterates suggestionGroups" (i.e. it reads the
// store directly, not through a prop the host would have to keep in sync) and "Busy state: …
// local in-flight flag" (i.e. the in-flight guard is this component's own state, not something
// the host manages). So the only thing crossing the props/emit boundary is `open`/`update:open`
// — accept/reject/skip are all internal.
//
// Auto-advance is NOT a manual "move to index+1" step for accept/reject: `people.suggestionGroups`
// is the live Pinia ref, so once decideSuggestion() resolves and the store optimistically removes
// the decided item, `flat` recomputes on its own and `current` naturally becomes the next item.
// Skip is the one path that needs an explicit local marker (skippedIds) — the store never removes
// a skipped item, only this component's own session state does.
//
// Merge-cards feature (2026-08-21): cluster-merge questions (whole-cluster-pair review, not a
// single face) now join this same queue, AFTER every per-face suggestion — `flat` below is a
// discriminated union so one sequential wizard can walk both kinds in order without a second
// component. `skippedIds`/`current`/`totalAtOpen`/progress all operate on the union uniformly
// (keyed by `flatKey`, a `"face:<id>" | "merge:<id>"` composite — the two id namespaces are
// otherwise unrelated backend ids that could theoretically collide).
import { computed, ref, watch, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import PersonAvatar from './PersonAvatar.vue'
import { usePhotosPeople, type SuggestionGroup, type SuggestionItem, type MergeQuestionPair } from '../stores/people'
import { mergeConfidencePct, pluralWord, type Person } from '../util/peopleView'
import { mapFaceBoxToRect, type FaceRect } from '../lightbox/util/faceBox'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { t } = useI18n()
const people = usePhotosPeople()

type FlatItem =
  | { kind: 'face'; item: SuggestionItem; group: SuggestionGroup }
  | { kind: 'merge'; pair: MergeQuestionPair }

// Face items first, merge questions after — per the brief ("merge questions join the review
// queue AFTER the face suggestions").
const flat = computed<FlatItem[]>(() => [
  ...people.suggestionGroups.flatMap((g) => g.suggestions.map((item) => ({ kind: 'face' as const, item, group: g }))),
  ...people.mergeQuestions.map((pair) => ({ kind: 'merge' as const, pair })),
])

function flatKey(f: FlatItem): string {
  return f.kind === 'face' ? `face:${f.item.id}` : `merge:${f.pair.id}`
}

// Session-local skip set (brief: "Skip = purely client-side advance", never touches the store).
// Wholesale-reassignment convention for ref<Set<…>> (this repo's established pattern for this
// shape of state — see e.g. PhotosPeople.vue's pre-rework suggestionBusy).
const skippedIds = ref<Set<string>>(new Set())
// N is pinned at the moment the wizard opens, so the progress denominator doesn't shift as items
// get decided/skipped mid-session.
const totalAtOpen = ref(0)
const busy = ref(false)
const viewMode = ref<'original' | 'compare'>('original')
// Merge-card legibility fix (2026-08-21): the zoom lightbox used to be single-purpose (always
// the face-suggestion body's own contextUrl). It is now a generic "show this one URL, big" overlay
// so the merge body's face tiles can reuse the exact same mechanism -- `null` = closed, any string
// = open showing that URL. openLightbox()/closeLightbox() are the only mutators; nothing sets
// lightboxUrl directly outside them, so every open path is traceable to one of the two callers
// below (the face body's context-photo click, or a merge-card tile click).
const lightboxUrl = ref<string | null>(null)
// T12b (face-locate box, 2026-08-27 addendum): the currently-opened tile's normalized bbox, if
// any -- a merge tile's own preview data (fromFaces/intoFaces[i].bbox), or null for every other
// lightbox-opening path (face-suggestion context photo, a face-crop-only fallback tile). Paired
// 1:1 with lightboxUrl through openLightbox/closeLightbox; nothing else mutates it.
const lightboxFaceBox = ref<number[] | null>(null)
// The lightbox <img> element and the rect mapFaceBoxToRect computes for it (null whenever there's
// no box to draw, or the box/element geometry doesn't resolve to a content frame yet).
const lightboxImgEl = ref<HTMLImageElement | null>(null)
const faceBoxRect = ref<FaceRect | null>(null)

const current = computed<FlatItem | null>(() => flat.value.find((f) => !skippedIds.value.has(flatKey(f))) ?? null)
const done = computed(() => current.value === null)
const remaining = computed(() => flat.value.filter((f) => !skippedIds.value.has(flatKey(f))).length)
// Reviewed = however much of the original batch is no longer "current" — either decided (which
// shrinks `flat` itself) or skipped (tracked via skippedIds without shrinking `flat`). Clamped at
// 0 defensively: a fresh fetchSuggestions()/fetchMergeQuestions() racing in mid-session could in
// principle grow `flat` past totalAtOpen (new items appearing while the wizard is open), which
// would otherwise make this go negative.
const reviewedCount = computed(() => Math.max(0, totalAtOpen.value - remaining.value))

// ── Face-suggestion-only view state (pattern ① / ② body) ──
const currentPerson = computed<Person | null>(() => (current.value?.kind === 'face' ? current.value.group.person : null))
const currentName = computed(() => currentPerson.value?.name || t('photosPersonUnnamedTitle'))
// Up to 5 reference faces (brief: "4-5"). NEW optional backend field — absent on older backends,
// feature-detected purely by presence (no separate capability flag needed: the field IS the
// detection). An empty array is treated the same as absent here (nothing to render either way).
// Defensive dedupe: the backend contract excludes the person's own coverFaceId from this list,
// but the header already renders that face via PersonAvatar right next to it — filter it out
// here too so a future backend regression can't make it show up twice.
const exemplarFaces = computed(() => (
  (current.value?.kind === 'face' ? current.value.group.exemplarFaceIds ?? [] : [])
    .filter((id) => id !== String(currentPerson.value?.coverFaceId ?? ''))
    .slice(0, 5)
))

function faceThumb(faceId: string): string {
  return service.photos.faceThumbnailUrl(faceId)
}
// Fix round 1 precedent carried over from the old peek overlay (PhotosPeople.vue, deleted by
// this rework): deliberately thumbnailUrl(assetId,'large'), NOT originalUrl. A suggestion's
// assetId can point at a video (face detection runs on video keyframes too, and
// person_suggestions has no video-exclusion filter) — Original streams back the raw video file
// for those, unrenderable by an <img>; thumbnailUrl's pregenerated large.jpg exists for every
// asset type, video included.
const contextUrl = computed(() => (
  current.value?.kind === 'face' ? service.photos.thumbnailUrl(current.value.item.assetId, 'large') : ''
))
// The compare view's left side needs a plain square <img>, not the full PersonAvatar component
// (no fallback chrome, no initial/icon placeholder — the whole point of a face-to-face compare is
// two real crops side by side), so it calls the same URL helper PersonAvatar itself uses
// internally rather than going through the component.
const coverFaceUrl = computed(() => {
  const p = currentPerson.value
  return p ? service.photos.personFaceThumbnailUrl(p.id, p.coverFaceId) : ''
})
const scorePct = computed(() => (current.value?.kind === 'face' ? mergeConfidencePct(current.value.item.score) : 0))

// ── Merge-card-only view state (merge-cards feature; large-tile grid + zoom is the
// merge-card-legibility fix, 2026-08-21) ──
const currentPair = computed<MergeQuestionPair | null>(() => (current.value?.kind === 'merge' ? current.value.pair : null))
function sideName(p: Person | undefined): string {
  return p?.name || t('photosPersonUnnamedTitle')
}
function sidePhotosCount(p: Person | undefined): string {
  const n = p?.count ?? 0
  return t('photosPeopleMergePhotosCount', { n: n.toLocaleString(), s: pluralWord(n) })
}
// A merge-card face tile: always has a faceId (what the tile itself renders, via faceThumb --
// a merge card's collage faces have no owning person's cover slot any more meaningfully than a
// suggestion's candidate face does), and OPTIONALLY an assetId (present only when the backend's
// new fromFaces/intoFaces field is there). assetId is what the click handler below needs to zoom
// to the full original photo instead of just the face crop.
// T12b (face-locate box, 2026-08-27 addendum): bbox rides along with faceId/assetId -- only
// ever present when the tile ALSO has an assetId (fromFaces/intoFaces entries), since the
// fallback id-only path has nowhere to draw a box (no full-photo lightbox target either).
interface MergeTile { faceId: string; assetId?: string; bbox?: number[] }
// Up to 4 preview faces per side (brief: "≤4"). Feature-detected by presence of the NEW
// fromFaces/intoFaces field (an array, even if empty, means the backend has it) -- falls back to
// the older bare fromFaceIds/intoFaceIds (id-only, no assetId) so a not-yet-upgraded backend still
// renders a usable, just degraded, grid (see MergeTile's own comment).
function sideTiles(pair: MergeQuestionPair, side: 'from' | 'into'): MergeTile[] {
  const faces = side === 'from' ? pair.fromFaces : pair.intoFaces
  if (faces) return faces.slice(0, 4).map((f) => ({ faceId: f.faceId, assetId: f.assetId, bbox: f.bbox }))
  const ids = side === 'from' ? pair.fromFaceIds : pair.intoFaceIds
  return ids.slice(0, 4).map((faceId) => ({ faceId }))
}
const fromTiles = computed<MergeTile[]>(() => (currentPair.value ? sideTiles(currentPair.value, 'from') : []))
const intoTiles = computed<MergeTile[]>(() => (currentPair.value ? sideTiles(currentPair.value, 'into') : []))
// 1-2 faces stack in a single full-width column so each tile gets the whole card's width (the
// "grow bigger" half of the brief); 3-4 switch to a 2-column grid once a single column would make
// the card awkwardly tall. Read by the template as a `data-cols` attribute (CSS keys off it),
// following this file's existing `data-active`-attribute convention rather than inline styles.
function gridCols(tiles: MergeTile[]): 1 | 2 {
  return tiles.length >= 3 ? 2 : 1
}
// Distance is shown subtly (brief), not run through mergeConfidencePct — it's a raw
// complete-linkage distance (lower = closer), not the same "confidence" semantics that
// percentage formatter was built for elsewhere in this file.
const distLabel = computed(() => (
  currentPair.value ? t('photosPeopleMergeDistLabel', { dist: currentPair.value.dist.toFixed(3) }) : ''
))

const questionText = computed(() => (
  current.value?.kind === 'merge' ? t('photosPeopleMergeQuestionTitle') : t('photosPeopleSuggestTitle', { name: currentName.value })
))
const yesLabel = computed(() => (current.value?.kind === 'merge' ? t('photosPeopleMergeAccept') : t('photosPeopleReviewYes')))
const noLabel = computed(() => (current.value?.kind === 'merge' ? t('photosPeopleMergeReject') : t('photosPeopleReviewNo')))

function close(): void {
  emit('update:open', false)
}

// Merge-card legibility fix (2026-08-21): the shared zoom-lightbox mutators (see lightboxUrl's
// own declaration comment above for why this is generic rather than face-body-specific now).
// T12b (2026-08-27 addendum): bbox is an explicit, optional second argument -- every call site
// states its own intent (a merge tile passes its own bbox; every other opener omits it, which
// defaults to null) rather than some callers relying on a previous call's leftover value.
function openLightbox(url: string, bbox: number[] | null = null): void {
  lightboxUrl.value = url
  lightboxFaceBox.value = bbox
}
function closeLightbox(): void {
  lightboxUrl.value = null
  lightboxFaceBox.value = null
}
// A merge tile's click target: the FULL original photo (service.photos.thumbnailUrl(assetId,
// 'large') -- same precedent as contextUrl above re: thumbnailUrl over originalUrl, video-safe)
// when the backend's new fromFaces/intoFaces gave this tile an assetId; degrades to the enlarged
// face crop (faceThumb) when it didn't (old backend, id-only arrays) -- "degraded but usable" per
// the brief, not a broken click. The bbox overlay only ever accompanies the full-photo path (a
// face-crop-only fallback tile has nowhere sensible to draw a locate-box).
function onMergeTileClick(tile: MergeTile): void {
  if (tile.assetId) {
    openLightbox(service.photos.thumbnailUrl(tile.assetId, 'large'), tile.bbox ?? null)
  } else {
    openLightbox(faceThumb(tile.faceId))
  }
}

// T12b (face-locate box, 2026-08-27 addendum): recomputes the mapped rect from the CURRENT
// lightbox image element + bbox. Called on the <img>'s @load (first paint) and by the
// ResizeObserver below (window resize / lightbox re-layout) -- same two triggers
// PhotoImageViewer.vue's own OCR-highlight overlay uses for the identical reason (naturalWidth/
// naturalHeight are only known once the image has actually loaded).
function recomputeFaceBox(): void {
  const el = lightboxImgEl.value
  const box = lightboxFaceBox.value
  faceBoxRect.value = el && box ? mapFaceBoxToRect(box, el.clientWidth, el.clientHeight, el.naturalWidth, el.naturalHeight) : null
}

let faceBoxResizeObserver: ResizeObserver | undefined
function teardownFaceBoxObserver(): void {
  faceBoxResizeObserver?.disconnect()
  faceBoxResizeObserver = undefined
}
// Re-arm the observer every time the lightbox opens/closes (the <img> it needs to observe only
// exists while lightboxUrl !== null, per the template's v-if) -- mirrors PhotoImageViewer.vue's
// onMounted/onBeforeUnmount pairing, just re-triggered on lightboxUrl instead of component mount
// since this overlay's host element itself mounts/unmounts with the lightbox.
watch(lightboxUrl, async (url) => {
  teardownFaceBoxObserver()
  if (url === null) { faceBoxRect.value = null; return }
  await nextTick()
  recomputeFaceBox()
  if (lightboxImgEl.value && typeof ResizeObserver !== 'undefined') {
    faceBoxResizeObserver = new ResizeObserver(recomputeFaceBox)
    faceBoxResizeObserver.observe(lightboxImgEl.value)
  }
})

async function decide(accept: boolean): Promise<void> {
  if (busy.value || !current.value) return
  const cur = current.value
  busy.value = true
  try {
    if (cur.kind === 'face') {
      await people.decideSuggestion(cur.item.id, accept)
    } else {
      await people.decideMergeQuestion(cur.pair.id, accept)
    }
  } catch {
    // The store already console.error's the failure and issues its own corrective refetch
    // (fetchSuggestions/fetchMergeQuestions — see each decide*'s header comment in people.ts) —
    // nothing further to surface here, same rationale the pre-rework onDecideSuggestionFace
    // documented.
  } finally {
    busy.value = false
  }
}
function onYes(): void {
  void decide(true)
}
function onNo(): void {
  void decide(false)
}
function onSkip(): void {
  if (busy.value || !current.value) return
  const next = new Set(skippedIds.value)
  next.add(flatKey(current.value))
  skippedIds.value = next
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // The zoom lightbox is the topmost thing this component can show — Esc closes it first, same
  // "topmost overlay wins" convention the old suggestion-peek overlay followed in PhotosPeople.vue.
  if (lightboxUrl.value !== null) { closeLightbox(); return }
  close()
}

// Esc always listened at document level, watch(open) attaches/detaches (ClusterActionDialog.vue's
// own precedent). Opening also resets every piece of session state: the skip set, N, the view
// toggle, and the lightbox — a fresh open must never carry over a previous session's leftovers.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      skippedIds.value = new Set()
      totalAtOpen.value = flat.value.length
      viewMode.value = 'original'
      lightboxUrl.value = null
      lightboxFaceBox.value = null
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
// Each new suggestion starts back in the default pattern-① view — the compare toggle/lightbox
// state from the previous suggestion must not bleed into the next one. Keyed by flatKey (not
// just item.id) so this also fires correctly across the face->merge kind boundary.
watch(() => (current.value ? flatKey(current.value) : null), () => {
  viewMode.value = 'original'
  lightboxUrl.value = null
  lightboxFaceBox.value = null
})
onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  teardownFaceBoxObserver()
})
</script>

<template>
  <div v-if="open" class="prw-overlay" data-test="prw-overlay" @click.self="close">
    <div class="prw-panel" data-test="prw-panel">
      <button type="button" class="prw-close" data-test="prw-close" :aria-label="t('photosClose')" @click="close">&#215;</button>

      <template v-if="!done && current">
        <div class="prw-progress" data-test="prw-progress">{{ t('photosPeopleReviewProgress', { k: reviewedCount, n: totalAtOpen }) }}</div>

        <!-- ── Face-suggestion body (pattern ① / ②, unchanged) ── -->
        <template v-if="current.kind === 'face'">
          <div class="prw-header" data-test="prw-header">
            <PersonAvatar :person-id="currentPerson?.id ?? null" :name="currentPerson?.name" :ver="currentPerson?.coverFaceId ?? null" :size="56" />
            <div class="prw-header-text">
              <div class="prw-name" data-test="prw-person-name">{{ currentName }}</div>
              <div v-if="exemplarFaces.length" class="prw-reference" data-test="prw-reference">
                <span class="prw-reference-label">{{ t('photosPeopleReviewReferenceLabel') }}</span>
                <span class="prw-reference-thumbs">
                  <img v-for="fid in exemplarFaces" :key="fid" class="prw-reference-thumb" :src="faceThumb(fid)" alt="">
                </span>
              </div>
            </div>
          </div>

          <div class="prw-toggle" data-test="prw-view-toggle">
            <button
              type="button"
              class="prw-toggle-btn"
              data-test="prw-view-original"
              :data-active="viewMode === 'original'"
              @click="viewMode = 'original'"
            >{{ t('photosPeopleReviewViewOriginal') }}</button>
            <button
              type="button"
              class="prw-toggle-btn"
              data-test="prw-view-compare"
              :data-active="viewMode === 'compare'"
              @click="viewMode = 'compare'"
            >{{ t('photosPeopleReviewViewCompare') }}</button>
          </div>

          <div v-if="viewMode === 'original'" class="prw-body-original" data-test="prw-body-original">
            <div class="prw-context-wrap" data-test="prw-context-photo" @click="openLightbox(contextUrl)">
              <img class="prw-context-img" :src="contextUrl" :alt="t('photosPeopleSuggestPeekAlt')">
              <img class="prw-inset-img" data-test="prw-inset-face" :src="faceThumb(current.item.faceId)" alt="">
            </div>
          </div>
          <div v-else class="prw-body-compare" data-test="prw-body-compare">
            <div class="prw-compare-side">
              <img class="prw-compare-img" :src="coverFaceUrl" alt="">
              <div class="prw-compare-label" data-test="prw-compare-name">{{ currentName }}</div>
            </div>
            <div class="prw-compare-side">
              <img class="prw-compare-img" data-test="prw-compare-candidate-img" :src="faceThumb(current.item.faceId)" alt="">
              <div class="prw-compare-label">
                <span>{{ t('photosPeopleReviewCandidateLabel') }}</span>
                <span class="prw-kind-badge" data-test="prw-kind-badge">
                  {{ current.item.kind === 'review' ? t('photosPeopleReviewBadge') : t('photosPeopleJoinBadge') }}
                </span>
                <span class="prw-score" data-test="prw-score">{{ scorePct }}%</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ── Merge-card body (merge-card legibility fix, 2026-08-21): a whole cluster-pair, two
             sides side-by-side, each side a LARGE square face-tile grid (same body scale as the
             face-suggestion compare view above -- .prw-body-compare's sizing is this body's
             reference) + photo count + name. Any tile click opens the shared zoom lightbox. ── -->
        <template v-else>
          <div class="prw-merge-sides" data-test="prw-merge-sides">
            <div class="prw-merge-side" data-test="prw-merge-side-from">
              <div class="prw-merge-grid" :data-cols="gridCols(fromTiles)">
                <img
                  v-for="tile in fromTiles"
                  :key="tile.faceId"
                  class="prw-merge-tile"
                  data-test="prw-merge-tile"
                  :src="faceThumb(tile.faceId)"
                  :alt="t('photosPeopleSuggestPeekAlt')"
                  @click="onMergeTileClick(tile)"
                >
              </div>
              <div class="prw-merge-count" data-test="prw-merge-from-count">{{ sidePhotosCount(current.pair.from) }}</div>
              <div class="prw-merge-name" data-test="prw-merge-from-name">{{ sideName(current.pair.from) }}</div>
            </div>
            <div class="prw-merge-side" data-test="prw-merge-side-into">
              <div class="prw-merge-grid" :data-cols="gridCols(intoTiles)">
                <img
                  v-for="tile in intoTiles"
                  :key="tile.faceId"
                  class="prw-merge-tile"
                  data-test="prw-merge-tile"
                  :src="faceThumb(tile.faceId)"
                  :alt="t('photosPeopleSuggestPeekAlt')"
                  @click="onMergeTileClick(tile)"
                >
              </div>
              <div class="prw-merge-count" data-test="prw-merge-into-count">{{ sidePhotosCount(current.pair.into) }}</div>
              <div class="prw-merge-name" data-test="prw-merge-into-name">{{ sideName(current.pair.into) }}</div>
            </div>
          </div>
          <div class="prw-merge-dist" data-test="prw-merge-dist">{{ distLabel }}</div>
        </template>

        <div class="prw-question" data-test="prw-question">{{ questionText }}</div>

        <div class="prw-actions">
          <button type="button" class="prw-btn prw-btn-yes" data-test="prw-yes" :disabled="busy" @click="onYes">{{ yesLabel }}</button>
          <button type="button" class="prw-btn prw-btn-no" data-test="prw-no" :disabled="busy" @click="onNo">{{ noLabel }}</button>
          <button type="button" class="prw-btn prw-btn-skip" data-test="prw-skip" :disabled="busy" @click="onSkip">{{ t('photosPeopleReviewSkip') }}</button>
        </div>
      </template>

      <div v-else class="prw-done" data-test="prw-done">
        <div class="prw-done-title" data-test="prw-done-title">{{ t('photosPeopleReviewDoneTitle') }}</div>
        <button type="button" class="prw-btn prw-btn-yes" data-test="prw-done-close" @click="close">{{ t('photosClose') }}</button>
      </div>

      <div v-if="lightboxUrl !== null" class="prw-lightbox" data-test="prw-lightbox" @click.self="closeLightbox">
        <!-- T12b (face-locate box, 2026-08-27 addendum): `.prw-lightbox-frame` shrink-wraps
             tightly around the <img> (display:inline-flex, no width/height of its own -- same
             role PhotoImageViewer.vue's `.img-wrap` plays for its OCR overlay), so the box
             overlay's absolute inset:0 origin coincides exactly with the <img>'s own rendered
             box and mapFaceBoxToRect's left/top/width/height (computed against that box's
             clientWidth/clientHeight) land in the right place without any extra offset math. -->
        <div class="prw-lightbox-frame" data-test="prw-lightbox-frame">
          <img
            ref="lightboxImgEl"
            class="prw-lightbox-img"
            data-test="prw-lightbox-img"
            :src="lightboxUrl"
            :alt="t('photosPeopleSuggestPeekAlt')"
            @load="recomputeFaceBox"
          >
          <div
            v-if="faceBoxRect"
            class="prw-face-box"
            data-test="prw-face-box"
            :style="{ left: `${faceBoxRect.left}px`, top: `${faceBoxRect.top}px`, width: `${faceBoxRect.width}px`, height: `${faceBoxRect.height}px` }"
          ></div>
        </div>
        <button
          type="button"
          class="prw-lightbox-close"
          data-test="prw-lightbox-close"
          :aria-label="t('photosClose')"
          @click="closeLightbox"
        >&#215;</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* New-UI-only feature, no Vue2 counterpart to transcribe — every color goes through this app's
   theme tokens (src/styles/theme.css / photos.scss), same policy the pre-rework suggestion cards
   followed in PhotosPeople.vue. z-index sits above every other Photos overlay this page can show
   (.cluster-menu at 260, .cad-overlay at 200) — the wizard is meant to be the topmost thing on
   screen while it's open. */
.prw-overlay {
  position: fixed;
  inset: 0;
  z-index: 320;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
}
.prw-panel {
  position: relative;
  width: min(520px, 100%);
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: var(--r-md);
  background: var(--surface-1);
  border: 1px solid var(--line);
  box-shadow: var(--card-shadow-hi);
}
.prw-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--text-1);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.prw-close:hover { background: var(--surface-3); }

.prw-progress {
  align-self: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.prw-header { display: flex; align-items: center; gap: 12px; padding-right: 30px; }
.prw-header-text { min-width: 0; flex: 1; }
.prw-name { font-size: 16px; font-weight: 600; color: var(--text-1); }
.prw-reference { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.prw-reference-label { font-size: 11.5px; color: var(--text-3); flex-shrink: 0; }
.prw-reference-thumbs { display: flex; gap: 4px; }
.prw-reference-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--card-border);
}

/* Segmented view toggle (原图/对比). The `[data-active]:hover` rule below exists specifically to
   avoid a pit this repo has fallen into 4 times already (see PhotosStorageCard.vue's .seg-btn
   comment): a bare `.prw-toggle-btn:hover` and `.prw-toggle-btn[data-active="true"]` are both
   specificity 2 (one class + one pseudo-class / one class + one attribute selector), so which one
   wins on hover depends on source order alone unless the active+hover combination gets its own
   explicit rule. */
.prw-toggle {
  align-self: center;
  display: inline-flex;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 2px;
}
.prw-toggle-btn {
  padding: 6px 16px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 12.5px;
  border-radius: 6px;
  cursor: pointer;
}
.prw-toggle-btn:hover { color: var(--text-1); }
.prw-toggle-btn[data-active="true"] { background: var(--accent); color: var(--on-accent); }
.prw-toggle-btn[data-active="true"]:hover { background: var(--accent); color: var(--on-accent); }

.prw-body-original { display: flex; justify-content: center; }
.prw-context-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--surface-2);
  cursor: zoom-in;
}
.prw-context-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.prw-inset-img {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 72px;
  height: 72px;
  border-radius: var(--r-sm);
  object-fit: cover;
  border: 2px solid var(--surface-1);
  box-shadow: var(--card-shadow);
}

.prw-body-compare { display: flex; gap: 12px; }
.prw-compare-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.prw-compare-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--r-md);
  background: var(--surface-2);
  border: 1px solid var(--line);
}
.prw-compare-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-2);
}
.prw-kind-badge {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 500;
  background: var(--surface-3);
  color: var(--text-1);
  border: 1px solid var(--line);
}
.prw-score { color: var(--text-3); font-variant-numeric: tabular-nums; }

/* ── Merge-card body (merge-card legibility fix, 2026-08-21): two sides side-by-side, each a
   LARGE square face-tile grid + photo count + name -- matches .prw-body-compare's sizing above
   (same "two equal columns, square images at the panel's own scale" body, not a shrunken stamp
   like the pre-fix .prw-merge-collage this replaces). Reuses .prw-compare-side's overall
   flex/gap rhythm. New-UI-only feature, no Vue2 counterpart. */
.prw-merge-sides { display: flex; gap: 12px; }
.prw-merge-side {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 12px 0;
  border-radius: var(--r-md);
  background: var(--surface-2);
  border: 1px solid var(--line);
  overflow: hidden;
}
/* No horizontal padding on the side itself (unlike the old collage's boxed-in 72px square) --
   the grid spans the side's full width edge-to-edge so each tile gets as much room as this
   panel's fixed width allows. 1-2 faces: a single column, each tile the full side width ("grow
   bigger" -- a lone face lands close to .prw-compare-img's own ~230px). 3-4 faces: 2 columns,
   each tile still comfortably above the ~120px floor the brief calls for. */
.prw-merge-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.prw-merge-grid[data-cols="1"] { grid-template-columns: 1fr; }
.prw-merge-tile {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  background: var(--surface-3);
  cursor: zoom-in;
}
.prw-merge-count { font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; padding: 0 10px; text-align: center; }
.prw-merge-name { font-size: 13.5px; font-weight: 600; color: var(--text-1); text-align: center; padding: 0 10px; }
/* Distance shown subtly (brief) — small, muted, no visual competition with the question line. */
.prw-merge-dist { align-self: center; font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; }

.prw-question { text-align: center; font-size: 14px; font-weight: 500; color: var(--text-1); }

.prw-actions { display: flex; gap: 10px; }
.prw-btn {
  flex: 1;
  height: 40px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
}
.prw-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.prw-btn-yes { background: var(--accent); border: 1px solid var(--accent); color: var(--on-accent); }
.prw-btn-yes:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
.prw-btn-no { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger-fg); }
.prw-btn-no:hover { background: var(--danger-border); }
.prw-btn-skip { background: var(--surface-2); border: 1px solid var(--line); color: var(--text-2); }
.prw-btn-skip:hover { background: var(--surface-3); color: var(--text-1); }

.prw-done { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px 0; }
.prw-done-title { font-size: 15px; font-weight: 600; color: var(--text-1); }
.prw-done .prw-btn-yes { flex: none; padding: 0 28px; }

/* Zoom lightbox for the default view's context photo — same overlay convention the deleted
   suggestion-peek overlay used in PhotosPeople.vue (fixed, centered, contain, scrim via
   --overlay-bg/--overlay-blur), sitting above the wizard panel itself. */
.prw-lightbox {
  position: fixed;
  inset: 0;
  z-index: 330;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
}
/* T12b (face-locate box, 2026-08-27 addendum): shrink-to-fit wrap around just the <img> (not the
   close button) -- see the template comment above for why this has to be the overlay's
   positioning parent rather than `.prw-lightbox` itself (a definite-size, padded flex box the
   image never actually fills edge-to-edge once object-fit:contain letterboxes it). */
.prw-lightbox-frame {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  max-height: 100%;
}
.prw-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--r-md);
  box-shadow: var(--card-shadow-hi);
}
/* Face-locate box (T12b, 2026-08-27 addendum): deliberately NOT a copy of `.lb-ocr-hit` (that one
   is a yellow filled hit-highlight for OCR text regions) -- this is a face-rectangle affordance,
   so a rounded outline + a soft dark halo for contrast against any photo background, no fill. */
.prw-face-box {
  position: absolute;
  pointer-events: none;
  border-radius: 6px;
  /* theme-exception: sits directly over an unpredictable photo, not app chrome -- needs a
     constant white outline + dark halo for contrast regardless of theme, same reasoning as
     PersonHero.vue's cover-photo overlays. */
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35), 0 0 12px 1px rgba(0, 0, 0, 0.45); /* theme-exception */
}
.prw-lightbox-close {
  position: fixed;
  top: 20px;
  right: 24px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--text-1);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.prw-lightbox-close:hover { background: var(--surface-3); }
</style>
