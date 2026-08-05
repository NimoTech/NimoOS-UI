### Task 3: `PlaceDetailPanel.vue` —— 面板外壳 + hero + 三统计 + 两动作

**Files:**
- Create: `src/photos/components/PlaceDetailPanel.vue`
- Create: `src/photos/components/__tests__/PlaceDetailPanel.test.ts`
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosPlacesView.vue:1058-1107`+`:1246-1249`(模板)、`photos-places.scss:478-598`(样式,**跳过 `:491-494` 的 `.map-detail.is-entering` 死 CSS**)、`:204-212`、`:284-289`

**Interfaces:**
- Consumes: `type Place`(`util/placesMap`)、`type PlaceDetail`(T2)、T1 的键、`service.photos.thumbnailUrl`
- Produces:
  ```ts
  // props
  {
    place: Place | null            // 列表项:country/city/last/lastDate/trips/count/home/recent(布尔)
    detail: PlaceDetail | null     // 详情 payload —— 容器只在 id 与 activeId 匹配时才传(偏离登记 4)
    detailLoading: boolean
  }
  // emits
  (e: 'close'): void
  (e: 'open-cover-picker'): void
  (e: 'open-library'): void
  (e: 'save-album'): void
  (e: 'open-photo', assetId: string, list: string[]): void   // D9:翻页集由发起方给
  ```
  面板内部派生:`city`/`country`/`count`/`trips` 一律 `detail?.x ?? place?.x`;`currentHero = detail?.coverAssetId || detail?.thumbs[0] || place?.coverAssetId || place?.thumbs[0] || ''`(**Vue2 `:284-289` 只看 `activeDetail`,详情还没回来时 hero 是空图;这里补列表项兜底 —— 列表项本来就带 `coverAssetId`/`thumbs`,面板一打开就能出图。偏离登记,写注释**)。

**结构规格(逐段照 Vue2 `:1058-1107`,漏渲染元素是最高频缺陷 —— 对着源码从头扫到尾、列清点表再动手):**

1. 根 `.map-detail`(`v-if` 由容器控制,组件自己不判空显隐):`position:absolute; top/right/bottom:0; width:420px; z-index:6`。**z-index 必须是 6** —— P6a 定的梯度是「地图家具 4 < `.map-tip` 5 < **详情面板 6** < 工具栏及其弹层 7」,测试钉不变量(严格大于 `.map-tip` 的 5、严格小于 `.map-toolbar` 的 7)。
2. `.detail-hero`(高 200px、`overflow:hidden`):
   - `<img>` 封面(`src` 走 `thumbnailUrl(currentHero, 'large')`,`currentHero` 为空时**不渲染 img**),`cursor:pointer`,`@click` → `emit('open-photo', currentHero, [currentHero])`(D9:hero 单张成集)。
   - `::after` 底部渐变遮罩(Vue2 `scss:503-506` 是写死深色到透明的线性渐变)。
   - `.close` 按钮(右上,30×30,圆形,`@click` → `emit('close')`),内含 16px 的 × 图标。
   - **设置封面按钮**(左上,30×30,圆形,`title` = `photosPlacesCoverSet`,`@click` → `emit('open-cover-picker')`),内含 13px 齿轮图标。**Vue2 `:1065-1071` 是一大串内联 style,New-UI 改成正常的 class**(登记:内联 style 无法过 color-guard,也不该照搬)。
   - `.ttl` 区(左下):`.ttl-region`(12px 地图图标 + `place.country` + `v-if` 本次旅行标记 + `v-if` 常驻地标记)、`.ttl-name`(`<h2>` 城市名)、`.ttl-sub`(12px 时钟图标 + 本地化的最后到访日期 + ` · ` + `trips` + 单复数键)。
   - **「本次旅行」判据必须读列表项的布尔 `place.recent`,不是 `detail.recent`** —— 详情 payload 里的 `recent` 是**最近照片数组**(同名不同物,任何有照片的地点都真值)。Vue2 `:206-212` 自己踩过并留了注释。
   - **「本次旅行」绿色用 `--place-current-trip`(P6a 已建)**;**「常驻地」的浅紫**在本仓没有对应 token → **新增 `--place-home-base`**(深色取本仓 `--accent-text` 家族的浅蓝紫向,浅色给可读的深色向;两套主题都给值 + 进 THEMING.md)。**不要用 `--accent-text` 就近凑** —— 它是「比 accent 更浅/更可读」的语义,而这里要的是与「本次旅行」并列的第二个状态色。
   - **hero 上的一切文字/图标压在照片 + 暗化渐变上**:`.close` 与设置封面按钮的图标色、`.ttl-region`/`.ttl-name`/`.ttl-sub` 的文字色一律**钉死浅色 + `theme-exception`**,**禁用 `--on-accent`**(它是深藏青)。渐变遮罩同样钉死 + `theme-exception`。
3. `.detail-stats`:`grid-template-columns: repeat(3, 1fr)`,三个 `.detail-stat`,各 `.v` + `.k`:
   - 照片数 = `count` + `photosPlacesPhotos`
   - 地点数 = `detail?.spots.length || '—'`(**Vue2 `:1094` 的 `|| '—'` 要照搬**:0 或详情未到时显示破折号)+ `photosPlacesSpotsLabel`
   - 旅行数 = `trips` + `photosPlacesTrips`
4. `.detail-actions`:`.btn.btn-primary`(13px 网格图标 + `photosPlacesOpenInLibrary`,`@click` → `emit('open-library')`)+ `.btn`(13px 相册图标 + `photosPlacesSaveAsAlbum`,`@click` → `emit('save-album')`)。**`.btn:hover { border-color: var(--accent) }` 与 `.btn-primary` 的实底会撞**(基类 hover 压变体的第一种形态)→ `.btn-primary` 必须自带 `:hover`,写成本仓既定的 `background: var(--accent); filter: brightness(1.08);`,并用 `cssCascade.ts` 断言 hover 态胜出规则含 `:hover` 且归属 `-primary`。
5. `.detail-body`:`flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:22px`。**本任务只放一个 `detailLoading && !detail` 的骨架块**(New-UI 新增,Vue2 无加载态:详情没回来时 Vue2 的 body 是全空的);spots/insights/最近照片/到访记录四段由 T4/T5/T6 填进来。
6. **token 映射**(Vue2 → New-UI):`--text-1/2/3` → `--fg` / `--fg-muted` / `--fg-subtle`;`--surface-2` → `--chip-bg`;`--line` / `--line-strong` → `--card-border`;`--r-sm` → `--radius-sm`;`--font-display` → `--font`;`.map-detail` 的 `background: var(--surface-1)` → `--panel-bg`;`box-shadow: -8px 0 40px …` → `var(--card-shadow-hi)`(D3:chrome/surface 归 New-UI 组件体系,同 P6a 弹层裁定)。
7. **窄屏(偏离 13)**:`@media (max-width: 768px) { .map-detail { width: 100%; } }`。

- [ ] **Step 1: 写失败测试**

必含用例(每条一个 `it`):
- 结构清点:`.detail-hero` / `.detail-hero img` / `.close` / 设置封面按钮 / `.ttl-region` / `.ttl-name` / `.ttl-sub` / `.detail-stats` 下 3 个 `.detail-stat` / `.detail-actions` 下 2 个 `.btn` 各存在且数量正确。
- `currentHero` 优先级:`detail.coverAssetId` > `detail.thumbs[0]` > `place.coverAssetId` > `place.thumbs[0]`;**全空时 `img` 不渲染**(不发空 src 请求)。断言 `thumbnailUrl` 被调用的参数,**不许断言字面 URL**。
- 点 hero → `open-photo` 带 `(currentHero, [currentHero])`(D9)。
- 点 `.close` → `close`;点设置封面按钮 → `open-cover-picker`;点两个动作按钮 → `open-library` / `save-album`。
- **「本次旅行」标记只由 `place.recent === true` 触发**:传 `place.recent = true` + `detail.recent = []` → 出现;传 `place.recent = false` + `detail.recent = ['a','b']`(数组真值)→ **不出现**。这条是同名字段陷阱的主守卫。
- 「常驻地」标记由 `place.home`(或 `detail.home`)触发。
- 三统计:`spots` 为空数组或 `detail` 为 null 时地点数显示 `—`;非空时显示条数;照片数与旅行数取 detail 优先、place 兜底。
- 单复数:`trips === 1` 用 `photosPlacesTrip`、`trips === 2` 用 `photosPlacesTrips`。
- 日期本地化:`place.lastDate` 非空时**不出现**后端原串(如 `'Mar 7, 2026'`);为 null 时**出现**原串(回落)。
- `detailLoading && !detail` → 骨架在;`detail` 到位后骨架消失。
- **z-index 不变量**:读组件源文本,断言 `.map-detail` 的 z-index 数值严格 > 5(`.map-tip`)且严格 < 7(`.map-toolbar`)。
- **hero 前景色合规**:读样式块,断言 `.close`、`.ttl-name`、`.ttl-region` 所在规则**不含** `--on-accent`;且每条钉死色声明的同行/上一行有 `theme-exception` 注释,注释文本不含 `;`、`}`、`<style>` 三者。
- `cssCascade.ts`:hover 态下 `.detail-actions .btn.btn-primary` 的 background 归属含 `:hover` 且含 `-primary` 的规则(不是基类 `.btn:hover`)。
- 窄屏规则存在:样式块含 `max-width: 768px` 且其中 `.map-detail` 的 width 为 100%。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/components/__tests__/PlaceDetailPanel.test.ts`
- [ ] **Step 3: 实现(含新增 `--place-home-base` token 两套主题 + THEMING.md 登记)**
- [ ] **Step 4: 跑测试确认通过 + color-guard 绿 + 逐个删码验证**

Run: `pnpm exec vitest run src/photos/components/__tests__/PlaceDetailPanel.test.ts src/styles/color-guard.test.ts`

删码清单(一次只删一处):①「本次旅行」判据从 `place.recent` 换成 `detail.recent` → 同名字段守卫用例红;②`|| '—'` 删掉 → 地点数破折号用例红;③`currentHero` 的列表项兜底删掉 → 优先级用例的后两档红;④空 `currentHero` 的 img 守卫删掉 → 「不渲染 img」红;⑤`.btn-primary:hover` 整条删掉 → cssCascade 用例红;⑥`.map-detail` 的 z-index 改成 4 → 不变量用例红;⑦单复数三元换成恒用 `photosPlacesTrips` → 单复数用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6b-T3 地点详情面板外壳 + hero + 三统计 + 两动作`

---

