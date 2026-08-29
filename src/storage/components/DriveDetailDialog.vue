<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import { toFahrenheit, type PhysicalDrive } from '../util/storageMap'
import { pohDisplay } from '../util/raidLevels'

// Ported from the Vue 2 panel's src/components/Storage/DiskDetailModal.vue (b6cffd6c): full disk
// identity (model/path/serial/disk_by_id), health/temperature/power-on time, partition
// table (including mount point and used bytes), RAID relationship (local member → neutral
// note; foreign residue → warning box calling out the residual array + created/last-active
// time).
//
// ⚠️ raid.array_name/created_at/updated_at come from the mdadm superblock on the disk —
// any disk that gets plugged in can control these strings, so they may only be rendered
// via template interpolation ({{ }}), never v-html / string-concatenated HTML.
//
// health is the string "true"/"false": use strict comparison for the three-state display
// (healthy/damaged/unknown) — a truthy check would treat "false" as healthy (Vue2 had this
// defect).
const props = defineProps<{ open: boolean; drive: PhysicalDrive }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
const { t } = useI18n()

const poh = computed(() => pohDisplay(props.drive.powerOnHours))
const isMember = computed(() => props.drive.raid?.role === 'member')
const isResidue = computed(() => props.drive.raid?.role === 'residue')
</script>

<template>
  <Dialog :open="open" :title="`${t('driveDetailTitle')} — ${drive.name}`" @update:open="emit('update:open', $event)">
    <div class="ddd">
      <div class="ddd-rows">
        <div class="ddd-row"><span class="ddd-key">{{ t('driveModel') }}</span><span class="ddd-val">{{ drive.model || '—' }}</span></div>
        <div class="ddd-row"><span class="ddd-key">{{ t('raidDetailDevicePath') }}</span><span class="ddd-val code">{{ drive.path || '—' }}</span></div>
        <div class="ddd-row"><span class="ddd-key">{{ t('driveSerial') }}</span><span class="ddd-val code">{{ drive.serial || '—' }}</span></div>
        <div class="ddd-row"><span class="ddd-key">{{ t('driveDeviceId') }}</span><span class="ddd-val code break">{{ drive.diskById || '—' }}</span></div>
        <div class="ddd-row"><span class="ddd-key">{{ t('driveCapacity') }}</span><span class="ddd-val">{{ fmtSize(drive.size) }} · {{ drive.diskType || '—' }}</span></div>
        <div class="ddd-row">
          <span class="ddd-key">{{ t('storageDriveHealth') }}</span>
          <span v-if="drive.health === 'true'" class="ddd-val ok">{{ t('storageDriveHealthy') }}</span>
          <span v-else-if="drive.health === 'false'" class="ddd-val bad">{{ t('storageDriveDamaged') }}</span>
          <span v-else class="ddd-val">—</span>
        </div>
        <div class="ddd-row">
          <span class="ddd-key">{{ t('storageDriveTemp') }}</span>
          <span class="ddd-val">
            <template v-if="drive.temperature > 0">{{ drive.temperature }}°C / {{ toFahrenheit(drive.temperature) }}°F</template>
            <template v-else>—</template>
          </span>
        </div>
        <div class="ddd-row"><span class="ddd-key">{{ t('raidDrivePowerOn') }}</span><span class="ddd-val">{{ poh }}</span></div>
      </div>

      <div v-if="drive.raid" class="ddd-raid" :class="isResidue ? 'warn' : 'info'">
        <p class="ddd-raid-head">
          <template v-if="isMember">
            {{ t('raidMemberTag') }} · {{ (drive.raid.level || '').toUpperCase() }} “{{ drive.raid.array_name }}”<template v-if="drive.raid.md_device"> · {{ drive.raid.md_device }}</template>
          </template>
          <template v-else>⚠ {{ t('raidResidue') }} · “{{ drive.raid.array_name }}”</template>
        </p>
        <p v-if="isResidue" class="ddd-raid-body">
          {{ t('raidResidueExplain', { name: drive.raid.array_name }) }}<br />
          <template v-if="drive.raid.created_at">{{ t('driveRaidCreated') }}: {{ drive.raid.created_at }} · </template>
          <template v-if="drive.raid.updated_at">{{ t('driveLastActive') }}: {{ drive.raid.updated_at }}</template>
        </p>
        <p v-else class="ddd-raid-body">{{ t('raidMemberExplain') }}</p>
      </div>

      <div v-if="drive.children.length" class="ddd-parts">
        <p class="ddd-parts-title">{{ t('drivePartitions') }}</p>
        <div class="ddd-table-wrap">
          <table class="ddd-table">
            <thead>
              <tr>
                <th>{{ t('drivePartName') }}</th>
                <th>{{ t('drivePartFormat') }}</th>
                <th>{{ t('drivePartSize') }}</th>
                <th>{{ t('drivePartUsed') }}</th>
                <th>{{ t('raidDetailMountPoint') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in drive.children" :key="c.name">
                <td class="code">{{ c.name }}</td>
                <td>{{ c.format || '—' }}</td>
                <td>{{ fmtSize(c.size) }}</td>
                <td>{{ c.mountPoint ? fmtSize(c.usedBytes) : '—' }}</td>
                <td class="code break">{{ c.mountPoint || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="ddd-close" type="button" @click="emit('update:open', false)">{{ t('driveDetailClose') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.ddd { width: 440px; max-width: 82vw; }
.ddd-rows { border: 1px solid var(--card-border); border-radius: var(--radius-xs); overflow: hidden; }
.ddd-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 6px 10px; border-bottom: 1px solid var(--card-border); font-size: 12.5px; }
.ddd-row:last-child { border-bottom: none; }
.ddd-key { color: var(--fg-muted); white-space: nowrap; }
.ddd-val { font-weight: 500; text-align: right; }
.ddd-val.code, .code { font-family: monospace; }
.break { word-break: break-all; }
.ddd-val.ok { color: var(--sem-fg); }
.ddd-val.bad { color: var(--remove-fg); }

.ddd-raid { margin-top: 12px; padding: 10px 12px; border-radius: var(--radius-xs); border: 1px solid var(--card-border); font-size: 12px; }
.ddd-raid.info { border-color: var(--nrm-bd); background: var(--nrm-bg); }
.ddd-raid.warn { border-color: var(--dem-fg); }
.ddd-raid.warn .ddd-raid-head { color: var(--dem-fg); }
.ddd-raid-head { margin: 0 0 4px; font-weight: 600; }
.ddd-raid-body { margin: 0; color: var(--fg-muted); line-height: 1.5; }

.ddd-parts { margin-top: 12px; }
.ddd-parts-title { margin: 0 0 6px; font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.ddd-table-wrap { overflow-x: auto; border: 1px solid var(--card-border); border-radius: var(--radius-xs); }
.ddd-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ddd-table th { text-align: left; font-weight: 600; color: var(--fg-muted); padding: 6px 10px; border-bottom: 1px solid var(--card-border); white-space: nowrap; }
.ddd-table td { padding: 6px 10px; border-bottom: 1px solid var(--card-border); }
.ddd-table tbody tr:last-child td { border-bottom: none; }

.ddd-close {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.ddd-close:hover { background: var(--chip-bg-hi); }
</style>
