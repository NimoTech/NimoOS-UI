# SP7-P8b 相册区 cutover · 台账

**计划书** `NimoOS-UI/docs/superpowers/plans/2026-08-04-vue3-migration-sp7-p8b-cutover.md`
**分支** `sp7-photos`(Part A,工作树 `.sp7/NimoOS-New-UI`)→ master(Part B)
**约束** 不跑 `deploy.sh`(用户 2026-08-04 明示:仍走 `:5277` dev 验收)

## 前置:时间线滚动/刻度尺修复(独立票)已关账

用户 2026-08-04 口径「都已经验收过了,标记成验收通过然后 commit 直接进 P8b」。
坐标 `3755b8e`,报告 `.superpowers/sdd/2026-08-04-sp7-timeline-scroll-scrubber-fix.md`。
该报告「待验收」8 条视作已过;第 6 条「卡不卡」没被提出 ⇒ **不另开虚拟滚动一票**,
渲染量问题继续挂账不做。

## Part A(分支内)

| 任务 | 坐标 | 规模 |
|---|---|---|
| T1 桌面两个相册入口翻向应用内 `/photos` | `dd2b146` | 460 文件 / 5919 例 |
| T2 深链补 `?view` / `?tab` / `?settings` | `a6ed258` | 460 / 5931 |
| T3 深链补 `?photo` / `?smartview` / `?place`+`?spot` | `b80f6f8` | 460 / 5947 |
| T4 深链键覆盖闸 + 本台账 | (本次) | 460 / 5952 |

三道门每任务都跑全:`vue-tsc --noEmit` exit 0 · `pnpm test` 全量 · `pnpm build` ✓。
**`pnpm test` 退出码恒为 1**,原因是 1 个 unhandled error =
`service.users.avatarPath is not a function`(`src/settings/panels/AccountPanel.vue:43`,
经 `SettingsPage.test.ts` 触发)—— SP9 侧既存问题,本期 diff 未碰 `src/settings/**`,
master 已在 `721117f` 修掉,**合回 master 时自动消失**。用例本身 0 失败。

### T1 要点

- 桌面有**两个**相册入口,都翻:系统磁贴(`openApp('photos')`)+ 桌面照片瓦片
  (`openItem` 的 `kind === 'photo'`,`GridItem.vue` 点击也走它)。
- `SYS_ROUTE.photos` 刻意**保留**:它从此是**回退目标**而非主路径。这也是它与
  appstore/storage 的区别 —— 那两个在 Vue2 侧是模态弹窗、没有自己的路由,回退只能落
  `/#/legacy` 老桌面,所以 `SYS_ROUTE` 里从来就没有它们的条目。
- 回退 flag `strangler:disabled:/photos`,与 Vue2 `strangler.js` 的 `/photos` 行**共用
  同一把键**(同源共享 localStorage,置一次两侧同时回退)。
- 照片瓦片刻意不带 asset:Vue2 也只跳 `/#/photos`(瓦片的 `key` 是渐变色字符串、不是资产
  id),界面 1:1 就该"点进相册首页"。

### T2 / T3 要点(深链从 6 键扩到 13 键)

**扩到 13 键是本期的范围决策,不是计划外加戏。** roadmap 原本只承诺补 `?settings`/`?view`
(P8a 债务清单第 ④ 条)。但翻牌之后 Vue2 `/photos` 整页被重定向走,它支持的**每一个** query
键都得在 New-UI 落地,否则老书签在 cutover 当天集体变哑 —— 不只是那两个。剩下五个各只
几十行,一并做掉,并立覆盖闸防以后再漏。

| 键 | 归一目的地 | Vue2 回源 |
|---|---|---|
| `view` | 六值 → 六条真实路由(`VIEW_ROUTES`) | `PhotosTimeline.vue:479-481` |
| `tab` | 本页 `tab` ref(走 `PhotosDeepLinkHooks.setTab`) | `:482-484` |
| `settings` | `/photos/settings?section=`('1' = 不指定分区) | `:485-488` |
| `photo` | 灯箱(最低优先级档,静默语义) | `:504-506` → `:556-571` |
| `smartview` | `/photos/smart-views/:id`(校验存在) | `PhotosSmartViewsView.vue:337-348` |
| `place`+`spot` | `/photos/places/:key?spot=` | `:496-498` → `:527-554` |

