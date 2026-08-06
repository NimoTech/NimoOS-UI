# SP8-P5a Task 8 — 独立评审:i18n 双档 94 键

评审者:独立复核(不采信实现者报告与脚本输出),评审基线 sha `c28e0ee`,对比起点 `5644ed8`。

## 0. 判定

- **Spec 合规:✅**
- **任务质量:通过**

## 1. 权威源获取

```
cd /home/nimo/NimoTech/NimoOS-UI
git show main:src/assets/lang/zh_CN.json > /tmp/p5a-t8-rev-zh.json
git show main:src/assets/lang/en_US.json > /tmp/p5a-t8-rev-en.json
```
`NimoOS-UI` 工作树确认在 `docs/vue3-migration-sp3` 分支,仅一个无关未跟踪文件
`FRONTEND_API_GUIDE.md`(SP7 会话遗留),本评审全程未碰该仓工作树。

## 2. 程序化逐码点比对(自写脚本,`/tmp/claude-.../full_compare.mjs`,不复用实现者产物)

方法:自己从 `.superpowers/sdd/p5a-appendix-A-i18n.md` 用 Markdown 表格解析器抽出 94 行
`{key, vue2Key, zhVal}` 三元组(不手抄),再分别与:
1. 附录 A 自身 vs 权威 `zh_CN.json[vue2Key]`(三方对照的"附录 A vs 权威源"一支)
2. 附录 A 的 `vue2Key` vs 权威 `en_US.json[vue2Key]`(是否等于 key 字面量本身)
3. 实际写入的 `zh_cn.ts`(自写正则从源文件抽值,不信任 TS 编译)vs 权威 `zh_CN.json`
4. 实际写入的 `en_us.ts` vs (权威 `en_US.json[vue2Key]` 若存在则取其值 / 否则取 `vue2Key` 字面量)
5. 94 键内 zh/en 插值占位符集合逐键比对
6. 94 键内字面 `@` 扫描(排除 `{'@'}` 转义)
7. 94 键在两档里键集是否完整、有无重复定义

**结果:全部 0 差异**(PART1-PART7 全部输出为空,`TOTAL PROBLEMS: 0`)。

- **中文 94 条**:与权威源逐码点完全一致,0 处不一致。
- **英文 94 条**:94/94 的 `vue2Key` 均存在于 `en_US.json`,且其值 == key 字面量本身(即口径的
  "存在则取其值"分支这批恰好等于"取 key 本身"分支,两者重合,英文档全部匹配)。
- **附录 A 三方对照**:附录 A 主表自身(94 条)与权威源零差异,不存在"计划作者抄错"的情况
  本批恰好是准的一批。

## 3. 实现者自查修的 5 处 —— 逐一独立确认

逐条从 `zh_cn.ts` 实际取值确认(自写正则,非信任报告):

| 键 | 现值 | 含半角标点? |
|---|---|---|
| `aiKbOnboardBody` | `添加第一个知识根,Nimo 会解析、索引其中的文档,生成可浏览的 Wiki,并在使用中自动沉淀笔记。` | 是,半角逗号 ×3 |
| `aiKbLayerWikiDesc` | `每个目录一份 .wiki.md 摘要,像维基一样浏览 — 可见的长期记忆。` | 是,半角逗号 ×1 |
| `aiKbLayerVecDesc` | `切块嵌入,自然语言即可命中;同文件多副本按 file_id 自动去重。` | 是,半角逗号+分号 |
| `aiKbLayerNoteDesc` | `AI 从对话自动提炼,[[双链]] 关联,session_id 溯源回原对话。` | 是,半角逗号 ×2 |
| `aiKbDistillFromChats` | `来自你与 Nimo 的对话,待确认` | 是,半角逗号 ×1 |

**全部 5 处现在真的对了**,均与权威源逐码点一致。

