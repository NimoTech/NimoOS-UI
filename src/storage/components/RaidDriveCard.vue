<script setup lang="ts">
// 迁移自 NimoOS-UI/src/components/Storage/raid/RaidDriveCard.vue(整卡点击 toggle、
// 右上勾选圈 SVG √、容量/类型/风险标)。故障模拟器相关字段(temperature/power_on_time/
// model 的悬浮提示)按 raidLevels.ts 迁移范围说明推迟,未迁移。
import { computed } from 'vue'
import { fmtSize } from '../../home/util/format'
import { isDiskAtRisk, type RaidDisk } from '../util/raidLevels'

const props = defineProps<{ disk: RaidDisk; selected: boolean; groupKey?: string }>()
defineEmits<{ (e: 'toggle'): void }>()

// Vue2 assignGroupColors 的 5 色循环 → 组件层把语义 key 映射到既有 theme token(不新增 token)。
const GROUP_TOKEN_MAP: Record<string, string> = {
  'group-a': '--accent',
  'group-b': '--accent2',
  'group-c': '--sem-fg',
  'group-d': '--dem-fg',
  'group-e': '--nrm-fg',
}

const isSsd = computed(() => props.disk.disk_type === 'SSD')
const atRisk = computed(() => isDiskAtRisk(props.disk))
const groupToken = computed(() => (props.groupKey ? GROUP_TOKEN_MAP[props.groupKey] : undefined))
</script>

<template>
  <article
    class="rdc"
    :class="{ 'rdc--selected': selected, 'rdc--risk': atRisk }"
    @click="$emit('toggle')"
  >
    <div class="rdc-check" :class="{ 'rdc-check--on': selected }">
      <svg v-if="selected" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="rdc-icon" :class="isSsd ? 'rdc-icon--ssd' : 'rdc-icon--hdd'" aria-hidden="true">
      {{ isSsd ? 'SSD' : 'HDD' }}
    </div>

    <div class="rdc-name" :title="disk.path">{{ disk.path }}</div>

    <div class="rdc-meta">
      <span v-if="atRisk" class="rdc-risk-dot" aria-hidden="true"></span>
      <span class="rdc-cap">{{ fmtSize(disk.size) }}</span>
    </div>

    <div v-if="groupToken" class="rdc-stripe" :style="{ background: `var(${groupToken})` }"></div>
  </article>
</template>

<style scoped>
.rdc {
  position: relative;
  background: var(--card-bg);
  border: 1.5px solid var(--card-border);
  border-radius: var(--radius-xs);
  padding: 10px 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
}
.rdc:hover { transform: translateY(-1px); border-color: var(--accent); }
.rdc--selected { border: 2px solid var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rdc--risk { border-color: var(--remove-fg); }

.rdc-check {
  position: absolute; top: 7px; right: 7px;
  width: 16px; height: 16px; border-radius: 50%;
  border: 1.5px solid var(--chip-border); background: var(--card-bg);
  display: grid; place-items: center; color: var(--fg);
}
.rdc-check svg { width: 10px; height: 10px; }
.rdc-check--on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }

.rdc-icon {
  width: 36px; height: 40px; border-radius: 6px;
  background: var(--nrm-bg); border: 1px solid var(--nrm-bd);
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 3px;
  font-size: 7px; font-weight: 700; color: var(--nrm-fg); letter-spacing: 0.1em;
}

.rdc-name {
  font-size: 11px; font-weight: 600; color: var(--fg);
  text-align: center; max-width: 96px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 0 4px;
}

.rdc-meta { display: flex; align-items: center; gap: 4px; }
.rdc-risk-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--remove-fg); }
.rdc-cap { font-size: 10px; color: var(--fg-muted); }

.rdc-stripe {
  position: absolute; left: 6px; right: 6px; bottom: 4px;
  height: 3px; border-radius: 2px;
}
</style>
