# SP8-P5c · Task 2b 独立评审 —— `parser-styles.scss` + `parserStyles.test.ts`(守卫 ②⑤,含 K31 修正轮)

- **评审对象**:`d70986f`(首轮)+ `a0b8537`(K31 修正轮)的**合并后最终态**;基线 `05bff49`
- **评审者动作**:只读 + 5 次自做 RED 探针(改文件后逐字节还原,md5 校验)+ 三门自复跑。**零提交、零改产品代码。**
- **结论**:🟢 **Ready to merge**(Critical 0 / Important 0 / Minor 4)
- **收尾 `git status`**:干净(空输出),`md5sum` 与探针前一致

---

## 0. 结论速览

| | 条数 | 一句话 |
|---|---|---|
| **Critical** | **0** | 无 |
| **Important** | **0** | 无 |
| **Minor** | **4** | ① 报告 §8.1 行号未随 K31 重算 · ② 报告 §5.3 浅档 token 块行号 +5 · ③ 守卫残留缺口:页面作用域内的 `--x:` 声明无人守(brief 未要求,建议 T6/P5d 顺带)· ④ 具名色扫描大小写敏感(既有档口径,有论证,登记不改) |

**报告的每一条实质结论我都独立复核为真**,未发现与权威源不符之处(唯二不符是上面两条行号陈旧,不改变任何结论)。

---

## 1. 逐行色扫 `parser-styles.scss` 全文(治理 §11 第 1 条)

`color-guard.test.ts` 不扫 `.scss`、`knowledgeStyles.test.ts` 只读 `knowledge.scss` → 本文件除
`parserStyles.test.ts` 外只有人肉这一道防线,故**逐行独立扫**(295 行全文,含注释)。

```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|(^|[^-[:alnum:]])(white|black|red|green|blue)([^-[:alnum:]]|$)' \
    src/ai/styles/parser-styles.scss
exit=1                      ← 0 命中
$ grep -c 'theme-exception' src/ai/styles/parser-styles.scss    → 0
$ grep -c 'ns-color'        src/ai/styles/parser-styles.scss    → 0     ← 附录 B §B.9 ⑦ 满足
$ grep -n 'transparent'     src/ai/styles/parser-styles.scss
38: * 全文零 hex 色值、零函数式色值、零具名色;`transparent` 本文件零处。   ← 只是注释里的这个词本身
```

再用独立脚本按 **148 个 CSS Color 4 具名色全清单**(照 T2a 评审「100 个具名色全清单」的方法,补到 CSS Color 4 全集)
逐行扫,**并额外跑一遍大小写不敏感版本**以暴露任何被大小写口径漏掉的:

```
$ node scratchpad/rev/colorscan.mjs
named list length in my scan: 148
total flagged lines: 0            ← HEX / FUNC / NAME / NAME-CI 四类全部 0
```

→ ✅ **全文(含注释)零 `#hex`、零 `rgb()/rgba()/hsl()/lab()/lch()/oklab()/oklch()/hwb()/color()/color-mix()`、
零 CSS 具名色(含 `white`/`black`)。`transparent` 实际用量 0 处。** 本文件确无 token 声明层豁免的必要。

**报告称「注释里写的是假 token 那一族(前缀 `ns-`)」这种改写** —— 核实为真:注释里既没有写出任何被替换掉的
色字面量(R5),也没有留下 `ns-color` 字样(§B.9 ⑦)。附录 B §B.2(「注释里写原是无声明的 `--ns-color-*`」)
与 §B.9 ⑦(`grep -c 'ns-color'` 须为 0)本身是**互相冲突的两条治理要求**,实现者的改写让两条同时成立,
且语义信息一个字没少 —— **处置正确,报告 §11-2 已按权威优先级指出,评审同意。**

---

## 2. 🔴 K31 落地核准(本轮重点)

