// 1:1 port target: Vue2 src/views/AI/Agent/services/agentStream.js:260-562 (dispatchEvent
// 18-case switch) + 47-52 (endThinkingStreaming) + 57-62 (endMessageStreaming).
//
// Vue2's __tests__/agentStream.spec.js only covered the mapper family (migrateLegacyMessages/
// buildPhotoGridBlock/buildSemanticSearchBlock — already ported in Task 3 streamMappers.test.ts),
// there was no existing test for the dispatchEvent reducer itself. This file is a newly written
// reducer test, written line-by-line per the agentStream.js implementation and the brief's
// 18-case list, not a "port" of a non-existent file. The fake actions' patchBlock semantics
// match the New-UI real store (agentStore.ts:190-209): reverse-search for the most recent
// matching block, and if found, splice-replace it entirely and return true.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchEvent } from './dispatchEvent'
import type { AgentBlock, StreamActions } from '../types'

function makeActions(overrides: Partial<StreamActions> = {}) {
  const blocks: AgentBlock[] = []
  const calls = {
    pushUserMessage: [] as unknown[][],
    startAssistant: [] as unknown[][],
    appendBlock: [] as unknown[][],
    setStreamingDone: [] as unknown[][],
    setBusy: [] as unknown[][],
    patchAssistantStats: [] as unknown[][],
    pushActivityStep: [] as unknown[][],
    markRunningStepDone: [] as unknown[][],
    appendStagedChange: [] as unknown[][],
    appendVisibleResource: [] as unknown[][],
    removeVisibleResourceFromList: [] as unknown[][],
  }
  const base: StreamActions = {
    pushUserMessage: (...a) => { calls.pushUserMessage.push(a) },
    startAssistant: (...a) => { calls.startAssistant.push(a) },
    appendBlock: (b) => { calls.appendBlock.push([b]); blocks.push(b) },
    patchBlock: (predicate, patch) => {
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (predicate(blocks[i])) {
          const old = blocks[i]
          const next = typeof patch === 'function'
            ? { ...old, ...patch(old) }
            : { ...old, ...patch }
          blocks.splice(i, 1, next)
          return true
        }
      }
      return false
    },
    setStreamingDone: (...a) => { calls.setStreamingDone.push(a) },
    setBusy: (...a) => { calls.setBusy.push(a) },
    patchAssistantStats: (...a) => { calls.patchAssistantStats.push(a) },
    pushActivityStep: (...a) => { calls.pushActivityStep.push(a) },
    markRunningStepDone: (...a) => { calls.markRunningStepDone.push(a) },
    appendStagedChange: (...a) => { calls.appendStagedChange.push(a) },
    appendVisibleResource: (...a) => { calls.appendVisibleResource.push(a) },
    removeVisibleResourceFromList: (...a) => { calls.removeVisibleResourceFromList.push(a) },
    ...overrides,
  }
  return { actions: base, blocks, calls }
}

describe('dispatchEvent — user_message', () => {
  it('non-empty content pushes user message + starts assistant + setBusy(true)', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'user_message', content: 'hi there' }, actions)
    expect(calls.pushUserMessage).toEqual([['hi there']])
    expect(calls.startAssistant).toEqual([[]])
    expect(calls.setBusy).toEqual([[true]])
  })

  it('empty content is a no-op', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'user_message', content: '' }, actions)
    expect(calls.pushUserMessage).toEqual([])
    expect(calls.startAssistant).toEqual([])
    expect(calls.setBusy).toEqual([])
  })

  it('setBusy is optional-chained (absent actions do not throw)', () => {
    const { actions, calls } = makeActions({ setBusy: undefined })
    expect(() => dispatchEvent({ type: 'user_message', content: 'hi' }, actions)).not.toThrow()
    expect(calls.pushUserMessage).toEqual([['hi']])
  })
})

describe('dispatchEvent — thinking', () => {
  it('appends a new streaming thinking block when none is open', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'thinking', content: 'pondering' }, actions)
    expect(blocks).toEqual([{ type: 'thinking', text: 'pondering', streaming: true, defaultOpen: true }])
  })

  it('appends to the open streaming thinking block instead of creating a new one', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'thinking', content: 'a' }, actions)
    dispatchEvent({ type: 'thinking', content: 'b' }, actions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('ab')
  })

  it('ends any open streaming md block first (endMessageStreaming)', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'md', text: 'partial', streaming: true })
    dispatchEvent({ type: 'thinking', content: 'x' }, actions)
    expect(blocks[0]).toEqual({ type: 'md', text: 'partial', streaming: false })
  })
})

