### Task 5: `PlaceInsights.vue` + 面板内「最近的照片」段

**Files:**
- Create: `src/photos/components/PlaceInsights.vue`
- Create: `src/photos/components/__tests__/PlaceInsights.test.ts`
- Modify: `src/photos/components/PlaceDetailPanel.vue`(insights 段挂载 + 最近的照片段)
- Modify: `src/photos/components/__tests__/PlaceDetailPanel.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:1174-1202`、`photos-places.scss:703-755`(**跳过 `:756-762` 的 `.insight-card .meta` 死 CSS**)、`NimoOS-Photos/service/places.go:526-560`

**Interfaces:**
- Consumes: `type PlaceInsight`(T2)、`insightKey`/`joinCompanionNames`(T1)、T1 的 5 个 insight 键
- Produces:
  ```ts
  // PlaceInsights.vue props
  { insights: PlaceInsight[] }
  // 无 emits
  ```
  `PlaceDetailPanel` 无新增对外接口(最近的照片段复用已有的 `open-photo` 与 `open-library`)。

**结构规格:**

**A. insights 段(`PlaceInsights.vue`)**

1. 外层 `v-if="insights.length > 0"` 的 `.detail-section`:`<h4>` = `photosPlacesNimoNoticed`(**无 `.more`**,照 Vue2 `:1175`)+ `.insights` 容器。
2. 每张 `.insight-card`(`grid-template-columns: 24px 1fr`):`.ico`(24px 圆形软底,内嵌图标)+ 文案节点。
3. **图标三分支**:`ins.ico` 为 `sparkles` / `person` / `home` 时各渲染对应内联 SVG(13px,`fill="none" stroke="currentColor" stroke-width="2"`,照本仓既有内联 SVG 写法,如 `PhotosPersonDetail.vue:635`),**未知 ico 回落 sparkles**。
4. **文案:4 个形状各一条 `<i18n-t>`,零 `v-html`**(spec §7c-4):
   ```vue
   <!-- 每种 insight 的插值集合不同,只能逐形状写;keypath 由 insightKey() 给出,
        未知 key 整卡不渲染(偏离登记 8)。 -->
   <i18n-t v-if="k === 'photosPlacesInsightTopSpot'" :keypath="k" tag="span" scope="global">
     <template #spot><b>{{ ins.params.spot }}</b></template>
     <template #count>{{ ins.params.count }}</template>
   </i18n-t>
   <i18n-t v-else-if="k === 'photosPlacesInsightCompanions'" :keypath="k" tag="span" scope="global">
     <template #names><b>{{ joinCompanionNames(ins.params.names) }}</b></template>
   </i18n-t>
   <i18n-t v-else-if="k === 'photosPlacesInsightHome'" :keypath="k" tag="span" scope="global">
     <template #base><b>{{ t('photosPlacesInsightHomeBase') }}</b></template>
     <template #trips>{{ ins.params.trips }}</template>
     <template #count>{{ ins.params.count }}</template>
   </i18n-t>
   <i18n-t v-else :keypath="k" tag="span" scope="global">
     <template #count>{{ ins.params.count }}</template>
   </i18n-t>
   ```
   > **spec §7c-4 引的「P5-T13 先例」实为反例**:P5-T13(`PersonRelationsTab.vue:19-29`)最终选的是「转义参数 + `v-html`」而不是 `<i18n-t>`。本期按 spec 的**要求**(零 `v-html`)执行,不按它的**引证**。此事实要在代码注释与任务报告双处登记。
5. **未知 key 的卡片整张跳过 + `console.warn` 一次**(偏离 8)。
6. token:`.insight-card` 底 `--chip-bg`、边 `--card-border`、字 `--fg-muted`、`<b>` 用 `--fg`;`.ico` 底 `--accent-soft`、色 `--accent-text`。

**B. 最近的照片段(写在 `PlaceDetailPanel` 里,照 Vue2 `:1186-1202`)**

