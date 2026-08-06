# P5c 附录 A —— i18n 键表(新增 **99** 条 `aiKb*` + 复用 **10** 条既有键)

> 🔴 **就地订正(协调者裁定 A-1,2026-08-03,由 T1 落地)**:本文件原写「新增 98 + 复用 11」,
> 其中 `aiKbOriginAuto` 的复用被裁定改为**新建 `aiKbDeviceAuto`**(理由见 §A.1 的裁定说明)。
> → **新增 98 → 99、复用 11 → 10,distinct 合计 109 不变、本期新造仍 0、死键仍 0。**
> 全文出现 `98` / `11 条复用` 的地方已逐处订正,**共 14 个位置** —— brief §1 说「附录 A 里出现 `98` 的
> 三处」是低估的(T1 实扫:光 `98` 就有 7 处,`11` 相关 7 处)。清单:①本标题 ②§A.0 第 3 条
> ③§A.1 标题 ④§A.1 表(删 `aiKbOriginAuto` 行)⑤§A.1 表下 `11/11` 与「这 11 条」⑥§A.1 那条
> `aiKbOriginAuto` 复用理由(作废)⑦§A.2 标题 ⑧§A.2 表(插第 2 行 + 整表重编号 1–99)
> ⑨§A.2.1 零重名结论 ⑩§A.5 「本批 98 键」⑪§A.5 「其余 80 条」→ 81 ⑫§A.6 「只圈本批 98 键」
> ⑬§A.8 计数自检块 ⑭§A.8 校验脚本段的 DoD 数字。
> `messageSyntax.test.ts` 的「exactly N keys」防漂移断言用 **99**;逐码点比对脚本的 DoD 是
> **99/99 + 10/10 MATCH**(实测已达成,见 `p5c-task-1-report.md`)。

> **权威源**:zh 值一律 `git show main:src/assets/lang/zh_CN.json`(Vue2 `main`@`7a6ee6b7`,共 2757 条)。
> en 值一律 `git show main:src/assets/lang/en_US.json`;T0 实测本期 109 条的 en_US.json 值与
> `$t()` 的英文原串**逐条相同**(零覆写),所以「en 值 = 英文原 key」这条口径成立。
> 🔴 **本表全部由脚本从那两个 JSON 直接导出,不是手抄** —— 承 P5a T8 教训
> (附录零差异,手抄进 TS 时引入 5 处全角标点错)。生成脚本见 §A.8。

## A.0 🔴 T0 的四个核心结论(与 brief §4 的差异)

1. 🔴 **109 个 `$t()` 串在 Vue2 语言包里 100% 命中 → 本期「Vue2 无源、需要自造」的键 = 0 条。**
   (P5b 那期是 95 有源 + 4 自造 + 1 追加;本期一条都不用造。)
2. 🔴 **本期真正的 `$t(非字面量)` = 0 处**(brief §4 说的那 4 处「动态 `$t()`」其实**全是字面量参数**,
   只是位置特殊 —— 见 §A.4)。**所以没有 P5b 那个 K20 式的漏键风险。**
   ⚠️ **但抽取必须扫整个文件,不能只扫 `<template>`** —— 其中 3 处在 `<script>` 里。
3. **11 条既有 `aiKb*` 键的现值与 Vue2 语言包逐字相同**(zh 与 en 都相同)→ 技术上都可复用;
   🔴 **但裁定 A-1 把其中 `aiKbOriginAuto` 移出复用集,改新建 `aiKbDeviceAuto` → 本期实际复用 10 条。**
4. 🔴 **4 组 zh 值撞车 / 错译,一律照抄不改(N21)** —— 见 §A.3。
   其中 3 组是「zh 撞车但 en 不同 → **不能**复用既有键」,复用会让英文档渲染错。

## A.1 复用既有键(**10 条**,**不重复定义**)

🔴 **裁定 A-1(2026-08-03):`aiKbOriginAuto` 已从本表移出 —— 本期不复用它,改新建 `aiKbDeviceAuto`**
(见 §A.2 第 2 行)。它服务的三个调用点不变:`SettingsView.vue:45`(设备单选「自动」按钮)·
`SettingsView.vue:301`(`setDevice` toast 的 `d === 'auto' ? this.$t('Auto')`)·
`ParserStatus.vue:121`(`deviceOptions`)。**T1 已回源核实 `$t('Auto')` 在两个蓝本里恰好只这 3 处;
`SettingsView.vue:219` 是 `$t('Auto (currently {r})')`(独立键 `aiKbSetDeviceAutoCurrent`),
不是另一个裸 `$t('Auto')`。**
理由:`aiKbOriginAuto` 现值 = `Auto` / `自动`,**复用渲染完全一致**,但键名语义是「沉淀任务来源
(`origin: manual|auto`)」,与「推理设备自动档」无关 —— 将来改沉淀文案会静默改掉设备下拉。
成本只有 2 行 × 2 文件。**本裁定覆盖下方原「⚠️ 两条要额外说明的复用」里关于 `aiKbOriginAuto` 的那一条。**

