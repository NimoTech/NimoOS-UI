# SP8-P5d · T0 报告 —— 验蓝本源 + 三附录 + fixture + tiptap 可测性(**零产品代码**)

**执行:2026-08-04** · 起点 `sp8-ai`@`23515cd`
**初稿状态 `DONE_WITH_CONCERNS`(`cc6d7c8`)→ 🔴 修复轮 1 后状态 `DONE`(见 §6)**
—— 评审判定「任务质量 ✅ 通过 / 规格 ❌(DoD 2、DoD 4 部分兑现)」,协调者裁定 **R1–R14**;
本报告 **§6** 逐条兑现,**遗留 `NEEDS_CONTEXT` = 无**(D-1 → K45 已追认、D-2 → `^0.8.10` 已批准)。

**交付物**(全部落 `.superpowers/sdd/`,`git add -f`):
`p5d-appendix-A-i18n.md` · `p5d-appendix-B-tokens.md` · `p5d-appendix-D-classes.md` ·
`p5d-fixtures/`(13 份 fixture + README)· `p5d-gen-r8r9-sim.mjs`(修复轮 1 新增)· 本报告。**`src/` 零改动。**

> ⚠️ **读法**:§1–§5 是初稿(**除已就地标注的订正外未改写**),🔴 **凡与 §6 冲突处一律以 §6 为准**。
> 已知需要按 §6 读的点:DoD 4 那三行里的 **291 → 293(R9)**、**10→15 → 10→16(R8)**、
> **`.k-btn.text` 缺口(D-1)→ 已裁定 K45(R1)**;DoD 6 那句「三条都能落在真行为层」→ **N29 未实证(R5)**。

---

## §1 DoD 逐条兑现

### DoD 0 —— 三门基线复核:**✅ 一致**

| 门 | 实测 | 基线 | 判定 |
|---|---|---|---|
| `pnpm test` | **`Test Files 326 passed (326)` / `Tests 3515 passed (3515)`** exit 0 | 326 / 3515 | ✅ 逐字一致 |
| `pnpm exec vue-tsc --noEmit` | exit **0**,日志 **0 行** | 0 | ✅ |
| `pnpm build` | exit **0**,`✓ built in 25.81s` | 0 | ✅ |

- **干净单轮、零红、零复跑**(两条已知 flaky 都没出现)。`build` 只有既有 >500KB chunk 警告。
- `.sp8/NimoOS-Service/dist/` **未被清过** → 按 §0.5 的表**不需要**跨仓 `pnpm build`,也没跑。
- 工作树起点干净;`git diff --name-only b905943..HEAD` = 2 个 `.superpowers/sdd/*.md`,
  **非 md 文件 0 个**,`git diff --name-only bbbdca4..HEAD -- src/` = **0** → 产品代码与 `b905943` 逐字一致 ✅。

### DoD 1 —— 蓝本源核验:**✅ 无功能性差异,锁 `7a6ee6b7` 不变**

```
git -C /home/nimo/NimoTech/NimoOS-UI fetch git@github.com:NimoTech/NimoOS-UI.git main   # exit 0
FETCH_HEAD = 65cfda583f2e1029dfc66f17903f0a180d9ecadc
```
远端 `main` 仍是 **`65cfda58`**(与协调者 08-04 那次一致,期间没有新提交)。
`fetch` **只写 `FETCH_HEAD`**:`main` 仍 `7a6ee6b7`、工作树仍在 `docs/vue3-migration-sp3`(`748d5359`),**未动** ✅。

| 文件 | 行数 | `7a6ee6b7` vs `65cfda58` |
|---|---|---|
| `NotesView.vue` | 271 | **逐字节相同** |
| `NoteEditPane.vue` | 338 | **逐字节相同** |
| `NotesMarkdownEditor.vue` | 47 | **逐字节相同** |
| `notesViewHelpers.js` | 50 | **逐字节相同** |
| `noteEditHelpers.js` | 11 | **逐字节相同** |
| 4 份 Vue2 spec(15/25/69/30) | — | **全部逐字节相同** |
| `src/service/notes.js` | 203 | **逐字节相同** |
| `styles/knowledge.scss` | 2561 | **差 1 行:`:1675` 中文注释译成英文**(非功能) |
| `store/knowledgeStore.js` | 363 | **差 1 行:`:168` 注释中→英**(非功能) |
| `zh_CN.json` | 2847→2849 | **叶子键 value 变更 0 个**(深比较,展平 2823→2825);+18/−16 全是相册/新闻订阅/系统日志 |
| `en_US.json` | **叶子 2742→2744**(修复轮 1 · M-4 订正;初稿写的 2766→2768 是**文件行数**不是叶子键数) | 同上量级,**本期 99 个串的 en 值零变化** |
| `package.json` | 167→166 | 远端删了 `rss-to-json`;**tiptap 相关依赖零变化** |

→ **P5d 范围内零功能性差异,按用户 08-04 拍板继续锁 `7a6ee6b7`,不需要停下问。**
⚠️ 协调者那句「`zh_CN.json` **0 个键的值变了**」经深比较**成立** —— 但要注意
「顶层 `photos`/`agent`/`terminal` 三个键」用 `!==` 直接比会**假报变更**(它们是嵌套对象,引用永不相等);
必须展平后比叶子值。

### DoD 2 —— 附录 A:**✅ 已产出**(`p5d-appendix-A-i18n.md`)

- distinct **99** = 字面量 **92** + labelKey **7** ✅ 与协调者一致;字面量出现 115 次;复用 7 → **新增 92** ✅。
- **92/92 在 `zh_CN.json` 命中,本期零「Vue2 无源」的键** ✅。
- 键名已定死并程序化验证:**92 个名字互不重复、与现有 1503 键零重名**;
  词干分布 `aiKbNt` 25 / `aiKbNe` 53 / 无词干 `aiKb` 14。
