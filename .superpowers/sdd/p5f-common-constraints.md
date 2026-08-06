# SP8-P5f —— 公共约束(实现者与评审者都必须先读)

> ## 🔴 必读顺序
>
> 1. 🔴 **上级设计** = `git -C ../../NimoOS-UI show 6a8f7825:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`
>    (296 行)—— **P5 全期最高权威**。本期必读:**§3 的 D1 · §4 的 P5f 段 · §5.3(Wiki 无 json tag)· §5.4(主题)·
>    §6.3(Wiki 后端实测)· §6.5 · §7(K1–K8 / N1–N7)· §9 · §10**。
> 2. 🔴 **`p5-master-plan.md`** —— **§2 的 149 类归属实测** · **§2.2 的 24 死类** · §2.3 跨期漏搬 · §5 的 P5f 重算。
> 3. 🔴 **`docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md`**(在 `docs/`,**进 git**)——
>    **§2.4 的 P5f 体量与整段搬陷阱** · §3 对上级设计的 5 处订正 · §0 的 A-1/A-2/A-3 动作项 · 4 张后端票。
> 4. 🔴 **`p5e-coordinator-rulings-T0.md`(R1–R28)** —— **跨期常驻部分**:**R11 / R12 / R18 / R22 / R23 / R24 / R26**。
> 5. 🔴 **`p5e-handoff-to-p5f.md`** —— 先搬者得 / 24 死类 / 守卫终值 / 11 条债务 / **12 条常驻做法**。
> 6. **`p5f-kickoff-prompt.md`** —— 干净上下文入口。
> 7. **`p5f-coordinator-rulings-T0.md`**(本期 T0 评审后产出)。
> 8. **本文件** → 然后才是 `p5a-` → `p5b-` → `p5c-` → `p5d-` → `p5e-common-constraints.md`(每一条继续生效)。
> 9. **`p5e-plan.md` / `p5e-acceptance-checklist.md`** —— 刀法与验收清单的写法模板。
>
> ⚠️ **`p5d-common-constraints.md` 有 18 处已查实的错(E-31~E-48)** ⇒ **不许引它的
> A-10 / K37 / §4.2 / §7 / §1.2(43 个 glyph)原文当依据。**
>
> 🔴 **权威优先级**:
> **上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(跨期常驻部分)>
> `p5f-coordinator-rulings-T0.md` > 三份 `p5f-` 附录 > 本文件 > `p5f-plan.md` > 任务 brief。**
> ⚠️ **例外**:凡**用户明示裁定**的压过上级设计(P5 全期已发生 4 次 = U-1 / U-2 / K52 方案 A / 结果半区挂账)。
>
> **本文件只写与 `p5e-common-constraints.md` 的差异。** 编号续档:
> 偏差 **K53 起** · 照抄不改 **N46 起** · 勘误 **E-63 起** · 债务 **D-10 起** · 本期裁定 **R1 起**(独立序列)。

- 附录(**T0 产出;T1 起任何一刀不许在附录缺位时开工**,只用路径引用,不要把内容复制进 brief):
  - i18n 键表 → `.superpowers/sdd/p5f-appendix-A-i18n.md`
  - 色值映射表 → `.superpowers/sdd/p5f-appendix-B-tokens.md`
  - CSS 类白名单 → `.superpowers/sdd/p5f-appendix-D-classes.md`
  - 后端样本 → `.superpowers/sdd/p5f-fixtures/`(先读 `README.md`)

---

## 0. 🔴 本期开工裁定(协调者,2026-08-06)

### 0.1 D1 政策在 P5f 的**完整适用范围**(用户 2026-07-31 拍板,P5e 的 R2 同款先例)

**Wiki 后端本期不动。** 实测状态(上级设计 §6.3):`file_events` **1.42 亿行** / `wiki.db` **38 GB** /
`pkg/db/db.go:29 SetMaxOpenConns(1)` ⇒ `/v1/wiki/{roots,tree,node}` **超时**;
`/v1/wiki/{candidates,raw}` **200**(不查库,`candidates` 实测 `[]`)。**重启无效(已验证)。**

🔴 **落地口径(与 P5e 的 R2 逐字同族)**:

1. **界面做完整 · 逻辑照抄 · 不为打不通的接口编造 fixture** —— 非空样本一律
   **`.CONSTRUCTED`(按接口/Go 结构体构造的最小样本)** 并在 `p5f-fixtures/README.md` 逐个登记(D-6 模具)。
   🔴 **不许标成 `.REAL`,也不许说成「真机数据」。**
2. **验收 = 界面走查 + 单测 + 逐行对标蓝本 + 明暗两档**,**Wiki 相关不列真机验收项**。
3. 🔴 **哪些屏本机不可达要逐个写进验收清单并说明「这是 D1 的连带后果,不是缺陷」** ——
   否则机主必然当 bug 报(承 P5e 裁定 R2 第 2 条的教训)。
4. 🔴 **T0 必须复测 Wiki API 现状,不许采信本节**。
   **若 Wiki 已被修好(`/roots` 与 `/tree` 都 200)⇒ 停下问用户是否改验收政策**,不许自己决定。

**受 D1 影响的分屏(协调者先点名,T0 实测补全)**:

| 屏 / 元素 | 依赖 | 本机预期 |
|---|---|---|
| `RootsView` 的列表 | `/v1/wiki/roots` | **超时** ⇒ 恒走空态 `kr-empty` |
| `RootsView` 新增弹窗的 `FolderBrowser` 候选 | `/v1/wiki/candidates` | **200 但 `[]`** ⇒ 选择器无候选根 |
| `WikiView` 整棵左树 + 右文章 | `/v1/wiki/tree` `/node` | **超时** ⇒ 恒走 `treeError` 分支 |
| `WikiView` 的 `.wiki.md` 原文 | `/v1/wiki/raw` | 200(但没有 `sel` 就到不了) |
| `AllowlistView` **两个分区** | `/v1/ai/parser/allowlist/*` | 🟢 **Parser 可用 ⇒ 这一整页真机可验**(见 §0.2) |

### 0.2 🔴 `AllowlistView` **不受 D1 影响,是本期唯一可真机验收的整页**

它打的是 **Parser** 的 `allowlist/extensions` 与 `allowlist/folders`(上级设计 §6.1 实测可用),
与 Wiki 零关系。⇒ **验收清单必须把 Allowlist 与 Wiki/Roots 分开写**,
**Allowlist 列真机验收项、逐个可点**;Wiki/Roots 只做界面走查。
🔴 **且它是写操作**(勾扩展名 / 加删文件夹规则会**真的改设备上的 Parser 配置**)⇒
**按 §13-3 标红并写「验完怎么恢复」**(实测于 2026-07-31 的 `folders` 是 `{"rules":[]}`,
清单要给「验完把新增规则删掉、把改过的扩展名勾回去」的具体步骤 + 现测命令)。

### 0.3 🔴 P5e 交下来的债务:**本期一次清掉 4 条,其余继续挂账**

| # | 内容 | 裁定 | 刀 |
|---|---|---|---|
| **I-1** | `runSearch` 的 `topK` / `rerank` 两入参**零测试守卫**(产品码经蓝本 `:301-302` 逐字核为**正确**;结果半区真机不可达 ⇒ **守卫是唯一防线**) | 🔴 **本期补掉,别再挂账**。纯加断言,**不许改 `SearchView.vue` 产品码** | **T1b** |
| **M-1** | `loadChunkContext` 的 `window: 2` 零守卫 | **补**(同刀同域,成本 trivial) | **T1b** |
| **M-2** | `highlight` 的 `>= 1` 长度门零守卫(单字查询会全不高亮) | **补** | **T1b** |
| **M-4** | `messageSyntax.test.ts:1013` 那条旧理由已被 **R13** 作废,未加订正标记 | **顺手补订正注释**(只改注释) | **T1b** |
| **M-3** | R23 祖先链守卫的扫描集不含 `#app`(现状安全 —— `#app` 全仓零样式) | 🟢 **不做,并入票 B**。理由:改的是全仓守卫范围,且**扩范围可能扫出别期存量**(P5d-T5 教训);现状零风险 | — |
| **M-6** | `KFileViewer` 模板用 `props.file` 而非解构 | 🟢 **不做**(风格瑕疵、零行为影响,且 `KFileViewer.vue` 在本期零改动清单上) | — |
| **`openNoteInNewTab`** | 蓝本 `openInApp.js:112-115`,P5e 仍无调用点 | 🔴 **T0 必须判定本期三页有没有调用点**。协调者初测:`WikiView` 用的是 **`openFileInNewTab` / `openDirInNewTab`**(两个**本仓已有**,`src/ai/services/openInApp.ts:50,59`),**没有** `openNoteInNewTab` ⇒ **大概率继续不补**(补了就是死代码)。T0 给终值 | T0 判定 |
| **D-4** | 相当一部分键只有存在性断言 | 🟢 **继续挂账,别在 P5f 内单方面反转** —— P5a–P5e 既定全仓模式。**本期新键照同一模式**,T1 报告写清条数 | — |
| **票 3c / 3e / D-6 / A-8 / clipboard 票** | 见 `p5d-handoff-to-p5e-p5f.md` | **继续挂账** | — |
| **4 张后端票 A/B/C/D** | 见 cross-area-impacts §1 / §5 | **不在 P5f 范围**。🔴 **A-1/A-2/A-3 的执行时机 = `sp8-ai` 合 master 那一刻** | — |

### 0.4 🔴 蓝本源码与上级设计的读法(**混了会读到空文件**,承 P5e §0.55)

