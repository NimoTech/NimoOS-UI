# Acceptance fix 1: wallpaper scrim fogging the whole light-theme UI

## What changed

`src/styles/theme.css`, in the SP11 wallpaper block (`:root[data-wallpaper] body::after`):

```css
:root[data-wallpaper] body::after { background: var(--wallpaper-scrim); z-index: -1; }
```

Root cause (already established before this task, not re-investigated): `body::after`
is `position: fixed; z-index: 0`, while `#app` is a plain non-positioned block. A
positioned element at `z-index: 0` paints above every non-positioned sibling/descendant
that follows it, so this pseudo-element has always sat on top of the entire app. The
default sheen was subtle enough to read as atmosphere; the light theme's wallpaper scrim
is a near-opaque white sheet, so painting it over the whole UI (not just the photo
underneath) fogged every card/button/text to ~55% white.

`body` establishes no stacking context, so a negative `z-index` here drops the scrim
behind the `<html>` wallpaper paint and in front of the (non-positioned) app content —
sandwiched between the photo and the UI, which is where a scrim belongs.

Extended the block's existing comment in `theme.css` to record this reasoning inline
(why the negative z-index is load-bearing), per the task instructions. Did not touch
`--wallpaper-scrim`'s values, the non-wallpaper `body::after` rule, or the block's
structure — one declaration plus its guard and comment.

## Guard added

`src/styles/wallpaper.css.test.ts`, new test `'paints behind the app content, not on top
of it'` in the `scrim` describe block:

```js
const rule = /:root\[data-wallpaper\]\s+body::after\s*\{([^}]*)\}/.exec(CSS)?.[1]
expect(rule, ':root[data-wallpaper] body::after block must exist').toBeTruthy()
expect(rule as string).toMatch(/background\s*:\s*var\(--wallpaper-scrim\)/)
expect(rule as string).toMatch(/z-index\s*:\s*-\d/)
```

Reads `theme.css` via `node:fs` (matching the rest of the file — `?raw`/
`import.meta.glob` return an empty string for `.css` under this repo's vitest setup,
which would make the guard silently pass on nothing).

**Non-vacuity check**: temporarily reverted the `z-index: -1;` declaration in
`theme.css` (sed, then restored from a backup copy) and reran
`pnpm vitest run src/styles/wallpaper.css.test.ts`. The new test failed as expected:

```
AssertionError: expected ' background: var(--wallpaper-scrim); ' to match /z-index\s*:\s*-\d/
```

The other 6 tests in the file stayed green throughout, confirming the guard is specific
to this declaration, not a side effect of some other change. After restoring the fix,
the full file passes (7/7).

Also confirmed the pre-existing test `'body::after becomes the scrim'`
(`/body::after\s*\{[^}]*background\s*:\s*var\(--wallpaper-scrim\)/`) still holds after
adding the `z-index` declaration — its `[^}]*` prefix only needs `background` to appear
somewhere inside the braces, and `background` still comes first in the rule, so this
regex is unaffected and remains meaningful (it only breaks if `background` moves after
a `}`, which can't happen from appending a sibling declaration).

## Gate results

1. `pnpm vitest run src/styles` — 4 files / 1054 tests passed.
2. `pnpm exec vue-tsc --noEmit` — exit 0.
3. `pnpm build` — succeeded (`✓ built in 16.76s`); only pre-existing "chunk larger than
   500kB" advisory warnings, unrelated to this change.
4. OSS export gate — `node oss/export.mjs --out <tmp> --no-commit --allow-dirty-oss`
   initially failed the leak guard on 3 lines (ordinary word "photo" in the new
   comments, across `theme.css` ×2 and `wallpaper.css.test.ts` ×1). Added three narrow
   `exactLine()` allow entries to `oss/forbidden.mjs` under the existing `photo` SOFT
   word, following the file's established per-line precedent (did not widen the word
   list or add file-level/substring exemptions). Reran the export: `零真实泄漏命中` —
   0 real leaks, exit 0, produced the export tree successfully.

Note on ordering: `oss/export.mjs` reads source via `git archive HEAD`, so `checkClean`
requires a clean tree outside `oss/`/`design-export/` before it can meaningfully test
anything. Committed the CSS/test fix first (pathspec'd to just those two files), then
ran the export gate against the committed state, then committed the `forbidden.mjs`
whitelist addition as a separate `chore(oss)` commit (matching this repo's existing
commit-history convention of separating fix commits from oss-whitelist commits).

## Commits

- `08a5898` — `fix(wallpaper): stop the scrim from fogging the whole light-theme UI`
  (`src/styles/theme.css`, `src/styles/wallpaper.css.test.ts`)
- `41813a0` — `chore(oss): whitelist acceptance-fix-1 comments' ordinary 'photo' hits`
  (`oss/forbidden.mjs`)

Both commits used `git commit --pathspec-from-file=/dev/stdin` with an explicit file
list, so the pre-existing unstaged `design-export/*.html` deletions were never touched
(`git status --porcelain` still shows exactly those 3 deletions and nothing else after
both commits). The tree was not `checkout`/`stash`ed at any point.

## Concerns

None outstanding. The fix is scoped to the single declaration described in the task;
the dark theme's wallpaper scrim is also affected (it now only tints the photo, not the
UI), which the task explicitly called out as intended.
