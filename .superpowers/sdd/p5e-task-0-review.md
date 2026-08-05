# P5e · T0 独立评审(2026-08-05)

> 被审对象:`.sp8/NimoOS-New-UI` @ `sp8-ai`,**T0 提交 = `d79d922`**(父 `ec6a000`,27 文件 / +3740)。
> 评审纪律:**零采信实现者报告**。下面每一个数字、每一条断言,都是评审自己打开权威源、自己 grep、
> 自己重写脚本、自己跑探针得出的。凡与 T0 一致的,写「复现一致」;凡不一致的,单列 finding。
>
> **判定:Critical 0 条 / Important 3 条 / Minor 8 条。**
> **结论:附录 A / B / D 可以直接作为 T1、T2 的依据开工;fixtures 必须先修 Important-1 与
> Important-2 才能作为 T3/T5/T7 的依据。**(T1/T2 不碰 fixtures,故不必等。)

---

## 0. 一页速览

| 区块 | 复核方式 | 结果 |
|---|---|---|
| 附录 A 的 63 个 zh/en 值 | 程序化逐码点比对 `zh_CN.json` / `en_US.json`@`7a6ee6b7` | **63/63 零 mismatch,零自造** |
| 63 distinct 的算式 | 自己重扫蓝本 4 文件 | **完全复现**(53+1+9) |
| 附录 D 的 74 类三态 | 自己重写扫描器 | **TO-MOVE 54 / ALREADY 17 / NEITHER 3,行号逐个一致** |
| `WHITELIST` / `NON_K_HELPER` 终值 | 自己重写模拟器(不用 T0 的脚本) | **292→347 / 293→348 / 16→19,55 类清单零差异** |
| 附录 B 的 17 处色字面量 | 自己重扫 6 段 + KFileViewer | **17 处 + 1 处删除 = 18,行号与字面量逐个一致** |
| K48 等价性 | 跑 T0 脚本 + 回蓝本逐字核两份实现 | **534 比对 0 不等价,输入集足够宽** |
| `ExcelViewer` exit 1 | 自建探针复现 | **复现:`Tests 2 passed` / `Errors 1 error` / `EXIT=1`** |
| NC-1 / NC-2 事实 | 自己读 Go/TS 源 + 自己打后端 | **两条事实全部成立** |
| E-54 … E-58 | 逐条回权威源 | 成立 / **部分成立** / 成立 / 成立 / 成立 |
| 提交范围 | `git show --name-only` | **27 文件全在 `.superpowers/sdd/`,零 `src/`、零依赖、Service 仓干净** |
| fixtures 复现层 | 跑 8 个脚本 + 找 `replay.md` | 🔴 **7/8 脚本 ENOENT,`replay.md` 不存在** |

---

## 1. 附录 A(i18n)—— 计划书点名的第一必查项

### 1.1 🔴「有没有自己译的」—— 程序化逐码点比对,零目视

把附录 A 的两张表(复用 9 + 新增 54)解析成 63 行 `{key, 蓝本$t串, zh, en}`,再用
`蓝本$t串` 去 `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` 取值,做**严格 `!==` 比较**
(只剥 markdown 粗体标记,不做任何归一化):

```
parsed rows: 63
BAD rows: 0 / 63
en===key count: 63   en!==key: 0
```

→ **63/63 逐码点命中,一条自造都没有。P5d 的 C-1 缺陷本期未复发。**

`zh_CN.json` 叶子 2757 / `en_US.json` 2676(顶层 3 个非字符串值:`photos` / `agent` / `terminal`)。

### 1.2 🔴 en 侧没有踩 E-44 的坑

附录 §A.4-3 的写法是正确的:它**先实测**再下结论 ——「本批**恰好** 63/63 的 en 覆盖值都等于 key
—— **这是实测结论,不是假设**;verify 脚本仍必须从 `en_US.json` 读」。评审独立复核 `en!==key: 0`
成立。且附录进一步给出了「因为等于,本批无法配 en≠key 的反向断言 → 改成断言 verify 脚本的**取值来源**
(临时改掉 JSON 里某个值 → 脚本必须报红)」——**这条替代判据是有判别力的,不是空壳**。承 R10 落地正确。

### 1.3 🔴 63 distinct 的算式独立复现

自己重扫蓝本 4 文件(正则 `(?:\$t|i18n\.t)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1`,按捕获组去重):

| 项 | 评审实测 | 附录 |
|---|---|---|
| `SearchView.vue` 静态 | 35 | 35 ✅ |
| `FileDetailDrawer.vue` 静态 | 23 | 23 ✅ |
| `KFileViewer.vue` 静态 | 2 | 2 ✅ |
| 三者并集 | **53**(交叠 **7**) | 53 / 7 ✅ |
| `searchAggregate.js` | 1(`(Untitled)`) | 1 ✅ |
| `MTIMES` 4 + `SAMPLE_QUERIES` 5 | 9 | 9 ✅ |
| **distinct 终值** | **63** | **63** ✅ |

那 7 个交叠逐字 = `Modified` / `{n} matching sections` / `Similarity` / `High` / `Mid` / `Low` / `Download`
—— 与附录表里的 `SV+FD` ×6 + `FD+FV` ×1 标注**逐个吻合**。
并集与附录的 63 个串做双向差集:**两侧均空**。

### 1.4 全角标点例外 / 占位符 —— 实扫复现

用附录声明的正则 `/[，；：？！（）]/` 扫 63 个 zh 值:**恰好 5 条**,与 §A.2.1 逐条一致
(`aiKbSrEmptySub` / `aiKbFdSummary` / `aiKbSrNoPreviewToast` / `aiKbSrRerankWarn` / `aiKbSrIdleSub`)。

§A.2.2 那批「不在正则里但必须照抄」的字符也逐个实扫复现:
`。` 只在 `aiKbSrIdleSub`(**×2**,与 §A.2.1 那句「以本行为准」的真值一致)· `「」` 在
`aiKbFdSummary` + `aiKbSrEmptyTipAllowlist` · `—` zh 侧只在 `aiKbSrMoreHint` · `…` 只在
`aiKbSrPlaceholder` · **半角 `,` 只在 `aiKbFdCopyFailed`**(附录点名的这条陷阱成立)。
§A.2.3 的 en 侧 em dash **恰好 4 个键**(`aiKbSrMoreHint` / `aiKbFdCopyFailed` /
`aiKbSrNoPreviewToast` / `aiKbSrIdleSub`)—— 与附录逐字一致。

占位符:6 个键,`key/zh/en` 三列集合**逐个相等**;`aiKbFdSummary` 是**唯一**双占位符
(`{n}`+`{query}`);全批 `@` / `|` **零出现** → §A.3 那句「不需要 `{'@'}` 转义」成立。

### 1.5 双向撞车扫描 —— 真的是双向,且 14 个高危逐条落表

协调者点名的 14 个高危同值(`Download`/`Close`/`Modified`/`Search`/`Results`/`Copied`/`High`/`Mid`/
`Low`/`Similarity`/`files`/`matches`/`Advanced`/`Enabled`/`Fast`)在 §A.1.2 的拒绝表 + §A.1 复用表里
**逐条有归属**,无一漏项。方法是「value→keys 反查表 + 63 个值双向查」,**方向确实是双向的**
(zh 撞车列出同值键并注明 en 是否也同、en 撞车同理)。

🔴 **`High`/`Mid`/`Low` 这三条最高危项,附录的判定经得起复核**:
`appsSettingsCpuMedium` 与 `aiThinkingMedium` 的 **en 值是 `Medium`,不是 `Mid`** ——
复用它们会直接改掉界面文案。三条一律新建 `aiKbSrRel{High,Mid,Low}` 是正确的。
附录还点出了「`relLabel` 在 util 里走 `i18n.global.t` ⇒ 键选错两个组件同时静默错」这层因果 —— 成立。

### 1.6 `FILE_TYPES` 明写不进 i18n —— 复核成立

回蓝本 `SearchView.vue:194-200` 与模板 `:37`:`<span>{{ t.icon }}</span> {{ t.label }}`,**确实没过 `$t()`**。
对照同文件 `MTIMES`(`:210-215`)模板 `:47` 是 `{{ $t(m.label) }}`、`SAMPLE_QUERIES`(`:192`)
模板 `:90` 是 `$t(s)` —— **三张常量表口径不同这件事,附录 §A.5 描述完全准确**。

---

## 2. 附录 D(类清单)

### 2.1 🔴 74 类三态 —— 自己重写扫描器,逐行复现

评审自写 `classes.mjs`:① 从蓝本三个 `.vue` 的 `<template>` 段抽 `class="…"` 与 `:class="…"` 里的
完整 token;② 用 `/\.<cls>(?![\w-])/` 只在「行内第一个 `{` 之前的选择器部分」匹配,分别扫蓝本
`knowledge.scss`(2561 行)与本仓(2380 行)。结果:

```
total class tokens used in 3 templates: 74
{ 'TO-MOVE': 54, ALREADY: 17, NEITHER: 3 }
ONLY-CUR: (none)
```

