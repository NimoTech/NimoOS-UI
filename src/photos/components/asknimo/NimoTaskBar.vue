<!-- Background task progress strip for Ask Nimo. Pixel source: Vue2 NimoOS-UI
     src/views/Photos/NimoTaskBar.vue + photos.scss:4398-4426 (collapsed strip, already ported)
     + this plan's Task 5 addition (expanded per-type breakdown, photos.scss:4427-4460, re-transcribed
     from NimoTaskBar.vue's own <style scoped>:111-157). Reads the SAME `tasks` list the rest of
     Photos already polls via useTimelineStore() -- this is the identical data Vue2 read off
     Vuex `photos/tasks`.
     No <style> block: pixel coverage comes entirely from parity scss (Constraints #12). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimelineStore } from '../../stores/timeline'
import type { TaskBusPayload } from '../../util/taskBus'

const props = defineProps<{ expanded: boolean }>()
const emit = defineEmits<{ (e: 'update:expanded', v: boolean): void }>()
const { t } = useI18n()
const timeline = useTimelineStore()

const tasks = computed(() => timeline.tasks as TaskBusPayload[])

const TYPE_META: Record<string, { order: number; labelKey: string }> = {
  index: { order: 1, labelKey: 'photosTaskIndexing' },
  embedding: { order: 2, labelKey: 'photosTaskEmbedding' },
  ocr: { order: 3, labelKey: 'photosTaskOcr' },
  face: { order: 4, labelKey: 'photosTaskFace' },
  rebuild: { order: 5, labelKey: 'photosTaskRebuild' },
  aesthetic: { order: 6, labelKey: 'photosTaskAesthetic' },
}
function groupLabel(type: string): string {
  const meta = TYPE_META[type]
  return meta ? t(meta.labelKey) : type
}

interface TaskGroup {
  type: string
  current: number
  total: number
  progress: number
  hasError: boolean
}

// Byte-exact port of Vue2 NimoTaskBar.vue:61-100 (taskGroups computed). Running (non-done)
// tasks' current/total are summed UNCONDITIONALLY into the group -- there is no per-task
// "only fold in tasks that report a total" branch; a task with total===0 still contributes
// 0 to runTot, same as Vue2's `g.runTot += t.total || 0`. The progress-average fallback
// (runProgSum / runCount) only kicks in once the WHOLE group's summed total is 0, not per task.
const taskGroups = computed<TaskGroup[]>(() => {
  interface Acc { type: string; runCur: number; runTot: number; runProgSum: number; runCount: number; hasError: boolean }
  const byType = new Map<string, Acc>()
  for (const task of tasks.value) {
    const type = task.type || 'other'
    let acc = byType.get(type)
    if (!acc) {
      acc = { type, runCur: 0, runTot: 0, runProgSum: 0, runCount: 0, hasError: false }
      byType.set(type, acc)
    }
    if (task.error) acc.hasError = true
    if (task.status !== 'done') {
      acc.runCount++
      acc.runCur += task.current || 0
      acc.runTot += task.total || 0
      acc.runProgSum += task.progress || 0
    }
  }
  const groups: TaskGroup[] = []
  for (const acc of byType.values()) {
    if (acc.runCount > 0) {
      groups.push({
        type: acc.type,
        current: acc.runCur,
        total: acc.runTot,
        progress: acc.runTot > 0 ? acc.runCur / acc.runTot : acc.runProgSum / acc.runCount,
        hasError: acc.hasError,
      })
    } else {
      groups.push({ type: acc.type, current: 0, total: 0, progress: 1, hasError: acc.hasError })
    }
  }
  return groups.sort((a, b) => (TYPE_META[a.type]?.order ?? 99) - (TYPE_META[b.type]?.order ?? 99))
})

// Byte-exact port of Vue2 NimoTaskBar.vue:52 -- a flat scan of the RAW task list in array
// order (NOT grouped/sorted by type). With simultaneous errors across two types, the
// displayed error line must be whichever task appears first in the raw list, regardless of
// that type's sort position in taskGroups.
const firstError = computed(() => tasks.value.find((task) => !!task.error))

function groupPct(g: TaskGroup): number {
  return Math.round(g.progress * 100)
}
function errorDetailText(task: TaskBusPayload): string {
  return task.errorKey ? t(task.errorKey, (task.errorParams as Record<string, unknown>) || {}) : (task.error || '')
}

function toggle(): void {
  emit('update:expanded', !props.expanded)
}
</script>

<template>
  <div v-if="tasks.length > 0" class="nimo-tb">
    <div class="nimo-tb-top" @click="toggle">
      <span class="nimo-tb-dot" />
      <span class="nimo-tb-label">{{ t('photosBackgroundTasksCount', { n: tasks.length }) }}</span>
      <span class="nimo-tb-chev" :data-open="expanded">⌄</span>
    </div>
    <div v-if="expanded" class="nimo-tb-types">
      <div v-for="g in taskGroups" :key="g.type" class="nimo-tb-type" :class="{ 'has-error': g.hasError }">
        <div class="nimo-tb-type-head">
          <span class="nimo-tb-type-icon"><span v-if="g.hasError" class="nimo-tb-row-alert">!</span></span>
          <span class="nimo-tb-type-label">{{ groupLabel(g.type) }}</span>
          <span class="nimo-tb-type-pct">
            <template v-if="g.hasError">{{ t('photosTaskFailed') }}</template>
            <template v-else>{{ groupPct(g) }}%<span v-if="g.total > 0" class="nimo-tb-type-count"> · {{ g.current }}/{{ g.total }}</span></template>
          </span>
        </div>
        <div class="nimo-tb-bar"><i :style="{ width: groupPct(g) + '%' }" /></div>
      </div>
      <div v-if="firstError" class="nimo-tb-error-detail">{{ errorDetailText(firstError) }}</div>
    </div>
  </div>
</template>
