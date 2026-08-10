# SDD ledger — plan: docs/superpowers/plans/2026-08-10-sp12-t10-ops-progress-and-drop-reliability.md

分支 `sp12-files-fixes`,worktree `.claude/worktrees/sp12-files-fixes`。
BASE(计划提交后的起点) = `c0da879`。

## 开工前扫描(pre-flight)

控制器扫出**自己计划里的两条缺陷**,派活前已修(提交 `pre-flight` 一并计入):

- **P1 —— Task 7 首条测试名不副实。** 原文叫「reports a disconnect instead of
  silently dropping the chunk」,实际直接调 `handleDisconnect()`,**没走 `sendRaw`
  的无通道分支**,且与 Task 6 重复。已重写成三条真的走 `RTCPeer` 分支的用例
  (`onChannelClosed` / `connectionState='closed'` / `sendRaw` 无通道),并补了
  `FakeConn` 全局替身 —— 因为 `refresh()` 会 `new RTCPeerConnection`,jsdom 没有。
- **P2 —— fake timers 会与 `vi.waitFor` 死锁。** `FileChunker` 靠 `FileReader` 真异步
  推进,`vi.waitFor` 靠 `setTimeout` 轮询;普通 `vi.useFakeTimers()` 把两者一起冻住,
  Task 8/12 会**挂死而不是变红**。全计划 8 处统一改成
  `vi.useFakeTimers({ shouldAdvanceTime: true })`,并在 Task 8 加了显式警告。

其余无自相矛盾之处。i18n 键、`filesCancel` 复用、`ACK_TIMEOUT_MS` 等交叉引用已核对一致。

**计划期已更正的腐烂前提**:票 A(`installUnloadGuard` 装在 `Files.vue`)**早已修好**
(现在 `src/App.vue:75` + `src/App.unloadGuard.test.ts`)。Task 13 的理由已从「照先例反着
来因为那边是错的」改成「按作用域各就各位」。

## 进度

(尚未开工)
Task 1: 实现完成,提交 `decd902`(新建 `opsRow.ts` + 测试,9 例)。实现者顺带指出**brief 里「13 例」是我写计划时的数字错误**,实际 9 个 `it` —— 无害,记下。
Task 1: 评审 —— spec ✅ / 质量 Approved。评审员自己核了 `fileOps.ts` 确未进 diff(`git diff -- src/files/util/fileOps.ts` 为空),两个 `taskPercent` 语义真的并存;并**逐条反查了 tautology 风险**:`.filter(Boolean)` 去掉会让 trailing-slash 那条真红、`Math.min(100,…)` 去掉会让超额那条真红 ⇒ 非摆设。变异验证(null→0)命中唯一正确目标。
Task 1: minor (deferred): `Math.max(0, pct)` 无用例覆盖(需要负的 `processed_size`,后端不产生)。该行是计划原文给的防御式代码,非实现者自加。
Task 1: complete (commits efcbda6..decd902, review clean)
Task 2: 实现完成,提交 `a598921`(`resolveUploaderHeader` + 两个 locale 各加 2 键)。23 例绿,顺带跑了全量 688 文件/11080 例全绿。
Task 2: 评审 —— spec ✅ / 质量 Approved,1 条 Minor。评审员逐条核了两个 locale 的键名与字面文案、确认 Task 1 三个导出未被改动。
Task 2: minor (deferred): **计划里第 5 条测试(「resolves every header key in both locales」)是 tautology** —— 它只断言三个返回键在两个 locale 里都真值,不检查「哪个输入对应哪个键」。评审员给出了能让它保持绿的具体变异(把两个分支的返回值对调)。真正的保护来自第 1、3 条(断言精确相等),故不阻塞。**这条是我写计划时的缺陷,不是实现者的**;同类「resolve in both locales」测试只在没有别处钉死映射时才值得写。
Task 2: complete (commits decd902..a598921, review clean)
Task 3: 实现完成,提交 `3a747a4`。8 例绿(3 新 + 5 既有),`src/files/` 121 文件/943 例全绿。
Task 3: **实现者逮到计划里的一处真 bug** —— Step 3 代码块把 `watch(opsCount, …)` 写在 `opsCount` 的 `computed` **之前**,`<script setup>` 的 TDZ 会抛 `ReferenceError: Cannot access 'opsCount' before initialization`,一挂载就炸。他改为重排顺序(纯机械,行为不变)。另:`UploadPanel.test.ts` **本就存在**(5 条既有用例),他改为追加而非新建。两条都主动披露。
Task 3: 评审 —— spec ✅;质量 1 条 Important。评审员自己跑变异(只删新增的 `watch` 块 ⇒ 恰好第三条真红、其余 7 条绿)、自己核了「delete all」按钮的 `v-if` 与头部文案确未被动。
Task 3: **Important(源自我的计划,非实现者)** —— 三条新测试重复安装 i18n 插件。`vitest.setup.ts` 已经全局装了同一个 `i18n` 单例,而 VTU 是**拼接**不是替换 `global.plugins` ⇒ 同一个插件对象被 `app.use()` 两次,Vue 打 `[Vue warn]: Plugin has already been applied`。**默认 reporter 不打印通过用例的告警**,评审员是自己跑 `--reporter=verbose` 复现的 —— 正中本仓 `vitest-reporter-hides-warnings` 那条旧教训。
Task 3: **控制器裁定** —— 该发现与计划里的测试代码冲突,但那是**机械疏漏不是设计决策**(与 P1/P2/TDZ 同类),判:修,不问机主;裁定入账。
Task 3: fix round 1/5 (1 addressed, 0 open; commits `3a747a4`..`f0cf4de`)。复评员**自己前台重跑** `--reporter=verbose` 确认告警消失且 8/8 绿;并用 `git show 654c46b:` 取证确认另一条 `Component "i18n-t" has already been registered` 告警**早于本任务存在**(那 5 条既有用例自建 `createI18n`),与本次修复机理不同。
Task 3: minor (deferred): `UploadPanel.test.ts` 里 5 条既有用例自建 `createI18n` 叠在全局安装之上,持续打 `i18n-t 已注册` 告警。本批未动(brief 明令不许碰),建议后续顺手清理。
Task 3: complete (commits a598921..f0cf4de, review clean after 1 fix round, 1 minor deferred)
Task 4: 实现完成,提交 `86cd807`。「文件操作」分组 + 头部三态接线 + `filesUploadZoneOps` 键。全量 688 文件/11088 例绿。
Task 4: **实现者又逮到一处计划没写的真缺口** —— 面板初始 `open` 只算 `store.queue.length`,不算 ops ⇒ **挂载时就已有粘贴任务的话面板不会自动展开**。Task 3 加的 `watch` 只管挂载后的跃迁。他 OR 进 `shouldAutoOpenUploadList(0, ops.active.length)`。
Task 4: 评审 —— spec ✅ / 质量 Approved,零 Critical/Important。评审员判定上面那处**属必要传播非越界**:brief 自己的 5 条测试就是先 `ops.active = […]` 再 `mount()`,不修则 4 条根本过不了;并核实它不会让空队列时面板乱弹(`shouldAutoOpenUploadList(0,0)` 恒 false)。另确认分组位置(警示区与上传中区之间)、`ops.cancelAll` 未与上传 store 的 `cancelAll` 混淆、`null` 百分比两半(不渲染文字 + 进度条回落 0)各有测试。
Task 4: minor (deferred): 那处初始 `open` 缺口在概念上属 Task 3 范围,本任务修在前面更干净;单行、已披露、已测,不返工。
Task 4: ⚠️「无法从 diff 核实」项(全量 688/11088)由**控制器自行核对**:Task 2 报 688/11080,本任务新增 8 条 ⇒ 算术一致,采信。
Task 4: complete (commits f0cf4de..86cd807, review clean)
Task 5: 实现完成,提交 `41f828c`。删组件+测试、拆 `Files.vue` 两处、改写两处悬空注释。`vue-tsc` 干净,全量 687 文件/11081 例绿(比 Task 4 少 1 文件/7 例 = 删掉的那个测试文件,算术一致)。
Task 5: 评审 —— spec ✅ / 质量 Approved,零发现。评审员**没有采信报告而是自己取证**:`git diff -- src/files/stores/fileOps.ts` 返回 0 行(store 逐字未动)、`git diff -- src/views/Files.vue | grep bus.on` 无命中(socket 接线未动)、自己跑 `grep -rn "OperationStatusBar" src/` 得零命中。
Task 5: 评审做了**能力对照**(删除类任务的实质问题):旧浮层的标题/全部取消/每任务标签+文件名+百分比+进度条,在新分组里逐项都有对应 ⇒ 无静默丢失。
Task 5: 评审还**核了新注释的准确性而非仅「不悬空」**:去 Vue2 `FilePanel.vue:2102-2105` 查证确有该 socket 处理器 ⇒ 新注释比旧的更准(旧的把功劳记给 Vue2 的 `OperationStatusBar.vue`,那其实是个纯展示组件、没有 socket 代码)。
Task 5: 两条机械问题经复核均属实:① `vue-tsc` 在 `LanDevicesPanel.vue` 报错是 **pnpm 硬链接断裂**(本仓已记载的坑),`pnpm install` 修好,`git stash` 已证明先于本任务存在;② **先跑测试后提交会让 4 条 `oss/*` 导出测试假红** —— `oss/export.mjs` 拒绝在脏树上跑。这正是计划 Global Constraints 里写的那条,但 brief 的 Step 5/6 顺序本身与它冲突,**后续任务照此顺序会再撞一次**。
Task 5: complete (commits 86cd807..41f828c, review clean)

