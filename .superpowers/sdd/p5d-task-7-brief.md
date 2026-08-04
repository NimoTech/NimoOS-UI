# P5d · T7 任务 brief —— `NoteEditPane.vue` **上半**(顶栏 + 草稿横幅 + 主列编辑器)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-appendix-A/B/D` + `p5d-fixtures/` >
> `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 🔴 **治理已查实 15 处错(E-31 ~ E-45),冲突处信裁定书/附录/fixtures README。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高;尤其 R5 关于 N29 未实证**)
2. `p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
   (**§4.1 数据契约** · **§5.2 过期守卫** · **§9.9 可点性** · **§3/§3.5 K/N 清单** · **K5/K30/K41**)
3. `p5d-plan.md` 的 **§0 开工必读** · **§T7** · 🔴 **§T8**(**必读!** 下半归 T8,你要知道它会插在哪、别挡它)
4. 🔴 **`p5d-appendix-A-i18n.md`**(键名;**值只许来自 §A.2**)· **`p5d-appendix-D-classes.md` §D.6**
   (tiptap 契约)· **`p5d-fixtures/` 与 README**(**mock 形状的唯一权威**)
5. **T6 的成果**:`.superpowers/sdd/p5d-task-6-report.md`(尤其它确立的 reka 口径与那个**占位组件**)
6. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T7 的 DoD 1–11 是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`ec0b3a6`**(T0–T6 **七刀全部关账**) |
| 蓝本 | `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:src/views/knowledge/components/NoteEditPane.vue`(**338 行**,T0 已核)。**禁读该仓工作树** · **永远禁 `checkout`/`stash`/`reset`** |
| 新建 | `src/ai/knowledge/components/NoteEditPane.vue` · `NoteEditPane.test.ts` |
| 文件数 | **330 → 331** · `.vue` **181 → 182**(**收官值**)· color-guard **+1** |
| 🔴 **三门基线(T6 后)** | **330 文件 / `3876` 例** · `vue-tsc` 0 · `vite build` 0 |
| 已就绪的依赖 | **T1** 92 键 · **T2** 全部 scss(含 `.k-seg` / K45 `.k-btn.text` / K44 ProseMirror 段)· **T3** `noteEditHelpers.ts`(`parseTags`/`conflictMessage`)+ `notesViewHelpers.ts` · **T4** `NotesMarkdownEditor.vue` · **T5** `openAgentSessionInNewTab` · **T6** `NotesView.vue` |

## 2. 🔴 开工第一件事:**T6 留了一个占位,你必须替换掉它 —— 已有守卫在等你**

T6 因为本组件尚不存在,在 `NotesView.vue` 的 `<script setup>` 里放了一个**零逻辑本地占位组件**(已申报)。
🔴 **`NotesView.test.ts` 里有一条「自动上膛」守卫**:一旦 `src/ai/knowledge/components/NoteEditPane.vue`
**存在**,它就要求 `NotesView.vue` **必须 `import` 真组件**、**且必须不再包含那个占位**。

- **你一创建本组件文件,那条守卫立刻上膛** → 三门会红,直到你两件事都做完。
- **复审已实测两种偏态都会被逮到**:只加 `import` 不删占位 → 红;只删占位不加 `import` → 红。
  **两个 `expect` 独立报红,别想只做一半。**
- 🔴 **这是本刀允许改 `NotesView.vue` 的唯一理由**,且**只许**改那两处(加 import / 删占位及其申报注释)。
  **报告要给「`NotesView.vue` 其余一字未动」的逐行自证。**
- ⚠️ 你**新建**的 `.vue` 还要登记进 `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES`(**只许加那一行**)——
  T4/T6 都被这条中央守卫拦过。

## 3. 本刀范围(蓝本分块)与**必须留给 T8 的两块**

**本刀写**:顶栏(`:7-22`)· 草稿横幅(`:25-32`)· 主列(`:35-71`:标题/描述输入 + `kn-editor` 工具栏 +
rich/md 双模式 + 状态栏)· 对应 script(`props` / `data` / `isNew` / `status` / `wordCount` / `created()` /
`onEditorReady` / `tbActive` / `cmd` / `save` / `curateInPlace`)。

