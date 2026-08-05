# Task 16 报告:PhotosSearchBar.vue + views/PhotosSearch.vue 容器接线 + 灯箱 OCR 激活

## 实现内容概述

- 新建 `src/photos/components/PhotosSearchBar.vue`(D13 搜索框)+ 其测试。
- 新建 `src/views/PhotosSearch.vue`(路由 `/photos/search` 容器,兑现搜索半区全部功能)+ 其测试。
- `src/router/index.ts`:追加 `/photos/search` 路由(在 `/photos/smart-views/:id` 之后)。
- `src/views/Photos.vue`:顶部挂 `PhotosSearchBar`,提交跳转 `/photos/search`。
- `src/views/PhotosSmartViewDetail.vue`:兑现「在搜索中细化」按钮(去 disabled/TODO,接 `router.push`)。
- `src/i18n/zh_cn.ts` / `en_us.ts`:删除死键 `photosSvSearchPending`。

## E3 核查结论(灯箱 OCR 激活链路)

已回源确认 `src/photos/lightbox/useLightbox.ts` 的完整消费路径,OCR 高亮**确实被激活**,不是传了没人用:

1. `openAt(photo, entryList, startMsArg?, query?)`(:55)把 `query` trim 后写入模块级
   `searchQuery` ref。
2. 每次当前项变化(`onCurrentChanged` → `hydrateDetail`,:100-124)里:
   `const wantOcr = !!searchQuery.value && !item.isVideo`;为真时调用
   `service.photos.getAssetOcr(id, searchQuery.value)`,把返回的 `lines` 写入 `ocrLines` ref。
3. `ocrLines` 供灯箱内部(`PhotoImageViewer.vue` + `util/ocrHighlight.ts` 的
   `mapOcrBoxesToRects`)换算成叠加矩形渲染高亮框。

因此本任务只需在 `@open` 处理器里把第四参传 query 即可(`lb.openAt(photo, sortedResults.map(r=>r.p), 0, query.value)`),链路本身早已就绪(P2 遗留的休眠功能,本任务负责的只是「喂它一个非空 query」这最后一步)。测试 `views/__tests__/PhotosSearch.test.ts`「@open → 灯箱 OCR 激活」一节直接断言 `openAt` 调用的第四参是当前 query。

## 最终接口签名

`PhotosSearchBar.vue`:
```ts
defineProps<{ value?: string; autofocus?: boolean }>()
defineEmits<{ (e: 'submit', q: string): void }>()
```
**偏离登记**:brief「Interfaces」骨架里给的 `(e: 'exit'): void` **没有实现**——结构规格第 5 条明确写「不做返回键……登记不建」,这是骨架与结构规格之间 brief 自身的不一致,以更具体的结构规格为准(路由 `/photos/search` 承担返回语义,浏览器后退键 / 侧栏切换即可)。

新路由:`{ path: '/photos/search', name: 'photos-search', component: PhotosSearch }`,追加在 `photos-smart-view-detail` 之后。

## 渲染项清单对照(Vue2 PhotosSearchView.vue 逐段 → New-UI 落点)

| Vue2 段落 | New-UI 落点 |
|---|---|
| `:4-21` 预搜索态(`.search-prestate` + nimo-orb + h2/p + 最近搜索 chips) | `PhotosSearch.vue` `.search-prestate` 分支 |
| `:24-47` hero(query 高亮/耗时/历史/understood) | `.search-hero` 分支 |
| `:50-148` filterbar(5 chip + 5 弹层) | `.filterbar` + `PhotosFilterChip`(T12)+ `SearchDatePopover`(T13)+ `SearchPeoplePopover`(T14)+ `PhotosFilterPopover`×3(T12,place/album/type) |
| `:150-158` save-smart 触发按钮 | `.save-smart` 按钮(本任务实现,E9) |
| `:159-210` save-pop | `SearchSaveSmartView`(T14 已建,本任务接线 + 传 `ignoreEl`) |
| `:214-223` results-bar(排序 + 计数) | `.results-bar` 分支 |
| `:226-238` empty-search(**不建 Ask Nimo 按钮**,D1) | `.empty-search` 分支 |
| `:241-279` 结果网格(双档 + sentinel) | `PhotosSearchGrid`(T15 已建,本任务喂 `best/more/...`) |
| `:283-289` save-toast + 「在智能视图中打开」链接 | **不建**(结构规格未提及;T14 SearchSaveSmartView 已经是「真建」而非 Vue2 那个假的 toast-only 流程,`saved` 态本身就是本任务的成功反馈,登记为范围收窄非漏做) |
| `PhotosTopbar.vue:14-24`(`.search` 输入框) | `PhotosSearchBar.vue` |
| `PhotosSmartViewDetail.vue` 「在搜索中细化」(T6 临时 disabled) | 本任务去 disabled,接 `router.push` |

## 两条腿审计(逐条声明粒度)

对 `search-prestate`/`search-hero`/`understood`/`filterbar`/`save-smart`/`results-bar`/`empty-search`/`nimo-orb` 八个区块,逐条声明核对 Vue2 `photos.scss` 对应行号(`:2577-2793` 一段 + `:226-246` 的 `.search` + `:871-877` 的 `.nimo-orb`),内联 style(Vue2 模板里散落的 `style="..."` 属性,如 understood 行的 `color:var(--text-3)`/`margin:0 4px`)也逐条转成对应规则。差异均在代码注释里就近登记(见下方「偏离登记」)。

## 回源核对结果(逐条)