| 核点 | 实测 | 结论 |
|---|---|---|
| 选择器是**后代**不是复合 | `grep -nE '^[^[:space:]/}]'` → `68:.parser-app {` / `75:.parser-app .parser-status-page {` / `162:.parser-app .parser-test-page {` | ✅ |
| `.parser-app` 块只有 K22 三行 | 编译后扁平化实测该块声明 = `[["height","100vh"],["height","100dvh"],["overflow-y","auto"]]`,**零颜色属性、零 `--x:`、零 `color-scheme`、零嵌套规则** | ✅ |
| 断言 (b) 允许清单从常量派生 | `TOP_LEVEL_SELECTORS = [ROOT_SELECTOR, SCOPE_STATUS, SCOPE_TEST]`(`:54`) | ✅ |
| 断言 (d) 作用域判据从常量派生 | `(d)` 四条全部经 `scopeBody(scope)` → `blockOf(css, scope)`,`scope ∈ [SCOPE_STATUS, SCOPE_TEST]`(`:289/:297/:304/:314-319`);**全文再无任何写死的复合形式选择器**(唯二出现处在 `:44` / `:49` 的注释里,是「不是复合形式」的反面说明) | ✅ **两条判据都真的从常量走,没有一条写死旧形式** |
| K31 改动面 | `git diff d70986f a0b8537` 实测:scss = 2 行选择器 + 头注释;test = 2 个常量 + 头注释。**`.parser-app` 块与 85 条页内规则一字未动** | ✅ |
| token 仍能到达页面根 | K21 的两个 token 块声明在 `.parser-app` 上;自定义属性与 `color-scheme` 都是**可继承**属性 → K31 把页面根移到子元素后仍正常继承。**K31 不引入 token 断链** | ✅(评审补核) |

### 2.1 🔴 独立复现「探针 11」(K31 被钉住的唯一证据)

行首锚定注入(治理 §9 新条:注入脚本本身也要行首锚定,并先断言注入落盘):

```
$ python3 -c "re.subn(r'(?m)^\.parser-app \.parser-(status|test)-page \{$', ...)"
substitutions: 2
--- injection landed (real selectors, col 0) ---
68:.parser-app {
75:.parser-app.parser-status-page {
162:.parser-app.parser-test-page {
--- 头注释里仍有 3 处后代形式(证明注入没撞注释、断言也没被注释撞对) ---
3
--- test ---
     × 第 0 列的规则头恰好是那三个选择器(顺序与个数都钉死) 7ms
     × 两个作用域都存在,且各自带蓝本的页面壳声明(padding / max-width / margin) 2ms
     × `.card` 在两个作用域下各有且只有一份 1ms
     × `.page-header`(含嵌套 `h2`)在两个作用域下各有且只有一份 1ms
     × 两个作用域各自持有本页专属的类,没有被并到一起 1ms
 Tests  5 failed | 13 passed (18)
```

→ ✅ **独立复现,数字逐字吻合报告:(b) 1 条 + (d) 4 条 = 5 条同时精确报红。**
附带实证:注入期间头注释里仍逐字写着 `.parser-app .parser-status-page`,而 `blockOf` 报的是
「**找不到**顶层规则」→「先 `stripComments()` 再 `^选择器 \{$`」这套判据确实不会被注释撞对。

---

## 3. 🔴 K23 —— 同名类没被合并(独立 diff)

自写脚本把两份蓝本各自展开成「完整选择器路径 → 声明列表」双向 diff(`scratchpad/rev/dup.mjs`):

```
blueprint rule counts: status 32 | test 53                      ← 与报告「32+53=85」一致
=== duplicate trailing selector names across the two blueprints (8):
    .card .empty .page-header .row .toggle h2 h3 li ===
=== identical FULL paths in both (3) ===
  .page-header        byte-equal: true
  .page-header h2     byte-equal: true
  .card               byte-equal: true
```

