# SP8-P5f Task 3 报告 —— `util/wikiViewHelpers.ts`

| | |
|---|---|
| 仓 / 分支 | `.sp8/NimoOS-New-UI` @ `sp8-ai` |
| 起点 | `03a7fe4`(现测确认,= brief 给的起点;T2b 收官提交) |
| 蓝本锁 | `NimoOS-UI` @ `7a6ee6b7`(**全程只 `git show`,零 checkout/stash/commit**) |
| 范围 | **只新建 2 个文件**;`src/` 其余零改动(`git status --short src/` 逐行自证,见 §8) |

---

## 1. 逐文件改了什么

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/ai/knowledge/util/wikiViewHelpers.ts`(新建) | 167(其中可执行 92) | 蓝本 `src/views/AI/Knowledge/wikiViewHelpers.js`(95 行 / 可执行 72)的逐字移植 + TS 类型 |
| `src/ai/knowledge/util/wikiViewHelpers.test.ts`(新建) | 653 / **49 例** | 承接 Vue2 `__tests__/wikiViewHelpers.spec.js`(119 行 / 9 例)全部行为 + §9.16 判别力样本 + 自动上膛守卫 |

### 1.1 `renderMarkdown` 的 import 层数(🔴 现测,不照抄 brief)

```
$ ls src/ai/markdown/
renderMarkdown.test.ts  renderMarkdown.ts
```
`src/ai/knowledge/util/` → `src/ai/markdown/` = **`../../markdown/renderMarkdown`**(与治理 §5.1 的相对路径表一致)。
**独立复证(R21 第二口径)**:`vue-tsc --noEmit` exit=0(层数写错会报 TS2307)+ `vite build` exit=0(解析不到会 build 失败)。

---

## 2. 蓝本 `file:line` → New-UI 对照

| 蓝本 | New-UI | 备注 |
|---|---|---|
| `:4` `import { renderMarkdown }` | `:33` | 路径改相对(见 §1.1) |
| `:6-11` `baseName` | `:53-58` | 逐字 |
| `:18-37` `buildWikiTree` | `:65-87` | 逐字(签名折行 + 类型标注) |
| `:39-47` `findParent` | `:94-102` | **模块私有,不导出**(蓝本也没 `export`) |
| `:52-62` `trailFor` | `:108-121` | 逐字 |
| `:65-70` `opToType` | `:124-129` | 逐字,含 `mod` 兜底(N58) |
| `:73-77` `parseTs` | `:136-140` | 逐字 |
| `:82-90` `rootForPath` | `:145-157` | 逐字 |
| `:94-96` `renderWikiMarkdown` | `:162-164` | 逐字 |
| 蓝本 `:13-16` / `:22-24` / `:49-51` / `:64` / `:72` / `:79-81` / `:92-93` 的英文原注释 | 一律**原文保留**在对应函数上方 | 未翻译、未改写 |

---

## 3. 🔴 代码膨胀逐行判定(评审第一必查项)

**总量**:蓝本可执行 **72** 行 → 本仓可执行 **92** 行,**+20**。

### 3.1 程序化判定(不是肉眼比)

把两边都归一到「可执行语句序列」(剥注释 → 剥空行 → 把被折行的函数签名合回一行 → 去掉 TS 类型标注 / `interface` 块 / `import type`),
脚本 `scratchpad/norm.mjs`,`difflib.unified_diff` 输出:

```
--- blueprint            +++ new-ui                ---- 行数: 72 -> 72
@@ -1,2 +1,2 @@
-import { renderMarkdown } from '@/views/AI/Agent/markdown/renderMarkdown.js'
+import { renderMarkdown } from '../../markdown/renderMarkdown'
@@ -7,3 +7,3 @@   -export function buildWikiTree(list) {   +export function buildWikiTree(list,) {
@@ -28,3 +28,3 @@  -function findParent(byPath, path) {     +function findParent(byPath, path,) {
@@ -37,3 +37,3 @@  -export function trailFor(byPath, path) { +export function trailFor(byPath, path,) {
@@ -59,3 +59,3 @@  -export function rootForPath(roots, path){+export function rootForPath(roots, path,) {
```

**归一后两边都是 72 行**;差异只有 ① import 说明符(必须改)② 四处**归一器自己留下的尾逗号**(折行签名合并的产物,不是真差异)。
⇒ 🔴 **零新逻辑 · 零被「修正」的行为 · 零顺手抽的抽象。**

### 3.2 +20 行的逐条归因(必须与 §3.1 自洽:1+4+4+11 = 20)

| 类别 | 行 | 内容 | 正当性 |
|---|---|---|---|
| TS 类型 import | **1** | `import type { WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'` | 零 `any` 的前提;**不是新依赖**(`knowledgeStore.ts:56` 已在用同一个包的同一组类型) |
| TS 接口 | **4** | `export interface WikiViewTreeNode extends WikiTreeNode { name; children }` | 蓝本 `:28` 的 `{ ...n, name, children }` 的类型表达 |
| TS 接口 | **4** | `export interface WikiTreeIndex { roots; byPath }` | 蓝本 `:37` `return { roots, byPath }` 的类型表达 |
| 签名折行 | **11** | `buildWikiTree` 1→3 · `findParent` 1→4 · `trailFor` 1→4 · `rootForPath` 1→4 | 带类型标注后超行宽,纯排版 |

**注释行**(167 − 92 = 75 行)全部是:蓝本原注释的原文保留 + 字段依据登记(K41 要求)+ 偏离/照抄申报。

### 3.3 🔴 申报清单(裁定 R22:连「把内联字面量提到模块常量」这种级别也要申报)

**产品码侧 5 条,全部是类型层,零运行时行为变化:**

1. `import type { WikiRoot, WikiTreeNode }` —— 见上表。
2. `.filter((n): n is WikiTreeNode => !!n && typeof n.path === 'string' && !!n.path)` ——
   蓝本是 `.filter(n => n && typeof n.path === 'string' && n.path)`。加了**类型谓词**与两处 `!!`。
   🔴 `Array.prototype.filter` 本来就把返回值当 truthy 判定 ⇒ **语义完全相同**;`!!` 只是让返回类型是 `boolean`(类型谓词的语法要求)。
3. `opToType(op: string): 'add' | 'del' | 'ren' | 'mod'` —— 返回类型收窄成字面量联合(蓝本是隐式 `string`)。
   **只是类型**;T6 的 `:data-type="c.type"` 会因此得到更准的类型。
4. `parseTs(s: string | null | undefined)` —— 蓝本入参无类型。`!s` 那一支对 `''`/`null`/`undefined` 全覆盖(三条用例都在)。
5. `rootForPath(roots: ReadonlyArray<WikiRoot | null | undefined> | null | undefined, path: string)` ——
   数组元素允许 `null`,因为蓝本 `:84` 有 `if (!r || !r.path) continue` 的运行时防御,收窄成 `WikiRoot[]` 会让那一支永远测不到。
   🔴 **返回 `WikiRoot | null` 而不是窄成 `{ path }`** —— 蓝本 `WikiView.vue:300` 读 `root.id`,窄了 T6 就拿不到。

**`baseName(p: unknown)` / `trailFor(byPath, path: unknown)` 同理**(蓝本 `:7` / `:53` 的 `typeof !== 'string'` 是运行时防御)。

**测试码侧 4 条(全部 test-only,不进产物):**

| 名 | 干什么 | 为什么不是「顺手抽的抽象」 |
|---|---|---|
| `flatNode(path, over?)` | 把 Vue2 spec 的 `{path, level}` 补齐成共享包 `WikiTreeNode` 五字段 | 类型要求;不补就编译不过 |
| `toStoreShape(raw)` | fixture 的 **snake_case** → store 出口 **camelCase** 的**键名对应** | 🔴 **不重新实现归一化逻辑**,只对键名;依据 `NimoOS-Service/src/wiki.ts:102 normalizeTreeNode`(N46) |
| `blankComments(src)` | 保行版剥注释(`<!---->` / `/* */` / 整行 `//`) | 承 `ParserTest.test.ts:159` + `knowledgeStyles.test.ts:2047` 的**既定口径**,不是新造 |
| `importsModule(src, spec)` | 上膛守卫的谓词(先剥注释 + 行首锚定) | 裁定 **R19** 明令不许用裸子串 |

---

## 4. 承接了 Vue2 哪些行为(`__tests__/wikiViewHelpers.spec.js`,9 例 → 本仓 49 例)

| Vue2 spec | 本仓对应 | 加细 |
|---|---|---|
| `:16-22` 乱序扁平表拼森林 | `buildWikiTree —— Vue2 spec 承接 > assembles a forest…` | 逐字保留原样本与原断言 |
| `:24-28` 根用全路径 / 子用 basename | 同 describe 第 2 条 | — |
| `:30-36` 跨级(`/a` + `/a/b/c`) | **升级**到 §9.16-② 那条(取 `.CONSTRUCTED` 的 `crossLevel`),多断 `byPath['/a/b']` 缺席 + `name === 'c'` | 判据见 §5 探针① |
| `:38-44` 重复 / 空路径 / null | `忽略重复与空路径` | **另加**「先到的那行胜出」(`aiLabel === 'first'`)—— 蓝本 spec 没测,`byPath` 去重的方向是有判别力的 |
| `:47-57` `trailFor` 三条 | `trailFor` 前三条逐字承接 | 另加非字符串 / 整链缺席 / 多余斜杠 / 引用同一性 |
| `:60-67` `opToType` 五条 | `opToType > Vue2 spec 承接` | 另加 N58 的 6 值参数化 + 大小写敏感 |
| `:69-74` `parseTs` 四条 | `parseTs > Vue2 spec 承接` | **另加毫秒/秒两侧**(见 §4.1) |
| `:76-81` `baseName` 四条 | `baseName > Vue2 spec 承接` | 另加非字符串 6 值 / 多重尾斜杠 / 无斜杠 / `slice(i+1) \|\| s` 兜底 |
| `:84-101` `rootForPath` 两条 | `rootForPath` 前三条 | 另加尾斜杠归一 / 数组顺序无关 / 脏数组 / 引用同一性 |
| `:104-118` `renderWikiMarkdown` 两条 | 🔴 **只承接「渲染结构」那条**;**XSS 那条按治理 §9.15 移交 T7** | 见 §4.2 |

### 4.1 🔴 `parseTs` 的毫秒 / 秒两侧(承 P5d-T3 与 P5e §9.13)

`fmtAgo(ms)`(`knowledgeStore.ts:190`)吃**毫秒**;喂秒不会报错,只会静默显示 1970 年。
用例 `🔴 单位是毫秒,不是秒 —— 逐位钉死取值`:
- 毫秒侧:`parseTs('2026-08-05T11:32:01+08:00') === Date.UTC(2026,7,5,3,32,1)`、13 位、`> 1e12`;
- 秒侧:`not.toBe(EXPECT_MS / 1000)`、`String(...)` 不是 10 位。
另加「时区偏移真的参与换算」(`+08:00` 与 `Z` 的两种写法同值 / 不同值各一条)。

### 4.2 🔴 §9.15:XSS 不在本刀

本文件只有一条「**就是转发 `renderMarkdown`**」的断言:对 6 组输入逐个断
`renderWikiMarkdown(src) === renderMarkdown(src)`,**全程不 mock `renderMarkdown`**。
🔴 **本刀不声称验过 XSS** —— 治理 §9.15 明令「禁止 mock 掉 `renderMarkdown` 之后还声称验过 XSS」,
且正确形态是「挂载 `WikiView` 后查真实 DOM」= **T7 的活**。

---

## 5. 🔴 RED 探针(四条)

**纪律**:一律 `cp` 备份 → **行首锚定注入** → **先证注入落盘(grep 出行号)** → 跑 `--reporter=verbose` **核到具名 failed 用例** →
`cp` 还原 → **`md5sum` 逐字节比对**。**全程禁 `git checkout/restore`。**

备份基线:`md5sum src/ai/knowledge/util/wikiViewHelpers.ts` = **`99ad3de4670fd9827eebf9eff505dbff`**

### 探针① `findParent` 换成「只切一级」→ crossLevel 必须报红

```
--- 注入落盘证明(行首锚定):
98:  // ⚠️ RED 探针(临时):只切一级父目录。
101:  return byPath[path.slice(0, i)] || null
md5(注入后) = 3dc60da0dfe75084f9c684495742a51d
--- vitest --reporter=verbose:
 × … > 🔴 ② crossLevel:/a 与 /a/b/c 在、/a/b 不在 ⇒ 父是 /a(判据:findParent 换成「只切一级」→ 本条必须报红) 7ms
⎯⎯⎯ Failed Tests 1 ⎯⎯⎯      Tests  1 failed | 48 passed (49)
--- 还原:md5 = 99ad3de4670fd9827eebf9eff505dbff · diff 无输出 → 逐字节相同
```
🔴 **精确报红 1 条,正是那条**(不是 Startup Error —— 具名用例 + 48 passed 同时在场,R13 同族)。

### 探针② 删掉 `sort` → unsorted 必须报红

```
--- 注入落盘证明:
71:  // ⚠️ RED 探针(临时):删掉 sort。
$ grep -c "\.sort((a, b)" …  → 0          md5(注入后) = e3461a2c1181c01b3e1029604e4f1ee6
--- vitest --reporter=verbose:
 × … Vue2 spec 承接 > assembles a forest from the unsorted flat list(Vue2 spec :16-22)
 × … Vue2 spec 承接 > 顶层根用全路径当 name,子节点用 basename(Vue2 spec :24-28)
 × … > 🔴 ④ unsorted:/u/b 排在 /u 前面 ⇒ 仍只有一个根(判据:删掉 sort → 本条必须报红)
 × … > 🔴 sort 是按 path 字典序,不是「按输入顺序」—— 子节点顺序恒定与输入无关
⎯⎯⎯ Failed Tests 4 ⎯⎯⎯      Tests  4 failed | 45 passed (49)
--- 还原:md5 = 99ad3de4670fd9827eebf9eff505dbff · diff -q 无输出
```
**4 条同响**(Vue2 spec 原样本本身就是乱序的 ⇒ 承接来的两条也有判别力,不是只有新加的两条)。

### 探针③ `rootForPath` 去掉 `.replace(/\/+$/,'') + '/'` → 同名开头那条必须报红

```
--- 注入落盘证明:
155:    // ⚠️ RED 探针(临时):去掉 `.replace(/\/+$/, '') + '/'` 归一。
156:    if (path === r.path || (path && path.startsWith(r.path))) {
md5(注入后) = 3112add55b8d98cb770beca5749880bb
--- vitest --reporter=verbose:
 × … rootForPath > 🔴 非前缀但同名开头 —— /DATA2 不该匹配 /DATA(判据:去掉 `.replace(/\/+$/,"") + "/"` → 本条必须报红)
⎯⎯⎯ Failed Tests 1 ⎯⎯⎯      Tests  1 failed | 48 passed (49)
--- 还原:md5 = 99ad3de4670fd9827eebf9eff505dbff
```
🔴 **这条不是零判别力**(brief 点名要核的正是它)。

### 探针④ 自动上膛守卫:两种偏态各一次

**偏态 A —— 临时建 `views/WikiView.vue`,注释里写了 import 语句但没真 import ⇒ 必须报红:**
```
$ ls src/ai/knowledge/views/WikiView.vue → No such file(注入前不存在)
--- 注入落盘证明(行首锚定):
3:// import { buildWikiTree } from '../util/wikiViewHelpers'
md5 = ed05b21d035237f3ebd188be14e54c4b
 × … > 🔴 本体条件断言:WikiView.vue 不存在 ⇒ 惰性通过(非 skip/todo);一旦存在则必须真 import 4ms
⎯⎯⎯ Failed Tests 1 ⎯⎯⎯      Tests  1 failed | 48 passed (49)
```
**偏态 B —— 同一个文件改成真的多行 import ⇒ 必须转绿:**
```
--- 注入落盘证明(from 子句行首锚定):
6:} from '../util/wikiViewHelpers'          md5 = 34d580d8f73c615739ae0b6a806d6349
 ✓ … > 🔴 本体条件断言:… 一旦存在则必须真 import 0ms
 Test Files  1 passed (1)      Tests  49 passed (49)
```
**还原**:`rm -f src/ai/knowledge/views/WikiView.vue` → `ls` 目录回到 15 项、`git status --short src/ai/knowledge/views/` **零输出**
⇒ 🔴 **临时文件未提交**。

**惰性证明**(§9.19 判据①):终态 `--reporter=verbose` 里该用例显示为 **`✓`(passed)**,**不是 `↓ skipped` / `- todo`** ——
见 §7 的 49/49 逐条清单。

---

## 6. 🔴 自动上膛守卫的设计(§9.19)

**钉的是**:「若 `src/ai/knowledge/views/WikiView.vue` 存在,则它必须 `import … from '../util/wikiViewHelpers'`」。

### 6.1 谓词禁用裸子串(承裁定 R19)

`importsModule(src, spec)` = **先 `blankComments()` 剥注释** → **行首锚定**到 import 语句:
```
^[ \t]*(?:import\b.*|\}[ \t]*)from[ \t]*['"]<spec>(?:\.ts)?['"]
```
两个分支分别覆盖**单行** `import { a } from '…'` 与**多行** `import {\n…\n} from '…'`(T6 很可能写多行 —— 蓝本 `:152-154` 就是多行)。

**两种偏态各一条永久用例**(不只在报告里做一次):
- `🔴 偏态 A` —— 注释里写了 import(`//` + `/* */` + `<!-- -->` 三种)⇒ 判**假**;
  同一份源码上**裸子串谓词判真**(用例里直接断 `commentOnly.includes(HELPERS_SPEC) === true`)⇒ 对照组坐实。
- `🔴 偏态 B` —— 单行 / 多行 / 带 `.ts` / 双引号 / `import type` 五种真 import ⇒ 一律判**真**;错模块名判假。

### 6.2 防空转三条(§9.19「能报红 ≠ 不是空壳」)

| # | 断的什么 | 堵住的空壳形态 |
|---|---|---|
| ① | `views/` 目录存在且含 `.vue`,且含 `SearchView.vue` | 路径基座写错(少一层 `..` / 目录改名)永远发现不了 |
| ② | 谓词在**真实文件**上双向可分辨:`SearchView.vue` **真 import** `../util/searchAggregate` ⇒ 真;**没 import** `wikiViewHelpers` ⇒ 假;且 `src.length > 0` | 恒 true / 恒 false;以及「`?raw` 恒空 ⇒ 恒判无 ⇒ 恒绿」 |
| ③ | 多行形态在真实文件上被认出(`IndexedFilesView.vue:228` 的 `} from 'reka-ui'`) | 谓词只认单行 ⇒ T6 写多行时守卫哑火 |

🔴 **正例取自本仓真文件,不是靠注释文字撑着** —— 这正是 R19 里 T2 栽的那个形态。
🔴 **测试里读文件一律 `node:fs`**(铁律:`?raw` 在 vitest 下恒空)。

### 6.3 §9.19 跨刀冲突论证:**不冲突**

治理 §5.1 的相对路径表原文就写了「`views/WikiView.vue` → helpers:`import { buildWikiTree, trailFor, opToType, parseTs, rootForPath, renderWikiMarkdown } from '../util/wikiViewHelpers'`」,
且计划书 §T6 的范围就是「逐字移植 `WikiView` 并写 script imports」
⇒ **本守卫不向 T6 索要任何它无权写的东西**(与 P5e 的 T5↔T6 冲突形成对照:那次守卫索要的是 T6 无权写的 markup,靠裁定 R25 才解开)。

---

## 7. 用了哪几个样本文件 · mock 形状取自哪一层

| 样本 | 标签 | 用在哪 | 形状层(§4.1 / fixtures README §3) |
|---|---|---|---|
| `p5f-fixtures/wiki-tree.CONSTRUCTED.json` | 🔴 **`.CONSTRUCTED`** | `buildWikiTree` / `trailFor` 的五种拓扑 | fixture 是 **HTTP 原始 snake_case**;经 `toStoreShape()` 对成 **store 出口 camelCase**(= `store.loadWikiTree()` 的扁平数组) |
| `p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json` | 🔴 **`.CONSTRUCTED`** | `rootForPath` | **store 出口 camelCase**(`store.state.wikiRoots`,N46) |

🔴 **三级出处标签已写进测试注释**,并逐字保留了 `__meta.why` / `built_from` / `value_units` /
`normalized_shape` / `topologies`(树)与 `why` / `built_from` / `shape` / `note`(根)。
🔴 **不许说成「真机数据」** —— 注释里明写「**`.CONSTRUCTED` —— 不是真机数据**」。
🔴 **裁定 R14 / README §0.2:只取数据字段,`__meta` 转成注释** —— 校验脚本程序化断言抄本里
`JSON.stringify(copy).includes('__meta') === false`。
🔴 **零运行时读 `.superpowers/`**:`grep -nE "readFileSync\(.*superpowers|import .*superpowers"` → **零命中**
(该串只出现在注释的出处标注里)。

### 7.1 程序化逐字节等价校验(治理 P5c §4.4,不许肉眼比)

脚本 `scratchpad/verify-fixture-copy.mjs`:按 `FIXTURE-COPY-BEGIN/END` 标记从**测试文件本身**切出抄本 → 求值 → 与 fixture 去 `__meta` 后的数据字段做规范化 JSON 比对 + sha256。

```
① wiki-tree.CONSTRUCTED.json (去 __meta) vs 测试文件 WIKI_TREE_RAW
   fixture sha256 = 507f6c48f31612d8ddf73dfeb980b88cf7040e44bb24d32be2c6c402d34fd44b
   copy    sha256 = 507f6c48f31612d8ddf73dfeb980b88cf7040e44bb24d32be2c6c402d34fd44b
   拓扑键: normal, crossLevel, missingParent, duplicate, unsorted     节点数: 11
   __meta 是否出现在抄本里: false            RESULT: MATCH(逐字节等价)

② wiki-roots.normalized.CONSTRUCTED.json .wikiRoots vs 测试文件 WIKI_ROOTS_NORMALIZED
   fixture sha256 = d91420ebc977396fefcc6cddf012b346e4376a2a0a124ae3b96794150feef9ac
   copy    sha256 = d91420ebc977396fefcc6cddf012b346e4376a2a0a124ae3b96794150feef9ac
   root 数: 2   __meta 是否出现在抄本里: false   RESULT: MATCH(逐字节等价)

③ 变异验证(把 unsorted[0].path 改成 /u/bb): DIFF(✅ 校验有判别力)
exit=0
```

---

## 8. 三门(全量、落盘、不许 `| tail`)

| 门 | 起点(brief) | 终值 | exit |
|---|---|---|---|
| `vitest run --reporter=verbose` | `Test Files 335` / `Tests 4370` | **`Test Files 336 passed (336)` / `Tests 4419 passed (4419)`** | **0** |
| `vue-tsc --noEmit` | 0 | **0 行输出** | **0** |
| `vite build` | 0 | `✓ built in 13.70s` | **0** |

**红项:零**(`grep -c "^ *×" gate1b.log` → **0**)。
⚠️ brief 点名的两条已知噪声(`persist.test.ts > dropPersisted…` · `AgentComposer.test.ts` teardown 竞态)**本次两跑都未出现**。

### 8.1 🔴 用例数归因表(裁定 R24:必须与总数自洽)

| 来源 | 文件 | 用例 |
|---|---|---|
| 起点 | 335 | 4370 |
| 本刀新增 `wikiViewHelpers.test.ts` | **+1** | **+49** |
| **合计** | **336** ✅ | **4419** ✅ |

**4370 + 49 = 4419**,与门口数字逐位吻合。
**49 这个数不是自报** —— `grep -c "wikiViewHelpers.test.ts >" gate1b.log` → **49**(全量 verbose 日志里逐条计数)。

**49 条的内部归因**:`baseName` 6 · `buildWikiTree`(Vue2 承接)5 · `buildWikiTree`(§9.16)7 ·
`trailFor` 7 · `opToType` 3 · `parseTs` 5 · `rootForPath` 8 · `renderWikiMarkdown` 2 · 上膛守卫 6 = **49** ✅

### 8.2 范围自证

```
$ git status --short src/
?? src/ai/knowledge/util/wikiViewHelpers.test.ts
?? src/ai/knowledge/util/wikiViewHelpers.ts
```
🔴 **`src/` 只多了这两个文件,零修改、零删除。** 探针用的临时 `views/WikiView.vue` 已删除,`git status` 零残留。

### 8.3 其它自证

| 项 | 命令 | 结果 |
|---|---|---|
| 零 `any`(K41) | `grep -nE "\bany\b" 两个文件` | 唯一命中是**注释里「零 `any`」这句话本身**,零真类型 |
| 零色字面量(§6,含注释) | `grep -nE "#[0-9a-fA-F]{3,8}\b\|rgba?\(\|hsla?\("` | **零命中** |
| 零 `<style>` 块(K44) | 本刀不产 `.vue` | 不适用 |

---

## 9. K1–K60 / N1–N58 命中申报

### 9.1 偏离(K)

| # | 命中? | 说明 |
|---|---|---|
| **K41**(零 `any`) | ✅ **命中** | 三个窄接口 + 文件头登记「字段依据 = 蓝本哪一行读了它」(`:8-31`)。自证见 §8.3 |
| **K44**(`.vue` 零 `<style>`) | — | 本刀不产 `.vue` |
| K53 / K54 / K55 / K56 / K57 / K58 / K59 / K60 | — | 全部是 `.vue` / `.scss` 侧,本刀不命中 |

**本刀无新偏离**(§3.1 已程序化证明零新逻辑)。

### 9.2 照抄不改(N)

| # | 说明 |
|---|---|
| **N58** ✅ | `opToType` 的「`modify` + 任何未知值 → `'mod'`」兜底**逐字照抄**(蓝本 `:68` 的行尾注释 `// modify + anything unknown reads as an update` 也原文保留)。**没有**拆成显式 `modify` 分支;用例 `🔴 N58:…` 用 6 个值参数化钉死 |
| **N46** ✅ | Wiki 一个域两种命名风格。本刀**只消费 store 出口 camelCase**,**不在页面/工具里再归一化一次**;fixture 的 snake_case 由测试侧 `toStoreShape()` 对键名,依据写在注释里 |
| **N49** ✅ | 蓝本 `:19` 的 `(list || [])` 与 `:83` 的 `roots || []` 是 Go nil slice → `null` 的必要防御,**照抄不删**,各配一条用例 |
| N47 / N48 / N50–N57 | — | 属 `.vue` / store 侧,本刀不命中 |

---

## 10. 顾虑 / 交给下游的事

1. 🔴 **给 T6**:`views/WikiView.vue` 一落地,本文件的上膛守卫**立刻生效** ——
   必须写 `import { … } from '../util/wikiViewHelpers'`(单行或多行都认,`.ts` 后缀也认)。
   不写 = 直接报红,错误信息里已写明原因。
2. 🔴 **给 T7**:`renderWikiMarkdown` 的 **XSS 用例是 T7 的活**(治理 §9.15)——
   本刀**只**验了「就是转发」,**没有**验注入;正确形态是挂载 `WikiView` 后查真实 DOM,且**不许 mock** `renderMarkdown`。
3. **`rootForPath` 的一处蓝本不对称**(照抄,未改):精确相等那一支比的是**原始** `r.path`,
   只有 `startsWith` 那一支做尾斜杠归一 ⇒ root 配成 `/Backup/` 时,`rootForPath(roots, '/Backup')` 回 `null`。
   已用例钉死(`root.path 带尾斜杠时归一化后仍能匹配` 的最后一条)。**本机 fixture 的两个 root 都不带尾斜杠 ⇒ 不影响实际。**
4. **`baseName` 的 `slice(i + 1) || s` 兜底**只在**单字符 `'/'`** 这一种输入下真正命中(`'//'` 会先被 `replace` 剥成 `''` 而走 `i < 0` 那支)。
   用例里两种都断了,并在注释里写明推导 —— 免得下一道评审以为漏测。
5. **`.CONSTRUCTED` 的固有局限**(fixtures README §6 / 治理 §9.18):`/tree` 与 `/roots` 本机 **90 s 超时 0 字节**(D1),
   本刀所有 Wiki 样本**都不是真机数据**。**验收清单里 Wiki 相关不列真机验收项。**
