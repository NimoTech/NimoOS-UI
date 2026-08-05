# SP8-P5f Task 4 报告 —— `AllowlistView.vue`(蓝本 249 行)

> 工作区 `.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`d9bc95a`**(`git log --oneline -1` 现测确认:
> `d9bc95a docs(p5f): 裁定 R22-R23 —— T2b/T3 关账,buildWikiTree 守卫缺口派 T6`)。
> 蓝本锁 `NimoOS-UI` @ **`7a6ee6b7`**,一律 `git -C ../../NimoOS-UI show 7a6ee6b7:` 读取,
> **全程零 `checkout` / `stash` / `commit`**(那个仓是只读检出)。

---

## 1. 逐文件改了什么

| 文件 | 动作 | 量 |
|---|---|---|
| `src/ai/knowledge/views/AllowlistView.vue` | 🆕 新建 | 500 行(含头部申报注释) |
| `src/ai/knowledge/views/AllowlistView.test.ts` | 🆕 新建 | **52 个用例** |
| `src/ai/styles/knowledgeStyles.test.ts` | ✏️ **+1 行** | `KNOWLEDGE_VUE_FILES` 加 `'views/AllowlistView.vue'` |

🔴 **其余 `src/` 零改动**(自证见 §9)。**没有任何 `NEEDS_CONTEXT`。**

### 1.1 为什么必须在同一提交里登记新 `.vue`

`knowledgeStyles.test.ts` 的「文件清单集合相等」守卫(`listVueFiles(kbDir) toEqual [...KNOWLEDGE_VUE_FILES].sort()`)
是**正确的防漂移行为** —— 新增视图不登记就报红。已按 brief 在同一提交里登记。
`git diff HEAD` 实测**只有 1 行**:

```
$ diff <(git show HEAD:src/ai/styles/knowledgeStyles.test.ts) src/ai/styles/knowledgeStyles.test.ts
1524a1525
>   'views/AllowlistView.vue',
```

---

## 2. 蓝本 `file:line` → New-UI 对照

| 蓝本 | 本文件 | 说明 |
|---|---|---|
| `:2-4` | 模板 `.k-view > .k-scroll > .k-scroll-inner` | 三层壳逐层照抄 |
| `:5-53` | Section A | 分组标题 + 全选/全不选 + chips + 高级折叠 + 自定义输入 |
| `:55-97` | Section B | 空态 / 表头 + 行 / 优先级提示 |
| `:101-151` | `DialogRoot` 那一段 | **K57** 转 reka |
| `:159-166` | `GROUPS_TEMPLATE` | **K55** 三个 `bg` 换 token;**N54** 三张表逐字 |
| `:171-178` | 四个 `ref` | `customOpen` / `customExt` / `adding` / `form` |
| `:180-188` | `computed groups` | **N54** |
| `:189-191` | `onMounted` | `created()` → `onMounted()` |
| `:193` | `onCountFor` | |
| `:194-201` | `toggle` | |
| `:202-211` | `setAllInGroup` | **N52** |
| `:212-223` | `addCustom` | **N53** |
| `:224-238` | `saveRule` | 表单重置值照抄 `:234` |
| `:239-246` | `removeRule` | |

### 2.1 Vue2 → Vue3 强制改写(治理 §2,不算偏离,但按要求点明)

`data()` → `ref` · `computed` 对象 → `computed()` · `created()` → `onMounted()` ·
`methods` → 普通函数 · `this.$t` → `useI18n().t` · `this.store.actions.x()` → `store.x()`
(Pinia setup store 无 `actions` 那一层)。**本页无 `$refs` / `$route` / `$nextTick` / `<template v-for>` 的 `:key`**
⇒ K56 与 §5.1 的另几条强制改写在本刀**不适用**。

---

## 3. §3 的 K1–K60 里本任务命中的每一条(逐条显式申报)

### K44 —— `.vue` 侧零 `<style>` 块 🟢 命中并遵守

本页整段 scss 已由 **T2** 搬进 `src/ai/styles/knowledge.scss`;`.vue` 侧**零 `<style>`**。
🔴 T2b 布下的参数化守卫(`src/ai/knowledge/**` 全体,**行首锚定 + 先剥注释**)在本文件建出的那一刻
自动多出一个用例,实测**绿**。⚠️ 本文件注释里**确实写了「零 `<style>` 块」这句话**(head 注释 + 模板注释),
这正是裁定 **R19** 认定的假阳性形态 —— 新谓词剥注释后不再命中,**绿是对的**。

### K55 —— `GROUPS_TEMPLATE` 三个 `bg` 渐变改 token 🟢 命中并遵守(**本刀最高风险**)

三个 `bg` 字段落地为 `var(--grad-ext-docs)` / `var(--grad-ext-text)` / `var(--grad-ext-code)`
(附录 B §B.1 / §B.6 定死,**零自选**;token 由 T2 在 `knowledge.scss` 暗/亮两档各声明一份)。

**两道守卫都真的上膛**:
1. **T2b 的「自动上膛」条件断言**(裁定 R20 的 M-a):本文件一存在就走非惰性分支,
   钉三个分组各消费**对应**的 token(串位也抓)。探针 A 实测**报红**(§7)。
2. 🔴 **本刀补的 K40 同款定向断言**(`AllowlistView.test.ts` 的 `describe('AllowlistView —— K55…')`,
   共 **5 条**):防空转(恰好抽到 3 个 `bg`)· 逐个 = 对应 token · **零 hex / rgb / hsl /
   `linear-gradient()` / 具名色** · 三者互不相同 · 渲染侧 `:style` 真的收到 token。

🔴 **为什么这条断言是唯一防线**:`color-guard.test.ts` **压根不扫 `.ts` / `.vue` 的 `<script>` 常量**
(cross-area §1 票 B 位置④);本仓 `knowledgeStyles.test.ts` 的缺口③′ 只扫 `<template>`、
§0.3 只扫 `<script>` **注释** —— **三条都不看 `<script>` 的代码本体** ⇒ 改坏了三门全绿。
探针 A 坐实:注入色字面量后 `color-guard` / 缺口③′ / §0.3 **一条都没响**,只有上面两道响。

### K57 —— 「添加文件夹规则」弹窗转 reka 🟢 命中并遵守

`DialogRoot` / `DialogPortal to=".knowledge-app" defer` / `DialogOverlay class="k-modal-bg"` /
`DialogContent class="k-modal"` + **`<DialogTitle as-child>` 套在既有 `.k-modal-title` 上**
(蓝本 `:105` 自带可见标题 ⇒ **不需要 `VisuallyHidden`**,与 `SettingsView.vue` 的 K29 落地同一份)。
🔴 **零 `@click.stop`**(🔴 **谓词必须先剥注释** —— 裸 `grep -c` 数出 **2**,那 2 处全在申报注释里
写着「不再写 `@click.stop`」这句话本身,正是裁定 **R19** 的假阳性形态;**保行版 `blankComments()` 后 = 0**);
「点遮罩关闭 / 点弹窗内不关闭」
由 `DialogContent` 的 `pointerDownOutside` 等价表达,**一条用例分别 dispatch 两个 `pointerdown` 两侧都验**。

**`@update:open` 写成 `adding = $event`**(不是 `SettingsView` 那种绕一个 `closeXxx()` 的形态):
蓝本三条关闭路径(× / 取消 / 点遮罩)**都只把 `adding` 置 false,没有第二个 state 要清**
⇒ 与 `QueueView.vue:560` 的 `confirmClear = $event` 同款。`SettingsView` 之所以要绕,
是因为它还得清 `migrateAck`(那处漏清会让下次打开时勾选框仍勾着)——**本页无此对应物**。

#### 🔴 `DialogPortal to` 只认第一个同名宿主(P5b 交接项 #3)—— 为什么在此安全

**两条独立口径都指向同一个结论**(裁定 R21:凡据一条检索下结论必须换口径复证):

```
口径①  grep -rn "knowledge-app" src --include=*.vue
  → 25 行命中,逐行回读:24 行是**注释**或 `to=".knowledge-app"` 这个**目标串**本身,
    唯一真正渲染宿主的是 KnowledgeLayout.vue:204  <div class="knowledge-app">

口径②(独立实现:递归 listVue + `class="…"` 属性内的完整 token 精确匹配,禁 `\b`)
  渲染 knowledge-app 宿主的 .vue: [ 'src/ai/knowledge/views/KnowledgeLayout.vue' ]
```

⇒ 生产环境下同一时刻页面上**有且只有一个** `.knowledge-app` 宿主(本页挂在 `KnowledgeLayout` 之下),
`to` 指哪个**不存在歧义**。测试里由 `mountPage()` 在挂载前建**唯一**一个宿主(见 §4.2)。

### K58 —— 5 个 catch 不回显后端 body 🟢 命中并遵守(**照既定做法形态 A,不自造第二套**)

坐标取自 `p5f-task-0-report.md` §12 的**形态 A**:「catch 里丢掉 `e.message`,直接用一个固定 i18n 键,
**无第二句可拼故不留 `': '` 前缀**」(先例 `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593` /
`NoteEditPane.vue:461`)。五处落点:

| 蓝本 | 蓝本原文 | 本仓 |
|---|---|---|
| `:199` `toggle` | `$t('Save failed') + ': ' + (e.message \|\| e)` | `t('aiKbAlSaveFailed')` |
| `:209` `setAllInGroup` | 同上 | `t('aiKbAlSaveFailed')` |
| `:221` `addCustom` | `$t('Add failed') + ': ' + …` | `t('aiKbAlAddFailed')` |
| `:237` `saveRule` | `$t('Save failed') + ': ' + …` | `t('aiKbAlSaveFailed')` |
| `:244` `removeRule` | `$t('Delete failed') + ': ' + …` | `t('aiKbAlDeleteFailed')` |

落地判据是**排除式断言**(4 条用例):让 store action reject 一个带可识别文本的错误,
断言 toast 文本与整页 / 弹窗 DOM 都**不含**那段文本。
⚠️ 探针文本(`PROBE-K58-…`)**故意不出现在 `.vue` 里**(治理 §9:否定式断言撞注释 = 假报红)。

### K1 —— store 降层 🟢 命中(**3 处**)

蓝本 `this.store.state.extensions`(`:182`)/ `.folderRules`(`:65` `:75`)→ `store.extensions` / `store.folderRules`。
**单层取数**,页面不再自建中间层 —— 剥注释后 `store.state` = **0 处**。

### K41 —— 零 `any` 🟢 命中

三个具名 `interface`(`ExtGroupTemplate` / `ExtGroup` / `FolderRuleForm`);
元素类型从 `knowledgeStore` import(`AllowlistExtension` / 测试侧 `RawAllowlistExtension`)。
🔴 **谓词钉在「类型位置」而不是裸词**(裸 `\bany\b` 会命中 5 处 `'any'` **字符串字面量** ——
`form` 初值 ×2 / `r.root_id || 'any'` / `form.root_id || 'any'` / `placeholder`,全是 E-25 家族的假阳性):
剥注释后 `(:\s*any\b | as\s+any\b | <\s*any\b)` 在 `.vue` 与 `.test.ts` **各 0 处**;`vue-tsc --noEmit` exit 0。

### K5 / K27 家族(裁定 R27 / 勘误 E-62)—— toast 一律走 `store.toast(...)` 🟢 命中

剥注释后 `store.toast(` **恰好 9 处**(5 成功 + 4 catch);`useToast` **0 处**
(🔴 裸 `grep -c 'useToast'` 数出 **2**,两处都在注释里写着「直调 `useToast()` 会丢掉 2400ms」这句话
—— 同 R19 的假阳性形态,**保行版剥注释后 = 0**)。理由照裁定 R27:`knowledgeStore.ts` 内部是 `useToast().show(msg, 2400)`,
**直调 `useToast()` 会丢掉蓝本自己的 2400ms**(全局 `show()` 默认只有 1500ms)。
守卫:`vi.spyOn(store, 'toast')` 逐条比文案 —— 任何一处改成直调,该处的 spy 记录消失。

### 未命中的:K53 / K54 / K56 / K59 / K60

分别属于 `RootsView`(T5)与 `WikiView`(T6/T7)/ `knowledge.scss`(T2),本刀零接触。

---

## 4. §3.5 的 N1–N58 里本任务命中的(确实照抄了)

### N47 —— `:data-on="String(e.enabled)"` 🟢 照抄

- 页面侧 `String(...)` 逐字照抄;🔴 **本页不再归一化一次** —— `!!e.enabled` 在 store 里
  (`knowledgeStore.ts:395`),**剥注释后** `!!` = **0**(裸 grep 数出 1,那处在注释里引用 `!!e.enabled`)。
- 测试断 **`'true'` / `'false'` 字符串**(不是 `toBeUndefined`),**两侧都比**。
- 🔴 **真机 45 条 `enabled` 全是 `1`,抓不到 `0`** ⇒ chip 翻转用 `.REPLAYED` 样本
  (`enabled` 取值集合实测 `[1, 0]`)。用例同时坐实 store 出口是 `[true,false,true,false,true,true]`。

### N49 —— `store.extensions || []` 🟢 照抄不删

蓝本 `:182` 的兜底原样保留(Go/Python 侧空数组可能序列化成 `null`)。
另外 `r.root_id || 'any'`(`:78`)与 `form.root_id || 'any'`(`:227`)两处兜底也照抄,各配一条用例
(构造样本第 2 条刻意把 `root_id` 置空串)。

### N52 —— `setAllInGroup` 串行 `for` + `await` + `if (e.enabled !== on)` 跳过 🟢 照抄,**未改并发**

**两条用例**:
1. **已是目标态的不发请求** —— `.REAL` 里 docs 组 11 个全 `enabled=1`,点「全选」→
   `patchParserAllowlistExtensions` **零调用**,但成功 toast 照弹。
2. 🔴 **顺序是串行** —— 用三个可控 promise + 一个 `issued` 计数器:
   点「全不选」后 `await nextTick(); await flushPromises()` 时 **`issued` 必须恰为 1**;
   `d1.resolve()` 后才变 2,`d2.resolve()` 后才变 3,且三次实参按 `.doc` / `.odt` / `.pdf` 顺序。
   **判据实测**(探针 B,§7):把循环改成 `await Promise.all(...)` → **该条精确报红**
   (`expected 3 to be 1`),其余 51 条仍绿 ⇒ **有判别力,不是零判别力**。

⚠️ **另一处照抄申报**:循环里读的 `g.exts` 是**点击那一刻的快照** —— `store.toggleExtension` 内部会
`loadAllowlist()` 整体换掉 `extensions`,`groups` 随之重算出新对象,而局部 `g` 仍指向旧快照,
后续几轮的 `e.enabled` 用的是旧值。**蓝本(Vue 2 computed)行为逐字相同 ⇒ 照抄不改**,
已在源码注释里登记。

### N53 —— `addCustom` 规范化 🟢 照抄

`trim().toLowerCase()` + 不以 `.` 开头则补 `.`;空串直接 return。
**用例 6 条**:`log` → `.log` · `  .LOG  ` → `.log` · 全空白 → **零请求**(且绕开按钮 `disabled`
走 enter 键路径,证明函数自己也守住了)· `:disabled="!customExt.trim()"` **两侧** ·
成功后 `customExt` 清空 · 失败时 `customExt` **不**清空(蓝本 `:219` 在 `await` 之后)。
🔴 §9.17:输入框在 `v-if="customOpen"` 里 ⇒ 每条用例先点开 `.k-adv-toggle`,并**先断言展开前不渲染、
展开后真渲染**,再去 `setValue`。

### N54 —— 三张 `match` 扩展名表逐字照抄 🟢 照抄,**未补全也未删减**

🔴 **程序化比对(不是肉眼比,直接从蓝本 `git show` 出来的源解析)**:

```
蓝本三表长度: 12 / 13 / 25  合计 50
本仓三表长度: 12 / 13 / 25  合计 50
逐字相等(蓝本 vs 本仓)     : true
测试抄本三表长度: 12 / 13 / 25
逐字相等(蓝本 vs 测试抄本) : true
```

⇒ **勘误 E-74 成立**:是 **12 + 13 + 25 = 50**,不是治理原写的 24。
三条计数断言按 brief 写成 `toBe(12)` / `toBe(13)` / `toBe(25)` + 一条合计 `toBe(50)`。
另配:防空转(恰好抽到 3 张表)· 逐字 `toEqual` 蓝本抄本 · 三表两两无交集(去重后仍 50)。
**判据实测**(探针 D,§7):从 docs 表删掉 `.epub` → **3 条精确报红**。

`groups` 的另三件事也照抄并各有用例:
- **`localeCompare` 排序** —— 逐个钉死三组的完整顺序;另加一条「倒序喂进去仍渲染成升序」。
  **判据实测**(探针 C,§7):删掉 `.sort(...)` → **4 条报红**。
- **空组整组不渲染**(`filter(g => g.exts.length > 0)`)—— 只喂 docs 扩展名 → 只有 1 个 `.k-extgroup`;
  三组全空 → 0 个 `.k-extgroup`(但高级折叠区仍在)。
- 🔴 **不在三张表里的扩展名一个都不显示** —— 见下节。

#### 🔴 `.wps` 用例(裁定 R6)

一条专门的用例,**先坐实取数没取漏**再断渲染(承 §9.18-3「取数没取全 = 和凭想象编造一样危险」):

```
store.extensions 长度            = 45     ✅
store.extensions 含 '.wps'       = true   ✅
页面渲染的 .k-ext-chip 数        = 44     ✅
chip 文本里含 '.wps'             = false  ✅
三组 chip 数 [docs, text, code]  = [11, 12, 21]  ✅(裁定 R6 的订正值)
```

⇒ **Parser 认 45 个,页面只显示 44 个**;`.wps` 三组都不匹配,在本页**既开不了也关不了**。
🔴 **这是蓝本行为(N54),不是本期缺陷**(裁定书 §四 **票 E**),改它就是改蓝本行为、违「界面严格 1:1」。
本刀**不改**,只用守卫钉住这个事实,免得将来有人「顺手补全」。

---

## 5. 用了哪几个样本文件、mock 形状取自哪一层(§4.1 的表)

| 样本 | 标签 | 用途 | mock 层次 |
|---|---|---|---|
| `allowlist-extensions.REAL.json` | **`.REAL`** | 45 条真机扩展名(分组 / 排序 / `.wps` / N52) | `service.ai.parserAllowlistExtensions` → **HTTP 原样**,`enabled` 是**整数** |
| `allowlist-extensions.REPLAYED.json` | **`.REPLAYED`** | chip 翻转(真机抓不到 `0`) | 同上 |
| `allowlist-folders.REAL.json` | **`.REAL`** | B 区空态 | `service.ai.parserAllowlistFolders` → **HTTP 原样** `{ rules: [] }` |
| `FOLDER_RULES_CONSTRUCTED`(本文件内) | **`.CONSTRUCTED`** | B 区非空态 | 同上;按 Parser 的 HTTP 契约 snake_case 构造,**本机 `rules` 恒空,非空形态无从真机取样** |

🔴 **三级出处标签逐个写进测试注释**(裁定 R3 约束 1)。
🔴 **只取数据字段,`__meta` 转成注释**(裁定 R14 / README §0.2)。
🔴 **不许运行时读 `.superpowers/`** —— 抄进测试文件的 `FIXTURE-COPY-BEGIN/END` 块;
读 `.vue` 源文件一律 `node:fs`(**`?raw` 在 vitest 下恒空**,铁律)。

### 5.1 程序化逐字节等价校验(不是肉眼比)

```
$ node /tmp/p5f-t4-probe/verify-fixtures.mjs
EXT_REAL      n=45  逐字节等价 .REAL.extensions      : true
EXT_REPLAYED  n=6   逐字节等价 .REPLAYED.extensions  : true
FOLDERS_REAL       逐字节等价 .REAL 整份            : true
抄本代码体里出现 __meta ? NO ✅(只在注释里)
.REAL enabled 取值集合: [1] 类型集合: ["number"]
.REPLAYED enabled 取值集合: [1,0]
```

⇒ **`.REAL` 的 `enabled` 取值集合 = `{1}`、类型 = 整数**,与 README §2 的记载一致(自测复核,非采信)。

---

## 6. i18n:复用 / 新增键清单 + 程序化逐位校验

本刀**零新增键**(79 条新键由 **T1** 落地),只**消费**。实测本页用到:

| | 数 | 键 |
|---|---|---|
| **`aiKbAl*` 新键(模板/脚本里 `t('字面键')` 直接消费)** | 32 | `aiKbAlAddFailed` `aiKbAlAddFolderRule` `aiKbAlAddRule` `aiKbAlAddedExt` `aiKbAlAdvancedCustom` `aiKbAlAllDeselected` `aiKbAlAllSelected` `aiKbAlAllow` `aiKbAlAllowDesc` `aiKbAlDeleteFailed` `aiKbAlDeleteRule` `aiKbAlDeletedCleaning` `aiKbAlDeny` `aiKbAlDenyDesc` `aiKbAlEnabledSuffix` `aiKbAlExampleHint` `aiKbAlFileTypes` `aiKbAlFileTypesHint` `aiKbAlFolderRules` `aiKbAlGroupCode` `aiKbAlGroupDocuments` `aiKbAlGroupText` `aiKbAlLibrary` `aiKbAlLibraryHint` `aiKbAlNoRules` `aiKbAlNowIndexing` `aiKbAlPathHint` `aiKbAlPriorityFull` `aiKbAlPriorityHint` `aiKbAlSaveFailed` `aiKbAlSaveRule` `aiKbAlSavedCleaning` `aiKbAlSelectAll` `aiKbAlSelectNone` `aiKbAlStoppedIndexing` |
| **无词干新键** | 1 | `aiKbAdd` |
| **复用既有键** | 3 | `aiKbColPath` · `aiKbColAction` · `aiKbCancel` |

| **`aiKbAl*` 动态键**(写在 `GROUPS_TEMPLATE[*].labelKey` 上,经 `t(g.labelKey)` 渲染) | 3 | `aiKbAlGroupDocuments` `aiKbAlGroupText` `aiKbAlGroupCode` |

🔴 **32 + 3 = 35 = `aiKbAl*` 全族** ⇒ **本页把 Al 词干的 35 条全部消费掉,零死键**(实测:
`grep -o "^  aiKbAl[A-Za-z0-9_]*" src/i18n/zh_cn.ts | sort -u` 得 **38** 条,其中
`aiKbAll` / `aiKbAllCaughtUp` / `aiKbAllSynced` 是 **`aiKbAl` 前缀撞车的别页键**
(分别在 `IndexedFilesView.vue` / `QueueView.vue` / `DashboardView.vue`,已逐个回查落点)——
**又一次 E-25 家族的前缀假命中,靠逐条回读排除,不是靠计数**。真正的 Al 词干 = 38 − 3 = **35**。)

🔴 **程序化逐位校验**(把蓝本的 `$t('字面量')` 与本仓的 `t('键')` **分段落位**对齐,
再用蓝本 `zh_CN.json` / `en_US.json` 的覆盖值逐码点比):

```
$ node /tmp/p5f-t4-probe/verify-i18n2.mjs
── template:蓝本 31 处 / 本仓 31 处 ──
── script  :蓝本 12 处 / 本仓 12 处 ──
✅ 43/43 逐位 zh+en 逐码点相等

动态键 Documents -> aiKbAlGroupDocuments | zh "文档" == "文档" true | en "Documents" == "Documents" true
动态键 Text      -> aiKbAlGroupText      | zh "文本" == "文本" true | en "Text" == "Text" true
动态键 Code      -> aiKbAlGroupCode      | zh "代码" == "代码" true | en "Code" == "Code" true
```

⚠️ **第一版脚本按整文件位置对齐,报出 43/43 全错** —— 根因是**本文件 `<script>` 在 `<template>` 之前**
(`<script setup>` 的本仓文风),而蓝本是 Options API 的 `<template>` 在前。
**改成分段对齐后 43/43 全对。** 登记这次自我纠错是为了兑现 R21:
**「一条看起来能回答问题、但口径错的检索」会直接得出反向结论**,必须换口径复证。

🔴 **附录 A §A.7 的动态键**(`GROUPS_TEMPLATE[*].labelKey`)在模板里 grep 不到,
**T8 死键核查时不许判成死键** —— 本文件已在 `ExtGroupTemplate` 的注释里登记。

---

## 7. RED → GREEN 证据(四个探针,全部 `cp` 注入 + 行首/唯一串锚定 + 先证注入落盘 + `cp` 还原 + `md5sum` 比对)

🔴 **禁 `git checkout/restore/stash`**(本工作树禁令;stash 栈里有两条别人 master 线的 WIP,实测仍在:
`stash@{0}` 2026-07-18 / `stash@{1}` 2026-07-06,**一条都没碰**)。
🔴 **一律 `--reporter=verbose` 并核到具名 failed 用例**(只看退出码会把 Startup Error 误判成报红,R13 同族)。

### 探针 A —— 🔴🔴 K55:往 `text` 组的 `bg` 注入色字面量(**brief 第 2 条点名的判据**)

**注入落盘自证**:
```
$ grep -n "linear-gradient(135deg" src/ai/knowledge/views/AllowlistView.vue
32:    `linear-gradient(135deg, …)` 字面量直接写在 `.vue` 的 `<script>` 常量里,经     ← 原有注释
176:  { id: 'text', labelKey: 'aiKbAlGroupText', icon: 'edit', bg: 'linear-gradient(135deg, #5DD68A, #2EB05B)',   ← 注入
```

**报红输出**(`vitest run AllowlistView.test.ts knowledgeStyles.test.ts --reporter=verbose`,exit=1):
```
 Test Files  2 failed (2)
      Tests  4 failed | 460 passed (464)
 × knowledgeStyles.test.ts > knowledge.scss —— K55:三个扩展名分组渐变 token 两档取值(P5f-T2 新建)
     > M-a 自动上膛 —— 若 views/AllowlistView.vue 存在,则 GROUPS_TEMPLATE 三个 bg 各消费对应 --grad-ext-*(T4 建文件时上膛)
 × AllowlistView.test.ts > K55 … > 三个 bg 逐个 = 对应的 var(--grad-ext-*)(附录 B §B.1,取值定死,顺序即 docs/text/code)
 × AllowlistView.test.ts > K55 … > 🔴 三个 bg 零 hex / rgb() / hsl() / linear-gradient() / 具名色(判据:注入一个 hex → 报红)
 × AllowlistView.test.ts > K55 … > 渲染侧真的把 token 送进了 :style(蓝本 :14 的 background: g.bg)
```

**还原**:
```
$ cp /tmp/p5f-t4-probe/AllowlistView.vue.orig src/ai/knowledge/views/AllowlistView.vue
$ diff md5.before md5.afterA  →  无差异
RESTORE-A md5 逐字节一致 ✅
```

🔴 **同时坐实了「唯一防线」这句话**:`color-guard.test.ts`、缺口③′(模板扫描)、§0.3(`<script>` 注释扫描)
在这次注入下**一条都没响** —— 响的只有 T2b 的上膛守卫与本刀新增的 K55 定向断言。

### 探针 B —— 🔴 N52:把串行循环改成 `await Promise.all(...)`(**brief 第 6 条点名的判据**)

注入落盘自证:`grep -n "await Promise.all(" …` → `236: await Promise.all(`
报红输出(exit=1):
```
 Test Files  1 failed (1)
      Tests  1 failed | 51 passed (52)
 × AllowlistView.test.ts > N52:setAllInGroup 串行 await + 跳过已是目标态
     > 🔴🔴 顺序是**串行**:第一发未落地前不许发第二发(判据:改成 Promise.all → 必须报红)
```
还原:`RESTORE-B md5 逐字节一致 ✅`

### 探针 C —— `groups` 里删掉 `.sort((a, b) => a.ext.localeCompare(b.ext))`

注入落盘自证:`205: exts: all.filter((e) => g.match(e.ext)),`
报红(exit=1):`Tests 4 failed | 48 passed (52)` —— 具名 4 条:
「🔴 排序真的在起作用 —— 倒序喂进去,渲染出来仍是升序」/「🔴 整数 0/1 进来 → chip 正确翻转」/
「🔴🔴 顺序是**串行**…」/「五个成功分支 + 四个失败分支的 toast 都被 store.toast 的 spy 捕获」。

### 探针 D —— N54:从 docs 表里删掉 `.epub`

注入落盘自证:`175: … '.xml'].includes(ext) },`
报红(exit=1):`Tests 3 failed | 49 passed (52)` —— 具名 3 条:
「🔴 三条计数断言:docs 12 · text 13 · code 25」/「🔴 三张表与蓝本逐字相等」/「三张表两两无交集」。

**还原**:`RESTORE-C/D md5 逐字节一致 ✅`(`md5.before` 与 `md5.afterD` diff 无差异)。

---

## 8. 三门完整终值 + 用例数归因(**与总数自洽**,裁定 R24)

```
$ pnpm test                    > /tmp/p5f-t4-test.log  2>&1 ; exit=0
 Test Files  337 passed (337)
      Tests  4477 passed (4477)
$ pnpm exec vue-tsc --noEmit   > /tmp/p5f-t4-tsc.log   2>&1 ; exit=0
$ pnpm build                   > /tmp/p5f-t4-build.log 2>&1 ; exit=0   (✓ built in 13.71s)
```

**零红项**(brief 点名的两条已知噪声 `persist.test.ts > dropPersisted …` 与 `AgentComposer.test.ts`
teardown 竞态**本轮均未触发**;起点基线复跑时同样 0 红)。

### 起点基线(自己重跑,不采信)

```
$ pnpm test > /tmp/p5f-t4-baseline.log 2>&1 ; exit=0
 Test Files  336 passed (336)
      Tests  4419 passed (4419)
```
与 brief 给的 `336 / 4419` 一致 ✅

### 归因表

| 项 | 文件数 | 用例数 | 依据 |
|---|---|---|---|
| 起点 | 336 | 4419 | 上面的基线复跑 |
| 🆕 `AllowlistView.test.ts` | **+1** | **+52** | 单文件实跑 `Tests 52 passed (52)` |
| `knowledgeStyles.test.ts`(**改不加文件**) | 0 | **+5** | `it.each(KNOWLEDGE_VUE_FILES)` **4 处** + `it.each(knowledgeVues…)`(K44 参数化,运行时读盘)**1 处**;实跑 `412`(起点 407) |
| `color-guard.test.ts`(**零改动**) | 0 | **+1** | 按 `**/*.vue` 动态生成,`.vue` 185 → **186**;实跑 `188`(起点 187) |
| **落地** | **337** | **4477** | 336+1 = 337 ✅ · 4419+52+5+1 = **4477** ✅ |

`grep -c "it.each(KNOWLEDGE_VUE_FILES)"` = **4** · `it.each(knowledgeVues…)` 1 处(`:2123`)⇒ +5 有据。

---

## 9. `src/` 零改动自证(除本刀三个文件)

```
$ git status --short src/
 M src/ai/styles/knowledgeStyles.test.ts     ← +1 行(登记新 .vue,见 §1.1)
