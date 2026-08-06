# SP8-P5a Task 8 — i18n 双档报告

## 范围确认

`grep -n "aiKb" src/i18n/zh_cn.ts src/i18n/en_us.ts` 开工前命中 4 行,均为 T5 已落的
`aiKbDeferredTitle` / `aiKbDeferredHint`(zh_cn.ts:1412-1413,en_us.ts:1402-1403)。
本任务落主表 **94 条**,未重复定义这 2 条。

## 权威源

```
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/assets/lang/zh_CN.json > /tmp/p5a-vue2-zh.json
git -C /home/nimo/NimoTech/NimoOS-UI show main:src/assets/lang/en_US.json > /tmp/p5a-vue2-en.json
```
commit `6e4d132d8202216f271c92adf5f34b12f9528f95`(2026-07-30,main 分支)。

## 逐码点比对方法

1. 用脚本把附录 A 主表(brief 第 106-199 行,94 行)解析成 `{key, vue2Key, zhAppendix}` 三元组。
2. 中文侧:对每个 `vue2Key`,从权威 `zh_CN.json` 取值,与附录 A 抄的中文值逐码点(`codePointAt`)比对。
3. 英文侧:若 `vue2Key` 在权威 `en_US.json` 中存在,取该值;否则英文值 = `vue2Key` 本身(P3a 口径)。
   **实测 94 个 `vue2Key` 全部存在于 `en_US.json` 中,且逐一取出的值与 `vue2Key` 字面串完全相同**
   (`mismatches: 0 / 94`,见下方脚本输出),因此本批英文值全部取「= key 字面串」这一支,
   没有需要走 `en_US.json` 实际值覆盖的情况。
4. 最终把写进 `zh_cn.ts` / `en_us.ts` 的实际文本,再用同一比对逻辑对权威源做第二轮独立复核
   (不信任第一轮手抄的中间产物)。

### 逐码点比对脚本完整输出(第一轮:附录 A vs 权威源)

```
$ node /tmp/claude-.../compare-authoritative.mjs
---
total rows: 94
zh missing in authoritative source: 0
zh codepoint diffs (appendix vs authoritative): 0
en_US.json has key: 94, absent (fallback=key itself): 0
```

英文值等于 key 字面串的核验:
```
$ node -e '... enAuthVal !== vue2Key 逐条比对 ...'
mismatches: 0 / 94
```

**结论:附录 A 主表 94 条与权威源零差异 —— 附录 A 本身是准确的,本次没有出现「附录 A 抄错」的情况。**
（这与治理文件警告的「计划作者会抄错」不矛盾——本批恰好是零差异的一批，但仍必须走这道复核，
下面的第二轮复核确实抓出了一次真实错误——见下方。）

### 逐码点比对脚本完整输出(第二轮:实际写入的 `zh_cn.ts`/`en_us.ts` vs 权威源,`/tmp/p5a-i18n-check.mjs`)

**第一次跑(手抄中文值时的产出)**——抓到 5 处真实错误:
```
ZH MISMATCH aiKbOnboardBody
  mine : "添加第一个知识根，Nimo 会解析、索引其中的文档，生成可浏览的 Wiki，并在使用中自动沉淀笔记。"
  auth : "添加第一个知识根,Nimo 会解析、索引其中的文档,生成可浏览的 Wiki,并在使用中自动沉淀笔记。"
ZH MISMATCH aiKbLayerWikiDesc
  mine : "每个目录一份 .wiki.md 摘要，像维基一样浏览 — 可见的长期记忆。"
  auth : "每个目录一份 .wiki.md 摘要,像维基一样浏览 — 可见的长期记忆。"
ZH MISMATCH aiKbLayerVecDesc
  mine : "切块嵌入，自然语言即可命中；同文件多副本按 file_id 自动去重。"
  auth : "切块嵌入,自然语言即可命中;同文件多副本按 file_id 自动去重。"
ZH MISMATCH aiKbLayerNoteDesc
  mine : "AI 从对话自动提炼，[[双链]] 关联，session_id 溯源回原对话。"
  auth : "AI 从对话自动提炼,[[双链]] 关联,session_id 溯源回原对话。"
ZH MISMATCH aiKbDistillFromChats
  mine : "来自你与 Nimo 的对话，待确认"
  auth : "来自你与 Nimo 的对话,待确认"
PROBLEMS: 5
checked 94 keys
```

