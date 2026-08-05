# SP8-P5a Task 4 报告 —— knowledge.scss 第一批(token 声明层 + 壳段 + keyframes)

提交:
- `71ae0ee` — `feat(knowledge): SP8-P5a knowledge.scss token 声明层 + 壳段 + keyframes`(初版)
- `f634b47` — `fix(knowledge): 浅色档必须显式声明 --accent/--accent-soft/--success(评审 Critical 订正)`(第一轮评审订正,见 §11)
- `76367d2` — `fix(knowledge): 评审 5 条订正——守卫边界/色扫范围/注释裸色/阴影两档取值`(第二轮评审订正,见 §12)

文件:
- `src/ai/styles/knowledge.scss`(第二轮订正后 585 行)
- `src/ai/styles/knowledgeStyles.test.ts`(第二轮订正后 234 行,9 个用例)

---

## 1. token 声明层逐条对照

### 1.1 暗色档 `.knowledge-app`(基础块,New-UI 默认 `<html>` 无 `data-theme`)

| token | 值 | 出处 |
|---|---|---|
| `--bg-app`/`--bg-canvas` | `#1C1C1E` | AI `tokens.scss:255-256` |
| `--bg-elevated` | `#242426` | `:257` |
| `--bg-sunken` | `#161617` | `:258` |
| `--bg-chip` | `#2A2A2C` | `:259` |
| `--glass-strong/medium/weak` | `rgba(28,28,30,.82/.6/.45)` | `:263-265` |
| `--text-primary/secondary/tertiary/quaternary` | `#E9E7E3/#A3A09A/#6E6C68/#4D4B48` | `:267-270` |
| `--text-on-accent` | `#ffffff` | `:275` |
| `--accent/-hover/-soft/-softer` | `#5E97F2/#7AABF5/rgba(94,151,242,.14)/rgba(94,151,242,.10)` | `:277-280` |
| `--success/--warning/--danger` | `#4FB870/#E0A53B/#F0776B` | `:282-284` |
| `--purple/--pink/--teal` | `#AF52DE/#FF2D55/#30B0C7` | `:71-73`(浅色块,暗色块未重定义,两档同值) |
| `--line/-strong/-faint` | `#2E2E31/#3A3A3D/#262628` | `:293-295` |
| `--ly-wiki/-vec/-note`(+`-soft`/`-line`) | `oklch(...)` 三组 | 蓝本 `knowledge.scss:2444-2447` 暗色档原值(逐字保留,只是选择器改法) |
| `--r-xs…--r-pill` | `6/10/14/18/24/32/999px` | 结构量,两档共享,只在本块声明 |
| `--shadow-xs/sm/md/lg` | `rgba(0,0,0,…)` 暗投影四条 | AI `tokens.scss:360-363`(评审 R4 裁定,见 §12.5 —— 不是结构量,浅色块另有一份不同取值) |
| `--font-sans/--font-mono` | 原值 | 蓝本同款,两档共享 |
| `--grad-iri/-soft` | 渐变 | AI `tokens.scss:119-120`(两档共享,只在本块声明) |
| `--warning-soft` | `rgba(224,165,59,.18)` | `tokens.scss:303`(R2) |
| `--warning-soft-border` | `rgba(224,165,59,.3)` | `tokens.scss:304`(R2) |
| `--success-soft` | `rgba(79,184,112,.18)` | `tokens.scss:306`(R2) |
| `--danger-soft` | `rgba(240,119,107,.16)` | `tokens.scss:308`(R2) |
| `color-scheme` | `dark` | R3 |

### 1.2 浅色档 `:root[data-theme="light"] .knowledge-app`

| token | 值 | 出处 |
|---|---|---|
| `--bg-app/-canvas` | `var(--bg)` | 全局 `theme.css:179` `#f7f5ef` |
| `--bg-elevated` | `var(--card-bg)` | `theme.css:200` `#ffffff` |
| `--bg-sunken` | `var(--tool-bg)` | `theme.css:222` `#f0eee8` |
| `--bg-chip` | `var(--tool-bg-hi)` | `theme.css:223` `#e7e3d9` |
| `--glass-strong/medium/weak` | `rgba(247,245,239,.82/.6/.45)` | `--bg` 的 RGB 加透明,全局无 glass 语义 token |
| `--text-primary/secondary/tertiary` | `var(--fg)/var(--fg-muted)/var(--fg-faint)` | `theme.css:180-182` |
| `--text-quaternary` | `#BCB8AD` | AI `tokens.scss:58` 浅色第四档 |
| `--text-on-accent` | `var(--on-accent)` | `theme.css:186` |
| **`--accent`/`--accent-soft`/`--success`** | **字面值:`#3b5bdb`/`rgba(59,91,219,0.11)`/`#15754c`** | `theme.css:183/274/281`(评审 Critical 订正,见 §11 —— 初版"刻意不声明靠继承"的推理不成立) |
| `--accent-hover` | `var(--accent-text)` | `theme.css:271` `#3550c4` |
| `--accent-softer` | `rgba(59,91,219,.06)` | 蓝本要 0.06,全局最淡档是 0.11,无匹配 token,落字面值 |
| `--warning` | `var(--toast-warn-fg)` | `theme.css:217` `#92600c` |
| `--danger` | `var(--toast-danger-fg)` | `theme.css:219` `#c0392b` |
| `--purple/--pink/--teal` | `#AF52DE/#FF2D55/#30B0C7` | AI `tokens.scss:71-73` |
| `--line` | `var(--card-border)` | `theme.css:204` |
| `--line-strong/-faint` | `#D8D3C7/#EEEBE3` | AI `tokens.scss:86-87` |
| `--ly-wiki/-vec/-note`(+soft/line) | `oklch(...)` 三组 | 蓝本 `knowledge.scss:2287-2289` 浅色档原值 |
| `--warning-soft` | `rgba(200,134,10,.12)` | `tokens.scss:126`(R2) |
| `--warning-soft-border` | `rgba(200,134,10,.24)` | `tokens.scss:127`(R2) |
| `--success-soft` | `rgba(46,158,84,.12)` | `tokens.scss:129`(R2) |
| `--danger-soft` | `rgba(215,73,59,.1)` | `tokens.scss:131`(R2) |
| `--shadow-xs/sm/md/lg` | `rgba(40,35,25,…)` 暖投影四条 | AI `tokens.scss:107-110`(评审 R4 裁定,见 §12.5 —— 新增声明,与暗色块不同值) |
| `color-scheme` | `light` | R3 |

