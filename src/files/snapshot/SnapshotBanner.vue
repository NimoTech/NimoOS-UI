<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSnapshotBannerTime, type SnapshotBrowseInfo } from '../util/snapshotPath'

const props = defineProps<{
  info: SnapshotBrowseInfo | null
  /** Restoring in progress: disable button to prevent duplicate submission */
  restoring: boolean
  /** Task 14 (Vue2 parity): Files.vue always passes `true` here now — Vue2's own restore button is
   *  never gated on whether anything is selected (a click with no selection opens the whole-folder
   *  confirm dialog, or toasts `tmSelectFirst` at the snapshot root; see Files.vue's own
   *  `restoreSelectionFlow`), only on `restoring`. Kept as a prop rather than deleted outright so a
   *  future caller could still narrow it if a real reason shows up. */
  canRestore: boolean
  /** Bonus item (part of Critical 1 fix): the `<mount-point>/.snapshots` container directory itself — has no specific
   *  snapshot name; parseSnapshotBrowsePath returns null for it, so info is always null and no time can be shown.
   *  But the read-only lock is already in effect, so we should not show users a silent read-only banner — provide a
   *  timeless guidance text without restore/exit buttons (neither has a clear target: without a selected snapshot there is no
   *  snapshot to restore to, nor is there a relative path for exit to return to). */
  isContainer?: boolean
  // Fix-wave I4: this banner's own restore button is one of the three Task 14 restore entry
  // points that all funnel into Files.vue's `restoreSelectionFlow` (-> `browse.restoreItems`).
  // Without this, a 40-item batch showed live progress on one button while this one merely went
  // gray right next to it.
  restoreProgress?: { done: number; total: number } | null
}>()
const emit = defineEmits<{ (e: 'exit'): void; (e: 'restore'): void }>()
const { t } = useI18n()

const bannerTime = computed(() => (props.info ? formatSnapshotBannerTime(props.info.snapshotName) : ''))
const restoreDisabled = computed(() => props.restoring || !props.canRestore)

function onRestore() {
  if (restoreDisabled.value) return
  emit('restore')
}
</script>

