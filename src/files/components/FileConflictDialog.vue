<!--
  Generic same-name-conflict dialog: shows ONE conflicting item at a time and
  lets the user pick Overwrite / Keep both / Skip (plus Merge for a
  folder-into-folder collision), with an "apply to all remaining items"
  checkbox for batches. Deliberately carries no upload-specific language — it
  only knows a name / isDir / targetPath / queue position to display and an
  action to emit. Ported from Vue2 FileConflictDialog.vue.

  Queue usage: the CALLER walks the queue (fileConflict.ts's
  resolveConflictQueue), opening this dialog fresh for each conflict. This
  component holds no queue state beyond the checkbox for the current decision.

  Directory conflicts: the backend cannot overwrite a directory, so Overwrite
  is disabled rather than hidden — a disabled control with an inline
  explanation reads clearer than a button that silently vanishes.

  Cancel (Esc / outside click / the header's own close button) means "stop
  asking about the rest of this batch"; the caller marks this and every
  remaining conflict as cancelled.

  Rebuilt directly on reka-ui's Dialog primitives instead of the shared
  components/ui/Dialog.vue wrapper — same reason SnapshotSettingsModal.vue
  forked off it: the generic wrapper's `.ui-dialog-content` carries its own
  fixed min-width/padding and
  dark-glass background, and scoped CSS on THIS component cannot reach up to
  override an ancestor rendered by a different component. Vue2's own dialog is
  white-glass (same `--tm-panel-*` token family as SnapshotSettingsModal and
  the still-to-come RestoreDestinationModal), which the shared wrapper's dark
  `--popup-bg` can't express either.

  z-index tier: this dialog can open ON TOP of another already-open Time
  Machine surface — SnapshotSettingsModal today, and RestoreDestinationModal's
  own "Restore here" click will do the same (Vue2's
  RestoreDestinationModal opens FileConflictDialog directly from its own
  button, per that file's header comment). Every other white-glass surface in
  this app renders through the shared 1000/1001 tier (components/ui/Dialog.vue
  and SnapshotSettingsModal.vue both use it verbatim), so relying on DOM/mount
  order to stack this ONE dialog above them would be fragile. Instead this
  dialog claims a dedicated, explicitly higher tier — 1050/1051 — mirroring
  Vue2's own literal `z-index: 4550` for `.file-conflict-dialog-overlay`
  against `RestoreDestinationModal`'s `4500` (see that file's own comment):
  same +50 relative gap, scaled to this app's z-index scheme, so this dialog
  stacks on top deterministically regardless of which modal happened to open
  first.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import type { ConflictChoice } from '../upload/fileConflict'

const props = withDefaults(
  defineProps<{
    open: boolean
    name: string
    targetPath: string
    isDir?: boolean
    /** Shows Merge — only meaningful together with isDir. Defaults to false so
     *  a plain file conflict never offers it. */
    allowMerge?: boolean
    /** 0-based position in the caller's queue; drives the "Item N of M" line
     *  and gates the apply-to-all checkbox (meaningless for one conflict). */
    queueIndex?: number
    queueTotal?: number
  }>(),
  { isDir: false, allowMerge: false, queueIndex: 0, queueTotal: 1 },
)

const emit = defineEmits<{ (e: 'choose', v: ConflictChoice): void; (e: 'cancel'): void }>()
const { t } = useI18n()

// Scoped to THIS dialog invocation only — reset on every (re)open so a stale
// tick from a previous conflict never leaks into the next decision.
const applyToAll = ref(false)
watch(() => props.open, (v) => { if (v) applyToAll.value = false })

function choose(action: ConflictChoice['action']) {
  // Defensive only — the Overwrite button is already disabled for a directory
  // conflict and Merge only renders when it is allowed. These guard a stray
  // programmatic call.
  if (action === 'overwrite' && props.isDir) return
  if (action === 'merge' && !(props.allowMerge && props.isDir)) return
  emit('choose', { action, applyToAll: applyToAll.value })
}

function onOpenChange(v: boolean) {
  if (!v) emit('cancel')
}

defineExpose({ choose })
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fc-overlay" />
      <DialogContent class="fc-content" :aria-describedby="undefined">
        <header class="fc-head">
          <DialogTitle class="fc-title">{{ t('filesConflictTitle') }}</DialogTitle>
          <button type="button" class="fc-close-x" :aria-label="t('filesViewerClose')" @click="onOpenChange(false)">×</button>
        </header>

        <section class="fc-body">
          <div v-if="queueTotal > 1" class="fc-queue-pos">
            {{ t('filesConflictQueuePos', { index: queueIndex + 1, total: queueTotal }) }}
          </div>

          <div class="fc-item">
            <span class="fc-item-icon" aria-hidden="true">{{ isDir ? '📁' : '📄' }}</span>
            <div class="fc-item-text">
              <div class="fc-item-name" :title="name">{{ name }}</div>
              <div class="fc-item-path" :title="targetPath">{{ targetPath }}</div>
            </div>
          </div>

          <p class="fc-hint">{{ t('filesConflictHint') }}</p>

          <div v-if="isDir" class="fc-dir-note">
            {{ allowMerge ? t('filesConflictDirNoteMerge') : t('filesConflictDirNote') }}
          </div>

          <!-- Apply-all checkbox: custom-skinned box matching Buefy's own `b-checkbox` geometry
               (`_checkbox.scss`: 1.25em box @ 12px font ≈ 15px, 2px border, $radius(3px) radius,
               $primary fill+checkmark when checked) instead of an unstyled native control. -->
          <label v-if="queueTotal > 1" class="fc-apply-all">
            <span class="fc-checkbox">
              <input v-model="applyToAll" type="checkbox" class="fc-checkbox-input" />
              <span class="fc-checkbox-box" aria-hidden="true"></span>
            </span>
            <span>{{ t('filesConflictApplyAll') }}</span>
          </label>
        </section>

        <footer class="fc-foot">
          <button v-if="allowMerge && isDir" class="fc-btn fc-primary" @click="choose('merge')">
            {{ t('filesConflictMerge') }}
          </button>
          <button class="fc-btn fc-ghost" @click="choose('skip')">{{ t('filesConflictSkip') }}</button>
          <button class="fc-btn" :class="(allowMerge && isDir) ? 'fc-ghost' : 'fc-primary'" @click="choose('keep_both')">
            {{ t('filesConflictKeepBoth') }}
          </button>
          <!-- Overwrite-disabled tooltip: reverted to Vue2's own native `title` attribute
               mechanism (own file:96-97) -- the instant custom CSS tooltip bubble this used to be
               was a deliberate improvement over the ported behavior, but pixel/behavior parity
               with Vue2 wins here, which uses the browser's default `title` tooltip (no custom
               bubble, ~1s hover delay). -->
          <button class="fc-btn fc-danger" :disabled="isDir" :title="isDir ? t('filesConflictOverwriteDisabled') : undefined" @click="choose('overwrite')">
            {{ t('filesConflictOverwrite') }}
          </button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Elevated tier — see file header comment for why this dialog does not share
   the app's normal 1000/1001 dialog tier. Flat unblurred Buefy scrim (same
   fix as the other two TM dialogs, still at this dialog's own elevated 1050
   z-index) -- see theme.css's own comment on `--tm-modal-overlay-bg`. */