**R2 声明清单**:只声明本批壳段实际用到的 4 个 —— `--warning-soft`、`--warning-soft-border`、`--success-soft`、`--danger-soft`(两档各一份)。`--accent-soft-2` 按协调者例外条款**不声明**,直接引用全局 `theme.css` 的 `:root`(`:60`)/`:root[data-theme="light"]`(`:275`),已在 `knowledgeStyles.test.ts` 用例钉住「不重复声明 + 确实被引用」。

---

## 2. 搬了哪些类(38 个逐个打勾)

| # | 类 | 状态 |
|---|---|---|
| 1 | `knowledge-app` | ✅(token 声明层 + 壳 shell 布局) |
| 2-7 | `k-rail` `k-rail-head` `k-rail-title` `k-rail-sub` `k-rail-section` `k-rail-nav` | ✅ |
| 8-11 | `k-rail-item` `k-rail-item-label` `k-rail-item-cn` `k-rail-item-en` | ✅(含 `:hover`、`[data-active="true"]`、父级 active 时 `-en` 变色三个变体) |
| 12-16 | `k-rail-svc` `k-rail-svc-row` `k-rail-svc-dot` `k-rail-svc-name` `k-rail-svc-meta` | ✅(`k-rail-svc-dot` 含 `[data-state="paused"]`/`[data-state="error"]` 两态) |
| 17 | `k-rail-foot` | ✅ |
| 18-22 | `k-main` `k-topbar` `k-topbar-title` `k-topbar-sub` `k-topbar-spacer` | ✅ |
| 23-24 | `k-banner` `k-banner-icon` | ✅(含 `[data-tone="info"]` 变体及其嵌套的 `.k-banner-icon` 覆盖) |
| 25-26 | `k-mobile-tabs` `k-mobile-tab` | ✅(含 `[data-active="true"]`、内嵌 `.k-badge` 定位覆盖、两条响应式媒体查询) |
| 27-28 | `k-badge` `k-badge-dot` | ✅(`k-badge-dot` 含 `[data-tone="danger"]`) |
| 29 | `k-btn` | ✅(含 `.ghost`/`.outline`/`.primary` 三个修饰 + `:disabled`;**`.danger` 修饰未搬**,见下) |
| 30-31 | `k-scroll` `k-scroll-inner` | ✅ |
| 32 | `k-skel` | ✅(仅基类,`k-skel-rcard` 未搬) |
| 33-38 | `k-empty` `k-empty-illust` `k-empty-title` `k-empty-sub` `k-empty-tips` `k-empty-tip` | ✅(R1 追加的 6 个) |

**没有出现「混合规则需要拆分」的情况**——T4 范围内没有遇到「白名单类与非白名单类同处一个逗号分隔选择器列表」的写法(如 brief 举例的 `.k-btn, .k-filt-select`)。遇到的都是**后代选择器**形式的未来批次覆盖(如 `.k-filter-bar .k-btn { height: 34px; }`、`.k-pager .k-btn { height: 32px; }`、`.kw-actions .k-btn`、`.kw-pending .k-btn`),这些整条规则都属于尚未引入的父容器(`.k-filter-bar`/`.k-pager`/`.kw-actions`/`.kw-pending`,均不在白名单),按切档判据**整条不搬**,留给引入那些父容器的批次。

### 故意没搬的(蓝本存在但本批排除)

| 类/规则 | 原因 |
|---|---|
| `.k-toast` / `.k-toast-ico` | K3 偏离,改走全局 `useToast()` |
| `.k-banner-close` | 不在附录 D 白名单,且 grep 确认 `KnowledgeLayout.vue`/`DashboardView.vue` 模板均未使用这个类 |
| `.k-skel-rcard` | 不在白名单(只有裸 `k-skel` 在列) |
| `.k-btn.danger`(及其 `:hover`) | 不在白名单的三个修饰(`ghost`/`outline`/`primary`)之列;grep 确认两个模板均未用到 `k-btn danger` |
| `.k-view` | 不在白名单(蓝本用于"根节点包 `.k-scroll`"的场景,本批模板未直接需要) |
| `k2pulse`/`k2spin` 两个 keyframes | 只被 D.2 的 `k2-chip`/`k2-live-ico`(T11 仪表盘批次)引用,不属于 brief Step 1 指定的 1510-1539 读取范围,留给 T11 落地时一并补 |

---

## 3. 自查发现的隐藏坑(未在任务书中出现,自行发现并修正)

附录 B 浅色档表把 `--accent`/`--accent-soft`/`--success` 的取值写成 `var(--全局同名 token)`。但全局 `theme.css` 里这三个 token **名字与本作用域要声明的 token 完全相同**。若照字面写:

```scss
:root[data-theme="light"] .knowledge-app {
  --accent: var(--accent);
}
```

CSS 自定义属性没有"引用外层同名值"的语义——这是一次**自引用循环**,规范规定循环引用的自定义属性计算为 *guaranteed-invalid value*(不是退回继承值!),会导致 `.knowledge-app` 内所有 `var(--accent)` 用法在浅色主题下失效。这正是本任务被反复提醒的那类"单测和 color-guard 都抓不到,只在真机切主题时才炸"的坑——因为声明本身"存在"(不会被"缺少声明"的检查抓到),值也"看起来对"(字面上引用了正确的全局 token 名字),只有真正跑 CSS 层叠计算才会暴露。

**初版修法(已被评审订正,见 §11)**:这三个 token 在浅色声明块里**刻意留空、不重新声明**,理由是"custom property 默认可继承,`.knowledge-app` 是 `:root[data-theme="light"]` 的后代元素,不声明就会正确继承外层浅色值"。**这个推理不成立**——暗色块 `.knowledge-app { … }` 的选择器是无条件的(没有 data-theme 限定),在浅色主题下同样命中这个元素本身,而 custom property 的继承规则是"元素自身有声明时自身声明胜出,根本走不到继承",所以留空实际会被暗色块的字面值直接命中。评审指出后已订正为**在浅色块显式声明字面值**,详见 §11。「自引用循环是真问题」这条判断本身是对的,只是我选的第一个绕开方案(留空靠继承)方向错了。

---

## 4. 类名重名 grep 结果

对全部 38 个白名单类,逐个 grep `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss`:

```
$ for c in knowledge-app k-rail k-rail-head ... k-empty-tip; do
    grep -rn "\.$c\b" src/ai/styles/{agent,settings,skills,sk-shared}-styles.scss 2>/dev/null
  done
done
```

**零命中,无碰撞。**(knowledge 系列一律 `k-` 前缀,与既有三档的 `agent-*`/`set-*`/`sk-*`/`empty-*`/`chan-*` 系命名空间不重叠。)

---

## 5. sass 编译校验

```
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /tmp/p5a-t4-knowledge-check.css
exit=0
$ wc -l /tmp/p5a-t4-knowledge-check.css
671 /tmp/p5a-t4-knowledge-check.css
```

**过程中踩过一个真实语法坑**(值得记录):头稿在一段解释性注释里写了 `k-hero-*/k-quick-grid` 这样的写法——`*` 紧跟 `/` 在 CSS 注释里会被解析成注释的**提前结束符** `*/`,导致该注释在写到一半就"关闭",后面的真实注释文字被当成 SCSS 代码解析,报 `Unexpected ")"`。修法是把所有"类名带星号紧跟斜杠"的写法改写成不产生 `*/` 相邻字符的措辞(如 `k-hero 系列、k-quick-grid`)。修完用一段 Python 脚本扫了全文件 `/*`/`*/` 配对确认无残留。

---

## 6. 附录 D.4 自检

### ① 白名单类逐个存在(38 个,应无输出)

```
$ for c in knowledge-app k-rail k-rail-head k-rail-title k-rail-sub k-rail-section k-rail-nav \
    k-rail-item k-rail-item-label k-rail-item-cn k-rail-item-en k-rail-svc k-rail-svc-row \
    k-rail-svc-dot k-rail-svc-name k-rail-svc-meta k-rail-foot k-main k-topbar k-topbar-title \
    k-topbar-sub k-topbar-spacer k-banner k-banner-icon k-mobile-tabs k-mobile-tab k-badge \
    k-badge-dot k-btn k-scroll k-scroll-inner k-skel k-empty k-empty-illust k-empty-title \
    k-empty-sub k-empty-tips k-empty-tip; do
  grep -q "\.$c\b" src/ai/styles/knowledge.scss || echo "MISSING .$c"
done
```
**输出为空**(全部命中)。

### ② 全部 k-/k2- 类清单(逐个标注)

```
$ grep -oE '\.k2?-[a-z0-9-]+' src/ai/styles/knowledge.scss | sort -u
.k-badge            白名单
.k-badge-dot        白名单
.k-banner           白名单
.k-banner-icon      白名单
.k-btn              白名单
.k-empty            白名单
.k-empty-illust     白名单
.k-empty-sub        白名单
.k-empty-tip        白名单
.k-empty-tips       白名单
.k-empty-title      白名单
.k-main             白名单
.k-mobile-tab       白名单
.k-mobile-tabs      白名单
.k-rail             白名单
.k-rail-foot        白名单
.k-rail-head        白名单
.k-rail-item        白名单
.k-rail-item-cn     白名单
.k-rail-item-en     白名单
.k-rail-item-label  白名单
.k-rail-nav         白名单
.k-rail-section     白名单
.k-rail-sub         白名单
.k-rail-svc         白名单
.k-rail-svc-dot     白名单
.k-rail-svc-meta    白名单
.k-rail-svc-name    白名单
.k-rail-svc-row     白名单
.k-rail-title       白名单
.k-scroll           白名单
.k-scroll-inner     白名单
.k-skel             白名单
.k-topbar           白名单
.k-topbar-spacer    白名单
.k-topbar-sub       白名单
.k-topbar-title     白名单
```
37 条(`knowledge-app` 不含 `k-`/`k2-` 连字符前缀,不匹配这条正则,已由检查①单独覆盖;37+1=38,与白名单总数一致)。**全部在白名单内,没有搬多。**

（初版曾在解释性注释里写过 `.k-banner-close`/`.k-skel-rcard`/`.k-quick-grid`/`.k-status-strip`/`.k-row`/`.k-frow`/`.k2-chip`/`.k2-layer`/`.k2-live-ico` 这些**带前导点**的类名提及,被这条 grep 当成"真实类"抓到过一轮——已改写成不带前导点的纯文字提及,这些类本身在 scss 里从未有过真实规则,纯粹是注释写法问题,已修正并重新验证输出干净。）

---

## 7. RED 探针(两次,均已还原)

### 探针 1 —— 声明块外塞入色字面量

改前(`.k-rail` 规则,线 201):`background: var(--bg-sunken);`
改后:`background: #ff0000;`

跑 `pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts`:
```
Test Files  1 failed (1)
     Tests  1 failed | 6 passed (7)
 FAIL  src/ai/styles/knowledgeStyles.test.ts > knowledge.scss —— 配色硬约束(本档除声明层外无自动守卫,§6 豁免登记）
       > token 声明层之外,全文零色字面量(#hex / rgb() / rgba() / 具名色)
 声明层之外出现 #hex
 expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
```
精确命中「token 声明层之外,全文零色字面量」这一条,其余 6 条仍绿。已还原为 `var(--bg-sunken)`,`git status --short` 确认干净后重跑,7/7 绿。

### 探针 2 —— 删掉 color-scheme 声明

改前:`.knowledge-app` 暗色块末尾 `color-scheme: dark;`
改后:整行删除

跑测试:
```
Test Files  1 failed (1)
     Tests  1 failed | 6 passed (7)
 FAIL  ... > .knowledge-app 两档都显式声明 color-scheme(P2b 教训:嵌套主题作用域不声明会继承 :root)
 暗色档缺 color-scheme: dark
 expect(darkBody).toContain('color-scheme: dark')
```
精确命中「两档都显式声明 color-scheme」这一条,其余 6 条仍绿。已还原,`git status --short` 确认干净后重跑,7/7 绿。

---

## 8. 三门终值(初版,`71ae0ee`)

```
pnpm test                  → Test Files 305 passed (305) / Tests 2732 passed (2732)   exit=0
pnpm exec vue-tsc --noEmit → (无输出)                                                  exit=0
pnpm build                 → ✓ built in 18.63s(仅既有 >500KB chunk 警告)                exit=0
```