**`?tab` 是唯一需要宿主页面配合的键** —— tab 是时间线页内的展示过滤、不是导航目的地,
没有路由可跳。故给 `usePhotosDeepLinks` 加了 `PhotosDeepLinkHooks` 参数(刻意只有 `setTab`
一个成员,不做成"什么都能塞"的通用回调袋);测试侧 `Host` 相应改成工厂 `makeHost(hooks)`。

**`?photo` vs `?asset` 的语义区别照抄、不合并**:`?asset` 是分享链接(找不到弹 toast
告诉用户链接失效),`?photo` 是状态回显(找不到静默清键)。Vue2 `:556-557` 注释即点明。
灯箱链因此三档:`photoset` > `asset` > `photo`;`photo` 的让位门槛照 Vue2 逐字用"那两个键
**当前有没有值**"而非"这轮变没变"。

**`spot` 是 `place` 的附属键,但仍单独进 watch 数组** —— 只改 spot(place 不变)是真实
用户操作(整城 ↔ 某个 spot),漏了它在 query-only 路径下毫无反应。`active` 则不进:它只在
`photoset` 那次一次性交接里被读,单独改它没有意义(覆盖闸的 `ATTACHED_NO_WATCH` 登记了
这个区别)。

### 偏离登记(3 条)

1. **T2:`?tab` 先落、`?view`/`?settings` 后落。** Vue2 `:479-489` 行文顺序是
   view → tab → settings,三者作用在同一页面实例上、顺序无可观察差异;New-UI 里
   view/settings 会导航离开本页,若先跳走再 `setTab`,改的就是一个正在被卸载的页面的状态。
   故按"先本地、后导航"重排,不照抄行文顺序。
2. **T3:`?place` 归一时不带 `lat`/`lon`。** Vue2 拿到详情后把 spotName/spotLat/spotLon
   一起塞进 `onPlacesOpenSpot`(它"同页面切面板"架构下的传参方式)。New-UI 目的地是真实
   路由,只带 `?spot`;`PhotosPlaceAssets` 自己会 `loadDetail(key)` 取回 spot 坐标 ——
   那两个 query 是从地图页跳转时的"免二次请求"优化、不是必需入参。从一个只有 key 的老
   书签里硬造 lat/lon 反而要多信一层缓存。
3. **T2 顺带修既有用例的陪衬键。** `?person` 那条"只摘 person、不动其余键"的用例原来拿
   `view: 'people'` 当惰性陪衬键;`?view` 现在自己会导航走了,换成真正惰性的 `highlight`。
   属测试 fixture 语义随实现变更而更正,不是放宽断言。

### 变异验证(全部已跑,结果如实记录)

| 变异 | 预期 | 实测 |
|---|---|---|
| 删掉 `?photo` 失败时的 `stripQueryKey('photo')` | 静默清键用例红 | ✅ 1 红 |
| `?place` 的 spot 命中判定恒 `true` | 降级整城相关用例红 | ✅ 2 红(「只有 ?place」+「spot 找不到降级」) |
| 注掉 `route.query.smartview` 的 watch getter | 覆盖闸反向红 | ✅ 1 红 |
| 从覆盖闸清单里删掉 `photo` 一条 | 自检红 | ✅ 2 红(反向"多出键"+ 自检计数) |

四次变异后均还原,还原后 55/55(深链)+ 5/5(覆盖闸)。

### T4 覆盖闸的设计理由

这类"漏一个键"的缺陷**三道门天然抓不到** —— 没有任何行为用例会因为少一个键而变红。
SP9-T9 栽过同形态的坑(白名单只做单向检查,漏搬的整块 CSS 三道门全绿溜过)。故双向:
正向查"清单里每个键都在分发器被读到",反向查"每个键都进 watch 数组"+"watch 数组里
没有清单外的键",再加清单自检(非空、无重复、每条带回源坐标)。
读源码文本而非 import 模块:要断言的是 watch 依赖列表这种**结构**事实,运行时拿不到。

