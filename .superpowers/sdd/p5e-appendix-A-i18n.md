# P5e 附录 A —— i18n 键表(T0 终值,**T1 照抄落地,不许自行改动**)

> 实测于 **2026-08-05**,蓝本锁 `NimoOS-UI@7a6ee6b7`。
> zh 权威源 = `git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/zh_CN.json`
> en 权威源 = `git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/en_US.json`(**覆盖值,不是 key** —— 承 E-31 / 裁定 R10)
> 本仓起点全表 = **zh 1595 / en 1595**(真实模块导入实测,与 P5d 收官一致)。
> ⚠️ **具体计数有保质期**(治理 §13-2),复现命令见 §A.9。

---

## A.0 总账

| 口径 | 数 |
|---|---|
| 蓝本 4 文件的静态 `$t('…')` 去重(SearchView 35 + FileDetailDrawer 23 + KFileViewer 2,7 处交叠) | **53** |
| `searchAggregate.js` 的 `i18n.t('(Untitled)')` | **1** |
| 动态过 `$t(变量)`:`MTIMES` 4 个 label + `SAMPLE_QUERIES` 5 个查询词 | **9** |
| 🔴 **本期 distinct 终值** | **63** |
| 其中 **复用既有 `aiKb*` 键** | **9** |
| 其中 **新增键** | **54** |
| zh 在 `zh_CN.json` 的命中率 | 🔴 **63/63 全命中,零自造** |
| en 在 `en_US.json` 的命中率 | 🔴 **63/63 全有覆盖条目**;其中 en 覆盖值 **≠** key 的:**0 条** |
| 🔴 **`FILE_TYPES` 的 5 个 label(`PDF`/`Markdown`/`TXT`/`DOC`/`Code`)** | **不进 i18n** —— 蓝本 `SearchView.vue:194-200` 是裸字面量、模板 `{{ t.label }}` **没过 `$t()`**;**照抄字面量** |

🔴 **协调者初测「53 静态 + 9 动态 + 1 util = 63」逐项复核完全成立**(53 是三个 `.vue` 去重后的静态并集,不是 SearchView 单个的 35)。

### 🔴 关于 E-53(上级设计 461 vs 协调者 408)—— 复扫结论:**上级设计是对的,不是勘误**

| 口径 | 数 |
|---|---|
| 上级设计 §2.4「蓝本 11 个 `.vue` 共 461 条去重 `$t()`」 | 461 |
| **T0 同口径复扫**:`/(?:\$t\|i18n\.t)\(\s*'((?:\\.\|[^\\'])*)'/g`(单引号),对蓝本 `views/AI/{Knowledge,Parser}` 全部 16 个 `.vue` 取「至少出现在一个 `.vue` 里」的去重集 | **462** |
| 放宽到单/双/反引号三种 | 465 |
| 含 `.js` helper(`i18n.t()`)的全量去重 | 469(单引号)/ 472(三种引号) |

→ **462 与上级设计的 461 只差 1 条**,量级完全吻合;协调者那个 **408** 是**扫法欠计**(未含跨行 `$t(\n '…')`、
`$t('…', { … })` 的多行写法、以及 `.js` helper),**不是上级设计错**。
🔴 **E-53 结案:登记为「协调者口径欠计」,上级设计 §2.4 无需订正。** 下游不许把 461 当勘误引用。
(承 P5d「凭想象补一个不存在的问题、烧 46 万 token」的教训 —— 这里只做了复扫,没有升级任何 finding。)

复现:
```bash
cd /home/nimo/NimoTech/NimoOS-UI
for f in $(git ls-tree -r --name-only 7a6ee6b7 src/views/AI/Knowledge src/views/AI/Parser \
           | grep -E '\.vue$' | grep -v __tests__); do git show 7a6ee6b7:$f; done \
  | grep -oP "(?:\\\$t|i18n\.t)\(\s*'(?:\\\\.|[^\\\\'])*'" | sort -u | wc -l
```

