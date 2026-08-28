<script setup lang="ts">
// SP7-P7a-T5: SmartViewCreateDialog.vue — Smart view creation dialog (largest single
// component this sprint).
// Ported section-by-section from the Vue 2 panel's src/views/Photos/PhotosSmartViewsView.vue:42-182
// (template), :359-436 (methods, SV_QUICK_TEMPLATES/inferChips moved to smartViewSuggest.ts in T1),
// photos-smartview.scss:659-1013 + 574-605 (.sv-toggle-row/.sv-switch, brief didn't cover
// these ranges, went back to source to read actual definitions). Host mount point:
// PhotosSmartViews.vue (T4).
//
// Persistent mount + prop-driven visibility (component never unmounts/remounts due to v-if),
// so all "reset/sync on open" logic must live in `watch(() => props.open)`, not onMounted
// (third same-pattern trap in this section—first two: P2's isMoving self-hide and video
// startMs anchor).
//
// ── Source verification and deviation entries (full details in task-5-report.md,
//    keeping only entries that must be visible near code here) ──
//
// 1) `.sv-modal-icon` size: brief spec clause 2 says "28×28", source scss:690-691 actually
//    32×32—source is authoritative, brief got this one wrong.
// 2) `.sv-modal-icon` background changed from Vue2's hard-coded purple gradient
//    (linear-gradient(135deg, var(--accent), var(--accent-hi))) to var(--accent) solid,
//    foreground now meets precondition "background is --accent solid saturated", can legally
//    use --on-accent (brief controller addendum point 2).
// 3) `--on-accent` actually legal in two more places, not just brief's "only one"
//    (fix round 1 · I3 review verified each location, no code change, only reasoning—original
//    comment mistakenly cited non-existent file in this branch):
//    a) [Fix-5, reverted 2026-08-14] the --on-accent usage at
//       `.sv-switch[data-on="true"]::after` has been reverted — see that rule's own comment
//       in the style block. Parity's own switch knob is one colour in both states
//       (photos-smartview.scss:786-789 only moves it, never touches the background); the
//       "legal because it sits on a solid accent fill" argument made here was self-consistent
//       but never checked that Vue2's real value does not change with state, and the result
//       was a genuine bug the owner reproduced in a screenshot (the knob darkened once the
//       switch was turned on).
//    b) `.sv-btn-primary` (background: var(--accent); color: var(--on-accent))—structurally
//       matches existing primary button precedent in this repo: ClusterActionDialog.vue:320,
//       MergeReviewDialog.vue:262 (both files exist and verified in this branch).
//    Brief Step1's phrase "no other elements layered over photos" actually means "no other
//    elements stacked over photos/gradients needing theme-exception pinned light foreground"—
//    component indeed has no elements stacked over photos (only `.sv-preview-grid img` is bare
//    image, no overlay text) or gradients, that part checks out; reading it as "only one
//    --on-accent allowed in whole component" is too narrow, not a strict contradiction, just
//    incomplete enumeration. Logged this deviation from brief in the report.
// 4) Narrow screen breakpoint: brief says "Vue2 zero @media, ≤768px is deviation/new"—source
//    scss:1018-1022 already has `@media (max-width: 760px)` (changes grid-template-columns:1fr +
//    .sv-modal-side border-left→border-top), brief got this wrong too (not deviation, straight
//    port; only the breakpoint number differs—768 aligns with other similar files in this repo
//    like PhotosSmartViews.vue vs Vue2 literal 760, that difference is real deviation, logged).
//    Brief's suggested extra `.sv-modal` width min(100% - 24px, …) override is redundant—Vue2's
//    max-width:100% + outer scrim 40px/24px padding already shrink dialog naturally on narrow
//    screens, no extra override needed, not added.
// 5) `--text-1/2/3/4` four-tier mapping (brief token map only gave --surface/--line/scrim/shadow,
//    didn't mention text tiers): using --fg / --fg-muted / --fg-faint / --fg-subtle (ordered by
//    dark theme opacity high-to-low, --fg-faint already has precedent PersonPlacesTab.vue:201
//    etc), text-1→fg, text-2→fg-muted, text-3→fg-faint, text-4→fg-subtle.
// 6) `--font-display` (Vue2 used for preview count large font) no equivalent token in this repo,
//    pure typography choice not color, just omitted, inherits --font, no new token added.
// 7) fix round 1 · M1 (previously undeclared deviation, retroactively logged): **Escape closes
//    this overlay is net-new**—Vue2's dialog has zero Escape handling. Document-level listener +
//    watch(open) attach/detach follows AlbumPickerDialog.vue (exists in this branch) pattern,
//    but adding Escape to this dialog itself is not ported from Vue2, proactively added as
//    overlay usability baseline (per Global Constraints "overlay Escape always via document
//    listener"), not a straight port, added test case to pin it down.
//
// Full node inventory + deleted-code verification + i18n source conclusions in task-5-report.md.
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { usePhotosSmartViews } from '../stores/smartViews'
import { useToast } from '../../stores/toast'
import { inferChips, SV_QUICK_TEMPLATES, type QuickTemplate } from '../util/smartViewSuggest'
import PhotosThreshSlider from './PhotosThreshSlider.vue'

