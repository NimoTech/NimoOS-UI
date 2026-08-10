# SP12 后续批次设计 —— T10 文件操作进度并入上传框 + #90 互传可靠性核心

> 2026-08-10。分支 `sp12-files-fixes`(worktree `.claude/worktrees/sp12-files-fixes`)。
> 开工前已把 master 合入本分支(合并提交 `b25014c`,`git merge-tree` 预演 exit 0 无冲突),
> 并跑过 `pnpm install` 重链 pnpm 硬链接。
>
> 本批由机主 2026-08-10 逐项拍板选定:**T10 全做 · #90 只做「可靠性核心」四件**。

---

## 0. 开工前的取证结论(六条,推翻了原清单/spec 的说法)

这一节是本设计的地基。每一条都做过代码级或真机取证,**照旧说法开工会做错事**。

| # | 原说法 | 取证结论 | 证据 |
|---|---|---|---|
| E1 | spec §5 把 #90 描述成「断连上报 + 30s 超时」 | **严重低估**。Vue2 `139f783a` 实际是 1645 行、`Network.js` 独自 +541 行,含背压流水线 / File System Access 流式落盘 / 接收确认握手 / ICE 诊断 / digester 空指针修复 | `NimoOS-UI` `git show --stat 139f783a` |
| E2 | #90 含 `_isCaller` 拼写 bug 修复 | **New-UI 无此 bug**,不必修。`isCaller` 在四处用法一致 | `src/files/drop/rtcPeer.ts:131,146,190,204` |
| E3 | #90 含流式落盘(File System Access API) | **本设备做不了**。`showSaveFilePicker` 要求安全上下文,而 NAS 走 HTTP 局域网 IP。硬做只会恒定走内存兜底 | 与 `01-文件区-SP4.md` F8 否掉 FSA 的理由同源;记忆 `newui-clipboard-insecure-reka` |
| E4 | 「New-UI 没有 DropContextMenu,取消入口无宿主」(我在对话中的第一版说法) | **不准确,已更正**。`DropItem.vue` 已有 reka-ui `ContextMenu`,只是里面当前只有一项「发送」⇒ 加「取消发送」是往已有菜单里加第二项,不是新造交互 | `src/files/drop/components/DropItem.vue:71-89` |
| E5 | T10 是「补一个缺失的进度显示」 | **不是**。粘贴进度**现在就能看见**(左下角 `OperationStatusBar.vue`,56 行);socket 管线也已在 store 里 ⇒ Vue2 #89 中「把 socket 处理器从组件搬到 FilePanel」那半**工作量为零**。T10 的真实内容 = 换显示位置 + 新增头部三态 + 抽三个纯函数 | `Files.vue:17,739`(挂载)、`:578`(socket 接线)、`stores/fileOps.ts` |
| E6 | (机主提问引出)「进度条从没见过 ⇒ 可能是坏的」 | **没坏,是采样太慢**。后端 `CheckFileStatus` 每 **3 秒** stat 一次目标文件更新进度,`SendFileOperateNotify` 也每 3 秒推一次;本机 `/DATA` 是 NVMe,实测本地复制 **1.4 GB/s** ⇒ 日常粘贴在第一个采样点前就结束,只闪一下 0% | 真机实测:复制 1.5GB 只得 `STARTING`+`FINISHED` 两条;复制 12.8GB 得 **13 条 `PROCESSING`**,`processed_size` 0→12886696675 |

**E6 对本批的意义**:T10 的用户可见收益比原以为的更小(挪动一个日常几乎看不见的东西)。
机主知情后仍拍板照做,理由是形态收敛 —— **本设计不再把 T10 包装成「用户能感知的改进」**。

### E6 顺带发现的后端真 bug(不在本批修,建议开票)

`NimoOS/service/notify.go:133` 的 `pushSingleFileNotify`(**取消路径专用**)双重包裹:

```go
msg["file_operate"] = string(json.Marshal(map[string]interface{}{"file_operate": model}))
```

