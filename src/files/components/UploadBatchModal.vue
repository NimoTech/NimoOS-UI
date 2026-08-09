<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { UploadBatch, UploadBatchItem } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { renderSize } from '../util/format'

const props = defineProps<{ batchId: string }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'abandoned'): void
  (e: 'refill', payload: { targetPath: string; missing: string[] }): void
}>()
const { t } = useI18n()

const loading = ref(true)
const batch = ref<UploadBatch | null>(null)
const missing = ref<UploadBatchItem[]>([])
const abandoning = ref(false)
const errorText = ref('')

onMounted(async () => {
  try {
    const d = await service.uploadBatches.getBatch(props.batchId)
    batch.value = d.batch
    missing.value = d.missing
  } catch {
    batch.value = null
  } finally {
    loading.value = false
  }
})

function refill(): void {
  emit('refill', {
    targetPath: batch.value?.target_path || '',
    missing: missing.value.map((m) => m.relative_path),
  })
  emit('close')
}

async function abandon(): Promise<void> {
  if (abandoning.value) return
  abandoning.value = true
  errorText.value = ''
  try {
    await service.uploadBatches.abandonBatch(props.batchId)
    emit('abandoned')
    emit('close')
  } catch (e) {
    // A 404 means the batch is already gone server-side (expired and swept, or a stale
    // badge race). The user's goal in clicking this button was to make the badge
    // disappear, so we treat this as success and refresh the listing instead of
    // reporting a server error, which would strand the user in a dialog with nothing
    // left to do.
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      emit('abandoned')
      emit('close')
    } else {
      // Errors inside the dialog must be shown inline, not as a toast: this failure is
      // the answer to the button the user just pressed inside this dialog, so it needs
      // to stay pinned next to that button and stay on screen while they decide what to
      // do next. A toast auto-dismisses and renders away from the control that caused
      // it, so it would not stick around long enough, or in the right place, to answer
      // "why didn't abandoning work?".
      errorText.value = t('filesBatchAbandonFailed')
    }
  } finally {
    abandoning.value = false
  }
}
</script>

<template>
  <Dialog :open="true" :title="t('filesBatchTitle')" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <div v-if="loading" class="ubm-loading">…</div>
    <template v-else-if="batch">
      <p class="ubm-progress">{{ t('filesBatchProgress', { done: batch.done, total: batch.total }) }}</p>
      <p class="ubm-missing-title">{{ t('filesBatchMissing') }}</p>
      <ul class="ubm-missing-list">
        <li v-for="m in missing" :key="m.relative_path" class="ubm-missing-item">
          <span class="ubm-path" :title="m.relative_path">{{ m.relative_path }}</span>
          <span class="ubm-size">{{ renderSize(m.size) }}</span>
        </li>
      </ul>
    </template>
    <p v-else class="ubm-load-error">{{ t('filesBatchLoadFailed') }}</p>
    <p v-if="errorText" class="ubm-error">{{ errorText }}</p>

    <template #footer>
      <button class="ubm-btn ubm-refill" :disabled="!missing.length" @click="refill">
        {{ t('filesBatchRefill') }}
      </button>
      <button class="ubm-btn ubm-danger ubm-abandon" :disabled="abandoning" @click="abandon">
        {{ t('filesBatchAbandon') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.ubm-progress { margin-bottom: 12px; color: var(--fg); }
.ubm-missing-title { font-weight: 600; margin-bottom: 6px; color: var(--fg); }
.ubm-missing-list { max-height: 240px; overflow-y: auto; }
.ubm-missing-item { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
.ubm-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.ubm-size { flex: 0 0 auto; color: var(--fg-muted); }
.ubm-load-error { color: var(--fg-muted); }
.ubm-error { margin-top: 10px; color: var(--remove-fg); }

/* No global .ui-btn in this repo (verified: zero hits across src/styles/*.css) — button
   styles are always defined per-component, following SelectionToolbar.vue's .sel-btn. */
.ubm-btn {
  padding: 4px 12px; border-radius: 999px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--chip-border); background: transparent; color: var(--fg);
}
.ubm-btn:hover { background: var(--chip-bg-hi); }
.ubm-btn:disabled { opacity: 0.5; cursor: default; }
/* The variant must carry its own :hover background — the base .ubm-btn:hover selector
   has specificity (0,2,0), which beats the variant .ubm-danger at (0,1,0). Without this
   rule the button would hover to white-on-white (this repo has been bitten by exactly
   this before). */
.ubm-danger { color: var(--remove-fg); border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent); }
.ubm-danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
</style>
