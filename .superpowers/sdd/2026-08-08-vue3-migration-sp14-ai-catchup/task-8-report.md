# Task 8 report — #141 MCP protocol version probe

## Commits

1. `35a4006` — `feat(ai): show which MCP protocol version a server negotiated`
   Files: `src/ai/types/mcpServer.ts`, `src/ai/util/mcpProtocol.ts` (new),
   `src/ai/util/mcpProtocol.test.ts` (new), `src/ai/util/mcpErrorKey.ts`,
   `src/ai/util/mcpErrorKey.test.ts`, `src/ai/components/settings/mcp/McpServerDetail.vue`,
   `src/ai/components/settings/mcp/McpServerDetail.test.ts`, `src/ai/styles/mcp-styles.scss`,
   `src/i18n/zh_cn.ai.ts`, `src/i18n/en_us.ai.ts`.

2. `ebd525c` — `fix(service): keep the MCP probe timeout above the layers beneath it`
   Files: `packages/service/src/ai.ts`, `packages/service/src/ai.test.ts` — alone, as required
   (that package is being edited on another branch; kept independently takeable/droppable).

Working tree after both commits: clean except the pre-existing, untouched
`.superpowers/sdd/2026-08-08-vue3-migration-sp14-ai-catchup/progress.md` modification (not part of
this task's file list, left alone).

## Import path

`McpServerDetail.vue` lives at `src/ai/components/settings/mcp/McpServerDetail.vue`. It already
imports `mcpErrorKey` (in `src/ai/util/`) as `'../../../util/mcpErrorKey'` — three levels up
(`mcp/` → `settings/` → `components/` → `ai/`), then into `util/`. `mcpProtocol.ts` sits in the
same `src/ai/util/` directory, so it uses the identical relative depth:
`import { protocolLine } from '../../../util/mcpProtocol'`.

## TDD sequence

**Step 2 (brief) — red before green.** Ran the new failing test first:

```
pnpm exec vitest run src/ai/util/mcpProtocol.test.ts
```

Failure (module didn't exist yet):

```
FAIL  src/ai/util/mcpProtocol.test.ts [ src/ai/util/mcpProtocol.test.ts ]
Error: Failed to resolve import "./mcpProtocol" from "src/ai/util/mcpProtocol.test.ts".
Does the file exist?
```

After implementing `mcpProtocol.ts` and widening `McpTestView`/`toTestView`, re-ran
`mcpProtocol.test.ts` + `mcpErrorKey.test.ts` together and hit two *pre-existing* test failures
in `mcpErrorKey.test.ts` — the old success-case assertions used the narrower `McpTestView` shape
and `toEqual` is strict, so they broke the moment the three new fields were added:

```
FAIL  src/ai/util/mcpErrorKey.test.ts > toTestView ... > 成功
FAIL  src/ai/util/mcpErrorKey.test.ts > toTestView ... > 成功但 tools 缺失 → 空数组,tool_count 缺失 → 0
AssertionError: expected { ok: true, toolCount: +0, … } to deeply equal { ok: true, toolCount: +0, tools: [] }
```

Fixed by adding `protocolEra: '', protocolVersion: '', supportedVersions: []` to those two
existing expectations (not in the brief's step list, but necessary — the type change is a hard
break for any exhaustive `toEqual` on the success shape). Then added the brief's three new
`toTestView` cases. Re-ran — all green (see below).

Same pattern in `packages/service/src/ai.test.ts`: the existing test asserted
`{ timeout: 110000 }`; updated it in place to `{ timeout: 135000 }` (one function, one timeout —
updating beats adding a duplicate/contradictory assertion).

## Test commands and results

```
pnpm exec vitest run src/ai/util/mcpProtocol.test.ts src/ai/util/mcpErrorKey.test.ts \
  src/ai/components/settings/mcp/ src/i18n/parity.test.ts
→ Test Files  6 passed (6) / Tests  129 passed (129)
```

```
pnpm exec vitest run packages/service/src/ai.test.ts
→ Test Files  1 passed (1) / Tests  67 passed (67)
```

Combined final re-check across all target files (both commits together):

```
pnpm exec vitest run src/ai/util/mcpProtocol.test.ts src/ai/util/mcpErrorKey.test.ts \
  src/ai/components/settings/mcp/ src/i18n/parity.test.ts packages/service/src/ai.test.ts
→ Test Files  7 passed (7) / Tests  196 passed (196)
```

`pnpm exec vue-tsc --noEmit` — clean (no output) both before and after the `packages/service`
edit; no hardlink/stale-signature issue surfaced, so `pnpm install` was not needed.

## Notable implementation decisions

- Every Chinese comment reproduced from the brief's code blocks was translated to English on
  landing, including the `mcpProtocol.ts` file header and the timeout-chain explanation in
  `packages/service/src/ai.ts` (axios > Go > Python nesting, and why the layer owning the
  subprocess/socket must give up first).
- `.mcp-test-proto` / `.mcp-test-proto.is-legacy` styles use only existing tokens
  (`--text-secondary`, `--warning`) per constraint; no hex/rgb/named colors, no `*/`-adjacent
  comment issue.
- New i18n keys (`aiMcpSrvProtoOnly`, `aiMcpSrvProtoAlso`, `aiMcpSrvProtoLegacy`,
  `aiMcpSrvTestErrConnectTimeout`) added verbatim to both `zh_cn.ai.ts` and `en_us.ai.ts`;
  `aiMcpSrvTestStdioHint` reworded in both to drop the hard-coded duration, matching the brief's
  exact wording table.
- `McpServerDetail.test.ts` kept its existing `createI18n(...)` construction (per instructions);
  no new `createI18n` was added anywhere. The three new component test descriptions were written
  in English (new content, not legacy Chinese) per the hard comment-language rule, even though
  the surrounding pre-existing tests in that file remain in Chinese (left untouched, out of
  scope).
- `packages/service/src/ai.test.ts`'s pre-existing `testMCPServer` timeout assertion was updated
  from `110000` to `135000` rather than adding a second, contradictory assertion for the same
  call.
