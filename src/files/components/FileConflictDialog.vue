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

  Cancel (Esc / outside click) means "stop asking about the rest of this
  batch"; the caller marks this and every remaining conflict as cancelled.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
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
  <Dialog :open="open" :title="t('filesConflictTitle')" @update:open="onOpenChange">
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

    <label v-if="queueTotal > 1" class="fc-apply-all">
      <input v-model="applyToAll" type="checkbox" />
      <span>{{ t('filesConflictApplyAll') }}</span>
    </label>

    <template #footer>
      <button v-if="allowMerge && isDir" class="fc-btn fc-primary" @click="choose('merge')">
        {{ t('filesConflictMerge') }}
      </button>
      <button class="fc-btn" @click="choose('skip')">{{ t('filesConflictSkip') }}</button>
      <button class="fc-btn" :class="{ 'fc-primary': !(allowMerge && isDir) }" @click="choose('keep_both')">
        {{ t('filesConflictKeepBoth') }}
      </button>
      <button
        class="fc-btn fc-danger"
        :disabled="isDir"
        :title="isDir ? t('filesConflictOverwriteDisabled') : ''"
        @click="choose('overwrite')"
      >
        {{ t('filesConflictOverwrite') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.fc-queue-pos { font-size: 11px; font-weight: 500; color: var(--fg-muted); margin-bottom: 10px; }
.fc-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px;
  border: 1px solid var(--chip-border); border-radius: 10px;
}
.fc-item-icon { flex-shrink: 0; font-size: 20px; line-height: 1.2; }
.fc-item-text { min-width: 0; flex: 1 1 auto; }
.fc-item-name {
  font-size: 13px; font-weight: 600; color: var(--fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-item-path {
  font-size: 11px; color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fc-hint { margin: 12px 0 0; font-size: 12px; color: var(--fg-muted); }
.fc-dir-note {
  margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-size: 11px;
  color: var(--warn-fg); background: var(--warn-bg); border: 1px solid var(--warn-border);
}
.fc-apply-all {
  display: flex; align-items: center; gap: 6px; margin-top: 14px;
  font-size: 12px; color: var(--fg-muted); cursor: pointer;
}

.fc-btn {
  padding: 7px 16px; border-radius: 999px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.fc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.fc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Every variant redeclares its own :hover background. A bare .fc-btn:hover is
   (0,2,0) and would otherwise beat a variant class at (0,1,0), washing the
   variant colour out on hover. */
.fc-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.fc-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }

.fc-danger { background: transparent; border-color: var(--danger-border); color: var(--danger-fg); }
.fc-danger:hover:not(:disabled) { background: var(--danger-bg); border-color: var(--danger-fg); }
</style>
