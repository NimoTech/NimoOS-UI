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

## Part B(master)

| 任务 | 状态 |
|---|---|
| T5 合并 `sp7-photos` → master(New-UI + Service) | 待做 |
| T6 Vue2 `strangler.js` 加 `/photos` 行(**必须在 T5 之后**) | 待做 |
| T7 相册 i18n 键抽成分片 | 待做 |
| T8 开源导出清单为 `src/photos/**` 扩张 | 待做 |
| T9 收尾回填 | 待做 |

## 交用户的 `:5277` 验收清单

见计划书末尾 §验收清单(19 条,分 A 翻牌本体 / B 深链十三键 / C 回退可逆 / D 全区回归)。
启动方式:`cd .sp7/NimoOS-New-UI && pnpm dev --host --port 5277`。**勿 deploy.sh。**