| 核点 | 独立结论 |
|---|---|
| ① 「重名名 8 个 / 完整路径两边都有 3 条」 | ✅ **完全成立**(8 个 = `.card .empty .page-header .row .toggle` + 元素 `h2 h3 li`;3 条逐字相同) |
| ② `.row` / `h3` / `li` 是否确实不同 | ✅ **确实不同**:`.control-card .row`(gap 16px + padding 6px 0)vs `.upload-card .row`(gap 12px + margin 8px 0)· `.folders-card h3` **多 `font-weight: 500`** vs `.scored-card/.chunks-card h3` 无 · `.failure-list li`(padding 6px 0 + 卡片描边档虚线)vs `.scored-list li`(padding 8px 0 + 最淡档虚线) |
| ③ 逐字相同的 3 条是否两作用域各留一份 | ✅ **各留一份,零共享段**:`.card` 在 `:98` / `:175`,`.page-header` 在 `:82` / `:169`,`.page-header h2` 在 `:84` / `:171`。断言 (d) 各钉「恰好 1 条」;我的探针 E(删掉状态页那份 `.card`)精确报 1 条红 → **合并会被抓到** |
| 报告 §2 的两条「附录之外的补充」 | ✅ 均成立:两个页面根声明也逐字相同(选择器名不同,不计入「完整路径重名」);`.hint` 不是跨文件重名而是 `ParserTest.vue` **文件内部**两份不同(`.dropzone .hint` 12px+margin-left vs `.chunk-head .hint` 11px),两份都照搬到 `:198` / `:281` |

---

## 4. 零顶层裸选择器 + 类/元素集合(附录 D §D.2)

```
$ node scratchpad/rev/sets.mjs
test CSS_NAMED_COLORS count: 148 | dupes: 0 | has transparent: false
scss classes (excl parser-app): 70
scss element selectors: 9  →  b code em h2 h3 input li p strong
appendix D list count: 70 | test list count: 70
appendixD == testList : true
scssClasses == testList: true
```

- ✅ **第 0 列只有那三个选择器**;70 个裸类名 + 9 个元素选择器**全部嵌在两个页面作用域之下**(独立扁平化验证:
  每条规则的完整路径都以 `.parser-app .parser-status-page` 或 `.parser-app .parser-test-page` 打头)。
- ✅ **附录 D §D.2 ≡ 测试白名单 ≡ scss 实际**,三方集合相等(不是两方)。`parser-app` 走 `SCOPE_ROOT_CLASSES`
  排除条件、不塞登记表 —— 与治理 §6.4-2 对 `knowledgeStyles.test.ts` 的裁定同款,**「70」与常量名 `PARSER_WHITELIST_70` 保持**。
- ✅ **brief 清单的 4 处偏差,实现者判对了**:独立复核蓝本并集 = 70 类(brief 67,**漏** `parser-status-page` /
  `parser-test-page` / `paused`)、9 元素(`has pre? false | has b? true` → brief **多 `pre`、漏 `b`**,
  `b` 的出处是 `.queue-card .kv b` 蓝本 `:48`)。**以附录 D §D.2 + 实测为准是对的。**

---

## 5. 199 行搬运逐段核准(比抽查 6 条更强:逐行全量)

写了两套独立脚本,**不采信报告的复核脚本**:

**(1) 声明级位置比对**(`cmp.mjs`,按「完整路径 + 声明」逐位比):

```
==== STATUS :: blueprint 94 decls vs mine 94 decls   → total positional diffs: 12
==== TEST   :: blueprint 164 decls vs mine 164 decls → total positional diffs: 33
==== .parser-app own decls: [["height","100vh"],["height","100dvh"],["overflow-y","auto"]]
```

**(2) 原始行级比对**(`raw.mjs`,把两个页面段去壳、反缩进、剥注释、把色值归一成 `@C@` 后逐行 diff ——
这一套连「单行多声明的排版 / 换行位置 / 声明顺序」都能抓):

```
==== STATUS bp lines 71 / mine lines 71   → raw-line diffs (color-normalized): 12
==== TEST   bp lines 121 / mine lines 121 → raw-line diffs (color-normalized): 31
```

→ ✅ **零漏行、零插行、零改序、零改值。行数两侧完全相等,差异 100% 落在颜色写法上,
且恰好 12 处 / 31 行 33 处 —— 与附录 B §B.0 的计数逐字吻合。**

**按 brief 要求的 6 条定向抽查(逐行对蓝本原文)**:

