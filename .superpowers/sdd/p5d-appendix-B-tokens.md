# P5d 附录 B —— 色值映射表(**权威**,T0 产出)

**T0 实测于 2026-08-04** · 蓝本 `NimoOS-UI`@`7a6ee6b7` · 现状文件 `src/ai/styles/knowledge.scss`(1991 行)

> 🔴 **表里没有的一律 `NEEDS_CONTEXT`,实现者不许自己发明 token、不许自己选 token。**
> 🔴 **注释里也不许出现色字面量**(R5)——写「蓝本 `file:line` + 中文描述颜色」。

## §B.0 普查(**26 行 / 39 处**,与治理 §6.1 的总数逐字一致 ✅)

| 来源 | 段行数 | 含字面量行 / 处数 | 复核 |
|---|---|---|---|
| `knowledge.scss:2023-2046`(A 共享徽标/图标底座) | 24 | **4 / 7** | ✅ 与治理一致 |
| `knowledge.scss:2047-2056`(B path strip) | 10 | 0 / 0 | ✅ |
| `knowledge.scss:2057-2085`(C draft inbox) | 29 | **6 / 10** | ✅ |
| `knowledge.scss:2086-2121`(D notes list) | 36 | **3 / 3** | ✅ |
| `knowledge.scss:2122-2194`(E edit pane,含 `:2171-2182` ProseMirror) | 73 | **2 / 3** | ✅ |
| `knowledge.scss:2195-2241`(F edit aside) | 47 | 0 / 0 | ✅ |
| `knowledge.scss:2242-2249`(G conflict modal) | 8 | **2 / 2** | ✅ |
| `knowledge.scss:2265-2281`(H responsive) | 17 | 0 / 0 | ✅ |
| `knowledge.scss:551-571`(K43 `.k-seg`) | 21 | 0 / 0 | ✅ |
| `NotesMarkdownEditor.vue:40-46`(K44) | 7 | **3 / 4** | ✅ |
| `notesViewHelpers.js:6-9` 的 `NOTE_TYPES[*].color`(**JS**,K40) | 4 | **4 / 8** | ✅ |
| **模板 `style=` / `:style=` / `color=`** | — | 🔴 **2 / 2** | ✅ 见 §B.4 |
| **合计** | | 🔴 **26 行 / 39 处** | ✅ |

### 🔴 B.0.1 其中 **6 处已经映射过了**(P5b-T2 搬 `.kn-badge` 时)—— 本期实际只映 **33 处**

`knowledge.scss:2036 / :2038 / :2039` 三行共 6 处(橙/绿/红的底色 + 边框)属于 `.kn-badge`,
**P5b-T2 已搬到 New-UI `knowledge.scss:1602-1607`**,映射为
`--warning-soft` / `--warning-soft-border` / `--success-soft` / `--success-soft-border` /
`--danger-soft` / `--danger-soft-border`。
🔴 **本期不许重复定义 `.kn-badge`**(现状文件 `:1615` 的注释已经写明这一点),普查表里保留这 6 处只是为了
让总数与治理 §6.1 对得上;**A 段本期真正要搬的只有 `:2029`(`.k-badge[data-tone="warn"]`)+
`.kn-type-ic` / `.kn-src` / `.kn-tag`**,其色字面量只有 `:2042` 的 1 处。

### B.0.2 `transparent` 关键字(**不算色字面量,照抄**)

`knowledge.scss:2060` 渐变末段 `transparent` · `:2184` `background: transparent`(实测 2 处,与治理一致)。

---

## §B.1 新 token(**9 个**,两档都必须显式写值,声明处注释必须写蓝本 `file:line`)

🔴 **K39 的诚实登记(不许照抄 P5c §6.3 那句「4/4 都有出处」)**:本期 4 个笔记类型渐变里
**只有 1 个**(`#5AC8FA,#007AFF`)与仓内既有 `--grad-sandbox` 逐字同值;
**另 3 个渐变全仓零同值先例**,值直接来自蓝本设计包 —— 蓝本就是权威源,但每处都要注释标明出处。

