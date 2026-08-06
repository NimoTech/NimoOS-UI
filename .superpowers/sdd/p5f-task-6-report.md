# SP8-P5f · Task 6 报告 —— `WikiView.vue` **上半** + 两个追加项(R22 / R27)

| | |
|---|---|
| 刀 | **T6** —— `WikiView.vue` 上半(左树 + 选择 + 深链 + 文章骨架)+ 裁定 **R22** / **R27** 两个追加项 |
| 工作区 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai` |
| 起点 commit | **`dbe2e17`**(`git log --oneline -1` 现测确认:`dbe2e17 docs(p5f): 裁定 R27 —— T5 关账,submitting 门零判别力派 T6`) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`** · `src/views/AI/Knowledge/WikiView.vue`(314 行) |
| 三门 | **`Test Files 339` / `Tests 4612` / `vue-tsc` exit 0 / `vite build` exit 0**,零红项 |
| 日志 | `/tmp/p5f-t6-test.log` · `/tmp/p5f-t6-tsc.log` · `/tmp/p5f-t6-build.log`(全量、未 `\| tail`) |

---

## 1. 逐文件改了什么

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/ai/knowledge/views/WikiView.vue` | **新建**(511 行) | 蓝本上半 1:1 移植;🔴 **零 `<style>` 块**(`grep -c '</style>'` = **0**)· 🔴 **零 `any`** |
| `src/ai/knowledge/views/WikiView.test.ts` | **新建**(54 例) | 组件测试;T7 会**续写本文件** |
| `src/ai/styles/knowledgeStyles.test.ts` | **+3 行** | `KNOWLEDGE_VUE_FILES` 登记 `views/WikiView.vue`(+ 2 行注释) |
| `src/ai/knowledge/util/wikiViewHelpers.test.ts` | **+120 行 / −0 行** | 裁定 **R22** 追加项(只许新增) |
| `src/ai/knowledge/views/RootsView.test.ts` | **+100 行 / −0 行** | 裁定 **R27** 追加项(只许新增) |
| `.superpowers/sdd/p5f-task-6-report.md` | 新建 | 本文件(`git add -f`) |

🔴 **产品码零改动的三个文件**:`wikiViewHelpers.ts` · `RootsView.vue` · `knowledge.scss`
(两个追加项都是**纯覆盖缺口**,评审已逐字核过产品码为正确)。

### 1.1 「只许新增」的逐行自证(裁定 R22 / R27)

```
$ git diff --stat src/ai/knowledge/util/wikiViewHelpers.test.ts
 src/ai/knowledge/util/wikiViewHelpers.test.ts | 120 ++++++++++++++++++++++++++
 1 file changed, 120 insertions(+)
$ git diff src/ai/knowledge/util/wikiViewHelpers.test.ts | grep "^-"
--- a/src/ai/knowledge/util/wikiViewHelpers.test.ts        ← 只有 diff 头,零删除行

$ git diff --stat src/ai/knowledge/views/RootsView.test.ts
 src/ai/knowledge/views/RootsView.test.ts | 100 +++++++++++++++++++++++++++
 1 file changed, 100 insertions(+)
