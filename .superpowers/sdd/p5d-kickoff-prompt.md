# SP8-P5d 开工提示词(笔记区 + 三张挂账票)

> 这份是给下一个会话的**开工提示词**,直接整段贴过去即可。
> 上一期(P5c)的收尾状态与挂账都在里面。

---

承接 SP8-P5d 知识库笔记区的迁移。

## 必读(按这个顺序)

1. **治理文件** `.sp8/NimoOS-New-UI/.superpowers/sdd/p5c-common-constraints.md`
   —— P5d 直接沿用,只产出 `p5d-` 版差异。**这份已经是第四代**(P5a → P5b → P5c),
   §3 的 **K1–K36**、§3.5 的 **N1–N22 + §3.6**、§9 的**第七~第十条纪律**是判断
   「这算缺陷还是照抄」的唯一权威。
   🔴 **P5c 新增、对 P5d 直接生效的几条,别漏**:
   - **§1.3 / §1.3.1** —— 探针**允许**临时写零改动清单里的文件(md5 证还原 + 不在提交里 + 收尾干净);
     🔴 **但 `git status` 对 gitignore 产物(`dist/`、`node_modules/.vite/`)完全是瞎的** ——
     那种情况「还原」的唯一证据是 md5/diff + **强制干净重建 + 全目录 diff**。
     (实证:`NimoOS-Service/dist/wiki.d.ts` 被 07-31 的探针改成 `pathX` 没还原,**活了三天**没人发现。)
   - **§4.4** —— fixture 一律**抄进测试 + 注释标出处**,**不许运行时读 `.superpowers/`**
     (那个目录被 gitignore 盖着、在 SP7 整个丢过一次);抄完做**程序化逐字节等价校验 + 变异验证**,不许肉眼比。
   - **§9.1** —— 过期守卫要守**两件事**:守逻辑(交错用例)**+ 守作用域**(「两实例交错」用例;
     判据是把守卫变量挪模块级 → 那条必须报红)。
   - **§9.2 / §9.3** —— 凡「必须用键 A、不许用键 B、理由是 en 不同」的条目,**只比 zh 的断言零判别力**,
     必须补 en 档正/反向断言;**撞车扫描要双向**(zh 撞车看 en · en 撞车看 zh),键数用**真实模块导入**计。
     🔴 **这条连续三刀每刀都扫出协调者不知道的撞车对(T7 一对、T8 两对)** —— 不是形式。
   - **§9.4** —— mock 打在**包边界**时,包内归一化函数(如 `normalizeSettings`)**在本仓不可测**;
     正解是「论证不适用 + 引上游守卫 + 附变异证据」,**不是删掉也不是硬凑**。
     **协调者 brief 要求的用例若在本层不可能有判别力,那是 brief 的错,要登记勘误。**
   - **§9.5** —— 探针还原**禁用 `git checkout -- <path>` / `git restore`**(会连未提交的编辑一起抹掉,T10 栽过);
     只许「先存副本 → 注入 → 用副本覆盖 → md5 比对」。
   - **§13 第 4 条(P5c 血的教训,见下方票 1)** —— **验收清单的第一项永远是「这一屏怎么从产品的正常导航走到」**。
2. **附录三份**:`p5c-appendix-A-i18n.md`(键表 + 全角标点例外 + 占位符清单)·
   `p5c-appendix-B-tokens.md`(色值映射;**§6.4.1-2 的参照色已订正**,设置页真源是 `#FF9500`/`#34C759`)·
   `p5c-appendix-D-classes.md`(白名单现 **226** 类)
3. **台账**:`p5c-common-constraints.md` 的 **§8.4 / §8.5**(转 P5d 的全部挂账)+
   **§12.x 的 E-1 ~ E-25**(协调者 brief 累计被核出 **25 处错**的完整清单 —— 看一眼错的类型分布,
   下一期照样要回源核每个行号/键名)
