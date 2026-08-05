# SP8-P5e —— 公共约束(实现者与评审者都必须先读)

> ## 🔴 必读顺序
>
> 1. 🔴 **上级设计** = `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`
>    (296 行,`6a8f7825`)—— **P5 全期最高权威**。本期必读它的 **§4 P5e 段(两条开工前置)· §5.4(主题 + KFileViewer 复用)·
>    §6.1/§6.4/§6.5(后端实测)· §7(K1–K8 / N1–N7)· §9(风险)· §10(记账)**。
> 2. 🔴 **`p5-master-plan.md`** —— 全期重算(按蓝本逐类实测):**P5e 的 52 个 scss 类逐类清单** ·
>    **24 个蓝本死代码类** · 用户裁定/勘误对上级设计的覆盖。
> 3. 🔴 **`docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md`** —— 跨区影响与两张独立票
>    (⚠️ 在 `docs/`,**进 git**;`.superpowers/` 是 gitignore 的)。
>    含:**票 A** Agent notes 分组 · **票 B** color-guard 收口 · **E-52 对 P5a 仪表盘的可见影响** ·
>    D-3 的跨期约定含义 · **P5f 的整段搬陷阱** · 对上级设计的 5 处订正与待并入 roadmap 的动作项。
> 4. **`p5e-kickoff-prompt.md`** —— **干净上下文的入口**(已批准裁定 + 六个翻车点 + 协调者不许重犯的坑)。
> 5. **`p5d-handoff-to-p5e-p5f.md`** —— P5d 交下来的债务与 9 条做法
> 6. **`p5d-coordinator-rulings-T0.md`(R1–R17)** —— R5 / R8-R9 的方法论、R17 的守卫形态本期继续沿用
> 7. **`p5d-FINAL-review.md`** —— 尤其 §0.3 四个位置「谁在守 / 谁裸奔」实测表(⚠️ 本期**不接手**修它,见 §0.3)
> 8. **`p5e-coordinator-rulings-T0.md`**(本期 T0 评审后产出)
> 9. **本文件** → 然后才是 `p5a-` → `p5b-` → `p5c-` → `p5d-common-constraints.md`
>
> ⚠️ **`p5d-common-constraints.md` 有 18 处已查实的错(E-31~E-48),顶部已有勘误横幅** ——
> 凡与裁定书冲突一律以裁定书为准。**本期不许引它的 A-10 / K37 / §4.2 / §7 / §1.2(43 个 glyph)原文当依据。**
>
> 🔴 **权威优先级**:
> **上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md` > 三份 `p5e-` 附录 + `p5e-fixtures/README`
> > 本文件 > `p5e-plan.md` > 任务 brief。**
> ⚠️ **例外**:凡**用户明示裁定**的压过上级设计(已发生 2 次 = U-1 `AllowlistView` 归 P5f · U-2 蓝本锁 `7a6ee6b7`)。
> P5a/P5b/P5c/P5d 治理的每一条继续生效;**同一节里本文件说了什么,就以本文件为准。**

**本文件只写与 `p5d-common-constraints.md` 的差异。**

- 附录(只用路径引用,不要把内容复制进任务 brief;**T0 产出,T1 起任何一刀不许在附录缺位时开工**):
  - i18n 键表 → `.superpowers/sdd/p5e-appendix-A-i18n.md`
  - 色值映射表 → `.superpowers/sdd/p5e-appendix-B-tokens.md`
  - CSS 类白名单 → `.superpowers/sdd/p5e-appendix-D-classes.md`
  - 后端实测 fixture → `.superpowers/sdd/p5e-fixtures/`(先读 `README.md`)

---

## 0. 🔴 本期开工裁定(协调者,2026-08-05;含 P5d 交下来的债务票拍板)

### 0.1 D-3 拍板 —— 全表键数快照改**下限断言**,留在原地

`SettingsView.test.ts:1887-1888` 的 `expect(Object.keys(zh)).toHaveLength(1595)` ×2。

**裁定**:改成 **`toBeGreaterThanOrEqual(1595)`**,**留在原地**(不挪 `parity.test.ts`、不删)。
理由三条,都可查证:
1. **精确键集一致性已有更强的常驻守卫** —— `src/i18n/parity.test.ts` 断言 zh/en **键集完全相等**,
   比「两个数字相等」强。快照唯一多出的价值是「键总数不会下降」(防批量误删)→ **下限断言恰好只保留这个价值。**
2. **它是跨期陷阱的根源**:每个加键的期都会红在一个与该期毫不相干的文件里(P5d 因此吃掉一次
   `NEEDS_CONTEXT` + 一条裁定 R15 + 一条勘误 E-43)。下限断言让这个成本永久归零。
3. 挪去 `parity.test.ts` 是**换个地方保留同一个陷阱**;删掉违「反转不删」。

🔴 **落地要求**:① 旧的 `toHaveLength(1595)` 两行**留成注释**,注释里写
「P5c-T9 引入快照 → P5d-T1 订正 1503→1595(R15/E-43)→ **P5e 依据治理 §0.1 改为下限断言**;
精确键集一致性由 `src/i18n/parity.test.ts` 守」——🔴 **引条目编号,不引 `file:line`**;
② **必配 RED 探针**:把 zh 档删掉 3 个键 → 该断言必须报红(证明下限方向仍有牙);
③ 🔴 **只许改这两行 + 注释**。`SettingsView.test.ts` 的其余每一行**仍在全期零改动清单上**,
报告要给「其余一字未动」的 `git diff` 逐行自证。

### 0.2 D-9 拍板 —— `aiCfgKnowledgeSoon` **删键**,两档同步

P5d-T9 把占位 `<button>`+toast 反转成 `<router-link>` 后,该键零生产消费点,
唯一残留在 `src/ai/views/SettingsPage.vue:187` 的**注释**里(「反转不删」保留的原文)。

**裁定:从 `zh_cn.ts` 与 `en_us.ts` 同步删除。**
理由:「反转不删」保护的是**决策的历史记录**,而历史已完整留在 `SettingsPage.vue:187` 的注释里;
语言包里留一个零消费键会污染所有后续的死键审计(P5d 终审就撞到它、查不到来历)。
🔴 **落地要求**:① 两档各删 1 行,`parity.test.ts` 必须仍绿;
② `SettingsPage.vue:187` 的注释**补一句**「该键已于 P5e 依治理 §0.2 删除」(注释本身不删);
③ 报告要证明 `grep -rw aiCfgKnowledgeSoon src/` 改后**只命中那条注释**。

### 0.3 🔴 D-5 + D-7 + §0.3 位置③④ —— **本期不做,并入上级设计 §10 那张独立票**

P5d 交接单说「**P5e 一写 `<style>` 块就零保护**」,据此本治理第一版曾排过一刀专修。
**按蓝本与本仓重新实测后撤回,理由三条:**

1. 🔴 **前提不成立** —— P5e 按 **K44 纪律** `.vue` 侧**零 `<style>` 块**(scss 全进 `knowledge.scss`),
   而 `knowledge.scss` 由 `knowledgeStyles.test.ts` 做**全文含注释色扫**(全仓覆盖最完整的一处);
   `searchAggregate.ts` 无任何颜色。→ **D-5 / D-7 / 位置③④ 一条都不危及 P5e 自己的产出。**
2. 🔴 **上级设计 §10 已把它记账为「建议独立一期」** —— 原文:「`color-guard` 三个盲区收口:不扫 `.scss` ·
   不认 `white`/`black` 具名色 · `sk-shared.scss:52` 存量。P3a 起已记账,**建议独立一期**」。
   **D-7**(`.css` 侧 `?raw` 恒空致空壳 + `theme.css` 跳过判断从未生效)是 P5d 终审新发现的
   **第四个同族盲区** → **并入那张票**,不是塞进 P5e。
3. **改的是全仓守卫本身**,「改弱了没人看得出来」—— 它值得一期专门的 RED 探针矩阵,
   不该当成搜索区迁移的搭头。

🔴 **本期对这四个缺口的唯一义务 = 不让它退化**:
- **任何一刀不许放宽既有守卫的范围或判据**(为了让自己绿而放宽 → **按 Critical 报**)。
- `src/styles/color-guard.test.ts` **回到全期零改动清单**(§1.1)。
- ⚠️ **修法留痕给那张独立票**(P5d 终审已给出,别丢):`.css` 分支必须换 **`node:fs`**
  **且同时**修 `:65` 的 `rel === 'styles/theme.css'` 判断(Vite 把同目录 glob key 归一成 `./theme.css`,
  该判断**从未生效**,theme.css 不报红纯靠内容为空的巧合)—— **两步必须同时做**,
  只改一半会从「空壳」变成「大面积误报」(theme.css 有 105 行 hex + 117 行 `rgba(`)。

### 0.4 🔴 Agent 语义搜索卡的 `notes` 分组 —— **本期不做,转独立票**

**实测事实**(协调者 2026-08-05):
- 蓝本 `src/service/searchMapper.js`(102 行)有完整 `notes` 分组(`:13` / `:52-59` / `:63` / `:83` / `:99`);
  本仓 `src/ai/services/searchMapper.ts`(**95 行**)**零 `notes`** —— `grep -n notes` 零命中。
- 蓝本 `SemanticSearchCard.vue` 有 **14 处** `notes`(独立 tab + 计数);本仓 `SemanticSearchCard.vue`(957 行)
  与 `SearchFullResults.vue`(718 行)**各 0 处**。
- 蓝本另有一份 `blocks/__tests__/semanticSearchCardNotes.spec.js`(3 条用例),本仓无对应。

**裁定:不在 P5e 做,登记成独立票「Agent 语义搜索卡补 notes 分组」。**
理由:① 被改文件全在 **`src/ai/services/` + `src/ai/components/blocks/`** = SP8-**P2a/P2b** 的产出与范围,
不是知识库搜索页;② `SemanticSearchCard.vue` 957 行 / `SearchFullResults.vue` 718 行,加一个 tab 是
**跨区改动 + 两个大文件的回归面**,塞进 P5e 会让本期评审同时对标两套蓝本;
③ 它与本期的 `/ai/knowledge/search` 屏**零耦合**(两条独立数据链:agent tool 结果 vs `/v1/ai/search/text`)。

🔴 **连带订正勘误 E-49**:`p5d-common-constraints.md` §4.3 的 **E-27** 把
`__tests__/notesMapper.spec.js` 判给「P5e」,依据是「它测 `searchMapper.js` 而 `searchAggregate` 归 P5e」。
**该依据不成立** —— `notesMapper.spec.js` 的被测对象是 `buildSemanticSearchBlock`(agent 卡片映射器),
与 `searchAggregate.js`(搜索页文件级聚合)是**两个不同文件、两条不同链路**。
**本期正式把它连同 `semanticSearchCardNotes.spec.js` 一并转独立票。**

### 0.45 🔴 上级设计 §4 给 P5e 的两条**开工前置**(T0 必须先答,答不了不许进 T1)

#### 前置① —— `/v1/ai/search/text` 的真实代价

上级设计 §4 P5e 原文:
> **实测 `/v1/ai/search/text` 可用性(paused 模式下查询时仍会懒加载 BGE-M3,内存涨到 ~2.8 GB;首次调用约 16.7 s)。**

三个后果全要落地:
1. 🔴 **验收时第一次搜索要等约 17 秒** —— **不写进验收清单,机主必然当卡死报 bug。**
2. 🔴 **内存峰值 ~2.8 GB** —— 探测前先看余量(上级设计 §6.1 记当时余 9.8 G),报告写清。
3. 🔴 **属「会改设备状态」的探测**(模型驻留内存)→ 报告必须写「怎么恢复」。
   ⚠️ 上级设计 §6.1 已证 `workers.py:84` 的 `pause()`/`start()` 之间无 await 让出点
   → **队列不会解冻、11.3 G 峰值不会出现**,可安全探测。
4. ⚠️ **测试侧不受影响**(单测一律 mock,不打真网络),但**验收清单必须写这个时限**。

#### 前置② —— distill 链路在设备上到底通不通

上级设计 §6.4 原文:设备容器 `main.py` **2765 行、`notes/distill` 命中 0 次**;仓库源码 **2922 行、4 条 distill 路由**
→ **`FileDetailDrawer` 的 distill 按钮真机恒 404**。

⚠️ 协调者记忆记「Python agent 2026-08-01 已重部署,distill 接口真机可用」——
🔴 **必须由 T0 实测坐实,不许采信记忆**(直连 `:8282` + `X-User-Id`,验 `GET /agent/notes/distill/status` 与 `/jobs`)。
- **通** → distill 列入真机验收项(⚠️ 会真的塞队列 + 可能生成 `.md` → 标红 + 写恢复)。
- **不通** → 按上级设计 **D1 政策**:界面做完整、逻辑照抄、**不列真机验收项**、
  **不为打不通的接口编造 fixture**(用「按接口构造的最小样本」并在 README 登记,同 P5d 的 D-6 模具)。

### 0.5 T0 必做的第一个动作(承 P5c §4.4 第 2 条,不许省)

```bash
git fetch git@github.com:NimoTech/NimoOS-UI.git main      # HTTPS 无凭据必失败,见记忆 github-fetch-via-ssh
```
把「远端 sha + 本期全部蓝本文件逐个比对结果 + 本期锁定 `7a6ee6b7`」写进 T0 报告。
**蓝本锁 `7a6ee6b7` 不换**(用户 2026-08-04 拍板,P5 全期);
🔴 **若比对出非注释的功能性差异 → 停下问用户,不许自己决定。**
(已知:`65cfda58` 对 `SearchView.vue`/`FileDetailDrawer.vue`/`KFileViewer.vue` 各只有 3/1/1 处
**注释**中→英,`searchAggregate.js` 逐字相同 —— P5c §4.4 已比过。T0 复核即可,不必重比全文。)

---

## 1. 工作区(与 P5d 的差异)

P5d §1 全部条款继续生效(可写仓只有 `.sp8/NimoOS-New-UI`;蓝本一律 `git show 7a6ee6b7:<path>` 读、
**永远别在 `NimoOS-UI` 里 checkout/stash**;禁 `git add -A`/rebase/reset/stash/merge/push;
`.superpowers/sdd/` 一律 **`git add -f`**)。**订正/新增 4 条**:

1. **起点 commit = `cbcebf9`**(P5d 关账提交)。`git log --oneline -1` 自己现测确认。
2. 🔴 **`.superpowers/` 仍被 `.gitignore:6` 盖着** —— `git status` 全程干净、零警告。
   P5d 收官时发现 **30 个文件从未被 git 跟踪**(含裁定书与整期台账),正是 SP7 整目录丢失的同款向量。
   **每刀提交时就 `git add -f`,别攒到收官。**
   ⚠️ 记忆里「08-05 起 `.superpowers` 不再 gitignore」说的是 **master 那条线(`505e3bf`)**,
   **`sp8-ai` 分支没有这个提交** —— 本期不适用,`git add -f` 纪律不变。
3. **`.sp8/NimoOS-Service` 本期零改动。** 🔴 已核实**不需要**任何 Service 改动:
   `runSearch` / `loadChunkContext` 已在 `knowledgeStore.ts:550/571`;
   `service.ai.searchText` / `searchChunk` 已在包内;`isDistillableName` / `DISTILL_EXTS` /
   `notes.distillFile` 已在包内并从 `index.ts:27` 导出;
   **文件字节流走 `getHttp()`**(见 K50)。→ 不需要跨仓 `pnpm build`,不需要 `pnpm install`。
4. **验收 dev server 已在 `:5288`(pid 1159107,VITE v7.3.6,服务 `.sp8` 工作树),不另起端口。**
   🔴 **`:5277`(SP7 并发会话)与 `:5273`(master/SP9)与 `:5299`(NimoOS-Web)一律不许碰。**
   本期**无新依赖**(见 §14)→ **不需要 kill 重起**;若某刀改了共享包或依赖,才由协调者重起。
   🔴 **`vite.config.ts` 的 `optimizeDeps.exclude` 别删。**

### 1.1 🔴 全期零改动文件清单(P5d §1.1 全部继续生效,本期**解禁 3 个 + 新增 4 个**)

| 文件 | 口径 |
|---|---|
| 🟢 **`src/ai/knowledge/views/SettingsView.test.ts`** | **本期极窄解禁** —— 只许改 `:1887-1888` 两行 + 相邻注释(§0.1 的 D-3)。**其余每一行仍零改动** |
| 🟢 **`src/i18n/zh_cn.ts` · `en_us.ts`** | 本期加键(§7)+ 删 `aiCfgKnowledgeSoon` 一行(§0.2) |
| 🔴 **`src/styles/color-guard.test.ts`** | **全期零改动**(§0.3 撤回了第一版的解禁)—— D-5/D-7 已转独立票。**一行不许动** |
| 🟢 **`src/ai/views/SettingsPage.vue`** | **只许改 `:187` 那条注释一行**(§0.2 第 ②)。其余零改动 |
| `src/ai/knowledge/views/KnowledgeLayout.vue` · `DashboardView.vue` · `QueueView.vue` · `IndexedFilesView.vue` · `SettingsView.vue` · `NotesView.vue` | **全期零改动** |
| `src/ai/knowledge/components/KIcon.vue` | 🔴 **全期零改动** —— 本期用到的 **13 个 glyph 已逐个核实全在**(§1.2),**不许加** |
| `src/ai/knowledge/components/NoteEditPane.vue` · `NotesMarkdownEditor.vue` · `FolderBrowser.vue` | **全期零改动**(P5d/P5b 产出) |
| `src/ai/knowledge/parser/*` · `src/ai/knowledge/util/*`(既有 6 个) | **全期零改动** |
| `src/ai/knowledge/stores/knowledgeStore.ts` · `parserStore.ts` | 🔴 **全期零改动** —— `runSearch`(`:550`)/ `loadChunkContext`(`:571`)已在,**本期只调用,不改** |
| 🔴 **`src/ai/services/searchMapper.ts` · `src/ai/components/blocks/**`** | **全期零改动** —— notes 分组已按 §0.4 转独立票 |
| 🔴 **`src/files/viewers/**`(含 `DocViewer.vue` / `ExcelViewer.vue` / `ViewerShell.vue` / `viewers.css`)** | **全期零改动** —— K46 只**消费**它们,一行不改。若发现必须改 → **停下写 `NEEDS_CONTEXT`** |
| `src/ai/styles/*.scss`(除 `knowledge.scss`) · `src/styles/theme.css` | **全期零改动** |

需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`**,不要自己动。
**例外**:`src/ai/styles/knowledge.scss` 与 `knowledgeStyles.test.ts` **本期必须改**(§6 / §9);
`src/ai/knowledge/deferred.ts` / `knowledgeRoutes.ts` 及其测试 **收官刀必须改**。

### 1.2 🔴 `KIcon` 本期用到的 glyph 已核实全在(13 个,不许往 `KIcon.vue` 里加)

`KIcon.PATHS` 共 **42** 个键(E-35 已订正,不是 43)。本期用到:

```
SearchView       : search x settings chev play target edit folder check danger  (10)
FileDetailDrawer : chev x folder download edit arrowRight check                (+2 新面孔:download arrowRight)
KFileViewer      : x file download                                             (+1 新面孔:file)
```
**去重合计 13 个**,协调者逐个实测 **13/13 全在** ✅。

## 2. 移植纪律(P5a–P5d §2 全部沿用,本期额外 2 条)

- 🔴 **本期是「照抄老样子」口径**:版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置逐字照蓝本 1:1。
  蓝本这两屏在 `.knowledge-app` 下、两档都有 → **暗/浅两档都要对得上蓝本**,不存在 K25 那种「暗档本无原样可抄」。
- 🔴 **本期有一处「界面照 Vue2、逻辑照正确」的真实分叉,已定案 = K46** ——
  蓝本 `KFileViewer.vue:81-101` 的三条 `::v-deep` 布局规则,是**为了补 Vue2 viewer 依赖
  `.file-panel .modal-card .overlay` 祖先链**才写的补丁;本仓 `DocViewer`/`ExcelViewer` **各自内含
  `ViewerShell`**、不渲染 `.overlay`/`.v-container`/`.doc-container` → 照搬 = **复制一个本仓不存在的问题的补丁**。
  **不许照抄。** 详见 K46。
  ⚠️ **反过来**:`.k-fileviewer-host` 的 `position: fixed; inset: 0` **必须保留** ——
  `ViewerShell` 是 `position: absolute; inset: 0`(实测 `ViewerShell.vue:24`),**需要一个铺满视口的定位祖先**。
  拿掉 host 的 `fixed` 会让预览器塌进文档流。**这是本期最容易「顺手清理」出真 bug 的一处。**

## 3. 本期已授权的偏离(K1–K45 沿用 + **K46–K51**)

| # | 偏离 | 依据 |
|---|---|---|
| **K46** | 🔴 **`KFileViewer.vue` 不搬蓝本 `:81-101` 的三条 `::v-deep` 规则**(`.overlay` / `.v-container` / `.doc-container`) | 见 §2 第 2 条。🔴 **落地判据(三条都要)**:① 报告要 `grep` 证明本仓 `DocViewer.vue`/`ExcelViewer.vue` 的模板**零 `.overlay`/`.v-container`/`.doc-container`**(它们渲染 `ViewerShell > .office-body > .office-scroll`);② 报告要引 `ViewerShell.vue:24` 的 `position: absolute; inset: 0; z-index: 200` 证明「host 提供定位上下文」这个前提为真;③ **保留 `.k-fileviewer-host` 的 `position: fixed; inset: 0; z-index: 1100`**,并配一条断言钉住这三个属性(拿掉任一必须报红)。⚠️ **`z-index: 1100` 的语义是「压在 detail drawer 之上」** —— T2 搬 `.k-drawer-bg` 时要核蓝本它的 z-index 实际是多少,两者的**相对关系**要写进附录 D |
| **K47** | **`KFileViewer` 的 2 处 `background: #fff` → token** | 蓝本 `:75` `.k-fileviewer-host` 与 `:84` `::v-deep .overlay`。后者随 K46 一并消失 → **只剩 1 处**。取值由附录 B 定死,实现者不许自选 |
| **K48** | 🔴 **`highlight()` / `fmtMtime()` / `relLevel()` / `relLabel()` 四个函数抽进 `util/searchAggregate.ts`,两个组件 import;不在两个 `.vue` 里各写一份** | 蓝本 `SearchView.vue:317-345` 与 `FileDetailDrawer.vue:199-217` 是**复制粘贴的两份**:`highlight` 与 `fmtMtime` **逐字相同**,`relLevel`/`relLabel` **行为相同、写法不同**(if 链 vs 三元)。🔴 **这不是「顺手重构」**:去重零行为变化,且本档已有「纯逻辑进 util」的既定落点惯例(`notesViewHelpers.ts` / `noteEditHelpers.ts` / `indexedFilesView.ts`)。🔴 **落地判据**:① 报告必须**程序化证明**两份蓝本实现等价(对同一批输入跑两份逐字移植版,输出全等);② `relLabel` 不在 setup 上下文 → 用 **`i18n.global.t(...)`**,先例 `notesViewHelpers.ts` 的 `relativeTime`(治理 P5d §5.1);③ 若发现两份**不等价** → **停下写 `NEEDS_CONTEXT`**,不许自行选一份 |
| **K49** | **三处 `v-html` 照抄**(`.k-rcard-snippet` / `.k-chunk-item-preview` / `.k-chunk-content`) | 本仓已有 4 处同款先例(`SemanticSearchCard.vue:336,427` / `SearchFullResults.vue:236,271` / `SearchFileDrawer.vue:105` / `MentionPopover.vue:349`,都是 `v-html="highlightText(...)"`)。🔴 **但必须补注入用例**:`highlight()` 先 escape `& < > "` 再插 `<mark>` → 用例喂 `<script>alert(1)</script>` 与 `<img src=x onerror=1>`,断言输出里 **`<script` / `onerror` 已被转义成 `&lt;`**、且 `<mark>` 仍出现。**判据:把 `esc` 那步删掉 → 用例必须报红。** 这是本期唯一的 XSS 面 |
| **K50** | **文件字节流走 `getHttp()`,不改 Service 包** | 蓝本 `SearchView.vue:354` 用 `instance.get('/v3/file', {params, responseType:'blob'})`。🔴 **本仓等价落法 = `getHttp().get('/v3/file', { params, responseType: 'blob' })`** —— 已实测:`getHttp` 从 `@nimotech/nimoos-service` 的 `index.ts:26` 导出、本仓已有消费先例(`src/home/stores/folders.ts:26`),且 `http.ts:6-10` 的 `withVersion()` 对 `/^\/v[1-9]/` **原样放行** → `/v3/file` 不会被改写成 `/v1/v3/file`。🔴 **不许用 `service.file.getBytes()`**(返回 `ArrayBuffer`,**丢 Content-Type** → `new Blob([buf])` 的 type 为空 → 新标签页会变成下载而不是预览);🔴 **不许用 `service.file.fileUrl()`**(它把 token 拼进 URL,**正是蓝本 `:346-350` 注释明令要避免的**:token 会进服务端访问日志 / 浏览器历史 / Referer)。测试侧 mock 形态照 `src/files/stores/files.test.ts:17` 的既定写法 |
| **K51** | **`types` / `advOpen` 等页面级瞬态一律组件本地 `ref`,`types` 用 `ref<Set<string>>` + 整体替换** | 蓝本 `toggleSet` 已经是「复制新 Set 再整体赋值」(`:269-274`,注释原文 `mutate set then reassign for reactivity`)→ **Vue 3 下这个写法照抄即正确**,不许「优化」成 `reactive(new Set())` 就地 `add/delete`(那会让 `advEnabled` 的 `types.size` 依赖追踪走另一条路径,与蓝本不同源)。**判据:一条「toggle 后 `advEnabled` 跟着翻转」的用例** |

**除 K1–K51 之外的任何偏离都要先申报再做**;拿不准写 `NEEDS_CONTEXT` 并停下。

## 3.5 明确「照抄、不改」的条目(N1–N32 沿用 + **N33–N45**)

- **N33** **`SAMPLE_QUERIES` 五个示例查询照抄且过 `$t()`**(蓝本 `:192` 定义、`:90` 用 `$t(s)` 双重渲染:
  按钮文案与点击后填入搜索框的值**都是译文**)。**不许改成不翻译、也不许改这五个词。**
- **N34** **`types` 初值是全 5 类**、而 `advEnabled` 的判据是 `types.size < FILE_TYPES.length`
  → **全选 = 「未启用高级」**。照抄这个反直觉判据(`:248`)。
- **N35** **`MIME_PREFIXES`(`:202-208`)照抄**:`pdf` 两个前缀、`doc` 三个、`txt` 只有 `text/plain`、
  **`md` 只有 `text/markdown` 没有 docling 变体**、**`code` 是 `text/x-source`**。
  🔴 **不许「补全」缺的 docling 变体** —— 那是后端 mime 取值的既有事实,改了会静默改变筛选结果。
- **N36** **`buildFilters` 的 `1m` = 30 天、`1y` = 365 天**(`:217-219` 的常量,不是日历月/年)。照抄。
- **N37** **`run()` 失败路径不设 `ms`**(`:312-315` 的 catch 里没有 `this.ms = ...`)→ 上一次成功的耗时会留着,
  但 `phase === 'error'` 时那块不渲染。照抄,不许「顺手清零」。
- **N38** **`showRerankWarn` 的 `setTimeout(…, 5000)` 无清理**(`:309`)。组件卸载后回调仍会跑,
  但在 Vue 3 里写一个已卸载组件的 `ref` **无副作用、无警告**(不是可见错误行为)→ **照抄,不加 `onBeforeUnmount` 清理**。
  ⚠️ 但**不许**用 `vi.useFakeTimers()` 之外的方式测它(真实 5 秒会让用例超时)。
- **N39** **`clear()` 一并清 `openFile` / `viewerFile`**(`:264`)。照抄。
- **N40** 🔴 **`$route.query.q` 的 watch 是 `immediate: true` + 条件 `if (v && v !== this.q)`**(`:252-261`)。
  🔴 **本仓落法必须 `watch(() => route.query.q, handler, { immediate: true })`** ——
  **不许只在 `onMounted` 里读一次**(记忆 `newui-router-query-only-no-remount`:用户改地址栏一行都不跑)。
  **判据:降级成 `onMounted` 读一次 → 「改 query 触发新搜索」用例必须报红。**
- **N41** **`FileDetailDrawer` 与 `KFileViewer` 各自注册 `keydown` Esc 监听**
  (`FileDetailDrawer.vue:130-138` 在 `created`/`beforeDestroy`;`KFileViewer.vue:60-66` 在 `mounted`/`beforeDestroy`)。
  🔴 **两者同时挂载时按 Esc 会同时关掉两个** —— **这是 Vue2 现状**(KFileViewer 由 drawer 的「打开原文件」触发,
  drawer 不关),按 N 系列照抄,**不许加 stopPropagation / 层级管理**。
  🔴 **但必须在验收清单里写明「Esc 会同时关掉预览与详情抽屉 = 与旧版一致」**,否则机主必然报 bug。
  ⚠️ Vue3 落法:`onMounted` / `onBeforeUnmount`(`created` → `onMounted` 是必需改写,不算偏离)。
- **N42** 🔴 **`fetchFull()` 的 `reqId` 过期守卫是蓝本自带的**(`:148` / `:155` / `:159` / `:162`),
  **不是我们加的** —— 照抄即可。⚠️ **但仍要按 P5c §9.1 守「变量作用域」那一半**:
  `activeId` 是组件本地 state,**「两实例交错」用例必须有**(判据:把 `activeId` 挪到模块级 → 报红)。
- **N43** 🔴 **`FileDetailDrawer.submitDistill: distillFile` 是 method 引用、`notify()` 是独立方法** ——
  蓝本 `:182-190` 的注释明写这是「为了让 method-style 测试能整体 stub」的**有意约定**。
  🔴 **Vue 3 `<script setup>` 没有 `methods` 对象 → 蓝本那份 spec 的测法
  (`FileDetailDrawer.methods.distillToNote.call(ctx)`)不可移植。**
  **行为必须承接、测法必须改**:真挂载组件 + mock `service.notes.distillFile`,
  断言 **「传的是 `file.fullPath` 而不是 `file.path`(dirname)」** —— 这正是蓝本那条用例的**唯一实质判据**。
  **判据:把 `submitDistill(this.file.fullPath)` 改成 `file.path` → 用例必须报红。**
  ⚠️ 本仓走 `service.notes.distillFile`(包内,`notes.ts:279`),**不是**蓝本的 `@/service/notes.js` 具名导出。
- **N44** **`canDistill` 用包内 `isDistillableName(file.name)` 门控**(蓝本 `:123-125` 注释:
  「service/notes.js 是本仓 `DISTILL_EXTS` 的唯一定义处」)。
  🔴 **本仓已从 `index.ts:27` 导出 `isDistillableName` / `DISTILL_EXTS`** → **直接 import,不许在本仓重定义扩展名表**。
- **N45** **`toFileResults` 的 `resp.files` 优先、否则 `groupHits(resp.hits)` 兜底**(`searchAggregate.js:71-75`),
  且 `groupHits` **保留响应的 score 顺序**、`fileVM.score` 取 `group.score || 第一个 chunk 的 score || 0`。
  照抄。⚠️ 蓝本那条 spec 的 `expect(out[0].score).toBe(0.8) // best chunk` **依赖的正是「保序 + 取首 chunk」**
  这两件事同时成立 —— 两条都要独立用例。

## 4. 数据契约(T0 必须实测并落 fixture)

P5a §4 三分来源表继续生效。**K1 单层取数继续生效。**
🔴 **所有 mock 一律取 `.superpowers/sdd/p5e-fixtures/` 里的真响应体,禁手编**
(记忆 `newui-fixture-from-imagination-trap`,本档已栽三次)。
🔴 **fixture 用法照 P5c §4.4**:抄进测试 + 注释标出处 + 程序化逐字节等价校验,**不许运行时读 `.superpowers/`**。

### 4.1 🔴 mock 的层次

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `store.runSearch({query, filters, topK, rerank})` | **后端原始响应体**(snake_case:`files[]` / `hits[]` / `stats` / `warnings`) | `knowledgeStore.ts:550-561` 组装固定字段后 **直接 `return service.ai.searchText(body)`,零归一化** → mock 打在 store action 上时形状 = 后端原样。🔴 **`toFileResults` 才是归一化的地方**(camelCase 出口) |
| `store.loadChunkContext({fileId, kind, chunkNo, window})` | **后端原始响应体**(`{ chunks: [{chunk_no, text, …}], anchor_chunk_no }`) | `knowledgeStore.ts:571-574` 同样零归一化。🔴 `FileDetailDrawer.fetchFull` 读的是 **`r.chunks` / `r.anchor_chunk_no` / `x.chunk_no` / `anchor.text`** —— **全部 snake_case**,搞成 camelCase 是错的 |
| `service.notes.distillFile(path)` | `unknown`(包内 `notes.ts:279`) | 蓝本只 `await`、不读返回值 → mock 成什么都行,但**要与其它 `service.notes.*` 的 mock 风格一致** |
| `getHttp().get('/v3/file', …)` | `{ data: Blob }` | K50。测试里 mock `getHttp` 整体,照 `src/files/stores/files.test.ts:17` 的既定写法 |

### 4.2 T0 必须实测并落盘的端点(**下表是待验清单,不是结论**)

🔴 **取数一律直连,不许经网关**(承 E-37 与记忆 `gateway-no-userid-injection`:
网关不注入 `X-NimoOS-User-ID`,直连 `/v1/search/agent/tool` 必 400)。
本期两个端点走 **NimoOS-AI**(`/v1/ai/search/*`),T0 要**先实测哪条路走得通**并把命令写进 fixtures README。

```
POST /v1/ai/search/text   body={query, filters:{}, top_k:10, rerank:false,
                                group_by_file:true, max_chunks_per_file:8}
  → 🔴 本期最关键的 fixture。要坐实:
      · 顶层到底有 `files[]` 还是只有 `hits[]`(决定 N45 哪条分支是真机路径)
      · `paths[0].mtime_ms` 字段名与单位(毫秒?)
      · `mime` 的真实取值分布(是否真有 `text/markdown+docling/pdf` 这类 → 决定 N35 的筛选是否真生效)
      · `chunks[].cite.chunk_no` / `cite.page` 是否存在、`page` 为空时是 null 还是缺字段
      · `chunks[].preview.text` 字段名
      · `score` 的实际量纲(0-1?→ 决定 relLevel 的 0.65/0.50 阈值在真机上是否分得开档)
      · `warnings` 是否真会出现 `rerank_unavailable`(决定 §9.11 的可点性)
POST /v1/ai/search/text   rerank=true            → rerank 分支 + warnings
POST /v1/ai/search/chunk  body={file_id, kind:'body', chunk_no, window:2}
  → `chunks[]` / `anchor_chunk_no` 的真实形状;**anchor 不在 chunks 里时的兜底**
GET  /v3/file?path=…            (responseType blob)      → 真实 Content-Type
GET  /v3/file?path=…&inline=1                            → 🔴 `inline` 参数后端是否真支持
POST /v1/ai/agent/notes/distill(或包内 distillFile 实际打的那条) → 排队响应体
```

🔴 **`inline=1` 那条必须坐实** —— 若后端不认这个参数,「打开原文件」在新标签页会变成**下载**而不是预览。
若不支持:**照抄蓝本(仍传 `inline`)+ 在报告与验收清单里写明真实行为**,不许悄悄改成别的方案。
🔴 **凡「会写后端 / 会改设备状态」的探测,报告里必须写「怎么恢复」**:
本期只有 **distill 会真的往队列里塞任务并可能在 `/DATA/Notes` 生成 `.md`** —— 探测后要说明如何清理。

### 4.3 Vue2 既有 spec 的归属

| Vue2 spec | 被测对象 | 归属 |
|---|---|---|
| `__tests__/searchAggregate.spec.js`(46 行 / 2 例) | `searchAggregate.js` 的 `toFileResults` | ✅ **P5e,行为全部承接**(本仓要更细:`kindFromMime` 六分支 / `basename` / `dirname` / `chunkVM` 边界都要有用例) |
| `__tests__/fileDetailDrawerDistill.spec.js`(23 行 / 1 例) | `FileDetailDrawer.distillToNote` | ✅ **P5e,行为承接、测法必须改**(见 **N43**) |
| `__tests__/notesMapper.spec.js`(30 行 / 2 例) | `src/service/searchMapper.js` 的 `buildSemanticSearchBlock` **notes 分组** | 🔴 **不在本期** —— 见 **§0.4 / 勘误 E-49**,连同 `blocks/__tests__/semanticSearchCardNotes.spec.js` 转独立票 |
| `src/service/__tests__/searchMapper.spec.js` | 同上(非 notes 部分) | **已在本仓承接**:`src/ai/services/streamMappers.test.ts:144+` |

## 5. 代码范式(P5a–P5d §5 全部沿用,补本期落点)

### 5.1 落点(**本文件定死**)

```
src/ai/knowledge/
  views/       SearchView.vue                 ← rail 第 2 项「搜索」
  components/  FileDetailDrawer.vue  KFileViewer.vue
  util/        searchAggregate.ts             ← 蓝本 searchAggregate.js + K48 抽出的 4 个函数
src/ai/styles/
  knowledge.scss                              ← 本期新增段全部进这里
```

依据:承 P5a §5.1「`views/` 放 rail 目标、`components/` 放子组件」的既定落点
(先例:`NoteEditPane.vue` 虽是一整屏也落 `components/`,因为它不是路由目标)。
🔴 **`util/searchAggregate.ts` 而不是 `services/`** —— 它是**框架无关的纯函数**(蓝本文件头注释原文
`Kept framework-free so it is unit-testable without mounting a component`),
与 `notesViewHelpers.ts` / `indexedFilesView.ts` 同族。`services/` 放的是 `openInApp.ts` 那种副作用函数。

相对路径表:

| 从 | 到 | 写法 |
|---|---|---|
| `views/SearchView.vue` | 图标 | `import KIcon from '../components/KIcon.vue'` |
| `views/SearchView.vue` | 两个子组件 | `'../components/FileDetailDrawer.vue'` · `'../components/KFileViewer.vue'` |
| `views/SearchView.vue` | util | `import { toFileResults, chunkCount, highlight, fmtMtime, relLevel, relLabel } from '../util/searchAggregate'` |
| `views/SearchView.vue` | store | `import { useKnowledgeStore } from '../stores/knowledgeStore'` |
| `components/KFileViewer.vue` | 预览器 | `import DocViewer from '../../../files/viewers/DocViewer.vue'`(**层数自己现测**) |
| 任何位置 | 共享 axios | `import { getHttp } from '@nimotech/nimoos-service'` |
| 任何位置 | service | `import { service, isDistillableName } from '@nimotech/nimoos-service'` |
| `util/searchAggregate.ts` | 全局 i18n | `import { i18n } from '../../../i18n'` → `i18n.global.t(...)` |
| 任何位置 | 全局 toast | `import { useToast } from '../../../stores/toast'`(层数按实际) |

- `<script setup lang="ts">`;组件内 `useI18n()`;**import 一律相对路径**(本仓无 `@/` 别名先例)。
- 🔴 **`store.actions.toast(...)` → 本仓走全局 `useToast()`**(承 P5a K3,与 P5b/P5c/P5d 的 6 个页面一致)。
  ⚠️ `FileDetailDrawer` 蓝本用的是 **`@emit('toast', msg)` 让父组件转发**(`:186-190` 注释明写这是该组件的约定)
  → **照抄这个 emit 契约**(N 系列),由 `SearchView` 的 `onDrawerToast` 接住后调 `useToast()`。
  **不许让子组件直接调 `useToast()`** —— 那会改掉蓝本的组件契约。
- 页面级瞬态(`q` / `advOpen` / `types` / `mtime` / `quality` / `topK` / `phase` / `results` /
  `openFile` / `viewerFile` / `ms` / `errorMsg` / `showRerankWarn` / `lastQuery` /
  drawer 的 `activeId` / `fullText` / `loading`)**一律组件本地 `ref`,不塞 store**。

### 5.2 🔴 过期守卫盘点(K15 同族**第 9 次**)

| 位置 | 蓝本自带? | 本期怎么办 |
|---|---|---|
| `FileDetailDrawer.fetchFull()` | ✅ **自带**(`reqId` + 三处 `if (this.activeId !== reqId) return`) | **照抄**(N42)。仍要「两实例交错」用例守作用域 |
| 🔴 **`SearchView.run()`** | ❌ **蓝本无守卫** | 🔴 **必须加**。并发入口 **3 个**:`run()`(回车/按钮)· `quickSearch()` · `$route.query.q` 的 watch。两发在飞时先发后至会用**更旧的结果**覆盖 `results` / `ms` / `phase`,而 `phase` 直接驱动整屏渲染 → **用户可见**(输入新词、屏上出旧结果)。按 §2 判据这是「修一个可复现的错误行为」→ **加,inline 写,不抽公共 guard** |

🔴 两件事都要守(P5c §9.1):① **逻辑**(交错用例:发 A → 发 B → B 先回 → A 后回,断言是 B 的);
② **变量作用域**(「两实例交错」用例;**判据:把 epoch 变量挪到模块级,这条必须报红**)。

## 6. 配色(P5a–P5d §6 全部沿用)

一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / `hsl()` / 具名色**(`white`/`black` 也算);
`transparent` / `currentColor` 是关键字不算。禁 `theme-exception` 逃逸。
🔴 **注释里也不许出现色字面量**(承 P5d 的常驻口径 + 裁定 R17):
偏差申报注释一律引「蓝本 `file:line`」与「附录 B 行号」,**T2 的 `f128450` 是可照抄的先例**。

### 6.1 🔴 本期 scss = **52 个类 / ≈425 蓝本行**(逐类清单在 `p5-master-plan.md` §2.4)

测量法(协调者 2026-08-05):蓝本 693 处选择器去重 vs New-UI 293 个 → 差集 **149 个类** →
用**「class 属性里的完整 token 精确匹配」**逐个查归属。
⚠️ **不能用 `\b` 词边界** —— `k-hero` 会被 `k-hero-suggest` 假命中(同 E-25 的坑,协调者第一版就栽了一次)。

| 归属 | 个数 | 蓝本行段 |
|---|---|---|
| 🔴 **P5e 必搬** | **52** | `:351-360` · `:458-680` · `:726-733` · `:1540-1674`(扣 K45 已搬的 2 行) |
| P5f | 67 | `:985-1160` · `:1342-1400`(Allowlist)· `:2453-2561`(Wiki) |
| ⛔ **蓝本死代码** | **24** | `:272-455` · `:1152-1160` —— 见 §6.2 |
| ⛔ K3 明令不移植 | 2 | `:1431-1450`(`.k-toast` / `.k-toast-ico`) |

**三处色字面量(附录 B 定死,实现者不许自选)**:

| 处 | 字面量 | 说明 |
|---|---|---|
| `.k-rcard-tag[data-kind]`(`:611-624`) | `#FF3B30`(pdf)/ **`#1a1a1a`**(md)/ `#007AFF`(doc)/ `#34C759`(txt)/ `#AF52DE`(code) | 🔴 **本期最大一块新 token** = **文件类型识别色**,性质**同 P5d 的 4 个笔记类型渐变(K39)**:蓝本设计包是值的权威源、全仓大概率零同值先例 |
| `.k-rel[data-level]`(`:633-642`) | 3 组 `rgba(...)` 底 + 3 个实字色(`#1f9c47` / `#c97500` / `#c54a00`) | 相关度高/中/低徽标 |
| 🔴 **`.k-chunk-content mark`(`:1660`)** | **`rgba(255,235,0,.4)`** | **高亮黄**,新 token。⚠️ **另两个 `mark` 规则用的是 token 不是字面量**:`.k-rcard-snippet mark`(`:653`)· `.k-chunk-item-preview mark`(`:1645`)—— **别一起改** |

→ **按 K39 同款政策**:① 先找语义最近的既有 token;② 找不到才新建;
③ **每个新 token 两档都显式写值** + 声明处注释写明蓝本 `file:line`;④ 附录 B 有对应行;
⑤ **附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
🔴 **`#1a1a1a`(MD 黑底)在浅色档是「深底白字」、在暗色档会与背景糊在一起** ——
**本期唯一必须请用户看实物拍板的配色项**,写进验收清单。
⚠️ **`.k-rcard-tag` 上的文字色**:T0 实读蓝本基类的 `color`;若是 `#fff` 压在实底上 →
用 `--on-accent` 家族(记忆:**`--on-accent` 只在 accent 实底上可用**),附录 B 定死。

**KFileViewer 的 `<style scoped>`**(蓝本 `:70-120`,51 行):2 处 `#fff`(`:75`/`:84`),
`:84` 随 **K46** 一并消失 → **净 1 处**(**K47**)。

**模板 `style=`/`:style=`/`color=`** 🔴 **必须显式记数,不许写 0**(P5b 的 E-11 就是漏了这一类):
`SearchView.vue` 初测 6 处(`:26`/`:124`/`:149`/`:151` 的 `color=` **已是 `var()`** ✅ ·
`:84`/`:97`/`:100-105` 是**纯尺寸/排版** → N24 同族照抄);`FileDetailDrawer.vue` 初测 9 处(同性质)。
**T0 逐处判定并给终值。**

### 6.2 ⛔ 24 个「蓝本死代码」类 —— **一个都不许搬**

这些类在**蓝本自己**的 13 个 `.vue` 里**零 class 引用**,是 v1 仪表盘 / v1 进度卡被
`k2-*` Dashboard v2(`:2282-2452`)取代后留下的遗迹。**P5a 正确地没搬。**

```
:272-349  .k-hero  .k-hero-orb  .k-hero-title  .k-hero-sub
          .k-hero-search  .k-hero-search-go  .k-hero-search-kbd        (7)
:380-411  .k-stat  .k-stat-label  .k-stat-value  .k-stat-suffix  .k-stat-cn (5)
:413-455  .k-quick-grid  .k-quick-card  .k-quick-icon
          .k-quick-card-title  .k-quick-card-en  .k-quick-card-desc      (6)
:1152-1160 .k-progress-card  .k-progress-row  .k-progress-label
           .k-progress-nums  .k-progress-bar  .k-progress-fill          (6)
```

🔴 **为什么这是真陷阱**:P5e 要搬的 `.k-hero-suggest`(`:351`)与 `.k-suggest-chip`(`:357`)
**紧夹在 `.k-hero-search-kbd`(`:343`)与 `.k-stat`(`:380`)中间** ——
「整段搬 `:272-455`」会一次带进 18 个死类,而「没有搬多」白名单断言会报红,
**实现者极可能误判成「白名单数字错了」而去改白名单**。

🔴 **落地要求**:① **一条断言证明这 24 个类名在 `knowledge.scss` 里零出现**
(判据:加进任一 → 报红);② 报告必须写明「白名单报红时**先回查本清单**,不许改白名单」这条已被遵守。

### 6.3 🔴 已搬 / 未搬 / 漏搬的边界(**最容易「重复搬」或「级联反掉」的地方**)

| 类 | 现状(实测 New-UI `knowledge.scss` 2380 行) | 本期口径 |
|---|---|---|
| `.k-seg` | ✅ 已搬(K43,P5d-T2) | 🔴 **不许重复搬**,`SearchView` 直接用 |
| `.k-btn.text` | ✅ 已搬(K45,P5d-T2,`:813-822`) | 🔴 **不许重复搬**。⚠️ `knowledgeStyles.test.ts` 有一条**锚定在 `.k-btn { … }` 区间内**的「`&.text` 恰好 2 次」计数断言,重复搬会报红 —— **这是有意的** |
| `.k-empty` / `-illust` / `-title` / `-sub` / `-tips` / `-tip` | ✅ 已搬(`:639-678`) | 不许重复搬 |
| `.k-skel` 基类 | ✅ 已搬(`:680`) | 基类不许重复搬 |
| 🔴 **`.k-skel-rcard`** | ❌ 未搬(`:679` 注释明写「只搬基类 `.k-skel`,`k-skel-rcard` 不在白名单」) | 🔴 **本期必搬**(loading 骨架用它) |
| 🔴 **`.k-suggest-chip`** | ⚠️ **P5a 的跨期漏搬 = E-52** —— New-UI 只有 `:2198` 的 `.k2-suggest .k-suggest-chip { white-space: nowrap }` 这条**后代覆盖**,**基类声明缺失**;蓝本 `DashboardView` 与 `SearchView` **都用它** → P5a 的仪表盘 chip 目前跑在「只有一条 `white-space`、零基类样式」上 | 🔴 **本期补基类**,且必须插在 `:2198` 那条覆盖**之前**(蓝本源序)。**必配断言钉住相对顺序**(判据:调换 → 报红),注释写明「P5a 只搬了覆盖、基类漏搬 = E-52,本刀补」 |
| 🔴 **`.k-hero-suggest`** | ❌ 未搬(全仓 0 命中) | 🔴 **本期必搬**(⚠️ 只搬它,**不要连带 `:272-349` 的 7 个死类**) |
| **`.k-adv-toggle`** / **`.chev`**(嵌套在它里) | ❌ 未搬 | 🔴 **P5f 的 `AllowlistView`/`RootsView` 也用 → P5e 先搬者得,附录 D 要写「P5f 不许重复搬」交接项**(同 K43/K45 模具) |
| **`.h-md`**(`:660`)· **`mark`** ×3 | ❌ 未搬,且都是**嵌套规则** | **随父块整体搬,不单独摘除**(`.h-md` 蓝本自己零引用,但它嵌在 `.k-rcard-snippet` 里 —— 同 P5d「`statusBadge` 零消费者也照抄导出」的 K7 模具)。附录 D 登记 |
| `.k-modal-x` / `.k-row-action` / `.k-scroll` / `.k-btn` | ✅ 已搬 | 不许重复搬,直接用 |

🔴 **T0 的附录 D 必须以 `p5-master-plan.md` §2.4 的 52 个为核对基准**,逐个给「已搬 / 未搬 / 漏搬」三态
—— 不许只给「缺 N 个类」这种总数(承 E-39:P5d 计划书两种口径都不成立)。

## 7. i18n

- **新键前缀 `aiKb*`**,内部按页分可 grep 的词干:
  **`aiKbSr*`**(SearchView)· **`aiKbFd*`**(FileDetailDrawer)· **`aiKbFv*`**(KFileViewer)·
  两页共用的通用词走无词干的 `aiKb*`。
- 🔴 **协调者初测:蓝本 4 个文件共 **54** 个静态 `$t('…')` 串,外加动态过 `$t()` 的
  **`MTIMES` 4 个 label**(`Any` / `Last 1 week` / `Last 1 month` / `Last 1 year`)与
  **`SAMPLE_QUERIES` 5 个查询词**(N33)→ **distinct ≈ 63**。**这是初测,T0 必须复核并给终值。**
  ⚠️ `FILE_TYPES` 的 5 个 label(`PDF`/`Markdown`/`TXT`/`DOC`/`Code`)**蓝本没过 `$t()`** → **照抄字面量,不进 i18n。**
- **复用只认 `aiKb*` 家族里语义相符的键**(承 A-6 / A-1)。🔴 **T0 必须给逐条判定表**,
  并明确**拒绝复用**其它区的同值键 —— 理由逐字同 A-1:**键名语义属于别的区,将来那个区改文案会静默改掉搜索区。**
  ⚠️ **本期高危复用诱惑**(协调者点名,一律按 A-1 拒绝,除非在 `aiKb*` 家族里):
  `filesViewerDownload*` / `filesViewerLoading`(文件区)· `photosSearch*`(相册区)· `searchDialog*`(全局搜索面板)。
- **zh 值一律以 `git show 7a6ee6b7:src/assets/lang/zh_CN.json` 为权威,逐字照抄,不许自己翻译、不许改标点。**
  🔴 **T0 必须给「N/N 命中 / 几条 Vue2 无源需自造」的实测数**(P5d 是 99/99 全命中、零自造)。
- 🔴 **en 值的权威源 = `git show 7a6ee6b7:src/assets/lang/en_US.json` 的覆盖值**(承 **E-31 / 裁定 R10**):
  Vue2 的默认 locale 与 fallback locale **都是 `en_us`** → **英文界面渲染的是覆盖值,不是 `$t()` 的 key**。
  🔴 **verify 脚本的 en 侧不许假设「en = JSON key」**(P5c 的模板有这个 bug = E-44)。
  **凡 en 覆盖值 ≠ key 的,各配 en 正向断言 + 反向断言(≠ `$t()` 原串)。**
- 🔴 **必须跑程序化逐码点比对脚本**(P5a T8 教训:附录零差异,手抄进 TS 时引入 5 处全角标点错)。
  照 `p5d-task-1-i18n-verify.mjs` 写 `p5e-task-1-i18n-verify.mjs`。
- 新键**同时**加进 `zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 自动断言键集一致)。
- `messageSyntax.test.ts` 的守卫**只圈本批键**,🔴 **不许全量生效**:
  (a) 全角标点扫描 `/[，；：？！（）]/`,**例外清单由附录 A 实扫给出**,一律 `toBe` 钉死确切值的**强断言**;
  ⚠️ `。`/`「」`/`·`/`—`/`…`/`×` **都不在**那个正则里。
  (b) 带占位符的键两档占位符名集合一致。🔴 **本期占位符**:`{n}`(多处)+ **`{query}`**
  (`Found {n} matching sections for "{query}", ranked by similarity` —— **本期唯一的双占位符键**)。
  🔴 **注意 E-45**:**vue-i18n 对未匹配占位符是静默替换成空串、不是留字面量 `{m}`**
  → **反向断言不许写成「渲染结果含 `{x}` 字面量」**(零判别力),要断真实插值出来的值。
  (c) 补一条「exactly **N** keys」防漂移(N = T0 终值)。
- 报告里列清「复用 X / 新增 N / 其中 Vue2 有权威 zh 值 M / 本期新造 K / 死键 ?」。

### 7.1 🔴 撞车扫描:T1 必须**双向**扫,且**假定协调者的表不完整**

按 §9.2/§9.3 做「本批键 × 全表」**双向**扫描(zh 撞车看 en 是否不同 + en 撞车看 zh 是否不同)。
**P5c 连续三刀、P5d 一刀,每刀都扫出协调者不知道的撞车对 —— 假定不完整。**
🔴 **协调者已点名的高危同值**(T0/T1 复核并逐条登记):
`Download` · `Close` · `Modified` · `Search` · `Results` · `Copied` · `High`/`Mid`/`Low` ·
`Similarity` · `files` · `matches` · `Advanced` · `Enabled` · `Fast`。
🔴 **`High`/`Mid`/`Low` 特别危险**:它们既是 `relLabel` 的返回值、又是常见的通用词,
**且 `relLabel` 在 util 里用 `i18n.global.t`** → 键选错了在两个组件里同时静默错。
🔴 **用真实模块导入计键数**(§9.3 第 2 条:文本解析会少算)。**起点全表 = 1595 / 1595**
(P5d 收官实测,zh/en 各自独立量且差集均空)—— 但 §0.2 要删 1 个键 → **T1 自己实测,别用算式。**

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5e-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5e-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5e-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。
  报告里贴 `Test Files` / `Tests` 两行 + 任何红项的**完整用例名**。
- 🔴 **起点基线 = P5d 收官口径:`Test Files 331 passed (331)` / `Tests 3958 passed (3958)`,
  `vue-tsc` exit 0,`vite build` exit 0**(P5d 终审独立复跑过)。**T0 必须自己重跑一遍确认,不许照抄。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build`,不需要 `pnpm install`。
- scss 任务额外:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
- 🔴 **收官刀额外门(构建管线,承 E-13 / E-25 / E-8)**:
  **顺序不许颠倒 —— 先抓「改之前搜不到」的证据。**
  ```bash
  rm -rf dist && pnpm build && grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js
  ```
  🔴 **改前必须 exit≠0 / 零输出,改后必须命中。** 判据必须**选择器/上下文感知**
  (裸子串会同时命中注释与真代码 = E-25);🔴 **CSS 命中不能证明 JS 可达**(E-8)——
  本期 scss 全进 `knowledge.scss`,而它由 `KnowledgeLayout.vue` 早已 import → **CSS 侧从 T2 起就进产物**,
  **要核的是 JS 侧**。

### 8.1 🔴 下游算术(收官应是几文件几例)

- `color-guard.test.ts` 按 `**/*.vue` **动态生成用例** → **每新增一个 `.vue` 全量 +1 例**。
  **起点 `.vue` 总数 182 · `color-guard` 用例数 184**(P5d 收官实测)。
  ✅ **本期 `color-guard.test.ts` 零改动**(§0.3 已把 D-5/D-7 转独立票)→ **它的用例数只随 `.vue` 数线性 +1,算式干净。**

  | 刀 | 新增 `.vue` | 落地后 `.vue` 总数 | color-guard |
  |---|---|---|---|
  | 起点 | — | **182** | 184 |
  | T4 | `KFileViewer.vue` | 183 | 185 |
  | T5 | `FileDetailDrawer.vue` | 184 | 186 |
  | T6 | `SearchView.vue`(T6 建、T7 续写,**不重复计**) | **185**(收官) | **187**(收官) |

- 新增测试文件(每个 +1 文件):`searchAggregate.test.ts` · `KFileViewer.test.ts` ·
  `FileDetailDrawer.test.ts` · `SearchView.test.ts` → **+4 文件**。
  ⚠️ **`knowledgeStyles.test.ts` / `color-guard.test.ts` / `knowledgeRoutes.test.ts` / `deferred.test.ts` /
  `messageSyntax.test.ts` / `parity.test.ts` / `SettingsView.test.ts` 都已存在** → **改不加**。
- **起点 331 文件 / 3958 例 → 收官 335 文件 / (3958 + 3 + 新用例数) 例**(`+3` = 三个新 `.vue` 各给 color-guard +1)。
  🔴 **实现者以协调者给的实测基线为准,不要用预测数。**

### 8.2 交接项归属(P5d 交下来的,本文件逐条派活)

| # | 事 | 本期归属 |
|---|---|---|
| **D-3** | 全表键数快照是跨期陷阱 | 🔴 **T1**(裁定见 §0.1) |
| **D-5 + D-7 + §0.3 位置③④** | 四个颜色守卫缺口 | 🔴 **本期不做,并入上级设计 §10 的独立票**(裁定见 §0.3)。本期义务只有「不让它退化」 |
| **D-9** | `aiCfgKnowledgeSoon` 死键 | 🔴 **T1**(裁定见 §0.2) |
| **D-4** | 92 键里约 68 条只有一次性脚本校验,vitest 仅存在性断言 | 🔴 **本期不改,继续挂账** —— 这是 P5a–P5d 的**既定全仓模式**,改它是全仓策略决定,不该在 P5e 内单方面反转。**但本期新键一律照同一模式**(别开第二套),并在 T1 报告里写清「本期 N 条里有几条只有存在性断言」 |
| **D-6** | `sourceRefs.path` / 非空 `backlinks` 真机无样本 | **不动**(笔记区,本期不碰) |
| **D-8** | `p5d-common-constraints.md` 18 处错未逐条订正原文 | ✅ **本期已处置** = 本文件顶部的必读顺序 + 明令「不许引它的 A-10/K37/§4.2/§7 原文」。**原文保留不改(反转不删)** |
| **M-4** | `knowledgeStyles.test.ts:399` 用例名「`&.text` **只在** `.k-btn{…}` 内」比断言实际做的事宽 | 🔴 **T2 顺手改准标题**(只改用例名,不动断言) |
| **M-5** | `knowledgeRoutes.ts:49-51` 旧代注释用现在时说「剩 5 个」 | 🔴 **收官刀顺手订正**(改成带时点的历史记录) |
| **小账** | `p5d-gen-r8r9-sim.mjs` 硬编码旧常量名,T2 后跑会抛 | **T2 若要复现 R8/R9,须先把常量名改成当期实际值**(或对 pre-T2 副本跑) |
| **`openNoteInNewTab`**(蓝本 `openInApp.js:112-115`) | P5d 未补(当期无调用点) | 🔴 **本期仍无调用点**(协调者已核:`SearchView`/`FileDetailDrawer`/`KFileViewer` 零引用)→ **继续不补,转 P5f**。补了就是死代码 |
| **A-8 票**(Agent `?session=` 深链) | — | **与本期无关,继续挂账** |
| **clipboard 票** | 笔记区两处复制无 `execCommand` 兜底 | 🔴 **本期不动笔记区**,但注意:**`FileDetailDrawer.copy()` 蓝本自己就有 `execCommand` 兜底**(`:171-179`)→ **照抄那个兜底**(与笔记区不同源,别按 N 系列拒绝) |
| **票 3c**(DM9 用例名过度声明) | — | 🔴 **继续挂账转 P5f** —— `indexedFilesView.ts` 与其测试仍在全期零改动清单里 |
| **票 3e**(`knowledgeStore.parser.test.ts:24` 的 `STATS` 缺 `models`) | — | **继续挂账转 P5f** |
| **`AllowlistView` / `.k-section-body`** | — | **P5f**(用户 2026-08-04 拍板) |
| 🔴 **新开独立票** | Agent 语义搜索卡补 `notes` 分组(§0.4) | **独立票,不在 P5e/P5f** |

## 9. 测试质量(P5a–P5d §9 全部沿用,本期额外 5 条)

P5d §9 的这些继续逐字生效,**本期高危程度不降**:
属性态断言直接比字符串两侧都比 · 「点某个东西」先确认真渲染成可点元素 ·
探针注入要**行首锚定并先证注入落盘** · 报行号的断言用**保行版** `blankComments()` ·
覆盖度自检的特征串必须唯一 · 否定式断言必须先剥注释且钉「调用形状」 ·
§9.1 过期守卫守两件事 · §9.2/§9.3 en 档正反向断言 + 双向撞车扫 + 真实模块导入计键数 ·
§9.4 包内转换归上游守 · **§9.5 探针还原禁 `git checkout -- <path>`(一律 `cp` + `md5sum` 逐字节比对)**。

本期新增:

### §9.10 🔴 守卫**只许加固、不许放宽**(本期对四个颜色缺口的唯一义务)

D-5 / D-7 / §0.3 位置③④ 已按 §0.3 转独立票 → **本期不修它们**。但:

- 🔴 **任何一刀不许为了让自己绿而放宽既有守卫的范围或判据** —— 违者**按 Critical 报**。
- 🔴 **被迫改上一刀已过评审的断言时,必须程序化证明是加固**:新增用例证明
  「加固前 X 命中 N 个 / 加固后 1 个」(P5d-T8 的 `NoteEditPane.test.ts:533-542` 是可照抄的先例)。
  **自我声明不算证明。**
- 🔴 **扩守卫范围前先想清楚会不会扫出别期的既有违规** —— 会,就是 `NEEDS_CONTEXT`,不是本刀该修的东西
  (承 P5d-T5 的教训)。
- **每刀评审都要核这条有没有被违反**(§11-6)。

### §9.11 🔴 「本机数据下真渲染成可点元素」的本期高危清单(T0 实测后补全,协调者先点名)

§13 第 1 条对本期尤其危险 —— **整屏的可点性都由「搜到没搜到」决定**:

| 屏 / 元素 | 条件 | 后果 |
|---|---|---|
| **整个结果区** | `phase === 'results'` 且 `results.length` | 本机若 Parser 未索引任何文件 → **只有 idle / empty 两态**,结果卡、抽屉、预览器**全不可达** |
| **`k-more-hint`「还有 N 段」** | `v-if="r.chunks.length > 1"` | 单段命中的文件没有这一行 |
| **`k-rerank-warn`** | `showRerankWarn`,只在响应 `warnings` 含 `rerank_unavailable` 时出现、**且 5 秒后自动消失** | 🔴 **要先确认真机 rerank 到底可不可用**;不可用才看得到,且**只有 5 秒**。清单必须写这个时限 |
| **`k-empty`(无结果态)** | `phase === 'empty'` | 要搜一个**本机必然搜不到**的词才能验(清单要给一个具体词) |
| **`k-empty`(error 态)** | `phase === 'error'` | 🔴 **要人为造失败**:停 Parser / 断 Qdrant。清单要写怎么造 + 怎么恢复 |
| **「Distill into note」按钮** | `v-if="canDistill"` = `isDistillableName(file.name)` | 🔴 **搜到的若是图片/代码等非可沉淀类型 → 按钮不渲染**。清单要指定先搜一个 **pdf/md/docx** |
| **`KFileViewer`(in-app 预览)** | 只在扩展名 ∈ `{docx, wps, xls, xlsx, csv}` 时打开 | 🔴 **要先确认本机索引里真有这几类文件**;否则这一整屏不可达 |
| **「请下载」toast** | 扩展名 ∈ `{doc, ppt, pptx}` | 同上,要有这类文件 |
| **`k-adv-panel`** | `v-if="advOpen"` | 要先点「Advanced」 |
| **筛选真生效** | `types.size < 5` 才会发 `mime_prefix` | 🔴 **全选 = 不发筛选**(N34)→ 验筛选必须**取消勾选至少一类** |
| **`?q=` 深链** | query 存在且 `!== q` | 清单要给可直接粘贴的 URL |

🔴 **`navigator.clipboard` 在 HTTP-IP 访问下不存在**(记忆 `newui-clipboard-insecure-reka`)——
**但 `FileDetailDrawer.copy()` 蓝本自带 `execCommand` 兜底** → **真机应该能复制成功**。
🔴 **这与笔记区(P5d,无兜底、会弹「操作失败」)**行为不同 —— **验收清单要写清两者的差异**,
否则机主会以为其中一个是 bug。

### §9.12 🔴 `@vue-office` 在 jsdom 下的可测性必须**先探明**,不许边写边试

`KFileViewer` 静态 import `DocViewer.vue` / `ExcelViewer.vue`,而它们静态 import
`@vue-office/docx` / `@vue-office/excel` + 各自的 `lib/index.css`。
🔴 **T0 必须给出结论**:① 本仓 vitest(jsdom)能不能直接挂载 `KFileViewer` 并渲染出真的 `DocViewer`;
② 若不能,mock 边界画在哪(**推荐 mock 两个 viewer 组件为 stub,保留 `item`/`list` props 与 `close`/`download` emit 的契约形状**);
③ **参照本仓既有先例** —— `src/files/viewers/` 下已有 `DocViewer`/`ExcelViewer` 的消费者与测试
(`panelMap.test.ts` / `useViewer.test.ts` / `useOfficeBytes.test.ts`),**去读它们怎么处理**。
🔴 **T0 不给结论就开工 T5 = 计划失败。** 结论进附录 D。
⚠️ **若走 stub 路线,`KFileViewer.test.ts` 的判别力就只剩「路由映射 + 契约形状」** →
**`VIEWER_MAP` 五个扩展名的映射、fallback 分支、Esc 监听的注册/注销,三条都必须落在能真报红的层次上**,
否则就是零判别力用例。**T5 要为每条附变异证据。**

### §9.13 🔴 `Date.now()` / `new Date()` 一律用 vitest 假时钟,禁真实时间

本期有 **4 处**读时钟:`buildFilters` 的 `Date.now() - map[mtime]`(`:286`)·
`run()` 的 `t0`/`ms`(`:296,304`)· `fmtMtime` 的 `new Date(ms)`(K48 抽出后在 util 里)·
`showRerankWarn` 的 `setTimeout(5000)`(N38)。

- 🔴 **`fmtMtime` 的输出是手工 `getFullYear/getMonth/getDate` 拼串,不是 `toLocaleDateString`**
  → **可以钉死具体字符串**,但**必须固定时区**(`getMonth()` 是本地时区!同一毫秒在不同 TZ 下日期可能差一天)。
  判据:用例要么显式设 `TZ`,要么用**同式比对**(`expect(fmtMtime(ms)).toBe(手工从同一个 new Date(ms) 算出的串)`)。
- 🔴 **`mtimeMs` 是毫秒**(蓝本字段名 `mtime_ms`,`fmtMtime(ms)` 直接 `new Date(ms)`)——
  **与 P5d 的 `relativeTime(unixSec)` 是秒,完全相反**。**喂错单位会静默产出 1970 年**,
  **两侧都要用例**(承 P5d T3 的秒↔毫秒探针教训)。
- **`buildFilters` 的三个档(`1w`/`1m`/`1y`)各要一条断言,钉死 `mtime_after_ms` 的确切值**(假时钟下可算)。

### §9.14 🔴 「加固而非改弱」与「自动上膛」两条常驻做法(承 P5d)

1. 🔴 **被迫改上一刀已过评审的断言时,必须程序化证明是加固**:
   新增用例证明「加固前 X 命中 N 个 / 加固后 1 个」(P5d-T8 的 `NoteEditPane.test.ts:533-542` 是可照抄的先例)。
   **自我声明不算证明。**
2. 🔴 **组件未就绪时不许放 TODO 注释,要放「自动上膛」的文件系统条件断言**:
   用 **`node:fs`**(铁律:`?raw` 恒空)写「若 `<下一刀的文件>` 存在,则本文件必须 import 它且必须不再含占位」。
   **性质 = 现在惰性通过,下一刀一创建文件立刻上膛强制接线。**
   判据两条:**惰性证明**(`--reporter=verbose` 见于 passed 列表、**非 skip/todo**)+
   **上膛证明**(临时创建该文件 → 必须报红 → 删除还原 → 转绿,**临时文件不许提交**)。
   🔴 **两种偏态各要一条独立断言**(只 import 不删占位 / 只删占位不 import)。
3. 🔴 **写「防回环 / 去重 / 不重复触发」类用例时,回写的值必须与初始值不同** ——
   否则 Vue `watch` 的 `Object.is` 前置去重让回调**完全不执行**,用例在「守卫被整个拿掉」时也照样绿
   = **测试路径从未到达被测代码**。**判据永远是:拿掉产品代码的守卫,这条用例必须红。**
4. 🔴 **参数化守卫要防空循环**:「N 个文件全绿」可能是清单读取失败、循环体一次没跑。
   用 `--reporter=verbose` 确认 **N 条独立用例真在执行**。
5. 🔴 **构建管线核验必须先抓「改之前搜不到」** —— 只贴「改完能搜到」不可伪证(§8 收官门)。

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p5e-task-N-report.md`(**`git add -f`**),至少包含:
逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认;
🔴 **碰 gitignore 产物时 md5/diff 才是证据,`git status` 不构成任何证据** —— P5c §1.3.1)·
三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**§3 的 K1–K51 里本任务命中的每一条显式申报** ·
**§3.5 的 N1–N45 里本任务命中的,要说明确实照抄了** ·
**用了哪几个 fixture 文件、mock 形状取自哪一层**(§4.1 的表)。

