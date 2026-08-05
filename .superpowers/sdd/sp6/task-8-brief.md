### Task 8: 恢复/重新识别 —— 详情头按钮 + toast

迁移 Vue2 recover。详情页 `.rd-head` 在阵列 `retrying`/`failed` 时显示 Rediscover 按钮(warning),点击**直接执行**(无确认)→ `store.recoverRaid(id)` → 按返回 `state` 出成功/警告 toast(已在 T2 store action 内做)。**回填 T6 的计数不变式测试**把 recover 按钮纳入。

**Files:**
- Modify: `src/views/StorageRaidDetail.vue`、`src/views/StorageRaidDetail.test.ts`

**Interfaces:**
- Consumes: `useStorageStore().recoverRaid`/`raidRecovering`;详情页已有的 `effectiveState`/状态判定(P3)。

- [ ] **Step 1: 写失败测试**(`StorageRaidDetail.test.ts` 追加)

```ts
// 1) 阵列 state='retrying' → .rd-recover 按钮渲染;'active' → 不渲染
// 2) 点 .rd-recover → store.recoverRaid(id) 被调一次(mock),busy 时按钮禁用
// 3) 计数不变式(回填 T6):active 阵列头部写按钮 = [delete];retrying = [delete, recover]
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现**

`StorageRaidDetail.vue` `.rd-head`:`<button v-if="effectiveState==='retrying' || effectiveState==='failed'" class="rd-recover" :disabled="store.raidRecovering" @click="store.recoverRaid(id)">{{ t('raidRecover') }}</button>`(warning 色 `--dem-fg`)。toast 由 store action 出,视图不重复。更新 T6 的语义化按钮断言纳入 recover。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错;**跑全量** `pnpm test` 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 恢复/重新识别详情头按钮(P4 T8)"
```

---

## 收尾门(所有 Task 完成后)

1. `pnpm test` 全量全绿 + `pnpm exec vue-tsc --noEmit` 零错 + `pnpm exec vitest run src/styles/color-guard.test.ts`(零裸色)+ `src/i18n/parity.test.ts`(键对齐)。
2. `pnpm build` 重建 dist;5273 常驻 vite preview 自动伺服新哈希(挂了就 `cd .sp6/NimoOS-New-UI && nohup pnpm exec vite preview --host > ../preview-5273.log 2>&1 &`)。
3. **单盘设备无法实盘验写操作**(需 ≥2 盘):可眼验的 = `/storage/raid/create` 路由可达、创建向导选盘/级别卡/矩阵展开/文件系统与快照联动的**纯 UI 交互**(无盘或单盘下按钮禁用态)、详情页在无阵列时的空态。**写操作真机验收随多盘设备补,记 ledger**(与 P3 同口径)。
4. 整支终审(Opus,base 402ea6d)→ Ready to merge 判定后关账。**禁区**:不部署、不合并、不改 roadmap(P6)。

## Ledger 挂账(收尾写进 `.superpowers/sdd/progress.md`)

- 故障模拟器(决策 2 推迟):RaidMatrix 未迁 Vue2 `:123-200` 模拟器 + `raidUtils.js` `survival()`/`rebuildable()`,随 P5 或以后补。
- 写操作实盘验收(单盘限制):create/remove/replaceDisk/recover 全部界面+接口层做全+单测锁死,真机验随多盘设备补。
- Vue2 i18n 债修正:删除主文案 key 大小写 bug(Vue2 调 `confirm delete raid` 但只存在 `Confirm delete raid`)、replaceDisk 多个 key 无译文——New-UI 侧已补齐正确 key,记录 Vue2 侧遗留(不回改旧仓)。

---

## 附录 A:P3 已占用、P4 不得撞名的 i18n key

```
raidStateHealthy raidStateDegraded raidStateRebuilding raidStateFailed raidStateRetrying
raidDisksOnline raidRebuildFinish raidRebuildSpeed
raidMemberActive raidMemberFaulty raidMemberRebuilding
raidNoArrays raidCreating raidCreateFailed raidTaskMeta raidDetailsBtn raidDismiss
raidStep1..raidStep6 raidStepInitFs raidCreateDone raidPreparing raidElapsed raidModalHint
raidDetailDevicePath raidDetailMountPoint raidDetailFilesystem raidDetailUuid raidDetailChunk raidDetailState
raidUsageUsed raidUsageFree
raidLevelType raidLevelTolerance raidLevelRead raidLevelWrite raidMembers
raidBtrfsFreeEst raidBtrfsCachedAt
raidLevel{0,1,5,6,10}Tolerance raidLevel{0,1,5,6,10}Read raidLevel{0,1,5,6,10}Write raidLevel{0,1,5,6,10}Desc
storageTabRaid
```

