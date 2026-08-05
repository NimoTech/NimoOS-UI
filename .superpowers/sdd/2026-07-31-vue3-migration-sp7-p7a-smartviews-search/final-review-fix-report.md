# SP7-P7a 整支终审 fix 波报告

分支 `sp7-photos`,起点 HEAD = `9ee4dd0`(整支终审已判「Ready to merge = With fixes,
零 Critical」,列了 6 项「真机验收前必须修」+ 1 行顺带)。本报告是**唯一一次终审 fix
波**的交付记录,之后只有一次 scoped 复审。

## 总览:7 项全部完成

| 项 | 状态 | 一句话 |
|---|---|---|
| F1 | 完成 | 保存为智能视图成功后接通 toast(5s + 跳转 pill),真实功能缺口补齐 |
| F2 | 完成 | 全支唯一裸 `toLocaleString()` 改跟 `localeTag`,补源文本守卫 |
| F3 | 完成 | 撤销删除失败此前静默丢整条智能视图,补 `.catch` + 失败 toast |
| F4 | 完成 | T15 指给终审的 7 处引用清扫,逐条回源核对更正 |
| F5 | 完成 | 日历周日起始不变量补测试锁(zh_cn 首项='日'),变异验证已跑红 |
| F6 | 完成 | `PhotosThreshSlider` 轨道高度补断言,变异验证已跑红 |
| F7 | 完成 | 详情页放大镜手柄孤例统一为 `m20 20-3.5-3.5` |
| 附 | 完成 | T14 报告里那条错误登记(:491-493)已改正 |

---

## F1:保存为智能视图缺成功反馈

**问题**:`onSaved(_id)` 只翻 `saved.value = true`,`useToast` 只接了 `SearchSaveSmartView.vue`
的失败路径(`confirm()` catch 里的 `toast.show(t('photosAlbumCreateFailed'))`),成功路径
零用户可见反馈。回源 `NimoOS-UI/src/views/Photos/PhotosSearchView.vue:806-812`
(`confirmSave()`)确认 Vue2 真值:成功后弹 5 秒 `.save-toast`(sparkles + 「"{name}" 已保存
为智能视图」+「在智能视图中打开 →」跳转链接,模板见 `:283-288`)。

**改动**:
- `src/photos/components/SearchSaveSmartView.vue`:`saved` 事件签名加第二参
  `name: string`(`emit('saved', created.id, trimmed)`)。
- `src/views/PhotosSearch.vue`:导入 `useToast`;`onSaved(_id, name)` 调
  `toast.show(t('photosSearchNameSavedSmartView', { name }), 5000, { label:
  t('photosSearchOpenSmartViews'), onClick: () => void router.push('/photos/smart-views') })`。
  `useToast` 的 `show(text, duration, action?: { label, onClick })` 第三参正是 T6 回收站
  撤销 pill 在用的同款签名(`src/stores/toast.ts:13-19`),1:1 映上。
- i18n 键 `photosSearchNameSavedSmartView` / `photosSearchOpenSmartViews` **无需新增**——
  grep 确认它们在 T9 已同时写进 `zh_cn.ts`(:1326/:1297)与 `en_us.ts`(:1323/:1294),
  只是此前零引用(终审用词边界正则普查出来的事实)。这次接上引用,i18n 文件本身零改动。

**偏离登记**:Vue2 跳转目标是 `#/photos`(它的智能视图与相册主页同一屏);New-UI 的智能
视图列表是独立路由 `/photos/smart-views`(T4 建、`router/index.ts:52` 的
`photos-smart-views`)。这是相对 Vue2 的**必要偏离**,已在 `PhotosSearch.vue` 的
`onSaved` 注释里登记。

**契约变更审计(`git diff` 里被删的每一行)**:
- `SearchSaveSmartView.vue`:`(e: 'saved', id: string): void` → 加第二参 `name: string`;
  `emit('saved', created.id)` → `emit('saved', created.id, trimmed)`。都是**扩展**(多带
  一个已有的本地变量),不是弱化。
