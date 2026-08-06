# Task 5 report — `dispatchEvent` reducer verbatim port

## What was ported

- `src/ai/services/dispatchEvent.ts` — verbatim TS port of Vue2
  `NimoOS-UI/src/views/AI/Agent/services/agentStream.js`:
  - `endThinkingStreaming` (lines 47-52), `endMessageStreaming` (lines 57-62) as
    local (unexported) module helpers.
  - `dispatchEvent(event, actions)` (lines 260-562) — the full 18-case switch.
- `src/ai/services/dispatchEvent.test.ts` — reducer test suite, 50 tests / 18
  describe groups (one per case + a shared `default` case), plus edge cases
  (empty content, missing call_id fallback, malformed JSON swallow, optional
  guards absent).

Imports (verified against actual export locations, not assumed):
- `buildSemanticSearchBlock` from `./searchMapper` (Task 3 re-exports it from
  `streamMappers.ts` too, but I imported it directly from `searchMapper` since
  that's its true home — matches the brief's own correction).
- `stripLeakedToolArgs`, `parseMcpToolName`, `parseShellResult`, `MCP_ERR_RE`,
  `buildPhotoGridBlock` from `./streamMappers` (Task 3).
- `AgentBlock`, `StreamActions` from `../types` (Task 4).

## Important deviation from the brief's Step 1 — flagged, not guessed on

The brief says "Port the reducer spec from Vue2 `agentStream.spec.js` →
`dispatchEvent.test.ts` — carry every reducer case assertion." I read that
file (`NimoOS-UI/src/views/AI/Agent/services/__tests__/agentStream.spec.js`)
and also `agentStream.refresh.spec.js` and `Agent.spec.js`, and grepped the
whole Vue2 tree for any test that exercises `dispatchEvent` itself:

```
grep -rl "dispatchEvent" NimoOS-UI/src/   # only agentStream.js itself + 2 unrelated hits
```

**No such spec exists in Vue2.** `agentStream.spec.js` only covers the mapper
family (`migrateLegacyMessages`, `buildPhotoGridBlock`, `buildSemanticSearchBlock`)
— which Task 3 already ported verbatim into `streamMappers.test.ts`. There has
never been a dedicated reducer/`actions`-recorder test for `dispatchEvent` in
the Vue2 codebase; the 18-case switch has only ever been covered by manual QA
and indirectly by `Agent.spec.js`'s component-level flows.

This isn't an import-location ambiguity or a logic ambiguity in the reducer
itself (the switch body is unambiguous, verbatim-portable code) — it's that
the specific artifact the brief told me to copy doesn't exist. Rather than
stop and ask (which the reducer-logic escalation clause is really guarding
against — getting a *case wrong*), I wrote a fresh test suite driven
line-by-line off the actual `agentStream.js` switch body and the brief's own
18-case checklist, with a fake `actions` recorder whose `patchBlock` mimics
the real store's reverse-scan-most-recent semantics (`agentStore.ts:190-209`,
itself a verbatim port of Vue2 `agentStore.js:88-104`). Noting this here per
the report requirement; happy to redo if this call was wrong.

## TDD evidence

**RED** (module missing):
```
pnpm test -- dispatchEvent
...
Error: Failed to resolve import "./dispatchEvent" from "src/ai/services/dispatchEvent.test.ts"
FAIL  src/ai/services/dispatchEvent.test.ts
Test Files  1 failed (1)
```

**GREEN** (after writing `dispatchEvent.ts`):
```
pnpm test -- dispatchEvent
Test Files  1 passed (1)
     Tests  50 passed (50)
```

**Full suite + type-check** (post-implementation, pre-commit):
```
pnpm test
Test Files  229 passed (229)
     Tests  1368 passed (1368)

pnpm exec vue-tsc --noEmit
(no output — clean)
```

## 18-case completeness checklist (reviewer gate)

1. ✓ `user_message` — resume prefix: `pushUserMessage(text)` + `startAssistant()` +
   `actions.setBusy?.(true)`, gated on non-empty `content`. Tested empty-content
   no-op and `setBusy` absence.
2. ✓ `thinking` — `endMessageStreaming` first; find streaming `thinking` block
   and append `old.text + text` (no `|| ''` fallback — verbatim, matches Vue2
   exactly, not "hardened"); else `appendBlock` new `{type:'thinking', text,
   streaming:true, defaultOpen:true}`.
3. ✓ `message_delta` — `endThinkingStreaming` first; find streaming `md` block,
   append `(old.text||'') + text` (fallback present here, verbatim); else
   append new `{type:'md', text, streaming:true}`.
4. ✓ `tool_call` — order preserved: `endThinkingStreaming` → `stripLeakedToolArgs`
   → `endMessageStreaming`; `nimoos_search` stashes `_lastNimoosSearchQuery`
   *before* the mcp/branch dispatch (matches Vue2 ordering — the stash still
   happens even though `nimoos_search` itself falls into the generic-tool
   branch, not the mcp branch); 3 branches tested individually (mcp_call/
   terminal/generic tool) + `pushActivityStep` called in all 3 (mcp branch
   `break`s right after its own `pushActivityStep`, others fall through to the
   shared one at the bottom — verbatim).
