# SP7-P6a 终审单修复波报告

日期:2026-07-30。工作区 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(分支 `sp7-photos`,基于
HEAD `10d2237`)。本轮是终审判定 With fixes(0 Critical / 4 Important / 10 Minor)之后的
**唯一一次修复波**,之后只有一轮 scoped 复审。逐条落地如下。

## 1. 逐条对应改动位置

### Important

- **I1**(`PlacesFilterMenu.vue:310`,原写死 `color-scheme: dark`)
  - 删除该行,改为一段紧贴 `.map-filter-pop .mfp-date-row input` 规则的注释,登记
    "根节点已按主题分设 color-scheme,刻意不照抄"。文件:
    `src/photos/components/PlacesFilterMenu.vue`(规则体内,`outline: none` 之前)。
  - 新测试:`src/photos/components/__tests__/PlacesFilterMenu.test.ts` 追加
    describe「日期 input 不写死 color-scheme(评审 I1……)」,断言组件 `<style>` 块不含
    `color-scheme` 字符串。

- **I2**(`usePlacesView.ts:174` 注释证伪 + 测试标题/注释误导范围)
  - `src/photos/composables/usePlacesView.ts`:`zoomToCluster` 上方注释改写为代数证明
    (`splitScaleFor` 可裂分支恒 `>= currentScale*1.04`;裂不开分支被 `centerOn` 的 clamp
    夹回 `MAX_SCALE`),`+0.01` 生产码**未改动**,仅保留用于逐行对齐 Vue2。
  - `src/photos/composables/__tests__/usePlacesView.test.ts:398`:标题由
    「已在 MAX_SCALE 时目标仍 > 当前(靠 +0.01)但被钳回 MAX_SCALE,且不抛」改为
    「mock 裂解阈值 = currentScale 时 +0.01 生效且未被钳制」;注释改写,明确该用例的
    `splitScaleFor` mock 返回值(`currentScale` 本身)是真实链路永远不会出现的靶,不代表
    任何用户可观测行为。

- **I3**(rail 空态「过滤后为空」误显「没有位置数据」)
  - `src/photos/components/PlacesRail.vue`:新增必填 prop `totalPlaces: number`;
    `places.length === 0` 分成两支——`totalPlaces === 0` 走原 `rail-empty`
    (`photosPlacesEmpty` + hint),否则走新增 `rail-filter-empty`
    (`photosPlacesFilterEmpty`,无 hint)。
  - `src/views/PhotosPlaces.vue`:`<PlacesRail>` 新增 `:total-places="store.places.length"`
    (全量、未过滤)。
  - i18n 新键 `photosPlacesFilterEmpty`(见 §2)。
  - 新测试:`PlacesRail.test.ts` 新增 describe「过滤后为空 vs 真的没有位置数据」两条;
    `views/__tests__/PhotosPlaces.test.ts` 新增一条断言容器传给 rail 的 `totalPlaces`
    在筛选清空结果后仍是全量长度。

- **I4**(`retryLoad` 不做首屏自动选中)
  - `src/views/PhotosPlaces.vue`:抽出 `selectFirstIfNeeded()`(原 `onMounted` 内联逻辑),
    `onMounted` 与 `retryLoad`(改为 `async`,`await store.fetchPlaces()` 之后调用)都调。
  - 新测试:`views/__tests__/PhotosPlaces.test.ts`「加载失败态」describe 新增一条——
    首次失败、点重试、第二次成功后断言 `activeId` 落到第一个地点且 `getPlace` 被调。

### Minor

- **M1**:`src/photos/util/placesMapThemes.ts:10`/`:34` 「26 个色值」改为
  「28 个色值(4 预设 × 7 字段)」,两处均改。
- **M2**:`src/i18n/zh_cn.ts` 地点段段首注释删掉与事实相反的半句
  (「"当前行程" 一项按 Global Constraints 术语条目保留统一措辞,不回退 json 的
  "本次旅行"」),只改注释文本,零键改动。
- **M3**:`src/photos/components/PlacesRail.vue`(`.rail-place .thumb`)补一行登记注释,
  体例照 `PhotosPlaces.vue` `.map-tip .thumb` 的既有 D3 裁定。
- **M4**:`src/photos/components/PlacesZoomBar.vue` `setFromEvent` 加
  `if (!rect.height) return` 零高度守卫 + 说明注释(NaN 传导链路)。新测试:
  `PlacesZoomBar.test.ts` 新增一条,mock `height:0` 断言不 emit `set-scale`。
- **M5**:`src/photos/util/placesMapThemes.ts` `mapThemeStyleVars` 函数上方补登记注释
  (`--map-grid` 无消费方,唯一 Vue2 消费者是已判死码的经纬线规则)。
- **M6**:`src/photos/stores/places.ts` `stats` 声明处补登记注释(P6a 无消费方,留供
  P6b/后续)。
- **M7**:`src/photos/util/placesMap.ts` `splitScaleFor` 上方补提醒注释(改二分步数/收敛
  策略要同步改 `placesMap.test.ts:176-191` 的复制段)。