.fc-overlay { position: fixed; inset: 0; background: var(--tm-modal-overlay-bg); z-index: 1050; }
.fc-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1051;
  width: 420px; max-width: 92vw; height: auto; max-height: 70vh;
  border-radius: 16px;
  background: var(--tm-panel-bg);
  backdrop-filter: var(--tm-panel-blur);
  -webkit-backdrop-filter: var(--tm-panel-blur);
  border: 1px solid var(--tm-panel-border);
  box-shadow: var(--tm-panel-shadow);
  color: var(--tm-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .fc-content { background: var(--tm-panel-bg-solid); }
}

.fc-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 20px 24px 12px; border-bottom: 1px solid var(--tm-hairline); flex-shrink: 0;
}
/* See SnapshotSettingsModal.vue's own `.ssm-title` comment for the full
   line-height/font-family citation. */
.fc-title { margin: 0; font-size: 16px; font-weight: 600; line-height: 24px; color: var(--tm-text); }
.fc-close-x {
  flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; padding: 0; color: var(--tm-text-dim); cursor: pointer;
  border-radius: var(--tm-control-radius); font-size: 18px; line-height: 1;
}
.fc-close-x:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); }

.fc-body { padding: 16px 24px 20px; flex: 1 1 auto; min-height: 0; overflow-y: auto; color: var(--tm-text); }
.fc-queue-pos { font-size: 11px; font-weight: 500; color: var(--tm-text-dim); margin-bottom: 10px; }
.fc-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px;
  border: 1px solid var(--tm-ghost-border); border-radius: 10px;
}
.fc-item-icon { flex-shrink: 0; font-size: 20px; line-height: 1.2; }
.fc-item-text { min-width: 0; flex: 1 1 auto; }
.fc-item-name {
  font-size: 13px; font-weight: 600; color: var(--tm-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-item-path {
  font-size: 11px; color: var(--tm-text-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-hint { margin: 12px 0 0; font-size: 12px; color: var(--tm-text-dim); }
/* Plain warm-amber text, no chip — pixel-matches Vue2's own dir-note rule
   (margin-top 8px, font-size 11px, --tm-warn-text's exact amber): no
   background/border there, unlike the old dark-theme chip styling this
   replaces. */
.fc-dir-note { margin-top: 8px; font-size: 11px; color: var(--tm-warn-text); }
.fc-apply-all {
  display: flex; align-items: center; gap: 6px; margin-top: 14px;
  font-size: 12px; color: var(--tm-text-dim); cursor: pointer;
}
/* Apply-all checkbox: Buefy's own `b-checkbox` box geometry --
   `$checkbox-size: 1.25em` (at is-small's 12px font ≈ 15px), `$checkbox-border-width: 2px`,
   `$checkbox-border-radius: $radius`(3px) -- with a border-trick checkmark (avoids inlining an
   SVG data-URI with a hardcoded fill color, keeping every color here token-driven). */
.fc-checkbox { position: relative; display: inline-flex; width: 15px; height: 15px; flex-shrink: 0; font-size: 12px; }
.fc-checkbox-input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.fc-checkbox-box {
  position: absolute; inset: 0; border-radius: 3px; border: 2px solid var(--tm-ghost-border-hover);
  background: transparent; transition: background 0.15s var(--ease, ease), border-color 0.15s var(--ease, ease);
}
.fc-checkbox-input:hover:not(:disabled) + .fc-checkbox-box { border-color: var(--tm-primary); }
.fc-checkbox-input:checked + .fc-checkbox-box { background: var(--tm-primary); border-color: var(--tm-primary); }
.fc-checkbox-input:checked + .fc-checkbox-box::after {
  content: ''; position: absolute; left: 3px; top: -1px; width: 4px; height: 8px;
  border: solid var(--tm-chrome-text); border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.fc-checkbox-input:focus-visible + .fc-checkbox-box { box-shadow: 0 0 0 3px color-mix(in srgb, var(--tm-primary) 30%, transparent); }

.fc-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 24px 18px; border-top: 1px solid var(--tm-hairline); flex-shrink: 0;
}

/* Merge/Skip/Keep-both/Overwrite buttons: Vue2's own `<b-button>`s
   here have no `size` prop -> Bulma default/medium: `font-size: 16px; height ≈ 40px` -- same fix
   as the other two TM dialogs' footer buttons (see SnapshotSettingsModal.vue's own `.ssm-close`
   comment for the full citation). */
.fc-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 16px; height: 40px; border-radius: var(--tm-control-radius); font-size: 16px; cursor: pointer; border: none;
}
.fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Primary button color: Vue2's `is-primary` fill is `$primary`,
   not `--tm-accent` -- see theme.css's own token-split comment. */
.fc-primary { background: var(--tm-primary); color: var(--tm-chrome-text); }
.fc-primary:hover:not(:disabled) { background: var(--tm-primary-hover); }

.fc-ghost { background: transparent; border: 1px solid var(--tm-ghost-border); color: var(--tm-text-dim); }
.fc-ghost:hover:not(:disabled) { background: var(--tm-ghost-hover-bg); color: var(--tm-text); border-color: var(--tm-ghost-border-hover); }

/* Overwrite — "ghost red": transparent/red-bordered at rest, only fills on
   hover; same idiom as SnapshotSettingsModal.vue's own history Delete
   button (identical color-mix() alpha steps: 40% border / 8% hover fill /
   60% hover border, pixel-matching Vue2's own danger-button alpha trio). */
.fc-danger {
  background: transparent; border: 1px solid color-mix(in srgb, var(--tm-danger) 40%, transparent); color: var(--tm-danger);
}
.fc-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tm-danger) 8%, transparent);
  border-color: color-mix(in srgb, var(--tm-danger) 60%, transparent);
  color: var(--tm-danger-hover);
}

</style>
