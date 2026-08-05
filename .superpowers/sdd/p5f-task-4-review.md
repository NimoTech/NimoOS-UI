# SP8-P5f Task 4 独立评审 —— `AllowlistView.vue`(提交 `58541f3`,起点 `d9bc95a`)

> 评审口径:**不采信实现者报告的任何结论**,每一条都自己动手复核。
> 探针一律 `cp` 备份 → 行首/唯一串锚定注入 → **先证注入落盘** → `--reporter=verbose` 核**具名 failed** →
> `cp` 还原 → `md5sum -c` 逐字节自证。**全程零 `git checkout/restore/stash/amend/reset/rebase`**,
> `src/` 探针后三个文件 md5 全部回到提交态(基线 `1918ac52…` / `d6aef091…` / `a7ea7cb8…`)。
> 蓝本一律 `git -C ../../NimoOS-UI show 7a6ee6b7:` 读取,**未在那个仓做任何写操作**。

**结论:Critical 0 / Important 1 / Minor 2。可以进 T5**(I-1 建议在 T5 同一提交里顺手补一条用例,或由协调者派单;
它不阻塞 T5 的范围,`RootsView` 与本文件无交集)。

---

## 0. 三门(自己跑全量,落盘不 `| tail`)

```
$ pnpm test -- --reporter=verbose   > gate-test.log 2>&1 ; exit=0
 Test Files  337 passed (337)
      Tests  4477 passed (4477)
$ grep -cE "^\s+×" gate-test.log     → 0
$ pnpm exec vue-tsc --noEmit        > gate-tsc.log   2>&1 ; exit=0
$ pnpm build                        > gate-build.log 2>&1 ; exit=0   (✓ built in 13.73s)
```
✅ **`Test Files 337` / `Tests 4477` 与 T4 报告一致**;两条已知噪声(`persist.test.ts > dropPersisted…` /
`AgentComposer.test.ts`)本轮均未触发,零 skipped / todo(52 条逐条 `✓` 具名,见 §3-4)。

### +58 归因自洽性(裁定 R24)—— **自己实测每一项,不采信**

| 项 | 值 | 我的取数 |
|---|---|---|
| `AllowlistView.test.ts` 单跑 | **52** | `pnpm exec vitest run …/AllowlistView.test.ts` → `Tests 52 passed (52)` |
| `knowledgeStyles.test.ts` 现值 | **412** | 单跑实测;`+5` 的机制:`it.each(KNOWLEDGE_VUE_FILES)` **4 处**(`:1683` `:1699` `:1708` `:1748`)+ `it.each(knowledgeVues…)` **1 处**(`:2123`,运行时读盘)⇒ 新登记 1 个 `.vue` = +5 |
| `color-guard.test.ts` 现值 | **188** | 单跑实测;`import.meta.glob('../**/*.vue')`(`:15`)动态生成 ⇒ 新增 1 个 `.vue` = +1 |
| **合计** | 336 + 1 = **337** · 4419 + 52 + 5 + 1 = **4477** | ✅ **自洽** |

---

## 1. 🔴 第一必查项(计划书指定,四条全部亲手做)

### 1.1 🔴🔴 K55 —— 往三个 `bg` 里注入色字面量 → 定向断言必须报红 ✅ **成立**

注入落盘自证(三个 `bg` 全部换回蓝本原文的 `linear-gradient(135deg, #…)`):
```
174:  { id: 'docs', … bg: 'linear-gradient(135deg, #5AC8FA, #007AFF)',
176:  { id: 'text', … bg: 'linear-gradient(135deg, #5DD68A, #2EB05B)',
178:  { id: 'code', … bg: 'linear-gradient(135deg, #C18CFF, #AF52DE)',
```

