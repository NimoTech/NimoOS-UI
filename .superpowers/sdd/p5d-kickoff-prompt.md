承接 SP8-P5d 知识库笔记区的迁移。

## 0. 蓝本源(先看这条,别搞错基准)

🔴 **P5 全期蓝本锁定 `NimoOS-UI`@`7a6ee6b7`,不许换。** 一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>` 读。

- 用户当初对知识库的口径是「按 Vue2 最新远程代码为蓝本」,**但这条从没进治理文件,于是 P5a/P5b/P5c 三期实际用的都是 7-31 的本地快照 `7a6ee6b7`**。
- 2026-08-04 已走 SSH 实拉真远端(`65cfda58`,领先 16 个提交)逐文件比对:**P5 范围内差异清一色是「中文注释翻成英文」,`$t()` 字符串 / DOM / 类名 / 逻辑一处未变;`zh_CN.json` 零个键的值变了**(增删的 34 键全是相册区/新闻订阅/系统日志)。**P5d 五个笔记蓝本逐字相同。**
- → **用户 2026-08-04 拍板:P5 全期锁 `7a6ee6b7`**(同期基准不许漂;那些注释差异对我们零意义,因为移植规矩本来就是「注释重写成中文 + 蓝本行号」)。完整比对表见治理 §1.4。

🔴 **但你 T0 的第一个动作仍然是验一遍蓝本源**(治理 §1.4 新增的通用纪律):
```bash
git fetch git@github.com:NimoTech/NimoOS-UI.git main     # HTTPS 无凭据必失败
```
比对本期全部蓝本文件的校验和,**把「远端 sha + 逐文件比对结果 + 本期锁 7a6ee6b7」写进 T0 报告**。
若比出**功能性差异(非注释)**,**停下来问用户换不换基准**,不许自己决定。
⚠️ fetch 只写 `FETCH_HEAD` + 下载对象,**不动 `main` / `origin/main` / 工作树**(已实测;那个仓被 SP7/SP9 并发会话共用)。

## 1. 必读(按序)

1. **治理文件** `.sp8/NimoOS-New-UI/.superpowers/sdd/p5c-common-constraints.md` —— P5d 沿用,只产出 `p5d-` 版差异。
   **已是第四代**(P5a→P5b→P5c)。§3 的 **K1–K36**、§3.5 的 **N1–N22 + §3.6**、§9 的**第七~第十条**是
   「这算缺陷还是照抄」的唯一权威。
   🔴 **P5c 新增、对你直接生效的七条**:
   - **§1.3 / §1.3.1** 探针**允许**临时写零改动清单里的文件(md5 证还原 + 不在提交里 + 收尾干净);
     🔴 **但 `git status` 对 gitignore 产物(`dist/`、`node_modules/.vite/`)是瞎的** —— 那种情况还原的唯一证据是
     md5/diff + **强制干净重建 + 全目录 diff**。(实证:`NimoOS-Service/dist/wiki.d.ts` 被 07-31 的探针改成 `pathX`
     没还原,`git status` 全程干净、三门全绿,**污染活了三天**。)
   - **§1.4** 蓝本源锁定 + T0 必须验(见上)。
   - **§4.4** fixture 一律**抄进测试 + 注释标出处**,**不许运行时读 `.superpowers/`**(gitignore、SP7 整个丢过一次);
     抄完做**程序化逐字节等价校验 + 变异验证**,不许肉眼比。
   - **§9.1** 过期守卫要守**两件事**:守逻辑(交错用例)**+ 守作用域**(「两实例交错」用例;判据 = 把守卫变量
     挪模块级 → 那条必须报红)。
   - **§9.2 / §9.3** 「必须用键 A 不许用键 B、理由是 en 不同」这类条目,**只比 zh 的断言零判别力**
     (换成被禁键后 47/47 全绿);必须补 **en 档正/反向断言**;**撞车扫描双向**;键数用**真实模块导入**计。
     🔴 **这条连续三刀每刀都扫出协调者不知道的撞车对(T7 一对、T8 两对)。**
   - **§9.4** mock 打在**包边界**时,包内归一化函数(`normalizeSettings`)**在本仓不可测** →
     正解「**论证不适用 + 引上游守卫 + 附变异证据**」,不是删也不是硬凑。
     🔴 **协调者要求的用例若在本层不可能有判别力,那是 brief 的错、要登记勘误。**
     连带:「包返回恰好哪几个字段」也不受三门约束 → 要**显式加键集相等断言**。
   - **§9.5** 探针还原**禁用 `git checkout -- <path>` / `git restore`**(会连未提交编辑一起抹掉);
     只许「先存副本 → 注入 → 用副本覆盖 → md5 比对」。
2. **附录三份**:`p5c-appendix-A-i18n.md` · `p5c-appendix-B-tokens.md`(§6.4.1-2 参照色已订正,设置页真源
   `#FF9500`/`#34C759`)· `p5c-appendix-D-classes.md`(白名单现 **226** 类)
