# SP8-P5c · Task 7 报告 —— `ParserTest.vue`(Parser 测试沙盒,`/ai/parser/test`)

**状态:`DONE`** · 起点 `5ccb287`(工作树干净)· 交付 2 个新文件、**零既有文件改动**。

| 交付 | 行数 |
|---|---|
| `src/ai/knowledge/parser/ParserTest.vue`(新建) | 415(其中 131 行是头注释 + 模板内注释) |
| `src/ai/knowledge/parser/ParserTest.test.ts`(新建) | 1046,**79 例** |
| `.superpowers/sdd/p5c-task-7-fixture-verify.mjs`(新建,台账) | fixture 等价校验脚本 |

**范围**:蓝本 369 行中的 `<template>` `:1-152` + `<script>` `:154-243` = **242 行**。
`<style lang="scss" scoped>` `:245-369`(125 行)**T2b 已搬完并过评审** → 本文件**零 `<style>` 块**,
样式走 `import '../../styles/parser-styles.scss'`(K24)。

---

## 1. 三门终值(全量,输出完整落盘)

```
pnpm test                  exit=0    Test Files  325 passed (325)
                                          Tests  3379 passed (3379)
pnpm exec vue-tsc --noEmit exit=0    (输出 0 行)
pnpm build                 exit=0    ✓ built in 12.52s
```

**零红项、零复跑**(两条已知噪声 `persist.test.ts` / `AgentComposer.test.ts` 本轮均未触发)。

**算术核对(与 brief §7 的预测逐项对上)**:

| 量 | 起点(T6 收官实测) | 预测 | 实测终值 |
|---|---|---|---|
| Test Files | 324 | 325 | **325** ✅ |
| Tests | 3299 | 3299 + 1(color-guard)+ 新用例 | **3379** = 3299 + 1 + **79** ✅ |
| `.vue` 总数 | 177 | 178 | **178**(`find src -name "*.vue" \| wc -l`)✅ |

台账(治理 §8.1)推进:T3 176 → T6 177 → **T7 178** → T8 179(收官)。

### 🔴 `dist` 里搜不到 `parser-test-page` —— 预期(治理 §12.3 **E-13**)

```
$ grep -c "parser-test-page"   dist/assets/*.css   →  全部 0
$ grep -o "parser-status-page" dist/assets/*.css   →  0 命中(T6 那页同样如此)
```
本页此刻**零生产 import**(`/ai/parser/test` 在 `knowledgeRoutes.ts` 仍指占位页,T10 才反转)
→ 模块不进 Vite 图 → side-effect scss import **从未求值**。
**那条门已挪 T10;本刀达不到不是缺陷。未为此改路由、未改任何别的文件。**
(顺带实证:T6 那页也同样搜不到 —— 这两页共用同一个 `parser-styles.scss`,进不进产物取决于
「有没有被入口可达地 import」,与文件里写不写 import 无关。)

---

## 2. 逐条对照:蓝本 `ParserTest.vue:行` → New-UI

### 2.1 `<template>`(蓝本 `:1-152` 全覆盖)

| 蓝本 | 内容 | New-UI |
|---|---|---|
| `:1` | `<template>` | `:283`(SFC 块顺序改成 script-first,本仓惯例) |
| — | **K31 外层 `.parser-app`**(蓝本没有) | `:284` |
| `:2` | `<div class="parser-test-page">` | `:289`(内层) |
| `:3-6` | 页头:`<h2>` + `← 返回详情` router-link | `:291-294` |
| `:8-18` | help 卡两段(第二段两个 `<code>`) | `:298-309` |
| `:21-37` | dropzone:三个拖拽事件 + hidden file input + 未选/已选两分支 | `:312-331` |
| `:39-53` | 三个参数 `<label class="param">` + 重置按钮 | `:335-349` |
| `:54-57` | `.hint-line` + `<em>` | `:350-353` |
| `:59-71` | query 输入 + rerank 勾选 + OCR 勾选 | `:355-368` |
| `:73-90` | 提交按钮(`:disabled` / loading 文案)+ ok-hint(含 `<em v-if="params_used">`) | `:370-393` |
| `:92` | `<div v-if="error" class="error-box">` | `:395` |
| `:96` | `<template v-if="result">` | `:399` |
| `:97-104` | docling 卡(折叠箭头 + `v-show` 的 `<pre>`) | `:400-409` |
| `:106-124` | scored 卡(标题 / `⚠` 警告条 / `<ul>` + rank-line 四格 + rank-text) | `:411-432` |
| `:126-149` | chunks 卡(标题 / `.empty` 空态 / `<ul>` + chunk-head + `<pre>` + 两条 emb-preview) | `:434-462` |
| `:150-152` | 三个闭合 | `:463-467`(多一个 K31 外层闭合) |

### 2.2 `<script>`(蓝本 `:154-243` 全覆盖)

