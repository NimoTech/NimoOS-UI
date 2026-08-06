# SP8-P5c · Task 3 —— 目录选择器整块(`util/folderBrowser.ts` + `FolderBrowser.vue`)

> **协调者变更**:原计划的 T3(3 个纯函数)与 T4(组件)**合并成本刀**。
> 理由:纯函数只 34 蓝本行,单独一刀评审开销大于收益;两者本是「目录选择器」同一件事。
> 合并后 177 蓝本行,仍显著小于 T7(369 行)。**本期由 10 刀变 9 刀,不再有 T4 编号。**

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 7 次,含 **§6.4.1 / §6.4.2 / §6.4.3**、
   **K31**、**§9 新增的第七/第八条纪律**)。尤其 §3 的 **K1 / K27 / K28**、§4.1(**mock 层次**)、
   §5.1(落点与相对路径表)、**§5.2(`_seq` 竞态守卫)**、§9(测试质量 + 守卫缺口 **③**)、§10、§11
2. `.superpowers/sdd/p5c-appendix-D-classes.md` —— `.fb-*` 类清单(**T2a 已把 `.fb-*` 段搬进 `knowledge.scss`**)
3. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— `aiKbFb*` 词干那几个键(**T1 已落地,直接用,不许新增键**)
4. `.superpowers/sdd/p5c-fixtures/README.md` + `folder-list-DATA.json`
5. `.superpowers/sdd/p5c-plan.md` 的 **T3 节**
6. **先例**(照它们抄,别自己发明):`src/ai/knowledge/views/QueueView.test.ts` ·
   `src/ai/knowledge/views/IndexedFilesView.test.ts`(P5b 的两个视图测试,含「`<template>` 块零裸色」断言写法)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。** 冲突以治理/附录为准并在报告里指出。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`b174711`**(工作树干净)
- 三门基线(**T2b 收官后实测**):
  **`Test Files 320 passed (320)` / `Tests 3180 passed (3180)`** · `vue-tsc` 0 · `vite build` 0
- **本刀新增 2 个测试文件 + 1 个 `.vue`** → 文件数应 **320 → 322**;`.vue` 总数 **175 → 176** → `color-guard` **+1 例**
- 🔴 蓝本一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`(`main`@`7a6ee6b7`):
  `src/components/common/folderBrowser.js`(**34 行**)· `src/components/common/FolderBrowser.vue`(**143 行**)
  **禁 `cat`/`Read` 那个仓的工作树文件;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建 4 个文件**:
```
src/ai/knowledge/util/folderBrowser.ts
src/ai/knowledge/util/folderBrowser.test.ts
src/ai/knowledge/components/FolderBrowser.vue
src/ai/knowledge/components/FolderBrowser.test.ts
```
**不改任何既有文件。** 🔴 尤其 `src/ai/styles/knowledge.scss` 与两个 `*Styles.test.ts`
(T2a/T2b 已收工过评审)—— **`.fb-*` 样式已经在 `knowledge.scss` 里了,本刀零 `<style>` 块、零 scss 改动。**

---

## 2. 半一 —— `util/folderBrowser.ts`(蓝本 `folderBrowser.js:3-34`,三个纯函数)

`dirEntries` / `pickerRoots` / `crumbsFor`,**逐字照抄逻辑**:

- **`dirEntries(content)`**:`(content || [])` 兜底(**N7,不许删**)→ 过滤 `e.is_dir && !e.name.startsWith('.')`
  → map `{ name, path }` → `sort((a,b) => a.name.localeCompare(b.name))`。
  🔴 **`FolderEntry = { name: string; path: string; is_dir: boolean }`**(`../NimoOS-Service/src/types.ts:26-30`,
  T0 已实测)与蓝本字段**逐字对上,零改动移植**。**别改成 camelCase `isDir`。**
- **`pickerRoots(candidates)`**:有候选 → `map(c => ({ path: c.path, label: c.label || c.path }))`;
  空/无候选 → **兜底三根**,逐字:
  `{ path: '/DATA', label: 'System (/DATA)' }` · `{ path: '/media', label: '/media' }` · `{ path: '/mnt', label: '/mnt' }`
  ⚠️ **本机 `wiki/candidates` 实测 `[]`(治理 §4.3)→ 真机走的就是兜底这条**,别以为是死代码。
  ⚠️ 那三个 label 是**硬编码英文,不进 i18n**(蓝本如此;同 N22 模具 —— 但**它们是数据不是文案**,照抄)。
- **`crumbsFor(path, rootLabel)`**:首项 `{ label: rootLabel, path: '' }`;`if (!path) return crumbs`;
  然后 `path.split('/').filter(Boolean)` 逐段累加 `acc += '/' + seg`,push `{ label: seg, path: acc }`。

**DoD(半一)**:每个函数的**每个分支**都有用例,**边界两侧都要断言**:
- `dirEntries`:`undefined` / `null` / `[]` / 全是文件(无 `is_dir`)/ 全是隐藏项(`.` 开头)/ 混合 / 排序真的生效(乱序进、字典序出)
- `pickerRoots`:`undefined` / `[]` / 有候选且有 `label` / 有候选但 `label` 缺失(走 `|| c.path`)
- `crumbsFor`:`path=''` / 单段 / 多段 / **前后多余 `/`** / 连续 `//`
- 🔴 **一条端到端用例用 fixture `folder-list-DATA.json` 的真实 18 项**:
  `is_dir` 过滤后应得 **12 个目录**(`.snapshots` / `.system_data` / `.wiki.md` 被 `startsWith('.')` 滤掉)。
  **这条不许手编数据,直接读 fixture。**

