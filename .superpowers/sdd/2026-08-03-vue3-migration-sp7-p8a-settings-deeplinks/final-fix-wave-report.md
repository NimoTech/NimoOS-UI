# P8a 终审修复波(2026-08-04)

工作区 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`,分支 `sp7-photos`,基线 HEAD `6c58488`。

## Item 1(继承)——`PhotosAlbums.vue` 失败态

前序 agent 已完成实现(loadError 分支优先于 empty-state、`retryingAlbums` 本地守卫、
`.empty-state .bar-btn` 间距规则、测试文件 5 条新用例)。本波未改动其代码或测试内容,
按指示原样继承并纳入本次提交。

- 起始状态确认:`pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts --reporter=verbose`
  → **17/17 通过**,0 `[Vue warn]` 之外的告警属于该文件既有的 legacy `createI18n` 噪音(见下方
  "测试与 [Vue warn] 统计")。
- **补跑的变异验证(本波新做,前序 agent 未做)**:手工把 `v-if="albums.loadError"` /
  `v-else-if="isEmpty"` 的顺序对调(空态分支挪到失败态之前),重跑同一测试文件。
  **结果:17/17 仍然全部通过,没有变红。**
  - 原因排查:`isEmpty` 的定义是 `albums.albumsLoaded && albums.albums.length === 0`,而
    `loadError` 为真时 `albumsLoaded` 按设计刻意保持假(`albums.ts:18-20` 的注释)。因此
    `isEmpty` 与 `loadError` 在当前 store 不变量下互斥——调换 `v-if`/`v-else-if` 顺序对
    可观察行为没有任何影响,这是一次"零杀伤力变异"的诚实记录,不是测试写错,而是
    "分支优先级"这件事本身在当前不变量下不是靠这两个分支的相对顺序生效的,是靠两个
    条件互斥生效的。真正锁住"失败态不落进空网格"这件事的,是各自独立的断言用例
    (「加载失败时渲染失败态而非空网格」等 5 条),不是分支书写顺序本身。
  - 手工改动已还原,`git diff -- src/views/PhotosAlbums.vue` 核对与改动前完全一致(顺序
    还原为 loadError 在前)。

## Item 2(Important)—— `usePhotosDeepLinks.ts` 执行顺序注释订正

**回源核实**:读 `NimoOS-UI/src/views/Photos/PhotosTimeline.vue:355-381`。确认:

- `:371`/`:373` 的 `this._openPhotoSetFromQuery(...)` / `this._openAssetFromQuery(...)`
  调用**没有 `await`**(两个都是 `async` 方法,调用处是裸调用,返回的 Promise 被丢弃)。
- `:377` 紧接着**同步**调用 `this._applyUrlDeepLinks()`。

结论:评审的读法成立。Vue2 的真实时序是 q/place/person(路由改写那一路,在
`_applyUrlDeepLinks` 内)先跑完,灯箱那段的 `fetchAssetDetail` 仍在异步飞行中、稍后才
落定——这是一个从未被刻意设计/保证过的竞态,不是"先灯箱后路由"的产品意图。原注释
("同步的 router.replace 反而会抢在异步取图完成之前执行,顺序就会在真实时序上颠倒")
把这个偶然的竞态描述成了必须避免的"颠倒",实际上颠倒的方向本来就是 Vue2 的真实行为。

**改动**:仅重写 `usePhotosDeepLinks.ts:14-27` 的注释块(不改代码),内容包括:
1. Vue2 实际做法(不 await + 同步调用)与 New-UI 刻意串行化的理由(两条腿都有可观察副
   作用,串行让结果不取决于网络时序,优于复刻一个从未被保证过的实现细节竞态)。
2. 折叠进同一块的范围声明:混合"灯箱开图 + 导航型 query"的组合输入不是本文件的
   支持形状——`?q`+`?album`+`?person` 同时到达会在同一个 IIFE 里连续触发三次
   `router.replace`,没有互斥/排队,这是已知限制不在本期修复范围。

## Item 3 —— 深链 query 键的范围清单

**回源核实**:读 `PhotosTimeline.vue:475-507`(`_applyUrlDeepLinks` 全函数体)+
`:364-374`(mounted 里的 photoset/asset/active 分发)+
`PhotosAlbumsView.vue:264`(album)+ `PhotosSmartViewsView.vue:340`(smartview)。

确认 Vue2 `/photos` 支持的全部 query 键 = `photoset, asset, active`(mounted 分发)+
`view, tab, settings, q, place, spot, person, photo`(`_applyUrlDeepLinks` 内)+
`album`(相册列表页自己 mounted 读)+ `smartview`(智能视图页自己 mounted 读)。
与计划书列出的集合一致,没有出入。

**改动**:在 `usePhotosDeepLinks.ts` 文件头新增一段清单注释,列出本文件实现的 6 个键
(`asset/photoset/active/q/album/person`)与刻意未实现的 6 个键(`view/tab/settings/
place/spot/photo/smartview`,合计其实是 7 个——已核实计数以源码枚举为准,不是抄计划书
数字),并逐个说明原因(view/tab/settings 是"入口归一"的下一期工作;place/spot 缺对应
详情路由;photo 是灯箱回填键未接;smartview 是子视图键未纳入)。纯注释改动,零新键、
零代码改动。

## Item 4(Minor)—— 死键 `photosSettingsSubtitle`

**Grep 核实**:`grep -rn "photosSettingsSubtitle" src/` 命中仅 3 处——两个 locale 文件的
定义行 + `p8aKeys.test.ts` 的键名列表,组件层零引用。`AreaShell.vue:6`
(`defineProps<{ title: string }>()`)只吃 `title`,确认没有承载副标题的位置。

**改动**:
- `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`:删除该键,各自留一行删除登记注释(照
  `photosSvSettingsPending` 先例的注释风格)。
- `src/i18n/__tests__/p8aKeys.test.ts`:从 `KEYS` 列表移除该键,加一行注记。

## Item 5(Minor)—— error 任务过期未港,注释掩盖了缺口

**回源核实**:读 `NimoOS-UI/src/store/modules/photos.js:1375-1410`。确认 `:1403-1406`
对 `status === 'error'` 的任务同样调用 `scheduleTaskRemove(payload.id, 10000, () =>
commit('REMOVE_TASK', payload.id))`,只是延迟 10s(done 是 5s)。New-UI 侧 `ingestTaskBus`
此前只处理了 `running`/`done` 两支,`error` 状态的任务永久留在列表里——评审的读法成立,
是遗漏不是"考虑过后拒绝"。

**改动**(`src/photos/stores/timeline.ts`):
- 新增 `else if (task.status === 'error')` 分支,复用已有的 `_doneRemovalTimers` Map
  (未新开第二张计时器表),10 秒后从 `tasks` 里摘除。
- 把引用行号从 `:1382-1402` 扩到 `:1382-1406`,并加一句说明此前遗漏、现已补上,不再让
  注释读起来像"已考虑过 error 分支"。

**新增测试**(`src/photos/stores/__tests__/timeline.test.ts`):照既有 done-任务边界用例
的房规写法——`ingestTaskBus: error 任务 10s 后从列表移除(边界:9999ms 仍在,+2ms 已移除)`。

**变异验证**:临时删掉新增的 `else if (task.status === 'error')` 分支 → 重跑
`timeline.test.ts` → **新用例变红**(`expect(s.tasks).toHaveLength(0)` 断言失败,实际
长度为 1,其余 24 条不受影响)→ 手工恢复分支 → 重跑确认 **25/25 全绿** → `git diff` 确认
文件与恢复前一致。

## Item 6(Minor)—— `PhotosAiCard.vue` 的 `role="switch"` 无键盘可达性

**排查范围**:`grep -rn 'role="switch"' src/` 找到多处,但本期(P8a)新增的只有
`PhotosAiCard.vue:174` 这一处——`SmartViewSidePanel.vue`/`SmartViewCreateDialog.vue`/
`SearchSaveSmartView.vue` 的 `sv-switch` 是 P7a 分支已有的、且自带 `tabindex="0"`,不属于
本波范围;`SettingsSwitch.vue`/`switchRows`/`DeveloperPanel`/`SnapshotPanel` 等属于其他
区域(设置/存储),同样不在本波"本期新增"范围内。`PhotosStorageCard.vue` 无
switch 元素。

**回源核实**:`NimoOS-UI/src/views/Photos/PhotosSettings.vue:163` 是裸 `<div class="st-switch"
:data-on="features[f.id]" ...>`,没有 `role`。

**改动**:删掉 `role="switch"`,恢复裸 `<div>`(1:1),保留原有 `@click`/`:data-on`/
`:aria-checked`/`:aria-label`(裁决只要求去掉 `role`,未要求连带删除其余 aria 属性)。
加一行 a11y 债务登记注释:这颗开关鼠标可点、键盘不可达,是 Vue2 同款的鼠标专用交互,把
整个设置页做成可键盘导航是本期范围之外的独立工作。

**测试检查**:`PhotosAiCard.test.ts` 全部用 `data-test` 选择器,没有断言 `role` 属性,
无需改测试。18/18 通过。

## Item 7(Minor)—— retention 与 scan-interval 的文案风格不一致

**回源核实**:`PhotosStorageCard.vue:186`(`photosSettingsRetentionDay` 走 i18n,渲染
"{n} 天")与 `:210`/`scanIntervalOptions`(`6h/12h/24h/7d` 裸字面量,`off` 那档才走 i18n)
确实不对称——zh 下相邻两组分段控件一个译成中文单位、一个保留缩写。

**改动**:未改代码/行为,仅在 `scanIntervalOptions` 定义处加一段登记注释,说明两种做法
各有各的既定理由(retention 走 `$t` 是本期刻意的选择;scan 保留缩写是先前 ruling),但
相邻不一致这件事此前没被登记过,现补登记为"决策而非疏漏",是否统一留给机主上机验收
时拍板。

## 测试与 `[Vue warn]` 统计(均 `--reporter=verbose`)

| Run | 结果 | `[Vue warn]` |
|---|---|---|
| `PhotosAlbums.test.ts`(起始基线,改动前) | 17/17 | 119(既有 legacy `createI18n` 噪音,非本波引入,详见下) |
| `timeline.test.ts`(item 5 改完) | 25/25 | 0 |
| `PhotosAiCard.test.ts`(item 6 改完) | 18/18 | 0 |
| `PhotosStorageCard.test.ts`(item 7 改完) | 21/21 | 0 |
| `parity.test.ts` + `p8aKeys.test.ts`(item 4 改完) | 12/12 | 0 |
| 收尾联跑:`PhotosAlbums.test.ts` + `timeline.test.ts` + `parity.test.ts` +
  `p8aKeys.test.ts` + `color-guard.test.ts` + `PhotosAiCard.test.ts` +
  `PhotosStorageCard.test.ts`(7 个文件一起跑) | **841/841** | 119(全部来自 `PhotosAlbums.test.ts` 自己的 legacy `createI18n` 重复注册告警,ledgered debt,与本波 items 2-7 无关) |

`pnpm exec vue-tsc --noEmit`:0 错误。

## 变异验证清单

1. Item 1(补做):失败态/空态分支顺序对调 → **未变红**(两分支在当前 store 不变量下
   互斥,顺序本身非承载因子,如实记录),手工恢复,`git diff` 核对一致。
2. Item 5:临时删除 error 分支 → **变红**(新增边界用例失败),手工恢复,重跑确认
   25/25、`git diff` 核对一致。

## 判断有别于指示之处

- Item 3 的键计数:任务描述里写"再加上 `album`/`smartview`",直觉上容易数成"8 个
  handled + N 个 out-of-scope 之和固定",但清单以本次亲自读源码枚举的结果为准(见上),
  未直接照抄任务描述里的行号/键名转述。
- 未对 item 6 的其余 `role="switch"` 实例(`SmartViewSidePanel.vue` 等)做任何改动——
  它们不属于 P8a 本期新增(P7a 已有代码,且已带 `tabindex="0"`),按"检查是否有其他本期
  新增的同类元素"的措辞,判定为不在整改范围内,仅在报告里说明排查过程。

## 提交

单次提交覆盖 item 1(继承)+ items 2-7,commit message:
`fix(photos): P8a 整支终审修复波(2 Important + 5 Minor)`。