const props = withDefaults(defineProps<{
  open: boolean
  // SP15-P2b Task 4 (Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:232-240). Embedded mode is
  // what the Albums page's "Let Nimo draft it" fill option renders in place of its own
  // footer -- the panel body *is* the smart form, instead of opening a second modal.
  embedded?: boolean
  initialName?: string
}>(), { embedded: false, initialName: '' })
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created', id: string): void
  // Embedded mode only: the host closes its whole panel. Vue2 :322/:325 emits the same
  // 'close' event for every dismissal path (this dialog also has a v-model :open contract
  // for its standalone mount, which Vue2's embedded-only component never had -- 'close' is
  // net-new to carry the "close the whole host panel" meaning 'update:open' can't).
  (e: 'close'): void
}>()

const { t, locale } = useI18n()
const store = usePhotosSmartViews()
const toast = useToast()

// BCP-47 conversion (this repo's standard pattern, per SmartViewCard.vue:38 precedent):
// this repo's locale is 'zh_cn'/'en_us' (underscore), bare pass to toLocaleString throws RangeError.
const localeTag = computed(() => locale.value.replace('_', '-'))

interface Draft {
  name: string
  desc: string
  customChip: string
  chips: string[]
  thresh: number
  live: boolean
  includeVideos: boolean
}

// Per Vue2 _emptyDraft :359-365 field-by-field verification: default threshold 80,
// live defaults to true.
function emptyDraft(): Draft {
  return { name: '', desc: '', customChip: '', chips: [], thresh: 80, live: true, includeVideos: false }
}

const draft = reactive<Draft>(emptyDraft())
const nameInputRef = ref<HTMLInputElement | null>(null)
// SP15-P2b final fix wave: in embedded mode the name field does not exist (`v-if="!embedded"`
// -- the host panel owns the name), so focusing nameInputRef focused nothing at all and the
// fused create panel opened with no cursor anywhere. The description is the first field the
// user actually fills in there, so it takes the focus instead.
const descInputRef = ref<HTMLTextAreaElement | null>(null)

const templates: readonly QuickTemplate[] = SV_QUICK_TEMPLATES

// Per Vue2 suggestedChips computed :308-310.
const suggestedChips = computed(() => inferChips(draft.desc).filter((c) => !draft.chips.includes(c)))

// Per Vue2 threshMuted computed :315-318 (comment included as-is): empty form doesn't count
// as "threshold inactive", slider stays draggable.
const threshMuted = computed(
  () => !store.preview.thresholdActive && (draft.chips.length > 0 || draft.desc.trim().length > 0),
)

// SP15-P2b Task 4 (Vue2 PhotosSmartAlbumCreate.vue :271-273): embedded mode reads the
// host's Album name field live rather than copying it into the draft on open. Vue2
// :237-239 explains why -- a one-time seed leaves the user stuck if they pick the nimo
// option before typing a name: the host field keeps being the single source of truth.
const effectiveName = computed(() => (props.embedded ? props.initialName : draft.name).trim())

// Per Vue2 canSubmit computed :319-322, name criterion changed to effectiveName (Task 4).
const canSubmit = computed(
  () => effectiveName.value.length > 0 && (draft.chips.length > 0 || draft.desc.trim().length > 0),
)

// Per Vue2 refreshPreview call pattern, description gets trimmed before sending (Vue2
// :372 trims inside store method, here same at the single call site, not at every call point).
function triggerPreview(): void {
  store.refreshPreview({
    conds: [...draft.chips],
    description: draft.desc.trim(),
    threshold: draft.thresh,
    includeVideos: draft.includeVideos,
  })
}

