<!--
  RAID 创建向导(P4 T5)。迁移自 NimoOS-UI RaidCreateWizard.vue(2 步:选盘+级别 / 确认),
  组装 T1(RAID_LEVELS/recommendRaidLevel)、T3(RaidDriveBay)、T4(RaidMatrix)已完成的零件。

  与 Vue2 源的两处刻意简化(缩小本任务范围,非遗漏):
  1) 不迁移 selectedDisks 变化时的"自动挑推荐级别"watch —— 该行为会在磁盘数满足任意
     级别时持续把 selectedLevel 拉回一个可行值,导致"盘数 < 所选级别 min → 禁用确认"
     这条契约明确要求的场景永远无法触发(推荐函数对 n>=2 恒能给出可行级别)。
     级别推荐只保留 ⭐ 徽章(装饰),级别选择改为纯手动(快捷卡/矩阵点击)。
  2) 不迁移混规格容量警告/故障容错文案说明等纯装饰性文案 —— 已有 RaidDriveBay/RaidMatrix
     承担对应可视化,此页只负责编排 + 请求体组装。
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import Dialog from '../components/ui/Dialog.vue'
import RaidDriveBay from '../storage/components/RaidDriveBay.vue'
import RaidMatrix from '../storage/components/RaidMatrix.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useDiskHotplug } from '../composables/useDiskHotplug'
import { fmtSize } from '../home/util/format'
import { computeNextStorageName, DEFAULT_STORAGE_NAME } from '../storage/util/storageNaming'
import { RAID_LEVELS, recommendRaidLevel, type RaidLevelSpec, type RaidDisk } from '../storage/util/raidLevels'

const store = useStorageStore()
const router = useRouter()
const { t } = useI18n()

// 候选盘复用创建单盘存储向导同一来源(GET /v1/disks 的 avail 字段);
// AvailDisk(path/name/model/size/needFormat/serial)结构上满足 RaidDisk(disk_type/health 均为可选字段)。
useDiskHotplug(() => store.loadDrives())
const candidateDisks = computed<RaidDisk[]>(() => store.availDisks)
const hasNoDisk = computed(() => candidateDisks.value.length === 0)

const currentStep = ref<0 | 1>(0)
const selectedDisks = ref<RaidDisk[]>([])
const selectedLevel = ref<number | null>(null)
const showMatrix = ref(false)
const arrayName = ref('')
const arrayNameTouched = ref(false)
const selectedFilesystem = ref<'btrfs' | 'ext4'>('btrfs')
const enableSnapshots = ref(true)
const confirmOpen = ref(false)

const isBtrfs = computed(() => selectedFilesystem.value === 'btrfs')
const diskCount = computed(() => selectedDisks.value.length)
const minDiskSize = computed(() => (diskCount.value ? Math.min(...selectedDisks.value.map((d) => d.size)) : 0))
const quickLevels = RAID_LEVELS
const currentLevel = computed<RaidLevelSpec | null>(() => RAID_LEVELS.find((l) => l.id === selectedLevel.value) ?? null)
// raidUtils.js 无 <2 盘前置校验(P1 raidLevels.ts 迁移笔记),由向导自己在选盘阶段兜底。
const recommendedLevel = computed(() => (diskCount.value >= 2 ? recommendRaidLevel(diskCount.value) : null))

// RAID 10 需要 >=4 且为偶数盘(RaidMatrix.vue isAvailable 同款判定),其余按 lv.min。
function levelMinOk(lv: RaidLevelSpec, n: number): boolean {
  if (lv.id === 10) return n >= 4 && n % 2 === 0
  return n >= lv.min
}
function isCardAvailable(lv: RaidLevelSpec): boolean {
  return levelMinOk(lv, diskCount.value)
}
function cardCapacity(lv: RaidLevelSpec): string {
  if (!isCardAvailable(lv) || minDiskSize.value === 0) return '—'
  return fmtSize(lv.capacity(diskCount.value, minDiskSize.value))
}

const canProceed = computed(
  () => diskCount.value >= 2 && !!currentLevel.value && levelMinOk(currentLevel.value, diskCount.value),
)
const canCreate = computed(
  () =>
    !!arrayName.value.trim() &&
    !!currentLevel.value &&
    levelMinOk(currentLevel.value, diskCount.value) &&
    !store.raidCreating,
)

// RAID 名与存储名共享命名空间(Vue2 existingRaidNames 同款合并)。
const existingNames = computed(() =>
  [...store.raidArrays.map((a) => a.name), ...store.volumes.map((v) => v.name)].filter(Boolean),
)
const defaultName = computed(() => computeNextStorageName(DEFAULT_STORAGE_NAME, existingNames.value))
watch(
  defaultName,
  (v) => {
    if (!arrayNameTouched.value) arrayName.value = v
  },
  { immediate: true },
)

