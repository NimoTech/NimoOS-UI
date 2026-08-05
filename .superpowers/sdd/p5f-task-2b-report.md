# SP8-P5f · Task 2b 报告(守卫整改轮 —— 裁定 R20 的 C-1 / I-1 / I-2 / M-a / M-b)

**分支**:`sp8-ai` · **起点**:`2fc46e1`(自跑 `git log --oneline -3` 确认)
**改动范围**:`src/ai/styles/knowledgeStyles.test.ts` **一个产品侧文件** + 台账两份
(`p5f-task-2-report.md` 的 M-b 订正块 + 本文件)。
🔴 **`src/ai/styles/knowledge.scss` 零改动**(`git diff --stat` 空,自证见 §5)。
🔴 **任何 `.vue` 零改动**。

---

## 0. 一句话结论

裁定 R20 的五件事**全部闭合**,五条判据**全部亲手实证报红/报绿**。
三门 + sass 门全绿:**`Test Files 335 passed` / `Tests 4370 passed` / tsc exit=0 / build exit=0 / sass exit=0**。
用例数 **4337 → 4370(+33)**,归因表与总数自洽(R24)。

---

## 1. 三门 + 额外门(全量、落盘、未 `| tail`)

| 门 | 命令 | 结果 |
|---|---|---|
| 起点基线(**自跑**,未采信 brief) | `pnpm test` | **`Test Files 335 passed (335)` / `Tests 4337 passed (4337)`** / exit=0 —— 与 brief 给的 335/4337 **逐字一致** |
| 测试 | `pnpm test > …/t2b-test.log` | **`Test Files 335 passed (335)` / `Tests 4370 passed (4370)`** / **exit=0** |
| 类型 | `pnpm exec vue-tsc --noEmit > …/t2b-tsc.log` | **exit=0**,零输出 |
| 构建 | `pnpm build > …/t2b-build.log` | **exit=0**,`✓ built in 13.83s` |
| **额外门** | `pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` | **exit=0**,零输出 |

**红项:0 条。** 已知噪声(`persist.test.ts > dropPersisted` / `AgentComposer.test.ts` teardown 竞态)本轮**未出现**。

### 1.1 🔴 用例数归因表(裁定 R24:必须与总数自洽)

| 项 | 值 |
|---|---|
| 起点 | `Test Files 335` / `Tests 4337` |
| 本刀新增测试**文件** | **0**(只改既有 `knowledgeStyles.test.ts`)⇒ 文件数 **335 → 335** ✅ |
| 本刀新增**用例** | **+33** |
| 落地后 | **335 / 4370** ✅ `4337 + 33 = 4370` |
| 单文件复跑坐实 | `knowledgeStyles.test.ts` **374 → 407**,差 **+33** ✅ 与总数一致 |

**+33 的逐条归因**:

| describe | 新增 | 明细 |
|---|---|---|
| **`K44(裁定 R19/R20 C-1)—— src/ai/knowledge/** 全体 .vue 零 <style> 块`**(新建) | **19** | 防空转①(路径基座 + views 子目录在扫描范围内)· 防空转②(谓词在全仓 115 个真样本上双向同解)· 加固自证(旧裸子串 vs 新谓词命中数)· **`it.each` 16 条**(`src/ai/knowledge/**` 现有 16 个 `.vue` 逐个一条) |
| **`I-1(裁定 R20):8 个色映射落点的 token 消费绑定`**(新建) | **12** | **`it.each` 8 条**(附录 B §B.4:两个块 × {allow,deny} × {background,color})· 防空转(清单恰好 8 条且互不重复)· §B.3-②(`.k-extgroup-icon`)· §B.3-③(`.k-ext-chip[data-on] .k-ext-chip-mark`)· 覆盖度自检(4 条变体行锚点唯一) |
| **`K55` 内追加(M-a)** | **2** | 防空转(`groupBgErrors` 谓词在 4 份合成样本上有判别力)· M-a 自动上膛条件断言 |
| **合计** | **33** | ✅ |

⚠️ **既有用例一条都没有被删除**;被改的只有 **3 条**既有断言的**谓词**,三条全部是**加固**,逐条程序化证明见 §4。

---

