# SP8-P5d —— 公共约束(实现者与评审者都必须先读)

> # 🔴🔴 勘误横幅(2026-08-05,P5d 收官后由协调者加,**读本文件前必看**)
>
> **本文件已被查实有 18 处错(E-31 ~ E-48),下游若照本文件字面执行会出真问题**,其中至少 5 处
> 「照做三门全绿、只有真人看界面/跑守卫/发请求才发现」。**已知最要命的几条**:
>
> | 本文件的说法 | 实际(已坐实) |
> |---|---|
> | §7 en 值 = `$t()` 英文原串(前三期"零覆盖") | 🔴 **`en_US.json` 真有 2 条覆盖**;Vue2 默认+fallback 都是 `en_us` → **英文界面渲染的是覆盖值**(E-31 / 裁定 **R10**) |
> | §7(a) 点名 3 条全角标点例外 | 🔴 **3 条全是假阳性**(实测半角);真例外**只有 1 条**(E-32) |
> | A-10 `NON_K_HELPER_CLASSES` **保持 10 项** | 🔴 **必须 10 → 16**,照本文件做**一提交就红**(E-34 / 裁定 **R8**) |
> | K37 / A-7 `tiptap-markdown@^0.6.1` | 🔴 蓝本实际 `^0.8.10`,装 0.6.1 = 拿蓝本没验证过的版本做 1:1 移植(E-36 / 裁定 **R2**) |
> | §4.2 端点经网关、localhost 免 JWT | 🔴 **必 400**,取数须直连 `:8282/agent` + `X-User-Id`(E-37) |
> | §4.2 / DoD `DELETE` 是 204 空体 | 🔴 实为 **200 + `{"status":"deleted","id":…}`**(E-38) |
> | §4.1 `notes.remove` 直接 `return res` | 🔴 实为 `return res.data`(E-33) |
> | §1.2 `KIcon.PATHS` = 43 | 🔴 实测 **42**(E-35) |
> | K36 先例指 `IndexedFilesView.test.ts:1947` | 🔴 **该先例弱于 T6/T8 确立的做法**(只比字符串值,无元素身份/计数守卫)→ 照它写是**退步**(E-48) |
>
> 🔴 **权威优先级(覆盖下面那条旧的)**:
> **`p5d-coordinator-rulings-T0.md`(R1–R17)> 三份 `p5d-` 附录 + `p5d-fixtures/README` > 本文件 > `p5d-plan.md` > 任务 brief。**
>
> - **勘误全表**:`p5d-task-0-report.md` §2(E-31~E-42)· `p5d-task-1-report.md` §9.4(E-43~E-45)·
>   `p5d-coordinator-rulings-T0.md`「四之三」(E-46/E-47)· `p5d-task-9-review.md`(E-48)
> - **全期台账**(每刀的 finding / 裁定 / 变异证据 / 债务票):`p5d-progress.md`
> - **收官终审**(含 §0.3 四个位置「谁在守 / 谁裸奔」的实测):`p5d-FINAL-review.md`
>
> ⚠️ **P5e/P5f 起,请先读裁定书与台账,再读本文件。** 本文件保留原文不改(反转不删),
> 但**凡与裁定书冲突处一律以裁定书为准**。

**本文件只写与 `p5c-common-constraints.md` 的差异,P5a / P5b / P5c 那三份的每一条都继续生效。**
读法:`p5a-` 全文 → `p5b-` 全文 → `p5c-` 全文 → 本文件;**同一节里本文件说了什么,就以本文件为准。**

- **权威优先级**:P5a/P5b/P5c 治理文件 + 本文件 + 三份 `p5d-` 附录 **>** `p5d-plan.md` **>** 任务 brief
  **>** 上级设计的 P5d 章节。
- 附录(只用路径引用,不要把内容复制进任务 brief):
  - i18n 键表 → `.superpowers/sdd/p5d-appendix-A-i18n.md`(**92** 条新增 + **7** 条复用,distinct **99**)
  - 色值映射表 → `.superpowers/sdd/p5d-appendix-B-tokens.md`
  - CSS 类白名单 → `.superpowers/sdd/p5d-appendix-D-classes.md`(`WHITELIST_226` → 见 §D.0)
  - 后端实测 fixture → `.superpowers/sdd/p5d-fixtures/`(先读那里的 `README.md`)
  🔴 **三份附录由 T0 产出。T1 起的任何一刀都不许在附录缺位时开工。**

---

## 1. 工作区(与 P5c 的差异)

P5c §1 的全部条款继续生效(可写仓只有 `.sp8/NimoOS-New-UI`;`NimoOS-UI` 只读且一律 `git show <sha>:` 读;
禁碰 `NimoOS-New-UI` 与 `.sp7/NimoOS-New-UI`;禁 `git add -A`/rebase/reset/stash/merge/push;
`.superpowers/sdd/` 要 `git add -f`)。**订正/新增 4 条**:

1. 🔴 **起点 commit 是 `b905943`,不是 kickoff 写的 `bbbdca4`**(E-26)。
   `bbbdca4` 之后有 5 个提交(`b9007bc` / `8fd952b` / `e1d9e94` / `9b5dc18` / `b905943`),
   **全在 `.superpowers/sdd/` 下、全是纯 markdown** —— `git diff --name-only bbbdca4..b905943 -- src/` 为空。
   三门基线因此不受影响(协调者实测已验证,见 §8)。
2. 🔴 **蓝本一律 `git show 7a6ee6b7:<path>` 读。** `NimoOS-UI` 磁盘工作树签出的是
   `docs/vue3-migration-sp3`(2026-07-15 分叉),**没有 `NotesView.vue`** —— 读工作树会得到「文件不存在」
   或旧版内容。**永远别在 `NimoOS-UI` 里 checkout / stash。**
3. 🔴 **`.sp8/NimoOS-Service` 本期零改动 —— 已按方法名逐个回源核实(§4.1)。**
   因此**不需要**跨仓 `pnpm build`,**也不需要**为 Service 改动跑消费仓 `pnpm install`。
   ⚠️ **但 T4 装 tiptap 会跑 `pnpm install`**(见 §1.1 的解禁与 §14),那是另一件事。
4. **验收 dev server 已在 `:5288`(PID 401283,已验证服务的是 `.sp8` 工作树),不另起端口**;
   每刀提交后由协调者 kill 重起。🔴 **`.sp8` 的 `vite.config.ts` 已加 `optimizeDeps.exclude` 堵预打包缓存坑,别删。**
   ⚠️ **T4 装完 tiptap 必须 kill 重起 dev server** —— 新依赖要重新预打包(记忆 `nimoos-service-pnpm-drift`)。

### 1.1 🔴 全期零改动文件清单(P5c §1.1 全部继续生效,本期**解禁 3 个 + 新增 2 个**)

| 文件 | 口径 |
|---|---|
| 🟢 **`src/ai/views/SettingsPage.vue`** | **本期显式解禁**(P5c 在零改动清单内)—— 票 1 要把顶栏「详情」反转回 `<router-link>`。**只许改那一处 + 那段注释**,其余一行不动(见 §15.1) |
| 🟢 **`package.json` · `pnpm-lock.yaml`** | **本期显式解禁**(P5c 全期零改动)—— T4 装 tiptap 四包(见 §14)。**只许加那四个依赖**,不许顺手升级任何既有依赖、不许改 scripts |
| 🟢 **`src/ai/services/openInApp.ts`** | **本期可改** —— 补 `openDirInNewTab` / `openAgentSessionInNewTab` 两个函数(见 §16)。**既有 7 个导出一字不动** |
| `src/ai/knowledge/views/KnowledgeLayout.vue` · `DashboardView.vue` · `components/KIcon.vue` | **全期零改动**(承 P5b/P5c)。本期用到的 19 个 glyph 已逐个核实都在(§1.2),**不许加** |
| `src/ai/knowledge/views/QueueView.vue` · `IndexedFilesView.vue` · `SettingsView.vue` | **全期零改动**(P5b/P5c 产出) |
| `src/ai/knowledge/parser/ParserStatus.vue` · `ParserTest.vue` | **全期零改动**(P5c 产出)。⚠️ **它们的 `.test.ts` 例外**:票 2 的注释债要改(§15.2) |
| `src/ai/knowledge/util/indexedFiles.ts` · `indexedFilesView.ts` · `queueView.ts` · `dashboardHelpers.ts` · `folderBrowser.ts` | **全期零改动** |
| `src/ai/knowledge/stores/knowledgeStore.ts` · `parserStore.ts` | 🔴 **全期零改动** —— `setNotesDraftCount` / `refreshNotesDraftCount` 已在 P5a T7 落地(`:509` / `:518`),**本期只调用,不改** |
| `src/ai/styles/agent-styles.scss` · `settings-styles.scss` · `skills-styles.scss` · `sk-shared.scss` · `tokens.scss` · `parser-styles.scss` | **全期零改动**(只读它们取 token 值与先例) |
| `src/styles/theme.css` | **全期零改动** —— 本期不往全局 `:root` 加 token(理由同 P5c §6.1 第四条路) |
| `src/ai/styles/parserStyles.test.ts` | **全期零改动**(P5c 产出) |

需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`**,不要自己动。
**例外**:`src/ai/styles/knowledge.scss` 与 `knowledgeStyles.test.ts` **本期必须改**(§6 / §9.6);
`src/ai/views/SettingsPage.test.ts` **本期必须改**(票 1 的 RED 探针要有常驻断言);
三个 P5c 测试文件各改一条注释(票 2)。

### 1.2 🔴 `KIcon` 本期用到的 glyph 已核实全在(19 个,不许往 `KIcon.vue` 里加)

`KIcon.vue` 的 `PATHS` 共 **43** 个键(P5c 记的 42 已漂,协调者实测 43;**结论不变**)。本期用到:

```
NotesView       : folder chev edit plus sparkle check trash funnel layers x      (10)
NoteEditPane    : chev sparkle check layers code edit file clock folder copy
                  x drive bot paperclip danger user                             (+9 新面孔:code file clock copy drive bot paperclip danger user)
