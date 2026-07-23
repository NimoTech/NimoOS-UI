<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus, RaidMemberDisk } from '@nimotech/nimoos-service'
import { fmtSize } from '../../home/util/format'
import { usageLevel } from '../util/storageMap'
import {
  resolveRaidState, raidSeverity, raidStateLabelKey, countActiveDisks,
  memberSquare, raidUsagePercent, type RaidArray,
} from '../util/raidView'

const props = defineProps<{ array: RaidArray; status?: RaidStatus }>()
defineEmits<{ (e: 'select'): void }>()
const { t } = useI18n()

const flags = computed(() => resolveRaidState(props.array, props.status))
const severity = computed(() => raidSeverity(flags.value))
const labelKey = computed(() => raidStateLabelKey(flags.value))
const members = computed<RaidMemberDisk[]>(() => props.status?.members || [])
const total = computed(() => Number(props.status?.total_bytes) || 0)
const used = computed(() => Number(props.status?.used_bytes) || 0)
const pct = computed(() => raidUsagePercent(used.value, total.value))
const totalDisks = computed(() => members.value.length || (props.array.member_disks?.length ?? 0))
const activeDisks = computed(() => countActiveDisks(members.value, totalDisks.value))
const rebuildPct = computed(() => Math.round((Number(props.status?.rebuild_pct) || 0) * 10) / 10)
const squares = computed(() => members.value.map((m) => ({ ...memberSquare(m.state), path: m.path })))
</script>

<template>
  <article class="raid-card" @click="$emit('select')">
    <div class="rc-head">
      <h3 class="rc-name">{{ array.name }} <span class="rc-level">RAID {{ array.level }}</span></h3>
      <span class="rc-badge" :class="severity">{{ t(labelKey) }}</span>
    </div>
    <div class="rc-squares">
      <span v-for="(s, i) in squares" :key="i" class="rc-sq" :class="s.kind"
        :style="{ color: `var(${s.token})` }" :title="s.path">{{ s.glyph }}</span>
    </div>
    <p class="rc-usage">{{ fmtSize(used) }} / {{ fmtSize(total) }}
      <span class="rc-online">· {{ t('raidDisksOnline', { n: activeDisks, total: totalDisks }) }}</span></p>
    <div class="rc-track"><div class="rc-fill" :class="usageLevel(pct)" :style="{ width: Math.min(100, Math.max(0, pct)) + '%' }" /></div>
    <p v-if="flags.isRebuilding" class="rc-rebuild">
      {{ t('raidStateRebuilding') }} {{ rebuildPct }}%
      <span v-if="status?.rebuild_finish"> · {{ t('raidRebuildFinish') }} {{ status.rebuild_finish }}</span>
      <span v-if="status?.rebuild_speed"> · {{ t('raidRebuildSpeed') }} {{ status.rebuild_speed }}</span>
    </p>
  </article>
</template>

<style scoped>
.raid-card { padding: 16px 18px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); cursor: pointer; }
.raid-card + .raid-card { margin-top: 12px; }
.raid-card:hover { background: var(--hover); }
.rc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rc-name { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.rc-level { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd); }
.rc-badge { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--nrm-bg); border: 1px solid var(--nrm-bd); }
.rc-badge.ok { color: var(--sem-fg); }
.rc-badge.info { color: var(--accent); }
.rc-badge.warning { color: var(--dem-fg); }
.rc-badge.danger { color: var(--remove-fg); }
.rc-squares { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0 6px; font-size: 12px; }
.rc-sq { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; background: var(--nrm-bg); border: 1px solid var(--nrm-bd); }
.rc-usage { margin: 6px 0; font-size: 12.5px; color: var(--fg-muted); font-family: var(--num-font); }
.rc-online { color: var(--fg-muted); }
.rc-track { height: 6px; border-radius: 999px; background: var(--nrm-bg); overflow: hidden; }
.rc-fill { height: 100%; border-radius: 999px; }
.rc-fill.ok { background: var(--accent); }
.rc-fill.warn { background: var(--dem-fg); }
.rc-fill.danger { background: var(--remove-fg); }
.rc-rebuild { margin: 8px 0 0; font-size: 12px; color: var(--accent); }
</style>