3. **挂账**:治理 **§8.4 / §8.5**(全部转 P5d 的票)+ **§12.x 的 E-1~E-25**(协调者 brief 累计被核出 **25 处错**
   —— 看一眼错的类型分布)
4. **上级设计**:`git -C /home/nimo/NimoTech/NimoOS-UI show docs/vue3-migration-sp3:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`
5. **P5c 的 plan 当模板**:`.superpowers/sdd/p5c-plan.md`(9 刀单车道 + 协调者裁定 A-1~A-5)

## 2. 起点

- 可写仓 `.sp8/NimoOS-New-UI`(分支 `sp8-ai`),产品代码 **`bbbdca4`** · Service `sp8-ai`@`15c2eba`
- 三门:**326 文件 / 3515 例**全绿 · `vue-tsc` 0 · `vite build` 0 · **`.vue` 179** · `aiKb*` **295**(全表 1503)
- dev server **`:5288`**,PID **401283**(已验证服务的是 `.sp8` 工作树)
- **未部署、未合 master**(`sp8-ai` 与 master 已分叉;与 `sp7-photos` 压同一 base、4 个冲突文件,合并顺序待用户拍板)
- **P5c 编码全部关账、终审 0 Critical;用户验收未走完** —— 卡在票 1。清单 `.superpowers/sdd/p5c-acceptance.md`(40 项),
  🔴 **A11(浅档指示灯色差)待用户拍板**:浅档 `--warning #92600c` / `--success #15754c` 比 Vue2 设置页真源
  `#FF9500`/`#34C759` **明显更深**,吃在 `.k-svc-light` 与 `.k-set-row-desc .warn` 上;协调者判「保全站一致、不开小灶」。

## 3. 🔴 三张挂账票(票 1 = 开工第一件事)

### 票 1 —— 知识库整区**没有导航入口**(P5a/P5b/P5c 三期都漏了)

用户 2026-08-04 验收时发现:`/ai/knowledge` **没有任何可点入口**,只能敲地址进。
路由已注册(`src/router/index.ts:18` + `:37`),但**全仓零导航链接**。

成因在 `src/ai/views/SettingsPage.vue:26-29` 的注释里(**SP8-P2a/P2b 产出**):顶栏「详情」原为
`<router-link to="/ai/knowledge">`(Vue2 `Settings.vue:22-24`),因当时该路由不存在会落空白死页,
**改成 `<button>` + info toast 占位**(`.set-detail-link` 类名保留、视觉 1:1)。
→ **P2a/P2b 处置正确,但 P5a 建好外壳后没有任何一期把入口还回去。**

🔴 **为什么三期都没发现(比 bug 本身值钱)**:① 那个按钮属于 P2a/P2b 产出、**不在 P5a-P5c 任何一刀范围内**;
② P5a 的 DoD 是「rail 9 项 1:1 + 占位机制」,**没有一条要求「从 AI 区能点进来」**;
③ 三期验收清单开头都写「知识库左栏第 N 项」,**默认了「你已经在知识库里」**。

**要做**:
- 「详情」从 `<button>` + info toast **反转回** `<router-link to="/ai/knowledge">` ——
  照 `knowledgeRoutes.ts` 那**四次**「反转不删、改前原文留成注释」的先例(P5a T12 / P5b T5 / P5b T10 / P5c T10);
