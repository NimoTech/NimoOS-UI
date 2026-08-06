# SP8-P5a Task 4 独立评审 —— `knowledge.scss` token 声明层 + 壳段 + keyframes

评审人:独立评审 agent(Opus 5)· 日期 2026-07-31
被评审提交:`71ae0ee`(初版)+ `f634b47`(评审 Critical 订正)· 分支 `sp8-ai`
产出物:`src/ai/styles/knowledge.scss`(560 行)· `src/ai/styles/knowledgeStyles.test.ts`(151 行)

**判定:Spec 合规 ✅ · 任务质量 通过(带 3 条 Important 收尾)**
Critical 0 条 · Important 3 条 · Minor 3 条 · ⚠️ 待协调者裁定 4 条

蓝本读取方式:`cd /home/nimo/NimoTech/NimoOS-UI && git show main:src/views/AI/Knowledge/styles/knowledge.scss`
(2561 行,落到 scratchpad;**未触碰 NimoOS-UI 工作树**,该仓唯一脏项 `?? FRONTEND_API_GUIDE.md` 是本任务之前就存在的未跟踪文件,与本期无关)。

---

## A. 配色逐行扫(本次评审头号任务)

### A.1 全文色字面量清单(逐行)

扫描命令(比 brief Step 4 更宽,加了 `hsl/hsla`、`transparent` 与 `theme-exception`):

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|\bwhite\b|\bblack\b|\bred\b|\bblue\b|\bgreen\b|\bgray\b|\bgrey\b|\btransparent\b|theme-exception' \
  src/ai/styles/knowledge.scss
```

命中共 78 行,分三类:

| 类别 | 行号 | 判定 |
|---|---|---|
| **① token 声明块内的定义值**(§6 已登记豁免) | 65-69, 71-73, 75-79, 81-84, 86-91, 93-95, 100-102, 113-116, 121-122, 126-129(暗色块 `:64-133`);143-145, 150, 169-171, 174, 178-180, 183-184, 186-188, 191-194(浅色块 `:136-198`) | ✅ 合规 |
| **② 规则段落里的真实声明** | 424 `transparent`(`color-mix(… , transparent)` + `transparent 60%`)· 469 `border: 1px solid transparent` | ✅ 合规。两处都是蓝本原文逐字(蓝本 `:694` / `:828`),`transparent` 是无色相关键字、不是调色板值,§6 禁的是 `#hex/rgb()/rgba()/具名色(white/black)`。**规则段落里带色相的字面量:0 处** |
| **③ 注释里的字面量** | 见 A.2 | ❌ 12 行违规(Important-3) |

**`theme-exception`:0 处命中** ✅(grep 零输出)。

编译后复核(见 §D):对编译产物 `t4.css` 做「按规则拆块 → 剥注释 → 逐块扫字面量」的程序化检查,
**除两个 token 规则块之外,编译后 CSS 里零色字面量**,没有编译后才暴露的问题。

### A.2 注释里的色字面量(逐条核)

治理文件 §6 第 2 条:「注释里也不许出现 Vue2 的原始色字面量,改写成『引 Vue2 `file:line` + 中文描述颜色』」。

**违规(引用了 Vue2 蓝本原始裸色 —— 应改写成「行号 + 中文描述」):**

| 行 | 内容 | 建议改法 |
|---|---|---|
| 12 | `--accent: #007AFF 等` | →「蓝本 `:24` 起自带一套冷蓝 accent」 |
| 293 | 蓝本 `:145` 裸 `` `white` `` | →「蓝本 `:145` 前景裸纯白」 |
| 319 | 蓝本 `:172` 裸 `rgba(52,199,89,0.18)` | →「蓝本 `:172` 裸绿色 18% 透明光圈」 |
| 324 | 蓝本 `:176` 裸 `rgba(255,149,0,0.18)` | →「蓝本 `:176` 裸橙色 18% 透明光圈」 |
| 329 | 蓝本 `:180` 裸 `rgba(255,59,48,0.18)` | →「蓝本 `:180` 裸红色 18% 透明光圈」 |
| 370 | 蓝本 `:223` 裸 `rgba(255,149,0,0.1)` | →「蓝本 `:223` 裸橙色 10% 透明底」 |
| 372 | 蓝本 `:224` 裸 `rgba(255,149,0,0.3)` | →「蓝本 `:224` 裸橙色 30% 透明描边」 |
| 379 | 蓝本 `:230` 裸 `rgba(0,122,255,0.25)` | →「蓝本 `:230` 裸蓝色 25% 透明描边」 |
| 386 | 蓝本 `:236` 裸 `rgba(255,149,0,0.22)` | →「蓝本 `:236` 裸橙色 22% 透明底」 |
| 419 / 421 | 蓝本 `:693` 裸 `rgba(255,255,255,0.6)`;`纯白 #ffffff` | →「蓝本 `:693` 裸纯白 60% 透明高光」 |
| 480 | 蓝本 `:839` 裸 `` `white` `` | →「蓝本 `:839` 前景裸纯白」 |
| 481 | 蓝本 `:840` 裸 `rgba(0,122,255,0.22)` | →「蓝本 `:840` 裸蓝色 22% 透明投影」 |

= **12 行**。这批字面量还会**原样进构建产物**(sass 保留 `/* */` 块注释,实测编译后 CSS 里仍在)。
影响:纯规范违规,零视觉影响。但 `.vue` 里同样的写法会被 `color-guard.test.ts` 判红,
`.scss` 只是恰好没有守卫 —— 正是本档「靠人肉评审」的部分。

