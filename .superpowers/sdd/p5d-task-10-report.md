# P5d · T10 报告 —— 路由反转 + `DEFERRED_TABS` 摘 `notes` + 收官

坐标:起点 HEAD `19fa973`(T0-T9 十刀关账),分支 `sp8-ai`,可写仓
`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`。改动仅 4 个文件(`git diff --stat`):
`deferred.ts` +7/-0(净增注释,无删)· `deferred.test.ts` +24/-1(反转注释)·
`knowledgeRoutes.ts` +10/-1 · `knowledgeRoutes.test.ts` +67/-7(反转注释)。

## 计划书 §T10 1-7 条逐条

1. **`DEFERRED_TABS` 摘 `'notes'`:5→4**——`deferred.ts:28-33` 数组删掉 `'notes'` 一行,
   剩 `search`/`wiki`/`roots`/`allowlist`。`KnowledgeTabId` 联合类型不变(`notes` 仍是合法
   tab id,只是不再"占位")。文件头按 T12/P5b-T5/P5b-T10/P5c-T10 四代先例加了 P5d-T10 一段。
2. **`notes` 子路由反转成真 `NotesView`**——`knowledgeRoutes.ts:74`(brief 给的精确坐标)
   `KnowledgeDeferred`→`NotesView`;import 加在 `:52-60` 那组(实际落在新增注释后的
   `:63` 附近,同一 import 分组内,未打散既有顺序)。
3. **两条断言精确反转,原文留成注释**:
   - `deferred.test.ts` 原 `:46-47`(brief 坐标)`toEqual([...5 项])` → 改成 4 项
     `['allowlist','roots','search','wiki']`,改前原文整段留成注释(引"P5c T10 原文"，
     不引 file:line)。
   - `knowledgeRoutes.test.ts` 末尾大断言(五代谱系里的第 5 代,现文件内已有
     `:32-202` 完整四代注释史)→ 追加第 5 代"改前"注释块(逐字引用 P5c-T10 的原
     it 块)+ 写第 6 代新 it,`notes` 单独钉成 `NotesView` 并 `not.toBe(KnowledgeDeferred)`，
     `migrated` 数组加入 `'notes'`,`stillDeferred` 断言从 5 项收窄到 4 项
     `['search','wiki','roots','allowlist']`。
   - `deferred.test.ts:60-69`「机制钉子」用例**一字未动**(见下方自证)。
4. **`deferred.ts` 文件头逐项写明 4 个占位项归属**:已加
   `'search' → P5e`；`'wiki'/'roots'/'allowlist' → P5f`（原文见下方引用）。
