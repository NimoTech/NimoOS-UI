# P1c2 Task 11 report — SystemTab (live utilization + storage card)

## Files

- New: `src/ai/util/systemTiles.ts` + `.test.ts` (pure, 4-tile mapping)
- New: `src/ai/util/toStoragePayload.ts` + `.test.ts` (pure, disk-array → StoragePayload)
- New: `src/ai/components/tabs/SystemTab.vue` + `.test.ts`
- Modified: `src/ai/views/AgentPage.vue` (one-shot `disks.list()` fetch + `storage` ref), `.test.ts`
- Modified: `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (8 new keys, both files)
- Not touched: `src/ai/components/shell/AgentRightPanel.vue` (still shows the `system` placeholder div — wiring `SystemTab` in is Task 13's job per its brief; this task's file list never named it), `src/ai/styles/agent-styles.scss` (only read).

## `systemTiles(data)` — field mapping (Vue2 `SystemTab.vue:38-53`)

Returns `SystemTile[]` — `{ labelKey, value, subKey?, subParams?, subText? }`. Follows the same "return i18n key names, not translated text" convention already established by `attachmentMeta.ts`'s `docErrorKey()` and (per its brief) `stagedGroups.ts`'s `relativeTime()`, since a plain function has no `useI18n()` context — `SystemTab.vue`'s template does the actual `t(labelKey)` / `t(subKey, subParams)` calls.

Reads `Utilization.cpu`/`.mem`/`.net` from `@nimotech/nimoos-service`'s parsed type. Those fields are typed as `UtilSection = Record<string, unknown> | null` in the package (untyped on purpose — `parseUtil` doesn't know the shape) so the function casts through `unknown` to locally-declared shape interfaces (`CpuSection`/`MemSection`/`NetItem`) before reading named fields. `net`'s real runtime value is an **array**, not the bare object the package type implies — confirmed by reading the actual backend (`NimoOS/route/v1/system.go:395` `data["net"] = newNet` where `newNet []model.IOCountersStat`, and the socket-push twin in `route/periodical.go`), so the function does `Array.isArray(data?.net)` before indexing `[0]`.

**Genuine Vue2 defect found and fixed (not copied)** — `SystemTab.vue:40-42`:
```js
const cpuPct = sm.cpu && sm.cpu.percent != null
  ? sm.cpu.percent.length ? sm.cpu.percent[0].toFixed(0) + '%' : '—'
  : '—'
