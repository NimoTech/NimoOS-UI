// 1:1 port from Vue2 src/views/AI/Agent/services/agentStream.js:260-562 (dispatchEvent
// 18-case switch) + 47-52 (endThinkingStreaming) + 57-62 (endMessageStreaming).
// This reducer translates Python agent SSE events into store mutations — highest-risk
// logic, case-by-case alignment with Vue2 behavior, no ?./?? guards that Vue2 doesn't have.
import { buildSemanticSearchBlock } from './searchMapper'
import { stripLeakedToolArgs, parseMcpToolName, parseShellResult, MCP_ERR_RE, buildPhotoGridBlock } from './streamMappers'
import type { AgentBlock, StreamActions } from '../types'

// Helper: when a non-thinking event arrives mid-stream, mark any open thinking
// block as no-longer-streaming so the caret stops blinking on it.
function endThinkingStreaming(actions: StreamActions): void {
  actions.patchBlock(
    b => b.type === 'thinking' && !!b.streaming,
    () => ({ streaming: false, defaultOpen: false }),
  )
}

// Same idea for message blocks: a message-delta stream gets terminated when
// the next non-message event (tool, confirm, error) arrives, OR when the run
// hits 'done'.
function endMessageStreaming(actions: StreamActions): void {
  actions.patchBlock(
    b => b.type === 'md' && !!b.streaming,
    () => ({ streaming: false }),
  )
}

