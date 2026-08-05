# P5e · T2 独立评审(`knowledge.scss` 搬 7 段 355 规则行 + 守卫 348/19 + 8 个 token)

> 评审者独立复核,2026-08-05。被审 = `a379f9a`(父 `46cfdb1`),当前 HEAD `7f4969d`。
> 🔴 **本评审零采信实现者报告**:每个数字自己重跑、每段搬运自己对蓝本 `git show` 比对、
> 每条关键断言自己做变异探针。仓库零改动、零提交、零 `amend`;8 个探针全部 `cp` 副本还原 + md5 逐字节比对。

## 判定

| | 条数 |
|---|---|
| **Critical** | **0** |
| **Important** | **1** |
| Minor | **2** |

**结论:T2 可以关账进 T3。** 唯一 Important 是「产品代码对、守卫为零」类的守卫缺口(不是缺陷),
产品侧 7 段 355 行经程序化逐字比对 **7/7 与蓝本等价**,配色 **零违规**。

---

## 1. 🔴🔴 逐行色扫(上级设计 §9-1 明令的第一必查项)

**方法**:对 `git diff 46cfdb1 a379f9a -- src/ai/styles/knowledge.scss` 抽出全部 `^+` 行(**565 行**,
`+++` 头行已排除),逐行跑 `#hex` / `rgb(a)` / `hsl(a)` / `lab` / `lch` / `hwb` / `color(` / `color-mix(` /
`oklab` / `oklch` + 49 个具名色(含 `white`/`black`)整词匹配,**不剥注释**(R14:色扫方向 = 注释里是真阳性)。

### 结论

| 项 | 结果 |
|---|---|
| 新增行数 | **565** |
| 命中色字面量的行 | **18** |
| 其中 **token 声明层**(8 token × 2 档 = 16 行) | 16 —— **豁免范围内,合规** |
| 其中**注释里**的命中 | 2 —— 均为 `NAMED:purple`,但那是 **token 名 `--purple`**(附录 B §B.2.1 自己也这么引),**不是色字面量** |
| 🔴 **声明层之外的真违规** | **0 处** |
| 🔴 `theme-exception` 逃逸 | **0 处**(全文 grep 零命中) |
| 🔴 `[data-theme="dark"] .knowledge-app` 那个永不命中的写法 | **0 处新增**(命中的 6 行全是既有批次的说明注释) |
| 主题档方位 | ✅ 暗档 = `.knowledge-app, .parser-app` 基础块(`color-scheme: dark`);浅档 = `:root[data-theme="light"] .knowledge-app`(`color-scheme: light`)。**没搞反** |

### 8 个 token 逐个核(对照附录 B + 回源 `tokens.scss`)

| token | 暗档 | 浅档 | 与附录 B | 回源核实 |
|---|---|---|---|---|
| `--paper-surface` | `#ffffff` | `#ffffff` | ✅ §B.1 第 1 行 | ✅ `tokens.scss:342`(暗)/`:193`(浅)**逐字同值**;T2 引的行号**正确**。「既有例外 token 补声明、非新建」的定性**成立** |
| `--rtag-pdf` | `#FF3B30` | 同 | ✅ §B.2.1 | ✅ `tokens.scss:347`/`:206` `--kind-pdf` 逐字同值 |
| `--rtag-md` | `#1a1a1a` | 同 | ✅ §B.2.1 | ✅ `tokens.scss:350`/`:209` `--kind-md` 逐字同值 |
| `--rtag-doc` | `#007AFF` | 同 | ✅ §B.2.1 | ✅ `tokens.scss:348`/`:207` `--kind-doc` 逐字同值 |
| `--rtag-txt` | `#34C759` | 同 | ✅ §B.2.1 | ✅ `tokens.scss:349`/`:208` **`--kind-xls`** 逐字同值;`--kind-txt` 确实是 `#8E8E93`(灰),T2 的 ⚠️ 标注**准确**,另起 `--rtag-` 前缀的三条理由成立 |
| `--rtag-code` | `#AF52DE` | 同 | ✅ §B.2.1 | ✅ `knowledge.scss:187` `--purple` 逐字同值 |
| `--shadow-drawer` | `-20px 0 60px rgba(0, 0, 0, 0.55)` | `-20px 0 60px rgba(40, 35, 25, 0.10)` | ✅ §B.2.2 逐字 | ✅ alpha 与同档 `--shadow-lg` 首段(`:222` 0.55 / `:415` 0.10)一致;几何逐字照蓝本 `:1582`。**两档不同值,T2 自报准确** |
| `--mark-hl-bg` | `rgba(255, 235, 0, 0.22)` | `rgba(255, 235, 0, 0.40)` | ✅ §B.2.3 逐字 | 浅档 = 蓝本 `:1660` 的 `0.4`(R15-② 已批准写作 `0.40`);暗档降 alpha 有 §B.2.3 论证。**两档不同值,T2 自报准确** |

