# SP8-P5f · Task 8(收官刀)独立评审

> 评审者:独立 agent(opus)。**未采信 T8 报告的任何结论**,每一条都自己动手复核。
> 被审提交 **`8792830`**,起点 **`2119712`**,工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。
> **零部署 · 零 push · 零合 master · 零 `git checkout/restore/stash/reset/rebase/amend`。**
> 全部探针一律 `cp` 备份 → 行首锚定注入 → 先证注入落盘 → 跑 → `cp` 还原 → `md5sum` 逐字节比对。
> 评审结束时 `git status --short` 为空、`git diff --stat` 为空。

## 结论

| 级别 | 数 |
|---|---|
| **Critical** | **0** |
| **Important** | **0** |
| **Minor** | **7** |

🟢 **可以进全支终审。**

---

## 1. 🔴 第一必查项(计划书指定)—— 我自己重做的四项

### 1.1 构建管线门:三步全部由我自己重做,顺序未颠倒 ✅

**步骤①(当前状态,已反转)**

```
$ /usr/bin/grep -o "kw-split\|AllowlistView\|RootsView\|WikiView" dist/assets/*.js | sort | uniq -c
      1 dist/assets/index-BmIDaUWC.js:AllowlistView
      1 dist/assets/index-BmIDaUWC.js:kw-split
      1 dist/assets/index-BmIDaUWC.js:RootsView
      1 dist/assets/index-BmIDaUWC.js:WikiView
```

🔴 **判据上下文感知(承 E-25)** —— 我用 `grep -oab` 取字节偏移、再用 python 切前后 90/70 字节还原上下文,
四处全部落在**真实编译代码**上:

```
───── WikiView ─────
…_hoisted_54$1={key:4,class:"kw-foot"},_sfc_main$4=defineComponent({__name:"WikiView",setup(r){…
───── RootsView ─────
…_hoisted_38$2={class:"k-modal-foot"},_sfc_main$3=defineComponent({__name:"RootsView",setup(r){…
───── AllowlistView ─────
…_hoisted_60=["disabled"],_sfc_main$2=defineComponent({__name:"AllowlistView",setup(r){…
───── kw-split ─────
…function renderWikiMarkdown(r){return renderMarkdown(r)}const _hoisted_1$4={class:"kw-split"},…
```
⇒ 三个 `defineComponent({__name:…})` + 一个编译器 hoist 的 `{class:"kw-split"}` vnode props,**零注释/零字符串误命中**。

**步骤②(临时撤反转 + `rm -rf dist` 重建 → 必须搜不到)**

撤法比 T8 更彻底:我把 `knowledgeRoutes.ts` **整份还原到 `2119712`**(`git show 2119712:… >` 写文件,**不是** `git checkout`),
这样三条 `component:` 与**三行 import 一起消失** —— 只改 `component:` 而留着 import,模块仍可能进图,证据会不成立。

```
baseline md5 = 2bd03aef35ca76de559fed10b409c5c3
① 注入落盘:  92: { path: 'wiki', … component: KnowledgeDeferred },
             95: { path: 'roots', … component: KnowledgeDeferred },
             96: { path: 'allowlist', … component: KnowledgeDeferred },
             (WikiView/RootsView/AllowlistView 的 import 行 grep 零命中)
② rm -rf dist && pnpm build   → exit 0
③ grep JS  → 零输出
```

🔴 **防空转锚点(证明这条 grep 口径在同一份 dist 上确有命中能力)**:

```
$ /usr/bin/grep -o '__name:"DashboardView"\|…' dist/assets/*.js
  DashboardView / IndexedFilesView / NotesView / QueueView / SearchView / SettingsView  各 1 命中
```

🔴 **CSS 命中不作 JS 证据(承 E-8)**:同一次「撤反转」构建里 `dist/assets/index-*.css` 的 `kw-split` **仍在命中** ——
即本期 scss 从 T2 起就进产物,**0→4 的变化全部发生在 JS 侧**,这才是「模块真进 Vite 图」的证据。

**步骤③(`cp` 还原 + `md5sum` + 再 build 恢复命中)**

```
restored md5 = 2bd03aef35ca76de559fed10b409c5c3  (= baseline,逐字节一致)
git diff --stat → 空
rm -rf dist && pnpm build → exit 0
grep JS → AllowlistView / kw-split / RootsView / WikiView 各 1  ⇒ 4 命中恢复
```

