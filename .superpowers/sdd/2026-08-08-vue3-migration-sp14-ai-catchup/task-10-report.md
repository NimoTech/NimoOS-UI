# Task 10 report — 收尾门 + 台账

## Status: DONE

## Deliverable

`.superpowers/sdd/sp14/closeout.md` (commit `bb08862`), plus 8 harness screenshots in the
same directory. Full ledger content and reasoning live there in Chinese per the task
instructions; this report summarizes in English what happened and what got fixed along
the way.

## Gate results (final, real numbers, clean tree)

| Gate | Result |
|---|---|
| `pnpm exec vitest run` (full) | **655 files / 10495 tests, all passed**, exit 0 |
| `pnpm exec vue-tsc --noEmit` | 0 errors, exit 0 |
| `pnpm exec vitest run src/styles` | 4 files / 1060 tests, all passed |
| `pnpm exec vitest run src/i18n` | 7 files / 189 tests, all passed |
| `pnpm build` | succeeded, 1m11s (two pre-existing, non-fatal Rollup warnings: chunk-size advice and a `@vueuse/core` `/* #__PURE__ */` comment-position warning — neither introduced by this stage) |
| `node oss/export.mjs --out ... --no-commit --allow-dirty-oss` | succeeded, exit 0, `DELETE 73 · REPLACE 4 · PATCH 256`, zero real leak-guard hits (3 binary assets correctly skipped) |

No gate was recorded as passing without first getting a real, current run on a clean
tree — see "What actually happened" below for the false starts this ruled out.

## What actually happened (why this took more than running five commands)

The first full-suite run showed 4 failed test files. Digging in (rather than accepting
"non-zero exit" or "N failed" at face value) found:

1. **Self-inflicted false failure**: the harness files (created for Part B) and an
   uncommitted `progress.md` left the tree dirty while the OSS self-tests ran, so all
   three `oss/*.test.mjs` files failed on "tree not clean" — not a real bug. Fixed by
   committing `progress.md` and gitignoring the harness (`bfb0bcd`).
2. **A real bug, caught by the color guard**: `src/ai/components/settings/mcp/McpServerDetail.vue`
   had a `<template>`-block HTML comment `<!-- #141: ... -->` (added by Task 8, commit
   `35a4006`). Three decimal digits are also valid hex digits, so the repo-wide bare-hex
   color guard (`src/ai/styles/knowledgeStyles.test.ts`) matched `#141` as a color literal.
   The same ticket reference already exists in the `<script>`-block comment above (which
   the guard never scans), so the template-side one was redundant — reworded it, didn't
   touch the guard (`00d9f74`).