- §A.4 动态 `$t()`:**5 处**(`NotesView.vue:95/121/123` + `NoteEditPane.vue:86 第二处/113`)——
  与协调者点名的 5 处**逐处吻合** ✅;扫描口径是**整个文件**(承 P5c E-5)。7 个 labelKey 值全部已进表。
- §A.5 全角标点例外:🔴 **实扫只有 1 条**(见 E-32)。
- §A.6 占位符键 **9 条,全 `{n}`,两档名称集合逐条一致** ✅;零处字面 `@`。
- §A.7 撞车:**双向扫描 + 真实模块导入计键数(1503 / 1503 / `aiKb*` 295,与 §0.4 基线逐字一致)**
  → 🔴 **危险撞车 11 组,协调者给的是 8 组**(其中 1 组是内部),**新增 4 组**(E-31 之外的独立发现);
  另登记 21 组「两档全同」的重复,治理 §7 的不复用清单**漏列 8 个**。
- §A.8 汇总表给了 T1 的全部 DoD 数字。

### DoD 3 —— 附录 B:**✅ 已产出**(`p5d-appendix-B-tokens.md`)

- 普查 **26 行 / 39 处**,与治理 §6.1 **逐个分段核对全部一致** ✅
  (A 4/7 · B 0/0 · C 6/10 · D 3/3 · E 2/3 · F 0/0 · G 2/2 · H 0/0 · K43 0/0 · K44 3/4 · JS 4/8 · 模板 2/2)。
- 🔴 **其中 6 处(`:2036`/`:2038`/`:2039` 的 `.kn-badge`)P5b-T2 已映射过**(现状 `:1602-1607`)→
  **本期实际只映 33 处**,且**不许重复定义 `.kn-badge`**。
- **模板内联 2 处显式登记**(`NotesView.vue:85` 藏在 `:style` 的 JS 对象里 · `NoteEditPane.vue:152`)——
  **没有照抄 P5c 的「0」**。
- 🔴 **3 处 `color:#fff` 定死 `--text-on-accent`**,并给出否决 `--on-accent` 的硬证据:
  `theme.css:48` 的 `:root` 是 **`#16203a`(深藏青)**,`knowledge.scss` 里**没有**声明 `--on-accent`
  → 穿透到全局会在暗档写深蓝字。`--text-on-accent` 两档都是纯白(`:145` / `:264`)。
- **9 个新 token**,两档取值 + 蓝本 `file:line` + 出处全部给定;**K39 的诚实登记已写**
  (4 个渐变里只有 1 个有仓内逐字同值先例,另 3 个全仓零同值,值来自蓝本设计包)。
- A11/A-9 的显式确认项已列成表(含 2 处比其余更明显的差异:行内 `code` 与 `blockquote` 从半透明变实底)。

### DoD 4 —— 附录 D:**✅ 已产出**(`p5d-appendix-D-classes.md`,含 §D.6)

- 白名单 **`WHITELIST_226` → 291(+65)**;**「66 个 / 已有 21 个」两个数在两种口径下都不成立**(E-39)。
- 🔴 **`NON_K_HELPER_CLASSES` 必须 10 → 15**(`dot` `lbl` `sep` `spacer` `wide`),
  **A-10 说的「保持 10 项」会让 `:262` 那条集合相等断言在 T2 一提交就红**(E-34)。
- 「没有搬多」正则的落地版给了,含 **`A-Z` 收紧(兑现 P5c §6.4.2 的债,A-11)**,并要求程序化证明严格超集。
- §D.3 属性态清单(10 类 `data-*`,含唯一允许断言「属性不存在」的那一处)。
- §D.4「不搬」清单 + 🔴 **`.k-btn.text` 缺口(D-1)**。
- §D.5 KIcon:**19/19 全在** ✅;🔴 **`PATHS` 实测 42 不是 43**(E-35);
  **未知 `name` 实测行为 = `PATHS[name] || ''` → 渲染空 `<svg>`,静默无图形**。

### DoD 5 —— fixture:**✅ 13 份 + README**(`p5d-fixtures/`)

- 🔴 **取数路径与治理 §4.2 不同**:经网关 `/v1/ai/agent/notes*` 一律 **400 `missing or malformed jwt`**,
  必须**直连 Python agent `:8282/agent` + `X-User-Id: 1`**(E-37)。
- 🔴 **409 契约坐实**:`{"detail":"revision conflict","current_revision":1}` → **`current_revision` 存在**
  → `conflictMessage` 按设计工作,**治理担心的「revision undefined」不成立**。
- 🔴 **`DELETE` 是 200 + JSON 体** `{"status":"deleted","id":"…"}`(64 字节),**不是 204 空体**(E-38);
  连带 **`service.notes.remove` 的正确 mock 是那个 body**,因为包里是 `return res.data`(E-33)。
- **本机数据现状全部落进 README §4**,其中多条**反转了治理 §9.9 的预测**(E-41):
  23 条笔记**全是 `draft` + `insight` + `pipeline`**、**每条都有 `source_refs`**(侧栏「来源」卡真机渲染)、
  `curated`/`archived` 徽标真机验不到、类型筛选空态真机可验、新建笔记 `status` 直接是 `curated`。

**写操作与清理(治理 §13 第 3 条)**:只造了 **1 条**探针笔记(`P5D T0 PROBE — delete me`,tag `p5d-probe`),
走完 `create → 409 → update → curate → archive → delete` 全链;
清理后 `GET` 得 **404**、`list` 回到 **23 条**、`tags` 含 `p5d-probe` 的 **0 条**、
`/DATA/Notes/1/` 的 `ls | sort` 与操作前 **零 diff(25 个文件)** ✅。
🔴 **对那 23 条真实笔记零写操作**(一次 curate/archive/delete/update 都没碰)。

### DoD 6 —— tiptap 可测性:**✅ 结论 = 用真 `Editor`,不需要 mock**(附录 D §D.6)

