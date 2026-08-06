# P5f 附录 B —— 色值映射表(T0 产出,2026-08-06)

> 🔴 **实现者不许自选。本表里没有的一律 `NEEDS_CONTEXT`。**
> 口径(治理 §6):一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / `hsl()` / 具名色**
> (`white` / `black` 也算);`transparent` / `currentColor` 是关键字不算。
> 🔴 **注释里也不许出现色字面量**(E-60 的**色扫方向:不许剥注释**)。

## B.0 逐处实扫结果(**没有「0 处」是猜的**,承 E-11)

**扫描口径**:`#[0-9a-fA-F]{3,8}` · `rgba?\(` · `hsla?\(` · 具名色词表,**含注释**。

| 段 | 蓝本行段 | 真色字面量 |
|---|---|---|
| Allowlist A | 🔴 **`:985-1141`**(段边界见附录 D §D.3.0) | 🔴 **5 处**(`:1003` `:1045` `:1120`×2 `:1121`)—— ~~6 处~~,见 §B.0.2 |
| Allowlist 弹窗 | `:1342-1400` | **3 处**(`:1392`×2 `:1393`) |
| **Wiki** | `:2453-2561` | 🔴 **0 处 —— 已实扫,不是猜的**(见 §B.0.1) |
| `RootsView` `<style scoped>` | `:223-289` | **2 处**(`:243` `:254`,均为 `var()` 兜底) |
| `AllowlistView` `<script>` 常量 | `:160,162,164` | **6 个 hex**(三个 `linear-gradient`) |
| `AllowlistView` 模板属性 | `:30` | **1 处具名色** `color="white"` |

### B.0.1 🔴 Wiki 段「0 处」的实扫证据(以及一个我差点误判的假阳性)

初次 grep 在 Wiki 段命中 **6 行**,逐行回读后**全部是 `white-space` 属性名的假阳性**:

```
:2468 .kw-node-name { white-space: nowrap; … }
:2480 .kw-actions .k-btn { white-space: nowrap; }
:2507 .kw-rawsrc  { … white-space: pre-wrap; … }
:2522 .kw-child-name { … white-space: nowrap; … }
:2523 .kw-child-sum  { … white-space: nowrap; … }
:2536 .kw-change-name { … white-space: nowrap; }
```

根因:`\bwhite\b` 在 `white-space` 里成立(`-` 是非单词字符 ⇒ 满足词边界)——
🔴 **正是 E-25「`\b` 假命中」的同族**。⇒ **Wiki 段真实色字面量 = 0 处**,
它整段已经是 `var(--ly-wiki)` / `var(--line-faint)` / `var(--text-*)` 一族,**逐字照抄即可**。

⚠️ **T2 的色扫守卫别用 `\bwhite\b`** —— 要用「具名色作为**属性值**出现」的形态,否则每个
`white-space` 都会报红。

### 🔴 B.0.2 订正块(T0b · 裁定 §三 **M-1**)—— A 段是 **5 处**不是 6 处

**原缺陷**:§B.0 表头把 Allowlist A 段记成「6 处」,但**它自己列出的行号只有 5 个**
(`:1003` `:1045` `:1120`×2 `:1121`)—— **标题与内容自相矛盾**,是算错了。

🔴 **T0b 自扫复核(口径 `#[0-9a-fA-F]{3,8}` / `rgba?\(` / `hsla?\(` / 具名色词表,含注释;
完整输出见 `p5f-task-0b-report.md` §6)**:

```
=== AllowlistA :985-1141(订正后段边界)===
  :1003  white
  :1035  transparent          ← CSS 关键字,不算(本附录抬头口径)
  :1045  white
  :1112  [假阳性]white         ← white-space,不算(§B.0.1)
  :1120  #1f9c47  rgba(
  :1121  rgba(
  >>> 真色字面量 = 5 ✅
=== AllowlistModal :1342-1400 → 3 ✅   === Wiki :2453-2561 → 0 ✅(6 行全是 white-space 假阳性)
```

⚠️ **段边界从 `:985-1160` 收窄到 `:985-1141` 不改变这个数** —— 5 处全部落在 `:1121` 之前。

