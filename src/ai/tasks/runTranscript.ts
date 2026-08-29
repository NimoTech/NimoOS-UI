// Ported 1:1 from Vue2 src/views/AI/Tasks/runTranscript.js.
//
// The read-only side of a scheduled task's run: a sink that satisfies the
// action interface `dispatchEvent` writes into, plus the pure functions that
// turn what it collected into something renderable.
//
// Why not reuse the chat store: `agentStore` owns one live conversation — its
// busy flag, abort controller, model choice and confirm/regenerate actions all
// belong to a human at a keyboard. A task run has none of that. Everything
// here is a plain reactive object with no network of its own, so a run's
// transcript can be mounted many times over on the same page without any of
// them colliding.
//
// The event vocabulary itself is NOT re-implemented. `dispatchEvent` stays the
// single translator from agent SSE events to blocks, so a new event type or a
// changed block shape lands in the task panel and the chat at the same time.
import { reactive } from 'vue'
import type { AgentBlock, AgentMessage, AgentStats, StreamActions } from '../types'
import { migrateLegacyMessages, parseMcpToolName } from '../services/streamMappers'

// Block types that belong on the process rail, in the order the agent emitted
// them. `terminal` is here because run_command has no `tool` block at all —
// leaving it out drops every shell command from the transcript.
const STEP_TYPES = new Set(['thinking', 'tool', 'terminal', 'mcp_call'])

// Permission cards. In chat these render as buttons; a task run's cards are
// answered by `tasks/driver.py` before a human could ever see them, so the
// transcript states what the gate did instead of offering a dead control.
const GATE_TYPES = new Set([
  'confirm',
  'access_request',
  'mcp_confirm',
  'mcp_install',
  'mcp_elicit_form',
  'mcp_elicit_url',
])

// Standalone notices worth keeping. Everything else the chat injects
// (semantic_search, photo_grid, file_list, image_grid, …) is a second, richer
// rendering of a tool result whose own step is already on the rail — showing
// both would double every search in the timeline.
const NOTE_TYPES = new Set(['max_turns', 'mcp_warning'])

export interface TranscriptStep {
  id: string
  name: string
  state: string
  startedAt: number
  durationMs?: number
}

export interface TranscriptState {
  messages: AgentMessage[]
  steps: TranscriptStep[]
  live: boolean
  prompt: string
}

export interface RailStep {
  kind: 'think' | 'tool'
  state: string
  name: string
  detail: string
  sections: Array<{ label: string; code: string }>
  exitCode?: unknown
  durationMs?: number
}

export type TranscriptItem =
  | { kind: 'process'; steps: RailStep[] }
  | { kind: 'gate'; label: string; detail: string }
  | { kind: 'note'; tone: 'warn'; noteKey: 'maxTurns' | 'mcpWarning'; params: Record<string, unknown> }
  | { kind: 'md'; text: string; streaming: boolean }

export interface TranscriptSink {
  state: TranscriptState
  actions: StreamActions
}

/**
 * A collector for one run's events.
 *
 * `now` is injected because step durations and message ids would otherwise
 * depend on the wall clock, which makes both untestable and (for ids) churns
 * every key on every render.
 */