## Part A(T10)收官。以下 Part B(#90 可靠性核心)。
Task 6: 实现完成,提交 `873a223`(`onTransferBroken` + `hasActiveTransfer` + `handleDisconnect` + `resetTransferState` + `filesDropInterrupted` 两 locale)。13 文件/61 例绿,`vue-tsc` 干净。实现者用 `grep -rn "onTransferComplete"` 找齐 3 处 `PeerEvents` 构造点(brief 只点名 1 处),主动披露多提交了 `peersManager.test.ts`。
Task 6: 评审 —— spec ✅;质量 **NOT approved,2 条 Critical,两条都带实测复现**(评审员自己写临时测试跑出来再删掉,不是推理)。
Task 6: **Critical 1 —— 成功接收后 `digester` 从不清空**。`onFileHeader` 建 digester,而成功路径 `onFileReceived` 不清,只有 `resetTransferState()` 清 ⇒ 收完一个文件后 `hasActiveTransfer()` **恒真**;此后任何一次寻常的空闲重连都会触发 `onTransferBroken` 弹「传输已中断」——**正是 `wasActive` 守卫注释里说要防的那件事,守卫被自己击穿**。这是从 Vue2 `Network.js` 继承的老毛病,在 Task 6 开始拿 `digester !== null` 当活性信号之前无害 ⇒ 算本任务的 bug。
Task 6: **Critical 2 —— `resetTransferState()` 只把 `chunker` 置空,不中止 `FileReader`**。chunker 的回调直接捕获 `Peer` 的 `this`、不校验 `this.chunker` 还是不是自己 ⇒ 陈旧分片继续上线。评审员抓到完整错序:`header(big) → header(small) → binary(64000,stale) → binary(10,real) → …`,接收端会拿 64000 字节垃圾冒充 `small.bin`。**brief 自己的 test 2 抓不到,因为它的文件只有 10 字节**(单次 `FileReader` 读在断连前就完成,竞态窗口根本没进);超过 `CHUNK_SIZE`(64KB)时这不是偶发竞态而是必然。
Task 6: **控制器裁定** —— Critical 2 的修法(`FileChunker.abort()` + `resetTransferState` 里先 abort 后置空)**原本排在 Task 9**。判:**提前到 Task 6**。理由:中间态不能留洞,Task 7/8 都要建在这条主干上。**代码内容一字不改,只改位置**;Task 9 仍保留 `transfer-cancel` / `cancelTransfer` / 接收端取消处理。裁定入账。
Task 6: 评审 minor —— 两条 Critical 能溜过去是因为 Step 5 的变异只探了 `wasActive` 守卫和「有没有调 `resetTransferState`」整体,缺「收完整之后再断连」与「多分片发送中断连后立刻重发」两条用例。已要求实现者补上,并要求**先跑证明它们对当前代码真红**。
Task 6: fix round 1/5 进行中 —— C1 成功路径清 digester / C2 chunker abort 提前 / 补 3 条测试(含 chunker.abort 本身)。
Task 6: fix round 1/5 (2 addressed, 0 open; commits `873a223`..`3be74f3`)。复评员**自己重跑了两组变异**(去掉 `chunker?.abort()` ⇒ 陈旧分片那条真红;去掉 `digester = null` ⇒ 完成态那条真红),不是转述;并自己跑了 13 文件/64 例 + `vue-tsc` 全绿。
Task 6: **实现者独立撞上并解决了 Vue2 上游 #90 最后一个提交修的同一个 bug** —— 直接在 `onFileReceived` 里 null 掉 `digester` 会让既存测试崩:`onChunkReceived` 在 `unchunk()` **之后**读 `this.digester.progress`,而 `unchunk()` 在最后一片时会**同步**调用 `onFileReceived`。他改用局部变量持有 digester。复评员逐句核了控制流(`unchunk` 是先写 `this.progress` 再调 callback ⇒ 局部引用读到的是已定稿的值),判定是纯重绑定、无行为变化。
Task 6: 复评还逐点排除了新破坏:`FileReader.abort()` 只发 `abort`/`loadend`,而 `chunker.ts` 只注册了 `load` 监听 ⇒ 无悬空消费者;`sendFile()` 每个文件都 `new FileChunker` ⇒ `aborted` 标志只作用于死实例,不会误杀后续文件;`'partition-received'` 分支那处两次读 `this.chunker` 走的是真异步 `FileReader`(全仓无 FileReader mock),无同步重入。
Task 6: 复评确认陈旧分片那条测试**不是只数个数** —— 它按 JSON `name` 定位小文件的 header、切出其后的二进制帧,断言恰好一帧且 `byteLength === 10`,能钉住交错的陈旧 64000 字节。
Task 6: complete (commits 41f828c..3be74f3, review clean after 1 fix round)
Task 7: 实现完成,提交 `67be7c7`+`54101e8`。三条 `RTCPeer` 分支(`onChannelClosed` 两端都上报 / 补 `closed` 态 / `sendRaw` 无通道上报)接进 Task 6 主干。12 文件/58 例绿,`vue-tsc` 干净。
Task 7: ⚠️**实现者靠强制的变异验证逮到「三条新测试全都因为错的理由而通过」** —— 我 brief 里 `startIncoming` 用 `size:16` + 8 字节分片 = 50% 进度,超过 `PROGRESS_NOTIFY_STEP`(1%)⇒ 接收进度通知走 `sendRaw`,而替身 peer 从来没有开过通道 ⇒ **光是测试 setup 就触发了 `handleDisconnect`**,三条断言在 Step-5 变异下照样绿。他用「临时给 `handleDisconnect` 插抛栈探针」定位,改**只改夹具数据**(`size:16`→`size:10000`,让分片落到 1% 阈值以下),断言与生产代码一行未动。**这是本仓第 8 例「测试因为错的理由而通过」,也是我亲手写进计划的第 3 例。**
Task 7: 评审 —— spec ✅ / 质量 Approved,1 条 Minor。评审员**没有采信报告的取证,而是自己补做了更强的一次**:实现者 Step 2 的红检跑在**改夹具之前**的中间态上;评审员把 `3be74f3` 的旧 `rtcPeer.ts` 换回去、配**最终版**测试文件重跑 ⇒ 三条新测试全红("Number of calls: 0")、10 条既有全绿。又独立复现了 Step-5 变异(2 红 1 绿,隔离度比 brief 预期的更好)。跑完恢复,`git status` 干净。
Task 7: 评审逐点排除了回环风险:`handleDisconnect` 先复位(`busy=false`/`digester=null`)再 `refresh()`,而 `refresh()` 只异步 `createOffer().then(...)`、无同步重发;即便后续再来断连事件,`hasActiveTransfer()` 已假 ⇒ 不会二次上报。确认 caller 仍会重拨、`onChannelClosed` 仍是 `private`。
Task 7: minor (deferred): `rtcPeer.test.ts:3` 引入的 `type TransferBrokenReason` **无人使用**(我 brief 的 Step 1 片段照抄进去的),`vue-tsc` 与现有 lint 都不报。收进后续清理。
Task 7: complete (commits 3be74f3..54101e8, review clean)
Task 8: 实现完成,提交 `18997bb`+`b6977d6`。`ACK_TIMEOUT_MS=30000` + `armAck`/`clearAck` + 两个 case 接线。17/17、62/62 绿,`vue-tsc` 干净。
Task 8: ⚠️**又两条 brief 里的测试被实测推翻(本仓第 9、10 例「因为错的理由而通过」,累计我亲手写进计划的已 5 例)**:
  - 「does not fire once the ack arrives in time」**自相矛盾** —— 70000 字节 < `MAX_PARTITION_SIZE`(1MB)⇒ 只产生**一个**分区,那条 `partition-received` 就是最终确认,按 brief 自己的正确性规则必须武装完成等待 ⇒ 超时**理应**触发,而我的断言写的是 `not.toHaveBeenCalled()`。实现者改写成真正的两分区传输跑到完成。
  - 「clears the timer on transfer-complete」**看不见自己的变异** —— `onTransferCompleted()` 会置 `busy=false`,泄漏的定时器晚点触发时被 `wasActive` 守卫吞掉,有没有 bug 都绿。他补了对内部 `ackTimer` 的直接断言。
