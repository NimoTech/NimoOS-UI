# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-07-31-vue3-migration-sp7-p6b-places-detail.md

> 台账落 `.sp7` 工作区(P5 台账事故后的约定:`NimoOS-UI/.superpowers/` 被 gitignore 且
> 曾整目录从磁盘消失,34 份 brief/report 永久丢失)。关键事实同步写进 roadmap(入 git 那份)。
> SDD 技能默认「终审通过后 rm -rf workspace」与此冲突时,**以保留台账为准**(用户约定)。

基线: New-UI sp7-photos@fa0df48 (280 文件 / 2675 tests / tsc 0 / color-guard & parity 409), Service sp7-photos@6275ead(**本期零改动**)

文档坐标(NimoOS-UI `docs/vue3-migration-sp3`):spec `d63616d1`(§1c D8-D10 + §7c 8/9/10)→ plan `363935fe` → roadmap `84c441c6`

## 开工前 pre-flight 扫描(2026-07-31)

plan 由控制器本人所写并已过一轮 Self-Review。扫描出**两条「plan 明确要求照搬、但评审鲁布里克
很可能判缺陷」的条目**(偏离登记 15 之①与④),已批量提交用户裁定,结论:

- **裁定 1(采纳修正)**:spot 坐标行 Vue2 写死 `° N` / `° E`(`PhotosPlacesView.vue:1129`),南/西半球显反 = 显示错误,归「Vue2 的 bug 不照抄」→ **改按符号出 N/S、E/W**。plan 偏离 15-④ 作废、新增**偏离登记 16**;T2 加纯函数 `formatSpotCoords`(四象限 + 零 + 非有限值用例),T4 改为消费它。方向字母刻意不进 i18n(单字母通用 + 与 Vue2 视觉一致)。
- **裁定 2(维持照搬)**:封面搜索框逐键发请求(Vue2 `:308-311`)**不加 debounce**,只保留结果落盘的 seq 守卫(偏离 15-① 不变)。
- plan 修订提交:NimoOS-UI `docs/vue3-migration-sp3`@**2b67e803**。

## 任务进度

