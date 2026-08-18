<script setup lang="ts">
// SP7-P7a-T8: SmartViewSidePanel.vue — smart view detail panel right column, three sections
// (threshold / settings / stats), mounted at data-test="sv-side-mount" in PhotosSmartViewDetail.vue
// (T6 placeholder mount point). Ported section by section from Vue2 NimoOS-UI
// src/views/Photos/PhotosSmartViewDetail.vue:152-209 (template), :288-291 + :345-371
// (threshold debounce / paused derivation / syncingSv), :325-333 (threshHelp / dist / distMax),
// :424 + :444 (formatMB / distStyle); styles photos-smartview.scss:528-658 (the slider itself
// at :543-563 already extracted to PhotosThreshSlider.vue by T5, not repeated here).
//
// ── Architectural simplification vs Vue2 (required per brief; fix round 2 correction:
//    prior sections conflicted with `dragging` guard added 40 lines below; corrected in-place
//    per fix-2-findings, not rewritten as alternate formulation) ───────────────────────
// Vue2 uses "local thresh/paused/includeVideos + syncingSv flag + three watchers" to suppress
// the self-feedback loop: "prop change → copy to local state → local watcher emits PATCH again"
// (:288-291, :345-371). New-UI emits('patch', ...) only on user interaction (@input/@click);
// prop reflux never emits, so no self-feedback loop by design — **the Vue2 `syncingSv` flag
// is not needed**, New-UI has no equivalent.
// But "prop reflux needs no guard" is not the right conclusion: between PATCH round-trips,
// while user has uncommitted local edits, the old value brought back by prop must not
// overwrite display, else we get the real bug reproduced in fix round 1 · I1: "drag to 92
// → response lands → display flips back to 92 → right then, clobber the 60 user already
// dragged to". **What we need is the `dragging` guard below**, guarding something different:
// don't yank the display back to server's stale value while user's finger still presses
// (or a round of debounce/busy retry hasn't fired yet). The two toggle switches are simpler
// than thresholds: pure derivation (`computed(() => !sv.live)` / `sv.includeVideos` itself)
// + direct emit on click, no local draft needed — toggles are discrete values, no "finger
// still pressing" intermediate state unlike thresholds, so no debounce/throttle needed and
// no `dragging` guard needed.
//
// ── busy guard (net-new; T7 SmartViewConditionEditor.vue same-pattern constraint, logged) ──
// Vue2 has zero notion of preventing "PATCH not back yet, click again". Host passes in
// store.patchBusy; here during busy we short-circuit toggle clicks and threshold debounce
// final emits to avoid concurrent PATCH races — button exposes visual state via data-busy,
// not silently swallowing clicks.
//
// ── token mapping: correction record (Fix-2 item 4, owner acceptance, 2026-08-13) ────────
// This section used to follow the spec table established in SmartViewCreateDialog.vue:436-438,
// styling the switch/toggle rows here with New-UI's **global** tokens (--surface-1→--popup-bg /
// --surface-2→--chip-bg / --surface-3→--chip-bg-hi; --line→--card-border; --text-1→--fg /
// --text-2→--fg-muted / --text-3→--fg-faint / --text-4→--fg-subtle; --accent-hi→--accent-text).
// That mapping claimed at the time to "match parity", but it was wrong: global tokens do not
// follow the private `.photos-root.is-light` light/dark switch (they only follow the app-level
// `data-theme`), `--chip-bg`/`--chip-bg-hi` are still a glass gradient in the dark tier rather
// than the flat fill parity wants, and `--card-border`'s dark-tier opacity (0.36) is far more
// prominent than parity's `--line` (0.06/0.10). Both paths produced the "the switch / action
// pill doesn't look like Vue2" deviation in this task's owner screenshots — already wrong in
// the dark tier, and degrading into unreadably low-contrast text in the light tier. Corrected:
// the style block below is back on parity's own tokens (--surface-2/3, --text-1/2/3/4, --line,
// --accent-hi). Two spots stay as they were — `--on-accent` (the knob shadow sits on a solid
// accent fill) and `--success` (redefined under `.photos-root` itself, so it naturally shadows
// the global value) — both verified safe in either theme. **Correction on record: the earlier
// claim that "SmartViewSidePanel is already parity" does not hold**; the deviation came from
// this component's own mapping table picking the wrong token family, not from anywhere else.
// This change touched only this comment and the concrete values in the style block below; the
// script logic and props are untouched.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosThreshSlider from './PhotosThreshSlider.vue'
import { formatMB } from '../util/formatBytes'
import { relTime } from '../util/relTime'
import type { SmartView } from '../stores/smartViews'

const props = withDefaults(defineProps<{ sv: SmartView; busy?: boolean }>(), { busy: false })
const emit = defineEmits<{ patch: [patch: { threshold?: number; live?: boolean; includeVideos?: boolean }] }>()