describe('dispatchEvent — message_delta', () => {
  it('appends a new streaming md block when none is open', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'message_delta', content: 'Hel' }, actions)
    expect(blocks).toEqual([{ type: 'md', text: 'Hel', streaming: true }])
  })

  it('appends to the open streaming md block', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'message_delta', content: 'Hel' }, actions)
    dispatchEvent({ type: 'message_delta', content: 'lo' }, actions)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('Hello')
  })

  it('ends any open streaming thinking block first (endThinkingStreaming)', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'thinking', text: 'thought', streaming: true, defaultOpen: true })
    dispatchEvent({ type: 'message_delta', content: 'x' }, actions)
    expect(blocks[0]).toEqual({ type: 'thinking', text: 'thought', streaming: false, defaultOpen: false })
  })
})

describe('dispatchEvent — tool_call', () => {
  it('mcp tool: appends mcp_call running block + pushActivityStep, no generic tool block', () => {
    const { actions, blocks, calls } = makeActions()
    dispatchEvent({
      type: 'tool_call', tool: 'mcp__github__search', call_id: 'c1', args: { q: 'x' },
    }, actions)
    expect(blocks).toEqual([{
      type: 'mcp_call', state: 'running', server: 'github', tool: 'search',
      args: JSON.stringify({ q: 'x' }, null, 2), callId: 'c1',
    }])
    expect(calls.pushActivityStep).toEqual([[{ name: 'mcp__github__search' }]])
  })

  it('run_command tool: appends terminal running block', () => {
    const { actions, blocks, calls } = makeActions()
    dispatchEvent({
      type: 'tool_call', tool: 'run_command', call_id: 'c2', args: { command: 'ls -la' },
    }, actions)
    expect(blocks).toHaveLength(1)
    const b = blocks[0] as any
    expect(b.type).toBe('terminal')
    expect(b.state).toBe('running')
    expect(b.command).toBe('ls -la')
    expect(b.cwd).toBe('/work')
    expect(b.shell).toBe('bash')
    expect(b.sandbox).toBe('nimo-sandbox')
    expect(b.lines).toEqual([])
    expect(typeof b.startedAt).toBe('number')
    expect(b.callId).toBe('c2')
    expect(calls.pushActivityStep).toEqual([[{ name: 'run_command' }]])
  })

  it('generic tool: appends tool running block with argsPreview + ARGUMENTS section', () => {
    const { actions, blocks, calls } = makeActions()
    dispatchEvent({
      type: 'tool_call', tool: 'search_photos', call_id: 'c3', args: { query: 'cats' },
    }, actions)
    expect(blocks).toEqual([{
      type: 'tool', state: 'running', name: 'search_photos',
      argsPreview: JSON.stringify({ query: 'cats' }).slice(0, 80),
      sections: [{ label: 'ARGUMENTS', code: JSON.stringify({ query: 'cats' }, null, 2) }],
      callId: 'c3',
    }])
    expect(calls.pushActivityStep).toEqual([[{ name: 'search_photos' }]])
  })

  it('nimoos_search stashes actions._lastNimoosSearchQuery from args.query', () => {
    const { actions } = makeActions()
    dispatchEvent({
      type: 'tool_call', tool: 'nimoos_search', call_id: 'c4', args: { query: 'winter coats' },
    }, actions)
    expect((actions as any)._lastNimoosSearchQuery).toBe('winter coats')
  })

  it('nimoos_search with missing query stashes empty string', () => {
    const { actions } = makeActions()
    dispatchEvent({ type: 'tool_call', tool: 'nimoos_search', call_id: 'c5', args: {} }, actions)
    expect((actions as any)._lastNimoosSearchQuery).toBe('')
  })

  it('strips leaked tool-call args JSON from a streaming md block first', () => {
    const { actions, blocks } = makeActions()
    const args = { query: 'cats' }
    blocks.push({ type: 'md', text: `Searching for cats ${JSON.stringify(args)}`, streaming: true })
    dispatchEvent({ type: 'tool_call', tool: 'nimoos_search', call_id: 'c6', args }, actions)
    const mdBlock = blocks.find(b => b.type === 'md')
    expect(mdBlock!.text).toBe('Searching for cats')
    expect(mdBlock!.streaming).toBe(false) // endMessageStreaming runs after the strip
  })

  it('ends any open streaming thinking block first (endThinkingStreaming)', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'thinking', text: 't', streaming: true, defaultOpen: true })
    dispatchEvent({ type: 'tool_call', tool: 'x', call_id: 'c7', args: {} }, actions)
    expect(blocks[0]).toMatchObject({ streaming: false, defaultOpen: false })
  })
})

