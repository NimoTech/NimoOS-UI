# SP8-P5c · Task 7 报告 —— `ParserTest.vue`(Parser 测试沙盒,`/ai/parser/test`)

**状态:`DONE`** · 第一轮 `1d589e0`(评审 **Ready to merge**,0 Critical / 1 Info / 2 Minor)
· **本轮收 M-1 / I-1 / M-2**(见 §17)。起点 `5ccb287`,交付 2 个新产品文件、**零既有文件改动**。

| 交付 | 行数(**脚本实测**,I-1 修正) |
|---|---|
| `src/ai/knowledge/parser/ParserTest.vue`(新建) | **485**(其中头注释 `:1-123`) |
| `src/ai/knowledge/parser/ParserTest.test.ts`(新建) | **1412**,**80 例** |
| `.superpowers/sdd/p5c-task-7-fixture-verify.mjs`(新建,台账) | fixture 等价校验脚本 |

**范围**:蓝本 369 行中的 `<template>` `:1-152` + `<script>` `:154-243` = **242 行**。
`<style lang="scss" scoped>` `:245-369`(125 行)**T2b 已搬完并过评审** → 本文件**零 `<style>` 块**,
样式走 `import '../../styles/parser-styles.scss'`(K24)。

---

## 1. 三门终值(全量,输出完整落盘)

**第二轮(收 M-1 / M-2 之后,2026-08-04)**:
```
pnpm test                  exit=0    Test Files  325 passed (325)
                                          Tests  3380 passed (3380)
pnpm exec vue-tsc --noEmit exit=0    (输出 0 行)
pnpm build                 exit=0    ✓ built in 12.71s
```
第一轮(`1d589e0`)是 `325 / 3379`。**用例数 3379 → 3380(+1)**:M-2 把那条 N22 守卫
从「一条宽子串扫描」拆成**两条**(① 精确整值扫描 + ② 键集闭合),**文件数 325 与 `.vue` 178 均不变**。

**零红项、零复跑**(两条已知噪声 `persist.test.ts` / `AgentComposer.test.ts` 本轮均未触发)。

**算术核对(与 brief §7 的预测逐项对上)**:

| 量 | 起点(T6 收官实测) | 预测 | 实测终值 |
|---|---|---|---|
| Test Files | 324 | 325 | **325** ✅ |
| Tests | 3299 | 3299 + 1(color-guard)+ 新用例 | **3380** = 3299 + 1 + **80** ✅(M-2 拆条后 80) |
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

🔴 **New-UI 侧行号由脚本重算于 `0cb1bd5` + 本轮 M-1/M-2 改动的工作树**(I-1;首版行号全面陈旧,
`.vue` 称 415 实为 471 → 本轮再改后为 **485**;`.test.ts` 称 1046 实为 1373 → 本轮为 **1412**)。
重算脚本在**剥注释后的源**上定位(保行版,行号与原文逐行对齐),避免撞头注释里同名的写法。

| 蓝本 | 内容 | New-UI |
|---|---|---|
| `:1` | `<template>` | **`:304`** |
| — | **K31 外层 `.parser-app`**(蓝本没有) | **`:305`** |
| `:2` | 内层 `<div class="parser-test-page">` | **`:310`** |
| `:3-6` | 页头:`<h2>` + `← 返回详情` router-link | **`:312-315`** |
| `:8-18` | help 卡两段(第二段两个 `<code>`) | **`:319-327`** |
| `:21-37` | dropzone:三个拖拽事件 + hidden file input + 未选/已选两分支 | **`:332-352`** |
| `:39-53` | 三个参数 `<label class="param">` + 重置按钮 | **`:356-369`** |
| `:54-57` | `.hint-line` + `<em>` | **`:371-373`** |
| `:59-71` | query 输入 + rerank 勾选 + OCR 勾选 | **`:377-387`** |
| `:74-78` | 提交按钮(`:disabled` / loading 文案) | **`:392-395`** |
| `:79-89` | ok-hint(含 `<em v-if="params_used">`) | **`:401-411`** |
| `:92` | `<div v-if="error" class="error-box">` | **`:414`** |
| `:96` | `<template v-if="result">` | **`:418`** |
| `:97-104` | docling 卡(折叠箭头 + `v-show` 的 `<pre>`) | **`:422-427`** |
| `:106-124` | scored 卡(标题 / `⚠` 警告条 / `<ul>` + rank-line 四格 + rank-text) | **`:431-452`** |
| `:126-149` | chunks 卡(标题 / `.empty` 空态 / `<ul>` + chunk-head + `<pre>` + 两条 emb-preview) | **`:455-481`** |
| `:150-152` | 闭合(多一个 K31 外层闭合) | **`:482-485`** |