$ git diff src/ai/knowledge/views/RootsView.test.ts | grep "^-"
--- a/src/ai/knowledge/views/RootsView.test.ts             ← 同上,零删除行
```
**两份都是 `insertions(+)` 单向、`deletions(-)` 为 0 ⇒ 既有每一行逐字未动。**

---

## 2. 蓝本 → New-UI 的对照(本刀范围)

| 蓝本 | 本文件 | 备注 |
|---|---|---|
| `:2` `.kw-split` | 同 | 两栏壳 |
| `:4-33` 左栏四态 | 同 | loading(6 `k-skel`)/ error(`kw-tree-note` + 重试)/ empty / 有树 |
| `:36-46` 右栏空树 onboarding | 同 | `$router.push` → `router.push` |
| `:48-55` 面包屑 | **K56 改写** | `:key` 挪到 `<template v-for>` 自身 |
| `:57-66` 标题行 + 打开文件夹 | 同 | `:59` 的 `--ly: var(--ly-wiki)` **照抄** |
| `:69-74` 文章骨架 | 同 | 四条 `k-skel` |
| `:76-81` `<template v-else>` + `kw-meta` | 同 | **边界申报见 §3** |
| `:161-176` `data()` | `ref()` × 10 | `rescanBusy` 归 T7 |
| `:177-196` `computed` | `computed()` × 8 | `html` / `changes` 归 T7 |
| `:210-214` `watch` | `watch(() => route.query.path, …)` | **N56** |
| `:215-218` `created()` | `onMounted()` | **DoD 9** |
| `:220-238` `loadTree` · `:239` `isOpen` · `:240-244` `toggle` · `:245-248` `nodeClick` · `:249-260` `select` · `:261-281` `fetchArticle` · `:292-294` `openFolder` | 普通函数 | 其余 methods 归 T7 |

### 承接的 Vue2 spec
`__tests__/dashboardWikiViews.spec.js` 的 wiki 相关条目按裁定 **R10** 是「2/3 条归 T6/T7」——
本刀承接的是**左树 / 选中 / 深链**这一块的行为;`wikiViewHelpers.spec.js` 已由 T3 整份承接。

---

## 3. 🔴 申报 ①:T6 / T7 的模板边界(brief 自相矛盾处,取「不写」那句)

**brief 的两句给出相反归属**:
- 「本刀写:模板 `:1-46` + **`:48-75`**」⇒ `:76-81` 归 T7;
- 「🔴 **不写**(全归 T7):`:76-141` 的 **`kw-meta` 之后**全部」⇒ `kw-meta`(`:76-81`)**归 T6**。

**本刀取后者**,理由:brief 的 DoD 第 8 条要求「`updatedFmt` / `selAiLabel` 的兜底」用例,
而这两个 computed **只有 `kw-meta` 一个渲染落点** —— 不搬它就没有任何可观测面,那条 DoD 无法落地
(治理 §10 申报纪律 2「brief 把某函数列进不写清单、却又在 DoD 里要求它的效果」的同族情形)。
⇒ 本刀落 `:76-81`(`<template v-else>` + 三行 `kw-meta`),**摘要区 markup 一行都没提前写**
(brief 明令 ⚠️),`kw-summary` / `kw-rawsrc` / `v-html` / `kw-sec` / `kw-changes` / `kw-foot` 全部留白给 T7,
并在 `WikiView.vue` 文件头写死了 T6/T7 的分刀边界供下一刀先读。

**连带**:`showSource` 的 `ref` 本刀已声明 —— 它不是 T7 专属,蓝本 `fetchArticle`(`:264`)
每次取文章都把它重置为 `false`,那一行在**本刀范围内**,ref 不声明就写不出来。

## 3.1 🔴 申报 ②:蓝本 `nodeClick` 的第二行是**不可达分支**(N58 同族,照抄不化简)

蓝本 `:247` `if (n.children.length && !this.isOpen(n.path)) this.openPaths.push(n.path)` **永远不会执行**:
`select(n.path)` 里的 `trailFor(byPath, n.path)` 返回的祖先链**含 `n` 自己**
(`wikiViewHelpers.ts` 的 `trailFor` 逐段拼 `cur`,最后一段就是 `n.path`),
而 `n` 一定在 `byPath` 里(它从 `visibleNodes` 点出来)⇒ `select()` 的循环已经把它推进 `openPaths`
⇒ 回到 `nodeClick` 时 `isOpen(n.path)` 恒 `true`。
**处置:照抄不删**(与 **N58** 的恒等表达式同款理由 —— 删了会失去意图痕迹);
「点整行会展开」这个**可观测行为**是真的(由 `select()` 提供),用例照常钉,
但守卫落在 `select()` 的祖先循环上(RED 探针 P3 证实)。已在产品码注释里逐条推演。

## 3.2 🔴 申报 ③:`route.query.path` 的类型收窄(Vue2→TS 强制改写,不算偏离)

`route.query.path` 的类型是 `LocationQueryValue | LocationQueryValue[] | undefined`(`?path=a&path=b` 会是数组)⇒
本文件用 `queryPath()` 收窄成 `string`(非字符串一律 `''`)。
**语义与蓝本等价**:蓝本把数组直接喂给 `byPath[…]`,JS 会 toString 成一个绝不可能存在的 key ⇒ 同样落到「未命中」那一支。

## 3.3 🔴 申报 ④:`onMounted` 的 `loadRoots()` **不传 `silent`**

`knowledgeStore.loadRoots(opts?)` 带一个 P5a 加的 `silent` 选项。本刀**不传**,理由两条:
① 蓝本 `:216` 就是裸调;② **同期 `RootsView.vue` 的 `onMounted` 逐字同款不传** ⇒ 与本仓视图层既定做法一致。
(记账:本机 `/v1/wiki/roots` 会等满 60 s axios 超时后弹一次 `aiKbOpFailed` toast —— 这是 **D1** 的连带后果,与 Vue2 一致,不是本期缺陷。)

## 3.4 🔴 申报 ⑤:R22 追加项的样本是**本文件就地构造**,不是 `p5f-fixtures` 里的

「同名开头兄弟目录」这个拓扑 `p5f-fixtures/wiki-tree.CONSTRUCTED.json` 的五组里**一组都没有**
(`/DATA` vs `/DATA/Documents` 是真父子;`/u/a` vs `/u/b` 前缀互不包含)。
路径由裁定 **R22** 直接指定(`/DATA/Media` + `/DATA/MediaBackup`),用该测试文件既有的 `flatNode()`
按共享包 `WikiTreeNode` 形状造。**先例**:同文件 `rootForPath` 的「root.path 带尾斜杠」那条同样是就地构造的变体。
⚠️ 这是**纯函数的拓扑样本**,不是后端响应的 mock ⇒ 不在治理 §4「禁手编 mock」的射程内;仍按 R22-P5e 显式申报。

---

## 4. §3 的 K 条目逐条申报

| # | 命中 | 落地 |
|---|---|---|
| **K44** | ✅ | `WikiView.vue` **零 `<style>` 块**(`grep -c '</style>'` = 0);蓝本本页自带零 style 块,`kw-*` 由 T2 从蓝本 `knowledge.scss:2453-2561` 整段搬入。**已在 `KNOWLEDGE_VUE_FILES` 同一提交里登记**(不登记会打红「文件清单集合相等」—— RED 探针 P-REG 实证) |
| **K56** | ✅ | 面包屑 `:key="c.path"` 挪到 `<template v-for>` 自身,内部 `<button>` / `<span>` **不再各带 key**;注释写明这是 **Vue 3 编译器要求**,不是选择。DOM 序列由一条断言钉死(RED 探针 P-K56) |
| **K1** | ✅ | `store.state.*` / `store.actions.*` 两层全部降掉:`store.wikiRoots` / `store.loadRoots()` / `store.loadWikiTree()` / `store.loadWikiNode()` / `store.loadWikiRaw()` / `store.toast()` |
| **K58**(形态 A) | ✅ | `fetchArticle` 的 catch **不回显 `e.message`**,只弹固定键 `aiKbOpFailed`、**不留 `': '` 前缀**。落地判据是**排除式断言**(探针文本 `PROBE-K58-T6WV` **故意不出现在产品码里**) |
| **K27 同族 / 裁定 R27-P5e** | ✅ | toast 一律 `store.toast(...)`(保住蓝本的 2400 ms);本刀范围内**共 1 处** |
| **K41 / 治理 §5.1** | ✅ | **零 `any`**:树节点 `WikiViewTreeNode`(T3 导出)、文章 `WikiNode`、root 经 `rootForPath` 推导出共享包的 `WikiRoot` |
| **K9** | ✅(承 T2) | `kw-*` 全族嵌在 `.knowledge-app` 下,本文件不 import 样式 |
| **K6** | n/a | 蓝本本页零 `console.error`,无可不照抄的 log(见 N57) |

**未命中**:K53 / K54 / K55(Roots/Allowlist 的)· K57(本页无弹窗)· K59 · K60。

## 5. §3.5 的 N 条目逐条申报(确实照抄了)

| # | 内容 | 本刀怎么落 |
|---|---|---|
| **N46** | 两种命名风格 | 只消费 **camelCase**(`aiLabel` / `lastModified` / `r.path` / `r.id`),**页面里零归一化**;测试里 fixture 抄的是 **HTTP 原文 snake_case**,再显式过一遍 `toStoreShape()`(等价于包内 `normalizeTreeNode`)—— 直接抄 camelCase 会让「fixture 记录后端真形状」这件事丢失。3 条抄本自检钉死两侧风格 |
| **N48** | 404 → `null`、其余上抛 | **分层留在 store 层**,页面 try 里拿到的 `null` 是**合法业务态**、catch 只接真错误。两条用例(404 不 toast、骨架照收;500 走 catch + 固定键) |
| **N49** | Go nil slice 兜底 | 本刀范围内的落点在 `buildWikiTree` 的 `(list \|\| [])` 与 store 侧,页面不重复兜底(`childMap` / `recentChanges` 的兜底归 T7) |
| **N55** | `fetchArticle` 三处过期守卫 | **逐字照抄**,四条各自独立报红(§7 探针 P4/P5/P6/P7)+ `Promise.all` 并发照抄(一条 order 断言) |
| **N56** | 深链两半,**不许统一成 `immediate`** | ① `loadTree` 里读一次 `route.query.path`(三条:命中 / 未命中 / 都没有);② watch **无 `immediate`**(四条)。**没有**改成 `immediate: true`;并配一条「树没回包时不选中、回包后才选中」证明两条路径是分开的 |
| **N57** | `router.replace(...).catch(() => {})` | 照抄。一条用例喂一个 reject 的 `replace`,证明被吞掉且 `fetchArticle` 照常发 |
| **N58** | 恒等/冗余表达式照抄不化简 | 本刀命中的是 `nodeClick` 的不可达第二行(见 §3.1),**照抄** |

---

## 6. 🔴 逐条论证:`loadTree` **不加**过期守卫的理由(brief 明令)

治理 §5.2 第 2 行把 `WikiView.loadTree()` 判为「🟢 不加」。本刀**逐条复核并全部成立**:

1. **触发点只有两个** —— `onMounted()` 跑一次,和 `treeError` 分支里的「重试」按钮。
   全文件搜 `loadTree` 只有这两个调用点(产品码 `onMounted` 一处 + 模板 `@click="loadTree"` 一处)。
2. 🔴 **重试按钮无法并发触发两发** —— `loadTree` 第一行就 `treeLoading.value = true`,
   而按钮所在的 `v-else-if="treeError"` 分支排在 `v-if="treeLoading"` **之后** ⇒
   **请求在飞时那整块 DOM 不存在,按钮点不到**。
   **这一条本刀配了守卫**:用例「🔴 treeLoading 期间「重试」按钮整块不渲染」——
   它先用一次失败换出重试按钮(证明按钮**真的**渲染成可点元素,§9.17),
   再让第二发挂起,断言 `.kw-tree-note` 与其中的 `button` **双双消失**、6 条 `k-skel` 回来。
   ⇒ 将来谁把三态排布改成「重试按钮常驻」,**这条先报红**,提醒他连带补上过期守卫。
3. **无入参分歧** —— `store.loadWikiTree()` 无参数(蓝本也没传 `rootId`),两发的结果必然同源;
   即使真并发,后到的覆盖先到的也不产生错误状态。
4. **蓝本自己也没有**(而同一文件的 `fetchArticle` **有**)⇒ 加了就是**未申报的偏离**;
   按治理 §2「界面照 Vue2、逻辑照正确」的口径,这里不存在可被「照正确」修掉的 bug。

⇒ **不加,并把第 2 条做成守卫。**

---

## 7. RED→GREEN 证据(探针一律 `cp` 备份 → 精确唯一注入 → **先证注入落盘** → 报红 → `cp` 还原 → `md5sum` 逐字节比对;🔴 全程未用 `git checkout/restore/stash`)

**探针前基线 md5**:
```
98b878455f9840af9cbd870cc37bacf0  src/ai/knowledge/views/WikiView.vue
1976241befd070bdde0e80cff4e9d316  src/ai/knowledge/views/RootsView.vue
99ad3de4670fd9827eebf9eff505dbff  src/ai/knowledge/util/wikiViewHelpers.ts
3f0a8fa19f1021846e24b6f49c6b9142  src/ai/styles/knowledgeStyles.test.ts
```
**全部探针跑完后逐个 `md5sum` 与上表一致**(每条探针末尾都贴了还原比对,四份哈希一字不差)。

### P1 —— 裁定 **R22**:`findParent` 换成「最长字符串前缀、不做 `'/'` 边界判断」

注入落盘证据(现文件片段):
```
function findParent(byPath, path): WikiViewTreeNode | null {
  let best: string | null = null
  for (const k of Object.keys(byPath)) {
    if (k !== path && path.startsWith(k) && (!best || k.length > best.length)) best = k
  }
  return best ? byPath[best] : null
  /* PROBE-R22 */
}
```
```
 Tests  4 failed | 49 passed (53)
 × buildWikiTree —— 🔴 同名开头的兄弟目录不许被错挂成父子(裁定 R22) > 🔴 /DATA/MediaBackup 的父是 /DATA,**不是** /DATA/Media
 × …                                                                > 🔴 各自的真子目录仍然挂对(边界判断不是靠「一律不挂」蒙对的)
 × …                                                                > 🔴 同名开头但**父缺位**时不许攀附兄弟
 × …                                                                > 🔴 单字符差的同名开头(/a 与 /ab)同样不许挂成父子
