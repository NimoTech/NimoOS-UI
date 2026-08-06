# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-07-31-vue3-migration-sp8-p5a-knowledge-shell.md

工作区(用户指定,覆盖 skill 默认的 per-plan 子目录):台账与工件一律落
`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/`,前缀 `p5a-`。

派工链(不是任务编号顺序):T0 → T1 → T2 → T3 → T4 → T5 → T8 → T6 → T9 → T7 → T10 → T11 → T12

起点:New-UI sp8-ai@99ee99a(303 文件 / 2719 例绿 · tsc 0 · build 0)· Service sp8-ai@c8f1919(190/190)

## 预检(协调者,2026-07-31)

- 计划无内部矛盾需用户裁定;N1–N8「照抄不改」是用户已拍板项,不进评审缺陷池(评审须核「有没有被顺手修正」)。
- 已回源核实三处计划文字瑕疵(不影响执行,已写进对应 brief,一律以权威源为准):
  - T3 测试注释写「18 个 name」,实际数组 22 个;逐个核过蓝本 `KIcon.vue`,22 个全部存在。
  - 蓝本 `KIcon.vue` 实际 **42** 条 glyph(协调者预检时误写 43,见文末 Task 0 那条订正;设计 §2.5 叙述句 42 / §4 结论句 43 自相矛盾)→ **以 42 为准**。
  - `aiCfgYou` 实测 zh=`你`(zh_cn.ts:605)/ en=`You`(en_us.ts:603),K8 回落文案可复用,不新增键。
- `:5288` 现由 P4 遗留 pid 1355965 占用,收官前 kill 重起。

## 协调者裁定 R1(2026-07-31)—— 附录 D.1 白名单补 6 个 `.k-empty*` 类

**冲突**:附录 D 说白名单是「98 个 `k*` 类,一个不多一个不少」,而 D.1(T4 那 32 个)是**只从 `KnowledgeLayout.vue` + `DashboardView.vue` 两个模板里抽的**,不含 `.k-empty*`;但 T5 的 brief 明文要求 `KnowledgeDeferred.vue`「复用 `knowledge.scss` 已有的 `.k-scroll`/`.k-empty*` 类(用前 grep 确认类名真实存在)」。两条不能同时满足 → 占位页会渲染成无样式。

**裁定**:T4 的白名单**加** `.k-empty` / `.k-empty-illust` / `.k-empty-title` / `.k-empty-sub` / `.k-empty-tips` / `.k-empty-tip` 六个 → T4 共 **38** 个类。
**依据**:① 这 6 个是蓝本 `knowledge.scss` 里**真实存在**的类(已 grep 实证),不是凭空造的 ② 附录 D「一个不多一个不少」说的是它的**推导来源**(两个模板),而 `KnowledgeDeferred.vue` 是 New-UI 独有的新增页(Vue2 没有对应物),它的样式需求推导时没被算进去 ③ 后续批次(P5b–P5f)的空态也要用它们,现在搬不算搬多。
**连带**:T4 的自检命令 ② 「白名单外的 `k-`/`k2-` 类」判据里,这 6 个视为白名单内;T11 不受影响。

## 协调者裁定 R2(2026-07-31)—— 附录 B 的「New-UI 已有的直接用」对 `*-soft` 家族是错的,T4 必须在 token 声明层补齐

**坑**:附录 B「规则段落里的裸色 → token 对照」说 `rgba(52,199,89,0.1x)` → `var(--success-soft)` 这类「New-UI 已有的直接用」。**实测:这一族 token 只存在于 `src/ai/styles/tokens.scss`,而该档的选择器是 `.agent-app, .ai-toast-scope`(`:32`)与其暗色块(`:250`)。`.knowledge-app` 既不是 `.agent-app` 也不是 `.set-app` → `var(--success-soft)` 在知识库区【解析不到】,渲染成透明/无色。**

实测归属:
- **只在 `tokens.scss`(知识库区拿不到,必须自己声明)**:`--success-soft`(浅 `:129` / 暗 `:306`)· `--success-soft-border`(`:130`/`:307`)· `--danger-soft`(`:131`/`:308`)· `--danger-soft-border`(`:132`/`:309`)· `--danger-soft-faint`(`:145`/`:314`)· `--warning-soft`(`:126`/`:303`)· `--warning-soft-border`(`:127`/`:304`)· `--purple-soft`(`:133`/`:310`)· `--teal-soft`(`:149`/`:316`)· `--modal-scrim`(`:182`/`:338`)
- **在全局 `theme.css` `:root`(知识库区可直接 `var()`)**:`--accent-soft-2`(暗 `:60` / 浅 `:275`)—— 附录 B 这条是对的,保留

**裁定**:T4 的 `.knowledge-app` token 声明层**必须把实际用到的这一族一并声明**(浅色档取 `tokens.scss` 浅色块值、暗色档取暗色块值)。这与附录 B 自己定的规则(「暗色档一律落 AI `tokens.scss` 暗色块的字面值」)同向,只是附录漏把它延伸到 `*-soft` 家族。**只声明真正用到的**;T4/T11 报告里列清声明了哪几个、值取自哪一行。
**为什么必须提前拦**:这类错单测与 `color-guard` **都抓不到**(记忆 `sp8-ai-migration-progress` 的「AI 区是嵌套容器」已爆三次),只在真机切主题时表现为「徽标/警示条透明」—— 而附录 C 验收清单第 11 条正是查这个。

## 协调者裁定 R3(2026-07-31)—— T4/T11 增一个 `knowledgeStyles.test.ts`,把「scss 没有回归网」这条风险真正兜住

设计 §9 风险 1 写的是「`knowledge.scss` 2561 行 / 133 处色字面量,而 color-guard 不扫 `.scss` → 配色只有人肉评审一道防线」,并建议「每批 scss 任务单独派一个评审专做逐行色扫」。

**但本仓已有现成先例可用**:`src/ai/styles/settingsStyles.test.ts`(313 行,P2a/P2b 建的)用 `node:fs` 读 `.scss` 原文做结构守卫,已在守 `settings-styles.scss` / `tokens.scss` / `sk-shared.scss` 三档,其中就包括「不重复定义 token」与「嵌套主题作用域必须自带 `color-scheme`」两条。

**裁定**:T4 新建 `src/ai/styles/knowledgeStyles.test.ts`(照那份的技法),至少守四条:
① 附录 D.1 + R1 的 **38** 个类逐个存在(把附录 D.4 自检命令①变成常驻用例)
② **token 声明块之外全文零色字面量**(`#hex` / `rgb(` / `rgba(` / 具名色),声明块内豁免 —— 这就是 color-guard 扫不到的那块
③ `.knowledge-app` 两档都声明了 `color-scheme`(设计 §5.4 / P2b 教训①)
④ R2 那批 `*-soft` token 在两档声明层里都有值

**这不是偏离计划,是补计划自己点出的缺口**;技法照既有先例、不新建模式。三处必须照抄先例的环境坑(该文件头注释已写明):本仓 `"type": "module"` → `__dirname` 不可用,用 `fileURLToPath(import.meta.url)`;未装 `@types/node` → `node:fs/path/url` 三行各加 `@ts-expect-error`;**断言前必须先剥注释**(`//` 整行 + `/* */` 块),否则注释里提到的类名会把 `toContain` 撞对(P2b 二次评审用 RED 探针实证过)。

**算术连带**:T4 因此 **+1 个测试文件**(不新增 `.vue`,color-guard 用例数不变)→ 计划里 T5 起的「文件数」预测值全部 +1。**每个任务以我给的实测基线为准,不要用计划里的预测数。**

## 进度

