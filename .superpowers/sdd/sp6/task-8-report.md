# Task 8 报告(P4):恢复/重新识别 —— 详情头按钮 + toast

## Status: DONE

## Commit
`cc5adf0` feat(storage): RAID 恢复/重新识别详情头按钮(P4 T8)

## 测试结论
- `StorageRaidDetail.test.ts` 新增 3 个用例(retrying 渲染/active 缺席、点击调用 `store.recoverRaid(id)` 一次 + busy 禁用、failed 场景也渲染),回填 T6 语义化按钮不变式(active=[delete],retrying/failed=[delete, recover])。先跑 RED(2 失败)再实现,后跑 GREEN(4/4 通过)。
- **全量 `pnpm test`:241 个测试文件 / 1423 个用例全绿**(P4 收尾门,本任务是 P4 最后一个 task)。
- `vue-tsc --noEmit`:零错误。
- `color-guard.test.ts` + `parity.test.ts`(合计 121 用例):全绿,无裸色、i18n 键 zh/en 对齐。

## 实现要点
- `.rd-head` 里在 `.rd-delete` 之前插入 `.rd-recover` 按钮,`v-if="flags.isRetrying || flags.isFailed"`,`:disabled="store.raidRecovering"`,`@click="store.recoverRaid(idStr)"`。
- toast 完全交给 store action(T2 已实现:按返回 `state` 决定成功/警告文案),视图侧不重复弹 toast——与 Vue2 `doRecover` 语义一致(无确认弹窗,直接执行)。
- 样式:边框/文字用 `var(--dem-fg)`(warning 语义 token,对应 Vue2 `type="is-warning"`),背景/圆角/hover 与 `.rd-delete` 同款,`disabled` 态加 `opacity:0.6`。
- i18n:补齐附录 B 遗漏的按钮文案 key `raidRecover`(zh"重新识别"/en"Rediscover")到 zh_cn.ts/en_us.ts;`raidRecoverSuccess`/`raidRecoverFailed` 已由 T2 加好,未重复添加。

## 对 Vue2 的偏离披露
1. **条件表达式用 `flags.isRetrying || flags.isFailed`,而非字面 `effectiveState==='retrying'||effectiveState==='failed'`**。已按 brief 要求"先读确认字段名"核实:`isRetrying`/`isFailed` 是本仓库 P3 已建立的 `resolveRaidState()`(`src/storage/util/raidView.ts:92-93`)算出的布尔标志,其定义本身就是 `effectiveState==='retrying'`/`'failed'`,行为完全等价;只是复用了页面里其它按钮/徽章判定同款的既有标志对象,未引入新的字符串比较逻辑,也未简化语义。与 Vue2 `RaidDetailPanel.vue:13`(`effectiveState==='retrying'||effectiveState==='failed'`)逐行对照确认一致。
2. 点击调用用的是 `idStr`(页面既有的 `computed(() => String(route.params.id))`,与 `.rd-delete`/`onDelete`/`onReplace` 共用),未新增参数来源。
3. 其余(按钮位置紧邻 delete 之前、无确认直接执行、toast 委托 store、文案/颜色语义)均 1:1 照 Vue2 `RaidDetailPanel.vue:12-23` + `:416-434`。

## Concerns
- 单盘设备无法实盘验证 recover 真实触发 mdadm 重新识别(与 P3/P4 其它写操作同口径,已记 ledger,随多盘设备补验)。
- 无其它遗留问题;P4 全部 8 个 task 至此完成,收尾门(全量测试 + tsc + color-guard + parity)均已在本任务内一并跑过并全绿。