在 `/tmp/p5d-tiptap-probe/` 建隔离工程(**不碰本仓、不装任何东西进本仓**),依赖与本仓逐一对齐
(`vitest 4.1.9` / `jsdom 24.1.3` / `vue 3.5.39` / `@vue/test-utils 2.4.11` / `@vitejs/plugin-vue 6`),
装 `@tiptap/vue-3@2.27.2` + `starter-kit@2.27.2` + `pm@2.27.2` + `tiptap-markdown@0.8.10`,跑 5 个探针:

- **A/B**:`new Editor({extensions:[StarterKit, Markdown]})` 真挂载;`storage.markdown.getMarkdown()`、
  `isActive(name, attrs)`、`chain().focus()[cmd]().run()`、`onUpdate`、`onTransaction`、`commands.setContent()`
  **全部工作**。
- **D**:真 SFC(`onMounted` 建 Editor **不传 `element`** + `<editor-content>`)在 test-utils 下渲染出
  `<div contenteditable="true" class="tiptap ProseMirror">`,四个 emit 都能断言,**防回环可测**
  (同值 `setProps` → `setContent` 0 次;异值 → 1 次)。
- **E**:`onBeforeUnmount` 的 `editor.destroy()` 可 spy,`unmount()` 后计数 1。
- **C 失败但是探针写错**(给 Editor 传了 `element` **又**单独 mount `EditorContent` → 空 `<div>`)——
  已写进 §D.6 免得 T4 踩同一个坑。
- 落地注意:**必须 `attachTo: document.body`**;断言前 `await nextTick()` **再** `await flushPromises()`。
- → **K38 两个 emit / §5.3 防回环 / N29 `tbTick` 假依赖三条都能落在真行为层**,§D.6.1 给了三条的
  「拿掉哪一行必须报红」的对照表。**不存在「mock 层零判别力」的问题。**
- 🔴 **顺带查出 K37/A-7 的版本前提错了**(E-36):蓝本用的是 `tiptap-markdown@^0.8.10`,不是 `^0.6.1`。

### DoD 7 —— kickoff 勘误复核 + 新增登记:见 §2

**E-26 ~ E-30 全部复核**:E-26 ✅(起点 `b905943`,产品代码与 `bbbdca4` 零差异;本次实际 HEAD 已到 `23515cd`,
中间 3 个提交仍是纯 markdown)· E-27 ✅(`notesMapper.spec.js` 测的是 `@/service/searchMapper.js` 的
`buildSemanticSearchBlock`,确属 P5e)· E-28 ✅(scss 8 段合计 **244** 行,`.k-seg` 21 + K44 7 = 272,
717 + 272 = **989** 逐个核对无误)· E-29 ✅(`knowledgeRoutes.ts:74` notes → `KnowledgeDeferred`;
`SettingsPage.vue:415-416` 注释 + `:417` `<button class="set-detail-link" @click="onDetailsClick">`,
handler 在 `:179`;`router/index.ts:18` + `:37`)· E-30 ✅(distinct 99 / 命中 99 / 复用 7 / 新增 92)。
**新增 12 条:E-31 ~ E-42。**

### DoD 8 —— 蓝本行数与 scss 边界:**✅ 5/5 + 9/9 全对**

**组件行数 5/5 全对**:`NotesView.vue` **271** · `NoteEditPane.vue` **338** ·
`NotesMarkdownEditor.vue` **47** · `notesViewHelpers.js` **50** · `noteEditHelpers.js` **11**。

**8 段 + `.k-seg` 的括号配平复核(保行版剥注释后逐行数 `{`/`}`)—— 9/9 全部平衡,零偏差**:

| 声明范围 | `{` | `}` | 净 | 进入前深度 | 离开后深度 | 首行 | 下一行 |
|---|---|---|---|---|---|---|---|
| `:2023-2046` | 9 | 9 | **0** | 0 | 0 | `/* ====…` 段头 | `/* ---- path strip …` |
| `:2047-2056` | 4 | 4 | **0** | 0 | 0 | `/* ---- path strip` | `/* ---- draft inbox` |
| `:2057-2085` | 19 | 19 | **0** | 0 | 0 | `/* ---- draft inbox` | `/* ---- notes list` |
| `:2086-2121` | 24 | 24 | **0** | 0 | 0 | `/* ---- notes list` | `/* ---- edit pane` |
| `:2122-2194` | 38 | 38 | **0** | 0 | 0 | `/* ---- edit pane` | `/* ---- edit aside` |
| `:2195-2241` | 21 | 21 | **0** | 0 | 0 | `/* ---- edit aside` | `/* ---- conflict modal (409)` |
| `:2242-2249` | 6 | 6 | **0** | 0 | 0 | `/* ---- conflict modal` | `/* ---- settings: picker …`(P5c 已搬) |
| `:2265-2281` | 13 | 13 | **0** | 0 | 0 | `/* ---- responsive` | `/* ===== Dashboard v2 …` |
| `:551-571`(K43) | 3 | 3 | **0** | **1** | **1** | `  .k-seg {` | 空行 |

- **每段的首行都精确落在段头注释上、下一行都精确是下一段的段头** → 不会像 P5c E-3 那样截断规则。
- 🔴 **`.k-seg` 的进入深度是 1**(它嵌在 `:457 /* ---- Search page ---- */` 所在的 `.knowledge-app {` 块里)
  → 按 pathspec 复制得到的是**已经缩进一层的片段**,正好适配 K9 的「嵌进 `.knowledge-app`」;
  **零色字面量**(全 token)✅,K43 的描述成立。

---

## §2 kickoff / 治理勘误(**新增 E-31 ~ E-42**,下游一律以本节为准)

