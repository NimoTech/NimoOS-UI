# SP6-P0 SDD progress ledger
Plan: docs/superpowers/plans/2026-07-23-vue3-migration-sp6-p0-domains.md
Base(Service): 3bf15b3

Task 1: complete (commits 3bf15b3..f03495c, review clean; Minor: disks.test 未覆盖裸数组分支 getDiskList/getUsbs — src/disks.ts:9-10,19-20)
Task 2: complete (commits f03495c..b51d74a, review clean; Minor: raid.test 无非200信封用例 — 后续硬化)
Task 3: complete (commits b51d74a..6668e6b, review clean; Minor: 报告行数自述与 diff 不符=无关痛痒)
Task 4: complete (commits 6668e6b..2917090, review clean; ⚠️ New-UI 未动已由 controller 核实 status 空)

== SP6-P0 全分支终审: Ready to merge = Yes (2917090) ==
3 条 Minor 全裁 accept:disks 裸数组分支(storage.ts 同款已测)、raid 无非200(unwrap.test 已中央覆盖)、报告行数瑕疵(非代码)。P1-P5 UI 可按需收窄 unknown 返回类型。

== SP6-P1(计划 e5a07bd)==
P1 Task 1: complete (commits e5a07bd..4aedf52, review clean; Minor: System 组排前是 disk_name desc 的巧合性质(盘名字典序超 "System" 会破),Vue2 语义原样继承——记录备查)
P1 Task 2: complete (commits 4aedf52..ea1c737, review clean; Minor×3 皆风格备注:useToast 调用位置、失败路径未断言不重载、raid isArray 冗余防御)
P1 Task 3: complete (commits ea1c737..71301be, review clean; Minor: 报告自述8键实为9键=文档笔误;/storage 页签待 Task 4 路由落地)
P1 Task 4: complete (commits 71301be..447e99b, review clean; Minor: StorageVolumes 视图接线无专属测试(同 Task3 已测模式)、UnmountDialog 测试补 nextTick=portal 异步必要偏离)
P1 Task 5: complete (commits 447e99b..68f231e, review clean; Minor: loadDisks 映射体被无害重排(语义等价,违逐字令+自报不实,已备查);SharesPage.test mock 适配=正当联动)
P1 Task 6: complete (commits 68f231e..5039e01, review clean; Minor: 裸 /app(无斜杠)会被代理到 80——实际路径恒带斜杠,备查)

== SP6-P1 全分支终审: With fixes → 修复后 Ready to merge = Yes (c64298b) ==
Important×1 已修:unmount catch 整个 e 入 console 会带 AxiosError.config.data(明文密码)→ 只记 message(c64298b,复核确认)。
Minor 全裁 accept/推迟:T1 排序巧合性质(Vue2 语义继承)、T2 三条风格、StorageVolumes 接线测试+在途守卫+v.disk 断言→P2 顺手做、en_us 组注释双语、裸 /app 代理边角、P0 disks 注释过时(下次动 Service 仓时改)。
建议记账:P3 第三个热插拔消费者出现时抽 useDiskHotplug composable;弹窗关闭时清 password(P2 顺手)。
5273 常驻预览已部署(PID 见 .sp6/preview-5273.log),待用户眼验。
P1 用户真机眼验通过(2026-07-23,5273 预览):卷/盘/主页磁贴/窄屏 验收完成 → P1 关账,下一期 P2 创建存储向导