🔴 **不写**(归 T8):侧栏 5 卡(`:74-144`)· 标签编辑 · 冲突弹窗(`:148-180`)及其 script
(`sourceRefs`/`focusTagInput`/`addTag`/`removeTag`/`onTagKey`/`refLabel`/`openRef`/`openSessionRef`/
`revealFile`/`copyPath`/`openConflict`/`copyMine`/`adoptDisk`/`keepMine`)。
**那两块先不写,且不留占位符 —— T8 直接插进去。**

⚠️ **例外:`addTag()` 在 `save()` 开头被调用**(蓝本 `:273`)。**本刀的 `save()` 要照抄这个调用**,
`addTag` 的**实现**归 T8 → **你需要一个最小可用的 `addTag`**(够 `save()` 的行为成立)。
**怎么处理请在报告里申报**(例如先实现 `addTag` 本体、T8 只补 UI;或写最小版本并标注 T8 要扩)——
**拿不准写 `NEEDS_CONTEXT`。**

## 4. 🔴 T8 会来核的一条:**定位器要钉死,别靠「文件里只有一个」**

计划书 §T8-11 明文规定:**T8 不许动 T7 的断言**;若某条 T7 用例因插入下半而「测错东西」,
那是**被迫改动、要逐处给 `git diff` 的 `-` 行自证**。
🔴 **预防责任在你**:写定位器时就**钉到唯一祖先或用 `data-testid`**,
**不许靠「本文件目前只有一个 `.kn-card`」这种隐含前提**(P5c E-22 同族:同名容器类的定位器在插入第二个同类区块后
会先命中错的)。**报告要说明你的定位器策略。**

## 5. 🔴 六个「照做会假绿 / 最容易被顺手清理」的点

### ① N29:`tbActive` 里的 `tbTick.value >= 0 &&` 是**故意的假依赖,不许删**

**这是本刀最容易被「顺手清理」的一行。**
- **判据**:一条「触发 `transaction` 事件后工具栏 `data-on` 跟着变」的用例;**删掉那半必须报红。**
- 🔴 **裁定 R5**:T0 的探针**只挂了编辑器 SFC,没挂父组件** → **N29 整条链路 T0 没实证**。
  **本刀不许引附录 D §D.6.1 当已证,必须自附变异证据。**

### ② §5.2 过期守卫(K15 同族)

`created()` **两发**(`get` + `backlinks`)必须加,**且守两件事**。
🔴 **`:key="editingId"` 会重建实例 → 「两实例交错」用例在这里尤其真实。**
**判据:把守卫变量挪到模块级 → 那条必须报红。inline 写,不许抽公共 guard。**

### ③ K5/K30:**不许把后端 `e.message` 拼进 toast**

⚠️ **蓝本 `:296` 确实拼了 `e.message`** —— **本仓按 K5 既定模具只弹固定文案**(`aiKbOpFailed`)。
🔴 **这是有意偏离,必须显式申报。** **判据用排除式断言:DOM/toast 必须不含后端文本。**

### ④ K41 类型收窄(**禁 `as any`**)

`Note.tags` 是 `unknown[]` → `as string[]`;`Note.body` 是 `unknown` → `as string | undefined`;
`revision?` / `status?` / `type?` 是 optional。
🔴 **每处在文件头注释里登记「包侧类型 → 本仓收窄 + 字段依据(蓝本哪一行读了它)」。**
🔴 **禁 `as any`**;**若某处需要运行时校验才安全,那就不是 K41,要单独申报。**

### ⑤ 四组「照抄不改」

- **N27**:`:17` 的四档三元嵌套照抄(`Saving… / Unsaved changes / Not saved yet / Saved · rev {n}`),
  **四档都要用例**。**不许改成 computed 映射表。**
