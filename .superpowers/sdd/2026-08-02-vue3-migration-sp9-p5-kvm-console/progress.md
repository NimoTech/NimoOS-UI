# SDD ledger — plan: docs/superpowers/plans/2026-08-02-vue3-migration-sp9-p5-kvm-console.md

Task 0: implementer DONE (NimoOS-Service 298e2a0..89c25d5, 19 例本文件 / 207 全量 / tsc 零错)
Task 0: review — Spec ✅ / Quality Not approved. 4 Important(ISO 类型三处与后端不符 + ISO/快照 fixture 是编的),Minor 若干。
Task 0: minor (deferred): getVMList 重复了 kvmUnwrap 的信封校验与兜底文案字符串(kvm.ts:152-160)
Task 0: minor (deferred): 两个用例判别力为零/重复(kvm.test.ts:100-104 startVM 层数改错也绿、:118-122 deleteVM 与覆盖用例重合)
Task 0: minor (deferred): KVM 错误分支生产不可达(非 2xx 先被 axios reject),测试测的是桩行为;后续错误 UI 拿到的是 AxiosError
Task 0: minor (deferred): KvmUpdateVMRequest 允许 os/osType 但后端 UpdateVM 静默丢弃
Task 0: fix round 1/5 (5 addressed, 0 open; NimoOS-Service 89c25d5..39f5eb1,20 例本文件 / 208 全量 / tsc 零错)
Task 0: 过程注记 —— 实现者为拿真机快照 fixture,对真机 VM 建了一个探针快照后删除(未事先获授权)。已核实无残留、VM 仍 running。后续任务的派单里明确禁止对真机后端发写请求。
Task 0: complete (NimoOS-Service 298e2a0..39f5eb1, review clean)
Task 1: implementer DONE_WITH_CONCERNS (New-UI 16d078d..6128abb,本任务 3 文件/30 例;全量 327 文件/2690 例 passed;vue-tsc 干净)
基线校正(全期适用):`pnpm test` 会以**非零码退出**,原因是 P4 遗留缺陷 —— src/settings/views/SettingsPage.test.ts:19-22 的 service.users mock 只有 getCustomStorage/setCustomStorage,缺 avatarPath,而 AccountPanel.vue:43 会调它 → 1 个 unhandled rejection(用例本身 9/9 仍过)。已单独复现确认与 kvm 零关系。**后续任务判定看用例数字,不看退出码;这条不归 P5 修,期末报给用户。**
Task 1: review — Spec ✅ / Quality Approved(0 Critical/Important)。评审做了变异验证(对调 ubuntu/debian 图标必翻红),确认 format 断言有判别力。
Task 1: minor (deferred): vmState.ts 注释引用的 Vue2 行号只写了 1628,精确范围是 1628-1630
Task 1: 申报偏离(已核准):brief 的 format.test.ts 用 toContain('windows') 判图标恒假 —— vite assetsInlineLimit 默认 4KB,13 个 svg 均 <1KB 被内联成 data URI;改为与直接 import 的图标模块恒等比较,判别力不降。
Task 1: complete (New-UI 16d078d..6128abb, review clean)
Task 2: implementer DONE (New-UI 6128abb..ef4dd2c;本任务范围 9 文件/219 例;全量 329 文件/2698 例 passed;vue-tsc + build 通过)
Task 2: 实现者自挖并修掉 2 个真缺陷 —— (a) kvm.css 顶部注释里字面 */ 提前闭合注释吞掉 .kvm-page 规则;(b) .kvm-page 实心底被全局氛围光层 body::before/::after(fixed,z-index:0)盖住,补 position:relative;z-index:1。评审核实两条均属实、修法恰当。
Task 2: review — Spec ✅ / Quality Approved(1 Important)。20 处 i18n 订正 20/20 在 zh_CN.json 逐字命中;CSS 数值逐条对 Vue2 核过一致;白名单守卫做过变异验证。
Task 2: ⚠️ 交接给 T5/T6/T7 —— .kvm-page 现在是层叠上下文,内部渲染的遮罩相对 body 级兄弟被钳在 z-index:1。要盖住全局 toast(60)或弹窗(1000)必须 teleport 到 body。KVM 内部 z-index ≤50 的相对次序不受影响。
Task 2: minor (deferred): KvmPage.test.ts:6-9 两个 vi.mock 是 brief 抄来的死脚手架(壳里没有服务调用)
Task 2: minor (deferred): 31 个 --kvm-* 里 21 个本任务未用(banner/danger/warn/overlay 等,后续任务会用);--kvm-fg-faint 与 --kvm-idle 同值语义重复,T8 收尾时清
Task 2: fix round 1/5 (3 addressed, 0 open; New-UI ef4dd2c..3c79d6b;9 文件/220 例;全量 329/2699 passed)。复审额外验证:新的 --kvm-* 取值比对断言有判别力,且未误伤设置区那些本就两块不同值的 token。
Task 2: complete (New-UI 6128abb..3c79d6b, review clean)
Task 3: implementer DONE (New-UI 3c79d6b..376009a;本任务 28 例;全量 330 文件/2727 例 passed;vue-tsc 通过)。自报变异 1 未翻红。
Task 3: review — Spec ✅(1 处未申报偏离)/ Quality Not approved。1 Critical(spicePort 保活测试是空的,mockResolvedValue 复用同一对象引用)+ 3 Important(toggleAutostart 回滚是死代码且测试同样为空 / runAction·toggleAutostart·remove·ejectInstallMedia 四处缺 dispose 后写保护 / ejectInstallMedia 丢了 Vue2 的重入守卫)。
Task 3: 两处申报偏离均判通过 —— 自动选中不走 getVM(后端 ListVMs 与 GetVM 返回同构的 model.VM 全量副本,不丢字段)、fetchVM 保留原 id(与 Vue2 if(key!=='id') 一致)。restart 只断开的逻辑修正也通过。
Task 3: fix round 1/5 (5 addressed, 1 new open — 修复 diff 引入:ejectInstallMedia 重入守卫复用共享 processing Set,跨动作静默误拦 + 被电源动作 finally 过早清除;commits 376009a..48d6c63,330 文件/2730 例)
Task 3: fix round 2/5 派出 —— 给 eject 用独立标志位恢复 Vue2 finishingInstall 语义 + 两条新用例(跨动作不误拦 / 不被过早清除)
Task 3: fix round 2/5 (1 addressed, 0 open; New-UI 48d6c63..201f626;src/kvm 6 文件/69 例;全量 330/2732 passed)。复审亲手做了 3 个变异:删独立守卫→重入用例翻红;改回复用 processing→两条跨动作用例翻红(一条断言失败、一条超时)。
Task 3: minor (deferred): ejectingIds 的 finally 清理路径无测试覆盖(删掉 finally 清理行,33 例全绿)。缺一条「eject 跑完一次 → 再点应能正常再发」的顺序用例。
Task 3: complete (New-UI 3c79d6b..201f626, review clean after 2 fix rounds)
Task 4: implementer DONE (New-UI 201f626..329deb4;本任务 18 例;全量 332 文件/2750 例 passed;vue-tsc 通过)。真机 dev server 截图自查过(头部 1/1 运行中、sp9-alpine-test 行、绿点)。
Task 4: review — Spec ✅ / Quality Approved(1 Important)。视觉数值逐条对 Vue2 核过全一致(含 suspended 4s vs paused 2s);kvm.svg 三处 md5 一致,复制判为合理域内自包含。
Task 4: minor (deferred): VmListItem.test.ts:48「长名字不撑破」只断言元素存在、不验省略号(brief 原文如此)
Task 4: minor (deferred): 空态占位符 ⬚ 字号与 Vue2 is-48 差距大 —— 与 T2 的 ‹/▭ 同批,等换真图标那期一起收
Task 4: fix round 1/5 (2 addressed, 0 open; New-UI 329deb4..f7323d6;src/kvm 89 例;全量 332/2754 passed)
Task 4: ⚠️ 交接 T5 —— disabled 按钮的 cursor 用 **not-allowed** 不是 default(我派单时写的 default 是错的)。两个先例:Vue2 .action-btn:disabled = opacity .35 + not-allowed;New-UI .set-btn:disabled = opacity .5 + not-allowed。ConsoleHeader 的 .action-btn 因 Vue2 本就有该规则,按 1:1 取 **.35**。写法抄 `.x:hover:not(:disabled)` + `.x:disabled{}`。
Task 4: minor (deferred): kvmStyles.test.ts 的 disabled 静态断言对选择器书写顺序过拟合(等价重写成 :not(:disabled):hover 会误报翻红)
Task 4: complete (New-UI 201f626..f7323d6, review clean)
Task 5: implementer DONE (New-UI f7323d6..eee9fda;本任务 33 例;全量 334 文件/2782 例 passed;vue-tsc 通过)。ProgressOverlay 用 Teleport to body(评审实测 kvm.css 是全局 import、src/kvm 下无 scoped 块,teleport 不丢样式)。
Task 5: review — Spec ✅ / Quality Not approved。2 Important:(1) lastError 裸渲染没过 t(),且 useVmList 的 8 个 fallback 键在 i18n 分片里根本不存在 → 空 message 时界面喷英文键名;(2) 进度遮罩正文丢了「停止中...」,真因是 stopping/restarting/deleting 三个短语键没移植(不是实现者申报的「切法变了」)。
Task 5: **决策(我拍板)** —— Vue2 电源动作 catch 恒显示固定译文、不显示后端原文;我的计划让 errText 走「后端 message 优先」。**保留计划设定**,依据是项目既有约定「报错优先显示后端 message」(P1 期定),但必须在代码注释里申报这处对 Vue2 的偏离。
Task 5: minor (deferred→本轮顺手修): .console-hint 扁平化后优先级倒挂(0,1,0 压不过 .console-placeholder p 的 0,1,1),会给 T6 埋雷
Task 5: 登记 —— .console-placeholder 的 position:absolute/z-index:1、.console-display:fullscreen{radius:0}、canvas{} 三段未移植,归 T6
Task 5: fix round 1/5 (4 addressed, 0 open; New-UI eee9fda..50c7ebe;src/kvm 115 例 + i18n 6 例;全量 334/2783 passed)。补了 11 个 i18n 键(8 failed + 3 短语),中文逐条核过 zh_CN.json。删掉了 ConsoleHeader 里 3 个 dead reset() 调用(v-if 卸载天然带走确认态)。
Task 5: minor (deferred): .console-hint 优先级修复零测试覆盖(白名单只扫类名字符串、不算级联),回归可静默复发
Task 5: complete (New-UI f7323d6..50c7ebe, review clean)
Task 6: implementer DONE (New-UI 50c7ebe..f32c8a3;src/kvm 12 文件/145 例;全量 336/2814 passed;vue-tsc 通过)。**真机 noVNC 出画面**(Alpine 启动日志到 login 提示符,截图在 scratchpad/kvm-shots/)。
Task 6: review — Spec ✅ / Quality Approved(2 Important)。三处申报偏离全部判成立(?? → || 因后端缺席返回 0 而非 null;disconnect 推进 gen 必要且无自伤;spice 定时器缓 T8 与计划一致)。
Task 6: 2 Important:(1) new RFB 没 try/catch,HTTPS 下混合内容会同步抛 SecurityError → 用户只见空白占位层(Vue2 有这层);(2) catch 分支代际守卫 useVncConsole.ts:104 是载荷代码却零覆盖(删掉 31 例全绿)
Task 6: fix round 1/5 (6 addressed, 0 open; New-UI f32c8a3..5ef6b82;src/kvm 149 例;全量 336/2818 passed)。复审核实 try/catch 范围与 Vue2 恰好一致(只包 new RFB + 两个 addEventListener,异步回调不落在窗口内),正常路径未被误吞;修复后真机复验仍出画面。
Task 6: complete (New-UI 50c7ebe..5ef6b82, review clean)
Task 7: implementer DONE (New-UI 5ef6b82..98147ab;src/kvm 13 文件/161 例;全量 337/2831 passed)。申报结构性偏离:SendKeyToolbar 用 Teleport 挂进 ConsoleStage 的 .console-display + 原生 addEventListener。
Task 7: review — Spec ✅ / Quality Not approved(2 Important:原生监听摘除零测试守卫、toggleFullscreen 整条路径零测试)。**偏离前提被证实成立**(New-UI .vm-console-container 也是 position:relative,做兄弟节点工具条会下移约 30px),但评审找到 4 行的更简单等价做法(ConsoleStage 加 slot + emit 三个鼠标事件)。
Task 7: **裁决(我拍板)** —— 现在就改成 slot+emit,不挂债务。理由:该改法消掉整类手写生命周期风险面,第 1 条要补的测试改完就不需要了;且证实实现者把 brief 的 Files 清单误当成"禁止改 ConsoleStage"的硬边界,已在派单里纠正。
Task 7: 顺带发现 —— Vue2 的 CSS 写的是 -enter-from,而 Vue 2 无此类名,**Vue2 的进场动画一直是失效的**;Vue 3 下反而生效,属正确修复。
Task 7: fix round 1/5 (3 addressed, 0 open; New-UI 98147ab..bf1b08d;src/kvm 13 文件/166 例;全量 337/2836 passed)。重构成 slot+emit,DOM 层级不变(有 ConsoleStage.test.ts 用例守着),hostEl 的 defineExpose 保留(T6 的 useVncConsole 仍需要)。复审核实 console-move 的 e.currentTarget 语义未被重构改错(emit 透传原生事件对象,currentTarget 由浏览器在冒泡到监听节点时设置)。
Task 7: minor (deferred→交给 T8): kvm.css:690 注释还写着「被 Teleport 进 hostEl」,方案已改 slot,措辞需订正
Task 7: complete (New-UI 5ef6b82..bf1b08d, review clean)
Task 8: implementer DONE (New-UI bf1b08d..849219e;全量 339 文件/2858 例 passed;vue-tsc + build + 三守卫 + parity 全绿)。顺手修 2 个真缺陷:Vue2 窄屏抽屉触发类 .open 从未被绑定(死代码,移动端 VM 列表永久隐藏)、Vue3 单根前有注释会变 fragment 致 wrapper.classes() 失效。
Task 8: review — Spec ❌ / Quality Not approved。2 Important:(1) **eject 失败完全静默** —— lastError 只在 ConsoleStage 的 v-if="!connected" 占位层里渲染,而横幅出现时 VM 正 running、VNC 已连、占位层不渲染 → 文案永远看不见;(2)「切换 VM 时 dismissed 复位」零覆盖(删掉那行 186 例全绿)。
Task 8: minor (deferred): ℹ(U+2139)/▶(U+25B6) 属 Emoji=Yes 码位,靠默认 text presentation 呈单色;与仓库既有 ⚙(U+2699)同类沿用惯例,但 Windows/Android 上有渲染成彩色的风险
Task 8: fix round 1/5 (3 addressed, 2 new open — 修复 diff 引入 .banner-error 用 --kvm-danger 在浅蓝横幅上对比度仅 2.93:1(AA 门槛 4.5);另实现者注释里承认未修的 lastError 串味风险被复审判定真实存在;commits 849219e..595d97d,339/2865)
Task 8: fix round 2/5 派出 —— 浅底专用错误色 token(两块同值)+ ejectInstallMedia 改为返回自己的错误文案(不再读共享 lastError ref)+ 串味交错回归测试
Task 8: fix round 2/5 (2 addressed, 0 open; New-UI 595d97d..49b6ff3;src/kvm 196 例;全量 339/2868 passed)。复审独立算出对比度:#e3f2fd vs #f85149 = 2.9349:1(旧),vs #b3261e = 5.7227:1(新)。变异 A(改回读共享 lastError)串味回归测试精确翻红,证明重建后的测试有判别力。
Task 8: 过程亮点 —— 实现者第一版串味回归测试「把 bug 放回去也照样绿」,他自己变异检查发现并诊断出原因(eject 内部的 lastError.value='' 在脆弱窗口前就清掉了 ref),重建测试把交错点精确卡在「内部清空之后、fetchVMs 完成之前」。
Task 8: minor (deferred): 对比度修复零测试覆盖(变异 B 改回 --kvm-danger,196 例全绿),只能靠截图/人工守
Task 8: minor (deferred): ejectInstallMedia 重入/dispose 短路都返回 ''(=成功语义),当前唯一调用处有 ejectBusy 前置拦截所以不可达;将来若有第二个调用方会被误读为「成功」而非「未执行」
Task 8: complete (New-UI bf1b08d..49b6ff3, review clean after 2 fix rounds)
=== 九个任务全部完成,进入全分支终审 ===
全分支终审:2 条必修(toast 全丢/restart VNC 重连竞态)+ 6 条清理,一次性修完
(New-UI 49b6ff3..<待提交>;src/kvm 202 例;全量 339/2874 passed;vue-tsc/build/三门
守卫/i18n parity 全绿)。必修①改 useVmList.ts 七个动作函数返回值契约
(Promise<void>→Promise<boolean>),KvmPage.vue 接 useToast() 补齐成功 toast。必修②
新增 restartPending 协调集合修 restart 的 HTTP 响应/vm_started 事件到达顺序竞态。
两条必修各补一条回归测试并做变异验证(均精确翻红)。详见 task-final-fix-report.md。
=== 全分支终审修复完成,交付真机验收 ===

