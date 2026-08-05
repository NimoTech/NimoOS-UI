# SP8-P5f Task 3 独立评审(外加 T2b 抽验)

| | |
|---|---|
| 被评审 | **T3 = `6cc1c22`**;抽验 **T2b = `03a7fe4`** |
| 仓 / 分支 | `.sp8/NimoOS-New-UI` @ `sp8-ai`(评审时 HEAD = `6cc1c22`) |
| 蓝本锁 | `NimoOS-UI` @ `7a6ee6b7`(**全程只 `git show`,零 checkout/stash/commit**) |
| 结论 | **Critical 0 · Important 1 · Minor 2** ⇒ 🟢 **可以进 T4** |

> 🔴 **本评审不采信 T3/T2b 报告的任何结论** —— 下列每一条都是评审自己动手跑出来的,
> 探针一律 `cp` 备份 → 注入 → 先证注入落盘 → `--reporter=verbose` 核到**具名 failed 用例** →
> `cp`/脚本还原 → **`md5sum` 对 `git show HEAD:<path>` 逐字节比对**。**零 `git checkout/restore` 用于还原。**

---

## 0. 三门(评审自跑,全量落盘,未用 `| tail`)

| 门 | 命令 | 终值 | exit |
|---|---|---|---|
| 1 | `pnpm exec vitest run --reporter=verbose` | **`Test Files 336 passed (336)` / `Tests 4419 passed (4419)`** | **0** |
| 2 | `pnpm exec vue-tsc --noEmit` | **0 行输出** | **0** |
| 3 | `pnpm build` | `✓ built in 13.64s` | **0** |

- `grep -c "^ *×" gate1.log` → **0**(零红项)。
- brief 点名的两条已知噪声(`persist.test.ts > dropPersisted…` · `AgentComposer.test.ts`)**本次未出现** ⇒ 与 T3 报告 §8 的陈述一致。

### 0.1 🔴 +49 归因表与总数自洽(裁定 **R24**)—— **成立**

```
$ grep -c "wikiViewHelpers.test.ts >" gate1.log            → 49
$ grep "wikiViewHelpers.test.ts >" gate1.log | grep -cE "↓|- "  → 0   (零 skipped / 零 todo)
$ git show --stat --oneline 6cc1c22
  .superpowers/sdd/p5f-task-3-report.md         | 371 +
  src/ai/knowledge/util/wikiViewHelpers.test.ts | 653 +
  src/ai/knowledge/util/wikiViewHelpers.ts      | 167 +
  3 files changed, 1191 insertions(+)      ← 零删除行、零修改行
```
起点 `335 / 4370` + **1 文件 / 49 例** = **336 / 4419** ✅ 逐位吻合。
**49 的内部归因**(评审按 describe 实算,非采信报告):

| describe | 例 |
|---|---|
| `baseName` | 6 |
| `buildWikiTree —— Vue2 spec 承接` | 5 |
| `buildWikiTree —— §9.16 四种拓扑` | 7 |
| `trailFor` | 7 |
| `opToType` | 3 |
| `parseTs` | 5 |
| `rootForPath` | 8 |
| `renderWikiMarkdown` | 2 |
| 上膛守卫 | 6 |
| **合计** | **49** ✅ |

与 T3 报告 §8.1 的分解**逐项相同**。

### 0.2 §9.14-4 空转自检 —— **无空转**

49 条在 verbose 日志里**逐条以 `✓` 出现**,零 `↓ skipped` / 零 `- todo`。
上膛守卫的本体条件断言在惰性态下也是 **`✓ passed`**(不是 skip),满足 §9.19 判据①。

---

## 1. 🔴 代码膨胀逐行判定(评审第一必查项)—— **零未申报膨胀**

**评审没有复用 T3 的 `scratchpad/norm.mjs`,自己写了一份归一器**(剥注释 → 剥空行 → 括号配平合并折行签名 → 保留 `interface`),
对 `git show 7a6ee6b7:…/wikiViewHelpers.js` 与本仓 `.ts` 跑 `difflib.unified_diff`:

```
bp lines 72   new lines 80        （差 8 = 两个 interface 各 4 行；本评审归一器保留 interface，故与 T3 的 72→72 口径不同但同解）
```

差异**全集**(逐条判定):

