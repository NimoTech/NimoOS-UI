# SP8-P5f · 全支终审(opus,2026-08-06)

**范围**:`6d67b7b`(P5f 起点)→ **`12f44d2`**(T8 评审)· 分支 `sp8-ai` · 工作目录 `.sp8/NimoOS-New-UI`
**结论**:**Critical 0 / Important 0 / Minor 4** → 🟢 **可交付验收**

> 🔴 本报告的每一条都配**我自己跑的命令 + 原始输出**。**没有采信任何实现者或逐刀评审的结论** ——
> 凡带 🔴 的复核项都独立重做了一遍。
> 🔴 **探针纪律**:全部 `cp` 备份 → 注入 → 跑 → `cp` 还原 → `md5sum` 逐字节自证。
> **全程零 `git checkout/restore/stash`,零 `amend/reset/rebase`,零部署,零 push,零合 master。**
> 🔴 **所有「报红」结论都核到了具名 failed 用例**(承 **R13**:只看退出码会把 Startup Error 误判成报红
> —— 本次真的撞上一次,见 §5.3)。

---

## 0. 收官六个数字 + 四门(**全部自跑,落盘,未 `| tail`**)

```
$ pnpm exec vitest run --reporter=verbose > vitest-full.txt 2>&1 ; echo $?
0
$ grep -E "Test Files|Tests +[0-9]" vitest-full.txt | tail -2
 Test Files  339 passed (339)
      Tests  4659 passed (4659)
$ grep -c "^ *× " vitest-full.txt      → 0      ← 具名 failed 用例 0
$ grep -c "^ *✓ " vitest-full.txt      → 4659   ← 与汇总行自洽(不是只信汇总行)

$ pnpm exec vue-tsc --noEmit ; echo $?                                        → 0(日志 0 行)
$ pnpm exec vite build ; echo $?                                              → 0(✓ built in 13.96s)
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null ; $?  → 0

$ find src -name '*.vue' | wc -l                                              → 188
$ grep -c "^ *✓ src/styles/color-guard.test.ts" vitest-full.txt               → 190(零非 ✓ 行)
```

🔴 **i18n 用真实模块导入计键数**(esbuild 打包 `zh_cn.ts`/`en_us.ts` 后 `node` 执行,**不是正则数行**):

```
zh_total 1727      en_total 1727
zh_minus_en []     en_minus_zh []
aiKb_zh 520        aiKb_en 520
aiKb_zh_minus_en []   aiKb_en_minus_zh []
```

| 口径 | 要求 | 我实测 | |
|---|---|---|---|
| 测试文件 | 339 | **339** | ✅ |
| 用例 | 4659 | **4659** | ✅ |
| `.vue` | 188 | **188** | ✅ |
| color-guard | 190 | **190** | ✅ |
| `aiKb*` | 520/520 | **520/520**,双向差集空 | ✅ |
| 全表 | 1727/1727 | **1727/1727**,双向差集空 | ✅ |

⚠️ 我在**全部探针做完之后**又跑了一遍全量(`vitest-final2.txt`):
`FINAL_EXIT=0 · 339 passed (339) · 4659 passed (4659) · 具名 failed 0`,
且 `git status --short` 为空、`md5sum -c md5-baseline.txt` 零非-OK 行
⇒ **9 组探针对工作树零残留**。

---

## 1. 🔴 U-2 蓝本锁复核(独立重做)

```
$ git -C ../../NimoOS-UI fetch git@github.com:NimoTech/NimoOS-UI.git main ; echo EXIT=$?
From github.com:NimoTech/NimoOS-UI
 * branch              main       -> FETCH_HEAD
EXIT=0
$ git rev-parse FETCH_HEAD
2608bf9b370b8b0c073f160177a8c0d496256075
```

| 文件 | 锁 `7a6ee6b7` | 远端 `2608bf9b` | |
|---|---|---|---|
| `src/views/AI/Knowledge/WikiView.vue` | `ad9b2073…` | 同 | ✅ SAME |
| `…/RootsView.vue` | `dc68c806…` | 同 | ✅ SAME |
| `…/AllowlistView.vue` | `b4294e00…` | 同 | ✅ SAME |
| `…/wikiViewHelpers.js` | `1b2c6026…` | 同 | ✅ SAME |
| `…/styles/knowledge.scss` | `10a418f5…` | `a0df1b09…` | ⚠️ DIFF |

`knowledge.scss` 的**全量 `diff` 只有一行**,且**是注释**、且**不在本期三个搬运段内**:

```
1675c1675
< /* ===== 已收录文件 · Indexed Files page (from Claude Design "Nimo Knowledge") ===== */
---
> /* ===== Indexed Files page (from Claude Design "Nimo Knowledge") ===== */
```

⇒ 🔴 **非注释差异 = 0。锁 `7a6ee6b7` 继续有效,无需 `NEEDS_CONTEXT`。**
(段边界 `:985-1141` / `:1342-1396` / `:2453-2561` / `:1500-1503` 均离 `:1675` 有距离。)

---

## 2. 跨刀一致性(逐刀评审看不到的第①类)