4. **上级设计**(P5 总设计,含 D1–D5 用户拍板):
   `git -C /home/nimo/NimoTech/NimoOS-UI show docs/vue3-migration-sp3:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`
5. **P5c 的 plan 当模板**:`.sp8/NimoOS-New-UI/.superpowers/sdd/p5c-plan.md`(9 刀单车道的写法 + 协调者裁定 A-1~A-5)

---

## 起点事实

- 坐标:New-UI **`sp8-ai`@`bbbdca4`**(产品代码;之后只有 `.superpowers/` 下的 markdown)· Service **`sp8-ai`@`15c2eba`**
- 三门基线:**326 文件 / 3515 例**全绿 · `vue-tsc` 0 · `vite build` 0 · **`.vue` 179**
- dev server:**`:5288`**,PID **401283**(P5c 收尾时重起并验证过服务的是 `.sp8` 工作树)
- **P5c 编码全部关账、终审 0 Critical;但用户验收未走完** —— 卡在「打不开知识库」(见票 1)
- **未部署、未合 master**
- `aiKb*` 键数 **295**(P5a 96 + P5b 100 + P5c 99),全表 1503

### P5c 未走完的验收(P5d 顺带补)
清单在 `.superpowers/sdd/p5c-acceptance.md`(A/B/C/D 四组 40 项)。
🔴 **其中 A11 是需要用户拍板的项,还没拍**:浅档 `--warning`(`#92600c`)/ `--success`(`#15754c`)
比 Vue2 设置页真源(`#FF9500` / `#34C759`)**明显更深**,吃在 `.k-svc-light` 与 `.k-set-row-desc .warn` 上。
协调者判「保全站一致、不开小灶」,**等用户看实物拍板**。

---

## 🔴 三张挂账票(**票 1 是开工第一件事**)

### 票 1 —— 知识库整区**没有导航入口**(P5a/P5b/P5c 三期都漏了)

**用户 2026-08-04 验收时发现的**:`/ai/knowledge` 在 AI 区**没有任何可点入口**,只能敲地址进。

**实测**:路由已注册(`src/router/index.ts:18` + `:37`),但**全仓零导航链接**
(`grep -rn "ai/knowledge" src/` 排除 `src/ai/knowledge/**` 与测试后,只命中 `router/index.ts` 与一段注释)。

**成因写在 `src/ai/views/SettingsPage.vue:26-29` 的注释里**(SP8-P2a/P2b 的产出):
> 顶栏「详情」原为 `<router-link to="/ai/knowledge">`(Vue2 `Settings.vue:22-24`)。
> `/ai/knowledge` 要到 SP8-P5 才存在,`router.push` 到不存在的路由会落空白死页 ——
> **改成 `<button>` + info toast 占位**,样式类名 `.set-detail-link` 保持不变(视觉 1:1),仅交互目标变了。

→ **P2a/P2b 当时处置完全正确。但 P5a 建好外壳后没有任何一期把入口还回去。**

**为什么三期都没发现**(**这条比 bug 本身值钱**):
1. 那个占位按钮在 `src/ai/views/SettingsPage.vue` —— **属于 P2a/P2b 的产出,不在 P5a-P5c 任何一刀范围内**;
2. P5a 的 DoD 是「rail 9 项 1:1 + 占位机制」,**没有一条要求「从 AI 区能点进来」**;
3. 三期的验收清单开头都写「知识库左栏第 N 项」,**默认了「你已经在知识库里」** ——
   §13 只管「屏内元素可不可点」,**没管「这一屏本身可不可达」**。

**要做**:
- 把「详情」从 `<button>` + info toast **反转回** `<router-link to="/ai/knowledge">`
  —— 照 `knowledgeRoutes.ts` 那**四次**「反转不删、改前原文留成注释」的先例(P5a T12 / P5b T5 / P5b T10 / P5c T10);