## Part B(master,2026-08-05 完成)

**曾暂缓一天**:2026-08-04 动手前实测发现 New-UI master 上 SP9-P7 Search 正在活跃提交
(16:19-17:08 四个提交 + 未提交的 `src/home/search/degrade.ts`),往别人任务中途落 202
提交 / 6 万行的 `--no-ff` 合并会让双方的门都分不清归属 ⇒ 用户裁定等 P7 告一段落。
08-05 P7 收官(9/9 验收通过)后放行,当日走完 T5-T8。

| 任务 | 坐标 | 要点 |
|---|---|---|
| T5 合流两仓 | New-UI `c457e29` / Service `c1da946` | 202 + 11 提交,**零冲突** |
| T6 Vue2 触点② | NimoOS-UI `971e155f` | `prefix: true` 才透传查询串 |
| T7 i18n 抽分片 | `dfe0bb9` | 保留 3 行合并出口 = 零测试churn |
| T8 开源清单扩张 | `b8c3848` | DELETE +35 / PATCH +42 |
| 台账入库 | `6f2f45a` | 206 份 .md |
| T9 回填 | NimoOS-UI `25983cc7` | roadmap + spec |

最终门:全量 **474 文件 / 6222 例、退出码 0**(既存的 `avatarPath` unhandled error 随合并
消失,如 Part A 台账预判)+ `vue-tsc` exit 0 + `pnpm build` ✓ + `npx vitest run oss`
17 文件 / 424 例(含**产物树里真跑 `pnpm install` + `vue-tsc --noEmit`**)。

### T5 的三个坑(下次跨 worktree 合并直接用)

1. **合并后必须 `pnpm install`** —— sp7 分支新增 `sortablejs` / `@types/sortablejs`,
   master 工作树的 `node_modules` 里没有(worktree 各有自己的 node_modules),不装
   `vue-tsc` 直接报 `TS2307: Cannot find module 'sortablejs'`。
2. **`oss/*` 三个导出测试会因"工作树不干净"整体 abort**(`export.mjs` 的干净检查只放行
   `design-export/`,见 `DIRTY_ALLOW`)。当时挡路的是 SP9 那条线留下的未跟踪计划书,
   原样入库(`23ef7e2`)才让 SP7 侧的验证跑得起来。
3. **`design-export/` 那 3 条未 staged 的删除**要先 `git restore --staged --worktree`
   才能 merge,收尾再还原成原状(**不是** `git rm --cached` —— 那会变成 staged 删除 +
   目录变未跟踪,与原状不同;正确做法是 `git reset` 回 HEAD 再把文件从磁盘删掉)。

### T7 的关键决策:保留 `zh_cn.ts` 作为合并出口

第一版按计划书直接拆成 base + photos 两块、让 `index.ts` 各自 import —— **实测打红
43 个测试文件 / 253 例**:全仓 40+ 个测试写着 `import zh from '…/i18n/zh_cn'` 自建
`createI18n`,拆完它们只读到 base、相册文案全成 key 名。
改成"`zh_cn.ts` 变成 3 行合并出口"之后**零测试文件受影响**,`index.ts` 与
`parity.test.ts` 一行都不用改,开源侧要补丁的也从"约 90 条锚点"收敛成"删 2 个文件 +
摘出口那一行"。

等价性不是靠"测试还绿"证的,是**逐键逐值比对**:抽片前后各 dump 一份合并后的文案表
JSON(1918 键),键集与每一个值完全一致(临时脚手架用完即删)。

### T8 的取证顺序(逐轮迭代,每轮只解一个 abort)

导出脚本在第一处失败就 abort,所以只能一轮一个:
锚点失配(`useOpenAction.ts` 4 条 → i18n 16 条改指 `.base.ts` → 测试侧 3 条)
→ 泄漏守卫 303 处(Service 侧 6 个 photos 测试文件漏在 `SERVICE_DELETE` 外,过半命中出自这里)
→ 173 处(locale 白名单的 file 正则没跟着 `.base.ts` 改名)
→ 70 处(两份纯相册键的 i18n 守卫 + `parity.test.ts` 的 photosPlaces 块 + `router/index.test.ts`)
→ 39 处(`router/index.ts` 的 import 与路由两段)
→ 2 处(`theme.css` 27 块相册 token)
→ **零真实命中**。