**第 6 处漏网排查**:对全部 94 条值做 `[，；：？！]` 全角标点正则扫描,发现 1 处命中——
`aiKbServiceOfflineBanner`: `索引服务暂时离线，部分功能可能不可用`(全角逗号)。
**回权威源核实:`en_US.json['The index service is temporarily offline...']` 对应的
`zh_CN.json` 权威值本身就是全角逗号**(codepoint 0xff0c),逐码点比对在 PART1/PART3 均判定
一致(0 差异)。**这不是漏网的第 6 处错误,而是 Vue2 原文本身的标点(与其余 5 处的半角风格
不一致,是 Vue2 自己的不一致,不是本任务引入的),按"逐字照抄,不许自行改标点"的硬约束,
保留全角是正确做法。** 无第 6 处真实缺陷。

## 4. 键数 / 键集 / 重复定义

- `grep -c "aiKb" src/i18n/{zh_cn,en_us}.ts` → 各 96(94 本任务 + T5 已落的
  `aiKbDeferredTitle`/`aiKbDeferredHint`,行号 `zh_cn.ts:1412-1413` / `en_us.ts:1402-1403`,
  确认未被本任务重复定义)。
- 94 键在两档键集完全一致(PART7 无 MISSING)。
- 两档内 94 键均只定义一次(PART7 无 DUPLICATE)。
- 全文件级复查(自写正则扫描整份 1303 键,处理了尾随行内注释导致的一个误报后订正):
  `zh_cn.ts` 1303 键 / `en_us.ts` 1303 键,键集完全一致,**零重复定义**(全文件级别,不只 94 条)。

## 5. 插值占位符两档一致性

94 条内 13 条含占位符(`aiKbRunningIndexed` `aiKbMinAgo` `aiKbHrAgo` `aiKbDaysAgo`
`aiKbWatchSplit` `aiKbVectorChunks` `aiKbVectorSplit` `aiKbToConfirm` `aiKbNotesSplit`
`aiKbDisabledRoots` `aiKbIndexingNFiles` `aiKbDoneLast10m` `aiKbDistilledRecently`),
zh/en 占位符名称集合逐键比对**全部一致**,无改名、无遗漏。

## 6. 三处"不许统一" + N8 落地确认

自写脚本直接从源文件取值确认(未信报告):

```
aiKbNavWiki:               zh="Wiki 导航"  en="Wiki"
aiKbTitleWikiMap:          zh="Wiki 导航"  en="Wiki map"
aiKbWikiMap:               zh="Wiki 导航"  en="Wiki map"
aiKbNavSearch:             zh="搜索"      en="Search"
aiKbSearch:                zh="搜索"      en="Search"
aiKbNavSettings:           zh="系统设置"
aiKbTitleAdvancedSettings: zh="高级设置"
```
三组近义串均落地为**独立键、各自取值**,未合并;N8 反向确认 `aiKbNavSettings`(系统设置)与
`aiKbTitleAdvancedSettings`(高级设置)**确实不同**,未被"顺手统一"。

## 7. 既有键零改动

```
git diff 5644ed8..c28e0ee -- src/i18n/ | grep '^-'
```
只命中两行 `--- a/src/i18n/en_us.ts` / `--- a/src/i18n/zh_cn.ts`(diff 文件头,非内容行)——
**diff 里没有任何真实的删除/修改行,只有新增**。`git show --stat c28e0ee` 确认
`2 files changed, 194 insertions(+)`,无 deletions。既有键顺序未被重排。

## 8. 权威源缺失的键

94 个 `vue2Key` 在权威 `zh_CN.json` 里**全部存在**(PART1 无 "NO AUTH ZH" 输出)。0 条需要
自造中文值的情况,与实现者报告一致(独立复核结论相同)。

## 9. 键排布风格

