# P5e 附录 B —— 色值映射表(T0 终值,**T2/T4 照抄落地,实现者不许自选**)

> 实测于 **2026-08-05**,蓝本锁 `NimoOS-UI@7a6ee6b7`。
> 🔴 **本表里没有的色字面量一律 `NEEDS_CONTEXT`**(治理 §6.1 第 ⑤ 条)。
> 🔴 **每个新 token 两档都显式写值**;声明处注释必须写明蓝本 `file:line` + 本附录行号。
> 🔴 **注释里也不许出现色字面量**(裁定 R17)—— 偏差申报注释只许引「蓝本 `file:line`」与「附录 B §x」。
>
> **两档的方位**(实测确认,别搞反):
> - `knowledge.scss:163` 的 `.knowledge-app, .parser-app { … }` = **暗色档(默认/兜底)**
> - `knowledge.scss:306` 的 `:root[data-theme="light"] .knowledge-app, … { … }` = **浅色档**

---

## B.0 全量清点 —— 本期一共 **17 处** 色字面量

扫描方式:对本期 scss 搬运段(`knowledge.scss` 的 6 段)+ `KFileViewer.vue:70-120`,
用 `/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(white|black|red|green|…)\b/g` 全量扫,
**含注释、含具名色**。⚠️ 已剔除 4 处 `white-space:` 假阳性(治理已点名的假阳性类型)。

| # | 蓝本 `file:line` | 声明 | 字面量 | 处置 | 新 token? |
|---|---|---|---|---|---|
| 1 | `knowledge.scss:599` | `.k-rcard-icon { background: white }` | `white`(具名) | → `var(--paper-surface)` | **复用**(见 B.1) |
| 2 | `knowledge.scss:616` | `.k-rcard-tag { color: white }` | `white`(具名) | → `var(--text-on-accent)` | **复用**(已在两档) |
| 3 | `knowledge.scss:618` | `.k-rcard-tag[data-kind="pdf"] { background }` | `#FF3B30` | → `var(--rtag-pdf)` | 🔴 **新建** |
| 4 | `knowledge.scss:619` | `…[data-kind="md"] { background }` | `#1a1a1a` | → `var(--rtag-md)` | 🔴 **新建**(⚠️ 验收拍板项) |
| 5 | `knowledge.scss:620` | `…[data-kind="doc"] { background }` | `#007AFF` | → `var(--rtag-doc)` | 🔴 **新建** |
| 6 | `knowledge.scss:621` | `…[data-kind="txt"] { background }` | `#34C759` | → `var(--rtag-txt)` | 🔴 **新建** |
| 7 | `knowledge.scss:622` | `…[data-kind="code"] { background }` | `#AF52DE` | → `var(--rtag-code)` | 🔴 **新建** |
| 8 | `knowledge.scss:639` | `.k-rel[data-level="high"] { background }` | `rgba(52, 199, 89, 0.12)` | → `var(--success-soft)` | **复用**(已在两档) |
| 9 | `knowledge.scss:639` | `…[data-level="high"] { color }` | `#1f9c47` | → `var(--success)` | **复用**(已在两档) |
| 10 | `knowledge.scss:640` | `.k-rel[data-level="mid"] { background }` | `rgba(255, 149, 0, 0.14)` | → `var(--warning-soft)` | **复用**(已在两档) |
| 11 | `knowledge.scss:640` | `…[data-level="mid"] { color }` | `#c97500` | → `var(--warning)` | **复用**(已在两档) |
| 12 | `knowledge.scss:641` | `.k-rel[data-level="low"] { background }` | `rgba(255, 89, 0, 0.14)` | → `var(--danger-soft)` | **复用**(已在两档) |
| 13 | `knowledge.scss:641` | `…[data-level="low"] { color }` | `#c54a00` | → `var(--danger)` | **复用**(已在两档) |
| 14 | `knowledge.scss:1574` | `.k-drawer-bg { background }` | `rgba(15, 20, 30, 0.32)` | → `var(--modal-scrim)` | **复用**(已在两档) |
| 15 | `knowledge.scss:1582` | `.k-drawer { box-shadow: -20px 0 60px … }` | `rgba(15, 20, 30, 0.18)` | → `var(--shadow-drawer)`(**整条 box-shadow 值**) | 🔴 **新建** |
| 16 | `knowledge.scss:1660` | `.k-chunk-content mark { background }` | `rgba(255, 235, 0, 0.4)` | → `var(--mark-hl-bg)` | 🔴 **新建**(⚠️ 验收拍板项) |
| 17 | `KFileViewer.vue:75` | `.k-fileviewer-host { background }` | `#fff` | → `var(--bg-canvas)` | **复用**(K47) |
| — | `KFileViewer.vue:84` | `::v-deep .overlay { background-color: #fff }` | `#fff` | 🔴 **随 K46 整段删除,不搬** | — |

