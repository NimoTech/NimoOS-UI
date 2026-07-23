<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { usageLevel, type StorageVolume } from '../util/storageMap'

defineProps<{ volume: StorageVolume }>()
defineEmits<{ (e: 'unmount'): void }>()
const { t } = useI18n()
</script>

<template>
  <article class="volume-card">
    <div class="vc-head">
      <h3 class="vc-name">
        {{ volume.name }}
        <span v-if="volume.isSystem" class="vc-os">OS</span>
      </h3>
      <button v-if="!volume.isSystem" class="vc-remove" type="button" @click="$emit('unmount')">
        {{ t('storageUnmount') }}
      </button>
    </div>
    <p class="vc-meta">{{ t('storageVolumeSingle') }} · {{ volume.fsType.toUpperCase() }}</p>
    <p class="vc-usage">{{ fmtSize(volume.usedSize) }} / {{ fmtSize(volume.size) }}</p>
    <div class="vc-track" role="progressbar" :aria-valuenow="volume.usePercent" aria-valuemin="0" aria-valuemax="100">
      <div class="vc-fill" :class="usageLevel(volume.usePercent)" :style="{ width: Math.min(100, Math.max(0, volume.usePercent)) + '%' }" />
    </div>
  </article>
</template>

<style scoped>
.volume-card {
  padding: 16px 18px; background: var(--card-bg);
  border: 1px solid var(--card-border); border-radius: var(--radius-sm);
}
.volume-card + .volume-card { margin-top: 12px; }
.vc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vc-name { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 0; }
.vc-os {
  font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd);
}
.vc-remove {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--remove-fg);
  border-radius: 999px; padding: 5px 14px; font-size: 12.5px; cursor: pointer; flex: none;
}
.vc-remove:hover { background: var(--chip-bg-hi); }
.vc-meta { margin: 3px 0 0; font-size: 13px; color: var(--fg-muted); }
.vc-usage { margin: 10px 0 6px; font-size: 12.5px; color: var(--fg-muted); font-family: var(--num-font); }
.vc-track { height: 6px; border-radius: 999px; background: var(--nrm-bg); overflow: hidden; }
.vc-fill { height: 100%; border-radius: 999px; }
.vc-fill.ok { background: var(--accent); }
.vc-fill.warn { background: var(--dem-fg); }
.vc-fill.danger { background: var(--remove-fg); }
</style>
