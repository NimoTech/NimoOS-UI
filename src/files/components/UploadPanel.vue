<!-- src/files/components/UploadPanel.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUploadsStore } from '../stores/uploads'
import { useFilesStore } from '../stores/files'
import { groupUploadQueue } from '../upload/uploadListGroups'
import { shouldAutoOpenUploadList } from '../upload/uploadListVisibility'
import { toVirtualPath } from '../util/pathUtils'
import { uploadErrorKey } from '../upload/statusText'
import type { UploadItem } from '../upload/types'
import Dialog from '../../components/ui/Dialog.vue'

const store = useUploadsStore()
const files = useFilesStore()
const { t } = useI18n()

// Treat the panel's initial mount as a transition from an empty queue to
// whatever the store already holds — so a panel mounted with existing
// queue items opens immediately, and one mounted empty opens only once
// items are actually added (via the watcher below).
const open = ref(shouldAutoOpenUploadList(0, store.queue.length))

watch(
  () => store.queue.length,
  (curLen, prevLen) => {
    if (shouldAutoOpenUploadList(prevLen ?? 0, curLen)) open.value = true
  },
)

const groups = computed(() => groupUploadQueue(store.queue))

const hasOversizeActive = computed(() => groups.value.activeItems.some((i) => i.oversize))

const conflictItem = computed(() => store.queue.find((i) => i.status === 'conflict') ?? null)

// PATH SAFETY: only ever show a directory if it actually converted to a
// virtual (display-name-rooted) path. If displayNames hasn't loaded yet,
// toVirtualPath returns the input unchanged — in that case we render
// nothing rather than risk leaking a real /DATA or /media path.
function itemDir(item: UploadItem): string {
  const virtual = toVirtualPath(item.targetPath, files.displayNames)
  return virtual === item.targetPath ? '' : virtual
}

function itemName(item: UploadItem): string {
  return item.fileName || item.relativePath.split('/').filter(Boolean).pop() || item.relativePath
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

function errorText(item: UploadItem): string {
  return item.error ? t(uploadErrorKey(item.error)) : ''
}

function resolve(choice: 'overwrite' | 'rename' | 'skip') {
  const item = conflictItem.value
  if (item) store.resolveConflict(item.id, choice)
}
</script>

<template>
  <div v-if="store.queue.length" class="upload-panel-wrap">
    <button v-if="!open" class="upload-panel-toggle" @click="open = true">
      {{ t('filesUploadTitle') }} ({{ store.queue.length }})
    </button>

    <div v-else class="upload-panel">
      <div class="up-head">
        <span class="up-title">{{ t('filesUploadTitle') }}</span>
        <div class="up-head-actions">
          <button v-if="groups.doneItems.length" class="up-link-btn" @click="store.clearDone()">
            {{ t('filesUploadClearDone') }}
          </button>
          <button class="up-close" @click="open = false" aria-label="close">×</button>
        </div>
      </div>

      <div v-if="hasOversizeActive" class="up-oversize-banner">{{ t('filesUploadOversize') }}</div>

      <div v-if="groups.problemItems.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneProblem') }}</div>
        <div v-for="item in groups.problemItems" :key="item.id" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ itemName(item) }}</span>
            <span v-if="itemDir(item)" class="up-item-dir">{{ itemDir(item) }}</span>
          </div>
          <div v-if="errorText(item)" class="up-item-error">{{ errorText(item) }}</div>
          <div class="up-item-actions">
            <button class="up-link-btn" @click="store.retryItem(item.id)">{{ t('filesUploadRetry') }}</button>
            <button class="up-link-btn" @click="store.cancelItem(item.id)">{{ t('filesUploadCancel') }}</button>
          </div>
        </div>
      </div>

      <div v-if="groups.activeItems.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneActive') }}</div>
        <div v-for="item in groups.activeItems" :key="item.id" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ itemName(item) }}</span>
            <span v-if="itemDir(item)" class="up-item-dir">{{ itemDir(item) }}</span>
            <span class="up-item-pct">{{ item.progress }}%</span>
          </div>
          <div class="up-progress"><div class="up-progress-fill" :style="{ width: item.progress + '%' }"></div></div>
          <div v-if="formatSpeed(item.speed)" class="up-item-speed">{{ formatSpeed(item.speed) }}</div>
          <div class="up-item-actions">
            <button class="up-link-btn" @click="store.cancelItem(item.id)">{{ t('filesUploadCancel') }}</button>
          </div>
        </div>
      </div>

      <div v-if="groups.doneItems.length" class="up-zone">
        <div class="up-zone-title">{{ t('filesUploadZoneDone') }}</div>
        <div v-for="item in groups.doneItems" :key="item.id" class="up-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ itemName(item) }}</span>
            <span v-if="itemDir(item)" class="up-item-dir">{{ itemDir(item) }}</span>
          </div>
          <div v-if="errorText(item)" class="up-item-error">{{ errorText(item) }}</div>
        </div>
      </div>
    </div>

    <Dialog :open="!!conflictItem" :title="t('filesUploadConflictTitle')" @update:open="(v) => { if (!v) resolve('skip') }">
      <p>{{ conflictItem ? t('filesUploadConflictMsg', { name: itemName(conflictItem) }) : '' }}</p>
      <template #footer>
        <button class="ui-btn" @click="resolve('skip')">{{ t('filesUploadSkip') }}</button>
        <button class="ui-btn" @click="resolve('rename')">{{ t('filesUploadRename') }}</button>
        <button class="ui-btn primary" @click="resolve('overwrite')">{{ t('filesUploadOverwrite') }}</button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.upload-panel-wrap { position: fixed; right: 24px; bottom: 24px; z-index: 60; }
