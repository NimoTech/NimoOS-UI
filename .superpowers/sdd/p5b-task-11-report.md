# Task 11 report — dev-server stale-prebundle guard for `@nimotech/nimoos-service` (verify-before-handoff, not in original T0–T10)

Branch: `sp8-ai`. Base HEAD: `1f0022b`. Commit: see bottom of this report.

## Why this task exists

Coordinator found `node_modules/.vite/deps/@nimotech_nimoos-service.js` dated 2026-07-23 (10 days
stale, from SP8-P0). It has `parserFiles`/`parserReindexFiles`/`parserRetryJobs`/`parserClearFailedJobs`/
`parserDeleteJob` but **zero** hits for `listDistillJobs` / `getDistillStatus` — the two methods
T5's `QueueView.vue` distill scope calls. The real `node_modules/@nimotech/nimoos-service/dist/notes.js`
has both. Root cause (not new, already solved once on the main worktree during SP9-P1): the package
is a `file:../NimoOS-Service` dependency; pnpm hardlinks its `dist` into `.pnpm`, so Vite treats it as
an ordinary node_modules dependency and pre-bundles it into `node_modules/.vite/deps/`. Pre-bundle
cache invalidation keys off lockfile / vite config / dependency **version number**, not content — and
this package's version is pinned at `0.0.1` forever, so rebuilding the shared package never invalidates
the cache. `vitest` and `vite build` both read `node_modules` directly (no pre-bundle layer), so this
only ever shows up in `pnpm dev` — which is exactly the tool the user was about to use for acceptance.

## Precedent (main worktree `/home/nimo/NimoTech/NimoOS-New-UI`, read-only, not touched)

### `vite.config.ts` — the added block, verbatim

```ts
  // ⚠️ 共享包 @nimotech/nimoos-service 必须排除出依赖预打包(SP9-P1 验收踩到)。
  // 它是 `file:../NimoOS-Service` 依赖,pnpm 把 dist 硬链进 .pnpm 目录 —— 在 Vite 眼里
  // 是个普通的 node_modules 依赖,于是会被预打包进 node_modules/.vite/deps/。
  // 而预打包缓存的失效判据是 lockfile / config / 依赖版本号,**不看依赖内容**;
  // 这个包版本号恒为 0.0.1,所以 `cd ../NimoOS-Service && pnpm build` 之后
  // 缓存**不会**失效,dev server 会一直喂浏览器旧的包 —— 新加的方法在浏览器里
  // 全是 undefined(表现为 `xxx is not a function`,被调用处 catch 成"保存失败"),
  // 而单测走源码、生产 build 走 node_modules,两边都是新的,所以只在 dev 复现。
  // exclude 后 dev 直接按需加载 node_modules 里的真实文件(与 dist 同 inode),永远是新的。
  optimizeDeps: {
    exclude: ['@nimotech/nimoos-service'],
    include: ['axios'], // 上面 exclude 掉的包内部 import 它,显式登记以免触发"发现新依赖 → 整页重载"
  },
```

### `src/viteOptimizeDepsGuard.test.ts` — full file (main worktree has `@types/node`, imports plain)

Same assertion logic as ours below, but with a plain `/// <reference types="node" />` + bare
`node:fs`/`node:path`/`node:url` imports (no `@ts-expect-error`), because that worktree's
`package.json` carries `"@types/node": "^26.1.2"`.

## What I copied vs. adapted, field by field

| Precedent field | `.sp8` result | Note |
|---|---|---|
| `optimizeDeps.exclude: ['@nimotech/nimoos-service']` | identical | copied verbatim |
| `optimizeDeps.include: ['axios']` | identical | copied verbatim, same inline comment |
| All 9 comment lines above the block | identical, char-for-char | |
| Placement | after `plugins: [...]`, before the next comment/field | mirrors precedent's position (right after `plugins`) |
| Guard test assertion (`optimizeDeps` block regex + `exclude` regex) | identical | copied verbatim |
| Guard test node: imports | **diverged from precedent** — see below | |

