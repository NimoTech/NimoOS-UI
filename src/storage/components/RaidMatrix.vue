<!-- 故障模拟器 P4 决策2 推迟 -->
<!--
  迁移自 NimoOS-UI/src/components/Storage/raid/RaidMatrix.vue(:12-121 矩阵主体)。
  只迁矩阵本身(Layout/Min drives/Survives/Capacity/Read/Write/Cost/Best for/Actions 九行 × 5 级别列)。
  明确不迁 Vue2 源 :123-200 的故障模拟器 modal(openModal/failDrive/modalStatus/rebuildAll/resetModal
  及 survival() 判定),也不迁顶部图例(rm__legend)与 recommendedLevel 推荐徽章 —— 均超出本任务契约
  (props 只有 diskCount/sizeBytes/selectedLevel)。
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { RAID_LEVELS, type RaidLevelSpec, type RaidRole } from '../util/raidLevels'

const props = defineProps<{ diskCount: number; sizeBytes: number; selectedLevel: number | null }>()
const emit = defineEmits<{
  (e: 'update:selectedLevel', id: number): void
  (e: 'details', id: number): void
}>()
const { t } = useI18n()

const levels = RAID_LEVELS

// Vue2 源 isAvailable(RaidMatrix.vue:244-246):RAID 10 需要 >=4 且为偶数盘,其余按 lv.min 判定。
function isAvailable(lv: RaidLevelSpec): boolean {
  if (lv.id === 10) return props.diskCount >= 4 && props.diskCount % 2 === 0
  return props.diskCount >= lv.min
}

// Vue2 源 diskLayout(RaidMatrix.vue:255-258):盘数不足时仍按 lv.min 预览布局,而非空白。
function diskLayout(lv: RaidLevelSpec): RaidRole[] {
  const n = Math.max(isAvailable(lv) ? props.diskCount : lv.min, lv.min)
  return lv.layout(n)
}

// Vue2 源 capPct(RaidMatrix.vue:248-254),这里 sizeBytes 是调用方已算好的单盘有效容量(非磁盘数组)。
function capPct(lv: RaidLevelSpec): number {
  const n = props.diskCount
  const s = props.sizeBytes
  if (n === 0 || s === 0) return 0
  const used = lv.capacity(n, s)
  return Math.round((used / (n * s)) * 100)
}

function selectLevel(lv: RaidLevelSpec): void {
  if (isAvailable(lv)) emit('update:selectedLevel', lv.id)
}
</script>

