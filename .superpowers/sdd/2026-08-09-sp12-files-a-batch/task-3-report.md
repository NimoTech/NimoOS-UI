# Task 3 report: carry `is_dir` on clipboard items

## Files changed

- `src/files/stores/clipboard.ts` — `OperateItem` gains `is_dir: boolean`; `operate()` now
  takes `{ path: string; is_dir: boolean }[]` instead of `string[]`, and maps `path -> from`
  while forwarding `is_dir` (coerced with `!!`). Added an English comment explaining why
  `is_dir` rides along (copied from the brief, translated where the brief already gave
  English prose).
- `src/files/util/fileOps.ts:33` — `buildPastePayload`'s `style` union gains `'rename'`.
- `src/files/composables/useFileOps.ts` — `copy()` now passes `entries` straight through;
  `cut()`'s clipboard call reverted to `clipboard.operate('move', targets)` (removed the
  Task-2-era comment noting the temporary path-string calling convention, since it's no
  longer true). No other line in `cut`/`copy` touched.
- `src/files/stores/clipboard.test.ts` — added the two brief-specified tests verbatim
  (`records is_dir alongside the path...`, `isCut still matches on the real path only`);
  updated the three pre-existing tests that called `operate(...)` with plain path-string
  arrays (blast radius from the signature change), converting them to
  `{ path, is_dir }` entries and expecting `is_dir` in the resulting `item`.
- `src/files/util/fileOps.test.ts` — added the brief's `buildPastePayload accepts the
  keep-both style the backend calls "rename"` test; updated the pre-existing
  `buildPastePayload` test's fixture/expectation to include `is_dir: false` (required by
  the now-stricter `OperateItem` type).

## Type-impact blast radius (not listed in the brief, but broke under the new
`operate()` signature / `OperateItem` type and had to be fixed to keep `vue-tsc` and the
existing suite green)

- `src/files/composables/useFileOps.test.ts` — three direct `clip.operate('copy', ['/DATA/a'])`
  calls (paste test, snapshot-block test) and one `expect(...).toEqual({ item: [{ from: '/DATA/a' }] })`
  assertion, all converted to the entry-object form with `is_dir: false`.
- `src/files/components/FileRow.test.ts` — two `operate('move'|'copy', ['/DATA/a.txt'])` calls
  in the cut/copy row-class tests, converted the same way.
- `src/files/components/FileTile.test.ts` — same two calls, same fix.
- `src/files/components/FileContextMenu.test.ts` — one `operate('copy', ['/DATA/a'])` call in
  the "paste options appear" test, same fix.

None of these call sites are outside the `src/files/` tree; no production (non-test) code
outside the brief's three files needed changes — `buildPastePayload` and `clipboard.operate`
have no callers besides `useFileOps.ts` and the tests.

## Test commands run (all foreground, `vitest run`)

1. **Confirm red** (implementation stashed back to pre-Task-3 state via
   `git stash push -- src/files/stores/clipboard.ts src/files/util/fileOps.ts
   src/files/composables/useFileOps.ts`, test files left updated):
   ```
   pnpm exec vitest run src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts
   ```
   Result: `clipboard.test.ts` — 4 failed / 9 passed (the two new tests plus the two
   pre-existing tests I'd already converted to entry-object calls, since the old `operate`
   only reads `.length`/spreads an array of strings — passing objects made every `from` land
   as the whole `{path,is_dir}` object instead of the path string). `fileOps.test.ts` — all
   passed at runtime, exactly as the brief predicted (`buildPastePayload`'s `'rename'` arg is
   only rejected by the type checker, not by the untyped JS at runtime).
   Then `git stash pop` to restore the Step-3 implementation.

2. **Confirm green** (implementation restored):
   ```
   pnpm exec vitest run src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts
   ```
   Result: 2 files passed, 13/13 tests passed.

3. **Full blast-radius sweep** (brief's own list plus the four files above):
   ```
   pnpm exec vitest run src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts \
     src/files/composables/useFileOps.test.ts src/files/components/FileRow.test.ts \
     src/files/components/FileTile.test.ts src/files/components/FileContextMenu.test.ts
   ```
   Result: 6 files passed, 87/87 tests passed.

4. **Whole files area** (sanity check beyond the brief's scope, given the type-signature
   ripple):
   ```
   pnpm exec vitest run src/files
   ```
   Result: 118 files passed, 880/880 tests passed.

5. **Type check**:
   ```
   pnpm exec vue-tsc --noEmit
   ```
   Result: no output, exit clean — no type errors anywhere in the repo.

## `isCut` behavior check (controller's stated concern)

`isCut(realPath)` still does `o.item.some((i) => i.from === realPath)` — unchanged logic,
only the shape of `i` changed (it now also has `is_dir`, which `isCut` ignores). The
brief's dedicated test (`isCut still matches on the real path only`) passed both in the
red run's after-fix re-check and in the final green run.

## Protective-value check on the new tests

Per the controller's standing instruction to flag tests that pass "for the wrong reason":
I verified this by literally reverting to pre-Task-3 source (via `git stash`) and re-running
— see "Confirm red" above. All three of the brief's new/modified assertions
(`records is_dir alongside the path...`, `isCut still matches on the real path only`, and
`buildPastePayload accepts the keep-both style...`) genuinely exercise the new behavior:
the first two failed at runtime pre-implementation exactly as expected; the third is a
type-only guarantee (as the brief itself says) and is enforced by `vue-tsc --noEmit`, not
by the runtime assertion — this is expected and not a false-protection case, since the
brief explicitly frames it that way ("这条是 vue-tsc 层面的类型错误"运行时可能先绿").
No test needed to be discarded as non-protective.

## Uncertain / worth flagging

- None. The brief's produced interfaces (`OperateItem`, `operate()`, `buildPastePayload`)
  match exactly what was implemented; the only judgment call was how to fix the four
  test files outside the brief's explicit file list, and I kept those fixes minimal
  (same style each pre-existing test already used, just entry-object instead of
  bare-path-string).

## Commit

```
git add src/files/stores/clipboard.ts src/files/util/fileOps.ts src/files/composables/useFileOps.ts \
  src/files/stores/clipboard.test.ts src/files/util/fileOps.test.ts \
  src/files/composables/useFileOps.test.ts src/files/components/FileRow.test.ts \
  src/files/components/FileTile.test.ts src/files/components/FileContextMenu.test.ts
git commit -m "feat(files): carry is_dir on clipboard items

Paste's conflict dialog has to disable Overwrite for directory collisions,
and a bare path cannot say whether it is one."
```