- `SearchSaveSmartView.test.ts:167`:`expect(w.emitted('saved')).toEqual([['sv-abc']])` →
  `toEqual([['sv-abc', 'Sunset Trips']])`。**跟着契约走**:`name.value` 在 `open` 变真时
  被 `watch` 设成 `props.defaultName`(该用例传的是 `'Sunset Trips'`),用例没有改过名称
  输入框,所以第二参就是这个默认名——这不是弱化断言,是新增了一个必须精确匹配的字段。

**覆盖的测试**:
- `SearchSaveSmartView.test.ts`「成功:… saved 事件带 id」用例,断言改成两参。
- `PhotosSearch.test.ts` 新增「保存成功 → toast 被调(5s、文案含 name、action label 是
  跳转键),点 action 跳 /photos/smart-views」——同时验证 `toast.show` 的三个参数与
  `action.onClick()` 触发的 `router.push`。

---

## F2:全支唯一的裸 `toLocaleString()`

**问题**:`PhotosSearch.vue:696`(改动前行号)`filteredResults.length.toLocaleString()`
不跟 locale;其余 5 处调用点(`SmartViewSidePanel.vue`/`SmartViewCard.vue`/
`SearchPeoplePopover.vue`/`SmartViewCreateDialog.vue`/`PhotosSmartViewDetail.vue`)全部
传了 locale。本仓 locale 标识是 `zh_cn`/`en_us`(下划线,非合法 BCP-47)。

**改动**:`PhotosSearch.vue` 恢复 `useI18n()` 的 `locale` 解构(fix round 1 · M14 当时删
是因为确实没用到,不是"以后也不该用"),新增 `localeTag = computed(() =>
locale.value.replace('_', '-'))`(照 `SearchPeoplePopover.vue:59-63` 既定写法),调用点改成
`toLocaleString(localeTag)`。

**测试**:`PhotosSearch.test.ts` 新增两条:
1. 渲染态断言:1234 条结果 → `[data-test="results-count"]` 文本含
   `(1234).toLocaleString('zh-cn')`。
2. 源文本守卫:`expect(photosSearchRaw).toMatch(/toLocaleString\(\s*localeTag\s*\)/)`——
   照 `SearchPeoplePopover.test.ts:135` 收紧过的写法(旧正则 `/toLocaleString\(\s*\S+/`
   连裸调用都能匹配,因为 `)` 本身就是 `\S`,没写成那样)。

---

## F3:撤销删除失败会静默丢整条智能视图

**问题**:`PhotosSmartViewDetail.vue:343`(改动前)`onClick: () => { void
store.restoreSmartView(result as DeletedSmartView) }`——`store.restoreSmartView` 失败时
throw(`smartViews.ts:303-304`),`void` 把这个 throw 吞成未处理 rejection。真实时序:
删除 → `router.push` 已把用户送回列表页(该项已 splice 掉)→ 5 秒内点撤销 → 后端失败 →
界面毫无反应,这条智能视图永久从列表消失(后端其实还在,刷新才会重新出现)。同文件
`doDelete` 自己是规规矩矩的 try/catch + 失败 toast,只有这个 undo 回调漏了。

**改动**:`onClick` 里给 `store.restoreSmartView(...)` 加 `.catch`,失败时
`console.error('[photos-smartviews] undo delete', e)` + `toast.show(t('photosTrashRestoreFailed'), 4500)`。

**文案来源**:grep 全仓确认没有专门的"撤销智能视图失败"键;`photosTrashRestoreFailed`
(`'恢复失败'`/`'Restore failed'`)是 P3 回收站 `PhotosTrash.vue:121/171` 里同款"撤销恢复
失败"场景在用的键,duration 同为 4500,语义完全对得上,复用它,**未新增 i18n 键**。

