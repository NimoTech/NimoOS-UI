# Task 3 report — stream mapper family port

## What was ported

- **`src/ai/types.ts`** (new, no imports) — the shared contracts block verbatim
  from the plan: `AgentBlock`, `AgentStats`, `AttachmentRef`, `AgentMessage`,
  `StreamActions`.
- **`src/ai/services/searchMapper.ts`** — 1:1 port of
  `NimoOS-UI/src/service/searchMapper.js` (`buildSemanticSearchBlock`). Logic
  untouched: groups→images/files/passages mapping, scope derivation from path
  segments, terms tokenization, `null` guard when there are no results.
- **`src/ai/services/streamMappers.ts`** — the pure mapper half of
  `NimoOS-UI/src/views/AI/Agent/services/agentStream.js`:
  `stripLeakedToolArgs` (L72-89), `migrateLegacyMessages` (L91-98),
  `mcpCallFromToolBlock` (L105-120), `expandHistoryBlock` (L122-136),
  `photoGridFromToolBlock` (L138-151), `buildPhotoGridBlock` (L156-169),
  `semanticSearchFromToolBlock` (L171-184), `migrateLegacyBlock` (L188-211),
  `parseMcpToolName` (L215-221), `MCP_ERR_RE` (L225), `parseShellResult`
  (L230-248), `toLines` (L250-255), `formatMs` (L654-658). Re-exports
  `buildSemanticSearchBlock` from `./searchMapper` (mirrors Vue2's
  `export { buildSemanticSearchBlock }` at L186). `dispatchEvent` /
  `runAgentRun` / `attachAgentStream` / `consumeSSE` (the reducer + SSE
  transport half of `agentStream.js`) are intentionally **not** ported here —
  those belong to Task 5 (reducer) and Task 6 (transport).
- **`src/ai/services/streamMappers.test.ts`** (new) — ported the mapper-relevant
  cases from `NimoOS-UI/src/views/AI/Agent/services/__tests__/agentStream.spec.js`
  verbatim (fixtures, assertions unchanged): `migrateLegacyMessages` nimoos_search
  reconstruction (hit + empty + in-flight), `migrateLegacyMessages` run_command
  regression, `migrateLegacyMessages` search_photos reconstruction (hit + empty),
  `buildPhotoGridBlock` (null/mapped/fallback-query), `buildSemanticSearchBlock`
  (null/mapped). Added new cases (no prior Vue2 spec coverage existed for these,
  per the brief's minimum list) for `parseMcpToolName` (valid, non-mcp, non-string),
  `expandHistoryBlock` directly on a `nimoos_search` tool block, and
  `parseShellResult` (success exit, non-zero exit, timeout kill, unrecognized
  content).

## TDD evidence

**RED** (`pnpm test -- streamMappers`, before `streamMappers.ts` existed):
```
FAIL  src/ai/services/streamMappers.test.ts [ src/ai/services/streamMappers.test.ts ]
Error: Failed to resolve import "./streamMappers" from "src/ai/services/streamMappers.test.ts". Does the file exist?
```

**GREEN** (`pnpm test -- streamMappers`, after port):
```
Test Files  1 passed (1)
     Tests  19 passed (19)
```

**Full suite** (`pnpm test`): `Test Files 228 passed (228)` / `Tests 1312 passed (1312)`.

**Type-check** (`pnpm exec vue-tsc --noEmit`): clean, no output.

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/types.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/searchMapper.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/streamMappers.ts` (new)
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/services/streamMappers.test.ts` (new)

Commit: `1755dba` — "SP8-P1b: port stream mappers (searchMapper + migrate/parse family)"

## Self-review

- Verified byte-for-byte logic parity against the Vue2 source for every ported
  function — only mechanical typing added (`unknown`/`any` casts at JSON-parse
  boundaries, `AgentBlock`/`Partial<AgentBlock>` return types, `as const` on
  `toLines`' `stream: 'stdout'` literal). No behavioral changes.
- `stripLeakedToolArgs`/`patchBlock` predicate uses `!!b.streaming` (types.ts
  declares `AgentBlock` values as `unknown`, so a truthy-check keeps identical
  runtime semantics to Vue2's untyped `b.streaming`).
- Did not touch Task 2's `groupBlocks.ts`/`timelineMath.ts` or their local
  `AgentBlockLike` types, per instruction — confirmed via `git diff` scope and
  `git status` before commit (only the 4 new files staged).
- Confirmed no existing Vue2 spec coverage for `parseMcpToolName`/
  `parseShellResult`/`expandHistoryBlock` in isolation (grepped
  `NimoOS-UI/src` for those identifiers in `*.spec.js`/`*.js` — only
  `agentStream.js` itself matched); wrote new cases per the brief's minimum
  list rather than inventing extra assertions beyond what's asked.

## Concerns

- None blocking. One structural note for future tasks: `streamMappers.ts`'s
  `AgentBlock` values are typed as `unknown` per-field (`{ type: string; [k:
  string]: unknown }`), so several internal helpers cast through `any` (e.g.
  `(b.sections as any[])`) to read nested shape — this matches the brief's
  produced signatures exactly and is consistent with how Task 2's placeholder
  types work; Task 5 (reducer) will need the same style when it consumes
  `StreamActions`.
