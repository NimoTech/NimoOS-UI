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
import { computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import PersonAvatar from './PersonAvatar.vue'
import { usePhotosPeople, type SuggestionGroup, type SuggestionItem } from '../stores/people'
import { mergeConfidencePct, type Person } from '../util/peopleView'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const { t } = useI18n()
const people = usePhotosPeople()

interface FlatItem { item: SuggestionItem; group: SuggestionGroup }

const flat = computed<FlatItem[]>(() =>
  people.suggestionGroups.flatMap((g) => g.suggestions.map((item) => ({ item, group: g }))),
)

// Session-local skip set (brief: "Skip = purely client-side advance", never touches the store).
// Wholesale-reassignment convention for ref<Set<…>> (this repo's established pattern for this
// shape of state — see e.g. PhotosPeople.vue's pre-rework suggestionBusy).
const skippedIds = ref<Set<string>>(new Set())
// N is pinned at the moment the wizard opens, so the progress denominator doesn't shift as items
// get decided/skipped mid-session.
const totalAtOpen = ref(0)
const busy = ref(false)
const viewMode = ref<'original' | 'compare'>('original')
const lightboxOpen = ref(false)

const current = computed<FlatItem | null>(() => flat.value.find((f) => !skippedIds.value.has(f.item.id)) ?? null)
const done = computed(() => current.value === null)
const remaining = computed(() => flat.value.filter((f) => !skippedIds.value.has(f.item.id)).length)
// Reviewed = however much of the original batch is no longer "current" — either decided (which
// shrinks `flat` itself) or skipped (tracked via skippedIds without shrinking `flat`). Clamped at
// 0 defensively: a fresh fetchSuggestions() racing in mid-session could in principle grow `flat`
// past totalAtOpen (new suggestions appearing while the wizard is open), which would otherwise
// make this go negative.
const reviewedCount = computed(() => Math.max(0, totalAtOpen.value - remaining.value))

const currentPerson = computed<Person | null>(() => current.value?.group.person ?? null)
const currentName = computed(() => currentPerson.value?.name || t('photosPersonUnnamedTitle'))
// Up to 5 reference faces (brief: "4-5"). NEW optional backend field — absent on older backends,
// feature-detected purely by presence (no separate capability flag needed: the field IS the
// detection). An empty array is treated the same as absent here (nothing to render either way).
const exemplarFaces = computed(() => (current.value?.group.exemplarFaceIds ?? []).slice(0, 5))

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
  current.value ? service.photos.thumbnailUrl(current.value.item.assetId, 'large') : ''
))
// The compare view's left side needs a plain square <img>, not the full PersonAvatar component
// (no fallback chrome, no initial/icon placeholder — the whole point of a face-to-face compare is
// two real crops side by side), so it calls the same URL helper PersonAvatar itself uses
// internally rather than going through the component.
const coverFaceUrl = computed(() => {
  const p = currentPerson.value
  return p ? service.photos.personFaceThumbnailUrl(p.id, p.coverFaceId) : ''
})
const scorePct = computed(() => mergeConfidencePct(current.value?.item.score))

function close(): void {
  emit('update:open', false)
}

async function decide(accept: boolean): Promise<void> {
  if (busy.value || !current.value) return
  const id = current.value.item.id
  busy.value = true
  try {
    await people.decideSuggestion(id, accept)
  } catch {
    // The store already console.error's the failure and issues its own corrective
    // fetchSuggestions() (see decideSuggestion's header comment in people.ts) — nothing further
    // to surface here, same rationale the pre-rework onDecideSuggestionFace documented.
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
  next.add(current.value.item.id)
  skippedIds.value = next
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  // The zoom lightbox is the topmost thing this component can show — Esc closes it first, same
  // "topmost overlay wins" convention the old suggestion-peek overlay followed in PhotosPeople.vue.
  if (lightboxOpen.value) { lightboxOpen.value = false; return }
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
      lightboxOpen.value = false
      document.addEventListener('keydown', onDocumentKeydown)
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
    }
  },
  { immediate: true },
)
// Each new suggestion starts back in the default pattern-① view — the compare toggle/lightbox
// state from the previous suggestion must not bleed into the next one.
watch(() => current.value?.item.id, () => {
  viewMode.value = 'original'
  lightboxOpen.value = false
})
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))
</script>

<template>
  <div v-if="open" class="prw-overlay" data-test="prw-overlay" @click.self="close">
    <div class="prw-panel" data-test="prw-panel">
      <button type="button" class="prw-close" data-test="prw-close" :aria-label="t('photosClose')" @click="close">&#215;</button>

      <template v-if="!done && current">
        <div class="prw-progress" data-test="prw-progress">{{ t('photosPeopleReviewProgress', { k: reviewedCount, n: totalAtOpen }) }}</div>

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
          <div class="prw-context-wrap" data-test="prw-context-photo" @click="lightboxOpen = true">
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

        <div class="prw-question" data-test="prw-question">{{ t('photosPeopleSuggestTitle', { name: currentName }) }}</div>

        <div class="prw-actions">
          <button type="button" class="prw-btn prw-btn-yes" data-test="prw-yes" :disabled="busy" @click="onYes">{{ t('photosPeopleReviewYes') }}</button>
          <button type="button" class="prw-btn prw-btn-no" data-test="prw-no" :disabled="busy" @click="onNo">{{ t('photosPeopleReviewNo') }}</button>
          <button type="button" class="prw-btn prw-btn-skip" data-test="prw-skip" :disabled="busy" @click="onSkip">{{ t('photosPeopleReviewSkip') }}</button>
        </div>
      </template>

      <div v-else class="prw-done" data-test="prw-done">
        <div class="prw-done-title" data-test="prw-done-title">{{ t('photosPeopleReviewDoneTitle') }}</div>
        <button type="button" class="prw-btn prw-btn-yes" data-test="prw-done-close" @click="close">{{ t('photosClose') }}</button>
      </div>

      <div v-if="lightboxOpen" class="prw-lightbox" data-test="prw-lightbox" @click.self="lightboxOpen = false">
        <img class="prw-lightbox-img" data-test="prw-lightbox-img" :src="contextUrl" :alt="t('photosPeopleSuggestPeekAlt')">
        <button
          type="button"
          class="prw-lightbox-close"
          data-test="prw-lightbox-close"
          :aria-label="t('photosClose')"
          @click="lightboxOpen = false"
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
.prw-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--r-md);
  box-shadow: var(--card-shadow-hi);
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