**另 12 行引用的是 New-UI 自己的 token 值**(不是 Vue2 原始色):
`:49`(`#3b5bdb` / `rgba(59,91,219,0.11)`)· `:50`(`#15754c`)· `:137`(`#f7f5ef`)· `:139`(`#ffffff`)·
`:140`(`#f0eee8`)· `:141`(`#e7e3d9`)· `:158`(`#5E97F2`/`rgba(94,151,242,.14)`/`#4FB870`)·
`:173`(`#3550c4`)· `:176`(`#92600c`)· `:177`(`#c0392b`)· `:182`(`#e7e3d9`)· `:421`(`#ffffff`)。
这些是「`var()` 指向的全局 token 当前解析到什么值」的可读性注解,**不是 §6 字面禁止的「Vue2 原始色字面量」**
→ 列入 ⚠️ 待裁定 B,不按缺陷报。

### A.3 token 取值逐条回源核(不采信行尾注释)

自己打开 `src/ai/styles/tokens.scss` 与 `src/styles/theme.css` 逐条对。

**暗色(基础)块 → `tokens.scss` 暗色块**(实测该块选择器是
`.agent-app[data-theme="dark"], .ai-toast-scope[data-theme="dark"]`,`:250-365`;
报告/R2 里写的 `:250` 起没错,但选择器不是「`.agent-app, .ai-toast-scope` 的暗色块」而是带
`[data-theme="dark"]` 的容器态 —— 对 R2 的结论无影响:两个选择器都不是 `.knowledge-app`):

| knowledge.scss | 值 | tokens.scss 暗色实测 | 核 |
|---|---|---|---|
| `--bg-app` / `--bg-canvas` | `#1C1C1E` | `#1C1C1E` | ✅ |
| `--bg-elevated` / `--bg-sunken` / `--bg-chip` | `#242426` / `#161617` / `#2A2A2C` | 同 | ✅ |
| `--glass-strong/medium/weak` | `rgba(28,28,30,0.82/0.6/0.45)` | 同 | ✅ |
| `--text-primary/secondary/tertiary/quaternary` | `#E9E7E3` / `#A3A09A` / `#6E6C68` / `#4D4B48` | 同 | ✅ |
| `--text-on-accent` | `#ffffff` | 同 | ✅ |
| `--accent` / `-hover` / `-soft` / `-softer` | `#5E97F2` / `#7AABF5` / `rgba(94,151,242,0.14)` / `…0.10` | 同 | ✅ |
| `--success` / `--warning` / `--danger` | `#4FB870` / `#E0A53B` / `#F0776B` | 同 | ✅ |
| `--purple` / `--pink` / `--teal` | `#AF52DE` / `#FF2D55` / `#30B0C7` | 暗色块未重定义,浅色块 `:71-73` 即此三值 | ✅ 注释「两档同值」属实 |
| `--line` / `-strong` / `-faint` | `#2E2E31` / `#3A3A3D` / `#262628` | 同 | ✅ |
| `--warning-soft` / `-border` | `rgba(224,165,59,0.18)` / `…0.3` | `:303/:304` 同 | ✅ |
| `--success-soft` / `--danger-soft` | `rgba(79,184,112,0.18)` / `rgba(240,119,107,0.16)` | `:306/:308` 同 | ✅ |
| `--grad-iri` / `-soft` | `tokens.scss:119-120` 原文 | 暗色块未重定义 → 主题不变量 | ✅ |
| `--shadow-xs/sm/md/lg` | `tokens.scss:107-110`(浅色暖投影) | **暗色块 `:360-363` 另有一套** `rgba(0,0,0,0.4…)` | ⚠️ 见待裁定 A |
| `--ly-*` 九个 | `oklch(0.78 0.11 80)` 等 | 蓝本 `:2445-2447` 逐字 | ✅ 已回蓝本核 |
| `--r-*` 七个 / `--font-sans/mono` | 结构量 | 蓝本 `:40-46` / `:53-54` 逐字 | ✅ |

**浅色块 → `theme.css :root[data-theme="light"]`**,每个被 `var()` 引用的全局 token 都亲自 grep 确认存在
(引一个不存在的 token = 静默失效,本项零命中):

| 引用 | theme.css 浅色实测行 | 值 | 核 |
|---|---|---|---|
| `var(--bg)` | `:179` | `#f7f5ef` | ✅ |
| `var(--card-bg)` | `:200` | `#ffffff` | ✅ |
| `var(--tool-bg)` / `var(--tool-bg-hi)` | `:222` / `:223` | `#f0eee8` / `#e7e3d9` | ✅ |
| `var(--fg)` / `var(--fg-muted)` / `var(--fg-faint)` | `:180/:181/:182` | `#1c1b19` / `#6e6a61` / `#9a958a` | ✅ |
| `var(--on-accent)` | `:186` | `#ffffff` | ✅ |
| `var(--accent-text)` | `:271` | `#3550c4` | ✅ |
| `var(--toast-warn-fg)` / `var(--toast-danger-fg)` | `:217` / `:219` | `#92600c` / `#c0392b` | ✅ |
| `var(--card-border)` | `:204` | `#e7e3d9` | ✅ |
| `var(--accent-soft-2)`(规则段落用) | `:60`(暗) / `:275`(浅) | `rgba(138,180,255,0.24)` / `rgba(59,91,219,0.2)` | ✅ 两档都在 |

**协调者拍板的三项字面值(替代附录 B 的自引用循环写法)—— 回 `theme.css` 复核:**
`--accent: #3b5bdb`(`theme.css:183` ✅)· `--accent-soft: rgba(59, 91, 219, 0.11)`(`:274` ✅)·
`--success: #15754c`(`:281` ✅)。**三项都按拍板落地,逐字符一致。** 且浅色块里没有退回
`--accent: var(--accent)` 这类自引用(测试也有反向断言 `not.toContain`)。✅