## 附录 B:P4 新增 i18n key(zh_cn / en_us 双写建议文案)

| key | zh_cn | en_us |
|---|---|---|
| `raidCreate` | 创建 RAID | Create RAID |
| `raidCreateConfirmMsg` | 确认创建 RAID {level} 阵列「{name}」,共 {n} 块硬盘? | Create RAID {level} array "{name}" using {n} drive(s)? |
| `raidCreateFailedToast` | RAID 创建失败 | Failed to create RAID |
| `raidCreateName` | 阵列名称 | Array name |
| `raidCreateFilesystem` | 文件系统 | Filesystem |
| `raidCreateSnapshots` | 启用快照保护 | Enable snapshot protection |
| `raidCreateSnapshotsHint` | 创建后自动每小时快照,可随时关闭。 | Hourly auto-snapshots after creation — can be turned off anytime. |
| `raidCreateSelectDrives` | 选择硬盘与 RAID 级别 | Select drives and RAID |
| `raidCreateConfirmStep` | 确认 | Confirm |
| `raidBaySelectAll` | 全选健康盘 | Select all healthy |
| `raidBayClear` | 清空 | Clear |
| `raidBayFilterAll` | 全部 | All |
| `raidBaySelected` | 已选 {n} 块 · {size} | {n} selected · {size} |
| `raidMatrixLayout` | 布局 | Layout |
| `raidMatrixMinDrives` | 最少硬盘 | Min. drives |
| `raidMatrixSurvives` | 容错 | Survives failure of |
| `raidMatrixCapacity` | 可用容量 | Usable capacity |
| `raidMatrixRead` | 读取速度 | Read speed |
| `raidMatrixWrite` | 写入速度 | Write speed |
| `raidMatrixCost` | 成本效率 | Cost efficiency |
| `raidMatrixBestFor` | 适用场景 | Best for |
| `raidMatrixSelect` | 选择 | Select |
| `raidMatrixDetails` | 详情 | Details |
| `raidMatrixToggle` | 展开/收起对比 | Expand/Collapse comparison |
| `raidRemove` | 删除阵列 | Delete Array |
| `raidRemoveTitle` | 删除 RAID 阵列 | Delete RAID Array |
| `raidRemoveMsg` | 这将停止阵列并清除 mdadm 元数据,数据将无法恢复。 | This will stop the array and clear mdadm metadata. Data will be unrecoverable. |
| `raidRemoveWarning` | 请确保所有成员磁盘已连接。离线磁盘将保留 mdadm 超块,可能需要手动清除。 | Ensure all member disks are connected. Offline disks will retain mdadm superblocks and may need manual cleanup. |
| `raidRemoveTypeName` | 输入阵列名「{name}」以确认删除 | Type the array name "{name}" to confirm |
| `raidRemoveOk` | 删除 | Delete |
| `raidRemoveSuccess` | RAID 阵列已删除 | RAID array deleted |
| `raidRemoveFailed` | 删除失败 | Failed to delete array |
| `raidReplace` | 更换硬盘 | Replace Disk |
| `raidReplaceTitle` | 更换故障硬盘 | Replace Faulty Disk |
| `raidReplaceFaulty` | 故障硬盘 | Faulty Disk |
| `raidReplaceRemoveHint` | 该硬盘将从阵列中移除 | This disk will be removed from the array |
| `raidReplaceNew` | 更换硬盘 | Replacement Disk |
| `raidReplaceSelect` | 选择一块硬盘 | Select a disk |
| `raidReplaceWarning` | 更换将触发阵列重建,期间性能下降。 | Replacing triggers an array rebuild; performance is reduced during rebuild. |
| `raidReplaceSuccess` | 已开始更换硬盘 | Disk replacement started |
| `raidReplaceFailed` | 更换失败 | Failed to replace disk |
| `raidRecover` | 重新识别 | Rediscover |
| `raidRecoverSuccess` | 阵列已恢复 | Array recovered |
| `raidRecoverFailed` | 识别失败,请检查磁盘连接 | Discovery failed, check disk connections |
| `storageCancel`(P2 已存,复用) | 取消 | Cancel |

> 实施时逐 Task 只加该 Task 用到的 key(见各 Task Step);表中 `storageCancel` 已由 P2 提供,直接复用不重复添加。新增任何 key 必须 zh_cn/en_us 同步。
