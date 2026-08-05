# P5f 附录 D —— CSS 类清单(T0 产出,2026-08-06)

> 🔴 **一律用「class 属性里的完整 token 精确匹配」,禁 `\b` 词边界**(E-25:`k-frow\b` 会被 `k-frow-path` 假命中)。
> 🔴 **判定「类是否已被搬」时必须先剥注释**(E-60 的**否定式断言方向**)—— 见 §D.1.1 的实证。

## D.0 终值总表

| 项 | 值 |
|---|---|
| 三个段内 distinct class token | **81** |
| ⛔ 其中 24 死类命中的 | **6**(`.k-progress-*`,全在 `:1152-1160`) |
| ✅ 已搬(**不许重复搬**) | **6** |
| ⚠️ 半搬 | **0** |
| 🔴 **本期必搬(`knowledge.scss` 侧)** | **69** |
| 🔴 **外加 K53 的 `kr-*`** | **9** |
| 🔴 **本期新增类合计** | **78** |

### 🔴 D.0.1 「67」与「69」的差 2 —— 勘误 E-67

`p5-master-plan.md` §2.1 给 P5f 记的是 **67**。**实测差集是 69。** 差的正是
**`.k-section-body`** 与 **`.k-frow`**。

~~原理由(T0):它们被 §2.1 归在**主表之外**,由 §2.3「跨期漏搬」单独登记 ⇒ `67 + 2 = 69`,两份口径一致。~~

### 🔴 D.0.2 订正块(T0b · 裁定 §三 **M-5**)—— **E-67 结论保留、理由改写**

**🔴 结论不变:下游一律用 69**(T0 与独立评审各自算得 69,T0b 复核同值)。**只改理由。**

**原理由被证伪**:它假定「§2.3 的条目天然在 §2.1 主表计数之外」。
**反例**:§2.3 里的 **`.k-suggest-chip` 同时出现在 §2.4 的 P5e 52 类清单里**(`:357 .k-suggest-chip ★E-52`)
⇒ **§2.3 的条目并不一律外加**,这条推理不成立。
🔴 **原文那句「§2.3 的条目在主表计数之外」已整条删除** —— 留着会被下游当成通用规则去算错别的期。

**🔴 改写后的理由(真因,与本附录 §D.1.1 的实测自洽)**:
`p5-master-plan.md` §2 的差集法是「**蓝本 693 选择器 − 本仓 293 选择器**」。
而本仓这两个类**恰恰以「为什么不搬」的注释形式存在**
(`knowledge.scss:64` / `:1294-1295` / `:1578` / `:1610` / `:1640` —— 见 §D.1.1 的逐行回读)
⇒ **若当时的「本仓 293 选择器」提取没剥注释**,这两个会被当成「本仓已有」而从 149 差集里掉出去
→ 算出 **67** 而不是 **69**。

⚠️ **这与本附录开头那条铁律同源**:🔴 **判定「类是否已被搬」必须先剥注释**(E-60 的否定式断言方向)。
E-67 就是**没剥注释**在上游文档里留下的一处后果。

## D.1 🔴 协调者粗匹配结论的复核(**结论:全是假阳性,但真因和协调者猜的不同**)

协调者说「本仓有 **3 处 `k-section-body` / 25 处 `k-frow`**」,并猜是 `\b` 词边界假命中。
**两半都要订正:**

| 类 | 精确 class-token 扫 `.vue` | `\b` 粗扫 `.vue` | 剥注释前扫 `.scss` | **剥注释后**扫 `.scss` | 三态 |
|---|---|---|---|---|---|
| `k-section-body` | **0 个文件** | **0 次** | **3 次** | 🔴 **0 次** | **未搬** ✅ |
| `k-frow` | **0 个文件** | 20 次 | **4 次** | 🔴 **0 次** | **未搬** ✅ |

### D.1.1 真因:那 3 / 4 处**全在 SCSS 注释里**

```
src/ai/styles/knowledge.scss
  :64    * 【显式不搬】蓝本 :985-991 的 .k-section-body 是 Allowlist 页专用(A 段的边界因此是
  :1294      🔴 蓝本 :985-991 的 .k-section-body 是 Allowlist 页专用,本期不搬 —— A 段的边界
  :1295      因此是 :984 而不是 :988(按 :988 切会把 .k-section-body 截成半条规则,sass 报错)
  :20     * (蓝本 :1676-1702,级联上永不生效)· 附录 D.5 的 .k-frow 死规则。
  :1578      k-quick-grid、k-status-strip 仍不在白名单,.k-frow 是死规则(附录 D.5),都不搬。
  :1610      .k-status-strip 与 :1500-1503 的 .k-frow 仍不搬(后者见附录 D.5:两个模板
  :1640      附录 D.5 的另一条死规则(:1500-1503 的 .k-frow)在 S6 范围内,T2 已说明不搬。
```

