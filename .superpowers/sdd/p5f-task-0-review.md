# SP8-P5f · T0 独立评审(评审者自测,零采信实现者报告)

> 评审者:独立评审(opus)· 日期 **2026-08-06** · 被评对象:`bd86566`(起点 `6d67b7b`)
> 🔴 **本评审的每一条结论都由评审者自己跑命令得出**;T0 报告只当「待验清单」用。
> 本评审**零 `src/` 改动**、零 `checkout/stash/reset/rebase`、`NimoOS-UI` 只做 `fetch`(不改工作树)。

## 0. 结论速览

| 级别 | 条数 |
|---|---|
| **Critical** | **0** |
| **Important** | **5**(I-1 … I-5) |
| **Minor** | **6**(M-1 … M-6) |

**T0 的 13 条 DoD 全部落地,主体结论(a)–(m) 我逐条复核后 12 条完全同意、1 条(E-67 的推理)结论对但理由站不住。**
**没有发现「凭想象补的不存在问题」**,也没有发现被「顺手修正」的 N 条目。
**两个 `NEEDS_CONTEXT` 我都同意 T0 的建议**(见 §4),并各补了一条 T0 没写的落地约束。

---

## 1. 第一必查项(计划书指定)—— 我自己动手的结果

### 1.1 🔴 附录 A 的 zh/en 有没有「自己译的」—— **程序化逐码点比对:零条**

自写脚本(不复用 T0 的任何产物),从蓝本锁直接取权威源:

```bash
git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/zh_CN.json  > bp/zh_CN.json
git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/en_US.json  > bp/en_US.json
node verifyA.mjs      # 解析附录 A §A.6 的 90 行表格 → 与两份 JSON 逐码点比对
```

输出:
```
=== static $t() distinct keys: 83
per-file counts: {"AllowlistView.vue":36,"RootsView.vue":31,"WikiView.vue":20,"wikiViewHelpers.js":0}
=== appendix rows parsed: 90
=== zh/en mismatches: 0
=== en value === key for 90 / 90
=== full en_US.json: total 2676 , value!=key: 308
=== static keys NOT in appendix: []
=== appendix keys not statically found (should be the 7 dynamic):
    ["Documents","Text","Code","Added","Updated","Removed","Renamed"]
=== placeholder set: ["ext","group","h","n","path","t"] keys with ph: 9
=== fullwidth-hit keys: 9
```

逐条判定:

| 必查点 | 我的结论 |
|---|---|
| **90 条 zh/en 有没有自己译的** | 🟢 **零条**。90 行全部与 `zh_CN.json` / `en_US.json` **逐码点相等**(含全角标点、`—`、`…`、`；`) |
| **en 侧有没有犯 E-44** | 🟢 **没有**。我从 `en_US.json` 独立读取比对 → 90/90 相等。⚠️ **本期 en 恰好 = key**(90/90),而全表 2676 键里 **308 条(11.5%)值 ≠ 键** —— T0 的 §A.0.1 把这条「巧合而非保证」写清楚了,**结论与我实测完全一致** |
| **「不进 i18n」的判定** | 🟢 **属实**。`WikiView.vue:101` / `:123` 的 `<span class="kw-sec-en">Contents</span>` / `Recent changes` 与相邻 `kw-sec-title` 的 `{{ $t('Contents') }}` **是并排两个元素**,前者确实**没过 `$t()`**(我逐行读了 `:95-130`)。T0 新扫到的 `:59` `<span class="k2-tag">TREE</span>` **也属实**,协调者清单里确实没有 |
| **`OP_LABEL_KEYS` 4 值 + `GROUPS_TEMPLATE` 3 个 `labelKey`** | 🟢 **7 个全在附录里**。且我的静态扫描证明:附录 90 条里**恰好只有这 7 条**在模板里搜不到 —— 一条不多一条不少。蓝本原文实测 `WikiView.vue:156 OP_LABEL_KEYS = { create:'Added', modify:'Updated', delete:'Removed', rename:'Renamed' }`、`AllowlistView.vue:160/162/164 labelKey: 'Documents'/'Text'/'Code'` |
| 逐页 distinct | 🟢 **36 / 31 / 20**,去重 83,与附录 §A.0 逐字一致 |
| `wikiViewHelpers` i18n | 🟢 **0**(我自己扫 `$t(` 与 `i18n.t(` 都是 0)⇒ **E-65 结案成立** |
| 占位符 | 🟢 **恰好 `{ext,group,h,n,path,t}` 6 个 / 9 条键**,两档占位符集合逐条一致 |
| 全角标点例外 | 🟢 **恰好 9 条**,与 §A.5 逐条同 |

### 1.2 🔴 附录 D 的 67 类三态 —— **我自己用完整 token 精确匹配重算**

🔴 **禁 `\b`。** 我用的口径:`/\.([a-zA-Z][a-zA-Z0-9_-]*)/g` 提取选择器 token(与守卫代码同款),
判「已搬」时先跑测试文件**自带的** `stripComments()`。

