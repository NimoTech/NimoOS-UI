<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import RaidMemberList from '../storage/components/RaidMemberList.vue'
import RaidDeleteDialog from '../storage/components/RaidDeleteDialog.vue'
import RaidReplaceDialog from '../storage/components/RaidReplaceDialog.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useGuardedPoll } from '../composables/useGuardedPoll'
import { fmtSize } from '../home/util/format'
import {
  resolveRaidState, raidSeverity, raidStateLabelKey, raidUsagePercent, levelInfo,
  type RaidArray,
} from '../storage/util/raidView'

const store = useStorageStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const idStr = computed(() => String(route.params.id))

// 先 loadRaid() 拿阵列名/level(list 视图可能未跑过),再拉本阵列的 status/usage 详情
onMounted(() => {
  store.loadRaid().then(() => store.loadRaidDetail(idStr.value))
})

const detail = computed(() => store.raidDetail)
const fallbackArray: RaidArray = { id: '', name: '', level: 0, state: '' }
const array = computed(() => detail.value?.array ?? fallbackArray)
const status = computed(() => detail.value?.status ?? null)
const usage = computed(() => detail.value?.usage ?? null)

const flags = computed(() => resolveRaidState(array.value, status.value))
const severity = computed(() => raidSeverity(flags.value))
const labelKey = computed(() => raidStateLabelKey(flags.value))

// 重建中时 5000ms 单飞重拉详情(活体进度);无重建则不发请求
useGuardedPoll(() => store.loadRaidDetail(idStr.value), {
  intervalMs: 5000,
  active: () => flags.value.isRebuilding,
})

const usedBytes = computed(() => Number(status.value?.used_bytes) || 0)
const totalBytes = computed(() => Number(status.value?.total_bytes) || 0)
const freeBytes = computed(() => {
  const f = Number(status.value?.free_bytes)
  return f || Math.max(0, totalBytes.value - usedBytes.value)
})
const pct = computed(() => raidUsagePercent(usedBytes.value, totalBytes.value))
const donutStyle = computed(() => ({
  background: `conic-gradient(var(--accent) ${pct.value}%, var(--nrm-bg) ${pct.value}%)`,
}))

const info = computed(() => levelInfo(array.value.level))

// 状态色沿用 RaidCard.vue 的 severity → token 映射(rc-badge 同款语义)
function severityToken(sev: string): string {
  if (sev === 'danger') return '--remove-fg'
  if (sev === 'info') return '--accent'
  if (sev === 'warning') return '--dem-fg'
  return '--sem-fg'
}

function strField(o: Record<string, unknown> | null | undefined, key: string): string {
  const v = o?.[key]
  return typeof v === 'string' ? v : ''
}

const devicePath = computed(() => array.value.device_path || `/dev/${array.value.name}`)
const mountPoint = computed(() => array.value.mount_point || '—')
const filesystem = computed(() => {
  const raw = strField(status.value, 'filesystem') || usage.value?.filesystem || array.value.filesystem || ''
  return raw ? raw.toLowerCase() : '—'
})
const uuid = computed(() => array.value.uuid || '—')
const chunk = computed(() => (array.value.chunk_kb ? `${array.value.chunk_kb} KB` : '—'))
const rebuildFinish = computed(() => strField(status.value, 'rebuild_finish'))
const rebuildSpeed = computed(() => strField(status.value, 'rebuild_speed'))

const btrfsFreeBytes = computed(() => Number(usage.value?.btrfs_usage?.free_estimated_bytes) || 0)
const btrfsCachedAtLabel = computed(() => {
  const ts = usage.value?.btrfs_usage?.cached_at
  if (!ts) return ''
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString()
})
const showBtrfsRows = computed(() => filesystem.value === 'btrfs' && btrfsFreeBytes.value > 0)

const members = computed(() => status.value?.members || [])

function backToList() {
  router.push('/storage/raid')
}

const deleteOpen = ref(false)
async function onDelete() {
  const ok = await store.removeRaid(idStr.value)
  if (ok) {
    deleteOpen.value = false
    router.push('/storage/raid')
  }
}

// 换盘(P4 T7):RaidMemberList 的 faulty 成员行 emit replace-disk(diskPath) → 开弹窗;
// 弹窗 emit confirm(newDiskPath) 才真正调 store(store 调用留在视图,不在弹窗内)。
const replaceOpen = ref(false)
const replaceTarget = ref('')
function onReplaceRequested(diskPath: string) {
  replaceTarget.value = diskPath
  replaceOpen.value = true
}
async function onReplace(newDiskPath: string) {
  const ok = await store.replaceRaidDisk(idStr.value, { old_disk_path: replaceTarget.value, new_disk_path: newDiskPath })
  if (ok) replaceOpen.value = false
}
</script>

