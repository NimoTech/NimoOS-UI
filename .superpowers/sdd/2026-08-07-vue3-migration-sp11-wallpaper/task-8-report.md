# Task 8 report — 顶栏三档(蓝色 / 白色 / 照片…)

## What was implemented

`src/home/components/ThemeToggle.vue`'s topbar menu now offers three explicit
entries instead of a `v-for` over `THEMES`:

- `tt-blue` / `tt-light` — pick a base: clear any wallpaper (`wp.preview(NONE)`),
  persist that (`wp.commit()`), switch the theme (`theme.setTheme(v)`), close
  the menu immediately.
- `tt-photo` — closes the menu and opens the wallpaper picker sheet
  (`wp.openDialog()`) instead of applying anything itself.

`active` is a computed: `'photo'` whenever `wp.record.kind !== 'none'`,
otherwise `'light'`/`'blue'` from `theme.theme`. This drives both the `on`
class/check-mark and `aria-checked` on all three buttons, so exactly one entry
is ever checked regardless of what combination of theme + wallpaper is active.

Per the controller override, `pickBase` does **not** fire-and-forget
`wp.commit()`. It chains `.catch()` and surfaces failure via the toast store:

```ts
wp.commit().catch(() => toast.show(t('wpSaveFailed'), 3000, 'danger'))
```

The menu still closes synchronously right after — only the failure toast
depends on the network response, matching "one-step from the topbar: no
confirm step to defer to" while not letting a rejected promise go unhandled.

## Pre-existing behaviour preserved

Read the component before touching it. It had: `.theme-btn` toggle button
opening/closing `open`; a `.theme-scrim` full-screen overlay that closes the
menu on click; `.theme-menu` (`role="menu"`) positioned via `position:
absolute`; each option as `role="menuitemradio"` with `aria-checked`, an `on`
class, a `.sw`/`.lbl`/`.ck` structure, and a hover state; closing the menu
after any pick. None of this had any keyboard handling to begin with (no
keydown listeners existed) — nothing was dropped there.

I kept every one of those class names, the scrim, the `role`s, and the
open/close mechanics verbatim, only replacing the `v-for` body with three
literal buttons and swapping `pick(opt)` for `pickBase(v)`/`pickPhoto()`.
Confirmed preserved by:
- the brief's own six tests (menu opens on `.theme-btn` click, `.theme-menu`
  disappears after a pick, `aria-checked` reflects the active entry) — all
  pass unmodified from the brief's literal test code;
- manual read-through of the diff: `.theme-toggle`, `.theme-btn`,
  `.theme-scrim`, `.theme-menu`, `.theme-opt`, `.sw`, `.lbl`, `.ck` all appear
  unchanged in the `<style>` block.

`THEMES` is no longer imported into this file (import removed since nothing
here iterates it any more), but it is not dead: `src/stores/theme.ts` still
exports and uses it internally, and `src/stores/theme.test.ts` still tests it
directly. Nothing needed removing there.

## theme-exception mechanism

Read `src/styles/color-guard.test.ts`'s `styleLines`/exemption loop before
relying on it. The guard walks a `<style>` block's lines in order and tracks
a single boolean `exempt`: any line containing the literal substring
`theme-exception` sets `exempt = true`; the flag clears the first time a line
(any line, including the one that set it) contains `;` or `}`. So the
exemption is a **window that starts at the comment line and ends at the next
statement terminator**, not a per-line match.

The brief's third swatch comment spans two lines:
```css
/* theme-exception: preview swatch shows what the photo option looks like, not
   the active theme's colours. */
.sw-photo { background: linear-gradient(135deg, #7a8ea8, #3c4a5e); }
```
Line 1 sets `exempt = true` and contains neither `;` nor `}`, so it carries
into line 2 (still neither) and into line 3 — the actual color-bearing rule —
before line 3's own `;`/`}` clears it at the end of that line. That's exactly
in time to cover the `#7a8ea8`/`#3c4a5e` literals. I verified this by running
`color-guard.test.ts` and watching the relevant per-file case for
`ThemeToggle.vue` pass; I did not need to add any new theme.css tokens.

## Deviations from the brief's literal code

1. **`pickBase`'s commit call** — controller-mandated: `.catch()` +
   `toast.show(t('wpSaveFailed'), 3000, 'danger')` instead of `void
   wp.commit()`. Reason given in the task: a bare fire-and-forget here means a
   failed save is invisible until the next reload.
2. **One extra test** (`toasts a failure instead of leaving the user with a
   silently unsaved base`) appended after the brief's six, per the
   controller's explicit instruction to add a test for the failure path.
