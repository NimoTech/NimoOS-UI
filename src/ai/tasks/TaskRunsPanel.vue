<!--
  Run history for one task. Ported 1:1 from Vue2 TaskRunsPanel.vue.
  Styles live in src/ai/styles/tasks.scss.
-->
<template>
  <div class="sk-section tsk-runs">
    <div class="sk-section-head">
      <div class="sk-section-title">{{ t('aiTasksRunHistory') }}</div>
      <div class="sk-section-hint">{{ runs.length }}</div>
      <button class="set-ibtn" :title="t('aiTasksRefresh')" @click="load()">
        <AgentIcon name="refresh" :size="15" />
      </button>
    </div>
    <div class="sk-section-body">
      <div v-if="loading && !runs.length" class="set-note">{{ t('aiTasksLoading') }}</div>
      <div v-else-if="!runs.length" class="set-note">{{ t('aiTasksNoRuns') }}</div>

      <div v-for="r in runs" :key="r.id" class="tsk-run">
        <div class="tsk-run-head" data-test="run-head" @click="toggle(r.id)">
          <span class="set-pill" :data-s="pill(r.status)">
            <span class="d"></span>{{ t(statusLabel(r.status)) }}
          </span>
          <span class="tsk-run-trig">{{ t(triggerLabel(r.trigger)) }}</span>
          <span class="tsk-run-time">{{ ts(r.created_at) }}</span>
          <span v-if="duration(r)" class="tsk-run-dur">{{
            t(duration(r)!.key, duration(r)!.params)
          }}</span>
          <span v-if="(r.denied_actions || []).length" class="tsk-run-denied">
            {{ t('aiTasksDeniedCount', { count: (r.denied_actions || []).length }) }}
          </span>
          <!-- How far the agent has got, without expanding anything. Fed by
               the transcript below, which streams whether or not it is open. -->
          <span v-if="liveLabel(r)" class="tsk-run-live">
            <span class="tsk-live-dots"><i /><i /><i /></span>{{ liveLabel(r) }}
          </span>
          <span class="tsk-run-chev" :data-open="expanded[r.id] ? 'true' : 'false'">
            <AgentIcon name="chev" :size="13" />
          </span>
        </div>

        <!-- Mounted for an in-flight run even while collapsed: the transcript
             owns the SSE stream that feeds the row's live progress, so
             unmounting it on collapse would blank the one indicator the user
             came for. `v-show` hides it; it keeps streaming. -->
        <div v-if="expanded[r.id] || isActive(r)" v-show="expanded[r.id]" class="tsk-run-body">
          <div v-if="r.summary" class="tsk-run-block">
            <div class="tsk-run-block-tt">{{ t('aiTasksRunSummary') }}</div>
            <!-- The summary is the agent's final reply — markdown, not plain
                 text. Rendered like the transcript's md blocks (.rt-md), so
                 lists/bold/code in a digest read as intended. The error block
                 below stays <pre>: errors are raw strings, and markdown-
                 rendering a traceback would mangle it. -->
            <div class="rt-md tsk-summary-md" data-test="run-summary">
              <MarkdownBlock :text="r.summary" />
            </div>
          </div>
          <div v-if="r.error" class="tsk-run-block">
            <div class="tsk-run-block-tt">{{ t('aiTasksRunError') }}</div>
            <pre class="tsk-pre err">{{ r.error }}</pre>
          </div>
          <div v-if="(r.denied_actions || []).length" class="tsk-run-block">
            <div class="tsk-run-block-tt">{{ t('aiTasksDeniedActions') }}</div>
            <div v-for="(d, i) in r.denied_actions" :key="i" class="tsk-denied-row">
              <span class="tsk-kind">{{ d.kind }}</span>
              <span class="tsk-detail mono">{{ d.detail }}</span>
              <button
                v-if="canAdopt(d.kind)"
                class="sk-btn ghost"
                data-test="adopt"
                :disabled="busyKey === r.id + ':' + i"
                @click="onAdopt(r, i)"
              >
                <AgentIcon name="plus" :size="12" /> {{ t('aiTasksAdoptAction') }}
              </button>
              <span v-else class="tsk-noadopt">{{ t('aiTasksAdoptUnsupported') }}</span>
            </div>
            <p v-if="hasAdoptable(r)" class="set-note">{{ t('aiTasksAdoptHint') }}</p>
          </div>
          <div class="tsk-run-block">
            <TaskRunTranscript :run="r" @progress="(p) => onProgress(r.id, p)" />
          </div>
          <!-- Only when there is genuinely nothing: a run with a session has a
               transcript block above that speaks for itself. -->
          <div
            v-if="!r.summary && !r.error && !(r.denied_actions || []).length && !r.session_id"
            class="set-note"
          >
            {{ t('aiTasksRunNoDetail') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import AgentIcon from '../components/icons/AgentIcon.vue'
import MarkdownBlock from '../components/blocks/MarkdownBlock.vue'
import TaskRunTranscript from './TaskRunTranscript.vue'
import {
  errorKey,
  formatTs,
  statusPill,
  durationText,
  canAdopt as canAdoptKind,
  type TaskRun,
} from './taskHelpers'

const { t } = useI18n()
const toast = useToast()

const props = withDefaults(defineProps<{ taskId?: string; pollIntervalMs?: number }>(), {
  taskId: '',
  // A queued run only becomes visible once the runner claims it, so poll fast
  // while something is in flight and not at all when the history is settled.
  pollIntervalMs: 5000,
})
const emit = defineEmits<{ (e: 'adopted'): void }>()

const RUNS_LIMIT = 50
const ACTIVE_STATUSES = new Set(['queued', 'running'])

const runs = ref<TaskRun[]>([])
const loading = ref(false)
const busyKey = ref('')
const expanded = ref<Record<string, boolean>>({})
const progress = ref<Record<string, { total: number; current: string; live: boolean }>>({})

const destroyed = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

async function load(silent = false) {
  if (!props.taskId) return
  loading.value = true
  try {
    const r = (await service.ai.listTaskRuns(props.taskId, RUNS_LIMIT)) as { runs?: TaskRun[] }
    runs.value = (r && r.runs) || []
  } catch (e) {
    if (!silent) showError(e)
  } finally {
    loading.value = false
  }
}

async function tick() {
  if (destroyed.value) {
    stopPolling()
    return
  }
  if (!props.taskId || !hasActive()) return
  await load(true)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function hasActive() {
  return (runs.value || []).some((r) => isActive(r))
}
function isActive(run: TaskRun) {
  return ACTIVE_STATUSES.has((run && run.status) || '')
}
function onProgress(runId: string, p: { total: number; current: string; live: boolean }) {
  progress.value[runId] = p
}
// The row's live indicator: "step 7 · web_fetch" while a tool is running,
// the bare step count between calls. Empty once the run is over — the
// status pill and duration already say what happened.
function liveLabel(run: TaskRun): string {
  if (!isActive(run)) return ''
  const p = progress.value[run.id]
  if (!p) return ''
  // Attached, but the model has not produced anything yet. On a local
  // model that first stretch is minutes long, and an empty row there reads
  // as "nothing is happening" — which is the complaint this whole feature
  // answers. Say that it started.
  if (!p.total) return p.live ? t('aiTasksTranscriptStarting') : ''
  return p.current
    ? t('aiTasksRunStepAt', { n: p.total, tool: p.current })
    : t('aiTasksTranscriptSteps', { n: p.total })
}

function toggle(runId: string) {
  expanded.value[runId] = !expanded.value[runId]
}

// Folds one denied action into the task's preauth. The backend derives the
// rule (host without port, the directory of a denied file, the command head
// as a prefix), so the UI only has to name the run and the index.
async function onAdopt(run: TaskRun, index: number) {
  busyKey.value = run.id + ':' + index
  try {
    await service.ai.adoptDeniedAction(props.taskId, run.id, index)
    toast.show(t('aiTasksAdopted'))
    emit('adopted')
    await load(true)
  } catch (e) {
    showError(e)
  } finally {
    busyKey.value = ''
  }
}

// Only these kinds can be folded into a preauth document; the button is
// hidden for the rest rather than left to 400 on click. See canAdopt().
function canAdopt(kind: unknown) {
  return canAdoptKind(kind)
}
// The adopt hint explains a button; with nothing adoptable in this run it
// would be describing an action the user cannot take.
function hasAdoptable(run: TaskRun) {
  return ((run && run.denied_actions) || []).some((d) => canAdoptKind(d && d.kind))
}
function ts(v: unknown) {
  return formatTs(v)
}
function pill(status: string | undefined) {
  return statusPill(status)
}
function duration(run: TaskRun) {
  return durationText(run)
}
function statusLabel(status: string | undefined): string {
  const map: Record<string, string> = {
    queued: 'aiTasksStatusQueued',
    running: 'aiTasksStatusRunning',
    succeeded: 'aiTasksStatusSucceeded',
    failed: 'aiTasksStatusFailed',
    timeout: 'aiTasksStatusTimeout',
    skipped: 'aiTasksStatusSkipped',
  }
  return map[status || ''] || 'aiTasksStatusUnknown'
}
function triggerLabel(trigger: string | undefined): string {
  const map: Record<string, string> = {
    cron: 'aiTasksRunTriggerCron',
    interval: 'aiTasksRunTriggerInterval',
    webhook: 'aiTasksRunTriggerWebhook',
    manual: 'aiTasksRunTriggerManual',
  }
  return map[trigger || ''] || 'aiTasksStatusUnknown'
}
function showError(e: unknown) {
  toast.show(t(errorKey(e)), 3000, 'danger')
}

// Selecting another task reuses this component instance, so the previous
// task's expanded rows would otherwise leak into the new history.
watch(
  () => props.taskId,
  () => {
    expanded.value = {}
    progress.value = {}
    runs.value = []
    void load()
  },
)

onMounted(() => {
  timer = setInterval(tick, props.pollIntervalMs)
})
onBeforeUnmount(() => {
  destroyed.value = true
  stopPolling()
})

void load()

defineExpose({ load })
</script>
