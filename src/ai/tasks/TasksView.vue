<!--
  Scheduled-tasks page (/ai/tasks). Ported 1:1 from Vue2 TasksView.vue.

  Same shell as the settings page, minus the left rail: this page navigates
  from the agent sidebar, so it is a single full-height column. Theme rides
  the same aiTheme store the agent/settings pages use (Vue2 read the
  localStorage key directly; this repo has a store for it).

  M6 (convert chat to task): AgentPage stores the draft in the shared
  tasksDraft holder and navigates here with ?draft=1 — this page opens the
  editor prefilled. Vue2 embedded the editor in the Agent page instead; the
  New-UI agent shell is a different layout, and landing on the tasks page
  keeps the "task now exists in this list" outcome on screen. Declared
  deviation, behavior-equivalent otherwise.

  Styles live in src/ai/styles/tasks.scss (imported here, knowledge-page
  precedent).
-->
<template>
  <!-- Root bears BOTH `agent-app` (token scope — this repo's tokens.scss
       defines every var(--…) only under .agent-app; without it the section
       panels render transparent) and `set-app` (layout grid). Same trap
       SettingsPage.vue documents in its header. -->
  <div class="agent-app set-app tsk-app" :data-theme="theme.theme">
    <main class="set-main">
      <header class="set-topbar">
        <button class="set-ibtn" :title="t('aiTasksBack')" @click="goBack">
          <span style="transform: scaleX(-1); display: inline-flex">
            <AgentIcon name="chev" :size="15" />
          </span>
        </button>
        <span class="tt">{{ t('aiTasksTitle') }}</span>
        <div style="flex: 1"></div>
        <button class="set-ibtn" :title="t('aiTasksRefresh')" @click="load()">
          <AgentIcon name="refresh" :size="16" />
        </button>
        <button class="sk-btn primary" data-test="task-new" @click="openCreate()">
          <AgentIcon name="plus" :size="13" /> {{ t('aiTasksNew') }}
        </button>
      </header>

      <div class="set-body">
        <div class="set-inner">
          <div class="set-page-head">
            <h1 class="set-h1">{{ t('aiTasksTitle') }}</h1>
            <p class="set-desc">{{ t('aiTasksDesc') }}</p>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiTasksListTitle') }}</div>
              <div class="sk-section-hint">{{ tasks.length }}</div>
            </div>
            <div class="sk-section-body">
              <div v-if="loading && !tasks.length" class="set-note">{{ t('aiTasksLoading') }}</div>
              <div v-else-if="!tasks.length" class="set-note">{{ t('aiTasksEmpty') }}</div>

              <template v-else>
                <div v-for="tk in tasks" :key="tk.id" class="tsk-item">
                  <div class="tok-row">
                    <span class="tok-ic"><AgentIcon name="gauge" :size="16" /></span>
                    <div class="tok-body" data-test="task-row" @click="select(tk)">
                      <div class="tok-name">{{ tk.name }}</div>
                      <div class="tok-meta">
                        <span>{{ t(triggerText(tk).key, triggerText(tk).params) }}</span>
                        <span class="sep"></span>
                        <span>
                          {{ t('aiTasksNextRun', { when: ts(tk.next_run_at) }) }}
                          <span v-if="tk.next_run_at && tz" class="tsk-tz">{{ tz }}</span>
                        </span>
                        <template v-if="tk.last_run_at">
                          <span class="sep"></span>
                          <span>{{ t('aiTasksLastRun', { when: ts(tk.last_run_at) }) }}</span>
                        </template>
                        <template v-if="tk.prompt_revised_by === 'agent'">
                          <span class="sep"></span>
                          <span class="tsk-revised-chip">{{ t('aiTasksPromptRevisedByAgent') }}</span>
                        </template>
                      </div>
                    </div>
                    <SetSwitch
                      :model-value="!!tk.enabled"
                      :disabled="busyId === tk.id"
                      data-test="task-enabled"
                      @update:model-value="onToggleEnabled(tk)"
                    />
                    <button
                      class="sk-btn ghost"
                      :disabled="busyId === tk.id"
                      :title="t('aiTasksRunNowHint')"
                      data-test="task-run-now"
                      @click="onRunNow(tk)"
                    >
                      <AgentIcon name="play" :size="12" /> {{ t('aiTasksRunNow') }}
                    </button>
                    <button class="sk-btn ghost" data-test="task-edit" @click="openEdit(tk)">
                      <AgentIcon name="edit" :size="12" /> {{ t('aiTasksEdit') }}
                    </button>
                    <button class="tok-del" data-test="task-delete" @click="onDelete(tk)">
                      <AgentIcon name="trash" :size="13" /> {{ t('aiTasksDelete') }}
                    </button>
                  </div>

                  <TaskRunsPanel
                    v-if="selectedId === tk.id"
                    ref="runsPanel"
                    :task-id="tk.id"
                    @adopted="load()"
                  />
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </main>

    <TaskEditorModal
      v-if="editorOpen"
      :task="editing"
      :draft="draft"
      :notify-targets="notifyTargets"
      @saved="onSaved"
      @close="onEditorClose"
    />

    <AlertDialog
      v-model:open="confirmDeleteOpen"
      :title="t('aiTasksDelete')"
      :message="t('aiTasksDeleteConfirm', { name: pendingDelete ? pendingDelete.name : '' })"
      :confirm-text="t('aiTasksDelete')"
      :cancel-text="t('aiTasksCancel')"
      destructive
      @confirm="doDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import AgentIcon from '../components/icons/AgentIcon.vue'
