<!-- src/files/components/UploadPanel.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUploadsStore } from '../stores/uploads'
import { useFilesStore } from '../stores/files'
import { shouldAutoOpenUploadList } from '../upload/uploadListVisibility'
import { groupByBatch, type BatchView, type BatchLabel } from '../upload/uploadBatches'
import { toVirtualPath } from '../util/pathUtils'
import { renderSize } from '../util/format'
import { uploadErrorKey } from '../upload/statusText'
import type { UploadItem } from '../upload/types'
import Dialog from '../../components/ui/Dialog.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'

const store = useUploadsStore()
const files = useFilesStore()
const { t } = useI18n()

const open = ref(shouldAutoOpenUploadList(0, store.queue.length))

watch(
  () => store.queue.length,
  (curLen, prevLen) => {
    if (shouldAutoOpenUploadList(prevLen ?? 0, curLen)) open.value = true
  },
)

// One aggregate row per batch (a folder / multi-select collapses to one;
// a single file stays one). Split into the three display zones.
const batches = computed(() => groupByBatch(store.queue))
const problemBatches = computed(() => batches.value.filter((b) => b.zone === 'problem'))
const activeBatches = computed(() => batches.value.filter((b) => b.zone === 'active'))
const doneBatches = computed(() => batches.value.filter((b) => b.zone === 'done'))

const hasOversizeActive = computed(() => activeBatches.value.some((b) => b.oversize))

const conflictItem = computed(() => store.queue.find((i) => i.status === 'conflict') ?? null)
const totalCount = computed(() => store.queue.length)

// PATH SAFETY: only show a directory once it converts to a virtual (display-
// name-rooted) path; otherwise render nothing rather than leak /DATA or /media.
function batchDir(b: BatchView): string {
  const real = b.items[0]?.targetPath ?? ''
  const virtual = toVirtualPath(real, files.displayNames)
  return virtual === real ? '' : virtual
}

function labelText(label: BatchLabel): string {
  if (label.kind === 'single') return label.name
  if (label.kind === 'folder') return t('filesUploadBatchFolder', { name: label.name, count: label.count })
  return t('filesUploadBatchFiles', { count: label.count })
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}
function batchSpeed(b: BatchView): number {
  return b.items.reduce((s, i) => s + (i.status === 'uploading' ? i.speed : 0), 0)
}
// "45.2 MB / 120 MB" — uploaded volume out of the batch total
function sizeText(b: BatchView): string {
  return `${renderSize(b.sentBytes)} / ${renderSize(b.totalBytes)}`
}
// single-file batch: surface the file's own error code
function singleErrorText(b: BatchView): string {
  const it = b.items[0]
  return !b.multi && it?.error ? t(uploadErrorKey(it.error)) : ''
}

// Global bar: any active work → offer pause-all; once nothing is left running
// but something is paused → offer resume-all.
const anyRunning = computed(() => store.queue.some((i) => i.status === 'uploading' || i.status === 'pending'))
const anyPaused = computed(() => store.queue.some((i) => i.status === 'paused'))
// Batch-level: activeCount = pending+uploading (see uploadBatches); a batch is
// "paused" once nothing in it is still active but at least one item is paused.
function batchRunning(b: BatchView): boolean {
  return b.activeCount > 0
}
function batchPaused(b: BatchView): boolean {
  return b.pausedCount > 0 && b.activeCount === 0
}

// Per-file expand: multi-file batches (folders/multi-select) can be expanded
// into their individual items for single-file pause/resume/cancel. Collapsed
// by default so a folder with hundreds of files doesn't flood the panel.
const expanded = ref<Set<string>>(new Set())
function toggleExpand(batchId: string) {
  const next = new Set(expanded.value)
  if (next.has(batchId)) next.delete(batchId)
  else next.add(batchId)
  expanded.value = next
}
// PATH SAFETY: show only the file's basename, never the real /DATA/... path.
function itemName(it: UploadItem): string {
  const p = it.relativePath || it.fileName
  return p.split('/').pop() || p
}

function onRetry(b: BatchView) {
  if (b.multi) store.retryBatch(b.batchId)
  else store.retryItem(b.items[0].id)
}
function onCancel(b: BatchView) {
  if (b.multi) store.cancelBatch(b.batchId)
  else store.cancelItem(b.items[0].id)
}