| 复用键 | Vue2 英文原串 | 现有 zh 值 | 现有 en 值 | Vue2 语言包 zh | 逐字相同? | 用在 |
|---|---|---|---|---|---|---|
| `aiKbCcBalanced` | `Balanced` | 平衡 | Balanced | 平衡 | ✅ | ParserStatus.vue:38 |
| `aiKbCancel` | `Cancel` | 取消 | Cancel | 取消 | ✅ | SettingsView.vue:100 · SettingsView.vue:150 |
| `aiKbDeferredTitle` | `Coming soon` | 即将上线 | Coming soon | 即将上线 | ✅ | SettingsView.vue:172 · SettingsView.vue:177 |
| `aiKbFailed` | `Failed` | 已失败 | Failed | 已失败 | ✅ | ParserStatus.vue:73 |
| `aiKbLastSynced` | `Last synced` | 上次同步 | Last synced | 上次同步 | ✅ | ParserStatus.vue:75 |
| `aiKbOpFailed` | `Operation failed` | 操作失败 | Operation failed | 操作失败 | ✅ | SettingsView.vue:260 · SettingsView.vue:279 · SettingsView.vue:287 · SettingsView.vue:295 · SettingsView.vue:313 |
| `aiKbPaused` | `Paused` | 已暂停 | Paused | 已暂停 | ✅ | SettingsView.vue:285 · ParserStatus.vue:22 |
| `aiKbPending` | `Pending` | 待处理 | Pending | 待处理 | ✅ | ParserStatus.vue:70 |
| `aiKbRefresh` | `Refresh` | 刷新 | Refresh | 刷新 | ✅ | ParserStatus.vue:7 |
| `aiKbRunning` | `Running` | 运行中 | Running | 运行中 | ✅ | ParserStatus.vue:22 |

> 「逐字相同?」= New-UI 现有 zh/en 值 **同时**等于 Vue2 语言包的 zh 值与英文原串。
> **10/10 全部 ✅** → 直接 `t('aiKbXxx')`,**T-i18n 那一刀不要重写这 10 条**(重复属性 = TS 错误)。
> T1 已用 `p5c-task-1-i18n-verify.mjs` 的 PART 2 逐码点复核「本刀没有改动这 10 条」→ **10/10 MATCH**。
>
> ⚠️ **一条要额外说明的复用**(原有两条,关于 `aiKbOriginAuto` 的那条已被裁定 A-1 作废,见本节开头):
> - `aiKbDeferredTitle`(P5a 建的占位页标题,P5a 附录 A 曾把它标成「Vue2 没有的新造文案」)——
>   T0 实测 Vue2 语言包**确实有** `Coming soon → 即将上线`,与 New-UI 现值逐字相同。
>   **P5a 那条「Vue2 无源」的分类是错的**(不影响任何行为,值恰好一样),本期直接复用。

## A.2 新增主表(**99** 条,zh 值**全部**有 Vue2 权威源)

> 🔴 **订正(裁定 A-1,2026-08-03,T1 落地)**:原 98 行 + 第 2 行的 `aiKbDeviceAuto` = **99 行**,行号已整表重编。

`全角 X` = 该 zh 值含 `[，；：？！（）]` 里的字符,是 A.5 全角守卫的登记例外。
`占位 {x}` = A.6 占位符守卫的登记项。