// SP15-P2b Task 4 review fix round 1 · Important: this was a single embedded/standalone
// branch duplicated in two places (here and inline in confirm()'s success handler). The
// duplication is what let the Cancel path go untested -- the two copies could drift
// independently, and one review pass only exercised confirm()'s copy. One function, both
// callers route through it now.
//
// Vue2 :325 onScrimClick: in embedded mode the host panel owns dismissal -- it has the
// scrim, the Cancel button and the Escape handler. Emitting update:open from here would
// close the smart form while leaving the host panel open around an empty hole, so embedded
// mode asks the host to close everything instead.
function dismiss(): void {
  if (props.embedded) {
    emit('close')
  } else {
    emit('update:open', false)
  }
}

// SP15-P2b Task 4: the host panel owns the scrim in embedded mode (it has no scrim of
// its own to click through to), so a self-click on this component's own root must be a
// no-op there. Standalone mode is unchanged: click.self on the scrim closes as before.
function onRootClick(): void {
  if (!props.embedded) dismiss()
}

// Overlay Escape via document-level listener + watch(open) attach/detach (P4 hard-learned,
// AlbumPickerDialog.vue existing pattern). This component has one overlay only, no
// "multiple overlays open" early-return concern.
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  dismiss()
}

// Controller addendum 1 core: on open→true, reset draft + focus + refreshPreview, must live
// in watch(() => props.open) not onMounted—component persistent mount via v-if visibility,
// onMounted runs once at creation, second open won't retrigger.
// On close (controller addendum 3 path ①, store already added cancelPreview): clear any
// pending debounce timer + invalidate in-flight responses, prevent late-arriving response
// overwriting next open's preview.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      Object.assign(draft, emptyDraft())
      // SP15-P2b Task 4: Escape belongs to the host in embedded mode -- the host's own
      // document keydown handler (PhotosAlbums.vue) closes the whole panel. Attaching this
      // listener too would fire twice / race which one wins. The unconditional
      // removeEventListener calls below and in onUnmounted stay unconditional on purpose
      // (removing a listener that was never added is a no-op; guarding the removal would
      // leak if `embedded` changed mid-life -- the right general rule to keep this file
      // consistent with, even though withDefaults' static default makes it moot here).
      if (!props.embedded) document.addEventListener('keydown', onDocumentKeydown)
      void nextTick(() => (props.embedded ? descInputRef.value : nameInputRef.value)?.focus())
      triggerPreview()
    } else {
      document.removeEventListener('keydown', onDocumentKeydown)
      store.cancelPreview()
    }
  },
  { immediate: true },
)
// fix round 1 · M7: when component truly unmounts (e.g., leaving route, host v-if removes
// whole page), if dialog still open and queued 300ms debounce preview request hasn't fired/
// in-flight, not clearing it creates orphan request that fires anyway (Vue2 relied on
// clearTimeout in page-level beforeDestroy, New-UI adds equivalent here).
onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  store.cancelPreview()
})

// Per Vue2 addChip :392-397.
function addChip(c: string): void {
  const v = (c || '').trim()
  if (!v || draft.chips.includes(v)) return
  draft.chips.push(v)
  triggerPreview()
}

// Per Vue2 removeChip :398-401.
function removeChip(c: string): void {
  draft.chips = draft.chips.filter((x) => x !== c)
  triggerPreview()
}

// Per Vue2 addCustom :402-406 (includes literal "call refreshPreview twice"—once inside
// addChip, once here; store.refreshPreview just resets debounce timer so double-call harmless,
// ported as-is, no dedup).
function addCustom(): void {
  addChip(draft.customChip)
  draft.customChip = ''
  triggerPreview()
}

// Per Vue2 onChipKey :407-412: only comma triggers (Enter uses template @keydown.enter.prevent
// binding separately).
function onChipKey(e: KeyboardEvent): void {
  if (e.key === ',') {
    e.preventDefault()
    addCustom()
  }
}

// fix round 1 · I1: threshold slider extracted to PhotosThreshSlider.vue (shared by T8/T14),
// it emits already-converted number value, don't extract target.value from Event here.
function onThreshInput(v: number): void {
  draft.thresh = v
  triggerPreview()
}