```
🔴 **同时坐实了 T3 评审的原判**:**既有 49 条一条都没红** —— 那个错实现此前完全裸奔。
还原:`99ad3de4670fd9827eebf9eff505dbff` ✅

### P2 —— 裁定 **R27**:去掉 `submit()` 的 `submitting` **函数门**

```
INJECTED @ RootsView.vue:304 ->  if (!canSubmit.value) return /* PROBE-R27 */
 Tests  1 failed | 62 passed (63)
 × RootsView —— 🔴 submitting 是**函数门**,不只是 :disabled 绑定(裁定 R27)
     > 🔴 双击镜像按钮:submitting 函数门挡住第二发(判据:去掉该门 → 本条必须报红)
 ✓ RootsView —— canSubmit 两侧 + submitting 门 > 🔴 submitting 门:第一发在飞时重复点不发第二发(蓝本 :184 自带)
```
🔴 **旧那条仍然全绿 = 评审 I-1 逐字复现**:它点的是带 `:disabled` 的「添加」按钮,
而 **jsdom 不向 `:disabled` 元素派发 click** ⇒ 它实测的是 `:disabled` 绑定,**从未到达 `submit()`**。
新用例走 **N50 的「以镜像模式添加」按钮**(无 `:disabled`),并先用一条 §9.17 前置断言
证明它 `hasAttribute('disabled') === false` 才双击。还原:`1976241befd070bdde0e80cff4e9d316` ✅

### P3 —— `select()` 去掉祖先展开循环(DoD 5-②)
```
 Tests  2 failed | 52 passed (54)
 × WikiView —— select() 三件事 > 🔴 ② 展开**每一个**祖先(判据:去掉 trailFor 循环 → 本条必须报红)
 × WikiView —— N56 深链第二半 > 🔴 挂载后改地址栏 query → 真的切换   ← 连带(它也依赖祖先展开)
