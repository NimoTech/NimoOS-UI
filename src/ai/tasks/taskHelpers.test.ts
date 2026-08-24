// Ported from Vue2 __tests__/taskHelpers.spec.js (keys renamed tasks* → aiTasks*).
import { describe, it, expect } from 'vitest'
import {
  errorCode,
  errorKey,
  formatTs,
  triggerText,
  statusPill,
  durationText,
  canAdopt,
  ADOPTABLE_KINDS,
  tzLabel,
} from './taskHelpers'

describe('taskHelpers', () => {
  it("errorCode() reads FastAPI's {detail} shape through the Go proxy", () => {
    expect(errorCode({ response: { data: { detail: 'bad_cron' } } })).toBe('bad_cron')
  })

  it('errorCode() falls back to {message} and to a bare string body', () => {
    expect(errorCode({ response: { data: { message: 'not_found' } } })).toBe('not_found')
    expect(errorCode({ response: { data: 'preauth_full' } })).toBe('preauth_full')
  })

  it('errorCode() returns empty string for a network error with no response', () => {
    expect(errorCode(new Error('Network Error'))).toBe('')
    expect(errorCode(null)).toBe('')
  })

  it('errorKey() maps every documented backend code to its own message', () => {
    const cases: Record<string, string> = {
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
    for (const [code, key] of Object.entries(cases)) {
      expect(errorKey({ response: { data: { detail: code } } })).toBe(key)
    }
    expect(errorKey({ response: { data: { detail: 'brand_new_code' } } })).toBe(
      'aiTasksErrGeneric',
    )
  })

  it('formatTs() renders unix seconds and dashes for 0/garbage', () => {
    expect(formatTs(0)).toBe('—')
    expect(formatTs('x')).toBe('—')
    expect(formatTs(1_800_000_000)).not.toBe('—')
  })

  it('triggerText() covers the three trigger types', () => {
    expect(triggerText({ id: '1', trigger_type: 'cron', cron_expr: '0 9 * * *' })).toEqual({
      key: 'aiTasksTriggerCron',
      params: { expr: '0 9 * * *' },
    })
    expect(triggerText({ id: '1', trigger_type: 'interval', interval_seconds: 600 })).toEqual({
      key: 'aiTasksTriggerIntervalMinutes',
      params: { minutes: 10 },
    })
    expect(triggerText({ id: '1', trigger_type: 'webhook_only' }).key).toBe(
      'aiTasksTriggerWebhook',
    )
    expect(triggerText(null).key).toBe('aiTasksTriggerWebhook')
  })

  it('statusPill() maps run statuses to pill states', () => {
    expect(statusPill('succeeded')).toBe('ok')
    expect(statusPill('running')).toBe('warn')
    expect(statusPill('queued')).toBe('warn')
    expect(statusPill('failed')).toBe('off')
    expect(statusPill('timeout')).toBe('off')
    expect(statusPill('skipped')).toBe('')
  })

  it('durationText() is null while unfinished, seconds once done', () => {
    expect(durationText({ id: 'r', started_at: 100, finished_at: 0 })).toBeNull()
    expect(durationText({ id: 'r', started_at: 0, finished_at: 0 })).toBeNull()
    expect(durationText({ id: 'r', started_at: 100, finished_at: 142 })).toEqual({
      key: 'aiTasksDurationSeconds',
      params: { seconds: 42 },
    })
  })

  it('canAdopt() admits exactly the backend-foldable kinds', () => {
    for (const k of ADOPTABLE_KINDS) expect(canAdopt(k)).toBe(true)
    expect(canAdopt('toolbox_install')).toBe(false)
    expect(canAdopt('')).toBe(false)
    expect(canAdopt(undefined)).toBe(false)
  })

  it('tzLabel() returns a short zone name and never throws', () => {
    expect(typeof tzLabel()).toBe('string')
  })
})