SFC 块边界:头注释 `:1-123` · `<script setup lang="ts">` `:124` · `</script>` `:302` ·
`<template>` `:304` · `</template>` `:485`(文件共 **485** 行)。

### 2.2 `<script>`(蓝本 `:154-243` 全覆盖)

| 蓝本 | 内容 | New-UI |
|---|---|---|
| `:155` | `import { api } from '@/service/service.js'` → K27 共享包 | **`:127`** |
| — | K24 样式 import(蓝本在 `<style>` 里 `@import`) | **`:128`** |
| — | 响应形状 5 个 `interface`(本仓新增,HTTP 原样 snake_case) | **`:138-178`** |
| `:159-176` | `data()` 的 10 项 → 组件本地 `ref`(治理 §5.1:不塞 store) | **`:181-196`** |
| `:170-174` | `params: {600, 80, 2}`(用 `ref` 而非 `reactive` —— `resetParams` 是整体重新赋值) | **`:192-196`** |
| `:27` | `ref="fileInput"` 的模板 ref 声明(K34-1) | **`:199`** |
| `:178-182` | `onDrop(e)` | **`:206-210`** |
| `:183-192` | `onFile(f)` —— 30 MB 拦(只设 error、不清 file、不发请求) | **`:219-228`** |
| `:193-197` | `clearFile()` 三清 | **`:231-235`** |
| `:198-200` | `resetParams()` | **`:238-240`** |
| `:201-227` | `submit()` | **`:251-278`** |
| `:208-215` | └ FormData 九字段 | **`:257-265`** |
| `:216-220` | └ K27 单参 + K1 无 `.data` | **`:266`** |
| `:221-224` | └ catch 取值链 | **`:272-274`** |
| `:228-231` | `chunkText(chunkNo)` | **`:281-284`** |
| `:232-235` | `truncate(s, n)` | **`:287-290`** |
| `:236-240` | `fmtBytes(n)` | **`:297-301`** |

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

### 3.1 命中的 K(治理 §3 的 K1–K34)

| # | 落地 |
|---|---|
| **K1** | **单层取数**。蓝本 `:220` `this.result = resp.data`;包内已 `return res.data`(`ai.ts:679`)→ 本仓 `result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult`,**没有 `.data` 那一层**。用例:「K1 的渲染侧证据」+ 源码否定式断言 `not.toMatch(/parserTestAnalyze\([^)]*\)\s*\)?\s*\.data/)` |
| **K24** | `parser-styles.scss` 走 **JS 侧 side-effect import**,本文件**零 `<style>` 块**。用例:「本文件零 `<style>` 块」(`not.toMatch(/^<style/m)` + `toContain` import 语句) |
| **K27** | `api.post('/ai/parser/test/analyze', fd, {headers, timeout})` → `service.ai.parserTestAnalyze(fd)` |
| **K31** | 根元素**两层**:`<div class="parser-app"><div class="parser-test-page">` |
| **K34** | Vue 3 + TS 机械改写 4 处,**全部保抛写法、零行为变化** —— 三列表见 §15 |

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

**一个都没补键。** 守卫三条(🔴 **本轮 M-2 已把第 1 条从宽子串收紧成精确整值,并新增第 2 条**):

1. **① 精确整值扫描**:15 串**都不是** zh/en 两档(各 1503 键)里任何键的**整值**。
   报错消息带 `pack.key`,便于定位;并断言「扫的是全表不是空集合」(`length > 1400`)。
   🔴 **为什么收紧**:首版用 `v-includes(s)` 宽子串扫全包 —— 当前 0 命中,但 `'cos '` / `'rr '` /
   `'chunk #'` 这类**通用子串**将来撞上任何**无关**新键就会**假报红**,正是治理 §9 第九条
   (否定式断言撞无关内容 → 冤枉正确代码 → 诱使去"修"一个没坏的东西)的同族。
2. **② 键集闭合(新增)**:本页模板里 `t()` 的键集**恰好**是那 23 个 `aiKbPt*`
   —— 调用次数 = 23、去重 = 23、排序后集合逐字相等,且 23 个键在两档语言包里都存在。
   🔴 **这才是「有人把技术串补成 i18n 键」的真正判据**:补键必然在模板里多一次 `t()` 调用
   → 键集当场不等。判别力**比宽子串更强**且**零假报红面**。
3. **③ 正向裸文本**:15 串在**剥注释后的模板**里逐串命中(证明它们是裸文本、不经 `t()`)。