🔴 **8/8 与附录 B 逐字吻合,零个「附录表里没有的 token」⇒ 零自选,零该报 Important 的项。**
每行注释都写了蓝本 `file:line` + 出处,**注释内零色值**。

### 三处蓝本色字面量映射的回蓝本核

蓝本 `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/styles/knowledge.scss` 逐行读:

- `.k-rcard-tag[data-kind]` 五实底 `#FF3B30`/`#1a1a1a`/`#007AFF`/`#34C759`/`#AF52DE` → 五个 `--rtag-*`,**一一对应无串位**(我自己按蓝本源序核过)。
- `.k-rel[data-level]` 三组 → `--success-soft/--success` · `--warning-soft/--warning` · `--danger-soft/--danger`,三档不串。
- `.k-chunk-content mark`(蓝本 `:1660`)→ `var(--mark-hl-bg)`。
- 🔴 **另两条 `mark` 没被一起改**(核心检查项):`.k-rcard-snippet mark`(`:653`)与
  `.k-chunk-item-preview mark`(`:1645`)**仍是 `var(--accent-soft)` / `var(--accent)`**,与蓝本逐字一致。
  且 T2 为此新建了一条专门断言(「三条 mark 规则各归其位」),带覆盖度自检 `>= 3` 防正则失效。✅

### `--on-accent` 家族(记忆铁律)

`.k-rcard-tag { color: var(--text-on-accent) }` 在五个不同实底上共用一个前景 token。**判定:正确。**
- 暗档 `knowledge.scss:177` `--text-on-accent: #ffffff`;浅档 `:370` `--text-on-accent: var(--on-accent)`
  → `theme.css:186`(`:root[data-theme="light"]`)= `#ffffff`。⇒ **两档都解析成白**,与蓝本 `color: white` 1:1。
- 记忆铁律管的是「`--on-accent` 用在非 accent 的**半透明/浅**底上会看不见」;这里 5 个 `[data-kind]` 底
  **全是不透明实底**,前提成立(附录 B §B.1 已论证,我回源复核 `theme.css:48`/`:186` 两档取值坐实)。
- 这条映射还是 **P5a 既有先例**(`knowledge.scss:566` 同款),不是本刀新决定。

---

## 2. 亲手做的变异探针(全部先证注入落盘 → 再跑 → 再还原 → md5 比对)

基线 `src/ai/styles/knowledge.scss` md5 = **`a30da07adfc9acc609b2701a174f25ca`**。

| # | 探针 | 注入落盘证明 | 结果 | 还原 |
|---|---|---|---|---|
| **P1** | 计划书点名①:24 死类里加一个 —— 在 `:720` 行首锚定插入 `.k-hero { padding: 1px; }` | `grep` 命中 `720: .k-hero { padding: 1px; }` | 🔴 **3 条报红**:`没有搬多` + `24 个死类…零出现` + **`死类 k-hero 零出现`**(参数化独立用例真在跑) | ✅ md5 一致 |
| **P2** | 计划书点名②:把 `.k-suggest-chip` 基类整块(11 行)移到 `:2198` 那条 k2 覆盖**之后** | `awk` 证明 base line=2753 > override line=2752 | 🔴 **1 条报红**:`基类声明行号 < k2 后代覆盖行号` | ✅ md5 一致 |
| **P3a** | 计划书点名③:host 拿掉 `position: fixed` | 打印 host 块证明该行已消失 | 🔴 **恰 1 条**:`K46-③a` | ✅ md5 一致 |
| **P3b** | host 拿掉 `inset: 0` | 同上 | 🔴 **恰 1 条**:`K46-③b` | ✅ md5 一致 |
| **P3c** | host 拿掉 `z-index: 1100` | 同上 | 🔴 **恰 1 条**:`K46-③c` | ✅ md5 一致 |
| **P4** | K46 主体:把 `::v-deep .overlay { … }` 塞回 host 块 | `grep` 命中 `2693:` | 🔴 **4 条报红**(含两条新 K46) | ✅ md5 一致 |
| **G1** | 🔴 缺口猎:把 `[data-kind="md"]` 与 `[data-kind="doc"]` **消费的 token 互换** | `grep` 证明两行已换 | 🟢 **334/334 全绿 —— 零守卫**(见 Important-1) | ✅ md5 一致 |
| **G2** | 缺口猎:删掉 `@keyframes k-drawer-in` | `grep -c` = 0 | 🔴 1 条报红(既有 `animation ↔ @keyframes` 一一对应守卫,保护了 T2 的交付物) | ✅ md5 一致 |
| **G3** | 🔴 缺口猎:`.k-rcard-icon` 底色 `--paper-surface` → `--bg-elevated` | `grep` 命中 `887:` | 🟢 **334/334 全绿 —— 零守卫**(同 Important-1) | ✅ md5 一致 |

