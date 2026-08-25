<!--
  One run's execution process, read-only.
  Ported 1:1 from Vue2 src/views/AI/Tasks/TaskRunTranscript.vue.

  Three data paths, picked from the run's own status:
    running/queued  → SSE `/run-stream`, live-tailed as it happens
    finished        → `/messages`, the persisted turn
    failed          → `/messages` is empty (the turn was never saved), so the
                      same `/run-stream` endpoint replays the event log and the
                      transcript stops exactly where the run died

  Nothing here can act on the run. A task's permission cards were answered by
  the run driver long before this panel opened them, so they render as
  statements, not buttons. (The Vue2 original provided an inert agentStore for
  injected chat blocks; this port renders MarkdownBlock directly with a text
  prop, which injects nothing, so no inert store is needed.)

  Styles live in src/ai/styles/tasks.scss (zero-<style> convention).
-->
<template>
  <div class="rt">
    <!-- no session yet: the runner has not claimed this run -->
    <div v-if="phase === 'waiting'" class="rt-note">
      <span class="rt-dots"><i /><i /><i /></span>
      <span>{{ t('aiTasksTranscriptWaiting') }}</span>
    </div>

    <div v-else-if="phase === 'loading'" class="rt-note">
      <span class="rt-dots"><i /><i /><i /></span>
      <span>{{ t('aiTasksLoading') }}</span>
    </div>

    <div v-else-if="phase === 'pruned'" class="rt-note">
      <AgentIcon name="trash" :size="14" />
      <span>{{ t('aiTasksTranscriptPruned') }}</span>
    </div>

    <div v-else-if="phase === 'empty'" class="rt-note">
      <span>{{ t('aiTasksTranscriptEmpty') }}</span>
    </div>

    <div v-else-if="phase === 'error'" class="rt-note">
      <span>{{ t(errKey) }}</span>
      <button class="rt-retry" @click="reload">{{ t('aiTasksRetry') }}</button>
    </div>

    <template v-else>
      <div class="rt-head" @click="open = !open">
        <span class="rt-chev" :data-open="open ? 'true' : 'false'">
          <AgentIcon name="chev" :size="13" />
        </span>
        <span class="rt-title">{{ t('aiTasksTranscriptTitle') }}</span>
        <span v-if="isLive" class="rt-badge live">
          <i class="rt-live-dot" />{{ t('aiTasksTranscriptLive') }}
        </span>
        <span v-else-if="phase === 'replayed'" class="rt-badge">
          {{ t('aiTasksTranscriptPartial') }}
        </span>
        <span class="rt-counts">{{ countsLabel }}</span>
      </div>

      <div v-show="open" class="rt-items">
        <template v-for="(item, i) in items">
          <!-- process rail -->
          <div v-if="item.kind === 'process'" :key="'p' + i" class="rt-rail">
            <div
              v-for="(s, j) in item.steps"
              :key="j"
              class="rt-step"
              :data-open="isOpen(i, j) ? 'true' : 'false'"
            >
              <div class="rt-step-line" @click="toggleStep(i, j)">
                <span class="rt-step-ic" :data-kind="s.kind" :data-state="s.state">
                  <span v-if="s.state === 'running'" class="rt-dots run"><i /><i /><i /></span>
                  <AgentIcon v-else-if="s.state === 'error'" name="x" :size="12" />
                  <AgentIcon v-else-if="s.kind === 'think'" name="sparkle" :size="13" />
                  <AgentIcon v-else name="settings" :size="12" />
                </span>
                <span class="rt-step-name">{{
                  s.kind === 'think' ? t('aiTasksTranscriptThinking') : s.name
                }}</span>
                <span v-if="s.detail" class="rt-step-detail mono">{{ s.detail }}</span>
                <span class="rt-step-meta">{{
                  s.state === 'running' ? t('aiTasksStatusRunning') : durationOf(s)
                }}</span>
                <span class="rt-step-chev"><AgentIcon name="chev" :size="12" /></span>
              </div>
              <div v-if="isOpen(i, j)" class="rt-step-body">
                <div v-if="s.kind === 'think'" class="rt-think">
                  {{ s.detail || t('aiTasksTranscriptNoDetail') }}
                </div>
                <template v-else-if="(s.sections || []).length">
                  <div v-for="(sec, k) in s.sections" :key="k" class="rt-sec">
                    <div class="rt-sec-label">{{ sec.label }}</div>
                    <div class="rt-code">{{ sec.code }}</div>
                  </div>
                </template>
                <div v-else class="rt-think">{{ t('aiTasksTranscriptNoDetail') }}</div>
              </div>
            </div>
          </div>

          <!-- a permission gate the run driver answered -->
          <div v-else-if="item.kind === 'gate'" :key="'g' + i" class="rt-gate">
            <AgentIcon name="lock" :size="13" />
            <span class="rt-gate-label">{{ item.label }}</span>
            <span class="rt-gate-detail mono">{{ item.detail }}</span>
            <span class="rt-gate-tag">{{ t('aiTasksTranscriptGateAuto') }}</span>
          </div>

          <div v-else-if="item.kind === 'note'" :key="'n' + i" class="rt-note warn">
            <span v-if="item.noteKey === 'maxTurns'">{{
              t('aiTasksTranscriptMaxTurns', item.params)
            }}</span>
            <span v-else>{{ t('aiTasksTranscriptMcpWarning', item.params) }}</span>
          </div>

          <div v-else-if="item.kind === 'md'" :key="'m' + i" class="rt-md">
            <MarkdownBlock :text="item.text" />
            <span v-if="item.streaming" class="rt-caret" />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AgentIcon from '../components/icons/AgentIcon.vue'