```

### P4~P7 —— **N55 四条守卫各自独立报红**(brief 的评审第一必查项)

| 探针 | 注入 | 结果 |
|---|---|---|
| **P4 · ①逻辑** | `if (sel.value !== p) return // stale` → `if (false) return` | `1 failed \| 53 passed` · `× 🔴 ① 逻辑交错:A → B,B 先回、A 后回 ⇒ 最终状态是 B 的` |
| **P5 · ②作用域** | 加一个普通 `<script>` 块导出 `__probeSel`,把 `const sel = ref('')` 换成 `const sel = __probeSel`(**真·模块级**) | `2 failed \| 52 passed` · `× 🔴 ② 两实例交错守**作用域**` |
| **P6 · ③catch** | 删掉 catch 里的 `if (sel.value !== p) return` | `1 failed \| 53 passed` · `× 🔴 ③ catch 分支也有守卫:迟到的**失败**不弹 toast、不清空` |
| **P7 · ④finally** | `if (sel.value === p) nodeLoading.value = false` → 无条件 | `1 failed \| 53 passed` · `× 🔴 ④ finally 的 nodeLoading 也带守卫` |

🔴 **四条各自只打红自己那一条** ⇒ **不是「只有一条在起作用」**。

### P8 —— **N56 深链第二半**:删掉整个 `watch`
```
 Tests  1 failed | 53 passed (54)
 × WikiView —— N56 深链第二半 > 🔴 挂载后改地址栏 query → 真的切换(判据:删掉 watch → 本条必须报红)
```
### P8b —— 去掉 watch 的 `v !== sel.value` 回环门
```
 Tests  3 failed | 51 passed (54)
 × 🔴 `v !== sel` 那一条:select() 自己写回的 query 不会再触发一次取文章(防回环)
 × 🔴 `Promise.all` 照抄…            ← 连带(多发了一次 fetchArticle)
 × 🔴 K58 形态 A…                    ← 连带(多弹了一次 toast)
```
🔴 **§9.14-3 防坑说明**:「相同值不重复」这条**不是**写成「把 query 设成和现在一样的值」——
那样 Vue watch 的 `Object.is` 前置去重会让回调**压根不执行**,产品码有没有守卫都一样绿 = **零判别力**。
本刀用的是**真实回环形态**:点树行 → `select()` 写 query → watch 被这次写触发且 `v === sel` ⇒ 守卫拦住。
**P8b 证明它真有判别力。**

