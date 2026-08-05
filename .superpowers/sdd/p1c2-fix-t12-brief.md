# P1c2 T12 fix pass — 3 items (from sonnet review of `2e1562d..4c65cfc`)

Base = `4c65cfc` (HEAD of branch `sp8-ai`). Repo: `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`.

## File whitelist — touch ONLY these 4 files

```
src/ai/components/tabs/ResourcesTab.vue
src/ai/components/tabs/ResourcesTab.test.ts
src/i18n/zh_cn.ts
.superpowers/sdd/p1c2-task-12-report.md
```

**Shared-worktree rule:** never `git add -A` / `git add .`. Stage by explicit path only.
Do not touch `src/ai/styles/agent-styles.scss`, `tokens.scss`, `agentStore.ts`, `en_us.ts`, or any other file.

## Porting discipline (project-wide, user decision 2026-07-27)

UI/visual/interaction = strictly 1:1 with Vue2. Logic = do it correctly, but **any deviation from
Vue2 must be (a) commented in code citing the Vue2 line, (b) declared in the report.**
An undeclared deviation is itself a defect. No unrelated refactors/renames.

---

## F1 (Important) — 0-byte staged item: keep the correct behaviour, but DECLARE it

**Fact (verified by the coordinator, do not re-litigate):**
Vue2 `NimoOS-UI/src/views/AI/Agent/tabs/ResourcesTab.vue` renders staged-item size at **line 99**
(batch items) and **line 117** (loose items) as:

```
{{ it.size_bytes ? formatSize(it.size_bytes) : '—' }}
```

That template-level truthiness short-circuit means `size_bytes === 0` renders `—`, even though
Vue2's own `formatSize` (line ~205) starts with `if (!n && n !== 0) return '—'` — i.e. the function
deliberately maps `0 → '0 B'`. Vue2's **attachment** row (line 40) calls `formatSize(a.size_bytes)`
directly with no short-circuit, so a 0-byte *attachment* already shows `0 B` in Vue2 while a 0-byte
*staged item* shows `—`. Vue2 is self-inconsistent; the short-circuit defeats the function's stated intent.

Our `ResourcesTab.vue:233` / `:251` call `formatStagedSize(it.size_bytes)` directly → `0 B`.

**Coordinator's ruling: KEEP our behaviour (0 → `0 B`). Do NOT restore the Vue2 short-circuit.**
This is the same resolution as the T11 F1 `toStoragePayload` null-guard. What is missing is the
declaration. So:

1. Add a short code comment at the staged-item size render sites (`:233` and `:251`, one comment can
   cover both if they're adjacent enough — otherwise one each) in the style already used in this file
   for Vue2 citations. Content must state: Vue2 `ResourcesTab.vue:99`/`:117` short-circuits with
   `it.size_bytes ? … : '—'`, so a 0-byte staged file shows `—` there; we call `formatStagedSize`
   directly so it shows `0 B`, matching both `formatSize`'s own explicit `n !== 0` branch and Vue2's
   attachment row (`:40`). Deliberate deviation, logged.
2. Add a regression test in `ResourcesTab.test.ts` pinning it: a staged item with `size_bytes: 0`
   renders `0 B` (not `—`). Also assert an item with `size_bytes` **absent** still renders `—`, so the
   test distinguishes the two and can't pass vacuously.
3. Fix the report (`p1c2-task-12-report.md`): add this to the "Judgment calls / left alone" section as
   a **declared deviation**, worded so a reader sees it is a deliberate departure from Vue2, not parity.

## F2 (Important) — snapshot_missing test can't tell `.some()` from `.every()`

`ResourcesTab.test.ts:221-229` ("disables the whole-turn revert button when any item has
snapshot_missing") builds a group with a **single** item that has `snapshot_missing: true`. With one
element, `.some()` and `.every()` return the same thing, so the test cannot catch a future
`.some → .every` regression. The implementation (`ResourcesTab.vue:108`, `g.items.some(...)`) is
correct — this is purely a test-strength gap, brief said "任一项 snapshot_missing 则硬禁用".

Fix: give the group **two** items where only one has `snapshot_missing: true`, and assert the turn
revert button is still disabled. Keep (or add) a companion case where **no** item has it and the
button is enabled, so the pair is a real discriminator.

**Verify RED, don't assume:** temporarily edit `ResourcesTab.vue:108` `.some` → `.every`, run the test
file, confirm the new assertion FAILS, then revert that edit and confirm green again. Report both
outputs. (Revert is mandatory — the file is in the whitelist for the comment change only.)

## F3 (Minor) — `aiResSentTitle` zh wording

`src/i18n/zh_cn.ts:835` is `'已发送至模型，无法移除'`. Vue2's production translation for the same
string is `NimoOS-UI/src/assets/lang/zh_CN.json:1314` → `"已发送给模型，无法移除"` (至 → 给).
Change ours to match Vue2's existing translation verbatim. **zh only — `en_us.ts` is already correct
and must not be touched.**

---

## Gates before commit

```
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm exec vitest run src/ai/components/tabs/ResourcesTab.test.ts src/ai/util/stagedGroups.test.ts src/i18n/
pnpm test -- src/ai/ src/i18n/
pnpm exec vue-tsc --noEmit
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/ai/components/tabs/ResourcesTab.vue   # only comment lines allowed
```

Then `git status --short` (confirm nothing outside the whitelist is staged), stage the 4 files by
explicit path, and commit:

`SP8-P1c2 fix: declare 0-byte staged size deviation, strengthen snapshot_missing test, zh wording`

Finally `git show --stat HEAD` and paste it in your report.

## Report

Write `.superpowers/sdd/p1c2-fix-t12-report.md` — per-fix: what changed, file:line, the RED/GREEN
evidence for F2, real command output tails (not paraphrases), and `git show --stat HEAD`.