```
三段(:985-1160 / :1342-1400 / :2453-2561)distinct token = 84
  减去 3 个注释里的伪 token(`css` `md` `wiki`,来自 :2454 的 "knowledge-wiki.css" 与
  :2488 的注释 "rendered .wiki.md content")             → 81   ✅ 与附录 §D.0 一致
  其中死类命中 = 6(.k-progress-*)                        ✅
  其中已搬 = 6(k-btn / k-confirm-body / k-set-card /
              k-set-row / k2-tag / knowledge-app)         ✅
  ⇒ 本期必搬 = 81 − 6 − 6 = 69                            ✅
  拆分:k-* 27 · kw-* 41 · cur 1                           ✅ 与 §D.7.1/2/4 逐字一致
  外加 RootsView <style scoped> :223-289 的 kr-* 9 个       ✅(我逐行读了这 67 行)
  ⇒ 合计新增 78                                            ✅
```

**`.k-section-body` / `.k-frow` 的三态 —— 我自己先得结论再对报告:**

| 类 | 精确 token 扫本仓 `.vue` | 扫本仓 `.scss`(剥注释前) | 扫本仓 `.scss`(剥注释后) | **我的三态** | 与 T0 |
|---|---|---|---|---|---|
| `k-section-body` | 0 | 3 | **0** | **未搬** | 一致 |
| `k-frow` | 0 | 4 | **0** | **未搬** | 一致 |

我逐条回读那 3/4 处命中,确认**全部落在前几期「为什么故意不搬」的说明性注释里**
(`knowledge.scss:64` `:1294-1295` `:20` `:1578` `:1610` `:1640`)——
**T0 说「不是 `\b` 假阳性,是注释假阳性」是对的**,协调者的猜测方向对、根因错。
另外我确认 `\b` 假阳性也真实存在(`k-frow-f` 一族在 `IndexedFilesView`)。

🔴 **补一条 T0 与协调者都没做的核查(我做了)**:把三页蓝本模板用到的**全部 110 个 class token**
减去「本仓已有 + 本期三段 + kr-*」→ **余集为空**,即本期搬完后**没有任何一个类会缺定义**。

### 1.3 🔴 `WHITELIST_348` / `NON_K_HELPER_CLASSES` 本期终值 —— **我自己重跑,没跑 T0 的脚本**

我把 `knowledgeStyles.test.ts` 的 `stripComments()` / `NEW_RE` / `nonKClassNames()` **逐字复制**出来跑:

```
current NEW_RE hits (unique): 347
current nonKClassNames: 19 ["chev","danger","dot","ghost","h-md","lbl","mono","outline","path",
                            "primary","right","second","sep","spacer","spin","suffix","text","warn","wide"]
WHITELIST_348 length: 348 unique: 348
WHITELIST entries NOT matched by NEW_RE on file: ["knowledge-app"]   ← 348 vs 347 那 1 差的真因
NEW_RE hits not in WHITELIST: []
fb* in WHITELIST: ["fb","fb-crumb","fb-crumbs","fb-err","fb-list","fb-name","fb-row","fb-stub"]

NEW_RE .kw-split   -> null      NEW_RE .kr-empty -> null      NEW_RE .cur -> null
NEW_RE .k-frow     -> ".k-frow" NEW_RE .k2-tag   -> ".k2-tag"  NEW_RE .kn-badge -> ".kn-badge"

Plan A: WHITELIST 375  NON_K 70      (348+27 / 19+41+9+1)
Plan B: WHITELIST 425  NON_K 20      (348+27+41+9 / 19+1)
old ⊆ new(把 k(?:2|n)?- 扩成 k(?:2|n|r|w)?-)missing: []   newSize 347
```

🟢 **`348 ≠ 347` 那 1 差我独立确认真因就是 `knowledge-app`**(`NEW_RE` 扫不到它)—— **不许修平,判定与 T0 一致。**
🟢 **两个方案的四个数字与 T0 逐字一致**(我先算再看的报告)。
🟢 **`NEW_RE` 确实既不认 `kw-` 也不认 `kr-`** —— 计划书只预料到 `kr-`,T0 多找出 `kw-` 这一半是**真发现**。

---

## 2. 逐条复核 T0 自报的结论(a)–(m)