| 蓝本 | 内容 | New-UI |
|---|---|---|
| `:155` | `import { api } from '@/service/service.js'` | `:134` `import { service } from '@nimotech/nimoos-service'`(K27) |
| — | K24 样式 import(蓝本在 `<style>` 里) | `:135` |
| `:159-176` | `data()` 的 10 项 | `:194-211`(全部组件本地 `ref`,治理 §5.1:不塞 store) |
| `:170-174` | `params: {600, 80, 2}` | `:204-208`(用 `ref` 而非 `reactive` —— 蓝本 `resetParams` 是**整体重新赋值**) |
| `:27` `ref="fileInput"` | 模板 ref | `:214`(机械改写 1) |
| `:178-182` | `onDrop(e)` | `:217-221` |
| `:183-192` | `onFile(f)` —— 30 MB 拦 | `:231-239` |
| `:193-197` | `clearFile()` 三清 | `:242-246` |
| `:198-200` | `resetParams()` | `:249-251` |
| `:201-227` | `submit()` —— FormData 九字段 + K27 + K1 + catch 取值链 | `:263-289` |
| `:228-231` | `chunkText(chunkNo)` | `:292-295` |
| `:232-235` | `truncate(s, n)` | `:298-301` |
| `:236-240` | `fmtBytes(n)` | `:309-313` |

### 2.3 程序化等价核对(不是肉眼比)

剥注释(保行版)后按元素/指令计数对齐:

```
v-for              蓝本   2   新   2   OK
v-model.number     蓝本   3   新   3   OK
v-model=           蓝本   3   新   3   OK
v-if               蓝本  12   新  12   OK
v-else             蓝本   2   新   2   OK
v-show             蓝本   1   新   1   OK
@click             蓝本   5   新   5   OK
@change/@drop/@dragover/@dragleave  各 1  新 各 1   OK
:disabled 1 · :key 2 · :placeholder 1 · :class 1(字面量逐字相同)  OK
<div  蓝本  21   新  22   OK(+1 = K31 外层 div,唯一差异)
<span 10 · <button 5 · <input 7 · <label 5 · <code 4 · <strong 3 · <em 2 · <pre 2
<h2 1 · <h3 2 · <ul 2 · <li 2 · <header 1 · <p 2 · <template 2      全部 OK
静态 class 集合:蓝本 48 个 → 新 49 个,**多出的只有 `parser-app`,缺少 0 个**
$t 调用数:蓝本 23 → 新 23(`aiKbPt*` 去重 23 个,一一对应)
```

---

## 3. K / N 逐条显式申报

### 3.1 命中的 K(治理 §3 的 K1–K33)

| # | 落地 |
|---|---|
| **K1** | **单层取数**。蓝本 `:220` `this.result = resp.data`;包内已 `return res.data`(`ai.ts:679`)→ 本仓 `result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult`,**没有 `.data` 那一层**。用例:「K1 的渲染侧证据」+ 源码否定式断言 `not.toMatch(/parserTestAnalyze\([^)]*\)\s*\)?\s*\.data/)` |
| **K24** | `parser-styles.scss` 走 **JS 侧 side-effect import**,本文件**零 `<style>` 块**。用例:「本文件零 `<style>` 块」(`not.toMatch(/^<style/m)` + `toContain` import 语句) |
| **K27** | `api.post('/ai/parser/test/analyze', fd, {headers, timeout})` → `service.ai.parserTestAnalyze(fd)` |
| **K31** | 根元素**两层**:`<div class="parser-app"><div class="parser-test-page">` |

🔴 **K27 落地的证明(brief §9 点名要求)**:

```ts
expect(ai.parserTestAnalyze).toHaveBeenCalledTimes(1)
expect(ai.parserTestAnalyze.mock.calls[0]).toHaveLength(1)      // 实参个数恰好 1
expect(ai.parserTestAnalyze.mock.calls[0]![0]).toBeInstanceOf(FormData)
expect(src).toContain('result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult')
expect(src).not.toMatch(/parserTestAnalyze\(\s*fd\s*,/)          // 没有第二个实参
expect(src).not.toContain("'Content-Type': 'multipart/form-data'")
expect(src).not.toContain('timeout: 120000')
```
(`src` 是 **`blankComments()` 剥注释后**的源码 —— 治理 §9 第九条:本文件头注释里就写着
`service.ai.parserTestAnalyze(fd)` / `multipart/form-data` / `timeout:120000` 这些字样,
不剥注释这三条否定式断言会**假报红**。RED 探针 F 已证明剥注释后仍有判别力。)

`ai.ts:669-679` 的注释原文确认包内已带这两项:
> 「与 Vue2 src/views/AI/Parser/ParserTest.vue:207-219 逐字对齐 …… 这里只负责补 multipart 头 +
>  单独放宽到 120s 超时(而非全局默认超时)」

