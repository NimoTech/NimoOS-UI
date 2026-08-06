### Task 5: `dispatchEvent` reducer (verbatim 18-case port)

**Files:**
- Create: `src/ai/services/dispatchEvent.ts` + `src/ai/services/dispatchEvent.test.ts`

**Interfaces:**
- Consumes: Task 3 mappers, Task 4 `StreamActions`/`AgentBlock`.
- Produces: `dispatchEvent(event: Record<string, unknown>, actions: StreamActions): void` + local helpers `endThinkingStreaming`, `endMessageStreaming`. (Consumed by Task 6 transport.)

- [ ] **Step 1: Port `agentStream.spec.js` → `dispatchEvent.test.ts`.** Copy the reducer cases verbatim (TS). These tests build a fake `actions` object recording calls and assert per-event mutations. Keep every case.

- [ ] **Step 2: Run, verify fail** — `pnpm test -- dispatchEvent` → FAIL.

- [ ] **Step 3: Port `dispatchEvent` verbatim** from `agentStream.js:260-562` plus helpers `endThinkingStreaming` (47-52) and `endMessageStreaming` (57-62). Import mappers from `./streamMappers`. **Every one of these 18 cases must be present and behavior-identical** (this list IS the reviewer's completeness checklist):

  1. `user_message` — resume prefix: pushUserMessage + startAssistant + `actions.setBusy?.(true)`
  2. `thinking` — endMessageStreaming; append/patch streaming `thinking` block
  3. `message_delta` — endThinkingStreaming; append/patch streaming `md` block
  4. `tool_call` — endThinkingStreaming → `stripLeakedToolArgs` → endMessageStreaming; `nimoos_search` stashes `actions._lastNimoosSearchQuery`; 3 branches (mcp_call / terminal / generic tool) + pushActivityStep
  5. `tool_result` — match by `call_id` (fallback most-recent-running); mcp/terminal/generic patch; `search_photos`→buildPhotoGridBlock append; `nimoos_search`→buildSemanticSearchBlock append; markRunningStepDone
  6. `message` — non-streaming md fallback
  7. `confirmation_required` — 3 sub-kinds (mcp_tool→mcp_confirm / mcp_install / else confirm)
  8. `access_request` — access_request block
  9. `max_turns_exceeded` — max_turns block (no setStreamingDone)
  10. `error` — error tool block + setStreamingDone
  11. `stats_final` — `actions.patchAssistantStats?.(…)`
  12. `done` — end both + setStreamingDone
  13. `staged_change` — `actions.appendStagedChange?.(…)` (optional-chained; absent in 1b)
  14. `staged_batch` — `actions.appendStagedChange?.(…)` per item (absent in 1b)
  15. `visible_resource_added` — `actions.appendVisibleResource?.(…)` (absent in 1b)
  16. `visible_resource_removed` — `actions.removeVisibleResourceFromList?.(…)` (absent in 1b)
  17. `mcp_warning` — mcp_warning block
  18. `default` — `console.debug('[agentStream] unknown event type', …)`

  **Guarded actions (13-16, plus 1's setBusy, 11's patchAssistantStats) MUST use optional chaining** so absent 1b actions no-op. In 1b, `patchAssistantStats` and `setBusy` ARE present (Task 4); `appendStagedChange`/`appendVisibleResource`/`removeVisibleResourceFromList` are absent.

- [ ] **Step 4: Run, verify pass** — `pnpm test -- dispatchEvent` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/services/dispatchEvent.ts src/ai/services/dispatchEvent.test.ts
git commit -m "SP8-P1b: port dispatchEvent 18-case reducer (verbatim)"
```

---

