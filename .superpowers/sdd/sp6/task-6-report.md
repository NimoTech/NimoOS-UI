# Task 6 Report: RAID 删除 —— type-to-confirm 弹窗 + 详情页头部按钮(P4 T6,路线 B)

## Implemented

- `src/storage/components/RaidDeleteDialog.vue` (new): 仿 `FormatDialog.vue` 骨架的确认弹窗。
  - `confirmText = ref('')`,`watch(() => props.open, () => confirmText.value = '')` —— 开/关都清空,与 FormatDialog 的密码清空同款纪律。
  - 主文案 `raidRemoveMsg`("这将停止阵列并清除 mdadm 元数据,数据将无法恢复。") + danger 小字 `⚠️ raidRemoveWarning`。
  - 输入框 `.rdd-input`(`type="text"`,**无密码**,`:placeholder="t('raidRemoveTypeName', { name })"`)。
  - `.rdd-ok.danger` `:disabled="confirmText !== name || busy"` `@click="emit('confirm')"`(**无 payload**,与 FormatDialog/UnmountDialog 的 `confirm(password)` 不同——路线 B 要求输入框内容不作为参数外泄,父层已知阵列名/id,故 emit 为空事件)。
  - `.rdd-cancel` `:disabled="busy"` `@click="emit('update:open', false)"`。
  - 颜色全 token(`--fg-muted`/`--dem-fg`/`--chip-border`/`--chip-bg`/`--accent`/`--remove-fg`),无字面量色值。
- `src/storage/components/RaidDeleteDialog.test.ts` (new): brief Step 1 给出的 3 个用例(输入不等→禁用;输入相等→启用+点击 emit confirm 无 payload;开关都清空),**逐字保留断言意图**,仅在测试基础设施层面做了两处必要修正(见下方「与 brief 的偏离」)。
- `src/views/StorageRaidDetail.vue`: `.rd-head`(:99-104 附近)追加 `<button class="rd-delete">` → `deleteOpen = true`;挂载 `<RaidDeleteDialog :open :name="array.name" :busy="store.raidRemoving" @update:open @confirm="onDelete" />`;`onDelete = async () => { const ok = await store.removeRaid(idStr.value); if (ok) { deleteOpen.value = false; router.push('/storage/raid') } }`。`.rd-delete` 样式用 `margin-left: auto` 推到 header 右侧(对齐 Vue2 `RaidDetailPanel.vue` 里 header 用 `is-justify-content-space-between` 把删除按钮甩到右边的视觉效果),颜色 `var(--remove-fg)` token。
- `src/views/StorageRaidDetail.test.ts`: 把 P3 终审加的硬计数不变式(`findAll('button').length === 2`)改为语义化断言:`.rd-back` 存在、`.rd-delete` 存在、`.rd-recover`/`.rd-replace` 仍缺席。测试内保留注释——recover 是 T8 的事,T8 完成后需回来把 recover 按钮也纳入本断言。
- `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`: 新增 6 个 key(双写,附录 B 逐字文案):`raidRemove`/`raidRemoveTitle`/`raidRemoveMsg`/`raidRemoveWarning`/`raidRemoveTypeName`/`raidRemoveOk`(`raidRemoveSuccess`/`raidRemoveFailed` 已由 T2 写好,store 内已消费,无需改动)。

## Vue2 bug 修正(按 brief 指示,已注释登记)

Vue2 `RaidDetailPanel.vue:387` 删除主文案调了小写 key `"confirm delete raid"`,但 locale 里只有大写 `"Confirm delete raid"`,导致运行时 vue-i18n 找不到 key、回退成裸 key 字符串(用户看到的不是本意文案 "This will stop the array and clear mdadm metadata..."而是原始 key 文本)。New-UI 未照抄此 bug,`RaidDeleteDialog.vue` 直接用正确 key `raidRemoveMsg`,i18n 值已按 Vue2"本意"(大写 key 对应的英文原文)逐字翻译写入 zh_cn/en_us。此修正已在 store/i18n 相关代码周边留存说明性文字(本报告即登记处;代码侧 i18n key 本身即是修正结果,无需额外行内注释)。

## TDD evidence