基线 `sp8-ai@9a3e938` = 304 文件/2725 例。本任务新增 1 个测试文件(`knowledgeStyles.test.ts`,7 例,**不新增 `.vue`**,color-guard 用例数不变)→ 304+1=305 文件,2725+7=2732 例,与实测完全吻合。本轮无已知噪声用例出现红(`persist.test.ts`/`AgentComposer.test.ts` 均绿,未触发)。

`knowledge.scss` 本任务尚无任何文件 import 它(T10 的 `KnowledgeLayout.vue` 才会 import),`pnpm build` 因此不会把它打进产物——这也是为什么本报告单独跑了 `sass` 编译校验(见 §5)作为唯一能捕获其语法错误的手段。

**评审订正后(`f634b47`)的三门终值见 §11.5,新增 1 条用例后为 305 文件/2733 例。**

---

## 9. 偏离显式申报(§2 三件套)

| # | 偏离 | 依据 | 三件套 |
|---|---|---|---|
| K2 | 主题重写,不用蓝本冷蓝/oklch 原值,不照抄 `[data-theme="dark"] .knowledge-app` 选择器(两边都永不命中) | 用户 D5 | ①头注释② 本报告③ 待协调者登记台账 |
| K3 | `.k-toast`/`.k-toast-ico` 不移植 | 承 P4 D2 | 同上,见 §2「故意没搬」表 |
| R1 | 白名单从 32 加到 38(补 6 个 `k-empty*`) | 协调者拍板 | 已在 `knowledgeStyles.test.ts` 的 `WHITELIST_38` 常量落地 |
| R2 | `*-soft` 家族本地重声明(只声明本批用到的 4 个),`--accent-soft-2` 例外直用全局 | 协调者拍板 | 见 §1 表 + `knowledgeStyles.test.ts` 对应用例 |
| R3 | `.knowledge-app` 两档都显式声明 `color-scheme`,覆盖 brief 模板注释里"无需声明"的论述 | 协调者拍板(覆盖 brief 自身矛盾的说法) | 头注释已写明冲突与裁决依据;`knowledgeStyles.test.ts` 用例钉住 |
| 自查追加 | `--accent`/`--accent-soft`/`--success` 三项浅色档不重新声明(同名 var 自引用循环) | 本任务自行发现,非任务书里的条目 | 见 §3;头注释 + 本报告双重登记 |

**§3.5「照抄不改」N1-N8** 本任务未命中任何一条(那批是 store/组件层的逻辑照抄约定,本任务只产出纯 CSS)。

---

## 10. git 自查

```
$ git show --stat HEAD
commit 71ae0ee...
 src/ai/styles/knowledge.scss          | 534 ++++++++++++++++++++++++++++++++++
 src/ai/styles/knowledgeStyles.test.ts | 133 +++++++++
 2 files changed, 667 insertions(+)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```
提交只含本任务的两个文件,无误带其它会话的在途改动。

---

## 11. 评审 Critical 订正(2026-07-31,提交 `f634b47`)

### 11.1 问题回顾

评审指出:初版在 `:root[data-theme="light"] .knowledge-app` 声明块里刻意**不**声明 `--accent`/`--accent-soft`/`--success`,理由写的是"custom property 默认可继承,不声明就会正确继承到外层 `:root[data-theme="light"]` 的浅色值"。

**这个推理不成立**——关键漏判在于:暗色块 `.knowledge-app { … }` 的选择器**没有任何 `data-theme` 限定**,在浅色主题下同样命中这个元素本身(因为元素本身就带 `.knowledge-app` 这个类,与 `<html>` 上的 `data-theme` 属性无关)。CSS 自定义属性的继承规则是"元素自身在某个匹配规则里有声明时,那条声明胜出,根本不会去看祖先的继承值"。所以浅色块留空的实际效果是:浏览器在给这个元素计算 `--accent` 时,发现暗色块的 `.knowledge-app { --accent: #5E97F2; }` 也命中了同一个元素,于是直接用 `#5E97F2`(暗色蓝),而不是继承到 `:root[data-theme="light"]` 的 `#3b5bdb`。

后果:**浅色主题下知识库区所有强调色按钮/链接/徽标与成功态圆点会用暗色调色板** —— 正是附录 C 验收清单第 11 条要抓的"切浅色后有死角"类回归,且 color-guard 与我自己写的 `knowledgeStyles.test.ts` 都测不到(两者都只查"有没有裸色字面量/token 有没有声明",不查"层叠计算出来的值对不对")。

我原来「同名 var() 是自引用循环」这条判断本身是对的(评审也认可),但从这条正确判断推出的**修法方向选错了**——选择了"留空靠继承",而不是"落字面值"。

### 11.2 三个 token 改前/改后原文

浅色声明块内(`:root[data-theme="light"] .knowledge-app { … }`):

**改前(`71ae0ee`,错误)**:
```scss
  /* --accent / --accent-soft / --success 三项刻意不在本块重新声明 —— 全局
     theme.css 的同名 token(:root[data-theme="light"] 的 --accent:183/--accent-soft:274/
     --success:281)会通过 CSS 继承自然落到这个后代元素上;若写成
     `--accent: var(--accent)` 会是自引用循环(见头注释),不是"引用外层值"。 */

  --accent-hover: var(--accent-text); /* #3550c4,全局"更深强调"档,theme.css:271 */
```

**改后(`f634b47`,订正)**:
```scss
  /* 【评审 2026-07-31 订正】--accent / --accent-soft / --success 必须在本块显式
     声明字面值,不能"留空靠继承"—— 上面的暗色块 `.knowledge-app { … }` 选择器是
     **无条件**的(没有任何 data-theme 限定),在浅色主题下同样命中这个元素本身;
     CSS 自定义属性的继承规则是"元素自身有声明时,自身声明胜出,根本走不到继承",
     所以留空并不会继承到 :root[data-theme="light"] 的浅色值,而是会被暗色块的
     `--accent:#5E97F2`/`--accent-soft:rgba(94,151,242,.14)`/`--success:#4FB870`
     直接命中,浅色主题下的知识库区强调色/成功态反而会用暗色调色板 —— 是本任务
     实测发现的一个真实回归,已用 RED 探针验证(见 knowledgeStyles.test.ts)。
     正确写法是**落字面值**,不写 var():因为这三个 token 与全局 theme.css 同名,
     同名在同一元素上没有"引用外层值"的语义(`var(--accent)` 会是自引用循环,见
     头注释),这与附录 B 表里"全局无同语义 token 时退字面值"是同一处理方式
     (--accent-softer / --text-quaternary / --line-strong / --line-faint /
     --purple/--pink/--teal 全是这个模式),不是新开的例外。
     代价:这三项以后不会跟随全局主题自动改色(其余走 var() 的 token 会);若未来
     要恢复自动跟随,需要给知识库档的 token 改名(如 --k-accent)以消除同名冲突,
     那是独立一期的事,不在本任务范围内。 */
  --accent: #3b5bdb; /* theme.css:183 */
  --accent-soft: rgba(59, 91, 219, 0.11); /* theme.css:274 */
  --success: #15754c; /* theme.css:281 */

  --accent-hover: var(--accent-text); /* #3550c4,全局"更深强调"档,theme.css:271 */
