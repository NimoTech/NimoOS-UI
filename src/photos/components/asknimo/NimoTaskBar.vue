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
  firstError?: TaskBusPayload
}

const taskGroups = computed<TaskGroup[]>(() => {
  const byType = new Map<string, TaskBusPayload[]>()
  for (const task of tasks.value) {
    const key = task.type || 'other'
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push(task)
  }
  const groups: TaskGroup[] = []
  for (const [type, list] of byType) {
    // Preflight F-28: named `task` (not `t`) throughout this function -- `t` shadowing
    // useI18n()'s own `t` inside this closure has no functional effect (nothing here calls
    // i18n), but it invites future maintenance mistakes, so it's renamed defensively.
    const running = list.filter((task) => task.status !== 'done')
    const hasError = list.some((task) => !!task.error)
    const firstError = list.find((task) => !!task.error)
    if (running.length === 0) {
      groups.push({ type, current: 0, total: 0, progress: 1, hasError, firstError })
      continue
    }
    let runCur = 0, runTot = 0, progSum = 0, withTotal = 0
    for (const task of running) {
      if (typeof task.total === 'number' && task.total > 0) {
        runCur += task.current || 0
        runTot += task.total
        withTotal += 1
      } else {
        progSum += task.progress || 0
      }
    }
    const progress = runTot > 0 ? runCur / runTot : (running.length - withTotal > 0 ? progSum / (running.length - withTotal) : 0)
    groups.push({ type, current: runCur, total: runTot, progress, hasError, firstError })
  }
  return groups.sort((a, b) => (TYPE_META[a.type]?.order ?? 99) - (TYPE_META[b.type]?.order ?? 99))
})

const firstError = computed(() => taskGroups.value.find((g) => g.hasError)?.firstError)

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