⇒ **T8 的 DoD-4 全部复现成立,且顺序正确。**

### 1.2 「用例数不变可能掩盖删一条加一条」—— 两文件逐条对比 ✅

我用 `git show 2119712:<file>` 落到 scratchpad,与现文件**第 0 列锚定**对比 `^\s*it\(`(避开注释里的 `it(`):

```
OLD deferred (3 条)                    NEW deferred (3 条)
 83 'P5a 实现 dashboard,…其余 3 个 tab 挂占位'   →  102 'P5a…P5f 六批全部完成:占位清单已空,rail 9 个 tab 全部 isDeferred === false'
 94 'isDeferred 对每个已列 tab 返回 true'        →  120 同名,未改
100 'isDeferred 的判定来源是 DEFERRED_TABS 本身'  →  157 同名 + 后缀「(清单已空:用临时非空清单证明机制仍能判真)」

OLD routes (3 条)                      NEW routes (3 条)
 15 '一条布局路由带 9 个子路由 + 两条 Parser 路由'  →   18 同名,未改
 25 '路由名逐字照 Vue2'                        →   28 同名,未改
268 '…其余 3 个子路由仍是占位页 KnowledgeDeferred' →  330 '…**全部**是真组件 —— 占位页零残留(SP8-P5 六批收官)'
```
⇒ **位置一一对应、无删一条加一条。** 是**内容反转**,T8 的申报属实。

**断言数(第 0 列锚定 `^\s*expect\(`)**:deferred 10 → 10;routes **25 → 33**(净 +8)。
deferred 那 10 条的去向我逐条核过:旧 case1 的「6 个 `isDeferred(x)===false`」被换成**遍历全 9 项的循环 + `toHaveLength(9)` 防空转锚点**(6 → 9,**严格超集**);旧 case3 的 3 条被换成 8 条。**零断言被静默丢弃。**

**「反转不删」程序化自证(我自己写脚本跑的,不是抄报告)**:把每个文件 diff 里的删除行逐条拿去和「新增的注释行(剥 `//`)」比对 ——

```
deferred.test.ts        删除 18  未留档 1  ← 唯一一条是 `import { DEFERRED_TABS, isDeferred } from './deferred'`(被扩展成带 type,不是断言)
knowledgeRoutes.test.ts 删除 11  未留档 0
deferred.ts             删除  5  未留档 0
```
⇒ 与 T8 §1.1 完全一致,**独立复核成立**。

`deferred.ts` 文件头**五代旧块一条没删**(P5b-T5 / P5b-T10 / P5c-T10 / P5d-T10 / P5e-T8 逐个仍在,行号 6/8/10/16/24),
第六代块在 `:34`,含**时点 2026-08-06** + **三项已迁(T4 = AllowlistView · T5 = RootsView · T6+T7 = WikiView)** +
明写「**机制本身按 K8 / 承 P4 I2 保留**」。✅

### 1.3 机制钉子:`isDeferred → return false` 必须报红 —— 我自己注入 ✅

```
① 注入落盘(行首锚定 perl,$.==71):
   71:  return false // ===PROBE-A===
   md5 before=71eef266a4e2c867d0d9a3c146d546e5  after=e9934139ca9107b91e3021640903bafd
② pnpm exec vitest run --reporter=verbose src/ai/knowledge/deferred.test.ts   exit=1
   ✓ … > P5a…P5f 六批全部完成:占位清单已空,rail 9 个 tab 全部 isDeferred === false
   ✓ … > isDeferred 对每个已列 tab 返回 true
   × … > isDeferred 的判定来源是 DEFERRED_TABS 本身(清单已空:用临时非空清单证明机制仍能判真)
   Test Files 1 failed (1)   Tests 1 failed | 2 passed (3)
③ 还原 md5 = 71eef266a4e2c867d0d9a3c146d546e5 (一致)
```
🔴 **具名 failed 用例已核到**(不是只看退出码,R13 同族)。
🔴 那两条「✓」正是「**不许只断空数组**」的实证:牙全在临时非空清单那条上。

### 1.4 三条路由各改回占位一次 → 各报红一次 ✅

