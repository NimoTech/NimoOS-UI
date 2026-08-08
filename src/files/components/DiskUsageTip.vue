<!-- src/files/components/DiskUsageTip.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { renderSize } from '../util/format'
import { usedPercent } from '../util/diskUsageFormat'
import type { DiskDetail } from '../stores/diskUsage'

// Presentation only: everything it shows comes in as a prop, so the data
// source (storage list / RAID list / RAID status fallback) stays testable
// on its own in the store.
const props = defineProps<{ detail: DiskDetail }>()
const { t } = useI18n()

const space = computed(() => props.detail?.space ?? null)
const raid = computed(() => props.detail?.raid ?? null)
const pct = computed(() => usedPercent(space.value))
</script>

<template>
  <div class="disk-tip">
    <template v-if="space">
      <div class="disk-tip-row">
        <span class="disk-tip-l">{{ t('filesDiskUsed') }}</span>
        <span class="disk-tip-v">{{ renderSize(space.used) }} / {{ renderSize(space.total) }}</span>
      </div>
      <div class="disk-tip-bar-wrap">
        <div class="disk-tip-bar"><div class="disk-tip-bar-fill" :style="{ width: pct + '%' }"></div></div>
        <span class="disk-tip-pct">{{ pct }}%</span>
      </div>
      <div class="disk-tip-row">
        <span class="disk-tip-l">{{ t('filesDiskAvailable') }}</span>
        <span class="disk-tip-v">{{ renderSize(space.avail) }}</span>
      </div>
    </template>
    <div v-if="raid" class="disk-tip-row">
      <span class="disk-tip-l">RAID</span>
      <span class="disk-tip-v">RAID {{ raid.level }}</span>
    </div>
    <!-- Neither usage nor RAID: say the capacity is unknown rather than render
         an empty box that looks like a rendering bug. -->
    <div v-if="!space && !raid" class="disk-tip-row">
      <span class="disk-tip-l">{{ t('filesDiskCapacity') }}</span>
      <span class="disk-tip-v">—</span>
    </div>
  </div>
</template>

<style scoped>
.disk-tip {
  min-width: 190px; padding: 10px 12px; border-radius: 12px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); color: var(--fg);
  display: flex; flex-direction: column; gap: 6px;
}
.disk-tip-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 12px; }
.disk-tip-l { color: var(--fg-muted); }
.disk-tip-v { font-variant-numeric: tabular-nums; }
.disk-tip-bar-wrap { display: flex; align-items: center; gap: 8px; }
.disk-tip-bar { flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--usage-track); overflow: hidden; }
.disk-tip-bar-fill { height: 100%; background: var(--accent); }
.disk-tip-pct { flex: 0 0 auto; font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
</style>
