<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import RaidMemberList from '../storage/components/RaidMemberList.vue'
import RaidDeleteDialog from '../storage/components/RaidDeleteDialog.vue'
import RaidReplaceDialog from '../storage/components/RaidReplaceDialog.vue'
import RaidReclaimCard from '../storage/components/RaidReclaimCard.vue'
import SnapshotPanel from '../storage/components/SnapshotPanel.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useToast } from '../stores/toast'
import { useGuardedPoll } from '../composables/useGuardedPoll'
import { useDiskHotplug } from '../composables/useDiskHotplug'
import { fmtSize } from '../home/util/format'
import { findReplaceTarget, type ReplaceTarget } from '../storage/util/raidReplace'
import { useRaidEta } from '../storage/composables/useRaidEta'
import type { RaidMemberDiskRow } from '@nimotech/nimoos-service'
import {
  resolveRaidState, raidSeverity, raidStateLabelKey, raidUsagePercent, levelInfo, memberDiskCount, mergeVacatedSlot,
  type RaidArray,
} from '../storage/util/raidView'

const store = useStorageStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const idStr = computed(() => String(route.params.id))

// First call loadRaid() to get the array name/level (the list view may not have run yet),
// then pull this array's status/usage details.
//
// Must call clearRaidDetail() first: these two requests are sequential, and during that
// window the page still renders the store's **previous** snapshot. Clicking into the detail
// page right after replacing a disk would show the pre-replace frame (empty slot + faulty
// disk, 4 member rows), looking as though the replacement didn't take effect (found during
// 2026-07-28 real-device acceptance testing).
function reloadDetail() {
  store.clearRaidDetail()
  store.loadRaid().then(() => store.loadRaidDetail(idStr.value))
}
onMounted(reloadDetail)
// When :id changes, the component instance is reused by the router and onMounted doesn't run
// again -- without this watcher, navigating from one array's detail page to another's would
// keep showing the previous array's data (a P3 leftover ledger item).
watch(idStr, reloadDetail)

// The replace-disk dialog's candidate disks come from store.availDisks, which is only
// populated by loadDrives(). Vue2's RAID section is one big routeless panel where
// availableDisks is loaded once by the parent panel and passed as a prop to RaidReplaceDisk
// (RaidTab.vue:50), so the dialog always has data. New-UI splitting the detail page into its
// own route missed this load: opening/refreshing /storage/raid/:id directly leaves availDisks
// empty, so the "replace disk" dropdown only has a placeholder item and no disk can be picked
// (found during 2026-07-28 real-device acceptance testing). Visiting the volumes/physical
// disks/create page first before coming here happens to already have the data, which is why
// this gap is easy to miss. Uses useDiskHotplug rather than a bare loadDrives(): it loads on
// mount and refreshes the candidate disks on disk hotplug -- the same pattern as
// StorageRaidCreate.vue:33.
useDiskHotplug(() => store.loadDrives())

// Only recognizes the snapshot that belongs to the current route :id. The clear + watcher
// above already cover the main path; this is a fallback: any moment where "the store holds
// another array's data" simply never gets rendered.
const detail = computed(() => {
  const d = store.raidDetail
  return d && String(d.array.id) === idStr.value ? d : null
})
const fallbackArray: RaidArray = { id: '', name: '', level: 0, state: '' }
const array = computed(() => detail.value?.array ?? fallbackArray)
const status = computed(() => detail.value?.status ?? null)
const usage = computed(() => detail.value?.usage ?? null)

const flags = computed(() => resolveRaidState(array.value, status.value))
const severity = computed(() => raidSeverity(flags.value))
const labelKey = computed(() => raidStateLabelKey(flags.value))

// Whether the member-disk reclaim task belongs to this array. It must be **OR'd** with
// isRebuilding as the polling switch: in the first few seconds after --re-add, the kernel
// registers the disk as spare with rebuild_pct still -1, which doesn't count as rebuilding --
// gating solely on isRebuilding would never fire a single request, and the
// spare -> recovering transition would never be observed.
const reclaimActive = computed(() => store.reclaimTask?.arrayId === idStr.value)