🔴 **T2 仍要自己实扫一遍**(不许采信 T0 / 评审 / T0b 任何一方的数)。
🔴 **实扫时禁用 `\bwhite\b`**(裁定 **R11**,常驻)—— 用「具名色作为**属性值**出现」的形态,
否则每个 `white-space` 都会报红。**§B.3 + §B.4 合起来覆盖全部 8 处(A 段 5 + 弹窗 3),无遗漏。**

## B.1 🔴 K55 —— `GROUPS_TEMPLATE` 三个 `linear-gradient`(**定死,不许自选**)

**为什么必须处理**:`color-guard` **压根不扫 `.ts` / `.vue` 的 `<script>` 常量**
(cross-area §1 票 B 位置④,变异实测「注释注入 hex 全量全绿」)⇒ **裸奔**。
**模具 = P5d 的 K40(`NOTE_TYPES` 四个渐变)第二次。**

| # | 蓝本坐标 | 字面量 | 🔴 **落地 token(定死)** | 新建? |
|---|---|---|---|---|
| ① | `AllowlistView.vue:160` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | **`--grad-ext-docs`** | 🆕 新建 |
| ② | `AllowlistView.vue:162` | `linear-gradient(135deg, #5DD68A, #2EB05B)` | **`--grad-ext-text`** | 🆕 新建 |
| ③ | `AllowlistView.vue:164` | `linear-gradient(135deg, #C18CFF, #AF52DE)` | **`--grad-ext-code`** | 🆕 新建 |

**两档取值(🔴 品牌渐变,两档同值 —— 与既有 `--grad-note-*` 同款)**:

```scss
/* 暗档 .knowledge-app 与亮档 [data-theme="light"] .knowledge-app 两处都写同一份 */
--grad-ext-docs: linear-gradient(135deg, #5AC8FA, #007AFF); /* AllowlistView.vue:160 */
--grad-ext-text: linear-gradient(135deg, #5DD68A, #2EB05B); /* AllowlistView.vue:162 */
--grad-ext-code: linear-gradient(135deg, #C18CFF, #AF52DE); /* AllowlistView.vue:164 */
```

🔴 **为什么另建新名而不复用 `--grad-note-note`**:①的值与既有 `--grad-note-note`
(`knowledge.scss:291`)与 `--grad-sandbox`(`:274`)**逐字同值**,但 P5d 立的规矩就是
**「同值也另建新名」**(`:291` 行尾注释原文:「与既有 `--grad-sandbox` 逐字同值(仍另建新名,理由见上)」)
—— 语义属主不同,将来 Notes 改色不该连带改掉白名单页。**照同一份。**

**常量里只留引用**:
```ts
{ id: 'docs', labelKey: 'Documents', icon: 'file', bg: 'var(--grad-ext-docs)', match: … }
```

🔴 **必须补 K40 同款定向断言**(照 `knowledgeStyles.test.ts` 里 P5d-T3 的 `NOTE_TYPES` 断言形态):
钉「这三个 `bg` 只含 `var(--…)`、零 hex/rgb/具名色」·**判据:注入一个 hex → 必须报红**。

## B.2 🔴 K54 —— `kr-*` 的两处 `var()` 兜底(**实测结论:两个名字都不该直接用**)

### B.2.1 实测:`--bg-tertiary` / `--border` 在 `.knowledge-app` 映射层里存在吗?

| token 名 | `.knowledge-app` 映射层(`knowledge.scss`) | 全局 `:root`(`theme.css`) | 结论 |
|---|---|---|---|
| `--bg-tertiary` | 🔴 **0 处声明** | 🔴 **0 处声明** | ❌ **全仓不存在** |
| `--border` | 🔴 **0 处声明** | ✅ `:52`(暗 `rgba(255,255,255,0.14)`)/ `:267`(亮 `#e7e3d9`) | ⚠️ **存在于全局层,但不在本档映射层** |

⇒ 🔴 **两处都按「映射到语义最近的既有 token」处理,不许新建、不许保留兜底。**

### B.2.2 落地(定死)