解析出来是 `{file_operate:{data,state}}` 而非 `{data,state}`。**Vue2 与 New-UI 都读 `.data`,两边都会解析成空数组** ⇒ 取消任务的终态通知前端收不到。周期广播路径(`:162/:201/:251`)形状正确,故只影响取消。前端不做兼容(兼容一个明显的后端笔误会把它固化)。

---

## 1. T10 —— 文件操作进度并入上传框

### 1.1 用户可见变化

左下角独立浮层消失;剪切/复制粘贴进度出现在右下角上传框的「文件操作」分组里;
上传框头部文案随状态变(只上传 / 只粘贴 / 两者兼有)。

**如实声明**:受 E6 约束,这个分组在本机日常操作下仍然只会一闪而过。要看见它必须粘贴 GB 级文件或往慢介质粘贴 —— 验收清单据此编写。

### 1.2 新建 `src/files/util/opsRow.ts`(纯函数层)

四个纯函数,与组件解耦以便单测:

- `opsTaskPercent(task): number | null`
  **`total_size <= 0` 返回 `null`,不是 `0`。** 这不是风格差异:返回 0 会画出一条谎称「0%」的进度条,而真实语义是「大小未知的进行中」。
  ⚠️ **现有 `src/files/util/fileOps.ts` 的 `taskPercent` 不动** —— 它在 `total_size<=0` 时返回 `0`,语义不同且另有调用点。两者并存,`opsRow.ts` 里用英文注释写明差异,防后人「统一」掉。
- `opsTaskLabelKey(task): string` —— 返回 i18n key(不是文案),替代组件内写死的 `task.type === 'copy' ? ... : ...` 三元
- `opsTaskBasename(path): string` —— 替代组件内 `baseName()`;保留「只显示文件名,不泄漏 `/DATA` 全路径」的既有约束
- `resolveUploaderHeader({ uploadCount, opsCount }): string` —— 返回 i18n key,三态:
  - 有上传(无论有没有 ops)→ 上传态(**混合态优先显示上传**,与 Vue2 一致)
  - 只有 ops → 处理文件态(**新 i18n 键**)
  - 都没有 → 默认标题
  ⚠️ **New-UI 现在压根没有头部三态**(写死 `t('filesUploadTitle')`),所以这条对我们是**新增能力**,不是「有三态但漏了 ops 那一路」。照 Vue2 注释理解会误判工作量。

### 1.3 `src/files/components/UploadPanel.vue`

- **显示门控**:`v-if="totalCount"` 同时认 ops。
  ⚠️ **这是交接票 §3 点名会绊人的地方** —— `totalCount` 是上传队列长度;不改的话,「只粘贴、没在上传」这个最常见场景下新分组**永远看不见**,而单测若只喂上传队列**照不出来**。折叠态按钮上的计数同理。
- **自动弹开**:`shouldAutoOpenUploadList` 现在只看上传队列长度前后变化;ops 从空变非空也要能弹开。
- **新增「文件操作」分组**:位置照 Vue2 —— 警示区之后、上传中区之前;复用上传行的视觉语言(名称 / 百分比 / 进度条)。
- **「全部取消」**:迁移 `ops.cancelAll()`(后端只支持整批取消,别弄丢也别改成逐项)。

### 1.4 删除

`src/files/components/OperationStatusBar.vue` 及其测试、`Files.vue:17` 的 import、`:739` 的模板挂载。
**socket 接线(`Files.vue:578`)与 `stores/fileOps.ts` 一律不动** —— 它们本就在组件之外。

### 1.5 不做

**速度显示**(机主拍板)。连带**不搬** Vue2 `fileOpsRow.js` 的 `attachOpsTaskSpeeds`(spec §5 漏列了它)。
后端 socket 不发速度字段,要显示就得自建采样表 + 任务消失时清理防泄漏,收益不抵成本。

---

## 2. #90 —— 互传可靠性核心四件

### 2.1 用户可见变化

对端掉线/关页时,进度环不再永远停在那里假装还在传 —— 明确提示「传输已中断」并复位;
此后**还能再给这台设备发文件**(现在的行为是该设备从此彻底卡死,除非刷新整页)。
传输中右键设备可以取消。传输中想离开互传页或关标签页,会先问一句。