| 规则 | 蓝本 | New-UI | 结论 |
|---|---|---|---|
| `.dropzone`(含 `&.active` / `&.has`) | `ParserTest.vue:266-276` | `:187-204` | ✅ 逐字(`&.active` 那行两个色值同行照抄、`transition: background 0.15s` 照抄) |
| `.folder-bar` | `parser-styles.scss:60-63` | `:143-146` | ✅ 逐字(`opacity: 0.5` 与 `background` 同行照抄) |
| `.error-box` | `ParserTest.vue:311-317` | `:234-240` | ✅ 逐字(4 行声明顺序 margin/padding → background → border-left → color → font-size 一致) |
| `.chunk-text` | `ParserTest.vue:357-362` | `:283-288` | ✅ 逐字(5 行、每行的多声明分组一致) |
| `.rank-line` 内层 | `ParserTest.vue:334-341` | `:261-267` | ✅ 逐字(`.rank-no/.score/.rerank-score/.chunk-ref` 顺序一致) |
| `.control-card .dot`(含 `&.paused`) | `parser-styles.scss:32-39` | `:113-120` | ✅ 逐字(`.dot` 三行 + `&.paused` 单行嵌套形式一致) |

额外核到两处「刻意不统一」被正确照抄:`.scored-list li:first-child` 蓝本是**兄弟规则**(`:335`)、
`.chunk-item` 蓝本是**嵌套 `&:first-child`**(`:351`)—— New-UI `:260` / `:277` 分别照抄了两种写法,
**没有「顺手统一」**。`font-family: ui-monospace, monospace`(5 处)保持字面量、未换 `var(--font-mono)`,
理由(另一串字体栈、会改渲染、且不是颜色)成立。

---

## 6. 附录 B 映射逐处核

- ✅ **45 处映射(12 + 33)逐条对上附录 B §B.3 / §B.4**,一处不差:19 个 `var(--ns-color-*, fallback)`
  **按回退值语义**映射(`elevation→--bg-elevated` · `border→--line-faint` · `link/primary→--accent` ·
  `danger→--danger` · `success→--success` · `warning→--warning`),其余裸字面量按表(`#888→--text-tertiary` ×10 ·
  `#555→--text-secondary` ×2 · `#aaa→--text-quaternary` · `#c1c1c1→--line-strong` · `#e1e4e8/#eee→--line-faint` ·
  `#fff(submit-btn 前景)→--text-on-accent` · `#2ecc71→--success` · `#f5a623→--warning` ·
  `rgba(74,144,226,0.08)→--accent-soft` · `rgba(74,144,226,0.05)→--accent-softer` ·
  `rgba(231,76,60,0.08)→--danger-soft` · `rgba(0,0,0,0.03)→--bg-chip`)。
- ✅ **零自创映射、零 `color-mix()` 比例、零新造 token、零 `NEEDS_CONTEXT` 遗漏**(P5a T11 R9 教训未复发)。
- ✅ 不保留 `var(假 token, …)` 的壳(死引用),`grep -c 'ns-color'` = 0。
- ✅ **15 个 token 两档都已就位**(独立在 K21 扩过选择器的两个块里核):
  暗档块 `knowledge.scss:130-246` / 浅档块 `:249-340` → **15/15 dark:Y light:Y**。
  `var(--font-mono)` 那 1 处在头注释里(「为什么**不**用它」),不是真引用 → 文件内 `var()` 共 46 处 = 45 真 + 1 注释。
- ✅ **取舍②(浅档 `--warning`/`--success` 比 Vue2 更深)是照附录 B 落的,没开小灶** ——
  `.dot` / `.dot.paused` / `.scored-card .warn` / `.ok-hint` / `.rank-line .score` 全部直接用 `--warning`/`--success`,
  文件里**零** `--warning-vue2` 之类自造 token。这是协调者裁定 **A-2**,**评审不报为缺陷**。

---

## 7. `parserStyles.test.ts` 判别力(不许空转)