返回给协调者的只有 **≤15 行**:状态 · 提交 sha · 一行测试结果 · 顾虑。

🔴 **申报纪律(P5d Task 1 / 裁定 R16 的常驻口径,本期同样生效)**:
1. **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
   要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
2. **brief 把某函数列进「不写」清单、却又在 DoD 里要求它的效果 → 停下申报,不许自行拍板**(即使结论正确)。

## 11. 评审者附加要求(P5a–P5d §11 全部沿用,本期额外 6 条)

1. 🔴 **「缺口猎」是常规动作,不是加分项。** P5c 五次、P5d 四次猎中,**全部是「产品代码对、守卫为零」**。
   **本期已知的高危裸奔点**:**K49 的三处 `v-html`**(escape 被删就是 XSS,且 jsdom 下 `v-html` 用例极易写成零判别力)·
   **K50 的 blob 路径**(用错 API 不会红、只会在真机上变成下载)·
   **E-52 的 `.k-suggest-chip` 级联顺序**(反了三门全绿)· **§6.2 的 24 个死类**(搬多了只有白名单会响,
   而白名单可被「顺手改数字」绕过)。
2. 🔴 **专查 §3.5 的 N33–N45 有没有被「顺手修正」**,改了按 Critical 报。本期最容易被误修的:
   **N34**(`types.size < length` 看着像写反了)· **N35**(`MIME_PREFIXES` 看着像漏了 md 的 docling 变体)·
   **N37**(catch 里不设 ms 看着像忘了)· **N38**(`setTimeout` 无清理看着像内存泄漏)·
   **N41**(两个 Esc 监听看着像 bug)· **§2 第 2 条的 `.k-fileviewer-host` 的 `fixed`**(看着像多余)。
