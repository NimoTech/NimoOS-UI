# Task 2 Report: CSS layer + scrim token + cold-start wiring + positional guard

## What was implemented

1. `src/styles/wallpaper.css.test.ts` (new) — 6 assertions across two `describe` blocks (`wallpaper layer`, `scrim`), verbatim from the brief's Step 1.
2. `src/styles/theme.css`:
   - Dark `:root` block: added `--wallpaper-scrim` token right after the multi-line `--app-bg` definition (after the `linear-gradient(180deg, #2a3354 ...)` line), before the block's closing `}`. Anchor content matched the brief exactly; line number was 301→302 (off by one from the brief's ":301", expected drift, anchored on content not line number).
   - Light `:root[data-theme="light"]` block: added `--wallpaper-scrim` token right after `--app-bg: #f7f5ef;` (brief said this exact line — matched verbatim, found at line 391 pre-edit).
   - End of file: appended the full SP11 wallpaper rule block (comment + 4 rules) after the last existing rule (`.file-flash { ... }`), which itself comes after the light-theme `body::before, body::after { background: none; }` reset (found at lines 522-523 pre-edit, drifted only by a couple of lines from the brief's ":522-523" reference — same content, expected drift).
3. `src/main.ts`:
   - Added `import { applyWallpaper, initialWallpaper } from './stores/wallpaper'` alongside the existing `applyTheme, initialTheme` import (line 10).
   - Added `applyWallpaper(initialWallpaper())` right after `applyTheme(initialTheme())` and before `app.mount('#app')` (lines 45-47), with the brief's exact English comment.

All CSS/JS content inserted is byte-for-byte the brief's code blocks (verified via `git diff`).

## TDD evidence

### RED

Command: `pnpm vitest run src/styles/wallpaper.css.test.ts` (run before any theme.css/main.ts edits)

Result: 6 failed / 6 total. First failure (as predicted by the brief's Step 2):

```
AssertionError: :root[data-wallpaper] block must exist: expected undefined to be truthy
 ❯ src/styles/wallpaper.css.test.ts:17:60
     17|     expect(rule, ':root[data-wallpaper] block must exist').toBeTruthy()
```

This is expected: at this point `theme.css` has no `:root[data-wallpaper]` rule at all, so the regex extraction is `undefined` and the very first assertion trips, cascading failures through the rest of the suite (missing `--wallpaper-scrim` token, missing scrim rule, etc.).

### GREEN

Command: `pnpm vitest run src/styles/wallpaper.css.test.ts src/styles/color-guard.test.ts`

Result after Steps 3-6 implemented:

```
 Test Files  2 passed (2)
      Tests  1038 passed (1038)
```

Also ran `pnpm exec vue-tsc --noEmit` → exit 0, no output.

## Mutation-verification evidence (Step 8, mandatory)

Command used to mutate: a small Python script that cut the exact `/* ══ SP11 wallpaper layer ...` block (through the final `:root[data-wallpaper] body::after { ... }` rule) from the end of `theme.css` and reinserted it immediately **before** the `:root[data-theme="light"] body::before,\n:root[data-theme="light"] body::after { background: none; }` rule. A verbatim copy of the pre-mutation file was kept at `/tmp/.../scratchpad/theme.css.orig` for exact restoration (chosen over manual line-editing to guarantee byte-for-byte revert).

Command: `pnpm vitest run src/styles/wallpaper.css.test.ts` (while mutated)

Actual output:

```
 ❯ src/styles/wallpaper.css.test.ts (6 tests | 1 failed) 10ms
     × the scrim rule is ordered AFTER the light theme zeroes body::after 3ms

 FAIL  src/styles/wallpaper.css.test.ts > scrim > the scrim rule is ordered AFTER the light theme zeroes body::after
AssertionError: expected 24871 to be greater than 24986
 ❯ src/styles/wallpaper.css.test.ts:50:19
     48|     const scrim = CSS.indexOf(':root[data-wallpaper] body::after')
     49|     expect(lightKill).toBeGreaterThan(-1)
     50|     expect(scrim).toBeGreaterThan(lightKill)

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

Exactly the predicted assertion ("the scrim rule is ordered AFTER the light theme zeroes body::after") went red, and only that one — the other 5 assertions in the file still passed, confirming the positional check is isolated and not a false-positive side effect of a broader break.

Reverted with `cp <scratchpad>/theme.css.orig src/styles/theme.css`, verified `diff` reported no difference from the pre-mutation state, then re-ran:

Command: `pnpm vitest run src/styles/wallpaper.css.test.ts src/styles/color-guard.test.ts`

```
 Test Files  2 passed (2)
      Tests  1038 passed (1038)
```

Back to fully green, and `pnpm exec vue-tsc --noEmit` re-confirmed exit 0 after restoration.

## Files changed (final line numbers, post-edit)

- `src/styles/theme.css`
  - Dark theme `--wallpaper-scrim` token: inserted after line 301 (the `linear-gradient(180deg, #2a3354 ...)` line), before the block's closing `}` at (then) line 302→308.
  - Light theme `--wallpaper-scrim` token: inserted after `--app-bg: #f7f5ef;` (line 391 pre-edit).
  - End-of-file rule block: appended after the final pre-existing rule `.file-flash { ... }` (was the last line of the file, 755 lines pre-edit; file is now 783 lines).
- `src/main.ts`
  - Import added at line 10.
  - `applyWallpaper(initialWallpaper())` call added at line 47, between `applyTheme(initialTheme())` (line 44) and `app.mount('#app')` (line 48).
- `src/styles/wallpaper.css.test.ts` (new file, 62 lines) — verbatim from the brief.

`git diff` confirmed the three edits match the brief's code blocks exactly (no drift beyond line numbers).

## Self-review findings

- Re-read `main.ts`, the two new theme.css tokens, and the end-of-file rule block with fresh eyes: content matches the brief verbatim, all comments are English, no stray Chinese introduced by this task (pre-existing Chinese comments in `main.ts` near the new line were left untouched per "don't restructure beyond insertions").
- Confirmed no raw color literals were introduced outside `theme.css` — `color-guard.test.ts` passed (1038/1038 total across both test files run together, which includes the full suite of other css/vue color checks, not just wallpaper-scoped ones — the 1038 count reflects the full `color-guard.test.ts` parametrized suite plus `wallpaper.css.test.ts`'s 6 cases).
- Verified the mandatory Step 8 mutation used an exact-content cut/paste (not manual retyping) — eliminated any risk of an unintentional non-mutation-related typo masking as a "mutation."
- Verified the git commit's pathspec (`git commit -o src/styles/theme.css src/styles/wallpaper.css.test.ts src/main.ts ...`) did NOT sweep in the three permanently-staged `design-export/*.html` deletions — confirmed via `git status --short` post-commit showing those three `D` entries still staged and untouched.
- No YAGNI violations: no new abstractions, no extra tokens, no restructuring of theme.css beyond the three specified insertion points.
- Test file naming (`wallpaper.css.test.ts`) and describe/it structure match the brief exactly — no embellishment added.

## Concerns

None. Anchor line numbers in the brief (`:301`, `--app-bg: #f7f5ef;` line, `:522-523`) had drifted by a handful of lines from actual pre-edit content (theme.css had grown since the brief was written), but in every case the anchor *content* was found exactly as described and the insertions were made relative to that content, not a hardcoded line number — this is expected drift as called out in the task instructions.