**测试**:`PhotosSmartViewDetail.test.ts` 新增「撤销失败(restoreSmartView reject)→
console.error 记录 + 弹失败 toast,不抛未处理 rejection」——`svc.photos.createSmartView`
(`restoreSmartView` 的底层调用)mock reject,点撤销 action 后断言 `console.error` 被调、
`useToast().msg` 是 `photosTrashRestoreFailed`,且整个调用链 `resolves.not.toThrow()`。

---

## F4:7 处引用清扫(T15 指给终审,逐条回源核对)

全部在 `SearchResultTile.vue` / `SearchResultTile.test.ts` / `PhotosSearchGrid.vue` 的注释
里,**只改注释文本,不改代码逻辑**:

1. `.tile` 基本形态:`photos.scss:112-116` → **`:321-325`**(`:112-116` 实际是
   `.photos-root .app` 的 `font-family`/`font-size`/`line-height`,回源逐行核对确认)。
2. img 缩放悬停:`:117-118` → **`:327-328`**。
3. loose 6px:`:113` → **`:326`**。
4. `.tile` 的 3px:`photos.scss:112` → **`:323`**(两处引用同一改动,一并更正)。
5. `SearchResultTile.test.ts:206` 同上 → **`:323`**。
6. `SearchResultTile.test.ts:194` 引 `color-guard.test.ts:96` → **`:98`**(`:96` 实际是
   `if (HEX.test(bare) || FUNC.test(bare)) offenders.push(...)`,`:98` 才是
   `if (line.includes(';') || line.includes('}')) exempt = false`——回源 `grep -n`
   逐行核对确认)。
7. `PhotosSearchGrid.vue:106`「两条规则 4 个声明」→ **3 个**(`:300` 的
   `overflow-y`/`position` 两条 + `:301` 的 `width` 一条;算上全局 `.scroll { overflow-y:
   auto }`(`:98`)才凑得到 4,但 `.scroll` 不归在这两条规则体里,不能一起计数)。
8. `PhotosSearchGrid.vue:110-113` 隐藏效果主因:原文把主因写成 `display: none`、
   `scrollbar-width: none` 写成括号附带 → **改正:主因是 `scrollbar-width: none`**——
   `theme.css:3-6` 对 `*` 设了标准 `scrollbar-width: thin`,Chrome 121+ 起因此整体禁用
   `::-webkit-scrollbar` 定制,`display: none` 这条在这些浏览器上是死规则(本仓
   2026-07-22 真机结论,`LogsPane.vue:36-38` 已登记同一件事,这里引用同一条真机结论)。

**核对方式**:每一处都用 `grep -n`/`sed -n` 对 `NimoOS-UI/src/views/Photos/photos.scss`、
`src/styles/color-guard.test.ts`、`src/styles/theme.css`、`src/apps/console/LogsPane.vue`
逐行现抓,不是照抄终审给的表。

---

## F5:日历「周日起始」不变量补测试锁

**现状核实**:`src/photos/util/dateRange.ts:180` 现在的代码**已经是** `new Date(1970, 0,
4 + i)`(1970-01-04 确实是周日),逻辑本身没错——问题是**唯一的锚点测试**
(`dateRange.test.ts` 里 `expect(calDowLabels('en_us')[0]).toBe('S')`)没有区分力:英文窄
标签周六(Saturday)也是 `'S'`,如果这行改成 `3 + i`(整排右移一天,变周六起始),这条
断言照样绿,而 `calCells()` 用 `getDay()` 算前导空格是按周日起始的既有约定,一旦不一致,
日历里每个日期都会排在错误的星期列下。

**改动**:`dateRange.test.ts` 新增一条 `expect(calDowLabels('zh_cn')[0]).toBe('日')`——
中文窄标签不歧义(周日是「日」、周六是「六」),真正钉住"首项确实是周日"这条不变量。

**变异验证(已跑,真实抓取)**:把 `dateRange.ts:180` 的 `4 + i` 改成 `3 + i`:

```
$ pnpm exec vitest run src/photos/util/__tests__/dateRange.test.ts
 ❯ src/photos/util/__tests__/dateRange.test.ts (33 tests | 1 failed) 33ms
     × zh_cn 首项是"日"(周日),不是"六"(周六)——钉住周日起始不变量(fix 波 F5) 6ms

 FAIL  … > calDowLabels > zh_cn 首项是"日"(周日),不是"六"(周六)——钉住周日起始不变量(fix 波 F5)
AssertionError: expected '六' to be '日' // Object.is equality
Expected: "日"
Received: "六"

 Test Files  1 failed (1)
      Tests  1 failed | 32 passed (33)
```

只有新补的这条断言变红,旧的 `en_us` `'S'` 断言依然绿——印证了它确实没有区分力。
**已用 Edit 手工改回 `4 + i`**(未用 `git checkout --`)。

---

## F6:`PhotosThreshSlider` 轨道高度零断言

**现状**:`.sv-slider { height: 6px; ... }` 这条声明此前没有任何测试触碰。该组件被
`SearchSaveSmartView.vue`/`SmartViewCreateDialog.vue`/T6 三处复用,轨道高被改坏没人
接得住。

**改动**:在既有已锚定 `.sv-slider` 规则体的那条测试(`'.sv-slider 是 appearance:none 的
accent 渐变轨'`)里追加 `expect(rule?.body).toContain('height: 6px')`,不新开一条测试
(照终审要求"在既有那条已锚定规则体的断言里加")。

**变异验证(已跑,真实抓取)**:把 `PhotosThreshSlider.vue` 的 `height: 6px` 改成
`height: 16px`:

```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosThreshSlider.test.ts
 ❯ src/photos/components/__tests__/PhotosThreshSlider.test.ts (8 tests | 1 failed) 32ms
     × .sv-slider 是 appearance:none 的 accent 渐变轨,轨道高度 6px 4ms

AssertionError: expected '\n  appearance: none;\n  width: 100%;…' to contain 'height: 6px'
- Expected
+ Received
- height: 6px
+   appearance: none;
+   width: 100%;
+   height: 16px;
+   ...

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

**已用 Edit 手工改回 `height: 6px`**(未用 `git checkout --`)。

---

## F7:放大镜 glyph 孤例(顺带 1 行)

**核实**:grep 确认全仓放大镜手柄真值分布——`PhotosSearchBar.vue:75`、
`PhotosSearch.vue:573`、`PlaceCoverPicker.vue:170/177` 四处都是 `m20 20-3.5-3.5`,圆圈
参数 `cx=11 cy=11 r=7` 四处相同;唯独 `PhotosSmartViewDetail.vue:482`(当前行号,随本次
其它编辑略有偏移)是 `M21 21l-4.3-4.3`,全仓孤例。

**改动**:统一成 `m20 20-3.5-3.5`,并加注释登记(用户从详情页点「在搜索中细化」进搜索页,
前后两屏放大镜手柄长度此前会跳一下)。未新增测试(终审明确这是"1 行,顺带",不在需要
新补守卫的 5 项之列)。

---

## 附:T14 报告错误登记已改正

`task-14-report.md:491-493` 此前写「brief 圈进来的 `.save-toast` 在 D12 真建之后整套被
`useToast` 取代……本任务不迁移这套自绘 toast 样式是对的(改用真实 store + 通用
`useToast`)」——**前半句对,后半句不成立**:T14 当时确实真接了 `store.createSmartView`
(D12 的核心要求),但成功路径只是 `saved.value = true`,`useToast` 在该组件里**只接了
失败路径**,Vue2 那条 5 秒成功 toast 当时**没有任何等价物**接上,是真实功能缺口,不是
"用 useToast 等价替代了"。这条错误登记正是让后续三轮复审误判"这件事已经做过"的原因
(T9 建的两个 i18n 键零引用三轮都没被抓出来)。已改写该段,说明真相 + 指向本次 F1 的
补齐。

---

## 命令与测试结论(当次真实抓取)

```
$ pnpm exec vitest run
 Test Files  315 passed (315)
      Tests  3686 passed (3686)
   Duration  66.53s
