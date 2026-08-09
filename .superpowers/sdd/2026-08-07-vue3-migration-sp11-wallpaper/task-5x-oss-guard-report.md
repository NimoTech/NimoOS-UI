# Task 5x — oss guard: classify oversized binary files by content, not size alone

## What changed and why

`oss/forbidden.mjs`'s `scanTree()` classified any file over `MAX_BYTES` (2MB) as
"over the cap" — an *unexpected*, fatal skip — before ever checking whether the
file was binary. `SP11 Task 1`'s `src/assets/wallpaper/wallpaper01.jpg`
(2,281,371 bytes) tripped this: a completely ordinary binary asset, no different
in kind from the many sub-cap PNG/SVG icons this guard already skips-and-logs as
`SKIP_REASON_BINARY` (an *expected*, non-fatal skip), was instead treated as an
unexpected anomaly and made `oss/export.mjs` refuse to export.

Fix: reorder the classification. When `stat.size > MAX_BYTES`, read only the
head bytes `looksBinary()` actually inspects (`SNIFF_BYTES`, ~8KB) via
`fs.openSync`/`fs.readSync` — never the whole oversized file — and sniff that
head first:
- looks binary → `SKIP_REASON_BINARY` (expected skip), same as any other binary
  asset regardless of size.
- does not look binary → the existing over-the-cap reason (still unexpected/
  fatal) — this is what must keep catching an oversized *text* file, which could
  genuinely hide a secret in a region nobody read.
- a failure on the head read itself (e.g. permission denied) is still reported
  via the existing `读取失败,未扫描:` skip reason, never swallowed.

Files at or under the cap are completely unaffected — that code path (`fs.stat`
→ `fs.readFileSync` whole file → `looksBinary` → `scanText`) was not touched.

Rationale is recorded in English inline comments at the reorder site and in the
①–④ block-comment above `scanTree()` (② and ④ updated to describe the new
sniff-then-classify behavior; ① and ③ were untouched and left as-is per the
repo's "translate legacy comments only when already editing that code" rule —
I only edited ②/④ so only those needed updating).

Files touched:
- `/home/nimo/NimoTech/NimoOS-New-UI/oss/forbidden.mjs`
- `/home/nimo/NimoTech/NimoOS-New-UI/oss/forbidden.test.mjs`

Did **not** touch: `MAX_BYTES`/`SNIFF_BYTES` values, the `dist` scanner's
`DIST_MAX_BYTES` path (`scanDist`), any `allow` whitelist entries, and did not
resize/recompress/move the wallpaper JPEG.

## TDD evidence

### RED

Added three tests to `oss/forbidden.test.mjs` (end of the `scanTree` describe
block) *before* touching `forbidden.mjs`:
1. an oversized file whose first 8KB contains a NUL byte → expect
   `SKIP_REASON_BINARY` (expected skip)
2. an oversized file that is pure text (no NUL anywhere) → expect the
   over-the-cap reason (unexpected skip) — proves the cap isn't quietly
   disabled