🔴 **K31 落地**:
```ts
expect((w.element as HTMLElement).className).toBe('parser-app')        // 根元素只有外层类
expect(root.classList.contains('parser-test-page')).toBe(false)
expect(w.find('.parser-app > .parser-test-page').exists()).toBe(true)  // 内层是直接子元素
expect(w.findAll('.parser-app')).toHaveLength(1)                        // 各恰好一个
expect(w.findAll('.parser-test-page')).toHaveLength(1)
expect(w.find('.parser-test-page > .page-header').exists()).toBe(true)  // 内容真在内层
```
选择器与 T2b 的 scss 对上:`parser-styles.scss:162` 是**后代**形式 `.parser-app .parser-test-page`。
RED 探针 B(压回单元素)两条全红 ✅。

### 3.2 命中的 N(治理 §3.5)

| # | 照抄内容 | 证据 |
|---|---|---|
| **N16** | emoji / 符号位置一个都没挪 | 见 §4 的核对表 + 两条专门用例 |
| **N18** | `result.scored.indexOf(s) + 1` 当排名序号 | 模板 `:424` 逐字照抄;**未**改成 `v-for="(s, i)"` 取 `i+1`。用例用「`chunk_no` 与数组位置故意错开」的 mock 钉住「序号跟数组位置走」;源码断言钉 `#{{ result.scored.indexOf(s) + 1 }}` 与 `v-for="s in result.scored"` 两个形状。RED 探针 G 报红 ✅ |
| **N22** | 15 串技术标识符**一个都没补 i18n 键** | 见 §5 清单 |

**未命中**:N15 / N17 / N19 / N20 / N21(那几条属 ParserStatus / SettingsView / scss)。
**K21/K22/K23/K25** 是 scss 侧的偏离(T2b 已落地),本刀只是它们的**消费方**,不重复申报落地动作;
其中 **K25**(Parser 两页暗色档与 Vue2 不同,Vue2 只有浅色一套)对本页同样成立 —— 本文件零颜色声明,
颜色全部来自 `.knowledge-app, .parser-app` 共享 token 块(K21)。

---

## 4. N16 —— emoji / 符号位置核对表(逐处回源核过)

| 符号 | 码点 | 蓝本位置 | 在 `$t()` 里还是外 | New-UI |
|---|---|---|---|---|
| `←` | U+2190 | `:5` | **外**(`← {{ $t('Back to details') }}`) | 外,`:293` |
| `×` | U+00D7 | `:35` | **外**(`<button class="clear-btn">×</button>`) | 外,`:329` |
| `✓` | U+2713 | `:80` | **外**(ok-hint 首字符) | 外,`:387` |
| `·` | U+00B7 | `:80`/`:81`/`:82`(ok-hint 三个分隔点) | **外** | 外,`:387-389` |
| `·` | U+00B7 | `:136`(`tokens · offset`) | **外** | 外,`:449` |
| `·` | U+00B7 | `:145`(`join(' · ')`) | **外** | 外,`:461` |
| `▼` / `▶` | U+25BC / U+25B6 | `:100` | **外**(三元字面量) | 外,`:403` |
| `⚠` | U+26A0 | `:110` | **外**(`⚠ Reranker error:`) | 外,`:419` |
| `…` | U+2026 | `:141`(`, …]`) | **外** | 外,`:456` |
| `…` | U+2026 | `:234`(`truncate` 截断号) | **script 产生** | script,`:300` |
| `…` | U+2026 | `$t('Processing…')` | 🔴 **在键值里**(`aiKbPtProcessing`) | 键值里 |
| `–` | U+2013 | `$t('Defaults: … 600/80/5–20).')` | 🔴 **在键值里**(`aiKbPtDefaults`) | 键值里 |
| `（）；，。` | 全角 | 11 个键的 zh 值里 | **在键值里**(附录 A §A.5 的 18 条例外) | 键值里 |

🔴 **brief §4.3 的错(登记 E-15)**:brief 写「`🧪`(标题)」—— **本页标题没有 `🧪`**。
蓝本 `:4` 是纯 `<h2>{{ $t('Parser test sandbox') }}</h2>`;`🧪` 在 `ParserStatus.vue:6`
(`🧪 {{ $t('Test sandbox') }}`)与 `SettingsView.vue:162`,**不在本页**。
用例已反向钉住:`expect(w.find('.page-header').text()).not.toContain('🧪')`。

守卫做法:一条用例断言本页 **23 个键**的 zh/en 值**都**扫不出 `[←✓⚠×▼▶🧪→]`
(证明符号在模板/script 里、不在语言包里),另一条断言模板里「符号 → 一个空格 → 文案」的顺序;
再反向钉 `aiKbPtProcessing` 的 `…` **确实在**键值里。

---

## 5. N22 —— 「判定不入语言包」清单(逐处)

