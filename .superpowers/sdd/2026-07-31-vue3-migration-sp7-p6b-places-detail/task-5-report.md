# Task 5 报告: PlaceInsights.vue + 面板「最近的照片」段

## 结论

状态:完成。commit `1a6b4f7`(见下方精确哈希以 `git log` 为准)。

- 新增 `src/photos/components/PlaceInsights.vue` + `__tests__/PlaceInsights.test.ts`(13 例)。
- `PlaceDetailPanel.vue` 挂载 `PlaceInsights` + 新增「最近的照片」段;`PlaceDetailPanel.test.ts`
  追加 9 例(insights 段挂载 2 + 最近的照片段 6 + hover 级联 1),并收紧 1 条 T4 遗留断言
  (见下方「意外发现」)。
- 全量:`pnpm exec vitest run` 285 files / 2820 passed(基线 284/2795,净增 1 文件 25 例)。
  `pnpm exec vue-tsc --noEmit` 0 错误。`color-guard.test.ts` 400 passed(基线 397,新文件
  带来 +3)。

## Vue2 元素清点表(逐项对照)

回源核对 `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue:1174-1202` + `photos-places.scss:702-762`。

| Vue2 元素/行为 | 行号 | New-UI 落地 | 备注 |
|---|---|---|---|
| `.detail-section` + `<h4>{{ $t('Nimo noticed') }}</h4>` | :1176 | `PlaceInsights.vue` 根 `.detail-section` + `<h4>` | 键 `photosPlacesNimoNoticed`,无 `.more`(照原文) |
| `v-if="insights.length > 0"` | :1175 | 改用 `v-if="renderable.length > 0"` | **偏离登记**,见下 |
| `v-for="(ins, k) in insights"` | :1178 | `v-for="(ins, idx) in renderable"`(先过滤) | 偏离登记 8(T1 已定) |
| `<PhotosIcon :name="ins.ico" :size="13" />` | :1179 | 内联 SVG 三分支 + `data-test` | 图标路径取自 Vue2 `PhotosIcon.vue` 的 `sparkles`/`person`/`home` 三个 `<template>` 分支,逐点核对路径数据一致 |
| `v-html="pt(ins.key, ins.params)"` | :1180 | 四条 `<i18n-t>` 具名插槽 | spec §7c-4 零 v-html 要求,细节见下节 |
| `.insight-card .meta` | scss :756-762 | **不迁** | 模板里 insight-card 内从未出现 `.meta` 元素,死 CSS,brief 已点名跳过 |
| `.detail-section`(Recent) | :1186 | `PlaceDetailPanel.vue` 内联 `.detail-section`(**无 v-if**,恒渲染) | 严格照搬 Vue2 无条件渲染 |
| `{{ $t('Recent photos') }}` | :1187 | `photosPlacesRecentPhotos` | |
| `<span class="more" style="cursor:pointer" @click="openLibrary">{{ $t('See all {n}', {n: activePlace.count}) }}</span>` | :1188 | `<span class="more is-clickable" @click="emit('open-library')">{{ t('photosPlacesSeeAll', {n: count}) }}</span>` | `.more.is-clickable` 修饰类补手型,不动 T4 的共享基类(见下) |
| `v-for="assetId in recentPhotos"` + `photoUrl(assetId)` | :1192-1196 | `v-for="assetId in recent"` + `service.photos.thumbnailUrl(assetId, 'small')` | recentPhotos computed 照 Vue2 `:283`(`activeDetail ? recent||[] : []`)→ New-UI `recent` computed |
| `@click="onPhotoClick(assetId)"` | :1194 | `@click="emit('open-photo', assetId, recent)"` | **D9**:第二参是整段 `recent` 数组(翻页集),不是 Vue2 的单参 `{id:assetId}` 信封形状 |
| `v-if="activePlace.count > recentPhotos.length"` 的 `.ph.more` + `+{{ count - length }}` | :1198-1199 | `v-if="count > recent.length"` 的 `.ph.more` + `+{{ count - recent.length }}` | 逐字一致 |
| `.detail-grid`(3列 gap 3px)+ `.ph`(aspect-ratio 1 + cursor + border-radius 2px) | scss :702-716 | 逐条迁移 | |
| `.ph img` transition + `:hover img scale(1.04)` | scss :717-719 | 逐条迁移 | |
| `.ph.more` 常态底 `--surface-2` / 字 `--text-2` / hover 底 `--surface-3`(字面量兜底)/ hover 字 `--text-1` | scss :720-724 | `--chip-bg` / `--fg-muted` / `--chip-bg-hi` / `--fg` | token 映射同 T3/T4 既定表(`--text-1/2/3` → `--fg`/`--fg-muted`/`--fg-subtle`,`--surface-2` → `--chip-bg`);`--surface-3` 无对应 token,改用既有 `--chip-bg-hi`(brief 指定) |
| `.insights`(flex column gap 10px) | scss :729-732 | 逐条迁移 | |
| `.insight-card`(grid 24px 1fr,`--surface-2`/`--line`/`--r-sm`) | scss :733-742 | `--chip-bg`/`--card-border`/`--radius-sm` | |
| `.insight-card .ico`(24px 圆,`--accent-soft`/`--accent-hi‖--accent-ink`) | scss :743-749 | `--accent-soft`/`--accent-text` | 本仓无 `--accent-hi`,直接用既有 `--accent-text`(语义"更浅更可读的强调色",同 PlaceSpotDialog.vue 既有先例口径) |
| `.insight-card b`(`--text-1` 加粗) | scss :750 | `--fg` 加粗 | |