== SP6-P2(计划 654365a)==
P2 Task 1: complete (commits 654365a..f171501, review clean; Minor×2 皆理论性质:name||'' 惯例一致、100000 上限逐字继承)
P2 Task 2: complete (commits f171501..5ce8967, review clean after fix; Important 已修:loadVolumes 失败复位 raidNames(5ce8967,复审确认);Minor×3 记账:create 成功分支/format 两分支的刷新断言缺口=计划样码继承、密码测试无 warn-called 守卫=同源、三写操作 try/catch 形状重复=后续 DRY 机会)
P2 Task 3: complete (commits 5ce8967..e9858d2, review clean; Minor 已修:关闭清密码测试原无法区分开/关清,补强为直断+对抗验证旧实现转红 e9858d2;主体 fa7ebb6=UnmountDialog busy 双钮禁用+enter 守卫+开关都清、StorageVolumes 绑 busy、新建视图测试锁 v.disk 父盘转发与在途禁用)
P2 Task 4: complete (commits e9858d2..52c213f, review clean; Minor×1 plan-mandated:mountable 警告双句略冗余=Vue2 逐字镜像;测试验真 DOM 行为、双按钮 payload 全断、主题零字面量、10 key 双语齐)
P2 Task 5: complete (commits 52c213f..dd0af1d, review clean; Minor×1=FormatDialog 与 UnmountDialog 双胞胎结构为 brief 授权;主题零字面量、close-clears 测试真守卫安全路径、系统卷无格式化按钮双向验证、4 key 双语齐)
P2 Task 6: complete (commits dd0af1d..941f4ed, review clean; DONE_WITH_CONCERNS 已核:(a)顺手修 Task5 遗留陈旧选择器.vc-remove→.vc-act.danger(HEAD 已 RED,修复正确在范围)(b)persist.test.ts 全量并发偶发=fake-indexeddb 共享态,与存储无关,留终审门复核;接线契约全对:创建透传{path,name,format}、格式化{path:v.path分区,volume:v.mountPoint,password}≠卸载v.disk、defaultName 卷名+raidNames 双去重、无盘禁用+title)

== SP6-P2 全分支终审: Ready to merge = Yes (941f4ed→修复后 3b47884) ==
终审(Opus,base c64298b)8 条契约端到端成立、密码日志/关闭清密码双安全项非空测试锁死。
Minor→修:createStorage 守卫在 loadAll 前提前释放(失败路径刷新窗口 OK 钮重开可双提交)→ loadAll 移进 finally、守卫持有至刷新完成(3b47884,新增守卫跨刷新测试,revert 后超时验证);unmount/formatVolume 本就 loadAll-in-try 无此洞。
Minor 留档不改:mountable 警告双句(plan-mandated 镜像 Vue2)、双胞胎弹窗+三写操作重复(plan-mandated 同构)、.cs-warn.notice 无专属样式(纯装饰,继承基类无 bug)。
persist.test.ts 偶发=files/upload 的 fake-indexeddb 共享态,与 P2 无关(终审确认;本轮全量 1276/1276 未复现)。
最终:pnpm build 产物 index-BkxDzqv4.js;5273 常驻 vite preview 已伺服该哈希(curl 核对一致),catch-all 代理 /v1 → 80 返 200。
P2 关账坐标:New-UI sp6-storage @ 3b47884(1277 测试+tsc 清)。待用户 5273 眼验:创建按钮(有盘/无盘禁用+title)、创建弹窗选盘+格式化警告切换验到确认前、卷格式化密码弹窗验到确认前、卸载在途防连点。下一期 P3 RAID 只读。