// Per Vue2 :127: live toggle change doesn't trigger refreshPreview (verified not an
// oversight, ported as-is, no change).
function toggleLive(): void {
  draft.live = !draft.live
}

// Per Vue2 :134: includeVideos toggle change triggers refreshPreview.
function toggleIncludeVideos(): void {
  draft.includeVideos = !draft.includeVideos
  triggerPreview()
}

// Per Vue2 useTemplate :413-419, but desc inference changed to use T1's descEn
// (English original text) instead of descKey (i18n key)—POOL keywords are English, matching
// against key/Chinese translation always fails, verified key contract from T1, not arbitrary.
function useTemplate(row: QuickTemplate): void {
  draft.name = t(row.labelKey)
  draft.desc = t(row.descKey)
  draft.thresh = row.thresh
  draft.chips = inferChips(row.descEn).slice(0, 4)
  triggerPreview()
}

// Per Vue2 confirmCreate :420-436, but intentionally not ported in two places (both logged):
//  1) id generation/passing sunk into store.createSmartView (T2 fix round 1 · C1), don't
//     self-concatenate 'sv-' + Date.now().toString(36).
//  2) on failure Vue2 leaves rejection unhandled (dialog closes, UI silent); here catch → toast
//     and keep dialog open, user sees failure and can retry (same principle as
//     AlbumPickerDialog.vue submitCreate).
// description's `|| undefined` as-is from Vue2 :431 (backend omitempty semantics, don't send
// field for empty description).
async function confirm(): Promise<void> {
  if (!canSubmit.value || store.createBusy) return
  try {
    const created = await store.createSmartView({
      name: effectiveName.value,
      description: draft.desc.trim() || undefined,
      conds: [...draft.chips],
      threshold: draft.thresh,
      live: draft.live,
      includeVideos: draft.includeVideos,
    })
    if (created) {
      emit('created', created.id)
      // Routes through the same dismiss() the Cancel button and Escape use -- see its
      // definition above for why this decision must not be duplicated inline here.
      dismiss()
    }
  } catch (e) {
    console.error('[smart-view-create-dialog] confirm', e)
    // Reuse existing generic key, don't add new i18n key (brief hard requirement).
    toast.show(t('photosAlbumCreateFailed'))
  }
}

// Thumbnails always via shared service generator, don't hand-concatenate URL; smart view
// always uses 'large' size (per Vue2 `size=large` query param / SmartViewCard.vue precedent).
function thumbUrl(seed: string): string {
  return service.photos.thumbnailUrl(seed, 'large')
}
</script>