| # | 蓝本坐标 | 原文 | 🔴 **落地** | 🔴 **首要依据(T0b 补,裁定 R8)** | 次要依据(T0 原写) |
|---|---|---|---|---|---|
| ① | `RootsView.vue:243`(`.kr-badge`) | `background: var(--bg-tertiary, rgba(127, 127, 127, 0.12));` | **`background: var(--bg-chip);`** | 🔴 **本仓既定先例 `knowledge.scss:2057-2090`(P5c-T2a · FolderBrowser)对同一对 token 的同款兜底处置** —— 见 §B.2.3 | `.kr-badge` 是 `border-radius: 999px` 的小药丸;**蓝本自己**对 999px 药丸底色的统计 `var(--bg-chip)` **8 次**居首,本仓同款 **7 次**居首 |
| ② | `RootsView.vue:254`(`.kr-input`) | `border: 1px solid var(--border, rgba(127, 127, 127, 0.25));` | **`border: 1px solid var(--line);`** | 🔴 **改引同一条先例 §B.2.3** —— 先例对**逐字同款**的 `var(--border, rgba(127,127,127,0.25))` 落的就是 `var(--line)`(比引 `.k-field select` 硬) | 蓝本同族表单控件 `.k-field select`(`:1350`,在本期 `:1342-1400` 段内)写的是 `border: 1px solid var(--line)` |

### 🔴🔴 B.2.3 本仓既定先例(T0b 补 · 裁定 **R8-1**)—— `knowledge.scss:2057-2090`(P5c-T2a · FolderBrowser)

🔴 **坐标由 T0b 现测**(`grep -n -- "--bg-tertiary" src/ai/styles/knowledge.scss` + 逐行回读 `:2050-2095`;
输出见 `p5f-task-0b-report.md` §5)。**这是本仓处理过的、同一对 token 的同款兜底**,
比「999px 药丸统计」和「`.k-field select`」都硬 —— **它是一致性依据,不是类比。**

**先例原文(本仓 `knowledge.scss`)**:

```
:2057-2072  /* ---------- P5c-T2a · FolderBrowser(蓝本 FolderBrowser.vue:82-143)----------
   ① `var(--border, 回退值)` / `var(--bg-tertiary, 回退值)`(蓝本 :85 / :95 / :96)——
      这两个 token 在 Vue2 的 src/ 下零声明,真实渲染的就是回退值 → 不保留这层壳,
      按回退值的语义直接映射到本档 token */
:2076   蓝本 :85  var(--border,      rgba(127,127,127,0.25))  →  var(--line)
:2087   蓝本 :95  var(--border,      rgba(127,127,127,0.18))  →  var(--line-faint)
:2089   蓝本 :96  var(--bg-tertiary, rgba(127,127,127,0.06))  →  var(--bg-sunken)
```

**本期与先例的对照**:

| 本期 | 蓝本原文 | 先例同款? | 落地 |
|---|---|---|---|
| `RootsView:254` | `var(--border, rgba(127,127,127,**0.25**))` | 🟢 **与先例 `:2076` 逐字同款**(同 token、同 alpha) | **`var(--line)`** —— 抄先例 |
| `RootsView:243` | `var(--bg-tertiary, rgba(127,127,127,**0.12**))` | 🟡 同 token、**alpha 更大**(0.12 > 先例的 0.06) | **`var(--bg-chip)`** —— 见下 alpha 保序论证 |

#### 🔴 B.2.3.1 alpha 保序论证(**必须写进 T2 报告**)

**中性灰(`rgba(127,127,127,α)`)叠在暗底上,α 越大越亮。** 先例自己就是靠这个**保序**的:
`:2076` 的 **0.25** → `--line`,`:2087` 的 **0.18** → `--line-faint`(**更淡的一档**),**大小关系被保住**。

本处 **0.12 > 先例 `:2089` 的 0.06** ⇒ 应取**比 `--bg-sunken` 更亮一档**的背景 token。
**T0b 现测两档值**(`grep -nE '^\s*--(bg-chip|bg-sunken|line|line-faint):' src/ai/styles/knowledge.scss`):

| token | 暗档 | 亮档 | 相对亮度 |
|---|---|---|---|
| `--bg-sunken` | `:166` `#161617` | `:359` `var(--tool-bg)` | **更暗** |
| **`--bg-chip`** | `:167` **`#2A2A2C`** | `:360` **`var(--tool-bg-hi)`** | 🟢 **更亮一档** ✅ |
| `--line` | `:191` `#2E2E31` | `:401` `var(--card-border)` | — |
| `--line-faint` | `:193` `#262628` | `:403` `#EEEBE3` | — |

