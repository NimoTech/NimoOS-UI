# Task 1 Report: `photosSettings` store

## What was implemented

`src/photos/stores/settings.ts` — a Pinia setup-function store `usePhotosSettingsStore`
(`defineStore('photos-settings', ...)`) exposing exactly the interface specified in the
brief:

- State: `aiFeatures`, `aiFeaturesLoaded`, `storage`, `storageError`, `about`,
  `retentionDays` (default 30), `scanIntervalMinutes` (default 1440).
- Actions: `fetchAiFeatures`, `setAiFeature`, `fetchStorage`, `fetchAbout`,
  `fetchRetention`, `setRetention`, `fetchScanInterval`, `setScanInterval`, `pruneCache`,
  `rebuildIndex(findRunningId?)`, `triggerScan`, `reclusterFaces`, `reset`.
- Types exported: `PhotosAiFeatures`, `PhotosStorageInfo`, `PhotosAboutInfo`.

Test file: `src/photos/stores/__tests__/settings.test.ts` — 28 cases (the brief's ~17
cases across Steps 1/5/9/10, plus additions I added while implementing to lock down the
`updateConfig` discrepancy below and to cover `fetchAbout`/`pruneCache`/`triggerScan`/
`reclusterFaces`/`reset`, none of which the brief had test blocks for but all of which are
in the produced interface).

## ⚠️ Brief-vs-shared-package discrepancy (the important one)

Step 7's open question ("does `updateConfig` support single-field increments?") — resolved
per the ruling by reading `.sp7/NimoOS-Service/src/photos.ts:43-70` verbatim:

```ts
async getConfig(): Promise<Record<string, unknown>> {
  const res = await http.get('/photos/config')
  return body<Record<string, unknown>>(res.data)
},
// extra: { scenesEnabled, ocrEnabled, smartViewEnabled, scanInterval } — 省略的字段后端保持现值
async updateConfig(
  watchDirs: string[],
  retentionDays?: number | null,
  facesEnabled?: boolean | null,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  const reqBody: Record<string, unknown> = { watchDirs }
  if (retentionDays != null) reqBody.retentionDays = retentionDays
  if (facesEnabled != null) reqBody.facesEnabled = facesEnabled
  for (const k of ['scenesEnabled', 'ocrEnabled', 'smartViewEnabled', 'scanInterval']) {
    if (extra[k] != null) reqBody[k] = extra[k]
  }
  const res = await http.put('/photos/config', reqBody)
  return body<unknown>(res.data)
},
```

**Conclusion: `updateConfig` is NOT `updateConfig(patch: object)`.** It is a **positional**
function `(watchDirs, retentionDays?, facesEnabled?, extra?)`. `watchDirs` is
unconditionally placed into the request body (`{ watchDirs }` — no way to omit it), and per
the existing `trash.ts` comment ("后端非空校验") and the Vue2 source below, the backend
rejects an empty `watchDirs` list. Only `retentionDays`/`facesEnabled`/the four `extra`
keys are truly optional (comment "省略的字段后端保持现值" applies to *those*, not to
`watchDirs`).

I cross-checked this against the Vue2 authority (`NimoOS-UI/src/store/modules/photos.js`),
which confirms the same shape and additionally shows the calling convention — **every
write action re-reads `getConfig()` immediately beforehand to get the current `watchDirs`
(and `retentionDays` where it isn't the field being changed) and re-sends them**:

```js
// :1281-1291 setAiFeatures
async setAiFeatures({ commit }, features) {
  commit('SET_AI_FEATURES', features)
  const res = await photosService.getConfig()
  const watchDirs = res?.data?.watchDirs || []
  const retention = res?.data?.retentionDays
  await photosService.updateConfig(watchDirs, retention, !!features.faces, {
    scenesEnabled: !!features.scenes, ocrEnabled: !!features.ocr, smartViewEnabled: !!features.smartview,
  })
},
// :1419-1425 setTrashRetention
async setTrashRetention({ commit }, days) {
  const res = await photosService.getConfig()
  const watchDirs = res?.data?.watchDirs || []
  await photosService.updateConfig(watchDirs, days)
  commit('SET_TRASH_RETENTION', days)
},
// :1432-1438 setScanInterval
async setScanInterval({ commit }, minutes) {
  const res = await photosService.getConfig()
  const watchDirs = res?.data?.watchDirs || []
  const retention = res?.data?.retentionDays
  await photosService.updateConfig(watchDirs, retention, undefined, { scanInterval: minutes })
  commit('SET_SCAN_INTERVAL', minutes)
},
```

The brief's Step 7/Step 9 pseudo-code (`service.photos.updateConfig({ retentionDays: days })`
style single-object calls) does **not** match the shared package's actual exported
signature and would fail `vue-tsc --noEmit` if implemented literally (first positional
param is `string[]`, not an object). I implemented per the source instead: `setAiFeature`,
`setRetention`, and `setScanInterval` each do a `getConfig()` read immediately before
`updateConfig`, extracting `watchDirs` (and `retentionDays` where relevant) to re-send,
exactly mirroring the three Vue2 actions above. This is flagged prominently per the
"source wins" directive — it's a materially different (and correct) contract from what the
brief's copy-pasteable code implied.