import SetSwitch from '../components/settings/SetSwitch.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import TaskEditorModal, { type TaskDraft, type NotifyTarget } from './TaskEditorModal.vue'
import TaskRunsPanel from './TaskRunsPanel.vue'
import { errorKey, formatTs, triggerText, tzLabel, type TaskRow } from './taskHelpers'
import { useAiTheme } from '../stores/aiTheme'
import { takePendingTaskDraft } from './pendingDraft'
import '../styles/tokens.scss'
import '../styles/sk-shared.scss'
import '../styles/skills-styles.scss'
import '../styles/settings-styles.scss'
import '../styles/tasks.scss'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const theme = useAiTheme()

const LIST_POLL_MS = 15000

const tasks = ref<TaskRow[]>([])
const notifyTargets = ref<NotifyTarget[]>([])
const loading = ref(false)
const busyId = ref('')
const selectedId = ref('')
const editorOpen = ref(false)
const editing = ref<TaskRow | null>(null)
const draft = ref<TaskDraft | null>(null)
const confirmDeleteOpen = ref(false)
const pendingDelete = ref<TaskRow | null>(null)
const runsPanel = ref<InstanceType<typeof TaskRunsPanel> | null>(null)

// Zone the next-run timestamps are rendered in. Computed once: it is a
// browser property, and cron schedules are read in the SERVER's zone —
// showing it is what makes a mismatch visible instead of silent.
const tz = tzLabel()

const destroyed = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

// `silent` is what the poll uses: a transient network blip must not queue a
// toast every 15 seconds for as long as the page stays open.
async function load(silent = false) {
  loading.value = true
  try {
    const r = (await service.ai.listTasks()) as { tasks?: TaskRow[] }
    tasks.value = (r && r.tasks) || []
    if (selectedId.value && !tasks.value.some((tk) => tk.id === selectedId.value)) {
      selectedId.value = ''
    }
  } catch (e) {
    if (!silent) showError(e)
  } finally {
    loading.value = false
  }
}

// Optional data: a NAS with no paired chat has no targets, and the endpoint
// failing must not block task editing.
async function loadNotifyTargets() {
  try {
    const r = (await service.ai.listTaskNotifyTargets()) as { targets?: NotifyTarget[] }
    notifyTargets.value = (r && r.targets) || []
  } catch {
    notifyTargets.value = []
  }
}

async function tick() {
  if (destroyed.value) {
    stopPolling()
    return
  }
  await load(true)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function onToggleEnabled(task: TaskRow) {
  busyId.value = task.id
  try {
    // ONLY `enabled`. The backend replaces `preauth` wholesale when the key
    // is present, so including it here (even copied from the row) would
    // risk writing back a stale rule set.
    await service.ai.updateTask(task.id, { enabled: !task.enabled })
    await load(true)
  } catch (e) {
    showError(e)
  } finally {
    busyId.value = ''
  }
}

function onRunNow(task: TaskRow) {
  void doRunNow(task)
}

async function doRunNow(task: TaskRow) {
  busyId.value = task.id
  try {
    await service.ai.runTaskNow(task.id)
    // Stated explicitly: /run ignores `enabled` and the overlap policy, so a
    // disabled task really does execute when this button is pressed.
    toast.show(t('aiTasksRunQueuedIgnoresEnabled'))
    await load(true)
    refreshRuns()
  } catch (e) {
    showError(e)
  } finally {
    busyId.value = ''
  }
}

function onDelete(task: TaskRow) {
  pendingDelete.value = task
  confirmDeleteOpen.value = true
}

async function doDelete() {
  const task = pendingDelete.value
  pendingDelete.value = null
  if (!task) return
  busyId.value = task.id
  try {
    await service.ai.deleteTask(task.id)
    if (selectedId.value === task.id) selectedId.value = ''
    await load(true)
  } catch (e) {
    showError(e)
  } finally {
    busyId.value = ''
  }
}

function openCreate() {
  editing.value = null
  draft.value = null
  editorOpen.value = true
}

function openEdit(task: TaskRow) {
  editing.value = task
  draft.value = null
  editorOpen.value = true
}

// `saved` = the task was written; `close` = the editor is done. They are
// distinct because the modal stays open to show a rejected/truncated-rule
// report, and closing it from here would flash that report past the author.
async function onSaved() {
  await load(true)
  refreshRuns()
}

function onEditorClose() {
  editorOpen.value = false
  draft.value = null
}

// The panel is rendered for at most one task (the selected one).
function refreshRuns() {
  const panel = runsPanel.value
  const one = Array.isArray(panel) ? panel[0] : panel
  if (one && typeof one.load === 'function') one.load(true)
}

function select(task: TaskRow) {
  selectedId.value = selectedId.value === task.id ? '' : task.id
}

function goBack() {
  void router.push('/ai/agent')
}

function ts(v: unknown) {
  return formatTs(v)
}

function showError(e: unknown) {
  toast.show(t(errorKey(e)), 3000, 'danger')
}

onMounted(() => {
  // Same theme lifecycle as SettingsPage: entering /ai/tasks directly (without
  // visiting /ai/agent first) must still honor the saved/system preference.
  theme.enterAiSurface()
  theme.hydrateTheme()
  timer = setInterval(tick, LIST_POLL_MS)
  // M6 hand-off: AgentPage parked the draft and navigated with ?draft=1.
  if (route.query.draft) {
    const d = takePendingTaskDraft()
    if (d) {
      editing.value = null
      draft.value = d
      editorOpen.value = true
    }
  }
})
onBeforeUnmount(() => {
  destroyed.value = true
  stopPolling()
  theme.leaveAiSurface()
})

void load()
void loadNotifyTargets()
</script>