**Divergence, and why it's not "adding something the precedent doesn't have":** running
`pnpm exec vue-tsc --noEmit` with the precedent's plain node: imports failed in `.sp8` with
`TS2688 Cannot find type definition file for 'node'` / `TS2307 Cannot find module 'node:fs'` —
**this worktree's `package.json` has no `@types/node`**, unlike the main worktree. I first tried
"fix the gap" by adding `"@types/node": "^26.1.2"` to `devDependencies` (matching the main
worktree's version) and running `pnpm install`. That made my new test type-check, but broke
5 **pre-existing, already-reviewed** test files across the repo (`IndexedFilesView.test.ts`,
`QueueView.test.ts`, `knowledgeStyles.test.ts`, `settingsStyles.test.ts`, `AppToast.test.ts`) with
`TS2578 Unused '@ts-expect-error' directive` — those files each carry a documented, deliberate
local convention (own header comment: *"本仓未装 @types/node ... 逐行 @ts-expect-error 抑制"*)
that assumes `@types/node` is **absent**. Adding the package silently un-broke the errors those
directives exist to suppress, turning them into new tsc failures — and 4 of those 5 files live
under `src/ai/`, which I was told not to touch. I reverted `package.json`/`pnpm-lock.yaml`
(`git checkout -- package.json pnpm-lock.yaml` + `pnpm install`) and instead rewrote my guard
test's imports to use the **already-established local pattern** (per-line `@ts-expect-error`,
same wording), which is itself a documented precedent inside this exact worktree
(`knowledgeStyles.test.ts` lines 1–15, `QueueView.test.ts`, `IndexedFilesView.test.ts` lines 47–58).
Final import block:

```ts
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import fs from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import path from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
import { fileURLToPath } from 'node:url'
```

No `__dirname` used anywhere (ESM `"type": "module"` — used `fileURLToPath(import.meta.url)` per
brief). No `?raw` used to read `vite.config.ts` — read via `node:fs` per brief.

## 3 RED probes (each: change → red text → revert → confirm clean)

All three done against the *installed* `optimizeDeps` block, restoring from a scratch backup
(`/tmp/.../scratchpad/vite.config.ts.bak`) between each, confirmed `git status --short` clean
(only the intended `vite.config.ts` diff + new test file untracked) after every restore.

**Probe 1 — delete the whole `optimizeDeps` block:**
```
AssertionError: vite.config.ts 里找不到 optimizeDeps 块: expected null not to be null
 ❯ src/viteOptimizeDepsGuard.test.ts:23:61
```

**Probe 2 — change the package name (`'@nimotech/nimoos-service'` → `'@nimotech/some-other-package'`):**
```
AssertionError: expected 'optimizeDeps: {\n    exclude: [\'@nim…' to match /exclude\s*:\s*\[[^\]]*…/nimoos-service'
- Expected:
/exclude\s*:\s*\[[^\]]*'@nimotech\/nimoos-service'/
+ Received:
"optimizeDeps: {
    exclude: ['@nimotech/some-other-package'],
    include: ['axios'], ...
  }"
```

**Probe 3 — change the field name (`exclude:` → `excludeDeps:`):**
```
AssertionError: expected 'optimizeDeps: {\n    excludeDeps: [\'…' to match /exclude\s*:\s*\[[^\]]*…/nimoos-service'
- Expected:
/exclude\s*:\s*\[[^\]]*'@nimotech\/nimoos-service'/
+ Received:
"optimizeDeps: {
    excludeDeps: ['@nimotech/nimoos-service'],
    include: ['axios'], ...
  }"
```

After each probe, restored `vite.config.ts` from the backup and re-ran the guard test to confirm
green, and `git status --short` confirmed only `vite.config.ts` (modified) and
`src/viteOptimizeDepsGuard.test.ts` (untracked) — nothing else touched.

## Proof the hole is actually plugged

1. Deleted the stale cache: `rm -rf node_modules/.vite` (no error, directory gone).
2. Started dev server: `nohup pnpm dev --host --port 5288 > .../dev-5288.log 2>&1 &`. Actual
   listening process (verified via `ss -ltnp | grep 5288`): **PID 85265** (node), not the shell
   wrapper PID.