**与 §D.0 / §D.1 逐个一致,且每一行的「蓝本声明行 / 本仓声明行」也逐个一致** ——
抽查:`chev 509,510,1561` · `k-drawer 1579,1667` · `k-drawer-bg 1572` · `k-chunk-item 1625,1631,1632,1637` ·
`k-rcard 581,1562` · `k-more-hint 1556,1560,1561,1562` · `k-seg bp:551 cur:2057` ·
`k-suggest-chip bp:357,2291 cur:2198`。全中。

### 2.2 🔴 匹配口径没有踩 `\b` 的坑 —— 已验证

附录声明用 `\.<cls>(?![\w-])`,并且 §D.3 的复现命令写成
`grep -qE "\.$c([^A-Za-z0-9_-]|\$)"`,还**主动写了一句解释**:「`.k-hero-suggest` 会被
`\.k-hero([^A-Za-z0-9_-]|$)` 排除掉 —— 这正是为什么必须用 `(?![\w-])` 而不能用 `\b`」。
评审用自己的实现验证:`k-hero` 不会假命中 `k-hero-suggest`。**E-25 的坑本期没踩。**

### 2.3 🔴 24 个死类 —— 逐字抄进来了,且一个都没混进必搬侧

§D.3 的 24 个类名与 `p5-master-plan.md` §2.2 **逐字节相同**(行段标注 `:272-349` / `:380-411` /
`:413-455` / `:1152-1160` 亦相同)。评审程序化三查:

```
dead count: 24
dead leaked in CURRENT scss:      []
dead leaked in WHITELIST_293:     []
dead leaked in AFTER (the 6 segs):[]
```

→ **起点干净,且 §D.2 那 6 段搬运范围里一个死类都不含。** 附录也显式写了要求的那句
「🔴 **白名单报红时,先回查本节这 24 个,不许改白名单**」(§D.3 落地要求第 2 条)+
「报告必须明写第 2 条已被遵守」(第 3 条)。**§0.2-1 的落地义务全部到位。**

### 2.4 🔴 `WHITELIST` / `NON_K_HELPER_CLASSES` 终值 —— 不用 T0 的脚本,自己重跑

评审把 `stripComments()` / `NEW_RE` / `nonKClassNames()` **从 `knowledgeStyles.test.ts:23-28,258,334-348`
逐字复制**进自己的 `sim.mjs`,把 §D.2 的 6 段 + `KFileViewer` 净 style 段拼进本仓现状后重跑:

| 量 | 评审实测 | 附录 §D.7 |
|---|---|---|
| `NEW_RE` 扫出类数(现状) | **292** | 292 ✅ |
| `NEW_RE` 扫出类数(追加后) | **347** | 347 ✅ |
| 增量 | **+55** | +55 ✅ |
| 零丢失(`lost`) | **(none)** | (none) ✅ |
| `WHITELIST_293` 常量真实长度 | **293**(去重后也 293) | 293 ✅ |
| 追加后常量长度 | 293+55 = **348** | 348 ✅ |
| `nonKClassNames()` 现状 | **16**(逐字 = R8 终值) | 16 ✅ |
| `nonKClassNames()` 追加后 | **19** | 19 ✅ |
| 新增 3 个 | **`chev` / `h-md` / `path`** | 同 ✅ |

**§D.7.1 那份「新增 55 个类」逐字清单与评审实测做双向差集:两侧均空。**

现状 16 项实测排序 = `danger dot ghost lbl mono outline primary right second sep spacer spin suffix text warn wide`
→ 与 R8 的终值逐字一致,**R8 的「实测优先于预期值」在本期无需触发**。

⚠️ 附录关于「常量长度 348 ≠ 扫出数 347」那 1 差的**解释是错的**(见 Minor-9)。数字本身对,
「不是错、别去修平」这条指令也对。

### 2.5 🔴 6 段搬运范围 —— 边界逐个验证

| 验证项 | 结果 |
|---|---|
| 54 个 TO-MOVE 类是否全被 6 段覆盖 | ✅ **零缺失** |
| 6 段里是否混进 ALREADY 类 | ✅ **只有 `.k-suggest-chip`**(= E-52 有意补的基类),其余 16 个 ALREADY 一个都没进 |
| 两个 `@keyframes` | ✅ `k-drawer-fade` + `k-drawer-in` 都在 S5 里 |
| `@media (max-width: 720px)` | ✅ 在 S6 里 |
| S6 跳过的 `:1564-1570` 到底是什么 | ✅ 实读 = `.k-btn.outline` + `:hover`(重复段)+ `.k-btn.text` + `:hover`(K45 已搬)—— **与附录声明逐字一致** |
| 24 死类 | ✅ 零 |

**另一条附录没写、但评审顺手证掉的事**:那 55 个新类在本仓现状 `knowledge.scss` 里**一个都不存在**
(`whitelist items not in h0` 只有 `knowledge-app` 一项)⇒ **五个非 E-52 段的插入位置与级联无关**,
T2 放在哪都不会撞既有规则。附录只钉了 `.k-suggest-chip` 一处源序,**这是够的,不是缺口**。

### 2.6 🔴 E-52 / E-56 —— 附录的「诚实版」处置经得起复核

回蓝本 `:357-367` 与本仓 `:2198` 实读:

| 选择器 | 特异度 | 声明的属性 |
|---|---|---|
| `.knowledge-app .k-suggest-chip`(基类) | (0,2,0) | padding / background / border / border-radius / font-size / color / cursor / transition + `:hover` |
| `.knowledge-app .k2-suggest .k-suggest-chip`(覆盖) | (0,3,0) | **只有 `white-space: nowrap`** |

→ ① (0,3,0) > (0,2,0),**顺序颠倒不会反掉**;② 属性集**完全不相交**。
**§D.4 判定「『顺序错了会有可见回归』是假的」成立。**

同时确认 E-52 的**另一半是真的**:`src/ai/knowledge/views/DashboardView.vue:292` 真的在用
`class="k-suggest-chip"`,而本仓 `knowledge.scss` 里除了 `:2198` 那条 `white-space` 覆盖以外
**零基类规则** ⇒ P5a 已交付的仪表盘建议 chip 确实跑在「零基类样式」上。**这个视觉缺陷是真的。**

🔴 **§D.4 给 T2 的断言形态是正确的**:钉「源序」这件事本身(判据 = 调换两段则报红),
并明令**禁止**写成「顺序反了样式会失效」的用例名/注释。这正是评审会逮的那种零判别力 + 事实错误。

### 2.7 K46 z-index / K44 例外 / 三个嵌套零引用规则

| 项 | 复核 |
|---|---|
| `.k-drawer-bg` z-index | 蓝本 `knowledge.scss:1577` = **1050** ✅(§B.4.1 行号也对) |
| `.k-fileviewer-host` z-index | 蓝本 `KFileViewer.vue:74` = **1100**,行尾注释原文 `/* above the detail drawer (1050) */` ✅ |
| K46 相对关系 `1100 > 1050` | ✅ 成立,且蓝本注释里的 1050 与实际值逐字一致 |
| K44 例外集合 | `knowledgeStyles.test.ts:766-768` 实读 = `expect(bareTopLevelSelectors()).toEqual(['.nme-content .ProseMirror'])`,现状 1 条 ✅(承 R4) |
| `.h-md`(`:660`)蓝本零引用 | ✅ 实测:16 个蓝本 `.vue` 里 `h-md` **0 次命中** |
| `mark` ×3 | ✅ `:653` 与 `:1645` 实读**用的是 `var(--accent-soft)` / `var(--accent)`**;只有 `:1660` 是字面量。附录「别一起改」正确 |
| `.k-adv-toggle` / `.chev` 交接 | ✅ §D.5 写了「P5e 搬、P5f 不许重复搬」,并区分了 `:509`/`:510` 与 `:1561` 是**两条不同的后代规则**(实读成立) |
| `.k-btn.text`(K45)/ `.k-seg`(K43)/ `.k-btn.outline`(P5a) | ✅ 三条「不许重复搬」交接项齐全 |

---

## 3. 附录 B(色值)

### 3.1 🔴 17 处色字面量 —— 自己重扫,逐处比对

评审用 `/#[0-9a-fA-F]{3,8}\b|rgba?\(…\)|hsla?\(…\)|具名色/` 扫 §D.2 的 6 段 + `KFileViewer.vue:70-120`,
剔 `white-space` 假阳性:

```
scss 段内 16 处  +  KFileViewer:75(#fff)  =  17 处「要处置」
外加 KFileViewer:84(#fff)= 1 处「随 K46 删除」     总计 18
```

**与 §B.0 的 17 行表 + 1 行 `—` 行逐个吻合。且每一处的行号与字面量文本都对得上**:

| 行 | 字面量 | 附录 |
|---|---|---|
| `:599` | `white` | ✅ #1 |
| `:616` | `white` | ✅ #2 |
| `:618`–`:622` | `#FF3B30` / `#1a1a1a` / `#007AFF` / `#34C759` / `#AF52DE` | ✅ #3–#7 |
| `:639` | `rgba(52, 199, 89, 0.12)` + `#1f9c47` | ✅ #8/#9 |
| `:640` | `rgba(255, 149, 0, 0.14)` + `#c97500` | ✅ #10/#11 |
| `:641` | `rgba(255, 89, 0, 0.14)` + `#c54a00` | ✅ #12/#13 |
| `:1574` | `rgba(15, 20, 30, 0.32)` | ✅ #14 |
| `:1582` | `rgba(15, 20, 30, 0.18)` | ✅ #15 |
| `:1660` | `rgba(255, 235, 0, 0.4)` | ✅ #16 |
| `KFileViewer:75` | `#fff` | ✅ #17 |
| `KFileViewer:84` | `#fff` | ✅ 删除行 |

🔴 **协调者点名的三处全部定死,实现者无自选空间**:5 个实底逐字给值 · 3 组 `rgba` 底 + 3 个实字色
逐字给值 · `:1660` 的高亮黄两档都给值。**`.k-rcard-snippet mark`(`:653`)与
`.k-chunk-item-preview mark`(`:1645`)没有被误列进「要换 token」** —— §B.2.3 末尾还专门写了
「只改 `:1660` 这一处,另两条别一起改」。

### 3.2 新建 token 的两档取值 —— 逐条回本仓核

