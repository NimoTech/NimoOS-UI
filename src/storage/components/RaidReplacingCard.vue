<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import type { ReplaceTask } from '../util/raidView'
import { useRaidEta } from '../composables/useRaidEta'

// 换盘进行中的看板卡。视觉照 RaidCreatingCard(同一套 spinner / 标签 / 进度条尺寸),
// 但进度来源不同:创建有后端任务的 step/progress,换盘没有 —— 后端换盘接口是同步的,
// 重建在内核里跑,只能读 status.rebuild_pct(详见 storage.ts replaceTask 处说明)。
//
// 因此进度是**混合**的两段:
//   rebuild_pct < 0(内核尚未接手/尚未开始报数)→ 与创建卡同款左右扫动的不确定条
//   rebuild_pct >= 0                          → 真实百分比条 + 数字 + 剩余时间 + 速度
// 不用"一律显示 0%",那在刚提交的几秒里看起来像卡死了。
const props = defineProps<{ task: ReplaceTask; status?: RaidStatus | null }>()
defineEmits<{ (e: 'dismiss'): void }>()
const { t } = useI18n()

const pct = computed(() => {
  const v = Number(props.status?.rebuild_pct)
  return Number.isFinite(v) ? v : -1
})
const hasPct = computed(() => pct.value >= 0)
const pctText = computed(() => `${Math.round(pct.value * 10) / 10}%`)
// 剩余时间:优先 rebuild_eta_seconds、5 秒交替时长/完成时刻;老后端回退内核原始串
const { etaText } = useRaidEta(() => props.status)
const speed = computed(() => (props.status?.rebuild_speed as string) || '')
</script>

<template>
  <article class="rpc-card">
    <div class="rpc-left"><div class="rpc-spinner" /></div>
    <div class="rpc-body">
      <div class="rpc-name">{{ task.arrayName }}</div>
      <div class="rpc-meta">
        {{ task.oldPath }} → {{ task.newPath }}
        <span v-if="etaText"> · {{ etaText }}</span>
        <span v-if="speed"> · {{ t('raidRebuildSpeed') }} {{ speed }}</span>
      </div>
    </div>
    <div class="rpc-right">
      <span class="rpc-tag">{{ t('raidReplacing') }}</span>
      <!-- 有真实百分比:确定态进度条 + 数字 -->
      <div v-if="hasPct" class="rpc-pctwrap">
        <div class="rpc-track"><div class="rpc-fill-det" :style="{ width: Math.min(100, Math.max(0, pct)) + '%' }" /></div>
        <span class="rpc-pct">{{ pctText }}</span>
      </div>
      <!-- 内核还没报数:不确定态扫动条(同创建卡) -->
      <div v-else class="rpc-track"><div class="rpc-fill-indet" /></div>
      <!-- 逃生门:重建万一挂住(内核没接手、盘再次掉线),看板不该永远转下去无法关闭。
           完成时卡片自动消失,不需要用户点这里 —— 这颗按钮只为卡死场景兜底。 -->
      <button class="rpc-dismiss" type="button" :title="t('raidReplacingDismiss')" @click="$emit('dismiss')">✕</button>
    </div>
  </article>
</template>

<style scoped>
.rpc-card {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--card-bg); border: 1px solid var(--accent-soft-bd); border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.rpc-left { flex: none; display: flex; }
.rpc-spinner {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 2.5px solid var(--accent-soft); border-top-color: var(--accent);
  animation: rpc-spin 0.9s linear infinite;
}
@keyframes rpc-spin { to { transform: rotate(360deg); } }
.rpc-body { flex: 1; min-width: 0; }
.rpc-name { font-size: 14px; font-weight: 600; color: var(--fg); margin-bottom: 3px; }
.rpc-meta {
  font-size: 11.5px; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rpc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: none; }
.rpc-tag {
  font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
  background: var(--nrm-bg); border: 1px solid var(--nrm-bd); color: var(--accent);
}
.rpc-pctwrap { display: flex; align-items: center; gap: 6px; }
.rpc-pct { font-size: 11px; font-weight: 700; color: var(--accent); font-family: var(--num-font); }
.rpc-track { width: 72px; height: 4px; border-radius: 2px; overflow: hidden; background: var(--accent-soft); }
.rpc-fill-det { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.4s var(--ease); }
.rpc-fill-indet { height: 100%; border-radius: 2px; background: var(--accent); animation: rpc-indeterminate 2s ease-in-out infinite; }
@keyframes rpc-indeterminate {
  0% { width: 0%; margin-left: 0%; }
  50% { width: 70%; margin-left: 15%; }
  100% { width: 0%; margin-left: 100%; }
}
.rpc-dismiss {
  background: transparent; border: none; cursor: pointer; font-size: 11px;
  padding: 2px 6px; border-radius: 3px; color: var(--fg-muted);
}
.rpc-dismiss:hover { background: var(--nrm-bg); color: var(--remove-fg); }
</style>
