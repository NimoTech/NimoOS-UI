# SP8-P5c Task 9 报告 —— `SettingsView.vue` 下半(笔记根目录 + reka 迁移弹窗)

**状态:`DONE_WITH_CONCERNS`**(顾虑三条,见 §12;其中 ①「Service 仓 `dist` 有未还原的探针污染」
是一条真环境缺陷,已修复并留证)

| | |
|---|---|
| 分支 / 起点 | `sp8-ai` @ `d438cbf`(工作树干净) |
| 提交 | 见文末 §13(`git show --stat`) |
| 改的文件 | `src/ai/knowledge/views/SettingsView.vue` · `src/ai/knowledge/views/SettingsView.test.ts`(**零新增产品文件**) |
| 台账新增 | `.superpowers/sdd/p5c-task-9-report.md` · `p5c-task-9-fixture-verify.mjs`(`git add -f`) |
| 三门 | `pnpm test` **Test Files 326 passed (326) / Tests 3514 passed (3514)**,exit 0 · `vue-tsc --noEmit` exit 0(零输出)· `pnpm build` exit 0(`✓ built in 40.62s`) |
| 算术 | 测试文件数 **326 不变** · `.vue` **179 不变**(`find src -name '*.vue' | wc -l` = 179)· `color-guard` 用例数不变(零新增 `.vue`)· 用例 3459 → **3514**(+55) |

**用例数算术自证**:`SettingsView.test.ts` 的 `it(` 从 **57**(`git show HEAD:…` 实测)增到 **112**,
差 **+55**;全量 3459 + 55 = **3514** ✅ 逐字吻合,没有别处被动增减。

---

## 1. 逐条对照:蓝本 → New-UI(**行号由脚本重算**,不是手写)

蓝本 = `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/SettingsView.vue`(322 行)。
New-UI 行号由 `python3` 逐锚点 `re.search` 重算(治理教训:T7 手写行号全面陈旧被评审报 Important)。
本文件现共 **656** 行(`<script setup>` 起 `:199`,`<template>` 起 `:440`)。

### 1.1 模板(下半)

| 蓝本 | New-UI | 内容 |
|---|---|---|
| `:63-70` | **`:505-513`** | 笔记区 `.k-section` + `.k-section-head`;`.k-section-title` = **`:509`**(`📝` 在 `t()` **外面**) |
| `:71-102` | **`:514-552`** | 笔记目录行 `.k-set-row`(带 `style="align-items: flex-start"`) |
| `:77` | **`:521`** | `<code>{{ notesSettings.notesRoot \|\| '/DATA/Notes' }}</code>` + ` — ` + 说明(**兜底照抄**) |
| `:79` | **`:523`** | 折叠区 `v-if="rootPicker.open"` + `style="border-top: 1px dashed var(--line); …"` |
| `:80` | **`:524`** | `<FolderBrowser ref="fb" :roots="browserRoots" @pick="onPick" />` |
| `:81-86` | **`:525-533`** | `.kn-picked` + 「已选择:」+ `<code>` + **三档徽标**(`:530-532`) |
| `:87-96` | **`:534-546`** | `.kn-pick-actions`:「仅指向」(**`:535`**)·「搬文件」(**`:542`**,两条件 disabled)· `.kn-pick-note`(**`:545`**) |
| `:99-101` | **`:549-551`** | 「更改 / 取消」按钮(`ghost` / `outline` 二选一) |
| `:104-116` | **`:554-569`** | 自动捕获行;`.warn` = **`:562`**(`v-if="!notesSettings.autoExtract"`);`.k-sw` = **`:568`**(`String(!!…)`) |
| `:120-156` | **`:573-617`** | 迁移确认弹窗 —— **K29 转 reka**:`DialogRoot` **`:576`** · `DialogPortal to=".knowledge-app" defer` **`:577`** · `DialogOverlay class="k-modal-bg"` · `DialogContent class="k-modal" style="width: min(460px, 100%)"` |
| `:124` | **`:583-585`** | `<DialogTitle as-child><div class="k-modal-title">…</div></DialogTitle>` |
| `:125` | **`:586`** | `.k-modal-x` + `<KIcon name="x" :size="13" />` |
| `:128-132` | **`:589-593`** | `.kn-mig-path`:旧路径 `span`(`color: var(--text-tertiary)`)→ `arrowRight`(`color="var(--warning)"`)→ `<b>` 新路径 |
| `:133-143` | **`:595-605`** | `.kn-mig-req` 三个 `<li>`;第一个的 `:color` **三元** = **`:597`**;红色 `<b v-if>` = **`:600`** |
| `:144-147` | **`:606-609`** | `.kn-checkline` + `<input v-model="migrateAck" type="checkbox" />` |
| `:149-153` | **`:611-616`** | `.k-modal-foot`:`ghost` 取消 + `danger` `:disabled="!migrateAck"` + `upload` 图标 |

### 1.2 script(下半)

