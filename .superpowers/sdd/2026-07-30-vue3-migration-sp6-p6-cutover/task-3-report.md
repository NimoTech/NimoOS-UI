# Task 3 报告:Vue2 磁盘小组件 + 文件区挂载按钮改跳(SP6-P6)

Repo: `/home/nimo/NimoTech/NimoOS-UI`,分支 `docs/vue3-migration-sp3`。
Commit: `2e6858fb`

## Step 1-2:先写失败测试

新建两个 spec 文件(与 brief 逐字一致,另加了 `vi.mock` stub —— 见下"Task 2 同款坑"):
- `src/widgets/__tests__/Disks.spec.js`
- `src/components/filebrowser/components/__tests__/MountActionButton.spec.js`

**Task 2 同款坑**:两个组件顶部静态 `import StorageManagerPanel from '@/components/Storage/StorageManagerPanel.vue'`
(MountActionButton 还多 import `NewNetworkStorage.vue`/`GoogleDriveAuthModal.vue`),其依赖链最终
`require()` 一张 wallpaper 图片资源,vitest/Vite resolver 无法处理,导致仅仅
`import Disks from '@/widgets/Disks.vue'` 这一行本身就在模块加载期报错(与本改动无关):

```
Error: Cannot find module '@/assets/background/wallpaper01.jpg'
Require stack:
- /home/nimo/NimoTech/NimoOS-UI/src/store/state.js
```

处理方式与 Task 2 一致:在 spec 文件顶部用 `vi.mock` 把这三个 `.vue` 子组件顶替成空 stub(仅限
两个新 spec 文件内,未碰 `vitest.config.mjs` 或其它共享配置),并留了说明注释解释原因。

首次跑(实现前),确认按预期红:

```
FAIL Disks.spec.js > 未回退时整页跳 /app/#/storage,不开老弹窗
  expected [] to deeply equal [ '/app/#/storage' ]
FAIL MountActionButton.spec.js > 未回退时整页跳 /app/#/storage,不开老弹窗
  expected [] to deeply equal [ '/app/#/storage' ]
Test Files 2 failed | Tests 2 failed | 3 passed (5)
```

（"埋点仍然上报"和"回退开老弹窗"两条本就通过,因为老代码本来就恒开弹窗/恒调埋点 —— 与预期一致,只有"跳转"断言应红的两条真的红了。）

## Step 3-4:实现

`src/widgets/Disks.vue`:import 区加 `import { resolveEntryTarget } from '@/router/strangler'`;
`showDiskManagement()` 在 `this.$messageBus('widget_storagemanager');` 之后、`this.$buefy.modal.open({...}` 之前插入两行 cutover 判定,`$buefy.modal.open` 整块原样保留。

`src/components/filebrowser/components/MountActionButton.vue`:同样加 import,`showDiskManagement()`
里插入同样两行判定(**不加**埋点),弹窗块原样保留。

两处均为 Tab 缩进,与 brief 给的代码逐字一致(已用 `cat -A` 核对确实是 `^I` 制表符,非空格)。

## Step 5:测试确认通过 + 全量

两文件单独跑:

```
Test Files 2 passed (2)
Tests 5 passed (5)
```

全量:

```
Test Files 2 failed | 154 passed (156)
Tests 8 failed | 1440 passed (1448)
```

失败清单(逐一核对,与基线完全同名同条,无新增):
- `tests/nimoTaskBar.test.js` × 5(收起态 2 条 + 展开态 3 条)
- `tests/settingsStore.test.js` × 3(initial state shape / loadServicesStatus 正常化 / loadServicesStatus 出错兜底)

**与基线对比**:Task 0 记录基线是 1425 passed / 8 failed(合计 1433)。本次全量是 1440 passed / 8 failed
(合计 1448)。总用例数比基线多 15 条 —— 其中 5 条是本任务新增的两个 spec 文件,另外约 10 条来自
brief 提前说明的"并发会话"在同分支上的其它提交(`git log` 可见其间夹了
`5e978628 feat(strangler): 加无路由绞杀点表` 等提交,不是本任务改的)。**失败数量本身仍精确为 8,
且是同一批用例**,符合"不新增失败"的验收要求。

## Step 6:变异验证(逐条执行、逐条復原)

1. `Disks.vue` 把 `if (target) {` 改成 `if (false) {`,单跑 `Disks.spec.js`:
   第 1 条("未回退时整页跳…")变红(`expected [] to equal ['/app/#/storage']`),其余 2 条仍绿。改回,复跑变绿。
2. `MountActionButton.vue` 同样 `if (target) {` → `if (false) {`,单跑该 spec:
   第 1 条变红,同样报"跳转数组为空"。改回,复跑变绿。
3. `MountActionButton.vue` 把 `window.location.href = target` 临时改成
   `window.location.href = target + 's'`(即目标变成 `/app/#/storages`),单跑该 spec:
   第 1 条变红,报 `expected ['/app/#/storages'] to equal ['/app/#/storage']`
   —— 证明断言锁定的是逐字 URL,不是"随便跳了哪里"。改回,复跑变绿。

三条变异结束后,两 spec 单跑均恢复 5/5 全绿(见上 Step 5 数字,是变异复原后重新确认过的状态)。

## Step 7:提交

按 brief 精确暂存四个文件(未 `git add -A`,分支上并发会话留下的其它未跟踪/已改文档文件未被带入):

```
M  src/components/filebrowser/components/MountActionButton.vue
A  src/components/filebrowser/components/__tests__/MountActionButton.spec.js
M  src/widgets/Disks.vue
A  src/widgets/__tests__/Disks.spec.js
```

Commit: `2e6858fb feat(storage): 桌面磁盘小组件与文件区挂载按钮改跳 /app/#/storage(SP6-P6)`
(4 files changed, 126 insertions(+))

## 结论

三处 Vue2 存储入口(Home.vue 桌面主弹窗 = Task 2、Disks 小组件、文件区挂载下拉 = 本任务)已全部
改跳 `/app/#/storage`,老弹窗原样留作回退安全网,回退开关统一为
`localStorage['strangler:disabled:/storage'] === '1'`。真机 `@click` 绑定未改动,由用户真机验收覆盖
(brief Step 1 注释已注明)。