`theme.css` 那 27 块是脚本按人工核定的行区间提取的,自检两条:每块必须"注释开头 + token
结尾"(防切半)、每块在原文恰好出现 1 次;删后做**悬空注释检查并与基线做差**(文件里本来
就有 1 条会被任何朴素判据误报的注释,基线做差后新引入 0 条)。
**刻意未删** `--divider` / `--panel-bg-solid`:名字通用、无相册字样、不触发禁词。

## 验收轮 1(2026-08-05):1 个颜色缺陷,已修并经用户确认

用户在 `:5274` 验收期间截了两张图(`/DATA/Documents/test_folder/`),报「一个颜色问题」。
两张是**同一类**毛病:本该透出玻璃壳的表面被刷成不透明深色板。**已修 `597a1f2`**,用户确认
「没问题了」。

**根因(一类移植缺陷,值得记住):照抄了 token 名,但两个同名 token 的语境不同。**
Vue2 相册区是一整块不透明深色页面、页底色就叫 `--bg`,页内元素刷它与页底无缝;New-UI 的
相册区活在 AreaShell 的**半透明玻璃壳**里,而本仓恰好也有个叫 `--bg` 的应用底色 token ——
按名字对名字搬过来,就在玻璃上刷出一块实色板。

- `PhotosSearch.vue` `.filterbar`:去 `background: var(--bg)`(截图里横贯整宽那条黑带)。
  **顺带查实它的 `position: sticky` 是空操作** —— 真滚动容器在 `PhotosSearchGrid` 内部、是
  这条横条的**兄弟不是祖先**,从来没有内容滚到它下面 ⇒ 那块不透明底色本就毫无功能。但
  `position`/`z-index` 保留:筛选弹层 `.fpop` 是它的后代,靠这两条才画到下方网格之上。
- `PhotosSmartViewDetail.vue` `.sv-detail-side`:`--panel-bg-solid` → `--panel-bg`。
  原先援引 PlaceDetailPanel 当先例,但那条先例是**功能性**的(压在 PlacesMap 画布上,半透会
  把地图网格点透上来);本栏底下没有地图。同区常驻侧栏 PhotosSidebar / PlacesRail /
  PhotoInfoPanel / PersonPlacesTab 全是 `var(--panel-bg)`。

**新增闸** `views/__tests__/photosGlassSurfaces.test.ts`(5 例):正向钉两处写法 + 钉
filterbar 的 border/position/z-index 不被后来人顺手清掉 + **反向白名单钉住
`--panel-bg-solid` 的消费方集合**(只许 PlaceDetailPanel,新增必须先回答"底下真的有地图吗")。
变异验证两次均变红后还原。新测试同步进 `oss/manifest.mjs` DELETE 表(29 → 30)。

**踩坑复现**:注释里写了字面色值 `#0A0A0C` 被 color-guard 判红 —— 它**不剥注释**,注释里的
hex 与声明里的一样拦(记忆 `nimoos`/color-guard 那条早有记载)。改成文字描述后过。

**门**:全量 **475 文件 / 6227 例、退出码 0** + tsc 0 + build ✓ + `oss` 全绿。

## 交用户的验收清单

见计划书末尾 §验收清单(19 条,分 A 翻牌本体 / B 深链十三键 / C 回退可逆 / D 全区回归)。
**cutover 已合入 master,验收改在主工作树起 dev server**:`cd NimoOS-New-UI && pnpm dev`
(:5273)。**勿 deploy.sh**(用户明示:设备上只有一个 `/app/` 目录、deploy 是
`rsync --delete`,一部署就覆盖别人的部署)。

`.sp7` 工作树与 `sp7-photos` 分支已可回收 —— 合并 commit `c457e29` 已完全并入,
`git branch -d` 会放行;台账已在 `6f2f45a` 入库,撤 worktree 不会重演 SP7 那次台账事故。
