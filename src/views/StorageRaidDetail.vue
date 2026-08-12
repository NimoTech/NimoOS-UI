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

// 先 loadRaid() 拿阵列名/level(list 视图可能未跑过),再拉本阵列的 status/usage 详情。
//
// 必须先 clearRaidDetail():这两次请求是串行的,期间页面渲染的还是 store 里**上一次**
// 的快照。换完盘再点进详情页会看到换盘前那一帧(空槽位 + 故障盘,4 行成员),
// 看起来像替换没生效(2026-07-28 实盘验收发现)。
function reloadDetail() {
  store.clearRaidDetail()
  store.loadRaid().then(() => store.loadRaidDetail(idStr.value))
}
onMounted(reloadDetail)
// :id 变化时组件实例被路由复用、onMounted 不会再跑 —— 没有这个 watcher,从一个阵列
// 详情页跳到另一个阵列详情页会一直显示前一个阵列的数据(P3 遗留台账项)。
watch(idStr, reloadDetail)

// 换盘弹窗的候选盘来自 store.availDisks,而它只由 loadDrives() 填充。
// Vue2 的 RAID 区是一整个无路由面板,availableDisks 由父面板统一加载后当 prop
// 传给 RaidReplaceDisk(RaidTab.vue:50),所以弹窗永远有数据。New-UI 把详情页拆成
// 独立路由后漏了这次加载:直接打开/刷新 /storage/raid/:id 时 availDisks 为空,
// 「更换硬盘」下拉框只剩占位项、无法选盘(2026-07-28 实盘验收发现)。
// 先逛过存储卷/物理硬盘/创建页再进来反而有数据,所以这个缺口很容易漏检。
// 用 useDiskHotplug 而非裸 loadDrives():它 mount 即加载,并在磁盘热插拔时刷新候选盘
// —— 与 StorageRaidCreate.vue:33 同一模式。
useDiskHotplug(() => store.loadDrives())

// 只认属于当前路由 :id 的那份快照。清空 + watcher 已经覆盖了主要路径,这一道是
// 兜底:任何"store 里存着别的阵列的数据"的时机都不会被渲染出来。
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

// 收回成员盘任务是否属于本阵列。它必须与 isRebuilding **并联**当轮询开关:
// --re-add 后头几秒内核把盘登记成 spare、rebuild_pct 还是 -1,不算重建态,
// 只挂 isRebuilding 会一拍都不发请求,spare→recovering 过渡永远观察不到。
const reclaimActive = computed(() => store.reclaimTask?.arrayId === idStr.value)

// 重建中/收回进行中时 5000ms 单飞重拉详情(活体进度);否则不发请求。
// 收回任务在场时额外拉一次列表:reclaimTask 的完成判定挂在 loadRaid → syncReclaimTask
// 上,而本页平时只刷 raidDetail —— 不带上 loadRaid,停在详情页时任务永远收不了口。
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
// 重建剩余时间:优先 rebuild_eta_seconds(增量同步时内核的 rebuild_finish 按已拷贝
// 字节算、会膨胀到几周),每 5 秒交替时长/完成时刻;老后端回退内核原始串。
// etaText 是自足整句,详情表里占满一行,不配 key 列。
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
// 可收回的成员盘(后端仅在 degraded 且盘已插回时下发,见 service 包 RaidStatus 注释)。
// 非空即挂「收回成员盘」横幅 —— 摆在成员列表(换盘入口)之前:收回本阵列自己的盘是
// 便宜且正确的补救,换盘要清掉一块盘,不应让用户先看到破坏性的那条路。
const reattachable = computed(() => status.value?.reattachable_members || [])
async function onReclaim() {
  await store.reclaimRaidMembers(idStr.value)
  // toast/看板/详情刷新都在 store action 里;留在本页看成员行进入重建 —— 轮询由
  // reclaimActive 顶着(上方 useGuardedPoll),不依赖 isRebuilding。
}
// 表头计数用"有设备路径的行"而不是总行数:空槽位占位行不是一块盘,数进去会把
// 3 盘阵列在降级时写成 MEMBER DISKS (4)(见 raidView.ts memberDiskCount)。
const diskCount = computed(() => memberDiskCount(members.value))
// 但只写盘数又会出现"表头 (3)、下面 4 行"、看着像数错了。所以有空槽位时把两个数
// 都写出来(3 块 + 1 个空槽位 = 4 行,对得上);没有空槽位时不提,保持简洁。
// 只数**合并之后**还剩下的空槽位行:单块掉盘会被合并进坏盘那一行,不再算作空槽位,
// 表头因此回到简洁的「成员磁盘 (3)」并与 3 行对得上。RAID 6 双故障无法唯一配对、
// 不合并,那时才需要把空槽位数写出来(见 raidView.ts mergeVacatedSlot)。
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

// 换盘(P4 T7 + 2026-08-11 serial 语义):RaidMemberList 的 faulty/空槽位行 emit
// replace-disk(diskPath) → 本视图用 findReplaceTarget 识别被换的盘(在位 faulty 盘按
// 实时 path;拔掉的盘按 serial,陈旧缓存路径不当身份)→ 开弹窗;弹窗 emit
// confirm({newDiskPath, wipeResidue}) 才真正调 store(store 调用留在视图,不在弹窗内)。
const replaceOpen = ref(false)
const replaceTarget = ref<ReplaceTarget | null>(null)
function onReplaceRequested(diskPath: string) {
  const live = members.value
  const rows = (array.value.member_disks || []) as RaidMemberDiskRow[]
  // 用户点的是某一行:该行是在位 faulty 盘时按它建 target(多盘同时故障时不至于
  // 换错盘);空槽位行(diskPath 为空)或找不到时退回 findReplaceTarget 的通用识别。
  const clicked = diskPath ? live.find((m) => m.path === diskPath && m.state === 'faulty') : undefined
  const target = clicked
    ? { path: clicked.path, serial: clicked.serial || '', label: clicked.path }
    : findReplaceTarget(live, rows)
  if (!target) {
    // status 没拉到,或什么都不缺、不故障 —— 硬开弹窗只会让用户"替换"一个空白
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
  // 提交成功即退回列表页看进度(用户指定):重建是长活儿(真实硬盘可达数小时),
  // 列表页有换盘看板卡 + 5 秒轮询,比停在详情页干等更合适。
  // store.replaceTask 已在 replaceRaidDisk 里建立,若重建已完成则那一拍就已撤掉,
  // 列表页不会闪一张已完成的卡。
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

      <!-- 详情未就绪时显示加载态,而不是拿 fallbackArray 渲染一个"名称空、级别 0"的空壳。
           detail 为空只发生在两处:进页面/换 :id 后清空等重拉,以及 store 里存的是别的
           阵列的数据。两种情况都不该把不属于本页的内容摆出来。 -->
      <div v-if="!detail" class="rd-loading">{{ t('storageLoading') }}</div>

      <template v-else>
      <!-- 收回成员盘横幅:置于两栏(含成员列表的换盘入口)之前,主色调、非破坏性 -->
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

          <!-- v-if="detail" 门:SnapshotPanel 只在 raidDetail(array.uuid 真正加载完)后才挂载。
               Vue2(RaidDetailPanel.vue)靠父级 v-if="selectedRaid" 保证同款前提;这里若不设
               v-if,子组件 onMounted 早于本页 onMounted(Vue3 生命周期子先父后),快照面板会
               带着占位 uuid=''首次加载并再也不会重试,永远落"不支持"态。 -->
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
            <!-- 重建 ETA 是自足整句(剩余约 X / 预计…完成 交替),不走 key/value 两列 -->
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