**三条计划书点名项全部亲手验证有牙,K46 三属性各自独立报红(不是只有一条在起作用)。**
🔴 **每个探针都做了「先证注入落盘」**(承 T1 评审「锚点不存在 → 全绿被误读成守卫存在」的教训);
`P2`/`P3a-c` 的锚点我先用 `grep -n '^  \.k-fileviewer-host {$'` 等预先确认存在才动手,零次静默失败。
**全程 `cp` 副本还原,零 `git checkout/restore/stash`,工作树最终 `git status --porcelain` 为空。**

### R14 第 2 条的独立复核(否则 = Critical)

🔴 **T2 的死类断言不是裸 grep**:我读了源码,`BLUEPRINT_DEAD_CLASSES` 那三条断言全部跑在
`css = stripComments(rawSource)` 上,判据是 `(?![\w-])` 负向前瞻(不是 `\b`)。
且我在 **T2 之前的基线 `46cfdb1`** 上独立复现了 E-60:裸 `grep -cE "\.<cls>([^A-Za-z0-9_-]|$)"` 得
`k-quick-grid = 1`(来自 `:1263` 注释)、`k-progress-card = 2`(`:61` / `:976` 注释)。
⇒ **若断言是裸 grep,它在自己的基线上就该红 —— 它没红,因为它剥了注释。R14-2 复核通过,不构成 Critical。**

---

## 3. 我自己实测的数字(与 T2 自报逐项比对)

| 量 | T2 自报 | **评审实测** | 一致? |
|---|---|---|---|
| `NEW_RE` 扫出类数(现文件) | 347 | **347** | ✅ |
| 同上(pre-T2 基线 → 追加后) | 292 → 347 | **292 → 347** | ✅ |
| `WHITELIST_348` 常量长度 | 348 | **348** | ✅ |
| `lost`(零丢失自证) | `(none)` | **`(none)`** | ✅ |
| 新增 55 个类清单 | 附录 D §D.7.1 逐字 | **逐字一致** | ✅ |
| `NON_K_HELPER_CLASSES` | 16 → 19(`chev`/`h-md`/`path`) | **16 → 19,新增恰为 `chev`/`h-md`/`path`** | ✅ |
| `classes2` 三态(pre-T2) | 74 = 54/17/3 | **74 = 54 / 17 / 3**(用 `sed` 派生的一次性副本指向 `pre-t2.scss` 跑出;副本已删,`ls` 自证) | ✅ |
| `classes2`(post-T2) | — | **74 全部 ALREADY-MOVED**(= TO-MOVE 归零,搬全了) | ✅ |
| 搬入规则行 | 355(17+90+105+7+15+98+23) | **355,七段逐项 17/90/105/7/15/98/23 完全一致** | ✅ |
| `Test Files` / `Tests` | 331 / 4026 | **331 passed (331) / 4026 passed (4026)**,exit 0,`×` 计数 0,`Errors` 无 | ✅ |
| `vue-tsc` | exit 0 | **exit 0** | ✅ |
| `vite build` | exit 0 | **exit 0** | ✅ |
| `sass` 门 | exit 0 | **exit 0** | ✅ |
| `.vue` 总数 | 182 | **182** | ✅ |
| `color-guard` 用例数 | 184 | **184**(从 verbose 全量日志数出) | ✅ |
| 新增用例数 | +40 | **+40**(26 死类 + 2 E-52 + 9 K46/K47 + 2 token 值 + 1 mark = 40) | ✅ |
| 死类参数化独立用例真执行 | 24 | **24**(`--reporter=verbose` 数 `死类 .* 零出现` = 24) | ✅ |