```

头注释(文件顶部大注释块)里对应段落的改前/改后见 §11.3 之后附的完整 `git show f634b47` diff 摘录(head 段落改法与浅色块同源,不重复贴)。

### 11.3 头注释改前/改后(文件顶部大注释块)

**改前**:
```
 * 【自查发现的隐藏坑 —— 3 个同名 var() 自引用】附录 B 浅色档表把 --accent /
 * --accent-soft / --success 的取值写成 "var(--全局同名 token)"。...(略,详见
 * git show 71ae0ee -- src/ai/styles/knowledge.scss)...正确写法是**干脆不在
 * 本作用域重新声明这三个 token**——custom property 默认可继承,.knowledge-app 是
 * `:root[data-theme="light"]` 的后代元素,不声明就会正确继承到外层的浅色值,...
```

**改后**:
```
 * 【自查发现的隐藏坑 —— 3 个同名 token,评审 2026-07-31 订正】附录 B 浅色档表把
 * --accent / --accent-soft / --success 的取值写成 "var(--全局同名 token)"。...
 * 【初版的错误修法,已订正】本档第一版曾选择"干脆不在浅色块重新声明这三个 token,
 * 靠 CSS 继承落到外层浅色值"——这个推理**不成立**:上面的暗色块 `.knowledge-app { … }`
 * 选择器是无条件的(没有任何 data-theme 限定),在浅色主题下同样命中这个元素本身;
 * ...(下略,与 §11.2 浅色块注释同一套论述)
 * 【正确写法】在浅色声明块里**显式声明字面值**(不写 var()):
 * `--accent: #3b5bdb`(theme.css:183)/ `--accent-soft: rgba(59,91,219,0.11)`
 * (theme.css:274)/ `--success: #15754c`(theme.css:281)。...
```

完整逐字 diff 见 `git show f634b47 -- src/ai/styles/knowledge.scss`。

### 11.4 复核 `theme.css` 的输出

```
$ sed -n '178,186p;270,282p' src/styles/theme.css
  /* 2.1 基础色 */
  --bg: #f7f5ef;
  --fg: #1c1b19;
  --fg-muted: #6e6a61;
  --fg-faint: #9a958a;
  --accent: #3b5bdb;
  --accent2: #6e5ae0;
  --good: #15754c;
  --on-accent: #ffffff;
  --hover: rgba(28, 27, 25, 0.045);
  --accent-text: #3550c4;
  --grad-a: #4c6fe8;
  --grad-b: #6e5ae0;
  --accent-soft: rgba(59, 91, 219, 0.11);
  --accent-soft-2: rgba(59, 91, 219, 0.2);
  --accent-soft-bd: rgba(59, 91, 219, 0.3);
  --sem-bg: #e7f5ee; --sem-fg: #15754c; --sem-bd: #b7e2cc;
  ...
  --success: #15754c;
```
确认三个值:`--accent: #3b5bdb`(:183)、`--accent-soft: rgba(59, 91, 219, 0.11)`(:274)、`--success: #15754c`(:281),与协调者给的表完全一致,已抄进浅色声明块。

### 11.5 新增守卫用例原文 + RED 探针

新增用例(`knowledgeStyles.test.ts`,追加在 R2/`--accent-soft-2` 用例之后):
```ts
  it('浅色档必须显式声明 --accent/--accent-soft/--success(不能靠继承,见头注释订正说明)', () => {
    const lightBody = declBlockBody(css, LIGHT_TOKEN_SELECTOR)
    expect(lightBody, '浅色档缺 --accent(会被暗色块的 #5E97F2 命中)').toContain('--accent: #3b5bdb')
    expect(lightBody, '浅色档缺 --accent-soft(会被暗色块的值命中)').toContain('--accent-soft: rgba(59, 91, 219, 0.11)')
    expect(lightBody, '浅色档缺 --success(会被暗色块的 #4FB870 命中)').toContain('--success: #15754c')
    // 反向:确认没有退回自引用循环写法
    expect(lightBody).not.toContain('--accent: var(--accent)')
    expect(lightBody).not.toContain('--accent-soft: var(--accent-soft)')
    expect(lightBody).not.toContain('--success: var(--success)')
  })
```

**RED 探针**:

改前:`--success: #15754c; /* theme.css:281 */`
改后:`/* --success: #15754c; -- RED 探针临时删除 */`

```
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
 FAIL  ... > 浅色档必须显式声明 --accent/--accent-soft/--success(不能靠继承,见头注释订正说明)
 浅色档缺 --success(会被暗色块的 #4FB870 命中)
 expect(lightBody).toContain('--success: #15754c')
```
精确命中新增的那一条,其余 7 条仍绿。已还原为 `--success: #15754c; /* theme.css:281 */`,`git status --short` 确认干净后重跑,8/8 绿。

### 11.6「浅色档还有没有同类问题」核查方式与结论

**核查方式**:写了一段 Python,对 `knowledge.scss` 先剥掉全部 `/* */` 块注释(避免头注释里举例用的 `var(--accent)` 这类文字被误当成真代码扫到),再分别切出暗色块与浅色块的声明体,用正则 `(--[a-zA-Z0-9-]+)\s*:\s*var\((--[a-zA-Z0-9-]+)\)` 抓出所有「属性名: var(某 token)」的声明,标注属性名与 var() 里引用的名字是否相同(同名 = 自引用循环风险)。

