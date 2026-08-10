# SP12 文件区 —— 有意不做、但后面可能要做的五块（挂账）

**登记日期**：2026-08-10。机主在本批（T10 + #90 可靠性核心）收官后拍板：这五块**本期不做，但记账，后面有可能做**。
写这份文档的理由：它们都在设计文档里被写成「明确不做」，而「明确不做」在几个月后会被读成「漏做了」或者「做不了」。
这里把**真实原因、Vue2 的坐标、New-UI 要动哪里、以及做之前必须先回答的问题**一次写清，任何人捡起来都不用重新考古。

前四块来自 Vue2 `139f783a`（#90 P2P 丢送可靠性+性能重修，1645 行，`Network.js` 独自 +541 行）；
第五块来自 Vue2 `6ac65294`（#89 粘贴进度并入上传框）。

> ⚠️ **前三块在 Vue2 里是互锁的，不是三个独立选项。** `transfer-accept` 握手既是「问对方要不要收」，
> 也是**流式落盘交出可写句柄的那一刻**（`_acceptTransfer(writable)`），而背压水位控制只有在真正流式发送
> 时才有意义。所以：**要做流式落盘就必须先做握手；要单独做背压是可以的，但收益最小。**

---

## D1 背压流水线（`bufferedAmount` 水位控制）

- **不做的原因**：性能优化，不是缺陷修复。本批的判据是「用户能看到的坏行为」，背压治的是内存占用和吞吐平滑度。
- **Vue2 怎么做的**：`src/components/filebrowser/drop/Network.js`
  - `HIGH_WATER = 8 * 1024 * 1024`（`:46`）——`_sendChunk` 里每片发完检查 `channel.bufferedAmount > HIGH_WATER`
    就让 chunker 暂停（`:229-239`）
  - 恢复靠 `channel.bufferedAmountLowThreshold` + `channel.onbufferedamountlow`（`:604-607`）回调里 resume
- **New-UI 要动哪里**：`src/files/drop/rtcPeer.ts`（`sendRaw` 与通道建立处）+ `src/files/drop/chunker.ts`
  （现在是「读完一片就发下一片」，没有暂停/恢复的入口，要新增 pause/resume 而不是只加一个标志位）。
- **做之前先答**：本批加的 30s ack 超时（`ACK_TIMEOUT_MS`）**隐含一个约 34 KB/s 的吞吐地板**（1MB 分区 / 30s）。
  暂停读发会不会把慢链路推到那条地板以下、把背压变成误报的中断？答案大概是「不会，因为暂停时对端仍在收、
  分区确认照样回」，但**必须有测试钉住这条**，不能推理了就算。

## D2 流式落盘（File System Access API）

- **不做的原因**：**本设备物理上做不到**，不是排期问题。`showSaveFilePicker` 要求**安全上下文**（HTTPS 或 localhost），
  而 NAS 是局域网 HTTP + IP 访问。硬写只会恒定走内存兜底分支，等于加了一条永远不执行的代码路径。
  同源约束见 `NimoOS-UI/docs/vue3-pending/01-文件区-SP4.md` 的 F8（同样理由否掉过 FSA），
  以及记忆 `newui-clipboard-insecure-reka`（`navigator.clipboard` 栽在同一条安全上下文上）。
- **Vue2 怎么做的**：`Network.js:302` —— `if (!window.showSaveFilePicker && header.size > MEMORY_RECEIVE_LIMIT)`
  就拒收超限文件；有 FSA 时在**用户手势回调里**拿 `showSaveFilePicker().createWritable()`，把 writable
  交给 `_acceptTransfer(writable)`（`:313,322`）。注意 Vue2 也**没有**在 HTTP 下变出这个能力，
  它只是多了一条「浏览器支持时更好」的分支 —— 也就是说 Vue2 自己在本设备上跑的也是内存兜底。
- **前置条件（这才是重点）**：**除非整机上 HTTPS**，这块没有任何做的价值。
  如果哪天上了 HTTPS，这块的收益是「收超大文件不再受内存限制」，届时要连 D3 一起做。

## D3 接收确认握手（`transfer-accept`）

- **不做的原因**：**改协议层**，风险高于本批那四件可靠性修复。本批全部改动都在「状态机怎么应对异常」这一层，
  没有动 wire 上的消息种类（唯一新增的 `transfer-cancel` 是单向通知、不需要对端配合）。
- **Vue2 怎么做的**：`Network.js`
  - 发送端发完 `file-header` **不立刻发数据**，先武装 accept 超时（`:208-210, :445-453`）
  - 接收端弹确认框，用户 accept → `sendJSON({type:'transfer-accept'})`（`:329`）→ 发送端 `_onTransferAccepted`
    才真正开始流式发送（`:410`）
  - **向后兼容靠降级**：老接收端不认识 `transfer-accept`，30s 超时后「不管了照发」（`:456-461`）
