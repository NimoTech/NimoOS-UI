<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AppCategory } from '@nimotech/nimoos-service'
import { ALL } from '../stores/appstore'

defineProps<{ categories: AppCategory[]; current: string }>()
defineEmits<{ select: [name: string] }>()
const { t } = useI18n()
</script>

<template>
  <div class="cate-bar">
    <button
      class="cate-chip" :class="{ active: current === ALL }"
      type="button" @click="$emit('select', ALL)"
    >{{ t('appsStoreAll') }}</button>
    <button
      v-for="c in categories" :key="c.name"
      class="cate-chip" :class="{ active: current === c.name }"
      type="button" @click="$emit('select', c.name)"
    >{{ c.name }} <span class="cate-count">{{ c.count }}</span></button>
  </div>
</template>

<style scoped>
/* 桌面:横向滚动 chips;分类名照 Vue2 原样直出(第三方源分类不可枚举) */
.cate-bar { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
/* 窄屏:改多行换行(对齐 files 区工具栏做法)——横向溢出在手机上会把过滤项挡在屏外 */
@media (max-width: 768px) {
  .cate-bar { flex-wrap: wrap; overflow-x: visible; }
}
.cate-chip {
  flex: 0 0 auto; font-size: 12.5px; padding: 5px 12px; cursor: pointer;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border);
  border-radius: 999px;
}
.cate-chip:hover { background: var(--chip-bg-hi); }
.cate-chip.active { color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent-soft-bd); }
.cate-count { color: var(--fg-muted); font-size: 11px; }
</style>
