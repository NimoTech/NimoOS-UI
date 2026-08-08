# SP12 — 7-15 之后的 Vue2 增量补迁（Files 区）设计

> 日期：2026-08-08 · 阶段：SP12 · 尺寸：**L** · 状态：设计已确认，待写实施计划

## 1. 背景

New-UI 的移植蓝本是 **2026-07-15 的 Vue2**（`NimoOS-UI` 分叉点 `34d1e9ad`，即 #73 时光机重建）。
Vue2 `origin/main` 在那之后继续演进到 `03245590`（2026-08-07），共 **74 个提交 / 489 文件 / +43670 行**。

`docs/vue3-migration-roadmap.md` 的 SP12 条目记的是「Moments + Albums/SmartViews 统一 + 零散四条」，
**这份清单低估了差集**。本期开工前按 roadmap 要求做了一次全量差集重算（2026-08-08），
结论见 §2。

### 1.1 差集重算的方法与两个取证坑

差集**不能按提交列表算**：New-UI 在 SP4–SP11 期间是照**当时的** Vue2 做的，不是照 7-15 蓝本，
所以 7-15 之后 Vue2 的许多增量早已被 New-UI 自己吃掉（Knowledge/Notes 整块 11 条即是如此）。
唯一可靠的算法是**逐块把 Vue2 的行为要点拿到 New-UI 里做代码级对照**。

重算过程中踩到两个取证坑，记录以防复发：

1. `grep -E` 模式下写 `"a\|b"` 匹配的是**字面竖线**，不是"a 或 b"。第一轮探测里带 `\|` 的行
   全部返回假 0，一度得出「Files 区整块没有冲突/批次/时光机」的错误结论。
2. 关键词 `licit` 被 `explicit` 撞车，`elicitation` 一度显示 25 处命中，实际 New-UI **0 处**。

> 教训与 `vue3-pending-audit` 那条一致：**汇总出的结论落盘前必须过代码级取证**，
> 且取证命令本身也要验证（用一个已知为真、一个已知为假的样本对照）。

## 2. 差集重算结论（2026-08-08）

### 真缺口 20 项（Photos 4 · Files 9 · 其它 7）

| 区 | 提交 | 内容 |
|---|---|---|
| Photos | #100 #107–#111 | **Moments 整块**（`Moment` 全仓 0 命中） |
| Photos | #112–#117 | **Albums / SmartViews 统一**（New-UI 仍两条独立路由，改动会推翻现有 IA） |
| Photos | #79 #82 | Smart View 手动钉住/移除/恢复 + excluded 列表 + 操作后统计刷新 |
| Photos | #137 部分 | 关系图节点上限 + 头像兜底 + 空态 |
| **Files** | **#77 半 · #75 #85 #86 #88 #89 #91 #94 #122** | **本期范围，见 §3** |
| 其它 | #93 | LAN Devices 设置页 |
| 其它 | #98 | Knowledge 桌面应用磁贴（New-UI 只有 `/ai` 下路由，桌面无入口） |
| 其它 | #103 | 设置里 Photos Cache 迁移入口 |
| 其它 | #125 | KVM 磁贴按服务可用性门控 |
| 其它 | #128 | 默认应用图标换自有美术 |
| 其它 | #136 | MCP elicitation 两张卡（表单卡 + URL 授权卡含 Punycode 钓鱼警告）—— 提交标题写的是 "test button ghost collision"，**实际是整块新功能**，勿被标题误导 |
| 其它 | #141 | MCP version probe |

### 待拍板（两边实现不同，非「缺」）

- **#138–#140 Photos 性能改造**：Vue2 改成 bucketed timeline / 窗口化网格 / Trash·Favorites 分页 / 重试退避。
  New-UI `photos/util/timeline.ts` 是另一套实现，硬对齐可能是无用功；但「大照片库会不会卡」需要独立结论。
- **#90 P2P 丢送重修**：New-UI 有 `partition-received`，但没有断连上报（`peer-transfer-broken`）和 30s 超时。
  Vue2 修的是「对端消失导致 `_busy` 恒真死锁」。**本期不做**，见 §7。
