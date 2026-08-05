# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-08-03-vue3-migration-sp7-p8a-settings-deeplinks.md

SP7-P8a 相册设置页 + 深链收口 + 错误态收口。工作区 `.sp7/{NimoOS-New-UI,NimoOS-Service}`,分支 `sp7-photos`。
**验收走 dev :5277。不合并 master、不跑 deploy.sh(用户 2026-08-03 快照版硬约束)。**
**收尾不删本台账目录**(项目硬约定,与 SDD 默认收尾步骤相反 —— SP7-P5 台账就是这么整个丢的)。

## 基线

- New-UI `sp7-photos`@`a6e0493`(= `cd21178` + merge master `--no-ff`,227 提交并入)
- Service `sp7-photos`@`a0cf09a`(= `6275ead` + merge master,15 提交并入),`pnpm build` 已重跑
- 门(merge 后实测):**453 文件 / 5739 passed** + `vue-tsc --noEmit` exit 0 + color-guard & i18n parity 含在全量内
- merge 冲突 6 个文件全部纯追加型解决:`package.json`(两侧 devDep 各留)· `pnpm-lock.yaml`(取 master 后 `pnpm install` 重建)· `src/i18n/{zh_cn,en_us}.ts`(两侧键块都留,**扫过零重复键、两侧各 1390 键**)· `src/router/index.ts`(两侧 import 都留)· `vite.config.ts`(**取 master 版** —— 它含 `optimizeDeps.exclude` 那条关键修复且 dev/preview 共用 `DEV_PROXY`,SP7 侧三条内联 proxy 规则被 master 的 `^/(?!app/)` 通配规则完全覆盖,默认端口同为 5273 仍可 `--port 5277` 覆盖)
- **已知 1 个 master 既有 unhandled error**:`src/settings/views/SettingsPage.test.ts` 的 `service.users.avatarPath is not a function`(SP9-P4 的测试 mock 缺方法)。**在 master 主工作树上同样复现 ⇒ 非本期引入,不在本期修**,登记为 SP9 侧债务。

## 范围决策(用户 2026-08-03 拍板)

- **D19** P8 拆 P8a(本期,零 master / 零 Vue2 仓改动)/ P8b(快照发布后:两个 cutover 触点 + 合流 + 部署 + 全区回归)
- **D20** 桌面磁贴翻向(`useOpenAction.ts:10` `SYS_ROUTE.photos`)推 P8b,不提前做
- **D21** **上传子系统整块不做**(TUS 队列 683 行 js + 抽屉 196 + 文件卡 198 + 上传视图 978 + 上传顶栏 54 + DropZone 110),不建 `/photos/upload` 路由
- **D22** 设置页底部 `Sign out` 不迁(New-UI 已有全局登出 `AccountPanel.vue:167`)
- **D23** P5 挂账的 zh 三键英式空格保留原样

### D21 的三条连带后果(已向用户申明)

1. SP9 转来的「清理本地待上传缓存」按钮**无法接线**,维持禁用+标注态,债务 D13 继续挂账
2. P1 挂账「`idle` 守卫换成真上传队列态」**做不了**
3. **P8b cutover 后新相册没有任何上传入口** —— 加照片只能走文件区拖进 `/DATA/Gallery` 或退回 Vue2 老相册。上传可后续单开一期补

## 本期回源实证(纠正开工 prompt / spec 的过期信息)

1. **上传视图 1142 行是不可达死代码**:`activeNav === 'upload'` 才渲染,但侧栏无该条目 + `PhotosTimeline.vue:477` 的 `NAV_KEYS` 不含 `'upload'`(故 `?view=upload` 也进不去)+ 全仓 `grep "activeNav\s*=\s*'upload'"` 零命中。`PhotosDropZone` 2026-07-07 已注释停用。与 D17(archive 六环)同形态
2. **`photoset` 的 2 分钟过期清理归生产者侧**(`src/views/AI/Agent/services/openInApp.js:76-85`,从 key 名解析时间戳),消费侧只做「读 → `removeItem`」。**spec §2 措辞须订正**
3. **`isConflict` 只有 1 处 live 调用点**(`AlbumPickerDialog.vue:143`),开工 prompt 说的「3 处」不成立
4. **`photosPersonSubtitle` 死键已在 P7a 终审 Minor 8 删除**,prompt 那条已不成立
5. **共享包 photos 域已有本期全部所需方法** ⇒ 本期零共享包改动
6. **New-UI 至今零 query 深链处理**,五式深链全部是新建

## 任务进度

(逐条追加)

### T1 photosSettings store

- 首轮 implementer(sonnet)DONE @`df9cc07`,28/28 passing、0 `[Vue warn]`、tsc exit 0
- **计划书错误 1 处(implementer 回源纠正)**:plan 写的 `updateConfig({...})` 单对象签名与共享包实际的位置参数签名 `updateConfig(watchDirs, retentionDays?, facesEnabled?, extra?)` 不符,且 `watchDirs` **必填非空** ⇒ **每次写配置必须先 `getConfig()` 取回当前 `watchDirs` 一并回发**。已按共享包源实现。**此结论必须带给 T3/T4/T6。**
- 任务评审(sonnet)判 Needs fixes:1 Important + 3 Minor。评审独立复核了 `watchDirs` 保全路径(三个写动作都是 read-then-write、`getConfig()` 失败即整体中止)与 `favorites.ts:44` 的 loaded 惯例,均通过;5 项变异验证有 4 项可追溯。
- **Important 1 的根因是计划书自相矛盾** —— 接口段写 `rebuildIndex(): Promise<string>`(零参),实现段却给了 `rebuildIndex(findRunningId?)` 可选回调 ⇒ 零参调用时 409 静默返 `''`。**控制器 dispatch 时的裁定「不要 import timeline store」也是错的**(原意只是「别建第二个轮询」),已在 fix round 1 明确retract,改为照 Vue2 `PhotosSettings.vue:458-473` 在 store 内部刷一次任务列表再查找。
- `Task 1: fix round 1/5` — 派出:Important 1(rebuildIndex 改零参 + 内部读 timeline + 第 6 项变异验证)+ Minor 3(reset 测试两个字段断言恒真,补真值再 reset)
- `Task 1: minor (deferred): retention 在 settings.ts 与 trash.ts 各缓存一份,可能漂移` —— 按控制器裁定保留(改动 trash 视图属无关重构),留终审 triage
- `Task 1: minor (deferred): 三个写动作各自 getConfig+updateConfig,同帧连写有交错窗口` —— 与 Vue2 `photos.js:1249-1438` 逐字同形,非回归,留终审 triage
- `Task 1: fix round 1/5 (2 addressed, 0 open; commits df9cc07..46a5590)` — 复审独立核了两条新风险:`useTimelineStore()` 在 action body 内调(module 顶层只有 import)、`fetchTasks()` 无 interval 故不构成第二个轮询、refresh 有 await 不与读竞态;第 6 项变异验证的可信性也复核通过(mock 的 `fetchTasks` 只在被调用时才填 `tasks`,删掉调用确实会红)
- `Task 1: complete (commits a6e0493..46a5590, review clean)`

### T2 i18n 键