- **M8**:`src/photos/util/placesMap.ts` 文件头偏离登记补第 5 条(custom 区间闭区间修正:
  本地零点 +`T23:59:59.999` 纳入末日整天,对应 Vue2 UTC 零点排除末日整天)。
- **M10**:`src/views/PhotosPlaces.vue:3` 注释「路由与侧栏第 6 条目」改为
  「第 4 条目」(真实顺序:library/albums/people/**places**/favorites/trash)。

### 便宜守卫

- `src/styles/color-guard.test.ts` 新增 describe「color-scheme 单值必须走
  theme-exception 豁免(防 I1 同类复发)」:扫描所有非 `theme.css` 的 `.vue`/`.css`
  样式块,若出现单值 `color-scheme: dark` 或 `color-scheme: light`(不含
  `color-scheme: light dark`)且未被 `theme-exception` 豁免窗口覆盖,即失败。复用现有
  `color-token guard` 同一套逐行状态机(exempt 由 `theme-exception` 注释开、由 `;`/`}`
  关)。已确认 `theme.css` 自身的 `:root`/`:root[data-theme="light"]` 两条
  `color-scheme` 声明被跳过(`rel === 'styles/theme.css'` continue)。

## 2. 新增 i18n 键与两 locale 键序自检

新增键:`photosPlacesFilterEmpty`。

- `src/i18n/zh_cn.ts`:追加在 photos 段(整个文件)末尾,`photosPlacesRetry` 之后、
  闭合 `}` 之前。值:`'没有符合当前筛选条件的城市'`。
- `src/i18n/en_us.ts`:追加在对应位置,`photosPlacesRetry` 之后。值:
  `'No cities match the current filters'`。
- `pnpm exec vitest run src/i18n/parity.test.ts` 通过(396 项全绿,含 key 集合与顺序
  相等断言)——见 §5。

## 3. 新增测试清单

- `src/photos/components/__tests__/PlacesFilterMenu.test.ts`:+1(I1,样式块零
  `color-scheme`)。
- `src/photos/components/__tests__/PlacesRail.test.ts`:+2(I3,`totalPlaces===0` 走旧
  文案 / `totalPlaces>0` 且过滤后为空走新文案且不出旧文案)。
- `src/photos/components/__tests__/PlacesZoomBar.test.ts`:+1(M4,`height===0` 不
  emit)。
- `src/views/__tests__/PhotosPlaces.test.ts`:+2(I3 容器侧 totalPlaces 全量校验 / I4
  重试后自动选中)。
- `src/styles/color-guard.test.ts`:+N(便宜守卫,每个非 `theme.css` 的样式源文件各一条
  `it`,随现有文件枚举自动展开——本次仓库规模下净增约 137 条,与全量测试数从 2530→2667
  的增量吻合,含本轮新增的其余 6 条显式测试)。

`usePlacesView.test.ts` 未新增用例,只重写了既有一条的标题与注释(I2)。

## 4. 删码验证逐条结果

全部通过**手工 Edit 改回原状**(未使用 `git checkout --`,因改动尚未提交,该命令会把
文件整个还原到 HEAD 而丢失本轮修复——已踩过一次坑并当场重做,记入 §7 顾虑)。

- **I1**:在 `PlacesFilterMenu.vue` 的 `.mfp-date-row input` 规则里加回裸
  `color-scheme: dark;`(不带 theme-exception)→
  - `PlacesFilterMenu.test.ts` 新增的组件级测试变红:
    `expected [...] to not contain 'color-scheme'` 失败。
  - `color-guard.test.ts` 新增的便宜守卫对该文件那条 `it` 也变红:
    `L316: color-scheme: dark;` 被判定未豁免。
  - 两者都验证通过后已改回删除该行 + 登记注释(当前状态)。

- **I3**:把 `PlacesRail.vue` 的第一个空态分支条件从
  `places.length === 0 && totalPlaces === 0` 改回 `places.length === 0`(等价于回退到
  修复前的单分支)→ `PlacesRail.test.ts` 里「totalPlaces > 0 但过滤后为空……」那条变红
  (`rail-filter-empty` 不存在)。已改回。

- **I4**:把 `PhotosPlaces.vue` 的 `retryLoad` 里的 `selectFirstIfNeeded()` 调用删掉
  (只保留 `await store.fetchPlaces()`)→ `PhotosPlaces.test.ts` 新增的「首次失败→重试→
  自动选中」用例变红(`activeId` 收到 `null` 而不是 `'1'`)。已改回。

- **M4**:把 `PlacesZoomBar.vue` 的 `if (!rect.height) return` 删掉 →
  `PlacesZoomBar.test.ts` 新增用例变红,且失败信息**正好复现了终审预测的 NaN**
  (`expected [[NaN]] to be undefined`)。已改回。

## 5. 四道门命令与输出

