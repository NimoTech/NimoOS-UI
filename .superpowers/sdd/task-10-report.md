# Task 10 Report — DropPage.vue + DropCenter.vue + DropAddButton.vue (SP4-P7 Drop)

> Note: this filename previously held an unrelated stray report ("AddPanel 应用小组件 +
> AppTile 停止态变暗") from an earlier task-numbering scheme that collided with this one.
> That content is superseded below — this is the correct Task 10 report for the SP4-P7
> "Drop" feature per `.superpowers/sdd/task-10-brief.md`.

## Status: DONE

## Files created
- `src/files/drop/components/DropPage.vue`
- `src/files/drop/components/DropCenter.vue`
- `src/files/drop/components/DropAddButton.vue`
- `src/files/drop/components/DropPage.test.ts`

## Commit
`8cdb879` — "feat(drop): DropPage 雷达布局+窄屏流式+CSS 脉冲背景+局域网地址"
(4 files changed, 204 insertions(+), no deletions — nothing else in the tree was touched)

## TDD flow
1. Wrote `DropPage.test.ts` exactly as given in the brief (Step 1) — both test cases
   verbatim (mount→init/unmount→destroy spy check; peers render with self-marking + DropItem
   count).
2. Ran `pnpm vitest run src/files/drop/components/DropPage.test.ts` — **failed** as expected
   (`Failed to resolve import "./DropPage.vue"` — file didn't exist yet). This confirms the
   test module itself loads and only the missing implementation blocks it.
3. Implemented the three components per the brief's Step 3 snippets, with two small,
   deliberate deltas (below) verified against sibling code before applying.
4. Re-ran the same test file — **passed on the first attempt**, 2/2. No jsdom shims or
   test-file adjustments were needed. In particular, the brief's own uncertainty about
   `w.findAllComponents({ name: 'DropItem' })` matching a `<script setup>` SFC turned out to
   be a non-issue in this stack (Vue 3.4 + `@vitejs/plugin-vue` + `@vue/test-utils` v2
   resolve component matching against the compiler-inferred `__name`, which equals the
   filename `DropItem`).
5. Full suite: `pnpm test` → **165 test files / 773 tests, all passed**.
6. Typecheck: `pnpm exec vue-tsc --noEmit` → clean, no output.

## Deltas from the brief's literal snippets

1. **`.files-layout` class defined locally in `DropPage.vue`'s scoped style.** Per the
   brief's own instruction, I read `src/files/shares/SharesPage.vue` first and confirmed
   `.files-layout` is a **scoped**, page-local class there (`display: flex; gap: 16px;
   align-items: flex-start; min-height: 100%;`), not a global utility class anywhere in
   `src/styles/theme.css` or elsewhere. So `DropPage.vue` defines the identical rule in its
   own scoped `<style>` block (verbatim copy of SharesPage's definition, token-based, no
   literal colors) rather than assuming a global class exists.

2. **Dropped a redundant local `@keyframes itemIn` from `DropAddButton.vue`.** I initially
   added one to back `.drop-add-pop`'s `animation: itemIn 0.2s ease both;`, then checked
   `src/styles/theme.css` and found `itemIn` is already defined **globally** (line 321:
   `@keyframes itemIn { from { opacity: 0; transform: translateY(10px) scale(.97); } }`,
   also relied on unchanged by the existing `ReceivePrompt.vue` from Task 9). Removed the
   duplicate so `DropAddButton.vue` uses the global keyframe as-is. Only the brief's *new*
   `dropPulse` keyframe (used for the CSS pulse-ring background in `DropPage.vue`) needed a
   component-scoped definition — confirmed no name clash with any existing keyframe in
   `theme.css` or other drop components before adding it.

No other changes were made to the brief's code — `DropCenter.vue`, the rest of
`DropAddButton.vue`, and the rest of `DropPage.vue` are verbatim from the brief.

## Verification of integration points
- `FilesShell`/`FilesSidebar` import paths (`../../components/FilesShell.vue` from
  `src/files/drop/components/`) resolve correctly to `src/files/components/FilesShell.vue` —
  confirmed these files exist; usage pattern (bare `<FilesShell>` wrapper with default slot,
  no-prop `<FilesSidebar />`) matches `SharesPage.vue`. `DropPage` doesn't listen for
  `@navigate` on `FilesSidebar` since Drop has no folder-navigation concept — consistent with
  the test's `FilesSidebar: true` shallow stub.
- `useDropStore` public API (`peers`, `selfId`, `transfers`, `init`, `destroy`, `sendFiles`)
  matches what `DropPage.vue` consumes — verified directly against
  `src/files/drop/stores/drop.ts`.
- `dropLayout.ts` exports `contentsBox(areaW, areaH)`, `positionFor(index, radius, center)`,
  `DISPLAY_ORDER` with exactly the signatures `DropPage.vue` calls — verified against
  `src/files/drop/dropLayout.ts`.
- `dropIcons.ts` exports `dropAsset('add_btn' | 'drop_icon')` — verified against
  `src/files/drop/dropIcons.ts`.
- `DropItem.vue` props (`device`, `isSelf`, `isFloat`, `position`, `transfer`) and its
  `select-files` emit — verified against `src/files/drop/components/DropItem.vue`, matches
  `DropPage.vue`'s usage exactly.
- `ReceivePrompt.vue` takes no props (reads the store directly) — mounted with no bindings,
  matching `src/files/drop/components/ReceivePrompt.vue`.
- i18n keys used (`filesDropTitle`, `filesDropHint`, `filesDropLanTitle`,
  `filesDropLanHint`) already existed in both `zh_cn.ts` and `en_us.ts` from an earlier
  task — no new keys, no `i18n/parity.test.ts` risk.
- Theming: grepped all three new component files for hex/`rgb(`/`rgba(`/named-color
  literals — none found; every color is a `var(--…)` token per the repo's hard theming
  rule (`--fg`, `--fg-muted`, `--card-bg`, `--card-border`, `--popup-bg`, `--accent`, plus
  the shared `--radius` fallback pattern already used elsewhere in the drop components).

## Test summary
`pnpm test`: 165 test files, 773 tests, all passed (includes the 2 new `DropPage.test.ts`
cases). `pnpm exec vue-tsc --noEmit`: clean.

## Concerns
- None blocking. Minor forward-note for Task 11 (route registration): `DropAddButton.vue`'s
  LAN address is hardcoded to `${window.location.origin}/app/#/files/drop` per spec §6,
  deliberately not derived from the router. If Task 11 registers the Drop route under a
  different path than `/files/drop`, that literal will need to be updated to match.

---

## Post-review fix: DropPage @navigate listener (2026-07-18)

### Issue
DropPage.vue rendered `<FilesSidebar />` with no `@navigate` listener; clicking disk/favorite/mount
in the sidebar silently did nothing, unlike SharesPage.vue which wired `@navigate="goVirtual"`.

### Fix applied
- Added `import { useRouter } from 'vue-router'` and `import { virtualPathToRouteParam } from
  '../../util/pathUtils'`.
- Defined `function goVirtual(virtualPath: string) { router.push('/files/' +
  virtualPathToRouteParam(virtualPath)) }` (verbatim from SharesPage.vue).
- Updated `<FilesSidebar />` → `<FilesSidebar @navigate="goVirtual" />`.
- Added one test to `DropPage.test.ts`: custom FilesSidebar stub that emits navigate event;
  click triggers emit('navigate', 'TestDisk/docs'); assert router.currentRoute.path ===
  '/files/TestDisk/docs'.

### Verification
- `pnpm vitest run src/files/drop/components/DropPage.test.ts`: 3/3 tests passed (1 new).
- `pnpm test`: 165 files, 774 tests, all passed.
- `pnpm exec vue-tsc --noEmit`: clean.

### Commit
`c75d89b` — "fix(drop): DropPage 侧栏接 @navigate 跳转文件区(评审发现,对齐 SharesPage)"
