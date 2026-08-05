# P5e · Task 8 报告 —— 收官刀(路由反转 + `DEFERRED_TABS` + 构建管线门 + M-5 + R23)

起点 HEAD:`590c026`(自测确认,见下)。只改 5 个文件:
`src/ai/knowledge/deferred.ts` · `deferred.test.ts` · `knowledgeRoutes.ts` ·
`knowledgeRoutes.test.ts` · `src/ai/styles/knowledgeStyles.test.ts`。

```
$ git log --oneline -1
590c026 docs(p5e): T7 评审(C0/I0/M0 全清)—— 方案 A 的反向断言确认有真实牙
$ git status --porcelain
 M src/ai/knowledge/deferred.test.ts
 M src/ai/knowledge/deferred.ts
 M src/ai/knowledge/knowledgeRoutes.test.ts
 M src/ai/knowledge/knowledgeRoutes.ts
 M src/ai/styles/knowledgeStyles.test.ts
```

## 1. `DEFERRED_TABS` 4 → 3(摘 `'search'`)

`deferred.ts` 文件头按「反转不删」加第五代块(带时点 2026-08-05,逐字保留前四代块):

> 【SP8-P5e Task 8,2026-08-05,第五次反转(不是删除)】'search' 已迁(SearchView.vue,
> T4-T7 四刀收官 + knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 4 项变
> 3 项。……🔴 逐项重申剩下 3 个占位项归哪一期反转:
> · 'wiki' / 'roots' / 'allowlist' → **P5f**(全部三个都归 P5f,没有再拆出别期)。

`DEFERRED_TABS` 从 `['search','wiki','roots','allowlist']` 改为 `['wiki','roots','allowlist']`。
`KnowledgeTabId` 类型定义不变(`'search'` 仍是合法 tab id,只是不再被判定为 deferred)。

## 2. `knowledgeRoutes.ts` —— `search` 子路由反转

新增 `import SearchView from './views/SearchView.vue'`,`search` 子路由的
`component` 从 `KnowledgeDeferred` 改为 `SearchView`。加第六代注释块(承 T12/T5/
P5b-T10/P5c-T10/P5d-T10 五次同款先例),改前原文（P5c-T10 那句现在时描述）按
「反转不删」保留,只在其上方插入 M-5 订正块（见 §6）。

非注释行 diff(逐行确认只有这两处实质改动):

```
$ git diff --no-color -- src/ai/knowledge/knowledgeRoutes.ts | grep -E '^[+-]' | grep -v '^[+-]//' | grep -v '^+++' | grep -v '^---'
+import SearchView from './views/SearchView.vue'
-      { path: 'search', name: 'KnowledgeSearch', component: KnowledgeDeferred },
+      { path: 'search', name: 'KnowledgeSearch', component: SearchView },
```

## 3. `deferred.test.ts` 的「机制钉子」用例 —— 一字未动的自证

改的只是第一条断言(反转 sort 后的清单)与相邻的历史注释块。「机制钉子」两条用例
(`isDeferred 对每个已列 tab 返回 true` / `isDeferred 的判定来源是 DEFERRED_TABS 本身`)
在 diff 里**零命中**:

```
$ git diff --no-color -- src/ai/knowledge/deferred.test.ts | tail -20
...(diff 最后一段落在 it('isDeferred 对每个已列 tab 返回 true' ... 之前，两条机制
钉子用例整块不在 diff 里出现)
```

（完整 diff 已在编辑过程中核对：新增内容全部在第一条 `it(...)` 之前和之内，
后两条 `it` 块字符一个未动。）

### 3.1 变异验证 —— `isDeferred` 硬编码 `return false` → 必须报红

用 cp 副本 + 行首锚定注入(不使用 `git checkout`):

```
$ cp src/ai/knowledge/deferred.ts $SCRATCH/deferred.ts.orig
$ md5sum src/ai/knowledge/deferred.ts
2dd8ddce7bc28159df8e47a8f986fe8e  src/ai/knowledge/deferred.ts

$ sed -i '51s/.*/  return false \/* R-PROBE:hardcode-false *\//' src/ai/knowledge/deferred.ts
$ sed -n '50,52p' src/ai/knowledge/deferred.ts
export function isDeferred(id: KnowledgeTabId): boolean {
  return false /* R-PROBE:hardcode-false */
}
$ md5sum src/ai/knowledge/deferred.ts
577553345b21a39e33aef686d08db593  src/ai/knowledge/deferred.ts   # 注入已落盘,md5 变化确认
```

跑测试(RED):

```
$ pnpm exec vitest run src/ai/knowledge/deferred.test.ts --reporter=verbose
 FAIL  ... isDeferred 对每个已列 tab 返回 true
   AssertionError: expected false to be true
 FAIL  ... isDeferred 的判定来源是 DEFERRED_TABS 本身
   AssertionError: expected false to be true
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

两条机制钉子用例均报红(第一条清单断言因为只比较 sort 后的数组、不受 `isDeferred`
返回值影响,仍然是绿的,这本身也证明了两条用例分工清楚:一条钉清单内容,两条钉
机制本身有没有在工作)。

还原(cp + md5sum 逐字节比对):

```
$ cp $SCRATCH/deferred.ts.orig src/ai/knowledge/deferred.ts
$ md5sum src/ai/knowledge/deferred.ts
2dd8ddce7bc28159df8e47a8f986fe8e  src/ai/knowledge/deferred.ts   # 与探针前逐字节相同
$ pnpm exec vitest run src/ai/knowledge/deferred.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## 4. 「路由改回占位 → 必须有断言报红」

同款 cp + 行首锚定注入:

```
$ cp src/ai/knowledge/knowledgeRoutes.ts $SCRATCH/knowledgeRoutes.ts.orig
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
650d595743b68f747652c6386c95ea19  src/ai/knowledge/knowledgeRoutes.ts

$ sed -i "91s/.*/      { path: 'search', name: 'KnowledgeSearch', component: KnowledgeDeferred }, \/\* R-PROBE:revert-to-placeholder \*\//" src/ai/knowledge/knowledgeRoutes.ts
$ sed -n '91p' src/ai/knowledge/knowledgeRoutes.ts
      { path: 'search', name: 'KnowledgeSearch', component: KnowledgeDeferred }, /* R-PROBE:revert-to-placeholder */
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
fb4d00bd6410ad3215e36d124adda38d  src/ai/knowledge/knowledgeRoutes.ts   # 注入已落盘
```

跑测试(RED):

```
$ pnpm exec vitest run src/ai/knowledge/knowledgeRoutes.test.ts --reporter=verbose
AssertionError: expected { __name: 'KnowledgeDeferred', … } to be { __name: 'SearchView', … }
 ❯ src/ai/knowledge/knowledgeRoutes.test.ts:292:36
    expect(searchChild?.component).toBe(SearchView)
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

精确命中新反转断言,其余两条(9 路由数量 / 路由名逐字)不受影响仍绿。**证实这次
反转确有守卫**,不是三门全绿的空转。

还原:

```
$ cp $SCRATCH/knowledgeRoutes.ts.orig src/ai/knowledge/knowledgeRoutes.ts
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
650d595743b68f747652c6386c95ea19  src/ai/knowledge/knowledgeRoutes.ts   # 逐字节相同
$ pnpm exec vitest run src/ai/knowledge/knowledgeRoutes.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## 5. 🔴 构建管线门(顺序未颠倒 —— 先抓改前证据)

反转发生在 `knowledgeRoutes.ts`,所以「改前」= T8 之前(HEAD `590c026`)的
`knowledgeRoutes.ts`,不是我自己再撤一次反转。用 `git show HEAD:<path>` 读取该
历史内容(只读,不是 `git checkout`),cp 进工作树临时替换,构建后 grep,再 cp 换
回本刀的最终版本,md5sum 核对逐字节相同。

### 5.1 改前(HEAD 590c026 的 knowledgeRoutes.ts,SearchView 未接线)

```
$ git show HEAD:src/ai/knowledge/knowledgeRoutes.ts > $SCRATCH/knowledgeRoutes.ts.before-t8
$ md5sum $SCRATCH/knowledgeRoutes.ts.before-t8
6a6a95d9596774dad1db8c12d5956b52
$ diff $SCRATCH/knowledgeRoutes.ts.before-t8 src/ai/knowledge/knowledgeRoutes.ts
（差异恰好是:M-5 注释订正块 + 第六代注释块 + import SearchView + search 路由
component 从 KnowledgeDeferred 换成 SearchView —— 与 §2/§6 描述的改动逐一对应）

$ cp src/ai/knowledge/knowledgeRoutes.ts $SCRATCH/knowledgeRoutes.ts.after-t8   # 先备份最终版
$ cp $SCRATCH/knowledgeRoutes.ts.before-t8 src/ai/knowledge/knowledgeRoutes.ts  # 换回改前
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
6a6a95d9596774dad1db8c12d5956b52   # 确认注入落盘(与 before-t8 一致)

$ rm -rf dist && pnpm build
build exit=0
$ grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js
grep exit=1   # 零输出
```

补充证据:确认 `SearchView.vue` 在改前状态下**全仓零生产 import**(排除测试文件):

```
$ grep -rn "SearchView" --include=*.ts --include=*.vue src/ | grep -v '\.test\.ts'
（唯一命中来自 knowledgeRoutes.ts 自身的 import/component —— 而在“改前”版本里这
一行还是 KnowledgeDeferred,故此时 SearchView.vue 不在任何生产模块图里）
```

### 5.2 改后(还原到本刀最终版本)

```
$ cp $SCRATCH/knowledgeRoutes.ts.after-t8 src/ai/knowledge/knowledgeRoutes.ts
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
650d595743b68f747652c6386c95ea19   # 与本刀最终版本逐字节相同

$ rm -rf dist && pnpm build
build exit=0
$ grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js | sort | uniq -c
      1 dist/assets/index-Bs01F94r.js:FileDetailDrawer
      1 dist/assets/index-Bs01F94r.js:KFileViewer
      2 dist/assets/index-Bs01F94r.js:k-rcard-tag
```

### 5.3 命中处上下文(证明来自真实编译代码,不是注释残留;满足 E-25 上下文感知)

```js
// FileDetailDrawer —— Vue <script setup> 编译器产出的组件标识字段
"hoisted_39$2={class:\"k-chunk-viewer-foot\"},_sfc_main$7=defineComponent({__name:\"FileDetailDrawer\",props:{file:{},query:{default:\"\"}},emits:[\"close\",\"open\",\"down"

// KFileViewer —— 同上
",_hoisted_5$3={class:\"k-fileviewer-empty\"},_sfc_main$3=defineComponent({__name:\"KFileViewer\",props:{file:{}},emits:[\"close\",\"download\"],setup(r,{emit:e}){const{"

// k-rcard-tag —— Vue 运行时 createBaseVNode 调用里的静态 class 字符串(真实渲染函数,非注释)
"hoisted_5$7,[createBaseVNode(\"div\",_hoisted_6$4,[createBaseVNode(\"span\",{class:\"k-rcard-tag\",\"data-kind\":r.file.kind},toDisplayString$1(r.file.kind.toUpperCase("
">F.value=ct},[createBaseVNode(\"div\",_hoisted_52,[createBaseVNode(\"span\",{class:\"k-rcard-tag\",\"data-kind\":ct.kind},toDisplayString$1(ct.kind.toUpperCase()),9,_ho"
```

`defineComponent({__name: "..."})` 是 `<script setup>` 编译产出的组件标识(devtools/HMR
用),`createBaseVNode(...)` 是 Vue 运行时渲染函数调用 —— 压缩后的产物里注释早已被
完全剥除(esbuild/terser 压缩不保留任何注释),这三处命中只能来自真实编译代码。
CSS 侧命中(`.k-rcard-tag` 的样式声明)不作为本门证据 —— 这里核的是 `dist/assets/*.js`,
knowledge.scss 早在 T2 就已进产物(由 `KnowledgeLayout.vue` import),不是本刀新增
的信号。

**构建产物 dist/ 已 gitignore,不进提交。**

## 6. M-5 顺手订正(`knowledgeRoutes.ts`)

原 `:49-51`(P5c-T10 落笔)用现在时写「剩下 5 个子路由……仍指 KnowledgeDeferred」,
早已被后续两次反转(P5d→4、本刀→3)推进过时。已按「反转不删」在其上方插入订正块,
说明这是 P5c-T10 落笔时的状态快照、只改语气不改历史事实,并指向「当前状态永远
以文件末尾最近一次反转记录 + `deferred.ts` 文件头为准」。**只改了注释,原三行
逐字保留在订正块下方**(见 §2 引用的原文)。

非注释行改动为 0 的自证:见 §2 的 diff(`grep -v '^[+-]//'` 之后只剩 import 与
route component 那两行,M-5 涉及的注释文本完全不出现在这个过滤结果里)。

## 7. 🔴 收官口径六个数字(自测,取数命令随附)

```
$ pnpm test > /tmp/p5e-t8-test.log 2>&1; echo exit=$?          # exit=0
$ grep -E "Test Files|Tests " /tmp/p5e-t8-test.log
 Test Files  335 passed (335)
      Tests  4254 passed (4254)

$ find src -name '*.vue' | wc -l
185

$ pnpm exec vitest run src/styles/color-guard.test.ts --reporter=verbose 2>&1 | grep -E "Tests "
      Tests  187 passed (187)

# aiKb* 键数 + 全表键数(真实模块导入,不是文本解析):
$ cp src/i18n/zh_cn.ts $SCRATCH/i18n-check/zh.mjs
$ cp src/i18n/en_us.ts $SCRATCH/i18n-check/en.mjs
$ node --input-type=module -e "
import zh from '.../zh.mjs'; import en from '.../en.mjs';
const zhKeys=Object.keys(zh.default||zh), enKeys=Object.keys(en.default||en);
console.log('zh total', zhKeys.length);           // 1648
console.log('en total', enKeys.length);           // 1648
console.log('only in zh:', zhKeys.filter(k=>!new Set(enKeys).has(k)).length);  // 0
console.log('only in en:', enKeys.filter(k=>!new Set(zhKeys).has(k)).length);  // 0
console.log('aiKb* count(zh)', zhKeys.filter(k=>k.startsWith('aiKb')).length); // 441
console.log('aiKb* count(en)', enKeys.filter(k=>k.startsWith('aiKb')).length); // 441
"
zh total 1648
en total 1648
only in zh: 0 []
only in en: 0 []
aiKb* count(zh) 441
aiKb* count(en) 441
```

| # | 量 | 值 |
|---|---|---|
| ① | 测试文件数 | **335** |
| ② | 用例数 | **4254** |
| ③ | `.vue` 总数 | **185** |
| ④ | `color-guard` 用例数 | **187** |
| ⑤ | `aiKb*` 键数(zh/en 各自独立量,均相等) | **441 / 441** |
| ⑥ | 全表键数(zh/en 各自独立量 + 两个差集均空) | **1648 / 1648,only-in-zh 0,only-in-en 0** |

本刀零新建测试文件(只改已存在文件)⇒ 文件数 335 / `.vue` 185 / color-guard 187
与 T7 收官口径完全一致,与治理 §8.1 的下游算术表相符;用例数从 T7 的 4251(治理
brief 起点数字)涨到 4254,涨出的 3 条全部来自 R23 的三条新断言(§8 独立列出)。

## 8. 死键核查(本期新增 54 个键,逐键 grep)

取数命令(治理既定口径):

```
grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
```

54 个键提取自 `zh_cn.ts` 的 `>>> SP8-P5e Task 1` 块(`:1899-1952`),逐键结果(命中数 · 命中文件):

```
aiKbFdBack               1  FileDetailDrawer.vue
aiKbFdCopied             1  FileDetailDrawer.vue
aiKbFdCopy               1  FileDetailDrawer.vue
aiKbFdCopyFailed         1  FileDetailDrawer.vue
aiKbFdDistill            1  FileDetailDrawer.vue
aiKbFdDistillFailed      1  FileDetailDrawer.vue
aiKbFdDistillQueued      1  FileDetailDrawer.vue
aiKbFdDownload           2  FileDetailDrawer.vue, KFileViewer.vue
aiKbFdNextSection        1  FileDetailDrawer.vue
aiKbFdOpenFile           1  FileDetailDrawer.vue
aiKbFdPage               1  FileDetailDrawer.vue
aiKbFdPassage            1  FileDetailDrawer.vue
aiKbFdPrevSection        1  FileDetailDrawer.vue
aiKbFdResults            1  FileDetailDrawer.vue
aiKbFdSection            1  FileDetailDrawer.vue
aiKbFdSummary            1  FileDetailDrawer.vue
aiKbFvUnsupported        1  KFileViewer.vue
aiKbSrAdvanced           1  SearchView.vue
aiKbSrAdvOn              1  SearchView.vue
aiKbSrCountFiles         1  SearchView.vue
aiKbSrCountMatches       1  SearchView.vue
aiKbSrDownloadFailed     1  SearchView.vue
aiKbSrEmptySub           1  SearchView.vue
aiKbSrEmptyTipAllowlist  1  SearchView.vue
aiKbSrEmptyTipIndexed    1  SearchView.vue
aiKbSrEmptyTipKeyword    1  SearchView.vue
aiKbSrEmptyTitle         1  SearchView.vue
aiKbSrErrorTitle         1  SearchView.vue
aiKbSrFileType           1  SearchView.vue
aiKbSrIdleSub            1  SearchView.vue
aiKbSrIdleTitle          1  SearchView.vue
aiKbSrMatchPill          1  SearchView.vue
aiKbSrMatchTitle         2  FileDetailDrawer.vue, SearchView.vue
aiKbSrModified           2  FileDetailDrawer.vue, SearchView.vue
aiKbSrMoreHint           1  SearchView.vue
aiKbSrMtimeAny           1  SearchView.vue   (间接消费,见下)
aiKbSrMtimeMonth         1  SearchView.vue   (间接消费,见下)
aiKbSrMtimeWeek          1  SearchView.vue   (间接消费,见下)
aiKbSrMtimeYear          1  SearchView.vue   (间接消费,见下)
aiKbSrNoPath             1  SearchView.vue
aiKbSrNoPreviewToast     1  SearchView.vue
aiKbSrOpenFailed         1  SearchView.vue
aiKbSrPlaceholder        1  SearchView.vue
aiKbSrPopupBlocked       1  SearchView.vue
aiKbSrQuality            1  SearchView.vue
aiKbSrQualityAccurate    1  SearchView.vue
aiKbSrQualityFast        1  SearchView.vue
aiKbSrRelHigh            1  searchAggregate.ts
aiKbSrRelLow             1  searchAggregate.ts
aiKbSrRelMid             1  searchAggregate.ts
aiKbSrRerankWarn         1  SearchView.vue
aiKbSrSimilarity         2  FileDetailDrawer.vue, SearchView.vue
aiKbSrTopK               1  SearchView.vue
aiKbSrUntitled           1  searchAggregate.ts
```

**结论:54/54 键全部有生产消费,零死键。**

间接消费落地核实(4 条 MTIMES label):

```js
// SearchView.vue:87-91
const MTIMES = [
  { id: 'any', label: 'aiKbSrMtimeAny' },
  { id: '1w', label: 'aiKbSrMtimeWeek' },
  { id: '1m', label: 'aiKbSrMtimeMonth' },
  { id: '1y', label: 'aiKbSrMtimeYear' },
]
// SearchView.vue:414(模板,v-for="m in MTIMES" 内)
{{ t(m.label) }}
```

`aiKbSrMtimeAny/Week/Month/Year` 四个键不是被字面量 `t('aiKbSrMtimeXxx')` 直接调用,
而是写在 `MTIMES` 常量的 `label` 字段上、由 `t(m.label)` 间接渲染 —— 上面的 grep 已
在同一文件里同时抓到常量声明处,故不是死键(与 P5d 交接的「间接消费经常量 label
字段」既定模式一致)。

## 9. R23 守卫(祖先链)—— 落地判据证据

新增 `describe('祖先链守卫(R23)…')`,追加在 `knowledgeStyles.test.ts` 末尾(纯
append,不改动文件其余任何一行)。三条断言:

1. `.knowledge-app` 自身声明(剥掉所有嵌套后代选择器块之后)零
   `transform/filter/will-change/contain/perspective`。
2. `.k-main` 自身声明(同上手法)同样零禁用属性。
3. `theme.css` 的 `body`/`html` 自身声明(排除 `body::before`/`body::after` 伪元素)
   零禁用属性。

判据实现要点:
- `ownDeclarations()` 对 `nestedBlockBody()` 取回的整段嵌套文本反复剥离
  `\{[^{}]*\}`(先剥最内层再剥外层……),直到剥不出更多为止,只留该选择器自己
  写的顶层声明 —— 天然排除 `.chev`/`.k2-layer:hover` 等后代选择器自己的
  transform/filter(它们只影响自己的盒子,不是 `.knowledge-app` 的祖先链关注点)。
- `FORBIDDEN = /(?<![\w-])(transform|filter|will-change|contain|perspective)\s*:/`
  要求属性名紧跟冒号且前面不接字母/连字符,天然排除:
  ① 作为别的属性值出现的同名词(如 `transition: transform 0.45s …;` 里的
     `transform` 后面跟的是空格不是冒号,不会被匹配);
  ② 复合属性名(如 `backdrop-filter:`,`filter` 前面接着连字符,不会被匹配)。
- `theme.css` 侧用
  `/(?<![\w.#-])(html|body)\s*\{([^{}]*)\}/g` 抓取 `body`/`html` 规则块;
  `body::before {`/`body::after {` 因为 `body` 后面紧跟 `::before`/`::after` 而不是
  `{`,天然不会被这条规则捕获 —— 独立验证过(见下方脚本输出),实测确实只抓到
  3 个 `body` 块(`html, body { min-height }` / `body { margin… }` /
  `body { background… }`),伪元素两个块(`:335`/`:352`,各自声明了
  transform/filter)一个都不在结果里。

独立验证脚本输出(在写正式测试前,先用等价逻辑的 node 脚本核实规则和目标文本的
匹配行为,确认三处选择器当前状态干净):

```
$ node -e '... ownDeclarations 对 .knowledge-app / .k-main 求值 ...'
app own matches: null
k-main own matches: null
$ node -e '... RULE 对 theme.css 求值 ...'
[ { sel: 'body', decl: 'min-height: 100%;' },
  { sel: 'body', decl: 'margin: 0;\n  min-height: 100dvh;\n  color: var(--fg);\n  font-family: …;\n  overflow: hidden;' },
  { sel: 'body', decl: 'background: var(--app-bg);\n  background-attachment: fixed;' } ]
body forbidden? false
body forbidden? false
body forbidden? false
```

正式测试跑通(改前,绿):

```
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose
 ✓ 祖先链守卫(R23)…> .knowledge-app 自身声明零 transform/filter/will-change/contain/perspective(判据:加 transform: translateZ(0) → 必须报红) 0ms
 ✓ 祖先链守卫(R23)…> .k-main 自身声明零 transform/filter/will-change/contain/perspective 1ms
 ✓ 祖先链守卫(R23)…> theme.css 的 body/html 自身声明零 transform/filter/will-change/contain/perspective(body::before/::after 伪元素除外) 0ms
 Test Files  1 passed (1)
      Tests  356 passed (356)
```

### 判据 —— 加 `transform: translateZ(0)` → 必须报红(cp + md5sum 逐字节还原)

```
$ cp src/ai/styles/knowledge.scss $SCRATCH/knowledge.scss.orig
$ md5sum src/ai/styles/knowledge.scss
a30da07adfc9acc609b2701a174f25ca

$ sed -i '162a\  transform: translateZ(0); /* R23-RED-PROBE */' src/ai/styles/knowledge.scss
$ sed -n '160,167p' src/ai/styles/knowledge.scss
.knowledge-app, .parser-app {
  transform: translateZ(0); /* R23-RED-PROBE */
  --bg-app: #1C1C1E; /* AI tokens.scss:255 */
  ...
$ md5sum src/ai/styles/knowledge.scss
c9d6f2a0acc9756b33bdc044c96ba342   # 注入已落盘

$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts -t "祖先链守卫" --reporter=verbose
 × 祖先链守卫(R23)…> .knowledge-app 自身声明零 transform/filter/will-change/contain/perspective(判据:…)
   → .knowledge-app 自身出现了禁用属性:["transform:"]: expected [ 'transform:' ] to be null
 ✓ .k-main 自身声明零 …
 ✓ theme.css 的 body/html 自身声明零 …
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (353 skipped) (356)

$ cp $SCRATCH/knowledge.scss.orig src/ai/styles/knowledge.scss
$ md5sum src/ai/styles/knowledge.scss
a30da07adfc9acc609b2701a174f25ca   # 与探针前逐字节相同
$ git status --porcelain src/ai/styles/knowledge.scss
（空,knowledge.scss 本身零改动,本刀确实没有碰过它)
$ pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts --reporter=verbose | tail -6
 Test Files  1 passed (1)
      Tests  356 passed (356)
```

**判据成立**:精确命中 `.knowledge-app` 那一条,`.k-main` 与 `theme.css` 两条不受
影响仍绿(证明三条断言互相独立、没有一条是空转);还原后 `knowledge.scss` 与探针
前逐字节相同,`git status` 对该文件为空,确认本刀真的零改动 `knowledge.scss`
(注释里说明了引用 `ViewerShell.vue:24` 与 K46 的理由,只加固不放宽:§9.10)。

## 10. 验收导航路径 + `?q=` 深链

- 第一项(导航路径):`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 **2** 项
  「搜索」(`KnowledgeLayout.vue:56`:`{ id: 'search', en: 'Search', icon: 'search',
  labelKey: 'aiKbNavSearch' }`,数组里排在 `dashboard` 之后、`wiki` 之前,确为第 2
  项)。反转之前点这一项落到 `KnowledgeDeferred` 占位页;反转之后落到真正的
  `SearchView`(单测 `SearchView.test.ts` 已挂载验证 + 本刀 `knowledgeRoutes.test.ts`
  钉死 `component === SearchView`)。
- dev server 确认存活(未重启,未碰):

  ```
  $ ps aux | grep 5288
  ... vite --host --port 5288 ...
  $ curl -s -o /dev/null -w "%{http_code}\n" http://192.168.1.143:5288/app/
  200
  ```

- 可直接粘贴的深链 URL:

  **`http://192.168.1.143:5288/app/#/ai/knowledge/search?q=python`**

  (查询词可换成 `SAMPLE_QUERIES` 里的任意一个,或任意自然语言;按裁定 R2,本机
  当前搜索链路授权根缺失,搜索结果大概率是 `empty` 态 —— 这是票 C 的连带后果,
  不是本刀缺陷,验收清单会单独说明)。

## 11. 三门 + sass 门完整终值

```
$ pnpm test                      > /tmp/p5e-t8-test.log  2>&1; echo exit=$?
exit=0
$ grep -E "Test Files|Tests " /tmp/p5e-t8-test.log
 Test Files  335 passed (335)
      Tests  4254 passed (4254)

$ pnpm exec vue-tsc --noEmit     > /tmp/p5e-t8-tsc.log   2>&1; echo exit=$?
exit=0

$ pnpm build                     > /tmp/p5e-t8-build.log 2>&1; echo exit=$?
exit=0

$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null; echo "sass exit=$?"
sass exit=0
```

零红项。已知噪声(`persist.test.ts` IndexedDB flaky / `AgentComposer.test.ts`
vue-i18n teardown 竞态)本次运行**均未触发**,不需要复跑说明。

## 12. K/N/R 条目命中申报

- **K7**(占位机制)—— 本刀是它的第 5 次「反转不是删除」实例,机制保留、清单继续收缩。
- **R23**(裁定,§9 追加项)—— 本刀落地,见 §9。
- **M-5**(交接项)—— 本刀顺手订正,见 §6。
- 无新偏离、无新申报项。

## 13. 提交

一个语义提交,只列本刀 5 个文件(其中本报告用 `git add -f`,因 `.superpowers/`
被 `.gitignore:6` 盖着)。`git show --stat HEAD` 自查见下方终端记录(commit 完成后
另行贴出)。