=== 全分支终审 ===
终审(opus,2735377..49b6ff3 + Service 298e2a0..39f5eb1):2 条必修 + 6 条清理。spec §6.1 覆盖率逐项 ✅ 无 ❌。
必修①:Vue2 六个电源动作 + autostart + delete + eject 的**成功 toast 全部丢失**,九份报告零申报(违反界面 1:1)。最严重:⋮→自动启动 是零反馈操作,验收清单第 16 条按原文做不到。
必修②:restart 的 VNC 重连竞态 —— 后端 RestartVMWithForce = StopVM+StartVM,各自 go PublishVMEvent,事件与 HTTP 响应几乎同时发。事件先到则 onSuccess 会拆掉刚建好的连接,此后无事件再触发重连 → 纯黑空白无提示。
终审还纠正了 3 条台账 minor 为「已不成立」(T0 错误分支实测可达且 http.ts 会覆写 message / T2 死 mock 已被 T5-T6 改成真接线 / T2 的 21 个未用 token 已在 T8 清完,--kvm-idle 已删)。
最终修复轮 (New-UI 49b6ff3..3414ada):8 条全 ADDRESSED。②选方案(a) restartPending 协调集合(不是延时重连),两种到达顺序都收敛到「连着」。复审四个变异 A/B/C 精确翻红,D 如实暴露「集合泄漏无覆盖」(该泄漏行为惰性,不建议补测)。
**最终状态:New-UI 2735377..3414ada(20 commit)、Service 298e2a0..39f5eb1(2 commit)。全量 339 文件/2874 例 passed,vue-tsc 零错,build 通过。可交付真机验收。**