- implementer(sonnet)DONE_WITH_CONCERNS @`29167c4`,**71 键**双档,25/25 passing、0 `[Vue warn]`、tsc 0
- **⚠️ 过程事故**:implementer 中途跑 `git checkout -- src/i18n/zh_cn.ts`,把未提交的 71 个新键全擦,随后重新 append。**控制器独立复核**:1461/1461 键、键序逐字节一致、零重复、71 新键在位 —— 已完全恢复。评审又逐个核了重 apply 后的 zh 值与 json 源、19 处自拟引证与 Vue2 file:line,零错。**教训:implementer 不得在工作树里跑 checkout/stash(已写进后续 dispatch)**
- **计划书错误 2 处(implementer/评审回源纠正)**:①`photosSettingsIndexPct` 被 plan 标为「自拟」,实为 Vue2 `:176` 把裸数字与真 json 键 `"complete."` 拼接 ⇒ 改为 composed 键并双档注释登记 ②plan 测试草稿的 `SAME_OK` 白名单条目 `photosSettingsSegPhotos` 是错的(照片≠Photos),控制器裁定从空集起
- 任务评审(sonnet)判 **Approved**,零 Critical 零 Important
- `Task 2: minor (deferred): photosSettingsCacheLabel 的注释措辞绕(写在自身键上却说「被自己复用」),事实无误` — 留终审 triage
- `Task 2: complete (commits 46a5590..29167c4, review clean)`

### T3 设置页存储卡

- implementer(sonnet)DONE_WITH_CONCERNS @`050b12f`,18/18 own + 751 color-guard/parity passing、0 `[Vue warn]`、tsc 0
- **计划书错误 2 处(implementer 回源纠正)**:③brief 的测试草稿假设装了 `@pinia/testing`(**实际没装**)且引用了 `cssCascade.ts` 里**不存在的 API**(`winningDeclaration` / `readComponentStyle` —— 该文件真实导出 `winningHoverBackground` / `extractStyleBlock` / `parseCssRules` / `ownBackground`);改用本仓既有的「真 Pinia + mock 共享包」惯例 + 真实 API,控制器已独立确认 ④brief 自己的边界 fixture 有 IEEE-754 缺陷(`1.05 - 1 ≠ 0.05`),改用 `known=0, usedGB=0.05` 落在与阈值字面量同一 double 位模式上(评审复核:`>`→`>=` 变异确实变红,边界是真的)
- 任务评审(sonnet)判 Needs fixes:**2 Important**。评审独立复核通过的项:八条 1:1 契约逐行对 Vue2 无差异 · 四个新 token 两套主题块都有值且已进 THEMING.md §6 · 零字面色值 · hover 级联变异经 `cssCascade.ts` 逻辑追踪确实会红 · mock 方式是真渲染行为非 mock 回声 · 图标 path 与既有组件逐字节相同
- **Important 1 = 真缺口 + 报告虚报**:Rescan Now 那条(`rescanNow`/`triggerScan`/`scanBusy` 守卫/成功与失败两种 toast)**零测试覆盖**,而 task-3-report.md:195-198 声称「已纳入组件与测试」。Important 2:该按钮缺 `data-test` hook(正是覆盖缺口不易被发现的原因)
- `Task 3: fix round 1/5` — 派出:Important 1(补 3 条测试:成功 / 失败 / busy 守卫,并在 fix 报告里如实记录虚报)+ Important 2(加 `data-test="rescan-now"`)+ 带上两项(段数断言改精确 6 · 修正 `[Vue warn]` 证据的归属运行)
- `Task 3: minor (deferred): storagePalette.ts 把调色板常量与三个格式化/聚合函数捆在一个「palette」名下` — plan 强制的布局,已注释与报告双处登记,留终审 triage
- `Task 3: minor (deferred): 五处重复的 store.storage fixture 字面量,可抽 factory` — 留终审
- `Task 3: minor (deferred): 两个保存失败 toast 的 shield 图标是类比之选(Vue2 那条真实路径根本没图标)` — 已登记
- **⚠ 跨任务接口债(T5 必须兜住)**:本卡只自己调 `fetchStorage()`;`about` / retention / scanInterval 靠 **T5 容器在页面挂载时拉**。T5 dispatch 时必须把这条写进去,否则设备名与两个档位会停在默认值

#### 📌 T3 建立的测试惯例(T4 及后续组件任务直接沿用,勿重踩)

- **`@pinia/testing` 本仓未装。** 组件测试一律 `setActivePinia(createPinia())` 起真实 store,`vi.mock('@nimotech/nimoos-service', …)` 只 mock 共享包;需要控制某个 action 返回值时 `vi.spyOn(store, 'action')` 单点 stub,其余走真实实现。先例:`settings.test.ts` / `AlbumPickerDialog.test.ts` / `PhotosStorageCard.test.ts`
- **hover 级联守卫的真实写法**(`cssCascade.ts` 只导出 `extractStyleBlock` / `winningHoverBackground` / `parseCssRules` / `ownBackground`):`?raw` 导入组件源码 → `extractStyleBlock(raw)` → `winningHoverBackground(style, ['类名'])` → 断言 `winner.selector` 同时含 `:hover` 与变体选择器。先例:`PhotosFilterChip.test.ts:107-114`
- **计划书的测试草稿不可信**(本期已 4 处错误:编造 helper API、假设未装的包、浮点夹具、自相矛盾的签名)。**用之前先核实 helper 与包真的存在**,不符即按本仓既有先例改写并登记
- `Task 3: fix round 1/5 (4 addressed, 0 open; commits 050b12f..04e6684)` — 复审判全部 addressed 且逐条核了强度:成功用例断言 emit 载荷的 icon(非仅调用)· 失败用例同时断言兜底 toast 与 `scanBusy` 复位 · busy 守卫用「握住未 resolve 的 promise + 调用次数」而非仅 `disabled` 属性(真正证明 `if (scanBusy.value) return` 而非依赖 jsdom 的 disabled 语义)· 段数断言从**同一** fixture 派生。诚实声明经复核「plain and legible, not euphemistic」。**因当时安全分类器不可用,控制器又独立复核了 4 项断言与复跑该测试文件(21/21)**
- `Task 3: minor (deferred): 成功 toast 用例只断言 icon 未断言 text 键,文案键回归不会被抓` — 复审所加,留终审
- `Task 3: complete (commits 29167c4..04e6684, review clean)`

### T4 设置页 AI 卡

