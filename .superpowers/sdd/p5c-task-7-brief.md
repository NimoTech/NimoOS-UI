# SP8-P5c · Task 7 —— `ParserTest.vue`(测试沙盒,路由 `/ai/parser/test`,**本期最大一刀**)

蓝本 369 行 = `<template>` `:1-152` + `<script>` `:154-243` + `<style>` `:245-369`。
🔴 **`<style>` 那 125 行 T2b 已经搬完并过评审了** → **本刀只做 template + script,约 242 行**,**零 `<style>` 块**。

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 18 次)。尤其
   §3 的 **K1 / K21 / K22 / K23 / K24 / K25 / K27 / K31**、**§3.5 的 N16 / N18 / N22**、
   **§4.1(mock 层次)**、**§4.2(`test/analyze` 的真实形状,4 种响应)**、§4.3、**§4.4(fixture 抄本)**、
   §5.1、**§8.1 台账**、§9(测试质量 + **第七/八/九条纪律** + 守卫缺口 ③)、**§9.1 / §9.2**、§10、§11、§13
2. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— `aiKbPt*` 词干那批键(**T1 已落地,不许新增**)
3. `.superpowers/sdd/p5c-appendix-D-classes.md` §D.2 —— 本页裸类名清单
4. `.superpowers/sdd/p5c-fixtures/` —— **6 份**:`parser-test-analyze-md-ok.json` · `-txt-rerank.json` ·
   `-200-empty-file.http` · `-400-bad-ext.http` · `-400-target-tokens.http` · `-422-no-file.http`
5. `.superpowers/sdd/p5c-plan.md` 的 **T7 节**
6. **先例**:`src/ai/knowledge/parser/ParserStatus.vue` + `ParserStatus.test.ts`(T6 刚落地 —— **K31 两层根元素、
   fixture 抄本、en 档强断言、模板零裸色断言的写法全在里面,照它抄**)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。**
🔴 **本 brief 会出错**(T0 核出 7 处 · T3 核出 E-8 · T5 核出 K26 · T6 核出 E-9~E-14)——
**每个行号自己回源核**,核出错就登记编号。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`d8a33fe`**(工作树干净)
- 三门基线(**T6 两轮收官后实测**):
  **`Test Files 324 passed (324)` / `Tests 3299 passed (3299)`** · `vue-tsc` 0 · `vite build` 0 · `.vue` **177**