⇒ 🔴 **取 `--bg-chip`,与先例用 `--line`/`--line-faint` 拉开 `0.25`/`0.18` 是同一个做法。四个值两档齐全 ✅**

#### 🔴🔴 B.2.3.2 承 **E-73**:这一处是**可见变化**,不是等价替换

🔴 **T0b 实测(两侧都测了)**:

```
$ grep -rn -- "--bg-tertiary" src/            # 本仓
src/ai/styles/knowledge.scss:2064   ← 注释
src/ai/styles/knowledge.scss:2088   ← 注释
⇒ 本仓零声明

$ git -C ../../NimoOS-UI grep -nE "^\s*--bg-tertiary\s*:" 7a6ee6b7 -- src/
(空) ⇒ 🔴 蓝本(Vue2)也零声明

$ git -C ../../NimoOS-UI grep -nE "^\s*--border\s*:" 7a6ee6b7 -- src/
(空) ⇒ 蓝本零声明;而本仓 theme.css:52(暗)/ :267(亮)有声明
```

⇒ **`--bg-tertiary` 两侧都零声明 ⇒ 兜底 `rgba(127,127,127,0.12)` 一直在生效,是蓝本真实渲染出来的颜色。**
⇒ 🔴 **换成 `var(--bg-chip)` 会让 `.kr-badge` 的底色变** —— **这是可见变化,不是等价替换。**

🔴🔴 **T2 不许引治理 K54-③ 那句「兜底本是死代码」当论证**(勘误 **E-73**):
那句**对 `--border` 成立**(本仓 `theme.css` 有声明 ⇒ 兜底确实是死代码),
**对 `--bg-tertiary` 不成立**(全仓零声明 ⇒ 兜底一直在生效)。**照抄那句 = 论证前提是假的。**

🔴 **T2 报告必须如实写成**:「这是 K2 主题映射层的**既定后果**,是**可见变化**;
授权来自 K54(rgba 一律禁止)+ 裁定 **R8**;取值依据是本仓 `knowledge.scss:2057-2090` 的既定先例 + alpha 保序。」

🔴 **验收清单加一条**:

> 「索引根页那个小徽标(实时监视 / 仅定时扫描)的底色采用本仓 chip 语义 token,
> 与蓝本的中性灰 12% **不完全同值** —— 这是 K2 主题映射层的既定后果,请顺带看一眼。」

🔴 **渲染语义论证(T2 报告要写)**:
- ① **兜底值原本一直在生效**(`--bg-tertiary` 全仓无声明)⇒ 改成 `--bg-chip` **是可见变化**,
  但这正是 K54 授权的内容(「rgba 一律禁止」),且 `--bg-chip` 是**蓝本自己**对同类元素的选择。
  ⚠️ **这一条与 K54 原文「兜底本是死代码」的论证不符** —— **T0 实测推翻了那个前提,已在报告 §9 显式申报。**
- ② `--border` 在**全局 `:root`** 有值 ⇒ `var(--border, …)` 里**兜底本来就是死代码**,
  改成 `--line` 是把它并进本档映射层的既定命名族。
- 🔴 **两个 token 都必须逐个证明两档都有值**:`--bg-chip` = `knowledge.scss:167`(暗 `#2A2A2C`)/ `:360`(亮 `var(--tool-bg-hi)`);
  `--line` = `:191`(暗 `#2E2E31`)/ `:401`(亮 `var(--card-border)`)。**两档都有 ✅**

🔴 **`--danger` / `--text-tertiary` / `--text-secondary` / `--text-primary` 这些无兜底的 `var()` 照抄不改**(K54-④)。

## 🔴 B.2.4 `kr-path` / `kr-input` 的字体栈:**照抄蓝本原文**(T0b 补 · 裁定 §三 **M-6**)

**T0b 现测蓝本 `RootsView.vue`**:

```
:235  .kr-path  { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; … }
:259  .kr-input { … font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
```

| 处 | 蓝本坐标 | 🔴 **落地** |
|---|---|---|
| `.kr-path` | `RootsView.vue:235` | **`font-family: ui-monospace, SFMono-Regular, Menlo, monospace;`** —— **逐字照抄** |
| `.kr-input` | `RootsView.vue:259` | **同上,逐字照抄** |