### 2.2 现状缺口(逐条取证)

| 缺口 | 坐标 | 后果 |
|---|---|---|
| 接收端断连**完全静默** | `rtcPeer.ts:190` `onChannelClosed()` 对非主叫 `return` | 一个信号都不发,UI 无从知晓 |
| **无任何超时** | `rtcPeer.ts:36` `if (this.busy) return` | 对端消失后 `busy` 恒真 ⇒ 该 peer 队列**永久卡死** |
| 无 `cancelTransfer` / `hasActiveTransfers` | 全仓零命中 | 无法取消,也无法做切页守卫 |
| `sendRaw` **静默丢片** | `rtcPeer.ts:212-217` 无 channel 时 `refresh()` 后直接返回 | 这一片数据丢失,传输就此停住且无人知情 |
| UI 不消费任何断连信号 | `DropItem.vue` 只画进度环 | —— |

### 2.3 改动

**`protocol.ts`**:新增 `transfer-cancel` 消息类型。

**`rtcPeer.ts`**(核心):
- `PeerEvents` 新增 `onTransferBroken({ peerId, reason })`
- `onChannelClosed()`:去掉「非主叫直接 return」的静默 —— **两端**都上报断连并复位该 peer 传输态(`busy` / `chunker` / `digester` / `filesQueue` / `lastProgress`);**主叫仍然重连**(不改既有重连行为,只是不再吞掉信号)
- `onConnectionStateChange()`:补 `closed` 分支(现只认 `disconnected` / `failed`)
- **发送端等待超时**:等 `partition-received` 与等 `transfer-complete` 各武装 30s 定时器,超时按断连处理。**这是解「`busy` 恒真、队列永久卡死」的关键**;收到对应消息即清除定时器
- `sendRaw` 无 channel 时不再静默丢片,改为上报断连
- 新增 `hasActiveTransfer()`;新增 `cancelTransfer()`:中止 chunker、发 `transfer-cancel`、复位队列;接收端收到 `transfer-cancel` 丢弃 digester 缓冲

**`peersManager.ts`**:`hasActiveTransfers()` / `cancelTransfer(peerId)` 转发到对应 peer。

**`stores/drop.ts`**:接 `onTransferBroken` → 清 `transfers[peerId]` + toast「传输已中断」(新 i18n 键);向 UI 暴露 `hasActiveTransfers()` / `cancelTransfer(id)`。

**`DropItem.vue`**:
- 已有的右键菜单(`:71-89`)加第二项「取消发送」,**仅传输中出现**
- **进度看门狗**:5 秒检查一次,处于进行中(`0 < progress < 100`)且 **15 秒**没有新的进度更新 ⇒ 按断连处理,并调 `cancelTransfer(device.id)` 清理该 peer 的发送队列/接收缓冲。组件卸载时必须清掉定时器

**新建 `src/files/drop/leaveGuard.ts`**:不依赖 Vue 实例的纯函数 + 两处接线
- **路由离开**:`DropPage.vue` 用 `onBeforeRouteLeave`,有活动传输时弹确认
- **关页/刷新**:`beforeunload` 挽留
- ⚠️ **形态照 `src/files/upload/unloadGuard.ts`,但装载位置不照抄**:票 A 已判定 `unloadGuard` 装在 `Files.vue` 是错的(上传队列是应用级 Pinia store,导航走了照传)。**互传传输只在 drop 页发生**,装在 `DropPage` 是对的。这条差异要写成英文注释,免得后人「照先例」抄错方向。

### 2.4 明确不做(写进设计,免得后人当漏做)

- **流式落盘 / File System Access API** —— 见 E3,安全上下文不具备
- **背压流水线**(`bufferedAmount` 水位控制)—— 性能优化,非缺陷修复
- **接收确认握手**(「对方要给你发 X,接受/拒绝」)—— 改协议层,风险高于本批四件
- **ICE 诊断日志**
- **`_isCaller` 拼写修复** —— 见 E2,New-UI 无此 bug