| 断言来源 | 源码真值 | 结论 |
|---|---|---|
| E1 四个键名 | `grep zh_cn.ts` 确认 `photosSearchSearchLibrary`/`photosSearchSort`/`photosSearchSunsets`/`photosSearchCountResultsSecondsS` 均存在 | **符** |
| E2:`photosSvSearchPending` 该删 | 两个 locale 均已删除;删除前全仓 grep 确认零残留代码引用 | **符,已执行** |
| E3:灯箱 OCR 消费路径 | `useLightbox.ts` 的 `hydrateDetail` 确实消费 `searchQuery` 触发 OCR 请求 | **符,已激活** |
| E4:`getAlbum` 不是 albums store 方法,真实 API 是 `fetchAlbumAssets`+`assetsOf` | 读 `stores/albums.ts` 确认 | **符,已按真实 API 实现** |
| E4:`albumIdByName` 不存在 | 确认;改为从 `albums.albums` 现查 `name` | **符** |
| E5:`people.named` 过滤口径与 Vue2 `realPeopleList` 一致 | `peopleView.ts:90-91` `namedOf` 是 `p.name && p.name.trim() !== ''`,与 Vue2 `:438` `p.name && p.name.trim()` 逐字等价 | **符,直接复用不重复过滤** |
| E6:`PhotosSearchGrid` 签名 | 读组件源码确认 `{ best, more, moreExpanded, showSentinel, loadingMore }` + `open`/`update:moreExpanded`/`load-more` | **符** |
| E7:`ignoreEl` 传给 `SearchSaveSmartView` | 已传 `saveBtnRef` | **符,已实现** |
| E7:`SearchPeoplePopover.people` 需调用方排好序 | 已在 `realPeopleList` 里 `.sort((a,b)=>b.count-a.count)` | **符** |
| E8:5 个 chip 弹层必须 `v-if` 挂载 | 5 处均 `v-if="openPop==='x' && chip.key==='x'"` | **符** |
| E9:`--success` 是 T3 已选定的绿色 token | `SmartViewCard.vue:279-282` 确认用 `var(--success)` 替代 Vue2 `#34C759` | **符,复用同一 token** |
| E10:空态 chip 紧凑变体归本任务 | `photos.scss:2776` 未在别处实现,本任务在 `.empty-search .conditions .fchip` 补上 | **符** |
| brief 结构规格 3「PhotosTopbar.vue:66-69 空串也 emit」 | **回源核对系新发现错误**:该行实际是 `submitSearch(){ const q=...trim(); if(!q) return; emit('search',q) }`,空串**不** emit。真正「空串也 emit」的先例是 `PhotosTimeline.vue:960` 的 `@exit-search="onSearch('')"`(退出搜索按钮,不经过 submitSearch 的空串守卫)——两者是完全不同的代码路径,brief 把两者混为一谈。**仍按 brief 的显式指令 + 测试用例规格实现「空串也 emit」**(路由化的独立搜索页里 Enter 键需要同时承担「提交/清空退出」两种语义,这是本任务面对的场景与 Vue2 topbar 场景不同),但已在代码注释与本报告双处登记这处 brief 事实错误。 |
| `'photosSearchType' + v` 字符串拼接(brief 结构规格 11/16/18 多处隐含此写法) | **回源核对系新发现错误**:拼接在 `OCR` 上会产出 `'photosSearchTypeOCR'`,与真实键名 `'photosSearchTypeOcr'` 大小写不同,会静默显示英文原文——与本任务要修的 §7e-13 是同一类缺陷。已改用显式 `TYPE_LABEL_KEYS` 映射表,三处消费点(chipLabel/labelFor/understoodValueFor)统一走这张表。 |

## 偏离登记(逐条:Vue2 原样 → 改成什么 → 为什么 → 代码注释位置)

1. **§7e-13(brief 已点名的 Vue2 缺陷)**:Vue2 `:44` `<b>{{ t.v }}</b>` 直出英文(如 `Videos`)→ 改成按 token 种类映射本地化(`understoodValueFor`,`PhotosSearch.vue:237-242`)。person 原样;type 走 `typeLabel()`;time 是数字(年份)原样,是 QuickKey 字符串则 `t(tok.v)`。测试:`hero > 第 13 条缺陷守卫`。
2. **§7e-14(brief 已点名的 Vue2 缺陷)**:Vue2 无「换词后 saved 复位」逻辑 → 在主 watcher 的 `old!==undefined && q!==old` 分支里加 `saved.value=false`(`PhotosSearch.vue:275`)。测试:`保存为智能视图 > 第 14 条缺陷守卫`。
3. **PhotosSearchBar 不做返回键 / 不接 lightboxOpen 抑制 prop**:结构规格第 5 条明确裁定,路由承担返回语义。代码注释在 `PhotosSearchBar.vue` 文件头。
4. **空串也 emit**:见上表「回源核对结果」行,注释在 `PhotosSearchBar.vue` `submit()` 上方。
5. **`'type: '`/`'album: '` 前缀不进 i18n**:`activeConditions` 里两处 push 用原始英文值(`f.type`/`f.album` 本身),不经过 `typeLabel()`——这些串要发给后端 parser 当 smart view 条件,不是显示用文案。代码注释在 `PhotosSearch.vue` 的 `activeConditions` computed 上方。
6. **不建 Vue2 的 save-toast + 「在智能视图中打开」链接**:D12 已经把「保存」做成真的 store 调用,`saved` 按钮态本身就是成功反馈;结构规格 1-23 全文未要求复刻这条 toast。登记为范围收窄,不是漏做。
7. **`.nimo-orb` 自绘**:Vue2 是一张紫色系 `url(./nimo-logo.png)`,本仓改成 `radial-gradient(...) `+ 复用既有 `--orb-glow` token 的 `filter: drop-shadow`(`AiWidget.vue:37` 的 `.ai-orb` 已是同一 token 的既定先例,不新增 token)。代码注释在 `PhotosSearch.vue` `.nimo-orb` 规则上方。
8. **PhotosSearchBar 不建 `.kbd`「↵」提示徽标**:结构规格 1 只要求「圆角输入框容器含 search 图标 14px + `<input>`」,没提这个徽标——刻意范围收窄。同一组件在 Photos.vue 与 PhotosSearch.vue 两处复用同一份外观(不做 Vue2 两个高度变体 32px/40px 的区分),取中间值 34px,登记为本任务自己的简化决定(结构规格没有给「变体」prop)。代码注释在 `PhotosSearchBar.vue` `<style>` 顶部。
9. **`save-smart` 的渐变/边框改用 accent 家族单值 token**:Vue2 两色渐变(0.20/0.08)均值 ≈ `--accent-soft` 的 0.14 挡,边框 0.40 就近取 `--accent-soft-bd`;`[data-saved]` 态复用 T3 已选定的 `--success` token,**去掉 Vue2 的三个 `!important`**(scoped SFC 内无同选择器优先级战)。代码注释在 `PhotosSearch.vue` `.save-smart` 规则上方。
10. **`.sort button` / `.save-smart` 补 `:hover`**:Vue2 这两处压根没有任何 `:hover` 反馈,本仓其余可点按钮一律有 hover——加性 UX 改进(非漏移植,Vue2 本来就没有)。`[data-active]`/`[data-saved]` 变体各自补 `:hover` 满足本仓 hover 硬约束。代码注释就近登记。
11. **`onMounted` 用 store 的 `loaded` 门控标志而非 Vue2 的 `!array.length`**:代码注释在 `onMounted` 块上方,理由与 T16 前各任务的既定做法一致(区分「确实零条」与「还没拉过」)。

## 删码验证清单(brief 10 条,逐条结果)

| # | 删了什么 | 结果 | 说明 |
|---|---|---|---|
| ① | 主 watcher 里的 `filters.value = emptyFilters()` | **红** | `路由 query 驱动 > q 改成 "def"...` 用例失败(先真的 Apply 一个 type 过滤,换词后断言 chip 变回未选中) |
| ② | 首帧 `old === undefined` 的不清守卫(改成 `if (q !== old)`) | **未红,如实分析** | 见下方专门说明 |
| ③ | `applyUnderstood` 的「date 已有则不覆盖」(`if (timeTok && !filters.value.date)` → `if (timeTok)`) | **红** | `applyUnderstood > date 已有用户选择...` 用例失败(重写后见下方修正记录) |
| ④ | `filters.album` watcher 里的 `if (mine !== albumSeq) return` | **红** | `filters.album > 快速切两个相册的 seq 守卫...` 用例失败(旧响应覆盖了新响应) |
| ⑤ | `openAt(...)` 的第四参 `query.value` | **红** | `@open → 灯箱 OCR 激活` 用例失败(`args[3]` 变 `undefined`) |
| ⑥ | `understoodValueFor` 里 type 分支的 `typeLabel(tok.v)`(改回 `tok.v`) | **红** | `hero > 第 13 条缺陷守卫` 用例失败(断言到英文 `Videos`) |
| ⑦ | 主 watcher 里的 `saved.value = false` | **红** | `保存为智能视图 > 第 14 条缺陷守卫` 用例失败 |
| ⑧ | `onDocKeydown` 里给 `openPop` 分支加 `return` 早退 | **红(隔离测试后)** | 见下方专门说明 |
| ⑨ | 历史写入的 `.filter((h) => h !== q)` | **红** | `搜索历史 > 重复 "abc" → 去重提前` 用例失败 |
| ⑩ | `tiers` computed 把 `splitTiers(sortedResults.value, ...)` 改成 `splitTiers(filteredResults.value, ...)`(排序前切分) | **红** | `排序 > relevance 下按分数降序...` 用例失败(tier 内顺序不再跟随当前排序) |

