// Shared pure helpers for the scheduled-tasks page.
// Ported 1:1 from Vue2 src/views/AI/Tasks/taskHelpers.js (i18n keys renamed
// tasks* → aiTasks* for this repo's ai-shard prefix guard).
//
// The backend (NimoOS-AI agent/main.py) answers every rejection with a FastAPI
// `{"detail": "<code>"}` body, proxied through the Go layer untouched. Those
// codes are the ONLY way a user can find out why a task was refused, so each
// one gets its own message here — a generic "save failed" would hide, for
// example, that `/` was refused in fs_write or that the rule bucket is full.

const ERROR_KEYS: Record<string, string> = {
  bad_cron: 'aiTasksErrBadCron',
  bad_interval: 'aiTasksErrBadInterval',
  bad_timeout: 'aiTasksErrBadTimeout',
  bad_max_turns: 'aiTasksErrBadMaxTurns',
  bad_preauth: 'aiTasksErrBadPreauth',
  bad_fs_write: 'aiTasksErrBadFsWrite',
  preauth_full: 'aiTasksErrPreauthFull',
  shell_rule_would_not_apply: 'aiTasksErrShellRuleNoOp',
  unsupported_kind: 'aiTasksErrUnsupportedKind',
  denied_action_not_found: 'aiTasksErrDeniedGone',
  not_found: 'aiTasksErrNotFound',
  name_required: 'aiTasksErrNameRequired',
  prompt_required: 'aiTasksErrPromptRequired',
  bad_trigger_type: 'aiTasksErrBadTrigger',
}

export interface TaskRow {
  id: string
  name?: string
  trigger_type?: string
  cron_expr?: string
  interval_seconds?: number
  next_run_at?: number
  last_run_at?: number
  enabled?: boolean | number
  prev_prompt?: string
  prompt_revised_at?: number
  prompt_revised_by?: string
  allow_prompt_revision?: boolean | number
  [k: string]: unknown
}

export interface TaskRun {
  id: string
  status?: string
  trigger?: string
  created_at?: number
  started_at?: number
  finished_at?: number
  session_id?: string
  resumed_from?: string
  summary?: string
  error?: string
  denied_actions?: Array<{ kind?: string; detail?: string }>
  [k: string]: unknown
}

// axios rejects with the response attached; FastAPI uses `detail`, so read the
// body directly rather than parsing a humanized string.
export function errorCode(e: unknown): string {
  const data = (e as { response?: { data?: unknown } })?.response?.data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    if (typeof d.message === 'string') return d.message
  }
  return ''
}

export function errorKey(e: unknown): string {
  return ERROR_KEYS[errorCode(e)] || 'aiTasksErrGeneric'
}

// The store uses 0 (not NULL) for "never" / "not scheduled", and its
// timestamps are unix SECONDS.
export function formatTs(ts: unknown): string {
  const n = Number(ts)
  if (!n || Number.isNaN(n)) return '—'
  return new Date(n * 1000).toLocaleString()
}

// Returned as {key, params} so the caller does the t() — keeping this module
// free of the i18n instance keeps it unit-testable.
export function triggerText(task: TaskRow | null | undefined): {
  key: string
  params: Record<string, unknown>
} {
  const t = task || ({} as TaskRow)
  if (t.trigger_type === 'cron') {
    return { key: 'aiTasksTriggerCron', params: { expr: t.cron_expr || '' } }
  }
  if (t.trigger_type === 'interval') {
    return {
      key: 'aiTasksTriggerIntervalMinutes',
      params: { minutes: Math.round(Number(t.interval_seconds || 0) / 60) },
    }
  }
  return { key: 'aiTasksTriggerWebhook', params: {} }
}

export function statusPill(status: string | undefined): string {
  if (status === 'succeeded') return 'ok'
  if (status === 'running' || status === 'queued') return 'warn'
  if (status === 'failed' || status === 'timeout') return 'off'
  return ''
}

// null while a run is still queued/running (finished_at is 0), so callers can
// simply skip the duration instead of printing a bogus one.
export function durationText(
  run: TaskRun | null | undefined,
): { key: string; params: Record<string, unknown> } | null {
  const started = Number(run?.started_at || 0)
  const finished = Number(run?.finished_at || 0)
  if (!started || !finished || finished < started) return null
  return { key: 'aiTasksDurationSeconds', params: { seconds: finished - started } }
}

// Denied-action kinds the backend can actually fold into a preauth document.
// MUST mirror `fold_denied` in NimoOS-AI/agent/tasks/preauth.py — every other
// kind (`toolbox_install`, `mcp_install`, `notes_write`, `wiki_*`, …) is
// answered with 400 `unsupported_kind`. Without this list the UI renders an
// "Pre-authorize" button on every denial, and the ones it cannot adopt are
// dead: the user clicks and gets an error toast, on their first use.
export const ADOPTABLE_KINDS = ['egress', 'fs', 'shell', 'mcp_tool']

export function canAdopt(kind: unknown): boolean {
  return ADOPTABLE_KINDS.indexOf(String(kind || '')) !== -1
}

// Short name of the zone these timestamps are rendered in ("EDT", "GMT+8").
// `formatTs` uses `toLocaleString`, i.e. the BROWSER's zone; cron expressions
// are interpreted in the SERVER's. They agree for the normal case (a NAS and
// its user on one LAN) and the label is what makes a disagreement visible
// instead of silent.
export function tzLabel(date?: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(
      date || new Date(),
    )
    const tz = parts.find((p) => p.type === 'timeZoneName')
    return (tz && tz.value) || ''
  } catch {
    return ''
  }
}