---

## 3. 测试策略

- **纯函数全覆盖**:`opsRow.ts` 四个 + `leaveGuard.ts`
- **`rtcPeer` 状态机**:mock channel + fake timers。**必须覆盖「对端消失 → 30s 后队列解锁 → 能再次发送」这条整链** —— 它是本批最核心的行为,只测「发了 broken 事件」不算数
- **看门狗**:fake timers,覆盖触发条件与卸载清理
- **`UploadPanel`**:必须有一条「**零上传、只有 ops** 时分组仍出现」的用例(§1.3 点名的坑);头部三态逐态断言
- **变异验证**:每条改动做一次,并在报告里如实写明变异是否让目标用例变红、哪些用例因性质使然改前也绿

**本仓已知的「测试因为错的理由而通过」高发区**(前几批累计 7 例),本批重点防:
- 断言落在**生效载体**上,不是构造参数(SP9-P5 noVNC 教训)
- `beforeEach` 要 `vi.clearAllMocks()`,否则模块级 `vi.fn()` 的旧调用记录会让 `toHaveBeenCalledWith` 恒真(A 批 N1 教训)
- 同一组件在树里有多个实例时,`findComponent` 默认命中第一个(A 批 Task 7 教训)

## 4. 门(收尾统一跑)

`pnpm exec vue-tsc --noEmit` · `pnpm exec vitest run`(全量) · `pnpm exec vitest run src/i18n/parity.test.ts` · `pnpm build` · `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss`

⚠️ **跑 oss 门前必须先提交** —— 未提交的 `src/**` 改动会让 `checkClean` 拒绝导出,表现成另外几条 export 测试变红,容易误判成新缺陷。

## 5. 真机验收清单(交付时给出,本期不跑)

验收方式:本工作树起 dev server(`pnpm dev --host --port 5299`,避开 5273/5277/5288)。非 cutover 期**不要** `deploy.sh`。

**T10**(⚠️ 受 E6 约束,**必须用 GB 级文件**,否则什么都看不到)
1. 复制一个 **≥5GB** 的文件粘贴到另一目录 → 上传框自动弹开,出现「文件操作」分组,进度条**真的在涨**(约每 3 秒跳一次)
2. 同上,**同时**在传一个上传 → 头部文案显示上传态(混合态优先上传)
3. 只有粘贴、**零上传** → 上传框仍然出现(这是最容易漏的一条),头部显示处理文件态
4. 粘贴进行中点「全部取消」→ 任务停止,分组消失
5. 左下角**不再有**任何独立浮层
6. 浅色 / 深色各看一遍新分组:进度条、文案、取消按钮不得白底白字或看不见

**#90**(需**两台设备**)
7. A 向 B 发一个大文件,传输中**拔掉 B 的网**(或关掉 B 的标签页)→ A 侧进度环停止并提示「传输已中断」,**不再永远停在原处**
8. 接第 7 步:B 恢复后,A **还能再次**给 B 发文件(这是「队列解锁」的判据;修复前这里会彻底卡死)
9. 传输中在 A 侧右键那台设备 → 菜单里有「取消发送」→ 点它 → 两侧都停止,B 侧不残留半个文件
10. 传输中点侧栏离开互传页 → **弹确认框**;选取消则留在页面且传输继续
11. 传输中关闭标签页 → 浏览器**弹原生挽留**
12. 非传输状态下右键设备 → 菜单里**没有**「取消发送」;离开页面**不弹**任何确认

## 6. 挂账(本批之后仍欠)

- 后端票:`pushSingleFileNotify` 双重包裹(见 E6 附注)
- #90 未做的四块:背压 / 流式落盘 / 接收确认握手 / ICE 诊断
- 票 A(`installUnloadGuard` 装错生命周期)、票 B(重试撞死 URL 死循环)—— 机主本批未选
- I1(Esc 取消粘贴时不撞名的文件已落地)—— 待机主拍板
- plan-b 已知未修 #2/#5/#6
- 三批真机验收清单(12 步 + 10 步 + 18 步)一步没跑