- **`.set-detail-link` 类名与视觉不动**;
- 🔴 **配 RED 探针**:改回占位按钮 → 必须有断言报红;
- **顺带订正那段注释**(它现在还说「要到 SP8-P5 才存在」);
- ⚠️ `SettingsPage.vue` **在 P5c 的全期零改动清单里** → P5d 要**显式解禁**并在治理里登记;
- 🔴 **把治理 §13.4 落进 P5d 的验收清单纪律**:**清单第一项永远是「这一屏怎么从产品的正常导航走到」**;
  蓝本里也无入口的屏(如 `/ai/parser`,已实证 Vue2 相同)**要显式写明「无入口是 1:1,靠 X 进入」**。

**通用教训(写进 P5d 治理)**:**「跨期占位」是最容易烂尾的一类债** —— A 期为不落空白页做了占位,B 期把真页面建好,
但**没人负责把占位还回去**,因为那个占位在 A 期的文件里。→ **凡做「等 X 期才存在」的占位,当场就要把「还原」
写成 X 期的显式 DoD**,不能只留注释。

### 票 2 —— 注释债 + 一处 a11y 无守卫
`ParserStatus.test.ts:206`(🔴 **双重过期**:说「仍指占位页」已反,引的 `knowledgeRoutes.ts:63` **行号已变 `:78`**)·
`ParserTest.test.ts:180` · `SettingsView.test.ts:213` —— 改法同 P5c T10 注释轮(改成「带时点的历史记录 + 现状 +
**引治理条目编号**」)。🔴 **注释里引「文件:行号」会随后续改动失效,引治理条目编号才稳。**
另:**K36 的 a11y 契约没有常驻断言**(终审在真渲染里实测 `aria-labelledby` 与 `.k-modal-title` 的 `id` 同值同元素
= 成立,但没用例钉住)。先例 `IndexedFilesView.test.ts:1947`,补 3 行。

### 票 3 —— 守卫债
- **具名色盲区**:中央 ③′ 守卫与全仓 `color-guard.test.ts` **只扫 `#hex`/`rgb()`/`hsl()`,不扫 CSS 具名色**
  (终审探针:塞 `color: white; background: red` → 三方守卫全绿)。当前零真实违规、是继承缺口。
  🔴 **踩坑预警:朴素匹配会假报红** —— `QueueView.vue:474` 有 `white-space: nowrap`,宽松的 `white` 会冤枉它。
  必须钉「属性值位置」,配 RED + 反向探针两头验。
- **覆盖范围**:中央 ③′ 守卫只覆盖 `src/ai/knowledge/**`,**`src/ai/components/**` 的模板 `style=` 仍是盲区**。
- 另:**DM9**(`indexedFilesView.test.ts:128-139` 用例名过度声明)· `deferred.ts` **生产侧零消费者**
  (P5f 清空时一并决定去向)· `knowledgeStore.parser.test.ts:24` 的 `STATS` 是手工精简 body(缺 `models`)。

## 4. 本期范围(蓝本 `7a6ee6b7`,行数已核)

| 蓝本 `src/views/AI/Knowledge/…` | 行数 | 落到 New-UI |
|---|---|---|
| `NotesView.vue` | **271** | rail 第 4 项「笔记」 |
| `NoteEditPane.vue` | **338** | 组件 |
| `NotesMarkdownEditor.vue` | **47** | 组件(tiptap) |
| `notesViewHelpers.js` | **50** | util |
| `noteEditHelpers.js` | **11** | util |
| (参考)`__tests__/{noteEditHelpers,notesMapper,notesService,notesView}.spec.js` | — | Vue2 既有 4 份单测,**行为要承接** |

**合计 ≈ 717 行**,与上级设计 §4 一致。

**要反转的**:`deferred.ts` 的 `DEFERRED_TABS` 摘 **`'notes'`**(**5 项 → 4 项**;现状 = `search`/`wiki`/`notes`/`roots`/`allowlist`)
+ `knowledgeRoutes.ts` 的 `notes` 子路由 → 真 `NotesView`。