- implementer(sonnet)DONE @`6a4d426`,18/18 passing、0 `[Vue warn]`(本文件自己那次运行)、tsc 0、color-guard+parity 754/754。**零新 token、零新 i18n 键、零 fix 轮**
- 任务评审(sonnet)判 **Approved**,零 Critical 零 Important。评审逐条独立复核:七条 1:1 契约对 Vue2 行号无差异 · 三种不同的 store 错误返回形状(返 false 已回滚 / 抛错 / 布尔)被正确区分处理 · 四个派生量确实是 `computed` · 不自拉 `about` 且有专门用例证明挂载时不调三个 fetch · 无第二轮询 · **5 项变异验证逐个核了「该变异确实能让那条用例变红」**(含跳变守卫那条:用例构造成首次观察即 `done` 且此前从未 `running`,故守卫弱化成 `status==='done'` 必然误弹)
- **因当时安全分类器不可用,控制器独立复核**:i18n 零改动 · `rebuildIndex()` 零参 · 5 个 data-test 钩子 · 复跑 18/18。`:data-test="\`ai-switch-${f.id}\`"` 一度可疑(疑似把模板字面量当静态属性),核实为动态绑定且测试断言了四个实际值 —— 误报解除
- `Task 4: minor (deferred): --accent 在两套主题块都是蓝(#8ab4ff / #3b5bdb),而 Vue2 该图标的字面色是紫 #6E5BFF;--accent2(#b79bff / #6e5ae0)在色相上近得多` —— **这是 T3 就已建立的先例(PhotosStorageCard.vue:250-251 同一处理),两卡同源**,属真实视觉保真偏差但非本任务引入。**建议终审修复波里两卡一起换 --accent2**
- `Task 4: minor (deferred): Vue2 图标壳上的 data-tint="ai" 属性未移植` —— 已 grep 实证 Vue2 侧无任何 CSS 消费它,零视觉影响
- `Task 4: ⚠️ 复审留的不可验证项`:两张卡的细粒度 CSS 间距(如 Vue2 privacy banner 的内联 `margin:14px 22px 18px`)无法从 diff 判 —— Vue2 `PhotosSettings.vue` 自己没有 `<style>` 块,布局 CSS 在未被引用的外部样式表里。**归入真机眼验清单**
- `Task 4: complete (commits 04e6684..6a4d426, review clean)`

### T5 设置页容器 + /photos/settings 路由 + 侧栏入口

- implementer(sonnet)DONE @`6324470`,843/843 across 7 文件(容器 + 侧栏 + 两张卡 + 路由 + color-guard + parity)、tsc 0
- **计划书/dispatch 错误 1 处(第 5 处,implementer 回源纠正)**:brief Step 1 的守卫测试要求页内**零** `PhotosSidebar` 副本,控制器 dispatch 也写了「AreaShell 提供侧栏」—— 实际 `AreaShell.vue` **没有 sidebar 概念**(只有 header + slot),每个 sibling 视图自己在 slot 里挂**一份**(`PhotosAlbums.vue:187`)。照零副本做会得到一个没有导航的页面。改为「恰好一份」并双处登记,评审读全 44 行 `AreaShell.vue` 后确认这是本仓惯例
- **implementer 诚实登记的一次 false green**:mutation-2 首次尝试(比对 `scrollIntoView` 调用)对「白名单被删」这个变异无法变红,改成追踪 `querySelector` 的实参才真。评审复核:重塑后的用例确实会在变异下变红,且正向用例断言的是真 DOM 效果(`scrollCalls[0] === w.get('#ai').element`)而非 mock 回声 —— **重塑是加强而非削弱**
- 取数归属经评审独立核对无误:容器四个(`fetchAbout`/`fetchRetention`/`fetchScanInterval`/`fetchAiFeatures`)+ 存储卡自己的 `fetchStorage` = 恰好复现 Vue2 `:500-526` 的五个挂载取数,零缺口零重复
- 四条架构偏离(不挂第二份侧栏 / 无 open prop 与 ESC / 不迁 themeMixin / 不迁 Sign out)全部在组件头注释登记,后两条有专门守卫测试
- 任务评审(sonnet)判 **Approved + 1 Important**
- **Important 1(控制器裁定:修,不推)**:`?section=` 只在 `onMounted` 滚一次,而 vue-router 4 对 query-only 变化不 remount ⇒ 已在设置页时改地址栏加 `?section=ai` 静默无反应。**验收清单里就有「手输深链地址」这条路径** ⇒ 可达。要求加 `watch(() => route.query.section)` 并与 mount 路径共用同一白名单(防漂移)+ 两条测试 + 变异验证
- `Task 5: fix round 1/5` — 派出:Important 1
- `Task 5: minor (deferred): PhotosSidebar.test.ts 有 ~105 条 pre-existing [Vue warn],根因是该文件自建 legacy createI18n` —— 评审用算术确认为既有(119 ÷ 7/次 = 17 个用例,新加的 2 个贡献同样的 per-mount 模式,无新告警类型)。按禁无关重构不动,**留给后续动那个文件 plugin 装配的任务收敛到 vitest.setup.ts 单例**
- `Task 5: fix round 1/5 (1 addressed, 0 open; commits 6324470..1537bbe)` — 复审逐条核了控制器的五项子要求:①白名单确实只在 `isSectionId` 一处判定,`onMounted`(`:117`)与 `watch`(`:127`)共用 `scrollToSection`,零重复字面量 ②未被迫合并成 `{ immediate: true }`,mount 路径保留 ③两条新用例都在**同一 router 实例**上 `router.push` 制造真 query-only 转场(非 remount),合法值断言滚到 `#ai` 且长度恰为 1、非法值 `section=1` 断言零滚动 ④变异失败模式(`expected [] to have a length of 1 but got +0`)与该用例真会产生的断言吻合 ⑤头注释已从「留给 T6 的已知限制」改为「两条路径都已处理」。**双击检查**:`watch` 无 `immediate` ⇒ 新鲜挂载带 `?section=ai` 时既有用例仍断言滚动次数恰为 1,排除双滚回归
- **因当时安全分类器不可用(Bash 亦被挡),控制器用只读 Read 独立核实**:`isSectionId` 单一判定处 · 两路径共用 `scrollToSection` · `watch` 无 `immediate` · `onUnmounted` 清 toast timer · 四个 fetch 在 `onMounted`。测试复跑延到 T11 全量门
- `Task 5: complete (commits 6a4d426..1537bbe, review clean)`

### T6 三项 config 挂账收编

