# SP17 branch-final review — fix wave report

Branch `sp17-settings-catchup`, worktree `.claude/worktrees/sp17-settings-catchup`.
Starting point: `9a28798` (the commit the final review was run against).
Ending point: `85fe026` (5 commits added by this fix wave).

```
5b9d058 fix(home): evict the KVM tile immediately on a confirmed probe failure
b3bacd0 test(sp17): drop a stray plan comment, fix a stale test title, remove weakening casts, pin sweep selectivity
6fbbf9d docs(sp17): correct the outstanding doc's KVM timing claim, widen the probe-frequency description, disclose the untested migration path
9377b0c fix(oss): re-sync two appPaths/migrateBrowse anchors broken by the as-never removal
85fe026 test(home): cover evict(force) immediacy and the manual re-add path for the KVM tile
```

All six review findings are addressed. Section "Mistake I made and fixed" below covers commit
`9377b0c`, which corrects an oss anchor break I introduced while fixing Finding 4 and did not
catch until re-running the full suite on the committed tree.

---

## Finding 1 (Important) — dead KVM tile on a KVM-less machine

### What I changed and why

Two changes, in `5b9d058`:

1. **`src/home/stores/apps.ts`** — the store's `kvmAvailable` ref existed internally but was
   never included in the `return { ... }` object at the bottom of the `defineStore` setup
   function. Any external read of `someAppsStoreInstance.kvmAvailable` (including the read I
   was about to add in `Home.vue`) resolved to `undefined`, not the ref's actual value. This
   is a pre-existing bug from the original Task 4 work, invisible until something outside the
   store tried to read the flag — nothing had, until now. Fixed by adding `kvmAvailable` to the
   return object.

2. **`src/views/Home.vue`**, `refreshApps()` — added:
   ```ts
   if (apps.kvmAvailable === false) layout.evict('vm', { force: true })
   ```
   placed before the existing `layout.autoPin(...)` / `layout.sweepGone(...)` calls, inside the
   `apps.loadGrid().then(...)` callback. This runs on every trigger of `refreshApps()`: the
   initial `loadServerSeen().finally(...)` call, the 30s poll, `window.focus`, and the debounced
   docker-container-event refresh — because `probeKvm()` sits unconditionally inside
   `loadGrid()`, which every one of those triggers calls.

`force: true` is required, matching `evict()`'s existing contract (`src/home/stores/layout.ts`):
`'vm'` is a system tile that autoPin/`seen` never tracks (it's placed by `DEFAULT` layout or a
manual pin from the Add Apps panel, not by the container-app auto-pin machinery), so a
non-forced `evict('vm')` would silently no-op on the `!opts?.force && !seen.value.has(key)`
guard. `evict()` is otherwise idempotent when called with nothing to remove (`items.value.length`
unchanged and `hadSeen` false ⇒ no `save()`/`saveSeen()` call), so calling it on every poll tick
once KVM is confirmed down costs nothing extra.

This makes the "confirmed probe failure" case travel the same fast path as
`APP_UNINSTALL_END` (`layout.evict(k, { force: true })`, already wired in `Home.vue`) instead of
the ambiguous "missing from a possibly-flaky grid fetch" case that `sweepGone()`'s 45s grace
period exists for — matching the review's suggested fix, which I evaluated and agreed with: a
probe answering "unreachable" is a definite signal, not something that needs debouncing against
transient scan flakiness the way a disappearing container-app entry does.

### The two things the finding asked me to confirm

**1. Does an unprobed (`null`) `kvmAvailable` ever trigger removal? No.**

`kvmAvailable` is declared `ref<boolean | null>(null)` and the guard is a strict
`apps.kvmAvailable === false`, which is false for both `null` and `undefined`. Structurally,
the check only ever runs inside `refreshApps()`'s `apps.loadGrid().then(...)` callback, and
`loadGrid()` always sets `kvmAvailable.value = kvmOk` (a definite boolean) as the very first
statement after `Promise.all([...])` resolves, before `setApps()` runs and before the
`loadGrid()` promise itself resolves. So by the time the eviction check can possibly run,
`kvmAvailable` has already been pinned to `true` or `false` — it is never still `null` at that
point. This is also why the store's own `setApps([])` call at init (which renders the tile before
any probe has answered) is unaffected: that call happens synchronously at store creation, wholly
outside `refreshApps()`.