| # | T0 主张 | 我的复核 | 判定 |
|---|---|---|---|
| **a** | 远端 `2608bf9b`,4 个蓝本文件 md5 相同,`knowledge.scss` 唯一差异是 `:1675` 一行注释 | 我自己 `git fetch git@github.com:NimoTech/NimoOS-UI.git main` → `FETCH_HEAD = 2608bf9b370b8b0c073f160177a8c0d496256075`;自己 md5:4 个文件 **SAME**;自己 `diff` scss → **唯一 hunk 在 `:1675`**,内容 `已收录文件 · Indexed Files page …` → `Indexed Files page …`,**是注释、且 1675 落在 1400 与 2453 之间的空隙**,不在本期三段内 | 🟢 **完全属实,不需要停下问用户** |
| **b** | 四门 335/4254/0/0,`.vue` 185、color-guard 187、`aiKb*` 441、全表 1648 零偏差 | 我全量重跑:`Test Files 335 passed` / `Tests 4254 passed` / `grep -cE '^ *(FAIL\|×)' = 0`;`vue-tsc exit=0`;`pnpm build exit=0`;`sass exit=0`;`find src -name '*.vue' \| wc -l = 185`;`vitest run src/styles/color-guard.test.ts → Tests 187`;**真实模块导入**计键数 → `zh 1648 / aiKb* 441`、`en 1648 / aiKb* 441`、`zh\en = 0` `en\zh = 0` | 🟢 **八项零偏差** |
| **c** | `/roots`·`/tree`·`/node` 90 s 超时 0 字节;`/candidates` 200 `[]`;`/raw` 200 | 我自己直连 `$(cat /var/run/nimoos/wiki.url)` = `http://127.0.0.1:41373`(**未经网关**,零写请求):`/v1/wiki/NOSUCHROUTE` → **HTTP 404 in 0.000908s**(证明服务活着、路由表在响应);`/roots` → `curl (28)` **30.002 s / 0 字节 / 输出文件根本没被创建**;`/tree` `/node?path=/DATA` 同(25 s / 0 字节 / 无文件);`/candidates` → **HTTP 200 0.000756s size=3**,body `[]`;`/raw?path=/DATA` → **HTTP 200 size=3430** 且与 `wiki-raw-DATA.REAL.md` **md5 逐字节相同(`c0449363eb1069a36c9941a0fb842e18`)** | 🟢 **属实。「空是真的空」的取证方式(未知路由秒回 404 + 用全新输出文件)我复现并认可** —— 🔴 T0 在报告 §3.2-C 主动留痕的「curl 收 0 字节不创建文件导致上一条 `[]` 残留」是**真实存在的坑**,我复测时同样观察到文件未创建 |
| **d** | `NEW_RE` 不认 `kw-`/`kr-`;方案 A 375/70、方案 B 425/20;`fb-*` 是逐字同款先例 | 见 §1.3(全部自测复现)。**`fb-*` 先例我逐行读了**:`NEW_RE` 里有独立的 `fb(?:-[a-zA-Z0-9-]+)?` 分支 · 8 个 `fb*` 类**确实在 `WHITELIST_348` 里** · `nonKClassNames` 里有 `!/^fb(?:-\|$)/` **排除条件** —— **三件套齐全,与方案 B 提议的做法同构** | 🟢 **全部属实**。我的推荐见 §4.1 |
| **e** | P5b 判的 `.k-frow` `@media` 死规则前提到期(`AllowlistView:69,75` 在用 `class="k-frow"`) | 我自己读蓝本 `AllowlistView.vue:69` = `<div class="k-frow k-frow-head">`、`:75` = `<div v-for=… class="k-frow">`;自己读蓝本 `knowledge.scss:1500-1503` = `@media(max-width:860px){ .k-frow{ grid-template-columns:80px 1fr 70px 28px; font-size:12px } }`;**自己找到 P5b 判据原文**,在本仓 `knowledge.scss:1610-1611`:「`:1500-1503` 的 `.k-frow` 仍不搬(**两个模板里没有任何元素用 `class="k-frow"`**,文件表格行用的是 `.k-frow-f`,是死规则)」 | 🟢 **前提确实到期,判定成立**。我的推荐见 §4.2 |
| **f** | 段边界应取 `:985-1141` 与 `:1342-1396` | 我逐行读了 `:978-1170` 与 `:1336-1406`:`.k-priority-hint` 闭合于 **`:1139`**,`:1141` 是 `/* Settings page */` 注释,**`:1142-1149` 是已搬的 `.k-set-card`**,`:1152-1157` 是 6 个死类,**`:1159-1165` 是已搬的 `.k-set-row`** ⇒ **`:985-1141` 正确**。`.k-radio-card-desc` 闭合于 **`:1396`**,**`:1398` 起是 `.k-confirm-body`,本仓 `knowledge.scss:1541` 已有** ⇒ **`:1342-1396` 正确** | 🟢 **两条边界订正都属实且必要**,但 **附录 D 的汇总表自己写错了 → 见 I-1** |
| **g** | rail 序号 3/7/8 | 我自己读蓝本 `KnowledgeLayout.vue:104-114` 的 `NAV` 数组:`1 dashboard · 2 search · 3 wiki · 4 notes · 5 indexed-files · 6 queue · 7 roots · 8 allowlist · 9 settings`;本仓 `views/KnowledgeLayout.vue:55-63` **顺序完全相同** | 🟢 **3/7/8 属实,计划书的 3/6/7 是错的** |
| **h** | `toggle()` 不是蓝本 bug | 我自己读蓝本 `RootsView.vue:163-173` 与本仓 `knowledgeStore.ts:736-747`(**未看 T0 的推演先自己判**):`setRootEnabled` 在 `await` **之前**执行 `root.enabled = enabled`;`roots` computed 直接返回 `store.state.wikiRoots`,`v-for` 的 `r` 与 `find()` 命中的是**同一个对象**;失败路径先回滚 `root.enabled = prev` **再 `throw`** ⇒ 走 catch、**那行 toast 根本不执行** | 🟢 **结论一致:不是 bug**。且我认同 T0 追加给 T5 的守卫要求(见 §5) |
| **i** | E-66 ~ E-73 | 逐条复核见 §3 | 🟢 **8 条里 7 条完全属实、1 条(E-67)结论对但理由站不住(M-5);另有 2 条 T0 漏掉的勘误 → I-2 / I-3** |
| **j** | fixtures 三级出处标签 | `wiki-raw-DATA.REAL.md` **md5 与我现抓的一致** ✅;`allowlist-*.REAL.json` 与我现抓的**内容等价**(`diff <(json.tool 新抓) <(json.tool fixture)` → 无差异)但**md5 不同 = 被重排版了**(→ M-3);`allowlist-extensions.REPLAYED.json` 的加工**在文件内 `__meta.built_from` 里显式申报了**(「取其中 6 条,只把部分 enabled 由 1 改成 0,字段名/类型/source 一字未动」)✅ **承 R3-Imp-2 已兑现**;`wiki-tree.CONSTRUCTED.json` **确实含 crossLevel(`/a` + `/a/b/c`,缺 `/a/b`)与 missingParent(只有 `/x/y/z`)两种拓扑**,另有 duplicate / unsorted 共 5 份 ✅;每份 `.CONSTRUCTED` 的 `__meta.built_from` 都写了 Go 坐标 ✅ | 🟢 **主体属实**,两条 Minor 见 M-3 / M-4 |
| **k** | 零新依赖逐项实证 | `createRootBody`:我自己读 `../NimoOS-Service/src/wiki.ts:136`,签名 `{path, watchMode?, scanIntervalH?, mirror?} → { Path, Level:'space', WatchMode, StorageMode: mirror?'mirror':'inline', ScanIntervalS: Math.max(1,round(h))*3600 }`,`src/index.ts:28` re-export ✅ **T0 抄录逐字正确**;`setRootEnabled`(store action)vs `patchRootEnabled`(`service.wiki` 的 HTTP 方法)= 包关系 ✅;**KIcon 我自己提取 `PATHS` 键 = 42 个**,本期三页用到的 15 个(含常量里的 `edit`/`code`)**逐个都在**,`refresh` ✅ `layers` ✅ `drive` ✅ `plus` ✅ `code` ✅ `danger` ✅ `info` ✅ | 🟢 **不需要 `NEEDS_CONTEXT`,`KIcon.vue` 维持零改动** |
| **l** | Vue2 spec 归属四份 | 我自己 `git ls-tree -r --name-only 7a6ee6b7` 列蓝本 `__tests__/` **全 15 个文件**:`dashboardHelpers / dashboardWikiViews / fileDetailDrawerDistill / folderBrowser / indexedFiles / knowledgeStoreRoots / noteEditHelpers / notesMapper / notesService / notesView / queueDistillScope / searchAggregate / settingsViewRootPicker / wikiRoots / wikiViewHelpers` —— **`allowlist*` 一个都没有** ✅。`wikiRoots.spec.js` 我打开读了:`import { normalizeRoot, createRootBody, normalizeTreeNode, normalizeNode } from '@/service/wiki.js'`,**测的确实是纯函数不是 `RootsView`**,共 7 个 `it`;共享包 `NimoOS-Service/src/wiki.test.ts:68` 的 describe 原文就是「wiki 纯函数(移植 Vue2 wikiRoots.spec.js)」 ✅;`knowledgeStoreRoots.spec.js` → 本仓 `knowledgeStore.notesWiki.test.ts:184` describe 原文「wiki 索引根(移植 Vue2 knowledgeStoreRoots.spec.js)」 ✅ | 🟢 **E-68 成立,四份判定全部属实** |
| **m** | `src/` 零改动 | `git diff --name-only 6d67b7b bd86566 -- src/` → **空**;`git status --porcelain -- src/` → **空**;`git diff --name-only 6d67b7b bd86566` → **15 个文件全在 `.superpowers/sdd/`** | 🟢 **属实** |