3. 🔴 **核 mock 形状的层次(§4.1)**:`runSearch` / `loadChunkContext` **返回后端原始 snake_case**
   (store 零归一化),`toFileResults` 之后才是 camelCase。**搞反了按 Critical 报。**
4. 🔴 **K48 的三条逐条核**:两份蓝本实现的等价性**有程序化证明** · `relLabel` 用 `i18n.global.t`
   (不是 `useI18n()`,后者在 util 里会抛) · 两个组件都 import 同一份、**没有留下第二份拷贝**。
5. 🔴 **K46 的三条逐条核**:`DocViewer`/`ExcelViewer` 真的不渲染 `.overlay` 那三个类(自己 grep,别信报告)·
   `ViewerShell` 真的是 `position: absolute`(自己读源文件) · `.k-fileviewer-host` 的 `fixed`/`inset`/`z-index`
   **真有断言钉住**且拿掉会报红。
6. 🔴 **每一刀评审都要核 §9.10** —— 既有守卫**只许加固、不许放宽**。
   任何一刀若「为了让自己绿」而放宽了范围或判据,**按 Critical 报**;
   被迫改上一刀已过评审的断言时,**必须有程序化的「加固前 N 个 / 加固后 1 个」证明**,自我声明不算。
7. 🔴 **核那 24 个死类真的没被搬进来**(自己 grep `knowledge.scss`,别信报告)——
   并**亲手把其中一个加进去**验证那条断言真报红。

