# P5b · T6 报告 —— scss B:「已收录文件」页专属段

**状态**:DONE
**BASE**:`7014b22`(开工前 `git rev-parse HEAD` 实测一致)
**基线**:316 文件 / 2963 例全绿 · `vue-tsc` 0 · `vite build` 0(协调者给定)
**改动文件**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`(**只这两个** + 本报告)

---

## 1. 整段搬了什么 / 落在哪 / keyframes 挪到哪

### 1.1 搬运范围

蓝本 `git show main:src/views/AI/Knowledge/styles/knowledge.scss` 的 **`:1705-2022`**(318 行),
即「已收录文件」页专属段 S8:筛选栏(`.k-filter-bar` / `.k-filt*`)· 表头元信息条(`.k-files-*` /
`.k-poll` / `.k-sort*`)· 文件表格(`.k-ftable` / `.k-frow-*`)· 状态徽标(`.k-status-badge`)·
类型标签(`.k-type-tag` / `.k-type-legacy`)· 展开详情(`.k-file-detail` / `.k-fd-*`)·
分页(`.k-pager*`)· 底部动作条(`.k-files-actionbar` / `.k-ab-*`)。

### 1.2 落点(K9)

写进**既有**的 `.knowledge-app { … }` 壳段内部(现状文件 `:267` 起那个块),**没有追加新顶层块** ——
承 T2 评审端到端验过的结论:追加到文件末尾会让 `@media` 覆写因同优先级、源码更早而被基础规则静默吃掉。

**段位按蓝本原序**落在 T2 的 S6(`@media (max-width: 860px)`,蓝本 `:1484-1499`)之后、
T2 的 S7(`.kn-badge`,蓝本 `:2031-2039`)之前 —— 与蓝本源码顺序一致,
现状文件 `:943-1324`。这也保证了级联顺序与蓝本逐条对应(段内每条各 +1 个类选择器,相对优先级不变)。

### 1.3 `@keyframes row-done` 的落点

蓝本 `:1844-1847` 原本夹在 `.k-frow-f[data-done="true"]` 与 `.k-frow-status` 之间。
本档挪到**顶层全局 keyframes 区**(现状文件 `:1374-1378`,紧接 P5a 那 7 条 `k-*` keyframes 之后),
理由与文件里 T4/T11 那两组 keyframes 的注释完全一致:scss 里嵌进选择器的 `@keyframes` 会跟着作用域走,
而模板里 `animation: row-done …` 的引用不带任何作用域前缀。

⚠️ **登记一处判断**:治理 §6.4 / brief 的措辞是「放**文件末尾**全局区,照现状 `:814-815` 的先例」。
`:814-815`(起点 `d8efb0e` 的行号)是 P5a T11 的 `k2pulse`/`k2spin`,它们的真实落点是
「**紧接在使用它们的那个块之后、顶层**」;本段所在的壳段(`.knowledge-app`)之后紧跟的正是
那个已有的全局 keyframes 区,所以我把 `row-done` 放进那里 —— 既满足「顶层全局」这个**实质**要求
(蓝本 & 本档注释都写明这是唯一硬约束),也保持了与使用点的邻近、和 T4/T11 完全同一个版式。
落进 `dist` 的编译产物里它是顶层 `@keyframes row-done`(已核,见 §7)。
若协调者坚持字面意义上的「文件最后一行之前」,挪动位置不影响任何行为,一行 `git mv` 级别的改动。

原位置留了一条注释指明它被挪走(`:1105-1106`),便于对照蓝本。

---

## 2. 附录 §B.3 的 13 行 17 处色映射 —— 逐行回执

| # | 蓝本行 | 蓝本原值(逐字) | 落地写法 | 落地位置 |
|---|---|---|---|---|
| 1 | `:1845` | `0% { background: rgba(52, 199, 89, 0.22); }` | `0% { background: var(--success-soft); }` | `knowledge.scss:1375` |
| 2 | `:1857` | `.k-status-badge[data-s="ok"]` 的 `background: rgba(52,199,89,0.12)` | `background: var(--success-soft)` | `:1121` |
| 3 | `:1857` | 同行 `color: #1f9c47` | `color: var(--success)`(**K2 并档**,见 §3 ①) | `:1121` |
| 4 | `:1860` | `.k-status-badge[data-s="error"]` 的 `background: rgba(255,59,48,0.12)` | `background: var(--danger-soft)` | `:1129` |
| 5 | **`:1862`** | `[data-theme="dark"] .k-status-badge[data-s="ok"] { color: #5BD876; }` | **整条选择器删除**(K2 / §B.4 ①) | — |
| 6 | `:1890` | `.k-type-tag[data-kind="pdf"]` 的 `background: rgba(255,59,48,0.1)` | `background: var(--danger-soft)` | `:1161` |
| 7 | `:1890` | 同行 `color: #d8362b` | `color: var(--danger)` | `:1161` |
| 8 | `:1891` | `.k-type-tag[data-kind="doc"]` 的 `background: rgba(0,122,255,0.1)` | `background: var(--accent-soft)` | `:1162` |
| 9 | `:1892` | `.k-type-tag[data-kind="md"]` 的 `background: rgba(20,20,20,0.07)` | `background: var(--bg-chip)`(**K2 并档**,见 §3 ②) | `:1169` |
| 10 | `:1893` | `.k-type-tag[data-kind="txt"]` 的 `background: rgba(52,199,89,0.1)` | `background: var(--success-soft)` | `:1171` |
| 11 | `:1893` | 同行 `color: #1f9c47` | `color: var(--success)` | `:1171` |
| 12 | `:1894` | `.k-type-tag[data-kind="code"]` 的 `background: rgba(175,82,222,0.1)` | `background: var(--purple-soft)`(**本任务新声明的 token**) | `:1176` |
| 13 | `:1894` | 同行 `color: #9a3fd0` | `color: var(--purple)`(两档已有) | `:1176` |
| 14 | **`:1895`** | `[data-theme="dark"] .k-type-tag[data-kind="md"] { background: rgba(255,255,255,0.1); }` | **整条选择器删除**(K2 / §B.4 ②) | — |
| 15 | `:1899` | `.k-type-legacy` 的 `color: white` | `color: var(--text-on-accent)` | `:1184` |
| 16 | `:1972` | `.k-fd-error` 的 `background: rgba(255,59,48,0.07)` | `background: var(--danger-soft-faint)`(T2 已声明,本段是第二个使用点) | `:1268` |
| 17 | `:1973` | `.k-fd-error` 的 `border: 1px solid rgba(255,59,48,0.2)` | `border: 1px solid var(--danger-soft-border)`(两档已有) | `:1270` |