I added two extra assertions the brief didn't include (in `describe('· setAiFeature')` and
`· retention & scanInterval 回滚`) that pin the exact `updateConfig` call arguments
(`toHaveBeenCalledWith([...watchDirs], retention, ...)`) so a regression back to the
brief's wrong shape would be caught immediately by `vue-tsc` (type error) and by these
tests (wrong call args) both.

## `readAiFeatures` — no discrepancy, kept the brief's dual-shape design

Vue2 `fetchAiFeatures` (`store/modules/photos.js:1294-1306`) reads flat fields directly off
`res.data` — `d.facesEnabled !== false`, `d.scenesEnabled !== false`,
`d.ocrEnabled !== false`, `d.smartViewEnabled !== false` (note the `smartViewEnabled`
camelCase inconsistency vs. the other three). The brief's `readAiFeatures` helper falls back
`cfg?.aiFeatures ?? cfg` before reading fields, so it transparently handles both the real
flat backend shape and the test fixture's nested `{ aiFeatures: {...} }` shape. I verified
this is correct for both and added one more test (`真实后端形状(扁平...)`) pinning the flat
shape directly, since the brief's own three aiFeatures tests only ever exercised the nested
fixture shape.

## Files changed

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/settings.ts` (new)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/__tests__/settings.test.ts` (new)

## TDD evidence

**RED** (Step 2, before `settings.ts` existed):
```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
FAIL  src/photos/stores/__tests__/settings.test.ts [ src/photos/stores/__tests__/settings.test.ts ]
Error: Failed to resolve import "../settings" from "src/photos/stores/__tests__/settings.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
Expected failure — the store module didn't exist yet.

Mid-implementation there was one more unplanned RED: after writing `setAiFeature` with the
corrected read-then-write shape, the brief's own "optimistic update" test (Step 5's third
case) **timed out** because my `setAiFeature` now awaits `getConfig()` before calling
`updateConfig()`, so the test's synchronous `release?.()` call (right after the
optimistic-flip assertion) fired before `updateConfig`'s mock implementation had even run —
`release` was still `undefined`. Fixed by making the test wait
(`await vi.waitFor(() => { if (!release) throw ... })`) for `updateConfig` to actually be
invoked before releasing it. This is a genuine consequence of the `updateConfig` signature
correction above, not a flaw in the store logic.

**GREEN** (final):
```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
...
 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  17:56:04
   Duration  706ms