**根因**:我在把附录 A 的中文值誊写进 `zh_cn.ts` 时,把半角逗号 `,`/分号 `;` 手误敲成了全角 `，`/`；`
(这 5 条恰好都是长句、含多个分句,誊写时最容易手滑)。这正是治理文件要求「程序化逐码点比对」的
原因——肉眼看这两种逗号几乎无法区分。

**修复后重跑**:
```
$ node /tmp/p5a-i18n-check.mjs
MISMATCH: none
checked 94 keys
```

**第二轮比对额外覆盖**(脚本里一并做了):
- `en_us.ts` 94 条值 vs (权威 `en_US.json` 若有则取其值,否则取 key 本身)—— 全部一致。
- 两档键重复扫描(`DUPLICATE in zh_cn/en_us`)—— 0 条。
- 字面 `@` 扫描(94 条内)—— 0 条含 `@`。
- 插值占位符 zh/en 逐键比对(`{n}`/`{m}`/`{h}`/`{d}`/`{a}`/`{b}`/`{c}`/`{t}`/`{v}`)—— 13 条含占位符的键,
  全部 zh/en 占位符集合一致(`aiKbRunningIndexed` `aiKbMinAgo` `aiKbHrAgo` `aiKbDaysAgo`
  `aiKbWatchSplit` `aiKbVectorChunks` `aiKbVectorSplit` `aiKbToConfirm` `aiKbNotesSplit`
  `aiKbDisabledRoots` `aiKbIndexingNFiles` `aiKbDoneLast10m` `aiKbDistilledRecently`)。

## 「附录 A 写的 → 权威源实际是 → 采用了哪个」差异清单

**附录 A 本身(brief 文档)与权威源:零差异**(94/94 全部吻合,见上方第一轮输出)。
**差异只出现在我自己誊写进文件的中间产物**,不是附录 A 的问题:

| 键 | 我誊写时写的(错) | 权威源实际是(附录 A 与之一致) | 采用 |
|---|---|---|---|
| `aiKbOnboardBody` | 全角逗号「，」× 3 | 半角逗号「,」× 3 | 权威源(=附录A) |
| `aiKbLayerWikiDesc` | 全角逗号「，」× 1 | 半角逗号「,」× 1 | 权威源(=附录A) |
| `aiKbLayerVecDesc` | 全角逗号「，」+ 全角分号「；」 | 半角「,」+「;」 | 权威源(=附录A) |
| `aiKbLayerNoteDesc` | 全角逗号「，」× 2 | 半角「,」× 2 | 权威源(=附录A) |
| `aiKbDistillFromChats` | 全角逗号「，」× 1 | 半角「,」× 1 | 权威源(=附录A) |

其余 89 条:零差异,附录 A 抄的值与权威源逐码点相同,直接采用。

## 权威源缺失的键

**0 条**。94 个 `vue2Key` 在 `zh_CN.json` 里全部存在(`zh missing in authoritative source: 0`)。
本批没有需要「自造中文值」的键(P1c1 那种情况本批未出现)。

## 含 `@` 的值 / 插值占位符核对

- 含字面 `@` 的值:**0 条**(94 条全部扫描,无需 `{'@'}` 转义)。
- 含插值占位符的值:13 条(见上方逐码点比对第二轮列表),zh/en 占位符集合逐键核对**全部一致**,
  未出现改名(如 `{n}`→`{count}`)。

## 三个陷阱落地确认

