# Task 4 Report: Point `openInApp` at New-UI (closes A-8)

## What I implemented

`agentSessionUrl(sessionId)` in `src/ai/services/openInApp.ts` now returns
`/app/#/ai/agent?session=<encoded>` (New-UI's own route) instead of
`/#/ai/agent?session=<encoded>` (the root-mounted old Vue2 app).
`openAgentSessionInNewTab` was left untouched — it just delegates to
`agentSessionUrl` and `window.open`.

The block comment above the function was rewritten to explain why the
landing point moved: New-UI's `/ai/agent` previously read no `?session=` at
all, so pointing there would have silently opened the Agent page without
selecting the session; ticket A-8 closed that gap on 2026-08-19 when
AgentPage.vue gained mirror/read/follow support for `?session=` (per
`docs/superpowers/specs/2026-08-19-agent-session-deeplink-design.md`), so the
old workaround is no longer needed. The comment also notes that the test's
reverse assertions now guard against a regression back to the old app.

In `src/ai/services/openInApp.test.ts`, the `describe('agentSessionUrl / ...')`
block's comment and its four URL assertions were flipped to match: two
forward assertions now expect the `/app`-prefixed URL, and the two reverse
assertions now assert the URL is **not** the old root-mounted one. The two
"does nothing when the session id is empty/null" tests were left exactly as
they were, per the brief.

No changes were made to `NoteEditPane.vue` or `NoteEditPane.test.ts` — the
latter mocks the whole `openInApp` module, so it needed no change (verified,
see Testing below).

## What I tested and the results

- `pnpm exec vitest run src/ai/services/openInApp.test.ts` — RED before
  implementation flip, GREEN after (33/33 passing after; see TDD evidence).
- `pnpm exec vitest run src/ai/services/openInApp.test.ts src/ai/knowledge/components/NoteEditPane.test.ts`
  — 98/98 passing (2 files), confirming no collateral damage in
  `NoteEditPane.test.ts`.
- `pnpm exec vue-tsc --noEmit` — clean, no output/errors.
- Post-commit sanity check: I temporarily re-reverted the implementation
  line back to the old `/#/ai/agent?session=...` URL (simulating a future
  "someone standardizes/reverts the prefix" regression) and re-ran the test
  file — all 5 URL-related tests failed (both reverse assertions included),
  confirming they actively discriminate rather than being vacuously true. I
  then restored the file with `git checkout --` and re-ran both test files to
  confirm the working tree matches the committed state exactly (98/98
  passing again).

## TDD evidence

### RED — before touching the implementation

Command: `pnpm exec vitest run src/ai/services/openInApp.test.ts`
(after Step 1's test-only edit, implementation still returning the old URL)

Result: **5 failed, 28 passed** (not the brief's predicted 3):

```
✗ builds a URL pointing at New-UI (mounted at /app)                                    [RED, forward]
✗ does NOT point at the root-mounted old Vue2 app (reverse assertion, ...)              [RED, reverse]
✗ encodes special characters in the session id                                          [RED, forward]
✗ opens the agent session url in a new tab                                              [RED, forward]
✗ the opened url is NOT the root-mounted old Vue2 route (reverse assertion)             [RED, reverse]
✓ does nothing when the session id is empty                                             [GREEN, unchanged]
✓ does nothing when the session id is null/undefined                                    [GREEN, unchanged]
```

**This contradicts the brief's Step 2 prediction.** The brief expected only 3
failures (the two forward URL assertions plus the `window.open`
`toHaveBeenCalledWith` assertion), with the reverse assertions "passing for
the wrong reason." That prediction does not hold up: before the
implementation flip, `agentSessionUrl('sess 1')` still returns exactly
`'/#/ai/agent?session=sess%201'` (the unmodified old-app URL). The flipped
reverse assertion asserts `.not.toBe('/#/ai/agent?session=sess%201')` —
i.e. it demands the output NOT equal the very string it currently equals, so
it necessarily fails at this point rather than passing. Both reverse
assertions were therefore RED alongside the three the brief predicted, for a
straightforward logical reason (not equal-to-itself is false), not a subtle
one. Only the two untouched "does nothing" tests were GREEN. This is worth a
reviewer's attention as a brief-vs-reality mismatch, though it does not
change the correctness of the final code or tests.

### GREEN — after flipping the implementation

Command: `pnpm exec vitest run src/ai/services/openInApp.test.ts src/ai/knowledge/components/NoteEditPane.test.ts`

```
 Test Files  2 passed (2)
      Tests  98 passed (98)
```

Typecheck: `pnpm exec vue-tsc --noEmit` — no output, clean.

### Discrimination check (post-commit, reverted before finishing)

I temporarily restored the old-app URL in the implementation (simulating a
regression back to `/#/ai/agent?session=...`) and reran
`src/ai/services/openInApp.test.ts`: all 5 URL-related tests failed,
including both reverse assertions — confirming every one of the four flipped
URL assertions (two forward, two reverse) actually discriminates between the
old and new landing point. None is a vacuous/insensitive guard. I then ran
`git checkout -- src/ai/services/openInApp.ts` to restore the committed
state and reran both test files to confirm 98/98 passing, matching the
commit exactly.

## Files changed

- `/DATA/NIMO/nimotech/NimoOS-New-UI/.claude/worktrees/agent-session-deeplink/src/ai/services/openInApp.ts`
- `/DATA/NIMO/nimotech/NimoOS-New-UI/.claude/worktrees/agent-session-deeplink/src/ai/services/openInApp.test.ts`

No other files were touched (verified via `git show --stat HEAD` and an
explicit diff check against `NoteEditPane.vue`/`NoteEditPane.test.ts`, which
show no changes).

## Self-review findings

- Both comment blocks (implementation and test) were fully rewritten; neither
  retains language describing the old "verbatim copy the blueprint's landing
  point" / "does not yet support ?session=" direction. Both now state the new
  direction and cite the spec doc and the 2026-08-19 closure date, per the
  brief's exact text.
- The "does nothing when session id is empty/null" tests are untouched, as
  required.
- `openAgentSessionInNewTab` itself is untouched — only `agentSessionUrl`'s
  return value and the shared comment changed.
- Diff is confined to the two named files; no scope creep.
- Discrimination check (above): all four flipped URL assertions (2 forward +
  2 reverse) are sensitive to the change in both directions — none is a
  vacuous guard. I flag the RED-count mismatch from the brief's Step 2
  prediction (5 actual vs. 3 predicted) as the one place reality diverged
  from the brief, and explained why in the TDD evidence section above.
- Commit author/sign-off verified as `Tiansanchuan <1312528051@qq.com>` (no
  local git config override existed); commit message matches the brief
  verbatim.

## Concerns

- The brief's Step 2 prediction ("3 failures, reverse assertions pass for the
  wrong reason") does not match actual behavior — actual RED state was 5
  failures, all four URL assertions plus reverse. This doesn't affect
  correctness of the final code/tests (verified via the discrimination
  check), but it's worth noting for whoever reviews the brief's own accuracy
  in future tasks.