function selectQuickLevel(lv: RaidLevelSpec): void {
  if (isCardAvailable(lv)) selectedLevel.value = lv.id
}
function onLevelSelected(id: number): void {
  selectedLevel.value = Number(id)
}
function onNameInput(e: Event): void {
  arrayNameTouched.value = true
  const el = e.target as HTMLInputElement
  const cleaned = el.value.replace(/[^a-zA-Z0-9_-]/g, '')
  arrayName.value = cleaned
  el.value = cleaned
}
function goNext(): void {
  if (canProceed.value) currentStep.value = 1
}
function goBack(): void {
  if (currentStep.value === 0) router.push('/storage/raid')
  else currentStep.value = 0
}
function openConfirm(): void {
  if (canCreate.value) confirmOpen.value = true
}
async function doCreate(): Promise<void> {
  confirmOpen.value = false
  const body = {
    name: arrayName.value,
    level: selectedLevel.value!,
    disk_paths: selectedDisks.value.map((d) => d.path),
    chunk_kb: 512 as const,
    filesystem: selectedFilesystem.value,
    enable_snapshots: isBtrfs.value ? enableSnapshots.value : false,
  }
  const task = await store.createRaid(body)
  if (task) {
    store.startCreateTask(task)
    router.push('/storage/raid')
  }
}
</script>

<template>
  <StorageShell>
    <div class="rcv">
      <div class="rcv-steps">
        <span class="rcv-step" :class="{ 'rcv-step--on': currentStep === 0 }">{{ t('raidCreateStepDrives') }}</span>
        <span class="rcv-step-sep"></span>
        <span class="rcv-step" :class="{ 'rcv-step--on': currentStep === 1 }">{{ t('raidCreateStepConfirm') }}</span>
      </div>

      <template v-if="currentStep === 0">
        <p v-if="hasNoDisk" class="rcv-nodisk">{{ t('raidCreateNoDisk') }}</p>
        <RaidDriveBay v-else :disks="candidateDisks" v-model="selectedDisks" />

        <div class="rcv-divider"></div>
        <div class="rcv-sec-title">{{ t('raidCreateChooseLevel') }}</div>

        <div class="rcv-lv-grid">
          <div
            v-for="lv in quickLevels"
            :key="lv.id"
            class="rcv-lv-card"
            :data-level="lv.id"
            :class="{ 'rcv-lv-card--selected': selectedLevel === lv.id, 'rcv-lv-card--unavail': !isCardAvailable(lv) }"
            @click="selectQuickLevel(lv)"
          >
            <div v-if="lv.id === recommendedLevel && selectedLevel !== lv.id" class="rcv-lv-rec">⭐ {{ t('raidCreateRecommended') }}</div>
            <div class="rcv-lv-name">{{ lv.name }}</div>
            <div class="rcv-lv-usecase">{{ lv.usecase }}</div>
            <div class="rcv-lv-cap-label">{{ t('raidMatrixCapacity') }}</div>
            <div class="rcv-lv-cap">{{ cardCapacity(lv) }}</div>
          </div>
        </div>

        <button type="button" class="rcv-matrix-toggle" @click="showMatrix = !showMatrix">
          {{ showMatrix ? t('raidCreateCollapseMatrix') : t('raidCreateExpandMatrix') }}
        </button>
        <RaidMatrix
          v-if="showMatrix"
          :diskCount="diskCount"
          :sizeBytes="minDiskSize"
          :selectedLevel="selectedLevel"
          @update:selectedLevel="onLevelSelected"
        />
      </template>

      <template v-else>
        <div class="rcv-sum-box">
          <div class="rcv-sum-title">{{ t('raidCreateSelectedDrives') }} ({{ diskCount }})</div>
          <div class="rcv-chip-list">
            <span v-for="d in selectedDisks" :key="d.path" class="rcv-chip">{{ d.path }} · {{ fmtSize(d.size) }}</span>
          </div>
        </div>

        <div v-if="currentLevel" class="rcv-sum-box">
          <div class="rcv-sum-title">{{ t('raidCreateConfig') }}</div>
          <div class="rcv-sum-raid-name">{{ currentLevel.name }}</div>
          <div class="rcv-spec-row"><span>{{ t('raidMatrixMinDrives') }}</span><span>{{ currentLevel.min }}</span></div>
          <div class="rcv-spec-row"><span>{{ t('raidMatrixSurvives') }}</span><span>{{ t(`raidLevel${currentLevel.id}Tolerance`) }}</span></div>
          <div class="rcv-spec-row">
            <span>{{ t('raidCreateEstCapacity') }}</span>
            <span>{{ minDiskSize > 0 ? fmtSize(currentLevel.capacity(diskCount, minDiskSize)) : '—' }}</span>
          </div>
        </div>

        <div class="rcv-form-row">
          <div class="field">
            <label class="rcv-label">{{ t('raidCreateName') }}</label>
            <input class="rcv-name-input" type="text" :value="arrayName" @input="onNameInput" />
          </div>
          <div class="field">
            <label class="rcv-label">{{ t('raidCreateFilesystem') }}</label>
            <select class="rcv-fs-select" v-model="selectedFilesystem">
              <option value="btrfs">btrfs</option>
              <option value="ext4">ext4</option>
            </select>
          </div>
        </div>

        <label v-if="isBtrfs" class="rcv-snapshot">
          <input type="checkbox" class="rcv-snapshot-checkbox" v-model="enableSnapshots" />
          {{ t('raidCreateSnapshot') }}
        </label>
        <p v-if="isBtrfs" class="rcv-snapshot-hint">{{ t('raidCreateSnapshotHint') }}</p>
      </template>

      <div class="rcv-footer">
        <button type="button" class="rcv-back" @click="goBack">{{ t('raidCreateBack') }}</button>
        <button
          v-if="currentStep === 0"
          type="button"
          class="rcv-next"
          :disabled="!canProceed"
          @click="goNext"
        >{{ t('raidCreateNext') }}</button>
        <button
          v-else
          type="button"
          class="rcv-confirm"
          :disabled="!canCreate"
          @click="openConfirm"
        >{{ t('raidCreateConfirmBtn') }}</button>
      </div>

      <Dialog :open="confirmOpen" :title="t('raidCreateConfirmTitle')" @update:open="confirmOpen = $event">
        <p class="rcv-confirm-msg">{{ t('raidCreateConfirmMsg', { level: selectedLevel, name: arrayName, n: diskCount }) }}</p>
        <template #footer>
          <button type="button" class="rcv-dialog-cancel" @click="confirmOpen = false">{{ t('storageCancel') }}</button>
          <button type="button" class="rcv-dialog-create" :disabled="store.raidCreating" @click="doCreate">
            {{ t('raidCreateConfirmOk') }}
          </button>
        </template>
      </Dialog>
    </div>
  </StorageShell>
