# Task 7 报告:接进 RAID 详情页 + 收尾门

## 结论

Status: DONE. 接线完成,收尾门五项全过,已提交一条 commit。

## TDD 证据

### RED

在 `StorageRaidDetail.test.ts` 顶部 `vi.mock('@nimotech/nimoos-service', …)` 工厂里补齐 `snapshot` 域(`listVolumes`/`list`/`getPolicy`/`patchPolicy`/`togglePolicy`/`create`/`remove`,均具名转发或直接 `vi.fn()`),并追加 brief Step 1 给的两条用例。此时 `StorageRaidDetail.vue` 仍是占位注释,跑:

```
pnpm exec vitest run src/views/StorageRaidDetail.test.ts
```
结果:`Tests 2 failed | 4 passed (6)`
- `左栏挂载快照面板…` → `expected false to be true`(`findComponent({ name: 'SnapshotPanel' })` 找不到)
- `快照端点 404 → …` → `expected false to be true`(`.sp-unsupported` 找不到)

符合预期(面板尚未接线)。

### GREEN(第一轮,发现真 bug)

按 brief 把占位注释换成 `<SnapshotPanel :volume-uuid="array.uuid ?? ''" />` 后重跑,仍有 1 个失败:

```
FAIL … 左栏挂载快照面板,并按本阵列 uuid 查卷
Error: Cannot call attributes on an empty DOMWrapper.
 (w.find('.sp-switch').attributes(...))
```

**根因排查**(systematic-debugging):`SnapshotPanel.vue` 的 `onMounted(() => store.loadVolume(props.volumeUuid))` 只在挂载那一刻读一次 `volumeUuid`,无 `watch(() => props.volumeUuid, …)`。而 Vue 3 生命周期钩子执行顺序是**子先于父**——`SnapshotPanel` 作为 `StorageRaidDetail` 的子组件,其 `onMounted` 会先于 `StorageRaidDetail` 自己的 `onMounted`(即 `store.loadRaid().then(() => store.loadRaidDetail(...))`)执行。也就是说:组件初次渲染时 `detail` 还是 `null`,`array` 取 `fallbackArray`,`array.uuid` 是 `''`;`SnapshotPanel` 挂载时用这个 `''` 去 `loadVolume`,之后再也不会重新拉取——即便 `array.uuid` 随后异步变成真实值 `'u-7'`,面板已经"错过"了。

对照 Vue2 源(`NimoOS-UI/src/components/Storage/raid/RaidTab.vue:43` `v-if="viewMode === 'detail' && selectedRaid"`):Vue2 里 `RaidDetailPanel`(内含 `snapshot-panel`)本来就只在 `selectedRaid` **已经加载完成**之后才会被创建,所以 Vue2 从未出现这个竞态。New-UI 的 `StorageRaidDetail.vue` 是路由页面,进入时立刻挂载并异步拉详情,原样照抄"无条件挂载"就会引入 Vue2 没有的 bug。

**修复**(仍在接线范围内,未碰 `SnapshotPanel.vue`/`snapshot.ts`):给 `SnapshotPanel` 加 `v-if="detail"`(`detail` 是本文件已有的 `computed(() => store.raidDetail)`),即"阵列详情真正加载完才挂载面板",语义上对应 Vue2 的 `v-if="selectedRaid"` 前提。

再跑:

```
pnpm exec vitest run src/views/StorageRaidDetail.test.ts
```
结果:`Test Files 1 passed (1)` / `Tests 6 passed (6)`。

## 收尾门(Step 4,brief + 全局)

1. `pnpm test`
   ```
   Test Files  246 passed (246)
   Tests  1498 passed (1498)
   Duration  82.29s
   ```
2. `pnpm exec vue-tsc --noEmit` → 无输出,退出码 0(零错)。
3. `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts`
   ```
   Test Files  2 passed (2)
   Tests  124 passed (124)
   ```