```
(此前一次全量跑出现 `src/files/upload/persist.test.ts` 单测失败,是与本次改动完全无关的
文件〔files/upload 区,IndexedDB 持久化〕在并行全量跑下的跨用例污染——单独跑该文件
`pnpm exec vitest run src/files/upload/persist.test.ts` 14/14 全绿,随后整支重跑一次也
315/315、3686/3686 全绿,判定为既有的测试隔离噪声,与本次 fix 波无关,不当作回归。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,EXIT=0)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  467 passed (467)
```

## i18n 文件 diff 核查

`git diff --stat -- src/i18n/zh_cn.ts src/i18n/en_us.ts` 输出为空——F1 用到的两个键
(`photosSearchNameSavedSmartView`/`photosSearchOpenSmartViews`)T9 已经写好,本次只是
接上引用,**两个 i18n 文件本身零改动**,自然保持「追加在段末、零重排、零删除」的既有
性质不被破坏。

## 变更文件清单

- `src/photos/components/SearchSaveSmartView.vue`(F1:emit 契约)
- `src/photos/components/__tests__/SearchSaveSmartView.test.ts`(F1:断言跟契约走)
- `src/views/PhotosSearch.vue`(F1 onSaved 接 toast;F2 locale)
- `src/views/__tests__/PhotosSearch.test.ts`(F1/F2 新增用例)
- `src/views/PhotosSmartViewDetail.vue`(F3 undo catch;F7 glyph)
- `src/views/__tests__/PhotosSmartViewDetail.test.ts`(F3 新增用例)
- `src/photos/components/SearchResultTile.vue`(F4 注释更正)
- `src/photos/components/__tests__/SearchResultTile.test.ts`(F4 注释更正)
- `src/photos/components/PhotosSearchGrid.vue`(F4 注释更正)
- `src/photos/util/__tests__/dateRange.test.ts`(F5 新增守卫)
- `src/photos/components/__tests__/PhotosThreshSlider.test.ts`(F6 新增断言)
- `.superpowers/sdd/2026-07-31-vue3-migration-sp7-p7a-smartviews-search/task-14-report.md`
  (附:错误登记改正,gitignore 不进 git)

---

## Follow-up:scoped 复审回来后的两处注释订正(N1/N2)

scoped 复审结论:**F1-F7 七项全部 ADDRESSED,零新 Critical/Important,判「可以交用户
真机验收」**——6 次独立变异全部背书(含对 F2 的额外反向验证:把 `toLocaleString` 改回
裸调用后确认新守卫会红,并实证旧版 `\S` 正则在同一变异下不会红),F4 七处逐条 `sed`
现抓真值全部符,20 行 `-` 逐行核过零弱化,用例数 3681→3686 与 +5 严丝合缝反证全量输出
是当次真实抓取,`persist.test.ts` 那条判定成立。复审只挑出两处**纯注释表述**问题,
**零代码、零断言改动**:

### N1(要紧——事实写反,且与同一提交的生产注释矛盾)

`src/views/__tests__/PhotosSearch.test.ts:765`(F2 测试块的说明注释)此前写「本仓 locale
标识 `zh_cn`/`en_us` 裸传给 toLocaleString **不会报错**(浏览器 Intl 引擎不认识下划线时
会退回默认 locale,不是必然抛错)」——**这是错的**,而且与同一次提交里
`PhotosSearch.vue:45` 的生产注释「toLocaleString 会抛 RangeError」、既有先例
`SmartViewCard.vue:37`/`SearchPeoplePopover.vue:62` 的表述**直接矛盾**。复审用 node 实测
`(1234).toLocaleString('zh_cn')` → `RangeError: Incorrect locale information provided`
确认真相。这属于本期已出现过 5 次的同型问题(T8/T10/T11/T14/T16 各一次"一处对一处错"的
自相矛盾登记),也是让 F1 那条错登记溜过三轮复审的同一类事故。