```
0 `[Vue warn]` occurrences in the full verbose output (only expected `console.error` lines
from tests that intentionally trigger the store's own error-logging on rejected mocks —
these are assertions-under-test, not warnings).

```
$ pnpm exec vue-tsc --noEmit
(no output — exit 0)
```

## Mutation verification (Step 12) — all 5 items

Each mutation applied to the working file, focused test re-run, confirmed RED, then
restored from a saved copy before moving to the next.

1. **`on()` from `v !== false` to `!!v`** → 2 of the 4 aiFeatures tests turned red
   (`缺字段一律按开启` and `只有显式 false 才关`), exactly the two the mutation is meant to
   break. Restored, green.
2. **Deleted `aiFeatures.value = prev` in `setAiFeature`'s catch** → the rollback test
   (`保存失败:开关回滚到上一个已知好值`) turned red; the other 3 setAiFeature tests stayed
   green (as expected — they don't exercise the failure path). Restored, green.
3. **`fetchScanInterval`'s guard changed from `Number.isFinite(v) && v >= 0` to `if (v)`** →
   the `scanInterval 允许 0` test turned red (0 is falsy, got dropped, defaulted stayed at
   1440). Restored, green.
4. **Deleted the 409 branch in `rebuildIndex`** (left `catch (e) { throw e }`) → the 409
   test turned red (attempted to resolve `'t-running'`, instead rejected); the normal-path
   and non-409 tests stayed green. Restored, green.
5. **`storageError.value = !storage.value` changed to unconditional `false`** on the success
   path → the "空体也算失败态" test turned red (`storage.value = null` from a `null`
   response no longer flipped `storageError` to `true`). Restored, green.

All 5 restorations verified back to 28/28 green + `vue-tsc --noEmit` exit 0 before
committing.

## Self-review findings

- Followed sibling-store conventions (`favorites.ts`/`trash.ts`): setup-function store,
  `console.error('[photos-settings] <action>', e)` logging idiom, "loaded flag only on
  success path" comment lineage, optimistic-flip + rollback pattern for single-field writes.
- No unrelated refactors: did not touch `trash.ts`'s own `fetchRetention`/`setRetention`
  (duplication is intentional per the task's outside-brief note 1 — flagged below as a
  concern for the final review to triage, not resolved here).
- No watcher-suppression-flag port: per brief's explicit call-out, the Vue2
  `_suppressFeaturesWatch`/`_suppressRetentionWatch` pattern has no New-UI analog since
  writes are explicit action calls, not a deep watcher — documented in a comment at the
  `setAiFeature` definition rather than silently dropped.
- `rebuildIndex` takes an optional `findRunningId` callback exactly per the brief's
  cross-store-avoidance requirement; `timeline.ts` is not imported.
- Type safety: `getStorage()`/`getAbout()` return `Record<string, unknown>` per the shared
  package's actual signature, so casting straight to `PhotosStorageInfo | null` /
  `PhotosAboutInfo | null` failed `vue-tsc` (TS2352, insufficient overlap) — fixed with an
  intermediate `as unknown as ...` cast (not a `readonly`/ref workaround, since these are
  already plain `ref`s, not computed).
- Test coverage added beyond the brief's own blocks (not required by the brief, but needed
  since the produced interface includes `fetchAbout`, `pruneCache`, `triggerScan`,
  `reclusterFaces`, `reset`, none of which had brief-supplied test snippets): 12 additional
  cases covering these plus the `updateConfig` call-argument assertions and the flat-shape
  `readAiFeatures` case.

## Concerns (for final review to triage)

1. **Retention duplication.** `trash.ts` already has its own `fetchRetention`/`setRetention`
   reading `retentionDays` off `getConfig()`, used by the trash view. This store
   (`settings.ts`) has an independent copy for the settings page's Storage card. Per the
   outside-brief ruling this is intentional (trash view is out of scope, no refactor), but
   it means two stores independently poll/cache the same backend field with slightly
   different defaulting behavior (trash.ts: `if (d > 0)`; settings.ts: same `if (d > 0)`
   idiom, kept consistent on purpose). Worth consolidating in a later task if the settings
   page and trash view are ever loaded together and need to stay in sync.
2. **`updateConfig` re-reads `getConfig()` on every write.** Every one of `setAiFeature`,
   `setRetention`, `setScanInterval` does a `getConfig()` + `updateConfig()` round-trip
   (2 network calls per write), matching Vue2's behavior exactly. This is a pre-existing
   Vue2 characteristic (not introduced by this port) but worth noting: if a user flips two
   AI switches back-to-back quickly, both writes independently re-read `getConfig()`, which
   could theoretically race (last-read-wins on `watchDirs`/`retentionDays` if the config
   changes between reads) — this is the same behavior Vue2 has, not a regression.

## Mutation/discrepancy summary for the record

- Brief's `updateConfig({...})` object-call pseudocode in Steps 7/9 does not match the
  shared package's actual positional signature — implemented per source
  (`.sp7/NimoOS-Service/src/photos.ts:48-62`), confirmed against Vue2
  (`store/modules/photos.js:1249-1438`), and locked down with argument-matching tests plus
  `vue-tsc` type-checking (a wrong-shape call fails to compile).
- All other Vue2-sourced decisions in the brief (aiFeatures default-on, `smartViewEnabled`
  camelCase quirk, retention-watcher-missing-rollback treated as a bug and fixed, scanInterval
  0-is-valid, rebuildIndex 409 handling) matched the Vue2 source exactly as described in the
  brief — no further discrepancies found.

---

## Fix report (post-review: Important 1 + Minor 3)

### Important 1 — `rebuildIndex`'s 409 contract

The review correctly found that `rebuildIndex(findRunningId?: () => string | undefined)`
diverged from the brief's produced interface (`rebuildIndex(): Promise<string>`, no
params) and from Vue2 (`PhotosSettings.vue:458-473`, which does the task-list refresh and
`type === 'rebuild'` search itself, not via a caller-supplied callback). The coordinator
also retracted the instruction that had forced the callback design ("do not import the
timeline store from inside `settings.ts`" was meant to ban a second poller, not consumption
of the existing `useTimelineStore().fetchTasks()`/`tasks`).

**What changed** (`src/photos/stores/settings.ts`):

- `rebuildIndex()` now takes zero parameters, matching the brief's interface exactly.
- Added `import { useTimelineStore } from './timeline'` at module top (the import itself is
  fine at module scope — only the *call* `useTimelineStore()` must happen inside the action
  body, after Pinia is active, which is where it now lives).
- On 409: calls `useTimelineStore()` inside the `catch` block, awaits its existing
  `fetchTasks()` action once (the direct equivalent of Vue2's one-time
  `dispatch('photos/fetchTasks')` at `:466`), then searches the store's own `tasks` ref for
  `type === 'rebuild'` and returns that task's `id` (coerced to `string` via
  `String(running.id)` since `TaskBusPayload.id` is typed `string | number | undefined`),
  or `''` if none is found. No second poller is created — `fetchTasks()` is timeline.ts's
  pre-existing one-shot refresh action, called once per 409.
- Updated the file-header comment block to point at this resolution instead of the retired
  callback design.

**Test changes** (`__tests__/settings.test.ts`):

- Added `vi.mock('../timeline', () => ({ useTimelineStore: vi.fn() }))` and
  `import { useTimelineStore } from '../timeline'`, following the cross-store mocking idiom
  already established in `trash.test.ts` (mock the whole module rather than spin up a real
  second Pinia store instance).
- Rewrote the "409 = 已有重建在跑" test to mock `useTimelineStore` returning an object whose
  `fetchTasks` mock **populates `tasks` as a side effect when called** (rather than
  pre-seeding `tasks` before the call) — this is what makes the mutation-verification below
  meaningful: if `rebuildIndex` stopped calling `fetchTasks()`, `tasks` would stay at its
  initial empty array and the test would go red, not silently pass on stale seeded state.
  Asserts both the resolved id (`'t-running'`) and that `fetchTasks` was called exactly once.
- Added a new case, "409 但刷新后的任务列表里没有 rebuild 类型任务", covering the
  no-matching-task branch (`tasks` populated with only an `upload`-type task) → expects
  `''`.
- Removed the old callback-based test entirely (`s.rebuildIndex(() => 't-running')` is no
  longer valid — the interface takes no arguments).

### Minor 3 — tightened the `reset()` test

The review found `about` and `storageError`'s post-reset assertions were trivially true
(neither had ever been given a non-default value before `reset()` was called). Fixed by:

- Adding a `getAbout` mock and calling `s.fetchAbout()` before `reset()`, so `about` holds a
  real object beforehand.
- For `storageError`: since `storage` and `storageError` are coupled 1:1 by `fetchStorage`
  (success → non-null + false, failure → null + true), there is no way to reach
  "`storage` non-null AND `storageError` true" simultaneously through the store's own public
  actions — and the pre-existing `storage` assertion (successful fetch → non-null → reset →
  null) was *not* flagged as trivial by the review, so it had to stay meaningful too.
  Resolved by keeping the successful `fetchStorage()` call (proves `storage` non-null →
  null across `reset()`) and then directly setting `s.storageError = true` on the store
  instance afterward, purely for test setup (the brief's own Step 9 guidance already
  establishes that setup-store refs are writable through the instance for this purpose).
  Added three pre-reset sentinel assertions (`about`/`storage` not null, `storageError`
  true) documenting that the subsequent `reset()` assertions aren't starting from defaults.

### Covering tests run

```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose
...
 Test Files  1 passed (1)
      Tests  29 passed (29)
   Start at  18:23:16
   Duration  698ms