- **#106 places 地图未点亮点对比度**：两边样式体系不同，属视觉核对。

### 已被 SP8/SP9 吃掉（不做）

Knowledge/Notes 整块 11 条（#78 #80 #83 #84 #87 #92 #99 #101 #102 #104 + #92 Wiki 地图视图）·
MCP #74 #76 · #97 Terminal Security & Logs · #77 的时光机那一半 · #96 时光机空快照空态

### 不适用（Vue2 仓自身的开源整备）

#118–#135 共 14 条（LICENSE / README / CI / 贡献指南 / 翻译 / 域名 / lockfile / 死代码清理）·
#81 PhotosToast（New-UI 自有 toast 体系）· #95 `vue.config.js` 生产判断 · #105

## 3. 本期范围：Files 区 9 条

用户 2026-08-08 拍板：**SP12 = Files 区**，Photos 两大块与其它零散条目留后续期。

范围是 **9 条**而非 roadmap 记的 1 条（#122）：

| # | 内容 | New-UI 现状 |
|---|---|---|
| #77 半 | 恢复/粘贴冲突用户选择体系（全局 `FileConflictDialog`）。**本期只建弹窗并接上传**，粘贴与快照恢复的接入另开票，见 §7 | 无。粘贴冲突只有右键菜单两个死选项，快照恢复不问直接恢复 |
| #75 | 上传架构换代：废除 IDB 断点续传 → 批次对账 + 裂开角标 | 仍是蓝本的 IDB 续传形态 |
| #85 | 上传接同名冲突弹窗 | 无 |
| #86 | 上传文件夹 Windows 式合并语义 + `upload-precheck` 内层检查 | 无 |
| #88 | Location 重试 / 骨架屏卡死 / RAID 用量兜底 | 无 |
| #89 | 粘贴进度并入上传框，下线 `OperationStatusBar` | 仍是左下角独立浮层 |
| #91 | 裂开角标可点击 | 无（整个"裂开角标"概念都没有） |
| #94 | 网格视图虚拟滚动 | 全量 `v-for`（`FileGridView.vue` 28 行） |
| #122 | 放弃批次遇 404 视同已放弃 | 无 |

### 3.1 三个已拍板的决策

1. **#75 照 Vue2 换代，删掉 IDB 断点续传**（不是两套并存，也不是分两步）。
   理由：Vue2 是想清楚才废的（浏览器存整个文件字节代价大、刷新后要求用户重选文件体验差）；
   后端已配套；#85/#86/#91/#122 全部建在新形态上，不换就做不了；
   且 New-UI 那套 IDB 拖着一条已知 flake（`persist.test.ts:55`，SP4 期既有，SP13 加重）。
2. **#89 跟着下线 `OperationStatusBar`**，粘贴/移动进度并入上传框的「文件操作」分组。
   代价：粘贴进度不再主动跳出来，要展开上传框才看得到（Vue2 靠头部文案提示"移动 1 项"）。
3. **#94 自己写虚拟化**，不引 `vue-virtual-scroller` 的 Vue3 版新依赖。
   理由：只需要固定行高的一维窗口，库的 API 面比收益大；且 New-UI 框选**已经是纯几何**
   （`files/util/marquee.ts`），Vue2 #94 里"改纯几何"那一半工作量天然不存在。

## 4. 架构

### 4.1 上传形态换代

**旧（蓝本 / New-UI 现状）—— 浏览器自己存字节**

```
入队 → 文件字节写 IndexedDB(受 budget 配额约束) → tus 分片上传
                                   ↓ 刷新页面
                        从 IDB 恢复队列 + serverSync 对齐服务端任务
                                   ↓ 字节丢了
                        needs_file 行 → 要求用户重新选一次文件 → conflictPolicy 裁决
```

**新（Vue2 origin/main / 本期目标）—— 服务端记账**