| token | 附录给的值 | 评审复核 |
|---|---|---|
| `--paper-surface` | 两档 `#ffffff` | ✅ `knowledge.scss` **确实还没声明**(grep 零命中);`tokens.scss:193`(浅)/`:342`(暗)= `#ffffff`。「T2 必须在两档各补一份」正确 |
| `--text-on-accent` | 暗 `#ffffff` / 浅 `var(--on-accent)` | ✅ `knowledge.scss:177` / `:321` 实读一致 |
| `--rtag-pdf/doc/txt/code` | `#FF3B30`/`#007AFF`/`#34C759`/`#AF52DE` | ✅ `tokens.scss:206/207/208` = `--kind-pdf`/`--kind-doc`/**`--kind-xls`**;`--purple` 在 `knowledge.scss:187`/`:348` = `#AF52DE` |
| `--rtag-md` | `#1a1a1a` | ✅ `tokens.scss:209`/`:350` = `--kind-md` 同值 |
| `--shadow-drawer` | 暗 `-20px 0 60px rgba(0,0,0,0.55)` / 浅 `-20px 0 60px rgba(40,35,25,0.10)` | ✅ 几何逐字照蓝本 `:1582`;alpha 与 `--shadow-lg` 同档一致(`:222` 0.55 / `:366` 0.10),R4 暖灰↔纯黑规则成立 |
| `--mark-hl-bg` | 暗 `rgba(255,235,0,0.22)` / 浅 `rgba(255,235,0,0.40)` | ✅ 浅档 = 蓝本原值;两档都显式给值,无自选 |
| `--bg-canvas`(K47) | 暗 `#1C1C1E` / 浅 `var(--bg)` | ✅ `:164` / `:308` 实读一致;蓝本 `KFileViewer.vue:106` 的兄弟规则本来就是 `var(--bg-canvas)`,依据成立 |

🔴 **`--kind-txt` 同名异值这个雷,附录抓得对且抓得准**:`tokens.scss:210` 的 `--kind-txt` = `#8E8E93`
(灰),而蓝本 TXT 是 `#34C759`(绿),真正同值的是 `--kind-xls`。**不另起 `--rtag-*` 家族就会造成
全仓同名两值。§B.2.1 的四条改名理由站得住。**

🔴 **`.k-rcard-tag` 文字色的记忆风险已被正确处理**:记忆说「`--on-accent` 只在 accent 实底上可用」。
评审核 `theme.css:186`(浅)`--on-accent: #ffffff` —— 白字压在 5 个**不透明实底**上安全;
`knowledge.scss:177` 暗档直接是 `#ffffff`。**两档都是白,判定成立。**

🔴 **`#1a1a1a` 在暗色档单独标注 + 进验收拍板项** —— §B.2.1 末尾写全了(浅档近黑底白字 = 蓝本本意;
暗档比 `--bg-elevated`(`#242426`)更暗、会陷进白纸片;判定照蓝本 1:1 保留并请机主拍板)。

### 3.3 🔴 E-57 —— 自己数一遍

只扫 `<script` 之前的模板段,正则 `/(:?style="[^"]*"|:?color="[^"]*")/g`:

| 文件 | 评审实测总处数 | 含颜色 | 色字面量 | 附录 |
|---|---|---|---|---|
| `SearchView.vue` | **16** | 8 | **0** | 16 / 8 / 0 ✅ |
| `FileDetailDrawer.vue` | **9** | 2 | **0** | 9 / 2 / 0 ✅ |
| `KFileViewer.vue` | **1** | 1 | **0** | 1 / 1 / 0 ✅ |
| 合计 | **26** | **11** | **0** | 26 / 11 / 0 ✅ |

**§B.3.1/§B.3.2/§B.3.3 的逐行清单里每一个行号都对得上**(SearchView 的 `:8 :26 :84 :87 :97 :100
:101 :102 :103 :104 :105 :124 :149 :151 :152 :159`;FileDetailDrawer 的 `:6 :14 :17 :19 :22 :24
:50 :66 :70`;KFileViewer 的 `:16`)。逐处判定「已是 `var()`」/「纯尺寸排版」也逐个正确。
→ **E-57 成立**,协调者初测的 6 处确是欠计,FileDetailDrawer 的 9 处确是精确。

### 3.4 K46 判据的「诚实登记」值得点名

§B.4 主动订正了自己的判据 ①:`.overlay` **不是全仓零命中** —— `ViewerShell.vue:9` 会吐出
`<div class="overlay">`,而 `ViewerShell.vue:23-29` 的 scoped 规则**已经给它写了
`position:absolute; inset:0; z-index:200; overflow:hidden; display:flex; flex-direction:column`**,
正是蓝本那条 `::v-deep .overlay` 想补的东西。评审复核:`panelMap`/`ViewerShell` 实读一致,
**这个订正让 K46 的结论更强而不是更弱**。判据 ②(host 必须提供铺满视口的定位祖先)也成立。

---

## 4. K48 等价性证明

跑 `p5e-fixtures/scripts/k48-equiv.mjs`:

```
# relLevel / relLabel over 27 inputs
# fmtMtime over 16 inputs
# highlight over 16 × 29 = 464 combos
RESULT: 534 comparisons, 0 mismatches → EQUIVALENT ✅
```

**回蓝本逐字核两份实现**:脚本里的 `A` 与蓝本 `SearchView.vue:317-345`(`if` 链 + `0.50`)、
`B` 与 `FileDetailDrawer.vue:199-217`(三元 + `0.5`)**逐字对应**,只把 `this.$t` 换成恒等 stub
—— 这个替换是正确的隔离手法(把差异限制在逻辑上)。

🔴 **输入集覆盖度审查(重点)—— 不是空壳**:

| 要求 | 脚本里有没有 |
|---|---|
| `relLevel` 两个阈值两侧 | ✅ `0.4999` / `0.5-Number.EPSILON` / `0.5` / `0.5000001` / `0.6499` / `0.65-Number.EPSILON` / `0.65` / `0.6500001` |
| 非数输入 | ✅ `NaN` / `±Infinity` / `null` / `undefined` / `'0.7'` / `'0.4'` / `''` / `true` / `false` |
| escape 边界 | ✅ text 含 `& < > "`;query 含 `&` `<` `"` |
| 多词 | ✅ `'a b'` / `'  a   b  '` |
| 空 query | ✅ `''` / `'   '` / `null` / `undefined` |
| 正则元字符 | ✅ `.*` `\\` `^a` `a$` `a|b` `a?` `a{1}` `$5` `(approx.)` `[see` `1+1` |
| XSS 载荷 | ✅ `<script>alert(1)</script>` / `<img src=x onerror=1>` / `<mark>already</mark>` |
| `fmtMtime` 边界 | ✅ `0` `null` `undefined` `NaN` `''` `false` `-1` `1.5` `8.64e15` 字符串毫秒 |

顺带:脚本尾部还打了 K49 前提的抽查(escape 真的发生)与真机 score 区间的分档
(`0.738→high` / `0.60→mid` / `0.4666→low`)—— **对 T3/T7 有直接价值**。
**判定:K48 可以批准抽进 util,证明不是空壳。**

---

## 5. `@vue-office` jsdom 可测性(治理 §9.12)

### 5.1 🔴 `ExcelViewer` 的 exit 1 —— 自己复现了

评审自建探针(仓根临时 `.test.ts`,跑完删除)。**两轮很关键**:

| 轮 | 做法 | 结果 |
|---|---|---|
| 1 | 直接 `mount(ExcelViewer)`,**不 mock `getBytes`** | `EXIT=0`,零 error —— 因为 `buffer` 恒 null、`VueOfficeExcel` 的 `v-if` 不成立,x-spreadsheet **从未被构造** |
| 2 | `vi.mock('@nimotech/nimoos-service')` 让 `getBytes` 返回 `ArrayBuffer(64)` | 🔴 **复现** |

第 2 轮输出(`--reporter=verbose`):

```
Error: Not implemented: HTMLCanvasElement.prototype.getContext
  at new e (@vue-office/excel/lib/index.js:1:73232)
⎯⎯ Unhandled Rejection ⎯⎯
TypeError: Cannot read properties of null (reading 'scale')
  at new e (@vue-office/excel/lib/index.js:1:73275)
 Test Files  1 passed (1)
      Tests  2 passed (2)
     Errors  1 error
EXIT=1
```

→ **§D.9.2 的结论成立,行号(`:73232` / `:73275`)与成因(x-spreadsheet 构造时无条件
`canvas.getContext('2d')` → jsdom 返 null → 读 `null.scale`)逐字复现。**
同轮 `DocViewer` **带 buffer 也挂得干净、零报错** → §D.9.1 ② 成立。

⚠️ 一条对 T4/T5 有用的补充(附录没写,不算缺陷):**触发条件是 `buffer` 非 null**。
不 mock `getBytes` 时 ExcelViewer 是安全的。T4/T5 一定会 mock `getBytes`,所以结论与落地无冲突。

### 5.2 mock 边界与契约形状 —— 复核成立

`ExcelViewer.vue:9-10` 实读 = `defineProps<{ item: FileEntry; list: FileEntry[] }>()` +
`defineEmits<{ (e:'close'):void; (e:'download', entry: FileEntry):void }>()`
→ §D.9.3 的 stub 保留 `item`/`list` props + `close`/`download` emits,**契约形状正确**。
「`DocViewer` 本可不 mock,但两个必须一致 mock(否则同一批用例两套挂载语义)」这条理由站得住。

### 5.3 既有先例 —— T0 真的读了

评审逐个核 §D.9.6 的四条:`ViewerHost.vue:10-19` 七个 viewer 全 `defineAsyncComponent` ✅ ·
`panelMap.test.ts` 只测 `getPanelType()` 纯函数不挂载 ✅ · `useViewer.test.ts` 只测状态机 ✅ ·
`useOfficeBytes.test.ts` mock `service.file.getBytes` ✅。
**「全仓零挂载真 DocViewer/ExcelViewer 的先例」成立**,故 stub 路线是新做法、T5 须显式申报 —— 正确。

### 5.4 三条变异判据有判别力

| 断言 | 变异判据 | 评审判断 |
|---|---|---|
| `VIEWER_MAP` 五扩展名 | 删 `wps` → 那条必红 | ✅ 有判别力(断言落在渲染出的 `data-stub` 值上,不是断言 map 常量本身) |
| fallback 分支 | `VIEWER_MAP[ext] \|\| null` → `\|\| 'DocViewer'` → 必红 | ✅ |
| Esc 注册/注销 | 删 `onBeforeUnmount` 的 remove → 必红,**判据落在「同一函数引用」上** | ✅ 这一条特别对 —— 「调过一次」是零判别力,附录明确避开了 |

### 5.5 §D.9.5 的既有差异 —— 逐字复现

蓝本 `VIEWER_MAP`(`KFileViewer.vue:37-43`)= `docx→Doc` `wps→Doc` `xls→Excel` `xlsx→Excel` `csv→Excel`;
本仓 `panelMap.ts:17-19` = `pdf-viewer:[pdf,doc,wps,xls,ppt,pptx]` / `doc-viewer:[docx]` /
`excel-viewer:[xlsx,csv]`。→ **`wps` 与 `xls` 确实分叉**,附录描述精确,「照抄不许顺手改成
pdf-viewer」的 N 系列判定正确。

---

## 6. fixtures

### 6.1 `.REAL` 抽验 —— 按 README 命令重跑

| fixture | 重跑结果 |
|---|---|
| `F1-search-text.empty.REAL.json` | ✅ 重跑 `POST $SEARCH/v1/search/text` 得 `{"hits":[],"stats":{"total_candidates":0,"rerank_ms":0,"embed_ms":245,"vector_search_ms":7,"expand_ms":0},"warnings":[]}` —— **结构与字段名逐个相同**,只有 `embed_ms`/`vector_search_ms` 两个时间字段漂(允许) |
| `F7-distill.REAL.json` | ✅ 重跑 `GET :8282/agent/notes/distill/status` = `{"pending":0,"distilled":0,"quota_remaining":50,"background_model":""}` 逐字相同;`/agent/notes/settings` 逐字相同(含 `distill_roots`/`distill_daily_cap`/`background_model` 三个新字段) |
| `F9` 的 mime 分布 | ✅ 重跑 `GET :8283/v1/parser/files?limit=20` = `total 7`,7 条 `mime` 全 `text/plain`,扩展名 `.log`×6 + `.json`×1,`mtime_ms` 在 `1784…`–`1785…` 区间(毫秒)—— 与 README §2 ③、§D.10 #16/#17/#18 逐条一致 |
| `F8-v3file.REAL.json` | ✅ 401 两态与 `_auth_mechanism` 的每一句都能回源核实(见 §7.1) |

README §1 的取数命令(端口从 `/var/run/nimoos/*.url` 现取 + `X-NimoOS-User-ID: 1`)**可直接跑通**。

### 6.2 `.REPLAYED` 方法论 —— 回 Go 源逐行核映射

评审实读 `NimoOS-Search/service/search.go` 与 `service/authz.go`:

| Go 权威源 | 附录/README 的引用 | 复核 |
|---|---|---|
| `search.go:32-58` `Hit`/`Cite`/`Preview` | — | `Hit` 的 JSON 字段 = `score raw_score collection file_id paths mime kind cite preview payload_extra`(`PointID` 是 `json:"-"`)—— **F5/F5b 的 hit 键集逐个吻合** |
| `search.go:46-53` `Cite` | ④ | `Page *int` **无 `omitempty`** → 键恒存在、空为 `null`;`ChunkNo int` 恒存在、`0` 合法 ✅ **F5/F5b 里 `page:null` / `frame_ms_*:null` 全部照此** |
| `search.go:55-58` `Preview` | ⑤ | `Text *string` + `ThumbnailURL *string`,均无 `omitempty` ✅ F5/F5b 两键恒存在、`thumbnail_url:null` |
| `search.go:68-73` `SearchResponse` | ① | `Hits` 无 `omitempty`、**`Files` 有 `omitempty`** ✅;`:293` 注释原文「consumers should prefer Files when present (len > 0)」✅ |
| `search.go:205-231` 排序/分组 | — | `sort.SliceStable(score desc)` → `GroupByFile` 时按 `order` 重新扁平化 ✅ **F5b 的 hits 顺序(0.738,0.7354 / 0.6118,0.6002 / 0.5127,0.5044 / 0.4824,0.4666)正是「按文件 rank 序扁平」的结果** |
| `search.go:243-259` paths/mime 回填 | — | `hits[i].Paths = rec.Paths`;`Mime` 仅在空时回填 ✅ |
| `search.go:263-290` `files[]` 组装 | — | `grp.Paths/Mime/Kind/Score = grp.Chunks[0].*` ✅ **F5b 四个 group 的 `score` 逐个等于自己 `chunks[0].score`** |
| `search.go:298-337` `buildHitFromPayload` | — | `collection: "text_chunks"`、`payload_extra: {}`、`score==raw_score`(rerank 未跑)✅ F5/F5b 全部照此 |
| `authz.go:88-101` `ChunkContextChunk` | — | `page`/`offset_start`/`offset_end` **都带 `omitempty`** ✅ **F6/F6b 里 `page` 键整个消失**,与 `/v1/search/text` 侧相反 —— README ④ 那句「两个端点口径不同,mock 别互抄」是**真的重要且正确** |
| `authz.go:103-149` `GetChunkWindow` | 附 | 窗口 `[chunk_no-window, chunk_no+window]` + 同 `kind` 过滤 + `ChunkNo` 升序 + `AnchorChunkNo` = 请求原样回显 ✅ **F6b 的 `4,5,6,8` 非连续 + `anchor=6` 合法** |

**结论:REPLAYED 的字段级映射逐条正确,这个地基是可用的。** 但 provenance 的申报有缺口 —— 见 Important-2。

### 6.3 `.CONSTRUCTED` 的 D-6 登记 —— 到位

`F10` 与 `F11` 都带 `_provenance`(说明为什么本机无真样本)+ 权威源 `file:line`
(`F10`:`search.go:46-53` / `:295-337`;`F11`:`search.go:176` / `:180`)。
`F10` 真的含 **`page: 0`** 那个陷阱(`cite.page = 0` 且 `chunk_no = 0`)✅。
`F11` 还额外列了同一个 `warnings` 切片里另外两个**真实**字符串(`no_accessible_roots` /
`path_expand_unavailable`)及其行号 —— 超出要求。**§0 的纪律块明写了「用 CONSTRUCTED 必须在测试
注释里写明『本机无真样本 + 权威源 file:line』」,不许当真机可达依据。**

### 6.4 六个必答字段级问题 —— 逐个有答且逐个正确

① `files[]` vs `hits[]`:**两个都有,`files` 带 `omitempty`** → 有结果时 `resp.files` 是真机路径,
零结果时整键消失走 `groupHits(resp.hits||[])` 得 `[]`。**N45 两条分支的真机归属答清楚了。**
② `paths[0].mtime_ms`:字段名 `mtime_ms`、单位**毫秒**,真实值 `1784424392240` ✅ 评审实测复现;
「与 P5d 的秒完全相反、喂错静默产出 1970」这条警告成立(当秒解读 → 1970-01-21)。
③ `mime` 分布:**本机 7 文件全 `text/plain`** ✅ 实测复现;N35 的「不许补全 docling 变体」结论不变。
④ `cite.page` 空时:`/v1/search/text` 侧 **`null`**(无 `omitempty`)、`/v1/search/chunk` 侧
**整键消失**(有 `omitempty`)✅ 回 Go 源复核成立;「`0` 是合法页号」也点明了。
⑤ `chunks[].preview.text`:字段名 `preview.text`,`*string` 无 `omitempty`,`stringOrNilFromAny`
把 `""` 也变 `nil` ✅ `search.go:339-347` 实读一致。
⑥ `score` 量纲:dense 余弦;本机实测切题 0.7340–0.7380 → high、不相关 0.4666–0.4824 → low
✅ **F0 的 6 个真 score 落在 0.734826–0.7379857,与声明区间一致**;三档分得开。
附:`rerank_unavailable` 本机不会出现 + 唯一真抓到的非空 `warnings` 是 `no_accessible_roots`(F4)✅。
附:anchor 缺席兜底链路答得对(落 `c.snippet || ''`,`FileDetailDrawer.vue:156-157`)。

🔴 **`inline=1` 后端支持不支持 —— 支持,评审自己回源核实**:`NimoOS/route/v2.go:256-262`
逐字为 `disposition := "attachment"; if r.URL.Query().Get("inline") == "1" { disposition = "inline" }`
+ `Content-Disposition` 拼接;`Content-Type` 由 `http.ServeFile` 按扩展名嗅探。**DoD-10 这一问答对了。**

---

## 7. 两条 `NEEDS_CONTEXT` 的**事实**独立复核

> 裁定不是评审的活;下面只判事实成不成立。**两条都成立。**

### 7.1 NC-1 —— 成立

| 待核事实 | 评审自己读到的 |
|---|---|
| `/v3/file` 只读 `?token=`、全函数零处读 `Authorization` | ✅ `NimoOS/route/v2.go:237-266` `InitFile()` 是**裸 `http.HandlerFunc`**;第一句就是 `token := r.URL.Query().Get("token")`,`len==0` 即 401 `{"message": "token not found"}` **在读任何 header 之前返回**;全函数无一处 `Authorization`。挂载点 `main.go:137`,无任何 JWT 中间件 |
| 无效 token 的第二态 | ✅ `jwt.Validate` 失败 → 401 `{"message": "validation failure"}` |
| `getHttp()` 只设 header | ✅ `NimoOS-Service/src/http.ts:56-60` 请求拦截器只 `cfg.headers.Authorization = token`,**从不往 query 拼** |
| `fileUrl()` 打哪 | ✅ `src/file.ts:65-68` → `/v3/file?token=…&path=…` —— **恰是该端点唯一接受的形式** |
| `getBytes()` 打哪、丢不丢 Content-Type | ✅ `src/file.ts:52-58` → **`/v1/file`**(另一个端点,走 header 认证,可用),`return res.data as ArrayBuffer` **不回传 `res.headers`** → 确实丢 Content-Type |
| `inline=1` 支持不支持 | ✅ 支持(见 §6.4) |

→ **K50 规定的 `getHttp().get('/v3/file', …)` 在真机上 100% 401,事实成立。**
T0 报告的四方案(A/B/C/D)与「T7 在裁定前不能开工」的判断,评审无异议。
**T0 的分析比要求更完整**:它还查出「蓝本自己也是错的」(`SearchView.vue:346-355` 的注释声称
走 header,而 Vue2 的 axios 实例 `service.js:33-45` 同样只设 header)⇒ Vue2 搜索区这两个按钮
在这个后端上从来就是坏的,是既有缺陷而非本期引入。这一条对裁定很关键,评审复核成立。

### 7.2 NC-2 —— 成立

评审自己打后端(端口现取):

```
Qdrant text_chunks 总点数                          → 5592
root_ids ANY ["dfcd1840f5dab439cd9d7050aa5bafd0"]  → 5592   (全部)
root_ids ANY ["photos"]                            → 0
GET $NIMOOS/v1/nimoos/search-roots?user_id=1       → {"root_ids":["photos"]}
GET $NIMOOS/v1/nimoos/search-roots?user_id=2       → {"root_ids":["photos"]}   (uid 无关)
POST $SEARCH/v1/search/text "figure skating"       → {"hits":[],"stats":{"total_candidates":0,…},"warnings":[]}
```

链路复核:`route/v1/text.go:33-44` 取 `allowed` → `service.ApplyScope`(`service/filters.go:41-50`)
→ `IntersectRoots`(`:12-34`),其注释与实现都是「**userRequested 为空则返回 allowed 全集**」
⇒ 用户没传 `root_ids` 时交集**非空、不会短路**到 `no_accessible_roots` ⇒ 交给 Qdrant 做
`root_ids ANY ["photos"]` 过滤 ⇒ 命中 0 ⇒ **`hits:[]` 且 `warnings:[]`,没有任何提示**。

→ **「交集为空 ⇒ 恒零结果、且无 warning」这条链路成立。** `phase === 'results'` 整个分支
在本机不可达,**是 D1 的连带后果,不是 P5e 的问题** —— T0 的定性正确。
§D.10 那 23 项可点性清单里 14 项标「不可达」的依据,评审逐条抽查成立(特别是 #16 的
**双重不可达**:抽屉打不开 + 本机 `.log`/`.json` 都不在 `DISTILL_EXTS` 里,后者评审已实测坐实)。

---

## 8. 三门与数字(按 R14 先例不全量复跑,但逐项自算)

| 项 | T0 自报 | 评审 |
|---|---|---|
| `Test Files` / `Tests` | 331 / 3958 | 落盘日志 `/tmp/p5e-t0-test.log` 实读 = `Test Files 331 passed (331)` / `Tests 3958 passed (3958)` / `Duration 145.33s`,**13 行完整、无 `\| tail` 截断痕迹**(默认 reporter 全绿时就这么短) |
| `vue-tsc` | 0 | `/tmp/p5e-t0-tsc.log` **0 行** ✅ |
| `vite build` | 0 | `/tmp/p5e-t0-build.log` 81 行,尾行 `✓ built in 13.79s`,唯一告警是既有的 `chunks are larger than 500 kB` ✅ |
| `src/**/*.vue` 总数 | 182 | 🔴 **评审自算 = 182** ✅ |
| `KIcon.PATHS` 键数 | 42 | 🔴 **评审自算 = 42** ✅(E-35/E-51 的 42 口径正确,不是 43) |
| `color-guard` 用例数 | 184 | 🔴 **评审自己跑** `pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose` → `Tests 184 passed (184)` ✅ |
| `git diff --name-only -- src/` | 空 | ✅ 空 |
| `d79d922` 范围 | 只 `.superpowers/` | ✅ **27 文件全在 `.superpowers/sdd/` 下;`grep -E '^(src/\|package\|pnpm\|vite\|tsconfig)'` 命中 0** |
| 工作树 / Service 仓 | 干净 | ✅ `git status --porcelain` 空;`.sp8/NimoOS-Service` 亦空(HEAD `15c2eba`) |

**为什么不复跑全量 `pnpm test`**:承 R14 先例 —— 三份日志真实落盘且未截断、退出码 0、
`src/` 零 diff、工作树干净、三个附加数字全部评审自算复现,证据链已足。
⚠️ 但见 Minor-8:日志在 `/tmp`,不在仓里。

**U-2 独立复现**:`65cfda58` 的对象已在本地库(T0 fetch 过),评审自己跑逐文件 diff:

```
SearchView.vue        401/401  差异 = :329,:330,:357,:381 四行注释中→英
FileDetailDrawer.vue  220/220  差异 = :77,:80 两行注释(在 <!-- --> 里)
KFileViewer.vue       120/120  差异 = :32 一行注释
searchAggregate.js     79/79   零差异
knowledge.scss       2561/2561 差异 = :1675 一行段头注释(在 P5b 地盘,不在 P5e 6 段内)
```

→ **五个行数逐个吻合、零非注释差异 ⇒ 锁 `7a6ee6b7` 不换的判断成立,不需要停下问用户。**

---

## 9. Findings

### 🔴 Important-1 —— `p5e-fixtures/replay.md` 不存在,四个 `.REPLAYED` fixture 零复现路径

**证据**:README §3 原文「复现脚本:`.superpowers/sdd/p5e-fixtures/replay.md` 里贴了完整命令。」
但:

```
$ ls .superpowers/sdd/p5e-fixtures/replay.md   → No such file
$ git show --name-only d79d922 | grep -i replay → (零命中)
$ grep -rn 'replay.md' .superpowers/sdd/        → 只有 README §3 那一处引用本身
```

**为什么是 Important**:`F5`/`F5b`/`F6`/`F6b` 是 **T3/T5/T7 全部单测的地基**,README 自己把
它们定性成「真数据 + 权威代码路径重放」——**重放过程无法复现,就等于无法审计**。
计划书通用 DoD 明写复现命令要落盘;协调者的 T0 交付物清单也点名了 `replay.md`。

**修法**(廉价):补 `replay.md`,内容 = ① `POST :6333/collections/text_chunks/points/query` 的
完整请求体(含 `using: "dense"` 与 `limit`,以及那次真 bge-m3 `embed` 的调用)· ② `GET
:8283/v1/parser/_internal/files?file_ids=…` 的原样输出 · ③ 从 `F0` 走到 `F5`/`F5b` 的那段
映射脚本原文 · ④ `F6`/`F6b` 的窗口取数命令。

---

### 🔴 Important-2 —— `.REPLAYED` 里有**未申报**的正文截断,且 `F5` 有 2 条 chunk 溯不回 `F0`

**证据 A(截断)**:每个 fixture 的正文长度是**齐刷刷的整数**:

```
F5   preview.text 长度: 400,400,400,400,400,400,400,400
F5b  preview.text 长度: 320,320,320,320,320,320,320,320
F6   chunks[].text 长度: 600
F6b  chunks[].text 长度: 400,400,400,400
```

回 `F0` 的**真** payload:同一个 `chunk_no=2387` 的 text 是 **2296** 字符、`chunk_no=20` 是 **2333**
字符,而 `F5` 对应项恰好是它们的 **400 字符前缀**(`startsWith` 实测为 `true`)。
回权威源:`buildHitFromPayload`(`search.go:298-337`)只做 `Preview{Text: text}`,
`stringOrNilFromAny` 也只判空 —— **全链路零截断**。`GetChunkWindow`(`authz.go:126`)同样是
`text, _ := h.Payload["text"].(string)`,零截断。⇒ **这 400/320/600 是人工加工,不是重放结果。**

**证据 B(溯源缺口)**:`F0` 只有 **6** 个真点,`F5` 有 **8** 条 hit ——
`hits[6]`(`chunk_no=1667`,`score=0.7346915`)与 `hits[7]`(`chunk_no=3094`,`score=0.7344978`)
**在 `F0` 里没有任何对应项**(按 `score|chunk_no|offset_start` 三元组比对,零命中)。

**与 README 的自述冲突**:§3 原文「`F5b` 的 8 个 `score` …… **这一处、且仅这一处是人工选值,
其余每个字段都来自真响应**」。按证据 A/B,至少还有:全部 `preview.text`/`text` 被截断、
`F5` 的 2 条 chunk 无 `F0` 出处。**未申报的偏离本身就是缺陷**(治理长期纪律)。

**实际杀伤面**(诚实评估,不夸大):`searchAggregate.js` 的 `chunkVM` 把
`snippet: (c.preview && c.preview.text) || ''` **原样透传**,`.k-rcard-snippet` 又靠
`-webkit-line-clamp: 3` 裁显示 ⇒ **不会让 T3 的逻辑用例判错**。风险在两处:
① T3/T5/T7 的实现者读了「每个字段都来自真响应」这句,可能基于「正文完整」写断言;
② `highlight()` 是 K49 唯一 XSS 面,它跑在这段正文上 —— 用一段被裁到 400 字的样本做注入用例,
覆盖面比真机窄(真机 2300 字里可能有更多 `&<>"`)。

