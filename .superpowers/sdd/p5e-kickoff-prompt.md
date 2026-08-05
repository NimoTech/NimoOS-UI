# SP8-P5e 开工提示词(**干净上下文入口** —— 2026-08-05 由协调者落盘)

> **这份文件是给一个零上下文的协调者看的。** 用户已批准计划并会 `/clear`,
> 所以**下面写的就是全部** —— 不要指望任何会话记忆。
> 读完 §1 的必读清单 + §2 的已批准裁定,就可以派 T0。

---

## 0. 一句话

把 Vue2 的知识库**搜索区**(`SearchView` + `FileDetailDrawer` + `KFileViewer` + `searchAggregate`
\+ `knowledge.scss` 52 个类)1:1 迁进 New-UI,**九刀 T0–T8**,每刀一个实现者 subagent + 一个独立评审 subagent。

| | |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`d2c5d5b` 之后的 HEAD**(自己 `git log --oneline -1` 现测) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`**(`src/**`)· 🔴 **读法见 §1 末尾那张两条 ref 的表 —— `docs/**` 不在这个 sha 上** |
| 验收 | dev server **`:5288`**(应已在监听,服务 `.sp8` 工作树)· 🔴 **禁 `deploy.sh`** |
| 禁令 | **禁部署 · 禁 push · 禁合 master** · Service 仓零改动 · **零新依赖** |
| 三门起点 | `Test Files 331` / `Tests 3958` / `vue-tsc` 0 / `vite build` 0(**T0 自己重跑确认**) |
| 体量 | **≈ 1245 蓝本行**(不是 kickoff 与上级设计写的 820 —— 那两处没算 scss = E-50) |

---

## 1. 🔴 必读顺序(**照这个顺序读,不许跳**)

| # | 文件 | 为什么 |
|---|---|---|
| 1 | `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(约 300 行) | 🔴 **上级设计 = P5 全期最高权威。** 本期必读 **§4 P5e 段(两条开工前置)· §5.4 · §6.1/§6.4/§6.5 · §7(K1–K8/N1–N7)· §9 · §10** |
| 2 | `.superpowers/sdd/p5-master-plan.md` | 全期按蓝本**逐类实测**重算:**§2.4 P5e 的 52 个 scss 类清单** · **§2.2 的 24 个死代码类** · §4 用户裁定对上级设计的覆盖 |
| 3 | `docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md` | 跨区影响与两张独立票(**进 git,会跟着合并走**) |
| 4 | `.superpowers/sdd/p5e-common-constraints.md` | 本期治理:K46–K51 / N33–N45 / 四项裁定 / 测试质量增补 |
| 5 | `.superpowers/sdd/p5e-plan.md` | 九刀与逐刀 DoD |
| 6 | `.superpowers/sdd/p5d-handoff-to-p5e-p5f.md` | P5d 交下来的债务 + **9 条后续每期都该用的做法** |
| 7 | `.superpowers/sdd/p5d-coordinator-rulings-T0.md`(R1–R17) | R5 / R8-R9 的方法论、**R17 的守卫形态**本期继续沿用 |
| 8 | `.superpowers/sdd/p5d-FINAL-review.md` | §0.3 四位置守卫实测表(⚠️ 本期**不接手**修它,见 §2-2) |
| 9 | `p5a-` → `p5b-` → `p5c-` → `p5d-common-constraints.md` | 每一条都继续生效 |

🔴 **两条读法不同,别混**(协调者 2026-08-05 实测):
| 读什么 | 怎么读 |
|---|---|
| **蓝本源码**(`src/**`) | `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/…`。**`main` 线** |
| **上级设计 / roadmap**(`docs/**`) | 🔴 **不在 `7a6ee6b7` 上**(实测 `git show 7a6ee6b7:docs/…` = **0 行**)—— 它们只在 **`docs/vue3-migration-sp3`** 分支。用 `git -C ../../NimoOS-UI show 6a8f7825:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(**钉这个 sha**,已验与 HEAD/工作树逐字节相同;工作树分支还在动,今天刚提交 SP9-P7 关账) |

⚠️ **`p5d-common-constraints.md` 有 18 处已查实的错(E-31~E-48)**,顶部已有勘误横幅。
🔴 **不许引它的 A-10 / K37 / §4.2 / §7 / §1.2(43 个 glyph)原文当依据。**

🔴 **权威优先级**:
**上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(T0 后产出)
> 三份 `p5e-` 附录 + `p5e-fixtures/README` > `p5e-common-constraints.md` > `p5e-plan.md` > 任务 brief。**
**例外:凡用户明示裁定的压过上级设计**(已发生 2 次 = U-1 / U-2,见 master-plan §4)。

---

## 2. 用户 2026-08-05 已批准的四项裁定(**不要重新讨论**)

1. **票 A:Agent 语义搜索卡的 `notes` 分组转独立票** —— 不在 P5e/P5f
   (E-49:被改文件全在 P2a/P2b 地盘,957/718 行两个大文件,与搜索页零耦合)。
2. **砍掉「守卫债刀」** —— D-5 / D-7 / §0.3 位置③④ **并入上级设计 §10 那张独立票**(= 票 B)。
   理由:P5e 按 K44 `.vue` 零 `<style>` 块、scss 全进 `knowledge.scss`(已被全文色扫覆盖)、
   `searchAggregate.ts` 无颜色 → **一条都不危及本期产出**。P5d 交接单那句
   「P5e 一写 `<style>` 块就零保护」**前提不成立**。
   → 🔴 **本期义务只有「不让它退化」**:守卫只许加固不许放宽;
   `src/styles/color-guard.test.ts` **在全期零改动清单上**。
3. **D-3 改下限断言**(`SettingsView.test.ts:1887-1888` → `toBeGreaterThanOrEqual`,留原地)·
   **D-9 删键**(`aiCfgKnowledgeSoon` 两档同步删)—— 都在 **T1**,细则见治理 §0.1 / §0.2。
4. **九刀 T0–T8**(`FileDetailDrawer` 220 行合一刀,`SearchView` 401 行拆两刀)。

**仍待用户拍板、不属本期**:`sp8-ai` 合 master 的时机与顺序
(非快进、4 个冲突文件、与 `sp7-photos` 压同一 base)。

---

## 3. 🔴 上级设计给 P5e 的两条开工前置(T0 必须先答,答不了不许进 T1)

### 前置① `/v1/ai/search/text` 的真实代价(上级设计 §4 原文)

> **paused 模式下查询时仍会懒加载 BGE-M3,内存涨到 ~2.8 GB;首次调用约 16.7 s。**

- 🔴 **验收时第一次搜索要等约 17 秒 —— 不写进验收清单,机主必然当卡死报 bug。**
- 内存峰值 ~2.8 GB,探测前先看余量。属「会改设备状态」→ 报告必须写怎么恢复。
- ⚠️ 上级设计 §6.1 已证 `workers.py:84` 的 `pause()`/`start()` 之间无 await 让出点
  → **队列不会解冻、11.3 G 峰值不会出现**,可安全探测。

### 前置② distill 链路真机通不通(上级设计 §6.4)

设备容器 `main.py` 曾是 **2765 行、`notes/distill` 命中 0 次**;仓库源码 **2922 行、4 条 distill 路由**
→ **`FileDetailDrawer` 的 distill 按钮真机可能恒 404**。
⚠️ 有一条记忆说「Python agent 2026-08-01 已重部署、distill 可用」——
🔴 **必须 T0 实测坐实,不许采信记忆**(直连 `:8282` + `X-User-Id`,验
`GET /agent/notes/distill/status` 与 `/jobs`)。
不通 → 按 **D1 政策**:界面做完整、逻辑照抄、**不列真机验收项**、**不为打不通的接口编造 fixture**。

---

## 4. 🔴 本期六个最容易翻车的点(**每一刀的 brief 都要带**)

1. **24 个蓝本死代码类不许搬**(master-plan §2.2)。P5e 要搬的 `.k-hero-suggest`(`:351`)/
   `.k-suggest-chip`(`:357`)**紧夹在 `.k-hero-search-kbd`(`:343`)与 `.k-stat`(`:380`)中间** ——
   「整段搬 `:272-455`」会一次带进 18 个死类。
   🔴 **「没有搬多」白名单报红时,先回查那份清单,不许改白名单。**
2. **K46 —— `KFileViewer` 的 21 行 `::v-deep` 不许照搬,但 `.k-fileviewer-host` 的 `fixed` 必须保留。**
   蓝本那三条是补 Vue2 viewer 依赖 `.file-panel .modal-card .overlay` 祖先链的;
   本仓 `DocViewer`/`ExcelViewer` **自带 `ViewerShell`**、不渲染那三个类。
   ⚠️ **反过来**:`ViewerShell.vue:24` 是 `position: absolute; inset: 0` → **需要 host 提供铺满视口的定位祖先**。
   **照搬 = 复制不存在的问题;顺手清理 host 的 `fixed` = 预览器塌进文档流。两个方向都是 bug。**
3. **K50 —— 文件字节流必须走 `getHttp().get('/v3/file', {responseType:'blob'})`。**
   `service.file.getBytes()` 返 ArrayBuffer **丢 Content-Type**(新标签页变下载);
   `service.file.fileUrl()` 把 token 拼进 URL(**蓝本 `:346-350` 注释明令要避免**)。
   **两种错法都不会让三门变红,只在真机上错。**
4. **`mtimeMs` 是毫秒 —— 与 P5d 的 `relativeTime(unixSec)` 是秒完全相反。**
   喂错单位静默产出 1970 年,**两侧都要用例**。
5. **E-52:`.k-suggest-chip` 基类是 P5a 的跨期漏搬。** 本仓只有 `knowledge.scss:2198` 那条后代覆盖。
   基类必须搬在那条覆盖**之前**(蓝本源序),否则级联反掉而**三门全绿**。
   🔴 **连带**:补基类后 **P5a 的仪表盘 chip 外观会变**(变成蓝本该有的样子)→ **验收清单要带一条**,
   否则机主会以为 P5e 把仪表盘改坏了。
6. **K49 的三处 `v-html` 是本期唯一 XSS 面。** `highlight()` 先 escape 再插 `<mark>`,
   **删掉 escape 那步三门不会红** → 必须有注入用例 + RED 探针。

---

## 5. 🔴 协调者本人不许重犯的坑(P5d 与本次规划的实付代价)

1. 🔴 **不许凭想象补一个不存在的问题。** P5d-T5 协调者要求「具名色扫描剥注释」,
   根因是**没先回读 §0.3 原文**(它明令「注释里也不许出现色字面量」→ 注释里的 `background: black`
   是**真阳性**)。两轮后回退,代价 **≈46 万 subagent token**。
   **升级评审 finding 必须有可查证的跨刀依据,不能凭「我觉得后面会踩」。**
   → 本次的 **E-53**(i18n 461 vs 408)就是照这条办的:**只登记为「扫法差异待复核」,不判成勘误。**
2. 🔴 **类名匹配不许用 `\b` 词边界。** 本次规划时用 `\b` 查「哪个 `.vue` 用某类」,
   `k-hero` 被 `k-hero-suggest` 假命中 → 结论完全错(误判 `.k-hero` 是活类)。
   **必须按 class 属性里的完整 token 精确匹配。** 这就是 **E-25** 那个坑。
3. 🔴 **台账一律 `git add -f`,每刀提交时就做,别攒到收官。**
   `.gitignore:6` 盖着 `.superpowers/` → **`git status` 全程干净、零警告**。
   P5d 收官时发现 **30 个文件从未被跟踪**(含裁定书与整期台账)= SP7 整目录丢失的同款向量。
4. 🔴 **派活/评审最低 sonnet,禁 haiku**;评审须**自读源文件、自己 grep、自做 RED 探针**,
   **不许采信实现者报告**(上级设计 §8)。
5. 🔴 **上级设计 §9-1 明令:每批 scss 任务单独派一个评审专做逐行色扫。** → T2 就这么派。
6. 🔴 **dev server 只动 `:5288`。** `:5277`(SP7 并发会话)· `:5273`(master/SP9)· `:5299`(NimoOS-Web)
   **一律不许碰**。本期零新依赖 → **不需要 kill 重起**。
7. 🔴 **探针还原一律 `cp` + `md5sum` 逐字节比对,禁 `git checkout/restore/stash`。**
   碰 gitignore 产物时 **md5/diff 才是证据,`git status` 不构成任何证据**。

---

## 6. 九刀速览(详见 `p5e-plan.md`)

| 刀 | 内容 | 产出 |
|---|---|---|
| **T0** | 探测 + 三份附录 + fixtures(**不碰 `src/`**)· 两条开工前置 · 蓝本 SSH fetch 复核 · `@vue-office` jsdom 可测性 · K48 等价性证明 | 附录 A/B/D + `p5e-fixtures/` |
| **T1** | i18n **63 distinct** + **D-3** + **D-9** | 两档语言包 + 守卫 |
| **T2** | `knowledge.scss` **52 个类 ≈425 行**(+ 24 死类断言 + E-52 顺序断言 + K46/K47)+ M-4 | 🔴 **最大一刀** |
| **T3** | `util/searchAggregate.ts`(蓝本 79 + K48 抽的 4 个函数)+ 承接 `searchAggregate.spec.js` | 新 util + 测试 |
| **T4** | `KFileViewer.vue`(K46) | 新 `.vue`(183) |
| **T5** | `FileDetailDrawer.vue`(含 `copy()` 双路径 + N43 distill + 自动上膛守卫) | 新 `.vue`(184) |
| **T6** | `SearchView.vue` 上半(搜索框/高级面板/`run()` 过期守卫/四态/`?q=` 深链) | 新 `.vue`(185,收官) |
| **T7** | `SearchView.vue` 下半(结果卡 + 接线 + **K50 文件字节流**) | 续写 |
| **T8** | 收官(路由反转 + `DEFERRED_TABS` 摘 `search` + 构建管线门 + M-5) | — |

**收官后**:`git add -f` 全部台账 → 派 **opus 全支终审**(要求它**复核协调者本人的裁定**,
含 master-plan §2 那份 149 类归属实测)→ 写 `p5e-acceptance-checklist.md` → **不部署、不 push、不合 master**。

🔴 **验收清单必须主动告知的四条**(不说机主必然报 bug):
① **第一次搜索约等 17 秒**(BGE-M3 懒加载,不是卡死)· ② **按 Esc 会同时关掉预览与详情抽屉**(N41,与旧版一致)·
③ **`.k-rcard-tag` 五个文件类型色**(尤其 MD 的深黑底 `#1a1a1a`)在暗色档的观感 → **请看实物拍板** ·
④ **顺带看一眼仪表盘的建议 chip**(E-52 补基类后它才是蓝本该有的样子)。
\+ **distill 按钮**按 T0 前置②的结论决定列不列(列则标红 + 写「验完去笔记区把那条草稿删掉」)。