**改动**:把这段注释改成与生产代码一致的表述(会抛 `RangeError`),并加一句订正说明
(此前误写成"不会报错"、已用 node 实测确认真相),避免"哪句是错的"再次不明确。

**复核确认**:重新真实跑了一次 `node -e` 验证(见下方命令输出),并 grep 了
`PhotosSearch.test.ts`/`PhotosSearchGrid.test.ts`/`PhotosSearchGrid.vue` 全文,确认
`toLocaleString` 相关注释里**没有第三处同类表述残留**。

### N2(措辞——主语指代错误,读起来自相矛盾)

`src/photos/components/PhotosSearchGrid.vue:118-119`(fix 波 F4 那段订正注释)此前写「真正
让**这条 `display: none`** 生效的不是它自己,而是 `scrollbar-width: none`」——字面读成
"scrollbar-width 使 display:none 这条规则生效",与四行后「`::-webkit-scrollbar {
display: none }` 这条在这些浏览器上是**死规则**」自相矛盾(死规则不可能被"生效")。

**改动**:主语从「这条 `display: none`」改成「"滚动条隐藏"这个效果」——真正生效
(起作用)的是 `scrollbar-width: none`,`display: none` 那条规则本身在 Chrome 121+
是死规则,两者不是谁让谁"生效"的关系,是"谁才是真正起作用的那条"。顺带把 ②
`滚动条隐藏:改用……display: none(+ scrollbar-width: none)` 那句里把
`scrollbar-width: none` 塞进括号当附带的旧写法,改成两者并列的"这一对声明"表述——
不再靠后面那句"此前的登记把主次写反了"单独兜着。**结论本身没变**(`theme.css:3-6`
对 `*` 设了 `scrollbar-width: thin`、`LogsPane.vue:36-38` 已登记同一条 2026-07-22
真机结论,复审已回源核过),只改措辞。

### 验证命令与当次真实抓取输出

```
$ node -e "try { console.log((1234).toLocaleString('zh_cn')) } catch(e) { console.log('THROWN:', e.constructor.name, e.message) }"
THROWN: RangeError Incorrect locale information provided
```

```
$ pnpm exec vitest run src/views/__tests__/PhotosSearch.test.ts src/photos/components/__tests__/PhotosSearchGrid.test.ts
 Test Files  2 passed (2)
      Tests  99 passed (99)
```

```
$ pnpm exec vue-tsc --noEmit
(无输出,EXIT=0)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  460 passed (460)
```

只动了两处注释(`PhotosSearch.test.ts` 的 F2 说明块、`PhotosSearchGrid.vue` 的 F4 订正
段),零代码改动、零断言改动、零 i18n 改动。

### 范围外观察(复审记录,挂 roadmap,不在本轮处理)

复审另记两条不要求本轮处理的观察,已如实转记以免遗漏:
①「全支唯一的裸 `toLocaleString()`」这个措辞严格说只在 P7a 本期触碰的文件内成立——
分支上还有 9 处更早批次(P4/P5/P6)的裸调用:`PlaceCoverPicker.vue:123`、
`PlacesRail.vue:108`、`ClusterActionDialog.vue:220`、`PersonHero.vue:268`、
`PhotosPeople.vue:569/:589`、`PhotosPersonDetail.vue:673/:959`、`PhotosPlaces.vue:507`。
②`smartViews.ts:288` 的 `if (deleteBusy.value) return` 在并发场景下静默不做也不抛,此时
F3 新补的 `.catch` 不会被触发,用户依然零反馈(窗口极窄,非本轮引入,不在 F3 范围内)。