> **结构性结论:本期错的类型与前几期不同 —— 前三期集中在「计数 / 范围边界 / 因果链」,
> 本期最要命的三条集中在「一个只在前三期成立的隐含前提,到本期第一次失效」**:
> ① en 值 = 英文原串(E-31)· ② 中文标点是全角(E-32)· ③ AI 端点 localhost 免 JWT(E-37)。
> **这类错的共同特征:照着做,三门全绿,只有真人切到英文界面 / 跑守卫 / 发请求才看得出。**

| # | 出处与原文 | 权威源实际(T0 实测) | 处置 |
|---|---|---|---|
| **E-31** 🔴 | 治理 §7 只规定「zh 值以 `zh_CN.json` 为权威」,en 按前三期的惯例 = `$t()` 英文原串(P5c 的 verify 脚本头注释原话:「T0 measured zero overrides in that file」) | 🔴 **本期 `en_US.json` 有 2 条覆盖**:`this cannot be undone` → **`this cannot be undone.`**(多句点)· `Note item` → **`Note`**(整词不同)。Vue2 的默认与 fallback locale 都是 `en_us`(`src/plugins/i18n.js:9-10`)→ **英文界面渲染的是覆盖值** | T1 的 `aiKbNtDeleteBody2` en 填 `this cannot be undone.`、`aiKbNoteTypeNote` en 填 `Note`。**两条各配 en 正向 + 反向(≠原串)断言**;verify 脚本的 en 侧不能再假设「= JSON key」。**E-18 家族:错得能编译过** |
| **E-32** 🔴 | 治理 §7(a):「本期例外**至少含** N26 的两组三段式(`,还不是正式知识` 以中文逗号开头、`一句话摘要(用于列表与搜索展示)` 带全角括号、`只是暂时不需要的话,建议改用「归档」。`)」 | 🔴 **点名的 3 条全是假阳性**:逐码点实测那些逗号是 **U+002C**、括号是 **U+0028/U+0029**(**这份语言包的中文文案一律用半角逗号/括号**)。92 个 zh 值里能被 `/[，；：？！（）]/` 命中的**只有 1 条**:`aiKbNtDeleteTitle` = `删除该笔记？`(`？` U+FF1F) | 例外清单 = **1 条**(附录 A §A.5)。**照治理那份写 `toBe` 强断言会当场红 3 条**(P5b E-3 同族) |
| **E-33** 🔴 | 治理 §4.1:`service.notes.remove(id)` 「包**不剥不归一**,直接 `return res`(整个 axios 响应)」`notes.ts:232-235` | `notes.ts:232-235` 实为 **`const res = await http.delete(...); return res.data`** | mock 该写 **HTTP body**(`{"status":"deleted","id":"…"}`),不是 axios 响应对象。虽然蓝本不读返回值,但按 P5c §8.3「与真实契约不符的 mock 是定时炸弹」必须写对 |
| **E-34** 🔴 | 治理 §9.6 表格 + 裁定 A-10:「三个都是正经前缀类/第三方类 → 走排除条件,`NON_K_HELPER_CLASSES` **保持 10 项不变**」;并称本期引入「**3 个**非 `k*` 类:`nme` / `nme-content` / `ProseMirror`」 | 🔴 程序化模拟(把 10 段拼进现状文件后重跑 `nonKClassNames`):新扫出 **7 个**,其中 **5 个是真·嵌套辅助类**(`dot` `.kn-savehint .dot` · `lbl` `.kn-refbtn .lbl` · `sep` `.kn-note-meta .sep` · `spacer` ×3 处 · `wide` `.kn-tb-btn.wide`)→ **必须进登记表**;`nme-content` / `ProseMirror` 走排除条件。**另:`nme` 在蓝本任何 scss 里零选择器**,`nonKClassNames` 压根扫不到它 → **既不进登记表也不进排除条件**,是 N10 家族的「无规则类名」 | **`NON_K_HELPER_CLASSES` 10 → 15**(D-1 若追认则 16);「非 `k*` 新类」是 **2 个**不是 3 个。🔴 **照 A-10 字面做,`knowledgeStyles.test.ts:262` 那条集合相等断言在 T2 一提交就红** |
| **E-35** | 治理 §1.2「`KIcon.vue` 的 `PATHS` 共 **43** 个键(P5c 记的 42 已漂,协调者实测 43)」+ 计划 §0.4 基线 `KIcon.PATHS` **43** | **实测 42**(正则取 `PATHS` 块内所有 `^\s+key:`,零重复键)。**P5c 记的 42 才是对的,没有「漂」** | 基线数字改 **42**;19 个 glyph 仍是 19/19 全在,结论不变 |
| **E-36** 🔴 | 治理 K37 + 裁定 A-7:「蓝本用 `@tiptap/vue-2@^2.0.4` + **`tiptap-markdown@^0.6.1`**」→ 要求装 `tiptap-markdown@^0.6.1` | 🔴 蓝本 `package.json`@`7a6ee6b7` 写的是 **`"tiptap-markdown": "^0.8.10"`**,`pnpm-lock.yaml` 解析成 **0.8.10**(peer `@tiptap/core: ^2.0.3`);`@tiptap/*` 解析成 **2.10.3**。蓝本另有 `@tiptap/core` / `extension-highlight` / `extension-typography` 三个直接依赖 | 🔴 **装 0.6.1 = 用蓝本从未验证过的版本做 1:1 移植,正是 K37 想避免的风险、方向反了。** T0 建议 **`tiptap-markdown@^0.8.10`**(仍 v2 线;T0 探针跑的就是 `@tiptap/*@2.27.2` + `0.8.10`,五项全过)→ **待协调者裁定 D-2** |
| **E-37** 🔴 | 治理 §4.2:「T0 要实测并落盘的端点(**全部经网关 `:80`,localhost 免 JWT**)」 | 🔴 `GET http://127.0.0.1/v1/ai/agent/notes/settings` → **HTTP 400 `{"message":"missing or malformed jwt"}`**;`?limit=200` 同。**NimoOS-AI 对 localhost 也强制 JWT**(顶层 `CLAUDE.md` 明写;**`p5c-fixtures/README.md` 开头早已登记过这一条**) | 取数一律 **直连 `:8282/agent` + `X-User-Id: 1`**;已写进 fixtures README §0。⚠️ **同一条坑在 P5c 已经踩过并登记,治理文件却写回了错的口径** |
| **E-38** 🔴 | 治理 §4.2 / 计划 DoD 5:「`DELETE` 的状态码与体(**204 空体 → axios 给 `''`**;P5b 治理 §4.1 有 axios 源码依据)」 | 🔴 实测 **`HTTP/1.1 200 OK` + `content-length: 64` + `content-type: application/json` + `{"status":"deleted","id":"<id>"}`**。**204 那条契约是 P5b 的 `parserDeleteJob`,不是本端点** | mock `service.notes.remove` 用那个 body(与 E-33 连带)。**不许照抄 `''`** |
| **E-39** | 计划书「协调者实测:**New-UI 缺 66 个类**(含 `.k-seg`/`.nme`/`.nme-content`/`.ProseMirror`);已有的只有 **21** 个」 | 两种口径下都不成立:**scss 段选择器口径** = 67 个 `k*`/`fb*`,已有 2(`k-badge`/`kn-badge`)→ **新增 65**,白名单 226 → **291**;**模板静态类口径** = 共 **98**,已有 **25**,缺 **73** | 下游用附录 D §D.0/§D.1 的 65 / 291;两种口径都在表里写清了 |
| **E-40** 🔴 | 计划书「本期真实体量」表 + 治理 §6.1 普查表:只覆盖了 9 个段 + K44 | 🔴 **漏了 `.k-btn.text`**:`NotesView.vue:73` 与 `NoteEditPane.vue:174` 都写 `class="k-btn text"`,蓝本规则在 **`knowledge.scss:1569-1570`**(属 `:1540` 起的 **P5e** 搜索抽屉段),**New-UI 的 `.k-btn` 只有 ghost/outline/primary/danger**。不搬 → 那两个按钮渲染成浏览器默认按钮,而 Vue2 是无底色蓝字按钮 → **界面不 1:1**。**这不是 N10 家族**(N10 是「Vue2 里也没样式」) | 🔴 **`NEEDS_CONTEXT`(D-1)**:建议本期搬这 2 行(插在 `&.danger` 之后、`&:disabled` 之前),`text` 进登记表(→16),并在 P5e 交接项写明「P5d 已搬,不许重复」。**跨了 P5e 段归属 → 需协调者追认(建议编号 K45)。不阻塞 T1,阻塞 T2/T6/T7** |
| **E-41** | 治理 §9.9 的可点性预测表 | 部分被本机真实数据**反转**:① **侧栏「来源」卡真机渲染**(治理猜「手写笔记通常零 `source_refs` → 不渲染」;实测 23 条 **pipeline** 笔记**每条都有 `[{session_id}]`**)→ 「打开来源对话」按钮真机可点;② **`curated` / `archived` 两种徽标真机验不到**(23 条全 `draft`);③ **类型筛选空态真机可验**(只有 `insight` 一种);④ **新建笔记的 `status` 直接是 `curated`** → 「新建→保存」后不出草稿横幅 | 协调者写验收清单时以 fixtures README §4 为准 |
| **E-42** | 若干行号偏 1–5 行(内容无误) | **N30**:治理写「`NotesView.vue:210` 的 `watch: { editingId … }`」→ `watch:` 在 **`:208`**、handler 在 **`:209`**、闭合在 `:210`;**N31**:治理写「`:243` 的 `confirmAll`」→ 函数在 **`:238`**、`Promise.all` 在 **`:242`**、toast 在 `:243`;治理 §4.1 写 `Note` 可选字段在「`notes.ts:21-34`」→ 接口是 **`:21-35`** | 处置要求不变,行号以本节为准 |