**2. Can the evicted tile be re-added from the Add Apps panel once KVM comes back? Yes,
unchanged mechanism, now verified by a test.**

- `AddPanel.vue`'s app tab renders `v-for="key in appsStore.order"` — once `probeKvm()` succeeds
  again, `setApps()`'s filter (`s.requiresService !== 'kvm' || kvmAvailable.value !== false`)
  puts `'vm'` back into `apps.order`, so it reappears as a candidate in the panel. This was
  already covered by the existing `apps.test.ts` case *"brings the tile back once KVM answers
  again"* (unaffected by this fix wave).
- Clicking that tile in the panel calls `layout.pin(...)` (`AddPanel.vue`'s
  `onSpawnDown` → the add-panel composable), which unconditionally appends to `items` — it does
  not consult `seen` at all, so there is nothing left over from the earlier forced eviction
  (which also cleared `seen.value.delete('vm')`) that could block the re-add.
- I added a new test making this concrete at the layout-store level, in `85fe026`
  (`src/home/stores/layout.test.ts`):
  ```ts
  it('evict(force) on a confirmed-unreachable KVM tile is immediate (no timer needed), '
   + 'and the tile can be pinned back manually afterward', () => {
    const s = useLayoutStore(); s.loadInitial()
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
    s.evict('vm', { force: true })
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
    s.pin({ kind: 'app', key: 'vm', c: 1, r: 1, w: 1, h: 1 })
    expect(s.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true)
  })
  ```

### The test that covers this finding, and RED evidence against the old code

New case in `src/views/Home.integration.test.ts` (commit `5b9d058`):

```ts
it('evicts the KVM tile immediately once the probe confirms KVM is unreachable, without waiting on any timer', async () => {
  const w = mountHome()
  const layout = useLayoutStore()
  expect(layout.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(true) // DEFAULT layout ships a vm tile
  await flushPromises(); await flushPromises(); await flushPromises()
  expect(layout.items.some((i) => i.kind === 'app' && i.key === 'vm')).toBe(false)
  w.unmount()
})
```

The mock's `service.kvm.getSettings` was changed to `vi.fn(async () => { throw new Error('ECONNREFUSED') })`
so the probe deterministically fails. No fake timers, no `advanceTimersByTime` — the point of the
test is that the tile disappears with zero timer advance, which is exactly what the old
`sweepGone`-only design could never do (its grace clock only *starts* on the first missing poll).

**RED evidence** (regenerated fresh for this report, against the actual pre-fix baseline commit
`9a28798`, not a hand-simulated revert): I swapped `src/home/stores/apps.ts` and
`src/views/Home.vue` back to their `9a28798` contents, kept the new test file from `HEAD`, and ran
it:

```
$ pnpm exec vitest run src/views/Home.integration.test.ts
 ❯ src/views/Home.integration.test.ts (4 tests | 1 failed) 367ms
     × evicts the KVM tile immediately once the probe confirms KVM is unreachable, without waiting on any timer 62ms

 FAIL  src/views/Home.integration.test.ts > Home integration > evicts the KVM tile immediately once the probe confirms KVM is unreachable, without waiting on any timer
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ src/views/Home.integration.test.ts:109:74

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

Then restored `apps.ts`/`Home.vue` to the fixed (`HEAD`) content and re-ran — GREEN:

```
$ pnpm exec vitest run src/views/Home.integration.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Along the way I also found (via a throwaway debug test, not committed) that the very first
version of this fix silently did nothing: `apps.kvmAvailable` read as `undefined` from outside
the store because of the missing-from-`return` bug described above. That is why the `apps.ts`
change is included in the same commit as the `Home.vue` change — the `Home.vue` change alone is
inert without it, and a reviewer diffing only `Home.vue` could easily miss that the fix depends
on it.