| # | 键名 | Vue2 英文原串(= en 值) | zh 值(逐字) | 蓝本 `file:line` | 标记 |
|---|---|---|---|---|---|
| 1 | `aiKbConcurrencyLevel` | `Concurrency level` | 并发档位 | SettingsView.vue:26 · ParserStatus.vue:31 |  |
| 2 | `aiKbDeviceAuto` | `Auto` | 自动 | SettingsView.vue:45 · SettingsView.vue:301 · ParserStatus.vue:121 | 🔴 裁定 A-1 新建,**不复用 `aiKbOriginAuto`** |
| 3 | `aiKbFbEmpty` | `(empty)` | (空) | FolderBrowser.vue:25 |  |
| 4 | `aiKbFbLoadFailed` | `Failed to load folders` | 目录列表加载失败 | FolderBrowser.vue:70 |  |
| 5 | `aiKbFbLoading` | `Loading…` | 加载中… | FolderBrowser.vue:9 |  |
| 6 | `aiKbFbNoVolumes` | `No volumes detected — type a path above` | 未检测到磁盘卷——请在上方手输路径 | FolderBrowser.vue:17 |  |
| 7 | `aiKbFbVolumes` | `Volumes` | 卷 | FolderBrowser.vue:46 |  |
| 8 | `aiKbInferenceDevice` | `Inference device` | 推理设备 | SettingsView.vue:38 · ParserStatus.vue:42 |  |
| 9 | `aiKbPause` | `Pause` | 暂停 | SettingsView.vue:16 · ParserStatus.vue:27 |  |
| 10 | `aiKbPrCcFullPower` | `Full power` | 全力 | ParserStatus.vue:38 |  |
| 11 | `aiKbPrCcPowerSaving` | `Power-saving` | 省电 | ParserStatus.vue:38 |  |
| 12 | `aiKbPrDetailsTitle` | `Parser details` | Parser 详情 | ParserStatus.vue:4 |  |
| 13 | `aiKbPrFoldersTitle` | `Pending folders (top {top} of {total} groups)` | 待处理文件夹（top {top} / 共 {total} 组） | ParserStatus.vue:80 | 全角 `（）` / 占位 `{top}` `{total}` |
| 14 | `aiKbPrIndexedVectors` | `Indexed vectors` | 已入向量 | ParserStatus.vue:74 |  |
| 15 | `aiKbPrNoPending` | `No pending` | 无待处理 | ParserStatus.vue:81 |  |
| 16 | `aiKbPrOcrHint` | `5–10× slower, only useful for truly scanned documents` | 慢 5-10x，只对真实索引的扫描件有用 | ParserStatus.vue:64 | 全角 `，` |
| 17 | `aiKbPrOcrLabel` | `Enable OCR for scanned PDFs (RapidOCR)` | 扫描 PDF 启用 OCR (RapidOCR) | ParserStatus.vue:62 |  |
| 18 | `aiKbPrQueueDone` | `Done` | 完成 | ParserStatus.vue:72 |  |
| 19 | `aiKbPrQueueRunning` | `Processing` | 处理中 | ParserStatus.vue:71 |  |
| 20 | `aiKbPrRecentFailures` | `Recent failures ({n})` | 最近失败（{n}） | ParserStatus.vue:94 | 全角 `（）` / 占位 `{n}` |
| 21 | `aiKbPrResolvedHint` | `→ actual {device}` | → 实际 {device} | ParserStatus.vue:53 | 占位 `{device}` |
| 22 | `aiKbPrTestLink` | `Test sandbox` | 测试沙盒 | ParserStatus.vue:6 |  |
| 23 | `aiKbPrUnreachable` | `Parser service is not running or unreachable.` | Parser 服务未运行或不可达。 | ParserStatus.vue:12 |  |
| 24 | `aiKbPtAsWellAs` | `as well as` | 以及 | ParserTest.vue:15 |  |
| 25 | `aiKbPtBackLink` | `Back to details` | 返回详情 | ParserTest.vue:5 |  |
| 26 | `aiKbPtChooseFile` | `Choose file` | 选择文件 | ParserTest.vue:29 |  |
| 27 | `aiKbPtChunksTitle` | `Chunk results ({n} chunks)` | 切块结果（{n} 块） | ParserTest.vue:128 | 全角 `（）` / 占位 `{n}` |
| 28 | `aiKbPtDefaults` | `Defaults: target=600, overlap=80, min=2 (sandbox loose values; production uses 600/80/5–20).` | 默认 target=600, overlap=80, min=2（沙盒宽松值；生产用 600/80/5–20）。 | ParserTest.vue:55 | 全角 `（）；` |
| 29 | `aiKbPtDoclingToggle` | `docling markdown output ({n} chars)` | docling 转出的 markdown（{n} 字符） | ParserTest.vue:101 | 全角 `（）` / 占位 `{n}` |
| 30 | `aiKbPtDragDrop` | `or drag and drop here` | 或拖拽到此处 | ParserTest.vue:30 |  |
| 31 | `aiKbPtHelp1` | `Upload a file to see how Parser processes it (chunking + embedding + scoring).` | 上传一个文件，看 Parser 怎么处理它（切块 + 嵌入 + 评分）。 | ParserTest.vue:10 | 全角 `（），` |
| 32 | `aiKbPtHelpNoWrite` | `Will not write to index` | 不会写入索引 | ParserTest.vue:11 |  |
| 33 | `aiKbPtHelpPreviewOnly` | `preview only` | 纯预览 | ParserTest.vue:11 |  |
| 34 | `aiKbPtMaxSize` | `Max 30 MB. PDF will trigger model weight download (~200 MB, one-time) on first run.` | 最大 30 MB。PDF 首次会触发模型权重下载（~200 MB，一次性）。 | ParserTest.vue:16 | 全角 `（），` |
| 35 | `aiKbPtOcr` | `OCR (scanned PDF)` | OCR（扫描 PDF） | ParserTest.vue:69 | 全角 `（）` |
| 36 | `aiKbPtOverlapNote` | `overlap only applies to plain text; markdown/source splits by paragraph or function boundary.` | overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。 | ParserTest.vue:56 | 全角 `；` |
| 37 | `aiKbPtProcessing` | `Processing…` | 处理中… | ParserTest.vue:77 |  |
| 38 | `aiKbPtQueryPlaceholder` | `(Optional) Enter a query to compute cosine similarity per chunk` | （可选）输入 query，会计算每个 chunk 的余弦相似度 | ParserTest.vue:62 | 全角 `（），` |
| 39 | `aiKbPtReset` | `Reset` | 重置 | ParserTest.vue:52 |  |
| 40 | `aiKbPtRun` | `Run` | 运行 | ParserTest.vue:77 |  |
| 41 | `aiKbPtScoredTitle` | `Query similarity ranking (top {n})` | Query 相似度排名（top {n}） | ParserTest.vue:108 | 全角 `（）` / 占位 `{n}` |
| 42 | `aiKbPtSupports` | `Supports text files such as` | 支持 | ParserTest.vue:14 |  |
| 43 | `aiKbPtTitle` | `Parser test sandbox` | Parser 测试沙盒 | ParserTest.vue:4 |  |
| 44 | `aiKbPtTooBig` | `File exceeds 30 MB, not supported in sandbox` | 文件超过 30 MB，沙盒不支持 | ParserTest.vue:186 | 全角 `，` |
| 45 | `aiKbPtViaDocling` | `(converted to markdown via docling)` | （经 docling 转 markdown） | ParserTest.vue:15 | 全角 `（）` |
| 46 | `aiKbPtZeroChunks` | `Parsed 0 chunks. The file may be too short or all segments were filtered out.` | 解析得到 0 个 chunk。可能是文件太短或全是过滤掉的小段。 | ParserTest.vue:130 |  |
| 47 | `aiKbResume` | `Resume` | 恢复 | SettingsView.vue:16 · ParserStatus.vue:27 |  |
| 48 | `aiKbResumed` | `Resumed` | 已继续 | SettingsView.vue:285 |  |
| 49 | `aiKbSetAutoCapture` | `Auto-capture insights` | 自动沉淀对话洞见 | SettingsView.vue:106 |  |
| 50 | `aiKbSetAutoCaptureCn` | `Auto-capture conversation insights` | 对话洞见自动沉淀 | SettingsView.vue:107 |  |
| 51 | `aiKbSetAutoCaptureDesc` | `After a conversation goes idle, worthwhile conclusions are saved as AI-draft notes for your review.` | 会话空闲后,值得保留的结论会自动存为「AI 草稿」笔记,等你确认。 | SettingsView.vue:109 |  |
| 52 | `aiKbSetAutoCaptureOff` | `Auto-capture disabled` | 自动沉淀已关闭 | SettingsView.vue:258 |  |
| 53 | `aiKbSetAutoCaptureOffWarn` | `Disabled — queued drafts are discarded as well` | 已关闭 — 排队中的草稿也会被丢弃 | SettingsView.vue:111 |  |
| 54 | `aiKbSetAutoCaptureOn` | `Auto-capture enabled` | 自动沉淀已开启 | SettingsView.vue:258 |  |
| 55 | `aiKbSetChange` | `Change` | 更改 | SettingsView.vue:100 |  |
| 56 | `aiKbSetChecking` | `Checking…` | 检查中… | SettingsView.vue:83 |  |
| 57 | `aiKbSetConcurrencyDesc` | `Higher values are faster but use more resources. 4 is recommended when the NAS is idle.` | 数值越大越快、越占资源。NAS 空闲时建议 4。 | SettingsView.vue:27 |  |
| 58 | `aiKbSetConcurrencySet` | `Concurrency set to {n}` | 并发改为 {n} | SettingsView.vue:293 | 占位 `{n}` |
| 59 | `aiKbSetConcurrentFiles` | `Concurrent files` | 同时处理几个文件 | SettingsView.vue:25 |  |
| 60 | `aiKbSetCurrentlyUsing` | `Currently using:` | 当前用： | SettingsView.vue:41 | 全角 `：` |
| 61 | `aiKbSetDangerZone` | `Danger zone` | 危险区 | SettingsView.vue:171 |  |
| 62 | `aiKbSetDeviceAutoCurrent` | `Auto (currently {r})` | 自动（当前 {r}） | SettingsView.vue:219 | 全角 `（）` / 占位 `{r}` |
| 63 | `aiKbSetDeviceCn` | `Inference device — for maintainers` | 推理设备 · 仅维护者关心 | SettingsView.vue:39 |  |
| 64 | `aiKbSetDeviceSet` | `Inference device: {label}` | 推理设备：{label} | SettingsView.vue:302 | 全角 `：` / 占位 `{label}` |
| 65 | `aiKbSetDirEmptyMigratable` | `Empty folder · can migrate` | 空目录 · 可迁移 | SettingsView.vue:84 |  |
| 66 | `aiKbSetDirNotEmpty` | `Not empty — point-to only` | 非空目录 — 只能指向 | SettingsView.vue:85 |  |
| 67 | `aiKbSetMigrateAck` | `I understand this moves files on disk` | 我已了解这是移动磁盘文件的操作 | SettingsView.vue:146 |  |
| 68 | `aiKbSetMigrateNotEmpty` | `This folder is not empty.` | 当前所选目录非空。 | SettingsView.vue:138 |  |
| 69 | `aiKbSetMigrateReq1` | `The target folder must be empty — the server refuses to move into a non-empty folder.` | 目标目录必须为空 — 非空目录后端会拒绝迁移。 | SettingsView.vue:137 |  |
| 70 | `aiKbSetMigrateReq2` | `Files are moved (not copied); the old folder is left empty.` | 文件会被移动(不是复制),原目录随后为空。 | SettingsView.vue:141 |  |
| 71 | `aiKbSetMigrateReq3` | `Notes are briefly read-only during the move; it usually finishes in seconds.` | 迁移期间笔记短暂只读,通常几秒内完成。 | SettingsView.vue:142 |  |
| 72 | `aiKbSetMigrateStart` | `Start moving` | 开始迁移 | SettingsView.vue:152 |  |
| 73 | `aiKbSetMigrateTitle` | `Move note files?` | 迁移笔记文件? | SettingsView.vue:124 |  |
| 74 | `aiKbSetMoveFiles` | `Move files to new directory…` | 迁移文件到新目录… | SettingsView.vue:93 |  |
| 75 | `aiKbSetNotesFolder` | `Notes folder` | 笔记目录 | SettingsView.vue:74 |  |
| 76 | `aiKbSetNotesFolderCn` | `Where note markdown files live` | 笔记 Markdown 文件的存放位置 | SettingsView.vue:75 |  |
| 77 | `aiKbSetNotesFolderDesc` | `Each user has a subfolder; files are plain Markdown.` | 每个用户一个子目录;文件是纯 Markdown。 | SettingsView.vue:77 |  |
| 78 | `aiKbSetNotesFolderUpdated` | `Notes folder updated` | 笔记目录已更新 | SettingsView.vue:275 |  |
| 79 | `aiKbSetNotesSection` | `Knowledge notes` | 知识笔记 | SettingsView.vue:67 |  |
| 80 | `aiKbSetNotesSectionHint` | `Notes are Markdown files on disk` | 笔记 = 磁盘上的 Markdown 文件 | SettingsView.vue:68 |  |
| 81 | `aiKbSetOcrCn` | `OCR for scanned PDFs` | 扫描 PDF 文字识别 (OCR) | SettingsView.vue:54 |  |
| 82 | `aiKbSetOcrOff` | `OCR disabled` | OCR 已关闭 | SettingsView.vue:311 |  |
| 83 | `aiKbSetOcrOn` | `OCR enabled` | OCR 已开启 | SettingsView.vue:311 |  |
| 84 | `aiKbSetOcrOnlyScanned` | `Only useful for scanned PDFs.` | 只对扫描 PDF 有用。 | SettingsView.vue:56 |  |
| 85 | `aiKbSetOcrTitle` | `OCR for scanned documents` | 扫描件文字识别 (OCR) | SettingsView.vue:53 |  |
| 86 | `aiKbSetOcrWarn` | `Enabling this slows indexing 5–10×` | 开启后速度慢 5-10× | SettingsView.vue:56 |  |
| 87 | `aiKbSetPickNote` | `"Point to" keeps files where they are and adopts the .md files already in the folder; "Move" relocates your existing note files there (the target must be empty).` | 「指向」不动文件,直接收编目录里已有的 .md;「迁移」把现有笔记文件移动过去(目标目录必须为空)。 | SettingsView.vue:95 |  |
| 88 | `aiKbSetPointToExisting` | `Point to existing directory` | 指向已有目录 | SettingsView.vue:89 |  |
| 89 | `aiKbSetRebuildAll` | `Rebuild all indexes` | 重建全部索引 | SettingsView.vue:177 · SettingsView.vue:178 |  |
| 90 | `aiKbSetRebuildAllDesc` | `Drops all existing indexes and re-scans all files.` | 会丢弃现有索引重新扫描所有文件 | SettingsView.vue:179 |  |
| 91 | `aiKbSetRebuildEllipsis` | `Rebuild…` | 重建… | SettingsView.vue:182 |  |
| 92 | `aiKbSetSandboxHint` | `Parse a single file without touching the index` | 单文件试解析，不写入索引 | SettingsView.vue:163 | 全角 `，` |
| 93 | `aiKbSetSandboxTitle` | `Test Sandbox` | 测试沙盒 | SettingsView.vue:162 |  |
| 94 | `aiKbSetSelected` | `Selected` | 已选择 | SettingsView.vue:82 |  |
| 95 | `aiKbSetSvcPausedDesc` | `New files will not be indexed automatically` | 新文件不会被自动收录 | SettingsView.vue:12 |  |
| 96 | `aiKbSetSvcPausedLine` | `⏸ Paused` | ⏸ 已暂停 | SettingsView.vue:11 |  |
| 97 | `aiKbSetSvcRunningDesc` | `Continuously monitoring and indexing new files` | 正在持续监控并索引新文件 | SettingsView.vue:12 |  |
| 98 | `aiKbSetSvcRunningLine` | `✅ Running` | ✅ 运行中 | SettingsView.vue:11 |  |
| 99 | `aiKbSwitchFailed` | `Switch failed` | 切换失败 | SettingsView.vue:304 |  |

