# P5d 附录 D —— CSS 类白名单 + tiptap 可测性(**权威**,T0 产出)

**T0 实测于 2026-08-04** · 蓝本 `NimoOS-UI`@`7a6ee6b7` · 现状 `src/ai/styles/knowledge.scss`(1991 行)
+ `src/ai/styles/knowledgeStyles.test.ts`(907 行,`WHITELIST_226`)

## §D.0 白名单算术(🔴 **终值 226 → 293**;常量改名 `WHITELIST_226` → **`WHITELIST_293`**)

> 🔴 **【修复轮 1 · 裁定 R9】终值是 293,不是本节初稿写的 291。**
> `291 = 226 + 65(§D.1 的 k*/fb* 类)`;**再 +2** = `nme-content` / `ProseMirror`
> —— 它们被 §D.2.1 扩展后的「没有搬多」正则扫到,**必须同时进白名单**,否则那条断言报红。
> **算式与程序化实测见 §D.2.1.1。下游一律用 293。**

判据(程序化,剥注释后):对本期 9 个 `knowledge.scss` 段 + `NotesMarkdownEditor.vue:40-46`
取**选择器位置**(行内 `{` 之前那一段)的所有 `.类名`,再减去 `WHITELIST_226` 已有的。

| 项 | 数 |
|---|---|
| 段内选择器位置出现的 `k*`/`fb*` 前缀类(去重) | **67** |
| 其中已在 `WHITELIST_226` | **2**(`k-badge` `:2029` · `kn-badge` `:2031-2039`,均 P5b-T2 已搬) |
| 🔴 **本期新增(`k*`/`fb*`)** | **65** |
| 另加非 `k*` 的 `nme-content` / `ProseMirror`(R9) | **+2** |
| 🔴 **收官白名单(终值)** | **293** |

🔴 **与治理/计划的差异(勘误)**:计划书写「协调者实测:New-UI 缺 **66** 个类(含 `.k-seg` / `.nme` /
`.nme-content` / `.ProseMirror`)…已有的只有 21 个」。**两个数都对不上,原因是分母不同**:

| 口径 | 结果 |
|---|---|
| **scss 段选择器**(= 白名单该收的) | 67 个 `k*`,已有 2 → **新增 65**;另有非 `k*` 的 `nme-content` / `ProseMirror`(见 §D.2) |
| **模板 `class="…"` 静态类**(= T6/T7 写模板时能不能用) | 共 **98** 个,New-UI 已有 **25**,缺 **73**(含 `dot`/`lbl`/`sep`/`spacer`/`wide`/`nme`/**`text`**) |

**66 / 21 两个数字在两种口径下都不成立** —— 下游一律用本节的 65 / **293**(R9 终值,见 §D.2.1),
以及 §D.2、§D.4 的清单。

### 🔴 D.0.1 那 73 个模板类会不会卡住 T6/T7?——**只有 2 个真的没规则**(裁定 R6)

**结论(裁定 R6 只要求这一句,不要求列全 73 个)**:98 个模板静态类里,
**在蓝本任何 scss 与 New-UI 现状里「双双无规则」的只有 2 个**:

| 类 | 蓝本 scss | New-UI 现状 | 处置 |
|---|---|---|---|
| **`nme`** | 🔴 **零选择器** | 无 | **N10 家族,不搬**(Vue2 里同样无样式 → 照抄就是 1:1);不进白名单、不进登记表(`nonKClassNames` 也扫不到它,§D.2 已实测) |
| **`text`** | ✅ **有**(`knowledge.scss:1569-1570`) | 🔴 **无** | **搬(K45,裁定 R1)** —— 见 §D.4.1 |

其余 **71 个**都被「§D.1 的 65 个新增 + New-UI 既有 25 个 + 本期新增的非 `k*` 类」覆盖 → **T6/T7 不会卡住**。

## §D.1 本期新增的 65 个类(**全部要进 `WHITELIST_293`**;另 +2 个非 `k*` 见 §D.2.1.1)

| # | 类 | 段 | 蓝本 `knowledge.scss` 选择器行 |
|---|---|---|---|
| 1 | `.k-seg` | K43 | `:551` |
| 2 | `.kn-act` | D | `:2109,2115,2116,2117,2118` |
| 3 | `.kn-aside-card` | F | `:2197` |
| 4 | `.kn-aside-select` | F | `:2236` |
| 5 | `.kn-aside-title` | F | `:2202,2203` |
| 6 | `.kn-desc-input` | E | `:2145,2149` |
| 7 | `.kn-diff` | G/H | `:2243,2278` |
| 8 | `.kn-diff-body` | G | `:2248` |
| 9 | `.kn-diff-pane` | G | `:2244,2246,2247` |
| 10 | `.kn-diff-pane-head` | G | `:2245,2246,2247` |
| 11 | `.kn-draftbar` | E | `:2129` |
| 12 | `.kn-draftbar-sub` | E | `:2137` |
| 13 | `.kn-draftbar-txt` | E | `:2135,2136` |
| 14 | `.kn-edit` | E/H | `:2123,2267` |
| 15 | `.kn-edit-aside` | F/H | `:2196,2268` |
| 16 | `.kn-edit-main` | E | `:2138` |
| 17 | `.kn-edit-top` | E | `:2124,2125` |
| 18 | `.kn-editor` | E | `:2150,2155` |
| 19 | `.kn-editor-body-wrap` | E | `:2170,2171` |
| 20 | `.kn-editor-src` | E | `:2183` |
| 21 | `.kn-editor-status` | E | `:2188,2193` |
| 22 | `.kn-editor-toolbar` | E/H | `:2156,2279` |
| 23 | `.kn-empty-filtered` | D | `:2120` |
| 24 | `.kn-file-acts` | F | `:2211` |
| 25 | `.kn-filepath` | F | `:2206` |
| 26 | `.kn-inbox` | C | `:2058,2073` |
| 27 | `.kn-inbox-acts` | C/H | `:2082,2275` |
| 28 | `.kn-inbox-chev` | C | `:2072,2073` |
| 29 | `.kn-inbox-foot` | C | `:2083` |
| 30 | `.kn-inbox-foot-hint` | C | `:2084` |
| 31 | `.kn-inbox-head` | C | `:2063` |
| 32 | `.kn-inbox-icon` | C | `:2064` |
| 33 | `.kn-inbox-row` | C/H | `:2075,2076,2274` |
| 34 | `.kn-inbox-row-desc` | C | `:2080` |
| 35 | `.kn-inbox-row-main` | C | `:2077,2079` |
| 36 | `.kn-inbox-row-time` | C | `:2081` |
| 37 | `.kn-inbox-row-title` | C | `:2078,2079` |
| 38 | `.kn-inbox-rows` | C | `:2074` |
| 39 | `.kn-inbox-sub` | C | `:2071` |
| 40 | `.kn-inbox-title` | C | `:2069,2070` |
| 41 | `.kn-kv` | F | `:2204,2205` |
| 42 | `.kn-list` | D | `:2089` |
| 43 | `.kn-list-foot` | D | `:2119` |
| 44 | `.kn-note-actions` | D/H | `:2107,2108,2273` |
| 45 | `.kn-note-desc` | D | `:2098,2102` |
| 46 | `.kn-note-line1` | D | `:2100` |
| 47 | `.kn-note-main` | D | `:2099` |
| 48 | `.kn-note-meta` | D | `:2103,2104` |
| 49 | `.kn-note-row` | D/H | `:2090,2095,2096,2098,2108,2271` |
| 50 | `.kn-note-side` | D/H | `:2105,2272` |
| 51 | `.kn-note-time` | D | `:2106` |
| 52 | `.kn-note-title` | D | `:2101` |
| 53 | `.kn-notes-col` | D | `:2087` |
| 54 | `.kn-pathstrip` | B/H | `:2048,2053,2054,2055,2276` |
| 55 | `.kn-refbtn` | F | `:2212,2218,2219,2220,2221,2222` |
| 56 | `.kn-savehint` | E | `:2126,2127,2128` |
| 57 | `.kn-src` | A | `:2044` |
| 58 | `.kn-tag` | A | `:2045` |
| 59 | `.kn-tagchip` | F | `:2228,2233,2234` |
| 60 | `.kn-tagedit` | F | `:2223,2227,2235` |
| 61 | `.kn-tb-btn` | E | `:2160,2165,2166,2167,2168` |
| 62 | `.kn-tb-sep` | E | `:2169` |
| 63 | `.kn-title-input` | E/H | `:2139,2144,2277` |
| 64 | `.kn-toolbar` | D | `:2088` |
| 65 | `.kn-type-ic` | A | `:2040` |

**段代号**:A `:2023-2046` · B `:2047-2056` · C `:2057-2085` · D `:2086-2121` · E `:2122-2194` ·
F `:2195-2241` · G `:2242-2249` · H `:2265-2281` · K43 `:551-571` · K44 `NotesMarkdownEditor.vue:40-46`。
⚠️ 同一个类出现在 H 段(响应式 `@media`)与主段是正常的,**两处规则都要搬**。

## §D.2 🔴 非 `k*` 类的处置(🔴 **登记表终值 10 → 16**,不是治理 A-10 说的「保持 10 项」)

> 🔴 **【修复轮 1 · 裁定 R8】终值是 16,不是本节初稿写的 15** —— 初稿只算了 `dot`/`lbl`/`sep`/`spacer`/`wide` 五个,
> **漏了 K45 的 `text`**(`&.text` 会被 `nonKClassNames` 扫出来,与既有四个 `&.x` 变体同款)。
> **程序化实测见 §D.2.0。下游一律用 16。**

`knowledgeStyles.test.ts` 有两条相关断言:
`:257` 「非 `k*` 前缀类全部在 `NON_K_HELPER_CLASSES` 里」+ `:262` **集合相等**(不多不少)。
`nonKClassNames()`(`:244-256`)的正则是 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/g`,排除条件是
`^k(2|n)?-` / `^fb(-|$)` / `knowledge-app` / `parser-app`。

**程序化模拟(把本期 10 段 + K45 的 2 行拼到现状文件后重跑 `nonKClassNames`)—— 新扫出 8 个**:

| 新扫出的 | 是什么 | 处置 |
|---|---|---|
| `dot` | `.kn-savehint .dot`(蓝本 `:2127` `:2128`)—— 保存状态小圆点 | 🔴 **进登记表**(真·嵌套辅助类) |
| `lbl` | `.kn-refbtn .lbl`(蓝本 `:2222`)—— 引用按钮文字 | 🔴 **进登记表** |
| `sep` | `.kn-note-meta .sep`(蓝本 `:2104`)—— 元信息分隔点 | 🔴 **进登记表** |
| `spacer` | `.kn-edit-top .spacer` / `.kn-editor-status .spacer` / `.kn-aside-title .spacer`(蓝本 `:2125` `:2193` `:2203`) | 🔴 **进登记表** |
| `wide` | `.kn-tb-btn.wide`(蓝本 `:2167`)—— H2/H3 加宽变体 | 🔴 **进登记表**(与既有 `mono`/`ghost` 同款「连写变体」) |
| **`text`**(🔴 修复轮 1 补) | **K45 的 `&.text` / `&.text:hover`**(蓝本 `:1569-1570`)—— `.k-btn` 的文字按钮变体 | 🔴 **进登记表**(与既有 `ghost`/`outline`/`primary`/`danger` 四个 `&.x` 变体**完全同款**) |
| `nme-content` | `.kn-editor-body-wrap .nme-content .ProseMirror`(蓝本 `:2171`)+ K44 顶层段 | ✅ **走排除条件**(正经前缀类,同 `knowledge-app`/`parser-app`,A-10 口径) |
| `ProseMirror` | 同上,**第三方(ProseMirror)生成的类名,大小写混排** | ✅ **走排除条件** |

### 🔴 D.2.0 **裁定 R8 —— `NON_K_HELPER_CLASSES` 终值 = 16(程序化实测,单一终值)**

**修复轮 1 实测**:把本期 10 段 + **K45 的 2 行**拼进现状 `knowledge.scss`,**重跑逐字复刻的真实
`stripComments` + `nonKClassNames` 逻辑**(脚本 = `.superpowers/sdd/p5d-gen-r8r9-sim.mjs`,`node` 直接可跑):

```
现状实测        : 10 ["danger","ghost","mono","outline","primary","right","second","spin","suffix","warn"]
现状 == 登记表   : true            ← 先自证复刻逻辑与生产一致
拼入后实测      : 18 ["ProseMirror","danger","dot","ghost","lbl","mono","nme-content","outline",
                      "primary","right","second","sep","spacer","spin","suffix","text","warn","wide"]
新扫出          : 8  ["ProseMirror","dot","lbl","nme-content","sep","spacer","text","wide"]
  走排除条件     : ["ProseMirror","nme-content"]
  进登记表       : ["dot","lbl","sep","spacer","text","wide"]      ← 6 个
🔴 R8 终值        = 10 + 6 = **16**
'text' 被 nonKClassNames 扫到 : true      ← R8「若扫不到则实测优先」的判据:**扫得到**
'nme'  被扫到                 : false     ← 蓝本零选择器,符合预期
```

🔴 **`text` 归属裁定(R8/R9 二选一,不许同时进两侧)**:
**归 R8 的登记表**,**不进 R9 的白名单**。判据是两条守卫的正则:
`nonKClassNames` 的 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/g` **会**在 `&.text {` 里匹配出 `text`(与既有
`ghost`/`outline`/`primary`/`danger` 四个 `&.x` 变体**完全同款**);而「没有搬多」的正则只收
`k*`/`fb*`/`nme*`/`ProseMirror`,**扫不到 `text`**(§D.2.1 已实测 `false`)。

→ **`NON_K_HELPER_CLASSES`:10 → 16**(加 `dot` `lbl` `sep` `spacer` `wide` **+ `text`**,各写出处注释);
**排除条件加 2 项**(`nme-content` / `ProseMirror`)。
**T2 的 `:262` 集合相等断言目标 = 这 16 个,唯一值,无开放问题。**
🔴 **治理 §9.6 / A-10 说「保持 10 项不变」是错的** —— 那句只考虑了 `nme`/`nme-content`/`ProseMirror`
三个,漏了 5 个嵌套辅助类。**照 A-10 字面做,`:262` 那条集合相等断言在 T2 一提交就红。**
⚠️ 另注:治理把 **`nme`** 也算进「会引入 `knowledge.scss` 的 3 个非 k* 类」——
**`nme` 在蓝本任何 scss 里都没有选择器**(见 §D.4),`nonKClassNames` 压根扫不到它,
**既不进登记表也不进排除条件**。所以是 **2 个**,不是 3 个。

### D.2.1 「没有搬多」扫描正则的扩法(缺口 ①,兑现 P5c §6.4.2 的债)

现状(`:198`):`/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g`
—— 扫不到 `nme-content`,更扫不到 **`ProseMirror`(有大写)**。

建议落地版:

```
/\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
```

- **字符集加 `A-Z`** = 兑现 P5c §6.4.2 那张「大小写盲区」的债(A-11:`.ProseMirror` 让它不再是理论问题);
- 🔴 **必须程序化证明新正则是旧正则的严格超集**(照 P5c §6.4.1 第 1 条的做法:对现状文件跑两版,
  断言 `old ⊆ new`),并配 RED 探针(临时塞 `.kn-foo { }` / `.ProseMirrorX { }` → 报红 → 还原);
- **扩范围 = 扫得更多,不是放宽断言。**
### 🔴 D.2.1.1 **裁定 R9 —— 白名单终值 = 293(程序化实测,单一终值)**

协调者已批准 T0 推荐的 (a) 口径:**`nme-content` / `ProseMirror` 一并进白名单**
(白名单语义 = 「本档允许存在的类」)。**常量名 `WHITELIST_226` → `WHITELIST_293`**(本档既定习惯)。

**修复轮 1 实测**(同一脚本,用**扩展后**的正则对「现状 + 10 段 + K44 + K45」扫描):

```
严格超集自证(现状) : old ⊆ new = true   (old 225 / new 225)   ← 扩范围不放宽的证据
拼入后扫出            : 292
白名单外(= 要新增)  : 67
  其中 k*/fb*         : 65        ← 即 §D.1 那 65 个
  其中非 k*           : ["ProseMirror","nme-content"]
'text' 被这条扫到     : false     ← 故 text 只归 R8 一侧,不进白名单
🔴 R9 终值             = 226 + 67 = **293**
```

**算式**:`226(现状) + 65(§D.1) + 2(nme-content / ProseMirror) = 293`。
⚠️ **K45 不改变这个数**(`text` 归 R8),故 R8 / R9 两条互不耦合、各自单值。

**复现命令**(T2 落地前自己跑一遍,输出应与上面逐字一致):

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
node .superpowers/sdd/p5d-gen-r8r9-sim.mjs     # 逐字复刻 stripComments / nonKClassNames / 两版扫描正则
```

🔴 **严格超集自证里 `old 225 / new 225` 完全相同** → 说明**这条正则改动在现状文件上零可观测**
(评审 §3 独立复现了同一结论)→ **RED 探针是唯一能证明它有判别力的手段,不许省**
(临时塞 `.kn-foo { }` 与 `.ProseMirrorX { }` 各跑一次 → 报红 → 还原)。

## §D.2.2 🔴 K44 顶层裸选择器例外(治理 §6.2-2 明令 · 裁定 R4 · **初稿整节缺失**)

**修复轮 1 补** —— 初稿只处理了 `nonKClassNames` 与「没有搬多」两条守卫,**对这一条零字**,
而治理 §6.2-2 明令要它、§11-5 把它列为评审必查项。

### 为什么需要例外(K44)

`knowledge.scss` 本档的既定口径是「新增段一律嵌进 `.knowledge-app`」(K9)。
**K44 的 `.nme-content .ProseMirror { code / pre / blockquote }`(蓝本 `NotesMarkdownEditor.vue:41-46`)
是唯一例外:保持顶层。** 理由(治理 K44 原文):蓝本它就是**非 scoped 的全局规则**,对**任何**
`.nme-content` 生效;嵌进 `.knowledge-app` 会缩小作用域 = 改行为。
它与 `knowledge.scss:2171-2182` 的 `.kn-editor-body-wrap .nme-content .ProseMirror`
是**两条不同选择器、互补生效**(前者管行内代码/代码块/引用,后者管标题/列表/表格)——
**两份都要搬,不许合并**(合并会把特异性从 (0,2,0) 变 (0,3,0))。

### 🔴 断言口径(**T2 是新建这条断言,不是修改**)

**实测证据 ①** —— 现状 `knowledgeStyles.test.ts` **压根没有这条断言**:

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -n "顶层\|裸选择器\|top-level" src/ai/styles/knowledgeStyles.test.ts   # → 只命中 K10 注释,无此断言
```

**实测证据 ②** —— **现状基线「顶层裸选择器 = 0」**(修复轮 1 实测,保行版剥注释后按大括号深度算):
现状 `knowledge.scss` 的 depth-0 开块选择器共 **15** 条,**全部**是
`.knowledge-app`(`:130` / `:345` / `:1808`)· `:root[data-theme="light"] …`(`:249` / `:1987`)·
`@keyframes`(`:1718` `:1722` `:1726` `:1730` `:1734` `:1738` `:1742` `:1754` `:1980` `:1981`)
→ **「裸选择器」(既非 `.knowledge-app` 作用域、也非 `:root…` / `@…`)实测 = 0** ✅
→ **「恰好只有一条」的集合相等断言可行。**

| 项 | 值 |
|---|---|
| 例外集合 | **`['.nme-content .ProseMirror']`**(集合相等式,**不是**「排除掉就算了」) |
| 断言形式 | 抽出 `knowledge.scss` 全部 depth-0 开块选择器 → 滤掉 `.knowledge-app*` / `:root*` / `@*` → **`expect(bare).toEqual(['.nme-content .ProseMirror'])`** |
| 基线 | 现状 **0** 条 → 落地后 **恰好 1** 条 |
| 剥注释 | **保行版 `blankComments()`**(P5c §9 第 4 条:报行号的守卫不许用删除式剥注释);且深度计算必须先剥注释,否则注释里的 `{`/`}` 会算错深度 |
| 🔴 RED 探针 | ① 往文件末尾加一条第 0 列的 `.foo { color: var(--accent); }` → **必须报红并指名 `.foo`**;② 把 K44 那段**嵌进** `.knowledge-app` → 集合变空 → **必须报红**(证明它守的是「恰好一条」而非「至多一条」);两次都要还原并 md5 自证 |
| 注释要求 | 该段在 `knowledge.scss` 里**紧邻** `.kn-editor-body-wrap .nme-content .ProseMirror` 段,注释写「蓝本 `NotesMarkdownEditor.vue:41-46`,顶层非 scoped,与上一段互补 —— 例外依据治理 §6.2 / K44」 |

⚠️ **连带**:`nme-content` / `ProseMirror` 两个类名同时受 §D.2(排除条件)、§D.2.1(白名单 293)与本节
(顶层例外)三条守卫管辖,**三处口径必须一致**,不许其中一处把它们当「不该存在的类」。

## §D.3 属性态清单(断言一律**直接比字符串,两侧都比**,禁 `toBeUndefined()`)

蓝本**逐处都套了 `String()`**(P5b E-9 已裁定:套不套渲染一致,**照抄不改**)。

| 属性 | 元素 | 蓝本行 | 取值 |
|---|---|---|---|
| `data-open` | `.kn-inbox` | `NotesView.vue:42` | `'true'` / `'false'` |
| `data-tone` | `.kn-act` | `:66` `:67` `:131` `:133` | 静态 `'confirm'` / `'danger'`(无 tone 的那个「归档」按钮**没有这个属性**) |
| `data-on` | `.k-filter-pill` ×4 | `:80` `:83` `:87` `:90` | `'true'` / `'false'` |
| `data-s` | `.kn-note-row` | `:109` | `n.status` 原值(`draft`/`curated`/`archived`);⚠️ **`status` 为 `undefined` 时属性被删**(Vue 3 `patchAttr` 对 `null`/`undefined` 才删),这是唯一允许断言「属性不存在」的一处 |
| `data-s` | `.kn-badge` | `:116` `:117` · `NoteEditPane.vue:12` `:13` `:82` `:83` `:84` | 静态 `'draft'` / `'archived'` / `'curated'` |
| `data-dirty` | `.kn-savehint` | `NoteEditPane.vue:15` | `'true'` / `'false'` |
| `data-on` | `.kn-tb-btn` 🔴 **×8** | `:43` `:44` `:45` `:47` `:48` `:50` `:51` `:52` | `'true'` / `'false'`(`tbActive()`,见 N29)。🔴 **【修复轮 1 · M-3】初稿标 ×7 是数错了** —— 同行列的 8 个行号本来就是 8 个;实测 `grep -c 'kn-tb-btn' NoteEditPane.vue` = **8**、`grep -c 'kn-tb-btn.*data-on'` = **8**。**T7/T8 的计数断言一律用 8**(照「7」写会当场红) |
| `data-on` | `.k-seg > button` ×2 | `:55` `:56` | `'true'` / `'false'` |
| `data-side` | `.kn-diff-pane` ×2 | `:163` `:167` | 静态 `'theirs'` / `'mine'` |

## §D.4 「不搬」与「蓝本零规则」清单(**「不搬 ≠ 忘搬」:断言要守得住它们不出现**)

| 项 | 蓝本 | 为什么不搬 |
|---|---|---|
| `.k-section-body` | `knowledge.scss:985-991` | **归 P5f**(P5c E-3 因 `AllowlistView` 移出而故意没搬) |
| `.k-progress-card/-row/-label/-nums/-bar/-fill` | `:1152-1157` | **N15**,两页都不用 |
| `.kn-picked` / `.kn-checkline` / `.kn-mig-*` / `.kn-pick-*` | `:2250-2263` | **P5c-T2a 已搬**(现状 `:1609+`),不重复 |
| `.kn-badge` 5 条 | `:2031-2039` | **P5b-T2 已搬**(现状 `:1596-1607`),不重复定义 |
| `.k-frow` `@media` 死规则 | `:1500-1503` | P5b 已判死规则,不搬 |
| **`.nme`** | 🔴 **蓝本任何 scss 里零选择器**(只在 `NotesMarkdownEditor.vue:2` 的 `class="nme"`) | **N10/N13 同族**:类名照抄、**不进白名单**、**不许为它凭空写规则**。⚠️ 与 N10 的差别:Vue2 里它同样无样式 → 照抄就是 1:1 |

### 🔴 D.4.1 `.k-btn.text` —— **已裁定:本期搬,偏差编号 K45**(裁定 R1)

- **事实**:`NotesView.vue:73`(「逐条审阅」)与 `NoteEditPane.vue:174`(「复制我的正文」)都写
  `class="k-btn text"`;蓝本的规则在 **`knowledge.scss:1569-1570`**
  (`.k-btn.text { background: transparent; color: var(--accent) }` + `:hover { background: var(--accent-soft) }`),
  嵌在 `.knowledge-app` 里(depth 1),属于蓝本 **`:1540` 起的「File-aggregated search: match pill +
  detail drawer」段 = P5e 的地盘**。
- **New-UI 现状**:`.k-btn` 只有 `&.ghost` / `&.outline` / `&.primary` / `&.danger`(`:716/722/728/735`),
  **没有 `.text`**。
- **后果**:照抄类名而不搬规则 → 那两个按钮渲染成**浏览器默认按钮**(灰底/边框),
  而 **Vue2 渲染的是无底色的蓝色文字按钮** → **界面不 1:1**。
  🔴 **这不是 N10 家族**(N10 是「Vue2 里也没有样式」);这是「Vue2 有、我们漏了」。
### 🔴 K45(**协调者 2026-08-04 追认,裁定 R1**)—— 本期搬 `.k-btn.text`

| 项 | 口径 |
|---|---|
| **搬什么** | 蓝本 `knowledge.scss:1569-1570` 的 `.k-btn.text { background: transparent; color: var(--accent); }` + `.k-btn.text:hover { background: var(--accent-soft); }` **两行** |
| **搬到哪** | New-UI `knowledge.scss` 既有 `.k-btn { … }` 块内,**插在 `&.danger`(`:735-742`)之后、`&:disabled`(`:743`)之前** —— 与蓝本源序一致,**不改级联**。写成嵌套 `&.text { … }` / `&.text:hover { … }`(与既有四个变体同款) |
| **依据(裁定书 R1,不必再自行论证)** | **K43 逐字同构先例**:`.k-seg`(蓝本 `:551-571`)同样嵌在**别期的段**里(Search page `:457-733`)、同样是 `.knowledge-app` 层级共享原语、同样零色字面量、治理同样写了「P5e 不许重复搬」。`.k-btn.text` 落在 `:1540` 起的 P5e 搜索抽屉段,性质完全一致。协调者已核 **P5e 无「整段搬 `:1540-…`」的规划** → 零冲突(裁定 R13) |
| **零色字面量** | ✅ `transparent` 是关键字(不算配色)+ `--accent` / `--accent-soft` **两档都已声明** |
| **归属** | `text` 进 **`NON_K_HELPER_CLASSES`(R8 → 16)**,**不进**白名单(R9 的正则扫不到它,§D.2.0 已实测) |
| **声明处注释** | 必须引「**K45** / 蓝本 `knowledge.scss:1569-1570`」(**引治理条目编号比引行号稳**,P5c §8.4 连带纪律) |
| 🔴 **P5e 交接项(必须落,裁定 R1-①)** | **`.k-btn.text` 已由 P5d 搬入(K45),P5e 不许重复搬** —— P5e 若要搬 `:1540-…` 那一段,**必须跳过 `:1569-1570` 这两行**。与 K43 的 `.k-seg`「P5e 不许重复搬」逐字同款 |
| 🔴 **重复搬的可守性(裁定 R1-②)** | 「没有搬多」那条**白名单集合**断言天然守不住重复(`text` 不在它的正则里)→ **改由 `knowledgeStyles.test.ts` 的「每个白名单类只有一份规则」同族手法守**:给 `.k-btn.text` 加一条 **`&.text` 在文件里恰好出现 2 次**(规则 + `:hover`)的计数断言,P5e 重复搬时**立刻报红**。**这条是 K45 的落地 DoD 之一,T2 必须写。** |
| **为什么不是 N10 家族** | N10(`.k-empty-btn`)/ N13(`.k-status-badge-cn`)是「**Vue2 里也没有样式**」→ 照抄无样式才是 1:1;`.k-btn.text` 是「**Vue2 有样式、我们漏了**」→ 不搬则两个按钮从「无底色蓝字」变浏览器默认灰底按钮 = **界面不 1:1** |
| **唯一性** | 评审独立验证:98 个模板静态类里「蓝本 scss 与 New-UI 双双无规则」的只有 `nme`(N10,不搬)与 `text` → **`.k-btn.text` 是本期唯一真缺口**(§D.0.1) |

## §D.5 `KIcon` 复核(19/19 全在)+ 未知 `name` 的实测行为

- **19 个 glyph 逐个 `grep -cE "^\s+<name>:\s*'"` = 1/1 命中 ✅**:
  `folder chev edit plus sparkle check trash funnel layers x code file clock copy drive bot paperclip danger user`
- 🔴 **`PATHS` 实测 **42** 个键,不是治理 §1.2 / 计划 §0.4 写的 43**(P5c 记的 42 是对的;
  程序化计数 + 去重检查:零重复键)。**勘误,见报告 E-35。**
- **未知 `name` 的行为**(§1.2 要求 T0 实测):**`KIcon.vue:71`**(**【修复轮 1 · M-2】初稿写 `:58` 是错的**,
  结论不变)是
  `const pathHtml = computed(() => PATHS[props.name] || '')`,模板 `v-html="pathHtml"`
  → **未知名字渲染成一个空的 `<svg>`(不报错、不警告、静默无图形)**。
  → `NOTE_TYPES` / `NOTE_SOURCES` 的动态 `:name` 靠 `noteTypeMeta`/`noteSourceMeta` 的
  `|| NOTE_TYPES.note` / `|| NOTE_SOURCES.human` 兜底,**照抄即可**;
  但**兜底分支必须有用例**(喂一个不存在的 `type`/`createdBy`,断言 KIcon 的 `name` 回落成 `edit`/`user`)。

## §D.6 🔴 tiptap / ProseMirror 在 jsdom 下的可测性(治理 §9.7,**T0 实测结论**)

### 结论:**能真实挂载,不需要 mock。** `NotesMarkdownEditor.test.ts` 一律用**真 `Editor`**。

**探明方式**(不碰本仓:在 `/tmp/p5d-tiptap-probe/` 建了一个隔离工程,依赖版本与本仓**逐一对齐**
—— `vitest 4.1.9` / `jsdom 24.1.3` / `vue 3.5.39` / `@vue/test-utils 2.4.11` / `@vitejs/plugin-vue 6`):

| 探针 | 结果 |
|---|---|
| A `new Editor({ extensions:[StarterKit, Markdown], content:'# hello\n\nworld' })` | ✅ **挂载成功**;`storage` 键含 `markdown` / `markdownTightLists` / `markdownClipboard`;`storage.markdown.getMarkdown()` 回 `"# hello\n\nworld"`;`getHTML()` 回 `<h1>hello</h1><p>world</p>` |
| B `isActive('bold')` / `chain().focus().selectAll().toggleBold().run()` / `onUpdate` / `onTransaction` / `commands.setContent()` | ✅ 全部工作:`isActive` `false → true`;markdown 变 `**abc**`;`updates=1` `transactions=1`;`setContent('## replaced')` 后 markdown 与 `isActive('heading',{level:2})===true` 都对 |
| D 真 SFC(`<editor-content :editor>` + `onMounted` 建 Editor,**不传 `element`**)在 `@vue/test-utils` 下 | ✅ 真渲染出 `<div contenteditable="true" role="textbox" class="tiptap ProseMirror">`,内含 `<h1>hi</h1><p>body</p>`;`ready` / `update:modelValue` / `input` / `transaction` 四个 emit 全部可断言;**防回环可测**(同值 `setProps` → `setContent` 调用数 0→0;异值 → 0→1) |
| E `onBeforeUnmount` 里 `editor.destroy()` | ✅ `vi.spyOn(ed,'destroy')` 在 `w.unmount()` 后计数 1 |
| C(**失败,是探针本身写错**) | 给 Editor 传了 `element` **又**单独 mount `EditorContent` → 渲染出空 `<div>`。**正确用法是不传 `element`,让 `EditorContent` 挂载它**(= 蓝本的写法)。**记下来免得 T4 踩同一个坑** |

⚠️ **jsdom 需要 `attachTo: document.body`** 才稳(探针 D/E 都用了);未挂真实 document 时 ProseMirror 的
selection/`getClientRects` 相关路径可能异常。
⚠️ **等待时机**:`onMounted` 里建 Editor → 断言前要 `await nextTick()` **再** `await flushPromises()`
(探针里用 `new Promise(r => setTimeout(r,0))`),单个 `nextTick` 不够。

### D.6.1 三条高危行为该把断言落在哪(治理 §9.7 的追加要求)

既然是真 `Editor`,三条**都有条件**落在**真行为层**,判别力最高。

> 🔴🔴 **【修复轮 1 · 裁定 R5】三条里只有前两条被探针**实证**过,N29 那条是**推理**,不是实证。**
>
> | 条目 | 探针覆盖 |
> |---|---|
> | K38 两个 emit | ✅ **实证**(探针 D:`update:modelValue` 与 `input` 各一条,payload 是 markdown) |
> | §5.3 防回环 | ✅ **实证**(探针 D:同值 `setProps` → `setContent` 0 次;异值 → 1 次) |
> | **N29 `tbTick` 假依赖** | 🔴 **未实证** —— 探针只挂了**编辑器 SFC**;父组件那条链路(`tbActive()` 方法 + `tbTick` ref 假依赖 + `@transaction="tbTick++"` → `.kn-tb-btn` 的 `data-on` 翻转)**从未挂载过**。探针只证了**前提**:`onTransaction` 真的会触发(实测一次 `insertContent` 触发 **2** 次)、`isActive(name, attrs)` 真的可用 |
>
> **机制上风险低**(蓝本 `NoteEditPane.vue:227-230` 的 `tbActive` 是**模板内调用的 method**,
> Vue 3 的渲染 effect 会追踪表达式里读到的 `tbTick.value`),**但「低风险」不等于「已证」。**
> 🔴 **T4 / T7 不许引本节当已证**,必须各自附**变异证据**(删掉 `tbTick.value >= 0 &&` → 对应用例报红)。

下表是三条各自的建议写法与「拿掉哪一行必须报红」:

| 条目 | 断言写法 | 拿掉生产代码哪一行必须报红 |
|---|---|---|
| **K38 两个 emit** | 真敲一次内容(`ed.chain().focus().insertContent('x').run()`),断言 `w.emitted('update:modelValue')` **与** `w.emitted('input')` **各**有一条、且 payload 是 markdown | 删 `emit('input', md)` → 只有 `input` 那条红(**两条断言分开写,不许合并**) |
| **§5.3 防回环** | 用 `vi.spyOn(editor.commands,'setContent')` 或计数器:同值 `setProps` → 0 次;异值 → 1 次 | 删 `v !== editor.storage.markdown.getMarkdown()` 这半个条件 → 同值那条红 |
| **N29 `tbTick` 假依赖**(🔴 **未被探针覆盖,见上方 R5 框**) | 挂 **`NoteEditPane`**(不是编辑器 SFC),真敲 `toggleBold` → 断言 `.kn-tb-btn` 的 `data-on` 从 `'false'` 变 `'true'`(**属性字符串两侧都比**) | 删 `tbTick.value >= 0 &&` → 工具栏 active 态不刷新 → 报红。**T4/T7 必须自己跑这个变异并贴两段输出** |

### D.6.2 依赖版本的**勘误**(K37 / A-7 的前提有误)

| 项 | 治理 K37 / 计划 A-7 | 蓝本 `package.json`@`7a6ee6b7` 实际 | 锁文件实际解析 |
|---|---|---|---|
| `tiptap-markdown` | 🔴 「蓝本用 … `tiptap-markdown@^0.6.1`」 | 🔴 **`^0.8.10`** | **0.8.10**,peer = `@tiptap/core: ^2.0.3` |
| `@tiptap/*` | `^2.27.2`(要装的) | `^2.0.4`(声明) | **2.10.3** |
| 蓝本另有的直接依赖 | 未提 | `@tiptap/core` `@tiptap/extension-highlight` `@tiptap/extension-typography` | 2.10.3 |
| `markdown-it` | 「已在本仓 dependencies 里(`tiptap-markdown` 的运行时依赖)」 | 蓝本 `^13.0.1`;本仓 `^14.3.0` | `tiptap-markdown@0.8.10` **自带** `markdown-it: ^14.1.0` 作为**自己的直接依赖** → 与本仓那条声明无关,两者互不影响 |

🔴 **`^0.6.1` 是错的。装 0.6.1 = 用一个蓝本从未验证过的版本做 1:1 移植 —— 正是 K37 想避免的风险,方向反了。**

### 🔴 D.6.3 **裁定 R2 —— 版本终值(T4 直接照本节做)**

| 项 | 终值 |
|---|---|
| **要装的四个包** | `@tiptap/vue-3@^2.27.2` · `@tiptap/starter-kit@^2.27.2` · `@tiptap/pm@^2.27.2` · **`tiptap-markdown@^0.8.10`** |
| **治理 K37 / 裁定 A-7 的 `^0.6.1`** | 🔴 **作废**,以 **E-36** 为准(蓝本 `package.json:74` 就是 `^0.8.10`,锁文件解析 `0.8.10`) |
| **K37「锁 v2、不许 v3」是否被破** | **没有** —— `0.8.10` 仍在 v2 线,peer 是 `@tiptap/core: ^2.0.3`(v3 那条线是 `tiptap-markdown@0.9.x` → peer `@tiptap/core@^3.0.1`) |
| 🔴 **治理 §14-1 的期望版本串必须同步改** | 原文要求「四个都要是 `2.x` / **`0.6.x`**」→ **改成 `2.x` / `0.8.x`**。**不改,T4 按 §14-2 核实版本时会把自己判红**(装出来是 `0.8.10`,对不上 `0.6.x` 的期望) |
| **不装 `@tiptap/core`** | 它是 `@tiptap/vue-3` 的 **peer**,pnpm 自动装。✅ **「四个包够用」已实证**:T0 探针里没有显式声明 core,五项探针照样全过 |
| **不装 `extension-highlight` / `extension-typography`** | 蓝本有这两个直接依赖,但 **P5d 三个蓝本文件里 `Highlight` / `Typography` 零引用**(`NotesMarkdownEditor.vue:8-10` 只 import `Editor`/`EditorContent` + `StarterKit` + `Markdown`;评审已复核)→ 装了就是没用的依赖 |
| **`markdown-it`** | **不用另装、也不许改本仓那条 `^14.3.0`** —— `tiptap-markdown@0.8.10` **自带** `markdown-it: ^14.1.0` 作为自己的直接依赖,与本仓那条声明互不影响 |
