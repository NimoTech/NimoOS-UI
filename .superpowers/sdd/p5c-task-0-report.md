# SP8-P5c Task 0 报告 —— 治理文件 + 三份附录 + fixture(回源核查)

**状态**:`DONE_WITH_CONCERNS`(顾虑见 §7,全部是需要协调者/用户拍板的产品口径,不是未完成的工作)
**坐标**:New-UI `sp8-ai`,起点 `63a0b0d`(工作树干净)· Service `sp8-ai`@`15c2eba`(**本期零改动,已逐方法实证**)
**零产品代码改动**:本提交只含 `.superpowers/sdd/` 下的 6 份文件(4 份文档 + fixture 目录 + 本报告),`src/` 零改动。

---

## 0. 交付物

| 文件 | 行数 | 内容摘要 |
|---|---|---|
| `p5c-common-constraints.md` | 660 | 只写与 P5b 的差异。**K21–K30** 十条新偏离 · **N15–N22** 八条照抄条目 · §4 数据契约(5 行 mock 层次表 + analyze 四种响应)· §5 落点与相对路径表 · **§6.1 = C-3 的完整裁定** · §6.3 四个新 token · §6.4 测试守卫必改的 5 处 · §8 测试门 + 下游算术 + 交接项 8 条逐条派活 · §9 六个守卫缺口 · **§12 勘误 E-1 ~ E-7** · §13 验收清单纪律(含 9 个高危可点性点名) |
| `p5c-appendix-A-i18n.md` | 284 | **98 新增 + 11 复用**。主表 98 行(键名 / en / zh / 蓝本 `file:line` / 全角+占位标记),**全部脚本生成不手抄** · A.3 四组撞车错译 · A.4 brief 那 4 处「动态 `$t()`」的实测澄清 · A.5 全角例外 **18** 条 · A.6 占位符 **9** 条(两档零差异)· A.7 死键 **0** 条 |
| `p5c-appendix-B-tokens.md` | 310 | **57 行 / 60 处**逐处映射 · B.1 = C-2 重名类的完整 diff 裁定 · B.2 `--ns-color-*` 零声明 → 按回退值映射 · B.3/B.4/B.5/B.6 四张逐行表 · **B.7 三个必须登记的取舍** · B.8 四个新 token(全部有仓内逐字同值出处)· B.9 七条自检命令 |
| `p5c-appendix-D-classes.md` | 280 | 白名单 **187 → 226**(+39)· `NON_K_HELPER_CLASSES` **9 → 10**(+`warn`)· `parserStyles.test.ts` 新建 + `PARSER_WHITELIST_70` · D.3 属性态 6 处 · **D.4 蓝本未定义类 = 0 个**(差集扫描)· **D.5 重名串号扫描(80 个名字 × 6 个文件)** · D.6 keyframes 零新增 |
| `p5c-fixtures/` | 14 份响应体 + README | 8 条只读 + **6 条 `test/analyze`**(brief 要求的成功 + 失败都拿到了)· README 含 mock 层次表、三层→单层换算、重抓命令、C.3 未跑清单 |
| `p5c-task-0-report.md` | 本文件 | |

---

## 1. 🔴 关键决定 ①:C-3 —— Parser 两页的作用域与 token 收口

### 结论

**新建 `.parser-app` 作用域(brief 的 (b) 路),但用「共享选择器」实现,零 token 复制** ——
把 `knowledge.scss` 两个 token 声明块的选择器各扩一个逗号项,块内容一个字节都不动:

```scss
.knowledge-app, .parser-app { … }                                                    /* 原 :97  */
:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app { … } /* 原 :203 */
```
```scss
/* parser-styles.scss(独立文件,K24)*/
.parser-app                     { height: 100vh; height: 100dvh; overflow-y: auto; }  /* K22 */
.parser-app.parser-status-page  { …蓝本 parser-styles.scss:1-74 整档…              }  /* K23 */
.parser-app.parser-test-page    { …蓝本 ParserTest.vue:245-369 整块…               }  /* K23 */
```
```html
<div class="parser-app parser-status-page">   <!-- ParserStatus.vue -->
<div class="parser-app parser-test-page">     <!-- ParserTest.vue   -->
```

### 完整依据链