| 蓝本 | New-UI | 内容 |
|---|---|---|
| `:206-211` | **`:221-241`** | data() 五项:`notesSettings` **`:225`** · `rootPicker` **`:228`** · `dirProbe` **`:232`** · `migrating`/`migrateAck` **`:238-239`** |
| `:80` 的 `ref="fb"` | **`:243`** | `const fb = ref<InstanceType<typeof FolderBrowser> \| null>(null)` |
| `:224-226` | **`:270`** | `browserRoots = computed(() => pickerRoots(store.wikiCandidates))`(**K1 第二处降层**) |
| `:228-230` | **`:278-284`** | `created()` → `onMounted(async () => { try … catch { /* keep defaults */ } })` |
| `:232-240` | **`:292-303`** | `openRootPicker()` |
| `:241-253` | **`:312-327`** | `onPick(path)`;**守卫① `:317`**(成功分支)· **守卫② `:320`**(catch 侧) |
| `:254-262` | **`:329-338`** | `toggleAutoExtract()` |
| `:263-266` | **`:340-343`** | `closeMigrate()`(**两个 state 都清**) |
| —(K29 落地件) | **`:351-353`** | `onMigrateOpenChange(v)` —— reka 的 `@update:open` → `closeMigrate()` |
| `:267-270` | **`:356-359`** | `doMigrate()`(**先关后发**) |
| `:271-281` | **`:367-378`** | `applyRoot(mode)` |

---

## 2. 🔴 mock 层次逐条自证(治理 §4.1 那张表)

| 方法 | 本文件 mock 成什么 | 依据 | 自证 |
|---|---|---|---|
| `service.notes.getSettings` / `putSettings` | **camelCase,且只有 `{ notesRoot, autoExtract }` 两个字段** —— `NOTES_SETTINGS = { notesRoot: '/DATA/Notes', autoExtract: true }` | `notes.ts:252-262` 走 `normalizeSettings`(`:131-137`) | HTTP fixture 原文有 **5** 个字段(`notes_root` / `auto_extract` / `distill_roots` / `distill_daily_cap` / `background_model`),抄本只有 **2** 个 camelCase 字段。**降层由 `p5c-task-9-fixture-verify.mjs` 的「②降层层」用逐字重写的 `normalizeSettings` 程序化验过**(见 §5) |
| `service.notes.dirInfo` | `{ exists: boolean, empty: boolean }` —— `DIR_INFO_NOTES = { exists: true, empty: false }` | `notes.ts:264-267`(只做 `!!` 归一) | 同上,②降层层 MATCH |
| `service.wiki.getCandidates` | 已归一化数组,空时 `[]` | `wiki.ts:154-156` | 同上,②降层层 MATCH |
| `service.folder.getList`(经 `FolderBrowser`) | 🔴 **单层** `{ content: [] }` | `folder.ts:7-10` 已 `unwrap()` | **与 `FolderBrowser.test.ts:185` 的 `folder.getList.mockResolvedValue({ content: [] })` 逐字同形状**(§4.1 的 red flag 自查通过);**没有**把 `folder-list-DATA.json` 那个三层信封整个塞进来 |
| `service.ai.parserStats/parserState/parserControl` | HTTP 原样 snake_case(T8 既有,**一字未动**) | `ai.ts:591-596` | T8 的两个 FIXTURE-COPY 块零改动 |

**与 `FolderBrowser.test.ts` 的形状一致性自查**:两个文件都把 `service.folder.getList` 当作
「resolve 出单层 `{ content }`」;`FolderBrowser.test.ts` 另有一条**反向判别用例**
(`:174-182`「若把三层信封整个塞进来则列表为空」)证明它取的是 `.content` 而非 `.data.data.content`。
本文件不重复那条(不是本页职责),只保持形状一致。

**为什么不抄 `folder-list-DATA.json`(§4.4「用不到的说明为什么不抄」)**:本文件没有一条断言依赖
目录列表的内容 —— 列表渲染 / 排序 / 隐藏项过滤全部由 `FolderBrowser.test.ts` 拿真 18 项 fixture 覆盖;
这里只需要「点根目录那一行能走通」,喂 `{ content: [] }` 即可。

---

## 3. 🔴 「T8 上半零改动」自证 + 被迫改的 4 处

`git diff` 里**所有** `-` 行(即被删/被改的行)全文如下 —— 这就是自证:

