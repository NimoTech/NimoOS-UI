<!--
  Task editor (create / edit / draft-prefill). Ported 1:1 from Vue2
  TaskEditorModal.vue, including the M6 draft contract (a draft never carries
  authorization; suggested egress hosts require a click) and the live
  next-run preview (cron via the backend's cron-preview endpoint — the same
  `tasks.cron` the scheduler runs — interval computed locally).

  Styles live in src/ai/styles/tasks.scss.
-->
<template>
  <div class="sk-modal-bg" @click.self="emit('close')">
    <div class="sk-modal tsk-modal">
      <div class="sk-modal-head">
        <div class="sk-modal-title">
          {{ task ? t('aiTasksEditTitle') : t('aiTasksCreateTitle') }}
        </div>
        <button class="set-ibtn" @click="emit('close')"><AgentIcon name="x" :size="15" /></button>
      </div>
      <div v-if="!task && draft && draft.prompt_fallback" class="tsk-draft-note">
        {{ t('aiTasksDraftFallbackHint') }}
      </div>

      <div class="sk-modal-body">
        <div class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldName') }}</label>
          <input v-model="form.name" type="text" :placeholder="t('aiTasksNamePlaceholder')" data-test="task-name" />
        </div>

        <div class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldPrompt') }}</label>
          <!-- The agent revised this prompt during a continuation run; the
               previous version is kept until a human edit supersedes it. -->
          <div v-if="revisedByAgent" class="tsk-revised" data-test="revised-banner">
            <span class="tsk-revised-badge">{{ t('aiTasksPromptRevisedByAgent') }}</span>
            <button class="sk-btn ghost" data-test="prev-toggle" @click="showPrevPrompt = !showPrevPrompt">
              {{ t('aiTasksPromptPrevVersion') }}
            </button>
            <button
              class="sk-btn ghost"
              data-test="revert-prompt"
              :title="t('aiTasksPromptRevertHint')"
              @click="revertPrompt"
            >
              {{ t('aiTasksPromptRevert') }}
            </button>
          </div>
          <pre v-if="revisedByAgent && showPrevPrompt" class="tsk-prev-prompt" data-test="prev-prompt">{{
            task?.prev_prompt
          }}</pre>
          <textarea
            v-model="form.prompt"
            rows="6"
            :placeholder="t('aiTasksPromptPlaceholder')"
            data-test="task-prompt"
          ></textarea>
          <div class="sk-field-hint">{{ t('aiTasksPromptHint') }}</div>
        </div>

        <div class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldModel') }}</label>
          <select v-model="form.model" class="set-select">
            <option value="">{{ t('aiTasksModelDefault') }}</option>
            <option v-for="m in models" :key="m.key" :value="m.key">{{ modelLabel(m) }}</option>
          </select>
          <div class="sk-field-hint">{{ t('aiTasksModelHint') }}</div>
        </div>

        <!-- Trigger -->
        <div class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldTrigger') }}</label>
          <div class="sk-trig-options">
            <button
              v-for="tt in TRIGGER_TYPES"
              :key="tt"
              class="sk-trig-option"
              :data-active="form.trigger_type === tt ? 'true' : 'false'"
              @click="form.trigger_type = tt"
            >
              <span class="name">{{ t('aiTasksTriggerType_' + tt) }}</span>
              <span class="desc">{{ t('aiTasksTriggerTypeDesc_' + tt) }}</span>
            </button>
          </div>
        </div>

        <div v-if="form.trigger_type === 'cron'" class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldCron') }}</label>
          <input v-model="form.cron_expr" type="text" placeholder="0 9 * * *" data-test="task-cron" />
          <div class="sk-field-hint" :class="{ err: !!cronErrorKey() }">
            {{ cronErrorKey() ? t(cronErrorKey()) : t('aiTasksCronHint') }}
          </div>
          <div v-if="nextRunPreviewTs" class="sk-field-hint tsk-preview" data-test="next-run-preview">
            {{ t('aiTasksNextRun', { when: ts(nextRunPreviewTs) }) }}
            <span v-if="tz" class="tsk-tz">{{ tz }}</span>
          </div>
        </div>

        <div v-if="form.trigger_type === 'interval'" class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldInterval') }}</label>
          <input v-model="form.interval_seconds" type="number" min="60" />
          <div class="sk-field-hint">{{ t('aiTasksIntervalHint') }}</div>
          <div v-if="nextRunPreviewTs" class="sk-field-hint tsk-preview" data-test="next-run-preview">
            {{ t('aiTasksNextRun', { when: ts(nextRunPreviewTs) }) }}
          </div>
        </div>

        <div v-if="showsWebhook" class="sk-field">
          <label class="sk-field-label">{{ t('aiTasksFieldWebhook') }}</label>
          <div class="set-copy">
            <input class="set-input full mono" :value="webhookCurl" readonly />
            <button class="sk-btn ghost" :disabled="resettingWebhook" @click="resetWebhookToken">
              {{ t('aiTasksWebhookReset') }}
            </button>
          </div>
          <div class="sk-field-hint">{{ t('aiTasksWebhookHint') }}</div>
        </div>

        <!-- Limits -->
        <div class="tsk-grid2">
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldMaxTurns') }}</label>
            <input v-model="form.max_turns" type="number" min="1" max="100" />
          </div>
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldTimeout') }}</label>
            <input v-model="form.timeout_seconds" type="number" min="60" max="7200" />
          </div>
        </div>

        <div class="tsk-grid2">
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldOverlap') }}</label>
            <select v-model="form.overlap_policy" class="set-select">
              <option value="skip">{{ t('aiTasksOverlapSkip') }}</option>
              <option value="queue">{{ t('aiTasksOverlapQueue') }}</option>
            </select>
          </div>
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldCatchup') }}</label>
            <select v-model="form.catchup_policy" class="set-select">
              <option value="skip">{{ t('aiTasksCatchupSkip') }}</option>
              <option value="run_once">{{ t('aiTasksCatchupRunOnce') }}</option>
            </select>
          </div>
        </div>

        <!-- Notifications -->
        <div class="tsk-grid2">
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldNotifyPolicy') }}</label>
            <select v-model="form.notify_policy" class="set-select">
              <option value="failure">{{ t('aiTasksNotifyFailure') }}</option>
              <option value="always">{{ t('aiTasksNotifyAlways') }}</option>
              <option value="never">{{ t('aiTasksNotifyNever') }}</option>
            </select>
          </div>
          <div class="sk-field">
            <label class="sk-field-label">{{ t('aiTasksFieldNotifyChannel') }}</label>
            <select v-model="form.notify_channel" class="set-select">
              <option value="">{{ t('aiTasksNotifyNoChannel') }}</option>
              <option v-for="tg in notifyTargets" :key="tg.value" :value="tg.value">
                {{ targetLabel(tg) }}
              </option>
            </select>
          </div>
        </div>
        <div class="sk-field-hint">{{ t('aiTasksNotifyTargetsHint') }}</div>
        <label class="tsk-check">
          <input v-model="form.notify_on_start" type="checkbox" />
          <span>{{ t('aiTasksFieldNotifyOnStart') }}</span>
        </label>
        <div class="sk-field-hint">{{ t('aiTasksNotifyOnStartHint') }}</div>

        <!-- Pre-authorization -->
        <div class="tsk-preauth">
          <div class="sk-field-label">{{ t('aiTasksPreauthTitle') }}</div>
          <p class="sk-field-hint">{{ t('aiTasksPreauthDesc') }}</p>

          <div class="tsk-bucket">
            <div class="tsk-bucket-tt">{{ t('aiTasksPreauthShell') }}</div>
            <div v-for="(r, i) in preauth.shell" :key="'sh' + i" class="tsk-entry">
              <span class="tsk-entry-val mono" :title="evidenceFor('shell', r.value)">{{
                r.value
              }}</span>
              <button class="tok-del" @click="removeShell(i)">
                <AgentIcon name="trash" :size="12" />
              </button>
            </div>
            <div class="set-addrow">
              <input
                v-model="newShell"
                class="set-input mono"
                :placeholder="t('aiTasksPreauthShellPlaceholder')"
                @keyup.enter="addShell()"
              />
              <button class="sk-btn ghost" @click="addShell()">
                <AgentIcon name="plus" :size="12" /> {{ t('aiTasksAdd') }}
              </button>
            </div>
            <div class="sk-field-hint">{{ t('aiTasksPreauthShellHint') }}</div>
          </div>

          <!-- The task's own folder. Read-only: it is derived from the task id
               by the backend, so an editable field could only ever disagree
               with reality. Shown at all because a folder nobody can find is
               not a feature — this is where the task keeps state between runs,
               and the user browses it in the file manager. -->
          <div v-if="workspacePath" class="tsk-bucket">
            <div class="tsk-bucket-tt">{{ t('aiTasksWorkspaceTitle') }}</div>
            <div class="tsk-entry">
              <span class="tsk-entry-val mono">{{ workspacePath }}</span>
            </div>
            <div class="sk-field-hint">{{ t('aiTasksWorkspaceHint') }}</div>
          </div>

          <div v-for="f in STRING_BUCKETS" :key="f" class="tsk-bucket">
            <div class="tsk-bucket-tt">{{ t('aiTasksPreauth_' + f) }}</div>
            <div v-for="(v, i) in preauth[f]" :key="f + i" class="tsk-entry">
              <span class="tsk-entry-val mono" :title="evidenceFor(f, v)">{{ v }}</span>
              <button class="tok-del" @click="removeEntry(f, i)">
                <AgentIcon name="trash" :size="12" />
              </button>
            </div>
            <div v-if="f === 'egress_domains' && suggestedEgress.length" class="tsk-suggest">
              <div class="tsk-suggest-title">{{ t('aiTasksDraftSuggestedEgress') }}</div>
              <div class="tsk-suggest-hint">{{ t('aiTasksDraftSuggestedHint') }}</div>
              <!-- A suggested host is the one bucket that is pure guesswork —
                   it may come from a command that ran, or from a URL a model
                   merely echoed into a note body. The tooltip names which,
                   so adopting one is a decision and not a coin flip. -->
              <button
                v-for="h in suggestedEgress"
                :key="h"
                class="sk-btn ghost tsk-suggest-chip"
                :title="evidenceFor('suggested_egress', h)"
                @click="adoptSuggestedEgress(h)"
              >
                + {{ h }}
              </button>
            </div>
            <div class="set-addrow">
              <input
                v-model="newEntry[f]"
                class="set-input mono"
                :placeholder="t('aiTasksPreauthPlaceholder_' + f)"
                @keyup.enter="addEntry(f)"
              />
              <button class="sk-btn ghost" @click="addEntry(f)">
                <AgentIcon name="plus" :size="12" /> {{ t('aiTasksAdd') }}
              </button>
            </div>
            <div v-if="f === 'fs_write'" class="sk-field-hint">{{ t('aiTasksPreauthFsHint') }}</div>
            <div v-if="f === 'scripts'" class="sk-field-hint">
              {{ t('aiTasksPreauthScriptsHint') }}
            </div>
          </div>
        </div>

        <!-- The report is the ONLY channel telling the author a rule they typed
             was thrown away, so it is rendered as a warning that keeps the
             modal open rather than a transient toast. -->
        <div v-if="rejected.length" class="set-banner warn">
          <div>{{ t('aiTasksRejectedRulesTitle') }}</div>
          <ul class="tsk-rejected">
            <li v-for="(r, i) in rejected" :key="'rj' + i">
              <span class="mono">{{ r.field }}: {{ r.value }}</span>
              — {{ reasonText(r) }}
            </li>
          </ul>
        </div>
        <div v-if="truncatedFields.length" class="set-banner warn">
          {{ t('aiTasksTruncatedRules', { fields: truncatedFields.join(', ') }) }}
        </div>
        <div v-if="errKey" class="set-banner warn" data-test="editor-error">{{ t(errKey) }}</div>
      </div>

      <div class="sk-modal-foot">
        <span class="save-note">{{ t('aiTasksManualRunNote') }}</span>
        <div class="right">
          <button class="sk-btn ghost" @click="emit('close')">{{ t('aiTasksCancel') }}</button>
          <button class="sk-btn primary" :disabled="saving" data-test="task-save" @click="onSave()">
            {{ task ? t('aiTasksSave') : t('aiTasksCreate') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import AgentIcon from '../components/icons/AgentIcon.vue'
import { useAgentStore, type AgentModel } from '../stores/agentStore'
import { errorKey, formatTs, tzLabel, type TaskRow } from './taskHelpers'

const { t } = useI18n()
const toast = useToast()

const TRIGGER_TYPES = ['cron', 'interval', 'webhook_only'] as const
// `scripts` rides the same generic bucket rendering as the others; only its
// hint is special-cased (see the template) because it is the one bucket whose
// safety depends on where the file lives relative to `fs_write`.
const STRING_BUCKETS = ['egress_domains', 'mcp_tools', 'fs_write', 'scripts'] as const
type Bucket = (typeof STRING_BUCKETS)[number]

export interface TaskDraft {
  name?: string
  prompt?: string
  prompt_fallback?: boolean
  preauth?: Record<string, unknown>
  suggested_egress?: string[]
  evidence?: Record<string, string>
}

export interface NotifyTarget {
  value: string
  chat_title?: string
  instance_name?: string
  channel_type?: string
}

const props = withDefaults(
  defineProps<{
    // null → create mode.
    task?: TaskRow | null
    // M6: a draft derived from a chat session. Only consulted in create
    // mode; an actual task always wins.
    draft?: TaskDraft | null
    notifyTargets?: NotifyTarget[]
  }>(),
  { task: null, draft: null, notifyTargets: () => [] },
)
const emit = defineEmits<{ (e: 'saved'): void; (e: 'close'): void }>()

function emptyPreauth() {
  return {
    shell: [] as Array<{ kind: 'prefix'; value: string }>,
    egress_domains: [] as string[],
    mcp_tools: [] as string[],
    fs_write: [] as string[],
    scripts: [] as string[],
  }
}

const form = reactive<Record<string, any>>({})
const preauth = reactive(emptyPreauth())
const suggestedEgress = ref<string[]>([])
const workspacePath = ref('')
// Held locally rather than read off the task prop, so a reset can show
// the new token without the parent having to refetch the list.
const webhookToken = ref('')
const resettingWebhook = ref(false)
const newShell = ref('')
const newEntry = reactive<Record<Bucket, string>>({
  egress_domains: '',
  mcp_tools: '',
  fs_write: '',
  scripts: '',
})
const saving = ref(false)
const errKey = ref('')
const rejected = ref<Array<{ field: string; value: string; reason: string }>>([])
const truncated = ref<Record<string, unknown>>({})
// Next fire times fetched from the cron-preview endpoint — the SAME
// `tasks.cron` the scheduler runs, so the preview cannot drift from what the
// saved task will actually do.
const nextRuns = ref<number[]>([])
let previewTimer: ReturnType<typeof setTimeout> | null = null

const agentStore = useAgentStore()
const models = computed<AgentModel[]>(() => agentStore.availableModels)

const tz = tzLabel()

const truncatedFields = computed(() => Object.keys(truncated.value || {}))
const showPrevPrompt = ref(false)
const revisedByAgent = computed(
  () => !!(props.task && props.task.prompt_revised_by === 'agent' && props.task.prev_prompt),
)
// Puts the pre-revision prompt back into the form; saving applies it (the
// backend clears the revision markers on any human prompt change).
function revertPrompt() {
  form.prompt = props.task?.prev_prompt || ''
}
// A webhook can trigger ANY saved task, not just an unscheduled one — the
// trigger type only says whether the task ALSO fires on its own. There is
// no token to show while creating, because the server mints it on save.
const showsWebhook = computed(() => !!(props.task && webhookToken.value))
const webhookCurl = computed(() => {
  if (!showsWebhook.value) return ''
  // Phase one accepts no parameters, so the example sends no body: anything
  // a caller could inject would reach the model as instructions.
  return `curl -X POST ${window.location.origin}/v1/ai/agent/task-webhook/${webhookToken.value}`
})
// 0 = nothing to preview (hidden). Cron comes from the endpoint; an
// interval is trivially local; webhook_only never self-fires.
const nextRunPreviewTs = computed(() => {
  const tt = form.trigger_type
  if (tt === 'cron') return (nextRuns.value && nextRuns.value[0]) || 0
  if (tt === 'interval') {
    const s = parseInt(String(form.interval_seconds), 10) || 0
    return s > 0 ? Math.floor(Date.now() / 1000) + s : 0
  }
  return 0
})

function ts(v: unknown) {
  return formatTs(v)
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => void refreshPreview(), 400)
}

async function refreshPreview() {
  if (form.trigger_type !== 'cron' || cronErrorKey()) {
    nextRuns.value = []
    return
  }
  const expr = form.cron_expr
  try {
    const r = (await service.ai.cronPreview(expr)) as { next?: number[] }
    // The user can keep typing while the request is in flight; a stale
    // answer must not overwrite the preview of what they typed since.
    if (form.cron_expr !== expr) return
    nextRuns.value = (r && r.next) || []
  } catch {
    // 400 = parses-but-never-fires or plain invalid — no preview to show.
    nextRuns.value = []
  }
}

function reset() {
  const tk = (props.task || {}) as Record<string, any>
  // A draft only fills the blanks of create mode.
  const d = (!props.task && props.draft ? props.draft : {}) as TaskDraft
  Object.assign(form, {
    name: tk.name || d.name || '',
    prompt: tk.prompt || d.prompt || '',
    agent_type: tk.agent_type || 'general',
    model: tk.model || '',
    // A draft must not schedule itself: converting a chat should never
    // silently create something that starts running on a timer.
    trigger_type: tk.trigger_type || (props.draft && !props.task ? 'webhook_only' : 'cron'),
    cron_expr: tk.cron_expr || '0 9 * * *',
    interval_seconds: tk.interval_seconds || 3600,
    max_turns: tk.max_turns || 25,
    timeout_seconds: tk.timeout_seconds || 1800,
    overlap_policy: tk.overlap_policy || 'skip',
    catchup_policy: tk.catchup_policy || 'skip',
    notify_policy: tk.notify_policy || 'failure',
    notify_channel: tk.notify_channel || '',
    notify_on_start: !!tk.notify_on_start,
    enabled: tk.enabled === undefined ? true : !!tk.enabled,
  })
  // Deep copy: the editor must never mutate the list's task object, or a
  // cancelled edit would leave the page showing rules that were never saved.
  const src = (tk.preauth || d.preauth || {}) as Record<string, any>
  const p = emptyPreauth()
  p.shell = (Array.isArray(src.shell) ? src.shell : [])
    .filter((r: any) => r && typeof r.value === 'string')
    .map((r: any) => ({ kind: 'prefix' as const, value: r.value }))
  for (const f of STRING_BUCKETS) {
    p[f] = (Array.isArray(src[f]) ? src[f] : []).filter((v: unknown) => typeof v === 'string')
  }
  // A DRAFT never carries authorization. The endpoint returns
  // egress_domains empty by contract (hosts go to suggested_egress, which
  // requires a click); force it here so a contract violation upstream
  // cannot arrive pre-authorized. Editing a real task is unaffected — its
  // egress_domains were authorized by a human already.
  if (!props.task && props.draft) p.egress_domains = []
  Object.assign(preauth, p)
  // Suggested egress hosts are guesses extracted from command text, not
  // recorded outbound traffic — they stay OUT of preauth until the user
  // adopts one. See spec §13.4.
  suggestedEgress.value =
    !props.task && props.draft && Array.isArray(props.draft.suggested_egress)
      ? props.draft.suggested_egress
          .filter((v) => typeof v === 'string' && v)
          .filter((v, i, a) => a.indexOf(v) === i)
      : []
  // Only an existing task has a folder: the path is derived from an id the
  // backend assigns on create, so in create mode there is nothing to show.
  workspacePath.value = (tk && (tk.workspace as string)) || ''
  webhookToken.value = (tk && (tk.webhook_token as string)) || ''
  resettingWebhook.value = false
  errKey.value = ''
  rejected.value = []
  truncated.value = {}
}

function modelLabel(m: AgentModel) {
  return m.source === 'cloud' && m.providerName
    ? `${m.displayName} (${m.providerName})`
    : m.displayName
}

// The backend can invent new reasons; fall back to the raw code rather
// than printing a missing i18n key at the user.
function reasonText(r: { reason: string }) {
  const key = 'aiTasksRejectReason_' + r.reason
  const text = t(key)
  return text === key ? r.reason : text
}

function targetLabel(tg: NotifyTarget) {
  const chat = tg.chat_title || tg.value
  return `${chat} · ${tg.instance_name} (${tg.channel_type})`
}

// `kind: "prefix"` is the only shell rule the backend honors — regex rules
// were removed (ReDoS on the agent's event loop) and are reported back as
// rejected, so there is deliberately no kind selector here.
function addShell() {
  const value = (newShell.value || '').trim()
  if (!value) return
  if (preauth.shell.some((r) => r.value === value)) {
    newShell.value = ''
    return
  }
  preauth.shell.push({ kind: 'prefix', value })
  newShell.value = ''
}
function removeShell(i: number) {
  preauth.shell.splice(i, 1)
}
function addEntry(field: Bucket) {
  const value = (newEntry[field] || '').trim()
  if (!value) return
  if (preauth[field].indexOf(value) === -1) preauth[field].push(value)
  newEntry[field] = ''
}
function removeEntry(field: Bucket, i: number) {
  preauth[field].splice(i, 1)
}
function adoptSuggestedEgress(host: string) {
  if (preauth.egress_domains.indexOf(host) === -1) {
    preauth.egress_domains.push(host)
  }
  suggestedEgress.value = suggestedEgress.value.filter((h) => h !== host)
}

async function resetWebhookToken() {
  if (!props.task || resettingWebhook.value) return
  resettingWebhook.value = true
  try {
    const r = (await service.ai.resetTaskWebhookToken(props.task.id)) as {
      webhook_token?: string
    }
    const token = r && r.webhook_token
    // Only overwrite on a real token: showing a blank field would read as
    // "the webhook is gone" when the old one is still live.
    if (token) webhookToken.value = token
  } catch {
    toast.show(t('aiTasksWebhookResetFailed'), 3000, 'warning')
  } finally {
    resettingWebhook.value = false
  }
}

// Spec §13.4: every suggested rule shows where it came from, so the user
// is confirming an observation rather than a guess. Empty for hand-typed
// rules and for edits of an existing task.
function evidenceFor(bucket: string, value: string) {
  const src = (!props.task && props.draft && props.draft.evidence) || {}
  return src[`${bucket}:${value}`] || ''
}

// Shape only. Field semantics (ranges, "0 0 30 2 *" never fires, …) are the
// backend's call and come back as `bad_cron`.
function cronErrorKey() {
  if (form.trigger_type !== 'cron') return ''
  const expr = (form.cron_expr || '').trim()
  if (!expr) return 'aiTasksCronRequired'
  if (expr.split(/\s+/).length !== 5) return 'aiTasksCronFiveFields'
  return ''
}

function buildPayload() {
  const f = form
  const body: Record<string, unknown> = {
    name: (f.name || '').trim(),
    prompt: f.prompt,
    agent_type: f.agent_type || 'general',
    model: f.model || '',
    trigger_type: f.trigger_type,
    cron_expr: (f.cron_expr || '').trim(),
    interval_seconds: Number(f.interval_seconds) || 0,
    max_turns: Number(f.max_turns) || 0,
    timeout_seconds: Number(f.timeout_seconds) || 0,
    overlap_policy: f.overlap_policy,
    catchup_policy: f.catchup_policy,
    notify_policy: f.notify_policy,
    notify_channel: f.notify_channel || '',
    notify_on_start: !!f.notify_on_start,
    // The WHOLE document, always: PUT replaces `preauth` instead of merging
    // it, so sending a subset would silently delete the rest.
    preauth: {
      shell: preauth.shell.map((r) => ({ kind: 'prefix', value: r.value })),
      egress_domains: preauth.egress_domains.slice(),
      mcp_tools: preauth.mcp_tools.slice(),
      fs_write: preauth.fs_write.slice(),
      scripts: preauth.scripts.slice(),
    },
  }
  // `enabled` is ignored on create (a new task starts enabled); sending it
  // only on update keeps the create body honest about what it controls.
  if (props.task) body.enabled = !!form.enabled
  return body
}

async function onSave() {
  errKey.value = ''
  rejected.value = []
  truncated.value = {}
  if (!(form.name || '').trim()) {
    errKey.value = 'aiTasksErrNameRequired'
    return
  }
  if (!(form.prompt || '').trim()) {
    errKey.value = 'aiTasksErrPromptRequired'
    return
  }
  const cronErr = cronErrorKey()
  if (cronErr) {
    errKey.value = cronErr
    return
  }

  saving.value = true
  try {
    const body = buildPayload()
    const r = (props.task
      ? await service.ai.updateTask(props.task.id, body)
      : await service.ai.createTask(body)) as { preauth_report?: Record<string, unknown> }
    const report = (r && r.preauth_report) || {}
    rejected.value = Array.isArray(report.rejected_rules)
      ? (report.rejected_rules as Array<{ field: string; value: string; reason: string }>)
      : []
    truncated.value =
      report.truncated && typeof report.truncated === 'object'
        ? (report.truncated as Record<string, unknown>)
        : {}
    // The task WAS written either way, so the list must refresh; but when
    // rules were dropped the modal stays open so the report is actually
    // read instead of flashing past.
    emit('saved')
    if (!rejected.value.length && !Object.keys(truncated.value).length) {
      emit('close')
    }
  } catch (e) {
    errKey.value = errorKey(e)
  } finally {
    saving.value = false
  }
}

watch(
  () => form.cron_expr,
  () => schedulePreview(),
)
watch(
  () => form.trigger_type,
  () => schedulePreview(),
)

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer)
})

reset()
if (!agentStore.availableModels.length) void agentStore.loadAvailableModels()
void refreshPreview()
</script>
