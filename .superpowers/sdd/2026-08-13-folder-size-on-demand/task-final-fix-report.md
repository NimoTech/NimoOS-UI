# Final fix-wave report: post-review findings on on-demand folder size

## Status: DONE

Commits:
- `523849b0` — "fix(files): abort in-flight folder-size walks and cap concurrency at 3" (Finding 1)
- `4c5757bd` — "fix(files): keep the loading folder-size cell as a disabled button" (Finding 2)

## Finding 1 (Important) — in-flight 5-minute requests cannot be aborted / connection-pool starvation

### packages/service/src/folder.ts
- `getFolderSize(path: string, opts?: { signal?: AbortSignal })` — the signal is
  forwarded straight into the axios request config (`signal: opts?.signal`)
  alongside the existing `params`/`timeout: 300000`.

### packages/service/src/folder.test.ts
- Added a test asserting the `AbortSignal` passed by the caller is the exact
  object axios's `get` config receives (`cfg?.signal === controller.signal`).

### src/files/stores/folderSizes.ts
- Added `MAX_CONCURRENT = 3` with a comment explaining the browser's
  6-connections-per-origin HTTP/1.1 cap and why a 5-minute walk needs a cap
  to avoid starving the rest of the page (thumbnails, listings, uploads) on
  plain-HTTP NimoOS devices.
- Added three closure-scoped (non-reactive — never rendered) pieces of
  internal state: `controller: AbortController | null`, `activeCount:
  number`, `queue: Array<() => void>`.
- Split `compute()` into the public entry point (dedup check, sets `loading`
  immediately, then either queues or calls straight through) and a private
  `runCompute(path, myEpoch)` that does the actual `activeCount++`, lazily
  creates the epoch's `AbortController`, awaits
  `service.folder.getFolderSize(path, { signal })`, and in its `finally`
  decrements `activeCount` and drains one queued thunk (FIFO via
  `queue.shift()`).
- `compute()` parks behind a `new Promise(resolve => queue.push(resolve))`
  when `activeCount >= MAX_CONCURRENT`; the path already shows `'loading'`
  before that park, so queued and in-flight look identical to the UI.
- `reset()` now also does `controller?.abort(); controller = null; queue =
  []` — every walk from the epoch being replaced gets its signal aborted,
  and anything still parked in the queue is stranded (the pushed `resolve`
  is discarded with the old array, so it is never called and that
  particular `compute()` call's promise is deliberately left permanently
  pending — nothing in the codebase awaits it, so this is inert, not a
  leak that matters).
- The existing epoch check inside `runCompute`'s `try`/`catch` was left
  untouched — it already covers "no state left behind" for both a stale
  success and a stale rejection (including one caused by abort).

### src/files/stores/folderSizes.test.ts — 3 new tests
1. `reset() aborts the in-flight request` — captures the `AbortSignal`
   passed to the mocked `getFolderSize`, asserts `.aborted` flips to `true`
   right after `reset()`, then rejects the deferred with a simulated
   `AbortError` and asserts the epoch guard drops it back to `'idle'`
   (no error state resurrected for a path the current view no longer owns).
2. `caps concurrency at 3 in-flight requests: a 4th compute() is queued and
   issued once one settles` — fires 4 concurrent `compute()` calls, asserts
   only 3 hit the service mock and the 4th path reads `'loading'`, resolves
   the first, awaits a microtask tick, and asserts the 4th's request is now
   issued and eventually resolves to `'done'`.
