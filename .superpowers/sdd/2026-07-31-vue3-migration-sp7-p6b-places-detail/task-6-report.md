# Task 6 报告: PlaceVisitHistory.vue —— 到访记录时间线

## 结论

状态:完成。commit 见 `git log`(本次提交)。

- 新增 `src/photos/components/PlaceVisitHistory.vue` + `__tests__/PlaceVisitHistory.test.ts`(16 例)。
- `PlaceDetailPanel.vue` 挂载 `PlaceVisitHistory`(新增 `visits` computed + `save-trip` emit
  透传,`open-photo` 复用面板已有同名 emit);`PlaceDetailPanel.test.ts` 追加 5 例(到访记录段挂载)。
- 全量:`pnpm exec vitest run` 286 files / 2844 passed(基线 285/2820,净增 1 文件 24 例:
  16 + 5 + color-guard 新增 3)。`pnpm exec vue-tsc --noEmit` 0 错误。`color-guard.test.ts`
  403 passed(基线 400,新文件带来 +3)。

## Vue2 元素清点表(逐项对照)

回源核对 `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue:1204-1245` + `photos-places.scss:599-618`
+ `:835-851`(`.visit-save-btn`,brief 给的 scss 行号只到 :618,未覆盖这段,已单独定位回源核对)。

| Vue2 元素/行为 | 行号 | New-UI 落地 | 备注 |
|---|---|---|---|
| `.detail-section`(无 `v-if`,恒渲染) | :1204 | `PlaceVisitHistory.vue` 根 `.detail-section` | 逐字照搬,无条件渲染 |
| `<h4>{{ $t('Visit history') }}<span class="more" style="font-variant-numeric:tabular-nums">{{ trips }} {{ trips===1?trip:trips }}</span></h4>` | :1205-1210 | `t('photosPlacesVisitHistory')` + `.more`(内联 style 照搬,tripsUnitKey 计算属性做单复数分流) | `.more` 静态文本,不叠 `.is-clickable`(T4 约定) |
| `v-for="(v,k) in visits"` + `:class` 拼接 `is-current` | :1212-1215 | 逐字迁移 | |
| `.visit-rail` + `.visit-dot :data-current="v.current"` | :1216-1218 | 逐字迁移 | |
| `.visit-when` | :1221 | 逐字迁移 | |
| `v-if="v.current"` `.visit-pill` + `live-dot` + `$t('Current trip')` | :1222-1224 | `photosPlacesCurrentTrip` | 绿色改 `--place-current-trip`(见下) |
| `v-else` `.visit-len` + `$t('{n} days',{n:v.days})` | :1225 | `photosPlacesDays` | |
| `.visit-stats`:照片数 `<b>` + `photos_count` | :1228 | `photosPlacesPhotos` | |
| `v-if="v.faces && v.faces.length"` → `· with <b>{{join(' · ')}}</b>` | :1229 | `v-if="v.faces?.length"` → `photosPlacesWith` | 语义等价(可选链 vs 双重判断) |
| `v-if="v.spots"` → `· {n} spots` | :1230 | `photosPlacesSpotsCount` | falsy 语义照搬(0 不显示) |
| `.visit-save-btn`(`PhotosIcon name="album" size=10` + `Save trip`,`@click.stop`) | :1231-1236 | 内联 SVG(复用 `.btn` 的相册路径,10×10)+ `photosPlacesSaveTrip`/`photosPlacesSaveTripTitle`,`@click.stop` | 图标路径取自 `PlaceDetailPanel.vue` 已有的「保存为相册」按钮同一 SVG(rect+circle+path),按钮尺寸缩到 10px |
| `.visit-thumbs` 6 列 + `@click="onPhotoClick(th)"` | :1238-1243 | `emit('open-photo', th, v.thumbs)` | **D9**:第二参是该条 visit 自己的 thumbs,不是别条/单张/整库 |
| `.visit-history`(flex column gap 12px) | scss :599 | 逐字迁移 | |
| `.visit-rail::before` 竖线 + `.visit-card:last-child .visit-rail::before{display:none}` | scss :601-603 | 逐字迁移 | brief 明确点名的坑,已用删码验证③钉住 |
| `.visit-dot`(默认 `--text-3`)+ `[data-current="true"]`(`#34C759` + box-shadow rgba) | scss :604-605 | `--fg-subtle` / `--place-current-trip` + `color-mix(...20%,transparent)` | |
| `.visit-body`(`--surface-2`/`--line`)+ `.is-current .visit-body`(rgba 0.05/0.25) | scss :606-607 | `--chip-bg`/`--card-border` + `color-mix(...5%\|25%,transparent)` | |
| `.visit-head`/`.visit-when`/`.visit-len` | scss :608-610 | `--fg`/`--fg-subtle` | |
| `.visit-pill`(rgba(52,199,89,0.15)底 + `#34C759` 字) | scss :611 | `color-mix(...15%,transparent)` + `var(--place-current-trip)` | |
| `.visit-pill .live-dot` + `@keyframes pulseDot` | scss :612-613 | 逐字迁移(动画本体不变) | 已用删码验证②钉住存在性 |
| `.visit-stats`/`.visit-stats b` | scss :614-615 | `--fg-subtle`/`--fg-muted` | |
| `.visit-thumbs`(grid 6 列)+ `img`(aspect-ratio 1)+ `:hover scale(1.05)` | scss :616-618 | 逐字迁移 | 偏离登记 15(见下) |
| `.visit-save-btn`(`--accent-soft`/rgba(accent-rgb,0.35) 边/`--accent-hi` 字/hover rgba 0.25) | scss :835-851 | `--accent-soft`/`--accent-soft-bd`/`--accent-text`/hover `--accent-soft-2` | 本仓无 `--accent-rgb`/`--accent-hi`(已 grep 确认,同 PlaceSpotDialog.vue 等既有先例),改用语义最接近的三档 accent-soft 系列,数值级差近似对应(0.14≈0.15,0.36≈0.35,0.24≈0.25) |

