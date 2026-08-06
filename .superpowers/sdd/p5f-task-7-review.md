# SP8-P5f · Task 7 独立评审 —— `WikiView.vue` 下半

| | |
|---|---|
| 被评审提交 | **`db56e48`**(起点 `207299f`) |
| 工作树 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai`,评审全程 `git status --porcelain` **零输出** |
| 评审口径 | 🔴 **零采信实现者报告** —— 每条结论均为评审自读源文件 / 自跑探针 / 自数 |
| 探针纪律 | 全部 `cp` 备份 → Python 精确唯一锚点注入(`count==1` 断言)→ 先证注入落盘 → 跑 → `cp` 还原 → `md5sum -c`。**全程零 `git checkout / restore / stash / amend / reset / rebase`**;未部署 / 未 push / 未合 master |
| 基线 md5 | `WikiView.vue` `938098e0cda42b46d52426e926d78761` · `WikiView.test.ts` **`de90ccc8a28457c1aae05fd90a632c0e`** |

**分级结论:Critical 0 / Important 1 / Minor 9。**

---

## 0. 三门(评审自跑,全部落盘,未用 `| tail`)

```
$ pnpm test                     → exit 0    Test Files  339 passed (339)    Tests  4658 passed (4658)
$ pnpm exec vue-tsc --noEmit    → exit 0    日志 0 行
$ pnpm build                    → exit 0    ✓ built in 13.76s
```
红项 **0**;已知噪声(`persist.test.ts > dropPersisted` · `AgentComposer.test.ts`)本次**未复现**。

### 0.1 🔴 「+46 全在 `WikiView.test.ts`、其余 338 文件零变化」(裁定 R24-P5e)—— **评审自证,不采信报告的算术**

不满足于「4612 + 46 = 4658」这种引用式自洽,评审**把 T6 的两个文件原样放回工作树跑了一遍全量**:

```
$ git show 207299f:src/ai/knowledge/views/WikiView.{test.ts,vue} → cp 进 src/
  md5: WikiView.vue 98b878455f9840af9cbd870cc37bacf0 / WikiView.test.ts f68e5050a738c0c1cad7cc2b38ef396a
$ pnpm test                                      → Test Files 339 passed / Tests 4612 passed
$ pnpm exec vitest run WikiView.test.ts          → Tests 54 passed
$ cp 还原 + md5sum -c                             → 两文件 OK
```
⇒ **T6 基线 4612 / 54 由评审独立坐实**;T7 落地 4658 / 100。
**其余 338 文件:4612 − 54 = 4558 == 4658 − 100 = 4558** ⇒ **零变化,成立。**
第二条独立口径(承 R21):`git diff --name-only 207299f..db56e48` 只有 **4** 个文件,
`src/` 侧只有 `WikiView.{vue,test.ts}`;另外四个引用 `WikiView` 的测试文件
(`wikiViewHelpers` 53 / `RootsView` 63 / `knowledgeStyles` 422 / `messageSyntax` 136)内容零改动,
且它们的参数化维度是「`.vue` 文件清单」与「i18n 键表」,本刀两者都没动。

### 0.2 §9.14-4 参数化防空循环 —— **`--reporter=verbose` 具名核到**

```
$ pnpm exec vitest run --reporter=verbose src/ai/knowledge/views/WikiView.test.ts
  Tests 100 passed (100);具名 ✓ 100 条;`↓ / skipped / todo` 零命中
  ✓ … OP_LABEL_KEYS —— op='create' 的标签文案是「'新增'」
  ✓ … op='modify'「'更新'」 / op='delete'「'已删除'」 / op='rename'「'重命名'」 / op='chmod'「'更新'」
```
🔴 **5 条 `it.each` 逐条独立执行,不是一条**;`OP_LABEL_CASES.length === 5` + `new Set(op).size === 5`
两条钉桩防「表被改短 ⇒ 循环空转」。**成立。**

---

## 1. 🔴 第一必查项(四组,全部评审亲手复现)

### 1.1 🔴🔴 XSS 用例是不是真的走了 `renderMarkdown` —— **是,不是安慰剂**

**(a) 静态口径**:`grep -n "vi.mock" WikiView.test.ts` → **仅两处**
(`@nimotech/nimoos-service` · `../../services/openInApp`)。**全文件零 `vi.mock` 掉 markdown 模块。**

**(b) 变异口径①(评审自做,brief 指定)** —— 把 `html` 换成 `raw` 直通(绕开消毒器):
```
- const html = computed<string>(() => renderWikiMarkdown(raw.value || ''))
+ const html = computed<string>(() => (raw.value || ''))
Tests  4 failed | 96 passed (100)
  × §9.15 … 🔴 注入 <script> 与 onerror ⇒ DOM 里没有 script 元素、没有 onerror 属性
  × §9.15 … 🔴 正常路径:`.REAL` 的真 .wiki.md 原文渲染出标题 / 列表 / 行内 code,且零 script
  × N55 ①/③(连带:`.kw-summary` 的文本断言依赖真渲染)