describe('dispatchEvent — tool_result', () => {
  it('mcp_call: matches by call_id, patches success state, calls markRunningStepDone, no generic append', () => {
    const { actions, blocks, calls } = makeActions()
    blocks.push({ type: 'mcp_call', state: 'running', server: 's', tool: 't', args: '{}', callId: 'c1' })
    dispatchEvent({ type: 'tool_result', call_id: 'c1', tool: 'mcp__s__t', content: 'all good' }, actions)
    expect(blocks[0]).toMatchObject({ state: 'success', result: 'all good' })
    expect(calls.markRunningStepDone).toHaveLength(1)
  })

  it('mcp_call: MCP_ERR_RE content marks state error', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'mcp_call', state: 'running', server: 's', tool: 't', args: '{}', callId: 'c1' })
    dispatchEvent({
      type: 'tool_result', call_id: 'c1', tool: 'mcp__s__t', content: 'MCP 工具 t 调用失败: boom',
    }, actions)
    expect(blocks[0]).toMatchObject({ state: 'error' })
  })

  it('mcp_call: falls back to most-recent-running when call_id is absent', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'mcp_call', state: 'running', server: 's', tool: 't1', args: '{}', callId: '' })
    dispatchEvent({ type: 'tool_result', tool: 'mcp__s__t1', content: 'ok' }, actions)
    expect(blocks[0]).toMatchObject({ state: 'success', result: 'ok' })
  })

  it('terminal: matches by call_id, applies parseShellResult + durationMs from startedAt', () => {
    const { actions, blocks, calls } = makeActions()
    const startedAt = Date.now() - 50
    blocks.push({
      type: 'terminal', state: 'running', command: 'ls', cwd: '/work', shell: 'bash',
      sandbox: 'nimo-sandbox', lines: [], startedAt, callId: 'c2',
    })
    dispatchEvent({ type: 'tool_result', call_id: 'c2', tool: 'run_command', content: '[exit 0]\nfile.txt' }, actions)
    const b = blocks[0] as any
    expect(b.state).toBe('success')
    expect(b.exitCode).toBe(0)
    expect(b.lines).toEqual([{ text: 'file.txt', stream: 'stdout' }])
    expect(typeof b.durationMs).toBe('number')
    expect(calls.markRunningStepDone).toHaveLength(1)
  })

  it('generic tool: appends RESULT section onto existing sections when no terminal/mcp matched', () => {
    const { actions, blocks, calls } = makeActions()
    blocks.push({
      type: 'tool', state: 'running', name: 'some_tool', argsPreview: '{}',
      sections: [{ label: 'ARGUMENTS', code: '{}' }], callId: 'c3',
    })
    dispatchEvent({ type: 'tool_result', call_id: 'c3', tool: 'some_tool', content: 'the output' }, actions)
    const b = blocks[0] as any
    expect(b.state).toBe('success')
    expect(b.sections).toEqual([
      { label: 'ARGUMENTS', code: '{}' },
      { label: 'RESULT', code: 'the output' },
    ])
    expect(calls.markRunningStepDone).toHaveLength(1)
  })

  it('search_photos: appends a photo_grid block when results are present', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'tool', state: 'running', name: 'search_photos', argsPreview: '', sections: [], callId: 'c4' })
    const content = JSON.stringify({ query: 'beach', results: [{ id: 'p1', name: 'a.jpg', takenAt: '2024-01-01' }] })
    dispatchEvent({ type: 'tool_result', call_id: 'c4', tool: 'search_photos', content }, actions)
    const grid = blocks.find(b => b.type === 'photo_grid') as any
    expect(grid).toBeTruthy()
    expect(grid.query).toBe('beach')
    expect(grid.photos[0].thumbUrl).toBe('/v1/photos/assets/p1/thumbnail?size=small')
  })

  it('search_photos: malformed JSON content is swallowed, no photo_grid appended', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'tool', state: 'running', name: 'search_photos', argsPreview: '', sections: [], callId: 'c4' })
    expect(() => dispatchEvent({ type: 'tool_result', call_id: 'c4', tool: 'search_photos', content: 'not json' }, actions)).not.toThrow()
    expect(blocks.some(b => b.type === 'photo_grid')).toBe(false)
  })

  it('nimoos_search: appends a semantic_search block using the stashed query', () => {
    const { actions, blocks } = makeActions()
    ;(actions as any)._lastNimoosSearchQuery = 'cat photos'
    blocks.push({ type: 'tool', state: 'running', name: 'nimoos_search', argsPreview: '', sections: [], callId: 'c5' })
    const content = JSON.stringify({
      groups: { images: [{ asset_id: 'a1', name: 'cat.jpg', path: '/DATA/cat.jpg', score: 0.9 }], filenames: [], semantic: [] },
      stats: { total_candidates: 1 }, warnings: [],
    })
    dispatchEvent({ type: 'tool_result', call_id: 'c5', tool: 'nimoos_search', content }, actions)
    const sem = blocks.find(b => b.type === 'semantic_search') as any
    expect(sem).toBeTruthy()
    expect(sem.query).toBe('cat photos')
    expect(sem.images[0].assetId).toBe('a1')
  })

  it('nimoos_search: no matching results yields no semantic_search block', () => {
    const { actions, blocks } = makeActions()
    ;(actions as any)._lastNimoosSearchQuery = 'nothing'
    blocks.push({ type: 'tool', state: 'running', name: 'nimoos_search', argsPreview: '', sections: [], callId: 'c6' })
    const content = JSON.stringify({ groups: { images: [], filenames: [], semantic: [] }, stats: { total_candidates: 0 }, warnings: [] })
    dispatchEvent({ type: 'tool_result', call_id: 'c6', tool: 'nimoos_search', content }, actions)
    expect(blocks.some(b => b.type === 'semantic_search')).toBe(false)
  })
})