```
入队 → POST /v2/nimoos/file/upload-batches {id, targetPath, items}  ← 上报清单
     → tus 分片上传(协议层保留：分片 + 同页面会话内断网自动重连)
                                   ↓ 关窗/切页
     → POST .../upload-batches/{id}/interrupt   ← fetch keepalive
                                   ↓ 或 120s 空闲
     → 服务端 batch_sweeper 自动判定中断（兜底，见 service/upload/batch_sweeper.go:19）
                                   ↓
     文件列表返回 extensions.upload = {broken:true, batchId}  ← route/v1/file.go:441
                                   ↓
     网格/列表条目显示裂开角标 → 点击 → 批次详情弹窗 → 列出缺失项 / 放弃这批
```

浏览器**不再存字节**。跨刷新续传能力**消失**，换成"传坏了标出来让用户处理"。

### 4.2 后端可用性（已验证）

- `route/v2.go:204-207` 注册了四个端点：`CreateUploadBatch` / `GetUploadBatch` /
  `InterruptUploadBatch` / `AbandonUploadBatch`
- `route/v1/file.go:431-441` 在文件列表里写 `extensions.upload = {broken, batchId}`
- `service/upload/batch_sweeper.go:19` `BatchIdleInterruptSeconds = 120`
- `route/v2.go:196` `upload-precheck` 端点存在（#86 内层检查依赖它；New-UI `conflict.ts` 已在用）
- **设备上跑的 `/usr/bin/nimoos`（2026-07-30 构建）含 `upload-batches` 字符串** ⇒ 无需先部署后端

### 4.3 冲突决议的统一模型（#77 半）

一个弹窗，四个动作，被粘贴 / 快照恢复 / 上传三处复用：

| 动作 | 何时可用 |
|---|---|
| `overwrite` | **仅文件对文件**。任一侧是目录即禁用 |
| `keep_both` | 总是可用（自动取下一个可用名） |
| `skip` | 总是可用 |
| `merge` | **仅目录对目录**（`mergeable === true`）。#86 引入 |

外加 `applyToAll` 勾选：勾上后本次决议应用到剩余同类冲突。
弹窗只负责展示与 `emit('choose', {action, applyToAll})`，**决议计算全在纯函数层**。

### 4.4 上传冲突的两轮编排（#85 → #86）

**第一轮（顶层）**：按 `relativePath` 的**第一段**分组 —— `Trip/Day1/1.jpg` 与 `Trip/Day2/2.jpg`
同属 `Trip` 组；裸 `a.txt` 自成一组。组内**不逐文件判冲突**（与粘贴/恢复对齐）。
只要组内任一条目有嵌套路径，该组即 `isFolderGroup`。

冲突判定：组的顶层名撞上目标目录里**现在已有**的条目。`isDir` 为真的条件是
**任一侧**是目录 —— 已有条目是目录，或来的这组是文件夹组。

第一轮的输出按类型分成两个独立队列：
- `fileConflicts` —— 纯文件对文件（覆盖 / 保留两者 / 跳过）
- `folderConflicts` —— 任一侧是目录，额外带 `mergeable`（**两侧都是目录**才为真）

**第二轮（内层，仅 merge 触发）**：选了合并的文件夹，对其内容逐个做 `upload-precheck`，
再对真正撞名的文件做第二轮 `overwrite / rename / skip` 决议。
类型不匹配的碰撞（文件夹落到同名文件上，或反之）`mergeable: false`，弹窗的合并按钮不出现。

## 5. 任务分解（11 个）

### 地基

**T1 统一冲突弹窗 `FileConflictDialog`**
- 纯函数决议层 + 展示组件分离；组件只 emit，不算逻辑
- 四动作 + `applyToAll`；目录禁止 `overwrite` 的规则同时落在**纯函数**和**按钮禁用**两处
- 接入点本期只接上传（T7/T8）；粘贴与快照恢复的接入见 §7 未决

**T2 批次 API 进 service 包**
- 落 `packages/service/`（SP13 起共享包已内联，网络层 100% 走它）
- `createBatch` / `getBatch` / `abandonBatch` 走正常 axios 实例（带 401 刷新）
- `interruptBatch` **必须**用 `fetch` + `keepalive`：它在 `pagehide` 里发，
  那时 axios/XHR 不可靠，而 `sendBeacon` 带不了 `Authorization` 头