**修法**(二选一,都廉价):(a) 把正文恢复成 `F0` 的完整真值(F5 的那 2 条一并补真 payload 或删掉);
(b) 保留截断,但在 README §3 与每个 REPLAYED fixture 的 `_provenance` 里**显式登记**
「`preview.text` / `chunks[].text` 已人工截断至 N 字符以控制 fixture 体积;后端不截断,
权威源 `search.go:298-337` / `authz.go:126`」,并把 `F5` 那 2 条的出处补齐。
🔴 **T3 开工前必须落地**;T1/T2 不受影响。

---

### 🔴 Important-3 —— 8 个脚本里 7 个**跑不起来**,而 §D.7.3 把重跑列为 T2 的 🔴 强制项

**证据**:评审逐个 `node <script>`,7 个立刻 `ENOENT`:

| 脚本 | 缺的输入(相对 cwd,均未进提交) |
|---|---|
| `sim-r8r9.mjs` | `knowledge.scss`(蓝本副本)· `KFileViewer.vue` |
| `classes2.mjs` | `knowledge.scss` · `SearchView.vue` · `FileDetailDrawer.vue` · `KFileViewer.vue` |
| `scan-p5e.mjs` | `bp/src_views_AI_Knowledge_*.vue` ×4 |
| `collide.mjs` / `propose.mjs` | `p5e-values.json`(中间产物,未提交;`/tmp/p5e-{zh,en}.json` 尚在,但也是易失) |
| `lookup.mjs` | `zh_CN.json` · `en_US.json` · `p5e-keys.json` |
| `scan-i18n2.mjs` | 需要 `process.argv[2]` 目录参数,无参即 `ERR_INVALID_ARG_TYPE` |