Task 0: fix round 1/5(2 addressed, 0 open —— §5 toast.ts 行号 18→21 · §3 K3 蓝本行号 96-99→93-96;commits 30fc053..6dd2079)
Task 0: complete (commits 99ee99a..6dd2079, review clean) —— `p5a-common-constraints.md` 241 行,11 节骨架齐
Task 1: 实现完成 commit 705649d(Service 仓,`notes.ts` + `notes.test.ts` + `index.ts`,509 行全新增);Service 全量 25 文件 / 210 例绿 · New-UI vue-tsc exit 0 · New-UI 无文件变动(lockfile 未动)
Task 1: 已授权结构性偏离(协调者拍板)—— 蓝本 6 个沉淀函数是模块级 named export,本仓收进 `createNotes(http)` 返回对象;只 `isDistillableName`/`DISTILL_EXTS` 仍模块级 + 根导出。方法体逐行等价蓝本,评审已核。
Task 1: 评审 Spec ✅ / 质量通过,1 条 Important 进修复轮 —— `/settings` 家族四方法只断言 URL/动词,不断言返回值形状;RED 探针实证:把 `getSettings` 的归一化器换成 `normalizeNotesSettings`(两端点同 URL)后 16/16 仍全绿 → 「用错归一化器」现在抓不到,对 T7 要紧。
Task 1: 🔴 **Service 仓真实基线是 194 例 / 24 文件,不是计划写的 190/190**(两个评审各自用 git worktree 检出 `c8f1919` 独立跑过)。协调者一度写成「194/25 → 210/26」也是错的,由 T1 实现者按实测订正、复评复核确认:**基线 194 例/24 文件 → T1 落地后 214 例/25 文件**。`p5a-common-constraints.md` §8 已改成实测值(commit 6301287)。**T2 的算术起点 = 214 例 / 25 文件。**
Task 1: fix round 1/5(2 addressed, 0 open —— `/settings` 四方法补 4 条判别力断言 · 治理文件 §8 基线订正;commits 705649d..feb85bc + New-UI 6301287)
Task 1: complete (Service commits c8f1919..feb85bc,New-UI doc 6301287,review clean)—— Service 25 文件/214 例绿 · New-UI vue-tsc exit 0。复评两次独立 RED 探针均精确报红并还原。
Task 2: 实现完成 commit 55f42dc(Service 仓,`wiki.ts` + `wiki.test.ts` + `index.ts`);Service 26 文件 / 227 例绿 · New-UI vue-tsc exit 0 · New-UI 无文件变动
Task 2: 已申报偏离(评审裁定**合理**)—— `createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled` 四个写方法改 `async` + `return res.data`(蓝本是直接把原始 axios promise 交出去)。依据 K1「包内已剥一层」+ T1 `notes.ts` 同类方法先例;蓝本调用方从未用过 axios 信封字段。
Task 2: 实现者主动补 2 条判别力断言(`getRoots` 喂 PascalCase / `getTree` 喂 snake_case,各钉完整归一化输出)—— 承 T1 那条「同形状方法互换 normalizer 照样全绿」的教训,这次没重犯。
Task 2: 评审 Spec ✅ / 质量通过,1 Important + 1 Minor 进修复轮 —— ① `getCandidates` 声明 `Promise<WikiCandidate[]>` 但实现成 `Promise<unknown[]>` 且该类型未定义未导出,且未申报 ② 四个写方法那条偏离缺行内注释(只在报告里申报,代码里没有)。
Task 2: fix round 1/5(2 addressed, 0 open —— `WikiCandidate` 补齐并就地导出 + 四个写方法补行内注释;commits 55f42dc..03d3028)。实现者回读了后端 `NimoOS-Wiki/service/roots/candidates.go:13-18` 拿真结构体(`Path`/`Type` 恒有、`Size`/`Label` 是 `omitempty`),复评独立核实无编造字段。
Task 2: **parked —— 复评在修复 diff 里新报的 Important「`WikiCandidate` 被 `res.data as WikiCandidate[] | null` 的 any 源转换架空,对自身重构零编译期约束力」。ruling:事实成立但严重度定错,不是本任务引入的缺陷,代码照原样保留。**
  依据(协调者回源核实):`res.data as X` 是**本包通行惯例**,10 个文件 20 处在用,与 `wiki.ts:156` 形状完全相同的有 `cloud.ts:11` `as RawCloud[]` · `samba.ts:12,25` `as RawConnection[]/RawShare[]` · `driver.ts:11` `as RawDriver[]`。要求 wiki.ts 单独换写法 = 与需求无关的重构,且会让本域与兄弟域不一致。
  另:复评的探针只 build 了 Service 仓,而**这个类型的约束力本来就落在消费端** —— T7 读 `c.path` 时若字段改名会真报错;现在没报是因为 T7 还没写。该类型的注释已自陈「声明式断言、非运行时保证」。
  → 降级为 Minor,交整期终审复核这条 ruling。
Task 2: minor (deferred): 新增注释里引「蓝本 `wiki.js:89-92`」有误,复评实测四个写方法真实行号是 **93-96**(89-92 是 `getRaw` 的方法体)。**留给终审修复轮一次性收**(本期第三次同类:注释/文档里的 `file:line` 靠印象写就会错)。
Task 2: complete (Service commits feb85bc..03d3028, 1 parked + 1 deferred minor)—— Service 26 文件/227 例绿 · New-UI vue-tsc exit 0
Task 3: 实现完成 commit 3d44a67(New-UI 仓,`KIcon.vue` + `KIcon.test.ts`);304 文件 / 2724 例 · tsc 0 · build 0。42 条 path 的逐字节等价由**两次独立比对**建立:实现者 `awk` 抽 `PATHS` 体后 `diff`(0 行差异),评审再用 `awk`+`diff`+排序 `md5sum`(两侧同为 `442ad5d8…`)。props 默认值实测 `size:16` / `color:'currentColor'` / `strokeWidth:1.6`;未命中行为是 `PATHS[name] || ''`(**不是 brief 猜的 `??`**)。`AgentIcon.vue` 未被触碰(K4 要害)。
Task 3: 评审 Spec ✅ / 质量通过,1 条 Important 进修复轮 —— **42 个 glyph 里只有 7 个有强断言,其余 35 个只受「22 个 name 非空」的弱断言覆盖**;评审 RED 探针实证:互换 `history` 与 `layers` 两条 path → 4 passed 全绿一条不红。修法=补一条覆盖全 42 条的 `toMatchSnapshot()` 防漂移用例(快照锁的是已由 diff 验证过的状态,不是用来验移植对错)。
Task 3: 澄清(不改代码)—— 治理文件 §6 那句「color-guard 逐行扫 `.vue` 的 `<style>` 块且不跳注释行」的准确含义是:**只扫 `<style>` 内部,但不跳过 `<style>` 里的注释行**;模板/脚本区注释它不管。评审读出歧义,已澄清。
Task 3: fix round 1/5(1 addressed, 0 open —— 补 42 条 glyph 全量 `toMatchSnapshot()` 防漂移用例 + 快照文件一并提交;commits 3d44a67..9a3e938)
Task 3: complete (commits 6301287..9a3e938, review clean)—— **304 文件 / 2725 例绿 · tsc 0 · build 0**。复评独立重做 history/layers 互换探针:现在精确报红在新快照用例、diff 只定位那两行,其余 4 例全绿;快照 42 键与蓝本键集逐一一致、已进提交。
Task 4: 实现完成 commit 71ae0ee(`knowledge.scss` + 新建 `knowledgeStyles.test.ts`);**305 文件 / 2732 例绿 · tsc 0 · build 0 · `pnpm exec sass` 编译 exit 0(671 行 CSS)**。38/38 白名单类到位、无混合规则需拆、与 agent/settings/skills/sk-shared 无类名重名。R2 实际只用到 4 个 `*-soft`(`--warning-soft`/`--warning-soft-border`/`--success-soft`/`--danger-soft`),两档各一份;`--accent-soft-2` 按例外走全局。两次 RED 探针(塞 `#ff0000` / 删 `color-scheme`)均精确报红并还原。
Task 4: 实现者自查抓到**附录 B 的一处真错**:浅色档表把 `--accent`/`--accent-soft`/`--success` 写成 `var(--全局同名 token)`,而全局那三个**恰好同名** → `--accent: var(--accent)` 是自定义属性自引用循环(guaranteed-invalid),不是「引用外层值」。**附录 B 这三行错,以实现为准。**
Task 4: 评审前协调者自查发现 1 条 Critical 进修复轮 —— 实现者的绕法(浅色档「不声明、靠继承」)**反而拿到暗色值**:基础块 `.knowledge-app { --accent: #5E97F2 }`(`:53,70`)**无 data-theme 限定,浅色下同样命中**,而自定义属性「元素自身有声明就走不到继承」→ 浅色档实际是暗色调色板。修法=浅色档显式声明三项字面值(`#3b5bdb` `theme.css:183` / `rgba(59,91,219,0.11)` `:274` / `#15754c` `:281`),代价是这三项不再自动跟随全局改色(**同名强制**,要恢复须给知识库档 token 改名,另开一期),并补测试守卫钉住这三项必须在浅色块出现。
Task 4: 交接 T11 —— **`k2pulse` / `k2spin` 两个 keyframes 在蓝本 `knowledge.scss:2440-2441`,位于 `k2-*` 段内部,不在 T4 的 `1510-1539` 全局 keyframes 段** → 归 T11 搬(计划 T4 Interfaces 那行把它们列进 T4 是不准的)。已记,写进 T11 任务书。
Task 4: fix round 1/5(1 addressed, 0 open —— 浅色档显式声明三项字面值 + 补守卫用例;commits 71ae0ee..f634b47)。实现者顺带核了两档全部 `var()` 引用:暗色块零引用、浅色块其余 8 处全指向不同名 token,无其它同名自引用问题。
Task 4: 评审(opus)Spec ✅ / 质量通过 / **Critical 0**。逐行色扫:规则段落 0 处色字面量、`theme-exception` 0 处;38/38 类到位(31 个逐字等价,5 个差异全是附录 B 授权的裸色→token)、属性态零漏、`.k-toast` 零命中、混合规则「无需拆」属实(蓝本 6 处逗号选择器无一含白名单类)、7 条 keyframes 齐、`[data-theme="dark"]` 零命中、与四档既有 scss 零重名;**浅色档两栏差集表:基础块 45 个颜色 token / 浅色块 39 / 差集 6,逐个判定「真漏 0 个」**;规则段落引用到但声明层没声明的 token **无**(31 个 `var()` 全覆盖)。
Task 4: 🔴 **评审 RED 探针证出守卫本身两个窟窿**(比样式错更要紧 —— T11 要往同一文件加 65 个类):
  ① **`\b` 在 `-` 前成立** → `/\.k-topbar\b/` 被 `.k-topbar-title` 满足,**9 个前缀类**(`k-rail`/`k-rail-item`/`k-rail-svc`/`k-topbar`/`k-banner`/`k-badge`/`k-scroll`/`k-mobile-tab`/`k-empty`)存在性断言空转。探针:删唯一的 `.k-topbar { }` → 8/8 全绿。改 `(?![\w-])`。
  ② **色扫跑在 `stripComments()` 之后** → 注释里的裸色永远抓不到。探针:注释里塞 `#ff0000`/`rgba(...)`/`white` → 8/8 全绿;同处改真实声明则精确报红。剥注释只该用于类名/token 存在性断言,色扫要用未剥注释的原文(只切两个声明块区间)。
