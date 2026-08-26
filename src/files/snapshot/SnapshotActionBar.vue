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
//
// Fix wave A2 (audit-stage.md #14, priority list items 8/9/16): two changes verified against the
// real Vue2 authority (SnapshotActionBar.vue + _filebrowser.scss + _animate.scss):
//
// 1. Enter/leave transition (priority list item 8, "the bar pops in/out instantly"). Vue2 wraps
//    its own root in `<transition name="up-fade">` (own file:16), whose classes live in
//    `_animate.scss` (L105-117): `up-fade-enter-active`/`up-fade-leave-active { transform-origin:
//    top; transition: opacity $speed-slow $easing, transform $speed-slow $easing }` and
//    `up-fade-enter`/`up-fade-leave-to { transform: translateY(50px); opacity: 0 }`. `$speed-slow`
//    is buefy's own `150ms` (node_modules/buefy/src/scss/utils/_variables.scss:1, imported
//    globally alongside bulma's own `$easing: ease-out` default, _variables.scss:80) -- so the
//    real, fully-resolved transition is `opacity 150ms ease-out, transform 150ms ease-out`. Ported
//    below as `tm-up-fade-*` (Vue2's own `up-fade-enter`/`-leave-to` pair, with the `-from` alias
//    Vue3's `<Transition>` requires for the enter-state class Vue2 spelled without one).
// 2. Icon-only buttons (priority list item 9), not text labels -- Vue2's own two `<b-icon>`s
//    (`backup-restore` / `downloads-outline`, own file:20-33) replaced with plain inline SVGs
//    (Feather Icons' own free/MIT `rotate-ccw`/`download` glyphs -- this codebase has no shared
//    action-icon component yet to reuse, so these are hand-inlined the same way every other
//    ad-hoc SVG icon in this app already is, e.g. HomeTopbar.vue/ThemeToggle.vue). Hover tooltips
//    are the existing native `:title` attributes (already present, house style -- Vue2's own
//    `<b-tooltip>` equivalent), unchanged by this fix.
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
  <Transition name="tm-up-fade">
    <div v-if="count > 0" class="tm-action-bar">
      <span class="tm-action-bar-label">{{ t('filesSelectedCount', { count }) }}</span>
      <button
        type="button"
        class="tm-action-bar-btn tm-action-bar-btn--restore"
        :disabled="restoring"
        :aria-label="t('tmRestoreSelection')"
        :title="t('tmRestoreSelection')"
        @click="emit('restore')"
      >
        <!-- Fix wave A3 (audit-modals.md §6, busy/disabled state -- MISSING the spinner glyph
             swap): Vue2's own icon swaps to a spinning `mdi-spin loading` glyph while restoring
             (own file:48-52,82-86) -- previously this button only dimmed via `:disabled{opacity}`,
             with no spin animation at all. Swapped for a plain rotating ring (same idiom as
             SnapshotBanner.vue's own `.snap-banner-spin`, no icon library dependency) rather than
             the resting rotate-ccw icon while `restoring` is true. -->
        <span v-if="restoring" class="tm-action-bar-spin" aria-hidden="true"></span>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 3 3 8 8 8"></polyline>
          <path d="M3 8a9 9 0 1 0 2.64-6.36"></path>
        </svg>
      </button>
      <button
        type="button"
        class="tm-action-bar-btn tm-action-bar-btn--download"
        :aria-label="t('filesCtxDownload')"
        :title="t('filesCtxDownload')"
        @click="emit('download')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>
  </Transition>
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
/* Fix wave A2 (audit-stage.md #14, priority list item 16): Vue2's own literal `margin-right: 0.5rem`
   = 8px (`.snapshot-action-bar__label`'s own `mr-2` bulma utility class -- own file:19), not 4px. */
.tm-action-bar-label { white-space: nowrap; margin-right: 8px; }
.tm-action-bar-btn {
  border: none;
  background: none;
  color: var(--tm-chrome-text);
  /* Fix wave A2 (audit-stage.md #14, priority list item 16): Vue2's own literal `0.25rem 0.5rem` =
     4px 8px (`.toolbar-item`, _filebrowser.scss:242), not 4px 10px. */
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 13px;
  display: grid;
  place-items: center;
  cursor: pointer;
  /* Fix wave A2 (audit-stage.md #14, priority list item 16): Vue2's own literal
     (`.toolbar-item { transition: background 0.3s }`, _filebrowser.scss:245) -- 0.3s plain (no
     easing keyword declared there, so the browser default `ease` applies), not the port's own
     0.15s `var(--ease)` substitution. */
  transition: background 0.3s;
}
.tm-action-bar-btn:hover:not(:disabled) { background: var(--tm-action-bar-item-hover-bg); }
.tm-action-bar-btn:disabled { opacity: 0.6; cursor: default; }
/* Fix wave A3 (audit-modals.md §6, busy/disabled state): the spinning-ring swap itself -- see
   this file's own template comment. Uses `currentColor` (already `--tm-chrome-text`, white) so
   no new token is needed. */
.tm-action-bar-spin {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, currentColor 35%, transparent);
  border-top-color: currentColor;
  animation: tm-action-bar-spin 0.7s linear infinite;
}
@keyframes tm-action-bar-spin { to { transform: rotate(360deg); } }

/* Fix wave A2 (audit-stage.md #14, priority list item 8): Vue2's own `up-fade` transition
   (_animate.scss:105-117), fully resolved to `opacity 150ms ease-out, transform 150ms ease-out`
   with a 50px slide -- see this file's own header comment for the full derivation. Vue3's
   `<Transition>` requires an explicit `-from` suffix for the enter starting-state class; Vue2 spells
   the same class without one (`up-fade-enter`). Both aliased to the identical rule here so the CSS
   itself still reads as "Vue2's own up-fade classes", just with the one naming difference Vue3
   requires. */
.tm-up-fade-enter-active,
.tm-up-fade-leave-active {
  transform-origin: top;
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
.tm-up-fade-enter-from,
.tm-up-fade-leave-to {
  transform: translateY(50px);
  opacity: 0;
}
</style>
