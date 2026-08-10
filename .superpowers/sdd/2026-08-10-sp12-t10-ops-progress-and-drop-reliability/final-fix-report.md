# SP12 T10 + #90 —— 整支评审后的单次修复波 · 报告

> 2026-08-10 · worktree `.claude/worktrees/sp12-files-fixes` · 分支 `sp12-files-fixes`
> 起点 `f6736d0`(评审对象),本波 8 个提交 `669597c..4d25eb3`。

## 提交清单

| SHA | 主题 | 覆盖 |
|---|---|---|
| `669597c` | fix(drop): stop a finished send from arming a timer that kills the next receive | CRITICAL 1 |
| `cd3d4e8` | fix(drop): stop the stall watchdog from cancelling healthy large transfers | IMPORTANT 2 |
| `7ec3d64` | fix(drop): treat a transient ICE disconnect as recoverable, not fatal | IMPORTANT 3 + M5 |
| `b441974` | fix(drop): report a cancellation once, and in its own words | M6 + M7 |
| `1845bef` | fix(files): label the collapsed upload panel by what is running | IMPORTANT 4 + M10 |
| `5e91ba7` | chore(files): remove two orphans left by the OperationStatusBar deletion | M9 |
| `d1dbf8b` | docs: correct comments that later work falsified | M8 |
| `4d25eb3` | fix(drop): do not call a watchdog stall a user cancellation | M7 的连带缺陷(我自己引入的,见下) |

## 门(全部在最后一个提交之后跑,树干净)

- `pnpm exec vitest run`(全量)：**688 文件 / 11140 例全绿**(起点是 683/10983;本波净增 5 文件外的差额来自 master 已合入的部分与新增用例)
- `pnpm exec vue-tsc --noEmit`：0 错
- `pnpm build`：✓ built in 17.43s
- `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss`：DELETE 73 · REPLACE 4 · PATCH 278,**零真实泄漏命中**(3 个二进制跳过为预期内)
- `pnpm exec vitest run src/styles/`：CSS 注释/裸色/color-guard 全绿(含新增的 `.up-link-btn.up-ops-cancel-all` 规则)

---

## CRITICAL 1 —— 每次成功发送都会在空闲 peer 上武装一个 30s 杀手定时器

### 改了什么(`src/files/drop/rtcPeer.ts`)

两半都做了,评审要求的两条都在:

1. `onTransferCompleted()` 现在在 `dequeueFile()` **之前**清掉 `this.chunker = null`(并连带 `this.pendingAckOffset = null`)。
2. 新增 `private pendingAckOffset: number | null`：`onPartitionEnd` 回调里记录本次 partition 的 offset 再 `armAck()`；`partition-received` 分支**首先**比对 offset,不匹配(或当前没有在等 ack)就 `break`，匹配则消费掉(置 null)后照原逻辑走。`onTransferCompleted()` 与 `resetTransferState()` 都清这个字段。

`else if (this.chunker) this.armAck()` 里的 `if (this.chunker)` 条件随之去掉——offset 匹配已经把「这条 ack 属于哪个 partition」钉死了,那个条件是原来那条错误理论的残留。~74-79 的注释按 M8 要求重写成描述真实修法(含「wire 顺序永远是 transfer-complete 先、trailing ack 后」这个前提)。

### 测试与变异

再夹具化的两条(原来喂的是协议产生不了的顺序,因此**认证了 bug**):

- `clears the timer on transfer-complete so a finished send never reports a timeout`
- `a timer surviving transfer-complete cannot kill a later unrelated incoming transfer to the same peer`

两条现在都按真顺序喂:`transfer-complete` → `partition-received{offset:10}`。第一条额外加了 `chunker === null` 的正向后置断言。

新增三条:

- `does not let a finished file's trailing acknowledgement derail the next file in the queue`(Failure B)
- `cancels the previous partition timer the moment its acknowledgement arrives`(证明分支里那句领头的 `clearAck()` 是承重的)
- close() 那条补了正向后置条件(`ackTimer === null` + `hasActiveTransfer() === false`)

**变异验证(逐条实测输出)**

