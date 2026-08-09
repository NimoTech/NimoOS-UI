# Task 5 report: roadmap 开 SP17 节 + 「不适用」结论登记

## Status: DONE

## What was written and where

### 1. Vue2 repo (`/home/nimo/NimoTech/NimoOS-UI`, branch `docs/vue3-migration-sp3`)

Inserted a new `### SP17 — 设置区补迁` section into `docs/vue3-migration-roadmap.md`,
between the end of the `### SP15 — 相册区补迁` section and `## 5. 大外壳收口` (matching
the brief's placement instruction exactly). Read the neighbouring SP12/SP13/SP14/SP15
sections first to match structure and tone (table + bold callouts + evidence-bearing
bullets, same voice as SP15's "带证据的差集重算" style).

Contents, in the brief's required order:
1. A "范围三件" table: `#93` (LAN devices, split into shared-package + settings-tab
   commits), `#103`+`#105` (photos cache row + dead-code removal), `#125` (KVM tile
   gating) — each with its New-UI commit hashes and status ("编码完成,评审 clean").
2. The two deliberate departures from Vue2 (error line vs. silent empty state;
   generation guard), with a note that they're registered in code comments.
3. The recomputed gate numbers (see below), with an explicit "未合并/未部署/未推/未验收"
   line pointing to the outstanding doc.
4. Six evidence-backed "not applicable / not doing" bullets — `#97` (wsssh 404 probe +
   `TerminalPanel.vue:5-9`), `#121` icon dead-link (`importNormalize.ts:76`), `#121`
   Discord link (no `ContactBar` counterpart), `#119` dead-domain purge (Vue2-only
   README/locale), `awesome.casaos.io` (still present in Vue2 `origin/main` too,
   `AppStoreSourceManagement.vue:92`), `#128` default icon artwork (no `default.png/svg`
   asset in New-UI).
5. Two corrections to the roadmap's SP12 list (`#122` is Files-area, not this area;
   `#136` already delivered by SP14 — leaving only `#125` as the genuine odds-and-ends
   item; and Knowledge/Notes `#78`-`#104` already absorbed by SP8).
6. Branch/worktree/baseline coordinates (`sp17-settings-catchup`, worktree path,
   `master@6f8f742` as the merge-base).

Committed with pathspec `git add docs/vue3-migration-roadmap.md` (never `-A`/`.`), single
file changed (38 insertions), commit `9a3328ca` with the brief's exact message
verbatim. Working tree was clean before and after; no other files touched, no branch
switch.

### 2. New-UI repo, this worktree (`docs/superpowers/2026-08-09-sp17-outstanding.md`)

New file, written for "whoever picks up acceptance/merge next" with no other context.
Sections: status header (branch/worktree/baseline/HEAD) → per-task commit-scope table
(mirrors the roadmap table but with the two departures spelled out) → gate-result table
with real numbers → an 8-step real-machine acceptance checklist (expanded from the
brief's terser version into fully self-contained steps: exact `pnpm dev` invocation,
what "pass" looks like at each step, explicit warnings not to actually start a migration
or leave the ISO-eject-style irreversible action, and what to do to restore state after
the KVM-hidden-tile test) → the six not-applicable bullets (same evidence as the
roadmap, restated so this doc is self-contained without requiring a cross-repo hop) →
two known leftover debts (the pre-existing `[Vue warn]` i18n double-registration noise,
and the SP13 "comments still point at NimoOS-Service" ticket) → a short "next steps for
whoever merges" list.

Committed with `git add docs/superpowers/2026-08-09-sp17-outstanding.md`, commit
`45be595`, message exactly as specified in the brief.

**One correction made mid-task**: I initially wrote the file with the `Write` tool to
`/home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/...` — the *main* repo checkout
(branch `master`), not this worktree. Caught it immediately via `git status --short`
(file showed up as untracked on `master`, not in the worktree), deleted the stray
untracked file from the main repo (`rm`, no git operation needed since it was never
staged/committed there), and rewrote it at the correct path
`.claude/worktrees/sp17-settings-catchup/docs/superpowers/2026-08-09-sp17-outstanding.md`.
Verified after the fact that the main repo's `git status` shows nothing stray.

## Commands run and their output

All run in the foreground from `.claude/worktrees/sp17-settings-catchup` unless noted.

**Gate re-verification (fresh numbers for both documents, not copied from task reports)**:

```
$ pnpm test
...
 Test Files  675 passed (675)
      Tests  10943 passed (10943)
   Duration  181.65s
```
(This one exceeded the tool's 120s default and was auto-moved to background by the
harness; I did not intentionally background it — the harness's own timeout kicked in.
Result was retrieved via the completion notification once it finished, output identical
in nature to a foreground run.)

```
$ pnpm exec vue-tsc --noEmit
EXIT:0
```

```
$ pnpm exec vitest run oss/     # before the Task 5 commit — clean tree at this point
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

```
$ pnpm build
✓ built in 36.82s
```
(git status --short was empty afterward — dist/ is gitignored.)

**Evidence checks** (grep/read, not gates):
```
$ sed -n '1,12p' src/settings/panels/TerminalPanel.vue
# confirms lines 5-9 hold the wsssh-404 comment and D7/D25 mention

$ grep -n "icon.nimoos.io" src/apps/util/importNormalize.ts
76:  // 不注入 icon:icon.nimoos.io 域名不存在(Vue2 遗留死链,ERR_NAME_NOT_RESOLVED),

$ cd /home/nimo/NimoTech/NimoOS-UI && git show origin/main:src/components/Apps/AppStoreSourceManagement.vue | sed -n '85,96p'
# confirms line 92 still has the awesome.casaos.io redirectURL() call

$ git merge-base HEAD master   # in the New-UI worktree
6f8f74283f1ffb24dda5765997481f2dd9f7eb9e
```

**Vue2 repo commit**:
```
$ cd /home/nimo/NimoTech/NimoOS-UI
$ git add docs/vue3-migration-roadmap.md
$ git commit -m "docs(roadmap): open SP17 for the settings-area catch-up ..."
[docs/vue3-migration-sp3 9a3328ca] docs(roadmap): open SP17 for the settings-area catch-up
 1 file changed, 38 insertions(+)
```

**New-UI repo commit + oss/ before/after**:
```
$ pnpm exec vitest run oss/     # dirty tree, one untracked new .md file
[oss] 失败:...工作树不干净,导出中止: ?? docs/superpowers/2026-08-09-sp17-outstanding.md
 Test Files  4 failed | 3 passed (7)
      Tests  3 failed | 73 passed | 70 skipped (146)
```
(Expected — this is the documented dirty-tree-guard false negative, not a real leak.)

```
$ git add docs/superpowers/2026-08-09-sp17-outstanding.md
$ git commit -m "docs(sp17): record the outstanding acceptance steps"
[sp17-settings-catchup 45be595] docs(sp17): record the outstanding acceptance steps
 1 file changed, 83 insertions(+)

$ pnpm exec vitest run oss/     # clean tree, post-commit
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

Also traced *why* the new doc (which repeats "相册"/`photos_data` many times) doesn't
trip the OSS leak guard: `oss/manifest.mjs`'s `DELETE` list removes `docs` and
`.superpowers` from the exported tree wholesale (lines ~61 and ~66), so neither
directory is ever scanned by the word-list guard — confirmed by reading those lines
directly rather than just trusting the green result.

## Files changed

- `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` — new `### SP17` section
  inserted (38 lines), commit `9a3328ca`.
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp17-settings-catchup/docs/superpowers/2026-08-09-sp17-outstanding.md`
  — new file (83 lines), commit `45be595`.

No other files touched in either repo. No product code changed, matching the task's
"documentation only" framing.

## Self-review

- **Every claim has evidence beside it**: each of the six "not applicable" bullets in
  both documents carries its file:line or probe command/result inline, not just an
  assertion. Re-checked each one against the actual file content this session (not just
  trusted from the brief) for `TerminalPanel.vue`, `importNormalize.ts`, and the Vue2
  `AppStoreSourceManagement.vue:92` line — all three matched exactly.
- **No overstated status**: both documents say, in the header and again near the gate
  results, "未合并 master、未部署、未推 origin、未做真机验收" — nothing claims
  deployment, push, or real-machine sign-off. The acceptance checklist is phrased as
  steps to perform, not as a record of results ("应该出现" / "应" throughout, not "已验
  证").
- **Numbers are real, not copied blind**: I reran `pnpm test`, `vue-tsc`, `vitest run
  oss/`, and `pnpm build` myself in this session on the clean `b0f7233` tree before
  writing either document, rather than trusting Task 4's report numbers. They matched
  Task 4's final numbers exactly (675/10943, 0 errors, 146/146, build success), which is
  itself a useful cross-check that nothing drifted between Task 4's close-out and now.
- **Checklist is self-contained**: reread the 8 acceptance steps pretending to have no
  context — each step names the exact URL/port, what UI element to find, what "pass"
  looks like, and (for the two destructive-risk steps: migration browse, KVM-hide) an
  explicit warning not to complete the destructive action. Added a "restore state"
  sub-step after the KVM-block test that the brief's terser version didn't spell out
  (un-block the request, confirm the tile does *not* silently reappear on its own, then
  how to bring it back via Add Apps) since a reader following the brief's shorter
  version might not realize the tile removal is permanent-until-re-added.
- **Coordinates cross-checked, not assumed**: verified `master@6f8f742` is the actual
  `git merge-base` between this branch and `master`, rather than repeating the number
  given in the task context uncritically.
- **Caught and fixed my own mistake before it became a problem**: wrote the outstanding
  doc to the wrong repo checkout on the first attempt (main repo instead of worktree).
  Caught via `git status --short` immediately after, before any commit happened in the
  wrong place, so no cleanup commit was needed anywhere — just deleted the stray
  untracked file.

## Concerns

None. Both commits are local-only (no push, as instructed — the constraints only asked
for commits, not pushes), both repos' working trees are clean, and the `oss/` suite is
green on the clean tree in the New-UI repo. The Vue2 repo has no `oss/`-equivalent gate
to run (it's the source repo being migrated *from*, not the one under the leak-guard
regime), so nothing further was owed there beyond the commit itself.

---

## Fix round: code review response (Important ×2)

Review came back with two Important findings, both confined to
`docs/superpowers/2026-08-09-sp17-outstanding.md` in this repo. No change was needed in
the Vue2 roadmap — confirmed it doesn't repeat either mistake (see below).

### Important 1 — wrong-repo cross-reference

Line 77 (in the "已知遗留" section) said "详见 New-UI `docs/vue3-migration-roadmap.md`
SP13 节" — but that roadmap file only exists in the Vue2 repo (`NimoOS-UI`); a `find`
over New-UI turns up nothing. The same document's line 8 correctly attributes the
roadmap to `NimoOS-UI`, so this was an internal inconsistency, not just a wrong fact.

**Checked whether the Vue2 roadmap repeats this**: it doesn't — `docs/vue3-migration-roadmap.md`
is the file itself, so its own internal references to "New-UI" (e.g. line 1163's "改这里不会影响 New-UI")
are correctly pointing *outward* at the other repo, not misnaming its own location. No
edit needed there, matching the coordinator's expectation.

**Fix**: reworded line 77 to name the correct repo and add the exact line number the
reviewer supplied:
```
- **全仓 37 个源文件 / 54 处注释仍把共享包指路到 `NimoOS-Service/src/*.ts`**(SP13 遗留的票②,
  本期未碰,详见 `NimoOS-UI` 仓(Vue2)`docs/vue3-migration-roadmap.md:1185` 的 SP13 节
  「票②」——**不是本仓**,New-UI 这个仓里没有这份 roadmap 文件)。
```
Verified `NimoOS-UI/docs/vue3-migration-roadmap.md:1185` really is 票② with
`sed -n '1182,1186p'` before writing the line number into the doc, rather than trusting
the reviewer's citation blind.

### Important 2 — KVM tile disappearance timing undercounted

Step 8 said "等待约 45 秒" for the tile to disappear after blocking `/v1/kvm/settings`.
Traced the actual mechanism instead of trusting the original brief's number:

- `src/views/Home.vue:95` — `loadServerSeen().finally(() => refreshApps())` runs once at
  mount (t=0). This is the call that first notices `vm` is missing and, via
  `sweepGone()`, records `missingSince = 0` for it (it doesn't remove anything yet since
  `now - since` is `0 < 45000`).
- `src/views/Home.vue:96` — `pollTimer = setInterval(() => { ... refreshApps() }, 30_000)`
  — polls every **30s**, not continuously.
- `src/home/stores/layout.ts:133` — `MISSING_GRACE_MS = 45_000`, checked only at
  `sweepGone()` call sites, i.e. only on each 30s poll tick (line 209:
  `if (now - since >= MISSING_GRACE_MS) gone.add(it.key)`).

Walking the ticks: t=0 sets `missingSince=0`; t=30s poll checks `30000 < 45000` → not
yet gone; t=60s poll checks `60000 >= 45000` → gone. So the tile is guaranteed to still
be present at the 45s mark someone following the old instructions would stop at, and
only disappears at the **next** tick, ~60s in. The old wording would make a correctly
working feature look broken to anyone timing it literally at 45s.

**Fix**: rewrote step 8 to say "等待约 1 分钟", explain the mechanism inline (mount-time
call sets t=0, 30s poll interval, 45s grace only evaluated per-tick, so it lands on the
t=60s tick), and kept the explicit instruction not to conclude "broken" early — matching
the reviewer's preference for spelling out the mechanism rather than just bumping the
number silently.

### Commands run (foreground)

```
$ pwd
/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp17-settings-catchup

$ grep -n "refreshApps\|setInterval\|30000\|30_000\|sweepGone\|onMounted" src/views/Home.vue
70:let pollTimer: ReturnType<typeof setInterval> | null = null
76:function refreshApps() {
81:    layout.sweepGone(Object.keys(apps.apps))
85:onMounted(async () => {
95:  layout.loadServerSeen().finally(() => refreshApps())
96:  pollTimer = setInterval(() => { if (!document.hidden) refreshApps() }, 30_000)
...

$ grep -n "MISSING_GRACE_MS\|missingSince\|sweepGone" src/home/stores/layout.ts
133:  const MISSING_GRACE_MS = 45_000
...
209:        if (now - since >= MISSING_GRACE_MS) gone.add(it.key)
...

$ sed -n '1182,1186p' /home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md
# confirmed line 1185 is 票② with the exact NimoOS-Service/src/*.ts wording

$ git status --short
 M docs/superpowers/2026-08-09-sp17-outstanding.md

$ pnpm exec vitest run oss/     # dirty tree, before commit
[oss] 失败:...工作树不干净,导出中止: M docs/superpowers/2026-08-09-sp17-outstanding.md
 Test Files  4 failed | 3 passed (7)
      Tests  3 failed | 73 passed | 70 skipped (146)
# expected — the documented dirty-tree-guard false negative, not a real leak

$ git add docs/superpowers/2026-08-09-sp17-outstanding.md
$ git commit -m "fix(sp17): correct a repo pointer and the KVM tile timing in the outstanding doc ..."
[sp17-settings-catchup 6ee3699] fix(sp17): correct a repo pointer and the KVM tile timing in the outstanding doc
 1 file changed, 2 insertions(+), 2 deletions(-)

$ git status --short
(empty)

$ pnpm exec vitest run oss/     # clean tree, after commit
 Test Files  7 passed (7)
      Tests  146 passed (146)
```

### Files changed

- `docs/superpowers/2026-08-09-sp17-outstanding.md` — 2 lines changed (the repo pointer
  in the "已知遗留" section, and the KVM-tile timing paragraph in acceptance step 8).
  Commit `6ee3699`.
- No changes needed in the Vue2 repo (`NimoOS-UI`) — verified it does not repeat either
  mistake.

### Self-review

- Both fixes are traced to primary sources (the actual `Home.vue`/`layout.ts` line
  numbers, and the actual roadmap line number) rather than just rephrasing the
  reviewer's claims — re-derived the t=0/30s/60s tick timeline myself from the two files
  before writing the new wording, rather than copying the reviewer's numbers uncritically.
  They matched.
- Did not touch the Vue2 roadmap, per the coordinator's instruction that it only needed
  fixing "if it turns out to repeat the same mistake" — confirmed it doesn't, documented
  why (it's the file being referenced, not a copy of the reference).
- Ran `oss/` before and after the commit as instructed, both in the foreground, no
  background jobs used anywhere in this fix round.
- The Minor about `NimoOS/route/v1.go:106` vs `:107` was explicitly called out by the
  coordinator as already triaged and not mine to act on — left untouched.

### Concerns

None. Single-file fix, both Important findings addressed with primary-source
verification (not just trusting the review's assertions), `oss/` clean on the committed
tree, no push performed (commit-only, as instructed).