🔴 **它们是前几期「为什么故意不搬」的说明性注释**,不是规则。
⇒ **协调者的「几乎肯定是 `\b` 假阳性」判断方向对了(确实是假阳性),但根因是注释不是词边界。**
🔴 **计划书 §0.1-2 的结论「本期要搬 `.k-section-body` 与 `.k-frow`」成立,不变。**

### D.1.2 ⚠️ `k-frow` 的 `\b` 粗扫确实也有 20 次假命中(E-25 依然真实存在)

那 20 次全部来自 `IndexedFilesView.vue` 的 **`k-frow-f` / `k-frow-fhead` / `k-frow-pathcell` /
`k-frow-pathtxt` / `k-frow-num` / `k-frow-status` / …**(P5b 产出的**另一族**)。
🔴 **本期新增的 `k-frow-head` / `k-frow-root` / `k-frow-root-icon` / `k-frow-path` / `k-frow-action`
与它们是不同 token,零碰撞** —— 但**任何扫描一律用完整 token 精确匹配**。
⚠️ 特别注意 **`k-frow-path`(本期)vs `k-frow-pathcell` / `k-frow-pathtxt`(P5b)** 极易被 `\b` 混淆。

## D.2 ✅ 已搬清单(6 个,**不许重复搬**)

| 类 | 本仓坐标(剥注释后的真规则) | 来源 |
|---|---|---|
| `k-btn` | `:1125` `:1727` `:1981` | P5a/P5b |
| **`k-confirm-body`** | 🔴 **`:1541`** | **P5b-T2**(见 §D.3 的边界陷阱) |
| `k-set-card` | `:1325` | P5c-T2a |
| `k-set-row` | `:1334` | P5c-T2a |
| `k2-tag` | `:2793` `:2907` `:2941` | P5a |
| `knowledge-app` | `:162` `:355` `:476` `:2536` `:2762` `:2941` | 作用域根(不是要搬的类) |

**另外这些在治理 §6.1 表里点名「已搬」的,本期段内没出现,不构成风险**:
`.k-adv-toggle`+`.chev`(P5e-T2)· `.k-seg` · `.k-btn.text` · `.k-empty*` · `.k-skel` · `.k-modal*` ·
`.k-scroll` · `.k-row-action` · `.k-sw` · `.k-radio-group` —— 它们被本期三页**使用**,但**定义不在**本期三段内。

## D.3 🔴🔴 三个段的**真实边界**(治理写的两个都要订正)

| 段 | 治理写的 | 🔴 **实测应取** | 为什么 |
|---|---|---|---|
| Allowlist A | `:985-1160` | 🔴 **`:985-1141`** | **段尾 `:1152-1160` 压着 6 个 `.k-progress-*` 死类**(§D.4),且 `:1142` `.k-set-card` / `:1159` `.k-set-row` **已搬**、与死类**交错** —— 见 §D.3.1 |
| Allowlist 弹窗 | `:1342-1400` | 🔴 **`:1342-1396`** | **`:1398` 起是 `.k-confirm-body`,P5b-T2 已搬(本仓 `:1541`)**。按 `:1400` 整段搬会**重复定义** |
| Wiki | `:2453-2561` | ✅ **`:2453-2561`** 不变 | 含 `.knowledge-app` 段头(`:2456`)与两个 `@media`(`:2551` `:2554`),见 §D.6 |

### 🔴🔴 D.3.0 订正块(T0b · 裁定 **R4** / 评审 **I-1**)—— **本附录只给一个 A 段数字**

**原缺陷**:本汇总表原先在「实测应取」一栏给 Allowlist A 段写了一个**比 `:1141` 更大的段尾行号**,
与紧随其后的 §D.3.1、以及 T0 报告 §7.3 给出的 `:985-1141` **互相矛盾**。
**汇总表是 T2 第一眼看的那一行** ⇒ 按那个错数搬,会把**已搬的 `.k-set-card` 重复定义**带进来,
而**重复定义不会被死类白名单捕获**,只有区间锚定的计数断言会响 —— 正是计划书警告的
「实现者误判成白名单数字错了而去改白名单」的触发条件。

