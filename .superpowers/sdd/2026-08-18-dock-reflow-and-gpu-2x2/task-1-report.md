# Task 1 Report: The 2x2 GPU card shows only its ring

## Summary

Implemented exactly per the brief, with the corrected three-test deletion (the
brief undercounted at one; the test file actually had three tests pinning pill
behaviour, all deleted). The 2x2 GPU card now renders only the ring; temperature,
VRAM and frequency moved to (already lived on) the `w > 2` stats branch.

## Files changed

- `src/home/components/widgets/GpuWidget.vue` — deleted the `pill-grid` template
  branch and its explanatory comment; changed the stats branch guard from
  `v-else` to `v-if="item.w > 2"`; deleted the six now-unused `.pill*` CSS rules
  (`.pill-grid`, `.card-in > .pill-grid`, `.card-in > .pill-grid .pill`, `.pill`,
  `.pill s`, `.pill b`). No computed properties touched (`temp`, `vram`, `memUse`,
  `freq`, `col` all still used by the stats branch).
- `src/home/components/widgets/GpuWidget.test.ts` — reworked `shows rounded usage
  and temperature` to mount at `item(4)` instead of `item(2)` (temperature only
  lives in the wide branch now) and dropped its `not.toContain('33.4%')`
  assertion per the brief's exact replacement code. Deleted three tests that
  asserted `.pill` content at `w=2`:
  - `shows the frequency at the default 2x2 size, in place of the empty VRAM pill`
  - `keeps the VRAM pill at 2x2 when the card really has VRAM`
  - `falls back to the em-dashed VRAM pill when there is no frequency either`

  Replaced with two new tests (verbatim from the brief):
  - `renders only the ring at the default 2x2 size, with no pills`
  - `still shows temperature, VRAM and frequency once the card is widened`

  What the deleted tests covered outside of pills — em-dash rendering of absent
  readings, a real VRAM reading — remains covered at `w = 4` by the pre-existing
  `renders absent readings as an em dash, not as zeros` and `shows a genuine 0%
  VRAM usage on a discrete card, not an em dash`, which were left untouched.

## TDD evidence

### RED

Command: `pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose`

(Run after the test-file edits, before touching the component.)

```
 ✓ GpuWidget > shows rounded usage and temperature 16ms
 ✓ GpuWidget > renders absent readings as an em dash, not as zeros 8ms
 ✓ GpuWidget > shows the clock frequency when the backend reports one 3ms
 × GpuWidget > renders only the ring at the default 2x2 size, with no pills 6ms
   → expected 2 to be +0 // Object.is equality
 ✓ GpuWidget > still shows temperature, VRAM and frequency once the card is widened 3ms
 ✓ ...(rest passed)

 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```

Expected and matched exactly: `renders only the ring at the default 2x2 size,
with no pills` failed because the pill branch (`v-if="item.w <= 2"`) was still
in the template, so `.pill` count was 2, not 0. All other tests already passed
at this point because the reworked `shows rounded usage and temperature` mounts
wide (where temperature already rendered) and the new "still shows... once
widened" test also mounts wide (already true pre-change).

### GREEN

Command: `pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose`

(Run after the component template/CSS edit.)

```
 ✓ GpuWidget > shows rounded usage and temperature 16ms
 ✓ GpuWidget > renders absent readings as an em dash, not as zeros 8ms
 ✓ GpuWidget > shows the clock frequency when the backend reports one 3ms
 ✓ GpuWidget > renders only the ring at the default 2x2 size, with no pills 2ms
 ✓ GpuWidget > still shows temperature, VRAM and frequency once the card is widened 2ms
 ✓ GpuWidget > omits the frequency row when there is no reading 2ms
 ✓ GpuWidget > keeps a decimal so a lightly loaded GPU does not read as idle 2ms
 ✓ GpuWidget > drops the decimal from ten percent up so the number stays inside the ring 2ms
 ✓ GpuWidget > rounds a full load to a whole number too 2ms
 ✓ GpuWidget > keeps the decimal right up to the threshold 5ms
 ✓ GpuWidget > still renders real readings from a discrete card 2ms
 ✓ GpuWidget > shows a genuine 0% VRAM usage on a discrete card, not an em dash 2ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### Wider check (Step 5)

Command: `pnpm vitest run src/home/components/widgets/ --reporter=verbose`

Result: `Test Files 10 passed (10)`, `Tests 36 passed (36)`. No other widget test
referenced `.pill`; nothing needed updating.

### Build (Step 6)

Command: `pnpm build` (`vue-tsc --noEmit && vite build`)

Result: succeeded (`✓ built in 18.25s`). Only pre-existing, unrelated warnings
(rollup PURE-comment position in `@vueuse/core`, `eval` usage in `lottie-web`/
`file-type`, large-chunk-size notice) — none touching GpuWidget or CSS.

## Commit

`b5e76f3b` — `fix(home): make the 2x2 GPU card the ring alone`

Body explicitly states three tests (not one) were removed, names all three by
what they covered, and explains the revert rationale per the brief. Verified
`Signed-off-by: Tiansanchuan <1312528051@qq.com>` trailer present (added by the
repo's global sign-off hook).

Files staged and committed explicitly (no `-A`, no `-a`):
`src/home/components/widgets/GpuWidget.vue src/home/components/widgets/GpuWidget.test.ts`

## Self-review

- Diff matches the brief's template/CSS edits and test edits verbatim (checked
  with `git diff` against the brief's code blocks before committing).
- `grep -rn "\.pill" src/` after the commit shows only unrelated Photos-area CSS
  (`photos-smartview.scss`, comments in `PhotosMomentDetail.vue` /
  `PhotosSmartViewDetail.vue`) and the intentional `.pill` assertion inside the
  new GpuWidget test (`expect(w.findAll('.pill').length).toBe(0)`) — no stray
  leftover selectors or dead references in GpuWidget's own files.
- `src/styles/theme.css` was not touched (`git diff HEAD~1 HEAD -- src/styles/theme.css`
  is empty).
- `git status --short` is clean after the commit — nothing left uncommitted.
- One thing I deliberately left alone: the provenance comment at the top of the
  `<style scoped>` block (`/* base.css:142,147,156-158,186-192 — gpu widget
  (ring-row.solo + stats + pill-grid) */`) still mentions `pill-grid` by name.
  This is a source-mapping annotation documenting which base.css line ranges
  this component's CSS was originally extracted from, not a description of the
  component's current selectors — the brief scoped only the six specific
  `.pill*` rules for deletion and didn't mention this comment, so I left it
  in scope-of-brief rather than editing something not asked for. Flagging it
  here in case the reviewer wants it trimmed to drop "+ pill-grid".
- No test hygiene issues: no `.only`/`.skip`, no console noise, verbose reporter
  output is clean pass-only in the final run.
- No computed properties, imports, or unrelated code touched — scope stayed to
  exactly the template/CSS/test edits the brief specified.

## Concerns

None blocking. The one non-blocking note is the stale `pill-grid` mention in
the provenance comment above the `<style scoped>` block, called out in
self-review above — happy to fix in this task if the reviewer wants it, but
left it since the brief didn't list it as an edit target.