- implementer(sonnet)DONE_WITH_CONCERNS @`40bc33e`,898/898 定向 + 2331/2331 泛扫、tsc 0
- **三项债全部结清**:§7e-10(两视图各自 `getConfig` 收编进 store)· §7e-15(侧栏按 `smartview === false` 隐藏智能视图条目)· §7e-9(死 `<span>` 换真 `RouterLink` → `/photos/settings?section=ai`,`photosSvSettingsPending` 双档删除)
- **store 新增在途去重**:`aiFeaturesInFlight` promise 句柄,并发复用 + `finally` 清空 ⇒ **刻意不做永久缓存**(保住「设置页保存后再进列表页能看到最新值」)。形状照 Vue2 `_restoreUploadsPromise` 但语义不同(那处永久不重置)
- **计划书错误 1 处(第 6 处)**:brief 给 PhotosPeople 的测试体断言 `getConfig` **不**被调用,与**同文件既有通过用例**(`:798-807` 断言 `getConfig` 恰好 1 次,因为该用例用真 store)直接矛盾 ⇒ 换成等价意图的 spy 断言。评审复核:implementer 的读法正确,替代方案 + 那条未动的 sibling 断言**联合**证明了「视图不再自读 + 恰好一次网络调用」
- **implementer 诚实报告的一处「变异验证做不到」**:变异 ③(侧栏处 `=== false` → `!x`)**任何用例都不会变红** —— 因为 `readAiFeatures` 的 `on()` 返回 `v !== false`,到侧栏时已是严格布尔,两种写法在那里行为相同。它改在 store 的 `on()` 处验证。**评审独立复核确认这个推理正确**,并找到真正钉住契约的用例(`settings.test.ts:48-56` 喂 `ocr: 0` 与 `smartview: null`,确实能区分 `!== false` 与 `!!v`)。**控制器裁定 2 的「必须在侧栏层测 === false」是错的,真正的守卫只能在 store 层**
- **控制器独立复核(分类器不可用期间用只读工具)**:去重实现 + `finally` 清空 · `on()` 保严格布尔 · `NAV_ALL` 7 项顺序未动 + `=== false` 判据 · Task 5 齿轮入口在位(`:105`)· `photosSvSettingsPending` 双档已删且三处「残留」全是登记注释非真引用 · 链接 `to="/photos/settings?section=ai"`
- 任务评审(sonnet)判 Needs fixes:**1 Important**
- **Important 1 = 真缺口**:`PhotosSettings.test.ts:851-858` 把断言从 1 改成 2,但那是**被 mock 的 action**(`vi.spyOn(store,'fetchAiFeatures').mockResolvedValue`),**真去重代码根本没跑** ⇒ 「一次页面加载只发一次 `getConfig`」这个**去重的整个存在理由**在 `PhotosSettings` 与 `PhotosSmartViews` 两处都无测试。只有 `PhotosPeople` 靠一条既有 sibling 断言偶然覆盖
- `Task 6: fix round 1/5` — 派出:Important 1(两页各加一条真 store 的集成测试,断言 HTTP 层 `getConfig` 恰好 1 次 + 拆掉早返做变异验证)+ 带上两项(两处 `toHaveBeenCalled()` 收紧成 `toHaveBeenCalledTimes(1)` · 侧栏那条名不副实的测试改名或补真同步断言)
- `Task 6: minor (deferred): PhotosPeople.test.ts(406)与 PhotosSmartViews.test.ts(91)也有 pre-existing [Vue warn]`,与 `PhotosSidebar.test.ts`(~105)同根因(各文件自建 legacy `createI18n`)。**三文件一并留给后续动其 plugin 装配的任务收敛到 vitest.setup.ts 单例**

#### 📌 T7/T8 深链任务的关键坐标(控制器预先查实,写进 dispatch)

- `useLightbox()` 的入口是 `openAt(photo: Photo, entryList: Photo[], startMs?: number, query?: string)`(`src/photos/lightbox/useLightbox.ts:55`),**要的是 `Photo` 对象不是 id**
- 灯箱内部自己用 `service.photos.getAsset(id)` 做明细水合(`:107`),带 `_hydrateSeq` 竞态守卫 ⇒ 深链只需给出「够开的」Photo,翻页时灯箱会自己补齐
- **⚠️ `Photo` 是宽接口、25+ 字段全必填**(`src/photos/util/assetToPhoto.ts:267-292`)⇒ Vue2 的 `?photoset` 翻页集写法 `ids.map(id => ({ id }))` 在 TS strict 下**过不了类型**。正解是 `assetToPhoto({ id })`(`:314`,接 `Record<string, unknown>`,缺字段填默认值),**不要用 `as unknown as Photo` 硬转**。语义与 Vue2 注释「list items only need id, the lightbox fetches each photo's detail on navigation」等价
- `Task 6: fix round 1/5 (3 addressed, 0 open; commits 40bc33e..1da9c2f)` — 复审逐条核:①两页各加真 store 的网络层用例(`PhotosSettings.test.ts:161-166` / `PhotosSmartViews.test.ts:266-269`),`fetchAiFeatures` 未 mock、断言 HTTP 层 `getConfig` 恰好 1 次;两页模板确实渲染真实 `<PhotosSidebar/>`(`PhotosSettings.vue:137` / `PhotosSmartViews.vue:91`)故去重路径真被走到;mock 从 `photos: {}` 升成 `photos: { getConfig: vi.fn() }` + `beforeEach` 复位,故计数是真的而非「被 TypeError 兜住」的空转 ②**Take-along A 是「正确的偏离」**:implementer 没照建议改成 `toHaveBeenCalledTimes(1)`,而是先手工核实真实次数是 **2**(视图 + 其挂载的侧栏各调一次 action),复审独立验证后确认 **finding 建议的 1 基于错误假设,钉 2 才对** ③侧栏那条名不副实的用例已改名 + 另加一条真同步 pre-resolve 用例(不 flush,断言 promise 在途时 7 项仍渲染)
- **implementer 诚实登记的一处返工**:`PhotosSettings` 网络层用例首版测到 **3** 次 `getConfig` 而非 1 —— 因为 `fetchRetention`(`settings.ts:180`)与 `fetchScanInterval`(`:210`)各自也读一次 config(T1 的 read-then-write 模式所致)。用 spy 隔离这两条、只留 `fetchAiFeatures` 路径可观测;复审判「合法隔离,非掏空测试」(两个真实 `fetchAiFeatures` 调用方都还活着未 mock)
- `Task 6: minor (deferred): 设置页首屏实际会发 3-4 次 getConfig`(`fetchAiFeatures` 1 + `fetchRetention` 1 + `fetchScanInterval` 1,各自独立读)—— 是 T1「写配置前先读回 watchDirs」模式与三个读取各自读 config 的必然,非缺陷、非本期引入,但**可合并成一次 getConfig**,留终审 triage
- `Task 6: complete (commits 1537bbe..1da9c2f, review clean)`

### T7 深链 ?asset / ?photoset

- implementer(sonnet)DONE @`ba8d122`,10/10 新用例、0 `[Vue warn]`(本文件)、`Photos*.test.ts` 回归 490/490、tsc 0、**零 fix 轮**
- **计划书错误 1 处(第 7 处,implementer 实测纠正)**:brief 的测试骨架让 spy 外层 `useLightbox()` 返回对象的 `openAt` —— **拦不住**composable 内部那次 `useLightbox()` 调用(每次调用返回新的对象字面量,但闭包引用的是同一份 module-level refs)。改为断言真实共享状态(`lb.open`/`list`/`index`/`current`/`hasPrev`/`hasNext`)。**评审读全 `useLightbox.ts` 后确认诊断正确,且判定「换法是加强而非削弱」**——断言共享状态证明灯箱真的以正确的集合打开了,spy 只证明某函数被调用过
- 评审逐条核了「换法后仍能区分契约要求区分的情形」:单张成集 vs 全 photoset 集(`length===1` vs `.map(id).toEqual([...])`)· **降级路径开的是单张集而非泄漏全 `ids` 集**(`hasPrev/hasNext===false`)· 静默不做事那条同时断言 `lb.open===false` + toast 未弹 + `getAsset` 未调
- 控制器 7 条裁定全部落实并逐条经评审对 Vue2 源核实无差异;`assetToPhoto({ id })` 解决 `Photo` 宽接口问题,零 `as unknown as Photo` 逃逸;`:39` 那处 `as unknown as Record<string, unknown>` 经核**是必要的**(共享包 `getAsset` 返具名接口 `PhotoAsset`,具名接口不能直接赋给索引签名)且与既有 `useLightbox.ts:109` 同一写法 = 本仓惯例
- **控制器独立复核**:`__resetForTest()` 在 beforeEach + afterEach 双侧 · `Photos.vue` 确实只 +3 行 · 复跑 10/10
- 任务评审(sonnet)判 **Approved**,零 Critical 零 Important
- `Task 7: minor (deferred): 缺「ids 全为假值」的直接用例`(该分支已被另三条用例经不同根因走到)· `缺 getAsset resolve 假值(非 reject)的直接用例`(同一条 `asset ? … : null` 三元汇入 notFoundToast)· `firstQueryValue 处理了 Vue2 裸访问不防的 LocationQueryValue[] 数组情形`(vue-router 4 类型所需,非行为性修 bug,无需 移植纪律 登记)
- `Task 7: complete (commits 1da9c2f..ba8d122, review clean)`

