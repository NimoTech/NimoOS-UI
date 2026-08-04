# P5d 附录 A —— i18n 键表(**权威**,T0 产出)

**T0 实测于 2026-08-04** · 蓝本 `NimoOS-UI`@`7a6ee6b7` · 提取范围 = **整个文件**(不只 `<template>`,承 P5c E-5)

> 🔴 **本表是 T1 的唯一值来源。** zh 值一律取 `git show 7a6ee6b7:src/assets/lang/zh_CN.json`,
> **en 值一律取 `git show 7a6ee6b7:src/assets/lang/en_US.json`** —— 见下面 §A.0 的 🔴 头等勘误。
> 逐字照抄,不许自行翻译、不许改标点。手抄进 TS 后**必须**跑 `p5d-task-1-i18n-verify.mjs` 逐码点比对。

## §A.0 🔴 两条必须先读的实测结论(改变了 T1 的做法)

### ① **en 值不等于「英文原串」的有 2 条** —— 全期第一次出现

前三期(P5a/P5b/P5c)T0 都测出 `en_US.json` 里**零覆盖**,于是治理文件只规定了「zh 以 `zh_CN.json` 为权威」,
en 一律按「= `$t()` 里的英文原串」处理。**本期这个假设第一次不成立:**

| 蓝本 `$t()` 原串 | `en_US.json` 实际值 | 差异 |
|---|---|---|
| `this cannot be undone` | **`this cannot be undone.`** | **多一个句点** |
| `Note item` | **`Note`** | **整词不同** |

Vue2 的 i18n 默认 locale 与 fallback **都是 `en_us`**(`src/plugins/i18n.js:9-10`),`en_US.json` 里这两条
有**显式条目** → **Vue2 英文界面渲染的是右列,不是原串**。
🔴 **T1 若按「en = 英文原串」写,英文档就有两处与 Vue2 不同(界面不 1:1),而三门全绿、没有任何守卫会说话**
—— 与 P5c E-18(「键名存在但语义不对」)同族:**错得能编译过**。
→ **落地要求**:`aiKbNtDeleteBody2` 的 en 填 `this cannot be undone.`;`aiKbNoteTypeNote` 的 en 填 `Note`。
两条各配一条 **en 档正向断言 + 反向断言(≠ 英文原串)**。

### ② **全角标点例外只有 1 条**,治理 §7(a) 点名的那 3 条**全是假阳性**

治理 §7(a) 写「本期例外至少含 N26 的两组三段式(`,还不是正式知识` 以中文逗号开头、
`一句话摘要(用于列表与搜索展示)` 带全角括号、`只是暂时不需要的话,建议改用「归档」。`)」。
**逐码点实测:这三条用的全是半角** —— `,` 是 **U+002C**、括号是 **U+0028/U+0029**。
本期 92 个 zh 值里能被 `/[，；：？！（）]/` 命中的**只有 1 条**(见 §A.5)。
🔴 **按治理那份写 `toBe` 强断言例外清单会当场红 3 条**(与 P5b E-3 同族:那次是 1 假阳性 + 5 漏)。

---

## §A.1 复用键(**7 条**,协调者裁定 A-6;逐条已核「New-UI 现值 == Vue2 语言包值」)

| # | 复用键 | en / zh(New-UI 现值) | Vue2 语言包值 | 一致? | 用在 |
|---|---|---|---|---|---|
| 1 | `aiKbAll` | `All` / `全部` | `All` / `全部` | ✅ | `NotesView.vue:81` 状态 pill「全部」 |
| 2 | `aiKbCancel` | `Cancel` / `取消` | `Cancel` / `取消` | ✅ | `NotesView.vue:170` 删除弹窗 |
| 3 | `aiKbClearFilters` | `Clear filters` / `清空筛选` | `Clear filters` / `清空筛选` | ✅ | `NotesView.vue:106` 筛选空态 |
| 4 | `aiKbOpFailed` | `Operation failed` / `操作失败` | `Operation failed` / `操作失败` | ✅ | 11 处 catch(`NotesView.vue:226/236/245/252/261` · `NoteEditPane.vue:218/263/270/296/307/314`) |
| 5 | `aiKbStatus` | `Status` / `状态` | `Status` / `状态` | ✅ | `NoteEditPane.vue:76` 侧栏卡标题 |
| 6 | `aiKbColType` | `Type` / `类型` | `Type` / `类型` | ✅ | `NotesView.vue:93` 类型下拉 `:title` |
| 7 | `aiKbJustNow` | `just now` / `刚刚` | `just now` / `刚刚` | ✅ | `notesViewHelpers.js:45` `relativeTime` 第 1 档 |

