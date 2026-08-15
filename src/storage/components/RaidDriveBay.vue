<script setup lang="ts">
// Ported from NimoOS-UI/src/components/Storage/raid/RaidDriveBay.vue (:16-21 filter/action
// section, :80-83 filteredDisks, :120-130 toggle/selectAllHealthy/clear, bottom summary bar).
// Selection state is now purely controlled via v-model (modelValue), instead of maintaining
// an internal selectedDisks + watch forwarder like Vue2 did.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { isDiskAtRisk, groupColorKey, diskSpecKey, type RaidDisk } from '../util/raidLevels'
import RaidDriveCard from './RaidDriveCard.vue'

const props = defineProps<{ disks: RaidDisk[]; modelValue: RaidDisk[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: RaidDisk[]): void }>()
const { t } = useI18n()

const filter = ref<'all' | 'ssd' | 'hdd'>('all')

const filteredDisks = computed(() => {
  if (filter.value === 'all') return props.disks
  const want = filter.value === 'ssd' ? 'SSD' : 'HDD'
  return props.disks.filter((d) => d.disk_type === want)
})

// Mixed-spec grouping (raidUtils.js groupDisksBySpec): builds groups in the order
// diskSpecKey first appears; only passes a group color to the card when there is more
// than one group (mixed specs) — a single-spec array does not need a color bar.
const specGroups = computed(() => {
  const seen = new Set<string>()
  const list: Array<{ key: string }> = []
  for (const d of props.disks) {
    const key = diskSpecKey(d)
    if (!seen.has(key)) {
      seen.add(key)
      list.push({ key })
    }
  }
  return list
})
const hasMixedSpecs = computed(() => specGroups.value.length > 1)
function groupKeyFor(disk: RaidDisk): string | undefined {
  return hasMixedSpecs.value ? groupColorKey(disk, specGroups.value) : undefined
}

function isSelected(disk: RaidDisk): boolean {
  return props.modelValue.some((d) => d.path === disk.path)
}

function toggle(disk: RaidDisk): void {
  if (isSelected(disk)) {
    emit('update:modelValue', props.modelValue.filter((d) => d.path !== disk.path))
  } else {
    emit('update:modelValue', [...props.modelValue, disk])
  }
}

function selectAllHealthy(): void {
  // The Vue2 source (RaidDriveBay.vue:128-130) takes healthy disks from the current
  // filtered view filteredDisks and replaces selectedDisks wholesale (not a union merge) —
  // matched verbatim; it does not operate on the full props.disks.
  emit('update:modelValue', filteredDisks.value.filter((d) => !isDiskAtRisk(d)))
}

function clear(): void {
  emit('update:modelValue', [])
}

const totalSelectedSize = computed(() => props.modelValue.reduce((a, d) => a + d.size, 0))
</script>

<template>
  <div class="rdb">
    <div class="rdb-tools">
      <div class="rdb-seg">
        <button
          type="button"
          class="rdb-seg-btn rdb-filter-all"
          :class="{ 'rdb-seg-btn--on': filter === 'all' }"
          @click="filter = 'all'"
        >{{ t('raidBayFilterAll') }}</button>
        <button
          type="button"
          class="rdb-seg-btn rdb-filter-ssd"
          :class="{ 'rdb-seg-btn--on': filter === 'ssd' }"
          @click="filter = 'ssd'"
        >SSD</button>
        <button
          type="button"
          class="rdb-seg-btn rdb-filter-hdd"
          :class="{ 'rdb-seg-btn--on': filter === 'hdd' }"
          @click="filter = 'hdd'"
        >HDD</button>
      </div>
      <button type="button" class="rdb-txt-btn rdb-select-all" @click="selectAllHealthy">
        {{ t('raidBaySelectAll') }}
      </button>
      <button type="button" class="rdb-txt-btn rdb-clear" @click="clear">
        {{ t('raidBayClear') }}
      </button>
    </div>

    <div class="rdb-grid">
      <RaidDriveCard
        v-for="disk in filteredDisks"
        :key="disk.path"
        :disk="disk"
        :selected="isSelected(disk)"
        :group-key="groupKeyFor(disk)"
        @toggle="toggle(disk)"
      />
    </div>

    <div class="rdb-summary">
      {{ t('raidBaySelected', { n: modelValue.length, size: fmtSize(totalSelectedSize) }) }}
    </div>
  </div>
</template>

<style scoped>
.rdb { display: flex; flex-direction: column; gap: 14px; }

.rdb-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.rdb-seg { display: inline-flex; background: var(--nrm-bg); border-radius: var(--chip-radius, 999px); padding: 2px; }
.rdb-seg-btn {
  border: 0; background: transparent; padding: 5px 12px; border-radius: 999px;
  font-size: 12px; color: var(--fg-muted); cursor: pointer;
}
.rdb-seg-btn--on { background: var(--card-bg); color: var(--fg); box-shadow: var(--card-shadow, none); }

.rdb-txt-btn { background: transparent; border: 0; color: var(--accent); font-size: 12px; cursor: pointer; }
.rdb-txt-btn:hover { text-decoration: underline; }

.rdb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}

.rdb-summary {
  padding-top: 12px;
  border-top: 1px solid var(--card-border);
  font-size: 13px;
  color: var(--fg-muted);
  font-family: var(--num-font);
}
</style>