## 2. 🔴🔴 C-1 —— K53 守卫谓词:裸子串 → 先剥注释 + 行首锚定 + 全区参数化

### 2.1 事实复核(R21:两条以上独立口径,原始输出全贴)

**口径 A(shell grep,行首锚定)**
```
$ grep -rlE '^[[:space:]]*<style[ >]' src --include=*.vue | wc -l
115
```
**口径 B(shell grep,闭标签 —— 与口径 A 实现路径完全不同)**
```
$ grep -rl '</style>' src --include=*.vue | wc -l
115
```
**口径 C(node 逐文件正则,第三条独立口径)**
```
total .vue = 185
行首锚定 open = 115
含 </style> = 115
裸子串 <style = 136
裸子串多出来的 21 个:
  src/ai/components/blocks/TerminalCard.vue
  src/ai/components/settings/mcp/McpServerDetail.vue
  … (省略中间 17 个,全部为注释命中)
  src/ai/knowledge/views/KnowledgeDeferred.vue
  src/ai/knowledge/views/KnowledgeLayout.vue
  src/ai/knowledge/views/SearchView.vue
  src/ai/knowledge/views/SettingsView.vue
```
**知识库区专项**
```
$ find src/ai/knowledge -name '*.vue' | wc -l        → 16
$ grep -rlE '^[[:space:]]*<style[ >]' src/ai/knowledge --include=*.vue | wc -l → 0
$ grep -rl '</style>' src/ai/knowledge --include=*.vue | wc -l               → 0
$ grep -rl '<style'  src/ai/knowledge --include=*.vue | wc -l               → 10   ← 裸子串假阳性
```
⇒ **裁定 R19 完全成立**:知识库区 16 个 `.vue` **零 style 块**,裸子串在同一批上命中 **10 个**
(4 个视图 + `FolderBrowser` / `KFileViewer` / `FileDetailDrawer` / `NotesMarkdownEditor` /
`ParserStatus` / `ParserTest`),**全是注释里「零 `<style>` 块」「蓝本 `<style scoped>`」这类字面文字**。
**T2 的 R18 申报据此驳回**,已在 `p5f-task-2-report.md` §4.7 / §8-1 按「反转不删」加订正块(M-b)。

### 2.2 落法

```ts
function stripVueComments(src) {          // ① 先剥注释:HTML / JS 块 / 整行 JS 行注释
  return src.replace(/<!--[\s\S]*?-->/g,'')
            .replace(/\/\*[\s\S]*?\*\//g,'')
            .replace(/^[ \t]*\/\/.*$/gm,'')
}
function hasStyleBlock(src) {             // ② 再行首锚定,两条独立信号取「或」(更敏感 = 加固)
  const s = stripVueComments(src)
  return /^[ \t]*<style[\s>]/m.test(s) || /^[ \t]*<\/style>\s*$/m.test(s)
}
```
🔴 **禁裸子串 `includes('<style')`**(写进注释)。
🔴 **剥注释与行首锚定缺一不可**:只行首锚定挡不住块注释里独占一行的 `<style scoped>` 引用;
只剥注释挡不住行内引用被子串撞对。

**范围**:从「只钉 `views/RootsView.vue` 一个文件」扩成 **`src/ai/knowledge/**` 全体的 `it.each`**,
清单在**测试运行时**从磁盘 `node:fs` 递归读 ⇒ **T5 建 `RootsView.vue`、T6 建 `WikiView.vue`、
T7 建 `AllowlistView.vue` 的那一刻自动多出一条用例,无需任何人改这里**(R20 要求的「一次上膛,免每刀记账」)。
⚠️ **故意不做集合相等**(那正是要免掉的「每刀记账」)。

**§9.19 跨刀冲突论证**:K44 是**全期纪律**,T5/T6/T7 本来就不许在 `.vue` 里写 `<style>` 块
⇒ 本守卫**不向后续任何一刀索要它无权写的东西**,**不冲突**。

**顺带修的两条既有断言**(同一谓词,同一根因):
- `K53` describe 的「防空转②」—— 原文的「正例」完全由 4 行注释撑着(见 §4-b);
- `K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>` —— 谓词换成 `hasStyleBlock()`。
  **这条 T2 已过评审,§9.10 只许加固不许删,故保留**(它带 K53 专属错误信息)。

