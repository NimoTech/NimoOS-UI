# Task 8 report: admin-only terminal desktop tile gated by a service probe

## Summary

Implemented exactly as specced in `task-8-brief.md`, following TDD in the brief's
step order (write failing tests -> implement -> tests pass). Two commits:

- `650550a` feat(home): admin-only terminal tile gated by a service probe
- `dac7d40` fix(oss): update export anchors and fixtures for the terminal tile

## Files touched

- `src/home/apps/icons/terminal.svg` (new, copied from Vue2 via
  `git --git-dir=/home/nimo/NimoTech/NimoOS-UI/.git show FETCH_HEAD:src/assets/img/app/terminal.svg`,
  2276 bytes, verified non-empty SVG)
- `src/home/apps/systemApps.ts` — extended `SystemApp` interface
  (`requiresService?: 'kvm' | 'terminal'`, new `adminOnly?: true`), added the
  `terminal` glyph path, appended the `terminal` tile entry last in `SYSTEM_APPS`.
- `src/home/apps/systemApps.test.ts` — updated the pre-existing "kvm is the only
  gated tile" test (see "Pre-existing test updated" below) and added a companion
  assertion for `adminOnly`.
- `src/home/stores/apps.ts` — added `session = useSessionStore()`,
  `terminalAvailable` ref (null-means-unprobed, mirrors `kvmAvailable`), extended
  the `setApps` filter with the `requiresService === 'terminal'` and `adminOnly`
  conditions, added `probeTerminal()` (401/403 count as "installed", only
  404/5xx/network count as absent), wired it into `loadGrid()`'s `Promise.all`,
  exported `terminalAvailable` alongside `kvmAvailable`.
- `src/home/stores/apps.test.ts` — extended the service mock with
  `getTerminalSettings`, added `describe('terminal tile gating (SP18)', ...)`
  with the four tests from the brief.
- `src/home/composables/useOpenAction.ts` — added the `terminal` branch inside
  `a.system`, routing to `/terminal`, with the brief's exact comment about there
  being no Vue2 fallback / no `strangler:disabled` flag.
- `oss/manifest.mjs`, `oss/tree.test.mjs` — unplanned but necessary fixes, see
  below.

## Test evidence

Step 3 (tests written, before implementation) — `pnpm vitest run
src/home/stores/apps.test.ts`: 24 pre-existing tests passed, 2 of the 4 new
tests failed as expected (`AssertionError: expected [...] to include
'terminal'`); the other 2 new tests passed trivially (they assert absence,
which was already true before the tile existed) — this differs slightly from
the brief's "all four fail" expectation but is the logically correct outcome
given what each assertion checks.

Step 5 (after implementation):
- `pnpm vitest run src/home/stores/apps.test.ts` -> 26 passed (26).
- `pnpm vitest run src/home/stores/apps.test.ts src/home/` -> found one
  pre-existing test in `src/home/apps/systemApps.test.ts` that plainly
  enumerated `requiresService`-gated tiles as `['vm']` only; updated (see
  below). After that fix: 60 files / 333 passed, plus 1 flaky failure in
  `DesktopContextMenu.test.ts` (analyzed and confirmed pre-existing/unrelated,
  see below).
- `pnpm build` (`vue-tsc --noEmit && vite build`) -> exit 0, clean.
- `pnpm test` (full suite, 694 files / 11196 tests) run four times over the
  course of this task as fixes landed. Final clean-tree run:
  **694 files passed, 11196 tests passed** (`grep -n "Test Files\|Tests  "` ->
  `Test Files 694 passed (694)` / `Tests 11196 passed (11196)`), but the
  `pnpm test` process itself still exits 1 because of one **pre-existing,
  unrelated** unhandled rejection — see "Known pre-existing issues" below.
- `pnpm vitest run oss/` -> 7 files / 146 tests passed (was 4 files failed /
  3 tests failed + 2 suites crashed before the anchor fix, all due to the
  dirty working tree during mid-task WIP, then 1 remaining real failure from
  the anchor/wording drift, fixed — see below).