**收紧后仍抓得住 —— 两条 RED 探针(§12 的 H / I)**:
- 探针 H:往 `zh_cn.ts` 塞 `aiKbPtRerankTop20: 'rerank top-20'` → **①报红**(1 failed / 80)。
- 探针 I:把模板里的裸 `rerank top-20` 换成 `{{ t('aiKbPtRerankTop20') }}` → **②报红**
  (连带 ③ 与那条 rerank 标签用例也红,共 3 failed / 80 —— 说明这条改动被三层守卫同时逮到)。

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

## 12. RED 探针(**14 条**,全部报红 + 还原确认)

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

### 12.1 第二轮新增 7 条(收 M-1 / M-2,2026-08-04)

**A–G 七条在改动后已全部复跑,结论不变**(B 的注入落盘 grep 仍 1 命中 / 残留 0,
两条 K31 用例照旧报红;其余六条各 1 红)。以下是本轮新增的 7 条:

```
--- PROBE H zh_cn.ts 塞 aiKbPtRerankTop20:'rerank top-20'(验 M-2 的①精确整值扫描)
    注入落盘 grep -c "^  aiKbPtRerankTop20: 'rerank top-20',$" = 1
    exit=1  Tests 1 failed | 79 passed (80)
    RED: 🔴 N22 … > ①15 串技术标识符不是两档语言包里任何键的**整值**(精确相等,不用宽子串)
    期望报红命中 1/1  OK      还原后 md5 一致: True

--- PROBE I 把裸 `rerank top-20` 换成 `{{ t('aiKbPtRerankTop20') }}`(验 M-2 的②键集闭合)
    注入落盘 grep -c "t('aiKbPtRerankTop20')" = 1
    exit=1  Tests 3 failed | 77 passed (80)
    RED: query / rerank / OCR 三个输入 > …rerank 标签是硬编码 `rerank top-20`(N22)
    RED: 🔴 N22 … > ②本页模板里 `t()` 的键集**恰好**是那 23 个 `aiKbPt*`(键集闭合 —— 补一个键就炸)
    RED: 🔴 N22 … > 这 15 串在模板里是**裸文本**(不经 t()),逐串在剥注释后的模板里命中
    期望报红命中 1/1  OK      还原后 md5 一致: True
    (三层守卫同时逮到同一处改动 —— ② 是新增那条,判别力已实证)

--- PROBE J 去掉 `files![0]` 的 `!`(回退成蓝本原样)
    vue-tsc exit=2  error TS 行数=1
    ERR: ParserTest.vue(341,34): error TS2531: Object is possibly 'null'.
    期望 tsc 硬报错  OK      还原后 md5 一致: True

--- PROBE K 去掉 `fileInput!.click()` 的 `!`
    vue-tsc exit=2  error TS 行数=1
    ERR: ParserTest.vue(343,46): error TS18047: '__VLS_ctx.fileInput' is possibly 'null'.
    期望 tsc 硬报错  OK      还原后 md5 一致: True

--- PROBE L 去掉 onDrop 两处 `e.dataTransfer!` 的 `!`(回退成蓝本原样)
    vue-tsc exit=2  error TS 行数=2
    ERR: ParserTest.vue(208,13): error TS18047: 'e.dataTransfer' is possibly 'null'.
    ERR: ParserTest.vue(208,37): error TS18047: 'e.dataTransfer' is possibly 'null'.
    期望 tsc 硬报错  OK      还原后 md5 一致: True

--- PROBE N 去掉 `result.value!.chunks` 的 `!`(回退成蓝本原样)
    vue-tsc exit=2  error TS 行数=1
    ERR: ParserTest.vue(282,13): error TS18047: 'result.value' is possibly 'null'.
    期望 tsc 硬报错  OK      还原后 md5 一致: True

--- PROBE O 去掉 `$event.target as HTMLInputElement` 的 `as`(回退成蓝本原样)
    vue-tsc exit=2  error TS 行数=2
    ERR: ParserTest.vue(341,34): error TS18047: '$event.target' is possibly 'null'.
    ERR: ParserTest.vue(341,48): error TS2339: Property 'files' does not exist on type 'EventTarget'.
    期望 tsc 硬报错  OK      还原后 md5 一致: True

==== 本轮探针: 7 / 7  全过: True
```