<template>
  <div v-if="props.info" class="snap-banner">
    <div class="snap-banner-row">
      <!-- Fix wave A3 (audit-modals.md #5, leading icon -- MISSING): Vue2's own
           `<b-icon icon="camera-outline">` (own file:11) -- a UI glyph, not a file icon, so
           in-scope per the owner's icon exception. Emoji rendered directly (not a monochrome
           Unicode glyph): same precedent as this modal family's own `⚠️` paused-row icon
           (SnapshotSettingsModal.vue), which is likewise not currentColor-tinted. -->
      <span class="snap-banner-icon" aria-hidden="true">📷</span>
      <span class="snap-banner-text">{{ t('snapBrowseBanner', { time: bannerTime }) }}</span>
      <button
        class="snap-banner-btn snap-banner-restore"
        :class="{ 'is-busy': props.restoring }"
        :disabled="restoreDisabled"
        @click="onRestore"
      >
        <!-- Fix wave A3 (audit-modals.md #5, restore button loading state -- MISSING): Vue2's own
             Buefy `:loading` prop shows a spinner (own file:18) -- prepended here, not replacing
             the label, since the progress-count text (`restoreProgress`) is a deliberate
             New-UI-only enhancement (fix-wave I4, this component's own prop comment) that must
             stay visible during a batch restore -- Vue2 has no such counter to port, so nothing
             about keeping it regresses Vue2 parity. -->
        <span v-if="props.restoring" class="snap-banner-spin" aria-hidden="true"></span>
        {{ props.restoreProgress
          ? t('snapBrowseRestoringProgress', { done: props.restoreProgress.done, total: props.restoreProgress.total })
          : t('snapBrowseRestore') }}
      </button>
      <button class="snap-banner-btn snap-banner-exit" @click="emit('exit')">{{ t('snapBrowseExit') }}</button>
    </div>
    <!-- Persistent hint, not a one-time toast. From Vue2 M2-F2 we learned: a fleeting prompt is not seen.
         Without clarity that you must "select, then click restore", users think they can edit right upon entering. -->
    <div class="snap-banner-hint">{{ t('snapBrowseHint') }}</div>
  </div>
  <!-- `.snapshots` container directory itself: has no specific snapshot name, no time to display, and no clear
       target for restore/exit — only provide timeless guidance text without buttons. -->
  <div v-else-if="props.isContainer" class="snap-banner">
    <div class="snap-banner-row">
      <span class="snap-banner-text">{{ t('snapBrowseContainerHint') }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Fix wave A3 (audit-modals.md §5): Vue2's own SnapshotBanner.vue is a single hardcoded flat
   pale-yellow strip (own file:60-69, `padding:6px 12px; border-radius:6px; background: hex
   FEF9C3; color: hex 92400E; font-size:12px`, no border) that never changes look -- switched from the
   app-wide `--dem-*` semantic (which flips per theme, translucent-gold-on-dark-glass by default)
   to the dedicated `--tm-banner-bg`/`--tm-banner-fg` tokens (same value in both themes, per every
   other `--tm-*` token's rule) -- see theme.css's own comment on those two for the full citation.
   The border this component used to add is dropped entirely (Vue2 has none). */
.snap-banner {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 12px; margin-bottom: 10px;
  border-radius: 6px;
  background: var(--tm-banner-bg); color: var(--tm-banner-fg); font-size: 12px;
}
.snap-banner-row { display: flex; align-items: center; gap: 8px; }
.snap-banner-icon { flex: 0 0 auto; font-size: 14px; line-height: 1; }
.snap-banner-text { flex: 1 1 auto; min-width: 0; }
/* Fix wave A3 (audit-modals.md §5, Restore/Exit buttons — shape): Vue2's own `<b-button
   size="is-small">` here has no `rounded` prop, so it renders Bulma's DEFAULT rectangular shape
   -- `border-radius: $radius-small`(2px, own file:18-20) -- not a pill. Hover is Bulma's own
   default (`border-color`/`color` tint only, no fill change), replacing the previous
   translucent-fill hover. */
/* Fix wave A3: buttons switched off `--dem-*` to `--tm-banner-fg` alongside the container above,
   for the same "same in both themes" reason -- Vue2's own default-Buefy button border/text isn't
   literally amber, but coherence with this banner's now-fixed amber palette (an existing,
   pre-fix-wave design decision this component's own now-superseded comment already made) beats
   reintroducing a theme-flipping color next to a token that no longer flips. */
.snap-banner-btn {
  flex: 0 0 auto; padding: 5px 12px; border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--tm-banner-fg) 40%, transparent); background: transparent; color: var(--tm-banner-fg);
  cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.snap-banner-btn:hover:not(:disabled) { border-color: var(--tm-banner-fg); }
.snap-banner-btn:disabled { opacity: 0.5; cursor: default; }
/* Fix wave A3 (audit-modals.md §5, restore button loading state -- MISSING): a small spinning
   ring, Vue2's own Buefy `:loading` spinner glyph translated to this app's plain-CSS idiom (no
   icon library here) -- see this file's own template comment for why it's prepended rather than
   replacing the label. */
.snap-banner-spin {
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--tm-banner-fg) 35%, transparent);
  border-top-color: var(--tm-banner-fg);
  animation: snap-banner-spin 0.7s linear infinite;
}
@keyframes snap-banner-spin { to { transform: rotate(360deg); } }
/* Fix wave A3 (audit-modals.md §5, hint text): Vue2's own literal `opacity:.85; font-size:11px`
   (own file:27,81-84), not 12px/.8. */
.snap-banner-hint { font-size: 11px; opacity: 0.85; }
@media (max-width: 768px) {
  .snap-banner-row { flex-wrap: wrap; row-gap: 6px; }
  .snap-banner-text { flex: 1 1 100%; }
}
</style>
