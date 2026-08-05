### Task 6: `PlaceVisitHistory.vue` —— 到访记录时间线

**Files:**
- Create: `src/photos/components/PlaceVisitHistory.vue`
- Create: `src/photos/components/__tests__/PlaceVisitHistory.test.ts`
- Modify: `src/photos/components/PlaceDetailPanel.vue`(挂载到访记录段)+ 其测试
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosPlacesView.vue:1204-1245`、`photos-places.scss:599-618`、`:463-472`

**Interfaces:**
- Consumes: `type PlaceVisit`(T2)、T1 的键
- Produces:
  ```ts
  // props
  { visits: PlaceVisit[], trips: number }
  // emits
  (e: 'save-trip', visit: PlaceVisit): void
  (e: 'open-photo', assetId: string, list: string[]): void   // D9:list = 那一条 visit.thumbs
  ```
  `PlaceDetailPanel` 把 `save-trip` 与 `open-photo` 原样透传给容器。

**结构规格(逐段照 Vue2 `:1204-1245`):**

1. `.detail-section`(**无 `v-if`**,恒渲染):`<h4>` = `photosPlacesVisitHistory` + `.more`(**不可点**,`font-variant-numeric: tabular-nums`)= `trips` + 单复数键。
2. `.visit-history` → 每条 `.visit-card`(`v.current` 时加 `.is-current`):
   - `.visit-rail`:`::before` 竖线(`--card-border`;**`.visit-card:last-child .visit-rail::before { display: none }` 要照搬**,否则最后一条会拖一截悬空线)+ `.visit-dot`(`data-current` 属性)。
   - `.visit-body`:`.visit-head`(`.visit-when` 时间文案 + `v.current ? .visit-pill : .visit-len`)、`.visit-stats`、`.visit-thumbs`。
   - `.visit-pill`:脉冲小圆点(`animation: pulseDot 1.5s infinite`,keyframes 照搬 `scss:613`)+ `photosPlacesCurrentTrip`。
   - `.visit-len`:`photosPlacesDays`({n: v.days})。
   - `.visit-stats`:`<b>{{ v.photos }}</b>` + `photosPlacesPhotos`;`v-if="v.faces?.length"` → `· ` + `photosPlacesWith` + `<b>{{ v.faces.join(' · ') }}</b>`;`v-if="v.spots"` → `· ` + `photosPlacesSpotsCount`({n});末尾 `.visit-save-btn`(10px 相册图标 + `photosPlacesSaveTrip`,`title` = `photosPlacesSaveTripTitle`,**`@click.stop`** 照 Vue2 `:1233`)→ emit `save-trip`。
   - `.visit-thumbs`:6 列网格,每张可点 → `emit('open-photo', th, v.thumbs)`(**D9**)。
3. **颜色**:`.visit-dot[data-current="true"]`、`.visit-pill`、`.visit-card.is-current .visit-body` 三处的绿色一律用 P6a 已建的 **`--place-current-trip`**;需要半透明层时用 `color-mix(in srgb, var(--place-current-trip) N%, transparent)`(本仓既定技法,见 `PhotosPlaces.vue:480`),**不新增 alpha token、不写字面 rgba**。`.visit-body` 底 `--chip-bg`、边 `--card-border`。
4. **`.visit-thumbs img:hover { transform: scale(1.05) }` 照搬**,但父格无 `overflow:hidden` 时会溢出压邻格 —— Vue2 就这样,**照搬并登记**(偏离 15 同类)。

- [ ] **Step 1: 写失败测试**

必含用例:
- 结构清点:`visits` 两条 → 2 个 `.visit-card`;每条含 `.visit-rail` / `.visit-dot` / `.visit-body` / `.visit-head` / `.visit-stats` / `.visit-thumbs`。
- `current` 条:`.visit-card` 有 `.is-current`、`.visit-dot` 的 `data-current` 为 `"true"`、出现 `.visit-pill` 且文案是「本次旅行」、**不出现** `.visit-len`;非 current 条相反,`.visit-len` 文案含天数。
- `.visit-stats`:照片数在 `<b>` 里;`faces` 非空 → 出现「与」+ `join(' · ')` 后的名字;`faces` 为空 → 两者都不出现;`spots` 为 0 → 地点数不出现(`v-if="v.spots"` 的 falsy 语义,照 Vue2)。
- 点「保存旅行」→ emit `save-trip` 带该 visit 对象,且**事件不冒泡**(在 `.visit-card` 上挂 spy,断言未触发 —— 钉 `@click.stop`)。
- 点某条的第 2 张缩略图 → emit `open-photo` 带 `(thumbs[1], 该条的 thumbs)`(**D9 主守卫:不是别条的、也不是单张**)。
- 段头 `.more` 是**静态文本**(不是 button)且随 `trips` 单复数变化。
- 最后一条的竖线被隐藏:样式块含 `.visit-card:last-child` 且其 `::before` 为 `display: none`(程序化断言)。
- keyframes:样式块含 `@keyframes pulseDot`(删掉动画声明后 pill 会静止,这条钉住它存在)。
- 颜色合规:样式块里三处 current 相关规则都引用 `--place-current-trip`,且**不含**字面 `rgba(`/`#`。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + color-guard 绿 + 逐个删码验证**

删码清单(一次只删一处):①`@click.stop` 去掉 → 冒泡用例红;②`open-photo` 的第二参改成 `[th]` → D9 用例红;③`.visit-card:last-child` 那条删掉 → 程序化断言红;④`.visit-pill` 的 `v-if`/`v-else` 分流改成恒显 pill → current 用例红;⑤`faces?.length` 的守卫删掉 → 空 faces 用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6b-T6 到访记录时间线(本次旅行 pill / 同框的人 / 保存旅行)`

---