**(1) brief 的 (a) 路「页面根同时挂 `.knowledge-app`」不是「要核一下有没有副作用」,而是有决定性副作用 → 出局。**

用括号配平算出 `src/ai/styles/knowledge.scss` 里 `.knowledge-app` 的三个裸块边界:

| 块 | 范围 | 内容 |
|---|---|---|
| `:97-200` | 纯 token 声明 + `color-scheme: dark` | 零布局属性 |
| **`:290-1344`** | 🔴 **外壳** | `display: grid; grid-template-columns: 232px 1fr; grid-template-rows: minmax(0,1fr); height: 100vh; width: 100vw; overflow: hidden;` + 全部 `.k-*` 嵌套规则 |
| `:1440-1607` | `k2-*` 仪表盘段 | 只有嵌套规则 |

**token 与外壳共用同一个选择器 `.knowledge-app`** → 拿不到「只要 token 不要外壳」。
挂上去 Parser 页会变成 100vh × 100vw、两列(232px + 1fr)、`overflow: hidden` 的栅格,内容塞进 232px 第一列并被裁掉;
`.parser-status-page { padding/max-width/margin }` **改不掉那五条**(属性不同名,不是级联问题)。
→ brief 那三个行号(`:97` / `:290` / `:1440`)✅ 全对,但它把 (a) 摆成可选项本身是错的判断 → 登记 **E-4**。

**(2) 顺带否决了 brief 没提、但看起来最像的第三条路 ——「照 `SettingsPage` 挂 `.agent-app` 借 token」。**

`SettingsPage.vue:383` 确实是 `<div class="agent-app set-app">`,`settings-styles.scss:5-10` 头注释也写明
「token 由 `.agent-app` 提供、本档不重复定义任何 token」。**这条路我认真走过,两条硬理由否决:**

- `agent-styles.scss:8` 的 `.agent-app { … }` **同样带外壳**
  (`display:grid; grid-template-columns:260px 1fr 360px; height:100vh; width:100vw; overflow:hidden`)。
  `SettingsPage` 没事是因为 `.set-app`(`settings-styles.scss:17-28`)**自己也是满屏外壳**,把那五条逐条覆写了。
  **Parser 两页是普通文档流页(`padding:16px; max-width:900px; margin:0 auto`),不是外壳** → 借它就得逐条 reset 五个属性。
- 🔴 **`.agent-app .card` 串号**:`agent-styles.scss:529-535` 有
  `.agent-app .card { background; border; border-radius; overflow:hidden; box-shadow: var(--shadow-xs) }`。
  Parser 两页 `.card` 用了 9 次。`.agent-app .card`(0,2,0)与 `.parser-status-page .card`(0,2,0)**同权**,
  而 `overflow` / `box-shadow` 我方**不声明** → **无论源序怎样都会漏进来**,阴影是肉眼可见的 1:1 破口。
  (`tokens.scss` 的 `.agent-app` 两个块本身是**纯 token + `color-scheme`、零布局**,是干净的;
  脏的是 `agent-styles.scss` 那个同名外壳块。)

**(3) 也否决了第四条路「用全局 `theme.css` 的 `:root` token」。**

`theme.css` 的 `:root`(`:18-174`)/ `:root[data-theme="light"]`(`:175-302`)**没有 `--danger`、没有 `--warning`、
没有 `--text-primary/secondary/tertiary/quaternary`、没有 `--line*`、没有 `--bg-elevated`**;
`--card-bg` 是玻璃渐变、`--success` 是薄荷绿 `#5fe3b0`。Parser 两页需要的正是 danger / warning / 三级灰 / 平面白卡
→ 走全局就得往 `theme.css` 新造 danger/warning,那是改全站主题基座,远超本期范围。

**(4) 为什么「共享选择器」优于 brief 描述的「复制一份 token 声明」。**

- **先例是现成的、而且形状一字不差**:`tokens.scss:31-32` = `.agent-app, .ai-toast-scope { … }` ——
  **一份 token 声明供两个作用域,其中 `.ai-toast-scope` 就是个不带任何外壳的纯 token 消费方**。
  `.parser-app` 的定位与它完全同类。
- 零复制 = 零漂移。复制要抄 ~22 个 token × 2 档,成为全仓第三份副本
  (`tokens.scss` / `knowledge.scss` / `parser-styles.scss`)。