```
$ pnpm test
 Test Files  280 passed (280)
      Tests  2667 passed (2667)
```
(`favorites.test.ts` 里两条既有的 jsdom "Not implemented: navigation" 警告是历史噪音,
与本轮改动无关,不影响 pass/fail。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,exit 0)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
Tests  全绿(含新增守卫描述块)
```

```
$ pnpm exec vitest run src/i18n/parity.test.ts
Tests  全绿(396 项,与 color-guard 合跑同一命令验证过)
```

```
$ pnpm build
vue-tsc --noEmit && vite build
✓ built in ~13-16s(仅有与本次改动无关的既有 chunk-size 警告)
```

## 6. rebase 纯追加性自检

5 个约定的冲突文件里,本轮实际改动了 2 个(`theme.css`/`router/index.ts`/
`docs/THEMING.md` 未触碰):

```
$ git diff --numstat -- src/i18n/zh_cn.ts src/i18n/en_us.ts src/router/index.ts src/styles/theme.css docs/THEMING.md
5   0   src/i18n/en_us.ts
5   2   src/i18n/zh_cn.ts
```

- `en_us.ts`:5 行全部为新增(新键 + 其上 4 行注释),0 删除。纯追加。
- `zh_cn.ts`:5 行新增(同上)+ 2 行删除。删除的 2 行是 M2 修的那条**段首注释**里与事实
  相反的半句(`git diff` 原文见下),不涉及任何键的增删/重排——`photosPlacesCurrentTrip`
  等既有键一个字节未动:

```diff
-  // 出入已在任务报告里列出(brief 快照与 json 实际值不一致的几处按 json 为准更正;
-  // "当前行程" 一项按 Global Constraints 术语条目保留统一措辞,不回退 json 的"本次旅行")。
+  // 出入已在任务报告里列出(brief 快照与 json 实际值不一致的几处按 json 为准更正)。
```

结论:两个 locale 文件的改动仍满足「只追加,不删除既有键/不重排」的硬约束——唯一的删除
是注释文本纠错,brief 里明确允许「只改注释文本,不动任何键」。

## 7. 改动的文件

```
 src/i18n/en_us.ts                                  |  5 +++
 src/i18n/zh_cn.ts                                  |  7 +++--
 src/photos/components/PlacesFilterMenu.vue         |  6 +++-
 src/photos/components/PlacesRail.vue               | 18 +++++++++--
 src/photos/components/PlacesZoomBar.vue            |  6 ++++
 src/photos/components/__tests__/PlacesFilterMenu.test.ts  | 11 +++++++
 src/photos/components/__tests__/PlacesRail.test.ts | 21 +++++++++++++
 src/photos/components/__tests__/PlacesZoomBar.test.ts     | 12 ++++++++
 src/photos/composables/__tests__/usePlacesView.test.ts    | 15 ++++-----
 src/photos/composables/usePlacesView.ts            |  8 ++++-
 src/photos/stores/places.ts                        |  3 ++
 src/photos/util/placesMap.ts                       | 11 +++++++
 src/photos/util/placesMapThemes.ts                 | 10 ++++--
 src/styles/color-guard.test.ts                     | 35 +++++++++++++++++++++
 src/views/PhotosPlaces.vue                         | 24 ++++++++++-----
 src/views/__tests__/PhotosPlaces.test.ts           | 36 ++++++++++++++++++++++
 16 files changed, 205 insertions(+), 23 deletions(-)
```

未触碰 `theme.css` / `docs/THEMING.md` / `router/index.ts`——本轮 13 条 + 守卫都不需要
新 token 或路由改动。

## 8. 顾虑

- **`git checkout --` 事故(已妥善处理,记录以防同类误用)**:在做 I1 的删码验证时,
  为图快用 `git checkout -- PlacesFilterMenu.vue` 想把加回的裸 `color-scheme: dark`
  撤掉,但当时本轮修复尚未提交,该命令把文件整个还原到 HEAD(`10d2237`)——不仅撤掉了
  验证用的临时改动,连 I1 的正式修复(删行 + 登记注释)也一起丢了。已立即发现并用 `Edit`
  重做该文件的修复,随后所有其它删码验证都改用手工 `Edit` 来回切换,不再用
  `git checkout --` 撤销未提交的改动。最终状态已核对(`git diff` 与预期一致),不影响
  交付,但如果本轮打算分批提交,要留意这类命令在"改动未落盘到 commit"阶段的破坏性。
- **`resolvePlaceKey(id) as string` 类型断言**、**`worldMap.test.ts` 挂载
  `PhotosMiniMap.vue`**、**窄屏 `min-height`**、**`resetSpotName`**——终审已 triage 为
  不动/留后,本轮未碰。
- I3 的容器侧测试为了真正让 `filteredPlaces` 归零,用了 `minCount=200` 叠加
  `regionFilter=americas` 两个条件的交集(单独 `minCount=200` 不够,因为 fixture 里
  TOKYO/PARIS 的 count 都 ≥ 200)——这是我在实现测试时发现 fixture 计数与判断条件不匹配后
  改的验证路径,不是终审原话指定的具体操作序列,但达到的效果(断言 totalPlaces 在
  filteredPlaces 归零后仍是全量长度)与终审要求完全一致。