---

## Finding 2 (Minor) — stray plan-instruction comment

`src/home/stores/apps.test.ts:5` carried `// at the top of the file, next to the other imports`,
a leftover instruction from the implementation plan about *where* to place the following mock
declarations, not a comment about what the code does. Deleted (`b3bacd0`).

---

## Finding 3 (Minor) — stale test title

`src/settings/util/tabs.test.ts` — commit `7b68025` (adding the LAN devices tab, pre-existing on
this branch) updated the two tests immediately above this one to assert 8 rail items and
translated their titles to English, but missed the third test in the same group: it still read
`it('admin 看到全部 7 项', ...)`, asserting the old count via `toEqual(RAIL_TABS)` (which happens
to still pass regardless of the literal number in the string, since the assertion doesn't hard-code
a count — the title itself was just stale prose). Renamed to
`it('admin sees all 8 rail items', ...)`, matching the neighbours' style, in `b3bacd0`.

Because `oss/manifest.mjs` has a redaction anchor for this exact block (it deletes the
admin/non-admin/role-missing trio wholesale for the public export, since `folder-permissions` is
a private-side-only feature), I re-synced that anchor's `find` string to the new title in the
same commit.

---

## Finding 4 (Minor) — unnecessary `as never` casts

- `src/settings/util/appPaths.test.ts:88` — `buildAppPathRows(paths as never, [])` → `buildAppPathRows(paths, [])`.
  The `paths` literal (four `{ path: string, size: number }` entries) is directly assignable to
  `SystemPaths = Record<string, SystemPathEntry>` (`packages/service/src/types.ts:257-258`); no
  cast needed.
- `src/settings/util/migrateBrowse.test.ts` (the `it('drops dot-prefixed folders...')` case) —
  replaced the hand-rolled `{ name, path, is_dir: true, is_symlink: false }` literals with the
  `mk()` helper already defined eight lines above in the same `describe` block, and dropped the
  `as never` cast on the call site. `mk()`'s defaults (`is_dir: true, is_symlink: false`) match
  what the hand-rolled literals had, so behaviour is unchanged.

Both fixed in `b3bacd0`.

---

## Finding 5 (Minor) — sweep test proved less than it should

`src/home/stores/layout.test.ts`, the KVM-sweep test — added an assertion that `'files'` (present
in `live` throughout) survives the sweep at both checkpoints (right after the first absence, and
after the grace period elapses and `'vm'` is actually removed). Retitled the test to
*"...and only that tile"* to signal the strengthened claim. `'files'` was chosen deliberately
because it is already one of the four keys in the existing `live` array — no new literal needed,
so the oss leak guard's gating on `photo`/`ai`/`knowledge` bare words is not implicated. Fixed in
`b3bacd0`.

---

## Finding 6 (Minor) — outstanding doc now inaccurate in three ways

All three fixed in `6fbbf9d`, in `docs/superpowers/2026-08-09-sp17-outstanding.md` (excluded from
the oss export tree wholesale — `docs` is in the top-level `DELETE` list in `oss/manifest.mjs`, so
no anchor re-sync was needed here):

1. **Step 8 timing.** Rewrote it to say the tile should disappear within the first `loadGrid()`
   round-trip after reload (a network-latency delay, not a timer-driven one), and spelled out the
   new pass criterion accordingly, referencing the new `refreshApps()`/`evict(force)` mechanism and
   noting the 45s `sweepGone` grace period still exists but only governs the ambiguous
   "vanished from the grid list" case, not a confirmed probe failure.
2. **Probe-frequency understatement.** Added a note that the probe does not fire only on the 30s
   poll: `refreshApps()` is also bound to `window.focus` and debounced container events
   (`Home.vue`), and `probeKvm()` sits unconditionally inside every `loadGrid()` call regardless of
   which trigger caused it — so there is no single "every N seconds" cadence to cite.