### T8 深链 ?q / ?album / ?person

- implementer(sonnet)DONE @`4b94094`,19/19 本文件、0 `[Vue warn]`、本地全域 509/509、tsc 0、**零 fix 轮**
- 控制器 7 条裁定全部落实并经评审对**三处不同的 Vue2 源**逐条核实无差异(Vue2 把这三个键放在三个地方)
- **Vue2 缺陷按铁律修 + 注释登记**:`?album`/`?person` 的 id **Vue2 不编码**(它在单路由内切状态,从不拼路径)⇒ 走命名路由 + `params` 让 vue-router 自己编码。**评审验证了这条编码测试真能抓**:用 `album: 'a/b'` 同时断言路由名解析成 `photos-album-detail`、`params.id === 'a/b'`、`fullPath` 含 `%2F` —— 若退回字符串拼接,`/photos/albums/a/b` **匹配不上**单段动态路由 `:id`(vue-router 的动态段不跨 `/`),路由名断言必红。不是「编码坏了也能过」的空转
- **implementer 两处偏离,评审判都对**:①`?album` **刻意不调 `fetchAlbums()`** —— 评审读 `PhotosAlbumDetail.vue:311-312` 确认目标视图自己会懒加载(`if (!albums.albumsLoaded) void albums.fetchAlbums()`),且无按 id 的单独端点,故跳过无功能缺口 ②顺序断言改用「握住未 resolve 的 promise + 断言 `router.replace` 尚未被调,resolve 后两者都触发」,评审判**比 `invocationCallOrder` 更强**(是真时序证明而非调用序号)
- **implementer 主动登记的一处死分支**:`fetchPeople()` 自己吞错(`people.ts:97-101`)⇒ composable 里那个 `catch` 在当前 store 实现下不可达,它如实说明而非声称覆盖了该分支
- **控制器独立复核**:五处全用 `router.replace` 零 `push` · 编码测试三重断言在位 · 复跑 19/19
- 任务评审(sonnet)判 **Approved**,零 Critical 零 Important
- `Task 8: minor (deferred): q/album/person 三键同现时会在同一 tick 发三次 router.replace,可能互相取消` —— Vue2 从无此问题(它三个处理器只改本地状态、从不导航);非现实 URL 形态,但**建议终审修复波加一行注释说明出局**,免得后来人以为所有组合都考虑过了
- `Task 8: minor (deferred): q 为纯空白串无专门用例`(已被 `if (q)` 真值判断经其它用例走到)
- `Task 8: complete (commits ba8d122..4b94094, review clean)`

### T9 两处错误态收口(P3 收藏静默空网格 / P4 相册详情永久骨架)

- implementer(sonnet)DONE @`b1f7c2c`,103/103(favorites 22 + albums 23 + PhotosFavorites 26 + PhotosAlbumDetail 32)、tsc 0、color-guard 757 + parity 绿。**本任务不是从 Vue2 移植,而是修本次迁移前几期自己引入的两个缺陷**
- **陷阱守住了**:两个 store 的「loaded 标志仅成功路径置真」是刻意的,**控制器 `git diff` 过滤 `Loaded` 实证:唯一涉及改动是两个 export 行追加 `loadError` + 解释性注释,语义逐字节未动**
- 评审独立核过:`loadError` 独立且两 store 对称(同名、同三个触点)· 失败分支在两个模板里都先于骨架/空态 · 四个文件零 scope creep · 零新键零新 token · 重试按钮复用 hover-safe 的全局 `.bar-btn`(无变体 ⇒ 不触发本区栽过四次的 hover 特异性问题)· **两条 Ruling-5 守卫用例真走非失败路径**(默认 resolve 空列表 / 永不 resolve 的 promise)而非手设 store 标志 · 两项变异验证按代码推理都成立
- **Important 1 = 控制器裁定自身的缺陷(plan-mandated)**:我 Ruling 1 写的「尝试前置 `false`」使重试在途时失败态短暂消失 ⇒ `PhotosAlbumDetail` 落骨架分支(尚可接受),但 **`PhotosFavorites` 没有 loading 分支,会落 `v-else` 渲染空网格 —— 正是本任务要修的 P3 症状在每次重试期间短暂复现**。且「reject → retry → reject」全无用例
- **控制器裁定:撤回 Ruling 1,改为「只在确认成功时清 `loadError`」** + 重试按钮在途禁用(补回被移除的进行中反馈,并顺带关掉评审的双击竞态 Minor)+ 补 4 条用例(store×2 与 view×2,view 那对才真正钉住不变量)+ 反向变异验证(把前置清回填,确认 Favorites 的 view 用例变红 = 证明该 transient 真实存在且已关闭)+ 代码注释里写明「原指令是前置清、为何反转」
- `Task 9: fix round 1/5` — 派出:Important 1(五项)+ 带上间距不对称
- `Task 9: fix round 1/5 (1 addressed + take-along, 0 open; commits b1f7c2c..1fed2bc)` — 复审逐条核五项子要求 + 带上项,全部 addressed
- **implementer 自查自纠一次(值得记)**:它第一版的 Favorites in-flight 用例**零回归抓力**(只断言 settle 之后的状态,即使 transient 存在也会通过),**它自己用变异测试逮到并重写**成「`mockImplementationOnce` 返回未 resolve 的 promise + 捕获 reject + 点重试后只 `await nextTick()`(不 flushPromises)+ 在**在途窗口内**断言失败态在、网格不在,之后才 reject + flush 再断言 settled」。诚实登记在报告与代码注释双处
- **复审独立追踪(非采信报告)确认该用例真会变红**:若把前置清回填,重试进 `fetchFavorites` 会在 await 前同步把 `loadError` 置假,而 `favoritesLoaded` 仍假 ⇒ `isEmpty` 假 ⇒ 落 `v-else` 渲染网格 ⇒ 那条在途断言 `expected false to be true` 变红。与 implementer 报告的变异结果逐字吻合
- 两个 store 的 `loadError` 现在**只在确认成功后清**(`favorites.ts:195-196` / `albums.ts:140-141`),前置清已移除;`retrying` ref 是**视图本地**未进 store;`:disabled` 绑定零新类零新键零新 token;反转理由已在两个 store 的多行注释里登记
- `Task 9: minor (deferred): 两条 store 级 reject→retry→reject 用例是 settled-state 检查,单独看抓不到「retry 静默 no-op」的回归`(无调用次数/spy 断言)—— 是控制器 ruling 3 的框定所致(把钉不变量的职责给了 view 那对,且 view 那对经独立追踪确实关掉了缺口),非实现短板
- `Task 9: complete (commits 4b94094..1fed2bc, review clean)`

### T10 杂项收口