**13 行 / 17 处,逐行核过,一处不多一处不少;附录 B 表外的色字面量为 0 → 没有触发 `NEEDS_CONTEXT`。**

**3 处 `transparent` 照抄、不计入映射**(与 §B.2/§B.3 既定口径一致):
`:1748`(`.k-filt-input input` 的 `background: transparent` → 落地 `:1002`)·
`:1846`(`@keyframes row-done` 的 `100% { background: transparent; }` → 落地 `:1377`)·
`:1921`(`.k-rebuild-btn[disabled]` 的 `border-color: transparent` → 落地 `:1206`)。
三处都在代码里留了「关键字不是配色,照抄」的注释。

### 2.1 新声明的 token(1 个)

| token | 暗档(基础块) | 浅档 | 出处 | 落地行 |
|---|---|---|---|---|
| `--purple-soft` | `rgba(175, 82, 222, 0.18)` | `rgba(175, 82, 222, 0.1)` | `src/ai/styles/tokens.scss:310` / `:133` | `:174-181`(暗) / `:280-281`(浅) |

依 治理 §6.2 / 附录 B §B.1 归属表(F2 勘误裁定)。`--danger-soft-faint` 归 T2,已存在,**未重复声明**。
**除这 1 个之外没有新造任何 token。**

---

## 3. §B.4 两处并档的写法与注释

### ① `.k-status-badge[data-s="ok"]` 的前景色(蓝本 `:1857` + `:1862`)