- 老浏览器无 `keepalive`：放弃信号，靠服务端 120s 超时兜底

### 上传架构换代（#75）

**T3 拆除 IDB 续传**
- 删 `files/upload/idb.ts` `persist.ts` `budget.ts` 及其测试
- `serverSync.ts` 去掉 `needs_file` 追加分支（服务端任务不再变成本地行）
- `uploads` store 去掉 `restored` / `conflictPolicy` / `oversize` / `needs_file` 字段
- `UploadPanel.vue` 去掉重选横幅、内嵌冲突 Dialog、`needs_file` 分支
- **保留** tus 协议层：分片 + 同页面会话内断网自动重连
- 副作用：`persist.test.ts:55` 那条老 flake 随文件一起消失

**T4 批次生命周期接线**
- 入队时 `createBatch({id, targetPath, items})`；**失败只 warn 不阻断上传**
  （对账不可用 ≠ 传不了，Vue2 `fileUpload.js:193` 即此口径）
- `unloadGuard` 在 `pagehide` 里对每个活跃批次发 `interruptBatch`

### 裂开角标闭环

**T5 角标**
- `FileEntry.extensions` 类型扩展 `upload?: {broken?: boolean|string; batchId?: string}`
  （注意后端可能给字符串 `'true'`，判定要两种都认，照 Vue2 `IconContainerMixin.js:71`）
- 网格（`FileTile`）与列表（`FileRow`）**两种视图都要加**，尺寸不同
- `title` 提示复用 i18n 键语义："上传中断 — 点击查看详情"
- 点击必须 `stop` + `prevent`：角标长在卡片上，不阻断会连带触发卡片的打开/选中
  （Vue2 #91 的根因就是卡片 `pointer-events:none` 吞掉了点击）

**T6 批次详情弹窗 `UploadBatchModal`**
- `getBatch(id)` → 展示批次信息 + **缺失项**列表
- 「放弃这批」→ `abandonBatch(id)` → 成功后刷新文件列表（角标消失）
- **#122：404 走成功路径**。批次在服务端已不存在（过期被清扫 / 陈旧角标竞态）时，
  用户的目标本来就是让角标消失，不该弹 Server error 把人堵在弹窗里

### 上传冲突

**T7 上传同名冲突（#85）**
- 纯函数：`groupByTopSegment` / `computeUploadConflicts` / `applyUploadResolutions` / `nextAvailableName`
- 契约照搬 Vue2 `uploadConflict.js`（见 §4.4）
- `applyUploadResolutions` 的四种决议落盘策略 + 计数；**目录改名要去重防互撞**

**T8 Windows 式文件夹合并（#86）**
- `splitConflictsByKind`（两队列 + `mergeable` 标记）
- `applyUploadResolutions` 增 `merge` 动作：保留 `relativePath`，打 `pendingInnerCheck` 标
- `applyInnerResolutions`（第二轮 overwrite / rename / skip）
- `precheckApi`：对已合并文件夹的内容做逐文件同名预检

### 独立三条

**T9 加载健壮性三修（#88）**
- `retryRequest` 有限重试（约 4s 窗口，覆盖部署重启/瞬时抖动），侧栏存储列表失败不再一次判死
- 骨架屏卡死修复
- RAID 用量兜底（字段映射）
- 错误文案归一化：业务失败与 catch 分支走同一套

**T10 进度并入上传框（#89）**
- 纯函数：`opsTaskPercent` / `opsTaskLabelKey` / `opsTaskBasename`（渲染一行文件操作进度）
- `resolveUploaderHeader`：头部三态文案同时响应上传队列与 `activeFileOperations` 两路输入
- 上传框新增「文件操作」分组；删 `OperationStatusBar.vue` 及其在 `views/Files.vue` 的挂载
- 保留「全部取消」能力（现有 `ops.cancelAll()`）