`grep -n "// >>> SP8" src/i18n/{zh_cn,en_us}.ts` 显示本仓库 i18n 文件的既有约定是
**按任务/提交顺序追加的注释区块**(`// >>> SP8-PxTaskN … // <<< SP8-PxTaskN`),而非把新键
按字母序插进 `aiCfg*`/`aiMcpSrv*` 等既有前缀分组内部。T8 严格延续这一实际约定:紧跟在 T5 的
`// <<< SP8-P5a Task 5` 之后追加自己的区块,94 键内部顺序与附录 A 表格顺序逐行一致,是一段
连续区块,**没有打散插入无关区域**。(brief 字面写"按字母序插进…先看 aiCfg*/aiSk* 怎么排"与
仓库实际排布约定不完全一致,但按 §11"以仓库既有实证为准"的精神,T8 遵循的是本仓库真实存在
的排布先例,不视为偏离。)

## 10. 两次独立 RED 探针(未复用实现者的方法)

### 探针 A:全角标点注入 → 验证既有守卫边界

把 `zh_cn.ts` 里 `aiKbDistillFromChats` 的半角逗号改成全角 `，`(实现者的探针 2 改的是
`en_us.ts` 的 `{n}`→`{count}`,本探针改的是不同文件、不同键、不同错误类型——标点而非占位符名):

```diff
- aiKbDistillFromChats: '来自你与 Nimo 的对话,待确认',
+ aiKbDistillFromChats: '来自你与 Nimo 的对话，待确认',
```
`pnpm test` → `Test Files 307 passed (307) / Tests 2742 passed (2742) / exit=0`。
**全绿,无人报红**。已还原(`Edit` 精确改回半角逗号),`git status --short` 与 `git diff --stat`
均为空,干净。

**结论**:证实标点(全角/半角)错误没有任何自动化守卫,只能靠人工/程序化逐码点复核抓——
不是 T8 的缺陷,是本仓库既有守卫体系的已知边界。

### 探针 B:整键删除 → 验证 parity.test.ts 精确报红

删除 `zh_cn.ts` 里 `aiKbGlueSessionId: '笔记溯源',` 整行(实现者删的是
`en_us.ts` 的 `aiKbSampleSkating`,本探针删不同文件、不同键):

```
pnpm exec vitest run src/i18n/parity.test.ts
FAIL src/i18n/parity.test.ts > i18n locale parity > en_us 与 zh_cn 顶层 key 集合完全一致
- ...
+   "aiKbGlueSessionId",   ← 精确指名
```
精确报红并指名 `aiKbGlueSessionId`。已还原(补回原行),`git status --short` 与
`git diff --stat` 均为空,干净。

## 11. 问题 A:既有键(非本期)里两档插值占位符是否已存在不一致?

自写脚本(`question_a.mjs`)扫描**全部** 1303 个键(不限于本期新增),提取 zh/en 值里的
`{xxx}` 占位符名集合逐键比对:

```
zh keys: 1303  en keys: 1303  (键集完全一致,零重复)
placeholder mismatches (all keys, whole file): 2
- aiResTurn:          zh 占位符={n,time}        en 占位符={n,s,time}
- aiResFilesInTurns:  zh 占位符={files,turns}   en 占位符={files,s,turns}
```

**是的,已存在 2 处**(均非本期新增,属 `src/ai/components/tabs/ResourcesTab.vue` 使用的
Agent 资源面板键)。回源码核实(`ResourcesTab.vue:223,228`):调用处**始终**传入 `s`
参数(`s: pluralWord(...)`),英文用 `file{s}`/`turn{s}` 做单复数后缀,中文不需要复数,
模板里干脆不引用 `{s}`——vue-i18n 对"传了但模板未使用的具名参数"不报错,只在"模板引用了但
未传"时才报错,所以这是**故意的、安全的设计模式**(英文复数后缀),不是缺陷。

**对协调者拍板的意义**:若要新增"两档占位符名集合必须逐键相等"的全局守卫,会立即在这两个
既有键上报红(误报,除非同时给英文复数后缀模式开白名单)。**建议新守卫像 P3b 一样只圈本期
新增键的范围**(T8 这 94 条内部已验证 100% 一致,可以安全地把这 94 条钉成一个范围收紧的
新测试),而不能一上来就对 1303 个既有键全量生效,否则需要先给 `aiResTurn`/`aiResFilesInTurns`
这类"故意复数后缀"模式设计豁免规则。

