<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; allSelected: boolean; canShare: boolean }>()
const emit = defineEmits<{ (e: 'select-all'): void; (e: 'clear'): void; (e: 'delete'): void; (e: 'copy'): void; (e: 'cut'): void; (e: 'download'): void; (e: 'share'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="selection-toolbar">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn sel-all" @click="emit('select-all')">{{ t('filesSelectAll') }}</button>
    <button class="sel-btn sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
    <button class="sel-btn sel-copy" @click="emit('copy')">{{ t('filesCtxCopy') }}</button>
    <button class="sel-btn sel-cut" @click="emit('cut')">{{ t('filesCtxCut') }}</button>
    <button class="sel-btn sel-download" @click="emit('download')">{{ t('filesCtxDownload') }}</button>
    <button v-if="props.canShare" class="sel-btn sel-share" @click="emit('share')">{{ t('filesShareToLan') }}</button>
    <span class="sel-spacer"></span>
    <button class="sel-btn sel-delete danger" @click="emit('delete')">{{ t('filesCtxDelete') }}</button>
  </div>
</template>

<style scoped>
.selection-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.sel-count { flex: 0 0 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.sel-spacer { flex: 1 1 auto; }
.sel-btn.danger { color: var(--remove-fg, #ff8a8a); border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent); }
.sel-btn.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 22%, transparent); }
</style>