**理由**:①**字体栈不是颜色**,不在本仓「一切可见颜色必须是 token」的约束范围内,`color-guard` 也不扫它;
②本期纪律是「界面严格 1:1 · 照抄老样子」。

⚠️ **蓝本自己不一致(这才是要申报的原因)**:**同期段内**的 `.k-field-mono input`
(蓝本 `knowledge.scss:1365`,就在本期 `:1342-1396` 弹窗段里)用的是 **`font-family: var(--font-mono)`**
—— T0b 现测原文 `.k-field-mono input { font-family: var(--font-mono); font-size: 12.5px; }`;
同段 `:1367` 的 `.k-field-hint code` 也用 `var(--font-mono)`。
⇒ **同一次迁移里会同时出现「硬编码字体栈」和「`var(--font-mono)`」两种写法**,而两种都是照抄。

🔴🔴 **T2 必须在报告里显式申报这两处** —— **不申报,下一道评审会把它当成「漏 token 化」而打回。**
申报原文照这个意思写:「`kr-path:235` / `kr-input:259` 的字体栈**照抄蓝本硬编码值**;
同段 `.k-field-mono:1365` 照抄的是 `var(--font-mono)`。**两者的差异来自蓝本自身不一致,不是本刀的取舍**;
字体栈非颜色 token 约束范围(裁定 §三 M-6)。」

⚠️ **不许「顺手统一」成 `var(--font-mono)`** —— 那是改蓝本行为,且是未申报的偏离(=缺陷)。

## B.3 🔴 `color="white"` / `color: white` 三处具名色(**定死**)

| # | 处 | 压在什么底上 | 🔴 **落地 token** |
|---|---|---|---|
| ① | **`AllowlistView.vue:30`** `<KIcon … color="white"/>` | `.k-ext-chip-mark` 在 `[data-on="true"]` 下是 `background: var(--accent)` **实底**(蓝本 `:1043`) | **`var(--text-on-accent)`** |
| ② | `knowledge.scss:1003`(`.k-extgroup-icon`)`color: white` | **`g.bg` 的品牌渐变实底**(B.1 的三个) | **`var(--text-on-accent)`** |
| ③ | `knowledge.scss:1045`(`&[data-on="true"] .k-ext-chip-mark`)`color: white` | `var(--accent)` 实底 | **`var(--text-on-accent)`** |

### 🔴 B.3.1 为什么是 `--text-on-accent` 而**不是** `--on-accent`(记忆那条警告的精确落点)

| token | 暗档 | 亮档 | 能用吗 |
|---|---|---|---|
| `--on-accent`(`theme.css:48`/`:186`) | **`#16203a`(深蓝黑)** | `#ffffff` | 🔴 **不能** —— 暗档是**深色**,压在品牌渐变/accent 实底上会变成「深色图标压深底」 |
| **`--text-on-accent`**(`knowledge.scss:177`/`:370`) | **`#ffffff`** | `var(--on-accent)` = `#ffffff` | ✅ **两档都是白**,正是「压在实底上的纯白前景」语义 |

🔴 **记忆「`--on-accent` 只在 accent 实底上可用」在本仓的准确形态是**:
`--on-accent` 是**全局层**的「accent 上的对比色」,它在暗档是深色(因为暗档 accent `#8ab4ff` 是亮蓝);
而本档要的是**恒白**。**既定先例**:`knowledge.scss:2181-2183` 的 `.kn-inbox-icon`
(`background: var(--grad-note-insight); color: var(--text-on-accent);`)+ `:2144` 的行内注释原文
**「压在渐变实底上的纯白字」** ⇒ **本期三处照同一份,零发明。**

## B.4 三个段内其余色字面量(全部有既定桶,零新建)

| # | 蓝本坐标 | 字面量 | 落地 token | 依据 |
|---|---|---|---|---|
| 1 | `:1120`(`.k-frow-action[data-act="allow"]`) | `rgba(52, 199, 89, 0.12)` | `var(--success-soft)` | p5a §B.2 桶:`rgba(52,199,89,0.1x)` → `--success-soft` |
| 2 | `:1120` 同行 | `#1f9c47` | `var(--success)` | p5a §B.2 桶:`#1f9c47` → `--success` |
| 3 | `:1121`(`[data-act="deny"]`) | `rgba(255, 59, 48, 0.12)` | `var(--danger-soft)` | p5a §B.2 桶:`rgba(255,59,48,0.1x)` → `--danger-soft`(`color: var(--danger)` 已是 token,照抄) |
| 4 | `:1392`(`.k-radio-card-icon[data-tone="allow"]`) | `rgba(52, 199, 89, 0.14)` | `var(--success-soft)` | 同 1(`0.14` 落 `0.1x` 桶) |
| 5 | `:1392` 同行 | `#1f9c47` | `var(--success)` | 同 2 |
| 6 | `:1393`(`[data-tone="deny"]`) | `rgba(255, 59, 48, 0.12)` | `var(--danger-soft)` | 同 3 |

