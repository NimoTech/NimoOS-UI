// Ported 1:1 from Vue2 __tests__/runTranscript.spec.js. Feeds this repo's real
// dispatchEvent, so a drifted block shape fails here and in chat at once.
import { describe, it, expect } from 'vitest'
import { dispatchEvent } from '../services/dispatchEvent'
import type { AgentBlock, AgentMessage } from '../types'
import {
  createTranscriptSink,
  transcriptProgress,
  transcriptItems,
  historyBlocks,
  previewArgs,
  withStepTimings,
  type TranscriptSink,
} from './runTranscript'

// A fake clock: the sink must never reach for Date.now() itself, or step
// durations become untestable and every id churns between renders.
function sink(): TranscriptSink {
  let t = 1000
  return createTranscriptSink({ now: () => (t += 100) })
}

function feed(s: TranscriptSink, events: Array<Record<string, unknown>>) {
  events.forEach((e) => dispatchEvent(e, s.actions))
  return s.state
}

const msg = (m: Record<string, unknown>) => m as unknown as AgentMessage
const blocksOf = (m: AgentMessage) => (m.blocks || []) as AgentBlock[]

describe('createTranscriptSink — the actions surface dispatchEvent expects', () => {
  it('turns a tool_call/tool_result pair into one finished tool block', () => {
    const s = sink()
    feed(s, [
      { type: 'tool_call', tool: 'web_fetch', args: { url: 'https://a.io' }, call_id: 'c1' },
      { type: 'tool_result', tool: 'web_fetch', content: 'rss · 20 items', call_id: 'c1' },
    ])
    const blocks = blocksOf(s.state.messages[0])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'tool', name: 'web_fetch', state: 'success' })
    expect((blocks[0].sections as Array<{ label: string }>).map((x) => x.label)).toEqual([
      'ARGUMENTS',
      'RESULT',
    ])
  })

  it('matches a result to its own call when several tools run in parallel', () => {
    const s = sink()
    feed(s, [
      { type: 'tool_call', tool: 'a', args: {}, call_id: 'c1' },
      { type: 'tool_call', tool: 'b', args: {}, call_id: 'c2' },
      { type: 'tool_result', tool: 'b', content: 'B', call_id: 'c2' },
    ])
    const [a, b] = blocksOf(s.state.messages[0])
    expect(a.state).toBe('running')
    expect(b.state).toBe('success')
    expect((b.sections as Array<{ code: string }>)[1].code).toBe('B')
  })

  // The store's appendBlock silently drops a block when the last message is
  // not an assistant turn. In chat that cannot happen (send() starts the turn);
  // on a resume stream with no user_message prefix it would drop the WHOLE
  // transcript with no error anywhere.
  it('starts an assistant turn on its own rather than dropping blocks', () => {
    const s = sink()
    dispatchEvent({ type: 'tool_call', tool: 'read_file', args: {}, call_id: 'c1' }, s.actions)
    expect(s.state.messages).toHaveLength(1)
    expect(blocksOf(s.state.messages[0])).toHaveLength(1)
  })

  it('merges thinking deltas into one block and closes it when a tool starts', () => {
    const s = sink()
    feed(s, [
      { type: 'thinking', content: 'first ' },
      { type: 'thinking', content: 'second' },
      { type: 'tool_call', tool: 'x', args: {}, call_id: 'c1' },
    ])
    const blocks = blocksOf(s.state.messages[0])
    expect(blocks.filter((b) => b.type === 'thinking')).toHaveLength(1)
    expect(blocks[0].text).toBe('first second')
    expect(blocks[0].streaming).toBe(false)
  })

  it('merges message_delta tokens into one md block', () => {
    const s = sink()
    feed(s, [
      { type: 'message_delta', content: '已收齐 ' },
      { type: 'message_delta', content: '4 个渠道' },
    ])
    expect(blocksOf(s.state.messages[0])[0]).toMatchObject({
      type: 'md',
      text: '已收齐 4 个渠道',
      streaming: true,
    })
  })

  it('keeps the run prompt out of the rendered messages', () => {
    const s = sink()
    feed(s, [{ type: 'user_message', content: '每天 11 点播报竞品动态' }])
    expect(s.state.prompt).toBe('每天 11 点播报竞品动态')
    expect(s.state.messages.every((m) => m.role === 'assistant')).toBe(true)
  })

  it('setStreamingDone ends the live flag and stops the last turn streaming', () => {
    const s = sink()
    feed(s, [{ type: 'message_delta', content: 'hi' }])
    s.actions.setBusy(true)
    expect(s.state.live).toBe(true)
    feed(s, [{ type: 'done' }])
    expect(s.state.live).toBe(false)
    expect(s.state.messages[0].streaming).toBe(false)
    expect(blocksOf(s.state.messages[0])[0].streaming).toBe(false)
  })

  it('renders an agent error as a failed step', () => {
    const s = sink()
    feed(s, [{ type: 'error', content: 'AccountQuotaExceeded' }])
    expect(blocksOf(s.state.messages[0])[0]).toMatchObject({ type: 'tool', state: 'error' })
    expect(s.state.live).toBe(false)
  })

  it('patchBlock reports a miss instead of patching the wrong block', () => {
    const s = sink()
    expect(s.actions.patchBlock(() => true, () => ({}))).toBe(false)
  })
})