**R2 那批 `*-soft`:**
① 实现者说「只用到 4 个」—— 自己核:两档各 4 个(`--warning-soft` / `--warning-soft-border` /
`--success-soft` / `--danger-soft`),取值逐条对上 `tokens.scss:303/304/306/308`(暗)与
`:126/127/129/131`(浅)✅。
② **规则段落里实际引用到的 token 是否都在声明层里声明了** —— 程序化提取(剥注释后,取浅色块结束
之后的全部内容里的 `var(--x)`):**共 31 个引用**,逐个对声明层:

```
--accent ✅  --accent-hover ✅  --accent-soft ✅  --accent-softer ✅
--accent-soft-2 → 本档不声明(R2 例外,全局 theme.css :60/:275 两档都有)✅
--bg-app ✅ --bg-canvas ✅ --bg-chip ✅ --bg-elevated ✅ --bg-sunken ✅
--danger ✅ --danger-soft ✅ --font-sans ✅ --grad-iri-soft ✅
--line ✅ --line-faint ✅ --line-strong ✅ --r-md ✅ --r-pill ✅ --r-sm ✅
--shadow-xs ✅ --success ✅ --success-soft ✅ --text-on-accent ✅
--text-primary ✅ --text-quaternary ✅ --text-secondary ✅ --text-tertiary ✅
--warning ✅ --warning-soft ✅ --warning-soft-border ✅
```

**结论:规则段落引用到但声明层没声明的 token = 无(0 个)。真机上不存在「该处透明」的风险。**
`var(--modal-scrim)` 本档未使用(附录 B 提到它是给后续批次的)。

### A.4 浅色档完整性 —— 两栏差集表(自己做,不采信报告)

判据:自定义属性「元素自身有声明就走不到继承」;基础块选择器 `.knowledge-app` **无 `data-theme` 限定**,
浅色主题下同样命中该元素 → 浅色块漏声明哪个,那个就取暗色值。

程序化提取两块的 `--x:` 全集(剥注释后):

- 基础块声明 **54** 个 token,其中结构量 9 个(`--r-xs/sm/md/lg/xl/2xl/pill`、`--font-sans`、`--font-mono`)
  → **颜色/视觉类 45 个**
- 浅色块声明 **39** 个(全为颜色类)
- **差集(基础块有、浅色块无)= 6 个**:

| token | 是否「只在暗色下用到 / 无需浅色值」 | 判定 |
|---|---|---|
| `--grad-iri` | 主题不变量:`tokens.scss` 暗色块也不重定义(全档只有 `:119`);且本批规则段落根本没引用它(只引 `-soft`) | ✅ 不是漏 |
| `--grad-iri-soft` | 同上(`tokens.scss:120` 单份),品牌渐变族,与 `theme.css` 的 `.ic-*` 例外同性质 | ✅ 不是漏 |
| `--shadow-xs` | **两档取值应不同**:`tokens.scss` 浅色 `:107` = `rgba(40,35,25,0.04)`,暗色 `:360` = `rgba(0,0,0,0.4)`。本档把**浅色值**放进了**暗色(基础)块**,浅色块不声明 → 浅色主题恰好取对、**暗色主题取错** | ⚠️ 待裁定 A(附录 B 明令如此,实现者合规) |
| `--shadow-sm` | 同上(`:108` vs `:361`);本批未被引用,T11 会用 | ⚠️ 同上 |
| `--shadow-md` | 同上(`:109` vs `:362`);本批未引用 | ⚠️ 同上 |
| `--shadow-lg` | 同上(`:110` vs `:363`);本批未引用 | ⚠️ 同上 |

**反向差集(浅色块有、基础块无)= 0 个** ✅(不存在「只有浅色档有、暗色档裸奔」的 token)。
**两块内各自零重复声明** ✅(`Counter` 检查 dup = 空)。

结论:**差集 6 个,其中「真漏了」0 个**(2 个是主题不变量、4 个是附录 B 明令共享但选值有争议)。
上一轮评审逮到的 `--accent`/`--accent-soft`/`--success` Critical **已确实修复**并有用例钉住。

### A.5 `color-scheme` 两档

`:132` `color-scheme: dark`(基础块)· `:197` `color-scheme: light`(浅色块)✅。
两档都在,且 `knowledgeStyles.test.ts:106-111` 有用例钉住。
注:**brief Step 2 的模板注释写的是「为什么不声明 color-scheme」**,与治理文件 §6/R3 冲突;
治理文件优先,实现者按 §6 声明并在报告 §9 显式申报了这处 brief 自相矛盾 ✅(处理正确)。

---

## B. 类与规则的搬运正确性

### B.1 38 个白名单类逐个存在 + 有没有搬多

```bash
grep -oE '\.k2?-[a-z0-9-]+|\.knowledge-app' src/ai/styles/knowledge.scss | sort -u
```
输出 **38 个,与 R1 白名单(附录 D.1 的 32 + 6 个 `k-empty*`)完全一致 —— 一个不多一个不少**。
`.k-toast` / `.k-toast-ico`:**0 处** ✅(偏离 K3 落地)。
附录 D.1 我自己数过 = 32 个,测试常量 `WHITELIST_38` 也是 32+6 = 38,与 R1 吻合 ✅。

顺带核对白名单边界:
- `.k-view`(蓝本 `:253-257`)未搬 → 自己 `git grep 'k-view' main` 确认它只出现在
  `AllowlistView/IndexedFilesView/NotesView/QueueView/RootsView/SettingsView`(后续批次),
  `KnowledgeLayout.vue` 与 `DashboardView.vue` 都不用 → **正确不搬** ✅