Task 4: 协调者裁定 R4 —— **`--shadow-*` 不是结构量,必须分两档**。附录 B 把它当「结构量两档共享」且取的是 `tokens.scss:107-110` 的**浅色**暖投影,而 `:360-363` 另有暗色投影 → 默认暗色主题下 `.k-rail-item[data-active]`(`:269`)与 `.k-rail-svc`(`:312`)的阴影几乎不可见,T11 卡片会放大。**阴影含颜色,按治理文件 §6「每个颜色 token 两档都要有值」办;附录 B 那行是错的。**
Task 4: 协调者裁定 R5 —— **注释里色字面量的口径定死**:规则段落里的注释一律不许出现任何色字面量(Vue2 的、New-UI 的都不行),改「蓝本行号 + 中文描述」;**两个 token 声明块里允许**(那里的字面量就是被声明的值)。评审 I3 点名 12 行(`:12,293,319,324,329,370,372,379,386,419,480,481`)要改。
Task 4: **parked —— 评审 M2「`--accent-soft-2` 暗色下解析到全局 `theme.css:60` 的 `rgba(138,180,255,0.24)`,而本档 `--accent` 是 `#5E97F2`,色相略错配」。ruling:附录 B 明令直用全局该 token,且这是 0.2 alpha 的边框色、观感差异极小 → 本轮不改,交整期终审复核。** 若要改,正解是在两档各自声明本地 `--accent-soft-2`(暗 `rgba(94,151,242,0.24)` / 浅 `rgba(59,91,219,0.2)`)。
Task 4: 交接 T10 —— 评审的两条(**都很要紧**):① **`.knowledge-app` 跟随全局 `<html>[data-theme]`,不跟 AI 区的 `aiTheme` 容器态** → T10 **不可**在 `.knowledge-app` 上写 `:data-theme="aiTheme.theme"`(切了没反应);知识库区也因此不跟 AI 区的明暗开关联动,这是 D5 的设计意图 ② **目前无任何文件 import `knowledge.scss` = 死代码** → T10 必须 `import '../../styles/knowledge.scss'`(照 `AgentPage.vue:71-72` 先例),且验收要在 DevTools 里确认样式真命中。
Task 4: fix round 2/5(5 addressed, 0 open —— `\b`→`(?![\w-])` · 色扫改跑未剥注释原文 · 12 处注释裸色改「行号+中文描述」 · 色扫正则补 hsl/lab/lch/hwb/color()+5 个具名色(`transparent` 不禁) · R4 阴影两档分声明 + 逐 token 精确比对守卫;commit 76367d2)。实现者第一版 R4 守卫是子串检查,**被他自己的探针发现空转、已重写**。
Task 4: complete (commits 9a3e938..76367d2, review clean, 1 parked)—— **305 文件 / 2734 例绿 · tsc 0 · build 0 · sass exit 0(721 行 CSS)**。复评独立做了 7 次 RED 探针(两个前缀类删规则、注释塞裸色、剥注释反向确认、hsl()、具名色 orange、`transparent` 反向不误伤、浅色 `--shadow-sm` 值改坏)全部精确报红并还原;`--shadow-*` 两档值与 `tokens.scss:360-363`/`:107-110` 逐字一致。
Task 4: minor (deferred): 文件头设计说明注释块(`:37-60`)里仍有色字面量,且守卫的扫描区不覆盖它(它在两个 token 声明块之前)。**口径澄清**:该块是本档的设计依据说明,要引 `theme.css`/`tokens.scss` 的具体取值才讲得清,**允许带值但必须带出处**;规则段落里的注释仍然一律禁色。交终审复核这条口径。

## 协调者裁定 R6(2026-07-31)—— 占位页那 2 条 i18n 键由 T5 自己落,T8 只落 94 条

派工链把 T8(i18n)排在 T5 之后,但 T5 的 `KnowledgeDeferred.vue` 要用 `aiKbDeferredTitle` / `aiKbDeferredHint` —— 若等 T8,T5 这一个提交里就有引用了不存在的键的组件,且它的测试没法断言中文值(只能绕过去)。

**裁定**:这 2 条(附录 A 末尾「Vue2 语言包里没有、本期新造的 2 条」)由 **T5 自己同时落进 `zh_cn.ts` 与 `en_us.ts`**,值逐字照附录 A:
- `aiKbDeferredTitle` — en `Coming soon` / zh `即将上线`
- `aiKbDeferredHint` — en `This page is still being migrated to the new UI.` / zh `这个页面还在迁移到新界面。`(**句末是中文句号**)
→ **T8 因此落 94 条,不是 96 条**;T8 开工前先 grep 确认这 2 条已在,不要重复定义(重复属性 = TS 错误)。