**7/7 一致 ✅** —— 复用安全,T1 **不要重写这 7 条**,只在 verify 脚本 PART 2 里做「未被改动」比对。

## §A.2 新增键(**92 条**,按键名排序)

> 🔴 「en 值」列凡标 **≠ 原串** 的,必须填该列的值,**不是** JSON key 本身(§A.0①)。

| # | New-UI 键名 | Vue2 英文原串(= 语言包 JSON key) | **en 值(en_US.json 权威)** | **zh 值(zh_CN.json 权威)** | 蓝本 file:line |
|---|---|---|---|---|---|
| 1 | `aiKbAiDraft` | `AI draft` | `AI draft` | `AI 草稿` | NotesView.vue:84 · NotesView.vue:116 · NoteEditPane.vue:12 · NoteEditPane.vue:82 |
| 2 | `aiKbArchived` | `Archived` | `Archived` | `已归档` | NotesView.vue:91 · NotesView.vue:117 · NoteEditPane.vue:13 · NoteEditPane.vue:83 |
| 3 | `aiKbCurated` | `Curated` | `Curated` | `已确认` | NotesView.vue:88 · NoteEditPane.vue:84 |
| 4 | `aiKbNeAdoptedDisk` | `Loaded the latest version — your body was replaced` | `Loaded the latest version — your body was replaced` | `已加载最新版本,你的正文已被替换` | NoteEditPane.vue:322 |
| 5 | `aiKbNeBackToList` | `Back to list` | `Back to list` | `返回列表` | NoteEditPane.vue:10 |
| 6 | `aiKbNeBasedOnRev` | `based on rev {n}` | `based on rev {n}` | `基于 rev {n}` | NoteEditPane.vue:168 |
| 7 | `aiKbNeBold` | `Bold` | `Bold` | `加粗` | NoteEditPane.vue:43 |
| 8 | `aiKbNeBulletList` | `Bullet list` | `Bullet list` | `无序列表` | NoteEditPane.vue:50 |
| 9 | `aiKbNeCodeBlock` | `Code block` | `Code block` | `代码块` | NoteEditPane.vue:52 |
| 10 | `aiKbNeConfirmAsCurated` | `Confirm as curated note` | `Confirm as curated note` | `确认为正式笔记` | NoteEditPane.vue:31 |
| 11 | `aiKbNeConflictBody` | `While you were editing, the file on disk changed (maybe Obsidian or another tab). Choose which body to keep — your title, summary and tags stay as typed.` | `While you were editing, the file on disk changed (maybe Obsidian or another tab). Choose which body to keep — your title, summary and tags stay as typed.` | `你编辑期间,这条笔记的文件在磁盘上被修改了(可能是 Obsidian 或另一个标签页)。选择保留哪个正文 — 标题、摘要与标签会保留你的输入。` | NoteEditPane.vue:160 |
| 12 | `aiKbNeConflictMine` | `Your unsaved edits` | `Your unsaved edits` | `你的未保存编辑` | NoteEditPane.vue:168 |
| 13 | `aiKbNeConflictTheirs` | `Latest version on disk` | `Latest version on disk` | `磁盘上的最新版本` | NoteEditPane.vue:164 |
| 14 | `aiKbNeConflictTitle` | `This note was saved by someone else first` | `This note was saved by someone else first` | `有人先保存了这条笔记` | NoteEditPane.vue:155 |
| 15 | `aiKbNeCopyMyBody` | `Copy my body` | `Copy my body` | `复制我的正文` | NoteEditPane.vue:174 |
| 16 | `aiKbNeCopyPath` | `Copy path` | `Copy path` | `复制路径` | NoteEditPane.vue:104 |
| 17 | `aiKbNeDescPlaceholder` | `One-line summary (shown in lists and search)` | `One-line summary (shown in lists and search)` | `一句话摘要(用于列表与搜索展示)` | NoteEditPane.vue:38 |
| 18 | `aiKbNeDraftBar1` | `This is an` | `This is an` | `这是一条` | NoteEditPane.vue:28 |
| 19 | `aiKbNeDraftBar2` | `AI-captured draft` | `AI-captured draft` | `AI 自动沉淀的草稿` | NoteEditPane.vue:28 |
| 20 | `aiKbNeDraftBar3` | `, not curated knowledge yet` | `, not curated knowledge yet` | `,还不是正式知识` | NoteEditPane.vue:28 |
| 21 | `aiKbNeDraftBarSub` | `Confirm to move it into the knowledge base — you can edit first, then confirm.` | `Confirm to move it into the knowledge base — you can edit first, then confirm.` | `确认后进入正式知识库;也可以先修改再确认。` | NoteEditPane.vue:29 |
| 22 | `aiKbNeDraftCopied` | `Your draft copied` | `Your draft copied` | `已复制你的正文` | NoteEditPane.vue:313 |
| 23 | `aiKbNeEditDirectHint` | `Editing the file directly also works — synced back within 60 s` | `Editing the file directly also works — synced back within 60 s` | `直接编辑这个文件也可以,60 秒内同步回来` | NoteEditPane.vue:98 |
| 24 | `aiKbNeFileManager` | `File manager` | `File manager` | `文件管理器` | NoteEditPane.vue:101 |
| 25 | `aiKbNeFileOnDisk` | `File on disk` | `File on disk` | `磁盘文件` | NoteEditPane.vue:92 |
| 26 | `aiKbNeH2` | `Heading 2` | `Heading 2` | `二级标题` | NoteEditPane.vue:47 |
| 27 | `aiKbNeH3` | `Heading 3` | `Heading 3` | `三级标题` | NoteEditPane.vue:48 |
| 28 | `aiKbNeItalic` | `Italic` | `Italic` | `斜体` | NoteEditPane.vue:44 |
| 29 | `aiKbNeKeepMine` | `Keep my edits` | `Keep my edits` | `保留我的编辑` | NoteEditPane.vue:177 |
| 30 | `aiKbNeKeptMine` | `Kept your edits — saving will overwrite rev {n}` | `Kept your edits — saving will overwrite rev {n}` | `保留了你的编辑,保存将覆盖 rev {n}` | NoteEditPane.vue:330 |
| 31 | `aiKbNeLastModified` | `Last modified` | `Last modified` | `最后修改` | NoteEditPane.vue:87 |
| 32 | `aiKbNeMdPlaceholder` | `# Markdown source…` | `# Markdown source…` | `# Markdown 源码…` | NoteEditPane.vue:64 |
| 33 | `aiKbNeNChars` | `{n} characters` | `{n} characters` | `{n} 字` | NoteEditPane.vue:66 |
| 34 | `aiKbNeNewFileHint` | `A .md file is created in the notes folder on save` | `A .md file is created in the notes folder on save` | `保存后在笔记目录创建 .md 文件` | NoteEditPane.vue:94 |
| 35 | `aiKbNeNewStatusHint` | `Becomes a curated note once saved` | `Becomes a curated note once saved` | `保存后成为「已确认」的正式笔记` | NoteEditPane.vue:78 |
| 36 | `aiKbNeNotSavedYet` | `Not saved yet` | `Not saved yet` | `尚未保存` | NoteEditPane.vue:17 |
| 37 | `aiKbNeOpenConversation` | `Open source conversation` | `Open source conversation` | `打开来源对话` | NoteEditPane.vue:131 |
| 38 | `aiKbNePathCopied` | `Path copied` | `Path copied` | `路径已复制` | NoteEditPane.vue:262 |
| 39 | `aiKbNeProperties` | `Properties` | `Properties` | `属性` | NoteEditPane.vue:111 |
| 40 | `aiKbNeQuote` | `Quote` | `Quote` | `引用` | NoteEditPane.vue:51 |
| 41 | `aiKbNeReferencedBy` | `Referenced by` | `Referenced by` | `被引用` | NoteEditPane.vue:138 |
| 42 | `aiKbNeRemoveTag` | `Remove` | `Remove` | `移除` | NoteEditPane.vue:118 |
| 43 | `aiKbNeRevealFile` | `Reveal in file manager` | `Reveal in file manager` | `在文件管理器中定位` | NoteEditPane.vue:128 |
| 44 | `aiKbNeRichText` | `Rich text` | `Rich text` | `富文本` | NoteEditPane.vue:55 |
| 45 | `aiKbNeSave` | `Save` | `Save` | `保存` | NoteEditPane.vue:20 |
| 46 | `aiKbNeSaved` | `Saved` | `Saved` | `已保存` | NoteEditPane.vue:291 |
| 47 | `aiKbNeSavedRev` | `Saved · rev {n}` | `Saved · rev {n}` | `已保存 · rev {n}` | NoteEditPane.vue:17 |
| 48 | `aiKbNeSaving` | `Saving…` | `Saving…` | `保存中…` | NoteEditPane.vue:17 · NoteEditPane.vue:20 |
| 49 | `aiKbNeSource` | `Source` | `Source` | `来源` | NoteEditPane.vue:86 |
| 50 | `aiKbNeSourceConversation` | `Source conversation` | `Source conversation` | `来源对话` | NoteEditPane.vue:132 |
| 51 | `aiKbNeSources` | `Sources` | `Sources` | `来源` | NoteEditPane.vue:126 |
| 52 | `aiKbNeStrike` | `Strikethrough` | `Strikethrough` | `删除线` | NoteEditPane.vue:45 |
| 53 | `aiKbNeTagsPlaceholder` | `Tags, comma separated…` | `Tags, comma separated…` | `标签,逗号分隔…` | NoteEditPane.vue:120 |
| 54 | `aiKbNeTitlePlaceholder` | `Note title…` | `Note title…` | `笔记标题…` | NoteEditPane.vue:37 |
| 55 | `aiKbNeUnsaved` | `Unsaved changes` | `Unsaved changes` | `有未保存更改` | NoteEditPane.vue:17 |
| 56 | `aiKbNeUseDisk` | `Use disk version` | `Use disk version` | `采用磁盘版本` | NoteEditPane.vue:176 |
| 57 | `aiKbNoteConfirmed` | `Note confirmed` | `Note confirmed` | `笔记已确认` | NotesView.vue:235 · NoteEditPane.vue:268 |
| 58 | `aiKbNoteSrcAgent` | `Written by agent` | `Written by agent` | `Agent 代写` | notesViewHelpers.js:18 (labelKey,动态 $t) |
| 59 | `aiKbNoteSrcHuman` | `Written by you` | `Written by you` | `手写` | notesViewHelpers.js:17 (labelKey,动态 $t) |
| 60 | `aiKbNoteSrcPipeline` | `Auto-captured` | `Auto-captured` | `AI 沉淀` | notesViewHelpers.js:19 (labelKey,动态 $t) |
| 61 | `aiKbNoteTypeDigest` | `Digest` | `Digest` | `文摘` | notesViewHelpers.js:9 (labelKey,动态 $t) |
| 62 | `aiKbNoteTypeInsight` | `Insight` | `Insight` | `洞见` | notesViewHelpers.js:8 (labelKey,动态 $t) |
| 63 | `aiKbNoteTypeNote` | `Note item` | 🔴 `Note`(**≠ 原串**) | `笔记` | notesViewHelpers.js:6 (labelKey,动态 $t) |
| 64 | `aiKbNoteTypeSummary` | `Summary` | `Summary` | `摘要` | notesViewHelpers.js:7 (labelKey,动态 $t) |
| 65 | `aiKbNtAllTypes` | `All types` | `All types` | `全部类型` | NotesView.vue:94 |
| 66 | `aiKbNtArchive` | `Archive` | `Archive` | `归档` | NotesView.vue:132 |
| 67 | `aiKbNtArchiveInstead` | `Archive instead` | `Archive instead` | `改为归档` | NotesView.vue:171 |
| 68 | `aiKbNtConfirm` | `Confirm` | `Confirm` | `确认` | NotesView.vue:66 · NotesView.vue:131 |
| 69 | `aiKbNtConfirmAll` | `Confirm all` | `Confirm all` | `全部确认` | NotesView.vue:50 |
| 70 | `aiKbNtDelete` | `Delete` | `Delete` | `删除` | NotesView.vue:67 · NotesView.vue:133 · NotesView.vue:172 |
| 71 | `aiKbNtDeleteBody1` | `The Markdown file on disk is deleted with it —` | `The Markdown file on disk is deleted with it —` | `磁盘上的 Markdown 文件会一并删除,` | NotesView.vue:164 |
| 72 | `aiKbNtDeleteBody2` | `this cannot be undone` | 🔴 `this cannot be undone.`(**≠ 原串**) | `不可恢复。` | NotesView.vue:165 |
| 73 | `aiKbNtDeleteBody3` | `If you only need it out of the way, use Archive instead.` | `If you only need it out of the way, use Archive instead.` | `只是暂时不需要的话,建议改用「归档」。` | NotesView.vue:166 |
| 74 | `aiKbNtDeleteTitle` | `Delete note?` | `Delete note?` | `删除该笔记？` | NotesView.vue:150 |
| 75 | `aiKbNtEmptySub` | `After a chat with the agent, worthwhile conclusions become AI drafts automatically; you can also create a note directly, or drop .md files into the notes folder.` | `After a chat with the agent, worthwhile conclusions become AI drafts automatically; you can also create a note directly, or drop .md files into the notes folder.` | `与 agent 聊完后,有价值的结论会自动沉淀成 AI 草稿;也可以直接新建,或把 .md 文件放进笔记目录。` | NotesView.vue:36 |
| 76 | `aiKbNtEmptyTitle` | `No notes yet` | `No notes yet` | `还没有笔记` | NotesView.vue:35 |
| 77 | `aiKbNtInboxFootHint` | `From "Auto-capture insights" — can be turned off under Advanced → Knowledge notes` | `From "Auto-capture insights" — can be turned off under Advanced → Knowledge notes` | `来自「对话洞见自动沉淀」· 可在 高级 → 知识笔记 中关闭` | NotesView.vue:72 |
| 78 | `aiKbNtInboxSub` | `Conclusions captured after conversations. Confirm to make them curated knowledge, delete to discard.` | `Conclusions captured after conversations. Confirm to make them curated knowledge, delete to discard.` | `对话结束后自动沉淀的结论。确认后成为正式知识,删除则丢弃。` | NotesView.vue:47 |
| 79 | `aiKbNtInboxTitle` | `AI drafts awaiting review` | `AI drafts awaiting review` | `条 AI 草稿待确认` | NotesView.vue:46 |
| 80 | `aiKbNtListFoot` | `{n} notes — searchable globally, recallable by the agent and exposed read-only via MCP` | `{n} notes — searchable globally, recallable by the agent and exposed read-only via MCP` | `{n} 条笔记 · 全部可被全局搜索与 agent 召回,并经 MCP 只读暴露给外部 AI` | NotesView.vue:139 |
| 81 | `aiKbNtNDraftsConfirmed` | `{n} drafts confirmed` | `{n} drafts confirmed` | `已确认 {n} 条草稿` | NotesView.vue:243 |
| 82 | `aiKbNtNewNote` | `New Note` | `New Note` | `新建笔记` | NotesView.vue:37 · NotesView.vue:98 |
| 83 | `aiKbNtNoMatch` | `No notes match the filter` | `No notes match the filter` | `没有符合筛选的笔记` | NotesView.vue:105 |
| 84 | `aiKbNtNoteArchived` | `Note archived` | `Note archived` | `笔记已归档` | NotesView.vue:251 |
| 85 | `aiKbNtNoteDeleted` | `Note deleted` | `Note deleted` | `笔记已删除` | NotesView.vue:260 |
| 86 | `aiKbNtOpenFolder` | `Open in file manager` | `Open in file manager` | `在文件管理器中打开` | NotesView.vue:15 |
| 87 | `aiKbNtPathLead` | `Every note is a Markdown file in` | `Every note is a Markdown file in` | `每条笔记都是一个 Markdown 文件,存放在` | NotesView.vue:11 |
| 88 | `aiKbNtPathTail` | `edit them with Obsidian or the file manager, synced within 60 s` | `edit them with Obsidian or the file manager, synced within 60 s` | `用 Obsidian 或文件管理器直接改,60 秒内同步` | NotesView.vue:13 |
| 89 | `aiKbNtReviewOneByOne` | `Review one by one` | `Review one by one` | `逐条审阅` | NotesView.vue:73 |
| 90 | `aiKbRelDaysAgo` | `{n} d ago` | `{n} d ago` | `{n} 天前` | notesViewHelpers.js:48 |
| 91 | `aiKbRelHrAgo` | `{n} h ago` | `{n} h ago` | `{n} 小时前` | notesViewHelpers.js:47 |
| 92 | `aiKbRelMinAgo` | `{n} min ago` | `{n} min ago` | `{n} 分钟前` | notesViewHelpers.js:46 |