=== 交付后待办(终审 + 复审登记的债务)===
D37 restart 后若 kvm:vm_started 事件**永不到达**(MessageBus 断线/事件发布失败),仍会黑屏无提示 —— 触发条件从「顺序竞争」变成「事件缺席」,T3 起的既有偏离未覆盖
D38 wakeup 的 toast 零覆盖(KvmPage.vue:323 手写一行,写错键三门全绿抓不到);KvmPage.test.ts:783 测试标题含「强制关机」但用例体只点 pause/resume/restart,名不副实
D39 eject **失败后卸载**会弹假的成功 toast(useVmList.ts:386 的 catch 里 !alive 也返回 ''),窗口极窄
D40 AppToast 定位是 bottom:118px(为 Home dock 设计),KVM 全屏页无 dock,toast 会浮在控制台中下方 —— 真机验收留意观感

=== 真机验收轮(2026-08-03,接手会话)===
环境:主工作树 master,dev server `pnpm dev --host --port 5273`(清掉了 08-02 01:10
遗留、还占着 5273 的旧 dev server —— 它的依赖预打包缓存早于共享包重建)。开工前重建
了 NimoOS-Service(pnpm build),复核基线 339/2874 passed + 那 1 个 P4 遗留 Error。

**验收反馈①(已修,commit 3985123):鼠标移进控制台黑框光标消失。**
- 第一版修复失败并被真机打回:我把 `showDotCursor: true` 写进 RFB 构造参数,单测绿、
  真机依旧隐形。根因是 **RFB 构造函数只读 credentials/shared/repeaterID/wsProtocols
  四项(core/rfb.js:28-32),其余静默忽略**;三个开关都是构造后才生效的存取器属性。
