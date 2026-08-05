# SP8-P5f 开工提示词(**干净上下文入口** —— 2026-08-06 由 P5e 协调者落盘)

> **这份文件是给一个零上下文的协调者看的。** 用户会 `/clear`,所以**下面写的就是全部** —— 不要指望任何会话记忆。
> 🔴 **P5f 与 P5e 有一处结构性不同**:**P5e 开工时 `p5e-plan.md` 与 `p5e-common-constraints.md` 已经存在;
> P5f 的这两份还不存在,要你先产出**(见 §6)。

---

## 0. 一句话

把 Vue2 知识库的**最后三页** —— **Wiki(`WikiView` + `wikiViewHelpers`)· 索引根(`RootsView`)· 白名单(`AllowlistView`)**
1:1 迁进 New-UI,**并清空 `DEFERRED_TABS`(占位机制保留)** ⇒ **P5 知识库六批收官,SP8 只剩 P6 cutover。**

| | |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`4c0eaad`**(自己 `git log --oneline -1` 现测) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`**(`src/**`)· 🔴 **`docs/**` 不在这个 sha 上,读法见 §1 末表** |
| 验收 | dev server **`:5288`**(应已在监听,服务 `.sp8` 工作树)· 🔴 **禁 `deploy.sh`** |
| 禁令 | **禁部署 · 禁 push · 禁合 master** · Service 仓零改动 · **零新依赖**(先自己核实,见 §3) |
| 四门起点 | `Test Files 335` / `Tests 4254` / `vue-tsc` 0 / `vite build` 0 / `sass` 0(**自己重跑确认**) |
| 其它基线 | `.vue` **185** · color-guard **187** · `aiKb*` **441/441** · 全表 **1648/1648**(双向差集空)· `WHITELIST_348` · `NON_K_HELPER_CLASSES` **19** |
| 体量 | **≈ 1291 蓝本行**(实测,见 §3) |

---

## 1. 🔴 必读顺序(照这个顺序读,不许跳)

| # | 文件 | 为什么 |
|---|---|---|
| 1 | 🔴 **`.superpowers/sdd/p5e-handoff-to-p5f.md`** | **P5f 的唯一入口** —— 先搬者得 / 24 死类陷阱 / 守卫终值 / 11 条债务 / **12 条常驻做法** / 4 条模型与流程偏离 |
| 2 | 🔴 **`.superpowers/sdd/p5e-coordinator-rulings-T0.md`(R1–R28)** | **权威仅次于上级设计。** 尤其 **R11 / R12 / R18 / R22 / R23 / R24 / R26** 是**跨期常驻**的 |
| 3 | 🔴 **上级设计 = P5 全期最高权威** | `git -C ../../NimoOS-UI show 6a8f7825:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`(296 行)。必读 **§3 的 D1 · §4 的 P5f 段 · §5.4 · §6.3 · §7(K1–K8 / N1–N7)· §9 · §10** |
| 4 | **`docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md`**(**进 git,会跟着合并走**) | 4 张独立票 · **§2.4 的 P5f 体量与整段搬陷阱** · §3 对上级设计的 5 处订正 · **§0 的 A-1/A-2/A-3 动作项** |
| 5 | **`.superpowers/sdd/p5-master-plan.md`** | **§2 的 149 类归属实测**(全支终审已复核成立)· **§2.2 的 24 死类** · §2.3 跨期漏搬 · §5 的 P5f 重算 |
| 6 | **`.superpowers/sdd/p5e-FINAL-review.md`**(726 行) | P5e 全支终审 —— I-1/I-2/I-3 与 6 条 Minor,**其中 M-1~M-4 转 P5f triage** |
| 7 | `p5e-common-constraints.md`(774 行)+ `p5e-plan.md` | **P5f 的治理与计划要以它们为模板**(见 §6) |
| 8 | `p5a-` → `p5b-` → `p5c-` → `p5d-` → `p5e-common-constraints.md` | 每一条都继续生效 |
| 9 | `p5e-acceptance-checklist.md` | **验收清单的写法模板**(治理 §13 的落地样例) |

🔴 **两条 ref 读法不同(混了会读到空文件)**:
| 读什么 | 怎么读 |
|---|---|
| **蓝本源码**(`src/**`) | `git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/…` |
| **上级设计 / roadmap**(`docs/**`) | 🔴 **不在 `7a6ee6b7` 上(实测 0 行)** → `git -C ../../NimoOS-UI show 6a8f7825:docs/…` |

⚠️ **`p5d-common-constraints.md` 有 18 处已查实的错(E-31~E-48)** ⇒ **不许引它的 A-10 / K37 / §4.2 / §7 / §1.2(43 个 glyph)原文当依据。**
⚠️ **`NimoOS-UI` 是被 SP7/SP9 并发会话共用的只读检出** ⇒ **永远别在它里面 checkout / stash / commit。**

🔴 **权威优先级**:
**上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(跨期常驻部分)> `p5f-coordinator-rulings-T0.md`(你 T0 后产出)
> 三份 `p5f-` 附录 > `p5f-common-constraints.md` > `p5f-plan.md` > 任务 brief。**
**例外:凡用户明示裁定的压过上级设计**(P5 全期已发生 4 次 = U-1 / U-2 / K52 方案 A / 结果半区挂账)。

---

## 2. 🔴 已定的、不要重新讨论的事

### 2.1 用户拍板

- 🔴 **D1:Wiki 后端本期不动**(2026-07-31 拍板,P5f 仍然适用)⇒ **Wiki 相关不列真机验收项**:
  界面做完整 · 逻辑照抄 · **不为打不通的接口编造 fixture** · 验收 = 界面走查 + 单测 + 逐行对标 + 明暗两档。
  **实测状态**(上级设计 §6.3):`file_events` **1.42 亿行** / `wiki.db` **38 GB** / `pkg/db/db.go:29 SetMaxOpenConns(1)`
  ⇒ `/v1/wiki/{roots,tree,node}` **超时**;`/v1/wiki/{candidates,raw}` **200**(不查库,`candidates` 实测 `[]`)。**重启无效(已验证)。**
  修复提交 `cff8a2c` 未装,设备跑 06-22 二进制。→ **Wiki 数据库运维票**(不混进前端迁移期)。
- 🔴 **U-1:`AllowlistView` 归 P5f**(2026-08-03 移出 P5c、08-04 拍板归 P5f)⇒ **P5f = Wiki + Roots + Allowlist 三页**,不是上级设计 §4 写的两页。
- 🔴 **U-2:蓝本全期锁 `7a6ee6b7` 不换**。**每期 T0 第一动作 = SSH fetch 真远端 + 逐文件比对 + 写进报告**;
  比出**非注释**差异必须**停下问用户**。(`git fetch git@github.com:NimoTech/NimoOS-UI.git main` —— **HTTPS 无凭据必失败**。)
- **P5e 的结果半区按 D1 挂账**(2026-08-06)—— 与 P5f 同族先例,措辞可照抄。

### 2.2 🔴 跨期常驻的硬纪律(P5e 裁定,**P5f 直接生效**)

| # | 纪律 |
|---|---|
| **R11 / R26** | 🔴🔴 **多会话共用工作树时,`git commit --amend` 与 `git stash` 与 `reset` 同级禁用。** 根因:**`git status` 干净 ≠ HEAD 还是你刚提交的那个**(`.superpowers/` 被 `.gitignore:6` 盖着,**并发会话的提交在你眼里毫无痕迹**)。⚠️ **stash 栈里已有两条与本期无关的 master 线条目(2026-07-18 / 2026-07-06)** ⇒ 任何 `pop`/`apply` 都会**注入别人几个月前的 WIP**。**那两条一个都不许碰,也不许「顺手清理」。** |
| **R12** | **键数断言双轨**:**本批键数用精确 `toBe`;全表键数用下限 `toBeGreaterThanOrEqual`。** 写精确的全表数 = 亲手重建 D-3 刚拆掉的跨期陷阱。 |
| **R18** | 🔴 **brief 给的 RED 判据只是提示、不是权威** —— **实测不成立时以「能真报红」为准并申报**。**P5e 兑现 4 次**(详见 §5-1)。**口径:brief 字面与「本仓既定做法 + 蓝本 1:1」冲突时,以后两者为准。** |
| **R22** | **连「把内联字面量提到模块常量」这种级别的整理也要申报** —— 判据是「有没有申报」,不是「改动大不大」。 |
| **R24** | **用例数归因表要与总数自洽**(算术叙述错会让下一刀误判基线)。 |
| **E-60** | 🔴 **「注释」有两个相反方向,搞混任一都会错**:**色扫 = 注释里是真阳性、不许剥**;**类名/属性声明的否定式断言 = 注释里是假阳性、必须剥**。**判断标准 = 这条约束本身管不管注释。**(P5d 曾在**反方向**误判,代价约 46 万 subagent token。) |
| 铁律 | **测试里读文件一律 `node:fs`** —— Vite 的 `?raw` 在 vitest 下**恒空**。 |
| 流程 | **subagent-driven,每刀 = 一个 fresh implementer + 一个独立评审**(**最低 sonnet,禁 haiku**;评审须**自读源文件、自己 grep、自做 RED 探针,不许采信实现者报告**)· **整批 opus 全支终审**。 |
| 台账 | 🔴 **一律 `git add -f`,每刀提交时就做,别攒到收官**(P5d 收官时发现 30 个文件从未被跟踪 = SP7 整目录丢失的同款向量)。 |
| 运维 | 🔴 **要求 implementer/reviewer 分段落盘**(每完成一节存一次)—— P5e 有 **5 次 API 529 + 1 次连接中断**,不分段就靠运气。 |

### 2.3 dev server

🔴 **只动 `:5288`。** `:5277`(SP7)· `:5273`(master/SP9)· `:5299`(NimoOS-Web)**一律不许碰**。
**零新依赖 ⇒ 不需要 kill 重起**;若某刀改了共享包或依赖,才由协调者重起。

---

## 3. 🔴 P5f 体量(协调者 2026-08-06 实测,不是估数)

| 块 | 量 | 落点 |
|---|---|---|
| `WikiView.vue` | **314** | `src/ai/knowledge/views/WikiView.vue` |
| `wikiViewHelpers.js` | **95** | `src/ai/knowledge/util/wikiViewHelpers.ts` |
| `RootsView.vue` | **289** | `src/ai/knowledge/views/RootsView.vue` |
| `AllowlistView.vue` | **249** | `src/ai/knowledge/views/AllowlistView.vue` |
| **小计** | **947** | |
| 🔴 **`knowledge.scss` 67 个类** | **≈ 344** | `:985-1160` + `:1342-1400`(Allowlist)· `:2453-2561`(Wiki) |
| i18n | **83+** distinct(`wikiViewHelpers` 待扫)| `zh_cn.ts` / `en_us.ts`,前缀 **`aiKb*`** |
| **合计** | 🔴 **≈ 1291 蓝本行** | |

**要承接的 Vue2 spec(实测行数)**:`wikiRoots.spec.js` **73** · `wikiViewHelpers.spec.js` **119** ·
`knowledgeStoreRoots.spec.js` **65** · `dashboardWikiViews.spec.js` **118**(**部分归 P5a**,T0 要判归属)。

🔴 **零新依赖要自己核实**:`FolderBrowser.vue` + `folderBrowser.ts` **P5c 已产出**(`RootsView` 与 `AllowlistView` 要用它),
`knowledgeStore.ts` 的 wiki 域(`loadWikiRoots`/`Candidates`/`Tree`/`Node`/`Raw`/`createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled`)
与 parser allowlist 域 **P5a/P5c 已备齐** ⇒ **大概率零新依赖、Service 仓零改动**,但 **T0 必须逐个实证**。

---

## 4. 🔴 P5f 最容易翻车的点(每一刀的 brief 都要带)

1. 🔴🔴 **24 个蓝本死代码类的陷阱,P5f 比 P5e 更直接**:
   **`.k-progress-*` 六个死类在 `:1152-1160`,而你要搬的 Allowlist 段是 `:985-1160` —— 死类正好压在段尾。**
   按「整段搬 `:985-1160`」会**直接带进 6 个零引用死类**。
   🔴 **P5e-T2 已配一条断言钉住这 24 个类名在 `knowledge.scss` 里零出现** ⇒ **搬多了会报红。
   报红时先回查死类清单,不许改白名单。** 完整 24 类见 `p5-master-plan.md` §2.2 或 `p5e-handoff-to-p5f.md` §一-3。
2. 🔴 **「先搬者得」—— 不许重复搬**:**`.k-adv-toggle`(`:498`)+ 嵌套的 `.chev`(`:509`)P5e-T2 已搬**;
   `.k-seg`(K43)· `.k-btn.text`(K45)P5d 已搬;`.k-empty*` · `.k-skel` 基类 · `.k-skel-rcard` · `.k-modal-x` · `.k-row-action` · `.k-scroll` · `.k-btn` 均已搬。
   ⚠️ `knowledgeStyles.test.ts` 有**锚定在区间内的计数断言**,重复搬会报红 —— **这是有意的**。
   🔴 **P5f 要搬的、前几期故意没搬的**:**`.k-section-body`(`:985`,被 Allowlist + Roots 用,P5c 因 Allowlist 移出而没搬 = E-3)** · **`.k-frow`(`:1077`,只被 Allowlist 用)**。
3. 🔴 **Wiki 的 Go 结构体无 json tag**(上级设计 §5.3):`WikiRoot` / `CreateArgs` ⇒
   **响应是 PascalCase**(`ID`/`Path`/`WatchMode`…)、**POST body 必须用 Go 字段名** ——
   **Go 解码器大小写不敏感但下划线不匹配**,`watch_mode` 会被**静默丢弃**。**双向归一化逐字照搬。**
   ⚠️ `/tree`、`/node`、`/raw` 是 snake_case。**同一个域里两种命名风格,这是本期最容易搞错的一点。**
4. 🔴 **`DEFERRED_TABS` 剩 3 项(`wiki`/`roots`/`allowlist`)全归 P5f,清空后机制必须保留**(K8 / 承 **P4 I2** 的教训:
   占位清单摘空后**仍须有用例证明该机制有能力工作**)。
   🔴 **`deferred.test.ts` 的「机制钉子」用例一字不许动** —— P5e-T8 与两道评审都做过变异验证(`isDeferred` 硬编码 `return false` → 报红)。
5. 🔴 **N6 照抄不改**:`loadWikiNode`/`loadWikiRaw` **只把 404 转 `null`、其余错误上抛** —— 有意分层。
   **N7**:Go nil slice 序列化成 `null` ⇒ `(x || [])` 这类兜底**是必要防御,不许删**。
6. 🔴 **`DashboardView` 的 60 秒骨架照 Vue2 不修**(N3 / 用户明示)—— `loadRoots()` 打死掉的 `/v1/wiki/roots`,
   共享包 axios `timeout: 60000` ⇒ **整页骨架卡 60 秒**。**这是预期行为,不是本期缺陷**,验收清单要说明。
   ⚠️ 且 `isEmpty`(`wikiRoots.length === 0 && indexed_files === 0`)在空索引设备上会把库判成**空库 onboarding 页**。
7. 🔴 **`AllowlistView` 的 `extensions[].enabled` 是 SQLite 整数 0/1**(N1,已实测)⇒
   **`!!e.enabled` 归一化是必需的**,不归一化 chip **永不视觉翻转**。**照抄,连注释一起。**

---

## 5. 🔴 协调者本人不许重犯的坑(P5e 的实付代价)

1. 🔴 **你的 brief 会有错,而且实现者会逮到 —— P5e 逮到 4 次**:
   ① **精确匹配分支与子串分支之间不存在顺序敏感性**(E-61:`text/markdown+docling/pdf` 永远不精确等于 `text/markdown`,调换两支结果不变);
   ② **Vue 3 组件卸载后 `emit()` 本就不投递** ⇒「卸载后按 Esc 不再发 emit」**零判别力**,要改钉 `removeEventListener` 的**同一函数引用**(`toBe(handler)`);
   ③ **单维度守卫不适用「两偏态各一条断言」的要求**(那是从 P5d 双维度语境抄来的);
   ④ **直调 `useToast()` 会丢掉蓝本的 2400ms**(E-62:既有 6 页全走 `store.toast()`,它内部才是 `useToast().show(msg, 2400)`;全局默认只有 1500ms)。
   ⇒ 🔴 **写 brief 时,凡给出「RED 判据」都要标明它只是提示;并明确授权实现者在实测不成立时换掉它并申报。**
2. 🔴 **不许凭想象补一个不存在的问题** —— P5d 因没先回读原文而要求「具名色扫描剥注释」,
   而约束明文写着「注释里也不许出现色字面量」⇒ 那个"误报"是**真阳性**。两轮后回退,代价 **≈46 万 subagent token**。
   **升级评审 finding 必须有可查证的依据,不能凭「我觉得后面会踩」。**
3. 🔴 **类名匹配不许用 `\b` 词边界** —— `k-hero` 会被 `k-hero-suggest` **假命中**(E-25)。
   **必须按 class 属性里的完整 token 精确匹配。**
4. 🔴 **「产品代码对、守卫为零」是常规动作,不是加分项** —— P5c 五次 + P5d 四次 + **P5e 十一次**猎中,
   **每一次产品代码都是对的,缺的都是守卫**。**要求每份评审 brief 都带「缺口猎」一节,并给出怀疑方向。**
5. 🔴 **守卫可能是空壳,「能报红」≠「不是空壳」** —— 承 D-7:`?raw` 恒空曾让 `.css` 侧守卫 **0ms 通过**。
   新守卫要**自带防空转断言**(如 `blocks.length > 0`)。
6. 🔴 **「自动上膛」守卫要先想清楚会不会与下一刀的范围冲突** —— P5e 的 T5 守卫与 T6 范围**直接撞了**,
   靠裁定 R25(「只 import、不写 markup」)才解开。**排刀时就要检查这类跨刀依赖。**
7. 🔴 **取数没取全 = 和凭想象编造一样危险,而且更难发现** —— P5e 的 `F6`/`F6b` 标的「`chunk_no` 不连续」
   是 **Qdrant scroll 未翻页的假象**(单次 `limit:1000` vs 该文件 3448 点),真机 **0…3447 完全连续**。
8. 🔴 **验收清单第一项永远是「这一屏怎么从产品的正常导航走到」**(P5c 的最大产出);
   **凡「点某个东西」的项必须先确认该元素在本机数据下真渲染成可点元素**(`v-if="x > 0"` 是高发区);
   **具体计数有保质期** ⇒ 写「实测于 YYYY-MM-DD,数字会漂」+ 附取数命令。

---

## 6. 🔴 你的第一件事:先产出计划与治理(P5e 开工时这两份已存在,P5f 没有)

**建议顺序**:
1. **通读 §1 的 9 项**,尤其 `p5e-handoff-to-p5f.md` 与 `p5e-coordinator-rulings-T0.md`。
2. **产出 `p5f-common-constraints.md`** —— **以 `p5e-common-constraints.md`(774 行)为模板,只写差异**;
   偏差编号 **从 K53 起**(P5e 用到 K52)· 照抄不改编号 **从 N46 起**(P5e 用到 N45)· 勘误 **从 E-63 起**(P5e 用到 E-62)·
   债务 **从 D-10 起** · 裁定 **从 R1 起**(本期自己的序列,文件名 `p5f-coordinator-rulings-T0.md`)。
3. **产出 `p5f-plan.md`** —— 分刀。**参考 P5e 的九刀结构**(T0 探测+附录+fixtures → i18n → scss → util → 组件逐个 → 收官)。
   ⚠️ **P5f 有三页 947 行 + 344 行 scss**,建议 **8–10 刀**;`AllowlistView`(249)与 `RootsView`(289)可各一刀,
   `WikiView`(314,左树 + 右文章 + 渲染/源码切换 + 最近变更 + 折叠目录提示 + 重扫)**建议拆两刀**。
4. **T0 的必做项(照 P5e 的 T0 模板)**:U-2 蓝本 SSH fetch 复核 · **四门起点自己重跑** ·
   **三份附录**(A i18n 键表 / B 色值映射 / D 类清单,🔴 **以 `p5-master-plan.md` 的 67 类为核对基准,逐个给三态**)·
   **零新依赖的逐项实证**(§3)· **Wiki API 现状复测**(`/roots` 是否仍超时;若 Wiki 已被修好 → **停下问用户是否改验收政策**)·
   **`dashboardWikiViews.spec.js` 的归属判定**(部分归 P5a)· **`src/` 零改动自证**。
5. **每刀 = implementer + 独立评审**;收官后 **opus 全支终审**(要求它**复核你本人的裁定**)+ **写验收清单**。
6. 🔴 **不部署 · 不 push · 不合 master。**

---

## 7. 🔴 P5e 交下来的债务(`p5e-handoff-to-p5f.md` §二 有完整表,这里只列要你决定的)

| # | 事 | 建议 |
|---|---|---|
| **I-1** | `runSearch` 的 `topK` / `rerank` 两入参**零测试守卫**(产品码经逐字核对**正确**,纯覆盖缺口;且结果半区真机不可达 ⇒ **守卫是唯一防线**) | 🔴 **P5f 开工时顺手补掉**(约 1 h),或单开一刀。**别一直挂着** |
| **M-1** | `loadChunkContext` 的 `window: 2` 零守卫(杀伤面小) | triage |
| **M-2** | `highlight` 的 `>= 1` 长度门零守卫(单字查询会全不高亮) | triage |
| **M-3** | R23 祖先链守卫的扫描集**不含 `#app`**(现状安全 —— `#app` 全仓零样式) | triage |
| **M-4** | `messageSyntax.test.ts:1013` 那条旧理由已被 **R13** 作废(D-9 grep 口径已放宽),**未加订正标记** | 顺手 |
| **`openNoteInNewTab`** | 蓝本 `openInApp.js:112-115`,**P5e 仍无调用点** ⇒ **谁先有调用点谁补**,补早了就是死代码 | 🔴 **P5f 要判:Wiki/Roots 有没有调用点** |
| **D-4** | 相当一部分键**只有存在性断言**(值的正确性只由一次性 verify 脚本校验)—— **P5a–P5e 的既定全仓模式** | 继续挂账,**别在 P5f 内单方面反转** |
| 票 3c / 3e / D-6 / A-8 / clipboard 票 | 见 `p5d-handoff-to-p5e-p5f.md` | 继续挂账 |

**4 张后端票(不在 P5e/P5f 范围)**:**A** Agent 语义搜索卡补 `notes` 分组 · **B** `color-guard` 盲区收口(4 个缺口)·
**C** 🔴 **搜索链路授权根缺失 ⇒ 整机语义搜索恒零结果且无警告**(D1 连带;⚠️ **光重启/重部署 Parser 不解决**)·
**D** Parser rerank 端点 500。
🔴 **A-1/A-2/A-3 三个动作项的执行时机 = `sp8-ai` 合 master 那一刻**(A-1 是 **4 张票**,不是 2 张)。

---

## 8. 🔴 仍待用户拍板(不属 P5f,但收官时要再提一次)

1. **`sp8-ai` 合 master 的时机与顺序** —— **非快进、4 个冲突文件**(`i18n/{zh_cn,en_us}.ts`、`router/index.ts`、`vite.config.ts`)、
   **与 `sp7-photos` 压同一 base**。P5d 起就在等,**已积压两期**。
2. **P5f 收官 = P5 六批全部完成** ⇒ 顺势要问:**下一期是 P6 cutover(strangler `/ai` 前缀 + 回退 flag),还是先把 4 张后端票 / 合并做掉?**