### A.2.1 键名前缀规则(治理文件 §7 定死)

| 词干 | 覆盖 | 例 |
|---|---|---|
| `aiKbSet*` | 设置页专有 | `aiKbSetSvcPausedLine` · `aiKbSetMigrateTitle` |
| `aiKbPr*` | `ParserStatus.vue` 专有 | `aiKbPrDetailsTitle` · `aiKbPrRecentFailures` |
| `aiKbPt*` | `ParserTest.vue` 专有 | `aiKbPtTitle` · `aiKbPtZeroChunks` |
| `aiKbFb*` | `FolderBrowser.vue` 专有 | `aiKbFbVolumes` · `aiKbFbLoadFailed` |
| 无词干 `aiKb*` | **两页共用**的通用词 | `aiKbPause` · `aiKbResume` · `aiKbResumed` · `aiKbConcurrencyLevel` · `aiKbInferenceDevice` · `aiKbSwitchFailed` |

🔴 **T0 已核:98 个新键名与现有 196 个 `aiKb*` 零重名,98 个之间零重名。**
🔴 **订正(裁定 A-1,2026-08-03):加上 `aiKbDeviceAuto` 后 T1 已重核 —— 99 个新键与现有 196 个 `aiKb*`
零重名、99 个之间零重名(实测两个 locale 文件各 196+99 = **295** 个 `aiKb*`、全文件 1502 个 key 零重复)。**
`aiKbDeviceAuto` 两页共用(SettingsView + ParserStatus)→ 按 §A.2.1 走**无词干 `aiKb*`**,不带 `Set`/`Pr` 词干。
(`en_us.ts` / `zh_cn.ts` 各实测 196 个 `aiKb*` = P5a 96 + P5b 100 ✅。)