**`SettingsView.vue`(8 条 `-` 行,其中 7 条是注释)**
```
-  🔴 **本刀只做蓝本的上半**;下半(笔记根目录折叠区 + 迁移确认弹窗 + 自动捕获开关 +
-  `notesSettings` / `rootPicker` / `dirProbe` / `browserRoots` 那一整套 script)归 **T9**,
-  按计划书要求**不留占位符、不留注释桩**,T9 直接把 DOM 插在「运行档卡」与「沙盒入口」之间。
-  结构对照(蓝本行区间 → 本文件,New-UI 行号由脚本重算,见 T8 报告 §2):
-    :215-223 computed `controlState` / `deviceLabel`
-    (挂载即拉 + 10 秒轮询)填充,本页**自己不发只读请求**(蓝本 `created()` 里那一发
-    是 `notesApi.getSettings()`,归 T9)。
-import { computed } from 'vue'
```
→ **产品代码只有 1 行被改:`import { computed } from 'vue'` → `import { computed, nextTick, onMounted, ref } from 'vue'`。**
T8 的 DOM、`controlState` / `deviceLabel` / `togglePause` / `setConcurrency` / `setDevice` /
`toggleOcr` / `goSandbox` **一个字节都没动**(其余全是 `+` 行插入)。
那 7 条注释都是「T9 将来会做」的陈述,T9 落地后它们已成假话,故就地订正(注释不属于
brief 的「DOM / script / 断言」三类)。