---

## 3. 半二 —— `FolderBrowser.vue`(蓝本 143 行)

### 3.1 K27 / K28 —— 取数降层(**本刀最容易翻车的一处**)

| | 蓝本 | 本仓 |
|---|---|---|
| 取数 | `folder.getList(path)` from `@/service/folder.js` | `service.folder.getList(path)`(`import { service } from '@nimotech/nimoos-service'`) |
| 解包 | `(r.data && r.data.data && r.data.data.content) \|\| []` —— **三层** | `((await service.folder.getList(path)).content) \|\| []` —— **单层** |

🔴 **依据**:`folder.ts:7-10` 已 `unwrap(res.data)`(治理 §4.1)。**K1 同族第 N 次。**
🔴 **mock 一律用单层 `{ content: FolderEntry[] }`,不是 fixture 里那个三层信封。**
`folder-list-DATA.json` 是 **HTTP 原文(三层)** → 你要**从它里面取出 `content` 那一层**当 mock,
并在报告里写明这一步(§4.1 的层次表)。**「同一方法在两个测试文件里被 mock 成不同形状」= red flag。**
⚠️ `|| []` 兜底**不许删**(N7)。

### 3.2 §5.2 `_seq` 竞态守卫 —— 照抄,不许抽公共 guard

蓝本 `FolderBrowser.vue:57-72` + `created(){ this._seq = 0 }`:
- `reset()` 里 `this._seq++`(**先递增再清状态**,顺序照抄)
- `go(path)` 里 `const seq = ++this._seq`,之后**三处** `if (seq !== this._seq) return`(`try` 的成功分支 / `catch` / `finally`)
  ⚠️ `finally` 那处是 `if (seq === this._seq) this.loading = false`(**正向判断**,不是 `!==` + return),照抄
- Vue3 里 `_seq` 是**组件本地** `let seq = 0`(模块级会跨实例串,**必须组件内**)

🔴 **回归测试必须走交错路径**(记忆 `newui-async-stale-guard`,已被评审逮到四次):
造两次 `go()` 交错完成(第二次先返回、第一次后返回)→ 断言 `entries` 是**第二次**的结果、`loading` 收敛成 `false`。
🔴 **不许抽公共 guard**(过早抽象)。

### 3.3 模板照抄要点

- `:data-last="String(i === crumbs.length - 1)"` —— **照抄 `String()`**(P5b E-9 裁定:套不套渲染一致,改写 = 无关重构)。
  断言一律 `toBe('true')` / `toBe('false')`,🔴 **禁 `toBeUndefined()`**(Vue3 `patchAttr` 对 `data-*` 只在
  `null`/`undefined` 时删属性,`false` 会渲染成 `"false"`)。
- 三个分支照抄:`v-if="loading"` → `.fb-stub` ·`v-else-if="error"` → `.fb-stub.fb-err` ·
  `v-else-if="current === ''"` → 根层列表(`roots`)· `v-else` → `entries` 列表。
  **两个空态**:`v-if="!roots.length"` 的「未检测到卷」与 `v-if="!entries.length"` 的「(空)」,**都要有用例**。
- KIcon:`drive`(根层)/ `folder`(子层)/ `chev`(两处,`:size="10"`)。
  🔴 **11 个 glyph 已核实全在 `KIcon.vue`,不许往里加、不许退回 `AgentIcon`**(K4)。