- **落地**:`&[data-s="ok"] { background: var(--success-soft); color: var(--success); }`(`:1121`)
- **`:1862` 那条 `[data-theme="dark"]` 选择器整条删除**,New-UI 里没有任何残留。
- **代码注释**在 `:1115-1120`,原文含:「那条选择器在 **Vue2 与 New-UI 两边都不命中**(Vue2 只有
  `.agent-app` 带 `data-theme`;New-UI 的 `<html>` 只可能无属性或 `data-theme="light"`,从不置 `"dark"`),
  故**整条删除**,前景直接写 `var(--success)`」。**注释里没有出现任何被删的色字面量**(R5)。

### ② `.k-type-tag[data-kind="md"]` 的底色(蓝本 `:1892` + `:1895`)

- **落地**:`&[data-kind="md"] { background: var(--bg-chip); color: var(--text-primary); }`(`:1163-1170`)
- **`:1895` 那条 `[data-theme="dark"]` 选择器整条删除。**
- **代码注释**在 `:1164-1168`,口径同上,同样零色字面量。

自动核验:结构 diff(见 §6.2)对这两条各打出 `✅【K2 整条删除】`,
且 `grep -c 'data-theme="dark"' src/ai/styles/knowledge.scss` 在规则段落里 0 命中。

---

## 4. 六条「必须做到的」逐条回执

| # | 要求 | 回执 |
|---|---|---|
| 1 | K10 已在 T2 处理,本段**从 `:1705` 起**,`:1675-1703` 顶层重复段不搬,段头注释写明 | ✅ 段头注释 `:949-951` 明写「K10 已由 T2 处理:蓝本 `:1675-1703` 那个顶层重复段整段丢弃,本段**从 `:1705` 起**,不含它」。T2 那条 `K10 —— .k-confirm-* 每个类只有一份规则` 守卫仍绿(本任务没碰 confirm 类) |
| 2 | `@keyframes row-done` 放顶层全局 keyframes 区 | ✅ 落 `:1374-1378`,顶层;编译产物里是顶层 `@keyframes row-done`(`/tmp/p5b-t6-out.css:1850`)。落点判断的完整说明见 §1.3 |
| 3 | 两处 `[data-theme="dark"]` 按 §B.4 并进两档 + 代码注释 | ✅ 见 §3,两处各有注释、各自整条删除 |
| 4 | 色字面量按 §B.3 逐行映射(13 行 17 处),表外的停下问 | ✅ 见 §2,17/17 逐行核过;表外字面量 0 处,未触发 `NEEDS_CONTEXT` |
| 5 | **N11** —— `.k-file-detail` 的 `animation: fade-in` 照抄不改 + 守卫登记例外 | ✅ `:1233` 逐字照抄 `animation: fade-in 160ms ease;`;`:1227-1232` 写明理由(蓝本只有 `k-fade-in`,悬空 = 不播动画,改了就凭空多一个 Vue2 没有的淡入);守卫侧见 §5.4,含**反向确认**探针 |
| 6 | 落笔前 grep 重名,与 `agent-styles/settings-styles/skills-styles/sk-shared` 零重名 | ✅ 见 §8,53/53 零重名(并额外扫了 `mcp-styles.scss` / `popover.scss` / `tokens.scss` 与全仓其它 `*.scss/*.css/*.vue`,同样零重名) |

### 4.1 命中的 K/N 条目显式申报

- **K9**(整段从顶层裸选择器重新嵌套进 `.knowledge-app`)—— 命中,见 §1.2。
- **K2**(两处 `[data-theme="dark"]` 并进两档)—— 命中,见 §3。
- **K10** —— 由 T2 落地,本任务只承接边界(不搬 `:1675-1703`),见 §4-1。
- **N11**(悬空 `animation: fade-in` 照抄)—— 命中且**确实照抄**,见 §4-5 / §5.4。
- **附录 D.5 死规则** —— `:1500-1503` 的 `.k-frow` 在 S6 范围内(T2 已说明不搬),本段不含;
  程序化确认落地段内 `/\.k-frow(?![\w-])/` 零命中。