- implementer(sonnet)DONE @`da90689`,182/182(5 个核心触及文件)+ 扩展触及文件集全绿、0 `[Vue warn]`、tsc 0
- **⚠️ 控制器独立复核的一次真实失误(如实登记)**:我早先断言「`isConflict` 只有 **1** 处 live 调用点(`AlbumPickerDialog.vue:143`),开工 prompt 说的 3 处不成立」——**错了,实际是 5 处**(`AlbumPickerDialog.vue:143` / `PhotosFavorites.vue:114` / `PhotosAlbumDetail.vue:204` / `PhotosAlbums.vue:145` / `PhotosPersonDetail.vue:489`,全是「相册重名」判定;`src/apps/components/settings/PortsEditor.vue:6` 那个是**同名的本地函数**,与 photos util 无关)。**根因:我那次 grep 加了 `| head -10`,输出被截断,我把截断结果当成了全量。** 教训:**独立复核用 grep 时不得加 head 截断,或必须另跑一次计数确认**。此结论已回填 plan 与本台账。这条修正因此比原以为的更有价值(影响 5 个调用点而非 1 个)
- **implementer 两处诚实登记(都判「以代码为准」)**:①Item 2 的两处兜底是**防御性的**——`PhotosPersonDetail.vue:420` 那条分支在当前合并候选接线下**可证不可达**(候选对象按引用捕获、从不重查,且候选池恒非空名),照指令实现但如实标注「按设计无法测试」,**没有编造覆盖**;`PhotosPeople.vue:332` 那处真可测,有真回归测试 + 变异验证 ②Item 3:Vue2 对 index 类型任务的定时器排除**比 brief 描述的更微妙**(index 只在一个重排边界情形下跳过定时器,不是整类排除);New-UI 刻意把 index 整个留给既有的 idle-poll 机制,避免第二个真相源,已在代码里登记
- 任务评审(sonnet)判 **Approved**,零 Critical 零 Important。评审独立追踪验证的项:**5 个 `isConflict` 调用点全是「先看 `response.status === 409`、message 正则只是次级兜底」⇒ 收紧到 `/\b409\b/` 几乎无漏判真冲突的风险** · Item 2 的不可达论证成立(`mergeCandidates` 经 `namedOf` 过滤保证非空名,且 `patchPerson` 用 `splice(i,1,{...})` 换新对象从不原地改 ⇒ 被捕获的 `target.name` 不可能变空)⇒ 「按设计不可测」是诚实且正确的判断而非托词 · **Vue2 读法核实无误**:`photos.js:1388-1402` 里 index **不是**整类排除定时器,只有 reorder 情形(`type==='index' && tasks.some(t=>t.type==='face')`)短路成立即移除;New-UI 让 index 完全留在 `fetchIndexStatus` 的 5 秒 idle 轮询上,用户可见时序不变且不生第二真相源 · `taskDoneCoalescer.ts` 只按 `task.type` 缓冲去抖、**无按 id 的「已播报」概念** ⇒ 新增的 `announcedTaskIds` Set 不重复它 · item 4 三处 diff 是纯注释插入,周围代码逐字节未变 · 计时用例断言 4999ms 仍在 / 5001ms 已移除,符合本区惯例
- `Task 10: minor (deferred): announcedTaskIds 只在后续 running 事件时清 id,一个走完 done 且再不复用的 id 会留到组件卸载`(组件级非模块级、单会话任务数小,实际有界)
- `Task 10: complete (commits 1fed2bc..da90689, review clean)`

## 全量门(整支终审前)

- 首次全量(10 个编码任务全完成后):**459 文件 / 5893 passed,但 1 failed**(基线是 453/5739 零失败)⇒ **本期引入了 1 个失败**
- **失败根因(全量门的价值实证)**:`src/components/AppToast.zIndex.test.ts` 的全仓 z-index 守卫报 `src/views/PhotosSettings.vue: z-index 1100 (toast = 1100)` —— T5 给页内 `.ps-toast` 用了 **与全局 toast 同层的 1100**,违反 `docs/THEMING.md §8` 的硬约束(「新增浮层时**不要**在 1100 及以上落座」;遮罩都带 `backdrop-filter`,同层或更高会让全局 toast **完全读不到**)
- **为什么前面谁都没抓到**:该守卫在 `src/components/` 下,**不在任何任务的局部测试范围内**;T5 自己那次 843/843 across 7 files 是真绿。这正是「全量只在收尾跑一次」策略的已知代价与收尾门存在的理由
- **控制器裁定:保留页内 toast、只降层级。** 查实全局 `useToast()` 是 `show(text, duration, action)`、`ToastItem` **无 icon 字段**、`AppToast.vue` 零 icon 引用 ⇒ 改用全局 toast 会**丢掉图标**,而 Vue2 `showToast(icon, text)` 是带图标的、T3/T4 的 emit 契约就是 `{icon, text}` ⇒ 那是 1:1 保真损失,不采纳
- `Task 5: fix round 2/5` — 派出:`.ps-toast` 降到 §8 阶梯内(建议 150「局部固定条」,须先核实设置页内无更高层浮层会压住它)+ 改掉那条把 1100 正当化的注释(它引的是**全局** toast 的理由,会诱使后来人再抬回去)+ 在本任务测试文件内加一条本地守卫(读 style 块断言严格低于 1100,失败更快)+ 双向变异验证(改回 1100 确认本地守卫与全仓守卫都变红)

## 整支终审(opus)结论:With fixes

判词:「Vue2 保真、i18n、主题、hover 特异性、z-index 与测试严谨性在独立复推下全部站得住 —— 没找到任何会让设置页或五式深链产出错误结果的缺陷」。2 Important + 10 Minor + 2 条 plan 问题。

### ⚠️ 终审推翻了控制器 ledger 里的一条建议(必须更正)

**`--accent` 那条不是缺陷,应按「不改」关闭。** 我此前登记「两卡的 AI 图标用了蓝色的 `--accent`,而 Vue2 字面量是紫 `#6E5BFF`,建议终审修复波换 `--accent2`」——**错了**。终审回源查到 Vue2 `src/views/Photos/photos.scss:16` **就把 `--accent` 定义成 `#6E5BFF`**、`--accent-soft` 定义成 `rgba(110,91,255,0.18)`(整个相册区的 accent),那个字面量之所以内联只因为 `PhotosIcon` 把 color 绑到 SVG 属性上(Vue2 自己在 `:42` 注释说明了)。⇒ **映射到 New-UI 的 `--accent`/`--accent-soft` 才是语义正确的移植;换成 `--accent2` 反而是偏离**(会让这两处成为一个整体蓝调区域里唯一的紫,还得新增 `--accent2-soft` 才不至于紫底压蓝调)。**此条已按终审证据关闭,不改代码。**

### 终审的 2 Important(进修复波)