🔴 **我跑的是全量**(不是只跑两个文件),`--reporter=verbose`,exit=1:
```
 Test Files  2 failed | 335 passed (337)
      Tests  4 failed | 4473 passed (4477)
 × src/ai/knowledge/views/AllowlistView.test.ts > K55… > 三个 bg 逐个 = 对应的 var(--grad-ext-*)…
 × src/ai/knowledge/views/AllowlistView.test.ts > K55… > 🔴 三个 bg 零 hex / rgb() / hsl() / linear-gradient() / 具名色(判据:注入一个 hex → 报红)
 × src/ai/knowledge/views/AllowlistView.test.ts > K55… > 渲染侧真的把 token 送进了 :style(蓝本 :14 的 background: g.bg)
 × src/ai/styles/knowledgeStyles.test.ts > K55:三个扩展名分组渐变 token 两档取值(P5f-T2 新建) > M-a 自动上膛 …
```

🔴 **T4「唯一防线」论断的复核 —— 坐实成立,不夸大**:
**全量 4477 例里只有这 4 条红**,响的是 ①T2b 的 M-a 自动上膛断言 + ②T4 新增的 K55 定向断言。
`color-guard.test.ts`(188 例)**整文件绿**;`knowledgeStyles.test.ts` 的**缺口③′**(模板扫描,4 个
`it.each(KNOWLEDGE_VUE_FILES)` 里的两条)与 **§0.3**(`<script>` **注释**扫描)**一条都没响**
—— 因为三者都不看 `<script>` 的**代码本体**。
⇒ **这条断言不可删。** 建议协调者把它登记进全支终审的知情项。

**还原**:`cp` 回原文件 → `md5sum src/ai/knowledge/views/AllowlistView.vue` = `1918ac52e079fe3f9ad3dfae8292ad25`,与基线**逐字节一致**。

### 1.2 🔴 N52 串行断言是不是零判别力 ✅ **有判别力,不是零判别力**

我自己把循环体换成 `Promise.all`(注入落盘自证 `236: await Promise.all(`):
```
$ pnpm exec vitest run …/AllowlistView.test.ts --reporter=verbose   exit=1
 × AllowlistView —— N52:setAllInGroup 串行 await + 跳过已是目标态
     > 🔴🔴 顺序是**串行**:第一发未落地前不许发第二发(判据:改成 Promise.all → 必须报红)
      Tests  1 failed | 51 passed (52)
```
**精确一条红,其余 51 条仍绿** ⇒ 判别力落在正确的载体上(`issued` 计数器 + 三个可控 promise 的交错路径),
**不是**「只断了调用次数」那种零判别力形态。跳过分支(`if (e.enabled !== on)`)另有独立用例(#25,
`.REAL` 的 docs 组 11 个全 `enabled=1` → 点「全选」零请求但 toast 照弹)。

### 1.3 🔴 N54 三张表与蓝本逐字比对 —— **自己 `git show` 解析** ✅ **成立**

```
$ python3(自写解析器:蓝本 `match: ext => [...]` / 本仓 `match: (ext) => [...]` 各自正则抽取)
blueprint lens: [12, 13, 25] 50
current   lens: [12, 13, 25] 50
testcopy  lens: [12, 13, 25] 50      ← 测试文件里的 DOCS/TEXT/CODE_BLUEPRINT 抄本
blueprint == current : True
blueprint == testcopy: True
```
⇒ **12 / 13 / 25 = 50 核实**(勘误 **E-74** 成立,不是治理原写的 24);
**顺序也逐字相同,零补全、零删减**(集合相等 **且** 列表相等)。
三条计数断言的形态实读为 `toBe(12)` / `toBe(13)` / `toBe(25)` + `toBe(50)`(`AllowlistView.test.ts:385-388`)
—— **是 `toBe` 精确值,不是 `toBeGreaterThan` 之类**。✅

### 1.4 🔴 §9.10 有没有被违反 ✅ **没有**

```
$ git diff --name-status d9bc95a 58541f3
A  .superpowers/sdd/p5f-task-4-report.md
A  src/ai/knowledge/views/AllowlistView.test.ts
A  src/ai/knowledge/views/AllowlistView.vue
M  src/ai/styles/knowledgeStyles.test.ts

$ git diff d9bc95a 58541f3 -- src/ai/styles/knowledgeStyles.test.ts
@@ -1522,6 +1522,7 @@ const KNOWLEDGE_VUE_FILES = [
+  'views/AllowlistView.vue',
```
**既有守卫一行未动**,唯一改动是把新 `.vue` 登记进 `KNOWLEDGE_VUE_FILES`(**加固**:让 4+1 条参数化守卫覆盖新文件)。