| # | 串 | 蓝本行 | 性质 |
|---|---|---|---|
| 1 | `rerank top-20` | **`:65`**(治理 §3.5 写 `:66`,偏 1 行 → **E-16**) | 功能标识符 |
| 2 | `⚠ Reranker error:` | `:110` | 后端字段名的英文标签 |
| 3 | `dense [0:8]:` | `:140` | 向量切片标识 |
| 4 | `sparse top:` | `:144` | 同上 |
| 5 | `chunk #` | `:119`(scored)· `:135`(chunks) | 数据结构名 |
| 6 | `cos ` | `:116` | cosine similarity 缩写 |
| 7 | `rr ` | `:118` | rerank score 缩写 |
| 8 | `target_tokens` `<label>` | `:41` | **API 参数名** |
| 9 | `overlap_tokens` `<label>` | `:45` | 同上 |
| 10 | `min_tokens` `<label>` | `:49` | 同上 |
| 11 | `chunker=… , target=… , overlap=… , min=…` | `:84-87` | 参数名回显 |
| 12 | `{{ c.token_count }} tokens · offset {{…}}-{{…}}` | `:136` | 单位词 + 字段名 |
| 13 | ` chunks ·`(ok-hint 里的单位词) | `:80` | 单位词 |
| 14 | `<code>.md .txt .html .json .csv .py .go .ts .java</code>` | `:14` | 扩展名清单 |
| 15 | `<code>.pdf .docx .pptx .xlsx</code>` | `:15` | 同上 |

**一个都没补键。** 守卫两条(都有真判别力):
1. 15 串在 **zh + en 两档共 3006 个值**里**零命中**(既非某键的完整值、也不是任何键值的子串)
   —— 若有人加 `aiKbPtRerankTop20: 'rerank top-20'`,本条立刻报红。已程序化实测两档各 1503 键。
2. 15 串在**剥注释后的模板**里逐串命中(证明它们是裸文本,不经 `t()`)。

---

## 6. 🔴 FormData 九字段的断言

```ts
// query 非空(先 setValue('probe')):九项里的八项 —— 顺序、值逐字
expect(lastFormEntries()).toEqual([
  ['file',           'File(p5c-probe.md,50)'],
  ['query',          'probe'],
  ['embed',          'true'],   // 🔴 恒 'true'(蓝本 :210 是字面量,不跟任何开关)
  ['rerank',         'false'],
  ['ocr',            'false'],
  ['target_tokens',  '600'],    // String()
  ['overlap_tokens', '80'],     // String()
  ['min_tokens',     '2'],      // String()
])

// 🔴 query 为空 → **确实没有这个字段**
expect(entries.map(([k]) => k)).toEqual(
  ['file','embed','rerank','ocr','target_tokens','overlap_tokens','min_tokens'])
expect(entries.map(([k]) => k)).not.toContain('query')
expect(fd.getAll('query')).toEqual([])
expect(fd.has('query')).toBe(false)
```
另外四条:`rerank` 单勾 / `ocr` 单勾 / 两个都勾 / `embed` 不受任何开关影响。
`v-model.number` 三处:用**带尾随零的小数** `600.50` 才有判别力
(整数下 `String(700)` 与 `String('700')` 完全一样 → 那种断言零判别力;
`.number` → 数值 600.5 → `'600.5'`,裸 `v-model` → `'600.50'`)。RED 探针 C / E 各报红 ✅。

---

## 7. 🔴 422 分支为什么不测(brief §9 点名要求)

| 事实 | 依据 |
|---|---|
| 后端返 **422** + `{"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required","input":null}]}` —— `detail` 是**数组** | fixture `parser-test-analyze-422-no-file.http`(T0 真机实测) |
| **UI 到不了**:提交按钮 `:disabled="!file \|\| loading"`(蓝本 `:76`)挡住「没选文件就提交」;`submit()` 开头 `if (!this.file) return`(`:202`)再挡一道 | 蓝本源码 |
| 处置:**照抄 `detail \|\| e.message \|\| String(e)` 取值链,不为数组加分支;不写单测** | 治理 §4.2 / §5.1 / brief §5.1 |

**做法**:那份响应体**逐字抄进测试文件的头注释**(满足治理 §6.1「6 份全部抄进测试 + 注明出处」),
**不建常量、不写用例** —— 测一条 UI 到不了的路径 = 空转。
等价校验脚本从注释里抽那行 JSON 一并校验(§9 的 `NO_FILE_422 (注释抄本)` 那行,89 bytes MATCH)。

**实际写了单测的失败路径 5 条**(都是可复现的):两条 400(字符串 `detail`)· 取值链第二档
`response.data.error` · 第三档 `e.message`(无 response 的网络错误)· 第四档 `String(e)`(message 为空)。
另有一条「失败后 `finally` 里 `loading` 归位」。

**同时申报**:`submit()` 开头那道 `if (!file) return` 守卫**有**单测
(用 DOM 强解禁按钮后点击 → 零请求)—— 它与 422 不是同一件事:守卫本身是蓝本 `:202` 的代码路径,
可达且可测;不可达的是「请求真的发出去、后端返 422」那一段。