🔴 **这 6 处全部命中 P5a 就立好的既定桶**(`p5a-appendix-B-tokens.md:72-77`),
**且 `.k-rel[data-level]`(P5e-T2,本仓 `knowledge.scss:928`)已用同一组 token 落地过** ⇒ **零新建 token,零裁量。**

**两档取值自证**:`--success-soft` = `:234`(暗)/ `:420`(亮)· `--danger-soft` = `:235` / `:421` ·
`--success` / `--danger` 见 `theme.css`。**四个都两档有值 ✅**

## B.5 模板 `style=` / `:style=` / `color=` 逐处记数(🔴 **不许写 0**)

| 文件 | 处数 | 逐处 |
|---|---|---|
| `AllowlistView.vue` | **6** | `:14` `:style="{background: g.bg}"`(**K55**)· `:30` `color="white"`(🔴 **具名色**,B.3-①)· `:37` `:60` `:65` `:85` `:138` 纯尺寸/排版 |
| `RootsView.vue` | **5** | `:15` `color="var(--text-tertiary)"`(✅ 已是 token,**照抄**)· `:9` `:21` `:53` `:58` `:73` `:100` 纯尺寸 |
| `WikiView.vue` | **8** | `:59` `--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)`(✅ **两档都有值,照抄**)· `:7` `:22` `:69` `:70` `:71` `:72` `:73` 纯尺寸 |

⚠️ 协调者原表把 `AllowlistView` 记成 6 处、`RootsView` 记成 5 处但列了 6 个行号、`WikiView` 记成 8 处但列了 4 组
—— **本表以实读蓝本为准**;差异仅在「怎么数一行里的多个属性」,**无功能影响**。

### 🔴🔴 B.5.1 订正块(T7,2026-08-06)—— **上表三行的数字全部作废**

> 🔴 守「反转不删」:上表原文一律保留;本块只登记「哪些数字作废、以谁为准」。
> 🔴 引条目编号(**R24 / R26-2 / R27**),不引 `file:line`。

**上表这一张已经连错三行**,分别由三刀的实现者实测发现、协调者逐条采纳:

| 行 | 上表原写 | 🔴 **终值** | 谁测出的 / 依据 |
|---|---|---|---|
| `AllowlistView.vue` | 6 | 🔴 **8**(漏 `:143`) | T4 评审 · 裁定 **R24** Minor M-2 |
| `RootsView.vue` | 5(却列了 6 个行号,自相矛盾) | 🔴 **7** | T5 实测 · 裁定 **R24** M-2 / **R27** 末段 |
| `WikiView.vue` | 8(漏 `:12`) | 🔴 **9** | T5 实测 · 裁定 **R26-2**;**R27 末段定案**:行 `7·12·22·59·69·70·71·72·73` = `style=`×8 + `:style=`×1,`color=` **0** |

🔴 **T7 现测复核(2026-08-06,本仓 `src/ai/knowledge/views/WikiView.vue` 移植完成后)**:

```
$ grep -c 'style=\|:style=\|color=' src/ai/knowledge/views/WikiView.vue      → 9
逐处(本仓行号):
  :557 style="display: block; height: 22px; margin: 6px 8px"        ← 蓝本 :7
  :565 style="margin-top: 8px"(重试按钮)                            ← 蓝本 :12
  :579 :style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"          ← 蓝本 :22(唯一的 `:style=`)
  :633 style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"  ← 蓝本 :59(✅ 两档都有值,照抄)
  :646 style="margin-top: 18px; display: flex; …"                    ← 蓝本 :69
  :648 :649 :650 :651  四条 k-skel 的纯尺寸                           ← 蓝本 :70-73
`color=` 命中 **0 处**。
```
⇒ **9 处,与 R27 的定案逐处对齐**;🔴 **T7 的下半(蓝本 `:83-141`)一处都没新增** ——
下半只有 class 与 `data-*`,零内联样式、零 `color=`。**上表「8」这个数字正式作废。**

