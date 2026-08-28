<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidMemberDisk } from '@nimotech/nimoos-service'
import { memberRow, mirrorPairs, mergeVacatedSlot, type MemberRowView } from '../util/raidView'

// The backend attaches rebuild_pct to some members during a rebuild (RaidDetailPanel.vue L163),
// but the shared package's RaidMemberDisk hasn't declared this optional field yet (see
// the shared service package's src/raid.ts) — just extending the type locally is enough, no need to change the shared package.
export type RaidMember = RaidMemberDisk & { rebuild_pct?: number }

// isDegraded: reuse the parent view's (StorageRaidDetail.vue) existing resolveRaidState().isDegraded
// result, rather than re-deriving array-level degraded state inside this component (that
// determination also weighs array.state/isRebuilding mutual exclusivity beyond just members —
// see raidView.ts resolveRaidState).
const props = defineProps<{ level: number; members: RaidMember[]; isDegraded?: boolean }>()
const emit = defineEmits<{ (e: 'replace-disk', diskPath: string): void }>()
const { t } = useI18n()

// A single drive dropping out is reported by mdadm as two rows (the vacated slot + the drive
// kicked out of the slot). When the pairing is unique they're merged into one row — see
// raidView.ts mergeVacatedSlot — after merging, a 3-disk array with 1 bad disk shows 3 rows, not what looks like 4 disks.
const rows = computed<MemberRowView[]>(() => mergeVacatedSlot(props.members))

const pairGroups = computed<MemberRowView[][]>(() =>
  props.level === 10 ? mirrorPairs(rows.value) : [],
)
// Rows that don't occupy a slot and can't enter any mirror pair (an ejected-and-unmerged faulty
// disk, an idle hot spare, or every row when an older backend doesn't report slot at all) — laid
// out flat after the mirror pairs, rather than being stuffed into the wrong pair or disappearing
// silently. With an older backend (no slot), pairGroups is empty and leftover = all rows, so it
// naturally falls back to flat rendering.
const leftoverRows = computed<MemberRowView[]>(() => {
  if (props.level !== 10) return []
  const paired = new Set(pairGroups.value.flat())
  return rows.value.filter((m) => !paired.has(m))
})

// Goes through memberRow (mapping dedicated to detail rows), not memberSquare (dedicated to card
// squares): the latter groups removed and faulty together into the failure tier, and copying that
// into the detail row would mislabel an empty slot as "faulty". See the comments on
// raidView.ts memberSquare/memberRow.
function dotStyle(state: string) {
  return { background: `var(${memberRow(state).token})` }
}
// When labelKey is empty (unknown state), fall back to the raw state string — matches Vue2 memberStateLabel's fallback
function labelFor(m: MemberRowView): string {
  const row = memberRow(m.state)
  return row.labelKey ? t(row.labelKey) : m.state
}
// path is empty only for a removed empty slot (the backend's pkg/mdadm ParseDetail produces
// Path="", Number=slot number for mdadm --detail's "-  0  0  N  removed" line). Vue2 renders
// this blank, which reads like a broken ghost-disk row — not replicated; show the slot number
// instead, to say "the disk that was in this position is gone."
function pathFor(m: MemberRowView): string {
  // Merged row: state clearly both "which slot is empty" and "which disk went bad"
  if (m.vacatedSlot != null) return `${t('raidMemberSlot', { n: m.vacatedSlot })} · ${m.path}`
  return m.path || t('raidMemberSlot', { n: m.number })
}
// The merged row's status text additionally calls out "ejected," explaining why the slot is empty (originally explained via a separate row)
function labelForRow(m: MemberRowView): string {
  if (m.vacatedSlot != null) return t('raidMemberFaultyEjected')
  return labelFor(m)
}
// An in-place faulty disk keeps its replace entry as before; an empty slot (removed, path empty)
// also gets a replace entry — a physically pulled disk has no faulty row, only this placeholder
// row remains, and without an entry point the user could never replace it (Vue2's replace entry
// point lives at the array level and naturally covers this case; New-UI's lives on the member
// row, so it must be added here). The emitted path is an empty string, and the parent view
// (StorageRaidDetail) uses findReplaceTarget to identify the pulled disk by serial.
function showReplace(m: MemberRowView): boolean {
  if (!props.isDegraded) return false
  return m.state === 'faulty' || (m.state === 'removed' && !m.path)
}
</script>

<template>
  <div class="rml">
    <template v-if="level === 10">
      <div v-for="(pair, pi) in pairGroups" :key="pi" class="rml-pair">
        <div v-for="(m, i) in pair" :key="i" class="rml-row">
          <span class="rml-dot" :style="dotStyle(m.state)"></span>
          <span class="rml-path">{{ pathFor(m) }}</span>
          <span class="rml-label">{{ labelForRow(m) }}</span>
          <span v-if="m.rebuild_pct != null" class="rml-pct">{{ Math.round(m.rebuild_pct) }}%</span>
          <button v-if="showReplace(m)" class="rml-replace" type="button" @click="emit('replace-disk', m.path)">
            {{ t('raidReplace') }}
          </button>
        </div>
      </div>
      <div v-for="(m, i) in leftoverRows" :key="`loose-${i}`" class="rml-row">
        <span class="rml-dot" :style="dotStyle(m.state)"></span>
        <span class="rml-path">{{ pathFor(m) }}</span>
        <span class="rml-label">{{ labelForRow(m) }}</span>
        <span v-if="m.rebuild_pct != null" class="rml-pct">{{ Math.round(m.rebuild_pct) }}%</span>
        <button v-if="showReplace(m)" class="rml-replace" type="button" @click="emit('replace-disk', m.path)">
          {{ t('raidReplace') }}
        </button>
      </div>
    </template>
    <template v-else>
      <div v-for="(m, i) in rows" :key="i" class="rml-row">
        <span class="rml-dot" :style="dotStyle(m.state)"></span>
        <span class="rml-path">{{ pathFor(m) }}</span>
        <span class="rml-label">{{ labelForRow(m) }}</span>
        <span v-if="m.rebuild_pct != null" class="rml-pct">{{ Math.round(m.rebuild_pct) }}%</span>
        <button v-if="showReplace(m)" class="rml-replace" type="button" @click="emit('replace-disk', m.path)">
          {{ t('raidReplace') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rml-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--card-border);
  font-size: 12.5px;
}
.rml-row:last-child { border-bottom: none; }
.rml-pair { border-bottom: 1px solid var(--card-border); }
.rml-pair:last-child { border-bottom: none; }
.rml-pair .rml-row:last-child { border-bottom: none; }
.rml-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.rml-path { font-family: var(--num-font); font-weight: 500; }
.rml-label { color: var(--fg-muted); }
.rml-pct { margin-left: auto; font-weight: 600; color: var(--accent); }
.rml-replace {
  margin-left: auto; padding: 3px 11px; border-radius: 999px; border: 1px solid var(--remove-fg);
  background: var(--chip-bg); color: var(--remove-fg); cursor: pointer; font-size: 11.5px;
}
.rml-replace:hover { background: var(--chip-bg-hi); }
</style>