NOTE_TYPES 图标 : edit layers sparkle file        (全部已在上表)
NOTE_SOURCES 图标: user bot sparkle               (全部已在上表)
```

**去重合计 19 个**,协调者逐个 `grep` 命中 ✅ **19/19 全在**。
🔴 **`NOTE_TYPES` / `NOTE_SOURCES` 的 `icon` 字段是动态 `:name` 绑定** —— 这四个 + 三个值是**运行时才确定**的
glyph 名。`KIcon` 对未知 name 的行为要 T0 实测并写进附录 D(若静默不渲染,兜底靠
`noteTypeMeta` / `noteSourceMeta` 的 `|| NOTE_TYPES.note` / `|| NOTE_SOURCES.human`,照抄即可)。

## 2. 移植纪律(P5a §2 + P5b §2 + P5c §2 全部沿用,本期额外 2 条)

- 🔴 **本期是「照抄老样子」口径**(同 P5c Parser 两页):版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置,
  全部逐字照蓝本 1:1。**唯一改的是颜色的写法**(仓内 `CLAUDE.md` 禁色字面量是强制约束)。
  与 P5c 的差别:**本期蓝本本来就跑在 `.knowledge-app` 下、两档都有** → **不存在 K25 那种「暗档本无原样可抄」**,
  暗/浅两档都要对得上蓝本。评审可以按「暗档与蓝本不同」报缺陷。
- 🔴 **`.wiki.md` / Obsidian 相关文案里的产品承诺不许改**(如「60 秒内同步」)——
  那是后端 Wiki/notes watcher 的既有行为,前端只是复述。**不许因为「我不确定是不是 60 秒」而改成模糊说法。**

## 3. 本期已授权的偏离(K1–K36 沿用 + **K37–K44**)

P5a §3 的 **K1–K8 / P1–P4**、P5b §3 的 **K9–K20**、P5c §3 的 **K21–K36** 全部继续生效。本批新增:

| # | 偏离 | 依据 |
|---|---|---|
| **K37** | 🔴 **装 4 个新依赖**:`@tiptap/vue-3@^2.27.2` · `@tiptap/starter-kit@^2.27.2` · `@tiptap/pm@^2.27.2` · `tiptap-markdown@^0.6.1` | 上级设计 **D4** 明令。先例:SP9-P0 为 P5 装 `@novnc/novnc`。🔴 **必须锁 v2 线,不许装 v3**:蓝本用 `@tiptap/vue-2@^2.0.4` + `tiptap-markdown@^0.6.1`,而 `tiptap-markdown@0.9.0` 的 peer 是 `@tiptap/core@^3.0.1`(协调者实测)—— v3 是 breaking 版本,`Editor` 选项与 `storage.markdown` 契约都可能变,**装 v3 = 拿蓝本没验证过的 API 做 1:1 移植**。`@tiptap/pm` 是 `@tiptap/vue-3` 的 peer,蓝本 `package.json` 也显式列了它 → **四个包,不是三个** |
| **K38** | **`@tiptap/vue-2` → `@tiptap/vue-3`;`beforeDestroy` → `onBeforeUnmount`;`value`/`$emit('input')` 的 v-model 契约 → `modelValue`/`update:modelValue` + **保留** `input` 事件** | Vue2 → Vue3 的必需改写。🔴 **`input` 事件必须保留**:父组件 `NoteEditPane.vue:60` 写的是 `<NotesMarkdownEditor v-model="form.body" @input="dirty = true"/>` —— Vue 3 里 `v-model` 走 `modelValue`,但 `@input` 是**另一个**监听器,子组件必须**同时**发 `update:modelValue` 与 `input`,否则「打字后标记为脏」这个用户可见行为丢失。**落地判据:两个 emit 各有一条用例,拿掉任一条报红。** |
| **K39** | 🔴 **4 个笔记类型渐变 + 若干 tint/shadow 落成 `knowledge.scss` 两个 token 块里的新 token**(准确清单见附录 B §B.0) | 值来自蓝本 `notesViewHelpers.js:6-9` 与 `knowledge.scss:2036-2247`。🔴 **与 P5c §6.3 的关键差别:P5c 那 4 个 token「全部有仓内逐字同值出处」,本期只有 1 个有**(`linear-gradient(135deg, #5AC8FA, #007AFF)` = 既有 `--grad-sandbox` / `tokens.scss:236` 的 `--grad-sk-blue`,**逐字同值**),另 3 个渐变(`#30B0C7,#34C759` / `#FF9500,#FFCC00` / `#AF52DE,#FF2D55`)**全仓零同值先例**、直接来自蓝本设计包。**这不是「凭空造」** —— 蓝本就是值的权威源;但**每个新 token 必须在声明处注释里写明蓝本 `file:line`**,且**两档都显式写一份**(不许留空靠继承,`knowledge.scss` 头注释 `:69-75` 已论证过继承不成立)。🔴 **`#FF9500,#FFCC00` 一个 token 两个消费方**(`NOTE_TYPES.insight` 与 `.kn-inbox-icon` 蓝本 `:2066`),**不许声明两份** |
| **K40** | **`NOTE_TYPES[*].color` 的值由色字面量改成 `'var(--grad-note-*)'` 字符串** | `notesViewHelpers.ts` 是 `.ts`,**`color-guard.test.ts` 只扫 `.vue` 的 `<style>` 块与 `.css`/`.scss`,压根不扫 `.ts`** → 这四个渐变**在任何现有守卫下都是裸奔**。仓内 `CLAUDE.md` 的禁令是「组件、`<style>` 块或任何 CSS 里」,而它经 `:style="{ background: … }"` 最终就是 CSS。**落地要求:`notesViewHelpers.test.ts` 里补一条「四个 `color` 值必须形如 `var(--…)`、零 `#`/`rgb(`/具名色」的定向断言 + RED 探针。**(第 6 次「产品代码对、守卫为零」的预防式堵法) |
| **K41** | **`service.notes.backlinks()` 返回 `unknown[]`、`Note.sourceRefs` 是 `unknown[]`、`Note.tags` 是 `unknown[]`、`Note.body` 是 `unknown` → 本仓在**消费侧**补窄类型 + 断言式收窄** | Service 仓全期零改动(§1.1)。🔴 **正解不是改包、也不是 `as any`**:在 `NoteEditPane.vue` 里声明本地 `interface Backlink { id: string; title: string }` / `interface SourceRef { path?: string; session_id?: string; label?: string }`,取数处一次性 `as Backlink[]` / `as SourceRef[]`,`tags` 一次性 `as string[]`,`body` 用 `as string | undefined`。**每处在文件头注释里登记「包侧类型 → 本仓收窄 + 字段依据(蓝本哪一行读了这个字段)」。** ⚠️ **这些 `as` 是类型层动作、零运行时行为**;若某处需要**运行时**校验才安全,那就不是 K41,要单独申报 |
| **K42** | 🔴 **`relativeTime` 的 4 个相对时间键必须新建 `aiKb*` 新键,不许复用既有 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`,也不许复用 `homeRelMinutes`/`homeRelHours`/`aiResDaysAgo`** | **A-1 同族第 2 次,且这次有硬理由不止语义**:① 既有 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo` 的**占位符名是 `{m}`/`{h}`/`{d}`**(`indexedFilesView.ts:53-57`),蓝本 `relativeTime` 用的是 **`{n}`** —— 复用会让占位符对不上、渲染出字面量 `{n}`;② `aiResDaysAgo` 的 en 是 **`{n}d ago`**(**无空格**),蓝本是 `{n} d ago` → en 档渲染不 1:1;③ `homeRel*` 是桌面区命名,跨区复用将来改桌面文案会静默改掉笔记时间戳。**唯一可复用的是 `aiKbJustNow`**(`just now`/`刚刚`,en+zh 双同,且已在 `aiKb*` 家族) |
| **K43** | **`.k-seg`(蓝本 `knowledge.scss:551-571`,21 行)本期搬** | 它在蓝本里嵌在 **Search page 段**(`:457-733`)里,但**不是搜索专用** —— 是 `.knowledge-app` 层级的共享分段控件原语,`NoteEditPane.vue:54-57` 的「富文本 / Markdown」双模式切换就用它。**零色字面量**(全是 token)。🔴 **P5e 的 `SearchView` 也要用它 → 本期搬,P5e 不许重复搬**;附录 D 与「没有搬多」断言要能守住这一点 |
| **K44** | **`NotesMarkdownEditor.vue` 的 `<style lang="scss">` 块(蓝本 `:40-46`)内容并进 `knowledge.scss`,`.vue` 侧零 `<style>` 块 + JS 侧 side-effect import** | 承 P5c §5.1 的既定落点惯例(先例 `KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70` / P5c 的 `parser-styles.scss`)。🔴 **蓝本那 3 条规则(`code` / `pre` / `blockquote`)是顶层 `.nme-content .ProseMirror` 作用域,与 `knowledge.scss:2171-2182` 的 `.kn-editor-body-wrap .nme-content .ProseMirror` 是**两条不同选择器、互补生效**(前者管行内代码/代码块/引用,后者管标题/列表/表格)。**两份都要搬,不许合并成一条** —— 合并会改变级联(`.kn-editor-body-wrap` 前缀让特异性从 (0,2,0) 变 (0,3,0)),而蓝本里前者对**任何** `.nme-content` 生效。**K9(嵌进 `.knowledge-app`)对前者不适用**:蓝本它就是全局的,嵌进去会缩小作用域 = 改行为 → **前者保持顶层裸选择器**,并在附录 D / `knowledgeStyles.test.ts` 的「零顶层裸选择器」口径里**显式登记这个例外** |

**除 K1–K44 之外的任何偏离都要先申报再做**;拿不准写 `NEEDS_CONTEXT` 并停下。

## 3.5 明确「照抄、不改」的条目(N1–N22 沿用 + **N23–N31**)

P5a §3.5 的 N1–N8、P5b §3.5 的 N9–N14、P5c §3.5 的 N15–N22 + §3.6 全部继续生效。本批新增:

- **N23** 🔴 **`noteEditHelpers.js:6-10` 的 `conflictMessage` 返回**硬编码英文串**
  `` `Note changed elsewhere (now revision ${rev}) — reload and retry` `` —— **不进 i18n,照抄。**
  理由(比「N22 技术标识符」更硬):**这个返回值从来不被显示** ——
  唯一调用点 `NoteEditPane.vue:293` 是 `if (conflictMessage(e) && !this.isNew)`,**只当布尔谓词用**。
  给它补 i18n 键 = 凭空多出一个死键。🔴 **但 Vue2 既有单测
  `__tests__/noteEditHelpers.spec.js:11` 断言 `.toContain('4')`(revision 出现在串里)——
  这条行为要承接**,所以串的内容也不许简化成 `return true`。
- **N24** 🔴 **`NotesView.vue:20` 骨架行的 `style="cursor: default"` 与 `:style="{ width: (52 - i * 8) + '%' }"`
  这类**算术内联样式**照抄,不许抽成 class 或 computed。** 那是 4 行宽度递减的骨架,`i` 从 1 到 4。
- **N25** **`NotesView.vue:139` 的长文案带占位符 `{n}`,且是**一整句产品说明**
  (`{n} notes — searchable globally, recallable by the agent and exposed read-only via MCP`)——
  **整句一个键,不许拆成三段拼接。** zh 值 `{n} 条笔记 · 全部可被全局搜索与 agent 召回,并经 MCP 只读暴露给外部 AI`。
- **N26** 🔴 **`NoteEditPane.vue:28` 的三段式拼接照抄**:
  `{{ $t('This is an') }} <b>{{ $t('AI-captured draft') }}</b>{{ $t(', not curated knowledge yet') }}`
  —— 三个独立键(`这是一条` / `AI 自动沉淀的草稿` / `,还不是正式知识`),**中间那段要加粗**。
  **不许合成一个带 HTML 的键**(那会引入 `v-html`)、**也不许改成 i18n 的 slot 语法**(蓝本没有)。
  ⚠️ 第三段 zh 值以**中文逗号 `,`** 开头 —— `messageSyntax.test.ts` 的全角标点扫描会命中,**要进例外清单**。
  同款:`NotesView.vue:164-166` 的删除警告三段式(`磁盘上的 Markdown 文件会一并删除,` / `不可恢复。` / `只是暂时不需要的话,建议改用「归档」。`)。
- **N27** **`NoteEditPane.vue:17` 的四档三元嵌套照抄**
  (`saving ? Saving… : dirty ? Unsaved changes : isNew ? Not saved yet : Saved · rev {n}`)——
  不许改成 computed 映射表(N17 同族)。**四档都要用例。**
- **N28** **`NoteEditPane.vue:207` 的 `wordCount` 正则 `/[#|\-*`>\s]/g` 照抄。**
  它把 `#`、`|`、`-`、`*`、反引号、`>`、空白全剥掉再数长度 —— **不是真正的「字数」**,
  且字符类里 `|` 与 `>` 没转义(在字符类里不需要)。**照抄,不许「修正」成 markdown 感知的计数。**