- **K17 / N9 / N10 / N13 / N12 / N14 / K18 / K15…** —— 均不落在 scss 任务范围内,本任务未触及。
- 本任务**没有任何 K1–K20 之外的偏离**。

---

## 5. `knowledgeStyles.test.ts` 的扩法

### 5.1 白名单 134 → 187

- 常量 `WHITELIST_134` → **`WHITELIST_187`**,4 处引用(定义 / 存在性断言 / 长度断言 / 「没有搬多」断言)全部连带改名;
  两处 `describe`/`it` 标题里的数字同步。
- 追加附录 §D.2 的 **53 个**,注释块写明来路。
- **独立复核(不采信附录)**:
  ```
  git show main:…/knowledge.scss | sed -n '1705,2022p' | grep -oE '\.k[a-zA-Z0-9-]+' | sort -u   → 54
  54 − k-btn(已在白名单,本段只是 `.k-filter-bar .k-btn` / `.k-pager .k-btn` 调高度)= 53
  与附录 D.2 双向 diff:两侧差集均为空 ✅
  ```
- **落地侧复核**:从落地段(剥注释后)抽 `.k…` 选择器 = **54 个 = 53 + k-btn**,
  与 D.2 双向差集为空;`.k-frow` 死规则零命中。

### 5.2 R2 token 两档断言 9 → 10

追加 `--purple-soft:`。`--danger-soft-faint` 已在 T2 那批里,不重复。

### 5.3 浅色档集合式覆盖断言 / `var()` 闭环守卫

两条都**自动**覆盖了 `--purple-soft`(RED 探针 3 已实证会精确指名)。
**例外清单未扩**(仍是那 11 个:9 结构量 + 2 品牌渐变);
`var()` 闭环守卫没有报「两档都找不到」,说明没有漏声明。

### 5.4 N11 的 keyframes 例外(**显式登记 + 注明理由**,不是关守卫)

```ts
const DANGLING_ANIMATION_EXCEPTIONS = ['fade-in']
```

三层设计,写在注释里:

1. **只跳过 `fade-in` 这一个字符串**,任何**别的**悬空引用照样报红(RED 探针 2:删 `row-done` → 精确报红)。
2. **新增一条正向用例**「N11 —— `.k-file-detail` 的悬空 animation 照抄蓝本 `:1941` 的 `fade-in`,
   没有被"顺手改成" `k-fade-in`」:取 `.k-file-detail` **块体**(避免被别处 `.k-modal-bg` 的
   `animation: k-fade-in` 撞对)后 `toContain('animation: fade-in 160ms ease')` +
   `not.toContain('k-fade-in')`,再 `expect(DANGLING_ANIMATION_EXCEPTIONS).toEqual(['fade-in'])`
   钉死清单不许变垃圾桶。**这两条互为对角**:改 scss 会红、删清单项也会红。
3. **反向确认**(RED 探针 4,见 §6.1):删掉真实存在的 `@keyframes k-fade-in` → 守卫**仍然报红**。

### 5.5 守卫缺口④ 的处置(T2 评审挂账)

**选了 A 路子:补一条覆盖非 `k*` 前缀嵌套类的登记表**,不是「写条注释登记缺口了事」。