### 🔴 上级设计 D4:本期要装依赖
`@tiptap/vue-3` + `@tiptap/starter-kit` + `tiptap-markdown` —— `NotesMarkdownEditor` **1:1 复刻**
(富文本 + 工具栏 active 态 + 源码 textarea 双模式)。先例:SP9-P0 为 P5 装 `@novnc/novnc`。
⚠️ **装依赖会动 `package.json` / `pnpm-lock.yaml`** —— P5c 全期零改动这两个文件,P5d 要**显式解禁并登记**。

### 后端(P5c 实测,会漂,自己现测)
- `service.notes.*` **17 个方法**已在共享包内(P5a D3 已进包)→ **大概率 Service 仓零改动,先 grep 确认**
- Python agent **已重部署**,distill 接口真机可用
- 🔴 **`service.notes.getSettings/putSettings` 返回 camelCase 且只有 `{notesRoot, autoExtract}` 两个字段**
  (`normalizeSettings` 把 HTTP 的三个 `distill_*`/`background_model` **全丢掉了**)—— mock 层次见治理 §4.1

### 剩余批次(供你排期参考)
P5d 笔记 **717** → P5e 搜索 **820**(`SearchView` 401 + `searchAggregate` 79 + `FileDetailDrawer` 220 + `KFileViewer` 120)
→ **P5f Wiki + 索引根 + 白名单 947**(`WikiView` 314 + `wikiViewHelpers` 95 + `RootsView` 289 + **`AllowlistView` 249**)。
🔴 **`AllowlistView` 用户 2026-08-04 拍板归 P5f**(治理 §4.5);连带 `.k-section-body`(蓝本 `knowledge.scss:985-991`,
P5c 因它移出而故意没搬,见 E-3)也归 P5f 搬。P5f 同时**清空 `DEFERRED_TABS` 并保留机制**(K7,承 P4 I2 教训)。

## 5. 硬约束

- **可写仓只有 `.sp8/NimoOS-New-UI`**。`NimoOS-UI` **只读**,唯一例外是往 `docs/vue3-migration-sp3` 提
  spec/plan/roadmap(**必须带 pathspec**;该分支被 SP7/SP9 并发会话共用,提交前先看有没有别人的新提交)。
  🔴 **永远别在 `NimoOS-UI` 里 checkout / stash。**
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7,**有并发会话**)**一个字都不许碰**。
- **不许跑 `./scripts/deploy.sh`、不写 `/var/lib`** —— 验收全走 `:5288`;**每次改完 kill 重起**(P3a 教训);
  `.sp8` 的 `vite.config.ts` 已加 `optimizeDeps.exclude` 堵预打包缓存坑,**别删**。
- 台账落 `.sp8/NimoOS-New-UI/.superpowers/`,**`git add -f`**(gitignore 挡着);🔴 SP7 曾整个目录消失。
- 新增 i18n 键**必须同时进 `zh_cn.ts` 和 `en_us.ts`**;颜色一律 theme token,禁色字面量。

## 6. 第一步是规划,不是编码

产出 `p5d-` 版治理差异 + plan(参考 P5c:**9 刀单车道**,T0 先做「验蓝本源 + 治理/附录/fixture」那一刀)。

🔴 **T0 是最值钱的一刀** —— P5c 的 T0 从协调者 brief 查出 **7 处错**,全期累计 **25 处**。错的类型分布:
行号偏 1–4 行是常态 · **范围边界错**会让 sass 编译失败 · **「某东西会不会出现在产物里」的因果链错**
(E-13:`.vue` 光「存在且写了 import」进不了产物,还得**被入口可达地 import**)·
🔴 **「键名存在但语义不对」**(E-18:`aiKbInferenceDevice` 真实存在但是行标题,**照抄不报错却渲染错**,
所有自动检查都抓不到)· **grep 判据分不清该区分的东西**(E-25,会得出**假 Critical**)。

plan 定稿后用 subagent-driven 执行(**每刀一个实现者 + 一个独立评审,最低 sonnet、禁 haiku**)。
🔴 **评审的「缺口猎」是常规动作,不是加分项** —— P5c **五次猎中,全部是「产品代码对、守卫为零」**
(`--x:` 逃逸 · 守卫变量作用域 · 键选纪律 · mock 键集 · 具名色)。