Task 5: 实现完成 commit 5644ed8(9 文件:`deferred.ts`+test / `KnowledgeDeferred.vue` / `knowledgeRoutes.ts`+test / `router/index.ts`+test / 两个语言包);**307 文件 / 2742 例绿 · tsc 0 · build 0**。11 条路由 path 顺序/name/component 三项逐条吻合蓝本(含 `wiki` 在 `search` 后、`notes` 在 `allowlist` 后两处陷阱);`router/index.ts` 足迹只 +2 行。
Task 5: 申报偏离 —— PascalCase 路由名(照 Vue2,本仓既有是 kebab)· eager import(照本仓,蓝本是懒加载)· 不照抄 Vue2 的 `meta` 键(本仓 meta 语义不同,只用 `meta.public`)· R6 提前落 2 条 i18n 键 · K7 占位机制。另申报一处改 brief 测试代码:`DEFERRED_TABS.includes(notListed)` 实测真报 TS2345(元组字面量类型窄于 `KnowledgeTabId`),改 `(DEFERRED_TABS as readonly string[]).includes(...)` —— 评审把它改回原文实测确认 TS2345 属实,且断言力未下降。
Task 5: 主动加断言「本批 11 条路由 component 全部 === `KnowledgeDeferred`」供 T12 反转(承 P4 I2)。
Task 5: complete (commits 76367d2..5644ed8, review clean)—— 评审零 Critical/零 Important;i18n 两键用脚本 `codePointAt` 逐码点比对 4/4 MATCH(`aiKbDeferredHint` 中文句末码点 `3002` = 中文句号,英文句末 `2e`);独立 RED 探针把 `isDeferred` 改成恒真 → `deferred.test.ts` 3 例中 2 例精确报红,已还原。唯一 ⚠️ 是附录 D 未列 `k-empty*` —— 即协调者裁定 R1,已处理。
Task 8: 实现完成 commit c28e0ee(两个语言包各 +94 条 `aiKb*`,194 行插入 0 删除);**307 文件 / 2742 例绿 · tsc 0 · build 0**(不新增 `.vue`/测试文件,与 T8 前基线同)。
Task 8: 🔴 **本任务最有价值的证据链** —— 附录 A 那张表与权威源 `git show main:src/assets/lang/zh_CN.json` **零差异**(两方独立逐码点比对确认),但**实现者手抄进 TS 时引入了 5 处全角标点错**(`aiKbOnboardBody` / `aiKbLayerWikiDesc` / `aiKbLayerVecDesc` / `aiKbLayerNoteDesc` / `aiKbDistillFromChats`),被强制的复核脚本逮住并修好。**「计划表对」不等于「抄进去对」,逐码点复核这一步不能省**(P2a 栽三次、P3b 栽 2 键的同族第三次)。
Task 8: 评审(独立自写脚本三向比对)Spec ✅ / 质量通过 / 零 Critical / 零 Important。中文 94/94、英文 94/94 零不一致;那 5 处修复逐个确认;键集/重复定义/占位符/三处近义串不合并/N8「系统设置≠高级设置」/既有键零改动 全过。`aiKbServiceOfflineBanner` 的全角逗号(码点 `ff0c`)**是 Vue2 原文如此,照抄正确,不是漏网**。
Task 8: 🔴 查实的既有守卫边界(两方各自探针实证:改标点/改占位符全绿,无人报红)—— `parity.test.ts` 只守「键集相等 + 非空 + 3 个硬编码抽查值」;`messageSyntax.test.ts` 守「全局裸 `@` + 历史事故键精确值 + **P3b 那 74 个键的全角标点扫描**」。**机制已有,范围没扩到本批。**
Task 8: 协调者裁定 R7 —— 在 `messageSyntax.test.ts` 里照既有 P3b 74 键那段的写法扩两条,**只圈本批 94 键**:(a) 全角标点扫描,**例外只登记 `aiKbServiceOfflineBanner`**(Vue2 原文即全角) (b) 新增「本批 94 键的插值占位符两档名称集合一致」。
  **必须只圈本期、不许全量**:评审扫过全部 1303 个既有键,有 2 处两档占位符不一致是**有意设计** —— `aiResTurn`(zh `{n,time}` / en `{n,s,time}`)、`aiResFilesInTurns`(zh `{files,turns}` / en `{files,s,turns}`),那个 `{s}` 是英文复数后缀(`ResourcesTab.vue:223,228` 已确认)。全量生效会立刻红两条既有用例。
Task 8: fix round 1/5(R7 两条守卫 addressed, 0 open;commit a13d6fa,122 行新增 0 删除)。(a) 全角标点扫描扩到本批 94 键(`/[，；：？！（）]/`,比 P3b 那段的 3 字符集更宽,因为真实事故是逗号),**例外 `aiKbServiceOfflineBanner` 写成强断言**(`toBe` 钉死带全角逗号的确切值,不是「跳过扫描」的松形式);(b) 占位符两档名称集合一致,只圈本批 13 个带占位符的键。共 +5 个 `it`(2 条主校验 + 2 条 P3b 同款「exactly N keys」防漂移 + 1 条例外强断言),复评逐条判定无空转。
Task 8: complete (commits 5644ed8..a13d6fa, review clean)—— **307 文件 / 2747 例绿 · tsc 0 · build 0**。复评 4 次独立探针全部精确报红并还原(全角逗号 / `{n}`→`{count}` / 例外反向改半角 / 从键列表删一个键触发「exactly 94」)。程序化比对:守卫圈定 94 键 vs `zh_cn.ts` 全部 96 条 `aiKb*`,差集恰为 T5 那 2 条(无 Vue2 源,有意排除);13 键占位符清单零遗漏;`aiResTurn`/`aiResFilesInTurns` 确未被卷入。
Task 6: 实现完成 commit 732dde5(4 文件 / 724 行新增:`knowledgeStore.ts` 442 + `knowledgeStore.parser.test.ts` 222 + `util/indexedFiles.ts` 28 + 其 test 32);**309 文件 / 2765 例绿 · tsc 0 · build 0**。搬了 20 个 action/helper + `buildListParams`/`anyIndexing`。
Task 6: 评审逐项独立核过并通过 —— K1 六个命中点全对 · **P3 那 14 个 `service.ai.parser*` 调用的方法名与参数逐一对 `ai.ts:589-680` 全部一致** · P4 显式传 2400(默认是 1500)且被断言钉死 · **N1 的 fixture 用整数 `1`/`0` 而非布尔**(所以那条归一化真测得到)· N2/N7 照抄 · `fmtAgo` 用 `i18n.global.t` + 四个键两档各一次、占位符一致 · `util/indexedFiles` 2/2 完整移植 · Interfaces 块 26 个 state/action 零缺失零改名。
Task 6: 评审 **Spec ❌** + 1 Important 进修复轮:
  ① **Critical:漏 `export const DISTILL_JOBS_LIMIT = 500`**。实现者以「本任务代码没用到」为由跳过 —— 判断依据错了:brief Interfaces 块第 11 行明文列它为 T6 产出,**T7 brief 第 37 行 `import { …, DISTILL_JOBS_LIMIT } from './knowledgeStore'` 并在两条断言里用它 → T7 起手即编译不过**。**教训:某个导出该不该落地,看的是 Interfaces 契约 + 下游消费者,不是本任务代码有没有引用。**
  ② **Important:`fmtAgo` 的 `h < 24` 边界无判别力** —— 评审探针把阈值改成 `h < 48` → 16/16 全绿。代码本身等于蓝本、是对的,但阈值写错没人拦。补每个档位两侧的边界断言(59/60 分钟、23/24 小时、「刚刚」两侧)。