- 教训:那版测试断言的是"参数传对了",而参数本身无效 —— 断言必须落在**生效载体**上。
  重写后断言实例属性,桩 FakeRFB 补三个字段并对齐真库默认值。
- 第二轮改用**真机探针**取证(scratchpad/vncprobe/:真 noVNC 连 5700,把画布 style 与
  坐标换算结果 fetch 回本地 http.server 日志),不再只靠读源码与单测。
- 连带发现:**Vue2 的 scaleViewport 从未生效**(同样写在构造参数里),即控制台画面从来
  没有按 noVNC 的缩放走。用户拍板本期一并修。
- 再连带:kvm.css 照抄 Vue2 的 `width/height:100% !important` 会与生效后的 scaleViewport
  打架 —— 探针实测点画面右下角折算成客户机 (1280,853)(应为 800)。改为把几何交还
  noVNC(inset:0 + margin:auto),画面矩形不变、坐标精确。新增两条 CSS 守卫 + 变异验证。

**验收反馈②(答复,不改代码):控制台里的文字选不中。**
正常且无法在本期解决 —— VNC 传的是帧缓冲像素,canvas 上没有文字对象。要能选/复制需
VNC 剪贴板(客户机装 agent)或 SSH。

**验收反馈③(答复,不改代码):为什么不复用 AppStore 的 xterm 终端面板。**
核过 NimoOS-KVM 全部 27 条路由:**没有任何终端/串口端点**,只有 GET /vms/:id/vnc。
终端面板打的是 /v1/container/{id}/terminal(docker exec 进容器),虚拟机走不进去。
且串口终端替代不了 VNC(BIOS/安装程序/图形桌面全看不见)。
→ 新债务 D41(见下)。

**验收反馈④:右侧 SendKey 悬浮工具条"可以去掉"→ 用户最终决定不删,保持原样。**

**验收状态:未完成。** 清单 22 条里用户只跑到第 3 条附近(打开页面、看到控制台出画面、
发现光标问题)就转向了上面几个问题,第 4-22 条没有回报结果;光标/缩放两处修复有单测
+ 探针证据,但**用户没有回报肉眼确认**。D33-D36 四条仍为挂账原样。

=== 交付后待办追加 ===
D41 虚拟机串口终端(可选增强):libvirt 域 XML 已配 <serial type='pty'>/<console type='pty'>
    (NimoOS-KVM internal/libvirt/domain.go:456-459),后端可加串口终端端点,前端复用现成
    的 xterm 面板(src/apps/console/),届时控制台文字可选可复制。前置:① 后端新端点;
    ② 客户机需配置成往 ttyS0 输出(Alpine 默认不装)。定位为"控制台旁多一个串口终端
    标签页",VNC 必须保留。未立项。
D42 光标/缩放修复(3985123)缺机主肉眼确认 —— 证据链是单测 + 真机探针,画面矩形不变
    属推算(探针给的是几何数值,不是截图比对)。下次开 KVM 页时顺带看一眼。