### P9 —— 「自动上膛」守卫(DoD 11)
**惰性证明**(基线 `--reporter=verbose`,三条**都在 passed 里、非 skip/todo**):
```
 ✓ WikiView —— 自动上膛守卫… > 防空转① —— 模板真的抽出来了,且剥注释后**真 markup 仍在**
 ✓ WikiView —— 自动上膛守卫… > 防空转② —— 谓词双向可分辨(注释里写了不算;真 class 属性才算)
 ✓ WikiView —— 自动上膛守卫… > 🔴 本体条件断言:模板尚无 kw-summary ⇒ 惰性通过(非 skip/todo);一旦写了则必须有 showSource 按钮
```
**上膛证明**(往模板塞 `<div class="kw-summary kw-md" />`,**不给** `showSource` 按钮):
```
 Tests  1 failed | 53 passed (54)
 × 🔴 本体条件断言:模板尚无 kw-summary ⇒ 惰性通过…;一旦写了则必须有 showSource 按钮
```
🔴 **谓词形态(承 R19 / R26-3)**:先**剥注释**、再把 `kw-summary` 锚定到 **class 属性值位置**
且用 `(?<![\w-])…(?![\w-])` 挡住 `kw-summary-note` 这类同名开头(E-25 词边界坑)。
**必须剥注释**:`WikiView.vue` 的文件头与模板占位注释**都写了 `kw-summary` 与 `showSource` 两个字面串**,
裸子串谓词会当场双向假阳性(判成「已上膛」再判成「已满足」)。
🔴 **剥注释器要求 `/*` 前是空白或行首**(**R26-3**:裸 `/\*[\s\S]*?\*\//` 会被 `'/Downloads/*'`
这类路径字面量骗开假注释、吃掉真代码)。
🔴 **自带防空转**:剥完必须仍能匹配到 `class="kw-node"` / `class="kw-crumb"` / `class="kw-meta"` 三个真 markup 锚点,
且原文有 `<!--`、剥后一个都不剩。🔴 **读文件用 `node:fs`**(`?raw` 在 vitest 下恒空)。
🔴 **§9.19 跨刀冲突论证**:计划书 **T7 的第 3、4 条本来就要求**「`kw-summary` / `kw-rawsrc` 按 `showSource` 二选一」
与「切换按钮文案在 `Rendered view` / `View source` 之间翻转」⇒ **本守卫不向 T7 索要任何它无权写的东西**。

