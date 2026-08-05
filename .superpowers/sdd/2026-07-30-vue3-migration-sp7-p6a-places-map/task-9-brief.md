### Task 9: `PlacesFilterMenu.vue` —— Filters 弹层

**Files:**
- Create: `src/photos/components/PlacesFilterMenu.vue`
- Create: `src/photos/components/__tests__/PlacesFilterMenu.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:830-906`(chip + 弹层模板)、`:152-186`(过滤态)、`:441-449`(toggleRegion / clearFilters)、`photos-places.scss:199-231`(chip)、`:854-963`(弹层)

**Interfaces:**
- Consumes: `type PlacesFilter`, `type RegionCount`, `extraFilterCount`, `regionLabelKey`(T2);T4 的键
- Produces:
  ```ts
  // props
  { filter: PlacesFilter, regions: RegionCount[], open: boolean }
  // emits
  (e: 'update:filter', next: PlacesFilter): void   // 一律整体替换,不就地改 prop
  (e: 'update:open', open: boolean): void
  ```
  chip 与弹层同在本组件内(Vue2 也是同一个 `position:relative` 容器,`:830-906`)。

**结构规格(照 Vue2,五段一个不能漏):**

1. **chip 按钮** `.map-chip`:filter 图标(11px)+ `photosPlacesFilters` + **计数徽标**(`extraFilterCount(filter) + (timeFilter !== 'all' ? 1 : 0)`,非 0 才渲染,`font-variant-numeric: tabular-nums`、`opacity .7`)+ chevron(10px)。`anyExtraFilter || timeFilter !== 'all'` 时 chip 加 `.is-active`。
2. **`.mfp-section` 时间范围**:`h6` 标题 + 两个 `<input type="date">`(中间一个 `—` 分隔)+ `.mfp-date-sub` 两个小标签(起始/结束日期)。**两个 input 的 `@input` 都要把 `timeFilter` 置成 `(customStart && customEnd) ? 'custom' : 'all'`**(照 Vue2 `:849`/`:854` —— 只填一头时整条时间过滤退回「全部时间」)。
3. **`.mfp-section` 最少照片数**:`h6` + 五个按钮 `[0, 10, 50, 100, 200]`,`0` 显示 `photosPlacesAny`、其余显示 `photosPlacesAtLeast`({n}),当前值加 `.is-active`。
4. **`.mfp-section` 区域**:`h6` + 「全部」按钮(`!regionFilter` 时 `.is-active`)+ 每个 region 一个按钮(**大洲名走 `regionLabelKey` 有键则译、无键回落后端 label**);region 按钮是**切换语义**(再点一次清空,照 Vue2 `toggleRegion` `:441`)。
5. **`.mfp-section` 只看当前行程**:`label.mfp-checkbox`(`recentOnly` 时加 `.is-on`)+ `.mfp-tick`(勾选时内嵌 check 图标 10px)+ 隐藏的真 `<input type="checkbox">` + 文案。
6. **`.mfp-foot`**:`.mfp-reset`(emit 全清:minCount 0 / regionFilter null / recentOnly false / timeFilter 'all' / 两个日期空串,照 Vue2 `:442-449`)+ `.mfp-done`(只关弹层)。

**浮层规范:** `open` 为真时挂 `document` 级 `mousedown`(点外部关闭,容器 ref 内不关)与 `keydown`(Esc 关闭);`watch(open)` 挂/摘;**`onDocKeydown` 里禁止早退**(P5-T10 真 bug:与主题弹层同开时 Esc 只关一个)。

**样式要点:** `.mfp-count-row button.is-active` / `.mfp-region-row button.is-active` / `.mfp-checkbox.is-on .mfp-tick` 都是「基类 + 变体」形态 → **变体必须自带 `:hover` 背景**,并用 `cssCascade.ts` 断言。`.mfp-tick` 里的 check 图标 Vue2 用 `color="white"` 硬编码,压在 `--accent` 实底上 → **这里可以用 `--on-accent`**(背景确为 accent 实底,符合前提);**先核实实现里 `.is-on .mfp-tick` 的背景确实是 `var(--accent)` 纯实底再用**,若是渐变/半透明就改钉死浅色 + theme-exception。

- [ ] **Step 1: 写失败测试**

必含用例:
- chip 徽标:`{minCount: 10, regionFilter: 'asia', recentOnly: true, timeFilter: 'year'}` → 徽标显示 `4`;全默认 → 徽标节点不存在;`timeFilter: 'year'` 单独 → `1`。
- chip `.is-active`:任一额外过滤或 `timeFilter !== 'all'` 时有;全默认时无。
- 五个 minCount 按钮渲染,`0` 显示「不限」;点 `50` emit `update:filter` 且 `minCount === 50`,**其余字段与传入一致**(断言整体替换而非丢字段)。
- 区域按钮:`regionLabelKey` 有键的用译文、未知 id 回落 label;点已选中的 region 再点一次 → `regionFilter` 变 `null`(切换语义)。
- 日期:只填 start → emit 的 `timeFilter` 为 `'all'`;两头都填 → `'custom'`。**这条是 Vue2 `:849` 的语义,漏了会让「只填一头」错误地筛掉全部地点。**
- 勾选框:点击 emit `recentOnly` 取反;`recentOnly` 为真时 `.mfp-checkbox` 有 `.is-on` 且内有 check 图标。
- 重置:emit 的 filter 六个字段全回默认。
- 完成:只 emit `update:open(false)`,不 emit filter。
- 浮层:`open` 为真时 document `mousedown` 在外部 → emit `update:open(false)`;在容器内 → 不 emit。Esc → 关闭。**`open` 为假时 document 事件不再触发 emit**(证明监听已摘)。
- 事件派发一律带 `bubbles: true`(P4 假绿事故)。
- `cssCascade.ts`:三处变体(`.is-active` 两处 + `.is-on .mfp-tick`)在 hover 态下背景归属变体规则。

- [ ] **Step 2-4: 跑失败 → 实现 → 跑通过 + 逐个删码验证**

删码清单:①徽标的 `timeFilter !== 'all' ? 1 : 0` 那项删掉 → 徽标计数用例红;②日期 `@input` 的 `(customStart && customEnd)` 条件改成恒 `'custom'` → 「只填一头」用例红;③region 的切换语义改成只赋值 → 「再点一次清空」红;④`watch(open)` 的摘监听删掉 → 「open 为假时不触发」红;⑤`onDocKeydown` 加一个早退 `if (!open) return` 之外的早退分支(模拟 P5 的 bug)→ 需有一条「两个弹层同开时 Esc 各自关闭」的集成断言在 T11,此处记账;⑥变体的 `:hover` 规则删掉 → cssCascade 红。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T9 地图 Filters 弹层(时间/最少照片/大洲/当前行程 + 徽标计数)`

---