3. **`oss/forbidden.mjs` touched** (not in the brief's file list). Running the
   real OSS export scan (`scanText` from `oss/forbidden.mjs`) against the new
   `ThemeToggle.vue`/`.test.ts` content surfaced 10 + 6 = 16 occurrences of the
   soft-banned word `photo` (`data-test="tt-photo"`, `pickPhoto`, `.sw-photo`,
   the `'photo'` branch of `active`, and the matching test assertions/`it()`
   titles). Per the controller's explicit guidance for this exact situation, I
   added one `exactLine()` allow-entry per hit, following the precedent
   already in the same `photo` allow-list from the prior SP11 tasks (Task 5's
   `themePhoto` entries) — grouped under one new comment block, in English
   (new comment, not a legacy one, so the top-level CLAUDE.md language rule
   applies). I did not widen the word list or reword any source line to dodge
   the scanner. Extended the commit's pathspec to include this file.

No other deviations — template structure, script logic, and CSS otherwise
match the brief verbatim.

## TDD evidence

**RED** — `pnpm vitest run src/home/components/ThemeToggle.test.ts --reporter=verbose`
after replacing the test file (before touching `ThemeToggle.vue`):
```
Error: Cannot call attributes on an empty DOMWrapper.
 ❯ src/home/components/ThemeToggle.test.ts:58:43   ([data-test="tt-light"])
...
 Test Files  1 failed (1)
      Tests  7 failed (7)
```
Expected: the component had no `[data-test="tt-*"]` attributes yet — every
`.find(...)` on those selectors returns an empty wrapper, so `.attributes()`/
`.trigger()` throw exactly as shown. Confirms the tests are exercising the new
DOM contract, not passing vacuously.

**GREEN** — after implementing `ThemeToggle.vue`:
```
pnpm vitest run src/home/components/ThemeToggle.test.ts --reporter=verbose
 ✓ ThemeToggle > offers three entries
 ✓ ThemeToggle > picking a base clears any wallpaper and switches the theme in one step
 ✓ ThemeToggle > checks the base matching the active theme when no wallpaper is set
 ✓ ThemeToggle > checks Photo whenever any image is set, regardless of theme
 ✓ ThemeToggle > Photo opens the picker rather than applying anything itself
 ✓ ThemeToggle > closes the menu after any pick
 ✓ ThemeToggle > toasts a failure instead of leaving the user with a silently unsaved base
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
(The `[Vue warn]: ... already been registered` stderr lines that `--reporter=verbose`
surfaces are the known, pre-existing noise from this test file creating its own
`createI18n` instance on top of the global test-setup singleton — the same
pattern already used by `WallpaperDialog.test.ts`/`SearchDialog.test.ts`/etc,
confirmed by running `WallpaperDialog.test.ts` standalone and seeing the
identical warning 84 times. Not something this task introduced or needs to fix.)

**Final required gate**, after the `oss/forbidden.mjs` whitelist additions:
```
pnpm vitest run src/home/components/ThemeToggle.test.ts src/styles/color-guard.test.ts src/i18n oss/
 Test Files  15 passed (15)
      Tests  1372 passed (1372)

pnpm exec vue-tsc --noEmit
(exit 0)
```
`oss/tree.test.mjs`'s real export run (`产物树能构建`, `泄漏守卫`) also passed,
confirming the whitelist entries are correct and the new code produces no
real leak, not just that the fixture-level `forbidden.test.mjs` unit tests
pass.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/home/components/ThemeToggle.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/src/home/components/ThemeToggle.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/oss/forbidden.mjs`

Commit: `f16c7ba` — `feat(wallpaper): give the topbar picker a third Photo entry`
(pathspec-scoped to the three files above; the pre-existing 3 staged
`design-export/*.html` deletions were left untouched, as required).

## Self-review findings

- Re-read the diff for lost behaviour: none found (see "Pre-existing
  behaviour preserved" above).
- Checked for dead code after removing the `v-for`/`THEMES` import: none —
  `THEMES` remains live elsewhere.
- Checked toast duration/tier against existing call sites (`aiCfgSaveFailed`,
  `aiAuthFailed`, etc. all use `3000`/`5000` + `'danger'`); `3000` + `'danger'`
  matches the closest precedent (config-save-failure class of errors).
- Confirmed `wpSaveFailed` already existed in both locale files (Task 5) —
  no i18n key additions needed, so `parity.test.ts`/`shardDisjoint.test.ts`
  are unaffected.
- Confirmed the extra test actually fails without the fix: mentally traced
  that `vi.spyOn(wp, 'commit').mockRejectedValueOnce(...)` with a bare `void
  wp.commit()` would leave an unhandled rejection and no toast — the test
  would time out/fail on `vi.waitFor`, which is why it's a meaningful
  regression guard for the controller's override, not a tautology.
- Ran `pnpm exec eslint` — no `lint` script/binary configured in this repo
  (per this repo's own CLAUDE.md, `pnpm lint` isn't listed as a New-UI
  command), so skipped; not part of the required gate for this task.

## Concerns

None. Task is complete and verified: RED→GREEN TDD, full required test
matrix + `oss/` real-export scan + `vue-tsc` all green, commit made with the
brief's exact pathspec discipline (extended by one legitimately-touched file).