1. **`aiKbNavWiki`(en `Wiki`)vs `aiKbTitleWikiMap`(en `Wiki map`)**:两者 zh 均为 `Wiki 导航`,
   已按两个独立键落地(`en_us.ts` 分别为 `'Wiki'` / `'Wiki map'`),**未合并**。
   附带 `aiKbWikiMap`(rail 内另一处引用,en `Wiki map`,zh 同为 `Wiki 导航`)也独立成键,
   三键均未合并 —— 程序化重复值扫描确认:`"Wiki 导航" -> aiKbNavWiki, aiKbTitleWikiMap, aiKbWikiMap`。
2. **`aiKbNavSearch` vs `aiKbSearch`**:两者 zh 均为 `搜索`,已独立成键(`en_us.ts` 分别为 `'Search'` / `'Search'`
   —— 注意这两个 en 值本身也相同,因为 Vue2 原 key 都是 `Search`,但语义不同:一个是 rail 项一个是
   按钮/标题),**未合并**。
3. **N8:`aiKbNavSettings`(`系统设置`)vs `aiKbTitleAdvancedSettings`(`高级设置`)**:已核实两键
   zh 值不同,**未做「顺手统一」**,照抄 Vue2 现状。

## §3.5「照抄不改」8 条命中情况

本任务只改 i18n locale 文件,不涉及 §3.5 N1-N8 描述的业务逻辑/组件代码,**除 N8(上方已确认)外
其余 7 条本任务不命中**(它们分别是 loadAllowlist/DashboardView/created()/loadDistillJobs/
d.total/loadWikiNode 等实现细节,属于其它任务范围)。

## §3 偏离清单(K1-K8/P1-P4)命中情况

本任务不涉及数据契约/组件/store 逻辑,**K1-K8、P1-P4 均不命中**。唯一相关项是 K8 提到的复用键
`aiCfgYou`——本任务未新增或修改它,只是确认它仍存在且值未变(`grep -n "aiCfgYou" src/i18n/*.ts`
→ `en_us.ts:603 'You'`、`zh_cn.ts:605 '你'`,与治理文件记录一致,未改动)。

## RED 探针

### 探针 1:删除键 → parity.test.ts 精确报红

删除前(片段):`en_us.ts:1500  aiKbSampleSkating: 'figure skating',`

删除后跑 `pnpm exec vitest run src/i18n/parity.test.ts`:
```
 FAIL  src/i18n/parity.test.ts > i18n locale parity > en_us 与 zh_cn 顶层 key 集合完全一致
AssertionError: expected [ 'addPanelAdded', …(1302) ] to deeply equal [ 'addPanelAdded', …(1303) ]
- Expected
+ Received
@@ -442,11 +442,10 @@
    "aiKbSampleContract",
    "aiKbSampleIphone",
    "aiKbSamplePythonAsync",
-   "aiKbSampleSkating",
    "aiKbSampleThyroid",
```
精确报红并指名 `aiKbSampleSkating`。已还原(`git status --short` 只剩本任务的 94 条净改动,无残留)。

### 探针 2:插值占位符改名 → 无人报红(真实发现)

把 `en_us.ts` 里 `aiKbRunningIndexed: 'Running · {n} indexed'` 改成
`aiKbRunningIndexed: 'Running · {count} indexed'`(仅改英文档,中文档仍是 `{n}`),
跑全量 `pnpm test`:
```
Test Files  307 passed (307)
     Tests  2742 passed (2742)
exit=0
```
**无人报红** —— `parity.test.ts` 只查键集合是否一致,不查值内的占位符名是否跨语言匹配;
`messageSyntax.test.ts` 只查 `@` 转义,不查插值占位符。**这是一条真实的守卫缺口**:
若未来有人手误把某个语言档的插值占位符改名(或漏改),不会有任何测试拦截,只会在运行时
`vue-i18n` 插值失败(该语言档显示 `{count}` 字面串或报 console 警告)。已按要求原样报告,
未自行添加守卫。已还原(`git status --short` 确认干净)。