const { t, locale } = useI18n()

// ── 1. Threshold section (structural spec A-1) ────────────────────────────────────
const thresh = ref(props.sv.threshold)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// fix round 1 · I1 (Important, reproduced in review): the `dragging` guard manages
// "don't yank the thumb from under the user's finger" — separate concern from "no need
// for syncingSv", do not mix. syncingSv guards against the self-feedback loop that New-UI
// structurally doesn't have (New-UI emits only on user interaction, prop reflux never emits,
// no self-feedback by design); but prop reflux itself still happens — between PATCH
// round-trips, while user has uncommitted local edits (`dragging` true), the old value
// brought back by prop must never overwrite display, else we get the review-reproduced
// "drag to 92 → response lands → display flips back to 92 → right then, clobber the 60
// user already dragged to". The semantics of `dragging` is "are there uncommitted local
// edits not yet successfully emitted?" — not "is finger pressing the slider?": the entire
// window from onThreshInput to submitThreshold actually emitting (including busy retries)
// counts as dragging=true, so even if the response lands before this debounce expires,
// display won't get clobbered prematurely.
const dragging = ref(false)

// prop reflux: guarded when dragging (core of deletion verification ②: remove this guard
// or the entire watch and both cases fail — "prop reflux doesn't trigger submit" and
// "don't clobber local edits across PATCH round-trips").
watch(() => props.sv.threshold, (v) => {
  if (!dragging.value) thresh.value = v
})

// fix round 1 · I2 (Important, reproduced in review): `submitThreshold` uses the `v`
// **captured by closure** not the live `thresh.value` at call time — even if `dragging`
// guard itself has any gap, the value actually sent to backend is always the number user
// actually dragged to, belt and suspenders. When busy **re-arm the timer** not silent
// return — threshold has local draft, swallowing one emit means "UI 92% / backend 72%"
// permanently out of sync (unlike the two toggles: toggles are pure derivation, swallowing
// click leaves UI consistent with store, no retry needed).
function submitThreshold(v: number): void {
  if (props.busy) {
    // Known boundary (fix round 2 logged, controller approved acceptable, no need to throttle):
    // this retry has no backoff and no retry limit — if `patchBusy` truly stays true long-term,
    // will retry forever at fixed 300ms rhythm. Not a tight loop, won't freeze browser (each
    // retry waits a full setTimeout), but truly no upper bound.
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => submitThreshold(v), 300)
    return
  }
  dragging.value = false
  emit('patch', { threshold: v })
}

function onThreshInput(v: number): void {
  thresh.value = v
  dragging.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  // Reuse Vue2 :359-366 300ms rhythm (core of deletion verification ①: remove this
  // setTimeout wrapper and the "drag 5 times emit only 1" case fails).
  debounceTimer = setTimeout(() => submitThreshold(v), 300)
}
onBeforeUnmount(() => { if (debounceTimer) clearTimeout(debounceTimer) })

const newCount = computed(() => props.sv.addedThisWeek || 0)
// Reuse Vue2 :326.
const threshN = computed(() => Math.round((newCount.value * (100 - thresh.value) / 22) * 1.4))
// Reuse Vue2 :328-329 (core of deletion verification ⑦: remove these two ifs and the 85/70
// boundary cases fail).
const threshTail = computed(() => {
  if (thresh.value > 85) return t('photosSvMayMissBorderlineMatches')
  if (thresh.value < 70) return t('photosSvMayIncludeFalsePositives')
  return ''
})

// ── 2. Settings section (structural spec A-2) ──────────────────────────────────────
// paused and both toggles are pure derivation + direct emit, no local state (brief controller
// addendum 2).
const paused = computed(() => !props.sv.live)
function toggleLive(): void {
  if (props.busy) return
  // paused===true ⇔ currently !live, toggle means negate = paused itself (same as existing
  // togglePaused pattern in PhotosSmartViewDetail.vue).
  emit('patch', { live: paused.value })
}
function toggleIncludeVideos(): void {
  if (props.busy) return
  emit('patch', { includeVideos: !props.sv.includeVideos })
}

// ── 3. Stats section (structural spec A-3) ────────────────────────────────────────────
const median = computed(() => props.sv.median || 0)
const storageText = computed(() => formatMB(props.sv.storageBytes))
// Call relTime ourselves, don't consume host's lastUpdated string (brief: "both places call
// relTime themselves, avoid one extra prop"). The declared Produces contract has no now prop —
// this computed itself is not "a reactive clock that walks with time", like Vue2's same-named
// computed it just "compute once at render time".
const lastUpdated = computed(() => (props.sv.evaluatedAt ? relTime(props.sv.evaluatedAt, Date.now(), t, locale.value) : '—'))