- `color-scheme` 免费到手:两个 token 块**已经**分别声明了 `color-scheme: dark` / `light`
  → **P2b 教训自动满足**;`.parser-app` 不需要也不许再声明一次。
- 档位机制免费到手:`.knowledge-app` 是「暗档基础块 + `:root[data-theme="light"]` 覆写」,跟随 `<html data-theme>`
  → **`.parser-app` 不需要绑 `:data-theme`**(不像 `.agent-app` 要自己维护容器态)。

**(5) 代价已定量,并写进治理文件 §6.4:**

| 要动的地方 | 具体 |
|---|---|
| `knowledge.scss` | **只改那 2 行选择器**(必须写在一行) |
| `knowledgeStyles.test.ts:245-246` | `DARK_TOKEN_SELECTOR` / `LIGHT_TOKEN_SELECTOR` 两个常量跟着改 —— `declBlockRange` 用 `^…$` 行首锚定,不改就整条断言红 |
| `knowledgeStyles.test.ts:196-199` | `nonKClassNames` 加 `&& c !== 'parser-app'` 排除(与既有 `'knowledge-app'` 同款);登记表**保持 9 项语义**,另因 `.warn` 独立 +1 → 10 |
| 新建 `parserStyles.test.ts` | K24:`parser-styles.scss` 不受 `color-guard`(不扫 `.scss`)也不受 `knowledgeStyles.test.ts`(只读 `knowledge.scss`)约束,**现在是裸奔**,必须补 4 条断言 |

**(6) K22 是这条路上挖出来的一个真缺陷,不是我加的花活:**
`src/styles/theme.css:318` 是 `body { overflow: hidden }`。顶层路由页若不自建滚动容器,**超出视口的内容永远看不到**
(ParserStatus 有 20 行文件夹 + 失败列表;ParserTest 的 chunk 列表可以很长)。
按 §2 判据「这条改动是在修一个可复现的错误行为吗?是 → 改并登记」。
先例:`AreaShell.vue:29` `.area-shell{height:100vh;height:100dvh}` + `:32` `.area-body{overflow:auto}`、
`knowledge.scss:500-505` `.k-scroll{overflow-y:auto;min-height:0}`。

---

## 2. 🔴 关键决定 ②~⑧(其余)

| # | 决定 | 依据 |
|---|---|---|
| ② | **`parser-styles.scss` 落独立文件,不并进 `knowledge.scss`**(K24) | `knowledgeStyles.test.ts:180-207` 的守卫缺口④ 用**集合相等**把非 `k*` 类钉死在 9 项;Parser 两页有 **70 个**非 `k*` 裸类,并进去会让那条断言当场炸 |
| ③ | **两个 Parser 页各自作用域,不合并同名类**(K23) | C-2 实测:完整路径相同的只有 `.card` / `.page-header` / `.page-header h2` **3 条且逐字相同**;`.row` / `h3` / `li` / `.hint` **都不同**(见附录 B §B.1)。合并 = 界面不 1:1 |
| ④ | **落点用上级设计 §5.1 的 `src/ai/knowledge/parser/`**,不是 brief 建议的 `src/ai/knowledge/parser/ParserStatus.vue` 之外的别处;`parser-styles.scss` 落 `src/ai/styles/` | 治理 §5.1 定死了完整落点表 + 相对路径表 |
| ⑤ | **i18n 全部用 `aiKb*` 前缀**,内部按页分 `aiKbSet*` / `aiKbPr*` / `aiKbPt*` / `aiKbFb*` 四个可 grep 词干 | `/ai/parser` 两条路由就在 `knowledgeRoutes.ts` 里、由知识库设置页唯一入口进入。再开第三个前缀家族会让同一区出现三套 |
| ⑥ | **4 个新 token,全部有仓内逐字同值出处**(`--switch-thumb` / `--switch-thumb-shadow` / `--gloss-inset-dot` / `--grad-sandbox`) | 见 §3 的 E-7。**不需要 `NEEDS_CONTEXT`** |
| ⑦ | **`--grad-sk-blue` 改名成 `--grad-sandbox`,值不动** | `-sk-` 是技能区专用命名,知识库区借它的名字会误导;值有出处(`tokens.scss:236`),不是新造 |
| ⑧ | **交接项 8 条逐条派活**(治理 §8.2):#1/#2/#3/#4 派活;**#5 明确挂账转 P5d**(`indexedFilesView.ts` 在全期零改动清单里);#6 不修(D1);#7 不涉及;#8 登记「不依赖」不编 fixture | |

