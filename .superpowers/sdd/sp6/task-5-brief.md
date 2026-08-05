### Task 5: 创建向导视图 `StorageRaidCreate` + 路由 + 列表创建入口

迁移 Vue2 `RaidCreateWizard.vue`(2 步向导)。step0 = RaidDriveBay 选盘 + 快捷级别卡(RAID 0/1/5/6/10,含 ⭐推荐)+ 可折叠 RaidMatrix + 文件系统选择(btrfs/ext4,默认 btrfs)+ 快照复选框(仅 btrfs 显示,默认勾选);step1 = 确认摘要。确认用普通 primary 弹窗;`doCreate` → `store.createRaid(body)` → 拿到 task → `store.startCreateTask(task)` → `router.push('/storage/raid')`(回列表看进度卡)。

**Files:**
- Create: `src/views/StorageRaidCreate.vue`
- Test: `src/views/StorageRaidCreate.test.ts`
- Modify: `src/router/index.ts`、`src/views/StorageRaid.vue`

**Interfaces:**
- Consumes: `RaidDriveBay`(T3)、`RaidMatrix`(T4)、`RAID_LEVELS`/`recommendRaidLevel`(T1)、`Dialog`(`../components/ui/Dialog.vue`)、`useStorageStore`(`createRaid`/`startCreateTask`/`availDisks` 或 RAID 可用盘来源)、`useRouter`、`useI18n`。
- Produces: 路由 `{ path: '/storage/raid/create', name: 'storage-raid-create', component: StorageRaidCreate }`(**插在 `/storage/raid/:id` 之前**)。

- [ ] **Step 1: 写失败测试**(核心 = 请求 body 逐字 + 快照/文件系统联动 + task 接线)

```ts
// mock store.createRaid / startCreateTask / router.push,断言:
// 1) 选 3 盘 + 级别 5 + btrfs + 快照勾选 → 点确认 → createRaid 收到
//    { name, level:5, disk_paths:[3个], chunk_kb:512, filesystem:'btrfs', enable_snapshots:true }
// 2) 切 ext4 → enable_snapshots 强制 false、快照复选框隐藏
// 3) createRaid 返回 task → startCreateTask(task) 被调 + router.push('/storage/raid')
// 4) 盘数 < 级别 min → 确认按钮禁用
```
(测试用 `createTestingPinia` + stub `RaidDriveBay`/`RaidMatrix`,聚焦向导编排与 body 组装,不重测子组件内部。)

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现向导 + 路由 + 列表按钮**

- `StorageRaidCreate.vue`:`<script setup>`,state `selectedDisks`/`selectedLevel`/`selectedFilesystem='btrfs'`/`enableSnapshots=true`/`arrayName`/`step=0`。`isBtrfs = computed(() => selectedFilesystem === 'btrfs')`。快捷级别卡 v-for `RAID_LEVELS`,⭐ 标 `recommendRaidLevel(selectedDisks.length)`。RaidMatrix 折叠展开。step1 确认摘要。确认按钮点击 → 用 `Dialog` 弹一句 primary 确认(文案 `raidCreateConfirmMsg`,插值 `{level,name,n}`)→ 确认后组装 body:
  ```ts
  const body = {
    name: arrayName.value, level: selectedLevel.value!,
    disk_paths: selectedDisks.value.map(d => d.path),
    chunk_kb: 512 as const, filesystem: selectedFilesystem.value,
    enable_snapshots: isBtrfs.value ? enableSnapshots.value : false,
  }
  const task = await store.createRaid(body)
  if (task) { store.startCreateTask(task); router.push('/storage/raid') }
  ```
  确认按钮 `:disabled` = 无名字 / 未选级别 / `selectedDisks.length < 该级别 min` / `raidCreating`。名字输入过滤 `[a-zA-Z0-9_-]`。
- `router/index.ts`:在 `/storage/raid/:id` **上一行**插入 create 路由(顺序陷阱见 Global Constraints)。import `StorageRaidCreate`。
- `StorageRaid.vue`:顶部加 `.sv-toolbar` + 创建按钮(仿 `StorageVolumes.vue:62-73`),`@click="router.push('/storage/raid/create')"`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错;补跑 `pnpm exec vitest run src/router` 确认路由测试(若有)不破。

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidCreate.vue src/views/StorageRaidCreate.test.ts src/router/index.ts src/views/StorageRaid.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 创建向导视图+路由+列表入口(P4 T5)"
```

---

