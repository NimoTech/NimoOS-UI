# SP8-P5d 实施计划 —— 知识库笔记区(NotesView + NoteEditPane + tiptap 编辑器)

> **For agentic workers:** 用 `superpowers:subagent-driven-development` 逐刀执行(单车道,每刀一个实现者 + 一个独立评审)。

**权威优先级:上级设计 > `p5d-common-constraints.md` + 附录 A/B/D > 本计划书 > 任务 brief。**
🔴 **本计划书不重复治理文件的内容**,只定「切几刀 / 什么顺序 / 每刀的 DoD 与依赖」。
下游任务**必读治理文件与三份附录**,本计划书只当路线图看。

- 治理:`.superpowers/sdd/p5d-common-constraints.md`(**K37–K44** · **N23–N32** · §4.3 四份 spec 归属 ·
  §6.2 K44 顶层例外 · §7.1 八组撞车 · §8.1 算术 · §9.6–§9.9 · §14 装依赖 · §15 三张票 · §16 openInApp)
- 前三期治理**全部继续生效**:`p5a-` / `p5b-` / `p5c-common-constraints.md`
- 附录(**T0 产出,缺位不许开工 T1**):`p5d-appendix-A-i18n.md` · `p5d-appendix-B-tokens.md` · `p5d-appendix-D-classes.md`
- fixture:`p5d-fixtures/`(T0 产出,真机响应体 + README 的重抓命令)

---

# §0 开工必读(**本节自成一体 —— 即使你只读这一节也不许搞错**)

> 🔴 **本节是为「新会话 / 新 subagent 只看到这份计划书」的场景写的。**
> 下面的工作区、蓝本版本、硬约束**不许从记忆或习惯里推**,一律照本节。

## §0.1 工作区(**最容易造成不可逆损失的一节**)

| 仓 / 目录 | 权限 | 说明 |
|---|---|---|
| **`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`** | 🟢 **唯一可写仓** | 分支 **`sp8-ai`**。本期全部产品代码与台账都在这里 |
| `/home/nimo/NimoTech/.sp8/NimoOS-Service` | 🟡 **本期零改动** | 共享包 `@nimotech/nimoos-service`,17 个 `notes` 方法已在包内 → **不需要跨仓 build、不需要为它 `pnpm install`** |
| `/home/nimo/NimoTech/NimoOS-UI` | 🔴 **只读** | Vue 2 蓝本源。**唯一例外**是往 `docs/vue3-migration-sp3` 提 spec/plan/roadmap(**必须带 pathspec**;该分支被 SP7/SP9 **并发会话**共用,提交前先看有没有别人的新提交)。<br>🔴🔴 **永远别在这里 `checkout` / `stash` / `reset`** |
| `/home/nimo/NimoTech/NimoOS-New-UI` | 🔴 **一个字都不许碰** | SP6/SP9 的主工作树 |
| `/home/nimo/NimoTech/.sp7/NimoOS-New-UI` | 🔴 **一个字都不许碰** | SP7 相册区,**有并发会话** |

**git 禁令**(全期):禁 `git add -A` / `git add .` · 禁 `rebase` / `reset` / `stash` / `merge` / `push`。
台账与报告在 `.superpowers/` 下、被 `.gitignore` 盖着 → **一律 `git add -f`**。
🔴 **SP7 曾把整个 `.superpowers` 目录弄丢过(gitignore 导致 git 救不回)。**

## §0.2 蓝本版本(**锁死,不许漂**)

```bash
# 唯一正确的读蓝本方式:
git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>
```

- 🔴 **蓝本 = `NimoOS-UI`@`7a6ee6b7`**(= 该仓本地 `main`,2026-07-31)。**P5 全期(P5a→P5f)锁这一个 sha,用户 2026-08-04 拍板,不许换。**
- 🔴 **禁止读 `NimoOS-UI` 的磁盘工作树** —— 它签出的是 `docs/vue3-migration-sp3`(2026-07-15 分叉),
  **压根没有 `NotesView.vue`**。读工作树会得到「文件不存在」或旧版内容。
- **远端核验已完成(2026-08-04,协调者)**:真远端 `main` = **`65cfda58`**(领先 16 个提交)。
  P5d 五个蓝本 + 四份 Vue2 spec **逐字节相同**;`zh_CN.json` **0 个键的值变了**(增 18/删 16 全是相册+新闻订阅+系统日志);
  `knowledge.scss` / `knowledgeStore.js` 各 1 处**注释**中→英。**无功能性差异 → 锁 `7a6ee6b7`。**
  ⚠️ `65cfda58` 已在本地对象库,`git show 65cfda58:<path>` 可直接读、不用再 fetch。
- 🔴 **T0 仍须独立复跑一遍蓝本源核验**(治理 §1.4 的通用纪律,见下方 T0 的 DoD 第 1 条)。
  `fetch` 只写 `FETCH_HEAD`,**不动 `main`/`origin/main`/工作树**(已实测,共享检出安全)。
- **本期起点(可写仓 HEAD)**:`sp8-ai`@**`b905943`**(kickoff 写的 `bbbdca4` 是错的 —— E-26)。

## §0.3 硬约束(违反任一条即缺陷)

1. 🔴 **颜色**:一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算);
   禁 `theme-exception` 逃逸;**注释里也不许出现色字面量**。新 token 必须在 `knowledge.scss` 的
   **两个**主题块里**都**显式写值。`transparent` 是关键字,不算。
2. 🔴 **i18n**:新键**必须同时**进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 会断言键集一致)。
   zh 值一律**逐字照抄** `git show 7a6ee6b7:src/assets/lang/zh_CN.json`,**不许自己翻译、不许改标点**。
3. 🔴 **禁部署**:**不许跑 `./scripts/deploy.sh`、不许写 `/var/lib`**。
   用户 2026-08-03 拍板:master 先发不含 AI/相册的快照版,`sp8-ai` 未合 master → **本期验收全走 dev server。**
4. 🔴 **验收 dev server 端口 `:5288`,不另起端口。**(**PID 会变,别把 PID 写进 DoD** ——
   用 `ss -ltnp | grep 5288` 或 `pgrep -af "vite.*5288"` 现查。)
   **每刀提交后由协调者 kill 重起**(P3a 教训:不重起会验到旧代码)。
5. 🔴 **`.sp8/NimoOS-New-UI/vite.config.ts` 里的 `optimizeDeps.exclude` 别删** ——
   它堵的是「dev server 喂旧共享包」那个坑(记忆 `nimoos-service-pnpm-drift`;P5b T11 已栽过一次)。
6. **移植纪律**:界面严格 1:1(版式/间距/结构/文案/DOM 顺序/按钮位置逐字照蓝本);
   Vue2 的 bug/竞态/吞错**不照抄**,改正确逻辑并按治理 §3 申报登记;**禁无关重构**。
7. **偏离**:只有治理文件里 **K1–K44** 登记过的偏离才许做;**照抄不改**的条目是 **N1–N32**。
   其余一律**先申报再做**;拿不准写 `NEEDS_CONTEXT` 并**停下**。
8. **零改动清单**:见治理 §1.1。本期**显式解禁**的只有 5 个文件
   (`SettingsPage.vue` / `SettingsPage.test.ts` / `package.json` / `pnpm-lock.yaml` / `openInApp.ts`)
   加 3 个测试文件各一条注释。**要改清单里的其它文件 → 停下写 `NEEDS_CONTEXT`。**

## §0.4 三门(每刀提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集;输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行。
- 🔴 **起点基线(协调者 2026-08-04 干净单轮实测,零红零复跑)**:
  **`Test Files 326 passed (326)` / `Tests 3515 passed (3515)`**,`vue-tsc` exit 0,`vite build` exit 0。
  其它基线:`.vue` **179** · `aiKb*` **295** · 全表键数 **1503**(真实模块导入)· `KIcon.PATHS` **43**。