| # | token | 暗档值(基础块) | 浅档值(`:root[data-theme="light"] …`) | 用在(蓝本) | 值的出处 / 判据 |
|---|---|---|---|---|---|
| 1 | `--grad-note-note` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | 同左(theme-invariant) | `notesViewHelpers.js:6` `NOTE_TYPES.note.color` | 🔴 **与既有 `--grad-sandbox`(`knowledge.scss:242`/`:336`)逐字同值** —— 仍另建新名,理由同 P5c 给 `--grad-sk-blue` 改名 `--grad-sandbox`:`sandbox` 是测试沙盒语义,笔记类型借它的名字会误导。**声明处注释要写明这一字节相同的事实** |
| 2 | `--grad-note-summary` | `linear-gradient(135deg, #30B0C7, #34C759)` | 同左 | `notesViewHelpers.js:7` | **全仓零同值先例**,来自蓝本设计包。⚠️ 起点色 `#30B0C7` 恰等于既有 `--teal`,终点色 `#34C759` 无 token |
| 3 | `--grad-note-insight` | `linear-gradient(135deg, #FF9500, #FFCC00)` | 同左 | `notesViewHelpers.js:8` **与** `knowledge.scss:2066`(`.kn-inbox-icon` 底色) | **全仓零同值先例**。🔴 **一个 token 两个消费方,只许声明一份**(K39 明令) |
| 4 | `--grad-note-digest` | `linear-gradient(135deg, #AF52DE, #FF2D55)` | 同左 | `notesViewHelpers.js:9` | **全仓零同值先例**。⚠️ 两个端点色恰等于既有 `--purple` / `--pink`,但**渐变本身**无 token |
| 5 | `--grad-inbox-wash` | `linear-gradient(160deg, rgba(255, 149, 0, 0.07), rgba(255, 204, 0, 0.04) 55%, transparent)` | 同左 | `knowledge.scss:2060`(`.kn-inbox` 底色第一层) | 蓝本原值。**保留蓝本色相**,理由见 §B.1.1 |
| 6 | `--grad-draftbar-wash` | `linear-gradient(135deg, rgba(255, 149, 0, 0.09), rgba(255, 204, 0, 0.04))` | 同左 | `knowledge.scss:2132`(`.kn-draftbar` 底色) | 同上 |
| 7 | `--shadow-warning-glow` | `0 3px 8px rgba(224, 165, 59, 0.3)` | `0 3px 8px rgba(200, 134, 10, 0.24)` | `knowledge.scss:2067`(`.kn-inbox-icon` 橙色外发光) | **A-9/A11 同族**:RGB 三元组取本仓 `--warning-soft-border` 两档已有的值(暗 `224,165,59` / 浅 `200,134,10`),alpha 沿用该 token 的 `0.3`/`0.24`。**不是新色相** |
| 8 | `--code-block-bg` | `#0d0d0d` | 同左(theme-invariant) | `NotesMarkdownEditor.vue:44` `pre` 底色 | 蓝本原值。**两档同值**是刻意的:Vue2 只渲染一档,代码块在两档下都该是近黑(与全站 CodeMirror monokai 的处理同族)。同族先例 = `--switch-thumb`(两档同 `#ffffff`) |
| 9 | `--code-block-fg` | `#ffffff` | 同左 | `NotesMarkdownEditor.vue:44` `pre` 前景 | 蓝本原值。**与既有 `--text-on-accent` 两档都是 `#ffffff`、逐字同值**,但语义是「近黑代码块上的字」不是「强调实底上的字」,故另建。声明处注释要写明这一事实 |

### B.1.1 为什么两个 wash 渐变**保留蓝本色相**、而单色橙 tint **换成 `--warning-soft`**