每条独立 `cp` 还原基线后再注入,行首锚定 perl:

```
探针 wiki       ① 136: { path: 'wiki', …, component: KnowledgeDeferred },
                ② × …占位页零残留(SP8-P5 六批收官)   Tests 1 failed | 2 passed (3)
探针 roots      ① 140: { path: 'roots', …, component: KnowledgeDeferred },
                ② × …占位页零残留(SP8-P5 六批收官)   Tests 1 failed | 2 passed (3)
探针 allowlist  ① 142: { path: 'allowlist', …, component: KnowledgeDeferred },
                ② × …占位页零残留(SP8-P5 六批收官)   Tests 1 failed | 2 passed (3)
③ 还原 md5 = 2bd03aef35ca76de559fed10b409c5c3(一致)
```
⇒ **三条全红,无一条「反转无守卫」** ⇒ **不触发 §9.20 的 Important 条款。**

🔴 **额外缺口猎(brief 没要求,我自己加的)** —— 核那两条「防空转锚点」是不是空壳:
删掉 `notes` 那条路由 → **3 条用例同时报红**(`toHaveLength(11)` / path 清单 / 路由名清单),
`AssertionError: expected [ '', 'search', 'wiki', …(5) ] to deeply equal [ …(6) ]`。**锚点有牙,不是空壳。**

---

## 2. 🔴 收官六数(我自己重算,一个没抄)

| # | 项 | **我实测** | T8 报的 | 取数口径 |
|---|---|---|---|---|
| ① | 测试文件数 | **339** | 339 ✅ | `pnpm exec vitest run --reporter=verbose` → `Test Files 339 passed (339)`;`find src -name '*.test.ts' \| wc -l` = 339(第二口径) |
| ② | 用例数 | **4659** | 4659 ✅ | 同上 → `Tests 4659 passed (4659)` |
| ③ | `.vue` 总数 | **188** | 188 ✅ | `find src -name '*.vue' \| wc -l` |
| ④ | color-guard 用例数 | **190** | 190 ✅ | verbose 日志里 `grep -c "src/styles/color-guard.test.ts >"` |
| ⑤ | `aiKb*` 键数 | **zh 520 / en 520** | 520/520 ✅ | 🔴 **真实模块导入**(`cp` 成 `.mjs` 后 `await import()` 取 `Object.keys`),非文本解析 |
| ⑥ | 全表键数 | **zh 1727 / en 1727,差集均空** | 1727 ✅ | 同上;`zh-en=[]` `en-zh=[]` |

**归因表自洽性(裁定 R24)**:verbose 日志逐文件计数 ——
`deferred.test.ts` **3** · `knowledgeRoutes.test.ts` **3** · `WikiView.test.ts` **101**。
T8 报的改前基线 4658 + `WikiView.test.ts` 唯一 +1 = **4659** ✅,与总数自洽。
`git diff --numstat 2119712 8792830 -- src/` 只列 **5 个文件**,`WikiView.test.ts` = **`25  0`**(**只新增、零删除**)。

### 2.1 死键核查(我自己重跑,并用 `/usr/bin/grep` 复证)

键源:`zh_cn.ts:1955-2052` / `en_us.ts:1934-2027` 的 `>>> SP8-P5f Task 1 … <<<` 块,**行首两空格锚定**提取
→ **zh 79 / en 79,`diff` 完全一致**。

```
口径①(brief 原文,但用 /usr/bin/grep 真二进制)
  grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
  总键数=79   零消费=0   零消费键清单:(空)

口径②(我自己加的收紧版:再剔掉「只出现在注释行」的命中)
  grep -rnw … | grep -v '\.test\.ts:' | grep -vE '^[^:]+:[0-9]+: *(//|\*|<!--)'
  零非注释消费键 = 0
```
🔴 **T8 自曝的 gitignore-aware `grep` 包装事故,我全程用 `/usr/bin/grep` 复证,结论一致(零死键)。**

**16 条间接消费逐条落地核实**(brief 要求):
- **3 条** `AllowlistView.vue` 的 `GROUPS_TEMPLATE.labelKey`(`aiKbAlGroupDocuments/Text/Code`,`:177/:179/:181`)——
  渲染点实见:`:310 {{ t(g.labelKey) }}` + `:244/:245 t(g.labelKey)`。✅