| 变异 | 结果 |
|---|---|
| A:两半同时回退到修复前 | `3 failed \| 23 passed` —— 三条:clears the timer / a timer surviving… / trailing acknowledgement(后者报 `AssertionError: expected [Function] to not throw an error but DOMException{ stack: 'InvalidStateEr…' } was thrown`,与评审观察到的 `InvalidStateError` 逐字一致) |
| B:只删 offset 比对(保留 chunker 置空) | `4 failed \| 22 passed` —— 上面三条 + 既有的 `ignores a stray partition-received while idle…`(这条原本没有杀手变异,offset 比对给了它一个) |
| C1:只删 `this.chunker = null` | `1 failed \| 25 passed` —— `clears the timer on transfer-complete`(靠新加的 `chunker === null` 后置断言) |
| C2:只删 `this.pendingAckOffset = null`(onTransferCompleted 里那句) | `3 failed \| 23 passed` —— 与 A 相同的三条 |
| D:删分支里领头的 `clearAck()` | `1 failed \| 25 passed` —— `cancels the previous partition timer the moment its acknowledgement arrives` |
| E:`close()` 不再调 `resetTransferState()` | `1 failed \| 25 passed` —— `clears an in-flight ack timer, so leaving the page…` |

### 我与评审的一处**分歧(如实登记)**

评审把「`onTransferCompleted()` 必须清 `chunker`」列为第 1 条必做,并说「单靠这条不够」。前半我照做了,但要说清:**在 offset 比对到位之后,清 chunker 已经没有独立的行为级杀手变异**。C1 的红是靠我为它专门写的内部状态后置断言(`chunker === null`)拿到的,不是靠任何可观测行为——因为 offset 比对之后,一条 trailing ack 根本走不到 `armAck()`,也走不到 `nextPartition()`。清 chunker 剩下的真实价值是:释放 `File` + `FileReader` 引用,以及万一将来有人改动比对逻辑时的纵深防御。我保留了它(评审要求,且本身正确),但**不把 C1 那条断言包装成行为覆盖**。

同一处的另一个诚实说明:offset 比对在理论上有一个残余歧义——两个**同尺寸**文件排队时,文件 1 的 trailing ack 与文件 2 的 partition offset 数值会相同。实测走不到:`transfer-complete` 与 trailing ack 同批到达,而文件 2 的第一次 `FileReader` 读取是异步的,ack 落地时文件 2 的 `pendingAckOffset` 还是 null(它的 partition 尚未结束),照样被忽略。要彻底消掉这个歧义需要给每个文件发一个递增 token,评审没有要求,我没有加,登记在此。

---

## IMPORTANT 2 —— 看门狗误杀健康的大文件传输

### 改了什么

- `src/files/drop/stores/drop.ts`：`TransferState` 新增 `raw: number`(0..1,未取整),由 `e.progress` 原样落盘;`progress` 仍是 `Math.round(e.progress * 100)` 供显示。
- `src/files/drop/components/DropItem.vue`：
  - 心跳 watch 从 `props.transfer?.progress` 换到 `props.transfer?.raw`;
  - 启停门从 `!!props.transfer` 换到 `!!props.transfer && props.transfer.sending === false`(**只看接收侧**);
  - 0% / 100% / undefined 三个守卫与 `onBeforeUnmount` 清理原样保留;
  - 英文注释写明两条理由(发送侧已被 `ACK_TIMEOUT_MS` 以 ~34 KB/s 的、与文件大小无关的下界兜住;接收侧每 64 KB 刷新一次 `raw`,15s 静默 ⇒ 低于 ~4.3 KB/s)。

### 测试与变异

四条既有用例:三条改成 `sending: false` + `raw` 夹具(新增 `receiving()` 工厂),第四条(`does not run at all when no transfer is in flight`)本来就不传 transfer,原样不动。

新增三条:

- `leaves a big slow download alone while it advances in sub-percent steps`(**本条就是这个 finding 的回归**:12 轮 × 5s,`progress` 恒 40、`raw` 每轮 +0.0004)
- `never watches the sending side, which ACK_TIMEOUT_MS already bounds`(断言 `vi.getTimerCount() === 0`,不只是「没 emit」)
- store 侧 `keeps the unrounded fraction alongside the rounded percent`

| 变异 | 结果 |
|---|---|
| F:watch 改回 `progress` | `1 failed \| 13 passed` —— `leaves a big slow download alone…` |
| G:启停门改回 `!!props.transfer` | `1 failed \| 13 passed` —— `never watches the sending side…` |
| H:store 把 `raw` 也取整(`Math.round(x*100)/100`) | 第一版**没红**(既有断言的值 0.5/0.2 本身就是两位小数,这是一条「因为错的理由而通过」);补了 0.4048 的用例后 → `1 failed \| 12 passed`,`AssertionError: expected 0.4 to be 0.4048` |

