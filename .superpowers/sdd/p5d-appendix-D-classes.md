# P5d 附录 D —— CSS 类白名单 + tiptap 可测性(**权威**,T0 产出)

**T0 实测于 2026-08-04** · 蓝本 `NimoOS-UI`@`7a6ee6b7` · 现状 `src/ai/styles/knowledge.scss`(1991 行)
+ `src/ai/styles/knowledgeStyles.test.ts`(907 行,`WHITELIST_226`)

## §D.0 白名单算术(**226 → 291,+65**;常量改名 `WHITELIST_226` → `WHITELIST_291`)

判据(程序化,剥注释后):对本期 9 个 `knowledge.scss` 段 + `NotesMarkdownEditor.vue:40-46`
取**选择器位置**(行内 `{` 之前那一段)的所有 `.类名`,再减去 `WHITELIST_226` 已有的。

| 项 | 数 |
|---|---|
| 段内选择器位置出现的 `k*`/`fb*` 前缀类(去重) | **67** |
| 其中已在 `WHITELIST_226` | **2**(`k-badge` `:2029` · `kn-badge` `:2031-2039`,均 P5b-T2 已搬) |
| 🔴 **本期新增** | **65** |
| 收官白名单 | **291** |

🔴 **与治理/计划的差异(勘误)**:计划书写「协调者实测:New-UI 缺 **66** 个类(含 `.k-seg` / `.nme` /
`.nme-content` / `.ProseMirror`)…已有的只有 21 个」。**两个数都对不上,原因是分母不同**:

| 口径 | 结果 |
|---|---|
| **scss 段选择器**(= 白名单该收的) | 67 个 `k*`,已有 2 → **新增 65**;另有非 `k*` 的 `nme-content` / `ProseMirror`(见 §D.2) |
| **模板 `class="…"` 静态类**(= T6/T7 写模板时能不能用) | 共 **98** 个,New-UI 已有 **25**,缺 **73**(含 `dot`/`lbl`/`sep`/`spacer`/`wide`/`nme`/**`text`**) |

**66 / 21 两个数字在两种口径下都不成立** —— 下游一律用本节的 65 / 291,以及 §D.2、§D.4 的清单。

## §D.1 本期新增的 65 个类(**全部要进 `WHITELIST_291`**)

| # | 类 | 段 | 蓝本 `knowledge.scss` 选择器行 |
|---|---|---|---|
| 1 | `.k-seg` | K43 | `:551` |
| 2 | `.kn-act` | D | `:2109,2115,2116,2117,2118` |
| 3 | `.kn-aside-card` | F | `:2197` |
| 4 | `.kn-aside-select` | F | `:2236` |
| 5 | `.kn-aside-title` | F | `:2202,2203` |
| 6 | `.kn-desc-input` | E | `:2145,2149` |
| 7 | `.kn-diff` | G/H | `:2243,2278` |
| 8 | `.kn-diff-body` | G | `:2248` |
| 9 | `.kn-diff-pane` | G | `:2244,2246,2247` |
| 10 | `.kn-diff-pane-head` | G | `:2245,2246,2247` |
| 11 | `.kn-draftbar` | E | `:2129` |
| 12 | `.kn-draftbar-sub` | E | `:2137` |
| 13 | `.kn-draftbar-txt` | E | `:2135,2136` |
| 14 | `.kn-edit` | E/H | `:2123,2267` |
| 15 | `.kn-edit-aside` | F/H | `:2196,2268` |
| 16 | `.kn-edit-main` | E | `:2138` |
| 17 | `.kn-edit-top` | E | `:2124,2125` |
| 18 | `.kn-editor` | E | `:2150,2155` |
| 19 | `.kn-editor-body-wrap` | E | `:2170,2171` |
| 20 | `.kn-editor-src` | E | `:2183` |
| 21 | `.kn-editor-status` | E | `:2188,2193` |
| 22 | `.kn-editor-toolbar` | E/H | `:2156,2279` |
| 23 | `.kn-empty-filtered` | D | `:2120` |
| 24 | `.kn-file-acts` | F | `:2211` |
| 25 | `.kn-filepath` | F | `:2206` |
| 26 | `.kn-inbox` | C | `:2058,2073` |
| 27 | `.kn-inbox-acts` | C/H | `:2082,2275` |
| 28 | `.kn-inbox-chev` | C | `:2072,2073` |
| 29 | `.kn-inbox-foot` | C | `:2083` |
| 30 | `.kn-inbox-foot-hint` | C | `:2084` |
| 31 | `.kn-inbox-head` | C | `:2063` |
| 32 | `.kn-inbox-icon` | C | `:2064` |
| 33 | `.kn-inbox-row` | C/H | `:2075,2076,2274` |
| 34 | `.kn-inbox-row-desc` | C | `:2080` |
| 35 | `.kn-inbox-row-main` | C | `:2077,2079` |
| 36 | `.kn-inbox-row-time` | C | `:2081` |
| 37 | `.kn-inbox-row-title` | C | `:2078,2079` |
| 38 | `.kn-inbox-rows` | C | `:2074` |
| 39 | `.kn-inbox-sub` | C | `:2071` |
| 40 | `.kn-inbox-title` | C | `:2069,2070` |
| 41 | `.kn-kv` | F | `:2204,2205` |
| 42 | `.kn-list` | D | `:2089` |
| 43 | `.kn-list-foot` | D | `:2119` |
| 44 | `.kn-note-actions` | D/H | `:2107,2108,2273` |
| 45 | `.kn-note-desc` | D | `:2098,2102` |
| 46 | `.kn-note-line1` | D | `:2100` |
| 47 | `.kn-note-main` | D | `:2099` |
| 48 | `.kn-note-meta` | D | `:2103,2104` |
| 49 | `.kn-note-row` | D/H | `:2090,2095,2096,2098,2108,2271` |
| 50 | `.kn-note-side` | D/H | `:2105,2272` |
| 51 | `.kn-note-time` | D | `:2106` |
| 52 | `.kn-note-title` | D | `:2101` |
| 53 | `.kn-notes-col` | D | `:2087` |
| 54 | `.kn-pathstrip` | B/H | `:2048,2053,2054,2055,2276` |
| 55 | `.kn-refbtn` | F | `:2212,2218,2219,2220,2221,2222` |
| 56 | `.kn-savehint` | E | `:2126,2127,2128` |
| 57 | `.kn-src` | A | `:2044` |
| 58 | `.kn-tag` | A | `:2045` |
| 59 | `.kn-tagchip` | F | `:2228,2233,2234` |
| 60 | `.kn-tagedit` | F | `:2223,2227,2235` |
| 61 | `.kn-tb-btn` | E | `:2160,2165,2166,2167,2168` |
| 62 | `.kn-tb-sep` | E | `:2169` |
| 63 | `.kn-title-input` | E/H | `:2139,2144,2277` |
| 64 | `.kn-toolbar` | D | `:2088` |
| 65 | `.kn-type-ic` | A | `:2040` |

**段代号**:A `:2023-2046` · B `:2047-2056` · C `:2057-2085` · D `:2086-2121` · E `:2122-2194` ·
F `:2195-2241` · G `:2242-2249` · H `:2265-2281` · K43 `:551-571` · K44 `NotesMarkdownEditor.vue:40-46`。
⚠️ 同一个类出现在 H 段(响应式 `@media`)与主段是正常的,**两处规则都要搬**。

## §D.2 🔴 非 `k*` 类的处置(**登记表 10 → 15,不是治理 A-10 说的「保持 10 项」**)

`knowledgeStyles.test.ts` 有两条相关断言:
`:257` 「非 `k*` 前缀类全部在 `NON_K_HELPER_CLASSES` 里」+ `:262` **集合相等**(不多不少)。
`nonKClassNames()`(`:244-256`)的正则是 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/g`,排除条件是
`^k(2|n)?-` / `^fb(-|$)` / `knowledge-app` / `parser-app`。

**T0 程序化模拟(把本期 10 段拼到现状文件后重跑 `nonKClassNames`)**:

| 新扫出的 | 是什么 | 处置 |
|---|---|---|
| `dot` | `.kn-savehint .dot`(蓝本 `:2127` `:2128`)—— 保存状态小圆点 | 🔴 **进登记表**(真·嵌套辅助类) |
| `lbl` | `.kn-refbtn .lbl`(蓝本 `:2222`)—— 引用按钮文字 | 🔴 **进登记表** |
| `sep` | `.kn-note-meta .sep`(蓝本 `:2104`)—— 元信息分隔点 | 🔴 **进登记表** |
| `spacer` | `.kn-edit-top .spacer` / `.kn-editor-status .spacer` / `.kn-aside-title .spacer`(蓝本 `:2125` `:2193` `:2203`) | 🔴 **进登记表** |
| `wide` | `.kn-tb-btn.wide`(蓝本 `:2167`)—— H2/H3 加宽变体 | 🔴 **进登记表**(与既有 `mono`/`ghost` 同款「连写变体」) |
| `nme-content` | `.kn-editor-body-wrap .nme-content .ProseMirror`(蓝本 `:2171`)+ K44 顶层段 | ✅ **走排除条件**(正经前缀类,同 `knowledge-app`/`parser-app`,A-10 口径) |
| `ProseMirror` | 同上,**第三方(ProseMirror)生成的类名,大小写混排** | ✅ **走排除条件** |

→ **`NON_K_HELPER_CLASSES`:10 → 15**(加 `dot` `lbl` `sep` `spacer` `wide`,各写出处注释);
**排除条件加 2 项**(`nme-content` / `ProseMirror`)。
🔴 **治理 §9.6 / A-10 说「保持 10 项不变」是错的** —— 那句只考虑了 `nme`/`nme-content`/`ProseMirror`
三个,漏了 5 个嵌套辅助类。**照 A-10 字面做,`:262` 那条集合相等断言在 T2 一提交就红。**
⚠️ 另注:治理把 **`nme`** 也算进「会引入 `knowledge.scss` 的 3 个非 k* 类」——
**`nme` 在蓝本任何 scss 里都没有选择器**(见 §D.4),`nonKClassNames` 压根扫不到它,
**既不进登记表也不进排除条件**。所以是 **2 个**,不是 3 个。

### D.2.1 「没有搬多」扫描正则的扩法(缺口 ①,兑现 P5c §6.4.2 的债)

现状(`:198`):`/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g`
—— 扫不到 `nme-content`,更扫不到 **`ProseMirror`(有大写)**。

建议落地版:

```
/\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)/g
```

- **字符集加 `A-Z`** = 兑现 P5c §6.4.2 那张「大小写盲区」的债(A-11:`.ProseMirror` 让它不再是理论问题);
- 🔴 **必须程序化证明新正则是旧正则的严格超集**(照 P5c §6.4.1 第 1 条的做法:对现状文件跑两版,
  断言 `old ⊆ new`),并配 RED 探针(临时塞 `.kn-foo { }` / `.ProseMirrorX { }` → 报红 → 还原);
- **扩范围 = 扫得更多,不是放宽断言。**
- ⚠️ 扩了之后 `nme-content` / `ProseMirror` 会被这条扫到 → **它们必须同时进 `WHITELIST_291`**,
  否则「白名单外的类」会报红。**即白名单实际是 291 + 2 = 293**,请协调者拍板走哪条:
  (a) 291 + 把两个非 `k*` 类也收进白名单 = **293**;(b) 正则只扩 `A-Z` 与 `nme-`,`ProseMirror` 单列例外。
  **T0 推荐 (a)** —— 白名单的语义是「本档允许存在的类」,收进去最直白,且与「排除条件只管
  `nonKClassNames` 那条断言」互不矛盾。

## §D.3 属性态清单(断言一律**直接比字符串,两侧都比**,禁 `toBeUndefined()`)

蓝本**逐处都套了 `String()`**(P5b E-9 已裁定:套不套渲染一致,**照抄不改**)。

| 属性 | 元素 | 蓝本行 | 取值 |
|---|---|---|---|
| `data-open` | `.kn-inbox` | `NotesView.vue:42` | `'true'` / `'false'` |
| `data-tone` | `.kn-act` | `:66` `:67` `:131` `:133` | 静态 `'confirm'` / `'danger'`(无 tone 的那个「归档」按钮**没有这个属性**) |
| `data-on` | `.k-filter-pill` ×4 | `:80` `:83` `:87` `:90` | `'true'` / `'false'` |
| `data-s` | `.kn-note-row` | `:109` | `n.status` 原值(`draft`/`curated`/`archived`);⚠️ **`status` 为 `undefined` 时属性被删**(Vue 3 `patchAttr` 对 `null`/`undefined` 才删),这是唯一允许断言「属性不存在」的一处 |
| `data-s` | `.kn-badge` | `:116` `:117` · `NoteEditPane.vue:12` `:13` `:82` `:83` `:84` | 静态 `'draft'` / `'archived'` / `'curated'` |
| `data-dirty` | `.kn-savehint` | `NoteEditPane.vue:15` | `'true'` / `'false'` |
| `data-on` | `.kn-tb-btn` ×7 | `:43` `:44` `:45` `:47` `:48` `:50` `:51` `:52` | `'true'` / `'false'`(`tbActive()`,见 N29) |
| `data-on` | `.k-seg > button` ×2 | `:55` `:56` | `'true'` / `'false'` |
| `data-side` | `.kn-diff-pane` ×2 | `:163` `:167` | 静态 `'theirs'` / `'mine'` |

## §D.4 「不搬」与「蓝本零规则」清单(**「不搬 ≠ 忘搬」:断言要守得住它们不出现**)

| 项 | 蓝本 | 为什么不搬 |
|---|---|---|
| `.k-section-body` | `knowledge.scss:985-991` | **归 P5f**(P5c E-3 因 `AllowlistView` 移出而故意没搬) |
| `.k-progress-card/-row/-label/-nums/-bar/-fill` | `:1152-1157` | **N15**,两页都不用 |
| `.kn-picked` / `.kn-checkline` / `.kn-mig-*` / `.kn-pick-*` | `:2250-2263` | **P5c-T2a 已搬**(现状 `:1609+`),不重复 |
| `.kn-badge` 5 条 | `:2031-2039` | **P5b-T2 已搬**(现状 `:1596-1607`),不重复定义 |
| `.k-frow` `@media` 死规则 | `:1500-1503` | P5b 已判死规则,不搬 |
| **`.nme`** | 🔴 **蓝本任何 scss 里零选择器**(只在 `NotesMarkdownEditor.vue:2` 的 `class="nme"`) | **N10/N13 同族**:类名照抄、**不进白名单**、**不许为它凭空写规则**。⚠️ 与 N10 的差别:Vue2 里它同样无样式 → 照抄就是 1:1 |

### 🔴 D.4.1 `.k-btn.text` —— **本期唯一的真缺口,需要协调者裁定(D-1)**

- **事实**:`NotesView.vue:73`(「逐条审阅」)与 `NoteEditPane.vue:174`(「复制我的正文」)都写
  `class="k-btn text"`;蓝本的规则在 **`knowledge.scss:1569-1570`**
  (`.k-btn.text { background: transparent; color: var(--accent) }` + `:hover { background: var(--accent-soft) }`),
  嵌在 `.knowledge-app` 里(depth 1),属于蓝本 **`:1540` 起的「File-aggregated search: match pill +
  detail drawer」段 = P5e 的地盘**。
- **New-UI 现状**:`.k-btn` 只有 `&.ghost` / `&.outline` / `&.primary` / `&.danger`(`:716/722/728/735`),
  **没有 `.text`**。
- **后果**:照抄类名而不搬规则 → 那两个按钮渲染成**浏览器默认按钮**(灰底/边框),
  而 **Vue2 渲染的是无底色的蓝色文字按钮** → **界面不 1:1**。
  🔴 **这不是 N10 家族**(N10 是「Vue2 里也没有样式」);这是「Vue2 有、我们漏了」。
- **T0 建议**:本期把这 2 行搬进 `.k-btn` 既有块(在 `&.danger` 之后、`&:disabled` 之前照蓝本源序插入
  `&.text`),`text` 进 `NON_K_HELPER_CLASSES`(→ **16 项**),并在 P5e 交接项里写明「`.k-btn.text` P5d 已搬,
  P5e 不许重复」。**零色字面量**(`transparent` 关键字 + 两个既有 token)。
- **状态**:🔴 **`NEEDS_CONTEXT`(D-1)** —— 它跨了 P5e 的段归属,属于**扩大本期搬运范围**,
  按治理「除 K1–K44 之外的任何偏离都要先申报再做」必须由协调者追认(建议编号 **K45**)。
  **不阻塞 T1;阻塞 T2/T6/T7。**

## §D.5 `KIcon` 复核(19/19 全在)+ 未知 `name` 的实测行为

- **19 个 glyph 逐个 `grep -cE "^\s+<name>:\s*'"` = 1/1 命中 ✅**:
  `folder chev edit plus sparkle check trash funnel layers x code file clock copy drive bot paperclip danger user`
- 🔴 **`PATHS` 实测 **42** 个键,不是治理 §1.2 / 计划 §0.4 写的 43**(P5c 记的 42 是对的;
  程序化计数 + 去重检查:零重复键)。**勘误,见报告 E-35。**
- **未知 `name` 的行为**(§1.2 要求 T0 实测):`KIcon.vue:58` 是
  `const pathHtml = computed(() => PATHS[props.name] || '')`,模板 `v-html="pathHtml"`
  → **未知名字渲染成一个空的 `<svg>`(不报错、不警告、静默无图形)**。
  → `NOTE_TYPES` / `NOTE_SOURCES` 的动态 `:name` 靠 `noteTypeMeta`/`noteSourceMeta` 的
  `|| NOTE_TYPES.note` / `|| NOTE_SOURCES.human` 兜底,**照抄即可**;
  但**兜底分支必须有用例**(喂一个不存在的 `type`/`createdBy`,断言 KIcon 的 `name` 回落成 `edit`/`user`)。

## §D.6 🔴 tiptap / ProseMirror 在 jsdom 下的可测性(治理 §9.7,**T0 实测结论**)

### 结论:**能真实挂载,不需要 mock。** `NotesMarkdownEditor.test.ts` 一律用**真 `Editor`**。

**探明方式**(不碰本仓:在 `/tmp/p5d-tiptap-probe/` 建了一个隔离工程,依赖版本与本仓**逐一对齐**
—— `vitest 4.1.9` / `jsdom 24.1.3` / `vue 3.5.39` / `@vue/test-utils 2.4.11` / `@vitejs/plugin-vue 6`):

| 探针 | 结果 |
|---|---|
| A `new Editor({ extensions:[StarterKit, Markdown], content:'# hello\n\nworld' })` | ✅ **挂载成功**;`storage` 键含 `markdown` / `markdownTightLists` / `markdownClipboard`;`storage.markdown.getMarkdown()` 回 `"# hello\n\nworld"`;`getHTML()` 回 `<h1>hello</h1><p>world</p>` |
| B `isActive('bold')` / `chain().focus().selectAll().toggleBold().run()` / `onUpdate` / `onTransaction` / `commands.setContent()` | ✅ 全部工作:`isActive` `false → true`;markdown 变 `**abc**`;`updates=1` `transactions=1`;`setContent('## replaced')` 后 markdown 与 `isActive('heading',{level:2})===true` 都对 |
| D 真 SFC(`<editor-content :editor>` + `onMounted` 建 Editor,**不传 `element`**)在 `@vue/test-utils` 下 | ✅ 真渲染出 `<div contenteditable="true" role="textbox" class="tiptap ProseMirror">`,内含 `<h1>hi</h1><p>body</p>`;`ready` / `update:modelValue` / `input` / `transaction` 四个 emit 全部可断言;**防回环可测**(同值 `setProps` → `setContent` 调用数 0→0;异值 → 0→1) |
| E `onBeforeUnmount` 里 `editor.destroy()` | ✅ `vi.spyOn(ed,'destroy')` 在 `w.unmount()` 后计数 1 |
| C(**失败,是探针本身写错**) | 给 Editor 传了 `element` **又**单独 mount `EditorContent` → 渲染出空 `<div>`。**正确用法是不传 `element`,让 `EditorContent` 挂载它**(= 蓝本的写法)。**记下来免得 T4 踩同一个坑** |

⚠️ **jsdom 需要 `attachTo: document.body`** 才稳(探针 D/E 都用了);未挂真实 document 时 ProseMirror 的
selection/`getClientRects` 相关路径可能异常。
⚠️ **等待时机**:`onMounted` 里建 Editor → 断言前要 `await nextTick()` **再** `await flushPromises()`
(探针里用 `new Promise(r => setTimeout(r,0))`),单个 `nextTick` 不够。

### D.6.1 三条高危行为该把断言落在哪(治理 §9.7 的追加要求)

既然是真 `Editor`,三条都能落在**真行为层**,判别力最高:

| 条目 | 断言写法 | 拿掉生产代码哪一行必须报红 |
|---|---|---|
| **K38 两个 emit** | 真敲一次内容(`ed.chain().focus().insertContent('x').run()`),断言 `w.emitted('update:modelValue')` **与** `w.emitted('input')` **各**有一条、且 payload 是 markdown | 删 `emit('input', md)` → 只有 `input` 那条红(**两条断言分开写,不许合并**) |
| **§5.3 防回环** | 用 `vi.spyOn(editor.commands,'setContent')` 或计数器:同值 `setProps` → 0 次;异值 → 1 次 | 删 `v !== editor.storage.markdown.getMarkdown()` 这半个条件 → 同值那条红 |
| **N29 `tbTick` 假依赖** | 挂 `NoteEditPane`,真敲 `toggleBold` → 断言 `.kn-tb-btn` 的 `data-on` 从 `'false'` 变 `'true'`(**属性字符串两侧都比**) | 删 `tbTick.value >= 0 &&` → 工具栏 active 态不刷新 → 报红 |

### D.6.2 依赖版本的**勘误**(K37 / A-7 的前提有误)

| 项 | 治理 K37 / 计划 A-7 | 蓝本 `package.json`@`7a6ee6b7` 实际 | 锁文件实际解析 |
|---|---|---|---|
| `tiptap-markdown` | 🔴 「蓝本用 … `tiptap-markdown@^0.6.1`」 | 🔴 **`^0.8.10`** | **0.8.10**,peer = `@tiptap/core: ^2.0.3` |
| `@tiptap/*` | `^2.27.2`(要装的) | `^2.0.4`(声明) | **2.10.3** |
| 蓝本另有的直接依赖 | 未提 | `@tiptap/core` `@tiptap/extension-highlight` `@tiptap/extension-typography` | 2.10.3 |
| `markdown-it` | 「已在本仓 dependencies 里(`tiptap-markdown` 的运行时依赖)」 | 蓝本 `^13.0.1`;本仓 `^14.3.0` | `tiptap-markdown@0.8.10` **自带** `markdown-it: ^14.1.0` 作为**自己的直接依赖** → 与本仓那条声明无关,两者互不影响 |

🔴 **`^0.6.1` 是错的。装 0.6.1 = 用一个蓝本从未验证过的版本做 1:1 移植 —— 正是 K37 想避免的风险,方向反了。**
**T0 建议(需协调者追认,D-2):`tiptap-markdown@^0.8.10`**(仍是 v2 线,peer `@tiptap/core ^2.0.3`
被 `@tiptap/*@2.27.2` 满足;T0 探针跑的就是这个组合,五项全过)。
✅ **「四个包」够用**已实证:`@tiptap/core` 作为 peer 由 pnpm 自动装(探针里没有显式声明 core,五项照样全过)。