## §A.4 🔴 动态 `$t(非字面量)` 清单(**5 处**,K20 风险回来了)

扫描口径:`/(?:\$t|i18n\.t)\(\s*(?!['"])/` 对**整个文件**(不只 `<template>`)。实测 **5 处,全部经 `labelKey`**:

| # | 位置 | 表达式 | 取值范围 |
|---|---|---|---|
| 1 | `NotesView.vue:95` | `$t(m.labelKey)` (`v-for (m,t) in NOTE_TYPES`) | 4 个 type labelKey |
| 2 | `NotesView.vue:121` | `$t(typeMeta(n.type).labelKey)` | 同上(带 `\|\| NOTE_TYPES.note` 兜底) |
| 3 | `NotesView.vue:123` | `$t(sourceMeta(n.createdBy).labelKey)` | 3 个 source labelKey(带 `\|\| NOTE_SOURCES.human` 兜底) |
| 4 | `NoteEditPane.vue:86`(**第二处 `$t`**,同一行第一处 `$t('Source')` 是字面量) | `$t(sourceMeta(note.createdBy).labelKey)` | 同上 |
| 5 | `NoteEditPane.vue:113` | `$t(m.labelKey)` | 4 个 type labelKey |

**7 个 labelKey 值全部已进 §A.2**(逐条核对 ✅):