3. **Three more real OSS-manifest drift bugs**, all traced via
   `git log 65c7928..HEAD -- <file>` to Task 9 (`d4d3771`, "give Knowledge a desktop
   tile"), one at a time as the export self-tests kept failing on the next thing after
   each fix:
   - `src/home/grid/defaultLayout.ts`'s pinned SHA-256 in `oss/manifest.mjs` was stale
     (the file gained a `knowledge` tile entry). Confirmed the OSS-side counterpart file
     already excludes the whole AI area, so only the hash needed re-pinning (`34529c9`).
   - `useOpenAction.ts`'s PATCH anchor (six lines ending in the `SYS_ROUTE` fallback)
     stopped matching because a `knowledge` branch was inserted in the middle. Re-anchored
     with the current text, `replace` unchanged (`7e93b64`).
   - `useOpenAction.test.ts`'s AI-cutover-describe-block PATCH anchor (7 cases) likewise
     broke because a `knowledge` test case landed inside it. Re-anchored the same way
     (`e706b7a`).
   - The `knowledge` system app itself (import/glyph/array entry in `systemApps.ts`, an
     i18n key in each base locale, a `.ic-knowledge` rule in `theme.css`, its icon
     asset, and a small new orphan test file) had never been added to the export
     manifest at all — the leak guard caught 9 raw hits. Added DELETE/PATCH entries
     mirroring the existing `photos`/`ai` treatment (`7f1ed04`).
4. **A self-inflicted anchor break while fixing #1**: the harness's `.gitignore` entry
   was first placed inside the exact literal block another OSS PATCH anchor matches by
   substring, breaking that anchor too. Moved it to the end of the file (`c4703c5`).
5. **Confirmed flaky, not broken**: under heavy concurrent load from other worktrees on
   this machine, `DesktopContextMenu.test.ts` and `src/i18n/__tests__/photosSlice.test.ts`
   each failed once (a DOM-not-found error and a 5000ms timeout respectively) in
   contended full-suite runs, but passed cleanly every time run in isolation or once
   system load eased. The final, authoritative full-suite run (655/655, 10495/10495) was
   clean, confirming these were load artifacts, not regressions.

All five substantive fixes are separate, small, English-message commits with the
required trailer; none touched test/guard logic to make something pass — only comment
wording, a pinned hash, two literal-text anchors, and missing manifest entries.

## Browser check (Part B)

Built a throwaway `harness.html`/`harness.ts` at the repo root (never committed — verified
via `git log -p` that only the `.gitignore` *rule text* mentioning "harness" appears in
history, never the file contents). Mounted `McpElicitFormCard` with one field of every
type (string/integer/boolean/enum/multi_enum) plus a bounced-error variant, and
`McpElicitUrlCard` with a plain-https case and a punycode-homograph case
(`аpple.com`/Cyrillic-а vs `xn--pple-43d.com`).

Note on theme mechanism: the AI area has its own light/dark toggle
(`.agent-app[data-theme]`, `src/ai/stores/aiTheme.ts`) independent of the desktop's
global blue/light theme (`document.documentElement.dataset.theme`) — the harness drives
the AI-area one since that's what the two cards' tokens actually respond to.

Drove a headless Chromium (`~/.cache/ms-playwright/chromium-1228/`) via raw CDP over the
`ws` package already in `node_modules`, against `pnpm dev --host --port 5279`. Note:
`vite.config.ts`'s dev proxy forwards everything outside `/app/` to the real gateway on
`:80`, so the harness had to be reached at `/app/harness.html` (Vite's `base: '/app/'`
rewrites the dev server's serving root, which fixed this without touching the proxy
config).

**Select-popup color check** (the one thing required to be actually checked, not just
screenshotted — Chromium doesn't render native `<select>` popups into
`Page.captureScreenshot` in headless mode, so this is the authoritative check per the
task instructions):

| Theme | `select` background | `select` color | `option` background | `option` color | `color-scheme` |
|---|---|---|---|---|---|
| light (default) | `rgb(250, 249, 246)` | `rgb(42, 39, 35)` | `rgba(0,0,0,0)` (inherits select's solid fill) | `rgb(42, 39, 35)` | `light` |
| dark | `rgb(28, 28, 30)` | `rgb(233, 231, 227)` | `rgba(0,0,0,0)` | `rgb(233, 231, 227)` | `dark` |

No white-on-white risk: both themes use solid, opaque, high-contrast fills, and
`color-scheme` tracks the AI area's own theme correctly rather than leaking the global
`:root` dark default.

8 screenshots saved to `.superpowers/sdd/sp14/` and committed with `git add -f` (the sdd
workdir's regenerated bare `*` `.gitignore` requires it).

## Explicitly unverified (see closeout.md §4 for the full list)

- Elicitation end-to-end (Task 0's established fact: device backend doesn't implement it).
- #141 (protocol-version line) and #98 (Knowledge tile) real-device click-throughs. The
  real Gateway/AI services are running on this device (`curl 127.0.0.1:80/ping` → 200,
  both systemd units active), but no login credentials were available to this task, and
  resetting one would be a security-sensitive write action outside a closeout task's
  scope. Confirmed via their own reports that Task 8 and Task 9 didn't do a device
  click-through either — this has been unverified since those tasks, not newly skipped
  here.
- A live-browser check of the MCP detail page's own controls / the Knowledge page's own
  controls beyond the two elicitation cards.

## Commits made this task

```
bfb0bcd chore(sp14): carry forward task progress notes, ignore the closeout harness
00d9f74 fix(ai): reword the protocol-version template comment around the hex-color guard
34529c9 chore(oss): re-pin defaultLayout.ts's hash after the knowledge desktop tile
c4703c5 chore: move the harness gitignore entry to the end of the file
7e93b64 chore(oss): re-anchor useOpenAction.ts's PATCH after the knowledge route
e706b7a chore(oss): re-anchor useOpenAction.test.ts's AI-cutover PATCH
7f1ed04 chore(oss): strip the new knowledge system app from the export manifest
bb08862 docs(sp14): record the closeout gates and what stayed unverified
```

Final tree is clean; `harness.html`/`harness.ts` deleted and confirmed absent from all
history.