- **N26**:`:28` 的三段式拼接照抄(**三个独立键 + 中间加粗**),**不许合成带 HTML 的键、不许用 i18n slot**。
- **N28**:`wordCount` 正则 ``/[#|\-*`>\s]/g`` **照抄**,**不许"修正"成 markdown 感知的计数**。
  **边界用例**:空 body / 全是被剥字符 / 混合。
- **`data-on` 与 `data-dirty` 全部照抄 `String()`**(蓝本 `:15/43/44/45/47/48/50/51/52/55/56`)——
  P5b **E-9 已裁定**:套不套渲染一致,改写 = **无关重构**。
  🔴 **断言 `toBe('true')`/`toBe('false')`,禁 `toBeUndefined()`。**

### ⑥ Vue watch 去重坑(**T4 栽过、已被复审证实**)

写「不重复触发 / 去重」类用例时,**回写值必须与初始值不同** —— 否则 Vue 的 `Object.is` 前置去重
会让**回调完全不执行**,用例在守卫被整段删掉时也照样绿(**测试路径从未到达被测代码**)。
🔴 **判据永远是:拿掉产品代码的守卫,这条用例必须红。**

## 6. `save()` 的两条路与三种禁用组合

- `isNew` → `create` + `router.push('?id=' + n.id)`;否则 → `update({expectedRevision: note.revision, …})`。
- **`addTag()` 在 `save()` 开头被调用** → 「输入框里有未提交的标签,点保存时会被带上」**要有用例**。
- **catch 分岔**:`conflictMessage(e) && !isNew` → `openConflict()`(**弹窗归 T8**,本刀只到
  「`conflict` state 被设上」)· 否则弹 `aiKbOpFailed`(见 §5-③)。
- `:disabled="saving || (isNew && !form.title.trim())"` —— **三种组合都要用例**(§9.9)。

## 7. 数据契约(K1;**mock 搞反按 Critical**)

- 🔴 **mock 形状一律取自 `p5d-fixtures/`(T0 落的真机响应体),不许手编** —— 本档栽过三次裸信封 unwrap。
- **409 冲突的真实 body 含 `current_revision`**(T0 已回后端源码 `agent/main.py:2870-2872` 坐实)。
- `service.notes.backlinks()` 返回**数组**(空时 `[]`),**不是 `{backlinks:[]}` 信封** ——
  ⚠️ 本刀 `created()` 会发它,**即使卡片渲染归 T8,取数与守卫是本刀的事**。

## 8. 常驻纪律

- 🔴 **申报注释一律引「蓝本 `file:line`」与「附录 B 行号」,禁在注释里写 `#hex`/`rgb()`/`rgba()`/具名色**
  —— **§0.3 明令「注释里也不许出现色字面量」**,且两条颜色扫描**都不剥注释**(有意为之)。T2 `f128450` 是先例。
- **缺口③**:补「`<template>` 块零裸色」定向断言。⚠️ **本刀模板无内联色**(那 1 处在 `:152`,归 T8)。
- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。
- 🔴 **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- ⚠️ **代码膨胀会被评审逐行追来历**(T3/T4/T5/T6 各查一次,四次都干净)。
- **移植纪律**:界面严格 1:1;Vue2 的 bug/竞态/吞错**不照抄**,改正确逻辑并按治理 §3 **申报登记**;**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。只有 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**;其余**先申报再做**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**。不装依赖。
- **不碰** `src/i18n/**` · `src/ai/styles/knowledge.scss` · `util/**` · `NotesMarkdownEditor.*` · `openInApp.*` ·
  **`knowledgeStore.ts`(全期零改动)**。`.sp8/NimoOS-Service` 零改动(裁定 R12)。

## 9. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t7-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t7-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t7-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「330 + 1 = 331 文件」与「3876 + 本刀新增 N = 实测值」两个算式**。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …` ·
`uploads.reattach-persist.test.ts` 的既有 stderr 噪声 · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
包管理器 **`pnpm`**。

## 10. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-7-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:§T7 **DoD 1–11 逐条** · **§5 六处各自的变异证据**(尤其 ① N29 删掉假依赖 → 报红、
  ② 守卫挪模块级 → 报红,各贴两段输出 + `md5`)· **占位替换 + `NotesView.vue` 其余一字未动的逐行自证** ·
  **定位器策略(§4)** · **`addTag` 怎么处理的申报** · **K41 逐处登记** · **K5 偏离的显式申报** ·
  用了哪几个 fixture、mock 形状取自哪一层 · 命中的每一条 K/N 编号申报 · 三门两个算式 ·
  `knowledgeStyles.test.ts` 只加一行的自证。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 11. 提交

一刀 = 一个语义提交(`feat(kb): P5d T7 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