describe('transcriptProgress — what the collapsed run row shows', () => {
  it('counts steps and names the one running right now', () => {
    const s = sink()
    feed(s, [
      { type: 'tool_call', tool: 'read_file', args: {}, call_id: 'c1' },
      { type: 'tool_result', tool: 'read_file', content: 'ok', call_id: 'c1' },
      { type: 'tool_call', tool: 'web_fetch', args: {}, call_id: 'c2' },
    ])
    expect(transcriptProgress(s.state)).toEqual({ total: 2, done: 1, current: 'web_fetch' })
  })

  it('has no current step once the run is finished', () => {
    const s = sink()
    feed(s, [
      { type: 'tool_call', tool: 'read_file', args: {}, call_id: 'c1' },
      { type: 'tool_result', tool: 'read_file', content: 'ok', call_id: 'c1' },
      { type: 'done' },
    ])
    expect(transcriptProgress(s.state)).toEqual({ total: 1, done: 1, current: '' })
  })

  it('is empty on an untouched sink', () => {
    expect(transcriptProgress(sink().state)).toEqual({ total: 0, done: 0, current: '' })
  })
})

describe('transcriptItems — the render plan', () => {
  it('groups consecutive thinking and tool blocks into one process rail', () => {
    const items = transcriptItems([
      msg({
        role: 'assistant',
        blocks: [
          { type: 'thinking', text: 'plan' },
          { type: 'tool', name: 'a', state: 'success' },
          { type: 'md', text: 'answer' },
          { type: 'tool', name: 'b', state: 'success' },
        ],
      }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['process', 'md', 'process'])
    const rail = items[0] as { steps: Array<Record<string, unknown>> }
    expect(rail.steps).toHaveLength(2)
    expect(rail.steps[0]).toMatchObject({ kind: 'think', detail: 'plan' })
  })

  it('carries run_command and MCP calls in the rail too', () => {
    const items = transcriptItems([
      msg({
        role: 'assistant',
        blocks: [
          {
            type: 'terminal',
            command: 'ls /DATA',
            state: 'error',
            exitCode: 2,
            lines: [{ text: 'no such file' }],
          },
          {
            type: 'mcp_call',
            server: 'github',
            tool: 'list_prs',
            state: 'success',
            args: '{}',
            result: 'ok',
          },
        ],
      }),
    ])
    expect(items).toHaveLength(1)
    const rail = items[0] as { steps: Array<Record<string, any>> }
    expect(rail.steps.map((s) => s.name)).toEqual(['run_command', 'github::list_prs'])
    expect(rail.steps[0]).toMatchObject({ state: 'error', detail: 'ls /DATA' })
    expect(rail.steps[0].sections[0].code).toContain('no such file')
  })

  // Verbatim from a live run: the gate refused, the agent SDK reported it as
  // an ordinary tool result, and dispatchEvent marked the step 'success'. On a
  // collapsed rail that is the opposite of what happened.
  it('marks a refused or failed tool result as a failed step', () => {
    const items = transcriptItems([
      msg({
        role: 'assistant',
        blocks: [
          {
            type: 'tool',
            name: 'list_dir',
            state: 'success',
            sections: [
              { label: 'ARGUMENTS', code: '{}' },
              { label: 'RESULT', code: 'Error: The user denied access to /DATA/AppData/nimoos-tasks' },
            ],
          },
          {
            type: 'mcp_call',
            server: 's',
            tool: 't',
            state: 'success',
            args: '{}',
            result: '[MCP error] boom',
          },
          {
            type: 'tool',
            name: 'ok_tool',
            state: 'success',
            sections: [{ label: 'RESULT', code: 'Errors were not found in this report' }],
          },
        ],
      }),
    ])
    const rail = items[0] as { steps: Array<{ state: string }> }
    expect(rail.steps.map((s) => s.state)).toEqual(['error', 'error', 'success'])
  })

  // A task run's permission cards are answered by the run driver, never by a
  // human looking at this panel. Rendering the real card would show buttons
  // that do nothing; the transcript states the outcome instead.
  it('turns permission cards into read-only gate notes, not clickable cards', () => {
    const items = transcriptItems([
      msg({
        role: 'assistant',
        blocks: [
          { type: 'confirm', confirmId: 'x', action: 'write_file', description: '/DATA/x' },
          { type: 'access_request', confirmId: 'y', path: '/DATA/y', kind: 'folder' },
        ],
      }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['gate', 'gate'])
    expect((items[0] as { detail: string }).detail).toBe('/DATA/x')
    expect((items[1] as { detail: string }).detail).toBe('/DATA/y')
  })

  it('keeps max_turns and mcp_warning as notes and drops duplicate result cards', () => {
    const items = transcriptItems([
      msg({
        role: 'assistant',
        blocks: [
          { type: 'max_turns', maxTurns: 40 },
          { type: 'mcp_warning', server: 's', error: 'boom' },
          { type: 'semantic_search', results: [] },
          { type: 'photo_grid', photos: [] },
        ],
      }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['note', 'note'])
  })

  it('ignores user turns and survives junk', () => {
    expect(transcriptItems([msg({ role: 'user', content: 'hi' })])).toEqual([])
    expect(transcriptItems(null)).toEqual([])
    expect(transcriptItems([msg({ role: 'assistant' })])).toEqual([])
  })
})

describe('previewArgs — the value shown beside a tool name', () => {
  it('pulls the first string argument out of a truncated args preview', () => {
    // Exactly what the live box stores: 80 chars, cut mid-object.
    expect(
      previewArgs('{"path": "/DATA/AppData/nimoos-tasks/e05fcadf-2b9f-46b1-8571-72889126a7bb/see'),
    ).toBe('/DATA/AppData/nimoos-tasks/e05fcadf-2b9f-46b1-8571-72889126a7bb/see')
    expect(
      previewArgs('{"url": "https://www.reddit.com/search.rss?q=minisforum", "max_chars": 40000}'),
    ).toBe('https://www.reddit.com/search.rss?q=minisforum')
  })

  it('unescapes what JSON escaped', () => {
    expect(previewArgs('{"query": "\\"MS-A2\\" 发布"}')).toBe('"MS-A2" 发布')
  })

  it('keeps an object that has no string argument', () => {
    expect(previewArgs('{"categories": ["web"]}')).toBe('"categories": ["web"]')
  })

  it('passes plain text and emptiness through', () => {
    expect(previewArgs('ls /DATA')).toBe('ls /DATA')
    expect(previewArgs('')).toBe('')
    expect(previewArgs(undefined)).toBe('')
  })
})

describe('withStepTimings — the per-step durations', () => {
  it('lines the k-th tool step up with the k-th activity step, skipping thinking', () => {
    const s = sink()
    feed(s, [
      { type: 'thinking', content: 'plan' },
      { type: 'tool_call', tool: 'a', args: {}, call_id: 'c1' },
      { type: 'tool_result', tool: 'a', content: 'A', call_id: 'c1' },
      { type: 'tool_call', tool: 'b', args: {}, call_id: 'c2' },
      { type: 'tool_result', tool: 'b', content: 'B', call_id: 'c2' },
    ])
    const items = withStepTimings(transcriptItems(s.state.messages), s.state.steps)
    const rail = items[0] as { steps: Array<Record<string, unknown>> }
    expect(rail.steps[0].kind).toBe('think')
    expect(rail.steps[0].durationMs).toBeUndefined()
    expect(rail.steps[1].durationMs).toBe(100)
    expect(rail.steps[2].durationMs).toBe(100)
  })

  // A run read back from /messages has no activity steps — the backend never
  // persisted timings. Inventing one would be worse than showing none.
  it('leaves history steps untimed rather than borrowing a number', () => {
    const items = withStepTimings(
      transcriptItems([msg({ role: 'assistant', blocks: [{ type: 'tool', name: 'a', state: 'success' }] })]),
      [],
    )
    expect((items[0] as { steps: Array<Record<string, unknown>> }).steps[0].durationMs).toBeUndefined()
  })

  // The replay case, verbatim from a live capture: /run-stream re-emits the
  // event log with no timestamps, so call and result land in the same tick and
  // every step measured 0ms. A fetch that really took 4s must not say "0ms".
  it('drops a duration that only measured the replay', () => {
    const now = () => 1000 // a clock that does not advance
    const inst = createTranscriptSink({ now })
    feed(inst, [
      { type: 'tool_call', tool: 'web_fetch', args: {}, call_id: 'c1' },
      { type: 'tool_result', tool: 'web_fetch', content: 'x', call_id: 'c1' },
    ])
    const items = withStepTimings(transcriptItems(inst.state.messages), inst.state.steps)
    expect(inst.state.steps[0].durationMs).toBe(0)
    expect((items[0] as { steps: Array<Record<string, unknown>> }).steps[0].durationMs).toBeUndefined()
  })

  it('drops a zero duration the block carried itself', () => {
    const items = withStepTimings(
      transcriptItems([
        msg({
          role: 'assistant',
          blocks: [{ type: 'terminal', command: 'ls', state: 'success', durationMs: 0, lines: [] }],
        }),
      ]),
      [],
    )
    expect((items[0] as { steps: Array<Record<string, unknown>> }).steps[0].durationMs).toBeUndefined()
  })

  it('keeps a duration the block already carried', () => {
    const items = withStepTimings(
      transcriptItems([
        msg({
          role: 'assistant',
          blocks: [{ type: 'terminal', command: 'ls', state: 'success', durationMs: 4200, lines: [] }],
        }),
      ]),
      [{ id: 's1', name: 'x', state: 'success', startedAt: 0, durationMs: 1 }],
    )
    expect((items[0] as { steps: Array<Record<string, unknown>> }).steps[0].durationMs).toBe(4200)
  })
})

describe('historyBlocks — loading a finished run from /messages', () => {
  it('flattens assistant turns in order and migrates legacy shell blocks', () => {
    const msgs = [
      msg({ role: 'user', content: 'prompt' }),
      msg({
        role: 'assistant',
        blocks: [
          {
            type: 'tool',
            name: 'run_command',
            sections: [
              { label: 'ARGUMENTS', code: '{"command": "ls"}' },
              { label: 'RESULT', code: '[exit 0]\nDATA' },
            ],
          },
        ],
      }),
      msg({ role: 'assistant', blocks: [{ type: 'md', text: 'done' }] }),
    ]
    const blocks = historyBlocks(msgs)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('terminal')
    expect(blocks[1]).toMatchObject({ type: 'md', text: 'done' })
  })

  it('returns an empty list for a session with nothing saved', () => {
    expect(historyBlocks([])).toEqual([])
    expect(historyBlocks(null)).toEqual([])
  })
})