---

## 3. 勘误逐条复核 + T0 漏掉的两条

| # | 我的复核 | 判定 |
|---|---|---|
| **E-66**(起点 `6d67b7b`) | `bd86566^ = 6d67b7b` ✅,`bae5d44` 在其前两代 | 🟢 属实 |
| **E-67**(67 → 69) | **结论对**(我独立算得 69),**但理由站不住** → **M-5** | 🟡 结论采纳、理由需订正 |
| **E-68**(`wikiRoots.spec.js` 测的是纯函数) | 见上表 (l) | 🟢 属实 |
| **E-69**(段边界) | 见上表 (f) | 🟢 属实且重要 |
| **E-70**(rail 3/7/8) | 见上表 (g) | 🟢 属实 |
| **E-71**(`white` 三处) | 我自己扫:模板 `AllowlistView.vue:30` `color="white"` + scss `:1003` `.k-extgroup-icon { color: white }` + scss `:1045` `&[data-on="true"] .k-ext-chip-mark { color: white }` = **恰好 3 处** | 🟢 属实 |
| **E-72**(K54 是 2 处不是 3 处) | 我自己 grep 蓝本 `RootsView.vue` 全文色字面量 → **只有 `:243` 与 `:254` 两行**,均为 `var(--x, rgba(127,127,127,…))` | 🟢 属实 |
| **E-73**(`--bg-tertiary` 兜底一直在生效) | `grep -rn -- "--bg-tertiary" src/` → **只有两条注释,零声明**;`--border` → **只在 `theme.css:52`(暗)/ `:267`(亮)有声明,`knowledge.scss` 的 `.knowledge-app` 映射层里零声明** | 🟢 属实。K54-③ 原文那句「兜底本是死代码」对 `--border` 成立、对 `--bg-tertiary` 不成立 |
| 🔴 **T0 漏掉的** | N54 的「12+13+**24**」实测是 **12+13+25** | **I-2** |
| 🔴 **T0 漏掉的** | 报告 §10.1 的三组命中数 9/13/20 实测是 **11/12/21**,且 `.wps` 一组都不匹配 | **I-3** |

---

## 4. 两个 `NEEDS_CONTEXT` —— **我自己的推荐**

