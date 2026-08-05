### Task 8: `PhotoFilmstrip.vue` — 底部缩略图条(居中/滚轮/点击翻页)

**Files:**
- Create: `src/photos/lightbox/PhotoFilmstrip.vue`
- Test: `src/photos/lightbox/__tests__/PhotoFilmstrip.test.ts`

**Interfaces:**
- Consumes:移植源 Vue2 `PhotosLightbox.vue:167-176`(模板)+ `:249-298`(centerActiveThumb/findCenterThumbIndex/updateLocalActiveFromCenter/commitSelection/onStripWheel);`service.photos.thumbnailUrl(id,'small')`;`useLightbox()`(list/index/goTo)或改 props 制。
- Produces:
  - props `{ list: Photo[]; index: number }`;emits `select(i:number)`。
  - 一行横向缩略图(`<img loading=lazy>`),当前项高亮描边;点击某缩略图 emit `select(i)`;当前 index 变化时把该缩略图平滑居中(`scrollInto-view` 或 `scrollLeft` 计算,照 Vue2 `centerActiveThumb`);滚轮纵向/横向 → 横向滚动(`onStripWheel`,`{passive:false}` + `preventDefault`),停 140ms 后按居中项 `commitSelection` emit select(照 Vue2 `:292-298`)。
  - 视频角标(小三角/时长)照 grid 简版。
- **移植 delta**:`this.$emit('nav', delta)` 的相对翻页 → 本组件用 `select(绝对 index)`(父 T6/T9 用 `lb.goTo`);字符串 ref 数组化按 P1 铁律(`ref` 收集用 `Array.isArray` 归一)。

- [ ] **Step 1: 写失败测试**
  - 渲染 N 个缩略图;第 `index` 个有 active class。
  - 点第 k 个 emit `select(k)`。
  - 滚轮触发后 `advanceTimersByTime(140)` → emit select(居中项索引;jsdom 造 scrollLeft/offset)。
  - 缩略图 src = `thumbnailUrl(id,'small')`(mock)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱底部缩略图条(居中/滚轮/点击翻页)`

---