Task 6: fix round 1/5(1 Critical + 1 Important addressed, 0 open —— 补 `DISTILL_JOBS_LIMIT = 500` 导出 + 断言钉住 · `fmtAgo` 三个切换点各补两侧边界断言;commit 8075c3d,+4 例)
Task 6: complete (commits a13d6fa..8075c3d, review clean)—— **309 文件 / 2769 例绿 · tsc 0 · build 0**。复评 4 次独立探针全部精确报红并还原(500→400 · 三个档位阈值各改错一次);并实证了导出面对外可见(临时 import 文件跑通后删除);边界断言比的是**中文渲染文案**(走 `i18n.global.t`)而非只比分支,与 `zh_cn.ts:1441-1444` 逐字一致;`fmtAgo` 函数体本轮零改动、与蓝本 `:60-69` 三档阈值逐行等价。
Task 9: 实现完成 commit 9ec4b06(`util/dashboardHelpers.ts` + test);**310 文件 / 2783 例绿 · tsc 0 · build 0**。Vue2 原 spec 实测 6 条(与 brief 说的一致),移植 6 条零漏零弱化 + brief 3 条边界 + 补 5 条分支两侧 = 14 条。
Task 9: complete (commits 8075c3d..9ec4b06, review clean)—— 评审逐行核过四个函数与蓝本**字符级一致**(比较符 / 除零与负数守卫 / `Math.round` / 双向夹取顺序 / `if-else if` 链未被改写成 reduce / `Math.floor` 未换 round / `fmtEta` 的 `h` `m` 间空格);`fmtEta` 英文字面量确认未接 i18n 且有注释。复评 4 次独立探针:取整方式、未知 status 落桶、`fmtEta` 空格格式三次精确报红并还原。
Task 9: minor (deferred): 评审报的「`updatePeak` 参数顺序无判别力」—— 根因是 `Math.max(a,b)` **天然对称**,换序不可观测,**不是移植缺陷、也补不出有意义的判别用例**;评审自己的建议就是「只补一句注释」。**留给终审修复轮一次性收。**
Task 7: 实现完成 commit aacdf76(`knowledgeStore.ts` +280 行 / `knowledgeStore.notesWiki.test.ts` +287 行);**311 文件 / 2805 例绿 · tsc 0 · build 0**。
Task 7: complete (commits 9ec4b06..aacdf76, review clean)—— 评审 **17/17 action 等价蓝本**、**「二次 map」零命中**(本任务独有的 K1 变体:包内已 normalize,照抄蓝本的 store 层转换就会转两遍 → 全 undefined)、N4/N5/N6/N7 四条照抄且注释一并搬、两侧用例齐全、跨文件 mock 无 red flag、**T6 那 442 行零 `-` 行未被动**、K5 唯一 catch 走 `aiKbOpFailed`、K6 生产代码零 `console.`。复评 4 次独立探针(二次归一化 / `limit` 200→100 / 多刷一桶 / 404 判据改 `>=400`)全部精确报红并还原。

Task 10: 实现完成 commit 15ea9fc(`KnowledgeLayout.vue` 308 行 + test 308 行);**312 文件 / 2826 例绿 · tsc 0 · build 0**。实现者顺带修了 brief 测试脚手架的两个真 bug(`makeRouter` 自递归致 DOM/生命周期翻倍 · 缺 `@nimotech/nimoos-service` mock 致 `onMounted` 真发请求翻掉 `unreachable`),评审改回原文实测复现、裁定成立且未削弱断言力。
Task 10: 评审(opus)界面 1:1 部分零出入 —— 9 项 rail 的 id/中文/英文/图标四项全对、14 个 glyph 逐个对过 `KIcon.PATHS`、**22 个中文短语回 Vue2 语言包逐字符复核一致**、`titles` 9 项含三处刻意差异全对(连蓝本不按 NAV 排的键顺序都照抄)、N8 双钉子、三组属性态 DOM 输出确认、30 个 CSS 类全存在、K8 与 `SettingsRail.vue:74-86` 逐字同构且零新增 i18n 键、轮询三项齐、模板零硬编码文案。
Task 10: 🔴 **评审 Spec ❌ —— C1 是计划缺口(协调者已独立复核确认)**:`knowledgeRoutes.ts:22` 的**父路由** `/ai/knowledge` 的 component 仍是 `KnowledgeDeferred`,**全仓无生产代码 import `KnowledgeLayout`**,`grep -rl 'knowledge-app' dist/assets/*.css` **空** → T4 那 585 行 scss 编译出零字节 CSS,「首次进构建管线、零 sass 告警」不成立(没编译才没告警)。
  **下游更要紧**:`KnowledgeDeferred` 里没有 `<router-view/>` → 照原计划走完 P5a,**T12 的 `DashboardView` 连渲染机会都没有**。
  **根因**:T5 / T10 / T12 三份 brief 都没有「把父路由接成 `KnowledgeLayout`」这一步(T5 报告说「留给 T10」,而 T10 brief 没写)。
  **裁定 R8**:归 T10 —— 外壳任务的产出不该是死代码。父路由改 `KnowledgeLayout`(只改这一行),9 子路由 + 2 条 parser 仍指占位页;T5 那条「11 条全 === KnowledgeDeferred」的断言**反转不删**;验收判据 = `dist/assets/*.css` 里必须 grep 到 `knowledge-app`。
Task 10: 评审另 3 条 Important 进同一修复轮(全部 RED 探针实证「无人报红」)—— ① 注释掉 scss import → **全量全绿**,「整个区裸奔」这个最严重故障模式零覆盖 → 在 `knowledgeStyles.test.ts` 加「有生产 `.vue` import 了 knowledge.scss」守卫 ② `NAV[0].icon` 改成不存在的 glyph → **全绿**(`KIcon.test.ts:23` 那 22 项数组是硬编码、与 NAV 解耦;未命中 name 渲染空 svg = 空白图标)→ 加「9 项 rail 的 svg innerHTML 非空」 ③ `TITLES` 只钉住 2/9 项,`wiki`/`queue` 的刻意差异零覆盖、`.k-topbar-sub` 只测 dashboard 一档 → 补 wiki/queue 两条。
Task 10: minor —— 头部注释的蓝本行号**系统性偏 5-6 行**(`NAV` 实为 `:104-114`、`TITLES` 实为 `:116-126` 等),**本期第三次同类**(T0 两处、T2 一处)→ 并进本轮一起订正。
Task 10: fix round 1/5(1 Critical + 3 Important + 1 Minor addressed, 0 open;commit 2677f61,5 文件 +165 −28)。父路由接 `KnowledgeLayout`、T5 断言**反转不删**(旧文本原样留成注释)、加「有生产 `.vue` import 了 knowledge.scss」守卫、加 rail+移动端 svg 非空断言、补 wiki/queue 两条 TITLES 用例、订正 9 处蓝本行号。
Task 10: 🔴 实现者自己在本轮抓到并修了**自建守卫的假绿** —— 第一版用裸子串匹配,**被注释掉的 import 也能让它通过**;改成按行锚定。**这是本期第四次同族**(T4 的 `\b` 在 `-` 前成立、T4 色扫跑在剥注释后、T4 第一版 R4 子串检查)。**教训固化:任何「文件里有没有某段文本」的守卫,都必须先排除注释、并按行锚定。**
Task 10: complete (commits aacdf76..2677f61, review clean)—— **312 文件 / 2831 例绿 · tsc 0 · build 0**。复评实测 `dist/assets/index-Bh4zZr5X.css` 同时含 `knowledge-app` 与 `k-rail-item`(**C1 的硬判据过了**,CSS +11.7 kB),build 零 sass 告警;5 次独立探针全过,**其中探针 B(删掉真 import、只留一行注释提到它)仍精确报红** = 假绿修法成立;28 个 `-` 行逐个核实全是 T5 断言反转 + import 清单,`KnowledgeLayout.vue` 那 36 行改动 100% 是注释/行号,逻辑与模板零改动;`knowledgeStore.ts` 与 `knowledge.scss` 零改动。

## 交接 T11(协调者已核实,必须照做)

- 🔴 **T4 的守卫 `knowledgeStyles.test.ts:69-71` 有一条「没有搬多 —— 全部 `k-`/`k2-` 类都在白名单内」,判据是硬编码的 `WHITELIST_38`。T11 一加 65 个 `k2-*` 类,这条会立刻红** → T11 **必须扩那个列表**(扩、不是删该断言,也不是放宽正则)。
- `:159` 那条「R2 —— 4 个本批用到的 `*-soft` token 两档都有值」:T11 若用到更多(`--purple-soft` / `--teal-soft` / `--danger-soft-faint` / `--success-soft-border` / `--modal-scrim`),要**在声明层补声明并扩这条断言**。取值见 R2 裁定里的 `tokens.scss` 行号表。
- **`k2pulse` / `k2spin` 两个 keyframes 归 T11**(蓝本 `knowledge.scss:2440-2441`,在 `k2-*` 段内部,不在 T4 的 `1510-1539` 全局段)。
- R4 的 `--shadow-*` 已由 T4 分两档声明好,T11 直接 `var()` 用。
- R5 注释口径:规则段落里的注释一律不许有色字面量(改「蓝本行号 + 中文描述」);两个 token 声明块里允许。
- **scss 现已进构建管线**(T10 import 了它)→ T11 的 `pnpm build` 会真编译它,除三门外仍建议单跑一次 `pnpm exec sass` 直接校验。