### 4.1 N-1(`kw-*`/`kr-*` 不被 `NEW_RE` 认)—— 🔴 **我推荐方案 B(WHITELIST 425 / NON_K 20)**

**理由(全部我自己验过,不是复述 T0)**:

1. **`fb-*` 先例是逐字同构的**,不是类比:`NEW_RE` 里有独立 `fb` 分支 · 8 个 `fb*` 在 `WHITELIST_348` 里 ·
   `nonKClassNames` 里有 `!/^fb(?:-|$)/` 排除条件 —— **三处齐全**,方案 B 要做的正是同样三件事。
2. **`NON_K_HELPER_CLASSES` 的语义确实被写死了**:我读到那条断言的原文标题是
   「防清单变垃圾桶」、注释原文「这份清单**不许当垃圾桶塞**」,而现存 19 项全是 `ghost/right/mono/spin/warn` 这类
   **单词级嵌套辅助类**。方案 A 会往里塞 50 个正经前缀类 = 把它变成它要防的东西。
3. **扩范围是加固不是放宽**:我实测 `old ⊆ new`(把 `k(?:2|n)?-` 扩成 `k(?:2|n|r|w)?-`)**零类逃逸**,
   新旧命中集大小都是 347。

🔴 **我补一条 T0 没写的落地约束**:本仓 `knowledgeStyles.test.ts:297-305` 有一条**已存在的「严格超集自证」**用例,
里面把 `OLD_RE` / `NEW_RE` **两个正则都硬编码**了。方案 B 落地时**必须同步改那条用例**(把当前的 `NEW_RE` 降为 `OLD_RE`、
扩展版升为 `NEW_RE`),并在 T2 报告里贴**真文件上**的 `old ⊆ new` 输出 —— 否则那条用例会变成对着两个旧正则空转的空壳。
按 §9.10,这属于「被迫改上一刀已过评审的断言」,要给程序化证明。

### 4.2 N-2(P5b 判的 `.k-frow` `@media` 死规则)—— 🔴 **我推荐:搬**

**理由**:P5b 的判据原文我逐字读到了(本仓 `knowledge.scss:1610-1611`),它是一条**有明确前提的条件判定**
(「两个模板里没有任何元素用 `class="k-frow"`」),而 `AllowlistView.vue:69,75` 在本期把这个前提直接推翻。
不搬 ⇒ 窄屏(≤860px)下白名单页的文件夹规则表列宽与 Vue2 不一致,**「界面 1:1」在这一档不成立**,
而这正是 P5f 引入 `k-frow` 的**直接连带**,不是别期的存量。

落地口径(照 P5b-T2 处理 `.k-row` 的同款做法):
- 规则加进**本仓既有的** `@media (max-width: 860px)` 块(`knowledge.scss:1579`),**不另起新块**;
- `WHITELIST` 数字**不变**(`k-frow` 已在 §D.7.1 的 27 个里);
- 🔴 **我补一条 T0 没写的**:本仓 `knowledge.scss:1578` / `:1610-1611` / `:1640` **三处注释**目前都白纸黑字写着
  「`.k-frow` 是死规则,不搬」。搬了之后这三句就成了**留在代码里的假陈述**,
  **T2 必须一并订正这三处注释**(按「反转不删」惯例:原文留成注释 + 加本期时点与理由),
  否则下一期读到的仍是旧结论。

### 4.3 N-3(`Delete` / `Auto` / `Removed` 的复用判断)—— **我支持按 A-1 新建**

我的双向撞车扫描确认这三条**两档都撞**,但撞的键分别属于 Notes 区(`aiKbNtDelete`)、来源/设备语义
(`aiKbOriginAuto`/`aiKbDeviceAuto`)、索引文件状态(`aiKbStatusRemoved`)—— **语义域确实不同**。
按 A-1 新建 `aiKbRtDelete` / `aiKbRtWatchAuto` / `aiKbWkOpRemoved`,则**可复用 11 / 新增 79**。

---

## 5. Important(5 条)

### 🟡 I-1 —— 附录 D §D.3 的汇总表把 Allowlist A 段边界写成 `:985-1151`,与它自己 §D.3.1 的 `:985-1141` 矛盾

**这正是计划书点名「最危险」的那一条。** 附录 D 是 T2 的**最高权威文档**(权威序在计划书之上),
而它的**汇总表**(T2 第一眼会看的那一行)写的是:

> `| Allowlist A | :985-1160 | 🔴 :985-1151 | 段尾 :1152-1160 压着 6 个 .k-progress-* 死类 …`

紧接着两段之后的 §D.3.1 却给出 `⇒ :985-1160 里真正要搬的是 :985-1141`,报告 §7.3 也写 `:985-1141`。

**我的实测(逐行读蓝本 `:978-1170`)**:

```
:1139  }              ← .k-priority-hint 闭合(A 段真正的最后一行规则)
:1141  /* ---------- Settings page ---------- */
:1142  .k-set-card {  ← ✅ P5c-T2a 已搬(本仓 :1325)
:1152-1157  .k-progress-*  ← ⛔ 6 个死类
:1159  .k-set-row {   ← ✅ P5c-T2a 已搬(本仓 :1334)
```

⇒ **按表里的 `:985-1151` 搬会带进 `.k-set-card` 的重复定义。** 而重复定义**不会被死类白名单捕获**,
只有区间锚定的计数断言会响 —— 正是计划书警告的「实现者极可能误判成白名单数字错了而去改白名单」的触发条件。