| # | 差异 | 判定 |
|---|---|---|
| 1 | `import … from '@/views/AI/Agent/markdown/renderMarkdown.js'` → `'../../markdown/renderMarkdown'` | 🟢 **必须改**(路径基座不同)。层数正确:`vue-tsc` + `vite build` 双双 exit 0 |
| 2 | `import type { WikiRoot, WikiTreeNode }` 新增 1 行 | 🟢 **TS 类型**,已申报(§3.3-1) |
| 3 | `export interface WikiViewTreeNode`(4 行)· `export interface WikiTreeIndex`(4 行) | 🟢 **纯类型表达**蓝本 `:28`/`:37` 的隐式形状,已申报 |
| 4 | 四处签名折行(`buildWikiTree` +2 · `findParent` +3 · `trailFor` +3 · `rootForPath` +3 = **+11**) | 🟢 **纯排版**,零语义 |
| 5 | `.filter(n => n && …)` → `.filter((n): n is WikiTreeNode => !!n && … && !!n.path)` | 🟢 **语义等价**(`filter` 本就按 truthy 判定;`!!` 是类型谓词的语法要求)。已申报(§3.3-2) |
| 6 | 局部变量与返回值类型标注(`byPath` / `roots` / `trail` / `best` / `opToType` 返回联合 / `parseTs` 入参 / `baseName`·`trailFor` 的 `unknown`) | 🟢 **纯类型**,逐条已申报(§3.3-3~5) |

🔴 **零新逻辑 · 零被「修正」的行为 · 零顺手抽的抽象 · 零未申报常量提取**(R22 口径)。
**逐函数核对**:`baseName` / `buildWikiTree` / `findParent` / `trailFor` / `opToType` / `parseTs` / `rootForPath` / `renderWikiMarkdown`
八个函数的**语句序列与蓝本逐字相同**,含 `// modify + anything unknown reads as an update` 行尾注释(N58)、
`(list || [])`、`roots || []`(N49)、`.slice()`、`if (byPath[n.path]) continue`。

**§3.2 归因表自洽复核**:`72(蓝本) + 11(折行) + 8(interface) + 1(import type) = 92` = 报告自报的可执行 92 ✅。

---

## 2. 🔴 三组指定探针(评审亲手跑)—— **三条全部成立**

基线 `md5sum src/ai/knowledge/util/wikiViewHelpers.ts` = **`99ad3de4670fd9827eebf9eff505dbff`**(与 T3 报告一致)。

### 探针① `findParent` 换成「只切一级」→ crossLevel 必须红 ✅
```
注入落盘:98:  // PROBE1 only-one-level      md5(注入后)=227293a6cf111483d18aa31e7ea0e297
 × … > 🔴 ② crossLevel:/a 与 /a/b/c 在、/a/b 不在 ⇒ 父是 /a(判据:findParent 换成「只切一级」→ 本条必须报红) 6ms
⎯ Failed Tests 1 ⎯      Tests  1 failed | 48 passed (49)
还原 md5 = 99ad3de4670fd9827eebf9eff505dbff · diff -q 无输出
```
**精确 1 条具名 failed + 48 passed 同时在场** ⇒ 不是 Startup Error(**R13** 同族)。

### 探针② 删掉 `sort` → 必须红 ✅
```
注入落盘:70:  .slice() // PROBE2 sort-removed   ·  grep -c '\.sort((a, b)' → 0
 × … Vue2 spec 承接 > assembles a forest from the unsorted flat list(Vue2 spec :16-22)
 × … Vue2 spec 承接 > 顶层根用全路径当 name,子节点用 basename(Vue2 spec :24-28)
 × … > 🔴 ④ unsorted:/u/b 排在 /u 前面 ⇒ 仍只有一个根(判据:删掉 sort → 本条必须报红)
 × … > 🔴 sort 是按 path 字典序,不是「按输入顺序」—— 子节点顺序恒定与输入无关
⎯ Failed Tests 4 ⎯      Tests  4 failed | 45 passed (49)
还原 diff -q 无输出
```
**4 条同响**,含 Vue2 承接来的两条 ⇒ 承接样本本身有判别力。

### 探针③ `rootForPath` 去掉 `.replace(/\/+$/,'') + '/'` → 同名开头必须红 ✅
```
注入落盘:155:  // PROBE3 no-normalize
 × … rootForPath > 🔴 非前缀但同名开头 —— /DATA2 不该匹配 /DATA(判据:去掉 `.replace(/\/+$/,"") + "/"` → 本条必须报红)
⎯ Failed Tests 1 ⎯      Tests  1 failed | 48 passed (49)
```
🔴 **这条不是零判别力。**

