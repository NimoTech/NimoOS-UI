# SP5-P4 设置面板 SDD ledger
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-21-vue3-migration-sp5-p4-settings.md (docs branch 725935cf)
Base: New-UI master@f035ea0 · Service sp3-shared-http@09c00ea
- T1 curl gate 修正:后端 JSON 其实保留顶层 x-nimoos/x-casaos(只丢 service 级嵌套扩展);且无扩展块应用 JSON GET 500("extension x-nimoos not found",AppManagement 后端 bug,超范围,待汇报用户)。D1 结论(走 YAML)不变。
Task 1: complete (Service 09c00ea..e72afa4, review clean after 1 fix loop)
  Minor deferred: getYaml 测试未盖 ''兜底分支 / 未断言 transformResponse(与 getAppCompose 先例一致)
- 基线修正:用户并行提交 2df44b0/75860c1(files 区 Ctrl+V 粘贴上传,与 apps 零重叠);P4 New-UI 任务基线=75860c1。
Task 2: complete (New-UI 75860c1..499bfc3, review clean, opus adversarial 13 checks passed)
  Minor deferred(终审triage): ①保存时给缺省服务写默认 restart/cpu_shares/空数组+fabricate x-nimoos{scheme}(Vue2 parity) ②裸容器端口 "3000" 短语法保存时静默丢弃(数据丢失边缘,Vue2 同) ③长语法仅 target 的随机主机端口保存后被钉死=target ④YAML 注释/锚点丢失(Vue2 同) ⑤端口 range 取首段(Vue2 同)
Task 3: complete (499bfc3..757a578, review clean, 14/14)
Task 4: complete (757a578..05f74b3, review clean)
  Minor informational: v-for 用 index :key(计划自带写法,行内 v-model 绑对象实际无碍)
Task 5: complete (05f74b3..d79745c, review clean, 967/967 全量)
  Minor deferred: datalist id="webui-ports" 非实例作用域(单实例使用下无碍)
Task 6: complete (d79745c..6799a7a, review clean, 132/132 + router 12/12)
  合理偏离×2:composable 测试 mount 包装(useI18n 约束,循 useInstallFlow 先例);冲突 banner 底色 --drop-bad(计划原 token 对比度 ~1.17:1=bug)
Task 7: complete (6799a7a..920842f, review clean)
  Minor deferred: 详情页两个 onMounted 块(无碍);getAppCompose 详情+安装各拉一次(效率账,后续);"no reservation"路径仅隐式覆盖
Task 8: complete (920842f..24a784f, review clean, 977/977 + tsc 0)
终审(fable): Ready to merge。F1(任意保存把 before_install 回落凝固成 tips.custom)已修@fc09f06 并复核通过(981/981+tsc0)。
终审 triage 结论:全部 Minor 可延;P5 必修=裸端口/端口range 保存丢失的 pass-through(实锤:商店 Crafty 25500-25600 range 保存即塌成单端口;全商店唯一命中);可选跟进=app:apply-changes-error 无 toast(静默回滚不可见)。
最终坐标: New-UI master@fc09f06 · Service sp3-shared-http@e72afa4 · 部署+真机验收待用户。
验收补丁①@314741c(已部署,981/981+tsc0):端口冲突改先弹确认窗(PreInstallTips 同款单确认钮 Dialog)——根因=保存钮在长表单最底部、红条在顶部视野外;确认(或 ESC/点遮罩)后关窗,红条+端口行标红保留,并 scrollIntoView 滚回红条。新 i18n 键 appsSettingsPortConflictTitle/appsSettingsConflictOk。
✅ SP5-P4 关账(2026-07-21 用户验收通过):最终坐标 New-UI master@314741c · Service sp3-shared-http@e72afa4;roadmap P3+P4 行已勾(docs 79fe4708);记忆已更新。