- `crumbs` 是 `computed`,调 `crumbsFor(current, t('Volumes'))`。
- `@emit('pick', path)` 在 `go()` 里、**在 `if (!path) { entries = []; return }` 之后**(顺序照抄 —— 点根层 crumb 不 emit)。
- `defineExpose({ reset })` —— 蓝本父组件靠 `$refs.fb.reset()`(T9 的 `SettingsView` 会用)。
- **零 `<style>` 块**(`.fb-*` 已在 `knowledge.scss`,T2a 搬完并过评审)。
- i18n:用 T1 已落地的 `aiKbFb*` 键,🔴 **不许新增任何 i18n 键**(要新增 = 说明 T1 漏了,写 `NEEDS_CONTEXT` 停下)。

### 3.4 缺口 ③ —— 「`<template>` 块零裸色」定向断言

`color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` **只取 `<style>` 块 → 模板 `style="…"` 属性零扫描**。
→ **本 `.vue` 要补一条定向断言**。照 `QueueView.test.ts` / `IndexedFilesView.test.ts` 的既有写法。
🔴 **但别复制那个脆弱正则** —— 它靠「`</template>` 在第 0 列」隐式锚定。
**缺口 ③′(统一改成贪婪匹配 + 覆盖度自检)归 T8**,本刀**照现状写法**即可,并在报告里写一句
「本文件的模板零裸色断言沿用现状写法,③′ 的统一改造归 T8」。
🔴 **读源文件一律 `node:fs`,不许 Vite 的 `?raw`**(CSSEnablerPlugin 会换成空串 → 假通过)。
必配 RED 探针(往模板塞一个裸色 → 报红 → 还原)。

---

## 4. 测试质量(治理 §9,本刀相关的)

- 🔴 **禁空转用例。** 无判别力的断言要做 **RED 验证**并贴两段输出。
- 🔴 **「在文件里找某段文本」的判据必须整行/行首锚定 + 先排除注释**(P5a 六次 + T2b 两次,共**八次**同族事故)。
- 🔴 **做 RED 探针时,注入脚本本身也要行首锚定,并先断言注入真的落盘**(diff / md5 / grep)——
  治理 §9 新条,T2b 实证:注入撞注释会**伪造出「守卫无效」的假结论**。
- 🔴 **报行号的断言必须用「保行版」剥注释**(`blankComments()` 而非 `stripComments()`),
  并用 `grep -n` 交叉验证(治理 §9 第八条,T2b 实证)。
- 需要真 router 的用例照 `KnowledgeLayout.test.ts` 既有写法(本刀大概不需要 router)。
- mock 骨架用 `vi.hoisted()`;异步断言用 `flushPromises()`。
- **不许削弱或删除既有断言。**

---

## 5. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t3-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t3-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t3-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:文件数 **320 → 322**;`color-guard` 因新增 1 个 `.vue` **+1 例**;再加你新写的用例数。**报告给实测终值。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **本期 Service 仓零改动** → 不需要跨仓 `pnpm build`,也不需要 `pnpm install`。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。
- 报告 **`git add -f`**(`.superpowers/sdd/` 被 gitignore 盖着)。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `.sp8/NimoOS-Service/**`。
- 🔴 **本刀额外零改动**:`src/ai/styles/knowledge.scss` · `knowledgeStyles.test.ts` ·
  `parser-styles.scss` · `parserStyles.test.ts` · `src/i18n/*`。需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **本刀不许碰路由**(`knowledgeRoutes.ts` / `deferred.ts` 归 T10)——
  `FolderBrowser` 是组件,不上路由;**它此刻全仓零 import 是预期的**(T9 的 `SettingsView` 才会用它)。
  ⚠️ 因此 `pnpm build` 里它会被 tree-shake 掉、`dist` 里搜不到 `.fb-` **是正常的**,别为此去改别的文件。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-3-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐文件改了什么 · **蓝本 `file:line` → New-UI 的逐处对照**
- 🔴 **K28 的落地证明**:三层 → 单层的改写位置 + **mock 取自 `folder-list-DATA.json` 的哪一层**
- 🔴 **`_seq` 交错路径回归测试**的用例名与断言(证明真走了交错,不是只测顺序路径)
- **RED 探针的两段输出**(至少:模板塞裸色 → 报红;`_seq` 守卫拿掉一处 `return` → 交错用例报红)+ 还原确认 + `git status` 干净
- 三门完整终值(含红项完整用例名与归属)
- **i18n**:用了哪几个 `aiKbFb*` 键,**新增 0 个**
- **§3 的 K1–K31 里本刀命中的每一条显式申报**(至少 **K1 / K27 / K28**;若碰到 K4 也说明)
- **§3.5 的 N1–N22 里本刀命中的**(至少 **N7** 的 `|| []` 兜底)
- **`dist` 里搜不到 `.fb-` 是预期**的说明
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · `_seq` 交错测试一行 · RED 探针几条全过 · 顾虑。