🔴 **J/K/L/N/O 五条是 K34「真机械必需」的判据**:回退成蓝本原样时 `vue-tsc` 共报
**7 处**错(TS2339 / TS2531 / TS18047 三类)→ 那四处 `as`/`!` 不是「为了好看」而加的。
⚠️ **探针 H 临时写了 `src/i18n/zh_cn.ts`**(全期零改动清单内的文件)—— 这是治理 §6.4-1
同款做法(那里也要求对一个零改动文件做 RED 探针);**已 md5 逐字节还原、`git status` 干净、
不在提交里**。若协调者认为该文件连探针都不许写,请指示,我改成把语言包注入依赖倒置后再验。

### 12.2 探针纪律自检

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

- **零既有文件改动**:第一轮 `git status --short` 只有两个 `??`(新文件)+ 台账两个 `git add -f`;
  第二轮只有那两个新文件的 `M` + 台账。
  §1.1 全期零改动清单一行未动;`parser-styles.scss` / `parserStyles.test.ts` / `ParserStatus.vue` /
  `ParserStatus.test.ts` / `parserStore.ts` / `knowledge.scss` / `knowledgeStyles.test.ts` /
  `FolderBrowser*` / `knowledgeRoutes.ts` / `deferred.ts` **全部未碰**。
  ⚠️ **`src/i18n/zh_cn.ts` 唯一的例外是 RED 探针 H 的临时写入**(治理 §6.4-1 同款做法):
  **已 md5 逐字节还原、`git status` 干净、不在提交里**,见 §12.1 末尾的说明与请示。
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

## 15. K34 —— 四处机械改写(**全部保抛,零行为变化**)

🔴 **本轮 M-1 已把 K34-1/2/3 从 `?.` / `&&` 改成保抛写法**,使 K34 落地要求②「零行为变化」
**按字面成立**,并与 K34-4 自己的论证内部一致(首版那两套相反判断是评审逮到的反面教材,
已写进治理 K34 的 ⚠️ 一栏)。**判据是忠于蓝本,不是「不抛更安全」。**

| # | 蓝本原写法 | 本仓写法(New-UI 行) | 差异只出现在哪条不可达路径 | 为什么不能回退成蓝本原样 |
|---|---|---|---|---|
| **K34-1** | `$refs.fileInput.click()`(`:29`) | `fileInput!.click()`(**`:343`**)+ `const fileInput = ref<HTMLInputElement \| null>(null)`(**`:199`**) | 🔴 **零差异**:ref 为 null 时两边抛同一个 TypeError | Vue 3 `<script setup>` 没有选项式 `$refs`;`!` 去掉后 tsc 报 **TS18047 `'__VLS_ctx.fileInput' is possibly 'null'`**(探针 K) |
| **K34-2** | `onFile($event.target.files[0])`(`:27`) | `onFile(($event.target as HTMLInputElement).files![0])`(**`:341`**) | 🔴 **零差异**:`files` 为 null 时两边抛同一个 TypeError | `as` 去掉报 **TS2339 `Property 'files' does not exist on type 'EventTarget'`** + TS18047(探针 O);`!` 去掉报 **TS2531 `Object is possibly 'null'`**(探针 J) |
| **K34-3** | `e.dataTransfer.files && e.dataTransfer.files[0]`(`:180`) | `e.dataTransfer!.files && e.dataTransfer!.files[0]`(**`:208`**) | 🔴 **零差异**:`dataTransfer` 为 null 时两边抛同一个 TypeError。中间那个 `&&` 是**蓝本自己的短路**,照抄;首版另加的 `e.dataTransfer &&` 已删除(那一个才改行为) | `!` 去掉报 **TS18047 `'e.dataTransfer' is possibly 'null'`(两处各一条)**(探针 L) |
| **K34-4** | `this.result.chunks.find(...)`(`:229`) | `result.value!.chunks.find(...)`(**`:282`**) | 🔴 **零差异**:`result` 为 null 时两边抛同一个 TypeError | `!` 去掉报 **TS18047 `'result.value' is possibly 'null'`**(探针 N) |

**「不能保抛」的条目数:0** —— 四处全部改成保抛后 `vue-tsc` 仍 **exit 0**(0 行输出),
证明 `as` / `!` 已足够满足 `strict`,首版那三处 `?.` / `&&` 从一开始就是多余的、且各自
把一条蓝本会抛的路径变成了静默 no-op。

**「机械必需」的判据**(探针 J/K/L/N/O,五条全部 tsc 硬报错 → 不是「为了好看」而加):
回退成蓝本原样时 tsc 共报 **TS2339 / TS2531 / TS18047 三类、7 处**错误,逐条列在上表最后一列。