```
This treats `cpu.percent` as an array (`.length`, `[0]`). I traced the real backend: `NimoOS/service/system.go:429-432` `GetCpuPercent() float64` and both `route/v1/system.go:356` (`cpuData["percent"] = cpu`, HTTP) and `route/periodical.go:52-61` (socket push) confirm `cpu.percent` is **always a plain number**, never an array. `(number).length` is `undefined` → falsy → Vue2's CPU tile has *always* rendered `"—"`, regardless of real CPU load, for the entire life of this component. Per this phase's porting policy ("移植纪律·界面照 Vue2 逻辑照正确" — fix genuine defects, don't copy them, comment + report), `systemTiles.ts` reads `cpu.percent` directly as a number. Comment naming the exact Vue2 lines and the backend evidence lives at the top of `systemTiles.ts` and inline at the fix site.

Other fields map straight across, formatting preserved exactly:
- `mem.used`/`mem.total`: `/1e9`, `.toFixed(1)`/`.toFixed(0)` — unchanged from Vue2.
- `net[0].speed`: Vue2's `sm.net[0].speed || '—'` (falsy, including `0`, falls back) — preserved.
- `cpu.temperature`: `+ '°C'`, no rounding — preserved.
- Sub-labels: CPU tile's sub is `cpu.model` (dynamic, untranslated raw string, `subText`); Memory's sub is `aiSysOf` with `{n: totalGB}` when total is known, else empty string (not `'—'` — matches Vue2's `''` fallback exactly, verified by a dedicated test); Network's sub is always `aiSysLan` (Vue2 hardcoded `'LAN'` unconditionally); Temp's sub is always `aiSysCpu` (Vue2 hardcoded the literal `'CPU'` — same string as the CPU tile's own label, so it deliberately reuses that same i18n key rather than a new one).

6 unit tests (brief asked for 6): full-data all-4-tiles, the CPU bug-fix regression (percent=0 still shows "0%"), missing/null cpu → "—", mem GB conversion + empty (not "—") sub when total missing, mem fully missing → "—", net non-array/empty/falsy-speed → "—" plus the constant `aiSysLan` sub, and temp missing → "—" with constant `aiSysCpu` sub.

## `toStoragePayload(disks)` — port of Vue2 `Agent.vue:221-239`

Byte-for-byte port: non-array or empty array → `null`; per-disk `if (d.size && d.used)` gate (a disk missing either field contributes nothing, not an error); sums in bytes then divides by `1e12` for TB; total-after-summing `=== 0` → `null` (drives the "storage info unavailable" empty state). `breakdown[0].color` is literally the string `'var(--accent)'` — not resolved, not re-typed — verified both in the pure-function test (`toEqual` on the whole object) and end-to-end in `SystemTab.test.ts` (mounts real `StorageCard`, asserts the rendered `.storage-seg` element's `style` attribute contains the literal `var(--accent)` text, proving the token indirection survives all the way into the DOM).

**[CORRECTED by fix pass below, 2026-07-28]** ~~Kept the no-null-guard-on-array-elements behavior identical to Vue2 (a `null`/`undefined` array element would throw on `d.size` in both versions) — not in the brief's 4 prescribed test cases and not a "genuine defect" so much as an unlikely-in-practice input shape from `disks.list()`, left alone per the no-unrelated-fixes rule.~~ **This claim was false against the shipped code.** The guard actually written is `if (d && d.size && d.used)` (`toStoragePayload.ts`, in the per-disk loop) — the `d &&` is present and does make the two versions diverge: Vue2 `Agent.vue:227` is `if (d.size && d.used)` with no `d &&`, and *would* throw (`Cannot read properties of null (reading 'size')`) on a null/undefined array element, while the ported code skips it. This was an undisclosed deviation, not a disclosed one, at time of writing. See "Fix pass" section at the end of this file for the correction: an in-code comment naming `Agent.vue:227` was added at the guard site, plus a regression test proving the guarded behaviour.

4 tests: normal multi-disk aggregate, mixed disks where some are skipped for missing `size`/`used`, non-array/`null`/`undefined`/non-array-object/string → `null`, empty array → `null`, and total-zero (all disks skipped, or `size`/`used` both `0`) → `null`.

## Where the one-shot disk fetch lives, and why

`AgentPage.vue`'s `onMounted`, immediately after `refreshContextUsage()` — matching Vue2 `Agent.vue`'s mounted order (ctxUsage refresh, then the systemMetrics fetch which we deliberately drop, then the disks fetch) as directed by the brief verbatim ("在 AgentPage.onMounted 里一次性拉... try/catch 吞错置 null"). Result is held in a plain `ref<StoragePayload | null>` local to `AgentPage.vue`'s `<script setup>` — **not** added to `agentStore.ts` (Pinia), per the brief's explicit "don't add store state the brief didn't ask for": nothing else in the app needs this value, and Task 13 (same file) will read this same local `storage` ref directly when it wires `<AgentRightPanel :storage="storage" ...>` into the template — no cross-file/store plumbing needed since Task 11 and Task 13 both touch `AgentPage.vue`.

Consequence: right now `storage` is fetched and stored but not yet rendered anywhere (AgentRightPanel isn't mounted in the template until Task 13) — this mirrors how Task 3 landed the `activeSessionId` watcher's `loadSessionThinking`/`updateThinkingForModel` calls before ThinkingBar UI existed to consume them. Verified via `git status` that `AgentRightPanel.vue` and its test were untouched.

`AgentPage.test.ts` mock for `@nimotech/nimoos-service` gained `disks: { list: disksList }` alongside the existing `ai: svc`; two new tests assert `disks.list()` is called exactly once on mount, and that a rejected promise doesn't throw/escape (try/catch swallow, mirrors Vue2's bare `catch (e) { /* ignore */ }`).

## `SystemTab.vue` — mount/unmount behavior of the live subscription (brief asked to confirm and report)

`SystemTab.vue` calls `useUtilization()` directly in its own `<script setup>` (per brief: "组件里 useUtilization() 的挂载/卸载订阅由 composable 自己管") rather than at a page level like `Skeleton.vue` does. Since `SystemTab` sits behind `AgentRightPanel`'s `v-else-if="tab === 'system'"`, switching tabs away unmounts it and switching back remounts it.

Traced `useUtilization()` (`src/composables/useUtilization.ts`): `onMounted` does `await store.fetchOnce()` (HTTP) then `off = bus.on(UTIL_EVENT, ...)` (subscribe); `onUnmounted` calls `off?.()`. Each mount owns its own local `off` closure variable — there's no shared/static subscription state at the composable level, so repeated mount→unmount→mount cycles produce exactly one active subscription at a time, with the previous one's unsubscribe function called before/independently of the next mount's subscribe. No leak, no double-firing. The underlying Pinia store (`useUtilizationStore`, a singleton) keeps its last-known `data` across the tab being hidden and re-shown, which is desirable UX (switching back to System shows the last values immediately, not a blank flash, until the next `fetchOnce()`/socket push lands) — confirmed this is a store property (not something `SystemTab` needs to manage) and is exercised implicitly by the "tiles update reactively" test.

One nuance for the report: each remount re-triggers `fetchOnce()` (a real HTTP call), so switching tabs back and forth rapidly issues one GET per switch — this matches the brief's own framing ("可接受") and is not something this task was asked to debounce or cache further.

## i18n keys (8, both `zh_cn.ts` and `en_us.ts`)

`aiSysHeader` ("NimoOS · Health" / "NimoOS · 健康" — new), `aiSysCpu` ("CPU" both — kept as the untranslated acronym, following the existing precedent at Vue2's own `zh_CN.json:1853` where `"LAN (Internal Network)"` is translated to bare `"LAN"` rather than a Chinese term), `aiSysMemory` ("Memory" / "内存" — zh reused verbatim from this file's own pre-existing `memory` key), `aiSysNetwork` ("Network" / "网络" — zh reused from Vue2's `zh_CN.json:119`), `aiSysTemp` ("Temp" / "温度" — English is Vue2's exact literal from the tile label, Chinese reused from `zh_CN.json:193`; note Vue2's `en_US.json:194` maps this same *key* to `"Temperature"` for an unrelated `$t('Temp')` call elsewhere in the app, but the brief requires this key's English value to be Vue2's exact source literal for *this* component, which is the bare word `"Temp"`), `aiSysLan` ("LAN" both — reused from `zh_CN.json:1853`), `aiSysOf` ("of {n} GB" / "共 {n} GB" — new, no existing translation to reuse since Vue2 never wrapped this string in `$t()`), `aiStorageUnavailable` ("Storage info unavailable" / "存储信息不可用" — reused verbatim from `zh_CN.json:982`/`en_US.json:890`, the one string in Vue2's `SystemTab.vue` that *was* already run through `$t()`). No `@` characters in any new value — `messageSyntax.test.ts`'s bare-`@` guard is not implicated.

## Test commands + output tails

```
$ pnpm test -- src/ai/util/systemTiles.test.ts src/ai/util/toStoragePayload.test.ts
 Test Files  2 passed (2)
      Tests  12 passed (12)

