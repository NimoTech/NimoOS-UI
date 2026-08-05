# P5f 附录 B —— 色值映射表(T0 产出,2026-08-06)

> 🔴 **实现者不许自选。本表里没有的一律 `NEEDS_CONTEXT`。**
> 口径(治理 §6):一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / `hsl()` / 具名色**
> (`white` / `black` 也算);`transparent` / `currentColor` 是关键字不算。
> 🔴 **注释里也不许出现色字面量**(E-60 的**色扫方向:不许剥注释**)。

## B.0 逐处实扫结果(**没有「0 处」是猜的**,承 E-11)

**扫描口径**:`#[0-9a-fA-F]{3,8}` · `rgba?\(` · `hsla?\(` · 具名色词表,**含注释**。

| 段 | 蓝本行段 | 真色字面量 |
|---|---|---|
| Allowlist A | `:985-1160` | **6 处**(`:1003` `:1045` `:1120`×2 `:1121`) |
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

| # | 蓝本坐标 | 原文 | 🔴 **落地** | 依据 |
|---|---|---|---|---|
| ① | `RootsView.vue:243`(`.kr-badge`) | `background: var(--bg-tertiary, rgba(127, 127, 127, 0.12));` | **`background: var(--bg-chip);`** | `--bg-tertiary` 全仓不存在 ⇒ 兜底**一直在生效**。`.kr-badge` 是 `border-radius: 999px` 的小药丸 —— **蓝本自己**对 999px 药丸底色的用法统计:`var(--bg-chip)` **8 次**居首;本仓同款统计 **7 次**居首 |
| ② | `RootsView.vue:254`(`.kr-input`) | `border: 1px solid var(--border, rgba(127, 127, 127, 0.25));` | **`border: 1px solid var(--line);`** | `--border` 不在本档映射层。**蓝本自己的同族表单控件 `.k-field select`(`:1350`,就在本期 `:1342-1400` 段内)写的就是 `border: 1px solid var(--line)`** —— 同页同族,零推测 |

🔴 **渲染语义论证(T2 报告要写)**:
- ① **兜底值原本一直在生效**(`--bg-tertiary` 全仓无声明)⇒ 改成 `--bg-chip` **是可见变化**,
  但这正是 K54 授权的内容(「rgba 一律禁止」),且 `--bg-chip` 是**蓝本自己**对同类元素的选择。
  ⚠️ **这一条与 K54 原文「兜底本是死代码」的论证不符** —— **T0 实测推翻了那个前提,已在报告 §9 显式申报。**
- ② `--border` 在**全局 `:root`** 有值 ⇒ `var(--border, …)` 里**兜底本来就是死代码**,
  改成 `--line` 是把它并进本档映射层的既定命名族。
- 🔴 **两个 token 都必须逐个证明两档都有值**:`--bg-chip` = `knowledge.scss:167`(暗 `#2A2A2C`)/ `:360`(亮 `var(--tool-bg-hi)`);
  `--line` = `:191`(暗 `#2E2E31`)/ `:401`(亮 `var(--card-border)`)。**两档都有 ✅**

🔴 **`--danger` / `--text-tertiary` / `--text-secondary` / `--text-primary` 这些无兜底的 `var()` 照抄不改**(K54-④)。

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