### ②「首帧不清守卫」未红的如实分析

删掉 `old !== undefined &&` 之后,全部 48 条测试仍然全绿(实测确认,非猜测)。原因:`applyUnderstood()` 在 if 块**之后无条件同步执行**——不论 if 块是否运行,`applyUnderstood()` 都会在同一次 watcher 回调里紧接着重新计算并写入 `filters`。而在首帧(`old===undefined`)这个时间点,`filters`/`moreExpanded`/`saved` 全部还是各自的默认空值,`clearAll()` / `moreExpanded=false` / `saved=false` 对它们而言是幂等操作(清空一个已经是空的对象,不产生任何可观测差异)。也就是说,在本任务的架构下,这个守卫**在语义上确实是多余的**——它不像 Vue2 里那样保护"首帧不要打断某些已经存在的状态"(因为 New-UI 首帧压根没有任何预先存在的状态可保护),纯粹是照抄 Vue2 结构以保持逐行可比对性的产物。**保留代码**(与 Vue2 逐行对应,防御未来若有人在 if 块里加入非幂等副作用),但**如实报告这条删码验证不可证伪**,不去为它编造一条实际上验证的是别的东西的假测试。

### ⑧「Esc 早退」的两轮验证记录(重要:guard 被 guard 遮蔽的真实案例)

第一轮(朴素集成测试:开 date 弹层 + 打开保存弹层,一次 Escape,断言两个 DOM 都消失)删掉早退后**没有变红**——回源发现:`SearchSaveSmartView.vue` 自己也注册了一份独立的 `document` 级 `keydown` 监听器(其 `watch(open)` 挂载,见该组件文件头 fix round 1 · I1 的既有实现),一次真实的 `Escape` keydown 事件会**同时**命中宿主的 `onDocKeydown` 与子组件自己的 `onDocKeydown`——即便宿主的分支提前 `return`、根本没碰 `saveOpen`,子组件自己仍会调用 `close()` → `emit('update:open', false)` → 宿主的 `v-model:open="saveOpen"` 联动把 `saveOpen` 置假。**两个浮层的 DOM 结果相同**,这条朴素集成测试对"宿主是否违反禁止早退"这条硬约束**不可证伪**。

修法:加了第二条隔离测试,把 `SearchSaveSmartView` 替身成一个**没有自身 Esc 处理、也不 emit `update:open`** 的纯 `v-if` 桩组件(只认 `open` prop),这样"谁把 `saveOpen` 关掉"这件事就只能是宿主自己的 `onDocKeydown`。这条隔离测试**真的红了**(实测确认,详见测试文件 `views/__tests__/PhotosSearch.test.ts` 里的两条相邻用例 + 就近注释)。这是本任务实测撞上的第五次「两个守卫叠在同一路径上」失效模式(P5-T10 教训清单的同类延续),已如实记录、修正、双处登记(测试文件注释 + 本报告)。

## 三处挂账的兑现情况

1. **T6「在搜索中细化」按钮**:去 `disabled`、去 `title`、去 TODO 注释,接
   `router.push({ path:'/photos/search', query:{ q: sv.name } })`。T6 原断言改成
   「不再 disabled + 点击后 push 参数正确」;`photosSvSearchPending` 从两个 locale 删除
   (grep 确认代码零残留引用,仅测试标题/反向断言里还提及该字符串本身)。
2. **灯箱 OCR 激活**:`@open` 处理器第四参传当前 `query`,详见上方「E3 核查结论」。
3. **D12「保存为智能视图」宿主接线**:`.save-smart` 触发按钮(本任务实现,含 `[data-saved]`
   态视觉)+ `SearchSaveSmartView`(T14 已建的真实 `createSmartView` 调用)+ `ignoreEl`
   传递,`saved` 态在换词后正确复位(§7e-14)。

## 测试与结果

- `pnpm exec vitest run src/photos/components/__tests__/PhotosSearchBar.test.ts` → 10/10 通过。
- `pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts` → 49/49 通过。
- `pnpm exec vitest run`(全量)→ **315 files / 3655 tests 全绿**。
- `pnpm exec vue-tsc --noEmit` → 无输出(通过)。唯一一次类型错误(`Photo.takenAt` 是
  `string | number | null`,`dateInRange` 需要 `string | null | undefined`)已修复,写法照
  `peopleView.ts:330-337` 的既有先例(`String(...)` 兜底,已在代码里就近注释)。

## TDD Evidence

**RED**(真实首次运行,含删码验证的多轮 RED,以下摘录关键几条真实抓取的输出原文):

```
 FAIL  src/views/__tests__/PhotosSearch.test.ts > 路由 query 驱动 > q 改成 "def" → 再调一次,且 clearAll 生效(chip 过滤被清)
AssertionError: expected 'true' to be 'false'
```
```
 FAIL  src/views/__tests__/PhotosSearch.test.ts > filters.album > 快速切两个相册的 seq 守卫:旧响应(慢)不覆盖新响应(快)
AssertionError: expected 'mock://thumb/x/small' to contain '/y/'
```
```
 FAIL  src/views/__tests__/PhotosSearch.test.ts > @open → 灯箱 OCR 激活 > openAt 第四参是当前 query,第二参是 sortedResults 映射出的 photo 数组
AssertionError: expected undefined to be 'receipt'
```
```
 FAIL  src/views/__tests__/PhotosSearch.test.ts > 浮层:Esc 统一治理 > （隔离子组件兜底后)宿主自身的 onDocKeydown 两个分支都不早退
AssertionError: expected true to be false
```

**GREEN**(命令:`pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts`):
```
 Test Files  1 passed (1)
      Tests  49 passed (49)
```

**全量 GREEN**(命令:`pnpm exec vitest run`):
```
 Test Files  315 passed (315)
      Tests  3655 passed (3655)
```

## Files Changed