| 读什么 | 怎么读 |
|---|---|
| **蓝本源码**(`src/**`) | `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/…` |
| **上级设计 / roadmap**(`docs/**`) | 🔴 **不在 `7a6ee6b7` 上(实测 0 行)** → `git -C ../../NimoOS-UI show 6a8f7825:docs/…` |

### 0.5 T0 必做的第一个动作(U-2,承 P5c §4.4,不许省)

```bash
git fetch git@github.com:NimoTech/NimoOS-UI.git main     # HTTPS 无凭据必失败(记忆 github-fetch-via-ssh)
```
把「远端 sha + 本期 **4 个蓝本文件 + `knowledge.scss` 的三个段** 逐个比对结果 + 本期锁 `7a6ee6b7`」写进 T0 报告。
🔴 **比出非注释的功能性差异 → 停下问用户,不许自己决定。**
🔴 **永远别在 `NimoOS-UI` 里 `checkout` / `stash` / `commit`** —— 它是 SP7/SP9 并发会话共用的只读检出。

---

## 1. 工作区(与 P5e 的差异)

P5e §1 全部条款继续生效。**订正/新增 5 条**:

1. **起点 commit = `bae5d44`**(P5f 开工提示词落盘提交)。🔴 **自己 `git log --oneline -1` 现测确认。**
2. 🔴🔴 **`git commit --amend` / `git stash` / `reset` / `rebase` 同级禁用**(裁定 **R11 / R26**)。
   根因:**`git status` 干净 ≠ HEAD 还是你刚提交的那个** —— `.superpowers/` 被 `.gitignore:6` 盖着,
   **并发会话的提交在你眼里毫无痕迹**。**要补内容就新加一个提交。**
   ⚠️ **stash 栈里已有两条与本期无关的 master 线条目**(2026-07-18 / 2026-07-06)⇒
   任何 `pop`/`apply` 都会**注入别人几个月前的 WIP**。**那两条一个都不许碰,也不许「顺手清理」。**
3. 🔴 **台账一律 `git add -f`,每刀提交时就做,别攒到收官**(P5d 收官时发现 30 个文件从未被跟踪 =
   SP7 整目录丢失的同款向量)。⚠️ 记忆里「08-05 起 `.superpowers` 不再 gitignore」说的是 **master 那条线**,
   **`sp8-ai` 没有那个提交** ⇒ 本期不适用。
4. **`.sp8/NimoOS-Service` 本期零改动。** 🔴 **T0 必须逐项实证零新依赖**(§14)。
5. **验收 dev server 在 `:5288`(服务 `.sp8` 工作树),不另起端口。**
   🔴 **`:5277`(SP7)· `:5273`(master/SP9)· `:5299`(NimoOS-Web)一律不许碰。**
   本期**无新依赖 ⇒ 不需要 kill 重起**;若某刀改了共享包或依赖,才由协调者重起。
   🔴 **`vite.config.ts` 的 `optimizeDeps.exclude` 别删。**

### 1.1 🔴 全期零改动文件清单(P5e §1.1 全部继续生效,本期**解禁 3 个 + 新增 4 个**)

| 文件 | 口径 |
|---|---|
| 🟢 `src/i18n/zh_cn.ts` · `en_us.ts` | 本期加键(§7)。**不删任何既有键** |
| 🟢 `src/ai/styles/knowledge.scss` · `knowledgeStyles.test.ts` | **本期必须改**(§6 / §9) |
| 🟢 `src/ai/knowledge/deferred.ts` + `deferred.test.ts` · `knowledgeRoutes.ts` + `knowledgeRoutes.test.ts` | **收官刀(T8)必须改** |
| 🟢 **`src/ai/knowledge/views/SearchView.test.ts`** | **T1b 极窄解禁** —— 只许**新增** I-1 的断言块。🔴 **既有每一行零改动**,报告给 `git diff` 逐行自证 |
| 🟢 **`src/ai/knowledge/util/searchAggregate.test.ts`** | **T1b 极窄解禁** —— 只许**新增** M-2 的断言块。既有零改动 |
| 🟢 **`src/ai/knowledge/components/FileDetailDrawer.test.ts`** | **T1b 极窄解禁** —— 只许**新增** M-1 的断言块。既有零改动 |
| 🟢 **`src/i18n/messageSyntax.test.ts`** | T1 加本批键守卫 + **T1b 只补 M-4 的一条订正注释** |
| 🔴 `src/styles/color-guard.test.ts` | **全期零改动** —— 票 B 已独立成期。**一行不许动** |
| 🔴 `src/ai/knowledge/views/SearchView.vue` · `components/FileDetailDrawer.vue` · `KFileViewer.vue` · `util/searchAggregate.ts` | 🔴 **产品码全期零改动**(P5e 产出,已过终审)—— I-1/M-1/M-2 是**纯覆盖缺口**,**只加测试** |
| 🔴 `views/KnowledgeLayout.vue` · `DashboardView.vue` · `QueueView.vue` · `IndexedFilesView.vue` · `SettingsView.vue` · `NotesView.vue` | **全期零改动** |
| 🔴 `components/KIcon.vue` | **全期零改动** —— 本期用到的 glyph **T0 必须逐个核实全在**(§1.2),**不许加** |
| 🔴 `components/FolderBrowser.vue` · `util/folderBrowser.ts` | **全期零改动**(P5c 产出)。🔴 已核 `FolderBrowser.vue:97` **`defineExpose({ reset })`** ⇒ `RootsView` 的 `$refs.fb.reset()` 有落点,**不需要改它** |
| 🔴 `components/NoteEditPane.vue` · `NotesMarkdownEditor.vue` · `stores/knowledgeStore.ts` · `parserStore.ts` | **全期零改动** —— 本期只**调用** store,**不改** |
| 🔴 `src/ai/markdown/**` · `src/ai/services/openInApp.ts` | **全期零改动** —— 本期只**消费**(`renderMarkdown` / `openFileInNewTab` / `openDirInNewTab`)。若发现必须改 → **停下写 `NEEDS_CONTEXT`** |
| 🔴 `src/files/**` · `src/ai/styles/*.scss`(除 `knowledge.scss`) · `src/styles/theme.css` | **全期零改动** |
| 🔴 `package.json` / `pnpm-lock.yaml` | **全期零改动**(§14) |

