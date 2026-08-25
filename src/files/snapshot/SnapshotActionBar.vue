<script setup lang="ts">
// Final review (Important 4, Ruling F-1): rebuilds Vue2's SnapshotActionBar.vue 1:1 --
// NimoOS-UI/src/components/filebrowser/components/SnapshotActionBar.vue -- deleted in Task 6
// (per Ruling P2, which retired the whole colleague component set) and never rebuilt, leaving
// multi-select inside snapshot view with no count/Download affordance (New-UI's generic
// SelectionToolbar is hidden there, Files.vue's own `v-if="!browse.isSnapshotView"`).
//
// Vue2's own header comment on that file: "the snapshot-view equivalent of OperationToolbar.vue,
// shown at the same position/size/animation ... whenever there is a selection while browsing
// snapshot content. Per the user's final decision (Time Machine-style restricted verb set):
// exactly two verbs, Restore + Download. No Cut/Copy/Delete/Close icon -- deselecting is done the
// same way selecting is (the checkbox/list), and the bar hides itself automatically once the
// selection empties." Ported verbatim: this component owns only the visible control (label/
// buttons/busy state) and its two emits, exactly like TimeMachineStepper.vue's own split --
// Files.vue (the caller) owns WHEN it shows (`isSnapshotView && selection non-empty`) and WHAT the
// two emits actually do (restoreSelectionFlow / ops.download, the same funnels the banner and
// context menu already use).
//
// Floating pill, not a member of the normal document flow (Vue2's own `.toolbar-container { position:
// relative }` + `.operation-toolbar { position: absolute; bottom: 50px; left: 50%; transform:
// translateX(-50%) }`, `_filebrowser.scss`): the containing block is whichever ancestor Files.vue
// gives it (`.files-main`, already `position: relative` in that file's own style block, for plain
// snapshot browsing; `.tm-fwin--active` -- given `position: relative` for exactly this reason, see
// TimeMachineStage.vue's own style-block comment on that rule -- while the Time Machine stage's chrome
// is up). Vue2 renders it inside `<time-machine-stage>`'s own default slot too (FilePanel.vue,
// right before that component's closing tag), alongside `operation-toolbar`/`snapshot-action-bar`
// -- i.e. it is part of the "real window" content and stays mounted (and visible) regardless of
// whether the Time Machine stage's own chrome is up, exactly what this component's own Files.vue
// call site does. No hiding-while-TM-chrome-is-up special case exists in Vue2 to port.
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SnapshotActionBar' })

defineProps<{
  count: number
  /** In-flight restore state (browse.restoring) -- swaps the icon-equivalent to a disabled state
   *  so a click during an ongoing restore is not silently swallowed without feedback, Vue2 parity
   *  (`:class="{ 'snapshot-action-bar__item--busy': restoring }"` + the `restore()` method's own
   *  early-return guard, both ported here as the button's plain `:disabled`). */
  restoring: boolean
}>()

const emit = defineEmits<{ (e: 'restore'): void; (e: 'download'): void }>()

const { t } = useI18n()
</script>

<template>
  <div v-if="count > 0" class="tm-action-bar">
    <span class="tm-action-bar-label">{{ t('filesSelectedCount', { count }) }}</span>
    <button
      type="button"
      class="tm-action-bar-btn tm-action-bar-btn--restore"
      :disabled="restoring"
      :aria-label="t('tmRestoreSelection')"
      :title="t('tmRestoreSelection')"
      @click="emit('restore')"
    >{{ t('tmRestoreSelection') }}</button>
    <button
      type="button"
      class="tm-action-bar-btn tm-action-bar-btn--download"
      :aria-label="t('filesCtxDownload')"
      :title="t('filesCtxDownload')"
      @click="emit('download')"
    >{{ t('filesCtxDownload') }}</button>
  </div>
</template>

<style scoped>
/* Vue2 parity byte-for-byte (`.operation-toolbar`, `_filebrowser.scss`): floats centered, 50px
   above whichever ancestor gives it a positioning context (see this file's own header comment for
   which one that is in each of the two states this bar can appear in). */
.tm-action-bar {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  background: var(--tm-action-bar-bg);
  color: var(--tm-chrome-text);
  font-size: 13px;
}
.tm-action-bar-label { white-space: nowrap; margin-right: 4px; }
.tm-action-bar-btn {
  border: none;
  background: none;
  color: var(--tm-chrome-text);
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s var(--ease);
}
.tm-action-bar-btn:hover:not(:disabled) { background: var(--tm-action-bar-item-hover-bg); }
.tm-action-bar-btn:disabled { opacity: 0.6; cursor: default; }
</style>