---

## 3. 🔴 上膛守卫 —— **不是空壳,谓词不是裸子串,自带防空转,用 `node:fs`**(全部成立)

### 3.1 两种偏态(评审自建临时 `views/WikiView.vue`)

**偏态 A —— 只在注释里写 import ⇒ 必须红** ✅
```
注入前:ls src/ai/knowledge/views/WikiView.vue → No such file(views 目录 15 项)
文件内容含 3 种注释形态(// · /* */ · <!-- -->)各一条 wikiViewHelpers import
 × … 上膛守卫 > 🔴 本体条件断言:WikiView.vue 不存在 ⇒ 惰性通过(非 skip/todo);一旦存在则必须真 import 4ms
⎯ Failed Tests 1 ⎯      Tests  1 failed | 48 passed (49)
```

**偏态 B —— 改成真的多行 import ⇒ 必须绿** ✅
```
5:} from '../util/wikiViewHelpers'
 ✓ … > 🔴 本体条件断言:… 一旦存在则必须真 import 0ms
      Tests  49 passed (49)
```

**删除还原** ✅:`rm -f` → views 目录回到 **15 项** → `git status --short` **零输出**。

### 3.2 🔴 防空转不是摆设(评审自己把谓词改成常量,`cp` 还原)

| 注入 | 结果 |
|---|---|
| `importsModule` → `return true` | **3 条具名 failed**(防空转② · 偏态 A · 偏态 B) |
| `importsModule` → `return false` | **3 条具名 failed**(防空转② · 防空转③ · 偏态 B) |

⇒ 谓词**双向都被钉死**,恒 true / 恒 false 都逃不掉。**不是空壳。**

### 3.3 读法与 R19 口径

- `grep -nE "vi\.mock|vi\.doMock|\?raw|readFileSync\(.*superpowers|import .*superpowers"` → **零真命中**
  (`?raw` / `superpowers` 两串只出现在**注释**里的口径说明中)。
- 读文件一律 `node:fs`(`readFileSync` / `readdirSync` / `statSync`)⇒ 满足铁律。
- 谓词 = **先 `blankComments()` 剥注释 + 行首锚定**到 `^[ \t]*(?:import\b.*|\}[ \t]*)from[ \t]*['"]<spec>(?:\.ts)?['"]`
  ⇒ **不是裸子串**,承 **R19** 落地正确;偏态 A 用例里还**自带对照组**(`commentOnly.includes(HELPERS_SPEC) === true`)坐实旧谓词会误判。

---

## 4. 🔴 缺口猎(评审自写 5 个 T3 没用过的错实现)—— **猎中 1 个**

| # | 错实现 | 现有 49 例能不能抓住 |
|---|---|---|
| **A** | `findParent` = 遍历 `byPath` 取**最长字符串前缀**,**不做 `'/'` 边界判断** | 🔴 **抓不住 —— 49/49 全绿** |
| B | `findParent` = 取**最短**前缀(而非最长) | ✅ 抓住(2 红:Vue2 承接第 1 条 + `normal` 三级链路) |
| C | 删掉 `if (byPath[n.path]) continue`(**`byPath` 不去重**) | ✅ 抓住(2 红:Vue2 承接「忽略重复」+ §9.16 ③ duplicate) |
| D | `parseTs` 返回**秒**(`ms / 1000`) | ✅ 抓住(1 红:`🔴 单位是毫秒,不是秒 —— 逐位钉死取值`) |
| E | `trailFor` 改成基于 `startsWith` 的实现 | ✅ 抓住(1 红:「多余斜杠被 `filter(Boolean)` 吃掉」) |

**D 即 brief 点名的「喂秒 → 1970」那一侧:实测真能报红** ⇒ 承 P5e §9.13 落地成立。

**A 的原始输出**(唯一漏网):
```
注入 GAP-A(98: // GAP-A: longest string prefix, NO '/' boundary check)
      Tests  49 passed (49)        ← 全绿
还原 diff -q 无输出
```
⇒ 见 **Important I-1**。

---

## 5. 🔴 fixture 用法(§4 / 裁定 R14 / R3)—— **全部合规**

评审**没有跑 T3 的 `verify-fixture-copy.mjs`**,自己写 Python 从测试文件正则切出抄本 → 转 JSON → 与 fixture 去 `__meta` 后做规范化 sha256 比对:

```
wiki-tree.CONSTRUCTED.json (去 __meta)  vs  测试文件 WIKI_TREE_RAW
  fixture sha256 = ee27ca7ef115167e7192a8c8f6665fbc2e5ca13cf6bb1986069c8f9a64aa9cb2
  copy    sha256 = ee27ca7ef115167e7192a8c8f6665fbc2e5ca13cf6bb1986069c8f9a64aa9cb2   → MATCH
  拓扑键 = normal / crossLevel / missingParent / duplicate / unsorted        __meta 出现在抄本里 = False

wiki-roots.normalized.CONSTRUCTED.json .wikiRoots  vs  测试文件 WIKI_ROOTS_NORMALIZED
  fixture sha256 = fbe4504ed6f9a1ba28d2fd4656fc6a05364235a5fdea78d9c8f7fb91180e7978
  copy    sha256 = fbe4504ed6f9a1ba28d2fd4656fc6a05364235a5fdea78d9c8f7fb91180e7978   → MATCH
```

- 🔴 **`.CONSTRUCTED` 三级出处标签**:两份抄本各自在注释里**显式写明**「三级出处标签(`__meta.label`)= **`.CONSTRUCTED`** —— **不是真机数据**」(测试文件 `:53` / `:99`),并逐字保留 `why` / `built_from` / `value_units` / `normalized_shape` / `topologies` / `shape` / `note`。✅ 满足 §9.18-1。
- 🔴 **`__meta` 未被整份抄进 mock**(R14)✅ —— 程序化证明 `'__meta' in 抄本文本 == False`。
- 🔴 **零运行时读 `.superpowers/`** ✅。

### 5.1 🔴 §11-3 mock 形状层次(N46)—— **方向正确,非 Critical**

评审直接读**共享包产物**(`node_modules/@nimotech/nimoos-service/dist/wiki.d.ts`),不采信报告:

```
interface WikiTreeNode { path; level; aiLabel; userNotesUpdatedAt; lastModified }      ← camelCase
interface WikiRoot     { id; path; level; watchMode; storageMode; enabled;
                         scanIntervalS; createdAt; lastScanAt; needsReconcile }        ← camelCase
dist/wiki.js:23  export function normalizeTreeNode(n)     dist/wiki.js:7 export function normalizeRoot(r)
dist/wiki.js:78  (res.data || []).map(normalizeTreeNode)  dist/wiki.js:69 (res.data||[]).map(normalizeRoot)
```
测试里 `toStoreShape()` 产出 **camelCase 五字段**、`WIKI_ROOTS_NORMALIZED` 是 **camelCase 十字段**
⇒ 与 store 出口**逐字段吻合**,**没有搞反** PascalCase / snake_case / camelCase 三种风格。✅

---

## 6. 🔴 §9.15 —— `renderWikiMarkdown` **没有被 mock,也没有越权声称验过 XSS**(成立)

- 全文件 **零 `vi.mock` / 零 `vi.doMock`**(自 grep)。
- `describe('renderWikiMarkdown')` 只有 **2 条**:①「就是转发」(6 组输入逐个断 `renderWikiMarkdown(src) === renderMarkdown(src)`,真实 import 未打桩);②「渲染出的确实是 markdown 结构,空串仍是空串」。
- **零注入用例、零「已验 XSS」措辞**;文件头 `:15-17` 与报告 §4.2 / §10-2 都明写 **XSS 归 T7**。
✅ **未越权,也未安慰剂化。**

---

## 7. 🔴 §3 裁断 —— T3 自报的「照抄未改的蓝本不对称」

**申报内容**:`rootForPath` 的**精确相等**那一支比的是**原始** `r.path`,只有 `startsWith` 那一支做尾斜杠归一
⇒ root 配成 `/Backup/` 时 `rootForPath(roots,'/Backup')` 回 `null`。

### 7.1 是不是蓝本原样?—— ✅ **是**,T3 没有引入

```
$ git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/wikiViewHelpers.js   (:84)
    if (path === r.path || (path && path.startsWith(r.path.replace(/\/+$/, '') + '/'))) {
```
本仓 `:155` 与之**逐字符相同**。⇒ 属 N 系列「照抄不改」,**T3 处理正确**。

### 7.2 ① 该不该照抄?—— 🟢 **该**

它是蓝本原文,且改它就是改行为(违「界面严格 1:1」);无 K 系列授权 ⇒ 照抄是唯一正解。