// Translates a Python agent SSE event into store mutations.
// `actions` must implement: appendBlock, patchBlock, pushActivityStep,
// markRunningStepDone, setStreamingDone, pushUserMessage, startAssistant.
export function dispatchEvent(event: Record<string, unknown>, actions: StreamActions): void {
  const e = event as any
  switch (e.type) {
    case 'user_message': {
      // Resume-stream prefix: the user message that triggered the run.
      // The frontend has just opened a session that already had a run going
      // (or finished while the page was closed); we need to render the user
      // turn before the assistant's events flow in.
      const text = e.content || ''
      if (text) {
        actions.pushUserMessage(text)
        actions.startAssistant()
        actions.setBusy?.(true)
      }
      break
    }
    case 'thinking': {
      endMessageStreaming(actions)
      const text = e.content || ''
      const found = actions.patchBlock(
        b => b.type === 'thinking' && !!b.streaming,
        (old: any) => ({ text: old.text + text }),
      )
      if (!found) {
        actions.appendBlock({ type: 'thinking', text, streaming: true, defaultOpen: true })
      }
      break
    }

    case 'message_delta': {
      // Token-by-token append into a single streaming md block. If the most
      // recent block isn't a streaming md (e.g. a tool ran in between),
      // start a new one — this matches the SDK's per-turn semantics.
      endThinkingStreaming(actions)
      const text = e.content || ''
      const found = actions.patchBlock(
        b => b.type === 'md' && !!b.streaming,
        (old: any) => ({ text: (old.text || '') + text }),
      )
      if (!found) {
        actions.appendBlock({ type: 'md', text, streaming: true })
      }
      break
    }

    case 'tool_call': {
      endThinkingStreaming(actions)
      stripLeakedToolArgs(actions, e.args)
      endMessageStreaming(actions)
      // Track the query for nimoos_search so tool_result can reference it.
      if (e.tool === 'nimoos_search') {
        const args = e.args || {}
        ;(actions as any)._lastNimoosSearchQuery = args.query || ''
      }
      const mcp = parseMcpToolName(e.tool)
      if (mcp) {
        actions.appendBlock({
          type: 'mcp_call',
          state: 'running',
          server: mcp.server,
          tool: mcp.tool,
          args: JSON.stringify(e.args || {}, null, 2),
          callId: e.call_id || '',
        })
        actions.pushActivityStep({ name: e.tool || 'tool' })
        break
      }
      if (e.tool === 'run_command') {
        const args = e.args || {}
        actions.appendBlock({
          type: 'terminal',
          state: 'running',
          command: args.command || '',
          cwd: '/work',
          shell: 'bash',
          sandbox: 'nimo-sandbox',
          lines: [],
          startedAt: Date.now(),
          callId: e.call_id || '',
        })
      } else {
        actions.appendBlock({
          type: 'tool',
          state: 'running',
          name: e.tool || 'tool',
          argsPreview: JSON.stringify(e.args || {}).slice(0, 80),
          sections: [
            { label: 'ARGUMENTS', code: JSON.stringify(e.args || {}, null, 2) },
          ],
          callId: e.call_id || '',
        })
      }
      actions.pushActivityStep({ name: e.tool || 'tool' })
      break
    }

    case 'tool_result': {
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      // Match the result back to its originating tool_call by call_id, so that
      // parallel tool calls don't get their outputs swapped. Fall back to
      // "most recent running" only when the backend didn't send a call_id
      // (e.g. older agent versions).
      const callId = e.call_id || ''
      const matchTerm = callId
        ? (b: AgentBlock) => b.type === 'terminal' && b.callId === callId
        : (b: AgentBlock) => b.type === 'terminal' && b.state === 'running'
      const matchTool = callId
        ? (b: AgentBlock) => b.type === 'tool' && b.callId === callId
        : (b: AgentBlock) => b.type === 'tool' && b.state === 'running'

      const matchMcp = callId
        ? (b: AgentBlock) => b.type === 'mcp_call' && b.callId === callId
        : (b: AgentBlock) => b.type === 'mcp_call' && b.state === 'running'
      const patchedMcp = actions.patchBlock(matchMcp, () => ({
        state: MCP_ERR_RE.test(e.content || '') ? 'error' : 'success',
        result: e.content || '',
      }))
      if (patchedMcp) { actions.markRunningStepDone(); break }

      const patchedTerm = actions.patchBlock(
        matchTerm,
        (old: any) => ({
          ...parseShellResult(e.content || ''),
          durationMs: old.startedAt ? Date.now() - old.startedAt : undefined,
        }),
      )
      if (!patchedTerm) {
        actions.patchBlock(
          matchTool,
          (old: any) => ({
            state: 'success',
            sections: [...(old.sections || []), { label: 'RESULT', code: e.content || '' }],
          }),
        )
      }
      // Inject photo_grid block when search_photos returns results. Shares
      // buildPhotoGridBlock with history-load reconstruction so the live grid
      // and the rehydrated grid are always identical.
      const toolName = e.tool || ''
      if (toolName === 'search_photos') {
        try {
          const parsed = JSON.parse(e.content || '{}')
          const block = buildPhotoGridBlock(parsed, '')
          if (block) actions.appendBlock(block)
        } catch (_) { /* malformed JSON — skip grid */ }
      }
      // Inject semantic_search block when nimoos_search returns results. Shares
      // buildSemanticSearchBlock with history-load reconstruction so the live
      // card and the rehydrated card are always identical.
      if (toolName === 'nimoos_search') {
        try {
          const parsed = JSON.parse(e.content || '{}')
          // Recover the query from the most recent nimoos_search tool_call arguments
          const query = (actions as any)._lastNimoosSearchQuery || ''
          const block = buildSemanticSearchBlock(parsed, query)
          if (block) actions.appendBlock(block)
        } catch (_) { /* malformed JSON — skip semantic search block */ }
      }
      actions.markRunningStepDone()
      break
    }

    case 'message':
      // Non-streaming fallback (reasoning-only models or message_output_item
      // with no preceding deltas). Append as a static md block.
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      actions.appendBlock({ type: 'md', text: e.content || '' })
      break

    case 'confirmation_required':
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      if (e.kind === 'mcp_tool') {
        actions.appendBlock({
          type: 'mcp_confirm',
          confirmId: e.confirm_id || '',
          server: e.server || '',
          tool: e.tool || '',
          rememberScope: e.remember_scope || 'tool',
        })
      } else if (e.kind === 'mcp_install') {
        actions.appendBlock({
          type: 'mcp_install',
          confirmId: e.confirm_id || '',
          name: e.name || '',
          transport: e.transport || '',
          command: e.command || '',
          args: e.args || [],
          url: e.url || '',
        })
      } else if (e.kind === 'mcp_elicit_form') {
        // When the backend bounces a previous answer it re-sends the same question
        // with a NEW confirm_id -- so this is always a fresh card, never a patch of
        // an existing one. The old card already resolved and is frozen on "sent".
        actions.appendBlock({
          type: 'mcp_elicit_form',
          confirmId: e.confirm_id || '',
          server: e.server || '',
          message: e.message || '',
          fields: Array.isArray(e.fields) ? e.fields : [],
          error: e.error || '',
        })
      } else if (e.kind === 'mcp_elicit_url') {
        actions.appendBlock({
          type: 'mcp_elicit_url',
          confirmId: e.confirm_id || '',
          server: e.server || '',
          message: e.message || '',
          url: e.url || '',
          host: e.host || '',
          // Punycode spelling of host. The backend only sends this when it differs
          // from `host` -- i.e. exactly the homograph case the user cannot tell
          // apart by eye (see elicitation.py::_host_flags).
          hostAscii: e.host_ascii || '',
          punycode: !!e.punycode,
          insecure: !!e.insecure,
        })
      } else {
        actions.appendBlock({
          type: 'confirm',
          confirmId: e.confirm_id || '',
          action: e.action || '',
          description: e.description || '',
          command: e.command || '',
        })
      }
      break

    case 'access_request':
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      actions.appendBlock({
        type: 'access_request',
        confirmId: e.confirm_id || '',
        path: e.path || '',
        kind: e.kind || 'folder',
        reason: e.reason || '',
      })
      break

    case 'judging': {
      // Mirror of Vue2 agentStream.js (2026-08-21): the local safety judge is
      // inspecting a gray-zone command / upload — up to ~20s on a busy model.
      // Without this block the agent just looks stalled; the follow-up
      // `judged` says how it ended (allow → ran with no click).
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      actions.appendBlock({
        type: 'judge',
        kind: e.kind || 'shell',
        command: e.command || '',
        host: e.host || '',
        verdict: '',
        streaming: true,
      })
      break
    }

    case 'judged': {
      const found = actions.patchBlock(
        (b) => b.type === 'judge' && !!b.streaming,
        () => ({ verdict: e.verdict || '', streaming: false }),
      )
      if (!found) {
        // Replay after refresh can deliver just the tail — render a resolved
        // row rather than dropping the record.
        actions.appendBlock({
          type: 'judge',
          kind: e.kind || 'shell',
          command: e.command || '',
          host: e.host || '',
          verdict: e.verdict || '',
          streaming: false,
        })
      }
      break
    }

    case 'max_turns_exceeded':
      actions.appendBlock({
        type: 'max_turns',
        maxTurns: e.max_turns || 0,
        resumed: false,
      })
      break

    case 'error':
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      actions.appendBlock({
        type: 'tool',
        state: 'error',
        name: 'agent',
        sections: [{ label: 'ERROR', code: e.content || 'Unknown error' }],
      })
      actions.setStreamingDone()
      break

    case 'stats_final':
      actions.patchAssistantStats?.({
        ttftMs: e.ttft_ms ?? null,
        generationMs: e.generation_ms ?? null,
        totalMs: e.total_ms ?? null,
        outputTokens: e.output_tokens ?? null,
        tokensPerSec: e.tokens_per_sec ?? null,
      })
      break

    case 'done':
      endThinkingStreaming(actions)
      endMessageStreaming(actions)
      // A judge block whose `judged` never arrived (crash, disconnect) must
      // not spin forever.
      actions.patchBlock(
        (b) => b.type === 'judge' && !!b.streaming,
        () => ({ streaming: false }),
      )
      actions.setStreamingDone()
      break

    case 'staged_change':
      actions.appendStagedChange?.({
        run_id: e.run_id,
        seq: e.seq,
        op: e.op,
        path: e.path,
        dst_path: e.dst_path || null,
        size_bytes: e.size_bytes || 0,
      })
      break

    case 'staged_batch':
      if (Array.isArray(e.items)) {
        e.items.forEach((it: any) => {
          actions.appendStagedChange?.({
            run_id: e.run_id,
            seq: it.seq,
            staged_id: it.id,
            batch_id: e.batch_id,
            op: it.op,
            path: it.path,
            dst_path: it.dst_path || null,
            size_bytes: it.size_bytes || 0,
          })
        })
      }
      break

    case 'visible_resource_added':
      actions.appendVisibleResource?.({
        path: e.path,
        kind: e.kind,
      })
      break

    case 'visible_resource_removed':
      actions.removeVisibleResourceFromList?.(e.path)
      break

    case 'mcp_warning':
      actions.appendBlock({
        type: 'mcp_warning',
        server: e.server || '',
        error: e.error || '',
      })
      break

    default:
      // eslint-disable-next-line no-console
      console.debug('[agentStream] unknown event type', e.type)
  }
}