### 2.1 三个新 `.vue` 是否同源 —— ✅ **同源**

**reka Dialog(K57)三处 + `SettingsView` 的 K29 先例 = 同一套**,逐字比对:

```
AllowlistView:422-425  DialogRoot :open=… @update:open=… / DialogPortal to=".knowledge-app" defer
                       / DialogOverlay class="k-modal-bg" / DialogContent class="k-modal" :aria-describedby="undefined"
                       + <DialogTitle as-child> 套在蓝本自己的 .k-modal-title 上
RootsView:417-420      同上(新增弹窗)
RootsView:512-515      同上(删除确认弹窗)
SettingsView:580-583   同上(K29 先例,唯一差别是多一个 style="width: min(460px,100%)")
```

四处的元素序列、`to`/`defer`/`class`/`:aria-describedby` 完全一致,
`<DialogTitle as-child>` 都套在蓝本自带的 `.k-modal-title` 上(**没有一处退化成 `VisuallyHidden`**)。
**零 `@click.stop` 残留**(K57-② 落地)。

**toast 一律 `store.toast(...)`** —— 三页零 `useToast()` 直调:

```
$ grep -rn "useToast" src/ai/knowledge/views/{AllowlistView,RootsView,WikiView}.vue
(仅注释里解释「为什么不直调」,零代码调用)
AllowlistView 10 处 · RootsView 7 处 · WikiView 3 处,全部 store.toast(
```
⚠️ 同目录 `NotesView.vue`(P5d)是**直调 `useToast().show(msg, 2400)`** —— 那是 P5d 的既定形态、
显式带了 2400ms,**不是本期引入的不一致**,不计为缺陷。

**K58 错误映射 = 唯一一套「形态 A」**(catch 只弹固定 i18n 键,不回显 `e.message`):

```
AllowlistView: t('aiKbAlSaveFailed') / aiKbAlAddFailed / aiKbAlDeleteFailed   ← 全固定键
RootsView:     httpStatus(e)===404 ? t('aiKbRtBackendTooOld') : t('aiKbOpFailed')
WikiView:      t('aiKbOpFailed')
```
`RootsView` 的 `httpStatus(e)` 是**状态码提取**(N50 的 409 / N51 的 404 需要它),
**不是第二套错误→文案映射**;全仓 `e.response.status` 的其它取法只在 P2/P3 期的
`ConfirmCard/McpInstallCard/PermissionRequestCard` 里(别的域,先于本期)。
⇒ 🔴 **没有第二套 K58 映射。**

### 2.2 `util/wikiViewHelpers.ts` 有没有第二份拷贝 —— ✅ **没有**

```
$ grep -n "function baseName\|function buildWikiTree\|function trailFor\|function opToType\
|function parseTs\|function rootForPath\|function renderWikiMarkdown\|function findParent" \
  src/ai/knowledge/views/*.vue src/ai/knowledge/components/*.vue
(零命中)
$ grep -rn "wikiViewHelpers" src/ --include=*.vue
WikiView.vue:204  } from '../util/wikiViewHelpers'
WikiView.vue:205  import type { WikiViewTreeNode } from '../util/wikiViewHelpers'
```
唯一消费者 `WikiView.vue` 走 import,**组件里零重写**。

### 2.3 本期新键死键核查(🔴 自己重跑,用 `/usr/bin/grep`)

```
$ 从 git diff 6d67b7b..12f44d2 -- src/i18n/zh_cn.ts 提取新增键 → 79 个
$ 同法从 en_us.ts 提取 → 79 个,diff 两份清单 → ZH/EN NEWKEYS IDENTICAL
$ for k in <79 个>; do /usr/bin/grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ \
      | grep -v '^src/i18n/' | grep -v '\.test\.ts$'; done
TOTAL_DEAD=0
```
🔴 **死键 0/79。** 键数账与 **R10 / R3** 完全对上(**新增 79**)。
词干分布:`aiKbAl` **35** + `aiKbRt` **22** + `aiKbWk` **20** + 跨页共用 2(`aiKbAdd` / `aiKbRescanStarted`)= **79**。

**既有键零改动**:`git diff` 在 `zh_cn.ts` 与 `en_us.ts` 上**各自零删除行** ⇒ **11 个复用键一个字未动**。

🔴 **值的权威性我也独立验了一遍**(P5d C-1 的复发面):

```
79 个新键的 zh 值,在蓝本 zh_CN.json 的值集合里找不到逐字同值的:0
79 个新键的 en 值,不在「en_US.json 覆盖值 ∪ zh_CN.json 的 key」里的:0
占位符集合 = ['ext','group','h','n','path','t'](= 6,与 R10 一致);zh/en 占位符不一致的键 0
en 值里含全角标点的键:0
```
**「不进 i18n」的两类也没被顺手 i18n 化** —— `kw-sec-en` 两处与蓝本 `:101` / `:123` 逐字相同:
```
WikiView.vue:684  <span class="kw-sec-en">Contents</span>
WikiView.vue:707  <span class="kw-sec-en">Recent changes</span>
```