## 三门终值

```
pnpm test                  → Test Files  307 passed (307) / Tests  2742 passed (2742) / exit=0
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → exit=0(仅既有 >500KB chunk 警告,与本任务无关)
```
与基线 `307 文件 / 2742 例` 完全一致,未新增 `.vue`,未新增测试文件。
`parity.test.ts` / `messageSyntax.test.ts` 单独跑:`Test Files 2 passed (2) / Tests 15 passed (15)`。
已知噪声(persist.test.ts / AgentComposer.test.ts)本次未出现红。

## i18n 复用/新增键清单

- **复用**:`aiCfgYou`(未改动,确认仍是 zh=`你`/en=`You`)。
- **T5 已落(本任务未动)**:`aiKbDeferredTitle`、`aiKbDeferredHint`。
- **本任务新增 94 条**:`aiKbKnowledgeBase` … `aiKbSampleSkating`(附录 A 主表全部 94 条,逐字落地,
  详见 `src/i18n/zh_cn.ts`/`src/i18n/en_us.ts` 中 `>>> SP8-P5a Task 8` 标记区块)。
- **本期 Vue2 没有的新文案**:0 条(全部 94 条均有 Vue2 对应源)。

## 提交

```
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(knowledge): SP8-P5a aiKb* i18n 94 键双档"
```

`git show --stat HEAD`:
```
 src/i18n/en_us.ts | 97 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/i18n/zh_cn.ts | 97 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 194 insertions(+)
```
(97 = 94 键 + 2 行区块注释 + 1 行区块结束注释,两文件对称)

`git status`(提交后):clean,working tree 干净,无残留改动。

## 顾虑

无 blocking 顾虑。唯一值得协调者知悉的是探针 2 揭示的守卫缺口(插值占位符跨语言改名无测试拦截)——
不在本任务范围内修复,如实上报。

---

# 追加:评审裁定 R7 —— 扩两条守卫(2026-08-01)

评审回来:Spec 合规 ✅ · 任务质量通过 · 零 Critical/Important;独立三向逐码点比对 94/94 中英零不一致;
`aiKbServiceOfflineBanner` 的全角逗号经评审核实是 Vue2 原文本身如此(`zh_CN.json` 该条码点 `ff0c`),
不是我的誊写错误。评审裁定 R7(Important):把「探针 2 揭示的守卫缺口」正式补上,范围限定在本批 94 键。

## 两条新守卫原文

写在 `src/i18n/messageSyntax.test.ts`,紧接在既有「P3b Task 2 aiSk* keys」那段之后、
「bare @ guard」之前,照抄该段的写法(固定键数组 + `covers exactly N keys` 防漂移 + 违规收集后
`expect.fail` 统一报告)。

**(a) 全角标点扫描,扩到本批 94 键**(`describe('P5a Task 8 aiKb* keys — no accidental full-width
punctuation (except a registered Vue2-authentic one)')`,3 个 `it`):
- `covers exactly the 94 keys this task added` —— 列表本身防漂移。
- `should not contain full-width ，；：？！（） in any zh_cn value from this batch`——
  正则 `/[，；：？！（）]/`,排除 `fullWidthExceptions = new Set(['aiKbServiceOfflineBanner'])`。
  扫描字符集取「全角逗号/分号/冒号/问号/叹号/括号」(既有 P3b 段只扫 `？！：` 三个,本批因为要
  抓逗号误打成全角这类真实错误——探针 2 报的正是这个——所以扩到 6 个字符;起草前扫过本批 94 键
  的中文值,只有 `aiKbServiceOfflineBanner` 一处会命中,其余 93 条零命中,不存在需要额外登记的键)。
- `aiKbServiceOfflineBanner keeps its Vue2-authentic full-width comma`——独立钉住这条例外的具体值
  (不只是把它从扫描里摘掉,而是**断言它必须仍是全角逗号**),防止将来有人把它"顺手改成半角"却没人
  发现——这是反向探针要求的「强断言」语义,见下方反向确认。