---

## 3. 🔴 勘误节 —— brief C-1 ~ C-10 逐条复核结论

**结构性结论:brief 的行号引用几乎全对。** 逐类核对:
§2.1 的 7 个文件行数 **7/7 全对** · C-4 的 11 个包方法行号 **11/11 全对** · C-7 的 34 个 `knowledge.scss` 行号 **34/34 全对** ·
C-9 的 3 个路由行号 **3/3 全对** · C-10 的 7 个端点 **7/7 全对**。
**错的集中在「范围边界」「计数」与「一处架构判断的前提」上 —— 共 7 处(E-1 ~ E-7)。**

| C-# | 复核结论 | 详情 |
|---|---|---|
| **C-1** | ⚠️ **成立,且第二半我补做了实测** | `--ns-color-*`:`git grep -- "--ns-color-" main` 只命中 `ParserTest.vue`(10 次)+ `parser-styles.scss`(9 次),**零处 `--ns-color-x:` 声明** ✅ → 19 个 `var()` 全渲染回退值。**第二半**:`--border` / `--bg-tertiary` 在 Vue2 `src/` 下**同样零声明**(唯一 `--border:` 在 `public/guide/google-drive.html:9`,独立静态页)→ `FolderBrowser.vue:85/95/96` 也渲染回退值。🔴 **但同文件里不带 fallback 的 `--text-primary/secondary/tertiary` / `--danger` 在 Vue2 有声明**(`knowledge.scss:18-31` 的 `.knowledge-app` 块 + `Agent/tokens.scss`)→ **两类必须分开对待**,附录 B §B.5 已分开 |
| **C-2** | ✅ **完全成立,并已完成 brief 要求的逐个重名类 diff** | 块范围逐字对:`<template>` `:1-152` · `<script>` `:154-243` · `<style lang="scss" scoped>` `:245-369`(125 行)✅;**不 `@import` `parser-styles.scss`** ✅(只有 `ParserStatus.vue:162-164` 那个 `<style>` 块 `@import`)。本期 scss 实际 **74 + 125 = 199 行** ✅。重名 diff 结果见附录 B §B.1:**完整路径相同的 3 条逐字相同,其余 4 组不同** → 裁定 K23 两页各自作用域 |
| **C-3** | ❌ **前提错(E-4),已给完整裁定** | 见 §1。三个行号 ✅ 全对,但 (a) 有决定性副作用、不是可选项;并顺带否决了 `SettingsPage`/`.agent-app` 与全局 `theme.css` 两条路 |
| **C-4** | ✅ **完全成立,11 个方法行号 11/11 逐个打开核过** | `ai.ts:591/596/607/612/617/673` · `notes.ts:252/257/264` · `wiki.ts:154` · `folder.ts:7`。`parserTestAnalyze` 确实带 `multipart` 头 + `timeout: 120000`,注释确实写「与 Vue2 `ParserTest.vue:207-219` 逐字对齐」✅。→ **本期不需要跨仓 `pnpm build`、不需要消费仓 `pnpm install`**,已写进治理 §1 第 2 条 |
| **C-5** | ✅ **成立,且我把「不许推定」的那两项做成了实测** | 五行层次表全对。`FolderBrowser.vue:66` 确实是 `r.data && r.data.data && r.data.data.content` **三层** ✅ → K28。🔴 brief 要求的字段名核查:`Service/src/types.ts:26-30` 的 `FolderEntry = { name: string; path: string; is_dir: boolean }`,且 `GET /v1/folder` 实测每项字段含 `name` / `path` / `is_dir` → **`folderBrowser.js:5-7` 的 `e.is_dir` / `e.name` 零改动移植** ✅。**补一条 brief 没提的**:`normalizeSettings`(`notes.ts:131-137`)会把 HTTP 层的 `distill_roots` / `distill_daily_cap` / `background_model` **三个字段丢掉** → mock 里不许出现 |
| **C-6** | ⚠️ **结论成立,计数偏 1(E-2)** | 去重后是 **11 个**不是 12(`chev` / `folder` 被两个组件共用,被数了两次)。**11/11 全在** ✅(`KIcon.vue` 的 `PATHS` 共 42 键)。**补一条 brief 没提的**:`ParserStatus`/`ParserTest` **零 KIcon**(用 emoji + 纯文字),不许顺手换 → N16 |
| **C-7** | ⚠️ **34 个行号 34/34 全对;两处边界错 + 漏 3 个选择器 + ⚠️ 那个问题有答案** | **E-3**:「`:969-988`」错 —— 要搬的 4 类是 `:969-984`,`.k-section-body` 是 `:985-991`(闭合 `}` 在 `:991`),按 `:988` 切会**截断**它、吐半条规则 → sass 编译报错。**E-6**:`.k-progress-*` 精确就是 `:1152-1157`,「约」可去掉。**漏 3 处**:`.k-set-row-title` 还在 `:1252`(`.k-set-danger` 内变红那条)、`.kn-picked` 还在 `:2252`(`code` 嵌套)、`kn-*` 段头注释在 `:2250`(完整段 `:2250-2263`)。**色字面量清单 9 条 brief 全列到了 ✅**(我独立重扫 = 9 行 / 10 处,`:1287` 含 2 个 hex)。**E-7 = ⚠️ 有答案** |
| **C-8** | ✅ **完全成立** | `SettingsView.vue:121-156` 确实是裸 `.k-modal-bg` + `@click="closeMigrate"` + `@click.stop` ✅ → K29 转 reka。SettingsView 在 `.knowledge-app` 下,portal 宿主天然存在 ✅。Parser 两页**零弹窗**(实测:两个模板里没有任何 modal/dialog)→ `to` 指哪里**不是** C-3 的一部分,这半句可以划掉 |
| **C-9** | ✅ **完全成立,3/3 行号逐字对** | `deferred.ts` 的 `DEFERRED_TABS` 实测 **6 项** → 摘 `'settings'` → **5** ✅;`knowledgeRoutes.ts:59` = `{ path: 'settings', name: 'KnowledgeSettings', component: KnowledgeDeferred }` ✅;`:62` = `{ path: '/ai/parser', name: 'AIParser', … }`、`:63` = `{ path: '/ai/parser/test', name: 'AIParserTest', … }` ✅。🔴 **确认它们是顶层路由**(`knowledgeRoutes` 数组的第 2、3 个元素,与 `/ai/knowledge` 父路由**平级**,不在 `children` 里)→ 这也正是 C-3 那个「拿不到 `.knowledge-app` token 层」的成因 ✅ |
| **C-10** | ✅ **7/7 端点全部复现,数字如 brief 所料已漂;两条 brief 没抓的我都抓到了** | `control/state` 5 字段逐字一致 ✅(仍 `paused: true`)· `stats`:`indexed_files` **8 → 7**、`pending` **339**、`total_vectors_text` 5592 · `folders/pending`:20 项 + **`total_groups: 119`**(字段确实存在 ✅)· `jobs?status=failed`:`{"jobs":[]}` ✅ · `notes/settings` 5 字段逐字一致 ✅ · `dir-info`:`{exists:true,empty:false}` ✅ · `wiki/candidates`:`[]`(HTTP 200 秒回)✅。**路径映射**(`parser_proxy.go` 纯透传)未再复核 Go 源码 —— 我用**直连 `:8283` 的实测结果**替代了这一层验证,直连能拿到就说明透传成立 |