### 🔴 B.5.1 订正块(**T5 顺手做,依裁定 R24**)—— 守「反转不删」,上表原文一律保留

裁定 **R24** 末段点名:「§B.5 的『模板 6 处 `style=`/`color=`』应订正为 **8 处**(漏 `:143`;
`RootsView` 那行也不自洽)」。T5 **自己数了两遍**(R21:凡推翻既有文档必须换一条独立口径复证
并贴两条原始输出),结论如下 —— 🔴 **`WikiView` 那一行也是错的**(协调者未点,T5 实测发现)。

| 文件 | 上表原写 | 🔴 **实测终值** | 上表漏掉的行 |
|---|---|---|---|
| `AllowlistView.vue` | 6 | 🔴 **8** | **`:143`**(`<div class="right" style="margin-left: auto">`) |
| `RootsView.vue` | 5(却列了 7 个行号) | 🔴 **7** | 无漏行,**只是数字与自己列的行号不自洽** |
| `WikiView.vue` | 8(却列了 8 个行号) | 🔴 **9** | **`:12`**(`<button class="k-btn outline" style="margin-top:8px" …>`) |

**两条独立口径的原始输出**(都只截蓝本 `<template>` 区间,`git -C ../../NimoOS-UI show 7a6ee6b7:`):

```
===== 口径 1:awk 截到 </template> 为止,列「含 style= / color= 的行号」=====
AllowlistView : 14 30 37 60 65 85 138 143          (8)
RootsView     : 9 15 21 53 58 73 100               (7)
WikiView      : 7 12 22 59 69 70 71 72 73          (9)

===== 口径 2(独立实现):python 只截 <template>…</template>,按**属性出现次数**数 =====
AllowlistView   属性出现次数=8  所在行数=8  行号=[14, 30, 37, 60, 65, 85, 138, 143]
RootsView       属性出现次数=7  所在行数=7  行号=[9, 15, 21, 53, 58, 73, 100]
WikiView        属性出现次数=9  所在行数=9  行号=[7, 12, 22, 59, 69, 70, 71, 72, 73]
```

🔴 **两条口径逐行完全一致**,且「属性出现次数 = 所在行数」⇒ **本期三个模板里没有一行带两个
`style=`/`color=` 属性**,上表那句「差异仅在怎么数一行里的多个属性」**在本期不成立**——
真因就是**漏了行**(`AllowlistView:143` / `WikiView:12`)与**数字写错**(`RootsView`)。

⚠️ **零功能影响**:新增的三行都是**纯尺寸/排版**(`margin-left: auto` / `margin-top:8px`),
不含任何色字面量 ⇒ §B.3 的色映射结论、`--text-on-accent` 的三处落点、
「模板内零裸色」的守卫全部不受影响。🔴 **T7 写 `WikiView` 时按 9 处核,别按 8 处。**

🔴 **`WikiView:59` 的 `--ly-wiki` / `--ly-wiki-soft` 两档取值已核**:`knowledge.scss:198`(暗)/ `:405`(亮),**都有值**。

## B.6 🔴 本期新建 token 总账

| token | 暗档 | 亮档 | 声明处注释要写 |
|---|---|---|---|
| `--grad-ext-docs` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | **同值** | `AllowlistView.vue:160` |
| `--grad-ext-text` | `linear-gradient(135deg, #5DD68A, #2EB05B)` | **同值** | `AllowlistView.vue:162` |
| `--grad-ext-code` | `linear-gradient(135deg, #C18CFF, #AF52DE)` | **同值** | `AllowlistView.vue:164` |

🔴 **只有这 3 个。其余一律复用既有 token。本表以外的任何新建 → `NEEDS_CONTEXT`。**
🔴 **两档都要显式写值**(即使同值也各写一份,承 K39/K40 既定做法)。
⚠️ **声明处注释里不许出现色字面量以外的解释性色名**(「蓝→深蓝」这种也别写,E-60 色扫不剥注释)。
—— **正确写法**:`/* AllowlistView.vue:160 · 附录 B §B.1-① */`