H 那一轮是本波唯一一次抓到自己写的覆盖不成立,记录在此。

---

## IMPORTANT 3 —— 可恢复的 ICE `disconnected` 被当成致命

### 改了什么(`src/files/drop/rtcPeer.ts`)

- 抽出 `private redialIfCaller()`,只含 `if (!this.isCaller) return; this.connectRtc(this._peerId, true)`。
- `onChannelClosed()` = `handleDisconnect('disconnected')` + `redialIfCaller()`(数据通道真的关了,是真终止)。
- `onConnectionStateChange()`：`'disconnected'` **只** `redialIfCaller()`,不上报;英文注释写明它是瞬态(consent check 失败几秒即进入,Wi-Fi 漫游/网卡抖动后常自行回到 connected,SCTP 关联与 data channel 都还活着),并写明为什么这样不留下无界等待(发送侧仍受 `ACK_TIMEOUT_MS`、接收侧受 IMPORTANT 2 的看门狗)。
- **M5**:`'closed'` 现在也先 `this.conn = null` 再进 `onChannelClosed()`,与 `'failed'` 对称——`connectRtc()` 只在 `conn` 为 null 时才新建 `RTCPeerConnection`,否则主叫会在已关闭的对象上 `createDataChannel`(真实浏览器里抛异常)。

### 测试与变异

新增三条:

- `rides out a transient ICE disconnected state without touching the incoming file`(不上报 + `hasActiveTransfer()` 仍为 true,即 digester 还握着字节)
- `reports through the data channel own onclose handler, not only the private method`(走 `onChannelOpened` 真接线,再触发 `channel.onclose()`)
- `replaces the connection when it reaches the closed state, so the re-dial can open a channel`(主叫 peer,断言 `conn` 换成了**另一个**实例)

| 变异 | 结果 |
|---|---|
| I:`'disconnected'` 改回走 `onChannelClosed()` | `1 failed \| 28 passed` —— `rides out a transient ICE disconnected state…` |
| J:`'closed'` 不再置空 `conn` | `1 failed \| 28 passed` —— `replaces the connection when it reaches the closed state…` |
| K:`onChannelClosed()` 不再上报 | `3 failed \| 26 passed` —— 三条 report 用例(含既有的两条),证明真终止路径的上报没有被这次改动削弱 |

---

## IMPORTANT 4 —— 折叠态上传框仍写「上传」

`src/files/components/UploadPanel.vue`:折叠按钮从 `{{ t('filesUploadTitle') }}` 改为 `{{ headerText }}`(与展开态 `.up-title` 同一个 computed),计数不变。

测试:`labels the collapsed toggle by what is actually running, not always "upload"` —— 只有 ops、点 `.up-close` 折叠,断言按钮文本含 `filesUploadHeaderProcessing`、**不含** `filesUploadTitle`、含 `(1)`。

变异 N:改回写死 `t('filesUploadTitle')` → `1 failed | 14 passed`,正是该用例。

**顺带观察(未改)**:`resolveUploaderHeader` 的第三态(两个队列都空 → `filesUploadTitle`)在面板里现在不可达,因为 `panelVisible` 那时就是 false。纯函数的这一态仍有自己的单测,不算缺陷,但如果将来有人以为折叠按钮会显示「上传」,这就是原因。

---

## Minor 清扫

### M6 —— 一次点击弹两个「传输已中断」

`cancelTransfer()` 改成 **先复位并上报、最后发线上消息**。`sendJSON` 在 channel 已死时会落进 `handleDisconnect('disconnected')`(它自己会上报并复位),放到最后就只会看到「什么都不在飞」而保持安静。既有的「发出了 transfer-cancel」断言不受影响(顺序变了,消息仍然发)。

测试:`reports the cancellation once even when the channel is already gone`(用真 `RTCPeer`、channel 为 null,断言 `toHaveBeenCalledTimes(1)` 且 reason 为 `cancelled`)。
变异 L:恢复旧顺序(先发后复位) → `1 failed | 29 passed`,正是该用例。

### M7 —— cancelled 有了自己的文案

新增键 `filesDropCancelled`(zh `已取消传输` / en `Transfer cancelled`),两个 base locale 都加;`stores/drop.ts` 的 `onTransferBroken` 按 `e.reason === 'cancelled'` 分流,`disconnected`/`timeout` 留在 `filesDropInterrupted`。