// While rebuilding/reclaiming is in progress, single-flight reload the detail every 5000ms
// (live progress); otherwise no request is sent. When a reclaim task is present, also pull the
// list once: the reclaim task's completion check hangs off loadRaid -> syncReclaimTask, while
// this page normally only refreshes raidDetail -- without also calling loadRaid, the task
// would never get closed out while sitting on the detail page.
useGuardedPoll(async () => {
  await store.loadRaidDetail(idStr.value)
  if (reclaimActive.value) await store.loadRaid()
}, {
  intervalMs: 5000,
  active: () => flags.value.isRebuilding || reclaimActive.value,
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

// State color follows RaidCard.vue's severity -> token mapping (same semantics as rc-badge)
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
// Rebuild time remaining: prefers rebuild_eta_seconds (during incremental sync the kernel's
// rebuild_finish is computed from bytes copied so far and can balloon to weeks), alternating
// every 5 seconds between duration and completion time; falls back to the kernel's raw string
// for older backends.
// etaText is a self-contained sentence that takes up a full row in the detail table, with no
// paired key column.
const { etaText } = useRaidEta(() => status.value)
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
// Reclaimable member disks (the backend only sends these when degraded and the disk has been
// plugged back in, see the service package's RaidStatus comment). If non-empty, show the
// "reclaim member disk" banner -- placed before the member list (the replace-disk entry
// point): reclaiming this array's own disk is the cheap, correct fix, whereas replacing wipes
// a disk, so users shouldn't see the destructive path first.
const reattachable = computed(() => status.value?.reattachable_members || [])
async function onReclaim() {
  await store.reclaimRaidMembers(idStr.value)
  // The toast/dashboard-card/detail-refresh all live in the store action; staying on this
  // page to watch the member row go into rebuilding is handled by reclaimActive keeping the
  // polling alive (useGuardedPoll above), independent of isRebuilding.
}
// The header count uses "rows with a device path" rather than the total row count: an empty
// slot placeholder row isn't a disk, and counting it would make a 3-disk array read MEMBER
// DISKS (4) when degraded (see raidView.ts memberDiskCount).
const diskCount = computed(() => memberDiskCount(members.value))
// But writing only the disk count then produces "header (3), 4 rows below", which looks like a
// miscount. So when there's an empty slot, write both numbers out (3 disks + 1 empty slot = 4
// rows, which checks out); when there's no empty slot, say nothing and keep it simple.
// Only count the empty-slot rows remaining **after merging**: a single dropped disk gets
// merged into the faulty-disk row and no longer counts as an empty slot, so the header goes
// back to the simple "member disks (3)" that matches 3 rows. RAID 6's double-fault case can't
// be uniquely paired and isn't merged, which is when the empty-slot count needs to be spelled
// out (see raidView.ts mergeVacatedSlot).
const emptySlotCount = computed(() => mergeVacatedSlot(members.value).filter((m) => !m.path).length)
const membersTitle = computed(() => {
  const n = diskCount.value
  const slots = emptySlotCount.value
  if (slots === 0) return t('raidMembersTitle', { n })
  if (slots === 1) return t('raidMembersTitleOneEmptySlot', { n })
  return t('raidMembersTitleEmptySlots', { n, slots })
})

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

// Replace disk (P4 T7 + 2026-08-11 serial semantics): RaidMemberList's faulty/empty-slot rows
// emit replace-disk(diskPath) -> this view uses findReplaceTarget to identify the disk being
// replaced (a still-present faulty disk is identified by its live path; an unplugged disk by
// its serial, since a stale cached path isn't a reliable identity) -> opens the dialog; the
// dialog's confirm({newDiskPath, wipeResidue}) is what actually calls the store (the store
// call lives in the view, not inside the dialog).
const replaceOpen = ref(false)
const replaceTarget = ref<ReplaceTarget | null>(null)
function onReplaceRequested(diskPath: string) {
  const live = members.value
  const rows = (array.value.member_disks || []) as RaidMemberDiskRow[]
  // The user clicked a specific row: if that row is a still-present faulty disk, build the
  // target from it (so that with multiple simultaneous faults, the wrong disk doesn't get
  // replaced); for an empty-slot row (diskPath is empty) or when not found, fall back to
  // findReplaceTarget's general-purpose identification.
  const clicked = diskPath ? live.find((m) => m.path === diskPath && m.state === 'faulty') : undefined
  const target = clicked
    ? { path: clicked.path, serial: clicked.serial || '', label: clicked.path }
    : findReplaceTarget(live, rows)
  if (!target) {
    // status wasn't fetched yet, or nothing is missing/faulty -- forcing the dialog open
    // would only let the user "replace" a blank
    useToast().show(t('raidReplaceNoTarget'))
    return
  }
  replaceTarget.value = target
  replaceOpen.value = true
}
async function onReplace(payload: { newDiskPath: string; wipeResidue: boolean }) {
  const target = replaceTarget.value
  if (!target) return
  const ok = await store.replaceRaidDisk(idStr.value, {
    old_disk_path: target.path,
    old_disk_serial: target.serial,
    new_disk_path: payload.newDiskPath,
    wipe_raid_residue: payload.wipeResidue,
  })
  if (!ok) return
  replaceOpen.value = false
  // On successful submit, go back to the list page to watch progress (user-specified):
  // rebuilding is a long-running task (real disks can take hours), and the list page has the
  // replace-disk dashboard card + 5-second polling, which suits waiting better than sitting on
  // the detail page.
  // store.replaceTask is already established inside replaceRaidDisk; if the rebuild has
  // already finished by that point it's already been torn down, so the list page won't flash
  // an already-completed card.
  router.push('/storage/raid')
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
        <button
          v-if="flags.isRetrying || flags.isFailed"
          class="rd-recover"
          type="button"
          :disabled="store.raidRecovering"
          @click="store.recoverRaid(idStr)"
        >{{ t('raidRecover') }}</button>
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
        :target="replaceTarget"
        :disks="store.availDisks"
        :busy="store.raidReplacing"
        @update:open="replaceOpen = $event"
        @confirm="onReplace"
      />

      <!-- Show the loading state when detail isn't ready yet, instead of rendering an empty
           shell with "empty name, level 0" using fallbackArray. detail is empty in exactly two
           cases: entering the page/switching :id and waiting for the cleared-then-reloaded
           data, or the store holding another array's data. Neither case should display content
           that doesn't belong to this page. -->
      <div v-if="!detail" class="rd-loading">{{ t('storageLoading') }}</div>

      <template v-else>
      <!-- Reclaim member disk banner: placed before the two columns (which include the member
           list's replace-disk entry point), uses the accent color, non-destructive -->
      <RaidReclaimCard
        v-if="reattachable.length"
        :members="reattachable"
        :busy="store.raidRecovering"
        @reclaim="onReclaim"
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

          <!-- v-if="detail" gate: SnapshotPanel only mounts after raidDetail (array.uuid) has
               actually finished loading. Vue2 (RaidDetailPanel.vue) relies on the parent's
               v-if="selectedRaid" to guarantee the same precondition; without this v-if here,
               the child's onMounted would run before this page's onMounted (Vue3's lifecycle
               runs child before parent), and the snapshot panel would do its first load with
               the placeholder uuid='' and never retry, permanently landing on "unsupported". -->
          <SnapshotPanel v-if="detail" :volume-uuid="array.uuid ?? ''" />
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
            <!-- Rebuild ETA is a self-contained sentence (alternates between "~X remaining" and
                 "estimated to finish at..."), doesn't use the key/value two-column layout -->
            <div v-if="flags.isRebuilding && etaText" class="rd-row"><span class="rd-val" style="color: var(--accent)">{{ etaText }}</span></div>
            <div v-if="rebuildSpeed" class="rd-row"><span class="rd-key">{{ t('raidRebuildSpeed') }}</span><span class="rd-val" style="color: var(--accent)">{{ rebuildSpeed }}</span></div>
            <div v-if="showBtrfsRows" class="rd-row"><span class="rd-key">{{ t('raidBtrfsFreeEst') }}</span><span class="rd-val">{{ fmtSize(btrfsFreeBytes) }}</span></div>
            <div v-if="showBtrfsRows && btrfsCachedAtLabel" class="rd-row"><span class="rd-key">{{ t('raidBtrfsCachedAt') }}</span><span class="rd-val">{{ btrfsCachedAtLabel }}</span></div>
          </div>

          <div class="rd-card">
            <div class="rd-card-title">{{ membersTitle }}</div>
            <RaidMemberList
              :level="array.level"
              :members="members"
              :is-degraded="flags.isDegraded"
              @replace-disk="onReplaceRequested"
            />
          </div>
        </div>
      </div>
      </template>
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
.rd-recover {
  margin-left: auto; border: 1px solid var(--dem-fg); background: var(--chip-bg); color: var(--dem-fg);
  border-radius: 999px; padding: 5px 13px; font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.rd-recover:hover { background: var(--chip-bg-hi); }
.rd-recover:disabled { opacity: 0.6; cursor: not-allowed; }
.rd-recover + .rd-delete { margin-left: 0; }
.rd-delete {
  margin-left: auto; border: 1px solid var(--remove-fg); background: var(--chip-bg); color: var(--remove-fg);
  border-radius: 999px; padding: 5px 13px; font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.rd-delete:hover { background: var(--chip-bg-hi); }

.rd-loading { padding: 24px 4px; color: var(--fg-muted); font-size: 14px; }
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