### P10 —— `@click.stop` 去掉 `.stop`(DoD 4)
```
 Tests  2 failed | 52 passed (54)
 × 🔴 chevron 的 @click.stop:点它只折叠/展开,**不**触发整行选中(蓝本 :26)
 × toggle 是纯翻转:再点一次收起                                     ← 连带(冒泡后 nodeClick 又展开一次)
```
### P11 —— 去掉 `created` 的 `if (!wikiRoots.length)` 门(DoD 9)
```
 Tests  1 failed | 53 passed (54)
 × 🔴 store 里已有 roots → **不重复拉**(照抄蓝本的 `if (!…length)`)
```
### P-K56 —— 把分隔符 `<span>/</span>` 挪出 `<template v-for>`(DoD 2)
```
 Tests  1 failed | 53 passed (54)
 × WikiView —— K56 面包屑 DOM 序列 > 🔴 button / span("/") 交替,末尾是 span.cur
```
### P-REG —— 从 `KNOWLEDGE_VUE_FILES` 摘掉 `views/WikiView.vue`(DoD 1)
```
 Tests  1 failed | 417 passed (418)
 × 守卫缺口③′ … > 文件清单集合相等(防漂移:新增视图必须显式进清单,否则本条报红)
```

### T3 那条「自动上膛」守卫**现在已上膛且已满足**(brief 明令要写明)
`wikiViewHelpers.test.ts` 的
`T3 自动上膛守卫 —— 若 views/WikiView.vue 存在,则它必须 import ../util/wikiViewHelpers`
在 T3 落地时走「文件不存在」的惰性分支;**本刀建了 `WikiView.vue` ⇒ 它现在走「已存在」分支**,
且 `WikiView.vue` 真的 `import { buildWikiTree, trailFor, parseTs, rootForPath } from '../util/wikiViewHelpers'`
(多行形态,该守卫的「防空转③」正是为这种形态铺的)⇒ **已满足,绿**。
(`opToType` / `renderWikiMarkdown` 归 T7 的下半,T7 会把 import 补齐。)

---

## 8. 🔴 R22 的 Minor M-1 订正(「反转不删」,只改注释)

**被订正对象**:`wikiViewHelpers.test.ts` 里
「root.path 带尾斜杠时归一化后仍能匹配」用例末尾的结论 ——「精确相等比的是**原始** path ⇒ 不带斜杠的写法不命中」。
🔴 **结论不变**(照抄蓝本、不记账、不改产品码);变的是**理由**。

- ~~T3 的理由(**数据层,有保质期**)~~:「本机 fixture 的两个 root 都不带尾斜杠 ⇒ 不影响实际。」
- 🔴 **订正为(后端层,无保质期)**:后端**根本存不下带尾斜杠的 root path**。

**两条独立口径的原始输出(承 R21:不许只贴一条)**:

口径 ①(读源码):
```
$ grep -n "filepath.Clean" /home/nimo/NimoTech/NimoOS-Wiki/service/roots/manager.go
199:	args.Path = filepath.Clean(args.Path)
```
上下文(`Create()` 落库前的规范化,`manager.go:195-199`):
```go
func (m *Manager) Create(args CreateArgs) (string, string, error) {
	if !filepath.IsAbs(args.Path) { … }
	args.Path = filepath.Clean(args.Path)
```
口径 ②(实跑 Go,证明 `filepath.Clean` 真的剥尾斜杠):
```
$ go run main.go
"/DATA/"     -> "/DATA"
"/DATA//"    -> "/DATA"
"/DATA"      -> "/DATA"
"/Backup///" -> "/Backup"
```
⇒ `wikiRoots` 里**不可能**出现带尾斜杠的 `path`,与「本机 fixture 长什么样」无关,
也不会因为换 fixture / 换设备而失效。**订正块以注释形式新增在测试文件末尾,原用例断言一行未动。**

---

## 9. 用了哪几个样本、mock 形状取自哪一层(治理 §4.1 / R14)

| 样本 | 标签 | 用在哪 | `__meta` 怎么办 |
|---|---|---|---|
| `p5f-fixtures/wiki-tree.CONSTRUCTED.json` 的 `normal` 组 | 🔴 **`.CONSTRUCTED`** | `WikiView.test.ts` 的 `TREE_RAW_NORMAL`(三节点三级链路,第三条 `last_modified` 是**空串** —— `updatedFmt` 兜底就靠它) | **转成注释**(`label` / `why` / `built_from` / `value_units` / `normalized_shape` 逐条抄进注释) |
| `p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json` 的 `wikiRoots` | 🔴 **`.CONSTRUCTED`** | `ROOTS_NORMALIZED`(`store.wikiRoots` 的出口形状) | 同上 |

🔴 **三级标签逐个写进测试注释**,并明写「**不是真机数据**」(D1:`/v1/wiki/{roots,tree,node}` 本机 90 s 0 字节超时)。
🔴 **抄本里零 `__meta` 键**(一条断言钉死)。🔴 **不在运行时读 `.superpowers/`**。

**mock 层次(§4.1 的表)**:
- mock 的是**共享包 `service.wiki.{getRoots,getTree,getNode,getRaw}`**,**走真 `knowledgeStore`**。
  决定性理由:**N48 的「404→null、其余上抛」分层就在 store 里** —— mock 掉 store 等于自己写一份影子实现,
  「404 走业务态 / 500 走 catch」两条就退化成「我说它回 null 它就回 null」。
- `getTree` 喂 **HTTP 原文 snake_case**,再经本文件的 `toStoreShape()`(= 包内 `normalizeTreeNode`)出 camelCase;
  `getRoots` 直接喂 **camelCase**(包内已归一化)。**两侧风格由 3 条抄本自检钉死,搞反立刻报红。**
- 404 一律 `reject` 一个 `{ response: { status: 404 } }`,让 store 那层真的去转 `null`。

---

## 10. 三门完整终值 + 用例数归因(裁定 R24:必须与总数自洽)

```
$ pnpm test                    → exit 0    Test Files  339 passed (339)    Tests  4612 passed (4612)
$ pnpm exec vue-tsc --noEmit   → exit 0    (零输出)
$ pnpm build                   → exit 0    ✓ built in 13.93s
```
**零红项**(已知噪声 `persist.test.ts > dropPersisted …` 与 `AgentComposer.test.ts` 本轮**均未复发**)。
`grep "Vue warn\|Vue Router warn\|No match found"` 全量日志 **零命中**。

| 项 | 起点(T5 收官) | 本刀落地 | Δ | 归因 |
|---|---|---|---|---|
| **Test Files** | **338** | **339** | **+1** | 新建 `WikiView.test.ts` |
| `WikiView.test.ts` | — | **54** | **+54** | 本刀新建 |
| `wikiViewHelpers.test.ts` | 49 | **53** | **+4** | 裁定 **R22** 追加(4 条) |
| `RootsView.test.ts` | 60 | **63** | **+3** | 裁定 **R27** 追加(3 条) |
| `knowledgeStyles.test.ts` | 417 | **422** | **+5** | 4 条 `it.each(KNOWLEDGE_VUE_FILES)` 各 +1(缺口③′ 三条 + §0.3 一条)+ K44 运行时磁盘扫描参数化 +1 |
| `color-guard.test.ts` | 189 | **190** | **+1** | 按 `**/*.vue` 动态生成,`.vue` **187 → 188** |
| **Tests 合计** | **4545** | **4612** | **+67** | 54 + 4 + 3 + 5 + 1 = **67** ✅ 与总数自洽 |

**其它基线**:`.vue` 总数 **187 → 188**(`find src -name '*.vue' | wc -l` = 188)· color-guard **189 → 190**
—— 与计划书 §8.1 的预测表(T6 落地后 `.vue` 188 / color-guard 190)**逐格吻合**。

---

