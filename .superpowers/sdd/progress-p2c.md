# SP4-P2c 下载 — SDD 进度台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-03-vue3-migration-sp4-p2c-download.md
Base: master @ 4661fcd (P2b 收尾)

## Tasks
- [x] Task 1: util/download.ts 纯逻辑(planDownload + shouldRefreshBeforeDownload)
- [x] Task 2: util/iframeDownload.ts 单例 iframe 驱动
- [x] Task 3: useFileOps.download 编排 + i18n filesDownloadPreparing
- [x] Task 4: 右键菜单「下载」项 + i18n filesCtxDownload
- [x] Task 5: 多选工具栏「下载」按钮
- [x] Task 6: Files.vue 接线 + 全量验证

## Minor findings (for final review triage)

## Log
Task 1: complete (commits 4661fcd..5508546, review clean) — download.test.ts 7/7, suite 272/272
Task 2: complete (commits 5508546..7841349, review clean) — iframeDownload 2/2, suite 274/274. NOTE: impl guard is `if(!iframe || !document.body.contains(iframe))` (justified deviation from brief literal, necessary for test + more robust)
Task 3: complete (commits 7841349..f567377, review clean) — useFileOps.test 18/18, suite 280/280, vue-tsc clean. Reviewer verified one-refresh-path + conditional refresh + fail-path.
Task 4: complete (commits f567377..105b2f6, review clean) — FileContextMenu 15/15, suite 282/282.
Task 5: complete (commits 105b2f6..1ce32c6, review clean) — SelectionToolbar 4/4, suite 283/283 pristine.
Task 6: complete (commits 1ce32c6..bdfe900, review clean) — Files.vue wired; suite 283/283, vue-tsc 0, build ok.

## Final whole-branch review (opus, range 4661fcd..bdfe900): Ready to merge
Minor findings:
- [FIXED 148093a] #1 Number(raw) NaN 未守卫 → shouldRefreshBeforeDownload 返回 false → 可能静默重开本 feature 要修的 bug。改 shouldRefreshBeforeDownload 非有限值也返 true + 加测试。
- [note] #2 依赖 expires_at 为绝对 unix 秒;若后端改成相对 TTL 则退化为总是刷新(仍安全)。契约已记 plan。
- [FIXED 148093a] #3 useFileOps.ts:89 注释写 /logout,实际 main.ts:19 跳 /#/login。改注释。
- [note] #4 "正在准备下载…" toast 在刷新前触发;刷新失败会先见 toast 再跳登录(可接受、瞬态)。
- [FIXED 148093a] #5 iframe 重建分支(Task2 deviation)无测试。补一条。
Final-review fixes: commit 148093a (NaN 保守刷新 + iframe 重建测试 + 注释校正) — suite 285/285, vue-tsc 0.
P2c COMPLETE — range 4661fcd..148093a, Ready to merge. 待用户真机眼验 + 推 GitHub。