3. **Untested migration path.** Added a new bullet under "已知遗留" disclosing that
   `service.sys.migrateAppPath('photos_data', ...)` is never actually invoked by the acceptance
   steps (step 6 stops at "see the destination path" and deliberately does not click "start
   migration") or by any unit test, and that `migrateAppPath(type: string, ...)` in
   `packages/service/src/sys.ts:55` has no compile-time constraint tying `type` to a known key —
   a typo there would compile silently. Noted that the backend contract itself (`NimoOS/service/migrate.go:29,371`)
   had already been read and confirmed correct in an earlier review round, so this is a disclosed
   coverage gap, not a suspected hazard, with a concrete suggested follow-up (narrow `type` to the
   `AppPathKey` union from `appPaths.ts`, add a test exercising `'photos_data'`).

---

## Mistake I made and fixed: a broken oss anchor from Finding 4 (commit `9377b0c`)

While reading `oss/manifest.mjs` before editing, I found and correctly re-synced the tabs.test.ts
anchor for Finding 3. I did **not** notice that two *other* anchors — both inside the block I had
already read in full while scoping the work — quoted the exact literal text I was about to remove
for Finding 4:

- one anchor's `find` string embedded `buildAppPathRows(paths as never, [])` verbatim, inside a
  larger multi-line block (`src/settings/util/appPaths.test.ts`);
- another anchor's `find`/`replace` strings embedded the three hand-rolled
  `{ name: '.system_data', ... }`-style object literals verbatim
  (`src/settings/util/migrateBrowse.test.ts`), which I replaced with `mk(...)` calls.

I committed Finding 4 without re-syncing either anchor, then ran the required verification
sequence. The mistake surfaced on the **second** verification pass — the first `pnpm test` run
(right after the first three commits) reported oss failures, but with a "工作树不干净" (dirty
tree) message layered in front of the real error, so I initially (incorrectly) wrote all four
oss test-file failures off as expected dirty-tree noise from having uncommitted changes at the
time. Rerunning cleanly after the coordinator asked me to redo verification in the foreground
surfaced the actual failure underneath: `export.mjs` itself reported

```
[oss] 失败:锚点未命中:src/settings/util/appPaths.test.ts
找的是:"  it('gives four empty-path, zero-size rows (not a throw) when backend data is null / missing keys', () => {\n    const r"
这是设计意图,不是故障 —— 看一眼私有侧那几行改成什么了,更新 manifest.mjs 的锚点。
```

which is exactly the tool's designed failure mode for exactly this class of mistake, and it
pointed at the right file. I re-synced both anchors' `find` (and where applicable `replace`)
strings to the new literal text and committed the fix separately (`9377b0c`) so the mistake and
its correction are each visible in history rather than folded into an amended earlier commit.

I'm flagging this prominently rather than quietly folding it in, because the task's own
instructions warned this exact class of mistake ("this has tripped four times on this branch")
and I still made it once — the warning made me re-sync the *anchor I was actively editing*
(Finding 3's) correctly, but did not make me re-check the *other* anchors in the same file that
happened to quote text I was touching for an unrelated finding (Finding 4) in a different part of
the same commit.

---

## Commands run, in order, with real output

All commands below were run in the foreground in this worktree; none were left in the background
for their result to be used.

### Investigation (read-only), before any edits
Read `apps.ts`, `layout.ts`, `Home.vue`, `useOpenAction.ts`, `useDock.ts`, `GridItem.vue`,
`AppTile.vue`, `containerEventBridge.ts`, `apps.test.ts`, `layout.test.ts`, `systemApps.ts`,
`AddPanel.vue`, `tabs.test.ts`, `appPaths.test.ts`, `migrateBrowse.test.ts`,
`2026-08-09-sp17-outstanding.md`, and the relevant slices of `oss/manifest.mjs` and
`oss/forbidden.mjs`. Not reproduced verbatim here; see the tool-call history for exact content.

### Debugging the initial (dead) Finding-1 fix

```
$ pnpm exec vitest run src/views/Home.integration.test.ts
# new test failed: "expected true to be false"
```
Added multiple `flushPromises()` calls — still failed. Wrote a throwaway debug test
(`src/views/debug-home.test.ts`, deleted before committing) logging `apps.kvmAvailable` across
several flush ticks:
```
tick 0 kvmAvailable= undefined order has vm= false items has vm= true
...
tick 5 kvmAvailable= undefined order has vm= false items has vm= true
```
`kvmAvailable` was `undefined`, not `false` — root cause: `apps.ts`'s `return { ... }` omitted
`kvmAvailable`. Fixed, reran:
```
$ pnpm exec vitest run src/views/Home.integration.test.ts src/home/stores/apps.test.ts src/home/stores/layout.test.ts
 Test Files  3 passed (3)
      Tests  50 passed (50)
```
Confirmed RED against old `Home.vue` via `git stash push -- src/views/Home.vue` then rerun, then
`git stash pop` (this was superseded by the cleaner regeneration below, done after all commits
landed).

### Per-finding spot checks while editing (all passed at time of edit)
```
$ pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts src/home/stores/apps.test.ts
 Test Files  3 passed (3)
      Tests  61 passed (61)

$ pnpm exec vitest run src/settings/util/tabs.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ pnpm exec vitest run src/home/stores/layout.test.ts
 Test Files  1 passed (1)
      Tests  24 passed (24)   # before the finding-1 follow-up test; 25 after Finding 5's edit, 25 again after the 85fe026 addition made it 25→ (see below)
```

### First full-suite pass, before the coordinator's foreground-only correction

A background/Monitor-based run was used initially; per the coordinator's explicit correction, all
results below this point were obtained strictly in the foreground and are the ones that count.

### Foreground verification after all 4 initial commits (`5b9d058`..`6fbbf9d`), before the anchor bug was caught

```
$ git status --short
(clean)

$ pnpm test 2>&1 | tail -250
...
 Test Files  4 failed | 671 passed (675)
      Tests  3 failed | 10871 passed | 70 skipped (10944)
```
Four failing files were `oss/media-wave.test.mjs`, `oss/tree.test.mjs`, `oss/cli-args.test.mjs`,
`oss/export-rsync.test.mjs`. `oss/cli-args.test.mjs` and `oss/export-rsync.test.mjs`'s errors
showed a "工作树不干净" line ahead of the real error (from `export.mjs`'s own dirty-tree message,
emitted even though the tree was clean — this turned out to be a red herring in the error
formatting, not an actual dirty-tree condition, since `git status --short` immediately above was
empty). `oss/media-wave.test.mjs` and `oss/tree.test.mjs` showed the real cause plainly:
```
[oss] 失败:锚点未命中:src/settings/util/appPaths.test.ts
找的是:"  it('gives four empty-path, zero-size rows (not a throw) when backend data is null / missing keys', () => {\n    const r"
这是设计意图,不是故障 —— 看一眼私有侧那几行改成什么了,更新 manifest.mjs 的锚点。
```
This is the real regression described above. Fixed in `9377b0c`.

### Foreground verification after the anchor fix (`9377b0c`) — clean

```
$ pnpm exec vitest run oss/
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

```
$ pnpm test 2>&1 | tail -250
 Test Files  675 passed (675)
      Tests  10944 passed (10944)
```
(675/10944 = baseline 675/10943 + the 1 new Home.integration.test.ts case at that point.)

```
$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

```
$ git status --short
(clean)
$ pnpm exec vitest run oss/
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

### After adding the Finding-1 confirmation test (`85fe026`)

```
$ pnpm exec vitest run src/home/stores/layout.test.ts
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ pnpm exec vue-tsc --noEmit
(no output, exit 0)

$ git status --short
(clean, after commit)

$ pnpm test 2>&1 | tail -50
 Test Files  675 passed (675)
      Tests  10945 passed (10945)

$ pnpm exec vue-tsc --noEmit
(no output, exit 0)

$ git status --short
(clean)
$ pnpm exec vitest run oss/
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

**Final numbers**: `pnpm test` → **675 files / 10945 tests, 0 failed** (baseline 675/10943 + 2 new
tests: the Finding-1 Home.integration.test.ts case and the Finding-1 confirmation case in
layout.test.ts). `vue-tsc --noEmit` → **0 errors**. `vitest run oss/` → **7 files / 146 tests, 0
failed**, run on the clean committed tree.

### RED-evidence regeneration for this report (after all 5 commits)

```
$ git show 9a28798:src/home/stores/apps.ts > /tmp/apps.ts.old
$ git show 9a28798:src/views/Home.vue > /tmp/Home.vue.old
$ cp src/home/stores/apps.ts /tmp/apps.ts.new && cp src/views/Home.vue /tmp/Home.vue.new
$ cp /tmp/apps.ts.old src/home/stores/apps.ts && cp /tmp/Home.vue.old src/views/Home.vue
$ pnpm exec vitest run src/views/Home.integration.test.ts
 ❯ ... evicts the KVM tile immediately ... 62ms
 FAIL  ... AssertionError: expected true to be false
 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

$ cp /tmp/apps.ts.new src/home/stores/apps.ts && cp /tmp/Home.vue.new src/views/Home.vue
$ git status --short
(clean)
$ pnpm exec vitest run src/views/Home.integration.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

---

## Things I disagreed with

None. I evaluated the review's suggested mechanism for Finding 1 (treat a confirmed probe
failure like `APP_UNINSTALL_END`, evict immediately with `force: true`, rather than route it
through `sweepGone`'s grace period) and agreed with it as described — it matches the existing
`force` eviction pattern already in the codebase for exactly this class of "definite absence"
signal, and does not require inventing a new mechanism.

I did make one correction to my own prior work mid-task (the `kvmAvailable` return-object bug and
the anchor-sync mistake, both described above), but neither is a disagreement with the review —
both are bugs the review's instructions correctly anticipated the *shape* of (respectively:
"read `evict()`'s `force` semantics before using it" and "this has tripped four times on this
branch") and that I still had to actually catch by running the verification commands rather than
by reasoning alone.

## Concerns / residual risk

- **`layout.test.ts`'s new Finding-1 confirmation test duplicates coverage that already existed
  separately** (`evict force` immediacy was already covered by the pre-existing "evict force 立即清
  手动固定磁贴" test; "tile reappears once KVM answers" was already covered by
  `apps.test.ts`'s "brings the tile back once KVM answers again"). I added it anyway because the
  coordinator asked for the re-add path to be spelled out concretely for the KVM tile
  specifically, in one place, rather than left as an inference across two other tests' existing
  coverage of the general mechanism.
- **A second `pnpm test`/other-session process was observed running concurrently in this same
  worktree directory** (a different shell snapshot, PID tree rooted outside anything I started)
  during part of this task. I do not believe it affected the final results — the true anchor bug
  reproduced deterministically on demand regardless of that process's presence, and the final
  three verification commands were all run with `git status --short` confirmed clean and no
  competing `pnpm test`/`vitest` process visible in `ps -ef` immediately beforehand — but I am
  noting it because a shared worktree being driven by two sessions at once is a hazard in its own
  right, independent of this task's correctness.
- **`AppsPanel`/`AppPathDialog`'s real migration call for `type: 'photos_data'` remains untested**,
  as disclosed in the Finding 6 doc fix. I did not add a test for it because it was out of scope
  for this fix wave (Finding 6 asked only to *disclose* the gap, not close it), but it is a
  legitimate next-period item.
- **The known pre-existing flake `src/files/upload/persist.test.ts:55`** (mentioned in the
  outstanding doc's original Task 6 gate results) did not reproduce in any of this session's full
  runs; nothing to report there.
- **An unrelated jsdom limitation** (`Error: Not implemented: navigation`, `favorites.test.ts`
  writing to `/tmp/nimoos-www-<random>`) prints noisy stderr during full-suite runs but does not
  fail any test — pre-existing, unrelated to this fix wave, confirmed by the final `pnpm test`
  summary line reporting 0 failures each time it appeared.