---

## 12. 勘误(本期新增,**下游一律以本节为准**)

| # | 出处原文 | 权威源实际(协调者 2026-08-05 实测) | 处置 |
|---|---|---|---|
| **E-49** | `p5d-common-constraints.md` §4.3 / **E-27**:`__tests__/notesMapper.spec.js` **归 P5e** | 🔴 **依据不成立** —— 该 spec 测 `buildSemanticSearchBlock`(agent 卡片映射器,本仓 `src/ai/services/searchMapper.ts`),与 `searchAggregate.js`(搜索页文件级聚合)是**两个不同文件、两条不同链路**。且本仓 `searchMapper.ts`(95 行)**整个 notes 分组都还没移**、`SemanticSearchCard.vue` 与 `SearchFullResults.vue` 各 **0 处** `notes` | **转独立票**(§0.4) |
| **E-50** | `p5d-kickoff-prompt.md:134`:「P5e 搜索 **820**」= `SearchView` 401 + `searchAggregate` 79 + `FileDetailDrawer` 220 + `KFileViewer` 120 | **四个文件行数 4/4 全对** ✅(逐个 `git show \| wc -l` 实测)。🔴 **但同 E-28 的漏法:没算 scss** —— 蓝本 Search page 段(约 `:457-733`,扣掉已搬部分)+ `:1540-1674`(match pill + detail drawer)+ `KFileViewer` 的 `<style>` 51 行 | **本期真实体量 ≈ 820 + scss 425 = 1245**(scss = 52 个类,逐类清单见 `p5-master-plan.md` §2.4)。**scss 独立一刀(T2),别塞进组件刀里** |
| **E-51** | `p5d-common-constraints.md` §1.2 与**上级设计 §2.5/§4** 都写 `KIcon` = **43** 图标 | 🔴 **实测 42**(承 E-35 已订正过一次) | 本文件 §1.2 用 **42** |
| **E-52** | — | 🔴 **新增:`.k-suggest-chip` 基类是 P5a 的跨期漏搬** —— P5a 搬了 `.k2-suggest .k-suggest-chip` 后代覆盖(New-UI `knowledge.scss:2198`)却没搬基类;蓝本 `DashboardView` 与 `SearchView` **都用它** | **P5e 补基类,插在覆盖之前**(§6.3) |
| **E-53** | 上级设计 §2.4:蓝本 11 个 `.vue` 共 **461** 条去重 `$t()` | ⚠️ 协调者按 **`$t('…')` 单引号**扫 13 个 `.vue` 得 **408**。**这大概率是扫法差异**(未含双引号 / helper `.js` 里的 `i18n.t()` / 过 `$t(变量)` 的常量表),**不是上级设计错** | 🔴 **T0 用与上级设计同口径复扫并给终值。别急着判成勘误** —— P5d 吃过「凭想象补一个不存在的问题、烧 46 万 token」的教训 |