**影响哪一刀**:T2。
**建议处置**:🔴 **T2 开工前必须订正附录 D §D.3 表格里的 `:985-1151` → `:985-1141`**(顺带把 `:1141` 那行
`/* Settings page */` 注释也排除,搬进来会误导),并在 T2 brief 里**只写 `:985-1141`,不给第二个数字**。

---

### 🟡 I-2 —— N54 的扩展名表计数「12 + 13 + **24**」实测是 **12 + 13 + 25**,T0 没纠

治理 §3.5 的 N54 与计划书 T4-4 都写「照抄那三张 `match` 扩展名表逐字(共 **12+13+24** 项)」。
我程序化数了蓝本 `AllowlistView.vue:161/163/165` 的三个数组:

```
docs 12    text 13    code 25
```

`code` 组逐项:`.py .go .js .ts .jsx .tsx .java .c .cc .cpp .h .hpp .cs .rb .rs .php .sh .bash .zsh .fish .sql .lua .kt .scala .swift` = **25**。

**为什么这是缺口而不是小事**:T4 的 brief 会把「24」当成校验数。实现者照抄 25 项后发现对不上「24」,
两条路都危险 —— **删一个**(N54 明令「不许补全/删减,改了会静默隐藏扩展名」)或**改断言迁就**。

**影响哪一刀**:T4。
**建议处置**:登记为**勘误 E-74**,`12 + 13 + 25 = 50`;T4 brief 用 50,并要求**三条计数断言 `toBe(12)/toBe(13)/toBe(25)`**。

---

### 🟡 I-3 —— 报告 §10.1 的三组真机命中数(9/13/20)全错,且漏报「`.wps` 一组都不匹配」

T0 报告 §10.1 写「实测 45 个扩展名里 docs 组命中 9 个、text 组 13 个、code 组 20 个」。
我拿 `allowlist-extensions.REAL.json` 的 45 条与三张 `match` 表实算:

```
real total 45
  docs matches 11
  text matches 12
  code matches 21
unmatched (not shown in UI): ['.wps']   ← 1 条
```

**11 / 12 / 21,三个数字全错**,合计 44,**另有 `.wps`(`enabled: 1`)三组都不匹配 ⇒ 在白名单页上根本不渲染。**

**为什么重要**:① 这三个数字会被抄进验收清单(治理 §13-2 要求具体计数);
② **`.wps` 那条是机主必然会报的 bug** ——「Parser 认了 45 个扩展名,页面只显示 44 个」,
而它恰恰是 N54「不在三组匹配表里的扩展名一个都不显示」的**本机真实命中**,必须主动写进验收清单当预期行为。

**影响哪一刀**:T4 + 收官验收清单。
**建议处置**:订正为 11/12/21;验收清单加一条「`.wps` 已启用但不属于三组之一 ⇒ 页面不显示,这是蓝本行为(N54),不是缺陷」。

---

### 🟡 I-4 —— 附录 A §A.3.1 的「en 撞」列全是「—」,实测存在 en 单侧撞车;zh 单侧也漏列 4 条

治理 §7.1 明令「**双向**扫,且**假定协调者的表不完整**,P5c 三刀 / P5d 一刀 / P5e 一刀每刀都扫出新撞车」。
我用真实模块导入(zh/en 各 1648 键)对 90 条目标文案做了双向扫描,**总撞车行数 = 28,与 T0 一致** ✅,
但 T0 的 §A.3.1 枚举不完整:

| 遗漏 | 我扫到的 |
|---|---|
| 🔴 **en 单侧撞车(T0 该列全为「—」)** | `Removed` 的 **en 撞 `addPanelRemovedToast`**(en 都是 `Removed`、zh 不同) |
| zh 单侧,T0 未列 | `Action` 撞 `filesColType` / `aiTypeLabel` / **`aiKbColType`**(同族内也有同 zh 值) |
| zh 单侧,T0 未列 | `Delete` 撞 `appsSettingsRemove` |
| zh 单侧,T0 未列 | `Auto` 撞 `aiCfgAutoPlaceholder` |
| zh 单侧,T0 未列 | `Root deleted` / `Removed` 撞 `aiCfgDeleted` |

**实际风险**:低 —— 14 条复用键我逐条验过**两档都撞对**(`Path→aiKbColPath` `Action→aiKbColAction`
`Cancel→aiKbCancel` `Index Roots→aiKbNavRoots` `Real-time watch` `Scheduled scan only` `Last scan:` `never`
`Operation failed→aiKbOpFailed` `Retry→aiKbRetry` `Manage roots→aiKbManageRoots` `Delete→aiKbNtDelete`
`Auto→aiKbOriginAuto/aiKbDeviceAuto` `Removed→aiKbStatusRemoved`),**没有一条会因为这些遗漏而选错键**。
但「en 撞列全空」是**事实错误**,会让 T1 以为 en 方向不用扫。

**影响哪一刀**:T1。
**建议处置**:T1 **必须自己重跑双向扫描**(计划书 T1-5 本来就要求),报告里把 en 单侧那条显式登记;
附录 A §A.3.1 的 en 列改成实测结果。

---

### 🟡 I-5 —— 附录 B §B.2 没有引用本仓**已有的同款先例**(P5c-T2a 处理过一模一样的两个兜底)

