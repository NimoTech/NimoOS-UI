# SP12 T10 交接票 —— 粘贴进度并入上传框、下线 OperationStatusBar

> 写于 2026-08-09,由 SP12 Plan C(T9 + T11)一线留下。**本期没做 T10**,这份写清为什么、
> 以及具体缺什么,好让接手的人不必重新做一遍差集。

对应 Vue2 提交:`6ac65294 feat(files): 粘贴任务进度并入上传框,右上角 OperationStatusBar 下线 (#89)`
(`NimoOS-UI` **origin/main**,不是本地检出 —— 本地停在旧分支)。

---

## 1. 为什么本期不做(机主 2026-08-09 拍板)

T10 要改 `src/files/components/UploadPanel.vue` 的**头部文案**与**新增分组**;
而并行的 **sp12-plan-b(T1/T7/T8 统一冲突弹窗)** 要整体替换该文件 227-234 行那套
逐文件冲突 `Dialog`。两条线同期改同一个文件,合并冲突面无谓地大。

机主的原话口径:**不做,但要记清楚为什么不做、没做什么。**

⇒ **接手时机:等 sp12-plan-b 合回主干之后,单独成一期做。** 那时 `UploadPanel.vue` 的
冲突弹窗形态已经定下来,T10 只在它旁边加分组、改头部,不再互相踩。

---

## 2. 没做什么(逐条,照 spec §5 的 T10 条目)

| spec 里写的 | New-UI 现状(2026-08-09 代码级核过) |
|---|---|
| 纯函数 `opsTaskPercent` | **未建。**⚠️ 别以为 `src/files/util/fileOps.ts:37` 的 `taskPercent` 就是它 —— **语义不同**:现有的在 `total_size<=0` 时返回 `0`,Vue2 的 `opsTaskPercent` 返回 `null`,用来区分「大小未知的进行中态」(返回 0 会画出一条谎称 0% 的进度条)。 |
| 纯函数 `opsTaskLabelKey` | 未建。现在是 `OperationStatusBar.vue:10` 组件内的 `label()`,三元写死 copy/move。 |
| 纯函数 `opsTaskBasename` | 未建。现在是 `OperationStatusBar.vue:14` 的 `baseName()`。 |
| `resolveUploaderHeader` 头部三态 | **未建,且 New-UI 根本没有上传框头部三态。**`UploadPanel.vue:153` 是写死的 `t('filesUploadTitle')`。所以这条对 New-UI 是**新增能力**,不是「有三态但漏了 ops 这一路」—— 照 Vue2 的注释理解会误判工作量。 |
| 上传框新增「文件操作」分组 | 未建。 |
| 删 `OperationStatusBar.vue` 及其挂载 | **仍在。**组件 `src/files/components/OperationStatusBar.vue`(56 行),挂载点 `src/views/Files.vue:17`(import)与 `:622`(模板)。形态是左下角独立浮层。 |
| 保留「全部取消」 | `ops.cancelAll()` 已存在(`src/files/stores/fileOps.ts:19`),迁过去时别弄丢。 |

### spec 漏列的一条

Vue2 `fileOpsRow.js` 里还有 **`attachOpsTaskSpeeds`**(按相邻两次 socket 推送的字节差/时间差
算每个任务的瞬时速度,并维护采样表、任务消失时自动清理防泄漏)。**spec §5 的 T10 条目没有列它。**
做的时候要明确决定收不收 —— 上传框现有的 `formatSpeed`/`batchSpeed` 走的是另一套(上传项自带
`speed` 字段),文件操作这边没有速度来源,想显示速度就得把这个纯函数一起搬。

---

## 3. 一个会绊倒人的结构性前提

`UploadPanel.vue:146` 的显示条件是 **`v-if="totalCount"`**,而 `totalCount` 是**上传队列长度**
(`store.queue.length`)。

⇒ 文件操作并进来之后,**只有粘贴任务、没有任何上传**时面板必须也能出现。这个条件得跟着改
(例如 `totalCount || fileOps.active.length`),否则新加的「文件操作」分组在最常见的场景下
——用户只是粘贴了一批文件、根本没在上传——**永远看不见**,而单元测试若只喂上传队列是照不出来的。

同理,「关闭面板」`open` 的自动展开逻辑(`shouldAutoOpenUploadList`,只看队列长度前后变化)
也只认上传队列,粘贴任务开始时不会自动弹开。

---

## 4. 现场坐标(已复核,可直接用)

- 数据源:`src/files/stores/fileOps.ts` —— socket `nimoos:file:operate` 全量推送经
  `parseFileOperate` → `filterActive` 落 `active`;完成且目的地是当前目录则 `files.load()` 重拉。
- 任务形状:`src/files/util/fileOps.ts:3` 的 `FileTask`
  (`id/type/finished/status/processing_path/processed_size/total_size/to`)。
- 待删组件:`src/files/components/OperationStatusBar.vue` + `OperationStatusBar.test.ts`。
- 挂载点:`src/views/Files.vue:17`、`:622`。
- 注:`src/apps/views/AppSettingsPage.vue:190` 有一处**注释里**提到 OperationStatusBar,
  只是引用它的配色先例,**不是挂载点**,别跟着一起删。
- i18n 现有键:`filesTasksTitle` / `filesCancelAll` / `filesOpCopy` / `filesOpMove`
  (删组件时别把还在用的键一起清掉)。

---

## 5. 顺带:本期发现的、与 T10 相邻的既有隐患

`UploadPanel.vue:284` 的 `.up-progress` 用 `var(--chip-bg, ...)` 当进度槽底色,而
`--chip-bg` 在纸感(浅色)主题里是**纯白 `#ffffff`**(`theme.css:337`),刷在同为浅色的
`--popup-bg` 面板上基本不可见。本期给侧栏容量条新增了 `--usage-track`(深浅两套都给了值)
正是为了避开这一点。**T10 动上传框时顺手核一下浅色主题下的进度槽**,这条没单独开票。
