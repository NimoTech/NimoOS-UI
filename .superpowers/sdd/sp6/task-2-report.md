# Task 2 报告:store 四个 RAID 写 action

(Note: this file previously held a report for an older task-numbering scheme's "Task 2"
— raidView.ts 纯函数 + 视图收窄类型. That work is already merged and unrelated to this
task; this report replaces it, per the current SP6-P4 task brief
`.superpowers/sdd/task-2-brief.md`.)

## Status: DONE

## Commit
`556be76` — feat(storage): RAID 四写 action + 守卫 + 请求形状单测锁死(P4 T2)

## 测试结论
`pnpm exec vitest run src/storage/stores/storage.test.ts`(35/35 通过,含新增 5 例"RAID 写 action");
全仓 `pnpm test` 235 files / 1375 tests 全绿;`pnpm exec vue-tsc --noEmit` 零错。

## 做了什么
- TDD:先在 `storage.test.ts` 追加 mock(`raidCreateMock/raidRemoveMock/raidReplaceDiskMock/raidRecoverMock`,沿用文件既有 `service.raid` mock 装配范式,避免与已存在的 `createMock`(storage.create)撞名)+ 5 条 brief 给定用例,`-t "RAID 写 action"` 跑出 RED(5 个 `is not a function`)。
- 按 brief 逐字实现 `storage.ts`:4 个 busy ref(`raidCreating/raidRemoving/raidReplacing/raidRecovering`)+ 4 个 action(`createRaid/removeRaid/replaceRaidDisk/recoverRaid`),单飞守卫、失败只 `console.warn(msg)` 不落整个 error 对象,补进 store `return {}`。GREEN。
- i18n:在 zh_cn.ts / en_us.ts 的 `raidCreateFailed` 后双写插入本 Task 用到的 7 个 toast key(`raidCreateFailedToast/raidRemoveSuccess/raidRemoveFailed/raidReplaceSuccess/raidReplaceFailed/raidRecoverSuccess/raidRecoverFailed`),文案取自计划文档 `docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p4-raid-write.md` 附录 B(brief 正文未内嵌附录 B,已定位到该计划文件核对逐字文案)。`parity.test.ts` 仍绿。

## Concerns
- brief 正文写"新增 5 个 toast key"但实际列出 7 个 key 名 —— 按列出的 7 个全加,数字是文字笔误,不影响实现。
- Appendix B 里其余 RAID 相关 key(`raidCreate`/`raidRemove`/`raidReplace`/`raidRecover` 等一大批向导/对话框文案)**未加**,严格按本 Task 范围("只加这几个 toast 用到的 key")执行;后续视图接线 Task(T5–T8)需要时应从同一份计划文档附录 B 取值,勿臆造文案。
- `createRaid` 成功路径按 brief 语义**不刷新 `loadRaid()`**(交给创建任务轮询接管),`removeRaid`/`replaceRaidDisk`/`recoverRaid` 成败都在 finally/成功分支里刷新 —— 与 P2 `createStorage`(成败都刷新)/`unmount`(仅成功刷新)两种范式都不完全相同,是 brief 按 RAID 语义特化的选择,非我自行发挥。
- 未改动任何视图组件,视图接线留给后续 Task,如 brief 所要求。

---

## 追加:一致性小修(fix,2026-07-27)

### Status: DONE

### Commit
`2647a50` — fix(storage): P4 T2 recoverRaid 刷新移入 finally 对齐 + 补 remove/replace/recover 守卫与日志测试

### 测试结论
`pnpm exec vitest run src/storage/stores/storage.test.ts`(38/38 通过,含新增 3 例);`pnpm exec vue-tsc --noEmit` 零错。

### 做了什么
- **改动1(一致性)**:上面 Concerns 里提到的三个写 action 刷新语义"不完全相同"其实还有一处偏差——`recoverRaid` 之前把 `await loadRaid()` 放在 try 成功路径末尾,catch(请求抛错)分支不刷新;而 `removeRaid`/`replaceRaidDisk` 是 finally 里刷新(成败都刷新)。现已把 `recoverRaid` 的 `await loadRaid()` 挪进 `finally`(在 `raidRecovering.value = false` 之前),三者刷新语义对齐。成功路径 `return { state }` 与 catch 的 `return null` 未动——finally 里的 await 在 return 表达式求值后、函数真正返回前仍会执行,不影响返回值。`createRaid` 未动(按业务语义有意不刷新,交给创建任务轮询)。
- **改动2(补测)**:给 `removeRaid`/`replaceRaidDisk`/`recoverRaid` 各补一条失败路径断言,对齐已有的 `createRaid` 失败测试范式:mock reject 一个带 `.config` 的 error → 断言 `console.warn` 被调用、`JSON.stringify(warn.mock.calls)` 不含 `'config'`(日志纪律,不落整个 error 对象含明文/请求体)、对应 busy ref 在 await 后复位为 `false`(证明守卫在 finally 释放,而非提前在 try/catch 分支释放)。沿用文件既有 `raid*Mock` 命名与 `vi.spyOn(console, 'warn')` 装配方式,未引入新风格。

### Concerns
- 无新增遗留项;上一节 Concerns 中"三种刷新范式不完全相同"的表述现已部分修正(recover 与 remove/replace 对齐为 finally 刷新),但仍与 `createStorage`(成败都刷新)/`unmount`(仅成功刷新)/`createRaid`(不刷新)并存,这是各 action 业务语义使然,非本次修复范围。