测试:`names a user cancellation differently from a break nobody chose`(三个 reason 依次触发,断言 toast 文本序列)。
变异 M:去掉分流 → `1 failed | 13 passed`,正是该用例。

`messageSyntax.test.ts` / `parity.test.ts` / `i18nKeys.test.ts` 全绿;新键与既有值无碰撞(`已取消传输` 与 `filesDropMenuCancel: '取消发送'` 不同字)。

#### M7 引出的一个连带缺陷(我自己引入的,已在 `4d25eb3` 修掉)

`DropPage.vue` 把看门狗的 `@transfer-stalled` 接到了 `drop.cancelTransfer(...)`。M7 落地后,**一条真死的链路会弹「已取消传输」**——用户什么都没点。修法:`cancelTransfer(reason: TransferBrokenReason = 'cancelled')`,经 `peersManager` / store 透传,`DropPage` 的 stall 那一路传 `'timeout'`(线上消息不变,仍是 `transfer-cancel`)。

测试:rtcPeer 侧 `can report the stop under a different reason while sending the same message`;DropPage 侧 `tells the store which kind of stop each device event is`(断言 `[['b'], ['b','timeout']]`);store 侧那条既有用例扩成 `('peer-x', undefined)` + `('peer-y', 'timeout')`。
变异 P:`DropPage` 不再传 `'timeout'` → DropPage 用例红(`1 failed | 7 passed`)。
变异 Q2(精确到 `cancelTransfer` 那一行,写死 `'cancelled'`)→ `1 failed | 30 passed`,正是 rtcPeer 那条。
(第一次做 Q 时 `replace` 同时命中了 `handleDisconnect` 的上报行,红了 8 条——过宽的变异,已重做为 Q2。)

### M8 —— 被后续工作推翻的注释,五处

1. `rtcPeer.ts:1-2`「逐字移植…差异**仅**」→ 改写成:wire 协议是移植的那部分且必须保持兼容,外面那一层可靠性(断连主干 / ack 超时 + 逐分区匹配 / 取消 / chunker abort / ICE 瞬态与终止的区分)**没有 Vue2 对应物**。
2. `chunker.ts:1-2` 同样的「逐字移植」框架 → 保留「64KB/1MB 是 wire 可见的数字,别改」,并把 `abort()` 登记为有意的新增(FileReader 的 load 回调闭包持有 chunker,置空引用停不下来)。
3. `rtcPeer.ts` ~74-79 那段声称 `else if (this.chunker)` 能挡住野 ack → 已按真实修法重写(见 CRITICAL 1)。
4. `UploadPanel.vue` ~53-55 的「empty -> non-empty transition」→ 改成如实说明 `shouldAutoOpenUploadList` 是 `curLen > prevLen`,**任何增长**都会把折叠的面板重新弹开(行为不动)。同一文件里 ~22-26 那段初始化注释有同样措辞,一并改准。
5. `AppSettingsPage.vue:189` 引 `UploadPanel.vue` 当 `--drop-bad + --remove-fg` 的例子 —— `grep -c drop-bad src/files/components/UploadPanel.vue` = 0。改指真的在用的四处(`GridGhost.vue .bad`、`CustomAppsPage.vue .set-conflict`、`FileTile.vue` / `FileRow.vue` 的冲突角标,逐个 grep 核过),并注明「早先版本引的 UploadPanel.vue 从未用过这个 token」。既然在动这段注释,按 CLAUDE.md 的「顺手翻译」条款把它整段译成英文。

这五处没有杀手变异 —— **它们是注释,不是行为**。如实说明,不包装成覆盖。

### M9 —— Part A 删除留下的孤儿

- `filesTasksTitle`:两个 locale 各删一行(唯一消费方 `OperationStatusBar.vue` 已删)。
- **`messageSyntax.test.ts` 里没有点名它的碰撞表行**:`grep -rn "filesTasksTitle" src/` 在删除前只有两个 locale 文件两处命中,别处零命中 ⇒ 该 finding 的这半**前提不成立**,同一提交里没有需要连带删除的行。这是我与评审的第二处分歧,已在提交信息里写明。
- `useFileOpsStore().visible`:computed 与 `return` 里的导出一起删,`ref, computed` 的 import 收窄成 `ref`;`fileOps.test.ts` 里只为它存在的两行断言删掉,用例标题相应改成「ingest 只保留活动任务」,该文件其余部分不动(第一行断言换成 `expect(s.active).toEqual([])`,保住「初始为空」这个仍然有效的前置)。