// distribution normalization: T2 store already did strict length===10 validation once, this
// is belt and suspenders, reuse Vue2 :316's criterion as-is, don't tighten (brief explicit
// "reuse as-is") — component layer should not assume input is necessarily normalized by
// store.
const dist = computed(() => (props.sv.distribution && props.sv.distribution.length ? props.sv.distribution : new Array(10).fill(0)))
const distMax = computed(() => Math.max(1, ...dist.value))
function distStyle(d: number, i: number): { height: string; opacity: number } {
  // Reuse Vue2 :444. opacity is a layout quantity not a color, keep the inline calculation.
  return { height: `${(d / distMax.value) * 100}%`, opacity: 0.4 + i * 0.06 }
}
</script>

<template>
  <div class="sv-side-section">
    <h3>{{ t('photosSvQualityThreshold') }}</h3>
    <div class="sv-thresh-row">
      <span>{{ t('photosSvAutoAddWhenScore') }}</span>
      <b data-test="sv-thresh-value">{{ thresh }}%</b>
    </div>
    <PhotosThreshSlider :value="thresh" @input="onThreshInput" />
    <!-- Zero v-html (structural spec A-1): threshHelp uses <i18n-t> named slots, <b> wraps {n},
         {pct} uses plain slot (no bold), trailing two sentences are independent pasted outside
         slots (brief explicitly not in slots). -->
    <div class="sv-thresh-help" data-test="sv-thresh-help">
      <i18n-t keypath="photosSvThreshHelp" tag="span" scope="global">
        <template #pct>{{ thresh }}</template>
        <template #n><b>{{ threshN }}</b></template>
      </i18n-t>{{ threshTail ? ' ' + threshTail : '' }}
    </div>
  </div>

  <div class="sv-side-section">
    <h3>{{ t('photosSvSettingsSection') }}</h3>
    <div class="sv-toggle-row">
      <div class="label">
        {{ t('photosSvAutoAddMatches') }}
        <div class="desc">{{ paused ? t('photosSvPausedUploadsNotAdded') : t('photosSvRunEveryUpload') }}</div>
      </div>
      <div
        class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-live"
        :aria-checked="!paused" :aria-label="t('photosSvAutoAddMatches')" :data-on="!paused" :data-busy="busy"
        @click="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
      />
    </div>
    <div class="sv-toggle-row">
      <div class="label">
        {{ t('photosSvIncludeVideos') }}
        <div class="desc">{{ t('photosSvMatchAgainstVideoKeyframes') }}</div>
      </div>
      <div
        class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-videos"
        :aria-checked="sv.includeVideos" :aria-label="t('photosSvIncludeVideos')" :data-on="sv.includeVideos" :data-busy="busy"
        @click="toggleIncludeVideos" @keydown.enter.prevent="toggleIncludeVideos" @keydown.space.prevent="toggleIncludeVideos"
      />
    </div>
  </div>

  <div class="sv-side-section">
    <h3>{{ t('photosSvStats') }}</h3>
    <div class="sv-stat-grid">
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-count">{{ sv.count.toLocaleString(locale.replace('_', '-')) }}</div>
        <div class="l">{{ t('photosSvTotal') }} <span class="delta">+{{ newCount }}</span></div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-median">{{ median }}%</div>
        <div class="l">{{ t('photosSvMedianMatch') }}</div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-storage">{{ storageText }}</div>
        <div class="l">{{ t('photosStorage') }}</div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-lastupdate">{{ lastUpdated }}</div>
        <div class="l">{{ t('photosSvLastUpdate') }}</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div class="sv-dist-head">{{ t('photosSvMatchScoreDistribution') }}</div>
      <div class="sv-distribution">
        <div v-for="(d, i) in dist" :key="i" class="sv-dist-bar" data-test="sv-dist-bar" :style="distStyle(d, i)" />
      </div>
      <!-- Three scale ticks are pure number literals, not i18n'd (follows existing pattern in
           P6b formatSpotCoords direction letters, logged). -->
      <div class="sv-dist-x"><span>50%</span><span>75%</span><span>100%</span></div>
    </div>
  </div>
</template>

<style scoped>
/* ── Section headers (scss:528-536) ── */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-3); margin: 0 0 10px;
}

/* ── Threshold section (scss:537-542, 565-573; slider itself in PhotosThreshSlider.vue) ── */
.sv-thresh-row { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; }
.sv-thresh-row b { color: var(--accent-hi); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; }
.sv-thresh-help {
  font-size: 11.5px; color: var(--text-3); line-height: 1.5; margin-top: 10px;
  padding: 8px 10px; background: var(--surface-2); border-radius: 8px;
}

/* ── Settings section (scss:574-605, existing port of same Vue2 source rules in
     SmartViewCreateDialog.vue, exact value-by-value consistency) ── */
