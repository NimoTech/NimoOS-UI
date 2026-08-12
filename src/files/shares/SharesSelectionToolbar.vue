<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; busy?: boolean }>()
const emit = defineEmits<{ (e: 'select-all'): void; (e: 'clear'): void; (e: 'unshare'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="shares-sel-toolbar">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn sel-all" @click="emit('select-all')">{{ t('filesSelectAll') }}</button>
    <button class="sel-btn sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
    <button class="sel-btn sel-unshare danger" :disabled="props.busy" @click="emit('unshare')">{{ t('filesUnshare') }}</button>
  </div>
</template>

<style scoped>
.shares-sel-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.sel-count { flex: 0 0 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.sel-btn:disabled { opacity: 0.5; cursor: default; }
.sel-btn.danger { color: var(--remove-fg, #ff8a8a); border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent); }
.sel-btn.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 22%, transparent); }
@media (max-width: 768px) {
  .shares-sel-toolbar { flex-wrap: wrap; row-gap: 8px; }
}
</style>