**新建 token 合计 7 个**:`--rtag-pdf` / `--rtag-md` / `--rtag-doc` / `--rtag-txt` / `--rtag-code` /
`--shadow-drawer` / `--mark-hl-bg`。

⚠️ **协调者点名的 3 组(5 实底 + 3 组 rel + mark 黄)之外,T0 另查出 4 处**:
`:599` 的 `white`、`:1574` 的 `rgba(15,20,30,0.32)`、`:1582` 的 `rgba(15,20,30,0.18)`,
以及协调者要求 T0 实读的 `:616` `.k-rcard-tag` 文字色(= `white`)。
根源是 **`p5-master-plan.md` §2.4 的 52 类清单漏了 `.k-drawer-bg`(`:1572`)与 `.k-drawer`(`:1579`)**
—— 见附录 D §D.2。

---

## B.1 复用的既有 token —— 逐条依据

| token | 暗档值(`knowledge.scss:163` 块) | 浅档值(`:306` 块) | 为什么可以复用 |
|---|---|---|---|
| **`--paper-surface`** | `#ffffff` | `#ffffff` | 🔴 **本仓专为「白纸片文件图标」登记的例外 token** —— `tokens.scss:193`(浅)/`:342`(暗)两档同值,注释原文把它与 `--kind-*`/`--scrim-dark` 列为同族「skin-agnostic」;`skills-styles.scss:402-404` 的注释原文:「与既有 `--paper-surface` token(专为这类『白纸片』文件图标登记的例外 token)」。`.k-rcard-icon` 正是同一个东西(一张白纸 + 右上折角 + 底部类型标签)。🔴 **本 token 尚未在 `knowledge.scss` 声明 → T2 必须在两档各补一份**,值逐字抄 `tokens.scss:193` / `:342`,注释引出处 |
| **`--text-on-accent`** | `#ffffff`(`knowledge.scss:177`) | `var(--on-accent)`(`:321`) | 已在两档。先例逐字同款:`knowledge.scss` 的 `.k-type-legacy` 注释原文「蓝本 `:1899` 前景是一处具名色裸值(**实底警告色胶囊上的纯白字**)→ `--text-on-accent`」。`.k-rcard-tag` 是同款实底胶囊上的白字。⚠️ 记忆「`--on-accent` 只在 accent 实底上可用」—— 这里 5 个 `[data-kind]` 底**都是不透明实底**,成立 |
| **`--success-soft` / `--success`** | `rgba(79, 184, 112, 0.18)` / `#4FB870` | `rgba(46, 158, 84, 0.12)` / `#15754c` | 🔴 **本文件里已有逐字同款先例**:`.k-type-tag[data-kind="txt"]` 的注释原文「蓝本 `:1893` 成功色半透明底 + 深绿前景两处裸值 → token」,而蓝本 `:1893` 就是 `background: rgba(52,199,89,0.1); color: #1f9c47` —— **与本期 `:639` 的 `rgba(52,199,89,0.12)` / `#1f9c47` 是同一对值**(alpha 差 0.02)。**A-9 明令「不为透明度差几个点开小灶」** |
| **`--warning-soft` / `--warning`** | `rgba(224, 165, 59, 0.18)` / `#E0A53B` | `rgba(200, 134, 10, 0.12)` / `var(--toast-warn-fg)` | `rgba(255,149,0,0.14)` 是 `#FF9500`(iOS 橙 = 本仓 warning 色相)的半透明底,`#c97500` 是与之配对的深橙前景 —— 与上一条 success 完全同构 |
| **`--danger-soft` / `--danger`** | `rgba(240, 119, 107, 0.16)` / `#F0776B` | `rgba(215, 73, 59, 0.1)` / `var(--toast-danger-fg)` | 同构。先例:`.k-type-tag[data-kind="pdf"]` 注释「蓝本 `:1890` 危险色半透明底 + 深红前景两处裸值 → token」,蓝本 `:1890` = `rgba(255,59,48,0.1)` / `#d8362b`。本期 `:641` 是 `rgba(255,89,0,0.14)` / `#c54a00`(橙红,比 pdf 那个更偏橙)—— **仍归 danger 家族**:它是「相关度低」的告警语义,`--danger` 是本档唯一的「红/橙红」语义 token |
| **`--modal-scrim`** | `rgba(0, 0, 0, 0.5)` | `rgba(0, 0, 0, 0.5)` | 🔴 **本文件里已有逐字同款先例**:`knowledge.scss:1141-1142` 的注释原文「蓝本 `:1298` **冷调半透明遮罩裸值** → `--modal-scrim`(P5a 已在两档声明)」。本期 `:1574` 的 `rgba(15,20,30,0.32)` 是**同一个冷调遮罩**(抽屉背后的 scrim),**同一个决定,已过评审** |
| **`--bg-canvas`** | `#1C1C1E` | `var(--bg)` | K47。🔴 **蓝本自己的兄弟规则就是它** —— `KFileViewer.vue:106` 的 `.k-fileviewer-fallback { background: var(--bg-canvas) }`。host 与 fallback 是同一个全屏面的两层,蓝本给 host 写 `#fff` 只是浅色单档假设。⚠️ 而且 `ViewerShell.vue:26` 会用 `var(--app-bg)` 把整片重新铺一遍 → host 的底色只在 viewer 未渲染的瞬间可见 |