## `<i18n-t>` 四分支落地方式

四种后端形状(`NimoOS-Photos/service/places.go:526-560` 回源确认恰好四条,`Ico` 只有
`sparkles`/`person`/`home`)各写一条固定的 `<i18n-t :keypath="ins.k" tag="span" scope="global">`,
用 `v-if`/`v-else-if`/`v-else` 按 `ins.k`(T1 `insightKey()` 给出的扁平驼峰键)精确字符串比较分流,
不做动态插槽拼装:

- `photosPlacesInsightTopSpot`:插槽 `#spot`(`<b>`)+ `#count`。
- `photosPlacesInsightCompanions`:插槽 `#names`(`<b>{{ joinCompanionNames(...) }}</b>`,T1 拼接函数)。
- `photosPlacesInsightHome`:插槽 `#base`(`<b>{{ t('photosPlacesInsightHomeBase') }}</b>`——静态词
  译文,不是数据参数)+ `#trips` + `#count`。
- 默认分支(`photosPlacesInsightMostPhotographed`,唯一剩下的形状):只有 `#count`,无加粗参数。

**零 v-html 核实**:`PlaceInsights.test.ts` 只扫描 `<template>` 块(排除 `<script>` 里必然会字面提到
"v-html" 的文档注释),断言块内不含 `v-html\s*=`。同时用 `<b>` 元素文本精确比对(而非整卡片文本
`toContain`)证明加粗走的是插槽渲染,不是字符串拼接后塞回文本节点。

**spec §7c-4 引证澄清(brief 已要求登记)**:brief 原文引用"P5-T13 先例"建议参考
`PersonRelationsTab.vue:19-29` 的做法,但回源核对后发现该文件最终选择的实际方案是"转义参数 +
v-html"，不是 `<i18n-t>`——引用本身是反例。本任务按 spec 的**零 v-html 硬要求**执行，不照抄这个
引证；PlaceInsights.vue 文件头注释与本报告双处登记这一事实。

## 偏离登记(本任务新增,非 T1-T4 既有条目)

1. **外层 `v-if` 改用 `renderable.length` 而非 brief 字面的 `insights.length`**:若传入的
   insight 全部是未知 key,过滤后卡片列表为空,若仍按 `insights.length > 0` 渲染外壳会得到一个
   光秃秃的"Nimo 发现"标题、下面空空如也——比 Vue2(至少会把内部 key 原文吐出来,好歹有内容)
   更糟。改用 `renderable.length` 让整段随之消失。已在组件模板与 `PlaceInsights.test.ts`
   （"未知 key 单独出现"用例)中登记验证。