- **`.set-detail-link` 类名与视觉不动**(它本来就是为 1:1 保留的);
- 🔴 **配 RED 探针**:改回占位按钮 → 必须有断言报红(**别再让「入口丢了」没人守**);
- **顺带订正那段注释**(它现在还说「要到 SP8-P5 才存在」);
- ⚠️ `src/ai/views/SettingsPage.vue` **在 P5c 的全期零改动清单里** —— P5d 要**显式解禁**并在治理里登记。
- 🔴 **连带把 §13 第 4 条写进 P5d 治理**:清单第一项永远是可达性;蓝本里也无入口的屏(如 `/ai/parser`,
  T10 已实证 Vue2 相同)**要显式写明「无入口是 1:1,靠 X 进入」**。

### 票 2 —— 注释债(3 处过期 + 1 处 a11y 无守卫)
- `ParserStatus.test.ts:206`(🔴 **双重过期**:说「仍指占位页」已反,且引的 `knowledgeRoutes.ts:63` **行号已变 `:78`**)·
  `ParserTest.test.ts:180` · `SettingsView.test.ts:213` —— 改法同 P5c T10 注释轮
  (改成「带时点的历史记录 + 现状 + **引治理条目编号**」)。
  🔴 **连带纪律:注释里引「文件:行号」会随后续改动失效,引治理条目编号(如 §12.3 E-13)才稳。**
- **K36 的 a11y 契约没有常驻断言** —— 终审在真渲染里实测 `aria-labelledby` 与 `.k-modal-title` 的 `id`
  同值同元素(成立),但没用例钉住。先例 `IndexedFilesView.test.ts:1947`,补 3 行。

### 票 3 —— 守卫债(两条,同一张票)
- **具名色盲区**:中央 ③′ 守卫与全仓 `color-guard.test.ts` **只扫 `#hex`/`rgb()`/`hsl()`,不扫 CSS 具名色**
  (终审探针:塞 `color: white; background: red` → 三方守卫全绿)。**当前零真实违规、是继承缺口。**
  🔴 **踩坑预警**:**朴素匹配会假报红** —— `QueueView.vue:474` 有 `white-space: nowrap`,宽松的 `white` 会冤枉它。
  必须钉「属性值位置」,并配 RED + 反向探针两头验。
- **覆盖范围**:中央 ③′ 守卫只覆盖 `src/ai/knowledge/**`,**`src/ai/components/**` 的模板 `style=` 仍是盲区**。
- 另:**DM9**(`indexedFilesView.test.ts:128-139` 用例名过度声明)· `deferred.ts` **生产侧零消费者**
  (P5f 清空时一并决定去向)· `knowledgeStore.parser.test.ts:24` 的 `STATS` 是手工精简 body(缺 `models`)。

---

## 本期范围(蓝本坐标,🔴 一律用 `git show main:` 读,工作树是旧分支不可信)

前缀 `git -C /home/nimo/NimoTech/NimoOS-UI show main:`

| 蓝本 | 行数(已核) | 落到 New-UI |
|---|---|---|
| `src/views/AI/Knowledge/NotesView.vue` | **271** | rail 第 4 项「笔记」 |
| `src/views/AI/Knowledge/NoteEditPane.vue` | **338** | 组件 |
| `src/views/AI/Knowledge/NotesMarkdownEditor.vue` | **47** | 组件(tiptap) |
| `src/views/AI/Knowledge/notesViewHelpers.js` | **50** | util |
| `src/views/AI/Knowledge/noteEditHelpers.js` | **11** | util |
| (参考)`__tests__/noteEditHelpers.spec.js` · `notesMapper.spec.js` · `notesService.spec.js` · `notesView.spec.js` | — | Vue2 既有 4 份单测,**行为要承接** |

**合计 ≈ 717 行**,与上级设计 §4 的 P5d 估算一致。