🔴 **处置(按 R4,不是加脚注)**:那个错误行号**已从本文档整条删除**,全文档对 A 段
**只保留 `:985-1141` 一个数字**。**留着两个数字还会被看错。**

🔴 **T0b 自己逐行复读蓝本 `:978-1170` 的复核结论(不采信评审,命令与输出见 `p5f-task-0b-report.md` §1)**:

```
:985   .k-section-body {          ← A 段真正的第一行
:1123  .k-priority-hint {
:1139  }                          ← .k-priority-hint 闭合 = A 段最后一行真规则
:1140  (空行)
:1141  /* ---------- Settings page ---------- */    ← 🔴 注释,不搬(见下)
:1142  .k-set-card {              ← ✅ P5c-T2a 已搬(本仓 :1325)
:1152-1157  .k-progress-*         ← ⛔ 6 个死类
:1159  .k-set-row {               ← ✅ P5c-T2a 已搬(本仓 :1334)
```

🔴 **`:1141` 那行 `/* ---------- Settings page ---------- */` 注释也不搬** ——
段边界写成 `:985-1141` 是为了和 §D.3.1 / 报告 §7.3 / 裁定 R10 终值表**用同一个数字**,
但**实际落进 `knowledge.scss` 的最后一行内容是 `:1139` 的 `}`**;
那行注释搬进来会在本仓指向一个**不存在的 Settings 段**,是误导。

### 🔴 D.3.1 Allowlist A 段尾的**双重**陷阱(比计划书写的更麻烦)

```
:1139  }                       ← .k-priority-hint 闭合 = 最后一行要搬的内容
:1141  /* ---- Settings page ---- */  ← 🔴 注释,不搬(§D.3.0)
:1142  .k-set-card   { … }     ← ✅ 已搬(P5c-T2a),不许重复搬
:1152  .k-progress-card  ┐
:1153  .k-progress-row   │
:1154  .k-progress-label │     ← ⛔ 6 个死类
:1155  .k-progress-nums  │
:1156  .k-progress-bar   │
:1157  .k-progress-fill  ┘
:1159  .k-set-row    { … }     ← ✅ 已搬(P5c-T2a),不许重复搬
```

🔴 **死类不是「压在段尾」那么简单 —— 它们被两个已搬类夹在中间。**
⇒ **`:985-1160` 里真正要搬的是 `:985-1141`**,`:1142` 之后**一个都不搬**。
🔴 **T2 不许「整段搬再删死类」** —— 那样还会带进 `.k-set-card` / `.k-set-row` 的重复定义,
而重复定义**只有区间锚定的计数断言会响**,不是死类白名单。

## 🔴 D.3.2 勘误 **E-74** —— N54 的扩展名表是 **12 + 13 + 25 = 50**(治理/计划书写的 24 是错的)

**原文**:治理 §3.5 的 **N54** 与计划书 **T4-4** 都写「照抄那三张 `match` 扩展名表逐字(共 **12+13+24** 项)」。
🔴 **实测(T0b 自己程序化数蓝本 `AllowlistView.vue:161/163/165` 三个数组,不采信评审)**:

```
docs (:161) = 12    text (:163) = 13    code (:165) = 25    total = 50
组内重复 0 · 跨组重复 0
```

**`code` 组逐项(25 项,一个不多一个不少)**:

| # | 扩展名 | # | 扩展名 | # | 扩展名 | # | 扩展名 | # | 扩展名 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `.py` | 6 | `.tsx` | 11 | `.h` | 16 | `.php` | 21 | `.sql` |
| 2 | `.go` | 7 | `.java` | 12 | `.hpp` | 17 | `.sh` | 22 | `.lua` |
| 3 | `.js` | 8 | `.c` | 13 | `.cs` | 18 | `.bash` | 23 | `.kt` |
| 4 | `.ts` | 9 | `.cc` | 14 | `.rb` | 19 | `.zsh` | 24 | `.scala` |
| 5 | `.jsx` | 10 | `.cpp` | 15 | `.rs` | 20 | `.fish` | 25 | `.swift` |

**`docs` 组(12)**:`.pdf .docx .doc .pptx .ppt .xlsx .xls .odt .html .htm .xml .epub`
**`text` 组(13)**:`.md .markdown .txt .rst .csv .tsv .json .yaml .yml .toml .ini .env .log`