---

## 8. 治理 §4.2 四条实测事实 → 对应用例名

| 事实 | 用例名 |
|---|---|
| ① `.md`/`.txt` 不产生 `docling_markdown` → docling 卡整卡不渲染 | 「🔴 事实①:两份成功 fixture(`.md` / `.txt`)都**不产生 `docling_markdown`** → 整卡不渲染」 |
| ① 的正侧(mock 造一份验渲染 + 折叠) | 「mock 造一份带 `docling_markdown` 的:折叠按钮文案 `▶ docling 转出的 markdown（N 字符）`,默认折起」+「点折叠按钮 → 箭头翻成 `▼`、`<pre>` 可见;再点收回」 |
| ② `scored[]` 无 `rerank_score` → `rr` 不渲染 | 「🔴 事实②:`scored[]` 无 `rerank_score` → `rr {…}` 整格不渲染(双守卫的假侧)」 |
| ② 的正侧 + `null` 侧 | 「rerank_score 有值时才渲染 `rr`(mock 造,本机永远看不到)」+「`rerank_score: null` 仍不渲染」 |
| ③ 本机 reranker 坏 → 只能看到 `⚠ Reranker error:` | 「🔴 事实③:txt-rerank(勾了 rerank)→ `⚠ Reranker error:` 警告条渲染,且仍无 rr」 |
| ③ 的假侧 | 「`rerank_error` 缺席 → 警告条不渲染(md-ok 那份)」 |
| ④ `params_used.overlap_tokens` 被后端改写 | 「🔴 事实④:回显的是**后端回的 params_used**,不是前端传的 params —— `.md` 传 80 回 0」+「🔴 事实④ 的另一半:`.txt` 走 plain chunker → overlap 原样回 10」 |
| 空文件 200(治理 §13 真机可验那档) | 「🔴 `.empty` 空态(200 + chunk_count 0 + chunks []):治理 §13 真机可验的那一档」 |

**未修、未绕、未记新票** —— 三条后端相关事实全部当预期行为写进用例。
(治理 §8.2 已登记的两条后端票不重复开。)

---

## 9. §4.4 —— fixture 抄本 + 程序化等价校验 + 变异验证

**抄本生成**:一次性脚本从 fixture 直接生成(零人工转写),`FIXTURE-COPY-BEGIN/END` 块标出处 + 抓取日期。
**不用 `node:fs` 运行时读 `.superpowers/`**(治理 §4.4:那个目录被 gitignore 盖着,SP7 整个丢过一次)。

校验脚本:`.superpowers/sdd/p5c-task-7-fixture-verify.mjs`

```
$ node .superpowers/sdd/p5c-task-7-fixture-verify.mjs
=== 等价校验(期望全部 MATCH)===
MATCH     MD_OK                    664 bytes  <- parser-test-analyze-md-ok.json
MATCH     TXT_RERANK               888 bytes  <- parser-test-analyze-txt-rerank.json
MATCH     EMPTY_200                194 bytes  <- parser-test-analyze-200-empty-file.http
MATCH     ERR_400_TARGET           48 bytes   <- parser-test-analyze-400-target-tokens.http
MATCH     ERR_400_EXT              150 bytes  <- parser-test-analyze-400-bad-ext.http
MATCH     NO_FILE_422 (注释抄本)     89 bytes   <- parser-test-analyze-422-no-file.http
---- 等价校验:6/6 MATCH
exit=0
```

**变异验证(证明校验脚本不是空转)** —— 每份各改一个字节:

```
$ node .superpowers/sdd/p5c-task-7-fixture-verify.mjs --mutate
=== 变异验证(每份各改一个字节,期望全部 MISMATCH)===
MISMATCH  MD_OK                    offset 37: 抄本 U+0036 ("6") vs fixture U+0035 ("5")
MISMATCH  TXT_RERANK               offset 34: 抄本 U+0036 ("6") vs fixture U+0035 ("5")
MISMATCH  EMPTY_200                offset 37: 抄本 U+0036 ("6") vs fixture U+0035 ("5")
MISMATCH  ERR_400_TARGET           offset 37: 抄本 U+0036 ("6") vs fixture U+0035 ("5")
MISMATCH  ERR_400_EXT              offset 2: 抄本 U+005A ("Z") vs fixture U+0064 ("d")
MISMATCH  NO_FILE_422 (注释抄本)     offset 2: 抄本 U+005A ("Z") vs fixture U+0064 ("d")
---- 变异验证:6/6 份被抓到(应为 6/6)
```

**判据强度说明**:比的不是原文缩进,而是 `JSON.parse` → `JSON.stringify` 的 canonical 字节串。
`JSON.stringify` 保留插入顺序 → 这一次比对同时钉住了**键顺序 / 值 / 类型**三件事。