- `.k-banner-close`(蓝本 `:241-248`)未搬 → 两个模板都不用 ✅(实现者在 `:392-393` 留了注释说明)
- `.k-skel-rcard`(蓝本 `:726-732`)未搬 ✅ · `.k-suggest-chip` 属 D.2(T11)未搬 ✅

### B.2 逐行 diff 式比对(全部 38 个,不是抽查 10 个)

方法:程序化定位蓝本与实现里同名选择器的完整块(按花括号配平),剥注释、折叠空白后逐行 diff。

**IDENTICAL(逐字等价)31 个**:
`.knowledge-app` 壳段根声明(蓝本 `:60-79` → impl `:204-223`,含 `minmax(0,1fr)` 那段英文注释、
`*/*::before/*::after`、`button`、`input` 三条重置)· `.k-rail` · `.k-rail-head` · `.k-rail-title` ·
`.k-rail-sub` · `.k-rail-section` · `.k-rail-nav` · `.k-rail-item`(含 `&:hover` 与
`&[data-active="true"]` 两态)· `.k-rail-item-label` · `.k-rail-item-cn` · `.k-rail-item-en` ·
`.k-rail-item[data-active="true"] .k-rail-item-en` 复合规则 · `.k-badge-dot`(含 `&[data-tone="danger"]`)·
`.k-rail-svc` · `.k-rail-svc-row` · `.k-rail-svc-name` · `.k-rail-svc-meta` · `.k-rail-foot` ·
`.k-main` · `.k-topbar` · `.k-topbar-title` · `.k-topbar-sub` · `.k-topbar-spacer` · `.k-banner-icon` ·
`.k-scroll` · `.k-scroll-inner` · `.k-empty` · `.k-empty-title` · `.k-empty-sub` · `.k-empty-tips` ·
`.k-empty-tip` · `.k-skel` · `.k-mobile-tabs` · `.k-mobile-tab`(含 `&[data-active="true"]` 与嵌套
`.k-badge` 绝对定位)。

**DIFFERS 的 5 个 —— 每一处差异都且仅是附录 B 授权的「裸色 → token」替换:**

| 类 | 蓝本 | 实现 | 判定 |
|---|---|---|---|
| `.k-rail-svc-dot`(bp `:172`) | `box-shadow: 0 0 0 3px rgba(52,199,89,0.18)` / `rgba(255,149,0,0.18)`(paused) / `rgba(255,59,48,0.18)`(error) | `var(--success-soft)` / `var(--warning-soft)` / `var(--danger-soft)` | ✅ 附录 B「0.1x → *-soft」桶,三态齐 |
| `.k-banner`(bp `:219`) | `rgba(255,149,0,0.1)` / `1px solid rgba(255,149,0,0.3)`;`[data-tone="info"]` 的 `border-color: rgba(0,122,255,0.25)` | `var(--warning-soft)` / `var(--warning-soft-border)` / `var(--accent-soft-2)` | ✅ 三个桶都对上 |
| `.k-badge`(bp `:142`) | `color: white` | `var(--text-on-accent)` | ✅ 附录 B「white(前景)→ --text-on-accent」 |
| `.k-btn`(bp `:818`) | `.primary`:`color: white` + `box-shadow: 0 2px 6px rgba(0,122,255,0.22)`;另有整段 `&.danger` | `var(--text-on-accent)` + `var(--accent-soft-2)`;`&.danger` 整段未搬 | ✅(见下) |
| `.k-empty-illust`(bp `:690`) | `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%)` | `radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--text-on-accent) 60%, transparent), transparent 60%)` | 值等价(两档 `--text-on-accent` 都是 `#ffffff`),但映射表没覆盖此用法 → Minor-3 |

`.k-btn` 三修饰 `ghost` / `outline` / `primary` **全在**(附录 D.3 要求),`danger` 未搬 ——
自己回两个模板核:`KnowledgeLayout.vue` 只用 `k-btn ghost`,`DashboardView.vue` 用 `k-btn outline` 与
`k-btn primary`,**`k-btn danger` 两个模板都不用** → 正确不搬 ✅(顺带避开了蓝本 `:846` 的裸色 `#e6342a`)。

### B.3 附录 D.3 属性态逐个点名核

| D.3 要求 | 蓝本实况(自己 grep) | 实现 | 判定 |
|---|---|---|---|
| `[data-active]` — rail 项 | `.k-rail-item &[data-active="true"]`(bp `:122`)+ 复合规则 `.k-rail-item[data-active="true"] .k-rail-item-en`(bp `:140`) | `:266-270` + `:284` | ✅ 两条都在 |
| `[data-active]` — 移动端 tab | `.k-mobile-tab &[data-active="true"]`(bp `:1476`) | `:515` | ✅ |
| `[data-tone]` — `k-badge` | **蓝本没有 `.k-badge[data-tone]` 规则**(`KnowledgeLayout.vue:24-25` 确实往 `.k-badge` 上传 `:data-tone`,但 scss 里无对应规则 → 该属性在 Vue2 里是惰性的) | 同样没有 | ✅ 1:1 照抄;D.3 此处措辞不准,不是实现漏搬 |
| `[data-tone]` — `k-badge-dot` | `&[data-tone="danger"]`(bp `:159`) | `:303` | ✅ |
| `[data-tone]` — `k-banner` | 只有 `&[data-tone="info"]`(bp `:228-232`,含嵌套 `.k-banner-icon` 改色) | `:377-382` 完整含嵌套 | ✅。注:`KnowledgeLayout.vue:66` 传的是 `data-tone="warn"` → 无对应规则、落回基类橙色,**这是 Vue2 现状,照抄正确** |
| `[data-state]` — `k-rail-svc-dot` **三态** | 蓝本只有 `paused`(`:177`)与 `error`(`:181`)两个属性态;`svcState()`(`KnowledgeLayout.vue:155-159`)返回 `error`/`paused`/`running`,**`running` 走基类绿点**(蓝本无 `[data-state="running"]` 规则 —— `:895` 那条是 `.k-row-status` 的,不同类) | `:322-331` 两个属性态齐,基类绿点在 `:318` | ✅ 三态视觉齐全;D.3 的「三态」= 基类 + 2 个属性态,不是漏搬 |
| `k-btn` 三修饰 | bp `:825/831/837` | `:466/472/478` | ✅ |

