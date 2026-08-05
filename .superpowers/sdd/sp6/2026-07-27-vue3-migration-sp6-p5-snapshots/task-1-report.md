# Task 1 Report: 快照纯函数与视图类型(`snapshotView.ts`)

## Files changed
- Created: `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/util/snapshotView.ts`
- Created: `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/util/snapshotView.test.ts`

Commit: `99b7f3f` — `feat(storage): 快照纯函数与视图类型逐字移植(P5 T1)`

## TDD evidence

### RED — Step 2
Command: `pnpm exec vitest run src/storage/util/snapshotView.test.ts`

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp6/NimoOS-New-UI

 ❯ src/storage/util/snapshotView.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/storage/util/snapshotView.test.ts [ src/storage/util/snapshotView.test.ts ]
Error: Failed to resolve import "./snapshotView" from "src/storage/util/snapshotView.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

Test file was written verbatim from brief Step 1 before any implementation existed — confirmed FAIL (module not found), as expected.

### GREEN — Step 4
Command: `pnpm exec vitest run src/storage/util/snapshotView.test.ts`

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp6/NimoOS-New-UI

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

Type check: `pnpm exec vue-tsc --noEmit` → zero output, zero errors.

Full suite regression check: `pnpm exec vitest run` → `Test Files 242 passed (242)`, `Tests 1439 passed (1439)`.

## Implementation summary

Ported line-by-line from `NimoOS-UI/src/service/snapshot.js` lines 1-137:
- `resolveSnapshotState` (js:6-9)
- `validatePolicyForm` (js:15-31)
- `classifySnapshotType` (js:45-49)
- `snapshotTypeLabelKey`
- `formatSnapshotClockTime` (js:64-69)
- `dayKeyOf` (internal helper, js:68-70)
- `snapshotDayLabel` (js:80-89)
- `toSnapshotViewModel` (js:95-108)
- `groupSnapshotsByDay` (js:112-131)
- `defaultExpandedDayKeys` (js:135-137)

Deliberately **not** ported (per brief, deferred to a later phase): `snapshotBrowsePath`, `parseSnapshotBrowsePath`, `liveVolumePath`, `parseSnapshotName`, `formatSnapshotBannerTime`, `findVolumeForPath` (js:139-237, the file-browser path helper suite) and the `snapshot` API object (js:239-286, network calls — out of scope for this pure-function task). File header comment records this explicitly.

Added `asSnapshotVolume` — new in New-UI (not in Vue2 source), following the `raidView.asRaidArray` narrowing-mapper convention, since `SnapshotVolume`'s index signature makes `count`/`last_at`/`paused_reason` reads `unknown` under TS strict. Defaults: `supported`/`enabled` → `false`, `count` → `0`, `last_at`/`paused_reason` → `''` — matches brief's exact spec and test expectations.

Sort comparator in `groupSnapshotsByDay` uses `new Date(b.created_at).getTime() - new Date(a.created_at).getTime()` instead of Vue2's implicit `new Date(b.created_at) - new Date(a.created_at)` (Date-minus-Date auto-coerces to number in JS but is a TS type error) — numerically identical, not a logic change.

## Known/intentional deviations from Vue2 (both flagged in brief as pre-approved)

1. **Error-value keys renamed to named i18n keys** (Global Constraints 偏离 3): Vue2 used the raw English string as both the map key and fallback copy (`"Must be a positive whole number"`, `"Must be a whole number between 1 and 100"`, `"Auto"`, `"Manual"`, `"Pre-op protection"`, `"Today"`, `"Yesterday"`). Ported code returns the named keys `'snapErrPositiveInt'`, `'snapErrPercent'`, `'snapTypeAuto'`, `'snapTypeManual'`, `'snapTypePreop'`, `'snapToday'`, `'snapYesterday'` instead. All underlying *conditions* (positive-int check, 1-100 range check, manual/preop/auto classification, today/yesterday/older date comparison) are copied verbatim — only the string literal returned for each branch changed from ad hoc English prose to a stable key name. These keys are not yet wired into `zh_cn.ts`/`en_us.ts` per this task's scope (deferred to a later task per Global Constraints).
2. **`asSnapshotVolume` is new** (not present in Vue2 at all) — a narrowing mapper for the `SnapshotVolume` type's index-signature fields, following the existing `raidView.asRaidArray` pattern in this repo. Pure additive scaffolding required by TS strict; no behavior change to any ported logic.

No other deviations. No bugs/races from Vue2 were identified in the ported range (lines 1-137) that needed correcting — the two Vue2 code comments referencing "M2-T2" work items were dropped/paraphrased into the TS comments but the described behavior is unchanged.

## Self-review findings
- Verified all 16 test cases from the brief's Step 1 test file were transcribed verbatim (no rewriting) — diffed mentally against brief lines 56-178, byte-for-byte match.
- Verified `SnapshotItemView.type` field type: brief interface says `type: string` but `SnapshotRaw.type` is optional (`type?: string`), and `toSnapshotViewModel` passes `snap.type` straight through — so `type` in the view can legitimately be `undefined` at runtime even though the brief's interface table writes `type: string`. Typed it as `type: string | undefined` to match actual data flow and satisfy `vue-tsc --noEmit` (assigning `string | undefined` to a `string`-typed field would fail strict mode). This is a type-annotation-only choice, not a behavior change; flagging in case a later task expects the field typed as `string` exactly per the brief's literal table.
- Confirmed `groupSnapshotsByDay` does not mutate its input (test 'X不改动输入数组' passes) — implementation copies via spread before sorting, matching Vue2's `[...(snapshots || [])]`.
- Confirmed no `Array.prototype.at()` usage anywhere (lib ES2020 constraint) — none needed.
- Confirmed no i18n locale files were touched (out of scope per Global Constraints; keys are return values only, to be wired in a later task).
- Confirmed no changes made outside `NimoOS-New-UI` worktree, no branch switch, no touching NimoOS-Service.