// Delete confirmation (mirrors the file-delete AlertDialog). Each delete
// trigger stashes a message + the actual delete closure; confirm runs it.
// NOTE: `pendingRun` is intentionally NOT cleared in @update:open. reka-ui's
// AlertDialogAction fires update:open(false) on the SAME click as our confirm,
// and it can run first — clearing the closure there would drop it before
// confirmDelete reads it (confirm would then no-op and nothing gets deleted).
// So update:open only toggles visibility; confirmDelete captures+runs the
// closure itself, order-independent. A lingering pendingRun after a cancel is
// harmless — it's only ever invoked by confirmDelete, and overwritten by the
// next askDelete.
const deleteOpen = ref(false)
const deleteMessage = ref('')
let pendingRun: (() => void) | null = null
function askDelete(message: string, run: () => void) {
  deleteMessage.value = message
  pendingRun = run
  deleteOpen.value = true
}
function confirmDelete() {
  const run = pendingRun
  pendingRun = null
  deleteOpen.value = false
  run?.()
}

function resolve(choice: 'overwrite' | 'rename' | 'skip') {
  const item = conflictItem.value
  if (item) store.resolveConflict(item.id, choice)
}

// needs_file reselect: user re-picks the same folder/files via a hidden
// input; reattachFiles matches them back onto the needs_file queue items by
// their own targetPath/relativePath (the SelectedFile.targetPath below is a
// placeholder to satisfy the shape, not used for matching).
const reselectInput = ref<HTMLInputElement | null>(null)
const reselectDismissed = ref(false)
const showRestoreNotice = computed(() => store.restoreNoticeCount > 0 && !reselectDismissed.value)

function triggerReselect() {
  reselectInput.value?.click()
}
async function onReselect(e: Event) {
  const input = e.target as HTMLInputElement
  const list = input.files
  if (list && list.length) {
    const sel = Array.from(list).map((f) => ({
      file: f,
      targetPath: files.currentPath,
      relativePath: (f as any).webkitRelativePath || f.name,
    }))
    await store.reattachFiles(sel)
  }
  input.value = ''
}
</script>