Task 1: complete (commits fa0df48..c81ad6c, review clean —— Spec ✅ / quality Approved,零 Critical/Important; 全量 281 文件 / 2685 passed + tsc 0)
Task 1: 实现者与评审**双向独立回源核对 45 键零出入**(评审用 python 直接加载 zh_CN/en_US.json 抽查 25+ 条 + 读 places.go:522-560 核 4 条 insight key 与 params 字段名 + 核「不得重复新增」9 键无碰撞)——与上一期 P6a-T4 的 6 处文案错形成对照,本期 brief 键表可信。
Task 1: minor (deferred): `placesInsight.test.ts` 顶部 `import { vi }` 未使用 —— **是 plan/brief 原文自带**(控制器写的示例代码里多导了),实现者逐字照抄;无 eslint/noUnusedLocals 故不报错。后续任务勿再照抄该行。
Task 1: 评审登记的既有键碰撞排查结论(带下游):json 里另有 `Failed to update cover`(用于 `PhotosAlbumDetail.vue` 相册封面)与 `Could not rename spot` 近义的 `Rename failed`(`AppPathModal.vue`)——**语境不同、不是同一 key**,本期三条自拟键标注属实。
Task 2: complete (commits c81ad6c..3ee261b, review clean **零缺陷** —— Spec ✅ / Approved,零 Critical/Important/Minor; 全量 282 文件 / 2711 passed + tsc 0)
Task 2: 实现者反向纠正 brief 两处,**评审独立推演均确认成立**:①brief Step 5 的 `git add` 清单漏了 `placesMap.ts`/`placesMap.test.ts`(Files 一节有、命令行没有),已按 Files 提交全 6 文件 ②**brief 删码项⑦(`finally` 的 `mine === seq` 守卫)按 brief 给的时序(A 慢 B 快)删掉不变红** —— B 完成时已把 loading 置 false,A 后到只是重复写 false,断言区分不出;实现者补了「A 先回、B 仍在途」的反向时序用例才真能抓住该守卫。
Task 2: 教训(带下游): **「后发先回」与「先发先回」是两个不同的竞态窗口,守卫测试要选对时序** —— 同类守卫(T8 的封面候选、跳库页路由切换)写测试时先想清楚"删掉这行会让哪种时序出错",再挑 fixture。
Task 3: 实现完成 (3ee261b..3f6663f, 37 组件测试, 全量 283 文件 / 2751 + color-guard 394 + tsc 0)
Task 3: 评审 Spec ✅ / quality Approved,**逐节点清点表核过 Vue2 :1058-1107 无漏渲染**(唯一缺口见 I1),死 CSS `.map-detail.is-entering` 确认未迁
Task 3: 实现者两处申报**评审独立核过均成立**:①`--place-home-base` 做成 theme-invariant(两套主题同值)而非 brief 字面要求的深浅两值 —— 依据:`--place-current-trip` 在两块确实同值(theme.css:96/:360),hero `::after` 遮罩是固定暗色渐变与 app 皮肤无关,照字面给浅色一个深紫会在浅色主题下对比度出问题;**已在 theme.css 两处 + THEMING.md 登记(不是只写报告)** ②**brief 说「`.btn:hover` 与 `.btn-primary` 实底会撞」不准确** —— 回源 `photos-places.scss:582` 该基类 hover 只设 `border-color` 不设 `background`,无字面碰撞;仍按要求给 `.btn.btn-primary:hover` 写了独立背景(复合选择器优先级 3,不依赖书写顺序)并注释登记更正。
Task 3: fix round 1/5 派出 —— I1(Important,未申报偏离):设置封面按钮丢了 Vue2 内联的 `backdrop-filter: blur(8px)`(`PhotosPlacesView.vue:1068`),既不补也未登记;I2(Important,与 plan 文本冲突):`.map-detail` base 的进场 `transition`(`scss:487-489`)整条没迁,而 plan「不做」清单原文只作废 `.is-entering` 规则块、明确要求「进场由 `.map-detail` 自身 transition 承担」。两条各要求补一条**程序化样式断言** + 删码验证。
Task 3: fix round 1/5 (2 Important addressed, 0 open; commit 05c8fc0,+10 行样式 / +24 行测试,零删除)—— 复审独立做了两次 mutation 验证:两条新断言(`backdrop-filter: blur(8px)` 精确正则、`transition:` 含 transform+opacity)删掉对应声明各自真变红,非恒真;`.map-detail.is-entering` 确认仍未迁入(方向正确)。
Task 3: minor (deferred,复审范围外观察): `.map-detail` 的 `opacity: 1` 起始态**单独删掉不会让任何断言变红**(现有断言只检查 `transition:` 属性内容)。它是恒真状态、无可翻转的对照态,细粒度守卫成本高于收益;登记备查。
Task 3: complete (commits 3ee261b..05c8fc0, review clean; 39 组件测试, 全量 283 文件 / 2753 passed + color-guard 394 + tsc 0)
Task 3: 教训(带下游 T4-T7): **Vue2 的内联 style 也是 1:1 契约的一部分** —— 本任务把 `:1067-1073` 那串内联样式改写成 class 时漏了 `backdrop-filter`,功能测试与 color-guard 都测不出。改写内联样式为 class 时,逐属性列表对照,并给非颜色的视觉属性(blur/backdrop-filter/transition/aspect-ratio)补程序化断言。
Task 4: 实现完成 (05c8fc0..3b4eb0e, 38 新测试, 全量 284 文件 / 2791 + color-guard 397 + tsc 0)
Task 4: 评审 Spec ❌ / Needs fixes,3 Important + 1 Minor → fix round 1/5 派出。I1 **`.one-line` 在本仓根本不存在** —— Vue2 那是全局工具类(`_others.scss`),New-UI 每个 SFC 是 scoped 孤岛,弹窗里那个 class 没有任何规则 → 长地点名不省略会撑破 head;测试只断言 `.text()` 内容测不出(**与 T3 漏 backdrop-filter 同一根因**)。I2 **重命名成功后不退出编辑态** = 丢了 Vue2 `:495-516` 的可见行为(Vue2 是 await 成功即退、只有失败才留)。I3 `.spot-row:hover` 缺 cssCascade 断言(硬约束点名两处都要)。M1 `--accent-soft-bd` 替代 Vue2 带回落的边框未注释登记。
Task 4: 实现者三处申报的裁断 —— ②`.more` 基类剥掉手型、留 `.more.is-clickable` 给 T5:**成立**(`.detail-section h4` 是本任务新引入、不破坏 T3,注释已指引 T5)③`openSpotLibrary` 六字段收成零参 emit:**成立(有条件)** —— 容器可由 `activeSpotKey` + `String()` 归一查 `detail.spots` 取 spotKey/spotName/spotLat/spotLon,再由 `place.key`/`place.city` 补 key/city,零信息丢失,**T8 必须严格照做**;①「不自动退出编辑态」:**驳回**(见 I2)。
Task 4: 控制器给 I2 指定的改法(记此以备后续同类):**`watch(() => props.spot.name)` 退出编辑态** —— 改名成功 store 就地回写 name、恢复默认名成功 store 重拉详情,两条都让 prop 变化;失败 name 不变则保持编辑态,语义等于 Vue2 且不会「乐观撒谎」。已知边角(草稿=原名再保存时不退)登记不处理。
Task 4: fix round 1/5 (3 Important + 1 Minor addressed, 0 open; commit 45c6494,纯新增零删除)—— 复审逐条独立核实:I1 补的是 `min-width:0` + 三件套(**flex 子项省略必须有 `min-width:0` 才生效**,`.spot-dialog-name` 是 flex 容器),写法与本仓既有先例 `ViewerShell.vue:47` 的 `.one-line` 一致;I2 的两条测试**有区分力**(测试②传回相同 name 字符串但对象引用不同 → watch 按值比较不触发 → 保持编辑态,能挡住「任何 prop 变化就退出」的错实现),`spot.key` 那条既有退出路径仍在;I3 断言用了 `winningHoverBackground` 且检查胜出选择器含 `:hover`;M1 注释无字面色值。
Task 4: complete (commits 05c8fc0..45c6494 共 2 提交, review clean; 全量 284 文件 / 2795 passed + color-guard 397 + tsc 0)
Task 4: 教训(带下游 T5-T9): **Vue2 的全局工具类在 New-UI 是不存在的** —— `.one-line`(`NimoOS-UI/src/styles/_others.scss`)那类全局 util,scoped SFC 里必须自己写一份;本仓既有等价先例是 `ViewerShell.vue:47`。凡从 Vue2 模板抄下 class 名,先 grep 本仓有没有对应规则,别假定「复用既有工具类」。
Task 4: 约定(T5 必须接住): `.detail-section h4 .more` 的 `cursor: pointer` 已从基类剥掉(spec §7c-9 要求 spots 段那个「查看全部」不可点),T5 的「查看全部 {n} 张」是**真可点**的,须自己叠 `.more.is-clickable` 变体补手型,**不要改基类**。
Task 5: complete (commits 45c6494..ad98679, review clean —— Spec ✅ / Approved,零 Critical/Important; 全量 285 文件 / 2820 passed + color-guard 400 + tsc 0)
Task 5: 三处申报**评审独立核过均成立**:①外层 `v-if` 从 brief 字面的 `insights.length > 0` 改成过滤后的 `renderable.length > 0`(否则全是未知 key 时会露出光秃标题卡,比 Vue2 更差),已在模板注释 + 测试 + 报告三处登记 ②**「收紧」T4 那条断言不是弱化** —— `.spot-list` 是那个 `v-if` 段内无额外条件的直接子元素,「段是否渲染」与「`.spot-list` 是否存在」在此结构下等价;且紧邻用例仍独立断言标题文案与 `.spot-row` 条数 ③`vitest.setup.ts` 全局装了一份 i18n、测试又装一份 → `<i18n-t>`/`v-t` 重复注册 dev warning(**本仓第一个真渲染 `<i18n-t>` 的测试才撞见**),warn 断言按 `[photos-places]` 前缀过滤,松紧适度(业务 warn 未触发时长度 0 仍会红)。
Task 5: minor (deferred): `PlaceInsights.vue` 自带一份 `.detail-section h4` 样式,与 `PlaceDetailPanel.vue` 同名规则重复 —— Vue scoped CSS 不跨组件边界的必然代价(注释已引 `PersonPlacesTab.vue` 先例),非逻辑重复。
Task 5: minor (deferred): task-5-report.md 删码表第⑤行排版笔误(缺左引号),纯文档。
Task 5: 事实(带下游): 本仓 `<i18n-t>` 首次真正落地 —— 后续任何渲染 `<i18n-t>` 的组件测试都会吃到 i18n 插件重复注册的 dev warning,断言 console.warn 时必须按自己的前缀过滤。
Task 6: complete (commits ad98679..32c3d42, review clean **零缺陷** —— Spec ✅ / Approved,零 Critical/Important/Minor; 全量 286 文件 / 2844 passed + color-guard 403 + tsc 0)
Task 6: 三处申报**评审独立核过均成立**:①`.visit-save-btn` 的 accent 三档就近映射(本仓无 `--accent-rgb`/`--accent-hi`)—— 按 P6a 终审确立的区分标准它属 **chrome/surface**(普通文案按钮)不属内容色,且本仓四处同类先例(`PlaceSpotDialog`/`PersonHero`/`PlacesFilterMenu`/`MergeReviewDialog`)一致;数值级差全在 ±0.01 ②**brief 给的 scss 行号 `:599-618` 未覆盖 `.visit-save-btn`**(实际 `:835-851`,单独一段),实现者自行定位属实 ③`src/files/upload/persist.test.ts` 偶发红与本任务零依赖耦合(只依赖 fake-indexeddb/idb/persist/budget/types),判定为**既有跨文件测试隔离抖动**成立。
Task 6: 范围外观察(deferred,与 SP8 台账「既有 IndexedDB flaky」同源): 全量跑偶发 `src/files/upload/persist.test.ts` 红,单跑绿、stash 后全量绿、带改动重跑全量又绿。疑 fake-indexeddb 状态跨文件泄漏。**本期不修**,终审时一并 triage。
Task 7: 实现完成 (32c3d42..123edc9, 43 组件测试, 全量 287 文件 / 2890 + color-guard 406 + tsc 0)
Task 7: 评审 Spec ✅ / Needs fixes,1 Important → fix round 1/5 派出。**评审重新 grep 了 Vue2 全量 32 条 `.cp-*`/`.places-cover-portal` 选择器,确认无漏段**(T6 那次 brief 行号漏 `.visit-save-btn` 的同类风险已排除);z-index 220(非 Vue2 的 1200)、`--popup-bg`(非 `--card-bg`)、11 个 i18n 键零新增均已核。评审还独立做了 3 处变异实验(String 归一 / `.cp-cell.is-active:hover` / 分页钳制)各自真变红。
Task 7: **控制器 plan 的第 1 处错误(实现者查出、评审独立手算确认)**: brief/plan 里手算的 `count=1234 → 12.3k` **是错的** —— `Math.round(1234/100)/10 = Math.round(12.34)/10 = 12/10 = 1.2` → 正确是 `1.2k`。实现按 Vue2 公式 `Math.round(count/100)/10` 原样落地,测试期望值订正为 1.2k(没把错值写进断言)。
Task 7: 裁断(评审独立给出): `.cp-cell` 新增 hover/is-active 背景(Vue2 原版只改 `border-color`)**不撤回、记 Minor** —— 它由 brief 结构规格第 9 条点名要求(非实现者自创),与弹层其余可点元素 hover 反馈一致,且有「图片加载前占位底」的短暂真实意义。
Task 7: fix round 1/5 派出 —— I1(Important,明确要求的覆盖缺口):高危非颜色视觉属性只人工核对、没补程序化断言;评审给的最小集合三条(scrim 的 `backdrop-filter` = 重演 T3 事故的确切属性、`.cp-cell` 的 `aspect-ratio: 1`、`.cp-grid` 的 `repeat(8, 1fr)`),要求正则精确锚定到对应选择器规则体内 + 各做一次删码验证。
Task 7: fix round 1/5 (1 Important addressed, 0 open; commit f96641a,**纯测试 +25 行、生产码零改动**)—— 复审逐条核实三条正则都用 `/\.cp-xxx\s*\{([^}]*)\}/` 先锚定规则体再断言属性(排除了 `.cp-cell:hover` 这类派生选择器),无恒真危险,删码各自真变红。
Task 7: complete (commits 32c3d42..f96641a 共 2 提交, review clean; 46 组件测试, 全量 287 文件 / 2893 passed + color-guard 406 + tsc 0)
Task 7: minor (deferred): `.cp-cell` 的 hover/is-active 背景是 Vue2 没有的(原版只改 `border-color`),brief 结构规格第 9 条点名要求所致;正常使用中被 `<img>` 全覆盖、仅图片加载前极短窗口可见。终审可 triage 是否收回。
Task 7: 教训(带下游 T8/T9): **非颜色视觉属性的程序化断言要「先锚定规则体、再断言属性」** —— 全文件级 `toContain('backdrop-filter')` 是恒真的;正则 `/\.sel\s*\{([^}]*)\}/` 还能顺带排除 `:hover` 等派生选择器。三条已落地的写法可直接照抄。
Task 8: 实现完成 (f96641a..b1f2f19, 4 文件 +689/-8, 25 新测试, 全量 287 文件 / 2918 + color-guard 406 + tsc 0)
Task 8: 评审(opus)Spec ✅ / Needs fixes,2 Important + 4 Minor。**控制器裁定两条 Important 均不成立(评审缺跨任务上下文,非实现缺陷),不进 fix 轮**:
Task 8: 裁定 I1 —— 「`/photos/places/:key` 路由不存在」**是 plan 的任务顺序使然**:该路由 + 目标页由 **T9** 落地(plan File Structure 明确 `router/index.ts` 归 T9)。T8 只负责推地址。**但评审的子论点成立并已转成 T9 的硬要求**:T8 测试的 `makeRouter()` 只注册 `/photos/places` 且断言只 spy `router.push`(永不解析路由),所以这类缺口测试抓不到 → T9 必须有「路由表真含 `/photos/places/:key` 且能解析」的断言,不能只 spy push。
Task 8: 裁定 I2 —— 「`open-spot-library` 六字段只进了四个(丢 `city`/`spotName`)」**不是信息丢失**:spec D6 的设计是目标页用 `key`(+`spot` query)回源 `getPlace` 自己导出城市名与 spot 名(plan T9 规格第 4 条),URL 只带 key/spot/lat/lon。**这样更好**:city/spotName 进 query 会在改名后变成陈旧字符串。T4 评审那句「零信息丢失,前提是 T8 严格照做」指的是**可重建**,重建点在目标页。**转成 T9 硬要求**:面包屑必须从 `key` + `spot` query 回源导出 city 与 spotName,不得指望 URL 里带。
Task 8: 两处申报**评审独立核过均成立**:①改既有 `autoPanTo` 精确 tx 常量**是合法后果不是反填** —— 评审手算:该用例 `wrapEl` 是未 mock 的真节点,jsdom `getBoundingClientRect().width = 0`,而判据是 `rect && hasDetailPanel()`(宽 0 的 DOMRect 仍 truthy)→ `420/0 = Infinity` → `min(0.55, Infinity) = 0.55` → 可见中心 x = `1000*0.45/2 = 225`,与新断言 `225 - wx*1.8` 吻合,原不变量(「让该点精确落在可见中心」)完整保留 ②**store 的 `coverBusy`/`spotBusy` 从未进 return 是真缺口**(P6a 起就在,两个 ref 定义/读写/`__resetForTest` 都有、唯独没导出 → 消费方读到恒 `undefined`),修法最小(只加两个标识符,零语义改动)。
Task 8: minor (deferred): ①既有 `autoPanTo` 断言现在钉在 jsdom 退化的魔数 225 上(真实浏览器宽 ≥763 时 panelFrac<0.55 永达不到),并让 `MAP_W` 在该测试文件变成死导入 —— 更好的写法是像本任务新增用例那样 mock `.map-canvas-wrap` 宽 1000(→290)②**改 tab/搜索词时会双发一次参数相同的请求**(`coverTab` watch 里 `coverPage = 0` 另排一个 `coverPage` watcher job;**Vue2 `:302-311` 同形**,属照搬,`coverSeq` 保证结果不别名、只浪费一次请求)—— 按「Vue2 竞态不照抄」纪律应至少注释登记,现两者都没做 ③`coverBusy`/`spotBusy` 的导出只靠 `vue-tsc`(模板 `store.spotBusy` 会 TS2339)兜住,`places.test.ts` 无一行断言导出存在 ④删码⑥的 fixture(`id='weird-id'`+`key=7`)在真实链路永不可能出现(`toPlace()` 恒 `id=String(key)`),纯防御。
Task 8: 竞态推演结论(评审逐条,带下游): 三浮层各自 `document` 级 `onDocKeydown` 内唯一早退是「非 Esc 即 return」、无 `stopImmediatePropagation` → **一次 Esc 三者都关**(非 P5-T10 形态);`activeDetail` id 分流真起效(删码②变红);`albumBusy` 判据正确(重入不弹 toast、真失败弹,各有用例)。
Task 8: complete (commits f96641a..b1f2f19, 2 Important 经控制器裁定不成立并转为 T9 硬要求,4 Minor 挂账; 全量 287 文件 / 2918 passed + color-guard 406 + tsc 0)
Task 9: 实现完成 (b1f2f19..43c41fd, 5 文件 +563/-1, 22 新测试, 全量 288 文件 / 2943 + color-guard 409 + tsc 0)
Task 9: 评审 Spec ✅(含 T8 转来的两条硬要求都满足:路由**真解析**断言用 `resolve()`/`push()` 后查 `currentRoute` 而非 spy;面包屑 city/spot 名全部经 `store.detail` 回源、组件从不读 URL 里的 city/spotName)/ Needs fixes,1 Important + 3 Minor → fix round 1/5 派出。
Task 9: I1(Important,真缺陷): `lat`/`lon` 的有限值守卫与 `spotKey` **脱钩** —— URL 手带 `?lat=1&lon=2` 而无 `spot=` 时会把非 null 坐标连同空 spotKey 传给 `listAssetsByPlace`,违反共享包「lat/lon 与 spotKey 成对」不变量;Vue2 `PhotosTimeline.vue:538-545` 明确只在 spot 命中时才赋坐标。应用内导航碰不到(三键一起带/一起清),手改地址或旧书签会。
Task 9: 实现者三处申报**评审独立核过全部成立**:①**brief 建议的 `getRoutes()` 下标顺序断言实测是错的** —— 评审现场用 vue-router 4 + createMemoryHistory 复现:动态段路由被排到下标 0、静态 `/photos/places` 在下标 1(与声明顺序相反),`resolve()` 仍各自正确匹配;改用 `?raw` 读源文本比较行序才是「只追加不重排」真正要保护的东西,且 `src/router/index.test.ts` 已有同款先例 ②**brief 说 `PhotosGrid` 有「另外 5 个消费方」实为 2 个**(`Photos.vue`/`PhotosFavorites.vue`,加本任务共 3 处模板级消费),不影响默认值回归断言的有效性 ③额外加的 `store.detail.id === placeKey` 身份校验**非 YAGNI**(有 `PhotosPlaces.vue:99-100` 同款先例,且是 spot 降级 watcher 能正确工作的前提)。
Task 9: 实现者自查出并修的真 bug(评审独立推演确认成立,带下游): **spot 降级 watcher 必须 watch「详情对象」而不是 `matchedSpot`** —— `matchedSpot` 在「详情还没加载」→「加载完但 spot 不存在」之间是 `null → null`,Vue 的 watch 视为未变、静默永不触发;改 watch `currentDetail`(每次重载都是新对象引用)后正确,且切城市时 `currentDetail` 先塌成 null(条件短路)不会在加载期误清 query。**同类:凡「查不到就降级」的 watcher,都不能把判据挂在可能 null→null 的派生量上。**
Task 9: fix round 1/5 (1 Important + 3 Minor addressed, 0 open; commit ea249ce)—— 复审核实两个 computed **都**做了 `spotKey` 门控(只改一个即 NOT ADDRESSED)、新用例真断言第三四参为 null 且 spotKey 为空串、删码(仅去掉 lat 那一行)实测变红、正常路径两条既有用例(合法坐标照传 / `lat=abc` → null)仍在仍绿;`PhotosGrid.vue`(5 视图共用基座)本轮零改动。
Task 9: complete (commits b1f2f19..ea249ce 共 2 提交, review clean; 全量 288 文件 / 2944 passed + color-guard & parity 416 + tsc 0)