Task 8: 评审(**opus**)—— spec ✅;质量 **2 Important + 4 Minor,两条 Important 都是评审员自己写探针实测出来的**。
Task 8: **Important 1 —— `RTCPeer.close()` 只拆连接不清定时器**。`close()` 不调 `resetTransferState()`/`clearAck()`,而 `RTCPeerConnection.close()` **不会**触发 `connectionstatechange` ⇒ 没有任何路径兜底。`PeersManager` 在 `peer-left` 与 `destroy()` 都调它,`drop.ts` 在离开 `/files/drop` 时调 `manager.destroy()` ⇒ **用户离开互传页 30 秒后,在他当时所在的任意页面凭空弹「传输已中断」**(toast store 是全局的),且定时器把死 `Peer` 与它的 `File` 钉住 30 秒。Task 8 之前这条是惰性的,是本任务让它可达。
Task 8: **Important 2 —— `else this.armAck()` 在 `chunker` 为 null 时也武装**。两条可达路径:①复位后通道重拨、对端未复位 ⇒ 游离的 `partition-received`;②`chunker.ts` 只在 `onChunkRead` **顶部**查 `aborted`,`onChunk → sendRaw → handleDisconnect` 在回调中途复位后,`onPartitionEnd` 仍会跑并武装。实测:空闲 peer 收到游离 ack ⇒ 武装;随后一个**完全健康的接收**开始 ⇒ 30 秒后被判超时、半成品文件被丢弃(接收路径从不碰 `ackTimer`,没人能取消它)。修法 `else if (this.chunker) this.armAck()`。
Task 8: 评审澄清了一处我在 dispatch 里问错方向的事:**发送队列内部**的游离定时器无害(`ackTimer` 是单槽,`armAck()` 先 `clearAck()`),危险只存在于「30 秒内没有任何人 arm 或 clear」的路径 = 上面两条。多文件队列逐段走查确认每个对端等待都有界、无误报。
Task 8: **控制器裁定** —— 按流程 Minor 不进修复轮,但 Minor 5(注释事实错误)**与本 diff 内的代码直接相连、且是「伸手进私有字段」的全部理由所在**,判:一并进本轮。Minor 3/4/6 记账交终审 triage。
Task 8: minor (deferred): ③`partition-received` 里领头那句 `this.clearAck()` **零测试覆盖** —— 评审员删掉它后 17/17 照样全绿。它不是死码(没有它,等下一个分区标记的时限会被上一个分区武装的定时器占用,本地慢读会误杀健康传输),值得补一条守卫。
Task 8: minor (deferred): ④私有字段断言有可观察行为的替代版且评审员已实测可用(`transfer-complete` 后起一个健康**接收**,`digester !== null` 让 `wasActive` 复真,再推进 30 秒 ⇒ 未变异绿、变异红)。
Task 8: minor (deferred, **建议开票**): ⑥`FileChunker` 只注册 `load` 监听、**没有 `error`**。文件在选取到发送之间被移走/可移动介质被拔出 ⇒ 读失败,永远发不出分区标记 ⇒ 永远到不了 `armAck`,`busy` 恒真到标签页关闭 —— **正是 Task 8 要消灭的症状,只是从另一条路进来**。多文件队列里 `transfer-complete` 到下一个文件首个分区标记之间也是同一段空档。
Task 8: 评审附注(非发现):该时限是**按分区确认**计的 ⇒ 隐含约 34 KB/s 的吞吐地板(1MB/30s)。局域网设计(只有 STUN、无 TURN)下无妨;绞杀共存期的 Vue2 发送端没有这个限制,不对称是单向且良性的。
Task 8: fix round 1/5 进行中 —— I1 `close()` 清定时器 / I2 `else if (this.chunker)` / M5 更正注释。
Task 8: fix round 1/5 (3 addressed, 1 new open; commits `b6977d6`..`efdc898`)。复评员(opus)**自己手工施加两组变异并逐一核对红的原因**:删 `close()` 的 reset ⇒ 只有 close 那条红且 payload 是 `reason:'timeout'`(证明是泄漏定时器,不是别的断连路径);改回裸 `else` ⇒ 只有游离 ack 那条红,同样 payload。
Task 8: 复评**用探针实测排除了那个已经咬过本文件一次的夹具混淆**:两条接收夹具在 setup 后 `jsonOut(p)` 都是 `[]`(8/10000 = 0.08%,远低于 1% 阈值)⇒ 没有任何出站消息、没有派生断连,`wasActive` 完全来自那个健康的接收 —— 正是要证明的伤害路径。
Task 8: **复评发现 1 条新 Important(进 fix round 2)—— `peer-left` 中途现在完全静默**。修复前那条通知是**歪打正着**来的:`close()` 只 null 掉通道、chunker 还在跑,下一片撞见 null 通道 ⇒ `handleDisconnect('disconnected')` ⇒ 弹提示。现在 `chunker.abort()` 把这条路掐了。对 `destroy()`(用户自己离开页面)静默**正是修复的目的、是对的**;对 `peer-left`(**对方设备消失而用户还在看**)则是回归:用户得不到任何反馈,且 `stores/drop.ts` 只在 `onTransferBroken` 里清 `transfers[peerId]` ⇒ **进度卡永远留在屏幕上显示一个已死的传输**。这正是本批要修的场景,不能带着静默上线。
Task 8: 修法落在 `peersManager.ts` 的 `peer-left` 分支(`handleDisconnect` 要在 `close()` **之前**,否则传输态已被清、`hasActiveTransfer()` 为假、报不出来);**不加到 `destroy()`**。顺带记下:旧的歪打正着路径还会 `refresh()` 去重拨一个刚离开的 peer(旧 bug),显式路由避开了它。
Task 8: minor (deferred): 新的 `close()` 测试只断言「没有上报」,不断言正向后置条件(`ackTimer === null` / `hasActiveTransfer() === false`)⇒ 今天靠变异验证撑着非空洞,但将来改 `resetTransferState` 可能保持绿而实际泄漏。
Task 8: minor (deferred): 更正后的注释仍有一句引导性措辞(「不会因为 `ackTimer` 被重新赋值而取消」),字面为真但仍易被误读;更干净的写法是「除了显式的 arm/clear,没有任何东西能取消一个待触发的句柄」。
Task 8: fix round 2/5 进行中 —— `peer-left` 显式上报。
Task 8: fix round 2/5 (1 addressed, 0 open; commits `efdc898`..`b79896e`)。67/67 绿。复评员**自己做了顺序变异**(把 `close()` 换到 `handleDisconnect` 之前)确认那条断言真会红,并逐句核了「为什么顺序重要」:`close()` 的 `resetTransferState()` 会把 `busy`/`digester` 清空 ⇒ `wasActive` 读到 false ⇒ 报告被吞。确认 `destroy()` 未被加同一行(离开页面仍静默)。
Task 8: **复评指出「空闲 peer 不上报」那条测试是装饰性的** —— 替身 peer 的 `handleDisconnect` 是空的 `vi.fn()`,从不调 `ev.onTransferBroken` ⇒ **对 `peersManager.ts` 的任何变异都杀不死它**,它压根不经过真实的 `wasActive` 守卫。真正的保护全靠「恰好上报一次」那条。**本仓第 11 例「测试因为错的理由而通过」。**属 Minor(主用例覆盖到位),记账交终审。
Task 8: **控制器更正复评的一处归因** —— 复评把「`close()` 后 datachannel 的 `onclose` 仍会异步触发、caller 角色会去 `refresh()`/`connectRtc()` 重拨一个已被删除的 peer」归因为修复轮 1 的副作用。**核对原始代码:不是。** 本批开工前 `close()` 就是 `conn.close(); conn = null; channel = null`,而 `onChannelClosed` 里 `if (!this.isCaller) return; this.connectRtc(...)` 也一直在 ⇒ **这条重拨隐患先于整个批次存在**,修复轮 1 只改变了「报不报」。判:记为**先存隐患**,交终审 triage,不进本任务修复轮。
Task 8: complete (commits 54101e8..b79896e, review clean after 2 fix rounds, 4 minors deferred)
Task 9: 实现完成,提交 `de1be0e`。范围按控制器裁定收窄(chunker abort 已在 Task 6)—— 只做 `transfer-cancel` 消息类型 + `cancelTransfer()` + 接收端分支 + 3 条测试。70/70 绿。实现者**先 grep 核实了「已经做过的部分」再动手**,并按要求换掉了 brief 里那条已失效的变异目标。
Task 9: 评审 —— spec ✅(按调整后范围)/ 质量 **1 条 Important**。
Task 9: **Important —— 接收端 `transfer-cancel` 分支绕过 `wasActive` 守卫**。它直接 `resetTransferState()` + 无条件 emit,而 `handleDisconnect` 本来就接受 `'cancelled'` 且带守卫。后果:本地传输刚成功结束(`digester` 已为 null)或重连后残留一条游离消息时,会为一个「本侧从未存在或已成功」的传输弹「传输已中断」—— 用户刚看着传完就被告知中断。**这条来自我的计划原文**,判定同前:机械疏漏非设计决策,修。
Task 9: 评审确认了三条问答:`sendJSON` 在 reset 之前是对的(但顺带指出「reset 会破坏发送」这个理由**不成立** —— `resetTransferState()` 根本不碰 `channel`/`conn`,理由比代码实际依赖的更宽);发送端自己的 30s 定时器经 `resetTransferState()→clearAck()` 已清;空闲时取消确实静默且该守卫有真变异能杀。
Task 9: 评审逐字核了夹具陷阱**不适用于本任务**:三条新测试用的是 `TestPeer`,其 `sendRaw` 只是往数组里 push、从不碰 `this.channel` ⇒ `RTCPeer` 那条「无通道即断连」的路径根本不在被执行的代码里;测试 3 的 `size:16`/8 字节确实会发一条 `progress`,但只是落进 `p.out`,无害。
Task 9: minor (deferred, 先存非本任务引入): `resetTransferState()` **一次抹掉双向状态** —— 同一个 peer 既在发又在收时,收到的 `transfer-cancel`(逻辑上只关乎入站装配)会把它自己无关的出站发送和 ack 定时器一起静默清掉,且没有任何信号区分「被杀掉的是两件不同的事」。`handleDisconnect` 的 `'disconnected'`/`'timeout'` 同理。
Task 9: fix round 1/5 进行中 —— 接收端分支改走 `handleDisconnect('cancelled')` + 补「空闲时收到取消不上报」用例。
Task 9: fix round 1/5 (1 addressed, 0 open; commits `de1be0e`..`5180666`)。71/71 绿。复评员**逐语句比对**了 `handleDisconnect` 与被替换的分支体(同样的 reset、同样的 payload 形状/peerId/reason 字面量)⇒ 对「传输确实在进行」的情形**零行为差异**,唯一变化就是多了那道守卫。
Task 9: 复评确认新用例**不是空洞的负向断言**:测试从头到尾没发过 header、没发过文件 ⇒ `digester` 恒 null、`busy` 从未置真,`wasActive` 为假是**出于预期的原因**而非巧合;断言是双向的(既断言没上报,也断言 `hasActiveTransfer()` 为假)。并确认既有的「取消时丢弃半成品」用例不受影响(那条先发了 header ⇒ `wasActive` 为真)。
Task 9: complete (commits b79896e..5180666, review clean after 1 fix round, 1 minor deferred)
Task 10: 实现完成,提交 `26437f8`。`PeersManager.hasActiveTransfers()/cancelTransfer(peerId)` + store 两个包装并进 `return`。12 文件/79 例绿,`vue-tsc` 干净。实现者先 grep 核实 `onTransferBroken` 已是 Task 6 的最终形态、未重复添加。
Task 10: **实现者纠正了 brief 里那条变异的前提** —— 我写「删掉 store `return` 里的 `cancelTransfer`,`vue-tsc` 会保持沉默」。实测:**只有在没有类型化调用点时才沉默**;本任务的测试按要求经 store 对象调用,于是 `vue-tsc` 也会报 TS2339。他额外复现了 brief 描述的窄场景确认坑本身真实存在。
Task 10: 评审 —— spec ✅ / 质量 Approved。评审员**自己复现了那次变异**(删 `return` 里的条目 ⇒ 拿到报告引用的那两条 TS2339,指向 `drop.test.ts:136`/`:141`),确认报告的核心技术判断属实,并指出这层保护是**偶然的**(来自本任务测试的存在)而非结构性的 ⇒ Task 11-13 仍须各自写组件级测试经 store 调用。
Task 10: 评审逐点核了四个正确性问题:`hasActiveTransfers` 每次现读 `this.peers`(且 `peer-left` 是先 `delete` 后用 ⇒ 已走的 peer 不会被算进去);未知 peer 取消是可选链、不抛;`manager` 为 null 时两个包装都有专门用例断言底层 mock **从未被调用**(不是靠推断);`peer-left` 的调用顺序未被本 diff 触碰。
Task 10: 评审特别核了替身质量(Task 8 栽过的那类):`hasActiveTransfer: () => made.length === 1` 那条**配了一个固定返回 false 的伴生用例**(实现者自己加的、超出 brief),两条合起来能同时杀掉 `.some(...)` 的恒真与恒假变异 ⇒ 不是「永远不会失败的断言」。
Task 10: minor (deferred): 无用例直接覆盖「`peer-left` 之后 `hasActiveTransfers()` 应排除刚走的 peer」。实现按构造正确(先删后用),该行为继承自更早任务,非本 diff 新逻辑。
Task 10: complete (commits 5180666..26437f8, review clean)
Task 11: 实现完成,提交 `2942b63`。已有右键菜单里加第二项「取消发送」+ `DropPage` 接线 + `filesDropMenuCancel` 两 locale。13 文件/90 例绿。
Task 11: **portal 问题的解法经评审认可** —— reka-ui 只在菜单**打开**时把 item 渲染进 portal,闭合态下 `findAllComponents` 什么也找不到。实现者复用了 `FileContextMenu.test.ts` 里**既有的**同款 stub 手法(对同一个 `components/ui/ContextMenu.vue` 包装器),不是为本任务现编;并**如实写明了 stub 让测试看不见什么**(真实 portal 会不会打开、真实 `ContextMenuItem` 的键盘/指针机制是否同样派发 `select`)。没有走「把菜单项挪出 ContextMenu」这条被明令禁止的捷径。
Task 11: 评审 —— spec ✅ / 质量 Approved,**零发现**。评审员自己跑了变异(删 `v-if="transfer"` ⇒ 那条守卫用例真红,报错信息是 `expected '发送文件取消发送' not to contain '取消发送'`),自己核了事件链(`DropPage.vue:76` 的 `@cancel-transfer="drop.cancelTransfer(p.peer.id)"`,id 直接取自 `v-for` 的循环变量、不存在「手工转发漏一行」的风险)、两个 locale、`--remove-fg` 在明暗两套主题块里都有定义、以及 self/离线/挂起卡片仍然整个不渲染菜单。
Task 11: 实现者顺手修了 `DropItem.test.ts` 里**先存的** i18n 插件重复安装(6 条既有用例一直在打隐藏告警),并**主动声明**同目录的 `ReceivePrompt.test.ts` 与 `DropPage.test.ts` 有同款问题但不在本任务文件范围内、未动。评审判定「修自己正在改的文件、如实声明没改的、不扫全仓」是对的分寸,非越界。
Task 11: complete (commits 26437f8..2942b63, review clean)
Task 12: 实现完成,提交 `58a70a0`+`d2a1b52`。看门狗(5s 检查 / 15s 无进度)+ `transfer-stalled` + `DropPage` 接线。12 文件/85 例绿。
Task 12: ⚠️**又两条 brief 测试被证伪(本仓第 12、13 例;我亲手写进计划的累计 7 例)** —— 「stops its timer on unmount」与「does not run at all when no transfer is in flight」**结构上杀不死自己描述的变异**。根因:Vue 运行时的 `emit()` 内含 `if (instance.isUnmounted) return` ⇒ 「卸载后没收到事件」这个断言**无论定时器有没有被清都成立**,泄漏的 emit 被 Vue 自己吞掉,而不是被清理代码挡住。实现者用 `expect(vi.getTimerCount()).toBe(0)` 加固两条。
Task 12: 评审 —— spec ✅ / 质量 Approved,1 条 Minor。评审员**做了双向取证**:① 在 `node_modules/.pnpm/@vue+runtime-core@3.5.39/.../runtime-core.cjs.js:4410` 读到那个 `isUnmounted` 守卫;② 施加变异(删 `onBeforeUnmount(stopWatchdog)`)⇒ 加固后的用例真红(`expected 1 to be +0`);③ **再跑反事实**:同一变异下把测试改回 brief 的原始 emit-only 断言 ⇒ **12/12 全绿**,直接证明我原文那条不是回归测试。
Task 12: 评审逐条核了看门狗正确性:0%/100%/undefined 三个守卫都在;进度 watch 的依赖正确且 store 每次新传输都先 `delete transfers[peerId]` ⇒ 不存在陈旧 `lastMovedAt` 跨传输存活的路径;`startWatchdog()` 无条件先 `stopWatchdog()` ⇒ 不可能双定时器;报告失速前先 `stopWatchdog()` ⇒ 不会每 5 秒重复 emit。
Task 12: minor (deferred): 加固用的 `vi.getTimerCount()` 是**全局**计数而非只统计本组件的定时器,今天安全,但将来挂载树里任何地方新增定时器都可能扰动这条断言。
Task 12: complete (commits 2942b63..d2a1b52, review clean)
Task 13: 实现完成,提交 `c3f25c7`+`f6736d0`。`leaveGuard.ts`(`beforeunload`)+ `DropPage` 的 `onBeforeRouteLeave` + 确认弹窗 + 三个 i18n 键(复用既有 `filesCancel`)。14 文件/102 例绿。
Task 13: 评审 —— spec ✅ / 质量 Approved,2 条 Minor。评审员**去读了 reka-ui 2.10.1 的源码**核那条竞态:`AlertDialogContent` 对 `pointer-down-outside`/`interact-outside` 都 `.prevent` ⇒ 点遮罩不会关闭,不存在「弹窗没了但 promise 悬着」;Esc **没有**被 prevent,走 `dismiss() → onOpenChange(false)`,与 Cancel 同一条路 ⇒ 落到延迟一拍的 `settleLeave(false)`,能正常解决。确认/取消/Esc 三条路的顺序风险都是闭合的。
Task 13: 评审自己跑了全部报告声称的变异(路由守卫恒真 / 删 `offUnloadGuard?.()` / 删 `preventDefault` 守卫),逐一按预期变红;并确认三条路由测试是**真的驱动导航**(`createMemoryHistory` + `router.push()` + 断言 `currentRoute.value.path` 前后变化),不是只断言「守卫被注册了」。
Task 13: 评审确认卸载顺序正确(`offUnloadGuard?.()` 在 `drop.destroy()` **之前**)、三个键两 locale 都在、`filesCancel` 是复用非重复、本 diff 零硬编码颜色。
Task 13: minor (deferred): `onBeforeUnmount` 不会 settle 悬着的 `leaveResolver`。当前不可达(vue-router 在守卫 promise 解决前不会卸载离开中的组件),但加一行 `settleLeave(false)` 就能防御性关掉,建议开后续票。实现者自己也标出了相邻的并发 `askLeave()` 覆盖 `leaveResolver` 的问题,同样没加兜底。
Task 13: minor (deferred): 加了 `onBeforeRouteLeave` 之后,4 条**先存风格**的测试(直接挂 `DropPage` 而非经匹配的 `<router-view>`)开始在 stderr 打 `[Vue Router warn]: No active route record was found`。评审判定「可接受但需登记」—— 本仓 `vitest-reporter-hides-warnings` 那条教训正是针对「通过用例上累积良性告警会侵蚀真信号」;实现者跑了 `--reporter=verbose`、精确编目、根因说对了,选择不去重构 3 条无关的既有测试是有分寸的。建议后续把那 4 处挂载改成经 `<router-view>`(新增的 leave guard 那组已经是这个写法)。
Task 13: 实现者按指示修了 `DropPage.test.ts` 三条原有用例的 i18n 重复安装(评审核实 `vitest.setup.ts:26` 确实全局装了、移除是冗余非行为改变),并**超出 brief 补了一条**覆盖 `DropPage` 自己 `installDropUnloadGuard` 接线的用例(brief 只测了孤立函数与路由离开路径)—— 评审判定是它正确识别出的覆盖缺口,非越界。
Task 13: complete (commits d2a1b52..f6736d0, review clean)