Task 11: 实现完成 commit 11c65a9(`knowledge.scss` +239 / `knowledgeStyles.test.ts` +76 −17);**312 文件 / 2831 例绿 · tsc 0 · build 0 · sass exit 0(1626 行)· dist 里 63 个唯一 `.k2-` 类**。
Task 11: 实现者回源核出**附录三处错**(评审全部裁定成立):① 类数是 **64** 不是 65(63 个 `k2-*` + `k-suggest-chip`,用 `diff` 对过蓝本 `:2282-2452` 类集)② 白名单应扩到 **102** 不是 103 ③ 🔴 **`k2-cc` 用的是 `[data-on="true"]`,不是附录 D.3 说的 `[data-active]`**(蓝本 `:2370` 确认)。另修了一处 T4 遗留的守卫 bug:8 个具名色正则 `\bwhite\b` **会误判 `white-space`**(`-` 满足 `\b`),改 `(?<![\w-])…(?![\w-])`,两方向验过。
Task 11: 评审(opus)Spec ✅ / 质量通过 / Critical 0 —— 逐行色扫规则段落 0 处、注释 0 处、`theme-exception` 0;**43 个 `var()` 逐个核过 0 个「两处都找不到」**(真机无透明风险);130 行剥注释机械 diff 差异**恰好 7 处**且全是 K2 授权的裸色→token;属性态五组 + 4 修饰类全齐;`k2pulse`/`k2spin` 对蓝本逐字符相同;**T4 那段零 `-` 行**;守卫的「没有搬多」逻辑一字未改、豁免区间未被 T11 扩大(17 个 `-` 行逐条核实:8 条正则是**收紧**、R2 数组 4→6、原 38 项一个没删)。
Task 11: 🔴 **评审挖出一个 T4 引入的守卫窟窿(I-2)进修复轮**:色扫的豁免区起点用 `indexOf('.knowledge-app {')`,而**这个串在第 8 行的注释里就出现了** → 实际豁免区是 `:8-157`,**白送 65 行头注释**;T4 头注释 `:36/:40/:58/:59` 里的真实色字面量**守卫看不见**。探针实证:塞进头注释 `:20` 全绿、塞进规则段落注释精确报红。修法=行首锚定 `/^\.knowledge-app \{$/m` + 改写那 4 行注释。
  **这是本期第五、六次同族事故**(T4 `\b` 在 `-` 前成立 · T4 色扫跑在剥注释后 · T4 第一版 R4 子串检查 · T10 第一版 import 守卫被注释撞对 · T11 `\bwhite\b` 误判 `white-space` · 本条)。**固化教训:任何「在文件里找某段文本」的判据,必须行首/整行锚定 + 先排除注释。**
Task 11: 评审另一条 Important(I-3)进同轮 —— **「`var()` 引到两档都没声明的 token」零覆盖**(探针 `var(--k2-nonexistent)` 五道门全放过);同类还有「删 `[data-layer]` 三色里一色」与「删 `@keyframes k2spin`」都不报红。修法=加 `var()` 闭环守卫(本档声明层 ∪ 全局 `theme.css`,**由模板 inline 注入的如 `--g` 要显式登记例外**)+ `[data-layer]` 三色完整 + keyframes 存在性。
Task 11: 协调者裁定 R9(追认,不改代码)—— ① `.k2-ob-layer .k2-tag` 的 `color-mix` 蒙版映射越了附录 B 的桶(白色只到 0.2、遮罩是 0.32),评审判「属自行发明映射,本该走 `NEEDS_CONTEXT`」→ **追认**:数值经评审核对精确等值、未发明新 token、附录确实无此桶;**但流程上下次要问**。② `:747` hover 取 `--danger-soft-border` 越桶边界 → **追认**,落 `--danger-soft` 会让 hover 与常态同色、丢掉反馈。

## 交接 T12(评审 §H 的 5 条,协调者已确认)

- 🔴 **`.k2-cc` 必须输出 `:data-on="String(…)"`,不是 `data-active`**(蓝本 `DashboardView.vue:219`;**不套 `String()` 选中态也会落空**,因为选择器是 `[data-on="true"]`)。附录 D.3 那条写错了。
- `.k2-glue-id i` 的圆点色靠模板 **inline `--g`** 传下来,不传就全落兜底灰。
- 修饰类是**子元素上的 class**:`suffix` / `second` / `k2-drafts` / `spin`。
- 建议顺手落 I-3 那条 `var()` 闭环守卫的收益(T12 会新增 `var()` 使用面)。
- N2 的三个字段(`rate_per_min` / `done_last_10m` / `eta_s`)后端不下发 → 速率/ETA/10 分钟完成数恒 0 与空串,**照抄**,验收清单里说明。

Task 11: fix round 1/5(2 Important addressed, 0 open;commit e369568,+4 守卫用例)。豁免区改行首锚定 `^selector$`(`m` flag)+ `.exec()`;4 行头注释色字面量清零(grep 1-69 行 0 命中);新增 `var()` 闭环 + `[data-layer]` 三色完整 + keyframes 存在性三条守卫,**例外只登记 1 条 `--g`**(蓝本 `DashboardView.vue:132-134` 的**静态** inline `style="--g: var(--ly-vec)"`),`--accent-soft-2` 正确判为「全局已声明」而非例外,`--ly`/`--ly-soft`/`--ly-ln` 在规则体内声明属声明层。
Task 11: complete (commits 2677f61..e369568, review clean, 2 追认)—— **312 文件 / 2835 例绿 · tsc 0 · build 0 · sass exit 0**。复评 6 次独立探针全过:头注释塞字面量**精确报红**、**声明块内既有 60+ 处字面量仍全绿(豁免未被废掉)**、规则注释报红、`var(--k2-nonexistent)` 指名报红、删 `[data-layer="vec"]` 指名报红、删 `@keyframes k2spin` 指名报红;样式取值零改动;八条既有断言全部未削弱。
  评审记录的边界情况(不算漏洞):若选择器写成带尾随空格或 `.knowledge-app\n{`,正则匹配失败会触发 `expect(m).not.toBeNull()` **响亮报错终止**,不会静默放行。