**T11 网格虚拟滚动（#94）**
- 按行切片（纯函数 `chunkRows`，可单测）+ 可视窗口 + buffer
- 行高与现有 `.grid-card` CSS 一致；借用外层已有滚动容器，不再嵌套一层
- **框选的矩形来源要改**：虚拟化后屏幕外没有 DOM，不能量 DOM。
  `marqueeSelect` 本身是纯几何、不改；改的是喂给它的 `ItemRect[]` 从何而来
- 滚动到高亮项：改用按行索引滚动

## 6. 测试策略

- **纯函数先行（TDD）**：T1 决议层、T7/T8 冲突计算、T10 进度文案、T11 行切片都先写测试
- **组件层补挂载测试**：Vue2 #136 的教训 —— 原测试用 `.call({...})` 直接调方法、从不挂载组件，
  导致整条 submit/resolve 流程（校验门、请求构造、409 分支、决议后视图切换）零覆盖。
  本期凡"卡片/弹窗承载用户决定"的组件，测试必须真挂载并点按钮
- **变异验证**：关键接线（角标点击、放弃批次、合并第二轮）改坏一处，确认对应测试真的会红
- **fixture 逐字取自真机**：批次 API 与文件列表 `extensions` 的响应形状不得手编
  （`newui-fixture-from-imagination-trap`：裸信封 unwrap 已栽三次）
- **收尾门**：vitest 全量 + `vue-tsc` + color-guard + parity + build + oss 安全形式
  （`--out <scratch> --no-commit --allow-dirty-oss` 三件套，不得裸调 `export.mjs`）

## 7. 不做的事

- **#90 P2P 丢送重修**不在本期。Vue2 修的是断连上报缺失 + 等待超时 + `_isCaller` 拼写 bug
  导致的重连永不执行。New-UI 侧是独立实现，需单独取证后另开票
- **Photos 区全部条目**（Moments / Albums统一 / SmartView 手动增删 / People 兜底 / 性能）留后续期
- **粘贴与快照恢复接入 T1 弹窗**：本期只建弹窗并接上传。粘贴现有的"覆盖/跳过"右键选项
  与快照恢复的无提示直恢复**保持现状**，接入另开票 —— 它们各自还牵着目的地选择
  （Vue2 有 `RestoreDestinationModal`，New-UI 无）等未取证的面
- **不做无关重构**（`vue2-port-visual-only-fix-logic`）

## 8. 风险

1. **T3 是删功能**，不是加功能。删后"刷新页面还能接着传"消失。这是 Vue2 的既定取舍，
   但设备上的体验会变，需在验收时向用户明示
2. **T3 改动面大**：`UploadPanel.vue` 352 行要动，随之要删的测试约数百行。
   删测试时必须逐个确认删的是"为已废除形态写的"，不是"顺手删掉挡路的"
3. **服务端 120s 空闲判中断**：前端如果在某些路径下长时间不推进（大文件慢网），
   可能被服务端提前判为中断而误挂角标。需在实施时确认 tus 心跳/进度是否刷新 `last`
4. **T11 虚拟化 + 缩略图**：Vue2 `IconContainerMixin` 有两条为虚拟滚动写的守卫（BF21/BF22）——
   组件实例被回收复用时缩略图会串台、以及 item 变了要取消在途加载。New-UI 加虚拟化后
   同类问题会出现，需同步处理
5. **jsdom 照不出布局**：虚拟化的可视窗口计算、角标的点击命中都依赖真实布局，
   单测绿不代表真机对。验收要真浏览器

## 9. 验收与流程

- **验收 = 起 dev server**（`pnpm dev --host --port 5273`），**不** `deploy.sh`。
  本期不是 cutover 期，照 SP9/SP11 既有约定
- **工作树 = New-UI master 主工作树**，不开 worktree
- **commit 必须带 pathspec** —— 主工作树里有 3 个 `design-export` 的 staged 删除，
  裸 `git commit -a` 会把它们卷走
- **提交信息英文**（`commit-messages-english-only`，2026-08-07 起）
- 台账落 `.superpowers/sdd/`（自 2026-08-05 起已入库进 git）