```
=== DARK ===
  (no var()-referencing declarations)   # 暗色块全是字面值,不存在自引用风险
=== LIGHT ===
  --bg-app: var(--bg)
  --bg-canvas: var(--bg)
  --bg-elevated: var(--card-bg)
  --bg-sunken: var(--tool-bg)
  --bg-chip: var(--tool-bg-hi)
  --text-primary: var(--fg)
  --text-secondary: var(--fg-muted)
  --text-tertiary: var(--fg-faint)
  --text-on-accent: var(--on-accent)
  --accent-hover: var(--accent-text)
  --warning: var(--toast-warn-fg)
  --danger: var(--toast-danger-fg)
  --line: var(--card-border)
```

**结论**:订正后的浅色块里,所有 `var()` 引用都指向**不同名**的全局 token(如 `--bg-app` 引用 `--bg`、`--warning` 引用 `--toast-warn-fg`),没有第二处同名自引用。`--accent`/`--accent-soft`/`--success` 已改为字面值,不再出现在这份"var() 引用"清单里(本身就是修法的一部分)。**没有其它同类问题需要处理。**

（此前用未剥注释的原始文本跑同一段脚本,曾误报暗色块里有一条 `--accent: var(--accent)`——排查后发现是头注释里举例的那句 `` `.knowledge-app { --accent: var(--accent); }` `` 被正则命中,不是真代码;剥注释重跑后确认是假阳性,已在脚本里加上 comment-stripping 步骤。）

### 11.7 三门终值(评审订正后,`f634b47`)

```
pnpm test                  → Test Files 305 passed (305) / Tests 2733 passed (2733)   exit=0
pnpm exec vue-tsc --noEmit → (无输出)                                                  exit=0
pnpm build                 → ✓ built in 12.07s(仅既有 >500KB chunk 警告)                exit=0
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss ... → exit=0(697 行 CSS)
```

新增 1 条守卫用例 → 305 文件不变(未新增 `.vue`/测试文件),2732→2733(+1),与预期完全吻合。`persist.test.ts`/`AgentComposer.test.ts` 两个已知噪声本轮均未触发(全绿)。

### 11.8 git 自查(订正提交)

```
$ git show --stat HEAD
commit f634b477ab2d77b3182666a036e10f5f1f97cc6a
 src/ai/styles/knowledge.scss          | 56 +++++++++++++++++++++++++----------
 src/ai/styles/knowledgeStyles.test.ts | 18 +++++++++++
 2 files changed, 59 insertions(+), 15 deletions(-)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```
提交只含本任务的两个文件(fixup 提交,未 amend 初版提交,按要求两个提交都保留)。

---

## 12. 评审第二轮订正(2026-07-31,提交 `76367d2`)

评审结论:**Spec 合规通过,Critical 0**(上一轮那条 Critical 已确认修好)。本轮是 4 条 Important + 1 条 Minor 的收尾,另有一条 M2(--accent-soft-2 色相略错配)协调者裁定本轮不改,一条 M3(color-mix 用法未申报)需要补申报——补申报见本节末尾。

### 12.1 发现 1(Important)—— `\b` 边界让 9 个前缀类的存在性断言空转

**问题**:`\b` 在字母切到 `-` 时同样成立,`/\.k-topbar\b/` 能被 `.k-topbar-title` 满足。受影响的 9 个白名单类本身是其它类的前缀:`k-rail`/`k-rail-item`/`k-rail-svc`/`k-topbar`/`k-banner`/`k-badge`/`k-scroll`/`k-mobile-tab`/`k-empty`。

**改前**(`knowledgeStyles.test.ts`):
```ts
it('38 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
  const missing = WHITELIST_38.filter((c) => !new RegExp(`\\.${c}\\b`).test(css))
  expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
})
```

**改后**:
```ts
it('38 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)', () => {
  const missing = WHITELIST_38.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css))
  expect(missing, `缺失的类:${missing.join(', ')}`).toEqual([])
})
```
负向前瞻 `(?![\w-])` 确保右边不能紧跟单词字符或短横线,`.k-topbar` 不会再被 `.k-topbar-title` 满足。

### 12.2 发现 2(Important)—— 色扫跑在剥注释之后,注释里的裸色永远抓不到

**问题**:`stripComments()` 把块注释整体替换成空串后才做色扫,于是任何写进注释里的裸色都测不到。

**改前**:
```ts
const css = stripComments(read('./knowledge.scss'))
...
it('token 声明层之外,全文零色字面量(#hex / rgb() / rgba() / 具名色)', () => {
  const [darkStart, darkEnd] = declBlockRange(css, DARK_TOKEN_SELECTOR)
  const [lightStart, lightEnd] = declBlockRange(css, LIGHT_TOKEN_SELECTOR)
  ...
  const rest = css.slice(0, darkStart) + css.slice(darkEnd, lightStart) + css.slice(lightEnd)
  ...
})
```

**改后**:
```ts
const rawSource = read('./knowledge.scss')
const css = stripComments(rawSource)
...
it('token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)', () => {
  const [darkStart, darkEnd] = declBlockRange(rawSource, DARK_TOKEN_SELECTOR)
  const [lightStart, lightEnd] = declBlockRange(rawSource, LIGHT_TOKEN_SELECTOR)
  ...
  const rest = rawSource.slice(0, darkStart) + rawSource.slice(darkEnd, lightStart) + rawSource.slice(lightEnd)
  ...
})
```
色扫改基于未剥注释的 `rawSource`,区间边界也按 `rawSource` 自己的位置计算(不能借用 `css` 的偏移量,两份文本长度不同)。类名/token 存在性断言(其余 8 条用例)继续用剥过注释的 `css`,各司其职。

### 12.3 发现 3(Important)—— 12 处注释直引 Vue2 原始裸色

逐条改前/改后(文件当前行号):