---

## B.2 新建 token(**两档都显式写值,T2 照抄**)

### B.2.1 `--rtag-*` —— 结果卡文件类型标签的 5 个实底

**theme-invariant(两档同值)**,与 `tokens.scss` 的 `--kind-*` 家族同款(那家族浅/暗两档也是逐字同值)。

| token | 两档值 | 仓内同值出处(诚实登记) |
|---|---|---|
| `--rtag-pdf` | `#FF3B30` | 与 `tokens.scss:206`(浅)/ `:347`(暗)的 `--kind-pdf` **逐字同值** |
| `--rtag-md` | `#1a1a1a` | 与 `tokens.scss:209` / `:350` 的 `--kind-md` **逐字同值** |
| `--rtag-doc` | `#007AFF` | 与 `tokens.scss:207` / `:348` 的 `--kind-doc` **逐字同值** |
| `--rtag-txt` | `#34C759` | 与 `tokens.scss:208` / `:349` 的 **`--kind-xls`** 逐字同值(⚠️ **不是** `--kind-txt`,那个是 `#8E8E93` 灰) |
| `--rtag-code` | `#AF52DE` | 与 `knowledge.scss:187`(暗)/ `:348`(浅)的 `--purple` **逐字同值** |

🔴 **为什么另起 `--rtag-*` 而不直接借 `--kind-*` / `--purple` 的名字**(承 `--grad-sk-blue → --grad-sandbox` 的改名先例):
1. **`--kind-txt` 同名异值** —— `tokens.scss:210` 的 `--kind-txt` 是 `#8E8E93`(灰),而蓝本这里的 TXT 是 `#34C759`(绿)。
   在 `.knowledge-app` 里声明 `--kind-txt: #34C759` 会造成**全仓同名两值**,是评审地雷。
2. 既然 txt 那一员必须换名,**五个就必须同一个家族前缀**,不许 4 个借名 + 1 个新名(命名规则碎、易记错)。
3. `--purple` 是**纯色相名**(不是文件类型语义),借给「code 类型标签」与 `-sk-` 借名同类问题。
4. `--rtag-` = **r**esult-card **tag**,语义精确落在这一处。