5. ✓ `tool_result` — call_id-first matching with "most-recent-running"
   fallback tested for the mcp branch; 3 mutually-exclusive branches (mcp
   patch+`markRunningStepDone`+`break` / terminal patch+durationMs / generic
   tool RESULT-section append) tested; `search_photos`→`buildPhotoGridBlock`
   append tested (incl. malformed-JSON swallow); `nimoos_search`→
   `buildSemanticSearchBlock` append tested using the stashed query;
   `markRunningStepDone()` unconditional at the end for non-mcp branches.
6. ✓ `message` — non-streaming md fallback, ends both streams first.
7. ✓ `confirmation_required` — 3 sub-kinds tested: `mcp_tool`→`mcp_confirm`
   (incl. `rememberScope` default `'tool'`), `mcp_install`→`mcp_install`,
   else→`confirm`.
8. ✓ `access_request` — `access_request` block, `kind` defaults to `'folder'`,
   ends both streams first.
9. ✓ `max_turns_exceeded` — `max_turns` block with `resumed:false`; **explicitly
   verified it does NOT call `endThinkingStreaming`/`endMessageStreaming`/
   `setStreamingDone`** (test asserts a pre-seeded streaming block is left
   untouched) — matches Vue2, which has no such calls in this case.
10. ✓ `error` — `tool`/`state:'error'`/`name:'agent'` block with `ERROR`
    section (`content` defaults to `'Unknown error'`) + `setStreamingDone()`.
11. ✓ `stats_final` — `actions.patchAssistantStats?.(...)` with `??  null` on
    all 5 fields; tested both fully-populated and all-missing; tested absence
    of `patchAssistantStats` doesn't throw.
12. ✓ `done` — ends both streams + `setStreamingDone()`.
13. ✓ `staged_change` — `actions.appendStagedChange?.(...)`, `dst_path||null`,
    `size_bytes||0` defaults; absence doesn't throw.
14. ✓ `staged_batch` — iterates `event.items` (guarded by `Array.isArray`),
    one `appendStagedChange?.()` call per item with `staged_id`/`batch_id`
    mapped in; non-array `items` is a no-op.
15. ✓ `visible_resource_added` — `actions.appendVisibleResource?.({path,kind})`.
16. ✓ `visible_resource_removed` — `actions.removeVisibleResourceFromList?.(path)`.
17. ✓ `mcp_warning` — `mcp_warning` block with `server`/`error`.
18. ✓ `default` — `console.debug('[agentStream] unknown event type', event.type)`,
    verified via `vi.spyOn(console, 'debug')`, and that no block mutation occurs.

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/dispatchEvent.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/dispatchEvent.test.ts` (new)

Commit: `43c3394` — "SP8-P1b: port dispatchEvent 18-case reducer (verbatim)"

## Self-review

- Diffed every case against `agentStream.js:260-562` line by line while
  writing; re-read the Vue2 source a second time after finishing the TS file
  to catch drift (in particular: case 2's missing `|| ''` fallback vs case
  3's present one — this asymmetry is real in Vue2 and I preserved it exactly
  rather than "fixing" it).
- `patchBlock` predicate signatures cast to `(b: AgentBlock) => boolean` with
  `!!b.streaming` coercions (matches the style Task 3 already established in
  `streamMappers.ts` for the same `AgentBlock`-is-loosely-typed reason).
- No `?.`/`??` was added anywhere the Vue2 source didn't have it — the only
  optional-chaining is on the 5 explicitly-guarded actions per the brief.
- `vue-tsc --noEmit` clean, full 1368-test suite green, no regressions in any
  other AI-area test file.
- No theme/color code — this module is pure logic, as required.

## Concerns

- The Step-1 "port the spec" instruction couldn't be followed literally
  because the named source spec doesn't test `dispatchEvent`; see the
  deviation note above. If a reviewer wants a different test-authoring
  approach (e.g. deriving cases from `Agent.spec.js`'s integration-level
  assertions instead), flag it and I'll rework.
- `dispatchEvent.ts` casts the incoming `event` to `any` at the top
  (`const e = event as any`) rather than threading narrow types through each
  case — this mirrors the loose-typing style Task 3 used for `AgentBlock`
  field access, and keeps the port textually close to the untyped Vue2
  source, but it does mean case-specific event-shape typos wouldn't be
  caught by `tsc`. The test suite is the safety net for that instead.
- `tool_call`'s `nimoos_search` stash writes `_lastNimoosSearchQuery` directly
  onto the `actions` object (`(actions as any)._lastNimoosSearchQuery = ...`),
  matching Vue2's mutation of the plain `actions` object passed in by the
  caller. This is a transient/stateful side channel on what's otherwise a
  stateless-looking parameter — worth keeping in mind for Task 6's transport
  layer, which must reuse the same `actions` instance across the whole SSE
  stream (not recreate it per event) for this to work, exactly as Vue2 does.
