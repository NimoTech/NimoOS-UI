# SDD ledger — plan: /home/nimo/NimoTech/NimoOS-UI/docs/superpowers/plans/2026-08-06-vue3-migration-sp8-p6-cutover.md

SP8-P6:AI 区 cutover + 合流两仓 + 开源面扩张。11 刀(T0–T10)。

**三个工作区**(本期不开 worktree —— 合流的落点按定义就是各仓 master):
- NEW-UI `/home/nimo/NimoTech/NimoOS-New-UI` @ `master`
- SERVICE `/home/nimo/NimoTech/NimoOS-Service` @ `master`
- VUE2 `/home/nimo/NimoTech/NimoOS-UI` @ `docs/vue3-migration-sp3`

---

Task 0: complete (commits 91337f1..486a7a5, review clean —— Spec ✅ / Approved)
Task 0: minor (deferred): 计划 Step 3 的命令块自身漏了 `--reporter=verbose`,与全局约束打架;实现者逐字照抄 brief。后续刀 dispatch 时补上,本刀不重跑。
Task 0: 🔴 发现(改变后续刀): oss 门在 master 上**本来就是红的** —— `NimoOS-Service/.superpowers/sdd/2026-07-23-vue3-migration-sp7-p0-photos-domain/`(SP7 台账)被提交进 Service 仓,导出脚本 `git archive HEAD` 把它带进产物树 `packages/service/.superpowers/`,泄漏守卫扫到「相册/photo/搜索/智能」。New-UI 侧 `.superpowers` 早在 DELETE 里,Service 侧漏了。**修法 = SERVICE_DELETE 加 `.superpowers`,并进 T8**。基线红 = oss/tree.test.mjs 2 例。
Task 0: 🔴 发现(改变后续刀): NEW-UI 工作树有 3 个 design-export staged 删除,会挡住 T3 的 `git merge`(git 要求索引干净)。配方 = restore → merge → git rm,结束回到与现在相同的状态。**写进 T3 dispatch**。
Task 0: 实测基线(后续刀按文件名比对,不按数字):
  - SERVICE 33 文件 / 267 例,零失败
  - NEW-UI 476 文件 / 6251 例,2 失败(均在 `oss/tree.test.mjs`,即上面那条既有红)
  - VUE2 158 文件 / 1479 例,8 失败(`tests/nimoTaskBar.test.js` + `tests/settingsStore.test.js`)
  - 冲突面实测:NEW-UI **14** 个(spec 记 15,以 14 为准)· SERVICE **2** 个
Task 1: complete (VUE2 79de66a3..12723358 + NEW-UI 486a7a5..b4723bd, review clean —— Spec ✅ / Approved)
Task 1: 🔴 结论(T5/T6 依赖此项): **REDIRECT_BEFORE_GUARD = true** —— beforeEach 只见到 redirect 解析后的 `/ai/settings?section=skills`,裸 `/ai/skills` 一次都没出现。
  ⇒ **T5 不需要**给 New-UI 补 `/ai/skills`、`/ai/mcp` 两条 redirect 路由(计划 T5 Step 6 跳过,并在报告里写明跳过理由)。
  证据三层:实现者实证 + 评审强制打印 `seen=['/ai/settings?section=skills']` + 变异验证(改 section 值断言应声报红)。
  另:评审读了 node_modules 里的 vue-router 3.6.5 源码 —— redirect 解析在 `router.match()`、guard 在 `confirmTransition()`,两者都在三种 mode 共用的 History 基类里 ⇒ `mode:'abstract'` 对 hash 模式完全有代表性。
