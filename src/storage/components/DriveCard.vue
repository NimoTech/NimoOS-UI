<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { toFahrenheit, type PhysicalDrive } from '../util/storageMap'

defineProps<{ drive: PhysicalDrive }>()
const { t } = useI18n()
</script>

<template>
  <article class="drive-card">
    <div class="dc-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
        <path d="M3.5 13.5h17" />
        <circle cx="17" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <div class="dc-main">
      <h3 class="dc-name">{{ drive.name }}</h3>
      <p class="dc-meta">{{ drive.model || '—' }} · {{ fmtSize(drive.size) }} {{ drive.diskType }}</p>
      <p class="dc-stats">
        <span class="dc-health" :class="drive.healthy ? 'ok' : 'bad'">
          {{ t('storageDriveHealth') }}: <b>{{ drive.healthy ? t('storageDriveHealthy') : t('storageDriveDamaged') }}</b>
        </span>
        <span class="dc-temp">
          {{ t('storageDriveTemp') }}:
          <b v-if="drive.temperature > 0">{{ drive.temperature }}°C / {{ toFahrenheit(drive.temperature) }}°F</b>
          <b v-else>N/A</b>
        </span>
      </p>
    </div>
  </article>
</template>

<style scoped>
.drive-card {
  display: flex; gap: 16px; align-items: center; padding: 16px 18px;
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm);
}
.drive-card + .drive-card { margin-top: 12px; }
.dc-icon { width: 44px; height: 44px; flex: none; color: var(--fg-muted); }
.dc-icon svg { width: 100%; height: 100%; }
.dc-main { min-width: 0; }
.dc-name { margin: 0; font-size: 15px; font-weight: 600; }
.dc-meta { margin: 3px 0 0; font-size: 13px; color: var(--fg-muted); }
.dc-stats { margin: 6px 0 0; font-size: 12.5px; color: var(--fg-muted); display: flex; gap: 16px; flex-wrap: wrap; }
.dc-health.ok b { color: var(--sem-fg); }
.dc-health.bad b { color: var(--remove-fg); }
</style>
