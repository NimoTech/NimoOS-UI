<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { toFahrenheit, type PhysicalDrive } from '../util/storageMap'
import { pohDisplay } from '../util/raidLevels'
import DriveDetailDialog from './DriveDetailDialog.vue'

// 2026-08-11 磁盘洞察(对齐 Vue2 DriveItem.vue b6cffd6c):卡片带序列号 + 通电时长与
// RAID 身份标 —— 本机阵列成员打中性标(级别 · 阵列名),带外来阵列残留超块的盘打警告标;
// 点卡片开详情弹窗(完整身份/健康/分区表/RAID 关系)。
// ⚠️ raid.array_name 来自盘上 mdadm 超块(不可信文本),只经模板插值渲染,不拼 HTML。
const props = defineProps<{ drive: PhysicalDrive }>()
const { t } = useI18n()

const detailOpen = ref(false)
const poh = computed(() => pohDisplay(props.drive.powerOnHours))
const isMember = computed(() => props.drive.raid?.role === 'member')
const isResidue = computed(() => props.drive.raid?.role === 'residue')
const memberTag = computed(() => {
  const r = props.drive.raid
  if (!r) return ''
  return `${(r.level || 'RAID').toUpperCase()} · ${r.array_name}`
})
</script>

<template>
  <article class="drive-card" role="button" :title="t('driveDetailTitle')" @click="detailOpen = true">
    <div class="dc-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
        <path d="M3.5 13.5h17" />
        <circle cx="17" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <div class="dc-main">
      <h3 class="dc-name">
        {{ drive.name }}
        <span v-if="isMember" class="dc-tag">{{ memberTag }}</span>
        <span v-else-if="isResidue" class="dc-tag warn">⚠ {{ t('raidResidue') }}</span>
      </h3>
      <p class="dc-meta">{{ drive.model || '—' }} · {{ fmtSize(drive.size) }} {{ drive.diskType }}</p>
      <p class="dc-meta">
        {{ t('driveSerial') }}: {{ drive.serial || '—' }}<template v-if="drive.powerOnHours > 0"> · {{ t('raidDrivePowerOn') }}: {{ poh }}</template>
      </p>
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
    <DriveDetailDialog :open="detailOpen" :drive="drive" @update:open="detailOpen = $event" />
  </article>
</template>

<style scoped>
.drive-card {
  display: flex; gap: 16px; align-items: center; padding: 16px 18px;
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm);
  cursor: pointer;
}
.drive-card:hover { background: var(--chip-bg-hi); }
.drive-card + .drive-card { margin-top: 12px; }
.dc-icon { width: 44px; height: 44px; flex: none; color: var(--fg-muted); }
.dc-icon svg { width: 100%; height: 100%; }
.dc-main { min-width: 0; }
.dc-name { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dc-tag {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd);
}
.dc-tag.warn { color: var(--dem-fg); border-color: var(--dem-fg); background: var(--chip-bg); }
.dc-meta { margin: 3px 0 0; font-size: 13px; color: var(--fg-muted); }
.dc-stats { margin: 6px 0 0; font-size: 12.5px; color: var(--fg-muted); display: flex; gap: 16px; flex-wrap: wrap; }
.dc-health.ok b { color: var(--sem-fg); }
.dc-health.bad b { color: var(--remove-fg); }
</style>