---

## A.1 复用判定(**只认 `aiKb*` 家族**,承 A-6 / A-1)

🔴 **双向撞车扫描(zh 撞车看 en / en 撞车看 zh)已跑完,结果如下。**
方法:真实模块导入 `src/i18n/{zh_cn,en_us}` → 建 value→keys 反查表 → 本批 63 个值双向查。
脚本 = 本附录 §A.9 的 `collide.mjs`。

### 复用(9)
| # | 键 | 蓝本 $t 串 | zh(权威值) | en(权威值) | 用处 |
|---|---|---|---|---|---|
| 1 | `aiKbClose` | `Close` | 关闭 | Close | FD |
| 2 | `aiKbSampleContract` | `contract from last year` | 去年的合同 | contract from last year | SV·SAMPLE |
| 3 | `aiKbSampleSkating` | `figure skating` | 羽生结弦 | figure skating | SV·SAMPLE |
| 4 | `aiKbStatusIndexed` | `Indexed` | 已收录 | Indexed | SV |
| 5 | `aiKbSampleIphone` | `iPhone setup` | iPhone 配置 | iPhone setup | SV·SAMPLE |
| 6 | `aiKbSamplePythonAsync` | `Python async` | Python 异步 | Python async | SV·SAMPLE |
| 7 | `aiKbSearch` | `Search` | 搜索 | Search | SV |
| 8 | `aiKbSampleThyroid` | `thyroid` | 甲状腺 | thyroid | SV·SAMPLE |
| 9 | `aiKbTry` | `Try` | 试试 | Try | SV |