**已核对且完全正确的协调者数据(不列为勘误,供评审免复核)**:
5 个组件行数 5/5 · 8 段 + `.k-seg` 边界 9/9(括号全平衡)· 段行数 244 / 272 / 989 ·
色字面量普查 26 行 / 39 处(逐分段一致)· distinct 99 / 复用 7 / 新增 92 · 动态 `$t()` 5 处及其位置 ·
19 个 glyph 19/19 全在 · 占位符全 `{n}` 且两档一致 · `transparent` 2 处 · E-26~E-30 全部成立 ·
真实模块导入键数 1503 / `aiKb*` 295 / `.vue` 179(未变) · 三门基线 326/3515/0/0。

---

## §3 A-12 —— 上游 `NimoOS-Service/src/notes.test.ts` 承接了哪几条 mapper 行为

Vue2 `__tests__/notesService.spec.js`(69 行)测了 **6 个 mapper 的 7 条行为**。上游实测(`notes.test.ts` 236 行,
有一个 `describe('notes 纯函数(移植 Vue2 notesService.spec.js)')` 专段):

| Vue2 spec 断言 | 上游承接 | 上游位置 | 强度 |
|---|---|---|---|
| `normalizeNote` snake→camel | ✅ | `:156-164` | 相同 |
| `normalizeNote` 容忍缺省可选字段(`tags`/`sourceRefs` → `[]`,`body` → `undefined`) | ✅ | `:165-171` | 相同 |
| `buildCreateBody` 发 snake_case | ✅ | `:172-176` **+ `:177-181` 另测默认值** | **更强** |
| `buildUpdateBody` 丢 undefined 保 revision | ✅ | `:182-188` | 相同 |
| `buildSettingsBody` 三种组合 | ✅ | `:189-197`,三条全在 **+ 多一条 `buildSettingsBody()` → `{}`** | **更强** |
| `normalizeSettings` 默认值 | ✅ | `:198-204` **+ 多一条 `normalizeSettings().notesRoot === ''`** | **更强** |
| `cancelDistillJob` **POST 到 `/distill/jobs/cancel`、body 是 `{path}`、返回 `r.data`** | ⚠️ **只承接了一半** | `:26-76` 的 URL/动词表**只断言了 `'post /ai/agent/notes/distill/jobs/cancel'`** | **缺 body `{path}` 与返回值 unwrap 两条** |

