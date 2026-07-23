<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidMemberDisk } from '@nimotech/nimoos-service'
import { memberSquare, mirrorPairs } from '../util/raidView'

// 后端在重建期间会给某些成员挂 rebuild_pct(RaidDetailPanel.vue L163),
// 但共享包 RaidMemberDisk 尚未声明该可选字段(见 NimoOS-Service/src/raid.ts)——
// 本地扩一层类型即可,不改共享包。
export type RaidMember = RaidMemberDisk & { rebuild_pct?: number }

const props = defineProps<{ level: number; members: RaidMember[] }>()
const { t } = useI18n()

const pairGroups = computed<RaidMember[][]>(() =>
  props.level === 10 ? (mirrorPairs(props.members) as RaidMember[][]) : [],
)

function dotStyle(state: string) {
  return { background: `var(${memberSquare(state).token})` }
}
// unknown 类(labelKey 为空)回退原始 state 字符串
function labelFor(m: RaidMember): string {
  const sq = memberSquare(m.state)
  return sq.labelKey ? t(sq.labelKey) : m.state
}
</script>

<template>
  <div class="rml">
    <template v-if="level === 10">
      <div v-for="(pair, pi) in pairGroups" :key="pi" class="rml-pair">
        <div v-for="(m, i) in pair" :key="i" class="rml-row">
          <span class="rml-dot" :style="dotStyle(m.state)"></span>
          <span class="rml-path">{{ m.path }}</span>
          <span class="rml-label">{{ labelFor(m) }}</span>
          <span v-if="m.rebuild_pct != null" class="rml-pct">{{ Math.round(m.rebuild_pct) }}%</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="(m, i) in members" :key="i" class="rml-row">
        <span class="rml-dot" :style="dotStyle(m.state)"></span>
        <span class="rml-path">{{ m.path }}</span>
        <span class="rml-label">{{ labelFor(m) }}</span>
        <span v-if="m.rebuild_pct != null" class="rml-pct">{{ Math.round(m.rebuild_pct) }}%</span>
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
</style>