- **4 条** `WikiView.vue` 的 `OP_LABEL_KEYS`(`:214-218`)—— 渲染点实见 `:322 label: t(OP_LABEL_KEYS[c.op] || 'aiKbWkOpUpdated')`。✅
- **9 条**带占位符的 `t('key', {…})`(`aiKbAlAddedExt` / `aiKbAlAllSelected` / `aiKbAlAllDeselected` / `aiKbAlNowIndexing` /
  `aiKbAlStoppedIndexing` / `aiKbRtScanEvery` / `aiKbWkItemCount` / `aiKbWkRenderNote` / `aiKbWkSummaryUpdated`)——
  逐条 `grep "t('<key>'"` 均 **各 1 处**非测试调用点。✅

### 2.2 rail 序号(两口径现测)

```
口径①(源码 KnowledgeLayout.vue:54-64 的 NAV,顺序即 rail 顺序)
  1 dashboard · 2 search · 3 wiki · 4 notes · 5 indexed-files · 6 queue · 7 roots · 8 allowlist · 9 settings
口径②(渲染 DOM,KnowledgeLayout.test.ts:95-115 现跑,全绿)
  findAll('.k-rail-item') → 9 项;hrefs[0]='#/ai/knowledge' hrefs[1]='#/ai/knowledge/search' hrefs[8]='#/ai/knowledge/settings'
```
⇒ 🔴 **wiki=3 · roots=7 · allowlist=8**,与 **R10** 一致,与 T8 一致。

**rail 9 项零占位页**:`knowledgeRoutes.ts` **非注释行**里 `KnowledgeDeferred` 只剩 `:114` 那一行 import;
11 条路由(9 子 + 2 parser)的 component 无一指向它,并经我三条 RED 探针坐实。
另外我核了 `:221` 的 `href` 与 `:171` 的 `navigate()`:两处都是 `'/ai/knowledge/' + n.id`,**与路由 path 逐字一致** ⇒
T8 给的三条深链 `…/#/ai/knowledge/{wiki,roots,allowlist}` **确实能到**。

---

## 3. 追加项与顺手项

### 3.1 T7 评审 I-1(`kw-sec-en`)—— 我自己把两处改成 `$t(...)` → **报红** ✅

```
① 注入落盘(行首锚定,$.==684 / $.==707):
   684: <span class="kw-sec-en">{{ t('aiKbWkContents') }}</span>
   707: <span class="kw-sec-en">{{ t('aiKbWkRecentChanges') }}</span>
   md5 before=938098e0cda42b46d52426e926d78761  after=dddbdb05ebde50ff3aeee7928f1fec1f
② × … > 🔴 两处 `kw-sec-en` 必须是英文字面量,不许过 $t()
   AssertionError: kw-sec-en 被 i18n 化了 …: expected [ '子项清单', '最近变化' ] to deeply equal [ 'Contents', 'Recent changes' ]
   Tests 1 failed | 100 passed (101)
③ 还原 md5=938098e0cda42b46d52426e926d78761(一致)
```
**`WikiView.test.ts` 既有零改动**:`git diff --numstat 2119712 8792830` → **`25 0`**,
`git diff | grep -c '^-[^-]'` → **0**。✅ 且新守卫自带两条防空转前置(`.kw-children` / `.kw-changes` 必须真渲染)。

### 3.2 M-5 注释订正 —— **非注释行改动 = 0** ✅

`knowledgeRoutes.ts` 的全部非注释改动行(我自己从 diff 里剔掉 `^[+-]\s*//` 后逐行看):
**3 行 import + 3 行 `component:` 反转,没有第七行。** M-5 的两处订正块纯注释,且原文一字未删(「反转不删」)。

### 3.3 `deferred.ts` 第六代块 ✅

带时点 · 三项已迁 · 明写「机制本身按 K8 / 承 P4 I2 保留」· 旧代块 5 个全在,一条没删(见 §1.2)。

---

## 4. 🔴 T8 六条顾虑的裁断(每条附我自己的证据)

### ① 机制钉子改写 —— 🟢 **成立(三问全部通过)**

**问 ① brief 的「一字不许动」是否真的不成立?两条独立口径:**

