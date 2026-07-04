<!-- src/files/components/OperationStatusBar.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFileOpsStore } from '../stores/fileOps'
import { taskPercent, type FileTask } from '../util/fileOps'

const ops = useFileOpsStore()
const { t } = useI18n()

function label(task: FileTask): string {
  return task.type === 'copy' ? t('filesOpCopy') : t('filesOpMove')
}
// 只显示文件名,不泄漏 /DATA 全路径
function baseName(p: string): string {
  return p.split('/').filter(Boolean).pop() || p
}
</script>

<template>
  <div v-if="ops.visible" class="op-status-bar">
    <div class="op-head">
      <span class="op-title">{{ t('filesTasksTitle') }}</span>
      <button class="op-cancel-all" @click="ops.cancelAll()">{{ t('filesCancelAll') }}</button>
    </div>
    <div v-for="task in ops.active" :key="task.id" class="op-task">
      <div class="op-task-line">
        <span class="op-task-label">{{ label(task) }}</span>
        <span class="op-task-name">{{ baseName(task.processing_path) }}</span>
        <span class="op-task-pct">{{ taskPercent(task) }}%</span>
      </div>
      <div class="op-progress"><div class="op-progress-fill" :style="{ width: taskPercent(task) + '%' }"></div></div>
    </div>
  </div>
</template>

<style scoped>
.op-status-bar {
  /* bottom-LEFT so it never overlaps the upload panel (bottom-right); they used
     to share the exact same corner + z-index and covered each other. */
  position: fixed; left: 24px; bottom: 24px; z-index: 60; width: 340px; max-width: calc(100vw - 48px);
  padding: 12px 14px; border-radius: 16px;
  background: var(--popup-bg, rgba(20,23,35,0.96)); border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  backdrop-filter: blur(20px); box-shadow: 0 18px 48px rgba(0,0,0,0.5); color: var(--fg);
}
.op-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.op-title { font-size: 13px; font-weight: 600; }
.op-cancel-all { padding: 3px 10px; border-radius: 999px; border: 1px solid color-mix(in srgb, #ff5d5d 45%, transparent); background: transparent; color: #ff8a8a; cursor: pointer; font-size: 12px; }
.op-cancel-all:hover { background: color-mix(in srgb, #ff5d5d 22%, transparent); }
.op-task { margin-top: 8px; }
.op-task-line { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
.op-task-label { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); }
.op-task-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-task-pct { flex: 0 0 auto; color: var(--fg-muted, #9aa4bf); }
.op-progress { height: 6px; border-radius: 999px; background: var(--chip-bg, rgba(255,255,255,0.1)); overflow: hidden; }
.op-progress-fill { height: 100%; background: var(--accent, #6ea8fe); transition: width .2s; }
</style>