🔴 **零不一致项。** 全量日志 18195 行落盘、未被 `| tail` 截断。
🔴 **「常量 348 ≠ 扫出 347」那 1 差 T2 没去修平 = 正确**;且我核了它写进代码注释的理由是
**R8 订正后的正确理由**(`knowledge-app` 是 `kn`+`o`、匹配不上 `NEW_RE`),
**没有把附录 §D.7.1 那个「贪婪吃前缀」的错理由抄进去**。✅

---

## 4. 搬运的逐字保真(7 段,自己重做程序化比对)

**方法**:`git -C ../../NimoOS-UI show 7a6ee6b7:…` 取蓝本 → 剥注释 / 去空行 / trim / 折叠空白 →
对蓝本侧套用附录 B §B.0 那 17 条声明过的映射 → 与本仓对应块逐行 `JSON.stringify` 全等比较。

| 段 | 蓝本行 | 蓝本(归一化) | 本仓 | 结果 |
|---|---|---|---|---|
| S1 | `351-367` | 17 | 17 | **IDENTICAL** ✅ |
| S2 | `457-549` | 90 | 90 | **IDENTICAL** ✅ |
| S3 | `573-681` | 105 | 105 | **IDENTICAL** ✅ |
| S4 | `726-732` | 7 | 7 | **IDENTICAL** ✅ |
| keyframes | `1541-1545` | 5 | 5 | **IDENTICAL** ✅(提到顶层 keyframes 区,与 T4/T11/T6 三批既定惯例一致) |
| S5 | `1548-1562` | 15 | 15 | **IDENTICAL** ✅ |
| S6 | `1572-1672` | 98 | 98 | **IDENTICAL** ✅(含嵌在块内的 `@media (max-width: 720px)` 5 条) |
| KF | `KFileViewer.vue:71-76` + `:102-119` | 23 | 23 | **IDENTICAL** ✅ |

**7/7 逐字连续等价、相对源序保序 —— T2 的自报经独立复现成立。** 边界无截断、无重复定义。

### 逐条核对清单

- 🔴 **KF 范围 = `:71-76` + `:102-119`(R3.1 / M-1)**:✅ 我读了蓝本 `KFileViewer.vue`,`:102` 确实是
  `.k-fileviewer-host` 的闭合 `}`;本仓 host 块**闭合完整**,`:77-101` 三条 `::v-deep` **整段没搬**
  (含 `:84` 那处 `#fff`)。T2 **按订正后的范围搬,没照附录正文的 `:103-119`**。
- 🔴 **不许重复搬 —— 逐个 selector-position 计数(剥注释)**:
  `.k-seg` 1 · `.k-empty`/`-illust`/`-title`/`-sub`/`-tips`/`-tip` 各 1 · `.k-skel` 1 · `.k-modal-x` 1 ·
  `.k-row-action` 1 · `.k-scroll` 1 · `.k-btn` 1 个基类(另 2 处是别批次的后代覆盖)·
  `&.text` 在 `.k-btn` 块内**恰 2 次** · `.k-btn.outline` **零重复搬**。**零重复。** ✅
- 🔴 **`.k-skel-rcard` 必须搬**:✅ 在 `:1025`,且 T2 顺手用「反转不删」订正了 P5a 那条已过期的注释。
- **嵌套零引用规则随父块整体搬**:`.h-md`(蓝本 `:660`)· `mark` ×3 —— 全部在 S3/S6 的逐字比对里,**没被单独摘除**。✅
- 🔴 **K9 / K44**:S5+S6+KF 整体包在一个顶层 `.knowledge-app { … }` 块里(`:2521`–`:2711`)。
  `bareTopLevelSelectors()` 那条**集合相等**断言 **`toEqual(['.nme-content .ProseMirror'])` 一字未动** ——
  🔴 **既没加成员、更没放宽正则**(它压根不在 diff 里)。这是比「加成员」更好的结果,**零 §9.10 风险**。✅