- 单色 tint(0.14 / 0.28 / 0.3 / 0.18 / 0.05 / 0.09 / 0.1)→ **一律映射到既有 `--warning-soft` /
  `--warning-soft-border`**,这是协调者裁定 **A-9** 的原话,且 P5b-T2 搬 `.kn-badge` 时已经这么做过
  (`knowledge.scss:1602`)。**保全站一致。**
- 多停点渐变**无法拆成多个 token**(整个 `linear-gradient(...)` 必须是一个 token 值),而本仓既有
  `--grad-sandbox` / `--grad-iri` 的先例就是**把蓝本的字面色留在 token 值里**。
  → 两个 wash 按先例走,值保持蓝本原样;**它们是 token 声明层里的字面量,受 §6 的豁免登记覆盖**。
- 🔴 **【修复轮 1 · 裁定 R11】协调者已批准「保留蓝本色相」,本项不再是开放问题。**
  裁定依据(裁定书 R11 原文):既有 `--grad-sandbox` / `--grad-iri` 先例;**K39 授权新建渐变 token**,
  而 **A-9「不为透明度差几个点开小灶」管的是 soft 填充**(`--warning-soft` 那族)、**不管渐变**。
  → **协调者不需要、也不会给那 4 个 alpha**;实现者按上表 §B.1 第 5/6 行的值逐字落地即可,
  **不许自己重算、也不许改成本仓 warning 色相**。

### B.1.2 🔴 3 处 `color: #fff` 的 token **定死为 `--text-on-accent`**(实现者不许自选)

治理 §6.3 写「用 `--on-accent`(若已声明)或 P5c 建的 `--switch-thumb` 家族之一」。**实测订正:**

| 候选 | 暗档 | 浅档 | 判定 |
|---|---|---|---|
| `--on-accent` | 🔴 **`#16203a`**(`theme.css:48`,深藏青) | `#ffffff`(`theme.css:186`) | 🔴 **不可用** —— `knowledge.scss` 里**没有**声明它,穿透到全局 `:root` 会在暗档拿到深藏青 → 橙/蓝实底上写深蓝字。这正是记忆 `--on-accent 只在 accent 实底上可用` 那条坑 |
| ✅ **`--text-on-accent`** | `#ffffff`(`knowledge.scss:145`) | `var(--on-accent)` = `#ffffff`(`:264`) | ✅ **两档都是纯白**,已在两档声明,`var()` 闭环守卫自动通过 |
| `--switch-thumb` | `#ffffff` | `#ffffff` | 可用但语义是「开关拨钮」,不选 |

→ **`knowledge.scss:2042`(`.kn-type-ic`)· `:2066`(`.kn-inbox-icon`)· `:2117`
(`.kn-act[data-tone="confirm"]:hover`,压在 `--success` 实底上)三处一律 `var(--text-on-accent)`。**

---

## §B.2 逐处映射表(**33 处待映 + 6 处已映**,一行一处)