| 要求 | 实测 | 结论 |
|---|---|---|
| `node:fs` 直读、禁 `?raw` | `:21 import { readFileSync } from 'node:fs'`;全文零 `?raw` | ✅ |
| `dirname(fileURLToPath(import.meta.url))` | `:27` | ✅ 未用 `__dirname`(除了自建同名 const) |
| `@ts-expect-error` 照仓内惯例 | `:20/:22/:24` 三行各一条 + 理由注释,与 `knowledgeStyles.test.ts:10-14` **写法一致** | ✅ `vue-tsc` exit 0 复跑确认 |
| 「找某段文本」整行/行首锚定 + 先排除注释 | `blockOf` 用 `^${sel} \{$`(`m` 标志)+ 花括号配平;(b) 用「第 0 列非 `[\s}/]`」行过滤;(a) **刻意跑在未剥注释的 `rawSource`** 上、(b)(c)(d)(e) 跑在 `stripComments()` 后的 `css` 上 | ✅ **分工正确**;我的探针 B(色字面量塞进注释)与探针 D(注释里有同名选择器却报「找不到」)双向实证 |
| 断言真在读非空源 | 探针 A(塞 `#abcdef`)精确报红 → 不是对空串假通过 | ✅ |

**5 组 / 18 例**(`grep -c it(` = 18)。(a) 的 148 个具名色清单实测**无重复项、不含 `transparent`**,
是 T2a 评审那 100 个的严格超集。

---

## 8. 我自做的 RED 探针(5 条,全部先断言注入落盘,全部逐字节还原)

守治理 §9 新条:注入脚本本身行首锚定 + 先 `grep`/`diff` 证明注入真落盘再看测试结果。

| # | 注入 | 落盘证据 | 结果 | 还原 |
|---|---|---|---|---|
| **A** | `.refresh-btn` 加 `color: #abcdef`(行首锚定 `^  \.refresh-btn \{ … \}$`) | `substitutions: 1` + `grep -n refresh-btn` 见新值 + md5 变化 | `× 零 #hex` → **1 failed \| 17 passed** | md5 复原 ✅ |
| **B** | **注释里**塞具名色(`/* … ,原值 forestgreen */`) | 🔴 **第一版 `substitutions: 0`**(缩进猜错)→ 按纪律停下改锚点,第二版 `substitutions: 1` + `diff` 显示 L117 | `× 零 CSS 具名色` → `L117 [forestgreen]` → **1 failed \| 17 passed** | ✅ |
| **C** | `.parser-app` 块里同时塞 `background: var(--bg-elevated)` 与 `--line-faint: var(--line)` | `sed -n '68,75p'` 见两行 | `× 声明恰好三条` + `× 零 --x:` + `× 零颜色属性` → **3 failed \| 15 passed** | ✅ |
| **D** | **K31 本体**:两处后代选择器写回复合形式 | `substitutions: 2` + 第 0 列 grep 见复合形式 + 注释里仍有 3 处后代形式 | (b) 1 + (d) 4 → **5 failed \| 13 passed** | ✅ |
| **E** | 只从**状态页作用域**删掉 `.card` 整块(模拟「合并同名类」) | 断言删前行是 `.card {`、删后作用域内 `.card {` 计数 0 | `× .card 在两个作用域下各有且只有一份`(实测 0 条)→ **1 failed \| 17 passed**;(e) 白名单**没红** | ✅ |
| **F**(补充) | 第 0 列插入 `:root { --sneaky: 4px; }` | 第 0 列 grep 见 `:root {` | `× 第 0 列的规则头恰好是那三个` → **1 failed \| 17 passed** | ✅ |
| **G**(缺口猎) | 把 `--sneaky-token: var(--accent);` 塞进 **`.parser-app .parser-status-page`** 块 | `grep -n sneaky-token` → L76 | 🔴 **18 passed(全绿,没抓到)** | ✅ |

**探针后自查**:
```
$ md5sum src/ai/styles/parser-styles.scss src/ai/styles/parserStyles.test.ts
a2a8c27e6f3001a5f53fefa34d889d66  src/ai/styles/parser-styles.scss     ← 与探针前逐字节相同
8c27d7452513f3cb5a2bb3d8086c25ec  src/ai/styles/parserStyles.test.ts   ← 未改动
$ diff <备份> <现文件> && echo identical  → identical(两个文件)
$ git status --porcelain                 → 空(干净)
```

探针 G 是本评审新发现的**守卫残留缺口**,见 Minor ③。

---

## 9. K22 / K25 未误报,以及「浅色档一致」「版式逐字」两半句的核准