- 🔴 **类名串号排查(人肉)**:我用 `\.<cls>(?![\w-])` 在**选择器位置**扫了 `agent-styles.scss` /
  `settings-styles.scss` / `skills-styles.scss` / `tokens.scss` / `parser-styles.scss` /
  `mcp-styles.scss` / `sk-shared.scss` / `popover.scss` 全部 8 个同级样式表,对 58 个新类名:
  - `settings-styles` / `skills-styles` / `tokens` / `mcp` / `sk-shared` / `popover`:**0 命中**。
  - `agent-styles.scss:663-664` 有 `.chev` —— 但作用域是 `.agent-app > .proc-head`(该文件唯一的
    depth-0 选择器是 `:8 .agent-app {`)⇒ **捞不到 `.knowledge-app`**。
  - `parser-styles.scss:154` 有 `.path` —— 作用域是 `.parser-app .parser-status-page .failures-card
    .failure-list li`(depth-0 只有 `.parser-app*`)⇒ **捞不到 `.knowledge-app`**。
  🔴 **结论:零串号。**(两处同名类都是深层嵌套 + 不同作用域根。)

### K46 两个前提 —— 我自己验(没信报告)

| # | 前提 | 我的实测 |
|---|---|---|
| ① | `DocViewer.vue` / `ExcelViewer.vue` **自身模板**零 `.overlay`/`.v-container`/`.doc-container` | ✅ `awk '/<script/{exit}'` 只取模板段,两个文件**各 0 命中** |
| ② | `ViewerShell.vue:24` = `position: absolute; inset: 0` | ✅ 亲自打开读到 `:24`:`position: absolute; inset: 0; z-index: 200; overflow: hidden;`,**行号逐字对得上** |
| ③ | `knowledge.scss` 里那三个类名 + `::v-deep` 零出现 | ✅ 剥注释后**全部 0**;未剥注释时 `::v-deep` 2 次、`.overlay` 若干 —— **全在 K46 的说明注释里**,按 R14 属「类名/形状否定式断言必须剥注释」那个方向的**假阳性**,T2 的断言正确地跑在剥注释后的文本上 |

---

## 5. §9.10 —— 守卫只许加固、不许放宽

### 「加固前 N / 加固后 1」两个程序化证明,我自己重现

**PROOF A(`WHITELIST_293` → `348`)**:把 post-T2 文件里 `.k-skel-rcard` 整块规则删掉,
用两个常量各跑一次「白名单类全部有对应规则」的判据:

```
旧 293 常量 missing = []                 => GREEN(放行 = 弱)
新 348 常量 missing = ["k-skel-rcard"]   => RED(精确指名)
```

**PROOF B(`NON_K` 16 → 19,集合相等)**:把 `nonKClassNames()` 从测试文件逐字复制出来跑:

```
actual(post-T2) = 19 项
  vs 旧 16 项登记表 => RED,差集 = ["chev","h-md","path"]   ← 若 T2 不登记就报红
  vs 新 19 项登记表 => GREEN
actual(pre-T2)  = 16 项
  vs 新 19 项登记表 => RED,少 chev/h-md/path              ← 反向证明 19 不是凭空塞的
```

🔴 **两个证明都成立,两处都是真加固**(集合相等是双向的:多写一个/少写一个都报红)。

### 既有断言有没有被削弱或删除

把两个版本的**全部 `expect(` 行**排序后 `comm -23` 求差:**OLD 有而 NEW 没有的只有 4 行**,
全是 `293`/`16` 那两组数字/常量名断言本身。`expect(` 总数 **95 → 134(+39)**。
🔴 **零断言被删除、零断言被削弱。** ✅

### M-4

`knowledgeStyles.test.ts` 那条 K45 用例名从「`&.text` **只在** `.k-btn{…}` 内」改成
「`.k-btn{…}` **区间内** `&.text` 恰好 2 次」——如实描述,且 **`expect(` 行一字未动**
(在上面那份 diff 里它属于「两版都有」)。✅

### 40 条新用例里有几条空转

- **24 条参数化独立用例**:`--reporter=verbose` 数出 **24 条真在执行**;另有
  `死类清单恰好 24 项` 一条防空循环。**零空转。** ✅