### 7.3 ② 真机 Wiki 修好后会不会变成可见 bug?—— 🔴 **不会,结构性不可达 ⇒ 不需要记账**

🔴 **承 R21,用两条独立口径复证,两条原始输出都贴出:**

**口径一(读后端源码)** —— `NimoOS-Wiki/service/roots/manager.go`:
```
195: func (m *Manager) Create(args CreateArgs) (string, string, error) {
196:   if !filepath.IsAbs(args.Path) { … }
199:   args.Path = filepath.Clean(args.Path)          ← 落库前先 Clean
```

**口径二(实跑 Go,验 `Clean` 的尾斜杠语义)**:
```
"/Backup/"          -> "/Backup"
"/Backup//"         -> "/Backup"
"/"                 -> "/"
"/DATA/Documents/"  -> "/DATA/Documents"
```

⇒ **后端根本存不下带尾斜杠的 root path**(`/` 除外,而 `/` 两支都能命中:精确相等成立,`''+'/'` 前缀亦成立)。
**结论:该不对称在生产路径上不可达,Wiki 数据库运维票(D1)修好后也不会浮现 ⇒ 不开债务票。**

⚠️ 但 T3 报告 §10-3 给的理由是「**本机 fixture 的两个 root 都不带尾斜杠 ⇒ 不影响实际**」——
这是**数据层面**的理由(有保质期,换台设备就失效),而真正的理由是**后端 `filepath.Clean` 的结构性保证**。见 **Minor M-1**。

---

## 8. 🔴 T2b 抽验三条(前置于 T5)—— **三条全部成立**

基线 `md5sum src/ai/styles/knowledge.scss` = `8b8d7fbf9a5f345154e428cbff8c2771`。

### a) C-1 两种偏态 —— ✅ **成立**

**偏态 i(零 style 块 + 注释含「零 style 块」字面量)⇒ 具名 C-1 用例必须绿:**
```
 ✓ … K44(裁定 R19/R20 C-1) > K44 —— views/RootsView.vue 零 <style> 块(剥注释 + 行首锚定;注释里写「零 <style> 块」必须仍绿) 0ms
 ✓ … K44(裁定 R19/R20 C-1) > 加固自证 —— 旧裸子串谓词命中 > 0 而新谓词命中 0(证明这次是加固不是放宽) 3ms
 ✓ … K53 > K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>(T5 建文件时自动上膛) 0ms
      Tests  1 failed | 407 passed (408)
```
**偏态 ii(追加真 `<style lang="scss" scoped>` 块)⇒ 必须红:**
```
 × … K44(裁定 R19/R20 C-1) > K44 —— views/RootsView.vue 零 <style> 块(…注释里写「零 <style> 块」必须仍绿) 0ms
 × … K44 > 加固自证 —— 旧裸子串谓词命中 > 0 而新谓词命中 0
 × … K53 > K53 —— 若 views/RootsView.vue 存在,则它必须不含 <style>
 × … K53 > 防空转 —— 同目录既有视图能读到非空内容,且新谓词在本目录一致判「无 style 块」
      Tests  6 failed | 402 passed (408)
```
🔴 **C-1 谓词对「注释假阳性」免疫、对真 style 块有牙** ⇒ **R19/R20 的 C-1 已闭合。**
⚠️ 偏态 i 里那 **1 条 failed 与 C-1 无关**:是**另一条**守卫「缺口③′ > 文件清单集合相等(防漂移:新增视图必须显式进清单)」
在我新建一个**未登记**的 `.vue` 时正常报红(diff 显示 `+ "views/RootsView.vue"`)。**这是正确行为**,见 **Minor M-2**。
**临时文件已删干净**:`git status --short` 零输出。

### b) I-1 两条探针 —— ✅ **成立**

**互换 `allow` / `deny` 消费的 token:**
```
 × … I-1(裁定 R20) > 附录 B §B.4 —— .k-frow-action { 内 &[data-act="allow"] 的 background 消费 var(--success-soft)(判据:allow/deny 互换 → 必须报红)
 × … 同上 &[data-act="allow"] 的 color 消费 var(--success)
 × … 同上 &[data-act="deny"] 的 background 消费 var(--danger-soft)
 × … 同上 &[data-act="deny"] 的 color 消费 var(--danger)
      Tests  5 failed | 402 passed (407)
```
**换掉 `--text-on-accent`(19 处 → `--text-primary`):**
```
 × … I-1 > 附录 B §B.3-② —— .k-extgroup-icon 前景消费 var(--text-on-accent)(判据:换成 --text-primary → 必须报红)
 × … I-1 > 附录 B §B.3-③ —— .k-ext-chip[data-on="true"] 下的 .k-ext-chip-mark 前景消费 var(--text-on-accent)
      Tests  2 failed | 405 passed (407)
```
两次均 `cp` 还原,`md5sum` 回到 `8b8d7fbf9a5f345154e428cbff8c2771`。

