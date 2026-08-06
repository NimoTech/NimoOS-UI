# SP8-P5f · Task 8 实现者报告(**收官刀**)

> **状态:🟢 完成。这一刀过了,SP8-P5 六批(P5a–P5f)全部完成。**
> 起点 `2119712`(自测 `git log --oneline -1` = `2119712 docs(p5f): T7 独立评审 …`,与 brief 一致)。
> 工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`。
> **未部署 · 未 push · 未合 master · 未改 Service 仓 · 未装依赖。**

---

## 0. 一句话

`DEFERRED_TABS` **3 → 0**、`knowledgeRoutes.ts` 三条子路由 `KnowledgeDeferred` → `WikiView` /
`RootsView` / `AllowlistView`,构建管线门实测**改前 0 命中 / 改后 4 命中**(上下文感知),
顺手闭合 T7 评审 Important I-1,并订正 M-5 复发的两处现在时注释。
三门:**339 / 4659 / tsc 0 / build 0,零红项。**

---

## 1. 逐文件改了什么

| 文件 | +/- | 内容 |
|---|---|---|
| `src/ai/knowledge/deferred.ts` | +25 / −5 | 文件头**第六代块**;`DEFERRED_TABS` 3 → 0(原文留注释) |
| `src/ai/knowledge/deferred.test.ts` | +85 / −18 | 两条用例反转(改前原文全部留注释);机制钉子换成**临时非空清单**写法 |
| `src/ai/knowledge/knowledgeRoutes.ts` | +49 / −3 | 第七代反转块 + 3 条 import + 3 条路由 component 反转 + **M-5 两处订正(纯注释)** |
| `src/ai/knowledge/knowledgeRoutes.test.ts` | +90 / −11 | 六条断言反转(改前原文整段留注释)+ 「零占位」正向守卫 + 两条防空转锚点 |
| `src/ai/knowledge/views/WikiView.test.ts` | **+25 / −0** | **只新增** T7 评审 I-1 的 `kw-sec-en` 守卫 |

🔴 **`src/` 其余零改动**(`git status --short` 只列上面 5 个文件)。

### 1.1 「反转不删」完整性自证(程序化)

对三个「有删除行」的文件逐行核:每一条被删的行,是否都在**新增的注释**里留了档。

```
src/ai/knowledge/deferred.test.ts      删除行 18  已留档 17
  🔴 唯一未留档: `import { DEFERRED_TABS, isDeferred } from './deferred'`
     → 该行是**被扩展**(补 `type KnowledgeTabId`),不是断言被丢掉。
src/ai/knowledge/knowledgeRoutes.test.ts  删除行 11  已留档 11
src/ai/knowledge/deferred.ts              删除行  5  已留档  5
```
⇒ **零断言被静默删除。**

---

## 2. DoD 逐条

### DoD-1 · `DEFERRED_TABS` 3 → 0 ✅

`deferred.ts` 文件头加第六代块,含:时点(2026-08-06)· 「三项已迁(P5f,T4-T7 四刀)」·
🔴 **明写「SP8-P5 六批全部完成,占位清单已空;机制本身按 K8 / 承 P4 I2 的教训保留」**,
并逐条写出保留下来的三层守卫、以及「将来要挂占位怎么加回来」。
原 3 项的声明整段留成注释。

### DoD-2 · 三条子路由反转 + 六条断言反转 ✅

`wiki` → `WikiView`(T6+T7)· `roots` → `RootsView`(T5)· `allowlist` → `AllowlistView`(T4)。
测试侧每条路由一条正向断言(`toBe(真组件)` + `not.toBe(KnowledgeDeferred)`)= **6 条**,
改前原文(P5e-T8 整个 `it` 体)完整留成注释,承第五代 → **第六代/第七代**谱系。

### DoD-3 · §9.20 落地 ✅

#### 3a 🔴 **「机制钉子一字不许动」实测不成立 —— 已按 R18 / R21 显式申报**

**这是本期第 5 次「实现者纠正 brief」。** 两条独立口径,原始输出:

```
口径①  pnpm exec vue-tsc --noEmit
  src/ai/knowledge/deferred.test.ts(109,34): error TS2493: Tuple type 'readonly []'
      of length '0' has no element at index '0'.
  src/ai/knowledge/deferred.test.ts(110,23): error TS2345: Argument of type 'undefined'
      is not assignable to parameter of type 'KnowledgeTabId'.
  vue-tsc exit=2