**T4 自报第 ④ 条我亲手复现**:把模板注释改回复述蓝本那个具名色的字面拼写 →
```
 × src/ai/styles/knowledgeStyles.test.ts > 守卫缺口③′ …
     > views/AllowlistView.vue —— 模板内属性值位置(color/background/border/box-shadow/fill/stroke)零具名色
      Tests  1 failed | 651 passed (652)
```
⇒ **守卫是真阳性,T4 改自己的注释而不是放宽守卫,处置正确。** ✅

---

## 2. 移植忠实性(逐条程序化复核,不肉眼比)

### 2.1 模板结构 / DOM 顺序 / 类名 —— **逐字对蓝本 `:1-249`**

自写 tokenizer 抽出「元素标签 + class 属性」序列,`difflib` 对齐:
```
blueprint tokens: 186   current tokens: 192
REPLACE  BP [('div','k-modal-bg'), ('div','k-modal')]
         CUR [('DialogRoot',None),('DialogPortal',None),('DialogOverlay','k-modal-bg'),('DialogContent','k-modal')]
INSERT   CUR [('DialogTitle',None)] / [('/DialogTitle',)] / 四个闭合标签
DELETE   BP [('/div',),('/div',)]
```
⇒ **唯一差异就是 K57 强制的 reka 转换**;其余 186 个标签的**类名、嵌套、顺序全部逐字一致**。

**属性级复核**(93 vs 93 个元素逐个比属性集合与取值):
```
[10] div    :style   '{background: g.bg}'                → '{ background: g.bg }'   (prettier 空格)
[20] KIcon  color    'white'                             → 'var(--text-on-accent)'  (附录 B §B.3-①)
[37] div    v-if     'store.state.folderRules.length===0' → 'store.folderRules.…'   (K1)
[44] div    v-for    'r in store.state.folderRules'       → 'r in store.folderRules' (K1)
[52] button :title   "$t('Delete rule')"                  → "t('aiKbAlDeleteRule')"  (i18n)
[56] div    bp-only  {@click:'adding = false', v-if:'adding'}                        (K57)
[57] div    bp-only  {@click.stop} / cur-only {:aria-describedby:'undefined'}         (K57)
```
**零遗漏属性、零多余属性、零位置漂移。** 蓝本 8 处内联 `style=` 全部逐字照抄(含 `:143` 的 `margin-left: auto`)。

### 2.2 i18n 逐位复核(自己重跑,不看报告的脚本)

分段落位对齐(本仓 `<script setup>` 在 `<template>` 之前,不能整文件对齐),用蓝本
`src/assets/lang/{zh_CN,en_US}.json` 的覆盖值逐码点比:
```
── template: bp 31 / cur 31 → 0 mismatch
── script  : bp 12 / cur 12 → 0 mismatch          （43/43）
动态键 Documents→aiKbAlGroupDocuments  zh 文档==文档 / en Documents==Documents
动态键 Text     →aiKbAlGroupText       zh 文本==文本 / en Text==Text
动态键 Code     →aiKbAlGroupCode       zh 代码==代码 / en Code==Code
```
⚠️ 我第一版脚本用 `re.sub(r'/\*.*?\*/')` 剥注释,被源码里的 `'/Downloads/*'` 当成注释起点吃掉了一段,
误报「script 12 vs 11」。**换成「整行注释置空」的独立口径复证后 12/12 零差异**(承 R21:两条口径都贴出来)。

### 2.3 N47 ✅