export function createTranscriptSink({ now = () => Date.now() }: { now?: () => number } = {}): TranscriptSink {
  const state = reactive<TranscriptState>({
    messages: [], // [{ id, role: 'assistant', blocks, streaming, stats }]
    steps: [], // [{ id, name, state, startedAt, durationMs }]
    live: false,
    prompt: '',
  }) as TranscriptState
  let seq = 0
  const nextId = (prefix: string) => `${prefix}${++seq}`

  const lastMessage = () => state.messages[state.messages.length - 1]

  function startAssistant(): AgentMessage {
    state.messages.push({
      id: nextId('a'),
      role: 'assistant',
      blocks: [],
      streaming: true,
    } as unknown as AgentMessage)
    return lastMessage()
  }

  const actions: StreamActions = {
    // The run's prompt is kept but never rendered as a chat turn: with the run
    // briefing folded in it is several hundred characters of instructions, and
    // this panel is about what the agent DID.
    pushUserMessage(text: string) {
      state.prompt = text || ''
    },

    startAssistant() {
      startAssistant()
    },

    // Deliberately different from agentStore.appendBlock, which returns early
    // when the last message is not an assistant turn. Here that would mean a
    // resume stream without a `user_message` prefix silently renders nothing —
    // a failure with no error anywhere. Start the turn instead.
    appendBlock(block: AgentBlock) {
      const last = lastMessage()
      const target = last && last.role === 'assistant' ? last : startAssistant()
      target.blocks!.push(block)
    },

    // Reverse-find, splice in place — same contract as the store's, including
    // the boolean return that dispatchEvent branches on.
    patchBlock(predicate, patch) {
      const last = lastMessage()
      if (!last || !last.blocks) return false
      for (let i = last.blocks.length - 1; i >= 0; i--) {
        if (predicate(last.blocks[i])) {
          const old = last.blocks[i]
          const next =
            typeof patch === 'function' ? { ...old, ...patch(old) } : { ...old, ...patch }
          last.blocks.splice(i, 1, next)
          return true
        }
      }
      return false
    },

    setStreamingDone() {
      const idx = state.messages.length - 1
      const last = state.messages[idx]
      if (last && last.role === 'assistant') {
        state.messages.splice(idx, 1, { ...last, streaming: false })
      }
      state.live = false
    },

    setBusy(value: boolean) {
      state.live = !!value
    },

    patchAssistantStats(partial: Partial<AgentStats>) {
      const idx = state.messages.length - 1
      const last = state.messages[idx]
      if (!last || last.role !== 'assistant') return
      state.messages.splice(idx, 1, {
        ...last,
        stats: { ...(last.stats || {}), ...partial },
      })
    },

    pushActivityStep({ name }: { name: string }) {
      state.steps.push({
        id: nextId('s'),
        name,
        state: 'running',
        startedAt: now(),
      })
    },

    markRunningStepDone() {
      for (let i = state.steps.length - 1; i >= 0; i--) {
        const step = state.steps[i]
        if (step.state === 'running') {
          state.steps.splice(i, 1, {
            ...step,
            state: 'success',
            durationMs: now() - step.startedAt,
          })
          return
        }
      }
    },

    // Intentionally absent: appendStagedChange, appendVisibleResource,
    // removeVisibleResourceFromList. dispatchEvent guards all three, and each
    // drives a chat-only side panel. A task run's staged changes are settled
    // by the driver, not reviewed here.
  }

  return { state, actions }
}

/**
 * What the collapsed run row shows while a run is in flight: how many steps
 * have happened, and the name of the one happening right now.
 */
export function transcriptProgress(state: TranscriptState | null | undefined): {
  total: number
  done: number
  current: string
} {
  const steps = (state && state.steps) || []
  const running = steps.filter((s) => s.state === 'running')
  return {
    total: steps.length,
    done: steps.length - running.length,
    // The LAST running step, matching the rail's own ordering. With parallel
    // tool calls several are running at once; naming the newest is what makes
    // the row track the agent rather than lag behind it.
    current: running.length ? running[running.length - 1].name || '' : '',
  }
}

/**
 * The one value worth showing beside a tool's name.
 *
 * `argsPreview` is `JSON.stringify(args).slice(0, 80)` — usually truncated
 * mid-object, so it cannot be parsed. On a rail of 31 steps the readable part
 * is the first string argument (the path, the url, the query); the braces and
 * key names are noise repeated on every row.
 */