理由(写在测试文件注释里):**实测零假阳性**。用 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/` 对剥注释后的
全文扫一遍,非 `k*` 标识符**恰好只有 9 个,全是真类名**:

```
ghost outline primary danger   ← .k-btn 四变体(蓝本 :822/:826/:836/:843)
right                          ← .k-modal-foot 内右对齐动作组(蓝本 :1340,T2 搬入)
suffix second                  ← .k2-layer-num 内单位后缀/第二数字(蓝本 :2320/:2321,P5a T11)
spin                           ← .k2-live-ico 旋转态(蓝本 :2364,P5a T11)
mono                           ← .k-fd-v 等宽变体(蓝本 :1957,**本任务搬入**)
```

CSS 里的小数(`0.5`)与时长(`1.4s`)点号后跟的是数字,被 `[a-zA-Z]` 挡掉;
`min()`/`repeat()`/`cubic-bezier()` 的参数里也没有「点 + 字母」的形式。
**噪音为 0 ⇒ 「会引入更多假阳性」这个不做的理由不成立**,所以做了。

落地两条用例:
- 「非 `k*` 前缀的嵌套辅助类全部在登记表内」(白名单式,报未登记项)
- 「登记表恰好等于文件里真实存在的非 `k*` 类,不多不少」(集合相等,防清单变垃圾桶)

**这同样是扩大扫描范围,不是放宽断言** —— 新扫到的类必须逐个登记并写出处。
🔴 附带效果:本任务引入的 `.mono` 恰好是这个缺口的**第二个**实例(`.right` 之后),
说明这个口径缺口是在真实增长的,不是假想。

---

## 6. RED 探针(4 条必做 + 3 条附加,每条都还原并核过 md5)

### 6.1 必做 4 条

**探针 1 —— 规则段落里塞 `#ff0000`(塞在 `.k-frow-zerohint` 里)**
```
 FAIL  src/ai/styles/knowledgeStyles.test.ts > … > token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
AssertionError: 声明层之外出现 #hex: expected '/* 1:1 移植自 Vue2 src/views/AI/Knowledg…' not to match /#[0-9a-fA-F]{3,8}\b/
      Tests  1 failed | 21 passed (22)
```

**探针 2 —— 删掉 `@keyframes row-done`**
```
 FAIL  … > animation 引用与 @keyframes 声明一一对应(评审 Minor M-3) > 每一个 animation: X 引用都有对应的 @keyframes X(N11 的 fade-in 是唯一登记例外)
AssertionError: 引用了但未声明的 @keyframes:row-done: expected [ 'row-done' ] to deeply equal []
```
—— **指名 `row-done`**。

**探针 3 —— 删掉浅色档的 `--purple-soft`**(三条同时报红,其中集合式那条精确指名)
```
 FAIL  … > R2 —— 10 个本档用到的 *-soft/-scrim/-hover token 两档都有值(…)
AssertionError: 浅色档缺 --purple-soft:: expected ':root[data-theme="light"] .knowledge-…' to contain '--purple-soft:'

 FAIL  … > 浅色档颜色 token 覆盖完整性(终审 ⚠️-D1,集合断言) > 暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名)
AssertionError: 浅色档漏声明的颜色 token(白名单外):--purple-soft: expected [ '--purple-soft' ] to deeply equal []

 FAIL  … > 例外清单当前恰好是这 11 个,不多不少(防止清单被悄悄扩大当垃圾桶)
AssertionError: expected [ '--font-mono', '--font-sans', …(10) ] to deeply equal [ '--font-mono', '--font-sans', …(9) ]
```

**探针 4 —— 🔴 反向确认:删掉真实存在的 `@keyframes k-fade-in`(被 `.k-modal-bg` 引用)**
```
 FAIL  … > 每一个 animation: X 引用都有对应的 @keyframes X(N11 的 fade-in 是唯一登记例外)
AssertionError: 引用了但未声明的 @keyframes:k-fade-in: expected [ 'k-fade-in' ] to deeply equal []
      Tests  1 failed | 21 passed (22)
```
—— **守卫仍然报红,并指名 `k-fade-in`**。证明登记的是「`fade-in` 这一个名字的例外」,
**不是把整条守卫放宽了**。还原后 22/22 全绿。

### 6.2 附加 3 条(自查用,同样已还原)

- **A** 把 N11 的 `fade-in` 「顺手改对」成 `k-fade-in` →
  `AssertionError: N11 被违反:.k-file-detail 的 animation-name 被改动了: expected '.k-file-detail {\n    padding: 12px 1…' to contain 'animation: fade-in 160ms ease'`
- **B** 塞一条未登记的非 `k*` 辅助类 `.k-ab-info .foo` → 缺口④ 两条用例同时报红:
  `未登记的非 k* 类(…):foo: expected [ 'foo' ] to deeply equal []` 与
  `expected [ 'danger', 'foo', 'ghost', …(7) ] to deeply equal [ 'danger', 'ghost', 'mono', …(6) ]`