### 勘误编号表(「brief 原文 / 权威源实际 / 处置」三列)

| # | brief 原文 | 权威源实际 | 处置 |
|---|---|---|---|
| **E-1** | §1「起点:New-UI `sp8-ai`@`cc6df78`(工作树干净)」 | HEAD 是 **`63a0b0d`**;`cc6df78` 之后还有 `b6d1db2` / `e4fa834` / `63a0b0d` | 三个都是 `.superpowers/sdd/` 下的纯 markdown(`git diff --name-only cc6df78..63a0b0d -- src/` 为空)→ 三门基线不受影响(已实测验证)。**起点改 `63a0b0d`,产品代码坐标仍 `820d426`**。治理 §1 第 1 条 |
| **E-2** | C-6「复核一遍 **12 个** 全在」 | 去重是 **11 个**(`chev`/`folder` 被数两次) | 结论不变(11/11 全在),计数改 11。治理 §1.2 |
| **E-3** | §2.2「蓝本 scss `:969-988` 那段…`.k-section-body`(`:985+`)」 | 头注释 `:969`;4 个类 `:970-984`;`.k-section-body` **`:985-991`**(`:988` 在它中间) | 正确范围 **搬 `:969-984`,不搬 `:985-991`**。按 `:988` 切会截断 → sass 报错。附录 B §B.6 / 附录 D §D.1 |
| **E-4** | C-3 把「挂 `.knowledge-app` 白拿整个 token 层」摆成待选的 (a) 路,只要求「核一下有没有布局副作用」 | `knowledge.scss:290-1344` 的 `.knowledge-app` 块**就是满屏两列外壳**(`display:grid; grid-template-columns:232px 1fr; height:100vh; width:100vw; overflow:hidden`),与 token 块共用同一选择器 → **(a) 从一开始就不成立** | (a) **出局**(不是「有副作用要权衡」而是「决定性副作用」)。裁定 = 共享选择器版的 (b)。**连带否决**「照 `SettingsPage` 挂 `.agent-app`」(同样带外壳 + `.agent-app .card` 串号)与「用全局 `theme.css`」(无 danger/warning)。治理 §6.1 |
| **E-5** | §4「蓝本里 `$t()` 传**非字面量**的地方,抽取脚本扫不到」,列了 4 处 | 那 4 处**全是字面量参数**的 `$t()`,只是位置特殊(数组字面量里 / script 的 computed 里 / 当函数实参)。用 `\$t\(\s*['"]` 全文件扫描**全部命中**。**本期真正的 `$t(非字面量)` = 0 处** | **本期零 K20 风险。** brief 的实操要求已满足;真正的要点是**扫描要跑整个文件而不是只跑 `<template>`**(否则 script 里那 8 处会漏)。附录 A §A.4 |
| **E-6** | §2.2「`.k-progress-*`(蓝本**约** `:1152-1157`)」 | 精确**就是** `:1152-1157`,一行一类,头注释 `:1151` | 「约」去掉,登记成 **N15**。治理 §3.5 |
| **E-7** | C-7 ⚠️「`.k-sandbox-icon` 那条渐变…有先例 → 照先例;没有 → 写 `NEEDS_CONTEXT`,不许自己发明 `color-mix` 比例」 | 🔴 **有,而且逐字同值**:`tokens.scss:236` `--grad-sk-blue: linear-gradient(135deg, #5AC8FA, #007AFF)` 与蓝本 `:1287` **一个字节都不差**。另外 3 处也各有逐字同值先例:`--switch-thumb`(`:201`/`:345`)· `--switch-thumb-shadow`(`:202`/`:346`)· `--gloss-inset-dot`(`:162`/`:321`),**且 `--switch-thumb*` 的注释原文说的就是同一个 iOS 开关拨钮**(`Vue2 source skills-styles.scss:235-249 had a literal background: white + box-shadow: 0 2px 4px rgba(0,0,0,0.18) for the round knob`) | **不需要 `NEEDS_CONTEXT`,不需要发明比例。** 4 个新 token 全有出处,附录 B §B.8。唯一自主决定:`--grad-sk-blue` 改名成 `--grad-sandbox`(值不动) |