<template>
  <Transition name="sv-modal">
    <div
      v-if="open"
      :class="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      :data-test="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      @click.self="onRootClick"
    >
      <div class="sv-modal" :class="{ 'sv-modal-embedded': embedded }" :role="embedded ? undefined : 'dialog'" :aria-label="embedded ? undefined : t('photosSvNewSmartView')">
        <div v-if="!embedded" class="sv-modal-head">
          <div class="sv-modal-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
          </div>
          <div class="sv-modal-head-text">
            <div class="sv-modal-title">{{ t('photosSvNewSmartView') }}</div>
            <div class="sv-modal-sub">{{ t('photosSvSavedSearchKeepsItself') }}</div>
          </div>
          <button type="button" class="icon-btn" data-test="sv-close-btn" :aria-label="t('photosClose')" @click="dismiss">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="sv-modal-body">
          <div class="sv-modal-form">
            <label v-if="!embedded" class="sv-field">
              <span class="sv-field-label">{{ t('photosSvName') }}</span>
              <input
                ref="nameInputRef"
                v-model="draft.name"
                class="sv-input"
                data-test="sv-name-input"
                :placeholder="t('photosSvEGSaraTokyo')"
                @keydown.enter.prevent="confirm"
              >
            </label>

            <label class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvNimoMatch') }}
                <span class="sv-field-hint">{{ t('photosSvDescribePlainEnglishConditions') }}</span>
              </span>
              <textarea
                ref="descInputRef"
                v-model="draft.desc"
                class="sv-input sv-textarea"
                data-test="sv-desc-textarea"
                :placeholder="t('photosSvSunsetsSaraOurTokyo')"
                @input="triggerPreview"
              />
            </label>

            <div v-if="suggestedChips.length > 0" class="sv-suggest">
              <div class="sv-suggest-head">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                {{ t('photosSvNimoSuggests') }}
              </div>
              <div class="sv-suggest-row">
                <button
                  v-for="c in suggestedChips" :key="c" type="button" class="sv-suggest-chip"
                  @click="addChip(c)"
                >
                  + {{ c }}
                </button>
              </div>
            </div>

            <div class="sv-field">
              <span class="sv-field-label">{{ t('photosSvConditions') }}</span>
              <div class="sv-chip-bin" :data-empty="draft.chips.length === 0">
                <span v-for="c in draft.chips" :key="c" class="sv-chip-item">
                  {{ c }}
                  <button
                    type="button" class="sv-chip-x" :aria-label="t('photosSvRemoveCondition')"
                    @click="removeChip(c)"
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </span>
                <input
                  v-model="draft.customChip"
                  class="sv-chip-input"
                  data-test="sv-chip-input"
                  :placeholder="draft.chips.length ? t('photosSvAddAnother') : t('photosSvTypeConditionEG')"
                  @keydown.enter.prevent="addCustom"
                  @keydown="onChipKey"
                >
              </div>
              <div v-if="draft.chips.length === 0" class="sv-field-hint sv-hint-spaced">
                {{ t('photosSvPressEnterAddPick', { enter: 'Enter' }) }}
              </div>
            </div>

            <div class="sv-field">
              <span class="sv-field-label">
                {{ t('photosSvQualityThreshold') }}
                <span class="sv-thresh-val">&ge; {{ draft.thresh }}%</span>
              </span>
              <PhotosThreshSlider :value="draft.thresh" @input="onThreshInput" />
              <div v-if="threshMuted" class="sv-field-hint sv-hint-spaced">
                {{ t('photosSvCurrentConditionsMatchExactly') }}
              </div>
            </div>

            <div class="sv-toggles">
              <label class="sv-toggle-row sv-toggle-clickable">
                <div class="label">
                  {{ t('photosSvKeepLive') }}
                  <div class="desc">{{ t('photosSvAutoAddMatchesPhotos') }}</div>
                </div>
                <div
                  class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-live"
                  :aria-checked="draft.live" :aria-label="t('photosSvKeepLive')" :data-on="draft.live"
                  @click.prevent="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
                />
              </label>
              <label class="sv-toggle-row sv-toggle-clickable">
                <div class="label">
                  {{ t('photosSvIncludeVideos') }}
                  <div class="desc">{{ t('photosSvMatchAgainstVideoKeyframes') }}</div>
                </div>
                <div
                  class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-videos"
                  :aria-checked="draft.includeVideos" :aria-label="t('photosSvIncludeVideos')" :data-on="draft.includeVideos"
                  @click.prevent="toggleIncludeVideos" @keydown.enter.prevent="toggleIncludeVideos" @keydown.space.prevent="toggleIncludeVideos"
                />
              </label>
            </div>
          </div>

          <aside class="sv-modal-side">
            <div class="sv-preview-head">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
              {{ t('photosSvLivePreview') }}
            </div>
            <div class="sv-preview-count">
              <b>~{{ store.preview.count.toLocaleString(localeTag) }}</b>
              <span>{{ t('photosSvCandidatesThreshold') }}</span>
            </div>
            <div class="sv-preview-grid">
              <img v-for="s in store.preview.seeds" :key="s" :src="thumbUrl(s)" alt="" loading="lazy">
            </div>
            <div v-if="draft.thresh > 88" class="sv-preview-help">
              {{ t('photosSvStrictOnlyHighestConfidence') }}
            </div>
            <div v-else-if="draft.thresh < 65" class="sv-preview-help">
              {{ t('photosSvLooseExpectSomeFalse') }}
            </div>
            <div v-else class="sv-preview-help">
              {{ t('photosSvBalancedHealthyMixCertainty') }}
            </div>

            <div class="sv-templates">
              <div class="sv-templates-head">{{ t('photosSvStartTemplate') }}</div>
              <button
                v-for="row in templates" :key="row.labelKey" type="button" class="sv-template-row"
                @click="useTemplate(row)"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
                <div>
                  <div class="t-label">{{ t(row.labelKey) }}</div>
                  <div class="t-desc">{{ t(row.descKey) }}</div>
                </div>
              </button>
            </div>
          </aside>
        </div>

        <div class="sv-modal-foot">
          <button type="button" class="sv-btn-ghost" @click="dismiss">
            {{ t('photosCancel') }}
          </button>
          <button
            type="button" class="sv-btn-primary" data-test="sv-confirm-btn"
            :disabled="!canSubmit || store.createBusy" @click="confirm"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
            {{ embedded ? t('photosSvCreateSmartAlbum') : t('photosSvCreateSmartView') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Token mapping (brief spec clause 7 + component's own --text-N four-tier, rationale in
   file header comment 5): --surface-1→--popup-bg / --surface-2→--chip-bg / --surface-3→
   --chip-bg-hi; --line→--card-border; --text-1→--fg / --text-2→--fg-muted / --text-3→
   --fg-faint / --text-4→--fg-subtle; --accent-hi (text/icon color)→--accent-text; scrim
   uses Dialog.vue's --overlay-bg/--overlay-blur; shadows all --card-shadow-hi; Vue2's
   semi-transparent accent border/background (this repo no alpha channel token, Global
   Constraints §33) use three-tier accent-soft family (low→--accent-soft, mid→--accent-soft-2,
   high→--accent-soft-bd). */
.sv-modal-scrim {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  -webkit-backdrop-filter: var(--overlay-blur);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
.sv-modal {
  width: 820px;
  max-width: 100%;
  max-height: calc(100vh - 80px);
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--card-shadow-hi);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* SP15-P2b Task 4 embedded mode (Vue2 photos-smartview.scss's `.sv-modal-embed-host` /
   `.sv-modal.sv-modal-embedded` -- this file names wrapper class `.sv-embed-host`
   instead, cosmetic naming difference registered here, not structural; modifier class on
   .sv-modal itself keeps Vue2's literal name).
   This wrapper removes itself from box model so host panel's flex column hands remaining
   height straight to .sv-modal, instead of this style-less div sized by content then clipped. */
.sv-embed-host { display: contents; }
/* Strip only standalone chrome (fixed width, radius, border, shadow, viewport-relative
   max-height)—host already provides those. Flex column and overflow:hidden stay, because
   .sv-modal-body / .sv-modal-form / .sv-modal-side rely on them for own scrolling; without
   flex:1;min-height:0 short viewport clips submit button out of reach. */
.sv-modal.sv-modal-embedded {
  width: auto;
  max-width: none;
  max-height: none;
  flex: 1 1 auto;
  min-height: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.sv-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--line);
}
/* Deviation entry (file header comment 1): Vue2 scss:690-691 is 32×32, not brief's 28×28—
   source is authoritative. */
.sv-modal-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Only --on-accent use registered as "deliberate icon change" (file header comment 2). */
  background: var(--accent);
  color: var(--on-accent);
  box-shadow: var(--card-shadow-hi);
}
.sv-modal-head-text { flex: 1; min-width: 0; }
.sv-modal-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-1); }
.sv-modal-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
/* Vue2 global .icon-btn (32×32, see photos.scss) doesn't exist in this repo (scoped island),
   define scoped equivalent per this dialog's other 26-28px button scale (same as
   PlaceSpotDialog.vue:257 precedent). */