我把旧写法的两行(`const listed = DEFERRED_TABS[0]` / `expect(isDeferred(listed)).toBe(true)`)**原样注回**去实测:

```
口径① pnpm exec vue-tsc --noEmit        exit=2
  src/ai/knowledge/deferred.test.ts(164,34): error TS2493: Tuple type 'readonly []' of length '0'
                                             has no element at index '0'.
  src/ai/knowledge/deferred.test.ts(165,23): error TS2345: Argument of type 'undefined' is not
                                             assignable to parameter of type 'KnowledgeTabId'.

口径② pnpm exec vitest run --reporter=verbose src/ai/knowledge/deferred.test.ts    exit=1
  × … > isDeferred 的判定来源是 DEFERRED_TABS 本身(…)
  AssertionError: expected false to be true // Object.is equality
  Test Files 1 failed (1)   Tests 1 failed | 2 passed (3)
```
⇒ **TS2493 属实,运行时也真红。brief 的判据在清单清空后由构造决定不可能成立。T8 纠正正确(R18 / R21 两口径已贴齐)。**

**问 ② 新写法在 `return false` 下真的报红?** —— 见 §1.3,**具名 red 已核到**。

**问 ③ 这是加固还是放宽?§9.10 要「程序化证明」,自我声明不算 —— 我做了对照实验:**

在 `isDeferred → return false` **仍生效**的前提下,我把 case3 的「临时非空清单块」整段删掉
(= 最自然的那个**放宽变体**:只保留 `notListed` 两条 + 空数组前置),再跑同一个文件:

```
【T8 的真写法】   Tests  1 failed | 2 passed (3)     ← 1 红
【放宽变体】      Tests  3 passed (3)   exit=0       ← 0 红,全绿
```
⇒ 🔴 **「加固后 1 个红 / 放宽后 0 个红」的程序化证明成立**(§9.14-1 要的正是这个形态)。
**判定:加固,不是放宽。批准。**

### ② `aiKbNavAllowlist` 中文是「索引范围」 —— 🟢 **成立**(我自己去 i18n 表查的)

```
src/i18n/zh_cn.ts:1430  aiKbNavWiki: 'Wiki 导航',
src/i18n/zh_cn.ts:1434  aiKbNavRoots: '索引目录',
src/i18n/zh_cn.ts:1435  aiKbNavAllowlist: '索引范围',
```
⚠️ **T8 只点了 allowlist 一条,漏了 wiki**:rail 第 3 项界面上显示的中文是 **「Wiki 导航」**,不是「Wiki」
(`.k-rail-item-cn` = `t(n.labelKey)`,`.k-rail-item-en` = 字面 `Wiki`)。
🔴 **验收清单三项一律用界面真实中文写:第 3 项「Wiki 导航」· 第 7 项「索引目录」· 第 8 项「索引范围」。**(见 Minor M-6)

### ③ `KnowledgeDeferred` 的未引用 import —— 🟢 **判:保留**(理由成立,但需订正一句)

- **事实核实**:`knowledgeRoutes.ts` 非注释行里 `KnowledgeDeferred` 只剩 `:114` 那一行 import;
  全仓生产侧(排除 `.test.ts` 与注释)对 `KnowledgeDeferred` 的引用**就这一处** ⇒ 「唯一锚点」属实。
- **门风险为零**:`tsconfig` 无 `noUnusedLocals`(grep 零命中)、仓库**无任何 eslint 配置、`package.json` 无 `lint` 脚本**,
  `vue-tsc --noEmit` 与 `vite build` 我自己跑均 **exit 0**。
- 🔴 **需订正的一句**:源码注释说「删掉后 `KnowledgeDeferred.vue` 会彻底掉出 Vite 图」——
  **它现在其实已经不在产物里了**:`grep -o '__name:"KnowledgeDeferred"' dist/assets/*.js` **零命中**(被 Rollup tree-shake),
  dist 里那条 `即将上线` 来自 `zh_cn.ts:1411 aiKbDeferredTitle`(**i18n 表**),**不是**组件。
  ⇒ 该 import 是**源码级锚点**,对产物零成本也零效果。**留着无害,删了也不掉能力(测试侧仍在消费它),我判维持保留**(§9.10 不动已过评审的东西)。见 Minor M-3。

