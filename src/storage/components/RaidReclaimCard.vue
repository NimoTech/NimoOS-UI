<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidReattachableMember } from '@nimotech/nimoos-service'

// 「收回成员盘」横幅卡:阵列 degraded 且 status.reattachable_members 非空时,由父视图
// (StorageRaidDetail)挂在成员列表/换盘入口**之前** —— 收回是把阵列自己的盘拉回来
// (mdadm --re-add 位图增量同步),便宜且正确;换盘要清空一块盘 + 全量重建。所以这张卡
// 走主色调(accent 主按钮),与换盘入口的警示红(--remove-fg)在视觉上明确区分。
//
// role / last_update / serial 来自成员超块(mdadm 原样字符串)—— 只经 {{ }} 插值渲染,
// 不拼 HTML(不可信外部字符串,红线)。
const props = defineProps<{ members: RaidReattachableMember[]; busy?: boolean }>()
defineEmits<{ (e: 'reclaim'): void }>()
const { t } = useI18n()

// 展示身份首选 serial:拔插后设备字母可能被复用,path 只对在位盘可信(同 raidReplace.ts
// 的事故教训);盘没有序列号(serial 为 '')时才退回 path。
const serials = computed(() => props.members.map((m) => m.serial || m.path).join(', '))
</script>

<template>
  <article class="rrc-card">
    <div class="rrc-body">
      <p class="rrc-hint">{{ t('raidReclaimHint', { serials }) }}</p>
      <ul class="rrc-list">
        <li v-for="(m, i) in members" :key="i" class="rrc-row">
          <span class="rrc-id">{{ m.serial || m.path }}</span>
          <span v-if="m.serial && m.path" class="rrc-path">{{ m.path }}</span>
          <span class="rrc-meta">{{ m.role }} · {{ t('raidReclaimLastSync') }} {{ m.last_update }}</span>
        </li>
      </ul>
    </div>
    <button class="rrc-btn" type="button" :disabled="busy" @click="$emit('reclaim')">
      {{ t('raidReclaimBtn') }}
    </button>
  </article>
</template>

<style scoped>
.rrc-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: var(--card-bg); border: 1px solid var(--accent-soft-bd); border-radius: var(--radius-sm);
  margin-bottom: 14px;
}
.rrc-body { flex: 1; min-width: 0; }
.rrc-hint { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--accent-text); }
.rrc-list { list-style: none; margin: 0; padding: 0; }
.rrc-row { display: flex; align-items: baseline; gap: 10px; font-size: 12px; padding: 2px 0; flex-wrap: wrap; }
.rrc-id { font-family: var(--num-font); font-weight: 600; color: var(--fg); }
.rrc-path { font-family: monospace; color: var(--fg-muted); }
.rrc-meta { color: var(--fg-muted); }
/* 主按钮:accent 实底 —— 与成员行「更换硬盘」的警示红描边按钮在视觉层级上拉开 */
.rrc-btn {
  flex: none; border: none; border-radius: 999px; padding: 7px 16px;
  background: var(--accent); color: var(--on-accent);
  font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.rrc-btn:hover { background: var(--accent2); }
.rrc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