### 2.3 🔴 防空转正例取自全仓真样本(R20 明令,不是那 4 行注释)

`防空转②` 对全仓 185 个 `.vue` 做**双向**比对:
- 「含 `</style>`」的 115 个,`hasStyleBlock` **必须全部判真**(漏一个即精确指名);
- 「`hasStyleBlock` 判真」的,**必须全部含 `</style>`**(防谓词被注释撞对 = 裸子串复发);
- 两侧计数都 `> 100`(防「零文件 ⇒ 恒绿」)。

`加固自证` 在**知识库区同一批 16 个文件**上比对:
`旧裸子串命中 > 0`(实测 10)且 `新谓词命中 = 0` 且 `旧 > 新`(严格减少 ⇒ 这次改动**可观测**)。
🔴 **这就是 §9.10 要求的「加固前 X 命中 N 个 / 加固后 1 个」程序化证明,不是自我声明。**

### 2.4 🔴 两种偏态各验一次(R20 的核心判据)

**偏态 ①(必须绿)** —— 按同目录既定文风建**零 style 块**、注释里含「零 `<style>` 块」字面量的
`views/RootsView.vue`:

注入落盘自证:
```
$ grep -cE '^[[:space:]]*<style[ >]' src/ai/knowledge/views/RootsView.vue   → 0
$ grep -c '</style>' src/ai/knowledge/views/RootsView.vue                   → 0
$ grep -c '<style'   src/ai/knowledge/views/RootsView.vue                   → 3   ← 裸子串会命中
   4:  零 <style> 块:蓝本 :121-186 的 66 行 <style scoped> 已由 T2 按 K53 整块搬进
   5:  `src/ai/styles/knowledge.scss`(9 个 kr-* 类),本文件不再写 <style>。
  12:// 🔴 K44 —— `.vue` 侧零 `<style>` 块;样式走 KnowledgeLayout 的 JS 侧 import。
```
**新旧谓词逐字对照**(同一份文件):
```
旧谓词 src.includes("<style") = true   ← T2 版会据此报「出现 <style> 块」(误报)
新谓词 hasStyleBlock          = false
```
`--reporter=verbose` 结果:
```
✓ K44 —— views/RootsView.vue 零 <style> 块(剥注释 + 行首锚定;注释里写「零 <style> 块」必须仍绿)
✓ 防空转 —— 同目录既有视图能读到非空内容,且新谓词在本目录一致判「无 style 块」
✓ K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>(T5 建文件时自动上膛)
✓ K53 判据④ —— 9 个 kr-* 在「knowledge.scss 之外的全部样式来源」里逐类零出现
Tests  1 failed | 407 passed (408)
```
🔴 **唯一红项是既有的「守卫缺口③′ > 文件清单集合相等」**
(`+ "views/RootsView.vue"` / `expected […(17)] to deeply equal […(16)]`)——
**那是 T5 该做的登记,不是误报**;评审在 C-1 里也是这么标注的。
**✅ 结论:C-1 的误报雷已拆除 —— T2 版在这份文件上会报「出现 <style> 块」,T2b 版全绿。**

**偏态 ②(必须红)** —— 同一文件行尾追加一个**真** `<style scoped lang="scss">` 块:

注入落盘自证:`^\s*<style[ >]` 命中 **1**、`</style>` 命中 **1**。
```
× 加固自证 —— 同一批知识库 .vue 上,旧裸子串谓词命中 > 0 而新谓词命中 0
  → 知识库区出现真 <style> 块(K44 被破) —— 或者新谓词也被注释撞对了:
    expected [ 'views/RootsView.vue' ] to deeply equal []
× K44 —— views/RootsView.vue 零 <style> 块(剥注释 + 行首锚定;注释里写「零 <style> 块」必须仍绿)
  → views/RootsView.vue 出现真 <style> 块 —— K44 要求整块搬进 src/ai/styles/knowledge.scss,.vue 侧零 <style>
    : expected true to be false
× 防空转 —— 同目录既有视图能读到非空内容,且新谓词在本目录一致判「无 style 块」
  → views 目录出现真 <style> 块的文件(K44 被破):RootsView.vue: expected [ 'RootsView.vue' ] to deeply equal []
× K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>(T5 建文件时自动上膛)
  → RootsView.vue 出现真 <style> 块 —— K53 要求那 66 行整块搬进 knowledge.scss,.vue 侧零 <style>
    : expected true to be false
Tests  5 failed | 403 passed (408)
```
🔴 **4 条具名 failed 用例**(第 5 条是既有的清单集合相等)。
**✅ 结论:真 style 块必报红,谓词不是恒假的空壳。**