另申报一处**照抄带来的语言现象**(不是改动,不挂 K34):蓝本 `:145` 的箭头函数参数就叫 `t`,
在 `<script setup>` 里会**遮蔽** i18n 的 `t`。**逐字照抄了这个参数名**(改名 = 无关重构);
Vue 编译器的作用域跟踪(`walkIdentifiers`)会把它解析成参数而不是 `$setup.t`,
已有专门用例断言 sparse 那一行渲染成 `151268:0.2153 · 11728:0.2056 · …`(若解析错会变
`undefined:undefined` 或抛错)。

## 16. 顾虑 / 交接

1. **`params_used` 缺席那一档是 mock 造的**:六份 fixture 都带 `params_used`,
   蓝本 `:83` 的 `v-if` 假侧在真机验不到 → 用 mock(删字段)覆盖。已在用例注释里说明。
   同理 `rerank_score` 有值 / `docling_markdown` 有值两档也只能 mock 造(治理 §13 已点名)。
2. **`.md`/`.txt` 之外的真机验收**:要看 docling 卡得传 `.docx`/`.pptx`/`.xlsx`,
   🔴 **别传 `.pdf`**(触发 ~200 MB 模型下载)。已写进用例注释,协调者写验收清单时请照抄这条。
3. **计划书 T7 节那行单元素根写法未订正**(§13 末尾)—— 交协调者就地改,避免下游再照旧写法。
4. **E-16 是治理文件 §3.5 N22 里的行号偏差**(`:66` → `:65`),内容无误,交协调者就地订正。
5. **探针 H 写过 `src/i18n/zh_cn.ts`**(已 md5 还原、不在提交里)—— 见 §12.1 末尾的说明与请示。
6. 无 `NEEDS_CONTEXT`。

---

## 17. 本轮(第二轮)收了什么 —— 评审 M-1 / I-1 / M-2

评审结论:**`Ready to merge`**,产品代码与测试**零缺陷**(0 Critical / 1 Info / 2 Minor)。
本轮只收那 3 条,**未动任何评审判为「无需补」的项**(它猎的 7 处里 2 处判「无物可守」——
路径不可达 + tsc 兜住 —— 未补;它自己那条 `--reporter=basic` harness 教训与本刀无关)。

| 条 | 评审指出 | 本轮怎么收 |
|---|---|---|
| 🔴 **M-1** | **K34 内部矛盾**:K34-4 论证「`?.` 会改行为所以用 `!`」,而 K34-1/2/3 恰好用了 `?.` / `&&`,把蓝本的 `TypeError` 变成**静默 no-op** → 同一文件两套相反判断,「零行为变化」按字面不成立 | **三处全部改成保抛写法**(`files![0]` / `fileInput!.click()` / `e.dataTransfer!.files`),`vue-tsc` 仍 **exit 0**;文件头 K34 注释整段重写为统一口径;**「不能保抛」条目数 = 0**。三列表 + 五条 tsc 探针见 §15 / §12.1 |
| 🔴 **I-1** | 报告 New-UI 侧行号**全面陈旧**(`.vue` 称 415 实为 471;`.test.ts` 称 1046 实为 1373;template 偏 −9、script 偏 +15~+24) | **用脚本重算全表**(不手改),§2.1 / §2.2 两张表全部替换;脚本在**剥注释后的源**上定位(保行版,行号与原文逐行对齐),避免撞头注释里的同名写法。行数经本轮改动后为 **`.vue` 485 / `.test.ts` 1412**。**蓝本侧行号评审抽查全对,未动** |
| **M-2** | N22 扫描用 `'cos '` / `'rr '` 这类**通用子串**扫全语言包 —— 当前 0 命中,但将来无关新键含这些子串会**假报红**(治理 §9 第九条同族) | 收紧成 **① 精确整值相等** + 新增 **② 键集闭合**(模板里 `t()` 的键集恰好是那 23 个 `aiKbPt*`)。② 才是「有人补成 i18n 键」的真正判据,判别力更强且**零假报红面**;正向裸文本那条保留。**配两条 RED 探针(H / I)证明收紧后仍抓得住**。用例数因拆条 79 → 80 |

**保持不动的**:E-15(本页无 `🧪`)与 E-16(N22 行号偏 1)评审已独立复核成立,原样保留。

**本轮改动的文件**:`ParserTest.vue`(K34 注释 + 三处保抛)· `ParserTest.test.ts`(M-2 两条守卫)·
本报告。**仍未碰**:`parser-styles.scss` / `parserStyles.test.ts` / `ParserStatus*` / `parserStore.ts` /
`knowledge.scss` / `knowledgeStyles.test.ts` / `src/i18n/*`(探针除外,已还原)/ `FolderBrowser*` /
路由 / §1.1 清单。
