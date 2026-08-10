# Task 6 report: TerminalTabs and TerminalLockCard

## Status: DONE

## Commit

`ea31332` — "feat(terminal): window tab strip and lock card components"

Files added:
- `src/terminal/TerminalTabs.vue`
- `src/terminal/TerminalTabs.test.ts`
- `src/terminal/TerminalLockCard.vue`
- `src/terminal/TerminalLockCard.test.ts`

## TDD steps followed

1. Wrote the two test files verbatim from the brief.
2. Ran `pnpm vitest run src/terminal/TerminalTabs.test.ts src/terminal/TerminalLockCard.test.ts` — confirmed both failed with "Failed to resolve import ... TerminalTabs.vue / TerminalLockCard.vue does not exist" (components not yet created).
3. Implemented `TerminalTabs.vue` per the brief.
4. Implemented `TerminalLockCard.vue` per the brief, then applied the fallback described below.
5. Ran the target test command again — 8/8 passed.
6. Committed.

## Test evidence

Command: `pnpm vitest run src/terminal/TerminalTabs.test.ts src/terminal/TerminalLockCard.test.ts`

```
 Test Files  2 passed (2)
      Tests  8 passed (8)
```

Typecheck: `pnpm vue-tsc --noEmit` — clean, no output/errors.

Full repo suite: `pnpm vitest run` (run once before committing, from a dirty
tree with the 4 new untracked files) reported `Test Files 4 failed | 689
passed (693)`, `Tests 3 failed | 11109 passed | 70 skipped (11182)`. All 3
failures were in `oss/cli-args.test.mjs` and `oss/export-rsync.test.mjs` —
pre-existing OSS-export gate tests that refuse to run against a dirty git
working tree, and they failed only because my 4 new files were untracked
at that point (visible in their own assertion output: "工作树不干净,导出中止"
listing the 4 new terminal files). After `git add` + `git commit`, I
re-ran exactly those two files (`pnpm vitest run oss/cli-args.test.mjs
oss/export-rsync.test.mjs`) on the now-clean tree and got `Test Files 2
passed (2)`, `Tests 6 passed (6)`. No component defect was involved.

## Token verification (both `:root` and `:root[data-theme="light"]` blocks in `src/styles/theme.css`)

All tokens used by the two components were grepped and confirmed present in both theme blocks:

| Token | Dark (`:root`) line | Light (`:root[data-theme="light"]`) line |
|---|---|---|
| `--card-bg` | 226 | 351 |
| `--card-border` | 232 | 355 |
| `--chip-bg` | 219 | 345 |
| `--chip-bg-hi` | 220 | 346 |
| `--fg` | 43 | 331 |
| `--fg-muted` | 44 | 332 |
| `--accent` | 46 | 334 |
| `--danger-fg` | 298 | 372 |
| `--console-bg` | 187 | 537 (same literal value `#1e1e1e` in both — console stays dark regardless of theme, consistent with existing usage elsewhere) |

Two additional tokens were needed only because of the `@import` fallback (see below), also verified present in both blocks:

| Token | Dark line | Light line |
|---|---|---|
| `--on-accent` | 49 | 337 |
| `--chip-border` | 218 | 344 |

No token was missing; nothing was invented, and `docs/THEMING.md` did not need to be consulted since all tokens the brief listed (plus the two pulled in for the fallback) already existed.

## `@import` fallback: needed, applied

I tested whether `@import '../settings/styles/settings.css'` inside `TerminalLockCard.vue`'s scoped `<style>` block actually resolved `.set-btn`/`.set-btn.primary` in the vitest/jsdom test DOM. I mounted the component, appended it to `document.body`, and read `getComputedStyle()` on the submit button: `backgroundColor` came back as `buttonface` (the browser UA default for `<button>`), not the `--accent`-derived color `.set-btn.primary` should have produced. This confirms the `@import` does not resolve inside a `<style scoped>` block under Vite/vitest's SFC pipeline in this test environment.

Per the brief's fallback instruction, I:
- Removed the `@import` line and the `set-btn primary` classes from the submit button (now just `class="lock-submit"`).
- Added local rules for `.lock-submit` reproducing `.set-btn` + `.set-btn.primary`'s look (pill shape, `--accent` background/border, `--on-accent` text, `:hover:not(:disabled)` brightness bump, `:disabled` opacity 0.5) using only theme tokens already verified above plus `--on-accent`.
- Left a comment in the stylesheet recording why the `@import` was dropped, so a future reader doesn't reintroduce it.

The temporary diagnostic test file used to check this (`_tmp_import_check.test.ts`) was deleted after use; it is not part of the commit.

## Bug found and fixed during implementation (not in the brief's snippet)

The brief's `TerminalTabs.vue` snippet binds the rename `<input>` with a plain string `ref="renameInput"`, but that input sits inside a `v-for="win in windows"` scope (even though it's further gated by `v-if`). Vue's compiler treats any ref inside a `v-for`-scoped subtree as an array ref, so `renameInput.value` was actually an array (or otherwise not the raw element), and `renameInput.value?.focus()` threw `TypeError: renameInput.value?.focus is not a function` as an unhandled promise rejection inside `nextTick()`. It did not fail any of the 8 assertions (the rejection is async and vitest reports it as a separate "Unhandled Rejection" warning, not a test failure), but it's a real defect — focus-on-rename would silently break in production too.

Fix: replaced the string ref with a callback ref (`:ref="setRenameInputRef"`) that assigns the actual element to `renameInput`. Verified with a rerun that shows `Test Files 2 passed (2)`, `Tests 8 passed (8)` and no "Unhandled Errors" section (the first run with the string ref showed `Errors 1 error` alongside 8 passing tests; after the fix, the errors section is gone entirely).

## Deviations from the brief's literal code

1. `TerminalTabs.vue`: rename input ref changed from string ref to callback ref (bug fix, described above). Behavior/emitted events unchanged; test file is untouched (used verbatim from the brief).
2. `TerminalLockCard.vue`: dropped `@import '../settings/styles/settings.css'` and the `set-btn primary` classes on the submit button; replaced with local `.lock-submit` rules using the same tokens, per the brief's own documented fallback path. Test file is untouched (used verbatim from the brief).

No other deviations. Props/emits signatures match the brief exactly:
- `TerminalTabs`: props `{ windows: TerminalWindow[] }`, emits `select(i)`, `create()`, `close(i)`, `rename(i, name)`.
- `TerminalLockCard`: props `{ pwError: boolean; frozenSeconds: number }`, emits `submit(pw)`.

## Zero-literal-color check

`grep -nE "#[0-9a-fA-F]{3,8}|rgb\(|rgba\("` over both new `.vue` files returned no matches — all colors go through `var(--…)` tokens (plus one `color-mix(in srgb, var(--console-bg) 82%, transparent)` for the lock overlay scrim, which only mixes a token with `transparent`, no literal color).