**结论**:6 个 mapper 里 **5 个的行为全部承接、其中 3 个比 Vue2 更强**;
**`cancelDistillJob` 缺 2 条断言**(request body 形状 + `res.data` 解包)。
上游那个 `recorder()` **已经记录 body**(`notes.test.ts:11-15` 的 `Call.body`),**补 2 行即可**。

🔴 **登记成上游票(不在本仓补,Service 全期零改动;按 P5c §9.4「包内转换逻辑一律归上游守」)**:
> **上游票 U-1**:`NimoOS-Service/src/notes.test.ts` 给 `cancelDistillJob` 补
> `expect(calls.find(c=>c.url.endsWith('/distill/jobs/cancel')).body).toEqual({ path: '/DATA/a.pdf' })`
> 与一条返回值 unwrap 断言(`recorder` 的 `dataFor` 回 `{cancelled:true}` → 断言 `r` 等于它)。
> **优先级低**:`cancelDistillJob` 在 P5d 零调用点(它属于 P5b 的沉淀队列/文件抽屉)。

⚠️ 另两份 Vue2 spec 的归属复核:`__tests__/notesMapper.spec.js` → **P5e**(E-27 成立,被测对象是
`@/service/searchMapper.js` 的 `buildSemanticSearchBlock`)· `__tests__/notesService.spec.js` → **上游**(本节)。
**本期真正要承接的只有 2 份**:`noteEditHelpers.spec.js`(2 条)与 `notesView.spec.js`(3 条)。
🔴 后者的 `statusBadge` **全仓零生产消费者**(蓝本模板里是内联 `kn-badge` 标记)——
按治理 §4.3 **照抄导出 + 照抄 3 条用例,不许因为「没人用」就删**。

---

## §4 遗留 `NEEDS_CONTEXT`(初稿口径;🔴 **修复轮 1 已全部裁定并清空,见 §6**)

> **现状**:**D-1 → 批准本期搬,追认 K45(裁定 R1)** · **D-2 → 批准 `^0.8.10`(裁定 R2)** ·
> 两个附带小项 → **R9 批准 293** / **R11 批准保留蓝本色相**。**本节保留作决策来龙去脉,已无待办。**

| # | 事 | 建议 | 阻塞谁 |
|---|---|---|---|
| **D-1** | `.k-btn.text` 缺口(E-40)—— 蓝本有规则、在 P5e 段、New-UI 没有,本期两个模板都用它 | 本期搬那 2 行 + `text` 进登记表(→16)+ P5e 交接项写「不许重复」;**建议给编号 K45** | **T2 / T6 / T7**(T1 不受影响) |
| **D-2** | `tiptap-markdown` 版本(E-36)—— 治理写 `^0.6.1`,蓝本实际 `^0.8.10` | 改 **`^0.8.10`**(T0 探针已用该组合五项全过) | **T4**(T1/T2/T3 不受影响) |

**附带请协调者拍板的两个小项**(不阻塞,附录里已给 T0 推荐值):
- 附录 D §D.2.1:「没有搬多」正则扩到 `ProseMirror` 后,`nme-content` / `ProseMirror` 是否一并进白名单
  (T0 推荐进 → 白名单 **293**)。
- 附录 B §B.1.1:两个 wash 渐变是否保留蓝本色相(T0 推荐保留,依 `--grad-sandbox` / `--grad-iri` 先例);
  若要改成本仓 warning 色相,**4 个 alpha 必须由协调者给定**(不许实现者自算,承 P5a T11 R9)。

---

## §5 提交与自查

- **零 `src/` 改动、零 `.vue`、零依赖安装**(tiptap 只装在 `/tmp/p5d-tiptap-probe/`,与本仓无关)。
- **文件数仍 326**(`.superpowers/` 不参与 vitest 计数;新增文件全是 `.md` / fixture,零 `*.test.ts`)。
- 未跑 `deploy.sh`、未写 `/var/lib`、未 `push`/`rebase`/`reset`/`stash`/`merge`、未用 `git add -A`。
- `NimoOS-UI` 只做了 `fetch`(只写 `FETCH_HEAD`)与 `git show`,**未 checkout / stash / reset**,未提交任何东西。
- 三门日志完整落盘:`/tmp/p5d-t0-test.log` · `/tmp/p5d-t0-tsc.log` · `/tmp/p5d-t0-build.log`。

---

## §6 修复轮 1(2026-08-04,评审 + 协调者裁定 R1–R14 后)

**评审判定**:任务质量 ✅ 通过(12 条勘误 **12/12 独立复核成立,零推翻**);规格 ❌(DoD 2 与 DoD 4 部分兑现)。
**本轮口径**:仍是**零产品代码**,只改 `.superpowers/sdd/` 下的三份附录 + 本报告 + 新增 1 个复现脚本。

**三门**:`pnpm test` = **`Test Files 326 passed (326)` / `Tests 3515 passed (3515)`** exit 0(纯 markdown 改动,
文件数与用例数与基线逐字一致)。`tsc` / `build` 按协调者口径省略(`.md` 不进这两个管线)。

### 逐条兑现(1–10 = 协调者派活顺序)