## P6b 全 9 任务实现完成(2026-07-31)
- 坐标:New-UI `sp7-photos`@**ea249ce**(fa0df48..ea249ce 共 **13 提交**:9 个 feat + 4 个 fix 轮),**Service 侧全程零改动**(仍 6275ead)
- 门(**控制器独立复跑**):全量 **288 文件 / 2944 passed**(基线 280/2675 → 净增 8 文件 / 269 例)+ `vue-tsc --noEmit` exit 0 + color-guard & i18n parity **416 passed**;两仓工作树干净
- diff 规模:31 文件 / +5359 / -13
- 零缺陷任务:T1、T2、T5、T6(4 个);fix round 1 即收:T3、T4、T7、T9;T8 的 2 Important 经控制器裁定不成立(跨任务上下文)并转成 T9 硬要求
- **控制器(plan)查实的错误 1 处**:T7 手算 `1234 → 12.3k` 实为 `1.2k`(实现者与评审各自独立查出)。另有 3 处 brief 层面的不准确被实现者/评审纠正:T2 的 `git add` 清单漏文件、T2 删码⑦时序选错、T6 的 scss 行号漏 `.visit-save-btn`、T9 的 `getRoutes()` 顺序断言实测不成立、T9 的「PhotosGrid 有 5 个消费方」实为 2 个