**要反转的**:`deferred.ts` 的 `DEFERRED_TABS` 摘 **`'notes'`**(**5 项 → 4 项**)+
`knowledgeRoutes.ts` 的 `notes` 子路由 → 真 `NotesView`。
(现状:`DEFERRED_TABS` = `search` / `wiki` / `notes` / `roots` / `allowlist`,共 5 项。)

### 🔴 上级设计 D4:本期要装依赖
`@tiptap/vue-3` + `@tiptap/starter-kit` + `tiptap-markdown` —— `NotesMarkdownEditor` **1:1 复刻**
(富文本 + 工具栏 active 态 + 源码 textarea 双模式)。先例:SP9-P0 为 P5 装 `@novnc/novnc`。
⚠️ **装依赖会动 `package.json` / `pnpm-lock.yaml`** —— P5c 全期零改动这两个文件,P5d 要显式解禁并登记。

### 后端可用性(P5c 实测,会漂,自己现测)
- `service.notes.*` 共 **17 个方法**已在共享包内(P5a D3 已进包)→ **大概率 Service 仓零改动,先 grep 确认**
- Python agent **已重部署**,distill 接口真机可用
- `notes/settings` 现测:`{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}`
- 🔴 **`service.notes.getSettings/putSettings` 返回 camelCase 且只有 `{notesRoot, autoExtract}` 两个字段**
  (`normalizeSettings` 把 HTTP 的三个 `distill_*`/`background_model` **全丢掉了**)—— mock 层次见治理 §4.1

---

## 硬约束(与 P5c 相同)

- **可写仓只有 `.sp8/NimoOS-New-UI`**(分支 `sp8-ai`)
- `NimoOS-UI` **只读**。唯一例外:往 `docs/vue3-migration-sp3` 分支提 spec/plan/roadmap ——
  **必须带 pathspec**,且**该分支被 SP7/SP9 并发会话共用**,提交前先看有没有别人的新提交。
  🔴 **永远别在 `NimoOS-UI` 里 checkout / stash。**
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7,**有并发会话**)**一个字都不许碰**
- **不许跑 `./scripts/deploy.sh`、不写 `/var/lib`** —— 验收全走 `:5288`
- **每次改完代码 kill 重起 `:5288`**(P3a 教训:用户会验到陈旧代码);
  `.sp8` 的 `vite.config.ts` 已加 `optimizeDeps.exclude` 堵预打包缓存坑,**别删**
- 台账一律落 `.sp8/NimoOS-New-UI/.superpowers/`,**用 `git add -f`**(gitignore 挡着);
  🔴 SP7 曾因撤 worktree 前没搬台账而整个目录消失
- 新增 i18n 键**必须同时进 `zh_cn.ts` 和 `en_us.ts`**(`parity.test.ts` 会红)
- 颜色一律 theme token,禁色字面量

---

## 本期第一步是规划,不是编码

产出 `p5d-` 版治理差异 + plan(参考 P5c:**9 刀单车道**,T0 先做治理/附录/fixture 那一刀)。

🔴 **T0 是最值钱的一刀** —— P5c 的 T0 从协调者 brief 里查出 **7 处错**,全期累计核出 **25 处**(E-1~E-25)。
**错的类型分布值得先看一眼**(治理 §12.x):
行号偏 1–4 行是常态 · **范围边界错**会导致 sass 编译失败 · **「某东西会不会出现在产物里」的因果链错**(E-13)·
**「键名存在但语义不对」**(E-18,照抄不报错却渲染错)· **grep 判据分不清该区分的东西**(E-25,会得出假 Critical)。

plan 定稿后用 subagent-driven 执行(**每刀一个实现者 + 一个独立评审,最低 sonnet、禁 haiku**)。
🔴 **评审的「缺口猎」是常规动作,不是加分项** —— P5c 四次猎中,**全部是「产品代码对、守卫为零」**
(`--x:` 逃逸 · 守卫变量作用域 · 键选纪律 · mock 键集)。
