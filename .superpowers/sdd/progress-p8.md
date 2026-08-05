# SP4-P8 收口+翻 strangler — SDD 台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-18-vue3-migration-sp4-p8-cutover.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-18-vue3-migration-sp4-p8-cutover-design.md
起点: New-UI master@b8331fb / NimoOS-UI docs/vue3-migration-sp3@260d0c4c
Task 1: complete (commits b8331fb..edeaae3, review clean/Approved)
Task 2: complete (commits edeaae3..e975224, review clean/Approved; 测试偏离=flushPromises 已裁justified)
  Minor(终审裁量): FilesSidebar 既有 .side-item/.side-remove 的 var(--x, rgba(...)) 兜底为老代码模式,非本期引入
Task 3: complete (commits e975224..75e6785, review clean/Approved)
Task 4: complete (commits 75e6785..b90f30f, review clean/Approved)
Task 5: complete (commits b90f30f..ab9ca69, review clean/Approved)
  Minor(知悉即可): watch 数组 getter 每次新数组=任何导航都重跑 sync,幂等 reload 无害
Task 6: complete (commits ab9ca69..5fb39ee 共3个: 0f2f60a feat + 058820f 全局lottie mock + 5fb39ee 消费方测试跟进, review clean/Approved)
  备注: 计划断言"消费方无需改动"有误——GridItem/HomeDock 测试锁旧行为,已授权更新;lottie-web mock 上移全局 setup
Task 7 (闸门): i18n 双向扫描归零(模板文本节点=0, TS字面量=0)✅;791/791 + tsc + build 绿;已部署 /app/ HTTP 200 (2026-07-18)
  → STOP: 等用户真机验收(窄屏抽屉/polish/深链/Home改指/桌面回归),通过后才进 T8 翻 strangler
Task 7 闸门修1: 窄屏工具栏/选中栏折行 9d599bb 已部署,待用户复验
Task 7 闸门修2: 手机 actions 溢出根因修复(flex-basis 100%)+ 删除钮左移 1a07097 已部署
Task 7: 闸门通过(2026-07-18 用户确认:抽屉/折行/深链/Home改指全过;修2轮=9d599bb折行+1a07097溢出根因&删除钮左移)
Task 8: complete (NimoOS-UI eab93d64 单独cutover commit, opus评审Approved, 5边界全核)
  Minor(知悉): /files#section 裸锚点(无查询)不重定向=留Vue2,非文件区真实链路;基线实为8个既有失败(5 nimoTaskBar+3 settingsStore)
Task 9: Vue2 已构建部署(bundle app.3d56f1fb.js 含 /app/#/files + strangler:disabled 码),/=200 /app/=200;待用户 cutover 验收+回退实演
Task 9: complete(2026-07-18 用户 cutover 验收通过:重定向/深链/回退实演全过)
整支终审(opus): Ready to close;3 挂账 Minor 全裁 accept + 1 新 Minor(抽屉态卸载竞态残留=纯装饰)记录
Task 10: complete(roadmap@4be74ad7 SP4 关账 + memory 更新)
== P8 关账 2026-07-18: New-UI b8331fb..1a07097(10 commits) + NimoOS-UI eab93d64(cutover) ==
P8 后追加: 桌面侧栏整块毛玻璃面板 0b1fbe8(复用主页卡 5 token,等高分栏;抽屉态覆盖回贴边)已部署
P8 后追加2: 面板 token 化(--panel-bg/shadow 双主题)+home/标题入面板+悬停对比(纸感白上白根因)+加号flex居中 e5614ee 已部署