== SP6-P3 RAID 只读(计划 docs/superpowers/plans/2026-07-23-vue3-migration-sp6-p3-raid-readonly.md)==
Base(New-UI): 3b47884  |  Service 不动(P3 纯 New-UI,只调既有 service.raid 只读方法)
P3 Task 1: complete (commits 3b47884..2199e09, review clean; useDiskHotplug 抽取,两视图零测试改动过,full 1281 pass tsc 清)
P3 Task 2: complete (commits 2199e09..9fde202, fix 904e8e1, review clean after fix; Important 已修=countActiveDisks 空 members 回退 total 对齐 Vue2(原 brief 测试名与断言自相矛盾,我起草错,已按 Global Constraint 逐字移植修正);Minor 留档:asRaidArray level 强转测试用数字字面量未真正走 string 强转路径=终审可补;memberSquare 默认分支有意区别 Vue2(未知态不伪装 ok))
P3 Task 3: complete (commits 904e8e1..96dd199, review clean; 21/21 store 测试+tsc 清;Minor 留档:loadRaidDetail 在途守卫无并发测试、array-not-found 回退分支未测(均经 asRaidArray 证实不抛,纯覆盖缺口))
P3 Task 4: complete (commits 96dd199..55ad6b7, review clean; 零字面量色/i18n 13 键双写齐/无写按钮/测试验真渲染;Minor 留档:rc-track 缺 role=progressbar+aria(VolumeCard 有,镜像 a11y 小缺口)、raidCapacity 键疑似 dead(raidNoArrays 由 T6 消费))
P3 Task 5: complete (commits 55ad6b7..1dbb79c, review clean; 递归 setTimeout 单飞 maxInflight===1 真证明/双 stopped 守卫;Minor 留档:post-await stopped 守卫无专测(brief 继承,in-flight-at-unmount 竞态未驱动))
P3 Task 6: complete (commits 1dbb79c..f61b18d, review clean; 218 storage 套+full 1333+tsc 清;hotplug 走 useDiskHotplug 第三消费者、5000ms 重拉真 rebuild-gated、:id 路由留 T9、Shell 三页签 startsWith 高亮、loading 复用 storageLoading 键;Minor 留档:视图层无 poll rebuild-gate/5000ms 可执行测试(静态验证,useGuardedPoll 本体 T5 已测))
P3 Task 7: complete (commits f61b18d..f5edab7, fix a702d2b, review clean after fix; 30/30 store+tsc 清;Important×2 已修:(1)404 检测 e.code??resp.status 改真 OR(axios .code=ERR_BAD_REQUEST 字符串致旧逻辑永不清卡,真机 http.ts 追溯确认)(2)done-clear 1000ms 定时器加 taskId 身份守卫+detect/start/dismiss 清 timer(防窗口内新任务被旧定时器清空);Minor 已修:sparse getTask 合并保真测试。两新测经确认真回归守卫非同义反复)
P3 Task 8: complete (commits f5edab7..1d6d0f9, fix 86b213f, review clean after fix; 125→118 focused+full 1352+tsc 清;6 步状态公式逐字/step4 动态/共享 Dialog v-model:open/portal 测试查 body;Important 已修:--radius-xs 悬空 token→theme.css 共享 :root 定义;Minor 已修:currentStepLabel 越界回退 raidPreparing(step0 不再渲染字面量 raidStep0,新测 load-bearing);Minor 留档:模态标题用 task.name+未标注 error(brief 未列键,裁定可接受,UX parity follow-up))
P3 Task 9: complete (commits 86b213f..86b4b29, fix 424d9be, review clean after fix; 120 focused+full 1360+tsc 清;无写按钮(.rd-recover/delete/replace 缺席回归测试)+无快照面板(P5 注释边界)+donut conic-gradient token 化;0/1/5/6 级别信息逐字对齐 Vue2;Important 已修:RAID10 读写速度改 —(原 raidUtils 数字 5/5 与其余定性词列不一致,对齐 Vue2 空值);Minor 留档:raidLevel10Tolerance 系动态模板必要转述、levelInfo null/btrfs 行无专测、.rc-badge CSS 跨 scoped 组件重复(建议 SP 后期抽共享徽章)、模态标题 task.name+未标注 error)

== SP6-P3 全 9 Task 完成,待整支终审 ==
Base(P3 起点): 3b47884  Head: 424d9be  9 主 commit + 3 fix commit

== SP6-P3 全支终审: Ready to merge = With two trivial fixes → 已修 (402ea6d) ==
终审(Opus,base 3b47884→424d9be,13 commit):无 Critical/无correctness bug;只读边界(无写按钮/无快照)在代码层核实、单飞轮询双守卫真实、status/severity 由 resolveRaidState 单一来源(list/detail 不漂移)、主题/i18n/后端词表 aggregate 成立、与 Vue2 源逐行对齐。Important×1+Minor×1 已修:(1)只读边界回归测试原为同义反复(.rd-recover/delete/replace 从未存在)→ 硬化为按钮计数不变式(baseline=2,StorageShell 回主页+rd-back;新增任何写按钮即红)(2)删 dead raidCapacity 键。顺手:RaidCard 进度条补 role=progressbar+aria(VolumeCard parity)、pollCreateTaskOnce 合并意图注释。Minor backlog:.rc-badge CSS 跨 scoped 组件重复(P4 落写操作时抽共享徽章)、memberSquare 未知态中性化(有意区别 Vue2,已签)、totalDisks members||member_disks(cosmetic)、levelInfo null/btrfs 行无专测。
P3 code-complete: New-UI sp6-storage @ 402ea6d(14 commit=9 Task+5 fix,full 1360+tsc 清)。待用户 5273 眼验后关账。