## 12. 问题 B:`parity.test.ts` 与 `messageSyntax.test.ts` 各自的职责边界

自己读源码(`src/i18n/parity.test.ts` 全文 21 行、`src/i18n/messageSyntax.test.ts` 全文 190 行):

- **`parity.test.ts`** 只守三件事:①`Object.keys(zh).sort()` 与 `Object.keys(en).sort()`
  **深度相等**(键集合齐全,不查值内容/标点/占位符);②`en` 里每个值都是**非空字符串**;
  ③对 `cpu`/`memory`/`filesTitle` 三个键做**硬编码抽查**具体值。**它完全不检查值的内容正确性、
  标点、插值占位符跨语言一致性**——除三个抽查值外,对任何键的具体文案没有判别力。
- **`messageSyntax.test.ts`** 守的是**转义语法与个别历史事故的精确钉死**,不是通用内容校验:
  ①对 `aiComposerPlaceholder`/`aiSlashNoFolders`/`aiSkScriptsHint`/`aiSkErrDescAngle`
  四个键做逐字精确值断言(历史转义事故的回归钉子);②对 **P3b Task 2 引入的 74 个 `aiSk*` 键**
  做**范围收紧**的全角 `？！：` 扫描 + 2 个键的半角问号后缀断言(注释里明确说明"有意收窄到
  本期新增键,不扩到全量 zh_cn.ts",因为没有逐一核对过全量文件里每个既有键的标点是否都对应
  半角权威源,贸然全量断言会把未经核对的假设编码进测试);③对**全部键**(两档)做**全局**
  "裸 `@` 守卫"(排除 `{'@'}` 转义与 `@:key` 链接引用后,不许剩余 `@`)——这一条是唯一覆盖
  全量键(含本次新增的 94 条 aiKb)的检查,但它只查 `@`,**不查标点全半角、不查插值占位符**。

**结论**:两个文件合起来对新增的 94 条 aiKb 键提供的自动化覆盖是——键集合完整性(parity)+
非空字符串(parity)+ 全局裸 `@` 扫描(messageSyntax)。**标点风格与插值占位符跨语言一致性
对这 94 条完全没有自动化守卫**,与探针 A 的实测结论一致。

## 13. 三门终值(自己实测,不采信报告)

```
pnpm test                  → Test Files 307 passed (307) / Tests 2742 passed (2742) / exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
```
`pnpm build` 未重跑(brief 允许,本任务只改 locale 文件,不影响构建产物结构)。
与基线 307 文件/2742 例完全一致,无已知噪声用例出现红。

## 14. 提交卫生

- `git show --stat c28e0ee` → 只含 `src/i18n/en_us.ts` 与 `src/i18n/zh_cn.ts`,194 insertions,
  0 deletions。
- `git status --short`(评审全程结束后)→ 空,干净。
- `/home/nimo/NimoTech/.sp8/NimoOS-Service` 近期提交(`03d3028`/`55f42dc`/`feb85bc`)均属
  wiki/notes 域(T1/T2 范围),**无 T8 归属的新提交**。

## 15. §3.5 N8 与其余 7 条

本任务只改 i18n locale 文件,不涉及组件/store 逻辑。N8 已在第 6 节独立确认落地正确;
其余 7 条(N1-N7)与本任务无关,未见"顺手修正"的痕迹(diff 里只有 i18n 文件的新增行)。

## 16. ⚠️ 待协调者裁定

- 无。本任务未发现需要协调者裁定的模糊项;唯一值得记账的是第 11 节揭示的既有占位符不一致
  (`aiResTurn`/`aiResFilesInTurns`),但这是既有代码的既有设计,不属于 T8 范围内的缺陷,
  只是回答问题 A 的既有事实,已如实记录供协调者拍板"新守卫圈多大范围"用。