T0 给 K54 的落地是 `--bg-tertiary → --bg-chip`、`--border → --line`,依据分别是「999px 药丸底色统计」
与「蓝本 `.k-field select:1350` 用 `var(--line)`」。**这两条依据都成立**,但 T0 没查到本仓**已经处理过同一对 token**:

```
knowledge.scss:2058-2088(P5c-T2a · FolderBrowser)
  「① var(--border, 回退值) / var(--bg-tertiary, 回退值)(蓝本 :85 / :95 / :96)——
     这两个 token 在 Vue2 的 src/ 下零声明,真实渲染的就是回退值 → 不保留这层壳,
     按回退值的语义直接映射到本档 token」
  :2075  蓝本 :85  var(--border,    rgba(127,127,127,0.25))  → var(--line)
  :2087  蓝本 :95  var(--border,    rgba(127,127,127,0.18))  → var(--line-faint)
  :2088  蓝本 :96  var(--bg-tertiary, rgba(127,127,127,0.06)) → var(--bg-sunken)
```

对照本期:
- `RootsView:254` 的 `var(--border, rgba(127,127,127,**0.25**))` → **`--line`** ⇒ **与先例逐字同款** ✅
- `RootsView:243` 的 `var(--bg-tertiary, rgba(127,127,127,**0.12**))` → T0 选 **`--bg-chip`**,
  而先例对 **0.06** 选的是 `--bg-sunken`。

🔴 **我认为 T0 的选择是对的**(0.12 > 0.06,中性灰叠在暗底上 alpha 越大越亮;`--bg-chip`(暗 `#2A2A2C`)
确实比 `--bg-sunken`(暗 `#161617`)亮,**保持了先例自己强调的「大小关系」** —— P5c 对 `:85`/`:95` 的
0.25 / 0.18 就是这么用 `--line` / `--line-faint` 拉开的)。
**但附录 B 里一个字都没提这条先例** ⇒ T2 写「渲染语义等价」论证时拿不出本仓一致性依据,
后续终审很可能要求改成 `--bg-sunken`。

**影响哪一刀**:T2。
**建议处置**:附录 B §B.2.2 补一行依据:「本仓 `knowledge.scss:2058-2088`(P5c-T2a)对同一对 token 的既定处置;
本处 alpha 0.12 > 先例的 0.06 ⇒ 取更亮一档的 `--bg-chip`,与先例用 `--line`/`--line-faint` 拉开 0.25/0.18 同法」。
另 `--border → --line` 也应改引这条先例(比引 `.k-field select` 更硬)。
两档取值我已自证:`--bg-chip` = `knowledge.scss:167`(暗 `#2A2A2C`)/ `:360`(亮 `var(--tool-bg-hi)`);
`--line` = `:191`(暗 `#2E2E31`)/ `:401`(亮 `var(--card-border)`)。**四个值都在。**

---

## 6. Minor(6 条)

### M-1 —— 附录 B §B.0 把 Allowlist A 段的色字面量记成「6 处」,实扫是 **5 处**

我自扫(口径 `#[0-9a-fA-F]{3,8}` / `rgba?\(` / `hsla?\(` / 具名色词表,**含注释**):

```
=== AllowlistA 985..1160
  :1003  'white'                  :1045  'white'
  :1120  'rgba('   :1120  '#1f9c47'
  :1121  'rgba('
  (:1112 'white' = white-space 假阳性)
=== AllowlistModal 1342..1400
  :1392  'rgba('   :1392  '#1f9c47'   :1393  'rgba('        ← 3 处 ✅
=== Wiki 2453..2561
  (:2468 :2480 :2507 :2522 :2523 :2536 全是 white-space 假阳性)  ← 真值 0 处 ✅
```

**A 段真值 = 5**(表里自己列的也正是 5 个:`:1003` `:1045` `:1120`×2 `:1121`),标题写「6 处」是算错。
**Wiki 段 0 处与 6 行 `white-space` 假阳性我完全复现** —— T0 §B.0.1 的留痕属实,
且它给 T2 的警告(**色扫守卫别用 `\bwhite\b`**)是对的。§B.3 + §B.4 合起来覆盖了全部 8 处(5+3),**无遗漏**。

### M-2 —— 附录 D §D.6.4 与计划书 T0-7 引用的复现脚本 `p5e-fixtures/scripts/sim-r8r9.mjs` **不存在**

```
$ ls .superpowers/sdd/p5e-fixtures/scripts/
_inputs.mjs  classes2.mjs  collide.mjs  k48-equiv.mjs  lookup.mjs  propose.mjs  replay-fixtures.mjs
```
T2 照着跑会直接失败。**建议**:附录 D 把那行换成 §D.6.5 里那条真能跑的命令,或改指 `classes2.mjs`。

### M-3 —— `.REAL` 的口径写「一字未改」,但两份 JSON 其实被重排版过

`allowlist-extensions.REAL.json` 与 `allowlist-folders.REAL.json` 与我现抓的响应 **md5 不同**、
`json.tool` 归一后**内容完全相同**(即只改了缩进/换行)。`wiki-raw-DATA.REAL.md` 是**真·逐字节相同**(md5 一致)。
**无功能影响**,但 README §0 的「`.REAL` = 本机真机抓的原始响应,**一字未改**」这句对两份 JSON 不准确 ⇒
建议改成「原始响应内容,仅做 JSON 缩进美化」。(T4 抄进测试时用的是解析后的对象,不受影响。)