</template>

<style scoped>
.rcv { display: flex; flex-direction: column; gap: 16px; }

.rcv-steps { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-muted); }
.rcv-step { padding: 4px 12px; border-radius: 999px; background: var(--nrm-bg); }
.rcv-step--on { background: var(--accent); color: var(--on-accent); }
.rcv-step-sep { width: 16px; height: 1px; background: var(--card-border); }

.rcv-nodisk { padding: 24px 4px; color: var(--fg-muted); font-size: 14px; }

.rcv-divider { height: 1px; background: var(--card-border); margin: 4px 0; }
.rcv-sec-title { font-size: 13px; font-weight: 600; color: var(--fg); }

.rcv-lv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.rcv-lv-card {
  position: relative;
  border: 1.5px solid var(--card-border);
  border-radius: var(--radius-xs);
  padding: 12px 12px 10px;
  cursor: pointer;
  background: var(--card-bg);
}
.rcv-lv-card--selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rcv-lv-card--unavail { opacity: 0.45; cursor: not-allowed; }
.rcv-lv-rec {
  position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: 700;
  padding: 3px 8px; border-radius: 999px; background: var(--accent); color: var(--on-accent);
}
.rcv-lv-name { font-size: 15px; font-weight: 700; color: var(--fg); }
.rcv-lv-usecase { font-size: 11px; color: var(--fg-muted); margin: 4px 0 8px; line-height: 1.4; }
.rcv-lv-cap-label { font-size: 10px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.rcv-lv-cap { font-size: 18px; font-weight: 700; color: var(--fg); }

.rcv-matrix-toggle {
  align-self: flex-start; background: transparent; border: none; color: var(--accent);
  font-size: 12px; cursor: pointer; padding: 0;
}
.rcv-matrix-toggle:hover { text-decoration: underline; }

.rcv-sum-box {
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
}
.rcv-sum-title { font-size: 10px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.rcv-chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
.rcv-chip { background: var(--nrm-bg); border-radius: 8px; padding: 4px 8px; font-size: 11px; color: var(--fg); }
.rcv-sum-raid-name { font-size: 18px; font-weight: 700; color: var(--fg); }
.rcv-spec-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 4px 0; border-bottom: 1px solid var(--card-border); }
.rcv-spec-row:last-child { border-bottom: none; }

.rcv-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rcv-label { display: block; margin-bottom: 6px; font-size: 12.5px; color: var(--fg-muted); }
.rcv-name-input, .rcv-fs-select {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.rcv-snapshot { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--fg); }
.rcv-snapshot-hint { font-size: 11px; color: var(--fg-muted); margin: -4px 0 0 24px; }

.rcv-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--card-border); }
.rcv-back, .rcv-next, .rcv-confirm {
  padding: 7px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rcv-next, .rcv-confirm { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.rcv-next:disabled, .rcv-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
.rcv-back:hover { background: var(--chip-bg-hi); }

.rcv-confirm-msg { margin: 0; font-size: 14px; color: var(--fg); }
.rcv-dialog-cancel, .rcv-dialog-create {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rcv-dialog-create { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.rcv-dialog-create:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