口径②  pnpm exec vitest run --reporter=verbose src/ai/knowledge/deferred.test.ts
  FAIL  … > isDeferred 的判定来源是 DEFERRED_TABS 本身
  AssertionError: expected false to be true // Object.is equality
   ❯ src/ai/knowledge/deferred.test.ts:110:32
      109|     const listed = DEFERRED_TABS[0]
      110|     expect(isDeferred(listed)).toBe(true)
  Test Files  1 failed (1)     Tests  2 failed | 1 passed (3)
```

**根因是构造性的,不是实现错**:原文最后两行断的是「清单里第 0 项必须判真」,
清单一空,该前提**由构造决定永远不成立**(类型上 `DEFERRED_TABS[0]` 不存在,运行时 `undefined`)。
⇒ 守「反转不删」:原文整段留档,换成**判别力更强**的写法。**这正是 §9.20 第二条要的东西。**

#### 3b 🔴 变异验证:`isDeferred` 硬编码 `return false` → **报红** ✅

探针协议:`cp` → **行首锚定** perl 注入 → 先证注入落盘 → 跑 → `cp` 还原 → `md5sum` 逐字节比对。

```
① 注入落盘:  71:  return false // ===PROBE===
   md5 before=71eef266a4e2c867d0d9a3c146d546e5  after=9df98da7ab16619fd8bc39d700a1a131
② 跑:
   ✓ … > P5a…P5f 六批全部完成:占位清单已空,rail 9 个 tab 全部 isDeferred === false
   ✓ … > isDeferred 对每个已列 tab 返回 true
   × … > isDeferred 的判定来源是 DEFERRED_TABS 本身(清单已空:用临时非空清单证明机制仍能判真)
     → isDeferred 没在读 DEFERRED_TABS —— 塞进去了却仍判假: expected false to be true
   Test Files 1 failed (1)   Tests 1 failed | 2 passed (3)
③ 还原:restored=71eef266… expected=71eef266… match=YES
```

🔴 **注意②里那两条「✓」——这正是「不许只断空数组」的实证**:
把 `isDeferred` 挖成 `return false` 之后,**只断空数组的那两条照样全绿**,
**唯一报红的是临时非空清单那条**。机制的牙全在它身上。

#### 3c 🔴 清空后机制仍有牙 ✅

- 空数组下 `isDeferred(任意)` 为 `false`:**逐个列全 9 个 rail tab**(不是只断空数组),
  且配「表必须真是 9 项」的防空转锚点。
- 🔴 **临时非空清单**:`as const` 只在编译期,数组对象运行时可变 ⇒ `push('wiki')` 后
  `isDeferred('wiki')` 必须为 `true`、`isDeferred('roots'/'allowlist')` 仍为 `false`
  (证明它做的是**成员检查**而非恒真),`finally` 清空 + **还原自证**两条。

#### 3d 🔴 「路由改回占位 → 必须报红」:**三条路由各试一次,全部报红** ✅

```
baseline md5=2bd03aef35ca76de559fed10b409c5c3

探针 wiki → KnowledgeDeferred
  ① 136:      { path: 'wiki', name: 'KnowledgeWiki', component: KnowledgeDeferred },
  ② × … 占位页零残留(SP8-P5 六批收官)        Tests  1 failed | 2 passed (3)
探针 roots → KnowledgeDeferred
  ① 140:      { path: 'roots', name: 'KnowledgeRoots', component: KnowledgeDeferred },
  ② × … 占位页零残留(SP8-P5 六批收官)        Tests  1 failed | 2 passed (3)