### 新增(54)
| # | 新键 | 蓝本 $t 串 | zh(逐字照 zh_CN.json) | en(逐字照 en_US.json) | 用处 |
|---|---|---|---|---|---|
| 1 | `aiKbSrUntitled` | `(Untitled)` | (未命名) | (Untitled) | AGG |
| 2 | `aiKbSrMatchPill` | `{n} matches` | {n} 段匹配 | {n} matches | SV |
| 3 | `aiKbSrMatchTitle` | `{n} matching sections` | 命中 {n} 段 | {n} matching sections | SV+FD |
| 4 | `aiKbSrMoreHint` | `{n} more matching sections — click to view` | 还有 {n} 段相关内容 — 点击查看 | {n} more matching sections — click to view | SV |
| 5 | `aiKbSrEmptySub` | `A few things to try:` | 试试这些方式： | A few things to try: | SV |
| 6 | `aiKbSrQualityAccurate` | `Accurate` | 更准 | Accurate | SV |
| 7 | `aiKbSrAdvanced` | `Advanced` | 高级筛选 | Advanced | SV |
| 8 | `aiKbSrMtimeAny` | `Any` | 不限 | Any | SV·MTIMES |
| 9 | `aiKbFdBack` | `Back to results` | 返回结果列表 | Back to results | FD |
| 10 | `aiKbSrEmptyTipIndexed` | `Check whether the file has been indexed` | 检查文件是否已经收录 | Check whether the file has been indexed | SV |
| 11 | `aiKbFdCopied` | `Copied` | 已复制 | Copied | FD |
| 12 | `aiKbFdCopy` | `Copy content` | 复制内容 | Copy content | FD |
| 13 | `aiKbFdCopyFailed` | `Copy failed — please select manually` | 复制失败,请手动选择 | Copy failed — please select manually | FD |
| 14 | `aiKbFdDistillFailed` | `Could not queue this file` | 无法加入沉淀队列 | Could not queue this file | FD |
| 15 | `aiKbFdDistill` | `Distill into note` | 沉淀成笔记 | Distill into note | FD |
| 16 | `aiKbFdDownload` | `Download` | 下载 | Download | FD+FV |
| 17 | `aiKbSrDownloadFailed` | `Download failed` | 下载失败 | Download failed | SV |
| 18 | `aiKbSrAdvOn` | `Enabled` | 启用 | Enabled | SV |
| 19 | `aiKbSrQualityFast` | `Fast` | 快 | Fast | SV |
| 20 | `aiKbSrNoPath` | `File path unavailable` | 文件路径缺失 | File path unavailable | SV |
| 21 | `aiKbSrFileType` | `File type` | 文件类型 | File type | SV |
| 22 | `aiKbSrCountFiles` | `files` | 个文件 | files | SV |
| 23 | `aiKbFdSummary` | `Found {n} matching sections for "{query}", ranked by similarity` | 为「{query}」找到 {n} 段相关内容，按相似度排序 | Found {n} matching sections for "{query}", ranked by similarity | FD |
| 24 | `aiKbSrRelHigh` | `High` | 高 | High | SV+FD |
| 25 | `aiKbSrMtimeMonth` | `Last 1 month` | 近 1 月 | Last 1 month | SV·MTIMES |
| 26 | `aiKbSrMtimeWeek` | `Last 1 week` | 近 1 周 | Last 1 week | SV·MTIMES |
| 27 | `aiKbSrMtimeYear` | `Last 1 year` | 近 1 年 | Last 1 year | SV·MTIMES |
| 28 | `aiKbSrRelLow` | `Low` | 低 | Low | SV+FD |
| 29 | `aiKbSrCountMatches` | `matches` | 条匹配 | matches | SV |
| 30 | `aiKbSrRelMid` | `Mid` | 中 | Mid | SV+FD |
| 31 | `aiKbSrModified` | `Modified` | 修改时间 | Modified | SV+FD |
| 32 | `aiKbFdNextSection` | `Next section` | 下一段 | Next section | FD |
| 33 | `aiKbSrNoPreviewToast` | `No preview for this format — please download` | 该格式暂不支持预览，请下载查看 | No preview for this format — please download | SV |
| 34 | `aiKbSrEmptyTitle` | `No results found` | 没找到相关文档 | No results found | SV |
| 35 | `aiKbSrOpenFailed` | `Open failed` | 打开失败 | Open failed | SV |
| 36 | `aiKbFdOpenFile` | `Open file` | 打开原文件 | Open file | FD |
| 37 | `aiKbFdPage` | `Page {n}` | 第 {n} 页 | Page {n} | FD |
| 38 | `aiKbFdPassage` | `Passage` | 段落 | Passage | FD |
| 39 | `aiKbSrPopupBlocked` | `Popup blocked by browser` | 浏览器拦截了新窗口 | Popup blocked by browser | SV |
| 40 | `aiKbFvUnsupported` | `Preview not supported for this format` | 此格式暂不支持在线预览 | Preview not supported for this format | FV |
| 41 | `aiKbFdPrevSection` | `Previous section` | 上一段 | Previous section | FD |
| 42 | `aiKbFdDistillQueued` | `Queued for note distillation` | 已加入笔记沉淀队列 | Queued for note distillation | FD |
| 43 | `aiKbSrQuality` | `Ranking quality` | 排序质量 | Ranking quality | SV |
| 44 | `aiKbSrRerankWarn` | `Rerank unavailable, fell back to fast` | 排序质量暂不可用，已自动降级 | Rerank unavailable, fell back to fast | SV |
| 45 | `aiKbFdResults` | `Results` | 结果列表 | Results | FD |
| 46 | `aiKbSrEmptyTipAllowlist` | `Review the Allowlist rules` | 去「索引范围」看看规则 | Review the Allowlist rules | SV |
| 47 | `aiKbSrIdleTitle` | `Search anything in natural language` | 用自然语言搜索任何东西 | Search anything in natural language | SV |
| 48 | `aiKbSrErrorTitle` | `Search failed` | 搜索失败 | Search failed | SV |
| 49 | `aiKbSrPlaceholder` | `Search your documents…` | 搜你的文档… | Search your documents… | SV |
| 50 | `aiKbFdSection` | `Section {n}` | 第 {n} 段 | Section {n} | FD |
| 51 | `aiKbSrSimilarity` | `Similarity` | 相似度 | Similarity | SV+FD |
| 52 | `aiKbSrTopK` | `Top-K results` | 返回数量 | Top-K results | SV |
| 53 | `aiKbSrEmptyTipKeyword` | `Try a different keyword or shorter description` | 换一个关键词或更短的描述 | Try a different keyword or shorter description | SV |
| 54 | `aiKbSrIdleSub` | `Type anything in plain language — Nimo finds the matching documents on your NAS. Semantic matching, not just keyword.` | 输入任何自然语言，Nimo 在 NAS 上找到匹配文档。语义匹配，不只是关键词。 | Type anything in plain language — Nimo finds the matching documents on your NAS. Semantic matching, not just keyword. | SV |