1. `.detail-section`:`<h4>` = `photosPlacesRecentPhotos` + **可点**的 `.more` = `photosPlacesSeeAll`({n: count}),`@click` → `emit('open-library')`。
2. `.detail-grid`(3 列,gap 3px):每张 `.ph > img`(`loading="lazy"`),`@click` → `emit('open-photo', assetId, recent)`(**D9:整段 `recent` 数组当翻页集**)。
3. `v-if="count > recent.length"` 的 `.ph.more` 格:文本 `+{{ count - recent.length }}`,`@click` → `emit('open-library')`。
4. **段落恒渲染**(Vue2 `:1186` 的 `.detail-section` 没有 `v-if`)—— `recent` 为空时只剩标题 + 可能的 `+N` 格,照搬。
5. `.detail-grid .ph.more:hover` 的 `var(--surface-3, #22222A)` → `--chip-bg-hi`;`.ph.more` 常态底 `--chip-bg`。**基类 `.ph:hover img` 与 `.ph.more:hover` 各管各的**,但 `.ph.more` 的 background 变体要自带 `:hover`(级联铁律),用 cssCascade 断言。

- [ ] **Step 1: 写失败测试**

`PlaceInsights.test.ts` 必含:
- 四个后端 key 各渲染出一张卡片,文案是**中文实际值**且插值被替换(如 topSpot 传 `{spot:'西湖',count:12}` → 文本含 `西湖` 与 `12`,且**不含** `{spot}`)。
- **零 `v-html`**:读组件源文本断言不含 `v-html`;并断言 topSpot 卡片里 `<b>` 元素的文本恰为 `西湖`(证明加粗走的是插槽而不是拼串)。
- companions:`params.names = ['小明','小红']` → `<b>` 文本为 `小明 · 小红`(走 `joinCompanionNames`)。
- home:`<b>` 文本为 `大本营`(取 `photosPlacesInsightHomeBase`),句中 `{trips}`/`{count}` 都被替换。
- mostPhotographed:无 `<b>`,`{count}` 被替换。
- 未知 key(`photos.places.insight.zzz`)→ **该卡不渲染**、`console.warn` 被调一次;混在四条已知里时仍渲染 4 张。
- 图标三分支:`ico` 为 `sparkles`/`person`/`home` 各渲染不同 SVG(用 `data-test="insight-ico-<ico>"` 区分);未知 `ico` 回落 sparkles。
- `insights` 为空 → 整段不渲染。

`PlaceDetailPanel.test.ts` 追加:
- 最近的照片:`recent` 三张 → 3 个 `.ph`;点第二张 → `open-photo` 带 `(recent[1], recent)`(**D9 主守卫**)。
- `count=30`、`recent.length=6` → `.ph.more` 存在且文本为 `+24`;`count=6` → `.ph.more` 不存在。
- 点 `.ph.more` 与点 `.more`(查看全部)都 emit `open-library`;`.more` 文案含 `30`。
- `recent` 为空时段落仍渲染(标题在)。
- cssCascade:hover 态下 `.detail-grid .ph.more` 的 background 归属含 `:hover` 的规则。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + 逐个删码验证**

删码清单(一次只删一处):①`insightKey` 的 null 分支不再跳过卡片(改成直接把后端 key 当 keypath)→ 未知 key 用例红;②companions 的 `joinCompanionNames` 换成直接插数组 → 拼接用例红;③home 的 `#base` 插槽换成写死中文 → 该用例断言的是 `t('photosPlacesInsightHomeBase')` 的值,需改成「删掉 `<b>` 包裹」验证 → 断言 `<b>` 文本红;④`open-photo` 的第二参从 `recent` 改成 `[assetId]` → D9 用例红;⑤`+N` 的 `v-if` 删掉 → 「count=6 时不存在」红;⑥`.ph.more:hover` 整条删掉 → cssCascade 红。

- [ ] **Step 5: Commit** — `feat(photos): P6b-T5 insights 段(i18n-t 具名插槽零 v-html)+ 最近的照片段`

---