```

**(c) 变异口径②(评审加做)** —— 亲手 `vi.mock('../../markdown/renderMarkdown', …)`:
```
Tests  5 failed | 95 passed (100)
  × 🔴 前置自证:`renderMarkdown` **没有**被 mock(判据:谁去 vi.mock 它,本条立刻报红)
  × 🔴 注入 <script> 与 onerror … / × 🔴 正常路径 `.REAL` … / × N55 ①③
```
⇒ **反安慰剂的元守卫本身有牙**。

**(d) 载荷与真实 DOM(评审自读断言体)**:用例喂的是含 `<script>alert(1)</script>` 与
`<img src=x onerror=1>` 的 markdown,挂载真组件后查 **真实 DOM**:
`el.querySelector('script')` null · 整页 `querySelectorAll('script').length === 0` ·
**逐元素** `hasAttribute('onerror')` 过滤后为 `[]` · `querySelector('img')` null ·
防空转三条(`h1`/`li`/`code` 文本仍在)· 危险串以转义纯文本留在 `textContent`(证明确实到达)。
🔴 **申报口径正确**:不查 `innerHTML` 文本(`markdown-it` 的 `html:false` 会把它转义成可见文本,
查文本零判别力)—— **评审认可这条申报。**

**裁断:§9.15 满足,不按 Critical 报。**

### 1.2 🔴 `childClick` 两分支各自独立报红 —— **成立**

| 注入 | 结果 | 具名 failed |
|---|---|---|
| `if (false) select(full) else openFileInNewTab(full)`(一律 openFile) | `2 failed \| 98` | **分支 A**(byPath 命中 ⇒ select)+ **N58 根路径**那条 |
| `if (true) select(full) else openFileInNewTab(full)`(一律 select) | `1 failed \| 99` | **分支 B**(未命中 ⇒ openFileInNewTab) |

分支 A 那侧多出来的 1 条(N58 根路径)经评审逐行核实是**同因连带**:
该用例也点一个子项并断「就地换文章 + `openFileInNewTab` 未被调」,一律 openFile 必然打破它。
**不是判别力缺陷,不记账。** 两分支**各自都有一条只属于自己的红**,brief 的要求满足。

### 1.3 🔴 `.slice(0, 10)` 与前缀剥离 —— **三侧全部成立**

| 注入 | 结果 | 具名 failed |
|---|---|---|
| 去掉 `.slice(0, 10)` | `1 failed \| 99` | **`.slice(0, 10)` 上限:抄本 12 条只渲染 10 条** |
| 前缀**一律不剥**(`name: c.path`) | `2 failed \| 98` | **前缀剥离两侧** + slice 那条(连带,12 条全出来了) |
| 前缀**一律剥**(`name: c.path.slice(prefix.length)`) | `1 failed \| 99` | **前缀剥离两侧** |

⇒ 「命中前缀 → 相对路径」与「不命中 → 全路径」**两侧各自可分辨**(第三侧
「`owningRoot` 为 null ⇒ prefix 为空串 ⇒ 一条都不剥」另有一条,读源码确认存在)。

### 1.4 🔴 R28 前置真的闭合了,而且是**加固**不是放宽 —— **成立**

**(a) 改回裸 `indexOf` → 必须报红**(评审自注入):
```
- 第 0 列锚定循环
+ let openAt = src.indexOf('<template>') - OPEN.length + '<template>'.length
Tests  4 failed | 96 passed (100)
  × 🔴 覆盖度自检(裁定 R28)—— 两条独立推导逐字相等 + 片段延伸到模板最后一行
  × 🔴 反向防空转(裁定 R28)—— 抽出块**不许**含 `<script setup`
  × 🔴 真实文件偏态 A(裁定 R28)—— 文件头注释里写了 kw-summary,但只有注释 ⇒ 必须判「没上膛」
  × 防空转② —— 谓词双向可分辨
