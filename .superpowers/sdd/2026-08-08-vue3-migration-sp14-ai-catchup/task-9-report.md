# Task 9 report: Knowledge desktop tile

Commit: `d4d3771077ad698d80d19b40ea0468b9534acc1f`

## TDD sequence

Failing test first:

```
pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/composables/useOpenAction.test.ts
```

Pre-implementation (RED) output:

```
FAIL src/home/apps/systemApps.test.ts > SYSTEM_APPS -- knowledge (SP14 #98) > knowledge is registered with an i18n label and an icon
AssertionError: expected undefined to be defined
  at systemApps.test.ts:7 (SYSTEM_APPS.find(...) returned undefined)

FAIL src/home/composables/useOpenAction.test.ts > AI 区 cutover(SP8-P6) > knowledge 磁贴走应用内路由 /ai/knowledge(SP14 #98,无回退目标)
AssertionError: expected "vi.fn()" to be called with arguments: [ '/ai/knowledge' ]
Number of calls: 0

Test Files  2 failed (2)
     Tests  2 failed | 29 passed (31)
```

After implementing `systemApps.ts`, `useOpenAction.ts`, `defaultLayout.ts`, `theme.css`, and the two
i18n base files:

```
pnpm exec vitest run src/home/apps/systemApps.test.ts src/home/composables/useOpenAction.test.ts
Test Files  2 passed (2)
     Tests  31 passed (31)
```

Wider sweep (as the brief's Step 6 specifies):

```
pnpm exec vitest run src/home/ src/i18n/parity.test.ts src/styles/color-guard.test.ts
Test Files  62 passed (62)
     Tests  1372 passed (1372)
```

(One transient failure — `DesktopContextMenu.test.ts > ... opens the wallpaper picker`, an
`empty DOMWrapper` error — showed up on one run. Verified pre-existing and unrelated: `git stash`
all my changes and re-ran that single file in isolation, same failure with none of my code present.
Re-ran the full sweep afterwards and it passed clean; treating it as flaky, not a regression.)

Type-check:

```
pnpm exec vue-tsc --noEmit
```
No output — clean.

## 1. Grid cell analysis

The brief flagged its own suggested coordinates (`c:3,r:1` and `c:11,r:6`) as possibly colliding, and asked
me to map the 19 existing `DEFAULT` items' occupied rectangles by hand before picking a cell. I wrote a
small script (`gridcheck.mjs`, scratch file, not committed) that expands every item's `{c,r,w,h}` into its
occupied `(col,row)` cells on the 12x8 grid and prints the grid. Result (`.` = free):

```
r1 clo clo sto sto sto sto .   .   .   .   fil pho
r2 clo clo sto sto sto sto .   .   .   .   ai  set
r3 ai  ai  ai  ai  cpu cpu cpu cpu eve eve Gal Doc
r4 ai  ai  ai  ai  cpu cpu cpu cpu eve eve p0  p0
r5 ai  ai  ai  ai  net net net net eve eve p0  p0
r6 ai  ai  ai  ai  net net net net eve eve app vm
r7 p3  p3  Dow Med net net net net p1  p1  gpu gpu
r8 p3  p3  .   .   net net net net p1  p1  gpu gpu
```

No pre-existing overlaps (the script logs `OVERLAP at c,r` on any collision; none fired). Free cells:
row1 c7-10, row2 c7-10, row8 c3-4 (10 cells total). The brief's own alternative suggestion of `c9,r6`
would in fact have collided — that cell is inside the `events` widget's `c9,r3,w2,h4` footprint (rows
3-6, not just row 3, which is easy to misread at a glance). I caught this myself while double-checking
row 6 before committing to a cell.

Picked **`c: 10, r: 2, w: 1, h: 1`** — directly adjacent to the existing `ai` app tile at `c11,r2`, so
Knowledge lands visually grouped with the other AI-area system app rather than in an arbitrary empty slot.

Test coverage: `src/home/grid/defaultLayout.test.ts`'s existing `'has no overlapping cells and stays
within 12x8'` test already builds a `Set` of every item's `cells()` (from `gridMath.ts`) and asserts no
key is inserted twice — this check is generic over the whole `DEFAULT` array, so it automatically covers
the new item and would catch a collision anywhere in the list, not just around my addition. No new test
was needed for this guard; I verified by construction (the script above) that it stays green, and the
full `src/home/` run above confirms it.