- **已知噪声**(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **包管理器是 `pnpm`**,勿用 yarn/npm。

## §0.5 🔴 清缓存之后:T0 必须先把基线重新坐实

**用户 2026-08-04 在开工前清了缓存。** 缓存清到哪一层决定要补哪些步骤:

| 清了什么 | 必须补的动作 |
|---|---|
| `node_modules/.vite`(Vite 预打包缓存) | **kill 重起 dev server `:5288`**;首次 `pnpm test` 会慢 |
| `.sp8/NimoOS-New-UI/node_modules` 整个 | `cd ../NimoOS-Service && pnpm install && pnpm build` → 回本仓 `pnpm install`(见仓内 `CLAUDE.md`) |
| 🔴 **`.sp8/NimoOS-Service/dist/`** | **必须 `cd ../NimoOS-Service && pnpm build` 重建。** 这是共享包产物、消费仓直接吃它。<br>⚠️ **这里有历史事故**:`dist/wiki.d.ts` 被 07-31 的变异探针改成 `pathX` 没还原,因为 `dist/` 在 `.gitignore` 里、**`git status` 全程干净、三门全绿,污染活了三天**(P5c §1.3.1)。**清掉重建反而是好事,但重建后要确认 `dist` 与 `src` 一致。** |
| `dist/`(本仓构建产物) | 无需动作,`pnpm build` 会重建 |

🔴 **T0 的第 0 步(在做任何别的事之前)**:跑一遍三门,确认仍是 **326 / 3515 / 0 / 0**。
- **对得上** → 照 §0.4 的基线继续,报告里写「清缓存后基线复核一致」。
- **对不上** → **立刻停下写 `NEEDS_CONTEXT`**,把差异贴给协调者。
  🔴 **不许自己「修」到对得上** —— 基线错了,后面十刀的 DoD 数字全是错的。

## §0.6 必读顺序(**跳读会出事**)

1. `p5a-common-constraints.md` 全文 → 2. `p5b-common-constraints.md` 全文 →
3. `p5c-common-constraints.md` 全文 → 4. **`p5d-common-constraints.md` 全文** → 5. 本计划书 → 6. 三份 `p5d-` 附录
→ 7. 你自己那一刀的 brief

**同一节里,后读的那份为准。** 权威优先级见本文件开头。

---

**Goal:** 把 Vue2 的知识库笔记区(列表 + 编辑器 + tiptap 富文本)1:1 迁到 New-UI,
并把知识库整区**从 AI 设置页可点达**(票 1)。

**Architecture:** 蓝本锁 `NimoOS-UI`@`7a6ee6b7`。`NotesView.vue` 落 `views/`(rail 第 4 项),
`NoteEditPane.vue` + `NotesMarkdownEditor.vue` 落 `components/`(靠 `?id=` query 切换,非路由),
两份 util 落 `util/`,全部 scss 进既有 `knowledge.scss`。REST 一律走共享包 `service.notes.*`(Service 仓零改动)。

**Tech Stack:** Vue 3 `<script setup lang="ts">` · Pinia · vue-router 4(hash)· vue-i18n 9 ·
**新增 tiptap v2 四包**(`@tiptap/vue-3` / `starter-kit` / `pm` / `tiptap-markdown@0.6`)· vitest + jsdom · sass

## 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| 起点 | 🔴 **`b905943`**(不是 kickoff 写的 `bbbdca4` —— E-26,中间 5 个提交全是纯 markdown) |
| 蓝本 | 🔴 **`NimoOS-UI`@`7a6ee6b7`**,一律 `git show 7a6ee6b7:<path>` 读。**工作树签出的是 07-15 旧分支,没有 `NotesView.vue`** |
| 远端核验 | ✅ 已做:真远端 `main` = **`65cfda58`**;P5d 五个蓝本 + 四份 Vue2 spec **逐字节相同**;`zh_CN.json` **0 个键的值变了**(增 18/删 16 全是相册/新闻/系统日志);`knowledge.scss` / `knowledgeStore.js` 各 1 处**注释**中→英。**无功能性差异 → 按用户 08-04 拍板锁 `7a6ee6b7`,不停下问** |
| Service 仓 | `sp8-ai`,**全期零改动**(17 个 `notes` 方法已在包内,协调者逐个核实)→ 不跨仓 build |
| 三门基线 | 🔴 **326 文件 / 3515 例全绿** · `vue-tsc` 0 · `vite build` 0(协调者 2026-08-04 干净单轮实测,与 kickoff 逐字一致) |
| 其它基线 | `.vue` **179** · `aiKb*` **295** · 全表键数 **1503**(真实模块导入) · `KIcon.PATHS` **43** |
| 验收 | dev server **`:5288`**,**PID 会变、别写进 DoD**(用 `ss -ltnp \| grep 5288` 现查)。**每刀提交后由协调者 kill 重起**;🔴 **T4 装完依赖必须重起**(§14-3) |
| 🔴 清缓存 | 用户 2026-08-04 开工前清了缓存 → **T0 的第 0 步是重新坐实三门基线**,见 **§0.5** |
| 收官目标 | **331 文件**(+5 测试文件)· color-guard **+3 例**(`.vue` 179 → **182**) |

## 本期真实体量(kickoff 少算了 scss —— E-28)

| 来源 | 行数 |
|---|---|
| `NotesView.vue` | 271 |
| `NoteEditPane.vue` | 338 |
| `NotesMarkdownEditor.vue` | 47 |
| `notesViewHelpers.js` | 50 |
| `noteEditHelpers.js` | 11 |
| 🔴 `knowledge.scss` 的 8 段(`:2023-2046` / `:2047-2056` / `:2057-2085` / `:2086-2121` / `:2122-2194` / `:2195-2241` / `:2242-2249` / `:2265-2281`) | **244** |
| 🔴 `.k-seg`(`:551-571`,K43) | **21** |
| 🔴 `NotesMarkdownEditor.vue:40-46` 的 `<style>`(K44) | **7** |
| **合计** | 🔴 **≈ 989**(不是 717) |

**协调者实测:New-UI 缺 66 个类**(含 `.k-seg` / `.nme` / `.nme-content` / `.ProseMirror`);
已有的只有 21 个(`kn-badge` + `k-view`/`k-scroll`/`k-btn`/`k-modal*`/`k-filter-pill*`/`k-filt-select`/`k-empty*`/`k-skel`/`k-badge`)。
⚠️ **协调者第一次算覆盖率时被 `knowledge.scss:1595` 那行注释骗了**(它提到 `.kn-type-ic` / `.kn-src` / `.kn-tag` / `.kn-pathstrip`)
—— **剥注释后这 4 个类是 P5d 要搬的**。这是 P5c §9 记录的「撞注释」家族第 N 次,**下游读源文件一律先剥注释**。

## 协调者裁定(2026-08-04,补治理文件)

- **A-6 i18n 复用只认 `aiKb*` 家族里语义相符的 7 个**(`aiKbAll` / `aiKbCancel` / `aiKbClearFilters` /
  `aiKbOpFailed` / `aiKbStatus` / `aiKbColType` / `aiKbJustNow`),**其余一律新建**。
  理由逐字同 A-1:`audioSummary` / `homeRelMinutes` / `filesCtxCopyPath` 这类跨区键,
  将来那个区改文案会静默改掉笔记区。→ **新增 92 键,「exactly N keys」用 `92`。**
- **A-7 tiptap 锁 v2 线**(K37)。**`tiptap-markdown@0.9.0` 的 peer 是 `@tiptap/core@^3.0.1`**(协调者实测),
  装 v3 = 拿蓝本没验证过的 API 做 1:1 移植。→ `@tiptap/vue-3@^2.27.2` + `starter-kit@^2.27.2` +
  `pm@^2.27.2` + `tiptap-markdown@^0.6.1`(**四个包**,`pm` 是 peer 且蓝本也显式列了)。
- **A-8 `openAgentSessionInNewTab` 指向旧 Vue2 应用**(治理 §16)。
  实测:New-UI 的 `AgentPage`/`agentStore` **零 `?session=` 读取**,指 `/app/#/ai/agent?session=X` 会静默失效;
  Vue2 `Agent.vue:129/164/212` 真的读。**借道旧应用,与既有 `photosAssetUrl` 同款处理并加同款申报注释**,
  同时开一张「New-UI Agent 页补 `?session=` 深链」的票。
- **A-9 透明度差异按 A11 同族处理,不开小灶**(治理 §6.3)。
  蓝本 `rgba(255,149,0,0.14)` / `rgba(52,199,89,0.12)` / `rgba(255,59,48,0.12)` / `rgba(0,122,255,0.08)`
  一律映射到本仓既有的 `--warning-soft` / `--success-soft` / `--danger-soft` / `--accent-soft`
  (P5b-T2 搬 `.kn-badge` 时已这么做过,`knowledge.scss:1602-1607`)。**保全站一致,不为透明度差几个点新造 token。**
  → **与 P5c 悬着的 A11 合并成验收清单里的**一条**显式确认项**,请用户看实物拍板。
- **A-10 三个非 `k*` 新类走排除条件,`NON_K_HELPER_CLASSES` 保持 10 项**(治理 §9.6)。
  `nme` / `nme-content` / `ProseMirror` 是正经前缀类/第三方类,不是「嵌套辅助类」——
  与既有的 `knowledge-app` / `parser-app` / `fb` 同款处理。
- **A-11 P5c §6.4.2 那张「大小写盲区」的债本期必修**,理由:`.ProseMirror` 就是一个带大写的类名 → **不再是理论问题**。
- **A-12 `notesMapper.spec.js` 与 `notesService.spec.js` 不在本期**(E-27 / 治理 §4.3)。
  前者的被测对象是 P5e 的搜索聚合器;后者的被测对象在共享包里,按 §9.4 归上游守。
  **T0 要核实上游 `NimoOS-Service/src/notes.test.ts` 承接了哪几条 mapper 行为,缺的登记成上游票。**

---

## 切刀(单车道 T0 → T10,共 **11 刀**)

**单车道**:每刀独立 subagent → 独立评审(**最低 sonnet,禁 haiku**)→ 必要时修复轮 → 协调者 kill 重起 `:5288`。
**一刀 = 一个语义提交。** 每刀提交前三门全过(治理 §8)。

### 依赖链

```
T0 验蓝本源 + 三附录 + fixture + tiptap 可测性探明        (零产品代码)
 ├─ T1 i18n(92 新键 + 7 复用 + 八组撞车 en 断言)
 │    └─ T3 util 两份(notesViewHelpers + noteEditHelpers)
 │         ├─ T6 NotesView.vue
 │         └─ T7 NoteEditPane.vue 上半 ─ T8 下半
 ├─ T2 knowledge.scss 66 类 + K39 token + 守卫(§9.6 + A-11)
 │    ├─ T4 tiptap 依赖 + NotesMarkdownEditor.vue     (需要 K44 的 ProseMirror 段)
 │    │    └─ T7
 │    ├─ T6
 │    └─ T7
 ├─ T5 openInApp 两函数 + 票 3 守卫债                  (独立,可任意时点插)
 │    ├─ T6(openDirInNewTab)
 │    └─ T7(openAgentSessionInNewTab)
 └─ T9 票 1 导航入口 + 票 2 注释债 + K36 a11y          (独立于组件刀)
      └─ T10 路由反转 + DEFERRED_TABS 摘 notes + 收官
```

实际派活顺序(单车道,前一刀评审过了才发下一刀):
**T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10**

---

### T0 · 验蓝本源 + 三附录 + fixture + tiptap 可测性(**零产品代码**)

**新建**:`p5d-appendix-A-i18n.md` · `p5d-appendix-B-tokens.md` · `p5d-appendix-D-classes.md` ·
`p5d-fixtures/**` · `p5d-task-0-report.md`
**文件数不变 326**(全部落 `.superpowers/sdd/`,`git add -f`)

🔴 **T0 是最值钱的一刀。** P5c 的 T0 从 brief 查出 **7 处**错,全期累计 **25 处**。
错的类型分布:行号偏 1–4 行是常态 · **范围边界错**会让 sass 编译失败 ·
**「某东西会不会出现在产物里」的因果链错**(E-13)· **「键名存在但语义不对」**(E-18,照抄不报错却渲染错)·
**grep 判据分不清该区分的东西**(E-25,会得出**假 Critical**)。

**DoD**

0. 🔴 **第 0 步(在做任何别的事之前):清缓存后重新坐实三门基线** —— 见 **§0.5**。
   跑三门,确认仍是 **326 文件 / 3515 例 / tsc 0 / build 0**。
   **对不上就立刻停下写 `NEEDS_CONTEXT`,不许自己「修」到对得上** ——
   基线错了,后面十刀的 DoD 数字全是错的。报告里写「清缓存后基线复核一致/不一致 + 实测四个数字」。
   ⚠️ 若 `.sp8/NimoOS-Service/dist/` 被清了,**先 `cd ../NimoOS-Service && pnpm build` 重建再跑三门**。
1. 🔴 **蓝本源核验(治理 §1.4 的通用纪律)** —— 协调者已做一遍,**T0 独立复跑并写进报告**:
   `git -C /home/nimo/NimoTech/NimoOS-UI fetch git@github.com:NimoTech/NimoOS-UI.git main`
   (**HTTPS 无凭据必失败**,记忆 `github-fetch-via-ssh`)
   → 记远端 sha → 对本期**全部**蓝本文件(5 个组件 + `knowledge.scss` + `zh_CN.json` + 4 份 spec)做
   `7a6ee6b7` vs 远端的校验和比对 → **把「远端 sha + 逐文件比对结果 + 本期锁 `7a6ee6b7`」写进报告**。
   ⚠️ `fetch` 只写 `FETCH_HEAD`,**不动 `main`/`origin/main`/工作树**(已实测;该仓被 SP7/SP9 并发会话共用)。
   **若比出功能性差异(非注释),停下问用户换不换基准,不许自己决定。**
2. **附录 A(i18n)** —— 99 个 distinct 串的完整表:en 原串 · 蓝本 `file:line` · `zh_CN.json` 权威 zh 值 ·
   新键名(`aiKbNt*`/`aiKbNe*`/`aiKb*`)或复用键名。另需四节:
   - **§A.4 动态 `$t()` 清单** —— 🔴 **本期有 5 处真正的 `$t(非字面量)`**(P5c 是 0 处,**K20 风险回来了**):
     `NotesView.vue:95/121/123` 与 `NoteEditPane.vue:86(第二处)/113`,全部经 `NOTE_TYPES[*].labelKey` 与
     `NOTE_SOURCES[*].labelKey`。**扫描必须扫整个文件而不是只扫 `<template>`**(P5c E-5 的教训),
     且**要显式列出这 7 个 labelKey 值**(`Note item`/`Summary`/`Insight`/`Digest`/
     `Written by you`/`Written by agent`/`Auto-captured`)并证明它们都进了附录 A。
   - **§A.5 全角标点例外清单** —— 实扫 `/[，；：？！（）]/`。⚠️ **至少含 N26 的两组三段式**;
     `。`/`「」`/`·`/`—`/`…`/`×` **不在**那个正则里。
   - **§A.6 占位符键** —— 🔴 **本期占位符全是 `{n}`**;逐条核两档名称集合一致。
   - **§A.7 撞车表** —— 复跑治理 §7.1 的**双向**扫描,**用真实模块导入计键数**。
     🔴 **假定协调者给的 8 组不完整**(P5c 连续三刀每刀都扫出协调者不知道的)。
3. **附录 B(色值)** —— 覆盖治理 §6.1 普查表的**全部 26 行 / 39 处**,一行一处:
   蓝本 `file:line` · 原字面量 · 映射到哪个 token · 该 token 是既有还是新建 · 新建的两档取值 + 蓝本依据。
   🔴 **必须显式包含「模板内联」那两处**(`NotesView.vue:85` 藏在 `:style` 的 JS 对象里、`NoteEditPane.vue:152`)
   —— P5b 的 E-11 就是漏了这一类;**P5c 那期真的是 0,本期不是,别照抄「0」**。
   🔴 **必须为 3 处 `color: #fff` 定死用哪个 token**(治理 §6.3 的 `--on-accent` 坑),实现者不许自选。
   🔴 **K39 的诚实登记**:4 个渐变里**只有 1 个**有仓内逐字同值先例(`--grad-sandbox`),**另 3 个没有** ——
   与 P5c §6.3「4/4 都有出处」不同,**不许把这句照抄过来**。
4. **附录 D(类白名单)** —— 66 个待搬类的完整表 + `WHITELIST_226` → 新常量名与准确增量 +
   `NON_K_HELPER_CLASSES` **保持 10 项**的论证(A-10)+ **§D.6 新增一节:tiptap 可测性结论**(见第 6 条)。
   🔴 **「不搬」清单也要写**:`.k-section-body`(蓝本 `:985-991`,归 P5f)· `.k-progress-*`(N15)·
   `.kn-picked` / `.kn-checkline` / `.kn-mig-*` / `.kn-pick-*`(蓝本 `:2250-2263`,**P5c 已搬,不重复**)·
   `.kn-badge` 5 条(**P5b-T2 已搬,不重复定义**)。**「不搬 ≠ 忘搬」:断言要守得住它们不出现。**
5. **fixture** —— 实测治理 §4.2 的 10 个端点并落盘。🔴 **重点两个**:
   - **409 冲突的真实 body** —— 坐实 `current_revision` 这个字段名(`conflictMessage` 只读它)。
     **若字段名不同,写清后果**(`conflictMessage` 返回 `…revision undefined…` 但仍 truthy → 弹窗仍开;
     Vue2 现状,按 N 系列照抄,**报告要写明**)。
   - **`DELETE` 的状态码与体**(204 空体 → axios 给 `''`;P5b 治理 §4.1 有 axios 源码依据)。
   🔴 **本期探测会真的在 `/DATA/Notes` 里创建 / 修改 / 删除 `.md` 文件** →
   报告必须写「造了哪几条 / 怎么清理干净 / 清理后重新取数确认」。
6. 🔴 **tiptap / ProseMirror 在 jsdom 下的可测性(治理 §9.7)——不给结论就开工 T4 = 计划失败**:
   ① 本仓 vitest(jsdom)能不能真实 `new Editor({extensions:[StarterKit, Markdown]})`;
   ② 不能的话 mock 边界画在哪(推荐 mock `@tiptap/vue-3` 的 `Editor`+`EditorContent`,
   **保留 `storage.markdown.getMarkdown` / `isActive` / `chain().focus()[cmd]().run()` 三个契约形状**);
   ③ **去读本仓既有重 DOM 组件的测试先例**(CodeMirror 的 `src/files/viewers/` 与 `@xterm` 终端面板)。
   ⚠️ 结论若是「必须 mock」,要**同时**给出 K38 两个 emit / §5.3 防回环 / N29 `tbTick` 假依赖
   这三条在 mock 层下**怎么才有判别力**的写法建议 —— 否则 T4 会交出零判别力用例(§9.4 同族)。
7. **kickoff 勘误** —— 复核治理 §12 的 E-26 ~ E-30,**新查出的一律补编号登记**。
8. 🔴 **验蓝本行数**:5 个组件 271/338/47/50/11 + `knowledge.scss` 8 段的**精确边界**
   (协调者给的是 `:2023-2046` / `:2047-2056` / `:2057-2085` / `:2086-2121` / `:2122-2194` /
   `:2195-2241` / `:2242-2249` / `:2265-2281`,**逐个用括号配平复核** —— P5c E-3 就是范围边界错,
   按错的边界复制会**截断规则** → sass 编译报错)。

**不做**:任何 `src/` 下的改动。**T0 的产出全部在 `.superpowers/sdd/`。**

---

### T1 · i18n(92 新键 + 7 复用 + 八组撞车的 en 断言)

**改**:`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts`
**新建**:`.superpowers/sdd/p5d-task-1-i18n-verify.mjs`
**零 `.vue`、零测试文件新增** → 文件数仍 **326**

**DoD**

1. 92 键**同时**进两档(`parity.test.ts` 自动断言键集一致)。zh 值**逐字照抄**
   `git show 7a6ee6b7:src/assets/lang/zh_CN.json`,**不许自己翻译、不许改标点**。
2. 🔴 **跑 `p5d-task-1-i18n-verify.mjs`**(照 `p5c-task-1-i18n-verify.mjs` 写):对 92 条逐 `codePointAt`
   比对语言包 → **92/92 MATCH**;另对 7 条复用键做「现值未被改动」比对 → **7/7 MATCH**。**两段输出贴进报告。**
   (P5a T8 教训:附录零差异,手抄进 TS 时引入 5 处全角标点错。)
3. `messageSyntax.test.ts` 三条守卫**只圈本批 92 键**,不许全量生效:
   (a) 全角标点例外 = 附录 A §A.5,一律 `toBe` 钉死确切值的**强断言**,其余键必须扫不出;
   (b) 带占位符键两档名称集合一致(**本期全是 `{n}`**);(c) 「exactly **92** keys」。
4. 🔴 **八组撞车(治理 §7.1 的 N32-1 ~ N32-8)全部照抄不许统一,且每组要 en 档正/反向断言**
   —— **只比 zh 的断言零判别力**(P5c §9.2 实测:换成被禁键 47/47 全绿)。
   本期最容易被「顺手复用」的三个:**`aiKbNavNotes`**(同区、zh 都是「笔记」)·
   **`aiOpenInFileManager`**(en 只差首字母大小写)· **`filesCopiedPath`**(en 同、**zh 不同**,镜像方向)。
   ⚠️ **N32-8 是 P5d 自己内部的撞车**(`Source` 与 `Sources` zh 都是「来源」)—— **两个键都要建**。
5. 🔴 **K42:4 个相对时间键必须新建,不许复用 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`** ——
   它们的**占位符名是 `{m}`/`{h}`/`{d}`**(`indexedFilesView.ts:53-57`),蓝本用 **`{n}`**,
   复用会渲染出字面量 `{n}`。**唯一可复用的是 `aiKbJustNow`。**
   **落地判据:一条「渲染出真实数字而非字面量 `{n}`」的用例 + 一条反向断言(不等于既有键的 en 值)。**
6. 🔴 **复跑双向撞车扫描**(§9.3 第 1 条),**用真实模块导入计键数**(§9.3 第 2 条,基线 1503)。
   **假定协调者的 8 组不完整** —— 新扫出的补进附录 A §A.7 并同样配 en 断言。
7. **N23 / N22 家族:不许给技术串补 i18n 键。** 本期至少 3 处:
   `conflictMessage` 的英文串(**N23**,只当布尔谓词用)· `NoteEditPane.vue:56` 的 `Markdown` 按钮文字 ·
   `:68` 的 `WYSIWYG` / `.md source`。**照抄成裸字符串。**
8. 报告列清「复用 7 / 新增 92 / Vue2 有权威 zh 值 92 / 本期新造 0 / **死键 N 条(逐条列出)**」。

---

### T2 · `knowledge.scss` 66 类 + K39 新 token + 守卫(§9.6 + A-11)

**改**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`
**零 `.vue`、零测试文件新增** → 文件数仍 **326**

**搬**(附录 D 是权威,行号 T0 已逐个配平复核):

| 段 | 蓝本 | 落法 |
|---|---|---|
| 共享底座残余 | `:2029`(`.knowledge-app .k-badge[data-tone="warn"]`)· `:2040-2045`(`.kn-type-ic` / `.kn-src` / `.kn-tag`) | K9 嵌进 `.knowledge-app`。🔴 **`.kn-badge` 5 条(`:2031-2039`)P5b-T2 已搬,不重复定义** |
| path strip | `:2047-2056` | 同上 |
| draft inbox | `:2057-2085` | 同上 |
| notes list | `:2086-2121` | 同上 |
| edit pane | `:2122-2194`(**含 `:2171-2182` 的 `.kn-editor-body-wrap .nme-content .ProseMirror`**) | 同上 |
| edit aside | `:2195-2241` | 同上 |
| conflict modal | `:2242-2249` | 同上 |
| responsive | `:2265-2281` | 同上(⚠️ 它是 `@media` 块,K9 的嵌法要与既有 responsive 段一致) |
| **`.k-seg`(K43)** | `:551-571`(21 行,零色字面量) | K9 嵌进 `.knowledge-app`。🔴 **P5e 的 `SearchView` 也要用,本期搬完 P5e 不许重复搬** |
| **ProseMirror 顶层段(K44)** | `NotesMarkdownEditor.vue:41-46` | 🔴 **保持顶层裸选择器**(治理 §6.2 的唯一例外),紧邻上面那段,注释引「治理 §6.2 / K44」 |

🔴 **不搬**:`.k-section-body`(`:985-991`,归 P5f)· `.k-progress-*`(`:1152-1157`,N15)·
`:2250-2264` 的 `kn-*`(P5c 已搬)· `.kn-badge`(P5b-T2 已搬)。**断言要守得住它们不出现。**

**K39 新 token**(附录 B §B.0 是权威,**协调者只定政策**):
- **先找语义最近的既有 token**;`--warning-soft` / `--success-soft` / `--danger-soft` / `--accent-soft` /
  `--bg-chip` / `--bg-sunken` / `--bg-elevated` / `--line` / `--line-faint` / `--text-*` / `--shadow-xs`
  **都已在两档声明,直接用**(A-9:透明度差异按 A11 同族,不开小灶)。
- 新建的每一个:① **两档都显式写值**;② 声明处注释写明**蓝本 `file:line`**;③ 附录 B 有对应行。
- 🔴 **`#FF9500,#FFCC00` 一个 token 两个消费方**(`NOTE_TYPES.insight` + `.kn-inbox-icon` 蓝本 `:2066`),
  **不许声明两份**。
- 🔴 **诚实登记**:4 个渐变里只有 `#5AC8FA,#007AFF` 有仓内逐字同值先例(既有 `--grad-sandbox` /
  `tokens.scss:236` 的 `--grad-sk-blue`),**另 3 个没有** —— 蓝本是值的权威源,但**不许把 P5c
  「4/4 都有出处」那句照抄过来**。

**守卫改动**(治理 §9.6)

1. 🔴 **「没有搬多」扫描正则(`:198`)本期两件事一起做**:
   ① 扩到也扫 `nme(?:-…)?` 与 `ProseMirror`;② **字符集加 `A-Z`,兑现 P5c §6.4.2 那张债票(A-11)**。
   🔴 **必须程序化证明新正则是旧正则的严格超集**(照 P5c §6.4.1 第 1 条:`old ⊆ new`,零断言放宽)。
   **RED 探针**:临时塞 `.kn-foo { }` → 报红;临时塞 `.fb-Foo { }` → **报红(这是 A-11 的判别力证据)**;
   还原。⚠️ **探针注入与断言两侧都要行首锚定 + 先 `stripComments`**(P5c §9 第三条,写侧事故)。
2. 🔴 **`nonKClassNames`(`:245`)的排除条件加 `nme` / `nme-content` / `ProseMirror`**,
   `NON_K_HELPER_CLASSES` **保持 10 项不变**(A-10)。注释写明每个的出处。
   **在 `:263` 那条集合相等断言上做 RED 探针**(临时塞一个真·嵌套辅助类 → 报红 → 还原)。
3. **白名单 `WHITELIST_226` → 新常量名**(准确增量与名字见附录 D §D.0;**名字跟着数字改**是本档既定习惯)。
4. 🔴 **K44 的顶层例外要有集合相等断言**(治理 §6.2 第 2 条):
   「顶层裸选择器**恰好只有** `.nme-content .ProseMirror` 这一条」—— **不是「排除掉就算了」**。
   **RED 探针**:临时加第二个顶层裸选择器 → 必须报红。
5. 🔴 **`DARK_TOKEN_SELECTOR`(`:312`)/ `LIGHT_TOKEN_SELECTOR`(`:313`)本期不动**
   —— K39 只往块里加 token,不改选择器。**报告要显式确认这两行一字未改。**

**额外门**:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0
**注**:本期 scss 全进 `knowledge.scss`,而它由 `KnowledgeLayout.vue` 早已 import →
**CSS 侧从本刀起就会进产物**(不同于 P5c 的新文件)。**`pnpm build` 后 `grep -o "kn-note-row" dist/assets/*.css` 本刀就该命中** ——
🔴 **JS 侧的「入口可达」核验归 T10**(承 P5c E-13)。

---

### T3 · util 两份(`notesViewHelpers.ts` + `noteEditHelpers.ts`)

**新建**:`src/ai/knowledge/util/notesViewHelpers.ts` · `notesViewHelpers.test.ts` ·
`src/ai/knowledge/util/noteEditHelpers.ts` · `noteEditHelpers.test.ts`
→ 文件数 **326 → 328**;零 `.vue` 新增

**内容**:蓝本 `notesViewHelpers.js`(50 行:`NOTE_TYPES` / `noteTypeMeta` / `NOTE_SOURCES` /
`noteSourceMeta` / `statusBadge` / `applyFilters` / `relativeTime`)+ `noteEditHelpers.js`(11 行:
`parseTags` / `conflictMessage`)。

**DoD**

1. 🔴 **K40:`NOTE_TYPES[*].color` 改成 `'var(--grad-note-*)'` 字符串**(token 名以附录 B 为准)。
   **`color-guard.test.ts` 压根不扫 `.ts`** → **必须补一条定向断言**:
   四个 `color` 值都形如 `var(--…)`,零 `#` / `rgb(` / `rgba(` / 具名色。**必配 RED 探针。**
   (这是「产品代码对、守卫为零」的**预防式**堵法,不是事后补。)
2. 🔴 **`relativeTime` 用 `i18n.global.t(...)`**,先例 `indexedFilesView.ts:31/51-58`。
   **不许改用 `useI18n()`**(不在组件 setup 上下文里会抛)。
3. 🔴 **`relativeTime` 的测试用 vitest 假时钟,禁真实时间**(治理 §9.8)。
   4 个边界(60 / 3600 / 86400 / 86400×30 **秒**)**两侧都要用例**;第 5 档走 `toLocaleDateString()` →
   **断言不许钉死具体字符串**(输出依赖环境 locale/TZ),用「等于 `new Date(unixSec*1000).toLocaleDateString()`」同式比对。
   ⚠️ **`unixSec` 是秒不是毫秒**(蓝本注释 `:41`)—— **喂毫秒会全部落进第 5 档、用例假绿。**
   ⚠️ `if (!unixSec) return ''` 那条早退:`0` / `undefined` / `null` 三个输入都要用例。
4. **承接 Vue2 既有 spec 的行为**(治理 §4.3):
   - `notesView.spec.js` 3 条 → `statusBadge` 三分支 + `applyFilters` 的 type/status 独立 + `'active'` 语义。
     🔴 **`statusBadge` 全仓零生产消费者 —— 照抄导出 + 照抄这 3 条用例,不许因为「没人用」就删**(K7 同族:反转不删)。
     报告要显式写「零消费者已知,故意保留,依据治理 §4.3」。
   - `noteEditHelpers.spec.js` 2 条 → `parseTags` 的分割/去空格/去重 + `conflictMessage` 只认 409。
     🔴 **N23:`conflictMessage` 的英文串照抄不进 i18n**,但 `.toContain(rev)` 那条行为要承接
     (串里必须出现 revision)→ **不许简化成 `return true`**。
     `parseTags` 分隔符是 `/[,\s]+/` —— **逗号与空白都算**,`' a, b ,a  c,'` → `['a','b','c']`。
   - `applyFilters` 的三档 status 语义:`''` = 全部 · `'active'` = 非 archived · 其余 = 精确匹配。**三档都要用例。**
5. **`noteTypeMeta` / `noteSourceMeta` 的兜底分支**(`|| NOTE_TYPES.note` / `|| NOTE_SOURCES.human`)——
   未知 type / 未知 createdBy / `undefined` 三个输入都要用例。
6. **零 `any`**;`vue-tsc` 0。

---

### T4 · tiptap 依赖(K37/§14)+ `NotesMarkdownEditor.vue`

**改**:`package.json` · `pnpm-lock.yaml`(§1.1 已显式解禁)
**新建**:`src/ai/knowledge/components/NotesMarkdownEditor.vue` · `NotesMarkdownEditor.test.ts`
→ 文件数 **328 → 329**;`.vue` **179 → 180**,color-guard **+1**

**DoD**

1. 🔴 **装依赖照治理 §14 五条**:只装那四个、**锁 v2 线**、`pnpm list` 核实真装的是 `2.x`/`0.6.x`、
   `git diff package.json` 只有四行新增、**装完 kill 重起 dev server `:5288`**。
   **报告贴 `pnpm list` 输出 + `git diff --stat package.json pnpm-lock.yaml`。**
   ⚠️ **装成 3.x 按 Critical**(K37:`tiptap-markdown@0.9.0` 的 peer 是 `@tiptap/core@^3.0.1`)。
2. 🔴 **K38 三件事**:`@tiptap/vue-2` → `@tiptap/vue-3` · `beforeDestroy` → `onBeforeUnmount` ·
   **v-model 契约 `value`/`input` → `modelValue`/`update:modelValue` 且**保留** `input` 事件**。
   **`input` 必须保留**:父组件写的是 `<NotesMarkdownEditor v-model="form.body" @input="dirty = true"/>`,
   Vue 3 里 `@input` 是**另一个**监听器 → 子组件必须**同时**发两个 emit,否则「打字后标记为脏」丢失。
   🔴 **落地判据:两个 emit 各一条用例,拿掉任一条报红。**
3. 🔴 **§5.3 的防回环不许删**:`watch modelValue` 里先比对 `editor.storage.markdown.getMarkdown()`
   再 `setContent(v)`。**判据:一条「父组件把同一个 markdown 值写回来时 `setContent` 不被调用」的用例。**
4. **`onTransaction` → `emit('transaction')`**;`mounted` 末尾 `emit('ready', editor)`。
   这两个是 N29(父组件工具栏 active 态)与 `cmd()` 的生命线,**顺序照抄**。
5. 🔴 **K44:`.vue` 侧零 `<style>` 块**,样式已在 T2 进 `knowledge.scss`;
   **JS 侧不需要 side-effect import**(`knowledge.scss` 由 `KnowledgeLayout.vue` 已 import)——
   **与 P5c 的 `parser-styles.scss` 不同,别照抄那条 import。报告要显式说明为什么不需要。**
6. 🔴 **测试写法按 T0 §D.6 的结论**(治理 §9.7)。若走 mock 路线:
   保留 `storage.markdown.getMarkdown` / `isActive` / `chain().focus()[cmd]().run()` 三个契约形状,
   **并为上面第 2/3/4 条各附一次变异证据**(改产品代码 → 用例真报红),否则就是零判别力用例。
7. **缺口③**:补一条「`<template>` 块零裸色」定向断言(本文件模板极短,但**照惯例补**)。

---

### T5 · `openInApp.ts` 补两函数(§16)+ 票 3 守卫债(§15.3)

**改**:`src/ai/services/openInApp.ts` · `src/ai/services/openInApp.test.ts` ·
`src/ai/styles/knowledgeStyles.test.ts`
**零新建文件** → 文件数仍 **329**

🔴 **本刀是「加强守卫 + 补两个纯函数」,`src/` 下非测试文件的产品逻辑改动只有 openInApp 那两个新导出。**

**半一:`openInApp.ts`(治理 §16)**

1. `openDirInNewTab(dirPath)` —— **逐字照抄蓝本 `:52-55`**,`filesPathUrl` 用**本仓既有的那个**(`:41-43`)。
   **既有 7 个导出一字不动。**
2. `agentSessionUrl(sessionId)` + `openAgentSessionInNewTab(sessionId)` ——
   🔴 **按 A-8 指向旧 Vue2 应用 `/#/ai/agent?session=…`(无 `/app` 前缀)**,
   加与 `photosAssetUrl`(`:37-39` + 文件头 `:5-9`)**同款的申报注释**。
   🔴 **测试:URL 逐字断言 + 反向断言不等于 `/app/#/ai/agent?session=…`**(否则将来有人「顺手统一前缀」会静默退化)。
3. **`!dirPath` / `!sessionId` 的早退**两侧都要用例(`window.open` 不被调用)。
4. ⚠️ **不许连 `openNoteInNewTab`(蓝本 `:112-115`)一起补** —— 本期无调用点,补了就是死代码。**登记进 P5e/P5f 交接项。**
5. **开一张票**:New-UI Agent 页补 `?session=` 深链(A-8)。

**半二:票 3 守卫债(治理 §15.3)**

6. 🔴 **具名色扫描** —— 中央 ③′ 守卫与 `color-guard.test.ts` 都不扫 CSS 具名色。
   **必须钉「属性值位置」**(只在 `color:` / `background:` / `background-color:` / `border-color:` /
   `border:` / `box-shadow:` / `fill:` / `stroke:` 等的**值**里找),排除复合属性名与连字符词。
   🔴 **RED + 反向探针两头验**:① 塞 `color: white` → **必须报红**;
   ② `QueueView.vue:474` 的 `white-space: nowrap` → **必须不报红**(P5c §6.5 点名的冤枉点)。
7. 🔴 **覆盖范围扩到 `src/ai/components/**`** —— 中央 ③′ 现在只覆盖 `src/ai/knowledge/**`。
   ⚠️ **扩范围可能扫出既有违规**(那些文件是 P2a/P2b 的产出、不在本期范围)。
   **若真扫出:停下写 `NEEDS_CONTEXT` 给协调者,不要自己改 `src/ai/components/**` 里的文件。**
8. **报告要证明 `src/` 下非测试文件除 `openInApp.ts` 外零改动。**

---

### T6 · `NotesView.vue`(271 行)

**新建**:`src/ai/knowledge/views/NotesView.vue` · `NotesView.test.ts`
→ 文件数 **329 → 330**;`.vue` **180 → 181**,color-guard **+1**

**本刀范围**:整个 `NotesView.vue` —— pathstrip(`:8-16`)· 骨架屏(`:19-28`)· 空态(`:31-38`)·
草稿收件箱(`:42-76`)· 工具栏(`:79-99`)· 列表(`:102-142`)· 删除确认弹窗(`:147-175`)·
全部 script(`:180-266`)。

**DoD**

1. 🔴 **K1:`service.notes.list({limit:200})` 返回**已归一化的 `Note[]`**,不是 `{notes:[]}` 信封**(治理 §4.1)。
   `service.notes.getSettings()` 返回 **camelCase 且只有 `{notesRoot, autoExtract}` 两个字段**。
   **mock 搞反了按 Critical 报。**
2. 🔴 **§5.2 的过期守卫:`reload()` 必须加,且守两件事**(K15 同族第 8 次)——
   3 个并发入口(`created` / `watch editingId` 变空 / 5 个动作各自 `reload()`),
   `loading = false` 被先完成的提前清掉会让**骨架提前消失、用户可见**。
   ① 交错用例(先发后至不覆盖);② **「两实例交错」用例** ——
   **判据:把守卫变量挪到模块级,这条必须报红**(P5c §9.1)。**inline 写,不抽公共 guard。**
3. 🔴 **N30 两条一起**:`watch editingId` **只在变空时** `reload()` + `:key="editingId"` 不许删。
   **两条各一条用例**(切到另一条笔记时不 reload、但子组件重建)。
4. **N24 照抄算术内联样式**(骨架 4 行的 `(52 - i*8)%` / `(72 - i*6)%`、`cursor: default`)。
5. **N31 照抄 `confirmAll`**:`Promise.all` 并发 + 无 `finally` + 失败也 `reload()`。
   **部分成功的用例要有**(toast 报失败 + 列表仍刷新)。
6. **N25 照抄整句带 `{n}` 的列表脚注**,不许拆成三段拼接。
7. **K3:`store.actions.toast(...)` → 全局 `useToast()`**;
   **`store.actions.setNotesDraftCount(n)` 照抄调用**(`knowledgeStore.ts:509`,**store 全期零改动**)。
8. 🔴 **`openDirInNewTab(notesRoot || '/DATA/Notes')` 用 T5 的新函数**;
   `notesRoot` 的 `created()` 取数失败要**静默兜底**(蓝本 `:215` 是空 catch + 注释 `keep placeholder`)——
   **照抄,连 `console.error` 都不加**(K6)。
9. **`editingId` 来自 `route.query.id`** —— 🔴 **`?id=` 深链要 watch 每个键各自的 getter**
   (记忆 `newui-router-query-only-no-remount`:只写在 `onMounted` 里、用户改地址栏一行都不跑)。
   **「地址栏直接改 `?id=`」的用例要有。**
10. **§9.9 的可点性清单**:`drafts.length` / `notes.length` / `filtered.length` /
    `n.status === 'draft'` / `n.status !== 'archived'` 五个条件的**两侧**都要用例。
11. **缺口③**:补「`<template>` 块零裸色」定向断言。
    🔴 **本刀有 1 处模板内联色**(`:85` 的 `background: 'rgba(255,149,0,.14)'`,**藏在 `:style` 的 JS 对象里**)——
    按附录 B 换成 token,**并确认这条断言真能扫到 `:style` 对象里的值**(不只是 `style=` 属性字符串)。

---

### T7 · `NoteEditPane.vue` 上半(顶栏 + 草稿横幅 + 主列编辑器)

**新建**:`src/ai/knowledge/components/NoteEditPane.vue` · `NoteEditPane.test.ts`
→ 文件数 **330 → 331**;`.vue` **181 → 182**(收官),color-guard **+1**

**本刀范围**(蓝本):顶栏(`:7-22`)· 草稿横幅(`:25-32`)· 主列(`:35-71`:标题/描述输入 +
`kn-editor` 工具栏 + rich/md 双模式 + 状态栏)· 对应 script(`props` / `data` / `isNew` / `status` /
`wordCount` / `created()` / `onEditorReady` / `tbActive` / `cmd` / `save` / `curateInPlace`)。
**下半(侧栏 5 卡 + 标签编辑 + 冲突弹窗)归 T8** —— 本刀模板里那两块**先不写**(不留占位符,T8 插进去)。

**DoD**

1. 🔴 **K41 类型收窄**:`Note.tags` 是 `unknown[]` → `as string[]`;`Note.body` 是 `unknown` → `as string | undefined`;
   `revision?` / `status?` / `type?` 是 optional。**每处在文件头注释里登记「包侧类型 → 本仓收窄 + 字段依据(蓝本哪一行读了它)」。**
   🔴 **禁 `as any`**;若某处需要**运行时**校验才安全,那就不是 K41,要单独申报。
2. 🔴 **N29:`tbActive` 里的 `tbTick.value >= 0 &&` 是故意的假依赖,不许删。**
   **判据:一条「触发 `transaction` 事件后工具栏 `data-on` 跟着变」的用例;删掉那半必须报红。**
   **这是本刀最容易被「顺手清理」的一行。**
3. **N27:`:17` 的四档三元嵌套照抄**(`Saving… / Unsaved changes / Not saved yet / Saved · rev {n}`),
   **四档都要用例**。不许改成 computed 映射表。
4. **N26:`:28` 的三段式拼接照抄**(三个独立键 + 中间加粗),不许合成带 HTML 的键、不许用 i18n slot。
5. **N28:`wordCount` 正则 `/[#|\-*`>\s]/g` 照抄**,不许「修正」成 markdown 感知的计数。
   **边界用例**:空 body / 全是被剥字符 / 混合。
6. 🔴 **`data-on` 与 `data-dirty` 全部照抄 `String()`**(蓝本 `:15/43/44/45/47/48/50/51/52/55/56`)——
   P5b E-9 已裁定:套不套渲染一致,改写 = 无关重构。**断言 `toBe('true')`/`toBe('false')`,禁 `toBeUndefined()`。**
7. 🔴 **§5.2 的过期守卫:`created()` 两发(`get` + `backlinks`)必须加,且守两件事。**
   `:key="editingId"` 会重建实例 → **「两实例交错」用例在这里尤其真实。**
8. **`save()` 的两条路**:`isNew` → `create` + `router.push('?id='+n.id)`;
   否则 → `update({expectedRevision: note.revision, …})`。**`addTag()` 在 `save()` 开头被调用**(`:273`)——
   「输入框里有未提交的标签,点保存时会被带上」这条行为要有用例。
9. **`save()` 的 catch 分岔**:`conflictMessage(e) && !isNew` → `openConflict()`(**T8 实现弹窗**,
   本刀只到「`conflict` state 被设上」)· 否则弹 `aiKbOpFailed`。
   🔴 **K5/K30:不许把后端 `e.message` 拼进 toast** → **排除式断言**(DOM/toast 必须不含后端文本)。
   ⚠️ 蓝本 `:296` 确实拼了 `e.message`,**本仓按 K5 既定模具只弹固定文案** —— 显式申报。
10. **`:disabled="saving || (isNew && !form.title.trim())"`** —— 三种组合都要用例(§9.9)。
11. **缺口③**:补「`<template>` 块零裸色」定向断言。⚠️ **本刀模板无内联色**(那 1 处在 `:152`,归 T8)。

---

### T8 · `NoteEditPane.vue` 下半(侧栏 5 卡 + 标签编辑 + 冲突弹窗)

**改**:`NoteEditPane.vue` · `NoteEditPane.test.ts`
→ 文件数仍 **331**

**本刀范围**(蓝本):侧栏(`:74-144`:状态卡 / 磁盘文件卡 / 属性卡 / 来源卡 / 被引用卡)·
冲突弹窗(`:148-180`)· 对应 script(`sourceRefs` / `focusTagInput` / `addTag` / `removeTag` / `onTagKey` /
`refLabel` / `openRef` / `openSessionRef` / `revealFile` / `copyPath` / `openConflict` / `copyMine` /
`adoptDisk` / `keepMine`)。

**DoD**

1. 🔴 **K41 的另一半**:`Note.sourceRefs` 是 `unknown[]` → 本地 `interface SourceRef { path?: string; session_id?: string; label?: string }`;
   `service.notes.backlinks()` 返回 `unknown[]` → 本地 `interface Backlink { id: string; title: string }`。
   **字段依据要引蓝本行**(`:128` 读 `r.path` · `:131` 读 `r.session_id` · `:132` 经 `refLabel` 读 `r.label` ·
   `:139-141` 读 `b.id` / `b.title`)。
2. 🔴 **`service.notes.backlinks` 返回**数组**(空时 `[]`),不是 `{backlinks:[]}` 信封**(治理 §4.1)。
3. **`onTagKey` 三条分支**:`Enter` / `,` → `preventDefault()` + `addTag()`;
   `Backspace` **且输入框为空且已有标签** → 弹掉最后一个 + `dirty = true`。**三条各一条用例 + 反例**
   (`Backspace` 但输入框非空 → 不弹)。
4. **`addTag()` 的去重**:`parsed.filter(t => !form.tags.includes(t))`,**只有 `fresh.length` 才置 `dirty`**
   —— 「输入一个已存在的标签 → `dirty` 不变」这条要有用例。
5. 🔴 **冲突弹窗的三个动作照抄语义**:
   - `adoptDisk()`:`note = latest` + `form.body = latest.body || ''` + **`dirty = true`**(蓝本 `:321`)
   - `keepMine()`:**只 rebase revision**(`note = {...note, revision: rev}`),body 不动 + `dirty = true`
     + toast 带 `{n: rev}`(蓝本 `:324-330`,注释原文「Rebase onto the disk revision so the next save overwrites it」)
   - `copyMine()`:`navigator.clipboard.writeText(form.body || '')`
   **三个各一条用例,`dirty` 的值都要断言。**
6. 🔴 **`navigator.clipboard` 在 HTTP-IP 下不存在**(治理 §9.9 / 记忆 `newui-clipboard-insecure-reka`)——
   `copyPath` 与 `copyMine` **真机会走 catch 弹「操作失败」**。
   **按 N 系列照抄,不许顺手加 `execCommand` 兜底**(那是 Files 区的既有增强,不是笔记区蓝本行为)。
   **但要:① 写一条 catch 分支用例;② 在验收清单里写明「HTTP 访问下弹操作失败 = 预期」;③ 开一张前端票。**
7. 🔴 **弹窗要不要转 reka?** —— **裁定:转**,照 K7/K29 同族(蓝本 `:149` 是裸 `.k-modal-bg` + `@click`/`@click.stop`)。
   `DialogPortal to=".knowledge-app"`,**测试自己在 body 备宿主**(先例 `QueueView.test.ts:127-130` 的 `withHost()`)。
   🔴 **`DialogTitle` 用 `as-child` 套在蓝本自己的 `.k-modal-title` 上,不加 `VisuallyHidden`** ——
   **K36 逐字适用**(本弹窗蓝本 `:155` 就有可见标题)。**并按票 2 的先例补 a11y 常驻断言**
   (`aria-labelledby` 与 `.k-modal-title` 的 `id` 同值同元素)。
   ⚠️ **T6 的删除弹窗同款** —— 若 T6 没转,T8 要在报告里指出不一致并请协调者裁定。
8. **§9.9 可点性**:来源卡 `v-if="!isNew && sourceRefs.length"` · 被引用卡 `v-if="!isNew && backlinks.length"` ·
   磁盘文件卡的 `<template v-else>`(即 `!isNew`)—— **每个条件两侧都要用例**。
9. **`refLabel(r)`**:`r.label || String(r.session_id || '').slice(0, 8)` —— 三种输入都要用例。
10. **缺口③**:🔴 **本刀有 1 处模板内联色**(`:152` 的 `style="… background: rgba(255,149,0,.14) …"`)——
    按附录 B 换成 token,断言要扫到。
11. 🔴 **T8 不许动 T7 的断言** —— 若某条 T7 用例因插入下半而「测错东西」(P5c E-22 同族:
    同名容器类的定位器在插入第二个同类区块后会先命中错的),**那是被迫改动、要逐处给 `git diff` 的 `-` 行自证**,
    并在报告里写「除这 N 处外 T7 的东西一字未动」。
    **预防**:T7 写定位器时就**钉到唯一祖先或用 `data-testid`**,不许靠「文件里只有一个」这种隐含前提。

---

### T9 · 票 1 导航入口 + 票 2 注释债 + K36 a11y 常驻断言

**改**:`src/ai/views/SettingsPage.vue` · `SettingsPage.test.ts`(票 1)·
`src/ai/knowledge/parser/ParserStatus.test.ts` · `ParserTest.test.ts` · `src/ai/knowledge/views/SettingsView.test.ts`(票 2)
→ 文件数仍 **331**

🔴 **五个文件全在 P5c 的全期零改动清单里 → 本刀是显式解禁的例外**(治理 §1.1 / §15.2)。
**每个文件只许改指定的那几行,报告要逐文件给「其余一字未动」的自证。**

**半一:票 1(治理 §15.1)** —— **本期最高优先级**

1. `SettingsPage.vue:417` 的「详情」从 `<button class="set-detail-link" @click="onDetailsClick">`
   **反转回** `<router-link class="set-detail-link" to="/ai/knowledge">` ——
   照 `knowledgeRoutes.ts` 那**四次**「反转不删、改前原文留成注释」的先例。
   🔴 **内容物一字不动**:`{{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />`
   —— **文案键仍是既有的 `aiCfgDetails`,本刀零 i18n 改动**;图标仍是 `AgentIcon`(**不是 `KIcon`**,
   这是设置区的组件)。**`:415-416` 那两行占位注释一并订正**(见第 5 条)。
2. 🔴 **`.set-detail-link` 类名与视觉不动**;`settings-styles.scss:73-74` **一行不许动**
   (它已含 `text-decoration: none` → `<a>` 渲染后视觉一致)。
3. 🔴 **`onDetailsClick` 删掉,原文留成注释**(治理 §15.1 第 3 条的裁定)。
   **`DEFERRED_SECTIONS` 占位机制本身不许碰。**
4. 🔴 **`SettingsPage.test.ts:239` 那条用例必须改**(它现在断言弹 toast)→
   改成断言 `.set-detail-link` 是一个 `to="/ai/knowledge"` 的 `RouterLink`。
   **RED 探针:改回占位 `<button>` + toast → 新断言必须报红。**
5. **订正 `SettingsPage.vue:26-29` 那段注释**(它现在还说「`/ai/knowledge` 要到 SP8-P5 才存在」)→
   🔴 **「带时点的历史记录 + 现状 + 引治理条目编号」**(引「治理 §15.1 / P5c §8.5」,
   **不引文件:行号** —— 行号会随后续改动失效)。

**半二:票 2(治理 §15.2)**

6. **3 处过期注释**:`ParserStatus.test.ts:206`(🔴 **双重过期**:说「仍指占位页」已反,
   且引的 `knowledgeRoutes.ts:63` **行号已变 `:78`**)· `ParserTest.test.ts:180` · `SettingsView.test.ts:213`。
   改法同 P5c T10 注释轮。🔴 **只改注释** —— 报告给「非注释行改动为 0」的自证(`git diff` 逐行 + 三门数字不变)。
7. **K36 a11y 常驻断言**:补 3 行进 `SettingsView.test.ts`(先例 `IndexedFilesView.test.ts:1947`),
   钉 `aria-labelledby` 与 `.k-modal-title` 的 `id` 同值同元素。
   ⚠️ **`SettingsView.test.ts` 只许加这 3 行 + 上面那 1 行注释。**

---

### T10 · 路由反转 + `DEFERRED_TABS` 摘 `notes` + 收官

**改**:`src/ai/knowledge/deferred.ts` · `knowledgeRoutes.ts` · `knowledgeRoutes.test.ts` · `deferred.test.ts`
→ 文件数仍 **331**

1. `DEFERRED_TABS`(`deferred.ts:28-34`)摘 `'notes'`:**5 → 4**(剩 `search` / `wiki` / `roots` / `allowlist`)。
   按 T12 / P5b T5 / P5b T10 / P5c T10 的先例在文件头加本期注释。
2. `knowledgeRoutes.ts:74` 的 `notes` 子路由 `KnowledgeDeferred` → 真 `NotesView`(import 加在 `:52-60` 那组)。
3. 🔴 **两条断言的精确坐标(协调者实测)**:
   - `deferred.test.ts:46-47` 的 `expect([...DEFERRED_TABS].sort()).toEqual(['allowlist','notes','roots','search','wiki'])`
     → 改成 **4 项** `['allowlist','roots','search','wiki']`;
   - `knowledgeRoutes.test.ts` 的「其余子路由仍是 `KnowledgeDeferred`」那条(该文件 `:32-131` 已有
     **四代**改前原文注释的完整谱系)→ 反转 `notes` 那一项。
   🔴 **反转,不删**;改前原文留成注释 + 写清为什么(照那四代先例的格式)。
   **K7 占位机制本身保留**(承 P4 I2 教训:清空后要仍有用例证明它有能力)——
   `deferred.test.ts:60-69` 的「机制钉子」用例**一字不许动**。
4. 🔴 **兑现治理 §15.1 的「通用教训」**:在 `deferred.ts` 文件头注释里
   **逐项写明剩下 4 个占位项归哪一期反转**(`search`→P5e;`wiki`/`roots`/`allowlist`→P5f)。
   **这是「跨期占位烂尾」这类债的制度性堵法,不是可选项。**
5. 🔴 **本刀承接「构建管线」额外门**(承 P5c E-13):路由反转后 `pnpm build`,
   `grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js` —— **T10 前应搜不到、T10 后命中**
   (`.vue` 光「存在且写了 import」进不了产物,还得**被入口可达地 import**)。
   ⚠️ **CSS 侧从 T2 起就在产物里**(`knowledge.scss` 由 `KnowledgeLayout.vue` 已 import)——
   **别把 CSS 与 JS 混为一谈**(P5c E-8)。
   🔴 **判据必须选择器/上下文感知**(承 E-25):别用能同时命中注释与真代码的裸子串。
6. **收官三门**:应是 **331 文件 / (3515 + 3 + 各刀新增) 例全绿** · tsc 0 · build 0。
7. 报告给**收官口径**:文件数 / 用例数 / `.vue` **182** / color-guard **+3** 已体现 /
   `aiKb*` 键数 / 全表键数。

---

## 每刀通用要求(治理文件里已有,这里只列最容易漏的)

- **三门全量**,输出**完整落盘不许 `| tail`**;报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **提交前** `git show --stat HEAD` + `git status` 自查;台账/报告 **`git add -f`**;禁 `git add -A`/`.`。
  🔴 **碰 gitignore 产物(`dist/`、`node_modules/.vite/`)时 `git status` 不构成任何证据** ——
  还原的唯一证据是 md5/diff + **强制干净重建 + 全目录 diff**(P5c §1.3.1:有污染活了三天)。
- **报告要显式申报本刀命中的每一条 K1–K44 与 N1–N32**,以及**用了哪几个 fixture、mock 形状取自哪一层**。
- **RED 探针**:凡本计划书写了「必配 RED 探针」的,报告要贴**两段输出**(报红 + 还原后转绿)与 `git status` 干净证明。
  🔴 **还原禁用 `git checkout -- <path>` / `git restore`**(会连未提交编辑一起抹掉,P5c §9.5 险情)——
  只许「先存副本 → 注入 → 用副本覆盖 → md5 比对」。
  🔴 **探针注入本身也要行首锚定 + 先证注入真落盘**(P5c §9,写侧事故:注入撞注释会伪造出「守卫无效」的假结论)。
- **评审最低 sonnet、禁 haiku**;评审不许采信实现者报告、不许改仓库、不许提交任何东西,
  全文写 `p5d-task-N-review.md`,返回 ≤25 行。
- 🔴 **评审的「缺口猎」是常规动作,不是加分项** —— P5c **五次猎中,全部是「产品代码对、守卫为零」**。
  **本期已知的高危裸奔点**:K40(`.ts` 里的渐变,`color-guard` 不扫 `.ts`)·
  §6.1 那 2 处模板内联色 · §9.6 的三个非 `k*` 类 · §9.7 若走 mock 路线时 K38/N29/§5.3 三条的判别力。
- **拿不准写 `NEEDS_CONTEXT` 并停下**,不要自己拍。

## 验收清单(T10 之后由协调者写)

必须遵守治理 §13 四条:

1. 🔴 **第一项永远是「这一屏怎么从产品的正常导航走到」**(§13.4)。
   本期必须写:AI 设置页顶栏「详情」→ `/ai/knowledge` → 左栏第 4 项「笔记」(**T9 修完票 1 之后才成立**);
   编辑页靠**列表行点击**(`?id=<id>`)、新建靠**「新建笔记」按钮**(`?id=new`)——
   **给出可直接粘贴的两个 URL。**
2. 🔴 **「点某个东西」的项先确认该元素在本机数据下真渲染成可点元素** ——
   §9.9 已点名 **11 个高危点**,逐个照抄进清单。
   **最要紧的三个**:草稿收件箱整块 `v-if="drafts.length"`(零草稿 → 整块不渲染)·
   来源卡/被引用卡(大概率不渲染)· **冲突弹窗只在 409 后开,要人为造并发**(两个标签页同开一条、一边先存)。
3. 🔴 **凡会写后端 / 改设备状态的项标红 + 写「验完怎么恢复」** ——
   🔴 **本期比 P5c 更狠:笔记的写操作会在 `/DATA/Notes` 里真的创建 / 修改 / 删除 `.md` 文件。**
   至少 6 处:新建 · 保存 · 确认 · 归档 · **删除(磁盘 `.md` 一并删除,不可恢复)** · 批量「全部确认」。
   **删除那条必须写「请只删你自己在验收时新建的那条」。**
4. 具体计数写「**实测于 YYYY-MM-DD,数字会漂,以下列命令现测为准**」+ 附取数命令,别钉死数字。
5. 🔴 **A-9 + P5c A11 合并成一条显式确认项**:浅档 `--warning-soft` / `--success-soft` / `--danger-soft` /
   `--accent-soft` 的透明度比 Vue2 深/浅,吃在草稿徽标、收件箱底色、确认按钮 hover、冲突弹窗两栏底色上。
   **请用户看实物后拍板;要改是独立的 token 决策票,不夹在本期。**
6. 🔴 **写明「HTTP 访问下『复制路径』/『复制我的正文』弹操作失败 = 预期」**(治理 §9.9),
   否则机主必然报 bug。