### 附带订正(不是 brief 的错,一并登记 —— 治理 §12.1 有全文)

C-7 漏的 3 个选择器 · C-8 那半句「Parser 两页若也需要 portal 宿主」可以划掉(两页零弹窗)·
C-10 的数字已漂(`indexed_files` 7、`pending` 339、`total_groups` 119)。

---

## 4. Fixture:抓了哪些、原始 curl、关键形状

完整表在 `p5c-fixtures/README.md`。摘要:

**C.1 只读 8/8 已跑**:`parser-control-state.json` · `parser-stats.json` · `parser-folders-pending-20.json` ·
`parser-jobs-failed-5.json` · `notes-settings.json` · `notes-dir-info-notes.json` · `wiki-candidates.json` ·
`folder-list-DATA.json`。

**C.2 `POST /v1/parser/test/analyze` 6/6 已跑(brief 要求的两条都拿到了)**:
`parser-test-analyze-md-ok.json`(成功,markdown)· `parser-test-analyze-txt-rerank.json`(成功,plain + rerank)·
`parser-test-analyze-200-empty-file.http`(空文件 → `chunk_count:0`)·
`parser-test-analyze-400-target-tokens.http` · `parser-test-analyze-400-bad-ext.http` ·
`parser-test-analyze-422-no-file.http`。