== SP6-P3 验收结论(2026-07-23,用户反馈)==
设备当前**仅单盘**,RAID 需≥2 盘,故 **RAID 只读功能无法实盘验收**。据计划 §6 口径,标注「未实盘验证(单盘)」随 P6 roadmap 记账。
- 可确认(单盘设备本就该见):/storage/raid 路由可达、StorageShell 第三页签、列表**空态「暂无 RAID 阵列」**——即单盘设备的正确呈现;主页入口。
- 未实盘验证(需多盘阵列/在建任务/重建态才触发):RaidCard 卡片渲染、详情页(甜甜圈/级别信息/阵列信息表/成员列表/RAID10 镜像对)、5000ms 重建态活体重拉、创建任务卡+1500ms 轮询+6 步弹窗、热插拔刷新、亮暗主题下徽章/成员点/甜甜圈配色。
- 质量兜底:全链路已被单测锁死(full 1360 pass+tsc 清),整支终审(Opus)= Ready to merge;只读边界(无写按钮/无快照)代码层+按钮计数不变式双重核实。
- ⚠️ 连带影响 P4:RAID 写操作(创建/换盘/恢复/删除)同样需多盘,单盘设备无法实盘验——P4 若开工,界面+接口层做全+单测锁死,实盘验一并随有多盘设备时补(与本期同口径)。
**SP6-P3 关账:New-UI sp6-storage @ 402ea6d(14 commit=9 Task+5 fix)。实盘验收挂账(单盘),随 P6 一并处理。下一步=用户定:开 P4(RAID 写,同受单盘限制) / 跳 P5 快照(需先部署新后端+多盘) / 其它。**