import MarkdownBlock from '../components/blocks/MarkdownBlock.vue'
import { attachAgentStream } from '../services/agentTransport'
import { formatMs } from '../services/streamMappers'
import type { AgentMessage } from '../types'
import {
  createTranscriptSink,
  transcriptItems,
  transcriptProgress,
  historyBlocks,
  withStepTimings,
  type RailStep,
  type TranscriptSink,
} from './runTranscript'
import { errorKey } from './taskHelpers'
import type { TaskRun } from './taskHelpers'

const { t } = useI18n()

const props = defineProps<{ run: TaskRun }>()
const emit = defineEmits<{
  (e: 'progress', p: { total: number; done: number; current: string; live: boolean }): void
}>()

const ACTIVE = new Set(['queued', 'running'])

const sink = shallowRef<TranscriptSink>(createTranscriptSink())
const phase = ref('loading')
const errKey = ref('')
const open = ref(ACTIVE.has(props.run.status || ''))
const openSteps = ref<Record<string, boolean>>({})

let abortCtl: AbortController | null = null
const destroyed = ref(false)

// The sink's state is reactive; touching messages/steps through the shallowRef
// keeps the computed below tracking both the sink swap and its contents.
const items = computed(() =>
  withStepTimings(transcriptItems(sink.value.state.messages), sink.value.state.steps),
)
const hasItems = computed(() => items.value.length > 0)
const isLive = computed(() => phase.value === 'live')
const progress = computed(() => ({
  ...transcriptProgress(sink.value.state),
  live: isLive.value,
}))
const countsLabel = computed(() => {
  // Count from the rendered rail, not sink.state.steps: state.steps is fed
  // only by live SSE activity events, so a finished run replayed from
  // /messages always read "0 steps" while the rail below showed dozens.
  // Live equivalence holds because withStepTimings zips state.steps onto
  // tool-kind rail steps 1:1 — tool-kind count IS the live step count.
  let steps = 0
  let think = 0
  for (const it of items.value) {
    if (it.kind !== 'process') continue
    for (const s of it.steps as RailStep[]) {
      if (s.kind === 'think') think++
      else steps++
    }
  }
  const parts = [t('aiTasksTranscriptSteps', { n: steps })]
  if (think) parts.push(t('aiTasksTranscriptThoughts', { n: think }))
  return parts.join(' · ')
})