### 2.4 🔴 「78 个新类有多少零断言钉住」

**先把账算平**(自己程序化算,不信任何报告):

```
剥注释后扫 knowledge.scss(现役正则):旧档 347 类 / 新档 424 类 / 净新增 77
  净新增 = 41 个 kw-*  +  9 个 kr-*  +  27 个其它 k-*
本期新出现但早已在 WHITELIST_348 里的类:[]      ← 零重复搬,零「白名单已有却又搬一遍」
WHITELIST_348 → WHITELIST_425(数组实测 425 项,零重复)
NON_K_HELPER_CLASSES 实测 20 项,末项 = 'cur'
```
⇒ **78 = 77(进白名单)+ 1(`cur`,非 k* 前缀 ⇒ 进 `NON_K_HELPER_CLASSES`)**,
与 R10 的「69 + 9 = 78」**完全自洽**(69 = 27 + 41 + `cur`)。**账没有错。**

**再回答「零断言钉住」**:

| 层 | 覆盖 |
|---|---|
| 「425 个白名单类**全部有对应规则**」 | **77/77** —— 每个新类**存在性都被钉住**(删掉规则 → 精确指名报红) |
| 「没有搬多」+「严格超集自证」 | **77/77** —— 多搬/漏登记都报红 |
| 另有**组件层 DOM 断言**点名 | **66/77** |
| 只靠白名单成员资格(无 DOM 层点名) | **11/77** |

那 11 个是:`k-ext-chips` `k-extgroup-head` `k-frow-root-icon` `kw-article` `kw-child-body`
`kw-child-chev` `kw-head` `kw-pending-orb` `kw-sec-head` `kw-split` `kw-tree`。
🔴 **我逐个查了它们在模板里的真实使用**,**11/11 全部真被消费**(1~4 处不等)⇒ **零死类**。
⇒ **「搬进来了但零断言钉住」= 0**;那 11 个只是缺 DOM 级点名,记为 **Minor M-2**。

---

## 3. 🔴 「产品代码对、守卫为零」最后一遍扫(第③类)

**九组探针,全部 `cp` 还原 + `md5sum` 逐字节自证。**

| # | 我改坏了什么 | 结果 | 判定 |
|---|---|---|---|
| **P1** | `knowledgeStyles.test.ts` 的**现役** `CLASS_SCAN_RE_SOURCE` 窄回 `k(?:2\|n)?-` | **1 failed**:`严格超集自证 —— 现役正则…是 P5e 现役正则的严格超集`;**「没有搬多」仍绿** | ✅ **R20 I-2 的修法真绑定了现役正则**,且报红形态与评审描述的缺口形态完全一致 |
| **P2** | 删掉 `@media (max-width:860px)` 内的 `.k-frow` 块 | **1 failed**:`K60 … 既有 @media 块内含 .k-frow 的窄屏列宽覆盖(删掉 → 报红)` | ✅ K60 有牙 |
| **P3** | `setRootEnabled` 的 `root.enabled = enabled` **挪到 `await` 之后**(= R9 的字面判据) | **63/63 全绿** | ✅ **E-76 成立**,R9 字面判据**零判别力** |
| **P4** | `setRootEnabled` 改成**整体替换数组**(= R25 的真判据) | **4 failed**:R9 两条方向断言 + 失败路径不弹成功 toast + R27 toast 落点 | ✅ **守卫钉在正确的轴上** |
| **P5** | `findParent` 换成「最长字符串前缀、不做 `/` 边界判断」 | **4 failed**(`/DATA/MediaBackup` 的父是 `/DATA`;`/a` 与 `/ab`;父缺位不攀附兄弟;真子目录仍挂对) | ✅ **R22 已闭合** |
| **P6** | `AllowlistView.toggle()` 的 catch 回显 `e.message` | **2 failed**(两侧 chip 各一条) | ✅ **R24 已闭合** |
| **P7** | 去掉 `RootsView.submit()` 的 `submitting` **函数门** | **1 failed**:`双击镜像按钮:submitting 函数门挡住第二发` | ✅ **R27 已闭合**(走无 `:disabled` 的镜像按钮,不是点 disabled 元素) |
| **P8** | 摘除模板里 `showSource` 切换(保留 `kw-summary`) | **5 failed**,含 `自动上膛守卫:模板出现 kw-summary ⇒ 必须同时有 showSource 切换按钮` 本体 | ✅ **R28 已闭合且已上膛** |
| **P9** | `GROUPS_TEMPLATE` 的 `bg: 'var(--grad-ext-docs)'` → 注入 hex 渐变 | **4 failed**(T2b 的 M-a 自动上膛 1 条 + T4 的 K55 定向断言 3 条);🔴 **`color-guard` 190 条一条不响** | ✅ **K55「唯一防线」实证成立**,M-a 已上膛 |

**另三组「自动上膛/参数化守卫是否真上膛」**:

| # | 探针 | 结果 |
|---|---|---|
| **P10** | `WikiView.vue` 的两处 `'../util/wikiViewHelpers'` 改成 `…XX` | `wikiViewHelpers.test.ts` **1 failed**:T3 的条件断言本体 ⇒ ✅ 已上膛 |
| **P11** | 往 `RootsView.vue` 尾部追加一个真 `<style lang="scss" scoped>` 块 | **5 failed**(K44 参数化本体 + K44 加固自证 + K53 三条)⇒ ✅ **R19/C-1 的偏态 B(真 style 块 → 红)成立** |
| **P12** | 偏态 A(零 style 块但注释里写「零 style 块」字面串) | **现状即偏态 A**:三页文件头都写着这句,而 K44 全部**绿** ⇒ ✅ 偏态 A 成立 |

**T8 侧**:

| # | 探针 | 结果 |
|---|---|---|
| **P13** | `isDeferred` 硬编码 `return false` | **1 failed**:`isDeferred 的判定来源是 DEFERRED_TABS 本身(清单已空:用临时非空清单证明机制仍能判真)` ✅ |
| **P14** | 三条子路由**各自**改回 `KnowledgeDeferred` | **各 1 failed**,报错逐条具名:`expected {__name:'KnowledgeDeferred'} to be {__name:'WikiView'/'RootsView'/'AllowlistView'}` ✅ **三条各自独立报红** |

**构建管线门(JS 侧,上下文感知)**:
```
$ grep -o '__name:"WikiView"\|__name:"RootsView"\|__name:"AllowlistView"' dist/assets/*.js | sort | uniq -c
      1 __name:"AllowlistView"     1 __name:"RootsView"     1 __name:"WikiView"
$ grep -c 'kw-split' dist/assets/*.js  → 1
```
`__name:"X"` 是 `defineComponent` 的编译产物,**只可能来自真实编译进 JS 的组件**(压缩产物零注释)。

### 3.1 🔴 我自己新猎到的一处(Minor M-1)

**N57 的 `router.replace(...).catch(() => {})` 零守卫。**

```
探针:把 WikiView.vue:421 的 `.catch(() => {})` 整个去掉
$ pnpm exec vitest run src/ai/knowledge/views/WikiView.test.ts --reporter=verbose
EXIT=0 ; 具名 failed 0 ; Tests 101 passed (101)
```
**产品代码是对的**(N57 明令照抄),但**删掉它 101/101 全绿** —— 「产品代码对、守卫为零」家族在本期的**第 7 次**。
🔴 **杀伤面评估**:Vue Router 4 对**重复导航**是 resolve 一个 `NavigationFailure`(**不 reject**),
只有导航守卫抛错才 reject ⇒ 删掉后的真实后果是「守卫抛错时多一条 unhandled rejection」,
**不产生用户可见的错误行为** ⇒ 定 **Minor**,不阻塞验收,登记债务 **D-12** 转下一期。

### 3.2 一处「看似缺口、实则由编译器把关」(不是缺陷,登记备查)

```
探针:把 K56 的 :key 从 <template v-for> 挪回蓝本 Vue2 写法(button/span 各带 key)
$ pnpm exec vitest run src/ai/knowledge/views/WikiView.test.ts --reporter=verbose ; echo $?
1
$ grep -c "^ *× "  → 0        ← 🔴 零具名 failed!
$ grep -iE "error" → SyntaxError: <template v-for> key should be placed on the <template> tag.
```
🔴 **这正是 R13 点名的那个坑**:退出码 1 但**没有任何用例报红** —— 是 **Startup Error**,不是「报红」。
结论:**K56 由 Vue 3 编译器强制,不需要额外守卫**;
同时**本次终审自己撞了一次这个坑并按 R13 识别出来了**,可作为该纪律的又一条实证。

### 3.3 我另外验过、**守卫充分**的四处(不构成缺陷,列出以证覆盖)

| 探针 | 结果 |
|---|---|
| 去掉 `RootsView.openAdd` 的 `fb.value?.reset()` | **1 failed** ✅ |
| `createRootBody` 的 `scanIntervalH` 焊死 24 + `mirror` 焊死 false(N46 静默丢弃面) | **3 failed** ✅ |
| 去掉 `WikiView.changes` 的 `.slice(0, 10)` | **1 failed** ✅ |
| 摘除 `showSource` 切换(P8 顺带) | `fetchArticle` 每次重置 `showSource=false` 那条**也红** ✅ |

---

## 4. 债务与遗留项完整性(第④类)

### 4.1 `p5e-handoff-to-p5f.md` 的 11 条 —— **逐条有交代** ✅