| # | 蓝本 file:line | 原字面量 | → token | 既有/新建 | 备注 |
|---|---|---|---|---|---|
| 1 | `knowledge.scss:2036` | `rgba(255,149,0,0.14)` | `--warning-soft` | 既有 | 🔵 **P5b-T2 已映**(现状 `:1602`),本期不动 |
| 2 | `knowledge.scss:2036` | `rgba(255,149,0,0.28)` | `--warning-soft-border` | 既有 | 🔵 已映 |
| 3 | `knowledge.scss:2038` | `rgba(52,199,89,0.12)` | `--success-soft` | 既有 | 🔵 已映 |
| 4 | `knowledge.scss:2038` | `rgba(52,199,89,0.25)` | `--success-soft-border` | 既有 | 🔵 已映 |
| 5 | `knowledge.scss:2039` | `rgba(255,59,48,0.12)` | `--danger-soft` | 既有 | 🔵 已映 |
| 6 | `knowledge.scss:2039` | `rgba(255,59,48,0.25)` | `--danger-soft-border` | 既有 | 🔵 已映 |
| 7 | `knowledge.scss:2042` | `#fff`(`.kn-type-ic` 前景) | `--text-on-accent` | 既有 | §B.1.2 定死 |
| 8 | `knowledge.scss:2059` | `rgba(255,149,0,0.3)`(`.kn-inbox` 边框) | `--warning-soft-border` | 既有 | A-9 |
| 9 | `knowledge.scss:2060` | `rgba(255,149,0,0.07)` | `--grad-inbox-wash`(整条渐变) | **新建 5** | 与下一处合成一个 token |
| 10 | `knowledge.scss:2060` | `rgba(255,204,0,0.04)` | 同上 | **新建 5** | 第二停点 |
| 11 | `knowledge.scss:2066` | `#FF9500`(`.kn-inbox-icon` 渐变起点) | `--grad-note-insight`(整条渐变) | **新建 3** | 🔴 与 `NOTE_TYPES.insight` **共用一份** |
| 12 | `knowledge.scss:2066` | `#FFCC00` | 同上 | **新建 3** | |
| 13 | `knowledge.scss:2066` | `#fff`(`.kn-inbox-icon` 前景) | `--text-on-accent` | 既有 | §B.1.2 |
| 14 | `knowledge.scss:2067` | `rgba(255,149,0,0.3)`(在 `box-shadow` 里) | `--shadow-warning-glow`(整条 shadow) | **新建 7** | 整个 `0 3px 8px …` 进 token |
| 15 | `knowledge.scss:2074` | `rgba(255,149,0,0.18)`(`.kn-inbox-rows` border-top) | `--warning-soft-border` | 既有 | A-9;alpha 0.18→token 值,登记进 A11 确认项 |
| 16 | `knowledge.scss:2083` | `rgba(255,149,0,0.18)`(`.kn-inbox-foot` border-top) | `--warning-soft-border` | 既有 | 同上 |
| 17 | `knowledge.scss:2083` | `rgba(255,149,0,0.05)`(`.kn-inbox-foot` 底色) | `--warning-soft` | 既有 | A-9 |
| 18 | `knowledge.scss:2116` | `rgba(52,199,89,0.12)`(`.kn-act[data-tone=confirm]`) | `--success-soft` | 既有 | A-9 |
| 19 | `knowledge.scss:2117` | `#fff`(hover 前景,压 `--success` 实底) | `--text-on-accent` | 既有 | §B.1.2 |
| 20 | `knowledge.scss:2118` | `rgba(255,59,48,0.12)`(`.kn-act[data-tone=danger]:hover`) | `--danger-soft` | 既有 | A-9 |
| 21 | `knowledge.scss:2131` | `rgba(255,149,0,0.3)`(`.kn-draftbar` 边框) | `--warning-soft-border` | 既有 | A-9 |
| 22 | `knowledge.scss:2132` | `rgba(255,149,0,0.09)` | `--grad-draftbar-wash`(整条渐变) | **新建 6** | |
| 23 | `knowledge.scss:2132` | `rgba(255,204,0,0.04)` | 同上 | **新建 6** | |
| 24 | `knowledge.scss:2246` | `rgba(0,122,255,0.08)`(`.kn-diff-pane[theirs]` 头底色) | `--accent-soft` | 既有 | A-9(蓝本蓝 → 本仓 accent) |
| 25 | `knowledge.scss:2247` | `rgba(255,149,0,0.1)`(`.kn-diff-pane[mine]` 头底色) | `--warning-soft` | 既有 | A-9 |
| 26 | `NotesMarkdownEditor.vue:43` | `rgba(97,97,97,.12)`(行内 `code` 底色) | `--bg-chip` | 既有 | 🔴 **强先例**:蓝本自己的 `.kn-pathstrip code`(`:2053`)与 `.kn-tag`(`:2045`)用的就是 `var(--bg-chip)` |
| 27 | `NotesMarkdownEditor.vue:44` | `#0d0d0d`(`pre` 底色) | `--code-block-bg` | **新建 8** | 两档同值 |
| 28 | `NotesMarkdownEditor.vue:44` | `#fff`(`pre` 前景) | `--code-block-fg` | **新建 9** | 两档同值 |
| 29 | `NotesMarkdownEditor.vue:45` | `rgba(13,13,13,.2)`(`blockquote` 左边框) | `--line-strong` | 既有 | 引用条要可见 → 取 strong 档(`--line` 太淡);A11 同族 |
| 30 | `notesViewHelpers.js:6` | `#5AC8FA` + `#007AFF` | `--grad-note-note` | **新建 1** | 2 处 → 1 token(K40:`.ts` 里写 `'var(--grad-note-note)'`) |
| 31 | `notesViewHelpers.js:7` | `#30B0C7` + `#34C759` | `--grad-note-summary` | **新建 2** | 2 处 |
| 32 | `notesViewHelpers.js:8` | `#FF9500` + `#FFCC00` | `--grad-note-insight` | **新建 3** | 2 处,与 #11/#12 共用 |
| 33 | `notesViewHelpers.js:9` | `#AF52DE` + `#FF2D55` | `--grad-note-digest` | **新建 4** | 2 处 |
| 34 | `NotesView.vue:85` | `'rgba(255,149,0,.14)'`(**`:style` 的 JS 对象字面量里**) | `'var(--warning-soft)'` | 既有 | §B.4 |
| 35 | `NoteEditPane.vue:152` | `rgba(255,149,0,.14)`(模板 `style=` 属性里) | `var(--warning-soft)` | 既有 | §B.4 |