🔴 **落地(裁定 R5)**:T4 brief 用 **50**;三条计数断言 **`toBe(12)` / `toBe(13)` / `toBe(25)`**。
🔴 **N54 的实质不变**:三张表**逐字照抄,不许补全也不许删减**。
实现者若发现照抄结果与某个数字对不上,**以蓝本实测为准并申报(R18),不许删项目去迁就断言**。

**为什么这是缺口而不是小事**:T4 的 brief 会把「24」当成校验数。实现者照抄 25 项后发现对不上,
两条路都危险 —— 删一项(N54 明令禁止,会**静默隐藏一个扩展名**)或改断言迁就。

## D.4 ⛔ 24 个死类清单(逐字抄自 `p5-master-plan.md` §2.2,**一个都不许搬**)

```
:272-349   .k-hero  .k-hero-orb  .k-hero-title  .k-hero-sub
           .k-hero-search  .k-hero-search-go  .k-hero-search-kbd          (7)
:380-411   .k-stat  .k-stat-label  .k-stat-value  .k-stat-suffix  .k-stat-cn (5)
:413-455   .k-quick-grid  .k-quick-card  .k-quick-icon
           .k-quick-card-title  .k-quick-card-en  .k-quick-card-desc      (6)
:1152-1160 .k-progress-card  .k-progress-row  .k-progress-label
           .k-progress-nums  .k-progress-bar  .k-progress-fill            (6)
```

🔴 **`knowledgeStyles.test.ts:491` 那条断言已存在,钉住这 24 个类名在 `knowledge.scss` 里零出现。**
🔴 **报红时先回查本清单,不许改白名单、不许放宽断言(§9.10)。**
⚠️ **本期只有最后 6 个(`.k-progress-*`)落在段内**,前 18 个不在本期任何一段里。

## D.5 🔴 K53 —— `kr-*` 9 个类单列(勘误 E-63)

**来源**:`RootsView.vue` 的 `<style lang="scss" scoped>`,蓝本 `:223-289`(**66 行**)。
🔴 **它们不在 `p5-master-plan.md` §2 的 67 类里** —— 那份是只按 `knowledge.scss` 差集算的,
**差集法结构性地看不到 `.vue` 自带的 `<style scoped>`**(同族漏法:P5e 的 `KFileViewer.vue` 51 行)。

| # | 类 | 蓝本行 | 备注 |
|---|---|---|---|
| 1 | `kr-empty` | `:224` | 🔴 **本机唯一可达态**(§9.17) |
| 2 | `kr-path` | `:234` | 含嵌套 `&[data-off="true"]`(`:236`) |
| 3 | `kr-badge` | `:238` | 🔴 **含 K54 兜底字面量**(`:243`)→ 附录 B §B.2 |
| 4 | `kr-label` | `:245` | |
| 5 | `kr-input` | `:251` | 🔴 **含 K54 兜底字面量**(`:254`)→ 附录 B §B.2 |
| 6 | `kr-adv-row` | `:261` | |
| 7 | `kr-error` | `:269` | K59 的内联错误行 |
| 8 | `kr-check` | `:277` | |
| 9 | `kr-hint` | `:284` | |

### 🔴 D.5.1 逐类证明「丢 `scoped` 无害」

**判据**:`kr-` 前缀在**全仓唯一** ⇒ 搬进 `knowledge.scss` 并嵌进 `.knowledge-app` 后,
不可能与任何既有选择器碰撞。

```bash
$ grep -rEc "kr-" src/ --include=*.vue --include=*.ts --include=*.scss --include=*.css | grep -v ":0"
(无输出)
```
⇒ 🔴 **全仓 `kr-` 出现次数 = 0**(不是「9 个类各自唯一」,而是**整个前缀零占用**)⇒ **9 个类逐个无碰撞。**
⚠️ 该命令用的是子串匹配(比完整 token **更宽**)——**更宽的口径都扫不到,结论只会更强。**

## D.6 🔴 守卫终值 —— `WHITELIST_348` 与 `NON_K_HELPER_CLASSES`

### D.6.1 🔴🔴 **T0 实测出一个计划书没预料到的结构性问题:`kw-*` 也不被 `NEW_RE` 认**

计划书只问了 `kr-*`。**实测两个都不认:**