Task 12: 实现完成 commit 7b215a0(4 文件 / +1020 −4:`DashboardView.vue` 530 + test 457 + 路由反转);**313 文件 / 2858 例绿 · tsc 0 · build 0**。路由 `''` 子路由反转成 `DashboardView`(旧断言两版全文留痕),其余 10 条仍占位页,父路由仍 `KnowledgeLayout`。
Task 12: 实现者主动申报三件(评审全部裁定成立)—— ① `String()` 探针"全绿"的解释正确:`data-on` 不在 `isSpecialBooleanAttr`、走 `setAttribute` 自动字符串化,**连评审要的「false 侧属性存在且等于 `"false"`」角度也实测钉不住** → 保留 `String()` 照蓝本是对的,如实上报的处理对 ② 自己抓到并修了一条弱断言(`.toContain('0')` 被中文文案里的字面「10」撞对,改整串精确匹配)③ **`updatePeak` 在蓝本里本身就是死代码**(蓝本 grep 只命中定义+注释+自己的 spec,store 用内联 `Math.max`)。
Task 12: 评审(opus)结构与文案 1:1 核得很实 —— 结构 token 流 diff **404 vs 404** 仅 3 处差异(2 处 P1 授权 + 1 处 TS 等价)、**文案序列 59 vs 59 零 mismatch**、73 个 CSS 类全存在、19 个图标名全在 `PATHS`、inline `--g` 三处逐字、**N2/N3 生产代码确认照抄未被优化**、零 `<style>`/零硬编码/零色字面量、K1/K5/K6 全过。
Task 12: 🔴 **Spec ❌ —— C-1(Critical,真实可见回归)**:`DashboardView.vue:171` 掉了 `tone: 'wiki'`(蓝本 `:342`)→ 空库 onboarding 第 2 磁贴的 `.k2-entry-ico` 命中 `knowledge.scss:759` 的**灰色兜底**而不是 `:761` 的琥珀。**而且它恰恰是从 I-3 那个覆盖缺口漏进来的。**
Task 12: 评审另 4 条 Important 进同轮(全部 RED 探针实证「无人报红」)—— **I-3** `[data-ok]` 零断言、`[data-tone]` 只覆盖 4 个宿主里的 `.k2-qchip` 一个(探针 G/H/I 三次全绿)· **I-1** N3 的 `all` vs `allSettled` 钉子无效,**且测试注释称两者「完全等价」是错的**(`all` 是 fail-fast);评审实证的判别写法=`loadRoots` 立即 reject + `loadOverview` 永久悬挂 · **I-2** 图标名零守卫(`KIcon.vue:79` 对未命中 name 静默返空 svg,探针 `sparkle`→`sparkleXX` 全绿)· **I-4** 报告 §5 表格把 `[data-ok]` 记成已覆盖 = overclaim。另 3 Minor:`queueDepth` 兜底偏离未申报 · `[data-disabled]` 只测 true 侧 · 同文件还剩 2 处 `toContain` 数字弱断言。
Task 12: 协调者登记(不改代码)—— ① 附录 D.2「64 个 `k2-*` 类」应表述为「**63 个 `k2-*` + `k-suggest-chip` = 64 个类**」② **治理文件 §8「收官 307 文件」漏算本期新增的 10 个测试文件,实测 313 才对** ③ `dashboardHelpers.ts` 头注释「供 T12 消费 `updatePeak`」与蓝本事实不符(蓝本里它是死代码),T9 遗留。
Task 12: fix round 1/5(1 Critical + 4 Important + 3 Minor addressed, 0 open;commit 466b7f8,+8 例)。C-1 补回 `tone: 'wiki'` 并加专门钉子;`[data-ok]` 与另 3 个 `[data-tone]` 宿主各补判别力断言(新增 `ROOTS_MIXED` fixture,复评核过形状合理非手编);N3 钉子改成 fail-fast 判别写法(`loadRoots` 立即 reject + `loadOverview` 永久悬挂)并**订正两处错注释**;加图标名守卫覆盖 19 个 glyph(静态 11 + 动态 8)× 4 状态;M-1/M-2/M-3 与 I-4 一并收。
Task 12: complete (commits e369568..466b7f8, review clean)—— **313 文件 / 2866 例绿 · tsc 0 · build 0 · dist `.k2-` 唯一类 63**。复评 6 次独立探针全部精确报红并还原(重删 `tone:'wiki'` / 删 `data-ok` / `.k2-chip` tone 改错 / `.k2-entry-badge` 改错 / `all`→`allSettled` / glyph 名改错含一个动态路径);**独立逐字段重核 `entries()`/`emptyEntries()`/`LAYER_INTROS`/`CC_LEVELS`/`SAMPLE_QUERIES` 五组常量,确认无第二处漏项**;禁改的四个文件均未出现在提交里;剩余唯一 `toContain` 是 `not.toContain('NaN')`(负向存在性检查,非弱断言)。

---

## 13 个任务全部收官(2026-08-01)

**New-UI `sp8-ai`:`99ee99a` → `466b7f8`(17 个提交)· 三门 313 文件 / 2866 例绿 · tsc 0 · build 0**
**Service `sp8-ai`:`c8f1919` → `03d3028`(3 个提交)· 26 文件 / 227 例绿**
起点 303 文件 / 2719 例 → 收官 313 / 2866:+10 个测试文件、+147 例(其中 4 例是新增 4 个 `.vue` 带来的 color-guard)。

### 待终审 triage 的挂账清单

**parked(有裁定,交终审复核)**
1. **T2** —— `WikiCandidate` 被 `res.data as WikiCandidate[] | null` 的 any 源转换架空,对自身重构零编译期约束力。ruling:`res.data as X` 是**本包通行惯例**(10 文件 20 处,`cloud.ts:11`/`samba.ts:12,25`/`driver.ts:11` 形状完全相同),要求 wiki.ts 单独换写法 = 无关重构;且该类型的约束力本来落在**消费端**(T7 读 `c.path` 时字段改名会真报错)。
2. **T4** —— `--accent-soft-2` 暗色下解析到全局 `theme.css:60` 的 `rgba(138,180,255,0.24)`,而本档 `--accent` 是 `#5E97F2`,色相略错配。ruling:附录 B 明令直用全局该 token,0.2 alpha 的边框色、观感差异极小。若要改,正解是两档各自声明本地 `--accent-soft-2`(暗 `rgba(94,151,242,0.24)` / 浅 `rgba(59,91,219,0.2)`)。
3. **T11 R9 追认两条** —— `.k2-ob-layer .k2-tag` 的 `color-mix` 蒙版映射越了附录 B 的桶(白色只到 0.2、遮罩是 0.32),评审判「本该走 `NEEDS_CONTEXT`」;`:747` hover 取 `--danger-soft-border` 越桶边界(但落 `--danger-soft` 会让 hover 与常态同色、丢反馈)。两条数值均经评审核对等值,追认不改。

**deferred minor(留终审一次性修复轮)**
4. **T2** —— `wiki.ts` 注释引「蓝本 `wiki.js:89-92`」有误,四个写方法真实行号是 **93-96**(89-92 是 `getRaw` 的方法体)。
5. **T9** —— `updatePeak` 参数顺序无判别力(`Math.max(a,b)` 天然对称,补不出有意义的判别用例);**且 T12 查实它在蓝本里本身就是死代码**(蓝本 grep 只命中定义+注释+自己的 spec),而 `dashboardHelpers.ts` 头注释写「供 T12 消费 `updatePeak`」与事实不符 → 订正那句注释。
6. **文档订正两处** —— 附录 D.2「64 个 `k2-*` 类」应表述为「**63 个 `k2-*` + `k-suggest-chip` = 64 个类**」;**治理文件 §8「收官 307 文件」漏算本期新增的 10 个测试文件,实测 313 才对**。

**已在本期内解决、不必再 triage**
- T4 那条「文件头注释块有色字面量且守卫扫不到」—— 已由 T11 修复轮 I-2 一并修掉(豁免区改行首锚定 + 那 4 行注释色字面量清零)。

### 全支线终审(opus)+ 一次性修复轮 —— 已完成

**终审判定:可以交用户验收,零 Critical、零 Important。** 12 条偏离全部三件套齐(P3 只缺标号,已补);8 条照抄逐条回蓝本字符级比对**零回归**;跨任务 mock 形状红旗 0(全仓知识库测试 `{ data:` 命中 0);12 个跨任务标识符零漂移;**死 i18n 键 0/96**(且 95/96 的 en 值即 Vue2 键、中文逐码点相同);死 CSS 类只 2 个(`k-empty-tips`/`k-empty-tip`,R1 授权预留);路由终态与蓝本 `route.js:186-195` 逐条吻合;**`knowledge.scss` 声明层外色字面量 0 处**、62 个 `var()` 唯一未解析的是已登记例外 `--g`、**两档完整性无第二处漏声明**;整期 **0 deletions**(New-UI 27 文件/5635+/0−、Service 5 文件/906+/0−)= 机械证明既有断言未被削弱;**没有第 7 例「文本判据没锚定/没排除注释」**。