**还原**:`rm src/ai/knowledge/views/RootsView.vue` → `ls` 确认不存在;
`views/` 目录 8 个 `.vue` 的 `md5sum` 与探针前逐字节相同;`git status --short` 只剩 ` M src/ai/styles/knowledgeStyles.test.ts`。
🔴 **临时文件未提交。禁 `git checkout/restore`,全程 `cp`/`rm` + `md5sum`。**

### 2.5 🔴 参数化防空循环(§9.14-4)

`--reporter=verbose` 逐条列出 **16 条独立具名用例**真在执行(非「清单读取失败、循环体一次没跑」):
```
✓ K44 —— components/FileDetailDrawer.vue 零 <style> 块 …
✓ K44 —— components/FolderBrowser.vue 零 <style> 块 …
✓ K44 —— components/KFileViewer.vue 零 <style> 块 …
✓ K44 —— components/KIcon.vue 零 <style> 块 …
✓ K44 —— components/NoteEditPane.vue 零 <style> 块 …
✓ K44 —— components/NotesMarkdownEditor.vue 零 <style> 块 …
✓ K44 —— parser/ParserStatus.vue 零 <style> 块 …
✓ K44 —— parser/ParserTest.vue 零 <style> 块 …
✓ K44 —— views/DashboardView.vue 零 <style> 块 …
✓ K44 —— views/IndexedFilesView.vue 零 <style> 块 …
✓ K44 —— views/KnowledgeDeferred.vue 零 <style> 块 …
✓ K44 —— views/KnowledgeLayout.vue 零 <style> 块 …
✓ K44 —— views/NotesView.vue 零 <style> 块 …
✓ K44 —— views/QueueView.vue 零 <style> 块 …
✓ K44 —— views/SearchView.vue 零 <style> 块 …
✓ K44 —— views/SettingsView.vue 零 <style> 块 …
```
**16 条 = `find src/ai/knowledge -name '*.vue' | wc -l` 的 16 ✅ 逐字相符。**
另有 `防空转①` 的两条硬断言(清单 `> 0` + `views` 子目录在内)常驻防空循环。
**偏态①/② 期间自动变成 17 条**(多出 `views/RootsView.vue`)—— **自动上膛已实证**。

---

## 3. 🟠 I-1 —— 8 个色映射落点的 token 消费绑定

### 3.1 8 处清单(🔴 自己复核,以附录 B + `knowledge.scss` 现状为准)