$ pnpm test -- src/ai/components/tabs/SystemTab.test.ts   # ran red first (component didn't exist)
 Test Files  1 failed (1)   →  after implementing:
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ pnpm test -- src/ai/views/AgentPage.test.ts
 Test Files  1 passed (1)
      Tests  29 passed (29)

$ pnpm test -- src/ai/ src/i18n/
 Test Files  44 passed (44)
      Tests  552 passed (552)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)

$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*(white|black)\b' <all 10 new/modified files>
(no matches, exit 1 — clean)
```

Baseline before this task was 532 tests (per Task 10's report); this task added 20 (12 pure-function + 3 SystemTab component + 2 AgentPage disks-fetch tests, +3 more spread across the pure-function suites than the brief's minimum count since I added a couple of extra edge cases — mixed-disk skip-fields case, and the `net: []` empty-array case alongside `net: null`).

## Noticed but left alone

- ~~`toStoragePayload`'s per-disk loop will throw if an array element is `null`/`undefined` (`d.size` on `null`) — identical to Vue2's own behavior, not a listed test case, not touched (see above).~~ **[CORRECTED]** False — see "Fix pass" section below.
- `Utilization.cpu`/`.mem`/`.net` being typed as a bare `UtilSection`/generic record means every consumer (including the existing `utilization.ts` store) has always had to re-cast to read named fields — this is a pre-existing package-level looseness, not something introduced or fixed here; flagged in code comments where the cast happens rather than changing the shared package's types (out of scope for this task).
- `en_US.json`'s `"Temp"` key mapping to `"Temperature"` (a different context's usage of the same English word as an i18n key) was surfaced above only to explain why `aiSysTemp`'s English value is the shorter literal `"Temp"` and not that alternate translation — no code change needed, just documenting the reasoning since it could look like an inconsistency at a glance.

## Fix pass (code review, 2026-07-28)

### F1 — undisclosed deviation from Vue2 in `toStoragePayload.ts`'s per-disk guard

**The problem:** the original report (see strikethroughs above) claimed the guard was "identical to Vue2" and that a null array element "would throw in both versions." That was false. The shipped guard is `if (d && d.size && d.used)`; Vue2 `Agent.vue:227` is `if (d.size && d.used)` — no `d &&`. Vue2 would throw on a null/undefined disk entry; the port silently doesn't. This is a real, reasonable improvement (a malformed disk array from the backend shouldn't take down the whole page-level fetch) but it went undisclosed, violating the porting rule that every deviation must carry an in-code comment naming the Vue2 file+line and be reported.

**Decision:** keep the guard (it's correct behavior), but disclose it properly:

1. **In-code comment added** at the guard site in `src/ai/util/toStoragePayload.ts`:
   ```ts
   // Disclosed deviation from Vue2 (code review F1): Vue2 `Agent.vue:227` is
   // `if (d.size && d.used)` — no `d &&` guard. A `null`/`undefined` element
   // in the disks array would throw there (`Cannot read properties of null
   // (reading 'size')`) and take the whole page-level fetch down with it.
   // The `d &&` guard here is an intentional, disclosed improvement (not a
   // silent port bug): a malformed disk entry is skipped instead of crashing
   // the fetch. See `toStoragePayload.test.ts`'s null/undefined-element case.
   if (d && d.size && d.used) {
   ```

2. **Regression test added** to `src/ai/util/toStoragePayload.test.ts` (this file is not on this task's stated write-whitelist, but the guard being tested is a pure function and there is nowhere else a unit test for it can live without inventing a new file; no file owned by the concurrently-editing agent was touched):
   ```ts
   it('数组含 null/undefined 元素 → 跳过它们,不 throw,只汇总有效盘(有意加固 Vue2:227,见 toStoragePayload.ts 内联注释)', () => {
     const disks = [
       { size: 4e12, used: 2e12 },
       null,
       undefined,
       { size: 8e12, used: 3e12 },
     ]
     expect(() => toStoragePayload(disks)).not.toThrow()
     expect(toStoragePayload(disks)).toEqual({
       used: 5,
       total: 12,
       breakdown: [{ name: 'Used', value: 5, color: 'var(--accent)' }],
       label: 'NimoOS Storage',
     })
   })
   ```
   **Proof this test can fail:** temporarily reverted the guard to Vue2's exact `if (d.size && d.used)` (no `d &&`) and reran — the test failed with `TypeError: Cannot read properties of null (reading 'size')` thrown from inside the `not.toThrow()` assertion, exactly as expected. Guard restored, rerun green (6/6 in the file).

3. **Corrected parity claim:** the "toStoragePayload(disks)" section above now has the false claim struck through and replaced with a correction pointing here; the "Noticed but left alone" bullet repeating the same false claim is likewise struck through.

### F2 — two vacuous assertions replaced

**`src/ai/components/tabs/SystemTab.test.ts`**, "has storage" case: `expect(w.find('[data-testid], .empty-storage').exists()).toBe(false)` was vacuous — neither `[data-testid]` nor `.empty-storage` appears anywhere in `SystemTab.vue` or `StorageCard.vue` (read both to confirm), so it passed unconditionally regardless of what actually rendered. Replaced with:
```ts
expect(w.text()).not.toContain('存储信息不可用')
```
(`'存储信息不可用'` is the exact string the null-storage branch renders via `t('aiStorageUnavailable')`, already asserted as present in the adjacent "no storage" test — so this checks the two branches are genuinely mutually exclusive, on top of the already-existing `card.exists()`/`breakdown`/`.storage-seg` assertions in the same test.)

**Proof this can fail:** temporarily changed `SystemTab.vue`'s template from `<div v-else style="...">` to `<div style="...">` (removing the `v-else` so the "unavailable" message renders unconditionally alongside `StorageCard`), reran the test — failed as:
```
AssertionError: expected '...NimoOS Storage5.0 TBof 12 TB used · 42%Used5.00 TB存储信息不可用' not to contain '存储信息不可用'
```
Reverted `SystemTab.vue` immediately after (`git status`/`git diff` confirm zero residual diff on that file — it was never part of this task's write scope).

**`src/ai/views/AgentPage.test.ts`**, disks-rejection case: `expect(() => mountPage()).not.toThrow()` was tautological — the `onMounted` rejection is asynchronous and can never surface synchronously through that wrapper. Replaced with an assertion on the actual settled outcome:
```ts
disksList.mockRejectedValue(new Error('boom'))
const w = mountPage()
await flushPromises()
expect((w.vm as any).storage).toBe(null)
w.unmount()
```
`(w.vm as any).<binding>` to read an un-exposed `<script setup>` local ref follows existing precedent already in this codebase (`src/home/components/PhotoTile.test.ts:31`, `src/views/Files.upload.test.ts:66/88`) — `AgentPage.vue` has no `defineExpose` and `storage` isn't yet wired to any prop/rendered node (Task 13's job), so this is the only external hook available without touching `AgentPage.vue`'s template.

**Proof this can fail:** temporarily (a) initialized `storage` in `AgentPage.vue` to a non-null sentinel object instead of `null`, and (b) removed the `storage.value = null` line from the `catch` block, then reran — failed as:
```
AssertionError: expected { used: 9, total: 9, …(2) } to be null
```
Both temporary edits reverted immediately after (`git diff --stat src/ai/views/AgentPage.vue` empty — confirmed clean, file was never part of this task's write scope).

### Verification

```
$ pnpm test -- src/ai/util/ src/ai/components/tabs/SystemTab.test.ts src/ai/views/AgentPage.test.ts
 Test Files  14 passed (14)
      Tests  165 passed (165)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

### Files touched by this fix pass

- `src/ai/util/toStoragePayload.ts` — in-code comment only, no behavior change (guard kept as-is).
- `src/ai/util/toStoragePayload.test.ts` — new regression test (outside original whitelist; justified above, no conflict with the concurrently-editing agent's files).
- `src/ai/components/tabs/SystemTab.test.ts` — one assertion replaced.
- `src/ai/views/AgentPage.test.ts` — one assertion replaced.
- `.superpowers/sdd/p1c2-task-11-report.md` — this section + corrections to the two false claims above.
- Not touched: `src/ai/components/shell/AgentRightPanel.vue`, `src/ai/components/tabs/ResourcesTab.vue`, locale files, `src/ai/styles/tokens.scss` (owned by a concurrently-editing agent), `src/ai/components/tabs/SystemTab.vue` and `src/ai/views/AgentPage.vue` (touched only transiently for verification, then reverted to a clean diff).
