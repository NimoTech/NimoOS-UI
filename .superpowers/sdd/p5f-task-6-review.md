# SP8-P5f · Task 6 独立评审 —— `WikiView.vue` 上半 + R22 / R27 两个追加项

| | |
|---|---|
| 被评审提交 | **`4c4671b`**(起点 `dbe2e17`) |
| 工作区 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai` |
| 结论 | **Critical 0 / Important 1 / Minor 6** |
| 三门(评审自跑) | `Test Files 339 passed` / `Tests 4612 passed` / `vue-tsc --noEmit` exit 0(零输出)/ `pnpm build` exit 0 |
| 探针纪律 | 全部 `cp` 备份 + Python 精确唯一注入 + `cp` 还原;**全程零 `git checkout/restore/stash`**;收尾 `md5sum -c` 五份文件 **全 OK**,`git status --short` 空 |
| 日志 | `$SCRATCH/logs/{baseline-full,baseline-verbose,t6-three-verbose,wikiview-only,tsc,build,probe-*}.log` |

> 🔴 **本评审一条都没有采信 T6 报告的结论** —— §1 / §3 / §4 的每一条都是评审自己注入、自己跑、自己读源码得到的。

---

## 0. 三门与 +67 归因(评审自跑,未 `| tail`)

```
$ pnpm test                                   → exit 0   Test Files 339 passed (339)   Tests 4612 passed (4612)
$ pnpm exec vitest run --reporter=verbose     → exit 0   同上(逐条具名)
$ pnpm exec vue-tsc --noEmit                  → exit 0   日志 0 行
$ pnpm build                                  → exit 0   ✓ built in 13.81s
```

**归因表逐格现测复核(裁定 R24)**:

| 文件 | 评审实测 | Δ | 复核方式 |
|---|---|---|---|
| `WikiView.test.ts` | **54** | +54 | `--reporter=verbose` 逐条数 `✓ …WikiView.test.ts >` = 54 |
| `wikiViewHelpers.test.ts` | **53** | +4 | R22 探针输出 `4 failed \| 49 passed (53)` 双向坐实 |
| `RootsView.test.ts` | **63** | +3 | R27 探针输出 `1 failed \| 62 passed (63)` |
| `knowledgeStyles.test.ts` | **422** | +5 | 单跑 = 422;`it.each(KNOWLEDGE_VUE_FILES)` **4 处** + `it.each(knowledgeVues…)`(K44 运行时磁盘扫描)**1 处** = 5,逐处 `grep -n` 确认 |
| `color-guard.test.ts` | **190** | +1 | 单跑 = 190;`find src -name '*.vue' \| wc -l` = **188** |

**54 + 4 + 3 + 5 + 1 = 67**,`4545 + 67 = 4612` ✅ **与总数自洽**。

**§9.10(既有守卫只许加固不许放宽)—— `git diff` 逐行核**:

```
$ git diff dbe2e17..4c4671b --numstat        (src/ 部分)
120  0  src/ai/knowledge/util/wikiViewHelpers.test.ts
100  0  src/ai/knowledge/views/RootsView.test.ts
1007 0  src/ai/knowledge/views/WikiView.test.ts
511  0  src/ai/knowledge/views/WikiView.vue
3    0  src/ai/styles/knowledgeStyles.test.ts
$ git diff dbe2e17..4c4671b -- <三份既有测试> | grep -c "^-[^-]"    → 0
$ git diff … --  wikiViewHelpers.test.ts | grep "^@@"  → @@ -651,3 +651,123 @@   (纯尾部追加)
$ git diff … --  RootsView.test.ts       | grep "^@@"  → @@ -1264,3 +1264,103 @@ (纯尾部追加)
$ git diff … --  knowledgeStyles.test.ts               → 只在 KNOWLEDGE_VUE_FILES 里 +1 条目 +2 行注释
```
⇒ **零删除行、零既有断言改动、三处改动全是纯追加**。§9.10 满足,R22 / R27 的「极窄解禁」纪律满足。
**产品码零改动**:`wikiViewHelpers.ts` / `RootsView.vue` / `knowledge.scss` 均不在 diff 里。

---

## 1. 🔴 第一必查项 —— 评审自己跑的四组探针

**基线 md5(探针前后一致,收尾 `md5sum -c` 全 OK)**
```
98b878455f9840af9cbd870cc37bacf0  src/ai/knowledge/views/WikiView.vue
1976241befd070bdde0e80cff4e9d316  src/ai/knowledge/views/RootsView.vue
99ad3de4670fd9827eebf9eff505dbff  src/ai/knowledge/util/wikiViewHelpers.ts
f68e5050a738c0c1cad7cc2b38ef396a  src/ai/knowledge/views/WikiView.test.ts
3f0a8fa19f1021846e24b6f49c6b9142  src/ai/styles/knowledgeStyles.test.ts
```

### 1.1 ✅ N55 四条守卫**各自独立报红** —— 四个探针评审全跑

| 探针 | 注入 | 结果 | 具名 failed |
|---|---|---|---|
| **①逻辑** | `if (sel.value !== p) return` → `if (false) return` | `1 failed \| 53 passed` | `🔴 ① 逻辑交错:A → B,B 先回、A 后回 ⇒ 最终状态是 B 的(蓝本 :270)` |
| **②作用域** | 新增普通 `<script>` 块 `export const __probeSel = __probeRef('')`,`const sel = ref('')` → `const sel = __probeSel`(**真模块级**) | `2 failed \| 52 passed` | `🔴 ② 两实例交错守**作用域**` + 连带 `watch **不是** immediate…` |
| **③catch** | 删掉 catch 里的 `if (sel.value !== p) return` | `1 failed \| 53 passed` | `🔴 ③ catch 分支也有守卫:迟到的**失败**不弹 toast、不清空(蓝本 :274)` |
| **④finally** | `if (sel.value === p) nodeLoading.value = false` → 无条件 | `1 failed \| 53 passed` | `🔴 ④ finally 的 nodeLoading 也带守卫…(蓝本 :279)` |

🔴 **四条各自只打红自己那一条,坐实「不是只有一条在起作用」。**
(②多出的一条连带是 `watch 不是 immediate` 那条,报告未列出连带项 —— 无实质影响,不记。)

### 1.2 ✅ N56 深链用例**有判别力**,「相同值不重复」那条**不是** `Object.is` 空转

| 探针 | 注入 | 结果 |
|---|---|---|
| **回环门** | `if (v && v !== sel.value && byPath.value[v])` → 去掉 `v !== sel.value` | `3 failed \| 51 passed`,首红即 **`🔴 v !== sel 那一条:select() 自己写回的 query 不会再触发一次取文章(防回环)`**;连带 `Promise.all 照抄` / `K58 形态 A` |
| **删 watch** | 整个 `watch(() => route.query.path, …)` 删掉 | `1 failed \| 53 passed` → **`🔴 挂载后改地址栏 query → 真的切换`** |

🔴 **§9.14-3 的坑被绕开了**:该用例走的是「点树行 → `select()` 写 query → watch 被自己这次写触发且 `v === sel` ⇒ 守卫拦住」的**真实回环**,不是「回写同一个值」的零判别力形态 —— 拿掉回环门它**真的报红**。

### 1.3 ✅ `select()` 的「展开每一个祖先」真有断言

去掉 `for (const anc of trailFor(byPath.value, path)) { … }` 整个循环 →
`2 failed | 52 passed`,含 **`🔴 ② 展开**每一个**祖先(判据:去掉 trailFor 循环 → 本条必须报红)`**(另一条是深链切换,同因连带)。

### 1.4 ✅ 两个追加项

**R22**(`findParent` → 最长字符串前缀、不做 `'/'` 边界判断):
```
Tests  4 failed | 49 passed (53)
× 🔴 /DATA/MediaBackup 的父是 /DATA,**不是** /DATA/Media
× 🔴 各自的真子目录仍然挂对(边界判断不是靠「一律不挂」蒙对的)
× 🔴 同名开头但**父缺位**时不许攀附兄弟:只有 /DATA/Media 与 /DATA/MediaBackup(无 /DATA)
× 🔴 单字符差的同名开头(/a 与 /ab)同样不许挂成父子
```
🔴 **既有 49 条一条都没红** = T3 评审「此前完全裸奔」的原判坐实。
`wikiViewHelpers.test.ts` **纯尾部追加**(`@@ -651,3 +651,123 @@`,零删除行),`wikiViewHelpers.ts` **零改动**(不在 diff 里)。还原 md5 `99ad3de…` ✅

**R27**(去掉 `submit()` 的 `submitting` 函数门):
```
Tests  1 failed | 62 passed (63)
× 🔴 双击镜像按钮:submitting 函数门挡住第二发(判据:去掉该门 → 本条必须报红)
✓ 🔴 submitting 门:第一发在飞时重复点不发第二发(蓝本 :184 自带)   ← 旧那条仍全绿
```
🔴 **评审 I-1 逐字复现**:旧用例点的是带 `:disabled` 的「添加」按钮,jsdom 不派发 click ⇒ 从未到达 `submit()`。
新用例走 N50「以镜像模式添加」(无 `:disabled`),并**先证可点**(`hasAttribute('disabled') === false`)再同步双击。
`RootsView.test.ts` **纯尾部追加**(`@@ -1264,3 +1264,103 @@`),`RootsView.vue` **零改动**。还原 md5 `1976241…` ✅

---

## 2. 移植忠实性(评审程序化比对,不是肉眼)

蓝本以 `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/WikiView.vue` 取出(**未在那个仓做任何 checkout/stash**),取 `:1-81` 与本刀模板作程序化比对:

- **class 序列**:31 个 class 属性 **逐个逐字相等**(`kw-split … kw-meta`),`JSON.stringify` 相等 = `true`。
- **标签序列**:蓝本 `:1-81` 的 **全部标签(含闭合)与本刀前缀逐个一致**;本刀多出的只有蓝本被 `:81` 截断处的那几个闭合标签。
- **属性逐元素比对**(51/51 元素):**只有 4 处差异,全部是已申报的**
  | # | 蓝本 | 本刀 | 判定 |
  |---|---|---|---|
  | 12 | `:style="{ paddingLeft: (8 + item.depth * 14) + 'px' }"` | 去掉一对括号 | 求值等价(实测断言 `8px/22px/36px` 全绿)· 见 M-6 |
  | 26 | `@click="$router.push(…)"` | `router.push(…)` | Vue3 强制改写,已申报 |
  | 30-32 | key 在 `<button>` / `<span … + '/sep'>` 上 | **K56**:key 挪到 `<template v-for>` 自身,内部两元素不带 key | 已申报 |
- **缩进公式**:`8 + depth*14` 由用例断 `padding-left: 8px / 22px / 36px`,与蓝本一致。
- **K56 DOM 序列**:用例断 `['BUTTON','SPAN','BUTTON','SPAN','SPAN']` + 末尾 `.cur`;评审已核标签序列与蓝本一致。
- **i18n 9 个键逐个回读 `en_us.ts`**,与蓝本英文原文**逐字相等**(`Failed to load the wiki tree` / `Retry` / `No wiki has been generated yet` / `Add a knowledge root and the wiki map will build itself from your folders.` / `Manage roots` / `Open folder` / `Summary updated {t}` / `Maintained automatically by Nimo` / `Operation failed`);`TREE` 是蓝本硬编码装饰文案、未过 `$t()`,照抄字面量正确。
- **N57**:`router.replace({…}).catch(() => {})` 照抄 ✅(`:326`)。
- **N48**:分层留在 store(`knowledgeStore.ts:715/725` `isNotFound(e) → null`,其余 `throw e`),页面 try 拿 `null` 是业务态 ✅。
- **N49**:`buildWikiTree` 的 `(list || [])` 仍在(`wikiViewHelpers.ts:68`),页面不重复兜底 ✅。
- **`toggle` 的 `@click.stop`**:保留 ✅ —— **探针**去掉 `.stop` → `2 failed | 52 passed`,含 `🔴 chevron 的 @click.stop:点它只折叠/展开,**不**触发整行选中`。
- **T3 那条上膛守卫**:现在走「已存在」分支且**已满足** —— `WikiView.vue` 真 `import { buildWikiTree, trailFor, parseTs, rootForPath } from '../util/wikiViewHelpers'`(多行形态,该守卫防空转③正为此铺)。
- **K44 / 登记 / any / 裸色 / toast**:`grep -c '</style>'` = **0** · `KNOWLEDGE_VUE_FILES` 已登记 `views/WikiView.vue`(19 条)· `grep ': any|<any>|as any'` **零命中** · 模板 hex/rgb/hsl **零命中** · toast **唯一一处**走 `store.toast(t('aiKbOpFailed'))`(`:351`),全文件零 `useToast()`。
- **fixture**:`.CONSTRUCTED` 标签逐个写在抄本头、并明写「**不是真机数据**」;抄本与 `p5f-fixtures/wiki-tree.CONSTRUCTED.json` 的 `normal` 组**逐字节一致**(评审用 `json.load` 对读);`__meta` 未混进代码体(一条断言钉死);运行时零读 `.superpowers/`(只 `node:fs` 读同目录 `.vue`);**store 出口 camelCase 没搞反**(树侧抄 HTTP 原文 snake_case → `toStoreShape()` 归一,根侧直接 camelCase,3 条抄本自检双向钉死)。

---

## 3. 缺口猎

| # | 项 | 评审结论 | 证据 |
|---|---|---|---|
| a | 「自动上膛」谓词禁裸子串(R19) | ✅ 谓词本身对(`class="[^"]*(?<![\w-])kw-summary(?![\w-])[^"]*"`) | 合成串偏态双向可分辨(测试自带) |
| b | 剥注释器要求 `/*` 前是空白或行首(R26-3) | ✅ **满足**(`/(^\|\s)\/\*[\s\S]*?\*\//g`) | 评审自跑:`'/Downloads/*'` 后的真代码**仍在**;裸正则 `/\/\*[\s\S]*?\*\//g` 在同一串上**吃掉真代码** |
| c | 偏态「注释里写了 `kw-summary` 但没真 markup → **必须绿**」 | ⚠️ **模板注释里绿,文件头注释里红** → 见 **Important I-1** | 见下 |
| d | 偏态「真写 markup 但没切换按钮 → **必须红**」 | ✅ 注入 `<div class="kw-summary kw-md" v-html="'probe'"/>` → `1 failed \| 53 passed`,红的正是本体条件断言 | `probe-arm.log` |
| e | 自带防空转 + `node:fs` 非 `?raw` | ✅ 三条真 markup 锚点 + `<!--` 双向断言 + `readFileSync` | 源码逐行 |
| f | 「`treeLoading` 期间重试按钮不渲染」有无判别力 | ✅ **有** —— 它是「`loadTree` 不加过期守卫」论证的真支撑 | 注入一个**常驻**的 `.kw-tree-note > button`(模拟「重试按钮常驻」)→ `3 failed \| 51 passed`,含该条 |
| g | 54 条新用例有无空转(§9.14-4) | ✅ **零空转** | 逐 `it()` 数 `expect(` :54 条,**零 expect 的 0 条**,最少 1 条;`--reporter=verbose` 全量日志里 `↓/skipped/todo` **零真命中**(两处字面命中都只是用例标题里的「非 skip/todo」字样) |
| h | §9.10 既有守卫只加固不放宽 | ✅ 见 §0 | `git diff` 逐行 |
| i | jsdom 不向 `:disabled` 派发 click(R27 同族)有无同款假用例 | ✅ **无** —— `WikiView.vue` 模板 `disabled` **零命中**,`WikiView.test.ts` `disabled` **零命中**;R27 新增段主动加了 §9.17 可点性前置断言 | `grep -n disabled` 两侧 |

---

## 4. 🔴 T6 四条顾虑的裁断(评审独立判定)

### ① 模板边界(`:76-81` 归谁)—— **T6 取法正确,采纳**
评审自读蓝本:`:76` 是 `<template v-else>`,`:77-81` 是 `kw-meta` 的三行 `<span>`。三条理由:
1. brief 的「不写」句字面就是「`:76-141` 的 **`kw-meta` 之后**全部」⇒ **`kw-meta` 本身在「之后」之外**,字面支持 T6;
2. **DoD 8 会变空断言**:`updatedFmt` / `selAiLabel` 的**唯一渲染落点**就是 `kw-meta`。不搬它,那两条兜底用例只能读 `w.vm`,而 `updatedFmt`/`selAiLabel` 是 computed —— 断言退化成「我读到 computed 的返回值」,**测不到它有没有被渲染出去**;
3. `:69-74`(`v-if="nodeLoading"` 骨架)与 `:76`(`<template v-else>`)是蓝本的**一对 `v-if/v-else`**。把 `v-else` 划给 T7,T6 的骨架就成了孤枝 —— 骨架收掉后整页空白,**与蓝本不一致**,还会让 T6 的多条 DOM 断言无处落。
⇒ **裁定:T6 取「归 T6」这一支正确。** brief 的两句矛盾登记备查,**T7 必须从 `:83` 起续写**(T6 已把边界写进 `WikiView.vue` 文件头)。

### ② `nodeClick` 第二行不可达 —— **评审独立推演,结论一致**
自读 `wikiViewHelpers.ts:111-124`:`trailFor` 把 `path` 按 `/` 切段、逐段拼 `cur`,**命中 `byPath[cur]` 就 push** —— 最后一段拼出来的就是 `path` 本身。
`select(path)` 第一行 `if (!byPath[path]) return` 保证 `byPath[path]` 存在 ⇒ `trailFor` **一定**会 push `path` 自己 ⇒ 循环里 `openPaths.push(path)` ⇒ 回到 `nodeClick` 时 `isOpen(n.path)` **恒真**,`!isOpen(...)` 恒假,`:305` 那一行**永远不执行**。
且 `n` 来自 `visibleNodes`(由 `treeRoots` 走出来,每个节点都在 `byPath` 里)⇒ `select()` 的早退也不会发生。
⇒ **结论与 T6 相同**,**照抄不删正确**(N58 同族)。**不按 Important 报。**

### ③ 走 `w.vm` 的兜底断言 —— **无一零判别力**,给 T7 的改黑盒清单如下
评审逐条探针:
- `vm.raw` / `vm.node`(N55 ①/③)→ **有判别力**(探针 N55-1 / N55-3 各报红对应那一条);
- `vm.showSource`(`:812-820`)→ **有判别力**(探针 Z1:删掉 `fetchArticle` 里 `showSource.value = false` → `1 failed`,红的正是它)。顺带证明 `<script setup>` 下 `w.vm.x = …` **写得进去**;
- `selName` 兜底(`:826-837`,`vm.byPath = {}`)→ **有判别力**(探针 Z2:`selName` 的 `: sel.value` 改成 `: ''` → `1 failed`,红的正是它)。

🔴 **T7 补完 markup 后该改成黑盒的清单**:
1. `:688-691`(N55 ①)`vm.raw` / `vm.node.aiLabel` → 改断 `pre.kw-rawsrc` 文本 / `.kw-summary` 渲染内容;`vm.sel` 现在就可以换成 `.kw-crumb .cur`;
2. `:736-738`(N55 ③)同上;
3. `:789-791`(N48 404)`vm.node/raw` 为 null → 改断 **`.kw-pending` 那屏出现**(蓝本 `:88-95`)且 `.kw-summary` / `.kw-rawsrc` 都不存在;
4. `:807-809`(K58)同 3;
5. `:812-820`(showSource 重置)→ 改断「切到源码视图后换文章 → `pre.kw-rawsrc` 消失、`.kw-summary` 回来」;
6. `:831`(`vm.byPath = {}`)**保留写入**(它是制造防御态的唯一手段,无渲染面可替代),读侧断言现已在 DOM 上,不动。

### ④ `onMounted` 的 `loadRoots()` 不传 `silent` —— **是蓝本行为,不是本刀引入**
评审读蓝本两处:
- `WikiView.vue:216` `if (!this.store.state.wikiRoots.length) this.store.actions.loadRoots()` —— **裸调**;
- `store/knowledgeStore.js:244-253` 的 `loadRoots` catch **无条件** `this.toast(i18n.t('Operation failed') + ': ' + (e.message || e))`。
⇒ 本机 `/v1/wiki/roots` 等满 60 s 超时后弹一次「操作失败」**是蓝本自己的行为**,T6 照抄正确;同期 `RootsView.vue:228` 的 `onMounted` 也是裸调,与本仓视图层既定做法一致。
🔴 **必须进验收清单** —— T6 报告 §13-6 只把它登记成「留给 T7 与终审的知情项」,**没有写「验收清单必须写明」**(对比同段 §13-5 的 D1 就写了)。⇒ **收官刀补一条**:「进 Wiki 页约 60 秒后会冒一次『操作失败』提示 —— 这是 D1(Wiki 库 38 GB + `SetMaxOpenConns(1)`)的连带,**与 Vue2 一致**,不是本期缺陷。」

---

## 5. 分级结论

### Critical —— **0**

### Important —— **1**

#### 🔴 I-1 · 「自动上膛」守卫的模板抽取器**锚错了起点**,导致 R19 的一个偏态失守 + 一条恒真填充断言

**事实(评审两条独立口径,承 R21)**
```
口径①  const i = SRC.indexOf("<template>")   → 字符偏移 3400 → 第 64 行
       该行原文: "    (放内部子元素上会编译告警/失效)⇒ 本文件 `:key=\"c.path\"` 写在 `<template>` 自身,"
口径②  [...SRC.matchAll(/<template>/g)] 的行号 = [ 64, 388 ]      (根模板真实起点 = 388)
       extractTemplate(SRC) 抽出 448 行(真模板只有 125 行)
       抽出块里含 "<script setup"                       → true
       抽出块里含 "const showSource = ref(false)"       → true
```
`WikiView.test.ts:937-943` 的 `extractTemplate` 用 **裸子串 `src.indexOf('<template>')`**(无列锚定),
而 `WikiView.vue` 的**文件头 HTML 注释第 64 行本身含 `<template>` 这个字面串**(K56 那段说明)。
⇒ 所谓「模板块」实际是**从第 64 行到文件末尾的 448 行**:含一段**开 `<!--` 已被切掉、因而剥不掉的头部注释残段** + **整个 `<script setup>`**。

**三条后果**

1. 🔴 **R19 的偏态「注释里写了 `kw-summary` 但没真 markup → 必须绿」在文件头注释这一侧失守。**
   评审探针:在**第 64 行之后的文件头注释**里加一句纯说明
   `【T7 提示】摘要区将写成 <div class="kw-summary kw-md" v-html="html"/>(仅注释,非真 markup)。`
   ```
   Tests  1 failed | 53 passed (54)
   × 🔴 本体条件断言:模板尚无 kw-summary ⇒ 惰性通过…;一旦写了则必须有 showSource 按钮
     AssertionError: expected false to be true
   ```
   ⇒ **纯注释假上膛并报红**。这正是 R19 / R26-3 家族的又一次复发,而且 **T7 极可能踩**:
   T7 续写摘要区时按本档文风一定会在文件头写「本刀搬了 `class="kw-summary kw-md"` …」。
   ⚠️ 这条报红的措辞会诱导下一刀去**放宽守卫**(§9.10 最要防的形态)。
   (模板内部注释那一侧**是绿的** —— 那段注释有完整 `<!-- -->`,能被剥掉。所以基线绿掩盖了这个缺口。)

2. 🔴 **`expect(/showSource/.test(TMPL)).toBe(true)`(`:994-998`)是恒真填充断言。**
   `TMPL` 含 `<script setup>` 里的 `const showSource = ref(false)` ⇒ 与「模板里有没有切换按钮」**完全无关**。
   守卫**真正干活的只有下一条**(`:1000` 的 `<button…showSource|@click="showSource`)——
   探针 d 之所以报红,红的是这一条,不是上一条。(承 R26 M-2「恒真填充断言」同族。)

3. **`防空转①`(`:949-961`)的断言文本「模板真的抽出来了」与事实不符**;
   `expect(TMPL).not.toMatch(/<!--/)` 之所以绿,只是因为残段的开 `<!--` 恰好被切在起点之前(孤儿 `-->` 不触发该正则)—— **绿得没有道理**。

**本仓已有正确写法可直接引用**:`knowledgeStyles.test.ts:1687` 那组用的 `extractTemplate` 是
**第 0 列锚定**(`^<template>` / `^</template>`)+ **两条独立推导(字符串 `lastIndexOf` vs 逐行倒扫)必须逐字相等** 的覆盖度自检 ⇒ 同一份 `WikiView.vue` 上它抽得**完全正确**。

🔴 **建议落法(评审给判据)**
- 抽取器改成**第 0 列锚定**(或直接照 `knowledgeStyles.test.ts` 那套);
- 补一条**反向防空转**:抽出块 **不许**含 `<script setup`(判据:改回裸 `indexOf` → 该条必须报红);
- `expect(/showSource/.test(TMPL))` 那条要么删、要么绑到**模板内**(判据:把 `const showSource = ref(false)` 从 script 里改名 → 该条必须**仍绿**,才说明它没在测 script);
- 把「文件头注释里写 `class="kw-summary …"` → 必须绿」做成**真实文件偏态**用例(不是合成串)。

**为什么不是 Critical**:守卫在「真写 markup 且没按钮」这条主路径上**仍然报红**(探针 d 实证),
且本刀零产品缺陷、三门全绿;失守的是**假阳性方向**与一条填充断言。
🔴 **但必须在 T7 开工前(或 T7 第一件事)闭合** —— T7 正是这条守卫的目标刀。

### Minor —— **6**

| # | 事 | 评审证据 |
|---|---|---|
| **M-1** | 报告 §10 写「`grep "Vue warn\|Vue Router warn\|No match found"` **全量日志零命中**」**不成立** | 评审全量 `--reporter=verbose` 日志实测:`[Vue warn]` **8853** 行、`[Vue Router warn]` **38** 行(`Failed to locate Teleport target ".knowledge-app"` / `Plugin has already been applied` / `No match found for location "/ai/knowledge"`)。🔴 **全部来自本刀未触碰的既有测试文件** —— `WikiView.test.ts` 单跑 **0 命中**,三份 T6 文件同跑 **0 命中** ⇒ **结论方向对(本刀零新增告警),陈述错**。既有噪声本身建议另开票 |
| **M-2** | 报告 §13-4 写「这是本文件**唯一**使用 `w.vm` 写入的地方」**不成立** | 实有 **两处**写入:`:815` `vm.showSource = true`、`:832` `vm.byPath = {}`。两处**均有判别力**(探针 Z1 / Z2 各报红 1 条),不影响结论 |
| **M-3** | `WikiView.test.ts:75` 的 `FIXTURE-COPY-BEGIN` 头写「只取 `normal` / **`crossLevel`** 两组」,实际**只抄了 `normal` 一组** | 文件里搜不到任何 `crossLevel` 抄本;`normal` 组抄本与 fixture **逐字节一致**(评审 `json.load` 对读)⇒ 只是头注释多写了一组 |
| **M-4** | `RootsView.test.ts:1327` 的注释「对照:同一时刻「添加」按钮**是 disabled 的**」与紧随的 `expect(addBtn.disabled).toBe(false)` **自相矛盾**;断言消息「应当是 disabled(canSubmit 为真但 submitting 为假?)」也与 `.toBe(false)` 反向 | 断言**本身是对的**(409 落地后 `submitting` 已归位 ⇒ 不 disabled);错的是注释与消息 ⇒ 会误导下一刀去「修断言」。建议顺手订正措辞(不动断言) |
| **M-5** | `WikiView.vue:44` 写「`data()` 的**十一**项页面级瞬态 → 本刀落其中**十**项」,口径未写明含不含 `store` | 蓝本 `data()` 共 **12** 个键(含 `store`),去 `store` 后 11 个,本刀落 10 个、`rescanBusy` 归 T7 —— 数字对得上但需读者自己推,建议写明「不含 `store`」 |
| **M-6** | `:style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"` 比蓝本少一对括号,而用例标题写「**逐字**照抄 `paddingLeft: (8 + depth * 14) + "px"`」 | 求值等价(`+` 左结合),实测断言 `8px/22px/36px` 全绿。措辞与实况有半格出入,**不返工** |

---

## 6. 是否可以进 T7

🟢 **可以** —— 产品码零缺陷、移植逐字忠实、三门全绿、§1 的三组必查项与两个追加项**全部经评审亲手报红坐实**。

🔴 **两个前置条件**:
1. **I-1 必须在 T7 落 `kw-summary` markup 之前闭合**(T7 正是这条守卫的目标刀,且极可能在文件头写下触发假报红的那句话)——
   建议照 T2b / T0b 先例,由 **T6b 一轮或 T7 的第一步**闭合,**不许以「守卫误报」为由放宽它**(§9.10 / R19)。
2. **§4-④ 的 60 秒「操作失败」toast 必须进验收清单**(现在只在报告 §13 里当知情项)。

**给 T7 的额外交接**:§4-③ 的 6 条「改黑盒」清单 · 分刀边界从蓝本 `:83` 起 · M-4 的措辞订正可顺手带上。