## 偏离登记(本任务新增)

1. **偏离登记 15(brief §4 原文要求"照搬并登记")**:`.visit-thumbs img:hover { transform:
   scale(1.05) }` 照搬 Vue2,父格 `.visit-thumbs` 未设 `overflow:hidden`,hover 放大会溢出压邻格。
   Vue2 原状如此,本任务不修,只照搬 + 在组件文件头与本报告双处登记。
2. **`.visit-save-btn` 的 accent 系 token 换算**:Vue2 用 `rgba(var(--accent-rgb), α)` 精确复刻
   三个 alpha 值(0.15/0.35/0.25),本仓无 `--accent-rgb`/`--accent-hi`(grep 两套主题块确认不存
   在,同 PlaceSpotDialog.vue/PersonHero.vue/PlacesFilterMenu.vue/MergeReviewDialog.vue 等既有
   四处同类先例),改用已有的 `--accent-soft`(0.14)/`--accent-soft-bd`(0.36)/
   `--accent-soft-2`(0.24)三档 token 及 `--accent-text` 替代 `--accent-hi`,数值级差均在
   Vue2 原值 ±0.01 内,视觉上不可分辨。

## 5 项删码验证结果(全部一次只删一处,验完手工 Edit 切回,未用 `git checkout`)

| # | 删除内容 | 预期结果 | 实际结果 |
|---|---|---|---|
| ① | `.visit-save-btn` 的 `@click.stop` 去掉 → `@click` | 冒泡用例红 | 红:`.visit-card` 上挂的 spy 被调用 1 次(`cardSpy` 断言 `not.toHaveBeenCalled()` 失败) |
| ② | 缩略图 `emit('open-photo', th, v.thumbs)` 第二参改成 `[th]` | D9 用例红 | 红:期望 `['a2',['a1','a2','a3']]`,实际 `['a2',['a2']]` |
| ③ | `.visit-card:last-child .visit-rail::before { display: none }` 整条删掉 | 程序化断言红 | 红:正则匹配不到该规则,`expect(m).not.toBeNull()` 失败 |
| ④ | `.visit-pill` 的 `v-if`/`v-else` 分流改成恒显 pill(去掉 `v-if="v.current"`/`v-else`) | current 用例红 | 红:非 current 条也出现 `.visit-pill`(期望不存在),`.visit-len` 期望存在但断言先在 `.visit-pill` 那一行就失败;current 分组与非 current 分组各错 1 例,共 2 例 |
| ⑤ | `v-if="v.faces?.length"` 的守卫删掉 → 恒显 | 空 faces 用例红 | 红:faces 为空数组时仍渲染出 `与 · `(join 空数组产出空字符串,但"与"字样仍出现),`not.toContain('与')` 失败 |

5 项全部按预期变红后,逐项用 Edit 手工恢复(未使用 `git checkout --`),恢复后重跑
`PlaceVisitHistory.test.ts` 确认转绿。最终 `git diff --stat` 确认 `PlaceVisitHistory.vue` 无残留
改动(与恢复前逐字节一致)。

## 测试数字(前后对比)

| 检查项 | 任务前(基线,T5 收尾状态) | 任务后 |
|---|---|---|
| `pnpm exec vitest run`(全量) | 285 files / 2820 passed | 286 files / 2844 passed |
| `pnpm exec vue-tsc --noEmit` | 0 错误 | 0 错误 |
| `pnpm exec vitest run src/styles/color-guard.test.ts` | 400 passed | 403 passed(新文件贡献 +3) |

全量运行过程中曾观察到一次 `src/files/upload/persist.test.ts` 的偶发失败(与本任务的 photos/places
代码完全无关的模块);单独运行该文件 14 例全绿,`git stash` 掉本任务改动后再跑全量也是全绿,
随后带着本任务改动重新跑一次全量同样 286/2844 全绿——判定为既有的、与本任务无关的跨文件测试
隔离/执行顺序偶发抖动(likely IndexedDB fake 状态跨测试文件泄漏),不是本任务引入的回归,已重跑确认。

## 遗留疑问 / 交接项

- 无阻塞性疑问。T1 的 i18n 键(`photosPlacesVisitHistory`/`photosPlacesDays`/`photosPlacesWith`/
  `photosPlacesSpotsCount`/`photosPlacesSaveTrip`/`photosPlacesSaveTripTitle`/`photosPlacesTrip`/
  `photosPlacesTrips`,复用 `photosPlacesCurrentTrip`/`photosPlacesPhotos`)全部核对存在,零新增,
  `parity.test.ts` 无需改动。
- T2 的 `PlaceVisit` 类型(`when/from/to/current/days/photos/faces/spots/thumbs`)直接从
  `../stores/places` import 消费,未新增/修改共享类型。
- brief 给的 scss 行号范围(`:599-618`)不含 `.visit-save-btn`(实际在 `:835-851`),已单独
  grep 定位、回源核对后登记在清点表与组件文件头,未按 brief 字面行号盲抄。
- P6b 至此 spots/insights/最近照片/到访记录四段全部挂载完毕(`PlaceDetailPanel.vue` 文件头
  T3 时代的规划注释 "由 T4/T5/T6 继续往里加" 已全部兑现),`.detail-body` 后续若有 P7/P8 交接项
  由后续任务的 brief 定义,本任务未改动面板外壳与既有派生量命名。