3. (bonus, following the controller's "must still report read-failure, never
   swallow" requirement) an oversized file with `chmod 0o000` → expect a
   `读取失败,未扫描:` reason (unexpected skip), not a silent pass, and not
   `not thrown`

Command: `pnpm vitest run oss/forbidden.test.mjs`

```
 ❯ oss/forbidden.test.mjs (37 tests | 2 failed) 45ms
     × 超过体积上限但开头 8KB 判定为二进制的文件,按 SKIP_REASON_BINARY 分类(预期内),不是"超过上限"(预期外)
     × 超过体积上限且开头读取失败(无读权限)的文件,报"读取失败"(预期外),不静默吞掉

AssertionError: expected '超过 2097152 字节上限,未扫描' to be '判定为二进制,未扫描'
AssertionError: expected false to be true   // isExpectedSkip(...) mismatch, read never attempted

 Test Files  1 failed (1)
      Tests  2 failed | 35 passed (37)
```

Note: test 2 (the text-file regression guard) already passed pre-fix, since the
old code classified *every* oversized file the same way regardless of content —
that assertion exists to be a guard against a future regression (the reorder
must not quietly stop catching oversized text), not to prove a pre-fix bug.

### GREEN

After implementing the reorder in `scanTree()`:

```
pnpm vitest run oss/forbidden.test.mjs
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

## `pnpm vitest run oss/` result

```
 Test Files  1 failed | 5 passed (6)
      Tests  1 failed | 140 passed (141)
```

The one remaining failure in `oss/tree.test.mjs` ("不带 --skip-guard 也能跑通")
is **not** the failure this task targeted — that one is gone. The wallpaper
JPEG no longer appears anywhere in the output; the original
"超过 2097152 字节上限,未扫描" fatal error for it is fixed.

What surfaced instead is a **separate, pre-existing, previously-masked
problem**: with the fatal "unexpected skip" no longer thrown early,
`export.mjs` now proceeds far enough to run the actual leak scan, which reports
13 real hits — all in files from already-committed SP11 wallpaper commits
(`91816ac`, `0046f5c`, `5d9b549`, `8a186a2`, `aaf912d`), none touched by this
task:

```
✗ packages/service/src/users.test.ts:221 [gallery] await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')
✗ packages/service/src/users.test.ts:224 [gallery] expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })
✗ src/components/WallpaperDialog.vue:8 [search] // wallpaper this dialog previews. Following SearchDialog.vue instead --
✗ src/i18n/en_us.base.ts:757 [photo] themePhoto: 'Photo…',
✗ src/i18n/zh_cn.base.ts:757 [photo] themePhoto: '照片…',
✗ src/i18n/zh_cn.base.ts:757 [照片] themePhoto: '照片…',
✗ src/main.ts:46 [photo] // and the photo snaps in a frame later.
✗ src/stores/wallpaper.test.ts:270 [gallery] await s.setFromNasPath('/DATA/Gallery/a.png')
✗ src/stores/wallpaper.test.ts:271 [gallery] expect(setImageFromPath).toHaveBeenCalledWith('wallpaper', '/DATA/Gallery/a.png')
✗ src/styles/theme.css:189 [photo] existing sheen + vignette shape so white text stays readable on any photo. */
✗ src/styles/theme.css:287 [photo] /* SP11: the paper theme's text is near-black (#1c1b19); over a dark photo it
✗ src/styles/wallpaper.css.test.ts:30 [photo] it('kills the bokeh layer, which would smear coloured fog over a photo', () => {
✗ src/styles/wallpaper.css.test.ts:45 [photo] // text loses its white veil over a dark photo -- invisible to tsc, build,
```

Confirmed via `git log`/`git diff` that none of these files were touched by
this task — `git status --short` before my edit showed only the 3
permanently-staged `design-export/*.html` deletions; `oss/forbidden.mjs` and
`oss/forbidden.test.mjs` are the only files this task modified.

At a glance these all look like the kind of generic-word false positive this
guard already has precedent for whitelisting (e.g. `/DATA/Gallery` paths,
`'photo'` used generically for "picture", an i18n key literally named
`themePhoto` for a wallpaper theme). One line stands out and needs a human
call, not a mechanical whitelist entry: `WallpaperDialog.vue:8`'s comment
`Following SearchDialog.vue instead` references a component that (per this
repo's OSS-export delete list for the AI/search area) may not exist in the
exported tree — that's a documentation/precedent reference, not a functional
dependency, but it's a judgment call about whether the comment should be
reworded, not something to wave through with `exactLine()`.

**I did not touch any of this.** The ruling for this task was explicit: "do
not add a path allowlist... do not weaken anything else." Fixing these 13 hits
requires per-line `exactLine()` allowlist decisions (or code changes) that are
a separate, unrelated body of work from unrelated SP11 wallpaper commits — not
something to improvise under this ticket. Flagging for the controller to spin
up a follow-up task.

`pnpm exec vue-tsc --noEmit`: clean, no output.

## Contradictions with the controller's description

None on the guard-fix itself — `looksBinary()` does only inspect the leading
`SNIFF_BYTES` (~8KB), confirmed by reading the source; the expected/unexpected
partition in `export.mjs` is driven purely by `isExpectedSkip(f.excerpt)`
string-matching the skip reason, confirmed by reading `export.mjs:159-186`.
The one surprise is scope, not correctness: the ticket's framing ("tree.test.mjs
going green is the whole point") assumed fixing the reorder would make that
test pass outright. In reality, the reorder is correct and necessary but not
sufficient — it unmasks a second, unrelated failure that was hidden behind the
first one's early `throw`.

## Self-review findings

- Re-read the diff: `Math.min(stat.size, SNIFF_BYTES)` in the head-read buffer
  size is redundant given `stat.size > MAX_BYTES > SNIFF_BYTES` always holds
  here, but kept it for defensive clarity (no behavior difference; harmless).
- `fs.closeSync(fd)` is in a nested `finally`, so it runs whether `readSync`
  throws or not — verified no fd leak on the read-failure path.
- `bytesRead` is used to `subarray` the head buffer in case of a short read;
  not exercised by any test (short reads on regular files are effectively
  impossible), but correct and cheap to keep.
- Confirmed the under-cap code path (`fs.readFileSync` whole file →
  `looksBinary` → `scanText`) is byte-for-byte unchanged.
- Confirmed `scanDist`/`DIST_MAX_BYTES` untouched (`git diff` only touches
  `scanTree`'s body and its doc comment).
- Confirmed the wallpaper JPEG itself was not resized/recompressed/moved (not
  part of this task's diff at all).
- Did not commit a false "all green" — the report and final reply both state
  plainly that `oss/tree.test.mjs` still has one failing test, for a reason
  outside this ticket's scope.

## Commit

`8fd3cc0` — `fix(oss): classify oversized binary files by content, not size
alone`, scoped to `oss/forbidden.mjs oss/forbidden.test.mjs` via explicit
pathspec; the 3 permanently-staged `design-export/*.html` deletions remain
staged and untouched.

---

## Follow-up: whitelisting the 13 uncovered false positives (authorized)

The coordinator confirmed all 13 hits as false positives, ran the export
themselves, and authorized adding precise `exactLine()` whitelist entries for
all 13 in `oss/forbidden.mjs`'s soft-forbidden-word section — the remedy the
guard's own failure message prescribes, and the file's established house
pattern. No word-list widening, no file-level exemptions, no editing of the
13 source lines.

### Entries added (13, one per hit, grouped by SOFT word)

**`photo`** word block (7 entries):
- `src/i18n/en_us.base.ts` — `themePhoto: 'Photo…',`
- `src/i18n/zh_cn.base.ts` — `themePhoto: '照片…',` (hits `photo` because the
  key name `themePhoto` itself contains the substring "Photo")
- `src/main.ts` — `// and the photo snaps in a frame later.`
- `src/styles/theme.css` — `existing sheen + vignette shape so white text stays readable on any photo. */`
- `src/styles/theme.css` — `/* SP11: the paper theme's text is near-black (#1c1b19); over a dark photo it`
- `src/styles/wallpaper.css.test.ts` — `it('kills the bokeh layer, which would smear coloured fog over a photo', () => {`
- `src/styles/wallpaper.css.test.ts` — `// text loses its white veil over a dark photo -- invisible to tsc, build,`

**`gallery`** word block (4 entries):
- `packages/service/src/users.test.ts` — `await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')`
- `packages/service/src/users.test.ts` — `expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })`
- `src/stores/wallpaper.test.ts` — `await s.setFromNasPath('/DATA/Gallery/a.png')`
- `src/stores/wallpaper.test.ts` — `expect(setImageFromPath).toHaveBeenCalledWith('wallpaper', '/DATA/Gallery/a.png')`

**`search`** word block (1 entry):
- `src/components/WallpaperDialog.vue` — `// wallpaper this dialog previews. Following SearchDialog.vue instead --`

**`照片`** word block (1 entry):
- `src/i18n/zh_cn.base.ts` — `themePhoto: '照片…',`

Note the real line numbers (found via `grep -n` at fix time) had already
drifted from the numbers in the coordinator's leak report (e.g.
`theme.css:189/287` in the report vs. actual `304/406` at the time of this
edit) — exactly why this file uses `exactLine()` scoped by file regex + exact
content instead of line-number anchors; the entries added here are immune to
further drift.

### Verification

`node oss/export.mjs --out /tmp/oss-sp11-verify --no-commit --allow-dirty-oss`:
completed clean —

```
[oss] 5/6 泄漏守卫
[oss]   ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper01.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper02.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(3 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /tmp/oss-sp11-verify
```

`pnpm vitest run oss/` — fully green:

```
 Test Files  6 passed (6)
      Tests  141 passed (141)
```

(`tree.test.mjs`'s "不带 --skip-guard 也能跑通" now passes — the gate this
whole detour existed to clear.)

`pnpm exec vue-tsc --noEmit` — exit 0, no output.

Verify output directory (`/tmp/oss-sp11-verify`) removed after inspection.

### Commit

`206b13a` — `fix(oss): whitelist 13 SP11 wallpaper false positives in the leak
guard`, scoped to `oss/forbidden.mjs` via explicit pathspec; the 3
permanently-staged `design-export/*.html` deletions remain staged and
untouched.