- `src/photos/components/PhotosSearchBar.vue`(新建)
- `src/photos/components/__tests__/PhotosSearchBar.test.ts`(新建)
- `src/views/PhotosSearch.vue`(新建)
- `src/views/__tests__/PhotosSearch.test.ts`(新建)
- `src/router/index.ts`(追加路由)
- `src/views/Photos.vue`(挂搜索框)
- `src/views/__tests__/Photos.integration.test.ts`(补搜索框接线用例)
- `src/views/PhotosSmartViewDetail.vue`(细化按钮接线)
- `src/views/__tests__/PhotosSmartViewDetail.test.ts`(改断言 + 死键反向断言)
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`(删 `photosSvSearchPending`)

## Self-Review Findings

- 渲染项清单、两条腿审计:已完成,见上方对照表。
- 每处偏离已双处登记(代码注释 + 本报告)。
- 5 个弹层均 `v-if` 挂载(E8);`ignoreEl` 已传(E7);people 排序已做(E7)。
- 注释三禁(不出现字面 hex/rgba、不出现 `<style>`/`<script>` 子串):已核对,
  `pnpm exec vitest run src/styles/color-guard.test.ts` → 460/460 通过。
- 测试输出无噪声:`Photos.integration.test.ts`/`PhotosSmartViewDetail.test.ts` 里的
  "Not implemented: navigation" jsdom 报错**在本任务改动前就已存在**(已用 `git stash`
  验证过,非本任务引入),不属于本任务需要清理的噪声。

## Concerns

- 删码验证②(首帧不清守卫)在当前架构下不可证伪,已如实分析并保留代码(见上文专门说明)。
- Vue2 的 save-toast + 「在智能视图中打开」链接未复刻(登记为范围收窄,brief 结构规格
  1-23 全文未要求),如需要可作为后续小任务补上。
- 真机验收清单(brief 文末,非本任务硬性要求但供参考)中第 13/15/19 条(耗时是否合理、
  OCR 高亮几何对齐、搜索失败态)依赖真实后端数据,jsdom 单测无法覆盖,需真机验收补齐。

---

# Fix Round 1(评审:Spec ❌ / 0 Critical + 8 Important + 11 Minor,并入 6 条 Minor,共 14 项)

## 处理范围

只动本轮点名的 14 项(I1-I8 + 并入的 M9/M10/M11/M12/M13/M15)+ 附带的登记要求。未碰
`albums.ts`/`people.ts`/`color-guard.test.ts`/`cssCascade.ts`/T1-T15 的其它文件。i18n 只
追加了 I3 要求的那一个新键(两个 locale 文件末尾各一行,未重排既有键)。

## 逐条处理记录

### I1(Important,真实功能缺陷)搜索历史在主入口根本不写 —— 已修

**根因**:`Photos.vue`(顶部搜索框)与 `PhotosSmartViewDetail.vue`(在搜索中细化)都只
`router.push`,不写 `nimo_search_history`——因为历史写入逻辑原来锁在
`PhotosSearch.vue` 自己的 `submitQuery()` 里,只有从这个页面自己的搜索框提交才会走到。

**改法(按控制器裁定)**:历史写入从 `submitQuery()` 挪进主 `query` watcher(非空分支,
`PhotosSearch.vue:285-318`,fix round 2 · Minor#3 已按最终文件重新核对行号)——「到达
时记录」而不是「提交时记录」,天然覆盖任何让路由带着非空 `q` 到达这个页面的入口(含深链、
浏览器前进/后退)。**偏离登记**已写进该 watcher 上方的代码注释(:296-300),原文摘录见上
一段「偏离登记(相对 Vue2 的可观察差异…)」;上一轮这里错误地指了一个本报告里不存在的
「偏离登记新增」小节,fix round 2 已改正为直接指代码位置,不再指向虚构的小节名。

**测试**:`views/__tests__/PhotosSearch.test.ts`「搜索历史」describe 新增一条——直接以
带 `q` 的地址挂载(模拟从别处 push 过来 / 深链到达),断言历史里确实写入了这个词。原有
的 `onSubmit` 路径三条用例因为写入时机从"同步"变成"跟随 `router.replace` 的异步导航"
补了 `await flushPromises()`(生产行为不变,只是测试要多等一次)。

**回归确认**:改完后 `filters.album` 的跨 id seq 场景、既有 clearAll/saved 复位等用例
仍绿(见下方全量结果)。

### I2(Important,真实功能缺陷)相册过滤会被打成永久空集 —— 已修(结构性重设计)

**根因**:`albums.ts:81` 的 `fetchAlbumAssets` 第一行 `if (isLoadingAssets(id)) return`——
同一个 id 的请求还在飞行中时再次调用会立即 resolve、不带数据。旧实现用
`fetchAlbumAssets(id).then(...)` 写快照 + `albumSeq` 计数器,只挡得住跨 id 竞态,挡不住
评审给出的同 id 重入竞态(选 A 在途 → 取消 → 再选 A → 被短路的调用把 `albumAssetIds`
写成永久空 Set)。

**改法(结构性消除,不是打补丁)**:把 `albumAssetIds` 从"由某一次 promise resolve 写入
的 ref 快照"改成"直接读 `albums.assetsOf(当前选中相册 id)` 的 computed"
(`PhotosSearch.vue:350-360`)。`fetchAlbumAssets` 的调用降级为一个纯触发副作用的独立
watcher(:361-369),不再负责写任何本地状态——不管中途发生多少次被短路、不带数据的调用,
只要"第一次真正在途的请求"最终把数据写进 `albums.albumAssetsByID`,computed 下次求值
就自动读到最新数据。跨 id 竞态(原 `albumSeq` 挡的那种)也因此结构性免疫,不需要计数器。

**测试**:`filters.album` describe 新增「同一相册重入竞态(选 A 在途 → 取消 → 再选 A)
不会把结果打成永久空集」,逐字复现评审给出的完整时序。

**变异验证(真实抓取)**:临时把新设计还原成旧的"promise + 计数器"手法,该条用例立即变红
(`AssertionError: expected [] to have a length of 1 but got +0`);换回新设计后绿。**跨
id seq 守卫用例(「快速切两个相册」)与「相册名查不到 id」用例在新设计下依然全绿**——
已确认没有打破既有覆盖。

### I3(Important)搜索框 placeholder 用错了句子,还和正下方的 h2 撞词 —— 已修

**根因**:`PhotosSearchBar.vue` 第一版用了 `photosSearchSearchLibrary`(="搜索你的资料
库"),但那句其实是 Vue2 预搜索态的 `<h2>`(`PhotosSearchView.vue:6`),不是 Topbar 输入框
的占位符;真实占位符("Search photos, people, places, or describe in a sentence…",
`PhotosTopbar.vue:19`)i18n 表里原本没有对应键。

**改法**:回源 `NimoOS-UI/src/assets/lang/zh_CN.json:2405` / `en_US.json:2324` 查出原文
对应译文,新增键 `photosSearchSearchBarPlaceholder`(追加在 `zh_cn.ts`/`en_us.ts` 末尾,
未重排任何既有键),`PhotosSearchBar.vue` 改用这个新键。

**测试**:`PhotosSearchBar.test.ts` 的 placeholder 用例改成断言新键的值,并反向断言不等于
`photosSearchSearchLibrary`(防止再抄错这一个键)。

### I4(Important,plan-mandated)新增内联 svg 全无 d 断言 —— 已修

给本任务新增的全部 9 枚内联 svg(`PhotosSearchBar.vue` 的 search 图标 1 枚 +
`PhotosSearch.vue` 的 8 枚:预搜索态 search chip、5 个筛选 chip 图标 clock/person/map
(2 条 path)/album/video、save-smart 的 sparkles + check)逐一补 `d` 属性断言,值从 Vue2
`PhotosIcon.vue` 逐字符核对。

**变异验证(真实抓取)**:抽 clock 与 map 两枚改坏 `d` 值——对应两条用例立即变红
(`AssertionError: expected 'M12 7v5l3 9' to be 'M12 7v5l3 2'` / map 的两条 path 数组
断言同样报差异);改回后全绿。

### I5(Important,plan-mandated)零 cssCascade hover 断言 + 零非颜色属性锚定 —— 已修

补了三组 `winningHoverBackground` 断言:
- `.results-bar .sort button[data-active='true']:hover`
- `.save-smart[data-saved='true']:hover`
- `.search-prestate .prestate-chip:hover`(后代选择器,`classes` 参数需要把选择器链上
  出现的**两个**类名都传进去——`cssCascade.ts` 的匹配逻辑是"选择器里出现的每个 class
  都必须在允许集合内",不是结构化的后代关系判定,这里第一次踩到这个用法细节,已在测试
  注释里记录清楚,供后续任务复用同一模式时参考)。

以及补了非颜色视觉属性锚定断言(先锚定规则体再断言属性):`.search` 高度 34px
(`PhotosSearchBar.test.ts`)、`.search-prestate .nimo-orb`/`.empty-search .nimo-orb` 的
68×68、`.empty-search .conditions .fchip` 紧凑高度 26px。

**变异验证(真实抓取)**:删掉 `.sort button[data-active='true']:hover` 与
`.save-smart[data-saved='true']:hover` 两条规则——前者报 `没有任何 background 规则命中
.sort`(因为剩下唯一带 background 的规则没有 `:hover`),后者报
`expected '.save-smart:hover' to contain 'data-saved'`。两条都改回后绿。

### I6(Important,plan-mandated,评审变异实测)type 过滤三分支是恒真用例 —— 已修

原用例从未设置过 `filters.type`,只断言了"不过滤时 3 张都在"。改成三条真用例,各自通过
type chip 的弹层选中对应项(按 `TYPE_ITEMS` 固定下标 0/1/2)、Apply,断言只剩预期的那
一张。

**变异验证(真实抓取)**:把三个分支的谓词全部取反(`!isVideo && !hasOcr` → `isVideo ||
hasOcr` 等),三条用例全部变红(各自报"expected length 1 but got 2");改回后绿。

### I7(Important,plan-mandated)「相册名查不到 id → 空集」用例断的是相反的事 —— 已修

原用例最终断言 `toHaveLength(2)`,断的是"不过滤",与 brief 要求的"空集"相反。改法:
先正常选中一个相册、Apply、确认按相册资产收窄生效(1 条);再把 `albums.albums` 清空
(模拟相册在别处被删除)——I2 的 computed 重设计让这一步不需要任何额外触发,`albums.
albums` 一变,`albumAssetIds` 自动重新求值,查不到 id 后退化成空集,断言收窄到 0。

**变异验证(真实抓取)**:把 computed 里"查不到 id"分支的 `return new Set()` 改回
`return null`(=不过滤),用例立即变红(`expected 2 to have a length of +0 but got 2`
方向的断言失败);改回后绿。

### I8(Important)两处「修了 Vue2 缺陷但没登记」—— 已补登记

①`anyFilter` 含 `album`(Vue2 `:561` 不含,导致只选相册时「清除全部」按钮不出现)
②`activeConditions` 的 date 兜底从 Vue2 硬编码英文 `'Date'` 改成 `t('photosSearchDate')`。
两处都在 `PhotosSearch.vue` 对应代码上方补了登记注释(:414-419 / :436-438,
fix round 2 · Minor#3 已按当前最终文件重新核对过这两处行号,上一轮报告写的
`:343-346`/`:356-360` 是错的)。

## 并入的 6 条 Minor —— 处理记录

- **M9**(已修 + 断言):`realPeopleList` 排序补了真断言(2 个不同计数的人,断言弹层
  渲染顺序)。**变异验证**:把 `.sort((a,b)=>b.count-a.count)` 反过来,用例变红
  (`expected ['Low','High'] to equal ['High','Low']`);改回后绿。
- **M10**(已修 + 断言):`ignoreEl` 补了行为断言(在 save-smart 按钮上派发裸
  `mousedown`,断言不会误关保存弹层)。**过程中发现并修了一个测试基础设施问题**:
  `mountSearch()` 之前没有 `attachTo`,组件树是一棵游离于真实 `document` 之外的 DOM,
  `element.dispatchEvent(..., {bubbles:true})` 永远到不了 `document` 上的监听器——
  第一次跑这条用例时,删掉 `:ignore-el="saveBtnRef"` 后用例**仍然绿**(不是断言错了,
  是事件压根没送到)。改法:`mountSearch()` 默认挂进 `document.body`(先例见
  `Photos.lightbox.test.ts` 一类的既有手法),并在 `afterEach` 里显式 `unmount()` +
  移除容器(触发各子组件的 `onUnmounted`,摘掉它们各自的 `document` 级监听器,避免
  70 个用例跨测试残留监听器/DOM 节点)。**变异验证(真实抓取)**:去掉 `ignoreEl` 后,
  这次真的红了(`expected false to be true`);加回后绿,且全量 70/70 仍绿。
- **M11**(已修 + 断言):`openAt` 第二参补了顺序断言(两条分数不同的结果,relevance
  排序下断言 id 顺序是 `['high','low']`,不是原始插入顺序)。**变异验证**:把
  `sortedResults` 换成 `filteredResults`(未排序),用例变红
  (`expected ['low','high'] to equal ['high','low']`);改回后绿。
- **M12**(已修):`.nimo-orb` 补回 `flex-shrink: 0`(Vue2 photos.scss:876)。
- **M13**(已修,三处全部改回 Vue2 字面值,不是登记理由后保留):`.search` padding
  改回 `0 12px`(Vue2 `:229`);`.empty-search .conditions .fchip` padding 改回
  `0 12px`(Vue2 基类 `.fchip`)。`.photos-search-bar` 外层容器的 `4px 4px 14px`
  **无 Vue2 对应**(New-UI 把搜索框拆成独立组件后自己需要一层外壳留白)——保留,但把
  登记写清楚了(见 `PhotosSearchBar.vue` 样式块注释)。
- **M15**(已修):`submitQuery()` 补了"同词重提交"捷径——目标词与当前路由 `q` 完全
  相同时不走 `router.replace`(同路由无导航,watcher 不会重新触发),直接补一次
  `search.smartSearch(q)`,让"同一个词再按一次 Enter"也能强制重搜。

## 挂账未动的 5 条(M14 已顺手清理,不在挂账之列)

- M14:`locale` 死变量——已顺手删掉(`useI18n()` 改成只解构 `t`),不必单独验(纯清理,
  删除后 tsc 会因为找不到未使用变量的引用而立刻暴露任何遗留用法,不需要额外测试)。
- M16/M17/M18/M19:按控制器指示挂账给终审,未改代码。**M19 补充登记**(报告要求)：
  `clearAll()` 目前不会清空"当前正打开的那个弹层"内部的搜索框文本(Vue2 `:757-761`
  会清 `peopleSearch`/`popSearch`)——本设计下弹层内部搜索框状态只在 `v-if` 重新挂载
  时才会回到初始值,`clearAll()` 只重置 `filters`,不触发挂载/卸载,如果用户在弹层
  开着的时候点"清除全部",弹层内的搜索框文字会保留。已挂账,不在本轮修复范围内。

## 评审另查实的 5 处 brief/E 错误 —— 已抄录

①brief 结构规格 1 的 placeholder 键用错了语义(E1 只校了拼写没校语义,见 I3)
②brief 结构规格 16 把历史写入锁死在搜索页 `onSubmit`,与 Vue2「所有入口汇流」的结构
不符,直接导致 I1
③brief 结构规格 18 漏了「Vue2 anyFilter 不含 album」这处缺陷,导致修对了却不知道要
登记(I8)
④brief 的 Interfaces 骨架 `(e:'exit')` 与结构规格 5「不建」自相矛盾——按结构规格执行
是对的(T16 报告 E-note 已登记,本轮沿用)
⑤E4 提了 `isLoadingAssets` 的存在,但没提醒它会让 promise 无数据地立即 resolve,直接
催生 I2。

## 测试与结果(命令 + 当次真实抓取的输出原文)

```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSearchBar.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts
 Test Files  1 passed (1)
      Tests  70 passed (70)