| # | 事 | 状态 | 怎么修的 / 取证 |
|---|---|---|---|
| **1** | **C-1 / R3** 附录 A §A.4 的 5 个 zh 值是自己译的 | ✅ **已修** | 订正为 `zh_CN.json`@`7a6ee6b7` 实际值:`Insight`→**`洞见`** · `Digest`→**`文摘`** · `Written by you`→**`手写`** · `Written by agent`→**`Agent 代写`** · `Auto-captured`→**`AI 沉淀`**;并在 §A.4 加了「**zh 值一律以 §A.2 为准,本表只为核对 labelKey 归属**」的双源消除说明 + 教训一句。**取证**:写了一次性脚本对附录做程序化比对 —— **§A.2 的 92 行 zh/en 双列 mismatch = 0(未动,仍全对)· §A.4 的 7 行 mismatch = 0(修好了)**。🔴 **§A.2 一字未动**(评审已程序化验过它是对的) |
| **2** | **I-1 / R4** 附录 D 缺 K44 顶层裸选择器例外一节 | ✅ **已修** | 新增 **§D.2.2**:例外集合 = **`['.nme-content .ProseMirror']`**(**集合相等式**,不是「排除掉算了」)· 断言形式 · **基线「现状顶层裸选择器 = 0」** · 剥注释必须用**保行版** · 两个 RED 探针(加一条第 0 列 `.foo{}` → 报红;把 K44 段嵌进 `.knowledge-app` → 集合变空 → 报红,证明守的是「恰好一条」)· 注释要求 · 与 §D.2/§D.2.1 三处口径一致的提醒。**取证**(我自己实测,非引评审):`grep -n "顶层\|裸选择器\|top-level" knowledgeStyles.test.ts` → 只命中 K10 注释 → **T2 是新建断言**;按大括号深度算现状 depth-0 开块选择器 **15 条**,全是 `.knowledge-app`(`:130`/`:345`/`:1808`)/ `:root[...]`(`:249`/`:1987`)/ `@keyframes`(10 条)→ **裸选择器 = 0** |
| **3** | **R1** `.k-btn.text` 追认 K45 | ✅ **已修** | §D.4.1 标题从「需要裁定(D-1)」改成「**已裁定:本期搬,K45**」,并写全:搬什么(蓝本 `:1569-1570` 两行)· 搬到哪(**`&.danger`(实测 `:735-742`)之后、`&:disabled`(实测 `:743`)之前**,嵌套 `&.text` 写法)· 依据引裁定书 R1 的 K43 同构先例(**没有再自行论证**)· 零色字面量 · 归属(`text` 只进 R8 登记表)· 声明处注释引 **K45** 而非行号 · 🔴 **P5e 交接项一行**「P5d 已搬(K45),P5e 不许重复搬,搬 `:1540-…` 段时必须跳过这两行」· 🔴 **重复搬的可守法**:白名单集合断言守不住它(正则收不到 `text`)→ 改用「`&.text` 在文件里恰好出现 2 次」的计数断言,**列为 K45 的落地 DoD 之一** · 为什么不是 N10 家族 · 唯一性 |
| **4** | **R8 / R9** 两个数值收敛成单一终值 | ✅ **已修**(见下方「终值」) | 写了 `.superpowers/sdd/p5d-gen-r8r9-sim.mjs`,**逐字复刻生产逻辑**(`stripComments` 抄 `knowledgeStyles.test.ts:23-27`、`nonKClassNames` 抄 `:244-256`),输入 = 现状 `knowledge.scss` + 本期 10 段 + K44 段 + **K45 的 2 行**。**先自证复刻正确**(现状实测 10 项 == 现状登记表,`true`),再取拼入后的值。命令与完整输出已抄进附录 D §D.2.0 / §D.2.1.1 |
| **5** | **R2** tiptap 版本裁定入附录 | ✅ **已修** | 新增 §D.6.3 终值表:四包定死(`tiptap-markdown@^0.8.10`)· K37/A-7 的 `^0.6.1` 作废 · **K37「锁 v2」实质未破**(0.8.10 peer 是 `core ^2.0.3`;v3 线是 0.9.x → `core ^3.0.1`)· 🔴 **治理 §14-1 的期望串必须改成 `2.x`/`0.8.x`**(否则 T4 按 §14-2 核版本会把自己判红)· 不装 `core`(peer,已实证四包够用)/ `extension-highlight` / `extension-typography`(P5d 三个蓝本文件零引用)· `markdown-it` 不另装不改版 |
| **6** | **I-2 / R5** §D.6.1 的 N29 是推理不是实证 | ✅ **已修** | §D.6.1 顶部加了一个 🔴 框:逐条标注「K38 双 emit ✅ 实证 / §5.3 防回环 ✅ 实证 / **N29 🔴 未实证**」,写清探针只挂了编辑器 SFC、父组件 `tbActive()`+`tbTick`+`@transaction` → `data-on` 整条链路从未挂载,探针只证了前提(`onTransaction` 真触发、`isActive` 可用);并写「机制上风险低但**低风险 ≠ 已证**」+ 🔴 **T4/T7 不许引本节当已证,必须各自附变异证据**;表格里 N29 那行也同步标注 |
| **7** | **I-4 / R6** §D.0 补一句结论 | ✅ **已修** | 新增 **§D.0.1**:98 个模板静态类里「蓝本 scss 与 New-UI 现状**双双无规则**」的**只有 2 个** —— `nme`(N10,不搬)与 `text`(K45,搬);其余 **71** 个被「65 新增 + 25 既有 + 新增非 `k*` 类」覆盖 → **T6/T7 不会卡住**。按 R6 **未**列全 73 个 |
| **8** | **R7** 四处小错 | ✅ **已修**(4/4,均自己复测) | **M-1**:附录 B §B.5 那句「只扫 `.vue` 的 `<style>` 与 `.css`/`.scss`」→ 改成「只扫 `.vue` 的 `<style>` 与 `.css`」,并写清**为什么这个错危险**(会让下游误以为 `knowledge.scss` 有 color-guard 兜底);实测 `color-guard.test.ts:15-16` glob 只有 `../**/*.vue` 与 `../**/*.css`。**M-2**:`pathHtml` 实测在 **`:71`**(初稿 `:58`),结论不变。🔴 **M-3**:`.kn-tb-btn` 实测 **×8**(`grep -c 'kn-tb-btn'` = 8、`grep -c 'kn-tb-btn.*data-on'` = 8),初稿标 ×7 是数错(同行的 8 个行号本来就对);附录已改成 **×8** 并写明「T7/T8 的计数断言一律用 8」。**M-4**:`en_US.json` **叶子 2742→2744**(初稿的 2766→2768 是文件行数),报告 DoD 1 表已就地订正 |
| **9** | **R10** en 值落地口径入附录 A | ✅ **已修** | §A.0① 下新增「裁定 R10」小节:en 权威源 = `en_US.json`@`7a6ee6b7`(**不是 `$t()` 原串**)· 依据(默认与 fallback locale 都是 `en_us` → **1:1 保真以「渲染值」为准**)· 本期命中 2 条 · 落地判据(**每条 en 正向 + 反向断言**,并说明「只写正向零判别力」的理由)· 🔴 **verify 脚本 en 侧不许再假设「en = JSON key」**,要逐条读 `en_US.json[原串]`,DoD 92/92 |
| **10** | **R11** 两个 wash 渐变保留蓝本色相 | ✅ **已修** | 附录 B §B.1.1 末尾把「T0 的裁定,若协调者要改需给 alpha」替换成「**协调者已批准保留蓝本色相**」,引裁定书 R11 的依据(K39 授权新渐变 token;A-9 只管 soft 填充不管渐变)+ 明写「协调者不会给那 4 个 alpha,不许自己重算」→ **开放项已消除** |