| labelKey 原串 | 蓝本 | New-UI 键 | en(en_US.json) | zh |
|---|---|---|---|---|
| `Note item` | `notesViewHelpers.js:6` | `aiKbNoteTypeNote` | 🔴 `Note`(≠原串,见 §A.0①) | `笔记` |
| `Summary` | `:7` | `aiKbNoteTypeSummary` | `Summary` | `摘要` |
| `Insight` | `:8` | `aiKbNoteTypeInsight` | `Insight` | `洞察` |
| `Digest` | `:9` | `aiKbNoteTypeDigest` | `Digest` | `摘录` |
| `Written by you` | `:17` | `aiKbNoteSrcHuman` | `Written by you` | `你写的` |
| `Written by agent` | `:18` | `aiKbNoteSrcAgent` | `Written by agent` | `agent 写的` |
| `Auto-captured` | `:19` | `aiKbNoteSrcPipeline` | `Auto-captured` | `自动沉淀` |

🔴 **落地口径(K40 连带)**:`notesViewHelpers.ts` 里 `labelKey` 字段的值必须改成 **New-UI 键名**
(`labelKey: 'aiKbNoteTypeNote'` …),不是英文原串 —— New-UI 的键是 `aiKb*`,「英文原串即 key」这个
Vue2 巧合不成立(与 P5b N14 同一个坑)。**`NOTE_TYPES` / `NOTE_SOURCES` 的 7 个 `labelKey` 各要一条
「渲染出中文/英文值而不是键名」的用例。**