**终审修复轮(Service `15c2eba` / New-UI `ac110e0`)7 条全部 ADDRESSED,复评过**:
① `wiki.ts:176` 行号 89-92→93-96 ② `dashboardHelpers.ts` 头注释改成如实说明 `updatePeak` 蓝本即死代码(函数保留,1:1 parity)③ **治理文件 §8 收官数 307→313 并补全构成**(P5b 的基线依据)④ `knowledgeStore.ts:479` 补 `P3` 标号 ⑤ `DashboardView.vue:533` 补等价改写的申报注释 ⑥ `KnowledgeLayout.test.ts:207` 弱断言 `toContain('1,234')`(`11,234` 能撞对)→ 整串 `toBe` ⑦ 🔴 **浅色档 token 覆盖改集合断言**(原来只钉 13 个具名 token,终审探针实证「删浅色块 `--line-strong` → 209/209 全绿」),例外清单 11 条(7 个 `--r-*` + 2 个 `--font-*` + `--grad-iri`/`--grad-iri-soft`)逐条经复评核实站得住、不含颜色分量、非垃圾桶。
复评探针 A/B/C/D 全过:`11,234` 报红 · 删浅色 `--line-strong` 指名报红 · 另删 `--text-quaternary`/`--bg-chip` 各指名报红 · 删例外清单内的 `--r-xs` 主覆盖断言不误报(仅账目核对断言报红,语义恰当)。

### 收官坐标(2026-08-01)

- **New-UI `sp8-ai` @ `ac110e0`**(自 `99ee99a` 起 **22 个提交**)· **313 文件 / 2868 例绿 · tsc 0 · build 0** · dist `index-*.css` 含 `knowledge-app`、`.k2-` 唯一类 63
- **Service `sp8-ai` @ `15c2eba`**(自 `c8f1919` 起 **5 个提交**)· **26 文件 / 227 例绿**
- **两仓均未 push;`NimoOS-UI` 零本期提交零改动**(SP7 会话在用的共享检出)
- `:5288` dev server 已 kill 掉 P4 遗留的 pid 1355965 后重起,新 pid **2699152**,`curl -sI /app/` 返 200
- **待用户人眼验收**(附录 C 14 条,含 3 条「预期行为」说明)

### P5b–P5f 交接项

1. **P5f 必读**:`DEFERRED_TABS` 清空后,`deferred.test.ts:12` 会变成 0 次迭代、`:27` 会硬报错 → **改用本地构造的列表驱动** `isDeferred`(承 P4 I2「留了代码没留能力」)。
2. **附录 D 的类白名单是只从两个模板抽的** —— 后续批次要用到的空态/表格/抽屉类不在里面,按 R1 的先例扩(它们在蓝本里真实存在)。
3. **`knowledgeStyles.test.ts` 的白名单与 R2 token 列表是硬编码的** —— 每批新增类/token 都要**扩**它(不是删断言、不是放宽正则),否则「没有搬多」那条会立刻红。
4. **`messageSyntax.test.ts` 的全角标点扫描与占位符一致性守卫只圈本批 94 键** —— 后续批次把自己那批键加进圈定列表即可;**不许全量生效**(既有 `aiResTurn`/`aiResFilesInTurns` 的 zh/en 占位符不一致是有意设计,`{s}` 是英文复数后缀)。
5. **`--accent-soft-2` 色相错配**(parked)留 P5b 决定:正解是两档各自声明本地值(暗 `rgba(94,151,242,0.24)` / 浅 `rgba(59,91,219,0.2)`)。
6. **附录 D.2 的措辞**应为「63 个 `k2-*` + `k-suggest-chip` = 64 个类」(计划文件在 `NimoOS-UI`,共享检出,本期未改)。

### 🔴 本期最值钱的一条工程教训(6 次同族事故)

**「在文件里找某段文本」的判据,必须行首/整行锚定 + 先排除注释。** 实例:
T4 `\b` 在 `-` 前成立(`/\.k-topbar\b/` 被 `.k-topbar-title` 满足)· T4 色扫跑在 `stripComments()` 之后(注释里的裸色永远扫不到)· T4 第一版 R4 守卫是子串检查 · T10 第一版 import 守卫被**注释掉的 import** 撞对 · T11 `\bwhite\b` 误判 `white-space` · T11 色扫豁免区起点 `indexOf('.knowledge-app {')` **命中第 8 行注释**、白送 65 行头注释。
**六次全部是 RED 探针才现形,光读测试代码一次都看不出来。**

Task 0: 评审顺带订正协调者一处口径错 —— **蓝本 `KIcon.vue` 是 42 条 glyph,不是 43**(协调者原先那个 43 出自把组件自身 `name: 'KIcon'` 数进去的 grep;已用 awk 圈 `const PATHS` 块独立复核 = 42)。设计 §2.5 叙述句写 42、结论句写 43,自相矛盾 → **一律以 42 为准**,已写进 T3 brief。

---

## 验收反馈修正 #1(2026-08-01)—— 概览页「操作失败」toast

**用户报告**:左栏来回点几下再回概述,右下角弹「操作失败」。

**根因(实测,非推断)**:`curl -m 70 http://127.0.0.1/v1/wiki/roots` → 70 s 零字节、
无响应码。共享包 `src/http.ts:50` `timeout: 60000` → `loadRoots` 在 60 s 后走 catch →
`toast(aiKbOpFailed)`。DashboardView 每次挂载排一发,来回切页就攒多发,toast 落地时
用户早已在别的页面。蓝本 `knowledgeStore.js:244-253` 逐字相同(已 `git show main:` 核实),
所以这是**蓝本自身的吞错/噪音缺陷**,按「界面 1:1、逻辑照正确」不照抄。

**改动**(commit `3d8c9bc`,New-UI):
1. `loadRoots(opts?: { silent?: boolean })` —— 后台调用方静默失败;用户主动路径
   (`createRoot`/`deleteRoot` 后的重载、P5d 的 RootsView)不传 silent,行为不变。
   概览页本就用「0 个知识根」表达这个失败,不需要第二个提示面。
2. `loadRoots` 加 epoch 过期守卫(store 实例局部 `let rootsEpoch`)—— 多发并存时,
   先发后至的响应不覆盖后发结果、不提前归位 `wikiRootsLoading`、不替后发弹 toast。
   这是「New-UI 异步过期守卫」纪律第 5 次命中,inline 不抽公共 guard。

**验证**:4 条新用例 + 双向 RED 探针 —— 去掉 silent 分支 → 1 红;去掉 epoch 守卫 → 2 红
(且两组互不误伤,证明各自咬的是各自那件事)。全量 **313 文件 / 2872 例**绿 · vue-tsc 0 ·
build 0。dev server 走 HMR,无需重起。

**给 P5d(RootsView)的交接**:`loadRoots` 现在有 silent 形参。RootsView 里的调用**不要**
传 silent —— 那里是用户主动操作,失败必须告知。只有「组件挂载时的后台预取」才传。

**验收清单勘误**:原第 1 条写「右下角无 toast 残留」,漏说了这个 60 s 后才落地的 toast。
本次修正后该条恢复成立。

---

## ✅ P5a 正式收官(2026-08-01)

**用户 `:5288` 眼验 19 条全部通过**,含验收反馈修正 #1 的复验(C 组:左栏来回切后不再出现「操作失败」)。
零遗留缺陷。**未部署、未合 master。**

最终坐标:New-UI `sp8-ai`@`710e79a` · Service `sp8-ai`@`15c2eba` · roadmap `NimoOS-UI@b60e585a`(分支 `docs/vue3-migration-sp3`)。
三门:313 文件 / 2872 例 · vue-tsc 0 · vite build 0。

**同日一并完成的后端动作(用户拍板)**:`nimo_os_docs/scripts/deploy-agent.sh` 热更设备上的
Python agent(NimoOS-AI@`46850f7`,只灌 `agent/` 代码,不重建镜像)。`notes/distill` 四条路由
与 `notes/settings` 的三个字段现在真机可用 → **P5b 沉淀 scope / P5c 沉淀设置 / P5e distill
按钮不再恒 404**。

**P5b 交接**:见 `p5a-common-constraints.md`(直接沿用,新期出 `p5b-` 版差异)+ 本文件
「P5b–P5f 交接」节 + roadmap §SP8 P5 条目。