### 🔴 R8 / R9 实测终值(**T2 的阻塞项,单一值,无开放问题**)

复现:`node .superpowers/sdd/p5d-gen-r8r9-sim.mjs`

```
=== R8:NON_K_HELPER_CLASSES 终值 ===
现状实测        : 10 ["danger","ghost","mono","outline","primary","right","second","spin","suffix","warn"]
现状 == 登记表   : true          ← 复刻逻辑与生产一致的自证
拼入后实测      : 18
新扫出          : 8  ["ProseMirror","dot","lbl","nme-content","sep","spacer","text","wide"]
  走排除条件     : ["ProseMirror","nme-content"]
  进登记表       : ["dot","lbl","sep","spacer","text","wide"]
🔴 R8 终值 = 10 + 6 = 16
'text' 被 nonKClassNames 扫到 : true      ← R8「实测优先」条款的判据:扫得到
'nme'  被扫到                 : false     ← 蓝本零选择器,符合预期

=== R9:「没有搬多」白名单终值 ===
严格超集自证(现状) : old ⊆ new = true  (old 225 / new 225)
拼入后扫出            : 292
白名单外(要新增)    : 67  = k*/fb* 65 + ["ProseMirror","nme-content"] 2
'text' 被这条扫到     : false
🔴 R9 终值 = 226 + 67 = 293   → 常量 WHITELIST_226 → WHITELIST_293
```

**两个终值与协调者的预期一致(16 / 293),故不触发 R8/R9 的「实测优先」改写条款。**
🔴 **`text` 的归属**:**只进 R8 的登记表,不进 R9 的白名单** —— 判据是两条守卫的正则:
`nonKClassNames` 的 `/\.([a-zA-Z][a-zA-Z0-9_-]*)/g` **会**从 `&.text {` 里扫出 `text`
(与既有 `ghost`/`outline`/`primary`/`danger` 四个 `&.x` 变体完全同款);
「没有搬多」的正则只收 `k*`/`fb*`/`nme*`/`ProseMirror`,**扫不到 `text`**(实测 `false`)。**不在两侧重复登记。**

⚠️ **顺带的判别力提醒**(附录 D §D.2.1.1 已写):严格超集自证里 `old 225 / new 225` **完全相同**
→ 正则扩展在现状文件上**零可观测** → **RED 探针是它唯一的判别力证据,T2 不许省。**

### 本轮改了哪些文件

| 文件 | 改动 |
|---|---|
| `p5d-appendix-A-i18n.md` | §A.4 的 5 个 zh 值 + 双源消除说明(R3)· §A.0① 下新增「裁定 R10」小节。**§A.2 一字未动** |
| `p5d-appendix-B-tokens.md` | §B.5 的 M-1 订正 · §B.1.1 的 R11 已裁定 |
| `p5d-appendix-D-classes.md` | 新增 §D.0.1(R6)· §D.2.0(R8 终值 16)· §D.2.1.1(R9 终值 293)· §D.2.2(R4 K44 例外)· §D.6.3(R2 版本)· §D.4.1 改为 K45 已裁定(R1)· §D.6.1 的 R5 标注 · M-2 / M-3 订正 |
| `p5d-gen-r8r9-sim.mjs` | **新增** —— R8/R9 的复现脚本(逐字复刻生产守卫逻辑) |
| `p5d-task-0-report.md` | DoD 1 表的 M-4 订正 + 本 §6 |

### 遗留 `NEEDS_CONTEXT`

**无。** 初稿的 D-1 / D-2 已由 R1 / R2 裁定并写进附录;两个附带小项已由 R9 / R11 裁定并消除;
R8/R9 的两个数已收敛成程序化实测的单一终值。**T1 与 T2 的阻塞项全部清空。**

### 未做的事(按协调者口径)

- **R12 / R13 / R14 未查**(协调者已自行判掉:`Service/dist` 与 `src` 一致、P5e 段归属零冲突、三门不复跑)。
- `tsc` / `build` 未复跑(纯 `.md` 改动 + 1 个台账 `.mjs`,不进这两个管线;`pnpm test` 已跑并确认 326/3515)。
- `src/` **零改动**、未装依赖、未部署、未 push/rebase/reset/stash/merge、未用 `git add -A`。