3. `reset() clears the queue: a queued compute() never issues its request`
   — same 4-concurrent setup, but `reset()` fires before any of the first 3
   settle; asserts that once all 3 do settle, the service mock was still
   only called 3 times (the 4th's queued thunk was discarded) and the 4th
   path reads `'idle'` (state also cleared by `reset()`).

## Finding 2 (Minor) — keyboard focus loss on the loading state

### src/files/components/FileRow.vue
- Removed the `sizeStatus === 'loading'` plain-text `<template>` branch.
  The `<button class="size-compute">` is now rendered for `idle` /
  `loading` / `error` alike, with `:disabled="sizeStatus === 'loading'"`.
- Added a `sizeCellLabel` computed (`useI18n()`'s `t`, matching the
  existing pattern in `FilesSidebar.vue`/`NewItemDialog.vue` etc. in this
  area) so the button's text works out for all three states without a
  nested ternary in the template.
- CSS: `.size-compute:disabled { cursor: default; }` and
  `.size-compute:disabled:hover { color: var(--fg-muted); }` so the hover
  accent color doesn't kick in on a disabled button — no color literals,
  only the existing `--fg-muted` token (matches the repo-wide
  `opacity`/`cursor: default` convention on `:disabled` buttons seen in
  `NetworkStorageDialog.vue`, `PdfViewer.vue`, etc.; opacity was left
  unchanged here since the muted resting color is already low-contrast).
- Idle/error button behavior (label, `@click.stop="folderSizes.compute(...)"`)
  is unchanged.

### src/files/components/FileRow.test.ts
- Replaced the Task-4 "directory loading: size cell shows computing label,
  no button" test with "directory loading: size cell shows a disabled
  button with the computing label; clicking it does not compute" — mounts
  with `states['/DATA/Docs'] = { status: 'loading' }`, gets
  `.file-size button.size-compute`, asserts its text and
  `(element as HTMLButtonElement).disabled === true`, then `trigger('click')`
  and asserts the `compute` spy was never called (a `disabled` button does
  not dispatch its click handler in jsdom, matching real-browser behavior —
  confirmed empirically by this test passing without any extra guard code
  in the click handler).

## Test commands + output

1. `pnpm install` (mandatory after touching `packages/service/` — hardlink
   trap) → ran clean, 1 package linked.
2. `pnpm exec vitest run packages/service/src/folder.test.ts` → 7/7 passed.
3. `pnpm exec vitest run src/files/stores/folderSizes.test.ts
   src/files/components/FileRow.test.ts` → 2 files, 21/21 passed.
4. `pnpm exec tsc --noEmit -p packages/service/tsconfig.json` → clean, no
   output.
5. `pnpm exec vue-tsc --noEmit` → clean, no output, exit 0.
6. Full-repo `pnpm exec vitest run --reporter=verbose` (before committing,
   working tree still dirty): **718 passed, 4 failed test files / 3 failed
   tests** — all 4 failures were in `oss/cli-args.test.mjs` and
   `oss/export-rsync.test.mjs`, which are self-guarding export scripts that
   refuse to run against a dirty git working tree by design (see repo
   memory `oss-web-ui-export-project`); they printed exactly
   `工作树不干净,导出中止` listing this change's own modified files. Not a
   regression.
7. After `git add -A` + committing both logical commits (tree clean again):
   `pnpm exec vitest run oss/cli-args.test.mjs oss/export-rsync.test.mjs
   --reporter=verbose` → 2 files, 6/6 passed, confirming (6) was purely the
   dirty-tree guard and not caused by this change.
8. Re-ran the three covering test files + `vue-tsc --noEmit` one more time
   post-commit → 28/28 tests passed, vue-tsc clean.

Net result: full suite is green modulo pre-existing OSS export/CLI
self-guards that are inherently sensitive to git tree state during active
development, not to this diff's logic.

## Self-review

- Diff limited to the six files named in the brief
  (`packages/service/src/folder.ts`, `packages/service/src/folder.test.ts`,
  `src/files/stores/folderSizes.ts`, `src/files/stores/folderSizes.test.ts`,
  `src/files/components/FileRow.vue`, `src/files/components/FileRow.test.ts`)
  — no stray changes.
- All new code comments and test names are in English.
- No new color literals — `.size-compute:disabled` styling uses only the
  existing `--fg-muted` token.
- `controller`/`activeCount`/`queue` are plain closure variables, not Pinia
  `ref`s, since they're never read by the template — matches the "keep the
  mechanism simple" instruction without adding unnecessary reactivity
  overhead.
- Verified (via test 3 above) that reset()'s queue-clearing leaves a
  permanently-pending promise for any call parked behind the cap at reset
  time; nothing in this codebase awaits `folderSizes.compute()`'s return
  value (FileRow.vue calls it fire-and-forget via `@click.stop`), so this
  is inert rather than a real leak.
- Both commits signed off (`git commit -s`), English subject/body, one
  commit per finding.