## 整支终审(opus, fa0df48..ea249ce 共 13 提交)
- 判 **With fixes**:零 Critical / **2 Important** / 7 Minor
- **跨任务一致性七项全通**(逐项程序化核过):①组件契约 —— `PlaceDetailPanel` 11 个 emit 与容器 11/11 全绑,刻意改名的 `close-spot`/`open-spot-library` 两端都在;D9 四个发起处口径一致(hero 单张 / spot 缩略图单张 / recent 整段 / visit 那条 thumbs)②色值口径 —— 本期唯一新增 token `--place-home-base` 两套主题块都有值且同值、THEMING.md 已登记;theme-invariant 判断在 T3 hero 与 T6 继承的 `--place-current-trip` 之间自洽 ③hover 级联 —— 五对基类+变体**全部**用 `winningHoverBackground` 且都断言胜出选择器含 `:hover` ④9 处 `theme-exception` 位置全合规、注释文本零 `;`/`}`/字面色值 ⑤`--on-accent` 零第三处误用(两处合法都在 accent 实底上,hero 前景全走钉死浅色且有反向断言)⑥i18n 两 locale **全量 979 键键序逐字节一致**、45 新键零重复零死键零漏键、插值占位符逐键一致 ⑦`String()` 归一全链路无漏点
- **死代码清单七条零误迁**;**范围边界零越界零遗漏**(spec §7b P6b 行逐项落地);**rebase 债五个冲突面全纯追加零删除**(zh_cn +57/-0、en_us +60/-0、router +2/-0、theme.css +16/-0、vite.config.ts 未触碰)
- **文件体量判定:无需拆分**。但**容器 `PhotosPlaces.vue` 已 695 行(逻辑 ~383)接近上限** —— 终审建议:**P7 起把封面弹层的四个 watch + 提交逻辑抽成 `usePlaceCoverPicker.ts`**,否则 P7 再往这个容器加 FilterBar 就会越线。
- 2 Important:**I1 四处图标 glyph 与 Vue2 不符且同分支内自相矛盾**(`.ttl-region`/面包屑画成地图别针而 Vue2 是折叠地图 `map`;两处「保存」按钮画成 image glyph 而 Vue2 是 `album`;网格四 rect 丢 `rx=1`;时钟指针 `l3 3` 应为 `l3 2`)—— 同分支 `PlaceSpotDialog`/`PlaceCoverPicker`/`PersonHero` 恰好画对,证明是**漏抄不是统一决策**;三道门全测不出。**I2 `usePlaceAssets` 成功路径不清旧数据** —— 骨架门控是 `loading && !loaded`,第二次加载 `loaded` 已真 → 走 `v-else` 继续渲染上一个 spot 的照片与旧计数;真实触发路径 = 面包屑「只看整个城市」;Vue2 `PhotosTimeline.vue:821` 是发请求前先清。**反证力:该文件自己的注释写了「留旧照片比空态更具误导性所以清空」,却只在 catch 路径落实。**