**处数核对**:#1-#6 是已映的 6 处;#7-#29 是 23 处;#30-#33 各 2 处 = 8 处;#34/#35 = 2 处。
6 + 23 + 8 + 2 = **39** ✅。

## §B.3 A11 / A-9 的显式确认项(**必须进验收清单,请用户看实物拍板**)

蓝本的透明度/色相与本仓 token **不完全相同**,按 A-9 一律用本仓既有 token(与 P5b-T2 的 `.kn-badge` 同一映射):

| 蓝本值 | 本仓 token 暗档 | 本仓 token 浅档 | 吃在哪 |
|---|---|---|---|
| `rgba(255,149,0,0.14/0.05/0.1)` | `--warning-soft` `rgba(224,165,59,0.18)` | `rgba(200,134,10,0.12)` | 草稿徽标 · inbox 页脚 · 冲突弹窗 mine 头 · 两处模板内联 |
| `rgba(255,149,0,0.3/0.28/0.18)` | `--warning-soft-border` `rgba(224,165,59,0.3)` | `rgba(200,134,10,0.24)` | inbox / draftbar 边框 · 两处分隔线 |
| `rgba(52,199,89,0.12)` | `--success-soft` `rgba(79,184,112,0.18)` | `rgba(46,158,84,0.12)` | 确认徽标 · 确认按钮底 |
| `rgba(255,59,48,0.12)` | `--danger-soft` `rgba(240,119,107,0.16)` | `rgba(215,73,59,0.1)` | 删除按钮 hover |
| `rgba(0,122,255,0.08)` | `--accent-soft` `rgba(94,151,242,0.14)` | `rgba(59,91,219,0.11)` | 冲突弹窗 theirs 头 |
| `rgba(97,97,97,0.12)` | `--bg-chip` `#2A2A2C`(**实底,非半透明**) | `var(--tool-bg-hi)` `#e7e3d9` | 编辑器行内 `code` |
| `rgba(13,13,13,0.2)` | `--line-strong` `#3A3A3D` | `#D8D3C7` | 编辑器 `blockquote` 左条 |

⚠️ **最后两行的差异比前五行大**(半透明 → 实底):行内 `code` 与 `blockquote` 在两档下的观感会与 Vue2
有可见差别。**与 P5c 悬着的 A11 合并成一条显式确认项。**

