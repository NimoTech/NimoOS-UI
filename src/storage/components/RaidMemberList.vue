<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidMemberDisk } from '@nimotech/nimoos-service'
import { memberSquare, mirrorPairs } from '../util/raidView'

// 后端在重建期间会给某些成员挂 rebuild_pct(RaidDetailPanel.vue L163),
// 但共享包 RaidMemberDisk 尚未声明该可选字段(见 NimoOS-Service/src/raid.ts)——
// 本地扩一层类型即可,不改共享包。
export type RaidMember = RaidMemberDisk & { rebuild_pct?: number }

// isDegraded:复用父视图(StorageRaidDetail.vue)既有的 resolveRaidState().isDegraded 计算结果,
// 不在本组件内重复推导阵列级 degraded 状态(该判定跨 members 之外还看 array.state/isRebuilding 互斥,
// 详见 raidView.ts resolveRaidState)。
const props = defineProps<{ level: number; members: RaidMember[]; isDegraded?: boolean }>()
const emit = defineEmits<{ (e: 'replace-disk', diskPath: string): void }>()
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
// 严格对齐 Vue2 RaidTab.vue:238-251 openReplaceDisk 的判定(m.state === "faulty"),
// 不复用 memberSquare().kind==='fail'(它还把 'removed' 归为同类)——'removed' 盘不提供替换入口,
// 与 Vue2 行为一致。
function showReplace(m: RaidMember): boolean {
  return !!props.isDegraded && m.state === 'faulty'
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
          <button v-if="showReplace(m)" class="rml-replace" type="button" @click="emit('replace-disk', m.path)">
            {{ t('raidReplace') }}
          </button>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="(m, i) in members" :key="i" class="rml-row">
        <span class="rml-dot" :style="dotStyle(m.state)"></span>
        <span class="rml-path">{{ m.path }}</span>
        <span class="rml-label">{{ labelFor(m) }}</span>
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
