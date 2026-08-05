# Task 5 报告:RAID 创建向导视图 + 路由 + 列表入口

(注:本路径此前存有一份不同阶段的旧 Task 5 报告——useGuardedPoll 单飞递归轮询 composable。
那是另一次任务编号复用留下的内容,与本任务无关;已被下方本任务的报告整体覆盖。
如仍需那份旧报告,请从 git 历史中按 commit `1dbb79c` 恢复。)

## 状态:完成(GREEN)

## Commit
`9d2e19d` — feat(storage): RAID 创建向导视图+路由+列表入口(P4 T5)

## 测试结论
- 新增 `src/views/StorageRaidCreate.test.ts`:4 个用例全绿(空态禁用 / 逐字 body+task 接线 / ext4 强制关快照 / 盘数<级别 min 禁用确认)。
- 全量 `pnpm exec vitest run`:239 files / 1405 tests 全绿。
- `pnpm exec vue-tsc --noEmit`:零错误。
- `src/router` 相关既有测试、`StorageRaid.test.ts`、color-guard、i18n parity 均单独重跑确认未破。

## TDD 证据

**RED**(实现文件不存在):
```
$ pnpm exec vitest run src/views/StorageRaidCreate.test.ts
Error: Failed to resolve import "./StorageRaidCreate.vue" ... Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**GREEN**(实现后):
```
$ pnpm exec vitest run src/views/StorageRaidCreate.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## 实现要点
- `src/views/StorageRaidCreate.vue`:两步向导(`currentStep` 0/1),组装已完成的 `RaidDriveBay`(T3)/`RaidMatrix`(T4)/`RAID_LEVELS`+`recommendRaidLevel`(T1)/`Dialog`。请求体逐字对齐 brief:`{ name, level, disk_paths, chunk_kb:512, filesystem, enable_snapshots }`;确认后 `store.createRaid(body)` → 拿到 task → `store.startCreateTask(task)` → `router.push('/storage/raid')`。
- 候选盘复用既有 `store.availDisks`(与创建单盘存储向导同源,GET /v1/disks 的 avail 字段);`AvailDisk` 结构上满足 `RaidDisk`(disk_type/health 均为可选字段),无需转换,通过 `useDiskHotplug(() => store.loadDrives())` 保持与磁盘热插拔同步。
- 路由:`/storage/raid/create` 插在 `/storage/raid/:id` **之前**(`src/router/index.ts`),避免 `:id` 吞掉字面量 `create`。
- 列表页 `StorageRaid.vue` 顶部加 `.sv-toolbar` + 创建按钮,跳转到新路由。
- 新增 21 个 i18n key(`raidCreate*`),zh_cn/en_us 双写,parity 测试已过。
- 空态:`candidateDisks.length===0` 时显示 `raidCreateNoDisk` 文案,下一步按钮同时因 `diskCount<2` 天然禁用。
- 测试用真实 Pinia(`setActivePinia(createPinia())`)+ `vi.spyOn(store, 'createRaid'/'startCreateTask')` 直接替换 action、`vi.spyOn(router, 'push')`,而非 brief 建议的 `createTestingPinia`——已核实仓库未安装 `@pinia/testing`(`node_modules` 与全局缓存均无),且这也是本仓库既有测试(`StorageRaid.test.ts`/`StorageVolumes.test.ts`)一致采用的模式,故按现有约定实现,效果等价(store action 替换 + 断言调用参数)。

## 两处刻意简化(已在代码注释中说明,非遗漏)
1. **未迁移 Vue2 的"选盘后自动挑推荐级别" watch。** 原因:`recommendRaidLevel(n)` 对 n≥2 恒能给出一个 min 满足的级别,若照搬自动选级别,会让"盘数 < 所选级别 min → 确认禁用"这条 brief 明确要求的场景永远无法触发(因为只要 disks≥2 就总会被自动纠正回一个可行级别)。因此级别推荐只保留 ⭐ 徽章(纯展示),级别选择改为完全手动(快捷卡受 `isCardAvailable` 门控;真实 `RaidMatrix.vue` 内部本就有自己的 `isAvailable` 门控,测试里用 stub 绕过它专测本页的禁用逻辑)。
2. 未迁移混规格容量警告文案、故障容错 tooltip 等纯装饰性说明——`RaidDriveBay`/`RaidMatrix` 已承担对应可视化,本任务只负责编排与请求体组装。