4. `pnpm build` → 成功,`dist/index.html` 引用入口 `index-Cc3SeX-v.js`(`grep -o 'index-[A-Za-z0-9_-]*\.js' dist/index.html` → `index-Cc3SeX-v.js`)。构建有既存的 chunk 体积警告(`ExcelViewer`/主 index 等 >500kB),与本任务无关,历史遗留。
5. `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5273/app/` → `200`;`curl -s http://127.0.0.1:5273/app/ | grep -o 'index-[A-Za-z0-9_-]*\.js'` → `index-Cc3SeX-v.js`,与 dist 产物哈希一致,常驻预览无需重启。

## Files changed

- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/views/StorageRaidDetail.vue`
  - 新增 `import SnapshotPanel from '../storage/components/SnapshotPanel.vue'`
  - `:184` 占位注释 `<!-- 快照面板 P5 -->` → `<SnapshotPanel v-if="detail" :volume-uuid="array.uuid ?? ''" />`(附中文注释说明为何要 `v-if="detail"`)
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/views/StorageRaidDetail.test.ts`
  - `vi.mock('@nimotech/nimoos-service', …)` 工厂补 `snapshot` 域(`snapListVolumes`/`snapList` 具名转发 + 其余 5 个方法的裸 `vi.fn()`)
  - 追加两条用例(brief Step 1 原文,未改动断言)

## 移植纪律 / 全局约束自查

- 未改 `src/storage/util/snapshotView.ts`、`src/storage/stores/snapshot.ts`、`src/storage/components/Snapshot*.vue`、NimoOS-Service、node_modules。
- 未改详情页里与快照无关的部分(头部按钮、甜甜圈、级别信息、阵列信息表、成员列表、轮询逻辑均逐字保留)。
- 已有 4 条用例(含 P3/P4 的"写按钮不变式"用例)断言未削弱,`vi.clearAllMocks()` 前置行为未变。
- 未新增 i18n key(附录 A 的键全部在 T2-T6 已落地,本任务零新增)。
- 未写死颜色字面量;新增注释块无样式改动。
- 未跑 `./scripts/deploy.sh`,未写 `/var/lib/nimoos/www`,未碰 `NimoOS-UI` 仓,未改 roadmap,未合并分支。

## 偏离记录(唯一一处,已如实报告)

**在 brief 给定的一行接线之外多加了 `v-if="detail"`。** 原因:brief 假设"把占位换成 `<SnapshotPanel :volume-uuid="array.uuid ?? ''" />`"就够,但按此实现时,brief 自带的第一条测试用例(`左栏挂载快照面板…`)在真实接线后仍然 FAIL——根因是 Vue 3 子组件 `onMounted` 先于父组件执行,`SnapshotPanel` 会在 `array.uuid` 还是占位空串时完成首次(也是唯一一次)`loadVolume` 调用,之后不会因为 `array.uuid` 变为真实值而重新加载。这不是测试环境的偶然时序,而是任何真实浏览器访问该路由页面时都会发生的结构性时序(初次渲染同步完成,`loadRaid/loadRaidDetail` 是随后才 resolve 的异步链)。Vue2 源码(`RaidTab.vue:43`)从未暴露这个问题,是因为它用 `v-if="selectedRaid"` 保证了 `RaidDetailPanel`(内含旧版 snapshot-panel)只在阵列数据已加载完成后才创建。为在不碰 `SnapshotPanel.vue`(全局禁改文件)的前提下达到同等前提,给这行接线加了 `v-if="detail"`(`detail` 是本文件已有的 computed,无新增状态)。此举仍属于"接线"范畴——只影响这一行何时挂载,不改变 `SnapshotPanel`/`store` 内部任何行为——但为如实起见单独列出,供终审确认是否需要改用其他等价写法(如改 `SnapshotPanel` 内部加 prop watcher,但那会违反"不得修改 Snapshot*.vue"的硬约束,故未选)。

## Commit

```
e32e74e feat(storage): RAID 详情页挂载快照面板(P5 T7)
```
