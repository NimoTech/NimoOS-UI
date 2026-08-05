# 小组件自定义/固定尺寸(label 契约扩展)— 进度台账

Plan: docs/superpowers/plans/2026-07-17-widget-custom-size.md
跨仓库:NimoOS-AppManagement(分支 feat/desktop-label-recognition,base a5b915c)
+ NimoOS-Service(master,base 8842b24;工作区 dist/ 漂移=本地重建产物,Task 3 一并入库)
+ NimoOS-New-UI(master,base eea4a85;有遗留 WIP,Task 4 单独入库)
+ NimoOS-AI(master,契约文档+seed v11)。
模式: TDD + 每 task commit,子代理逐任务执行。

- [x] Task 1: AppManagement label 解析 + resize=false 糖 — complete (commits a5b915c..3351ba1, 11/11 tests, review Approved)
- [x] Task 2: AppManagement appgrid 可选范围字段 — complete (commits 3351ba1..2110612, build+定向测试绿(3 个既有环境性失败与 diff 无关), review Approved; 注意 codegen/ 是 gitignored,计划 Step 5 笔误已纠)
- [x] Task 3: NimoOS-Service AppGridWidget 类型 — complete (commits 8842b24..2033cd7, pnpm build 绿, dist 漂移一并入库(审查者核实为忠实编译产物), review Approved)
- [x] Task 4: New-UI 基线 + 遗留 WIP 入库 — complete (commit 95f0602, 703/703 + tsc 绿, review Approved; 注意计划文档本身仍未跟踪,收尾时随 Task 8 入库)
- [x] Task 5: New-UI appWidgetSize.ts 纯模块 — complete (commits 95f0602..bb7f358, 708/708, review Approved)
- [x] Task 6: New-UI sizeOfItem 自带范围 — complete (commits bb7f358..951b8ae, 709/709 + tsc 绿, review Approved; 偏差:AppMeta.widget 内联类型加了四字段修 weak-type,审查判定正确且最小,Task 7 需收敛为 AppGridWidget import)
- [x] Task 7: New-UI 初始尺寸夹进范围 — complete (New-UI 951b8ae..4fcc7f5 + Service a6ad748/ea28fc6(AppGridWidget 导出+dist), 711/711 + tsc 绿, review Approved 零 findings)
- [x] Task 8: 契约文档 + seed v11 — complete (New-UI d07c888(含计划文档入库) + AI a3e4463, go build 绿, review Approved 全部 verbatim)
- [x] Task 9: 部署 + 真机验收 — complete (AppMgmt 1.9.3-alpha1+7.g1a6927d / New-UI deploy.sh / AI +8.g58f2b4a seed v11;四验收点全 pass(真实 Playwright 拖拽);controller 抽查 appgrid JSON/seed/服务 active 复核一致。注:seed 版本文件实际在 skills/.version 而非 skills/builtin/.version)
- 2026-07-17 全部完成。AppManagement 改动仍在 feat/desktop-label-recognition(未合 main,延续既有惯例);是否合并/推送待用户定。

## 终审(fable)+ 修复
- 终审: 端到端契约/向后兼容/锁死路径/store 未加载退化全部核实成立;2 Important + 2 Minor。
- 修复(一波带齐): AI 58f2b4a(widget-contract 残句矛盾,seed 保持 v11) + New-UI 04e46d3(autoPin 尺寸自愈 snap + 悬空 import) + AppMgmt 1a6927d(糖守卫 <=0)。
- 复审: 四项全 ✅,审查者独立复跑 Go 10/10、New-UI 61/61、tsc 零错误。**Ready to deploy: Yes**(顺序 AppManagement → New-UI → AI)。
- 既往 Minor 裁定: T1 reject(已实质覆盖);T2 defer(真机 curl 兜底);T5 defer(全下游只读,可选 Object.freeze)。

## Minor findings (for final review)
- T1 Minor: resize=false 糖缺"w 声明 h 未声明"混合维度用例(实现按维度独立,大概率正确但未测)。
- T2 Minor: adapter 边界(internal_web_test.go)没有 Minw/... 透传/缺省为 nil 的回归测试。
- T5 Minor: appWidgetRange 未声明分支按引用返回 APP_WIDGET_SIZE 单例(既有模式);若后续有人原地改返回值会污染全局常量,可防御性拷贝。