### c) I-2 —— ✅ **成立**(而且是**精确**的那个形态)

把**现役** `CLASS_SCAN_RE_SOURCE` 的 `k(?:2|n|r|w)?-` 窄回 `k(?:2|n)?-`:
```
340:  '\\.(?:k(?:2|n)?-[a-zA-Z0-9-]+|fb(?:-[a-zA-Z0-9-]+)?|nme(?:-[a-zA-Z0-9-]+)?|ProseMirror)'
 ✓ … 白名单落地(425 个) > 没有搬多 —— 全部 k-/k2-/kn-/kr-/kw-/fb/nme/ProseMirror 类都在白名单内 1ms   ← 仍绿
 × … 白名单落地(425 个) > 严格超集自证 —— 现役正则(加 kr-/kw- 分支)是 P5e 现役正则的严格超集(old ⊊ new) 8ms
      Tests  1 failed | 406 passed (407)
```
🔴 **正是 R20-I-2 要求的判据**:「窄回现役正则 → 超集自证报红,而『没有搬多』**仍然全绿**」——
说明自证已真正绑到**现役正则本身**而非其硬编码拷贝。**T2b 的 I-2 整改到位。**

⇒ **三条前置全部成立,T5 无阻塞。**

---

## 9. 还原自证(硬纪律)

评审探针共触碰 4 个受版本控制的文件,**全部还原并与 HEAD 逐字节比对**:
```
$ git status --porcelain                       → (空)
OK  src/ai/knowledge/util/wikiViewHelpers.ts        (md5 == git show HEAD:…)
OK  src/ai/knowledge/util/wikiViewHelpers.test.ts   (md5 == git show HEAD:…)
OK  src/ai/styles/knowledge.scss                    (md5 == git show HEAD:…)
OK  src/ai/styles/knowledgeStyles.test.ts           (md5 == git show HEAD:…)
$ git log --oneline -1                         → 6cc1c22
```
**还原一律用 `cp` 备份回写 / Python 反向替换,零 `git checkout -- <path>` / 零 `git restore`。**
⚠️ 过程留痕:评审曾在一条复合命令里误留一个**无 pathspec 的裸 `git checkout`**,
它**只列出了修改文件名、未执行任何还原**(真实还原由紧随其后的 Python 完成),
且上表的 md5 对比是**事后独立复证**,结论不受影响 —— 如实登记。
**零 amend / 零 stash / 零 reset / 零 rebase / 零部署 / 零 push / 零合并。**
`../../NimoOS-UI` 全程**只 `git show`**。

---

## 10. findings

### 🔴 Important I-1 —— `buildWikiTree` / `findParent` 缺「非 `/` 边界前缀」的判别力(**守卫缺口,产品码是对的**)

**证据(评审自写错实现,原始输出见 §4)**:把 `findParent` 换成
「遍历 `byPath` 取**最长字符串前缀**、**不做 `'/'` 边界判断**」⇒ **49/49 全绿**。

**为什么这是真缺口**:
1. 现有 5 种拓扑(`normal` / `crossLevel` / `missingParent` / `duplicate` / `unsorted`)与 Vue2 承接样本里,
   **没有任何一对节点是「同名开头但非目录边界」的兄弟**(如 `/DATA/Media` 与 `/DATA/MediaBackup`)
   ⇒ 边界判断这一维**从未被采样**。
2. 这正是治理 **§9.16** 开宗明义要防的形态(「好几种错实现会给出相同结果」),
   而 **`rootForPath` 恰恰有一条一模一样的守卫**(`/DATA2` 不该匹配 `/DATA`,探针③实证有效)——
   **同一个陷阱,`buildWikiTree` 这一侧是空的**,属**不对称覆盖**。