### ④ 空循环的那条 `it` —— 🟡 **部分成立:担心是真的,处置够用,不返工**

- **担心属实**:`for (const id of DEFERRED_TABS) expect(...)` 在空清单下**一条断言都不执行**,
  它现在是一条**零判别力的绿**(probe A 下它照样 ✓,见 §1.3 第二行)。
- **但处置够用,三条理由**:
  (a) 判别力**确实已转移**且经我程序化坐实(§4-① 问③ 的 1 红 / 0 红对照);
  (b) 它是**自动上膛**的:清单一旦再非空,这行立刻恢复判别力 —— 加一条 `toHaveLength(0)` 反而会在下次加占位页时**打成假红**;
  (c) 逻辑上「对每个已列 tab 返回 true」在空清单下**空真**,不是假陈述,也不是 §9.14-4 要防的那个故障模式
      (§9.14-4 防的是「**清单读取失败**导致 N=0」,这里 N=0 是**设计决定**的,不是读取失败)。
- 🔴 **唯一建议(零风险、可不做)**:用例名加个「(清单已空 ⇒ 本条当前为空真,判别力见下一条)」的后缀,
  免得将来有人扫 verbose 日志把它当活守卫。**不构成返工项。**

### ⑤ 两条 shell 口径坑 —— 🟢 **成立,且我复证并把根因精确化了**

- **`grep` 包装**:本 shell 的 `grep` 确为 gitignore-aware 包装。我**全程用 `/usr/bin/grep`**,
  死键结论(79/79、零死键)两版一致 ⇒ T8 结论不受影响,但**教训应转常驻**(R21 的又一实例)。
- **`pnpm test --reporter` 不透传** —— 我自己实测:
  ```
  $ pnpm test --reporter=verbose src/ai/knowledge/deferred.test.ts
  > vitest run "src/ai/knowledge/deferred.test.ts"      ← --reporter 不见了
  日志共 13 行,`^ *✓ ` 命中 0
  ```
  🔴 **根因比 T8 说的更具体**:不是「pnpm 不透传参数」的通例(文件路径就透传过去了),
  而是 **`--reporter` 与 pnpm 自身的 `--reporter` 选项撞名,被 pnpm 自己吃掉**。
  ⇒ 常驻纪律应写成:**凡与 pnpm 自身选项撞名的 flag(`--reporter` / `--filter` / `--silent` 等)一律走 `pnpm exec <bin> …`。**

### ⑥ `openNoteInNewTab` 继续不补 —— 🟢 **成立**(我两口径 + 防空转)

```
口径① /usr/bin/grep -rnw "openNoteInNewTab" src/     → 零命中(exit 1)
口径② git grep -ln "openNoteInNewTab" -- 'src/*'      → 零文件(exit 1)
防空转 姊妹函数 openFileInNewTab                        → 8 个文件命中(口径确有命中能力)
```
⇒ **本期三页零调用点,补了就是死代码。继续不补,转下一期。**

---

## 5. 三门(我自己跑的全量,落盘,未 `| tail`)

```
pnpm exec vitest run --reporter=verbose  → exit 0   Test Files 339 passed (339)   Tests 4659 passed (4659)
pnpm exec vue-tsc --noEmit               → exit 0   (日志 0 行)
pnpm build                               → exit 0   ✓ built in 14.02s
```
🔴 **具名 failed 用例核查**:`grep -acE "^ *× |^ *FAIL " gate-test.log` → **0**
(不是只看退出码;R13 同族的 Startup Error 误判风险已排除)。
**已知噪声 `persist.test.ts > dropPersisted …` 与 `AgentComposer.test.ts` 本次均未触发。**
日志:`…/scratchpad/rev8/gate-{test,tsc,build}.log`(19071 / 0 / — 行)。

---

## 6. Minor(7 条,均不返工)

