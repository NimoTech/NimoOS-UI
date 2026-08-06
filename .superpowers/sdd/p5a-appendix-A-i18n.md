## 附录 A:i18n 键表(**新增 96 条 `aiKb*` + 复用 1 条既有键**)

**中文值全部取自 Vue2 `git show main:src/assets/lang/zh_CN.json`,逐字符照抄。英文值 = Vue2 原 key。**
**新增 96 条** = 下方主表 94 条(Vue2 派生)+ 末尾新造 2 条(占位页)。
**复用既有键 1 条**:`aiCfgYou`(zh `你` / en `You`)—— rail 页脚用户名的回落文案,见 K8。写之前先 `grep -n "aiCfgYou" src/i18n/*.ts` 复核值仍是这两个。

| 键 | Vue2 原 key(= 英文值) | 中文值 |
|---|---|---|
| `aiKbKnowledgeBase` | `Knowledge Base` | 知识库 |
| `aiKbBrowse` | `Browse` | 浏览 |
| `aiKbStatus` | `Status` | 状态 |
| `aiKbIndexer` | `Indexer` | 索引服务 |
| `aiKbLastSynced` | `Last synced` | 上次同步 |
| `aiKbRefresh` | `Refresh` | 刷新 |
| `aiKbRefreshed` | `Refreshed` | 已刷新 |
| `aiKbOffline` | `Offline` | 离线 |
| `aiKbPaused` | `Paused` | 已暂停 |
| `aiKbRunningIndexed` | `Running · {n} indexed` | 运行中 · {n} 已收录 |
| `aiKbMore` | `More` | 浏览更多 |
| `aiKbServiceOfflineBanner` | `The index service is temporarily offline — some features may be unavailable.` | 索引服务暂时离线，部分功能可能不可用 |
| `aiKbNavDashboard` | `Dashboard` | 概览 |
| `aiKbNavSearch` | `Search` | 搜索 |
| `aiKbNavWiki` | `Wiki` | Wiki 导航 |
| `aiKbNavNotes` | `Notes` | 笔记 |
| `aiKbNavIndexedFiles` | `Indexed Files` | 已收录文件 |
| `aiKbNavQueue` | `Queue` | 任务 |
| `aiKbNavRoots` | `Index Roots` | 索引目录 |
| `aiKbNavAllowlist` | `Allowlist` | 索引范围 |
| `aiKbNavSettings` | `Settings` | 系统设置 |
| `aiKbTitleWikiMap` | `Wiki map` | Wiki 导航 |
| `aiKbTitleJobQueue` | `Job Queue` | 任务队列 |
| `aiKbTitleAdvancedSettings` | `Advanced Settings` | 高级设置 |
| `aiKbJustNow` | `just now` | 刚刚 |
| `aiKbMinAgo` | `{m} min ago` | {m} 分钟前 |
| `aiKbHrAgo` | `{h} hr ago` | {h} 小时前 |
| `aiKbDaysAgo` | `{d} days ago` | {d} 天前 |
| `aiKbOpFailed` | `Operation failed` | 操作失败 |
| `aiKbOnboardTitle` | `Turn your NAS into a second brain` | 把 NAS 变成你的第二大脑 |
| `aiKbOnboardBody` | `Add your first knowledge root — Nimo parses and indexes its documents, builds a browsable wiki, and distills notes as you go.` | 添加第一个知识根,Nimo 会解析、索引其中的文档,生成可浏览的 Wiki,并在使用中自动沉淀笔记。 |
| `aiKbAddRoot` | `Add knowledge root` | 添加知识根 |
| `aiKbCheckScopeFirst` | `Check the index scope first` | 先看看索引范围 |
| `aiKbGoDeeper` | `Go deeper` | 深入 |
| `aiKbSearchPlaceholder` | `Search your knowledge base — documents · wiki · notes…` | 搜索你的知识库 — 文档 · Wiki · 笔记… |
| `aiKbThreeLayersTip` | `Covers all three layers: wiki · vectors · notes` | 同时覆盖三层:Wiki · 向量 · 笔记 |
| `aiKbSearch` | `Search` | 搜索 |
| `aiKbTry` | `Try` | 试试 |
| `aiKbWhatsInside` | `What's inside` | 里面有什么 |
| `aiKbWikiMap` | `Wiki map` | Wiki 导航 |
| `aiKbKnowledgeRootsSuffix` | `knowledge roots` | 个知识根 |
| `aiKbWatchSplit` | `{a} live watch · {b} periodic scan` | {a} 实时监视 · {b} 定期扫描 |
| `aiKbSemanticVectors` | `Semantic vectors` | 语义检索 |
| `aiKbDocumentsSuffix` | `documents` | 文档 |
| `aiKbVectorChunks` | `{n} vector chunks` | {n} 向量块 |
| `aiKbVectorSplit` | `{t} text · {v} visual vectors` | {t} 文本 · {v} 视觉向量 |
| `aiKbDistilledNotes` | `Distilled notes` | 沉淀笔记 |
| `aiKbNotesSuffix` | `notes` | 条笔记 |
| `aiKbToConfirm` | `{n} to confirm` | {n} 待确认 |
| `aiKbNotesSplit` | `{c} curated · {d} draft · {a} archived` | {c} 已确认 · {d} 草稿 · {a} 归档 |
| `aiKbGlueTitle` | `Three layers, joined by three ids` | 三层由三个 id 串联 |
| `aiKbGlueFileId` | `vectors ↔ physical files` | 向量 ↔ 物理文件 |
| `aiKbGlueRootId` | `knowledge attribution` | 知识归属 |
| `aiKbGlueSessionId` | `note provenance` | 笔记溯源 |
| `aiKbLayerWikiDesc` | `One .wiki.md summary per folder — browse like a wiki, your visible long-term memory.` | 每个目录一份 .wiki.md 摘要,像维基一样浏览 — 可见的长期记忆。 |
| `aiKbLayerVecDesc` | `Documents are chunked and embedded — find them in natural language; duplicate copies dedupe by file_id.` | 切块嵌入,自然语言即可命中;同文件多副本按 file_id 自动去重。 |
| `aiKbLayerNoteDesc` | `AI distills insights from your chats — [[backlinked]] and traceable back to the source session.` | AI 从对话自动提炼,[[双链]] 关联,session_id 溯源回原对话。 |
| `aiKbHowOrganized` | `How it's organized` | 怎么组织的 |
| `aiKbManageRoots` | `Manage roots` | 管理知识根 |
| `aiKbLevelSpace` | `Space` | 空间 |
| `aiKbLevelProject` | `Project` | 项目 |
| `aiKbRealtimeWatch` | `Real-time watch` | 实时监视 |
| `aiKbScheduledScanOnly` | `Scheduled scan only` | 仅定时扫描 |
| `aiKbReconciling` | `Reconciling` | 同步中 |
| `aiKbLastScan` | `Last scan:` | 上次扫描: |
| `aiKbNever` | `never` | 从未 |
| `aiKbDisabledRoots` | `Disabled {n} roots:` | 已停用 {n} 个根: |
| `aiKbRestoreInRootMgmt` | `Restore in root management` | 在根管理中恢复 |
| `aiKbWhatsHappening` | `What's happening now` | 现在在发生什么 |
| `aiKbIndexingNFiles` | `Indexing {n} files` | 正在索引 {n} 个文件 |
| `aiKbFilesPerMin` | `files/min` | 个/分钟 |
| `aiKbEta` | `ETA` | 预计 |
| `aiKbWaitingForParser` | `Waiting for parser…` | 等待解析器… |
| `aiKbAllSynced` | `All synced` | 已全部同步 |
| `aiKbDoneLast10m` | `{n} done in last 10 min` | 近 10 分钟完成 {n} 个 |
| `aiKbThrottle` | `Throttle` | 限速档位 |
| `aiKbAutoIndexPaused` | `Auto-indexing paused` | 已暂停自动索引 |
| `aiKbAdjustInAdvanced` | `Adjust in Advanced Settings` | 在高级设置中调整 |
| `aiKbCcPowerSaver` | `Power saver` | 省电 |
| `aiKbCcBalanced` | `Balanced` | 平衡 |
| `aiKbCcFullSpeed` | `Full speed` | 全力 |
| `aiKbQueueHealth` | `Queue health` | 队列健康 |
| `aiKbPending` | `Pending` | 待处理 |
| `aiKbRunning` | `Running` | 运行中 |
| `aiKbFailed` | `Failed` | 已失败 |
| `aiKbAutoDistill` | `Auto-distill` | 自动沉淀 |
| `aiKbDistilledRecently` | `Distilled {n} insights recently` | 近期提炼了 {n} 条洞见 |
| `aiKbDistillFromChats` | `From your chats with Nimo — pending review` | 来自你与 Nimo 的对话,待确认 |
| `aiKbNoNewInsights` | `No new insights recently` | 暂无新的沉淀 |
| `aiKbSampleThyroid` | `thyroid` | 甲状腺 |
| `aiKbSamplePythonAsync` | `Python async` | Python 异步 |
| `aiKbSampleContract` | `contract from last year` | 去年的合同 |
| `aiKbSampleIphone` | `iPhone setup` | iPhone 配置 |
| `aiKbSampleSkating` | `figure skating` | 羽生结弦 |

**Vue2 语言包里没有、本期新造的 2 条**(占位页,设计已授权):

| 键 | 英文值 | 中文值 |
|---|---|---|
| `aiKbDeferredTitle` | `Coming soon` | 即将上线 |
| `aiKbDeferredHint` | `This page is still being migrated to the new UI.` | 这个页面还在迁移到新界面。 |

> **实现者注意**:`aiKbNavWiki` 与 `aiKbTitleWikiMap`/`aiKbWikiMap` 的中文值都是「Wiki 导航」而英文值不同(`Wiki` vs `Wiki map`)—— Vue2 如此,**照抄,不许合并成一个键**。`aiKbNavSearch`/`aiKbSearch` 同理(两处都是「搜索」,但一个是 rail 项、一个是按钮/标题)。

---