## 终审修复波(一次性,6571cd8)
- 2 Important + 2 Minor(纯注释登记 M1/M3)全修;**其余 7 条 Minor 按终审 triage 留后续,未动**
- scoped 复审逐条 **ADDRESSED**:四处 glyph 读 Vue2 `PhotosIcon.vue` 真源逐字符比对一致,新增断言先锚定渲染块再 `toContain` 具体 path + `not.toContain` 旧 glyph(能区分「画对」与「画成别的」),改码验证实测变红;I2 的清空三行在 `await` **之前**、`failed` 复位口径一致,新用例在 composable 与组件两层都有区分力(删掉清空即红),既有「过期响应不回填」守卫语义未被破坏;**-6 行逐行核过全是 I1 那四处生产 svg 行,零测试断言被删或弱化**;`PhotosGrid.vue`(5 视图共用基座)本轮未被动

## P6b 关账(2026-07-31)
- **最终坐标:New-UI `sp7-photos`@`6571cd8`(fa0df48..6571cd8 共 14 提交:9 feat + 4 任务 fix 轮 + 1 终审修复波);Service 未改(仍 6275ead)**
- **门(控制器独立复跑于 6571cd8)**:全量 **288 文件 / 2954 passed** + `vue-tsc --noEmit` exit 0 + color-guard & i18n parity **416 passed**;工作树干净
- 基线对比:280 文件 / 2675 → 288 文件 / 2954(**净增 8 文件 / 279 例**);diff 31 文件 / 约 +5500
- **未合并 master**(spec §9:合流时点与与 `sp8-ai` 的先后归用户决策);**未跑 deploy.sh**(sp7-photos 落后 master 60+ 提交、不含 SP6 存储区工作,部署会把已部署待验收的 SP6 cutover 从真机 /app/ 抹掉)
- 待用户 **:5277** 真机眼验(验收清单见 plan 文末 40 项 + P6a 遗留的 4 条未证实看点)
- **台账按用户约定保留在 .sp7,不删**(与 SDD 技能默认的「终审通过后 rm -rf workspace」冲突时以用户约定为准)