🔴 **`--rtag-md`(`#1a1a1a`)是本期唯一必须请机主看实物拍板的配色项**:
- **浅色档**:近黑底 + 白字,对比强,与其余 4 个鲜色标签并列时最重 —— 蓝本本意。
- **暗色档**:`--bg-elevated` 是 `#242426`,`#1a1a1a` 比它**更暗** → 标签会「陷进」白纸片(`--paper-surface` 白)里
  变成一个近黑小块。**视觉上仍可读(白字压近黑底),但与其余 4 个的观感不平衡。**
- **T0 判定:照蓝本 1:1 保留 `#1a1a1a` 两档同值**(界面严格 1:1 是长期纪律),
  **并写进验收清单请机主拍板**;机主若要改,改的是 token 值,不动任何选择器。

### B.2.2 `--shadow-drawer` —— 抽屉的方向性投影(整条 `box-shadow` 值 token)

| 档 | 值 |
|---|---|
| **暗档**(`:163` 块) | `-20px 0 60px rgba(0, 0, 0, 0.55)` |
| **浅档**(`:306` 块) | `-20px 0 60px rgba(40, 35, 25, 0.10)` |

依据:
- 本档 `--shadow-*` **全都是整条 `box-shadow` 值 token**,且 **P5d-K39 已有「新建整值阴影 token」先例**
  (`--shadow-warning-glow: 0 3px 8px rgba(…)`)→ 形态照同款。
- 两档的**颜色部分**照 **裁定 R4** 的既定规则:暗档用 `rgba(0,0,0,…)`、浅档用 `rgba(40,35,25,…)`;
  alpha 取本档 `--shadow-lg` 同档的 alpha(暗 `0.55` / 浅 `0.10`)。
- **几何部分 `-20px 0 60px` 逐字照蓝本 `:1582`**(方向性投影,是 1:1 视觉的一部分)。
- 🔴 **蓝本原值 `rgba(15,20,30,0.18)` 不照抄** —— 那是冷调,与本档 R4 已统一的暖灰/纯黑两套不同源;
  R4 当时正是为了「暗底 + 暖灰阴影看不见」才立的规则。**这是 K2 主题映射层的既有口径,不是新偏离。**

### B.2.3 `--mark-hl-bg` —— 正文高亮黄

| 档 | 值 |
|---|---|
| **暗档**(`:163` 块) | `rgba(255, 235, 0, 0.22)` |
| **浅档**(`:306` 块) | `rgba(255, 235, 0, 0.40)` |

