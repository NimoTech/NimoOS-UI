### Task 8: `PlacesZoomBar.vue` —— 垂直缩放滑杆

**Files:**
- Create: `src/photos/components/PlacesZoomBar.vue`
- Create: `src/photos/components/__tests__/PlacesZoomBar.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:952-970`(模板)、`:666-692`(zoombarSetFromEvent / onZoombarDown/Move/Up)、`photos-places.scss:234-284`

**Interfaces:**
- Consumes: `MAX_SCALE`(T2);T4 的键
- Produces:
  ```ts
  // props
  { zoomFrac: number, dotColor: string }   // dotColor = T10 主题的强调色,喂给 --accent 局部覆盖
  // emits
  (e: 'zoom-by', factor: number): void     // ± 按钮:1.5 / (1/1.5)
  (e: 'set-scale', scale: number): void    // 拖轨道
  (e: 'reset'): void
  ```

**结构规格(照 Vue2 `:952-970`,四个节点一个不能少):**

1. `.map-zoombar`,`:style="{ '--accent': dotColor }"`(**Vue2 就是在这里局部覆盖 `--accent`,让滑杆跟随地图主题色**;照搬。注释登记:这是 D5 地图主题的一部分,不算违反 token 铁律 —— 值本身来自 T10 的例外色表)。
2. `.zb-btn` 放大键,内容字面 `+`,`:title="t('photosPlacesZoomIn')"`,`@click` emit `zoom-by(1.5)`。
3. `.zb-track`(绑 `pointerdown`/`pointermove`/`pointerup`/`pointercancel`),内含 `.zb-fill`(`:style="{ height: zoomFrac * 100 + '%' }"`)与 `.zb-thumb`(`:style="{ bottom: zoomFrac * 100 + '%' }"`)。**fill 用 height、thumb 用 bottom —— 两个不同属性,别写成同一个。**
4. `.zb-btn` 缩小键,内容字面 `−`(**U+2212 减号,不是 ASCII 连字符**),emit `zoom-by(1/1.5)`。
5. `.zb-btn.zb-reset`,内容字面 `⤢`,`:title="t('photosPlacesResetView')"`,emit `reset`。

**拖拽换算(照 Vue2 `:666-673`):`t = clamp((e.clientY - rect.top) / rect.height, 0, 1)`,`scale = MAX_SCALE - t * (MAX_SCALE - 1)` —— 顶=最大缩放、底=最小。** `onDown` 记 `_dragging = true` + 立即换算一次 + `setPointerCapture`;`onMove` 仅在 `_dragging` 时换算;`onUp` 清标志 + `releasePointerCapture`(**包 try/catch**)。

- [ ] **Step 1: 写失败测试**

必含用例:
- 四个节点齐备:两个 `.zb-btn` + `.zb-reset` + `.zb-track` 内的 `.zb-fill` 与 `.zb-thumb`。
- `zoomFrac = 0.5` → fill 的 `height` 为 `50%`、thumb 的 `bottom` 为 `50%`(**分别断言,证明没写成同一属性**)。
- `+` emit `zoom-by` 带 `1.5`;`−` emit `zoom-by` 带 `1/1.5`(用 `toBeCloseTo`);`⤢` emit `reset`。
- 减号是 U+2212:`expect(minusBtn.text()).toBe('−')`。
- 轨道换算(mock `getBoundingClientRect` 返 `{top: 100, height: 200}`):`clientY = 100`(顶)→ `set-scale` 为 `MAX_SCALE`;`clientY = 300`(底)→ `1`;`clientY = 200`(中)→ `(MAX_SCALE + 1) / 2 = 8.5`。**三个数手算。**
- 越界钳制:`clientY = 0` → `MAX_SCALE`;`clientY = 999` → `1`。
- `pointermove` 未经 `pointerdown` → 不 emit。
- `pointerup` 后再 `pointermove` → 不 emit。
- `dotColor` 落到根元素 style 的 `--accent` 上。
- `releasePointerCapture` 抛异常时不冒泡。

- [ ] **Step 2-4: 跑失败 → 实现 → 跑通过 + 逐个删码验证**

删码清单:①`_dragging` 守卫删掉 → 「未经 down 的 move 不 emit」红;②换算里的 `clamp` 删掉 → 越界用例红;③`MAX_SCALE - t * (MAX_SCALE - 1)` 写成 `1 + t * (…)`(方向反了)→ 顶/底用例红;④fill 的 height 改成 bottom → 对应用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T8 地图缩放滑杆(顶=最大缩放,pointer capture 拖拽)`

---