| # | 事 | 我的证据 |
|---|---|---|
| **M-1** | **报告 §1 表两处 +/- 数字失准**:`deferred.test.ts` 实为 **+88/−18**(报 +85/−18)、`knowledgeRoutes.test.ts` 实为 **+93/−11**(报 +90/−11) | `git diff --numstat 2119712 8792830 -- src/` 五行:88/18 · 25/5 · 93/11 · 49/3 · 25/0。其余三行准确,**删除行数 18/11/5 与「零断言丢失」的结论不受影响**(我独立复核成立) |
| **M-2** | 🔴 **`isDeferred` 全仓零生产消费点** —— K7「机制」现在**完全是测试侧存在** | 两口径:`grep -rn "isDeferred" src/` 排除 `deferred.ts*` 后只剩 3 行**注释**;`git log -S"isDeferred(" --all -- src/ai/knowledge/views/` **零提交**。**非本刀引入**(`6d67b7b` / `2119712` 同样为零)⇒ 不是 T8 的缺陷,但「机制仍有牙」证明的是一个**没人调用的函数**,建议写进**终审知情项 / 下一期债务** |
| **M-3** | `KnowledgeDeferred` 的未引用 import **在产物里已被 tree-shake**,源码注释「删掉后彻底掉出 Vite 图」需按「产物 vs 源码图」订正 | `grep -o '__name:"KnowledgeDeferred"' dist/assets/*.js` 零命中;dist 的 `即将上线` 来自 `zh_cn.ts:1411`。裁断仍为**保留**(见 §4-③) |
| **M-4** | 空循环 `it` 只加注释未加锚点 | 见 §4-④,**部分成立、不返工**,建议只改用例名后缀 |
| **M-5** | 新用例的 `ALL_TABS` 是**硬编码 9 项 + `toHaveLength(9)`** —— 将来 `KnowledgeTabId` 联合类型加第 10 个成员时,这条会**静默停在 9 项**、不自动上膛 | `deferred.test.ts:161-168` 与 `deferred.ts:47-57` 的 union 无类型级绑定。建议下一期改成类型级穷举(`Record<KnowledgeTabId, true>` 之类) |
| **M-6** | 验收清单措辞:T8 只点了 allowlist,**漏了 wiki** —— 第 3 项界面显示 **「Wiki 导航」** 而非「Wiki」 | `zh_cn.ts:1430 aiKbNavWiki: 'Wiki 导航'`;模板 `.k-rail-item-cn` = `t(n.labelKey)` |
| **M-7** | rail 的 `href` 与 `knowledgeRoutes` 的 9 条 `path` **两侧各自钉死字面量,无交叉一致性守卫**(pre-existing,非本刀) | `KnowledgeLayout.vue:221` `'/ai/knowledge/' + n.id` 与 `:171` `navigate()` 我已手工逐条比对**完全一致**,本次三条深链无误。仅登记 |

---

## 7. 我自己的探针纪律自证

| 探针 | 还原 | md5 |
|---|---|---|
| `knowledgeRoutes.ts` 整份撤回 `2119712`(构建管线门) | `cp` | `2bd03aef35ca76de559fed10b409c5c3` 一致 |
| `isDeferred → return false` | `cp` | `71eef266a4e2c867d0d9a3c146d546e5` 一致 |
| `deferred.test.ts` 放宽变体(§9.10 对照实验) | `cp` | `0538765315f201811d821ccd0e6420b1` 一致 |
| `deferred.test.ts` 注回旧机制钉子两行(TS2493 复证) | `cp` | 同上,一致 |
| 三条路由各改回占位(×3) | `cp` | `2bd03aef…` 一致 |
| 删 `notes` 路由(防空转锚点验证) | `cp` | `2bd03aef…` 一致 |
| `WikiView.vue` 两处 `kw-sec-en` i18n 化 | `cp` | `938098e0cda42b46d52426e926d78761` 一致 |

**收尾**:`git status --short` 空 · `git diff --stat` 空 · `HEAD = 8792830`。
🔴 **全程零 `git checkout` / `git restore` / `git stash` / `git reset` / `git rebase` / `--amend`;零部署、零 push、零合 master。**

---

## 8. 结论

**Critical 0 / Important 0 / Minor 7。**
计划书指定的四条「评审第一必查项」我全部自己动手重做并通过;收官六数全部自算吻合;
死键零(两口径,含 `/usr/bin/grep` 复证);rail 3/7/8 两口径坐实;三门全量自跑全绿、零具名 failed。
T8 的六条顾虑:**①②⑤⑥ 成立 · ③ 判维持保留(附一句订正)· ④ 部分成立、不返工。**

🟢 **建议:T8 关账,可以进全支终审。**