- **本刀新增 1 个 `.vue` + 1 个测试文件** → 文件数 **324 → 325**;`.vue` **177 → 178** → `color-guard` **+1 例**
- 🔴 蓝本 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Parser/ParserTest.vue`。
  **禁 `cat`/`Read` 那个仓的工作树;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建**:`src/ai/knowledge/parser/ParserTest.vue` · `src/ai/knowledge/parser/ParserTest.test.ts`
**不改任何既有文件。** 🔴 尤其 `parser-styles.scss` / `parserStyles.test.ts`(T2b)· `ParserStatus.vue`(T6)·
`parserStore.ts`(T5)· scss · `src/i18n/*` · **路由**(归 T10)。

---

## 2. 结构(K31 两层根元素)

🔴 **根元素必须两层**:
```html
<div class="parser-app">
  <div class="parser-test-page">
    …蓝本 :2-151 的内容…
  </div>
</div>
```
外层 `.parser-app` 管滚动(K22 三行),内层 `.parser-test-page` 是 `max-width:900px; margin:0 auto`。
**同一元素会让滚动条落在 900px 列右缘(宽屏上约屏幕中间)**,而 Vue2 是整页滚动 → **两层才是 1:1**。
⚠️ **`p5c-plan.md` 里 T6 那行曾是单元素旧写法(E-14),已订正** —— 别照旧写法。
样式:`import '../../styles/parser-styles.scss'`(JS 侧 import,**零 `<style>` 块**)。
🔴 **零 KIcon**(两个 Parser 页蓝本零 KIcon,不许顺手换图标)。

---

## 3. K27 —— 取数走包(**本刀最容易翻车的一处**)

| 蓝本 `:207-219` | 本仓 |
|---|---|
| `api.post('/ai/parser/test/analyze', fd, { headers: {'Content-Type':'multipart/form-data'}, timeout: 120000 })` | `service.ai.parserTestAnalyze(fd)` |

🔴 **包里已经带了 multipart 头 + 单独 120s 超时**(`../NimoOS-Service/src/ai.ts:673-680`,
注释原文写明「与 Vue2 `src/views/AI/Parser/ParserTest.vue:207-219` 逐字对齐」)
→ **调用方不许再传第二个参数**(传了是重复,且包的签名只收 `FormData`)。
🔴 **K1 单层取数**:蓝本 `this.result = resp.data`;包内已 `return res.data` → **`this.result = await service.ai.parserTestAnalyze(fd)`**,
**没有 `.data` 那一层**。

**FormData 九个字段的顺序与值逐字照抄**(蓝本 `:208-217`):
```
file · query(仅 this.query 非空时 append)· embed='true' · rerank(三元 'true'/'false')·
ocr(三元 'true'/'false')· target_tokens=String(...) · overlap_tokens=String(...) · min_tokens=String(...)
```
🔴 **`embed` 恒 `'true'`**;三个数字**都套 `String()`**;`query` **有条件 append**(空串不发)。
**用例要断言 FormData 的实际内容**(用 `fd.getAll()` / 遍历 `entries()`),**含「query 为空时确实没有这个字段」那一条**。

**catch 的取值链照抄**(蓝本 `:221-224`):
```
const detail = e.response && e.response.data && (e.response.data.detail || e.response.data.error)
this.error = detail || e.message || String(e)
```
🔴 **一字不许改**,见 §5 的 422 说明。

---

## 4. 逐条照抄要点(**每条回源核行号**)

### 4.1 N18 —— `result.scored.indexOf(s) + 1` 当排名序号,**照抄**
蓝本 `:115`。O(n²) 且依赖对象同一性,但 `scored` ≤20 条 → **不是可复现的错误行为** → 照抄。
🔴 **不许改成 `v-for="(s, i) in ..."` 取 `i + 1`**(那是与需求无关的顺手改动)。

### 4.2 N22 —— 硬编码技术标识符,**一个都不许补 i18n 键**
`rerank top-20`(约 `:65`)· `⚠ Reranker error: {{ result.rerank_error }}`(约 `:110`)·
`dense [0:8]:` / `sparse top:`(约 `:140` / `:144`)· `chunk #{{ … }}`(约 `:119` / `:135`)·
`cos {{ … }}` / `rr {{ … }}`(约 `:116` / `:118`)· 三个 `<label>` 的 `target_tokens` / `overlap_tokens` / `min_tokens`
(约 `:41` / `:45` / `:49`)· `chunker=…, target=…, overlap=…, min=…`(约 `:84-87`)·
`{{ c.token_count }} tokens · offset …`(约 `:136`)
🔴 **补了就是凭空多出 Vue2 没有的键,且两档一填英文 = 纯噪音。** 报告要列清这份「判定不入语言包」清单。
⚠️ **行号是「约」,自己回源核准**(T6 核出 brief 行号偏 1-2 行两处)。

### 4.3 N16 —— emoji / 符号位置
`🧪`(标题)· `← {{ $t('Back to details') }}` · `✓`(ok-hint)· `⚠`(rerank error)· `×`(clear 按钮)·
`▼`/`▶`(docling 折叠箭头)· `…`(truncate)。**在 `$t()` 内还是外,逐处回源核,一个都不许挪。**

### 4.4 script 其余照抄
- `onFile(f)`:`if (!f) return`;**超 30MB 只设 `error` 并 `return`,不清 `file`、不发请求**;
  否则 `file = f; error = null; result = null`。🔴 **顺序与「不清 file」照抄**(30MB 判据 `30 * 1024 * 1024`)。
- `onDrop(e)`:`dragActive = false` → 取 `e.dataTransfer.files && e.dataTransfer.files[0]` → `if (f) onFile(f)`。
- `clearFile()`:三清(`file` / `result` / `error`)。
- `resetParams()`:回 `{ target_tokens: 600, overlap_tokens: 80, min_tokens: 2 }`(**逐字**)。
- `chunkText(chunkNo)`:`find(x => x.chunk_no === chunkNo)` → `c ? c.text : ''`。
- `truncate(s, n)`:`if (!s) return ''`;`s.length > n ? s.slice(0,n) + '…' : s`。
- `fmtBytes(n)`:`< 1024` → `n + ' B'`;`< 1024*1024` → `(n/1024).toFixed(1) + ' KB'`;否则 `(n/1024/1024).toFixed(2) + ' MB'`。
  🔴 **三档的边界两侧都要断言**(1023/1024、1048575/1048576)。
- 页面级瞬态一律组件本地 `ref`:`file` / `query` / `rerank` / `ocr` / `loading` / `result` / `error` /
  `dragActive` / `doclingOpen` / `params`。**不塞 store。**
- `params` 三个输入是 `v-model.number`(照抄,别改成 `v-model` + 手工转换)。

---

## 5. §4.2 的四条实测事实(**必须进用例当预期,不是缺陷**)

治理 §4.2 已实测落盘,**逐条核后写进用例**:

1. **`.md` / `.txt` 不产生 `docling_markdown`** → 蓝本 `v-if="result.docling_markdown"` **整卡不渲染**。
   要看到 docling 卡只能传 `.docx/.pptx/.xlsx`(🔴 **别传 `.pdf`**,会触发 ~200MB 模型下载)。
   → **用例:两份成功 fixture 都不渲染 docling 卡;另用 mock 造一份带 `docling_markdown` 的验渲染 + 折叠。**
2. **`scored[]` 里没有 `rerank_score`** → 蓝本 `v-if="s.rerank_score !== undefined && s.rerank_score !== null"`
   的 `rr {…}` **一直不渲染**。→ **两侧用例都要**(fixture 的不渲染 / mock 造带 `rerank_score` 的渲染)。
3. 🔴 **本机 reranker 是坏的**:`rerank=true` 实测返回
   `"rerank_error": "XLMRobertaTokenizer has no attribute prepare_for_model"`
   → 勾 rerank 只能看到 `⚠ Reranker error:` 警告条,**永远看不到 `rr` 分数**。
   **这是后端缺陷,已记后端票,本期照抄前端、不修、不绕。** → 用例验警告条渲染。
4. **`params_used.overlap_tokens` 会被后端改写**:`.md` 走 `chunker: "markdown"` → 无论传什么 overlap 都回 **0**;
   `.txt` 走 `chunker: "plain"` → overlap 原样回。**正好对上蓝本那句 `<em>` 提示。**
   → 用例断言 `ok-hint` 里回显的是 **`params_used`(后端回的)**,不是前端传的 `params`。

### 5.1 🔴 四种失败响应 + 一条「不可达分支」纪律

| 情形 | 状态 | 体 | 处置 |
|---|---|---|---|
| `target_tokens=1` 越界 | **400** | `{"detail":"target_tokens must be in [50, 4000]"}` | `.error-box` 显示这句 → **用例** |
| `.bin` 不支持扩展名 | **400** | `{"detail":"extension '.bin' not supported in test sandbox; use .md / source code / .txt / …"}` | 同上 → **用例** |
| 空文件 | **200** | `chunk_count: 0`、`chunks: []`、**无 `query`/`scored`** | 走 `.empty` 空态 → **用例**(真机也可验) |
| **不传 file** | **422** | 🔴 `{"detail":[{...}]}` —— **`detail` 是数组** | 见下 |

🔴 **422 那条:UI 到不了**(`:disabled="!file || loading"` 挡住了没选文件的情况)。
→ **照抄 `detail || e.message || String(e)` 取值链,不许为数组加分支处理**(那会是凭空多出的逻辑);
→ 🔴 **也不许为它写单测**(测一条 UI 到不了的路径 = 空转)。**报告要显式说明为什么不测。**

---

## 6. 测试要求

### 6.1 fixture(§4.4)
🔴 **6 份数据全部「抄进测试 + 注释标出处」,不许运行时读 `.superpowers/`**(照 T3/T5/T6 的 `FIXTURE-COPY` 做法)。
**抄完做程序化逐字节等价校验 + 变异验证,贴输出,不许肉眼比。**
`service.ai.parserTestAnalyze` mock 成 **fixture 原样 snake_case**;失败用 `mockRejectedValue` 造带 `response.data.detail` 的错误对象
(形状照 `.http` fixture 里的真实响应体)。

### 6.2 🔴 §9.2 —— en 档强断言(**本刀 DoD,不靠评审来猎**)
治理 §9.2:凡「必须用键 A、不许用键 B,理由是 en 不同」的条目,**必须有 en 档断言 + 反向断言**。
→ **自己把本页用到的键与既有 `aiKb*` 全表比一遍**,找出「zh 撞车、只有 en 能判别」的键;
有则补 en locale 挂载 + 逐字断言 + `not.toBe(被禁键的 en 值)`;**一个都没有也要在报告里写明「已比对,本页零同族键」**。
⚠️ 已知同族:**N21 #2** 的 `Test Sandbox`(SettingsView)/ `Test sandbox`(ParserStatus)—— 那对横跨 T6/T8,
但**本页若有 `Test sandbox` 相关文案要一并核**。

### 6.3 缺口 ③
补一条「`<template>` 块零裸色」定向断言,**照 T6 的现状写法**(③′ 的贪婪化统一改造归 **T8**),
报告写一句「沿用现状写法,③′ 归 T8」。🔴 `node:fs`,不许 `?raw`。必配 RED 探针
(把裸色塞在**模板最后一个内容行**,证明非贪婪抽取真覆盖到尾部 —— T6/T3 都这么验的)。

### 6.4 治理 §9 的通用纪律(**本期已栽九次,别再栽**)
- 🔴 **注入脚本整段/行首锚定 + 先断言注入真的落盘**(`grep -n`/`md5sum` + `assert hits==1`)。
- 🔴 **报行号的断言用「保行版」剥注释**(第八条)。
- 🔴 **否定式断言(`not.toContain`)必须先剥注释、且钉「调用形状」不钉裸标识符**(第九条,T6 刚栽)。
- 属性态断言直接比字符串值两侧都比,**禁 `toBeUndefined()`**。
- 禁空转;无判别力的断言要 RED 验证并贴两段输出。

### 6.5 必须有的用例(至少)
拖拽三态(`dragover`/`dragleave`/`drop`)· `dragActive` 类切换 · 30MB 拦(**只设 error 不清 file 不发请求**)·
`clearFile` 三清 · `resetParams` · 三个 `v-model.number` · `query` 空时 FormData **无该字段** ·
`rerank`/`ocr` 两态各自的 `'true'`/`'false'` · 提交按钮 `:disabled="!file || loading"` 两侧 ·
`loading` 时文案 `Processing…` · 两份成功 fixture 的完整渲染(chunk 列表 / `dense_preview` / `sparse_top_terms`)·
`scored` 卡两态 · docling 卡两态 + 折叠 · `.empty` 空态 · 两条 400 的 `.error-box` ·
`fmtBytes` 三档边界两侧 · `truncate` 边界 · `chunkText` 找不到时回 `''`

---

## 7. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t7-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t7-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t7-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:文件数 **324 → 325**;`.vue` **177 → 178** → `color-guard` **+1**;再加你新写的用例数。**报告给实测终值。**
- 🔴 **`dist` 里搜不到 `parser-test-page` 是预期**(治理 §12.3 **E-13**):本页此刻**零生产 import**
  (`/ai/parser/test` 仍指占位页,T10 才反转)→ 模块不进 Vite 图 → side-effect scss import 从未求值。
  **那条门已挪 T10,本刀达不到不是缺陷。别为此改路由或改别的文件。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget` ·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build` / `pnpm install`。

---

## 8. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动 + **本刀额外零改动**:`parser-styles.scss` · `parserStyles.test.ts` ·
  `ParserStatus.vue` / `ParserStatus.test.ts` · `parserStore.ts` · `knowledge.scss` · `knowledgeStyles.test.ts` ·
  `src/i18n/*` · `FolderBrowser*` · **`knowledgeRoutes.ts` / `deferred.ts`**。需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **不许新增 i18n 键**(T1 已全落地)。缺键 = T1 漏了 → **`NEEDS_CONTEXT` 停下**。
- ⚠️ **本页此刻未上路由 = 预期**(T10 才反转),别为此改路由。

---

## 9. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-7-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐条对照:**蓝本 `ParserTest.vue:行` → New-UI `:行`**(template `:1-152` + script `:154-243` **全覆盖**)
- 🔴 **K27 落地**:`parserTestAnalyze(fd)` **单参**(证明没重复传 headers/timeout)+ **K1 无 `.data`**
- 🔴 **FormData 九字段的断言**(含 `query` 空时无该字段、`embed` 恒 `'true'`、三个 `String()`)
- 🔴 **K31 两层根元素**的落地
- **§4.2 四条实测事实**逐条对应的用例名
- 🔴 **422 分支为什么不测**的显式说明(UI 不可达 + 取值链照抄)
- **N22「判定不入语言包」清单**(逐处)· **N16 emoji 位置核对表** · **N18 申报**
- **§9.2 的 en 档比对结论**(有同族键就给断言;没有也要写「已比对,零同族键」)
- **§4.4 抄本 + 程序化等价校验 + 变异验证输出**
- **RED 探针的两段输出**(至少 4 条:模板最后一行塞裸色 / K31 压回单元素 / 去掉 `query` 条件 append /
  30MB 拦改成清 `file`)+ 还原确认 + `git status` 干净
- 三门完整终值(含红项完整用例名与归属)
- **§3 的 K1–K33 里本刀命中的每一条显式申报** · **§3.5 的 N1–N22 里本刀命中的**(至少 **N16 / N18 / N22**)
- **`dist` 搜不到 `parser-test-page` 是预期**的说明(E-13)
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · 等价校验结果 · en 档比对结论一行 · RED 探针几条全过 · 顾虑。