## §A.5 全角标点例外清单(**实扫 1 条**,不是治理 §7(a) 预测的 ≥3 条)

正则 `/[，；：？！（）]/` 对 92 个 zh 值实扫:

| # | 键 | zh 值 | 命中字符 |
|---|---|---|---|
| 1 | `aiKbNtDeleteTitle` | `删除该笔记？` | `？`(U+FF1F) |

**其余 91 条必须扫不出全角标点。** ⚠️ 不在该正则里、因此**不算例外**的字符(本期实测出现次数):
`。` U+3002 ×8 · `「」` U+300C/D ×3 · `→` U+2192 ×1 · `…` U+2026 ×4 · `—` U+2014 ×1 · `、` U+3001 ×1。
⚠️ **本语言包的中文逗号一律是半角 `,`(U+002C)、括号一律半角 `()`** —— 别按「看着像全角」判。
🔴 治理 §7(a) 点名的 3 条经逐码点验证**全是假阳性**,详见 §A.0②。

## §A.6 带占位符的键(**9 条,占位符全是 `{n}`,两档名称集合逐条一致 ✅**)

| # | 键 | 占位符(zh / en) | zh 值 |
|---|---|---|---|
| 1 | `aiKbNtListFoot` | `{n}` / `{n}` | `{n} 条笔记 · 全部可被全局搜索与 agent 召回,并经 MCP 只读暴露给外部 AI` |
| 2 | `aiKbNtNDraftsConfirmed` | `{n}` / `{n}` | `已确认 {n} 条草稿` |
| 3 | `aiKbNeSavedRev` | `{n}` / `{n}` | `已保存 · rev {n}` |
| 4 | `aiKbNeNChars` | `{n}` / `{n}` | `{n} 字` |
| 5 | `aiKbNeBasedOnRev` | `{n}` / `{n}` | `基于 rev {n}` |
| 6 | `aiKbNeKeptMine` | `{n}` / `{n}` | `保留了你的编辑,保存将覆盖 rev {n}` |
| 7 | `aiKbRelMinAgo` | `{n}` / `{n}` | `{n} 分钟前` |
| 8 | `aiKbRelHrAgo` | `{n}` / `{n}` | `{n} 小时前` |
| 9 | `aiKbRelDaysAgo` | `{n}` / `{n}` | `{n} 天前` |