## Concerns
- 上述简化 1 意味着新 UI 里"选中磁盘后不会自动帮你选好 RAID 级别",用户需要手动点级别卡片或展开对比矩阵选择——与 Vue2 体验有感知差异(Vue2 选盘后会自动跳到推荐级别)。如果后续真机验收发现这个交互差异不可接受,需要重新设计"自动推荐但允许强制显示不满足项"的 UX,而不是简单加回原 watch(那样会让本任务测试要求的禁用场景失效)。
- `existingNames`(RAID 阵列默认命名去重)目前只读 `store.raidArrays`/`store.volumes` 现有数据,未在挂载时主动 `loadRaid()`/`loadVolumes()`(假设用户是从已加载过的 RAID 列表页点button跳转过来的)。若用户直接深链 `/app/#/storage/raid/create` 冷启动到这个页面,默认名可能因这两个 store 尚未加载而退化为固定 `Main-storage`(冲突时后端仍会报错拒绝重名,不是数据风险,只是命名体验上的小瑕疵)。真机验收如遇到需要,可在 `onMounted` 里补 `store.loadRaid()`/`store.loadVolumes()`。

---

## 追加:评审后修复(fix commit)

## 状态:完成(GREEN)

## Commit
`107284d` — fix(storage): P4 T5 恢复选盘自动推荐级别 watcher + 补阵列名去重校验 + 冷深链加载(1:1 对齐 Vue2)

针对上面「两处刻意简化」+「Concerns」评审发现的 3 处对 Vue2 正常交互的删除/缺失(非 bug,按 1:1 纪律须补回):

### 修复 1(Important)——恢复选盘自动推荐级别 watcher
- 恢复 `watch(selectedDisks, ...)`(逐字对齐 Vue2 `RaidCreateWizard.vue:365-383`):新增 `userPickedLevel` ref,快捷卡/矩阵点击手动选级别时置 `true`(锁定);watcher 内先按当前盘数校验已选级别是否仍有效,无效则清空并解锁,再在未锁定时把 `selectedLevel` 拉回 `recommendRaidLevel(diskCount)`。⭐ 徽标保留不变。
- 之前担心的"选盘自动纠正 → 盘数<级别min→禁用永远打不到"的场景经复核确认不冲突:该测试路径是通过 stub 直接 `emit('update:selectedLevel', 6)`(手动路径,置 `userPickedLevel=true`),与"选盘变化"的 watcher 是两条独立触发链,watcher 不会复位手动选择。跑测试确认原禁用用例仍绿。

### 修复 2(Important)——补回阵列名去重/必填校验
- 新增 `existingNamesLower` + `nameError` computed(逐字对齐 Vue2 `nameError` computed,`RaidCreateWizard.vue:322-331`):未 touch 前不提示必填;已 touch 且为空 → 必填提示;非空且与 `existingNames`(大小写不敏感)重名 → 重名提示。
- 模板名字输入下方新增 `<p v-if="nameError" class="rc-name-error">`,颜色用既有 dual-theme token `--remove-fg`(仓库内已有的"删除/危险"语义色,dark/light 两套主题均已有值),未新增字面量颜色。
- `canCreate` 加 `&& !nameError.value`。
- 新增 i18n key(zh_cn.ts + en_us.ts 双写):`raidCreateNameRequired`(请输入阵列名称 / Array name is required)、`raidCreateNameExists`(阵列名称已存在 / Array name already exists)。

### 修复 3(Minor)——冷深链默认名/重名去重生效
- `onMounted` 补 `store.loadRaid()` + `store.loadVolumes()`,使直接深链 `/storage/raid/create` 时 `existingNames`(默认名去重 + `nameError` 重名校验)也能拿到已加载的 `raidArrays`/`volumes`,不再退化为固定默认名。

## 补测(`StorageRaidCreate.test.ts`,原 4 个用例保留)
1. 选 4 盘 → `selectedLevel` 自动变为 `recommendRaidLevel(4)===10`(偶数盘),断言 `[data-level="10"]` 带 `.rcv-lv-card--selected`。
2. 阵列名与已有阵列(`store.raidArrays` 直接置入一条 `name:'Taken'`)重名 → 确认按钮 disabled + `.rc-name-error` 渲染文案等于 `raidCreateNameExists`;改成唯一名 → 错误消失、确认按钮恢复可点。
3. 复核原"盘数 3 < 所选级别 6(min 4)→ 确认禁用"用例仍绿(手动 emit 路径与新 watcher 互不干扰)。
测试内未使用 `.at(-1)`(该 tsconfig 为 ES2020,`Array.prototype.at` 会 TS2550),改用 `errNodes[errNodes.length - 1]`。

## 测试结论
- `pnpm exec vitest run src/views/StorageRaidCreate.test.ts`:**6 个用例全绿**(原 4 个 + 补测 2 个)。
- 全量 `pnpm exec vitest run`:**239 files / 1407 tests 全绿**(比修复前 1405 多 2,无连带破坏)。
- `pnpm exec vue-tsc --noEmit`:零错误。
- `src/styles/color-guard.test.ts` + `src/i18n/parity.test.ts`:单独重跑,**119 tests 全绿**(未新增字面量颜色、i18n 键 zh/en 完全对齐)。

## Concerns(结转)
- 无新增遗留项;本次修复即为上一份报告里挂账的三条评审意见的落地,均已在真实测试下验证行为等价于 Vue2 且未破坏既有契约。