| # | 出处 | 选择器 | 属性 | token |
|---|---|---|---|---|
| 1 | §B.4-1 | `.k-frow-action` → `&[data-act="allow"]` | `background` | `--success-soft` |
| 2 | §B.4-2 | 同上 | `color` | `--success` |
| 3 | §B.4-3 | `.k-frow-action` → `&[data-act="deny"]` | `background` | `--danger-soft` |
| 4 | §B.4-3 同行 | 同上 | `color` | `--danger`(蓝本本来就是 token,照抄;一并钉住 = 加固) |
| 5 | §B.4-4 | `.k-radio-card-icon` → `&[data-tone="allow"]` | `background` | `--success-soft` |
| 6 | §B.4-5 | 同上 | `color` | `--success` |
| 7 | §B.4-6 | `.k-radio-card-icon` → `&[data-tone="deny"]` | `background` | `--danger-soft` |
| 8 | §B.4-6 同行 | 同上 | `color` | `--danger`(同 #4) |
| 9 | §B.3-② | `.k-extgroup-icon` | `color` | `--text-on-accent` |
| 10 | §B.3-③ | `.k-ext-chip` → `&[data-on="true"]` → `.k-ext-chip-mark` | `color` | `--text-on-accent` |

🔴 **复核结论**:评审说的「8 处」= **§B.3 在 scss 里的 2 处 + §B.4 的 6 处字面量**。
落到**属性级**则是 **10 个断言点**(§B.4 的 6 处字面量分布在 4 行 × 8 个属性)。
**本刀 10 个全部钉住**,比评审要求的 8 处**多覆盖 2 条**(#4 / #8 那两个「蓝本本来就是 token」的 `color`)
—— 这是**加固**,已按 R22 显式申报。
🔴 **§B.3-① 是 `AllowlistView.vue:30` 的模板 `color="white"`,属 T4 范围,不在 `knowledge.scss` 里**,本刀不覆盖。

### 3.2 手法

沿用本档 **R16 小节的 `nestedBlockBody()` 模具**(P5e-T4 因裁定 R16 补的那批),零发明。
- §B.4 八条走 `it.each`,先 `nestedBlockBody(cssKeepLines, 块选择器行)` 取块体,
  再用 `variantLine()`(**整行 trim 后以 `&[…]` 开头**,不是子串搜索)切出变体行;
  `variantLine` 内部断言**块内该变体行恰好 1 条**(锚点唯一性自检)。
- §B.3-③ 🔴 **`.k-ext-chip-mark {` 在本档有两处**(嵌套的 + 顶层基类,`grep -cF` = 2)
  ⇒ **必须逐层下钻** `.k-ext-chip` → `&[data-on="true"]` → `.k-ext-chip-mark`,
  不许直接锚(直接锚会撞对第一处 = 本档第六次同族「子串/首个匹配撞错块」)。
  下钻后另断 `background: var(--accent);` 作**覆盖度自检**,证明真的钻到了那一层。
- §B.3-② 另加**反向**断言:块内不许出现 `var(--on-accent)`(附录 B §B.3.1 明确排除的替身,暗档是深色)。
- **防空转**:`B4_BINDINGS` 恰好 8 条且**去重后仍是 8**(防空循环 + 防重复项冒充覆盖)。

### 3.3 🔴 两条判据实证(评审指定的两个探针,必须报红)

**探针 P-1 —— 互换 `allow` / `deny` 消费的 token**

注入落盘自证(行首锚定 grep):
```
1517:    &[data-act="allow"] { background: var(--danger-soft); color: var(--danger); }
1520:    &[data-act="deny"]  { background: var(--success-soft); color: var(--success); }
```
```
× 附录 B §B.4 —— .k-frow-action { 内 &[data-act="allow"] 的 background 消费 var(--success-soft)(判据:allow/deny 互换 → 必须报红)
  → .k-frow-action { 的 &[data-act="allow"] 里 background 不是 var(--success-soft):
    &[data-act="allow"] { background: var(--danger-soft); color: var(--danger); }
    : expected '&[data-act="allow"] { background: var…' to contain 'background: var(--success-soft);'
× 附录 B §B.4 —— .k-frow-action { 内 &[data-act="allow"] 的 color 消费 var(--success)(…)
  → … : expected … to contain 'color: var(--success);'
× 附录 B §B.4 —— .k-frow-action { 内 &[data-act="deny"] 的 background 消费 var(--danger-soft)(…)
  → … : expected … to contain 'background: var(--danger-soft);'
× 附录 B §B.4 —— .k-frow-action { 内 &[data-act="deny"] 的 color 消费 var(--danger)(…)
  → … : expected … to contain 'color: var(--danger);'
Tests  4 failed | 403 passed (407)
```
**还原**:`cp` 备份回写 → `md5sum` **`8b8d7fbf9a5f345154e428cbff8c2771`** 与备份逐字节相同 ✅

**探针 P-2 —— 换掉 `--text-on-accent`(两处 → `--text-primary`)**

注入落盘自证:`sed -n '1397p;1440p'` →
```
    color: var(--text-primary); flex-shrink: 0;
        color: var(--text-primary);
```
```
× 附录 B §B.3-② —— .k-extgroup-icon 前景消费 var(--text-on-accent)(判据:换成 --text-primary → 必须报红)
  → .k-extgroup-icon 的 color 不是 var(--text-on-accent) —— 见附录 B §B.3.1
    : expected '  .k-extgroup-icon {\n    width: 28px…' to contain 'color: var(--text-on-accent);'
× 附录 B §B.3-③ —— .k-ext-chip[data-on="true"] 下的 .k-ext-chip-mark 前景消费 var(--text-on-accent)
  → [data-on="true"] 下的 .k-ext-chip-mark 前景不是 var(--text-on-accent)
    : expected '      .k-ext-chip-mark {\n        bac…' to contain 'color: var(--text-on-accent);'
Tests  2 failed | 405 passed (407)
```
**还原**:`cp` 备份回写 → `md5sum` **`8b8d7fbf9a5f345154e428cbff8c2771`** 与备份逐字节相同 ✅
+ `git diff --stat -- src/ai/styles/knowledge.scss` **空**。

🔴 **对照 T2 收官态:同样这两个改动跑全量 4337 全绿、零红**(评审实证)⇒ 缺口已闭合。

---

## 4. 🟠 I-2 —— 超集自证与**现役**正则解耦

### 4.1 缺口复现(评审的实证,本刀独立复跑)

T2 版把扫描正则**内联**写在「没有搬多」那条 `it` 里,而「严格超集自证」比的是它的一份**硬编码拷贝**
(`NEW_RE`),两者**零绑定** ⇒ 把**现役**正则窄回 `k(?:2|n)?-`,`374/374` 全绿,
50 个 `kw-*` / `kr-*` 静默脱离「没有搬多」覆盖。

### 4.2 落法(🔴 R22 申报:这属于「把内联字面量提到常量」级别的整理)

```ts
const CLASS_SCAN_RE_SOURCE =
  '\\.(?:k(?:2|n|r|w)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)'
const scanClassNames = (text) => new Set((text.match(new RegExp(CLASS_SCAN_RE_SOURCE,'g'))||[]).map(s=>s.slice(1)))
```
- **「没有搬多」** 用 `scanClassNames(css)`;
- **「严格超集自证」** 的 `newHits` **直接用同一个 `scanClassNames(css)`**,
  只有 `OLD_RE`(P5e 收官时的历史原文)仍是硬编码 —— **它本来就该是历史快照**。
- 🔴 **正则源逐字未变**,纯重构 + 绑定,零匹配语义变化。

### 4.3 🔴 判据实证 —— 把**现役**正则窄回(去掉 `r|w` 分支)

注入落盘自证:
```
339:  const CLASS_SCAN_RE_SOURCE =
340-    '\\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)'
```
```
× 严格超集自证 —— 现役正则(加 kr-/kw- 分支)是 P5e 现役正则的严格超集(old ⊊ new)
  → 新正则相对旧正则的净增量应为 50(41 个 kw-* + 9 个 kr-*),实际 0:: expected +0 to be 50
Tests  1 failed | 406 passed (407)
```
🔴 **对照(这正是缺口的真实形态)**:同一次运行里
```
✓ 没有搬多 —— 全部 k-/k2-/kn-/kr-/kw-/fb/nme/ProseMirror 类都在白名单内(…)
```
**「没有搬多」仍然全绿**(`extra` 变空集恒真)—— 窄回现役正则**唯独**被超集自证抓住。
**T2 版在这个探针下是 374/374 全绿。✅ I-2 闭合。**

**还原**:`cp` 备份回写 → `md5sum` `d1395e7742b76c375d3c906b5b4f6795` 逐字节相同 ✅

### 4.4 未做的一项(显式申报)

`nonKClassNames()` 的排除前缀 `/^k(?:2|n|r|w)?-/` 是**另一份**独立正则,**本刀不动**:
窄回它只会让「未登记的非 k* 类」变多 = **报红**,不是静默失守,不属 I-2 范畴;
且改它要动 T2 已过评审的代码,风险大于收益。
🔴 **登记为债务**:两处前缀口径靠注释而非断言保持一致,建议后续刀提成共享常量。

---

## 5. 🟡 M-a —— 3 个 `--grad-ext-*` 的「自动上膛」消费绑定

### 5.1 落法

纯函数 `groupBgErrors(src)`:从 `id: '<gid>'` 起、到**下一个 `id:` 或文本末尾**为止取窗口
(**与格式无关**,单行/多行写法都吃得下),窗口内:
1. 必须出现 `var(--grad-ext-<gid>)`;
2. **不许**出现另外两个 `--grad-ext-*`(**串位就是这样被抓住的**);
3. `bg:` 值里不许有 hex / rgb / hsl / 内联 `linear-gradient(`
   —— 🔴 **`color-guard` 不扫 `.vue` 的 `<script>` 常量,这里是唯一防线**(票 B 位置④)。

条件断言:**若 `views/AllowlistView.vue` 存在则上膛;不存在则走惰性分支**,
惰性分支里**仍断言 `views` 目录真有 `.vue`**(路径基座自检 —— 否则「读不到 ⇒ 惰性通过」会退化成
「路径写错也永远通过」的空壳)。🔴 **一律 `node:fs` 读**(`?raw` 在 vitest 下恒空)。

**§9.19 跨刀冲突论证**:计划书 **T4-2 本来就明令**「`GROUPS_TEMPLATE` 的三个 `bg` 字段改
`var(--…)`(附录 B 定死)」⇒ 本条**不向 T4 索要任何它无权写的东西**,**不冲突**。

### 5.2 🔴 自带防空转断言(§9.19 明令)

「惰性通过期」唯一能证明守卫有牙的手段 = 拿**合成样本**跑同一个谓词:
正确形态 → `[]`;三种偏态各自被抓住(**串位** / **裸渐变字面量** / **整组缺失**)。
`--reporter=verbose`:
```
✓ 防空转 —— groupBgErrors 谓词在合成样本上有判别力(文件还不存在时就先证明它不是空壳) 0ms
```

### 5.3 两条判据实证

**惰性证明**(`AllowlistView.vue` 不存在时):
```
✓ M-a 自动上膛 —— 若 views/AllowlistView.vue 存在,则 GROUPS_TEMPLATE 三个 bg 各消费对应 --grad-ext-*(T4 建文件时上膛) 0ms
```
🔴 **出现在 passed 列表,不是 skip / todo**(`✓` 前缀 + 计时;vitest 对 skip 用 `↓`、todo 用 `-`)。

**上膛证明** —— 临时建 `views/AllowlistView.vue`,`docs` 消费 `--grad-ext-code`(串位)+
`code` 留裸 `linear-gradient`:
```
注入落盘自证:
  7:  { id: 'docs', …, bg: 'var(--grad-ext-code)' },
  8:  { id: 'text', …, bg: 'var(--grad-ext-text)' },
  9:  { id: 'code', …, bg: 'linear-gradient(135deg, #C18CFF, #AF52DE)' },

× M-a 自动上膛 —— 若 views/AllowlistView.vue 存在,则 GROUPS_TEMPLATE 三个 bg 各消费对应 --grad-ext-*(T4 建文件时上膛)
  → 三个 --grad-ext-* 的消费绑定不成立(附录 B §B.6 / 计划书 T4-2):…
Tests  2 failed | 406 passed (408)     ← 另一红是既有「文件清单集合相等」(T4 该做的登记)
```
**转绿证明**(把三个 `bg` 改成正确 token,**证明不会对 T4 误报**):
```
✓ M-a 自动上膛 —— 若 views/AllowlistView.vue 存在,则 GROUPS_TEMPLATE 三个 bg 各消费对应 --grad-ext-*(T4 建文件时上膛) 0ms
Tests  1 failed | 407 passed (408)     ← 只剩既有的「文件清单集合相等」
```
**还原**:`rm views/AllowlistView.vue` → `ls` 确认不存在 → 全量复跑 `407 passed (407)` ✅

⚠️ **顺带实证**:上膛期间 K44 参数化断言**自动多出一条** `K44 —— views/AllowlistView.vue 零 <style> 块` 并通过
—— **C-1 的「一次上膛」在 T4/T5/T7 三条路径上都验过了**。

---

## 6. 🟡 M-b —— `p5f-task-2-report.md` 的错事实订正(守「反转不删」)

🔴 **原文一字未删**,在两处加了 `> 🔴🔴 【P5f-T2b 订正块 …】` 引用块:
- **§4.7**(「实测订正(承 R18)」那段之后)—— 完整订正 + 三条独立口径的数字;
- **§8-1**(申报纪律清单第 1 条之后)—— 一句话驳回 + 指向 §4.7;
- 另在 **§1.1 归因表 K53 行**补了一句「已按裁定 R19 重写」的指路。

🔴 **引的是条目编号 `R19`(以及 R21 的教训),没有引任何 `file:line`。**

⚠️ **偏离申报(brief vs 实测)**:brief 说错事实在 **§6**,实读该报告 **§6 是「RED 探针」小节,不含那条错事实**;
错事实实际在 **§4.7** 与 **§8-1**(与评审 M-2 的定位一致)。**按实测落订正,已显式申报。**

---

## 7. §9.10「只许加固、不许放宽」—— 被改的 3 条既有断言逐条程序化证明

| # | 断言 | 改了什么 | 加固证明(程序化) |
|---|---|---|---|
| a | `没有搬多` | 内联正则 → `scanClassNames()`(**正则源逐字不变**) | 改前/改后对同一 `css` 的扫出集合**逐字相同**(`没有搬多` 与 `严格超集自证` 在 §4.3 探针下同源同解);净效果只是多了一条**绑定**,匹配面零变化 |
| b | `K53 防空转②` | 谓词 `includes('<style')` → `hasStyleBlock()`;断言从「两种结果都出现过」→「本目录一致判无」+ 正例移到全仓真样本 | **旧版正例是假的**(4 个「含」全是注释,`</style>` 计数 0)⇒ 旧版证明的是「注释里有那个词」;新版在**全仓 115 个真样本**上双向比对(漏检 / 恒真两侧都断)。**判别力从 0 → 真**,且偏态②实证报红(§2.4) |
| c | `K53 自动上膛` | 谓词 `includes('<style')` → `hasStyleBlock()` | 知识库区同一批 16 个文件:**旧谓词命中 10 / 新谓词命中 0**,而 `</style>` 独立口径命中 **0** ⇒ 旧谓词 10 个**全是假阳性**;新谓词与独立口径**逐文件同解**。**假阳性 10 → 0,真阳性检出力不变**(偏态②报红实证) |

🔴 **零删除、零放宽**;`b` 是唯一「断言语义变了」的一条,已按上表给出「加固前 X 命中 N 个 / 加固后 0 个」的程序化对照。

---

## 8. 🔴 `knowledge.scss` 零改动自证

```
$ git diff --stat -- src/ai/styles/knowledge.scss
(空)
$ md5sum src/ai/styles/knowledge.scss
8b8d7fbf9a5f345154e428cbff8c2771     ← 与 T2 收官态、与两次探针前后备份逐字节相同
$ git status --short
 M src/ai/styles/knowledgeStyles.test.ts
```
**任何 `.vue` 零改动**(两次临时探针文件均已 `rm`,`views/` 目录 8 个 `.vue` 的 `md5sum` 与探针前一致)。
**全程禁 `git checkout` / `git restore` / `amend` / `stash` / `reset` / `rebase`;未部署、未 push、未合 master、未装依赖。**

---

## 9. 顾虑 / 交给下游

1. 🟡 **`collectSelectorSources()`(K53 判据④)仍用 `/<style[^>]*>[\s\S]*?<\/style>/g` 抽 `.vue` 的 style 块内容。**
   它是**内容抽取**不是**存在判定**,且失效方向是**多抽**(把注释文本一起扫进来 = 更严),
   不构成 C-1 同族缺陷,**本刀未动**(§9.10:不碰无须碰的既评审代码)。**登记为观察项。**
2. 🟡 **`nonKClassNames()` 的前缀口径与 `CLASS_SCAN_RE_SOURCE` 靠注释保持一致**,无断言绑定(§4.4)。**债务。**
3. 🟢 **T5/T6/T7 的「文件清单集合相等」(守卫缺口③′)仍是每刀记账项** —— 建新 `.vue` 时必须把它加进
   `KNOWLEDGE_VUE_FILES` 清单,否则报红。**这是既有设计,不是本刀引入**(两次探针都稳定复现了这一条红)。
4. 🟢 **C-1 的参数化断言对 T5/T6/T7 是「零记账」的**:建文件即自动多一条用例,无需改测试。
5. 🟡 **I-1 覆盖的是 `knowledge.scss` 侧的 10 个属性级落点**;
   附录 B **§B.3-①(`AllowlistView.vue:30` 模板的 `color="white"`)属 T4**,
   计划书 T4-3 已明令「一条用例钉住它不是具名色」—— **请协调者确认 T4 brief 里这条没有丢**。