describe('dispatchEvent — message', () => {
  it('appends a static (non-streaming) md block, ending open streams first', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'thinking', text: 't', streaming: true, defaultOpen: true })
    dispatchEvent({ type: 'message', content: 'final answer' }, actions)
    expect(blocks[0]).toMatchObject({ streaming: false, defaultOpen: false })
    expect(blocks[1]).toEqual({ type: 'md', text: 'final answer' })
  })
})

describe('dispatchEvent — confirmation_required', () => {
  it('kind=mcp_tool appends an mcp_confirm block', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_tool', confirm_id: 'cf1',
      server: 'github', tool: 'search', remember_scope: 'server',
    }, actions)
    expect(blocks).toEqual([{
      type: 'mcp_confirm', confirmId: 'cf1', server: 'github', tool: 'search', rememberScope: 'server',
    }])
  })

  it('kind=mcp_tool defaults rememberScope to "tool" when absent', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'confirmation_required', kind: 'mcp_tool', confirm_id: 'cf2', server: 's', tool: 't' }, actions)
    expect(blocks[0]).toMatchObject({ rememberScope: 'tool' })
  })

  it('kind=mcp_install appends an mcp_install block', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'mcp_install', confirm_id: 'cf3', name: 'srv',
      transport: 'stdio', command: 'npx', args: ['-y', 'pkg'], url: '',
    }, actions)
    expect(blocks).toEqual([{
      type: 'mcp_install', confirmId: 'cf3', name: 'srv', transport: 'stdio',
      command: 'npx', args: ['-y', 'pkg'], url: '',
    }])
  })

  it('other kinds append a generic confirm block', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({
      type: 'confirmation_required', kind: 'shell', confirm_id: 'cf4',
      action: 'run', description: 'rm -rf tmp', command: 'rm -rf tmp',
    }, actions)
    expect(blocks).toEqual([{
      type: 'confirm', confirmId: 'cf4', action: 'run', description: 'rm -rf tmp', command: 'rm -rf tmp',
    }])
  })
})