## §B.4 模板内联的 2 处(🔴 **不许写 0**)

P5b 的 **E-11** 就是漏了这一类;P5c 那期真的是 0,**本期不是**。

| 位置 | 原文 | 改成 | 为什么是缺口③ 的靶子 |
|---|---|---|---|
| `NotesView.vue:85` | `:style="counts.draft ? { background: 'rgba(255,149,0,.14)', color: 'var(--warning)' } : null"` | `{ background: 'var(--warning-soft)', color: 'var(--warning)' }` | 🔴 **藏在 `:style` 的 JS 对象字面量里**,`color-guard.test.ts` 的 `styleLines()` 只取 `<style>` 块 |
| `NoteEditPane.vue:152` | `style="width: 30px; height: 30px; border-radius: 9px; background: rgba(255,149,0,.14); color: var(--warning); …"` | `background: var(--warning-soft)`,其余照抄 | 同上 |

✅ **`NotesView.vue:33` 等模板 `color="var(--text-quaternary)"` 属性已经是 `var()`,零字面量** —— 照抄。
✅ 中央 ③′ 守卫(`knowledgeStyles.test.ts`)已覆盖 `src/ai/knowledge/**/*.vue`,新增的 3 个 `.vue`
**必须进那条 `KNOWLEDGE_VUE_FILES` 清单**(它是集合相等断言,不进就报红)。

## §B.5 K40 —— `.ts` 里的 4 个渐变是**全仓唯一零守卫的配色位置**

`color-guard.test.ts` 只扫 **`.vue` 的 `<style>` 块**与 **`.css`**,**压根不扫 `.ts`**(T0 已读该文件确认)。

> 🔴 **【修复轮 1 · M-1】初稿这句写成「…与 `.css`/`.scss`」是错的:它也不扫 `.scss`。**
> 实测 `src/styles/color-guard.test.ts:15-16` 的 glob **只有两条**:
> `import.meta.glob('../**/*.vue', …)` 与 `import.meta.glob('../**/*.css', …)`。
> **为什么这个错很危险**:它会让下游误以为 `knowledge.scss` 有 color-guard 兜底 ——
> 实际上本档除 §B.6 登记的两个 token 声明块外,**只有 `knowledgeStyles.test.ts` 的色字面量扫描 +
> 人肉逐行评审两道防线**(P5a §6 / P5b §6.2 的「⚠️ `color-guard` 不扫 `.scss`」原本就是这么写的)。
> 承重结论(不扫 `.ts` → K40 的 4 个渐变裸奔)**不受影响,仍成立**。
→ `notesViewHelpers.ts` 的 `NOTE_TYPES[*].color` 改成 `'var(--grad-note-*)'` 之后,
**必须**在 `notesViewHelpers.test.ts` 里补一条定向断言 + RED 探针:

- 四个 `color` 值逐个 `toMatch(/^var\(--grad-note-[a-z]+\)$/)`;
- 反向:全表序列化后 `not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/)`;
- **RED 探针**:把任一个 `color` 改回 `linear-gradient(135deg, #5AC8FA, #007AFF)` → 必须报红。

## §B.6 声明层豁免登记(照 P5a §6 / P5b §6 原样)

`knowledge.scss` 的两个 token 声明块
—— `.knowledge-app, .parser-app {`(**现状 `:130-246`**)与
`:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {`(**现状 `:249-340`**)
—— 是**唯一**允许出现字面量的地方。本期 9 个新 token 全部声明在这两块里(各 9 行)。
**块外全文零字面量,注释里也不许有。**
⚠️ `knowledgeStyles.test.ts:312-315` 的 `DARK_TOKEN_SELECTOR` / `LIGHT_TOKEN_SELECTOR` 是**行首行尾锚定**,
选择器必须继续写在**一行**里,本期不改它们。
