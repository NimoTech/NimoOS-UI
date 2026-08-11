<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { dateFmt } from '../util/format'
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
    class="file-tile"
    :class="{ selected: props.selected, cut: clipboard.isCut(props.entry.path), uploading: props.entry.uploading }"
    :data-path="props.entry.path"
    @click="onClick"
    @contextmenu="emit('contextmenu', { entry: props.entry, event: $event })"
  >
    <span v-if="props.entry.uploading" class="tile-spinner" :title="$t('filesUploadingLabel')" aria-hidden="true"></span>
    <span v-if="!props.entry.uploading" class="tile-check">
      <input
        type="checkbox"
        class="tile-check-box"
        :checked="props.selected"
        @click.stop
        @change="emit('select', { entry: props.entry, mode: 'toggle' })"
      />
    </span>
    <button
      v-if="isUploadBroken(props.entry) && uploadBatchIdOf(props.entry)"
      type="button"
      class="upload-broken-badge"
      :title="$t('filesUploadBrokenBadge')"
      @click.stop.prevent="emit('open-batch', uploadBatchIdOf(props.entry), props.entry.path)"
    >!</button>
    <FavoriteStar v-if="props.entry.is_dir && !props.entry.uploading" class="tile-star" :path="props.entry.path" :name="props.entry.name" />
    <FileThumb class="tile-icon" :entry="props.entry" />
    <span class="tile-name">{{ props.entry.name }}</span>
    <span class="tile-date">{{ props.entry.uploading ? $t('filesUploadingLabel') : dateFmt(props.entry.date || '') }}</span>
  </div>
</template>

<style scoped>
.file-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; cursor: pointer; color: var(--fg); background: transparent; border: 1px solid transparent; }
.file-tile:hover { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.file-tile.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.tile-icon { width: var(--app-size, 64px); height: var(--app-size, 64px); }
.tile-name { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.tile-date { font-size: 11px; color: var(--fg-muted, #9aa4bf); }
.tile-star { position: absolute; top: 6px; right: 6px; }
/* The broken badge owns the top-right corner (it is the urgent, always-visible
   signal); a favorited folder's star would otherwise sit on the exact same
   6px/6px spot and the two stack unreadably. Shift the star left of the 20px
   badge whenever one is present. */
.file-tile:has(.upload-broken-badge) .tile-star { right: 30px; }
.tile-check { position: absolute; top: 6px; left: 6px; }
.tile-check-box { opacity: 0; cursor: pointer; }
.file-tile:hover .tile-check-box, .file-tile.selected .tile-check-box { opacity: 1; }
.file-tile :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-tile:hover :deep(.favorite-star), .file-tile :deep(.favorite-star.active) { opacity: 1; }
.file-tile.cut { opacity: 0.45; }
/* Optimistic upload placeholder: dimmed and non-interactive (it isn't on disk
   yet), with a spinner where the checkbox would sit. */
.file-tile.uploading { opacity: 0.6; cursor: default; }
.tile-spinner {
  position: absolute; top: 8px; left: 8px; width: 14px; height: 14px;
  border: 2px solid color-mix(in srgb, var(--fg-muted) 40%, transparent);
  border-top-color: var(--accent); border-radius: 999px;
  animation: tile-spin 0.7s linear infinite;
}
@keyframes tile-spin { to { transform: rotate(360deg); } }
/* --remove-bg is a solid-fill token meant to pair with white text (see
   .grid-item .remove above); pairing it with --remove-fg as the glyph color
   gives ~1.2:1 contrast in both themes (near-identical hues) — invisible.
   AppSettingsPage.vue's .set-conflict already hit this same mistake and
   settled on --drop-bad (translucent tint) + --remove-fg text/border, which
   composites to ~6:1 (dark) / ~4.3:1 (light) against the page background.
   Adopt that pairing here instead of inventing a new one. */
.upload-broken-badge {
  position: absolute; right: 6px; top: 6px; width: 20px; height: 20px;
  display: grid; place-items: center; padding: 0;
  border-radius: 999px; border: 1px solid var(--remove-fg);
  background: var(--drop-bad); color: var(--remove-fg);
  font-size: 13px; font-weight: 700; line-height: 1; cursor: pointer;
}
/* Hover must read as a *stronger* signal than resting, not weaker — a ring
   layered on top of the same legible fill, rather than swapping to a fainter
   translucent background (the bug this replaces). */
.upload-broken-badge:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--remove-fg) 30%, transparent); }
</style>