### mock 形状的层次(治理 §4.1 的五行表,本刀只命中第一行)

| mock 的 | 形状 | 依据 |
|---|---|---|
| `service.ai.parserTestAnalyze` | 🔴 **HTTP 原样 snake_case** = fixture 原文,一字不改 | `ai.ts:673-680` 只 `return res.data`,零转换 |

本页**不用任何 store**(蓝本 data() 的 10 项全是页面级瞬态)→ `notes.*` / `folder.getList` /
`wiki.getCandidates` 三行**本刀不涉及**。
失败侧用 `mockRejectedValue(httpError(status, data))` 造带 `response.data.detail` 的错误对象,
`data` 直接取 `.http` fixture 的**真实响应体**抄本。

---

## 10. 🔴 §9.2 —— en 档强断言(本刀 DoD)

**做法**:把本页 23 个键的 zh 值与 **New-UI 全表 1503 键**(不只 `aiKb*` 的 295 个)做程序化撞车扫描。
实测结果:

| 本页键 | zh | 撞车的键 | en 对比 | 判别力 |
|---|---|---|---|---|
| `aiKbPtProcessing` | 处理中… | `appsWorking` | `Processing…` vs **`Working…`** | 🔴 **只有 en 能判别** |
| `aiKbPtReset` | 重置 | `filesViewerReset` | `Reset` vs `Reset` | EN-SAME(渲染断言零判别力) |
| `aiKbPtRun` | 运行 | `aiSkTestRun` | `Run` vs `Run` | EN-SAME(同上) |

→ **结论:本页有 1 对「zh 撞车、只有 en 能判别」的同族键**(不是零),已按治理 §9.2 补齐:

```ts
// 正向:en locale 挂载,逐字断言
expect(w.find('.submit-btn').text()).toBe('Run')          // 落地态
expect(w.find('.submit-btn').text()).toBe('Processing…')  // 在飞态
// 🔴 反向:不许出现被禁复用键的 en 值
expect(w.find('.submit-btn').text()).not.toBe('Working…')
expect(w.text()).not.toContain('Working…')
// 反过来实证「只有 en 能判别」
expect(zh.aiKbPtProcessing).toBe(zh.appsWorking)          // zh 逐字相同
expect(en.aiKbPtProcessing).not.toBe(en.appsWorking)
```
另两对 EN-SAME 的按 T6 对裁定 A-1 的同款处置 —— **只能靠源码键名守**
(`toContain("t('aiKbPtReset')")` + `not.toMatch(/\bt\(\s*['"]filesViewerReset['"]/)`,
钉「调用形状」而不是裸标识符,治理 §9 第九条)。
再加一条 en 档整页关键文案逐字断言(证明 23 个键全部走对了 en 值)+ 一条「切回 zh 无污染」。
`locale` 是全局单例 → `try/finally` 还原(承 T6 写法)。

⚠️ **N21 #2 的 `Test Sandbox` / `Test sandbox`(横跨 T6/T8)与本页无关** ——
本页标题键是 `aiKbPtTitle`(`Parser test sandbox` / `Parser 测试沙盒`),与那两个键 zh/en 双双不同,
已回源核过,**本页不需要为它补断言**。

---

## 11. 守卫缺口③ —— `<template>` 块零裸色

补一条定向断言,**沿用现状写法**(非贪婪 + 隐式靠「`</template>` 在第 0 列」锚定,先例
`ParserStatus.test.ts` / `QueueView.test.ts` / `IndexedFilesView.test.ts`);
治理 §9 缺口 **③′ 的「统一改成贪婪匹配 + 覆盖度自检」归 T8**,本刀不动它。
读源文件用 **`node:fs`**,不用 Vite 的 `?raw`。

覆盖度自检两条(首部 + **尾部**特征串):
```ts
expect(tmpl).toContain("t('aiKbPtTitle')")        // 首部(页头 h2)
expect(tmpl).toContain("join(' · ') }}</code>")   // 尾部(chunks 卡最后一行内容)
```
本组件唯一的嵌套 `<template v-if="result">` **带属性**(不是裸 `<template>`)、其闭合标签也是缩进的
→ 不会把第 0 列的 `</template>` 提前截断。
RED 探针 A(**在模板最后一个内容行**塞 `#abcdef`)精确报红 ✅。

另两条同族:「本文件零 `<style>` 块」·「零 KIcon」(源码 `not.toMatch(/^import KIcon/m)` + 渲染 `svg` 数为 0)。

---

## 12. RED 探针(7 条,全部报红 + 还原确认)

每条探针都**先断言注入真的落盘**(md5 变化 + 行首行尾锚定的 `grep -c` 命中数),
再看测试结果,最后还原并**核 md5 与原文逐字节一致**(治理 §9 第七条:探针假失效比断言假通过更危险)。