== SP6-P4 RAID 写操作(计划 docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p4-raid-write.md)==
Base(New-UI): f21fe92  |  Service 不动(P4 纯 New-UI,只调既有 service.raid 写方法 create/remove/replaceDisk/recover)
决策(用户 2026-07-27):① 删除确认=路线B(仅删阵列 type-to-confirm 输入阵列名,create/换盘/恢复照 Vue2 不加密码/输入确认);② 故障模拟器推迟(RaidMatrix 只迁矩阵主体)。
P4 Task 1: complete (commits eca2cb7..d16adea = 实现 d025c7b + fix d16adea, review spec✅; Important 已修:RaidLevelInfo→RaidLevelSpec 避免与 raidView 撞名;Minor 留档:tolerance 编码为不透明字符串('n-1'/'half'),渲染文案时需专门解释函数;非问题裁定:desc/usecase 逐字迁 Vue2 占位文案(brief 令)、recommendRaidLevel 简化签名丢<2盘/混规格→null 前置校验→承接方 T3/T5 选盘阶段补校验、diskSpecKey 额外导出为合理最小分解有测试)
P4 Task 2: complete (commits 133fcbb..2647a50 = 实现 556be76 + fix 2647a50, review spec✅ quality Approved; store 4 写 action+守卫+请求形状单测锁死;Important 已修:recoverRaid 刷新移入 finally 对齐 remove/replace(成败都刷新);Minor 已修:补 remove/replace/recover 守卫复位+日志不含 config 测试(原只有 create 有);create 有意不刷新交轮询=业务语义特化非发挥;38/38 store+全量绿+tsc 零)
P4 Task 3: complete (commits 2647a50..28b7669 = 实现 eeb304c + fix 28b7669, review spec✅ quality Approved; RaidDriveCard+RaidDriveBay 选盘;Important 已修:selectAllHealthy 原对全量 disks(brief/plan 文档写错)→改对 filteredDisks 对齐 Vue2:128-130,补"切 SSD 后全选健康不含 HDD"测试;Minor 留档:空态"无可用硬盘"文案+悬停 tooltip(温度/通电/健康分)未迁=类型无字段+附录B无键→转 T5 向导补空态;卡片无 role=button/键盘(与 Vue2 持平非新退化);SSD/HDD 文字块替代 Vue2 图形图标)
P4 Task 4: complete (commit 28b7669..e86fe62, review spec✅ quality Approved 无 Critical/Important; RaidMatrix 矩阵主体 9行×5列,故障模拟器确认已排除(grep 无 openModal/failDrive/survival/.rm-simulator)、颜色全 token、import RaidLevelSpec 正确、容量数字来自 T1 capacity 对齐 Vue2、+16 i18n 双写;Minor 留档无需改:capPct 重复调 capacity 微冗余、usecase 中译未校(同 raidLevelDesc 占位先例)、.rm-col=表头单元格与 Vue2 rm__mhead 对等非整列容器)
P4 Task 5: complete (commits e86fe62..107284d = 实现 9d2e19d + fix 107284d, review 复审后 spec✅ quality Approved; 创建向导视图+路由(/create 插在 :id 前)+列表入口;请求体逐字{name,level,disk_paths,chunk_kb:512,filesystem,enable_snapshots}/ext4强制false/btrfs默认+快照默认勾选;接线 createRaid→startCreateTask→push;Important×2 已修(1:1 纪律):①恢复选盘自动推荐级别 watcher(userPickedLevel 锁 Vue2 本有:245,非新引入)②补回阵列名去重/必填校验 nameError(Vue2:322-331)+错误文案+i18n 双写;Minor 已修:冷深链 onMounted 补 loadRaid/loadVolumes;6/6+全量1407+tsc/color-guard/parity 绿。**P4 待办 1:1 债(交终审 triage)**:recommendRaidLevel 缺 Vue2"混规格盘→null"前置校验(T1 既有简化,只影响自动推荐便利非硬拦截,单盘无法验))
P4 Task 6: complete (commit 107284d..aacf10d, review spec✅ quality Approved 无 findings; RaidDeleteDialog type-to-confirm(text 非 password,输入===阵列名才启用,开关清空)+详情头 .rd-delete 红按钮接 removeRaid;路线B;Vue2 bug 已修正非照抄:删除主文案小写 key "confirm delete raid" 回退裸 key→用正确 raidRemoveMsg;按钮不变式改语义化(delete 存在/recover&replace 缺席)留 T8 回填注释;偏离仅测试基建 nextTick+beforeEach 清 body 对齐 FormatDialog.test 未削断言)
P4 Task 7: complete (commit aacf10d..82c7db4, review spec✅ quality Approved 无 findings; RaidReplaceDialog(故障盘只读+单选新盘排除故障盘+黄警告+danger 直接执行无二次确认对齐 Vue2)+RaidMemberList degraded&faulty 行 .rml-replace 入口+详情页接线 replaceRaidDisk{old_disk_path,new_disk_path};faulty 判定 state==='faulty' 对齐 Vue2 openReplaceDisk 主路径;原生 select 替 b-select 纯框架差异。**P4 待办 1:1 债(终审 triage)**:Vue2 列表卡 RaidCard degraded 横幅换盘入口未做(New-UI RaidCard 无 degraded 横幅=P3 遗留,brief Files 未列 RaidCard 超本 Task 范围);换盘目前仅详情页可达)
P4 Task 8: complete (commit 82c7db4..cc5adf0, review spec✅ quality Approved 无 findings; .rd-recover 详情头按钮 v-if retrying/failed、无确认直接 recoverRaid、toast 由 store 不重复、warning 用 --dem-fg;偏离=复用 flags.isRetrying||isFailed(raidView 定义等价 effectiveState 比较非重构);回填按钮不变式 active=[delete]/retrying&failed=[delete,recover];全量 1423 全绿+tsc/color-guard/parity)

== SP6-P4 全 8 Task 完成,待整支终审 ==
Base(P4起点): f21fe92(P3关账402ea6d+plan)  Head: cc5adf0  8主commit+6fix
待终审 triage 的 Minor backlog:①recommendRaidLevel 缺 Vue2 混规格盘→null 前置校验(T1简化,只影响自动推荐便利非硬拦截);②RaidCard 无 degraded 横幅→列表卡换盘/恢复入口缺失(P3遗留,写操作仅详情页可达);③recoverRaid finally 无条件刷新 vs Vue2 仅成功刷新(T2有意一致性,已披露);④tolerance 不透明字符串编码、usecase 中译未校(纯文案)