.sv-toggle-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 0;
  border-bottom: 1px solid var(--line); font-size: 12.5px; color: var(--text-2);
}
.sv-toggle-row:last-child { border-bottom: 0; }
.sv-toggle-row .label { flex: 1; color: var(--text-1); }
.sv-toggle-row .desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
/* fix round 1 · M1 (brief omitted the photos.scss half, same failure pattern as T5 omitting
   slider styles): Vue2 `.sv-switch` actually has two stacked cascading rules — `photos-smartview.scss:
   584-600` (high specificity, wins sizing) plus `photos.scss:2819-2820` bare low-specificity
   `.sv-switch` declaring `transition: background 0.15s` and `::after` shadow, neither overridden
   by high specificity, both merge and apply. Adding these two, track color change becomes smooth
   transition and thumb gets shadow (not instant + flat). */
.sv-switch { position: relative; width: 32px; height: 18px; background: var(--surface-3); border-radius: 99px; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
/* Fix-6 (owner decision, 2026-08-14): the knob is literal white in EVERY theme and BOTH
   on/off states -- overrides whatever Vue2's own (non-existent) light theme would have done,
   explicit owner requirement, not a legibility inference. Fix-5's `var(--text-1)` got dark-mode
   legibility right (≈white there) but was still a *theme-flipping* token, so it went near-black
   under `.photos-root.is-light` -- correctly legible, but not white, which is what the owner
   actually wants here. `--text-1` is deliberately no longer used for the knob. Literal white,
   same theme-exception convention this repo already uses for other theme-invariant surfaces
   (PhotosToastHost.vue's `.photos-toast` background, this file's own sibling
   PhotosSmartViewDetail.vue's `.sv-toast`). The light-mode border + shadow immediately below
   (also an owner decision, same date) is what keeps a flat white knob visible against a
   light-mode white-ish track -- the two rules are a matched pair, not independent choices. */
.sv-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
  background: #fff; /* theme-exception: owner 2026-08-14 decision -- knob is invariant white in every theme/state */
  transition: all 0.2s;
  /* Shadow is pure dark shadow (not semantic color), replicate Vue2 original (pure black,
     ~30% opacity shadow) using color-mix, not literal color functions, following existing
     pattern in PhotosSmartViewDetail.vue `.tile.recent::after` ("black keyword + color-mix"
     expresses semi-transparent black). */
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
/* Owner decision (2026-08-14), paired with the literal-white knob above: a flat white circle
   has no edge against photos light mode's own near-white `--surface-3` off-track (and reads
   flat against the solid `--accent` on-track too), so light mode gets a subtle parity-token
   border plus a lighter drop shadow (dark mode's 30%-black shadow reads as depth on a dark
   track; carried at that same strength here it would look like a dirty smudge on a light one,
   hence the lower alpha) -- values chosen to read as a native light-theme toggle, not a
   dark-theme knob pasted onto a light page. Applies to both on/off states (neither modifies
   border/box-shadow), which is what keeps the knob's presentation state-invariant per the
   owner's requirement. */
.photos-root.is-light .sv-switch::after {
  border: 1px solid var(--line-strong);
  box-shadow: 0 1px 2px color-mix(in srgb, black 12%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* Fix-5 (owner acceptance, 2026-08-14): straight bug fix, not a deviation from Vue2 -- parity's
   own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
   moves the knob (`left: 16px`); it never overrides `background`, so Vue2's knob is the exact
   same colour in both states. The `--on-accent` override this rule used to carry (justified at
   the time as "legal atop a solid --accent fill", same reasoning as `.sv-btn-primary`) was wrong
   for this element specifically: it made the knob track the on/off *state* instead of staying
   constant like Vue2's -- the owner's screenshot is exactly that dark-navy-on-purple knob.
   Deleted; the knob now always uses the base rule's background above (Fix-6: literal white, see
   that rule's own comment), in both states, matching Vue2's own single-value knob. */
.sv-switch[data-on="true"]::after { left: 16px; }
.sv-switch[data-busy="true"] { cursor: not-allowed; opacity: 0.6; }

/* ── Stats section (scss:626-658) ── */
.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--surface-2); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sv-stat-cell .l { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.sv-stat-cell .delta { font-size: 11px; color: var(--success); margin-left: 4px; font-weight: 500; }
.sv-dist-head { font-size: 11.5px; color: var(--text-3); margin-bottom: 4px; }
.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  /* Vue2 scss:648 hardcodes gradient (accent → literal light purple) ⇒ change two levels of
     accent family (following existing pattern in PersonRelationsTab.vue:251), don't write
     literal colors. */
  background: linear-gradient(to top, var(--accent), var(--accent-hi));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-4); margin-top: 4px; }
</style>