5. **构建管线核验**——见下方"改前搜不到/改后命中"两段输出。
6. **收官三门**:331 文件/3958 例全绿 · vue-tsc 0 · build 0(见下方三门算式）。
7. **收官口径**：见下方 §5 收官口径实测。

## 🔴 构建管线门（改前必须搜不到 → 改后必须命中）

判据（brief 给的起点，已确认在本仓context-aware，理由见下）：
`grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js`

**改动前**（`rm -rf dist && pnpm build`，退出码 0）：
```
$ grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js; echo "exit=$?"
exit=1
```
（无任何输出，grep exit=1=未命中——`notes` 路由此时仍指向 `KnowledgeDeferred`，
`NotesView`/`NoteEditPane`/`NotesMarkdownEditor` 全仓零生产 import。）

**改动后**（改 4 个文件后 `rm -rf dist && pnpm build`，退出码 0）：
```
$ grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js; echo "exit=$?"
dist/assets/index-2bWjG7-r.js:NotesMarkdownEditor
dist/assets/index-2bWjG7-r.js:kn-inbox-chev
exit=0
```
主 chunk 体积同步从 3,328.31 kB 涨到 3,723.76 kB（+395kB），与三个新 `.vue` 首次
被打包吻合。

**判据为什么是上下文感知的**：production 构建用 esbuild 压缩，**注释在压缩产物里
一律被剥净**（抽样验证：对 `.js` 全文搜 `//`/`/*`，命中的全是字符串里的 URL
`https://`/正则 `\/\//`，无一例真注释——见下方证据），所以 dist 产物里根本不存在
"注释与真代码撞同一子串"这条风险路径本身。进一步核实两处命中的上下文，确认是
真代码而非偶然子串：
```
$ grep -o '.\{30\}kn-inbox-chev.\{10\}' dist/assets/index-2bWjG7-r.js
abled"],_hoisted_17$2={class:"kn-inbox-chev"},_hoiste
$ grep -o '.\{10\}NotesMarkdownEditor.\{30\}' dist/assets/index-2bWjG7-r.js
({__name:"NotesMarkdownEditor",props:{modelValue:{}},emits:
```
前者是 Vue 编译器 hoist 出的静态 class 对象字面量，后者是 `<script setup>` 编译产出的
组件 `__name` 属性——两者都只能来自真实编译的组件代码，压缩产物里没有别的来源能
产生这个形态。**CSS 侧未混同**：另跑
`grep -o "kn-note-row\|kn-edit-aside\|nme-content" dist/assets/*.css` 三者皆命中，
但这是 T2 起 `knowledge.scss` 早被 `KnowledgeLayout.vue` import 的既有事实，**不作为
本刀 JS 可达性的证据**（承 P5c E-8）。

## 「反转不删」注释位置与格式

- `deferred.ts:16-21`（文件头历史注释追加第 5 段）+ `deferred.ts` 数组本体删 1 行。
- `deferred.test.ts:45-63`：新 it 前完整保留"改前(P5c T10 原文,反转前)"注释块
  （逐字引用），格式与既有 P5a-T3→P5b-T5→P5b-T10→P5c-T10 三代先例一致，**引条目
  编号/期号，不引 file:line**。
- `knowledgeRoutes.test.ts:165-218`：新增第 5 代"改前(P5c T10 原文,反转前)"注释块
  （逐字引用整个原 it），再接"改后(本次,P5d T10,收官)"说明 + 新 it。与文件内已有
  的四代谱系（`:32-165`）格式完全一致。

## `deferred.test.ts:60-69` 机制钉子自证

`git diff -- src/ai/knowledge/deferred.test.ts` 显示改动全部集中在文件顶部第一个
`it()` 块（原 `:45-52` 一段），diff 里**没有任何一行**落在"机制钉子"用例
（`it('isDeferred 的判定来源是 DEFERRED_TABS 本身', ...)`）——该用例现文件内位置
下移到 `:80-89`（因前面插入注释行数增加），`grep -n` 定位确认内容逐字未变。

## `deferred.ts` 文件头 4 占位项归属原文

```
// 【SP8-P5d Task 10,2026-08-05】'notes' 已迁(NotesView.vue,T6-T9 四刀收官 +
// knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 5 项变 4 项。
// 🔴 兑现治理 §15.1「跨期占位烂尾」的通用教训 —— 本期票 1 的起因就是「前三期都
// 漏了导航入口」,占位烂尾没人认领。逐项写明剩下 4 个占位项归哪一期反转:
//   · 'search'                       → **P5e**
//   · 'wiki' / 'roots' / 'allowlist' → **P5f**
```

## 命中的 K/N 编号

**K7**（占位机制反转不删,本刀第 5 次同款先例落地,机制钉子保留）· 承 **E-13**
（构建管线核验,P5c 先例）· 承 **E-8**（CSS/JS 不混同）· 承 **E-25**（判据须
选择器/上下文感知，本刀用真实压缩产物零注释这一事实自证）。未新增 K/N。

## 🔴 §5 收官口径（逐项实测 + 取数命令）

| 项 | 实测值 | 命令 |
|---|---|---|
| 文件数 | **331** | `pnpm test` 输出 `Test Files 331 passed (331)` |
| 用例数 | **3958**（= 3958 基线 + 0 新增，本刀只改 2 个既有 it 内容，未新增 it） | `pnpm test` 输出 `Tests 3958 passed (3958)` |
| `.vue` | **182** | `find src -iname "*.vue" \| wc -l` → 182 |
| color-guard +3 已体现 | 3 个新 `.vue` 均已在 `KNOWLEDGE_VUE_FILES` 清单内（T6-T8 已加，本刀零改动） | `grep -n "NoteEditPane.vue\|NotesMarkdownEditor.vue\|NotesView.vue" src/ai/styles/knowledgeStyles.test.ts` 三行均命中 |
| `aiKb*` 键数 | **387 / 387**（zh/en） | 真实模块导入（临时 vitest 用例，跑后已删除，`git status` 干净）：`Object.keys(zh).filter(k=>k.startsWith('aiKb')).length` → 387，en 同 |
| 全表键数 | **1595 / 1595**（zh/en） | 同上真实模块导入：`Object.keys(zh).length` → 1595，`Object.keys(en).length` → 1595 |

**不采用算式推导**——`aiKb*`/全表键数均为真实 `import zh from './zh_cn'` / `import en
from './en_us'` 后 `Object.keys().length` 的实测结果（R15 同款方法论：文本解析会
少算，只信真实模块导入）。临时测量文件已删除，`git status --short` 只剩 4 个授权
文件被改。

## 三门算式

```
Test Files  331 passed (331)
     Tests  3958 passed (3958)
```
= 3958（T9 后基线） + 0（本刀新增用例，只反转 2 个既有 it 的断言内容）。
`vue-tsc --noEmit` exit=0。`pnpm build` exit=0（改前/改后各跑一次，均 0，见构建
管线门两段日志）。

## 每个被改文件"其余一字未动"自证

- `deferred.ts`：`git diff` 只有两处 hunk——文件头追加 6 行注释、数组删 1 行。
  其余（`KnowledgeTabId` 联合类型、`isDeferred` 函数体）零改动。
- `deferred.test.ts`：单一 hunk，只替换第一个 `it` 块（含新增改前注释），第二个
  `it`（isDeferred 逐一为 true）与机制钉子用例逐字未动。
- `knowledgeRoutes.ts`：三处 hunk——文件头追加注释、import 组加 1 行、`notes` 那
  一行 component 值。其余 8 条路由定义、9 条路由分组结构零改动。
- `knowledgeRoutes.test.ts`：两处 hunk——import 组加 1 行、末尾大断言块替换（含
  改前注释追加）。前两条较小的 it（长度断言、路由名断言）零改动。

## 未走 NEEDS_CONTEXT

全程未遇到 brief/计划书自相矛盾或需碰授权外文件的情况，未申报。

---

## 给协调者：产品导航点击路径 + 可粘贴 URL

1. **正常导航路径**：`/app/#/ai/settings`（AI 设置页）→ 顶栏「详情」链接
   （`SettingsPage.vue` 的 `.set-detail-link`，T9 已接回 `router-link to="/ai/knowledge"`）
   → `/app/#/ai/knowledge` → 左栏第 4 项「笔记」→ `/app/#/ai/knowledge/notes`（本刀
   产出，此前是占位页）。
2. **新建笔记深链**（点工具栏/空态「新建笔记」按钮，`startCreate()` 执行
   `router.push({query:{id:'new'}})`）：
   `http://<host>:5288/app/#/ai/knowledge/notes?id=new`
3. **打开某条笔记深链**（点列表任一行，`edit(n)` 执行 `router.push({query:{id:n.id}})`，
   `id` 需是后端真实笔记 id,不可硬编）：
   `http://<host>:5288/app/#/ai/knowledge/notes?id=<真实笔记id>`
   （验收时先进列表页拿一个真实 id 再拼这个 URL）

## 给协调者：验收时会真的写后端/改设备状态的操作

以下操作调用 `service.notes.*`，会在 `/DATA/Notes` 下真的增删改 `.md` 文件：
- **新建笔记并保存**（`NoteEditPane` 的 save，T7/T8 产出）→ 新建一个 `.md` 文件。
- **编辑已有笔记并保存** → 修改对应 `.md` 文件内容/元数据（含标签编辑）。
- **确认草稿**（列表行「确认」按钮 / 草稿收件箱行内「确认」，`curate()`）→
  草稿状态 → curated,修改文件/元数据。
- **批量确认全部草稿**（收件箱「全部确认」，`confirmAll()`）→ 同上，批量。
- **归档笔记**（`archive()`，含删除弹窗里的「改为归档」按钮）→ 状态改 archived。
- **删除笔记**（删除确认弹窗「删除」按钮，`confirmDelete()` → `service.notes.remove(id)`）→
  **真的删掉磁盘上的 `.md` 文件，不可逆**。