### M10 —— 「全部取消」没有任何样式规则

`.up-link-btn.up-ops-cancel-all { color: var(--remove-fg); }` —— 复合选择器,与旁边 `.up-link-btn.up-del` / `.up-link-btn.up-delete-all` 同一手法(压过 `.up-link-btn` 的 accent,与书写顺序无关)。`--remove-fg` 在 `theme.css` 的 `:root`(#ff8a8a)与 `:root[data-theme="light"]`(#c0392b)**两块都已有值**,不需要新增 token,也没有新字面量色。

测试:`paints cancel-all as destructive, like every other destructive control here` —— jsdom 既不做级联也不解析 `var()`,所以对源文本断言:规则存在且只有一条、选择器是复合的、颜色走 `var(--remove-fg)`。
变异 O:删掉该规则 → `1 failed | 14 passed`,正是该用例。

**未做的那半,附理由**:finding 提到这个按钮「无确认」就取消所有服务端任务。我只做了 finding 的 Fix 段明确要求的配色。加确认框会改变交互(并让既有用例 `cancels every operation through the store when cancel-all is pressed` 需要改夹具),属于产品决策而不是这次评审要求的修复;如需要,建议单独开票——`askDelete(...)` 的现成机制就在同一文件里,接上去是三行。

---

## 未修 / 需要机主知道的

1. **`.up-ops-cancel-all` 的确认框**(上面 M10 最后一段)——刻意未做。
2. **同尺寸文件的 offset 歧义**(CRITICAL 1 末段)——理论残余,实测走不到,未加 per-file token。
3. **真机验收一步没跑**。本波改的东西里有三件只能在两台设备上验:大文件慢链路不再被误杀(IMPORTANT 2)、Wi-Fi 漫游期间接收不中断(IMPORTANT 3)、取消只弹一个 toast 且文案是「已取消传输」(M6+M7)。IMPORTANT 4 与 M10 单机可验(粘贴 GB 级文件 → 折叠面板文案 / 「全部取消」是红的,浅色深色各看一遍)。
4. 未部署、未推 origin、未合 master。

---

# 二次(定向)评审后的收尾波 · `05b064c`

> 九条 finding 全部裁定 ADDRESSED。本波只处理二次评审新发现的 1 条 Important(**由我的 I2 门引入**)+ 2 条硬约束小疏漏,并按要求改写三处措辞。

## IMPORTANT(新)—— 任何一次成功发送之后,来自该 peer 的下一次**接收**完全没有看门狗

### 根因

`Peer.files` 由 `sendFiles()` 写入,只有 `resetTransferState()` 会清——`onTransferCompleted()` 不清。
所以给 peer X 发完一个文件后 `files.length` 恒为 1;X 反过来发文件时,接收侧的进度事件仍带 `files.length === 1`
⇒ store 的 `sending = e.files.length > 0` 判为 **true** ⇒ 我新加的门(`props.transfer.sending === false`)**永不放行**,
这次接收从头到尾没有看门狗。

**为什么是我引入的**:`sending` 的陈旧误标本身是既有问题(卡片会写「正在发送」),但**改动前的门是 `!!props.transfer`,
看门狗照样跑,死掉的接收仍然有界**。换成只看接收侧之后,这条路径上**唯一**的界就没了——接收路径没有 ack 定时器、
通道还开着、卡片冻住、半组装的文件永不丢弃、也不弹 toast。触发条件正是这个页面存在的意义:给一台设备发一个文件,再收它发回来的。

### 改法与我的取舍(评审要求明确表态)

`onTransferCompleted()` 里清 `this.files`,**但带 `filesQueue` 已排空的条件**,并且放在 `dequeueFile()` **之前**:

```ts
if (!this.filesQueue.length) this.files = []
this.dequeueFile()
```

**选条件清、不选无条件清**,理由是多文件发送:`sendFiles([f1,f2])` 时 `files=[f1,f2]`,f1 完成后 f2 还在发,
`sending` 必须继续为 true(否则 f2 的整段发送期会被当成接收,既标错卡片又给它套上一个本不该有的看门狗)。
放在 `dequeueFile()` 之前是因为 `dequeueFile()` 会把 f2 移出队列并把 `busy` 重新置真,之后再看 `filesQueue.length`
就分不出「刚开始发下一个」和「真的发完了」。(等价写法是 dequeue 之后判 `!this.busy`;选了前者,因为它把
「这是队列里最后一个文件」这句话直接说出来。)

顺带修掉了那条既有的误标:发完之后 peer 空闲时卡片不再声称「正在发送」。

### 测试与变异

新增 describe `Peer send/receive interleaving`,两条:

- `reports a receive that follows a completed send as receiving, not sending`
  —— 发完一个文件(含真 wire 顺序的 transfer-complete + trailing ack),清空 mock,再喂 header+chunk,
  断言**每一条** `onFileProgress` 的 `files` 都是 `[]`。
- `keeps calling a multi-file send a send between its files`
  —— 两文件队列,f1 完成、f2 开始后喂一条对端的 `progress` 消息(发送侧的进度就是从这里来的),
  断言 `files` 仍是 `['one.bin','two.bin']`。这条守的是「条件清」这个取舍。

| 变异 | 结果 |
|---|---|
| R:整句 `if (!this.filesQueue.length) this.files = []` 删掉(回到评审发现的状态) | `1 failed \| 32 passed` —— `reports a receive that follows a completed send as receiving, not sending`,`AssertionError: expected [ File{ …(1) } ] to deeply equal []` |
| S:改成无条件 `this.files = []` | `1 failed \| 32 passed` —— `keeps calling a multi-file send a send between its files`,`AssertionError: expected [] to deeply equal [ 'one.bin', 'two.bin' ]` |

**链路闭合说明**:「看门狗真的启动了」这一半不需要新用例——`DropItem.vue` 侧已有
`never watches the sending side…`(sending=true ⇒ `vi.getTimerCount() === 0`)与三条 sending=false 的看门狗用例,
store 侧已有 `files: []` ⇒ `sending: false` 的断言;唯一缺的一环就是引擎的 `files`,由上面第一条用例补上。

## 两条硬约束疏漏

1. `rtcPeer.ts` `redialIfCaller()` 的 JSDoc 里残留中文片段 `(Vue2 同)` → 改为 `(same as Vue2)`。代码注释英文-only。
2. `src/files/stores/fileOps.test.ts` 的用例标题我上一波改成了 `'ingest 只保留活动任务'`——**动过就算我的**,
   按本期「测试描述一律英文」的裁定译为 `'keeps only the active tasks on ingest'`。

## 措辞改写(按二次评审要求)

`onConnectionStateChange()` 里 `'disconnected'` 分支那句 “so nothing is unbounded” 过于乐观,已改写为:
发送受 `ACK_TIMEOUT_MS`、接收**在已经画出进度卡之后**受看门狗,并点名两个既有盲区(取整百分比仍为 0 时看门狗直接 return;
header 到了但第一个 chunk 没到时压根不生成 `transfers` 条目)⇒ 在最初那一小段里死掉的接收**仍然无界**,已挂票、本波不动。

## 挂账(按要求只记录,不改)

1. **同尺寸 offset 歧义:上一波我写「实测走不到」,措辞过强,已按二次评审更正为「万一发生也无害」**。
   二次评审用探针证伪了「不可能」:文件 1 = 1 024 000 B、文件 2 = 2 500 000 B(其第一个 partition 恰好也在 1 024 000 结束),
   若让文件 2 的首次读取先于 trailing ack 落地完成,那条陈旧 ack **会**被当成文件 2 的而被消费掉;
   HTML 规范并不保证 datachannel `message` 任务与 `FileReader` load 任务之间的先后。
   后果经其确认是良性的:传输照常完成、不卡死,最坏是多一个未被确认的 partition(≤1 MB)在途。
   **不实现 per-file token**(评审明示)。
2. **远端腿的误标**:`case 'transfer-cancel'` 无条件上报 `'cancelled'`,而线上消息不带 reason
   ⇒ peer B 的**看门狗**停机会让 peer A 读到「已取消传输」。需要给协议加一个附加字段,受兼容性约束 ⇒ 开票,不在本波改。
3. **两个既有看门狗盲区**(上面「措辞改写」那段点名的两条)⇒ 只软化注释,不重构。

## 本波的门

- `pnpm exec vitest run src/files/drop/ src/files/stores/ src/i18n/`:**34 文件 / 412 例全绿**(前台跑)
- `pnpm exec vue-tsc --noEmit`:0 错
- 提交后全量:见下方返回摘要
