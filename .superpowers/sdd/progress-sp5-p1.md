# SP5-P1 执行台账
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-20-vue3-migration-sp5-p1-shell-installed.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-20-vue3-migration-sp5-apps-design.md

## 任务进度
- [ ] T1 共享包 update 返回 message
- [ ] T2 AreaShell 抽取
- [ ] T3 installedApps store
- [ ] T4 /apps 路由 + 页壳
- [ ] T5 已装应用卡片
- [ ] T6 回归 + 部署

## SDD ledger
- Task 1: complete (Service e8df69d..c9a081d, review clean)
- Task 2: complete (New-UI c4d154c..f512db6, review clean)
- Task 3: complete (New-UI f512db6..231f8d9, review clean; 备忘: 同 id 并发双操作无 fencing——依赖 T5 卡片 pending 禁用使之不可达)
- Task 4: complete (New-UI 231f8d9..673e220, review clean; 17 bus.on 全解绑,test mock 类型微修)
- Task 5: complete (New-UI 673e220..9e5046e, review clean; Minor: InstalledAppCard.test 未断言 pending 禁用菜单项——实现已 :disabled=busy,ItemStub 无法验;复用 --good token 无新增)
- Task 6: complete — 回归两仓全绿(Service 105、New-UI 835)、vue-tsc 0、deploy /app/ HTTP 200
- 终审(opus, c4d154c..9e5046e):抓出 1 Critical——卸载确认空操作(reka update:open 先于 confirm,页面已 null 掉 target)。已修 New-UI@a26235f(open/target 解耦 + RED→GREEN 集成测试 + 删无用 i18n 键 filesSidebarToggle),重新部署 /app/ HTTP 200。
- SP5-P1 收官坐标:New-UI master@a26235f、Service sp3-shared-http@c9a081d(均本地未推)。docs 计划待提交 NimoOS-UI docs 分支。

## Task 6 真机验收清单(待用户浏览器逐条验,jsdom 测不了的)
- [ ] files 三页回归:/app/#/files 列表/上传/预览、/files/shares、/files/drop 外观行为与换壳前一致;窄屏 ☰ 抽屉开合正常
- [ ] /app/#/apps:已装应用列表出现(actualbudget / arize-phoenix / nimoos-agent / nimoos-photos-ml 这批 compose 应用);图标/标题/状态点正确
- [ ] 打开:running 应用点「打开」新标签进 Web UI
- [ ] 启停:停止一个应用→卡片转「处理中」→收敛「已停止」;再启动收敛「运行中」(无 5 秒轮询也自动刷新=事件驱动生效)
- [ ] 重启:重启一个应用,状态收敛
- [ ] 检查并更新:点后 toast 显示后端 message(已是最新/更新中)
- [ ] 卸载:确认框出现、默认不勾删数据;确认后应用真的被卸载(终审修的空操作 bug 重点验)、卡片消失、桌面 Dock 全部应用区同步消失
- [ ] 勾选「同时删除用户数据」后卸载:AppData 目录一并删除
- [ ] 旧 UI 对照:/#/legacy 应用区弹窗全程可用(安全网未动)
- [ ] 窄屏(手机):/apps 侧栏变抽屉,点导航自动收起