```
--- PROBE A 模板最后内容行塞裸色 #abcdef
    exit=1  Tests 1 failed | 78 passed (79)
    RED: 守卫缺口③:<template> 块零裸色字面量 > …不含任何裸 hex / rgb / hsl 字面量
    期望报红 1/1  OK      还原后 md5 一致: True

--- PROBE B K31 压回单元素(去外层开/闭标签 + 合并两个类)
    注入落盘校验 grep -c '^  <div class="parser-app parser-test-page">$' = 1
    外层单独元素残留 grep -c '^  <div class="parser-app">$' = 0
    exit=1  Tests 2 failed | 77 passed (79)
    RED: K31 两层根元素 > 根元素只有 .parser-app(不带 .parser-test-page)
    RED: K31 两层根元素 > .parser-test-page 是 .parser-app 的直接子元素,且两者各恰好一个
    期望报红 2/2  OK      还原后 md5 一致: True

--- PROBE C query 改成无条件 append
    exit=1  Tests 1 failed | 78 passed (79)
    RED: 🔴 K27 / K1 / FormData 九字段 > 🔴 query 为空时**确实没有 `query` 这个字段**
    期望报红 1/1  OK      还原后 md5 一致: True

--- PROBE D 30MB 拦改成"顺手清掉 file"
    exit=1  Tests 1 failed | 78 passed (79)
    RED: 🔴 30 MB 前端拦 > 🔴 超一字节就拦:出错误框、**已选文件与已有结果都不动**、零请求
    期望报红 1/1  OK      还原后 md5 一致: True

--- PROBE E 去掉三处 `v-model.number` 的 `.number`
    exit=1  Tests 1 failed | 78 passed (79)
    RED: 三个参数输入 + resetParams > 🔴 `v-model.number` 三个都真的转成 number
    期望报红 1/1  OK      还原后 md5 一致: True

--- PROBE F K27 违规:给 parserTestAnalyze 再传一遍 headers/timeout
    exit=1  Tests 1 failed | 78 passed (79)
    RED: 🔴 K27 / K1 / FormData 九字段 > 🔴 K27:`parserTestAnalyze(fd)` **单参**调用
    期望报红 1/1  OK      还原后 md5 一致: True

--- PROBE G N18 改成 `v-for="(s, i)"` 取 `i + 1`
    exit=1  Tests 1 failed | 78 passed (79)
    RED: scored 卡两态 + N18 > 🔴 N18:序号是 `scored.indexOf(s) + 1`(**数组位置**),与 chunk_no 无关
    期望报红 1/1  OK      还原后 md5 一致: True

==== 全部探针通过:True (7/7)
```

**探针脚本自身的自检**:每条 `mutate()` 前先 `assert` 目标字符串出现次数恰为 1
(A 用「行内唯一命中行」定位、B 用**整行行首行尾**相等、C/D/E/F/G 用 `count(...)==1`)——
避免撞注释造成「注入假落盘 → 伪造出守卫无效的假结论」(治理 §9 第七条,T2b 栽过)。

`git status` 探针前后均只有那两个新文件(见 §14)。

---

## 13. brief 勘误(回权威源核出,登记 2 条)

| # | brief 原文 | 权威源实际 | 处置 |
|---|---|---|---|
| **E-15** | §4.3「`🧪`(标题)· `← {{ $t('Back to details') }}` …」把 `🧪` 列进本页 N16 清单 | **本页零 `🧪`**。蓝本 `:4` 是纯 `<h2>{{ $t('Parser test sandbox') }}</h2>`;`🧪` 在 `ParserStatus.vue:6` 与 `SettingsView.vue:162` | 未搬 `🧪`;补一条反向断言 `not.toContain('🧪')` 钉住。N16 核对表见 §4 |
| **E-16** | 治理 §3.5 N22 写 `rerank top-20`(`:66`);brief §4.2 写「约 `:65`」 | **`:65`**(`:64` 是 `<input type="checkbox" v-model="rerank" />`) | brief 的「约 :65」对,治理 §3.5 那个 `:66` 偏 1 行。**内容无误**,与 E-10/E-11 同族 |

**核对通过、未发现错的**:brief §3 的 FormData `:208-217` 与取值链 `:221-224` 范围 ✅ ·
§4.1 的 N18 `:115` ✅ · §4.2 的 `:110`/`:140`/`:144`/`:119`/`:135`/`:116`/`:118`/`:41`/`:45`/`:49`/`:84-87`/`:136`
**11 组行号全对** ✅ · §4.4 的 8 条 script 照抄要点(含 `30 * 1024 * 1024` / `600,80,2` / 三档 `fmtBytes`)逐字对 ✅ ·
§5.1 四种失败响应的状态码与体 ✅ · §2 的两层根元素与 §6.1 的 `parser-styles.scss:162` 后代选择器 ✅ ·
§7 的三个算术数(325 / 178 / +1)✅ · `ai.ts:673-680` 的包签名与注释 ✅。