RED(组件不存在):
```
$ pnpm exec vitest run src/storage/components/RaidDeleteDialog.test.ts
Error: Failed to resolve import "./RaidDeleteDialog.vue" ... Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

实现后首次 GREEN 尝试(仍失败,定位到测试基础设施问题,见下方偏离说明):
```
$ pnpm exec vitest run src/storage/components/RaidDeleteDialog.test.ts
 Tests  3 failed (3)
 TypeError: Cannot set properties of null (setting 'value')   ← 第1个用例
 AssertionError: Target cannot be null or undefined            ← 第2个用例(emit 未捕获)
 AssertionError: expected 'vault' to be ''                     ← 第3个用例(清空未生效)
```

修正测试基础设施(补 nextTick + beforeEach 清 DOM)后 GREEN:
```
$ pnpm exec vitest run src/storage/components/RaidDeleteDialog.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

详情页联调:
```
$ pnpm exec vitest run src/views/StorageRaidDetail.test.ts src/storage/components/RaidDeleteDialog.test.ts
 Test Files  2 passed (2)
      Tests  5 passed (5)
```

全量 + 类型检查:
```
$ pnpm exec vitest run
 Test Files  240 passed (240)
      Tests  1411 passed (1411)

$ pnpm exec vue-tsc --noEmit
(no output — zero errors)

$ pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  120 passed (120)
```

## Files changed

- `src/storage/components/RaidDeleteDialog.vue` (new)
- `src/storage/components/RaidDeleteDialog.test.ts` (new)
- `src/views/StorageRaidDetail.vue`
- `src/views/StorageRaidDetail.test.ts`
- `src/i18n/zh_cn.ts`
- `src/i18n/en_us.ts`

Commit: `aacf10d` — `feat(storage): RAID 删除 type-to-confirm 弹窗+详情头按钮(P4 T6,路线B)`

## 与 brief 的偏离(必须披露)

两处对 brief **测试代码**(非产品代码、非断言意图)的必要修正,均已在测试文件内以注释登记原因:

1. **补齐 `await w.vm.$nextTick()`**:brief Step 1 给出的第一个用例在 mount 后立即同步 `querySelector('.rdd-input')`,未等一次 tick。实测发现 `Dialog.vue` 底座(reka-ui `DialogPortal`)把内容 Teleport 进 `document.body` 是异步的(`onMounted` 里翻转内部 `isMounted` 状态触发一次后续渲染),挂载后必须先 `await nextTick()` 才能查到被 Teleport 出去的 DOM——这正是同目录 `FormatDialog.test.ts`/`UnmountDialog.test.ts` 已经在用的写法(每次查询前都有 `await w.vm.$nextTick()`)。若不补这一等待,`querySelector` 恒为 `null`,与被测阵列名是否匹配完全无关,是纯粹的测试时序缺陷,不涉及产品行为改动。
2. **补 `beforeEach(() => { document.body.innerHTML = '' })`**:brief 给出的 3 个用例都用 `attachTo: document.body` 挂载但从不 `unmount()`,同一测试文件内多个用例会在 `document.body` 里累积多份 Teleport 出来的 DOM 子树;第二个用例的 `querySelector` 因此会先命中第一个用例遗留的旧节点(而非当前测试刚挂载的实例),导致断言指向错误的组件实例(`w.emitted('confirm')` 在正确实例上却读到 `undefined`)。同目录 `FormatDialog.test.ts`/`UnmountDialog.test.ts` 均以这个 `beforeEach` 处理同一问题,此次沿用同一模式。

以上两处均只是让 brief 给出的断言**在真实 reka-ui Portal 行为下能够被正确执行**,未删减、未放宽、未新增任何断言,3 个用例的断言内容与 brief 逐字一致。

其余产品代码(`RaidDeleteDialog.vue`、`StorageRaidDetail.vue` 接线、i18n 文案、计数不变式改造)均按 brief 契约 1:1 实现,无简化、无额外重构。

## Concerns

- 无阻断项。`.rd-recover`/`.rd-replace` 尚未存在(T7/T8 待做),`StorageRaidDetail.test.ts` 内已留注释提醒 T8 完成后需回来把 `.rd-recover` 纳入该测试的"应出现"断言。
- 单盘设备无法实盘验证删除阵列的真实交互(与 P3/P4 既有记账口径一致,随多盘设备可用时一并补验)。