### A.1.1 🔴 复用的 9 个键 —— 逐条为什么可以复用

| 键 | 现有消费点 | 语义是否同源 |
|---|---|---|
| `aiKbSampleThyroid` / `aiKbSamplePythonAsync` / `aiKbSampleContract` / `aiKbSampleIphone` / `aiKbSampleSkating` | `DashboardView.vue:67-73` 的 `SAMPLE_QUERIES` | ✅ **就是同一份 5 个示例查询词** —— 蓝本在 `DashboardView`(`:96`)与 `SearchView`(`:192`)里**各写了一份同值常量**,P5a 已把它们做成 5 个键。SearchView 复用同一批,零语义漂移 |
| `aiKbTry` | `DashboardView.vue:291` `.k2-suggest-label` 的「试试」 | ✅ SearchView idle 态 `:85` 的「试试」标签,**同一个词、同一个作用(建议 chip 上方的引导标签)** |
| `aiKbSearch` | `DashboardView.vue:163/182/287` 快捷入口格的「搜索」按钮 | ✅ SearchView `:18` 的搜索按钮。同区、同为动作按钮文案 |
| `aiKbClose` | `IndexedFilesView.vue:838` 横幅关闭按钮 | ✅ FileDetailDrawer `:10` `.k-modal-x` 的 `title="关闭"`。同区、同为关闭动作 |
| `aiKbStatusIndexed` | `IndexedFilesView.vue:355/851/898` 状态徽标「已收录」 | ✅ SearchView `:152` 结果卡 meta 的「已收录」徽标。**同区、同一个索引状态语义** |

### A.1.2 🔴 **拒绝复用**的同值键 —— 逐条理由(一律按 A-1 拒绝)

> **A-1 原文口径**:键名语义属于别的区,**将来那个区改文案会静默改掉搜索区**。