.upload-panel-toggle {
  padding: 8px 16px; border-radius: 999px; border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  background: var(--popup-bg, rgba(20,23,35,0.96)); color: var(--fg); cursor: pointer; font-size: 13px;
  backdrop-filter: blur(20px); box-shadow: 0 18px 48px rgba(0,0,0,0.5);
}
.upload-panel {
  width: 360px; max-width: calc(100vw - 48px); max-height: 60vh; overflow-y: auto;
  padding: 12px 14px; border-radius: 16px;
  background: var(--popup-bg, rgba(20,23,35,0.96)); border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  backdrop-filter: blur(20px); box-shadow: 0 18px 48px rgba(0,0,0,0.5); color: var(--fg);
}
.up-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.up-title { font-size: 13px; font-weight: 600; }
.up-head-actions { display: flex; align-items: center; gap: 10px; }
.up-close { background: transparent; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 16px; line-height: 1; }
.up-oversize-banner {
  margin-bottom: 10px; padding: 8px 10px; border-radius: 10px; font-size: 12px;
  background: color-mix(in srgb, #f5a623 20%, transparent); border: 1px solid color-mix(in srgb, #f5a623 45%, transparent);
  color: #f5c777;
}
.up-zone { margin-top: 6px; }
.up-zone-title { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 8px 0 4px; }
.up-item { margin-top: 8px; }
.up-item-line { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.up-item-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-item-dir { flex: 0 1 auto; color: var(--fg-muted, #9aa4bf); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.up-item-pct { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); }
.up-item-speed { font-size: 11px; color: var(--fg-muted, #9aa4bf); margin-top: 2px; }
.up-item-error { font-size: 11px; color: #ff8a8a; margin-top: 2px; }
.up-progress { height: 5px; border-radius: 999px; background: var(--chip-bg, rgba(255,255,255,0.1)); overflow: hidden; margin-top: 4px; }
.up-progress-fill { height: 100%; background: var(--accent, #6ea8fe); transition: width .2s; }
.up-item-actions { display: flex; gap: 10px; margin-top: 4px; }
.up-link-btn {
  background: transparent; border: none; padding: 0; color: var(--accent, #6ea8fe); cursor: pointer; font-size: 12px;
}
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
</style>