== SP6-P4 全支终审: Ready to merge = Yes (cc5adf0) ==
终审(Opus,base f21fe92→cc5adf0,14 commit):无 Critical/Important;证据门实跑全绿(303 相关测试+tsc 零)。请求形状端到端逐字对齐 Vue2、单飞守卫真实、日志不外泄 config、故障模拟器确认不在代码里(grep 负向)、删阵列 type-to-confirm 无密码、1:1 核心交互全保住(推荐级别 watcher/重名校验/全选健康作用于过滤视图/换盘删除恢复显隐条件)、RaidLevelSpec 改名无混用、color-guard+parity 绿、测试语义化真断言非同义反复。
Backlog 全判可推迟:①recommendRaidLevel 缺混规格→null(canCreate 仍强校 levelMinOk,不产错误请求)②RaidCard 无 degraded 横幅(写入口详情页闭环完整)③recoverRaid finally 无条件刷新(无害+四写一致,已披露)④tolerance 不透明串/usecase 中译(纯文案无行为依赖)。另记:创建向导相对 Vue2 有已披露的可见内容精简(级别卡副标/容错pill/健康点/混盘容量警告/容量callout/读写pip 未迁)——其中"混盘按最小容量"提示略偏数据安全,建议随①+多盘实盘验一并补。
收尾门:全量 1423 测试全绿+tsc 零错+pnpm build 成功(dist index-9loPSBMS.js)+5273 预览 200。
P4 code-complete:New-UI sp6-storage @ cc5adf0(14 commit=8 Task+6 fix)。**单盘设备无法实盘验 RAID 写操作(需≥2盘)**——界面+接口层做全+单测锁死请求形状,实盘验随多盘设备补(同 P3 口径)。禁区遵守:未部署/未合并/未改 NimoOS-UI 仓/未改 roadmap(推迟 P6)。待用户 5273 眼验纯 UI 交互(创建向导选盘/级别卡/矩阵展开/文件系统与快照联动/重名校验/无盘空态、详情页写按钮显隐)后关账。