<template>
  <StorageShell>
    <div class="rd">
      <header class="rd-head">
        <button class="rd-back" type="button" @click="backToList">‹ {{ t('storageTabRaid') }}</button>
        <h2 class="rd-name">{{ array.name }}</h2>
        <span class="rd-level">RAID {{ array.level }}</span>
        <span class="rc-badge" :class="severity">{{ t(labelKey) }}</span>
        <button class="rd-delete" type="button" @click="deleteOpen = true">{{ t('raidRemove') }}</button>
      </header>

      <RaidDeleteDialog
        :open="deleteOpen"
        :name="array.name"
        :busy="store.raidRemoving"
        @update:open="deleteOpen = $event"
        @confirm="onDelete"
      />

      <RaidReplaceDialog
        :open="replaceOpen"
        :raid-id="idStr"
        :faulty-disk-path="replaceTarget"
        :available-disks="store.availDisks"
        :busy="store.raidReplacing"
        @update:open="replaceOpen = $event"
        @confirm="onReplace"
      />

      <div class="rd-cols">
        <div class="rd-col-left">
          <div class="rd-card rd-donut-card">
            <div class="rd-donut" :style="donutStyle">
              <div class="rd-donut-center">
                <div class="rd-donut-pct">{{ pct }}%</div>
              </div>
            </div>
            <div class="rd-legend">
              <div class="rd-legend-row">
                <span class="rd-dot" style="background: var(--accent)"></span>
                <span>{{ t('raidUsageUsed') }}: {{ fmtSize(usedBytes) }}</span>
              </div>
              <div class="rd-legend-row">
                <span class="rd-dot" style="background: var(--nrm-bg)"></span>
                <span>{{ t('raidUsageFree') }}: {{ fmtSize(freeBytes) }}</span>
              </div>
            </div>
          </div>

          <div v-if="info" class="rd-card">
            <div class="rd-card-title">RAID {{ array.level }}</div>
            <div class="rd-row"><span class="rd-key">{{ t('raidLevelType') }}</span><span class="rd-val">RAID {{ array.level }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidLevelTolerance') }}</span><span class="rd-val">{{ t(info.faultToleranceKey) }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidLevelRead') }}</span><span class="rd-val">{{ t(info.readSpeedKey) }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidLevelWrite') }}</span><span class="rd-val">{{ t(info.writeSpeedKey) }}</span></div>
          </div>

          <!-- 快照面板 P5 -->
        </div>

        <div class="rd-col-right">
          <div class="rd-card">
            <div class="rd-row"><span class="rd-key">{{ t('raidDetailDevicePath') }}</span><span class="rd-val code">{{ devicePath }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidDetailMountPoint') }}</span><span class="rd-val code">{{ mountPoint }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidDetailFilesystem') }}</span><span class="rd-val">{{ filesystem }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidDetailUuid') }}</span><span class="rd-val code">{{ uuid }}</span></div>
            <div class="rd-row"><span class="rd-key">{{ t('raidDetailChunk') }}</span><span class="rd-val">{{ chunk }}</span></div>
            <div class="rd-row">
              <span class="rd-key">{{ t('raidDetailState') }}</span>
              <span class="rd-val" :style="{ color: `var(${severityToken(severity)})` }">{{ t(labelKey) }}</span>
            </div>
            <div v-if="rebuildFinish" class="rd-row"><span class="rd-key">{{ t('raidRebuildFinish') }}</span><span class="rd-val" style="color: var(--accent)">{{ rebuildFinish }}</span></div>
            <div v-if="rebuildSpeed" class="rd-row"><span class="rd-key">{{ t('raidRebuildSpeed') }}</span><span class="rd-val" style="color: var(--accent)">{{ rebuildSpeed }}</span></div>
            <div v-if="showBtrfsRows" class="rd-row"><span class="rd-key">{{ t('raidBtrfsFreeEst') }}</span><span class="rd-val">{{ fmtSize(btrfsFreeBytes) }}</span></div>
            <div v-if="showBtrfsRows && btrfsCachedAtLabel" class="rd-row"><span class="rd-key">{{ t('raidBtrfsCachedAt') }}</span><span class="rd-val">{{ btrfsCachedAtLabel }}</span></div>
          </div>

          <div class="rd-card">
            <div class="rd-card-title">{{ t('raidMembers') }} ({{ members.length }})</div>
            <RaidMemberList
              :level="array.level"
              :members="members"
              :is-degraded="flags.isDegraded"
              @replace-disk="onReplaceRequested"
            />
          </div>
        </div>
      </div>
    </div>
  </StorageShell>
</template>

<style scoped>
.rd-head { display: flex; align-items: center; gap: 12px; padding: 4px 0 16px; flex-wrap: wrap; }
.rd-back {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
  border-radius: 999px; padding: 5px 13px; font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.rd-back:hover { background: var(--chip-bg-hi); }
.rd-name { margin: 0; font-size: 17px; font-weight: 600; }
.rd-level { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd); }
.rc-badge { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--nrm-bg); border: 1px solid var(--nrm-bd); }
.rc-badge.ok { color: var(--sem-fg); }
.rc-badge.info { color: var(--accent); }
.rc-badge.warning { color: var(--dem-fg); }
.rc-badge.danger { color: var(--remove-fg); }
.rd-delete {
  margin-left: auto; border: 1px solid var(--remove-fg); background: var(--chip-bg); color: var(--remove-fg);
  border-radius: 999px; padding: 5px 13px; font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.rd-delete:hover { background: var(--chip-bg-hi); }

.rd-cols { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 18px; align-items: start; }
@media (max-width: 768px) { .rd-cols { grid-template-columns: 1fr; } }

.rd-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 14px; }
.rd-card-title { font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 12px; border-bottom: 1px solid var(--card-border); }
.rd-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--card-border); font-size: 12.5px; }
.rd-row:last-child { border-bottom: none; }
.rd-key { color: var(--fg-muted); }
.rd-val { font-weight: 500; font-family: var(--num-font); }
.rd-val.code { font-family: monospace; }

.rd-donut-card { display: flex; flex-direction: column; align-items: center; padding: 18px 16px; }
.rd-donut { width: 120px; height: 120px; border-radius: 50%; position: relative; }
.rd-donut-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.rd-donut-pct { font-size: 21px; font-weight: 700; }
.rd-legend { width: 100%; margin-top: 12px; }
.rd-legend-row { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--fg-muted); margin-bottom: 4px; }
.rd-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; border: 1px solid var(--card-border); }
</style>