| 本批值 | 全表里同值的键 | 为什么拒绝 |
|---|---|---|
| `(Untitled)` / `(未命名)` | `aiUntitled` | `ai*` 无区词干 = Agent 区通用键,不在 `aiKb*` 家族 |
| `关闭` / `Close` | `filesViewerClose` · `filesUploadClose` · `searchClose` · `aiCfgClose` · `aiLightboxClose` · `aiMentionKbdClose` · `aiSlashKbdClose` | 文件区 / 全局搜索面板 / AI 设置 / 灯箱 / 提及气泡 / 斜杠菜单 —— 全是别的区。**本批用 `aiKbClose`** |
| `已复制` / `Copied` | `filesShareCopied` · `aiCopied` | 文件区分享 / Agent 区。**新建 `aiKbFdCopied`** |
| `复制失败,请手动选择` | `aiCfgCopyFailed` | AI **设置区**。**新建 `aiKbFdCopyFailed`**(⚠️ zh 值里是**半角逗号 `,`**,不是全角,照抄) |
| `下载` / `Download` | `filesDownload` · `filesCtxDownload` · `aiResDownload` | 文件区 ×2 / Agent 资源卡。**新建 `aiKbFdDownload`**(FileDetailDrawer 与 KFileViewer 共用这一个新键) |
| `启用` / `Enabled` | `aiCfgEnabled`(zh/en 双同) · `aiSkEnable`(en=`Enable`,不同) · `aiCfgChannelsEnabled`(zh=`已启用`,不同) | 前者是 AI 设置区;后两个连值都不同。**新建 `aiKbSrAdvOn`** |
| `高` / `High` | `appsSettingsCpuHigh` · `aiThinkingHigh` | 应用区 CPU 档 / Agent 思考强度档。**新建 `aiKbSrRelHigh`** |
| `低` / `Low` | `appsSettingsCpuLow` · `aiThinkingLow` | 同上。**新建 `aiKbSrRelLow`** |
| `中` / `Mid` | `appsSettingsCpuMedium`(en=`Medium`) · `aiThinkingMedium`(en=`Medium`) | 🔴 **连 en 值都不同**(`Medium` ≠ `Mid`)—— 复用会直接改掉界面文案。**新建 `aiKbSrRelMid`** |
| `条匹配` / `matches` | `aiMatchesLabel` | Agent 区。**新建 `aiKbSrCountMatches`** |
| `搜索失败` / `Search failed` | `aiCfgSearchFailed` | AI 设置区。**新建 `aiKbSrErrorTitle`** |
| `相似度` / `Similarity` | `aiSimilarity` | Agent 区。**新建 `aiKbSrSimilarity`** |
| `搜索` / `Search` | `topbarSearch` · `aiCfgSearch` · `aiCfgSearchBtn` · `aiKbNavSearch` | 前三个是别的区;`aiKbNavSearch` 虽在家族内但语义是 **rail 导航项标签**,不是按钮动作 → **选 `aiKbSearch`** |
| `高级` (en=`Advanced`) | `appsSettingsSectionAdvanced` | 🔴 **zh 不同**(`高级` vs 本批 `高级筛选`)。**新建 `aiKbSrAdvanced`** |

🔴 **`High`/`Mid`/`Low` 三条是本期最高危的复用诱惑**(治理 §7.1 点名):
它们既是 `relLabel()` 的返回值、又是通用词,且 `relLabel` 在 util 里走 **`i18n.global.t(...)`**
→ **键选错了 `SearchView` 与 `FileDetailDrawer` 两个组件同时静默错**。三条一律新建,已在上表定死。

---

## A.2 全角标点例外清单(`messageSyntax.test.ts` 的 (a) 项)

扫描正则 = `/[，；：？！（）]/`(**只这 6 个字符**)。
⚠️ **`。`/`「」`/`·`/`—`/`…`/`×` 都不在这个正则里** —— 但它们仍然必须**逐字节照抄**。

### A.2.1 命中那 6 个字符的 zh 值 —— **恰好 5 条**(强断言 `toBe` 钉死)

| # | 键 | zh 值 | 命中字符 |
|---|---|---|---|
| 1 | `aiKbSrEmptySub` | `试试这些方式：` | `：` |
| 2 | `aiKbFdSummary` | `为「{query}」找到 {n} 段相关内容，按相似度排序` | `，` |
| 3 | `aiKbSrNoPreviewToast` | `该格式暂不支持预览，请下载查看` | `，` |
| 4 | `aiKbSrRerankWarn` | `排序质量暂不可用，已自动降级` | `，` |
| 5 | `aiKbSrIdleSub` | `输入任何自然语言，Nimo 在 NAS 上找到匹配文档。语义匹配，不只是关键词。` | `，` |

🔴 **`aiKbSrIdleSub` 的真值(逐字节)**:`输入任何自然语言，Nimo 在 NAS 上找到匹配文档。语义匹配，不只是关键词。`
—— 两个 `，` + 两个 `。`。**上表第 5 行如与本行有出入,以本行为准。**

### A.2.2 不在正则里、但同样必须逐字照抄的字符

