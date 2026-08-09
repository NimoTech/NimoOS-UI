<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { renderSize, dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import FileThumb from './FileThumb.vue'
import FavoriteStar from './FavoriteStar.vue'
import { useClipboardStore } from '../stores/clipboard'
import { isUploadBroken, uploadBatchIdOf } from '../util/uploadBadge'

const props = defineProps<{ entry: FileEntry; selected?: boolean }>()
const clipboard = useClipboardStore()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
  (e: 'contextmenu', payload: { entry: FileEntry; event: MouseEvent }): void
  (e: 'open-batch', batchId: string): void
}>()

function onClick(e: MouseEvent) {
  if (e.shiftKey) emit('select', { entry: props.entry, mode: 'range' })
  else if (e.ctrlKey || e.metaKey) emit('select', { entry: props.entry, mode: 'toggle' })
  else emit('open', props.entry)
}
</script>

<template>
  <div
    class="file-row"
    :class="{ selected: props.selected, cut: clipboard.isCut(props.entry.path) }"
    :data-path="props.entry.path"
    @click="onClick"
    @contextmenu="emit('contextmenu', { entry: props.entry, event: $event })"
  >
    <span class="file-check">
      <input
        type="checkbox"
        class="row-check"
        :checked="props.selected"
        @click.stop
        @change="emit('select', { entry: props.entry, mode: 'toggle' })"
      />
    </span>
    <FileThumb class="file-icon" :entry="props.entry" />
    <button
      v-if="isUploadBroken(props.entry) && uploadBatchIdOf(props.entry)"
      type="button"
      class="upload-broken-badge"
      :title="$t('filesUploadBrokenBadge')"
      @click.stop.prevent="emit('open-batch', uploadBatchIdOf(props.entry))"
    >!</button>
    <span class="file-name">{{ props.entry.name }}</span>
    <span class="file-format">{{ props.entry.is_dir ? '' : fileExt(props.entry.name) }}</span>
    <span class="file-date">{{ dateFmt(props.entry.date || '') }}</span>
    <span class="file-size">{{ props.entry.is_dir ? '' : renderSize(props.entry.size ?? 0) }}</span>
    <span class="file-star"><FavoriteStar v-if="props.entry.is_dir" :path="props.entry.path" :name="props.entry.name" /></span>
  </div>
</template>

<style scoped>
.file-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; cursor: pointer; color: var(--fg); }
.file-row:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.file-row.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.file-check { flex: 0 0 28px; display: flex; justify-content: center; }
.row-check { opacity: 0; cursor: pointer; }
.file-row:hover .row-check, .file-row.selected .row-check { opacity: 1; }
.file-icon { width: 28px; height: 28px; flex: 0 0 auto; }
.file-name { flex: 1 1 auto; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-format { flex: 0 0 48px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-transform: uppercase; }
.file-date { flex: 0 0 160px; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
.file-size { flex: 0 0 80px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-align: right; }
.file-star { flex: 0 0 32px; display: flex; justify-content: center; }
.file-row :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-row:hover :deep(.favorite-star), .file-row :deep(.favorite-star.active) { opacity: 1; }
.file-row.cut { opacity: 0.45; }
/* See FileTile.vue's identical badge for why this pairs --drop-bad (fill) with
   --remove-fg (text/border) instead of --remove-bg — that combination reads
   as ~1.2:1 contrast in both themes (near-identical hues), same mistake
   AppSettingsPage.vue's .set-conflict already made and fixed. */
.upload-broken-badge {
  flex: 0 0 auto; width: 16px; height: 16px;
  display: grid; place-items: center; padding: 0;
  border-radius: 999px; border: 1px solid var(--remove-fg);
  background: var(--drop-bad); color: var(--remove-fg);
  font-size: 10px; font-weight: 700; line-height: 1; cursor: pointer;
}
/* Hover adds emphasis on top of the legible resting fill rather than
   replacing it with a fainter one — stronger signal, not weaker. */
.upload-broken-badge:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--remove-fg) 30%, transparent); }
</style>