⚠️ **计划书 `p5c-plan.md` 的 T7 节最后一条仍写着「根元素 `class="parser-app parser-test-page"`」**
—— 那是 K31 之前的单元素写法(与 T6 那行同族,治理 §12.3 E-14 已订正 T6 的)。
**本刀按 K31 写两层,未照计划书那行。** 计划书未改(不在本刀交付范围;登记给协调者)。

---

## 14. 硬约束自查

- **零既有文件改动**:`git status --short` 全程只有两个 `??`(新文件)+ 台账两个 `git add -f`。
  §1.1 全期零改动清单一行未动;`parser-styles.scss` / `parserStyles.test.ts` / `ParserStatus.vue` /
  `ParserStatus.test.ts` / `parserStore.ts` / `knowledge.scss` / `knowledgeStyles.test.ts` /
  `src/i18n/*` / `FolderBrowser*` / `knowledgeRoutes.ts` / `deferred.ts` **全部未碰**。
- **未新增 i18n 键**:本页 23 个 `aiKbPt*` 键 T1 已全部落地(逐个核过 `zh_cn.ts:1674-1696` /
  `en_us.ts:1647-1669` 存在且值与附录 A 逐字一致),**零缺键、零新增**。
- 未 `git add -A` / `git add .`;未 rebase / reset / stash / merge / push;未跑 `deploy.sh`;
  未写 `/var/lib`;未改任何后端仓;未动 `:5288` 的 dev server。
- 未碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`。
- 蓝本一律 `git show main:` 读取,未在 `NimoOS-UI` checkout / stash / 提交
  (只 `git show main:… > /tmp/bp-ParserTest.vue` 供程序化对照)。
- 未创建 `parserStyles.test.ts` 白名单相关的任何改动(附录 D §D.2 的 70 类里
  ParserTest 侧那 48 个 T2b 已登记,本刀的模板类名是它的子集,零新类)。

---

## 15. 已授权之外的自主决定(4 处机械改写,均为类型安全,渲染与行为零变化)

在文件头注释里已逐条登记,**不另开 K 编号**(与 T6 对 `($event.target as HTMLInputElement).checked`
的同款处置,先例 `ChannelsSection.vue:354`):

1. `$refs.fileInput.click()`(蓝本 `:29`)→ `<script setup>` 的模板 ref `fileInput?.click()`。
   Vue 3 `<script setup>` 里没有选项式 `$refs`。
2. `onFile($event.target.files[0])`(`:27`)→ `($event.target as HTMLInputElement).files?.[0]`
   —— `EventTarget` 上没有 `files`,`FileList | null` 不能直接下标。
3. `e.dataTransfer.files && …`(`:180`)→ 前面多一个 `e.dataTransfer &&`
   —— `DragEvent.dataTransfer` 的类型是 `DataTransfer | null`。蓝本在它为 null 时抛 TypeError,
   那是浏览器里到不了的情况(`drop` 事件必带 `dataTransfer`)。
4. `chunkText()` 里 `result.value!.chunks`(蓝本 `:229` 是裸 `this.result.chunks`)——
   用**非空断言**而不是 `?.`:非空断言只是类型层面的说法,`result` 为 null 时**仍抛同一个
   TypeError**,与蓝本语义逐字一致;`?.` 会把它悄悄变成「回空串」= 行为改动。

另申报一处**照抄带来的语言现象**(不是改动):蓝本 `:145` 的箭头函数参数就叫 `t`,
在 `<script setup>` 里会**遮蔽** i18n 的 `t`。**逐字照抄了这个参数名**(改名 = 无关重构);
Vue 编译器的作用域跟踪(`walkIdentifiers`)会把它解析成参数而不是 `$setup.t`,
已有专门用例断言 sparse 那一行渲染成 `151268:0.2153 · 11728:0.2056 · …`(若解析错会变
`undefined:undefined` 或抛错)。

---

## 16. 顾虑 / 交接

1. **`params_used` 缺席那一档是 mock 造的**:六份 fixture 都带 `params_used`,
   蓝本 `:83` 的 `v-if` 假侧在真机验不到 → 用 mock(删字段)覆盖。已在用例注释里说明。
   同理 `rerank_score` 有值 / `docling_markdown` 有值两档也只能 mock 造(治理 §13 已点名)。
2. **`.md`/`.txt` 之外的真机验收**:要看 docling 卡得传 `.docx`/`.pptx`/`.xlsx`,
   🔴 **别传 `.pdf`**(触发 ~200 MB 模型下载)。已写进用例注释,协调者写验收清单时请照抄这条。
3. **计划书 T7 节那行单元素根写法未订正**(§13 末尾)—— 交协调者就地改,避免下游再照旧写法。
4. **E-16 是治理文件 §3.5 N22 里的行号偏差**(`:66` → `:65`),内容无误,交协调者就地订正。
5. 无 `NEEDS_CONTEXT`。