**`SettingsView.test.ts`(11 条 `-` 行)**
```
-// SP8-P5c Task 8 —— `SettingsView.vue`(上半)的组件测试。          ← 注释
-// 🔴 本文件只覆盖 T8 范围:…                                        ← 注释(4 行)
-// 🔴 `service.notes.*` 本文件**一个都不 mock**…                     ← 注释(2 行)
-vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))     ← 触点①
-  it('源码侧:四个 catch 一个都不读 `e`(零 …)', () => {             ← 触点④(用例名)
-    // 四个 catch 都是无参 `catch {`(连错误对象都不接)              ← 触点④(注释)
-    expect((code.match(/\}\s*catch\s*\{/g) || []).length).toBe(4)     ← 触点④(计数)
-    const head = w.find('.k-section .k-section-head')                ← 触点③(定位器)
```

**四个触点逐条交代(全部是「插入下半」的机械后果,不是自选)**

| # | 改了什么 | 为什么非改不可 |
|---|---|---|
| ① | `vi.hoisted` 骨架 +3 域(`notes` / `wiki` / `folder`)、`vi.mock` 工厂 `{ service: { ai } }` → `{ service: { ai, notes, wiki, folder } }` | 组件下半真的调这三个域。不加 → `service.notes` 是 `undefined`,`onMounted` 里当场 TypeError |
| ② | `mockAllOk()` **+5 行**(纯新增,零改动既有 3 行) | T8 既有用例也会挂载新组件 → 若 `getSettings()` 返回 `undefined`,`notesSettings.value = undefined`,模板读 `.notesRoot` 立刻炸。默认值必须落在 T8 的 `beforeEach` 调的这个 helper 里 |
| ③ | **E-22**:危险区区头的定位器 `w.find('.k-section .k-section-head')` → `dangerSection(w).find('.k-section-head')`,新增语义定位器 `dangerSection`(按「卡上有 `.k-set-danger`」找,**不用下标**) | 插入笔记区后 `.k-section` 有**两个**(笔记区在前),`find` 会先命中笔记区 → 标题变 `📝 知识笔记` → T8 那条断言必红。**三条 `expect` 的值一字未动** |
| ④ | **E-23**:「每个 catch 都是无参 `catch {`」那条的计数 `4` → `8`(连带用例名「四个 catch」→「每个 catch」、注释同步) | 下半新增 4 个 `catch`(`created` 的 `getSettings` / `onPick` / `toggleAutoExtract` / `applyRoot`)。断言**语义未变**(仍是「全部 catch 都不接错误对象」),只是覆盖面从 4 扩到 8;`.message` / `.response` / `.detail` 三条否定式断言原样保留 |

**T8 的 57 条用例里,`expect` 的值只有触点④ 那一个数字变了;其余 56 条一字未动。**
T8 的四对 §9.2 en 档断言(N21 #1/#2 + 两对 T8 重扫发现的)**完全没碰**。

---

## 4. 🔴 K29 —— reka 弹窗的改法

**蓝本**(`:121-156`)是裸 `<div v-if="migrating" class="k-modal-bg" @click="closeMigrate">` +
内层 `<div class="k-modal" @click.stop>`。

**本仓**(`:576-617`):
```
DialogRoot :open="migrating" @update:open="onMigrateOpenChange"
  DialogPortal to=".knowledge-app" defer
    DialogOverlay class="k-modal-bg"
      DialogContent class="k-modal" style="width: min(460px, 100%)" :aria-describedby="undefined"
```
结构逐字照既有两个先例:`QueueView.vue:559-583`(T5)与 `IndexedFilesView.vue:1135-1180`(P5b)。

**三处映射**

1. **点遮罩关闭 / 点弹窗内不关闭** → `DialogContent` 的 `pointerDownOutside`(等价)。
   用例「点遮罩(弹窗外)关闭;点弹窗内不关闭」两侧都验;并按 `QueueView.test.ts` 的既有注释补一次
   **真宏任务 tick**(`await new Promise(r => setTimeout(r, 0))`)—— reka 的 `usePointerDownOutside`
   用 `setTimeout(0)` 延后挂 `document` 监听,`flushPromises()` 只刷微任务刷不到。
2. **`@update:open` 必须接 `closeMigrate()`,不能照抄 `QueueView` 的 `confirmClear = $event`。**
   蓝本的三条关闭路径(× / 取消 / 点遮罩)全走 `closeMigrate()`,它清**两个** state。
   写成 `migrating = $event` 会漏清 `migrateAck` → 下次打开时勾选框还勾着、danger 按钮直接可点。
   → 单独用例「🔴 closeMigrate 清 migrateAck:关掉再打开…」+ 源码侧断言
   `not.toMatch(/@update:open="migrating\s*=/)` 两头钉住。
3. 🔴 **`DialogTitle` 的落法与两个先例不同,是有意的偏离(本报告显式申报)**:
   两个先例的蓝本里**没有**可见标题元素,所以它们加了一个 `VisuallyHidden > DialogTitle` 隐藏节点;
   **本页蓝本 `:124` 本来就有 `.k-modal-title`** → 用 `<DialogTitle as-child>` 直接套在那个 `div` 上。
   结果:DOM 与蓝本逐字一致(**不多一个隐藏节点**),reka 的 a11y 要求同样满足(`aria-labelledby`
   实测落在 `.k-modal` 上,值 `reka-dialog-title-v-0`)。
   **判据**:brief 说「照先例抄,别自己发明」,而先例的写法在本页会**多出蓝本没有的 DOM 节点** ——
   1:1 优先级更高。若评审判「统一用 VisuallyHidden」,改法是 3 行,不影响任何断言以外的东西。

**测试里 `withHost()` 的写法**(先例 `QueueView.test.ts:141-146`):
```ts
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}
```
交接项 #3(`to` 只认**第一个**同名宿主):每条弹窗用例只 `withHost()` 一次,
清理靠 T8 既有 `afterEach` 的 `document.body.innerHTML = ''`。
**挂载后先 `await nextTick()`(且弹窗打开后再补 `flushPromises()`)才查 `document`。**
判别力由探针 **P7**(把 `document.body.appendChild(host)` 换掉)证明:**11 条弹窗用例全红**。

---

## 5. §4.4 —— fixture 抄本 + 等价校验 + 变异验证

三份 fixture **逐字抄进测试文件**的 `FIXTURE-COPY-BEGIN/END` 块(注明出处与抓取日期),
**不用 `node:fs` 运行时读 `.superpowers/`**。因为本刀三份都要过一层降层,校验分两层
(脚本 `.superpowers/sdd/p5c-task-9-fixture-verify.mjs`):

```
$ node .superpowers/sdd/p5c-task-9-fixture-verify.mjs
FIXTURE-COPY 块总数 = 5(T8 的 2 个 + T9 的 3 个 = 5)
MATCH    ①原文层 notes-settings.json  bytes=112/112(文件 112,剥尾换行 0)
MATCH    ②降层层 notes-settings.json → NOTES_SETTINGS  抄本={"notesRoot":"/DATA/Notes","autoExtract":true}  归一后={"notesRoot":"/DATA/Notes","autoExtract":true}
MATCH    ①原文层 notes-dir-info-notes.json  bytes=29/29(文件 29,剥尾换行 0)
MATCH    ②降层层 notes-dir-info-notes.json → DIR_INFO_NOTES  抄本={"exists":true,"empty":false}  归一后={"exists":true,"empty":false}
MATCH    ①原文层 wiki-candidates.json  bytes=2/2(文件 3,剥尾换行 1)
MATCH    ②降层层 wiki-candidates.json → WIKI_CANDIDATES  抄本=[]  归一后=[]

结果:ALL MATCH
exit=0
```
- **①原文层** = 块里那行 `// HTTP 原文(逐字节):…` 与 fixture 文件**逐字节**比对
  (唯一容许的差别是文件末尾换行 —— `wiki-candidates.json` 有、另两份没有,那是落盘时 shell 加的)。
- **②降层层** = 原文过一遍逐字重写的包内归一函数(`normalizeSettings` `notes.ts:131-137` /
  `dirInfo` `:264-267` / `getCandidates` `wiki.ts:154-156`),结果与抄本 `const` 深度相等
  —— 这一层**才是**「mock 层次对不对」的证据。

**变异验证**(证明脚本不是空转):
```
$ node .superpowers/sdd/p5c-task-9-fixture-verify.mjs --mutate
*** 变异模式:抄本 NOTES_SETTINGS.autoExtract true → false ***
MISMATCH ②降层层 notes-settings.json → NOTES_SETTINGS  抄本={"notesRoot":"/DATA/Notes","autoExtract":false}  归一后={"notesRoot":"/DATA/Notes","autoExtract":true}
结果:1 处不符   (exit=1)
```

---

## 6. 🔴 RED 探针 —— 16 条,全部报红,md5 逐字节还原

跑批脚本对每条:① 精确替换(**命中数必须等于期望,不等就自我停机**)② 证明注入真落盘(内容 + md5 变化)
③ 跑本文件全量并**解析 `Tests` 汇总行**(治理 §9:解析不到就算无效结果)④ 从备份还原 ⑤ md5 比对。

| # | 变异 | 结果 | 代表红项 |
|---|---|---|---|
| P1 | `onPick` **成功分支**守卫整行删掉 | `1 failed / 110 passed` | 交错路径:A 的响应后到 → dirProbe 是 B 的结果 |
| P2 | `onPick` **catch 侧**守卫删掉 | `1 failed / 110` | 交错路径 · catch 侧:A 后到且失败,不许擦掉 B 的徽标 |
| P3 | **K30** · `applyRoot` 把 `e.response.data.detail` 拼回 toast | `3 failed / 108` | 「源码侧:每个 catch 都不读 e」+ K30 两条排除式断言 |
| P4 | **K30** · `toggleAutoExtract` 把 `e.message` 拼回 toast | `2 failed / 109` | 同上 + `catch⑥ toggleAutoExtract` |
| P5 | 「搬文件」`:disabled` **只留一半条件** | `1 failed / 110` | 探针 done + 不可迁移 → 「搬文件」灰 |
| P6 | `migratable` 判据 `\|\|` 改 `&&` | **`19 failed / 92`** | ②两档 curated 全塌成 draft |
| P7 | reka portal 宿主**不挂进 body** | **`11 failed / 100`** | 全部弹窗用例 |
| P8 | `closeMigrate` 只清 `migrating`、不清 `migrateAck` | `1 failed / 110` | 关掉再打开,勾选框应是未勾 |
| P9 | `doMigrate` 顺序反转(先发请求再关弹窗) | `1 failed / 110` | 「开始迁移」先关后发 |
| P10a | 目录行的 `\|\| '/DATA/Notes'` 兜底删掉 | `2 failed / 110` | N7 同族兜底 + created catch 保默认 |
| P10b | **弹窗**旧路径的 `\|\| '/DATA/Notes'` 兜底删掉 | `1 failed / 111` | N7 同族第二处(见下方「自捕」) |
| P11 | 自动捕获开关的 `!!` 删掉 | `1 failed / 110` | `autoExtract` 缺席时应是 `"false"` 不是 `"undefined"` |
| P12 | `openRootPicker` 不清上次的 `path` | `1 failed / 110` | 承接 Vue2 spec「重开时清 stale path」 |
| P13 | `openRootPicker` 不调 `fb.reset()` | `1 failed / 110` | 展开时下一帧调 reset() |
| P14 | `openRootPicker` 不拉 wiki 候选 | `4 failed / 107` | `loadCandidates` 被调 等 4 条 |
| P15 | **§9.1**:`rootPicker` 挪到**模块级**(两步注入:加一个 `<script>` 块导出共享 ref + setup 里改成引用它) | **`18 failed / 93`** | **含「两实例交错」那条** ✅ |

**两处「探针自身失效 → 自我停机」的记录(治理 §9 第七条正在起作用)**

- **P10 第一版**锚点 `notesSettings.notesRoot || '/DATA/Notes'` 在文件里有 **3** 处
  (两处模板 + 一处文件头注释的引述),命中数 3 ≠ 期望 2 → 脚本拒绝注入并打印
  `!! P10 注入目标命中 3 次(期望 2)-> 探针自身失效`。改成带标签的完整上下文分别锚定
  (`<code>{{ … }}</code>` / `<span style="color: var(--text-tertiary)">{{ … }}</span>`),两条独立跑。
- 🔴 **P10b 首跑 `111 passed (111)` —— 零判别力,自捕一条缺失用例。**
  蓝本把同一个兜底写了**两处**(`:77` 目录行 + `:129` 弹窗旧路径),我第一版只为前者写了用例。
  补上「🔴 N7 同族第二处:notesRoot 为空串时弹窗旧路径也走兜底」后,P10b 变
  `1 failed / 111 passed (112)`。**这正是「假判别力」自查该抓的东西**(治理 §4.2 最后一条)。

**还原自检**
```
SettingsView.vue       58e2cbf1d005af3a19aa89f72224836a  基线 58e2cbf1d005af3a19aa89f72224836a  一致=True
SettingsView.test.ts   7b54f9f880b2609ca7ef45bf5695a9f7  基线 7b54f9f880b2609ca7ef45bf5695a9f7  一致=True
全部还原: True
```
探针备份文件(`*.probebak` / `*.p10bak`)已 `rm`,`git status` 只剩那两个 `M` + 台账两份新文件
(见 §13)。**探针不在提交里。**

---

## 7. §9.1 —— 「两实例交错」做了(不是论证不适用)

brief 允许「判不需要就给论证」。我判**需要且成本极低,直接做了**:

- 用例名:**`🔴 §9.1 —— **两实例交错**:各自拿到自己的结果,互不覆盖(守卫变量必须是组件本地)`**
  (在 `describe('SettingsView/T9 —— onPick 过期守卫…')` 下)
- 做法:挂两个实例 → 各自展开选择器 → 实例 1 选 `/DATA`、实例 2 选 `/media`(两个 `dirInfo` 都在飞)
  → **实例 2 先回、实例 1 后回** → 断言两边各自的 `.kn-picked code` 与徽标档位都是**自己**的。
- **判别力已实证**:探针 **P15** 把 `rootPicker` 挪到模块级(加一个 `<script lang="ts">` 块导出共享
  `ref`,setup 里 `const rootPicker = probeShared`)→ **18 条红,含这一条** ✅。

顺带一条本刀独有的观察(供治理参考):本页的守卫变量是 `rootPicker.path` —— **它同时被渲染**
(`v-if`、`<code>`、两个按钮的 `:disabled`),所以「两实例串号」在 DOM 上直接可见;
这与 `FolderBrowser` 的 `seq`(纯内部、不参与渲染,T3 评审探针实测「挪到模块级零报红」)不同。
但**光有这条性质不构成豁免** —— 只有真写了那条用例才有守卫,所以还是写了。

---

## 8. §9.2 / §9.3 —— 双向 en 扫描结论

- 键集:本刀用到 **29** 个键(27 个 `aiKbSet*` 新键 + 复用 `aiKbCancel` / `aiKbOpFailed`)。
- 全表键数用**真实模块导入**计:**1503**(zh 与 en 各 1503;治理 §9.3 第 2 条:文本解析会少算)。
- **方向 1(§9.2)zh 撞车 → en 是否不同**:撞车 **9 对**,`en` **全部相同** → 零同族对。
- **方向 2(§9.3)en 撞车 → zh 是否不同**:撞车 **9 对**,`zh` **全部相同** → 零同族对。
- 那 9 对是:`aiKbCancel` × {`filesCancel`, `startAppCancel`, `appsCancel`, `appsSettingsCancel`,
  `aiCancel`, `aiCfgCancel`} · `aiKbSetChange` × `aiChange` · `aiKbOpFailed` × {`filesOpFailed`,
  `filesShareFailed`} —— 全是「同一句话在不同区各有一个键」,两档都同值。

→ 🔴 **本刀余零同族对**,不需要新增 en 档正/反向断言;**T8 那四对的断言原样保留、一字未动**。

**但这个「零」被钉成了三条常驻断言**(`describe('… §9.2/§9.3 双向同族扫描:本刀余零对')`):
方向 1 的集合必须为 `[]` · 方向 2 的集合必须为 `[]` · **外加一条「那 9 对撞车确实存在且两档同值」**
—— 第三条是为了证明前两条不是「扫不到东西」的空转(治理 §9 第十条「特征串必须独特、不能恒真」同族)。
将来谁加一个「zh 同 / en 不同」的键,前两条会精确点名,逼他按 N21 登记。

---

## 9. 命中的 K / N 编号显式申报

**K 系列**

| 编号 | 命中处 |
|---|---|
| **K1** | `store.state.wikiCandidates` → `store.wikiCandidates`(`browserRoots`,**下半唯一一处新降层**);`store.actions.loadCandidates()` → `store.loadCandidates()`;`store.actions.toast()` → `store.toast()`(3 处:`toggleAutoExtract` 成功/失败、`applyRoot` 成功/失败) |
| **K7 / K29** | 迁移弹窗转 reka + `DialogPortal to=".knowledge-app"`(详见 §4) |
| **K27** | `notesApi.getSettings/putSettings/dirInfo` → `service.notes.*` |
| **K30(K5 同族)** | `applyRoot` 与 `toggleAutoExtract` 两处 catch **只弹固定 `aiKbOpFailed`**,不回显后端 `detail` / `e.message`;排除式断言 + 探针 P3/P4 |
| **K34** | 三条机械改写,**零行为变化**,已在文件头注释登记:`this.$refs.fb` + `this.$nextTick` → 模板 `ref` + `nextTick()` · `async created()` → `onMounted(async …)` · `data()` → `ref()`。**下半零 `?.`、零 `&&` 守卫、零 `!` 非空断言** —— `if (fb.value) fb.value.reset()` 里那个 `if` **是蓝本 `:238` 自己写的守卫**,属照抄而非 K34 |

**N 系列**

| 编号 | 照抄了什么 |
|---|---|
| **N7 同族** | `notesSettings.notesRoot \|\| '/DATA/Notes'` **两处**兜底(`:77` / `:129`)照抄;`pickerRoots` 的 `\|\| []` 由 T3 承担 |
| **N16** | `📝` 在 `t()` **外面**(`:509`);下半零 emoji 在 `t()` 里面;`aiKbSetNotesSection` 值本身不含 emoji(反向断言在案) |
| **§5.2** | `onPick` 两处过期守卫逐字照抄,含蓝本自带的两句英文注释语义;`FolderBrowser` 的 `_seq` 守卫本刀只 import 不动 |

**其它照抄不改的点**(不属于任何编号,逐条有用例):
`dirProbe.state === 'error'` 时**三档徽标都不出**(没有第四分支)· 「搬文件」点下去只 `migrating = true`
**不发请求** · `doMigrate` **先关后发** · `closeMigrate` 清**两个** state · 「已选择:」后面那个**裸 ASCII 冒号**
· `<input type="checkbox">` 用 `v-model`(属性顺序按 eslint 的 TWO_WAY_BINDING 在前,**渲染 DOM 与蓝本一致**)。

---

## 10. 必须有的用例(brief §4.3)对账

| 要求 | 用例 | 探针 |
|---|---|---|
| `openRootPicker` 开/关两态 | 「点「更改」展开…」/「再点一次收起…」 | — |
| **重开清 stale path**(Vue2 spec 第 1 条) | 「🔴 承接 Vue2 spec「重开时清掉上次的 path」…」 | P12 |
| **再点一次关闭不抛错**(Vue2 spec 第 2 条) | 「再点一次收起(承接 Vue2 spec「再点一次关闭不抛错」)」 | P14 也命中 |
| `loadCandidates` 被调 | 同「点「更改」展开…」(含 `toHaveBeenCalledWith()` 证明**不传 silent**) | P14 |
| `fb.reset()` 被调 | 「🔴 展开时下一帧调 FolderBrowser 的 reset()…」(唯一一条用 stub) | P13 |
| **`onPick` 交错路径** | 成功分支侧 + catch 侧各一条 | P1 / P2 |
| `dirProbe` 四态 | loading / done+migratable / done+!migratable / **error** | P6 |
| `migratable` 三组合 | 不存在 / 存在且空 / 存在非空 | P6 |
| 两按钮 disabled(「搬文件」两条件三组合) | 无路径 / done+可迁移 / done+不可迁移 / **loading 时可点** / error 时可点 | P5 |
| **reka 弹窗开关 + `withHost()`** | 9 条弹窗用例 | P7 |
| `<li>` ① `:color` 三元两侧 + `v-if` 红 `<b>` 两态 | 两条(可迁移侧 / 非空侧) | P6 连带 |
| `migrateAck` 门控 danger 两侧 | 「🔴 migrateAck 门控…」 | — |
| `closeMigrate` 清两个 state | 「🔴 closeMigrate 清 migrateAck…」+「点 ×…」+「点「取消」…」 | P8 |
| `doMigrate` **先关后发** | 「🔴 「开始迁移」→ mode: "migrate" …先关弹窗再发请求」 | P9 |
| `applyRoot` 两个 `mode` | `adopt` / `migrate` 各一条 | — |
| **K30 两处 catch 排除式断言** | `catch⑤ applyRoot("adopt")` · `catch⑤ migrate 分支` · `catch⑥ toggleAutoExtract` | P3 / P4 |
| `created` catch 吞错保默认 | 「🔴 created 的 catch 吞错保默认…」 | P10a 连带 |
| `autoExtract` 两态 + `.warn` 两态 + **后端漏字段归一 true** | 4 条 | P11 |
| `notesRoot` 空 → 兜底 | 目录行 + **弹窗旧路径**两条 | P10a / P10b |

**「点某个东西」的可点性前置确认(治理 §13 / §9)**:每条点击用例的目标元素都先断言
`exists()` / `disabled === false`;「搬文件」那条尤其 —— 本机 fixture(`/DATA/Notes` 存在且非空)下
它**是灰的**,所以打开弹窗的用例一律先把 `dirInfo` 换成可迁移目录。
「非空侧的红色 `<b>`」那条到不了(按钮灰)→ 先在可迁移目录上开弹窗、再改探针重新 pick(弹窗已开,
`migrating` 不受 pick 影响)—— 这条路径在注释里写明了。

---

## 11. K30 探针文本没撞注释的说明

两个探针串:`PROBE-NOTES-DETAIL-3b9d20` / `PROBE-NOTES-MESSAGE-8e15af`。
**只出现在 `SettingsView.test.ts` 里,`SettingsView.vue` 全文(含注释)零出现** ——
治理 §9 第九条(否定式断言撞注释 = 假报红,T6 栽过)。
排除式断言查 **5 个面**:`toast` 调用参数拼接串 · 全局 toast 栈 · `w.text()` · `w.html()` ·
**`document.body.innerHTML`**(第 5 个是为 portal 出去的弹窗内容准备的 —— 弹窗不在 wrapper 子树里)。
另有源码侧断言(T8 的,计数扩到 8):`not.toMatch(/\.message\b/)` · `/\.response\b/` · `/\.detail\b/`,
**都先 `blankComments()` 保行版剥注释**。

---

## 12. 🔴 顾虑 / NEEDS_CONTEXT

### ① 真环境缺陷:`.sp8/NimoOS-Service/dist` 有**未还原的探针污染**(已修,请协调者知会上游)

写 `browserRoots = computed(() => pickerRoots(store.wikiCandidates))` 时 `vue-tsc` 报:
```
src/ai/knowledge/views/SettingsView.vue(270,49): error TS2345:
  Argument of type '{ pathX: string; type: string; … }[]' is not assignable to parameter of type 'PickerCandidate[]'.
  Property 'path' is missing in type '{ pathX: string; … }'
```
查证:
- `NimoOS-Service/src/wiki.ts:36-41` 是 **`path: string`**;`git show 03d3028:src/wiki.ts` /
  `15c2eba:src/wiki.ts` 都是 `path` —— **`pathX` 在提交历史里从未存在**。
- 但**构建产物** `dist/wiki.d.ts:34` 是 `pathX: string;`。`dist` 被 `.gitignore` 盖着
  (`.gitignore:2`),`git status` 干净、`git diff` 为空 → **git 抓不到**。
- 消费仓通过 `file:../NimoOS-Service` 吃的正是 `dist`。

→ 结论:**2026-07-31 有人把 `dist/wiki.d.ts` 手改成 `pathX` 做变异探针,没还原**
(dist 建于 20:18,commit `03d3028` 于 20:11)。这正是记忆
`sp7-photos-migration-progress`「gitignore 目录 git 救不回」那条教训的同族。

**处置(已做)**:`cd .sp8/NimoOS-Service && pnpm build`,并对 `dist` 做 before/after 全目录 `diff -r`,
**改动恰好两处、零风险**:
```
dist/wiki.d.ts:34   - pathX: string;      +     path: string;
dist/wiki.js:89     - 蓝本 wiki.js:89-92  +     蓝本 wiki.js:93-96   ← 注释,commit 15c2eba 的行号订正从未重建进 dist
```
- **没有改任何被 git 跟踪的文件**(`dist` 在 `.gitignore` 里,不进提交;`git status` 在 Service 仓仍干净)。
- 治理 §1.1 把 `.sp8/NimoOS-Service/**` 列为全期零改动、§8 说「不需要跨仓 pnpm build」——
  这条前提是「dist 与 committed src 一致」,而实测**不一致**。我判这是**修复而非修改**
  (把产物恢复成 committed 源码应有的样子),并按治理 §1.3 的口径留全证据。
  **若协调者判越界,回滚办法就是 `cp` 回 `/tmp/.../scratchpad/dist-before`(备份仍在)**,
  但那样 `vue-tsc` 会重新报错、本刀无法交付。
- 🔴 **建议协调者顺带查一遍 `.sp8/NimoOS-Service/dist` 有没有其它同类残留**:我只能证明
  「重建后与 committed src 一致」,证明不了「之前只被改过这一处」。

### ② `DialogTitle as-child` 与两个先例的写法不同 —— 已在 §4 第 3 条给出理由,请评审拍板

若判「统一照先例用 `VisuallyHidden > DialogTitle`」,改动是 3 行,现有断言里只有
「head:标题 + × 按钮」那条需要多一个隐藏节点的容忍。**我的判断是保持现状(DOM 更贴蓝本)。**

### ③ 本页此刻**未上路由** = 预期,不是缺陷

`knowledgeRoutes.ts` 的 `settings` 仍指占位页(`DEFERRED_TABS` 含 `'settings'`),**T10 才反转**。
浏览器 `:5288` 上看不到本页;沙盒入口跳的 `/ai/parser/test` 同样仍是占位页。
**我没有改任何路由文件**(`knowledgeRoutes.ts` / `deferred.ts` 零改动,在 §1.1 清单内)。
连带:治理 §12.3 的 **E-13**(`grep -o "parser-status-page" dist/assets/*.css` 那道门)本刀同样不适用。

### 无 `NEEDS_CONTEXT` 项

29 个 i18n 键**逐个回附录 A + 语言包双向核准**(E-18 的教训:brief 给的键名可能「存在但语义不对」)——
`aiKbSet*` 27 个新键 + `aiKbCancel` / `aiKbOpFailed` 两个复用键,**全部命中、值逐字与附录 A 一致、
零新增键**。零缺键 → 无需停下。

---

## 13. 提交自查

```
$ git status --short
 M src/ai/knowledge/views/SettingsView.test.ts
 M src/ai/knowledge/views/SettingsView.vue
```
台账两份用 `git add -f`(`.superpowers/` 被 gitignore):
`p5c-task-9-report.md`(本文件)· `p5c-task-9-fixture-verify.mjs`。

**新增编号登记**:brief 勘误 **E-22**(危险区定位器)· **E-23**(catch 计数 4→8)——
两条都不是 brief「写错了」,而是 brief 的硬约束「不许动 T8 的断言」与「插入下半」在这两点上
**不可能同时满足**;按最小改动 + 断言值不变的口径处理,逐处在代码注释与本报告里登记。