| 行号 | 改前 | 改后 |
|---|---|---|
| 12(头注释) | `--accent:\n * #007AFF 等)` | `--accent\n * 等原生冷蓝色值)` |
| 293 | `裸 \`white\`(前景)→ token,见附录 B` | `前景裸色 → token,见附录 B` |
| 319 | `裸 rgba(52,199,89,0.18) → 附录 B「0.1x → success-soft」桶` | `绿色半透明光环裸值 → 附录 B「0.1x → success-soft」桶` |
| 324 | `裸 rgba(255,149,0,0.18) → 「0.1x → warning-soft」桶` | `橙色半透明光环裸值 → 「0.1x → warning-soft」桶` |
| 329 | `裸 rgba(255,59,48,0.18) → 「0.1x → danger-soft」桶` | `红色半透明光环裸值 → 「0.1x → danger-soft」桶` |
| 370 | `裸 rgba(255,149,0,0.1) → 「0.1x → warning-soft」桶` | `橙色半透明底色裸值 → 「0.1x → warning-soft」桶` |
| 372 | `裸 rgba(255,149,0,0.3) → 「0.2x~0.3x → warning-soft-border」桶` | `橙色半透明边框裸值 → 「0.2x~0.3x → warning-soft-border」桶` |
| 379 | `裸 rgba(0,122,255,0.25) → 附录 B「0.2x → --accent-soft-2(全局 theme.css token)」` | `蓝色半透明边框裸值 → 附录 B「0.2x → --accent-soft-2(全局 theme.css token)」` |
| 386 | `裸 rgba(255,149,0,0.22) → 「0.2x → warning-soft-border」桶` | `橙色半透明底色裸值 → 「0.2x → warning-soft-border」桶` |
| 419-423(多行) | `裸 rgba(255,255,255,0.6) 前景高光 …(表里的 white 桶只讲…)… --text-on-accent … 纯白 #ffffff …` | `是一处白色半透明高光裸值 …(表里的前景裸色桶只讲…)… --text-on-accent … 纯白色 …` |
| 480 | `裸 \`white\`(前景)→ token` | `前景裸色 → token` |
| 481 | `裸 rgba(0,122,255,0.22) → 「0.2x → --accent-soft-2」` | `蓝色半透明阴影裸值 → 「0.2x → --accent-soft-2」` |

复查(`grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|\bwhite\b|\bblack\b' knowledge.scss`)确认:除头注释里两行(:49-50,给出浅色块字面值本身的说明性引用,协调者未列入本轮要求修改的 12 行)与两个 token 声明块内部之外,规则段落注释里已零命中。

裁定口径(协调者原文)已写进 `knowledgeStyles.test.ts` 配色 describe 块的头部注释,供 T11/T12 续写本档时参照(见 §12.2 改后代码上方新增的口径说明块)。

### 12.4 发现 4(Minor)—— 色扫正则补齐

在发现 2 改后的同一条用例里追加:
```ts
expect(rest, '声明层之外出现 hsl()/hsla()').not.toMatch(/hsla?\(/)
expect(rest, '声明层之外出现 lab()').not.toMatch(/\blab\(/)
expect(rest, '声明层之外出现 lch()').not.toMatch(/\blch\(/)
expect(rest, '声明层之外出现 hwb()').not.toMatch(/\bhwb\(/)
expect(rest, '声明层之外出现 color()').not.toMatch(/\bcolor\(/)
expect(rest, '声明层之外出现具名色 red').not.toMatch(/\bred\b/)
expect(rest, '声明层之外出现具名色 green').not.toMatch(/\bgreen\b/)
expect(rest, '声明层之外出现具名色 blue').not.toMatch(/\bblue\b/)
expect(rest, '声明层之外出现具名色 orange').not.toMatch(/\borange\b/)
expect(rest, '声明层之外出现具名色 gray').not.toMatch(/\bgray\b/)
expect(rest, '声明层之外出现具名色 grey').not.toMatch(/\bgrey\b/)
```
`transparent` 未列入禁用清单——确认过 `.k-empty-illust` 的 `color-mix(in srgb, var(--text-on-accent) 60%, transparent)` 与 `.k-btn.ghost` 的 `border: 1px solid transparent;`(蓝本 :694/:828 逐字照搬)是本档仅有的两处 `transparent` 用法,评审已核实保留。

### 12.5 发现 5(Important,裁定 R4)—— `--shadow-*` 两档分别取值

**复核 `tokens.scss` 行号**:
```
$ grep -n -- '--shadow-xs\|--shadow-sm\|--shadow-md\|--shadow-lg' src/ai/styles/tokens.scss
107:  --shadow-xs: 0 1px 2px rgba(40, 35, 25, 0.04);
108:  --shadow-sm: 0 1px 2px rgba(40, 35, 25, 0.05);
109:  --shadow-md: 0 6px 22px rgba(40, 35, 25, 0.08), 0 1px 2px rgba(40, 35, 25, 0.04);
110:  --shadow-lg: 0 24px 48px rgba(40, 35, 25, 0.10), 0 8px 16px rgba(40, 35, 25, 0.06);
360:  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
361:  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
362:  --shadow-md: 0 8px 28px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3);
363:  --shadow-lg: 0 24px 48px rgba(0, 0, 0, 0.55), 0 8px 16px rgba(0, 0, 0, 0.3);
```
与协调者给的行号(107-110 / 360-363)完全一致。

**`knowledge.scss` 改动**:
- 基础(暗色)块:`--shadow-xs/sm/md/lg` 的值从 `rgba(40,35,25,…)` 改为 `rgba(0,0,0,…)`(取 tokens.scss:360-363)。
- 浅色块:新增声明 `--shadow-xs/sm/md/lg`,取 tokens.scss:107-110(与裁定前旧值相同,只是从"共享"改成"浅色块独立声明")。
- 头注释新增一条 R4 裁定段落,说明覆盖附录 B 原表的理由。
- `.knowledge-app` 壳段基础块内一条既有说明注释(`--r-*`/`--font-*` 结构量段落)顺带扩写,注明 --shadow-* 不再算共享结构量。

**新增守卫用例**(`knowledgeStyles.test.ts`,逐 token 精确比对,见 §12.6 RED 探针 3 的教训):见 §12.6 代码块。

### 12.6 三次 RED 探针(均已还原)

**探针 1 —— 删掉唯一的 `.k-topbar { … }` 规则**

改前(保留 `.k-topbar-title`):
```scss
  .k-topbar {
    height: 56px;
    padding: 0 22px;
    display: flex; align-items: center; gap: 14px;
    border-bottom: 1px solid var(--line-faint);
    background: var(--bg-canvas);
    flex-shrink: 0;
    position: sticky; top: 0;
    z-index: 5;
  }
  .k-topbar-title { font-size: 17px; font-weight: 600; letter-spacing: -0.015em; }
```
改后:整个 `.k-topbar { … }` 块删除,只留 `.k-topbar-title` 一行。