<template>
  <div v-if="totalCount" class="upload-panel-wrap">
    <button v-if="!open" class="upload-panel-toggle" @click="open = true">
      {{ t('filesUploadTitle') }} ({{ totalCount }})
    </button>

    <div v-else class="upload-panel">
      <div class="up-head">
        <span class="up-title">{{ t('filesUploadTitle') }}</span>
        <div class="up-head-actions">
          <button v-if="anyRunning" class="up-link-btn" @click="store.pauseAll()">{{ t('filesUploadPauseAll') }}</button>
          <button v-else-if="anyPaused" class="up-link-btn" @click="store.resumeAll()">{{ t('filesUploadResumeAll') }}</button>
          <button v-if="doneBatches.length" class="up-link-btn" @click="store.clearDone()">
            {{ t('filesUploadClearDone') }}
          </button>
          <button v-if="totalCount" class="up-link-btn up-delete-all" @click="askDelete(t('filesUploadDeleteAllConfirm'), () => store.cancelAll())">{{ t('filesUploadDeleteAll') }}</button>
          <button class="up-close" @click="open = false" aria-label="close">×</button>
        </div>
      </div>

      <div v-if="showRestoreNotice" class="up-restore-notice">
        <span>{{ t('filesUploadRestoreNotice', { count: store.restoreNoticeCount }) }}</span>
        <button class="up-link-btn" @click="reselectDismissed = true">{{ t('filesUploadRestoreDismiss') }}</button>
      </div>

      <div v-if="hasOversizeActive" class="up-oversize-banner">{{ t('filesUploadOversize') }}</div>

      <div v-if="problemBatches.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneProblem') }}</div>
        <div v-for="b in problemBatches" :key="b.batchId" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ labelText(b.label) }}</span>
            <span v-if="batchDir(b)" class="up-item-dir">{{ batchDir(b) }}</span>
          </div>
          <div v-if="b.needsFileCount > 0" class="up-item-error">{{ t('filesUploadNeedsFile') }}</div>
          <template v-else>
            <div v-if="singleErrorText(b)" class="up-item-error">{{ singleErrorText(b) }}</div>
            <div v-else-if="b.multi" class="up-item-error">{{ t('filesUploadFailedCount', { count: b.errorCount }) }}</div>
          </template>
          <div class="up-item-actions">
            <button v-if="b.needsFileCount > 0" class="up-link-btn" @click="triggerReselect">{{ t('filesUploadReselect') }}</button>
            <button v-else class="up-link-btn" @click="onRetry(b)">{{ t('filesUploadRetry') }}</button>
            <button class="up-link-btn up-del" @click="askDelete(t('filesUploadDeleteOne', { name: labelText(b.label) }), () => onCancel(b))">{{ t('filesUploadCancel') }}</button>
          </div>
        </div>
      </div>

      <div v-if="activeBatches.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneActive') }}</div>
        <div v-for="b in activeBatches" :key="b.batchId" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ labelText(b.label) }}</span>
            <span v-if="batchDir(b)" class="up-item-dir">{{ batchDir(b) }}</span>
            <span v-if="b.multi" class="up-item-count">{{ t('filesUploadBatchProgress', { done: b.doneCount, total: b.total }) }}</span>
            <span v-if="batchPaused(b)" class="up-item-count">{{ t('filesUploadPaused') }}</span>
            <span class="up-item-pct">{{ b.progress }}%</span>
            <button v-if="b.multi" class="up-link-btn up-expand-btn" @click="toggleExpand(b.batchId)">{{ expanded.has(b.batchId) ? '▾' : '▸' }}</button>
          </div>
          <div class="up-progress"><div class="up-progress-fill" :style="{ width: b.progress + '%' }"></div></div>
          <div class="up-item-meta">
            <span class="up-item-speed">{{ formatSpeed(batchSpeed(b)) }}</span>
            <span class="up-item-size">{{ sizeText(b) }}</span>
          </div>
          <div class="up-item-actions">
            <button v-if="batchRunning(b)" class="up-link-btn" @click="store.pauseBatch(b.batchId)">{{ t('filesUploadPause') }}</button>
            <button v-else-if="batchPaused(b)" class="up-link-btn" @click="store.resumeBatch(b.batchId)">{{ t('filesUploadResume') }}</button>
            <button class="up-link-btn up-del" @click="askDelete(t('filesUploadDeleteOne', { name: labelText(b.label) }), () => onCancel(b))">{{ t('filesUploadCancel') }}</button>
          </div>
          <div v-if="b.multi && expanded.has(b.batchId)" class="up-subitems">
            <div v-for="it in b.items" :key="it.id" class="up-subitem">
              <span class="up-subitem-name">{{ itemName(it) }}</span>
              <span class="up-subitem-pct">{{ it.status === 'paused' ? t('filesUploadPaused') : it.progress + '%' }}</span>
              <button v-if="it.status === 'uploading' || it.status === 'pending'" class="up-link-btn" @click="store.pauseItem(it.id)">{{ t('filesUploadPause') }}</button>
              <button v-else-if="it.status === 'paused'" class="up-link-btn" @click="store.resumeItem(it.id)">{{ t('filesUploadResume') }}</button>
              <button class="up-link-btn up-del" @click="askDelete(t('filesUploadDeleteOne', { name: itemName(it) }), () => store.cancelItem(it.id))">{{ t('filesUploadCancel') }}</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="doneBatches.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneDone') }}</div>
        <div v-for="b in doneBatches" :key="b.batchId" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ labelText(b.label) }}</span>
            <span v-if="batchDir(b)" class="up-item-dir">{{ batchDir(b) }}</span>
            <span class="up-item-pct">{{ renderSize(b.totalBytes) }}</span>
          </div>
        </div>
      </div>
    </div>

    <Dialog :open="!!conflictItem" :title="t('filesUploadConflictTitle')" @update:open="(v) => { if (!v) resolve('skip') }">
      <p>{{ conflictItem ? t('filesUploadConflictMsg', { name: conflictItem.fileName || conflictItem.relativePath }) : '' }}</p>
      <template #footer>
        <button class="ui-btn" @click="resolve('skip')">{{ t('filesUploadSkip') }}</button>
        <button class="ui-btn" @click="resolve('rename')">{{ t('filesUploadRename') }}</button>
        <button class="ui-btn primary" @click="resolve('overwrite')">{{ t('filesUploadOverwrite') }}</button>
      </template>
    </Dialog>

    <AlertDialog
      :open="deleteOpen"
      :title="t('filesUploadCancel')"
      :message="deleteMessage"
      :confirm-text="t('filesUploadCancel')"
      :cancel-text="t('filesCancel')"
      destructive
      @update:open="(v) => { deleteOpen = v }"
      @confirm="confirmDelete"
    />

    <input ref="reselectInput" type="file" webkitdirectory multiple class="up-hidden-input" @change="onReselect" />
  </div>
