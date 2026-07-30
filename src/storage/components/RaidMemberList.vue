<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidMemberDisk } from '@nimotech/nimoos-service'
import { memberRow, mirrorPairs, mergeVacatedSlot, type MemberRowView } from '../util/raidView'

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

// 一次掉盘被 mdadm 报成两行(腾空的槽位 + 被踢出槽位的坏盘)。配对唯一时合并成一行,
// 详见 raidView.ts mergeVacatedSlot —— 合并后 3 盘阵列坏 1 块就是 3 行,不再像 4 块盘。
const rows = computed<MemberRowView[]>(() => mergeVacatedSlot(props.members))

const pairGroups = computed<MemberRowView[][]>(() =>
  props.level === 10 ? (mirrorPairs(rows.value as never) as MemberRowView[][]) : [],
)

// 走 memberRow(详情行专用映射),不是 memberSquare(卡片方块专用):后者把
// removed 与 faulty 同归红色 fail,详情行照抄会把空槽位标成「故障」。详见
// raidView.ts memberSquare/memberRow 的注释。
function dotStyle(state: string) {
  return { background: `var(${memberRow(state).token})` }
}
// labelKey 为空(未知态)时回退原始 state 字符串,与 Vue2 memberStateLabel 兜底一致
function labelFor(m: MemberRowView): string {
  const row = memberRow(m.state)
  return row.labelKey ? t(row.labelKey) : m.state
}
// path 为空只发生在 removed 空槽位(后端 pkg/mdadm ParseDetail 对 mdadm --detail
// 的 "-  0  0  N  removed" 行产出 Path=""、Number=槽位号)。Vue2 此处渲染空白,
// 读起来像一行残缺的幽灵盘 —— 不照抄,改显示槽位号,说明"这个位置的盘不在了"。
function pathFor(m: MemberRowView): string {
  // 合并行:同时说清"哪个槽位空了"和"是哪块盘坏了"
  if (m.vacatedSlot != null) return `${t('raidMemberSlot', { n: m.vacatedSlot })} · ${m.path}`
  return m.path || t('raidMemberSlot', { n: m.number })
}
// 合并行的状态文案额外点出"已弹出",解释槽位为什么空着(原本是靠单独一行说明的)
function labelForRow(m: MemberRowView): string {
  if (m.vacatedSlot != null) return t('raidMemberFaultyEjected')
  return labelFor(m)
}
// 严格对齐 Vue2 RaidTab.vue:238-251 openReplaceDisk 的判定(m.state === "faulty"):
// 'removed' 盘不提供替换入口(它没有设备路径可传给换盘接口),与 Vue2 行为一致。
function showReplace(m: MemberRowView): boolean {
  return !!props.isDegraded && m.state === 'faulty'
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