## 13 个任务编码全部完成。以下收尾门(控制器亲自跑)。
### 收尾门(控制器亲自跑,非转述)

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm exec vitest run`(全量) | **688 文件 / 11126 例,零失败** |
| `pnpm exec vitest run src/i18n/parity.test.ts` | 9/9 |
| `pnpm build` | ✓ 17.20s |
| `node oss/export.mjs --no-commit --allow-dirty-oss` | exit 0,零真实泄漏(3 个二进制预期内跳过) |

### 整支终审(opus,范围 efcbda6..f6736d0,23 提交)

**1 Critical + 3 Important + 6 Minor,全部带实证。**

**C1(Critical)—— 每一次成功发送都会在空闲 peer 上武装一个 30s 定时器,然后掐死该 peer 的下一次接收。**
`onTransferCompleted()` **从不清 `this.chunker`**(只有 `resetTransferState()` 清),所以 Task 8 那句 `else if (this.chunker)` 的立论(「非空 chunker 意味着确有发送在飞」)**是错的**:成功发完后 peer 空闲,但 chunker 还挂着(`isFileEnd()` 为真)。
而真实 wire 顺序**永远**是 `transfer-complete` 先、`partition-received` 后 —— 协议决定的:发送端发 `[…chunks…][partition]`,接收端在**最后一个 chunk** 上装配完成就回 `transfer-complete`,之后才处理尾随的 `partition` 并回 ack。有序通道上顺序不可能反过来。
终审实测:`RECEIVER WIRE ORDER = ["transfer-complete","progress","partition-received"]`、正常完成后 `ackTimer` 非 null、`onTransferBroken` 被以 `reason:'timeout'` 调用。
- **场景 A(单文件,最常见)**:A 发完一张图,30 秒内 B 回发一个文件 ⇒ A 的 `onFileHeader` 置上 `digester` ⇒ 定时器触发 ⇒ `wasActive` **此时为真** ⇒ A 丢弃刚收到一半的文件并弹「传输已中断」。**正是 Task 8 修复轮 1 要防的误报,守卫恰好没覆盖每次传输都会走的那条路。**
- **场景 B(多文件队列)**:文件 1 的 `transfer-complete` → 出队文件 2 开始读 ⇒ 文件 1 的尾随 ack 撞上非空 chunker 且 `isFileEnd()` 为假 ⇒ 对**文件 2** 的 chunker 在 `FileReader` 读取途中调 `nextPartition()`,实测抛 `InvalidStateError`,且 `partitionSize` 已被重置 ⇒ 流控漂移最多 1MB。
- ⚠️ **专门为这个隐患写的回归测试 `rtcPeer.test.ts:325-355` 喂的是「先 ack 后 complete」= 物理上不可能的顺序,所以它绿得毫无意义。`:291-323` 同理。这是本项目第 14 例「测试因为错的理由而通过」,而且是承重的那一例。**

**I2(Important)—— 看门狗测的是取整后的整数百分比,granularity = 文件的 1% ⇒ 大文件慢链路上会误杀健康传输,两侧都会。**
`progress` 是 `Math.round(e.progress*100)`;发送端还受接收端 `PROGRESS_NOTIFY_STEP=0.01` 的节流。要不误报,吞吐必须 ≥ `filesize/1500` B/s:500MB→350KB/s,4GB→2.8MB/s,10GB→7.2MB/s。**5GB 视频走 2.4G Wi-Fi ~2MB/s ⇒ 1% = 25s > 15s ⇒ 第 15 秒就被判失速、发 `transfer-cancel`、两端复位、部分文件丢弃**,而且 `stopWatchdog()` 先跑过所以没有第二次机会 —— 慢链路上大文件**永远发不出去**。
台账里那条「ack 时限隐含 34KB/s 地板」是**另一个量**(与文件大小无关);看门狗这条**随文件大小放大**,多 GB 时严苛 100 倍。Task 12 单看看不见:阈值是 Task 12 的、1% 节流是先存的、取整在 store 里。

**I3(Important)—— Task 7 把「可恢复的 ICE `disconnected`」变成了接收端的致命错误。**
批次前 `onChannelClosed()` 是 `if (!this.isCaller) return; this.connectRtc(...)`,而 `onConnectionStateChange` **早就**把 `case 'disconnected'` 路由进它。Task 7 在前面加了 `handleDisconnect('disconnected')` —— 对真关闭的通道是对的,但 `'disconnected'` 是**瞬态** ICE 状态(Wi-Fi 漫游/网卡抖动几秒后常规恢复),SCTP 与数据通道都还活着。⇒ B 正在收 2GB 到 60%,A 漫游一下,B 的 60% 缓冲被丢弃并弹中断,**而通道还是好的**。
这正是「后一个任务改了函数语义、另一个先存调用点静默继承了新语义」那种形状,Task 7 与 Task 8 的评审各自都看不见。

**I4(Important)—— 折叠态的上传面板在只有文件操作时仍自称「上传」。** `UploadPanel.vue:172-174` 的计数改对了、**标签没改**;T10 的头部三态只接进了展开态的 `.up-title`。用户粘 6GB 文件、把面板收起来,看到的是 **「上传 (1)」** —— 断言一个不存在的上传。**这也是 Part A 删除带来的唯一真实能力回退**:旧浮层不可关闭,粘贴进度永远在屏上;现在能被收成一个标错的计数。旧浮层其余能力(标题/全部取消/动词+文件名+百分比+进度条)经逐项对照 `41f828c~1` 均已覆盖。

**Minor:** M5 `case 'closed'` 不像 `'failed'` 那样 null 掉 `conn`(不对称,今天近乎不可达)· M6 `cancelTransfer()` 在无通道时可能上报两次(两条中断 toast)· M7 `reason` 穿了四层最后全渲染成同一句「传输已中断」(用户自己点的取消也被说成中断)· M8 五处被后续任务证伪的注释(含 `rtcPeer.ts:1-2` 的「差异**仅**」、`chunker.ts` 同款、`:74-79` 那条已被 C1 推翻的守卫说明、`UploadPanel.vue:53-55` 对 `shouldAutoOpenUploadList` 的错误描述、`AppSettingsPage.vue:189` 被 Task 5 改成指向 `UploadPanel.vue` 但那里 `grep -c drop-bad` = 0)· M9 删除留下的孤儿(`filesTasksTitle` 零引用、`fileOps.visible` 只被自己的测试引用)· M10 `.up-ops-cancel-all` **是个没有任何规则的类名** ⇒ 「全部取消」渲染成普通 accent 链接,而它是本面板里最该标危险色的控件(无确认框、取消**全部**服务端任务),同面板其他破坏性动作都是红的。

**终审对 16 条挂账 minor 的 triage:全部「可上线」,无一阻塞合并。** 唯一必须合并前修的是 C1;强烈建议 I2/I3/I4 同一波带走(I2/I3 都会在普通硬件上销毁用户在传的数据,I4 是 Part A 招牌成果的一行之差)。挂账 6/7/9/10/12 都落在 C1 修复的爆破半径内,应搭车而非二次延期。

### 唯一一轮修复波(派单中)
**修复波(唯一一轮,9 提交 `669597c`..`82aae08`)**:C1 / I2 / I3+M5 / I4 / M6 / M7 / M8 / M9 / M10 **全部修完**,17 组变异逐一记录实测输出。修复者自己逮到并修了**自己引入的一处回归**(M7 的新文案让真正的死链路弹成「已取消传输」,因为 `DropPage` 把失速也路由进 `cancelTransfer` ⇒ 提交 `4d25eb3` 给取消加了可选 reason,失速传 `'timeout'`),以及**自己一条因为错的理由通过的测试**(store `raw` 断言,改用 0.4048 夹具)。
修复者更正了我转述的一处失实:**M9 后半是错的** —— `messageSyntax.test.ts` 里并没有任何提到 `filesTasksTitle` 的撞车表行,删除前该键只出现在两个 locale 文件里。

**复评(opus,范围受限,唯一一轮)**:9 条**全部 ADDRESSED**。
- C1 经逐条走查判定**安全**:`pendingAckOffset` 非 null 只在 chunker 的 `FileReader` 空闲期成立(读结束时设、下次读开始前清)⇒ `nextPartition()` 结构性地不可能落在读取途中,`InvalidStateError` 被消除而非概率降低;且每个把 `chunker` 置空的位置都同时清 offset ⇒ `chunker === null ⟹ offset === null ⟹ break`,这正是能安全去掉 `if (this.chunker)` 的原因。**不匹配的 ack 不 `clearAck()`** ⇒ 即便假设性地丢掉一个合法 ack,也只会退化成一次**有上报**的 `'timeout'`,永不静默卡死。
- 复评自己跑变异 A(两半都回退、保留真实 wire 顺序)⇒ `3 failed | 28 passed`,其中包括逐字复现的 `InvalidStateError` ⇒ 重做夹具后的测试**确实对修复前的代码变红**。
- 复评**部分反驳**了修复者「同尺寸 offset 歧义不可达」的说法:它自己造探针(1 024 000 / 2 500 000,后者首个分区也止于 1 024 000)证明**能**发生 —— HTML 规范不保证 datachannel `message` 任务与 `FileReader` load 任务的先后。但确认**后果良性**(传输仍正常完成、无卡死、最多多 1MB 未确认在飞)⇒ 措辞应改成「发生了也无害」而非「不可能」。

**⚠️ 复评发现 1 条修复波自己引入的新 Important(已派最小收口)** —— I2 把看门狗门控在 `sending === false`,而 `Peer.files` **只在 `resetTransferState()` 里清、`onTransferCompleted()` 不清** ⇒ 给某设备发完一个文件后,`files.length` 恒为 1 ⇒ 从该设备**接收**时被误判成 `sending: true` ⇒ 看门狗根本不启动。修复前门控是 `!!props.transfer`,死接收仍有界;**现在接收侧彻底无界**(接收路径没有 ack 定时器、通道不关、卡片冻结、半成品永不丢弃、无提示),触发条件正是本页面存在意义所在的一来一回。判:**属结构性回归,不可挂账**(挂它等于让整批的目的落空),派最小收口 = `onTransferCompleted()` 里在 `filesQueue` 排空后清 `files`。
另派两条硬约束小修:`rtcPeer.ts:329` 新 JSDoc 里残留中文片段;`fileOps.test.ts` 一条既有中文 `it` 标题被**编辑过**却未翻译。

**收口(`05b064c`+`7acb341`)**:新 Important + 两条硬约束小修全部关闭。清 `files` 的时机选了「`filesQueue` 排空后、`dequeueFile()` **之前**」,并用**第二组变异专门验证这个决策**:无条件清空 ⇒ 「多文件发送期间仍算发送」那条真红(`expected [] to deeply equal ['one.bin','two.bin']`);而放到 `dequeueFile()` 之后就再也分不清「下一个文件刚开始」与「真的发完了」,因为 `busy` 已被重新填上。

### 收尾五门(控制器亲自跑,最终 HEAD `7acb341`)

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | exit 0 |
| `pnpm exec vitest run`(全量) | **688 文件 / 11142 例** —— ⚠️ **第一次跑有 1 条失败,未抓到名字;之后连跑 3 次全绿** |
| `pnpm exec vitest run src/i18n/` | 8 文件 / 189 例 |
| `pnpm build` | ✓ 18.73s |
| `node oss/export.mjs --no-commit --allow-dirty-oss` | 零真实泄漏(3 个二进制预期内跳过) |

⚠️ **那条间歇失败必须挂账,不能当成全绿**:本批新增多条基于 `vi.useFakeTimers({ shouldAdvanceTime: true })` 的定时器测试(真实时间会推进假定时器),对机器瞬时负载敏感,是合理但**未经证实**的怀疑对象。合并前建议连跑数次并用 `--reporter=verbose` 抓住名字;若确认是新增定时器测试,把阈值与实测间隔的余量拉大。另本仓已知 `src/home/components/DesktopContextMenu.test.ts` 单文件跑必红、全量绿(SP11 遗留的 reka-ui 隔离 flake),不是它。

### 状态

**编码收官。未部署、未推 origin、未合并 master。真机验收清单(设计文档 §5:T10 六步 + #90 六步)一步没跑** —— T10 那六步**必须用 ≥5GB 的文件**(后端每 3 秒采样一次进度,本机本地复制 1.4 GB/s,小文件根本产生不了中间进度);#90 那六步**需要两台设备**。