```

```
$ pnpm exec vitest run
 Test Files  315 passed (315)
      Tests  3678 passed (3678)
```
(唯一的 stderr 噪声是 jsdom 的 "Not implemented: navigation" 与 favorites.ts 的
`exportZip`——两者均为本任务改动前就已存在的既有噪声,已用 `git stash` 在 T16 首次报告
里验证过一次,本轮未引入新的噪声来源。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  460 passed (460)
```

## 变异验证清单汇总(本轮要求的 8 条,逐条确认 RED→revert→GREEN)

| # | 变异内容 | 结果 |
|---|---|---|
| I2 | 还原成"promise+计数器"手法 | 红→改回绿 |
| I4 | 改坏 clock 与 map 的 `d` | 两条均红→改回绿 |
| I5 | 删掉 `.sort`/`.save-smart` 的 `[data-*]:hover` 变体 | 两条均红(一条报错、一条断言失败)→改回绿 |
| I6 | 三个 type 分支谓词取反 | 三条均红→改回绿 |
| I7 | "查不到 id"分支改成不过滤 | 红→改回绿 |
| M9 | people 排序反过来 | 红→改回绿 |
| M10 | 去掉 `:ignore-el`(过程中顺带修了 `mountSearch` 缺 `attachTo` 的测试基础设施问题) | 红→改回绿 |
| M11 | `openAt` 第二参换成 `filteredResults` | 红→改回绿 |