## 真机验收第 1 轮反馈修复(2026-07-31,关账后)
用户在 :5277 眼验后提三点 + 一个「找不到入口」的疑问。两个提交:

- **`3ed4c77`(灯箱三处)**
  ① **删掉 OSM 页脚**(`Report a problem | © OpenStreetMap contributors …`):`PhotoInfoPanel.vue` 的小地图是**跨域 iframe**,CSS 进不去内部,只能在 `overflow:hidden` 的 `.map-mini` 上**上下对称裁切**(`top:-48px; height:calc(100% + 96px)`)—— 必须对称,否则地图中心与我们自绘的 `.map-pin` 错位。48px 由无头 chromium 实截量得(320px 宽下那行署名折成两行 ≈40px;截图脚本见记忆 headless-chrome-screenshot-check)。ODbL 要求保留署名 → 自绘 `.map-credit` 一行 `© OpenStreetMap`(9px,两条 theme-exception:钉死浅色 + 暗色投影,压在不可预测的地图瓦片上)。**副作用登记**:iframe 右上角 `+/-` 缩放钮一并被裁掉。
  ② **顶栏不透明**:`.lb-top` 去掉 `position:absolute` 与黑→透渐变,改 `flex:0 0 auto` + `--popup-bg` 实底 + `border-bottom`。
  ③ **图片夹在上下栏之间**:②的直接结果(`.lb-body` flex:1 自然占满顶栏与底部胶片条之间)。**连带两处必须一起改**:去掉 `.lb-top` 的 `v-if="isMoving"`(不透明的栏参与 5s 自动隐藏会让图片区忽然变高、图跳一下;翻页箭头仍自动隐——自动隐藏本身是 New-UI 发明,不是 Vue2 行为),以及 `:deep(.info-panel)` 上边距 `64px → 16px`(那 64px 只为给原先绝对定位的顶栏让位)。
  - 新增守卫 5 条(`PhotoLightbox.test.ts` 三条 `?raw` 样式断言 + `PhotoInfoPanel.test.ts` 新 describe 三条),5 条全做删码验证(反向字符串替换还原,未用 `git checkout --`);重写了原 5s 自动隐藏用例。