describe('dispatchEvent — access_request', () => {
  it('appends an access_request block, ending open streams first', () => {
    const { actions, blocks } = makeActions()
    blocks.push({ type: 'md', text: 'x', streaming: true })
    dispatchEvent({
      type: 'access_request', confirm_id: 'ar1', path: '/DATA/secret', kind: 'file', reason: 'need it',
    }, actions)
    expect(blocks[0]).toMatchObject({ streaming: false })
    expect(blocks[1]).toEqual({
      type: 'access_request', confirmId: 'ar1', path: '/DATA/secret', kind: 'file', reason: 'need it',
    })
  })

  it('defaults kind to "folder" when absent', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'access_request', confirm_id: 'ar2', path: '/DATA' }, actions)
    expect(blocks[0]).toMatchObject({ kind: 'folder' })
  })
})

describe('dispatchEvent — max_turns_exceeded', () => {
  it('appends a max_turns block with resumed:false and does NOT touch streaming/setStreamingDone', () => {
    const { actions, blocks, calls } = makeActions()
    blocks.push({ type: 'md', text: 'x', streaming: true })
    dispatchEvent({ type: 'max_turns_exceeded', max_turns: 25 }, actions)
    // The still-streaming md block is untouched — this case does not call
    // endThinkingStreaming/endMessageStreaming (verbatim Vue2 behavior).
    expect(blocks[0]).toMatchObject({ streaming: true })
    expect(blocks[1]).toEqual({ type: 'max_turns', maxTurns: 25, resumed: false })
    expect(calls.setStreamingDone).toEqual([])
  })
})

describe('dispatchEvent — error', () => {
  it('appends an error tool block and calls setStreamingDone', () => {
    const { actions, blocks, calls } = makeActions()
    dispatchEvent({ type: 'error', content: 'kaboom' }, actions)
    expect(blocks).toEqual([{
      type: 'tool', state: 'error', name: 'agent',
      sections: [{ label: 'ERROR', code: 'kaboom' }],
    }])
    expect(calls.setStreamingDone).toHaveLength(1)
  })

  it('defaults content to "Unknown error" when absent', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'error' }, actions)
    expect(blocks[0]).toMatchObject({ sections: [{ label: 'ERROR', code: 'Unknown error' }] })
  })
})

describe('dispatchEvent — stats_final', () => {
  it('patches assistant stats with all fields present', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({
      type: 'stats_final', ttft_ms: 120, generation_ms: 300, total_ms: 420,
      output_tokens: 50, tokens_per_sec: 12.5,
    }, actions)
    expect(calls.patchAssistantStats).toEqual([[{
      ttftMs: 120, generationMs: 300, totalMs: 420, outputTokens: 50, tokensPerSec: 12.5,
    }]])
  })

  it('nullish-coalesces missing fields to null', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'stats_final' }, actions)
    expect(calls.patchAssistantStats).toEqual([[{
      ttftMs: null, generationMs: null, totalMs: null, outputTokens: null, tokensPerSec: null,
    }]])
  })

  it('patchAssistantStats is optional-chained (absent actions do not throw)', () => {
    const { actions } = makeActions({ patchAssistantStats: undefined })
    expect(() => dispatchEvent({ type: 'stats_final' }, actions)).not.toThrow()
  })
})

describe('dispatchEvent — done', () => {
  it('ends open thinking + md streams and calls setStreamingDone', () => {
    const { actions, blocks, calls } = makeActions()
    blocks.push({ type: 'thinking', text: 't', streaming: true, defaultOpen: true })
    blocks.push({ type: 'md', text: 'm', streaming: true })
    dispatchEvent({ type: 'done' }, actions)
    expect(blocks[0]).toMatchObject({ streaming: false, defaultOpen: false })
    expect(blocks[1]).toMatchObject({ streaming: false })
    expect(calls.setStreamingDone).toHaveLength(1)
  })
})