1. **`src/views/PhotosAlbums.vue:71`/`:224` —— `albums.loadError` 的第三个消费方仍带着 T9 要消除的同一缺陷。** `isEmpty = albumsLoaded && length === 0`,失败时 `albumsLoaded` 留假 ⇒ `isEmpty` 假 ⇒ 落到网格,用户只看到区段标题 + 「新建相册」磁贴,无报错无重试。**同一个 store 的 `loadError` 就在那儿没用。** T9 修了相册**详情**却漏了相册**列表** ⇒ 列表吞错、详情报错,自相矛盾
2. **`usePhotosDeepLinks.ts:13-17` 的执行顺序注释不准确,且把「偏离」登记成了「保真」。** 注释说必须 await 灯箱那条腿否则「顺序在真实时序上颠倒」—— 但 Vue2(`PhotosTimeline.vue:369-379`)是**不 await** 的,所以 Vue2 里 `q`/`person` 那条腿**真的先跑**。New-UI 的 await 是刻意的行为改变。**不准确的登记比没有登记更坏**(下一个维护者会采信它)

### 终审 triage 的 deferred 清单(逐条见其报告)

绝大多数「stays deferred」,其中几条给了新证据:`retentionDays` 双缓存**无用户可见漂移**(`PhotosTrash.vue:199` 每次挂载都重取,且不可能同时在两页)· 两条 store 级 retry 用例是冗余而非承重(view 那对经独立追踪确实钉住了「retry 静默 no-op」)· `announcedTaskIds` 的换法是**净改进**(旧的基于 `store.tasks` 的判据会在 5 秒 idle 轮询先于总线事件观察到 done 时**压掉唯一一次播报**)

### 终审修复波 + 一次 scoped 复审

- **修复波过程有一次 subagent 崩溃**:第一个 agent 做完 Item 1(`PhotosAlbums.vue` + 测试)后**输出损坏(乱码)、未提交、未写报告**。控制器查工作树发现改动完好(17/17 通过、5 条新用例含「reject→retry→reject 在途持续可见」那条),**未跑任何 checkout**,派第二个 agent 继承未提交工作 + 完成 Item 2-7 + 一起提交
- 修复波坐标 **`3c8c0e7`**,7 项全落:①`PhotosAlbums.vue` 补失败态(第三个 `loadError` 消费方)②深链执行顺序注释改准确 ③深链文件头列出 Vue2 的 6 个已做 / 7 个刻意出局 query 键 ④删死键 `photosSettingsSubtitle` ⑤补 Vue2 的 error 任务 10 秒过期(复用既有 `_doneRemovalTimers`,不建第二个定时器表)⑥去掉 `role="switch"`(Vue2 是裸 div)+ a11y 债务登记 ⑦单位不一致加注释说明是决定而非疏漏
- 门:**459 文件 / 5900 passed 零失败** + `vue-tsc` exit 0
- **implementer 诚实报告「Item 1 的变异验证不成立」**:交换 `loadError`/`isEmpty` 分支顺序没让任何用例变红
- **复审对这条做了第三层纠正(精彩)**:该论证**只在首次成功加载之前成立**。`albums.ts:69-79` 的 catch 置 `loadError=true` 但**从不把 `albumsLoaded` 退回假** ⇒ 一旦有过一次成功(哪怕是确认为空)加载,后续 refetch 失败(可经 `onPickerAdded()` 或 `createAlbum` 内部 refetch 到达)会**同时**有 `albumsLoaded=true` + `loadError=true` + `length===0`,**此时分支顺序真的承重**。当前顺序(失败态在前)恰好是对的 ⇒ **无 live 缺陷**,但论证比事实宽,且该交错路径 5 条新用例都没覆盖(全是首次加载失败)

### 控制器对 2 条 residual 的裁定(无第二轮修复波)

1. `residual: Item 1 的「两分支互斥」论证过宽 + 「有过成功加载后 refetch 失败」路径无测试` — **park with ruling:代码在该状态下正确,非阻塞、不承重**(不挡后续任务、不揭示 plan 缺陷)。**但要求两件事**:①台账在此如实记下论证的边界,不采信「结构性冗余」这个过宽说法 ②该交错路径进后续债务清单(补一条 post-success-refetch-failure 用例)
2. `residual: PhotosAiCard 的 switch div 保留了 aria-checked/aria-label 却已无 role` — 技术上是无效 ARIA(这两个属性只在配套 role 上有意义),但**非回归**(Vue2 那个裸 div 连这两个属性都没有,多数 AT 会忽略无 role 的 aria-checked)。**park with ruling:留待 a11y 专项**,与 Item 6 已登记的「设置页整体键盘可达性是独立工作」同一票

## T11 收尾完成

- 全量四道门(修复波后复跑):**459 文件 / 5900 passed 零失败** · `vue-tsc --noEmit` exit 0 · color-guard & i18n parity 绿。剩 1 个 error 是 master 既有的 SP9 侧 `SettingsPage.test.ts` 的 `avatarPath` mock 缺口
- spec 四处订正 + 新增 §1e(D19-D23 + D21 三条连带后果),roadmap 三处回填,plan 订正三处被查实的错误 —— 文档仓 `NimoOS-UI` 分支 `docs/vue3-migration-sp3`@**`a5ec2aac`**(仅 3 个 docs 文件,零 src 改动)
- **最终坐标**:New-UI `sp7-photos`@**`3c8c0e7`** · Service `sp7-photos`@**`a0cf09a`**(零后端改动)· 文档@**`a5ec2aac`**
- **未合并 master、未部署**。验收走 dev `:5277`
- `Task 11: complete`

## 本期方法论教训(供后续期直接用)

1. **计划书的测试脚手架不可信,产品代码的回源坐标可信。** 9 处错误里 8 处在测试脚手架;Vue2 行号/档位/阈值/文案/色值零错
2. **控制器的独立复核也会错。** 「isConflict 只有 1 处」是 grep 加了 `| head -10` 把截断输出当全量。**核查计数时不得加 head**
3. **控制器的产品行为裁定同样要过复核。** 「每次尝试前清 loadError」是我定的,评审推出它会让重试在途短暂复现 P3 症状
4. **「全量只在收尾跑一次」的代价真实。** 唯一一个局部测试不可能发现的缺陷(z-index 撞 toast)只有全量门能抓 —— 提速策略保留,**收尾门不可省**
5. **诚实报告是地基且在起作用**:一次虚报被评审 grep 逮到;两次 implementer 自查自纠主动上报;一次复审对 implementer 的诚实报告做了第三层纠正
6. **subagent 会崩。** 修复波第一个 agent 输出损坏未提交就没了 —— 因为**没人跑 checkout**,工作完好留在工作树被第二个 agent 继承。这条纪律本期救回过两次工作

## 真机验收轮 1(2026-08-04,用户在 :5277)—— 3 条反馈

### ① 五式深链全不生效(真缺陷,已修)

