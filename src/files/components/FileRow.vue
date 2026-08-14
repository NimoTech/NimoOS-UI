<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileEntry } from '../stores/files'
import { renderSize, dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import FileThumb from './FileThumb.vue'
import FavoriteStar from './FavoriteStar.vue'
import { useClipboardStore } from '../stores/clipboard'
import { useFolderSizesStore } from '../stores/folderSizes'
import { isUploadBroken, uploadBatchIdOf } from '../util/uploadBadge'

const props = defineProps<{ entry: FileEntry; selected?: boolean }>()
const { t } = useI18n()
const clipboard = useClipboardStore()
const folderSizes = useFolderSizesStore()
const sizeStatus = computed(() => folderSizes.statusOf(props.entry.path))
// Loading keeps the same button element (disabled) rather than swapping to
// plain text, so a click that starts a compute never drops keyboard focus
// to <body> when the button it was on disappears from the DOM.
const sizeCellLabel = computed(() => {
  if (sizeStatus.value === 'loading') return t('filesFolderSizeComputing')
  if (sizeStatus.value === 'error') return t('filesFolderSizeRetry')
  return t('filesFolderSizeCompute')
})
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
  (e: 'contextmenu', payload: { entry: FileEntry; event: MouseEvent }): void
  (e: 'open-batch', batchId: string, entryPath: string): void
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
    :class="{ selected: props.selected, cut: clipboard.isCut(props.entry.path), uploading: props.entry.uploading }"
    :data-path="props.entry.path"
    @click="onClick"
    @contextmenu="emit('contextmenu', { entry: props.entry, event: $event })"
  >
    <span class="file-check">
      <span v-if="props.entry.uploading" class="row-spinner" :title="$t('filesUploadingLabel')" aria-hidden="true"></span>
      <input
        v-else
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
      @click.stop.prevent="emit('open-batch', uploadBatchIdOf(props.entry), props.entry.path)"
    >!</button>
    <span class="file-name" :title="props.entry.name">{{ props.entry.name }}</span>
    <span class="file-format">{{ props.entry.is_dir ? '' : fileExt(props.entry.name) }}</span>
    <span class="file-date">{{ dateFmt(props.entry.date || '') }}</span>
    <span class="file-size">
      <template v-if="props.entry.uploading">{{ $t('filesUploadingLabel') }}</template>
      <template v-else-if="!props.entry.is_dir">{{ renderSize(props.entry.size ?? 0) }}</template>
      <template v-else-if="sizeStatus === 'done'">{{ renderSize(folderSizes.bytesOf(props.entry.path) ?? 0) }}</template>
      <button
        v-else
        type="button"
        class="size-compute"
        :disabled="sizeStatus === 'loading'"
        @click.stop="folderSizes.compute(props.entry.path)"
      >{{ sizeCellLabel }}</button>
    </span>
    <span class="file-star"><FavoriteStar v-if="props.entry.is_dir && !props.entry.uploading" :path="props.entry.path" :name="props.entry.name" /></span>
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
/* Single-line ellipsis, the same rule the desktop uses for icon titles
   (home/components/AppTile.vue:49, FolderTile.vue:26): overflow hidden +
   text-overflow ellipsis + white-space nowrap, no word-break.
   `min-width: 0` here is defence in depth, NOT the thing that makes truncation
   work — measured, not assumed. The familiar flex trap (a flex item's
   `min-width: auto` refusing to shrink below its content) does not apply while
   `overflow` is anything other than `visible`, which zeroes the automatic
   minimum size (CSS Flexbox §4.5). Deleting this declaration and re-measuring
   in headless chromium at 1600px and at 760px gave identical numbers —
   clientWidth 264 vs scrollWidth 1697, zero overflowing rows — so the ellipsis
   was already correct before it was added. It stays so that a later change to
   `overflow` cannot silently turn a clipped name back into a row that shoves
   the date and size columns off screen. */
.file-name { flex: 1 1 auto; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-format { flex: 0 0 48px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-transform: uppercase; }
.file-date { flex: 0 0 160px; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
.file-size { flex: 0 0 80px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-align: right; }
/* On-demand folder size trigger. Rendered as text-like button: muted at rest,
   accent on hover. font: inherit picks up the 12px cell size. */
.size-compute { background: none; border: none; padding: 0; font: inherit; color: var(--fg-muted); cursor: pointer; }
.size-compute:hover { color: var(--accent); }
.size-compute:disabled { cursor: default; }
.size-compute:disabled:hover { color: var(--fg-muted); }
.file-star { flex: 0 0 32px; display: flex; justify-content: center; }
.file-row :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-row:hover :deep(.favorite-star), .file-row :deep(.favorite-star.active) { opacity: 1; }
.file-row.cut { opacity: 0.45; }
/* Optimistic upload placeholder: dimmed, non-interactive, spinner in the
   checkbox slot. Mirrors FileTile.vue's .uploading. */
.file-row.uploading { opacity: 0.6; cursor: default; }
.row-spinner {
  width: 14px; height: 14px;
  border: 2px solid color-mix(in srgb, var(--fg-muted) 40%, transparent);
  border-top-color: var(--accent); border-radius: 999px;
  animation: row-spin 0.7s linear infinite;
}
@keyframes row-spin { to { transform: rotate(360deg); } }
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