**零处字面 `@`**(`messageSyntax.test.ts` 的 `{'@'}` 转义规则本期不触发)。

## §A.7 撞车表(**双向扫描,真实模块导入计键数**)

扫描方式:`import zh from 'src/i18n/zh_cn.ts'` / `en_us.ts`(**真实模块导入**,不是文本解析)。
**实测键数:zh_cn.ts = 1503 / en_us.ts = 1503,键集完全一致;其中 `aiKb*` = 295。**
✅ 与治理 §0.4 的基线数字逐字一致。

### A.7.1 危险撞车(复用会让**某一档**渲染错)—— **实测 11 组,治理 §7.1 只有 8 组**

| # | 治理编号 | 本期新键(en / zh) | 撞车对象(en / zh) | 性质 |
|---|---|---|---|---|
| 1 | N32-3 | `Open in file manager` / `在文件管理器中打开` | `aiOpenInFileManager`(`Open in File Manager`) | zh 撞车、en 差两处首字母大小写 |
| 2 | N32-1 | `Confirm` / `确认` | `appsSettingsConflictOk`(`OK`) | zh 撞车、en 不同 |
| 3 | 🔴 **N32-9(T0 新增)** | `Delete` / `删除` | **`appsSettingsRemove`(`Remove` / `删除`)** | zh 撞车、en 不同 |
| 4 | N32-4 | `Source` / `来源` | `aiSkAddedBy`(`Added by`) | zh 撞车、en 不同 |
| 5 | 🔴 **N32-10(T0 新增)** | `Remove` / `移除` | **`appsSettingsRemove`(`Remove` / `删除`)** | **镜像**:en 撞车、zh 不同(复用 → 中文渲染成「删除」) |
| 6 | N32-5 | `Sources` / `来源` | `aiSkAddedBy`(`Added by`) | zh 撞车、en 不同 |
| 7 | N32-7 | `Path copied` / `路径已复制` | `filesCopiedPath`(`Path copied` / `已复制路径`) | **镜像**:en 撞车、zh 不同 |
| 8 | 🔴 **N32-11(T0 新增)** | `{n} min ago` / `{n} 分钟前` | **`aiResMinutesAgo`(`{n}m ago`)** | zh 撞车、en 不同 |
| 9 | 🔴 **N32-12(T0 新增)** | `{n} h ago` / `{n} 小时前` | **`aiResHoursAgo`(`{n}h ago`)** | zh 撞车、en 不同 |
| 10 | N32-6 | `{n} d ago` / `{n} 天前` | `aiResDaysAgo`(`{n}d ago`,**无空格**) | zh 撞车、en 差一个空格 |
| 11 | N32-2 | `Note item` / `笔记` | `aiKbNavNotes`(`Notes`) | zh 撞车、en 不同(**且本期 en 值是 `Note` 不是 `Note item`**,见 §A.0①) |