.icon-btn {
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-4);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--text-1); }

.sv-modal-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sv-modal-form {
  overflow-y: auto;
  padding: 18px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sv-modal-side {
  overflow-y: auto;
  padding: 18px 18px 22px;
  border-left: 1px solid var(--line);
  background: var(--surface-2);
}

.sv-field { display: flex; flex-direction: column; gap: 6px; }
.sv-field-label { display: flex; align-items: baseline; gap: 8px; font-size: 11.5px; font-weight: 500; color: var(--text-2); }
.sv-field-hint { font-size: 10.5px; color: var(--text-4); font-weight: 400; }
/* Vue2 inline style="margin-top:6px" (:103/:116) → named class, property-by-property match,
   not bare literal dropped. */
.sv-hint-spaced { margin-top: 6px; }
.sv-input {
  width: 100%;
  padding: 9px 11px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.sv-input:focus { border-color: var(--accent); background: var(--surface-1); }
.sv-textarea { min-height: 60px; resize: vertical; line-height: 1.45; font-size: 12.5px; }

.sv-suggest {
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-2);
  border-radius: 10px;
  padding: 10px 12px;
}
.sv-suggest-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-hi);
  margin-bottom: 8px;
}
.sv-suggest-row { display: flex; flex-wrap: wrap; gap: 5px; }
.sv-suggest-chip {
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--surface-1);
  border: 1px dashed var(--accent-soft-bd);
  color: var(--text-1);
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.12s;
}
.sv-suggest-chip:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-hi); }