- **用户操作方式**:在**已打开的 `/photos`** 上改地址栏(`#/photos?q=%E7%8C%AB` / `?asset=deadbeef` / `?person=bb3bdf60-...`),三条都毫无反应
- **根因 = 控制器裁定错误(第二次同类)**:深链只写在 `onMounted`,而 vue-router 4 对「同路由只改 query」**不 remount** ⇒ 那段代码根本不跑。T7/T8 的 19 条用例全是 fresh mount 所以全绿、抓不到。**我在 T5 的 `?section=` 上踩过一模一样的坑并让它加了 watch,却在 T7 的 ruling 7 明确禁止 watcher,原话「改地址栏就是一次全新挂载」是错的。ruling 7 已撤回**
- **修法(`47a6cc2`)**:抽 `applyDeepLinkChanges(query, previous)` / `dispatchQueryChange`,`onMounted` 与 `watch` 共用同一段;**watch 的是五个键各自的 getter 而非整个 `route.query` 对象**(无关键变化不触发回调),回调内再逐键比对 —— 两层守卫。**一次性 handoff 语义保住**:有专门用例证明「`?photoset` 已消费后,编辑无关的 `?q` 不会让它重跑降级路径」(灯箱内容与 `getAsset` 调用次数都不变)
- 门:composable **27/27**(19 fresh + 8 query-only)· 全量 **459 文件 / 5908 passed 零失败** · tsc 0。变异验证:删 watch → 8 条 query-only 里 7 条变红(第 8 条「删键是 no-op」平凡通过,implementer 如实说明),19 条 fresh-mount 全程保持绿

### ② 时间线页侧栏跟着照片一起滚(既有缺陷,P1 根因,待用户拍板处置)

- 用户原话:「左侧底部齿轮在照片多时位于最下面需要一直往下滚动鼠标才能看到,左侧不要拉伸,上下滚动应该在只滚动照片部分」
- **查实**:时间线页 `Photos.vue` **没有内层滚动容器** —— 相册页有 `.albums-scroll`(`:413`)、设置页有 `.ps-scroll`(`:174`),都是内容自己滚、侧栏不动;只有时间线页照片网格直接撑高 `.photos-main`,由 `AreaShell` 的 `.area-body { overflow: auto }`(`:32`)整体滚 ⇒ 侧栏被带着走
- **定性:P1 建时间线时的既有缺陷,非本期引入** —— 但本期把齿轮放到侧栏底部,把它从「无所谓」变成「照片越多齿轮越点不到」,正好卡在验收第一条
- **风险(已向用户申明)**:改滚动容器要动 P1 的布局,而时间线有**月份 scrubber** 与照片懒加载,可能监听「谁在滚」⇒ 有弄坏这两者的风险。已给用户两个选项:(a) 对齐另两页的做法改内层滚动 + 改完专门复验 scrubber 与自动加载 (b) 先只把齿轮挪到侧栏顶部(改动极小、立刻可验收)。**待拍板**

### ③ `asset=deadbeef` 未弹「未找到照片」 —— 同 ① 根因,已随之修复

### 用户问「相册/照片 id 怎么获得」—— 已答

相册/人物 id:点开后地址栏即 `/photos/albums/<id>`、`/photos/people/<id>`。照片 id:灯箱不写地址栏,但缩略图 `<img src>` 是 `/v1/photos/assets/<id>/thumbnail?size=…`,右键检查即可读出;或控制台 `fetch('/v1/photos/assets?limit=3', {headers:{Authorization: localStorage.getItem('access_token')}})`

## 真机验收轮 2(2026-08-04)+ 本期关账

### 用户裁定

- **深链(五式)与本期其余内容:用户已验收通过。** 原话「我已经验收过深链和其他这一部分的内容了」
- **新反馈(轮 2)**:「右边时间线是坏的根本没法点击跳转,而且时间不是按照拍照时间分布的」
- **处置:轮 1 的 ② + 轮 2 这两条,用户决定另开窗口修**,不进 P8a。P8a 就此收尾

### 控制器对轮 2 的取证(交接给下一个窗口,已落盘)

交接文档:`NimoOS-UI/docs/superpowers/2026-08-04-sp7-timeline-scroll-scrubber-handoff.md`

- **轮 1 的 ②(侧栏跟着滚)与轮 2 的「刻度尺点不动」是同一个根因** —— 一处高度链断裂:`AreaShell.vue:32` 的 `.area-body{overflow:auto}` 才是真滚动元素,而 `Photos.vue:261` 的 `.photos-layout{min-height:100%}` 只有下限没有上限 ⇒ `.photos-grid-root{height:100%}`(`PhotosGrid.vue:360`)解析不出约束 ⇒ `.photos-wrap`(`:361`)**永不溢出、永不滚**。连带三条:侧栏被整页滚带走 · `onScroll`(`:131`)永不触发 ⇒ `activeIdx=-1` ⇒ thumb(`:351`)根本不渲染 · `jumpTo`(`:124`)对一个不滚动的盒子调 `scrollTo` = 毫无反应
- **`@click` 其实一直在**(`PhotosGrid.vue:349`,与 Vue2 `:94` 一致),不是漏了事件绑定;年份(major)刻度按 Vue2 设计本就不可点
- **定性:P1 的移植偏离**,Vue2 侧 `photos.scss:109/117/127` 是 `.photos-root{height:100vh;overflow:hidden;flex-column}` + `:300` 内层 `.photos-wrap{overflow-y:auto}`,所以 Vue2 侧栏不动、scrubber 能用。同仓正确范例:`PhotosAlbums.vue:413`、`PhotosSettings.vue:174` —— **时间线页是唯一没做内层滚动的相册子页**
- **「时间不是按拍照时间分布」拆成两种读法**(交接文档要求动手前先跟用户分清):(A) 刻度间距每月固定 55px、不反映密度 —— **与 Vue2 逐行一致**(Vue2 `:148` `tickStep:55`、`:238` 同公式),属产品改进不是迁移偏离;且**根因未修时 thumb 根本不渲染**,用户看到的「不动的一列月份」很可能就是它 (B) 月份分组用错时间戳 —— New-UI **完全不参与分组**(`timeline.ts:73` 原样映射后端 `/v1/photos/timeline` 的 `year/month`,`assetToPhoto.ts:409`),那就是 Photos 后端票,验证法是同设备对比 Vue2 `/#/photos`
- **风险交接**:`onScroll`/`jumpTo`/`ensureActiveVisible` 与 lazy img 都挂在 `wrapRef` 上,挪滚动容器后必须真机复验「拖月份刻度尺」+「往下滚自动加载」;**jsdom 不做布局,这个缺陷类别单测抓不到**(5908 例全绿也没抓到)

### 最终门(收尾复跑,2026-08-04)

- **459 文件 / 5908 passed,零失败** · `vue-tsc --noEmit` **exit 0**
- vitest **进程退出码是 1**,原因只有一个 unhandled rejection:`service.users.avatarPath is not a function`,来自 **SP9 侧** `src/settings/views/SettingsPage.test.ts` 的 mock 缺口(`AccountPanel.vue:43`)。**非相册代码、非本期引入**;查实 **master 已在 `721117f` 修掉**(该提交晚于本期的 master 合并点)⇒ 本分支下次 `merge master` 或合回 master 时自动消失,**本期不 cherry-pick**(避免在相册分支上动 SP9 文件)
- 控制器自查教训:第一次跑 tsc 用了 `-p tsconfig.app.json`(**本仓不存在该文件**)得到 exit 1,是**我的命令错**不是类型错;正确写法 `pnpm vue-tsc --noEmit`

### 关账坐标

- New-UI `sp7-photos`@**`47a6cc2`** · Service `sp7-photos`@**`a0cf09a`**(本期零后端/零共享包改动)· 文档 `NimoOS-UI` `docs/vue3-migration-sp3`@(见 roadmap 回填提交)
- **未合并 master、未部署**(快照发布前的硬约束)。dev `:5277` 仍在跑
- **台账按开工约束保留,不删**