</template>

<style scoped>
.upload-panel-wrap { position: fixed; right: 24px; bottom: 24px; z-index: 70; }
.upload-panel-toggle {
  padding: 8px 16px; border-radius: 999px; border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  background: var(--popup-bg, rgba(20,23,35,0.96)); color: var(--fg); cursor: pointer; font-size: 13px;
  backdrop-filter: blur(20px); box-shadow: 0 18px 48px rgba(0,0,0,0.5);
}
.upload-panel {
  width: 460px; max-width: calc(100vw - 48px); max-height: 74vh; overflow-y: auto;
  padding: 16px 18px; border-radius: 18px;
  background: var(--popup-bg, rgba(20,23,35,0.96)); border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  backdrop-filter: blur(20px); box-shadow: 0 18px 48px rgba(0,0,0,0.5); color: var(--fg);
}
.up-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.up-title { font-size: 15px; font-weight: 600; }
/* Compound selectors so red wins over .up-link-btn's accent color regardless of
   stylesheet order (both are single-class = equal specificity otherwise). */
.up-link-btn.up-del { color: #ff8a8a; }
.up-head-actions { display: flex; align-items: center; gap: 10px; }
.up-link-btn.up-delete-all { color: #ff8a8a; }
.up-close { background: transparent; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 16px; line-height: 1; }
.up-oversize-banner {
  margin-bottom: 10px; padding: 8px 10px; border-radius: 10px; font-size: 12px;
  background: color-mix(in srgb, #f5a623 20%, transparent); border: 1px solid color-mix(in srgb, #f5a623 45%, transparent);
  color: #f5c777;
}
.up-zone { margin-top: 6px; }
.up-zone-title { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 8px 0 4px; }
.up-item { margin-top: 8px; }
.up-item-line { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.up-item-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-item-dir { flex: 0 1 auto; color: var(--fg-muted, #9aa4bf); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.up-item-count { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); font-size: 11px; }
.up-item-pct { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); }
/* speed pinned bottom-left, size pinned bottom-right (right edge fixed so the
   changing digits never shove the speed around); tabular digits steady width */
.up-item-meta { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; }
.up-item-speed { font-size: 11px; color: var(--fg-muted, #9aa4bf); text-align: left; font-variant-numeric: tabular-nums; }
.up-item-size { margin-left: auto; text-align: right; font-size: 11px; color: var(--fg-muted, #9aa4bf); font-variant-numeric: tabular-nums; }
.up-item-error { font-size: 11px; color: #ff8a8a; margin-top: 2px; }
.up-progress { height: 5px; border-radius: 999px; background: var(--chip-bg, rgba(255,255,255,0.1)); overflow: hidden; margin-top: 4px; }
.up-progress-fill { height: 100%; background: var(--accent, #6ea8fe); transition: width .2s; }
.up-item-actions { display: flex; gap: 10px; margin-top: 4px; }
.up-link-btn {
  background: transparent; border: none; padding: 0; color: var(--accent, #6ea8fe); cursor: pointer; font-size: 12px;
}
.up-expand-btn { flex: 0 0 auto; font-size: 11px; }
.up-subitems {
  margin-top: 6px; padding-left: 10px; border-left: 1px solid var(--card-border, rgba(255,255,255,0.12));
  display: flex; flex-direction: column; gap: 6px;
}
.up-subitem { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.up-subitem-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-subitem-pct { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
.up-restore-notice {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;
  padding: 8px 10px; border-radius: 10px; font-size: 12px;
  background: color-mix(in srgb, var(--accent, #6ea8fe) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #6ea8fe) 40%, transparent);
}
.up-hidden-input { display: none; }
</style>