<template>
  <div class="rm">
    <div class="rm-grid">
      <div class="rm-lbl rm-lbl--corner"></div>
      <div
        v-for="lv in levels"
        :key="lv.id"
        class="rm-col"
        :class="{ 'rm-col--selected': lv.id === selectedLevel, 'rm-col--dim': !isAvailable(lv) }"
      >
        <div class="rm-col-title">{{ lv.name }}</div>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixLayout') }}</div>
      <div
        v-for="lv in levels"
        :key="'layout-' + lv.id"
        class="rm-cell rm-cell--viz"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <div class="rm-disks">
          <span v-for="(role, i) in diskLayout(lv)" :key="i" class="rm-disk" :class="`rm-disk--${role}`"></span>
        </div>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixMinDrives') }}</div>
      <div
        v-for="lv in levels"
        :key="'min-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >{{ lv.min }}</div>

      <div class="rm-lbl">{{ t('raidMatrixSurvives') }}</div>
      <div
        v-for="lv in levels"
        :key="'tol-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <span class="rm-pill">{{ t(`raidLevel${lv.id}Tolerance`) }}</span>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixCapacity') }}</div>
      <div
        v-for="lv in levels"
        :key="'cap-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <template v-if="isAvailable(lv) && sizeBytes > 0">
          {{ fmtSize(lv.capacity(diskCount, sizeBytes)) }}
          <span class="rm-cap-pct"> · {{ capPct(lv) }}%</span>
        </template>
        <template v-else>—</template>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixRead') }}</div>
      <div
        v-for="lv in levels"
        :key="'read-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <div class="rm-meter">
          <span v-for="i in 5" :key="i" class="rm-pip" :class="{ 'rm-pip--on': i <= lv.read }"></span>
        </div>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixWrite') }}</div>
      <div
        v-for="lv in levels"
        :key="'write-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <div class="rm-meter">
          <span v-for="i in 5" :key="i" class="rm-pip" :class="{ 'rm-pip--on': i <= lv.write }"></span>
        </div>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixCost') }}</div>
      <div
        v-for="lv in levels"
        :key="'cost-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <div class="rm-meter">
          <span v-for="i in 5" :key="i" class="rm-pip" :class="{ 'rm-pip--on': i <= lv.cost }"></span>
        </div>
      </div>

      <div class="rm-lbl">{{ t('raidMatrixBestFor') }}</div>
      <div
        v-for="lv in levels"
        :key="'use-' + lv.id"
        class="rm-cell"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel, 'rm-cell--dim': !isAvailable(lv) }"
      >
        <span class="rm-usecase">{{ t(`raidLevel${lv.id}Usecase`) }}</span>
      </div>

      <div class="rm-lbl rm-lbl--action"></div>
      <div
        v-for="lv in levels"
        :key="'act-' + lv.id"
        class="rm-cell rm-cell--action"
        :class="{ 'rm-cell--selected': lv.id === selectedLevel }"
      >
        <button type="button" class="rm-btn rm-btn--primary rm-select" :disabled="!isAvailable(lv)" @click="selectLevel(lv)">
          {{ t('raidMatrixSelect') }}
        </button>
        <button type="button" class="rm-btn rm-btn--ghost rm-details" @click="emit('details', lv.id)">
          {{ t('raidMatrixDetails') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rm { position: relative; }

.rm-grid {
  display: grid;
  grid-template-columns: minmax(96px, 140px) repeat(5, minmax(0, 1fr));
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--card-bg);
}

.rm-lbl {
  padding: 10px 12px;
  border-bottom: 1px solid var(--card-border);
  border-right: 1px solid var(--card-border);
  background: var(--nrm-bg);
  color: var(--fg-muted);
  font-size: 11.5px;
  display: flex;
  align-items: center;
}
.rm-lbl--corner { background: transparent; }
.rm-lbl--action { border-bottom: 0; }

.rm-col {
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--card-border);
  border-right: 1px solid var(--card-border);
  text-align: center;
  transition: background 0.15s;
}
.rm-col:last-child { border-right: 0; }
.rm-col--selected { background: var(--accent-soft); }
.rm-col--dim { opacity: 0.55; }
.rm-col-title { font-size: 15px; font-weight: 600; color: var(--fg); letter-spacing: -0.01em; }

.rm-cell {
  padding: 10px 12px;
  border-bottom: 1px solid var(--card-border);
  border-right: 1px solid var(--card-border);
  font-size: 12.5px;
  color: var(--fg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  min-height: 44px;
}
.rm-cell:last-child { border-right: 0; }
.rm-cell--selected { background: var(--accent-soft); }
.rm-cell--dim { opacity: 0.55; }
.rm-cell--viz { min-height: 60px; }
.rm-cell--action { padding: 10px 8px; border-bottom: 0; gap: 6px; align-items: stretch; }

.rm-disks { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
.rm-disk { width: 12px; height: 22px; border-radius: 3px; }
.rm-disk--data { background: var(--accent); }
.rm-disk--mirror { background: var(--sem-fg); }
.rm-disk--parity { background: var(--dem-fg); }
.rm-disk--parity2 { background: var(--remove-fg); }

.rm-pill {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: var(--nrm-bg);
  color: var(--nrm-fg);
  border: 1px solid var(--nrm-bd);
}

.rm-cap-pct { font-size: 11px; color: var(--fg-muted); font-weight: 400; }
.rm-usecase { font-size: 11px; color: var(--fg-muted); line-height: 1.4; }

.rm-meter { display: inline-flex; gap: 3px; }
.rm-pip { width: 6px; height: 10px; border-radius: 2px; background: var(--nrm-bg); }
.rm-pip--on { background: var(--accent); }

.rm-btn {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--chip-border);
  background: var(--card-bg);
  color: var(--fg);
  text-align: center;
  transition: background 0.15s;
}
.rm-btn:hover:not(:disabled) { background: var(--hover); }
.rm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rm-btn--primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.rm-btn--primary:hover:not(:disabled) { background: var(--accent-text); }
.rm-btn--ghost { background: transparent; border-color: transparent; color: var(--fg-muted); }
.rm-btn--ghost:hover { color: var(--fg); }
</style>