```

**(b) 两种偏态各验一次(评审自做,不采信报告的 probe1b/probe2)**

- **偏态 A(必须绿)** —— 评审把一句 `【探针】摘要区写成 <div class="kw-summary kw-md" v-html="html"/>(仅注释,非真 markup)。`
  注入到**真实 `WikiView.vue` 文件头注释的收尾 `-->` 之前**(= 裸锚点之后,R28 预言 T7 必踩的那个位置):
  ```
  Tests  100 passed (100)      ← 🔴 零假报红,R28 后果① 正式闭合
  ```
- **偏态 B(必须红)** —— 把 `kw-foot` 里的 `<button @click="showSource = !showSource">…</button>` 整块换成注释:
  ```
  Tests  5 failed | 95 passed (100)
    × 🔴 本体条件断言:模板一旦出现 kw-summary,就必须同时有 showSource 切换按钮(T7 起已上膛)
    × 每次取文章都把 showSource 重置回 false / × 源码视图走 {{ raw }} 文本插值
    × ② raw 非 null + showSource=true → pre.kw-rawsrc / × 文案在「查看原文」/「渲染视图」之间翻转
  ```
  🔴 **自动上膛守卫的本体条件断言确实报红 ⇒ 上膛成功。**
  另有一条「上膛状态自证」把「不再走惰性分支」程序化钉死 —— **这是比 brief 要求更强的做法,认可。**

**(c) 🔴 核剥注释器要求 `/*` 前是空白或行首(承 R26-3)** —— **成立**。
源码是 `.replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)`(`^` 无 `m` 标志 ⇒ 只匹配串首;否则必须 `\s`)。
评审把该函数**逐字抽出到 node 里**跑对照:
```
payload:  const A = '/Downloads/*'  /  const KEEP = "class=\"kw-summary kw-md\""  /  const B = '*/'
本刀 blankComments → "const A = '/Downloads/*'\nconst KEEP = \"class=\\\"kw-summary kw-md\\\"\"\nconst B = '*/'\n"
裸正则     naked    → "const A = '/Downloads   \n                                         \n             '\n"
本刀吃掉真代码? false        裸正则吃掉真代码? true
```
⇒ **路径字面量骗不开假注释,真代码没被吃掉。R26-3 满足。**

**(d) 🔴 `git diff` 逐行核「没有放宽任何既有断言」(§9.10)** —— **成立**。
`git diff 207299f..db56e48 -- WikiView.test.ts | grep -c "^-[^-]"` = **41**,逐条归属:

| 组 | 行 | 评审判定 |
|---|---|---|
| `extractTemplate` 旧实现 + 3 个调用点 + 1 条注释措辞 | 11 | **裁定 R28 前置**;旧实现原文留档在新函数文档注释里(守「反转不删」)。**新增 4 条全是更强约束** |
| 本体条件断言的标题与惰性分支措辞 | 3 | 断言体零改动,标题从「尚无 ⇒ 惰性通过」改成「一旦出现就必须有(已上膛)」= **收紧** |
| **6 条「改黑盒」** | 27 | 全部由 `w.vm` 读值换成 DOM 断言,且多条**加了新断言**(如 404 那条多断 `.kw-foot` 也不在)⇒ **等价或更强** |

**未发现任何一条被削弱。**

---

## 2. 🔴 移植忠实性

### 2.1 逐字对蓝本 `:76-141` —— **程序化比对,零差异**

评审自写归一器(剥 HTML 注释 → `$t('字面量'` 与 `t('键'` 双向归一成 `T(` → 折叠空白 → 按标签切行),
对蓝本 `:83-141` 与本仓 `:661-725`:
```
blueprint tokens: 52   newui tokens: 52
IDENTICAL after normalization
```
⇒ **模板结构 / DOM 顺序 / 类名 / 属性全部逐字一致。**
`:76-81`(`kw-meta`)归 T6,边界照裁定 R22-§4-① 执行,评审复核无误。

### 2.2 N58 / N49 / opToType / OP_LABEL_KEYS —— **全部照抄未化简**

- 🔴 **N58**:`WikiView.vue:468` `return (base === '' ? '' : base) + '/' + c.name` —— **恒等式原样在**,
  报告 §5 也点明了它是恒等式(不点明即漏报,已点)。**成立。**
- 🔴 `opToType` 未知 op → `'mod'` 兜底:`util/wikiViewHelpers.ts:127-132` 的
  `return 'mod' // modify + anything unknown reads as an update` —— **产品码零改动**(该文件不在 diff 里)。
- 🔴 `OP_LABEL_KEYS` 未知 op → `Updated`:`t(OP_LABEL_KEYS[c.op] || 'aiKbWkOpUpdated')` 在。
  **评审探针**:把兜底换成 `|| ''+c.op` → `1 failed | 99`,红的正是 `op='chmod'` 那条。**有牙。**
- 🔴 **N49**:`v-if="node && node.childMap.length"` 与 `(node.value ? node.value.recentChanges : [])` **都在**;
  抄本刻意留 `Archive` 一项三键全缺(omitempty 真形态)钉 `|| 0` / `|| ''` / `!!` 三个兜底。**成立。**

### 2.3 装饰文案未被顺手 i18n 化 —— **源码成立**(但**零守卫**,见 I-1)

`WikiView.vue:684` `<span class="kw-sec-en">Contents</span>` ·
`:707` `<span class="kw-sec-en">Recent changes</span>` · `:634` `>TREE</span>` —— **三处都还是字面量。**

### 2.4 结构性硬约束 —— 评审自跑「剥注释 + 第 0 列锚定」扫描

```
<style> 块(行首锚定,剥注释后)  → []        `</style>` 计数 → 0      ⇒ K44 成立
any(`: any` / `<any>` / `as any`)→ []                              ⇒ K41 成立
模板裸色(hex / rgb() / hsl())   → 零命中                            ⇒ 模板内零裸色
toast 调用                        → :446 / :506 / :508  **三处全是 `store.toast(t('…'))`**
useToast(剥注释后)              → 零命中(裸 grep 的 2 处全在注释里,承 R19)
```

### 2.5 🔴 `style=` / `:style=` / `color=` 处数 —— **评审自数 = 9**(未采信 §B.5)

剥注释后逐行、且用「非 `[\w-]` 前缀」锚定(防 `data-style=` 这类误命中):
```
:557 style="display: block; height: 22px; margin: 6px 8px"          ← 蓝本 :7
:565 style="margin-top: 8px"(重试按钮)                              ← 蓝本 :12
:579 :style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"            ← 蓝本 :22(唯一 `:style=`)
:633 style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"    ← 蓝本 :59
:646 style="margin-top: 18px; display: flex; …"                      ← 蓝本 :69
:648 :649 :650 :651  四条 k-skel 纯尺寸                               ← 蓝本 :70-73
TOTAL = 9    `color=` = 0
```
⇒ **与裁定 R27 末段的定案(9)逐处对齐**;🔴 **T7 的下半一处都没新增。**

### 2.6 fixture —— **三级标签、`__meta`、逐字节等价,评审自校**

| 抄本 | 标签是否写明 | `__meta` 混进代码体 | 评审的等价校验 |
|---|---|---|---|
| `wiki-node.CONSTRUCTED.json` → `NODE_RAW_DATA` | ✅ `.CONSTRUCTED` + 🔴「**不是真机数据**」 | ❌ 无(已转注释) | `json.load` 对读 → **11 个键全等、`recent_changes` 12 条、`child_map` 4 项,`EQUAL(json) = True`** |
| `wiki-raw-DATA.REAL.md` → `WIKI_RAW_REAL_EXCERPT` | ✅ `.REAL` + md5 + 「节选前 22 行、值一字未改」 | — | 与 fixture **前 22 行逐行 `==` 全等**;fixture md5 `c0449363eb1069a36c9941a0fb842e18` / 3430 B **实测吻合** |
| `wiki-tree` / `wiki-roots.normalized` | ✅(T6 既有) | ❌ 无 | T6 评审已核 |

🔴 **运行时零读 `.superpowers/`**:全文件 `superpowers` 仅 **1** 处命中,在注释里说明「为什么不读」。
🔴 `.CONSTRUCTED` **没有**被说成真机数据,也没被拿去推翻 N46(§9.18-2 满足)。

---

## 3. 🔴 缺口猎(评审十二条探针)

### 3.1 全部**成立**的守卫(评审逐条自注入,不采信报告)

| # | 注入 | 结果 | 具名 failed |
|---|---|---|---|
| E1 | 去掉重扫按钮的 `v-if="owningRoot"` | `1 failed \| 99` | **④ `owningRoot` 为 null 时重扫按钮整块不渲染** ⇒ §9.17 那条**有判别力** |
| E2 | 去掉 `!root ||` 那半道门 | `1 failed \| 99` | **owningRoot 为 null ⇒ 静默返回,零请求、零 toast** ⇒ 🔴 **T7 修后的版本真报红** |
| E3 | 去掉 `|| rescanBusy.value` 那半道门 | `1 failed \| 99` | **rescanBusy 在飞 ⇒ 第二发不发(函数门)** |
| J1 | 去掉按钮的 `:disabled="rescanBusy"` | `1 failed \| 99` | **对照层:第一发在飞时按钮真的是 disabled** |
| G3 | `OP_LABEL_KEYS` 兜底换掉 | `1 failed \| 99` | **op='chmod' 的标签文案是「更新」** |
| I1 | `{path}` 不拼 `/.wiki.md` | `2 failed \| 98` | **`{path}` 插值** + 「换选中之后跟着变」 |
| I2 | 去掉 `kw-foot` 的 `v-if="raw !== null"` | `2 failed \| 98` | **kw-foot 的 v-if** + N48 那条(连带) |
| H1 | 只去掉模板三元 | `100 passed` | 见 §4-② |
| H2 | 模板三元 **+** `fmtTs` 兜底同时去 | `1 failed \| 99` | **`c.lastModified ? fmtTs(...) : ""` 两侧** |

### 3.2 🔴 R27 处置的裁断 —— **对**

蓝本只有 `.kw-pending` 里那一个重扫按钮,且自带 `:disabled="rescanBusy"`;
`grep` 确认模板里 `@click="rescan"` **仅此 1 处** ⇒ **本页确实没有第二个无 `disabled` 的入口**。
T7 的处置(① 函数门用**直调 `vm.rescan()`** 同步连发两次验 · ② UI 层 `:disabled` 另立一条对照 ·
③ `rescanOf()` 自带 `typeof vm.rescan === 'function'` 前置防「没暴露到 vm ⇒ 整组静默失效」)
**三层都被评审探针独立坐实**(E3 / J1 各报红,前置断言读源码确认存在)。
⇒ 🔴 **这是 R27 常驻教训的正确落地**,处置**成立**,并已在测试文件头显式申报。

### 3.3 恒真填充断言排查 —— **未发现新增的恒真填充**

评审逐条读了 46 条新用例的断言体。以下三类**看似**恒真的,判定为**合规**而非填充:
- `expect(OP_LABEL_CASES.length).toBe(5)` / `new Set(op).size === 5` —— §9.14-4 明令的**防空循环钉桩**;
- `expect(SRC).toContain('<script setup')` / `toContain('const showSource = ref(')` —— **防空转前置**(否则上一条是空集断言);
- `expect(headerOnly.includes('class="kw-summary kw-md"')).toBe(true)` —— **对照断言**(证明裸子串谓词会判真),
  与 T6 既有的 `commentOnly.includes(...)` 同模具。
fixture 自检那一组的 `length`/键名断言是**漂移钉桩**(抄本被改就红),不是填充。

### 3.4 T6 评审六条「改黑盒」清单 —— **逐条照做,成立**

| # | 要求 | 评审复核(读 `git diff` 与现文件) |
|---|---|---|
| 1 | N55 ① 的 `vm.raw`/`vm.node.aiLabel`/`vm.sel` → DOM | ✅ 换成 `.kw-summary` 文本 / `.kw-child-name` 数组 / `.kw-crumb .cur`。**`aiLabel` 全页零渲染落点属实**(见 §4-④),改用 `nodeWithChild()` 落在 `.kw-child-name` 上,**取法正确** |
| 2 | N55 ③ 同上 | ✅ 并**多加**一条 `.kw-pending-title` 不出现 |
| 3 | N48 404 → 断 `.kw-pending` 出现且两个摘要面都不在 | ✅ 并**多加** `.kw-foot` 也不在 |
| 4 | K58 同 3 | ✅ |
| 5 | showSource 重置 → 点真按钮走 DOM | ✅ **全程零 `w.vm` 写入** |
| 6 | `vm.byPath = {}` **保留写入** | ✅ 一字未动 |

---

## 4. 🔴 T7 六条顾虑的裁断(逐条给评审自己的证据)

| # | 顾虑 | 裁断 | 评审证据 |
|---|---|---|---|
| ① | `!root` 门第一版零判别力(已自曝并修) | 🟢 **成立**,自曝准确、修法正确 | 评审 E2:去掉 `!root ||` → `1 failed`,红的正是那条,断言落在 **toast** 上(`not.toHaveBeenCalled()`)。推理也复核成立:门去掉后 `root.id` 先抛 `TypeError`,`rescanRoot` 照样没被调到 ⇒ 只断「没被调到」确实零判别力。**这是 §9.14 家族的一次正确自纠,登记表扬** |
| ② | `c.lastModified ? fmtTs(…) : ''` 与 `fmtTs` 自带兜底是恒等冗余对 | 🟢 **完全成立** | 评审 H1(只去模板三元)→ **`100 passed`**;H2(两处同去)→ `1 failed | 99`,红的正是「两侧」那条。⇒ 申报口径准确:守的是**可观测行为**,不是那个三元。**照抄不化简正确**(N58 同族,§9.10 / R26-4) |
| ③ | `rescanBusy` 门只由 `:disabled` 保护 | 🟢 **成立**,处置**正确** | 见 §3.2。三层各有独立红(E3 / J1),且 brief 点名的 jsdom 陷阱被显式规避 |
| ④ | `node.aiLabel` 全页零渲染落点(蓝本如此) | 🟢 **成立** | 评审自读:模板里 `aiLabel` 唯一落点是 `kw-meta` 的 `<b>{{ selAiLabel }}</b>`,而 `selAiLabel = selTreeNode?.aiLabel`(**树节点**,`byPath[sel]`),与 `/wiki/node` 回的 `ai_label` **永不相遇**。蓝本 `:79` / `:191` 逐字同款 ⇒ **属蓝本设计,照抄正确,不是漏抄** |
| ⑤ | 本机 `owningRoot` 恒 null ⇒ 重扫按钮永不渲染、前缀剥离永不生效 | 🟢 **成立,必须进验收清单** | `owningRoot = rootForPath(store.wikiRoots, sel)`;D1 下 `/v1/wiki/roots` 60 s 超时 ⇒ `wikiRoots` 恒空 ⇒ `rootForPath` 恒 null。评审探针 E1/G「roots 置空」两条用例正是这个态,`.kw-pending button` **不存在**、`.kw-change-name` 显示全路径。⇒ 🔴 **两条都要写进验收清单并标「D1 连带,不是缺陷」**,连同 T6 评审那条「进页约 60 s 冒一次『操作失败』toast」,**共三条** |
| ⑥ | 附录 B §B.5 已连错三行,建议终审核其余各节 | 🟢 **成立**,并**新增一条**:T7 的订正块本身有编号与口径瑕疵 | 评审现测 9 处与 R27 定案逐处对齐 ⇒ 订正的**数字是对的**。但 ⑴ 新块与既有 T5 块**同为 `B.5.1`**(编号重复);⑵ 块里给的现数命令 `grep -c 'style=\|:style=\|color='` 是**裸子串 + 行计数**口径(本期连栽三次的形态),恰好答案一致但方法不合本期硬纪律。见 M-5 |

---

## 5. 分级发现

### Critical —— **0**

### Important —— **1**

#### 🔴 I-1 · `kw-sec-en` 的两处装饰文案**零守卫** —— 顺手 i18n 化后全仓 4658 **全绿**

**为什么这是 Important**:治理 §3.5 / 附录 A §A.4 明令这两处「蓝本未过 `$t()` 的装饰文案,
**照抄字面量,不许顺手 i18n 化**」;`WikiView.vue` 的注释里也写了这句话两次。
**但整仓没有任何断言绑住它。** 这正是本期反复出现的「产品代码对、守卫为零」家族
(P5c 五次 / P5d 四次 / P5e 十一次 / 本期 R22-I1 · R24-I1 · R27-I1 · R28-I1)。

**评审探针(两条独立口径,承 R21)**
```
口径①(单文件)注入:
  - <span class="kw-sec-en">Contents</span>
  + <span class="kw-sec-en">{{ t('aiKbWkContents') }}</span>
  - <span class="kw-sec-en">Recent changes</span>
  + <span class="kw-sec-en">{{ t('aiKbWkRecentChanges') }}</span>
  $ pnpm exec vitest run --reporter=verbose src/ai/knowledge/views/WikiView.test.ts
    Tests  100 passed (100)          ← 零报红

口径②(全仓)同一份注入:
  $ pnpm test
    Test Files  339 passed (339)     Tests  4658 passed (4658)   ← 零报红
  (还原后 md5sum -c 两文件 OK)
```
**真实后果**:界面上那行小小的英文装饰词会变成中文(两侧都显示「子项清单 / 子项清单」),
与蓝本视觉不再 1:1;而**三门、`color-guard`、i18n parity、死键扫描一条都不响**。
⚠️ 同族风险已扩散:`.kw-sec-title` 的中文**有**断言(`['子项清单','最近变化']`),
`kw-title` 的 `TREE` **有**断言(`'TREEDocuments'`)—— **唯独 `kw-sec-en` 这一对裸奔**,
说明不是「这类都不测」,而是**漏了**。

🔴 **建议落法(评审给判据)**:在 childMap / changes 两组里各加一条(或合并一条)
`expect(w.findAll('.kw-sec-en').map(n => n.text())).toEqual(['Contents', 'Recent changes'])`,
**判据 = 上面那个 i18n 化探针必须报红**。**代价约 3 行,不动任何既有断言。**

**为什么不是 Critical**:产品代码本身**是对的**(照抄成立,§2.3 已实证),
失守的只是防漂移方向;且蓝本 1:1 在本刀落地正确。

### Minor —— **9**

| # | 事 | 评审证据 |
|---|---|---|
| **M-1** | **子项图标三元零守卫,且用例标题声称的覆盖面比断言大** | 注入 `:name="childIsDir(c) ? 'file' : 'folder'"`(folder/file **对调**)→ `100 passed`。而那条用例的标题是「🔴 `childIsDir` 决定 data-kind **与图标**」,断言体里**只有 `data-kind`**。KIcon 渲染的是不同 `<path d=…>`,**DOM 可观测 ⇒ 加断言是可行的**。⚠️ `KnowledgeLayout.test.ts:136-138` 已把「KIcon 名与消费方零绑定」登记成全仓共性问题,故不升级 —— 但**标题与断言不符**这一半是本刀自己的 |
| **M-2** | **`html` 的 `raw.value \|\| ''` 是本刀第三处恒等冗余,且产品码注释给的理由不成立** | 注入 `renderWikiMarkdown(raw.value as string)`(去掉兜底)→ **`100 passed`**。注释(`:291-292`)写「computed 本身会先求值一次,`null` 直接喂 markdown 渲染器**会炸**」——两点都不成立:⑴ Vue computed 是**惰性**的,`raw === null` 时模板走 `kw-pending` 那支,`html` 根本不求值;⑵ 评审临时用例实测 `renderMarkdown(null)` → **`(no throw)`**。⇒ **照抄本身正确(蓝本 `:197` 就是 `raw \|\| ''`),但理由是编的**,且报告 §13-2 只申报了两处恒等冗余(N58 + fmtTs 对),**漏了这第三处**。风险:将来有人按注释去验、发现「不会炸」,就有理由删掉这个照抄项(正是 §9.10 / R26-4 要防的) |
| **M-3** | 报告 §7 「`vm.sel` 的读写全部清零」**不成立**;「`w.vm` 只剩三处」**少数一处** | 现测 `grep -n 'w\.vm\|vm\.'`:`:1072` 仍有 `expect(vm.sel).toBe('/DATA')`。它是**前置读**(该用例的主断言已在 `.kw-crumb .cur` / `.kw-title` 上),**零后果**;错的是报告的陈述 |
| **M-4** | 报告 §3 的基线 md5 与**落盘提交**不符 | 报告写 `WikiView.test.ts` `0da882995f4113ed0965b49c635d8a3c`;评审现测**工作树 = `HEAD` = `de90ccc8a28457c1aae05fd90a632c0e`**(`git show HEAD:… \| md5sum` 与 `md5sum` 两条口径一致)。⇒ 报告贴的是**中途版本**的 md5,不能当提交态的自证。`WikiView.vue` 的 `938098e0…` **吻合** |
| **M-5** | 附录 B 新增块**编号重复**,且订正块里的现数命令是**裸子串**口径 | `p5f-appendix-B-tokens.md` 现在有**两个 `### … B.5.1 订正块`**(T7 的在前、T5 的在后)。块里写 `$ grep -c 'style=\|:style=\|color='` —— `grep -c` 是**行计数**且**不剥注释**,正是 R19/R26-3/R28 连栽三次的谓词形态。**数字本身经评审剥注释 + 前缀锚定复核 = 9,无功能影响**(§2.5) |
| **M-6** | 测试文件头 `:27` 的「Wiki 侧样本**全部是 `.CONSTRUCTED`**」现已不成立 | 本刀引入了 `WIKI_RAW_REAL_EXCERPT`(`.REAL`)。该抄本**自己的**出处标签块(`:215-221`)写得完全正确,所以不构成 §9.18 的误标;错的只是文件头那句总括 |
| **M-7** | 文件头 `:29`「抄本等价性由**程序化逐字节校验**确认(见「fixture 抄本自检」一组)」**指错了地方** | 那一组**不读 fixture 文件**(运行时零读 `.superpowers/` 是本期硬约束),它做的是**结构 / 取值钉桩**。真正的逐字节校验只能在**带外**做 —— 评审已自行完成并贴在 §2.6(node fixture `EQUAL(json)=True`;`.REAL` 节选与 fixture 前 22 行逐行全等) |
| **M-8** | `:219` 写 `.REAL` fixture「整份 **78** 行」,实测 **71** 行 | `wc -l .superpowers/sdd/p5f-fixtures/wiki-raw-DATA.REAL.md` → `71`。同句里的 md5 与字节数(3430)**都对** |
| **M-9**(**承接,非本刀强制项**) | T6 评审 M-3 点出的 `FIXTURE-COPY-BEGIN … (只取 normal / crossLevel 两组)` 措辞仍未订正 | 全文件 `crossLevel` **仅 1 处命中**,就是那句头注释;并无该组抄本。T6 评审只列为 Minor、未派工,T7 也未被 brief 点名 ⇒ **不算 T7 的偏离**,建议 T8 顺手带上 |

---

## 6. 治理条目逐条核对(评审自查)

| 条目 | 结论 | 依据 |
|---|---|---|
| **§9.15** XSS 不许 mock 掉再声称验过 | 🟢 **满足** | §1.1(a)(b)(c)(d) |
| **§9.10** 只许加固不许放宽 | 🟢 **满足** | §1.4(d) 逐行归属 41 行删除 |
| **§9.14-4** 参数化防空循环 | 🟢 **满足** | §0.2 `--reporter=verbose` 具名 5 条 |
| **§9.17** 可点性 | 🟢 **满足** | E1 探针 + 用例里 `exists()` / `hasAttribute('disabled') === false` 前置 |
| **§9.19** 自动上膛守卫 + 防空转 + `node:fs` | 🟢 **满足** | 偏态 A/B 各验 + `readFileSync`(零 `?raw`) |
| **§3.5 N46/N48/N49/N55/N58** 有没有被「顺手修正」 | 🟢 **无一被改** | §2.2 + `wikiViewHelpers.ts` 不在 diff 里 |
| **N46** mock 层次(camelCase / snake_case / PascalCase) | 🟢 **正确** | 抄本是 HTTP 原文 **snake_case**,经 `toNodeShape()`(= `normalizeNode` 等价物)才变 camelCase;页面**零二次归一化** |
| **K1 / K5 / K58 形态 A / K27(E-62)/ K41 / K44 / K9** | 🟢 **全部成立** | §2.4;K58 由 `PROBE-T7-RESCAN-500` 排除式断言守住 |
| **R13 同族**(具名 failed) | 🟢 **满足** | 全部探针一律 `--reporter=verbose` 并核到具名 `×` |
| **R21**(推翻既有结论须两条独立口径) | 🟢 **满足** | I-1 给了单文件 + 全仓两条;§0.1 给了「实跑 T6 基线」+「`git diff --name-only`」两条 |
| **R23 / §9.5** 探针还原禁 `git checkout` | 🟢 **满足** | 全程 `cp` + `md5sum -c`,最终 `git status --porcelain` 零输出 |

---

## 7. 是否可以进 T8(收官刀)

🟢 **可以。**

理由:**产品代码零缺陷**(模板对蓝本 52/52 token 归一化后零差异;script 八个新落点逐条对读一致;
N46/N48/N49/N55/N58 无一被「顺手修正」);**R28 前置真的闭合且是加固**(裸 `indexOf` 探针 4 红、
偏态 A 在**真实文件**上 100 绿、偏态 B 本体条件断言报红、剥注释器扛住路径字面量);
**brief 的四组第一必查项全部由评审亲手复现**;三门自跑全绿且「+46 全在本文件」经**实跑 T6 基线**坐实。

🔴 **两个前置条件 / 交接项**:
1. **I-1 建议在 T8 顺手闭合**(约 3 行断言,同文件同域,零额外解禁;判据 = 评审那个 i18n 化探针必须报红)。
   若协调者判定「装饰文案漂移风险可接受」,则须**明确裁定并登记为债务**,不要默认带过。
2. 🔴 **验收清单必须写进的三条 D1 连带项**(前两条 T7 已在报告 §13-4 提出,第三条来自 T6 评审 §4-④):
   ① 本机 `owningRoot` 恒 null ⇒ **「重新扫描该根」按钮永远不渲染**;
   ② 同因 ⇒ **最近变更的前缀剥离永不生效**(一律显示全路径);
   ③ 进 Wiki 页约 **60 秒**后会冒一次「操作失败」提示。
   **三条都不是本期缺陷,是 D1 连带 —— 不写机主必然报。**

**给 T8 / 终审的额外知情**:
- **M-2** 那处注释理由是错的 —— 🔴 **别据它去删 `raw || ''`**(照抄项,§9.10 / R26-4);
- **M-5** 附录 B 现有**两个 `B.5.1`**,终审核对 §B.5 其余各节时注意;
- **M-1** 的图标绑定缺口属全仓共性(`KnowledgeLayout.test.ts` 已登记),若要系统性解决应另开票;
- T7 的 `.REAL` 节选与 node 抄本的**逐字节等价已由本评审带外确认**(§2.6),T8 不必重做。
