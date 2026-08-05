# Task 1 report — strangler.js migratedEntries + resolveEntryTarget

Repo: `/home/nimo/NimoTech/NimoOS-UI`, branch `docs/vue3-migration-sp3`.
Commit: `5e978628e0e7cb12ec76e6f1ea581f4ec50e1e69`

## Step 1/2 — failing test (before implementation)

Appended the `describe('无路由绞杀点 migratedEntries(SP6-P6 存储区 cutover)', ...)` block
verbatim from the brief to `src/router/__tests__/strangler.spec.js`, and updated the top
import to include `migratedEntries, resolveEntryTarget`.

```
pnpm vitest run src/router/__tests__/strangler.spec.js
```

Result: **6 failed | 10 passed (16)** — all failures `TypeError: resolveEntryTarget is not
a function` (and one `migratedEntries` import producing `undefined`), as expected since
neither export existed yet.

## Step 3/4 — implementation, passing

Appended to the end of `src/router/strangler.js` (tab-indented, matching existing file
style), reusing the existing private `flagKey` and `resolveStorage` helpers unchanged:

- `export const migratedEntries` — array with one entry:
  `{ from: '/storage', to: '/app/#/storage', enabled: true }`
- `export function resolveEntryTarget(from, storage)` — looks up the entry, returns `null`
  if not registered or `enabled === false`; otherwise checks
  `localStorage['strangler:disabled:<from>'] === '1'` and returns `null` on rollback,
  else returns `entry.to`.

No existing line of `migratedRoutes` / `isEnabled` / `resolveTarget` / `matches` was
touched.

```
pnpm vitest run src/router/__tests__/strangler.spec.js
```

Result: **16 passed (16)**.

## Step 5 — mutation verification

**Mutation A** — changed `=== '1'` to `=== 'x'` in the rollback-flag check inside
`resolveEntryTarget`. Re-ran the spec:

```
Tests  1 failed | 15 passed (16)
```

The single test that went red was exactly the intended one:
`回退 flag strangler:disabled:/storage === "1" 时返回 null(调用处走老弹窗)`
— `AssertionError: expected '/app/#/storage' to be null`. Reverted the mutation; re-ran →
16/16 passed again.

**Mutation B** — removed the `|| !entry.enabled` clause from
`if (!entry || !entry.enabled) return null` (left just `if (!entry) return null`).
Re-ran the spec:

```
Tests  16 passed (16)
```

No test went red. This is the expected outcome per the brief: `migratedEntries` currently
has only one entry with `enabled: true`, so there is no fixture in the table that exercises
the `enabled === false` branch, and per YAGNI the brief explicitly says not to add one.
Restored the guard afterward; final re-run confirmed 16/16 passing again.

## Step 6 — commit

```
git add src/router/strangler.js src/router/__tests__/strangler.spec.js
git commit -m "feat(strangler): 加无路由绞杀点表 migratedEntries + resolveEntryTarget ..."
```

Commit hash: `5e978628e0e7cb12ec76e6f1ea581f4ec50e1e69` (2 files changed, 60 insertions(+),
1 deletion(-) — the 1 deletion is the import-line rewrite in the spec file top).

Only the two files named in the brief were staged/committed; other pre-existing
uncommitted/untracked files in the working tree (unrelated docs/plans) were left
untouched.

## Notes / concerns

- Did not run the full `pnpm test` suite for this task per the given baseline instructions
  (1425 passing / 8 pre-existing unrelated failures) — only the targeted spec file was run,
  at each of the required checkpoints (failing, passing, mutation A, mutation B, final).
- No unrelated refactoring, renaming, or reformatting was done to `strangler.js` or the
  spec file beyond the brief's appended blocks and the single import-line update.