- K46 的 3 条 `overlay`/`v-container`/`doc-container` 循环:字面量数组,无空循环风险;**P4 探针证明有牙**。
- 其余 13 条(2 E-52 + 6 K46/K47 单项 + 2 token 值 + 1 mark + 2 计数):P1–P4 已覆盖 6 条,
  剩余的 token 值 / mark 两条是 `toContain` + `not.toContain` 双向,形态本身有判别力。

---

## 6. 三门 + sass 门(自己复跑全量)

| 门 | 结果 |
|---|---|
| `pnpm exec vitest run --reporter=verbose` | **Test Files 331 passed (331) / Tests 4026 passed (4026)**,exit 0,`×` 0 条,无 `Errors`,日志 **18195 行完整落盘未截断** |
| `pnpm exec vue-tsc --noEmit` | **exit 0** |
| `pnpm exec vite build` | **exit 0**(仅 chunk-size 常规提示) |
| `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` | **exit 0** |
| `.vue` 总数 | **182** ✅ |
| `color-guard` 用例数 | **184** ✅ |
| `package.json` / `pnpm-lock.yaml` | **零改动** ✅ |
| `src/styles/color-guard.test.ts` | **零改动**(最后一次改动是 `7b6c412`,远早于 P5e)✅ |
| 产品 `.vue` | **零改动** ✅ |
| 提交文件 | **恰 3 个**(`knowledge.scss` / `knowledgeStyles.test.ts` / 台账报告)—— 只含授权文件 ✅ |

---

## 7. 逐条发现

### 🔴 Important-1 —— 8 个新 token 里 **7 个的「token → 消费选择器」绑定零守卫**;`--rtag-md` 恰是 R15 认定「守卫是唯一防线」的拍板项

**证据(我的探针 G1 / G3,都先证注入落盘)**:

| 变异 | 三门结果 |
|---|---|
| 把 `&[data-kind="md"]` 与 `&[data-kind="doc"]` **消费的 token 互换**(md 用 `--rtag-doc`、doc 用 `--rtag-md`) | 🟢 **334/334 全绿** |
| `.k-rcard-icon { background: var(--paper-surface) }` → `var(--bg-elevated)` | 🟢 **334/334 全绿** |

T2 新加的两条 token 断言**只钉「声明块里的取值」**(`--rtag-md: #1a1a1a;` 在两档都在、值没被重算),
**完全不钉「哪个选择器消费哪个 token」**。同族无守卫的还有 `--paper-surface`→`.k-rcard-icon`、
`--shadow-drawer`→`.k-drawer`、`--text-on-accent`→`.k-rcard-tag`、`.k-rel[data-level]` 三对
`--success/--warning/--danger`。**8 个新 token 里只有 `--mark-hl-bg` 的绑定被钉住了**
(靠那条「三条 mark 规则各归其位」断言,顺带把另两条 mark 的 `--accent-soft` 也钉了)。

**为什么算 Important 而不是 Minor**:裁定 **R15-③** 明写 `--rtag-md` 与 `--mark-hl-bg` 两个拍板项
**本机不可达**,R2 又把整个结果半区从真机验收清单里移除 ⇒ **机主看不到、单测不管绑定** =
串位一次就永久静默。`--mark-hl-bg` 有网,`--rtag-md` 没有,而它偏偏是那个「近黑底」的争议项。

**为什么不算 Critical**:🔴 **当前产品代码是对的** —— 我在第 4 节的 S3 逐字比对里已经证明
五个 `[data-kind]` → 五个 `--rtag-*` **一一对应无串位**,与蓝本 `:618-622` 源序逐字一致。
**这是「产品代码对、守卫为零」,不是缺陷。**

**建议(不阻塞 T2 关账)**:补一条参数化断言,把 `.k-rcard-tag` 块里
`[data-kind="pdf"|"md"|"doc"|"txt"|"code"]` ↔ `--rtag-pdf|-md|-doc|-txt|-code` 五对绑定钉死
(形态照 T2 自己那条 mark 断言:锚在父块 + 逐条 `toContain`),顺带把 `.k-rcard-icon`
→ `--paper-surface`、`.k-drawer` → `--shadow-drawer` 各钉一条。**共 7 条,可并进 T3 或收官刀。**

### 🟡 Minor-1 —— 两档对称守卫是**单向**的:只查「暗有浅无」,不查「浅有暗无」