**属性态漏搬:0 个。**

### B.4 混合规则拆分(自己 grep,不信报告)

在蓝本里找「选择器列表带逗号」的规则:

```bash
grep -nE '^\s*[^/*@].*,.*\{' blueprint.scss
```
全文命中 6 处:`:1347`(`.k-field input[type="text"], …`)· `:2097`(`.kn-note-row[data-s="archived"] .kn-note-title, …`)·
`:2490` / `:2493` / `:2496` / `:2505`(全是 `.kw-md hN` / `.kw-md ul,ol` / `.kw-md th,td`)。
**没有一条包含 38 个白名单里的任何类** → 实现者「无混合规则需拆」**属实** ✅。

### B.5 K2 选择器偏离

`grep -n 'data-theme' src/ai/styles/knowledge.scss` → 只有 `:136` 的 `:root[data-theme="light"] .knowledge-app`
是真选择器,其余 6 处都在注释里。**零 `[data-theme="dark"] .knowledge-app`** ✅。
蓝本自带的 4 条该形态规则:`:2444`(`--ly-*` 暗色微调)→ 已并进基础(暗色)块 ✅;
`:2449` / `:2450`(`.k2-chip[data-tone]`)· `:2451`(`.k2-ob-layer .k2-tag`)→ 都是 D.2 的 `k2-*` 类,归 T11 ✅。

### B.6 类名重名 / 作用域串号

程序化提取 `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` / `tokens.scss`
里声明的全部类名,与 38 个白名单求交集:

```
agent-styles.scss    -> collisions: NONE
settings-styles.scss -> collisions: NONE
skills-styles.scss   -> collisions: NONE
sk-shared.scss       -> collisions: NONE
tokens.scss          -> collisions: NONE
```
**零重名** ✅(`k-*` 前缀在本仓是全新命名空间)。

反向风险也核了:`agent-styles.scss` 里有裸元素选择器 `button {}`(`:30`)· `input, textarea {}`(`:38`)·
`a {}`(`:932`)· `button {}`(`:1228`),它们都嵌在 `.agent-app` 下。
`.knowledge-app` 会是**独立路由根**(`AgentPage.vue:328` / `SettingsPage.vue:383` 各自是 `.agent-app` 根,
不互相包含),不会渲染在 `.agent-app` 子树里 → 不存在 P3a I1 那种 `.agent-app .empty-*` 捞走的问题 ✅。

### B.7 全局 keyframes

蓝本 `:1510-1538` 共 7 条,**全部搬到,逐字一致**:
`k-float` · `k-pulse-orb` · `k-pulse` · `k-shimmer` · `k-fade-in` · `k-modal-pop` · `k-toast-rise`
(impl `:531-558`,顶层、未嵌进 `.knowledge-app` ✅)。

未搬的:
- `k2pulse` / `k2spin`(蓝本 `:2440-2441`)—— 协调者已定属 T11,**本任务不搬是对的** ✅
- `k-drawer-fade` / `k-drawer-in`(蓝本 `:1541-1545`)—— 属「文件聚合搜索:匹配药丸 + 详情抽屉」段(P5b);
  自己核了 38 个白名单类的规则里**没有任何一处引用它们** → 正确不搬 ✅
- `k-shimmer` 是本批 `.k-skel`(`:453`)唯一引用的 keyframe,已在 ✅

---

## C. 测试质量(R3 那份守卫)

`knowledgeStyles.test.ts` 共 **8 条**用例(白名单 3 条 + 配色 5 条)。

**做对的:**
- ✅ 用 `node:fs` + `import.meta.url`/`fileURLToPath` 读文件(`:11-18`),**没有**用 Vite `?raw`
  (P2a 栽过的 CSSEnablerPlugin 空串坑)。我的 RED 探针能报红 → 反证读到的内容非空。
- ✅ 断言前剥了注释(`stripComments`,`:23-27`:块注释 + 整行 `//`)—— 对 `toContain` 类断言是必要的,
  否则注释里提到的类名会撞对(P2b 实证)。
- ✅ 「零色字面量」的**豁免范围精确限定在两个声明块内**:`declBlockRange` 按
  「selector 字面量 → 下一个行首 `}`」取区间,`rest` = 三段拼接(块前 + 两块之间 + 浅色块后),
  且有 `expect(darkEnd).toBeLessThanOrEqual(lightStart)` 钉住两块顺序不重叠。**范围没写宽** ✅。
  我实测:在规则段落里塞 `color: #ff0000` → **精确报红**(见 D.2 探针 2b)。
- ✅ 有反向断言(`--accent-soft-2` 不重复声明 + 壳段确实引用它;浅色块不得退回 `var(--accent)` 自引用)。
- ✅ `k-toast` 用 `not.toMatch(/\.k-toast\b/)`,「搬多了」用集合差 —— 两条都有判别力。

**问题(Important):**

