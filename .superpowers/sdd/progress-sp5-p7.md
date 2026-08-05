# SP5-P7 商店源管理 执行台账

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-22-vue3-migration-sp5-p7-sources.md (docs 分支 1ba7179c)
Base: ae76475 (master)

## Tasks
- Task 1: complete (commits ae76475..8d160c2, review clean/Approved)
  - Minor 记账:①isHttp 判定 new URL+protocol vs Vue2 substring includes("http")(意图对齐非字节相同);②两函数重复 new URL 模式(brief 原样规定);③空串/protocol-relative 等边角未测(手查安全)
- Task 2: complete (commits 8d160c2..5bde9c8, review clean/Approved)
  - Minor 记账:①invalidate() 不 ++seq——在途 loadCatalog 陈旧响应可覆盖 categories/catalogLoaded(计划固有缺口,一行可修,终审triage);②测试未断言 list/installed/error 不被 invalidate 波及
- Task 3: complete (commits 5bde9c8..a618aed 共2提交, 一轮修复后复审 Approved)
  - 修复:并发 register 守卫(store 级 throw appsSourcesBusy)+ 轮询停止断言 + register-error 不重拉断言
  - Minor 记账:①load() seq 竞态守卫无专测(appstore 同款模式);②轮询无上限(register-error 事件丢失且 URL 永不出现时永久轮询——计划固有设计,终审 triage)
  - 注:T3 提前落了 4 个 i18n 键(措辞自拟)+ appsSourcesBusy;T4 需用计划原文对齐 4 键措辞
- Task 4: complete (commits a618aed..4c0ab8c, review clean/Approved)
  - i18n 4 键措辞已对齐计划原文 + appsSourcesBusy 并入同块;AppsSidebar.test 3→4 断言更新=合法机械后果
  - Minor 记账:①retry 按钮 store.load() 未 void(cosmetic);②页面 e instanceof Error 兜底与 store errMsg 轻度重复(防御性,无害)
  - 工作区注:AppSettingsPage.vue 有 2 行 YAML tab 间距 CSS 未提交改动,非本期产物,未动,待用户处置
- Task 5 收口: complete
  - 全量 1190/1190 + vue-tsc 清 + 主题自查 CLEAN(P7 范围 diff 零色值字面量)
  - 整支终审(fable)= With fixes → 单修复 25b1a95(invalidate() seq++ 孤儿化在途 loadCatalog + loading 复位 + 真竞态测试)→ 复核 Ready
  - 终审 triage:接受为债——①register 轮询无上限(事件丢+URL永不出现的双重失败=表单永久禁用,建议后续加~40轮封顶);②unregister 按 id=下标,多客户端窗口期可能删错(Vue2 同款,后端稳定 ID 票候选);③StorePage 可见期收敛时分类 chips 闪空(D4 承诺范围内,验收步骤2留意);④--font-mono token 未定义(带 fallback,CustomAppsPage 先例);其余 cosmetic
  - 已部署 /app/(deploy.sh,HTTP 200)
  - 最终坐标:New-UI master@25b1a95(ae76475..25b1a95 共 6 提交)
- 验收补丁①(2026-07-22,cbff786,已部署):真机源列表实证 id0=出厂默认源是 cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@…(app-management.conf 预置),原「首段=NimoTech」判定在真机上永不命中→无官方徽章、默认源可删、名称显示成"gh"。修:①isOfficialSource 加出厂默认主店模式(仅 IceWhaleTech/CasaOS-AppStore,同 org 其它仓不算);②sourceDisplayName jsDelivr gh 镜像取 org;③Add/Remove/重试按钮 ui-btn(弹窗按钮样式)→ bar-btn(全应用标准药丸,theme.css:308),Add 叠 StoreCard .store-install 同款 accent-soft 配色,输入框 34px 对齐。10 focused + 全量 1194 + tsc 清。
- 验收补丁②(2026-07-22,已部署):用户反馈三条——①awesome.nimoos.io 是品牌重命名死链(域名不存在,curl 000),改指 CasaOS 原版 awesome.casaos.io(200);②注册中输入框解锁(可备下一个地址),仅锁提交(单飞守卫在 store,后端完成事件不带 URL 无法归属并发注册);③注册中状态落盘 localStorage(nimoos:sources-registering,{url,at},TTL 10min)——刷新后恢复 pending 行 + 重新武装轮询收敛,settle 时清除;测试 +3(落盘/恢复收敛/TTL 丢弃)+ 页面输入框不锁断言,localStorage.clear 进两个测试 beforeEach(防跨用例恢复污染)。全量 1197 + tsc 清。