探针 allowlist → KnowledgeDeferred
  ① 142:      { path: 'allowlist', name: 'KnowledgeAllowlist', component: KnowledgeDeferred },
  ② × … 占位页零残留(SP8-P5 六批收官)        Tests  1 failed | 2 passed (3)

③ restored=2bd03aef35ca76de559fed10b409c5c3  expected=同  match=YES
```
⇒ **不是「三门全绿」的无守卫反转**,无需按 Important 自报。

**守卫形态变化说明**:此前每一代靠「剩下 N 条仍 === KnowledgeDeferred」证明机制活着;
清空后那写法会退化成**空循环**。故改成方向相反的两条:
① 11 条路由的 component 里 `KnowledgeDeferred` 出现 **0 次**;
② 防空转锚点 —— 必须确实取到 **11** 个 component 且**每个都非 null**
(否则「0 次」可能只是压根没取到东西);另加子路由 path 清单断言,防「删掉一条路由也绿」。

### DoD-4 🔴🔴 构建管线门(**顺序未颠倒:先抓改前证据**) ✅

#### 改前(本刀任何 `src/` 改动之前,第一件事就跑)

```
$ rm -rf dist && pnpm build && grep -o "kw-split\|AllowlistView\|RootsView\|WikiView" dist/assets/*.js
build exit=0
--- grep BEFORE ---
grep exit=1 (零输出)
--- count ---
0
```

**同一份 dist 上的防空转锚点**(证明这条 grep 口径**有能力**命中):

| `__name` | 改前命中 |
|---|---|
| DashboardView / QueueView / IndexedFilesView / SettingsView / NotesView / SearchView | **各 1**(已迁 6 页) |
| **WikiView / RootsView / AllowlistView** | **各 0** |
| `kw-split`(JS 侧) | **0** |
| `kw-split`(**CSS 侧**) | **2** ← 🔴 见下 E-8 |

#### 改后

```
$ rm -rf dist && pnpm build && grep -o "kw-split\|AllowlistView\|RootsView\|WikiView" dist/assets/*.js
build exit=0
      1 dist/assets/index-BmIDaUWC.js:AllowlistView
      1 dist/assets/index-BmIDaUWC.js:kw-split
      1 dist/assets/index-BmIDaUWC.js:RootsView
      1 dist/assets/index-BmIDaUWC.js:WikiView
总命中数 4
```

#### 🔴 判据上下文感知(承 E-25)—— 逐个贴命中处上下文,证明只能来自**真实编译代码**

```
───── WikiView @ 5729051 ─────
 …_hoisted_54$1={key:4,class:"kw-foot"},_sfc_main$4=defineComponent({__name:"WikiView",setup(r){…

───── RootsView @ 5740810 ─────
 …_hoisted_38$2={class:"k-modal-foot"},_sfc_main$3=defineComponent({__name:"RootsView",setup(r){…

───── AllowlistView @ 5752198 ─────
 …_hoisted_60=["disabled"],_sfc_main$2=defineComponent({__name:"AllowlistView",setup(r){…

───── kw-split @ 5727059 ─────
 …function renderWikiMarkdown(r){return renderMarkdown(r)}const _hoisted_1$4={class:"kw-split"},…
```
三个 `defineComponent({__name:…})` + 一个编译器 hoist 出来的 `{class:"kw-split"}` vnode props
⇒ **全部是真实编译产物,零注释/零字符串误命中。**

#### 🔴 CSS 命中不作 JS 证据(承 E-8)

`kw-split` 在 **CSS 侧改前就已 2 命中、改后仍 2 命中**(本期 scss 从 T2 起就进产物)。
**0 → 4 的变化全部发生在 JS 侧**,这才是「模块真正进了 Vite 图」的证据。

### DoD-5 · 收官口径六个数字(**全部本刀自己实测**) ✅

| # | 项 | 终值 | 取数命令 |
|---|---|---|---|
| ① | 测试文件数 | **339** | `pnpm exec vitest run --reporter=verbose` |
| ② | 用例数 | **4659** | 同上 |
| ③ | `.vue` 总数 | **188** | `find src -name '*.vue' \| wc -l` |
| ④ | `color-guard` 用例数 | **190** | `pnpm exec vitest run src/styles/color-guard.test.ts` |
| ⑤ | `aiKb*` 键数 | **zh 520 / en 520** | 真实模块导入(见下) |
| ⑥ | 全表键数 | **zh 1727 / en 1727**,**差集均空** | 同上 |

🔴 **⑤⑥ 用真实模块导入计数**(文本解析会少算):把 `zh_cn.ts` / `en_us.ts` 原样 `cp` 成 `.mjs`
(两文件是纯 `export default { … }`,无 TS 专有语法)后 `import()`,取 `Object.keys`:
```
⑤ aiKb* 键数  zh=520  en=520
⑥ 全表键数    zh=1727  en=1727
   差集 zh-en=[]  en-zh=[]
```

#### 🔴 用例数归因表(与总数自洽,承裁定 R24)

| 文件 | 改前 | 改后 | Δ |
|---|---|---|---|
| `deferred.test.ts` | 3 | **3** | 0(两条用例**内容反转**,非删一条加一条) |
| `knowledgeRoutes.test.ts` | 3 | **3** | 0(一条用例内容反转) |
| `views/WikiView.test.ts` | 100 | **101** | **+1**(I-1 的 `kw-sec-en` 守卫) |
| 其余 336 文件 | — | — | 0 |
| **合计** | **4658** | **4659** | **+1** ✅ |

测试**文件数不变**(339 → 339):本刀零新建测试文件。
`.vue` 与 `color-guard` 也不变(本刀零新建 `.vue`)—— 与治理 §8.1 的收官预测 **188 / 190** 吻合。

🔴 **「用例数不变可能掩盖删一条加一条」的排查**:已贴出 `deferred` / `knowledgeRoutes`
两文件改后的**逐条用例名**(§5),配合 §1.1 的「删除行 100% 留档」自证 ⇒ 无隐藏增删。

### DoD-6 · 死键核查 ✅ —— **零死键**

口径(brief 原文逐字):
```
grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'
```
键源:`zh_cn.ts` / `en_us.ts` 里 `>>> SP8-P5f Task 1` … `<<< SP8-P5f Task 1` 块内、
**行首两空格锚定**提取 ⇒ **zh 79 / en 79,键名差集为空**(与 T1 报告的 79 吻合,但本刀自测未采信)。

```
总键数=79   直接消费=79   零消费=0
零消费键清单:(空)
防空转自证:aiKbNavWiki → src/ai/knowledge/views/KnowledgeLayout.vue ✅(口径确有命中能力)
```

🔴 **口径事故与复证(本刀自己逮到,承 R13 / R21)**:
本 shell 的 `grep` 是一个 **函数包装**(Claude Code 的 ugrep,带 `--ignore-files` ⇒ **遵守 .gitignore**),
它导致 `grep -r … .` **静默跳过 `.superpowers/`**,我一度据此得出错误结论。
⇒ **用 `/usr/bin/grep` 真二进制整套重跑**:
```
总键数=79  直接消费=79  零消费=0        ← 与包装版一致
两条口径一致? YES
src/ 下被 gitignore 的 .vue/.ts 文件:(空) ⇒ 两版 grep 覆盖面相同
```

#### 间接消费逐条落地(brief:间接消费要逐条核实,不算死键)

79 条里 **63 条**是直接 `t('key')`;**16 条**不是无参 `t()` 形式,逐条核实如下:

- **12 条**是**带占位符**的 `t('key', {…})`(我的分类器只认无参形式,故被归到「间接」):
  `aiKbAlAddedExt` · `aiKbAlAllSelected` · `aiKbAlAllDeselected` · `aiKbAlNowIndexing` ·
  `aiKbAlStoppedIndexing` · `aiKbRtScanEvery` · `aiKbWkItemCount` · `aiKbWkRenderNote` ·
  `aiKbWkSummaryUpdated` 等 —— **全部有直接调用行**,已逐条贴出出处。
- **3 条**是 `AllowlistView.vue` 的 `GROUPS_TEMPLATE.labelKey` 动态键
  (`aiKbAlGroupDocuments` / `aiKbAlGroupText` / `aiKbAlGroupCode`)——
  落地点 `t(g.labelKey)`(模板 + `:244/:245` 两处),**已实见**。
- **4 条**是 `WikiView.vue` 的 `OP_LABEL_KEYS` 动态键
  (`aiKbWkOpAdded` / `aiKbWkOpUpdated` / `aiKbWkOpRemoved` / `aiKbWkOpRenamed`)——
  落地点 `:322 label: t(OP_LABEL_KEYS[c.op] || 'aiKbWkOpUpdated')`,**已实见**。

⇒ **79 / 79 全部有真实消费点,零死键。**

### DoD-7 · 验收导航路径核实 ✅

#### rail 序号(🔴 自己现测,**两条独立口径**,承 R21)

```
口径①(源码常量 KnowledgeLayout.vue 的 NAV,顺序即 rail 顺序)
  1 dashboard  2 search  3 wiki  4 notes  5 indexed-files
  6 queue      7 roots   8 allowlist      9 settings

口径②(渲染后的 DOM,KnowledgeLayout.test.ts 现跑)
  findAll('.k-rail-item') → 9 项
  ['Dashboard','Search','Wiki','Notes','Indexed Files','Queue','Index Roots','Allowlist','Settings']
```
⇒ 🔴 **wiki = 第 3 · roots = 第 7 · allowlist = 第 8**,与裁定 **R10** 一致;
**计划书原写的 3/6/7 是错的**(已由 §0.0 订正块作废,本刀实测再次坐实)。

⚠️ **两个 rail 中文标签与 brief 的措辞不同,按现测为准**:
`aiKbNavRoots` = **「索引目录」**(brief 写「索引目录」✅);
`aiKbNavAllowlist` = **「索引范围」**,**不是**「白名单」(brief 括号里写的是「白名单」)。
验收清单写这一项时请用**界面上真实显示的「索引范围」**,否则机主找不到。

#### 导航路径

`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 **3** / **7** / **8** 项。
rail 每项 `href` 形如 `#/ai/knowledge/<tab>`(`KnowledgeLayout.test.ts` 实测:
`hrefs[0]='#/ai/knowledge'` · `hrefs[1]='#/ai/knowledge/search'` · `hrefs[8]='#/ai/knowledge/settings'`)。

#### 🔴 可直接粘贴的深链 URL(`<host>` 换成设备地址;dev 验收端口按本工作区约定 `:5288`)

```
Wiki(第 3 项)          http://<host>:5288/app/#/ai/knowledge/wiki
索引目录(第 7 项)      http://<host>:5288/app/#/ai/knowledge/roots
索引范围(第 8 项)      http://<host>:5288/app/#/ai/knowledge/allowlist

🔴 WikiView 的 ?path= 深链(蓝本 :210-214 的 watch + loadTree 里读一次):
  http://<host>:5288/app/#/ai/knowledge/wiki?path=/DATA
  http://<host>:5288/app/#/ai/knowledge/wiki?path=/DATA/Documents
```

#### 🔴 **rail 9 项现在零占位页**

`knowledgeRoutes.test.ts` 的「零占位」断言 + 三条 RED 探针共同坐实:
11 条路由(9 子路由 + 2 条 parser 顶层路由)的 component 里,`KnowledgeDeferred` 出现 **0 次**。
⇒ **若验收时还看到「即将上线」占位提示,那是缺陷。**

### DoD-8 · T7 评审 Important I-1 闭合 ✅

`WikiView.vue:684` `<span class="kw-sec-en">Contents</span>` 与 `:707` `Recent changes`
是**蓝本未过 `$t()` 的装饰文案**(附录 A §A.4 / 治理 §3.5 明令照抄),
但此前**零守卫** —— 评审把两处 i18n 化后单文件 100 绿、全仓 4658 全绿。

新增守卫(**含防空转前置**):
```ts
expect(w.find('.kw-children').exists()).toBe(true)   // 前置:目录区真渲染
expect(w.find('.kw-changes').exists()).toBe(true)    // 前置:最近变更真渲染
expect(w.findAll('.kw-sec-en').map((n) => norm(n.text())))
  .toEqual(['Contents', 'Recent changes'])
```

🔴 **判据实测(改成 `$t(...)` → 必须报红)**:
```
① 注入落盘: 684:  <span class="kw-sec-en">{{ t('aiKbWkContents') }}</span>
             707:  <span class="kw-sec-en">{{ t('aiKbWkRecentChanges') }}</span>
   md5 before=938098e0cda42b46d52426e926d78761  after=dddbdb05ebde50ff3aeee7928f1fec1f
② × … 🔴 两处 `kw-sec-en` 必须是英文字面量,不许过 $t()
   AssertionError: kw-sec-en 被 i18n 化了 …:
     expected [ '子项清单', '最近变化' ] to deeply equal [ 'Contents', 'Recent changes' ]
   Test Files 1 failed (1)   Tests 1 failed | 100 passed (101)
③ restored=938098e0cda42b46d52426e926d78761  match=YES
```
🔴 报红信息**逐字复现了评审预言的视觉后果**:两侧都变成中文(「子项清单 / 最近变化」)。

🔴 **只许新增自证**:`git diff --numstat src/ai/knowledge/views/WikiView.test.ts` → **`25  0`**;
`git diff -U0 | grep -c '^-[^-]'` → **`0`**(既有每一行零改动)。

### DoD-9 · M-5 顺手订正(**只改注释**) ✅

P5e-T8 已订正过 P5c-T10 那一段;**M-5 本期复发了两处**(都是现在时的状态快照):
- P5d-T10 段:「剩下 **4** 个子路由 … **仍指** KnowledgeDeferred」
- P5e-T8 段:「剩下 **3** 个子路由 … **仍指** KnowledgeDeferred」

两处均按「反转不删」保留原文 + 追加**带时点的历史记录订正块**,并写死一条**通用读法**:
> 本文件头是逐代追加的谱系,每段只描述该刀落笔那一刻的状态;
> **当前最新状态永远以最后一段反转记录为准,不要引用中间任何一段的「剩下 N 个」。**

🔴 **自证:M-5 那部分非注释行改动 = 0。** `knowledgeRoutes.ts` 的**全部**非注释改动行:
```
+import WikiView from './views/WikiView.vue'
+import RootsView from './views/RootsView.vue'
+import AllowlistView from './views/AllowlistView.vue'
-      { path: 'wiki', …, component: KnowledgeDeferred },   +  … component: WikiView },
-      { path: 'roots', …, component: KnowledgeDeferred },  +  … component: RootsView },
-      { path: 'allowlist', …, component: KnowledgeDeferred }, + … component: AllowlistView },
```
⇒ 只有 **DoD-2** 要求的 3 import + 3 路由反转,**没有第七行**。

### DoD-10 · `openNoteInNewTab` 最终处置 ✅ —— **继续不补,转下一期**

🔴 **自己重新复核(四条独立口径,不采信 T0)**:
```
口径① grep -rnw "openNoteInNewTab" src/                    → 零命中
口径② 本期三页各自计数 WikiView/RootsView/AllowlistView    → 0 / 0 / 0
口径③ src/ai/services/openInApp.ts 的全部 export 逐条列出   → 10 个导出,无 openNoteInNewTab
口径④ git grep -l "openNoteInNewTab" -- 'src/*'             → 零文件
防空转:姊妹函数 openFileInNewTab → 4 个消费文件 ✅(口径确有命中能力)
```
台账侧交叉印证:它是**蓝本 `openInApp.js:112-115` 的函数,New-UI 从未移植**
(P5d-plan §479 / P5d-task-5 报告与评审 / P5e 治理 §587 一致)。
⇒ **本期三页零调用点,补了就是死代码 ⇒ 继续不补,转下一期。**

---

## 3. 三门(全量、落盘、未 `| tail`)

| 门 | 命令 | 结果 |
|---|---|---|
| 测试 | `pnpm exec vitest run --reporter=verbose` | **exit 0 · Test Files 339 passed (339) · Tests 4659 passed (4659)** |
| 类型 | `pnpm exec vue-tsc --noEmit` | **exit 0**(日志 0 行) |
| 构建 | `pnpm build` | **exit 0** · `✓ built in 13.87s` |

**具名 failed 用例:无**(`grep -aE "^ *× |^ *FAIL "` 零命中)。
**已知噪声 `persist.test.ts > dropPersisted …` 与 `AgentComposer.test.ts` 本次均未触发。**

🔴 **本刀逮到的第二个口径事故(申报)**:第一次跑
`pnpm test --reporter=verbose > …` 时,**pnpm 没有把 `--reporter` 透传给 vitest**
(日志里是 `> vitest run`,全文仅 13 行)⇒ 那次实际跑的是默认 reporter,
不满足「一律 `--reporter=verbose` 并核到具名 failed 用例」(R13 同族)。
**已换成 `pnpm exec vitest run --reporter=verbose` 重跑全量**(日志 19058 行),
数字一致(339 / 4659),证据以重跑那份为准。

### 归因

`4658 → 4659 = +1`,来源见 §DoD-5 的归因表(唯一新增 = `WikiView.test.ts` 的 I-1 守卫)。

---

## 4. K/N 条目申报

| 编号 | 命中处 |
|---|---|
| **K7 / K8** | 占位机制本身**保留**;`DEFERRED_TABS` 清空但守卫改成有牙的形态 |
| **P4 I2**(承) | 「留了代码没留能力」——本刀落成三层守卫,并实证「只断空数组」零判别力 |
| **R10** | rail 3/7/8 自测坐实;`openNoteInNewTab` 继续不补 —— 两项均按 R10 终值 |
| **R13**(承) | 「没看到 ≠ 不存在」——`grep` 包装事故即本条的实例,已换独立口径复证 |
| **R18 / R21** | 机制钉子「一字不许动」实测不成立 → 两条独立口径 + 原始输出双贴后申报订正 |
| **R19 / R26-3 / R28**(承) | 本刀所有「从源文件抽取/判存在」均**行首锚定**(perl `^…$` + `/m`),零裸子串 |
| **§9.10** | 守卫**只加固不放宽**:路由侧由「N 条仍是占位」换成「零占位 + 两条防空转锚点 + path 清单」,判别力**增强**(三条 RED 实证) |
| **§9.20** | 全部四项落地(见 DoD-3) |
| **E-8 / E-13 / E-25** | 构建管线门:CSS 命中不作 JS 证据 · 三页第一次入口可达 · 判据上下文感知 |
| **M-5** | 两处现在时注释订正(纯注释) |
| **T7 评审 I-1** | `kw-sec-en` 守卫补齐 |

### 🔴 额外申报(brief 未点、我主动登记)

1. **`knowledgeRoutes.ts` 的 `KnowledgeDeferred` import 反转后成了「未被引用的 import」。**
   **刻意保留不删**,理由写进了源码注释:它是 K7 机制在生产侧的唯一锚点,删掉后
   `KnowledgeDeferred.vue` 全仓零生产 import;且 `noUnusedLocals` 未开启,
   `vue-tsc` 与 `vite build` 均 exit 0(已实测)。测试侧仍逐条 `not.toBe(KnowledgeDeferred)` 消费它。
   ⇒ **若评审认为该删,是一行的事,但我判断保留更符合 K8 / §9.10。**
2. **`deferred.test.ts` 的 `it('isDeferred 对每个已列 tab 返回 true')` 清空后成了空循环、零判别力。**
   **本刀未改它的断言体**(承本文件五代「只加不改既有断言」的惯例),只在其上方加注释说明:
   判别力已由「机制钉子」的临时非空清单接管;将来清单一旦再非空,这行**自动重新上膛**。
3. `deferred.test.ts` 的 import 行扩了一个 `type KnowledgeTabId`(新用例要列全 9 个 tab 需要它)。

---

## 5. 改后逐条用例名(供评审逐条对比改前/改后)

```
✓ deferred.test.ts > 占位机制(K7) > P5a…P5f 六批全部完成:占位清单已空,rail 9 个 tab 全部 isDeferred === false
✓ deferred.test.ts > 占位机制(K7) > isDeferred 对每个已列 tab 返回 true
✓ deferred.test.ts > 占位机制(K7) > isDeferred 的判定来源是 DEFERRED_TABS 本身(清单已空:用临时非空清单证明机制仍能判真)
✓ knowledgeRoutes.test.ts > knowledgeRoutes > 一条布局路由带 9 个子路由 + 两条 Parser 路由
✓ knowledgeRoutes.test.ts > knowledgeRoutes > 路由名逐字照 Vue2
✓ knowledgeRoutes.test.ts > knowledgeRoutes > 父路由(布局位)是 KnowledgeLayout,9 个子路由与两条 parser 路由**全部**是真组件 —— 占位页零残留(SP8-P5 六批收官)
✓ WikiView.test.ts > WikiView —— kw-sec-en 装饰文案照抄字面量(附录 A §A.4 / T7 评审 I-1) > 🔴 两处 `kw-sec-en` 必须是英文字面量,不许过 $t()
```

---

## 6. 探针纪律核对

| 探针 | 协议 | 还原 |
|---|---|---|
| `isDeferred → return false` | `cp` → 行首锚定 perl → 先证注入落盘 → 跑 → `cp` 还原 | `md5sum` **逐字节一致** |
| 三条路由改回占位(×3) | 同上,每条独立注入并先证落盘 | `md5sum` **逐字节一致** |
| `kw-sec-en` i18n 化 | 同上,两行各自行首锚定 | `md5sum` **逐字节一致** |

🔴 **全程零 `git checkout` / `git restore` / `git stash` / `git reset` / `git rebase` / `--amend`。**

---

## 7. 顾虑 / 交接

1. 🔴 **`aiKbNavAllowlist` 的中文是「索引范围」,不是「白名单」** —— brief 与验收清单若写「白名单」,
   机主在界面上找不到。**建议协调者写清单时改用「索引范围」。**
2. 🔴 **`KnowledgeDeferred` 的未引用 import**(见 §4 额外申报 1)—— 请协调者/终审拍板去留。
3. 🔴 **`deferred.test.ts` 的空循环用例**(见 §4 额外申报 2)—— 未改断言体,若终审要求加防空转锚点,一行即可。
4. **本刀两次逮到自己的口径错误**(`grep` 包装的 `--ignore-files` · `pnpm` 不透传 `--reporter`)。
   🔴 **建议写进后续常驻纪律**:
   - 本工作区的 `grep` 是 **gitignore-aware 的函数包装**,扫**被 gitignore 的目录**(如 `.superpowers/`)
     必须用 `/usr/bin/grep`;
   - `pnpm <script> --flag` **不透传**,一律 `pnpm exec vitest run --reporter=verbose`。
5. **未部署 · 未 push · 未合 master。** `sp8-ai` 合 master 仍是非快进 + 4 个冲突文件,
   与 `sp7-photos` 的合并顺序待用户拍板。
6. **D1 相关**:Wiki / 索引目录两页在本机因后端 38 GB `file_events` 超时而大半不可达,
   仪表盘 60 秒骨架是预期行为 —— 验收清单必须按治理 §13-5 主动告知。

---

## 8. 🏁 收官

**`DEFERRED_TABS` = 0 · 11 条路由零占位页 · rail 9 项全部落到真页面。**
**SP8-P5 六批(P5a 壳+仪表盘 / P5b 索引运维 / P5c 配置+Parser / P5d 笔记 / P5e 搜索 / P5f 最后三页)全部完成。**