```js
NEW_RE = /\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
```
`k(?:2|n)?-` 只接受 `k-` / `k2-` / `kn-`。`kr-` 的 `r`、`kw-` 的 `w` **都不是 `2` 也不是 `n`** ⇒ 不匹配。

| 样例 | `NEW_RE` 认? | 落 `nonKClassNames`? |
|---|---|---|
| `.k-frow` `.k-ext-chip` | ✅ | 否 |
| `.k2-tag` `.kn-badge` `.fb-row` | ✅ | 否 |
| 🔴 **`.kw-split` 等 41 个** | ❌ | 🔴 **是** |
| 🔴 **`.kr-empty` 等 9 个** | ❌ | 🔴 **是** |
| `.cur` | ❌ | 是 |
| `.knowledge-app` | ❌ | 否(走排除条件) |

⇒ **若不处理,`nonKClassNames` 的「集合相等」断言(`toEqual([...NON_K_HELPER_CLASSES].sort())`)
会一次报出 51 个未登记类(41 `kw-*` + 9 `kr-*` + `cur`)。**

### D.6.2 两个落法与各自的算式

| | **方案 A**(计划书的假设) | **方案 B**(`fb`/`nme` 同款先例) |
|---|---|---|
| 做法 | `kw-*`/`kr-*`/`cur` 全塞 `NON_K_HELPER_CLASSES` | 把 `NEW_RE` 的 `k(?:2\|n)?-` 扩成 `k(?:2\|n\|r\|w)?-`,`kw-*`/`kr-*` 进白名单;只有 `cur` 进非 k* 表 |
| `WHITELIST_348` | `348 + 27` = **375** | `348 + 27 + 41 + 9` = **425** |
| `NON_K_HELPER_CLASSES` | `19 + 41 + 9 + 1` = **70** | `19 + 1` = **20** |

### 🔴 D.6.3 T0 的建议:**方案 B**,但**需要协调者裁定**

**理由(全是本仓既定先例,不是我的偏好)**:
1. `NON_K_HELPER_CLASSES` 的语义在测试注释里写死了是**「真·嵌套辅助类」**
   (`.right` / `.mono` / `.dot` / `.sep` / `.chev` 这种单词);那条断言的名字原文就是
   **「防清单变垃圾桶」**。塞 50 个正经前缀类进去,正好把它变成它要防的东西。
2. **`fb-*` 是逐字同款的先例**:P5c-T2a 从 `FolderBrowser.vue` 的 `<style scoped>` 搬入 8 个
   `fb-*` 类,做法是**给 `NEW_RE` 加一个 `fb` 分支 + 8 个类进 `WHITELIST_348` + 在
   `nonKClassNames` 里加排除条件**。测试注释原文:「`fb` / `fb-*` … 是本档正经前缀类、
   **已进 `WHITELIST_348`**、且已被上面那条『没有搬多』扫描覆盖,这里一并排除」。
   **K53 的 `kr-*` 与 `kw-*` 与它同构。**
3. 扩 `NEW_RE` 是**扩大扫描范围 = 加固**,本仓已做过两次(P5c-T2a 的 `fb`、P5d-T2 的
   `A-Z`+`nme`+`ProseMirror`),**既定流程是配一条「严格超集自证(old ⊆ new)」**。

**严格超集自证(T0 已预跑,T2 要在真文件上重跑)**:

| 类 | old `NEW_RE` | new(扩 `r`/`w`) |
|---|---|---|
| `k-btn` / `k2-tag` / `kn-badge` / `fb-row` / `nme-content` / `ProseMirror` | ✅ | ✅ |
| `kw-split` / `kr-empty` | ❌ | ✅ **新增覆盖** |
| `cur` / `knowledge-app` | ❌ | ❌ |

⇒ **`old ⊆ new` 成立**,零类逃逸。

🔴 **T2 开工前必须先拿到协调者对 A/B 的裁定** —— 这不是实现细节,它改的是全仓守卫的扫描范围。
**拿不准就 `NEEDS_CONTEXT`,不许自己选。**

### 🔴 D.6.4 「常量 348 ≠ 扫出 347」那 1 差 —— **真因确认,不许修平**

`knowledge-app` 在 `WHITELIST_348` 里,但 **`NEW_RE` 扫不到它**
(`k` → `(?:2|n)?` 匹配 `n` → 然后要 `-` 却遇到 `o`,失败;空匹配后要 `-` 却遇到 `n`,也失败)。
⇒ **常量长度 348、`NEW_RE` 在文件上扫出 347,差的就是它。这是正常的,不许去修平。**
可跑 `node .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs` 复现基线。