| # | 债务 | 本期处置 | 我的核实 |
|---|---|---|---|
| **I-1** | `runSearch` 的 `topK`/`rerank` 零守卫 | **T1b 补** | `SearchView.test.ts` 本期 **+97 行**,`git diff` 零删除行 ✅ |
| **M-1** | `loadChunkContext` 的 `window: 2` | **T1b 补** | 同上文件 ✅ |
| **M-2** | `highlight` 的 `>= 1` 长度门 | **T1b 补**;「下一侧」两条零判别力 → **R18f 保留不返工**,登记 **D-10** | `searchAggregate.test.ts` **+58 行**,零删除 ✅ |
| **M-3** | 祖先链守卫不含 `#app` | 🟢 **不做,并入票 B**(治理 §一 表已登记) | 已落盘 ✅ |
| **M-4** | `messageSyntax.test.ts` 旧理由被 R13 作废 | **T1b 补订正注释** | `messageSyntax.test.ts` 本期 +463 行 ✅ |
| **M-6** | `KFileViewer` 用 `props.file` | 🟢 **不做**(零改动清单上) | 已落盘 ✅ |
| **D-4** | 键只有存在性断言 | 继续挂账;**T1 已把口径订正为 53/79**(R17/R24) | 已落盘 ✅ |
| **票 3c/3e/D-6/A-8/clipboard** | 继续挂账 | 引 `p5d-handoff-to-p5e-p5f.md` ✅ |
| **`openNoteInNewTab`** | **仍无调用点 ⇒ 继续不补** | T8 §DoD-10 给了**四条独立口径**(`grep -rnw` / export 清单 / `git grep -l`)✅ |
| **4 张后端票 + A-1/A-2/A-3** | 继续挂账;**A-1 已从 4 张变 5 张** | 裁定书 §四 已更新 ✅ |
| **Wiki 数据库运维票(D1)** | 继续挂账 | 裁定书 §四 ✅ |

### 4.2 本期**新登记**的债务 —— **全部落盘** ✅

| 编号 | 内容 | 落盘处 |
|---|---|---|
| **D-10** | `highlight` 长度门的「下一侧」缺一条真有判别力的用例 | 裁定书 **R18f** |
| **D-11** | reka `DialogPortal` 的 `defer` 零判别力(全仓 reka 用法共性) | 裁定书 **R24 Minor M-2** |
| **票 E** | **未分组扩展名在白名单页上完全不可管理** | 裁定书 **§四** + T0/T0b/T4 报告 |
| 🔴 **D-12(本终审新开)** | **N57 的 `.catch(() => {})` 零守卫** | 见 §3.1,**本报告首次登记** |

⚠️ 另有一条**未编号**的口径债务(T2b 自己申报、我复核属实):
`nonKClassNames()` 的排除前缀 `/^k(?:2|n|r|w)?-/` 与 `CLASS_SCAN_RE_SOURCE` **是两份独立正则**,
两处口径一致性靠人工维持。**方向安全**(窄回排除前缀只会让「未登记的非 k* 类」变多 = 报红),
不构成缺口,但建议下一期合成一份。

---

## 5. 🔴 协调者裁定的复核结果(**逐条**)

