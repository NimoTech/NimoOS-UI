# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp17-settings-catchup.md

worktree: .claude/worktrees/sp17-settings-catchup (branch sp17-settings-catchup)
base: 5b9d652 (plan commit)

Task 1: complete (commits 5b9d652..00871cf, review clean)
Task 2: review 1 — 1 Important (SettingsShell.test.ts:428/436 两个被改过的测试标题仍是中文), 3 minor deferred
Task 2: minor (deferred): tabs.test.ts:63 标题「admin 看到全部 7 项」已陈旧(现在 8 项),断言本身对 RAIL_TABS 不写死故仍绿
Task 2: minor (deferred): zh_cn.sp9.ts:237 的解释性尾注在 en_us 侧无对应,文档不对称
Task 2: minor (deferred): task-2-report.md 把 settingsLan* 键数写成 9,实际 10
Task 2: 控制器核实 3 个 ⚠️ 全部无缺口(中英文案与 Vue2 逐字一致 / IPv4 正则与 Vue2 相同 / 第二提交正文完整)
Task 2: fix round 1/5 (1 addressed, 0 open; commits 3590881..e16d931)
Task 2: complete (commits 00871cf..e16d931, review clean)
Task 3: review 1 — 1 Important (导出树 panels.test.ts 仍断言 4 行,而导出版面板是 3 行 ⇒ 公开仓带红测试), 4 minor
Task 3: minor (deferred): appPaths.test.ts:82 / migrateBrowse.test.ts:106 的 `as never` 是 plan-mandated(brief 逐字给的),畸形 fixture 会静默通过 —— 留给机主定
Task 3: minor (deferred): oss/manifest.mjs:1812-1840 锚点把无关的 null-data 用例一起圈进去;migrateBrowse 那条重编了 8 行 fixture 只为改两行
Task 3: 控制器核实 ⚠️ 无缺口 —— NimoOS/service/migrate.go:29 有 MigrateTypePhotos="photos_data",:371 dst=filepath.Join(mount,".system_data","photos") 与前端公式逐字一致
Task 3: fix round 1/5 (3 addressed, 0 open; commits 1e99477..dd0b01e)
Task 3: minor (deferred): oss/manifest.mjs:1758-1760 修复轮自己新加的一句中文注释,违反英文注释硬约束 —— 留给终审那轮的单次修复波
Task 3: complete (commits e16d931..dd0b01e, review clean)
Task 4: minor (deferred): layout.test.ts:298 注释说 live 数组里 storage 是「其它系统应用键」,但 storage 在 DEFAULT 里是 widget 不是 app 磁贴,不承重
Task 4: minor (deferred): 没装 KVM 的机器每 30 秒多一次失败探测(brief 指定如此,也是磁贴能自动回来的前提)—— 设计权衡非缺陷
Task 4: complete (commits dd0b01e..b0f7233, review clean)
Task 5: review 1 — 2 Important (outstanding:77 指错仓库的 roadmap 路径 / KVM 验收步骤写「等约 45 秒」但清扫只在 30s 轮询节拍上判宽限期,最早 60s 才消失,照写会验出假阴性), 2 minor
Task 5: minor (deferred): NimoOS/route/v1.go 里 wsssh 注释掉的路由实际在 :107,:106 是它上面的说明行 —— 该错引用源自代码注释本身,现已被两份文档转载
Task 5: fix round 1/5 (2 addressed, 0 open; commits 45be595..6ee3699)
Task 5: complete (commits b0f7233..6ee3699 + NimoOS-UI 仓 9a3328ca, review clean)
Task 6: complete (commits 6ee3699..9a28798, review clean)
FINAL review (opus, 6f8f742..9a28798): Needs fixes — 1 Important (无 KVM 机器上磁贴亮着且点击静默无反应,missingSince 是内存态每次刷新重置 ⇒ 勤刷新的用户永远等不到清扫) + 7 minor; 导出树独立重跑 398 文件/4028 例全绿零泄漏
FINAL: 挂账 minor 分诊 —— 修 3 条(as never casts / tabs.test.ts:61 陈旧标题 / 见修复波清单),留 4 条(manifest 中文注释·锚点偏宽·layout 注释·locale 尾注)
FINAL fix wave: commits 9a28798..85fe026 (5 提交) — 6 条 findings 全部 ADDRESSED,无新增 Critical/Important
FINAL fix wave 顺带修掉一个 Task 4 遗留真 bug:kvmAvailable 从来没在 store 的 return 里导出,外部读恒为 undefined
门(修复后前台复跑):675 文件 / 10945 例 0 failed · vue-tsc 0 错 · oss 7 文件/146 例