依据:
- 🔴 **全仓零同值、零近义 token**(实测:`grep -rn "255, 235, 0\|--hl-" src/**/*.{css,scss}` 只命中
  `theme.css:67/:282` 的 `--hl-star`(`#e8c06a` / `#c9992f`,金棕色星标,**不是高亮黄**)→ 必须新建。
- **浅档 = 蓝本原值 `rgba(255,235,0,0.4)` 逐字照抄。**
- 🔴 **暗档不能照抄 0.4**:`.k-chunk-content` 的 `color` 是 `inherit` → 实际是 `--text-primary`
  (暗档 `#E9E7E3`,浅灰白)。40% 纯黄压在 `--bg-canvas`(`#1C1C1E`)上会把底推到中间调,
  **浅灰白字在中间调黄底上对比度最差**。降到 `0.22` 保持「暗底上一层黄雾」、字仍是亮字。
  这是 **K39 第 ③ 条「两档都显式写值」的必然结果**,不是自选。
- ⚠️ **只改 `:1660` 这一处。** 另两条 `mark` 规则用的是既有 token,**别一起改**:
  - `knowledge.scss:653` `.k-rcard-snippet mark { background: var(--accent-soft); color: var(--accent) }`
  - `knowledge.scss:1645` `.k-chunk-item-preview mark { background: var(--accent-soft); color: var(--accent) }`
- 🔴 **进验收拍板项**(与 `--rtag-md` 一起)。

---

## B.3 模板 `style=` / `:style=` / `color=` 逐处判定(**显式记数,不许写 0**)

承 **P5b 的 E-11**(漏了这一类)。实测扫法:只扫 `<script` 之前的模板段,
正则 `/(:?style="[^"]*"|:?color="[^"]*")/g`,**逐处列出**。

| 文件 | 总处数 | 含颜色的处数 | 其中**色字面量** | 纯尺寸/排版(N24 同族照抄) |
|---|---|---|---|---|
| `SearchView.vue` | **16** | 8 | 🔴 **0** | 8 |
| `FileDetailDrawer.vue` | **9** | 2 | 🔴 **0** | 7 |
| `KFileViewer.vue` | **1** | 1 | 🔴 **0** | 0 |
| **合计** | **26** | **11** | 🔴 **0** | **15** |

⚠️ **协调者初测「SearchView 6 处」是欠计(实测 16)**;「FileDetailDrawer 9 处」**精确正确**。

### B.3.1 `SearchView.vue` 逐处

| 行 | 内容 | 判定 |
|---|---|---|
| `:8` | `color="var(--text-tertiary)"`(KIcon prop) | ✅ 已是 token,照抄 |
| `:26` | `style="color: var(--accent); font-weight: 600"` | ✅ 已是 token,照抄 |
| `:84` | `style="font-size: 11px; color: var(--text-quaternary); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; margin-top: 8px"` | ✅ 已是 token,照抄 |
| `:87` | `style="justify-content: center"` | 纯排版,照抄 |
| `:97` | `style="display: inline-block; width: 200px; height: 12px"` | 纯尺寸,照抄 |
| `:100` | `style="width: 30px; height: 36px"` | 纯尺寸,照抄 |
| `:101` | `style="flex: 1; display: flex; flex-direction: column; gap: 8px"` | 纯排版,照抄 |
| `:102` `:103` `:104` `:105` | 骨架条四个 `style="width: …; height: …"` | 纯尺寸,照抄 |
| `:124` | `style="color: var(--text-quaternary); margin-left: 6px"` | ✅ token |
| `:149` `:151` | `style="color: var(--text-quaternary)"` ×2(两个分隔点 `·`) | ✅ token |
| `:152` | `color="var(--success)"`(KIcon prop) | ✅ token |
| `:159` | `style="color: var(--danger)"` | ✅ token |

### B.3.2 `FileDetailDrawer.vue` 逐处

| 行 | 内容 | 判定 |
|---|---|---|
| `:6` | `style="transform: scaleX(-1); display: inline-flex"` | 纯变换,照抄 |
| `:14` | `style="width: 40px; height: 48px"` | 纯尺寸,照抄 |
| `:17` | `style="flex: 1; min-width: 0"` | 纯排版,照抄 |
| `:19` | `style="margin-top: 4px"` | 纯排版,照抄 |
| `:22` | `style="margin-top: 3px"` | 纯排版,照抄 |
| `:24` | `style="color: var(--text-quaternary)"` | ✅ token |
| `:50` | `style="color: var(--text-quaternary)"` | ✅ token |
| `:66` | `style="transform: rotate(180deg); display: inline-flex"` | 纯变换,照抄 |
| `:70` | `style="transform: scaleX(-1); display: inline-flex"` | 纯变换,照抄 |

### B.3.3 `KFileViewer.vue` 逐处

| 行 | 内容 | 判定 |
|---|---|---|
| `:16` | `color="var(--text-quaternary)"`(KIcon prop) | ✅ token |

🔴 **结论:三个模板里一个色字面量都没有** → 模板侧不需要任何 token 改造,
但 **`color-guard.test.ts` 的模板具名色扫描仍会覆盖这 26 处**(P5c-T8 / P5d-T5 补的那条),
**不许因为「反正是 0」就跳过复核**。

---

## B.4 `KFileViewer.vue` 的 `<style scoped>` 处置汇总(K46 + K47)

蓝本 `:70-120`(51 行),三块:

| 蓝本行 | 内容 | 本期处置 |
|---|---|---|
| `:71-76` | `.k-fileviewer-host { position: fixed; inset: 0; z-index: 1100; background: #fff }` | **搬**;`#fff` → `var(--bg-canvas)`(K47 / B.1)。🔴 **`position: fixed; inset: 0; z-index: 1100` 三个属性必须原样保留**并配断言(K46 判据 ③) |
| `:77-101` | 三条 `::v-deep`(`.overlay` / `.v-container` / `.doc-container`),含 `:84` 的 `background-color: #fff` | 🔴 **整段不搬**(K46)。含那一处 `#fff` |
| `:103-119` | `.k-fileviewer-fallback` + `.k-fileviewer-empty` | **搬**;两条本来就用 `var(--bg-canvas)` / `var(--text-secondary)`,**零字面量** |

→ **净剩 1 处色字面量**(`:75` 的 `#fff`),与治理 §6.1 的「净 1 处(K47)」一致。

🔴 **K46 判据 ① 的实测结果(T2/T4 直接引,但评审仍须自己 grep)**:
```
grep -rn "v-container\|doc-container" src/          →  零命中(全仓)
grep -rn 'class="overlay"' src/                     →  仅 src/files/viewers/ViewerShell.vue:9
```
⚠️ **诚实登记**:`.overlay` **不是零命中** —— `DocViewer.vue` / `ExcelViewer.vue` 自己的模板里确实没有它,
但它们渲染的 `ViewerShell.vue:9` 会吐出 `<div class="overlay">`。
**但这不影响 K46 的结论,反而加强它**:`ViewerShell.vue:23-29` 的 `<style scoped>` 已经给 `.overlay` 写了
`position: absolute; inset: 0; z-index: 200; overflow: hidden; display: flex; flex-direction: column`
—— **正好就是蓝本那条 `::v-deep .overlay` 想补的东西**,补丁纯属重复。
🔴 **K46 落地判据 ① 的表述要改成**「`DocViewer.vue`/`ExcelViewer.vue` **自身模板**零那三个类,
且 `.overlay` 已由 `ViewerShell` 自带 scoped 规则定位」——**不许写成「全仓零 `.overlay`」**(那是假的,评审会逮到)。

🔴 **K46 判据 ② 的实测**:`ViewerShell.vue:24` = `position: absolute; inset: 0; z-index: 200; overflow: hidden;`
→ 「host 必须提供铺满视口的定位祖先」这个前提**为真**。**拿掉 `.k-fileviewer-host` 的 `fixed` 会让预览器塌进文档流。**

### B.4.1 z-index 相对关系(K46 要求写进附录)

| 元素 | z-index | 出处 |
|---|---|---|
| `.k-drawer-bg`(详情抽屉遮罩) | **1050** | 蓝本 `knowledge.scss:1577` |
| `.k-fileviewer-host`(in-app 预览) | **1100** | 蓝本 `KFileViewer.vue:74`,行尾注释原文 `/* above the detail drawer (1050) */` |
| `ViewerShell .overlay`(预览器自身外壳) | 200 | `src/files/viewers/ViewerShell.vue:24` |
| `.k-modal-bg`(本档既有弹窗遮罩) | 现状见 `knowledge.scss` `.k-modal-bg` 块 | T2 搬 `.k-drawer-bg` 时顺手核一眼别撞 |

🔴 **相对关系 = `1100 > 1050`,且蓝本注释里的 `1050` 与 `.k-drawer-bg` 实际值逐字一致(已核)**。
两个数字都必须原样搬,`ViewerShell` 的 200 是**局部**层(在 host 的 stacking context 里),不参与比较。

---

## B.5 T2/T4 落地检查清单

1. 两档 token 块各补:`--paper-surface` · `--rtag-pdf` · `--rtag-md` · `--rtag-doc` · `--rtag-txt` ·
   `--rtag-code` · `--shadow-drawer` · `--mark-hl-bg` = **8 个声明 × 2 档 = 16 行**
   (`--paper-surface` 是「本档尚未声明的既有 token」,其余 7 个是新建)。
2. 每行注释写明:蓝本 `file:line` + 本附录小节号 + 仓内同值出处(有则写,无则写「全仓零同值先例」)。
   🔴 **注释里不许出现色字面量**(裁定 R17)—— 值本身写在声明位置,注释只引出处。
3. `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
4. `knowledgeStyles.test.ts` 的全文含注释色扫必须仍绿(它是 `knowledge.scss` 唯一的配色防线)。
5. 🔴 **本表以外的任何色字面量 → `NEEDS_CONTEXT`,不许自选 token。**