需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`**,不要自己动。

### 1.2 🔴 `KIcon` 本期用到的 glyph(T0 必须逐个实测,**不许照抄本表**)

`KIcon.PATHS` 共 **42** 个键(**E-35/E-51 已订正,不是 43**)。协调者按蓝本初扫:

```
AllowlistView : file edit code check x plus settings drive trash info        (10)
RootsView     : plus folder refresh trash x chev settings danger check       (+1 新面孔:refresh?)
WikiView      : chev drive folder file layers refresh info                   (+1 新面孔:layers?)
```
🔴 **`refresh` / `layers` / `drive` / `plus` / `code` / `danger` / `info` 是否真在 42 个键里,T0 逐个实测。**
**缺任何一个 → 停下写 `NEEDS_CONTEXT`**(`KIcon.vue` 在零改动清单上,不许自己加 glyph)。

---

## 2. 移植纪律(P5a–P5e §2 全部沿用,本期额外 3 条)

- 🔴 **本期是「照抄老样子」口径**:版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置逐字照蓝本 1:1。
  三页在 `.knowledge-app` 下、两档都要对得上。
- 🔴 **界面照 Vue2、逻辑照正确**(用户 2026-07-27 拍板):蓝本的 bug / 竞态 / 吞错**不照抄**,
  改正确逻辑并**三件套齐全**(代码注释指明蓝本 `file:line` 的问题 + 报告显式申报 + 台账登记)。
  **未申报的偏离本身就是缺陷。** 禁与需求无关的重构。
- 🔴 **本期的 Vue2→Vue3 强制改写(不算偏离,但必须在报告里点明)**:
  `data()` → `ref` · `computed` 对象 → `computed()` · `created` → `onMounted`(或 setup 顶层)·
  `methods` → 普通函数 · `this.$refs.fb` → `ref<InstanceType<...>>` · `this.$route/$router` → `useRoute/useRouter` ·
  `this.$t` → `useI18n().t` · `this.$nextTick` → `nextTick` ·
  🔴 **`<template v-for>` 的 `:key` 必须挪到 `<template>` 自身**(见 **K56**)。

---

## 3. 本期已授权的偏离(K1–K52 沿用 + **K53–K59**)

| # | 偏离 | 依据与落地判据 |
|---|---|---|
| **K53** | 🔴 **`RootsView.vue` 的 `<style lang="scss" scoped>`(蓝本 `:223-289`,66 行 / 9 个 `kr-*` 类)整块搬进 `knowledge.scss`,`.vue` 侧零 `<style>` 块** | 承 **K44 纪律**(全期 `.vue` 侧零 `<style>`)+ **P5e K46/K47 的 `KFileViewer` 同款先例**(它的 `<style scoped>` 51 行也是搬进 `knowledge.scss` 的)。🔴 **落地判据**:① 这 9 个类**嵌进 `.knowledge-app`**(K9);② `RootsView.vue` 里 `grep -c '<style'` = **0**;③ 附录 D 登记这 9 个类(**它们不在 `p5-master-plan.md` §2 的 67 类里 —— 那份是只按 `knowledge.scss` 差集算的,见勘误 E-63**);④ 🔴 **`scoped` 语义的丢失必须逐类判定无害**(`kr-*` 前缀在全仓唯一 ⇒ 无碰撞;T0 用**完整 token 精确匹配**逐个证明,**不许用 `\b`**,见 E-25) |
| **K54** | 🔴 **`kr-*` 里的 3 处 `var(--x, <字面量>)` 兜底值必须去掉字面量、改成纯 token** | 蓝本 `:243` `var(--bg-tertiary, rgba(127,127,127,0.12))` · `:254` `var(--border, rgba(127,127,127,0.25))`(**两处**,`.kr-input` 与同族)。🔴 **§6 明令 `rgba()` 一律禁止、注释里也不许有** ⇒ 兜底字面量**不能照抄**。🔴 **落地判据**:① **T0 必须实测 `--bg-tertiary` / `--border` 这两个名字在 `.knowledge-app` 映射层里到底存不存在**(协调者初查:本仓映射层用的是 `--bg-sunken` / `--line` 一族)——**存在 → 直接用;不存在 → 按附录 B 映射到语义最近的既有 token,不许新建、不许保留兜底**;② 附录 B 逐处定死,**实现者不许自选**;③ 报告要证明改后**渲染语义等价**(兜底值只在 token 缺失时生效,而本仓映射层保证不缺 ⇒ 兜底本就是死代码);④ 🔴 **`--danger` / `--text-tertiary` / `--text-secondary` / `--text-primary` 这些无兜底的 `var()` 照抄不改** |
| **K55** | 🔴 **`AllowlistView` 的 `GROUPS_TEMPLATE` 三个 `linear-gradient` 字面量改 token** | 蓝本 `:159-166` 的 `bg` 字段:`#5AC8FA→#007AFF`(Documents)· `#5DD68A→#2EB05B`(Text)· `#C18CFF→#AF52DE`(Code),经 `:style="{background: g.bg}"` 渲染。**这是 P5d K40(`NOTE_TYPES` 的 4 个渐变)的同款模具第二次**。🔴 **为什么必须处理**:`color-guard` **压根不扫 `.ts`**(cross-area §1 票 B 的位置④,变异实测「注释注入 hex 全量全绿」)⇒ **裸奔**。🔴 **落地判据**:① 三个渐变各新建/复用 token,**两档都显式写值** + 声明处注释写明蓝本 `file:line`;② 常量里只留 `var(--…)` 引用;③ 🔴 **必须补 K40 同款的定向断言**(照 `knowledgeStyles.test.ts` 里 P5d-T3 那条 `NOTE_TYPES` 断言的形态):钉「这三个 `bg` 字段只含 `var(--…)`、零 hex/rgb/具名色」——**判据:注入一个 hex → 必须报红**;④ 附录 B 定死取值 |
| **K56** | **`WikiView` 面包屑的 `<template v-for>` 把 `:key` 挪到 `<template>` 自身** | 蓝本 `:50-53` 是 Vue 2 写法(`:key` 分别写在 `<button>` 与 `<span>` 上,后者还拼了 `+ '/sep'`)。**Vue 3 编译器要求 `key` 放在 `<template v-for>` 上** ⇒ **强制改写,不是选择**。🔴 **落地判据**:① `:key="c.path"` 放 `<template>`,内部两个元素**不再各带 key**;② **渲染出的 DOM 序列必须与蓝本逐个一致**(`button, span('/')` 交替,末尾 `span.cur`)—— 一条用例断 DOM 顺序;③ 注释写明这是 Vue 3 编译器要求 |
| **K57** | **三个弹窗一律 reka 原语 + `DialogPortal to=".knowledge-app"`** | 承 **K7 / K29**(`SettingsView.vue:577-583` 是可照抄的先例)。本期三个:`AllowlistView` 的「新增文件夹规则」· `RootsView` 的「新增索引根」与「删除确认」。🔴 **落地判据**:① `DialogRoot` / `DialogPortal to=".knowledge-app" defer` / `DialogOverlay class="k-modal-bg"` / `DialogContent class="k-modal"`;② 蓝本的「点遮罩关闭 / 点弹窗内不关闭」由 `DialogContent` 的 `pointerDownOutside` 等价表达,**不许再写 `@click.stop`**;③ **三个弹窗蓝本都自带 `.k-modal-title`** ⇒ 用 `<DialogTitle as-child>` 套在那个 div 上,**不需要 `VisuallyHidden`**;④ 🔴 **`DialogPortal to` 只认第一个同名宿主**(P5b 交接项 #3)—— 报告要说明为什么这里安全;⑤ 每个弹窗一条「打开→关闭」用例 + 一条「点遮罩关闭」用例 |
| **K58** | 🔴 **`AllowlistView` 的「保存失败」等 5 条错误提示照 K5 走「后端串 → i18n 键」映射,不回显后端 body** | 蓝本 5 处 `this.$t('Save failed') + ': ' + (e.message \|\| e)`(`:199,209,221,237,244`)。承 **K5**(P2b/P3b/P4 既定)。🔴 **本期落法定死**:**保留蓝本的「前缀 i18n 键 + 分隔符」结构**,但 `e.message` 一律经**本仓既有的错误映射**(实现者去读 `QueueView.vue` / `IndexedFilesView.vue` 的既定做法并**照同一份**;T0 报告给出那个函数/模式的坐标)。🔴 **不许各页自造第二套映射** —— 找不到既定做法就 `NEEDS_CONTEXT` |
| **K59** | 🔴 **`RootsView` 的 `addError` 走**弹窗内联**,不走 toast** | 蓝本 `:77-81` 本来就是弹窗内的 `.kr-error` 行内块(**不是 toast**)⇒ **这一半是照抄**。**偏离的是另一半**:蓝本 `:202` 直接回显 `e.response.data.message`(K5 禁止)⇒ 改映射。🔴 **顺带兑现记忆 `newui-dialog-error-not-toast`**:toast 是 `z-index: 60`、弹窗遮罩 1000 还带 blur,**弹窗内的错误一律内联**。🔴 **落地判据**:① 409 分支的文案与「以镜像模式添加」按钮**照抄**(N50);② 非 409 分支的文案走映射;③ 两条用例(409 → 出按钮;500 → 无按钮且有内联文案) |

**除 K1–K59 之外的任何偏离都要先申报再做**;拿不准写 `NEEDS_CONTEXT` 并停下。

## 3.5 明确「照抄、不改」的条目(N1–N45 沿用 + **N46–N58**)

- **N46** 🔴 **Wiki 的 Go 结构体无 json tag**(上级设计 §5.3):`WikiRoot` / `CreateArgs` ⇒
  **响应是 PascalCase**(`ID`/`Path`/`WatchMode`/`ScanIntervalS`/`LastScanAt`/`Enabled`)、
  **POST body 必须用 Go 字段名**(**Go 解码器大小写不敏感但下划线不匹配**,`watch_mode` 会被**静默丢弃**)。
  ⚠️ 🔴 **同一个域里两种命名风格**:`/tree`、`/node`、`/raw` 是 **snake_case**(`ai_label` / `last_modified` / `child_map` / `recent_changes`)。
  **这是本期最容易搞错的一点。** 🔴 **双向归一化在共享包里(D3 已进包)⇒ 本期只消费,不许在页面里再归一化一次。**
  **T0 必须给出「store 出口到底是 camelCase 还是 PascalCase」的实测结论**,mock 一律照那个形状。
- **N47** **`extensions[].enabled` 是 SQLite 整数 0/1**(上级设计 N1,已实测)⇒ `!!e.enabled` 归一化**在 store 里**,
  照抄。**不归一化 chip 永不视觉翻转。** 🔴 页面侧 `:data-on="String(e.enabled)"` 的 `String(...)` 也照抄
  (测试断 `'true'`/`'false'` 字符串)。
- **N48** **`loadWikiNode` / `loadWikiRaw` 只把 404 转 `null`、其余错误上抛**(上级设计 N6)—— **有意分层,照抄。**
- **N49** **Go nil slice 序列化成 `null` ⇒ `(x || [])` 这类兜底是必要防御,不许删**(上级设计 N7)。
  本期命中处:`node.childMap` / `node.recentChanges` / `store.state.extensions` / `folderRules` / `wikiCandidates`。
- **N50** **`RootsView.submit()` 的 409 → 镜像模式重试**(蓝本 `:196-206`)照抄。
  ⚠️ **`storage_mode=mirror` 后端从未实现**(记忆 + `NimoOS-Wiki/OVERVIEW.md`)⇒ **界面照抄,不许删按钮**,
  但**验收清单要写明「镜像模式后端未实现,点了不会生效」**。
- **N51** **`RootsView.toggle()` 的 404 专属文案**(`:168-170` 「Backend version too old — deploy the Wiki service update first.」)照抄
  —— 这是蓝本对**本期正在发生的后端落后**的专门提示,**恰好是本机会命中的分支**。
- **N52** **`AllowlistView.setAllInGroup` 是串行 `for` + `await`,且带 `if (e.enabled !== on)` 跳过**(`:202-211`)。
  🔴 **不许改成 `Promise.all` 并发** —— 它打的是同一个 SQLite 后端,蓝本的串行是有意的。一条「已是目标态的不发请求」用例。
- **N53** **`AllowlistView.addCustom` 的规范化**:`trim().toLowerCase()`,不以 `.` 开头则补 `.`(`:212-223`)。
  空串直接 return。三条用例(`log` → `.log` · `.LOG` → `.log` · 空 → 不发请求)。
- **N54** **`AllowlistView.groups` 的三组模板 + `filter(g => g.exts.length > 0)`**(`:180-188`):
  **按 `localeCompare` 排序**、**空组整组不渲染**、**不在三组匹配表里的扩展名一个都不显示**。
  🔴 **照抄那三张 `match` 扩展名表逐字**(共 12+13+24 项),**不许「补全」** —— 改了会静默隐藏/显示扩展名。
- **N55** **`WikiView.fetchArticle` 的过期守卫是蓝本自带的**(`:270` / `:274` / `:279` 三处 `if (this.sel !== p)`),
  **照抄**。⚠️ 仍要按 P5c §9.1 守**变量作用域**那一半:「两实例交错」用例
  (**判据:把 `sel` 挪到模块级 → 必须报红**)。**K15 同族第 10 次。**
- **N56** **`WikiView` 的 `$route.query.path` watch 不是 `immediate`**(`:210-214`),
  初始选中是在 `loadTree()` 里读 `this.$route.query.path` 一次(`:230-232`)。
  🔴 **这两半都要照抄,别「统一」成 `immediate: true`** —— watch 的条件是 `v && v !== sel && byPath[v]`,
  在 `byPath` 还没建好时 immediate 会**静默什么都不做**,而蓝本的初始化路径**是另一条**。
  🔴 **但必须有「挂载后改地址栏 query → 真的切换」用例**(记忆 `newui-router-query-only-no-remount`;
  **判据:删掉 watch → 该用例必须报红**)。
- **N57** **`WikiView.select()` 用 `router.replace` 且 `.catch(() => {})` 吞错**(`:256-258`)。
  🔴 **这个 `.catch` 是照抄项**(vue-router 的重复导航会 reject,吞掉是既定做法),
  **但 K6「`console.error` 不照抄」不适用于此** —— 蓝本这里本来就没有 log。
- **N58** **`WikiView.childPath` 的 `base === '' ? '' : base`**(`:283-286`)是**恒等表达式**(两支结果相同)。
  🔴 **照抄不「化简」** —— 它是蓝本的原文,化简后再有人改逻辑会失去这处的意图痕迹;
  **报告里点明它是恒等式**(不写就是漏报)。
  ⚠️ 另:`opToType` 的 `modify + 任何未知值 → 'mod'` 兜底(`wikiViewHelpers.js:68`)也照抄。

## 4. 数据契约

P5a §4 三分来源表继续生效。**K1 单层取数继续生效。**
🔴 **所有 mock 一律取 `.superpowers/sdd/p5f-fixtures/` 里的样本,禁手编**(记忆 `newui-fixture-from-imagination-trap`,本档已栽三次)。
🔴 **fixture 用法照 P5c §4.4**:抄进测试 + 注释标出处 + 程序化逐字节等价校验,**不许运行时读 `.superpowers/`**。
🔴 **三级出处标签(`.REAL` / `.REPLAYED` / `.CONSTRUCTED`)必须在测试注释里逐个写明**(裁定 R3 约束 1)。

### 4.1 🔴 mock 的层次(T0 必须实测每一行并给终值)

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `store.loadRoots()` / `store.state.wikiRoots` | **共享包归一化后的出口形状** | 🔴 **T0 实测 `knowledgeStore.ts:654` 与包内 `normalizeRoot` 到底出 camelCase 还是 PascalCase**(蓝本页面读 `r.watchMode` / `r.scanIntervalS` / `r.lastScanAt` ⇒ 出口应是 camelCase)。**搞反了按 Critical 报** |
| `store.loadWikiTree()` | **扁平数组**(`WikiTreeNode[]`) | `knowledgeStore.ts:700`。`buildWikiTree` 吃的就是它 |
| `store.loadWikiNode(path)` | `WikiNode \| null`(**404 → null**) | `:715`(N48) |
| `store.loadWikiRaw(path)` | `string \| null`(**404 → null**) | `:725` |
| `store.state.extensions` / `folderRules` | **归一化后**(`enabled` 已 `!!`) | `:385-424`(N47) |
| `store.createRoot(body)` | 入参 = `createRootBody(...)` 的产物 | 🔴 **`createRootBody` 从共享包 import,不许在本仓重写**(D3 已进包)。**T0 给导出坐标** |

### 4.2 T0 必须落盘的样本(**下表是待验清单,不是结论**)

🔴 **取数一律直连,不许经网关**(记忆 `gateway-no-userid-injection`)。
🔴 **Wiki 打不通的一律 `.CONSTRUCTED`**,按 Go 结构体逐字段构造并在 README 登记来源(D-6 模具)。

```
GET  /v1/wiki/roots        → 预期超时。记录实测(耗时 + 错误形态)
GET  /v1/wiki/candidates   → 预期 200 [];记录实测
GET  /v1/wiki/tree         → 预期超时
GET  /v1/wiki/node?path=…  → 预期超时;.CONSTRUCTED 样本必须含 child_map / recent_changes / ai_label / last_modified
GET  /v1/wiki/raw?path=…   → 预期 200;🔴 尽量抓一份**真的 `.wiki.md` 原文**(它是 renderMarkdown 的输入,真样本很有价值)
GET  /v1/ai/parser/allowlist/extensions  → 🟢 真机可抓(.REAL)。🔴 必须坐实 enabled 的 0/1 整数
GET  /v1/ai/parser/allowlist/folders     → 🟢 真机可抓(.REAL);实测于 07-31 是 {"rules":[]}
```
🔴 **凡「会写后端 / 会改设备状态」的探测,报告必须写「怎么恢复」** ——
**本期 T0 只做读操作**;`POST/DELETE allowlist/*` 与 `createRoot/deleteRoot/rescanRoot` **T0 一律不发**。

### 4.3 Vue2 既有 spec 的归属(T0 必须逐个判定并给终值)

| Vue2 spec | 行 | 被测对象 | 初判 |
|---|---|---|---|
| `__tests__/wikiViewHelpers.spec.js` | 119 | `buildWikiTree` / `trailFor` / `opToType` / `parseTs` / `rootForPath` / `baseName` | ✅ **P5f,行为全部承接**(本仓要更细) |
| `__tests__/wikiRoots.spec.js` | 73 | `RootsView` | ✅ **P5f,行为承接;测法按 `<script setup>` 改** |
| `__tests__/knowledgeStoreRoots.spec.js` | 65 | `knowledgeStore` 的 wiki 域 | 🔴 **T0 判定** —— store 是 **P5a 产出且在零改动清单上**。**若行为已被 P5a 的测试覆盖 → 登记「已承接」并给坐标;若有缺口 → 报告列出,由协调者裁定归属**(不许自行改 store 测试) |
| `__tests__/dashboardWikiViews.spec.js` | 118 | `DashboardView` 的 wiki 卡 | 🔴 **T0 判定「部分归 P5a」的边界** —— 逐条列「已被 P5a 承接 / 属本期 / 无人承接」三态 |
| `__tests__/allowlist*.spec.js`(若有) | — | `AllowlistView` | 🔴 **T0 实扫蓝本 `__tests__/` 全目录**,别漏 |

## 5. 代码范式

### 5.1 落点(**本文件定死**)

```
src/ai/knowledge/
  views/       AllowlistView.vue  RootsView.vue  WikiView.vue     ← rail 第 7/6/3 项(T0 核实序号)
  util/        wikiViewHelpers.ts                                 ← 蓝本 wikiViewHelpers.js
src/ai/styles/
  knowledge.scss                                                  ← 本期全部新增样式(含 K53 的 kr-*)
```

相对路径表:

| 从 | 到 | 写法 |
|---|---|---|
| `views/*.vue` | 图标 | `import KIcon from '../components/KIcon.vue'` |
| `views/RootsView.vue` | 目录选择器 | `'../components/FolderBrowser.vue'` · `{ pickerRoots } from '../util/folderBrowser'` |
| `views/WikiView.vue` | helpers | `import { buildWikiTree, trailFor, opToType, parseTs, rootForPath, renderWikiMarkdown } from '../util/wikiViewHelpers'` |
| `views/*.vue` | store | `import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'` |
| `util/wikiViewHelpers.ts` | markdown | `import { renderMarkdown } from '../../markdown/renderMarkdown'`(**层数自己现测**) |
| `views/WikiView.vue` | 打开文件/目录 | `import { openFileInNewTab, openDirInNewTab } from '../../services/openInApp'` |
| 任何位置 | service | `import { service, createRootBody } from '@nimotech/nimoos-service'`(**T0 核实导出名与坐标**) |
| 任何位置 | 全局 toast | 🔴 **一律 `store.toast(...)`**,见下 |

- `<script setup lang="ts">`;组件内 `useI18n()`;**import 一律相对路径**(本仓无 `@/` 别名先例)。
- 🔴 **`store.actions.toast(...)` → 本仓一律走 `store.toast(...)`**(裁定 **R27** / 勘误 **E-62**):
  `knowledgeStore.ts:312-314` 内部是 `useToast().show(msg, 2400)`,而**全局 `show()` 默认只有 1500ms**
  ⇒ **直调 `useToast()` 会丢掉蓝本自己的 2400ms**。**既有 6 页全走 `store.toast()`,照同一份。**
- 页面级瞬态(`customOpen` / `customExt` / `adding` / `form` / `deleting` / `purgeFiles` / `submitting` /
  `addError` / `mirrorOffer` / `treeLoading` / `treeError` / `treeRoots` / `byPath` / `openPaths` /
  `sel` / `node` / `raw` / `nodeLoading` / `showSource` / `rescanBusy`)**一律组件本地 `ref`,不塞 store**。
- 🔴 **零 `any`**(承 K41):包侧返回 `unknown` 的,在消费侧补窄类型 + 断言式收窄,文件头登记依据。

### 5.2 🔴 过期守卫盘点(K15 同族**第 10 次**)

| 位置 | 蓝本自带? | 本期怎么办 |
|---|---|---|
| `WikiView.fetchArticle()` | ✅ **自带**(`p` + 三处 `if (this.sel !== p)`) | **照抄**(N55)。仍要「两实例交错」用例守作用域 |
| `WikiView.loadTree()` | ❌ **无守卫** | 🟢 **不加** —— 它只在 `created` 跑一次 + `treeError` 重试按钮;重试按钮**无法并发触发两发**(第一发期间 `treeLoading=true`,按钮所在分支不渲染)。🔴 **T6 报告必须逐条论证这个「不加」的理由**,并配一条「`treeLoading` 期间重试按钮不渲染」的用例(否则这个论证没有守卫) |
| `RootsView.submit()` | ✅ **自带 `submitting` 门** | 照抄。一条「submitting 期间重复点击不发第二次」用例 |
| `WikiView.rescan()` / `RootsView` 各写操作 | `rescanBusy` 门 / 无 | 照抄蓝本现状;`rescan` 一条「busy 期间不重复发」用例 |

🔴 两件事都要守(P5c §9.1):① **逻辑**(交错用例);② **变量作用域**(判据:把 `sel` 挪到模块级 → 必须报红)。

## 6. 配色(P5a–P5e §6 全部沿用)

一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / `hsl()` / 具名色**(`white`/`black` 也算);
`transparent` / `currentColor` 是关键字不算。禁 `theme-exception` 逃逸。
🔴 **注释里也不许出现色字面量**(常驻口径 + 裁定 R17)。偏差申报注释一律引「蓝本 `file:line`」与「附录 B 行号」。

🔴 **E-60 的两个方向别搞混**(P5d 曾在反方向误判,代价约 46 万 subagent token):
- **色扫** = 注释里的色字面量是**真阳性** ⇒ **不许剥注释**;
- **类名 / 属性声明 / 调用形状的否定式断言** = 注释里是**假阳性** ⇒ **必须先剥注释**(保行版 `blankComments()`)。
- **判断标准 = 这条约束本身管不管注释。**

### 6.1 🔴 本期 scss 的三个来源(**加起来才是本期的全部**)

| 来源 | 量 | 说明 |
|---|---|---|
| `knowledge.scss` **`:985-1160`**(Allowlist) | 26 个类 | 🔴 **段尾 `:1152-1160` 压着 6 个死类,见 §6.2** |
| `knowledge.scss` **`:1342-1400`**(Allowlist 弹窗) | 10 个类 | `k-field*` / `k-radio-2` / `k-radio-card*` / `k-confirm-body` |
| `knowledge.scss` **`:2453-2561`**(Wiki) | 42 个选择器(含 `.knowledge-app` 段头与 `@media`) | `kw-*` 全族 |
| 🔴 **`RootsView.vue` 的 `<style scoped>` `:223-289`** | **9 个 `kr-*` 类 / 66 行** | **K53 —— 不在 `p5-master-plan.md` §2 的 67 类里(勘误 E-63)** |

🔴 **T0 的附录 D 必须以 `p5-master-plan.md` §2 的 67 类为核对基准**,逐个给「已搬 / 未搬 / 半搬」三态,
**外加 K53 的 9 个 `kr-*` 单列一节**。**不许只给「缺 N 个类」这种总数**(承 E-39)。

🔴 **协调者已实测的边界(T0 必须用「class 属性完整 token 精确匹配」逐个复核,不许用 `\b`)**:

| 类 | 协调者初测 | 本期口径 |
|---|---|---|
| `.k-section-body`(`:985`) | 本仓有 3 处**粗匹配**命中 | 🔴 **T0 判定是真已搬还是假阳性**。`p5-master-plan.md` §2.3 记「P5c 因 Allowlist 移出而故意没搬 = E-3 ⇒ P5f 搬」。**冲突 → 以精确匹配实测为准并申报** |
| `.k-frow`(`:1077`) | 本仓 25 处粗匹配命中 | 🔴 **几乎肯定是 `k-frow-*` 的假阳性**(`\b` 会被 `-` 满足 = E-25 原坑)。T0 精确复核 |
| `.k-set-card` / `.k-set-row` | 本仓有(P5c SettingsView 已搬) | 🔴 **不许重复搬**,`RootsView` 直接用 |
| `.k-sw` / `.k-radio-group` | 本仓有 | 🔴 **不许重复搬** |
| `.k-field*` / `.k-radio-2` / `.k-radio-card*` / `.k-extgroup*` / `.k-ext-chip*` / `.k-custom-add` / `.k-priority-hint` / `kw-*` | 本仓 **0** | 🔴 **本期必搬** |
| `.k-adv-toggle` + 嵌套 `.chev` | ✅ **P5e-T2 已搬** | 🔴 **不许重复搬** —— `AllowlistView:38` 与 `RootsView:58` 直接用。**重复搬会让白名单断言报红,这是有意的** |
| `.k-modal-bg` / `.k-modal` / `.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body` / `.k-modal-foot` / `.k-btn*` / `.k-scroll` / `.k-section*` / `.k-row-action` / `.k-skel` / `.k2-tag` | ✅ 已搬 | 🔴 **不许重复搬** |

### 6.2 ⛔ 24 个「蓝本死代码」类 —— **一个都不许搬**

```
:272-349  .k-hero .k-hero-orb .k-hero-title .k-hero-sub .k-hero-search .k-hero-search-go .k-hero-search-kbd  (7)
:380-411  .k-stat .k-stat-label .k-stat-value .k-stat-suffix .k-stat-cn                                       (5)
:413-455  .k-quick-grid .k-quick-card .k-quick-icon .k-quick-card-title .k-quick-card-en .k-quick-card-desc    (6)
:1152-1160 .k-progress-card .k-progress-row .k-progress-label .k-progress-nums .k-progress-bar .k-progress-fill(6)
```

🔴🔴 **P5f 的陷阱比 P5e 更直接**:**`.k-progress-*` 那 6 个死类在 `:1152-1160`,而本期要搬的
Allowlist 段是 `:985-1160` —— 死类正好压在段尾。** 按「整段搬 `:985-1160`」会**直接带进 6 个零引用死类**。

🔴 **P5e-T2 已配一条断言钉住这 24 个类名在 `knowledge.scss` 里零出现**
(`knowledgeStyles.test.ts:491` 那个 describe)⇒ **搬多了会报红。
报红时先回查本清单,不许改白名单、不许放宽那条断言(§9.10)。**

### 6.3 🔴 本期已知的色字面量(附录 B 定死,实现者不许自选)

| 处 | 字面量 | 归属 |
|---|---|---|
| `AllowlistView.vue:160,162,164` 的 `bg` 字段 | 三个 `linear-gradient(135deg, …)` 共 6 个 hex | **K55**,`.ts` 常量,`color-guard` 不扫 ⇒ 必须定向断言 |
| `RootsView.vue:243,254` 的 `var()` 兜底 | 2 处 `rgba(127,127,127,…)` | **K54**,去掉兜底改纯 token |
| `knowledge.scss` 三个段内的一切 hex/rgba | **T0 逐处实扫并给终值** | 🔴 **不许写「0 处」而不实扫**(承 P5b 的 E-11) |

**模板 `style=` / `:style=` / `color=`** 🔴 **必须显式记数,不许写 0**:
协调者初测 `AllowlistView` **6 处**(`:14` `:style="{background: g.bg}"` = K55 · `:30` `color="white"` 🔴 **具名色!** ·
`:37` `:60` `:65` `:85` `:138` 纯尺寸/排版)· `RootsView` **5 处**(`:9` `:15` `color="var(--text-tertiary)"` ✅ · `:21` `:53` `:58` `:73` `:100` 纯尺寸)·
`WikiView` **8 处**(`:7` `:22` `:59` `--ly` token ✅ · `:69-73` 纯尺寸)。
🔴 **`AllowlistView:30` 的 `color="white"` 是具名色** —— 它压在 `.k-ext-chip-mark` 的实底上;
**T0 必须判定用哪个 token**(记忆:**`--on-accent` 只在 accent 实底上可用**),附录 B 定死。
🔴 **`WikiView:59` 的 `--ly: var(--ly-wiki)` 已核实两档都有值**(`knowledge.scss:198` / `:405`)⇒ **照抄**。

## 7. i18n

- **新键前缀 `aiKb*`**,内部按页分可 grep 的词干:
  **`aiKbAl*`**(AllowlistView)· **`aiKbRt*`**(RootsView)· **`aiKbWk*`**(WikiView)·
  多页共用的通用词走无词干的 `aiKb*`。
- 🔴 **协调者初测 = 83+ 静态 distinct(`wikiViewHelpers` 待扫)。T0 必须复核并给终值。**
  🔴 **`wikiViewHelpers.ts` 里没有 `$t()`**(协调者已读全文 95 行,零 i18n)⇒ **T0 若也测得 0,写明「0」并结案**。
  ⚠️ **`OP_LABEL_KEYS`(`WikiView.vue:156`)的 4 个值(`Added`/`Updated`/`Removed`/`Renamed`)是过 `$t()` 的动态键**
  —— 必须进 i18n(同 P5e 的 `MTIMES` 模具)。
  ⚠️ **`GROUPS_TEMPLATE` 的 `labelKey`(`Documents`/`Text`/`Code`)也是过 `$t(g.labelKey)` 的动态键** —— 必须进。
  ⚠️ **`kw-sec-en` 的两处 `Contents` / `Recent changes` 是硬编码英文装饰文案(蓝本没过 `$t()`)** ⇒
  🔴 **照抄字面量,不进 i18n**(同 P5e 的 `FILE_TYPES` 先例)。**T0 逐个确认还有没有同类。**
- **zh 值一律以 `git show 7a6ee6b7:src/assets/lang/zh_CN.json` 为权威,逐字照抄,不许自己翻译、不许改标点。**
  🔴 **T0 必须给「N/N 命中 / 几条 Vue2 无源需自造」的实测数。**
- 🔴 **en 值的权威源 = `git show 7a6ee6b7:src/assets/lang/en_US.json` 的覆盖值**(承 E-31 / 裁定 R10):
  Vue2 的默认与 fallback locale 都是 `en_us` ⇒ **英文界面渲染的是覆盖值,不是 key**。
  🔴 **verify 脚本的 en 侧不许假设「en = JSON key」**(P5c 的模板有这个 bug = E-44)。
- 🔴 **必须跑程序化逐码点比对脚本**(照 `p5e-task-1-i18n-verify.mjs` 写 `p5f-task-1-i18n-verify.mjs`)。
- 新键**同时**加进 `zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 自动断言键集一致)。
- `messageSyntax.test.ts` 的守卫**只圈本批键**,🔴 **不许全量生效**:
  (a) 全角标点扫描 `/[,;:?!()]/` 的**例外清单由附录 A 实扫给出**,一律 `toBe` 钉死;
  ⚠️ `。`/`「」`/`·`/`—`/`…`/`×` **都不在**那个正则里。
  (b) 带占位符的键两档占位符名集合一致。🔴 **本期占位符**:`{ext}` · `{group}` · `{h}` · `{n}` · `{t}` · `{path}`
  (**T0 给终值**)。🔴 **E-45**:vue-i18n 对未匹配占位符是**静默替换成空串、不是留字面量** ⇒
  **反向断言不许写成「渲染结果含 `{x}` 字面量」**(零判别力),要断真实插值出来的值。
  (c) 补一条「exactly **N** keys」防漂移(N = T0 终值)。
- 🔴 **键数断言双轨(裁定 R12,常驻口径)**:**本批键数用精确 `toBe`;全表键数用下限 `toBeGreaterThanOrEqual`。**
  **绝不许写精确的全表数** —— 那等于亲手重建 D-3 刚拆掉的跨期陷阱。
  **起点全表 = 1648 / 1648** · `aiKb*` = **441 / 441**(P5e 收官实测)—— 🔴 **T1 自己实测,别用算式。**

### 7.1 🔴 撞车扫描:T1 必须**双向**扫,且**假定协调者的表不完整**

按 §9.2/§9.3 做「本批键 × 全表」**双向**扫描(zh 撞车看 en 是否不同 + en 撞车看 zh 是否不同)。
**P5c 连续三刀、P5d 一刀、P5e 一刀,每刀都扫出协调者不知道的撞车对 —— 假定不完整。**
🔴 **协调者已点名的高危同值**(T0/T1 复核并逐条登记):
`Add` · `Cancel` · `Delete` · `Path` · `Action` · `Library` · `Allow` · `Deny` · `Save failed` ·
`Operation failed` · `Retry` · `Documents` · `Text` · `Code` · `Contents` · `Auto` · `enabled` ·
`Select all` · `Select none` · `never` · `Open folder` · `Rescan started` · `Advanced options`。
🔴 **`Delete` / `Cancel` / `Add` / `Path` 特别危险** —— 全仓几乎必然已有同值键;
**一律按 A-1 拒绝复用其它区的同值键**(键名语义属于别的区,将来那个区改文案会静默改掉知识库)。
**只认 `aiKb*` 家族里语义相符的键。** 🔴 **用真实模块导入计键数**(文本解析会少算)。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5f-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5f-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5f-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集**;**输出完整落盘,不许 `| tail`**。
  报告里贴 `Test Files` / `Tests` 两行 + 任何红项的**完整用例名**。
- 🔴 **起点基线 = P5e 收官口径:`Test Files 335` / `Tests 4254` / `vue-tsc` 0 / `vite build` 0**。
  **T0 必须自己重跑一遍确认,不许照抄。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted …`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- scss 任务额外:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
- 🔴 **收官刀额外门(构建管线,承 E-13 / E-25 / E-8)—— 顺序不许颠倒,先抓「改之前搜不到」的证据:**
  ```bash
  rm -rf dist && pnpm build && grep -o "kw-split\|AllowlistView\|RootsView\|WikiView" dist/assets/*.js
  ```
  🔴 **改前必须零输出,改后必须命中。** 判据必须**上下文感知**(裸子串会同时命中注释与真代码 = E-25);
  🔴 **CSS 命中不能证明 JS 可达**(E-8)—— 本期 scss 从 T2 起就进产物,**要核的是 JS 侧**
  (`defineComponent({__name:…})` / `createBaseVNode(…class:…)` 才算真代码)。

### 8.1 🔴 下游算术(收官应是几文件几例)

- `color-guard.test.ts` 按 `**/*.vue` **动态生成用例** ⇒ **每新增一个 `.vue` 全量 +1 例**。
  **起点 `.vue` 总数 185 · `color-guard` 用例数 187**(P5e 收官实测,**T0 自己重跑核实**)。
  ✅ 本期 `color-guard.test.ts` 零改动 ⇒ 用例数只随 `.vue` 数线性 +1。

  | 刀 | 新增 `.vue` | 落地后 `.vue` 总数 | color-guard |
  |---|---|---|---|
  | 起点 | — | **185** | 187 |
  | T4 | `AllowlistView.vue` | 186 | 188 |
  | T5 | `RootsView.vue` | 187 | 189 |
  | T6 | `WikiView.vue`(T6 建、T7 续写,**不重复计**) | **188**(收官) | **190**(收官) |

- 新增测试文件(每个 +1 文件):`wikiViewHelpers.test.ts` · `AllowlistView.test.ts` ·
  `RootsView.test.ts` · `WikiView.test.ts` → **+4 文件 → 339**。
  ⚠️ `knowledgeStyles.test.ts` / `deferred.test.ts` / `knowledgeRoutes.test.ts` / `messageSyntax.test.ts` /
  `parity.test.ts` / `SearchView.test.ts` / `FileDetailDrawer.test.ts` / `searchAggregate.test.ts`
  **都已存在** ⇒ **改不加**。
- 🔴 **实现者以协调者给的实测基线为准,不要用预测数。**
  🔴 **用例数归因表必须与总数自洽**(裁定 **R24** —— 算术叙述错会让下一刀误判基线)。
- 🔴 **每刀都要 `git add -f` 台账**,别攒到收官。

## 9. 测试质量(P5a–P5e §9 全部沿用,本期额外 6 条)

P5e §9 的这些继续逐字生效:属性态断言两侧都比 · 「点某个东西」先确认真渲染成可点元素 ·
探针注入要**行首锚定并先证注入落盘** · 报行号的断言用**保行版** `blankComments()` ·
覆盖度自检的特征串必须唯一 · 否定式断言必须先剥注释且钉「调用形状」 ·
§9.1 过期守卫守两件事 · §9.2/§9.3 en 档正反向断言 + 双向撞车扫 + 真实模块导入计键数 ·
§9.5 探针还原**禁 `git checkout -- <path>`**(一律 `cp` + `md5sum` 逐字节比对)·
§9.10 守卫**只许加固不许放宽** · §9.13 时钟一律假时钟 · §9.14 四条。

**本期新增:**

### §9.15 🔴 `renderWikiMarkdown` 的 `v-html` 是本期唯一 XSS 面(K49 同族第二次)

`WikiView.vue:86` 是 `v-html="html"`,`html` = `renderWikiMarkdown(raw)` = 本仓 `renderMarkdown`(含 DOMPurify)。

- 🔴 **必须有注入用例**:喂 `raw` = 含 `<script>alert(1)</script>` 与 `<img src=x onerror=1>` 的 markdown →
  渲染后 DOM 里 `querySelector('script')` 为 **null**、`onerror` 属性不存在,而正常 markdown 结构仍在。
- 🔴 **判据必须落在「本期代码」上,不许只测 `renderMarkdown`**(那是别期的产出)——
  **正确形态 = 挂载 `WikiView` 后查真实 DOM**;`renderWikiMarkdown` 本身另加一条「就是转发 `renderMarkdown`」的断言。
- 🔴 **禁止 mock 掉 `renderMarkdown` 之后还声称验过 XSS**(那是安慰剂测试)。

### §9.16 🔴 `buildWikiTree` 的判别力陷阱:**扁平表的顺序与父子推断必须用「会分辨错实现」的样本**

`buildWikiTree` 先 `sort` 再按「最长严格前缀」找父。**同一份「已排好序、层级整齐」的样本上,
好几种错实现都会给出相同结果**(例如「用 `lastIndexOf('/')` 直接切一级父」在整齐树上与正确实现同解)。

🔴 **必须有的三个样本**:① **父节点缺位**(`/a` 不在表里但 `/a/b/c` 在 ⇒ `/a/b/c` 成为根且 `name` 是**全路径**)·
② **跨级**(`/a` 与 `/a/b/c` 在、`/a/b` 不在 ⇒ 父是 `/a`,**不是** `/a/b`)· ③ **重复行**(`byPath` 去重的防御分支)。
🔴 **判据:把 `findParent` 换成「只切一级」的实现 → 样本 ② 必须报红。**
🔴 **另加乱序输入一条**(证明 `sort` 真在起作用;判据:删掉 `sort` → 必须报红)。

### §9.17 🔴 「本机数据下真渲染成可点元素」的本期高危清单(T0 实测后补全)

🔴 **本期的特殊性:Wiki 打不通 ⇒ 大半个 `WikiView` 与整个 `RootsView` 列表在本机不可达。**
**验收清单必须把「不可达」与「缺陷」分开写**,并说明原因是 D1。

| 屏 / 元素 | 条件 | 本机预期 |
|---|---|---|
| `RootsView` 的根列表 | `roots.length` | 🔴 **恒 0 ⇒ 只能看到 `kr-empty` 空态**;列表行、开关、重扫、删除**全不可达** |
| `RootsView` 新增弹窗 | 点「添加根目录」 | 🟢 **可达**(弹窗是纯前端);但 `FolderBrowser` **候选恒空** |
| `RootsView` 的 `kr-error` / 镜像按钮 | 409 响应 | 🔴 **不可达**(请求超时不是 409)。**不列真机验收项** |
| `WikiView` 左树 | `treeRoots.length` | 🔴 **恒走 `treeError` 分支**(超时)⇒ 只能验「加载失败 + 重试按钮」 |
| `WikiView` 的空树 onboarding(`kw-pending`) | `!treeError && !treeRoots.length` | 🔴 **本机到不了**(因为是 error 不是 empty)。**不列真机验收项** |
| `WikiView` 文章 / 目录 / 最近变更 / 查看源码 | `sel` 非空 | 🔴 **全不可达** |
| **`AllowlistView` 两个分区** | Parser 可用 | 🟢 **全部可达且是写操作** ⇒ 逐个列真机验收项 + **标红 + 写恢复步骤**(§0.2) |
| `AllowlistView` 的「无规则」空态 | `folderRules.length === 0` | 🟢 **本机初始就是这个态**(07-31 实测 `{"rules":[]}`)⇒ 先验空态,再加一条规则验列表 |
| `AllowlistView` 的自定义扩展名区 | `v-if="customOpen"` | 🟢 要先点「高级:自定义扩展名」 |

### §9.18 🔴 `.CONSTRUCTED` 样本不许伪装成真机取值(承 R3 约束 2 / R9 的教训)

**本期绝大多数 Wiki 样本都是 `.CONSTRUCTED`。** 三条硬性要求:
1. **每份样本的注释里写明「按 Go 结构体 `<坐标>` 构造 · 本机接口超时不可抓 · D1 政策」**;
2. 🔴 **不许拿 `.CONSTRUCTED` 当「真机形状」的依据**去推翻 N46 的命名结论 ——
   **命名依据只能来自 Go 源码或共享包的归一化代码**;
3. 🔴 **「取数没取全 = 和凭想象编造一样危险,而且更难发现」**(R9:`chunk_no` 不连续那次是 Qdrant 未翻页的假象)
   ⇒ 凡实测数为 `[]` / 空 / 超时,报告要写**怎么确认这是真的空而不是取法错**(命令 + 原始输出)。

### §9.19 🔴 「自动上膛」守卫要先想清楚跨刀冲突(承裁定 R25)

P5e 的 T5 守卫与 T6 范围**直接撞了**,靠裁定 R25 才解开。
🔴 **本期排刀时已检查**:T3 的上膛守卫钉的是「若 `views/WikiView.vue` 存在,则它必须 import `../util/wikiViewHelpers`」——
而 **T6 建 WikiView 时就会写 script imports** ⇒ **无冲突**。
🔴 **任何一刀想新加「自动上膛」守卫,必须在报告里论证它与后续每一刀的范围不冲突**;
拿不准写 `NEEDS_CONTEXT`。
🔴 **守卫可能是空壳,「能报红」≠「不是空壳」** —— 新守卫要自带**防空转断言**(如 `blocks.length > 0`);
**测试里读文件一律 `node:fs`**(铁律:Vite 的 `?raw` 在 vitest 下**恒空**)。

### §9.20 🔴 `DEFERRED_TABS` 清空后**机制必须仍有牙**(K8 / 承 P4 I2)

- 🔴 **`deferred.test.ts` 的「机制钉子」用例一字不许动** —— P5e-T8 与两道评审都做过变异验证
  (`isDeferred` 硬编码 `return false` → 报红)。
- 🔴 **清空后必须仍有用例证明该机制有能力工作** —— 空数组下 `isDeferred(任意 tab)` 必须为 `false`,
  且**要有一条用「临时非空清单」证明机制仍能判真的用例**(不许只断空数组)。
- 🔴 **三条路由反转各配一条正向断言,改前原文留成注释**(承五代谱系);
  **「路由改回占位 → 必须有断言报红」** —— 三门全绿说明这次反转根本没有守卫(**按 Important 报**)。

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p5f-task-N-report.md`(**`git add -f`**),至少包含:
逐文件改了什么 · 蓝本 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认;
🔴 **碰 gitignore 产物时 md5/diff 才是证据,`git status` 不构成任何证据**)·
三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**§3 的 K1–K59 里本任务命中的每一条显式申报** ·
**§3.5 的 N1–N58 里本任务命中的,要说明确实照抄了** ·
**用了哪几个样本文件、mock 形状取自哪一层**(§4.1 的表)。

返回给协调者的只有 **≤15 行**:状态 · 提交 sha · 一行测试结果 · 顾虑。

🔴 **申报纪律(常驻口径)**:
1. **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
   要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
2. **brief 把某函数列进「不写」清单、却又在 DoD 里要求它的效果 → 停下申报**(裁定 R16)。
3. 🔴 **brief 给的 RED 判据只是提示、不是权威**(裁定 **R18**)——
   **实测不成立时以「能真报红」为准并申报**。**P5e 兑现 4 次**(E-61 / Esc 零判别力 / 单维度守卫 / `store.toast` 的 2400ms)。
   **口径:brief 字面与「本仓既定做法 + 蓝本 1:1」冲突时,以后两者为准。**
4. 🔴 **连「把内联字面量提到模块常量」这种级别的整理也要申报**(裁定 **R22**)——
   判据是「有没有申报」,不是「改动大不大」。
5. 🔴 **分段落盘** —— P5e 有 5 次 API 529 + 1 次连接中断。**每完成一节就存盘一次。**

## 11. 评审者附加要求(P5a–P5e §11 全部沿用,本期额外 7 条)

1. 🔴 **「缺口猎」是常规动作,不是加分项。** P5c 五次 + P5d 四次 + **P5e 十一次**猎中,
   **每一次产品代码都是对的,缺的都是守卫**。**本期已知的高危裸奔点**:
   **K55 的三个渐变**(`.ts` 里,`color-guard` 压根不扫 ⇒ 改坏了三门全绿)·
   **K54 的兜底字面量**(去掉后渲染是否等价,单测抓不到)·
   **§6.2 的 24 死类**(搬多了只有白名单会响,而白名单可被「顺手改数字」绕过)·
   **N46 的两种命名风格**(搞混了字段静默 undefined、界面空白而不报错)·
   **`.CONSTRUCTED` 样本的形状**(编错了整套测试自洽地错)。
2. 🔴 **专查 §3.5 的 N46–N58 有没有被「顺手修正」**,改了按 Critical 报。本期最容易被误修的:
   **N52**(串行 await 看着像该并发)· **N54**(三张扩展名表看着像漏了)· **N56**(watch 无 immediate 看着像 bug)·
   **N58**(恒等表达式看着像冗余)· **N50**(mirror 后端未实现,按钮看着该删)。
3. 🔴 **核 mock 形状的层次(§4.1)** —— 尤其 **N46 的 PascalCase / snake_case / camelCase 三种风格**。
   **搞反了按 Critical 报。**
4. 🔴 **亲手验「24 个死类零出现」那条断言真报红**(自己把其中一个加进 `knowledge.scss`,别信报告)。
5. 🔴 **K53/K54/K55 三条逐条核**:`RootsView.vue` 真的零 `<style>` 块(自己 grep)·
   兜底字面量真的没了且渲染等价有论证 · **三个渐变的定向断言真的能报红**(自己注入一个 hex)。
6. 🔴 **每一刀评审都要核 §9.10** —— 既有守卫**只许加固、不许放宽**;
   被迫改上一刀已过评审的断言时,**必须有程序化的「加固前 N 个 / 加固后 1 个」证明**,自我声明不算。
7. 🔴 **评审须自读源文件、自己 grep、自做 RED 探针,不许采信实现者报告。**
   **最低 sonnet,禁 haiku。**

---

## 12. 勘误(本期新增,**下游一律以本节为准**)

| # | 出处原文 | 权威源实际(协调者 2026-08-06 实测) | 处置 |
|---|---|---|---|
| **E-63** | `p5-master-plan.md` §2/§5 与 cross-area-impacts §2.4 都写「P5f 的 scss = **67 个类 ≈ 344 行**」,来源是「蓝本 `knowledge.scss` 693 处选择器 vs 本仓 293 个的差集」 | 🔴 **该口径只覆盖 `knowledge.scss`,漏了 `RootsView.vue` 自带的 `<style lang="scss" scoped>`(蓝本 `:223-289`,66 行 / 9 个 `kr-*` 类)** —— 那 9 个类**不在** `knowledge.scss` 里,所以差集法**结构性地看不到它们**。⚠️ 同族漏法:P5e 的 `KFileViewer.vue` 也有 51 行 `<style scoped>`,当时是靠 §5/K44 单独点出来的,**不是差集算出来的** | **本期 scss 口径 = 67 类(knowledge.scss)+ 9 类(K53 的 `kr-*`)≈ 410 行**。🔴 **T0 的附录 D 必须两部分都列** |
| **E-64** | 上级设计 §4 的 P5f 段:「`RootsView.vue`(列表 + 新增弹窗含 FolderBrowser + 监视模式 + 扫描间隔 + **mirror 重试** + 删除确认 + 启停)」 | ✅ **描述准确**,但 🔴 **`storage_mode=mirror` 后端从未实现**(`NimoOS-Wiki/OVERVIEW.md` 的 spec-vs-implementation 缺口表)⇒ 「以镜像模式添加」这个按钮**点了不会生效** | **界面照抄(N50)**,🔴 **验收清单写明「后端未实现」** |
| **E-65** | `p5f-kickoff-prompt.md` §1.2 与 §3 都把 `wikiViewHelpers` 的 i18n 记成「待扫」 | 🟢 **协调者已读全文 95 行:零 `$t()` / 零 `i18n.t()`** | **T0 复核后按「0」结案**,不许再挂着 |

### 🔴🔴 12.1 订正块(T0b,2026-08-06)—— **本文件的这些数字已被裁定书取代**

> 🔴 **守「反转不删」**:上面的原文一律保留;本块只登记「哪些数字作废、以谁为准」。
> 🔴 **一律引条目编号(E-xx / R-xx / K-xx),不引 `file:line`**(行号会随后续改动失效)。
>
> 🔴🔴 **权威口径**:`p5f-coordinator-rulings-T0.md` **§五 R10 终值表** > 三份 `p5f-` 附录 >
> **本文件** > `p5f-plan.md`。**下游一律引 R10,不引本文件的旧值。**

| 本文件原写(条目) | 🔴 **终值** | 依据 |
|---|---|---|
| §11-1「起点 commit = `bae5d44`」 | 🔴 **`6d67b7b`** | **E-66** / **R10**(`bae5d44` 在其前两代;kickoff 写的 `4c0eaad` 也不对) |
| **E-63** 处置里的「67 类(knowledge.scss)+ 9 = 76」;§6.1 / §6.2 「以 67 类为核对基准」 | 🔴 **69 类(knowledge.scss)+ 9(`kr-*`)= 78** | **E-67** / **R10**;🔴 **E-67 的「理由」已在附录 D §D.0.2 整条改写**(原理由被 `.k-suggest-chip` 反例证伪),**结论 69 不变** |
| §6.1 段边界 `:985-1160` / `:1342-1400` | 🔴 **`:985-1141`** · **`:1342-1396`** · `:2453-2561` **+ `:1500-1503` 的 `@media`** | **E-69** / **R4** / **R2(K60)**;🔴 **A 段全文档只有 `:985-1141` 一个数字**,且 `:1141` 那行 `/* Settings page */` 注释**不搬** —— 见附录 D **§D.3.0** |
| **N54** 的「照抄那三张 `match` 扩展名表逐字(共 **12+13+24** 项)」 | 🔴 **12 + 13 + 25 = 50** | **E-74** / **R5**;逐项清单见附录 D **§D.3.2**。🔴 **N54 的实质不变:逐字照抄,不许补全也不许删减** |
| §5 目录树注释「rail 第 **7/6/3** 项」 | 🔴 **wiki=3 · roots=7 · allowlist=8**(settings=9) | **E-70** / **R10** |
| **K54** 表头「`kr-*` 里的 **3 处** `var(--x, <字面量>)` 兜底」 | 🔴 **2 处**(`:243` `:254`) | **E-72** / **R10**(K54 正文自己写的「两处」才是对的) |
| **K54-③** 的论证「兜底本是死代码」 | 🔴 **对 `--border` 成立,对 `--bg-tertiary` 不成立** | **E-73** / **R8-2**;`--bg-tertiary` **蓝本与本仓两侧都零声明** ⇒ 兜底一直在生效 ⇒ 🔴 **`--bg-chip` 是可见变化,不是等价替换**。**T2 不许照抄 K54-③ 那句当论证**。取值依据改引附录 B **§B.2.3** 的本仓既定先例(P5c-T2a) |
| §6.3 把 `color="white"` 记成 `AllowlistView.vue:30` **一处** | 🔴 **三处**:模板 `:30` + scss `:1003` + scss `:1045`,**全部 → `--text-on-accent`** | **E-71** / **R10**;见附录 B **§B.3** |

🔴 **另外三条常驻纪律(裁定书新增,本文件原本没有)**:

1. **R11 —— 色扫守卫禁用 `\bwhite\b`**:`white-space` 会满足词边界而假命中
   (Wiki 段 6 行全是这种,`QueueView.vue:474` 真有一个)⇒ **具名色一律按「属性值位置」判据扫。**
2. **R1 —— `NEW_RE` 加 `kr-`/`kw-` 分支**(方案 B):`WHITELIST_348` → **`WHITELIST_425`**,
   `NON_K_HELPER_CLASSES` = **20**;🔴 **必须同步改 `knowledgeStyles.test.ts` 那条硬编码 `OLD_RE`/`NEW_RE`
   的超集自证,否则它变成空壳**。
3. **R2 / K60 —— 搬蓝本 `:1500-1503` 的 `.k-frow` `@media`**(三个授权段之外的第四处),
   并按「反转不删」订正本仓三处「`k-frow` 是死规则」的假陈述注释。

## 13. 验收清单纪律(**下游与协调者都受约束**)

P5b/P5c/P5d/P5e 的四条逐字生效:

1. 🔴 **凡「点某个东西」的项,必须先确认该元素在本机数据下真的渲染成可点元素。**
   **本期高危清单见 §9.17,协调者写清单时逐个照抄。** ⚠️ `v-if="x > 0"` 是高发区
   (P5b 的 B18/B19、P5d、P5e 都在这条上栽过)。
2. **具体计数有保质期。** 清单里写「**实测于 YYYY-MM-DD,数字会漂,以下列命令现测为准**」+ 附取数命令。
3. 🔴 **凡「会写后端 / 会改设备状态」的验收项,必须标红并写「验完怎么恢复」。**
   🔴 **本期比 P5e 重** —— `AllowlistView` **整页都是写操作**(勾扩展名 / 加删文件夹规则会真的改 Parser 配置,
   **并触发后台清理**)。**必须逐项标红 + 给恢复步骤 + 给现测命令。**
4. 🔴 **清单第一项永远是「这一屏怎么从产品的正常导航走到」**(P5c §13.4)。
   **本期三屏都要写**:`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 3 / 6 / 7 项(**T0 核实序号**);
   **`WikiView` 的 `?path=` 深链要显式给出可直接粘贴的 URL**。
5. 🔴 **本期必须主动告知用户的五条**(不说机主必然报 bug):
   - 🔴 **Wiki 与索引根两页在本机大半不可达** —— 后端 38 GB / 1.42 亿行 `file_events` 导致 `/v1/wiki/*` 超时
     (**D1 已拍板本期不动**)。**这不是本期缺陷**,已另开 Wiki 数据库运维票。
   - 🔴 **仪表盘打开时会卡 60 秒骨架** —— `loadRoots()` 打死掉的 `/v1/wiki/roots` + axios `timeout: 60000`
     (**N3 / 用户明示不修**)。**这是预期行为,与 Vue2 一致。**
     ⚠️ 且 `isEmpty`(`wikiRoots.length === 0 && indexed_files === 0`)在空索引设备上会把库判成**空库 onboarding 页**。
   - 🔴 **「以镜像模式添加」按钮后端未实现**(E-64 / N50),点了不会生效。
   - 🔴 **`AllowlistView` 是写操作**,验完要按清单恢复(§13-3)。
   - **占位页从此全部消失** —— rail 9 项全部落到真页面;若看到「即将上线」提示,那是缺陷。

## 14. 依赖纪律

🔴 **本期不装任何新依赖。** 协调者已初查(**T0 必须逐项实证**):

| 需要的能力 | 落点 | 协调者初查 |
|---|---|---|
| `FolderBrowser.vue` + `pickerRoots` | `components/FolderBrowser.vue` · `util/folderBrowser.ts` | ✅ **P5c 已产出**,`FolderBrowser.vue:97` 有 `defineExpose({ reset })` |
| store 的 wiki 域 | `knowledgeStore.ts:654,670,680,687,693,700,715,725,736` | ✅ `loadRoots` / `loadCandidates` / `createRoot` / `deleteRoot` / `rescanRoot` / `loadWikiTree` / `loadWikiNode` / `loadWikiRaw` / **`setRootEnabled`**(⚠️ **kickoff 写的 `patchRootEnabled` 是包内方法名,store 的 action 名是 `setRootEnabled`** —— T0 核实两者关系) |
| store 的 allowlist 域 | `knowledgeStore.ts:385,400,406,417` | ✅ `loadAllowlist` / `toggleExtension` / `addFolderRule` / `deleteFolderRule` |
| `fmtAgo` | `knowledgeStore.ts:190` | ✅ 已导出 |
| `renderMarkdown`(含 DOMPurify) | `src/ai/markdown/renderMarkdown.ts` | ✅ 已在(P1/P2 产出) |
| `openFileInNewTab` / `openDirInNewTab` | `src/ai/services/openInApp.ts:50,59` | ✅ 已在 |
| `createRootBody` | 共享包 | 🔴 **T0 核实导出坐标与签名** |
| reka Dialog 原语 | `reka-ui` | ✅ 已在(`SettingsView.vue:207-211`) |
| `KIcon` 本期 glyph | `components/KIcon.vue` | 🔴 **T0 逐个实测**(§1.2) |

🔴 **任何一刀想装包 / 想改共享包 → 停下写 `NEEDS_CONTEXT`。**
`package.json` / `pnpm-lock.yaml` **全期零改动** ⇒ **不需要 kill 重起 dev server `:5288`**。