3. `curl -sI http://127.0.0.1:5288/app/` → `HTTP/1.1 200 OK`.
4. Traced the real module graph the browser would receive, by hand:
   ```
   $ curl -s http://127.0.0.1:5288/app/ | grep -o 'src="[^"]*"'
   src="/app/@vite/client"
   src="/app/src/main.ts"

   $ curl -s http://127.0.0.1:5288/app/src/main.ts | grep -n "nimoos-service"
   3:import { initService } from "/app/node_modules/.pnpm/@nimotech+nimoos-service@file+..+NimoOS-Service_b3tvzjssxxiibscaarv66mihxu/node_modules/@nimotech/nimoos-service/dist/index.js?v=41674584";
   ```
   This URL is the **real node_modules path** (`.pnpm/.../node_modules/@nimotech/nimoos-service/dist/index.js`),
   not `/app/node_modules/.vite/deps/@nimotech_nimoos-service.js` — confirms Vite is no longer
   routing this import through the pre-bundle.
   ```
   $ curl -s ".../dist/index.js?v=41674584" | grep -n "notes"
   22:import { createNotes } from ".../dist/notes.js?v=41674584";
   25:export { isDistillableName, DISTILL_EXTS } from ".../dist/notes.js?v=41674584";
   ...

   $ curl -s ".../dist/notes.js?v=41674584" -o /tmp/.../notes.dev.js
   $ grep -n "listDistillJobs\|getDistillStatus" /tmp/.../notes.dev.js
   185:        async listDistillJobs(status = '', limit = 200) {
   192:        async getDistillStatus() {
   ```
   **Both methods are present in the file the dev server actually delivers.** `diff` against
   `node_modules/@nimotech/nimoos-service/dist/notes.js` showed only one difference: an appended
   `//# sourceMappingURL=...` comment (Vite's dev transform) — content is otherwise byte-identical,
   confirming the dev server serves the current real file, not a frozen snapshot.
5. Confirmed no pre-bundle for this package exists post-fix: `ls node_modules/.vite/deps/ | grep -i nimoos-service` → empty (`NO nimoos-service pre-bundle present`).
6. Re-checked `curl -sI http://127.0.0.1:5288/app/` → `200 OK` (server still healthy after all probing).

## Three gates

- `pnpm test` → **319 files / 3153 tests, all green** (baseline was 318/3152; +1 test file / +1 test,
  none of the two documented flaky tests — `persist.test.ts`/`AgentComposer.test.ts` — were red,
  so no rerun needed).
- `pnpm exec vue-tsc --noEmit` → **0 errors**, exit 0.
- `pnpm build` → succeeded, `dist/` produced (not committed — gitignored, untouched by
  `git status`). Only pre-existing warning: chunk-size-limit notice on `index-BJ0FINUd.js`
  (unrelated to this change, present in baseline builds).

## Dev server left running for acceptance

- Port: **5288**
- PID: **85265** (verified via `ss -ltnp`)
- `curl -sI http://127.0.0.1:5288/app/` → `200 OK`
- Log: `/tmp/claude-1000/-home-nimo-NimoTech/58ae1441-09b0-408a-aa7c-5c9f9e8e3a2f/scratchpad/dev-5288.log`

## Files changed

- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/vite.config.ts` — added `optimizeDeps` block (copied
  verbatim from main-worktree precedent), inserted after `plugins: [...]`.
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/viteOptimizeDepsGuard.test.ts` — new guard test,
  same assertion logic as precedent, node: imports adapted to this worktree's documented
  no-`@types/node` convention (per-line `@ts-expect-error`, wording matched to
  `knowledgeStyles.test.ts`/`QueueView.test.ts`/`IndexedFilesView.test.ts`).
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-11-report.md` — this report.

`package.json` / `pnpm-lock.yaml` / `node_modules` are back at their pre-task state (the
`@types/node` experiment was fully reverted via `git checkout -- package.json pnpm-lock.yaml`
followed by `pnpm install`); `git status --short` shows no diff on either file.

## Leftover questions / concerns

1. **This is a build-config fix, not a code fix.** It stops the *symptom* (dev server serving a
   frozen pre-bundle) but the underlying reason the package is eligible for pre-bundling at all
   (pnpm hardlinking a `file:` dependency's `dist` into `.pnpm`, combined with the package's
   version being permanently pinned at `0.0.1`) is unchanged. Any *other* `file:`-linked package
   added later would need the same `optimizeDeps.exclude` treatment — there's no generic guard
   that catches "a new file: dependency was added without being excluded."
2. **Divergence from the literal instruction** "照抄先例的字段与注释口径,别加先例没有的东西"
   for the *test file's imports*: I did not copy the precedent's node: import style verbatim,
   because doing so broke tsc in this worktree (missing `@types/node`) and the alternative fix
   (installing `@types/node`) broke 5 other already-reviewed files' intentional `@ts-expect-error`
   suppressions. I judged matching *this worktree's own* documented local convention (also a
   real, existing precedent, just a different one) as the correct call, and reverted the
   `@types/node` experiment cleanly. Flagging this explicitly in case the coordinator wants the
   main-worktree style copied byte-for-byte instead (which would require also adding
   `@types/node` to `.sp8`'s `package.json`, and presumably fixing the 5 now-broken files as a
   separate follow-up — out of scope for this task's "don't touch `src/ai/`" constraint).
3. Dev server is left running (PID 85265) per instructions — nobody should `pnpm dev` again on
   :5288 until the user is done with acceptance, or it'll double-bind.
