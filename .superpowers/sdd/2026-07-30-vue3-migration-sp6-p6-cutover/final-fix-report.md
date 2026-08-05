# SP6-P6 whole-branch review — fix wave (Findings 1 & 2, test-side only)

Repo: `/home/nimo/NimoTech/NimoOS-UI`, branch `docs/vue3-migration-sp3`.
Scope: exactly Finding 1 and Finding 2 from the "Ready to deploy" review. Test files only, no production code touched.

## What was added, per file

### `src/widgets/__tests__/Disks.spec.js`
- Imported `StorageManagerPanel` from `@/components/Storage/StorageManagerPanel.vue` (the file is already `vi.mock`'d at the top of this spec, so the SFC's import and the spec's import resolve to the same stub object — no new mock needed).
- In the rollback test (`回退 flag == "1" 时开老弹窗,不跳转`):
  - Added `expect(vm.$buefy.modal.open.mock.calls[0][0].component).toBe(StorageManagerPanel)` — Finding 2.
  - Added `expect(vm.$messageBus).toHaveBeenCalledWith('widget_storagemanager')` — Finding 1.

### `src/components/filebrowser/components/__tests__/MountActionButton.spec.js`
- Same import of `StorageManagerPanel` (also already `vi.mock`'d here).
- In the rollback test: added `expect(vm.$buefy.modal.open.mock.calls[0][0].component).toBe(StorageManagerPanel)` — Finding 2.
- Finding 1 does not apply to this file (this call site has no `$messageBus` telemetry at all — the spec's own comment already notes this and that is unchanged/correct).

### `src/views/__tests__/Home.storageCutover.spec.js`
- No new import needed (Home passes a lazy loader, not a static import).
- In the rollback test: added `expect(typeof vm.$buefy.modal.open.mock.calls[0][0].component).toBe('function')` — Finding 2, shape-level only.
  - I attempted the stronger form (invoke `component()` and assert it resolves to a module) in a throwaway probe test (`src/views/__tests__/__zzprobe.spec.js`, created and deleted, never committed). Invoking the lazy loader under vitest triggers a real dynamic import of `StorageManagerPanel.vue`'s full dependency chain (DriveItem/StorageItem/RaidStorageItem/cToolTip etc.), which — same root cause documented in the existing `Disks.spec.js`/`MountActionButton.spec.js` header comments — eventually hits `require('@/assets/background/wallpaper01.jpg')` in `src/store/state.js` and crashes at module-load time with `Error: Cannot find module '@/assets/background/wallpaper01.jpg'`. This is unrelated to the review findings and out of scope to fix, so I kept the assertion at "is a function" only, as the task instructions permitted.
  - Finding 1 was already satisfied for this file before this change (`Home.storageCutover.spec.js` already asserted `$messageBus` in its rollback test) — left as-is, no duplicate assertion added there beyond what the task specified.

## Mutation verification (verbatim)

**Finding 1 mutation** — moved `this.$messageBus('widget_storagemanager');` in `src/widgets/Disks.vue` from before `resolveEntryTarget` to inside the `if (target) { ... }` block, then ran `Disks.spec.js`:

```
FAIL  src/widgets/__tests__/Disks.spec.js > Disks 小组件存储入口 cutover(SP6-P6) > 回退 flag == "1" 时开老弹窗,不跳转
AssertionError: expected "vi.fn()" to be called with arguments: [ 'widget_storagemanager' ]
Number of calls: 0
 ❯ src/widgets/__tests__/Disks.spec.js:60:28
Tests  1 failed | 2 passed (3)
```

New assertion turned red as expected. Reverted with `git checkout -- src/widgets/Disks.vue`; confirmed `git diff src/widgets/Disks.vue` produces 0 lines (clean).

**Finding 2 mutation** — changed `component: StorageManagerPanel` to `component: NewNetworkStorage` in `src/components/filebrowser/components/MountActionButton.vue`'s `showDiskManagement()`, then ran `MountActionButton.spec.js`:

```
FAIL  src/components/filebrowser/components/__tests__/MountActionButton.spec.js > 文件区挂载按钮存储入口 cutover(SP6-P6) > 回退 flag == "1" 时开老弹窗,不跳转
AssertionError: expected { name: 'NewNetworkStorageStub', … } to be { name: 'StorageManagerPanelStub', … } // Object.is equality
Tests  1 failed | 1 passed (2)
```

New assertion turned red as expected. Reverted with `git checkout -- src/components/filebrowser/components/MountActionButton.vue`; confirmed `git diff` on that file produces 0 lines (clean).

## Proof both production files were restored

```
$ git diff --stat src/widgets/Disks.vue src/components/filebrowser/components/MountActionButton.vue src/views/Home.vue src/router/strangler.js
(no output — empty diff on all four)
```

## Target-spec run (post-fix, production files clean)

```
Test Files  3 passed (3)
     Tests  8 passed (8)
```
(`src/widgets/__tests__/Disks.spec.js`, `src/views/__tests__/Home.storageCutover.spec.js`, `src/components/filebrowser/components/__tests__/MountActionButton.spec.js`)

## Full-suite numbers

Baseline (before this change): 1440 passed / 8 failed (1448 total).
After this change: **1440 passed / 8 failed (1448 total)** — unchanged, because this fix wave strengthened assertions inside existing `it` blocks rather than adding new ones, so the test count didn't grow.

Failing files/tests are exactly the pre-existing 8, same two files, no new failures introduced:
```
FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 有任务时收起态显示小图标 + 「X 个后台任务」文字,不显示总百分比/任何明细/进度条
FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 收起态 > 任务数文字反映当前任务条数
FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 展开后才出现按类型明细与进度条
FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 不同类型各渲染一条独立进度,标签正确
FAIL  tests/nimoTaskBar.test.js > NimoTaskBar 展开态:按类型分开显示 > 某类型有错误时该类型标记失败,并显示错误详情
FAIL  tests/settingsStore.test.js > createSettingsStore - factory + initial state > initial state has expected shape
FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus normalizes nested .running into booleans
FAIL  tests/settingsStore.test.js > createSettingsStore - policy + services actions > loadServicesStatus sets false on error
```

## Commit

`5c325a428f9a4555e96174041a715f716e69f9ec` on `docs/vue3-migration-sp3`:
```
test: strengthen storage-cutover rollback assertions (SP6-P6 review findings)
```
Staged explicitly via pathspec (no `git add -A`); unrelated modified/untracked `docs/` files from a concurrent session were left alone.