2. **T4 遗留断言收紧(非本任务引入的缺陷,是必要的连带修正)**:`PlaceDetailPanel.test.ts` 里
   T4 写的「spots 列表段」用例 `spots 为空数组 → 整段不渲染` 原断言是
   `expect(w.find('.detail-section').exists()).toBe(false)`。T4 写这条时 `.detail-section`
   全仓唯一消费方就是 spots 段,断言"零个 `.detail-section`"等价于"spots 段不渲染"。T5 按 spec
   §7c-B-4 要求新增的「最近的照片」段**恒渲染**(即使 `recent` 为空也要显示标题 +
   可能的 `+N` 格),同样用 `.detail-section` 包壳,这条旧断言的隐含前提被规范要求的新行为
   推翻(不是我引入了 bug,是这条断言的"零 `.detail-section`"检验范围过宽,把非它本意的东西
   也断言进去了)。收紧成只保留 `.spot-list` 缺席断言——这才是这条用例真正想钉住的东西(spots
   段本身没有渲染),T4 的核心断言意图未被削弱,只是移除了因为新特性天然失真的那一句多余检验。
   已在测试文件同址加注释说明。

## 6 项删码验证结果(全部一次只删一处,验完手工 Edit 切回,未用 `git checkout`)

| # | 删除内容 | 预期结果 | 实际结果 |
|---|---|---|---|
| ① | `insightKey` null 分支移除,后端 key 直接当 keypath | 未知 key 用例红 | 红:7 个用例失败(未知 key 相关 2 例 + 四形状 keypath 变成裸后端点分键导致文案/加粗断言全部跟着红,含英文 locale 用例) |
| ② | companions `joinCompanionNames` 换成直接插数组 | 拼接用例红 | 红:`<b>` 文本变成 `["小明","小红"]` 的 JSON 字符串,断言失败 |
| ③ | home `#base` 插槽删掉 `<b>` 包裹(照 brief 澄清后的验证方式,而非单纯换写死中文) | `<b>` 文本断言红 | 红:`card.find('b')` 命中空 DOMWrapper,`.text()` 抛错("Cannot call text on an empty DOMWrapper") |
| ④ | `open-photo` 第二参从 `recent` 改成 `[assetId]` | D9 用例红 | 红:emitted 断言 `['a2', recentList]` 与实际 `['a2', ['a2']]` 不符 |
| ⑤ | `+N` 格的 `v-if` 删掉 | count=6 时不存在」用例红 | 红(且连带 D9 用例因 `.ph` 计数从 3 变 4 一起红,符合预期的连带失真) |
| ⑥ | `.ph.more:hover` 整条规则删掉 | cssCascade 断言红 | 红:`winningHoverBackground` 返回的胜出选择器退化为不含 `:hover` 的基类 `.detail-grid .ph.more` |

6 项全部按预期变红后,逐项用 Edit 手工恢复(未使用 `git checkout --`),恢复后重跑对应测试文件
确认转绿,最终跑一次全量 + tsc + color-guard 三门确认无残留改动。

## 测试数字(前后对比)

| 检查项 | 任务前(基线) | 任务后 |
|---|---|---|
| `pnpm exec vitest run`(全量) | 284 files / 2795 passed | 285 files / 2820 passed |
| `pnpm exec vue-tsc --noEmit` | 0 错误 | 0 错误 |
| `pnpm exec vitest run src/styles/color-guard.test.ts` | 397 passed | 400 passed(新文件贡献 +3) |

全量运行里出现的 `Error: Not implemented: navigation (except hash changes)`(来自
`favorites.test.ts` 调用 `location.href` 触发 jsdom 未实现警告)是既有噪音,与本任务无关,
测试结果仍是全绿(2820 passed,无失败)。

## 遗留疑问 / 交接项

- 无阻塞性疑问。T1 的 `insightKey`/`joinCompanionNames`、T2 的 `PlaceInsight` 类型均按既定
  接口直接消费,未新增/修改共享类型或工具函数。
- i18n 键零新增(核对 `zh_cn.ts`/`en_us.ts` 确认 brief 点名的全部键均已由 T1 落地,含
  `photosPlacesInsightHomeBase`),`parity.test.ts` 无需改动。
- P6b 剩余任务(到访记录段等,若仍在本期范围内)未受本任务影响,`.detail-body` 内的挂载点
  留在「最近的照片」段之后,供后续任务续接。