#### 🔴 D.6.4.1 勘误 **E-75** —— **评审 M-2 不成立**(T0b 实测反转,承 R18)

**评审 `p5f-task-0-review.md` §6 M-2 主张**:上面这行引用的 `p5e-fixtures/scripts/sim-r8r9.mjs`
**「不存在」**,「T2 照着跑会直接失败」;裁定 R5 的 §三 M-2 据此要求 T0b 换掉这条命令,
并登记勘误说 `p5e-handoff-to-p5f.md:70`「复现脚本可跑 …(10/10 脚本 exit 0)」那句不成立。

🔴 **T0b 实测:该脚本存在、被 git 跟踪、在 HEAD 里、且真能跑通。** 因此 **M-2 与 E-75 的原始命题全部推翻。**

```
$ ls -la .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
-rw-rw-r-- 1 nimo nimo 4702 Aug  5 13:23 …/sim-r8r9.mjs
$ git ls-files --error-unmatch .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
.superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs          ← 已跟踪
$ git cat-file -s HEAD:.superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs
4702                                                        ← 在 HEAD 里
$ node .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs ; echo exit=$?
…
现状        : 347 类
常量 WHITELIST_348 现长度 348;其中已含本期新类 0 个
=> 常量终值 = 348 + 0 = 348
exit=0                                                      ← 正是本节要复现的 348 vs 347 基线
```

**评审为什么会看错**:它贴的 `ls` 输出只有 7 个文件
(`_inputs classes2 collide k48-equiv lookup propose replay-fixtures`)——
恰好是该目录 **11 个文件按字典序的前 7 个**,`s`/`v` 开头的 4 个
(`scan-i18n2` `scan-p5e` `sim-r8r9` `verify-fixtures`)整批缺席 ⇒ **是它那次 `ls` 输出被截断**,不是文件不在。
佐证:`git ls-tree --name-only 973a9b8 …/scripts/` 列出 **11 个**,
且 `sim-r8r9.mjs` 早在 P5e 的 `d79d922` 就已入库。

🔴 **处置**:① **§D.6.4 的这条命令不改** —— 它真能跑,是本节基线的正确复现方式;
② **E-75 反转登记**为「评审 M-2 的事实前提不成立」,不再指控 `p5e-handoff-to-p5f.md:70`;
③ **`p5e-handoff-to-p5f.md:70` 那句成立**,下游可照用。

⚠️ **给下游的教训(与本仓既有的 E-25 家族同源)**:
**「文件不存在」这类否定式结论,必须用 `ls <具体路径>` / `git ls-files --error-unmatch` 单点验证,
不许拿一次目录列举的输出去做全称否定** —— 目录列举会被截断,而截断在报告里看不出来。