- `:data-on="String(e.enabled)"` 逐字照抄(属性级 diff 已证)。
- **本页没有再归一化一次**:剥注释后 `!!` = **0**(裸 grep 数出 1,那处在头部注释里引用 `!!e.enabled`)。
- 翻转测试用的是 **`.REPLAYED`**(用例 #19 明写),并同时坐实 store 出口 `[true,false,true,false,true,true]`;
  我独立核了 `.REAL` 的 `enabled` 取值集合 = `{1}`、类型 = `int` ⇒ **真机确实抓不到 0**。

### 2.4 N53 / N52 ✅
N53 六条(`log`→`.log` · `  .LOG  `→`.log` · 全空白零请求且绕开 `disabled` 走 enter · `:disabled` 两侧 ·
成功清空 · 失败**不**清空);N52 的跳过分支有独立用例(#25)。

### 2.5 K57 —— **自己去读 `SettingsView.vue` 的 K29 落地,核是不是照同一份** ✅ **是同一份,不是自创第二套**

```
SettingsView.vue:580-589   DialogRoot :open / DialogPortal to=".knowledge-app" defer /
                           DialogOverlay class="k-modal-bg" / DialogContent class="k-modal" :aria-describedby="undefined" /
                           DialogTitle as-child 套在既有 .k-modal-title 上（无 VisuallyHidden）
AllowlistView.vue:419-428  逐项同形态
QueueView.vue:560          @update:open="confirmClear = $event"   ← T4 的 `adding = $event` 同款
QueueView.vue:564          VisuallyHidden as-child（蓝本无可见标题时才用）—— 本页蓝本 :105 自带标题，不用，正确
```
唯一不照抄的是 `style="width: min(…)"`:**蓝本 AllowlistView `:103` 的 `.k-modal` 本来就没有内联宽度** ⇒ 不加才对。
**零 `@click.stop`**:剥注释后 = **0**(裸 grep = 2,两处都在注释里写着「不再写 `@click.stop`」这句话本身)。
三条用例齐(打开 #41 / 关闭 #44、#45 / 点遮罩关闭 #46,且 #46 同时验了「点弹窗内不关闭」那一侧)。

### 2.6 K58 ✅ 照 `p5f-task-0-report.md` §12 **形态 A**,零自造第二套
§12 原文形态 A = 「catch 里丢掉 `e.message`,直接用一个固定 i18n 键,**无第二句可拼故不留 `': '` 前缀**」。
本仓五处落点逐个核对:`store.toast(t('aiKbAlSaveFailed'))` × 3 · `t('aiKbAlAddFailed')` · `t('aiKbAlDeleteFailed')`,
**全部无前缀、无 `e.message`**,`catch {}` 连参数都不接。四条排除式断言的探针文本 `PROBE-K58-8Q3Z`
**确实不在 `.vue` 里**(否定式断言不会撞注释)。⚠️ **但只覆盖 5 处中的 4 处 —— 见 I-1。**

### 2.7 toast 走 `store.toast(...)` ✅
剥注释后 `useToast` = **0**(裸 grep 2,全在注释里);`store.toast(` = **10**(见 M-1)。
`vi.spyOn(store,'toast')` 逐条比文案(#22 #25 #26 #28 #34 #39 #40 #48 #51 #52)。

### 2.8 `.wps` 用例 ✅ **真的钉住「45 条 → 44 个 chip」,不是只断总数**
用例 #16 先断 `store.extensions` 长度 = **45** 且含 `.wps`(§9.18-3:先坐实取数没取漏),
再断 `.k-ext-chip` = **44**、`chips` 不含 `.wps`、三组计数 `[11, 12, 21]`(裁定 R6 订正值,11+12+21=44 自洽)。

### 2.9 `color="white"` → `var(--text-on-accent)` ✅ **不是 `--on-accent`**
模板 `:331` 实读 `color="var(--text-on-accent)"`;用例 #23 同时**正向断等值 + 反向断 `not.toBe('var(--on-accent)')`**。
我独立核了两个 token 的实际取值:`knowledge.scss:199` 暗档 `--text-on-accent: #ffffff` / `:404` 亮档
`var(--on-accent)`;而 `theme.css:48` 暗档 `--on-accent: #16203a`(深蓝黑)⇒ **取 `--text-on-accent` 是对的**。
三个 `--grad-ext-*` 在 `knowledge.scss:380-382`(暗)与 `:505-507`(亮)**两档各声明一份**,存在且同值。

### 2.10 `.vue` 零 `<style>` 块 ✅ · 新文件已登记 ✅
行首锚定 + 剥注释后 `^\s*</?style` = **0**;`KNOWLEDGE_VUE_FILES` 已加 `'views/AllowlistView.vue'`。
剥注释后 `store.state` = 0 · 类型位置 `any` = 0(`vue-tsc` exit 0 复证)。

---

## 3. 缺口猎(常规动作)

### 3.1 `groups` computed 三件事的独立判别力 —— **自己拆,各看是否报红** ✅ 三件各自有独立判别力

| 我注入的错实现 | 结果 |
|---|---|
| 删掉 `.sort((a,b) => a.ext.localeCompare(b.ext))` | **4 failed / 48 passed**;其中 **#15「🔴 排序真的在起作用 —— 倒序喂进去…」是专为它写的那条** |
| 删掉 `.filter((g) => g.exts.length > 0)` | **2 failed / 50 passed**;两条都是空组用例(#17 #18),**互不重叠** |
| 分组(`match`)—— 由 §1.3 的逐字比对 + 用例 #16 的 44/45 与 `[11,12,21]` 共同守住 | ✅ |

⚠️ 顺带记一笔:用例 #14(`.REAL` 45 条 → 逐个钉死顺序)对「删掉 `.sort()`」**恒绿**,因为 `.REAL` 本身就是
升序的。**#15 那条倒序用例才是判别力所在** —— T4 写对了(这正是「同一份整齐样本上几种错实现同解」的陷阱,§9.16 同族)。

### 3.2 §9.17「点某个东西」先确认真渲染 ✅
`openAdv()`:**先断折叠前 `.k-custom-add` 不渲染 + `data-open="false"` → 点 → 断 `data-open="true"` +
输入框真渲染**,再 `setValue`。`openModal()`:**先断 `.k-modal` 为 `null`** 再点。两处都合规。

### 3.3 52 条有没有空转 ✅
`--reporter=verbose` 逐条 `✓` 具名 52/52,零 `skipped` / `todo`(全表已核)。
K55 与 N54 两组各自带一条**防空转**断言(`toHaveLength(3)`),避免抽取器坏掉时对空数组假通过 —— 有效:
我删 `.epub` 的等价探针(§1.3 的逐字比对)与 `bg` 注入探针都精确报红。

### 3.4 fixture 抄本 ✅
```
REAL      n=45  copy n=45  identical: True    (与 .superpowers/sdd/p5f-fixtures/allowlist-extensions.REAL.json 逐条相等)
REPLAYED  n=6   copy n=6   identical: True
folders   {'rules': []}                        整份相等
REAL __meta: False | REPLAYED __meta: True | folders __meta: False
`__meta` 在测试文件里的 5 处出现 —— **全部在注释行**(逐行回读,零 CODE 命中)
`.superpowers` 在测试文件里的 1 处出现 —— **在注释行**;运行时零读取(只用 node:fs 读同目录的 .vue)
```
三级出处标签(`.REAL` / `.REPLAYED` / `.CONSTRUCTED`)逐个写在注释里;`.REPLAYED` 的 `__meta` 五个字段
与注释里的转写**逐条对得上**。读 `.vue` 用 `node:fs`(`?raw` 铁律遵守)。

### 3.5 🔴 **新缺口(见 I-1)**:K58 五个落点里 `toggle()` 那一个**完全没有守卫**。

---

## 4. 对 T4 四条申报的裁断

| # | 申报 | 我的裁断 |
|---|---|---|
| ① | 附录 B §B.5 记「模板 6 处」,实测 **8 处**(漏 `:143`) | 🟢 **成立,T4 对**。我自己数蓝本 `NR<=153`:`:14` `:30` `:37` `:60` `:65` `:85` `:138` `:143` = **8 行**;附录 B §B.5 表头写 **6**、正文只列 **7** 个行号(缺 `:143`)。**建议协调者订正附录 B §B.5 的 AllowlistView 一行为 8 并补 `:143`**(顺带:同表 `RootsView` 写 5 却列了 7 个行号,也不自洽,请一并核) |
| ② | 测试挂载不再传 `plugins: [i18n]` | 🟢 **可接受,已按 R22 申报;既不是自创,也没丢判别力**。① 记忆那条禁的是**另建 `createI18n`**,本文件 `createI18n` = 0(剥注释后),没犯;② `vitest.setup.ts:21-26` 的注释原文就写着「全局装单例,自己传 `global.plugins` 的会 later 覆盖」⇒ **两种写法都是 setup 设计内的**;③ **确实偏离了同目录 10 个既有视图测试的写法**(它们 import 同一个单例再传一次),这一点 T4 已显式申报;④ 🔴 **判别力我亲手验了**:把 `t('aiKbAlFileTypes')` 改成不存在的键 → `× 两个区头文案逐字(蓝本 :8-9 / :58-59)`,`1 failed / 51 passed` ⇒ **文案断言照样报红**。⑤ 顺带复证告警确实存在:`SettingsView.test.ts` + 本文件同跑 `grep -c "Vue warn"` = **289**,全部来自前者。**建议协调者裁定是否把这套写法推广到既有两页(那是独立整改票,不该塞进 T5)** |
| ③ | portal 宿主在挂载前统一建好 | 🟢 **合理,无副作用**。`mountPage` 内 `withHost()` 在 `mount()` **之前**执行;`afterEach` 先 `unmount()` 再 `document.body.innerHTML=''`,顺序正确,不会串条;每条用例只建**一个**宿主,符合「`to` 只认第一个同名宿主」。我另外复证了宿主选择器**真的被断言吃住**:把 `to=".knowledge-app"` 整个去掉 → **11 条精确报红**(#41-#47 + #48-#51) |
| ④ | 第一版注释复述具名色被守卫真阳性打红 → 改注释 | 🟢 **处置正确,守卫零放宽**。`git diff` 证明 `knowledgeStyles.test.ts` 只 +1 行登记;我把注释改回复述具名色 → **缺口③′ 精确报红 1 条**,坐实那是真阳性而非误报 |

---

## 5. 分级清单

### Critical —— 0

### Important —— 1

#### 🔴 I-1 「产品代码对、守卫为零」家族:**K58 的 `toggle()` catch 分支完全没有守卫**

**事实**:K58 在本页有 **5 个落点**(T4 报告 §3 的表自己也列了 5 个:`toggle` / `setAllInGroup` /
`addCustom` / `saveRule` / `removeRule`),但排除式断言只有 **4 条**(#28 `setAllInGroup` · #34 `addCustom` ·
#40 `removeRule` · #51 `saveRule`)。**`toggle()`(蓝本 `:198-200`,K58 的第 1 个落点)一条都没有** ——
全 52 条用例里没有任何一条让 `store.toggleExtension` 在**点 chip** 的路径上 reject。

**我的探针(注入 K58 明令禁止的那个反模式本身)**:
```
$ 把 AllowlistView.vue:225-226 改成
    } catch (e) {
      store.toast(t('aiKbAlSaveFailed') + ': ' + String((e as Error).message))
$ sed -n '220,229p' 自证落盘 ✅
$ pnpm exec vitest run …/AllowlistView.test.ts --reporter=verbose
  exit=0
   Test Files  1 passed (1)
        Tests  52 passed (52)
```
⇒ **把「回显后端 body」这件 K5/K58 最核心禁令的事写进产品码,52/52 全绿。**
(`color-guard` 不扫 `<script>`、缺口③′ 只扫 `<template>`、§0.3 只扫 `<script>` **注释** ⇒ 三门也不会响。)

**为什么是 Important 而不是 Minor**:这是 P5c 五次 / P5d 四次 / P5e 十一次同款 —— 产品码正确、
守卫为零;而 `toggle()` 是**本页点击频率最高的写操作**(每个 chip 一次),真机上后端 500 的错误文案
是否泄露 body,恰恰只有这条路径最容易被将来「顺手加上 `e.message` 好排查」改坏。

**落法建议**(一条用例即可,与既有四条同模具):`mountPage(EXT_REPLAYED)` → 让
`ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-…'))` → 点一个 chip →
断 `toast` 末次 = `'保存失败'` 且 `toast.mock.calls.flat().join('|')` 与 `w.html()` 都不含探针串。
🔴 **判据 = 我上面那个注入必须报红。**

### Minor —— 2

#### M-1 `store.toast` 落点数报错:是 **10** 不是 9(且这个错数被烙进了 `src/` 的注释与用例标题)

我逐行枚举(`grep -n "store\.toast(" AllowlistView.vue`,剥注释后 10 个真实调用点):
```
:224 toggle 成功   :226 toggle catch      :239 setAllInGroup 成功  :245 setAllInGroup catch
:256 addCustom 成功 :259 addCustom catch   :272 saveRule 成功       :276 saveRule catch
:284 removeRule 成功 :286 removeRule catch
```
= **5 成功 + 5 catch = 10**。而三处都写成 9:
① T4 报告 §3「剥注释后 `store.toast(` **恰好 9 处**(5 成功 + 4 catch)」;
② **`AllowlistView.vue:79` 的头部注释**「共 **9 处** = 5 个成功 + 4 个 catch」;
③ **`AllowlistView.test.ts:1014` 的 describe 标题**「R27:**9 处** toast 全部经 `store.toast`」。
报告 §3 的 K58 表自己列了 **5** 个 catch 落点 ⇒ **报告内部就不自洽**。

**无功能影响**(10 处确实全走 `store.toast`,`useToast` 剥注释后 = 0),但按本档「假陈述注释」的既定处置
(裁定 R2-② 的同款),🔴 **进了 `src/` 的那两处(② ③)应订正**。
⚠️ 附带一点:该 describe 标题说「9 处 …… 全部经 store.toast」,而**用例体只实际走了 3 处**(toggle 成功 /
setAllInGroup 成功 / removeRule 成功)—— 标题**过度声称**;其余落点由别的 describe 的 spy 断言覆盖
(唯一例外正是 I-1 的 `toggle` catch)。建议标题改成「10 处 …… 逐处由各 describe 的 spy 覆盖」。

#### M-2 K57 落地判据 ① 里点名的 `defer` 零判别力

K57 的落地判据 ① 明写 `DialogPortal to=".knowledge-app" **defer**`。我把 `defer` 去掉:
```
$ grep -n "DialogPortal to" → 420:      <DialogPortal to=".knowledge-app">
$ pnpm exec vitest run …/AllowlistView.test.ts --reporter=verbose
        Tests  52 passed (52)      ← 零红
```
(对照:去掉 `to=".knowledge-app"` **11 条精确报红** ⇒ 宿主选择器守得很好,只有 `defer` 这一半裸奔。)
**真机影响很低**(生产里 `.knowledge-app` 宿主由父级 `KnowledgeLayout` 先于本页渲染),且
`SettingsView` / `QueueView` 两个先例大概率也没有这条守卫 ⇒ **不建议在 T4 返工**,
**建议协调者作为一条跨页小票登记**(一次性给三页补一条「模板里 `DialogPortal` 带 `defer`」的源码级断言即可)。

---

## 6. 硬纪律自证

- 探针共 **8 次**注入,**每次**都是 `cp` 备份 + 唯一串/行号锚定注入 + `grep` 自证落盘 + `--reporter=verbose`
  核具名 failed + `cp` 还原 + `md5sum -c`。最终三文件 md5 全部 `OK`:
  `1918ac52e079fe3f9ad3dfae8292ad25` / `d6aef091573b0d31c81ecb004b80b7a5` / `a7ea7cb84419fec38c9ce590ffbecd5a`。
- **零 `git checkout` / `restore` / `stash` / `amend` / `reset` / `rebase`**;`src/` 除探针外零改动;
  未部署、未 push、未合 master;`../../NimoOS-UI` 全程只读(只跑 `git show` / `ls-tree`)。
- 否定式 / 存在式断言的谓词**一律先剥注释 + 行首锚定**(`@click.stop` / `useToast` / `store.state` /
  `<style` / `any` / `!!` 六项都以「剥注释后」为准,并同时贴了裸值以显式暴露假阳性)。
- 据一条检索推翻既有结论的地方(§2.2 的 i18n script 计数),**换了第二条独立口径复证并贴了两条原始输出**(R21)。