`浅色档颜色 token 覆盖完整性` 那两条断言(`:1139` / `:1150`)算的都是
`darkTokens \ lightTokens`(并要求它恰等于那 11 个结构量例外)。
⇒ **只在浅档声明、暗档漏声明的 token 不会被任何守卫抓到。**
**不是 T2 引入的**(P5a/终审 ⚠️-D1 的既有形态),且 T2 的 8 个 token **两档都写了**,本刀不受影响。
登记备查即可,建议并进「守卫盲区收口」那张既有票(票 B)。

### 🟡 Minor-2 —— `.k-rcard-tag` 白字压在 `--rtag-txt`(绿)上的对比度偏低,属**蓝本 1:1 的既有观感问题**

`--text-on-accent` 两档都解析成白;五个实底里 `#34C759`(绿)与白字的对比约 2.2:1,
`#1a1a1a` 反而最稳。**这是蓝本 `color: white` 的 1:1 照搬,按「界面严格 1:1」纪律 T2 不改是对的。**
🔴 **建议**:验收清单里 `--rtag-md` 那条拍板项的措辞**顺带把 TXT 绿底白字也列进去**
(同一次拍板一起看,别让机主只盯 md)。**不要求 T2 改代码。**

---

## 8. 「缺口猎」逐项交代(本刀高危裸奔点)

| # | 猎点 | 结论 |
|---|---|---|
| 1 | 搬进来的规则里有没有「本仓没有任何 `.vue` 会用到」的类 | 🟢 **不算缺口**。附录 D 的 74 类基线就是「蓝本三个 `.vue` 模板真正用到的 class token」,54 个 TO-MOVE 全在其中;`.h-md` / 三条 `mark` 是**有意照搬**的嵌套零引用规则(§D.6 明令,K7 模具)。当下「零 `.vue` 使用」是批次顺序的必然(模板归 T4/T6/T7),不是搬了死代码 |
| 2 | 两档对称性有没有 token 只在一档声明 | 🟢 T2 的 8 个**两档齐全**;守卫存在但**单向** → 见 **Minor-1** |
| 3 | `--mark-hl-bg` / `--rtag-md` 有没有守卫钉住值 | 🟡 **值钉住了(两条新断言,双向 `toContain`/`not.toContain`),但绑定没钉** → 见 **Important-1** |
| 4 | `color-scheme` 是否两档都由 `.knowledge-app` 自己声明 | 🟢 **是**,且有既有常驻断言(`:783`,P2b 教训)守着;T2 的两处新增声明都插在 `color-scheme` 之前,没打断该块 |
| 5 | 额外:`animation ↔ @keyframes` 一一对应(T2 提到顶层的两个 keyframes) | 🟢 既有守卫真有牙 —— 探针 **G2** 删掉 `@keyframes k-drawer-in` → 精确报红 |
| 6 | 额外:类名跨文件串号(单测与 color-guard 都抓不到) | 🟢 8 个同级样式表全扫,**零串号**(两处同名类作用域根不同) |

---

## 9. 最终结论

🔴 **T2 可以关账进 T3。**

- **逐行色扫:565 新增行,声明层之外零违规,注释里零色值,8 个 token 逐个与附录 B 吻合。**
- 7 段 355 行经我自己的程序化逐字比对 **7/7 与蓝本等价**,零重复搬、零截断、零串号,K46/K47 两个前提我亲自坐实。
- 三个数字 **347 / 348 / 19** 与 `54/17/3`、`lost=(none)` 全部独立复现,与 T2 自报**零不一致**。
- 两处守卫改动都有**我自己重现的**「加固前放行 / 加固后精确指名」证明;既有断言零删除零削弱;M-4 断言体一字未动。
- 四门(vitest 全量 / vue-tsc / vite build / sass)我自己复跑全绿,授权范围零越界。
- 唯一 Important 是**守卫缺口**(产品代码经比对确认正确),不阻塞;建议 7 条绑定断言并进 T3 或收官刀。

**仓库状态**:零改动、零提交、零 `amend`、零 `checkout/restore/stash`;8 个探针全部
`cp` 副本还原、`md5sum` 逐字节比对通过(`a30da07adfc9acc609b2701a174f25ca`);
一次性派生脚本 `__rev_classes2_pre.mjs` 用完即删并 `ls` 自证;dev server 一个都没碰。