- **`850969c`(详情面板底不透明)**
  - `.map-detail` 绝对定位压在地图画布上,`--panel-bg`(深色 10% 白 / 浅色 42% 白)把地图网格点透上来。新增 **`--panel-bg-solid`** token(深色 = `--popup-bg` 去 alpha 的同色实底 `linear-gradient(157deg,#1e2234,#10131e 62%)`,浅色 `#ffffff`),两套主题块都给值 + THEMING.md 登记 + 组件与文件头 token 映射注释一并改。
  - **作用域判定**:左侧 `.map-rail` 与 `.map-shell` 在 grid 流内、底下只有 `--app-bg`,不透上来,**仍用 `--panel-bg`,未动**。
  - 守卫:`PlaceDetailPanel.test.ts`「面板底完全不透明」断言 `.map-detail` 用 `--panel-bg-solid` 且不用 `--panel-bg`(删码验证过红)。
  - **踩坑登记(会再咬人)**:想顺手断言「token 两套主题块都不带 alpha」**做不到** —— vitest 里拿不到 `theme.css` 的文本:对 `.css` 直接 `?raw` 和 `import.meta.glob(...,{query:'?raw'|'?inline'})` **实测都返回空串**(Vite 的 CSS 管线吃掉原文),本仓又**没装 `@types/node`**,`node:fs` 会让 `vue-tsc` 报 TS2307。这正是 `color-guard.test.ts` 把 `styles/theme.css` 整个跳过的原因。**写这类守卫时先断言取到的文本非空**,否则整条守卫静默空转(color-guard 历史上就这么空转过一次)。

- **用户「找不到重命名」= 不是缺陷,是当前设备数据不足**(已查后端源 + 直读 photos.db 证实):
  - spot 重命名入口在详情面板的「〈城市〉 的地点」段,点整行 → 弹卡 → 铅笔。截图里 **spots 那格显示 `—`**(`spotsLabel` 的 `|| '—'`,照 Vue2 :1094),即该城市 0 个 spot,整段不渲染。
  - 后端 `NimoOS-Photos/service/places.go`:`clusterCity` 贪心半径聚类 `spotRadiusKm=0.3`,`spots()` 丢弃 `count < spotMinPhotos=3` 的簇。
  - 直读 `/DATA/.system_data/photos/photos.db`(只读)复算:**全设备只有 7 张带 GPS 的照片,分属 2 个城市**(Gragnano 6 张 + 另一城 1 张);Gragnano 6 张两两距离 **0.57–1.77 km**,全部 > 0.3 km ⇒ 每张自成一簇(count=1)⇒ 0 个 spot。**全设备当前不存在任何 spot**,该 UI 在真机上无法触达,只有单测覆盖。要眼验需在同一 300m 内塞 ≥3 张带 GPS 的照片。
