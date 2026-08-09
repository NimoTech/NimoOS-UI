# Task 10 report — 票 A: unloadGuard 搬到应用级

## What was implemented

Moved `installUnloadGuard`'s install/uninstall from `src/views/Files.vue`'s
`onMounted`/`onUnmounted` to `src/App.vue`'s `onMounted`/`onUnmounted`, so the
guard is active for the app's whole lifetime instead of only while `/files`
is mounted.

- `src/App.vue`: added imports (`onMounted`, `onUnmounted` from `'vue'`,
  `service` from `'@nimotech/nimoos-service'`, `installUnloadGuard`,
  `useUploadsStore`); added `const uploads = useUploadsStore()` and the
  mount/unmount pair calling
  `installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))`.
- `src/views/Files.vue`: removed the `installUnloadGuard` import and the
  `offUnloadGuard`/`onMounted`/`onUnmounted` block that used to install it.
  Left the `service` import in place — `service.folder.getList(p)` is still
  called at (current) line 353, unrelated to the guard.
- New test `src/App.unloadGuard.test.ts`.
- New test `src/views/__tests__/Files.noUnloadGuard.test.ts`.

## `installUnloadGuard`'s real signature and how it was called

```ts
export function installUnloadGuard(
  getQueue: () => UploadItem[],
  win?: Window,
  interruptBatch?: (id: string) => void,
): () => void
```

(`src/files/upload/unloadGuard.ts:48-52`.) Second positional arg is an
**optional test-injectable `Window`** (defaults to global `window`), third is
the pagehide interrupt callback. The brief's snippet
(`installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))`)
turned out to already match this signature correctly — `undefined` for `win`
falls through to the real global `window`, and the interrupt callback lands
in the right (3rd) slot. This is exactly what Files.vue's original call site
already did too, so no signature correction was needed; I ported the call
verbatim into `App.vue`.

## TDD evidence

### App-level test — RED (before any implementation change)

Command: `pnpm exec vitest run src/App.unloadGuard.test.ts`

```
 FAIL  src/App.unloadGuard.test.ts > App-level unload guard > signals every active batch on pagehide even when Files is not mounted
AssertionError: expected "vi.fn()" to be called with arguments: [ 'b1' ]
Number of calls: 0
 ❯ src/App.unloadGuard.test.ts:73:28
     73|     expect(interruptBatch).toHaveBeenCalledWith('b1')

 FAIL  src/App.unloadGuard.test.ts > App-level unload guard > warns before leaving while an upload is in flight
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
 ❯ src/App.unloadGuard.test.ts:86:32
     86|     expect(e.defaultPrevented).toBe(true)

 Test Files  1 failed (1)
      Tests  2 failed (2)
```

Expected because `App.vue` did not yet install any guard — `interruptBatch`
was never called and `beforeunload` was never intercepted.

### App-level test — GREEN (after implementation)

Command: `pnpm exec vitest run src/App.unloadGuard.test.ts src/files/upload/unloadGuard.test.ts src/views/`

```
 Test Files  33 passed (33)
      Tests  620 passed (620)
   Duration  23.09s
```

(The stderr noise about `Error: Not implemented: navigation (except hash
changes)` in the run is pre-existing jsdom output from an unrelated Photos
favorites-export test — not a failure; the summary line confirms 33/33 files
and 620/620 tests passed.)

## Files.vue guard test — separate RED/GREEN proof

I wrote and ran `src/views/__tests__/Files.noUnloadGuard.test.ts` (reads
`Files.vue`'s source with `node:fs` and asserts it no longer contains the
string `installUnloadGuard`) **before** touching `Files.vue` at all — at that
point Files.vue still had the original `import { installUnloadGuard } ...`
line and the install/uninstall block, so this is the equivalent of
"restoring" it.

RED (Files.vue still had the import/call — ran together with the App test
before any implementation edits):

```
 ❯ src/views/__tests__/Files.noUnloadGuard.test.ts:23:21
     21|   it('no longer imports installUnloadGuard -- that lives at app level …
     22|     const src = fs.readFileSync(FILES_VUE, 'utf8')
     23|     expect(src).not.toMatch(/installUnloadGuard/)
       |                     ^
 Test Files  2 failed (2)
      Tests  3 failed (3)
```

GREEN (after removing the import/call from Files.vue):

Command: `pnpm exec vitest run src/views/__tests__/Files.noUnloadGuard.test.ts`

```
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## Type check

`pnpm exec vue-tsc --noEmit` — no output, clean pass.

## `grep -rn installUnloadGuard src/` (after change)

```
src/App.vue:15:import { installUnloadGuard } from './files/upload/unloadGuard'
src/App.vue:69:  offUnloadGuard = installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))
src/App.unloadGuard.test.ts:10: (comment, mentions the old Files.vue install site)
src/views/__tests__/Files.noUnloadGuard.test.ts:1,21,23: (comment + guard assertion)
src/files/upload/unloadGuard.ts:48: export function installUnloadGuard(...)
src/files/upload/unloadGuard.test.ts: several call sites (existing unit tests of the helper itself)
```

Only `App.vue` calls it as an app-level install; nothing in `Files.vue`
imports or calls it anymore.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/App.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/views/Files.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/App.unloadGuard.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b/src/views/__tests__/Files.noUnloadGuard.test.ts` (new)

Commit: `ba24ee3` — "fix(files): install the upload unload guard at app level"
(exact message from the brief's Step 5).

## Self-review

- **Exactly one installation site**: confirmed via the grep above — only
  `App.vue` imports/calls `installUnloadGuard`.
- **App-level test proves Files is NOT mounted**: `makeRouter()` in
  `App.unloadGuard.test.ts` registers only `{ path: '/', component: { template: '<div />' } }`
  — a plain placeholder, not `Files.vue`. `Files.vue` is never imported or
  mounted in that test file at all, so the passing assertions genuinely prove
  the guard fires from the app shell independent of the Files view.
- **Teardown symmetry**: `App.vue`'s `onUnmounted(() => { offUnloadGuard?.() })`
  mirrors the removed Files.vue pattern exactly (same null-check-then-call
  shape), and `installUnloadGuard`'s own returned cleanup removes both
  `beforeunload` and `pagehide` listeners — verified already by the untouched
  `src/files/upload/unloadGuard.test.ts` suite (still passing, 620/620 total).
- **`service` import in Files.vue**: left in place; `service.folder.getList(p)`
  at (current) line 353 is unrelated and still needed — no unused import.
- **Output pristine**: no console errors/warnings introduced by the new
  tests themselves (the one stderr block in the batch run is pre-existing and
  unrelated to this change — a Photos favorites test that calls
  `window.location.href =` under jsdom, present before this task and outside
  its scope).

## Concerns

None. Both tickets' acceptance criteria (single install site, app-level
firing proven without Files mounted, symmetric teardown, RED→GREEN evidence
for both the feature test and the anti-regression guard test) are met.