**I1 —— `\b` 让 9/38 个类的「存在性」断言失去判别力(`knowledgeStyles.test.ts:51`)。**
```ts
const missing = WHITELIST_38.filter((c) => !new RegExp(`\\.${c}\\b`).test(css))
```
JS 正则里 `-` **不是**单词字符,所以 `\b` 会在 `k-topbar` 与 `-title` 之间成立
→ `/\.k-topbar\b/.test('.k-topbar-title') === true`(我用 node 单独验过)。
后果:凡是「本身是另一个白名单类的严格前缀」的类,删掉它整条规则也测不出来。命中 9 个:
`k-rail`(被 `k-rail-head` 等撞对)· `k-rail-item` · `k-rail-svc` · `k-topbar` · `k-banner` ·
`k-badge` · `k-scroll` · `k-mobile-tab` · `k-empty`。
**RED 实证**:删掉全档**唯一**一条 `.k-topbar { height:56px; …sticky…border-bottom… }` 规则
(topbar 会丢掉 56px 高度、粘顶与下边框 = 显眼回归)→ **8/8 全绿**。
应改成 `new RegExp('\\.' + c + '(?![\\w-])')`。

**I2 —— 「零色字面量」那条对注释完全免疫(`:29` + `:91-104`)。**
`const css = stripComments(read(...))` 在**所有**断言之前就剥掉了注释,所以注释里的裸色扫不到。
治理文件 §6 明确「注释里也不许出现 Vue2 的原始色字面量」,`.vue` 那边 `color-guard.test.ts`
**不跳注释行**正是为此。
**RED 实证**:在规则段落插入 `/* RED probe: 原 #ff0000 / rgba(255,0,0,0.5) / white */` → **8/8 全绿**
(按 §6 应当报红)。这正好放过了 A.2 那 12 行现存违规。
应改成:色字面量那一条改用**原始文本**(只切掉两个声明块),`toContain` 类断言继续用剥注释的副本。

**问题(Minor):**

**M1 —— 具名色 / 颜色函数覆盖不全(`:99-103`)。** 只查 `#hex` / `rgba?\(` / `oklch\(` / `white` / `black`。
brief Step 4 自己的 grep 还包含 `red|green|blue|orange|gray|grey`,而 `hsl()` / `hsla()` / `lab()` /
`lch()` / `hwb()` / `color()` 全没覆盖。建议按 brief Step 4 补齐具名色表 + 补 `hsla?\(|lab\(|lch\(|hwb\(|color\(`。

**空转 / 削弱既有断言:** 逐条看过,无空转(每条都被我或实现者的探针证明能报红,除 I1/I2 指出的盲区);
未删改任何既有用例(`git show --stat` 两个提交只有新增行 + 订正块,无其它测试文件改动)✅。

---

## D. 编译与三门 + 探针

### D.1 sass 独立编译(本批无人 import,`pnpm build` 编译不到它)

```
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /tmp/…/t4.css
→ sass exit=0(零告警、零输出)
→ 产物 697 行;grep -c 'var(--' = 95
```
编译后复核:
- `@media (max-width: 860px)` 正确展开成 `.knowledge-app { grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) 60px }`
  + `.knowledge-app .k-rail{display:none}` + `.knowledge-app .k-mobile-tabs/.k-mobile-tab` ✅
  (蓝本那两条根级声明在 `@media` 里没有丢)
- `@media (min-width: 861px)` 也在 ✅
- 程序化「按规则拆块 → 剥注释 → 扫字面量」:**除 `.knowledge-app` 与
  `:root[data-theme=light] .knowledge-app` 两个 token 规则外,零色字面量** ✅ —— 无编译后才暴露的问题
- 唯一编译期观察:sass 保留了 `/* */` 块注释,A.2 那 12 行 Vue2 原始裸色会**进构建产物**

### D.2 我自己的 RED 探针(不复用实现者的三次)

| # | 破坏什么 | 结果 | 还原 |
|---|---|---|---|
| 1 | 删掉全档唯一的 `.k-topbar-spacer { flex: 1; }` | ✅ **精确报红**:`× 38 个白名单类全部有对应规则` / `AssertionError: 缺失的类:k-topbar-spacer: expected [ 'k-topbar-spacer' ] to deeply equal []`(1 failed / 7 passed) | ✅ `git checkout --`,`git status` 干净 |
| 2 | 在规则段落插入块注释 `/* RED probe: 原 #ff0000 / rgba(255,0,0,0.5) / white */` | ❌ **没报红,8/8 全绿** → 守卫盲区(Important I2) | ✅ 已还原 |
| 2b | 同一位置改成真实声明 `color: #ff0000` | ✅ **精确报红**:`× token 声明层之外,全文零色字面量` / `声明层之外出现 #hex`(1 failed / 7 passed) | ✅ 已还原 |
| 3 | 删掉 `.k-rail { … }` 主规则(`@media` 里还留着 `.k-rail{display:none}`) | ❌ 没报红(此例不足以证明 `\b` 洞,因为 `.k-rail` 字面仍在) | ✅ 已还原 |
| 3b | 删掉全档**唯一**的 `.k-topbar { height:56px; …position:sticky; border-bottom… }`,`.k-topbar-title` 保留 | ❌ **没报红,8/8 全绿** → `\b` 前缀洞实证(Important I1);另用 node 单独验 `/\.k-topbar\b/.test('.k-topbar-title') === true` | ✅ 已还原 |

**最终还原确认**:`diff -q` 与探针前的副本 **byte-identical**;`git status --short` 与 `git diff --stat` 均**空**。
**评审期间未做任何提交、未留下任何改动。**

### D.3 全量三门(自己跑,不采信报告)

