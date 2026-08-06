# P5d · T2 报告 —— `knowledge.scss` 65 类 + K39 新 token + K45 + 守卫(§9.6 + A-11 + R4/R8/R9)

起点 HEAD `56f8849`(T0 `cc6d7c8`/`03db682` + T1 `56f8849` 已关账)。改动仅两个文件:
`src/ai/styles/knowledge.scss`、`src/ai/styles/knowledgeStyles.test.ts`。零 `.vue`、零测试文件新增。

## 0. 基线复核(先证与协调者同一基准)

`node .superpowers/sdd/p5d-gen-r8r9-sim.mjs`(改动**前**跑,即 T1 收官版本 `56f8849`)输出与
brief §2 逐字一致:

```
🔴 R8 终值(10 + 进登记表的) = 16
'text' 是否被 nonKClassNames 扫到 : true
'nme' 是否被扫到                  : false
严格超集自证(现状):old ⊆ new = true  (old 225 / new 225)
🔴 R9 终值(226 +) = 293
```

## 1. §T2 逐条兑现

| 计划书 §T2 条目 | 落地 |
|---|---|
| 共享底座残余(`:2029` + `:2040-2045`) | A 段(`knowledge.scss:1793-1806`),`.kn-badge` 5 条不重复定义 |
| path strip(`:2047-2056`) | B 段 |
| draft inbox(`:2057-2085`) | C 段,含 `--grad-inbox-wash`/`--grad-note-insight`/`--shadow-warning-glow`/`--text-on-accent` |
| notes list(`:2086-2121`) | D 段,含 `--success-soft`/`--danger-soft`/`--text-on-accent` |
| edit pane(`:2122-2194`,含 `.kn-editor-body-wrap .nme-content .ProseMirror`) | E 段,含 `--grad-draftbar-wash` |
| edit aside(`:2195-2241`) | F 段,零色字面量 |
| conflict modal(`:2242-2249`) | G 段,`--accent-soft`/`--warning-soft` |
| responsive(`:2265-2281`) | H 段(`@media` ×2) |
| `.k-seg`(K43,`:551-571`) | 嵌入 `.knowledge-app`,零色字面量,P5e 不许重复搬 |
| ProseMirror 顶层段(K44) | 保持顶层裸选择器,紧邻 `.knowledge-app` 闭合处 |
| K45(`.k-btn.text`) | 插入既有 `.k-btn` 块 `&.danger` 后 `&:disabled` 前,`&.text`/`&.text:hover` 各一行 |
| 不搬清单 | `.k-section-body`/`.k-progress-*`/P5c 已搬的 `kn-*`/P5b 已搬的 `.kn-badge` 均未出现(仅注释提及),已 grep 核实 |
| 守卫改动 5 条(§9.6) | 全部落地,见 §3 |

## 2. K39 新 token(9 个,附录 B §B.1 逐个核对)

| token | 暗档 | 浅档 | 蓝本出处 |
|---|---|---|---|
| `--grad-note-note` | `linear-gradient(135deg,#5AC8FA,#007AFF)` | 同左 | `notesViewHelpers.js:6`,与既有 `--grad-sandbox` 逐字同值(仍另建新名) |
| `--grad-note-summary` | `linear-gradient(135deg,#30B0C7,#34C759)` | 同左 | `:7`,全仓零同值先例 |
| `--grad-note-insight` | `linear-gradient(135deg,#FF9500,#FFCC00)` | 同左 | `:8` + `knowledge.scss:2066`,两个消费方共用一份(只声明一次,已测) |
| `--grad-note-digest` | `linear-gradient(135deg,#AF52DE,#FF2D55)` | 同左 | `:9`,全仓零同值先例 |
| `--grad-inbox-wash` | 160deg 两停点橙渐变 | 同左 | `knowledge.scss:2060`,保留蓝本色相(R11) |
| `--grad-draftbar-wash` | 135deg 两停点橙渐变 | 同左 | `:2132`,保留蓝本色相(R11) |
| `--shadow-warning-glow` | `0 3px 8px rgba(224,165,59,.3)` | `0 3px 8px rgba(200,134,10,.24)` | `:2067`,**两档不同值** |
| `--code-block-bg` | `#0d0d0d` | 同左 | `NotesMarkdownEditor.vue:44` |
| `--code-block-fg` | `#ffffff` | 同左 | 同上 |