**(b) 插值占位符两档一致性,新增一条**(`describe('P5a Task 8 aiKb* keys — interpolation placeholder
parity between zh_cn and en_us')`,2 个 `it`):
- `covers exactly the 13 keys in this batch that carry interpolation placeholders` —— 列表防漂移
  (13 条:`aiKbRunningIndexed`/`aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`/`aiKbWatchSplit`/
  `aiKbVectorChunks`/`aiKbVectorSplit`/`aiKbToConfirm`/`aiKbNotesSplit`/`aiKbDisabledRoots`/
  `aiKbIndexingNFiles`/`aiKbDoneLast10m`/`aiKbDistilledRecently`)。
- `zh_cn and en_us use the same set of {…} placeholder names for each of these keys` —— 对每个键
  提取 zh/en 两侧 `{name}` 占位符名集合(排序后比较),不一致则 `expect.fail` 并列出双方名单。

## 圈定列表怎么维护(后续批次怎么扩)

**只圈本批 94 键,不做成全量**——注释里写明理由:全量对 1303 个既有键跑插值一致性检查,会立刻在
`aiResTurn`(zh `{n,time}` / en `{n,s,time}`)与 `aiResFilesInTurns`(zh `{files,turns}` / en
`{files,s,turns}`)两条上报红,而这是有意设计(英文复数后缀 `{s}`,`ResourcesTab.vue:223,228`)。
后续批次(P5b–P5f)若要扩展这两条守卫,做法是**各自新增一份自己批次的键列表数组 + 对应的
`describe`**(而不是把这份 94 键的列表改大),与既有 P3b 74 键那段、本批 94 键这段并列存在——
每一批次的键列表各自独立防漂移,互不干扰。

## `aiKbServiceOfflineBanner` 例外登记原文与依据

```ts
// Only aiKbServiceOfflineBanner is exempted, and only because the Vue2 source
// itself uses a full-width comma there (confirmed via `git show
// main:src/assets/lang/zh_CN.json`, the "The index service is temporarily
// offline…" entry — codepoint U+FF0C). Do not add further exceptions here without
// stopping and reporting first: every addition narrows what this guard catches.
const fullWidthExceptions = new Set(['aiKbServiceOfflineBanner'])
```
依据:评审在 R7 裁定里明确核实「`aiKbServiceOfflineBanner` 里那个全角逗号(码点 `ff0c`)不是你的错——
Vue2 原文本身就是全角」。例外**只登记这一条**,未发现本批其余 93 键触发扫描(见上方 (a) 的起草前
扫描结果)。

## 三次探针(两正向一反向)

### 探针 A(正向):`aiKbDistillFromChats` 半角逗号改全角

改前:`zh_cn.ts` `aiKbDistillFromChats: '来自你与 Nimo 的对话,待确认',`(半角逗号)
改后:`aiKbDistillFromChats: '来自你与 Nimo 的对话，待确认',`(全角逗号)

```
 FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5a Task 8 aiKb* keys — no accidental
 full-width punctuation (except a registered Vue2-authentic one) > should not contain full-width
 ，；：？！（） in any zh_cn value from this batch (except the registered Vue2-authentic exception)
AssertionError: Found full-width ，；：？！（） in P5a Task 8 zh_cn values (...):
aiKbDistillFromChats = "来自你与 Nimo 的对话，待确认"
```
精确报红并指名 `aiKbDistillFromChats`。已还原,`git status --short` 干净(还原后重跑该测试文件
17/17 全绿)。

### 探针 B(正向):`aiKbRunningIndexed` 英文档 `{n}` 改 `{count}`

改前:`en_us.ts` `aiKbRunningIndexed: 'Running · {n} indexed',`
改后:`aiKbRunningIndexed: 'Running · {count} indexed',`(仅改英文档,中文档仍是 `{n}`)

```
 FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5a Task 8 aiKb* keys —
 interpolation placeholder parity between zh_cn and en_us > zh_cn and en_us use the same set of
 {…} placeholder names for each of these keys