只有 **`k48-equiv.mjs` 自包含、能跑**(评审已跑,见 §4)。

**为什么是 Important**:附录 D §D.7.3 原文「🔴 **T2 必须自己重跑一遍**(治理 §10 申报纪律:
带 🔴 的复核项不许采信上一刀的结论)」;附录 A §A.9 也把复现指向
`scan-p5e.mjs` / `propose.mjs` / `collide.mjs`。**按交付状态,T2 无法执行这条强制项**,只能像
评审这样从零重写(评审确实重写了,并且三个数字全部复现——所以这是复现层的缺陷,不是结论的缺陷)。

**修法**:每个脚本头部加一段自取输入的 preamble(`execSync('git -C ../../../../NimoOS-UI show
7a6ee6b7:<path>')` 写进 `os.tmpdir()`),或把路径改成 `process.argv` 带默认值;
`p5e-values.json` / `p5e-keys.json` 两个中间产物**一并提交**(它们很小)。

---

### Minor-1 —— 附录 A §A.0 的复现命令跑出 466,不是它想证明的 462

那段 bash 用 `grep -oP "(?:\\\$t|i18n\.t)\(\s*'…'" | sort -u | wc -l`,**去重的是包含
`$t(` / `i18n.t(` 前缀与空白的整段匹配**,于是 `$t('X'` 与 `i18n.t('X'`、
`$t( 'X'` 与 `$t('X'` 会被算成不同项 → 评审实跑得 **466**。
按附录正文声明的那个「取捕获组 1 去重」的正则,评审得 **462**(三种引号 465)——
**数字本身对,是那条 bash 命令写歪了。** 修法:管道改成
`grep -oP "…\(\s*'\K…"` 或直接贴那段 node 代码。

### Minor-2 —— E-53 的「同口径复扫」未成立(但结案本身是对的,不阻塞)

上级设计 §2.4 写「蓝本 **11 个** `.vue` 共 461 条」,T0 扫的是 `views/AI/{Knowledge,Parser}` 下的
**16 个** `.vue`。评审穷举了几种口径:

```
Knowledge 顶层 12 个 .vue        → 407
+ components(14 个)            → 424
+ Parser(16 个)                → 462     ← T0 的数
```

**没有任何口径给出 461,而上级设计自己的 §2.1 列的也是 14 Knowledge + 2 Parser + 2 共享件,不是 11。**
⇒ 「上级设计的 461 是对的」这半句**无法证实**(只能说 462 与它相差 1、量级吻合)。
**但结案的实质是对的**:不判勘误、不升级 finding、P5e 只用 63 —— 而 63 已被评审完全独立复现。
按上级指示的方向(判「结论有无可查证依据」而非「有无别的口径」),**这条不构成阻塞**,
只建议把措辞从「上级设计是对的」改成「462 与 461 相差 1、口径吻合;协调者的 408 与
『顶层 12 个 .vue = 407』基本对齐,属扫法欠计。**不判勘误。**」

### Minor-3 —— `KFileViewer` `<style>` 搬运范围差一行,会导致 `.k-fileviewer-host` 不闭合

附录 B §B.4 与 D §D.2 都写「搬 `:71-76` + `:103-119`,K46 砍掉 `:77-101`」。实读该文件:

```
 71| .k-fileviewer-host {
 …
 76| (空行)
 77-80| 注释
 81-101| 三条 ::v-deep      ← 嵌在 .k-fileviewer-host 内部
102| }                       ← .k-fileviewer-host 的闭合括号
103| .k-fileviewer-fallback {
```

⇒ 照字面搬 `:71-76` + `:103-119` 会**丢掉 `:102` 的 `}`**,`.k-fileviewer-host` 不闭合。
**T0 自己的 `sim-r8r9.mjs` 是对的**(`kfv.slice(101,119)` = 行 102–119),只有附录正文差一行。
T2 的 sass 门(`pnpm exec sass … /dev/null`)会立刻抓到,所以只是 Minor;
建议正文改成 `:71-76` + **`:102-119`**。
同一处顺带:「K46 砍掉 **21 行**」指的是 `:81-101` 三条规则;而给出的范围 `:77-101` 是 **25 行**
(多了 4 行注释)。两个数并存容易让 T2 自己算错,建议统一成范围表述。

### Minor-4 —— E-55 少算一个:§2.4 漏列的是 **3** 个类,不是 2 个

评审把 `p5-master-plan.md` §2.4 的代码块解析出 54 个 `.x` token(含一个来自
「KFileViewer.**vue**」的假阳性 `vue`)→ 53 个真类,与评审的 TO-MOVE 54 做双向差集:

```
my TO-MOVE 里、§2.4 没有的:  k-drawer   k-drawer-bg   path
```

⇒ **`.k-drawer-bg` 与 `.k-drawer` 确实漏了(E-55 的两条成立),但 `.path`(`:670`)也漏了。**
附录 D.1 已把 `path` 列进 TO-MOVE、D.7.2 也登记了它的出处,**实质零缺失**;
只是 E-55 的条目文字应写「漏列 3 个」。

### Minor-5 —— §D.0 的「§2.4 的 52 个全部落在 TO-MOVE 里,零错判 ✅」不成立(实质无缺失)

反向差集:§2.4 的 53 个类里,有 2 个**不在** TO-MOVE:
`k-suggest-chip`(→ HALF-MOVED / ALREADY,§D.4 处理)· `h-md`(**不在 74 个模板 token 基线里**,
因为它在蓝本模板里零 class 引用,§D.6 处理)。两者都在附录别处有正确归属,
所以只是那句总括**说满了**。建议改成「52/53 个里 51 个落 TO-MOVE,另 2 个分别归 §D.4 与 §D.6」。

### Minor-6 —— §B.4.1 唯一一处没给终值(评审已代查出来)

`.k-modal-bg` 那一行写的是「现状见 `knowledge.scss` `.k-modal-bg` 块 | T2 搬 `.k-drawer-bg`
时顺手核一眼别撞」。这是三份附录里**唯一**留给实现者去查的值。评审代查:

```
蓝本 knowledge.scss:1302   .k-modal-bg  z-index: 1100
本仓 knowledge.scss:1146   .k-modal-bg  z-index: 1100
蓝本 KFileViewer.vue:74    .k-fileviewer-host  z-index: 1100
蓝本 knowledge.scss:1577   .k-drawer-bg z-index: 1050
蓝本另有 :1442 z-index: 1200(别期的段)
```

⇒ `.k-modal-bg` 与 `.k-fileviewer-host` **同为 1100 是蓝本原生就有的并列**,不是本期引入;
`.k-drawer-bg` 的 1050 低于两者,不撞。**没有需要 T2 决定的事**,把这三个数字写进 §B.4.1 即可。

### Minor-7 —— 「anchor 不在 `chunks` 里」的兜底没有配 fixture

README §2 附 明写这条兜底「**是可达的,要有用例**」,但 `F6`(anchor=2387,chunks=[2387])与
`F6b`(anchor=6,chunks=[4,5,6,8])**两个都包含 anchor**。T5 需要自己再造一个
anchor 缺席的样本。建议在 README §7 的 T5 行里点明这一条要 CONSTRUCTED。

### Minor-8 —— 三门日志落在 `/tmp`,不在仓里

`/tmp/p5e-t0-{test,tsc,build}.log` 评审实读存在、未截断、内容与自报一致。但 `/tmp` 易失,
后续刀次/终审无法回查 T0 的基线证据。建议后续刀把日志落进 `.superpowers/sdd/`(与台账同处,
`git add -f`),或至少在报告里贴全文。

### Minor-9 —— §D.7.1 对「348 ≠ 347」那 1 差的解释是错的

附录写:「常量里有 **1 项只作为更长类名的前缀出现,被 `NEW_RE` 的贪婪匹配吃掉**」。
评审实测那一项是 **`knowledge-app`**:

```
whitelist items not in NEW_RE hits: ['knowledge-app']
whitelist items with no rule in css: []          ← .knowledge-app 是有规则的
```

真实原因是 **`NEW_RE` 的 `k(?:2|n)?-` 要求 `k-` / `k2-` / `kn-`,而 `knowledge-app` 是 `kn`+`o`
—— 压根匹配不上**,与「贪婪匹配吃掉前缀」无关(它是作用域根,不是别的类的前缀)。
数字 348 对、「不是错、别去修平」这条指令也对,**只有理由要改**。
⚠️ 值得改的原因:T2 若照错理由去理解,可能误以为白名单里还有别的「被吃掉的前缀项」而去翻。

---

## 10. 评审自己做的 RED / 变异 / 复现探针清单(含还原自证)

| # | 探针 | 结果 | 还原 |
|---|---|---|---|
| 1 | 自写 `cmpA.mjs`:附录 A 63 行 × `zh_CN/en_US.json` 严格比较 | 0 mismatch | 只读,无需还原 |
| 2 | 自写 `cmpA2.mjs`:全角标点正则 / 特殊字符 / 占位符 / `@\|` 扫描 | 全部复现 | 只读 |
| 3 | 自写蓝本 i18n 扫描(4 文件 + 16 文件 + 多种口径) | 53/1/9=63;462/465/407/424 | 只读 |
| 4 | 自写 `classes.mjs`:74 类三态 + 逐类蓝本/本仓声明行 | 54/17/3,行号逐个一致 | 只读 |
| 5 | 自写 `sim.mjs`:`stripComments`+`NEW_RE`+`nonKClassNames` 逐字复制、6 段追加后重跑 | 292→347 / 293→348 / 16→19,`lost=(none)`,55 类零差异 | 只读 |
| 6 | 死类三查(现状 scss / WHITELIST / 6 段) | 全 0 泄漏 | 只读 |
| 7 | 段边界双向核(TO-MOVE 覆盖率 / ALREADY 混入 / keyframes / media / `:1564-1570` 实读) | 边界精确 | 只读 |
| 8 | 自写色字面量扫描(6 段 + KFileViewer 70-120) | 16+2 = 附录的 17+1 | 只读 |
| 9 | 跑 `k48-equiv.mjs` + 回蓝本逐字核两份实现 + 审输入集覆盖度 | 534/0,覆盖足够宽 | 只读 |
| 10 | 🔴 **变异探针**:仓根建 `zz-probe-excel.test.ts`,**不 mock `getBytes`** 挂 Doc/Excel | `EXIT=0`、零 error(证明触发条件是 buffer 非 null) | 见下 |
| 11 | 🔴 **变异探针**:同文件改成 mock `getBytes` 返 `ArrayBuffer(64)` | 🔴 **复现 `Tests 2 passed` / `Errors 1 error` / `EXIT=1`**,`getContext` → `null.scale` | 见下 |
| 12 | 自己跑 `pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose` | `Tests 184 passed (184)` | 只读 |
| 13 | 自己算 `.vue` 总数 / `KIcon.PATHS` 键数 | 182 / 42 | 只读 |
| 14 | 自己打后端:Qdrant ×3 count · search-roots ×2 · `/v1/search/text` ×1 · `:8283/v1/parser/files` · `:8282/agent/notes/{distill/status,settings}` | 全部与 T0 一致 | **全部只读**,无写操作 |
| 15 | 自己跑 U-2 逐文件 diff(5 文件) | 401/220/120/79/2561,纯注释 | 只读(`65cfda58` 对象已在库,评审未再 fetch) |
| 16 | 逐个 `node` 跑 8 个交付脚本 | 7 个 ENOENT,1 个通过 | 只读 |

### 🔴 探针还原自证(**未使用 `git checkout / restore / stash`**)

```
探针前:  md5sum vite.config.ts vitest.setup.ts  > pre.md5
探针后:  md5sum -c pre.md5
          vite.config.ts:  OK
          vitest.setup.ts: OK
          rm -f zz-probe-excel.test.ts
          ls zz-probe-excel.test.ts  → No such file or directory
          git status --porcelain     → (空)
          git diff --stat -- src/    → (空)
```