诚实登记:仅 `--grad-note-note` 与既有 `--grad-sandbox` 逐字同值,另 3 个笔记渐变全仓零同值先例。

## 3. 守卫改动(§9.6)与 K/N 编号申报

- 「没有搬多」正则扩到 `nme(?:-…)?`/`ProseMirror` + 字符集加 `A-Z`(兑现 A-11 债票),新增严格超集自证用例。
- `nonKClassNames` 排除条件加 `nme-content`/`ProseMirror`。
- **`NON_K_HELPER_CLASSES` 10 → 16**(裁定 R8,已在注释里明确订正治理 A-10「保持 10 项」是错的)。
- `WHITELIST_226` → `WHITELIST_293`(裁定 R9)。
- K44 新建集合相等断言(裁定 R4)。
- 命中编号:K9、K39、K43、K44、K45、A-9、A-11、R1、R4、R8、R9、R11、E-34、E-39。

## 4. 四组 RED 探针(均 cp+md5 还原,禁 `git checkout`)

**探针①「没有搬多」超集**:注入 `.kn-foo{}` → 报红(`白名单外的类:kn-foo`);还原;注入 `.fb-Foo{}`
(验证 A-11 字符集含大写)→ 报红(`fb-Foo`);还原。两次 md5 与还原前一致
(`5b198dc3bd478e971f3c91a2a51b980d`),`git status` 只显示两个预期改动文件。

**探针②K45 锚定作用域**:① 在 `.k-btn` 块内加第 3 个 `&.text` → 报红(`出现 3 次`);还原。
② 在 `.k-seg` 的 `button{}` 内加一个无关的合法 `&.text`(**不在** `.k-btn` 内)→ 断言仍绿,
证明锚定不误红;还原。

**探针③K44 顶层集合相等**:① 文件末尾加 `.foo{}` → 报红(`+ ".foo"`);还原。
② 把 K44 块临时套进 `.knowledge-app{}` → 集合变 `[]` → 报红,证明断言守的是「恰好一条」不是
「至多一条」;还原。

**探针④`NON_K_HELPER_CLASSES` 集合相等**:注入 `.kn-toolbar .zzz{}`(真嵌套辅助类)→ 两条断言均
报红(`zzz`);还原,md5 一致。

每次还原后均重跑对应用例转绿,且全程 `git status` 只有 `knowledge.scss`/`knowledgeStyles.test.ts`
两个预期文件、无 gitignore 产物污染。

## 5. `DARK_/LIGHT_TOKEN_SELECTOR` 一字未改自证

`diff` 逐字节比对 `git show HEAD:...` 与当前文件的三行声明(`knowledgeStyles.test.ts` 现
`:452-454`)—— **完全一致**;scss 的两个选择器行(现 `:162`/`:306`)与 T1 收官版本(`:130`/`:249`)
逐字相同,仅因头部新增注释导致行号整体下移,内容零改动。

## 6. 三门 + 两个额外门

- `pnpm test`:**326 files / 3551 tests**,全绿。算式:`3544(T1 基线)+ 7(本刀新增)= 3551`。
- `pnpm exec vue-tsc --noEmit`:exit 0。
- `pnpm build`:exit 0。
- 额外门①`sass --no-source-map`:exit 0。
- 额外门②:`grep -o "kn-note-row" dist/assets/*.css` 命中(`index-BD7LhLwU.css`)。

日志:`/tmp/p5d-t2-test-final.log`、`/tmp/p5d-t2-tsc-final.log`、`/tmp/p5d-t2-build-final.log`。

## 7. 提交

`git add -f src/ai/styles/knowledge.scss src/ai/styles/knowledgeStyles.test.ts .superpowers/sdd/p5d-task-2-report.md`,
一个语义提交。