describe('dispatchEvent — staged_change (1c, guarded, absent in 1b)', () => {
  it('calls appendStagedChange with normalized fields when present', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({
      type: 'staged_change', run_id: 'r1', seq: 3, op: 'move', path: '/a', dst_path: '/b', size_bytes: 100,
    }, actions)
    expect(calls.appendStagedChange).toEqual([[{
      run_id: 'r1', seq: 3, op: 'move', path: '/a', dst_path: '/b', size_bytes: 100,
    }]])
  })

  it('defaults dst_path to null and size_bytes to 0', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'staged_change', run_id: 'r1', seq: 1, op: 'delete', path: '/a' }, actions)
    expect(calls.appendStagedChange).toEqual([[{
      run_id: 'r1', seq: 1, op: 'delete', path: '/a', dst_path: null, size_bytes: 0,
    }]])
  })

  it('is a no-op (does not throw) when actions.appendStagedChange is absent', () => {
    const { actions } = makeActions({ appendStagedChange: undefined })
    expect(() => dispatchEvent({ type: 'staged_change', run_id: 'r1', seq: 1, op: 'x', path: '/a' }, actions)).not.toThrow()
  })
})

describe('dispatchEvent — staged_batch (1c, guarded, absent in 1b)', () => {
  it('calls appendStagedChange once per item with batch_id/staged_id mapped in', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({
      type: 'staged_batch', run_id: 'r1', batch_id: 'b1',
      items: [
        { seq: 1, id: 's1', op: 'move', path: '/a', dst_path: '/a2', size_bytes: 10 },
        { seq: 2, id: 's2', op: 'delete', path: '/b' },
      ],
    }, actions)
    expect(calls.appendStagedChange).toEqual([
      [{ run_id: 'r1', seq: 1, staged_id: 's1', batch_id: 'b1', op: 'move', path: '/a', dst_path: '/a2', size_bytes: 10 }],
      [{ run_id: 'r1', seq: 2, staged_id: 's2', batch_id: 'b1', op: 'delete', path: '/b', dst_path: null, size_bytes: 0 }],
    ])
  })

  it('non-array items is a no-op', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'staged_batch', run_id: 'r1', batch_id: 'b1', items: 'nope' }, actions)
    expect(calls.appendStagedChange).toEqual([])
  })
})

describe('dispatchEvent — visible_resource_added (1c, guarded, absent in 1b)', () => {
  it('calls appendVisibleResource with path/kind', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'visible_resource_added', path: '/DATA/x', kind: 'file' }, actions)
    expect(calls.appendVisibleResource).toEqual([[{ path: '/DATA/x', kind: 'file' }]])
  })

  it('is a no-op when actions.appendVisibleResource is absent', () => {
    const { actions } = makeActions({ appendVisibleResource: undefined })
    expect(() => dispatchEvent({ type: 'visible_resource_added', path: '/x', kind: 'file' }, actions)).not.toThrow()
  })
})

describe('dispatchEvent — visible_resource_removed (1c, guarded, absent in 1b)', () => {
  it('calls removeVisibleResourceFromList with path', () => {
    const { actions, calls } = makeActions()
    dispatchEvent({ type: 'visible_resource_removed', path: '/DATA/x' }, actions)
    expect(calls.removeVisibleResourceFromList).toEqual([['/DATA/x']])
  })

  it('is a no-op when actions.removeVisibleResourceFromList is absent', () => {
    const { actions } = makeActions({ removeVisibleResourceFromList: undefined })
    expect(() => dispatchEvent({ type: 'visible_resource_removed', path: '/x' }, actions)).not.toThrow()
  })
})

describe('dispatchEvent — mcp_warning', () => {
  it('appends an mcp_warning block with server/error', () => {
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'mcp_warning', server: 'github', error: 'rate limited' }, actions)
    expect(blocks).toEqual([{ type: 'mcp_warning', server: 'github', error: 'rate limited' }])
  })
})

describe('dispatchEvent — default (unknown event type)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logs via console.debug and mutates nothing', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { actions, blocks } = makeActions()
    dispatchEvent({ type: 'some_future_event' }, actions)
    expect(spy).toHaveBeenCalledWith('[agentStream] unknown event type', 'some_future_event')
    expect(blocks).toEqual([])
  })
})