### D.6.5 复现命令

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
# 白名单/非 k* 两个常量的现值
pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose 2>&1 | grep -E "348|19 项"
# color-guard 用例数(随 .vue 数线性 +1)
find src -name '*.vue' | wc -l                    # 起点 185
pnpm exec vitest run src/styles/color-guard.test.ts 2>&1 | grep -E "Tests +[0-9]"   # 起点 187
```

## D.7 🔴 本期新增类逐个清单(78 个)

### D.7.1 `k-*`(27,`NEW_RE` 已认,直接进 `WHITELIST`)

```
k-custom-add     k-ext-chip       k-ext-chip-mark   k-ext-chips      k-extgroup
k-extgroup-head  k-extgroup-icon  k-extgroup-meta   k-extgroup-title k-extgroup-toggle
k-field          k-field-hint     k-field-label     k-field-mono     k-frow
k-frow-action    k-frow-head      k-frow-path       k-frow-root      k-frow-root-icon
k-priority-hint  k-radio-2        k-radio-card      k-radio-card-desc
k-radio-card-icon                 k-radio-card-text k-section-body
```

### D.7.2 `kw-*`(41,🔴 `NEW_RE` **不认**,落点看 §D.6 裁定)

```
kw-actions       kw-article       kw-article-inner  kw-change        kw-change-name
kw-change-time   kw-change-type   kw-changes        kw-child         kw-child-body
kw-child-chev    kw-child-ico     kw-child-meta     kw-child-name    kw-child-sum
kw-children      kw-crumb         kw-foot           kw-head          kw-md
kw-meta          kw-node          kw-node-chev      kw-node-ico      kw-node-name
kw-pending       kw-pending-orb   kw-pending-sub    kw-pending-title kw-rawsrc
kw-sec           kw-sec-count     kw-sec-en         kw-sec-head      kw-sec-title
kw-split         kw-summary       kw-title          kw-tree          kw-tree-note
kw-tree-scroll
```

### D.7.3 `kr-*`(9,K53,🔴 `NEW_RE` **不认**)

```
kr-adv-row  kr-badge  kr-check  kr-empty  kr-error  kr-hint  kr-input  kr-label  kr-path
```

### D.7.4 非 k 前缀(1)

```
cur          ← .kw-crumb .cur(蓝本 :2475),面包屑当前项。与既有 .right/.mono 同款的真·嵌套辅助类
```
🔴 **`cur` 无论 A/B 方案都要进 `NON_K_HELPER_CLASSES`**(19 → 20 或 → 70 的一部分)。

## D.8 `@media` / `@keyframes` 的处置

| 处 | 内容 | 处置 |
|---|---|---|
| 蓝本 `:2551-2553` | `@media (max-width: 1080px) { .kw-tree { width: 210px; } }` | **随 Wiki 段一起搬**,嵌在 `.knowledge-app` 内 |
| 蓝本 `:2554-2560` | `@media (max-width: 860px) { .kw-split / .kw-tree / .kw-article-inner / .kw-head / .kw-actions }` | **随 Wiki 段一起搬** |
| 蓝本 `:2456` | `.knowledge-app {` 段头 | 🔴 **不是要搬的类** —— 本仓已有 6 处 `.knowledge-app`;Wiki 段的内容**嵌进本仓既有的那个块**,不另起 |
| 蓝本 `:1500-1503` | `@media (max-width:860px) { .k-frow { … } }` | 🔴 **见 §D.9 —— 需要协调者裁定** |
| `@keyframes` | 本期三段内 **0 个** | 无需处理 |

⚠️ 本期两个 `@media` 与本仓既有的 `@media (max-width: 860px)`(`knowledge.scss:1579`)**是不同块**
(那个在 `.knowledge-app` 的 grid 布局上下文里)。**按蓝本源序另起,不要合并** —— P5b-T2 合并过一次是因为
蓝本本来就写在同一个 `@media` 内部,**本期不是那个情况**。

## D.9 🔴 交协调者裁定:P5b 判的 `.k-frow` 死规则,**前提在本期到期了**

`p5d-appendix-D-classes.md:291` 记「`.k-frow` `@media` 死规则(`:1500-1503`),P5b 已判死规则,不搬」。
**P5b 的判据(本仓 `knowledge.scss:1610-1611` 注释原文)**:

> 「`:1500-1503` 的 `.k-frow` 仍不搬(后者见附录 D.5:**两个模板里没有任何元素用 `class="k-frow"`**,
> 文件表格行用的是 `.k-frow-f`,是死规则)」

🔴 **那个判据在 P5b 当时成立,但本期作废** —— `AllowlistView.vue:69,75` **用的正是 `class="k-frow"`**:

```html
<div class="k-frow k-frow-head">          ← 蓝本 AllowlistView.vue:69
<div v-for="r in …" :key="r.id" class="k-frow">   ← :75
```

⇒ 一旦 T4 落地 `AllowlistView`,蓝本 `:1500-1503` 的窄屏列宽覆盖
(`grid-template-columns: 80px 1fr 70px 28px; font-size: 12px;`)**在蓝本里是活规则**,
而 New-UI 会**缺这一条** ⇒ **窄屏下白名单页的文件夹规则表格列宽与 Vue2 不一致。**

**T0 不自行决定**,因为:① `:1500` **不在**本期三个段里(治理只授权了三段);
② 它涉及往**本仓既有的 `@media` 块**里加规则,是 P5b 的地盘。

🔴 **请协调者裁定**:本期是否把 `:1500-1503` 的 `.k-frow` 一并搬进本仓既有的
`@media (max-width: 860px)` 块(与 P5b-T2 处理 `.k-row` 的做法同款)。
**建议:搬** —— 否则「界面 1:1」在窄屏这一档不成立,且这是 P5f 引入 `k-frow` 的直接连带。
若裁定搬,`WHITELIST` 不变(`k-frow` 已在 §D.7.1 里),只多一条 `@media` 内的规则。
