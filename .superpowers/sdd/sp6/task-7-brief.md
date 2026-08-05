### Task 7: 换盘 —— `RaidReplaceDialog` + degraded 入口

迁移 Vue2 `RaidReplaceDisk.vue`。弹窗:故障盘只读展示 + 单选新盘下拉(排除故障盘,来自可用盘)+ 黄色警告 + danger 按钮**直接执行(无二次确认)**。入口:degraded 阵列——详情页成员列表里 faulty 成员行的"替换"动作(`RaidMemberList` emit)+/或 详情头/列表卡 degraded 横幅。

**Files:**
- Create: `src/storage/components/RaidReplaceDialog.vue`
- Test: `src/storage/components/RaidReplaceDialog.test.ts`
- Modify: `src/views/StorageRaidDetail.vue`、`src/storage/components/RaidMemberList.vue`(+ 其测试)

**Interfaces:**
- Consumes: `Dialog`;`useStorageStore().replaceRaidDisk`/`raidReplacing`;可用盘来源(store 里既有的可用盘列表,同创建向导用的那个)。
- Produces:
  - `RaidReplaceDialog` props `{ open: boolean; raidId: number|string; faultyDiskPath: string; availableDisks: RaidDisk[]; busy?: boolean }`,emits `{ (e:'update:open',v:boolean): void; (e:'replaced'): void }`(内部直接调 store 或 emit 让父调 —— 统一:父传 `@confirm="(newPath)=>..."`?为与 P2 弹窗一致,这里让弹窗 emit `confirm(newPath: string)`,store 调用留在视图)。最终契约:emits `{ (e:'update:open',v:boolean): void; (e:'confirm', newDiskPath: string): void }`。
  - `RaidMemberList` 新增 emit `{ (e:'replace-disk', diskPath: string): void }`(faulty 行"替换"按钮,仅 degraded 时渲染)。

- [ ] **Step 1: 写失败测试**

```ts
// RaidReplaceDialog.test.ts:
// 1) 新盘下拉排除 faultyDiskPath
// 2) 未选新盘 → danger 按钮禁用;选了 → 启用
// 3) 点 danger → emit confirm(选中的 newDiskPath)
// 4) 开/关清空选择
// RaidMemberList.test.ts(追加):
// 5) degraded 阵列 faulty 成员行渲染 .rml-replace 按钮,点击 emit replace-disk(该盘 path)
// 6) 非 degraded / 非 faulty 成员行 无替换按钮
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现**

- `RaidReplaceDialog.vue`:仿 `FormatDialog` 骨架 + `Dialog` 底座。故障盘只读行(`raidReplaceFaulty` 标签 + `faultyDiskPath`,红字 help `raidReplaceRemoveHint`);新盘 `<select v-model="newDiskPath" class="rrd-select">`,选项 = `availableDisks.filter(d => d.path !== faultyDiskPath)`,显示 `${path} — ${fmtSize(size)}`;黄色警告 `raidReplaceWarning`;footer danger 按钮 `.rrd-ok` `:disabled="!newDiskPath || busy"` `@click="emit('confirm', newDiskPath)"`,取消 `.rrd-cancel`。`watch(open)` 清 `newDiskPath`。
- `RaidMemberList.vue`:degraded 且成员 `state` 判 faulty 时,该行加 `.rml-replace` 按钮 emit `replace-disk`(成员 path)。新增 prop 或从现有状态推断 degraded(优先复用现有传入)。
- `StorageRaidDetail.vue`:监听 `RaidMemberList` 的 `@replace-disk` → 设 `replaceTarget = diskPath` + `replaceOpen = true`;挂 `<RaidReplaceDialog :open="replaceOpen" :raid-id="id" :faulty-disk-path="replaceTarget" :available-disks="availDisks" :busy="store.raidReplacing" @update:open="replaceOpen=$event" @confirm="onReplace" />`;`onReplace = async (newPath) => { const ok = await store.replaceRaidDisk(id, { old_disk_path: replaceTarget, new_disk_path: newPath }); if (ok) replaceOpen = false }`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidReplaceDialog.vue src/storage/components/RaidReplaceDialog.test.ts src/views/StorageRaidDetail.vue src/storage/components/RaidMemberList.vue src/storage/components/RaidMemberList.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 换盘弹窗+成员行入口(P4 T7)"
```

---