### M-4 —— `allowlist-extensions.REPLAYED.json` 里的 `__meta` 键不是 API 形状的一部分

`__meta` 是出处标签载体(**这是好事,R3 兑现**),但 T4 若整份抄进 mock 会多出一个后端不存在的顶层键。
**建议**:T4 brief 明写「只取 `extensions` 数组,`__meta` 转成测试文件里的注释」。
(同样适用于 `wiki-tree` / `wiki-roots.normalized` / `wiki-node` 三份。)

### M-5 —— E-67 的**结论对、理由站不住**

T0 说「§2.1 主表记 67,`.k-section-body`/`.k-frow` 由 §2.3 单独登记 ⇒ 67+2=69,两份口径一致」。
但 §2.3 里的 **`.k-suggest-chip` 同时出现在 §2.4 的 P5e 52 类清单里**(`:357 .k-suggest-chip ★E-52`)——
可见 **§2.3 的条目并不天然在主表计数之外**,这条推理不成立。

更可能的真因(与 T0 自己 §D.1.1 的发现自洽):`p5-master-plan.md` §2 的差集法是
「蓝本 693 选择器 − 本仓 293 选择器」,而**本仓这两个类恰恰以「为什么不搬」的注释形式出现**
(`knowledge.scss:64` `:1294-1295` `:1578` `:1610` `:1640`)⇒ 若当时的提取**没剥注释**,
这两个会被当成「本仓已有」而从 149 差集里掉出去 → 67 而不是 69。

**结论不受影响**:我独立测得**必搬 69**,与 T0 一致。**建议**:E-67 的「处置」保留(下游用 69),
把「理由」一栏改成上面这条,免得下游拿「§2.3 一律外加」当通用规则再算错别的期。

### M-6 —— `kr-path` / `kr-input` 的字体栈是硬编码的,建议 T2 显式申报「照抄」

蓝本 `RootsView.vue:235` 与 `:259` 都是 `font-family: ui-monospace, SFMono-Regular, Menlo, monospace;`,
而**同期段内**的 `.k-field-mono`(蓝本 `:1365`)用的是 `var(--font-mono)`。**蓝本自己不一致。**
按「照抄老样子」应逐字搬(非配色约束,`color-guard` 不管字体),**但不申报就会被下一道评审当成漏 token 化**。
**建议**:附录 B 或 T2 brief 加一句「这两处字体栈照抄,理由:蓝本原文;非颜色 token 约束范围」。

---

## 7. 我**没有**发现的问题(逐条否定,免得下游以为没查)

- ❌ 没有发现附录 A 有任何「自己译的」zh/en 值(90/90 逐码点相等)。
- ❌ 没有发现 en 侧犯 E-44(值确实来自 `en_US.json`,且报告主动把「本期 en=key 是巧合」写清楚了)。
- ❌ 没有发现 `N46`–`N58` 里任何一条被「顺手修正」——T0 是文档刀,零产品码。
- ❌ 没有发现「凭想象补的不存在问题」(P5d 那类)。T0 的两条 `NEEDS_CONTEXT` 与 8 条勘误**每一条都对应真实证据**。
- ❌ 没有发现三门被绕过或日志被裁剪(我全量重跑,数字与报告一致)。
- ❌ 没有发现本期搬完后仍有**缺定义的 class**(110 个模板类 → 余集为空)。
- ❌ 没有发现 T0 发过任何写请求(我复测时 Parser `folders` 仍是 `{"rules":[]}`、`extensions` 45 条全 `enabled:1`,
  与 T0 抓取时一致 ⇒ 设备状态未被改动)。

---

## 8. 给协调者的行动清单

| # | 事 | 在哪一刀之前 |
|---|---|---|
| 1 | 🔴 订正附录 D §D.3 表格的 `:985-1151` → `:985-1141`(**I-1**) | **T2 开工前** |
| 2 | 🔴 裁定 N-1(我推荐**方案 B**,并要求同步改 `knowledgeStyles.test.ts:297-305` 那条超集自证) | **T2 开工前** |
| 3 | 🔴 裁定 N-2(我推荐**搬**,并要求一并订正本仓 `:1578`/`:1610-1611`/`:1640` 三处「k-frow 是死规则」的注释) | **T2 开工前** |
| 4 | 登记 **E-74**:N54 的扩展名表是 12+13+**25**(**I-2**) | **T4 开工前** |
| 5 | 订正报告 §10.1 → 11/12/21,并把「`.wps` 不属于任何组 ⇒ 页面不显示」写进验收清单(**I-3**) | T4 / 收官 |
| 6 | 附录 A §A.3.1 补 en 单侧撞车(`Removed` ↔ `addPanelRemovedToast`);T1 必须自跑双向扫描(**I-4**) | **T1 开工前** |
| 7 | 附录 B §B.2.2 补引 P5c-T2a 先例(`knowledge.scss:2058-2088`)(**I-5**) | **T2 开工前** |
| 8 | 附录 D §D.6.4 换掉不存在的 `sim-r8r9.mjs`(**M-2**) | T2 开工前 |
| 9 | E-67 的「理由」改写(**M-5**)· fixtures README 的 `.REAL` 口径措辞(**M-3**)· `__meta` 用法(**M-4**)· 字体栈申报(**M-6**) | 顺手 |

**T0 判定为「可以进 T1」** —— 上述 9 条全部是文档级订正,没有一条推翻 T0 的核心产出。