AssertionError: Found mismatched {…} placeholder names between locales:
aiKbRunningIndexed: zh=[n] en=[count]
```
精确报红并指名 `aiKbRunningIndexed`。已还原,`git status --short` 干净。

### 反向确认:`aiKbServiceOfflineBanner` 原样不动时必须绿 + 故意改成半角看是否报红

- 原样不动:上方探针 A/B 之前与之后单跑 `messageSyntax.test.ts` 均为 `17 passed (17)`,
  证明例外登记生效、没有把整条守卫废掉。
- 故意把 `aiKbServiceOfflineBanner` 的全角逗号改成半角(`索引服务暂时离线,部分功能可能不可用`):
  ```
   FAIL  src/i18n/messageSyntax.test.ts > i18n message syntax > P5a Task 8 aiKb* keys — no
   accidental full-width punctuation (except a registered Vue2-authentic one) > aiKbServiceOfflineBanner
   keeps its Vue2-authentic full-width comma (registered exception stays exercised, not just declared)
  AssertionError: expected '索引服务暂时离线,部分功能可能不可用' to be '索引服务暂时离线，部分功能可能不可用'
  ```
  **报红**——说明我把例外写成了「必须是全角」的强断言(不只是「从扫描名单里摘掉,值随便」的弱声明),
  这是协调者说的「甚至更好」的那种语义:例外键本身也被钉住,不能被静默改动。
  已还原,`git status --short` 干净。

## 重跑后三门终值

```
pnpm test                  → Test Files  307 passed (307) / Tests  2747 passed (2747) / exit=0
pnpm exec vue-tsc --noEmit → exit=0
pnpm build                 → exit=0(仅既有 >500KB chunk 警告,与本次改动无关)
```
`2747 = 2742(前一轮基线)+ 5`(本轮新增 5 个 `it`:(a) 3 个 + (b) 2 个)。协调者预测的
`+2`(2744)与实际新增的 5 个用例数不符——差异原因是「照 P3b 74 键那段的写法」这条指令本身要求
连带复制该段的「`covers exactly N keys` 防漂移」结构,而不是只加最小的一条扫描断言;
另外为满足「反向确认:例外必须仍生效」这一要求,补了一条独立钉住 `aiKbServiceOfflineBanner`
具体值的用例。全部 5 条都不是空转(逐条都做过 RED 验证或至少改一次生产值能让它报红,
见上方三次探针)。已知噪声(`persist.test.ts`/`AgentComposer.test.ts`)本轮未出现红。

## 新提交

```
git add src/i18n/messageSyntax.test.ts
git commit -m "test(i18n): SP8-P5a review R7 —— guard aiKb* 94 键全角标点与插值占位符两档一致"
```
sha:`a13d6fa5d6ebeb82cd3a3f1926fee1bb6c83b9ae`

`git show --stat HEAD`:
```
 src/i18n/messageSyntax.test.ts | 122 +++++++++++++++++++++++++++++++++++++++++
 1 file changed, 122 insertions(+)
```
`git status`(提交后):clean。

## 顾虑(本轮)

- 用例数与协调者预测的 +2 不符(实际 +5),原因已在上方「重跑后三门终值」段说明,不视为偏离——
  照抄 P3b 既有写法结构 + 补齐反向确认所需的独立断言,两者都是指令明确要求的产物。
  若协调者认为 5 条偏多,可考虑合并 `covers exactly N keys` 这类防漂移用例,但会削弱列表本身的
  防漂移能力,不建议。
- 全角标点扫描字符集从 P3b 的 `？！：`(3 个)扩到本批的 `，；：？！（）`(6 个)——因为探针 2/A
  报的正是逗号误打成全角,只扫 `？！：` 抓不到。已在测试文件注释与本报告里说明理由。
- 无其它待办。