```
pnpm test                  → Test Files 305 passed (305) / Tests 2733 passed (2733)   exit=0
pnpm exec vue-tsc --noEmit → exit=0(日志 0 行)
```
与实现者报的 **305 文件 / 2733 例**逐字吻合。
算术复核:T4 前基线 304 文件 / 2725 例;本任务不新增 `.vue`(`color-guard.test.ts` 动态用例数不变),
新增 1 个测试文件 + 8 条用例 → 305 / 2733 ✅。
**已知噪声本轮均未触发**(`src/files/upload/persist.test.ts` 与 `AgentComposer.test.ts` 全绿),零红项。
`pnpm build` 按 brief 未重跑(实现者已跑 exit 0;且本档还没人 import,build 编译不到它 —— 故我改用 D.1 的
独立 sass 编译来补这一层)。

### D.4 提交卫生

```
f634b47 fix(knowledge): 浅色档必须显式声明 --accent/--accent-soft/--success(评审 Critical 订正)
        → knowledge.scss | 56 ++++---   knowledgeStyles.test.ts | 18 ++++     (2 files)
71ae0ee feat(knowledge): SP8-P5a knowledge.scss token 声明层 + 壳段 + keyframes
        → knowledge.scss | 534 +++++    knowledgeStyles.test.ts | 133 +++++   (2 files)
git status --short → 空
```
✅ 两个提交各自只含本任务那 2 个文件,无误带其它会话在途改动。
✅ `NimoOS-UI`:`HEAD=61921d22`(SP7 的 docs 提交),**无本任务提交**;唯一脏项是本任务之前就存在的
`?? FRONTEND_API_GUIDE.md`(未跟踪,未被碰)。
✅ `.sp8/NimoOS-Service`:`HEAD=03d3028`(T2 的 wiki 收尾),**无本任务新提交**,`git status` 干净。

### D.5 §3.5 那 8 条

N1-N8 全是 store / 组件层的逻辑照抄约定(`loadAllowlist` 布尔归一化、`DashboardView` 三个不下发字段、
`Promise.all().finally`、`loadDistillJobs` 不对称、`d.total`、404→null、Go nil slice 兜底、rail 第 9 项措辞)。
**本任务只产出纯 CSS + 一个测试文件,一条都不命中**,不存在「顺手修正」。✅
移植纪律「界面 1:1 / 逻辑改正确」:B.2 的逐行 diff 证明界面侧是逐字 1:1(除授权的裸色→token),
无任何视觉/尺寸/动效改动。✅

---

## 发现汇总

### Critical:0 条

### Important:3 条

**I1(测试判别力)`src/ai/styles/knowledgeStyles.test.ts:51`** ——
`new RegExp(\`\\.${c}\\b\`)` 的 `\b` 在 `-` 前成立,导致 9 个「是别的白名单类前缀」的类
(`k-rail` / `k-rail-item` / `k-rail-svc` / `k-topbar` / `k-banner` / `k-badge` / `k-scroll` /
`k-mobile-tab` / `k-empty`)的存在性断言空转。RED 实证:删掉唯一的 `.k-topbar { … }` 规则 → 8/8 全绿。
**应改**:`const missing = WHITELIST_38.filter((c) => !new RegExp('\\.' + c + '(?![\\w-])').test(css))`。

**I2(测试判别力)`knowledgeStyles.test.ts:29` + `:91-104`** ——
色字面量断言跑在 `stripComments()` 之后,注释里的裸色一律扫不到;§6 明令注释里也不许有
Vue2 原始色字面量。RED 实证:注释里塞 `#ff0000` / `rgba(255,0,0,0.5)` / `white` → 8/8 全绿。
**应改**:色扫那一条改用**未剥注释的原始文本**(仅切掉两个声明块区间);`toContain` 类断言继续用剥注释副本。
即 `const raw = read('./knowledge.scss')` 与 `const css = stripComments(raw)` 并存,`rest` 从 `raw` 切。

**I3(§6 配色规范)`src/ai/styles/knowledge.scss` 注释 12 行** ——
`:12` `:293` `:319` `:324` `:329` `:370` `:372` `:379` `:386` `:419` `:480` `:481` 里直接引用了
Vue2 蓝本的原始裸色(`#007AFF` / `` `white` `` / `rgba(52,199,89,0.18)` / `rgba(255,149,0,0.18|0.1|0.3|0.22)` /
`rgba(255,59,48,0.18)` / `rgba(0,122,255,0.25|0.22)` / `rgba(255,255,255,0.6)`)。
§6 要求改写成「引蓝本 `knowledge.scss:行号` + 中文描述颜色」。这批字面量还会随 sass 保留的块注释
**进构建产物**。零视觉影响,但同样写法在 `.vue` 里会被 `color-guard.test.ts` 判红。
**应改**:见 A.2 表的逐行建议改法(修完 I2 后这 12 行会被守卫自动逮住,顺序上建议先改 I3 再开 I2)。

### Minor:3 条

**M1 `knowledgeStyles.test.ts:99-103`** —— 零字面量正则只覆盖 `#hex` / `rgb(a)` / `oklch(` / `white` / `black`;
brief Step 4 自己的 grep 还含 `red|green|blue|orange|gray|grey`,且 `hsl()/hsla()/lab()/lch()/hwb()/color()`
全未覆盖。应补齐(顺手也让 T11 那批更大的搬运受益)。

**M2 `knowledge.scss:380` 与 `:482`(`--accent-soft-2` 色相错配)** ——
暗色档下 `var(--accent-soft-2)` 解析到全局 `theme.css:60` = `rgba(138,180,255,0.24)`(源自全局暗色
`--accent: #8ab4ff`),而本档暗色 `--accent` 是 `#5E97F2` → `.k-btn.primary` 的外发光与
`.k-banner[data-tone="info"]` 的描边会比按钮本体偏浅偏紫一点。附录 B 明令直用全局 token,
实现者合规;纯观感,列此备案(若要严格同色相,需要在两档各补一个 `--accent-soft-2` 本地覆盖 —— 但那与
R2 例外相冲,应由协调者定)。