- **N29** 🔴 **`NoteEditPane.vue:227-230` 的 `tbActive` 里 `this.tbTick >= 0 && …` 是**故意的假依赖**
  ——注释原文就写着「tbTick makes this computed-on-demand check re-run on every transaction」。
  Vue3 里 `tbTick` 是 `ref`,**表达式必须真的读到 `tbTick.value`**,否则工具栏 active 态不刷新。
  🔴 **落地判据:一条「触发 `transaction` 事件后工具栏 `data-on` 跟着变」的用例;
  把 `tbTick.value >= 0 &&` 删掉必须报红。** 这是本期最容易「顺手清理掉」的一行。
- **N30** **`NotesView.vue:210` 的 `watch: { editingId(v) { if (!v) this.reload() } }` 照抄** ——
  只在 `id` **变空**时重载(从编辑页返回列表),`id` 变成另一个值时不重载(靠 `:key="editingId"` 重建子组件)。
  🔴 **`:key="editingId"`(`:3`)是这套机制的另一半,不许删** —— 没有它,切换到另一条笔记时
  `NoteEditPane` 的 `created()` 不会再跑,内容不刷新。**两条都要用例。**
- **N31** **`NotesView.vue:243` 的 `confirmAll` 用 `Promise.all` 并发确认,失败时只弹一条 toast、
  且 `finally` 语义靠「`bulkConfirming = false` 后无条件 `reload()`」实现 —— 照抄。**
  ⚠️ 蓝本**没有** `finally`,是「try/catch 后接两行」。部分成功时:toast 报失败、但 `reload()` 仍会
  把已成功的那些刷出来。**这是 Vue2 现状,不是可复现的错误行为**(用户看到的是真实状态)→ 照抄。

## 4. 数据契约(**协调者 2026-08-04 实测**)

P5a §4 的三分来源表继续生效。**K1 单层取数继续生效。**
🔴 **所有 mock 一律取 `.superpowers/sdd/p5d-fixtures/` 里的真响应体,禁手编**
(记忆 `newui-fixture-from-imagination-trap`)。**「同一方法在两个测试文件里被 mock 成不同形状」= red flag。**
🔴 **fixture 用法照 P5c §4.4:抄进测试 + 注释标出处 + 程序化逐字节等价校验,不许运行时读 `.superpowers/`。**

### 4.1 🔴 mock 的层次(本期最容易翻车的一点)

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `service.notes.list(p?)` | 🔴 **已归一化的 `Note[]`**(camelCase),**不是** `{ notes: [...] }` 信封 | `notes.ts:211-215`:`((res.data.notes) \|\| []).map(normalizeNote)`。**K1 同族第 N 次** |
| `service.notes.get(id)` / `create` / `update` / `curate` / `archive` | **单个 `Note`**(camelCase) | `notes.ts:217-246`,全部 `normalizeNote(res.data)` |
| `service.notes.remove(id)` | `unknown` —— 包**不剥不归一**,直接 `return res`(整个 axios 响应) | `notes.ts:232-235`。⚠️ **蓝本 `remove` 也不读返回值**(`NotesView.vue:261` 只 `await`)→ mock 成什么都行,**但要与其它 `service.notes.*` 的 mock 风格一致、别写成 `Note`** |
| `service.notes.backlinks(id)` | 🔴 **已归一化的数组,空时 `[]`**(不是 `{ backlinks: [...] }`) | `notes.ts:247-250`:`(res.data.backlinks) \|\| []`。**类型是 `unknown[]` → 见 K41** |
| `service.notes.getSettings()` | 🔴 **camelCase `{ notesRoot, autoExtract }`,只有这两个字段** | `notes.ts:252-255` 走 `normalizeSettings`。**HTTP 层是 `notes_root`/`auto_extract`,且还多带 `distill_roots`/`distill_daily_cap`/`background_model` 三个字段 —— `normalizeSettings` 把它们全丢掉了。** mock 写成 snake_case 或多带字段都是错的 |

⚠️ **`Note` 的可选字段**(`notes.ts:21-34`):`type?` / `status?` / `revision?` 是 **optional**,
`tags` / `sourceRefs` 是 **`unknown[]`**(必有,空时 `[]`),`body?` 是 **`unknown`**。
🔴 **`normalizeNote` 对缺字段的归一化在本仓不可测(§9.4 同款)** ——
mock 打在包边界,`normalizeNote` 不进回路。**本仓该守的是「组件层语义」**:
如「`status` 为 `undefined` 时不渲染任何徽标」,用例名只许声明它真正验的那件事。
上游守卫在 `NimoOS-Service/src/notes.test.ts`(Vue2 `__tests__/notesService.spec.js` 的行为已在那里承接,
见 §4.3)。**照 §9.4 的三步写「论证不适用 + 引上游守卫 + 附变异证据」。**

### 4.2 后端真机现状(T0 必须现测并落 fixture;下表是协调者的**待验清单**,不是结论)

T0 要实测并落盘的端点(全部经网关 `:80`,localhost 免 JWT):

```
GET    /v1/ai/agent/notes?limit=200                 → 列表(注意 notes[] 里 status/type 的实际取值分布)
GET    /v1/ai/agent/notes?status=draft&limit=200     → 草稿(收件箱是否有内容 = 高危可点性)
GET    /v1/ai/agent/notes/{id}                       → 单条(body / source_refs / revision)
GET    /v1/ai/agent/notes/{id}/backlinks             → 反链(空时的形状)
GET    /v1/ai/agent/notes/settings                   → notes_root(P5c 实测 /DATA/Notes)
POST   /v1/ai/agent/notes                            → 新建(拿到 id 后**记得删掉**)
PUT    /v1/ai/agent/notes/{id}  (expected_revision 故意写错) → 🔴 **409 的真实 body,`current_revision` 字段名要坐实**
POST   /v1/ai/agent/notes/{id}/curate                → 确认
POST   /v1/ai/agent/notes/{id}/archive               → 归档
DELETE /v1/ai/agent/notes/{id}                       → 删除(204 还是 200?体是什么?)
```

🔴 **409 那条是本期最关键的 fixture** —— `conflictMessage` 只在 `r.status === 409` 且读
`r.data.current_revision` 时才成立。**若真实字段名不是 `current_revision`,`conflictMessage` 会返回
`Note changed elsewhere (now revision undefined) …`(仍 truthy → 冲突弹窗仍会开),
那是 Vue2 现状、按 N 系列照抄,但必须在报告里写清**。
🔴 **凡「会写后端 / 会改设备状态」的探测,T0 报告里必须写「怎么恢复」**(§13 第 3 条)——
本期是**真的会在 `/DATA/Notes` 里创建/删除 `.md` 文件**。

### 4.3 🔴 Vue2 四份既有 spec 的归属(kickoff 说「4 份、行为要承接」,**其中 2 份不在本期**)