## Pre-existing test updated (and why)

`src/home/apps/systemApps.test.ts`, describe `'SYSTEM_APPS -- optional services
(SP17 #125)'`:

```ts
it('kvm is the only tile gated on a service being reachable', () => {
  const gated = SYSTEM_APPS.filter((a) => a.requiresService)
  expect(gated.map((a) => a.key)).toEqual(['vm'])
  expect(gated[0].requiresService).toBe('kvm')
})
```

This test's *intent* was "there is exactly one service-gated tile, and it's
kvm" -- true at SP17 time, no longer true now that Task 8 makes `terminal` a
second service-gated tile by design (that's the whole point of this task).
This isn't a case of "layout test happens to pin a count nobody meant to pin"
-- it plainly enumerates the gated set, so per the brief's Step 5 instruction
I updated the expectation rather than leaving it broken:

```ts
describe('SYSTEM_APPS -- optional services (SP17 #125, extended SP18 #terminal)', () => {
  it('kvm and terminal are the tiles gated on a service being reachable', () => {
    const gated = SYSTEM_APPS.filter((a) => a.requiresService)
    expect(gated.map((a) => a.key)).toEqual(['vm', 'terminal'])
    expect(gated.map((a) => a.requiresService)).toEqual(['kvm', 'terminal'])
  })

  it('terminal is the only tile additionally gated on admin role (SP18)', () => {
    const adminOnly = SYSTEM_APPS.filter((a) => a.adminOnly)
    expect(adminOnly.map((a) => a.key)).toEqual(['terminal'])
  })
})
```

## Deviation from the brief: added `setActivePinia`/mock resets in the new describe block

The brief's literal test code for `describe('terminal tile gating (SP18)', ...)`
does not call `setActivePinia(createPinia())` in its `beforeEach`, unlike every
other describe block in the file (including the sibling `'KVM tile gating'`
block it's modeled on). I traced through what that would actually do:

- Without a fresh Pinia instance, `useAppsStore()` in the new describe's tests
  would return the *same* store instance left over from whatever ran last in
  the file (the last KVM-gating test), including its already-computed `order`.
- `useSessionStore().isAdmin` is a Vue `computed` that only re-evaluates when
  its one reactive dependency (`userVersion`) changes; it does **not** re-read
  `localStorage` on every access despite what the brief's summary implied --
  it's only guaranteed to see a *fresh* `localStorage.setItem('user', ...)` on
  the *first* evaluation of that computed for a given store instance. Reusing
  a stale store/session instance across tests means `isAdmin` can be cached
  from a state where `localStorage` didn't yet have `user` set (all the KVM
  tests never set it), which would make the very first new test
  (`'renders the tile before the probe answers'`) fail: `order` would already
  have been computed once, before `terminal` even existed as an admin-visible
  concept in that instance's history.

I verified empirically that the tests fail without pinia isolation is a real
risk, not just theory -- the store returned by a stale active Pinia instance
does carry over `order`/`kvmAvailable` state from whichever test last touched
it. To make the four new tests deterministic and independent of file/describe
ordering (matching how every other describe block in this file already
behaves), I added `setActivePinia(createPinia())` plus `getGrid.mockReset();
getKvmSettings.mockReset(); getTerminalSettings.mockReset()` to the new
`beforeEach`, on top of the brief's `localStorage.setItem(...)` /
`getGrid.mockResolvedValue([])` / `getKvmSettings.mockResolvedValue({})` lines.
This is a superset of the brief's code, not a behavior change to the store or
components -- purely test isolation. All four new tests plus all 22
pre-existing tests in the file pass with this addition.

## Unplanned fix: oss export anchor + forbidden-word cleanup

Not called out in the brief, but required for the suite to stay green: the
public/open-source export pipeline (`oss/manifest.mjs`, exercised by
`oss/*.test.mjs`) has a `PATCH` entry for `src/home/composables/useOpenAction.ts`
whose `find` string was a literal snippet spanning the `knowledge` branch
through to the `window.location.href` fallback line. Task 8 inserted the new
`terminal` branch *between* those two lines, so the anchor stopped matching
("锚点未命中" -- by design, the export guard treats this as "go look at what
changed and update the anchor," not a silent skip).

Two things had to happen, since `terminal` (unlike `knowledge`/`ai`/`photos`)
is confirmed to be a **kept, public-facing** feature in the open-source export
-- the settings-page `terminal` rail tab is already preserved unchanged
elsewhere in the same manifest, so stripping the desktop tile would have been
inconsistent:

1. Widened the `find` anchor to include the new terminal lines, and changed
   `replace` to *keep* a terminal branch (reworded, not deleted) instead of
   dropping it the way `knowledge`'s line is dropped.
2. The first wording I wrote for the kept comment leaked internal-only terms
   the export's own guard tests forbid from ending up in public replacement
   text (`oss/tree.test.mjs`'s `FORBIDDEN` list): it initially said
   *"SP18 in-app route... Vue2 no longer exists... strangler:disabled flag"* --
   all three of `SP\d`, `Vue2`, and `strangler` (case-insensitive) are on that
   list, plus a separate assertion elsewhere in the same file also forbids the
   word `legacy`. Rewrote to a neutral, feature-only comment with none of
   those terms:
   ```ts
   // Terminal has no counterpart to fall back to, so it always routes
   // into this app.
   if (key === 'terminal') { router.push('/terminal'); return }
   router.push(SYS_ROUTE[key] || '/')
   return
   ```

Also updated `oss/tree.test.mjs`'s `'系统应用清单只剩 5 个...'` fixture (renamed
to "6 个") since the exported `systemApps.ts` now legitimately keeps 6 tiles
(`files/storage/vm/settings/appstore/terminal`) instead of 5 -- same category
of "plainly enumerates, must be updated" as the systemApps.test.ts fix above,
just discovered one level down in the export self-tests.

Verified with `pnpm vitest run oss/` -> 7 files / 146 tests all green on a
clean working tree.

## Known pre-existing issues (not caused by this task, left as-is)

1. **`DesktopContextMenu.test.ts` timing flake under full-suite load.** One test
   (`'handles a right-click on blank canvas'`, and occasionally its sibling
   `'renders a menu item carrying the wpChangeWallpaper label'`) intermittently
   fails when the entire `src/home/` or full suite runs, but passes 100% of the
   time standalone (`pnpm vitest run src/home/components/DesktopContextMenu.test.ts`
   -> 6/6 every time, run repeatedly). The file's own comments already document
   this exact class of reka-ui portal timing sensitivity ("this used to fail in
   the full suite while passing when the file ran on its own"). Confirmed this
   is unrelated to Task 8: reverted all Task 8 changes with `git stash -u` and
   reran `pnpm vitest run src/home/` -> 329/329 clean; reapplied the changes and
   reran twice more -> 334/334 clean both times. The failure is load/timing
   dependent (more test files in the run = more contention), not caused by any
   diff in this task -- it surfaces or not depending on machine load at run time.

2. **`favorites.test.ts` unhandled rejection makes `pnpm test` exit 1 despite
   all tests passing.** The final full-suite run shows `Test Files 694 passed
   (694)` / `Tests 11196 passed (11196)` with zero `FAIL` lines, but the process
   still exits 1 because of one `Unhandled Rejection` (`TypeError: Cannot read
   properties of null (reading '_cookieJar')`) traced to
   `src/photos/stores/favorites.ts:116` (`exportZip`) setting
   `window.location.href` inside jsdom, which throws "Not implemented:
   navigation" asynchronously outside the test's own assertion flow. This file
   is entirely untouched by Task 8 (photos area, nothing to do with the home
   store or the terminal tile) and the failure signature matches a pattern this
   codebase's own memory notes have already flagged elsewhere ("vitest exit 1
   despite all tests green" from jsdom navigation limitations). Left alone as
   out of scope for this task.

## No deviations from the brief's actual code

`systemApps.ts`, `apps.ts`, and `useOpenAction.ts` changes match the brief's
snippets verbatim (glyph path, filter conditions, `probeTerminal` semantics,
`loadGrid` wiring, export list, and the terminal routing branch/comment).

## Final state (before review fix)

- Working tree clean, both commits in place on branch `sp18-terminal`:
  - `650550a` feat(home): admin-only terminal tile gated by a service probe
  - `dac7d40` fix(oss): update export anchors and fixtures for the terminal tile
- `pnpm build` clean.
- `pnpm vitest run oss/` clean (146/146).
- `pnpm test` (full suite): 11196/11196 individual tests pass; process exit
  code is 1 solely due to the pre-existing, unrelated `favorites.test.ts`
  jsdom navigation issue described above.

---

## Review fix (commit `820cfc4`): DELETE -> PATCH for systemApps.test.ts

**Finding (Important, from task review):** the `DELETE` entry for
`src/home/apps/systemApps.test.ts` in `oss/manifest.mjs` wholesale-removed the
file from the public export. Its stated justification ("only two knowledge-only
orphan tests, not worth a PATCH for a one-test shell") was written at SP14 and
had gone stale: Task 8 added the kvm+terminal service-gating `describe` block
to this same file, and both `kvm` and `terminal` are public/kept features in
the export (unlike `knowledge`/`ai`/`photos`). Left as a `DELETE`, the public
repo would have shipped the terminal tile with zero gating-test coverage, and
silently dropped the pre-existing kvm-gating coverage too.

**Fix.** Removed the `DELETE` line for `src/home/apps/systemApps.test.ts`
(with an explanatory comment referencing this finding) and added a `PATCH`
entry in its place. The anchor covers only the private source's first
`describe` block:

```ts
describe('SYSTEM_APPS -- knowledge (SP14 #98)', () => {
  it('knowledge is registered with an i18n label and an icon', () => { ... })
  it('keys are unique (Dock and AddPanel both dedupe by key)', () => { ... })
})
```

and replaces it with just the dedupe test, rehoused as a standalone `it` (not
knowledge-specific -- it only depends on `SYSTEM_APP_KEYS` -- and keeping it
also keeps that import from going dead/unused):

```ts
it('keys are unique (Dock and AddPanel both dedupe by key)', () => {
  expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
})
```

The second `describe` block (`'SYSTEM_APPS -- optional services (SP17 #125,
extended SP18 #terminal)'`, containing the kvm+terminal gating tests added in
this task) is **not** touched by this PATCH -- it ships unmodified from the
private source, exactly as `src/home/stores/apps.test.ts`'s own
`'KVM tile gating (SP17 #125)'` describe already ships unmodified elsewhere.

**Why the anchor is stable and why the kept describe's "SP17"/"SP18" text is
not a forbidden-word violation:** `oss/tree.test.mjs`'s `FORBIDDEN` word list
(`/\bSP\d/i`, `Vue2`, `strangler`, `cutover`, etc.) is checked against two
things only: the 4 `REPLACE` "frozen clone" files, and every `PATCH` entry's
`.replace` string (see `oss/tree.test.mjs:550-565`). It is **not** a whole-tree
scan of the final exported content. Since my PATCH's `replace` string is just
the bare dedupe test with no "SP\d"/"Vue2"/etc. text in it, and the kvm/terminal
`describe` block is untouched original content (never passes through any
`find`/`replace`), it is outside that check's scope -- consistent with the
already-shipping `apps.test.ts` precedent above. I verified this is the
correct mental model empirically (see verification below), not just by
reading the test file.

Separately, `oss/forbidden.mjs`'s `HARD` word list includes `knowledge`
(`/\bknowledge\b/i`, no allow-list mechanism for HARD words) -- this is the
actual reason the `knowledge` describe block cannot survive in any form in
the export; it's why the fix removes it entirely rather than, say, renaming
the describe title.

### Verification

1. **Built the export tree and inspected the file directly** (twice: once
   before committing the fix, once after, both are identical):
   ```
   node oss/export.mjs --out <tmp dir under project scratchpad> \
     --skip-guard --no-commit --allow-dirty-oss
   ```
   Resulting `src/home/apps/systemApps.test.ts` in the exported tree:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { SYSTEM_APPS, SYSTEM_APP_KEYS } from './systemApps'

   it('keys are unique (Dock and AddPanel both dedupe by key)', () => {
     expect(new Set(SYSTEM_APP_KEYS).size).toBe(SYSTEM_APP_KEYS.length)
   })

   describe('SYSTEM_APPS -- optional services (SP17 #125, extended SP18 #terminal)', () => {
     it('kvm and terminal are the tiles gated on a service being reachable', () => {
       const gated = SYSTEM_APPS.filter((a) => a.requiresService)
       expect(gated.map((a) => a.key)).toEqual(['vm', 'terminal'])
       expect(gated.map((a) => a.requiresService)).toEqual(['kvm', 'terminal'])
     })

     it('terminal is the only tile additionally gated on admin role (SP18)', () => {
       const adminOnly = SYSTEM_APPS.filter((a) => a.adminOnly)
       expect(adminOnly.map((a) => a.key)).toEqual(['terminal'])
     })
   })
   ```
   `grep -rni "knowledge" .../src/home/apps/` on the exported tree -> zero
   matches (exit code 1, i.e. no hits). The kvm/terminal gating assertions and
   the standalone dedupe test are all present verbatim; the accompanying
   `systemApps.ts` in the same exported tree carries exactly 6
   `{ key: '...' }` entries (`files/storage/vm/settings/appstore/terminal`),
   matching the fixture already updated in the first fix pass.

2. **`pnpm vitest run oss/`** (full oss suite):
   - Before committing (only `oss/manifest.mjs` dirty, which is exempt from
     the working-tree-clean check via `--allow-dirty-oss`'s `oss/`-only
     carve-out in `export.mjs`): **7 files / 146 tests passed**.
   - Committed the fix as `820cfc4`, confirmed `git status --short` empty,
     re-ran on the clean committed tree: **7 files / 146 tests passed**
     (identical result, confirming the dirty-tree exemption didn't mask
     anything).

3. **Full suite, foreground-initiated** (auto-moved to background past the
   120s tool timeout, waited for its completion notification rather than
   guessing): `pnpm test` -> **694/694 test files passed, 11196/11196 tests
   passed, process exit code 0**. This run was fully clean end to end --
   notably cleaner than every prior run in this task, which had exited 1
   despite all tests passing because of an unrelated pre-existing
   `favorites.test.ts` jsdom-navigation unhandled rejection (untouched by
   either of this task's commits; not reproduced this run, consistent with it
   being a load/timing-sensitive jsdom quirk in unrelated photos code, not a
   deterministic failure).

### Files touched in this fix

- `oss/manifest.mjs` -- removed the `DELETE` line for
  `src/home/apps/systemApps.test.ts` (with a comment explaining why, pointing
  at this finding), added the replacement `PATCH` entry described above.

### Commit

- `820cfc4` fix(oss): keep kvm/terminal gating tests in the public export

## Final state (after review fix)

- Working tree clean, three commits in place on branch `sp18-terminal`:
  - `650550a` feat(home): admin-only terminal tile gated by a service probe
  - `dac7d40` fix(oss): update export anchors and fixtures for the terminal tile
  - `820cfc4` fix(oss): keep kvm/terminal gating tests in the public export
- `pnpm build` clean.
- `pnpm vitest run oss/` clean (146/146) on the committed, clean tree.
- Export tree built and manually inspected: patched test file lands with the
  right content, zero "knowledge" mentions, kvm/terminal gating tests intact.
- `pnpm test` (full suite): 694/694 files, 11196/11196 tests, exit code 0.