.sv-chip-bin {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 7px 8px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-height: 38px;
  transition: border-color 0.15s;
}
.sv-chip-bin:focus-within { border-color: var(--accent); background: var(--surface-1); }
.sv-chip-bin[data-empty="true"] { padding: 0; background: transparent; border: 0; }
.sv-chip-bin[data-empty="true"] .sv-chip-input {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 9px 11px;
}
.sv-chip-bin[data-empty="true"]:focus-within .sv-chip-input { border-color: var(--accent); background: var(--surface-1); }
.sv-chip-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px 3px 9px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-bd);
  border-radius: 99px;
  color: var(--accent-hi);
  font-size: 11.5px;
  font-weight: 500;
}
.sv-chip-x {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 0;
  background: var(--accent-soft-2);
  color: var(--accent-hi);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
}
.sv-chip-x:hover { background: var(--accent-soft-bd); }
.sv-chip-input {
  flex: 1;
  min-width: 140px;
  background: transparent;
  border: 0;
  color: var(--text-1);
  font: inherit;
  font-size: 12.5px;
  outline: none;
  padding: 4px 6px;
}

.sv-thresh-val { margin-left: auto; color: var(--accent-hi); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 13px; }
/* fix round 1 · I1: .sv-slider/.sv-slider-marks actual styles sunk to PhotosThreshSlider.vue
   (scoped but act on elements it renders, no need to repeat here). */

.sv-toggles { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 2px 12px; }
.sv-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--text-2);
}
.sv-toggle-row:last-child { border-bottom: 0; }
.sv-toggle-row .label { flex: 1; color: var(--text-1); }
.sv-toggle-row .desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.sv-toggle-clickable { cursor: pointer; user-select: none; }
/* fix round 1 · M1 (SmartViewSidePanel.vue task-8 review same batch finding, controller
   approved adding to this file too): Vue2's `.sv-switch` has two rule layers stacking—range
   in this scss didn't cover `photos.scss:2819-2820` low-priority bare `.sv-switch` declaring
   `transition: background 0.15s` and `::after` shadow, not overridden by high-priority
   `photos-smartview.scss:584-600`, still merges in. Adding both to stay consistent with
   SmartViewSidePanel.vue. */
.sv-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--surface-3);
  border-radius: 99px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
/* Fix-6 (owner decision, 2026-08-14): the knob is literal white in EVERY theme and BOTH on/off
   states -- overrides whatever Vue2's own (non-existent) light theme would have done, explicit
   owner requirement. Fix-5's `var(--text-1)` got dark-mode legibility right but was still a
   theme-flipping token, going near-black under `.photos-root.is-light` -- legible, but not
   white, which is what the owner wants. `--text-1` is deliberately no longer used for the knob.
   Literal white, same theme-exception convention as PhotosToastHost.vue's `.photos-toast`
   background / this repo's other theme-invariant surfaces. The light-mode border + shadow below
   is a matched pair with this rule, not an independent choice -- see its own comment. */
.sv-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff; /* theme-exception: owner 2026-08-14 decision -- knob is invariant white in every theme/state */
  transition: all 0.2s;
  /* Shadow is pure black rough shadow, use color-mix to match Vue2 original (pure black, ~30%
     opacity shadow), don't use literal color function, same precedent as SmartViewSidePanel.vue. */
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
/* Owner decision (2026-08-14), paired with the literal-white knob above: a flat white circle has
   no edge against photos light mode's own near-white `--surface-3` off-track, so light mode gets
   a subtle parity-token border plus a lighter drop shadow (dark mode's 30%-black shadow reads as
   depth on a dark track; at that strength on a light one it looks like a smudge, hence the lower
   alpha) -- values chosen to read as a native light-theme toggle. Applies to both on/off states
   (neither modifies border/box-shadow), matching the owner's state-invariant requirement. */