| 键 | zh 值 | 特殊字符 |
|---|---|---|
| `aiKbSrMoreHint` | `还有 {n} 段相关内容 — 点击查看` | **`—`**(U+2014 em dash,两侧各一个半角空格) |
| `aiKbFdSummary` | `为「{query}」找到 {n} 段相关内容，按相似度排序` | **`「` `」`**(U+300C / U+300D) |
| `aiKbSrEmptyTipAllowlist` | `去「索引范围」看看规则` | **`「` `」`** |
| `aiKbSrPlaceholder` | `搜你的文档…` | **`…`**(U+2026 单字符,不是三个点) |
| `aiKbSrIdleSub` | 见 A.2.1 | **`。`** ×2 |
| 🔴 `aiKbFdCopyFailed` | `复制失败,请手动选择` | 🔴 **半角逗号 `,`**(U+002C)—— **不是全角**,不许「顺手改成全角」 |

### A.2.3 en 侧的 em dash

`aiKbSrMoreHint` / `aiKbSrNoPreviewToast` / `aiKbFdCopyFailed` / `aiKbSrIdleSub` 的 **en 值里也有 `—`**
(`— click to view` / `— please download` / `— please select manually` / `plain language — Nimo`)。
逐字照 `en_US.json`。

---

## A.3 占位符清单(`messageSyntax.test.ts` 的 (b) 项)

| 键 | 占位符 | key/zh/en 三处集合是否一致 |
|---|---|---|
| `aiKbSrMatchPill` | `{n}` | ✅ |
| `aiKbSrMatchTitle` | `{n}` | ✅ |
| `aiKbSrMoreHint` | `{n}` | ✅ |
| `aiKbFdPage` | `{n}` | ✅ |
| `aiKbFdSection` | `{n}` | ✅ |
| 🔴 `aiKbFdSummary` | **`{n}` + `{query}`** | ✅ —— **本期唯一的双占位符键** |

- 全批**零 `@` 零 `|`** → **不需要 `{'@'}` 转义**(实测扫过 key/zh/en 三列)。
- 🔴 **E-45 提醒**:vue-i18n 对未匹配占位符是**静默替换成空串**,不会留字面量 `{m}`
  → **反向断言不许写「渲染结果含 `{x}` 字面量」**(零判别力),要断**真实插值出来的值**。
  例:`t('aiKbFdSummary', { n: 3, query: 'x' })` 的 zh 结果必须**逐字**等于
  `为「x」找到 3 段相关内容，按相似度排序`。
- ⚠️ `aiKbFdSummary` 的 **en 值里有两个半角双引号**(`for "{query}",`)—— TS 里用单引号包裹字符串即可,
  **不许改成全角引号、也不许转义成 `\"` 之外的形式**。

---

## A.4 T1 的落地要求(照抄即可)