```
`[Vue warn]` occurrences in the full verbose output: **0** (only expected `console.error`
lines from tests that intentionally trigger the store's own error logging).

```
$ pnpm exec vue-tsc --noEmit
(no output — exit 0)
```

### Sixth mutation verification (Important 1's fix)

Per the coordinator's instruction, mutated the fix by deleting the `await
timeline.fetchTasks()` call inside the 409 branch (leaving the `tasks.find(...)` read in
place, now reading the never-populated initial empty array) and re-ran the focused test:

```
$ pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts -t "409" --reporter=verbose
 ✓ ... 正常路径返回新 taskId
 × ... 409 = 已有重建在跑:不抛错,调用 timeline.fetchTasks() 刷新一次后返回运行中那条 rebuild 任务的 id(Vue2 :458-473)
 ✓ ... 409 但刷新后的任务列表里没有 rebuild 类型任务:返回空字符串
 ✓ ... 非 409 错误照常抛出
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed | 25 skipped (29)
```
The "finds the running task" case went red exactly as expected — with the refresh call
gone, `tasks` never gets populated, so the store resolves `''` instead of the expected
`'t-running'`. This confirms the test is asserting against the actual refresh call, not
pre-seeded state. (The "no rebuild task" case stays green under this mutation because both
its expected and actual values are `''` — that's expected and doesn't indicate a weak test,
since that case's job is to cover the found-nothing branch, not the refresh-happened
invariant.) Restored the fix, re-verified 29/29 green + `vue-tsc --noEmit` exit 0 before
finishing.

### Files changed (this fix)

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/settings.ts`
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/__tests__/settings.test.ts`