Task 2: complete (SERVICE 2dcae71..ac39cd7 + NEW-UI 3942b47, review clean —— Spec ✅ / Approved)
Task 2: 证据 —— index.ts 是两侧严格超集(getter 24 = master 21 ∪ sp8 19 的并;导出符号 95 = 74∪55,三个差集全空);disks.test.ts 用例 5 = 3∪3(umountUsb 重叠);测试 37 文件/377 例/0 失败(基线 33/267/0,+110 = ai 65 + notes 20 + sse 10 + wiki 13 + disks 净增 2);dist/{index,ai,notes,sse,wiki}.js 时间戳新鲜。
Task 2: minor(已当场修): SDD 的 review-package 脚本会把 `<repo>/.superpowers/sdd/.gitignore` 覆写成裸 `*`,而 Service 仓那份原本写着台账入库规则(2026-08-05 才从裸 `*` 改过来,正是 SP7 丢台账的同源问题)。已 `git checkout --` 还原。**每次跑 review-package 之后都要复查这个文件。**
Task 3: 合并完成 (NEW-UI 3942b47..261bebd 合并 + 9c57f73 报告),评审 Spec ✅,2 Important + 3 Minor 进修复轮。
Task 3: 🔴 评审独立复证(与实现者不同口径,运行时 Object.keys 集合运算): i18n 切分**无损** —— zh/en 各 master出口1459 ∪ sp8出口1727 = 合并2666 = base757+photos702+ai1207;丢失 master 键 0、丢失 sp8 键 0、凭空多出 0、值被改 0(两个方向都验了);ai 分片与 base/photos/sp9 三向交集全 0;真实装配路径(index.ts 并入 sp9)取值验过,含带点号的 `'ai.searchMyNas'` 引号键。
Task 3: 🔴 **计划缺陷(我写的)**: brief 的 i18n 取数正则 `/\*[\s\S]*?\*\//g` 被文案 `'例如 /DATA/private/**'` 骗开假注释,吃掉 1726 键中的 788 —— 正是我自己在全局约束里引用的 P5f R26-3。真值 sp8 独有 **1207**(非 418)。**T4 沿用修正版扫描器,不许用 brief 原脚本。**
Task 3: 🔴 **计划缺陷(我写的)**: 依赖是 **7 个**不是 4 个 —— 漏 `dompurify`/`@types/dompurify`/**`sass`**(缺 sass 则 AI 区 .scss 构建不了)。已并入,版本实测 2.27.2 / 0.8.10。
Task 3: 🔴 **计划缺陷(我写的)**: master i18n 是 **4 片**不是 2 片 —— `zh_cn.sp9.ts` 走 `src/i18n/index.ts` 另一条装配路径,不在 `zh_cn.ts` 出口里。ai 已挂对出口。
Task 3: toast 第三参是真语义冲突(sp8 传字符串 tier / master 传对象 action),解法=判别联合 `typeof === 'string'`;评审做了变异验证(判别反写 → 7 条红,含新加的双向用例两条)⇒ 用例有判别力;两侧调用点 diff 零 `-` 行 ⇒ 一处未改写。z-index 1100→10100 成立(AI 灯箱坐 10000,master 侧无物需压 toast 之上)。
Task 3: fix round 1/5 (5 addressed, 0 open —— Imp1 报告根因订正 / Imp2 端口 5288→5273 / Min3 THEMING §8 z-index 表 / Min4 守卫补样式表 / Min5 计数订正; commits 9c57f73..7ea85a7)
Task 3: complete (commits 3942b47..7ea85a7, review clean)
Task 3: 🔴 **交 T7 的债(T3 自己打断的)**: 改 i18n 出口打断了 `oss/manifest.mjs` 已有的 4 条锚点 —— `:1048` zh_cn 结构 / `:1051` en_us 结构 / `:1056` zh_cn 头注释整段 / `:1072` en_us 头注释。出口现在是 4 行。T7 要重写这 4 条,不只是「加一行 DELETE」。
Task 3: 🔴 **取证陷阱(写进 T7/T8 的 brief)**: `oss/export.mjs` 的「工作树不干净」守卫跑在锚点检查**之前**并 abort ⇒ 会短路掉真失败,而且是**逐个仓库**挡。取证前必须先让 NEW-UI 与 SERVICE 两个工作树都干净。「同样的报错文字 ⇒ 同样的根因」不成立(合流前后文字相同但根因已换)。
Task 3: 🔴 **新债务(全仓性,本轮只修了一道门)**: `?raw` 在 vitest 里对 css/scss **恒空**(CSSEnablerPlugin 整体替换成空串、不看查询串)。`AppToast.zIndex.test.ts` 的 `.css` glob 因此**一直是空壳**,5 个独立 .css(含 theme.css)从未被扫过。已改成 `.vue` 走 glob、`.css`/`.scss` 走 `node:fs` + 一条「取数有效」断言(复评验过它有判别力)。**其它用 `import.meta.glob(...'?raw')` 读样式表的守卫可能同样在空转,建议后续排查**(与记忆里 P5d 的同款教训对上)。
Task 3: 环境整理(协调者做的): SDD 脚本会往各仓写 `.superpowers/sdd/<plan>/` 草稿并把该目录的 `.gitignore` 覆写成裸 `*`。已把 Service 仓那份归拢进 VUE2 的 workspace 并还原 .gitignore —— **导出脚本要求 Service 工作树干净,T7/T8 之前必须保持**。
Task 4: 编码完成 (7ea85a7..1c0c4aa),评审 Spec ✅ / Approved,1 重要注释项 + 1 表述项 进修复轮 1。
Task 4: 证据 —— 评审做了 4 轮变异(每条断言单独验)+ 1 轮 sp9×ai 定向撞车。四片现测 757/702/1207/459 = 3125,zh/en 对称。
Task 4: 🔴 **我给的 RED 判据是错的**(第二次了,P5f 也栽过同款):我以为「删一个键」能让「无损划分」报红,实测恒绿 —— 真分片下 `sum == union` 是集合论恒等式,两边同步减 1。实现没错,是判据错。**教训:RED 判据只是提示,实测不成立时以「能真报红」为准。**
Task 4: 🔴 关键实证 —— 往 `zh_cn.sp9.ts` 插一个与 `zh_cn.ai.ts` 重名的键:`shardDisjoint.test.ts` 报红,而 `photosSlice.test.ts` 12 条断言**全绿、完全失明**。这就是新守卫读真实装配路径(`index.ts` 的 createI18n)而非只读 `zh_cn.ts` 出口的全部理由。
Task 4: minor(已并进修复轮): 六对不相交里 base×photos / base×ai / photos×ai 三对与 photosSlice.test.ts 逐字重复,只有带 sp9 的三对是净新增(良性冗余,只订正报告表述)。
Task 4: fix round 1/5 (2 addressed, 0 open —— 判别力边界注释 + 报告措辞; commits 1c0c4aa..586f672)
Task 4: complete (commits 7ea85a7..586f672, review clean)
Task 5: complete (commits 586f672..c547c9d, review clean —— Spec ✅ / Approved)
Task 5: 证据 —— 评审把三处 `cutoverDisabled('/ai')` 判别反写,7 条新用例**全部转红**(含那 3 条「改代码前就绿」的 flag=1 用例)⇒ 判别力真实,不是巧合空壳。另用真实 `createWebHashHistory` 探了 `发票 & 收据 #1 100%`:`#`→`%23`、`%`→`%25`,两条路径都正确转义、**无截断**;唯一差异是空格(`+` vs `%20`),query 语境下等价。
Task 5: Step 6 按 T1 结论跳过(`src/router/` 零改动,已核 `git diff` 为空)。
Task 5: 范围外改动 1 处已裁定合理 —— `AiWidget.test.ts` 端到端走了 `sendToAI` 真实路径,是行为变更的直接回归;拆成两条(默认态断言 router.push / flag=1 态断言 location.href),评审做变异验证确认两条各自有判别力。
Task 5: minor (deferred): `cutoverDisabled` 上方那句「/ai 同理一把键管两侧(Vue2 侧在 migratedRoutes)」在本刀落地时**尚不为真** —— Vue2 的 migratedRoutes 当时只有 5 条、没有 /ai。**T6 落地后回来确认这句话成立。**
Task 5: 🔴 交 T7 的锚点(两组,不是一组): ① i18n 四条(T3 打断) ② `useOpenAction.ts` 的 SYS_ROUTE 整块(T5 打断)。T5 报告与评审结论里都贴了最终文本原文,T7 拿去当新锚点。
Task 6: complete (VUE2 12723358..749e4aae + NEW-UI f1c659f, review clean —— Spec ✅ / Approved)
Task 6: 证据 —— 评审逐条验了 13 条 Vue2 /ai 路径的落点(含两条 redirect 解析后的 `?section=`),全部正确;两次变异(改 `to` → 红 / 删 `prefix` → 红)证明用例有判别力;边界 `/aircraft`、`/ai-foo`、`/aid` 全不命中;既有五条落点未变;Vue2 全量 159 文件/1485 例,失败集合 `{nimoTaskBar, settingsStore}` 与基线**逐字一致、零新增**(+1 文件/+6 例来自 T1 的 aiRedirectTiming + 本刀 5 条)。
Task 6: T5 挂账已解除 —— `useOpenAction.ts` 那句「Vue2 侧在 migratedRoutes」现在成立,两侧 flag 键字面一致(`strangler:disabled:/ai`)。
Task 6: minor (deferred): `strangler.js:28` 注释写「Vue2 侧有 8 条 /ai/* 路由」,实测是 **11 条真实路由 + 2 条 redirect = 13 条记录**。数字来自我的计划原文,纯文档错误,不影响功能(前缀匹配结构性穷尽,覆盖面已独立验证)。**留给终审修复波顺手改。**

--- 两侧 cutover 代码完成 (T5 New-UI 三触点 + T6 Vue2 strangler),下面进开源导出面 ---
Task 7: 编码完成 (f1c659f..7e9499b),评审 Spec ✅,2 Important + 2 Minor 进修复轮 1。DELETE 67→72,PATCH 221→245。
Task 7: 证据 —— 放水检查全项通过(privateSha256 零改动、forbidden.mjs 一字未改、18 行删除逐行核过无一撤守卫、只动 1 处阈值且是钉紧);漏删扫描三轮口径零「第三种情况」;产物树 vue-tsc exit 0;泄漏抽查**真泄漏 0 处**;977 命中前缀分组 = 100% `packages/service/`(唯一 New-UI 命中是二进制跳过哨兵 settings.png)。
Task 7: 实测纠正我的预告 —— 断掉的锚点是 **7 条**不是 5 条:i18n 实断 **3** 条(第 4 条没断但 T3 在其下加了点名 en_us.ai.ts 的一行,锚点须从 1 行扩到 2 行)· `useOpenAction.ts` 实断 **4** 条(T5 还改了 cutoverDisabled 注释、openApp if 链、openItem+sendToAI)。
Task 7: theme.css 复核结论成立 —— `--toast-warn-*`/`--toast-danger-*` 消费方是保留下来的 AppToast.vue 自己的 `[data-tier]` 规则,非 AI 专用,一行不用改;AI token 全在 `src/ai/styles/tokens.scss` 随域走。
Task 7: 产物树实跑抓到一条 vue-tsc 抓不到的真失败 —— `AppToast.zIndex.test.ts` 取数阈值 `> 5` 按私有仓 14 个样式表定,而 9 个 .scss **全部**在 src/ai/styles/ 下 ⇒ 产物树只剩 5 个,`expect(5).toBeGreaterThan(5)` 必红。改 `> 4`。
Task 7: minor (deferred, 既有 D47): 内部期号仍进公开面 —— 产物树 `src/**` 有 59 处 `SP\d`(公开仓 HEAD 现有 37)、`Vue2` 1148 处,都不在词表、属既有惯例。本次合流把 37 推到 59。**归 D47 待机主拍板。**
Task 7: ⚠️ 覆盖缺口(交 T8): 产物树**至今没人跑过 `pnpm build`(vite 真构建)** —— `tree.test.mjs` 的「产物树能构建」门因 Service 泄漏 abort 而没走到。摘了 6 个依赖后「vite 真能打出包」目前零验证。T8 清干净泄漏后**必须补跑**。
Task 7: fix round 1/5 (4 addressed, 0 open; commits 7e9499b..3ebeaf3) —— Imp1 守卫改 7 条 PATCH 恢复 / Imp2+Min3 lockfile 走 export.mjs 步骤 4.5 重算 / Min4 措辞。
Task 7: complete (commits f1c659f..3ebeaf3, review clean)。终值 DELETE **71** / REPLACE 4 / PATCH **252**,全部恰好命中 1 次。
Task 7: 🔴 偏离已裁定接受 —— 用 7 条 PATCH 代替评审建议的 `REPLACE`+哈希钉。理由经复评独立验证:冻结分身必须含裸 `import zhSp9 from '../zh_cn.sp9'`,而 `tree.test.mjs` 期号守卫的 `(?!\.ts)` 豁免只认带扩展名的引用,该行实测命中;复评还自查了第三条逃生路(写成 `'../zh_cn.sp9.ts'`)—— 被 tsconfig `moduleResolution: Bundler` 且无 `allowImportingTsExtensions` 堵死(TS5097)。⇒ 无干净的 REPLACE 路径。PATCH 反而更好:未触及区自动继承私有侧后续改进,冻结分身只能靠哈希钉抓字节漂移、逻辑腐烂无声。
Task 7: 🔴 关键实证(复评自选键 `filesColSize` 重做,未复用实现者的) —— 变异 B′「**只**往 `en_us.sp9.ts` 插撞车键」:两片版守卫**报红**,而 `parity.test.ts` **5/5 全绿**。这就是「en 侧撞车零守卫」那个盲区的直接复现。变异 A(zh 侧撞车)守卫也红。
Task 7: lockfile 修法 = `export.mjs` 步骤 4.5 重算(放在泄漏守卫之前,失败抛出不吞)。复评实测:`CI=true pnpm install --frozen-lockfile` → Done in 649ms exit 0;lockfile tiptap/dompurify 153→**0**;`--offline` 跑通(零下载);两次跑出**字节相同**的 lockfile;私有↔产物 diff = **114 删 / 0 增 / 零版本变动**。
Task 7: 产物树 `pnpm build` **exit 0**(`✓ built in 11.93s`),vue-tsc 0,vitest **375 文件 / 3689 例全通过**。
Task 7: minor (deferred, 交 T8/发布前): ① `--prefer-offline` 不是 `--offline` —— 今天全靠缓存命中,一旦清单**新增/改指**依赖,`--no-frozen-lockfile` 会从 registry 现解,公开仓可能钉上私有侧从未构建过的版本;收紧成 `--offline` 或断言 lockfile diff 只减不增可让它响一声。② 导出依赖 PATH 上的 pnpm,两侧 package.json 都无 `packageManager` 字段,换个 pnpm 大版本会重排整份公开 lockfile。③ `packages/service/pnpm-lock.yaml` 是**第二份被跟踪的 lockfile**,步骤 4.5 不重算它 —— 今天无害(实测 frozen 安装 exit 0),但 T8 的 SERVICE_PATCH 若动到 Service 的 dependencies,同样的漂移会在那边重开且无守卫。
Task 8: 编码完成 (3ebeaf3..71191c5),评审 Spec ✅ / Approved 零 Critical,2 Important(守卫本身,非清单)进修复轮 1。
Task 8: SERVICE_DELETE +9(ai/notes/sse/wiki 各 .ts+.test.ts 共 8 + **Service 仓自己的 `.superpowers/`**);SERVICE_PATCH +13(index.ts 接线)。导出**一轮就过、零失败轮次**。
Task 8: 🔴 **「产物树能构建」那道门第一次真执行**(此前一直被泄漏 abort 挡住):oss 套件里实测 26884ms(非 skip)。两次独立变异都证明它有判别力且**穿透到 `packages/service` 的 TS 源码**(实现者塞 import → TS2307;评审自选塞 getter → TS2304 exit=2)。
Task 8: 四道门 **17 文件 / 427 例全绿**(评审自跑复核)。
Task 8: 评审的额外复证 —— 放水检查用结构性证据(diff **零删除行**、forbidden/export/tree 三文件零字节改动、哈希钉 4→4);漏删检查换**语义判据**(枚举产物树 51 个保留文件的全部 API 路径,无 /v1/ai、/v1/wiki、/v1/notes、/v1/search、/v1/parser、/v1/photos);全树静态 import 解析扫描 **0 条未解析**;扫**编译后的真实 bundle** 零命中;反向检查零悬空引用。
Task 8: 🔴 **我 brief 的又一处错误**(实现者按取证改对了):我写「`sse.ts` 全仓只有 `ai.ts` 用它」**不成立** —— `ai.ts` 只 import 了 axios;真实情况是 Service 仓内无人 import、消费端两个调用点都在已删的 `src/ai/**`。结论相同、根据不同。
Task 8: 🔴 评审新发现(构建门的真实半径,记进债务): 门是**可达性作用域**的 —— 只检查从 `src/**` 经 `index.ts` 能 import 到的文件。`packages/service/src/*.test.ts` 随 `files:['src']` **确实发布到开源仓**,却完全在检查范围外(探针:往 apps.test.ts 塞 `const __probe: number = "boom"` → vue-tsc exit=0,没抓到)。今天零泄漏、206 例全绿。
Task 8: T8-D3 挂账到发布前,**但必须连陷阱一起挂**: ① 门用 `--ignore-scripts`,而 `@vue-office/docx` 靠 postinstall 生成 `lib/index.js` ⇒ 照字面加 `vite build` 会得到**恒红的假门**(评审实测:--ignore-scripts 下 exit=1,允许脚本重装后 `✓ built in 11.73s` exit=0)。② `vue-tsc` 在 `lib/index.js` 不存在时**照样 exit=0**(只认 index.d.ts),门验证不了运行时入口。③ 可达性盲区(上一条)。
Task 8: 🔴 **发布前人工检查项**: `NimoOS-Web` 公开仓停在 `748aa8f`,但带着一处**未提交的 ` M README.md`**。真 push 时 `git add -A` 会把它带上公网,**推之前必须由人看一眼**。
Task 8: fix round 1/5 (2 addressed, 0 open; commits 71191c5..9e9ada6) —— D1 假注释改对(纯注释,零可执行代码变更,现测数字 New-UI 1718 / Service 32 经复评重跑核对) / D2 补目录存在性断言(纯新增,用例数 65→66,既有断言零改动)。
Task 8: 🔴 D2 变异验证两半都由复评独立重做: **Part A** 注入一份自写的、一个禁词都不含的台账 → `scanTree()` 整树命中 **0**、只扫注入目录 **0** ⇒ **词表守卫对它完全瞎**;**Part B** 注掉 SERVICE_DELETE 的 `.superpowers` → 新断言应声报红并点名「SERVICE_DELETE 表的 .superpowers 条目没生效」。⇒ 「靠词命中兜住」从**巧合**变成了**保证**。
Task 8: complete (commits 3ebeaf3..9e9ada6, review clean)。四道门 **17 文件 / 428 例全绿**,「产物树能构建」10707ms 真跑(`✓` 非 `↓`)。
Task 9: 编码完成 (VUE2 749e4aae..9b83c539 + NEW-UI 9e9ada6..52d23ad),评审 Spec ✅,1 Important + 1 Minor 进修复轮 1。
Task 9: 证据 —— `docs/vue3-pending/` **8 个文件全部 tracked、1611 行**(比原 1574 多,因 07-后端票汇总.md 被扩写);挂账落盘评审做了系统性对照(从 progress.md 摘全部 🔴/minor(deferred)/挂账 逐条 grep 落盘文件)**零漏项**;Step 4 可达性抽 3 个区间重跑全 exit=0,两个特例(5 行空模板 / 0 字节)核实属实;撤 worktree 核验门**完整跑过一遍、判据逐字匹配**。
Task 9: 🔴 **过程性断言被验伪(值得长期留痕)**: 实现者报告写「读了全部 179 行」,而 `FRONTEND_API_GUIDE.md` 实测 **333 行**(四种方法交叉验证);内容摘要只覆盖到第 3 节,**第 4-8 节(Socket.io/EventBus、Vuex、i18n、Home.vue 结构、9 条重构红线)全在 179 行之后、完全没提**。评审自己补读后半部分,确认「建议入库」结论不变 ⇒ 零实际损失。**教训:「我读了全部 X 行」这类断言必须能被独立复算,一次被验伪则同类断言全部打折。**
Task 9: minor: roadmap 里给 strangler 路由数的取数命令跑出 **9**,既不是 8 也不是 11/13(13 经评审独立复算是对的)。**「命令能跑」≠「输出支持结论」** —— 已要求全量自查其它取数命令。
Task 9: 🔴 **机主 2026-08-06 拍板:`NimoOS-UI/FRONTEND_API_GUIDE.md` 入库**(提交到 VUE2 仓 `docs/vue3-migration-sp3` 分支)。理由:它记的那几个坑(缺 Bearer 前缀、信封层数、401 刷新队列)正是本项目反复栽过的地方,SP10 删 Vue2 之前都是活的参考;不入库则一次 `git clean` 就没了。⇒ T9 修复轮回来后执行,或并进 T10。
Task 9: fix round 1/5 (2 addressed; VUE2 9b83c539..8ba172b7 + NEW-UI 52d23ad..3c6c7ff) —— 179→333 订正 + 补读第 4-8 节重新给建议 / 取数命令订正。
Task 9: 🔴 根因登记(可复用): 「读了全部 179 行」的成因 = 分两次 Read(1-60、61-180),第二次内容恰好在 179 行一个自然段落断点结束,**把「Read 窗口停在哪」当成了「文件结束在哪」**,且事前没跑 `wc -l` 定天花板。**防法:声称「读完整个文件」之前必须先 `wc -l` 取上界。**
Task 9: 🔴 自查又挖出 **4 个同类 bug**(不是「再核一遍」而是真找到): ① T8-D3 与 D47 的重生成命令指向 `NimoOS-Service/oss/export.mjs` —— **该路径不存在**,脚本在 `NimoOS-New-UI/oss/`;② 沿途发现 **`oss/export.mjs` 的 `DEFAULT_OUT` 默认直接写进真实 `NimoOS-Web` 路径、且默认提交** ⇒ 台账里的重生成命令若被人照跑会动到公开仓,已补 `--out /tmp/... --no-commit` 安全提示(且未真执行);③ `aiKb*`/全表键数那行用 `wc -l`(物理行数)冒充键数,换成锚定正则后精确复现 757/702/1207/459 = 3125;④ 自己引入的表格缺一个 `|` 分隔符会静默并列。
Task 9: 机主拍板执行完毕 —— `FRONTEND_API_GUIDE.md` 已入库 VUE2@`6c5c632f`(入库前三类敏感信息扫描:真实 token/密码/私钥、内网 IP/主机名、机主个人信息,实现者与复评各独立扫一遍,均干净);`DEFAULT_OUT` 危险默认值已单独立票排在 roadmap 新表第一行。VUE2@`6ff26538` / NEW-UI@`7c77609`。
Task 9: 🔴 **`DEFAULT_OUT` 危险默认值经复评独立读源码确认属实**: `oss/manifest.mjs:12` `DEFAULT_OUT = path.resolve(HERE, '../../NimoOS-Web')` = 真实公开仓;`export.mjs:18` `NO_COMMIT` 默认 false、`:229` 分支无条件 `git add -A` + commit/amend。⇒ 不带参数直接 `node oss/export.mjs` 会 rsync --delete 清空真实公开仓后写入**并自动提交**。
Task 9: fix round 1/5 (2 addressed) + 入库执行;复评新发现 1 Important(权威操作文档里一句自相矛盾的决策前残句)→ 修复轮 2/5。
Task 9: fix round 2/5 (1 addressed, 0 open; commits 7c77609..6a5accf) —— 残句改写成明确的历史记录措辞;复评自跑同类扫描(9 个关键词)仅 2 处命中,均已显式标为已解决。
Task 9: complete (VUE2 749e4aae..6ff26538 + NEW-UI 9e9ada6..6a5accf, review clean)

--- T0-T9 全部关账,进 T10:全支终审 → 双侧部署 80 → 两份验收清单 ---
Task 10: complete —— 终审修复波 + 两侧部署 80 + 三份验收清单。NEW-UI a102311..259f39a / VUE2 6ff26538..7990d069 / SERVICE 零改动。
Task 10: 全支终审(opus)判 **With fixes,零 Critical**;修复波后复评四个维度独立验真部署,并说验收清单「找不到会产生假缺陷的条目」。
Task 10: 🔴 我给的部署自证命令有 2/3 会误导(已订正进 roadmap): ① `grep "strangler:disabled:/ai"` 无输出**属正常** —— `flagKey()` 是模板串,字面串不存在;正确查法是分两半查 `strangler:disabled:` 与 `/app/#/ai`。② `curl -sI /app/` 返 **405**(网关不允许 HEAD),要用 GET。
Task 10: 🔴 「@types/node 自相矛盾注释」最终清掉 **13 处**(M5 那轮 8 + 复评点名 2 + 自查再找 2 + **实现者自己上一轮写下的 1 处**)。机制追到底:全仓 7 个文件写了 `/// <reference types="node" />`,这是**程序级**指令,把 `declare var process` 拉进整个编译程序 ⇒ 「本仓没装 @types/node」这类断言全错。
Task 10: 🔴 **一条被验伪的连锁理由(新债 I4)**: `PlaceDetailPanel.test.ts:346` 用「没装 @types/node ⇒ node:fs 报 TS2307」当作「不读 theme.css」的理由,并称「这正是 color-guard 跳过 theme.css 的原因」—— **后半句从来就不是真的**(color-guard 跳过 theme.css 的真实理由写在 `color-guard.test.ts:113`:token 定义文件裸字面量是本职;而它今天**正是用 node:fs 直读全部 .css**)。理由不成立,决定按纪律未动,已立票 I4 并附「找同类规避」的扫描命令。
Task 10: 新债 I3(立票不修): `color-guard.test.ts` 的 `listCss()` 只收 `.css`、**无 `.scss` 分支**。合流前 master 的 .scss 数为 0,合流后 **9 个 / 7127 行**永久落在「颜色一律走 token」硬约束的守卫之外。真实敞口经三方复算 = `sk-shared.scss` **3 处裸色 + 2 处具名 white**(其余命中分别是 token 定义档/有专属守卫/有豁免头/在注释里)。修它需配套豁免机制,非加一行 glob。
Task 10: 部署自证(复评独立复跑): Vue2 bundle `app.aeede38b.js` 含 `/ai` 绞杀条目**且含本期 M4 新注释文本**、旧「8 条」零命中 · `/app/` = 本次构建(7,316,399 B 对上构建日志)· `deploy-ui.sh` 的 `--exclude 'app/'` 保住了 `/app/` · GET `/app/` 与 `/` 均 200。
Task 10: 🔴 交付时仍待机主拍板三件: ① 推 origin ② 推 `NimoOS-Web` 公开仓(README 已复证与 `oss/files/README.md` 逐字节相同,风险降级为「确认就是这份」)③ 撤 `.sp8` worktree(台账已全部入库,撤了不会丢)。

=== SP8-P6 全部十一刀关账。SP8 全区收官(编码 + 部署),待机主真机验收。 ===