// The row above needs the live step count whether or not this body is
// visible, so the progress is pushed up rather than read down.
watch(progress, (v) => emit('progress', v), { immediate: true })

// A run row is reused as the history reloads (5s poll): when the id under
// it changes, everything collected so far belongs to another run.
watch(
  () => props.run.id,
  () => reload(),
)
// queued → running is when the session id appears.
watch(
  () => props.run.session_id,
  (next, prev) => {
    if (next && !prev) reload()
  },
)
// A run that finished between the last poll and this component mounting
// looks active here, so `attach` gets a 204 and lands on 'empty'. Once the
// poll corrects the status, read the persisted turn instead of leaving
// "no execution log" on screen for a run that has one.
watch(
  () => props.run.status,
  (next, prev) => {
    if (prev && ACTIVE.has(prev) && !ACTIVE.has(next || '') && !hasItems.value) reload()
  },
)

function stop() {
  if (abortCtl) {
    abortCtl.abort()
    abortCtl = null
  }
}

function reload() {
  stop()
  sink.value = createTranscriptSink()
  openSteps.value = {}
  errKey.value = ''
  open.value = ACTIVE.has(props.run.status || '')
  void load()
}

async function load() {
  const run = props.run || ({} as TaskRun)
  // A queued run has no session until the runner claims it; the poll in
  // the parent panel brings us back here once it does.
  if (!run.session_id) {
    phase.value = 'waiting'
    return
  }
  if (ACTIVE.has(run.status || '')) {
    await attach(false)
    return
  }

  phase.value = 'loading'
  let msgs: unknown = null
  try {
    msgs = await service.ai.listAgentMessages(run.session_id)
  } catch (e) {
    if (destroyed.value) return
    // The session is gone: runs beyond the retention window have theirs
    // deleted along with the run rows they belonged to.
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      phase.value = 'pruned'
      return
    }
    phase.value = 'error'
    errKey.value = errorKey(e)
    return
  }
  if (destroyed.value) return
  const blocks = historyBlocks(Array.isArray(msgs) ? (msgs as AgentMessage[]) : [])
  if (blocks.length) {
    sink.value.actions.startAssistant()
    blocks.forEach((b) => sink.value.actions.appendBlock(b))
    sink.value.actions.setStreamingDone()
    phase.value = 'ready'
    return
  }
  // Nothing persisted. For a run that died mid-turn `_save_history` never
  // ran, and the event log is the only record of how far it got.
  await attach(true)
}

async function attach(replay: boolean) {
  phase.value = replay ? 'loading' : 'live'
  stop()
  const ctl = new AbortController()
  abortCtl = ctl
  let result: { attached: boolean; error?: unknown }
  try {
    result = await attachAgentStream(props.run.session_id!, ctl.signal, sink.value.actions)
  } catch (e) {
    result = { attached: false, error: e }
  }
  if (destroyed.value || abortCtl !== ctl) return
  abortCtl = null
  if (hasItems.value) {
    phase.value = replay ? 'replayed' : 'ready'
  } else if (result && result.error) {
    phase.value = 'error'
    errKey.value = 'aiTasksTranscriptFailed'
  } else {
    phase.value = 'empty'
  }
}

function isOpen(i: number, j: number) {
  return !!openSteps.value[i + ':' + j]
}
function toggleStep(i: number, j: number) {
  openSteps.value[i + ':' + j] = !isOpen(i, j)
}
// Empty when unknown: a history-loaded run carries no timings, and a
// placeholder there would read as "instant".
function durationOf(s: RailStep) {
  return s.durationMs != null ? formatMs(s.durationMs) : ''
}

onBeforeUnmount(() => {
  destroyed.value = true
  stop()
})

void load()
</script>