```
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
 FAIL  ... > knowledge.scss —— 附录 D.4 白名单落地(38 个,R1 拍板) > 38 个白名单类全部有对应规则(附录 D.4 自检命令①的常驻版)
AssertionError: 缺失的类:k-topbar: expected [ 'k-topbar' ] to deeply equal []
```
精确命中,其余 8 条仍绿。已还原,`git status --short` 确认干净。

**探针 2 —— 注释里塞裸色**

改前:`/* ---------- Left rail ---------- */`
改后:`/* ---------- Left rail(原 #ff0000 / rgba(255,0,0,0.5) / white,RED 探针临时塞入)---------- */`

```
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
 FAIL  ... > knowledge.scss —— 配色硬约束(本档除声明层外无自动守卫,§6 豁免登记）> token 声明层之外,全文(含注释)零色字面量(#hex / rgb() / hsl() / oklch() / 具名色…)
 声明层之外出现 #hex
 expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
```
精确命中,其余 8 条仍绿。已还原,`git status --short` 确认干净。

**探针 3(自选)—— 改坏 `--shadow-xs` 的浅色值**

这次探针本身暴露了我第一版守卫的弱点:第一版用"lightBody 里某处出现过 `rgba(40,35,25,…)`"这种整块子串检查,4 个 token 共享同一条断言。第一次探针(把浅色块的 `--shadow-xs` 改回暗色值 `rgba(0,0,0,0.4)`)结果 **9/9 仍然全绿**——因为 `--shadow-sm/md/lg` 三个还在暖投影,子串检查仍能在 lightBody 里找到 `rgba(40, 35, 25,`(来自其它三个 token),测不出单独改坏的那一个。

发现空转后,把用例重写成逐 token 精确匹配自己完整的声明行(`--shadow-xs: 0 1px 2px rgba(...);` 整行比对,而不是任意位置的子串),再重跑同一次破坏:

改前(浅色块):`--shadow-xs: 0 1px 2px rgba(40, 35, 25, 0.04); /* AI tokens.scss:107 */`
改后:`--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4); /* RED 探针:临时改回暗色档的值,模拟"两档被合并成一份"回归 */`

```
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
 FAIL  ... > R4 —— --shadow-xs/sm/md/lg 每一个 token 在两档里分别精确取暗/浅两套不同的投影值
AssertionError: 浅色档 --shadow-xs 值不对
expect(lightBody).toContain('--shadow-xs: 0 1px 2px rgba(40, 35, 25, 0.04);')
```
精确命中,其余 8 条仍绿。已还原,`git status --short` 确认干净后重跑,9/9 绿。

（这次"探针先暴露测试本身太弱"的经历本身就是"至少做一次探针"这条要求的价值所在——若只跑一次就通过,不会发现整块子串检查的漏洞。）

### 12.7 补申报(评审 M3)—— `.k-empty-illust` 的 `color-mix()` 用法

之前的报告 §9 遗漏了这条偏离的正式申报,现补上(移植纪律 §2:「未申报的偏离本身就是缺陷」):

- **蓝本原文**(`knowledge.scss:693`):
  ```css
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%),
    var(--grad-iri-soft);
  ```
- **为什么不能直接照抄**:`rgba(255,255,255,0.6)` 是裸色字面量,违反本仓「一切可见颜色必须来自 token」的硬约束;附录 B 的裸色→token 映射表没有覆盖"渐变高光图层"这个具体用法(表里的白色桶只讲"前景色 → `--text-on-accent`",不是给渐变 stop 用的半透明值)。
- **为什么用 `color-mix()`**:`--text-on-accent` 在两档都是不透明的纯白色,与蓝本这处装饰性高光同源(都是"纯白,半透明叠加"),用 `color-mix(in srgb, var(--text-on-accent) 60%, transparent)` 从既有 token 派生出等价的 60% 透明度,不新增自定义属性、不写死颜色字面量,是标准 CSS 函数(非某个库的私有语法)。
- **取值为何等价**:`color-mix(in srgb, white 60%, transparent)` 在数学上等价于 `rgba(255,255,255,0.6)`(60% 不透明的纯白),视觉效果与蓝本原文逐字一致。
- **代码位置**:`src/ai/styles/knowledge.scss` 的 `.k-empty-illust` 规则,`background` 属性第一层。
- **协调者裁定**(本轮回复原文):「取值评审核过等价,但报告 §9 没申报这条偏离——按移植纪律『未申报的偏离本身就是缺陷』。请在报告里补一条正式申报…代码不用改。」本节即补上的正式申报,代码保持不变。

### 12.8 三门终值(本轮,`76367d2`)

```
pnpm test                  → Test Files 305 passed (305) / Tests 2734 passed (2734)   exit=0
                              (首次跑触发已知噪声:AgentComposer.test.ts 的 vue-i18n
                              teardown 竞态,`window is not defined` unhandled rejection,
                              exit=1 但 305/2734 全部显示 passed;复跑一次 exit=0 且无该
                              unhandled error,判定为既有噪声,未改动任何代码)
pnpm exec vue-tsc --noEmit → (无输出)                                                  exit=0
pnpm build                 → ✓ built in 12.04s(仅既有 >500KB chunk 警告)                exit=0
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss ... → exit=0(721 行 CSS)
```

新增 1 条用例(R4 守卫)→ 305 文件不变,2733→2734(+1),与预期吻合。

### 12.9 git 自查(本轮提交)

```
$ git show --stat HEAD
commit 76367d26fed6c664c138fcf091e953e0290fdd28
 src/ai/styles/knowledge.scss          | 67 ++++++++++++++++--------
 src/ai/styles/knowledgeStyles.test.ts | 97 ++++++++++++++++++++++++++++++++---
 2 files changed, 136 insertions(+), 28 deletions(-)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```
提交只含本任务的两个文件(fixup 提交,`71ae0ee`/`f634b47`/`76367d2` 三个提交都保留,未 amend/rebase)。

### 12.10 一处过程中自行发现并修正的语法坑(与本轮评审无关,顺带记录)

在按发现 5 编写 R4 头注释时,再次踩到与初版 §5 相同类型的坑:注释文字里写了 `--r-*/--font-*`(以及跨行的 `--r-*/` + 换行 + `--font-*`),两处 `*` 紧跟 `/` 都会被 sass 解析成注释提前结束符,导致 `Expected "."` 语法错误。已改写措辞避免"星号+斜杠"相邻(如 `--r-系列与 --font-系列`),重新跑 Python 括号配对扫描 + `sass` 编译确认无残留,`sass` exit 0。