- **C** 删掉一条新类规则 `.k-ftable` →
  `AssertionError: 缺失的类:k-ftable: expected [ 'k-ftable' ] to deeply equal []`

每条探针后都 `cp` 还原并 `md5sum` 比对(全部一致),`git status --short` 只剩本任务的两个 `M`。

### 6.3 结构 1:1 复核(不是探针,是自查工具)

把 `knowledge.scss` 用 `sass --style=expanded` 编译,取所有 `.knowledge-app <sel>` 规则,
与蓝本 `:1705-2022` 的 95 条规则逐条比选择器 + 声明体:

```
=== 蓝本规则 95 | 逐字相同 82 | 有差异 9 | 缺失 2 | K2 删除 2
```

- **有差异的 9 条**全部且仅仅是含色字面量映射的那 9 条规则(`[data-s=ok]` / `[data-s=error]` /
  `[data-kind=pdf|doc|md|txt|code]` / `.k-type-legacy` / `.k-fd-error`),逐条已在 §2 列出。
- **K2 删除 2 条** = `:1862` 与 `:1895`,脚本各打 `✅【K2 整条删除】`。
- **「缺失 2」是脚本自身的解析伪影**:蓝本段里的 `@keyframes row-done { 0% {…} 100% {…} }` 有嵌套
  花括号,朴素括号匹配会把 `100%` 与紧随的 `} .k-frow-status` 错切;两者在落地文件里都真实存在
  (`@keyframes row-done` 见 `/tmp/p5b-t6-out.css:1850-1856`、`.knowledge-app .k-frow-status` 见 `:1375`),
  已逐个人工确认。
- 另注:sass 会把 `[data-s="ok"]` 归一成 `[data-s=ok]`、`1 / -1` 归一成 `1/-1` —— 等价写法,
  与 P5a/T2 的既有产物同款,不是改动。

---

## 7. DoD 逐项

| DoD | 实测 |
|---|---|
| 三门全绿 | `pnpm test` **exit 0 / 316 文件 / 2966 例全绿**(基线 2963,**+3 例、+0 文件**,落在预期 +3~5 内)· `pnpm exec vue-tsc --noEmit` **exit 0** · `pnpm build` **exit 0** |
| `pnpm exec sass` 单独编译 | `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` → **exit 0** |
| 🔴 `pnpm build` 后 `grep k-frow-f dist/assets/*.css` 命中 | ✅ **`dist/assets/index-D6x9Kk2M.css:1`**(其余 viewer 分片 0,符合预期) |
| 规则段落色字面量 = 0(两个 token 声明块除外) | ✅ 用与守卫同款的「切掉两个声明块字符区间后全量扫」脚本跑过:hex/rgb/hsl/oklch/lab/lch/hwb/color()/8 个具名色 **全部 0 命中** |
| `theme-exception` 逃逸 = 0 | ✅ `grep -c theme-exception` → **0** |
| 白名单 187/187 | ✅ 「187 个白名单类全部有对应规则」+「白名单恰好 187 项(含去重断言)」+「没有搬多」三条全绿 |
| §B.3 13 行 17 处逐行核过 | ✅ §2 逐行表 |
| §B.4 两处并档各有代码注释 | ✅ §3 |
| 六条必须做到的逐条回执 | ✅ §4 |
| 守卫缺口④ 的处置 + 理由 | ✅ §5.5 |

### 7.1 新增的 3 个测试用例(+3 例的来源)

1. `守卫缺口④ —— 非 k* 前缀的嵌套辅助类全部在登记表内(.right/.mono 这类)`
2. `守卫缺口④ —— 登记表恰好等于文件里真实存在的非 k* 类,不多不少(防清单变垃圾桶)`
3. `N11 —— .k-file-detail 的悬空 animation 照抄蓝本 :1941 的 fade-in,没有被"顺手改对"成 k-fade-in`

`knowledgeStyles.test.ts` 单文件:19 → **22 例**。本任务不新增 `.vue`,所以 `color-guard` 动态用例数不变,
测试文件数不变(316)。