| Vue2 spec | 被测对象 | 归属 |
|---|---|---|
| `__tests__/noteEditHelpers.spec.js`(15 行) | `noteEditHelpers.js`(`parseTags` / `conflictMessage`) | ✅ **P5d,行为全部承接**(2 条用例 → 本仓要更细) |
| `__tests__/notesView.spec.js`(25 行) | `notesViewHelpers.js`(`statusBadge` / `applyFilters`) | ✅ **P5d,行为全部承接**(3 条用例)。🔴 **`statusBadge` 全仓零生产消费者**(协调者已 grep:蓝本只有这份 spec 引它,模板里是内联 `kn-badge` 标记)—— **照抄导出 + 照抄这 3 条用例**,不许因为「没人用」就删(K7 同族:反转不删) |
| `__tests__/notesService.spec.js`(69 行) | `src/service/notes.js` 的 6 个 mapper | 🔴 **不在本期** —— 那些 mapper 在**共享包**里(`NimoOS-Service/src/notes.ts:98-207`),按 §9.4「包内转换逻辑一律归上游守」。**T0 要核实 `NimoOS-Service/src/notes.test.ts` 是否已承接这 6 个 mapper 的行为,并把结论(承接了哪几条 / 缺哪几条)写进报告。缺的登记成上游票,不在本仓补。** |
| `__tests__/notesMapper.spec.js`(30 行) | `src/service/searchMapper.js` 的 `buildSemanticSearchBlock` | 🔴 **不在本期,归 P5e** —— 那是搜索聚合器(P5e 的 `searchAggregate` 79 行)。**kickoff 把它列进 P5d 是错的(E-27)。** T0 登记勘误,不做 |

## 5. 代码范式(P5a §5 + P5b §5 + P5c §5 全部沿用,补本期落点)

### 5.1 落点(**本文件定死**)

```
src/ai/knowledge/
  views/       NotesView.vue                ← rail 第 4 项「笔记」
  components/  NoteEditPane.vue  NotesMarkdownEditor.vue
  util/        notesViewHelpers.ts  noteEditHelpers.ts
src/ai/styles/
  knowledge.scss                            ← 本期新增段全部进这里(K44 的顶层例外见 §6.2)
src/ai/services/
  openInApp.ts                              ← 补两个函数(§16)
```

依据:上级设计 §5.1 明写 `views/ … NotesView.vue` 与 `components/ NoteEditPane.vue · NotesMarkdownEditor.vue`。
🔴 **`NoteEditPane` 落 `components/` 而不是 `views/`,尽管它是「一整屏」** —— 它不是路由目标,
是 `NotesView.vue:3` 的子组件(靠 `?id=` query 切换),照上级设计。

相对路径表:

| 从 | 到 | 写法 |
|---|---|---|
| `views/NotesView.vue` | 图标 | `import KIcon from '../components/KIcon.vue'` |
| `views/NotesView.vue` | 子组件 | `import NoteEditPane from '../components/NoteEditPane.vue'` |
| `views/NotesView.vue` | util | `import { NOTE_TYPES, noteTypeMeta, noteSourceMeta, applyFilters, relativeTime } from '../util/notesViewHelpers'` |
| `views/NotesView.vue` | store | `import { useKnowledgeStore } from '../stores/knowledgeStore'` |
| `views/NotesView.vue` | 开文件管理器 | `import { openDirInNewTab } from '../../services/openInApp'` |
| `components/NoteEditPane.vue` | 编辑器 / util | `./NotesMarkdownEditor.vue` · `../util/noteEditHelpers` · `../util/notesViewHelpers` |
| `components/NoteEditPane.vue` | 开文件/会话 | `import { openFileInNewTab, openAgentSessionInNewTab } from '../../services/openInApp'` |
| `util/notesViewHelpers.ts` | 全局 i18n | `import { i18n } from '../../../i18n'` → `i18n.global.t(...)` |
| 任何位置 | service 包 | `import { service } from '@nimotech/nimoos-service'` |
| 任何位置 | 全局 toast | `import { useToast } from '../../../stores/toast'`(层数按实际目录数) |

- `<script setup lang="ts">`;组件内 `useI18n()` from `'vue-i18n'`;**import 一律相对路径**(本仓无 `@/` 别名先例)。
- 🔴 **`notesViewHelpers.ts` 的 `relativeTime` 不在组件 setup 上下文里 → 必须用 `i18n.global.t(...)`**,
  先例 `src/ai/knowledge/util/indexedFilesView.ts:31/51-58` 与 `knowledgeStore.ts:57`。**不许改用 `useI18n()`**(会抛)。
- 页面级瞬态(`fType` / `fStatus` / `inboxOpen` / `deleting` / `bulkConfirming` / `notesRoot` / `loading` /
  `mode` / `dirty` / `conflict` / `tagInput` / `tbTick` / `editor` / `form`)一律组件本地 `ref`,**不塞 store**。
- 🔴 **`store.actions.toast(...)` → 本仓走全局 `useToast()`**(承 P5a K3;`knowledgeStore` 全期零改动,
  它自己的 `toast` action 也在,**但本期照 P5a 既定口径用全局 toast**,与 P5b/P5c 的 5 个页面一致)。
- 🔴 **`store.actions.setNotesDraftCount(n)` / `refreshNotesDraftCount()` 已在 `knowledgeStore.ts:509/518`**,
  本期**只调用**。`NotesView.reload()` 调前者(蓝本 `:226`),`NoteEditPane.curateInPlace()` 调后者(蓝本 `:269`)。

### 5.2 🔴 `NotesView.reload()` 与 `NoteEditPane.created()` 必须加过期守卫(K15 同族**第 8 次**)

**`reload()` 的并发入口有 3 个**:`created()`(蓝本 `:212`)· `watch editingId` 变空(`:209`)·
5 个动作各自的 `this.reload()`(`curate` / `confirmAll` / `archive` / `confirmDelete` / `archiveInsteadOfDelete`→`archive`)。
两个并发在飞时:① 先发后至会用**更旧的**列表覆盖新列表;
② 更要紧的是 **`loading = false` 会被先完成的那个提前清掉**(蓝本 `:227`),
而 `loading && !notes.length` 直接驱动骨架屏(`:19`)→ **骨架提前消失、用户可见**。
按 §2 判据这是「修一个可复现的错误行为」→ **必须加,inline 写,不抽公共 guard。**

🔴 **按 P5c §9.1,守卫要同时守两件事**:
| 要守的 | 怎么守 |
|---|---|
| ① 守卫**逻辑**(先发后至不覆盖) | 交错用例:发 A → 发 B → B 先回 → A 后回,断言 `notes` 是 B 的 |
| ② 守卫**变量的作用域**(必须组件本地,不能模块级) | 「两实例交错」用例:挂两个 `NotesView`,各自异步交错在飞,断言两个实例各拿自己的结果。**验收判据:把守卫变量挪到模块级,这条必须报红** |

`NoteEditPane.created()` 同理(`get` + `backlinks` 两发,`:212`/`:216`),
且它有 `:key="editingId"` 会重建实例 → **「两实例交错」用例在这里尤其真实**。

### 5.3 `NotesMarkdownEditor` 的生命周期(照抄语义,写法按 Vue3)

蓝本 `mounted()` 里 `new Editor({...})` → `this.$emit('ready', this.editor)`;`beforeDestroy` 里 `editor.destroy()`;
`watch value(v)` 里比对 `editor.storage.markdown.getMarkdown()` 后 `setContent(v)` 防回环。
🔴 **`watch` 那个「比对后才 setContent」的防回环不许删** —— 删了会在每次 `onUpdate` 后重设内容、光标跳到开头。
**落地判据:一条「父组件把同一个 markdown 值写回来时,`setContent` 不被调用」的用例。**

## 6. 配色(P5a §6 + P5b §6 + P5c §6 全部沿用)

一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算);
`transparent` 是关键字不算(本期至少 2 处:`knowledge.scss:2060` 的渐变末段、`:2184` 的 `background: transparent`,照抄)。
禁 `theme-exception` 逃逸。注释里也不许出现色字面量(R5)。

### 6.1 本期色字面量普查(协调者实测,附录 B 是权威)

| 来源 | 行数 | 含字面量行 / 处数 | 去哪 |
|---|---|---|---|
| `knowledge.scss` 蓝本 `:2023-2046`(共享徽标/图标底座段) | 24 | **4 / 7** | `knowledge.scss`(⚠️ `.kn-badge` 5 条 P5b-T2 已搬,**只搬 `.kn-type-ic` / `.kn-src` / `.kn-tag` / `:2029`**) |
| `knowledge.scss` 蓝本 `:2047-2056`(path strip) | 10 | 0 / 0 | 同上 |
| `knowledge.scss` 蓝本 `:2057-2085`(draft inbox) | 29 | **6 / 10** | 同上 |
| `knowledge.scss` 蓝本 `:2086-2121`(notes list) | 36 | **3 / 3** | 同上 |
| `knowledge.scss` 蓝本 `:2122-2194`(edit pane,含 `:2171-2182` 的 ProseMirror 段) | 73 | **2 / 3** | 同上 |
| `knowledge.scss` 蓝本 `:2195-2241`(edit aside) | 47 | 0 / 0 | 同上 |
| `knowledge.scss` 蓝本 `:2242-2249`(conflict modal) | 8 | **2 / 2** | 同上 |
| `knowledge.scss` 蓝本 `:2265-2281`(responsive) | 17 | 0 / 0 | 同上 |
| `knowledge.scss` 蓝本 `:551-571`(`.k-seg`,K43) | 21 | 0 / 0 | 同上 |
| `NotesMarkdownEditor.vue:40-46` 的 `<style lang="scss">`(K44) | 7 | **3 / 4** | 同上(**顶层例外**,§6.2) |
| `notesViewHelpers.js:6-9` 的 `NOTE_TYPES[*].color`(**JS,K40**) | 4 | **4 / 8** | `knowledge.scss` 两个 token 块 + `.ts` 里改写成 `var(--grad-note-*)` |
| **模板 `style=` / `:style=` / `color=`** | — | 🔴 **2 / 2** | `NotesView.vue:85` 的 `background: 'rgba(255,149,0,.14)'`(在 `:style` 对象里)· `NoteEditPane.vue:152` 的 `style="… background: rgba(255,149,0,.14) …"` |
| **合计** | **~276** | 🔴 **26 行 / 39 处** | |

