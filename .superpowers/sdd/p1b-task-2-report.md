# P1b Task 2 Report: groupBlocks + timelineMath pure module port

## What was ported

Two pure, dependency-free logic modules from Vue2 `NimoOS-UI/src/views/AI/Agent/stream/`
into New-UI's `src/ai/util/`, each with its spec ported verbatim to TS/vitest:

1. **`groupBlocks.ts`** (from `stream/groupBlocks.js:1-22`)
   - `groupBlocks(blocks)`: collapses consecutive `thinking`/`tool` blocks into a single
     `{__process: true, steps: []}` group; all other block types pass through in order,
     unchanged; non-array input → `[]`.
   - Logic copied verbatim: `STEP_TYPES = new Set(['thinking', 'tool'])`, single loop with
     a `current` group pointer reset whenever a non-step block is hit.

2. **`timelineMath.ts`** (from `stream/timelineMath.js:1-35`)
   - `DEFAULTS = { base: 14, amp: 36, spread: 22 }`
   - `tickWidth(distancePx, opts?)`: Gaussian-decay dock width; `null` distance → `base`.
   - `clip(str, n = 15)`: ellipsis-truncate to `n` chars.
   - `ticksFromMessages(messages)`: maps message list to `{role, id, text}` ticks
     (`role='user'` iff `m.role==='user'`, else `'ai'`); private `textOf` helper pulls
     string content or first `md`/`text` block.
   - All four exports/logic copied verbatim, only mechanically typed.

Both modules needed local structural types since `src/ai/types.ts` does not exist yet
(owned by Task 4): `AgentBlockLike` (`{type: string; [k: string]: unknown}`) in
groupBlocks.ts, and `AgentMessageLike`/`TickWidthOpts`/`Tick` in timelineMath.ts — same
pattern already established by the existing `userMessageView.ts` (which defines its own
local `UserMsgBlock`/`UserMsgLike`). This is a temporary local convenience; Task 4/10 are
expected to swap these for the shared `AgentBlock`/`AgentMessage` types once `types.ts`
lands.

`userMessageView.ts` was not modified — only its test was re-run to confirm no regression.

## Files changed

- `src/ai/util/groupBlocks.ts` (new)
- `src/ai/util/groupBlocks.test.ts` (new)
- `src/ai/util/timelineMath.ts` (new)
- `src/ai/util/timelineMath.test.ts` (new)

## TDD evidence

### groupBlocks

**RED** — `pnpm test -- groupBlocks` (spec ported, module not yet created):
```
FAIL  src/ai/util/groupBlocks.test.ts [ src/ai/util/groupBlocks.test.ts ]
Error: Failed to resolve import "./groupBlocks" from "src/ai/util/groupBlocks.test.ts".
Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** — after porting `groupBlocks.ts`, `pnpm test -- groupBlocks`:
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### timelineMath

**RED** — `pnpm test -- timelineMath` (spec ported, module not yet created):
```
FAIL  src/ai/util/timelineMath.test.ts [ src/ai/util/timelineMath.test.ts ]
Error: Failed to resolve import "./timelineMath" from "src/ai/util/timelineMath.test.ts".
Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN** — after porting `timelineMath.ts`, `pnpm test -- timelineMath`:
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### userMessageView (unchanged, confirmation only)

`pnpm test -- userMessageView`:
```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### Full suite + type-check (before commit)

`pnpm test`:
```
 Test Files  227 passed (227)
      Tests  1293 passed (1293)
```

`pnpm exec vue-tsc --noEmit`: no output (clean, zero errors).

## Commit

`4207446` — `SP8-P1b: port groupBlocks + timelineMath pure modules`
(4 files changed, 181 insertions(+), on branch `sp8-ai`, parent `e156aaa`)

## Self-review

- Both modules are byte-for-byte logic matches with the Vue2 originals — no behavior
  changes, only mechanical typing (parameter/return annotations, `Set<string>`,
  interfaces for the group/tick shapes).
- Every assertion from both Vue2 spec files was carried over; only additions are TS type
  casts on nullish-input test cases (`null as unknown as never`) required by `strict:
  true`, and casts on grouped-output assertions (`(out[0] as {__process: boolean})`)
  since the return type is a union — these don't change what's asserted, only satisfy the
  type checker.
- Did not create `src/ai/types.ts` per instructions; local structural types are scoped to
  each file with a comment noting they're a placeholder until Task 4 lands the shared
  types.
- Did not touch `userMessageView.ts`.

## Concerns

- None blocking. One forward-looking note for Task 4/10: when `AgentBlock`/`AgentMessage`
  land in `src/ai/types.ts`, `AgentBlockLike` in groupBlocks.ts and `AgentMessageLike` in
  timelineMath.ts should be swapped for the real shared types (structurally compatible
  today, so this should be a no-op type-alias change, not a logic change).