### 7.2 已知噪声

`src/files/upload/persist.test.ts > dropPersisted …` 与 `AgentComposer.test.ts` 的 vue-i18n teardown 竞态
**本轮均未复现**,全量一次通过,未复跑。

---

## 8. 重名 grep 结果

```bash
# 53 个新类 × { agent-styles.scss, settings-styles.scss, skills-styles.scss, sk-shared.scss }
→ 零命中
# 额外扫:mcp-styles.scss / popover.scss / tokens.scss
→ 零命中
# 额外扫:src/ 下全部 *.scss / *.css / *.vue(排除 src/ai/styles/)
→ 零命中
# knowledge.scss 现状(落笔前)
→ 只有 k-filt-clear / k-frow-f 各 1 处,均在 T2 与 P5a 写的**注释文字**里
  (`:463` 引用 `.k-filt-clear:hover(:1759)` 作对照、`:19/:865/:897-898` 解释 .k-frow 死规则),
  剥注释后为 0,不构成真实重名。
```

嵌套作用域串号复核(人肉 + 结构 diff 双保险):落地段内所有选择器都在 `.knowledge-app` 下**恰好一层**,
无三层以上缩进的裸类(`grep -nE '^\s{6,}\.'` 只命中一行注释文字);
编译产物里每条选择器的形状与蓝本逐条对齐(§6.3)。

---

## 9. 顺带修的一处版式问题(**无行为影响,显式申报**)

初稿把几条色映射注释写在了**父规则那一层、且夹在两条嵌套子规则之间**,
sass 会为这种注释单独吐一条**只含注释的空规则**(`.knowledge-app .k-status-badge { /* … */ }`)。
自查发现后,把这几条注释挪进了对应**子规则内部**(与 T2 在 `.k-row-status[data-state="failed"]` /
`.k-row-action[data-tone="danger"]:hover` 上的写法一致)。

改后编译产物里的空规则总数 **42 条,其中非「段头型」0 条** ——
那 42 条全是 `.knowledge-app { /* 段头注释 */ }` 形态,是 P5a/T2 既有的同款模式(段头注释写在
`.knowledge-app` 块内必然如此),本任务**没有新增**这一形态。生产构建的 CSS 压缩器会丢掉注释与空规则。

**这只是注释位置调整,不改任何声明、不改任何选择器**,结构 diff(§6.3)可证。

---

## 10. 用到的 fixture / mock

**无。** 本任务是纯 scss + 纯静态文本断言的样式任务,不接后端、不写组件测试,
`p5b-fixtures/` 一个文件都没用到,也没有任何 `service.*` mock。

---

## 11. 遗留疑问 / 交接项

1. **`@keyframes row-done` 的落点措辞**(§1.3):我按「顶层全局 keyframes 区、紧邻使用它的块」落地,
   而不是字面意义上的文件最后一行。**实质要求(顶层、不嵌套)已满足**,如需字面对齐可零风险挪动。
2. **守卫缺口④ 的登记表会随后续批次增长**:P5c/P5d 若搬入新的非 `k*` 辅助类,
   必须往 `NON_K_HELPER_CLASSES` 里加一条并写出处,否则那两条用例会报红(这正是设计意图)。
3. **`.k-empty-btn`(N10)与 `.k-status-badge-cn`(N13)**:蓝本 scss 里本就没有定义,
   本任务**没有**为它们凭空写规则,也**没有**加进白名单 —— 交给 T8/T9 在模板侧照抄类名并显式说明。
4. **`--teal-soft`** 至今无人使用,仍未声明(承 T11/T2 的口径:不声明用不到的 token)。
5. **T8–T10 消费提示**:本段的 53 个类全部就位;属性态选择器一律 `[data-x="值"]` 形式
   (`data-selected` / `data-status` / `data-done` / `data-s` / `data-kind` / `data-zero` /
   `data-open` / `data-active` / `data-on`),没有任何「属性存在性」裸形选择器,
   与附录 D.3 的清单逐项一致(已回蓝本 scss grep 复核)。