?? src/ai/knowledge/views/AllowlistView.test.ts
?? src/ai/knowledge/views/AllowlistView.vue
```
🔴 治理 §1.1 零改动清单上的每一个文件(`KIcon.vue` / `knowledgeStore.ts` / `parserStore.ts` /
`color-guard.test.ts` / `knowledge.scss` / `i18n/*.ts` / `package.json` / `pnpm-lock.yaml` / `src/files/**` …)
**一行未动**。**零新依赖**(`package.json` / `pnpm-lock.yaml` 零改动)。

---

## 10. 申报:与 brief / 附录不一致处(R18 / R22)

### 10.1 🔴 附录 B §B.5 的「`AllowlistView` 模板 6 处 `style=`/`:style=`/`color=`」—— **实测 8 处**

```
$ awk 'NR<=153' 蓝本 | grep -n "style=\|:style=\|color="
14 / 30 / 37 / 60 / 65 / 85 / 138 / 143      ← 蓝本 8 行
本仓同款 8 行,逐行一一对应(:143 = .k-modal-foot 里的 <div class="right" style="margin-left: auto">)
```

附录 B §B.5 表头写 **6**、正文只列了 **7** 个行号(**漏 `:143`**)。
**无功能影响**(`:143` 是纯排版 `margin-left`,零颜色),但按 R18 以实测为准并**显式申报**;
附录 B 自己也在 §B.5 末尾承认「差异仅在怎么数一行里的多个属性」。**本刀不改附录**(不在范围内)。

### 10.2 🔴 测试挂载**不再传 `plugins: [i18n]`**(整理级偏离,按 R22 申报)

`vitest.setup.ts` 已把**同一个** i18n 单例装进 `config.global.plugins`;既有
`SettingsView.test.ts` / `QueueView.test.ts` 仍各自再传一次 ⇒ 实测两文件合计打了
**172 条 `[Vue warn]: Plugin has already been applied to target app.`**。
本文件从一开始就不传(记忆 `vitest-reporter-hides-warnings`:默认 reporter **不打印通过用例的 stderr**
⇒ 这类告警会隐形积累)。**既有两个文件在治理 §1.1 的零改动清单上,不动。**

### 10.3 🔴 `mountPage()` 在挂载**之前**就建好 portal 宿主(同上,按 R22 申报)

`DialogPortal` 的 Teleport 在弹窗**关着**时就已经渲染 ⇒ 宿主缺席会让**每一次**挂载都打两条
`[Vue warn]`(`Failed to locate Teleport target` / `Invalid Teleport target on mount`)。
既有两页只在弹窗用例里补宿主,实测合计 **154 条**隐形告警。本文件统一在 `mountPage` 里建**唯一**宿主。

**实测结果**:本刀两个测试文件跑 `--reporter=verbose`,`grep -c "Vue warn"` = **0**。

### 10.4 模板注释里**不复述**蓝本那个具名色的字面拼写(E-60 口径)

第一版在模板注释里写了蓝本 `:30` 那个具名色的原文拼写,**被 `knowledgeStyles.test.ts` 的
「模板内属性值位置零具名色」守卫真阳性打红**(§6 的色扫**不剥注释**)。
🔴 **这是守卫对的、代码错的** —— 已改写成不含色名的表述,并在注释里登记原因。
**没有放宽任何守卫**(§9.10)。完整 RED 输出:

```
AssertionError: views/AllowlistView.vue:模板里在属性值位置发现具名色:
background: g.bg }">
                  <KIcon :name="g.icon" :size="14" />
                <: expected [ Array(1) ] to deeply equal []
```
(`[^;]+` 的值区间从 `:style` 一直吃到下一个 `;`,把那句注释卷了进去 ⇒ 命中。)

### 10.5 `onMounted` 里 `store.loadAllowlist()` 不 await、不 catch —— **照抄**

蓝本 `created()`(`:189-191`)就是裸调,先例 `QueueView.vue:290`。**未加 catch**(加了就是未申报的偏离)。

---

## 11. 顾虑 / 交接项

1. 🔴 **票 E(裁定书 §四)在本页是可见的**:`.wps` 在真机上开不了也关不了。
   **验收清单必须按 R6-② 写明「Parser 认 45 个、页面显示 44 个,是蓝本行为不是缺陷」**,否则机主必报。
2. 🔴 **本页整页是写操作**(治理 §0.2 / §13-3):勾扩展名、加/删文件夹规则**会真的改设备上的 Parser 配置
   并触发后台清理**。验收清单要逐项标红 + 给恢复步骤 + 给现测命令
   (现测:`curl -sS -m 20 http://127.0.0.1:8283/v1/parser/allowlist/{extensions,folders}`,**直连,不经网关**)。
3. `source` 字段实测只有 `"default"` 一个值;**自定义扩展名加进去之后 `source` 是什么值,本期未验**
   (T0 只读、本刀不发写请求)。本页不渲染 `source`,**当前无影响**;若将来要按来源分色,需先真机取样。
4. 本刀**未碰路由与 rail**(`deferred.ts` / `knowledgeRoutes.ts` 归 **T8**)⇒
   本页目前**从产品导航还到不了**,验收要等 T8 反转之后。
5. 附录 B §B.5 的计数瑕疵(§10.1)与本刀两条测试文风整理(§10.2 / §10.3)请协调者裁定是否需要回写附录 / 推广到既有两页。