## 2. `cls: 'ic-knowledge'`

Added right after `.ic-ai` in `src/styles/theme.css`, matching the existing `.ic-*` brand-gradient block
(header comment at that block's top already documents the whole section as the "skin-independent, vivid
gradient" exception). Added an inline comment on the new rule specifically noting it matches the amber
gradient (`#D97706` -> `#FBBF24`) baked into `knowledge.svg`'s own `<linearGradient>`, so a future reader
sees both *that* it's sanctioned and *why* this particular palette was chosen. `color-guard.test.ts`
excludes `theme.css` entirely from its literal-color scan (it's the token-definition file), so this
didn't need a `theme-exception` marker to pass the guard — the block header comment is the existing,
established convention for this file, and the brief asked me to follow it, not invent a new one.

## 3. i18n key location

Found by searching for the sibling keys `appFiles` / `appAi` directly: they live in
`src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` (line ~221-227 in each), under a
`// -- Home: system app names --` section, NOT in the AI-area shards (`zh_cn.ai.ts` / `en_us.ai.ts`).
`zh_cn.ts` / `en_us.ts` are just merge-export shims (`{ ...base, ...photos, ...ai }`) — confirmed via
their file headers, which explain the SP7-P8b split (photos/ai text carved into separate shards so the
open-source export manifest can strip them; desktop text stays in `.base`). Added `appKnowledge` in both
`.base.ts` files immediately after `appAi`, mirroring the same insertion order used in `SYSTEM_APPS`
(`ai` then `knowledge` then `vm`). `src/i18n/parity.test.ts` imports the merged `zh_cn`/`en_us` exports, so
it picked up both new keys automatically; ran clean in the sweep above.

## Other notes

- **Icon source discrepancy**: the brief's `cp` command pointed at
  `/home/nimo/NimoTech/NimoOS-UI/src/assets/img/app/knowledge.svg`, but that file does not exist in the
  currently-checked-out branch of `NimoOS-UI` (`docs/vue3-migration-sp3`, which is 68 commits behind
  `main`). Dispatched a research agent to confirm: the icon was added on `main` by Vue2 PR/commit
  `fe8dbdd2` ("feat(home): Knowledge as a built-in home-screen app (#98)"), alongside
  `src/components/Apps/builtInApps.js` registering it as a real top-level desktop tile (id `'8'`,
  opens in a new tab). Pulled the file content via `git show main:src/assets/img/app/knowledge.svg`
  instead of a filesystem `cp`. It carries hard-coded amber colors (`#D97706`/`#FBBF24`/`#B45309`) in its
  gradient/text-line strokes — expected and left as-is, same treatment as `ai.svg`/`files.svg` (artwork,
  not a themed UI surface).
- **Reachability verified**: confirmed by reading source, not just asserting — `AddPanel.vue:56`
  (`v-for="key in appsStore.order"`) and `useDock.ts` (`moreKeys.value = apps.order.filter(...)`) both
  derive their lists from `apps.order`, which `useAppsStore` seeds from `SYSTEM_APPS` via `setApps([])`
  at store construction time (eager, not lazy). So the `systemApps.ts` entry alone makes Knowledge
  reachable for existing users through both the Dock's "more" list and the AddPanel's app tab, without
  needing anything from `defaultLayout.ts`. I verified this by code inspection of both consumers rather
  than by running the actual UI.
- No existing test asserted an exact `DEFAULT` item count or exact `SYSTEM_APPS` list, so nothing needed
  updating for that reason.
- Comments landed in this task's new/touched code are in English per the instruction (the two-line
  comment on the `knowledge` branch in `useOpenAction.ts`, the grid-cell provenance comment in
  `defaultLayout.ts`, and the `.ic-knowledge` gradient comment in `theme.css`). Pre-existing Chinese
  comments elsewhere in the touched files (e.g. `useOpenAction.ts`'s `SYS_ROUTE`/`cutoverDisabled` header
  blocks) were left as-is, per CLAUDE.md's carve-out that legacy Chinese comments get translated only when
  the code they annotate is itself being changed — I didn't touch that logic.