**唯一被创建的文件是仓根的 `zz-probe-excel.test.ts`,已删除;`src/` 一字未动;
两个配置文件 md5 逐字节一致;工作树回到 `d79d922` 干净状态。**
**只读仓 `NimoOS-UI` 全程只用 `git show` / `git cat-file` / `diff <(…)`,零 checkout/stash/commit。**
**`:5288` / `:5273` / `:5277` / `:5299` 四个 dev server 一个都没碰。**

---

## 11. E-54 … E-58 逐条裁定

| # | 内容 | 判定 | 评审依据(自己查的) |
|---|---|---|---|
| **E-54** | 治理 §4.2 把 chunk 端点写成 `POST … body={}`,实际是 GET + query | 🟢 **成立** | `NimoOS-Search/route/v1/chunk.go:13` 实读 = `e.GET("/v1/search/chunk", getSearchChunk(d))`;`:17-23` 全部走 `c.QueryParam(...)`。共享包侧 `NimoOS-Service/src/ai.ts` 亦是 `http.get(..., {params})` |
| **E-55** | §2.4 漏列 `.k-drawer-bg` / `.k-drawer`(+ 2 `@keyframes` + 1 `@media`) | 🟡 **部分成立** | 两个类**确实漏**(`:1572` / `:1579`,`FileDetailDrawer.vue:2-3` 真在用,`z-index:1050`/`box-shadow` 实读齐全);2 个 `@keyframes`(`:1541-1545`)与 `@media`(`:1666-1672`)也确实不在 §2.4 里。**但漏的是 3 个类,`.path`(`:670`,SV+FD 模板都在用)也没列** → 见 Minor-4。**对 T2 的核对基准无实质影响**:附录 D.1 的 TO-MOVE 54 已含全部 3 个,52/53 这个数只是台账口径,T2 用附录 D 即可 |
| **E-56** | 「`.k-suggest-chip` 顺序反了会级联反掉」不成立 | 🟢 **成立** | 基类 `(0,2,0)` vs 覆盖 `(0,3,0)`,覆盖只声明 `white-space`,属性集不相交 ⇒ 顺序不影响渲染。**协调者写进 `cross-area-impacts.md` §2.1 与 `p5e-plan.md` §0.2-5 的那句「否则级联反掉而三门全绿」是错的。** ⚠️ 但 E-52 的**另一半是真的**:基类整条缺失、`DashboardView.vue:292` 真在用 ⇒ 「P5a 已交付产出里的真实视觉缺陷」这个告知用户的结论**依然成立**,不需要向用户更正;要更正的只是「顺序」那条理由 |
| **E-57** | `SearchView` 模板 `style=`/`color=` 实测 16 处非 6 处 | 🟢 **成立** | 评审自数 16 / 9 / 1 = 26,含颜色 8 / 2 / 1 = 11,色字面量 **0**;§B.3 的逐行清单行号逐个正确 |
| **E-58** | 上级设计 §6.4 的「distill 四条路由全 404」已不成立 | 🟢 **成立** | 评审自己打:`GET :8282/agent/notes/distill/status` → **200** `{"pending":0,"distilled":0,"quota_remaining":50,"background_model":""}`;`GET /agent/notes/settings` → 200 **且含 `distill_roots` / `distill_daily_cap` / `background_model`** 三个上级设计说「不下发」的字段 ⇒ 设备上的 agent 已是新版。**记忆「08-01 已重部署」被实测坐实,但 T0 没有采信记忆、而是实测后才下结论 —— 流程正确** |

**E-53(结案)**:🟡 **结论可接受,理由要改** —— 见 Minor-2。

---

## 12. 缺口猎(常规动作)

按「附录里看起来定死了、其实留了自选空间」的口径逐条扫:

| 扫查项 | 结果 |
|---|---|
| 附录 B 是否有色值没给终值 | ✅ 7 个新建 token **两档全给值**;`--paper-surface` 也给了两档值;`grep '自选\|自行决定\|待定\|TBD'` 只命中「不许自选」的禁令句 |
| 附录 B 唯一的开放项 | 🟡 `.k-modal-bg` z-index(Minor-6,评审已代查:1100/1100,无需决定) |
| 附录 D 是否有类的三态没定 | ✅ 74 个逐个有态;54 个 TO-MOVE 逐个有蓝本行号 |
| 白名单/登记表是否留了两个互斥数字(R8 的老坑) | ✅ **单一终值 348 / 19**,且给了算式与「加固不是放宽」的说明 |
| 6 段的插入位置是否留给实现者 | 🟢 **只钉了 E-52 一处源序,但评审证明其余 55 个新类在本仓零存在 ⇒ 级联无关,不是缺口** |
| 附录 A 是否有键名/值留给 T1 选 | ✅ 63 个键名 + zh + en 全定死;唯一「T1 自己测」的是 `messageSyntax` 的 `exactly N keys`,而那**必须**现测(附录明写「预期 1648 仅供对账,不许用算式代替实测」)—— 正确 |
| 附录 A 是否给了没有素材的反向断言 | ✅ 主动识别「本批 en 恰好全等于 key ⇒ 无法配 en≠key 反向断言」,并换成「改 JSON 里某值 → 脚本必须报红」的**有判别力**替代 |
| `@vue-office` 结论是否可执行 | ✅ stub 代码原文 + 契约形状 + 三条变异判据齐全 |
| REPLAYED 的字段是否有「实现者要自己猜」的 | 🔴 **有一处属未申报加工**(Important-2 的正文截断),但不是「留给实现者选」,是「已经改了没说」 |

**本刀无产品代码,所以没有「产品代码对、守卫为零」那一族;可猎的开放值只剩 Minor-6 一处,
且评审已代为查清。这是本档目前为止最紧的一份 T0 交付物。**

---

## 13. 结论

### 可以开工吗

| 依据 | 判定 |
|---|---|
| **附录 A(i18n)** | 🟢 **可以直接开工 T1,无前置修项。** 63 个值逐码点零差异、63 distinct 算式独立复现、双向撞车 14 高危逐条落表、全角标点与占位符实扫复现、`FILE_TYPES` 判定正确、R10/E-44 落地正确。Minor-1/Minor-2 是附录自己的表述问题,不影响 T1 照抄 |
| **附录 D(类清单)** | 🟢 **可以直接开工 T2。** 74 类三态与逐类行号逐个复现;`WHITELIST 348` / `NON_K_HELPER 19` 两个终值由评审用**自己重写的**模拟器复现、55 类清单零差异;24 死类零泄漏且 6 段范围里一个不含;边界(含 `:1564-1570` 的跳过)精确;E-52 的断言形态诚实且有判别力。Minor-3(差一行的 `}`)T2 只要按范围表 `:102-119` 搬就没事,且 sass 门会兜 |
| **附录 B(色值)** | 🟢 **可以直接开工 T2。** 17 处字面量逐处、逐行号、逐字面量复现;两处 token-not-literal 的 `mark` 没被误列;7 个新 token 两档全给值;`--kind-txt` 同名异值这个雷抓得准;`--on-accent` 的记忆约束正确处理。补上 Minor-6 的三个 z-index 数字更好,但不阻塞 |
| **fixtures** | 🟡 **T3 / T5 / T7 开工前必须先修 Important-1 与 Important-2。** REAL 抽验通过、REPLAYED 的字段映射逐条回 Go 源核对正确、CONSTRUCTED 的 D-6 登记到位、六个必答问题全部答对 —— **地基是对的**,缺的是复现路径(`replay.md`)与加工申报(正文截断 + F5 那 2 条的出处) |
| **脚本层** | 🟡 **Important-3** 建议在 T2 开工前修,否则 §D.7.3 那条 🔴 强制重跑项落不了地(T2 只能像评审一样从零重写) |

### 一句话

> **附录 A / B / D 可以作为 T1、T2 的依据立即开工(零阻塞修项);fixtures 与脚本层要先修
> Important-1 / Important-2 / Important-3 三条,才能作为 T3–T7 的依据。**
> 两条 `NEEDS_CONTEXT` 的**事实**评审独立复核**全部成立**,裁定权在协调者/用户;
> **NC-1 未裁定前 T7 确实不能开工**,这个判断评审无异议。

### 给协调者的 3 条提醒

1. **E-56 需要一次对外更正**:`cross-area-impacts.md` §2.1 与 `p5e-plan.md` §0.2-5 的
   「否则级联反掉而三门全绿」是错的,要改;但已告知用户的「P5a 仪表盘 chip 有真实视觉缺陷」
   **依然成立**,不必向用户更正那一半。
2. **T2 的 brief 建议直接内联三个数字**(`WHITELIST_348` / `NON_K_HELPER 19` / 55 类清单)
   **并要求 T2 用自己重写的模拟器复现**——不要指向跑不起来的 `sim-r8r9.mjs`(Important-3)。
3. **上级设计 §9-1 的「scss 任务单独派一个逐行色扫评审」本期尤其必要**:§D.10 已证
   `.k-rcard-tag` 五色与 `--mark-hl-bg` 暗档在本机**真机看不到**(结果卡不可达),
   这两组颜色**只有单测 + 人肉评审两道防线**。T0 的顾虑 3 成立。