外加 **N32-8(本期内部)**:`aiKbNeSource`(`Source`)与 `aiKbNeSources`(`Sources`)zh 都是 `来源`、en 不同
(蓝本 `NoteEditPane.vue:86` / `:126`)→ **两个键都要建,不许合一**。

🔴 **11 组 + 1 组内部 = 12 组,每组都要 en 档正向 + 反向断言**(P5c §9.2:只比 zh 的断言零判别力,
实测「换成被禁键 47/47 全绿」)。
**治理 §7.1 那句「假定本表不完整」得到验证:P5d 的 T0 又扫出 4 组协调者不知道的。**

### A.7.2 全同重复(两档都逐字相同,渲染无差;A-6 仍**拒绝复用**,理由=跨区键名)—— 21 组

`Delete` = `filesCtxDelete` / `filesUploadCancel` / `appsCustomLinkDelete` / `aiConfirm` / `aiCfgDelete` / `aiSkDelete` ·
`Saving…` = `aiCfgSaving` · `Save` = `filesViewerSave` / `filesDropSave` / `appsCustomLinkSave` / `aiCfgSave` ·
`Copy path` = `filesCtxCopyPath` · `Remove` = `gridRemove` / `appsSourcesRemove` / `aiMcpSrvRemoveConfirm` ·
`Saved` = `filesViewerSaved` / `aiCfgSaved` / `aiCfgMemSourceTool` · `{n} min ago` = `homeRelMinutes` ·
`{n} h ago` = `homeRelHours` · `Summary` = `audioSummary`

