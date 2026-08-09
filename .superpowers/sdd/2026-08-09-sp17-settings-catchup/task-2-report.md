# Task 2 report: LAN Devices settings tab (Vue2 #93)

## Status: DONE

Commits:
- `7b68025` — `feat(settings): add the LAN devices tab`
- `3590881` — `fix(oss): keep the export redaction manifest in sync with the LAN devices tab`

## What was implemented

Followed the brief's step order exactly (i18n keys → failing tab tests → tab model →
failing panel tests → panel → styles → registration → green):

1. **i18n keys** (`src/i18n/zh_cn.sp9.ts`, `src/i18n/en_us.sp9.ts`): 9 `settingsLan*` keys
   plus `settingsTabLanDevices`, verbatim from the brief (Vue2 `zh_CN.json`/`en_US.json`
   strings for `#93`).
2. **Tab model** (`src/settings/util/tabs.ts`): inserted `'lan-devices'` between
   `'system-status'` and `'folder-permissions'` in `SETTINGS_TABS`; `RAIL_TABS` slice
   `0,7` → `0,8`; added `TAB_LABEL_KEY['lan-devices']`; translated the rail comment to
   English and updated its count.
3. **Panel** (`src/settings/panels/LanDevicesPanel.vue`): fetch-on-mount, refresh button,
   IPv4-only `window.open` guard, generation-guarded scan (same idiom as
   `SystemStatusPanel.vue`), error state distinct from empty state (approved departure
   from Vue2's silent swallow).
4. **Styles** (`src/settings/styles/settings.css`): appended the `.set-lan-*` block from
   the brief verbatim, all colors via existing tokens (`--fg-muted`, `--border`,
   `--warn-fg`, `--remove-fg`) — confirmed present in both theme blocks in
   `src/styles/theme.css` before use.
5. **Registration** (`src/settings/panels/index.ts`): added the import and
   `PANEL_BY_TAB['lan-devices']` entry.
6. **Test-count fixups**: `panels.test.ts` (`toHaveLength(9)` → `10`), `tabs.test.ts`
   (`railTabsFor('user')` `toHaveLength(6)` → `7`, plus the two brief-specified full test
   bodies), and — **not named in the brief but broken by the `RAIL_TABS` 7→8 change** —
   `src/settings/components/SettingsShell.test.ts`'s three hardcoded `.set-rail-item`
   counts (6→7, 7→8, 6→7). This file renders `RAIL_TABS` directly, so it was guaranteed
   to break; fixed the numbers and titles only, did not touch anything else in the file.

## Two changes outside the brief's file list, and why each was necessary

The brief listed a specific file set and I stayed inside it until the full-suite run (see
below) surfaced two blocking gaps. Neither is scope creep — both are things the brief's
own file list could not have worked without, and I verified each with `git log`/`git diff`
before touching it.

**`packages/service/src/index.ts` (+1 line).** Task 1 (`00871cf`, already merged) added
`LanDevice`/`LanDiscovery` to `packages/service/src/types.ts` and `getLanDiscovery()` to
`sys.ts`, but never added them to the package barrel's `export type { ... }` line — every
other consumer in this codebase (e.g. `SystemStatusPanel.vue` importing `GatewayComponent`)
imports domain types from `@nimotech/nimoos-service` itself, not from `./types.js`
directly. Without this export, `import { type LanDevice } from '@nimotech/nimoos-service'`
in `LanDevicesPanel.vue` fails `vue-tsc` with `TS2305: has no exported member 'LanDevice'`.
Confirmed via `git show 00871cf --stat`: it touched `sys.ts`/`sys.test.ts`/`types.ts` only,
never `index.ts`. Fix: added `LanDevice, LanDiscovery` to the existing export-type list
(one line, alphabetically placed next to `GatewayDeviceInfo`).

**`src/settings/components/SettingsShell.test.ts` (3 count/title edits, all numeric).**
`SettingsShell.vue` renders `.set-rail-item` once per entry in `RAIL_TABS`. Growing
`RAIL_TABS` from 7 to 8 items (a direct, brief-mandated consequence of `tabs.ts`'s
`slice(0, 7)` → `slice(0, 8)`) makes every hardcoded rail-length assertion in this file
stale by construction — there is no way to add an 8th rail item without this file's
`toHaveLength(6)`/`toHaveLength(7)` assertions going red. `git log --oneline -3 -- <file>`
shows the file (and its `createI18n`/`global.plugins` pattern) predates SP17 by several
commits (`93d2b37`, `f44c260`, `30f3413`) — I did not introduce the pattern, only updated
the three numbers/titles that the rail-size change forced.

Both are the same category of "brief said touch 9 files, reality needs 11" as the two
ambiguity-resolution items the brief itself already called out for `panels.test.ts` and
`tabs.test.ts`.

## A third, larger blocking gap found only via the full suite: the OSS export manifest

Running `pnpm exec vitest run` (full suite) **before committing** showed only 3 failures,
all in `oss/`, all reading "工作树不干净,导出中止" (working tree dirty, export aborted)
— the OSS export self-guard refusing to run against an uncommitted tree, which reads as
"pre-existing, will resolve on commit." **After committing**, re-running the same 3 tests
turned up a real regression the dirty-tree guard had been masking:

```
[oss] 失败:锚点未命中:src/settings/util/tabs.ts
找的是:"  'system-status',\n  'folder-permissions',\n  'account',"
这是设计意图,不是故障 —— 看一眼私有侧那几行改成什么了,更新 manifest.mjs 的锚点。
```

`oss/manifest.mjs` is a redaction manifest: `oss/export.mjs` uses literal-substring
find/replace patches against this repo's private source to build the open-source export,
and one whole class of patches (`// ── tabs.ts:去 folder-permissions...`) strips the
admin-only `folder-permissions` tab out of the public product. Those patches anchor on the
*exact* pre-Task-2 text of `tabs.ts`/`tabs.test.ts`/`panels.test.ts`/
`SettingsShell.test.ts`. Inserting `lan-devices` (a legitimate public feature, unlike
`folder-permissions`) shifted or fully rewrote several of those anchors, so the export
guard failed loudly with a "this is by design, go update the anchor" message rather than
silently producing wrong output. I checked every manifest entry keyed to the four modified
files, confirmed which specific ones the brief's changes broke (7 of ~12), and:

- Updated each broken **FIND** to the new literal private-source text (including the
  now-English `RAIL_TABS` comment and test titles that the brief instructed me to
  translate).
- Updated each **REPLACE** to keep stripping only `folder-permissions`, while explicitly
  keeping `lan-devices` in the public output (it carries no admin-only/proprietary
  information — it just lists NimoOS devices on the LAN).
- Recomputed the derived numbers by hand (private counts minus the one redacted
  `folder-permissions` slot: `SETTINGS_TABS` 10→9, `RAIL_TABS` 8→7,
  `PANEL_BY_TAB` keys 10→9) and verified them against `oss/tree.test.mjs`'s independent
  guard assertions, which had **their own** stale hardcoded numbers (`slice(0, 6)`,
  `toHaveLength(8)`, `not.toMatch(/toHaveLength\(7\)/)`) that also needed updating to
  match the new post-redaction baseline (`slice(0, 7)`, `toHaveLength(9)`,
  `not.toMatch(/toHaveLength\(8\)/)` — the meaning of "8" flipped from "the legitimate
  admin-rail count" to "the now-deleted admin-only test's stale number", so the regex
  target itself had to move, not just its digit).
- Verified with `pnpm exec vitest run oss/` (146/146 pass, including the expensive "产物
  树能构建" `pnpm install` + `vue-tsc` build gate on the actual exported tree) before
  committing this fix separately.

This was committed as a second, separate commit (`3590881`) rather than folded into the
feature commit or an amend, per the "always create new commits, never amend without an
explicit request" rule — it is a distinct concern (keeping export tooling correct) from
the feature itself, and the coordinator's message only specified the feature commit's
message verbatim.

## The "clean test output" investigation

The coordinator flagged `[Vue warn]` noise as something to fix, not ignore. Investigated
and split into two buckets:

**Fixed (mine to fix): `LanDevicesPanel.test.ts`.** The brief's verbatim test file created
its own local `createI18n()` instance and passed it via `mount(..., { global: { plugins:
[i18n] } })`. `vitest.setup.ts` already installs a global default `i18n` (from
`src/i18n/index.ts`, which itself already merges `zh_cn` + `zh_cn.sp9`) into
`@vue/test-utils`'s `config.global.plugins` for every mount in the suite. `@vue/test-utils`
*merges* `config.global.plugins` with a mount call's local `global.plugins` rather than
replacing it, so both i18n plugin instances installed onto the same test app, and
vue-i18n's `install()` warned on the second attempt to register `i18n-t`/`I18nT`/`i18n-n`/
`I18nN`/`i18n-d`/`I18nD` and the `t` directive. Root-caused by checking `src/i18n/index.ts`
(confirms sp9 is already merged into the default global instance) and reproducing with
`--reporter=verbose`. Fix: dropped the redundant local `createI18n()`/`import` from my test
file entirely and mount with no plugin override — the global default already provides
everything the component needs. Verified clean with `--reporter=verbose` (see GREEN
evidence below): 7/7 pass, zero stderr.

**Not fixed (confirmed pre-existing, out of scope): `SettingsShell.test.ts` and
`panels.test.ts`.** Both already carry the identical `createI18n()` + `global.plugins`
double-install pattern, predating Task 2 by multiple commits (verified via `git log
--oneline -3` on `SettingsShell.test.ts`: `93d2b37`/`f44c260`/`30f3413`, all pre-SP17; and
by inspecting `panels.test.ts`'s own header, which already had this exact pattern before I
touched only its `toHaveLength` line). This is systemic across ~8 already-merged settings
panel test files, not something Task 2 introduced. Fixing it properly means either editing
shared `vitest.setup.ts` (used by all 675 test files) or rewriting every affected panel
test file's plugin wiring — a repo-wide test-infra change well beyond a single settings
tab, and risky to do as a drive-by. Left as-is; flagging for a dedicated follow-up.

## TDD evidence

**RED — tab model** (`pnpm exec vitest run src/settings/util/tabs.test.ts`, before editing
`tabs.ts`):
```
FAIL src/settings/util/tabs.test.ts > settings tabs 模型 > the rail holds 8 items...
AssertionError: expected [ 'general', 'storage', …(5) ] to deeply equal [ ...(6) ]
  "lan-devices" missing from RAIL_TABS
FAIL ... > 非 admin 看不到 folder-permissions...
AssertionError: expected [ ... ] to have a length of 7 but got 6
 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```
Expected: `SETTINGS_TABS`/`RAIL_TABS` didn't contain `'lan-devices'` yet, and
`railTabsFor('user')` still returned the old (6-item) length — exactly the gap `tabs.ts`
was about to close.

**GREEN — tab model** (same command, after editing `tabs.ts`):
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**RED — panel** (`pnpm exec vitest run src/settings/panels/LanDevicesPanel.test.ts`,
before creating `LanDevicesPanel.vue`):
```
FAIL src/settings/panels/LanDevicesPanel.test.ts [ src/settings/panels/LanDevicesPanel.test.ts ]
Error: Failed to resolve import "./LanDevicesPanel.vue" from ".../LanDevicesPanel.test.ts".
Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
Expected: the component file did not exist yet.

**GREEN — panel** (same command, after creating the component, with `--reporter=verbose`
to also confirm zero warning noise):
```
 ✓ LanDevicesPanel > renders one row per device and falls back for empty hostname/version 24ms
 ✓ LanDevicesPanel > marks the local device and refuses to open it 6ms
 ✓ LanDevicesPanel > refuses to open anything that is not a plain IPv4 address 3ms
 ✓ LanDevicesPanel > warns when the scan range was truncated 3ms
 ✓ LanDevicesPanel > shows the empty state when the network really has no other device 3ms
 ✓ LanDevicesPanel > shows an error line instead of the empty state when the request fails 3ms
 ✓ LanDevicesPanel > drops a slow first scan when a second one has already been started 3ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
(No `[Vue warn]` lines — confirmed after removing the redundant local i18n instance.)

**GREEN — coordinator's named focused set** (run in the foreground, as requested):
```
pnpm exec vitest run src/settings/panels/LanDevicesPanel.test.ts src/settings/panels/panels.test.ts \
  src/settings/util/tabs.test.ts src/settings/settingsRoutes.test.ts \
  src/settings/components/SettingsShell.test.ts src/i18n/parity.test.ts --reporter=verbose

 Test Files  6 passed (6)
      Tests  48 passed (48)
```
(`SettingsShell.test.ts`/`panels.test.ts` still print their pre-existing `[Vue warn]`
noise, root-caused above as out-of-scope, unrelated to my new file's warnings.)

**GREEN — vue-tsc**: `pnpm exec vue-tsc --noEmit` → exit 0, no output, both before and
after the `oss/` fix commit.

**GREEN — full suite, twice** (foreground, `timeout: 590000` passed directly to the tool
so it blocks synchronously instead of being auto-backgrounded at the 120s default):
- Before the `oss/` fix, on the clean committed tree: `675` files, `10934` tests... wait —
  first post-commit run actually showed the real `oss/manifest.mjs` anchor-mismatch
  regression (3 failed, `oss/cli-args.test.mjs` ×2 + `oss/export-rsync.test.mjs` ×1, the
  "锚点未命中" error quoted above).
- After the `oss/` fix commit, re-run on the clean tree:
  ```
   Test Files  675 passed (675)
        Tests  10934 passed (10934)
  ```
- `pnpm exec vitest run oss/` in isolation: `146/146` pass, including the "产物树能构建"
  gate that actually runs `pnpm install` + `vue-tsc --noEmit` against the exported tree.

The only remaining stderr in the full run is pre-existing jsdom `Not implemented:
navigation` / a sandboxed `/tmp/nimoos-www-*` permission message from
`src/photos/stores/__tests__/favorites.test.ts` — unrelated to settings, out of the
`src/photos/**` exclusion this task was told to respect, not touched.

## Files changed

Commit `7b68025`:
- `packages/service/src/index.ts` — export `LanDevice`/`LanDiscovery` (necessity above)
- `src/i18n/en_us.sp9.ts`, `src/i18n/zh_cn.sp9.ts` — 10 new keys, brief-verbatim
- `src/settings/components/SettingsShell.test.ts` — 3 count/title fixups (necessity above)
- `src/settings/panels/LanDevicesPanel.test.ts` — new (brief content, minus the redundant
  local i18n plumbing, see "clean test output" above)
- `src/settings/panels/LanDevicesPanel.vue` — new
- `src/settings/panels/index.ts` — import + registry entry
- `src/settings/panels/panels.test.ts` — `toHaveLength(9)` → `10`
- `src/settings/styles/settings.css` — `.set-lan-*` block appended
- `src/settings/util/tabs.test.ts` — brief's two rewritten tests + one count fixup
- `src/settings/util/tabs.ts` — `lan-devices` tab, rail slice 7→8, label key

Commit `3590881`:
- `oss/manifest.mjs` — 7 anchor FIND/REPLACE pairs updated to track the new tabs.ts/
  tabs.test.ts/panels.test.ts/SettingsShell.test.ts literal text
- `oss/tree.test.mjs` — 3 stale hardcoded counts in guard assertions corrected

## Self-review findings

- **Completeness against the brief**: all 12 steps done in order; both ambiguity-resolution
  items applied; both ports match Vue2 copy verbatim (double-checked against the brief's
  quoted strings character-for-character); the two approved departures (error state,
  generation guard) are present and match the brief's stated rationale, no additional
  unrequested behavior added.
- **Naming**: `.set-lan-*` class names, `settingsLan*`/`settingsTabLanDevices` i18n keys,
  and the `LanDevicesPanel` component/file name all follow the sibling `SystemStatusPanel`
  convention exactly.
- **YAGNI**: no separate util file was extracted (the brief called this out explicitly —
  one fetch + one IPv4 regex predicate doesn't earn an abstraction).
- **Do the tests verify real behavior**: yes — each assertion exercises actual rendered DOM
  (`.set-lan-row`/`.set-lan-warn`/`.set-lan-empty`/`.set-lan-error`) and real `window.open`
  call arguments, not mock call counts in isolation; the generation-guard test genuinely
  interleaves two unresolved promises rather than asserting on internal state.
- **Test output pristine**: yes for every file this task created or was required to touch;
  the two pre-existing warning sources were identified, root-caused, and left alone with a
  clear paper trail (not silently ignored, not papered over).

## Concerns

1. **`oss/manifest.mjs`/`oss/tree.test.mjs` were not in the brief's file list.** They
   needed changes only because inserting a new tab into `tabs.ts` is exactly the kind of
   edit the redaction manifest anchors on. I verified every one of the ~12 manifest entries
   keyed to the 4 files I touched, fixed the 7 that were actually broken, and ran the full
   `oss/` suite (146/146, including the real `pnpm install` + `vue-tsc` build-gate test)
   before committing. If a future task adds another tab, the same class of anchor breakage
   should be expected and is worth calling out explicitly in that task's brief.
2. **Pre-existing `[Vue warn]` noise remains in `SettingsShell.test.ts` and
   `panels.test.ts`** (not introduced by this task, confirmed via git history). Recommend a
   dedicated follow-up to either clear `config.global.plugins` before applying a
   test-local i18n instance, or drop the redundant local instances suite-wide now that
   `vitest.setup.ts`'s default i18n already carries every sp9 shard.
3. **`git status` and `pnpm test` (the `package.json` script) are slow** on this box (~4-5
   min for the full 675-file suite) — used `timeout: 590000` on the Bash tool directly
   (not a shell-level `timeout` wrapper, which doesn't affect the tool's own 120s default)
   to get synchronous, in-conversation output for the coordinator's "no background jobs"
   requirement.

---

## Follow-up: review fix — untranslated test titles (commit `e16d931`)

Review came back with one Important, everything else (including the three brief-external
changes from the first round, now confirmed as forced by this change and in scope): the
global constraint "an existing test's description, once updated, must be rewritten in
English" was applied correctly to the two edited titles in `tabs.test.ts` but missed on
the equivalent edits in `src/settings/components/SettingsShell.test.ts:428,436` — I'd
changed the digit inside `it('非 admin(无 user)rail 只有 6 项', …)` → `'...7 项'` and
`it('admin rail 有 7 项且含 folder-permissions', …)` → `'...8 项'` without translating the
surrounding Chinese title, even though I did translate the same-cause edits in the sibling
file in the first round.

### What was changed

`src/settings/components/SettingsShell.test.ts`:
- `'非 admin(无 user)rail 只有 7 项'` → `'non-admin (no user) rail has 7 items'`
- `'admin rail 有 8 项且含 folder-permissions'` → `'admin rail has 8 items and includes folder-permissions'`

Only the title strings changed; the assertions themselves (`toHaveLength(7)`/`(8)`,
`toContain('folder-permissions')`) are untouched.

**Connected risk, exactly as the coordinator called out**: `oss/manifest.mjs`'s
`SettingsShell.test.ts` entry anchors on the literal text of the admin-rail test's `it(...)`
line (it deletes that whole test block when redacting `folder-permissions` out of the
public export). Translating the title broke that anchor the same way inserting
`lan-devices` broke several anchors in the first round. Fixed the one affected anchor:

```js
// oss/manifest.mjs — before
find: `  it('admin rail 有 8 项且含 folder-permissions', async () => {
// oss/manifest.mjs — after
find: `  it('admin rail has 8 items and includes folder-permissions', async () => {
```
(`replace` stays `''` — the whole test block is still deleted in the OSS export; only the
FIND text needed to track the new title.) Checked `oss/tree.test.mjs` too: its guard for
this file (`expect(shell).not.toMatch(/toHaveLength\(8\)/)`) matches on the numeric
literal, not the title text, so it did not need a change.

### Coverage run (foreground, as instructed — no background jobs)

Command:
```
pnpm exec vitest run src/settings/components/SettingsShell.test.ts oss/ --reporter=verbose
```

First run (uncommitted): 4 failed test files / 3 failed tests, all reading
"工作树不干净,导出中止" (the OSS export's own dirty-tree guard) — expected, since the
fix was still unstaged. Committed (`e16d931`), then re-ran the identical command on the
clean tree:

```
 Test Files  8 passed (8)
      Tests  158 passed (158)
 Start at  17:06:33
 Duration  15.25s
```

This includes:
- `oss/tree.test.mjs > 类 4 · 测试同步 > 复审:HomeDock/SettingsShell 两个实测才暴露的漏网之鱼` — the guard specifically covering this file — pass.
- `oss/tree.test.mjs > 产物树能构建 > pnpm install + vue-tsc --noEmit 在产物树上全绿` — the real build-gate against the exported tree — pass.
- `src/settings/components/SettingsShell.test.ts` — all its tests, including the two
  retitled ones, pass with their new English titles.

Also re-ran `pnpm exec vue-tsc --noEmit` on the repo itself after this fix: exit 0, no
output.

### Commit

`e16d931` — `fix(settings): translate two edited test titles to English`

### Files changed this round

- `src/settings/components/SettingsShell.test.ts` — 2 title translations (no assertion changes)
- `oss/manifest.mjs` — 1 anchor FIND text updated to match the new English title