| # | 裁定 | 我的独立复核 | 结论 |
|---|---|---|---|
| **R1** | 方案 B(`WHITELIST_425` / `NON_K` 20,扩 `NEW_RE` 加 `kr-`/`kw-`) | 白名单实测 **425 项零重复**;`NON_K` 实测 **20 项**末项 `cur`;净增量**实测 50 = 41 kw + 9 kr**,`gained.every(kw-\|kr-)` 断言在档;🔴 **`:297-305` 那条自证已不是空壳** —— 探针 P1 窄回**现役**正则 → 自证**报红**、「没有搬多」**仍绿**,正是 I-2 描述的缺口形态被真正堵住 | 🟢 **成立**,判据全部兑现 |
| **R2 / K60** | 只搬 `:1500-1503` 一个 `@media` 块 + 订正 P5b 三处注释 | 蓝本 `:1500-1503` 我逐行读过 —— **内部只有 `.k-frow` 的 `grid-template-columns` 与 `font-size`,零其它类**;本仓落位在**既有** `@media (max-width:860px)` 内、蓝本原序位置;订正共 **4 处**(`:112` `:1880` `:1920` `:1967`),**原文一律保留 + 新增订正块**(守「反转不删」);断言锚定正确(探针 P2 报红);另一条 `R2-①` 断言钉住「没顺带搬 `.k-status-strip`」 | 🟢 **成立** |
| **R8 / E-73** | `--bg-tertiary → --bg-chip` 是**可见变化不是等价替换** | T2 报告 §4.2 表头逐字写「🔴 **可见变化,不是等价替换**」,并显式禁引 K54-③ 那句;§8-5 再强调一次「验收清单必须写,否则机主会当 bug 报」 | 🟢 **T2 如实写了**;🔴 **验收清单尚未产出**(见 §7) |
| **R9 / R25 / E-76** | `toggle()` 不是 bug;R9 原判据错,真轴是「整体替换数组」 | 🔴 **我独立推演**:`setRootEnabled` 在 `await` 前乐观写 `root.enabled`,`v-for` 的 `r` 与 store 里 `find` 到的**是同一对象引用** ⇒ toast 读到新值,方向正确;失败路径回滚 + `throw` ⇒ 成功 toast 不执行。**与 R9 结论一致。**<br>🔴 **两个判据都跑了**:R9 字面判据 → **63/63 全绿**(零判别力,E-76 成立);R25 真判据 → **4 failed** | 🟢 **完全一致,无 Important 可报**。⚠️ **一处数字修正**:R25 记「3 条 RED」,我实测 **4 条**(多一条「失败时不弹成功 toast」)—— **方向相同、判别力更强**,记 Minor M-3 |
| **R19** | T2 的 `<style>` 申报被驳回;T2b 整改 | 🔴 **两种偏态各验一次**:偏态 A(零 style 块 + 注释含「零 `<style>` 块」字面串)= **现状,K44 全绿**;偏态 B(真 style 块)= 探针 P11 **5 failed**。`K44` 已扩成 `src/ai/knowledge/**` **全体参数化**,并自带「防空转①(目录非空)/②(正例取自全仓 115 个真有 style 块的 `.vue`)/加固自证(旧裸子串谓词命中 > 0 而新谓词命中 0)」 | 🟢 **C-1 真闭合** |
| **R22** | `buildWikiTree` 同名开头兄弟目录 → T6 | 探针 P5 **4 failed**;`git diff 6cc1c22 4c4671b -- wikiViewHelpers.test.ts` = **+120 / −0**(既有零改动);`wikiViewHelpers.ts` 产品码本期**零改动** | 🟢 **成立** |
| **R24** | K58 `toggle()` catch 零守卫 → T5 | 探针 P6 **2 failed**;`git diff 58541f3 227a43c -- AllowlistView.test.ts` = **+54 / −2**,那 **2 行删除**逐字核实是 **R24 Minor M-1 授权的「9 → 10」describe/it 标题订正**,**断言体一行未动** | 🟢 **成立**(两条指令的表面张力由 M-1 明文授权解开) |
| **R27** | `submitting` 门零判别力 → T6 | 探针 P7 **1 failed**,用例走的正是**无 `:disabled` 的「以镜像模式添加」按钮**;`git diff 227a43c 4c4671b -- RootsView.test.ts` = **+100 / −0** | 🟢 **成立** |
| **R28** | `extractTemplate` 裸 `indexOf` → T7 开工前置 | 现役实现:**第 0 列锚定**(`'<template>\n'` 且前面是行首/`\n`)+ **两条独立推导**(字符串 vs 逐行倒扫)逐字相等 + **尾部 3 行**覆盖度自检 + **反向防空转**(抽出块不许含 `<script setup` / `const showSource = ref(`,并配「文件里真有这两个串」的防空断言);两种偏态在测试里各有一条**真实文件构造**的用例;探针 P8 证明本体已**上膛且有牙**(5 failed) | 🟢 **只加固未放宽** |
| **R6 / 票 E** | `.wps` 不属任何分组 ⇒ 只显示 44/45 | 🔴 **我自己算了一遍**:三张表 **12 + 13 + 25 = 50** 项(蓝本与本仓**逐字同序**);拿 `.REAL` 的 **45** 条比对 → **三组命中 11 / 12 / 21 = 44**,**未分组的恰好只有 `.wps` 一条** | 🟢 **R6 的 11/12/21 与「44/45」全部实测坐实**;守卫在档(`toBe(12)/toBe(13)/toBe(25)` + 空组不渲染);🔴 **验收清单必须写**(见 §7) |
| **T8 机制钉子改写** | `DEFERRED_TABS[0]` 触发 TS2493 ⇒ 改临时非空清单 | 🔴 **独立复核 = 加固**:① 原文断的是「清单第 0 项判真」,清单空后该前提**永远不成立**(`readonly []` 上取 `[0]` 是 TS2493,**类型层就不可写**),不是「改弱」而是「原写法已无法表达」;② 新写法**保留**了原有的 `notListed` 两条,**另加**「塞进去必须判真 + 别的仍判假 + 用完清空 + 还原自证」= 从「单点判真」升级成**成员语义**;③ 探针 P13 实证 `isDeferred → return false` **必报红** | 🟢 **是加固不是放宽** |
| **R13**(常驻) | 「没看到 ≠ 不存在」/ 只看退出码会误判 | 本终审**自己撞上一次**(§3.2 K56 探针:exit 1 但零具名 failed = SyntaxError)并按该纪律识别 | 🟢 **纪律有效,已再次实证** |
| **R21**(常驻) | 推翻既有结论须两条独立口径 | 本报告凡推翻/修正处(R25 的 3→4、`.wps` 的 44/45、78 vs 77 的账)均给了**程序化实测 + 原始输出** | 🟢 |

---

## 6. 分级发现

### Critical — **0**

### Important — **0**

### Minor — 4

**M-1 · N57 的 `.catch(() => {})` 零守卫(「产品代码对、守卫为零」家族第 7 次)**
证据见 §3.1(去掉后 101/101 全绿)。产品码正确,杀伤面小(VR4 重复导航不 reject)。
**处置建议**:登记 **D-12**,下一期补一条「`router.replace` 的返回值被 `.catch` 吞掉」断言。**不阻塞验收。**

**M-2 · 11 个新类只有「白名单 + 有对应规则」层的钉子,无 DOM 级点名**
清单见 §2.4。**11/11 在模板里真被消费**(零死类),存在性也已被钉住 ⇒ **不是缺口,是覆盖颗粒度**。
**处置建议**:不返工。若下一期做「类→消费点」全仓映射守卫,把这 11 个一并纳入。