🔴 **「模板内联」那一栏必须显式记数,不许写 0**(P5b 的 E-11 就是漏了这一类;P5c 那期真的是 0,
**本期不是** —— 有 2 处,且**其中 1 处藏在 `:style` 的 JS 对象字面量里**,
`color-guard.test.ts` 的 `styleLines()` 只取 `<style>` 块 → **两处都是缺口③ 的靶子**)。
⚠️ **`NotesView.vue:33` 的 `color="var(--text-quaternary)"` 等模板 `color=` 属性已经是 `var()`,零字面量** —— 照抄。

### 6.2 🔴 K44 的顶层裸选择器例外(唯一)

`knowledgeStyles.test.ts` 现有口径要求 `knowledge.scss` 里本档新增段**嵌进 `.knowledge-app`**(K9)。
**K44 的 `.nme-content .ProseMirror { code / pre / blockquote }` 是唯一例外:保持顶层。**
理由见 K44。🔴 **落地要求**:
1. 该段在 `knowledge.scss` 里**紧邻** `.kn-editor-body-wrap .nme-content .ProseMirror` 段,注释写明
   「蓝本 `NotesMarkdownEditor.vue:41-46`,顶层非 scoped,与上一段互补 —— 例外依据治理 §6.2 / K44」。
2. **`knowledgeStyles.test.ts` 要为它加一条**具名**例外**(不是放宽正则):
   断言「顶层裸选择器**恰好只有** `.nme-content .ProseMirror` 这一条」——
   🔴 **集合相等式,不是「排除掉就算了」**;新出现任何第二个顶层裸选择器必须报红。**必配 RED 探针。**
3. `.nme` / `.nme-content` / `.ProseMirror` 是**非 `k*` 类** → 见 §9.6 的登记表处置。

### 6.3 新 token(准确清单见附录 B §B.0,**协调者只定政策**)

- **政策**:一律**先找语义最近的既有 token**;找不到才新建。
  `--warning-soft` / `--warning-soft-border` / `--success-soft` / `--danger-soft` / `--danger-soft-border` /
  `--accent-soft` / `--bg-chip` / `--bg-sunken` / `--bg-elevated` / `--line` / `--line-faint` /
  `--text-primary/secondary/tertiary/quaternary` / `--shadow-xs` **都已在 `knowledge.scss` 两档声明,直接用。**
- 🔴 **透明度差异按 A11 同族处理,不开小灶**:蓝本 `rgba(255,149,0,0.14)` vs 本仓 `--warning-soft`
  `rgba(224,165,59,0.18)`、蓝本 `rgba(52,199,89,0.12)` vs `--success-soft` `rgba(79,184,112,0.18)`、
  蓝本 `rgba(255,59,48,0.12)` vs `--danger-soft` `rgba(240,119,107,0.16)`、
  蓝本 `rgba(0,122,255,0.08)` vs `--accent-soft` `rgba(94,151,242,0.14)` ——
  **P5b-T2 搬 `.kn-badge` 时已经这么映射过(`knowledge.scss:1602-1607`),本期沿用同一映射,保全站一致。**
  → **必须写进验收清单当显式确认项**(与 A11 合并成一条),请用户看实物拍板。
- **新建的每一个 token**:① 两档都显式写值;② 声明处注释写明蓝本 `file:line`;
  ③ 附录 B 有对应行;④ **附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
- ⚠️ **`--on-accent` 的坑**(记忆 `newui-photos-*` / `--on-accent 只在 accent 实底上可用`):
  蓝本 3 处 `color: #fff` 都压在**实底渐变**上(`.kn-type-ic` / `.kn-inbox-icon` / `.kn-act[data-tone=confirm]:hover` 的 `--success` 实底)
  → 用 `--on-accent`(若已声明)或 P5c 建的 `--switch-thumb` 家族之一。**T0 在附录 B 里定死,实现者不许自选。**

## 7. i18n

- **新键前缀 `aiKb*`**(全部,不另开家族),内部按页分可 grep 的词干:
  **`aiKbNt*`**(NotesView)· **`aiKbNe*`**(NoteEditPane)· 两页共用的通用词走无词干的 `aiKb*`。
- **协调者裁定 A-6(2026-08-04):复用只认 `aiKb*` 家族里语义相符的 7 个,其余一律新建。**

  | 复用键 | en / zh | 用在 |
  |---|---|---|
  | `aiKbAll` | `All` / `全部` | 状态 pill「全部」 |
  | `aiKbCancel` | `Cancel` / `取消` | 删除弹窗 |
  | `aiKbClearFilters` | `Clear filters` / `清空筛选` | 筛选空态 |
  | `aiKbOpFailed` | `Operation failed` / `操作失败` | 全部 catch |
  | `aiKbStatus` | `Status` / `状态` | 侧栏卡标题 |
  | `aiKbColType` | `Type` / `类型` | 类型下拉的 `:title` |
  | `aiKbJustNow` | `just now` / `刚刚` | `relativeTime` |

  🔴 **明确**不**复用的**(en+zh 双同、渲染一致,但按 A-1 同族拒绝):
  `audioSpeakerAll` / `appsStoreAll`(相册·应用区)· `filesCtxCopyPath` / `filesCtxDelete` / `filesViewerSave` /
  `filesViewerSaved`(文件区)· `gridRemove`(桌面区)· `audioSummary`(音频区)·
  `homeRelHours` / `homeRelMinutes`(桌面区,且见 K42)· `aiCfgSave` / `aiCfgSaved` / `aiCfgSaving` /
  `aiCfgDelete` / `aiCancel` / `aiConfirm`(AI 配置子区)。
  **理由逐字同 A-1:键名语义属于别的区,将来那个区改文案会静默改掉笔记区。**
  → **新增 99 − 7 = 92 键。「exactly N keys」防漂移断言用 `92`。**
- **zh 值一律以 `git show 7a6ee6b7:src/assets/lang/zh_CN.json` 为权威,逐字照抄,不许自己翻译、不许改标点。**
  🔴 **协调者实测:99 个串在语言包里 100% 命中,本期零「Vue2 无源、需要自造」的键。**
- 🔴 **必须跑程序化逐码点比对脚本**(P5a T8 教训:附录零差异,手抄进 TS 时引入 5 处全角标点错)。
  照 `p5c-task-1-i18n-verify.mjs` 写 `p5d-task-1-i18n-verify.mjs`:DoD 是 **92/92 MATCH** + 复用键 **7/7 未被改动**。
- 新键**同时**加进 `zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 自动断言键集一致)。
- `messageSyntax.test.ts` 的守卫**只圈本批 92 键**,🔴 **不许全量生效**:
  (a) 全角标点扫描 `/[，；：？！（）]/`,**例外清单由附录 A §A.5 实扫给出**,一律写成 `toBe` 钉死确切值的**强断言**;
  ⚠️ **本期例外至少含 N26 的两组三段式**(`,还不是正式知识` 以中文逗号开头、
  `一句话摘要(用于列表与搜索展示)` 带全角括号、`只是暂时不需要的话,建议改用「归档」。`)。
  ⚠️ `。`(U+3002)、`「」`、`·`(U+00B7)、`—`(U+2014)、`…`(U+2026)、`×`(U+00D7)**都不在**那个正则里。
  (b) 带占位符的键(附录 A §A.6)两档占位符名称集合一致。🔴 **本期占位符全是 `{n}`**(见 K42)。
  (c) 补一条「exactly **92** keys」防漂移。
- 报告里列清「复用 7 / 新增 92 / 其中 Vue2 有权威 zh 值 92 / 本期新造 0 / 死键 ?」。

### 7.1 🔴 §9.2/§9.3 的撞车扫描:协调者已扫出 **8 组**,T1 必须复扫并**双向**

协调者按 §9.2/§9.3 做「本批 92 键 × 全表」**双向**扫描(zh 撞车看 en 是否不同 + en 撞车看 zh 是否不同),
结果如下。**一律照抄不许统一;每组都要 en 档正/反向断言。**

| # | 本期新键 | 撞车对象 | 性质 |
|---|---|---|---|
| **N32-1** | `Confirm` / `确认` | `appsSettingsConflictOk`(en `OK`) | zh 撞车、en 不同 |
| **N32-2** | `Note item` / `笔记` | `aiKbNavNotes`(en `Notes`) | zh 撞车、en 不同。🔴 **同区撞车,最容易被「顺手复用」** |
| **N32-3** | `Open in file manager` / `在文件管理器中打开` | `aiOpenInFileManager`(en `Open in File Manager`) | zh 撞车、**en 只差两个词的首字母大小写** —— 同 P5c N21 #2 模具 |
| **N32-4** | `Source` / `来源` | `aiSkAddedBy`(en `Added by`) | zh 撞车、en 不同 |
| **N32-5** | `Sources` / `来源` | 同上 | 同上 |
| **N32-6** | `{n} d ago` / `{n} 天前` | `aiResDaysAgo`(en `{n}d ago`,**无空格**) | zh 撞车、en 差一个空格。见 **K42** |
| **N32-7** | `Path copied` / `路径已复制` | `filesCopiedPath`(zh `已复制路径`) | 🔴 **镜像方向**:en 撞车、**zh 不同** —— 复用会让中文界面渲染成「已复制路径」,与 Vue2 不同 |
| **N32-8** | `Source` vs `Sources`(**本期内部**) | 彼此 | 🔴 **P5d 自己两个键同 zh(`来源`)不同 en** —— 蓝本 `NoteEditPane.vue:86` 是 `Source`、`:126` 是 `Sources`。**两个键都要建,不许合一** |

🔴 **T1 必须自己再跑一遍双向扫描**(§9.3 第 1 条),用**真实模块导入**计键数(§9.3 第 2 条,
协调者文本解析得 zh 1499 / en 1483,真实导入应为 **1503**)。
**P5c 连续三刀每刀都扫出协调者不知道的撞车对(T7 一对、T8 两对)—— 假定本表不完整。**

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。
  报告里贴 `Test Files` / `Tests` 两行 + 任何红项的**完整用例名**。
- 🔴 **起点基线(协调者 2026-08-04 实测,干净单轮、零红、零复跑)**:`sp8-ai`@`b905943` =
  **`Test Files 326 passed (326)` / `Tests 3515 passed (3515)`**,`vue-tsc` exit 0,`vite build` exit 0。
  与 kickoff 写的数字逐字一致 ✅。
- 已知噪声(只它们红就复跑一次并说明,不要顺手改):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build`。⚠️ **但 T4 会跑 `pnpm install` 装 tiptap**(§14)。
- scss 任务额外:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
- 🔴 **T10 额外门**:路由反转后 `pnpm build`,`grep -o "kn-note-row\|kn-edit-aside\|nme-content" dist/assets/*.css`
  **必须命中**(承 P5c E-13 的教训:`.vue` 光「存在且写了 import」进不了产物,还得**被入口可达地 import**)。
  ⚠️ **本期 scss 全进 `knowledge.scss`,而它由 `KnowledgeLayout.vue` 早已 import** →
  **CSS 侧从 T2 起就会进产物**(不同于 P5c 的新文件);**要核的是 JS 侧**:
  `grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js` 在 T10 前应搜不到、T10 后命中。
  🔴 **判据必须选择器/上下文感知**(承 E-25):别用能同时命中注释与真代码的裸子串。