- **New-UI 现状**：`src/files/drop/` 下已有 `ReceivePrompt.vue`，但那是**旧形态的接收提示**，
  不是 wire 上的 accept/decline 握手 —— 捡起这块之前先读一遍它，别以为已经有了。
- **做之前先答**：
  1. **绞杀共存期已经结束**（Vue2 已于 2026-08-07 从设备下线），所以「新发送端 ↔ 老接收端」这个兼容场景
     **今天不存在**。要不要保留 Vue2 那条 30s 降级？保留是死代码，不保留则将来跨版本互传会静默失败。
  2. 握手加进来之后，本批的 `ACK_TIMEOUT_MS` 与看门狗要不要在「等 accept」期间挂起？
     否则用户还没点确认，发送端就先判自己失速了。

## D4 ICE 诊断日志

- **不做的原因**：开发者向的可观测性，用户看不到。
- **Vue2 怎么做的**：`Network.js` 里 `console.log('[FilesDrop] …')` 一系列 ICE 状态/候选打点。
- **做之前先答**：New-UI 全仓没有「前端日志」这个设施，`console.log` 在生产构建里不会被剥掉。
  真要做，问题不是「打什么」而是「打到哪里、谁去看」—— 这本质是一张独立的可观测性票，不该塞进互传。

---

## D5 文件操作进度的「速度」显示（#89 的一半）

- **不做的原因**：机主本批拍板不做。**后端 socket 根本不发速度字段**，前端要显示就得自建采样表。
- **Vue2 怎么做的**：纯函数 `attachOpsTaskSpeeds(tasks, prevSamples, now)`
  —— `src/components/filebrowser/upload/fileOpsRow.js:60-73`，消费点 `FilePanel.vue:3650-3654`（组件状态
  `opsSpeedSamples` 是一张 `Map<taskId, {processed, ts}>`）。算法是对相邻两次广播的 `processed_size` 做差分。
  ⚠️ 本批设计文档 §1.5 说「spec §5 漏列了它」，指的就是这个函数。
- **New-UI 要动哪里**：`src/files/util/opsRow.ts`（本批新建，四个纯函数已在此）+ `src/files/stores/fileOps.ts`
  （采样表要挂在 store 上，因为 socket 接线在组件之外）。
- **做之前先答（两个都是坑，不是形式主义）**：
  1. **采样表必须在任务消失时清理**，否则每个完成的任务都留一行 `Map` 条目 —— 长会话内存只涨不落。
     Vue2 的写法天然免疫（每轮返回一张**新** Map，只装本轮还在的任务）；照抄这个形状，别在旧 Map 上原地增删。
  2. **后端每 3 秒才采样一次进度**（见记忆 `file-operate-progress-3s-sampling`），所以差分出来的速度
     **粒度是 3 秒、且会在任务快结束时剧烈抖动**。做之前想清楚要不要平滑，否则显示出来的数字会比不显示更糟。

---

## 与这五块无关、但同批一起挂着的账

本批设计文档 §6 的挂账里有**两条已经过期**，2026-08-10 核实后在此更正，别照原文捡活：

- ~~票 B（重试撞死 URL 死循环）~~ —— **已修**。`src/files/upload/scheduler.ts:134-138`：遇 404/410 清
  `tusUploadUrl` + 归零进度，`attempt < 3` 时当作可重试再跑一轮。
- ~~`cut` 仍是 all-or-nothing~~ —— **已修**。`src/files/composables/useFileOps.ts` 的 `cut` 现在筛可操作
  子集 + toast 报跳过数（提交 `8a27872`），与 `delete`（F10）同一形状。

仍然有效的挂账：
- 后端票 `pushSingleFileNotify` 双重包裹（取消任务的终态通知前端收不到；周期广播路径形状正确，故只影响取消）
- I1（Esc 取消粘贴时，不撞名的那些文件已经落地了）—— **待机主拍板**
- Plan B 已知未修 #2 / #4 / #5 / #6（见 `2026-08-09-sp12-plan-b-outstanding.md`）
- **六批真机验收清单 ≈63 步一步没跑**（Plan A 8 · Plan B 12 · Plan C 9 · legacy-fixes 10 · followups 12 · 本批 12）。
  本批 T10 那 6 步**必须用 ≥5GB 的文件**（后端 3 秒采样一次），#90 那 6 步**需要两台设备**。
- 收尾全量测试有**一次未能归因的间歇失败**（第一次跑挂 1 条没抓到名字，之后连绿 3 次）。怀疑对象是本批新增的
  `vi.useFakeTimers({ shouldAdvanceTime: true })` 定时器测试对机器瞬时负载敏感，**未经证实**。