🔴 **brief 那条「Parser 现在是 paused,若 analyze 不可用就如实登记」的担心不成立** ——
**paused 不影响 analyze**,embed 正常跑、模型已加载,3.1s / 6.5s 返回。**ParserTest 页在本机完全可真机验。**

🔴 **四条实测出来的、直接决定验收清单的形状事实**:
1. `.md`/`.txt` **不产生 `docling_markdown`** → docling 卡整块不渲染。
2. `scored[]` **没有 `rerank_score`** → `rr {…}` 永不渲染。
3. 🔴 **本机 reranker 是坏的**:rerank=true 恒返
   `"rerank_error":"XLMRobertaTokenizer has no attribute prepare_for_model"` → **后端票**。
   好处:`rerank_error` 分支**真机可验**。
4. `params_used.overlap_tokens` 被后端按 chunker 改写(markdown → 0,plain → 原样)——
   **正好对上蓝本 `:56` 那句 `<em>` 提示**,不是前端 bug。

🔴 **422 那条的 `detail` 是数组**(其它端点是字符串),契约不一致 → 后端票;
**但 UI 到不了这个分支**(`:76` 的 `:disabled="!file || loading"` 挡住)→ 照抄取值链,不加数组分支,不写单测。

**C.3 破坏性 0 条未跑**:`control` 的五个动作(会改设备持久化状态,`resume` 会让内存 151 MB → ~2.8 GB;
`device=cuda` 在无 GPU 机器会硬失败)· `PUT notes/settings`(会移动磁盘文件)·
`jobs/clear-failed` / `DELETE jobs/{id}`(本期不依赖 → 不编 fixture,交接项 #8 已登记)。

---

## 5. 三门完整终值

**第一轮(开工时,工作树干净 @ `63a0b0d`)**:

```
 Test Files  319 passed (319)
      Tests  3153 passed (3153)
   Duration  67.04s
exit=0
```
```
pnpm exec vue-tsc --noEmit   → exit=0(日志 0 行)
pnpm build                   → exit=0(✓ built in 12.62s;只有既有 >500KB chunk 警告)
```

🔴 **与协调者实测的基线逐字一致(319 / 3153 / 0 / 0)。**
🔴 **零红项、零复跑** —— 协调者提到的 `persist.test.ts > dropPersisted removes record + blob and frees budget`
这条已知 flaky **本轮没有出现**(干净单轮)。

**第二轮(交付前,只多了 `.superpowers/sdd/` 下的 markdown/json)**:见 §5.1。
本任务**零产品代码改动**(`src/` 一个字节都没动),三门与基线**逐字相同**。

### 5.1 第二轮实测

```
 Test Files  319 passed (319)
      Tests  3153 passed (3153)
exit=0
```

---

## 6. 自查:`git show --stat HEAD` + `git status`

提交 sha:**`af0823c`**(`git add -f` 显式列 20 个路径,零 `git add -A`)

```
 20 files changed, 1985 insertions(+)
 .superpowers/sdd/p5c-appendix-A-i18n.md            | 284 +
 .superpowers/sdd/p5c-appendix-B-tokens.md          | 310 +
 .superpowers/sdd/p5c-appendix-D-classes.md         | 280 +
 .superpowers/sdd/p5c-common-constraints.md         | 660 +
 .superpowers/sdd/p5c-fixtures/README.md            | 162 +
 .superpowers/sdd/p5c-fixtures/*.json  (11 份)      |  11 +
 .superpowers/sdd/p5c-fixtures/*.http  ( 4 份)      |  12 +
 .superpowers/sdd/p5c-task-0-report.md              | 267 +
```
```
$ git status --short
(空)
$ git diff --name-only 63a0b0d..HEAD -- src/
(空)          ← 零产品代码改动,已实证
```

**全部落在 `.superpowers/sdd/` 下,`src/` 一个字节都没动。** 未 rebase / reset / stash / merge / push;
未跑 `./scripts/deploy.sh`;未写 `/var/lib`;未改任何后端仓(`.sp8/NimoOS-Service` `git status` 干净、HEAD 仍 `15c2eba`);
`NimoOS-UI` 全程只 `git show main:`,零 checkout / 零 stash / 零提交。

---

## 7. 🔴 顾虑 / `NEEDS_CONTEXT`(**都是产品口径,需要协调者或用户拍板,不是未完成的工作**)

1. 🔴 **浅色档 `--warning` 与 `--success` 比 Vue2 明显更深**(附录 B §B.7 取舍②)。
   用户口径是「浅色档肉眼与 Vue2 一致」。实测:卡片底 `#fff` **逐字相同** ✅、`--danger` 几乎一致 ✅、
   `--line-faint` 极淡档几乎不可辨 ✅、`--accent` 同族可见差 ⚠️,但
   **`--warning` = `#92600c`(深琥珀)vs Vue2 `#f5a623`(亮橙)** 与
   **`--success` = `#15754c`(深绿)vs Vue2 `#2ecc71`(emerald)** 是**肉眼可见**的
   (影响 ParserStatus 的运行/暂停指示灯、`.ok-hint`、`.score`、`.warn`)。
   **原因**:浅档 token 来自 K2 为整个 AI 区定的暖中性纸感色板,全仓 `.agent-app`/`.set-app`/`.knowledge-app` 共用。
   **我的裁定是「保持全站一致性,不为两页开小灶」并写进验收清单让用户知道**;
   若用户不接受 → 需要新造 `--warning-vue2` / `--success-vue2` 之类只给这两页用的 token,那是独立产品决策票。
   **请协调者在验收清单里明写这一条,让用户看到实物后拍板。**
2. **K22(`.parser-app` 加 `height:100vh + overflow-y:auto`)是本期唯一一处「Vue2 没有的结构属性」。**
   依据链完整(`theme.css:318` `body{overflow:hidden}` + 两个仓内先例),但它**改变了页面的滚动宿主**:
   Vue2 里滚动条在文档级,New-UI 里在 `.parser-app` 上。**视觉上是一条更靠内的滚动条。**
   我判定这属于「修可复现错误行为」而非视觉偏离,但请协调者留意评审可能按 1:1 报它 —— 治理 §3 已把它列成 K22。
3. **后端票 2 条**(治理 §8.2 已登记):Parser reranker 坏(rerank 功能对用户不可用)·
   `test/analyze` 缺 file 时 `detail` 是数组(契约不一致)。**两条都不阻塞本期。**
4. **`aiKbOriginAuto` 被复用到「推理设备的自动档」上,键名带 `Origin` 但语义不同**(附录 A §A.1 已说明)。
   我选了复用(Vue2 两处用的就是同一个 key `Auto`,新建第二个键会造出 Vue2 没有的重复内容,
   且承 P5a K8 复用 `aiCfgYou` 的先例)。**若协调者更偏向「键名必须语义准确」,可以改成新建 `aiKbDeviceAuto`
   —— 那会让新增键数从 98 变 99,附录 A 的三个计数(98 / 「exactly 98 keys」/ 98-98 MATCH)要同步改。**
5. **交接项 #5(DM9)我明确挂账不修**,理由是 `indexedFilesView.ts` 与它的测试都在全期零改动清单里,
   为一个用例名去碰 P5b 收官产物不值。**如果协调者认为必须本期清掉,需要把那两个文件从零改动清单里解禁。**
6. **本期没有计划书,附录里的「哪一刀做什么」只给到「归 scss 那一刀 / 归设置页那一刀」的粒度。**
   具体切几刀、每刀 DoD 的用例数,由协调者按治理 §8.1 的算术(起点 319/3153 → 收官 326 文件 + 4 例 color-guard + 新用例)写。
7. **P5b 遗留的 B19/B20/B21 + C 组验收缺口**(沉淀 scope / 刷新保持 / 暗色轮 2)——
   本期两页都不涉及沉淀队列,**接不上**。仍需 P5d 或造数据时补。