**逐个都单独做、Edit 手工验证后还原(未用 `git checkout --`)。**

## Files Changed(本轮)

- `src/views/PhotosSearch.vue`(I1/I2/I8/M9/M12/M13/M15 的源码改动 + 大量补登记注释)
- `src/photos/components/PhotosSearchBar.vue`(I3 placeholder 键、M13 padding、M14 死
  变量清理、注释更新)
- `src/views/__tests__/PhotosSearch.test.ts`(I1/I2/I4/I5/I6/I7/M9/M10/M11 的测试新增
  与改写,`mountSearch` 补 `attachTo` + `afterEach` 清理)
- `src/photos/components/__tests__/PhotosSearchBar.test.ts`(I3/I4/I5 的测试新增与改写)
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`(I3 追加 `photosSearchSearchBarPlaceholder`
  一个键,两个文件末尾,未重排)

## Self-Review(本轮)

- 通读了改动过的两个组件文件,确认注释所述与代码真实行为一致,按最终文件重新核对了
  行号引用(`PhotosSearch.vue` 内部自引用的行号已按当前文件重新核对;引用 Vue2 源码的
  行号未变,不受本轮编辑影响)。
- 8 条要求变异验证的项目全部逐一做了 RED→改回→GREEN 的真实确认,过程中额外发现并修
  了一处测试基础设施问题(M10 揭示的 `attachTo` 缺失)。
- 只碰了本轮点名的文件,未改 `albums.ts`/`people.ts`/`color-guard.test.ts`/
  `cssCascade.ts`,i18n 只追加了 I3 的一个键。

---

# Fix Round 2(评审:fix round 1 十四项全部 ADDRESSED,但引入 1 条新回归;共 4 项)

## 处理范围

只动本轮点名的 4 项(Important#1 + Minor#2/#3/#4)。未碰 `albums.ts`/`people.ts`/
`color-guard.test.ts`/`cssCascade.ts`/T1-T15 其它文件;**i18n 本轮零改动**。

## Important #1 —— 相册过滤在途窗口把结果打成 0,「无匹配」空态闪现 —— 已修

**根因(fix round 1 引入的新回归)**:`albumAssetIds` 是 computed,直接读
`albums.assetsOf(id)`——但这个方法在**缓存槽压根没建立**(请求在途 / 还没发起)和**缓存
槽已建立、内容恰好是空数组**(相册真的没有照片)两种情况下,返回值都是同一个 `[]`,
computed 没法区分。选相册 Apply 的那一刻,请求通常还没落地,`filteredResults` 因此瞬间
归零,`.empty-search`(80px padding 的"无匹配"大块内容)会在请求飞行的这段窗口里整块
闪现——这是"首次按相册过滤"的**常规路径**,不是极端时序,且 fix round 1 的所有相册
测试都因为 mock 设成立即 resolve 或者显式 `await flushPromises()` 之后才断言,天然
跳过了这个窗口,完全没有测试覆盖到过。

Vue2 `PhotosSearchView.vue:593-602` 的 `albumAssetIds` 在途期间保持旧值(选中的瞬间是
`null` = 不过滤,`getAlbum` 落地后才真正收窄)。

**改法(评审给出、控制器认可 —— 同时保住 I2 的两条竞态免疫)**:把"缓存槽不存在"
(`!(String(id) in albums.albumAssetsByID)` ⇒ 在途/未拉,不过滤)和"缓存槽已经落地"
(⇒ 精确收窄,哪怕收窄出来是空集)显式区分开(`PhotosSearch.vue:373-380`)。**关键点
在于用 `in` 判断键是否存在,不能用 `assetsOf(id).length === 0` 判断**——`in` 只看
`fetchAlbumAssets` 是否已经在它的 `finally` 里写过这个相册的槽(无论成功失败、无论
结果是不是空数组都会写),而 `.length === 0` 分不清"还没写过"和"写过但确实是空"。
这一区分点在代码里做了两处登记:一处在 `albumAssetIds` computed 上方的大段注释里说明
"为什么不能只用 assetsOf 的长度判断",另一处就是这份报告本段落。

**测试**:`filters.album` describe 新增「相册过滤在途窗口(getAlbum 尚未 resolve)不应
把结果打成空集 / 闪现空态」——选中相册 Apply 后、`getAlbum` 的 mock promise 故意先不
resolve,断言此刻 `.empty-search` 不存在且 `.tile` 数量不变;随后手动 resolve,断言
落地后精确收窄。

**变异验证(双方向,真实抓取)**:
①把区分逻辑去掉(回到"缓存槽是否存在都无所谓,统一读 assetsOf")——**新增的在途用例
立即变红**(`AssertionError: expected true to be false`,`.empty-search` 在在途窗口
里意外出现了),同时**既有的另外 4 条相册测试(正常收窄 / 查不到 id / 同 id 重入 /
跨 id seq)在这个被还原的"错误版本"下依然全绿**(逐个跑过,4 passed | 1 failed,
符合评审要求的"确认②"——证明这几条既有用例本身没有意外依赖这个 bug)。
②改回区分逻辑后,`filters.album` describe 全部 5 条一次性全绿。

## Minor #2 —— 清理契约有漏洞 —— 已修

`PhotosSearch.test.ts` 里"浮层:Esc 统一治理"下的「隔离子组件兜底」用例是直接
`mount()`,不经过 `mountSearch()` 助手,不会被 `afterEach` 里遍历 `mountedInstances`
的清理逻辑覆盖到;而 `mountSearch()` 头部注释此前宣称"每次挂载"都会被这个数组记录,
与事实不符。

**改法**:①把 `mountSearch()` 头部注释改准确——只覆盖经由这个助手函数的挂载,并指明
另一处裸 `mount()` 会在自己的用例末尾单独清理 ②在「隔离子组件兜底」用例末尾补一行
`w.unmount()`,不依赖"这条用例结尾恰好把两个浮层都关掉了、监听器已经自然摘除"这个
前提——即便未来这条用例改成只关一个浮层就结束,组件也会被显式卸载,不会把 `document`
级监听器与一棵活组件树留给后续用例。

## Minor #3 —— 一簇注释/报告的行号与先例引用不准 —— 已改正

- `PhotosSearch.test.ts` 里"先例见 `Photos.lightbox.test.ts` 一类"是错的(回源 grep
  该文件全文没有 `attachTo`/`document.body`)——改正为真实先例
  `ClusterActionDialog.test.ts:52` / `PersonHero.test.ts:50` /
  `PlacesThemeMenu.test.ts:33`(已逐个 grep 确认三者确实都用 `attachTo: document.body`
  + 模块级数组记录挂载实例的同款手法)。
- `PhotosSearch.vue` 里 `.nimo-orb` 的 `flex-shrink: 0` 引用从 `photos.scss:876` 改成
  `875`(已用 `sed -n '875p'` 核对确实是那一行)。
- `.empty-search .conditions .fchip` 的 padding 引用从"Vue2 基类 `.fchip`
  (photos.scss:2617)"改成"photos.scss:2622-2623"(`2617` 实际是 `.filterbar` 的
  `z-index: 6`,`.fchip` 基类规则体从 `2622` 的 `.fchip {` 开始,`padding: 0 12px`
  在 `2623`——已用 `sed -n '2608,2625p' | cat -n` 逐行核对)。
- `PhotosSearch.vue` 头部"改成从 albums store 现读的 computed(定义在 realAlbumItems
  附近)"改成准确说法——`realAlbumItems` 在 `:141`(fix round 3 · #3 自查发现上一轮报告
  这里也写错了一位,`:140` 是空行,已改正),`albumAssetIds` computed 实际在 `:373`
  附近(随后续改动继续漂移,以最终文件为准),两者相隔约 230 行,不在"附近"。
- 本报告(`task-16-report.md`)fix round 1 段落里 I8 的行号引用 `:343-346`/`:356-360`
  是错的,已按最终文件改正为 `:414-419`/`:436-438`;fix round 1 段落里指向"本报告见
  下方『偏离登记新增』"的一处也是错的(报告里根本没有这个小节名)——已改成直接引用
  代码位置 + 说明登记内容其实就在同一段落里,不再指向虚构的小节。

**本轮新增的代码/报告内容在写入时已按当次真实核对过行号**(`albumAssetIds` computed
在 `PhotosSearch.vue:373`,`Important#1` 的登记注释从 `:355` 开始),避免重蹈"边改边引
用旧行号"的覆辙。

## Minor #4 —— M15 零覆盖 —— 已补

`路由 query 驱动` describe 新增「同一个词再提交一次(M15)→ smartSearch 被再调一次,
不会因路由不变而静默失效」——先挂载一次(`smartSearch` 调用 1 次),再通过
`PhotosSearchBar` 提交同一个词,断言 `smartSearch` 被调用 2 次且第二次参数仍是同一个词。

**变异验证(真实抓取)**:删掉 `submitQuery` 里"目标词与当前路由 q 相同则直接
smartSearch"这条捷径,用例立即变红(`expected "wrappedAction" to be called 2 times,
but got 1 times`);改回后绿。

## 测试与结果(命令 + 当次真实抓取的输出原文)

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts -t "filters.album"
 Test Files  1 passed (1)
      Tests  5 passed | 66 skipped (71)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts
 Test Files  1 passed (1)
      Tests  72 passed (72)
```

```
$ pnpm exec vitest run
 Test Files  315 passed (315)
      Tests  3680 passed (3680)
```
(唯二 stderr 噪声仍是既有的 jsdom "Not implemented: navigation" 与
`favorites.ts` 的 `exportZip`——两者均为本任务改动前就已存在,本轮未引入新噪声。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  460 passed (460)
```

## 变异验证清单汇总(本轮)

| # | 变异内容 | 结果 |
|---|---|---|
| Important#1(方向①) | 去掉"缓存槽是否存在"的区分,回到统一读 `assetsOf` | 新增的在途用例红;既有 4 条相册用例仍绿(确认②) |
| Minor#4 | 去掉 `submitQuery` 里的同词捷径 | 红→改回绿 |

## Files Changed(本轮)

- `src/views/PhotosSearch.vue`(Important#1 的 computed 重设计 + Minor#3 的行号/引用
  改正)
- `src/views/__tests__/PhotosSearch.test.ts`(Important#1 的在途用例、Minor#2 的清理
  修复、Minor#3 的先例引用改正、Minor#4 的同词捷径用例)
- `task-16-report.md`(Minor#3 点出的两处报告自身错误已改正,即本次追加内容里体现的
  行号修正)

## Self-Review(本轮)

- Important#1 的两个方向变异验证都做了真实运行确认(不是只做了"改回绿"这一半)。
- Minor#3 涉及的所有引用在写入前都重新 `grep`/`sed` 核对过源文件,不是凭记忆改。
- 通读了 `PhotosSearch.vue` 全文一遍,确认新旧注释之间没有互相矛盾(如"albumAssetIds
  不再是 ref"这句仍然成立,只是内部多了一层槽位存在性判断)。
- 只碰了本轮点名的文件,i18n 零改动。

---

# Fix Round 3(评审:fix round 2 全部 ADDRESSED,零 Critical/Important 新破坏;最后 4 项)

## 处理范围

只动本轮点名的 4 项(#1 + #2 + #3 + #4)。未碰 `albums.ts`/`people.ts`/T1-T15 其它文件/
`color-guard.test.ts`/`cssCascade.ts`/`src/i18n/**`。

## 关于上一轮那条论证的定性(复审指出,记录不重复犯)

复审判定:「4 条既有相册用例在 buggy 状态仍全绿」这个观察只证明了"修复不是靠弱化既有断言
换来的"(零结果),**不能**当成"修复本身被验证过"的正面证据——真正的正面证据只有新增的
在途用例本身。这个区分以后写变异验证结论时要分清:「既有用例没被我的改动破坏」和「新行为
被某条用例钉住了」是两件事,不能互相替代。

## #1(要紧)`in` vs `.length` 判据零测试锁定 —— 已补测试锁

**问题**:上一轮修复的核心判据(`in` 判键是否存在,不是判长度)只被"在途窗口"这一条用例
间接覆盖,**没有任何用例专门断言"真实存在但资产为空的相册应该被过滤成空集"这条语义本身**。
复审变异把判据换成 `.length === 0` 后,fix round 2 发货的 72 例全绿——护栏缺口和 T15-I1
(glyph)、T16-I6(type 恒真用例)是同一类形态:实现对,但没有测试钉住这个具体分支。

**改法**:`filters.album` describe 新增「相册确实存在但资产为空(请求已落地)→ 结果为
空集 + 空态出现(不是在途误判)」——`getAlbum` 直接 `mockResolvedValue({assets: []})`
(立即落地,不是在途),断言 ①`getAlbum` 确实被调用过(排除"压根没发起请求"的假阳性)
②`.tile` 为 0 ③`.empty-search` 出现。

**变异验证(真实抓取,两个方向都做了)**:
- 把判据由 `!(String(id) in albums.albumAssetsByID)` 换成
  `albums.assetsOf(id).length === 0`——新用例立即变红
  (`AssertionError: expected [...(2)] to have a length of +0 but got 2`),**且此时
  完整跑一遍全文件,恰好只有这一条从绿变红(72 passed | 1 failed)**,证实这条判据
  确实只由这一条用例守着,别的用例不会替它背书。
- 改回 `in` 判据后,`filters.album` describe 全部 6 条(正常收窄 / 查不到 id / 同 id
  重入 / 跨 id seq / 在途窗口 / 本条新增的"落地空集")一次性全绿。

## #2 —— 一处引用错误(与 Minor #3 同一类)—— 已改正

`albumAssetIds` computed 上方的注释此前说 `fetchAlbumAssets`「无论成功失败都会**在
`finally` 里**写入这个相册的槽」——回源 `albums.ts:81-94`(现为 `:81-94`,函数体本身
未变):**成功路径的槽写入在 `try` 体(`:87` 的 `setAlbumAssets(id, raw.map(...))`),
失败路径在 `catch` 体(`:90` 的 `setAlbumAssets(id, [])`);`finally`(`:91-93`)只做
`setAssetsLoading(id, false)`,完全不碰这个槽**。结论(成功/失败都会落槽,只有真正没
发起过/没完成的请求才不落槽)本身是对的,只是"落在哪一步"这句话说错了——已按
`albums.ts` 真实代码位置改正(`PhotosSearch.vue` 注释 + 本报告同一句话)。

## #3 —— 两处 off-by-one + 一处健壮性 —— 已改正

- `PhotosSearch.vue` 里 I8 引用 Vue2 `anyFilter` 的 `:561` 改成 `:562`(用
  `cat -n`/`sed -n` 核对过 Vue2 `PhotosSearchView.vue`:`:561` 是
  `const f = this.filters`,枚举那行 `return !!(f.date || ...)` 在 `:562`)。
- 本报告(`task-16-report.md`)fix round 2 段落里"`realAlbumItems` 在 `:140`"改成
  `:141`(`:140` 是空行)。
- **本轮自查还额外发现一处上一轮遗留的同类错误**(不在评审这次点名的清单里,是重新
  核对全部行号引用时顺带抓到的):`PhotosSearch.vue` 里 I2 段落引用
  「`albums.ts:81` 的 `if (isLoadingAssets(id)) return`」——回源核对 `:81` 实际是
  `async function fetchAlbumAssets(...)` 这行函数签名,`isLoadingAssets` 判断在
  `:82`。已改正(登记见下方"本轮自查新发现"一节)。
- `PhotosSearch.test.ts`「隔离子组件兜底」用例的 `w.unmount()` 从"用例体末尾单独一行"
  改成 `try { …全部断言… } finally { w.unmount() }`——不再依赖"前面的断言都不失败"这个
  前提,即使某条断言先抛错,`finally` 里的 `unmount()` 仍会执行,不会把组件树/document
  监听器残留给后续用例。`mountSearch()` 头部注释同步改成准确描述("try/finally 自己
  保证 unmount",不是"用例末尾单独一行")。

## #4(登记,不改逻辑)一条本轮新产生的与 Vue2 的可观察差异 —— 已双处登记

Vue2 `PhotosSearchView.vue:593-602` 的 `albumAssetIds` 在途期间**保留上一次的值**——
"相册 A 已落地(过滤生效)→ 切到相册 B、B 的请求还在飞行"这段窗口里,Vue2 **仍按 A
过滤**。New-UI 现在统一"缓存槽不存在就不过滤",同一窗口会**显示未过滤的全集**,不是
"继续按 A 过滤"。**首次选中相册两者行为一致**(都不过滤,因为都还没有可用的缓存值),
**只有"切换相册"这个子场景不同**。判断依据:从"不该用一个已经不再选中的相册去误导性地
过滤结果"的角度看,New-UI 的新行为更合理,但这确实是相对 Vue2 的一处可观察行为差异——
已在 `albumAssetIds` computed 上方补了一段代码注释(fix round 3 · #4),并在这里同步
登记进报告。

## 测试与结果(命令 + 当次真实抓取的输出原文)

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts -t "相册确实存在但资产为空"
（判据换成 .length===0 时)
 Test Files  1 failed (1)
      Tests  1 failed | 72 skipped (73)
AssertionError: expected [ DOMWrapper{ …(3) }, …(1) ] to have a length of +0 but got 2
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts
（判据换成 .length===0 时,跑整个文件)
 Test Files  1 failed (1)
      Tests  1 failed | 72 passed (73)
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts
（判据改回 in 之后)
 Test Files  1 passed (1)
      Tests  73 passed (73)
```

```
$ pnpm exec vitest run
 Test Files  315 passed (315)
      Tests  3681 passed (3681)
```
(唯二 stderr 噪声仍是既有的 jsdom "Not implemented: navigation" 与
`favorites.ts` 的 `exportZip`——两者均为本任务改动前就已存在,本轮未引入新噪声。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  460 passed (460)
```

## 变异验证清单汇总(本轮)

| # | 变异内容 | 结果 |
|---|---|---|
| #1 | `in` 判据换成 `assetsOf(id).length === 0` | 新用例红(其余 72 绿)→ 改回后 73/73 绿 |

## Files Changed(本轮)

- `src/views/PhotosSearch.vue`(#1 的语义登记补全 + #2/#3/#4 的注释改正与登记)
- `src/views/__tests__/PhotosSearch.test.ts`(#1 的新用例 + #3 的 try/finally 健壮性
  修复)
- `task-16-report.md`(#3 点出的报告自身错误已改正)

## Self-Review(本轮)

- #1 的两个方向都做了真实运行确认,且确认了"只有这一条用例会因这个判据变红"(不是
  混在一堆同时变红的用例里,分不清是不是巧合)。
- #2/#3 涉及的所有行号引用在写入前都用 `cat -n`/`sed -n` 重新核对过源文件,而不是凭
  上一轮的记忆继续抄。本轮自查过程中额外发现并改正了一处上一轮遗留、评审这次没有点名
  的同类行号错误(`albums.ts:81`→`:82`),按纪律一并登记。
- #4 的登记同时出现在代码注释与本报告,措辞一致(都说清楚"首次选中一致,切换不同,
  New-UI 更合理但确实是可观察差异")。
- 上一轮"既有用例仍绿"论证的定性问题已在本节开头记录,以后不再把"零结果"当成"正面
  验证"来写。
