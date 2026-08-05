# SDD ledger — plan: docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p5-snapshots.md
Base(New-UI): f5c3f10 (P4 关账 cc5adf0 + 本计划)
Task 1: complete (commits f5c3f10..99b7f3f, review clean; Minor 留档:SnapshotItemView.type 收窄为 string|undefined(SnapshotRaw.type 可选,写死 string 不 sound)——后续 Task 模板消费时注意)
Task 2: fix round 1/5 dispatched (spec ❌ = zh_cn 6 条 toast 文案偏离附录 A;Minor deferred: 日志不含 config 断言只覆盖 loadVolume,另四个 catch 未独立断言)
Task 2: fix round 1/5 (1 addressed, 0 open; commits 12bbfa1..a854ce9)
Task 2: complete (commits 99b7f3f..a854ce9, review clean after fix; Minor deferred: 日志不含 config 断言只覆盖 loadVolume)
Task 3: fix round 1/5 dispatched (Important: .sp-switch 无 accessible name,Vue2 b-switch 有 label 关联;Minor deferred: 点开关 disabled→enabled 触发 loadPolicy 的路径无专测)
Task 3: fix round 1/5 (1 addressed, 0 open; commits aab468a..8c21d2a)
Task 3: complete (commits a854ce9..8c21d2a, review clean after fix; Minor deferred: 点开关 disabled→enabled 触发 loadPolicy 无专测)
Task 4: complete (commits 8c21d2a..5114ed3, review clean; Minor deferred×2: 取消清错误测试无法隔离(openAdvanced 也清)、openAdvanced 的 Number() 包裹为 Vue2 之外的防御性多余代码)
Task 5: fix round 1/5 dispatched (Important: 换卷重置展开态无真断言;附带补 Vue2 折叠过渡=我的计划文本漏写的 1:1 缺口。Minor deferred: .st-browse 负向断言偏弱、组头无 aria-expanded(Vue2 亦无,保持1:1)、附录 T5 实为 7 键)
Task 5: fix round 1/5 (2 addressed, 0 open; commits aef7f02..d24babd)
Task 5: complete (commits 5114ed3..d24babd, review clean after fix)
Task 6: complete (commits d24babd..e84cb53, review clean 无 findings)
Task 7: complete (commits e84cb53..e32e74e, review clean; 授权偏离=SnapshotPanel 加 v-if="detail" 门(Vue3 子 onMounted 早于父,否则用空 uuid 拉卷;Vue2 靠 v-if=selectedRaid 天然规避))
Deferred (pre-existing, 交终审 triage): (a) StorageRaidDetail 无路由 :id 变更 watcher,/raid/7→/raid/8 直接跳转会整页停在旧数据(P3 遗留,非快照特有,Important 但需人为改 URL 才触发);(b) snapshot.loadVolume 用空串 uuid 匹配可能误命中同样无 uuid 的卷(Minor,建议 store 侧 if(!uuid) 早退)

== SP6-P5 全支终审(Opus, base cc5adf0 → e32e74e): With fixes → 修复后 all addressed (2ffb128) ==
Critical C1(本期新引入):状态提到 Pinia 单例后无复位 + 面板无 watch(volumeUuid)(时间线却有,diff 内部不自洽)→ 换阵列时显示 A 的开关/快照数/策略却对 B 发写请求(保护开关与保留策略静默错目标写入)。已修:store.reset() + onMounted/watch 都先 reset 再 load。
Important I2 已修:loadVolume/loadSnapshots 加过期响应丢弃(按 uuid 认领,finally 也守卫)。Important I1 已修(仅披露):删除弹窗失败不关闭是有意偏离 Vue2,已注释登记。台账 7 已修:空 uuid 早退。台账 3 已补接缝测试。顺手:.st-browse 空断言换成动作区按钮数量、Number() 补理由注释。
控制方自改一行(已交复审判定正确):SnapshotPanel.test.ts beforeEach 补 togglePolicy.mockResolvedValue(undefined) —— clearAllMocks 不还原 mockImplementation,「切换在途」用例的永不 resolve 实现泄漏到接缝测试。
范围化复审(base e32e74e→2ffb128):7 条全 ADDRESSED,新破坏 none。
收尾门:focused 379 绿 / 全量 246 文件 1505 绿 / vue-tsc 零错 / pnpm build 入口 index-CSbH2ajJ.js / curl :5273/app/ 200 且伺服哈希一致。真回归自检:注释掉 volumeUuid watcher → 3 条转红,恢复全绿。
Parked(非阻塞,随 P6 处理):(1) onMounted 里的 reset() 无专属回归测试(每个用例都从新 pinia 起步);(2) P3 遗留=StorageRaidDetail 无路由 :id watcher,直接改 URL 跨阵列跳转整页停旧数据(用户 2026-07-27 拍板推迟 P6);(3) 日志不含 config 断言只覆盖 loadVolume;(4) 组头无 aria-expanded(Vue2 亦无,保持 1:1);(5) SnapshotItemView.type 收窄 string|undefined(终审裁定非问题,关闭)。
P5 code-complete: New-UI sp6-storage @ 2ffb128(12 commit = 1 计划 + 7 Task + 4 fix)。禁区遵守:未部署/未合并/未改 NimoOS-UI 仓/未改 roadmap(推迟 P6)。