1. 54 个新键**同时**加进 `src/i18n/zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 自动断言键集一致)。
2. `messageSyntax.test.ts` 只圈本批键:
   - (a) 全角标点例外 = **A.2.1 的 5 个键**,`toBe` 钉死确切值;
   - (b) 占位符集合一致 = **A.3 的 6 个键**;
   - (c) 「exactly **N** keys」防漂移 —— 🔴 **N 由 T1 自己用真实模块导入现测**
     (起点 1595,本批 **+54**,§0.2 又 **−1**(`aiCfgKnowledgeSoon`)→ **预期 1648**;
     🔴 **预期值仅供对账,以实测为准,不许用算式代替实测**)。
3. 🔴 **en 侧不许假设「en = key」**(承 E-31 / R10 / E-44)。
   本批**恰好** 63/63 的 en 覆盖值都等于 key —— **这是实测结论,不是假设**:
   verify 脚本仍必须**从 `en_US.json` 读**,不许用 key 顶替。
   ⚠️ 因为「等于」,**本批无法配「en ≠ key」的反向断言**(没有素材)→ 反向断言改成:
   **断言 verify 脚本读到的 en 值来源确实是 `en_US.json`**(把 JSON 里某个键的值临时改掉 → 脚本必须报红)。
4. 🔴 **必跑程序化逐码点比对脚本** `p5e-task-1-i18n-verify.mjs`(照 `p5d-task-1-i18n-verify.mjs`)。
   P5a-T8 的教训:附录零差异,手抄进 TS 时引入 5 处全角标点错。
5. **D-4 沿用**:本批新键照 P5a–P5d 的既定模式(vitest 侧仅存在性断言 + 一次性 verify 脚本逐码点),
   **不在本期反转**;T1 报告要写清「54 条里有几条只有存在性断言」。

---

## A.5 🔴 `FILE_TYPES` —— 明确不进 i18n

蓝本 `SearchView.vue:194-200`:
```js
const FILE_TYPES = [
  { id: 'pdf',  label: 'PDF',      icon: '📕' },
  { id: 'md',   label: 'Markdown', icon: '📝' },
  { id: 'txt',  label: 'TXT',      icon: '📃' },
  { id: 'doc',  label: 'DOC',      icon: '📚' },
  { id: 'code', label: 'Code',     icon: '💻' },
]
```
模板 `:37` 是 `<span>{{ t.icon }}</span> {{ t.label }}` —— **没有 `$t()`**。
→ **5 个 label + 5 个 emoji 全部照抄字面量,一个都不进语言包。**
⚠️ 对照:同一个文件里的 `MTIMES` label(`:210-215`)**过了 `$t(m.label)`**(`:47`)、
`SAMPLE_QUERIES`(`:192`)**过了 `$t(s)`**(`:90`)→ 那 9 条进 i18n。**三张常量表口径不同,别搞混。**

---

## A.6 死键审计

- 本批**零死键**:63 个值全部有生产消费点。
- §0.2 要删的 `aiCfgKnowledgeSoon` 是 P5d-T9 反转留下的死键,**与本批 63 个无关**,由 T1 一并处理。

---

## A.7 键名词干规范(治理 §7)

| 词干 | 归属 | 本批数 |
|---|---|---|
| `aiKbSr*` | `SearchView.vue` 专属 | 37 |
| `aiKbFd*` | `FileDetailDrawer.vue` 专属 | 16 |
| `aiKbFv*` | `KFileViewer.vue` 专属 | 1 |
| 无词干 `aiKb*` | 复用的既有键 | 9 |

⚠️ `aiKbFdDownload` 同时被 `KFileViewer.vue:19` 用(两处都是「下载」按钮)——
**一个键两处消费,不为 KFileViewer 再造一个 `aiKbFvDownload`**(同值同语义,同区)。

---

## A.8 起点全表实测

```
zh 1595 / en 1595   (真实模块导入,差集均空)
aiKb* 家族          387
```

## A.9 复现命令

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# 全表键数(真实模块导入,文本解析会少算 —— 治理 §9.3 第 2 条)
cat > /tmp/dump.test.ts <<'EOF'
import { it } from 'vitest'; import fs from 'node:fs'
import zh from './src/i18n/zh_cn'; import en from './src/i18n/en_us'
it('dump', () => { fs.writeFileSync('/tmp/p5e-zh.json', JSON.stringify(zh)); fs.writeFileSync('/tmp/p5e-en.json', JSON.stringify(en)) })
EOF
cp /tmp/dump.test.ts ./p5e-dump.test.ts && pnpm exec vitest run p5e-dump.test.ts && rm ./p5e-dump.test.ts
node -e "const z=require('/tmp/p5e-zh.json'),e=require('/tmp/p5e-en.json');console.log(Object.keys(z).length,Object.keys(e).length)"

# 本批 63 个键的提取(蓝本侧)
#   见 T0 报告 §5 的 scan-p5e.mjs / propose.mjs / collide.mjs(脚本原文已贴进报告)
```