治理 §7 的「明确不复用」清单**漏列了 8 个**(`filesUploadCancel` / `appsCustomLinkDelete` / `aiSkDelete` /
`filesDropSave` / `appsCustomLinkSave` / `appsSourcesRemove` / `aiMcpSrvRemoveConfirm` / `aiCfgMemSourceTool`)——
**结论不变**(它们本来就在「一律新建」的口径下),仅补全登记。

### A.7.3 K42 前提复核(4 个相对时间键必须新建)—— **成立,且理由比治理写的更多一条**

| 既有键 | en / zh | 为什么不能复用 |
|---|---|---|
| `aiKbMinAgo` | `{m} min ago` / `{m} 分钟前` | 占位符 **`{m}`** ≠ 蓝本 `{n}` → 渲染出字面量 `{n}` |
| `aiKbHrAgo` | `{h} hr ago` / `{h} 小时前` | 占位符 **`{h}`**,**且 en 是 `hr` 不是 `h`** ← 治理没写这一条 |
| `aiKbDaysAgo` | `{d} days ago` / `{d} 天前` | 占位符 **`{d}`**,**且 en 是 `days` 不是 `d`** ← 治理没写这一条 |
| `aiResDaysAgo` | `{n}d ago` / `{n} 天前` | en 无空格 |
| `homeRelMinutes` / `homeRelHours` | 与本期**逐字全同** | 仅剩「跨区键名」这一条理由(A-6) |
| ✅ `aiKbJustNow` | `just now` / `刚刚` | **唯一可复用的一条**(已在 §A.1) |

## §A.8 计数汇总(**T1 的 DoD 数字**)

| 项 | 数 |
|---|---|
| distinct 串(字面量 92 + labelKey 7) | **99** ✅ 与治理一致 |
| 字面量 `$t('…')` 出现次数 | 115(distinct 92) |
| 动态 `$t(非字面量)` | **5**(§A.4) |
| 复用 | **7**(§A.1) |
| **新增** | **92** → 「exactly **92** keys」防漂移断言 |
| 其中 Vue2 有权威 zh 值 | **92 / 92**(100% 命中) |
| 本期新造(Vue2 无源) | **0** |
| 🔴 en 值 ≠ 英文原串 | **2**(§A.0①) |
| 死键 | **0**(`conflictMessage` 的英文串按 N23 不进 i18n,不算死键;它从来不是 i18n 键) |
| 全角标点例外 | **1**(§A.5) |
| 带占位符键 | **9**,全 `{n}`(§A.6) |
| 危险撞车组 | **11 + 1 内部**(§A.7.1) |