### 8.1 🔴 下游算术(收官应是几文件几例)

- `color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1 例**。
  **起点 `.vue` 总数 179**(协调者实测)。本批新增 **3 个 `.vue`** → color-guard **+3 例**,**收官 182**。

  🔴 **进度台账(每刀落地后就地更新,别再引起点那个陈旧数)**:

  | 刀 | 新增 `.vue` | 落地后 `.vue` 总数 |
  |---|---|---|
  | 起点 | — | **179** |
  | T4 | `NotesMarkdownEditor.vue` | 180 |
  | T6 | `NotesView.vue` | 181 |
  | T7 | `NoteEditPane.vue`(T7 建、T8 续写,**不重复计**) | **182**(收官) |

- 新增测试文件(每个 +1 文件):`notesViewHelpers.test.ts` · `noteEditHelpers.test.ts` ·
  `NotesMarkdownEditor.test.ts` · `NotesView.test.ts` · `NoteEditPane.test.ts` → **+5 文件**。
  ⚠️ **`openInApp.test.ts` / `knowledgeRoutes.test.ts` / `deferred.test.ts` / `SettingsPage.test.ts` /
  `knowledgeStyles.test.ts` / `messageSyntax.test.ts` 都已存在**(协调者实测),**改不加**。
- **起点 326 文件 / 3515 例 → 收官 331 文件 / (3515 + 3 + 新用例数) 例。**
  🔴 **实现者以协调者给的实测基线为准,不要用预测数。**

### 8.2 交接项归属(P5c 交下来的,本文件逐条派活)

| # | 事 | 本期归属 |
|---|---|---|
| **票 1** | 知识库整区零导航入口(治理 P5c §8.5) | 🔴 **T9,本期第一优先级**(见 §15.1) |
| **票 2** | 3 处过期注释(`ParserStatus.test.ts:206` 双重过期 / `ParserTest.test.ts:180` / `SettingsView.test.ts:213`)+ **K36 a11y 无常驻断言** | **T9**(见 §15.2) |
| **票 3a** | 具名色盲区(中央 ③′ 与 `color-guard.test.ts` 都不扫 CSS 具名色) | **T5**(见 §15.3) |
| **票 3b** | 中央 ③′ 只覆盖 `src/ai/knowledge/**`,`src/ai/components/**` 的模板 `style=` 是盲区 | **T5** |
| **票 3c** | **DM9**(`indexedFilesView.test.ts:128-139` 用例名过度声明) | 🔴 **继续挂账,转 P5e** —— `indexedFilesView.ts` 与它的测试仍在全期零改动清单里,为一个用例名去碰 P5b 收官产物不值(同 P5c A-4 的理由) |
| **票 3d** | `deferred.ts` 生产侧零消费者 | 🔴 **不动** —— P5f 清空 `DEFERRED_TABS` 时一并决定去向(P5c §8.4 M-4 已定) |
| **票 3e** | `knowledgeStore.parser.test.ts:24` 的 `STATS` 是手工精简 body(缺 `models`) | 🔴 **不动**(`knowledgeStore.parser.test.ts` 在零改动清单内)。**转 P5f**,与 §8.2 票 3c 同族理由 |
| **P5c §6.4.2** | 「没有搬多」扫描正则字符集只含 `[a-z0-9-]`,`.fb-Foo` 这类带大写的类名两边都躲得过 —— P5c 裁定「转 P5d 顺手收紧」 | 🔴 **T2,本期必修 —— 因为它不再是理论问题**:K44 要搬的 `.ProseMirror` **就是一个带大写的类名**(见 §9.6) |
| **`AllowlistView`** | 归 **P5f**(用户 2026-08-04 拍板,P5c §4.5)。`DEFERRED_TABS` 里 `'allowlist'` **本期留着** | 不做 |

**本期新开的上游/后端票**:由 T0 实测后登记(至少要核 §4.2 的 409 契约与 §4.3 的上游 mapper 覆盖)。

## 9. 测试质量(P5a §9 + P5b §9 + P5c §9 全部沿用,本期额外 4 条)

P5c §9 的这些继续逐字生效,**本期高危程度不降**:
属性态断言直接比字符串两侧都比 · 「点某个东西」先确认真渲染成可点元素 ·
探针注入要行首锚定并先证注入落盘 · 报行号的断言要用**保行版** `blankComments()` ·
覆盖度自检的特征串必须唯一 · 否定式断言必须先剥注释且钉「调用形状」·
§9.1 过期守卫守两件事 · §9.2/§9.3 en 档正反向断言 + 双向撞车扫 + 真实模块导入计键数 ·
§9.4 包内转换归上游守 + 键集相等断言 · §9.5 探针还原禁 `git checkout -- <path>`。

本期新增:

- **§9.6 🔴 三个非 `k*` 新类的处置(K44 连带,本期最容易全绿放过的地方)**

  K43/K44 会往 `knowledge.scss` 引入 **3 个非 `k*`/`fb*` 前缀类**:`nme` · `nme-content` · **`ProseMirror`**。
  它们会同时撞上两条既有守卫:

  | 守卫 | 现状 | 本期怎么办 |
  |---|---|---|
  | 「没有搬多」扫描 `/\.(?:k(?:2\|n)?-[a-z0-9-]+\|fb(?:-[a-z0-9-]+)?)/g`(`knowledgeStyles.test.ts:198`) | 三个类**都扫不到**(不是 `k*`/`fb*` 前缀) | 扩成也扫 `nme(?:-…)?` 与 `ProseMirror`,**并同步收紧字符集加 `A-Z`**(兑现 P5c §6.4.2 那张票)。🔴 **扩范围 = 扫得更多,不是放宽**;必须程序化证明新正则是旧正则的**严格超集**(照 P5c §6.4.1 第 1 条的做法),并配 RED 探针 |
  | `nonKClassNames`(`:245`,`/\.([a-zA-Z][a-zA-Z0-9_-]*)/g`)+ **集合相等**断言(`:263`) | 三个类**都会被扫出来** → 掉进「未登记的非 k* 类」→ **T2 一提交这两条就红** | 三个都是**正经前缀类/第三方类**,不是「嵌套辅助类」→ 🔴 **走排除条件,与 `knowledge-app` / `parser-app` / `fb` 同款**,`NON_K_HELPER_CLASSES` **保持 10 项不变**。**注释里写明每个的出处** |

  🔴 **`.ProseMirror` 是第三方(ProseMirror)生成的类名,大小写混排,本仓 kebab 小写惯例之外的唯一一个** ——
  这正是 P5c §6.4.2 那条债务的真实触发点。**T2 报告要明确写「该债务本期已兑现,不再转下期」。**

- **§9.7 🔴 tiptap / ProseMirror 在 jsdom 下的可测性必须**先探明**,不许边写边试**

  ProseMirror 依赖 `Range` / `Selection` / `getClientRects` 等 jsdom 支持不完整的 DOM API。
  🔴 **T0 必须给出结论**:① 本仓 vitest(jsdom)能不能真实挂载 `new Editor({extensions:[StarterKit, Markdown]})`;
  ② 若不能,mock 边界画在哪(推荐 mock `@tiptap/vue-3` 的 `Editor` + `EditorContent`,
  **保留 `storage.markdown.getMarkdown` 的契约形状**);③ 参照本仓既有重 DOM 组件的测试先例
  (CodeMirror 的 `viewers/` 与 `@xterm` 的终端面板都在本仓有测试,**去读它们怎么处理**)。
  🔴 **T0 不给结论就开工 T4 = 计划失败。** 结论进附录 D 的新增一节 §D.6。
  ⚠️ **若走 mock 路线,`NotesMarkdownEditor.test.ts` 的判别力就只剩「契约形状」** →
  K38 的两个 emit、§5.3 的防回环、N29 的 `tbTick` 假依赖,**这三条的用例必须落在能真报红的层次上**,
  否则就是 §9.4 那类「零判别力用例」。**T4 要为每条附变异证据。**

- **§9.8 🔴 `relativeTime` 与 `fmtAgo` 都读 `Date.now()` → 一律用 vitest 假时钟,禁真实时间**

  蓝本 `relativeTime` 的 4 个分支边界是 60 / 3600 / 86400 / 86400*30 秒。
  🔴 **每个边界两侧都要用例**(`d < 60` 与 `d === 60`、`d < 3600` 与 `d === 3600`、…),
  第 5 档走 `toLocaleDateString()`。**`toLocaleDateString()` 的输出依赖运行环境 locale/TZ** →
  **断言不许钉死具体字符串**,要么钉「等于 `new Date(unixSec*1000).toLocaleDateString()`」(同式比对),
  要么只断言「不含 `ago` / 不是前 4 档的任何返回值」。
  ⚠️ `unixSec` 是**秒**不是毫秒(蓝本注释 `:41` 明写)—— **喂毫秒会全部落进第 5 档,用例假绿。**

- **§9.9 🔴 「本机数据下真渲染成可点元素」的本期高危清单(T0 实测后补全,协调者先点名)**

  §13 第 1 条对本期尤其危险,因为**整屏的可点性都由「有没有笔记 / 有没有草稿」决定**:

  | 屏 / 元素 | 条件 | 后果 |
  |---|---|---|
  | **草稿收件箱整块** | `v-if="drafts.length"`(`:42`) | 本机若零草稿 → **整块不渲染**,「全部确认」「逐条审阅」「确认/删除」全不可点 |
  | **列表 / 工具栏 / 收件箱** | 三者都在 `<template v-else>`(`:40`)里,前置 `v-else-if="!notes.length"`(`:31`) | 本机若零笔记 → **只有空态**,工具栏与列表整块不渲染 |
  | **骨架屏** | `v-if="loading && !notes.length"`(`:19`) | 只在首次加载的瞬间出现 → **真机基本看不到**,验收只能靠慢网络或单测 |
  | **「确认」按钮**(列表行) | `v-if="n.status === 'draft'"`(`:131`) | 非草稿行没有这个按钮 |
  | **「归档」按钮** | `v-if="n.status !== 'archived'"`(`:132`) | 已归档行没有 |
  | **筛选空态** | `v-if="!filtered.length"`(`:103`) | 要选一个本机没有的类型才能验 |
  | **侧栏「来源」卡** | `v-if="!isNew && sourceRefs.length"`(`:125`) | 手写笔记通常零 `source_refs` → **不渲染** |
  | **侧栏「被引用」卡** | `v-if="!isNew && backlinks.length"`(`:137`) | 本机大概率零反链 → **不渲染** |
  | **冲突弹窗** | `v-if="conflict"`,只在 **409** 后开 | 🔴 **要人为造并发**:两个标签页同开一条笔记、一边先存 → 另一边存 → 才看得到。**清单必须写这个操作路径** |
  | **「保存」按钮** | `:disabled="saving \|\| (isNew && !form.title.trim())"`(`:19`) | **新建时标题空 → 灰的** |
  | **「文件管理器」/「复制路径」** | 在 `<template v-else>`(`:96`,即 `!isNew`)里 | 新建页看不到 |

  🔴 **`navigator.clipboard` 在 HTTP-IP 访问下不存在**(记忆 `newui-clipboard-insecure-reka`)——
  「复制路径」与「复制我的正文」两处 `navigator.clipboard.writeText` **真机会走 catch 弹「操作失败」**。
  **蓝本就是这样(它也只有 try/catch)→ 按 N 系列照抄,不许顺手加 `execCommand` 兜底**
  (那是本仓 Files 区的既有增强,不是笔记区蓝本行为)。
  **但必须在验收清单里写明「这两个按钮在 HTTP 访问下弹操作失败 = 预期,不是缺陷」**,否则机主必然报 bug。
  → **同时登记一张前端票**(转 P5e/P5f 或独立票):笔记区两处复制应复用本仓既有的 `execCommand` 兜底。

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p5d-task-N-report.md`(**`git add -f`**),至少包含:
逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认,`git status` 必须干净;
🔴 **碰 gitignore 产物时 md5/diff 才是证据,`git status` 不构成任何证据** —— P5c §1.3.1)·
三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**§3 的 K1–K44 里本任务命中的每一条显式申报** ·
**§3.5 的 N1–N32 里本任务命中的,要说明确实照抄了** ·
**用了哪几个 fixture 文件、mock 形状取自哪一层**(§4.1 的表,camelCase 还是 snake_case、剥了几层)。

返回给协调者的只有 **≤15 行**:状态 · 提交 sha · 一行测试结果 · 顾虑。

## 11. 评审者附加要求(P5a §11 + P5b §11 + P5c §11 全部沿用,本期额外 5 条)

1. 🔴 **「缺口猎」是常规动作,不是加分项。** P5c **五次猎中,全部是「产品代码对、守卫为零」**
   (`--x:` 逃逸 · 守卫变量作用域 · 键选纪律 · mock 键集 · 具名色)。**本期已知的高危裸奔点**:
   **K40**(`.ts` 里的渐变,`color-guard` 压根不扫 `.ts`)· **§6.1 那 2 处模板内联色**(缺口③)·
   **§9.6 的三个非 `k*` 类** · **§9.7 若走 mock 路线时 K38/N29/§5.3 三条的判别力**。
2. 🔴 **专查 §3.5 的 N23–N32 有没有被「顺手修正」**,改了按 Critical 报。本期最容易被误修的:
   **N29**(`tbTick >= 0 &&` 这行看着像废代码,删了工具栏 active 态就死)·
   **N28**(`wordCount` 的正则看着像 bug)· **N23**(给 `conflictMessage` 补 i18n)·
   **N26**(把三段式合成一个带 HTML 的键)· **N30**(删 `:key="editingId"` 或把 `watch` 改成无条件重载)·
   **N32-2/3/7**(复用 `aiKbNavNotes` / `aiOpenInFileManager` / `filesCopiedPath`)。
3. 🔴 **核 mock 形状的层次**(§4.1)。`service.notes.list` 返回**已归一化的 `Note[]`**(不是 `{notes:[]}` 信封)、
   `backlinks` 返回**数组**(不是 `{backlinks:[]}`)、`getSettings` 返回 **camelCase 且只有两个字段**。搞反了按 Critical 报。
4. 🔴 **K39 的三条逐条核**:每个新 token 两档都写了 · 声明处注释有蓝本 `file:line` ·
   `#FF9500,#FFCC00` 只声明**一份**(两个消费方共用)。并**逐行色扫** `knowledge.scss` 的全部新增段。
5. 🔴 **K44 / §6.2 的顶层例外逐条核**:两段 ProseMirror 规则**都在**且**没合并** ·
   顶层裸选择器的**集合相等**断言真的只允许那一条 · RED 探针真的报红过。

---

## 12. kickoff 勘误(协调者回权威源核出,**下游一律以本节为准**)

kickoff = `.superpowers/sdd/p5d-kickoff-prompt.md`。
**结构性结论:kickoff 的蓝本行数 5/5 全对**(271 / 338 / 47 / 50 / 11),**路由与 `DEFERRED_TABS` 的描述全对**,
**票 1/2/3 的诊断全对**。错的集中在「起点 sha」「参考单测的归属」与「一处遗漏」上。

| # | kickoff 原文 | 权威源实际(协调者实测) | 处置 |
|---|---|---|---|
| **E-26** | §2「产品代码 **`bbbdca4`**」 | HEAD 实测 **`b905943`**;`bbbdca4` 之后有 5 个提交 | 全是 `.superpowers/sdd/` 下的纯 markdown(`git diff --name-only bbbdca4..b905943 -- src/` 为空),三门基线不受影响。**起点写 `b905943`**(§1) |
| **E-27** | §4 把 `__tests__/notesMapper.spec.js` 列进「Vue2 既有 4 份单测,行为要承接」 | 🔴 **它的被测对象是 `src/service/searchMapper.js` 的 `buildSemanticSearchBlock`** —— 那是**搜索聚合器**,kickoff 自己在 §4「剩余批次」里把 `searchAggregate` 79 行划给了 **P5e** | **该 spec 归 P5e,本期不做。** 另 `notesService.spec.js` 的被测对象在**共享包**里 → 按 §9.4 归上游守。**本期真正要承接的只有 2 份**(§4.3) |
| **E-28** | §4 表格只列了 5 个蓝本文件(合计 717 行) | 🔴 **漏了 scss** —— `knowledge.scss` 里有 **8 段共 244 行**是 P5d 的(`:2023-2046` 去掉已搬的 `.kn-badge` / `:2047-2056` / `:2057-2085` / `:2086-2121` / `:2122-2194` / `:2195-2241` / `:2242-2249` / `:2265-2281`),**外加 K43 的 `.k-seg` 21 行 + K44 的 7 行**。协调者实测 New-UI 缺 **66 个类** | **本期真实体量 ≈ 717 + 272 = 989 蓝本行**,不是 717。**scss 独立一刀(T2)**,别塞进组件刀里 |
| **E-29** | §3 票 1「路由已注册(`src/router/index.ts:18` + `:37`)」 | 行号未逐字复核到具体内容,但**结论成立**:`knowledgeRoutes.ts:74` 的 `notes` 子路由确实指 `KnowledgeDeferred`,`SettingsPage.vue:417` 确实是 `<button class="set-detail-link" @click="onDetailsClick">` | 结论无误。**改点的准确坐标是 `SettingsPage.vue:415-417` + `onDetailsClick` 的定义处**,T9 自己现测 |
| **E-30** | §5「新增 i18n 键必须同时进两档」(未给计数) | 协调者实测:distinct **99** 串、语言包 **99/99** 命中、按 A-6 复用 7 → 新增 **92** | 数字进 §7,附录 A 是权威 |

## 13. 验收清单纪律(**下游与协调者都受约束**)

P5b/P5c 的三条逐字生效,**外加 P5c §13.4 的第 4 条**:

1. 🔴 **凡「点某个东西」的项,必须先确认该元素在本机数据下真的渲染成可点元素。**
   **本期高危清单见 §9.9(11 项),协调者写清单时逐个照抄。**
2. **具体计数有保质期。** 清单里写「**实测于 YYYY-MM-DD,数字会漂,以下列命令现测为准**」+ 附取数命令。
3. 🔴 **凡「会写后端 / 会改设备状态」的验收项,必须标红并写「验完怎么恢复」。**
   🔴 **本期比 P5c 更狠:笔记的写操作会在 `/DATA/Notes` 里真的创建 / 修改 / 删除 `.md` 文件。**
   至少 6 处:新建笔记 · 保存(改 revision)· 确认(draft→curated,**会改文件 frontmatter**)· 归档 ·
   **删除(🔴 磁盘上的 `.md` 文件一并删除,不可恢复)** · 批量「全部确认」(一次改 N 条)。
   **删除那条必须写「请只删你自己在验收时新建的那条」。**
4. 🔴 **清单第一项永远是「这一屏怎么从产品的正常导航走到」**(P5c §13.4)。
   **本期必须写**:AI 设置页顶栏「详情」→ `/ai/knowledge` → 左栏第 4 项「笔记」(**T9 修完票 1 之后才成立**);
   编辑页靠**列表行点击**进入(`?id=<id>`),新建靠**「新建笔记」按钮**(`?id=new`)——
   **`?id=` 是 query 深链,清单要显式给出可直接粘贴的两个 URL。**

## 14. 🔴 装依赖的纪律(K37 落地约束)

1. **只装这四个,版本锁 v2 线**:
   ```bash
   pnpm add @tiptap/vue-3@^2.27.2 @tiptap/starter-kit@^2.27.2 @tiptap/pm@^2.27.2 tiptap-markdown@^0.6.1
   ```
   🔴 **装完立刻核 `git diff package.json`:必须只有这四行新增,`dependencies` 其余一字不动、
   `devDependencies` / `scripts` / `version` 全不动。** `pnpm-lock.yaml` 的 diff 只许是这四个包及其传递依赖。
2. 🔴 **核实真实装上的是 v2**:`pnpm list @tiptap/vue-3 @tiptap/starter-kit @tiptap/pm tiptap-markdown`,
   四个都要是 `2.x` / `0.6.x`。**装成 3.x 按 Critical 报**(K37)。
3. 🔴 **装完 kill 重起 dev server `:5288`** —— Vite 预打包缓存不看内容(记忆 `nimoos-service-pnpm-drift`),
   不重起会「三门全绿但页面报模块找不到」。
4. **`markdown-it` 已在本仓 `dependencies` 里**(`tiptap-markdown` 的运行时依赖),不用另装、**也不许改它的版本**。
5. 🔴 **报告里贴 `pnpm list` 输出 + `git diff --stat package.json pnpm-lock.yaml`。**

## 15. 🔴 三张挂账票的落地口径

### 15.1 票 1 —— 知识库导航入口(T9,本期最高优先级)

**改点**:`src/ai/views/SettingsPage.vue`(§1.1 已显式解禁)。

1. 顶栏「详情」从 `<button class="set-detail-link" @click="onDetailsClick">` **反转回**
   `<router-link class="set-detail-link" to="/ai/knowledge">` ——
   照 `knowledgeRoutes.ts` 那**四次**「反转不删、改前原文留成注释」的先例(P5a T12 / P5b T5 / P5b T10 / P5c T10)。
2. 🔴 **`.set-detail-link` 类名与视觉不动。** `settings-styles.scss:73` 已含 `text-decoration: none`
   → `<router-link>` 渲染成 `<a>` 后视觉一致。**`settings-styles.scss` 在全期零改动清单里,一行不许动。**
3. 🔴 **`onDetailsClick` 的处置要想清楚**:若反转后它零调用点,**按「反转不删」留着还是删掉?**
   —— **裁定:删掉那个 handler,但把它的原文留成注释**(与 `knowledgeRoutes.ts` 的先例同款)。
   理由:留一个零调用点的 handler 会让 `vue-tsc` 报 unused 或让下一个人以为还有别的入口;
   而注释保留了「为什么曾经是 button」的历史。**`DEFERRED_SECTIONS` 的占位机制本身不受影响,不许碰。**
4. 🔴 **配 RED 探针 + 常驻断言**:`SettingsPage.test.ts:239` 现有的
   `await w.find('.set-detail-link').trigger('click')` 那条用例**必须改**(它现在断言弹 toast)。
   改成断言 `.set-detail-link` 是一个 `to="/ai/knowledge"` 的 `RouterLink`。
   **判据:把它改回占位 `<button>` + toast → 新断言必须报红。**
5. **顺带订正 `SettingsPage.vue:26-29` 那段注释**(它现在还说「`/ai/knowledge` 要到 SP8-P5 才存在」)。
   🔴 **改成「带时点的历史记录 + 现状 + 引治理条目编号」**(P5c §8.4 的连带纪律:
   **注释里引「文件:行号」会随后续改动失效,引治理条目编号才稳** —— 这里引「治理 §15.1 / P5c §8.5」)。

**通用教训(本期正式入治理)**:🔴 **「跨期占位」是最容易烂尾的一类债** ——
A 期为不落空白页做了占位,B 期把真页面建好,但**没人负责把占位还回去**,因为那个占位在 A 期的文件里。
→ **凡做「等 X 期才存在」的占位,当场就要把「还原」写成 X 期的显式 DoD**,不能只留注释。
**本期立刻兑现这条**:`DEFERRED_TABS` 里剩下的 `search` / `wiki` / `roots` / `allowlist`,
**T10 要在 `deferred.ts` 的文件头注释里逐项写明「归哪一期反转」**(`search`→P5e,`wiki`/`roots`/`allowlist`→P5f)。

### 15.2 票 2 —— 注释债 + K36 a11y 常驻断言(T9)

- **3 处过期注释**:`ParserStatus.test.ts:206`(🔴 **双重过期**:说「仍指占位页」已反,
  且引的 `knowledgeRoutes.ts:63` **行号已变 `:78`**)· `ParserTest.test.ts:180` · `SettingsView.test.ts:213`。
  **改法同 P5c T10 注释轮**:改成「带时点的历史记录 + 现状 + **引治理条目编号**」。
  🔴 **只改注释** —— 报告要给「非注释行改动为 0」的自证(`git diff` 逐行 + 三门数字不变)。
- **K36 a11y 常驻断言**:P5c 终审在真渲染里实测 `aria-labelledby` 与 `.k-modal-title` 的 `id` 同值同元素
  = 成立,但没用例钉住。**先例 `IndexedFilesView.test.ts:1947`,补 3 行进 `SettingsView.test.ts`。**
  ⚠️ **`SettingsView.test.ts` 在全期零改动清单里 → 本条是显式解禁的例外,只许加这 3 行 + 上面那 1 行注释。**

### 15.3 票 3 —— 守卫债(T5)

- **具名色扫描**:中央 ③′ 守卫(`knowledgeStyles.test.ts` 里 P5c T8 新建的那条)与全仓
  `color-guard.test.ts` **只扫 `#hex`/`rgb()`/`hsl()`,不扫 CSS 具名色**。当前零真实违规、是继承缺口。
  🔴 **踩坑预警(P5c §6.5 已点名)**:**朴素匹配会假报红** —— `QueueView.vue:474` 有 `white-space: nowrap`,
  宽松的 `white` 会冤枉它。**必须钉「属性值位置」**(只在 `color:` / `background:` / `background-color:` /
  `border-color:` / `border:` / `box-shadow:` / `fill:` / `stroke:` 等的**值**里找),
  且排除 `white-space` 这类**复合属性名**与连字符词。**配 RED + 反向探针两头验**:
  ① 塞 `color: white` → 必须报红;② `white-space: nowrap` → **必须不报红**。
- **覆盖范围**:中央 ③′ 守卫只覆盖 `src/ai/knowledge/**` → **扩到 `src/ai/components/**`**。
  🔴 **扩范围会把既有文件纳入扫描 → 可能扫出既有违规。** 若真扫出:**先报 `NEEDS_CONTEXT` 给协调者**,
  不要自己改 `src/ai/components/**` 里的文件(它们是 P2a/P2b 的产出、不在本期范围)。
- 🔴 **本刀的两条都是「加强既有守卫」,零产品代码改动** —— 报告要证明 `src/` 下**非测试文件**零改动。

## 16. 🔴 `openInApp.ts` 补两个函数(T5)

New-UI `src/ai/services/openInApp.ts` 现有 7 个导出,**缺** P5d 需要的两个
(协调者实测:全仓零 `openDirInNewTab` / 零 `openAgentSessionInNewTab`)。

| 函数 | 蓝本 | 本仓落法 |
|---|---|---|
| `openDirInNewTab(dirPath)` | `openInApp.js:52-55`:`if (!dirPath) return; window.open(filesPathUrl(dirPath, ''), '_blank')` | **逐字照抄**,`filesPathUrl` 用**本仓既有的那个**(`:41-43`,`/app/#/files?path=…&highlight=…`)—— 本仓早已按「两套并存应用」改过落点并在文件头注释申报,**沿用,不许改回蓝本的虚拟路径形式** |
| `openAgentSessionInNewTab(sessionId)` | `openInApp.js:117-124`:`agentSessionUrl` = `` `/#/ai/agent?session=${encodeURIComponent(sessionId)}` `` | 🔴 **需要一个决定,见下** |

🔴 **`openAgentSessionInNewTab` 的落点裁定(协调者,2026-08-04)**:
- **实测事实**:New-UI 有自己的 `/ai/agent` 路由(`router/index.ts:35`),但 **`AgentPage.vue` 与
  `agentStore` 全仓零 `?session=` 读取** —— 指向 `/app/#/ai/agent?session=X` 会打开 New-UI 的 Agent 页
  但**不会选中那条会话**(静默失效)。Vue2 的 `Agent.vue:129/164/212` 则**真的**读 `$route.query.session`。
- **裁定:指向旧 Vue2 应用 `/#/ai/agent?session=…`**,与本仓 `photosAssetUrl`(`:37-39`)**同款处理** ——
  那里的文件头注释(`:5-9`)已经立下先例:「New-UI 还没有该能力时,暂时借道旧应用这个真实可用的落点;
  X 合并/实现后应换成 New-UI 自己的路由」。
- 🔴 **落地要求**:① 在 `agentSessionUrl` 上方写与 `photosAssetUrl` 同款的申报注释,
  写明「New-UI 的 `/ai/agent` 尚未实现 `?session=` 深链(SP8-P2a/P2b 未做),故借道旧应用;
  实现后应换成 `/app/#/ai/agent?session=`」;② **登记一张 P5e/P5f 或独立票**:
  New-UI Agent 页补 `?session=` 深链;③ **测试断言 URL 逐字**(`/#/ai/agent?session=…`,**无 `/app` 前缀**),
  并加一条**反向断言不等于** `/app/#/ai/agent?session=…` —— 否则将来有人「顺手统一前缀」会静默退化。
- ⚠️ **不许连 `openNoteInNewTab`(蓝本 `:112-115`)一起补** —— 本期无调用点,补了就是死代码。
  **登记进 P5e/P5f 交接项**(`FileDetailDrawer` 可能要用)。