3. **可落地的真实场景**(不是构造出来的极端值):用户有 `/DATA/Media` 与 `/DATA/MediaBackup` 两个目录时,
   错实现会把 `/DATA/MediaBackup` 挂到 `/DATA/Media` **底下**(正确应挂 `/DATA`)⇒ **左树嵌套层级肉眼可见地错**。

**该补什么**(建议,归 T4 之后任一刀顺手或独立小票):
在 §9.16 的拓扑集里**加第 5 种样本** —— `/DATA` + `/DATA/Media` + `/DATA/MediaBackup` 三行,断言
`byPath['/DATA/MediaBackup']` 是 **`/DATA`** 的 child(**不是** `/DATA/Media` 的 child)、且 `roots` 仍只有 `/DATA`。
🔴 **判据**:把 `findParent` 换成「无边界最长前缀」⇒ 该条必须报红(现在全绿)。

**为什么不是 Critical**:产品代码**完全正确**(蓝本 `findParent` 用 `lastIndexOf('/')` 逐级上剥,天然边界安全,评审逐字核过);
缺的只是守卫 ⇒ 与 §11-1「P5c 五次 + P5d 四次 + P5e 十一次猎中,**每一次产品代码都是对的,缺的都是守卫**」**同族第 N 次**。

---

### 🟡 Minor M-1 —— §10-3 那条不对称的**理由**站不住(结论对)

T3 报告 §10-3 的理由是「本机 fixture 的两个 root 都不带尾斜杠 ⇒ 不影响实际」——
这是**数据层面**的论证,**有保质期**(换台设备 / 换份 fixture 就失效),
而真正的理由是 **`NimoOS-Wiki/service/roots/manager.go:199` 的 `filepath.Clean(args.Path)` 在落库前就剥掉尾斜杠**
⇒ 带尾斜杠的 root path **结构性不可能存在**(§7.3 两条口径实证)。
**处置**:结论(照抄 + 不记账)**维持**;建议把理由订正成结构性那条(守「反转不删」:原文保留 + 订正块),
免得下游据数据层理由误判成「将来可能复现」。**与 M-5 / R14 同族:结论对、理由不成立也要登记。**

### 🟡 Minor M-2 —— 给 T5 的知情项:新建 `views/RootsView.vue` 会连带打红「文件清单集合相等」守卫

评审在 §8-a 偏态 i 实测到:**只要在 `src/ai/knowledge/views/` 新建一个未登记的 `.vue`**,
守卫「缺口③′ > 文件清单集合相等(防漂移:新增视图必须显式进清单,否则本条报红)」**必红**
(diff 输出 `+ "views/RootsView.vue"`)。
**这是正确行为、不是缺陷**(计划书 T4/T5 已写「`knowledgeStyles.test.ts` **+1 行**(登记新 `.vue`)」),
但它意味着 **T5 必须在同一个提交里登记该文件**,否则任务门会红在一条与自己改动无关的断言上。
**登记为知情项,不需要任何人现在动手。**

---

## 11. 给全支终审的知情项(本刀新增)

| # | 事 |
|---|---|
| 1 | **T3 产品码对蓝本零逻辑差异**(评审独立归一比对坐实),膨胀 +20 行全部是 TS 类型 / 折行 / interface,逐条已申报 ⇒ **R22 无违反** |
| 2 | **上膛守卫已就位**:T6 建 `views/WikiView.vue` 时**必须**写 `import … from '../util/wikiViewHelpers'`(单行 / 多行 / `.ts` 后缀 / 双引号 / `import type` 均认),否则直接报红 |
| 3 | 🔴 **I-1 的缺口在 `buildWikiTree` 边界维**,建议补一条「同名开头兄弟目录」拓扑;**产品码无需改动** |
| 4 | **`rootForPath` 的精确相等不归一**属蓝本原样,**后端 `filepath.Clean` 保证不可达** ⇒ 已裁定不记账(§7.3) |
| 5 | **XSS 仍欠 T7**:本刀只验「就是转发」,未 mock `renderMarkdown`,未越权声称 ⇒ T7 必须做「挂载 `WikiView` 查真实 DOM」那一半 |

---

## 12. 结论

**Critical 0 · Important 1 · Minor 2** ⇒ 🟢 **可以进 T4。**

Important I-1 是**守卫缺口**、不是产品缺陷,且不阻塞 T4(T4 是 `AllowlistView.vue`,与 `buildWikiTree` 无交集);
T2b 的三条前置(C-1 / I-1 / I-2)**评审亲手复现全部成立**,**T5 亦无阻塞**。