export function previewArgs(raw: unknown): string {
  const text = String(raw || '').trim()
  if (!text.startsWith('{')) return text
  const m = text.match(/"[^"]*"\s*:\s*"((?:[^"\\]|\\.)*)"?/)
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`)
    } catch {
      return m[1]
    }
  }
  // No string argument at all ({"categories": ["web"]}): keep the object, minus
  // the outer braces, rather than showing an empty cell.
  return text.replace(/^\{\s*/, '').replace(/\s*\}$/, '')
}

// A tool whose result is a refusal or an error. `dispatchEvent` marks every
// completed tool 'success' — in chat the text is right there in the card, but
// on a collapsed rail a denial that reads as success is the opposite of what
// happened, and a denial is exactly what someone opens a task run to find.
// `The user denied access to` is the gate's own wording (agent-side contract,
// mirrored in the zh locale work); `[MCP error]` is MCP_ERR_RE's sentinel.
const _DENIED_RE = /^Error:|The user denied access to|^\[MCP error\]/

function resultState(state: string, sections: Array<{ label: string; code: string }>): string {
  if (state !== 'success') return state
  const result = (sections || []).find((s) => s && s.label === 'RESULT')
  const text = String((result && result.code) || '').trimStart()
  return text && _DENIED_RE.test(text) ? 'error' : state
}

function stepFromBlock(b: AgentBlock): RailStep {
  if (b.type === 'thinking') {
    return {
      kind: 'think',
      state: b.streaming ? 'running' : 'success',
      name: '',
      detail: (b.text as string) || '',
      sections: [],
    }
  }
  if (b.type === 'terminal') {
    const body = ((b.lines as Array<{ text?: string }>) || [])
      .map((l) => (l && l.text) || '')
      .join('\n')
    const sections: Array<{ label: string; code: string }> = []
    if (body) sections.push({ label: 'OUTPUT', code: body })
    return {
      kind: 'tool',
      state: (b.state as string) || 'running',
      name: 'run_command',
      detail: (b.command as string) || '',
      sections,
      exitCode: b.exitCode,
      durationMs: b.durationMs as number | undefined,
    }
  }
  if (b.type === 'mcp_call') {
    const sections: Array<{ label: string; code: string }> = []
    if (b.args) sections.push({ label: 'ARGUMENTS', code: b.args as string })
    if (b.result) sections.push({ label: 'RESULT', code: b.result as string })
    return {
      kind: 'tool',
      state: resultState((b.state as string) || 'running', sections),
      name: `${b.server || '?'}::${b.tool || '?'}`,
      detail: '',
      sections,
    }
  }
  // type === 'tool'
  const mcp = parseMcpToolName((b.name as string) || '')
  const sections = (b.sections as Array<{ label: string; code: string }>) || []
  return {
    kind: 'tool',
    state: resultState((b.state as string) || 'running', sections),
    name: mcp ? `${mcp.server}::${mcp.tool}` : (b.name as string) || 'tool',
    detail: previewArgs(b.argsPreview),
    sections,
  }
}

function gateFromBlock(b: AgentBlock): TranscriptItem {
  if (b.type === 'access_request') {
    return {
      kind: 'gate',
      label: b.kind === 'file' ? 'file' : 'folder',
      detail: (b.path as string) || '',
    }
  }
  if (b.type === 'mcp_confirm') {
    return { kind: 'gate', label: (b.server as string) || 'mcp', detail: (b.tool as string) || '' }
  }
  if (b.type === 'mcp_install') {
    return { kind: 'gate', label: 'mcp', detail: (b.name as string) || '' }
  }
  if (b.type === 'mcp_elicit_form' || b.type === 'mcp_elicit_url') {
    return {
      kind: 'gate',
      label: (b.server as string) || 'mcp',
      detail: (b.message as string) || (b.url as string) || '',
    }
  }
  return {
    kind: 'gate',
    label: (b.action as string) || '',
    detail: (b.description as string) || (b.command as string) || '',
  }
}

function noteFromBlock(b: AgentBlock): TranscriptItem {
  if (b.type === 'max_turns') {
    return { kind: 'note', tone: 'warn', noteKey: 'maxTurns', params: { n: b.maxTurns || 0 } }
  }
  return {
    kind: 'note',
    tone: 'warn',
    noteKey: 'mcpWarning',
    params: { server: b.server || '', error: b.error || '' },
  }
}

/**
 * Flatten every assistant turn into an ordered render plan.
 *
 * Consecutive rail blocks collapse into one `process` item so the transcript
 * reads as a single timeline, the way the chat's process strip does — a run
 * with 28 tool calls must not become 28 separate cards.
 */
export function transcriptItems(messages: AgentMessage[] | null | undefined): TranscriptItem[] {
  if (!Array.isArray(messages)) return []
  const out: TranscriptItem[] = []
  let rail: { kind: 'process'; steps: RailStep[] } | null = null
  for (const m of messages) {
    if (!m || m.role !== 'assistant' || !Array.isArray(m.blocks)) continue
    for (const b of m.blocks) {
      if (!b || !b.type) continue
      if (STEP_TYPES.has(b.type)) {
        if (!rail) {
          rail = { kind: 'process', steps: [] }
          out.push(rail)
        }
        rail.steps.push(stepFromBlock(b))
        continue
      }
      rail = null
      if (b.type === 'md') {
        out.push({ kind: 'md', text: (b.text as string) || '', streaming: !!b.streaming })
      } else if (GATE_TYPES.has(b.type)) {
        out.push(gateFromBlock(b))
      } else if (NOTE_TYPES.has(b.type)) {
        out.push(noteFromBlock(b))
      }
      // else: a duplicate result card — its step is already on the rail.
    }
  }
  return out
}

/**
 * Fold the sink's step timings into the render plan.
 *
 * Timings live on the activity steps, not on the blocks: `dispatchEvent`
 * pushes exactly one step per tool call — MCP calls and run_command included,
 * thinking excluded — and closes it on the matching result. So the k-th tool
 * step on the rail is `steps[k]`, and no correlation id is needed.
 *
 * A run loaded from history has no steps at all: the backend persists the
 * call and its result, never how long it took. Those rows show no timing
 * rather than a fabricated one.
 *
 * Same for a REPLAY. `/run-stream` re-emits the event log with no timestamps
 * in it (see `run_sink.load_events_from_db`), so a call and its result arrive
 * microseconds apart and the clock here measures the replay, not the tool. A
 * real tool call through the agent loop never completes in under a few
 * milliseconds, so anything that fast is a replay artefact and is dropped —
 * showing "0ms" beside a fetch that took four seconds is worse than showing
 * nothing.
 */
const MIN_MEASURED_MS = 5

export function withStepTimings(
  items: TranscriptItem[] | null | undefined,
  steps: TranscriptStep[] | null | undefined,
): TranscriptItem[] {
  const list = Array.isArray(steps) ? steps : []
  let k = 0
  return (items || []).map((it) => {
    if (it.kind !== 'process') return it
    return {
      ...it,
      steps: it.steps.map((s) => {
        if (s.kind !== 'tool') return s
        const st = list[k++]
        const own = s.durationMs
        if (own != null) return own >= MIN_MEASURED_MS ? s : { ...s, durationMs: undefined }
        return st && (st.durationMs ?? 0) >= MIN_MEASURED_MS
          ? { ...s, durationMs: st.durationMs }
          : s
      }),
    }
  })
}

/**
 * The blocks of a finished run, from `GET /agent/sessions/{id}/messages`.
 *
 * `migrateLegacyMessages` is the same reconstruction the chat applies when it
 * opens an old session (run_command → terminal, MCP tool → mcp_call), so a
 * replayed run looks like the live one it was.
 */
export function historyBlocks(messages: AgentMessage[] | null | undefined): AgentBlock[] {
  if (!Array.isArray(messages)) return []
  const migrated = migrateLegacyMessages(messages) || []
  const out: AgentBlock[] = []
  for (const m of migrated) {
    if (!m || m.role !== 'assistant' || !Array.isArray(m.blocks)) continue
    out.push(...m.blocks)
  }
  return out
}