## 11. i18n:本刀零新增键(全部复用 T1 已落的 `aiKb*`)

| 蓝本文案 | 键 | 附录 A 行 |
|---|---|---|
| `Failed to load the wiki tree` | `aiKbWkTreeError` | 69 |
| `Retry` | `aiKbRetry` | 70 |
| `No wiki has been generated yet` | `aiKbWkEmptyTitle` | 71 |
| `Add a knowledge root and the wiki map will build itself from your folders.` | `aiKbWkEmptySub` | 72 |
| `Manage roots` | `aiKbManageRoots` | 73 |
| `Open folder` | `aiKbWkOpenFolder` | 74 |
| `Summary updated {t}` | `aiKbWkSummaryUpdated` | 75 |
| `Maintained automatically by Nimo` | `aiKbWkMaintained` | 76 |
| `Operation failed` | `aiKbOpFailed` | 64 |

**新增 0 个键** ⇒ `zh_cn.ts` / `en_us.ts` / `messageSyntax.test.ts` / `parity.test.ts` **本刀零改动**。
`TREE` 标签(`:59`)是蓝本**硬编码英文装饰文案、没过 `$t()`** ⇒ **照抄字面量,不进 i18n**(同 `kw-sec-en` 的口径)。

---

## 12. 配色自查

- **模板内零裸色**:`knowledgeStyles.test.ts` 的三条 `it.each(KNOWLEDGE_VUE_FILES)`(贪婪抽取 + hex/rgb/hsl + 属性值位置具名色)
  与 `color-guard.test.ts` 的动态用例**本刀起自动覆盖 `WikiView.vue`**,全绿。
- 🔴 `:59` 的 `style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"` —— **两档都有值**
  (`knowledge.scss:220` 深色 / `:439` 浅色,本刀现测确认)⇒ **照抄不改**。
- 其余 5 处内联 `style=` 全是**纯尺寸/排版**(`display` / `height` / `margin` / `width` / `gap` / `flex-direction` / `padding-left`),零颜色。
- 🔴 **注释里零色字面量**(§0.3 的守卫本刀起自动覆盖本文件,绿)。

---

## 13. 顾虑 / 留给 T7 与终审的知情项

1. 🔴 **模板边界**(§3):`kw-meta`(蓝本 `:76-81`)由**本刀**落。**T7 从 `:83` 起续写**,
   `WikiView.vue` 文件头已写死分刀边界;T7 若照 brief 字面「移植 `:76-141`」会**重复**写一遍 `kw-meta`。
2. 🔴 **T7 一写 `kw-summary` markup,`WikiView.test.ts` 的自动上膛守卫立刻生效** ——
   必须同时给出 `showSource` 切换按钮(蓝本 `:137`),否则报红。**这是设计意图,不许放宽该守卫。**
3. **蓝本 `nodeClick` 第二行不可达**(§3.1)—— 已照抄并逐条推演;终审别把它当成「漏了守卫」。
4. **`selName` 的兜底分支走 UI 到不了**(`select()` 第一行就守了 `byPath[path]`)⇒
   那条用例通过 `w.vm` 直接改 setup 绑定制造该状态,已在用例注释里申报。
   **这是本文件唯一使用 `w.vm` 写入的地方**;`node` / `raw` / `showSource` 的读取也走 `w.vm`,
   原因是它们在 **T6 的模板里还没有渲染面**(归 T7)。T7 补上 markup 之后,
   这些断言**可以**改成黑盒 DOM 断言 —— 但那属于「改既有已过评审的断言」,不在本刀范围。
5. **D1 连带**(§9.17):本机 `/v1/wiki/tree` 超时 ⇒ 左树**恒走 `treeError` 分支**,
   「空树 onboarding」「面包屑 / 标题 / 打开文件夹 / 文章骨架」在真机上**全部不可达**。
   **验收清单必须写明这是 D1 的连带后果,不是缺陷。**
   `?path=` 深链的可粘贴 URL(供 T8/收官写进清单):
   `http://<host>/app/#/ai/knowledge/wiki?path=%2FDATA%2FDocuments`
6. **`onMounted` 的 `loadRoots()` 不传 `silent`**(§3.4)⇒ 本机进 Wiki 页 60 s 后会冒一次「操作失败」toast。
   与 Vue2 一致、与同期 `RootsView` 一致 ⇒ **本刀不改**;若协调者想统一改成 `silent`,那是跨页决策,请另开票。
7. **探针脚本**留在 `/tmp/p5f-t6-inject.py`、备份在 `/tmp/p5f-t6-bk/`(不进版本库),
   所有探针日志在 `/tmp/p5f-t6-probe-*.log`,供评审独立复跑。
