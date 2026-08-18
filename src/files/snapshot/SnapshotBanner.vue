<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSnapshotBannerTime, type SnapshotBrowseInfo } from '../util/snapshotPath'

const props = defineProps<{
  info: SnapshotBrowseInfo | null
  /** Restoring in progress: disable button to prevent duplicate submission */
  restoring: boolean
  /** Whether there are currently selected items that can be restored */
  canRestore: boolean
  /** Bonus item (part of Critical 1 fix): the `<mount-point>/.snapshots` container directory itself — has no specific
   *  snapshot name; parseSnapshotBrowsePath returns null for it, so info is always null and no time can be shown.
   *  But the read-only lock is already in effect, so we should not show users a silent read-only banner — provide a
   *  timeless guidance text without restore/exit buttons (neither has a clear target: without a selected snapshot there is no
   *  snapshot to restore to, nor is there a relative path for exit to return to). */
  isContainer?: boolean
  // Fix-wave I4: SnapshotSelectionToolbar's restore button already shows this;
  // this banner's own restore button fires the exact same `browse.restore(...)`
  // call and is the ONLY restore entry point when the selection isn't a
  // multi-select (canRestore only turns true here for a batch, per Files.vue's
  // `:can-restore="snapshotSelection.length > 0"`). Without this, a 40-item
  // batch showed live progress on one button while this one merely went gray
  // right next to it.
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
      <span class="snap-banner-text">{{ t('snapBrowseBanner', { time: bannerTime }) }}</span>
      <button
        class="snap-banner-btn snap-banner-restore"
        :class="{ 'is-busy': props.restoring }"
        :disabled="restoreDisabled"
        @click="onRestore"
      >{{ props.restoreProgress
        ? t('snapBrowseRestoringProgress', { done: props.restoreProgress.done, total: props.restoreProgress.total })
        : t('snapBrowseRestore') }}</button>
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
/* Reuse the existing "noteworthy but not an error" semantic token (--dem-*), same color as the
   preop badge in the storage snapshot timeline — don't create a new yellow. */
.snap-banner {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 12px; margin-bottom: 10px;
  border: 1px solid var(--dem-bd); border-radius: 12px;
  background: var(--dem-bg); color: var(--dem-fg); font-size: 13px;
}
.snap-banner-row { display: flex; align-items: center; gap: 8px; }
.snap-banner-text { flex: 1 1 auto; min-width: 0; }
.snap-banner-btn {
  flex: 0 0 auto; padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--dem-bd); background: transparent; color: var(--dem-fg);
  cursor: pointer; font-size: 12px;
}
.snap-banner-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dem-fg) 14%, transparent); }
.snap-banner-btn:disabled { opacity: 0.5; cursor: default; }
.snap-banner-hint { font-size: 12px; opacity: 0.8; }
@media (max-width: 768px) {
  .snap-banner-row { flex-wrap: wrap; row-gap: 6px; }
  .snap-banner-text { flex: 1 1 100%; }
}
</style>
