# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-New-UI/docs/superpowers/plans/2026-08-01-vue3-migration-sp9-p3-apps-status-terminal-storage.md

项目台账(内容性结论)在 `../sp9/04-p3.md`;本文件只记 SDD 循环的机械进度。

基线:New-UI `92ef3b6`(计划书提交后 `e7b459b`)· Service `37462c6`
基线数字:New-UI 297 文件/2316 例 · tsc 0 · Service 25 文件/169 例

工作树 = 主工作树 master(用户明确指定,roadmap §4 SP9 已记)。⚠️ 永不 checkout/stash;commit 必须带 pathspec。

## 进度

Task 1: complete (Service 37462c6..389b7db, review clean) — container.prune() + FolderEntry.is_symlink;Service 25 文件/172 例
Task 1: minor (deferred): prune 的二次确认在消费侧(Task 9)—— 评审提醒到时核实确实做了
Task 2: fix round 1/5 (1 addressed, 1 partial — 边界用例被 sort 掩盖、变异不翻红; commits fe2f02a..9190841)
Task 2: fix round 2/5 (1 addressed, 0 open — 用例改为只放 / 与 /media/Backup,变异实证翻红; commits 9190841..c7a5a58)
Task 2: complete (commits e7b459b..c7a5a58, review clean) — appPaths.ts 10 例;计划书已同步修正(commit 见下)
⚠️ 过程事故(Task 3 期间):实现者跑了 `git reset`(reflog HEAD@{1} "reset: moving to HEAD"),把那 3 个 design-export staged 删除退成 unstaged。HEAD 未变、未被卷进任何 commit(`git log --name-only f1478b1..HEAD | grep -c design-export` = 0)。控制器尝试 `git add` 复位被权限分类器拦下 → 交用户处置。此后所有派发提示词明令禁止 `git reset`。
Task 3: minor (deferred): parentPath 的 `>= root.length` 兜底在现有调用约束下不可达(照抄 Vue2 防御写法,保留);browseCrumbs 的 toVirtualPath 若 displayNames 映射的是 root 的祖先会拼出怪名字(实际 displayNames 按挂载点 1:1,不发生)
Task 3: fix round 1/5 (1 addressed, 0 open — 补兄弟目录 fixture + 边界用例,变异实证翻红; commits f57dad1..643bc81)
Task 3: complete (commits f1478b1..643bc81, review clean) — migrateBrowse.ts 26 例
Task 4: fix round 1/5 (2 addressed, 0 open — 4 条中文标点改回全角 + 3 个 key 补出处/🆕 标记; commits 3105113..d3b9b83)
Task 4: complete (commits 643bc81..d3b9b83, review clean) — i18n 分片各 +72 key(合计 229)· theme.sp9.css +3 token(别名)· settings.css +5 组类
Task 4: 裁定接受(不算偏离):brief 猜的 --danger/--fg-dim 不存在 → 用实际的 --remove-fg/--fg-muted;--set-ok-fg/--set-logs-bg/--set-logs-fg 做成既有 token 别名(仓库已有 --wave-none: var(--fg-subtle) 先例)
Task 4: 给后续任务的类名/token 接口 → 见 task-4-report.md「给后续任务的接口清单」一节
Task 5: complete (commits d3b9b83..c4228cb, review clean) — components.ts + SystemStatusPanel 19 例;全量回归 301 文件/2363 例
Task 5: 裁定接受(申报偏离):去掉刷新按钮的 :disabled="loading" —— 评审已核 Vue2 SystemStatus.vue:6 只绑 :loading 不绑 :disabled,1:1 成立;连点由代际守卫挡住,且让交错测试走真实路径
Task 5: minor (deferred): statusHint 在 error 为空时丢了 Vue2 的 `c.error || $t('Offline')` 兜底(tooltip 只剩时间戳)—— 计划书原文如此,属 1:1 缺口,交终审triage
Task 5: minor (deferred): 未覆盖「陈旧的 reject 撞上新鲜的 success」这条守卫分支(代码两支同构,风险低)
Task 6: complete (commits c4228cb..64d990f, review clean) — sysLog.ts + LogsCard + TerminalPanel 17 例;全量 2381 例;⚠️ 两条 cannot-verify 由控制器核实通过(access_token key 与 main.ts:25/session.ts:4 一致;7 个 settingsTerm* key 中英各齐)
Task 6: 裁定接受(申报偏离):panels.test.ts 把 terminal 移出骨架断言循环(同 general/developer/network/system-status 先例,断言改钉真实 .set-term-empty,未削弱);新增 .set-logs-fs/.set-logs-download/.is-fullscreen 三个类(仅用 token)
Task 6: minor (deferred): settings.css:308-309 注释说 `inset: 0` 实际写的是 `inset: 16px`,注释与代码不符
Task 6: minor (deferred): LogsCard 空串分支恒显示「正在拉取系统日志...」,Vue2 在真的空日志时显示「暂无日志数据」—— 计划书原文如此
Task 7: fix round 1/5 (1 addressed, 0 open — 撤掉越界的刷新按钮、守卫改 alive 布尔、变异确认交错用例空转后删除; commits 131028a..9e2b4af)
Task 7: complete (commits 64d990f..9e2b4af, review clean) — StoragePanel 4 例;容量口径经评审逐字核对 Vue2 SettingsPanel.vue:1139-1171
Task 7: 控制器自纠:「就地守卫 + 交错测试」这条通用要求对只取一次数的面板套用过度,已撤回(实现者为此加过一个 Vue2 没有的刷新按钮,已删)
Task 7: renderSize(512110190592) 实际输出 476.94 GB(计划书写的 476.95 GB 有误,已按实际值改断言,未动 renderSize)
Task 8: minor (deferred): browseError 同时承载列目录失败与重命名/删除失败(两者都要内联展示,功能无碍)
Task 8: minor (deferred): poll() 用裸 setInterval 无在途守卫,请求 >200ms 时可能乱序落定 —— Vue2 同样写法,属照抄形态
Task 8: fix round 1/5 (2 addressed, 0 open — currentVolume 改为复用 volumeForPath;补 7 例写路径测试(新建/重命名/删除 各成功+失败 + 受保护目录 disabled);再评审独立复跑变异确认删除确认门有判别力; commits a1fabd4..5b923a4)
Task 8: 顺带修了一个真 bug —— v-for 里的字符串 ref 被 Vue 收集成数组,重命名输入框 .focus() 失效(改函数 ref);再评审独立复现确认属实
Task 8: minor (deferred): 没有直接断言 .focus() 被调用,该 bug 的保护是靠 unhandled rejection 让退出码非 0(会挡 CI,但只看"18 passed"会漏)
Task 8: complete (commits 9e2b4af..5b923a4, review clean) — AppPathDialog 18 例;全量 306 文件/2404 例
Task 9: complete (commits 5b923a4..1be8b9e, review clean) — AppPathRow + AppsPanel 9 例
Task 9: 裁定接受(申报偏离,评审已定向核实):① displayNames 把根挂载点 / 重映射成 /DATA(brief 的一行式会算出 /NimoOS-HD/DATA/AppData;home/stores/folders.ts:35-38 就是这么做的);② 测试补 setActivePinia 且 prune 失败提示改断 toast store 的 msg(toast 由应用级 AppToast 渲染,不在面板子树;同 general/rows.test.ts 先例)
Task 9: minor (deferred): 「确认后调 prune 并显示成功提示」这条只断了 prune 被调用,没断 toast 文案 —— 删掉 toast.show 那行仍绿,标题名不副实(继承自计划书原始测试)
Task 10: 全量三门 ✅ New-UI 307 文件/2414 例 · tsc 0 · build 通过 · Service 25/172
Task 10: 静态截图自查完成(26 张,暗/亮 × 四 tab × 1280/420 + 弹窗四步)—— **逮到 1 个真缺陷**:日志卡浮动工具条压住首行日志(getBoundingClientRect 实测矩形重叠,非字体假象);另报 420px 下 rail 文字裁切 = P1 既有问题,挂账不动
终审(opus 全分支):无 Critical · 3 Important(I1 .set-mig-close 类名撞车致关闭按钮丢外观 / I2 迁移失败不发 finish / I3 四面板无加载态致 apps 首屏闪错误读数)· deferred minors triage 后 #7 #8 必修
修复波 1(唯一一次):fc3b633 修 I1/I2/I3/#7/#8/M1/M7 → 307 文件/2417 例
修复波补一条:日志卡工具条遮挡(静态自查发现,与终审并行返回)
修复波再评审(定向):8 条全部 ADDRESSED,无越界、无新破坏;panels.test.ts 那两条断言判定为「行为纠正非削弱」(断言总数增加)
最终三门:New-UI 307 文件/2417 例全绿 · tsc 0 · build 通过 · Service 25/172 全绿
最终坐标:New-UI master 943185c(20 commit)· Service master 389b7db(1 commit);design-export 零卷入;未推 origin、未部署
SDD 循环结束 —— 台账要点已搬进 .superpowers/sdd/sp9/(04-p3.md / 04-p3-acceptance.md / 04-p3-visual-selfcheck.md / 04-p3-final-fix.md / 04-p3-sdd-progress.md),重要结论已同步 roadmap §4 SP9(NimoOS-UI d3c53d18)
