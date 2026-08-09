# Task 6 report — 收尾门(五道)

**Head at run time:** `6ee3699` (docs-only commits `45be595`/`6ee3699` sit on top of the last code
commit `b0f7233`; no product code changed between them). Working tree clean before and after each
gate. All five gates run in the foreground, in the order given by
`.superpowers/sdd/2026-08-09-sp17-settings-catchup/task-6-brief.md`, no product code changed.

## Gate 1 — Type check

Command: `pnpm exec vue-tsc --noEmit`

Output: none (silent). Exit code: `0`.

Result: **0 errors.**

## Gate 2 — Full test suite

Command: `pnpm test`

Tail of real output:

```
 Test Files  675 passed (675)
      Tests  10943 passed (10943)
   Start at  19:04:02
   Duration  204.27s (transform 38.94s, setup 153.74s, import 183.36s, tests 230.25s, environment 313.17s)
```

Result: **675 files passed (675) / 10943 tests passed (10943), 0 failed.**

The suite also printed a bunch of expected jsdom stderr noise (`Error: Not implemented:
navigation (except hash changes)` from `src/photos/stores/favorites.ts` export-zip tests, and one
`/tmp/nimoos-www-*` permission message from a redirect-page test) — these are pre-existing stderr
noise from tests that intentionally exercise `location.href` / a sandboxed tmp path under jsdom,
not failures; the summary line confirms 0 failed.

The known flake `src/files/upload/persist.test.ts:55` did **not** turn red in this run (it's
included in the 675/10943 all-green count). Per the brief, isolating and re-running it is only
required if it is hit — it wasn't, so I did not do a separate isolated run.

## Gate 3 — i18n key parity

Command: `pnpm exec vitest run src/i18n/parity.test.ts`

Output:

```
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  19:07:37
   Duration  799ms
```

Result: **PASS — 1 file / 9 tests, all green.**

## Gate 4 — Open-source export guard

Command: `node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/f58a5f4d-afa0-4fa2-950e-aa2dc8ebb7cb/scratchpad/sp17-oss --no-commit --allow-dirty-oss`

Real output (captured to a log file, exit code checked separately from any pipe):

```
[oss] 1/6 前置检查
[oss]   New-UI 6ee36996(共享包已内联,不再取第二个仓)
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 73 · REPLACE 4 · PATCH 278)
[oss] 4.5/6 重算 lockfile(package.json 的依赖已被清单改动)
[oss] 5/6 泄漏守卫
[oss]   ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper01.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/assets/wallpaper/wallpaper02.jpg —— 判定为二进制,未扫描
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(3 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → /tmp/claude-1000/-home-nimo-NimoTech/f58a5f4d-afa0-4fa2-950e-aa2dc8ebb7cb/scratchpad/sp17-oss
```

`REAL_EXIT_CODE=0` (checked directly, not through a pipe).

Result: **zero real leaks.** 3 binary files (two wallpaper JPGs, one PNG icon) skipped content
scanning as expected — this matches the brief's "binary skips are expected" note. No leak, so no
rewording was needed and none was done.

## Gate 5 — Build

Command: `pnpm build` (runs `vue-tsc --noEmit && vite build`)

Output tail:

```
✓ 2720 modules transformed.
...
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 18.44s

real	0m38.163s
```

Result: **Success.** Only the standard chunk-size warning (largest chunk `dist/assets/index-BQnRorZI.js` 7,366.96 kB / gzip 2,066.56 kB) — not an error. `vite build` itself reported 18.44s; the full `pnpm build` command (tsc + vite build) took 38.16s wall-clock.

## Comparison against the numbers already in the outstanding doc

The doc already had a "收尾门实测结果" section (written by an earlier task, commit `45be595`,
touched again by `6ee3699`) with its own table. Comparing:

- Full test suite (675/10943) and type check (0 errors): **identical** to what I measured — no discrepancy.
- Build time: earlier doc said 36.82s, I measured 38.16s. Same command, different run — normal variance, not a regression, both under the "success, only chunk warnings" bar.
- **Open-source export gate: the earlier doc's row ran a different command** — `pnpm exec vitest run oss/` (the OSS guard's own unit test suite: 7 files / 146 tests, all green) — not the brief's actual Step 4 (`node oss/export.mjs --out ... --no-commit --allow-dirty-oss`, a real export dry-run against the whole source tree). Both are green, but they are not the same check; the earlier table did not actually exercise the export/leak-scan path the brief asks for. I ran the brief's real command and recorded its actual output (Gate 4 above) as the authoritative result for this task, and left a note in the doc explaining the discrepancy so nobody mistakes the old `vitest run oss/` number for having covered the export gate.
- i18n parity (Gate 3) was not present at all in the earlier table; I added it.

## Files changed

- `docs/superpowers/2026-08-09-sp17-outstanding.md` — replaced the "收尾门实测结果" section with the five brief-specified gates, their real command output, and a note explaining the discrepancy with the prior table's OSS-gate command. Committed as `9a28798` `docs(sp17): record the gate results`.

No product code was touched — all five gates passed, so no fix was needed and none was made.

## Self-review

- Re-diffed the commit (`git show HEAD`) against the raw command outputs captured above: every number in the committed table (675/10943, 0 errors, 1/9, DELETE 73 · REPLACE 4 · PATCH 278 · 0 leaks, 18.44s/38.16s) matches what the commands actually printed. Nothing was rounded or invented.
- Nothing is stated as passing that did not pass — all five gates were genuinely green in this run.
- The doc's header metadata (`代码末位: b0f7233`) was left unchanged since it's still accurate (no code commits since); I added a note in the new section heading clarifying the actual HEAD I ran gates at (`6ee3699`) is docs-only on top of that.
- Working tree is clean after the commit (`git status --short` empty).

## Concerns

None. All five gates passed on the first run; no product-code fix was required, so nothing needed to be flagged to the user before changing code.