## A.3 🔴 4 组 zh 撞车 / 错译(**N21,照抄不改**)

| # | 情形 | 详情 | 为什么不能"顺手改对" |
|---|---|---|---|
| 1 | **`Resume` 与既有 `aiKbRebuild` zh 撞车** | 本期 `aiKbResume` = `Resume` → **恢复**;既有 `aiKbRebuild` = `Rebuild` → **恢复**(P5b ⚠️N #55 已登记的错译) | Vue2 把 `Rebuild` 译成「恢复」才是错的,`Resume`→「恢复」是**对的**。两个键都要存在、zh 都是「恢复」。改 `aiKbRebuild` 要同时改 Vue2 与 New-UI 两侧 = 独立产品决策票(承 P5b 交接项 #9) |
| 2 | **`Test Sandbox` / `Test sandbox` 只差首字母大小写** | `aiKbSetSandboxTitle`(`SettingsView.vue:162`,en `Test Sandbox`)与 `aiKbPrTestLink`(`ParserStatus.vue:6`,en `Test sandbox`),**zh 都是「测试沙盒」** | 与 P5b ⚠️N #91/#92(`Total done:` vs `Total done`)完全同族。英文档渲染必须保留大小写差异 = 两个键 |
| 3 | 🔴 **`Power-saving` / `Full power` 与既有 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` zh 撞车、en 不同** | 本期 `aiKbPrCcPowerSaving` = `Power-saving` → **省电**;既有 `aiKbCcPowerSaver` = `Power saver` → **省电**。`aiKbPrCcFullPower` = `Full power` → **全力**;既有 `aiKbCcFullSpeed` = `Full speed` → **全力** | 🔴 **不能复用既有键** —— 复用会让英文档渲染成 `Power saver` / `Full speed`,与 Vue2 的 `Power-saving` / `Full power` **不同 = 界面不 1:1**。必须新建。(注意 `Balanced` 三档里只有它 en 也相同 → 复用 `aiKbCcBalanced`) |
| 4 | **`aiKbPrOcrHint` 的中文是错译** | en `5–10× slower, only useful for truly scanned documents` → zh **慢 5-10x，只对真实索引的扫描件有用**。「truly **scanned**」被译成「真实**索引**的」;且 en 用 `–`(U+2013)/`×`(U+00D7),zh 用 ASCII `-`/`x` | 同 P5a N8 / P5b ⚠️N 模具:语言包自身的错译照抄,改了就是回归 |

⚠️ **另有一处 en/zh 标点不对称,不算错译但要照抄**:`aiKbSetOcrWarn` = `Enabling this slows indexing 5–10×`
(en 用 `–` 与 `×`),`aiKbPtDefaults` 的 zh 里保留了 en 的 `5–20`(U+2013)。**逐码点照抄,别"规范化"成 ASCII。**

## A.4 🔴 brief §4 说的那 4 处「动态 `$t()`」—— 实测全是字面量参数(E-5)

| brief 指的地方 | 蓝本 | 实际形态 | 抽取脚本扫得到吗 |
|---|---|---|---|
| 数组下标取值 | `ParserStatus.vue:38` `[$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)]` | **3 个字面量 `$t()`**,只是套在数组字面量里再取下标 | ✅ `\$t\(\s*['"]` 能扫到全部 3 个 |
| script 里的 computed | `ParserStatus.vue:121` `label: this.$t('Auto')` | 字面量 | ⚠️ **只扫 `<template>` 会漏** |
| 带占位符的 computed | `SettingsView.vue:219` `this.$t('Auto (currently {r})', { r })` | 字面量 + 参数对象 | ⚠️ 同上会漏 |
| 当函数实参 | `FolderBrowser.vue:46` `crumbsFor(this.current, this.$t('Volumes'))` · `:70` `this.$t('Failed to load folders')` | 字面量 | ⚠️ 同上会漏 |

→ **本期 `$t(非字面量)` = 0 处,零 K20 风险。**
→ 🔴 **唯一实操要求:抽取正则要跑在整个 `.vue` 文件上,不是只跑 `<template>` 块。**
  另有 5 处只在 `<script>` 里的 `$t()`(`SettingsView.vue:258`×2 / `:260,279,287,295,313`(`Operation failed`)/
  `:275` / `:285`×2 / `:293` / `:301`×2 / `:302` / `:304` / `:311`×2、`ParserTest.vue:186`、
  `FolderBrowser.vue:46,70`)—— **全部已在主表里**。

## A.5 全角标点守卫的例外清单(**18 条**,实扫得出)

T-i18n 要在 `messageSyntax.test.ts` 里对**本批 99 键**加全角标点扫描 `/[，；：？！（）]/`(订正:裁定 A-1)。
下面 18 条是 zh 值真的含这些字符的,**一律写成 `toBe` 钉死确切值的强断言**,不是「跳过扫描」的松形式。
**其余 81 条必须扫不出全角标点**(订正:裁定 A-1;`aiKbDeviceAuto` 的值「自动」不含全角标点,
所以例外清单仍是 **18 条** —— T1 已独立重扫实测确认,不是推定)。

> ⚠️ `。`(U+3002)、`「」`(U+300C/300D)、`·`(U+00B7)、`—`(U+2014)、`–`(U+2013)、`…`(U+2026)、
> `×`(U+00D7)、`→`(U+2192) **都不在** `/[，；：？！（）]/` 里 —— 不要按「看着像全角」来判
> (承 P5b E-3 的教训:计划书那份例外清单 1 条假阳性 + 5 条漏)。

| 键名 | zh 值 | 命中的全角字符 |
|---|---|---|
| `aiKbPrFoldersTitle` | 待处理文件夹（top {top} / 共 {total} 组） | `（）` |
| `aiKbPrOcrHint` | 慢 5-10x，只对真实索引的扫描件有用 | `，` |
| `aiKbPrRecentFailures` | 最近失败（{n}） | `（）` |
| `aiKbPtChunksTitle` | 切块结果（{n} 块） | `（）` |
| `aiKbPtDefaults` | 默认 target=600, overlap=80, min=2（沙盒宽松值；生产用 600/80/5–20）。 | `（）；` |
| `aiKbPtDoclingToggle` | docling 转出的 markdown（{n} 字符） | `（）` |
| `aiKbPtHelp1` | 上传一个文件，看 Parser 怎么处理它（切块 + 嵌入 + 评分）。 | `（），` |
| `aiKbPtMaxSize` | 最大 30 MB。PDF 首次会触发模型权重下载（~200 MB，一次性）。 | `（），` |
| `aiKbPtOcr` | OCR（扫描 PDF） | `（）` |
| `aiKbPtOverlapNote` | overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。 | `；` |
| `aiKbPtQueryPlaceholder` | （可选）输入 query，会计算每个 chunk 的余弦相似度 | `（），` |
| `aiKbPtScoredTitle` | Query 相似度排名（top {n}） | `（）` |
| `aiKbPtTooBig` | 文件超过 30 MB，沙盒不支持 | `，` |
| `aiKbPtViaDocling` | （经 docling 转 markdown） | `（）` |
| `aiKbSetCurrentlyUsing` | 当前用： | `：` |
| `aiKbSetDeviceAutoCurrent` | 自动（当前 {r}） | `（）` |
| `aiKbSetDeviceSet` | 推理设备：{label} | `：` |
| `aiKbSetSandboxHint` | 单文件试解析，不写入索引 | `，` |

## A.6 占位符清单(**9 条**,两档占位符集合一致性守卫)

T0 已用脚本核过:这 9 条的 zh / en 占位符集合**逐一相同,零差异**。

| 键名 | zh 占位符 | en 占位符 | 两档一致 |
|---|---|---|---|
| `aiKbPrFoldersTitle` | `{top}` `{total}` | `{top}` `{total}` | ✅ |
| `aiKbPrRecentFailures` | `{n}` | `{n}` | ✅ |
| `aiKbPrResolvedHint` | `{device}` | `{device}` | ✅ |
| `aiKbPtChunksTitle` | `{n}` | `{n}` | ✅ |
| `aiKbPtDoclingToggle` | `{n}` | `{n}` | ✅ |
| `aiKbPtScoredTitle` | `{n}` | `{n}` | ✅ |
| `aiKbSetConcurrencySet` | `{n}` | `{n}` | ✅ |
| `aiKbSetDeviceAutoCurrent` | `{r}` | `{r}` | ✅ |
| `aiKbSetDeviceSet` | `{label}` | `{label}` | ✅ |

> 其余 89 条零占位符。**全表无字面 `@`**(T0 已扫),不需要 `{'@'}` 转义。
> 🔴 守卫**只圈本批 99 键**(订正:裁定 A-1),不许全量(既有 `aiResTurn`/`aiResFilesInTurns` 的两档占位符不一致是有意设计)。

## A.7 死键 —— **本期 0 条**

P5b 有 2 条死键,成因是 K18 砍掉了三个重试入口的调用点。
**本期的 K30(不回显后端 detail)只是不做字符串拼接,`aiKbOpFailed` 与 `aiKbSwitchFailed` 两个键都仍有调用点。**
→ T-i18n 报告要显式写「**死 i18n 键 0 条**」(P5a 终审会查「死 i18n 键 0/N」)。

## A.8 计数自检 + 生成/校验脚本

```
A.1 复用      10   (不新增;原 11,裁定 A-1 把 aiKbOriginAuto 移出)
A.2 主表      99   (全部有 Vue2 权威 zh 值;原 98 + aiKbDeviceAuto)
本期新造       0
判定死键       0
----------------------
新增合计      99   ← messageSyntax.test.ts 的「exactly N keys」防漂移断言用这个数

去重 i18n 串来源核对(T0 实测):
  4 个蓝本文件里 $t('字面量')  distinct = 109
  $t(非字面量)                        = 0
  ------------------------------------------
  distinct 合计 = 109 = 10 复用 + 99 新增 + 0 死键   (合计不变,只是 1 条从复用挪到新增)
```

**抽取 / 导出命令(T0 用的,可复现)**:

```bash
U=/home/nimo/NimoTech/NimoOS-UI
git -C $U show main:src/assets/lang/zh_CN.json > /tmp/p5c-zh_CN.json
git -C $U show main:src/assets/lang/en_US.json > /tmp/p5c-en_US.json
for f in src/views/AI/Knowledge/SettingsView.vue src/components/common/FolderBrowser.vue \
         src/views/AI/Parser/ParserStatus.vue src/views/AI/Parser/ParserTest.vue; do
  git -C $U show main:$f > /tmp/p5c-$(basename $f)
done
# 抽取正则(🔴 跑在整个文件上,不是只跑 <template>):
#   \$t\(\s*'((?:[^'\\]|\\.)*)'   与   \$t\(\s*"((?:[^"\\]|\\.)*)"
```

🔴 **T-i18n 必须另写 `.superpowers/sdd/p5c-task-1-i18n-verify.mjs`**
(照 `p5b-task-1-i18n-verify.mjs` 的写法):读 `git show main:src/assets/lang/zh_CN.json` 与
新写的 `src/i18n/zh_cn.ts`,对 **99 条新键**逐 `codePointAt` 比对,输出 `MATCH/MISMATCH` 逐条,
**DoD = 99/99 MATCH**;另对 **10 条复用键**做「现值未被改动」比对,**DoD = 10/10 MATCH**。
(计数订正:裁定 A-1。🔴 **T1 实测已达成 99/99 + 10/10**,两段完整输出见 `p5c-task-1-report.md`。
脚本另加了一条 block-coverage 前置校验:`>>> SP8-P5c Task 1` 标记块里的 key 集合必须与脚本的 99 键映射
完全相等且零重复 —— 堵「脚本映射漏一条键」的盲区。)
