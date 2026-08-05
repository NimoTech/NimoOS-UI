## Task 8: i18n 双档

**Files:**
- Modify: `src/i18n/zh_cn.ts`
- Modify: `src/i18n/en_us.ts`

- [ ] **Step 1: 确认键不存在**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -n "aiKb" src/i18n/zh_cn.ts src/i18n/en_us.ts    # 预期 0 命中
```

- [ ] **Step 2: 按 §附录 A 落键**

- 中文值**逐字照表**(表里的值全部取自 Vue2 生产语言包 `src/assets/lang/zh_CN.json`,含中文逗号/句号/`·`/`…`/破折号 `—`)
- 英文值 = 表里的 Vue2 原 key 字面串(该区 Vue2 用英文原句当 key,英文档就是它本身)
- 键按字母序插进两档的合适位置(照文件既有排布风格,先看邻近 `aiCfg*`/`aiSk*` 怎么排的)
- 值里没有字面 `@`;若后续批次出现,写成 `{'@'}`

- [ ] **Step 3: 程序化逐码点比对**

先把 Vue2 语言包导出到临时文件(**不要读工作树,工作树是 07-15 旧版**):
```bash
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/assets/lang/zh_CN.json > /tmp/p5a-zh_CN.json
```
再写并跑校验脚本:
```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
cat > /tmp/p5a-i18n-check.mjs <<'SCRIPT'
import { readFileSync } from 'node:fs'
// MAP = 附录 A 主表的 (aiKb 键 → Vue2 原 key) 全部 94 条,逐条抄进来。
// 新造的 aiKbDeferredTitle / aiKbDeferredHint 不在 Vue2 语言包里 → 放进 SKIP。
const MAP = {
  aiKbKnowledgeBase: 'Knowledge Base',
  aiKbBrowse: 'Browse',
  // … 其余 86 条 …
}
const SKIP = new Set(['aiKbDeferredTitle', 'aiKbDeferredHint'])
const vue2 = JSON.parse(readFileSync('/tmp/p5a-zh_CN.json', 'utf8'))
const zhSrc = readFileSync('src/i18n/zh_cn.ts', 'utf8')
const enSrc = readFileSync('src/i18n/en_us.ts', 'utf8')

// 从 TS 源里取某个键的字符串字面量值(单/双引号皆可)
const valOf = (src, key) => {
  const m = src.match(new RegExp(`\\n\\s*${key}:\\s*(['"])([\\s\\S]*?)\\1\\s*,`))
  return m ? m[2] : null
}
const cp = (s) => [...s].map((c) => c.codePointAt(0)).join(',')

let bad = 0
for (const [key, vue2Key] of Object.entries(MAP)) {
  if (SKIP.has(key)) continue
  const mine = valOf(zhSrc, key)
  const theirs = vue2[vue2Key]
  if (mine === null) { console.log(`MISSING in zh_cn.ts: ${key}`); bad++; continue }
  if (theirs === undefined) { console.log(`NOT IN Vue2 lang pack: ${vue2Key}`); bad++; continue }
  if (cp(mine) !== cp(theirs)) {
    console.log(`MISMATCH ${key}\n  mine  : ${JSON.stringify(mine)}\n  vue2  : ${JSON.stringify(theirs)}`)
    bad++
  }
}
// 英文档的值应等于 Vue2 原 key 本身
for (const [key, vue2Key] of Object.entries(MAP)) {
  if (SKIP.has(key)) continue
  const mine = valOf(enSrc, key)
  if (mine !== vue2Key) { console.log(`EN MISMATCH ${key}: ${JSON.stringify(mine)} != ${JSON.stringify(vue2Key)}`); bad++ }
}
// 重复键扫描(两档各自)
for (const [name, src] of [['zh_cn', zhSrc], ['en_us', enSrc]]) {
  const seen = new Map()
  for (const m of src.matchAll(/\n\s*([A-Za-z][A-Za-z0-9_]*):\s*['"]/g)) {
    seen.set(m[1], (seen.get(m[1]) ?? 0) + 1)
  }
  for (const [k, n] of seen) if (n > 1) { console.log(`DUPLICATE in ${name}: ${k} ×${n}`); bad++ }
}
console.log(bad === 0 ? 'MISMATCH: none' : `PROBLEMS: ${bad}`)
SCRIPT
node /tmp/p5a-i18n-check.mjs
```
**预期输出 `MISMATCH: none`**;把这行(以及任何 MISMATCH 明细)贴进报告。评审者要**自己独立重跑一遍**(P4 T4 的双跑先例)。

- [ ] **Step 4: 三门**(`parity.test.ts` / `messageSyntax.test.ts` 必须绿;不新增 `.vue`)
- [ ] **Step 5: 提交**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(i18n): SP8-P5a 知识库壳与仪表盘 96 个 aiKb* 键双档(复用 aiCfgYou)"
```

---


---

# 附:附录 A —— i18n 键表(**注意:占位页那 2 条已由 T5 落好,本任务只落 94 条**)

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