**M-3 · 裁定 R25 记「3 条 RED」,实测 4 条**
我的探针另打红「失败时不弹成功 toast」。**方向相同、判别力更强**,只是裁定书的数字偏保守。
**处置建议**:下一期引用 E-76 时按 **4 条**写,免得下游照 3 条复跑后困惑。

**M-4 · `nonKClassNames()` 的排除前缀与 `CLASS_SCAN_RE_SOURCE` 仍是两份独立正则**
T2b 已自行申报并论证**方向安全**(窄回排除前缀只会多报红,不会静默失守),我复核属实。
**处置建议**:不返工,记为口径债务,下一期合成一份。

---

## 7. 🔴 三样收尾

### ① 是否可交付验收 —— 🟢 **可以,零阻塞**

- 四门全绿并自跑落盘(**339 / 4659 / tsc 0 / build 0 / sass 0**,具名 failed **0**);
- 六个收官数字**全部自测吻合**(339 / 4659 / 188 / 190 / 520-520 / 1727-1727,差集均空);
- U-2 蓝本锁**逐字节复核有效**(唯一差异是一行注释,且不在搬运段内);
- **14 组探针**证明本期新增守卫**全部有牙**,四个派工缺口(R22/R24/R27/R28)**逐个闭合且既有零改动**;
- 「产品代码对、守卫为零」再扫**只剩 1 处 Minor**(N57),杀伤面小;
- 债务 11 条**逐条有交代**,新债务 3 条**已落盘**(另加我新开的 D-12);
- 探针全部 `cp` 还原,`git status` 空、`md5sum -c` 零非-OK,**工作树零残留**。

🔴 **但交付前协调者还欠两份文件**(计划书 §2-3 / §2-5 明列,**不是代码缺陷**):
1. **`p5f-acceptance-checklist.md` 尚未产出**(目录里只有 p2a/p2b/p5b/p5c/p5d/p5e 的);
2. **`p5f-handoff-to-<下一期>.md` 尚未产出**(D-10/D-11/D-12/票 E 目前只散落在裁定书里)。

### ② 协调者裁定的复核结果 —— 见 §5 整表

**13 条逐条复核,13 条全部成立**,零推翻。
唯一修正是 **R25 的「3 条 RED」应为 4 条**(方向一致、判别力更强,记 Minor M-3)。
🔴 **R9 我做了独立推演,结论与协调者一致 ⇒ 无 Important 可报**;
🔴 **两个判据都实跑了**:R9 字面判据 63/63 全绿(E-76 坐实)、R25 真判据 4 红。

### ③ 三份附录的可信度 —— 🟢 **T0b 整改后可信,下游可用**

我抽查了三份附录**争议之外**的各节,**没有发现同类错**:

| 抽查项 | 附录说法 | 我的独立实测 | |
|---|---|---|---|
| 附录 B §B.5 三行(**曾连错三行**) | R27 定案 `Allowlist 8 · Roots 7 · Wiki 9` | 我从蓝本模板(第 0 列锚定抽 `<template>` + 先剥注释)自己数:**8 / 7 / 9** | ✅ 终值正确 |
| 附录 B §B.0 A 段色字面量 | T0b 订正为 **5 处** | 与 T0b 逐行输出一致(`transparent` 是关键字不算、`:1112` 是 `white-space` 假阳性) | ✅ |
| 附录 B §B.0.1 Wiki 段 | **0 处**(6 行全是 `white-space` 假阳性) | 复核成立;**R11「色扫禁 `\bwhite\b`」是对的** | ✅ |
| 附录 D §D.3.2 扩展名表 | **12 + 13 + 25 = 50** | 我从蓝本 `:158-166` 程序化数:**12 / 13 / 25** | ✅ E-74 正确 |
| 附录 D §D.0 的 **69 + 9 = 78** | 与 R10 一致 | 我程序化算:白名单 **+77**、`NON_K` **+1**(`cur`)= **78**;且**零重复搬** | ✅ 账平 |
| 附录 A 的 zh/en 值 | 「90/90 逐码点零自译」 | **79 个新键的 zh 值 100% 逐字来自蓝本 `zh_CN.json`;en 值 100% 落在 `en_US.json` 覆盖值 ∪ JSON key** | ✅ |
| 附录 A 占位符 | 6 个 | 实测集合 `{ext, group, h, n, path, t}` = **6**,zh/en 零不一致 | ✅ |
| 附录 A「不进 i18n」两类 | `kw-sec-en` 的 `Contents` / `Recent changes` | 本仓与蓝本 `:101`/`:123` **逐字相同**,未被顺手 i18n 化 | ✅ |
| R6 的真机命中 | **11 / 12 / 21**,`.wps` 未命中 | 拿 `.REAL` 45 条实算:**11 / 12 / 21**,未分组恰好 `.wps` 一条,页面 **44/45** | ✅ |

🔴 **结论:三份附录在 T0b 整改后已被我从多个独立口径交叉验证,下游可以信。**
⚠️ **但保留一条常驻提醒**:附录 B §B.5 **一张表连错三行**是本期最贵的一次事故,
下一期沿用「**不许采信附录的任何计数,一律自己现数**」这条纪律(R26-2 / R27 已入账)。