## 13. 验收清单纪律(**下游与协调者都受约束**)

P5b/P5c/P5d 的四条逐字生效:

1. 🔴 **凡「点某个东西」的项,必须先确认该元素在本机数据下真的渲染成可点元素。**
   **本期高危清单见 §9.11(11 项),协调者写清单时逐个照抄。**
   ⚠️ **P5b 的 B18/B19、P5d 的验收都在这条上栽过** —— `v-if="x > 0"` 是高发区。
2. **具体计数有保质期。** 清单里写「**实测于 YYYY-MM-DD,数字会漂,以下列命令现测为准**」+ 附取数命令。
3. 🔴 **凡「会写后端 / 会改设备状态」的验收项,必须标红并写「验完怎么恢复」。**
   **本期比 P5d 轻**:只有 **「Distill into note」会真的往队列里塞任务、并可能在 `/DATA/Notes` 生成 `.md`** ——
   **必须标红 + 写「验完去笔记区把那条草稿删掉」。**
   其余全是读操作(搜索 / 打开 / 下载),但**「下载」会往用户的下载目录落真文件** → 提一句。
4. 🔴 **清单第一项永远是「这一屏怎么从产品的正常导航走到」**(P5c §13.4)。
   **本期必须写**:AI 设置页 `/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 **2** 项「搜索」
   (**收官刀反转 `notes`…不,反转 `search` 之后才成立**);
   `?q=` 深链要**显式给出可直接粘贴的 URL**。
5. 🔴 **本期必须主动告知用户的四条**(不说机主必然报 bug):
   - 🔴 **第一次搜索约等 17 秒**(paused 模式下 BGE-M3 懒加载,上级设计 §4 已实测)—— **不是卡死**。
     第二次起才快。
   - **按 Esc 会同时关掉 in-app 预览与详情抽屉**(N41,与旧版一致)。
   - **`.k-rcard-tag` 的 5 个文件类型色**(尤其 MD 的深黑底 `#1a1a1a`)在暗色档下的观感 —— **请看实物拍板**(§6.1)。
   - **distill 按钮**:T0 前置②判定为「通」则标红 + 写「验完去笔记区把那条草稿删掉」;
     判定为「不通」则**不列此项**并说明原因(D1 政策)。

## 14. 依赖纪律

🔴 **本期不装任何新依赖。**
已核实全部所需能力都已在仓内:`@vue-office/docx` / `@vue-office/excel`(`src/files/viewers/` 已在用)·
`getHttp`(共享包已导出)· `isDistillableName` / `DISTILL_EXTS` / `service.notes.distillFile`(共享包已导出)·
`service.ai.searchText` / `searchChunk`(共享包已有)· `runSearch` / `loadChunkContext`(`knowledgeStore.ts` 已有)。

🔴 **任何一刀想装包 → 停下写 `NEEDS_CONTEXT`。**
`package.json` / `pnpm-lock.yaml` **全期零改动**(P5d 的解禁到期收回)。
→ 因此**不需要 kill 重起 dev server `:5288`**(Vite 预打包缓存只在依赖变动时才需要清)。