**M3 `knowledge.scss:415-425`(`.k-empty-illust` 的 `color-mix` 派生未申报)** ——
蓝本 `:694` 的 `rgba(255,255,255,0.6)` 渐变高光**不在附录 B 映射表里**(表里 white 桶只讲「前景色」);
§6 / brief Step 3 要求「表里没有的 → 停下写 `NEEDS_CONTEXT`,不许自己发明」。实现者没有停,
而是用 `color-mix(in srgb, var(--text-on-accent) 60%, transparent)` 派生。
取值上**等价且正确**(两档 `--text-on-accent` 都是 `#ffffff`),源码 `:419-423` 也写了长注释;
但**报告 §9 的偏离表里没有这一行** → 按 §2「未申报的偏离本身就是缺陷」应补报告 + 补台账。

### ⚠️ 待协调者裁定:4 条

**A —— `--shadow-xs/sm/md/lg` 的暗色档取值(附录 B 自身的问题,不是实现者的偏离)。**
附录 B 写「结构量(`--r-*`/`--font-*`/`--shadow-*`)两档共享,只写在基础块」+「`--shadow-xs/sm/md/lg` =
AI tokens `:107-110`(`rgba(40,35,25,…)` 暖投影)」,实现者照做了(`knowledge.scss:113-116`,浅色块不声明)。
但 `tokens.scss` 自己把 shadow 当**颜色 token**处理,浅色 `:107-110` = `rgba(40,35,25,0.04~0.10)`,
**暗色 `:360-363` 另有一套** `rgba(0,0,0,0.4~0.55)`。
后果:`.knowledge-app` 在**默认暗色主题**下拿到 4% 不透明度的暖棕投影压在 `#1C1C1E` 上 = 基本不可见,
本批被影响的是 `.k-rail-item[data-active="true"]`(`:269`)与 `.k-rail-svc`(`:312`)两处
`box-shadow: var(--shadow-xs)` —— 选中项与索引器状态卡在暗色下丢掉浮起感。浅色档反而恰好取对。
T11 用 `--shadow-sm/md/lg` 更多,影响面会放大。
**建议裁定**:把 shadow 归入颜色 token —— 基础(暗色)块落 `tokens.scss:360-363` 四条,
浅色块补 `tokens.scss:107-110` 四条;同时改附录 B 的那句话,避免 T11 重犯。

**B —— §6「注释里不许有色字面量」是否也管「引用 New-UI 自己 token 值」的注解?**
除 I3 那 12 行 Vue2 原始色外,另有 12 行(`:49` `:50` `:137` `:139` `:140` `:141` `:158` `:173` `:176`
`:177` `:182` `:421`)在注释里写了 `theme.css`/`tokens.scss` 当前解析到的值(`#f7f5ef`、`#ffffff`、
`#3550c4`、`#92600c` …)。这些是可读性注解、不是「Vue2 原始色」,但字面上也是色字面量。
若裁定「也不许」,I2 修完后守卫会一并逮住这 12 行,需要同批改掉。

**C —— 主题来源与 AI 区其余页面不一致(spec 已定,但 T10 有踩坑风险)。**
`.knowledge-app` 的浅色档写作 `:root[data-theme="light"] .knowledge-app`,跟随**全局** `<html>`
的 `data-theme`(`src/stores/theme.ts:14-15` 设置)。而 `.agent-app` / `.set-app` 跟随的是
**AI 区自己的** `aiTheme` store,以 `:data-theme` 贴在容器上(`AgentPage.vue:328`、`SettingsPage.vue:383`,
tokens.scss 的暗色选择器是 `.agent-app[data-theme="dark"]`)。
这是 K2/§6/用户 D5 明令的做法,实现**完全合规**;但两个后果值得写进 T10 brief 与验收单:
① 知识库区**不会**跟随 AI 区的明暗开关,只跟桌面主题;
② **T10 千万不要照 `AgentPage/SettingsPage` 在 `.knowledge-app` 上写 `:data-theme="aiTheme.theme"`** ——
那个属性对本档的浅色选择器毫无作用(选择器要的是 `:root` 上的 `data-theme`),会造成「切了没反应」。

**D —— 本档目前是死代码,T10 必须补 import。**
`grep -rn "knowledge.scss" src` 除本档自身与它的测试外**零命中**,没有任何文件 import 它
→ `pnpm build` 编译不到、真机上一行样式都不会生效。本任务范围内正确(T4 只产出档案),
但建议在 T10 brief 里显式列一条「加 `import '../styles/knowledge.scss'` 并验证 `.k-rail` 在浏览器
DevTools 里能命中」的验收项,避免整期收官才发现。

---

## 结论

配色这道人肉防线上,**规则段落零带色相字面量、`theme-exception` 零命中、规则段落引用的 31 个 token
全部有声明(唯一未声明的 `--accent-soft-2` 是 R2 明令的全局例外,且两档都存在)** ——
即**真机上不存在「某处透明」的风险**,这是本任务最要紧的一条,已确认过关。
38 个白名单类一个不多一个不少,逐行 diff 后 31 个逐字等价、5 个差异全是附录 B 授权的裸色→token 替换,
属性态零漏搬,7 条 keyframes 齐全,K2 选择器偏离落地正确,零类名串号。
上一轮的浅色档 Critical 已真正修好(我自己做的两栏差集表确认「真漏 0 个」)。
剩下的 3 条 Important 都是**守卫本身的判别力 + 注释规范**,不影响视觉,建议本任务内收尾后放行 T5/T10;
⚠️ A(暗色 shadow)建议在 T11 开工前裁定,否则会在仪表盘批次放大。
