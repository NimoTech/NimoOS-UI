# Task 7 报告(P4 换盘)—— RAID 换盘弹窗 + 成员行入口

> 注:本目录 `task-7-report.md` 文件名此前被 P3 阶段的另一个 Task 7(创建任务检测/轮询)占用过,
> 本次是 P4(RAID 写操作)重新按 1..9 编号的新 Task 7(换盘),内容与旧报告无关,已整篇覆盖。

## Status: Done

Commit: `82c7db4` — feat(storage): RAID 换盘弹窗+成员行入口(P4 T7)

## 测试结论

`pnpm test` 全量 241 文件 / 1421 用例全绿(含本 Task 新增 14 条:RaidReplaceDialog 6 条 + RaidMemberList 追加 3 条 + 既有回归);`vue-tsc --noEmit` 零错;`color-guard.test.ts`/`parity.test.ts` 单独跑 121 用例全绿。TDD 严格 RED→GREEN:先写 14 条测试跑出 1 个 import 失败(整文件 0 test)+ 1 个断言失败(`.rml-replace` 计数 0≠1),再实现到全绿。

## 实现内容

- `RaidReplaceDialog.vue`(新建):故障盘只读 `<input disabled>`(红字 `raidReplaceRemoveHint`)+ 新盘原生 `<select class="rrd-select">`(排除 `faultyDiskPath`,选项文案 `${path} — ${fmtSize(size)}`)+ 黄色警告(`--dem-fg` token,`raidReplaceWarning`)+ footer `.rrd-cancel`/`.rrd-ok`(danger,`:disabled="!newDiskPath||busy"`,点击直接 `emit('confirm', newDiskPath)`,**无二次确认**,对齐 Vue2 96 行源)。`watch(open)` 清空选择。
- `RaidMemberList.vue`:新增 `isDegraded?: boolean` prop + `replace-disk` emit;新增 `showReplace(m)` 判定 `isDegraded && m.state === 'faulty'`,两个渲染分支(RAID10 pair / 平铺)各加 `.rml-replace` 按钮。
- `StorageRaidDetail.vue`:接 `@replace-disk` → 设 `replaceTarget`+`replaceOpen`;挂 `RaidReplaceDialog`,`:available-disks="store.availDisks"`,`onReplace` 调 `store.replaceRaidDisk` 成功后关弹窗。
- i18n:双写 zh_cn/en_us 共 7 个新 key(`raidReplace`/`raidReplaceTitle`/`raidReplaceFaulty`/`raidReplaceRemoveHint`/`raidReplaceNew`/`raidReplaceSelect`/`raidReplaceWarning`),文案逐字取自计划文档附录 B(`raidReplaceSuccess`/`Failed` 在 T2 已加,未重复加)。

## 对 Vue2 的偏离(全部披露)

1. **入口只做了一半**——Vue2 有两个换盘入口:①列表卡 `RaidCard.vue`(Vue2,:16-23)degraded 横幅上的"Replace Disk"按钮(经 `RaidTab.vue:238-251 openReplaceDisk` 从 `status.members` 或 `member_disks` 兜底找故障盘);②详情页成员行。**本 Task 只实现了②**——brief 的 Files 清单明确只列 `RaidMemberList.vue`+`StorageRaidDetail.vue`,未列 New-UI 的 `RaidCard.vue`(列表卡组件),且 brief 正文原话是"详情页成员列表...+/或 详情头/列表卡 degraded 横幅"(或即可选)。New-UI 现有 `src/storage/components/RaidCard.vue` 目前**没有** degraded 横幅/替换按钮(既非本 Task 引入也非本 Task 删除,是既存缺口)。即:换盘功能现在只能从阵列详情页触发,列表页看到 degraded 阵列点进详情页前无直接换盘入口。如需对齐 Vue2 双入口,需要额外一个 Task 给 `RaidCard.vue` 加横幅+按钮并从列表页透传到详情页或直接开弹窗。
2. **故障盘判定严格取 `state === 'faulty'`**,没有复用 `raidView.ts` 现成的 `memberSquare(state).kind === 'fail'`(它把 `'faulty'` 和 `'removed'` 都归为同一渲染类)。这是刻意的:逐字对齐 Vue2 `RaidTab.vue:238-251 openReplaceDisk` 的判定条件(只匹配 `m.state === "faulty"`,不含 `"removed"`),避免"已移除"的盘也冒出替换按钮——按移植纪律"Vue2 的 bug 才不照抄"原则,这条不是 bug,是精确匹配,已在代码注释登记。
3. **弹窗本身不做 toast/错误提示**,直接调用 store 的 `replaceRaidDisk`(其内部已对成功/失败调用 `useToast().show(...)`,复用 T2 已双写的 `raidReplaceSuccess`/`raidReplaceFailed`)。Vue2 原组件是自己 `this.$buefy.toast.open(...)`。这不是本 Task 新引入的偏离,是 T2/T6 就确立的仓库统一约定(store 内聚 toast,弹窗只管展示态),沿用而已,在此一并注明避免被误认为遗漏。
4. 新盘下拉用原生 `<select>`(New-UI 无 UI 框架)代替 Vue2 的 `b-select`,占位选项 `value=""` 模拟 Buefy 的 `:placeholder`,视觉/交互语义等价,非功能偏离。

## 未改动的既有测试

`StorageRaidDetail.test.ts` 里 T6 写的"`.rd-replace` 应缺席"断言未受影响(本 Task 没有加详情头级 `.rd-replace` 按钮,只加了成员行级 `.rml-replace`),保持绿,无需改动。

## Concerns

- 上述偏离①(列表卡入口缺失)是本次交付相对 Vue2 最主要的功能覆盖缺口,请确认是否需要补一个后续 Task 或纳入现有 T8 范围;若接受"详情页内换盘"作为 SP6 P4 阶段的最终形态,则无需再动。
- `store.availDisks` 与 prop 期望的 `RaidDisk[]`(来自 `raidLevels.ts`)是结构兼容而非同一类型(`AvailDisk` 多出 `name/model/needFormat/serial` 字段),TS 结构化类型下可直接传入,`vue-tsc` 已验证零错,无需额外适配层。