.photos-root.is-light .sv-switch::after {
  border: 1px solid var(--line-strong);
  box-shadow: 0 1px 2px color-mix(in srgb, black 12%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* Straight bug fix, not a deviation from Vue2 -- parity's
   own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
   moves the knob (`left: 16px`); it never overrides `background`, so Vue2's knob is the exact
   same colour in both states. The `--on-accent` override this rule used to carry (justified at
   the time as "legal atop a solid --accent fill", same
   reasoning as `.sv-btn-primary`) was wrong for this element specifically: it made the knob track
   the on/off *state* instead of staying constant like Vue2's -- the owner's screenshot ("Keep it
   live" toggled on) is exactly that dark-navy-on-purple knob. Deleted; the knob now always uses
   the base rule's background above (Fix-6: literal white, see that rule's own comment), in both
   states, matching Vue2's own single-value knob. File header comment 3a above is superseded by
   this note; "legal use b" (`.sv-btn-primary`) is unaffected and still correct. */
.sv-switch[data-on="true"]::after { left: 16px; }

.sv-preview-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent-hi);
  margin-bottom: 8px;
}
.sv-preview-count { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
.sv-preview-count b { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--text-1); }
.sv-preview-count span { font-size: 11.5px; color: var(--text-3); }
.sv-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  margin-bottom: 10px;
  border-radius: 8px;
  overflow: hidden;
}
.sv-preview-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.sv-preview-help {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
  padding: 8px 10px;
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.sv-templates { margin-top: 18px; }
.sv-templates-head {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-3);
  margin-bottom: 8px;
}
.sv-template-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 4px;
  background: var(--surface-1);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.12s;
}
.sv-template-row:hover { border-color: var(--accent); background: var(--accent-soft); }
/* fix round 1 · I2: Vue2 :164 explicitly passes color="var(--accent-hi)" to these 5 template
   rows' sparkles icons (Vue2 PhotosIcon.vue maps color prop to :stroke)—is accent color, not
   inherited from .sv-template-row's own color:var(--text-1) (foreground light/dark). Earlier
   mistakenly used stroke="currentColor" making icon inherit container foreground instead of
   accent; other two sparkles in file (.sv-suggest-head/.sv-preview-head) happened to work
   because those rules' own color is already the accent text tier, only this one has a plain
   foreground container color, so currentColor inherited the wrong value. Vue2 hover
   (scss:955-958) only changes border-color/background, not icon color, so hover should also
   stay accent—pin svg color here explicitly, doesn't follow container hover, naturally covers
   both states. */
.sv-template-row svg { margin-top: 2px; flex-shrink: 0; color: var(--accent-hi); }
.sv-template-row .t-label { font-size: 12px; font-weight: 500; }
.sv-template-row .t-desc { font-size: 10.5px; color: var(--text-3); margin-top: 1px; line-height: 1.35; }

.sv-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
  background: var(--surface-1);
}
.sv-btn-ghost {
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sv-btn-ghost:hover { background: var(--surface-3); }
/* --on-accent legal use case #3 (file header comment 3b): matches existing primary button
   precedent in this repo ClusterActionDialog.vue:320 / MergeReviewDialog.vue:262. */
.sv-btn-primary {
  height: 36px;
  padding: 0 18px;
  border-radius: 9px;
  background: var(--accent);
  border: 0;
  color: var(--on-accent);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--card-shadow-hi);
  transition: transform 0.12s, box-shadow 0.15s, opacity 0.15s;
}
.sv-btn-primary:hover { background: var(--accent); }
.sv-btn-primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
.sv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }

.sv-modal-enter-active, .sv-modal-leave-active { transition: opacity 0.18s ease; }
.sv-modal-enter-active .sv-modal, .sv-modal-leave-active .sv-modal {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease;
}
.sv-modal-enter-from, .sv-modal-leave-to { opacity: 0; }
.sv-modal-enter-from .sv-modal, .sv-modal-leave-to .sv-modal { transform: translateY(8px) scale(0.98); opacity: 0; }

/* Narrow screen (file header comment 4): Vue2 already has @media (max-width: 760px)
   (scss:1018-1022, not brief's "zero @media"), here straight-port two real changes (single
   column + side border flip), breakpoint number aligns with this repo's other similar files
   PhotosSmartViews.vue already at 768 (deviation from Vue2 literal 760 logged). */
@media (max-width: 768px) {
  .sv-modal-body { grid-template-columns: 1fr; }
  .sv-modal-side { border-left: 0; border-top: 1px solid var(--line); }
}

</style>