### 🔴 给验收清单的补充项(我查出来、协调者可能不知道的)

> 前 5 条是协调者已知的(R6 / R8 / T6-④ / E-64 / D1),我复核后**确认必须写**;
> **第 6–9 条是本终审新增的**。

1. **`.wps` 那一条(票 E)** —— 「索引范围」页只显示 **44** 个扩展名,而 Parser 认 **45** 个。
   `.wps` 不属于文档/文本/代码三组中任何一组 ⇒ **既显示不出也开关不了**。
   🔴 **这是 Vue2 蓝本行为(N54),不是本期缺陷**,请不要当 bug 报。
2. **索引根页的小徽标底色(R8 / E-73)** —— 「实时监视 / 仅定时扫描」那个 chip 的底色采用本仓
   `--bg-chip` 语义 token,与蓝本的中性灰 12% **不完全同值**。**这是可见变化,不是等价替换**,请顺带看一眼。
3. **Wiki 页会冒一次「操作失败」toast(T6 顾虑④ / D1 连带)** —— `loadRoots` 不传 `silent` 是蓝本行为;
   本机 Wiki 库 38 GB 导致 `/v1/wiki/roots` 60 秒后超时 ⇒ **必然冒一次**。**不是本期缺陷。**
4. **「以镜像模式添加」按钮点了不会生效(E-64 / N50)** —— `storage_mode=mirror` **后端从未实现**,
   界面按 1:1 照抄。**不是本期缺陷。**
5. **Wiki 与 Roots 两屏本机大半不可达(D1)** —— 只做界面走查;
   **`AllowlistView` 是唯一可真机验的整页,且整页都是写操作**,逐项需标恢复步骤。
6. 🔴 **新增 —— 左栏那一项中文叫「索引范围」不叫「白名单」**(`aiKbNavAllowlist`)。
   T8 报告 §294 已点出,但**验收清单若写「白名单」,机主会在左栏里找不到入口**。
   建议清单原文写:`/ai/knowledge` 左栏**第 8 项「索引范围」**(wiki=3 · roots=7 · allowlist=8,rail 序号我未现测,以 R10/T8 实测为准)。
7. 🔴 **新增 —— 三屏可直接粘贴的深链**(便于机主绕开导航直达):
   `…/app/#/ai/knowledge/wiki?path=<某个 root 路径>` · `…/#/ai/knowledge/roots` · `…/#/ai/knowledge/allowlist`。
   ⚠️ **`?path=` 深链有两半**(初始选中 + 挂载后改地址栏),**请务必两半都点** ——
   「改地址栏 query 但不刷新页面,左树选中是否真的跟着跳」是 N56 的核心行为,
   本仓有守卫(记忆 `newui-router-query-only-no-remount`),但**只有真机能证明 hash 路由下也成立**。
8. 🔴 **新增 —— 窄屏(< 860px)那一档要单独看一眼**(K60 / 裁定 R2)。
   本期**额外**搬了一个 `@media` 块专门修「索引范围」页文件夹规则表格在窄屏下的列宽。
   **把浏览器窗口拖窄到 800px 左右**,看那张表的四列是否与 Vue2 一致 ——
   这是本期唯一一处**只在窄屏才可见**的改动,宽屏下走查 100% 看不到。
9. 🔴 **新增 —— 弹窗内的错误提示不要在 toast 里找**(K59 / 记忆 `newui-dialog-error-not-toast`)。
   「新增索引根」失败时(尤其 **409 重复路径**),错误文案出现在**弹窗内部**(`.kr-error` 行内块)+
   一个「以镜像模式添加」按钮,**不会弹 toast**。
   验收时若只盯右下角 toast,会误判成「点了没反应」。

---

## 8. 终审自身的口径与纪律自证

- 🔴 **凡从源文件「抽一段」或「判存在」,一律第 0 列锚定 + 先剥注释**:
  §5 的 `.k-frow` 注释订正核实、§2.4 的类差集、附录 B §B.5 的模板计数,**全部先剥块/行注释**;
  剥块注释器**要求 `/*` 前是空白或行首**(承 R26-3 的路径字面量坑)。
- 🔴 **`grep` 一律 `/usr/bin/grep`**(本 shell 的 `grep` 是 gitignore-aware 包装,会静默跳过 `.superpowers/`)。
- 🔴 **`pnpm test --reporter=verbose` 会被 pnpm 吃掉** —— 全程用 `pnpm exec vitest run --reporter=verbose`,
  日志 **19055 行**(不是 13 行),未 `| tail`。
- 🔴 **探针还原一律 `cp` + `md5sum`**,**零 `git checkout/restore/stash`**;
  最终 `git status --short` 为空、`md5sum -c md5-baseline.txt` **零非-OK 行**、全量复跑 339/4659 全绿。
- 🔴 **分段落盘**:过程笔记落在 scratchpad `notes-1.md` + 14 份探针日志,全程无重跑损失。