- **K22 三行不报**:`theme.css:318` 实为 `body { overflow: hidden }`(已核),`/ai/parser`/`/ai/parser/test`
  在 `knowledgeRoutes.ts` 是顶层路由 → 不自建滚动容器则内容不可达,是**可复现的错误行为**,治理已授权。
- **K25 不报**:Parser 两页暗档与 Vue2 不同(Vue2 只有一套浅色),治理 §3 K25 + 附录 B 取舍① 明文授权。
- **「浅色档肉眼与 Vue2 一致」这半句**:逐处对附录 B 看语义 → 卡片实底 `--bg-elevated` 浅档 = `var(--card-bg)` =
  与 Vue2 `#fff` **逐字同值**;`--line-faint` 冷↔暖极淡档几乎不可辨;`--danger` 同族深兄弟。
  **唯二肉眼可见的偏差是 `--warning`/`--success`(更深)与 `--accent`(更饱和)** —— 这正是附录 B 取舍② /
  协调者裁定 **A-2** 已登记的口径,且实现者是**照附录 B 落的、没开小灶** → **不报为缺陷**,由协调者写进验收清单。
- **「版式 / 间距 / 结构 / 声明顺序逐字照抄」这半句**:见 §5 的两套全量比对 —— **行数相等、逐行逐位一致**,
  唯一差异是颜色写法。DOM 顺序属模板(T6/T7),本刀零 `.vue`;K31 多出的那一层包裹 DOM 已按治理 §3 K31 授权。

---

## 10. 重名与作用域隔离(自己 grep 一遍)

对 70 个类名逐个跑 `grep -rnP "(^|[ ,>~+({])\.<name>(?![A-Za-z0-9_-])"` 扫
`agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` / `knowledge.scss` /
`tokens.scss` / `theme.css`:

```
### .card   agent-styles.scss:529  `.card {`(缩进在 .agent-app 块内)
            theme.css:414          `.grid-item.dragging .card { … }`
### .dot    skills-styles.scss:365 `.dot {`(在 .sk-meta-cell .val 下)
            skills-styles.scss:375 `[data-disabled="true"] .dot { … }`
### .hint   settings-styles.scss:126 `.set-actions .hint { … }`
### .warn   knowledge.scss:923       `.warn {`(在 .knowledge-app … .k-set-row-desc 下,T2a 新增)
```

→ ✅ **命中 4 个名字**(报告口径 5 处 / 我按规则条数 6 条,`.dot` 报告把 `:365`+`:375` 写在同一行 —— **同一结论**)。
**每一处都需要 Parser 两页不存在的祖先**(`.agent-app` / `.grid-item.dragging` / `.sk-meta-cell .val` /
`.set-actions` / `.knowledge-app .k-set-row-desc`)→ **两页作用域隔离真的生效,零串号**。
`.warn` 两份白名单都留是预期(声明不同、各在自己作用域),**没有删任何一个** ✅。
元素选择器侧:那 9 个在既有文件里也全部嵌在各自作用域内,无裸顶层规则可反向污染 Parser 页。

---

## 11. 三门 + sass(评审独立复跑)

```
$ pnpm test                                                   exit=0
 Test Files  320 passed (320)
      Tests  3179 passed (3179)     ← 红项 0(已知噪声 persist.test.ts / AgentComposer.test.ts 本轮未出现)
$ pnpm exec vue-tsc --noEmit                                  exit=0   (输出 0 字节)
$ pnpm build                                                  exit=0   (✓ built in 12.72s)
$ pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null   exit=0
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss     /dev/null   exit=0
```

✅ **与报告的 `320 / 3179`(3161 → +18)逐字一致**;`grep -c it(` = 18 与 5 组断言(5+2+4+4+3)对得上;
零 `.vue` 新增 → `color-guard.test.ts` 动态用例数不变。

**`dist` 那条预期(不报为缺陷)**:`grep -c parser-status-page dist/assets/*.css` → **全 0**;
对照组 `grep -c k-sandbox-icon` → `index-X0hjF9vH.css:1`。
→ 本刀无任何 `.vue` import `parser-styles.scss`,Vite 不会把它编进产物,**这条 DoD 归 T6**;
用对照组证明「管线本身没问题、差的只是一个 import」的做法**方法正确、结论可信**,评审认可。

---

## 12. 提交范围

```
$ git show --stat d70986f  → .superpowers/sdd/p5c-task-2b-report.md · src/ai/styles/parser-styles.scss · src/ai/styles/parserStyles.test.ts
$ git show --stat a0b8537  → 同上三个文件
$ git diff 05bff49 a0b8537 -- src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts | wc -l
0                                        ← ✅ T2a 产物零改动
$ git diff --name-only 05bff49 a0b8537 | grep -c '\.vue$'
0                                        ← ✅ 零 .vue 新增
```

✅ **两个提交合计只碰 `parser-styles.scss` + `parserStyles.test.ts` + `.superpowers/sdd/`**
(区间里的 `p5c-common-constraints.md` 变更来自协调者自己的 `3d75690` / `312d481`,不是实现者)。
**§1.1 全期零改动清单里的文件一个都没碰**;`.sp8/NimoOS-Service/**` 零改动;`NimoOS-UI` 仓零 checkout/stash/提交
(我的蓝本读取一律 `git -C … show main:`)。

---

## 13. Minor 明细(4 条,均不阻塞合并)

**Minor ①(报告文档陈旧)** —— 报告 §8.1 的自查输出仍写着
`:60 .parser-app / :67 .parser-app .parser-status-page / :154 .parser-app .parser-test-page`,
那是 **K31 前 287 行版本**的行号(实测 `git show d70986f:… | grep -nE '^[^[:space:]/}]'` 正是 60/67/154)。
最终态是 **68 / 75 / 162**。§12.5 只声明重算了 §1/§4/§5,**§8.1 漏了**。产品代码无误,建议补一句或改数字。

**Minor ②(报告行号偏差)** —— 报告 §5.3 说浅档 token 块是 `knowledge.scss:249-345`;
我用括号配平实测是 **`:249-340`**(`:345` 是 `.knowledge-app` 外壳块的起始行)。
不影响结论(15/15 两档都有,我独立复核成立)。

**Minor ③(守卫残留缺口 —— 评审新发现,brief 未要求,不算实现者失职)** ——
我的**探针 G** 实证:把 `--sneaky-token: var(--accent);` 塞进 `.parser-app .parser-status-page` 块里,
**18/18 全绿,四条断言一条都没抓到**((a) 无色字面量 / (b) 不在第 0 列 / (c) 只扫 `.parser-app` 块 /
(e) 不是类也不是元素)。治理 §6.4-5(c) 的原文确实只要求「`.parser-app` 块里零 `--x:`」,**实现者完全达标**;
但 **K21 的语义是「本文件不声明任何 token」**,页面作用域内的声明目前无人守。
**一行可补**:把 (c) 的 `--x:` / `color-scheme` 扫描从 `blockOf(css, ROOT_SELECTOR)` 换成全文 `css`。
建议 **T6 顺带或转 P5d**(本刀不必返工)。

**Minor ④(已论证的口径代价,登记不改)** —— (a) 的具名色扫描是**大小写敏感**,
代价是 `color: WHITE` / `#ABC` 之外的大写具名色能逃。
实现者给的理由(大小写不敏感会把中文注释里的「**RED** 探针」当成具名色 `red`,T2a 评审吃过 2 处这种假阳性;
且与 `knowledgeStyles.test.ts:370-377` 同款)**成立**,本仓 CSS 关键字一律小写。
我额外跑了一遍**大小写不敏感全文扫描**,实测 **0 命中** → 当前文件确实不受影响。**登记,不改。**

---

## 14. 评审用到的脚本(scratchpad,未进版本库)

`colorscan.mjs`(148 具名色 + hex + func,含大小写不敏感对照)· `cmp.mjs`(声明级位置比对)·
`raw.mjs`(原始行级 + 色值归一 diff)· `dup.mjs`(两份蓝本重名类双向 diff)· `sets.mjs`(类/元素三方集合相等)·
`tokens.mjs`(15 token 两档覆盖)· `linecheck.mjs`(报告行号引用逐条校验)· `collide.sh`(70 名重名 grep)

**收尾**:`git status --porcelain` 空;两个产品文件 md5 与探针前逐字节相同;`NimoOS-UI` 仓零改动。