== SP6-P5 btrfs 快照面板(计划 f5c3f10)==
Base(New-UI): f5c3f10(P4 关账 cc5adf0 + 计划)  |  Service 不动(P5 纯 New-UI,只调 P0 已进包的 service.snapshot)
决策(用户 2026-07-27):①不部署新 local-storage 后端(/v2/snapshot/* 现网 404,走优雅降级);②时间线 [浏览] 不做,文件区快照套件整体记台账留独立一期;③验收以单测+终审为准,面板眼验挂账(单盘无阵列)
P5 Task 1: complete (commits f5c3f10..99b7f3f, review clean; Minor: SnapshotItemView.type 收窄 string|undefined)
P5 Task 2: complete (commits 99b7f3f..a854ce9 = 实现 12bbfa1 + fix a854ce9, review clean after fix; spec ❌→修:zh_cn 6 条 toast 文案对齐计划附录 A;两处授权偏离已注释登记=savePolicy 不吃 PUT 空响应(Vue2 显示 undefined 的真 bug)、store 直连取代 slot+refreshSignal+@deleted;Minor 留档:日志不含 config 断言只覆盖 loadVolume)
P5 Task 3: complete (commits a854ce9..8c21d2a = 实现 aab468a + fix 8c21d2a, review spec✅ quality Approved after fix; 三态/状态文案分支/state watcher 只在转入 enabled 拉一次策略 逐字对齐 Vue2;手写 role=switch 替 b-switch;Important 已修=开关补 aria-label(Vue2 b-switch 自带 label 关联,移植版曾丢失,新测真回归);Minor 留档:点开关触发 loadPolicy 路径无专测)
P5 Task 4: complete (commit 8c21d2a..5114ed3, review spec✅ quality Approved 无 Critical/Important; 高级表单 openAdvanced 默认 24/7/4/90、cancel 不回写、校验失败不发请求且不收起、创建成功才清备注、在途禁用、摘要让位 全部逐字对齐 Vue2;原生 number input 替 b-numberinput;10 键双写逐字照附录(brief 正文写 9 是笔误,附录为准);Minor 留档:取消清错误测试无法隔离、Number() 包裹多余)
P5 Task 5: complete (commits 5114ed3..d24babd = 实现 aef7f02 + fix d24babd, review spec✅ quality Approved after fix; 分组倒序/展开闸门/换卷重置/条目 key/hover 动作区可 tab 逐字对齐 Vue2;[浏览] 按钮按决策不迁(占位注释+负向断言);Important 已修=换卷重置展开态硬化为真回归(注释实现即红);顺带补 Vue2 折叠过渡(计划文本漏写的 1:1 缺口,Vue3 -enter-from 语义);Minor 留档:.st-browse 负向断言偏弱、组头无 aria-expanded(Vue2 亦无)、附录 T5 实为 7 键)
P5 Task 6: complete (commit d24babd..e84cb53, review spec✅ quality Approved 无 findings; SnapshotDeleteDialog 一次点击确认(不加 type-to-confirm,那是删阵列强度)、正文时间用 toLocaleString 逐字、取消/在途禁用/先弹窗后发请求全对齐 Vue2;.st-delete 接 store.removeSnapshot;portal 测试清 body 卫生到位)
P5 Task 7: complete (commit e84cb53..e32e74e, review spec✅ quality Approved; 详情页左栏挂 SnapshotPanel + 详情页测试补 snapshot 域 mock(不削弱 P3/P4 写按钮不变式)+ 404 降级用例(面板落不支持态而阵列名/成员/删除按钮照常);授权偏离=v-if="detail" 时序门;收尾门:全量 1498 绿+tsc 零错+color-guard/parity 绿+build index-Cc3SeX-v.js+5273 返回 200 哈希一致)

== SP6-P5 全支终审: Ready to merge = With fixes → 修复后 Yes (2ffb128) ==
终审(Opus,base cc5adf0→e32e74e,11 commit):逐字移植质量高(请求形状/三态可见性/策略读-改-写/换卷重置展开态都有能真失败的测试),纪律项全清(token 化零字面色、38 个 snap* 键 zh/en 逐字对齐附录 A、catch 只记 message、无 .at()、只动 New-UI 仓 15 文件)。
Critical×1(本期新引入,已修):把状态从 Vue2 组件 data() 提到 Pinia 单例后漏了复位与 volumeUuid watcher(时间线有、面板没有)→ 换阵列后面板显示 A 的开关/快照数/策略摘要,写操作却打到 B(保护开关与保留策略静默错目标写入)。修:store.reset() + onMounted/watch 先 reset 再 load + 过期响应守卫 + 空 uuid 早退(2ffb128,范围化复审 7 条全 ADDRESSED、无新破坏)。
Important I1(仅披露):删除弹窗失败不关闭 = 有意偏离 Vue2(buefy 点确认即关),已注释登记。
收尾门:全量 246 文件 1505 测试绿 + vue-tsc 零错 + color-guard/parity 绿 + build index-CSbH2ajJ.js + 5273 返回 200 哈希一致;真回归自检(删 watcher 3 条转红)。
P5 关账坐标:New-UI sp6-storage @ 2ffb128(12 commit = 计划 1 + Task 7 + fix 4)。**快照卷 == RAID 阵列(后端 currentVolumes()=VolumesFromRAIDArrays),单盘无阵列 → 面板无法实盘验收**,随多盘设备与 P3/P4 一并补(用户 2026-07-27 拍板:以单测+终审为准)。
台账(P6 合并时进 roadmap):①文件区快照套件整套未迁(只读横幅/时间轮/浏览/恢复/设置弹窗/snapshotBrowse.js + 后端 file-versions 与 restore)=SP4 遗留缺口,本期新登记,时间线 [浏览] 因此缺席,建议独立一期;②后端未部署(设备 local-storage 仍 2026-06-22 版,/v2/snapshot/* 全 404,本期走优雅降级);③P3 遗留:详情页无路由 :id watcher,直接改 URL 跨阵列跳转整页停旧数据(推迟 P6);④Vue2 bug 已修正不照抄:savePolicy 后摘要显示 undefined(后端 PUT 返回 data:null,Vue2 把信封当策略对象);⑤有意偏离:store 直连取代 slot+refreshSignal+@deleted、校验错误改具名 i18n 键、b-switch/b-numberinput/$buefy.dialog.confirm → 手写开关/原生 number input/共享 Dialog、manual 紫→--accent 与 preop 琥珀→--dem-fg、删除弹窗失败不关闭。
